#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { validateAplus, validateTradeIdeas } = require('./lib/trade-idea-gates');

const idea = {
  ticker: 'TEST', family: 'pullback', side: 'long', spot: 100, entry: 101, stop: 98,
  tp1: 106, atr14: 2, rr: 1.67, earnings_sessions: 8, sec_status: 'clear',
  sec_checked_at: '2026-08-29', data_date: '2026-08-28', source_ids: ['bars', 'technicals', 'calendar', 'sec', 'flows'],
  market_observations: {
    spot: { value: 100, as_of: '2026-08-28', source_id: 'bars', source_pointer: '/rows/0/close' },
    atr14: { value: 2, as_of: '2026-08-28', source_id: 'technicals', source_pointer: '/rows/0/atr14' },
  },
};
assert.deepStrictEqual(validateTradeIdeas({ reference_close: '2026-08-28', status: 'ready', ideas: [idea] }), []);

const inflated = structuredClone(idea);
inflated.rr = 2.5;
assert(validateTradeIdeas({ reference_close: '2026-08-28', status: 'ready', ideas: [inflated] }).some(e => e.includes('differs')));
const tight = structuredClone(idea);
tight.stop = 99;
assert(validateTradeIdeas({ reference_close: '2026-08-28', status: 'ready', ideas: [tight] }).some(e => e.includes('ATR')));
const earnings = structuredClone(idea);
earnings.earnings_sessions = 2;
assert(validateTradeIdeas({ reference_close: '2026-08-28', status: 'ready', ideas: [earnings] }).some(e => e.includes('earnings_sessions')));

const aplus = {
  ...idea,
  source_ids: [...idea.source_ids],
  tp1: 108.5,
  rr: 2.5,
  score: 100,
  guidance_raised: true,
  guidance_source: 'Q2 earnings release, guidance section',
  eps_beats_consecutive: 6,
  eps_beats_source: 'Six primary quarterly releases',
  forward_pe: 28,
  peg: 1.2,
  ema20_extension_pct: 1.5,
  earnings_sessions: 12,
  buyback_active: true,
  dividend_active: true,
  structure_pass: true,
  sec_catalyst_verified: true,
  dilution_status: 'clear',
  issuance_capacity_status: 'clear',
  corporate_action_status: 'clear',
  guidance_proof: { ticker: 'TEST', action: 'raised', primary: true, source_id: 'guidance', date: '2026-08-20', source_pointer: '/events/0' },
  eps_beat_proof: [
    ['2026-08-20', 2.1, 2.0], ['2026-05-20', 1.9, 1.8], ['2026-02-20', 1.7, 1.6],
    ['2025-11-20', 1.5, 1.4], ['2025-08-20', 1.3, 1.2],
  ].map(([date, actual, estimate], index) => ({ ticker: 'TEST', source_id: 'eps_history', date, actual, estimate, source_pointer: `/quarters/${index}` })),
  sec_review: {
    ticker: 'TEST', source_id: 'sec', primary_reviewed: true, checked_from: '2026-02-28',
    checked_through: '2026-08-28', forms_reviewed: ['10-Q', '8-K'], dilution: 'clear',
    filings: [{ accession: '0000000000-26-000001', source_pointer: '/filings/0' }], issuance_capacity: 'clear', corporate_actions: 'clear',
  },
  score_components: {
    guidance_gate: 5, eps_beats_gate: 5, valuation_gate: 5, extension_gate: 5,
    peg: 15, buyback: 8, dividend: 7, structure: 20, risk_reward: 15, sec_catalyst: 15,
  },
  war_room: {
    votes_for: 4,
    total: 4,
    critical_errors: [],
    votes: [
      { role: 'quant', approve: true, critical_errors: [] },
      { role: 'pm', approve: true, critical_errors: [] },
      { role: 'risk', approve: true, critical_errors: [] },
      { role: 'short_seller', approve: true, critical_errors: [] },
    ],
  },
};
aplus.market_observations.forward_pe = { value: 28, as_of: '2026-08-28', source_id: 'technicals', source_pointer: '/rows/0/forward_pe' };
aplus.market_observations.peg = { value: 1.2, as_of: '2026-08-28', source_id: 'technicals', source_pointer: '/rows/0/peg' };
aplus.market_observations.ema20_extension_pct = { value: 1.5, as_of: '2026-08-28', source_id: 'technicals', source_pointer: '/rows/0/ema20_extension_pct' };
aplus.source_ids.push('guidance', 'eps_history', 'corporate_actions');
assert.deepStrictEqual(validateAplus({ reference_close: '2026-08-28', status: 'ready', candidates: [aplus] }), []);
const weak = structuredClone(aplus);
weak.guidance_raised = false;
weak.score = 89;
const weakErrors = validateAplus({ reference_close: '2026-08-28', status: 'ready', candidates: [weak] });
assert(weakErrors.some(e => e.includes('guidance_raised')));
assert(weakErrors.some(e => e.includes('differs from recomputed')));

const coerced = structuredClone(aplus);
coerced.forward_pe = null;
assert(validateAplus({ reference_close: '2026-08-28', status: 'ready', candidates: [coerced] }).some(e => e.includes('forward PE')));
const stringLevel = structuredClone(idea);
stringLevel.entry = '101';
assert(validateTradeIdeas({ reference_close: '2026-08-28', status: 'ready', ideas: [stringLevel] }).some(e => e.includes('entry must be')));

const peException = structuredClone(aplus);
peException.forward_pe = 48;
peException.market_observations.forward_pe.value = 48;
peException.pe_exception = {
  eligible: true,
  global_monopoly: true,
  eps_growth_pct: 31,
  peg: 1.6,
  evidence: 'Primary filings establish market position and current EPS growth.',
};
assert.deepStrictEqual(validateAplus({ reference_close: '2026-08-28', status: 'ready', candidates: [peException] }), []);

const fakePeException = structuredClone(peException);
fakePeException.pe_exception.eps_growth_pct = '31';
assert(validateAplus({ reference_close: '2026-08-28', status: 'ready', candidates: [fakePeException] }).some(e => e.includes('forward PE')));

const correlated = {
  reference_close: '2026-08-28',
  status: 'ready',
  max_pairwise_correlation: 0.71,
  ideas: [idea, { ...structuredClone(idea), ticker: 'TEST2', family: 'breakout' }],
};
assert(validateTradeIdeas(correlated).some(e => e.includes('exceeds 0.70')));

assert.deepStrictEqual(validateAplus({ reference_close: '2026-08-28', status: 'no_setup', candidates: [] }), []);

console.log('trade idea gate tests: PASS');
