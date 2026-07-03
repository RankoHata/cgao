/**
 * GitHub API Helper
 *
 * Supplementary client for operations that need codebase context
 * or multi-step aggregation beyond single GH API calls.
 * Uses GITHUB_TOKEN env var or falls back to `gh auth token`.
 */
import { execSync } from 'child_process';
let _tokenCache = null;
export function resolveToken() {
    const now = Date.now();
    if (_tokenCache && (now - _tokenCache.ts) < 60_000)
        return _tokenCache.token;
    const token = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT || '';
    if (token) {
        _tokenCache = { token, ts: now };
        return token;
    }
    try {
        const t = execSync('gh auth token', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim();
        if (t) {
            _tokenCache = { token: t, ts: now };
            return t;
        }
    }
    catch { /* ignore */ }
    throw new Error('No GitHub token. Set GITHUB_TOKEN or GITHUB_PAT, or run `gh auth login`.');
}
async function ghFetch(path, opts = {}) {
    const url = path.startsWith('https://') ? path : `https://api.github.com${path}`;
    const headers = {
        Authorization: `Bearer ${resolveToken()}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'cgao-plugin',
    };
    if (opts.body)
        headers['Content-Type'] = 'application/json';
    const res = await fetch(url, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
    if (!res.ok)
        throw new Error(`GitHub API ${res.status}: ${await res.text().catch(() => '?')}`);
    return res.json();
}
export async function getIssue(owner, repo, num) {
    return ghFetch(`/repos/${owner}/${repo}/issues/${num}`);
}
export async function listIssues(owner, repo, opts = {}) {
    const p = new URLSearchParams({ state: opts.state || 'open', sort: 'updated', direction: 'desc' });
    if (opts.labels)
        p.set('labels', opts.labels);
    if (opts.per_page)
        p.set('per_page', String(opts.per_page));
    return ghFetch(`/repos/${owner}/${repo}/issues?${p}`);
}
export async function addComment(owner, repo, issueNum, body) {
    return ghFetch(`/repos/${owner}/${repo}/issues/${issueNum}/comments`, { method: 'POST', body: { body } });
}
export async function getPR(owner, repo, num) {
    return ghFetch(`/repos/${owner}/${repo}/pulls/${num}`);
}
export async function listPRs(owner, repo, opts = {}) {
    const p = new URLSearchParams({ state: opts.state || 'open', sort: 'updated', direction: 'desc' });
    if (opts.per_page)
        p.set('per_page', String(opts.per_page));
    return ghFetch(`/repos/${owner}/${repo}/pulls?${p}`);
}
export async function getPRStatus(owner, repo, ref) {
    return ghFetch(`/repos/${owner}/${repo}/commits/${ref}/status`);
}
export async function getPRChecks(owner, repo, ref) {
    return ghFetch(`/repos/${owner}/${repo}/commits/${ref}/check-runs`);
}
export async function listReviews(owner, repo, prNum) {
    return ghFetch(`/repos/${owner}/${repo}/pulls/${prNum}/reviews`);
}
// ---- Repo ----
export function resolveRepo() {
    try {
        const url = execSync('git remote get-url origin', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim();
        const m = url.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);
        if (m)
            return { owner: m[1], repo: m[2] };
    }
    catch { /* ignore */ }
    throw new Error('Could not resolve GitHub repo. Run inside a git repo with a GitHub origin.');
}
