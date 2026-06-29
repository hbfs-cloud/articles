#!/usr/bin/env node
'use strict';

/**
 * etf-scanner.js — Regime-Adaptive ETF Momentum Scanner (exact port of systematic-tss)
 *
 * Cluster-based regime-adaptive scanner for ETFs.
 * Detects regime (RISK_OFF/NEUTRAL/RISK_ON/RECOVERY/EARLY_RISK_OFF) and applies
 * cluster-specific filters: mean reversion in bear markets, momentum in bull.
 * Market breadth (SPY/QQQ/IWM above MA50) + VIX ratio for trend.
 *
 * Usage:
 *   node tools/etf-scanner.js --dry-run
 *   node tools/etf-scanner.js --regime recovery --top 10
 *   node tools/etf-scanner.js --output signals --folder 20260629
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const {
  calcSMA, calcRSI, calcATR, calcVolatility, calcMomentum,
  calcAvgVolume, calcMedianVolume, calcDollarVolumePercentile,
} = require('./lib/fractal-indicators');

const ROOT = path.join(__dirname, '..');
const CACHE_DIR = path.join(ROOT, 'data', '.price-cache');

const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}
const hasFlag = name => args.includes(`--${name}`);

const MIN_SCORE = parseFloat(getArg('min-score', '0'));
const TOP_N = parseInt(getArg('top', '10'));
const OUTPUT_MODE = getArg('output', 'stdout');
const DRY_RUN = hasFlag('dry-run');
const SCAN_DATE = getArg('date', new Date().toISOString().slice(0, 10));
const SCAN_FOLDER = getArg('folder', null);
const CONCURRENCY = parseInt(getArg('concurrency', '10'));

// Regime: CLI > signals.json > default
function resolveRegime() {
  const cliRegime = getArg('regime', null);
  if (cliRegime) return cliRegime;
  if (SCAN_FOLDER) {
    try {
      const sigPath = path.join(ROOT, 'scanner', SCAN_FOLDER, 'signals.json');
      const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
      if (signals.regime) return signals.regime;
    } catch {}
  }
  return 'recovery';
}
const REGIME = resolveRegime();

// ─── ETF Universe (hardcoded, ~50 major US ETFs) ────────────────────────────

const ETF_UNIVERSE = [
  'SPY', 'QQQ', 'IWM', 'DIA',
  'XLK', 'XLE', 'XLF', 'XLV', 'XLI', 'XLB', 'XLC', 'XLY', 'XLP', 'XLU', 'XLRE',
  'VTI', 'VOO', 'VEA', 'VWO', 'EEM', 'EFA',
  'GDX', 'GDXJ', 'SLV', 'GLD', 'USO',
  'TLT', 'HYG', 'LQD',
  'ARKK', 'ARKG', 'GBTC', 'BITO',
  'SOXL', 'TQQQ',
  'FXI', 'EWJ', 'EWZ', 'EWN', 'INDA', 'VGK', 'VPL', 'IEMG',
  'XBI', 'IBB', 'SMH', 'SOXX', 'KWEB', 'TAN',
];

// ETF categories for diversification (max 2 per category)
const ETF_CATEGORIES = {
  SPY: 'US Large', QQQ: 'US Tech', IWM: 'US Small', DIA: 'US Large',
  XLK: 'Sector Tech', XLE: 'Sector Energy', XLF: 'Sector Financial', XLV: 'Sector Health',
  XLI: 'Sector Industrial', XLB: 'Sector Materials', XLC: 'Sector Comm', XLY: 'Sector Discretionary',
  XLP: 'Sector Staples', XLU: 'Sector Utilities', XLRE: 'Sector Real Estate',
  VTI: 'US Broad', VOO: 'US Large', VEA: 'Intl Dev', VWO: 'Intl EM', EEM: 'Intl EM', EFA: 'Intl Dev',
  GDX: 'Commodities', GDXJ: 'Commodities', SLV: 'Commodities', GLD: 'Commodities', USO: 'Commodities',
  TLT: 'Bonds', HYG: 'Bonds', LQD: 'Bonds',
  ARKK: 'Thematic', ARKG: 'Thematic', GBTC: 'Crypto', BITO: 'Crypto',
  SOXL: 'Leveraged', TQQQ: 'Leveraged',
  FXI: 'Intl Asia', EWJ: 'Intl Asia', INDA: 'Intl Asia', VPL: 'Intl Asia', KWEB: 'Intl Asia',
  EWZ: 'Intl LatAm', EWN: 'Intl Europe', VGK: 'Intl Europe', IEMG: 'Intl EM',
  XBI: 'Sector Biotech', IBB: 'Sector Biotech', SMH: 'Sector Semis', SOXX: 'Sector Semis', TAN: 'Thematic',
};

// Top ETF bonus multipliers (from Go analysis)
const TOP_ETF_BONUS = {
  XLE: 1.15, XLK: 1.15, EWN: 1.20,
  GBTC: 1.10, SLV: 1.10, GDX: 1.10,
  VOO: 1.05, VTI: 1.05, QQQ: 1.05,
};

// ─── Yahoo OHLCV fetcher (shared cache) ─────────────────────────────────────

const MIN_BARS = 200;

function readCache(ticker) {
  const fp = path.join(CACHE_DIR, `${ticker}_ohlcv.json`);
  if (!fs.existsSync(fp)) return null;
  const age = (Date.now() - fs.statSync(fp).mtimeMs) / 3600000;
  if (age > 12) return null;
  try {
    const bars = JSON.parse(fs.readFileSync(fp, 'utf8'));
    if (bars.length >= MIN_BARS) return bars;
  } catch {}
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
            fs.mkdirSync(CACHE_DIR, { recursive: true });
            fs.writeFileSync(path.join(CACHE_DIR, `${ticker}_ohlcv.json`), JSON.stringify(bars));
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
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  process.stderr.write(`  fetched ${done}/${tickers.length} (${result.size} valid, ${cached} cached)\n`);
  return result;
}

// ─── Market Breadth (SPY/QQQ/IWM above MA50) ───────────────────────────────

function calcMarketBreadth(priceData) {
  let bullishCount = 0;
  const check = (ticker) => {
    const bars = priceData.get(ticker);
    if (!bars || bars.length < 50) return false;
    const ma50 = calcSMA(bars, 50);
    return bars[bars.length - 1].close > ma50;
  };
  const spyAbove = check('SPY'); if (spyAbove) bullishCount++;
  const qqqAbove = check('QQQ'); if (qqqAbove) bullishCount++;
  const iwmAbove = check('IWM'); if (iwmAbove) bullishCount++;
  return {
    bullishCount, spyAbove, qqqAbove, iwmAbove,
    isBullish: bullishCount === 3,
    isBearish: bullishCount === 0,
  };
}

// ─── ETF Momentum Scoring (exact port of scanner_etf_momentum.go) ──────────

function scoreSymbol(ticker, bars, regime, vixRatio) {
  const n = bars.length;
  if (n < 200) return null;
  const price = bars[n - 1].close;
  if (price <= 0 || !isFinite(price)) return null;
  if (price < 5.0) return null;

  const mom20 = calcMomentum(bars, 20);
  const ma20 = calcSMA(bars, 20);
  const ma50 = calcSMA(bars, 50);
  const ma200 = calcSMA(bars, 200);
  const atr = calcATR(bars, 14);
  const rsi = calcRSI(bars, 14);

  if (ma20 <= 0 || ma50 <= 0 || ma200 <= 0 || atr <= 0) return null;

  const atrPct = atr / price;
  const distMA20 = (price - ma20) / ma20;
  const distMA50 = (price - ma50) / ma50;
  const distMA200 = (price - ma200) / ma200;

  const avgVol20 = calcAvgVolume(bars, 20);
  let volRatio = 1.0;
  if (avgVol20 > 0) volRatio = (bars[n - 1].volume || 0) / avgVol20;

  // ATR filter
  if (atrPct > 0.10) return null;

  // Blowoff top filter
  if (rsi > 85 && distMA20 > 0.20) return null;

  // Regime-adaptive cluster detection
  const r = (regime || 'recovery').toUpperCase().replace(/[- ]/g, '_');
  let cluster = '';
  let score = 0;
  let validEntry = false;

  if (r === 'RISK_OFF') {
    if (distMA20 < -0.05) {
      validEntry = true; cluster = 'RISKOFF_DEEP_DIP';
      score = 150 + Math.abs(distMA20) * 1000;
    } else if (rsi < 40) {
      validEntry = true; cluster = 'RISKOFF_OVERSOLD';
      score = 140 + (40 - rsi) * 3;
    } else if (rsi < 50 && distMA20 < 0) {
      validEntry = true; cluster = 'RISKOFF_MEANREV';
      score = 120 + (50 - rsi) * 2 + Math.abs(distMA20) * 500;
    }
  } else if (r === 'NEUTRAL') {
    if (rsi < 40 && distMA20 < -0.03) {
      validEntry = true; cluster = 'NEUTRAL_MEANREV';
      score = 100 + (40 - rsi) * 2 + Math.abs(distMA20) * 400;
    } else if (atrPct < 0.04 && mom20 > 0.05) {
      validEntry = true; cluster = 'NEUTRAL_LOWVOL_MOM';
      score = 80 + mom20 * 500;
    }
  } else if (r === 'RISK_ON') {
    if (atrPct < 0.045 && mom20 > 0.02) {
      validEntry = true; cluster = 'RISKON_MOMENTUM';
      let rsiBoost = 0;
      if (rsi > 60) rsiBoost = (rsi - 60) * 2;
      score = 80 + mom20 * 500 + rsiBoost;
    }
  } else if (r === 'RECOVERY') {
    if (rsi < 48 && atrPct < 0.04 && mom20 > 0.03) {
      validEntry = true; cluster = 'RECOVERY_FILTERED';
      score = 70 + mom20 * 400 + (48 - rsi) * 1.5;
    }
  } else if (r === 'EARLY_RISK_OFF') {
    if (rsi < 25 && distMA20 < -0.10) {
      validEntry = true; cluster = 'EARLY_RISKOFF_EXTREME';
      score = 100 + (25 - rsi) * 5 + Math.abs(distMA20) * 500;
    }
  }

  // EXTREME fallback
  if (!validEntry) {
    if (mom20 > 0.15) {
      // In RECOVERY/NEUTRAL: require trend confirmation (price > MA20)
      if ((r === 'RECOVERY' || r === 'NEUTRAL') && distMA20 < 0) {
        // skip
      } else {
        validEntry = true; cluster = 'EXTREME_MOMENTUM';
        score = 120 + mom20 * 500;
      }
    }
    if (!validEntry && rsi < 30 && distMA20 < -0.05) {
      // Skip EXTREME_OVERSOLD in RISK_ON
      if (r !== 'RISK_ON') {
        validEntry = true; cluster = 'EXTREME_OVERSOLD';
        score = 110 + (30 - rsi) * 3 + Math.abs(distMA20) * 600;
      }
    }
  }

  if (!validEntry) return null;

  // Top ETF bonus
  const mult = TOP_ETF_BONUS[ticker];
  if (mult) score *= mult;

  score = Math.round(score * 100) / 100;

  if (score < MIN_SCORE) return null;

  return {
    score, price, entry: price,
    stop: +(price - atr * 2).toFixed(4),
    atr, atrPct, rsi, mom20,
    distMA20: +distMA20.toFixed(4), distMA50: +distMA50.toFixed(4), distMA200: +distMA200.toFixed(4),
    volRatio: +volRatio.toFixed(2),
    sma20: ma20, sma50: ma50, sma200: ma200,
    cluster, strategy: 'etf-momentum',
  };
}

// ─── Category diversification (max 2 per category) ──────────────────────────

function diversifyByCategory(candidates, limit) {
  const maxPerCategory = 2;
  const categoryCount = {};
  const result = [];

  for (const c of candidates) {
    if (result.length >= limit) break;
    const category = ETF_CATEGORIES[c.ticker] || 'OTHER';
    if ((categoryCount[category] || 0) >= maxPerCategory) continue;
    result.push(c);
    categoryCount[category] = (categoryCount[category] || 0) + 1;
  }
  return result;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`📊 ETF Momentum Scanner (systematic-tss port)`);
  console.log(`   Universe: ${ETF_UNIVERSE.length} ETFs | minScore: ${MIN_SCORE} | top: ${TOP_N}`);
  console.log(`   Date: ${SCAN_DATE} | Regime: ${REGIME}`);

  console.log(`📡 Fetching OHLCV data via Yahoo...`);
  // Fetch VIX alongside ETFs
  const allTickers = [...ETF_UNIVERSE, '^VIX'];
  const priceData = await batchFetch(allTickers, CONCURRENCY);
  if (!priceData.size) { console.error('❌ No OHLCV data — aborting.'); process.exit(1); }

  // VIX analysis
  const vixBars = priceData.get('^VIX');
  let vixLevel = 0, vixRatio = 1.0;
  if (vixBars && vixBars.length >= 14) {
    const vn = vixBars.length;
    vixLevel = vixBars[vn - 1].close;
    const vixSma14 = calcSMA(vixBars, 14);
    if (vixSma14 > 0) vixRatio = vixLevel / vixSma14;
    const vixTrend = vixRatio < 0.90 ? 'falling' : vixRatio > 1.10 ? 'rising' : 'stable';
    console.log(`   VIX: ${vixLevel.toFixed(1)} (${vixTrend}, ratio: ${vixRatio.toFixed(3)})`);
  }

  // Market breadth
  const breadth = calcMarketBreadth(priceData);
  console.log(`   Breadth: ${breadth.bullishCount}/3 above MA50 (SPY:${breadth.spyAbove ? 'Y' : 'N'} QQQ:${breadth.qqqAbove ? 'Y' : 'N'} IWM:${breadth.iwmAbove ? 'Y' : 'N'})`);

  console.log('🔍 Scoring candidates (regime-adaptive clusters)...');
  const candidates = [];
  const scanDateNorm = SCAN_DATE.replace(/-/g, '');

  for (const ticker of ETF_UNIVERSE) {
    const rawBars = priceData.get(ticker);
    if (!rawBars) continue;

    const cutIdx = rawBars.findIndex(b => b.date.replace(/-/g, '') > scanDateNorm);
    const bars = cutIdx > 0 ? rawBars.slice(0, cutIdx) : rawBars;

    const result = scoreSymbol(ticker, bars, REGIME, vixRatio);
    if (!result) continue;

    const risk = result.entry - result.stop;
    if (risk <= 0) continue;

    const tp1 = +(result.entry + risk * 2).toFixed(2);
    const tp2 = +(result.entry + risk * 3).toFixed(2);

    candidates.push({
      ticker, score: result.score,
      entry: +result.entry.toFixed(2), stop: +result.stop.toFixed(2), tp1, tp2,
      rr: '1:2.0', metrics: result,
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  // Apply category diversification
  const topCandidates = diversifyByCategory(candidates, TOP_N);

  console.log(`\n✅ Found ${candidates.length} signals (passed all filters), top ${topCandidates.length} (diversified):`);
  for (const c of topCandidates) {
    const cat = ETF_CATEGORIES[c.ticker] || 'OTHER';
    console.log(`  📊 ${c.ticker.padEnd(6)} score:${String(c.score).padStart(7)} [${c.metrics.cluster}] Mom20:${(c.metrics.mom20 * 100).toFixed(1)}% RSI:${c.metrics.rsi.toFixed(0)} ATR%:${(c.metrics.atrPct * 100).toFixed(1)}% (${cat})`);
  }

  if (DRY_RUN) { console.log('\n🏷️  Dry run — no files written.'); return topCandidates; }

  if (OUTPUT_MODE === 'json') {
    const outPath = path.join(ROOT, 'data', `etf-scan-${SCAN_DATE}.json`);
    fs.writeFileSync(outPath, JSON.stringify({
      scanDate: SCAN_DATE, regime: REGIME, vix: { level: vixLevel, ratio: vixRatio },
      breadth, candidates: topCandidates,
    }, null, 2));
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
        ticker: c.ticker, name: c.ticker, score: c.score, strategy: 'ETFMomentum',
        entry: c.entry, stop: c.stop, tp1: c.tp1, tp2: c.tp2, rr: c.rr,
        horizon: 21, region: 'US',
        sharia: null,
        thesis: `ETF ${c.metrics.cluster}: Mom20=${(c.metrics.mom20 * 100).toFixed(1)}%, RSI=${c.metrics.rsi.toFixed(0)}, ATR%=${(c.metrics.atrPct * 100).toFixed(1)}%`,
        extension: { cluster: c.metrics.cluster, atrPct: +c.metrics.atrPct.toFixed(4) },
      });
      existing.add(c.ticker);
      added++;
    }
    fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
    console.log(`\n📁 Appended ${added} ETF signals to ${sigPath}`);
  }

  return topCandidates;
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
