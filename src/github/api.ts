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
export function resolveRepo(): { owner: string; repo: string } {
  try {
    const url = execSync('git remote get-url origin', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    }).trim();
    const m = url.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (m) return { owner: m[1], repo: m[2] };
  } catch { /* ignore */ }
  throw new Error('Could not resolve GitHub repo. Run inside a git repo with a GitHub origin.');
}

// ---- Type interfaces for GitHub API response shapes ----
// These describe data returned by mcp__github__* tools.
// Kept for documentation and TypeScript type-checking.

export interface GHIssue {
  number: number;
  title: string;
  body: string | null;
  state: string;
  labels: Array<{ name: string }>;
  assignee: { login: string } | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  user: { login: string };
}

export interface GHPR {
  number: number;
  title: string;
  body: string | null;
  state: string;
  head: { ref: string; sha: string };
  base: { ref: string };
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  html_url: string;
  user: { login: string };
  draft: boolean;
  mergeable: boolean | null;
}
