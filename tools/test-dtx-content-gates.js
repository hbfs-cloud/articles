#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { validateDtxDecision, validateDtxReplay } = require('./lib/dtx-content-gates');
const { stagingSnapshotErrors, extractReplayMetrics } = require('./dtx-scan');
const modesConfig = JSON.parse(fs.readFileSync('data/modes-config.json', 'utf8'));
const publicDtx = modesConfig.modes.best;
const enginePortfolio = publicDtx.dtxPortfolio;
const expectedConfigHash = publicDtx.dtxConfigHash;

const decision = JSON.parse(fs.readFileSync('scanner/20260831/_dtx/decide_best.json', 'utf8'));
const replay = JSON.parse(fs.readFileSync('scanner/20260831/_dtx/replay_best.json', 'utf8'));
assert.deepStrictEqual(validateDtxDecision(decision, {
  asof: '2026-08-31',
  requestId: decision.result.request_id,
  portfolio: 'best',
  referenceClose: '2026-08-28',
}), []);
assert.deepStrictEqual(validateDtxReplay(replay, {
  portfolio: 'best',
  referenceClose: '2026-08-28',
}), []);

const replayResult = replay.result || replay;
const exactSource = replayResult.results[0];
const exactReplay = extractReplayMetrics({ results: [exactSource] }, '2021-01-01', '2026-08-28').metrics;
assert.strictEqual(exactReplay.replay_scope, 'single_strategy');
assert.strictEqual(exactReplay.equity_scope, 'equity_full');
assert.strictEqual(exactReplay.equity_resolution, 'daily');
for (const field of [
  'profit_factor', 'sortino', 'calmar', 'avg_exposure_pct', 'annualized_vol_pct',
  'daily_var_95_pct', 'daily_cvar_95_pct', 'ulcer_index', 'max_underwater_sessions',
]) assert.strictEqual(exactReplay[field], exactSource[field], `exact replay metric ${field} lost`);

const stale = structuredClone(decision);
stale.result.data_asof = '2026-08-27';
assert(validateDtxDecision(stale, {
  asof: '2026-08-31', requestId: decision.result.request_id, referenceClose: '2026-08-28',
}).some(error => error.includes('data_asof')));

const wrongPortfolio = structuredClone(decision);
wrongPortfolio.result.strategy_id = 'other';
wrongPortfolio.result.execution_plan.groups[0].candidates[0].strategy_id = 'other';
const identityErrors = validateDtxDecision(wrongPortfolio, {
  asof: '2026-08-31', requestId: decision.result.request_id,
  portfolio: 'best', referenceClose: '2026-08-28',
});
assert(identityErrors.some(error => error.includes('strategy_id=other != best')),
  'top-level and candidate portfolio drift must fail closed');

const wrongConfig = structuredClone(decision);
wrongConfig.result.config_hash = 'sha256:wrong';
assert(validateDtxDecision(wrongConfig, {
  asof: '2026-08-31', requestId: decision.result.request_id,
  portfolio: 'best', configHash: 'sha256:expected', referenceClose: '2026-08-28',
}).some(error => error.includes('config_hash=sha256:wrong != sha256:expected')),
'decision config hash drift must fail closed');

for (const invalidValue of [null, 0]) {
  const invalidLimit = structuredClone(decision.result || decision);
  invalidLimit.execution_plan.groups[0].candidates[0].order.limit_price = invalidValue;
  assert(validateDtxDecision({ result: invalidLimit }, {
    asof: '2026-08-31', requestId: invalidLimit.request_id, referenceClose: '2026-08-28',
  }).some(error => error.includes('limit_price')), `LIMIT ${invalidValue} must fail closed`);

  const invalidStop = structuredClone(decision.result || decision);
  invalidStop.execution_plan.groups[0].candidates[0].protection.stop_loss = invalidValue;
  assert(validateDtxDecision({ result: invalidStop }, {
    asof: '2026-08-31', requestId: invalidStop.request_id, referenceClose: '2026-08-28',
  }).some(error => error.includes('engine_managed')), `stop_loss ${invalidValue} must fail closed`);
}

const truncated = structuredClone(replay);
truncated.result.results[0].equity_values.pop();
assert(validateDtxReplay(truncated, {
  portfolio: 'best', referenceClose: '2026-08-28',
}).some(error => error.includes('lengths differ')));

const staged = {
  mode: 'best', portfolioId: 'best', configHash: expectedConfigHash, asof: '2026-08-31', decisionAsOf: '2026-08-28', engineMode: 'mcp', generatedAt: '2026-08-29T01:00:00Z',
  decisionProvenance: {
    contractVersion: '2.0', requestedAsOf: '2026-08-28', expectedDataDate: '2026-08-28',
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
const wrongStagingHash = { ...staged, configHash: 'sha256:wrong' };
assert(stagingSnapshotErrors(wrongStagingHash, 'best', {
  todayIso: '2026-08-29', scanDateIso: '2026-08-31', expectedClose: '2026-08-28',
}).some(error => error.includes('configHash')));

const failClosed = {
  mode: 'best', portfolioId: 'best', configHash: expectedConfigHash, asof: '2026-08-31', decisionAsOf: '2026-08-28', engineMode: 'mcp', generatedAt: '2026-08-29T01:00:00Z',
  actionable: false, failureMode: 'fail_closed', orders: [], executionPlan: null,
  invalidDecision: {
    code: 'IDEMPOTENCY_FINGERPRINT_CONFLICT',
    message: 'idempotency key reused with different input fingerprint',
    sourceArtifact: 'scanner/20260831/_dtx/decide_best.json',
  },
  decisionProvenance: {
    contractVersion: '2.0', requestedAsOf: '2026-08-28', expectedDataDate: '2026-08-28',
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
  const mappedDecision = structuredClone(decision);
  mappedDecision.result.strategy_id = enginePortfolio;
  mappedDecision.result.config_hash = expectedConfigHash;
  for (const group of mappedDecision.result.execution_plan.groups) {
    for (const candidate of group.candidates) candidate.strategy_id = enginePortfolio;
  }
  fs.writeFileSync(decideFile, JSON.stringify(mappedDecision));
  const invalidReplay = structuredClone(replay);
  invalidReplay.result.portfolio_id = enginePortfolio;
  invalidReplay.result.data_asof = '1999-01-01';
  fs.writeFileSync(replayFile, JSON.stringify(invalidReplay));
  const result = spawnSync(process.execPath, [
    'tools/dtx-mcp-ingest.js', '--portfolio', enginePortfolio, '--decide', decideFile, '--replay', replayFile,
    '--asof', '2026-08-31', '--expected-close', '2026-08-28', '--out', outFile, '--quiet',
  ], { encoding: 'utf8' });
  assert.strictEqual(result.status, 4, result.stdout + result.stderr);
  assert.strictEqual(fs.existsSync(outFile), false, 'invalid replay must not write staging');

  const mismatchedDecision = structuredClone(mappedDecision);
  mismatchedDecision.result.config_hash = 'sha256:wrong';
  fs.writeFileSync(decideFile, JSON.stringify(mismatchedDecision));
  const hashResult = spawnSync(process.execPath, [
    'tools/dtx-mcp-ingest.js', '--portfolio', enginePortfolio, '--decide', decideFile,
    '--asof', '2026-08-31', '--expected-close', '2026-08-28', '--out', outFile, '--quiet',
  ], { encoding: 'utf8' });
  assert.strictEqual(hashResult.status, 3, hashResult.stdout + hashResult.stderr);
  assert.match(`${hashResult.stdout}\n${hashResult.stderr}`, /config_hash=.*!=/);
  assert.strictEqual(fs.existsSync(outFile), false, 'config hash drift must not write staging');
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

console.log('DTX content gate tests: PASS');
