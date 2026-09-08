'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { cacheAgeMinutes } = require('../lib/collect-cache-age');
const now = Date.parse('2026-09-08T07:00:00Z');
test('copied old response stays old regardless of fresh filesystem metadata', () => {
  assert(cacheAgeMinutes({ captured_at: '2026-09-05T22:23:24Z', mtime: now }, now) > 180);
});
test('fresh captured response remains usable', () => assert.equal(cacheAgeMinutes({ captured_at: '2026-09-08T06:59:00Z' }, now), 1));
test('missing, malformed and future captures never provide cache age', () => {
  for (const v of [{}, null, { captured_at: 'bad' }, { captured_at: 123 }, { captured_at: '2026-09-09T00:00:00Z' }]) assert.equal(cacheAgeMinutes(v, now), null);
});
test('supported envelopes use their actual capture', () => {
  for (const k of ['data','result']) assert.equal(cacheAgeMinutes({ [k]: { captured_at: '2026-09-08T06:58:00Z' } }, now), 2);
});
