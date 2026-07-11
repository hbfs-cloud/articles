#!/usr/bin/env node
'use strict';

/**
 * signals-desk-state.js — STATE PARTAGÉ multi-signaux du desk + agrégation pondérée.
 *
 * Idée #3 de docs/research/ai-hedge-fund-ideas.md : répliquer le pattern
 * `state['analyst_signals'][agent_id] = {...}` de virattt/ai-hedge-fund. Chaque générateur
 * écrit SA propre clé `source` dans un state commun `state[ticker][source] = {signal,
 * confidence, reasoning}`. Fusion par `{...a, ...b}` (le reducer merge_dicts) → N sources
 * écrivent SANS collision, l'agrégation = simple lecture. Pas de LangGraph : un dict + une
 * convention de clés suffit en JS. Remplace toute glue ad-hoc du desk.
 *
 * Idée #6b : agrégation CONFIDENCE-WEIGHTED en CODE (vote pondéré par confidence) →
 * un verdict desk REPRODUCTIBLE et AUDITABLE par ticker, lu depuis le state #3. C'est
 * l'INVERSE de l'anti-pattern du repo source (agrégation des convictions sans pondération,
 * tranchée par un LLM non reproductible). Ici : 100% déterministe.
 *
 * ─── SCOPE / BORNE (mémoire systematic-north-star) ───────────────────────────────────
 *   • SIM-ONLY / consultatif : ce module ASSEMBLE et AGRÈGE des signaux. Il ne décide RIEN
 *     d'exécutable, aucun ordre, aucun broker (rb_ / sim_). Le verdict est une opinion desk.
 *   • ZÉRO LLM : toute la MATH est du code. Même state → même verdict (byte-identique).
 *   • ZÉRO FABRICATION : chaque signal agrégé DOIT être un pivot valide réellement émis par
 *     un générateur (validé via signal-schema.normalizeSignal). Pas de confidence par défaut,
 *     pas de source inventée. Un signal malformé fait ÉCHOUER l'écriture (fail-closed).
 *
 * Le contrat de chaque valeur `state[ticker][source]` = le SCHÉMA PIVOT de signal-schema.js.
 *
 * Usage (librairie) :
 *   const S = require('./lib/signals-desk-state');
 *   let st = S.createState();
 *   st = S.setSignal(st, 'NVDA', 'swing',   { signal:'bullish', confidence:70, reasoning:'…' });
 *   st = S.setSignal(st, 'NVDA', 'squeeze', { signal:'bullish', confidence:55, reasoning:'…' });
 *   const verdict = S.aggregateTicker(st, 'NVDA');   // { signal, confidence, weightedScore, ... }
 *   const all     = S.aggregateAll(st);              // { NVDA: verdict, … } trié
 *
 * Usage (CLI) :
 *   node tools/lib/signals-desk-state.js --self-test        # smoke-test (idée #3 + #6b)
 *   node tools/lib/signals-desk-state.js --in state.json    # agrège un state fourni → JSON
 */

const { normalizeSignal, SIGNAL_VALUE } = require('./signal-schema');

const round = (x) => Math.round(x);

/** State vide. */
function createState() { return {}; }

/**
 * mergeState(a, b) — le reducer merge_dicts, non destructif.
 * Fusionne au niveau ticker PUIS source : `{...a, ...b}` par ticker, les sources de `b`
 * complétant/écrasant celles de `a`. Ne mute NI a NI b. Deux générateurs qui écrivent des
 * SOURCES différentes sur le même ticker ne se marchent jamais dessus.
 */
function mergeState(a, b) {
  const out = {};
  const tickers = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const t of tickers) {
    out[t] = { ...(a && a[t] ? a[t] : {}), ...(b && b[t] ? b[t] : {}) };
  }
  return out;
}

/**
 * setSignal(state, ticker, source, sig) → nouveau state (non muté).
 * Valide `sig` au schéma pivot (fail-closed : lève si malformé) puis merge la clé
 * `state[ticker][source]`. C'est l'écriture "chaque générateur pose SA clé".
 */
function setSignal(state, ticker, source, sig) {
  if (!ticker || typeof ticker !== 'string') throw new TypeError('setSignal: ticker requis (string)');
  if (!source || typeof source !== 'string') throw new TypeError('setSignal: source requise (string)');
  const pivot = normalizeSignal(sig); // fail-closed : rejette un signal malformé
  return mergeState(state, { [ticker]: { [source]: pivot } });
}

/** readTicker(state, ticker) → objet { source: pivot } (ou {}). */
function readTicker(state, ticker) {
  return (state && state[ticker]) ? state[ticker] : {};
}

/**
 * aggregateTicker(state, ticker, opts) — VERDICT desk confidence-weighted (idée #6b).
 * Lit toutes les sources du ticker et calcule, en code :
 *   weightedScore = Σ(valeur(signal_i) × confidence_i) / Σ(confidence_i)  ∈ [-1, 1]
 *     avec valeur(bullish)=+1, valeur(bearish)=-1, valeur(neutral)=0.
 *   verdict : ≥ +threshold → bullish ; ≤ −threshold → bearish ; sinon neutral (défaut 0.25).
 *   confidence du verdict = moyenne des confidences des sources qui SONT d'accord avec le
 *     verdict (ou toutes, si neutral). Déterministe.
 * Retourne aussi le détail (sources, tally, contributions) pour un digest audité chiffre-par-chiffre.
 */
function aggregateTicker(state, ticker, opts) {
  opts = opts || {};
  const threshold = typeof opts.threshold === 'number' ? opts.threshold : 0.25;
  const sources = readTicker(state, ticker);
  const keys = Object.keys(sources).sort(); // ordre stable → sortie reproductible
  const contributions = [];
  const tally = { bullish: 0, bearish: 0, neutral: 0 };
  let wsum = 0, csum = 0;
  for (const src of keys) {
    const s = sources[src];
    const v = SIGNAL_VALUE[s.signal];
    tally[s.signal]++;
    wsum += v * s.confidence;
    csum += s.confidence;
    contributions.push({ source: src, signal: s.signal, confidence: s.confidence, weight: v * s.confidence });
  }
  const n = keys.length;
  const weightedScore = csum > 0 ? wsum / csum : 0;
  let signal;
  if (weightedScore >= threshold) signal = 'bullish';
  else if (weightedScore <= -threshold) signal = 'bearish';
  else signal = 'neutral';
  // confidence du verdict = moyenne des confidences alignées (ou toutes si neutral / aucune alignée)
  const agree = contributions.filter((c) => c.signal === signal);
  const pool = (signal !== 'neutral' && agree.length) ? agree : contributions;
  const confidence = pool.length ? round(pool.reduce((a, c) => a + c.confidence, 0) / pool.length) : 0;

  return {
    ticker,
    signal,
    confidence,
    weightedScore: Number(weightedScore.toFixed(3)),
    n,
    tally,
    reasoning: `${tally.bullish}↑/${tally.bearish}↓/${tally.neutral}→ sur ${n} source(s), pondéré confidence → ${signal.toUpperCase()} (score ${weightedScore.toFixed(2)}, conf ${confidence}).`,
    sources: keys.map((src) => ({ source: src, ...sources[src] })),
    contributions,
  };
}

/** aggregateAll(state, opts) → { ticker: verdict } pour tous les tickers (clés triées). */
function aggregateAll(state, opts) {
  const out = {};
  for (const t of Object.keys(state || {}).sort()) out[t] = aggregateTicker(state, t, opts);
  return out;
}

module.exports = {
  createState, mergeState, setSignal, readTicker, aggregateTicker, aggregateAll,
};

// ─── CLI / smoke-test ──────────────────────────────────────────────────────────────────
if (require.main === module) {
  const argv = process.argv.slice(2);
  const val = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };

  if (argv.includes('--self-test')) {
    const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } };

    // (ii) le merge de 3 SOURCES sur le même ticker ne perd AUCUNE clé.
    let st = createState();
    st = setSignal(st, 'NVDA', 'swing',   { signal: 'bullish', confidence: 70, reasoning: 'reclaim MM20 + volume' });
    st = setSignal(st, 'NVDA', 'squeeze',  { signal: 'bullish', confidence: 55, reasoning: 'SI% float 18, CTB↑' });
    st = setSignal(st, 'NVDA', 'sector',   { signal: 'neutral', confidence: 40, reasoning: 'semis RS moyen' });
    const srcs = Object.keys(readTicker(st, 'NVDA')).sort();
    assert(srcs.length === 3 && srcs.join(',') === 'sector,squeeze,swing',
      'merge doit conserver 3 sources, got: ' + srcs.join(','));
    // ré-écrire une source existante ne détruit pas les autres (merge_dicts)
    const st2 = setSignal(st, 'NVDA', 'swing', { signal: 'bearish', confidence: 30, reasoning: 'cassure support' });
    assert(Object.keys(readTicker(st2, 'NVDA')).length === 3, 'update d’une source ne doit pas perdre les autres');
    assert(readTicker(st2, 'NVDA').swing.signal === 'bearish', 'update de source doit s’appliquer');
    // non-mutation : l’ancien state reste intact
    assert(readTicker(st, 'NVDA').swing.signal === 'bullish', 'mergeState ne doit pas muter l’ancien state');

    // fail-closed : un signal malformé fait échouer l’écriture (pas de source fabriquée).
    let threw = false;
    try { setSignal(st, 'NVDA', 'macro', { signal: 'up', confidence: 90, reasoning: 'x' }); } catch { threw = true; }
    assert(threw, 'setSignal doit rejeter un pivot malformé (fail-closed)');

    // (iii) agrégation pondérée REPRODUCTIBLE + pondère bien par confidence.
    const v1 = aggregateTicker(st, 'NVDA');
    const v2 = aggregateTicker(st, 'NVDA');
    assert(JSON.stringify(v1) === JSON.stringify(v2), 'agrégation non reproductible (même entrée → sortie différente)');
    // 2 bullish (70,55) + 1 neutral (40) → score = (70+55+0)/165 = 0.757 → bullish
    assert(v1.signal === 'bullish', 'verdict attendu bullish, got ' + v1.signal + ' score ' + v1.weightedScore);

    // PONDÉRATION : un bearish FORT bat un bullish FAIBLE (le nb de votes n’est pas ce qui compte).
    let wt = createState();
    wt = setSignal(wt, 'ABC', 'a', { signal: 'bullish', confidence: 20, reasoning: 'faible conviction' });
    wt = setSignal(wt, 'ABC', 'b', { signal: 'bearish', confidence: 90, reasoning: 'forte conviction' });
    const w = aggregateTicker(wt, 'ABC'); // score = (20 - 90)/110 = -0.636 → bearish
    assert(w.signal === 'bearish', 'pondération par confidence: bearish fort doit primer, got ' + w.signal);
    assert(Math.abs(w.weightedScore + 0.636) < 0.01, 'weightedScore attendu ≈ -0.636, got ' + w.weightedScore);
    // même camp mais parité de VOTES → la confidence tranche
    let eq = createState();
    eq = setSignal(eq, 'XYZ', 'a', { signal: 'bullish', confidence: 80, reasoning: 'x' });
    eq = setSignal(eq, 'XYZ', 'b', { signal: 'bearish', confidence: 80, reasoning: 'y' });
    assert(aggregateTicker(eq, 'XYZ').signal === 'neutral', '80 vs 80 → neutral (score 0)');

    console.log('SELF-TEST OK — signals-desk-state : merge 3 sources sans perte, agrégation pondérée reproductible & confidence-weighted.');
    console.log('  NVDA :', v1.reasoning);
    console.log('  ABC  :', w.reasoning, '(bearish fort bat bullish faible)');
    process.exit(0);
  }

  const inFile = val('--in');
  if (inFile) {
    const fs = require('fs');
    const raw = JSON.parse(fs.readFileSync(inFile, 'utf8'));
    // Accepte soit un state { ticker:{source:pivot} }, soit { state:{...} }.
    const state = raw.state || raw;
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), verdicts: aggregateAll(state) }, null, 2));
    process.exit(0);
  }

  console.log('Usage: node tools/lib/signals-desk-state.js --self-test');
  console.log('       node tools/lib/signals-desk-state.js --in state.json   (state = { ticker:{ source:{signal,confidence,reasoning} } })');
  process.exit(0);
}
