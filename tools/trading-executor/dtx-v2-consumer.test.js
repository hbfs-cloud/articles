#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  consumeDtxDecidePayload,
} = require('./dtx-v2-consumer');

function validPayload(overrides = {}) {
  return {
    status: 'done',
    job_id: 'job-1',
    result: {
      contract_version: '2.0',
      request_id: 'req-1',
      run_id: 'run-1',
      call_id: 'call-1',
      state: { sleeve: {} },
      execution_plan: {
        plan_id: 'plan-1',
        revision: 1,
        valid_from: '2026-08-27T13:30:00Z',
        valid_until: '2026-08-28T20:00:00Z',
        groups: [{
          group_id: 'group-1',
          max_winners: 1,
          promotion_policy: { promote_on: ['entry_timeout'], stop_on: ['stale_data'] },
          candidates: [{
            candidate_id: 'candidate-1',
            rank: 1,
            symbol: 'NVDA',
            side: 'BUY',
            qty: 1,
            broker: 'paper',
            sleeve: 'test',
            reason: 'structured reason',
            decision_context: { score: 99 },
            order: { order_type: 'limit', limit_price: 180, qty: 1, time_in_force: 'day' },
            protection: { mode: 'native_bracket', stop_loss: 170, take_profit: 200 },
            execution: {
              window_start: '2026-08-27T13:30:00Z',
              window_end: '2026-08-27T20:00:00Z',
              timezone: 'America/New_York',
            },
          }],
        }],
      },
      ...overrides,
    },
  };
}

{
  const r = consumeDtxDecidePayload(validPayload(), { requestId: 'req-1', now: '2026-08-27T14:00:00Z' });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.mode, 'v2');
  assert.strictEqual(r.plan.groups.length, 1);
  assert.strictEqual(r.plan.groups[0].candidates[0].engine_order_fingerprint.length, 64);
}

{
  const r = consumeDtxDecidePayload({ status: 'async_pending', job_id: 'job-pending' });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.mode, 'async_pending');
  assert.match(r.errors[0], /DtxJobStatus/);
}

{
  const r = consumeDtxDecidePayload({ actions: { CREATE: [{ symbol: 'NVDA' }], UPDATE: [], CANCEL: [] } });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.mode, 'legacy_v1');
  assert.strictEqual(r.create_count, 1);
  assert.match(r.errors[0], /execution_plan\.groups/);
}

{
  const bad = validPayload({ request_id: 'wrong' });
  const r = consumeDtxDecidePayload(bad, { requestId: 'req-1', now: '2026-08-27T14:00:00Z' });
  assert.strictEqual(r.ok, false);
  assert.match(r.errors.join('\n'), /request_id mismatch/);
}

console.log('dtx-v2-consumer tests passed');
