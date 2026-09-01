#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { validateQueryDataCells } = require('./lib/marketdata-querydata-contract');

const ROOT = path.resolve(__dirname, '..');

function result(type, cells, data) {
  return { data_type: type, status: 'completed', cells, data };
}

function completed(symbol, extra = {}) {
  return { symbol, status: 'completed', ...extra };
}

function row(symbol, extra = {}) {
  return { symbol, value: 1, ...extra };
}

// The same symbol legitimately appears once per requested facet. Uniqueness is
// scoped to data_type, not flattened across the complete QueryData response.
const multiFacet = { results: [
  result('technicals', [completed('AAPL'), completed('NVDA')], [row('AAPL'), row('NVDA')]),
  result('flags', [completed('AAPL'), completed('NVDA')], [row('AAPL'), row('NVDA')]),
] };
const multiCheck = validateQueryDataCells(multiFacet, {
  symbols: 'AAPL,NVDA', types: 'technicals,flags',
});
assert.deepStrictEqual(multiCheck.errors, []);
assert.strictEqual(multiCheck.healthyCells.length, 4);

const instrumentId = validateQueryDataCells({ results: [
  result('sec_filings', [{ instrument_id: 'CIK:320193', status: 'completed' }], [
    { instrument_id: 'CIK:320193', filings: [] },
  ]),
] }, { symbols: 'CIK:320193', types: 'sec_filings' });
assert.deepStrictEqual(instrumentId.errors, []);

const noData = validateQueryDataCells({ results: [
  result('flags', [{ symbol: 'AAPL', status: 'completed_without_data' }], []),
] }, { symbols: 'AAPL', types: 'flags' });
assert(noData.errors.some(error => error.includes('completed_without_data is forbidden')));

const missingRow = validateQueryDataCells({ results: [
  result('flags', [completed('AAPL')], []),
] }, { symbols: 'AAPL', types: 'flags' });
assert(missingRow.errors.some(error => error.includes('exactly one identified data row (got 0)')));

const duplicateRow = validateQueryDataCells({ results: [
  result('flags', [completed('AAPL')], [row('AAPL'), row('AAPL', { value: 2 })]),
] }, { symbols: 'AAPL', types: 'flags' });
assert(duplicateRow.errors.some(error => error.includes('exactly one identified data row (got 2)')));

const missingId = validateQueryDataCells({ results: [
  result('flags', [{ status: 'completed' }], [{ value: 1 }]),
] }, { symbols: 'AAPL', types: 'flags' });
assert(missingId.errors.some(error => error.includes('cell missing symbol/instrument_id')));
assert(missingId.errors.some(error => error.includes('data row missing symbol/instrument_id')));

const pending = validateQueryDataCells({ results: [
  result('flags', [{ symbol: 'AAPL', status: 'pending' }], []),
] }, { symbols: 'AAPL', types: 'flags' });
assert(pending.errors.some(error => error.includes('non-terminal or unknown cell status pending')));

const aggregatePartial = validateQueryDataCells({ results: [{
  ...result('flags', [completed('AAPL')], [row('AAPL')]), status: 'partial', total_failed: 1,
}] }, { symbols: 'AAPL', types: 'flags' });
assert(aggregatePartial.errors.some(error => error.includes('QueryData result is not completed (partial)')));

// A partial aggregate fails the call while preserving the completed sibling
// for audit/persistence and identifying the failed sibling independently.
const aggregateMixed = validateQueryDataCells({ results: [{
  ...result('flags', [
    completed('AAPL'),
    {
      symbol: 'NVDA',
      status: 'failed',
      rejection_reason: 'upstream timeout',
      retry_at: '2026-09-01T12:30:00Z',
    },
  ], [row('AAPL')]),
  status: 'partial',
  total_failed: 1,
}] }, { symbols: 'AAPL,NVDA', types: 'flags' });
assert(aggregateMixed.errors.some(error => error.includes('QueryData result is not completed (partial)')));
assert(aggregateMixed.errors.some(error => error.includes('NVDA: failed: upstream timeout')));
assert.deepStrictEqual(aggregateMixed.healthyCells.map(cell => cell.id), ['AAPL']);
assert.deepStrictEqual(aggregateMixed.failedCells.map(cell => cell.id), ['NVDA']);
assert.strictEqual(aggregateMixed.retryAt, '2026-09-01T12:30:00Z');

const notApplicableBad = validateQueryDataCells({ results: [
  result('flags', [{ symbol: 'AAPL', status: 'not_applicable' }], []),
] }, { symbols: 'AAPL', types: 'flags' });
assert(notApplicableBad.errors.some(error => error.includes('missing not_applicable_reason')));
const notApplicableGood = validateQueryDataCells({ results: [
  result('flags', [{
    symbol: 'AAPL', status: 'not_applicable', not_applicable_reason: 'unsupported instrument',
  }], []),
] }, { symbols: 'AAPL', types: 'flags' });
assert.deepStrictEqual(notApplicableGood.errors, []);
assert.strictEqual(notApplicableGood.healthyCells[0].status, 'not_applicable');

const failureWithoutReason = validateQueryDataCells({ results: [
  result('sec_filings', [{ symbol: 'AAPL', status: 'failed' }], []),
] }, { symbols: 'AAPL', types: 'sec_filings' });
assert(failureWithoutReason.errors.some(error => error.includes('missing rejection_reason/structured error')));

// One failed cell fails the call, but the completed sibling remains available
// and the supplied raw response is not mutated or filtered.
const mixed = { results: [result('sec_filings', [
  completed('AAPL'),
  { symbol: 'NVDA', status: 'unavailable', error: { code: 'SEC_UPSTREAM', retryable: true }, retry_at: '2026-09-01T12:00:00Z' },
], [row('AAPL', { filings: [] })])] };
const mixedRaw = JSON.stringify(mixed);
const mixedCheck = validateQueryDataCells(mixed, {
  symbols: 'AAPL,NVDA', types: 'sec_filings',
});
assert(mixedCheck.errors.some(error => error.includes('NVDA: unavailable')));
assert.deepStrictEqual(mixedCheck.healthyCells.map(cell => cell.id), ['AAPL']);
assert.deepStrictEqual(mixedCheck.failedCells.map(cell => cell.id), ['NVDA']);
assert.strictEqual(mixedCheck.retryAt, '2026-09-01T12:00:00Z');
assert.strictEqual(JSON.stringify(mixed), mixedRaw, 'validation must preserve the complete raw batch');

const duplicateCell = validateQueryDataCells({ results: [
  result('flags', [completed('AAPL'), completed('AAPL')], [row('AAPL')]),
] }, { symbols: 'AAPL', types: 'flags' });
assert(duplicateCell.errors.some(error => error.includes('duplicate terminal cells')));
assert(duplicateCell.errors.some(error => error.includes('expected exactly one terminal cell (got 2)')));

const missingType = validateQueryDataCells({ results: [
  result('technicals', [completed('AAPL')], [row('AAPL')]),
] }, { symbols: 'AAPL', types: 'technicals,flags' });
assert(missingType.errors.some(error => error.includes('flags: expected exactly one QueryData result (got 0)')));
assert(validateQueryDataCells({}, { symbols: 'AAPL', types: 'flags' }).errors
  .some(error => error.includes('no cell results')));

const marketLevel = validateQueryDataCells({ results: [{
  data_type: 'economic_events', status: 'completed', temporal_mode: 'current',
  data: { type: 'economic_events', status: 'available', events: [] },
}] }, { types: 'economic_events' });
assert.deepStrictEqual(marketLevel.errors, []);
assert.deepStrictEqual(marketLevel.healthyCells.map(cell => cell.id), ['__market__']);
const emptyMarketLevel = validateQueryDataCells({ results: [{
  data_type: 'economic_events', status: 'completed', data: null,
}] }, { types: 'economic_events' });
assert(emptyMarketLevel.errors.some(error => error.includes('completed result has no data payload')));
const forbiddenMarketAbsence = validateQueryDataCells({ results: [{
  data_type: 'economic_events', status: 'completed_without_data', data: null,
}] }, { types: 'economic_events' });
assert(forbiddenMarketAbsence.errors.some(error => error.includes('completed_without_data is forbidden')));

// Integration invariant: collect persists the complete response and its hash
// before the semantic failure branch marks the call/run failed.
const collectSource = fs.readFileSync(path.join(ROOT, 'tools/collect.js'), 'utf8');
assert.match(collectSource, /marketdataQueryDataContract\.validateQueryDataCells/);
const preserveStart = collectSource.indexOf('Persist the complete response before applying semantic gates');
const writeRaw = collectSource.indexOf('fs.writeFileSync(path.join(outDir, `${r.as}.json`), sourceBody);', preserveStart);
const markPreserved = collectSource.indexOf('waveLog.calls[i].artifact_preserved = true;', preserveStart);
const countFailure = collectSource.indexOf('failures++; continue;', markPreserved);
assert(preserveStart >= 0 && writeRaw > preserveStart && markPreserved > writeRaw && countFailure > markPreserved,
  'mixed QueryData must preserve raw output before marking the call/run failed');

const ingestSource = fs.readFileSync(path.join(ROOT, 'tools/ingest-collection.js'), 'utf8');
assert.match(ingestSource, /marketdataQueryDataContract\.validateQueryDataCells/,
  'authenticated-agent ingestion must enforce the same terminal-cell contract as direct collection');
assert.match(ingestSource, /pagination\?\.has_next === true/,
  'authenticated-agent ingestion must reject incomplete MCP pagination');

console.log('marketdata generic QueryData terminal contract tests: PASS');
