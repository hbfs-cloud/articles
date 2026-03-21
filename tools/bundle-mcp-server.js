#!/usr/bin/env node

/**
 * Bundle MCP Server v2.0 into a single JSON file for the Prompt Lab ZIP generator.
 * Output: prompt-ia/mcp-server-bundle.json
 *
 * Usage: node tools/bundle-mcp-server.js
 * Run after any change to mcp/server/
 */

const { readFileSync, writeFileSync, readdirSync } = require('fs');
const { resolve } = require('path');

const ROOT = resolve(__dirname, '..');
const SERVER_DIR = resolve(ROOT, 'mcp/server');
const OUTPUT = resolve(ROOT, 'prompt-ia/mcp-server-bundle.json');

const bundle = {};

// index.js
bundle['mcp-server/index.js'] = readFileSync(resolve(SERVER_DIR, 'index.js'), 'utf8');

// package.json
bundle['mcp-server/package.json'] = readFileSync(resolve(SERVER_DIR, 'package.json'), 'utf8');

// config.example.yaml (if exists)
try {
  bundle['mcp-server/config.example.yaml'] = readFileSync(resolve(SERVER_DIR, 'config.example.yaml'), 'utf8');
} catch { /* skip */ }

// lib/*.js
const libDir = resolve(SERVER_DIR, 'lib');
for (const file of readdirSync(libDir).filter(f => f.endsWith('.js')).sort()) {
  bundle[`mcp-server/lib/${file}`] = readFileSync(resolve(libDir, file), 'utf8');
}

writeFileSync(OUTPUT, JSON.stringify(bundle, null, 0));

const sizeKB = Math.round(readFileSync(OUTPUT).length / 1024);
console.log(`✓ Bundled ${Object.keys(bundle).length} files → ${OUTPUT} (${sizeKB} KB)`);
