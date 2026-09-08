'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { emaSeries, wilder, deriveOne, deriveAll, compareServer, validateArtifact } = require('../derive-scanner-technicals');
const { previousUSTradingDay } = require('../lib/market-calendar');
const { stableStringify } = require('../lib/workflow-contract');
const ROOT = path.resolve(__dirname, '../..'), ref = '2026-09-04', dir = 'scanner/20260908';
const dates = [ref]; while (dates.length < 300) dates.unshift(previousUSTradingDay(dates[0]));
function record() {
  return { symbol: 'AAA', status: 'completed', served_completed_end: ref, expected_completed_end: ref, sessions_complete: true,
    current_bar_included: false, asset_calendar: 'us_equity_exchange_sessions',
    coverage: { complete: true, served_end: ref, expected_session_end: ref, missing_ranges: [], observations: 300, served_start: dates[0] },
    bars: dates.map(d => [d, 100, 101, 99, 100, 1000000]) };
}
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
function fixture(t, { sourceDir = '_verify', plan = sourceDir === '_verify' ? 'plans/scanner-verify-candidates.json' : 'plans/scanner-wave2.json', alias = sourceDir === '_verify' ? 'history_b1' : 'bars_b1', limit = 300 } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'derive-technicals-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const put = (name, value) => { const file = path.join(root, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value)); return sha(fs.readFileSync(file)); };
  put('config/us-market-calendar.json', JSON.parse(fs.readFileSync(path.join(ROOT, 'config/us-market-calendar.json'))));
  function seal(rows = [record()]) {
    const resolved = { equity_reference_close: ref, waves: [{ calls: [{ as: alias, server: 'marketdata', tool: 'QueryData', args: { types: 'bars_daily', symbols: 'AAA', limit, completion_policy: 'completed_only', as_of_timestamp: ref + 'T23:59:59Z' } }] }] };
    const ph = put(plan, resolved), ih = sha(stableStringify(resolved));
    const bh = put(`${dir}/${sourceDir}/${alias}.json`, { data: { items: [{ results: [{ data_type: 'bars_daily', data: rows }] }] } });
    put(`${dir}/${sourceDir}/harness.json`, { workflow: 'scanner', plan, reference_close: ref, input_sha256: ih, plan_sha256: ph, sources: [{ name: alias, sha256: bh }] });
    put(`${dir}/${sourceDir}/_collect.json`, { workflow: 'scanner', plan, reference_date: ref, finished_at: '2026-09-08T01:00:00Z', resolved_input: resolved, input_sha256: ih, plan_sha256: ph, waves: [{ calls: [{ as: alias, ok: true, output_sha256: bh }] }] });
  }
  seal(); return { root, put, seal, run: () => deriveAll({ root, dir, referenceClose: ref, sourceDir }) };
}
test('EMA seed and recurrence are explicit and exact', () => assert.deepEqual(emaSeries([1, 3, 5], 3), [1, 2, 3.5]));
test('Wilder seeds 14 observations then smooths, not a rolling simple average', () => assert.equal(wilder([...Array(14).fill(1), 15]), 2));
test('constant prices yield neutral RSI, zero MACD and exact ATR/ADV/consolidation', () => {
  const v = deriveOne(record(), ref);
  assert.equal(v.atr, 2); assert.equal(v.rsi, 50); assert(Math.abs(v.ema200 - 100) < 1e-12);
  assert(Math.abs(v.macd) < 1e-12); assert(Math.abs(v.signal) < 1e-12); assert.equal(v.adv20_usd, 100000000);
  assert.equal(v.consolidation_bars, 15); assert.equal(v.bars_used, 300); assert.equal(v.as_of, ref);
});
test('rising and falling series reach RSI boundary without NaN', () => {
  for (const direction of [1, -1]) {
    const r = record(); r.bars = dates.map((d, i) => { const c = 500 + direction * i; return [d, c, c + 1, c - 1, c, 1000]; });
    const out = deriveOne(r, ref); assert.equal(out.rsi, direction > 0 ? 100 : 0); assert(Number.isFinite(out.signal));
    assert.equal(Math.sign(out.macd), direction);
  }
});
test('rounding anomalies are preserved as original data and explicit diagnostics', () => {
  const r = record(); r.bars[250][4] = 101.0001; const before = JSON.stringify(r);
  const out = deriveOne(r, ref); assert.equal(JSON.stringify(r), before); assert.equal(out.bars[250][4], 101.0001);
  assert.equal(out.diagnostics.upstream_rounding_anomalies.length, 1); assert.equal(out.diagnostics.upstream_rounding_anomalies[0].treatment, 'retained_unchanged');
});
const negatives = [
  ['299 bars', r => { r.bars.shift(); r.coverage.observations = 299; r.coverage.served_start = r.bars[0][0]; }],
  ['non-finite close', r => { r.bars[20][4] = NaN; }],
  ['null close', r => { r.bars[20][4] = null; }],
  ['negative volume', r => { r.bars[20][5] = -1; }],
  ['zero price', r => { r.bars[20][4] = 0; }],
  ['material OHLC bound error', r => { r.bars[20][4] = 101.01; }],
  ['high below low', r => { r.bars[20][2] = 98; }],
  ['duplicate date', r => { r.bars[20][0] = r.bars[19][0]; }],
  ['weekend bar', r => { r.bars[20][0] = '2025-07-26'; }],
  ['future bar', r => { r.bars[299][0] = '2026-09-08'; }],
  ['wrong reference certification', r => { r.served_completed_end = '2026-09-03'; }],
  ['incomplete session', r => { r.sessions_complete = false; }],
  ['included current bar', r => { r.current_bar_included = true; }],
  ['wrong calendar', r => { r.asset_calendar = 'daily_247'; }],
  ['incomplete coverage', r => { r.coverage.complete = false; }],
  ['metadata count mismatch', r => { r.coverage.observations = 301; }],
  ['noncontiguous 300 bars despite complete metadata', r => { const gap = r.bars[20][0]; r.bars.splice(20, 1); const earlier = previousUSTradingDay(r.bars[0][0]); r.bars.unshift([earlier, 100, 101, 99, 100, 1000]); r.coverage.served_start = earlier; return gap; }],
];
for (const [name, mutate] of negatives) test(`rejects ${name}`, () => {
  const r = record(), gap = mutate(r);
  assert.throws(() => deriveOne(r, ref), gap ? error => error.message.includes(gap) : undefined);
});
test('invalid date rejected before computing any indicator', () => assert.throws(() => deriveOne(record(), '2026-02-30')));
test('server comparisons are diagnostic only with undated source preserved', () => {
  const v = deriveOne(record(), ref), result = compareServer(v, { path: 'tech.json', sha256: 'abc', temporalMode: 'current', data: { atr: 3, as_of: null, bars_used: 300 } });
  assert.equal(result.status, 'diagnostic_only'); assert.equal(result.server_as_of, null); assert.equal(result.fields.atr.difference, -1);
  assert.equal(result.fields.ema20.server, null); assert.equal(compareServer(v, null).status, 'unavailable');
});
test('certified fixture derives deterministically with source hashes and formulas', t => {
  const f = fixture(t), a = f.run(); assert.equal(a.status, 'ready'); assert.equal(a.counts.derived, 1);
  assert.deepEqual(a, f.run()); assert.equal(a.actionability_certified, false); assert(a.formulas.ema.includes('first archived close'));
  assert.deepEqual(validateArtifact(a, f.root, ref), []);
});
test('source mutation fails both build and hash validation', t => {
  const f = fixture(t), a = f.run(); f.put(`${dir}/_verify/history_b1.json`, {});
  assert.throws(f.run, /hash/); assert(validateArtifact(a, f.root, ref).some(e => e.includes('hash')));
});
test('wrong reference in collector is rejected', t => {
  const f = fixture(t), file = `${dir}/_verify/_collect.json`, x = JSON.parse(fs.readFileSync(path.join(f.root, file)));
  x.reference_date = '2026-09-03'; f.put(file, x); assert.throws(f.run, /reference/);
});
test('unregistered plan rejected even if collector and harness both changed', t => {
  const f = fixture(t); for (const name of ['_collect.json', 'harness.json']) {
    const file = `${dir}/_verify/${name}`, x = JSON.parse(fs.readFileSync(path.join(f.root, file))); x.plan = 'plans/other.json'; f.put(file, x);
  }
  assert.throws(f.run, /required source plan/);
});
test('duplicate symbols never use last-write-wins', t => { const f = fixture(t); f.seal([record(), record()]); assert.throws(f.run, /duplicate/); });
test('missing requested symbol produces explicit partial artifact', t => {
  const f = fixture(t); f.seal([]); const a = f.run(); assert.equal(a.status, 'partial'); assert.equal(a.counts.derived, 0);
  assert.match(a.rejected[0].reason, /absent/); assert(validateArtifact(a, f.root, ref).some(e => e.includes('incomplete')));
});
test('insufficient bars preserve rejection and never insert fabricated technicals', t => {
  const f = fixture(t), r = record(); r.bars.shift(); r.coverage.observations = 299; r.coverage.served_start = r.bars[0][0]; f.seal([r]);
  const a = f.run(); assert.equal(a.status, 'partial'); assert.equal(a.symbols.AAA, undefined); assert.match(a.rejected[0].reason, /fewer/);
});

test('wave2 bars source derives same indicators under its exact registered contract', t => {
  const verify = fixture(t), wave2 = fixture(t, { sourceDir: '_data2' });
  const a = verify.run(), b = wave2.run();
  assert.equal(a.source_directory, '_verify'); assert.equal(a.source_plan, 'plans/scanner-verify-candidates.json');
  assert.equal(b.source_directory, '_data2'); assert.equal(b.source_plan, 'plans/scanner-wave2.json');
  assert.equal(b.status, 'ready');
  for (const field of ['atr', 'rsi', 'ema20', 'ema50', 'ema200', 'macd', 'signal', 'adv20_usd', 'consolidation_bars']) assert.equal(a.symbols.AAA[field], b.symbols.AAA[field]);
  assert.deepEqual(validateArtifact(b, wave2.root, ref, '_data2'), []);
  assert(validateArtifact(b, wave2.root, ref, '_verify').some(e => e.includes('directory/plan')));
});
for (const sourceDir of ['_verify', '_data2']) {
  test(`${sourceDir} rejects the other source plan even with consistent metadata hashes`, t => {
    const plan = sourceDir === '_verify' ? 'plans/scanner-wave2.json' : 'plans/scanner-verify-candidates.json';
    const f = fixture(t, { sourceDir, plan }); assert.throws(f.run, /required source plan/);
  });
  test(`${sourceDir} rejects the other source alias`, t => {
    const alias = sourceDir === '_verify' ? 'bars_b1' : 'history_b1';
    const f = fixture(t, { sourceDir, alias }); assert.throws(f.run, /unexpected history alias/);
  });
  for (const limit of [120, 299, 301, '300']) test(`${sourceDir} rejects limit=${JSON.stringify(limit)} despite 300 response rows`, t => {
    const f = fixture(t, { sourceDir, limit }); assert.throws(f.run, /unsupported history input contract/);
  });
}
test('source directory is explicit closed enum, with no path or prototype aliases', t => {
  const f = fixture(t);
  for (const sourceDir of ['../_data2', '_other', 'constructor', '/tmp/_data2', 'scanner/20260908/_data2']) {
    assert.throws(() => deriveAll({ root: f.root, dir, referenceClose: ref, sourceDir }), /Unsupported --source-dir/);
  }
});
test('source contract metadata cannot be relabeled after derivation', t => {
  const f = fixture(t, { sourceDir: '_data2' }), a = f.run(); a.source_plan = 'plans/scanner-verify-candidates.json';
  assert(validateArtifact(a, f.root, ref).some(e => e.includes('directory/plan')));
});
