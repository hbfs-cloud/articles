'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const ROOT = path.resolve(__dirname, '../..');
const { loadScannerScope } = require('../lib/scanner-scope');
const ARG = '--scope=scanner/20260908/_scope.json';
const scopeDoc = { date: '20260908', refdate: '2026-09-04', excluded_components: ['dtx'],
  user_instruction: 'skip cette partie du scanner fait le reste en dehors de dtx', all_other_gates_required: true };
function write(root, relative, value) {
  const p = path.join(root, relative); fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, typeof value === 'string' ? value : JSON.stringify(value));
}
function fixture(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'scanner-scope-test-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, 'scanner/20260908/_scope.json', scopeDoc);
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/modes-config.json')));
  write(root, 'data/modes-config.json', config);
  write(root, 'config/us-market-calendar.json', fs.readFileSync(path.join(ROOT, 'config/us-market-calendar.json'), 'utf8'));
  fs.mkdirSync(path.join(root, 'tools'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'tools/lib'), path.join(root, 'tools/lib'), { recursive: true });
  for (const f of ['config.js', 'sweep.js', 'gen-api.js', 'gen-mode-cards.js', 'gen-status-page.js', 'gen-track-record.js', 'qa-check.js']) {
    fs.copyFileSync(path.join(ROOT, 'tools', f), path.join(root, 'tools', f));
  }
  return root;
}
function run(root, script, args = []) {
  return cp.spawnSync(process.execPath, [path.join(root, 'tools', script), ...args], {
    cwd: root, encoding: 'utf8', timeout: 20000, maxBuffer: 3 * 1024 * 1024,
    env: { PATH: process.env.PATH, HOME: root, NODE_OPTIONS: '' },
  });
}
test('default does not infer a waiver from a scope file; DTX remains in scope', t => {
  const root = fixture(t), scope = loadScannerScope(root, []);
  assert.equal(scope.active, false);
  assert.equal(scope.excludesMode('best', { assetClass: 'dtx' }), false);
  const modes = { best: { assetClass: 'dtx' }, balanced: { assetClass: 'equity' } };
  assert.equal(scope.filterModes(modes), modes);
});
test('scope binds the calendar, folder, instruction and exact DTX-only boundary', t => {
  const root = fixture(t);
  for (const delta of [{ date: '20260909' }, { refdate: '2026-09-07' },
    { excluded_components: ['dtx', 'marketdata'] }, { excluded_components: [] },
    { user_instruction: '' }, { all_other_gates_required: false }]) {
    write(root, 'scanner/20260908/_scope.json', { ...scopeDoc, ...delta });
    assert.throws(() => loadScannerScope(root, [ARG]));
  }
  write(root, 'scanner/20260908/_scope.json', scopeDoc);
  assert.throws(() => loadScannerScope(root, [ARG, ARG]));
  assert.throws(() => loadScannerScope(root, ['--scope']));
  const scope = loadScannerScope(root, [ARG]);
  assert.equal(scope.audit.refdate, '2026-09-04'); // Labor Day is not a completed close.
  assert.match(scope.audit.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(scope.filterModes({ best: { stats: {} }, balanced: { stats: {} } })), ['balanced']);
});
test('preserving DTX results never replaces history with new computations', t => {
  const root = fixture(t), scope = loadScannerScope(root, [ARG]);
  const old = { frozen_best: { value: 7 }, advisor_best: null, advisor_best_relaxed: [1] };
  const output = { frozen_best: { value: 999 }, advisor_best: [9], frozen_balanced: { value: 12 } };
  scope.preserveDtxResults(output, old);
  assert.deepEqual(output, { ...old, frozen_balanced: { value: 12 } });
});
test('every downstream executable rejects malformed scope before doing work', t => {
  const root = fixture(t);
  write(root, 'scanner/20260908/_scope.json', { ...scopeDoc, all_other_gates_required: false });
  for (const script of ['sweep.js', 'gen-api.js', 'gen-mode-cards.js', 'gen-status-page.js', 'qa-check.js']) {
    const result = run(root, script, [ARG]);
    assert.notEqual(result.status, 0, script);
    assert.match(result.stderr, /Scope must retain every other gate/, script);
    assert.equal(fs.existsSync(path.join(root, 'portfolio/v1')), false);
  }
});
test('actual API render leaves DTX endpoints byte-identical while refreshing non-DTX', t => {
  const root = fixture(t);
  const history = path.join(ROOT, 'scanner/status/history');
  const latest = fs.readdirSync(history).filter(f => /^\d{8}\.json$/.test(f)).sort().pop();
  write(root, 'scanner/status/history/' + latest, fs.readFileSync(path.join(history, latest), 'utf8'));
  write(root, 'portfolio/v1/best/orders.json', 'PRESERVE DTX ORDERS\n');
  write(root, 'portfolio/v1/best/equity.json', 'PRESERVE DTX EQUITY\n');
  const scoped = run(root, 'gen-api.js', [ARG]);
  assert.equal(scoped.status, 0, scoped.stderr + scoped.stdout);
  assert.equal(fs.readFileSync(path.join(root, 'portfolio/v1/best/orders.json'), 'utf8'), 'PRESERVE DTX ORDERS\n');
  assert.equal(fs.readFileSync(path.join(root, 'portfolio/v1/best/equity.json'), 'utf8'), 'PRESERVE DTX EQUITY\n');
  assert.equal(fs.existsSync(path.join(root, 'portfolio/v1/balanced/equity.json')), true);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'portfolio/v1/status.json'))).modes.best, undefined);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'portfolio/v1/modes.json'))).modes.some(m => m.id === 'best'), false);
  // The same actual generator, without scope, still renders best.
  const normal = run(root, 'gen-api.js');
  assert.equal(normal.status, 0, normal.stderr + normal.stdout);
  assert.notEqual(fs.readFileSync(path.join(root, 'portfolio/v1/best/equity.json'), 'utf8'), 'PRESERVE DTX EQUITY\n');
});
test('actual sweep parser excludes only DTX, retaining ordinary and other pools', t => {
  const root = fixture(t);
  const signal = { ticker: 'AAPL', score: 91, strategy: 'breakout', entry: 100, stop: 95, tp1: 110, tp2: 115, rr: 2 };
  write(root, 'scanner/20260908/signals.json', { signals: [signal], regime: 'risk_on',
    dtx_pool: [{ ...signal, ticker: 'MSFT', universe: 'best', strategy: 'dtx_engine', source: 'dtx_pool' }],
    crypto_pool: [{ ...signal, ticker: 'BTC-USD', strategy: 'momentum' }] });
  const invoke = scoped => cp.spawnSync(process.execPath, ['-e',
    `${scoped ? 'process.argv.push("scope-test",' + JSON.stringify(ARG) + ');' : ''}const s=require('./tools/sweep'); console.log('RESULT='+JSON.stringify(s.parseScan('20260908')));`],
    { cwd: root, encoding: 'utf8', timeout: 10000, env: { PATH: process.env.PATH, HOME: root } });
  const normal = invoke(false), scoped = invoke(true);
  assert.equal(normal.status, 0, normal.stderr); assert.equal(scoped.status, 0, scoped.stderr);
  const parse = result => JSON.parse(result.stdout.split('RESULT=')[1]);
  const a = parse(normal), b = parse(scoped);
  assert.equal(a.dtxPool.length, 1); assert.equal(b.dtxPool.length, 0);
  assert.deepEqual(a.setups, b.setups); assert.deepEqual(a.cryptoPool, b.cryptoPool);
  assert.equal(b.cryptoPool.length, 1);
});
test('QA reports six DTX waivers and still fails strict for non-DTX defects', t => {
  const root = fixture(t);
  write(root, 'scanner/20260908/signals.json', { signals: [], dtx_pool: [] });
  write(root, 'scanner/status/index.html', '<html><body>Missing ordinary scanner panels</body></html>');
  write(root, 'scanner/20260908/index.html', '<html>intentionally invalid fixture</html>');
  const scoped = run(root, 'qa-check.js', ['--strict', ARG]);
  assert.equal(scoped.status, 1, scoped.stderr + scoped.stdout);
  assert.match(scoped.stdout, /6 WAIVED \(excluded from PASS\/check totals\)/);
  assert.match(scoped.stdout, /WAIVED dtx: staging/);
  assert.match(scoped.stdout, /Mode strict — exit 1/);
  const normal = run(root, 'qa-check.js', ['--strict']);
  assert.equal(normal.status, 1);
  assert.doesNotMatch(normal.stdout, /WAIVED/);
});
