# CGAO — Claude GitHub Auto Orchestra

A Claude Code plugin for automated GitHub issue-to-merge workflows. Multi-phase, multi-agent architecture.

## Project Overview

- **Type**: Claude Code plugin (`.claude-plugin/plugin.json` + skills + MCP tools)
- **Language**: TypeScript (compiles to `dist/`), Markdown (skills/agents/commands)
- **Runtime**: Node.js ≥ 20
- **Dependencies**: `@modelcontextprotocol/sdk` (MCP server), `esbuild` + `typescript` (dev)
- **External dependency**: [`github/github-mcp-server`](https://github.com/github/github-mcp-server) — user installs via `claude mcp add-json` (remote HTTP, one command)
- **Build**: `npm run build` → `tsc` + `node scripts/build-mcp-server.mjs`
- **Install**: `claude plugins install https://github.com/RankoHata/cgao`
- **State**: `.cgao/` directory (JSON files, committed to repo's `.gitignore` but NOT plugin's)

## Architecture

```
Plugin Registration → 1 MCP Server → 6 Skills → 3 Agents → 6 Smart Tools
```

### Layers
1. **`.claude-plugin/plugin.json`** — plugin entry point. Declares 6 skills (→ `/cgao:scan` etc), 1 MCP server (`.mcp.json`), 6 commands
2. **`.mcp.json`** — MCP server declaration. CGAO custom MCP (`node bridge/mcp-server.cjs`). GitHub MCP is a prerequisite installed separately by the user.
3. **`src/mcp/tools.ts`** — 6 intelligent MCP tools (`mcp__cgao__*`). These ADD intelligence on top of the official GitHub MCP. **They NEVER call GitHub's API directly** — all GitHub data comes in as parameters from `mcp__github__*` tools.
4. **`src/github/api.ts`** — local git operations only (`resolveRepo()` for owner/repo detection). NO HTTP client, NO token handling. All GitHub API access goes through the official GitHub MCP.
5. **`src/agents/definitions.ts`** — 3 specialized agents (issue-triage/sonnet, fix-planner/opus, pr-reviewer/opus)
6. **`skills/*/skill.md`** — 6 phase workflows. Each skill orchestrates one pipeline phase
7. **`commands/*.md`** — lazy-load shims (thin proxies → skills)

### Data Flow
```
User: /cgao:scan "label:bug"
  → commands/scan.md (shim, lazy-load)
  → skills/scan/skill.md (orchestration instructions)
  → Agent calls mcp__github__search_issues (official MCP → GitHub API → issue list)
  → Agent calls mcp__github__issue_read (official MCP → GitHub API → full issue object)
  → Agent calls mcp__cgao__cgao_triage_issue (CGAO MCP → receives issue data as parameter → classification logic → writes .cgao/triage-N.json)
  → Agent compiles triage report
```
**Key principle**: GitHub MCP handles ALL API access. CGAO MCP receives the data as parameters and adds intelligence.

## Key Files

| File | Role | When to Edit |
|------|------|-------------|
| `.claude-plugin/plugin.json` | Plugin registration | Add/remove skills or MCP servers |
| `.mcp.json` | MCP server declarations | Change MCP server config |
| `src/mcp/tools.ts` | 6 smart MCP tools (CORE) | Add/modify tool logic |
| `src/mcp/standalone-server.ts` | MCP stdio server bootstrap | Rarely — transport layer |
| `src/github/api.ts` | Local git ops + type interfaces | Rarely — no HTTP logic to add |
| `src/agents/definitions.ts` | Agent registry + prompts | Add/modify agents |
| `src/cli/index.ts` | CLI (cgao setup/status) | Add CLI commands |
| `src/index.ts` | Public exports | Add exports for SDK use |
| `skills/*/skill.md` | Phase orchestration | Modify workflow steps |
| `commands/*.md` | Lazy-load shims | Update when skill names change |
| `agents/*.md` | Agent prompt definitions | Tune agent behavior |
| `scripts/build-mcp-server.mjs` | esbuild bundler for MCP server | Change bundle config |
| `hooks/hooks.json` | SessionStart reminder | Modify hook behavior |
| `ARCHITECTURE.md` | Developer reference | Document architecture changes |

## Development Workflow

### After editing TypeScript:
```bash
npm run build
# This runs: tsc → scripts/build-mcp-server.mjs
# Output: dist/ (compiled JS) + bridge/mcp-server.cjs (standalone bundle)
```

### After editing skills/agents/commands:
No build needed — these are Markdown read at runtime by Claude Code.

### After editing plugin config:
```bash
claude plugins uninstall cgao
claude plugins install .
```

### Testing changes:
```bash
# Verify build
ls dist/ bridge/mcp-server.cjs

# Verify registration
claude plugins list | grep cgao

# Verify MCP tools
claude mcp list

# Run diagnostics
cgao setup
```

## Important Constraints

1. **`bridge/mcp-server.cjs` and `dist/` MUST be committed** — marketplace install does NOT run `npm install` or `npm run build`. The plugin must work directly from a git clone.

2. **CGAO tools ADD intelligence, don't duplicate** — never call GitHub API directly. CGAO tools receive data from `mcp__github__*` as parameters, then do: classification heuristics, codebase search (local filesystem), quality analysis, state persistence. If you find yourself adding an HTTP call to `api.github.com`, STOP — use GitHub MCP instead.

3. **State is in `.cgao/` (project dir), not in plugin dir** — workflow state is per-project, not per-plugin-installation. Uses JSON files: `triage-N.json`, `analysis-N.json`, `plan-N.json`, `workflow-N.json`.

4. **Skills reference MCP tools by full name** — `mcp__github__search_issues`, `mcp__cgao__cgao_triage_issue`. These names are determined by `.mcp.json` server keys.

5. **Agent prompts can be overridden per-project** — `loadPrompt()` checks `<cwd>/agents/<name>.md` before falling back to bundled prompts.

6. **Authentication is handled by GitHub MCP only** — CGAO has NO token logic. The user must install the official GitHub MCP server with proper auth via `claude mcp add-json`. CGAO tools receive already-fetched data as parameters, they never authenticate to GitHub themselves.

## Pipeline Phases Reference

| Phase | Skill | Agent | CGAO Tool | GH MCP Tool(s) | State File |
|-------|-------|-------|-----------|-------------|------------|
| 1. Scan | `/cgao:scan` | issue-triage | `cgao_triage_issue` | `search_issues` + `issue_read` | `triage-N.json` |
| 2. Evaluate | `/cgao:evaluate` | issue-triage | `cgao_triage_issue`, `cgao_analyze_codebase` | `issue_read` | `analysis-N.json` |
| 3. Fix | `/cgao:fix` | fix-planner | `cgao_plan_fix`, `cgao_assess_pr_quality` | — | `plan-N.json` |
| 4. PR Create | `/cgao:pr-create` | — | `cgao_assess_pr_quality` | `create_pull_request` | `workflow-N.json` |
| 5. Review | `/cgao:review` | pr-reviewer | `cgao_assess_pr_quality` | `pull_request_read` + `pull_request_review_write` | `workflow-N.json` |
| 6. Monitor | `/cgao:monitor` | — | `cgao_check_merge_readiness` | `pull_request_read` (4 methods: get, get_reviews, get_status, get_check_runs) | `workflow-N.json` |

**Note**: In all phases, GitHub MCP tools fetch the data FIRST, then CGAO tools receive it as parameters for analysis.

## Coding Conventions

- TypeScript: strict mode, ES2022 target, NodeNext modules
- Tools: Zod-style schema definitions (plain JSON Schema objects)
- No classes unless stateful — functions + typed interfaces preferred
- Error handling: try/catch in every tool handler, return `{ isError: true }` on failure
- State: JSON files in `.cgao/`, `ensureStateDir()` before write, `readState()` returns null on missing
- Naming: `cgao_<verb>_<noun>` for tools, kebab-case for skills/agents
