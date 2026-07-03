---
name: monitor
description: "Monitor PR until merge — track CI, reviews, blockers. Poll status and alert on changes."
argument-hint: "<PR number>"
---

# CGAO Monitor — PR Merge Monitoring

Monitors a pull request from submission to merge. Tracks CI checks, review status, merge blockers, and provides status dashboards. For continuous monitoring, use with OMC's `/loop` command.

## Usage

```
/cgao:monitor 42           # One-time status check for PR #42
/cgao:monitor 42 --watch   # Interactive monitoring (re-check periodically)
```

Combine with OMC for polling:
```
/loop 5m /cgao:monitor 42
```

## Tools Used

| Tool | Purpose |
|------|---------|
| `mcp__github__get_pull_request` | Fetch PR metadata & mergeable status |
| `mcp__cgao__cgao_check_merge_readiness` | **Comprehensive merge blocker analysis** |
| `mcp__cgao__cgao_workflow_state` | Track monitoring status |

---

## Phase 1: Full Status Scan

Call `mcp__cgao__cgao_check_merge_readiness` with the PR number.

This comprehensive tool checks:
- CI status (all check runs)
- Review status (approvals, change requests)
- Merge conflicts
- Branch protection rules
- PR state (open/closed/draft/merged)

## Phase 2: Analyze Blockers

If the PR is **blocked**:

| Blocker | Action |
|---------|--------|
| CI failing | Analyze failure logs. If related to PR changes → fix and push. If flaky/infra → note. |
| Changes requested | Read the review comments. Plan fixes. Offer to help. |
| Required reviews missing | Wait. Note how many more approvals needed. |
| Merge conflicts | Offer to rebase: `git pull --rebase origin main` |
| Draft PR | Remind to mark ready when done |

If the PR is **ready**:
- All CI passing ✅
- Required reviews approved ✅
- No conflicts ✅
- Not a draft ✅

## Phase 3: Status Dashboard

```markdown
╔══════════════════════════════════════════════════╗
║  PR #<N> — <title>                               ║
╠══════════════════════════════════════════════════╣
║  URL:     <html_url>                             ║
║  Author:  <user>                                 ║
║  Branch:  <head> → <base>                        ║
║  Created: <date>                                 ║
╠══════════════════════════════════════════════════╣
║  CI:      ✅ / ❌ / ⏳                            ║
║  Reviews: ✅ <N> approved                        ║
║           🔄 <N> changes requested               ║
║           💬 <N> commented                       ║
║  Merge:   ✅ Ready / ❌ Conflicts / ⏳ Pending    ║
╠══════════════════════════════════════════════════╣
║  Status:  <status message>                       ║
║  Action:  <recommended action>                   ║
╚══════════════════════════════════════════════════╝
```

## Phase 4: Report & Recommend

Based on status:

**READY TO MERGE**:
```
✅ PR #<N> is ready to merge!
- All CI checks passing
- <N> approvals received
- No merge conflicts

A committer can now merge this PR.
```

**WAITING**:
```
⏳ PR #<N> is waiting for:
- [ ] CI to complete (currently running)
- [ ] <N> more review approval(s)

Estimated: check back in <timeframe>.
Recommended: /cgao:monitor <N> to re-check.
```

**BLOCKED**:
```
❌ PR #<N> is blocked:
1. <blocker 1> — <suggested fix>
2. <blocker 2> — <suggested fix>

Action needed before merge.
```

## Phase 5: Update Tracking

Call `mcp__cgao__cgao_workflow_state` with `action: "set"`:
- If merged: `phase: "merged"`
- If waiting: `phase: "monitoring"`
- If blocked: `phase: "monitoring"` (with blocker details)

## Continuous Monitoring

For ongoing monitoring, tell the user:

```
To continuously monitor this PR, use OMC's loop:

/loop 10m /cgao:monitor <N>

This will check every 10 minutes and report if status changes.
```

## Rules

1. **Always use `cgao_check_merge_readiness`** — it does the comprehensive analysis
2. **Be specific about blockers** — don't just say "blocked", say what's blocking and how to fix
3. **Update workflow state** — keeps tracking across sessions
4. **When merged** — celebrate! The pipeline is complete.

Task: {{ARGUMENTS}}
