---
name: scan
description: "Discover and triage GitHub issues — scan repo, classify each issue, report actionable items"
argument-hint: "[filter: bug, feature, good first issue, or search query]"
---

# CGAO Scan — Issue Discovery & Triage

Discover and triage GitHub issues. Scans the repository for open issues, classifies each one, and produces a prioritized triage report.

## Usage

```
/cgao:scan                              # Scan all open issues
/cgao:scan "label:bug"                  # Scan bugs only
/cgao:scan "good first issue"           # Scan beginner-friendly issues
```

## Architecture: GitHub MCP fetches data, CGAO MCP analyzes it

CGAO tools **NEVER** call GitHub's API directly. They receive data you already
fetched via GitHub MCP tools and add intelligence (classification, analysis, planning).
The flow is always:

```
GitHub MCP (fetch) → CGAO MCP (analyze) → State file (.cgao/)
```

## Tools Used

| Tool | Purpose |
|------|---------|
| `mcp__github__search_issues` | Find issues matching query |
| `mcp__github__list_issues` | List repo issues with filters |
| `mcp__github__issue_read` | Fetch full issue details |
| `mcp__cgao__cgao_triage_issue` | **Classify and assess each issue** |

---

## Phase 1: Discover Issues

1. If user provided a query, call `mcp__github__search_issues` with that query
2. Otherwise, call `mcp__github__list_issues` with `state: "open"`, `per_page: 20`
3. If targeting specific labels (bug, enhancement, help wanted), filter accordingly

## Phase 2: Triage Each Issue

For each candidate issue, you MUST follow this two-step pattern:

**Step A — Fetch the full issue:**
Call `mcp__github__issue_read` with `method: "get"` and the issue number.
This returns the full issue object with title, body, labels, state, assignee, etc.

**Step B — Classify with CGAO:**
Call `mcp__cgao__cgao_triage_issue` with:
- `issue_number`: the issue number
- `issue`: the FULL issue object from Step A (pass the entire JSON response)

```
Example:
  1. mcp__github__issue_read({method: "get", issue_number: 42})
     → returns {title: "...", body: "...", labels: [...], state: "open", ...}
  2. mcp__cgao__cgao_triage_issue({issue_number: 42, issue: <the object from step 1>})
     → returns classification, severity, recommendation
```

The triage tool returns:
- **classification**: bug / feature / question / other
- **severity**: critical / high / medium / low
- **scope**: large / medium / small
- **actionable**: yes / no
- **recommendation**: fix_urgent / fix_prioritized / fix / needs_scoping / skip_*

## Phase 3: Produce Triage Report

```markdown
## Issue Scan Report — <repo>

### Summary
- Total scanned: <N>
- 🔴 Urgent fixes: <N>
- 🟠 Prioritized fixes: <N>
- 🟡 Regular fixes: <N>
- ⏭️ Skipped: <N>

### Actionable Issues (sorted by priority)

| # | Title | Type | Severity | Scope | Action |
|---|-------|------|----------|-------|--------|
| 42 | Fix OAuth token refresh | bug | critical | small | FIX NOW |
| 43 | Add rate limit headers | feature | medium | medium | Fix |

### Skipped Issues
| # | Title | Reason |
|---|-------|--------|
| 44 | How do I configure X? | Question — redirect to docs |

### Recommended Next Actions
1. Evaluate `/cgao:evaluate 42` — highest priority
2. ...
```

## Decision Rules

- **Never mark an issue as "fix" without calling both `mcp__github__issue_read` AND `mcp__cgao__cgao_triage_issue`**
- **Always fetch the issue first** — `cgao_triage_issue` needs the full issue object, it does NOT fetch it for you
- If all issues are low severity, report that and suggest broadening the search
- If unsure about an issue, flag it for manual review rather than guessing

Task: {{ARGUMENTS}}
