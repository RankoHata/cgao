# CGAO — Claude GitHub Auto Orchestra

A Claude Code plugin for **automated GitHub issue-to-merge workflows**, built with a multi-phase, multi-agent architecture inspired by [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode).

---

## How It Works

```
                         ┌──────────────────────┐
                         │   6 Specialized      │
                         │   Skills (Markdown)  │
                         │   scan→evaluate→fix  │
                         │   →pr-create→review  │
                         │   →monitor           │
                         └──────────┬───────────┘
                                    │ orchestrates
         ┌──────────────────────────┼──────────────────────────┐
         │                          │                          │
         ▼                          ▼                          ▼
┌─────────────────┐    ┌─────────────────────┐    ┌──────────────────┐
│ 3 CGAO Agents   │    │ 6 CGAO Smart Tools  │    │ Official GitHub  │
│ (issue-triage,  │    │ (mcp__cgao__*)      │    │ MCP (mcp__github │
│  fix-planner,   │    │ triage, analyze,    │    │  __*)            │
│  pr-reviewer)   │    │ plan, quality check,│    │ Raw API: issues, │
│                 │    │ merge readiness,    │    │ PRs, reviews...  │
│                 │    │ workflow state)     │    │                  │
└─────────────────┘    └─────────────────────┘    └──────────────────┘
```

---

## Installation

### Prerequisites

| Requirement | Check | Install |
|-------------|-------|---------|
| Claude Code | `claude --version` | [claude.ai/code](https://claude.ai/code) |
| GitHub CLI | `gh --version` | `brew install gh` / `winget install GitHub.cli` |
| GitHub auth | `gh auth status` | `gh auth login` |
| Node.js ≥ 20 | `node --version` | [nodejs.org](https://nodejs.org) |

Your GitHub account needs a **Personal Access Token (PAT)** or `gh` authentication with these scopes:

| Scope | Why |
|-------|-----|
| `repo` | Read/write code, create PRs |
| `read:org` | Read org-level data |
| `read:user` | Read user profile |

Create a Fine-Grained PAT at https://github.com/settings/tokens?type=beta or use a classic token at https://github.com/settings/tokens.

```bash
export GITHUB_PAT=github_pat_xxxxxxxxxxxx
# or if using classic token:
export GITHUB_PAT=ghp_xxxxxxxxxxxx
```

### Step 1: Install the Official GitHub MCP Server

CGAO depends on the official [`github/github-mcp-server`](https://github.com/github/github-mcp-server) for all raw GitHub API operations.

```bash
claude mcp add-json github '{"type":"http","url":"https://api.githubcopilot.com/mcp","headers":{"Authorization":"Bearer '"$GITHUB_PAT"'"}}'
```

Verify:

```bash
claude mcp list
# Should show "github" in the list
```

### Step 2: Install CGAO

在 Claude Code 会话中，通过 `/plugin` 命令安装：

```
/plugin install https://github.com/RankoHata/cgao
```

或从本地开发目录安装：

```
/plugin marketplace add /path/to/cgao
/plugin install cgao
```

<details>
<summary>开发者：克隆 dev 分支本地安装</summary>

```bash
git clone -b dev git@github.com:RankoHata/cgao.git
cd cgao
npm install
npm run build
```

然后在 Claude Code 会话中：

```
/plugin marketplace add ./cgao
/plugin install cgao
```
</details>

Verify:

```bash
claude plugins list
# Should show "cgao" with version 0.1.0
```

Claude Code discovers from the plugin:
- **6 skills** → `/cgao:scan`, `/cgao:evaluate`, `/cgao:fix`, `/cgao:pr-create`, `/cgao:review`, `/cgao:monitor`
- **1 MCP server** → CGAO custom MCP (`mcp__cgao__*`) + GitHub MCP is a prerequisite
- **6 commands** → lazy-load shims

### Step 3: Verify Everything

```bash
cgao setup
```

Expected output:

```
CGAO Setup
==========
✅ gh CLI: gh version 2.x.x
✅ GITHUB_PAT/GITHUB_TOKEN is set
✅ Official GitHub MCP registered
```

### Troubleshooting

**"No GitHub token"**
```bash
gh auth login
# or
export GITHUB_PAT=ghp_xxxx
```

**"Official GitHub MCP not registered"**
```bash
claude mcp add-json github '{"type":"http","url":"https://api.githubcopilot.com/mcp","headers":{"Authorization":"Bearer '"$GITHUB_PAT"'"}}'
```

**"Plugin not found"**
```
# 在 Claude Code 会话中重装
/plugin uninstall cgao
/plugin install https://github.com/RankoHata/cgao
```

**"Plugin not showing up"**
```
/plugin list
# 如果没有，重装
/plugin install https://github.com/RankoHata/cgao
```

**"mcp__cgao__* tools not found"**
```bash
# Verify the MCP server is registered
claude mcp list
# Should show both "github" and "cgao"
# If cgao is missing, re-install the plugin:
# /plugin uninstall cgao
# /plugin install https://github.com/RankoHata/cgao
# Then restart Claude Code
```

---

## Usage

### Quick Start

Start Claude Code in a GitHub repository, then:

```
/cgao:scan "label:bug is:open"
```

This scans for open bugs, triages each one, and produces a prioritized report.

### Phase-by-Phase Usage

Each phase is independent. You can run any phase directly.

#### Phase 1: Scan — Issue Discovery & Triage

```
/cgao:scan                              # All open issues
/cgao:scan "label:bug"                  # Bugs only
/cgao:scan "good first issue"           # Beginner-friendly
```

CGAO scans the repository, classifies each issue (bug/feature/question), assesses severity (critical/high/medium/low), estimates scope (small/medium/large), and reports a prioritized list.

#### Phase 2: Evaluate — Deep Issue Assessment

```
/cgao:evaluate 42
```

**This is the mandatory gate before any code is written.** CGAO fetches the full issue, runs `cgao_analyze_codebase` to find relevant files, estimates effort, assesses risk, and makes a **GO / NO-GO** decision.

If NO-GO, CGAO explains why and suggests alternatives.

#### Phase 3: Fix — Plan & Implement

```
/cgao:fix 42
```

**Only works after a GO evaluation.** Delegates to `fix-planner` agent (Opus) to create a structured implementation plan, then `executor` agent for implementation. Runs `cgao_assess_pr_quality` to verify the changes before allowing a push.

#### Phase 4: PR Create — Open a Pull Request

```
/cgao:pr-create 42
/cgao:pr-create 42 --draft           # Draft PR for early feedback
```

Runs the final quality gate (`cgao_assess_pr_quality`), generates a structured PR description with problem/solution/changes/testing checklist, and creates the PR.

#### Phase 5: Review — Automated Code Review

```
/cgao:review 142                      # Standard review (Sonnet)
/cgao:review 142 --deep               # Deep review (Opus architect)
```

Delegates to `pr-reviewer` agent for 7-dimension analysis: correctness, security, performance, maintainability, testing, regression risk, consistency. Each finding is severity-rated (CRITICAL/HIGH/MEDIUM/LOW). Submits the review as APPROVE, REQUEST_CHANGES, or COMMENT.

#### Phase 6: Monitor — Track Until Merge

```
/cgao:monitor 142                     # One-time check
/cgao:monitor 142 --watch             # Continuous monitoring
```

Runs `cgao_check_merge_readiness` which aggregates CI status, required reviews, merge conflicts, and branch protection into a comprehensive blocker report with a status dashboard.

### End-to-End Pipeline

Run all phases in sequence:

```
/cgao:scan "label:bug is:open is:open"
# → finds issue #42

/cgao:evaluate 42
# → GO: medium severity bug, small scope

/cgao:fix 42
# → Fix planned and implemented, branch pushed

/cgao:pr-create 42
# → PR #142 created

/cgao:review 142
# → APPROVED with 2 LOW suggestions

/cgao:monitor 142
# → Dashboard: CI ✅, Reviews ✅, Ready to merge 🚀
```

### Multi-Session Continuity

State persists in `.cgao/`:

```bash
# Start in one session
/cgao:evaluate 42

# Continue in another session (next day, different machine)
/cgao:fix 42        # Reads .cgao/triage-42.json and .cgao/analysis-42.json

# Track progress anytime
cgao status
```

### With OMC for Multi-Agent Acceleration

If you have [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) installed, OMC's parallel agents accelerate each phase:

```bash
# Ultrawork mode: parallel exploration + implementation
/oh-my-claudecode:ultrawork /cgao:fix 42

# OMC agents handle exploration + execution in parallel
# CGAO handles the GitHub workflow orchestration
```

---

## Pipeline Phases Reference

| # | Phase | Skill | Agent | Key CGAO Tool | Official GitHub MCP Tool |
|---|-------|-------|-------|---------------|--------------------------|
| 1 | Scan | `/cgao:scan` | issue-triage | `cgao_triage_issue` | `search_issues`, `list_issues` |
| 2 | Evaluate | `/cgao:evaluate` | issue-triage | `cgao_analyze_codebase` | `get_issue` |
| 3 | Fix | `/cgao:fix` | fix-planner | `cgao_plan_fix`, `cgao_assess_pr_quality` | — |
| 4 | Create PR | `/cgao:pr-create` | — | `cgao_assess_pr_quality` | `create_pull_request` |
| 5 | Review | `/cgao:review` | pr-reviewer | — | `create_pull_request_review` |
| 6 | Monitor | `/cgao:monitor` | — | `cgao_check_merge_readiness` | `get_pull_request` |

Each phase:
- **Has its own skill** — independent, composable, single responsibility
- **Uses specialized agents** — delegated to the right model for the task
- **Persists state** — `.cgao/` directory for cross-session continuity
- **Validates pre-conditions** — won't run without prior phases completing

---

## Custom MCP Tools

CGAO's 6 custom tools (`mcp__cgao__*`) add intelligence on top of the official GitHub MCP:

| Tool | Input | Output | Why Not Just Use GitHub API |
|------|-------|--------|---------------------------|
| `cgao_triage_issue` | Issue number | Classification, severity, scope, recommendation | Requires classification heuristics: bug vs feature vs question detection, severity inference from keywords, scope estimation from file references |
| `cgao_analyze_codebase` | Issue number + search terms | Relevant files, related commits, project structure, suggested starting points | Requires local codebase access: grep, git log, directory scanning — GitHub API can't read your local files |
| `cgao_plan_fix` | Issue number + approach + affected files | Structured step-by-step plan with complexity estimates and testing strategy | Loads prior triage/analysis state, generates ordered steps with file paths — this is planning logic, not an API call |
| `cgao_assess_pr_quality` | Branch name (optional PR number) | 6 quality checks: branch, sync, diff size, unrelated files, commit quality, test presence | Requires local git operations: `git diff --stat`, `git log`, file listing — not available via API |
| `cgao_check_merge_readiness` | PR number | CI state, review counts, merge conflicts, recommended action | Aggregates across 4+ API endpoints (status, checks, reviews, PR metadata) into a single blocker analysis |
| `cgao_workflow_state` | Action (get/set/list) + issue number + phase | Persistent workflow tracking across sessions | Tracks 6-phase progress with timestamps and linked PR numbers — GitHub API has no concept of "workflow phase" |

---

## Agents

| Agent | Model | Role | When Used |
|-------|-------|------|-----------|
| `issue-triage` | Sonnet | Classify issues, assess severity/scope, recommend action | `/cgao:scan`, `/cgao:evaluate` |
| `fix-planner` | Opus | Create structured implementation plans with risk assessment | `/cgao:fix` (Phase 2: planning) |
| `pr-reviewer` | Opus | 7-dimension code review: correctness, security, performance, maintainability, testing, regression, consistency | `/cgao:review` |

Agent prompts are defined in `agents/*.md` and can be customized per-project by editing these files.

---

## State Persistence

```
.cgao/
├── triage-42.json       # Triage: classification, severity, scope, recommendation
├── analysis-42.json     # Codebase analysis: relevant files, search results, structure
├── plan-42.json         # Fix plan: ordered steps, complexity, testing strategy
├── workflow-42.json     # Workflow: current phase, phase timestamps, linked PR number
└── workflow-43.json     # (another issue being tracked)
```

Check status anytime:

```bash
cgao status
# Workflows: 2 active
# Triages: 3
# Plans: 1
```

---

## Project Structure

```
cgao/
├── .claude-plugin/plugin.json   ← Plugin registration (skills + MCP + commands)
├── .mcp.json                    ← MCP server declarations
├── package.json
├── tsconfig.json
├── README.md
│
├── src/
│   ├── index.ts                 ← Main exports
│   ├── github/api.ts            ← GitHub API helper
│   ├── mcp/
│   │   ├── tools.ts             ← 6 intelligent MCP tools
│   │   └── standalone-server.ts ← MCP stdio server
│   ├── agents/definitions.ts    ← 3 specialized agents
│   └── cli/index.ts             ← CLI (cgao setup/status)
│
├── skills/                      ← 6 phase skills (orchestration)
│   ├── scan/skill.md
│   ├── evaluate/skill.md
│   ├── fix/skill.md
│   ├── pr-create/skill.md
│   ├── review/skill.md
│   └── monitor/skill.md
│
├── commands/                    ← 6 command shims (lazy load)
├── agents/                      ← Agent prompt definitions (.md)
├── hooks/hooks.json             ← SessionStart workflow reminder
│
├── scripts/build-mcp-server.mjs ← esbuild bundler
├── bin/cgao.js                  ← CLI entry
└── bridge/                      ← Built artifacts (generated)
```

---

## License

MIT
