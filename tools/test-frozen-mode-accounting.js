#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  CAPACITY_ACCOUNTING_POLICY,
  STATIC_CAPACITY_SCREEN_POLICY,
  capacityCertificationErrors,
  configAtDate,
  configHistoryCoverageErrors,
  computeStatsFromTrades,
  planFrozenAdvance,
  selectCapacityAcceptedTrades,
  summarizeLedgerAccounting,
} = require('./lib/mode-stats');
const {
  buildDtxForwardSnapshotFields,
  buildDtxReferenceSnapshot,
} = require('./lib/dtx-forward-snapshot');
const { computeEquityWindowStats, computeRollingEquityWindowStats } = require('./lib/equity-window-stats');
const {
  collectModes: collectTrackRecordModes,
  generate: generateTrackRecord,
} = require('./gen-track-record');

const ROOT = path.resolve(__dirname, '..');
const closed = (ticker, exitDate, pnlPct, extra = {}) => ({
  ticker,
  scanDate: '2026-08-25',
  entryDate: '2026-08-25',
  exitDate,
  actualEntry: 100,
  exitPrice: 100 + pnlPct,
  pnlPct,
  holdDays: 2,
  status: 'expired',
  ...extra,
});

const frozen = {
  trades: 1,
  returnTotal: 12,
  returnRealized: 10,
  returnUnrealized: 2,
  equityCurve: [
    { date: '2026-08-26', value: 110 },
    { date: '2026-08-27', value: 112 },
  ],
};
const first = closed('OLD', '2026-08-26', 10);
const sameDay = closed('SAME', '2026-08-27', 5, {
  scanDate: '2026-08-27', entryDate: '2026-08-27',
});

// Regression: equality is not "already integrated". The accounting cursor says
// one of the two resolved rows is missing, so only the provisional tail is replayed.
const sameDayPlan = planFrozenAdvance(frozen, [first, sameDay]);
assert.strictEqual(sameDayPlan.missingClosed.length, 1);
assert.strictEqual(sameDayPlan.replayTail, true);
assert.deepStrictEqual(sameDayPlan.priorEC, [{ date: '2026-08-26', value: 110 }]);

const sameDayStats = computeStatsFromTrades(
  [first, sameDay], 1, 1, 'fixture', undefined,
  { priorEC: sameDayPlan.priorEC, priceCache: {} }
);
assert.strictEqual(sameDayStats.trades, 2);
assert.strictEqual(sameDayStats.returnRealized, 15);
assert.strictEqual(sameDayStats.returnTotal, 15);
assert.deepStrictEqual(sameDayStats.equityCurve, [
  { date: '2026-08-26', value: 110 },
  { date: '2026-08-27', value: 115 },
]);

// A genuinely later close appends; it does not rewrite the existing tail.
const laterPlan = planFrozenAdvance(frozen, [first, closed('LATER', '2026-08-28', 5)]);
assert.strictEqual(laterPlan.replayTail, false);
assert.deepStrictEqual(laterPlan.priorEC, frozen.equityCurve);

// An open row makes the latest point provisional so its completed-close MtM can refresh.
const pendingPlan = planFrozenAdvance(
  { ...frozen, trades: 1 },
  [first, { ...closed('OPEN', null, 3), status: 'pending', exitDate: null }]
);
assert.strictEqual(pendingPlan.replayTail, true);
assert.strictEqual(pendingPlan.pending.length, 1);

// Before the next session opens there is no bar for the replayed calendar day.
// The append-only path must carry the latest certified close through the
// provisional tail instead of silently turning the open position's MtM to zero.
const pendingStats = computeStatsFromTrades(
  [first, { ...closed('OPEN', null, 4), status: 'pending', exitDate: null }],
  2, 1, 'fixture', undefined,
  {
    priorEC: [{ date: '2026-08-26', value: 105 }],
    priceCache: {
      OPEN: { '2026-08-26': { close: 104 } },
      OLD: { '2026-08-27': { close: 110 } },
    },
  }
);
assert.strictEqual(pendingStats.returnUnrealized, 2);
assert.deepStrictEqual(pendingStats.equityCurve.at(-1), { date: '2026-08-27', value: 107 });

assert.throws(
  () => planFrozenAdvance(frozen, [closed('TOO_OLD', '2026-08-25', 1), first]),
  /immutable prefix replay required/
);
assert.throws(
  () => planFrozenAdvance(frozen, [first, { ...sameDay, status: 'invented' }]),
  /unclassified trade status/
);

const accounting = summarizeLedgerAccounting(
  [first, { ...closed('OPEN', null, 4), status: 'pending', exitDate: null }],
  'fixture', {}, 0.5
);
assert.deepStrictEqual(accounting, {
  resolved: 1,
  pending: 1,
  realized: 5,
  unrealized: 2,
  total: 7,
  accountingPolicy: STATIC_CAPACITY_SCREEN_POLICY,
  raw: 2,
  rejectedCapacity: 0,
  maxConcurrent: 2,
});
assert.throws(
  () => summarizeLedgerAccounting([{ ...first, configVersion: 'missing' }], 'fixture', {}, 1),
  /unknown configVersion/
);

// Regression P0: a P1 portfolio cannot realize three independently simulated
// rows whose holding windows overlap. LLY occupies the slot throughout; NVDA
// and CAT are rejected deterministically, so their later closes never inflate
// return, WR or PF.
const overlapRows = [
  closed('LLY', '2026-06-16', 10, { scanDate: '2026-06-01', entryDate: '2026-06-02', score: 92 }),
  closed('NVDA', '2026-06-05', 50, { scanDate: '2026-06-02', entryDate: '2026-06-03', score: 99 }),
  closed('CAT', '2026-06-09', 50, { scanDate: '2026-06-04', entryDate: '2026-06-05', score: 98 }),
];
const acceptedP1 = selectCapacityAcceptedTrades(overlapRows, 'dynamic', {}, {
  portfolioSize: 1, positionSizePct: 1,
});
assert.deepStrictEqual(acceptedP1.accepted.map(t => t.ticker), ['LLY']);
assert.deepStrictEqual(acceptedP1.rejected.map(item => item.trade.ticker), ['NVDA', 'CAT']);
assert.strictEqual(acceptedP1.maxConcurrent, 1);
const overlapStats = computeStatsFromTrades(overlapRows, 1, 1, 'dynamic', undefined, {
  priceCache: {}, capacityScreen: true,
});
assert.strictEqual(overlapStats.accountingPolicy, STATIC_CAPACITY_SCREEN_POLICY);
assert.strictEqual(overlapStats.accountingCertified, false);
assert.strictEqual(overlapStats.trades, 1);
assert.strictEqual(overlapStats.returnRealized, 10);
assert.strictEqual(overlapStats.acceptedTradeRows, 1);
assert.strictEqual(overlapStats.rejectedCapacityRows, 2);

const weightedPfRows = [
  closed('WIN', '2026-06-03', 10, {
    scanDate: '2026-06-01', entryDate: '2026-06-02', configVersion: 'p1',
  }),
  closed('LOSS', '2026-06-05', -10, {
    scanDate: '2026-06-03', entryDate: '2026-06-04', configVersion: 'p2',
  }),
];
const weightedPf = computeStatsFromTrades(weightedPfRows, 2, 1, 'weighted', undefined, {
  priceCache: {},
  cfgVersions: {
    p1: { weighted: { portfolioSize: 1, positionSizePct: 1 } },
    p2: { weighted: { portfolioSize: 2, positionSizePct: 1 } },
  },
});
assert.strictEqual(weightedPf.returnRealized, 5);
assert.strictEqual(weightedPf.profitFactor, 2, 'PF must use the same historical weights as realized P&L');

// Publication certification is accepted only from a sealed capacity-at-entry
// ledger. A reconstructed regime label or a static greedy screen is not proof.
const HASH = `sha256:${'a'.repeat(64)}`;
const sealedRecord = {
  candidateId: '20260602-PROBE-1', entryDate: '2026-06-02', entryOrder: 0,
  configVersion: 'v1', configHash: HASH, configEffectiveDate: '2026-06-01',
  acceptedAtEntry: true, capacityAtEntry: 15, weightAtEntry: 1 / 15,
  rawRegime: 'risk_on', effectiveRegime: 'risk_on', regimeScore: 70,
  regimeSource: 'scanner/20260602/signals.json',
  riskState: { vixKill: false, drawdownBreaker: false, circuitBreaker: false },
  rotationState: 'none', cooldownState: 'clear', sectorState: 'clear',
  correlationState: 'clear', dedupState: 'clear', source: 'pit-ledger',
  sourceHash: HASH, stateHash: HASH,
};
const sealedArtifact = {
  accountingPolicy: CAPACITY_ACCOUNTING_POLICY,
  accountingCertified: true,
  rawTradeRows: 1,
  acceptedTradeRows: 1,
  capacityEvidence: {
    schema: 'capacity_at_entry_v1', sourceHash: HASH, ledgerHash: HASH,
    generatedAt: '2026-09-01T10:00:00.000Z', records: [sealedRecord],
  },
};
assert.deepStrictEqual(capacityCertificationErrors(sealedArtifact), []);
assert(capacityCertificationErrors({}).some(error => /capacityEvidence missing/.test(error)));
assert(capacityCertificationErrors({
  ...sealedArtifact,
  capacityEvidence: { ...sealedArtifact.capacityEvidence, records: [{ ...sealedRecord, regimeScore: null }] },
}).some(error => /regimeScore missing without regimeScoreNotApplicableReason/.test(error)));
assert.deepStrictEqual(capacityCertificationErrors({
  ...sealedArtifact,
  capacityEvidence: { ...sealedArtifact.capacityEvidence, records: [{
    ...sealedRecord,
    regimeScore: null,
    regimeScoreNotApplicableReason: 'mode config has no regime score override or regimeParams',
  }] },
}), [], 'an explicitly justified N/A regime score is valid and must not be fabricated as zero');
assert(capacityCertificationErrors({
  ...sealedArtifact,
  capacityEvidence: { ...sealedArtifact.capacityEvidence, sourceHash: 'untrusted' },
}).some(error => /sourceHash invalid/.test(error)));
assert(capacityCertificationErrors({
  ...sealedArtifact,
  capacityEvidence: { ...sealedArtifact.capacityEvidence, records: [{ ...sealedRecord, stateHash: null }] },
}).some(error => /stateHash invalid/.test(error)));

// A well-formed hash-shaped stamp is not enough: certification must bind every
// capacity decision to the version actually effective on its entry date.
const bindingHistory = { versions: [{
  id: 'v1', effectiveFrom: '2026-06-01', timestamp: '2026-06-01T00:00:00Z',
  config_sha256: HASH, config: { probe: { portfolioSize: 15 } },
}] };
assert.deepStrictEqual(
  capacityCertificationErrors(sealedArtifact, { configHistory: bindingHistory, modeId: 'probe' }),
  [],
  'sealed capacity evidence binds to configAtDate',
);
assert(capacityCertificationErrors({
  ...sealedArtifact,
  capacityEvidence: { ...sealedArtifact.capacityEvidence, records: [{ ...sealedRecord, configVersion: 'wrong' }] },
}, { configHistory: bindingHistory, modeId: 'probe' })
  .some(error => /configVersion does not match configAtDate/.test(error)));
assert(capacityCertificationErrors({
  ...sealedArtifact,
  capacityEvidence: { ...sealedArtifact.capacityEvidence, records: [{ ...sealedRecord, configHash: `sha256:${'b'.repeat(64)}` }] },
}, { configHistory: bindingHistory, modeId: 'probe' })
  .some(error => /configHash does not match configAtDate/.test(error)));
assert(capacityCertificationErrors({
  ...sealedArtifact,
  capacityEvidence: { ...sealedArtifact.capacityEvidence, records: [{ ...sealedRecord, configEffectiveDate: '2026-05-31' }] },
}, { configHistory: bindingHistory, modeId: 'probe' })
  .some(error => /configEffectiveDate does not match configAtDate/.test(error)));
assert(capacityCertificationErrors({
  ...sealedArtifact,
  capacityEvidence: { ...sealedArtifact.capacityEvidence, records: [{ ...sealedRecord, capacityAtEntry: 16 }] },
}, { configHistory: bindingHistory, modeId: 'probe' })
  .some(error => /capacityAtEntry exceeds historical nominal capacity/.test(error)));

const timelineFixture = { versions: [
  { id: 'v1', effectiveFrom: '2026-06-01', hash: 'h1', config: { pit: { portfolioSize: 15 } } },
  { id: 'v2', effectiveFrom: '2026-06-03', timestamp: '2026-06-02T22:00:00Z', hash: 'h2', config: { pit: { portfolioSize: 3 } } },
  { id: 'v3', effectiveFrom: '2026-06-03', timestamp: '2026-06-02T23:00:00Z', hash: 'h3', config: { pit: { portfolioSize: 0 } } },
] };
assert.strictEqual(configAtDate(timelineFixture, '2026-06-02', 'pit').versionId, 'v1');
assert.strictEqual(configAtDate(timelineFixture, '2026-06-03', 'pit').versionId, 'v3',
  'same-date transition resolves by the latest archived timestamp');
assert.throws(() => configAtDate(timelineFixture, '2026-05-31', 'pit'), /no effective config-history snapshot/);

const actualHistory = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/modes-config-history.json'), 'utf8'));
const actualConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/modes-config.json'), 'utf8'));
for (const version of actualHistory.versions) {
  const expectedConfigHash = `sha256:${crypto.createHash('sha256').update(JSON.stringify(version.config)).digest('hex')}`;
  assert.strictEqual(version.config_sha256_serialization, 'json_stringify_preserved_key_order_v1', `${version.id} hash serialization`);
  assert.strictEqual(version.config_sha256, expectedConfigHash, `${version.id} config_sha256 recompute`);
  assert.match(version.config_sha256, /^sha256:[0-9a-f]{64}$/, `${version.id} config_sha256 format`);
}
const historyCoverage = configHistoryCoverageErrors(
  actualHistory, actualConfig, ['turbo', 'dynamic', 'balanced', 'fortress'],
);
assert.deepStrictEqual(historyCoverage, [], 'current legacy config must be archived without drift');
assert.strictEqual(configAtDate(actualHistory, '2026-08-09', 'turbo').versionId, 'v10.9-20260723');
assert.strictEqual(configAtDate(actualHistory, '2026-08-09', 'turbo').config.horizon, 8);
assert.strictEqual(configAtDate(actualHistory, '2026-08-10', 'turbo').versionId, 'v10.10-20260810');
assert.strictEqual(configAtDate(actualHistory, '2026-08-10', 'turbo').config.horizon, 3);
assert.strictEqual(configAtDate(actualHistory, '2026-08-10', 'dynamic').config.breakevenPct, 0);
assert.strictEqual(configAtDate(actualHistory, '2026-08-10', 'balanced').config.horizon, 6);
assert.strictEqual(configAtDate(actualHistory, '2026-08-10', 'fortress').config.maxStopPct, 8);
assert.strictEqual(configAtDate(actualHistory, '2026-08-10', 'fortress').config.beGraceDays, 1);
assert.strictEqual(configAtDate(actualHistory, '2026-09-01', 'turbo').versionId, 'v11.0-20260901');
assert.match(configAtDate(actualHistory, '2026-09-01', 'turbo').configHash, /^sha256:[0-9a-f]{64}$/);
const augustLegacyNode = actualHistory.versions.find(version => version.id === 'v10.10-20260810');
assert.strictEqual(augustLegacyNode.source_commit, 'cf5196202e175b68de1d3662dc2fd09f0da277b9');
const legacyBestNode = actualHistory.versions.find(version => version.id === 'legacy_best-20260812');
assert(legacyBestNode, 'legacy Best lineage node must remain archived');
assert.strictEqual(legacyBestNode.source_commit, '4e371144f28c8cbe0401280d3a003362299f9ce9');
assert(legacyBestNode.lineage_commits.includes('4bae0f86e4992ac575c59c39c3dd43044b470003'));
assert.strictEqual(legacyBestNode.tradeLineage.rows, 6);
assert.strictEqual(legacyBestNode.tradeLineage.restamp, false);
assert.strictEqual(configAtDate(actualHistory, '2026-08-31', 'best').versionId, 'legacy_best-20260812');
assert.strictEqual(configAtDate(actualHistory, '2026-09-01', 'best').versionId, 'v11.0-20260901');
assert.notStrictEqual(
  configAtDate(actualHistory, '2026-08-31', 'best').config.label,
  configAtDate(actualHistory, '2026-09-01', 'best').config.label,
  'legacy Best and DTX Max identities must never be relabelled into one product',
);
const currentTimelineNode = actualHistory.versions.find(version => version.id === 'v11.0-20260901');
const currentConfigFileHash = `sha256:${crypto.createHash('sha256')
  .update(fs.readFileSync(path.join(ROOT, 'data/modes-config.json'))).digest('hex')}`;
assert.strictEqual(currentTimelineNode.generated_from, 'data/modes-config.json');
assert.strictEqual(currentTimelineNode.source_worktree_sha256, currentConfigFileHash);
assert.strictEqual(actualConfig._prevVersion, 'v10.10-20260810');

// Scope contract: these four records are generated by simulatePortfolio/backtest,
// not a broker ledger, and all public code must preserve that distinction.
const modes = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/modes-config.json'), 'utf8')).modes;
for (const id of ['turbo', 'dynamic', 'balanced', 'fortress']) {
  assert.strictEqual(modes[id].performanceScope, 'simulated_backtest', `${id} performance scope`);
}
assert.strictEqual(modes.best.performanceScope, 'forward_execution', 'DTX performance scope');

// The public track-record must consume the same fail-closed certification
// boundary as scanner/status and portfolio/v1. Old frozen numbers are useful
// diagnostics, but must not reach HTML, chart payloads or JSON summaries.
const trackModes = Object.fromEntries(collectTrackRecordModes().map(mode => [mode.id, mode]));
for (const id of ['turbo', 'dynamic', 'balanced', 'fortress']) {
  const mode = trackModes[id];
  assert(mode, `${id} track-record row`);
  assert.strictEqual(mode.performanceScope, 'simulated_backtest');
  assert.strictEqual(mode.sealed, false, `${id} uncertified frozen must stay masked`);
  assert.strictEqual(mode.performanceUnavailable, true, `${id} explicit unavailable state`);
  assert(mode.certificationErrors.length > 0, `${id} structured certification errors`);
  assert.deepStrictEqual(mode.stats, {
    ret: null, dd: null, wr: null, pf: null, trades: null, sharpe: null, calmar: null,
  }, `${id} no frozen metric leaks`);
  assert.deepStrictEqual(mode.curve, [], `${id} no frozen curve leaks`);
  assert.strictEqual(mode.oos, null, `${id} no frozen OOS leaks`);
  assert.strictEqual(mode.periodStart, null, `${id} no frozen period leaks`);
  assert.strictEqual(mode.periodEnd, null, `${id} no frozen period leaks`);
}
assert.strictEqual(trackModes.best.performanceScope, 'forward_execution');
assert.strictEqual(trackModes.best.sealed, false);
assert.strictEqual(trackModes.best.performanceUnavailable, false);
assert.strictEqual(trackModes.best.trackingNotStarted, true);
assert.strictEqual(trackModes.best.stats.ret, null, 'DTX reference replay is not a forward return');
assert.strictEqual(trackModes.best.stats.trades, 0, 'explicit forward executed-trade count is preserved');
assert.deepStrictEqual(trackModes.best.curve, [], 'DTX reference curve is not a forward curve');

const trackTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dtx-track-record-'));
try {
  const trackOut = path.join(trackTmp, 'index.html');
  const trackSummary = generateTrackRecord({ out: trackOut });
  const trackHTML = fs.readFileSync(trackOut, 'utf8');
  assert.strictEqual(trackSummary.sealed, 0);
  assert(trackSummary.detail.every(row => row.ret === null && row.asOf === null));
  assert.strictEqual((trackHTML.match(/class="tr-metric-value[^"]*">—/g) || []).length, 25,
    'five masked metrics for each of five public modes');
  assert.match(trackHTML, /Forward certifié · historique retiré/);
  assert.match(trackHTML, /data-forward-capacity-certified="true"/);
  assert.match(trackHTML, /Suivi réel non démarré/);
  assert.match(trackHTML, /data-performance-scope="simulated_backtest" data-accounting-certified="false"/);
  assert.match(trackHTML, /data-performance-scope="forward_execution" data-accounting-certified="false"/);
  assert.match(trackHTML, /var CURVES = \[\];/);
  for (const stale of ['99,25 %', '59,19 %', '55,02 %', '20,24 %', '3588,72', '3588.72']) {
    assert(!trackHTML.includes(stale), `track-record must not expose stale/reference value ${stale}`);
  }
} finally {
  fs.rmSync(trackTmp, { recursive: true, force: true });
}

// Risk snapshots derived from stale/uncertified positions must not leak through
// aggregate endpoints after the dedicated risk endpoint has correctly failed closed.
const publicModes = JSON.parse(fs.readFileSync(path.join(ROOT, 'portfolio/v1/modes.json'), 'utf8')).modes;
for (const id of ['turbo', 'dynamic', 'balanced', 'fortress']) {
  const allEndpoint = JSON.parse(fs.readFileSync(path.join(ROOT, `portfolio/v1/${id}/all.json`), 'utf8'));
  const modeEndpoint = publicModes.find(mode => mode.id === id);
  const streakEndpoint = JSON.parse(fs.readFileSync(path.join(ROOT, `portfolio/v1/${id}/winning-streaks.json`), 'utf8'));
  assert.strictEqual(allEndpoint.risk, null, `${id} all.json simulated risk must be null`);
  assert(modeEndpoint, `${id} modes.json row`);
  assert.strictEqual(modeEndpoint.risk, null, `${id} modes.json simulated risk must be null`);
  assert.strictEqual(streakEndpoint.scope, 'simulated_backtest', `${id} streak scope`);
  assert.strictEqual(streakEndpoint.status, 'unavailable', `${id} streak status`);
  assert.strictEqual(streakEndpoint.execution_verified, false, `${id} streak execution evidence`);
  assert.strictEqual(streakEndpoint.winRate, null, `${id} streak metrics must be masked`);
}

const publicConfigHistory = JSON.parse(fs.readFileSync(path.join(ROOT, 'portfolio/v1/config-history.json'), 'utf8'));
assert.strictEqual(publicConfigHistory.versions.length, actualHistory.versions.length, 'public config timeline coverage');
const publicV1010 = publicConfigHistory.versions.find(version => version.id === 'v10.10-20260810');
assert.strictEqual(publicV1010.effectiveFrom, '2026-08-10');
assert.strictEqual(publicV1010.config_sha256, augustLegacyNode.config_sha256);
assert.strictEqual(publicV1010.source_commit, augustLegacyNode.source_commit);
const publicLegacyBest = publicConfigHistory.versions.find(version => version.id === 'legacy_best-20260812');
assert.strictEqual(publicLegacyBest.tradeLineage.rows, 6);
assert.strictEqual(publicLegacyBest.tradeLineage.restamp, false);
assert(publicLegacyBest.productIdentity, 'public config timeline preserves the legacy Best identity boundary');

// Keep this unit test independent from the mutable backtest runtime artifact.
// The production file is refreshed out-of-band and intentionally is not part
// of the release commit; reading it here made CI depend on the operator's local
// refresh state. These compact curves preserve the same 66-session window,
// return and drawdown regression without coupling the harness to live data.
const windowDates = [];
for (let cursor = new Date('2026-06-01T12:00:00Z'); cursor <= new Date('2026-08-31T12:00:00Z'); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
  const weekday = cursor.getUTCDay();
  if (weekday !== 0 && weekday !== 6) windowDates.push(cursor.toISOString().slice(0, 10));
}
assert.strictEqual(windowDates.length, 66, 'fixture covers 66 weekday sessions');

const expectedRecent = {
  turbo: { ret: 0.62, dd: -9.48 },
  dynamic: { ret: -10.84, dd: -19.72 },
  balanced: { ret: -3.91, dd: -13.35 },
  fortress: { ret: -2.70, dd: -4.43 },
};
for (const [id, expected] of Object.entries(expectedRecent)) {
  const curve = [
    { date: '2026-05-29', value: 100 },
    ...windowDates.map((date, index) => ({
      date,
      value: index === 1
        ? 100 + expected.dd
        : index === windowDates.length - 1 ? 100 + expected.ret : 100,
    })),
  ];
  const recent = computeEquityWindowStats(
    curve,
    '2026-06-01',
    '2026-08-31',
  );
  assert.strictEqual(recent.ret, expected.ret, `${id} 90-day simulated return`);
  assert.strictEqual(recent.dd, expected.dd, `${id} 90-day simulated drawdown`);
  assert.strictEqual(recent.sessions, 66, `${id} 90-day sessions`);
  assert.strictEqual(recent.baselineDate, '2026-05-29', `${id} 90-day baseline close`);
}

const windowFixture = computeEquityWindowStats([
  { date: '2026-05-29', value: 100 },
  { date: '2026-06-01', value: 110 },
  { date: '2026-06-02', value: 99 },
], '2026-06-01', '2026-06-02');
assert.deepStrictEqual(windowFixture, {
  baselineDate: '2026-05-29', from: '2026-06-01', to: '2026-06-02',
  sessions: 2, ret: -1, dd: -10,
});
const rollingFixture = computeRollingEquityWindowStats([
  { date: '2026-05-31', value: 100 },
  { date: '2026-06-01', value: 105 },
  { date: '2026-08-31', value: 110 },
], '2026-08-31', 92);
assert.strictEqual(rollingFixture.baselineDate, '2026-05-31');
assert.strictEqual(rollingFixture.asOf, '2026-08-31');
assert.strictEqual(rollingFixture.rollingCalendarDays, 92);

// Replay poison may be present for the reference card, but it must never leak
// into Time Machine's generic forward fields.
const dtxForward = buildDtxForwardSnapshotFields({
  assetClass: 'dtx',
  forwardTracking: { status: 'not_started', executedTrades: 0 },
  referenceStats: { ret: 999999 },
});
assert.strictEqual(dtxForward.stats.scope, 'forward_execution');
assert.strictEqual(dtxForward.stats.status, 'not_started');
assert.strictEqual(dtxForward.stats.ret, null);
assert.strictEqual(dtxForward.stats.dd, null);
assert.strictEqual(dtxForward.stats.trades, 0);
assert.deepStrictEqual(dtxForward.equity, {
  d: [], v: [], scope: 'forward_execution', status: 'not_started',
});
for (const key of ['signals', 'positions', 'orders', 'closeNow', 'expiresTomorrow', 'closedTrades']) {
  assert.deepStrictEqual(dtxForward[key], [], `DTX ${key} must be forward-empty`);
}
assert.doesNotMatch(JSON.stringify(dtxForward), /999999/);
const dtxReference = buildDtxReferenceSnapshot(
  { referenceDataAsOf: '2026-08-31' },
  { ret: 999999, trades: 561 },
  { d: ['2026-08-31'], v: [999999] },
);
assert.strictEqual(dtxReference.scope, 'reference_backtest');
assert.strictEqual(dtxReference.stats.ret, 999999);
assert.deepStrictEqual(dtxReference.equity.d, ['2026-08-31']);
assert.strictEqual(buildDtxReferenceSnapshot({}, null, null).status, 'unavailable');

const sweepSource = fs.readFileSync(path.join(ROOT, 'tools/sweep.js'), 'utf8');
assert.match(sweepSource, /cfg\.assetClass === 'dtx'[\s\S]{0,500}broker-certified fills required/);
assert.match(sweepSource, /planFrozenAdvance\(existingFrozen, accountingTrades\)/);
assert.match(sweepSource, /ACCOUNTING BLOCKED — PIT capacity evidence missing; static screen finds/);
assert.match(sweepSource, /output\[`frozen_\$\{id\}`\] = existingFrozen;[\s\S]{0,600}no rebaseline performed/,
  'uncertified static overlap screen preserves the old artifact and never rebaselines it');

const statusSource = fs.readFileSync(path.join(ROOT, 'tools/gen-status-page.js'), 'utf8');
const trackerStart = statusSource.indexOf('// ── Signal Live Tracker v2');
const trackerEnd = statusSource.indexOf('// ── Position Live MtM', trackerStart);
assert.ok(trackerStart >= 0 && trackerEnd > trackerStart, 'signal tracker source found');
const tracker = statusSource.slice(trackerStart, trackerEnd);
assert.match(tracker, /mode-panel\[data-execution-verified="true"\][^\n]*\)\)return/,
  'signal tracker is inert when no panel has broker execution evidence');
const rowLoop = tracker.indexOf("rows.forEach(function(row)");
const dtxRowGuard = tracker.indexOf("ownerPanel.dataset.executionVerified!=='true'", rowLoop);
const evalCall = tracker.indexOf('evalSignal(q,entry,stop,tp1,tp2,vwap,_rcur)', rowLoop);
assert.ok(rowLoop >= 0 && dtxRowGuard > rowLoop && dtxRowGuard < evalCall,
  'unverified rows are rejected before OHLC can synthesize a fill');
assert.match(tracker, /ownerPanel=r\.closest\('\.mode-panel'\);[\s\S]{0,220}executionVerified!=='true'\)return;[\s\S]{0,180}var t=r\.dataset\.sigTicker/);
assert.doesNotMatch(tracker, /Live Execution Sim/);

const mtm = statusSource.slice(trackerEnd);
assert.match(mtm, /panel\.dataset\.executionVerified!=='true'\)return;/,
  'unverified positions are rejected by the generic OHLC MtM updater');
assert.match(statusSource, /Rendement simulé/);
assert.match(statusSource, /Positions simulées ouvertes/);
assert.match(statusSource, /90 jours simulés/);
assert.match(statusSource, /data-section="performance-unavailable"[\s\S]{0,900}Suivi point-in-time remis à zéro/);
assert.match(statusSource, /data-forward-capacity-certified/);
assert.match(statusSource, /id="mpCount">0\/\$\{Object\.keys\(modes\)\.length\}/,
  'mode picker total must be derived from the rendered mode catalogue');
assert.doesNotMatch(statusSource, /id="mpCount">0\/6/);
assert.match(statusSource, /m\.performanceSuppressed \? `<div class="section-card"[\s\S]{0,3200}: `<div class="perf-hero"/,
  'suppressed legacy performance renders a replacement state, never the null hero/chart');
assert.match(statusSource, /if \(simulatedScope\) return `<div class="section-card" data-section="simulation-ideas"/,
  'simulated panels do not render action orders');
assert.doesNotMatch(statusSource, /Never hold fewer than|Consider adding defensive ETFs/);
assert.match(statusSource, /assetBuckets\.llm\.every\(\(\[, mode\]\) => mode\.cfg\.performanceScope === 'simulated_backtest'\)[\s\S]{0,80}\? 'Simulations éditoriales'/);
assert.match(statusSource, /const _sigStatusLabel = simulatedScope\s*\? 'SIGNAL'/,
  'simulated candidates use SIGNAL, never an execution-like LIVE badge');
assert.match(statusSource, /const performanceScope = cfg\.assetClass === 'dtx'[\s\S]{0,100}\? DTX_FORWARD_SCOPE/,
  'DTX panel resolves the forward_execution scope');
assert.match(statusSource, /data-performance-scope="\$\{htmlText\(performanceScope\)\}"/,
  'DTX panel declares forward_execution scope');
assert.match(statusSource, /d\.stats&&d\.stats\.scope==='forward_execution'/,
  'Time Machine rejects legacy DTX replay stats in forward slots');
assert.match(statusSource, /trustedEquity=!isDtx\|\|\(d\.equity&&d\.equity\.scope==='forward_execution'\)/,
  'Time Machine rejects legacy DTX replay equity in forward slots');
assert.match(statusSource, /buildDtxForwardSnapshotFields\(cfg\)/,
  'snapshot generator uses the DTX forward-only schema');
assert.match(statusSource, /reference: isDtxSnapshot \? buildDtxReferenceSnapshot/,
  'DTX replay evidence is namespaced under reference');
assert.match(statusSource, /if \(!modeCfg \|\| modeCfg\.assetClass !== 'dtx'\) continue;/,
  'public engine history must allow-list only currently configured DTX identities');
assert.match(statusSource, /const \{ generate: genTrackRecord \} = require\('\.\/gen-track-record\.js'\);[\s\S]{0,180}const tr = genTrackRecord\(\);/,
  'status generation must synchronously regenerate the fail-closed track record');
assert.doesNotMatch(statusSource, /track record non régénéré/,
  'a stale public track record must not survive a generation failure');
const backfillAttempt = spawnSync(process.execPath, ['tools/gen-status-page.js', '--backfill'], {
  cwd: ROOT,
  encoding: 'utf8',
});
assert.notStrictEqual(backfillAttempt.status, 0, 'unsafe history backfill must fail closed');
assert.match(`${backfillAttempt.stdout}\n${backfillAttempt.stderr}`, /point-in-time config and ledger evidence are required/);

const apiSource = fs.readFileSync(path.join(ROOT, 'tools/gen-api.js'), 'utf8');
assert.match(apiSource, /performanceScope === 'simulated_backtest'/);
assert.match(apiSource, /status\.tradingMode = 'simulated'/);
assert.match(apiSource, /const positions = isEngineMode \|\| _isSimulated \? \[\]/);
assert.match(apiSource, /const closedTradesSrc = isEngineMode \|\| _isSimulated/);
assert.match(apiSource, /const modeOrders = \(_isSimulated \|\|/);
assert.match(apiSource, /allocPct: isEngineMode \? null : allocPct/,
  'DTX engine sizing must never be exposed as an equal-weight scanner allocation');
assert.match(apiSource, /publicStatusReason\(m\)/,
  'public mode status reasons must not leak uncertified optimization metrics');
assert.match(apiSource, /sanitizePublicMetadata\(_apiDecisionProvenance\)/,
  'public DTX provenance must remove request/run/intent identifiers');
assert.match(apiSource, /regimeLabel: getGlobalRegime\(\)\.currentState \|\| null/,
  'public current regime label must come from the current regime snapshot');
assert.doesNotMatch(apiSource, /regimeLabel: modesConfigMeta\.regime/,
  'versioned config regime must not masquerade as the current public regime');
assert.match(statusSource, /sanitizePublicRegimeProbability\(snap\.regimeProbability \|\| null\)/,
  'status history must neutralize connector provenance on regime context');
for (const field of ['partialTPPct', 'partialTPGain', 'disableTP2']) {
  assert.match(statusSource, new RegExp(`${field}: cfg\\.${field}`), `snapshot propagates ${field}`);
  assert.match(apiSource, new RegExp(`${field}: cfg\\.${field}`), `API propagates ${field}`);
}

const liveUiSource = fs.readFileSync(path.join(ROOT, 'assets/live-engine-ui.js'), 'utf8');
assert.match(liveUiSource, /data-performance-scope/);
assert.match(liveUiSource, /Portefeuille simulé/);
assert.match(liveUiSource, /MtM simulé/);

console.log('frozen mode accounting tests: PASS');
