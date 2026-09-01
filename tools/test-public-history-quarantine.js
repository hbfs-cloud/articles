#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  HISTORY_STATUS,
  METRIC_KEYS,
  PROPOSED_PLAN_STATUS,
  REASON_CODE,
  boundaryFromRegistry,
  publicProposedPlanEntry,
  quarantineHistoryDirectory,
} = require('./lib/public-scanner-history');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dtx-public-history-'));
const historyDir = path.join(tempRoot, 'history');
fs.mkdirSync(historyDir);

const registry = {
  boundary: {
    session: '2026-09-01',
    effectiveAt: '2026-09-01T11:10:46.000Z',
    preBoundary: { reasonCode: REASON_CODE },
  },
};
const boundary = boundaryFromRegistry(registry);

const legacy = {
  date: '2026-08-31',
  scanDir: '20260901',
  updatedAt: '2026-09-01T00:00:00Z',
  configVersion: 'top-v1',
  configHash: 'sha256:top',
  regimeProbability: { source: 'mcp_connected:GetMarketContext', requestId: 'request-secret' },
  modes: {
    turbo: {
      configVersion: 'mode-v1',
      configHash: 'sha256:mode',
      config: {
        configVersion: 'v1-20260215',
        configHash: 'sha256:config',
        dtxPortfolio: 'private-engine-name',
        dtxConfigHash: 'sha256:dtx',
        portfolioSize: 9,
      },
      stats: { ret: 99, trades: 27, wr: 80, pf: 4.2 },
      equity: { d: ['08/31'], v: [199] },
      positions: [{ ticker: 'FAKE' }],
      orders: [{ symbol: 'FAKE', candidateId: 'plan-private' }],
      trades: [{ ticker: 'FAKE' }],
      closedTrades: [{ ticker: 'FAKE' }],
      engine_decision: { engineMode: 'mcp', requestId: 'request-secret' },
      risk: { traceId: 'trace-secret' },
    },
  },
};
const current = { date: '2026-09-01', scanDir: '20260902', modes: { best: { stats: { ret: null } } } };
fs.writeFileSync(path.join(historyDir, '20260831.json'), JSON.stringify(legacy));
fs.writeFileSync(path.join(historyDir, '20260901.json'), JSON.stringify(current));

try {
  const first = quarantineHistoryDirectory({ historyDir, boundary });
  assert.strictEqual(first.quarantined, 1, 'exactly one pre-boundary fixture must be quarantined');
  assert.strictEqual(first.changed, 1, 'first pass must rewrite the legacy fixture');
  assert.deepStrictEqual(first.publishedDates, ['20260901'], 'Time Machine dates must be certified-forward only');

  const tombstonePath = path.join(historyDir, '20260831.json');
  const firstBytes = fs.readFileSync(tombstonePath, 'utf8');
  const tombstone = JSON.parse(firstBytes);
  assert.strictEqual(tombstone.date, legacy.date, 'date must survive quarantine');
  assert.strictEqual(tombstone.scanDir, legacy.scanDir, 'scanDir must survive quarantine');
  assert.strictEqual(tombstone.configVersion, legacy.configVersion, 'top configVersion must not change');
  assert.strictEqual(tombstone.configHash, legacy.configHash, 'top configHash must not change');
  assert.strictEqual(tombstone.historyStatus, HISTORY_STATUS);
  assert.strictEqual(tombstone.reasonCode, REASON_CODE);
  assert.strictEqual(tombstone.execution_verified, false);
  assert.strictEqual(tombstone.regimeProbability, undefined, 'market/MCP metadata must not survive quarantine');

  const mode = tombstone.modes.turbo;
  assert.strictEqual(mode.configVersion, legacy.modes.turbo.configVersion, 'mode configVersion must not change');
  assert.strictEqual(mode.configHash, legacy.modes.turbo.configHash, 'mode configHash must not change');
  assert.strictEqual(mode.config.configVersion, legacy.modes.turbo.config.configVersion, 'nested configVersion must not change');
  assert.strictEqual(mode.config.configHash, legacy.modes.turbo.config.configHash, 'nested configHash must not change');
  assert.strictEqual(mode.config.portfolioSize, undefined, 'uncertified historical capacity must not survive');
  assert.strictEqual(mode.historyStatus, HISTORY_STATUS);
  assert.strictEqual(mode.reasonCode, REASON_CODE);
  assert.strictEqual(mode.execution_verified, false);
  for (const metric of METRIC_KEYS) assert.strictEqual(mode.stats[metric], null, `${metric} must be null`);
  assert.deepStrictEqual(mode.equity.d, []);
  assert.deepStrictEqual(mode.equity.v, []);
  assert.deepStrictEqual(mode.pit_equity.d, []);
  assert.deepStrictEqual(mode.pit_equity.v, []);
  for (const key of ['signals', 'positions', 'orders', 'trades', 'closedTrades', 'closeNow', 'expiresTomorrow']) {
    assert.deepStrictEqual(mode[key], [], `${key} must be empty`);
  }
  assert.strictEqual(mode.engine_decision, null);
  assert.strictEqual(mode.risk, null);
  assert(!/mcp_connected|request-secret|trace-secret|plan-private|candidateId/i.test(firstBytes), 'operational metadata leaked from tombstone');

  const currentBytes = fs.readFileSync(path.join(historyDir, '20260901.json'), 'utf8');
  assert.strictEqual(currentBytes, JSON.stringify(current), 'boundary-session snapshot must remain byte-identical');

  const second = quarantineHistoryDirectory({ historyDir, boundary });
  assert.strictEqual(second.quarantined, 1);
  assert.strictEqual(second.changed, 0, 'quarantine must be deterministic and idempotent');
  assert.strictEqual(fs.readFileSync(tombstonePath, 'utf8'), firstBytes, 'second pass changed tombstone bytes');

  const publicPlan = publicProposedPlanEntry({
    asof: '2026-09-01',
    portfolioId: 'public-portfolio',
    configHash: 'sha256:public',
    engineMode: 'mcp',
    metrics: { return_pct: 999 },
    decisionProvenance: {
      contractVersion: '2.0', requestId: 'request-secret', planId: 'plan-private',
      requestedAsOf: '2026-08-31', validFrom: '2026-09-01T13:30:00Z', validUntil: '2026-09-01T19:55:00Z',
    },
    orders: [{
      symbol: 'TEST', side: 'BUY', orderType: 'LIMIT', qty: 2,
      limitPrice: 10, stopLoss: 8, takeProfit: null, reason: 'test proposal',
      candidateId: 'plan-private:slot-01:1',
    }],
    updates: [{}],
    cancels: [],
  });
  assert.strictEqual(publicPlan.status, PROPOSED_PLAN_STATUS);
  assert.strictEqual(publicPlan.execution_verified, false);
  assert.strictEqual(publicPlan.plans[0].status, PROPOSED_PLAN_STATUS);
  assert.strictEqual(publicPlan.plans[0].execution_verified, false);
  assert.strictEqual(publicPlan.plans[0].fill_verified, false);
  assert.strictEqual(publicPlan.plans[0].takeProfit, null, 'missing target must remain null, never zero');
  const publicPlanBytes = JSON.stringify(publicPlan);
  assert(!/engineMode|"orders"|"metrics"|request-secret|plan-private|candidateId/i.test(publicPlanBytes), 'public proposed-plan allow-list leaked internal fields');

  const retiredPlan = publicProposedPlanEntry({
    ...publicPlan,
    generatedAt: '2026-09-01T09:05:10.772Z',
    orders: [{ symbol: 'SNDK', side: 'BUY', orderType: 'LIMIT', qty: 2 }],
  }, { boundary });
  assert.strictEqual(retiredPlan.historyStatus, HISTORY_STATUS, 'pre-effectiveAt plan must be retired_uncertified');
  assert.strictEqual(retiredPlan.reasonCode, REASON_CODE);
  assert.strictEqual(retiredPlan.execution_verified, false);
  assert.deepStrictEqual(retiredPlan.plans, [], 'pre-effectiveAt proposal must expose zero plans');
  assert(!/SNDK/.test(JSON.stringify(retiredPlan)), 'pre-effectiveAt symbol must not survive public retirement');

  console.log('public scanner history quarantine: PASS');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
