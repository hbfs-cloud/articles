#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { awaitJob, McpCallError, rateLimitDelayMs, redactSecrets } = require('./lib/mcp-client');

async function main() {
  const calls = [];
  const responses = [
    { status: 'running' },
    { status: 'completed', data: { items: [{ id: 1 }] }, pagination: { page: 1, has_next: true, next_page: 2 } },
    { status: 'completed', data: { items: [{ id: 2 }] }, pagination: { page: 2, has_next: true, next_page: 3 } },
    { status: 'completed', data: { items: [{ id: 3 }] }, pagination: { page: 3, has_next: false } },
  ];
  const result = await awaitJob('marketdata', 'job-1', {
    intervalMs: 0,
    call: async (_server, _tool, args) => { calls.push(args); return responses.shift(); },
  });
  assert.deepStrictEqual(result.data.items.map(x => x.id), [1, 2, 3]);
  assert.strictEqual(result.pagination.exhausted, true);
  assert.deepStrictEqual(calls, [{ job_id: 'job-1' }, { job_id: 'job-1' }, { job_id: 'job-1', page: 2 }, { job_id: 'job-1', page: 3 }]);

  process.env.MCP_TOKEN_MARKETDATA = 'secret-value-never-print';
  const redacted = redactSecrets('Bearer abc.def.ghi secret-value-never-print eyJabcdefgh.abcdefgh.abcdefgh');
  assert(!redacted.includes('secret-value-never-print'));
  assert(!redacted.includes('eyJabcdefgh'));
  assert(redacted.includes('[REDACTED]'));
  delete process.env.MCP_TOKEN_MARKETDATA;

  assert.strictEqual(rateLimitDelayMs(new McpCallError('HTTP 429', {
    status: 429,
    body: JSON.stringify({ retry_after_seconds: 2.5 }),
  })), 2500);
  assert.strictEqual(rateLimitDelayMs(new McpCallError('HTTP 503', { status: 503 })), null);

  const errored = awaitJob('systematic', 'job-error', {
    intervalMs: 0,
    call: async () => ({ status: 'error', error: 'bad input' }),
  });
  await assert.rejects(errored, /Job job-error en échec/);

  console.log('mcp client tests: PASS');
}

main().catch(error => { console.error(error); process.exit(1); });
