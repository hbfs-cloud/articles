#!/usr/bin/env node
'use strict';

/**
 * value-quality-board.js — DETERMINISTIC "Value/Quality Board" (5 investor personas).
 *
 * Port of the QUANT part of virattt/ai-hedge-fund's investor personas (Buffett / Graham /
 * Lynch / Munger / Burry) — the NUMERIC THRESHOLD GRIDS only, NOT the LLM prompts. Each persona
 * is a fixed grid of NUMBERED thresholds evaluated against REAL fundamentals. There is ZERO LLM
 * in the scoring: same inputs → byte-identical output. See docs/research/ai-hedge-fund-ideas.md §4.
 *
 * ─── SCOPE / BORNE ─────────────────────────────────────────────────────────────────────────
 *   • SIM-ONLY, consultatif : this returns opinions/scores, NEVER an order or a sizing decision.
 *   • ZERO HALLUCINATION : this module does NOT fetch anything. It is a PURE function of the
 *     fundamentals an AGENT already pulled from the MCP (QueryData types=financials,stats,quote).
 *     A subprocess cannot call the OAuth2 MCP — so the caller (the senior-review harness agent,
 *     the scanner agent, an analyses agent) fetches the data and passes it in. Deterministic.
 *   • FAIL-CLOSED : any ratio that is NOT available from the MCP surface (FCF, current ratio,
 *     ROIC — none are exposed by QueryData financials/stats today) is marked `na` for that
 *     criterion and is FLAGGED, never invented. A persona with too little data votes `neutral`
 *     with a low, data-scaled confidence — it never fabricates a bullish/bearish vote.
 *
 * ─── PIVOT SCHEMA (idea #2) ────────────────────────────────────────────────────────────────
 *   Every persona returns { signal: 'bullish'|'bearish'|'neutral', confidence: 0-100,
 *   reasoning: string } plus an auditable `criteria[]` breakdown (each: name, status, value,
 *   threshold, note). The board aggregates confidence-weighted (idea #6), deterministically.
 *
 * ─── FIELD MAP (real MCP shapes, verified 2026-07-11) ──────────────────────────────────────
 *   financials (instrument_comprehensive_financial): returnOnEquity, grossMargins,
 *     operatingMargins, profitMargins, revenueGrowth, earningsGrowth, totalRevenue, totalCash,
 *     totalDebt, ebitda.
 *   stats (instrument_comprehensive_stats): priceToBook, pegRatio, enterpriseToEbitda,
 *     bookValue (per share), sharesOutstanding, totalDebt (fallback).
 *   quote (instrument_quote): price.
 *   Derived here (from the above, no fabrication): netIncome = profitMargins × totalRevenue;
 *     eps = netIncome / sharesOutstanding; pe = price / eps; marketCap = price × shares;
 *     totalEquity = bookValue × shares; debtToEquity = totalDebt / totalEquity;
 *     grahamNumber = √(22.5 × eps × bookValue).
 *   NOT on the MCP surface → fail-closed `na`: freeCashFlow, currentRatio, roic.
 *
 * Usage (as a library):
 *   const { evaluateBoard } = require('./lib/value-quality-board');
 *   const board = evaluateBoard('JNJ', { financials, stats, quote });  // raw MCP data objects
 *
 * Usage (CLI — for the harness agent, which fetched MCP data and wrote it to a file):
 *   node tools/lib/value-quality-board.js --in fundamentals.json      # prints board JSON
 *   node tools/lib/value-quality-board.js --self-test                 # deterministic unit test
 */

// ─── helpers ────────────────────────────────────────────────────────────────────────────────
const isNum = (x) => typeof x === 'number' && isFinite(x);
const pct = (x) => (isNum(x) ? (x * 100).toFixed(1) + '%' : 'n/a');
const num = (x, d = 2) => (isNum(x) ? Number(x).toFixed(d) : 'n/a');
const round = (x) => Math.round(x);

// A single threshold check → { name, status:'pass'|'fail'|'na', value, threshold, note }
function check(name, value, threshold, passFn, note) {
  if (!isNum(value)) return { name, status: 'na', value: null, threshold, note: note || 'donnée MCP indisponible (fail-closed)' };
  return { name, status: passFn(value) ? 'pass' : 'fail', value, threshold, note: note || '' };
}
// Explicitly-unavailable criterion (data type not on the MCP surface at all).
function naCriterion(name, threshold, note) {
  return { name, status: 'na', value: null, threshold, note: note || 'ratio absent de la surface MCP (fail-closed, non inventé)' };
}

// ─── normalize raw MCP data into a flat, derived fundamentals object ─────────────────────────
// Accepts either { financials, stats, quote } (raw MCP `data[]` objects, or arrays), OR an
// already-flat object with the same field names. Never throws on missing fields.
function pickOne(x) {
  if (Array.isArray(x)) return x[0] || {};
  return x || {};
}
function normalizeFundamentals(raw) {
  raw = raw || {};
  const fin = pickOne(raw.financials);
  const st = pickOne(raw.stats);
  const q = pickOne(raw.quote);
  // Support flat inputs too (fields at top level win as fallback).
  const g = (k) => (raw[k] != null ? raw[k] : undefined);

  const f = {
    // raw MCP
    returnOnEquity: fin.returnOnEquity ?? g('returnOnEquity'),
    returnOnAssets: fin.returnOnAssets ?? g('returnOnAssets'),
    grossMargins: fin.grossMargins ?? g('grossMargins'),
    operatingMargins: fin.operatingMargins ?? g('operatingMargins'),
    profitMargins: fin.profitMargins ?? g('profitMargins'),
    revenueGrowth: fin.revenueGrowth ?? g('revenueGrowth'),
    earningsGrowth: fin.earningsGrowth ?? g('earningsGrowth'),
    totalRevenue: fin.totalRevenue ?? g('totalRevenue'),
    totalCash: fin.totalCash ?? g('totalCash'),
    totalDebt: (fin.totalDebt ?? st.totalDebt) ?? g('totalDebt'),
    ebitda: fin.ebitda ?? g('ebitda'),
    priceToBook: st.priceToBook ?? g('priceToBook'),
    pegRatio: st.pegRatio ?? g('pegRatio'),
    enterpriseToEbitda: st.enterpriseToEbitda ?? g('enterpriseToEbitda'),
    bookValue: st.bookValue ?? g('bookValue'), // per share
    sharesOutstanding: st.sharesOutstanding ?? g('sharesOutstanding'),
    price: (q.price ?? g('price')),
    // fields we allow the caller to supply if THEY computed them from a real source (else stay na)
    freeCashFlow: g('freeCashFlow'),   // not on QueryData financials/stats → normally undefined
    currentRatio: g('currentRatio'),   // idem
    roic: g('roic'),                   // idem
  };

  // Derived (only when the inputs exist; otherwise left undefined → criteria become `na`).
  if (isNum(f.profitMargins) && isNum(f.totalRevenue)) f.netIncome = f.profitMargins * f.totalRevenue;
  if (isNum(f.netIncome) && isNum(f.sharesOutstanding) && f.sharesOutstanding > 0) f.eps = f.netIncome / f.sharesOutstanding;
  if (isNum(f.price) && isNum(f.eps) && f.eps > 0) f.pe = f.price / f.eps;
  if (isNum(f.price) && isNum(f.sharesOutstanding)) f.marketCap = f.price * f.sharesOutstanding;
  if (isNum(f.bookValue) && isNum(f.sharesOutstanding)) f.totalEquity = f.bookValue * f.sharesOutstanding;
  if (isNum(f.totalDebt) && isNum(f.totalEquity) && f.totalEquity > 0) f.debtToEquity = f.totalDebt / f.totalEquity;
  if (isNum(f.eps) && f.eps > 0 && isNum(f.bookValue) && f.bookValue > 0) f.grahamNumber = Math.sqrt(22.5 * f.eps * f.bookValue);
  if (isNum(f.freeCashFlow) && isNum(f.marketCap) && f.marketCap > 0) f.fcfYield = f.freeCashFlow / f.marketCap;

  return f;
}

// ─── the 5 personas — each is a fixed grid of NUMBERED thresholds ────────────────────────────
// Thresholds sourced from docs/research/ai-hedge-fund-ideas.md §1/§4 (which mirrors the
// ai-hedge-fund quant grids). Adapted only where a ratio is absent from the MCP surface.
const PERSONAS = {
  buffett: {
    label: 'Buffett — Quality compounder',
    school: 'Quality',
    grid: (f) => [
      check('ROE > 15%', f.returnOnEquity, '>0.15', (v) => v > 0.15, `ROE ${pct(f.returnOnEquity)}`),
      check('Marge opérationnelle > 15%', f.operatingMargins, '>0.15', (v) => v > 0.15, `op margin ${pct(f.operatingMargins)}`),
      check('Marge brute > 40%', f.grossMargins, '>0.40', (v) => v > 0.40, `gross margin ${pct(f.grossMargins)}`),
      check('Dette/capitaux < 0.5', f.debtToEquity, '<0.5', (v) => v < 0.5, `D/E ${num(f.debtToEquity)}`),
      naCriterion('FCF positif', '>0', 'freeCashFlow absent de QueryData financials/stats'),
      naCriterion('Current ratio > 1.5', '>1.5', 'currentRatio absent de la surface MCP'),
    ],
  },
  graham: {
    label: 'Graham — Deep value / margin of safety',
    school: 'Deep value',
    grid: (f) => [
      check('Prix < Graham Number √(22.5·EPS·BVPS)', (isNum(f.grahamNumber) && isNum(f.price)) ? (f.grahamNumber - f.price) : undefined,
        'price < Graham#', (v) => v > 0, `Graham# ${num(f.grahamNumber)} vs prix ${num(f.price)}`),
      check('P/B < 1.5', f.priceToBook, '<1.5', (v) => v > 0 && v < 1.5, `P/B ${num(f.priceToBook)}`),
      check('P/E < 15', f.pe, '<15', (v) => v > 0 && v < 15, `P/E ${num(f.pe)}`),
      naCriterion('Current ratio > 2', '>2', 'currentRatio absent de la surface MCP'),
    ],
  },
  lynch: {
    label: 'Lynch — GARP (growth at a reasonable price)',
    school: 'GARP',
    grid: (f) => [
      // PEG<1 excellent / 1-2 fair / >2 cher. Binaire: pass si <1.5 (raisonnable), fail si >2.
      check('PEG < 1.5', f.pegRatio, '<1.5', (v) => v > 0 && v < 1.5, `PEG ${num(f.pegRatio)}`),
      check('Croissance EPS soutenue > 10%', f.earningsGrowth, '>0.10', (v) => v > 0.10, `EPS growth ${pct(f.earningsGrowth)}`),
      check('Croissance CA > 5%', f.revenueGrowth, '>0.05', (v) => v > 0.05, `rev growth ${pct(f.revenueGrowth)}`),
    ],
  },
  munger: {
    label: 'Munger — Moat & durable quality',
    school: 'Moat quality',
    grid: (f) => [
      naCriterion('ROIC > 15%', '>0.15', 'ROIC absent de QueryData — proxy via ROE ci-dessous'),
      check('ROE > 15% (proxy capital returns)', f.returnOnEquity, '>0.15', (v) => v > 0.15, `ROE ${pct(f.returnOnEquity)}`),
      check('Pricing power — marge brute > 40%', f.grossMargins, '>0.40', (v) => v > 0.40, `gross margin ${pct(f.grossMargins)}`),
      check('Efficience — marge opérationnelle > 20%', f.operatingMargins, '>0.20', (v) => v > 0.20, `op margin ${pct(f.operatingMargins)}`),
      check('Bilan durable — Dette/capitaux < 0.7', f.debtToEquity, '<0.7', (v) => v < 0.7, `D/E ${num(f.debtToEquity)}`),
    ],
  },
  burry: {
    label: 'Burry — Contrarian deep value',
    school: 'Contrarian value',
    grid: (f) => [
      naCriterion('FCF yield ≥ 8%', '>=0.08', 'freeCashFlow absent → FCF yield non calculable'),
      check('Décote — P/B < 1.2', f.priceToBook, '<1.2', (v) => v > 0 && v < 1.2, `P/B ${num(f.priceToBook)}`),
      check('EV/EBITDA < 8x (proxy EV/EBIT)', f.enterpriseToEbitda, '<8', (v) => v > 0 && v < 8, `EV/EBITDA ${num(f.enterpriseToEbitda)}`),
      check('Bilan solide — net cash (cash > dette)', (isNum(f.totalCash) && isNum(f.totalDebt)) ? (f.totalCash - f.totalDebt) : undefined,
        'cash > debt', (v) => v > 0, `cash ${num(f.totalCash, 0)} vs dette ${num(f.totalDebt, 0)}`),
      check('P/E < 15', f.pe, '<15', (v) => v > 0 && v < 15, `P/E ${num(f.pe)}`),
    ],
  },
};

// ─── per-persona vote (deterministic) ────────────────────────────────────────────────────────
function votePersona(key, f) {
  const p = PERSONAS[key];
  const criteria = p.grid(f);
  const available = criteria.filter((c) => c.status !== 'na');
  const passes = available.filter((c) => c.status === 'pass');
  const fails = available.filter((c) => c.status === 'fail');
  const naCount = criteria.length - available.length;
  const total = criteria.length;

  let signal, confidence, reasoning;
  if (available.length === 0) {
    // Fail-closed: no data at all → neutral, zero confidence, never a fabricated vote.
    signal = 'neutral';
    confidence = 0;
    reasoning = `Données insuffisantes (${naCount}/${total} critères indisponibles) — pas de vote fabriqué.`;
  } else {
    const passRatio = passes.length / available.length;
    // Deterministic signal thresholds.
    if (passRatio >= 0.6) signal = 'bullish';
    else if (passRatio <= 0.34) signal = 'bearish';
    else signal = 'neutral';
    // Confidence = strength of the majority side × data completeness (fail-closed: less data → less confidence).
    const majority = Math.max(passes.length, fails.length) / available.length; // 0.5..1
    const completeness = available.length / total; // 0..1
    confidence = round(majority * 100 * completeness);
    const passNames = passes.map((c) => c.name.split(' ')[0]).join(', ') || '—';
    const failNames = fails.map((c) => `${c.name} (${c.note})`).join(' ; ') || '—';
    reasoning = `${passes.length}/${available.length} critères OK` +
      (naCount ? ` (${naCount} n/a fail-closed)` : '') +
      `. Échecs: ${failNames}.`;
  }
  return {
    persona: key,
    label: p.label,
    school: p.school,
    signal,
    confidence,
    reasoning,
    criteria,
    tally: { pass: passes.length, fail: fails.length, na: naCount, available: available.length, total },
  };
}

// ─── board aggregation — confidence-weighted, deterministic (idea #6) ─────────────────────────
const SIGNAL_VALUE = { bullish: 1, bearish: -1, neutral: 0 };
function evaluateBoard(ticker, raw, opts) {
  opts = opts || {};
  const f = normalizeFundamentals(raw);
  const votes = Object.keys(PERSONAS).map((k) => votePersona(k, f));

  const tally = { bullish: 0, bearish: 0, neutral: 0 };
  let wsum = 0, csum = 0;
  for (const v of votes) {
    tally[v.signal]++;
    wsum += SIGNAL_VALUE[v.signal] * v.confidence;
    csum += v.confidence;
  }
  const weightedScore = csum > 0 ? wsum / csum : 0; // [-1, 1]
  let signal;
  if (weightedScore >= 0.25) signal = 'bullish';
  else if (weightedScore <= -0.25) signal = 'bearish';
  else signal = 'neutral';
  // Board confidence = mean confidence of personas agreeing with the board signal (or all, if neutral).
  const agree = votes.filter((v) => v.signal === signal);
  const pool = (signal !== 'neutral' && agree.length) ? agree : votes;
  const confidence = round(pool.reduce((s, v) => s + v.confidence, 0) / (pool.length || 1));

  // Data-availability summary (honesty about fail-closed ratios).
  const naByCriterion = {};
  for (const v of votes) for (const c of v.criteria) if (c.status === 'na') naByCriterion[c.name] = (naByCriterion[c.name] || 0) + 1;

  return {
    ticker: ticker || null,
    asOf: opts.asOf || new Date().toISOString().slice(0, 10),
    board: 'Value/Quality Board',
    signal,
    confidence,
    weightedScore: Number(weightedScore.toFixed(3)),
    tally,
    summary: `${tally.bullish} bullish / ${tally.bearish} bearish / ${tally.neutral} neutral — ${signal.toUpperCase()} conf ${confidence}`,
    votes,
    fundamentals: {
      returnOnEquity: f.returnOnEquity, grossMargins: f.grossMargins, operatingMargins: f.operatingMargins,
      profitMargins: f.profitMargins, revenueGrowth: f.revenueGrowth, earningsGrowth: f.earningsGrowth,
      priceToBook: f.priceToBook, pegRatio: f.pegRatio, enterpriseToEbitda: f.enterpriseToEbitda,
      debtToEquity: f.debtToEquity, eps: f.eps, pe: f.pe, grahamNumber: f.grahamNumber, price: f.price,
      marketCap: f.marketCap,
    },
    dataGaps: naByCriterion, // which criteria were fail-closed (not invented), and how many personas hit them
  };
}

module.exports = { evaluateBoard, votePersona, normalizeFundamentals, PERSONAS };

// ─── CLI ──────────────────────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const argv = process.argv.slice(2);
  const has = (n) => argv.includes(n);
  const val = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };

  if (has('--self-test')) {
    // Deterministic fixture (no MCP). Two runs must be byte-identical.
    const fixture = {
      strong: { // a fabricated cheap high-quality name → most personas bullish
        financials: { returnOnEquity: 0.28, operatingMargins: 0.30, grossMargins: 0.55, profitMargins: 0.20,
          revenueGrowth: 0.18, earningsGrowth: 0.25, totalRevenue: 10e9, totalCash: 8e9, totalDebt: 1e9, ebitda: 3e9 },
        stats: { priceToBook: 1.1, pegRatio: 0.8, enterpriseToEbitda: 6, bookValue: 20, sharesOutstanding: 1e9, totalDebt: 1e9 },
        quote: { price: 18 },
      },
      weak: { // expensive low-quality → most personas bearish
        financials: { returnOnEquity: 0.06, operatingMargins: 0.05, grossMargins: 0.22, profitMargins: 0.03,
          revenueGrowth: -0.02, earningsGrowth: -0.30, totalRevenue: 5e9, totalCash: 0.5e9, totalDebt: 6e9, ebitda: 0.4e9 },
        stats: { priceToBook: 9, pegRatio: 4.5, enterpriseToEbitda: 40, bookValue: 4, sharesOutstanding: 2e9, totalDebt: 6e9 },
        quote: { price: 60 },
      },
      empty: { financials: {}, stats: {}, quote: {} }, // fail-closed everywhere
    };
    const a1 = JSON.stringify(evaluateBoard('STRONG', fixture.strong).votes);
    const a2 = JSON.stringify(evaluateBoard('STRONG', fixture.strong).votes);
    const strong = evaluateBoard('STRONG', fixture.strong);
    const weak = evaluateBoard('WEAK', fixture.weak);
    const empty = evaluateBoard('EMPTY', fixture.empty);
    const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } };
    assert(a1 === a2, 'determinism: same input must produce identical votes');
    assert(strong.signal === 'bullish', 'STRONG should be bullish, got ' + strong.signal);
    assert(weak.signal === 'bearish', 'WEAK should be bearish, got ' + weak.signal);
    assert(empty.signal === 'neutral' && empty.confidence === 0, 'EMPTY must fail-closed neutral/0');
    for (const v of empty.votes) assert(v.confidence === 0, `EMPTY persona ${v.persona} must have 0 confidence (no fabrication)`);
    // FCF / currentRatio / ROIC must always be reported as data gaps, never scored.
    assert(strong.dataGaps['FCF positif'] >= 1, 'FCF must be a reported fail-closed gap');
    console.log('SELF-TEST OK — deterministic, fail-closed, thresholds firing.');
    console.log('  STRONG:', strong.summary);
    console.log('  WEAK  :', weak.summary);
    console.log('  EMPTY :', empty.summary, '(all fail-closed)');
    process.exit(0);
  }

  const inFile = val('--in');
  if (inFile) {
    const fs = require('fs');
    const raw = JSON.parse(fs.readFileSync(inFile, 'utf8'));
    // Accept { ticker, financials, stats, quote } or { ticker, data:{...} }
    const ticker = raw.ticker || val('--ticker') || null;
    const data = raw.data || raw;
    console.log(JSON.stringify(evaluateBoard(ticker, data, { asOf: val('--asof') }), null, 2));
    process.exit(0);
  }

  console.log('Usage: node tools/lib/value-quality-board.js --in fundamentals.json [--ticker X]');
  console.log('       node tools/lib/value-quality-board.js --self-test');
  process.exit(0);
}
