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
