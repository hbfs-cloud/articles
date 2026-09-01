#!/usr/bin/env node
'use strict';

const assert = require('assert');
const contract = require('./lib/marketdata-bars-contract');

assert.strictEqual(contract.MIN_MARKETDATA_BUILD, '0424cf4b');

const readiness = {
  server_version: '0424cf4b',
  operation_readiness: {
    bars_daily_us_equity: {
      status: 'ready',
      asset_calendar: 'us_equity_exchange_sessions',
      expected_completed_end: '2026-08-31',
      served_completed_end: '2026-08-31',
    },
    bars_daily_crypto_utc: {
      status: 'ready',
      asset_calendar: 'crypto_24_7_utc',
      expected_completed_end: '2026-08-30',
      served_completed_end: '2026-08-30',
      current_bar_date: '2026-08-31',
      current_bar_complete: false,
      requested_end_state: 'current_bar_open',
      next_complete_available_at: '2026-09-01T00:02:00Z',
    },
    run_screener_sec_enriched: { status: 'ready' },
  },
};
const ready = contract.validateOperationReadiness(readiness, {
  equityReferenceClose: '2026-08-31',
  cryptoCompletedRefdate: '2026-08-30',
  secOperation: 'run_screener_sec_enriched',
  minimumBuild: '0424cf4b',
});
assert.deepStrictEqual(ready.errors, []);
assert.strictEqual(ready.retryAt, '2026-09-01T00:02:00Z');
assert.strictEqual(ready.build, '0424cf4b');

assert(contract.validateOperationReadiness({ operation_readiness: readiness.operation_readiness }, {
  equityReferenceClose: '2026-08-31', minimumBuild: '0424cf4b',
}).errors.some(error => error.includes('build identity missing')));

const crossedCalendars = contract.validateOperationReadiness(readiness, {
  equityReferenceClose: '2026-08-31',
  cryptoCompletedRefdate: '2026-08-31',
});
assert(crossedCalendars.errors.some(error => error.includes('bars_daily_crypto_utc expected_completed_end mismatch')));

function completedCell(symbol, overrides = {}) {
  return {
    status: 'completed',
    symbol,
    asset_calendar: 'us_equity_exchange_sessions',
    expected_completed_end: '2026-08-31',
    served_completed_end: '2026-08-31',
    requested_end_state: 'current_bar_open',
    last_bar_complete: true,
    ...overrides,
  };
}

function row(symbol, overrides = {}) {
  return {
    symbol,
    asset_calendar: 'us_equity_exchange_sessions',
    expected_completed_end: '2026-08-31',
    served_completed_end: '2026-08-31',
    bars: [['2026-08-31', 10, 12, 9, 11, 100]],
    ...overrides,
  };
}

const completeBatch = {
  data: { items: [{ results: [{
    cells: [completedCell('AAPL'), completedCell('NVDA')],
    data: [row('AAPL'), row('NVDA')],
  }] }] },
};
const completeCheck = contract.validateQueryData(completeBatch, {
  symbols: 'AAPL,NVDA',
  assetCalendar: 'us_equity_exchange_sessions',
  expectedCompletedEnd: '2026-08-31',
});
assert.deepStrictEqual(completeCheck.errors, []);
assert.strictEqual(completeCheck.healthyCells.length, 2);
assert.strictEqual(completeCheck.completedDataThrough, '2026-08-31');

const partialBatch = {
  results: [{ cells: [completedCell('AAPL', { last_bar_complete: false })], data: [row('AAPL')] }],
};
assert(contract.validateQueryData(partialBatch, {
  symbols: 'AAPL', assetCalendar: 'us_equity_exchange_sessions', expectedCompletedEnd: '2026-08-31',
}).errors.some(error => error.includes('complete=false')));

const withoutData = {
  results: [{ cells: [{ status: 'completed_without_data', symbol: 'AAPL' }], data: [] }],
};
assert(contract.validateQueryData(withoutData, { symbols: 'AAPL' }).errors.some(error => error.includes('fail-closed')));

const mixedBatch = {
  results: [{
    cells: [completedCell('AAPL'), { status: 'failed', symbol: 'NVDA', rejection_reason: 'upstream unavailable', retry_at: '2026-09-01T00:02:00Z' }],
    data: [row('AAPL')],
  }],
};
const mixedCheck = contract.validateQueryData(mixedBatch, {
  symbols: 'AAPL,NVDA', assetCalendar: 'us_equity_exchange_sessions', expectedCompletedEnd: '2026-08-31',
});
assert(mixedCheck.errors.some(error => error.includes('NVDA: failed')));
assert.deepStrictEqual(mixedCheck.healthyCells.map(cell => cell.id), ['AAPL']);
assert.strictEqual(mixedCheck.retryAt, '2026-09-01T00:02:00Z');

const absentCell = contract.validateQueryData({ results: [{ cells: [], data: [] }] }, { symbols: 'AAPL' });
assert(absentCell.errors.some(error => error.includes('got 0')));
assert.strictEqual(absentCell.completedDataThrough, null, 'absence must never be converted to zero');

const notApplicable = contract.validateQueryData({
  results: [{ cells: [{ status: 'not_applicable', instrument_id: 'IDX:VIX', not_applicable_reason: 'calendar unsupported' }], data: [] }],
}, { symbols: 'IDX:VIX' });
assert.deepStrictEqual(notApplicable.errors, []);

assert.deepStrictEqual(contract.validateRefreshBars({
  last_bar_after: '2026-09-01',
  last_completed_bar_after: '2026-08-31',
  last_bar_complete: true,
}, '2026-08-31'), []);
assert(contract.validateRefreshBars({ last_bar_after: '2026-09-01' }, '2026-08-31')
  .some(error => error.includes('last_completed_bar_after')));

console.log('marketdata bars contract tests: PASS');
