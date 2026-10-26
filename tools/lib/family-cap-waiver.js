'use strict';
// Dérogation DATÉE au plafond par défaut de concentration par famille de stratégie
// (data/scanner-filters.json → audit_gates.recent_strategy_performance.default_max_share_pct).
//
// Décision du propriétaire du 2026-10-24 pour la séance du 26 octobre 2026 : aucune ligne hors
// suivi de tendance ne passait les filtres, et le plafond de 50 % interdisait toute liste ; réponse
// « Lever le plafond 50 % ». Le contrôle n'est PAS désactivé : il accepte un plafond relevé
// uniquement si un fichier `scanner/<YYYYMMDD>/_family-cap-waiver.json` le déclare, pour CETTE
// séance seulement, avec un schéma fermé, une provenance et une mention publique. Les plafonds
// temporaires de data/scanner-strategy-overlays.json restent appliqués. Tout écart invalide la
// dérogation et le plafond normal s'applique.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// LISTE FERMÉE des séances pour lesquelles le propriétaire a levé le plafond. Ajouter une date est
// un acte délibéré et relu, jamais un effet de bord d'un run.
const ALLOWED_DATES = Object.freeze(['2026-10-26']);

const KEYS = ['all_other_gates_required', 'date', 'max_share_pct', 'provenance', 'public_notice', 'reason', 'refdate', 'user_instruction'];

function isoOf(date) {
  const s = String(date);
  return /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s;
}

function validateWaiver(doc, { date, refdate, gate }) {
  const errors = [];
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return ['waiver must be an object'];
  const keys = Object.keys(doc).sort();
  if (JSON.stringify(keys) !== JSON.stringify(KEYS)) errors.push(`waiver keys must be exactly ${KEYS.join(', ')}`);
  if (doc.date !== String(date)) errors.push(`waiver date ${doc.date} != scan ${date}`);
  if (!ALLOWED_DATES.includes(isoOf(date))) errors.push(`session ${isoOf(date)} is not in the closed list of owner-approved family-cap waiver dates`);
  if (doc.refdate !== refdate) errors.push(`waiver refdate ${doc.refdate} != ${refdate}`);
  if (doc.all_other_gates_required !== true) errors.push('waiver must keep all_other_gates_required=true');
  const normal = Number((gate && gate.default_max_share_pct) ?? 50);
  const v = doc.max_share_pct;
  if (!Number.isInteger(v) || v <= normal || v > 100) errors.push(`max_share_pct must be an integer above the normal cap ${normal} and at most 100`);
  for (const key of ['user_instruction', 'provenance', 'reason', 'public_notice']) {
    if (typeof doc[key] !== 'string' || !doc[key].trim()) errors.push(`${key} must be a non-empty string`);
  }
  return errors;
}

/** Plafond par défaut effectif pour la séance : celui de la dérogation si elle est valide, sinon le normal. */
function effectiveDefaultShare({ root, dirRel, date, refdate, gate }) {
  const normal = Number((gate && gate.default_max_share_pct) ?? 50);
  const file = path.join(root, dirRel, '_family-cap-waiver.json');
  if (!fs.existsSync(file)) return { default_max_share_pct: normal, waiver: null };
  const raw = fs.readFileSync(file);
  const doc = JSON.parse(raw);
  const errors = validateWaiver(doc, { date, refdate, gate });
  if (errors.length) throw new Error(`dérogation au plafond par famille invalide : ${errors.join('; ')}`);
  return {
    default_max_share_pct: doc.max_share_pct,
    waiver: { path: path.relative(root, file), sha256: crypto.createHash('sha256').update(raw).digest('hex'),
      normal_default_max_share_pct: normal, max_share_pct: doc.max_share_pct,
      provenance: doc.provenance, public_notice: doc.public_notice, reason: doc.reason },
  };
}

module.exports = { KEYS, ALLOWED_DATES, validateWaiver, effectiveDefaultShare };
