'use strict';
/**
 * dtx-engine-history.js — magasin APPEND-ONLY de ce que le moteur systematic dit chaque jour.
 *
 * POURQUOI. `data/dtx/<mode>.json` est un INSTANTANÉ : chaque ingestion l'écrase. Les ordres
 * émis par le moteur hier sont donc définitivement perdus, et la Time Machine ne peut rien
 * remonter. `dtx-live-track.json` historise bien une série quotidienne, mais seulement des
 * AGRÉGATS (ret, unrealized, trades, ordersPublished) — jamais les ordres eux-mêmes.
 *
 * CE QU'ON STOCKE : par (mode, date d'as-of), la décision du moteur telle qu'elle a été reçue —
 * orders / updates / cancels + metrics + engineMode. C'est un registre de PROVENANCE, pas un
 * calcul : on n'y dérive rien, on n'y corrige rien.
 *
 * IMMUABILITÉ. Un couple (mode, date) déjà écrit n'est JAMAIS réécrit. Une seconde ingestion
 * pour la même séance est REFUSÉE et signalée, jamais absorbée en silence — sans quoi un rejeu
 * de rétrospective viendrait réécrire l'histoire, exactement ce que la règle Immutable Trades
 * interdit pour les trades scellés. `--force` existe pour les réparations, et il journalise.
 *
 * POINT-IN-TIME. `at(mode, date)` ne rend QUE ce qui était connu à cette date : la décision
 * porte l'as-of du moteur, pas la date de génération. Aucun accès à une séance postérieure.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const STORE_PATH = path.join(ROOT, 'data', 'dtx-engine-history.json');
const VERSION = 'v1-20260807';

function emptyStore() {
  return {
    _comment:
      "Registre append-only de la decision du moteur systematic par (mode, date d'as-of) : " +
      'orders/updates/cancels + metrics, tels que recus. Immuable par couple (mode,date) — une ' +
      'seconde ecriture pour la meme seance est refusee. Ecrit par tools/dtx-history-append.js ' +
      'apres dtx-mcp-ingest. Lu par gen-status-page (Time Machine) et l API.',
    _version: VERSION,
    modes: {},
    _updated: null,
  };
}

function load() {
  if (!fs.existsSync(STORE_PATH)) return emptyStore();
  try {
    const d = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    if (!d || typeof d !== 'object' || !d.modes) return emptyStore();
    return d;
  } catch (e) {
    // Jamais de repli silencieux sur un magasin vide : ce serait perdre l'historique sans le dire.
    throw new Error(`dtx-engine-history illisible (${STORE_PATH}) : ${e.message}`);
  }
}

function save(store) {
  store._updated = new Date().toISOString();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2) + '\n');
}

/** Normalise un ordre du staging → forme stable, sans rien inventer. */
function normalizeOrder(o) {
  if (!o || typeof o !== 'object') return null;
  return {
    symbol: o.symbol || null,
    side: o.side || null,
    orderType: o.orderType || o.order_type || null,
    qty: o.qty != null ? Number(o.qty) : null,
    entry: o.entry != null ? Number(o.entry) : null,
    limitPrice: o.limitPrice != null ? Number(o.limitPrice) : null,
    stopLoss: o.stopLoss != null ? Number(o.stopLoss) : null,
    takeProfit: o.takeProfit != null ? Number(o.takeProfit) : null,
    reason: o.reason || null,
    orderId: o.orderId || null,
    // POCHE du livre (lue dans DtxDecide.state par dtx-scan.js). Elle porte les SORTIES de la
    // ligne — take-profit et horizon diffèrent d'une poche à l'autre — donc un registre
    // point-in-time qui l'omet ne permet plus de dire, après coup, sous quelle règle un ordre
    // devait sortir. Ce mappeur est une liste blanche : un champ non listé est perdu en silence.
    sleeve: o.sleeve || null,
  };
}

/**
 * Ajoute la décision d'une séance. Rend {status, mode, date, counts}.
 * status : 'appended' | 'duplicate' | 'forced' | 'skipped'
 */
function append(staging, opts = {}) {
  const store = opts.store || load();
  const mode = staging && (staging.mode || staging.portfolioId);
  const date = staging && staging.asof;
  if (!mode || !date) return { status: 'skipped', reason: 'staging sans mode ou sans asof' };

  store.modes[mode] = store.modes[mode] || {};
  const existing = store.modes[mode][date];

  const entry = {
    asof: date,
    generatedAt: staging.generatedAt || null,
    engineMode: staging.engineMode || null,
    provenance: staging._provenance || 'staging',
    engine: staging.engine || null,
    currency: staging.currency || null,
    orders: (staging.orders || []).map(normalizeOrder).filter(Boolean),
    updates: (staging.updates || []).map(normalizeOrder).filter(Boolean),
    cancels: (staging.cancels || []).map(normalizeOrder).filter(Boolean),
    metrics: staging.metrics || null,
    recordedAt: new Date().toISOString(),
  };
  const counts = { orders: entry.orders.length, updates: entry.updates.length, cancels: entry.cancels.length };

  // Une entree issue du STAGING fait foi et remplace une entree backfillee (forme pontee,
  // moins riche). L'inverse est interdit, et deux stagings pour la meme seance aussi.
  const upgrading = existing && existing.provenance === 'dtx_pool' && entry.provenance === 'staging';
  if (existing && !opts.force && !upgrading) {
    return { status: 'duplicate', mode, date, counts, existingCounts: {
      orders: (existing.orders || []).length,
      updates: (existing.updates || []).length,
      cancels: (existing.cancels || []).length,
    } };
  }
  if (existing && opts.force) {
    entry._forcedOver = { recordedAt: existing.recordedAt, orders: (existing.orders || []).length };
  }
  store.modes[mode][date] = entry;
  if (!opts.store) save(store);
  return { status: existing ? (upgrading ? 'upgraded' : 'forced') : 'appended', mode, date, counts };
}

/** Ce que le moteur disait à cette date, ou null. Aucun accès à une séance postérieure. */
function at(mode, date, store) {
  const s = store || load();
  return (s.modes[mode] && s.modes[mode][date]) || null;
}

/** Dernière séance connue À OU AVANT `date` — la lecture point-in-time correcte. */
function asOf(mode, date, store) {
  const s = store || load();
  const byDate = s.modes[mode] || {};
  const keys = Object.keys(byDate).filter(d => d <= date).sort();
  return keys.length ? byDate[keys[keys.length - 1]] : null;
}

/** Toutes les dates connues pour un mode, croissantes. */
function datesFor(mode, store) {
  const s = store || load();
  return Object.keys(s.modes[mode] || {}).sort();
}

function modes(store) {
  return Object.keys((store || load()).modes).sort();
}

module.exports = { load, save, append, at, asOf, datesFor, modes, STORE_PATH, VERSION };
