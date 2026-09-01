#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { validateDtxDecision, validateDtxReplay } = require('./lib/dtx-content-gates');
const { stagingSnapshotErrors } = require('./dtx-scan');

const decision = JSON.parse(fs.readFileSync('scanner/20260831/_dtx/decide_best.json', 'utf8'));
const replay = JSON.parse(fs.readFileSync('scanner/20260831/_dtx/replay_best.json', 'utf8'));
assert.deepStrictEqual(validateDtxDecision(decision, {
  asof: '2026-08-31',
  requestId: decision.result.request_id,
  referenceClose: '2026-08-28',
}), []);
assert.deepStrictEqual(validateDtxReplay(replay, {
  portfolio: 'best',
  referenceClose: '2026-08-28',
}), []);

const stale = structuredClone(decision);
stale.result.data_asof = '2026-08-27';
assert(validateDtxDecision(stale, {
  asof: '2026-08-31', requestId: decision.result.request_id, referenceClose: '2026-08-28',
}).some(error => error.includes('data_asof')));

const truncated = structuredClone(replay);
truncated.result.results[0].equity_values.pop();
assert(validateDtxReplay(truncated, {
  portfolio: 'best', referenceClose: '2026-08-28',
}).some(error => error.includes('lengths differ')));

const staged = {
  portfolioId: 'best', asof: '2026-08-31', engineMode: 'mcp', generatedAt: '2026-08-29T01:00:00Z',
  decisionProvenance: {
    contractVersion: '2.0', requestedAsOf: '2026-08-31', expectedDataDate: '2026-08-28',
    dataAsOf: '2026-08-28', requestId: 'r', runId: 'run', callId: 'call', planId: 'plan',
  },
};
assert.deepStrictEqual(stagingSnapshotErrors(staged, 'best', {
  todayIso: '2026-08-29', scanDateIso: '2026-08-31', expectedClose: '2026-08-28',
}), []);
const wrongDate = structuredClone(staged); wrongDate.asof = '2026-09-01';
assert(stagingSnapshotErrors(wrongDate, 'best', {
  todayIso: '2026-08-29', scanDateIso: '2026-08-31', expectedClose: '2026-08-28',
}).some(error => error.includes('asof')));
assert(stagingSnapshotErrors(staged, 'best', {
  todayIso: '2026-08-29', scanDateIso: '2026-08-31',
}).some(error => error.includes('reference close')));

const failClosed = {
  portfolioId: 'best', asof: '2026-08-31', engineMode: 'mcp', generatedAt: '2026-08-29T01:00:00Z',
  actionable: false, failureMode: 'fail_closed', orders: [], executionPlan: null,
  invalidDecision: {
    code: 'IDEMPOTENCY_FINGERPRINT_CONFLICT',
    message: 'idempotency key reused with different input fingerprint',
    sourceArtifact: 'scanner/20260831/_dtx/decide_best.json',
  },
  decisionProvenance: {
    contractVersion: '2.0', requestedAsOf: '2026-08-31', expectedDataDate: '2026-08-28',
    dataAsOf: '2026-08-28', requestId: 'r', runId: null, callId: null, planId: null,
  },
};
assert.deepStrictEqual(stagingSnapshotErrors(failClosed, 'best', {
  todayIso: '2026-08-29', scanDateIso: '2026-08-31', expectedClose: '2026-08-28',
}), []);
const failClosedWithOrder = structuredClone(failClosed); failClosedWithOrder.orders = [{ symbol: 'AAPL' }];
assert(stagingSnapshotErrors(failClosedWithOrder, 'best', {
  todayIso: '2026-08-29', scanDateIso: '2026-08-31', expectedClose: '2026-08-28',
}).some(error => error.includes('orders must be empty')));
const failClosedWithoutFault = structuredClone(failClosed); delete failClosedWithoutFault.invalidDecision;
assert(stagingSnapshotErrors(failClosedWithoutFault, 'best', {
  todayIso: '2026-08-29', scanDateIso: '2026-08-31', expectedClose: '2026-08-28',
}).some(error => error.includes('invalidDecision')));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dtx-ingest-invalid-'));
try {
  const decideFile = path.join(tmp, 'decide.json');
  const replayFile = path.join(tmp, 'replay.json');
  const outFile = path.join(tmp, 'out.json');
  fs.writeFileSync(decideFile, JSON.stringify(decision));
  const invalidReplay = structuredClone(replay); invalidReplay.result.data_asof = '1999-01-01';
  fs.writeFileSync(replayFile, JSON.stringify(invalidReplay));
  const result = spawnSync(process.execPath, [
    'tools/dtx-mcp-ingest.js', '--portfolio', 'best', '--decide', decideFile, '--replay', replayFile,
    '--asof', '2026-08-31', '--expected-close', '2026-08-28', '--out', outFile, '--quiet',
  ], { encoding: 'utf8' });
  assert.strictEqual(result.status, 4, result.stdout + result.stderr);
  assert.strictEqual(fs.existsSync(outFile), false, 'invalid replay must not write staging');
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

console.log('DTX content gate tests: PASS');
