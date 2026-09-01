#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const contract = require('./lib/marketdata-bars-contract');
const {
  buildBarsDailyArgs,
  classifyBarsDailyCalendar,
  ingestCertifiedBarsBatch,
  latestCompletedCryptoUtcDate,
} = require('./lib/sweep-marketdata');
const scanPlan = require('./scan-plan');

assert.strictEqual(contract.MIN_MARKETDATA_BUILD, '0424cf4b');
assert(contract.AUDITED_MARKETDATA_BUILDS.has('0e946129'));
assert(contract.AUDITED_MARKETDATA_BUILDS.has('4d8a54f1'));
assert(contract.AUDITED_MARKETDATA_BUILDS.has('d24684fb'));

const sweepArgs = buildBarsDailyArgs(['AAPL', ' QQQ '], '2026-09-01T08:00:00Z');
assert.deepStrictEqual(sweepArgs, {
  types: 'bars_daily',
  symbols: 'AAPL,QQQ',
  limit: 140,
  as_of_timestamp: '2026-09-01T08:00:00.000Z',
  completion_policy: 'completed_only',
});
assert.throws(() => buildBarsDailyArgs(['AAPL'], '2026-09-01'), /explicit ISO-8601 UTC timestamp/);
assert.throws(() => buildBarsDailyArgs(['AAPL'], '2026-09-01T08:00:00+02:00'), /explicit ISO-8601 UTC timestamp/);
assert.throws(() => buildBarsDailyArgs([], '2026-09-01T08:00:00Z'), /at least one symbol/);
assert.throws(() => buildBarsDailyArgs(['AAPL'], '2026-09-01T08:00:00Z', 0), /positive integer/);
assert.strictEqual(latestCompletedCryptoUtcDate('2026-08-31T22:03:00Z'), '2026-08-30');
assert.strictEqual(latestCompletedCryptoUtcDate('2026-09-01T08:00:00Z'), '2026-08-31');
assert.deepStrictEqual(classifyBarsDailyCalendar('AAPL'), {
  supported: true, assetCalendar: 'us_equity_exchange_sessions', reason: null,
});
assert.deepStrictEqual(classifyBarsDailyCalendar('BRK.B'), {
  supported: true, assetCalendar: 'us_equity_exchange_sessions', reason: null,
});
assert.deepStrictEqual(classifyBarsDailyCalendar('BTC-USD'), {
  supported: true, assetCalendar: 'crypto_24_7_utc', reason: null,
});
for (const ticker of ['AI.PA', 'ELE.MC', 'ITX.MC', 'KBC.BR', 'EDP.LS']) {
  const classified = classifyBarsDailyCalendar(ticker);
  assert.strictEqual(classified.supported, false, `${ticker} must not enter the US calendar bucket`);
  assert.strictEqual(classified.assetCalendar, null);
  assert.match(classified.reason, /no audited operation_readiness bucket/);
}

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
    bars_intraday_15m: {
      status: 'ready',
      max_last_bar_at: '2026-08-31T20:00:00Z',
    },
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

const descendantReadiness = structuredClone(readiness);
descendantReadiness.server_version = '0e946129';
assert.deepStrictEqual(contract.validateOperationReadiness(descendantReadiness, {
  equityReferenceClose: '2026-08-31', minimumBuild: '0424cf4b',
}).errors, []);

assert(contract.validateOperationReadiness({ ...readiness, server_version: 'deadbeef' }, {
  equityReferenceClose: '2026-08-31', minimumBuild: '0424cf4b',
}).errors.some(error => error.includes('not an audited descendant')));

assert(contract.validateOperationReadiness({ operation_readiness: readiness.operation_readiness }, {
  equityReferenceClose: '2026-08-31', minimumBuild: '0424cf4b',
}).errors.some(error => error.includes('build identity missing')));

const readinessWithoutServerExpected = structuredClone(readiness);
delete readinessWithoutServerExpected.operation_readiness.bars_daily_us_equity.expected_completed_end;
assert(contract.validateOperationReadiness(readinessWithoutServerExpected, {
  equityReferenceClose: '2026-08-31', minimumBuild: '0424cf4b',
}).errors.some(error => error.includes('expected_completed_end missing')));

const crossedCalendars = contract.validateOperationReadiness(readiness, {
  equityReferenceClose: '2026-08-31',
  cryptoCompletedRefdate: '2026-08-31',
});
assert(crossedCalendars.errors.some(error => error.includes('bars_daily_crypto_utc expected_completed_end mismatch')));

assert.strictEqual(contract.hasGetStatusContractAssertions({ covers_close: '2026-08-31' }), false,
  'legacy covers_close must not activate the close contract');
assert.strictEqual(contract.hasGetStatusContractAssertions({ expected_intraday_close: '2026-08-31' }), true);
const coveredAndIntraday = contract.validateGetStatus(readiness, {
  equity_reference_close: '2026-08-31',
  expected_intraday_close: '2026-08-31',
  sec_operation: 'run_screener_sec_enriched',
});
assert.deepStrictEqual(coveredAndIntraday.errors, []);
const secNotReady = structuredClone(readiness);
secNotReady.operation_readiness.run_screener_sec_enriched.status = 'unavailable';
assert(contract.validateGetStatus(secNotReady, {
  equity_reference_close: '2026-08-31',
  sec_operation: 'run_screener_sec_enriched',
}).errors.some(error => error.includes('run_screener_sec_enriched not ready')));
const uncovered = structuredClone(readiness);
uncovered.operation_readiness.bars_daily_us_equity.served_completed_end = '2026-08-28';
assert(contract.validateGetStatus(uncovered, { equity_reference_close: '2026-08-31' }).errors
  .some(error => error.includes('served_completed_end mismatch')));
const staleIntraday = structuredClone(readiness);
staleIntraday.operation_readiness.bars_intraday_15m.max_last_bar_at = '2026-08-28T20:00:00Z';
assert(contract.validateGetStatus(staleIntraday, { expected_intraday_close: '2026-08-31' }).errors
  .some(error => error.includes('bars_intraday_15m close mismatch')));

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
}).errors.some(error => error.includes('last_bar_complete=false')));

const missingCompletionProof = {
  results: [{ cells: [completedCell('AAPL', { last_bar_complete: undefined })], data: [row('AAPL')] }],
};
assert.deepStrictEqual(contract.validateQueryData(missingCompletionProof, {
  symbols: 'AAPL', assetCalendar: 'us_equity_exchange_sessions', expectedCompletedEnd: '2026-08-31',
}).errors, [], 'QueryData may omit last_bar_complete when served/expected end and the last row certify the close');

const legacyCoverageOnly = {
  results: [{
    cells: [{ status: 'completed', symbol: 'AAPL' }],
    data: [{
      symbol: 'AAPL', bars: [['2026-08-31', 10, 12, 9, 11, 100]],
      coverage: {
        asset_calendar: 'us_equity_exchange_sessions', expected_session_end: '2026-08-31',
        served_end: '2026-08-31', complete: true, requested_end_state: 'current_bar_open',
      },
    }],
  }],
};
const legacyCoverageCheck = contract.validateQueryData(legacyCoverageOnly, {
  symbols: 'AAPL', assetCalendar: 'us_equity_exchange_sessions', expectedCompletedEnd: '2026-08-31',
});
assert(legacyCoverageCheck.errors.some(error => error.includes('asset_calendar mismatch')));
assert(legacyCoverageCheck.errors.some(error => error.includes('missing expected_completed_end')));
assert(legacyCoverageCheck.errors.some(error => error.includes('missing served_completed_end')));
assert(legacyCoverageCheck.errors.some(error => error.includes('missing requested_end_state')));

const conflictingProof = {
  results: [{
    cells: [completedCell('AAPL')],
    data: [row('AAPL', { served_completed_end: '2026-08-28' })],
  }],
};
assert(contract.validateQueryData(conflictingProof, {
  symbols: 'AAPL', assetCalendar: 'us_equity_exchange_sessions', expectedCompletedEnd: '2026-08-31',
}).errors.some(error => error.includes('conflicting served_completed_end')));

const includedPartial = {
  results: [{
    cells: [completedCell('AAPL', { current_bar_included: true, current_bar_complete: false })],
    data: [row('AAPL')],
  }],
};
assert(contract.validateQueryData(includedPartial, {
  symbols: 'AAPL', assetCalendar: 'us_equity_exchange_sessions', expectedCompletedEnd: '2026-08-31',
}).errors.some(error => error.includes('included current bar is partial')));

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

// The sweep must preserve healthy cells from a mixed batch while failing the
// missing symbol. Positional zipping would incorrectly map QQQ's bars to NVDA.
const mixedSweepBatch = {
  results: [{
    cells: [
      completedCell('AAPL'),
      { status: 'failed', symbol: 'NVDA', rejection_reason: 'upstream unavailable' },
      completedCell('QQQ'),
    ],
    data: [
      row('AAPL', { bars: [['2026-08-31', 10, 12, 9, 11, 100]] }),
      row('QQQ', { bars: [['2026-08-31', 20, 22, 19, 21, 200]] }),
    ],
  }],
};
const ingestedMixedSweep = ingestCertifiedBarsBatch(mixedSweepBatch, {
  symbols: ['AAPL', 'NVDA', 'QQQ'],
  assetCalendar: 'us_equity_exchange_sessions',
  expectedCompletedEnd: '2026-08-31',
});
assert.deepStrictEqual(Object.keys(ingestedMixedSweep.histories), ['AAPL', 'QQQ']);
assert.strictEqual(ingestedMixedSweep.histories.AAPL['2026-08-31'].close, 11);
assert.strictEqual(ingestedMixedSweep.histories.QQQ['2026-08-31'].close, 21);
assert.deepStrictEqual(ingestedMixedSweep.failedSymbols, ['NVDA']);
assert(ingestedMixedSweep.errors.some(error => error.includes('NVDA: failed')));
assert.strictEqual(ingestedMixedSweep.proofs.AAPL.expectedCompletedEnd, '2026-08-31');
assert.strictEqual(ingestedMixedSweep.proofs.AAPL.servedCompletedEnd, '2026-08-31');

const ingestedWithoutData = ingestCertifiedBarsBatch(withoutData, {
  symbols: ['AAPL'],
  assetCalendar: 'us_equity_exchange_sessions',
  expectedCompletedEnd: '2026-08-31',
});
assert.deepStrictEqual(ingestedWithoutData.histories, {});
assert.deepStrictEqual(ingestedWithoutData.failedSymbols, ['AAPL']);
assert(ingestedWithoutData.errors.some(error => error.includes('completed_without_data')));

const missingSweepProof = ingestCertifiedBarsBatch({
  results: [{
    cells: [{ status: 'completed', symbol: 'AAPL' }],
    data: [{ symbol: 'AAPL', bars: [['2026-08-31', 10, 12, 9, 11, 100]] }],
  }],
}, {
  symbols: ['AAPL'],
  assetCalendar: 'us_equity_exchange_sessions',
  expectedCompletedEnd: '2026-08-31',
});
assert.deepStrictEqual(missingSweepProof.histories, {});
assert.deepStrictEqual(missingSweepProof.failedSymbols, ['AAPL']);
assert(missingSweepProof.errors.some(error => error.includes('asset_calendar mismatch')));
assert(missingSweepProof.errors.some(error => error.includes('missing served_completed_end')));

const unexpectedSymbol = contract.validateQueryData({
  results: [{ cells: [completedCell('AAPL'), completedCell('MSFT')], data: [row('AAPL'), row('MSFT')] }],
}, {
  symbols: 'AAPL', assetCalendar: 'us_equity_exchange_sessions', expectedCompletedEnd: '2026-08-31',
});
assert(unexpectedSymbol.errors.some(error => error.includes('MSFT: unexpected terminal cell')));
assert(unexpectedSymbol.errors.some(error => error.includes('MSFT: unexpected data row')));
assert.deepStrictEqual(unexpectedSymbol.healthyCells.map(cell => cell.id), ['AAPL']);

const orphanRow = contract.validateQueryData({
  results: [{ cells: [completedCell('AAPL')], data: [row('AAPL'), row('MSFT')] }],
}, {
  symbols: 'AAPL', assetCalendar: 'us_equity_exchange_sessions', expectedCompletedEnd: '2026-08-31',
});
assert(orphanRow.errors.some(error => error.includes('MSFT: data row has no terminal cell')));

const completedNoBars = contract.validateQueryData({
  results: [{ cells: [completedCell('AAPL')], data: [row('AAPL', { bars: [] })] }],
}, {
  symbols: 'AAPL', assetCalendar: 'us_equity_exchange_sessions', expectedCompletedEnd: '2026-08-31',
});
assert(completedNoBars.errors.some(error => error.includes('no identifiable bar')));

const contradictoryCompleted = contract.validateQueryData({
  results: [{ cells: [completedCell('AAPL', { rejection_reason: 'should not coexist' })], data: [row('AAPL')] }],
}, {
  symbols: 'AAPL', assetCalendar: 'us_equity_exchange_sessions', expectedCompletedEnd: '2026-08-31',
});
assert(contradictoryCompleted.errors.some(error => error.includes('conflicting terminal reason')));

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

// The legacy manual scanner planner must never infer the still-open US session
// from the host date. At 04:00 New York on 1 September, 31 August is the only
// completed close and the public scanner session is 1 September.
const premarketTimestamp = '2026-09-01T08:00:00.000Z';
assert.throws(() => scanPlan.buildPlan({}), /--refdate/);
assert.throws(() => scanPlan.buildPlan({
  refdate: '2026-08-31', asOfTimestamp: '2026-09-01',
  now: new Date(premarketTimestamp),
}), /explicit time and UTC offset/);
assert.throws(() => scanPlan.buildPlan({
  refdate: '2026-09-01', asOfTimestamp: premarketTimestamp,
  now: new Date(premarketTimestamp),
}), /latest completed US close/);
assert.throws(() => scanPlan.buildPlan({
  refdate: '2026-08-31', asOfTimestamp: premarketTimestamp,
  asof: '2026-09-02', now: new Date(premarketTimestamp),
}), /next US session/);
assert.throws(() => scanPlan.buildPlan({
  refdate: '2026-08-31', asOfTimestamp: premarketTimestamp,
  folder: '20260902', now: new Date(premarketTimestamp),
}), /does not match scanner session/);
assert.throws(() => scanPlan.buildPlan({
  refdate: '2026-08-31', asOfTimestamp: premarketTimestamp,
  now: new Date('2026-09-01T09:00:01.000Z'),
}), /within 15 minutes/);

const manualPlan = scanPlan.buildPlan({
  refdate: '2026-08-31', asOfTimestamp: premarketTimestamp,
  now: new Date(premarketTimestamp),
});
assert.strictEqual(manualPlan.referenceClose, '2026-08-31');
assert.strictEqual(manualPlan.scanDate, '2026-09-01');
assert.strictEqual(manualPlan.folder, '20260901');
assert.strictEqual(manualPlan.marketdataContract.minimumBuild, '0424cf4b');
assert.strictEqual(manualPlan.waves.wave1_context_universes[0].assert.expected_completed_end, '2026-08-31');
const manualBars = manualPlan.waves.wave2_static_bars.filter(call => call && call.key);
assert(manualBars.length > 0, 'manual planner fixture must expose at least one static bars batch');
for (const call of manualBars) {
  assert.strictEqual(call.params.as_of_timestamp, premarketTimestamp);
  assert.strictEqual(call.params.completion_policy, 'completed_only');
  assert.strictEqual(call.params.limit, 400);
  assert.strictEqual(call.params.days, undefined);
  assert.strictEqual(call.params.end_date, undefined);
  assert.strictEqual(call.params.include_partial, undefined);
  assert.strictEqual(call.freshness.asset_calendar, 'us_equity_exchange_sessions');
  assert.strictEqual(call.freshness.expected_completed_end, '2026-08-31');
}
assert.throws(() => scanPlan.barsQueryParams('AAPL', premarketTimestamp, {
  completion_policy: 'include_partial', as_of_timestamp: '2026-01-01T00:00:00Z', days: 400,
}), /contract fields are immutable/);

const parallelScript = fs.readFileSync(require.resolve('./scan-parallel.sh'), 'utf8');
assert(parallelScript.includes("AS_OF_TIMESTAMP=$(date -u +'%Y-%m-%dT%H:%M:%SZ')"));
assert.strictEqual(
  (parallelScript.match(/--var as_of_timestamp="\$AS_OF_TIMESTAMP"/g) || []).length,
  2,
  'wave1 and wave2 must share one explicit collection timestamp',
);
for (const relative of [
  'plans/scanner-wave1.json',
  'plans/scanner-wave2.json',
  'plans/scanner-etf-fallback.json',
  'plans/scanner-final-evidence.json',
  'plans/retro.json',
]) {
  const source = fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
  assert(!source.includes('"covers_close"'), `${relative} must not use legacy covers_close`);
  assert(source.includes('"equity_reference_close"'), `${relative} must name the US close reference explicitly`);
}

const sweepSource = fs.readFileSync(path.join(__dirname, 'sweep.js'), 'utf8');
assert.match(sweepSource, /const requireCertifiedClose = options\.requireCertifiedClose === true \|\| FROZEN_ONLY/);
assert.match(sweepSource, /classifyBarsDailyCalendar\(ticker\)[\s\S]{0,600}assetCalendar: 'us_equity_exchange_sessions'[\s\S]{0,400}assetCalendar: 'crypto_24_7_utc'/,
  'equities and crypto must use distinct completed-close calendars');
assert.doesNotMatch(sweepSource, /todo\.filter\(ticker => !isCryptoTicker\(ticker\)\)/,
  'foreign exchange tickers must never fall through to the US calendar merely because they are not crypto');
assert.match(sweepSource, /buildBarsDailyArgs\(batch\.symbols, SWEEP_AS_OF_TIMESTAMP, 140\)/,
  'sweep QueryData requests must use the shared as_of_timestamp and completed_only builder');
assert.match(sweepSource, /if \(FROZEN_ONLY\) throw new Error\(`\$\{ticker\}: uncertified OHLC fallback is disabled/,
  'frozen/release path must fail before Yahoo or Binance fallback');
assert.match(sweepSource, /trackedPositions\.filter\(position => position\.execution_verified === true\)/,
  'only broker-verified positions may enter completed-close MtM');
assert.doesNotMatch(sweepSource, /current_price[^\n]{0,120}(?:open|high|low|close):/,
  'current_price must never be expanded into a synthetic OHLC close');

const ingestSource = fs.readFileSync(path.join(__dirname, 'ingest-collection.js'), 'utf8');
assert.match(ingestSource, /marketdataBarsContract\.validateGetStatus/,
  'authenticated-agent ingestion must validate operation-scoped readiness and the audited build');
assert.match(ingestSource, /marketdataBarsContract\.validateQueryData/,
  'authenticated-agent ingestion must validate completed-only bar proofs');
assert.match(ingestSource, /completion_policy: call\.args\?\.completion_policy/,
  'authenticated-agent harnesses must preserve the completed-only policy');

for (const script of ['tools/scan-plan.js', 'tools/scan-ingest-all.js']) {
  const disabled = spawnSync(process.execPath, [script], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
  assert.strictEqual(disabled.status, 2, `${script} legacy CLI must fail closed`);
  assert((disabled.stdout + disabled.stderr).includes('legacy scan-plan/scan-ingest-all pipeline disabled'));
}

console.log('marketdata bars contract tests: PASS');
