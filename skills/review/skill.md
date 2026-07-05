---
name: review
description: "Automated PR code review — multi-dimensional analysis, severity-rated findings, submit review decision"
argument-hint: "<PR number>"
---

# CGAO Review — Automated PR Code Review

Performs automated multi-dimensional code review of a pull request. Uses pr-reviewer agent for deep analysis, and submits a structured review with APPROVE / REQUEST_CHANGES / COMMENT decision.

## Usage

```
/cgao:review 42           # Review PR #42
/cgao:review 42 --deep    # Deep review with architect-level analysis
```

## Tools Used

| Tool | Purpose |
|------|---------|
| `mcp__github__pull_request_read` | Fetch PR details, diff, and files |
| `mcp__cgao__cgao_assess_pr_quality` | Automated quality checks (local git only) |
| `mcp__github__pull_request_review_write` | Submit review on GitHub |
| `mcp__cgao__cgao_workflow_state` | Track review status |

## Agents

| Agent | Role |
|-------|------|
| **pr-reviewer** (Opus) | Deep code analysis and finding generation |

---

## Phase 1: Fetch PR

1. Call `mcp__github__pull_request_read` with `method: "get"` and the PR number
2. Call `mcp__github__pull_request_read` with `method: "get_files"` to see changed files
3. Call `mcp__github__pull_request_read` with `method: "get_diff"` to get the full diff
4. Verify PR is open — if merged or closed, report and stop
5. Note: title, author, base/head branches, file count

## Phase 2: Automated Checks

Call `mcp__cgao__cgao_assess_pr_quality` with `pr_number: <N>`.
This tool uses only LOCAL git operations.

If the PR branch is available locally, also run:
```bash
git fetch origin pull/<N>/head:pr-<N>
```

## Phase 3: Deep Code Review

Delegate to **pr-reviewer agent** (Opus). Provide:
- PR title and description
- The diff (from Phase 1 `get_diff`)
- Changed files list (from Phase 1 `get_files`)
- Quality check results from Phase 2

The pr-reviewer agent analyzes across 7 dimensions:

| Dimension | Key Questions |
|-----------|--------------|
| **Correctness** | Does the code fix the issue? Edge cases handled? Error states covered? |
| **Security** | Injection risks? Auth bypass? Secrets exposed? Unsafe input handling? |
| **Performance** | N+1 queries? Unnecessary allocations? Blocking operations in hot paths? |
| **Maintainability** | Clear naming? Reasonable function size? Avoids anti-patterns? |
| **Testing** | Tests cover the change? Edge cases tested? Regression protection adequate? |
| **Regression** | Could this break existing callers? Are there implicit dependencies? |
| **Consistency** | Follows project conventions? Consistent with surrounding code? |

## Phase 4: Build Review

Structure the review output:

```markdown
## 🔍 Automated Review — PR #<N>

### Summary
<Overall assessment. 2-3 sentences covering quality, risks, verdict.>

### Findings

🔴 **CRITICAL: <title>**
- **File**: `<path>:<line>`
- **Issue**: <what's wrong and why it matters>
- **Fix**: <concrete suggestion>

🟠 **HIGH: <title>**
- ...

🟡 **MEDIUM: <title>**
- ...

🟢 **LOW: <title>**
- ...

### Automated Checks
- Branch: ✅
- Diff size: ✅ (12 files)
- Tests: ✅ (3 test files)
- Commits: ✅
- Unrelated files: ✅

### Verdict
**<APPROVE / REQUEST_CHANGES / COMMENT>**

<1-2 sentence reasoning>
```

## Phase 5: Submit Review

Call `mcp__github__pull_request_review_write`:
```json
{
  "method": "create",
  "pullNumber": <N>,
  "body": "<the review from Phase 4>",
  "event": "<APPROVE | REQUEST_CHANGES | COMMENT>"
}
```

**Decision matrix:**
- **APPROVE**: No CRITICAL or HIGH findings, quality checks pass
- **REQUEST_CHANGES**: Any CRITICAL finding, or 3+ HIGH findings
- **COMMENT**: Only MEDIUM/LOW findings, informational

## Phase 6: Report

```markdown
## Review Complete — PR #<N>

**Verdict**: ✅ APPROVED / 🔄 CHANGES REQUESTED / 💬 COMMENTED

**Findings**:
- 🔴 Critical: <N>
- 🟠 High: <N>
- 🟡 Medium: <N>
- 🟢 Low: <N>

**Next**: <If APPROVED: monitor for merge. If CHANGES_REQUESTED: fix issues then re-review.>
```

Call `mcp__cgao__cgao_workflow_state` with `action: "set", phase: "reviewed"`.

## Rules

1. **Be constructive** — every finding must include a suggested fix
2. **Don't block on style** unless it affects readability or maintainability
3. **Context matters** — acknowledge pragmatic choices
4. **Test adequacy is critical** — flag PRs without tests
5. **Never approve with CRITICAL or HIGH findings unresolved**

Task: {{ARGUMENTS}}
