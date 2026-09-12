#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { build, collect } = require('./build-intraday-retro-input');
const { sessionCoverageError } = require('./lib/retro-intraday');
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
  ['2026-08-28T07:00:00Z', 1, 2, 1, 2, 10],
  ['2026-08-28T15:30:00Z', 2, 3, 2, 3, 11],
] };
assert.strictEqual(collect(londonShape).length, 2, 'a non-US listing must retain its provider bars rather than applying the NY RTH filter');
const bars = Array.from({ length: 26 }, (_, index) => ({
  timestamp: new Date(Date.UTC(2026, 7, 28, 13, 30 + index * 15)).toISOString(),
  open: 1, high: 2, low: 1, close: 2,
}));
assert.strictEqual(sessionCoverageError(bars, '2026-08-28'), null);
const duplicate = structuredClone(bars); duplicate[25].timestamp = duplicate[24].timestamp;
assert.strictEqual(sessionCoverageError(duplicate, '2026-08-28'), 'rth_15m_sequence_invalid');
const extended = structuredClone(bars); extended[0].timestamp = '2026-08-28T12:00:00.000Z';
assert.strictEqual(sessionCoverageError(extended, '2026-08-28'), 'rth_15m_sequence_invalid');
console.log('intraday retro input tests: PASS');
