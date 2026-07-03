# CGAO — Claude GitHub Auto Orchestra

A Claude Code plugin for **automated GitHub issue-to-merge workflows**, built with a multi-phase, multi-agent architecture inspired by [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode).

## Architecture

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

## Pipeline Phases

| Phase | Skill | Agent | Key Tools |
|-------|-------|-------|-----------|
| **1. Scan** | `/cgao:scan` | issue-triage | `cgao_triage_issue` |
| **2. Evaluate** | `/cgao:evaluate` | issue-triage | `cgao_analyze_codebase` |
| **3. Fix** | `/cgao:fix` | fix-planner + executor | `cgao_plan_fix`, `cgao_assess_pr_quality` |
| **4. Create PR** | `/cgao:pr-create` | — | `cgao_assess_pr_quality`, `create_pull_request` |
| **5. Review** | `/cgao:review` | pr-reviewer | `create_pull_request_review` |
| **6. Monitor** | `/cgao:monitor` | — | `cgao_check_merge_readiness` |

Each phase has an independent skill, uses specialized agents, and persists state to `.cgao/` for cross-session continuity.

## Installation

### Prerequisites
- Claude Code installed
- GitHub CLI (`gh`) authenticated, or `GITHUB_PAT` env var set
- Node.js >= 20

### 1. Install Official GitHub MCP

```bash
claude mcp add github --transport stdio \
  --env GITHUB_PERSONAL_ACCESS_TOKEN=$GITHUB_PAT \
  -- npx -y @anthropic-ai/github-mcp-server
```

### 2. Install CGAO

```bash
npm install -g cgao
claude plugins install cgao
```

### 3. Verify

```bash
cgao setup
```

## Usage

```bash
# Full pipeline: scan → evaluate → fix → PR → review → monitor
/cgao:scan "label:bug is:open"     # Find bugs
/cgao:evaluate 42                  # Deep evaluate issue #42
/cgao:fix 42                       # Plan and implement fix
/cgao:pr-create 42                 # Create PR
/cgao:review 142                   # Automated review
/cgao:monitor 142                  # Monitor until merge
```

### With OMC for Parallel Automation

```bash
/oh-my-claudecode:ultrawork /cgao:scan "label:bug"
```

## Custom MCP Tools

CGAO provides 6 intelligent tools (`mcp__cgao__*`) that complement the official GitHub MCP:

| Tool | What It Does |
|------|-------------|
| `cgao_triage_issue` | Classify issue (bug/feature/question), assess severity & scope, recommend action |
| `cgao_analyze_codebase` | Search codebase for files/functions related to an issue |
| `cgao_plan_fix` | Generate structured fix plan with steps, complexity, and testing strategy |
| `cgao_assess_pr_quality` | Automated quality gates: branch check, diff size, commit quality, test presence |
| `cgao_check_merge_readiness` | Comprehensive merge blocker analysis: CI, reviews, conflicts |
| `cgao_workflow_state` | Persistent workflow state tracking across sessions |

## Agents

| Agent | Model | Role |
|-------|-------|------|
| `issue-triage` | Sonnet | Classify issues, assess severity and scope |
| `fix-planner` | Opus | Create structured implementation plans |
| `pr-reviewer` | Opus | 7-dimension code review with severity ratings |

## State Persistence

Workflow state is stored in `.cgao/` directory:
```
.cgao/
├── triage-42.json     # Triage result for issue #42
├── analysis-42.json   # Codebase analysis for issue #42
├── plan-42.json       # Fix plan for issue #42
└── workflow-42.json   # Workflow state (phase tracking, linked PR)
```

This enables cross-session continuity — start a fix in one session, continue monitoring in another.

## License

MIT
