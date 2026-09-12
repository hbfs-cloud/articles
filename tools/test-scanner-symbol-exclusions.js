#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadScannerSymbolExclusions } = require('./lib/scanner-symbol-exclusions');

const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'scanner-symbol-exclusions-')));
const rel = 'scanner/20260914/_symbol-exclusions.json';
const target = path.join(root, rel);
fs.mkdirSync(path.dirname(target), { recursive: true });

const valid = {
  date: '20260914',
  refdate: '2026-09-11',
  symbols: ['EDP.LS', 'GLEN.L', 'HTFL', 'BSOL', 'BEX'],
  user_instruction: 'skip ce qui pose pb pour EDP/Glencore et les 3 données manquantes, on ne les considere pas',
  preserve_existing_records: true,
  all_other_gates_required: true,
};
const write = document => fs.writeFileSync(target, JSON.stringify(document, null, 2) + '\n');
const load = args => loadScannerSymbolExclusions(root, args);

write(valid);
const inactive = load([]);
assert.strictEqual(inactive.active, false, 'a manifest must not activate exclusions without an explicit option');
const unfiltered = ['EDP.LS', 'AAPL'];
assert.deepStrictEqual(inactive.filterSymbols(unfiltered), unfiltered, 'inactive exclusions must be a no-op');
assert.strictEqual(inactive.excludesSymbol('EDP.LS'), false, 'inactive exclusions must not infer exclusions');
assert.doesNotThrow(() => inactive.assertReference('1900-01-01'), 'inactive exclusions must not impose a reference');

const active = load([`--symbol-exclusions=${rel}`]);
assert.strictEqual(active.active, true);
assert.deepStrictEqual(active.audit.symbols, valid.symbols);
assert.strictEqual(active.audit.preserve_existing_records, true);
assert.strictEqual(active.audit.all_other_gates_required, true);
assert.strictEqual(active.excludesSymbol('edp.ls'), true, 'ticker matching may normalize caller casing');
assert.strictEqual(active.excludesSymbol('AAPL'), false);
const candidates = ['AAPL', 'EDP.LS', 'GLEN.L'];
assert.deepStrictEqual(active.filterSymbols(candidates), ['AAPL'], 'only explicitly listed symbols may be filtered');
assert.deepStrictEqual(candidates, ['AAPL', 'EDP.LS', 'GLEN.L'], 'filtering candidates must not mutate prior records');
assert.doesNotThrow(() => active.assertReference('2026-09-11'));
assert.throws(() => active.assertReference('2026-09-10'), /refdate mismatch/);
const previousRecords = [
  { ticker: 'AAPL', status: 'open' },
  { ticker: 'EDP.LS', status: 'closed', pnl: 0, stamped_at: '2026-09-10T20:00:00Z' },
  { ticker: 'MSFT', status: 'open' },
];
const currentRecords = [
  { ticker: 'AAPL', status: 'open' },
  { ticker: 'EDP.LS', status: 'new-and-untrusted' },
  { ticker: 'GLEN.L', status: 'new-and-untrusted' },
  { ticker: 'MSFT', status: 'open' },
];
const preserved = active.preserveExcludedRecords(currentRecords, previousRecords);
assert.deepStrictEqual(preserved, previousRecords, 'excluded records must be restored byte-for-byte from prior state at their prior index');
assert.notStrictEqual(preserved[1], previousRecords[1], 'restored history must be deep-cloned before later callers can mutate it');
assert.deepStrictEqual(currentRecords[1], { ticker: 'EDP.LS', status: 'new-and-untrusted' }, 'current records must not be mutated');
assert.deepStrictEqual(inactive.preserveExcludedRecords(currentRecords, previousRecords), currentRecords, 'inactive preservation must remain a no-op');

assert.throws(() => load(['--symbol-exclusions=../outside.json']), /real scanner/);
write({ ...valid, date: '20260915' });
assert.throws(() => load([`--symbol-exclusions=${rel}`]), /date must match/);
write({ ...valid, refdate: '2026-09-14' });
assert.throws(() => load([`--symbol-exclusions=${rel}`]), /refdate must precede/);
write({ ...valid, symbols: ['EDP.LS', 'EDP.LS'] });
assert.throws(() => load([`--symbol-exclusions=${rel}`]), /unique/);
write({ ...valid, symbols: ['bad ticker'] });
assert.throws(() => load([`--symbol-exclusions=${rel}`]), /Invalid excluded symbol/);
write({ ...valid, preserve_existing_records: false });
assert.throws(() => load([`--symbol-exclusions=${rel}`]), /preserve existing records/);
write({ ...valid, all_other_gates_required: false });
assert.throws(() => load([`--symbol-exclusions=${rel}`]), /retain every other gate/);

console.log('scanner symbol exclusions: PASS');
