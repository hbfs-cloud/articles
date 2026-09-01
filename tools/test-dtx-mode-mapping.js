#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const scan = require('./dtx-scan');
const bridge = require('./dtx-pool-bridge');
const history = require('./lib/dtx-engine-history');
const modesConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'modes-config.json'), 'utf8'));
const publicMode = 'best';
const enginePortfolio = String(modesConfig.modes[publicMode].dtxPortfolio || publicMode);

assert.strictEqual(scan.dtxPortfolioForMode(publicMode), enginePortfolio);
assert.strictEqual(scan.publicModeForPortfolio(enginePortfolio), publicMode);
assert(scan.SCRIPTED_MODES.includes(publicMode), 'public mode must remain wired');
assert(!scan.SCRIPTED_MODES.includes(enginePortfolio), 'engine portfolio must not become a public mode');
assert.strictEqual(scan.stagingPathFor(publicMode), path.join(ROOT, 'data', 'dtx', `${publicMode}.json`));
assert.strictEqual(scan.stagingPathFor(enginePortfolio), path.join(ROOT, 'data', 'dtx', `${publicMode}.json`));
assert.deepStrictEqual(
  bridge.scriptedModes().find(binding => binding.modeId === publicMode),
  {
    modeId: publicMode,
    portfolioId: enginePortfolio,
    configHash: modesConfig.modes[publicMode].dtxConfigHash,
    forwardSource: 'no_certified_fill_yet',
  },
);

const decideEnvelope = JSON.parse(fs.readFileSync(path.join(ROOT, 'scanner', '20260831', '_dtx', 'decide_best.json'), 'utf8'));
const decision = structuredClone(decideEnvelope.result || decideEnvelope);
decision.strategy_id = enginePortfolio;
decision.config_hash = modesConfig.modes[publicMode].dtxConfigHash || 'sha256:test-engine-config';
decision.expected_data_date = decision.requested_asof;
decision.data_asof = decision.requested_asof;
for (const group of decision.execution_plan.groups) {
  for (const candidate of group.candidates) candidate.strategy_id = enginePortfolio;
}
const staging = scan.buildStaging({
  modeInfo: { id: enginePortfolio, name: enginePortfolio, path: null },
  cfg: { id: enginePortfolio, name: enginePortfolio, currency: 'USD', initial_capital: 100000 },
  asof: '2026-09-01', decisionAsOf: decision.requested_asof,
  currency: 'USD', decision, metrics: null, equity: null, replayErr: null,
  engineLabel: 'test', engineMode: 'mcp', t0: Date.now(),
});
assert.strictEqual(staging.mode, publicMode, 'staging must retain the public mode id');
assert.strictEqual(staging.portfolioId, enginePortfolio, 'staging must retain the engine portfolio identity');
assert.strictEqual(staging.configHash, decision.config_hash, 'staging must bind the exact engine config hash');
assert.strictEqual(staging.asof, '2026-09-01', 'staging asof must remain the public scanner session');
assert.strictEqual(staging.decisionAsOf, decision.requested_asof, 'decision close must remain distinct from the public session');
assert(staging.orders.every(order => order.universe == null), 'orders must not invent an engine universe');
const incompleteDecision = structuredClone(decision);
delete incompleteDecision.execution_plan.groups[0].candidates[0].strategy_id;
assert.throws(() => scan.buildStaging({
  modeInfo: { id: enginePortfolio, name: enginePortfolio, path: null },
  cfg: { id: enginePortfolio, name: enginePortfolio, currency: 'USD', initial_capital: 100000 },
  asof: '2026-09-01', decisionAsOf: incompleteDecision.requested_asof,
  currency: 'USD', decision: incompleteDecision, metrics: null, equity: null, replayErr: null,
  engineLabel: 'test', engineMode: 'mcp', t0: Date.now(),
}), /strategy_id/, 'every Contract V2 candidate must prove the configured engine identity');
assert.throws(() => scan.buildStaging({
  modeInfo: { id: publicMode, name: publicMode, path: null },
  cfg: { id: publicMode, name: publicMode, currency: 'USD', initial_capital: 100000 },
  asof: '2026-09-01', decisionAsOf: decision.requested_asof,
  currency: 'USD', decision, metrics: null, equity: null, replayErr: null,
  engineLabel: 'test', engineMode: 'mcp', t0: Date.now(),
}), /portfolio mapping mismatch/, 'collector must call the configured engine portfolio, not the public alias');
const wrongConfigDecision = { ...decision, config_hash: 'sha256:wrong' };
assert.throws(() => scan.buildStaging({
  modeInfo: { id: enginePortfolio, name: enginePortfolio, path: null },
  cfg: { id: enginePortfolio, name: enginePortfolio, currency: 'USD', initial_capital: 100000 },
  asof: '2026-09-01', decisionAsOf: wrongConfigDecision.requested_asof,
  currency: 'USD', decision: wrongConfigDecision, metrics: null, equity: null, replayErr: null,
  engineLabel: 'test', engineMode: 'mcp', t0: Date.now(),
}), /config_hash=.*!=/, 'same portfolio id with a different engine config hash must fail closed');

const snapshot = {
  mode: publicMode,
  portfolioId: enginePortfolio,
  configHash: modesConfig.modes[publicMode].dtxConfigHash,
  asof: '2026-09-01',
  decisionAsOf: '2026-08-31',
  generatedAt: '2026-09-01T01:00:00Z',
  engineMode: 'mcp',
  orders: [],
  decisionProvenance: {
    contractVersion: '2.0', requestedAsOf: '2026-08-31', expectedDataDate: '2026-08-31',
    dataAsOf: '2026-08-31', requestId: 'request', runId: 'run', callId: 'call', planId: 'plan',
  },
};
assert.deepStrictEqual(scan.stagingSnapshotErrors(snapshot, enginePortfolio, {
  publicModeId: publicMode, todayIso: '2026-09-01', scanDateIso: '2026-09-01', expectedClose: '2026-08-31',
}), []);
const wrongEngineSnapshot = { ...snapshot, portfolioId: publicMode };
assert(scan.stagingSnapshotErrors(wrongEngineSnapshot, enginePortfolio, {
  publicModeId: publicMode, todayIso: '2026-09-01', scanDateIso: '2026-09-01', expectedClose: '2026-08-31',
}).some(error => error.includes(`!= ${enginePortfolio}`)));
const wrongHashSnapshot = { ...snapshot, configHash: 'sha256:wrong' };
assert(scan.stagingSnapshotErrors(wrongHashSnapshot, enginePortfolio, {
  publicModeId: publicMode, todayIso: '2026-09-01', scanDateIso: '2026-09-01', expectedClose: '2026-08-31',
}).some(error => error.includes('configHash')));

const historyStore = { modes: {} };
history.append({ ...snapshot, orders: [] }, { store: historyStore });
assert(history.asOf(publicMode, '2026-09-01', historyStore, enginePortfolio,
  modesConfig.modes[publicMode].dtxConfigHash), 'matching portfolio+hash history must remain readable');
assert.strictEqual(history.asOf(publicMode, '2026-09-01', historyStore, enginePortfolio,
  'sha256:wrong'), null, 'history from another config hash must fail closed');
const statusSource = fs.readFileSync(path.join(ROOT, 'tools', 'gen-status-page.js'), 'utf8');
assert.match(statusSource, /data\.configHash !== binding\.configHash/,
  'dashboard staging consumer must bind the configured engine hash');
assert.match(statusSource, /dxh\.asOf\(id, todayISO, _dxhStore, cfg\.dtxPortfolio \|\| id, cfg\.dtxConfigHash \|\| null\)/,
  'dashboard history consumer must bind portfolio and config hash');

// Exercise gen-api in a minimal isolated repository. This proves that it reads
// staging by PUBLIC filename while binding both orders and metrics to the ENGINE
// identity. A stale decision/staging from the former `best` engine must emit neither.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dtx-mode-map-'));
try {
  for (const dir of [
    'tools/lib', 'data/dtx', 'scanner/status/history', 'portfolio/v1',
  ]) fs.mkdirSync(path.join(tmp, dir), { recursive: true });
  for (const rel of [
    'tools/gen-api.js', 'tools/dtx-pool-bridge.js',
    'tools/lib/mode-status.js', 'tools/lib/dtx-plan-window.js',
    'tools/lib/public-sanitize.js', 'tools/lib/public-scanner-history.js',
  ]) {
    fs.copyFileSync(path.join(ROOT, rel), path.join(tmp, rel));
  }
  const fixtureConfig = {
    _version: 'test',
    modes: {
      [publicMode]: {
        status: 'live', statusSince: '2026-09-01T00:00:00Z', assetClass: 'dtx',
        dtxPortfolio: enginePortfolio, dtxConfigHash: modesConfig.modes[publicMode].dtxConfigHash,
        vwapGate: true, entryModel: 'dtx_contract_v2', signalOrigin: 'engine',
        portfolioSize: 1,
        forwardTracking: {
          status: 'not_started', since: '2026-09-01', source: 'no_certified_broker_ledger',
          executedTrades: 0, openPositions: null,
        },
      },
    },
  };
  fs.writeFileSync(path.join(tmp, 'data', 'modes-config.json'), JSON.stringify(fixtureConfig));
  fs.writeFileSync(path.join(tmp, 'data', 'capacity-ledger-v1.json'), JSON.stringify({
    boundary: {
      session: '2026-09-01', effectiveAt: '2026-09-01T11:10:46.000Z',
      preBoundary: { reasonCode: 'historical_capacity_at_entry_unrecoverable' },
    },
  }));
  const provenance = {
    contractVersion: '2.0', requestId: 'request', runId: 'run', callId: 'call', planId: 'plan',
    planRevision: 1, validFrom: '2020-01-01T00:00:00Z', validUntil: '2099-01-01T00:00:00Z',
  };
  const engineDecision = {
    portfolioId: enginePortfolio, configHash: modesConfig.modes[publicMode].dtxConfigHash,
    asof: '2026-09-01', generatedAt: '2026-09-01T12:00:00.000Z', engineMode: 'mcp', decisionProvenance: provenance,
    executionPlan: { groups: [{ candidates: [{ strategy_id: enginePortfolio }] }] },
    orders: [{ symbol: 'AAPL', side: 'BUY', qty: 2, limitPrice: 100, stopLoss: 90 }],
  };
  const statusFixture = {
    date: '2026-09-01', scanDir: '20260901',
    modes: {
      [publicMode]: {
        config: { label: 'DTX', portfolioSize: 1 }, stats: {}, equity: {}, positions: [],
        signals: [], closedTrades: [], closeNow: [], expiresTomorrow: [], engine_decision: engineDecision,
      },
    },
  };
  const statusPath = path.join(tmp, 'scanner', 'status', 'history', '20260901.json');
  fs.writeFileSync(statusPath, JSON.stringify(statusFixture));
  fs.writeFileSync(path.join(tmp, 'data', 'dtx', `${publicMode}.json`), JSON.stringify({
    mode: publicMode, portfolioId: enginePortfolio,
    configHash: modesConfig.modes[publicMode].dtxConfigHash, asof: '2026-09-01',
    generatedAt: '2026-09-01T12:00:00.000Z',
    metricsSource: 'mcp_replay', equityResolution: 'replay', metrics: {
      strategy: enginePortfolio, replay_scope: 'single_strategy',
      equity_scope: 'equity_full', equity_resolution: 'daily',
      from: '2021-01-01', to: '2026-08-31', total_trades: 12,
      profit_factor: 1.84, sortino: 4.06, calmar: 3.47, avg_exposure_pct: 31.53,
      annualized_vol_pct: 29.9, daily_var_95_pct: 2.52, daily_cvar_95_pct: 3.8,
      ulcer_index: 9.67, max_underwater_sessions: 197,
    },
    equity: { dates: ['2026-08-31', '2026-09-01'], values: [100, 101] },
    decisionProvenance: provenance,
    executionPlan: engineDecision.executionPlan,
    orders: engineDecision.orders,
  }));
  let result = spawnSync(process.execPath, ['tools/gen-api.js'], { cwd: tmp, encoding: 'utf8' });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  let apiOrders = JSON.parse(fs.readFileSync(path.join(tmp, 'portfolio', 'v1', publicMode, 'orders.json'), 'utf8'));
  let apiEquity = JSON.parse(fs.readFileSync(path.join(tmp, 'portfolio', 'v1', publicMode, 'equity.json'), 'utf8'));
  const apiStreaks = JSON.parse(fs.readFileSync(path.join(tmp, 'portfolio', 'v1', publicMode, 'winning-streaks.json'), 'utf8'));
  let apiModeSummary = JSON.parse(fs.readFileSync(path.join(tmp, 'portfolio', 'v1', 'modes.json'), 'utf8')).modes[0];
  assert.strictEqual(apiOrders.mode, publicMode);
  assert.strictEqual(apiOrders.enginePortfolio, enginePortfolio);
  assert.strictEqual(apiOrders.engineConfigHash, modesConfig.modes[publicMode].dtxConfigHash);
  assert.strictEqual(apiOrders.orders.length, 0, 'a DTX decision must never be exposed as an executed/current order');
  assert.strictEqual(apiOrders.execution_verified, false);
  assert.strictEqual(apiOrders.status.tradingMode, 'forward_execution');
  assert.strictEqual(apiOrders.status.performanceScope, 'forward_execution');
  assert.strictEqual(apiOrders.status.execution_verified, false);
  assert.strictEqual(apiOrders.plannedOrders.length, 1);
  assert.strictEqual(apiOrders.plannedOrders[0].order_state, 'planned');
  assert.strictEqual(apiOrders.plannedOrders[0].execution_verified, false);
  assert.strictEqual(apiOrders.plannedOrders[0].fill_verified, false);
  assert.strictEqual(apiOrders.planningCertification.status, 'certified_forward_proposal');
  assert.strictEqual(apiOrders.planningCertification.capacityAtEntryCertified, true);
  assert.strictEqual(apiStreaks.scope, 'forward_execution');
  assert.strictEqual(apiStreaks.execution_verified, false);
  assert.strictEqual(apiStreaks.winRate, null, 'a DTX decision cannot manufacture forward streak metrics');
  assert.strictEqual(apiEquity.enginePortfolio, enginePortfolio);
  assert.strictEqual(apiEquity.engineBacktest.portfolio, enginePortfolio);
  assert.strictEqual(apiEquity.engineBacktest.replay_scope, 'single_strategy');
  assert.strictEqual(apiEquity.engineBacktest.profit_factor, 1.84);
  assert.strictEqual(apiEquity.engineBacktest.sortino, 4.06);
  assert.match(apiEquity.engineBacktest.source, /replay exact/i);
  assert.strictEqual(apiEquity.engineBacktest.metrics_source, 'exact_reference_replay');
  assert.strictEqual(apiEquity.engineBacktest.curve_resolution, 'daily');
  assert.strictEqual(apiEquity.engineBacktest.equity_scope, 'equity_full');
  assert.strictEqual(apiEquity.reliability.scope, 'forward_execution');
  assert.strictEqual(apiEquity.reliability.status, 'not_started');
  assert.strictEqual(apiEquity.reliability.closed_trades, 0);
  assert.deepStrictEqual(apiEquity.equityCurve.d, []);
  assert.deepStrictEqual(apiEquity.equityCurve.v, []);
  assert.strictEqual(apiEquity.stats.scope, 'forward_execution');
  assert.strictEqual(apiEquity.stats.ret, null);
  assert.strictEqual(apiEquity.stats.dd, null);
  assert.strictEqual(apiEquity.engineBacktest.reliability.scope, 'reference_backtest');
  assert.strictEqual(apiEquity.engineBacktest.reliability.sample_period_start, '2021-01-01');
  assert.strictEqual(apiEquity.engineBacktest.reliability.sample_period_end, '2026-08-31');
  assert.strictEqual(apiEquity.engineBacktest.reliability.closed_trades, 12);
  assert(!apiEquity.engineBacktest.reliability.warnings.some(warning => warning.includes('2026-02-26')));
  assert.deepStrictEqual(apiEquity.forwardTracking, fixtureConfig.modes[publicMode].forwardTracking);
  assert.strictEqual(apiModeSummary.enginePortfolio, enginePortfolio);
  assert.strictEqual(apiModeSummary.statsScope, 'forward_execution');
  assert.strictEqual(apiModeSummary.stats.ret, null);
  assert.strictEqual(apiModeSummary.stats.dd, null);
  assert.strictEqual(apiModeSummary.plannedOrderCount, 1);
  assert.strictEqual(apiModeSummary.orderCount, 0);
  assert.strictEqual(apiModeSummary.positionCount, null);
  assert.strictEqual(apiModeSummary.slotsAvailable, null);
  assert.strictEqual(apiModeSummary.vwapGate, true);
  assert.strictEqual(apiModeSummary.entryModel, 'dtx_contract_v2');
  assert.strictEqual(apiModeSummary.signalOrigin, 'engine');
  const apiAll = JSON.parse(fs.readFileSync(path.join(tmp, 'portfolio', 'v1', publicMode, 'all.json'), 'utf8'));
  assert.strictEqual(apiAll.config.vwapGate, true);
  assert.strictEqual(apiAll.config.entryModel, 'dtx_contract_v2');
  assert.strictEqual(apiAll.config.signalOrigin, 'engine');

  // Same-session decisions recorded before the exact capacity genesis are
  // reference evidence only. They must not survive as public proposals even
  // when their future execution window is otherwise valid.
  const preBoundaryDecision = {
    ...engineDecision,
    generatedAt: '2026-09-01T09:05:10.772Z',
  };
  statusFixture.modes[publicMode].engine_decision = preBoundaryDecision;
  fs.writeFileSync(statusPath, JSON.stringify(statusFixture));
  const stagedPreBoundary = JSON.parse(fs.readFileSync(path.join(tmp, 'data', 'dtx', `${publicMode}.json`), 'utf8'));
  stagedPreBoundary.generatedAt = preBoundaryDecision.generatedAt;
  fs.writeFileSync(path.join(tmp, 'data', 'dtx', `${publicMode}.json`), JSON.stringify(stagedPreBoundary));
  result = spawnSync(process.execPath, ['tools/gen-api.js'], { cwd: tmp, encoding: 'utf8' });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  apiOrders = JSON.parse(fs.readFileSync(path.join(tmp, 'portfolio', 'v1', publicMode, 'orders.json'), 'utf8'));
  apiModeSummary = JSON.parse(fs.readFileSync(path.join(tmp, 'portfolio', 'v1', 'modes.json'), 'utf8')).modes[0];
  assert.deepStrictEqual(apiOrders.plannedOrders, [], 'pre-boundary decision must expose no plan');
  assert.strictEqual(apiOrders.planningCertification.status, 'retired_uncertified');
  assert.strictEqual(apiOrders.planningCertification.reasonCode, 'decision_precedes_capacity_boundary');
  assert.strictEqual(apiOrders.planningCertification.capacityAtEntryCertified, false);
  assert.strictEqual(apiOrders.decisionProvenance, null, 'pre-boundary validity window must not be published');
  assert.strictEqual(apiModeSummary.plannedOrderCount, 0);
  assert(!/AAPL/.test(JSON.stringify(apiOrders)), 'pre-boundary symbol must not survive the orders endpoint');

  // Restore a post-boundary mapped staging for the remaining identity/staleness cases.
  statusFixture.modes[publicMode].engine_decision = engineDecision;
  fs.writeFileSync(statusPath, JSON.stringify(statusFixture));
  stagedPreBoundary.generatedAt = engineDecision.generatedAt;
  fs.writeFileSync(path.join(tmp, 'data', 'dtx', `${publicMode}.json`), JSON.stringify(stagedPreBoundary));

  statusFixture.modes[publicMode].engine_decision = {
    ...engineDecision,
    configHash: 'sha256:wrong',
  };
  fs.writeFileSync(statusPath, JSON.stringify(statusFixture));
  fs.writeFileSync(path.join(tmp, 'data', 'dtx', `${publicMode}.json`), JSON.stringify({
    mode: publicMode, portfolioId: enginePortfolio, configHash: 'sha256:wrong',
    asof: '2026-09-01', metricsSource: 'mcp_replay',
    metrics: { total_trades: 999 }, equity: { dates: ['2026-08-31', '2026-09-01'], values: [100, 999] },
  }));
  result = spawnSync(process.execPath, ['tools/gen-api.js'], { cwd: tmp, encoding: 'utf8' });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  apiOrders = JSON.parse(fs.readFileSync(path.join(tmp, 'portfolio', 'v1', publicMode, 'orders.json'), 'utf8'));
  apiEquity = JSON.parse(fs.readFileSync(path.join(tmp, 'portfolio', 'v1', publicMode, 'equity.json'), 'utf8'));
  assert.strictEqual(apiOrders.orders.length, 0, 'same portfolio with a different config hash must emit no API orders');
  assert.strictEqual(apiOrders.plannedOrders.length, 0, 'same portfolio with a different config hash must emit no planned orders');
  assert.strictEqual(apiEquity.engineBacktest, undefined, 'same portfolio with a different config hash must emit no API metrics');

  statusFixture.modes[publicMode].engine_decision = {
    ...engineDecision,
    executionPlan: { groups: [{ candidates: [{ strategy_id: enginePortfolio }, {}] }] },
  };
  fs.writeFileSync(statusPath, JSON.stringify(statusFixture));
  result = spawnSync(process.execPath, ['tools/gen-api.js'], { cwd: tmp, encoding: 'utf8' });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  apiOrders = JSON.parse(fs.readFileSync(path.join(tmp, 'portfolio', 'v1', publicMode, 'orders.json'), 'utf8'));
  assert.strictEqual(apiOrders.orders.length, 0, 'a candidate without engine identity must fail closed');
  assert.strictEqual(apiOrders.plannedOrders.length, 0, 'a candidate without engine identity must emit no planned orders');

  statusFixture.modes[publicMode].engine_decision = {
    ...engineDecision,
    stale: true,
  };
  fs.writeFileSync(statusPath, JSON.stringify(statusFixture));
  result = spawnSync(process.execPath, ['tools/gen-api.js'], { cwd: tmp, encoding: 'utf8' });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  apiOrders = JSON.parse(fs.readFileSync(path.join(tmp, 'portfolio', 'v1', publicMode, 'orders.json'), 'utf8'));
  apiEquity = JSON.parse(fs.readFileSync(path.join(tmp, 'portfolio', 'v1', publicMode, 'equity.json'), 'utf8'));
  assert.strictEqual(apiOrders.plannedOrders.length, 0, 'a stale engine decision must not republish yesterday\'s CREATE plan');
  assert.strictEqual(apiEquity.engineBacktest, undefined, 'stale engine history cannot stand in for a current mapped decision');

  statusFixture.modes[publicMode].engine_decision = {
    ...engineDecision,
    decisionProvenance: { ...engineDecision.decisionProvenance, validUntil: null },
  };
  fs.writeFileSync(statusPath, JSON.stringify(statusFixture));
  result = spawnSync(process.execPath, ['tools/gen-api.js'], { cwd: tmp, encoding: 'utf8' });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  apiOrders = JSON.parse(fs.readFileSync(path.join(tmp, 'portfolio', 'v1', publicMode, 'orders.json'), 'utf8'));
  assert.strictEqual(apiOrders.plannedOrders.length, 0, 'an invalid Contract V2 window must fail closed');

  const missingIdentityConfig = JSON.parse(fs.readFileSync(path.join(tmp, 'data', 'modes-config.json'), 'utf8'));
  delete missingIdentityConfig.modes[publicMode].dtxConfigHash;
  fs.writeFileSync(path.join(tmp, 'data', 'modes-config.json'), JSON.stringify(missingIdentityConfig));
  statusFixture.modes[publicMode].engine_decision = engineDecision;
  fs.writeFileSync(statusPath, JSON.stringify(statusFixture));
  result = spawnSync(process.execPath, ['tools/gen-api.js'], { cwd: tmp, encoding: 'utf8' });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  apiOrders = JSON.parse(fs.readFileSync(path.join(tmp, 'portfolio', 'v1', publicMode, 'orders.json'), 'utf8'));
  assert.strictEqual(apiOrders.plannedOrders.length, 0, 'a DTX mode without an expected config hash must fail closed');
  missingIdentityConfig.modes[publicMode].dtxConfigHash = modesConfig.modes[publicMode].dtxConfigHash;
  fs.writeFileSync(path.join(tmp, 'data', 'modes-config.json'), JSON.stringify(missingIdentityConfig));

  statusFixture.modes[publicMode].engine_decision = { ...engineDecision, portfolioId: null };
  fs.writeFileSync(statusPath, JSON.stringify(statusFixture));
  result = spawnSync(process.execPath, ['tools/gen-api.js'], { cwd: tmp, encoding: 'utf8' });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  apiOrders = JSON.parse(fs.readFileSync(path.join(tmp, 'portfolio', 'v1', publicMode, 'orders.json'), 'utf8'));
  assert.strictEqual(apiOrders.plannedOrders.length, 0, 'a DTX decision without explicit portfolioId must fail closed');

  const pausedConfig = JSON.parse(fs.readFileSync(path.join(tmp, 'data', 'modes-config.json'), 'utf8'));
  pausedConfig.modes[publicMode].status = 'paused';
  fs.writeFileSync(path.join(tmp, 'data', 'modes-config.json'), JSON.stringify(pausedConfig));
  statusFixture.modes[publicMode].engine_decision = engineDecision;
  fs.writeFileSync(statusPath, JSON.stringify(statusFixture));
  result = spawnSync(process.execPath, ['tools/gen-api.js'], { cwd: tmp, encoding: 'utf8' });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  apiOrders = JSON.parse(fs.readFileSync(path.join(tmp, 'portfolio', 'v1', publicMode, 'orders.json'), 'utf8'));
  apiModeSummary = JSON.parse(fs.readFileSync(path.join(tmp, 'portfolio', 'v1', 'modes.json'), 'utf8')).modes[0];
  assert.strictEqual(apiOrders.plannedOrders.length, 0, 'a paused DTX mode must expose no CREATE plan');
  assert.strictEqual(apiModeSummary.plannedOrderCount, 0, 'a paused DTX mode must expose no planned count');
  pausedConfig.modes[publicMode].status = 'live';
  fs.writeFileSync(path.join(tmp, 'data', 'modes-config.json'), JSON.stringify(pausedConfig));

  statusFixture.modes[publicMode].engine_decision = {
    ...engineDecision,
    portfolioId: publicMode,
    executionPlan: { groups: [{ candidates: [{ strategy_id: publicMode }] }] },
  };
  fs.writeFileSync(statusPath, JSON.stringify(statusFixture));
  fs.writeFileSync(path.join(tmp, 'data', 'dtx', `${publicMode}.json`), JSON.stringify({
    mode: publicMode, portfolioId: publicMode, metrics: { total_trades: 999 },
  }));
  result = spawnSync(process.execPath, ['tools/gen-api.js'], { cwd: tmp, encoding: 'utf8' });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  apiOrders = JSON.parse(fs.readFileSync(path.join(tmp, 'portfolio', 'v1', publicMode, 'orders.json'), 'utf8'));
  apiEquity = JSON.parse(fs.readFileSync(path.join(tmp, 'portfolio', 'v1', publicMode, 'equity.json'), 'utf8'));
  assert.strictEqual(apiOrders.orders.length, 0, 'old engine orders must fail closed after remapping');
  assert.strictEqual(apiEquity.engineBacktest, undefined, 'old engine metrics must fail closed after remapping');

  // One bad mapped staging must not erase a healthy public cell from the bridge batch.
  fixtureConfig.modes.other = {
    status: 'live', assetClass: 'dtx', dtxPortfolio: 'other_engine', dtxConfigHash: 'sha256:other', portfolioSize: 1,
  };
  fs.writeFileSync(path.join(tmp, 'data', 'modes-config.json'), JSON.stringify(fixtureConfig));
  fs.mkdirSync(path.join(tmp, 'scanner', '20260901'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'scanner', '20260901', 'signals.json'), JSON.stringify({ scanDate: '2026-09-01' }));
  // Keep the fixture independent of wall-clock time: the bridge correctly
  // refuses a plan outside its execution window, which made this regression
  // test randomly fail before the hard-coded US open.
  const bridgeNow = Date.now();
  const bridgeProvenance = {
    validFrom: new Date(bridgeNow - 60_000).toISOString(),
    validUntil: new Date(bridgeNow + 60 * 60_000).toISOString(),
  };
  fs.writeFileSync(path.join(tmp, 'data', 'dtx', `${publicMode}.json`), JSON.stringify({
    mode: publicMode, portfolioId: enginePortfolio,
    configHash: modesConfig.modes[publicMode].dtxConfigHash,
    asof: '2026-09-01', engineMode: 'mcp',
    decisionProvenance: bridgeProvenance,
    orders: [{ symbol: 'AAPL', side: 'BUY', qty: 2, entry: 100, stopLoss: 90 }],
  }));
  fs.writeFileSync(path.join(tmp, 'data', 'dtx', 'other.json'), JSON.stringify({
    mode: 'other', portfolioId: 'other_engine', configHash: 'sha256:wrong',
    asof: '2026-09-01', engineMode: 'mcp',
    decisionProvenance: bridgeProvenance,
    orders: [{ symbol: 'MSFT', side: 'BUY', qty: 1, entry: 200, stopLoss: 180 }],
  }));
  result = spawnSync(process.execPath, [
    'tools/dtx-pool-bridge.js', '--folder', '20260901', '--date', '2026-09-01',
  ], { cwd: tmp, encoding: 'utf8' });
  assert.strictEqual(result.status, 3, result.stdout + result.stderr);
  const signals = JSON.parse(fs.readFileSync(path.join(tmp, 'scanner', '20260901', 'signals.json'), 'utf8'));
  assert.strictEqual(signals.dtx_pool.length, 1, 'healthy bridge cell must survive another mapped cell failure');
  assert.strictEqual(signals.dtx_pool[0].universe, publicMode, 'bridge universe must remain the public mode id');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('DTX public-mode mapping tests: PASS');
