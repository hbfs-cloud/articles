#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { build, collect } = require('./build-intraday-retro-input');
const { sessionCoverageError, LSE_REGULAR_15M, expectedLseTimes, isLSETradingDay, addLSETradingDays, performancePopulation } = require('./lib/retro-intraday');
const result = build({ results: [{ symbol: 'TEST', data: { bars: [
  { timestamp: '2026-08-28T13:30:00Z', open: 1, high: 2, low: 1, close: 2 },
] } }] });
assert.strictEqual(result.sessions['2026-08-28'].TEST[0].timestamp, '2026-08-28T13:30:00Z');
const providerShape = {
  data: {
    items: [{
      results: [{
        data: [{ symbol: 'RAW', data: [
    ['2026-08-28T13:15:00Z', 1, 1, 1, 1, 0],
    ['2026-08-28T13:30:00Z', 2, 3, 2, 3, 10],
    ['2026-08-28T13:45:00Z', 3, 4, 3, 4, 11],
    ['2026-08-28T20:00:00Z', 4, 5, 4, 5, 12],
    ['2026-08-28T20:15:00Z', 5, 5, 5, 5, 0],
        ] }]
      }]
    }]
  }
};
const providerResult = build(providerShape);
assert.deepStrictEqual(providerResult.sessions['2026-08-28'].RAW.map(bar => bar.timestamp), [
  '2026-08-28T13:30:00Z', '2026-08-28T13:45:00Z',
]);
assert.strictEqual(collect(providerShape).length, 2, 'pre/post-market provider rows must not enter the governing RTH corpus');
const londonShape = { symbol: 'GLEN.L', data: [
  ['2026-08-28T06:45:00Z', 1, 2, 1, 2, 10],
  ['2026-08-28T07:00:23Z', 1, 2, 1, 2, 10],
  ['2026-08-28T07:00:00Z', 1, 2, 1, 2, 10],
  ['2026-08-28T15:15:00Z', 2, 3, 2, 3, 11],
  ['2026-08-28T15:30:00Z', 3, 4, 3, 4, 12],
] };
assert.deepStrictEqual(collect(londonShape).map(row => row.bar.timestamp), [
  '2026-08-28T07:00:00Z', '2026-08-28T15:15:00Z',
], 'GLEN.L must use the LSE 08:00–16:30 local contract, not NY RTH or provider pre/post-session rows');
const bars = Array.from({ length: 26 }, (_, index) => ({
  timestamp: new Date(Date.UTC(2026, 7, 28, 13, 30 + index * 15)).toISOString(),
  open: 1, high: 2, low: 1, close: 2,
}));
assert.strictEqual(sessionCoverageError(bars, '2026-08-28'), null);
const duplicate = structuredClone(bars); duplicate[25].timestamp = duplicate[24].timestamp;
assert.strictEqual(sessionCoverageError(duplicate, '2026-08-28'), 'rth_15m_sequence_invalid');
const extended = structuredClone(bars); extended[0].timestamp = '2026-08-28T12:00:00.000Z';
assert.strictEqual(sessionCoverageError(extended, '2026-08-28'), 'rth_15m_sequence_invalid');
const lseBars = expectedLseTimes.map((_, index) => ({
  timestamp: new Date(Date.UTC(2026, 7, 28, 7, index * 15)).toISOString(),
  open: 1, high: 2, low: 1, close: 2,
}));
assert.strictEqual(sessionCoverageError(lseBars, '2026-08-28', LSE_REGULAR_15M), null);
assert.strictEqual(sessionCoverageError(lseBars.slice(0, -1), '2026-08-28', LSE_REGULAR_15M), 'expected_34_lse_regular_bars_got_33');
const lseSeconds = structuredClone(lseBars); lseSeconds[0].timestamp = '2026-08-28T07:00:23Z';
assert.strictEqual(sessionCoverageError(lseSeconds, '2026-08-28', LSE_REGULAR_15M), 'timestamp_date_or_timezone_invalid');
const lseMilliseconds = structuredClone(lseBars); lseMilliseconds[0].timestamp = '2026-08-28T07:00:00.250Z';
assert.strictEqual(sessionCoverageError(lseMilliseconds, '2026-08-28', LSE_REGULAR_15M), 'timestamp_date_or_timezone_invalid');
assert.strictEqual(isLSETradingDay('2026-08-31'), false, 'LSE is closed for the Summer Bank Holiday');
assert.strictEqual(isLSETradingDay('2026-09-01'), true);
assert.throws(() => isLSETradingDay('2025-12-31'), /verified only from/);
assert.throws(() => isLSETradingDay('2026-12-24'), /early-close session/);
assert.strictEqual(addLSETradingDays('2026-08-25', 10), '2026-09-09', 'LSE horizon must skip 31 August, not just weekends');
const population = performancePopulation([
  { status: 'tp2', horizon_end: '2026-09-11' },
  { status: 'stopped', horizon_end: '2026-09-12' },
  { status: 'tp1_pending', horizon_end: '2026-09-12' },
  { status: 'pending', horizon_end: '2026-09-12' },
  { status: 'no_fill', horizon_end: '2026-09-11' },
  { status: 'data_error', horizon_end: '2026-09-11' },
], '2026-09-11');
assert.strictEqual(population.filled.length, 4);
assert.strictEqual(population.resolved.length, 1, 'non-mature stop and TP1 runner must not enter diagnostics');
assert.strictEqual(population.openRunners.length, 1);
assert.strictEqual(population.pending.length, 1);
assert.deepStrictEqual(population.performanceExclusions, {
  no_fill: 1, data_error: 1, open_unverified: 0, ambiguous: 0,
  non_mature: 3, pending: 1, open_runners: 1,
});
console.log('intraday retro input tests: PASS');
