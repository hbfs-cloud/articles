'use strict';

/**
 * fill-policy.js — décision de remplissage UNIQUE scan/rétro.
 *
 * Origine : audit scanner 13-19/07/2026 (mémoire tag lecon-20260717, règle
 * retro-grades-published-levels). La rétro du 17/07 avait noté 4 lignes du jeudi
 * remplies à +2,3%/+4,2% au-dessus de la zone publiée, au-delà de la tolérance
 * chase de 2% affichée dans sa propre légende — parce que la tolérance vivait
 * dans le jugement du rédacteur, pas dans le code.
 *
 * Règle : UNE constante, UNE fonction. Tout consommateur (gate de build du scan,
 * gate de build de la rétro, futur moteur de tracking des fills) importe ce module.
 * Aucune tolérance chase ne doit être re-déclarée ailleurs. Un écart au-delà de la
 * tolérance passe en « Transparence process » de la rétro, JAMAIS en rebasing
 * silencieux de l'entrée.
 *
 * Gate CI : tools/qa-retro.js (branché dans publish.js --type retro) fait échouer
 * le build de la rétro si une ligne notée viole cette politique.
 */

const CHASE_TOLERANCE_PCT = 2;

/**
 * Statut d'une entrée effective face au niveau publié.
 *
 * @param {number} publishedEntry  borne haute de la zone publiée (champ `entry` du scan)
 * @param {number} effectiveEntry  prix d'entrée effectivement retenu
 * @param {number} [tolerancePct]  défaut CHASE_TOLERANCE_PCT — ne surcharger qu'en test
 * @returns {{status: 'filled'|'chase'|'no_fill', deviationPct: number}}
 *   filled  : effectiveEntry <= publishedEntry (dans ou sous la zone)
 *   chase   : au-dessus de la zone, écart <= tolérance → la ligne DOIT porter le tag chase
 *   no_fill : au-delà de la tolérance → la ligne DOIT être NON REMPLI (jamais notée)
 */
function decideFill(publishedEntry, effectiveEntry, tolerancePct = CHASE_TOLERANCE_PCT) {
  if (!(publishedEntry > 0) || !(effectiveEntry > 0)) {
    // fail-closed : niveau manquant/invalide = pas de notation possible
    return { status: 'no_fill', deviationPct: NaN };
  }
  const deviationPct = +(((effectiveEntry - publishedEntry) / publishedEntry) * 100).toFixed(2);
  if (effectiveEntry <= publishedEntry) return { status: 'filled', deviationPct };
  if (deviationPct <= tolerancePct) return { status: 'chase', deviationPct };
  return { status: 'no_fill', deviationPct };
}

module.exports = { CHASE_TOLERANCE_PCT, decideFill };
