'use strict';
const assert = require('assert');
const { validateNonMarketInput } = require('./validate-analysis-evidence');
const analysis = { header: { ticker: 'TEST', price: 100 }, verdict: { score: 82 },
  earnings: { eps: 3 }, meta: { lastEvent: { close: 95 } }, tradeIdea: { entry: 96 } };
const input = { kind: 'editorial_judgment', path: 'judgment.json' };
const payload = { ticker: 'TEST', judgments: { 'verdict.score': { value: 82,
  reason: 'Qualitative assessment of economics and valuation; not an observed market datum.' } }, score_components: { quality: 45, valuation: 37 } };
const calc = { claim_provenance: { 'verdict.score': { input_path: input.path, source_pointer: '/judgments/verdict.score/value' } } };
assert.deepStrictEqual(validateNonMarketInput(input, payload, calc, analysis, 'TEST'), []);
for (const field of ['header.price', 'earnings.eps']) {
  const bypass = structuredClone(calc);
  bypass.claim_provenance[field] = { input_path: input.path, source_pointer: '/judgments/verdict.score/value' };
  assert(validateNonMarketInput(input, payload, bypass, analysis, 'TEST').some(e => e.includes(`cannot support ${field}`)));
}
const wrongScore = structuredClone(payload); wrongScore.score_components.quality = 50;
assert(validateNonMarketInput(input, wrongScore, calc, analysis, 'TEST').some(e => e.includes('components')));
const noReason = structuredClone(payload); noReason.judgments['verdict.score'].reason = '';
assert(validateNonMarketInput(input, noReason, calc, analysis, 'TEST').some(e => e.includes('rationale')));
const archiveInput = { kind: 'archived_analysis', path: 'baseline.json' };
const historyCalc = { claim_provenance: {
  'meta.lastEvent.close': { input_path: archiveInput.path, source_pointer: '/meta/lastEvent/close' },
  'tradeIdea.entry': { input_path: archiveInput.path, source_pointer: '/tradeIdea/entry' }
} };
assert.deepStrictEqual(validateNonMarketInput(archiveInput, analysis, historyCalc, analysis, 'TEST'), []);
const revised = structuredClone(analysis); revised.meta.lastEvent.close = 99;
assert(validateNonMarketInput(archiveInput, analysis, historyCalc, revised, 'TEST').some(e => e.includes('archived value differs')));
const marketViaArchive = { claim_provenance: { 'header.price': { input_path: archiveInput.path, source_pointer: '/header/price' } } };
assert(validateNonMarketInput(archiveInput, analysis, marketViaArchive, analysis, 'TEST').some(e => e.includes('cannot support')));
assert(validateNonMarketInput(input, payload, calc, analysis, 'OTHER').some(e => e.includes('ticker mismatch')));
assert.strictEqual(validateNonMarketInput({ path: 'market.json' }, {}, {}, analysis, 'TEST'), null);
const baseline = { header: { ticker: 'TEST' }, tradeIdea: { entry: 426, stop: 408.09, tp1: 465.73 } };
const derived = { ...baseline, tradeIdea: { ...baseline.tradeIdea, stopPct: '-4.20% risque', rr: '1:2.22' } };
const derivedCalc = { claim_provenance: Object.fromEntries(['tradeIdea.stopPct', 'tradeIdea.rr'].map(p => [p, {
  input_path: archiveInput.path, source_pointer: '/tradeIdea', derivation: 'archived_trade_geometry'
}])) };
assert.deepStrictEqual(validateNonMarketInput(archiveInput, baseline, derivedCalc, derived, 'TEST'), []);
derived.tradeIdea.rr = '1:3.00';
assert(validateNonMarketInput(archiveInput, baseline, derivedCalc, derived, 'TEST').some(e => e.includes('unsupported archived trade derivation')));
derived.tradeIdea.rr = '1:2.22'; derived.tradeIdea.stopPct = '-5.50% risque';
assert(validateNonMarketInput(archiveInput, baseline, derivedCalc, derived, 'TEST').some(e => e.includes('unsupported archived trade derivation')));
console.log('non-market evidence: PASS; judgments and unchanged history cannot certify market data');
