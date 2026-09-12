#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  indexSupplement, fullSessionFiveMinuteBars, supplement, requiredSessionSet,
} = require('./build-retro-intraday-supplement');
const { US_REGULAR_15M, LSE_REGULAR_15M } = require('./lib/retro-intraday');

function timestamp(date, hour, minute, offset) {
  return new Date(Date.UTC(date.slice(0, 4), Number(date.slice(5, 7)) - 1, date.slice(8, 10), hour, minute + offset)).toISOString().replace('.000Z', 'Z');
}

// August 2026 is EDT and BST: UTC starts are 13:30 NY and 07:00 London.
function fiveMinuteSession(ticker, date = '2026-08-28', contract = US_REGULAR_15M) {
  const [hour, minute] = contract === LSE_REGULAR_15M ? [7, 0] : [13, 30];
  return Array.from({ length: contract.expectedTimes.length * 3 }, (_, index) => {
    const value = 10 + index / 10;
    return [timestamp(date, hour, minute, index * 5), value, value + 2, value - 1, value + 0.5, 100 + index];
  });
}

const fullFive = fiveMinuteSession('AAA');
const indexed = indexSupplement({ results: [{ symbol: 'AAA', data: fullFive }] });
const aggregate = fullSessionFiveMinuteBars(indexed.sessions['2026-08-28'].AAA, '2026-08-28', US_REGULAR_15M, 'AAA');
assert.equal(aggregate.ok, true);
assert.equal(aggregate.bars.length, 26);
assert.deepStrictEqual(aggregate.bars[0], {
  timestamp: '2026-08-28T13:30:00Z', open: 10, high: 12.2, low: 9, close: 10.7, volume: 303,
}, 'first/max/min/last/sum must form the 15m OHLCV bar');

const lseFive = fiveMinuteSession('GLEN.L', '2026-08-28', LSE_REGULAR_15M);
const lseIndexed = indexSupplement({ symbol: 'GLEN.L', bars: lseFive });
const lseAggregate = fullSessionFiveMinuteBars(lseIndexed.sessions['2026-08-28']['GLEN.L'], '2026-08-28', LSE_REGULAR_15M, 'GLEN.L');
assert.equal(lseAggregate.ok, true);
assert.equal(lseAggregate.bars.length, 34, 'GLEN.L must retain the 34-bar London contract');

const incompleteBase = { schema_version: 1, source_artifacts: [{ path: 'base.json', sha256: 'a'.repeat(64), reference_close: '2026-09-11' }], sessions: {
  '2026-08-28': { AAA: aggregate.bars.slice(0, -1) },
} };
const repaired = supplement(incompleteBase, { symbol: 'AAA', bars: fullFive }, { referenceClose: '2026-09-11' });
assert.equal(repaired.diagnostics.repaired_sessions.length, 1);
assert.equal(repaired.output.sessions['2026-08-28'].AAA.length, 26);
assert.equal(repaired.output.sessions['2026-08-28'].AAA[0].volume, 303);

const missing = structuredClone(fullFive);
missing.splice(4, 1);
const missingResult = supplement(incompleteBase, { symbol: 'AAA', bars: missing }, { referenceClose: '2026-09-11' });
assert.equal(missingResult.diagnostics.repaired_sessions.length, 0, 'a session missing a 5m candle is rejected');
assert.equal(missingResult.output.sessions['2026-08-28'].AAA.length, 25, 'incomplete base must remain untouched after a rejected supplement');

const duplicate = structuredClone(fullFive);
duplicate.push(structuredClone(duplicate[0]));
assert.throws(() => indexSupplement({ symbol: 'AAA', bars: duplicate }), /duplicate 5m bar/, 'duplicate supplemental bars must fail closed');
const conflictingDuplicate = structuredClone(fullFive);
const altered = structuredClone(conflictingDuplicate[0]);
altered[4] += 0.25;
conflictingDuplicate.push(altered);
assert.throws(() => indexSupplement({ symbol: 'AAA', bars: conflictingDuplicate }), /duplicate 5m bar/, 'a duplicate timestamp with conflicting prices must fail closed');

const offBoundary = structuredClone(fullFive);
offBoundary[12][0] = '2026-08-28T14:30:23Z';
assert.throws(() => indexSupplement({ symbol: 'AAA', bars: offBoundary }), /not on a 5m boundary/, 'RTH 5m bars must have exact minute boundaries');

const quantum = structuredClone(fullFive);
quantum[0][3] = 10.0001;
const quantumIndexed = indexSupplement({ symbol: 'AAA', bars: quantum });
assert.equal(quantumIndexed.sessions['2026-08-28'].AAA[0].low, 10, 'a one-quantum provider rounding defect is canonically repaired');
assert.deepStrictEqual({ ...quantumIndexed.ohlcQuantumCorrections[0], delta: undefined }, {
  date: '2026-08-28', ticker: 'AAA', timestamp: '2026-08-28T13:30:00Z', field: 'low', from: 10.0001, to: 10, delta: undefined,
});
assert(Math.abs(quantumIndexed.ohlcQuantumCorrections[0].delta - 0.0001) < 1e-9);
const beyondQuantum = structuredClone(fullFive);
beyondQuantum[0][3] = 10.0002;
assert.throws(() => indexSupplement({ symbol: 'AAA', bars: beyondQuantum }), /OHLCV bounds invalid/, 'larger price defects must fail closed');

const conflictBase = structuredClone(incompleteBase);
conflictBase.sessions['2026-08-28'].AAA[0].close += 1;
const conflict = supplement(conflictBase, { symbol: 'AAA', bars: fullFive }, { referenceClose: '2026-09-11' });
assert.equal(conflict.diagnostics.overlap_price_conflicts.length, 1);
assert.equal(conflict.diagnostics.repaired_sessions.length, 1, 'a full session replaces incomplete partial-cache overlaps atomically');
assert.equal(conflict.output.sessions['2026-08-28'].AAA[0].close, aggregate.bars[0].close);

const healthyBase = { sessions: { '2026-08-28': { AAA: aggregate.bars } } };
const healthy = supplement(healthyBase, { symbol: 'AAA', bars: fullFive.map(row => [row[0], row[1] + 50, row[2] + 50, row[3] + 50, row[4] + 50, row[5]]) }, { referenceClose: '2026-09-11' });
assert.equal(healthy.diagnostics.healthy_sessions_preserved.length, 1);
assert.deepStrictEqual(healthy.output.sessions['2026-08-28'].AAA, healthyBase.sessions['2026-08-28'].AAA, 'healthy sessions must remain immutable');

const offBoundaryBase = structuredClone(healthyBase);
offBoundaryBase.sessions['2026-08-28'].AAA[0].timestamp = '2026-08-28T13:30:23Z';
const baseBoundary = supplement(offBoundaryBase, { symbol: 'AAA', bars: fullFive }, { referenceClose: '2026-09-11' });
assert.equal(baseBoundary.diagnostics.repaired_sessions.length, 1, 'an irregular 15m base timestamp is incomplete and may be atomically replaced');

const required = requiredSessionSet({ reference_close: '2026-09-11', sessions: { '2026-08-28': ['AAA'] } }, '2026-09-11');
const absent = supplement({ sessions: {} }, { symbol: 'AAA', bars: fullFive }, { referenceClose: '2026-09-11', requiredSessions: required });
assert.equal(absent.diagnostics.repaired_sessions.length, 1, 'the explicit required scope can repair an absent base session');
assert.equal(absent.output.sessions['2026-08-28'].AAA.length, 26);

console.log('retro intraday supplement tests: PASS');
