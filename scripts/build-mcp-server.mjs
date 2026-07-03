#!/usr/bin/env node
/**
 * Build: CGAO MCP server bundle
 * Bundles src/mcp/standalone-server.ts into bridge/mcp-server.cjs for plugin distribution.
 */
import * as esbuild from 'esbuild';
import { mkdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outfile = join(root, 'bridge', 'mcp-server.cjs');

await mkdir(join(root, 'bridge'), { recursive: true });

const banner = `
// Resolve global npm modules for native package imports
try {
  var _cp = require('child_process');
  var _Module = require('module');
  var _globalRoot = _cp.execSync('npm root -g', { encoding: 'utf8', timeout: 5000 }).trim();
  if (_globalRoot) {
    var _sep = process.platform === 'win32' ? ';' : ':';
    process.env.NODE_PATH = _globalRoot + (process.env.NODE_PATH ? _sep + process.env.NODE_PATH : '');
    _Module._initPaths();
  }
} catch (_e) { /* npm not available */ }
`;

const result = await esbuild.build({
  entryPoints: [join(root, 'src', 'mcp', 'standalone-server.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile,
  banner: { js: banner },
  external: ['fs', 'path', 'os', 'util', 'stream', 'events', 'buffer', 'crypto', 'http', 'https', 'url', 'child_process', 'assert'],
});

if (result.errors.length > 0) {
  console.error('Build failed:', result.errors);
  process.exit(1);
}
console.log(`Built ${outfile}`);
