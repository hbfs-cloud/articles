'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { compactAuthority, readMarketdata } = require('../regime-reconcile');
const ROOT = path.resolve(__dirname, '../..');
const bytes = fs.readFileSync(path.join(__dirname, 'fixtures/regime-compact.json'));
const source = JSON.parse(bytes), fresh = () => structuredClone(source);
function workspace(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'compact-regime-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, '_data')); return dir;
}
function write(dir, name, data) { fs.writeFileSync(path.join(dir, '_data', name), JSON.stringify(data)); }
function overview() {
  // Historical overview contract, before compact model_status/coverage metadata.
  const { as_of, benchmarks, component_scores, engine, regime, regime_score, region, scale, type } = source.facets.regime.dtx_regime;
  return { data: { items: [{ as_of, benchmarks, component_scores, engine, regime, regime_score, region, scale, type }] } };
}
test('fixture exactly matches archived capture hash and provenance', () => {
  const p = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/regime-compact.provenance.json')));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), p.sha256);
  assert.equal(source.captured_at, p.captured_at);
});
test('exact nested authority, not zero-valued conditional parent, supplies 76.96 bullish', () => {
  const out = compactAuthority(fresh(), '2026-09-04');
  assert.equal(out.ok, true); assert.equal(out.authoritative, true);
  assert.equal(out.bullish, source.facets.regime.dtx_regime.regime_score * 100);
  assert.equal(out.engine, 'facets.regime.dtx_regime'); assert.equal(out.dataAsof, '2026-09-04');
  assert.equal(out.confidence, null); assert.equal(out.probabilities, null);
  assert.notEqual(out.bullish, 100 - source.facets.regime.regime_score);
});
test('dividend, VIX degradation and stale BTC caveats survive authority parsing', () => {
  const out = compactAuthority(fresh(), '2026-09-04');
  for (const expected of ['Dividendes', 'VIX', 'BTC']) assert(out.warnings.some(w => w.includes(expected)));
  assert(out.warnings.some(w => w.includes('2026-09-03')));
});
const mutations = [
  ['future BTC coverage', x => { x.facets.regime.dtx_regime.dtx_detail.benchmark_coverage.btc.end = '2026-09-06'; }],
  ['unfinished asof-day BTC coverage', x => { x.facets.regime.dtx_regime.dtx_detail.benchmark_coverage.btc.end = '2026-09-04'; }],
  ['stale BTC coverage', x => { x.facets.regime.dtx_regime.dtx_detail.benchmark_coverage.btc.end = '2026-09-02'; }],
  ['absent BTC coverage with liquidity included', x => { delete x.facets.regime.dtx_regime.dtx_detail.benchmark_coverage.btc; }],
  ['wrong BTC symbol', x => { x.facets.regime.dtx_regime.dtx_detail.benchmark_coverage.btc.symbol = 'ETH-USD'; }],
  ['wrong BTC benchmark mapping', x => { x.facets.regime.dtx_regime.benchmarks.btc = 'ETH-USD'; }],
  ['BTC equity calendar', x => { x.facets.regime.dtx_regime.dtx_detail.benchmark_coverage.btc.calendar = 'us_equity'; }],
  ['BTC missing day', x => { x.facets.regime.dtx_regime.dtx_detail.benchmark_coverage.btc.missing_sessions = 1; }],
  ['BTC noncontiguous coverage', x => { x.facets.regime.dtx_regime.dtx_detail.benchmark_coverage.btc.contiguous = false; }],
  ['BTC incorrect day count', x => { const c = x.facets.regime.dtx_regime.dtx_detail.benchmark_coverage.btc; c.bars = c.expected_sessions = 294; }],
  ['BTC invalid start', x => { x.facets.regime.dtx_regime.dtx_detail.benchmark_coverage.btc.start = '2026-02-30'; }],
  ['wrong engine', x => { x.facets.regime.dtx_regime.engine = 'context_conditional'; }],
  ['wrong scale', x => { x.facets.regime.dtx_regime.scale = '0-100 defensiveness'; }],
  ['wrong model', x => { x.facets.regime.dtx_regime.model = 'other'; }],
  ['failed model status', x => { x.facets.regime.dtx_regime.model_status = 'degraded'; }],
  ['missing model status', x => { delete x.facets.regime.dtx_regime.model_status; }],
  ['wrong region', x => { x.facets.regime.dtx_regime.region = 'EU'; }],
  ['unfinished outer response', x => { x.status = 'partial'; }],
  ['unfinished facet', x => { x.facets.regime.status = 'partial'; }],
  ['score string', x => { x.facets.regime.dtx_regime.regime_score = '0.77'; }],
  ['score NaN', x => { x.facets.regime.dtx_regime.regime_score = NaN; }],
  ['score outside range', x => { x.facets.regime.dtx_regime.regime_score = 77; }],
  ['negative score', x => { x.facets.regime.dtx_regime.regime_score = -0.1; }],
  ['wrong model date', x => { x.facets.regime.dtx_regime.as_of = '2026-09-03T23:59:59Z'; }],
  ['wrong parent date', x => { x.facets.regime.as_of = '2026-09-03T23:59:59Z'; }],
  ['unknown label', x => { x.facets.regime.dtx_regime.regime = 'boom'; }],
  ['missing benchmark', x => { delete x.facets.regime.dtx_regime.dtx_detail.benchmark_coverage.hyg; }],
  ['wrong benchmark identity', x => { x.facets.regime.dtx_regime.dtx_detail.benchmark_coverage.hyg.symbol = 'SPY'; }],
  ['wrong benchmark mapping', x => { x.facets.regime.dtx_regime.benchmarks.hyg = 'SPY'; }],
  ['stale benchmark', x => { x.facets.regime.dtx_regime.dtx_detail.benchmark_coverage.lqd.end = '2026-09-03'; }],
  ['noncontiguous benchmark', x => { x.facets.regime.dtx_regime.dtx_detail.benchmark_coverage.spx.contiguous = false; }],
  ['missing benchmark session', x => { x.facets.regime.dtx_regime.dtx_detail.benchmark_coverage.tlt.missing_sessions = 1; }],
  ['wrong calendar', x => { x.facets.regime.dtx_regime.dtx_detail.benchmark_coverage.dxy.calendar = 'daily_247'; }],
  ['self-consistent but false session count', x => { const c = x.facets.regime.dtx_regime.dtx_detail.benchmark_coverage.vix; c.bars = c.expected_sessions = 331; }],
  ['absent exact path with valid nested decoy', x => { x.other = x.facets.regime.dtx_regime; delete x.facets.regime.dtx_regime; }],
];
for (const [name, mutate] of mutations) test(`rejects ${name}`, () => {
  const x = fresh(); mutate(x); const out = compactAuthority(x, '2026-09-04');
  assert.equal(out.ok, false); assert.equal(out.authoritative, false); assert(out.why);
});
test('missing or invalid reference date cannot validate compact source', () => {
  assert.equal(compactAuthority(fresh(), null).ok, false);
  assert.equal(compactAuthority(fresh(), '2026-02-30').ok, false);
});
test('readMarketdata accepts exact compact path in regime_authority including result envelope', t => {
  const dir = workspace(t); write(dir, 'regime_authority.json', { result: fresh() });
  assert.equal(readMarketdata(dir, '2026-09-04').engine, 'facets.regime.dtx_regime');
});
test('valid historical overview remains accepted', t => {
  const dir = workspace(t); write(dir, 'overview.json', overview());
  const out = readMarketdata(dir, '2026-09-04'); assert.equal(out.ok, true); assert.equal(out.engine, 'overview.regime');
});
test('invalid present authority cannot fall back silently to valid old overview', t => {
  const dir = workspace(t), x = fresh(); x.facets.regime.dtx_regime.scale = 'bad';
  write(dir, 'regime_authority.json', x); write(dir, 'overview.json', overview());
  assert.equal(readMarketdata(dir, '2026-09-04').ok, false);
});
test('defensiveness context remains informative and nonauthoritative', t => {
  const dir = workspace(t); write(dir, 'regime_marketdata.json', fresh());
  const out = readMarketdata(dir, '2026-09-04');
  assert.equal(out.ok, true); assert.equal(out.authoritative, false); assert.equal(out.scale, 'defensiveness_0_100');
});
test('CLI without systematic retains all authority warnings and model asof', t => {
  const root = workspace(t), article = path.join(root, 'scanner/20260908');
  fs.mkdirSync(path.join(article, '_data'), { recursive: true }); write(article, 'regime_authority.json', fresh());
  for (const relative of ['tools/regime-reconcile.js', 'tools/lib/market-calendar.js', 'tools/lib/scanner-scope.js', 'config/us-market-calendar.json', 'data/scanner-filters.json', 'data/modes-config.json']) {
    const target = path.join(root, relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(ROOT, relative), target);
  }
  const result = spawnSync(process.execPath, [path.join(root, 'tools/regime-reconcile.js'), '--dir', 'scanner/20260908', '--refdate', '2026-09-04', '--json'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const out = JSON.parse(result.stdout);
  assert.equal(out.regimeScore, 77); assert.equal(out.dataAsof, '2026-09-04'); assert.equal(out.crossCheck, null);
  for (const expected of ['Dividendes', 'VIX', 'BTC']) assert(out.notes.some(n => n.includes(expected)));
  fs.unlinkSync(path.join(article, '_data/regime_authority.json')); write(article, 'regime_marketdata.json', fresh());
  const rejected = spawnSync(process.execPath, [path.join(root, 'tools/regime-reconcile.js'), '--dir', 'scanner/20260908', '--refdate', '2026-09-04', '--json'], { encoding: 'utf8' });
  assert.equal(rejected.status, 1); const blocked = JSON.parse(rejected.stdout);
  assert.equal(blocked.regimeScore, null); assert.equal(blocked.regime, null);
});

test('scope skips even malformed old systematic but retains marketdata authority and warnings', t => {
  const root = fs.realpathSync(workspace(t)), article = path.join(root, 'scanner/20260908');
  fs.mkdirSync(path.join(article, '_data'), { recursive: true }); write(article, 'regime_authority.json', fresh());
  for (const relative of ['tools/regime-reconcile.js', 'tools/lib/market-calendar.js', 'tools/lib/scanner-scope.js', 'config/us-market-calendar.json', 'data/scanner-filters.json', 'data/modes-config.json']) {
    const target = path.join(root, relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(ROOT, relative), target);
  }
  const scope = { date: '20260908', refdate: '2026-09-04', excluded_components: ['dtx'], user_instruction: 'skip DTX seulement', all_other_gates_required: true };
  fs.writeFileSync(path.join(article, '_scope.json'), JSON.stringify(scope));
  const args = [path.join(root, 'tools/regime-reconcile.js'), '--dir', 'scanner/20260908', '--refdate', '2026-09-04', '--json'];
  const scoped = [...args, '--scope=scanner/20260908/_scope.json'];
  write(article, 'regime_systematic.json', { regime: 'RISK_ON', regime_score: 0.8, data_asof: '2026-09-03', sessions_behind: 1 });
  const baseline = spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.equal(baseline.status, 1); assert(JSON.parse(baseline.stdout).blockers.some(b => b.includes('systematic')));
  fs.writeFileSync(path.join(article, '_data/regime_systematic.json'), 'invalid JSON: must never be read under scope');
  const result = spawnSync(process.execPath, scoped, { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const out = JSON.parse(result.stdout);
  assert.equal(out.scope.component, 'dtx'); assert.equal(out.scope.status, 'WAIVED'); assert.equal(out.crossCheck, null);
  assert.equal(out.regimeScore, 77); assert(out.notes.some(n => n.includes('ancien fichier non lu')));
  for (const expected of ['Dividendes', 'VIX', 'BTC']) assert(out.notes.some(n => n.includes(expected)));
  const invalid = fresh(); invalid.facets.regime.dtx_regime.dtx_detail.benchmark_coverage.btc.end = '2026-09-06';
  write(article, 'regime_authority.json', invalid);
  const rejected = spawnSync(process.execPath, scoped, { encoding: 'utf8' });
  assert.equal(rejected.status, 1); assert(JSON.parse(rejected.stdout).blockers.some(b => b.includes('btc')));
  write(article, 'regime_authority.json', fresh());
  const wrongRef = scoped.map(s => s === '2026-09-04' ? '2026-09-03' : s);
  const mismatch = spawnSync(process.execPath, wrongRef, { encoding: 'utf8' });
  assert.equal(mismatch.status, 1); assert.match(mismatch.stderr, /Scope must match/);
  fs.writeFileSync(path.join(article, '_scope.json'), JSON.stringify({ ...scope, excluded_components: ['dtx', 'earnings'] }));
  const expanded = spawnSync(process.execPath, scoped, { encoding: 'utf8' });
  assert.equal(expanded.status, 1); assert.match(expanded.stderr, /exactly/);
});
