#!/usr/bin/env node
'use strict';

/**
 * metals-scanner.js — Faithful port of systematic-tss MetalsScanner. MCP-PRIMARY.
 *
 * Ranks precious-metals ETFs and mining stocks by a momentum composite for a
 * metals rotation mode. Source: internal/engine/scanner_metals.go.
 *
 * SCORING (scanner_metals.go:197, 215-227) — 14d-dominant:
 *   score = return30d*0.20 + return14d*0.50 + return7d*0.15
 *         + min(volRatio*10, 20)*0.10 + min(distMA50, 30)*0.05
 *   // GLD sector bonus (scanner_metals.go:221-224): when gold trends up, miners
 *   //   get a beta boost. Applied to every symbol EXCEPT GLD itself:
 *   if (gldMom30d > 0 && ticker !== 'GLD') score += gldMom30d * 0.1
 *   normalizedScore = min(max((score+50)/2, 0), 100)   // scanner_metals.go:227
 *
 * FILTERS:
 *   - Price > MA200 bull filter (scanner_metals.go:147-157)
 *   - MinP80DollarVolume liquidity filter (scanner_metals.go:80-85;
 *       impl indicators.go:217-233) — P80 of 20d close*volume ≥ minVolumeUsd
 *   - minScore (Scan filter loop, scanner_metals.go:96-112)
 *   - need ≥maPeriod (default 200) bars (scanner_metals.go:71-77, 143-145)
 *
 * ─── VOIE UNIQUE : MCP (décret archi 2026-07-12 « le MCP fait foi ») ──────────────────────────────
 *   Le scanner metals est MCP-PRIMARY : le CHEMIN MCP (--ingest, staging produit par l'AGENT) est le
 *   SEUL chemin data. L'ancienne branche fetch local (Yahoo query1/allorigins), le cache prix daté
 *   (price-cache) et la lecture d'univers local (data/metals-universe.json) ont été RETIRÉS. Ce script
 *   NE FETCH RIEN (ni réseau, ni cache) et NE LIT AUCUN univers local : il PARSE le staging JSON écrit
 *   par l'AGENT — qui, LUI, a appelé mcp__marketdata__* (RunScreener US/GLD-miners + QueryData
 *   bars_daily) et a fourni les barres OHLCV par ticker.
 *
 *   ⚠️ LA LOGIQUE DE SIGNAL EST INTACTE : scoreSymbol + tous les indicateurs/filtres
 *   (SMA/RSI/ATR/return/volRatio/P80 dollar-volume/MA200 bull filter/minScore) tournent EN NODE, à
 *   l'identique de la parité Go. SEULE LA SOURCE DES BARRES change (staging MCP au lieu de Yahoo).
 *
 *   Pipeline de génération du staging (côté AGENT, PAS ce node) :
 *     - Univers metals (ETF or/argent + miners) énuméré par l'agent (RunScreener region=us côté MCP,
 *       ou liste metals connue) — le node ne lit plus aucun fichier d'univers.
 *     - QueryData(types=bars_daily) ~250 barres 1d par ticker → l'agent écrit /tmp/metals-stage.json
 *       avec la map `bars` (une entrée par ticker) + `minVolumeUsd`/`names` optionnels.
 *
 * Usage:
 *   # l'agent a d'abord écrit /tmp/metals-stage.json via mcp__marketdata__*
 *   node tools/metals-scanner.js --ingest /tmp/metals-stage.json                          # stdout
 *   node tools/metals-scanner.js --ingest /tmp/metals-stage.json --dry-run --top 8        # aucun fichier écrit
 *   node tools/metals-scanner.js --ingest /tmp/metals-stage.json --output json --date 2026-07-11
 *   node tools/metals-scanner.js --ingest /tmp/metals-stage.json --output signals --folder 20260711
 *   node tools/metals-scanner.js --ingest /tmp/metals-stage.json --as-of 2026-05-01       # point-in-time scoring
 *   node tools/metals-scanner.js --ingest /tmp/metals-stage.json --min-score 55 --top 10
 *
 * Codes de sortie : 0 = OK (0 signal légitime inclus) ; 3 = staging absent/vide/malformé/
 * mcp_ok:false (run marqué incomplet, RIEN fabriqué) ; 2 = --ingest manquant (voie MCP obligatoire) ;
 * 1 = inattendu.
 */

const fs = require('fs');
const path = require('path');
const {
  calcSMA, calcRSI, calcATR, calcReturn, volRatio, calcDollarVolumePercentile,
} = require('./lib/metals-indicators');

const ROOT = path.join(__dirname, '..');

// ─── CLI args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}
const hasFlag = name => args.includes(`--${name}`);

const MIN_SCORE = parseFloat(getArg('min-score', '50'));
const TOP_N = parseInt(getArg('top', '10'));
const OUTPUT_MODE = getArg('output', 'stdout');
const DRY_RUN = hasFlag('dry-run');
const SCAN_DATE = getArg('date', new Date().toISOString().slice(0, 10));
const SCAN_FOLDER = getArg('folder', null);
// --as-of YYYY-MM-DD: point-in-time scoring. When set, OHLCV bars are sliced to
// only those with date <= AS_OF before scoring, so historical backfills score on
// the data that was knowable at that date. Absent = use all bars (current/default).
const AS_OF = getArg('as-of', '');
const MA_FILTER_PERIOD = parseInt(getArg('ma-filter', '200')); // bull filter (default 200)
// ─── VOIE MCP (--ingest) — SEUL chemin data (MCP-PRIMARY) ───────────────────────────────────────
// Le scanner NE FETCH RIEN (ni Yahoo, ni cache) et NE LIT AUCUN univers local : il PARSE un staging
// JSON écrit par l'AGENT (qui, LUI, a appelé mcp__marketdata__*). --ingest est OBLIGATOIRE.
const INGEST_PATH = getArg('ingest', null);

// Momentum weights (scanner_metals.go:197) — 14d-dominant
const W30D = 0.20, W14D = 0.50, W7D = 0.15, W_VOL = 0.10, W_MA50 = 0.05;

// ─── Normalisation des barres du staging (array-form MCP ou object-form) ─────────────────────────
// QueryData(bars_daily) renvoie [[date,o,h,l,c,v], ...] (ascendant). On accepte aussi la forme objet
// {date,open,high,low,close,volume}. Retourne des barres {date,open,high,low,close,volume} triées
// ascendant, en ne gardant que les barres OHLC finies (parité fetchYahooChart d'origine).
function normalizeBars(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const b of raw) {
    let date, o, h, l, c, v;
    if (Array.isArray(b)) {
      [date, o, h, l, c, v] = b;
    } else if (b && typeof b === 'object') {
      date = b.date; o = b.open; h = b.high; l = b.low; c = b.close; v = b.volume;
    } else {
      continue;
    }
    if (!date) continue;
    const O = Number(o), H = Number(h), L = Number(l), C = Number(c), V = Number(v);
    if (![O, H, L, C].every(Number.isFinite)) continue;
    out.push({ date: String(date).slice(0, 10), open: O, high: H, low: L, close: C, volume: Number.isFinite(V) ? V : 0 });
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}

// ─── Point-in-time slicing (--as-of) ─────────────────────────────────────────
// Keep only bars dated <= asOf so historical backfills score on knowable data.
function sliceAsOf(bars, asOf) {
  if (!asOf) return bars;
  return bars.filter(b => b.date <= asOf);
}

// ─── Scoring (port of scoreSymbol, scanner_metals.go:129-254) — INCHANGÉ ────────────────────────

function scoreSymbol(ticker, bars, gldMom30d) {
  const n = bars.length;
  const price = bars[n - 1].close;
  if (!(price > 0) || !Number.isFinite(price)) return null; // scanner_metals.go:134

  // Need maPeriod bars (scanner_metals.go:143-145)
  if (n < MA_FILTER_PERIOD) return null;

  // Bull market filter: price > SMA(maPeriod) (scanner_metals.go:147-157)
  const maFilter = calcSMA(bars, MA_FILTER_PERIOD);
  if (price < maFilter) return null;

  // Momentum returns (scanner_metals.go:172-174): 30/14/7
  const return30d = calcReturn(bars, 30);
  const return14d = calcReturn(bars, 14);
  const return7d = calcReturn(bars, 7);

  // Volume ratio: current vs 30d avg (scanner_metals.go:176-187)
  const vr = volRatio(bars, 30);

  // Distance from MA50 (scanner_metals.go:189-194)
  const ma50 = calcSMA(bars, 50);
  const distMA50 = ma50 > 0 ? ((price - ma50) / ma50) * 100.0 : 0;

  // Composite score (scanner_metals.go:215-219) — 14d-dominant weights
  let score = (return30d * W30D)
    + (return14d * W14D)
    + (return7d * W7D)
    + (Math.min(vr * 10.0, 20.0) * W_VOL)
    + (Math.min(distMA50, 30.0) * W_MA50);

  // GLD sector bonus (scanner_metals.go:221-224): when gold trends up, miners
  // (and all non-GLD metals names) get a small beta boost proportional to gold.
  if (gldMom30d > 0 && ticker !== 'GLD') {
    score += gldMom30d * 0.1;
  }

  // Normalize to 0-100 (scanner_metals.go:227)
  const normalizedScore = Math.min(Math.max((score + 50.0) / 2.0, 0), 100.0);

  // Other indicators (scanner_metals.go:230-235)
  const atr = calcATR(bars, 14);
  const atrPct = price > 0 ? atr / price : 0;
  const rsi = calcRSI(bars, 14);

  return {
    ticker,
    score: Math.round(normalizedScore * 100) / 100, // scanner_metals.go:239
    price,
    atr,
    atrPct,
    rsi,
    return30d,
    return14d,
    return7d,
    volRatio: vr,
    distMA50,
    ma50,
  };
}

// ─── VOIE MCP : --ingest (SEUL chemin data) ─────────────────────────────────────────────────────
// L'AGENT (claude -p / /scanner) appelle mcp__marketdata__* :
//   - énumère l'univers metals (ETF or/argent + miners) et récupère ~250 barres 1d par ticker via
//     QueryData(types=bars_daily).
//   - écrit /tmp/metals-stage.json avec la map `bars` (une entrée par ticker) + `minVolumeUsd`/`names`.
// CE script PARSE le staging (jamais de fetch réseau, jamais d'appel MCP — OAuth2, zéro token dans un
// subprocess node), construit le priceData Map et lance le scoring INCHANGÉ (scoreSymbol + filtres).
//
// ⛔ ZÉRO FABRICATION (MCP HARD STOP, fail-closed) : staging absent / vide / malformé / mcp_ok:false /
// error → marqueur _scanRuns['metals'] {incomplete:true, signals:0} + exit 3, RIEN fabriqué (comme pead).
//
// Shape attendu :
//   { mcp_ok:true, asof?, minVolumeUsd?, names?:{TICKER:"Full Name"},
//     bars: { TICKER: [[date,o,h,l,c,v], ...] | [{date,open,high,low,close,volume}, ...], ... } }

function resolveSigPathMetals() {
  const scanDir = SCAN_FOLDER || SCAN_DATE.replace(/-/g, '');
  return path.join(ROOT, 'scanner', scanDir, 'signals.json');
}

// MCP HARD STOP : marqueur d'incomplétude sans fabriquer de pool. No-op en dry-run / hors signals.
function writeMetalsIncompleteMarker(reason, extra) {
  if (DRY_RUN || OUTPUT_MODE !== 'signals') return false;
  const sigPath = resolveSigPathMetals();
  if (!fs.existsSync(sigPath)) {
    console.error(`❌ ${sigPath} introuvable — impossible d'écrire le marqueur d'incomplétude metals.`);
    return false;
  }
  const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
  if (!signals._scanRuns) signals._scanRuns = {};
  signals._scanRuns.metals = Object.assign({
    at: new Date().toISOString(), universe: 'metals', dataPath: 'mcp-ingest',
    signals: 0, incomplete: true, reason,
  }, extra || {});
  fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
  console.error(`⚠️  Marqueur _scanRuns['metals'] écrit (incomplete=true, reason="${reason}") dans ${sigPath}`);
  return true;
}

// Ingest + validation du staging (mêmes règles fail-closed que factor/momentum/pead loadStaging).
function loadMetalsStaging() {
  if (!INGEST_PATH) return { ok: false, reason: 'no_ingest_arg' };
  if (!fs.existsSync(INGEST_PATH)) return { ok: false, reason: 'ingest_file_missing' };
  let raw;
  try { raw = fs.readFileSync(INGEST_PATH, 'utf8'); }
  catch (e) { return { ok: false, reason: `ingest_read_error:${e.message}` }; }
  if (!raw || !raw.trim()) return { ok: false, reason: 'ingest_empty' };
  let data;
  try { data = JSON.parse(raw); }
  catch (e) { return { ok: false, reason: `ingest_malformed_json:${e.message}` }; }
  if (!data || typeof data !== 'object') return { ok: false, reason: 'ingest_not_object' };
  if (data.mcp_ok === false) return { ok: false, reason: 'mcp_ok_false' };
  if (data.error) return { ok: false, reason: `staging_error:${String(data.error).slice(0, 120)}` };
  if (!data.bars || typeof data.bars !== 'object' || Array.isArray(data.bars)) {
    return { ok: false, reason: 'ingest_no_bars_map' };
  }
  if (!Object.keys(data.bars).length) return { ok: false, reason: 'ingest_empty_bars_map' };
  return { ok: true, data };
}

// ─── Main scan ──────────────────────────────────────────────────────────────

function main() {
  // MCP-PRIMARY : --ingest (staging agent→MCP) est le SEUL chemin data. Il n'y a plus de fallback
  // local (Yahoo + cache + univers local retirés — décret archi 2026-07-12). Sans --ingest → erreur.
  if (!INGEST_PATH) {
    console.error('❌ metals-scanner est MCP-PRIMARY : --ingest <staging.json> est OBLIGATOIRE.');
    console.error('   L\'agent doit d\'abord écrire le staging via mcp__marketdata__* (QueryData bars_daily par ticker metals),');
    console.error('   puis : node tools/metals-scanner.js --ingest /tmp/metals-stage.json --output signals --folder YYYYMMDD');
    process.exit(2);
  }

  const staged = loadMetalsStaging();
  if (!staged.ok) {
    console.error(`⛔ Staging metals indisponible/invalide (reason="${staged.reason}"). RIEN fabriqué.`);
    writeMetalsIncompleteMarker(staged.reason, { ingestPath: INGEST_PATH || null });
    process.exit(3);
  }

  const data = staged.data;
  const names = (data.names && typeof data.names === 'object') ? data.names : {};
  const minVolumeUsd = Number.isFinite(data.minVolumeUsd) ? data.minVolumeUsd : 0;
  const barsMap = data.bars;
  const universe = Object.keys(barsMap);

  console.log(`🥇  Metals Momentum Scanner (systematic-tss port) — VOIE MCP (--ingest, MCP-PRIMARY, seul chemin data)`);
  console.log(`   Staging: ${INGEST_PATH} | universe: ${universe.length} tickers | minScore: ${MIN_SCORE} | top: ${TOP_N} | MA-filter: ${MA_FILTER_PERIOD} | minVolUsd: ${minVolumeUsd}`);
  console.log(`   Date: ${SCAN_DATE}${AS_OF ? ` | as-of: ${AS_OF} (point-in-time)` : ''}${data.asof ? ` | staging asof: ${data.asof}` : ''}`);

  // Construit le priceData Map depuis le staging (normalisation + slicing --as-of), même contrat que
  // l'ancienne branche fetch : on ne garde que les tickers avec ≥60 barres exploitables.
  const priceData = new Map();
  for (const [ticker, rawBars] of Object.entries(barsMap)) {
    const bars = sliceAsOf(normalizeBars(rawBars), AS_OF);
    if (bars.length >= 60) priceData.set(ticker, bars);
  }
  console.log(`   Barres exploitables : ${priceData.size}/${universe.length} tickers (≥60 barres après normalisation${AS_OF ? '/as-of' : ''})`);

  // GLD 30d momentum for the sector bonus (scanner_metals.go:57-61).
  let gldMom30d = 0;
  const gldBars = priceData.get('GLD');
  if (gldBars && gldBars.length > 30) gldMom30d = calcReturn(gldBars, 30);
  console.log(`   GLD 30d momentum: ${gldMom30d >= 0 ? '+' : ''}${gldMom30d.toFixed(2)}%${gldMom30d > 0 ? ' → miner sector bonus active' : ' → no sector bonus'}`);

  console.log('🔍 Scoring momentum...');
  const candidates = [];

  for (const [ticker, bars] of priceData) {
    // MinP80DollarVolume liquidity filter (scanner_metals.go:80-85).
    if (minVolumeUsd > 0) {
      const dvP80 = calcDollarVolumePercentile(bars, 20, 0.80);
      if (dvP80 < minVolumeUsd) continue;
    }

    const r = scoreSymbol(ticker, bars, gldMom30d);
    if (!r) continue;                       // failed MA200 bull filter / insufficient bars
    if (r.score < MIN_SCORE) continue;      // minScore filter

    const entry = +r.price.toFixed(2);
    // Stop: max(entry - 1.5*ATR, MA50) when MA50 below price (structural floor),
    // else entry - 1.5*ATR. (mirrors crypto-scanner stop logic)
    let stop = entry - 1.5 * r.atr;
    if (r.ma50 > 0 && r.ma50 < entry && r.ma50 > stop) stop = r.ma50;
    stop = +stop.toFixed(2);

    const risk = entry - stop;
    if (risk <= 0) continue;

    const tp1 = +(entry + risk * 2).toFixed(2);
    const tp2 = +(entry + risk * 3).toFixed(2);
    const rr = ((tp1 - entry) / risk).toFixed(1);

    candidates.push({
      ticker,
      name: names[ticker] || ticker,
      score: r.score,
      strategy: 'MetalsMomentum',
      entry,
      stop,
      tp1,
      tp2,
      rr: `1:${rr}`,
      horizon: 14,
      region: 'METALS',
      sharia: null,
      assetClass: 'metals',
      dataPath: 'mcp-ingest',
      thesis: `Metals momentum: +${r.return30d.toFixed(1)}% 30d / +${r.return14d.toFixed(1)}% 14d / +${r.return7d.toFixed(1)}% 7d, above MA${MA_FILTER_PERIOD} bull filter, ${r.distMA50.toFixed(1)}% over MA50, vol ${r.volRatio.toFixed(2)}× 30d avg${gldMom30d > 0 && ticker !== 'GLD' ? ` (GLD +${gldMom30d.toFixed(1)}% sector bonus)` : ''}.`,
      extension: {
        rsi: +r.rsi.toFixed(1),
        atr: +r.atr.toFixed(2),
        distance_50dma_pct: +r.distMA50.toFixed(1),
      },
      metrics: {
        return30d: +r.return30d.toFixed(2),
        return14d: +r.return14d.toFixed(2),
        return7d: +r.return7d.toFixed(2),
        volRatio: +r.volRatio.toFixed(2),
        atrPct: +(r.atrPct * 100).toFixed(2),
        gldMom30d: +gldMom30d.toFixed(2),
      },
    });
  }

  // Sort by score desc, tie-break by ticker (scanner_metals.go:115-120)
  candidates.sort((a, b) => (b.score - a.score) || (a.ticker < b.ticker ? -1 : 1));
  const topCandidates = candidates.slice(0, TOP_N);

  console.log(`\n✅ Found ${candidates.length} candidates (passed bull filter + liquidity + minScore), top ${topCandidates.length}:`);
  for (const c of topCandidates) {
    console.log(
      `  🥇 ${c.ticker.padEnd(6)} score:${String(c.score).padStart(6)} ` +
      `30d:${c.metrics.return30d >= 0 ? '+' : ''}${c.metrics.return30d}% ` +
      `14d:${c.metrics.return14d >= 0 ? '+' : ''}${c.metrics.return14d}% ` +
      `E:${c.entry} S:${c.stop} TP1:${c.tp1} RR:${c.rr} ` +
      `RSI:${c.extension.rsi} vol:${c.metrics.volRatio}x`
    );
  }

  if (DRY_RUN) { console.log('\n🏷️  Dry run — no files written.'); return topCandidates; }

  if (OUTPUT_MODE === 'json') {
    const outPath = path.join(ROOT, 'data', `metals-scan-${SCAN_DATE}.json`);
    fs.writeFileSync(outPath, JSON.stringify({ scanDate: SCAN_DATE, asOf: AS_OF || null, dataPath: 'mcp-ingest', gldMom30d: +gldMom30d.toFixed(2), candidates: topCandidates }, null, 2));
    console.log(`\n📁 Written to ${outPath}`);
  } else if (OUTPUT_MODE === 'signals') {
    const sigPath = resolveSigPathMetals();
    if (!fs.existsSync(sigPath)) { console.error(`❌ ${sigPath} not found`); process.exit(1); }
    const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
    // metals_pool — analogous to crypto_pool, consumed downstream by sweep for the metals mode.
    // Fusion NON DESTRUCTIVE, dedup par ticker : on préserve le reste du fichier (autres pools +
    // _scanRuns) et on n'écrase pas les lignes metals déjà présentes du même ticker.
    if (!Array.isArray(signals.metals_pool)) signals.metals_pool = [];
    const existing = new Set(signals.metals_pool.map(s => s.ticker));
    let added = 0;
    for (const c of topCandidates) {
      if (existing.has(c.ticker)) continue; // dedup by ticker
      signals.metals_pool.push(c);
      existing.add(c.ticker);
      added++;
    }
    if (!signals._scanRuns) signals._scanRuns = {};
    signals._scanRuns.metals = {
      at: new Date().toISOString(), universe: 'metals', dataPath: 'mcp-ingest',
      universeFetched: universe.length, scoreable: priceData.size,
      candidates: candidates.length, signals: topCandidates.length, added,
      incomplete: false,
    };
    fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
    console.log(`\n📁 Appended ${added} metals signals to metals_pool in ${sigPath}`);
  }

  return topCandidates;
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

module.exports = { main, scoreSymbol, sliceAsOf, normalizeBars };
