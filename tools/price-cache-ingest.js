#!/usr/bin/env node
'use strict';
/**
 * price-cache-ingest.js — prix OHLCV via MCP marketdata → cache daté du sweep (MCP-PRIMARY).
 *
 * DÉCRET « le MCP fait foi » (2026-07-12) appliqué aux PRIX DU SWEEP (2026-07-17). Il n'y a PAS
 * de Yahoo dans l'architecture : le fallback réseau historique de sweep.js (query1.finance.yahoo)
 * est mort dans l'environnement cloud (« Fetched prices for 0/937 » — y compris dans les runs
 * committés de la routine), ce qui gelait l'append de trades de TOUS les modes. Comme pour les
 * scanners (--ingest) et le staging dtx : un subprocess `node` ne peut PAS appeler le MCP
 * (OAuth2, ZÉRO token en .env) → c'est l'AGENT qui stage les bars, PUIS ce script les écrit dans
 * le cache daté (`data/.price-cache/<date>/1d/<market>/<ticker>.json`) que `sweep.js
 * loadCachedPrice()` lit AVANT tout fetch réseau. Zéro modification du simulateur.
 *
 * Chaîne : agent → QueryData(types=bars_daily, symbols=..., days=N) (poll Jobs si async)
 *        → écrit chaque réponse brute + la liste symbols dans un fichier de staging
 *        → node tools/price-cache-ingest.js --stage <f1> [<f2> ...] [--date YYYY-MM-DD]
 *        → cache daté → node tools/sweep.js (cache-first, aucun réseau nécessaire).
 *
 * Format de staging accepté (souple, par fichier) :
 *   { "symbols": ["AAPL","MSFT", ...],   ← OBLIGATOIRE : l'ordre DOIT être celui du paramètre
 *     "result": <sortie brute QueryData OU Jobs> }   symbols de l'appel (la réponse bars_daily
 *   est POSITIONNELLE — les objets {bars,span} n'embarquent pas le ticker).
 *   Le script déplie result.data.items[0].results[*].data (Jobs) ou result.results[*].data
 *   (sync) et associe data[i] ↔ symbols[i]. bars = [[date,o,h,l,c,v], ...].
 *
 * `--list-needed [--since YYYY-MM-DD]` : imprime la liste des tickers dont le sweep a besoin
 * (trades pending + positions ouvertes + setups des scans depuis `since`, défaut 21 jours,
 * tous pools inclus donc dtx_pool) — c'est la liste que l'agent doit passer à QueryData.
 */

const fs = require('fs');
const path = require('path');
const priceCacheLib = require('./lib/price-cache');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const o = { stage: [], date: null, listNeeded: false, since: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--stage') { while (argv[i + 1] && !argv[i + 1].startsWith('--')) o.stage.push(argv[++i]); }
    else if (a === '--date') o.date = argv[++i];
    else if (a === '--list-needed') o.listNeeded = true;
    else if (a === '--since') o.since = argv[++i];
  }
  return o;
}

// ── --list-needed ───────────────────────────────────────────────────────────
function listNeeded(sinceISO) {
  const tickers = new Set();
  // 1. Trades pending (re-simulés à chaque sweep) + positions ouvertes (MtM).
  try {
    const trades = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'backtest-trades.json'), 'utf8'));
    for (const arr of Object.values(trades)) {
      for (const t of arr || []) if (t.status === 'pending' && t.ticker) tickers.add(t.ticker);
    }
  } catch (_) {}
  try {
    const pos = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'scanner-positions.json'), 'utf8'));
    for (const p of pos.open_positions || []) if (p.ticker || p.symbol) tickers.add(p.ticker || p.symbol);
  } catch (_) {}
  // 2. Setups des scans récents (tous pools, dtx_pool inclus) — le chemin append-only frozen
  //    ne simule que les scans postérieurs au dernier trade de chaque mode, donc ~3 semaines
  //    couvrent largement (le plus ancien pending re-simulé fixe la borne réelle).
  const scannerParser = require('./lib/scanner-parser');
  const dirs = fs.readdirSync(path.join(ROOT, 'scanner')).filter((d) => /^\d{8}$/.test(d)).sort();
  for (const d of dirs) {
    const iso = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    if (iso < sinceISO) continue;
    let loaded;
    try { loaded = scannerParser.loadSignals(d); } catch (_) { continue; }
    if (!loaded) continue;
    const pools = ['signals', 'tklPool', 'cryptoPool', 'metalsPool', 'forexPool', 'casablancaPool',
      'euSmallcapPool', 'factorPool', 'peadPool', 'filingsPool', 'gapPool', 'dtxPool', 'fortressPool'];
    for (const k of pools) for (const s of loaded[k] || []) if (s.ticker) tickers.add(s.ticker);
  }
  return [...tickers].sort();
}

// ── --stage ingestion ───────────────────────────────────────────────────────
/** Déplie une sortie QueryData (sync) ou Jobs (async) vers la liste results[]. */
function extractResults(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (Array.isArray(raw.results)) return raw.results;                      // sync
  const items = raw.data && raw.data.items;
  if (Array.isArray(items) && items[0] && Array.isArray(items[0].results)) return items[0].results; // Jobs
  return null;
}

function ingestStageFile(fp, dateISO, summary) {
  const stage = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const symbols = stage.symbols;
  if (!Array.isArray(symbols) || !symbols.length) throw new Error(`${fp}: champ "symbols" manquant/vide`);
  const results = extractResults(stage.result);
  if (!results) throw new Error(`${fp}: sortie QueryData/Jobs non reconnue`);
  const barsResult = results.find((r) => r.data_type === 'bars_daily');
  if (!barsResult || !Array.isArray(barsResult.data)) throw new Error(`${fp}: pas de résultat bars_daily`);
  const data = barsResult.data;
  if (data.length !== symbols.length) {
    throw new Error(`${fp}: ${data.length} blocs bars pour ${symbols.length} symbols — mapping positionnel impossible, staging refusé (jamais deviner)`);
  }
  for (let i = 0; i < symbols.length; i++) {
    const ticker = symbols[i];
    const bars = (data[i] && data[i].bars) || [];
    if (!bars.length) { summary.empty.push(ticker); continue; }
    const canonical = bars.map((b) => ({
      date: String(b[0]).slice(0, 10),
      open: +b[1], high: +b[2], low: +b[3], close: +b[4], volume: +b[5],
    })).filter((b) => b.open > 0 && b.high > 0 && b.low > 0 && b.close > 0);
    if (!canonical.length) { summary.empty.push(ticker); continue; }
    const market = /-USD$/.test(ticker) ? priceCacheLib.MARKETS.CRYPTO : priceCacheLib.MARKETS.US;
    const n = priceCacheLib.writeBars(ticker, canonical, { date: dateISO, market });
    summary.written.push(`${ticker}:${n}`);
  }
}

function main() {
  const opts = parseArgs(process.argv);
  if (opts.listNeeded) {
    const since = opts.since || (() => {
      const d = new Date(); d.setDate(d.getDate() - 21);
      return d.toISOString().slice(0, 10);
    })();
    const list = listNeeded(since);
    console.error(`# ${list.length} tickers nécessaires (pending + positions + setups depuis ${since})`);
    console.log(list.join(','));
    return;
  }
  if (!opts.stage.length) {
    console.error('Usage: node tools/price-cache-ingest.js --stage <f1> [<f2> ...] [--date YYYY-MM-DD]');
    console.error('       node tools/price-cache-ingest.js --list-needed [--since YYYY-MM-DD]');
    process.exit(2);
  }
  const dateISO = opts.date || priceCacheLib.todayISO();
  const summary = { written: [], empty: [] };
  let failed = 0;
  for (const fp of opts.stage) {
    try { ingestStageFile(fp, dateISO, summary); }
    catch (e) { failed++; console.error(`❌ ${fp}: ${e.message}`); }
  }
  console.log(`price-cache-ingest — cache daté ${dateISO}`);
  console.log(`  ✅ ${summary.written.length} tickers écrits`);
  if (summary.empty.length) console.log(`  ⚠️  ${summary.empty.length} sans bars (délistés/illiquides ?): ${summary.empty.slice(0, 20).join(', ')}${summary.empty.length > 20 ? '…' : ''}`);
  if (failed) { console.error(`  ❌ ${failed} fichier(s) de staging refusé(s)`); process.exit(3); }
}

main();
