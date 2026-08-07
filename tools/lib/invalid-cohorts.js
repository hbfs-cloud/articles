'use strict';
// ─── tools/lib/invalid-cohorts.js ────────────────────────────────────────────
// Lecture du registre DÉCLARATIF des cohortes de trades invalides
// (`data/invalid-cohorts.json`).
//
// POURQUOI. Certains trades scellés sont entrés via un filtre de sélection
// inopérant : leur P&L ne mesure pas la stratégie annoncée. Ils ne peuvent pas
// être corrigés (immutabilité des trades clôturés + chaîne SHA-256 de
// `data/trade-chain.json` — `sweep.js` avorte sur violation), donc on les
// MARQUE au lieu de les toucher. Ce module est le seul point de lecture du
// registre ; il ne modifie jamais un trade ni un fichier.
//
// CONTRAT (important).
//   • Le MARQUAGE est toujours disponible et toujours reporté par les
//     consommateurs (compte + ids de cohortes) — un trade invalide est visible
//     partout, sans rien changer aux chiffres.
//   • L'EXCLUSION est OPT-IN. Elle ne s'active que via
//     `opts.excludeInvalidCohorts === true` ou `EXCLUDE_INVALID_COHORTS=1`.
//     Raison : la comptabilité des modes est point-in-time et publiée
//     (equity curves scellées, `portfolio/v1/*`). Filtrer par défaut
//     réécrirait silencieusement un track record. Le re-baseline se décide,
//     il ne se subit pas.
//
// Voir `data/invalid-cohorts.json` (`_schema`) pour la forme des entrées.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const REGISTRY_PATH = path.join(ROOT, 'data', 'invalid-cohorts.json');

const VALID_FIELDS = ['scanDate', 'entryDate', 'exitDate'];

let _cache = null;
let _cacheMtimeMs = -1;

/**
 * Charge (et met en cache, invalidé au mtime) les cohortes déclarées.
 * Registre absent ou illisible → [] : le mécanisme est inerte, jamais bloquant.
 * @returns {Array<object>} cohortes normalisées
 */
function loadCohorts() {
  let mtimeMs;
  try {
    mtimeMs = fs.statSync(REGISTRY_PATH).mtimeMs;
  } catch (_) {
    _cache = [];
    _cacheMtimeMs = -1;
    return _cache;
  }
  if (_cache && mtimeMs === _cacheMtimeMs) return _cache;

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  } catch (e) {
    console.warn(`[invalid-cohorts] registre illisible (${e.message}) — marquage inactif.`);
    _cache = [];
    _cacheMtimeMs = mtimeMs;
    return _cache;
  }

  const out = [];
  for (const c of (raw.cohorts || [])) {
    if (!c || !c.id || !c.from || !c.to) continue;
    const field = VALID_FIELDS.includes(c.field) ? c.field : 'scanDate';
    out.push({
      id: c.id,
      field,
      from: c.from,
      to: c.to,
      modes: c.modes === undefined ? '*' : c.modes,
      action: c.action || 'exclude-from-stats',
      severity: c.severity || 'invalid',
      label: c.label || c.id,
      reason: c.reason || '',
    });
  }
  _cache = out;
  _cacheMtimeMs = mtimeMs;
  return _cache;
}

function cohortAppliesToMode(cohort, modeId) {
  if (cohort.modes === '*' || cohort.modes == null) return true;
  if (Array.isArray(cohort.modes)) return modeId ? cohort.modes.includes(modeId) : false;
  return cohort.modes === modeId;
}

/**
 * Première cohorte invalidante à laquelle ce trade appartient (ou null).
 * Seule `severity: "invalid"` marque ; `suspect` est documentaire.
 */
function matchCohort(trade, modeId) {
  if (!trade) return null;
  for (const c of loadCohorts()) {
    if (c.severity !== 'invalid') continue;
    if (!cohortAppliesToMode(c, modeId)) continue;
    const d = trade[c.field];
    if (typeof d !== 'string' || !d) continue;
    // Bornes INCLUSES ; comparaison lexicographique valide sur du YYYY-MM-DD.
    if (d >= c.from && d <= c.to) return c;
  }
  return null;
}

/** true si le trade appartient à une cohorte invalidante. */
function isInvalidTrade(trade, modeId) {
  return matchCohort(trade, modeId) !== null;
}

/**
 * Sépare une liste de trades en valides / invalides, sans muter les objets.
 * @returns {{valid:Array, invalid:Array, byCohort:Object<string,number>, cohortIds:string[]}}
 */
function partitionTrades(trades, modeId) {
  const valid = [];
  const invalid = [];
  const byCohort = {};
  for (const t of (trades || [])) {
    const c = matchCohort(t, modeId);
    if (c) {
      invalid.push(t);
      byCohort[c.id] = (byCohort[c.id] || 0) + 1;
    } else {
      valid.push(t);
    }
  }
  return { valid, invalid, byCohort, cohortIds: Object.keys(byCohort) };
}

/**
 * Résumé prêt à être recopié dans un bloc de stats.
 * `excluded` dit si l'appelant a réellement retiré ces trades du calcul.
 */
function summarize(trades, modeId, excluded) {
  const p = partitionTrades(trades, modeId);
  return {
    invalidCohortTrades: p.invalid.length,
    invalidCohorts: p.cohortIds,
    invalidCohortExcluded: !!excluded,
  };
}

/**
 * L'exclusion est-elle demandée ? `opts.excludeInvalidCohorts` prime sur
 * l'environnement ; par défaut : NON (marquage seul).
 */
function isExclusionEnabled(opts = {}) {
  if (typeof opts.excludeInvalidCohorts === 'boolean') return opts.excludeInvalidCohorts;
  const env = process.env.EXCLUDE_INVALID_COHORTS;
  return env === '1' || env === 'true';
}

module.exports = {
  REGISTRY_PATH,
  loadCohorts,
  matchCohort,
  isInvalidTrade,
  partitionTrades,
  summarize,
  isExclusionEnabled,
};
