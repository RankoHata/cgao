/**
 * CGAO Custom MCP Tools — Intelligence Layer
 *
 * These tools sit ABOVE the official GitHub MCP server.
 * They provide analysis, classification, planning, and quality assessment —
 * operations that require codebase context and multi-step reasoning,
 * not just single GitHub API calls.
 *
 * ## CRITICAL: CGAO tools NEVER make direct HTTP calls to api.github.com.
 *
 * The official GitHub MCP (`mcp__github__*`) handles ALL GitHub API operations.
 * CGAO tools (`mcp__cgao__*`) receive GitHub data as PARAMETERS and add
 * intelligence on top: classification, local code search, state persistence,
 * quality heuristics.  If you find yourself adding an HTTP call here — STOP.
 * The data must come from `mcp__github__*` tools and be passed in by the caller.
 */
interface ToolDef {
    name: string;
    description: string;
    schema: Record<string, unknown>;
    handler: (a: Record<string, unknown>) => Promise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
        isError?: boolean;
    }>;
}
export declare const tools: ToolDef[];
export {};
