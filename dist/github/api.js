/**
 * GitHub API Helper — LOCAL OPERATIONS ONLY
 *
 * CGAO does NOT make direct HTTP calls to the GitHub API.
 * All GitHub data is fetched by the official GitHub MCP server
 * (`mcp__github__*` tools) and passed into CGAO tools as parameters.
 *
 * This module provides:
 * - resolveRepo() — local git remote parsing (no network)
 * - Type interfaces — describe GitHub API response shapes for reference
 */
import { execSync } from 'child_process';
/**
 * Resolve repo owner/name from local git remote.
 * Purely local operation — reads `git remote get-url origin`, no API calls.
 */
export function resolveRepo() {
    try {
        const url = execSync('git remote get-url origin', {
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'ignore'],
            timeout: 5000,
        }).trim();
        const m = url.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);
        if (m)
            return { owner: m[1], repo: m[2] };
    }
    catch { /* ignore */ }
    throw new Error('Could not resolve GitHub repo. Run inside a git repo with a GitHub origin.');
}
