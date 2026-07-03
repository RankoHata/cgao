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

## Tools Used

| Tool | Purpose |
|------|---------|
| `mcp__github__get_issue` | Fetch full issue details |
| `mcp__cgao__cgao_triage_issue` | Classify and severity assessment |
| `mcp__cgao__cgao_analyze_codebase` | Find relevant files and code areas |
| `mcp__cgao__cgao_workflow_state` | Update workflow tracking |

## Agent

Use the **issue-triage** agent for classification logic.

---

## Phase 1: Fetch & Triage

1. Call `mcp__github__get_issue` to get the full issue body and metadata
2. Call `mcp__cgao__cgao_triage_issue` to classify
3. Read the triage result carefully

## Phase 2: Codebase Analysis

1. Extract key terms from the issue (file names, function names, error messages)
2. Call `mcp__cgao__cgao_analyze_codebase` with:
   - `issue_number`: the issue
   - `search_terms`: extracted terms from Phase 1
3. Review the analysis output — note suggested starting points

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
2. Call `mcp__cgao__cgao_workflow_state` with `action: "set", phase: "evaluated"` after completion
3. If NO-GO, explain clearly and suggest alternatives

Task: {{ARGUMENTS}}
