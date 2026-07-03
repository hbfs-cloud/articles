#!/usr/bin/env node
'use strict';

/**
 * fractal-scanner.js — Adaptive Fractal Scanner (exact port of systematic-tss)
 *
 * Multi-factor momentum/quality scanner: SMA alignment, RSI, momentum 10/60/120d,
 * volatility, quality score, regime-aware sizing. Works on any asset class.
 *
 * Usage:
 *   node tools/fractal-scanner.js --universe americanbull          # US equities (default)
 *   node tools/fractal-scanner.js --universe crypto                # Crypto
 *   node tools/fractal-scanner.js --universe metals                # Metals & mining
 *   node tools/fractal-scanner.js --universe forex                 # Forex
 *   node tools/fractal-scanner.js --universe casablanca            # Casablanca exchange
 *   node tools/fractal-scanner.js --tickers AAPL,MSFT --dry-run   # Custom tickers
 *   node tools/fractal-scanner.js --output signals --folder 20260629
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const {
  calcSMA, calcRSI, calcATR, calcVolatility, calcMomentum,
  calcAvgVolume, calcMedianVolume, calcDollarVolumePercentile, calcStochastic,
} = require('./lib/fractal-indicators');

const ROOT = path.join(__dirname, '..');
const CACHE_DIR = path.join(ROOT, 'data', '.price-cache');

const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}
const hasFlag = name => args.includes(`--${name}`);

const UNIVERSE_NAME = getArg('universe', 'americanbull');
const CUSTOM_TICKERS = getArg('tickers', '').split(',').filter(Boolean);
const MIN_SCORE = parseFloat(getArg('min-score', '35'));
const TOP_N = parseInt(getArg('top', '30'));
const OUTPUT_MODE = getArg('output', 'stdout');
const DRY_RUN = hasFlag('dry-run');
const SCAN_DATE = getArg('date', new Date().toISOString().slice(0, 10));
const SCAN_FOLDER = getArg('folder', null);
const STRATEGY_TAG = getArg('strategy', 'AdaptiveFractal');
const REGIME = getArg('regime', null);
const CONCURRENCY = parseInt(getArg('concurrency', '10'));
const SOURCE = getArg('source', 'yahoo').toLowerCase();

// Point-in-time established-liquidity gate (survivorship / look-ahead guard) — MEDIAN dollar
// volume over ESTABLISHED_LOOKBACK bars ≤ scanDate must exceed the threshold. Robust to the
// signal-day spike (unlike P80). OFF by default (0); each re-ported mode passes its own Go value
// via --min-established-dollar-volume (portfolio_us hybrid = $5M, established_lookback_days=60).
const MIN_ESTABLISHED_DOLLAR_VOLUME = parseFloat(getArg('min-established-dollar-volume', '0'));
const ESTABLISHED_LOOKBACK = parseInt(getArg('established-lookback', '60'));

// ─── tp1/tp2/rr exit model (mirrors data/modes-config.json per assetClass) ───
// Each pool has its own partialTPGain — the mode's REAL partial-TP trigger (% price gain),
// not a fixed R multiple. tp1 = entry × (1 + gain/100); tp2 = 2x that gain (informational for
// disableTP2=true pools — sweep.js gates the real TP2 check on cfg.disableTP2 independently).
// rr computed per-ticker from the actual stop distance, replacing the previous hardcoded
// '1:2.0' (audit finding: uniform R/R disconnected from each signal's real risk).
// crypto/metals/forex are "stopped" modes (data/modes-config.json) but keep parity values for
// when/if reactivated. americanbull/etf/tkl have no dedicated top-level mode entry for the
// fractal (AdaptiveFractal) strategy — fall back to the majority convention (10% gain,
// TP2 disabled) shared by momentum/etf/casablanca/metals/forex.
const ASSET_TP_GAIN_PCT = {
  crypto: 12,       // modes-config.json modes.crypto.partialTPGain (status: stopped)
  metals: 10,       // modes-config.json modes.metals.partialTPGain (status: stopped)
  forex: 10,        // modes-config.json modes.forex.partialTPGain (status: stopped)
  americanbull: 10, // no dedicated mode entry — fallback to majority convention
  etf: 10,          // no dedicated mode entry — fallback to majority convention
  tkl: 10,          // no dedicated mode entry — fallback to majority convention
};
const DEFAULT_TP_GAIN_PCT = 10;

const UNIVERSE_FILES = {
  americanbull: 'americanbull-universe.json',
  crypto: 'crypto-universe.json',
  metals: 'metals-universe.json',
  forex: 'forex-universe.json',
  casablanca: 'casablanca-universe.json',
  etf: 'etf-universe.json',
  tkl: 'tkl-universe.json',
};

// ─── Universe loader ────────────────────────────────────────────────────────

function loadUniverse() {
  if (CUSTOM_TICKERS.length) return CUSTOM_TICKERS;
  const file = UNIVERSE_FILES[UNIVERSE_NAME];
  if (!file) { console.error(`❌ Unknown universe: ${UNIVERSE_NAME}`); process.exit(1); }
  const fp = path.join(ROOT, 'data', file);
  if (!fs.existsSync(fp)) { console.error(`❌ Universe file not found: ${fp}`); process.exit(1); }
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  return data.tickers || [];
}

if (UNIVERSE_NAME === 'casablanca') { console.error('❌ Use casablanca-scanner.js for Casablanca Bourse.'); process.exit(1); }

// ─── Yahoo OHLCV fetcher (same as candlestick-scanner.js) ──────────────────

const MIN_BARS = 120; // Go scoreSymbolAF rejects < 120; SMA200 gracefully returns 0 if < 200 bars

function readCache(ticker) {
  const fp = path.join(CACHE_DIR, `${ticker}_ohlcv.json`);
  if (!fs.existsSync(fp)) return null;
  const age = (Date.now() - fs.statSync(fp).mtimeMs) / 3600000;
  if (age > 12) return null;
  try {
    const bars = JSON.parse(fs.readFileSync(fp, 'utf8'));
    if (bars.length >= MIN_BARS) return bars;
  } catch { /* corrupt — re-fetch */ }
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
          const ohlc = q.indicators?.quote?.[0] || {};
          const bars = [];
          for (let i = 0; i < ts.length; i++) {
            const o = ohlc.open?.[i], h = ohlc.high?.[i], l = ohlc.low?.[i], c = ohlc.close?.[i], v = ohlc.volume?.[i];
            if (o != null && h != null && l != null && c != null) {
              const d = new Date(ts[i] * 1000).toISOString().slice(0, 10);
              bars.push({ date: d, open: o, high: h, low: l, close: c, volume: v || 0 });
            }
          }
          if (bars.length >= MIN_BARS) {
            fs.mkdirSync(CACHE_DIR, { recursive: true });
            fs.writeFileSync(path.join(CACHE_DIR, `${ticker}_ohlcv.json`), JSON.stringify(bars));
          }
          resolve(bars.length >= MIN_BARS ? bars : null);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null)).on('timeout', function() { this.destroy(); resolve(null); });
  });
}

async function batchFetch(tickers, concurrency) {
  const results = new Map();
  const queue = [...tickers];
  let done = 0, fromCache = 0;
  async function worker() {
    while (queue.length) {
      const t = queue.shift();
      const cached = readCache(t);
      if (cached) { results.set(t, cached); done++; fromCache++; continue; }
      const bars = await fetchOHLCV(t);
      if (bars) results.set(t, bars);
      done++;
      if (done % 50 === 0) process.stderr.write(`  fetched ${done}/${tickers.length} (${results.size} valid, ${fromCache} cached)\r`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  process.stderr.write(`  fetched ${done}/${tickers.length} (${results.size} valid, ${fromCache} cached)\n`);
  return results;
}

// ─── Adaptive Fractal Scoring (exact port of scoreSymbolAF) ─────────────────

function calcQualityScore(bars, rsi, mom60, mom120, avgVol20) {
  const n = bars.length;
  if (n < 20) return 0;
  let score = 0;

  if (rsi >= 45 && rsi <= 60) score += 25;
  else if (rsi < 45) score += 20;
  else if (rsi <= 70) score += 15;
  else score += 5;

  const [stochK] = calcStochastic(bars, 14);
  if (stochK < 70) score += 20;
  else if (stochK < 80) score += 15;
  else score += 5;

  if (mom120 > 0.50) score += 25;
  else if (mom120 > 0.30) score += 20;
  else if (mom120 > 0.15) score += 15;
  else score += 5;

  if (mom120 > 0 && mom60 > 0 && mom120 > mom60) score += 15;
  else if (mom120 > 0 && mom60 > 0) score += 10;

  if (avgVol20 > 0) {
    const volRatio = (bars[n - 1].volume || 0) / avgVol20;
    if (volRatio > 1.3) score += 15;
    else if (volRatio > 1.0) score += 10;
    else score += 5;
  }
  return score;
}

const ASSET_FILTERS = {
  americanbull: { minPrice: 1.0, maxVol: 0.15, maxATRPct: 0.12, rsiMin: 30, rsiMax: 80, minMom10: 0.01, requireAboveSMA200: true },
  crypto:       { minPrice: 0,   maxVol: 0.40, maxATRPct: 0.20, rsiMin: 25, rsiMax: 85, minMom10: -0.02, requireAboveSMA200: false },
  metals:       { minPrice: 0,   maxVol: 0.25, maxATRPct: 0.15, rsiMin: 28, rsiMax: 82, minMom10: 0.00, requireAboveSMA200: true },
  forex:        { minPrice: 0,   maxVol: 0.10, maxATRPct: 0.08, rsiMin: 30, rsiMax: 75, minMom10: 0.00, requireAboveSMA200: false },
  casablanca:   { minPrice: 0,   maxVol: 0.20, maxATRPct: 0.15, rsiMin: 28, rsiMax: 82, minMom10: 0.00, requireAboveSMA200: true },
};

function scoreSymbolAF(bars, regime, assetClass) {
  const n = bars.length;
  if (n < 120) return null;
  const f = ASSET_FILTERS[assetClass] || ASSET_FILTERS.americanbull;

  const price = bars[n - 1].close;
  if (price <= 0) return null;

  const sma20 = calcSMA(bars, 20);
  const sma50 = calcSMA(bars, 50);
  const sma200 = calcSMA(bars, 200);
  const rsi = calcRSI(bars, 14);
  const atr = calcATR(bars, 14);
  const volatility = calcVolatility(bars, 20);
  const mom10 = calcMomentum(bars, 10);
  const mom60 = calcMomentum(bars, 60);
  const mom120 = calcMomentum(bars, 120);

  if (price < f.minPrice) return null;
  if (f.requireAboveSMA200 && sma200 > 0 && price < sma200) return null;
  if (rsi < f.rsiMin || rsi > f.rsiMax) return null;
  if (mom10 < f.minMom10) return null;
  if (volatility > f.maxVol) return null;
  if (atr / price > f.maxATRPct) return null;

  const avgVol20 = calcAvgVolume(bars, 20);
  let volRatio = 0;
  if (avgVol20 > 0) {
    volRatio = (bars[n - 1].volume || 0) / avgVol20;
    if (volRatio < 0.5) return null;
  }

  const qualityScore = calcQualityScore(bars, rsi, mom60, mom120, avgVol20);

  // Risk Score
  let riskScore = volatility * 100;
  if (price < sma50) riskScore *= 1.5;

  // Reward Score (capped at 100)
  let rewardScore = (mom60 * 0.3 + mom120 * 0.7) * 100;
  if (rewardScore < 0) rewardScore = 0;
  if (price > sma20 && sma20 > sma50 && sma50 > sma200) rewardScore *= 1.5;
  else if (price > sma50 && sma50 > sma200) rewardScore *= 1.2;
  if (rewardScore > 100) rewardScore = 100;

  // Timing Score
  let timingScore = 0;
  if (rsi < 30) timingScore += 50;
  else if (rsi < 45) timingScore += 40;
  else if (rsi < 55) timingScore += 25;
  else if (rsi < 65) timingScore += 10;
  if (rsi > 75) timingScore -= 30;
  else if (rsi > 70) timingScore -= 20;
  if (sma50 > sma200 && price > sma50) timingScore += 20;

  const distFromMA20 = sma20 > 0 ? (price - sma20) / sma20 : 0;
  if (distFromMA20 > 0.30) timingScore -= 25;
  else if (distFromMA20 > 0.20) timingScore -= 10;

  // Combined Score
  const riskAdjusted = 100 / (riskScore + 1);
  let finalScore = (rewardScore * 0.30) + (timingScore * 0.20) + (riskAdjusted * 0.25) + (qualityScore * 0.25);

  // Regime adjustment
  if (regime) {
    const r = regime.toUpperCase().replace(/[- ]/g, '_');
    if (r.includes('RISK_ON')) finalScore *= 1.1;
    else if (r.includes('RISK_OFF') && !r.includes('EARLY')) finalScore *= 0.8;
  }

  const distMA20 = sma20 > 0 ? (price - sma20) / sma20 : 0;
  const distMA50 = sma50 > 0 ? (price - sma50) / sma50 : 0;
  const distMA200 = sma200 > 0 ? (price - sma200) / sma200 : 0;

  return {
    score: +finalScore.toFixed(2),
    price,
    entry: price,
    stop: +(price - atr * 2.5).toFixed(4),
    atr, rsi, volatility,
    mom10, mom60, mom120,
    volRatio: +volRatio.toFixed(2),
    qualityScore, rewardScore: +rewardScore.toFixed(1), timingScore,
    distMA20: +distMA20.toFixed(4),
    distMA50: +distMA50.toFixed(4),
    distMA200: +distMA200.toFixed(4),
    sma20, sma50, sma200,
    strategy: 'adaptive-fractal',
  };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const universe = loadUniverse();
  const assetClass = UNIVERSE_NAME;
  console.log(`🔮 Adaptive Fractal Scanner (systematic-tss port)`);
  console.log(`   Universe: ${universe.length} tickers (${assetClass}) | minScore: ${MIN_SCORE} | top: ${TOP_N}`);
  console.log(`   Date: ${SCAN_DATE} | Regime: ${REGIME || 'auto'}`);

  console.log(`📡 Fetching OHLCV data via Yahoo...`);
  const priceData = await batchFetch(universe, CONCURRENCY);
  if (!priceData.size) { console.error('❌ No OHLCV data — aborting.'); process.exit(1); }

  console.log('🔍 Scoring candidates (multi-factor)...');
  const candidates = [];
  const scanDateNorm = SCAN_DATE.replace(/-/g, '');

  for (const [ticker, rawBars] of priceData) {
    const cutIdx = rawBars.findIndex(b => b.date.replace(/-/g, '') > scanDateNorm);
    const bars = cutIdx > 0 ? rawBars.slice(0, cutIdx) : rawBars;

    // P80 dollar volume filter ($100K min for non-equity asset classes)
    const minDolVol = ['crypto', 'forex', 'casablanca'].includes(assetClass) ? 100_000 : 1_000_000;
    const dvP80 = calcDollarVolumePercentile(bars, 20, 0.80);
    if (dvP80 < minDolVol) continue;

    // Established-liquidity gate (opt-in): median dollar volume over the lookback, spike-robust.
    if (MIN_ESTABLISHED_DOLLAR_VOLUME > 0) {
      if (bars.length < ESTABLISHED_LOOKBACK) continue;
      if (calcDollarVolumePercentile(bars, ESTABLISHED_LOOKBACK, 0.50) < MIN_ESTABLISHED_DOLLAR_VOLUME) continue;
    }

    const result = scoreSymbolAF(bars, REGIME, assetClass);
    if (!result) continue;
    if (result.score < MIN_SCORE) continue;

    const risk = result.entry - result.stop;
    if (risk <= 0) continue;

    const gainPct = ASSET_TP_GAIN_PCT[assetClass] ?? DEFAULT_TP_GAIN_PCT;
    const tp1 = +(result.entry * (1 + gainPct / 100)).toFixed(2);
    const tp2 = +(result.entry * (1 + (gainPct * 2) / 100)).toFixed(2);
    const rr = +((tp1 - result.entry) / risk).toFixed(2);

    candidates.push({
      ticker, score: result.score,
      entry: +result.entry.toFixed(2), stop: +result.stop.toFixed(2), tp1, tp2,
      rr: `1:${rr.toFixed(2)}`,
      metrics: result,
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  const topCandidates = candidates.slice(0, TOP_N);

  console.log(`\n✅ Found ${candidates.length} signals (passed all filters), top ${topCandidates.length}:`);
  for (const c of topCandidates) {
    const icon = c.score >= 70 ? '📈' : c.score >= 50 ? '📊' : '  ';
    const trend = c.metrics.distMA20 > 0 && c.metrics.distMA50 > 0 && c.metrics.distMA200 > 0 ? '↑↑↑' :
                  c.metrics.distMA50 > 0 && c.metrics.distMA200 > 0 ? '↑↑' : '↑';
    console.log(`  ${icon} ${c.ticker.padEnd(8)} score:${String(c.score).padStart(5)} ${trend} E:${c.entry} S:${c.stop} RSI:${c.metrics.rsi.toFixed(0)} Mom120:${(c.metrics.mom120 * 100).toFixed(0)}%`);
  }

  if (DRY_RUN) { console.log('\n🏷️  Dry run — no files written.'); return topCandidates; }

  // Output
  if (OUTPUT_MODE === 'json') {
    const outPath = path.join(ROOT, 'data', `fractal-scan-${assetClass}-${SCAN_DATE}.json`);
    fs.writeFileSync(outPath, JSON.stringify({ scanDate: SCAN_DATE, regime: REGIME, assetClass, candidates: topCandidates }, null, 2));
    console.log(`\n📁 Written to ${outPath}`);
  } else if (OUTPUT_MODE === 'signals') {
    const scanDir = SCAN_FOLDER || SCAN_DATE.replace(/-/g, '');
    const sigPath = path.join(ROOT, 'scanner', scanDir, 'signals.json');
    if (!fs.existsSync(sigPath)) { console.error(`❌ ${sigPath} not found`); process.exit(1); }
    const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
    const existing = new Set((signals.signals || []).map(s => `${s.ticker}::${s.strategy}`));
    let added = 0;
    for (const c of topCandidates) {
      if (existing.has(`${c.ticker}::${STRATEGY_TAG}`)) continue;
      signals.signals.push({
        ticker: c.ticker, name: c.ticker, score: c.score, strategy: STRATEGY_TAG,
        entry: c.entry, stop: c.stop, tp1: c.tp1, tp2: c.tp2, rr: c.rr,
        horizon: 21, region: assetClass === 'americanbull' ? 'US' : assetClass.toUpperCase(), universe: assetClass,
        sharia: null,
        thesis: `AF score ${c.score}: Mom120=${(c.metrics.mom120 * 100).toFixed(0)}%, RSI=${c.metrics.rsi.toFixed(0)}, Vol=${c.metrics.volatility.toFixed(3)}, Quality=${c.metrics.qualityScore.toFixed(0)}`,
        extension: { rsi: +c.metrics.rsi.toFixed(1), mom120: +c.metrics.mom120.toFixed(3) },
      });
      existing.add(c.ticker);
      added++;
    }
    // Scan marker — proof the fractal scanner actually ran for this universe (even with 0 signals).
    // Key: 'fractal' (americanbull default) | 'fractal:<universe>' (metals, forex, ...) — merged
    // into the shared _scanRuns object without clobbering other scanners' entries.
    if (!signals._scanRuns) signals._scanRuns = {};
    signals._scanRuns[assetClass === 'americanbull' ? 'fractal' : `fractal:${assetClass}`] = {
      at: new Date().toISOString(),
      universe: assetClass,
      candidates: candidates.length,
      signals: topCandidates.length,
      added,
    };
    fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
    console.log(`\n📁 Appended ${added} fractal signals to ${sigPath}`);
  }

  return topCandidates;
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
