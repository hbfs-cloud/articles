#!/usr/bin/env node
'use strict';

/**
 * lessons-engine.test.js — Unit tests for tools/lessons-engine.js
 *
 * Plain node assert runner (no test framework dependency), matching the
 * convention in tools/signal-monitor.test.js.
 *
 * Run: node tools/lessons-engine.test.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const engine = require('./lessons-engine.js');

let passed = 0;
let failed = 0;

function assert(condition, name, detail) {
  if (condition) {
    console.log(`  PASS  ${name}`);
    passed++;
  } else {
    console.error(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

// ─── Fixtures ──────────────────────────────────────────────────────────────

function marketTruthRule(overrides = {}) {
  return Object.assign({
    id: 'test-market-truth',
    class: 'market_truth',
    status: 'active',
    severity: 'selection_filter',
    rule: 'Test rule statement.',
    scope: { setups: [], regimes: [], modes: [] },
    effect: { action: 'reject_below_score', target: {}, params: {} },
    evidence: { sample_size: null, wins: null, losses: null, expectancy: null, period: null, tickers: [], clusters: [], source_retros: [] },
    confidence: 0.7,
    confidence_base: 0.7,
    half_life_days: 90,
    created_at: '2026-01-01',
    last_validated_at: '2026-01-01',
    expires_at: '2026-06-01',
    invalidation_conditions: [],
    notes: '',
  }, overrides);
}

function processRule(overrides = {}) {
  return Object.assign({
    id: 'test-process-rule',
    class: 'process_rule',
    status: 'active',
    severity: 'hard_block',
    rule: 'Test process invariant.',
    scope: { setups: [], regimes: [], modes: [] },
    effect: { action: 'data_integrity_check', target: {}, params: {} },
    evidence: { sample_size: null, wins: null, losses: null, expectancy: null, period: null, tickers: [], clusters: [], source_retros: [] },
    confidence: 0.7,
    confidence_base: 0.7,
    half_life_days: null,
    created_at: '2026-01-01',
    last_validated_at: '2026-01-01',
    expires_at: null,
    invalidation_conditions: [],
    notes: '',
  }, overrides);
}

function freshData(rules) {
  return { _open_questions: [], rules };
}

// ─── Test 1: old unvalidated rule loses confidence ──────────────────────────

console.log('\nTest 1: Vieille règle non validée perd confidence');
{
  const rule = marketTruthRule({ id: 'r1', confidence: 0.7, confidence_base: 0.7, half_life_days: 90, last_validated_at: '2026-01-01' });
  const data = freshData([rule]);
  const { changes } = engine.decay(data, { asOfDate: '2026-04-01' }); // 90 days later = exactly 1 half-life
  assert(rule.confidence < 0.7, 'confidence decreased after --decay with no revalidation', `confidence=${rule.confidence}`);
  assert(Math.abs(rule.confidence - 0.35) < 0.01, 'confidence ≈ base/2 after exactly 1 half-life (90d)', `confidence=${rule.confidence}`);
  assert(changes.some(c => c.id === 'r1' && c.event === 'confidence_decay'), 'decay() reports a confidence_decay change');
}

// ─── Test 2: expired rule excluded from active report ───────────────────────

console.log('\nTest 2: Règle expirée exclue du report actif');
{
  const stillGood = marketTruthRule({ id: 'r2a', status: 'active', expires_at: '2026-12-01' });
  const overdue = marketTruthRule({ id: 'r2b', status: 'active', expires_at: '2026-01-15' });
  const data = freshData([stillGood, overdue]);
  const activeList = engine.getEffectivelyActiveRules(data, '2026-06-01');
  assert(activeList.some(r => r.id === 'r2a'), 'non-expired active rule included');
  assert(!activeList.some(r => r.id === 'r2b'), 'expired active rule excluded from effectively-active report');
}

// ─── Test 3: rule without metrics cannot be promoted ────────────────────────

console.log('\nTest 3: Règle sans métriques ne peut pas être promue');
{
  const rule = marketTruthRule({
    id: 'r3', status: 'candidate',
    evidence: { sample_size: null, wins: null, losses: null, expectancy: null, period: null, tickers: [], clusters: [], source_retros: [] },
    scope: { setups: [], regimes: ['RISK-ON', 'NEUTRAL'], modes: [] },
  });
  const data = freshData([rule]);
  const result = engine.promote(data, { id: 'r3', asOfDate: '2026-06-01' });
  assert(result.ok === false, 'promotion refused for rule with no evidence');
  assert(result.missing.length > 0, 'refusal lists missing gates', JSON.stringify(result.missing));
  assert(rule.status === 'candidate', 'rule status untouched on refused promotion');
}

// ─── Test 4: mono-ticker rule refused promotion ─────────────────────────────

console.log('\nTest 4: Règle mono-ticker refusée à la promotion');
{
  const rule = marketTruthRule({
    id: 'r4', status: 'candidate',
    evidence: { sample_size: 15, wins: 10, losses: 5, expectancy: 1.2, period: '2026-01-01 to 2026-03-01', tickers: ['AAPL'], clusters: ['tech', 'ai'], source_retros: ['20260101'] },
    scope: { setups: [], regimes: ['RISK-ON', 'NEUTRAL'], modes: [] },
  });
  const data = freshData([rule]);
  const result = engine.promote(data, { id: 'r4', asOfDate: '2026-06-01' });
  assert(result.ok === false, 'promotion refused for mono-ticker evidence (only AAPL)');
  assert(result.missing.some(m => m.includes('distinct evidence.tickers')), 'refusal explicitly cites the distinct-tickers gate', JSON.stringify(result.missing));

  // Sanity: same rule but with 3 distinct tickers passes that specific gate (full promotion succeeds)
  const rule2 = marketTruthRule({
    id: 'r4b', status: 'candidate',
    evidence: { sample_size: 15, wins: 10, losses: 5, expectancy: 1.2, period: '2026-01-01 to 2026-03-01', tickers: ['AAPL', 'MSFT', 'GOOGL'], clusters: ['tech', 'ai'], source_retros: ['20260101'] },
    scope: { setups: [], regimes: ['RISK-ON', 'NEUTRAL'], modes: [] },
  });
  const data2 = freshData([rule2]);
  const result2 = engine.promote(data2, { id: 'r4b', asOfDate: '2026-06-01' });
  assert(result2.ok === true, 'promotion succeeds once all gates (incl. >=3 distinct tickers) are met', JSON.stringify(result2.missing));
  assert(rule2.status === 'active', 'rule status flipped to active on successful promotion');
}

// ─── Test 5 / 8: contradicted rule degraded + open_question created ────────

console.log('\nTest 5/8: Règle contredite dégradée + open_question créée');
{
  const restrictRule = marketTruthRule({
    id: 'r5-restrict', status: 'active', confidence: 0.7, confidence_base: 0.7,
    effect: { action: 'reject_strategy_in_regime', target: { strategy: ['breakout'] }, params: {} },
    scope: { setups: ['breakout'], regimes: ['EARLY RISK-OFF'], modes: [] },
  });
  const promoteRule = marketTruthRule({
    id: 'r5-promote', status: 'active', confidence: 0.6, confidence_base: 0.6,
    effect: { action: 'prefer_strategy', target: { strategy: ['breakout'] }, params: {} },
    scope: { setups: ['breakout'], regimes: ['EARLY RISK-OFF', 'NEUTRAL'], modes: [] },
  });
  const unrelatedRule = marketTruthRule({
    id: 'r5-unrelated', status: 'active', confidence: 0.7, confidence_base: 0.7,
    effect: { action: 'reject_below_score', target: {}, params: { min_score: 80 } },
    scope: { setups: [], regimes: [], modes: [] },
  });
  const data = freshData([restrictRule, promoteRule, unrelatedRule]);
  const { pairs } = engine.findContradictions(data, { asOfDate: '2026-06-01' });

  assert(pairs.length === 1, 'exactly one contradiction detected', JSON.stringify(pairs));
  assert(pairs[0].includes('r5-restrict') && pairs[0].includes('r5-promote'), 'the correct pair is flagged');
  assert(Math.abs(restrictRule.confidence - 0.49) < 0.001, 'restrict rule confidence cut 30% (0.7 -> 0.49)', `${restrictRule.confidence}`);
  assert(Math.abs(promoteRule.confidence - 0.42) < 0.001, 'promote rule confidence cut 30% (0.6 -> 0.42)', `${promoteRule.confidence}`);
  assert(unrelatedRule.confidence === 0.7, 'unrelated rule (no scope/target overlap) untouched');
  const oq = data._open_questions.find(q => q.type === 'contradiction');
  assert(!!oq, 'an _open_questions entry of type contradiction was created');
  assert(oq && oq.rule_ids.includes('r5-restrict') && oq.rule_ids.includes('r5-promote'), 'open_question references both rule ids');
  assert(restrictRule.status === 'active' && promoteRule.status === 'active', 'neither rule auto-deprecated — engine never auto-picks a winner');
}

// ─── Test 6: process_rule never decayed ─────────────────────────────────────

console.log('\nTest 6: process_rule jamais décayée');
{
  const proc = processRule({ id: 'r6', confidence: 0.7, confidence_base: 0.7, last_validated_at: '2020-01-01' }); // very old
  const mt = marketTruthRule({ id: 'r6-mt', confidence: 0.7, confidence_base: 0.7, half_life_days: 30, last_validated_at: '2020-01-01' });
  const data = freshData([proc, mt]);
  engine.decay(data, { asOfDate: '2026-06-01' });
  assert(proc.confidence === 0.7, 'process_rule confidence unchanged after --decay despite ancient last_validated_at');
  assert(proc.status === 'active', 'process_rule status unchanged after --decay');
  assert(proc.half_life_days === null, 'process_rule keeps half_life_days=null');
  assert(proc.expires_at === null, 'process_rule keeps expires_at=null');
  assert(mt.confidence < 0.01, 'sanity: market_truth WOULD have decayed near zero over the same span', `${mt.confidence}`);
  assert(mt.status === 'deprecated', 'sanity: market_truth auto-deprecated below 0.30 floor');
}

// ─── Test 7: deprecated rule reactivable without breaking ───────────────────

console.log('\nTest 7: Deprecated réactivable sans casse');
{
  const rule = marketTruthRule({ id: 'r7', status: 'deprecated', confidence: 0.2, confidence_base: 0.2, evidence: { sample_size: 3, wins: 1, losses: 2, expectancy: null, period: null, tickers: [], clusters: [], source_retros: [] } });
  const data = freshData([rule]);
  let threw = false;
  try {
    engine.validateRule(data, { id: 'r7', outcome: 'win', asOfDate: '2026-06-01' });
    engine.validateRule(data, { id: 'r7', outcome: 'win', asOfDate: '2026-06-02' });
  } catch (e) {
    threw = true;
  }
  assert(!threw, '--validate on a deprecated rule does not throw');
  assert(rule.evidence.sample_size === 5, 'evidence.sample_size incremented correctly across 2 validate calls', `${rule.evidence.sample_size}`);
  assert(rule.evidence.wins === 3, 'evidence.wins incremented correctly', `${rule.evidence.wins}`);
  assert(Math.abs(rule.confidence - 0.30) < 0.0001, 'confidence recovered via +0.05/win steps (0.2 -> 0.3)', `${rule.confidence}`);
  assert(rule.status === 'active', 'deprecated market_truth rule auto-reactivated once confidence >= 0.30');
}

// ─── Test 9: migration preserves fields consumed by validate-scan.js ────────

console.log('\nTest 9: Migration préserve les champs consommés par validate-scan (severity/rule)');
{
  const realFile = path.join(__dirname, '..', 'data', 'scanner-lessons.json');
  const real = engine.loadLessons(realFile);
  assert(Array.isArray(real.rules) && real.rules.length > 0, 'real data/scanner-lessons.json loads and has rules');
  const missingSeverity = real.rules.filter(r => typeof r.severity !== 'string' || !r.severity);
  const missingRule = real.rules.filter(r => typeof r.rule !== 'string' || !r.rule);
  const missingId = real.rules.filter(r => typeof r.id !== 'string' || !r.id);
  assert(missingSeverity.length === 0, 'every migrated rule keeps a non-empty severity field', JSON.stringify(missingSeverity.map(r => r.id)));
  assert(missingRule.length === 0, 'every migrated rule keeps a non-empty rule field', JSON.stringify(missingRule.map(r => r.id)));
  assert(missingId.length === 0, 'every migrated rule keeps a non-empty id field');
  // specific rule validate-scan.js hardcodes by id/content
  const rr = real.rules.find(r => r.id === 'rr-min-by-regime');
  assert(!!rr && rr.severity === 'hard_block', 'rr-min-by-regime kept severity=hard_block');
  const shortSqueeze = real.rules.find(r => r.id === 'no-short-squeeze-strategy');
  assert(!!shortSqueeze && /Short Squeeze/i.test(shortSqueeze.rule), 'no-short-squeeze-strategy kept its executable rule text');
  // canonical schema fields present on every rule
  for (const field of ['class', 'status', 'scope', 'effect', 'evidence', 'confidence', 'confidence_base', 'created_at', 'last_validated_at', 'invalidation_conditions', 'notes']) {
    assert(real.rules.every(r => Object.prototype.hasOwnProperty.call(r, field)), `every rule has canonical field "${field}"`);
  }
  assert(real.rules.every(r => r.class === 'market_truth' || r.class === 'process_rule'), 'every rule classified as market_truth or process_rule');
  assert(real.rules.filter(r => r.class === 'process_rule').every(r => r.half_life_days === null && r.expires_at === null), 'every process_rule has half_life_days=null and expires_at=null');
}

// ─── Test 10: JSON always parseable after each operation ───────────────────

console.log('\nTest 10: JSON toujours parseable après chaque opération');
{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lessons-engine-test-'));
  const tmpFile = path.join(tmpDir, 'scanner-lessons.json');

  const rule = marketTruthRule({ id: 'r10', status: 'candidate', confidence: 0.7, confidence_base: 0.7 });
  fs.writeFileSync(tmpFile, JSON.stringify(freshData([rule]), null, 2));

  const ops = [
    () => { const d = engine.loadLessons(tmpFile); engine.decay(d, { asOfDate: '2026-06-01' }); engine.saveLessons(tmpFile, d); },
    () => { const d = engine.loadLessons(tmpFile); engine.validateRule(d, { id: 'r10', outcome: 'win', asOfDate: '2026-06-02' }); engine.saveLessons(tmpFile, d); },
    () => { const d = engine.loadLessons(tmpFile); engine.findContradictions(d, { asOfDate: '2026-06-03' }); engine.saveLessons(tmpFile, d); },
  ];

  let allParseable = true;
  for (const op of ops) {
    op();
    try {
      JSON.parse(fs.readFileSync(tmpFile, 'utf8'));
    } catch (e) {
      allParseable = false;
    }
  }
  assert(allParseable, 'file remains valid JSON after decay/validate/contradictions round-trips');

  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// ─── Extra: idempotent decay ────────────────────────────────────────────────

console.log('\nExtra: --decay is idempotent (same asOfDate applied twice = no further change)');
{
  const rule = marketTruthRule({ id: 'r11', confidence: 0.7, confidence_base: 0.7, half_life_days: 90, last_validated_at: '2026-01-01' });
  const data = freshData([rule]);
  engine.decay(data, { asOfDate: '2026-03-01' });
  const afterFirst = rule.confidence;
  const baseAfterFirst = rule.confidence_base;
  engine.decay(data, { asOfDate: '2026-03-01' });
  assert(rule.confidence === afterFirst, 'running --decay twice on the same date does not further reduce confidence', `${afterFirst} -> ${rule.confidence}`);
  assert(rule.confidence_base === baseAfterFirst, 'confidence_base (the decay anchor) is never mutated by --decay itself');
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('SOME TESTS FAILED');
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED');
  process.exit(0);
}
