---
name: pr-create
description: "Create a structured pull request — generate description, verify quality, open PR, request reviewers"
argument-hint: "<issue number>"
---

# CGAO PR Create — Pull Request Creation

Creates a well-structured pull request from the implemented fix. Generates proper PR description, verifies quality, and opens the PR with appropriate metadata.

## Usage

```
/cgao:pr-create 42       # Create PR for issue #42 fix
/cgao:pr-create 42 --draft  # Create as draft PR
```

## Prerequisites

Fix must be implemented, committed, and pushed to a feature branch.
Check with `mcp__cgao__cgao_workflow_state` `action: "get"`.

## Tools Used

| Tool | Purpose |
|------|---------|
| `mcp__cgao__cgao_assess_pr_quality` | Final quality gate (local git only) |
| `mcp__github__create_pull_request` | Create the PR on GitHub |
| `mcp__cgao__cgao_workflow_state` | Track progress |

---

## Phase 1: Final Quality Gate

Call `mcp__cgao__cgao_assess_pr_quality` with the current branch.
This tool uses only LOCAL git operations — no GitHub API calls needed.

**Quality gate criteria:**
- `branch`: Must be PASS (not on main)
- `diff_size`: Files changed < 50 (or justified)
- `unrelated_files`: Must be PASS
- `commit_quality`: Must have issue reference
- `tests`: Should be PASS (or justified why not)

If any FAIL: fix before proceeding.
If WARN: assess whether justified.

## Phase 2: Generate PR Description

Build the PR body using this structure:

```markdown
## Summary
<1-3 sentences describing what this PR does and why>

## Problem
<What problem does this solve? Reference the issue.>

Closes #<ISSUE_NUMBER>

## Solution
<How does this PR solve the problem? Technical approach.>

## Changes
| File | Change |
|------|--------|
| `src/auth.ts` | Add token refresh logic |
| `tests/auth.test.ts` | Add refresh token tests |

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual verification: <steps>

## Screenshots
<if applicable>

## Checklist
- [ ] Code follows project conventions
- [ ] Tests added/updated
- [ ] No unrelated changes
- [ ] Issue referenced in commits

---
🤖 Generated with [CGAO](https://github.com/RankoHata/cgao) — Issue #<N>
```

## Phase 3: Create PR

Call `mcp__github__create_pull_request`:
```json
{
  "title": "fix: <descriptive title>",
  "body": "<the PR description from Phase 2>",
  "head": "fix/issue-<N>-<short-desc>",
  "base": "main",
  "draft": <true if --draft>
}
```

On success, note the PR number and URL.

## Phase 4: Add Metadata

1. Add relevant labels via `mcp__github__issue_write`:
   - Type: `bug` or `enhancement` or `fix`
   - If tests changed: `tests`
   - If docs changed: `documentation`

2. If the original issue should auto-close, verify the PR body has `Closes #<N>` or `Fixes #<N>`

## Phase 5: Report

```markdown
## PR Created — #<PR_NUMBER>

**URL**: <html_url>
**Branch**: fix/issue-<N>-<short-desc> → main
**Title**: fix: <title>
**Status**: <open/draft>

### Next Steps
1. Review: `/cgao:review <PR_NUMBER>`
2. Monitor: `/cgao:monitor <PR_NUMBER>`
```

Call `mcp__cgao__cgao_workflow_state` with `action: "set", phase: "pr_created", pr_number: <PR_NUMBER>`.

## Rules

1. **Never skip quality gate** — `cgao_assess_pr_quality` must pass before PR creation
2. **PR description must reference the issue** — always include `Closes #<N>` or `Fixes #<N>`
3. **One PR per issue** — don't bundle unrelated changes

Task: {{ARGUMENTS}}
