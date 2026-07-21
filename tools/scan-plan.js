#!/usr/bin/env node
'use strict';
/**
 * scan-plan.js — MANIFESTE des appels MCP du /scanner, groupés en VAGUES PARALLÈLES (node, ZÉRO MCP).
 *
 * Généralise `price-cache-ingest.js --list-needed` : au lieu d'émettre une seule liste de tickers, il
 * émet le PLAN COMPLET de ce que l'AGENT doit fetcher, en vagues qu'on tire chacune en UNE salve de
 * tool_use parallèles (cf `.claude/skills/perf-parallel-mcp.md`). Le but : ~100+ appels série → ~4 salves.
 *
 * Un subprocess `node` NE PEUT PAS appeler le MCP (OAuth2, ZÉRO token). Ce script ne fait donc QUE
 * planifier : il lit la config locale (date, modes dtx, univers statiques) et écrit le manifeste.
 * L'agent lit le manifeste, tire les salves, déverse chaque réponse brute dans /tmp/mcp-raw/<key>.json,
 * puis `scan-ingest-all.js` assemble les staging depuis ces bruts.
 *
 * Deux phases :
 *   node tools/scan-plan.js                 → écrit /tmp/scan-plan.json (preflight + context + universes + dtx + static_bars)
 *   node tools/scan-plan.js --resolve-bars  → lit /tmp/mcp-raw/ (réponses des screeners de la 1re phase),
 *                                             dédup les candidats, émet /tmp/scan-plan-bars.json (vague barres)
 *
 * Sortie : par défaut /tmp/scan-plan.json ; --out <f> pour surcharger ; --print pour dump stdout.
 */

const fs = require('fs');
const path = require('path');
const scan = require('./dtx-scan');

const REPO = path.resolve(__dirname, '..');
const RAW_DIR = '/tmp/mcp-raw';
const DTX_MODES = ['book_honest', 'us_highvol', 'hvep', 'stockbox_pit', 'etf_us', 'ep'];
const DTX_CCY = { book_honest: 'USD', us_highvol: 'USD', hvep: 'EUR', stockbox_pit: 'USD', etf_us: 'USD', ep: 'USD' };

function parseArgs(argv) {
  const o = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--resolve-bars') o.resolveBars = true;
    else if (a === '--out') o.out = argv[++i];
    else if (a === '--asof') o.asof = argv[++i];
    else if (a === '--folder') o.folder = argv[++i];
    else if (a === '--print') o.print = true;
    else if (a === '--lot') o.lot = parseInt(argv[++i], 10);
  }
  return o;
}

const iso = (d) => d.toISOString().slice(0, 10);
function addDays(d, n) { const x = new Date(d.getTime()); x.setUTCDate(x.getUTCDate() + n); return x; }
// dernier jour de trading ≤ ref (roule Sam/Dim → Ven)
function lastTradingDay(ref) {
  let d = new Date(ref.getTime());
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d = addDays(d, -1);
  return d;
}
// prochaine séance > ref (Ven → Lun) — convention scanner : dossier = prochaine séance
function nextTradingDay(ref) {
  let d = addDays(ref, 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d = addDays(d, 1);
  return d;
}
const folderOf = (isoDate) => isoDate.replace(/-/g, '');

// Découpe une liste en lots de taille `n` (batch QueryData multi-symboles, R3).
function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function readJsonSafe(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; }
}

// Univers statiques (FX/indices/mega-caps/métaux) — lus des fichiers locaux s'ils existent, sinon [].
// Ces symboles ne viennent PAS d'un screener → on connaît la liste à l'avance, on peut planifier leurs barres.
function staticUniverse(file, key) {
  const j = readJsonSafe(path.join(REPO, 'data', file));
  if (!j) return [];
  const arr = Array.isArray(j) ? j : (j[key] || j.tickers || j.symbols || j.universe || []);
  return arr.map((x) => (typeof x === 'string' ? x : (x.ticker || x.symbol))).filter(Boolean);
}

// ── Table des screeners de contexte (Phase 1) — DSL vérifiées, cf scanner-pipeline.md ──
// JAMAIS `market_cap` en pass_expr (→ 0 candidat silencieux) : post-filtre en code côté agent.
function contextCalls() {
  const RS = (key, pass, score, extra = {}) => ({
    key, tool: 'RunScreener',
    params: Object.assign({ pass_expr: pass, score_expr: score, region: 'us', force_async: true }, extra),
    note: 'post-filtre market_cap>=2e9 + no-ETF EN CODE (jamais en pass_expr)',
  });
  return [
    { key: 'preflight', tool: 'GetStatus', params: {}, note: 'MCP HARD STOP si down/stale>48h — jamais fabriquer' },
    RS('rs_momentum', 'rsi14 > 53 and rsi14 < 70 and macd > 0 and vol > 1500000 and close > 10', 'rsi14 + (macd > 0 ? 15 : 0)', { top_k: 40 }),
    RS('rs_pullback', 'rsi14 > 40 and rsi14 < 65 and ema20 > ema50 and atrpct < 2.5 and vol > 1500000 and close > 10', '(65 - rsi14) * 1.5 + (2.5 - atrpct) * 20', { top_k: 25 }),
    RS('rs_breakout', 'near_breakout(0.03) and vol > 1500000 and rsi14 > 52 and rsi14 < 72 and close > 10', 'rsi14 + (vol_spike45(1.5) ? 20 : 0)', { top_k: 40 }),
    RS('rs_oversold', 'rsi14 < 40 and ema50 > ema200 and vol > 1500000 and close > 10', '(40 - rsi14) * 3 + obvz * 10', { top_k: 15 }),
    { key: 'rs_eu', tool: 'RunScreener', params: { pass_expr: 'rsi14 > 45 and rsi14 < 75 and ema20 > ema50 and vol > 500000 and close > 5', score_expr: '(75 - rsi14) * 2 + obvz * 10', region: 'eu', top_k: 15 }, note: 'post-filtre market_cap>=1e9 + no-ETF' },
    { key: 'autoscreener', tool: 'RunAutoScreener', params: {}, note: 'régime-aware pool' },
    { key: 'ctx_overview', tool: 'GetMarketContext', params: { facets: 'overview' }, note: 'async — poller Jobs' },
    { key: 'ctx_regime', tool: 'GetMarketContext', params: { facets: 'regime', model: 'ensemble', horizon_days: 5 }, note: 'risk gating' },
    { key: 'economic_events', tool: 'QueryData', params: { types: 'economic_events' }, note: 'proximité CPI/Fed/jobs ±3j' },
    { key: 'earnings_cal', tool: 'GetEarningsCalendarFiltered', params: { days_ahead: 7, min_expected_move_pct: 4 }, note: 'fenêtre earnings' },
  ];
}

// ── Screeners d'univers des scanners PRE-SCORÉS (stock US/EU) — Phase 1c ──
function stagingUniverseCalls() {
  return [
    { key: 'uni_highvol', tool: 'RunScreener', params: { pass_expr: 'near_breakout(0.04) and vol > 2000000 and rsi14 > 50 and close > 10', score_expr: 'rsi14 + atrpct * 5', region: 'us', force_async: true, top_k: 60 }, forScanner: 'highvol' },
    { key: 'uni_momentum', tool: 'RunScreener', params: { pass_expr: 'rsi14 > 50 and macd > 0 and vol > 1500000 and close > 10', score_expr: 'rsi14', region: 'us', force_async: true, top_k: 60 }, forScanner: 'momentum' },
    { key: 'uni_factor', tool: 'RunScreener', params: { pass_expr: 'vol > 1500000 and close > 10', score_expr: 'vol', region: 'us', force_async: true, top_k: 120 }, forScanner: 'factor', note: 'composite 12-1/vol/maxDD calculé côté agent depuis barres 5y' },
    { key: 'uni_candlestick', tool: 'RunScreener', params: { pass_expr: 'vol > 1000000 and close > 5', score_expr: 'vol', region: 'us', force_async: true, top_k: 200 }, forScanner: 'candlestick', note: 'univers large — patterns chandeliers détectés côté scanner depuis barres' },
    { key: 'uni_etf_us', tool: 'RunScreener', params: { pass_expr: 'vol > 500000', score_expr: 'vol', region: 'us', asset: 'etf', force_async: true, top_k: 60 }, forScanner: 'etf' },
    { key: 'uni_etf_eu', tool: 'RunScreener', params: { pass_expr: 'vol > 200000', score_expr: 'vol', region: 'eu', asset: 'etf', force_async: true, top_k: 60 }, forScanner: 'etf-eu' },
  ];
}

// ── Vague dtx : 6 modes × {replay, decide, drift} — params exacts via dtx-scan.goLiveFor ──
function dtxCalls(asof) {
  const out = [];
  for (const id of DTX_MODES) {
    const to = scan.goLiveFor(id) || asof;               // splice backtest↔live
    const toDate = String(to).slice(0, 10);
    const ccy = DTX_CCY[id] || 'USD';
    out.push({ key: `dtx_${id}_replay`, tool: 'DtxReplay', params: { portfolio: id, from: scan.DEFAULT_FROM, to: toDate }, mode: id, kind: 'replay', note: 'async → DtxJobStatus' });
    out.push({ key: `dtx_${id}_decide`, tool: 'DtxDecide', params: { portfolio: id, asof, balances: { base_currency: ccy, cash_by_currency: { [ccy]: 100000 }, total_equity: 100000 }, positions: [], orders: [] }, mode: id, kind: 'decide', note: 'async → DtxJobStatus' });
    out.push({ key: `dtx_${id}_drift`, tool: 'DtxReplay', params: { portfolio: id, from: scan.DEFAULT_FROM, to: asof }, mode: id, kind: 'drift', note: 'drift backtest↔live : replay jusqu\'à J+1' });
  }
  return out;
}

// ── Vague barres statiques : univers connus (FX/indices/mega-caps/métaux) → lots multi-symboles ──
function staticBarsCalls(lot) {
  const specs = [
    { scanner: 'forex', file: 'forex-universe.json', extra: { interval: '1d' } },
    { scanner: 'trendline-indices', file: 'indices-universe.json', extra: { interval: '4h' } },
    { scanner: 'hybrid', file: 'hybrid-universe.json', extra: { interval: '1d' } },
    { scanner: 'metals', file: 'metals-universe.json', extra: { interval: '1d' } },
  ];
  const out = [];
  for (const s of specs) {
    const syms = staticUniverse(s.file, 'tickers');
    if (!syms.length) { out.push({ scanner: s.scanner, skipped: true, note: `univers ${s.file} absent/vide — l'agent fournit la liste ou skip fail-closed` }); continue; }
    chunk(syms, lot).forEach((lotSyms, i) => out.push({
      key: `bars_${s.scanner}_${String(i).padStart(2, '0')}`, tool: 'QueryData',
      params: Object.assign({ types: 'bars_daily', symbols: lotSyms.join(','), days: 400 }, s.extra),
      scanner: s.scanner, symbols: lotSyms,
      note: 'POSITIONNEL : {symbols:[…ordre exact…], result:<brut>} — data.length===symbols.length',
    }));
  }
  return out;
}

function buildPlan(opts) {
  const now = new Date();
  const asof = opts.asof || iso(nextTradingDay(lastTradingDay(now)));
  const lastTrade = iso(lastTradingDay(now));
  const folder = opts.folder || folderOf(asof);
  const lot = opts.lot || 15;
  return {
    generatedAt: iso(now),
    scanDate: asof, folder, lastTradingDay: lastTrade,
    rawDir: RAW_DIR,
    doctrine: 'perf-parallel-mcp — R2: chaque `wave` = UN message, tous les appels en parallèle. R3: bars batchés multi-symboles.',
    waves: {
      // SALVE 1 : preflight + tout le contexte + tous les univers de screening (aucune dépendance entre eux)
      wave1_context_universes: [...contextCalls(), ...stagingUniverseCalls()],
      // SALVE dtx : 6 modes × 3 (indépendants) — lancer tous les jobs puis poller (R4)
      wave_dtx: dtxCalls(asof),
      // SALVE 2a : barres des univers STATIQUES (connus d'avance) — batchées
      wave2_static_bars: staticBarsCalls(lot),
      // SALVE 2b : barres des candidats issus des screeners → résolue par `--resolve-bars` APRÈS wave1
      wave2_dynamic_bars: { deferred: true, how: 'node tools/scan-plan.js --resolve-bars (lit /tmp/mcp-raw/ des screeners, dédup, émet /tmp/scan-plan-bars.json)' },
    },
    nextSteps: [
      '1. Tirer wave1_context_universes en UNE salve (message unique, tool_use //). Dumper chaque réponse → /tmp/mcp-raw/<key>.json',
      '2. Tirer wave_dtx : lancer les 18 jobs, PUIS poller DtxJobStatus. Dumper → /tmp/mcp-raw/<key>.json',
      '3. node tools/scan-plan.js --resolve-bars → /tmp/scan-plan-bars.json ; tirer wave2 (static+dynamic) en salves //',
      '4. node tools/scan-ingest-all.js → assemble tous les /tmp/*-stage.json + ingest dtx',
      '5. publish-daily-card.sh en BACKGROUND ; Skill(signals-desk) avec handoff ; rapport final',
    ],
  };
}

// Phase 2 : lire les screeners bruts de wave1, extraire+dédupliquer les candidats, émettre les lots de barres.
function extractTickers(raw) {
  // Tolère plusieurs formes : {results:[{symbol|ticker}]}, {data:{items:[{results:[…]}]}}, screener_results…
  if (!raw) return [];
  const buckets = [];
  const dig = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(dig); return; }
    if (o.symbol || o.ticker) buckets.push(o.symbol || o.ticker);
    for (const k of ['results', 'items', 'screener_results', 'data', 'candidates']) if (o[k]) dig(o[k]);
  };
  dig(raw);
  return buckets;
}

function resolveBars(opts) {
  const plan = readJsonSafe(opts.plan || '/tmp/scan-plan.json') || buildPlan(opts);
  const lot = opts.lot || 15;
  const screenerKeys = [...contextCalls(), ...stagingUniverseCalls()].filter((c) => /RunScreener|RunAutoScreener/.test(c.tool)).map((c) => c.key);
  const seen = new Set();
  const perScanner = {};
  for (const key of screenerKeys) {
    const raw = readJsonSafe(path.join(RAW_DIR, `${key}.json`));
    const tickers = extractTickers(raw);
    const scannerKey = key.replace(/^(uni_|rs_)/, '');
    perScanner[scannerKey] = perScanner[scannerKey] || [];
    for (const t of tickers) { perScanner[scannerKey].push(t); seen.add(t); }
  }
  // + tickers du price-cache (pending trades + positions + setups) via le lister existant si présent
  const allSyms = [...seen];
  const lots = chunk(allSyms, lot).map((lotSyms, i) => ({
    key: `bars_dyn_${String(i).padStart(2, '0')}`, tool: 'QueryData',
    params: { types: 'bars_daily', symbols: lotSyms.join(','), days: 400 }, symbols: lotSyms,
    note: 'POSITIONNEL — dédupé cross-scanner (un symbole = un fetch)',
  }));
  return {
    generatedAt: iso(new Date()),
    uniqueTickers: allSyms.length,
    perScanner: Object.fromEntries(Object.entries(perScanner).map(([k, v]) => [k, [...new Set(v)]])),
    wave2_dynamic_bars: lots,
    note: 'Tirer ces lots en salves //. Puis node tools/scan-ingest-all.js. Chaque scanner lit SES tickers dans perScanner[<scanner>].',
  };
}

function main() {
  const opts = parseArgs(process.argv);
  const result = opts.resolveBars ? resolveBars(opts) : buildPlan(opts);
  const outPath = opts.out || (opts.resolveBars ? '/tmp/scan-plan-bars.json' : '/tmp/scan-plan.json');
  if (opts.print) { console.log(JSON.stringify(result, null, 2)); return result; }
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
  const w = result.waves;
  if (w) {
    const n1 = w.wave1_context_universes.length, nd = w.wave_dtx.length, ns = w.wave2_static_bars.filter((x) => x.key).length;
    console.log(`📋 scan-plan → ${outPath}`);
    console.log(`   scanDate=${result.scanDate} folder=${result.folder} lastTrading=${result.lastTradingDay}`);
    console.log(`   SALVE 1 (context+univers): ${n1} appels // · SALVE dtx: ${nd} jobs // · SALVE 2a (bars statiques): ${ns} lots //`);
    console.log(`   → tirer chaque salve en UN message (tool_use parallèles), bruts → ${RAW_DIR}/<key>.json`);
    console.log(`   → puis: node tools/scan-plan.js --resolve-bars ; node tools/scan-ingest-all.js`);
  } else {
    console.log(`📋 scan-plan bars → ${outPath} · ${result.uniqueTickers} tickers uniques · ${result.wave2_dynamic_bars.length} lots //`);
  }
  return result;
}

if (require.main === module) main();
module.exports = { buildPlan, resolveBars, contextCalls, stagingUniverseCalls, dtxCalls, chunk, extractTickers };
