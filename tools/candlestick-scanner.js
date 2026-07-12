#!/usr/bin/env node
'use strict';

/**
 * candlestick-scanner.js — Faithful port of systematic-tss americanbulls scanner. MCP-PRIMARY.
 *
 * Scans the US equity universe (mcap ≥$300M, volume ≥5M) for 25 candlestick patterns with
 * volume spike confirmation (8× signal-day close volume — trading parity with Go). Multi-factor
 * scoring: pattern base + ATR% + momentum + MA20 distance + RSI + BB%B + regime.
 *
 * ─── VOIE UNIQUE : MCP (décret archi 2026-07-12 « le MCP fait foi ») ──────────────────────────────
 *   Le scanner candlestick est MCP-PRIMARY : le CHEMIN MCP (--ingest, staging produit par l'AGENT)
 *   est le SEUL chemin data. L'ancienne branche fetch local (Yahoo query1/allorigins, cache prix daté)
 *   et la lecture d'univers local (data/americanbull-universe.json) ont été RETIRÉES. Ce script NE
 *   FETCH RIEN (ni réseau, ni cache) et NE LIT AUCUN univers local : il PARSE le staging JSON écrit
 *   par l'agent — qui, LUI, a appelé mcp__marketdata__* (RunScreener US + QueryData bars_daily).
 *
 *   ⚠️  La LOGIQUE DE SIGNAL est INCHANGÉE : detectPattern + gates (score, 8× vol, P80/established
 *   liquidity) + scoring + tp1/tp2/rr tournent EXACTEMENT comme avant, sur les MÊMES barres OHLCV.
 *   Seule la SOURCE des barres change : elles arrivent désormais du staging MCP au lieu de Yahoo.
 *
 *   Pipeline de génération du staging (côté AGENT, PAS ce node) :
 *     RunScreener(region=us, asset=stock, pass_expr="vol>5000000 && close>0", force_async → Jobs)
 *       → univers US énuméré (post-filtre market_cap>=3e8 EN CODE côté agent — JAMAIS market_cap
 *         dans pass_expr, il s'évalue à 0 → 0 candidat silencieux ; cf scanner-pipeline §DSL)
 *     QueryData(types=bars_daily, days≈200, timeframe=1d) par batch → l'agent écrit, PAR TICKER, ses
 *       barres brutes [date,o,h,l,c,v] dans /tmp/candlestick-stage.json (aucun scoring côté agent :
 *       les patterns/gates restent dans CE node — modèle "bars staging", pas "score staging").
 *
 * Shape staging attendu :
 *   { mcp_ok:true, asof:"YYYY-MM-DD", regime?:"Neutral", universeFetched?:<int>,
 *     candidates:[ { ticker:"AAPL", bars:[[date,o,h,l,c,v], ...] }, ... ] }
 *   (bars accepte aussi la forme objet [{date,open,high,low,close,volume}, ...].)
 *
 * Usage:
 *   # l'agent a d'abord écrit /tmp/candlestick-stage.json via mcp__marketdata__*
 *   node tools/candlestick-scanner.js --ingest /tmp/candlestick-stage.json --output signals --date 2026-07-10 --folder 20260713 --regime Neutral
 *   node tools/candlestick-scanner.js --ingest /tmp/candlestick-stage.json --output json --date 2026-07-10
 *   node tools/candlestick-scanner.js --ingest /tmp/candlestick-stage.json --dry-run
 *
 * Codes de sortie : 0 = OK (0 signal légitime inclus — jour calme = parité systematic-tss) ;
 *   3 = staging absent/vide/malformé/mcp_ok:false/error/candidates non-array (run marqué incomplete,
 *   RIEN fabriqué) ; 2 = --ingest manquant (voie MCP obligatoire) ; 1 = inattendu.
 */

const fs = require('fs');
const path = require('path');
const { detectPattern, calcATR, calcRSI, calcSMA, volRatio } = require('./lib/candlestick-patterns');
// Sector + Sharia classification — shared single source of truth (also used by sweep.js /
// gen-status-page.js) so Bull signals carry the same metadata as every other scanner instead
// of emitting sector:missing / sharia:null (validate-scan candlestick_missing_sector /
// candlestick_missing_sharia). Detection logic (pattern/score/vol-gate) is untouched — this is
// metadata attached to already-qualified candidates.
const { getSector, isHaramForHalalMode } = require('./lib/sharia-filter');

const ROOT = path.join(__dirname, '..');

// ─── CLI args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}
const hasFlag = name => args.includes(`--${name}`);

const MIN_SCORE = parseFloat(getArg('min-score', '70'));
// Default 8.0 = trading parity with systematic-tss portfolio_us_americanbulls.yaml (min_vol_ratio: 8.0).
// The 8× is measured on the SIGNAL DAY's close volume vs 20d avg (absCandleVolRatio in the Go port),
// known at scan time — NOT an intraday J+1 confirmation. Quiet days legitimately yield 0 signals.
// Override with --min-vol-ratio 1 ONLY for research/detection (equivalent to Go ab-scan-history, no filter).
const MIN_VOL_RATIO = parseFloat(getArg('min-vol-ratio', '8.0'));
// P80 daily dollar-volume liquidity floor. Faithful port of the Go americanbulls scanner, which
// applies MinP80DollarVolume ONLY when the config sets `min_p80_dollar_volume`.
// portfolio_us_americanbulls.yaml does NOT set it (it sets `min_avg_dollar_volume`, a field the
// americanbulls scanner never reads → dead config), so the Go applies NO dollar-volume filter and
// natively enters thinly-traded names (e.g. ADSE, P80 ≈ $104K, entered by the Go backtest). Default
// 0 = OFF to match that behavior; liquidity is gated upstream by the universe (min_volume /
// min_market_cap). Set a positive value to re-enable the P80 floor for research.
const MIN_P80_DOLLAR_VOLUME = parseFloat(getArg('min-p80-dollar-volume', '0'));
// Point-in-time "established liquidity" gate (survivorship / look-ahead guard) — faithful port
// of systematic-tss applyEstablishedLiquidityGate (strategy_trend.go). A candidate is tradeable
// at date D only if its MEDIAN dollar-volume over the trailing ESTABLISHED_LOOKBACK bars (≤ D,
// robust to the signal-day spike) exceeds this threshold — removing microcaps that were invisible
// at signal time and only entered the (current-mcap) universe because they grew later. This is the
// bias that produced AmericanBulls' +435% mirage. Default 0 = OFF (config-driven, defaults
// unchanged); the honest backtest sets --min-established-dollar-volume 5000000 (~$5M US).
const MIN_ESTABLISHED_DOLLAR_VOLUME = parseFloat(getArg('min-established-dollar-volume', '0'));
const ESTABLISHED_LOOKBACK = parseInt(getArg('established-lookback', '60'));
const TOP_N = parseInt(getArg('top', '30'));
const OUTPUT_MODE = getArg('output', 'stdout');
const DRY_RUN = hasFlag('dry-run');
const SCAN_DATE = getArg('date', new Date().toISOString().slice(0, 10));
const SCAN_FOLDER = getArg('folder', null); // output folder override (e.g. 20260629 when scan date is 20260626)
const REGIME = getArg('regime', null);

// ─── VOIE MCP (--ingest) — SEUL chemin data (MCP-PRIMARY) ───────────────────────────────────────
// Le scanner NE FETCH RIEN (ni Yahoo, ni cache) et NE LIT AUCUN univers local : il PARSE un staging
// JSON écrit par l'AGENT (qui, LUI, a appelé mcp__marketdata__*). --ingest est OBLIGATOIRE.
const INGEST_PATH = getArg('ingest', null);

// systematic-tss config: min mcap $300M, min volume 5M, blacklist DAWN/GLDD
const MIN_MARKET_CAP = 300_000_000;
const MIN_VOLUME = 5_000_000;
const BLACKLIST = new Set(['DAWN', 'GLDD']);

// ─── tp1/tp2/rr exit model (mirrors data/modes-config.json modes.bull) ──────
// partialTPGain=8 → the mode's REAL partial-TP trigger is +8% price gain (not a fixed
// R multiple). tp1 emitted here must match that trigger, else rr is disconnected from the
// actual exit model — same fix already applied to highvol/momentum/trendline/etf/casablanca/
// fractal scanners (commit 491de93eb, "TP1/rr honnêtes des scanners"). Bull was the one
// specialist scanner left on the synthetic entry+2R/entry+3R convention.
// disableTP2=false → bull keeps a live second target; tp2 = 2x the TP1 gain (same convention
// used by highvol/trendline: keeps tp2 > tp1 monotonically, unlike a flat entry+risk*3 which
// can invert below a small-ATR tp1 gain). rr is computed per-ticker from the REAL stop
// distance (pattern+ATR stop — untouched by this fix).
const PARTIAL_TP_GAIN_PCT = 8; // modes-config.json modes.bull.partialTPGain

// ─── Staging bars parsing (agent → mcp__marketdata__ QueryData bars_daily) ──────────────────────
// Convert a bars_daily row [date,open,high,low,close,volume] → bar object. Also accepts the object
// form {date,open,high,low,close,volume} (both are valid staging shapes). Bad rows are dropped.
function toBars(rows) {
  const bars = [];
  for (const row of (rows || [])) {
    if (Array.isArray(row)) {
      if (row.length < 5) continue;
      const [d, o, h, l, c, v] = row;
      if (o == null || h == null || l == null || c == null) continue;
      bars.push({ date: d, open: o, high: h, low: l, close: c, volume: v || 0 });
    } else if (row && typeof row === 'object') {
      const { date: d, open: o, high: h, low: l, close: c, volume: v } = row;
      if (d == null || o == null || h == null || l == null || c == null) continue;
      bars.push({ date: d, open: o, high: h, low: l, close: c, volume: v || 0 });
    }
  }
  return bars;
}

// ─── Ingest + validation du staging (mêmes règles fail-closed que factor/momentum loadStaging) ──
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
  if (!Array.isArray(data.candidates)) return { ok: false, reason: 'ingest_no_candidates_array' };
  return { ok: true, data };
}

// Build priceData Map(ticker → bars[]) from the staged candidates. Only tickers with ≥60 usable
// bars are kept (same threshold the removed Yahoo fetch enforced), BLACKLIST names are dropped.
function buildPriceData(candidates) {
  const priceData = new Map();
  let dropped = 0;
  for (const c of (candidates || [])) {
    const ticker = c && c.ticker && String(c.ticker).trim();
    if (!ticker || BLACKLIST.has(ticker)) continue;
    const bars = toBars(c.bars);
    if (bars.length >= 60) priceData.set(ticker, bars);
    else dropped++;
  }
  return { priceData, dropped };
}

function resolveSigPath() {
  const scanDir = SCAN_FOLDER || SCAN_DATE.replace(/-/g, '');
  return path.join(ROOT, 'scanner', scanDir, 'signals.json');
}

// MCP HARD STOP : marqueur d'incomplétude sans fabriquer de pool. QA lit toujours _candlestickScan
// (qa-check.js special:candlestick) ; incomplete:true + qualified:0 signale "run raté", pas "0 calme".
// No-op en dry-run / hors --output signals.
function writeIncompleteMarker(reason) {
  if (DRY_RUN || OUTPUT_MODE !== 'signals') return false;
  const sigPath = resolveSigPath();
  if (!fs.existsSync(sigPath)) {
    console.error(`❌ ${sigPath} introuvable — impossible d'écrire le marqueur d'incomplétude candlestick.`);
    return false;
  }
  const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
  signals._candlestickScan = {
    ranFor: SCAN_DATE,
    at: new Date().toISOString(),
    dataPath: 'mcp-ingest',
    universeFetched: 0,
    liquidScanned: 0,
    detectedPatterns: 0,
    qualified: 0,
    incomplete: true,
    reason,
    ingestPath: INGEST_PATH || null,
  };
  fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
  console.error(`⚠️  Marqueur _candlestickScan écrit (incomplete=true, reason="${reason}") dans ${sigPath}`);
  return true;
}

// ─── P80 dollar volume filter (exact port of calcDollarVolumePercentile) ────

function calcDollarVolumeP80(bars, lookback = 20) {
  const slice = bars.slice(-lookback);
  const dvols = slice.map(b => b.close * (b.volume || 0)).sort((a, b) => a - b);
  if (!dvols.length) return 0;
  const idx = Math.floor(dvols.length * 0.8);
  return dvols[Math.min(idx, dvols.length - 1)];
}

// Trailing MEDIAN (P50) dollar volume over `lookback` bars — the point-in-time established-liquidity
// metric. Median (not mean/P80) is robust to the single signal-day volume spike that lets a microcap
// masquerade as liquid. Mirrors calcDollarVolumePercentile(bars, lookback, 0.50) in systematic-tss.
function calcDollarVolumeMedian(bars, lookback = 60) {
  const slice = bars.slice(-lookback);
  const dvols = slice.map(b => b.close * (b.volume || 0)).sort((a, b) => a - b);
  if (!dvols.length) return 0;
  const mid = Math.floor(dvols.length / 2);
  return dvols.length % 2 ? dvols[mid] : (dvols[mid - 1] + dvols[mid]) / 2;
}

// ─── Main scan ──────────────────────────────────────────────────────────────

async function main() {
  // VOIE MCP (--ingest) : SEUL chemin data. Sans staging, on ne fabrique RIEN.
  if (!INGEST_PATH) {
    console.error('⛔ candlestick-scanner est MCP-PRIMARY : --ingest <staging.json> est OBLIGATOIRE (le fetch Yahoo/allorigins + l\'univers local ont été retirés). L\'AGENT produit le staging via mcp__marketdata__*.');
    process.exit(2);
  }
  if (OUTPUT_MODE !== 'signals' && OUTPUT_MODE !== 'stdout' && OUTPUT_MODE !== 'json') {
    console.error(`❌ --output inconnu: ${OUTPUT_MODE} (attendu: signals|stdout|json)`); process.exit(1);
  }

  const staged = loadStaging();
  if (!staged.ok) {
    console.error(`⛔ Staging candlestick indisponible/invalide (reason="${staged.reason}"). RIEN fabriqué.`);
    writeIncompleteMarker(staged.reason);
    process.exit(3);
  }
  const data = staged.data;
  const regime = REGIME || data.regime || null;
  const { priceData, dropped } = buildPriceData(data.candidates);

  console.log(`🕯️  AmericanBulls Scanner (systematic-tss port) — VOIE MCP (--ingest, MCP-PRIMARY, seul chemin data)`);
  console.log(`   Staging: ${INGEST_PATH} | tickers avec ≥60 barres: ${priceData.size} (${dropped} écartés <60) | minScore: ${MIN_SCORE} | minVolRatio: ${MIN_VOL_RATIO} | top: ${TOP_N}`);
  console.log(`   Date: ${SCAN_DATE} | Regime: ${regime || 'auto'}`);

  if (!priceData.size) {
    console.error('❌ Aucun ticker avec barres exploitables (≥60) dans le staging — run incomplet, aucun signal écrit.');
    writeIncompleteMarker('no_usable_bars');
    process.exit(3);
  }

  console.log('🔍 Scanning for candlestick patterns (25 bullish)...');
  const candidates = [];
  // Scan telemetry: distinguishes "scanner ran but 0 qualified the 8× spike" (legitimate on quiet
  // days, parity with systematic-tss) from "scanner failed/skipped" (pipeline bug). QA reads this.
  let detectedPatterns = 0;   // patterns passing score+liquidity, BEFORE the vol-spike trading gate
  let liquidScanned = 0;      // tickers passing the $1M dollar-volume filter

  const scanDateNorm = SCAN_DATE.replace(/-/g, '');
  for (const [ticker, rawBars] of priceData) {
    if (BLACKLIST.has(ticker)) continue;

    // Slice bars up to SCAN_DATE so detectPattern works on the target date, not the latest bar
    const cutIdx = rawBars.findIndex(b => b.date.replace(/-/g, '') > scanDateNorm);
    const bars = cutIdx > 0 ? rawBars.slice(0, cutIdx) : rawBars;

    // P80 dollar volume filter — conditional, matching the Go americanbulls scanner (only applied
    // when a threshold is configured). Off by default for this config (see MIN_P80_DOLLAR_VOLUME).
    if (MIN_P80_DOLLAR_VOLUME > 0) {
      const dvP80 = calcDollarVolumeP80(bars);
      if (dvP80 < MIN_P80_DOLLAR_VOLUME) continue;
    }
    // Point-in-time established-liquidity gate (survivorship / look-ahead guard). `bars` is already
    // sliced to ≤ SCAN_DATE above, so the median is computed only on history known at signal time.
    // Insufficient trailing history → ineligible (liquidity can't be established point-in-time).
    if (MIN_ESTABLISHED_DOLLAR_VOLUME > 0) {
      if (bars.length < ESTABLISHED_LOOKBACK) continue;
      if (calcDollarVolumeMedian(bars, ESTABLISHED_LOOKBACK) < MIN_ESTABLISHED_DOLLAR_VOLUME) continue;
    }
    liquidScanned++;

    const result = detectPattern(bars, regime);
    if (!result) continue;

    // Min score filter
    if (result.totalScore < MIN_SCORE) continue;
    detectedPatterns++; // qualified pattern + score, before the vol-spike trading gate

    // Min vol ratio filter (8× per config)
    if (result.volRatio < MIN_VOL_RATIO) continue;

    const idx = bars.length - 1;
    const c0 = bars[idx];
    const risk = result.entry - result.stop;
    if (risk <= 0) continue;

    // tp1 = the real partial-TP trigger level (entry × (1 + partialTPGain/100)), not entry+2R.
    // tp2 = 2x that gain (disableTP2=false → bull has a live second target).
    // rr computed from tp1 vs THIS ticker's actual (pattern+ATR) stop distance — varies per signal.
    const tp1 = +(result.entry * (1 + PARTIAL_TP_GAIN_PCT / 100)).toFixed(2);
    const tp2 = +(result.entry * (1 + (PARTIAL_TP_GAIN_PCT * 2) / 100)).toFixed(2);
    const rr = ((tp1 - result.entry) / risk).toFixed(2);

    // Sector: shared SECTOR_MAP (tools/lib/sharia-filter.js), same source gen-status-page.js
    // uses for the Fortress Halal gate. getSector() falls back to 'Other' for unmapped tickers —
    // that fallback is not a real classification, so we surface it as 'Unknown' here and log it
    // (no new network call; a real per-ticker sector fetch would require a Yahoo/StockAnalysis
    // quote call, which is out of scope for this metadata-only fix).
    const rawSector = getSector(ticker);
    const sectorMapped = rawSector !== 'Other';
    const sector = sectorMapped ? rawSector : 'Unknown';
    if (!sectorMapped) process.stderr.write(`  ⚠️  ${ticker}: sector unmapped in SECTOR_MAP — emitting sector:"Unknown"\n`);

    // Sharia: reuse the shared haram-exclusion logic (SHARIA_EXCLUDED tickers + HARAM_SECTORS).
    // Conservative default — a ticker with NO sector mapping (can't be classified either way)
    // is emitted sharia:false rather than true, so an unclassified name is never presented as
    // halal. isHaramForHalalMode() already returns true for explicit haram tickers/sectors
    // regardless of mapping, so this only affects the "genuinely unmapped" case.
    const haram = isHaramForHalalMode({ ticker });
    const sharia = !haram && sectorMapped;
    if (!sectorMapped) process.stderr.write(`  ⚠️  ${ticker}: no Sharia classification data — emitting sharia:false (conservative default)\n`);

    candidates.push({
      ticker,
      score: result.totalScore,
      sector,
      sharia,
      strategy: 'Candlestick',
      pattern: {
        name: result.pattern,
        baseScore: result.baseScore,
        strength: +(result.totalScore / 150).toFixed(2),
        confirmed: true,
        volumeSpike: result.volRatio >= 2.0,
        volRatio: +result.volRatio.toFixed(1),
        invalidation: result.stop,
        patternTarget: tp1,
      },
      entry: +result.entry.toFixed(2),
      stop: +result.stop.toFixed(2),
      tp1, tp2,
      rr: `1:${rr}`,
      extension: {
        rsi: +result.rsi.toFixed(1),
        atr: +result.atr.toFixed(2),
        distance_50dma_pct: result.ma50 > 0 ? +((c0.close - result.ma50) / result.ma50 * 100).toFixed(1) : 0,
      },
      metrics: {
        atrPct: +(result.atrPct * 100).toFixed(2),
        volRatio: +result.volRatio.toFixed(1),
        mom5: +(result.mom5 * 100).toFixed(2),
        distMA20: +(result.distMA20 * 100).toFixed(2),
        bbPctB: +result.bbPctB.toFixed(3),
      },
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  const topCandidates = candidates.slice(0, TOP_N);

  console.log(`\n✅ Found ${candidates.length} signals (passed all filters), top ${topCandidates.length}:`);
  for (const c of topCandidates) {
    const vol = c.metrics.volRatio >= 8 ? '📊' : c.metrics.volRatio >= 2 ? '📈' : '  ';
    console.log(`  ${vol} ${c.ticker.padEnd(6)} score:${String(c.score).padStart(3)} ${c.pattern.name.padEnd(26)} E:${c.entry} S:${c.stop} TP1:${c.tp1} RR:${c.rr} vol:${c.metrics.volRatio}x`);
  }

  if (DRY_RUN) { console.log('\n🏷️  Dry run — no files written.'); return topCandidates; }

  if (OUTPUT_MODE === 'json') {
    const outPath = path.join(ROOT, 'data', `candlestick-scan-${SCAN_DATE}.json`);
    fs.writeFileSync(outPath, JSON.stringify({ scanDate: SCAN_DATE, regime, dataPath: 'mcp-ingest', candidates: topCandidates }, null, 2));
    console.log(`\n📁 Written to ${outPath}`);
  } else if (OUTPUT_MODE === 'signals') {
    const scanDir = SCAN_FOLDER || SCAN_DATE.replace(/-/g, '');
    const sigPath = path.join(ROOT, 'scanner', scanDir, 'signals.json');
    if (!fs.existsSync(sigPath)) { console.error(`❌ ${sigPath} not found`); process.exit(1); }
    const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
    const existing = new Set((signals.signals || []).map(s => s.ticker));
    let added = 0;
    for (const c of topCandidates) {
      if (existing.has(c.ticker)) continue;
      signals.signals.push({
        ticker: c.ticker, name: c.ticker, score: c.score, strategy: 'Candlestick',
        entry: c.entry, stop: c.stop, tp1: c.tp1, tp2: c.tp2, rr: c.rr,
        horizon: 10, region: 'US', sector: c.sector, sharia: c.sharia,
        thesis: `${c.pattern.name} pattern (base ${c.pattern.baseScore}) with ${c.metrics.volRatio}x volume spike. ATR% ${c.metrics.atrPct}%, RSI ${c.extension.rsi}, BB%B ${c.metrics.bbPctB}.`,
        extension: c.extension, pattern: c.pattern,
        earnings_clear: true, dilution_clear: true,
        dataPath: 'mcp-ingest',
      });
      existing.add(c.ticker);
      added++;
    }
    // Scan marker — proof the candlestick scanner actually ran (even with 0 qualified signals).
    // QA distinguishes "ran, 0 qualified the 8× spike" (OK, quiet day) from "never ran" (pipeline bug).
    signals._candlestickScan = {
      ranFor: SCAN_DATE,
      at: new Date().toISOString(),
      dataPath: 'mcp-ingest',
      universeFetched: priceData.size,
      liquidScanned,
      detectedPatterns,            // passed score+liquidity, before vol-spike gate
      qualified: topCandidates.length, // passed the full 8× trading gate
      volThreshold: MIN_VOL_RATIO,
      minScore: MIN_SCORE,
      incomplete: false,
    };
    fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
    console.log(`\n📁 Appended ${added} candlestick signals to ${sigPath} (scanned ${liquidScanned} liquid, ${detectedPatterns} patterns, ${topCandidates.length} qualified 8× spike)`);
  }

  return topCandidates;
}

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}

module.exports = { main };
