#!/usr/bin/env node

/**
 * Market Watch MCP Dashboard
 * Local admin UI served on localhost:3847
 * Serves dashboard/index.html + API endpoints for the UI
 */

import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.MW_DASHBOARD_PORT || '3847');

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

// ── Simple HTTP server ──
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // API routes
  if (url.pathname.startsWith('/api/')) {
    return handleAPI(req, res, url);
  }

  // Static files
  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  const fullPath = resolve(__dirname, 'dashboard', filePath.slice(1));

  if (!existsSync(fullPath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }

  const ext = extname(fullPath);
  const mime = MIME[ext] || 'application/octet-stream';
  const content = readFileSync(fullPath);
  res.writeHead(200, { 'Content-Type': mime });
  res.end(content);
});

async function handleAPI(req, res, url) {
  res.setHeader('Content-Type', 'application/json');

  try {
    // Proxy to MCP watchlist
    if (url.pathname === '/api/watchlist') {
      const data = await fetch('https://articles.market-watch.xyz/mcp/watchlist.json').then(r => r.json());
      res.writeHead(200);
      res.end(JSON.stringify(data));
      return;
    }

    // Health check
    if (url.pathname === '/api/health') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'ok', version: '2.0.0', uptime: process.uptime() }));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Unknown API endpoint' }));
  } catch (err) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
}

server.listen(PORT, () => {
  console.log(`\n  Market Watch Dashboard: http://localhost:${PORT}\n`);

  // Auto-open browser
  try {
    import('open').then(m => m.default(`http://localhost:${PORT}`)).catch(() => {});
  } catch { /* optional dependency */ }
});
