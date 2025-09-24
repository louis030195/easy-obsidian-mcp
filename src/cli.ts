#!/usr/bin/env node

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// Check for environment variables
const apiKey = process.env.OBSIDIAN_API_KEY || process.env.OBSIDIAN_REST_API_KEY || 'fallback-no-api';
const port = process.env.OBSIDIAN_PORT || '27123';
const host = process.env.OBSIDIAN_HOST || '127.0.0.1';
const vaultPath = process.env.OBSIDIAN_VAULT_PATH || '';

// MCP servers must not output non-JSON to stderr as it breaks the protocol

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

// Spawn the actual server
const server = spawn('node', args, {
  stdio: 'inherit',
  env: process.env
});

server.on('error', (err) => {
  console.error(JSON.stringify({
    level: "error",
    message: "Failed to start server",
    error: err.message
  }));
  process.exit(1);
});

server.on('exit', (code) => {
  process.exit(code || 0);
});
