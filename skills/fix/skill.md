---
name: fix
description: "Plan and implement a fix — create fix plan, write code, run tests, verify"
argument-hint: "<issue number>"
---

# CGAO Fix — Plan & Implement

Creates a fix plan and implements the code changes for an evaluated issue. Delegates planning to fix-planner agent and implementation to executor.

## Usage

```
/cgao:fix 42             # Fix issue #42 (requires prior evaluation)
```

## Prerequisites

Issue must already be evaluated (`/cgao:evaluate <N>` completed and returned GO).
Check with `mcp__cgao__cgao_workflow_state` `action: "get"`.

## Tools Used

| Tool | Purpose |
|------|---------|
| `mcp__cgao__cgao_plan_fix` | Generate structured fix plan |
| `mcp__cgao__cgao_assess_pr_quality` | Pre-PR quality checks |
| `mcp__cgao__cgao_workflow_state` | Track progress |

## Agents

| Agent | Role |
|-------|------|
| **fix-planner** (Opus) | Create structured implementation plan |
| **executor** (Sonnet/Opus) | Implement the code changes |

---

## Phase 1: Load Context

1. Call `mcp__cgao__cgao_workflow_state` `action: "get"` to verify prior phases completed
2. Read triage and analysis results from `.cgao/triage-<N>.json` and `.cgao/analysis-<N>.json`
3. Read the issue body for acceptance criteria

## Phase 2: Create Fix Plan

Delegate to **fix-planner agent**:

```
Create a fix plan for issue #<N>: <title>

Context:
- Issue: <summary>
- Triage: <classification, severity, scope>
- Codebase analysis: <affected files, starting points>
- Fix approach: <from evaluation>

Produce a structured plan with:
1. Pre-conditions
2. Ordered implementation steps (with file paths)
3. Testing strategy per step
4. Post-conditions / verification checklist
5. Risk assessment
```

Save the plan: call `mcp__cgao__cgao_plan_fix` with the approach and affected files.

## Phase 3: Implementation

1. Create feature branch:
   ```bash
   git checkout -b fix/issue-<N>-<short-desc>
   ```

2. Delegate to **executor agent** with the fix plan
3. After each step, verify:
   - Code compiles
   - Related tests pass
   - No unrelated changes

## Phase 4: Quality Check

Before considering the fix complete, call `mcp__cgao__cgao_assess_pr_quality` with the branch name.

Address any FAIL or WARN findings:
- **FAIL**: Must fix before proceeding
- **WARN**: Should fix unless justified

## Phase 5: Commit

```bash
git add -A
git commit -m "fix: <description> (fixes #<N>)

<brief explanation of the change>

Tested: <how>
Refs: #<N>"
git push origin fix/issue-<N>-<short-desc>
```

Call `mcp__cgao__cgao_workflow_state` with `action: "set", phase: "implemented"`.

## Phase 6: Report

```markdown
## Fix Complete — Issue #<N>

### Changes Made
- <file>: <what changed>
- ...

### Quality Check
- Tests: <passed/failed>
- Lint: <ok/issues>
- Diff size: <N files>

### Next Step
Create PR: `/cgao:pr-create <N>`
```

## Rules

1. **Never start without evaluation** — check workflow state first
2. **Plan before coding** — always use fix-planner agent
3. **Quality check before push** — always run `cgao_assess_pr_quality`
4. **Test every change** — no PR with failing tests

Task: {{ARGUMENTS}}
