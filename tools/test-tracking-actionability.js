#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { extractAllFromDir, isActionableScanDir } = require('./update-tracking');
const { parseScan } = require('./sweep');
const parser = require('./lib/scanner-parser');

// 20260908 keeps eight original signals for audit, but its review contract has
// no orders and expressly denies actionability. It must never enter C history.
assert.strictEqual(parser.loadSignals('20260908').signals.length, 8, 'sealed review evidence changed');
assert.strictEqual(isActionableScanDir('20260908'), false);
assert.deepStrictEqual(extractAllFromDir('20260908'), []);
assert.strictEqual(parseScan('20260908'), null);

// A genuine sealed historical edition remains eligible for tracking/simulation.
assert.strictEqual(isActionableScanDir('20260831'), true);
assert(extractAllFromDir('20260831').length > 0, 'published historical signals were removed');
assert(parseScan('20260831')?.setups.length > 0, 'sweep lost published historical setups');
console.log('tracking actionability tests: PASS');
