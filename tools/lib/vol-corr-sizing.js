#!/usr/bin/env node
'use strict';

/**
 * vol-corr-sizing.js — DETERMINISTIC volatility-adjusted + correlation-aware position sizing.
 *
 * Verbatim port of the SIZING math in virattt/ai-hedge-fund's `risk_manager.py` (100 % code,
 * ZERO LLM). Same inputs → byte-identical output. See docs/research/ai-hedge-fund-ideas.md §2.4/§4
 * (idea #4). This is the numeric money-layer: it decides how large a simulated position MAY be,
 * given the name's volatility and its correlation to positions/picks already in the book.
 *
 * ─── SCOPE / BORNE (systematic-north-star) ─────────────────────────────────────────────────
 *   • SIM-ONLY, consultatif : returns a sizing CEILING, never an order. No broker, no rb_/sim_ calls.
 *   • 100 % DÉTERMINISTE : pure arithmetic. No LLM anywhere in this file. Reproducible.
 *   • ZERO FABRICATION : this module does NOT fetch anything. It is a PURE function of the
 *     volatility + correlation an AGENT already pulled from the MCP (PortfolioRisk exposes
 *     correlation + VaR; QueryData/GetSymbolSignals expose realized vol / ATR). A subprocess
 *     cannot call the OAuth2 MCP — so the caller (the scanner agent, the senior-review Risk
 *     persona, an analyses agent) fetches vol/corr and passes them in. The lib never invents one.
 *   • FAIL-CLOSED : if `volAnnualized` is not a finite number, the lib DOES NOT substitute a
 *     default (no `create_default_response` anti-pattern) — it returns { ok:false, reason } and
 *     the caller must STOP / decline to size, never guess a vol. Correlation may legitimately be
 *     absent (empty book / nothing to compare) → treated as the DEFINITIONAL neutral 1.00 and
 *     flagged `corrStatus:'na'`, which is not a fabricated value.
 *
 * ─── GRID (verbatim, spec §2.4) ────────────────────────────────────────────────────────────
 *   base_limit = 20 %
 *   × VOLATILITY multiplier (vol as a decimal fraction, 0.25 = 25 %):
 *       vol < 15 %              → ×1.25
 *       15 %–30 %               → scaled linearly 1.00 → 0.625
 *       30 %–50 %               → scaled linearly 0.75 → 0.50   (note: verbatim step-up at 30 %)
 *       > 50 %                  → ×0.50
 *   × CORRELATION multiplier (|max corr| to existing positions/picks):
 *       ≥ 0.80                  → ×0.70
 *       0.60–0.80               → ×0.85
 *       0.40–0.60               → ×1.00
 *       0.20–0.40               → ×1.00   (spec lists no boost in this band → neutral)
 *       < 0.20                  → ×1.10   (de-concentrate: reward a decorrelated add)
 *   combined_pct = CLAMP(base × volMult × corrMult, 5 %, 25 %)
 *   position_limit = NLV × combined_pct
 *   max_size       = min(remaining_limit, cash)
 *
 * Usage (as a library):
 *   const { computeVolCorrSizing } = require('./lib/vol-corr-sizing');
 *   const s = computeVolCorrSizing({ volAnnualized: 0.28, correlation: 0.65, nlv: 100000, cash: 40000 });
 *   // s.ok, s.combinedPct, s.positionLimit, s.maxSize, s.relativeFactor, s.criteria[]
 *
 * Usage (CLI — for the harness agent which fetched vol/corr from the MCP and wrote a file):
 *   node tools/lib/vol-corr-sizing.js --in inputs.json     # prints sizing JSON
 *   node tools/lib/vol-corr-sizing.js --self-test          # deterministic unit test
 */

// ─── helpers ────────────────────────────────────────────────────────────────────────────────
const isNum = (x) => typeof x === 'number' && isFinite(x);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const pct = (x) => (isNum(x) ? (x * 100).toFixed(1) + '%' : 'n/a');
// Linear interpolation of v∈[x0,x1] onto [y0,y1].
const lerp = (v, x0, x1, y0, y1) => y0 + ((v - x0) / (x1 - x0)) * (y1 - y0);

const BASE_LIMIT_PCT = 0.20;   // 20 % base per-position ceiling before adjustments
const MIN_PCT = 0.05;          // clamp floor (5 %)
const MAX_PCT = 0.25;          // clamp cap (25 %)
// Relative-factor clamp for the scanner path (parity with sweep's inverse_atr 0.5×–1.5×).
const REL_MIN = 0.5;
const REL_MAX = 1.5;

/**
 * Volatility multiplier — verbatim grid. `vol` is annualized realized vol as a decimal (0.25=25%).
 * Returns null when vol is not a finite number (fail-closed; caller must STOP).
 */
function volatilityMultiplier(vol) {
  if (!isNum(vol) || vol < 0) return null;
  if (vol < 0.15) return 1.25;
  if (vol < 0.30) return lerp(vol, 0.15, 0.30, 1.00, 0.625);
  if (vol < 0.50) return lerp(vol, 0.30, 0.50, 0.75, 0.50);
  return 0.50;
}

/**
 * Correlation multiplier — verbatim grid. `corr` = |max correlation| to existing positions/picks.
 * A null/absent correlation (empty book, nothing to compare) is the DEFINITIONAL neutral 1.00 —
 * not a fabricated value. Uses the absolute correlation (a −0.9 hedge is as concentrating a bet
 * on the same factor as +0.9 for gross-exposure purposes).
 */
function correlationMultiplier(corr) {
  if (!isNum(corr)) return 1.00; // no existing positions / not measurable → neutral (flagged na)
  const c = Math.abs(corr);
  if (c >= 0.80) return 0.70;
  if (c >= 0.60) return 0.85;
  if (c >= 0.40) return 1.00;
  if (c >= 0.20) return 1.00; // 0.20–0.40 neutral band (spec assigns no boost here)
  return 1.10;                // < 0.20 → de-concentrate
}

/**
 * computeVolCorrSizing — the deterministic sizing ceiling.
 *
 * @param {object} p
 * @param {number} p.volAnnualized  REQUIRED. Annualized realized vol as a decimal (0.25 = 25 %).
 * @param {number} [p.correlation]  |max corr| of the candidate to existing positions/picks.
 * @param {number[]} [p.correlations] Alternative: array of pairwise corr → the MAX |.| is used
 *                                    (most conservative concentration measure). Ignored if
 *                                    `correlation` is given.
 * @param {number} [p.nlv]          Net liquidation value (for absolute $ ceilings).
 * @param {number} [p.cash]         Available cash (caps max_size).
 * @param {number} [p.remainingLimit] Remaining $ headroom for this name (default = positionLimit).
 * @param {number} [p.baseLimitPct] Override base (default 0.20).
 * @returns {object} { ok, reason?, combinedPct, volMult, corrMult, rawFactor, relativeFactor,
 *                      positionLimit, maxSize, clamped, volStatus, corrStatus, reasoning, criteria[] }
 */
function computeVolCorrSizing(p = {}) {
  const base = isNum(p.baseLimitPct) ? p.baseLimitPct : BASE_LIMIT_PCT;

  const volMult = volatilityMultiplier(p.volAnnualized);
  if (volMult == null) {
    // FAIL-CLOSED: no vol → do NOT size. Never substitute a default vol.
    return {
      ok: false,
      reason: 'volAnnualized manquant/invalide — fail-closed, aucune substitution (MCP HARD STOP côté appelant)',
      volStatus: 'na',
    };
  }

  // Resolve the correlation input: explicit scalar, else MAX |.| of the array, else null.
  let corr = null;
  let corrStatus = 'na';
  if (isNum(p.correlation)) {
    corr = p.correlation; corrStatus = 'ok';
  } else if (Array.isArray(p.correlations) && p.correlations.length) {
    for (const c of p.correlations) {
      if (isNum(c) && Math.abs(c) > Math.abs(corr ?? 0)) corr = c;
    }
    if (corr != null) corrStatus = 'ok';
  }
  const corrMult = correlationMultiplier(corr);

  const rawFactor = volMult * corrMult;
  const rawPct = base * rawFactor;
  const combinedPct = clamp(rawPct, MIN_PCT, MAX_PCT);
  const clamped = combinedPct !== rawPct;
  const relativeFactor = clamp(rawFactor, REL_MIN, REL_MAX); // for the scanner scanWeight path

  // Absolute $ ceilings (only when NLV is known).
  let positionLimit = null;
  let maxSize = null;
  if (isNum(p.nlv)) {
    positionLimit = p.nlv * combinedPct;
    const remaining = isNum(p.remainingLimit) ? p.remainingLimit : positionLimit;
    const cashCap = isNum(p.cash) ? p.cash : Infinity;
    maxSize = Math.max(0, Math.min(remaining, cashCap));
  }

  const criteria = [
    { name: 'base_limit', value: base, note: `base ceiling ${pct(base)}` },
    { name: 'volatility', value: p.volAnnualized, status: 'ok',
      note: `vol ${pct(p.volAnnualized)} → ×${volMult.toFixed(3)}` },
    { name: 'correlation', value: corr, status: corrStatus,
      note: corrStatus === 'ok'
        ? `|corr| ${Math.abs(corr).toFixed(2)} → ×${corrMult.toFixed(2)}`
        : `pas de position à comparer → neutre ×${corrMult.toFixed(2)} (na, non fabriqué)` },
    { name: 'combined_pct', value: combinedPct, note: `${pct(combinedPct)}${clamped ? ' (clampé 5–25%)' : ''}` },
  ];

  const reasoning =
    `base ${pct(base)} × vol×${volMult.toFixed(3)} (${pct(p.volAnnualized)}) × ` +
    `corr×${corrMult.toFixed(2)} (${corrStatus === 'ok' ? Math.abs(corr).toFixed(2) : 'na'}) ` +
    `= ${pct(combinedPct)}${clamped ? ' [clampé]' : ''}` +
    (positionLimit != null ? ` → limit ${positionLimit.toFixed(0)}, max_size ${maxSize.toFixed(0)}` : '');

  return {
    ok: true,
    combinedPct, volMult, corrMult, rawFactor, relativeFactor,
    positionLimit, maxSize, clamped, volStatus: 'ok', corrStatus,
    reasoning, criteria,
  };
}

module.exports = {
  computeVolCorrSizing,
  volatilityMultiplier,
  correlationMultiplier,
  BASE_LIMIT_PCT, MIN_PCT, MAX_PCT, REL_MIN, REL_MAX,
};

// ─── CLI (self-test + file input) ────────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  const has = (f) => args.includes(f);
  const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };

  if (has('--self-test')) {
    const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } };

    // 1) Determinism: same input → byte-identical output.
    const inA = { volAnnualized: 0.28, correlation: 0.65, nlv: 100000, cash: 40000 };
    const r1 = JSON.stringify(computeVolCorrSizing(inA));
    const r2 = JSON.stringify(computeVolCorrSizing(inA));
    assert(r1 === r2, 'determinism: identical inputs must produce identical output');

    // 2) Clamp cap (25 %): low vol (×1.25) + low corr (×1.10) → 0.20×1.375=0.275 → clamp 0.25.
    const cap = computeVolCorrSizing({ volAnnualized: 0.10, correlation: 0.05 });
    assert(cap.ok && Math.abs(cap.combinedPct - 0.25) < 1e-9, `cap must clamp to 25 %, got ${pct(cap.combinedPct)}`);
    assert(cap.clamped === true, 'cap case must report clamped=true');

    // 3) Clamp bounds hold everywhere; heaviest haircut stays ≥ 5 % floor.
    const heavy = computeVolCorrSizing({ volAnnualized: 0.90, correlation: 0.95 }); // ×0.50 × ×0.70
    assert(heavy.combinedPct >= MIN_PCT && heavy.combinedPct <= MAX_PCT, 'combinedPct must stay within [5%,25%]');
    assert(Math.abs(heavy.combinedPct - 0.07) < 1e-9, `heavy haircut = 0.20×0.5×0.7 = 7 %, got ${pct(heavy.combinedPct)}`);

    // 4) De-concentration: corr < 0.20 boosts vs a correlated add (same vol).
    const decorr = computeVolCorrSizing({ volAnnualized: 0.25, correlation: 0.10 });
    const concen = computeVolCorrSizing({ volAnnualized: 0.25, correlation: 0.85 });
    assert(decorr.corrMult === 1.10, `low-corr must get ×1.10, got ×${decorr.corrMult}`);
    assert(concen.corrMult === 0.70, `high-corr must get ×0.70, got ×${concen.corrMult}`);
    assert(decorr.combinedPct > concen.combinedPct, 'decorrelated add must be sized larger than a concentrated one');

    // 5) Fail-closed: missing vol → ok:false, NO fabricated default.
    const fc = computeVolCorrSizing({ correlation: 0.5, nlv: 100000 });
    assert(fc.ok === false && fc.combinedPct === undefined, 'missing vol must fail-closed (no default substituted)');

    // 6) Absolute $ ceilings: max_size capped by cash.
    const cashCapped = computeVolCorrSizing({ volAnnualized: 0.20, correlation: 0.30, nlv: 100000, cash: 5000 });
    assert(cashCapped.maxSize === 5000, `max_size must be min(limit,cash)=5000, got ${cashCapped.maxSize}`);

    // 7) Correlations array → uses MAX |.| (conservative).
    const arr = computeVolCorrSizing({ volAnnualized: 0.25, correlations: [0.1, 0.85, -0.2] });
    assert(arr.corrMult === 0.70, `array must pick max|.|=0.85 → ×0.70, got ×${arr.corrMult}`);

    // 8) Empty book → corr na → neutral 1.00 (definitional, not fabricated).
    const empty = computeVolCorrSizing({ volAnnualized: 0.25 });
    assert(empty.corrStatus === 'na' && empty.corrMult === 1.00, 'no-corr must be neutral na ×1.00');

    console.log('SELF-TEST OK — deterministic, verbatim grid, clamps 5–25 %, de-concentration, fail-closed.');
    console.log('  cap(low vol/low corr) :', cap.reasoning);
    console.log('  heavy(hi vol/hi corr) :', heavy.reasoning);
    console.log('  decorr vs concen pct  :', pct(decorr.combinedPct), 'vs', pct(concen.combinedPct));
    process.exit(0);
  }

  const inFile = val('--in');
  if (inFile) {
    const fs = require('fs');
    const raw = JSON.parse(fs.readFileSync(inFile, 'utf8'));
    console.log(JSON.stringify(computeVolCorrSizing(raw), null, 2));
    process.exit(0);
  }

  console.log('Usage: node tools/lib/vol-corr-sizing.js --in inputs.json');
  console.log('       node tools/lib/vol-corr-sizing.js --self-test');
  console.log('inputs.json: { "volAnnualized":0.28, "correlation":0.65, "nlv":100000, "cash":40000 }');
  process.exit(0);
}
