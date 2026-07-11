#!/usr/bin/env node
'use strict';

/**
 * valuation-multi.js — DETERMINISTIC weighted multi-method intrinsic valuation.
 *
 * Port of virattt/ai-hedge-fund's `valuation.py` (idea #5, docs/research/ai-hedge-fund-ideas.md
 * §2.5) — the NUMERIC MODEL only, NOT any LLM. Four intrinsic methods are computed in pure code
 * and blended by fixed weights, across three growth scenarios. Same inputs → byte-identical output.
 *
 *   • DCF multi-étages ................. 35%
 *   • Owner Earnings (Buffett) ......... 35%
 *   • EV/EBITDA médian historique ...... 20%
 *   • Residual Income (EBO) ............ 10%
 *   • Scénarios bear / base / bull ..... 20 / 60 / 20  (applied to the growth-driven methods)
 *
 * Signal = weighted_gap = (valeur_modèle − marketCap) / marketCap :
 *   bullish > +15% · bearish < −15% · neutral sinon.
 * Confidence (explicable, idée #6a) = min(|gap| / 0.30 × 100, 100) — la formule EXACTE du doc,
 * réutilisée depuis tools/lib/signal-schema.js (valuationConfidence). Le méta-objet final est
 * émis au SCHÉMA PIVOT { signal, confidence, reasoning } et normalisé par signal-schema.js.
 *
 * ─── SCOPE / BORNE (mémoire systematic-north-star) ─────────────────────────────────────────────
 *   • SIM-ONLY, consultatif : renvoie une opinion de valorisation, JAMAIS un ordre ni un sizing.
 *   • ZÉRO LLM : toute la math est en code reproductible. Le LLM (narration édito) n'intervient
 *     qu'APRÈS, avec interdiction d'inventer un chiffre.
 *   • ZÉRO FETCH / ZÉRO FABRICATION : ce module NE FETCH RIEN. Il est une fonction PURE des
 *     financials qu'un AGENT a déjà tirés du MCP (QueryData types=financials,stats,quote + les
 *     champs de cash-flow/coverage que l'agent a pu récupérer). Un subprocess node ne peut pas
 *     appeler le MCP OAuth2 → le caller passe les données en entrée.
 *   • FAIL-CLOSED : tout input requis par une méthode et ABSENT ⇒ cette méthode = `na` (jamais
 *     inventée). Les poids sont renormalisés sur les seules méthodes disponibles. Si AUCUNE méthode
 *     n'est calculable, ou si marketCap est absent ⇒ neutral, confidence 0, aucune valeur fabriquée.
 *     C'est l'anti-pattern create_default_response() du repo source, INTERDIT ici (MCP HARD STOP :
 *     on stoppe / on flague, on ne comble jamais avec une valeur par défaut).
 *
 * ─── GATE CONFIG-CHANGE ────────────────────────────────────────────────────────────────────────
 *   Ce module est un AXE DE SCORE consultatif pour les analyses ticker. Il ne touche PAS la couche
 *   de sizing du scanner et ne bascule AUCUN mode. (Le sizing vol+corr de l'idée #4 est un opt-in
 *   séparé, soumis au backtest A/B 30j par régime.)
 *
 * ─── INPUT CONTRACT (le caller passe ce qu'il a tiré du MCP ; tout champ manquant ⇒ fail-closed) ─
 *   Depuis QueryData financials/stats/quote (formes vérifiées 2026-07-11) :
 *     profitMargins, totalRevenue, totalCash, totalDebt, ebitda, earningsGrowth, revenueGrowth,
 *     bookValue (per share), sharesOutstanding, beta, price   (+ marketCap ou price×shares).
 *   Champs de cash-flow / coût du capital (hors surface financials/stats de base — le caller les
 *   fournit s'il les a tirés d'un autre type MCP ; sinon la méthode concernée reste `na`) :
 *     freeCashFlow, depreciation, capex, workingCapitalChange, netIncome (sinon dérivé),
 *     interestCoverage (ou ebit + interestExpense), medianEvEbitda (ou evEbitdaHistory[]).
 *
 * Usage (librairie) :
 *   const { evaluateValuation } = require('./lib/valuation-multi');
 *   const v = evaluateValuation('JNJ', financials);  // { signal, confidence, reasoning, ... }
 *
 * Usage (CLI — pour l'agent qui a écrit les financials MCP dans un fichier) :
 *   node tools/lib/valuation-multi.js --in financials.json [--ticker JNJ]
 *   node tools/lib/valuation-multi.js --self-test
 */

const { normalizeSignal, valuationConfidence } = require('./signal-schema');

// ─── constantes du modèle (doc §2.5) ──────────────────────────────────────────────────────────
const RF = 0.045;              // taux sans risque
const ERP = 0.06;              // prime de risque actions (β × 6%)
const TAX_SHIELD = 0.75;       // (1 − taux d'impôt) appliqué au coût de la dette
const WACC_MIN = 0.06;         // clamp bas WACC
const WACC_MAX = 0.20;         // clamp haut WACC
const TERMINAL = 0.03;         // croissance terminale 3%
const GROWTH_CAP = 0.25;       // croissance haute plafonnée 25%
const GROWTH_CAP_MEGA = 0.10;  // 10% si mcap > 50 Md
const MEGA_MCAP = 50e9;
const PROJ_YEARS = 5;          // horizon explicite
const SCENARIO_DELTA = 0.05;   // écart de croissance bear/bull vs base
const SCENARIO_W = { bear: 0.20, base: 0.60, bull: 0.20 };
const WEIGHTS = { dcf: 0.35, owner: 0.35, evebitda: 0.20, ri: 0.10 };
const BULL_GAP = 0.15;
const BEAR_GAP = -0.15;

// ─── helpers ───────────────────────────────────────────────────────────────────────────────────
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const round = (x) => Math.round(x);
const money = (x) => (isNum(x) ? '$' + (x / 1e9).toFixed(2) + 'Md' : 'n/a');
const pct = (x) => (isNum(x) ? (x * 100).toFixed(1) + '%' : 'n/a');
function median(arr) {
  const a = (arr || []).filter(isNum).slice().sort((x, y) => x - y);
  if (!a.length) return undefined;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

// Synthetic-rating credit spread from interest coverage (EBIT / intérêts), style Damodaran.
// Déterministe, table figée. coverage inconnu ⇒ null (le coût de la dette devient non calculable).
function creditSpread(coverage) {
  if (!isNum(coverage)) return null;
  const table = [
    [12.5, 0.0063], [9.5, 0.0078], [7.5, 0.0098], [6.0, 0.0108], [4.5, 0.0122],
    [4.0, 0.0156], [3.5, 0.0200], [3.0, 0.0242], [2.5, 0.0313], [2.0, 0.0371],
    [1.5, 0.0462], [1.25, 0.0578], [0.8, 0.0700], [0.5, 0.0860],
  ];
  for (const [thr, spread] of table) if (coverage >= thr) return spread;
  return 0.1090; // coverage < 0.5 → junk
}

// ─── normalize inputs into a flat, derived object ──────────────────────────────────────────────
function pickOne(x) { return Array.isArray(x) ? (x[0] || {}) : (x || {}); }
function normalizeFinancials(raw) {
  raw = raw || {};
  const fin = pickOne(raw.financials);
  const st = pickOne(raw.stats);
  const q = pickOne(raw.quote);
  const g = (k) => (raw[k] != null ? raw[k] : undefined); // flat fallback (tests / caller-computed)

  const f = {
    profitMargins: fin.profitMargins ?? g('profitMargins'),
    totalRevenue: fin.totalRevenue ?? g('totalRevenue'),
    totalCash: fin.totalCash ?? g('totalCash'),
    totalDebt: (fin.totalDebt ?? st.totalDebt) ?? g('totalDebt'),
    ebitda: fin.ebitda ?? g('ebitda'),
    earningsGrowth: fin.earningsGrowth ?? g('earningsGrowth'),
    revenueGrowth: fin.revenueGrowth ?? g('revenueGrowth'),
    bookValue: st.bookValue ?? g('bookValue'),               // per share
    sharesOutstanding: st.sharesOutstanding ?? g('sharesOutstanding'),
    beta: st.beta ?? fin.beta ?? g('beta'),
    price: q.price ?? g('price'),
    marketCap: g('marketCap') ?? st.marketCap,
    // cash-flow / cost-of-capital inputs — le caller les fournit s'il les a ; sinon undefined → na
    freeCashFlow: g('freeCashFlow') ?? fin.freeCashFlow,
    depreciation: g('depreciation') ?? fin.depreciation,
    capex: g('capex') ?? fin.capex,
    workingCapitalChange: g('workingCapitalChange') ?? fin.workingCapitalChange,
    netIncome: g('netIncome') ?? fin.netIncome,
    interestCoverage: g('interestCoverage') ?? fin.interestCoverage,
    ebit: g('ebit') ?? fin.ebit,
    interestExpense: g('interestExpense') ?? fin.interestExpense,
    medianEvEbitda: g('medianEvEbitda'),
    evEbitdaHistory: g('evEbitdaHistory'),
  };

  // Dérivés (uniquement si les inputs existent ; sinon laissés undefined → méthode `na`).
  if (!isNum(f.netIncome) && isNum(f.profitMargins) && isNum(f.totalRevenue)) {
    f.netIncome = f.profitMargins * f.totalRevenue;
  }
  if (!isNum(f.marketCap) && isNum(f.price) && isNum(f.sharesOutstanding)) {
    f.marketCap = f.price * f.sharesOutstanding;
  }
  if (isNum(f.bookValue) && isNum(f.sharesOutstanding)) {
    f.bookEquity = f.bookValue * f.sharesOutstanding;
  }
  if (!isNum(f.interestCoverage) && isNum(f.ebit) && isNum(f.interestExpense) && f.interestExpense > 0) {
    f.interestCoverage = f.ebit / f.interestExpense;
  }
  return f;
}

// ─── WACC = CAPM (déterministe, clampé [6%,20%]) ───────────────────────────────────────────────
function computeWacc(f) {
  if (!isNum(f.beta)) return { wacc: null, note: 'β absent → WACC non calculable (fail-closed)' };
  const costEquity = RF + f.beta * ERP;
  const E = isNum(f.marketCap) ? f.marketCap : null;
  const D = isNum(f.totalDebt) ? Math.max(0, f.totalDebt) : 0;

  // Pas de dette (ou poids de dette nul) → WACC = coût des fonds propres.
  if (D <= 0 || E == null) {
    return { wacc: clamp(costEquity, WACC_MIN, WACC_MAX), note: 'WACC = coût des fonds propres (dette nulle/inconnue)', costEquity, costDebt: null };
  }
  // Dette présente : coût de la dette via interest coverage. Manquant ⇒ fail-closed (WACC na).
  const spread = creditSpread(f.interestCoverage);
  if (spread == null) {
    return { wacc: null, note: 'dette présente mais interest coverage absent → coût de la dette non calculable (fail-closed)', costEquity, costDebt: null };
  }
  const costDebt = RF + spread;
  const afterTaxCostDebt = costDebt * TAX_SHIELD;
  const V = E + D;
  const raw = (E / V) * costEquity + (D / V) * afterTaxCostDebt;
  return { wacc: clamp(raw, WACC_MIN, WACC_MAX), note: '', costEquity, costDebt, afterTaxCostDebt };
}

// ─── croissance : plafonnée, plancher 0 pour l'étage explicite ─────────────────────────────────
function baseGrowth(f) {
  const raw = isNum(f.earningsGrowth) ? f.earningsGrowth
    : (isNum(f.revenueGrowth) ? f.revenueGrowth : undefined);
  if (!isNum(raw)) return undefined;
  const cap = (isNum(f.marketCap) && f.marketCap > MEGA_MCAP) ? GROWTH_CAP_MEGA : GROWTH_CAP;
  return clamp(raw, 0, cap);
}

// ─── les 4 méthodes (chacune renvoie une valeur d'EQUITY, ou null = fail-closed) ───────────────
// Actualisation d'un flux qui croît à `g` PROJ_YEARS ans puis perpétuité au taux terminal.
function discountGrowingFlow(flow0, g, wacc) {
  if (!isNum(flow0) || !isNum(g) || !isNum(wacc) || wacc <= TERMINAL || !(flow0 > 0)) return null;
  let pv = 0;
  for (let t = 1; t <= PROJ_YEARS; t++) {
    pv += (flow0 * Math.pow(1 + g, t)) / Math.pow(1 + wacc, t);
  }
  const flowN = flow0 * Math.pow(1 + g, PROJ_YEARS);
  const terminal = (flowN * (1 + TERMINAL)) / (wacc - TERMINAL);
  pv += terminal / Math.pow(1 + wacc, PROJ_YEARS);
  return pv;
}

function dcfValue(f, g, wacc) {
  if (!isNum(f.freeCashFlow)) return null;
  return discountGrowingFlow(f.freeCashFlow, g, wacc);
}

function ownerEarningsValue(f, g, wacc) {
  if (!isNum(f.netIncome) || !isNum(f.depreciation) || !isNum(f.capex)) return null;
  const wc = isNum(f.workingCapitalChange) ? f.workingCapitalChange : 0;
  const oe = f.netIncome + f.depreciation - f.capex - wc;
  return discountGrowingFlow(oe, g, wacc); // oe ≤ 0 ⇒ discountGrowingFlow renvoie null (fail-closed)
}

// EV/EBITDA médian historique — insensible à la croissance projetée.
function evEbitdaValue(f) {
  const mult = isNum(f.medianEvEbitda) ? f.medianEvEbitda : median(f.evEbitdaHistory);
  if (!isNum(mult) || !isNum(f.ebitda)) return null;
  const impliedEV = mult * f.ebitda;
  const netDebt = (isNum(f.totalDebt) ? f.totalDebt : 0) - (isNum(f.totalCash) ? f.totalCash : 0);
  return impliedEV - netDebt; // equity value (peut être négative → légitimement bearish)
}

// Residual Income (EBO) — insensible à la croissance projetée (basé sur ROE trailing).
function residualIncomeValue(f, wacc) {
  if (!isNum(f.netIncome) || !isNum(f.bookEquity) || !isNum(wacc) || !(f.bookEquity > 0) || wacc <= TERMINAL) return null;
  const ri0 = f.netIncome - wacc * f.bookEquity;               // résidu au-dessus du coût des fonds propres
  const terminalRI = (ri0 * (1 + TERMINAL)) / (wacc - TERMINAL); // perpétuité croissante
  return f.bookEquity + terminalRI;
}

// ─── agrégation pondérée sur les méthodes DISPONIBLES (renormalisation) ────────────────────────
function weightedOverAvailable(values) {
  // values = { dcf, owner, evebitda, ri } (null = indisponible)
  let wsum = 0, vsum = 0;
  const used = [];
  for (const k of Object.keys(WEIGHTS)) {
    if (isNum(values[k])) { wsum += WEIGHTS[k]; vsum += WEIGHTS[k] * values[k]; used.push(k); }
  }
  if (wsum <= 0) return { value: null, used };
  return { value: vsum / wsum, used };
}

// ─── évaluation complète ───────────────────────────────────────────────────────────────────────
function evaluateValuation(ticker, raw, opts) {
  opts = opts || {};
  const f = normalizeFinancials(raw);
  const { wacc, note: waccNote, costEquity, costDebt } = computeWacc(f);
  const g = baseGrowth(f);

  const scenarios = {
    bear: isNum(g) ? Math.max(0, g - SCENARIO_DELTA) : g,
    base: g,
    bull: isNum(g) ? Math.min((isNum(f.marketCap) && f.marketCap > MEGA_MCAP) ? GROWTH_CAP_MEGA : GROWTH_CAP, g + SCENARIO_DELTA) : g,
  };

  // Méthodes insensibles à la croissance (calculées une fois).
  const evVal = evEbitdaValue(f);
  const riVal = residualIncomeValue(f, wacc);

  // Valeur pondérée par scénario, puis blend 20/60/20.
  const perScenario = {};
  const usedSet = new Set();
  for (const s of ['bear', 'base', 'bull']) {
    const values = {
      dcf: dcfValue(f, scenarios[s], wacc),
      owner: ownerEarningsValue(f, scenarios[s], wacc),
      evebitda: evVal,
      ri: riVal,
    };
    const { value, used } = weightedOverAvailable(values);
    perScenario[s] = value;
    used.forEach((u) => usedSet.add(u));
  }

  const methodsUsed = Array.from(usedSet);
  // Modèle final = blend scénario (si base indisponible dans un scénario, exclure ce poids).
  let modelValue = null;
  if (isNum(perScenario.bear) || isNum(perScenario.base) || isNum(perScenario.bull)) {
    let wsum = 0, vsum = 0;
    for (const s of ['bear', 'base', 'bull']) {
      if (isNum(perScenario[s])) { wsum += SCENARIO_W[s]; vsum += SCENARIO_W[s] * perScenario[s]; }
    }
    modelValue = wsum > 0 ? vsum / wsum : null;
  }

  // Fail-closed : pas de marketCap ou aucune méthode ⇒ neutral / confidence 0, rien d'inventé.
  const dataGaps = [];
  if (!isNum(f.beta)) dataGaps.push('beta (→ WACC na)');
  if (!isNum(f.freeCashFlow)) dataGaps.push('freeCashFlow (→ DCF na)');
  if (!(isNum(f.netIncome) && isNum(f.depreciation) && isNum(f.capex))) dataGaps.push('netIncome/depreciation/capex (→ Owner Earnings na)');
  if (!(isNum(f.medianEvEbitda) || median(f.evEbitdaHistory) != null)) dataGaps.push('median EV/EBITDA historique (→ EV/EBITDA na)');
  if (!isNum(f.bookEquity)) dataGaps.push('bookEquity (→ Residual Income na)');

  if (!isNum(f.marketCap) || !isNum(modelValue) || methodsUsed.length === 0) {
    const reasoning = `Valorisation non concluante (fail-closed) : ` +
      (!isNum(f.marketCap) ? 'marketCap absent. ' : '') +
      (methodsUsed.length === 0 ? 'aucune des 4 méthodes calculable. ' : `méthodes dispo: ${methodsUsed.join(', ') || '—'}. `) +
      `Lacunes: ${dataGaps.join(' ; ') || '—'}. Aucune valeur fabriquée.`;
    const pivot = normalizeSignal({ signal: 'neutral', confidence: 0, reasoning });
    return {
      ticker: ticker || null,
      asOf: opts.asOf || new Date().toISOString().slice(0, 10),
      model: 'Valuation multi-méthodes',
      ...pivot,
      gap: null, modelValue, marketCap: isNum(f.marketCap) ? f.marketCap : null,
      wacc, growth: g, methodsUsed, perScenario, methodValues: { evebitda: evVal, ri: riVal },
      weights: WEIGHTS, scenarioWeights: SCENARIO_W, dataGaps,
    };
  }

  const gap = (modelValue - f.marketCap) / f.marketCap;
  let signal;
  if (gap > BULL_GAP) signal = 'bullish';
  else if (gap < BEAR_GAP) signal = 'bearish';
  else signal = 'neutral';
  const confidence = valuationConfidence(gap); // min(|gap|/0.30 × 100, 100), entier

  const missing = 4 - methodsUsed.length;
  const reasoning =
    `${methodsUsed.length}/4 méthodes (${methodsUsed.join('+')}) → valeur modèle ${money(modelValue)} vs cap. ${money(f.marketCap)} ` +
    `⇒ gap ${(gap * 100).toFixed(1)}% (${signal.toUpperCase()}). ` +
    `WACC ${pct(wacc)}${waccNote ? ' — ' + waccNote : ''}, croissance base ${pct(g)}, terminal ${pct(TERMINAL)}, scénarios 20/60/20. ` +
    (missing ? `${missing} méthode(s) na (fail-closed): ${dataGaps.join(' ; ')}. ` : '') +
    `Confidence = min(|gap|/0.30×100,100).`;

  const pivot = normalizeSignal({ signal, confidence, reasoning });
  return {
    ticker: ticker || null,
    asOf: opts.asOf || new Date().toISOString().slice(0, 10),
    model: 'Valuation multi-méthodes',
    ...pivot,
    gap: Number(gap.toFixed(4)),
    modelValue: round(modelValue),
    marketCap: round(f.marketCap),
    wacc: isNum(wacc) ? Number(wacc.toFixed(4)) : null,
    costEquity: isNum(costEquity) ? Number(costEquity.toFixed(4)) : null,
    costDebt: isNum(costDebt) ? Number(costDebt.toFixed(4)) : null,
    growth: isNum(g) ? Number(g.toFixed(4)) : null,
    methodsUsed,
    perScenario: {
      bear: isNum(perScenario.bear) ? round(perScenario.bear) : null,
      base: isNum(perScenario.base) ? round(perScenario.base) : null,
      bull: isNum(perScenario.bull) ? round(perScenario.bull) : null,
    },
    weights: WEIGHTS,
    scenarioWeights: SCENARIO_W,
    dataGaps,
  };
}

module.exports = {
  evaluateValuation, normalizeFinancials, computeWacc, baseGrowth,
  dcfValue, ownerEarningsValue, evEbitdaValue, residualIncomeValue, creditSpread,
  WEIGHTS, SCENARIO_W,
};

// ─── CLI ────────────────────────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const argv = process.argv.slice(2);
  const has = (n) => argv.includes(n);
  const val = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };

  if (has('--self-test')) {
    const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } };

    // Cas UNDERVALUED (financials fictifs cohérents) : forte génération de cash, petite cap.
    const cheap = {
      financials: {
        profitMargins: 0.18, totalRevenue: 10e9, totalCash: 3e9, totalDebt: 1e9, ebitda: 3e9,
        earningsGrowth: 0.15, revenueGrowth: 0.12,
        freeCashFlow: 2e9, depreciation: 0.8e9, capex: 0.5e9, interestCoverage: 15,
      },
      stats: { bookValue: 8, sharesOutstanding: 1e9, beta: 1.0 },
      quote: { price: 18 }, // marketCap 18Md
      medianEvEbitda: 10,
    };
    // Cas OVERVALUED : cash-flow anémique, très grosse cap, dette lourde.
    const rich = {
      financials: {
        profitMargins: 0.05, totalRevenue: 20e9, totalCash: 1e9, totalDebt: 20e9, ebitda: 2e9,
        earningsGrowth: 0.30, revenueGrowth: 0.10,
        freeCashFlow: 0.5e9, depreciation: 0.5e9, capex: 1.5e9, interestCoverage: 3,
      },
      stats: { bookValue: 10, sharesOutstanding: 1e9, beta: 1.5 },
      quote: { price: 100 }, // marketCap 100Md (>50Md → growth cap 10%)
      medianEvEbitda: 8,
    };
    const empty = { financials: {}, stats: {}, quote: {} };

    const c1 = evaluateValuation('CHEAP', cheap);
    const c2 = evaluateValuation('CHEAP', cheap);
    const r = evaluateValuation('RICH', rich);
    const e = evaluateValuation('EMPTY', empty);

    // (1) Déterminisme byte-identique.
    assert(JSON.stringify(c1) === JSON.stringify(c2), 'déterminisme: même entrée → sortie identique');

    // (2) Signaux attendus + gap cohérent.
    assert(c1.signal === 'bullish', 'CHEAP devrait être bullish, got ' + c1.signal + ' (gap ' + c1.gap + ')');
    assert(c1.gap > 0.15, 'CHEAP gap doit dépasser +15%, got ' + c1.gap);
    assert(r.signal === 'bearish', 'RICH devrait être bearish, got ' + r.signal + ' (gap ' + r.gap + ')');
    assert(r.gap < -0.15, 'RICH gap doit être sous −15%, got ' + r.gap);

    // (3) Confidence = formule exacte du doc (via signal-schema.valuationConfidence).
    assert(c1.confidence === valuationConfidence(c1.gap), 'CHEAP confidence doit suivre min(|gap|/0.30×100,100)');
    assert(r.confidence === valuationConfidence(r.gap), 'RICH confidence doit suivre la formule');

    // (4) 4 méthodes pondérées effectivement utilisées sur un cas complet.
    assert(c1.methodsUsed.length === 4, 'CHEAP devrait utiliser les 4 méthodes, got ' + c1.methodsUsed.join(','));
    assert(Math.abs(c1.weights.dcf - 0.35) < 1e-9 && Math.abs(c1.weights.evebitda - 0.20) < 1e-9, 'poids 35/35/20/10');

    // (5) Fail-closed : financials vides → neutral, confidence 0, aucune valeur fabriquée.
    assert(e.signal === 'neutral' && e.confidence === 0 && e.modelValue === null, 'EMPTY doit fail-closed neutral/0/null');
    assert(e.methodsUsed.length === 0, 'EMPTY ne doit utiliser aucune méthode');

    // (6) Fail-closed partiel : dette présente sans interest coverage → WACC na → méthodes actualisées na.
    const noCoverage = {
      financials: { profitMargins: 0.1, totalRevenue: 5e9, totalDebt: 5e9, totalCash: 0.5e9, ebitda: 1e9, earningsGrowth: 0.1, freeCashFlow: 0.5e9, depreciation: 0.3e9, capex: 0.2e9 },
      stats: { bookValue: 5, sharesOutstanding: 1e9, beta: 1.2 }, quote: { price: 20 }, medianEvEbitda: 9,
    };
    const nc = evaluateValuation('NOCOV', noCoverage);
    assert(nc.wacc === null, 'NOCOV: dette sans coverage → WACC na, got ' + nc.wacc);
    assert(!nc.methodsUsed.includes('dcf') && !nc.methodsUsed.includes('owner') && !nc.methodsUsed.includes('ri'),
      'NOCOV: méthodes actualisées doivent être na sans WACC, got ' + nc.methodsUsed.join(','));
    assert(nc.methodsUsed.includes('evebitda'), 'NOCOV: EV/EBITDA reste calculable sans WACC');

    // (7) Le pivot émis valide le contrat signal-schema (déjà garanti par normalizeSignal).
    assert(typeof c1.reasoning === 'string' && c1.reasoning.length > 0, 'reasoning non vide');

    console.log('SELF-TEST OK — valuation-multi : déterministe, 4 méthodes pondérées, scénarios 20/60/20, fail-closed.');
    console.log('  CHEAP :', c1.signal, 'gap', (c1.gap * 100).toFixed(1) + '%', 'conf', c1.confidence, '| val', money(c1.modelValue), 'vs cap', money(c1.marketCap), '| WACC', pct(c1.wacc));
    console.log('  RICH  :', r.signal, 'gap', (r.gap * 100).toFixed(1) + '%', 'conf', r.confidence, '| méthodes', r.methodsUsed.join('+'));
    console.log('  EMPTY :', e.signal, 'conf', e.confidence, '(fail-closed, aucune valeur fabriquée)');
    console.log('  NOCOV :', nc.signal, '| WACC na → méthodes', nc.methodsUsed.join('+') || '—');
    process.exit(0);
  }

  const inFile = val('--in');
  if (inFile) {
    const fs = require('fs');
    const raw = JSON.parse(fs.readFileSync(inFile, 'utf8'));
    const ticker = raw.ticker || val('--ticker') || null;
    const data = raw.data || raw;
    console.log(JSON.stringify(evaluateValuation(ticker, data, { asOf: val('--asof') }), null, 2));
    process.exit(0);
  }

  console.log('Usage: node tools/lib/valuation-multi.js --in financials.json [--ticker X]');
  console.log('       node tools/lib/valuation-multi.js --self-test');
  process.exit(0);
}
