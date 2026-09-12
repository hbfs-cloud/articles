#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { buildFrozenFetchScope } = require('./lib/sweep-frozen-fetch-scope');

const scans = [
  { scanDate: '2026-08-20' },
  { scanDate: '2026-08-21' },
  { scanDate: '2026-08-28' },
  { scanDate: '2026-09-08' },
];
const allSetups = [
  { ticker: 'OLD', scanDate: '2026-08-20', source: 'signals' },
  { ticker: 'EDP.LS', scanDate: '2026-08-21', source: 'signals' },
  { ticker: 'POOL-A', scanDate: '2026-08-28', source: 'signals' },
  { ticker: 'POOL-B', scanDate: '2026-08-28', source: 'tkl_pool' },
  { ticker: 'POOL-C', scanDate: '2026-08-28', source: 'filings_pool' },
  { ticker: 'NEXT', scanDate: '2026-09-08', source: 'signals' },
];
const edpClosed = { ticker: 'EDP.LS', status: 'breakeven', scanDate: '2026-08-21', entryDate: '2026-08-21', exitDate: '2026-08-27', pnlPct: 0 };
const overlapping = { ticker: 'OVERLAP', status: 'tp1', scanDate: '2026-08-20', entryDate: '2026-08-20', exitDate: '2026-08-30' };
const balancedClosed = { ticker: 'BAL-OLD', status: 'tp1', scanDate: '2026-08-21', entryDate: '2026-08-21', exitDate: '2026-08-22' };
const pending = { ticker: 'POOL-A', status: 'pending', scanDate: '2026-08-28', entryDate: '2026-08-28' };
const existingTrades = {
  fortress: [edpClosed, overlapping],
  balanced: [balancedClosed, pending],
};
const originalTrades = structuredClone(existingTrades);
const scope = buildFrozenFetchScope({
  scans,
  allSetups,
  modes: {
    fortress: { status: 'live', statusSince: '2026-08-01' },
    balanced: { status: 'live', statusSince: '2026-08-01' },
    stopped: { status: 'stopped' },
  },
  existingTrades,
  existingResults: {
    frozen_fortress: { equityCurve: [{ date: '2026-08-20', value: 100 }] },
    frozen_balanced: { equityCurve: [{ date: '2026-08-21', value: 100 }] },
  },
  livePositions: [{ ticker: 'LIVE' }],
});

assert.deepStrictEqual(scope.scanDates, ['2026-08-28', '2026-09-08'], 'only append/purged scan dates should be fetched');
assert.deepStrictEqual(scope.purgedScanDates, ['2026-08-28']);
assert.deepStrictEqual(scope.setups.map(setup => setup.ticker), ['POOL-A', 'POOL-B', 'POOL-C', 'NEXT'], 'all pools from a required scan date must stay together');
assert.deepStrictEqual(scope.tickers, ['BAL-OLD', 'LIVE', 'NEXT', 'OVERLAP', 'POOL-A', 'POOL-B', 'POOL-C'], 'open, overlapping, pending and all required-pool symbols must be included');
assert(!scope.tickers.includes('EDP.LS'), 'closed trade before both append boundaries must not request a current price');
assert.deepStrictEqual(existingTrades, originalTrades, 'scope derivation must leave sealed historical records byte-equivalent');

const pendingResimulationScope = buildFrozenFetchScope({
  scans,
  allSetups,
  modes: { fortress: { status: 'live' } },
  existingTrades: {
    fortress: [
      { ticker: 'NEWEST', status: 'tp1', scanDate: '2026-09-08', entryDate: '2026-09-08', exitDate: '2026-09-09' },
      { ticker: 'POOL-A', status: 'pending', scanDate: '2026-08-28', entryDate: '2026-08-28' },
    ],
  },
  existingResults: {},
});
assert.deepStrictEqual(pendingResimulationScope.scanDates, ['2026-08-28'], 'a pending record must retain its original scan date even behind the append frontier');
assert.deepStrictEqual(pendingResimulationScope.tickers, ['POOL-A', 'POOL-B', 'POOL-C'], 'pending re-simulation retains its complete candidate pool');

const resetScope = buildFrozenFetchScope({
  scans,
  allSetups,
  modes: { new_mode: { status: 'live', statusSince: '2026-08-28' } },
  existingTrades: { new_mode: [] },
  existingResults: {},
});
assert.deepStrictEqual(resetScope.scanDates, ['2026-08-28', '2026-09-08'], 'a mode without history must respect statusSince rather than fetch older scans');
assert.deepStrictEqual(resetScope.tickers, ['NEXT', 'POOL-A', 'POOL-B', 'POOL-C']);

const noImplicitScope = buildFrozenFetchScope({
  scans,
  allSetups,
  modes: { stopped: { status: 'stopped' }, excluded: { status: 'live' } },
  existingTrades: { stopped: [], excluded: [] },
  existingResults: {},
  excludesMode: id => id === 'excluded',
});
assert.deepStrictEqual(noImplicitScope.tickers, [], 'stopped and externally excluded modes must not create fetches');

console.log('sweep frozen fetch scope: PASS');
