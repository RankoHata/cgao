#!/usr/bin/env node
/**
 * CGAO Standalone MCP Server
 *
 * Exposes intelligent GitHub workflow tools via stdio transport.
 * Claude Code spawns this via .mcp.json and communicates via JSON-RPC.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import { tools } from './tools.js';

const server = new Server({ name: 'cgao', version: '0.1.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map(t => ({ name: t.name, description: t.description, inputSchema: t.schema })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req: CallToolRequest) => {
  const { name, arguments: args } = req.params;
  const tool = tools.find(t => t.name === name);
  if (!tool) return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
  try { return await tool.handler((args ?? {}) as Record<string, unknown>); }
  catch (e) { return { content: [{ type: 'text', text: `Tool error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }; }
});

async function shutdown() {
  const t = setTimeout(() => process.exit(1), 3000); t.unref();
  try { await server.close(); } catch { /* best-effort */ }
  process.exit(0);
}
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);

async function main() {
  await server.connect(new StdioServerTransport());
  console.error('CGAO MCP Server running on stdio');
}
main().catch(e => { console.error('CGAO MCP start failed:', e); process.exit(1); });
