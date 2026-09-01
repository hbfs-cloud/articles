#!/usr/bin/env node
'use strict';
/**
 * scan-plan.js — LEGACY DISABLED. Helpers retained only for contract regression tests.
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
 * This CLI is intentionally fail-closed: its downstream positional ingester did
 * not validate QueryData terminal cells or completed-bar proofs. Use the audited
 * plans through tools/collect.js / tools/scan-parallel.sh instead.
 */

const fs = require('fs');
const path = require('path');
const scan = require('./dtx-scan');
const {
  isUSTradingDay,
  latestCompletedUSClose,
  nextUSTradingDay,
} = require('./lib/market-calendar');
const { MIN_MARKETDATA_BUILD } = require('./lib/marketdata-bars-contract');

const REPO = path.resolve(__dirname, '..');
const RAW_DIR = '/tmp/mcp-raw';
const DTX_MODES = scan.SCRIPTED_MODES;
const DTX_CCY = { best: 'USD' };
const LEGACY_DISABLED_REASON = 'legacy scan-plan/scan-ingest-all pipeline disabled: use audited collect.js workflow plans with per-cell Marketdata validation';

function parseArgs(argv) {
  const o = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--resolve-bars') o.resolveBars = true;
    else if (a === '--out') o.out = argv[++i];
    else if (a === '--plan') o.plan = argv[++i];
    else if (a === '--asof') o.asof = argv[++i];
    else if (a === '--refdate') o.refdate = argv[++i];
    else if (a === '--as-of-timestamp') o.asOfTimestamp = argv[++i];
    else if (a === '--folder') o.folder = argv[++i];
    else if (a === '--print') o.print = true;
    else if (a === '--lot') o.lot = parseInt(argv[++i], 10);
  }
  return o;
}

const folderOf = (isoDate) => isoDate.replace(/-/g, '');
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * The manual planner is a live scanner entry point, not a historical date
 * calculator. It therefore requires the caller to bind the run to one explicit
 * collection timestamp and one already-completed US close. Deriving the close
 * from "today" before 16:00 New York used to select the still-open session and
 * silently skip the public J+1 folder.
 */
function resolvePlanContext(opts = {}, { enforceCurrentTimestamp = true } = {}) {
  const referenceClose = String(opts.refdate || opts.referenceClose || '');
  if (!ISO_DATE_RE.test(referenceClose)) {
    throw new Error('--refdate YYYY-MM-DD is required and must identify the certified completed US close');
  }
  if (!isUSTradingDay(referenceClose)) {
    throw new Error(`--refdate ${referenceClose} is not a US exchange session`);
  }

  const rawTimestamp = opts.asOfTimestamp || opts.as_of_timestamp;
  if (!rawTimestamp) throw new Error('--as-of-timestamp ISO is required; implicit Date.now() is forbidden');
  if (!ISO_TIMESTAMP_RE.test(String(rawTimestamp))) {
    throw new Error('--as-of-timestamp must include an explicit time and UTC offset');
  }
  const asOf = new Date(rawTimestamp);
  if (!Number.isFinite(asOf.getTime())) throw new Error(`--as-of-timestamp is invalid: ${rawTimestamp}`);
  const asOfTimestamp = asOf.toISOString();

  const wallNow = opts.now instanceof Date ? opts.now : new Date();
  if (enforceCurrentTimestamp && Math.abs(wallNow.getTime() - asOf.getTime()) > 15 * 60 * 1000) {
    throw new Error('--as-of-timestamp must be within 15 minutes of the current run');
  }

  const completedAtTimestamp = latestCompletedUSClose(asOf);
  if (referenceClose !== completedAtTimestamp) {
    throw new Error(
      `--refdate ${referenceClose} is not the latest completed US close at ${asOfTimestamp} (expected ${completedAtTimestamp})`,
    );
  }

  const scanSession = String(opts.asof || opts.scanDate || nextUSTradingDay(referenceClose));
  const expectedScanSession = nextUSTradingDay(referenceClose);
  if (scanSession !== expectedScanSession) {
    throw new Error(`--asof ${scanSession} must equal the next US session after ${referenceClose} (${expectedScanSession})`);
  }
  const folder = String(opts.folder || folderOf(scanSession));
  if (folder !== folderOf(scanSession)) {
    throw new Error(`--folder ${folder} does not match scanner session ${scanSession}`);
  }
  return { referenceClose, scanSession, folder, asOfTimestamp };
}

function barsFreshness(referenceClose) {
  return {
    max_age_h: 24,
    required: true,
    expects_close: true,
    asset_calendar: 'us_equity_exchange_sessions',
    expected_completed_end: referenceClose,
  };
}

function barsQueryParams(symbols, asOfTimestamp, extra = {}) {
  const allowedExtra = new Set(['interval']);
  const unsupported = Object.keys(extra).filter(key => !allowedExtra.has(key));
  if (unsupported.length) {
    throw new Error(`unsupported bars_daily override(s): ${unsupported.join(', ')}; contract fields are immutable`);
  }
  return {
    ...extra,
    types: 'bars_daily',
    symbols: Array.isArray(symbols) ? symbols.join(',') : String(symbols || ''),
    as_of_timestamp: asOfTimestamp,
    completion_policy: 'completed_only',
    limit: 400,
  };
}

function barsCall({ key, symbols, scanner, referenceClose, asOfTimestamp, extra = {}, note = '' }) {
  return {
    key,
    tool: 'QueryData',
    params: barsQueryParams(symbols, asOfTimestamp, extra),
    scanner,
    symbols: Array.isArray(symbols) ? symbols : String(symbols || '').split(',').filter(Boolean),
    freshness: barsFreshness(referenceClose),
    contract: {
      minimum_build: MIN_MARKETDATA_BUILD,
      completion_policy: 'completed_only',
      asset_calendar: 'us_equity_exchange_sessions',
      expected_completed_end: referenceClose,
      terminal_cell_per_symbol: true,
    },
    note: `${note}${note ? ' · ' : ''}fail-closed sur toute cellule incomplète ; cellules saines conservées dans le brut`,
  };
}

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
function contextCalls(referenceClose = null) {
  const RS = (key, pass, score, extra = {}) => ({
    key, tool: 'RunScreener',
    params: Object.assign({ pass_expr: pass, score_expr: score, region: 'us', force_async: true }, extra),
    note: 'post-filtre market_cap>=2e9 + no-ETF EN CODE (jamais en pass_expr)',
  });
  // DSL VÉRIFIÉE (run live 2026-07-22) — variables valides seulement : rsi14/ema20/ema50/ema200/atrpct/vol/
  // close/obvz/vwap/bbw/hhv*/llv*/sma*. PAS de `macd` (n'existe pas → screener KO). JAMAIS `market_cap` en
  // pass_expr (→0, killer silencieux) : post-filtrer mcap/ETF/penny EN CODE. top_k modéré = borne le contexte.
  return [
    {
      key: 'preflight', tool: 'GetStatus', params: {}, gate: true,
      assert: referenceClose ? {
        minimum_build: MIN_MARKETDATA_BUILD,
        operation_readiness: 'bars_daily_us_equity',
        asset_calendar: 'us_equity_exchange_sessions',
        expected_completed_end: referenceClose,
      } : null,
      note: referenceClose
        ? `MCP HARD STOP sauf build ${MIN_MARKETDATA_BUILD} + bars_daily_us_equity ready à la clôture ${referenceClose}`
        : 'MCP HARD STOP : une clôture de référence explicite manque',
    },
    RS('rs_momentum', 'rsi14 > 50 and rsi14 < 72 and ema20 > ema50 and ema50 > ema200 and vol > 1500000 and close > 10', 'rsi14', { top_k: 25 }),
    RS('rs_pullback', 'rsi14 > 42 and rsi14 < 60 and ema20 > ema50 and close > ema50 and atrpct < 3 and vol > 1000000 and close > 10', '60 - rsi14', { top_k: 25 }),
    RS('rs_breakout', 'near_breakout(0.03) and rsi14 > 52 and rsi14 < 72 and vol > 1500000 and close > 10', 'rsi14', { top_k: 25 }),
    RS('rs_presqueeze', 'near_breakout(0.05) and rsi14 > 45 and rsi14 < 65 and vol > 800000 and close > 10', 'rsi14', { top_k: 20 }),
    { key: 'autoscreener', tool: 'RunAutoScreener', params: {}, note: 'régime-aware pool' },
    { key: 'ctx_overview', tool: 'GetMarketContext', params: { facets: 'overview' }, note: 'async — poller Jobs' },
    { key: 'ctx_regime', tool: 'GetMarketContext', params: { facets: 'regime', model: 'ensemble', horizon_days: 5 }, note: 'risk gating' },
    { key: 'economic_events', tool: 'QueryData', params: { types: 'economic_events' }, note: 'proximité CPI/Fed/jobs ±3j' },
    { key: 'earnings_cal', tool: 'GetEarningsCalendarFiltered', params: { days_ahead: 7, min_expected_move_pct: 4 }, note: 'fenêtre earnings' },
  ];
}

// ── Screeners d'univers US des scanners PRE-SCORÉS — Phase 1c ──
function stagingUniverseCalls() {
  return [
    { key: 'uni_highvol', tool: 'RunScreener', params: { pass_expr: 'near_breakout(0.04) and vol > 2000000 and rsi14 > 50 and close > 10', score_expr: 'rsi14 + atrpct * 5', region: 'us', force_async: true, top_k: 60 }, forScanner: 'highvol' },
    { key: 'uni_momentum', tool: 'RunScreener', params: { pass_expr: 'rsi14 > 50 and ema20 > ema50 and vol > 1500000 and close > 10', score_expr: 'rsi14', region: 'us', force_async: true, top_k: 60 }, forScanner: 'momentum' },
    { key: 'uni_factor', tool: 'RunScreener', params: { pass_expr: 'vol > 1500000 and close > 10', score_expr: 'vol', region: 'us', force_async: true, top_k: 120 }, forScanner: 'factor', note: 'composite 12-1/vol/maxDD calculé côté agent depuis barres 5y' },
    { key: 'uni_candlestick', tool: 'RunScreener', params: { pass_expr: 'vol > 1000000 and close > 5', score_expr: 'vol', region: 'us', force_async: true, top_k: 200 }, forScanner: 'candlestick', note: 'univers large — patterns chandeliers détectés côté scanner depuis barres' },
    { key: 'uni_etf_us', tool: 'RunScreener', params: { pass_expr: 'vol > 500000', score_expr: 'vol', region: 'us', asset: 'etf', force_async: true, top_k: 60 }, forScanner: 'etf' },
  ];
}

// ── Vague DTX : l'id public reste stable, chaque appel MCP cible explicitement
// le portefeuille moteur configuré. Un replay full suffit aussi aux sous-fenêtres.
function dtxCalls(scanSession, referenceClose) {
  const out = [];
  for (const id of DTX_MODES) {
    const portfolio = scan.dtxPortfolioForMode(id);
    const ccy = DTX_CCY[id] || 'USD';
    out.push({ key: `dtx_${id}_replay`, tool: 'DtxReplay', params: { portfolio, broker: 'alpaca', from: scan.DEFAULT_FROM, to: referenceClose, equity_full: true }, mode: id, portfolio, kind: 'replay', note: 'replay exact full-resolution · async → DtxJobStatus' });
    out.push({ key: `dtx_${id}_decide`, tool: 'DtxDecide', params: {
      portfolio, broker: 'alpaca', asof: referenceClose, expected_data_date: referenceClose,
      appel: 'evening', request_id: '$request_id',
      consumer_capabilities: { contract_version: '2.0', opportunity_groups: true, per_candidate_symbol: true, durable_intraday_execution: true },
      balances: { base_currency: ccy, cash_by_currency: { [ccy]: 100000 }, total_equity: 100000, broker_source: 'alpaca' },
      positions: [], orders: [],
    }, mode: id, portfolio, scanSession, kind: 'decide', note: 'Contract V2 · substituer un UUID stable à $request_id · async → DtxJobStatus' });
  }
  return out;
}

// ── Vague barres statiques : univers connus (FX/indices/mega-caps/métaux) → lots multi-symboles ──
function staticBarsCalls(lot, referenceClose, asOfTimestamp) {
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
    chunk(syms, lot).forEach((lotSyms, i) => out.push(barsCall({
      key: `bars_${s.scanner}_${String(i).padStart(2, '0')}`,
      symbols: lotSyms,
      scanner: s.scanner,
      referenceClose,
      asOfTimestamp,
      extra: s.extra,
      note: 'Chaque cellule et sa ligne sont liées par symbol/instrument_id ; aucune preuve coverage legacy',
    })));
  }
  return out;
}

function buildPlan(opts) {
  const context = resolvePlanContext(opts, { enforceCurrentTimestamp: true });
  const { referenceClose, scanSession, folder, asOfTimestamp } = context;
  const lot = opts.lot || 15;
  const dtx = dtxCalls(scanSession, referenceClose);
  const dtxBatchSize = opts.dtxBatch || 3;   // l'origine dtx renvoie des 502 sous burst (run 2026-07-22) → petits lots
  const dtxBatches = chunk(dtx, dtxBatchSize);
  return {
    generatedAt: asOfTimestamp,
    scanDate: scanSession,
    folder,
    referenceClose,
    lastTradingDay: referenceClose,
    asOfTimestamp,
    marketdataContract: {
      minimumBuild: MIN_MARKETDATA_BUILD,
      equityReferenceClose: referenceClose,
      assetCalendar: 'us_equity_exchange_sessions',
      completionPolicy: 'completed_only',
    },
    rawDir: RAW_DIR,
    doctrine: 'perf-parallel-mcp — R2: chaque `wave` = UN message, tous les appels en parallèle. R3: bars batchés multi-symboles.',
    execution: {
      raw_dump: `Après CHAQUE salve, écrire chaque réponse brute → ${RAW_DIR}/<key>.json (Bash), NE PAS raisonner sur le payload inline. Les gros résultats sont déjà auto-sauvés en fichier par Jobs → lire via node/jq, jamais re-inline.`,
      dtx_throttle: `⚠️ dtx origine sature en burst (502 Cloudflare observé sur 12 appels simultanés le 2026-07-22). Tirer wave_dtx par LOTS de ${dtxBatchSize} MAX (voir wave_dtx_batches), attendre le lot avant le suivant. Retry un 502/5xx après 60s (retryable). Poller DtxJobStatus pour les DtxReplay.`,
      context_budget: 'top_k modéré (≤25) + ne lire que symbol/score/entry/stop/rsi/atr/mcap des candidats. Ne jamais re-dumper un screener entier en contexte.',
    },
    waves: {
      // SALVE 1 : preflight + tout le contexte + tous les univers de screening (aucune dépendance entre eux)
      wave1_context_universes: [...contextCalls(referenceClose), ...stagingUniverseCalls()],
      // SALVE dtx : 6 modes × 3 — MAIS l'origine sature en burst → tirer par LOTS (wave_dtx_batches)
      wave_dtx: dtx,
      wave_dtx_batches: dtxBatches,
      // SALVE 2a : barres des univers STATIQUES (connus d'avance) — batchées
      wave2_static_bars: staticBarsCalls(lot, referenceClose, asOfTimestamp),
      // SALVE 2b : barres des candidats issus des screeners → résolue par `--resolve-bars` APRÈS wave1
      wave2_dynamic_bars: { deferred: true, how: 'node tools/scan-plan.js --resolve-bars --plan /tmp/scan-plan.json (réutilise exactement refdate/as_of_timestamp du plan initial)' },
    },
    nextSteps: [
      `1. Tirer wave1_context_universes en UNE salve //. HARD STOP si GetStatus ne certifie pas bars_daily_us_equity=${referenceClose} sur build ${MIN_MARKETDATA_BUILD}.`,
      '2. Tirer wave_dtx par LOTS (wave_dtx_batches, ≤3/lot ; attendre le lot avant le suivant ; retry 502 après 60s). Poller DtxJobStatus. Dumper → /tmp/mcp-raw/dtx_*.json.',
      `3. node tools/scan-plan.js --resolve-bars --plan /tmp/scan-plan.json → /tmp/scan-plan-bars.json ; tirer wave2 avec as_of_timestamp=${asOfTimestamp} et completed_only.`,
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
  const planPath = opts.plan || '/tmp/scan-plan.json';
  const plan = readJsonSafe(planPath);
  if (!plan) throw new Error(`plan initial absent/illisible: ${planPath}; générer un plan certifié avec --refdate et --as-of-timestamp`);
  if (!plan.marketdataContract
      || plan.marketdataContract.minimumBuild !== MIN_MARKETDATA_BUILD
      || plan.marketdataContract.completionPolicy !== 'completed_only') {
    throw new Error(`plan initial ${planPath} sans contrat Marketdata ${MIN_MARKETDATA_BUILD} completed_only`);
  }
  const context = resolvePlanContext({
    refdate: plan.referenceClose,
    asOfTimestamp: plan.asOfTimestamp,
    asof: plan.scanDate,
    folder: plan.folder,
  }, { enforceCurrentTimestamp: false });
  if (opts.refdate && opts.refdate !== context.referenceClose) throw new Error('--refdate disagrees with the initial plan');
  if (opts.asOfTimestamp && new Date(opts.asOfTimestamp).toISOString() !== context.asOfTimestamp) throw new Error('--as-of-timestamp disagrees with the initial plan');
  const lot = opts.lot || 15;
  const screenerKeys = [...contextCalls(context.referenceClose), ...stagingUniverseCalls()].filter((c) => /RunScreener|RunAutoScreener/.test(c.tool)).map((c) => c.key);
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
  const lots = chunk(allSyms, lot).map((lotSyms, i) => barsCall({
    key: `bars_dyn_${String(i).padStart(2, '0')}`,
    symbols: lotSyms,
    scanner: 'dynamic',
    referenceClose: context.referenceClose,
    asOfTimestamp: context.asOfTimestamp,
    note: 'Dédupliqué cross-scanner ; un symbole = une cellule terminale et une ligne identifiée',
  }));
  return {
    generatedAt: new Date().toISOString(),
    scanDate: context.scanSession,
    folder: context.folder,
    referenceClose: context.referenceClose,
    asOfTimestamp: context.asOfTimestamp,
    marketdataContract: plan.marketdataContract,
    uniqueTickers: allSyms.length,
    perScanner: Object.fromEntries(Object.entries(perScanner).map(([k, v]) => [k, [...new Set(v)]])),
    wave2_dynamic_bars: lots,
    note: 'Tirer ces lots en salves //. Refuser le batch à la moindre cellule invalide tout en conservant le brut et ses cellules saines.',
  };
}

function main() {
  throw new Error(LEGACY_DISABLED_REASON);
  /* istanbul ignore next -- legacy implementation kept temporarily for library-level fixtures */
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
    console.log(`   → puis: node tools/scan-plan.js --resolve-bars --plan ${outPath} ; node tools/scan-ingest-all.js`);
  } else {
    console.log(`📋 scan-plan bars → ${outPath} · ${result.uniqueTickers} tickers uniques · ${result.wave2_dynamic_bars.length} lots //`);
  }
  return result;
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    console.error(`❌ scan-plan fail-closed: ${error.message}`);
    process.exit(2);
  }
}
module.exports = {
  buildPlan, resolveBars, resolvePlanContext, barsQueryParams, barsCall,
  contextCalls, stagingUniverseCalls, dtxCalls, chunk, extractTickers,
  LEGACY_DISABLED_REASON,
};
