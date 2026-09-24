'use strict';
// Dérogation DATÉE au plancher de composition du panier (min_us_count / min_etf_count).
//
// Décision du propriétaire du 2026-09-24 : un choc de taux peut laisser moins de lignes honnêtes
// que le plancher ; on publie alors ce qui passe, sans jamais compléter artificiellement. Le
// contrôle n'est PAS désactivé : il accepte un plancher abaissé uniquement si un fichier
// `scanner/<YYYYMMDD>/_basket-minimum-waiver.json` le déclare, pour CETTE séance seulement, avec un
// schéma fermé, une provenance et une mention publique. Tout écart invalide la dérogation et le
// plancher normal s'applique.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// LISTE FERMÉE des séances pour lesquelles le propriétaire a accordé une dérogation. Un fichier
// déposé pour une autre séance est refusé, même bien formé : ajouter une date ici est un acte
// délibéré et relu, jamais un effet de bord d'un run.
const ALLOWED_DATES = Object.freeze(['2026-09-24']);

const KEYS = ['all_other_gates_required', 'date', 'min_etf_count', 'min_us_count', 'provenance', 'public_notice', 'reason', 'refdate', 'user_instruction'];

function validateWaiver(doc, { date, refdate, filters }) {
  const errors = [];
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return ['waiver must be an object'];
  const keys = Object.keys(doc).sort();
  if (JSON.stringify(keys) !== JSON.stringify(KEYS)) errors.push(`waiver keys must be exactly ${KEYS.join(', ')}`);
  if (doc.date !== date) errors.push(`waiver date ${doc.date} != scan ${date}`);
  const iso = /^\d{8}$/.test(String(date)) ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}` : String(date);
  if (!ALLOWED_DATES.includes(iso)) errors.push(`session ${iso} is not in the closed list of owner-approved waiver dates`);
  if (doc.refdate !== refdate) errors.push(`waiver refdate ${doc.refdate} != ${refdate}`);
  if (doc.all_other_gates_required !== true) errors.push('waiver must keep all_other_gates_required=true');
  const div = (filters && filters.diversification) || {};
  for (const key of ['min_us_count', 'min_etf_count']) {
    const v = doc[key];
    if (!Number.isInteger(v) || v < 0) errors.push(`${key} must be a non-negative integer`);
    else if (Number.isInteger(div[key]) && v > div[key]) errors.push(`${key} ${v} above the normal floor ${div[key]} is not a waiver`);
  }
  for (const key of ['user_instruction', 'provenance', 'reason', 'public_notice']) {
    if (typeof doc[key] !== 'string' || !doc[key].trim()) errors.push(`${key} must be a non-empty string`);
  }
  return errors;
}

/** Planchers effectifs pour la séance : ceux de la dérogation si elle est valide, sinon les normaux. */
function effectiveFloors({ root, dirRel, date, refdate, filters }) {
  const div = filters.diversification || {};
  const normal = { min_us_count: div.min_us_count, min_etf_count: div.min_etf_count, waiver: null };
  const file = path.join(root, dirRel, '_basket-minimum-waiver.json');
  if (!fs.existsSync(file)) return normal;
  const raw = fs.readFileSync(file);
  const doc = JSON.parse(raw);
  const errors = validateWaiver(doc, { date, refdate, filters });
  if (errors.length) throw new Error(`dérogation au plancher invalide : ${errors.join('; ')}`);
  return {
    min_us_count: doc.min_us_count, min_etf_count: doc.min_etf_count,
    waiver: { path: path.relative(root, file), sha256: crypto.createHash('sha256').update(raw).digest('hex'),
      normal_floors: { min_us_count: div.min_us_count, min_etf_count: div.min_etf_count },
      min_us_count: doc.min_us_count, min_etf_count: doc.min_etf_count,
      provenance: doc.provenance, public_notice: doc.public_notice, reason: doc.reason },
  };
}

module.exports = { KEYS, ALLOWED_DATES, validateWaiver, effectiveFloors };
