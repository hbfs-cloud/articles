#!/usr/bin/env node
'use strict';
/**
 * dtx-pool-bridge.js — ordres dtx (DtxDecide CREATE) → pool `dtx_pool` de signals.json.
 *
 * POURQUOI (fix "0 trades depuis D0", 2026-07-16). Depuis le cut-over « le MCP fait foi »
 * (2026-07-08, v15 2026-07-13), le staging data/dtx/<id>.json alimentait UNIQUEMENT l'affichage
 * (Orders to Place + splice equity de gen-status-page). AUCUN producteur ne convertissait les
 * ordres du moteur en trades trackés : sweep.js / pit-engine.js / pit-forward.js ignoraient
 * data/dtx/ → backtest-trades.json[<mode scripté>] restait vide à jamais pendant que les replays
 * tradaient. Ce pont ferme le trou en réutilisant le chemin ÉPROUVÉ des asset-pools (crypto/forex/
 * eu_smallcap…) : les ordres CREATE deviennent des signaux source-taggés `dtx_pool`, consommés
 * EXCLUSIVEMENT par les modes scriptés (assetClass 'dtx' via ASSET_POOL_SOURCES) et partitionnés
 * par mode via `universe: <modeId>` + universeFilter. Le sweep fait ensuite TOUT le reste :
 * fills sur prix réels, exits (config du mode), append-only scellé (trade-chain), positions,
 * equity → la status page vit sans aucun nouveau moteur parallèle.
 *
 * FIDÉLITÉ (honnêteté, pas de fabrication) :
 *   - entry/stop = ceux du moteur (order.entry|limitPrice / order.stopLoss), JAMAIS inventés.
 *   - tp1 : le moteur dtx n'émet pas de take-profit (exits = trailing/rotation côté engine).
 *     Le schéma setup du sweep EXIGE un tp1 (>entry) : on dérive tp1 = entry + 2R (R = entry-stop),
 *     approximation DOCUMENTÉE du tracker — le mode gère ses vraies sorties via sa config
 *     (trailing/horizon/partialTP), comme pour tous les autres modes trackés en JS.
 *   - Un ordre sans stop exploitable (stop >= entry, ou manquant) est SKIPPÉ et loggé — jamais
 *     complété avec des niveaux inventés.
 *
 * FRAÎCHEUR : le staging DOIT être daté de la séance du scan (asof === --date). Un staging stale
 * est SKIPPÉ bruyamment (le mode n'aura simplement pas de candidats ce soir-là — dégradation
 * honnête, pas silencieuse : le résumé liste les modes skippés et l'exit code le reflète).
 *
 * Usage :
 *   node tools/dtx-pool-bridge.js --folder 20260717 --date 2026-07-17 [--dry-run] [--force]
 *
 * Exit codes : 0 = tous les stagings frais ingérés ; 3 = au moins un mode skippé (stale/manquant/
 * sans ordre valide) — NON bloquant pour le pipeline mais visible ; 2 = erreur d'usage.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STAGING_DIR = path.join(ROOT, 'data', 'dtx');
const MODES_CFG = path.join(ROOT, 'data', 'modes-config.json');

function parseArgs(argv) {
  const o = { folder: null, date: null, dryRun: false, force: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--folder') o.folder = argv[++i];
    else if (a === '--date') o.date = argv[++i];
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--force') o.force = true;
  }
  return o;
}

/** Modes scriptés = modes-config avec assetClass 'dtx' (source de vérité du câblage). */
function scriptedModes() {
  const cfg = JSON.parse(fs.readFileSync(MODES_CFG, 'utf8')).modes || {};
  return Object.keys(cfg).filter((id) => cfg[id].assetClass === 'dtx' && cfg[id].status !== 'stopped');
}

// Stratégies ROTATION (stockbox_pit, etf_us, …) : le moteur n'émet PAS de stop — la rotation EST
// l'exit. Même précédent que factor-scanner.js : disaster-stop informationnel entry×(1-25%),
// filet aval du tracker, PAS un stop de stratégie.
const DISASTER_STOP_PCT = 25;

/** Un ordre CREATE BUY du staging → un signal pool (shape scanner-parser mapSignal). */
function orderToSignal(o, modeId) {
  const ticker = String(o.symbol || '').replace(/=X$/, '');
  const entry = o.entry != null ? Number(o.entry) : (o.limitPrice != null ? Number(o.limitPrice) : null);
  let stop = o.stopLoss != null ? Number(o.stopLoss) : null;
  if (stop == null && entry > 0) stop = +(entry * (1 - DISASTER_STOP_PCT / 100)).toFixed(4);
  if (!ticker || !entry || !stop || !(entry > 0) || !(stop > 0) || stop >= entry) return null;
  // tp1 : approximation tracker 2R (le moteur n'émet pas de TP — voir en-tête). tp du moteur
  // s'il existe (takeProfit non-null) prime toujours.
  const tp1 = o.takeProfit != null && Number(o.takeProfit) > entry
    ? Number(o.takeProfit)
    : +(entry + 2 * (entry - stop)).toFixed(4);
  let score = o.score != null && !isNaN(o.score) ? Number(o.score) : null;
  if (score == null) {
    const m = /Score=(-?\d+(?:\.\d+)?)/.exec(o.reason || '');
    score = m ? Number(m[1]) : 80;
  }
  return {
    ticker,
    // strategy = reason brut du moteur : detectStrategy() du sweep en tire le tag
    // (highvol-breakout → highvol_breakout, etc.) ; le filtre 'dtx_engine' n'exclut rien.
    strategy: String(o.reason || 'dtx-engine'),
    score,
    entry: +entry.toFixed(4),
    stop: +stop.toFixed(4),
    tp1,
    tp2: null,
    rr: +((tp1 - entry) / (entry - stop)).toFixed(2),
    universe: modeId, // partition par mode (universeFilter === modeId)
    source: 'dtx_pool',
  };
}

function main() {
  const opts = parseArgs(process.argv);
  if (!opts.folder || !opts.date) {
    console.error('Usage: node tools/dtx-pool-bridge.js --folder YYYYMMDD --date YYYY-MM-DD [--dry-run] [--force]');
    process.exit(2);
  }
  const sigPath = path.join(ROOT, 'scanner', opts.folder, 'signals.json');
  if (!fs.existsSync(sigPath)) {
    console.error(`❌ ${sigPath} introuvable — le scan ${opts.folder} doit exister avant le bridge.`);
    process.exit(2);
  }

  const modes = scriptedModes();
  if (!modes.length) {
    console.log('Aucun mode scripté (assetClass dtx) dans modes-config.json — rien à faire.');
    process.exit(0);
  }

  const pool = [];
  const skipped = [];
  const ingested = [];
  for (const id of modes) {
    const p = path.join(STAGING_DIR, `${id}.json`);
    let stg;
    try { stg = JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch (_) { skipped.push(`${id} (staging manquant)`); continue; }
    const asof = String(stg.asof || '').slice(0, 10);
    if (stg.engineMode !== 'mcp') { skipped.push(`${id} (engineMode:${stg.engineMode || '—'} ≠ mcp)`); continue; }
    if (asof !== opts.date && !opts.force) { skipped.push(`${id} (staging STALE asof:${asof} ≠ ${opts.date})`); continue; }
    if (stg.metricsSuspect === true) { skipped.push(`${id} (metricsSuspect — sanity gate)`); continue; }
    const buys = (stg.orders || []).filter((o) => String(o.side || '').toUpperCase() === 'BUY');
    let kept = 0, dropped = 0;
    for (const o of buys) {
      const s = orderToSignal(o, id);
      if (s) { pool.push(s); kept++; }
      else { dropped++; console.log(`  ⚠️  [${id}] ordre skippé (niveaux inexploitables): ${o.symbol} entry:${o.entry ?? o.limitPrice ?? '—'} stop:${o.stopLoss ?? '—'}`); }
    }
    ingested.push(`${id} (${kept} ordre${kept > 1 ? 's' : ''}${dropped ? `, ${dropped} skippé(s)` : ''})`);
  }

  const data = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
  data.dtx_pool = pool; // remplacement idempotent — le pool du jour reflète LE staging du jour
  if (!opts.dryRun) fs.writeFileSync(sigPath, JSON.stringify(data, null, 2), 'utf8');

  console.log(`dtx-pool-bridge — scan ${opts.folder} (séance ${opts.date})${opts.dryRun ? ' [DRY-RUN]' : ''}`);
  console.log(`  ✅ ingérés : ${ingested.length ? ingested.join(' · ') : '—'}`);
  if (skipped.length) {
    console.log(`  ❗ SKIPPÉS (pas de candidats ce soir pour ces modes — dégradation honnête, jamais fabriquée) :`);
    for (const s of skipped) console.log(`     - ${s}`);
  }
  console.log(`  → ${pool.length} signaux dtx_pool écrits dans ${path.relative(ROOT, sigPath)}`);
  process.exit(skipped.length ? 3 : 0);
}

main();
