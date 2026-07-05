---
name: evaluate
description: "Deep evaluation of a specific issue — analyze codebase impact, estimate effort, decide go/no-go"
argument-hint: "<issue number>"
---

# CGAO Evaluate — Deep Issue Assessment

Performs deep evaluation of a single issue: codebase analysis, impact estimation, effort sizing, and go/no-go decision. This is the mandatory gate BEFORE any code is written.

## Usage

```
/cgao:evaluate 42        # Deep evaluate issue #42
```

## Architecture: GitHub MCP fetches data, CGAO MCP analyzes it

CGAO tools **NEVER** call GitHub's API directly. The data flow is always:

```
GitHub MCP (fetch issue) → CGAO MCP (triage + analyze) → State files (.cgao/)
```

You fetch the issue from GitHub, then pass it to CGAO for analysis.

## Tools Used

| Tool | Purpose |
|------|---------|
| `mcp__github__issue_read` | **Step 1:** Fetch full issue details |
| `mcp__cgao__cgao_triage_issue` | **Step 2:** Classify and assess severity |
| `mcp__cgao__cgao_analyze_codebase` | **Step 3:** Find relevant files and code areas |
| `mcp__cgao__cgao_workflow_state` | Update workflow tracking |

## Agent

Use the **issue-triage** agent for classification logic.

---

## Phase 1: Fetch & Triage

**Step 1.1** — Fetch the issue:
Call `mcp__github__issue_read` with `method: "get"` and the issue number.
This returns the full issue object (title, body, labels, state, assignee, etc.).

**Step 1.2** — Classify the issue:
Call `mcp__cgao__cgao_triage_issue` with:
- `issue_number`: the issue number
- `issue`: the FULL issue object returned by `mcp__github__issue_read` in Step 1.1

**Do NOT call cgao_triage_issue without first fetching the issue via GitHub MCP.**
CGAO tools do NOT reach out to GitHub — they analyze data you provide.

Read the triage result carefully. Note: classification, severity, scope, recommendation.

## Phase 2: Codebase Analysis

1. Extract key terms from the issue body (file names, function names, error messages)
2. Call `mcp__cgao__cgao_analyze_codebase` with:
   - `issue_number`: the issue number
   - `issue_title`: title from Step 1.1
   - `issue_body`: body text from Step 1.1
   - `search_terms`: extracted terms from above
3. Review the analysis output — note suggested starting points

`cgao_analyze_codebase` searches the LOCAL filesystem and git history.
It does NOT call GitHub's API — it only needs the issue text you provide.

## Phase 3: Effort Estimation

Based on the codebase analysis, estimate:

| Factor | Assessment |
|--------|-----------|
| Files to change | <count and list> |
| Complexity | low / medium / high |
| Test effort | low / medium / high |
| Risk of regression | low / medium / high |
| Estimated time | <range> |

## Phase 4: Go / No-Go Decision

**GO** if ALL of:
- Issue is classified as bug or feature (not question)
- Severity is medium or higher (or user explicitly wants it)
- Scope is not "large" (or can be split)
- Fix approach is clear from codebase analysis
- No external dependencies or access needed

**NO-GO** if ANY of:
- Issue requires access we don't have
- Scope is too large for a single PR
- Requires architectural decisions beyond the issue scope
- Would break existing functionality without clear migration path

## Phase 5: Report

```markdown
## Evaluation Report — Issue #<N>: <title>

### Classification
- Type: bug/feature
- Severity: critical/high/medium/low
- Scope: small/medium/large

### Codebase Impact
- Files: <list>
- Starting point: <file>

### Decision: ✅ GO / ❌ NO-GO

<reasoning>

### Next Step
If GO: `/cgao:fix <N>`
If NO-GO: <reason and alternative>
```

## Rules

1. **Never skip evaluation** — every fix must pass through this gate
2. **Always fetch via GitHub MCP first** — CGAO tools need data you provide
3. Call `mcp__cgao__cgao_workflow_state` with `action: "set", phase: "evaluated"` after completion
4. If NO-GO, explain clearly and suggest alternatives

Task: {{ARGUMENTS}}
