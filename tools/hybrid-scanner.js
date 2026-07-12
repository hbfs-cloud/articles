#!/usr/bin/env node
'use strict';

/**
 * hybrid-scanner.js — Port of systematic-tss Hybrid Scanner. MCP-PRIMARY.
 *
 * Switches between AF (fractal-scanner), MegaCap, and DSL based on market breadth:
 *   - AF (aggressive) when >15% of stocks have >30% gain in 60d (broad momentum frenzy)
 *   - MEGACAP when narrow rally (index up but weak breadth, like 2023 Mag 7)
 *   - DSL (defensive) otherwise
 *   - BLEND modes for gray zones
 *
 * It appends signals to an existing signals.json with strategy "HybridMegaCap" (MEGACAP/BLEND_MEGA
 * mode only) and writes the breadth analysis into signals.breadth + a _scanRuns['hybrid'] marker.
 * (AF / DSL / BLEND modes emit no own signals — fractal-scanner already produced them.)
 *
 * ─── VOIE UNIQUE : MCP (décret archi 2026-07-12 « le MCP fait foi ») ──────────────────────────────
 *   Le scanner hybrid est MCP-PRIMARY : le CHEMIN MCP (--ingest, staging produit par l'AGENT) est
 *   le SEUL chemin data. L'ancienne branche fetch local (Yahoo query1/allorigins) et la lecture du
 *   cache prix partagé + de l'univers local (data/americanbull-universe.json) ont été RETIRÉES. Ce
 *   script NE FETCH RIEN (ni réseau, ni cache disque) et NE LIT AUCUN univers local : il PARSE le
 *   staging JSON écrit par l'agent — qui, LUI, a appelé mcp__marketdata__* (RunScreener US +
 *   QueryData bars_daily) et rassemblé les barres OHLCV. Seule la SOURCE des barres change ; toute la
 *   LOGIQUE de signal (breadth extremePct/megaConc/megaMom, determineMode, scoreMegaCap) est intacte.
 *
 *   Pipeline de génération du staging (côté AGENT, PAS ce node) :
 *     RunScreener(region=US, asset=stock, force_async → Jobs) → univers US large énuméré
 *       (représentatif pour la breadth — la même intention que l'ancien americanbull-universe)
 *     QueryData(types=bars_daily) ~2y → barres OHLCV par nom, MEGA_CAP_TICKERS INCLUS avec ≥200
 *       barres (SMA200 dans scoreMegaCap). L'agent écrit /tmp/hybrid-stage.json {mcp_ok, asof, bars}.
 *
 * Usage:
 *   # l'agent a d'abord écrit /tmp/hybrid-stage.json via mcp__marketdata__*
 *   node tools/hybrid-scanner.js --ingest /tmp/hybrid-stage.json --output signals --date 20260710 --folder 20260713 --regime RISK_ON
 *   node tools/hybrid-scanner.js --ingest /tmp/hybrid-stage.json --dry-run    # breadth analysis only, aucun fichier écrit
 *
 * Staging shape :
 *   { mcp_ok:true, asof:"YYYY-MM-DD", regime?:"RISK_ON",
 *     bars: { "AAPL": [["YYYY-MM-DD",o,h,l,c,v], ...] | [{date,open,high,low,close,volume},...], ... } }
 *
 * Codes de sortie : 0 = OK ; 3 = staging absent/vide/malformé/mcp_ok:false/error (run marqué
 *   incomplet, RIEN fabriqué) ; 2 = --ingest manquant (voie MCP obligatoire) ; 1 = inattendu.
 */

const fs = require('fs');
const path = require('path');
const {
  calcSMA, calcRSI, calcATR, calcVolatility, calcMomentum,
  calcAvgVolume, calcDollarVolumePercentile, calcStochastic,
} = require('./lib/fractal-indicators');

const ROOT = path.join(__dirname, '..');

const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}
const hasFlag = name => args.includes(`--${name}`);

const SCAN_DATE = getArg('date', new Date().toISOString().slice(0, 10));
const SCAN_FOLDER = getArg('folder', null);
const REGIME = getArg('regime', null);
const DRY_RUN = hasFlag('dry-run');
const OUTPUT_MODE = getArg('output', 'stdout');
const TOP_N = parseInt(getArg('top', '30'));
const STRATEGY_TAG = getArg('strategy', null);
// ─── VOIE MCP (--ingest) — SEUL chemin data (MCP-PRIMARY) ───────────────────────────────────────
// Le scanner NE FETCH RIEN (ni Yahoo, ni cache disque) et NE LIT AUCUN univers local : il PARSE un
// staging JSON écrit par l'AGENT (qui, LUI, a appelé mcp__marketdata__*). --ingest est OBLIGATOIRE.
const INGEST_PATH = getArg('ingest', null);

// Point-in-time established-liquidity gate (survivorship / look-ahead guard) — MEDIAN dollar
// volume over ESTABLISHED_LOOKBACK bars ≤ scanDate. OFF by default (0); a re-ported mode passes
// its Go value via --min-established-dollar-volume. Near-moot on this hard-coded mega-cap list but
// kept for parity with fractal/highvol scanners so the whole hybrid sleeve is gate-consistent.
const MIN_ESTABLISHED_DOLLAR_VOLUME = parseFloat(getArg('min-established-dollar-volume', '0'));
const ESTABLISHED_LOOKBACK = parseInt(getArg('established-lookback', '60'));

const MEGA_CAP_TICKERS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK-B',
  'UNH', 'LLY', 'JPM', 'V', 'XOM', 'MA', 'JNJ', 'PG', 'HD', 'COST',
  'ABBV', 'MRK', 'AVGO', 'KO', 'PEP', 'WMT', 'BAC', 'CRM', 'TMO',
  'ORCL', 'ACN', 'MCD', 'LIN', 'AMD', 'CSCO', 'ABT', 'ADBE', 'NFLX',
  'WFC', 'GE', 'CAT', 'PM', 'TXN', 'QCOM', 'INTU', 'ISRG', 'AMGN',
  'GS', 'ELV', 'BKNG', 'AMAT', 'BLK',
];

// ─── Staging bars normalizer (MCP-native rows OR objects → {date,open,high,low,close,volume}) ────
// N'INVENTE aucune donnée : toute barre incomplète est écartée. Accepte les deux formes que peut
// émettre l'agent : ligne MCP [date,o,h,l,c,v] ou objet déjà nommé.
function normalizeBars(raw) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const b of raw) {
    let date, open, high, low, close, volume;
    if (Array.isArray(b)) {
      [date, open, high, low, close, volume] = b;
    } else if (b && typeof b === 'object') {
      date = b.date; open = b.open; high = b.high; low = b.low; close = b.close; volume = b.volume;
    } else { continue; }
    if (date == null || open == null || high == null || low == null || close == null) continue;
    out.push({ date: String(date).slice(0, 10), open: +open, high: +high, low: +low, close: +close, volume: +(volume || 0) });
  }
  // Tri chronologique ascendant (parité avec l'ancien fetch Yahoo qui rendait des barres ordonnées).
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}

// ─── Breadth analysis (port of calcExtremePct, calcMegaCapConcentration) ────

function sliceBars(bars, scanDate) {
  const norm = scanDate.replace(/-/g, '');
  const cutIdx = bars.findIndex(b => b.date.replace(/-/g, '') > norm);
  return cutIdx > 0 ? bars.slice(0, cutIdx) : bars;
}

function calcExtremePct(allBars, scanDate) {
  let total = 0, extreme = 0;
  for (const [, rawBars] of allBars) {
    const bars = sliceBars(rawBars, scanDate);
    if (bars.length < 60) continue;
    total++;
    const n = bars.length;
    const mom60 = (bars[n - 1].close - bars[n - 60].close) / bars[n - 60].close;
    if (mom60 > 0.30) extreme++;
  }
  return total > 0 ? extreme / total : 0;
}

function calcMegaCapMomentum(allBars, megaTickers, scanDate) {
  const moms = [];
  for (const t of megaTickers) {
    const rawBars = allBars.get(t);
    if (!rawBars) continue;
    const bars = sliceBars(rawBars, scanDate);
    if (bars.length < 60) continue;
    const n = bars.length;
    const mom60 = (bars[n - 1].close - bars[n - 60].close) / bars[n - 60].close;
    moms.push(mom60);
  }
  return moms.length ? moms.reduce((s, m) => s + m, 0) / moms.length : 0;
}

function calcMegaCapConcentration(allBars, megaTickers, scanDate) {
  const stocks = [];
  for (const [ticker, rawBars] of allBars) {
    const bars = sliceBars(rawBars, scanDate);
    if (bars.length < 60) continue;
    const n = bars.length;
    const mom60 = (bars[n - 1].close - bars[n - 60].close) / bars[n - 60].close;
    if (mom60 > 0) {
      stocks.push({ ticker, mom60, isMega: megaTickers.includes(ticker) });
    }
  }
  if (stocks.length < 20) return 0;
  stocks.sort((a, b) => b.mom60 - a.mom60);
  const top20 = stocks.slice(0, 20);
  return top20.filter(s => s.isMega).length / 20;
}

function determineMode(allBars, scanDate, regime) {
  const extremePct = calcExtremePct(allBars, scanDate);
  const megaConc = calcMegaCapConcentration(allBars, MEGA_CAP_TICKERS, scanDate);
  const megaMom = calcMegaCapMomentum(allBars, MEGA_CAP_TICKERS, scanDate);
  const isRiskOn = regime && regime.toUpperCase().includes('RISK_ON');

  const isMegaCapRally = megaConc > 0.25 && extremePct < 0.10 && isRiskOn;

  let mode = 'DSL';
  if (extremePct > 0.15) {
    mode = 'AF';
  } else if (isMegaCapRally) {
    mode = 'MEGACAP';
  } else if (extremePct >= 0.12 && extremePct <= 0.15) {
    mode = 'BLEND';
  } else if (isRiskOn && extremePct >= 0.08) {
    mode = 'BLEND';
  } else if (megaConc >= 0.20 && megaMom >= 0.05 && extremePct < 0.08) {
    mode = 'MEGACAP';
  }

  return {
    mode,
    extremePct: +(extremePct * 100).toFixed(1),
    megaCapConcentration: +(megaConc * 100).toFixed(1),
    megaCapMomentum: +(megaMom * 100).toFixed(1),
  };
}

// ─── MegaCap scorer (simplified AF for mega-caps only) ──────────────────────

function scoreMegaCap(bars, regime) {
  const n = bars.length;
  if (n < 120) return null;
  const price = bars[n - 1].close;
  if (price <= 0) return null;

  const sma20 = calcSMA(bars, 20);
  const sma50 = calcSMA(bars, 50);
  const sma200 = n >= 200 ? calcSMA(bars, 200) : sma50;
  const rsi = calcRSI(bars, 14);
  const atr = calcATR(bars, 14);
  const mom60 = calcMomentum(bars, 60);
  const mom120 = calcMomentum(bars, 120);

  if (rsi > 80 || rsi < 25) return null;
  if (price < sma50) return null;
  if (mom60 < -0.05) return null;

  let score = 50;
  if (price > sma20 && sma20 > sma50) score += 20;
  if (mom60 > 0.15) score += 15;
  if (mom120 > 0.30) score += 15;
  if (rsi >= 50 && rsi <= 65) score += 10;
  if (rsi > 70) score -= 5;

  const distMA20 = sma20 > 0 ? (price - sma20) / sma20 : 0;
  const distMA50 = sma50 > 0 ? (price - sma50) / sma50 : 0;

  return {
    score: +score.toFixed(2),
    price, entry: price,
    stop: +(price - atr * 2.0).toFixed(4),
    atr, rsi, mom60, mom120,
    distMA20: +distMA20.toFixed(4),
    distMA50: +distMA50.toFixed(4),
    sma20, sma50,
    strategy: 'megacap',
  };
}

// ─── VOIE MCP : --ingest (SEUL chemin data) ─────────────────────────────────────────────────────
// Ingest + validation du staging (mêmes règles fail-closed que factor/pead-scanner.loadStaging).
function loadStaging() {
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
    return { ok: false, reason: 'ingest_no_bars_object' };
  }
  if (!Object.keys(data.bars).length) return { ok: false, reason: 'ingest_bars_empty' };
  return { ok: true, data };
}

function resolveSigPath() {
  const scanDir = SCAN_FOLDER || SCAN_DATE.replace(/-/g, '');
  return path.join(ROOT, 'scanner', scanDir, 'signals.json');
}

// MCP HARD STOP : marqueur d'incomplétude sans fabriquer de pool. No-op en dry-run / hors signals.
function writeIncompleteMarker(reason, extra) {
  if (DRY_RUN || OUTPUT_MODE !== 'signals') return false;
  const sigPath = resolveSigPath();
  if (!fs.existsSync(sigPath)) {
    console.error(`❌ ${sigPath} introuvable — impossible d'écrire le marqueur d'incomplétude hybrid.`);
    return false;
  }
  const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
  if (!signals._scanRuns) signals._scanRuns = {};
  signals._scanRuns.hybrid = Object.assign({
    at: new Date().toISOString(), universe: 'hybrid', dataPath: 'mcp-ingest',
    signals: 0, incomplete: true, reason,
  }, extra || {});
  fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
  console.error(`⚠️  Marqueur _scanRuns['hybrid'] écrit (incomplete=true, reason="${reason}") dans ${sigPath}`);
  return true;
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔄 Hybrid Scanner (systematic-tss port) — VOIE MCP (--ingest, MCP-PRIMARY, seul chemin data)');
  console.log(`   Date: ${SCAN_DATE} | Regime: ${REGIME || 'auto'}`);

  // MCP-PRIMARY : --ingest (staging agent→MCP) est le SEUL chemin data. Plus de fallback local
  // (Yahoo + cache prix + univers local retirés — décret archi 2026-07-12). Sans --ingest → erreur.
  if (!INGEST_PATH) {
    console.error('❌ hybrid-scanner est MCP-PRIMARY : --ingest <staging.json> est OBLIGATOIRE.');
    console.error('   L\'agent doit d\'abord écrire le staging via mcp__marketdata__* (RunScreener US + QueryData bars_daily),');
    console.error('   puis : node tools/hybrid-scanner.js --ingest /tmp/hybrid-stage.json --output signals --folder YYYYMMDD --regime REGIME');
    process.exit(2);
  }

  const staged = loadStaging();
  if (!staged.ok) {
    console.error(`⛔ Staging hybrid indisponible/invalide (reason="${staged.reason}"). RIEN fabriqué.`);
    writeIncompleteMarker(staged.reason, { ingestPath: INGEST_PATH || null });
    process.exit(3);
  }
  const data = staged.data;
  const regime = REGIME || data.regime || null;

  // Construit allBars depuis le staging (barres OHLCV rassemblées par l'agent via MCP). L'univers =
  // les clés de staging.bars — plus aucune lecture de data/americanbull-universe.json ni du cache.
  console.log('📊 Chargement des barres OHLCV du staging pour la breadth...');
  const allBars = new Map();
  let loaded = 0;
  for (const [ticker, rawBars] of Object.entries(data.bars)) {
    const bars = normalizeBars(rawBars);
    if (bars && bars.length >= 60) { allBars.set(ticker, bars); loaded++; }
  }
  const universeCount = Object.keys(data.bars).length;
  console.log(`   ${loaded}/${universeCount} tickers avec ≥60 barres valides`);

  if (loaded < 200) {
    // Breadth non fiable sur < 200 noms : on NE fabrique pas de signal, on marque le run incomplet
    // et on retombe sur DSL (défaut défensif — parité avec l'ancien comportement "insufficient data").
    console.log('⚠️  Barres insuffisantes pour la breadth (< 200 noms valides). Mode par défaut : DSL.');
    const fallback = { mode: 'DSL', extremePct: 0, megaCapConcentration: 0, note: 'insufficient data' };
    console.log(JSON.stringify(fallback));
    if (!DRY_RUN && OUTPUT_MODE === 'signals') {
      const sigPath = resolveSigPath();
      if (fs.existsSync(sigPath)) {
        const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
        signals.breadth = fallback;
        if (!signals._scanRuns) signals._scanRuns = {};
        signals._scanRuns.hybrid = {
          at: new Date().toISOString(), universe: 'hybrid', dataPath: 'mcp-ingest',
          mode: 'DSL', signals: 0, universeFetched: universeCount, loaded,
          incomplete: true, reason: 'insufficient_breadth_data',
        };
        fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
        console.log(`📁 Breadth (fallback DSL) + marqueur _scanRuns['hybrid'] écrits dans ${sigPath}`);
      }
    }
    return;
  }

  // Determine scanner mode based on breadth
  const analysis = determineMode(allBars, SCAN_DATE, regime);
  console.log(`\n📈 Breadth Analysis:`);
  console.log(`   Extreme Momentum: ${analysis.extremePct}% of stocks with >30% gain in 60d`);
  console.log(`   MegaCap Concentration: ${analysis.megaCapConcentration}% of top-20 momentum are mega-caps`);
  console.log(`   MegaCap Avg Momentum: ${analysis.megaCapMomentum}%`);
  console.log(`   → Mode: ${analysis.mode}`);

  if (DRY_RUN) {
    console.log(JSON.stringify(analysis, null, 2));
    return;
  }

  // For AF and BLEND modes, the fractal-scanner.js already ran and produced signals.
  // For MEGACAP mode, we score mega-caps specifically — from the SAME staging bars (agent must
  // include MEGA_CAP_TICKERS in staging.bars with ≥200 bars). No local fetch/cache anymore.
  let megaSignals = [];
  if (analysis.mode === 'MEGACAP' || analysis.mode === 'BLEND_MEGA') {
    console.log('\n🏢 Scoring Mega-Cap candidates...');
    const candidates = [];
    const scanDateNorm = SCAN_DATE.replace(/-/g, '');
    const missingMega = [];

    for (const t of MEGA_CAP_TICKERS) {
      const rawBars = allBars.get(t);
      if (!rawBars) { missingMega.push(t); continue; }
      const cutIdx = rawBars.findIndex(b => b.date.replace(/-/g, '') > scanDateNorm);
      const bars = cutIdx > 0 ? rawBars.slice(0, cutIdx) : rawBars;
      if (MIN_ESTABLISHED_DOLLAR_VOLUME > 0) {
        if (bars.length < ESTABLISHED_LOOKBACK) continue;
        if (calcDollarVolumePercentile(bars, ESTABLISHED_LOOKBACK, 0.50) < MIN_ESTABLISHED_DOLLAR_VOLUME) continue;
      }
      const result = scoreMegaCap(bars, regime);
      if (!result || result.score < 50) continue;

      const risk = result.entry - result.stop;
      if (risk <= 0) continue;
      candidates.push({
        ticker: t, score: result.score,
        entry: +result.entry.toFixed(2), stop: +result.stop.toFixed(2),
        tp1: +(result.entry + risk * 2).toFixed(2),
        tp2: +(result.entry + risk * 3).toFixed(2),
        rr: '1:2.0',
        metrics: result,
      });
    }
    if (missingMega.length) {
      console.log(`   ⚠️  ${missingMega.length} mega-caps absents du staging (breadth OK, score partiel): ${missingMega.join(',')}`);
    }
    candidates.sort((a, b) => b.score - a.score);
    megaSignals = candidates.slice(0, TOP_N);
    console.log(`   Found ${candidates.length} mega-cap signals, top ${megaSignals.length}:`);
    for (const c of megaSignals) {
      console.log(`     ${c.ticker.padEnd(6)} score:${c.score} E:${c.entry} RSI:${c.metrics.rsi.toFixed(0)} Mom60:${(c.metrics.mom60 * 100).toFixed(0)}%`);
    }
  }

  // Write signals (mega-cap append) + breadth analysis + _scanRuns marker.
  if (OUTPUT_MODE === 'signals') {
    const sigPath = resolveSigPath();
    if (!fs.existsSync(sigPath)) { console.error(`❌ ${sigPath} introuvable`); process.exit(1); }
    const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));

    let added = 0;
    if (megaSignals.length) {
      if (!Array.isArray(signals.signals)) signals.signals = [];
      const existing = new Set(signals.signals.map(s => s.ticker));
      for (const c of megaSignals) {
        if (existing.has(c.ticker)) continue;
        signals.signals.push({
          ticker: c.ticker, name: c.ticker, score: c.score, strategy: STRATEGY_TAG || 'HybridMegaCap',
          entry: c.entry, stop: c.stop, tp1: c.tp1, tp2: c.tp2, rr: c.rr,
          horizon: 21, region: 'US', sharia: null,
          thesis: `MegaCap score ${c.score}: Mom60=${(c.metrics.mom60 * 100).toFixed(0)}%, RSI=${c.metrics.rsi.toFixed(0)}`,
        });
        existing.add(c.ticker);
        added++;
      }
      console.log(`   Appended ${added} mega-cap signals to ${sigPath}`);
    }

    signals.breadth = analysis;
    if (!signals._scanRuns) signals._scanRuns = {};
    signals._scanRuns.hybrid = {
      at: new Date().toISOString(), universe: 'hybrid', dataPath: 'mcp-ingest',
      mode: analysis.mode, universeFetched: universeCount, loaded,
      candidates: megaSignals.length, signals: added, added,
      regime: regime || 'auto', incomplete: false,
    };
    fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
    console.log(`\n📁 Breadth analysis + _scanRuns['hybrid'] written to ${sigPath}`);
  }

  console.log('\n✅ Done.');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
