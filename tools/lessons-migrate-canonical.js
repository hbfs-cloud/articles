#!/usr/bin/env node
'use strict';
/**
 * lessons-migrate-canonical.js — met `data/scanner-lessons.json` à la forme canonique du moteur.
 *
 * POURQUOI. Le schéma canonique (class / scope / effect / confidence_base / created_at /
 * last_validated_at / invalidation_conditions / notes, + le couple half_life_days/expires_at) a été
 * appliqué une fois, à la main, à 47 règles. Rien ne le rejouait ensuite : une règle ajoutée après
 * coup (`tp1-reachability`, 2026-08-08) est restée dans l'ancien vocabulaire (`applies_to` au lieu
 * de `scope`, `rationale` au lieu de `notes`, aucun des huit autres champs), et trois règles
 * gardaient une `class` hors vocabulaire. `tools/lessons-engine.test.js` le signalait par 9 échecs.
 *
 * CE N'EST PAS UN CORRECTIF DE TEST. Les classes hors vocabulaire cachaient un vrai défaut : le
 * moteur ne fait décroître que les `market_truth`, et un `process_rule` ne décroît JAMAIS
 * (half_life_days et expires_at à null). Étiquetées `process`/`infrastructure`, quatre règles de
 * MÉTHODE se retrouvaient décrémentables. Mesuré avant migration :
 *   earnings-window-must-cover-horizon                0,597 aujourd'hui → 0,193 au 2027-06-01
 *   atr-cushion-verified-at-fill-not-published-level  0,597 aujourd'hui → 0,193 au 2027-06-01
 * soit sous le plancher de dépréciation (0,30) : deux filtres de sélection se seraient éteints tout
 * seuls, sans qu'aucune mesure ne les contredise. « Le coussin d'ATR se vérifie depuis entry_low »
 * ne devient pas moins vrai parce que du temps a passé.
 *
 * IDEMPOTENT : ne remplit que ce qui MANQUE, ne réécrit jamais une valeur existante (hormis les
 * alias de `class`, qui sont un renommage). Rejouable après chaque ajout de règle ; `--check` sort
 * en 1 si une règle n'est pas canonique, sans rien écrire.
 *
 * Usage :
 *   node tools/lessons-migrate-canonical.js [--check] [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const engine = require('./lessons-engine.js');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'data', 'scanner-lessons.json');

const CHECK = process.argv.includes('--check');
const DRY = process.argv.includes('--dry-run');

const CANONICAL_FIELDS = ['class', 'status', 'scope', 'effect', 'evidence', 'confidence',
  'confidence_base', 'created_at', 'last_validated_at', 'invalidation_conditions', 'notes'];

// Alias de `class` → classe canonique. Chacune de ces règles décrit une MÉTHODE (comment calculer,
// vérifier ou comptabiliser), pas un comportement de marché : elles ne se mesurent pas, donc elles
// ne décroissent pas. C'est exactement ce que `process_rule` exprime dans le moteur.
const CLASS_ALIASES = {
  process: 'process_rule',
  // `infrastructure` était un troisième nom pour la même idée, contourné par un half_life de
  // 3 650 jours (« ne décroît jamais, en pratique »). Le dire dans la classe plutôt que dans un
  // grand nombre.
  infrastructure: 'process_rule',
};

// Champs qu'aucune dérivation générique ne peut produire (`class`, `effect`, les dates, la
// demi-vie) et qui doivent donc être posés RÈGLE PAR RÈGLE, avec la source de chaque valeur. Une
// règle absente de cette table et à qui il manque l'un de ces champs fera échouer `--check` : c'est
// voulu, on ne comble pas un trou de schéma par un défaut silencieux.
const SEED = {
  // Ajoutée le 2026-08-08 (commit 1e27cf425) après la migration canonique, donc restée à l'ancien
  // vocabulaire. Toutes les valeurs ci-dessous sortent d'artefacts existants, aucune n'est estimée.
  'tp1-reachability': {
    // Mesure empirique (21 scans, 88 trades, courbe d'espérance à optimum net) : c'est une vérité de
    // marché, qui doit se re-vérifier dans le temps — pas une règle de méthode.
    class: 'market_truth',
    effect: {
      // Slug distinct de `cap_tp1_distance` (déjà porté par tp1-horizon-calibration, en R et non en
      // ATR) : deux règles au même slug seraient comparées par findContradictions alors qu'elles ne
      // s'expriment pas dans la même unité. `reject_` le classe en `restrict` via RESTRICT_RE.
      action: 'reject_tp1_out_of_atr_band',
      target: { strategy: ['momentum', 'breakout', 'pullback', 'pre-squeeze'] },
      // Paramètres RECOPIÉS de data/scanner-filters.json#editorial_targets.tp1_reachability —
      // la config exécutable fait foi, cette entrée la cite.
      params: { min_atr_multiple: 1, max_atr_multiple: 2, target_atr_multiple: 1.5, requires: 'extension.atr', fail_closed: true },
    },
    // Date de la rétro dont elle sort (`from_retros: ['backtest-20260808']`, commit du 2026-08-08).
    created_at: '2026-08-08',
    last_validated_at: '2026-08-08',
    // 180, comme rr-min-by-regime — le gate de cible qu'elle remplace, même sévérité (hard_block),
    // même nature (calibration de cible mesurée sur trades clos).
    half_life_days: 180,
  },
};

/** Champs canoniques déduits pour une règle donnée. Uniquement des valeurs DÉRIVÉES de la règle
 *  elle-même ou d'un artefact existant du dépôt — rien n'est inventé ici. */
function derive(rule) {
  const out = {};

  // scope ← applies_to quand il a déjà la bonne forme {setups, regimes, modes}.
  if (!('scope' in rule)) {
    const a = rule.applies_to;
    out.scope = (a && !Array.isArray(a) && typeof a === 'object')
      ? { setups: a.setups || [], regimes: a.regimes || [], modes: a.modes || [] }
      : { setups: [], regimes: [], modes: [] };
  }

  // notes ← le texte long de la règle. La migration d'origine repliait `rationale` dans `notes`
  // avec le séparateur « | Rationale: » (cf. rr-min-by-regime) : on suit la même convention.
  if (!('notes' in rule)) {
    out.notes = rule.rationale ? `Rationale: ${rule.rationale}` : '';
  }

  if (!('confidence_base' in rule)) {
    // Une règle jamais décrue a confidence_base === confidence (invariant vérifié sur les 47 autres).
    out.confidence_base = typeof rule.confidence === 'number' ? rule.confidence : 0.5;
  }

  if (!('invalidation_conditions' in rule)) out.invalidation_conditions = [];
  if (!('status' in rule)) out.status = 'active';
  if (!('evidence' in rule)) {
    out.evidence = { sample_size: null, wins: null, losses: null, expectancy: null, period: null, tickers: [], clusters: [], source_retros: [] };
  }
  return out;
}

function main() {
  const data = engine.loadLessons(FILE);
  const rules = data.rules || [];
  const changes = [];

  for (const r of rules) {
    // 0) valeurs posées règle par règle (voir SEED), avant tout le reste : `class` conditionne
    //    les invariants appliqués ensuite.
    const seed = SEED[r.id];
    if (seed) {
      for (const [k, v] of Object.entries(seed)) {
        if (Object.prototype.hasOwnProperty.call(r, k) && r[k] !== undefined) continue; // jamais écraser
        changes.push(`${r.id}: +${k} (seed)`);
        r[k] = v;
      }
    }
    // 1) alias de classe → classe canonique, et cohérence du couple non-décroissance.
    if (r.class && CLASS_ALIASES[r.class]) {
      changes.push(`${r.id}: class ${r.class} → ${CLASS_ALIASES[r.class]}`);
      r.class = CLASS_ALIASES[r.class];
    }
    if (r.class === 'process_rule') {
      // Invariant du moteur : un process_rule ne décroît pas. Un half_life/expires non nul est une
      // décroissance armée sur une règle qui n'a pas à décroître.
      if (r.half_life_days !== null) { changes.push(`${r.id}: half_life_days ${r.half_life_days} → null (process_rule ne décroît pas)`); r.half_life_days = null; }
      if (r.expires_at !== null) { changes.push(`${r.id}: expires_at ${r.expires_at} → null`); r.expires_at = null; }
      // confidence d'un process_rule = sa base, sans érosion par le temps.
      if (typeof r.confidence_base === 'number' && r.confidence !== r.confidence_base) {
        changes.push(`${r.id}: confidence ${r.confidence} → ${r.confidence_base} (base restaurée)`);
        r.confidence = r.confidence_base;
      }
    }
    // 2) champs canoniques manquants.
    const add = derive(r);
    for (const [k, v] of Object.entries(add)) {
      changes.push(`${r.id}: +${k}`);
      r[k] = v;
    }
  }

  // 3) recalcul de expires_at pour les market_truth dont la date manque ou n'est plus cohérente
  //    avec (confidence_base, last_validated_at, half_life_days) — c'est la formule du moteur.
  for (const r of rules) {
    if (r.class !== 'market_truth') continue;
    if (!r.half_life_days || !r.last_validated_at || typeof r.confidence_base !== 'number') continue;
    const exp = engine.expiryDate(r.confidence_base, r.last_validated_at, r.half_life_days);
    if (r.expires_at !== exp) { changes.push(`${r.id}: expires_at ${r.expires_at ?? '—'} → ${exp}`); r.expires_at = exp; }
  }

  const nonCanonical = rules.filter(r => CANONICAL_FIELDS.some(f => !Object.prototype.hasOwnProperty.call(r, f))
    || (r.class !== 'market_truth' && r.class !== 'process_rule'));

  if (CHECK) {
    if (nonCanonical.length) {
      console.error(`❌ ${nonCanonical.length} règle(s) hors schéma canonique : ${nonCanonical.map(r => r.id).join(', ')}`);
      console.error('   Rejouer : node tools/lessons-migrate-canonical.js');
      process.exit(1);
    }
    console.log(`✅ ${rules.length} règles conformes au schéma canonique.`);
    process.exit(0);
  }

  if (!changes.length) { console.log(`Rien à migrer — ${rules.length} règles déjà canoniques.`); return; }
  console.log(`Migration de ${FILE.replace(ROOT + '/', '')} :`);
  for (const c of changes) console.log(`  · ${c}`);
  if (DRY) { console.log('[DRY-RUN] rien écrit.'); return; }
  engine.saveLessons(FILE, data);
  console.log(`✅ ${changes.length} changement(s) écrit(s) — ${rules.length} règles.`);
}

main();
