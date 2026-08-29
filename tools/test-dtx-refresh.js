#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { healthState } = require('./dtx-refresh-if-stale');
assert.deepStrictEqual(healthState({ ok: true, freshness_ok: true, behind_expected: false, last_data_date: '2026-08-28', prefetch: { running: false } }, '2026-08-28'), {
  ok: true, last_data_date: '2026-08-28', prefetch_running: false,
});
assert.strictEqual(healthState({ ok: true, freshness_ok: true, behind_expected: false, last_data_date: '2026-08-27', prefetch: { running: false } }, '2026-08-28').ok, false);
assert.strictEqual(healthState({ ok: true, freshness_ok: true, behind_expected: false, last_data_date: '2026-08-28', prefetch: { running: true } }, '2026-08-28').ok, false);
assert.strictEqual(healthState({ ok: true, freshness_ok: true, behind_expected: true, last_data_date: '2026-08-28', prefetch: { running: false } }, '2026-08-28').ok, false);
assert.strictEqual(healthState({ last_data_date: '2026-08-28', prefetch: { running: false } }, '2026-08-28').ok, false);
assert.strictEqual(healthState({ ok: true, freshness_ok: true, behind_expected: false, last_data_date: '2026-08-28' }, '2026-08-28').ok, false);
assert.strictEqual(healthState({ ok: true, freshness_ok: true, behind_expected: false, last_data_date: '2026-08-29', prefetch: { running: false } }, '2026-08-28').ok, false);
console.log('dtx refresh tests: PASS');
