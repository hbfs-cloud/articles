#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  appendCandidateDecision,
  appendPositionExit,
  assertAppendOnly,
  buildGenesisRegistry,
  hashValue,
  loadRegistry,
  modeBoundaryStatus,
  sealRecord,
  sealRegistry,
  validateRegistry,
} = require('./lib/capacity-ledger');
const { capacityCertificationErrors } = require('./lib/mode-stats');

const ROOT = path.resolve(__dirname, '..');
const history = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/modes-config-history.json'), 'utf8'));
const CREATED_AT = '2026-09-01T11:10:46.000Z';
const sha = label => hashValue({ fixture: label });
const cell = (label, extra = {}) => ({ status: 'completed', sourceHash: sha(label), ...extra });
const na = reason => ({ status: 'not_applicable', notApplicableReason: reason });

function genesis() {
  return buildGenesisRegistry({ configHistory: history, createdAt: CREATED_AT });
}

function candidate(overrides = {}) {
  return {
    modeId: 'turbo',
    session: '2026-09-01',
    recordedAt: '2026-09-01T13:31:00.000Z',
    decisionTimestamp: '2026-09-01T11:15:00.000Z',
    candidateId: '20260901-turbo-AAPL-000',
    positionId: 'turbo:AAPL:20260901',
    symbol: 'AAPL',
    instrumentId: 'US0378331005',
    terminalState: 'accepted',
    rejectionReason: null,
    requestedWeight: 1,
    sourceEvidence: cell('scan', {
      sourceKind: 'scanner_signal',
      sourceRef: 'scanner/20260901/signals.json#AAPL',
    }),
    riskState: cell('risk', {
      vixKill: false,
      drawdownBreaker: false,
      circuitBreaker: false,
    }),
    regimeState: cell('regime', {
      rawRegime: 'risk_on',
      effectiveRegime: 'risk_on',
      regimeScore: null,
      regimeScoreNotApplicableReason: 'mode config has no score override',
    }),
    orderState: cell('order', {
      rank: 0,
      sequenceInSession: 0,
      deterministicKey: 'score_desc|symbol_asc:AAPL',
    }),
    sizingState: cell('sizing', {
      method: 'inverse_atr',
      weight: 1,
      targetRiskPct: 1,
    }),
    entryEvidence: cell('entry', {
      entryPrice: 100,
      entryTimestamp: '2026-09-01T13:30:00.000Z',
      completionPolicy: 'completed_only',
    }),
    ...overrides,
  };
}

// Deterministic, sealed, empty genesis for all four modes.
const a = genesis();
const b = genesis();
assert.deepStrictEqual(a, b);
assert.deepStrictEqual(validateRegistry(a, { configHistory: history }), []);
assert.strictEqual(a.boundary.session, '2026-09-01');
assert.strictEqual(a.boundary.effectiveAt, CREATED_AT);
assert.strictEqual(a.boundary.preBoundary.endsAtExclusive, CREATED_AT);
assert.strictEqual(a.boundary.preBoundary.lastUncertifiedSession, '2026-09-01');
assert.strictEqual(a.boundary.preBoundary.includesBoundarySessionBeforeEffectiveAt, true);
assert.strictEqual(a.boundary.preBoundary.status, 'retired_uncertified');
assert.strictEqual(a.boundary.preBoundary.carryInPolicy, 'discarded_uncertified_state');
assert.strictEqual(a.contract.performancePolicy, 'capacity_ledger_alone_never_certifies_returns');
assert.deepStrictEqual(
  Object.fromEntries(Object.entries(a.modes).map(([id, mode]) => [id, mode.records[0].stateAfter.nominalSlots])),
  { turbo: 1, dynamic: 1, balanced: 3, fortress: 10 },
);
for (const mode of Object.values(a.modes)) {
  assert.deepStrictEqual(mode.counters, { candidates: 0, accepted: 0, rejected: 0, exits: 0 });
  assert.strictEqual(mode.records.length, 1);
  assert.deepStrictEqual(mode.records[0].stateAfter.positions, []);
  assert.strictEqual(mode.records[0].capacityAt.occupiedSlots, 0);
  assert.strictEqual(mode.records[0].capacityAt.cashWeight, 1);
}
assert.strictEqual(a.modes.fortress.records[0].capacityAt.maxGrossWeight, 0.5);
assert.strictEqual(a.modes.fortress.records[0].capacityAt.deployableWeightRemaining, 0.5);

// A certified forward reset is not retroactive evidence and never unmasks the
// old frozen results.
const frozen = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/backtest-results.json'), 'utf8'));
for (const modeId of ['turbo', 'dynamic', 'balanced', 'fortress']) {
  const status = modeBoundaryStatus(a, modeId, { configHistory: history });
  assert.strictEqual(status.forwardCertified, true);
  assert.strictEqual(status.trackingStatus, 'not_started');
  assert.strictEqual(status.historyStatus, 'retired_uncertified');
  assert.strictEqual(status.historicalStatsPublishable, false);
  assert.strictEqual(status.historicalCurvesPublishable, false);
  assert.strictEqual(status.forwardPerformancePublishable, false);
  assert(capacityCertificationErrors(frozen[`frozen_${modeId}`], {
    configHistory: history,
    modeId,
  }).length > 0, `${modeId}: old frozen artifact must remain uncertified`);
}

// Accepted candidates bind configAt, capacityAt, risk, regime, deterministic
// order and entry evidence into the hash chain.
const withAapl = appendCandidateDecision(a, candidate(), { configHistory: history });
assert.deepStrictEqual(validateRegistry(withAapl, { configHistory: history }), []);
assertAppendOnly(a, withAapl);
assert.strictEqual(withAapl.modes.turbo.counters.accepted, 1);
assert.strictEqual(withAapl.modes.turbo.records.at(-1).capacityAt.availableSlots, 1);
assert.strictEqual(withAapl.modes.turbo.records.at(-1).stateAfter.availableSlots, 0);
assert.strictEqual(withAapl.modes.turbo.records.at(-1).stateAfter.cashWeight, 0);
assert.strictEqual(modeBoundaryStatus(withAapl, 'turbo', { configHistory: history }).trackingStatus, 'tracking');

// P1 cannot accept an overlapping second position. It may only append a
// terminal rejection, which leaves state unchanged.
assert.throws(() => appendCandidateDecision(withAapl, candidate({
  candidateId: '20260901-turbo-MSFT-001',
  positionId: 'turbo:MSFT:20260901',
  symbol: 'MSFT',
  instrumentId: 'US5949181045',
  orderState: cell('order-2', { rank: 1, sequenceInSession: 1, deterministicKey: 'score_desc|symbol_asc:MSFT' }),
}), { configHistory: history }), /no available slot/);

const rejected = appendCandidateDecision(withAapl, candidate({
  candidateId: '20260901-turbo-MSFT-001',
  positionId: null,
  symbol: 'MSFT',
  instrumentId: 'US5949181045',
  terminalState: 'rejected',
  rejectionReason: 'portfolio_capacity_exhausted',
  orderState: cell('order-2', { rank: 1, sequenceInSession: 1, deterministicKey: 'score_desc|symbol_asc:MSFT' }),
  riskState: na('candidate rejected at capacity gate'),
  regimeState: na('candidate rejected at capacity gate'),
  entryEvidence: na('rejected candidates do not enter'),
}), { configHistory: history });
assert.deepStrictEqual(validateRegistry(rejected, { configHistory: history }), []);
assert.strictEqual(rejected.modes.turbo.counters.rejected, 1);
assert.deepStrictEqual(
  rejected.modes.turbo.records.at(-1).stateAfter,
  withAapl.modes.turbo.records.at(-1).stateAfter,
);

// A certified exit releases the slot; a later candidate can then enter.
const exited = appendPositionExit(rejected, {
  modeId: 'turbo',
  session: '2026-09-02',
  recordedAt: '2026-09-02T20:01:00.000Z',
  positionId: 'turbo:AAPL:20260901',
  exitEvidence: cell('exit', {
    exitPrice: 102,
    exitTimestamp: '2026-09-02T20:00:00.000Z',
    completionPolicy: 'completed_only',
  }),
}, { configHistory: history });
assert.deepStrictEqual(validateRegistry(exited, { configHistory: history }), []);
assert.strictEqual(exited.modes.turbo.records.at(-1).stateAfter.availableSlots, 1);
assert.strictEqual(exited.modes.turbo.records.at(-1).stateAfter.cashWeight, 1);

const withMsft = appendCandidateDecision(exited, candidate({
  session: '2026-09-02',
  recordedAt: '2026-09-02T20:02:00.000Z',
  decisionTimestamp: '2026-09-02T13:00:00.000Z',
  candidateId: '20260902-turbo-MSFT-000',
  positionId: 'turbo:MSFT:20260902',
  symbol: 'MSFT',
  instrumentId: 'US5949181045',
  orderState: cell('order-msft', { rank: 0, sequenceInSession: 0, deterministicKey: 'score_desc|symbol_asc:MSFT' }),
  entryEvidence: cell('entry-msft', {
    entryPrice: 200,
    entryTimestamp: '2026-09-02T13:30:00.000Z',
    completionPolicy: 'completed_only',
  }),
}), { configHistory: history });
assert.deepStrictEqual(validateRegistry(withMsft, { configHistory: history }), []);

// Fail-closed adversarial cases.
assert.throws(() => appendCandidateDecision(a, candidate({ session: '2026-08-31' }), { configHistory: history }), /boundary/);
assert.throws(() => appendCandidateDecision(a, candidate({
  candidateId: '20260901-best-SNDK-preboundary',
  symbol: 'SNDK',
  instrumentId: 'US80004C2008',
  decisionTimestamp: '2026-09-01T09:05:10.772Z',
}), { configHistory: history }), /decision precedes certified effective boundary/,
'the pre-boundary SNDK plan is retired, never smuggled into the zero genesis');
assert.throws(() => appendCandidateDecision(a, candidate({ terminalState: 'completed' }), { configHistory: history }), /exactly accepted or rejected/);
assert.throws(() => appendCandidateDecision(a, candidate({ riskState: { status: 'failed', error: 'feed down' } }), { configHistory: history }), /must be completed/);
assert.throws(() => appendCandidateDecision(a, candidate({ regimeState: na('unknown') }), { configHistory: history }), /must be completed/);
assert.throws(() => appendCandidateDecision(a, candidate({ sizingState: cell('bad-sizing', { method: 'fixed', weight: 1 }) }), { configHistory: history }), /effective sizing method/);
assert.throws(() => appendCandidateDecision(a, candidate({ entryEvidence: { status: 'completed', sourceHash: sha('partial') } }), { configHistory: history }), /entry price\/timestamp/);
assert.throws(() => appendCandidateDecision(a, candidate({ rejectionReason: 'not allowed' }), { configHistory: history }), /cannot carry rejectionReason/);
assert.throws(() => appendCandidateDecision(withAapl, candidate({
  candidateId: '20260901-turbo-AAPL-000',
}), { configHistory: history }), /duplicate candidateId|instrument already active/);

const policyForgery = JSON.parse(JSON.stringify(a));
policyForgery.boundary.preBoundary.metricsPolicy = 'visible';
const resealedPolicyForgery = sealRegistry(policyForgery);
assert(validateRegistry(resealedPolicyForgery, { configHistory: history })
  .some(error => /metricsPolicy must be masked/.test(error)));

const configForgery = JSON.parse(JSON.stringify(a));
const forgedGenesis = configForgery.modes.turbo.records[0];
forgedGenesis.configAt.configHash = sha('forged-config');
configForgery.modes.turbo.records[0] = sealRecord(forgedGenesis);
configForgery.modes.turbo.headHash = configForgery.modes.turbo.records[0].recordHash;
const resealedConfigForgery = sealRegistry(configForgery);
assert(validateRegistry(resealedConfigForgery, { configHistory: history })
  .some(error => /configAt inconsistent/.test(error)));

const tamperedState = JSON.parse(JSON.stringify(withAapl));
tamperedState.modes.turbo.records.at(-1).stateAfter.availableSlots = 99;
assert(validateRegistry(tamperedState, { configHistory: history })
  .some(error => /registryHash mismatch|recordHash mismatch|stateAfter inconsistent/.test(error)));

const changedPrefix = JSON.parse(JSON.stringify(withAapl));
changedPrefix.modes.turbo.records[0].decisionReason = 'rewritten_history';
assert.throws(() => assertAppendOnly(a, changedPrefix), /append-only prefix changed/);

// The checked-in genesis is the exact deterministic artifact tested above.
const checkedIn = loadRegistry(path.join(ROOT, 'data/capacity-ledger-v1.json'));
assert.deepStrictEqual(checkedIn, a);
assert.deepStrictEqual(validateRegistry(checkedIn, { configHistory: history }), []);

console.log('capacity ledger tests: PASS');
