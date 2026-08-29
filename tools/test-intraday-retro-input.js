#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { build } = require('./build-intraday-retro-input');
const { sessionCoverageError } = require('./lib/retro-intraday');
const result = build({ results: [{ symbol: 'TEST', data: { bars: [
  { timestamp: '2026-08-28T13:30:00Z', open: 1, high: 2, low: 1, close: 2 },
] } }] });
assert.strictEqual(result.sessions['2026-08-28'].TEST[0].timestamp, '2026-08-28T13:30:00Z');
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
