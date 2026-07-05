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
/**
 * Resolve repo owner/name from local git remote.
 * Purely local operation — reads `git remote get-url origin`, no API calls.
 */
export declare function resolveRepo(): {
    owner: string;
    repo: string;
};
export interface GHIssue {
    number: number;
    title: string;
    body: string | null;
    state: string;
    labels: Array<{
        name: string;
    }>;
    assignee: {
        login: string;
    } | null;
    created_at: string;
    updated_at: string;
    html_url: string;
    user: {
        login: string;
    };
}
export interface GHPR {
    number: number;
    title: string;
    body: string | null;
    state: string;
    head: {
        ref: string;
        sha: string;
    };
    base: {
        ref: string;
    };
    created_at: string;
    updated_at: string;
    merged_at: string | null;
    html_url: string;
    user: {
        login: string;
    };
    draft: boolean;
    mergeable: boolean | null;
}
