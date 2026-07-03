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

## Tools Used

| Tool | Purpose |
|------|---------|
| `mcp__github__search_issues` | Find issues matching query |
| `mcp__github__list_issues` | List repo issues with filters |
| `mcp__cgao__cgao_triage_issue` | **Classify and assess each issue** |

---

## Phase 1: Discover Issues

1. If user provided a query, call `mcp__github__search_issues` with that query
2. Otherwise, call `mcp__github__list_issues` with `state: "open"`, `per_page: 20`
3. If targeting specific labels (bug, enhancement, help wanted), filter accordingly

## Phase 2: Triage Each Issue

For each candidate issue, call `mcp__cgao__cgao_triage_issue` with the issue number.

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

- **Never mark an issue as "fix" without calling `cgao_triage_issue`** — the triage tool does the analysis
- If all issues are low severity, report that and suggest broadening the search
- If unsure about an issue, flag it for manual review rather than guessing

Task: {{ARGUMENTS}}
