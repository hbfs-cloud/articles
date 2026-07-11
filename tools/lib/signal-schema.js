#!/usr/bin/env node
'use strict';

/**
 * signal-schema.js — CONTRAT PIVOT commun à TOUS les générateurs de signaux.
 *
 * Idée #2 de docs/research/ai-hedge-fund-ideas.md : porter le schéma minimal
 * `{ signal, confidence, reasoning }` de virattt/ai-hedge-fund comme FORMAT PIVOT
 * unique du desk. Chaque générateur (squeeze-radar / earnings-reaction / sector-rotation /
 * macro-event-playbook / swing-signals) DOIT émettre ce méta-objet EN PLUS de ses
 * niveaux (entry/stop/tp) — le pivot est une COUCHE de méta qui accompagne les niveaux,
 * jamais un remplacement. value-quality-board.js émet déjà exactement ce schéma.
 *
 * Idée #6a (ici aussi, car la confidence EST un champ du pivot) : deux formules de
 * confidence AUDITABLES, en CODE reproductible — jamais une "confidence LLM opaque".
 *
 * ─── CONTRAT PIVOT (exact) ───────────────────────────────────────────────────────────
 *   {
 *     signal:     'bullish' | 'bearish' | 'neutral',   // direction, énumération fermée
 *     confidence: number 0..100 (entier),              // force du signal, déterministe
 *     reasoning:  string (non vide)                    // gabarit factuel, chiffres tracés MCP
 *   }
 *
 * ─── SCOPE / BORNE (mémoire systematic-north-star) ───────────────────────────────────
 *   • SIM-ONLY : ce module ne décide RIEN d'exécutable. Il valide/normalise un contrat de
 *     signal consultatif. Aucun ordre, aucun broker, aucun rb_ / sim_.
 *   • ZÉRO LLM DÉCIDEUR : 100% code. Même entrée → même sortie (byte-identique).
 *   • ZÉRO FABRICATION / FAIL-CLOSED : un signal malformé (enum invalide, confidence non
 *     numérique, reasoning vide) est REJETÉ — on ne "répare" jamais en inventant une
 *     valeur par défaut. C'est l'anti-pattern create_default_response() du repo source,
 *     interdit chez nous (MCP HARD STOP : on stoppe, on ne substitue jamais).
 *
 * Usage (librairie) :
 *   const { validateSignal, normalizeSignal, SIGNALS,
 *           valuationConfidence, consensusConfidence } = require('./lib/signal-schema');
 *
 * Usage (CLI) :
 *   node tools/lib/signal-schema.js --self-test      # smoke-test déterministe (idée #2/#6a)
 */

const SIGNALS = Object.freeze(['bullish', 'bearish', 'neutral']);
const SIGNAL_VALUE = Object.freeze({ bullish: 1, bearish: -1, neutral: 0 });

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/**
 * validateSignal(obj) → { ok:boolean, errors:string[] }
 * Ne lève jamais. Collecte TOUTES les erreurs (utile pour un rapport de gate).
 * REJETTE (ok:false) tout objet qui ne respecte pas le contrat pivot au sens strict.
 */
function validateSignal(obj) {
  const errors = [];
  if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, errors: ['le signal doit être un objet non-null'] };
  }
  // signal : énumération fermée, sensible à la casse (canonique = minuscule)
  if (!SIGNALS.includes(obj.signal)) {
    errors.push(`signal invalide: ${JSON.stringify(obj.signal)} (attendu ${SIGNALS.join('|')})`);
  }
  // confidence : nombre fini dans [0,100] (fail-closed : NaN/undefined/string = rejet)
  if (!isNum(obj.confidence)) {
    errors.push(`confidence non numérique: ${JSON.stringify(obj.confidence)}`);
  } else if (obj.confidence < 0 || obj.confidence > 100) {
    errors.push(`confidence hors bornes [0,100]: ${obj.confidence}`);
  }
  // reasoning : chaîne non vide (un gabarit factuel, jamais vide → traçabilité MCP)
  if (typeof obj.reasoning !== 'string' || obj.reasoning.trim() === '') {
    errors.push('reasoning manquant ou vide (doit tracer le fondement factuel MCP)');
  }
  return { ok: errors.length === 0, errors };
}

/**
 * normalizeSignal(obj) → { signal, confidence, reasoning }  (canonique)
 * LÈVE une TypeError si le signal est irrécupérablement malformé (fail-closed).
 * Sinon : confidence arrondie à l'entier + clampée [0,100], reasoning trimé.
 * On NE fabrique JAMAIS un champ absent — on rejette.
 */
function normalizeSignal(obj) {
  const { ok, errors } = validateSignal(obj);
  if (!ok) throw new TypeError('signal malformé (rejeté, non réparé): ' + errors.join(' ; '));
  return {
    signal: obj.signal,
    confidence: Math.round(clamp(obj.confidence, 0, 100)),
    reasoning: obj.reasoning.trim(),
  };
}

// ─── Idée #6a — formules de confidence AUDITABLES (code reproductible) ────────────────

/**
 * valuationConfidence(gap) — style "valuation" (§5/§6 du doc).
 * gap = (valeur_modèle − prix) / prix, en FRACTION (0.15 = +15%).
 * confidence = min(|gap| / 0.30 × 100, 100). Un gap de 30% = confidence 100 (plafond).
 * Retourne un entier 0..100 (= champ confidence pivot valide).
 */
function valuationConfidence(gap) {
  if (!isNum(gap)) throw new TypeError('valuationConfidence: gap non numérique (fail-closed)');
  return Math.round(clamp((Math.abs(gap) / 0.30) * 100, 0, 100));
}

/**
 * consensusConfidence(bull, bear, n) — style "consensus" (§6 du doc).
 * bull/bear = nb de votants dans chaque camp ; n = nb total de votants.
 * confidence = max(bull, bear) / n × 100. Unanimité = 100 ; parité = 50.
 * Retourne un entier 0..100.
 */
function consensusConfidence(bull, bear, n) {
  if (!isNum(bull) || !isNum(bear) || !isNum(n)) {
    throw new TypeError('consensusConfidence: bull/bear/n non numériques (fail-closed)');
  }
  if (n <= 0) return 0;
  return Math.round(clamp((Math.max(bull, bear) / n) * 100, 0, 100));
}

module.exports = {
  SIGNALS,
  SIGNAL_VALUE,
  validateSignal,
  normalizeSignal,
  valuationConfidence,
  consensusConfidence,
};

// ─── CLI / smoke-test ──────────────────────────────────────────────────────────────────
if (require.main === module) {
  const argv = process.argv.slice(2);
  if (argv.includes('--self-test')) {
    const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } };

    // (i) le validateur REJETTE un signal malformé — plusieurs formes.
    const bad = [
      { signal: 'up', confidence: 80, reasoning: 'x' },          // enum invalide
      { signal: 'bullish', confidence: '80', reasoning: 'x' },    // confidence string
      { signal: 'bullish', confidence: NaN, reasoning: 'x' },     // confidence NaN
      { signal: 'bullish', confidence: 140, reasoning: 'x' },     // hors bornes
      { signal: 'bullish', confidence: 80, reasoning: '   ' },    // reasoning vide
      { signal: 'bullish', confidence: 80 },                      // reasoning absent
      null, 42, [1, 2],                                           // pas un objet
    ];
    for (const b of bad) {
      assert(validateSignal(b).ok === false, 'devrait rejeter: ' + JSON.stringify(b));
      let threw = false;
      try { normalizeSignal(b); } catch { threw = true; }
      assert(threw, 'normalizeSignal devrait lever sur: ' + JSON.stringify(b));
    }

    // un signal VALIDE passe et est normalisé (arrondi + trim), sans rien inventer.
    const good = normalizeSignal({ signal: 'bearish', confidence: 72.6, reasoning: '  put-skew + SI↑  ' });
    assert(good.signal === 'bearish' && good.confidence === 73 && good.reasoning === 'put-skew + SI↑',
      'normalisation valide incorrecte: ' + JSON.stringify(good));

    // (idée #6a) formules de confidence auditables + déterministes.
    assert(valuationConfidence(0.15) === 50, 'valuationConfidence(0.15) devrait = 50, got ' + valuationConfidence(0.15));
    assert(valuationConfidence(0.30) === 100, 'valuationConfidence(0.30) plafond 100');
    assert(valuationConfidence(-0.30) === 100, 'valuationConfidence négatif → |gap|');
    assert(valuationConfidence(0.45) === 100, 'valuationConfidence clampé à 100');
    assert(consensusConfidence(4, 1, 5) === 80, 'consensusConfidence(4,1,5) = 80, got ' + consensusConfidence(4, 1, 5));
    assert(consensusConfidence(3, 3, 6) === 50, 'consensusConfidence parité = 50');
    assert(consensusConfidence(0, 0, 0) === 0, 'consensusConfidence n=0 → 0 (fail-closed)');
    // déterminisme : même entrée → même sortie
    assert(valuationConfidence(0.22) === valuationConfidence(0.22), 'valuationConfidence non déterministe');

    console.log('SELF-TEST OK — signal-schema : validateur rejette le malformé, formules confidence auditables & déterministes.');
    console.log('  contrat pivot :', JSON.stringify({ signal: 'bullish|bearish|neutral', confidence: '0-100', reasoning: 'string' }));
    process.exit(0);
  }
  console.log('Usage: node tools/lib/signal-schema.js --self-test');
  console.log('Contrat pivot: { signal: bullish|bearish|neutral, confidence: 0-100, reasoning: string }');
  process.exit(0);
}
