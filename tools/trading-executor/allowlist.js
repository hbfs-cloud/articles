'use strict';
/**
 * allowlist.js — porte d'entrée UNIQUE de l'autorisation d'exécution courtier.
 *
 * POURQUOI (R3+R4, 2026-08-12). L'exécuteur avait trois entrées et UNE seule consultait une
 * autorisation :
 *   · run-session.js lisait tools/trading-executor/config.json (gitignoré, donc invérifiable) ;
 *   · daemon.js prenait son mode dans process.env.MODE et ne consultait RIEN — `MODE=best
 *     BROKER=alpaca node daemon.js` générait le plan et l'exécutait chez le courtier ;
 *   · index.js prenait un --plan déjà écrit, sans rien vérifier non plus.
 * Une protection qui ne couvre qu'une porte sur trois n'est pas une protection. Ce module est
 * appelé par les trois, lit un fichier VERSIONNÉ (data/executor-allowlist.json) et refuse par
 * défaut : mode absent = refusé, paire mode/courtier absente = refusée.
 *
 * Le refus est TERMINAL (exit 1). Il n'existe volontairement aucun mode dégradé « on continue en
 * paper » : basculer silencieusement de courtier est exactement le genre de repêchage qui fait
 * passer une erreur d'invocation pour un fonctionnement normal.
 *
 * Contournement : aucun par variable d'environnement. Autoriser un mode ⇒ éditer le JSON versionné
 * et le faire relire — c'est le point du chantier.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const ALLOWLIST_PATH = path.join(ROOT, 'data', 'executor-allowlist.json');

/** Lit la liste blanche. Un fichier absent/illisible est un REFUS GLOBAL, jamais un laissez-passer. */
function loadAllowlist() {
  try {
    const raw = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
    if (!raw || typeof raw.modes !== 'object' || raw.modes === null) {
      return { ok: false, error: `${path.relative(ROOT, ALLOWLIST_PATH)} n'a pas de bloc "modes"`, modes: {} };
    }
    return { ok: true, modes: raw.modes, version: raw.version ?? null };
  } catch (err) {
    return { ok: false, error: `${path.relative(ROOT, ALLOWLIST_PATH)} illisible: ${err.message}`, modes: {} };
  }
}

/**
 * Vérifie une paire mode/courtier.
 * @returns {{allowed: boolean, reason: string, maxNotionalUsd: number|null, maxPositions: number|null}}
 */
function checkMode(mode, broker) {
  const deny = (reason) => ({ allowed: false, reason, maxNotionalUsd: null, maxPositions: null });

  const al = loadAllowlist();
  if (!al.ok) return deny(`liste blanche indisponible — ${al.error}`);
  if (!mode) return deny('aucun mode fourni');
  if (!broker) return deny(`aucun courtier fourni pour le mode "${mode}"`);

  const entry = al.modes[mode];
  if (!entry) return deny(`mode "${mode}" absent de la liste blanche (politique: refus par défaut)`);
  if (entry.allow !== true) return deny(`mode "${mode}" explicitement refusé — ${entry.reason || 'aucune raison consignée'}`);

  const brokers = Array.isArray(entry.brokers) ? entry.brokers : [];
  if (!brokers.includes(broker)) {
    return deny(`mode "${mode}" non autorisé chez "${broker}" (autorisés: ${brokers.length ? brokers.join(', ') : 'aucun'})`);
  }

  return {
    allowed: true,
    reason: entry.reason || '',
    maxNotionalUsd: Number.isFinite(entry.maxNotionalUsd) ? entry.maxNotionalUsd : null,
    maxPositions: Number.isFinite(entry.maxPositions) ? entry.maxPositions : null,
  };
}

/**
 * Même vérification, mais TERMINALE : journalise et sort en 1 si refusé.
 * `entryPoint` nomme la porte pour que le journal dise QUELLE invocation a été arrêtée.
 */
function assertAllowed(mode, broker, entryPoint) {
  const v = checkMode(mode, broker);
  if (!v.allowed) {
    console.error(`⛔ [${entryPoint}] exécution REFUSÉE — ${mode || '?'}/${broker || '?'} : ${v.reason}`);
    console.error(`   Autorisation: data/executor-allowlist.json (versionné). Aucun contournement par variable d'environnement.`);
    process.exit(1);
  }
  return v;
}

/**
 * Reporte les plafonds de la liste blanche sur le plan, pour que le garde de capacité de engine.js
 * les applique. Les plafonds sont des MINIMA de prudence : ils ne relèvent jamais ce que le plan
 * porte déjà, ils ne font que l'abaisser.
 */
function applyCaps(plan, verdict) {
  if (!plan || !plan.account || !verdict) return plan;
  if (verdict.maxNotionalUsd != null) {
    const cur = Number(plan.account.nominal_usd);
    plan.account.nominal_usd = Number.isFinite(cur) ? Math.min(cur, verdict.maxNotionalUsd) : verdict.maxNotionalUsd;
    plan.account.max_notional_usd = verdict.maxNotionalUsd;
  }
  if (verdict.maxPositions != null) {
    const cur = Number(plan.account.max_positions);
    plan.account.max_positions = Number.isFinite(cur) ? Math.min(cur, verdict.maxPositions) : verdict.maxPositions;
  }
  return plan;
}

module.exports = { loadAllowlist, checkMode, assertAllowed, applyCaps, ALLOWLIST_PATH };
