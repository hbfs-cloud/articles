#!/usr/bin/env node
'use strict';

/**
 * highvol-scanner.js — HighVol Breakout Scanner (exact port of systematic-tss)
 *
 * Cluster-based high-volatility breakout scanner.
 * Key filters: ATR 7-10% sweet spot, DistMA20 ≥ 5%, VolRatio ≥ 1.5,
 * VIX regime gating (cluster V11-V13), Bollinger Band %B.
 *
 * Usage:
 *   node tools/highvol-scanner.js --dry-run
 *   node tools/highvol-scanner.js --output signals --folder 20260629
 *   node tools/highvol-scanner.js --min-score 50 --top 20
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const {
  calcSMA, calcRSI, calcATR, calcVolatility, calcMomentum,
  calcAvgVolume, calcMedianVolume, calcDollarVolumePercentile, calcStochastic,
} = require('./lib/fractal-indicators');
const priceCache = require('./lib/price-cache'); // cache prix DATÉ partagé (source unique de vérité)

const ROOT = path.join(__dirname, '..');
// Marché/interval de ce scanner (US equities, daily). La date de cache = SCAN_DATE (jour de scan),
// jamais aujourd'hui par défaut : le helper gèle un snapshot point-in-time par date (anti-pollution).
const CACHE_MARKET = 'US';
const CACHE_INTERVAL = '1d';

const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}
const hasFlag = name => args.includes(`--${name}`);

const MIN_SCORE = parseFloat(getArg('min-score', '50'));
const TOP_N = parseInt(getArg('top', '20'));
const OUTPUT_MODE = getArg('output', 'stdout');
const DRY_RUN = hasFlag('dry-run');
const SCAN_DATE = getArg('date', new Date().toISOString().slice(0, 10));
const SCAN_FOLDER = getArg('folder', null);
const REGIME = getArg('regime', null);
const CONCURRENCY = parseInt(getArg('concurrency', '10'));

// ─── tp1/tp2/rr exit model (mirrors data/modes-config.json modes.highvol) ───
// partialTPGain=30 → the mode's REAL partial-TP trigger is +30% price gain (not a fixed
// R multiple). tp1 emitted here must match that trigger, else rr is disconnected from the
// actual exit model (audit finding: all specialist rows showed a uniform hardcoded "R/R 2.0").
// disableTP2=false → highvol keeps a live second target; tp2 = 2x the TP1 gain (convention
// also used by trendline; keeps tp2 > tp1 monotonically, unlike a flat entry+risk*3 which can
// invert below a small-ATR tp1 gain). rr is computed per-ticker from the REAL stop distance.
const PARTIAL_TP_GAIN_PCT = 30; // modes-config.json modes.highvol.partialTPGain

// ─── Parity constants (mirror config/portfolio_us_highvol.yaml scanner_filters) ──
// systematic-tss us_highvol allocation: strategy=highvol-breakout-corr.
// These MUST match the Go ScannerFilterConfig so JS produces the same BUY entries.
const MIN_P80_DOLLAR_VOLUME = 5_000_000;   // scanner_filters.min_p80_dollar_volume ($5M, not $100K)
// Point-in-time established-liquidity gate (survivorship / look-ahead guard) — MEDIAN dollar
// volume over the trailing window (robust to the signal-day spike, unlike the P80 above) must
// exceed the threshold. Mirrors systematic-tss applyEstablishedLiquidityGate. Default = the
// CURRENT Go value for this strategy: portfolio_us_highvol.yaml min_established_dollar_volume
// = 3_000_000 (synced 2026-07-03 — the Go configs evolved; other strategies differ: portfolio_us
// $5M, de_highvol $2M). Each re-ported mode should pass its own --min-established-dollar-volume.
const MIN_ESTABLISHED_DOLLAR_VOLUME = parseFloat(getArg('min-established-dollar-volume', '3000000'));
const ESTABLISHED_LOOKBACK = parseInt(getArg('established-lookback', '60'));
const MAX_RSI = 85;                        // scanner_filters.max_rsi (Go rejects rsi > 85)
const MAX_VOLATILITY_INDEX = 28;           // scanner_filters.max_volatility_index (VIX > 28 => no scan)
// Allocation-level blacklist (toxic serial losers). In Go these symbols are excluded
// from the universe (cmd/backtest/main.go). Applied here as a pre-scan skip.
const BLACKLIST = new Set([
  'SKYT', 'ALAB', 'RERE', 'QBTS', 'ATAI', 'DQ', 'NTLA', 'LCID', 'TE',
  'IBRX', 'KOD', 'AUR', 'RXRX', 'TERN', 'NVAX', 'ASTS', 'DAWN', 'GLDD',
]);
// scanner_filters.excluded_sectors + allocation min_market_cap=$1B, appliqués en Go au niveau
// universe/secmaster. Le metadata secteur/mcap est maintenant dispo via data/ticker-metadata.json
// (port stockanalysis, tools/lib/stockanalysis-fetcher.js) → on applique les filtres nativement.
const EXCLUDED_SECTORS = new Set(['Real Estate', 'Utilities', 'Materials', 'Communication Services']);
const MIN_MARKET_CAP = 1_000_000_000; // allocation min_market_cap = $1B
let TICKER_META = {};
try { TICKER_META = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'ticker-metadata.json'), 'utf8')); } catch (_) { /* metadata absent → filtre secteur/mcap OFF (fail-open) */ }
// ISO-parity source de vérité pour secteur/mcap = LE MÊME snapshot gelé que Go lit pour bâtir
// l'univers US : systematic-tss cache/stockanalysis/stock/US/tickers-frozen.json (copie versionnée
// ici dans data/tickers-frozen.json — valeurs identiques). Go itère cet univers et rejette
// stock.MarketCap < min_market_cap ($1B) + excluded_sectors. Le ticker-metadata.json (fetch
// stockanalysis live) a dérivé : mcaps gonflés pour des noms limites (INDI 1.02B vs 580M réel,
// SLS 2.75B vs 889M, VPG 1.99B vs 567M) → le port JS fabriquait INDI/SLS/VPG que Go exclut sous
// le plancher $1B. On lit le frozen en PRIORITÉ (= exactement ce que Go filtre) et on retombe sur
// ticker-metadata seulement si le ticker est absent du frozen (fail-open préservé, jamais de goOnly
// nouveau car les picks Go proviennent tous du frozen).
let FROZEN_META = {};
try {
  const fz = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'tickers-frozen.json'), 'utf8'));
  FROZEN_META = (fz && fz.data && fz.data.data) ? fz.data.data : (fz.Data && fz.Data.Data ? fz.Data.Data : {});
} catch (_) { /* frozen absent → fallback ticker-metadata seul (comportement antérieur) */ }
// Rejette un ticker si son secteur est exclu OU mcap < $1B. Frozen (Go-authoritative) d'abord,
// puis ticker-metadata en fallback, puis fail-open si les deux sont muets (inconnu = gardé).
function passesSectorMcap(ticker) {
  const m = FROZEN_META[ticker] || TICKER_META[ticker];
  if (!m) return true; // metadata inconnue → ne pas rejeter (fail-open, comportement offline antérieur)
  if (m.sector && EXCLUDED_SECTORS.has(m.sector)) return false;
  if (m.marketCap && m.marketCap > 0 && m.marketCap < MIN_MARKET_CAP) return false;
  return true;
}

// ─── Universe loader ────────────────────────────────────────────────────────

function loadUniverse() {
  const fp = path.join(ROOT, 'data', 'americanbull-universe.json');
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  return data.tickers || [];
}

// ─── Yahoo OHLCV fetcher (shared cache with fractal/candlestick) ────────────

const MIN_BARS = 200;

function readCache(ticker) {
  // Décision de fetch : on ne lit QUE le snapshot daté pour SCAN_DATE (immuable si date passée ;
  // TTL 12h si SCAN_DATE == aujourd'hui). PAS de fallback legacy ici — un snapshot absent DOIT
  // déclencher un fetch live puis writeBars daté, garantissant « TOUJOURS écrire en daté » (migration
  // hors des vieux fichiers plats + pas de service de données figées legacy sans TTL). Canonique =
  // candlestick-scanner.js. (Le fallback legacy lecture-seule reste dispo pour les chemins cache-only.)
  const bars = priceCache.readBars(ticker, { date: SCAN_DATE, market: CACHE_MARKET, interval: CACHE_INTERVAL, allowLegacyFallback: false });
  if (bars && bars.length >= MIN_BARS) return bars;
  return null;
}

function fetchOHLCV(ticker) {
  return new Promise((resolve) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=2y&interval=1d`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (!j.chart?.result?.[0]) return resolve(null);
          const q = j.chart.result[0];
          const ts = q.timestamp || [];
          const ind = q.indicators?.quote?.[0];
          const adj = q.indicators?.adjclose?.[0]?.adjclose;
          if (!ind || !ts.length) return resolve(null);
          const bars = [];
          for (let i = 0; i < ts.length; i++) {
            const o = ind.open?.[i], h = ind.high?.[i], l = ind.low?.[i], c2 = ind.close?.[i], v = ind.volume?.[i];
            if (o == null || c2 == null) continue;
            bars.push({
              date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
              open: o, high: h || o, low: l || o, close: c2,
              adjClose: adj?.[i] || c2, volume: v || 0,
            });
          }
          if (bars.length >= MIN_BARS) {
            // Écriture DATÉE : le helper tronque à bar.date <= SCAN_DATE (anti-look-ahead) puis mkdir -p.
            // Forward (SCAN_DATE == aujourd'hui) → troncature no-op → zéro régression.
            priceCache.writeBars(ticker, bars, { date: SCAN_DATE, market: CACHE_MARKET, interval: CACHE_INTERVAL });
          }
          resolve(bars.length >= MIN_BARS ? bars : null);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null)).on('timeout', function () { this.destroy(); resolve(null); });
  });
}

async function batchFetch(tickers, concurrency) {
  const result = new Map();
  const queue = [...tickers];
  let done = 0, cached = 0;
  async function worker() {
    while (queue.length) {
      const t = queue.shift();
      let bars = readCache(t);
      if (bars) { cached++; } else { bars = await fetchOHLCV(t); }
      if (bars) result.set(t, bars);
      done++;
      if (done % 100 === 0) process.stderr.write(`  fetched ${done}/${tickers.length} (${result.size} valid, ${cached} cached)\r`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  process.stderr.write(`  fetched ${done}/${tickers.length} (${result.size} valid, ${cached} cached)\n`);
  return result;
}

// ─── StdDev for Bollinger Bands ──────────────────────────────────────────────

function calcStdDev(bars, period) {
  const n = bars.length;
  if (n < period) return 0;
  let sum = 0;
  for (let i = n - period; i < n; i++) sum += bars[i].close;
  const mean = sum / period;
  let sumSq = 0;
  for (let i = n - period; i < n; i++) sumSq += (bars[i].close - mean) ** 2;
  return Math.sqrt(sumSq / period);
}

// ─── VIX data ────────────────────────────────────────────────────────────────

async function fetchVIX() {
  const vixBars = readCache('^VIX');
  if (vixBars) return vixBars;
  return await fetchOHLCV('^VIX');
}

// ─── HighVol Breakout Scoring (exact port of scanner_highvol.go) ────────────

function scoreSymbol(bars, regime, vixLevel, vixTrend) {
  const n = bars.length;
  if (n < 200) return null;
  const price = bars[n - 1].close;
  if (price < 1.0) return null;

  const atr = calcATR(bars, 14);
  const atrPct = atr / price;
  const ma200 = calcSMA(bars, 200);
  const ma20 = calcSMA(bars, 20);
  const ma50 = calcSMA(bars, 50);
  const rsi = calcRSI(bars, 14);
  const volatility = calcVolatility(bars, 20);
  const mom120 = calcMomentum(bars, 120);
  const avgVol20 = calcAvgVolume(bars, 20);

  let volRatio = 1.0;
  if (avgVol20 > 0) volRatio = (bars[n - 1].volume || 0) / avgVol20;

  const distMA20 = ma20 > 0 ? (price - ma20) / ma20 : 0;
  const distMA200 = ma200 > 0 ? (price - ma200) / ma200 : 0;

  // BBPctB
  let bbPctB = 0.5;
  if (n >= 20) {
    const stdDev = calcStdDev(bars, 20);
    const upper = ma20 + 2.0 * stdDev;
    const lower = ma20 - 2.0 * stdDev;
    if (upper > lower) bbPctB = (price - lower) / (upper - lower);
  }

  // FILTER 1: Base filters
  if (price <= ma200) return null;
  if (rsi >= 90) return null;

  // Blowoff top filter
  if (rsi > 85 && distMA20 > 0.20) return null;

  // Volume minimum
  if ((bars[n - 1].volume || 0) < 1000) return null;

  // FILTER 2: ATR sweet spot (7-10%)
  if (atrPct < 0.07) return null;
  let maxATRPct = 0.10;
  if (vixLevel >= 22) maxATRPct = 0.15;
  if (atrPct > maxATRPct) return null;

  // RECOVERY + ATR >= 10% = TOXIC
  if (regime && regime.toUpperCase().includes('RECOVERY') && atrPct >= 0.10) return null;

  // FILTER 3: Breakout confirmed (DistMA20 ≥ 5%)
  if (distMA20 < 0.05) return null;
  if (distMA20 > 1.0) return null;

  // FILTER 4: Volume confirmation (VolRatio ≥ 1.5)
  let minVolRatio = 1.5;
  if (regime && regime.toUpperCase().includes('RECOVERY') && vixLevel >= 22) minVolRatio = 1.0;
  if (volRatio < minVolRatio) return null;

  // Max RSI filter (scanner_filters.max_rsi = 85) — Go rejects rsi > 85
  if (rsi > MAX_RSI) return null;

  // SCORING V9
  let score = 50.0;

  // VIX context bonus
  if (vixLevel >= 30) {
    score += vixTrend === 'rising' ? 40 : 25;
  } else if (vixLevel >= 22) {
    score += 20;
  }

  // ATR scoring
  if (atrPct < 0.05) score += 15;
  else if (atrPct < 0.07) score += 10;
  else if (atrPct < 0.08) score += 5;

  // Breakout strength (VIX-context aware)
  if (vixLevel >= 30) {
    if (distMA20 >= 0.05 && distMA20 < 0.10) score += 25;
    else if (distMA20 >= 0.10 && distMA20 < 0.15) score += 20;
    else if (distMA20 >= 0.15) score += 5;
  } else {
    if (distMA20 >= 0.15) score += 20;
    else if (distMA20 >= 0.10) score += 15;
    else if (distMA20 >= 0.05) score += 10;
  }

  // BBPctB
  if (bbPctB >= 1.1) score += 10;

  // Strong uptrend (DistMA200)
  if (distMA200 >= 0.50) score += 15;
  else if (distMA200 >= 0.30) score += 10;
  else if (distMA200 >= 0.20) score += 5;

  // Trend structure
  if (price > ma20 && ma20 > ma50 && ma50 > ma200) score += 10;

  // Volume confirmation
  if (volRatio >= 3.0) score += 15;
  else if (volRatio >= 2.0) score += 10;
  else if (volRatio >= 1.5) score += 5;

  // Momentum bonus
  if (mom120 > 0.30) score += 10;
  else if (mom120 > 0.15) score += 5;

  if (score < MIN_SCORE) return null;

  // Regime adjustment
  if (regime) {
    const r = regime.toUpperCase().replace(/[- ]/g, '_');
    if (r.includes('RISK_ON')) score *= 1.10;
    else if (r.includes('RECOVERY')) score *= 0.95;
    else if (r.includes('EARLY_RISK_OFF')) score *= 0.90;
  }

  const distMA50 = ma50 > 0 ? (price - ma50) / ma50 : 0;

  return {
    score: +score.toFixed(2), price, entry: price,
    stop: +(price - atr * 2.5).toFixed(4),
    atr, atrPct, rsi, volatility, mom120, volRatio: +volRatio.toFixed(2),
    distMA20: +distMA20.toFixed(4), distMA50: +distMA50.toFixed(4), distMA200: +distMA200.toFixed(4),
    bbPctB: +bbPctB.toFixed(3),
    sma20: ma20, sma50: ma50, sma200: ma200,
    strategy: 'highvol-breakout',
  };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const universe = loadUniverse();
  console.log(`⚡ HighVol Breakout Scanner (systematic-tss port)`);
  console.log(`   Universe: ${universe.length} tickers | minScore: ${MIN_SCORE} | top: ${TOP_N}`);
  console.log(`   Date: ${SCAN_DATE} | Regime: ${REGIME || 'auto'}`);

  // Fetch VIX first
  console.log(`📡 Fetching VIX data...`);
  const vixBars = await fetchVIX();
  let vixLevel = 0, vixTrend = 'stable';
  if (vixBars && vixBars.length >= 14) {
    const vn = vixBars.length;
    vixLevel = vixBars[vn - 1].close;
    const vixSma14 = calcSMA(vixBars, 14);
    if (vixSma14 > 0) {
      const ratio = vixLevel / vixSma14;
      if (ratio < 0.90) vixTrend = 'falling';
      else if (ratio > 1.10) vixTrend = 'rising';
    }
    console.log(`   VIX: ${vixLevel.toFixed(1)} (${vixTrend}, SMA14: ${vixSma14?.toFixed(1)})`);
  } else {
    console.log(`   ⚠️ No VIX data — cluster filters disabled`);
  }

  // VIX cluster gate (V11-V13)
  const regimeStr = REGIME || '';
  const regimeUp = regimeStr.toUpperCase().replace(/[- ]/g, '_');

  // Authentic 0-signal exit: write the _scanRuns.highvol marker BEFORE early-returning so the
  // "scanner actually ran" proof is scanner-authored (never hand-fabricated downstream). qa-check
  // requires a marker per scripted mode; a legitimate 0-signal day (TOXIC VIX cluster / RISK_OFF)
  // must still emit one. Idempotent: overwrites the highvol key on re-run without touching others.
  const earlyExit = (note) => {
    console.log(`\n❌ ${note}`);
    if (OUTPUT_MODE === 'signals') {
      const scanDir = SCAN_FOLDER || SCAN_DATE.replace(/-/g, '');
      const sigPath = path.join(ROOT, 'scanner', scanDir, 'signals.json');
      if (fs.existsSync(sigPath)) {
        const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
        if (!signals._scanRuns) signals._scanRuns = {};
        signals._scanRuns.highvol = { at: new Date().toISOString(), universe: 'americanbull', candidates: 0, signals: 0, added: 0, note };
        fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
        console.log(`📁 Wrote highvol 0-signal marker to ${sigPath}`);
      }
    }
    return [];
  };

  // RISK_OFF = no new positions
  if (regimeUp === 'RISK_OFF') {
    return earlyExit('Regime RISK_OFF — no new positions.');
  }

  // Max volatility index (scanner_filters.max_volatility_index = 28): VIX above cap => no scan
  if (vixLevel > MAX_VOLATILITY_INDEX) {
    return earlyExit(`VIX ${vixLevel.toFixed(1)} > ${MAX_VOLATILITY_INDEX} (max_volatility_index) — no signals.`);
  }

  // VIX 18-22 + not stable = toxic
  if (vixLevel >= 18 && vixLevel < 22 && vixTrend !== 'stable') {
    return earlyExit(`VIX ${vixLevel.toFixed(1)} (18-22) + ${vixTrend} = TOXIC cluster, no signals.`);
  }
  // VIX 15-18 + falling = toxic
  if (vixLevel >= 15 && vixLevel < 18 && vixTrend === 'falling') {
    return earlyExit(`VIX ${vixLevel.toFixed(1)} (15-18) + falling = TOXIC cluster, no signals.`);
  }
  // VIX < 15 + rising = toxic
  if (vixLevel > 0 && vixLevel < 15 && vixTrend === 'rising') {
    return earlyExit(`VIX ${vixLevel.toFixed(1)} (<15) + rising = TOXIC cluster, no signals.`);
  }
  // VIX 22-30 + falling = toxic
  if (vixLevel >= 22 && vixLevel < 30 && vixTrend === 'falling') {
    return earlyExit(`VIX ${vixLevel.toFixed(1)} (22-30) + falling = TOXIC cluster, no signals.`);
  }
  // RECOVERY + VIX 18-22 = toxic
  if (regimeUp.includes('RECOVERY') && vixLevel >= 18 && vixLevel < 22) {
    return earlyExit(`RECOVERY + VIX ${vixLevel.toFixed(1)} (18-22) = TOXIC cluster, no signals.`);
  }

  console.log(`📡 Fetching OHLCV data via Yahoo...`);
  const priceData = await batchFetch(universe, CONCURRENCY);
  if (!priceData.size) { console.error('❌ No OHLCV data — aborting.'); process.exit(1); }

  console.log('🔍 Scoring candidates (highvol breakout filters)...');
  const candidates = [];
  const scanDateNorm = SCAN_DATE.replace(/-/g, '');

  for (const [ticker, rawBars] of priceData) {
    if (BLACKLIST.has(ticker)) continue; // allocation blacklist (toxic serial losers)
    if (!passesSectorMcap(ticker)) continue; // excluded_sectors + min_market_cap $1B (metadata stockanalysis)
    const cutIdx = rawBars.findIndex(b => b.date.replace(/-/g, '') > scanDateNorm);
    const bars = cutIdx > 0 ? rawBars.slice(0, cutIdx) : rawBars;

    const dvP80 = calcDollarVolumePercentile(bars, 20, 0.80);
    if (dvP80 < MIN_P80_DOLLAR_VOLUME) continue;
    // Established-liquidity gate (point-in-time; `bars` already ≤ scanDate). Median over the
    // trailing window, robust to the signal-day spike. Insufficient history → ineligible.
    if (MIN_ESTABLISHED_DOLLAR_VOLUME > 0) {
      if (bars.length < ESTABLISHED_LOOKBACK) continue;
      if (calcDollarVolumePercentile(bars, ESTABLISHED_LOOKBACK, 0.50) < MIN_ESTABLISHED_DOLLAR_VOLUME) continue;
    }

    const result = scoreSymbol(bars, REGIME, vixLevel, vixTrend);
    if (!result) continue;

    const risk = result.entry - result.stop;
    if (risk <= 0) continue;

    // tp1 = the real partial-TP trigger level (entry × (1 + partialTPGain/100)), not entry+2R.
    // tp2 = 2x that gain (disableTP2=false → highvol has a live second target).
    // rr computed from tp1 vs THIS ticker's actual stop distance — varies per signal.
    const tp1 = +(result.entry * (1 + PARTIAL_TP_GAIN_PCT / 100)).toFixed(2);
    const tp2 = +(result.entry * (1 + (PARTIAL_TP_GAIN_PCT * 2) / 100)).toFixed(2);
    const rr = +((tp1 - result.entry) / risk).toFixed(2);

    candidates.push({
      ticker, score: result.score,
      entry: +result.entry.toFixed(2), stop: +result.stop.toFixed(2), tp1, tp2,
      rr: `1:${rr.toFixed(2)}`, metrics: result,
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  const topCandidates = candidates.slice(0, TOP_N);

  console.log(`\n✅ Found ${candidates.length} signals (passed all filters), top ${topCandidates.length}:`);
  for (const c of topCandidates) {
    const icon = c.score >= 100 ? '🔥' : c.score >= 70 ? '⚡' : '  ';
    console.log(`  ${icon} ${c.ticker.padEnd(8)} score:${String(c.score).padStart(6)} ATR%:${(c.metrics.atrPct * 100).toFixed(1)}% DistMA20:${(c.metrics.distMA20 * 100).toFixed(1)}% VolR:${c.metrics.volRatio.toFixed(1)} RSI:${c.metrics.rsi.toFixed(0)}`);
  }

  if (DRY_RUN) { console.log('\n🏷️  Dry run — no files written.'); return topCandidates; }

  if (OUTPUT_MODE === 'json') {
    const outPath = path.join(ROOT, 'data', `highvol-scan-${SCAN_DATE}.json`);
    fs.writeFileSync(outPath, JSON.stringify({ scanDate: SCAN_DATE, regime: REGIME, vix: { level: vixLevel, trend: vixTrend }, candidates: topCandidates }, null, 2));
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
        ticker: c.ticker, name: c.ticker, score: c.score, strategy: 'HighVolBreakout',
        entry: c.entry, stop: c.stop, tp1: c.tp1, tp2: c.tp2, rr: c.rr,
        horizon: 21, region: 'US', universe: 'americanbull',
        sharia: null,
        thesis: `HV score ${c.score}: ATR%=${(c.metrics.atrPct * 100).toFixed(1)}%, DistMA20=${(c.metrics.distMA20 * 100).toFixed(1)}%, VolR=${c.metrics.volRatio}, RSI=${c.metrics.rsi.toFixed(0)}`,
        extension: { atrPct: +c.metrics.atrPct.toFixed(4), bbPctB: c.metrics.bbPctB },
      });
      existing.add(c.ticker);
      added++;
    }
    // Scan marker — proof the highvol scanner actually ran (even with 0 signals, which is legitimate).
    // Merged into the shared _scanRuns object (keyed scanner[:universe]) without clobbering other scanners.
    if (!signals._scanRuns) signals._scanRuns = {};
    signals._scanRuns.highvol = {
      at: new Date().toISOString(),
      universe: 'americanbull',
      candidates: candidates.length,
      signals: topCandidates.length,
      added,
    };
    fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
    console.log(`\n📁 Appended ${added} highvol signals to ${sigPath}`);
  }

  return topCandidates;
}

// ─── Module exports (for tools/pit-backfill.js — reuse EXACT scoring for PIT parity) ──
// Backward-compatible: CLI behavior unchanged when run directly; main() only fires as entrypoint.
module.exports = {
  scoreSymbol, calcStdDev, loadUniverse, passesSectorMcap,
  BLACKLIST,
  MIN_P80_DOLLAR_VOLUME, MIN_ESTABLISHED_DOLLAR_VOLUME, ESTABLISHED_LOOKBACK,
  PARTIAL_TP_GAIN_PCT, MAX_VOLATILITY_INDEX,
};

if (require.main === module) {
  main().catch(e => { console.error('❌', e.message); process.exit(1); });
}
