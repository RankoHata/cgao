/**
 * GitHub API Helper
 *
 * Supplementary client for operations that need codebase context
 * or multi-step aggregation beyond single GH API calls.
 * Uses GITHUB_TOKEN env var or falls back to `gh auth token`.
 */
export declare function resolveToken(): string;
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
export declare function getIssue(owner: string, repo: string, num: number): Promise<GHIssue>;
export declare function listIssues(owner: string, repo: string, opts?: {
    state?: string;
    labels?: string;
    per_page?: number;
}): Promise<GHIssue[]>;
export declare function addComment(owner: string, repo: string, issueNum: number, body: string): Promise<unknown>;
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
export declare function getPR(owner: string, repo: string, num: number): Promise<GHPR>;
export declare function listPRs(owner: string, repo: string, opts?: {
    state?: string;
    per_page?: number;
}): Promise<GHPR[]>;
export declare function getPRStatus(owner: string, repo: string, ref: string): Promise<{
    state: string;
    statuses: Array<{
        context: string;
        state: string;
        description: string;
    }>;
}>;
export declare function getPRChecks(owner: string, repo: string, ref: string): Promise<{
    total_count: number;
    check_runs: Array<{
        name: string;
        status: string;
        conclusion: string | null;
    }>;
}>;
export declare function listReviews(owner: string, repo: string, prNum: number): Promise<{
    id: number;
    state: string;
    body: string;
    user: {
        login: string;
    };
    submitted_at: string;
}[]>;
export declare function resolveRepo(): {
    owner: string;
    repo: string;
};
