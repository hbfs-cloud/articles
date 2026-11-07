'use strict';
// Preuve DATÉE de la prochaine publication de résultats quand la source de calendrier n'en donne pas.
//
// Décision du propriétaire du 2026-11-07 (« il faut faire le scan du 9 »), arbitrée pour la seule
// séance du 9 novembre 2026 : une action écartée UNIQUEMENT parce que la source n'avait pas de prochaine
// date de résultats peut revenir si deux dépôts EDGAR permettent de déduire que la prochaine publication tombe après
// la fin de la fenêtre d'exclusion : (a) le 8-K item 2.02 du trimestre qui vient d'être publié, (b) le
// 8-K item 2.02 du trimestre suivant l'an dernier, sans aucun 8-K item 2.02 dans la même fenêtre l'an
// dernier. La règle fail-closed générale ne change pas : sans fichier
// `scanner/<YYYYMMDD>/_earnings-date-proof.json` valide pour une séance de la liste fermée, un calendrier
// indisponible reste un rejet.
const fs = require('fs');
const path = require('path');

// LISTE FERMÉE des séances pour lesquelles le propriétaire a admis cette preuve. Ajouter une date est un
// acte délibéré et relu, jamais un effet de bord d'un run.
const ALLOWED_DATES = Object.freeze(['2026-11-09']);

const KEYS = ['all_other_gates_required', 'date', 'exclusion_window_end', 'exclusion_window_start', 'public_notice', 'refdate', 'rule', 'tickers', 'user_instruction'];
const ACC = /^\d{10}-\d{2}-\d{6}$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function validateFiling(f, label, errors) {
  if (!f || typeof f !== 'object') { errors.push(`${label} absent`); return; }
  if (!ISO.test(String(f.date))) errors.push(`${label}.date invalide`);
  if (!ACC.test(String(f.accession))) errors.push(`${label}.accession invalide`);
  if (!/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\//.test(String(f.url))) errors.push(`${label}.url hors EDGAR`);
}

function validateProof(doc, { date, refdate }) {
  const errors = [];
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return ['proof must be an object'];
  const keys = Object.keys(doc).sort();
  if (JSON.stringify(keys) !== JSON.stringify(KEYS)) errors.push(`proof keys must be exactly ${KEYS.join(', ')}`);
  if (doc.date !== date) errors.push(`proof date ${doc.date} != scan ${date}`);
  const iso = /^\d{8}$/.test(String(date)) ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}` : String(date);
  if (!ALLOWED_DATES.includes(iso)) errors.push(`session ${iso} is not in the closed list of owner-approved earnings-date proofs`);
  if (doc.refdate !== refdate) errors.push(`proof refdate ${doc.refdate} != ${refdate}`);
  if (doc.all_other_gates_required !== true) errors.push('proof must keep all_other_gates_required=true');
  for (const key of ['user_instruction', 'rule', 'public_notice']) {
    if (typeof doc[key] !== 'string' || !doc[key].trim()) errors.push(`${key} must be a non-empty string`);
  }
  if (!ISO.test(String(doc.exclusion_window_end)) || !ISO.test(String(doc.exclusion_window_start))) errors.push('exclusion window dates invalid');
  for (const [t, p] of Object.entries(doc.tickers || {})) {
    if (p.conclusion !== 'outside_exclusion_window') continue;
    validateFiling(p.recent_8k_202, `${t}.recent_8k_202`, errors);
    validateFiling(p.prior_year_q4_8k_202, `${t}.prior_year_q4_8k_202`, errors);
    if (p.recent_8k_202 && p.recent_8k_202.date > refdate) errors.push(`${t}: 8-K récent postérieur à la clôture de référence`);
    if (p.recent_8k_202 && p.recent_8k_202.date >= doc.exclusion_window_start) errors.push(`${t}: 8-K récent dans la fenêtre d'exclusion`);
    if (p.no_8k_202_between_2025_11_09_and_2025_11_23 !== true) errors.push(`${t}: un 8-K item 2.02 tombait dans la même fenêtre l'an dernier`);
  }
  return errors;
}

// Renvoie la preuve d'un ticker si le fichier de la séance est valide et conclut hors fenêtre, sinon null.
function proofFor({ root, dirRel, date, refdate, ticker }) {
  const file = path.join(root, dirRel, '_earnings-date-proof.json');
  if (!fs.existsSync(file)) return null;
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  const errors = validateProof(doc, { date, refdate });
  if (errors.length) throw new Error(`_earnings-date-proof.json invalide : ${errors.join(' ; ')}`);
  const p = (doc.tickers || {})[ticker];
  if (!p || p.conclusion !== 'outside_exclusion_window') return null;
  return { ...p, exclusion_window_end: doc.exclusion_window_end, public_notice: doc.public_notice };
}

module.exports = { ALLOWED_DATES, KEYS, validateProof, proofFor };
