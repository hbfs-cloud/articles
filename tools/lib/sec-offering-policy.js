'use strict';
// Politique SEC d'offre d'actions du scanner — source unique, lue dans
// data/scanner-filters.json#sec_offering_policy.
//
// Décision durable du propriétaire du 2026-09-24 : un S-8 (plan d'actions salariés) ne rejette plus
// une valeur à lui seul. S-3, 424B*, ATM, convertibles, 8-K items 3.02/3.03 et PIPE restent
// bloquants. Toute forme ou nature non reconnue reste BLOQUANTE : la liste des formes tolérées est
// fermée, elle ne s'étend pas par défaut.
const fs = require('fs');
const path = require('path');

function loadPolicy(root = path.resolve(__dirname, '../..')) {
  const filters = JSON.parse(fs.readFileSync(path.join(root, 'data/scanner-filters.json'), 'utf8'));
  const policy = filters.sec_offering_policy;
  if (!policy || !Array.isArray(policy.non_blocking_forms) || !Array.isArray(policy.blocking_forms)) {
    throw new Error('scanner-filters.json#sec_offering_policy absent ou incomplet');
  }
  return policy;
}

/** Classe UNE preuve d'offre d'actions : 'non_blocking' ou 'blocking'. */
function classifyHit(hit, policy) {
  const form = String(hit && hit.form || '').trim().toUpperCase();
  const kind = String(hit && hit.kind || '').trim();
  const items = String(hit && hit.items || '');
  if (kind && policy.blocking_kinds.includes(kind)) return 'blocking';
  if (policy.blocking_8k_items.some(item => items.split(',').map(s => s.trim()).includes(item))) return 'blocking';
  if (policy.non_blocking_forms.map(f => f.toUpperCase()).includes(form) && (!kind || kind === 'employee_plan')) return 'non_blocking';
  return 'blocking';
}

/** Preuves d'offre qui bloquent une valeur, après application de la politique. */
function blockingHits(hits, policy) {
  return (Array.isArray(hits) ? hits : []).filter(hit => classifyHit(hit, policy) === 'blocking');
}

module.exports = { loadPolicy, classifyHit, blockingHits };
