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
  assert.deepStrictEqual(calls, [
    { job_id: 'job-1', maxsize: 262144 },
    { job_id: 'job-1', maxsize: 262144 },
    { job_id: 'job-1', page: 2, maxsize: 262144 },
    { job_id: 'job-1', page: 3, maxsize: 262144 },
  ]);

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


  const originalFetch = global.fetch;
  const originalToken = process.env.MCP_TOKEN_MARKETDATA;
  process.env.MCP_TOKEN_MARKETDATA = 'test-token-no-real-credential';
  const freshClient = () => {
    delete require.cache[require.resolve('./lib/mcp-client')];
    return require('./lib/mcp-client');
  };
  const ok = value => new Response(JSON.stringify({ result: { content: [{ type: 'text', text: JSON.stringify(value) }] } }), { status: 200 });
  try {
    // Full body/header parsing precedes diagnostic truncation; never cap a
    // server's Retry-After to 60s or convert a missing hint to zero via Number(null).
    let client = freshClient();
    global.fetch = async () => new Response(JSON.stringify({ padding: 'x'.repeat(1200), error: { retry_after_seconds: 70 } }), {
      status: 429, headers: { 'Retry-After': '80' },
    });
    await assert.rejects(client.callToolWithRetry('marketdata', 'RunScreener', {}, { timeoutMs: 100, requestIntervalMs: 0 }), error => {
      assert.strictEqual(client.rateLimitDelayMs(error), 80_000);
      return error.status === 429;
    });
    assert.strictEqual(client.rateLimitDelayMs(new client.McpCallError('429', { status: 429, body: '{}' })), 5000);

    // An accepted job remains the same logical request across a transient 429.
    client = freshClient();
    const attempts = [];
    global.fetch = async (_url, request) => {
      attempts.push({ at: Date.now(), body: JSON.parse(request.body) });
      if (attempts.length === 1) return new Response('{}', { status: 429, headers: { 'Retry-After': '1' } });
      return ok({ job_id: 'job-retried', status: 'pending' });
    };
    const accepted = await client.callToolWithRetry('marketdata', 'RunScreener', { asset: 'etf' }, { timeoutMs: 5000 });
    assert.strictEqual(accepted.job_id, 'job-retried');
    assert.strictEqual(attempts.length, 2);
    assert(attempts[1].at - attempts[0].at >= 1000);
    assert.deepStrictEqual(attempts[0].body.params, attempts[1].body.params);
    assert(attempts[0].body.params.arguments.intent_id);

    // Concurrent workers share a paced lane instead of independent burst loops.
    client = freshClient();
    const starts = [];
    global.fetch = async () => { starts.push(Date.now()); return ok({ status: 'completed' }); };
    await Promise.all([1, 2, 3].map(() => client.callTool('marketdata', 'Jobs', {}, { requestIntervalMs: 25 })));
    assert(starts[1] - starts[0] >= 24 && starts[2] - starts[1] >= 24);

    // A refusal learned by one worker pauses the other worker's queued call.
    client = freshClient();
    const cooldownStarts = [];
    global.fetch = async () => {
      cooldownStarts.push(Date.now());
      if (cooldownStarts.length === 1) return new Response('{}', { status: 429, headers: { 'Retry-After': '1' } });
      return ok({ status: 'completed' });
    };
    const cooled = await Promise.allSettled([1, 2].map(() => client.callTool('marketdata', 'Jobs', {}, { requestIntervalMs: 25 })));
    assert.strictEqual(cooled[0].status, 'rejected');
    assert.strictEqual(cooled[1].status, 'fulfilled');
    assert(cooldownStarts[1] - cooldownStarts[0] >= 1000);

    // Queue time is inside each deadline, even behind a long server cooldown.
    client = freshClient();
    global.fetch = async () => new Response('{}', { status: 429, headers: { 'Retry-After': '10' } });
    await assert.rejects(client.callTool('marketdata', 'Jobs'), error => error.status === 429);
    const queueStarted = Date.now();
    const expired = await Promise.allSettled([50, 80].map(timeoutMs => client.callTool('marketdata', 'Jobs', {}, { timeoutMs })));
    assert(expired.every(result => result.status === 'rejected'));
    assert(Date.now() - queueStarted < 500);

    // A 429 on page 2 retries THAT page, preserving the complete result.
    client = freshClient();
    const pages = [];
    global.fetch = async (_url, request) => {
      const args = JSON.parse(request.body).params.arguments;
      const page = args.page || 1;
      pages.push(page);
      if (pages.length === 2) return new Response(JSON.stringify({ error: { retry_after_seconds: 1 } }), { status: 429 });
      return ok({ status: 'completed', data: { items: [{ id: page }] }, pagination: { page, next_page: page + 1, has_next: page === 1 } });
    };
    const complete = await client.awaitJob('marketdata', 'job-pages', { maxMs: 6000 });
    assert.deepStrictEqual(pages, [1, 2, 2]);
    assert.deepStrictEqual(complete.data.items.map(item => item.id), [1, 2]);
    assert.strictEqual(complete.pagination.exhausted, true);

    client = freshClient();
    let refusedCalls = 0;
    global.fetch = async () => { refusedCalls++; return new Response('{}', { status: 401 }); };
    await assert.rejects(client.callToolWithRetry('marketdata', 'RunScreener'), /Jeton refusé/);
    assert.strictEqual(refusedCalls, 1);

    // Exhausted transport budgets still reject: no partial-success fallback.
    client = freshClient();
    refusedCalls = 0;
    global.fetch = async () => { refusedCalls++; return new Response('{}', { status: 429, headers: { 'Retry-After': '1' } }); };
    await assert.rejects(client.callToolWithRetry('marketdata', 'RunScreener', {}, { rateLimitRetries: 1, timeoutMs: 5000 }), error => error.status === 429);
    assert.strictEqual(refusedCalls, 2);
  } finally {
    global.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.MCP_TOKEN_MARKETDATA;
    else process.env.MCP_TOKEN_MARKETDATA = originalToken;
  }
  console.log('mcp client tests: PASS');
}

main().catch(error => { console.error(error); process.exit(1); });
