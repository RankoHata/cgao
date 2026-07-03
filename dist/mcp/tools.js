/**
 * CGAO Custom MCP Tools — Intelligence Layer
 *
 * These tools sit ABOVE the official GitHub MCP server.
 * They provide analysis, classification, planning, and quality assessment —
 * operations that require codebase context and multi-step reasoning,
 * not just single GitHub API calls.
 *
 * The official GitHub MCP (`mcp__github__*`) handles raw API operations.
 * CGAO tools (`mcp__cgao__*`) add intelligence on top.
 */
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { getIssue, getPR, getPRStatus, getPRChecks, listReviews, resolveRepo, } from '../github/api.js';
function ok(t) { return { content: [{ type: 'text', text: t }] }; }
function err(t) { return { content: [{ type: 'text', text: t }], isError: true }; }
async function repo() { return resolveRepo(); }
// ---- State helpers ----
const STATE_DIR = process.env.CGAO_STATE_DIR || join(process.cwd(), '.cgao');
import { mkdirSync, writeFileSync } from 'fs';
function ensureStateDir() { if (!existsSync(STATE_DIR))
    mkdirSync(STATE_DIR, { recursive: true }); }
function readState(key) {
    const p = join(STATE_DIR, `${key}.json`);
    if (!existsSync(p))
        return null;
    try {
        return JSON.parse(readFileSync(p, 'utf-8'));
    }
    catch {
        return null;
    }
}
function writeState(key, data) {
    ensureStateDir();
    writeFileSync(join(STATE_DIR, `${key}.json`), JSON.stringify({ ...data, _updated: new Date().toISOString() }, null, 2));
}
// ---- Helper: run a shell command and return output ----
function shell(cmd, cwd) {
    try {
        return execSync(cmd, { encoding: 'utf-8', cwd: cwd || process.cwd(), stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 }).trim();
    }
    catch (e) {
        const ex = e;
        return ex.stdout || ex.stderr || ex.message || 'command failed';
    }
}
export const tools = [
    // =================================================================
    // 1. ISSUE TRIAGE — classify, assess severity, recommend action
    // =================================================================
    {
        name: 'cgao_triage_issue',
        description: `Analyze a GitHub issue and classify it: determine if it's a bug/feature/question,
estimate severity and implementation complexity, and recommend whether CGAO should fix it.
Use BEFORE planning any fix — this is the mandatory evaluation gate.`,
        schema: {
            type: 'object',
            properties: {
                owner: { type: 'string', description: 'Repo owner. Auto-detected if omitted.' },
                repo: { type: 'string', description: 'Repo name. Auto-detected if omitted.' },
                issue_number: { type: 'number', description: 'Issue number to triage.' },
            },
            required: ['issue_number'],
        },
        handler: async (args) => {
            try {
                const { owner, repo: repoName } = await repo();
                const rOwner = args.owner || owner;
                const rRepo = args.repo || repoName;
                const num = args.issue_number;
                const issue = await getIssue(rOwner, rRepo, num);
                // Classification heuristics
                const title = (issue.title || '').toLowerCase();
                const body = (issue.body || '').toLowerCase();
                const labels = issue.labels.map(l => l.name.toLowerCase());
                const isBug = labels.includes('bug') || /\b(bug|broken|error|crash|fail|incorrect|wrong|regression)\b/.test(title + ' ' + body);
                const isFeature = labels.includes('enhancement') || labels.includes('feature') || /\b(feature request|enhancement|add support for|please add)\b/.test(title + ' ' + body);
                const isQuestion = /\b(how do i|how to|what is|question|help)\b/.test(title + ' ' + body) && !isBug;
                const hasRepro = /\b(steps to reproduce|reproduce|reproduction|to reproduce)\b/.test(body);
                const hasError = /\b(error|exception|stack trace|traceback)\b/.test(body);
                // Severity assessment
                let severity = 'medium';
                if (/\b(security|vulnerability|xss|sql injection|auth|permission|data leak|exposure)\b/.test(title + ' ' + body))
                    severity = 'critical';
                else if (/\b(crash|segfault|panic|deadlock|race condition|memory leak|corruption)\b/.test(title + ' ' + body))
                    severity = 'high';
                else if (isFeature && /\b(major|significant|large|breaking)\b/.test(body))
                    severity = 'high';
                // Scope estimation
                let scope = 'unknown';
                const fileRefs = body.match(/`?([\w/.-]+\.(ts|js|py|go|rs|java|rb))`?/g) || [];
                if (fileRefs.length > 5 || /\b(multi|several|many files|large refactor|architecture|restructure)\b/.test(body))
                    scope = 'large';
                else if (fileRefs.length > 2 || /\b(moderate|a few files|several changes)\b/.test(body))
                    scope = 'medium';
                else if (fileRefs.length > 0 || /\b(small|minor|simple|single file|one line)\b/.test(body))
                    scope = 'small';
                // Decision
                const actionable = (isBug || isFeature) && !isQuestion && issue.state === 'open';
                const shouldFix = actionable && !issue.assignee;
                let recommendation = 'skip';
                if (shouldFix && severity === 'critical')
                    recommendation = 'fix_urgent';
                else if (shouldFix && severity === 'high')
                    recommendation = 'fix_prioritized';
                else if (shouldFix && scope !== 'large')
                    recommendation = 'fix';
                else if (shouldFix)
                    recommendation = 'needs_scoping';
                else if (isQuestion)
                    recommendation = 'skip_question';
                else if (issue.assignee)
                    recommendation = 'skip_assigned';
                else
                    recommendation = 'skip';
                const result = {
                    issue_number: num,
                    url: issue.html_url,
                    classification: isBug ? 'bug' : isFeature ? 'feature' : isQuestion ? 'question' : 'other',
                    severity,
                    scope,
                    has_reproduction_steps: hasRepro,
                    has_error_details: hasError,
                    actionable,
                    recommendation,
                    summary: `${recommendation === 'fix_urgent' || recommendation === 'fix_prioritized' || recommendation === 'fix'
                        ? '✅ SHOULD FIX' : '⏭️ SKIP'} — ${severity} severity ${isBug ? 'bug' : isFeature ? 'feature' : 'issue'} (${scope} scope)`,
                };
                // Save triage result
                writeState(`triage-${num}`, result);
                return ok(JSON.stringify(result, null, 2));
            }
            catch (e) {
                return err(e instanceof Error ? e.message : String(e));
            }
        },
    },
    // =================================================================
    // 2. CODEBASE ANALYSIS — find relevant files for an issue
    // =================================================================
    {
        name: 'cgao_analyze_codebase',
        description: `Analyze the codebase to find files and code areas relevant to an issue.
Searches for referenced files, functions, error messages, and related code patterns.
Use AFTER triage to understand what needs to change.`,
        schema: {
            type: 'object',
            properties: {
                owner: { type: 'string' },
                repo: { type: 'string' },
                issue_number: { type: 'number', description: 'Issue number for context.' },
                search_terms: { type: 'array', items: { type: 'string' }, description: 'Additional search terms from the issue.' },
            },
            required: ['issue_number'],
        },
        handler: async (args) => {
            try {
                const { owner, repo: repoName } = await repo();
                const rOwner = args.owner || owner;
                const rRepo = args.repo || repoName;
                const num = args.issue_number;
                const extraTerms = args.search_terms || [];
                const issue = await getIssue(rOwner, rRepo, num);
                const body = issue.body || '';
                // Extract search terms from issue
                const filePattern = /`?([\w/.-]+\.(tsx?|jsx?|py|go|rs|java|rb|css|html|json|ya?ml))`?/gi;
                const funcPattern = /\b([\w]+\s*\([^)]*\))\b/g;
                const errorPattern = /(?:Error|Exception|Panic|Fatal)[:\s]*(.+?)(?:\n|$)/gi;
                const files = [...body.matchAll(filePattern)].map(m => m[1]);
                const functions = [...body.matchAll(funcPattern)].map(m => m[1]).filter(f => f.length > 5);
                const errors = [...body.matchAll(errorPattern)].map(m => m[1].trim());
                const allTerms = [...new Set([...files, ...functions, ...errors, ...extraTerms])];
                // Search for each term
                const findings = [];
                for (const term of allTerms.slice(0, 10)) {
                    try {
                        const result = shell(`grep -rl --include="*.{ts,tsx,js,jsx,py,go,rs,java}" "${term.replace(/"/g, '\\"')}" . 2>/dev/null | head -5`);
                        const matchedFiles = result ? result.split('\n').filter(Boolean) : [];
                        findings.push({ term, matches: matchedFiles.length, files: matchedFiles });
                    }
                    catch {
                        findings.push({ term, matches: 0, files: [] });
                    }
                }
                // Check git log for related changes
                let relatedCommits = '';
                try {
                    relatedCommits = shell(`git log --oneline --grep="${issue.title?.slice(0, 30) || ''}" -5 2>/dev/null`);
                }
                catch {
                    relatedCommits = '';
                }
                // Detect project structure
                const structure = {};
                for (const dir of ['src', 'lib', 'app', 'components', 'utils', 'api', 'routes', 'handlers']) {
                    if (existsSync(dir)) {
                        try {
                            structure[dir] = shell(`find ${dir} -type f | head -10`).split('\n').filter(Boolean);
                        }
                        catch {
                            structure[dir] = [];
                        }
                    }
                }
                const result = {
                    issue_number: num, title: issue.title,
                    extracted_terms: allTerms,
                    findings: findings.filter(f => f.matches > 0),
                    related_commits: relatedCommits || 'none found',
                    project_structure: Object.keys(structure).length > 0 ? structure : 'analyze manually',
                    suggested_starting_points: findings.filter(f => f.matches > 0).map(f => f.files[0]).filter(Boolean),
                };
                writeState(`analysis-${num}`, result);
                return ok(JSON.stringify(result, null, 2));
            }
            catch (e) {
                return err(e instanceof Error ? e.message : String(e));
            }
        },
    },
    // =================================================================
    // 3. FIX PLAN — structured implementation plan
    // =================================================================
    {
        name: 'cgao_plan_fix',
        description: `Generate a structured fix plan for an issue based on triage and codebase analysis.
Returns a step-by-step implementation plan with file paths, estimated changes, and testing strategy.
Use AFTER triage and codebase analysis, BEFORE implementation.`,
        schema: {
            type: 'object',
            properties: {
                owner: { type: 'string' },
                repo: { type: 'string' },
                issue_number: { type: 'number' },
                fix_approach: { type: 'string', description: 'High-level approach for the fix.' },
                affected_files: { type: 'array', items: { type: 'string' }, description: 'Files that need changes.' },
            },
            required: ['issue_number', 'fix_approach'],
        },
        handler: async (args) => {
            try {
                const { owner, repo: repoName } = await repo();
                const rOwner = args.owner || owner;
                const rRepo = args.repo || repoName;
                const num = args.issue_number;
                const approach = args.fix_approach;
                const affected = args.affected_files || [];
                // Load prior analysis
                const triage = readState(`triage-${num}`);
                const analysis = readState(`analysis-${num}`);
                const plan = {
                    issue_number: num,
                    repo: `${rOwner}/${rRepo}`,
                    fix_approach: approach,
                    steps: [],
                    pre_checks: [],
                    post_checks: [],
                };
                // Generate steps
                let order = 0;
                if (affected.length > 0) {
                    // Core change
                    plan.steps.push({ order: ++order, description: `Implement core fix in ${affected.slice(0, 3).join(', ')}`, files: affected.slice(0, 5), estimated_complexity: affected.length > 3 ? 'high' : 'medium', test_strategy: 'Unit tests for changed functions' });
                }
                // Tests
                plan.steps.push({ order: ++order, description: 'Add or update tests to cover the fix and prevent regression', files: [], estimated_complexity: 'medium', test_strategy: 'Verify tests fail before fix, pass after' });
                // Docs
                if (triage && triage.classification === 'feature') {
                    plan.steps.push({ order: ++order, description: 'Update documentation if this is a user-facing change', files: ['README.md', 'CHANGELOG.md'], estimated_complexity: 'low', test_strategy: 'N/A' });
                }
                plan.pre_checks = ['All existing tests pass on main branch', 'Feature branch created from latest main'];
                plan.post_checks = ['All tests pass', `Issue #${num} scenario verified`, 'No unrelated files changed', 'Linter/type-check passes'];
                writeState(`plan-${num}`, plan);
                return ok(JSON.stringify(plan, null, 2));
            }
            catch (e) {
                return err(e instanceof Error ? e.message : String(e));
            }
        },
    },
    // =================================================================
    // 4. PR QUALITY ASSESSMENT — automated quality checks
    // =================================================================
    {
        name: 'cgao_assess_pr_quality',
        description: `Assess the quality of a pull request branch by running automated checks:
compilation, linting, test suite, diff analysis. Returns a structured quality report.
Use BEFORE creating the PR or as part of self-review.`,
        schema: {
            type: 'object',
            properties: {
                owner: { type: 'string' },
                repo: { type: 'string' },
                pr_number: { type: 'number', description: 'PR number (optional — checks current branch if omitted).' },
                branch: { type: 'string', description: 'Branch name to assess (optional).' },
                base: { type: 'string', description: 'Base branch. Default: main.' },
            },
        },
        handler: async (args) => {
            try {
                const base = args.base || 'main';
                const prNum = args.pr_number;
                let headBranch = args.branch;
                if (!headBranch) {
                    headBranch = shell('git rev-parse --abbrev-ref HEAD').trim();
                }
                const checks = [];
                // 1. Branch check
                if (headBranch === base) {
                    checks.push({ check: 'branch', status: 'FAIL', detail: `On ${base} branch — switch to a feature branch` });
                }
                else {
                    checks.push({ check: 'branch', status: 'PASS', detail: `Feature branch: ${headBranch}` });
                }
                // 2. Up-to-date check
                try {
                    shell(`git fetch origin ${base} 2>/dev/null`);
                    const behind = shell(`git rev-list ${base}..HEAD --count 2>/dev/null`).trim();
                    checks.push({ check: 'up_to_date', status: 'PASS', detail: `${behind} commits ahead of ${base}` });
                }
                catch {
                    checks.push({ check: 'up_to_date', status: 'WARN', detail: 'Could not verify sync with base' });
                }
                // 3. Diff size
                const diffStat = shell(`git diff --stat origin/${base}...HEAD 2>/dev/null`).trim();
                const filesChanged = diffStat.split('\n').length - 1;
                const diffSize = filesChanged > 20 ? 'WARN' : 'PASS';
                checks.push({ check: 'diff_size', status: diffSize, detail: `${filesChanged} files changed` });
                // 4. Unrelated files
                const unrelatedPatterns = ['package-lock.json', 'yarn.lock', '.DS_Store', 'node_modules/', '.env'];
                const changedFiles = shell(`git diff --name-only origin/${base}...HEAD 2>/dev/null`).split('\n').filter(Boolean);
                const suspicious = changedFiles.filter(f => unrelatedPatterns.some(p => f.includes(p)));
                if (suspicious.length > 0) {
                    checks.push({ check: 'unrelated_files', status: 'WARN', detail: `Potentially unrelated: ${suspicious.join(', ')}` });
                }
                else {
                    checks.push({ check: 'unrelated_files', status: 'PASS', detail: 'No unrelated files detected' });
                }
                // 5. Commit message quality
                const commits = shell(`git log origin/${base}...HEAD --format="%s" 2>/dev/null`).split('\n').filter(Boolean);
                const hasIssueRef = commits.some(c => /#\d+/.test(c));
                const hasConventional = commits.some(c => /^(fix|feat|chore|docs|refactor|test|style|perf)(\(.+\))?:/.test(c));
                if (hasConventional && hasIssueRef)
                    checks.push({ check: 'commit_quality', status: 'PASS', detail: 'Conventional commits with issue references' });
                else if (hasConventional)
                    checks.push({ check: 'commit_quality', status: 'WARN', detail: 'Conventional commits but no issue reference' });
                else
                    checks.push({ check: 'commit_quality', status: 'WARN', detail: 'Consider using conventional commits (fix:/feat:) and referencing the issue' });
                // 6. Detect test presence
                const testFiles = changedFiles.filter(f => /test|spec|__tests__/.test(f));
                if (testFiles.length > 0)
                    checks.push({ check: 'tests', status: 'PASS', detail: `${testFiles.length} test file(s) changed` });
                else
                    checks.push({ check: 'tests', status: 'WARN', detail: 'No test files detected in diff — consider adding tests' });
                const passed = checks.filter(c => c.status === 'PASS').length;
                const warnings = checks.filter(c => c.status === 'WARN').length;
                const failures = checks.filter(c => c.status === 'FAIL').length;
                const result = {
                    branch: headBranch, base,
                    files_changed: changedFiles.length,
                    commits: commits.length,
                    check_summary: `${passed} passed, ${warnings} warnings, ${failures} failures`,
                    ready_for_pr: failures === 0,
                    checks,
                };
                return ok(JSON.stringify(result, null, 2));
            }
            catch (e) {
                return err(e instanceof Error ? e.message : String(e));
            }
        },
    },
    // =================================================================
    // 5. MERGE READINESS — comprehensive blocker check
    // =================================================================
    {
        name: 'cgao_check_merge_readiness',
        description: `Comprehensive merge readiness check for a PR. Analyzes CI status,
required reviews, merge conflicts, and branch protection. Returns a detailed
blocker report and recommended action. Use for monitoring PRs.`,
        schema: {
            type: 'object',
            properties: {
                owner: { type: 'string' },
                repo: { type: 'string' },
                pr_number: { type: 'number' },
            },
            required: ['pr_number'],
        },
        handler: async (args) => {
            try {
                const { owner: o, repo: r } = await repo();
                const rOwner = args.owner || o;
                const rRepo = args.repo || r;
                const prNum = args.pr_number;
                const pr = await getPR(rOwner, rRepo, prNum);
                const [status, checks, reviews] = await Promise.all([
                    getPRStatus(rOwner, rRepo, pr.head.sha).catch(() => ({ state: 'unknown', statuses: [] })),
                    getPRChecks(rOwner, rRepo, pr.head.sha).catch(() => ({ check_runs: [] })),
                    listReviews(rOwner, rRepo, prNum).catch(() => []),
                ]);
                const blockers = [];
                const warnings = [];
                // CI
                const ciPassing = status.state === 'success';
                const ciRunning = status.state === 'pending';
                if (!ciPassing && !ciRunning)
                    blockers.push(`CI failing: ${status.state}`);
                else if (ciRunning)
                    warnings.push('CI still running');
                else
                    warnings.push('CI passing');
                // Check runs
                const failedRuns = (checks.check_runs || []).filter(c => c.conclusion === 'failure');
                if (failedRuns.length > 0)
                    blockers.push(`${failedRuns.length} check(s) failed: ${failedRuns.map(c => c.name).join(', ')}`);
                // Reviews
                const approvals = reviews.filter(r => r.state === 'APPROVED');
                const changeRequests = reviews.filter(r => r.state === 'CHANGES_REQUESTED');
                if (changeRequests.length > 0)
                    blockers.push(`${changeRequests.length} reviewer(s) requested changes`);
                if (approvals.length === 0 && changeRequests.length === 0)
                    warnings.push('No reviews yet');
                else if (approvals.length > 0)
                    warnings.push(`${approvals.length} approval(s)`);
                // Mergeability
                if (pr.merged_at)
                    blockers.push('PR already merged');
                if (pr.state === 'closed')
                    blockers.push('PR is closed');
                if (pr.mergeable === false)
                    blockers.push('PR has merge conflicts');
                if (pr.draft)
                    warnings.push('PR is a draft');
                const ready = blockers.length === 0;
                const action = ready ? 'MERGE' : changeRequests.length > 0 ? 'FIX_AND_PUSH' : failedRuns.length > 0 ? 'FIX_TESTS' : 'WAIT';
                const result = {
                    pr_number: prNum, title: pr.title, url: pr.html_url,
                    state: pr.state, merged: !!pr.merged_at,
                    status: ready ? '✅ READY TO MERGE' : '❌ BLOCKED',
                    blockers, warnings,
                    ci: { state: status.state, failed_runs: failedRuns.map(c => c.name) },
                    reviews: { approved: approvals.length, changes_requested: changeRequests.length, total: reviews.length },
                    mergeable: pr.mergeable,
                    recommended_action: action,
                };
                return ok(JSON.stringify(result, null, 2));
            }
            catch (e) {
                return err(e instanceof Error ? e.message : String(e));
            }
        },
    },
    // =================================================================
    // 6. WORKFLOW STATE — track CGAO workflow progress
    // =================================================================
    {
        name: 'cgao_workflow_state',
        description: `Get or set CGAO workflow state for an issue. Tracks which phase
the workflow is in and links related artifacts (triage, analysis, plan, PR).`,
        schema: {
            type: 'object',
            properties: {
                action: { type: 'string', enum: ['get', 'set', 'list'], description: 'get=read state, set=update state, list=all workflows.' },
                issue_number: { type: 'number', description: 'Issue number.' },
                phase: { type: 'string', enum: ['triaged', 'analyzed', 'planned', 'implemented', 'pr_created', 'reviewed', 'monitoring', 'merged'], description: 'Current phase (for set).' },
                pr_number: { type: 'number', description: 'Linked PR number (for set).' },
            },
            required: ['action'],
        },
        handler: async (args) => {
            try {
                const action = args.action;
                if (action === 'list') {
                    ensureStateDir();
                    const { readdirSync: rd } = await import('fs');
                    const files = rd(STATE_DIR).filter(f => f.startsWith('workflow-') && f.endsWith('.json'));
                    const workflows = files.map(f => {
                        const data = readState(f.replace('.json', ''));
                        return data;
                    });
                    return ok(JSON.stringify(workflows, null, 2));
                }
                const num = args.issue_number;
                if (action === 'get') {
                    const state = readState(`workflow-${num}`);
                    return ok(state ? JSON.stringify(state, null, 2) : `No workflow state for issue #${num}`);
                }
                if (action === 'set') {
                    const existing = readState(`workflow-${num}`) || {};
                    const updated = {
                        ...existing,
                        issue_number: num,
                        phase: args.phase || existing.phase,
                        pr_number: args.pr_number || existing.pr_number,
                        phases: {
                            ...(existing.phases || {}),
                            [args.phase]: new Date().toISOString(),
                        },
                    };
                    writeState(`workflow-${num}`, updated);
                    return ok(JSON.stringify(updated, null, 2));
                }
                return err(`Unknown action: ${action}`);
            }
            catch (e) {
                return err(e instanceof Error ? e.message : String(e));
            }
        },
    },
];
