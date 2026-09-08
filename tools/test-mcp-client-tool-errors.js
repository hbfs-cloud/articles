#!/usr/bin/env node
'use strict';

// Offline transport regressions: fetch is replaced before any MCP call.
const assert = require('assert');
const { callTool, awaitJob, McpCallError } = require('./lib/mcp-client');

async function main() {
  const savedFetch = global.fetch;
  const envKeys = ['MCP_TOKEN_MARKETDATA', 'MCP_TOKEN_MARKETDATA_EXPIRES_AT', 'MCP_TOKEN_EXPIRES_AT'];
  const savedEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  const secret = 'offline-secret-never-log';
  process.env.MCP_TOKEN_MARKETDATA = secret;
  delete process.env.MCP_TOKEN_MARKETDATA_EXPIRES_AT;
  delete process.env.MCP_TOKEN_EXPIRES_AT;
  let responses = [];
  const calls = [];
  global.fetch = async (_url, options) => {
    calls.push(JSON.parse(options.body).params);
    assert(responses.length, 'unexpected offline request');
    const result = responses.shift();
    return { ok: true, status: 200, text: async () => JSON.stringify({ jsonrpc: '2.0', id: 1, result }) };
  };
  try {
    // The observed Jobs error must retain its cause, not become "status absent".
    responses = [
      { content: [{ type: 'text', text: JSON.stringify({ status: 'completed', data: { items: [{ id: 1 }], pagination: { has_next: true, next_page: 2 } } }) }] },
      { isError: true, content: [{ type: 'text', text: 'GetJobStatus failed: job not found: offline-job' }] },
    ];
    await assert.rejects(awaitJob('marketdata', 'offline-job', { call: callTool }), error => {
      assert(error instanceof McpCallError);
      assert.match(error.message, /GetJobStatus failed: job not found: offline-job/);
      assert(!error.message.includes('état inattendu'));
      assert.strictEqual(error.server, 'marketdata');
      assert.strictEqual(error.tool, 'Jobs');
      return true;
    });
    assert.strictEqual(calls.length, 2);
    assert.strictEqual(calls[1].arguments.page, 2);

    // Plain and JSON tool errors preserve useful details while removing secrets.
    for (const text of [
      `failure ${secret}; Bearer abc.def.ghi`,
      JSON.stringify({ error: `failure ${secret}`, detail: 'Bearer abc.def.ghi' }),
    ]) {
      responses = [{ isError: true, content: [{ type: 'text', text }] }];
      await assert.rejects(callTool('marketdata', 'Jobs', { job_id: 'offline-job' }), error => {
        assert(error instanceof McpCallError);
        for (const value of [error.message, error.body]) {
          assert(!value.includes(secret));
          assert(!value.includes('abc.def.ghi'));
          assert(value.includes('[REDACTED]'));
          assert(value.includes('failure'));
        }
        return true;
      });
    }

    responses = [{ isError: false, content: [{ type: 'text', text: '{"status":"completed","data":{"items":[]}}' }] }];
    assert.deepStrictEqual(await callTool('marketdata', 'Jobs', { job_id: 'offline-job' }), { status: 'completed', data: { items: [] } });

    // A malformed page still fails closed; error diagnostics do not relax pagination.
    let page = 0;
    await assert.rejects(awaitJob('marketdata', 'offline-job', {
      call: async () => ++page === 1
        ? { status: 'completed', data: { items: [], pagination: { has_next: true, next_page: 2 } } }
        : { data: { items: [] } },
    }), /page 2 dans un état inattendu \(absent\)/);
    console.log('mcp client tool-error tests: PASS (offline)');
  } finally {
    global.fetch = savedFetch;
    for (const key of envKeys) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  }
}

main().catch(error => { console.error(error); process.exit(1); });
