#!/usr/bin/env node
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { audit, evaluate, levels, validate } = require('./audit-scanner-universe');
const { stableStringify } = require('./lib/workflow-contract');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scanner-universe-audit-'));
const repository = path.resolve(__dirname, '..');
const filters = JSON.parse(fs.readFileSync(path.join(repository, 'data/scanner-filters.json')));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
let assertions = 0;
const check = (label, fn) => { fn(); assertions++; console.log(`PASS ${label}`); };
const put = (name, data) => { const file = path.join(root, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data)); return sha(fs.readFileSync(file)); };
const ref = '2026-09-04', dir = 'scanner/20260908';
const b = Array.from({ length: 40 }, (_, i) => [new Date(Date.UTC(2026, 6, 27 + i)).toISOString().slice(0, 10), 100, 101, 99, 100, 1000000]);
assert.strictEqual(b.at(-1)[0], ref);
const technical = { atr: 2, rsi: 60, ema50: 100, ema200: 100, as_of: ref };
const row = { symbol: 'AAA', as_of: ref, estimated_valid_bars: 5, last_price: 100, avg_volume: 1000000, market_cap: 1e9, score: 80, strategy: 'custom_dsl', editorial_strategy: 'Momentum' };
const barSet = { symbol: 'AAA', served_completed_end: ref, bars: b };
function setup() {
  put('data/scanner-filters.json', filters);
  const evidence = { fixture: true }, evidenceHash = put('data/overlay-evidence.json', evidence);
  put(filters.audit_gates.recent_strategy_performance.source, { evidence_source: 'data/overlay-evidence.json', evidence_sha256: evidenceHash, policies: [] });
  put(filters.anti_duplicate.check_file, { open_positions: [] });
  seal('_data', [{ as: 'screen_momentum_us', server: 'marketdata', tool: 'RunScreener', args: { region: 'US', asset: 'stock', score_expr: 'rsi14 + 15', timeframe: '1d' }, freshness: { required: true } }], {
    screen_momentum_us: { data: { items: [{ candidates: [{ ...row, symbol: 'BBB' }, row] }] } }
  });
  seal('_data2', [
    { as: 'tech_b1', server: 'marketdata', tool: 'QueryData', args: {}, freshness: { required: true } },
    { as: 'bars_b1', server: 'marketdata', tool: 'QueryData', args: {}, freshness: { required: true } }
  ], {
    tech_b1: { data: { items: [{ results: [{ data_type: 'technicals', data: ['AAA', 'BBB'].map(symbol => ({ symbol, ...technical })) }] }] } },
    bars_b1: { data: { items: [{ results: [{ data_type: 'bars_daily', data: ['AAA', 'BBB'].map(symbol => ({ ...barSet, symbol })) }] }] } }
  });
}
function seal(sub, inputs, bodies) {
  const plan = `plans/${sub}.json`, resolved = { equity_reference_close: ref, waves: [{ calls: inputs }] };
  const planHash = put(plan, resolved), inputHash = sha(stableStringify(resolved));
  const sources = Object.entries(bodies).map(([name, body]) => ({ name, sha256: put(`${dir}/${sub}/${name}.json`, body) }));
  put(`${dir}/${sub}/harness.json`, { workflow: 'scanner', reference_close: ref, plan, plan_sha256: planHash, input_sha256: inputHash, sources });
  put(`${dir}/${sub}/_collect.json`, { workflow: 'scanner', reference_date: ref, plan, plan_sha256: planHash, input_sha256: inputHash, resolved_input: resolved,
    waves: [{ calls: sources.map(s => ({ as: s.name, ok: true, output_sha256: s.sha256 })) }] });
}
const run = () => audit({ root, dir, referenceClose: ref, regime: 'RISK-ON' });
try {
  setup();
  check('rounded levels preserve builder noise-floor geometry', () => {
    const l = levels(b, technical, filters);
    assert.strictEqual(l.entry, 100); assert.strictEqual(l.stop, 97);
    assert.strictEqual(l.tp1, Math.round((100 + filters.editorial_targets.tp1_reachability.target_atr_multiple * 2) * 100) / 100);
    assert.strictEqual(l.rr_entry, Math.round((l.tp1 - 100) / 3 * 100) / 100);
  });
  check('same family score ties break by ticker', () => {
    const x = run(); assert.strictEqual(x.errors.length, 0);
    assert.deepStrictEqual(x.candidates.map(c => [c.ticker, c.family_rank]), [['AAA', 1], ['BBB', 2]]);
    assert(x.candidates.every(c => c.family.startsWith('dsl:')));
  });
  check('SEC/earnings never pass from silence', () => {
    const x = run(); assert.strictEqual(x.actionability_certified, false); assert.deepStrictEqual(x.eligible, []);
    assert(x.candidates.every(c => c.status === 'needs_verification' && c.gates.sec_review.status === 'unknown' && c.gates.earnings_review.status === 'unknown'));
  });
  check('identical inputs give identical audit bytes', () => assert.strictEqual(JSON.stringify(run()), JSON.stringify(run())));
  check('valid sources validate locally', () => assert.deepStrictEqual(validate(run(), root, ref), []));
  check('missing regime never assumes a risk label or RR threshold', () => assert.strictEqual(evaluate(row, technical, barSet, filters, null, ref).gates.rr.status, 'unknown'));
  check('explicit directory validation also recomputes the full audit', () => assert.deepStrictEqual(validate(run(), root, ref, dir), []));
  check('modified candidate status and counts cannot inherit source-only PASS', () => {
    const x = run(); x.candidates[0].status = 'rejected'; x.counts = { rejected: x.candidates.length };
    assert(validate(x, root, ref).some(e => e.includes('recomputation mismatch')));
  });
  check('a rejected candidate cannot be promoted to numeric PASS', () => {
    const file = `${dir}/_data/screen_momentum_us.json`;
    const body = JSON.parse(fs.readFileSync(path.join(root, file)));
    body.data.items[0].candidates[0].estimated_valid_bars = 0;
    const collector = JSON.parse(fs.readFileSync(path.join(root, dir, '_data/_collect.json')));
    seal('_data', collector.resolved_input.waves[0].calls, { screen_momentum_us: body });
    const x = run(), candidate = x.candidates.find(c => c.status === 'rejected');
    assert(candidate, 'fixture must contain an actual rejection');
    candidate.status = 'needs_verification'; candidate.numeric_status = 'passed';
    candidate.failed_gates = []; candidate.gates.screen_validity.status = 'passed';
    x.numerically_passed.push({ ticker: candidate.ticker, family: candidate.family, family_rank: candidate.family_rank });
    assert(validate(x, root, ref, dir).some(e => e.includes('recomputation mismatch')));
    setup();
  });
  check('modified ranking or derived metrics cannot inherit PASS', () => {
    for (const field of ['rank', 'metric']) {
      const x = run();
      if (field === 'rank') x.candidates[0].family_rank = 42;
      else x.candidates[0].metrics.rr_entry = 99;
      assert(validate(x, root, ref).some(e => e.includes('recomputation mismatch')));
    }
  });
  check('unknown technical basis is rejected', () => {
    const x = run(); x.technical_basis = 'trust_me';
    assert(validate(x, root, ref).some(e => e.includes('technical basis')));
  });
  check('explicit directory must match the archived source directory', () => {
    assert(validate(run(), root, ref, 'scanner/20260909').some(e => e.includes('directory')));
  });
  check('missing technicals remain unknown', () => assert.strictEqual(evaluate(row, null, barSet, filters, 'RISK-ON', ref).gates.enrichment.status, 'unknown'));
  check('NaN ATR never passes arithmetic gates', () => assert.strictEqual(evaluate(row, { ...technical, atr: NaN }, barSet, filters, 'RISK-ON', ref).gates.level_calculation.status, 'unknown'));
  check('NaN derived liquidity never passes', () => assert.strictEqual(evaluate(row, { ...technical, adv20_usd: NaN }, barSet, filters, 'RISK-ON', ref).gates.liquidity.status, 'unknown'));
  check('incorrect completed bars date rejects', () => assert.strictEqual(evaluate(row, technical, { ...barSet, served_completed_end: '2026-09-03' }, filters, 'RISK-ON', ref).gates.bars_date.status, 'failed'));
  check('incorrect technical reference date rejects', () => assert.strictEqual(evaluate(row, { ...technical, as_of: '2026-09-03' }, barSet, filters, 'RISK-ON', ref).gates.technical_date.status, 'failed'));
  check('incorrect screener reference date rejects', () => assert.strictEqual(evaluate({ ...row, as_of: '2026-09-03' }, technical, barSet, filters, 'RISK-ON', ref).gates.screen_date.status, 'failed'));
  check('missing validity is unknown, zero is expired', () => {
    assert.strictEqual(evaluate({ ...row, estimated_valid_bars: undefined }, technical, barSet, filters, 'RISK-ON', ref).gates.screen_validity.status, 'unknown');
    assert.strictEqual(evaluate({ ...row, estimated_valid_bars: 0 }, technical, barSet, filters, 'RISK-ON', ref).gates.screen_validity.status, 'failed');
  });
  check('invalid calendar date rejected at CLI boundary', () => assert.throws(() => audit({ root, dir, referenceClose: '2026-02-30', regime: 'RISK-ON' }), /Invalid/));
  check('snapshot reference mismatch fails validation', () => assert(validate(run(), root, '2026-09-03').some(e => e.includes('reference'))));
  check('archived source mutation blocks rerun and snapshot validation', () => {
    const x = run(); put(`${dir}/_data/screen_momentum_us.json`, {});
    assert(run().errors.some(e => e.includes('hash'))); assert(validate(x, root, ref).some(e => e.includes('hash'))); setup();
  });
  check('collector reference mismatch blocks', () => {
    const file = `${dir}/_data/_collect.json`, x = JSON.parse(fs.readFileSync(path.join(root, file))); x.reference_date = '2026-09-03'; put(file, x);
    assert(run().errors.some(e => e.includes('reference'))); setup();
  });
  check('missing wave2 reports not_ready without reading old supplement', () => {
    fs.renameSync(path.join(root, dir, '_data2'), path.join(root, dir, '_old_data2'));
    const x = run(); assert.strictEqual(x.status, 'not_ready'); assert.deepStrictEqual(x.missing_waves, ['_data2']);
    assert(x.candidates.every(c => c.gates.enrichment.status === 'unknown')); assert(validate(x, root, ref).some(e => e.includes('wave')));
    fs.renameSync(path.join(root, dir, '_old_data2'), path.join(root, dir, '_data2'));
  });
  check('different captured formulas never share a ranking family', () => {
    seal('_data', ['screen_momentum_us', 'screen_pullback_us'].map((as, i) => ({ as, server: 'marketdata', tool: 'RunScreener', args: { region: 'US', asset: 'stock', score_expr: i ? '65-rsi14' : 'rsi14+15' }, freshness: { required: true } })), {
      screen_momentum_us: { data: { items: [{ candidates: [row] }] } },
      screen_pullback_us: { data: { items: [{ candidates: [{ ...row, symbol: 'BBB', score: 20 }] }] } }
    });
    const x = run(); assert.strictEqual(x.families.length, 2); assert(x.candidates.every(c => c.family_rank === 1)); setup();
  });
  check('unknown DSL formula not silently labeled editorial', () => {
    seal('_data', [{ as: 'screen_momentum_us', server: 'marketdata', tool: 'RunScreener', args: { region: 'US', asset: 'stock' }, freshness: { required: true } }], { screen_momentum_us: { data: { items: [{ candidates: [row] }] } } });
    const c = run().candidates[0]; assert.strictEqual(c.family, null); assert.strictEqual(c.family_rank, null); assert.strictEqual(c.gates.score_family.status, 'unknown'); setup();
  });
  check('failed governing call blocks all candidate actionability', () => {
    const file = `${dir}/_data/_collect.json`, x = JSON.parse(fs.readFileSync(path.join(root, file))); x.waves[0].calls[0].ok = false; put(file, x);
    assert(run().errors.some(e => e.includes('required call'))); setup();
  });
  check('derived mode never falls back to server technicals when archive missing', () => {
    const x = audit({ root, dir, referenceClose: ref, regime: 'RISK-ON', useDerived: true });
    assert(x.errors.some(e => e.includes('derived technicals')));
    assert(x.candidates.every(c => c.gates.history_continuity.status === 'unknown' && c.status === 'blocked_source_integrity'));
    assert.deepStrictEqual(x.numerically_passed, []);
  });
  console.log(`${assertions} tests PASS`);
} finally { fs.rmSync(root, { recursive: true, force: true }); }
