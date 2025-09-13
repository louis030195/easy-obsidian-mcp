#!/usr/bin/env node

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// Check for environment variables
const apiKey = process.env.OBSIDIAN_API_KEY || process.env.OBSIDIAN_REST_API_KEY;
const port = process.env.OBSIDIAN_PORT || '27123';
const host = process.env.OBSIDIAN_HOST || '127.0.0.1';
const vaultPath = process.env.OBSIDIAN_VAULT_PATH || '';

if (!apiKey) {
  console.error(`
╔════════════════════════════════════════════════════════════════╗
║                    Obsidian MCP Server                        ║
╚════════════════════════════════════════════════════════════════╝

⚠️  Missing Obsidian REST API Key!

Please set the OBSIDIAN_API_KEY environment variable:

  export OBSIDIAN_API_KEY="your-api-key-here"

To get your API key:
1. Open Obsidian
2. Go to Settings → Community plugins
3. Install and enable "Local REST API"
4. Copy the API key from the plugin settings

Optional environment variables:
  OBSIDIAN_PORT        (default: 27123)
  OBSIDIAN_HOST        (default: 127.0.0.1)
  OBSIDIAN_VAULT_PATH  (auto-detected if not set)

For more info: https://github.com/louis030195/obsidian-mcp
`);
  process.exit(1);
}

// Build arguments
const args = [
  path.join(__dirname, 'index.js'),
  '--apiKey', apiKey,
  '--port', port,
  '--host', host
];

if (vaultPath) {
  args.push('--vaultPath', vaultPath);
}

// Add any additional arguments passed to the CLI
const userArgs = process.argv.slice(2);
if (userArgs.length > 0) {
  args.push(...userArgs);
}

console.error(`Starting Obsidian MCP Server...`);
console.error(`API endpoint: http://${host}:${port}`);
if (vaultPath) {
  console.error(`Vault path: ${vaultPath}`);
} else {
  console.error(`Vault path: Auto-detecting...`);
}

// Spawn the actual server
const server = spawn('node', args, {
  stdio: 'inherit',
  env: process.env
});

server.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

server.on('exit', (code) => {
  process.exit(code || 0);
});