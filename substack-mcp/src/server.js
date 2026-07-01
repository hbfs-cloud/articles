#!/usr/bin/env node
/**
 * server.js — Substack MCP over Streamable HTTP (for claude.ai remote MCP registration).
 *
 * Transport: StreamableHTTPServerTransport at POST /mcp (stateless per-request instance).
 * Inbound auth: Bearer token (MCP_AUTH_TOKEN) — the OAuth2 layer terminates at the reverse-proxy;
 * this is the last-mile check. Outbound auth to Substack: session cookie (SubstackClient).
 *
 * Secrets (SUBSTACK_COOKIE, MCP_AUTH_TOKEN) come from the environment / secret store — never git.
 */
'use strict';

import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SubstackClient } from './substack-client.js';
import { registerTools } from './tools.js';

const PORT = Number(process.env.PORT || 8080);
const AUTH = process.env.MCP_AUTH_TOKEN || '';

function buildServer() {
  const server = new McpServer(
    { name: 'substack-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } }
  );
  const client = new SubstackClient({
    publication: process.env.SUBSTACK_PUBLICATION || 'dailytickers',
    cookie: process.env.SUBSTACK_COOKIE || '',
  });
  registerTools(server, client);
  return server;
}

const app = express();
app.use(express.json({ limit: '4mb' }));

app.get('/healthz', (_req, res) => res.json({ ok: true, service: 'substack-mcp' }));

app.post('/mcp', async (req, res) => {
  if (AUTH) {
    const hdr = req.headers.authorization || '';
    if (hdr !== `Bearer ${AUTH}`) {
      res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized' }, id: null });
      return;
    }
  }
  // Stateless: a fresh server+transport per request (simplest for a small tool server).
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => { transport.close(); server.close(); });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: String(e.message) }, id: null });
    }
  }
});

app.listen(PORT, () => {
  console.error(`substack-mcp listening on :${PORT}/mcp (auth ${AUTH ? 'on' : 'OFF'})`);
});
