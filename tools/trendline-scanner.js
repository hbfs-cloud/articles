#!/usr/bin/env node
'use strict';

// trendline-scanner.js — Descending Trendline Breakout Scanner
//
// Inspired by "Trading Family" style: detect descending trendlines from swing highs,
// wait for breakout above the line, confirm with RSI divergence, target previous resistance.
//
// Usage:
//   node tools/trendline-scanner.js --dry-run
//   node tools/trendline-scanner.js --universe forex --dry-run
//   node tools/trendline-scanner.js --universe indices --dry-run
//   node tools/trendline-scanner.js --output signals --folder 20260629

const fs = require('fs');
const path = require('path');
const https = require('https');
const {
  calcSMA, calcRSI, calcATR, calcMomentum, calcAvgVolume,
} = require('./lib/fractal-indicators');

const ROOT = path.join(__dirname, '..');
const CACHE_DIR = path.join(ROOT, 'data', '.price-cache');

const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}
const hasFlag = name => args.includes(`--${name}`);

const UNIVERSE_NAME = getArg('universe', 'forex');
const MIN_SCORE = parseFloat(getArg('min-score', '40'));
const TOP_N = parseInt(getArg('top', '15'));
const OUTPUT_MODE = getArg('output', 'stdout');
const DRY_RUN = hasFlag('dry-run');
const SCAN_DATE = getArg('date', new Date().toISOString().slice(0, 10));
const SCAN_FOLDER = getArg('folder', null);
const REGIME = getArg('regime', null);
const CONCURRENCY = parseInt(getArg('concurrency', '10'));

// ─── Indices universe (hardcoded — Yahoo Finance tickers) ───────────────────

const INDICES_TICKERS = [
  '^GSPC', '^NDX', '^DJI', '^RUT',           // US
  '^FCHI', '^GDAXI', '^FTSE', '^STOXX50E',   // EU
  '^N225', '^HSI', '^AXJO', '^KS11',          // Asia-Pac
  '^IBEX', '^AEX', '^SSMI', '^BFX',           // EU cont'd
  'ES=F', 'NQ=F', 'YM=F', 'RTY=F',           // US futures
  'GC=F', 'SI=F', 'CL=F', 'NG=F',            // Commodities futures
];

// ─── Universe loader ────────────────────────────────────────────────────────

function loadUniverse() {
  if (UNIVERSE_NAME === 'indices') {
    return INDICES_TICKERS;
  }
  const aliases = {
    forex: 'forex-universe.json',
    americanbull: 'americanbull-universe.json',
    metals: 'metals-universe.json',
    etf: 'etf-universe.json',
  };
  const file = aliases[UNIVERSE_NAME];
  if (!file) {
    console.error(`Unknown universe: ${UNIVERSE_NAME}`);
    process.exit(1);
  }
  const fp = path.join(ROOT, 'data', file);
  if (!fs.existsSync(fp)) {
    console.error(`Universe file not found: ${fp}`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  return data.tickers || [];
}

// ─── Yahoo OHLCV fetcher (shared cache) ─────────────────────────────────────

const MIN_BARS = 120;

function readCache(ticker) {
  const fp = path.join(CACHE_DIR, `${ticker.replace(/[^a-zA-Z0-9]/g, '_')}_ohlcv.json`);
  if (!fs.existsSync(fp)) return null;
  const age = (Date.now() - fs.statSync(fp).mtimeMs) / 3600000;
  if (age > 12) return null;
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return null; }
}

function writeCache(ticker, bars) {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  const fp = path.join(CACHE_DIR, `${ticker.replace(/[^a-zA-Z0-9]/g, '_')}_ohlcv.json`);
  fs.writeFileSync(fp, JSON.stringify(bars));
}

function fetchYahoo(ticker) {
  return new Promise((resolve) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=2y&interval=1d`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          const r = j.chart?.result?.[0];
          if (!r?.timestamp) return resolve(null);
          const ts = r.timestamp, q = r.indicators.quote[0];
          const bars = [];
          for (let i = 0; i < ts.length; i++) {
            if (q.close[i] != null && q.high[i] != null && q.low[i] != null) {
              bars.push({
                date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
                open: q.open[i] || q.close[i], high: q.high[i], low: q.low[i],
                close: q.close[i], volume: q.volume?.[i] || 0,
              });
            }
          }
          resolve(bars.length >= MIN_BARS ? bars : null);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

async function fetchBatch(tickers) {
  const results = {};
  let done = 0, valid = 0, cached = 0;
  for (let i = 0; i < tickers.length; i += CONCURRENCY) {
    const batch = tickers.slice(i, i + CONCURRENCY);
    const promises = batch.map(async t => {
      let bars = readCache(t);
      if (bars) { cached++; valid++; results[t] = bars; return; }
      bars = await fetchYahoo(t);
      if (bars) { writeCache(t, bars); valid++; results[t] = bars; }
    });
    await Promise.all(promises);
    done += batch.length;
    process.stderr.write(`  fetched ${done}/${tickers.length} (${valid} valid, ${cached} cached)\r`);
  }
  process.stderr.write('\n');
  return results;
}

// ─── Swing High/Low Detection (fractal pivot method) ────────────────────────

function findSwingHighs(bars, lookback = 5) {
  const swings = [];
  for (let i = lookback; i < bars.length - lookback; i++) {
    let isSwingHigh = true;
    for (let j = 1; j <= lookback; j++) {
      if (bars[i].high <= bars[i - j].high || bars[i].high <= bars[i + j].high) {
        isSwingHigh = false;
        break;
      }
    }
    if (isSwingHigh) {
      swings.push({ index: i, price: bars[i].high, date: bars[i].date });
    }
  }
  return swings;
}

function findSwingLows(bars, lookback = 5) {
  const swings = [];
  for (let i = lookback; i < bars.length - lookback; i++) {
    let isSwingLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (bars[i].low >= bars[i - j].low || bars[i].low >= bars[i + j].low) {
        isSwingLow = false;
        break;
      }
    }
    if (isSwingLow) {
      swings.push({ index: i, price: bars[i].low, date: bars[i].date });
    }
  }
  return swings;
}

// ─── Descending Trendline Detection ─────────────────────────────────────────

function findDescendingTrendlines(swingHighs, bars) {
  const trendlines = [];
  const n = bars.length;
  const minSpan = 10; // at least 10 bars between pivots

  for (let i = 0; i < swingHighs.length - 1; i++) {
    for (let j = i + 1; j < swingHighs.length; j++) {
      const p1 = swingHighs[i];
      const p2 = swingHighs[j];

      // must be descending
      if (p2.price >= p1.price) continue;
      // must span enough bars
      if (p2.index - p1.index < minSpan) continue;

      const slope = (p2.price - p1.price) / (p2.index - p1.index);
      // minimum slope: at least 2% drop over the trendline span
      const dropPct = (p1.price - p2.price) / p1.price;
      if (dropPct < 0.02) continue;

      // check no bars close above the line between p1 and p2 (valid trendline)
      let valid = true;
      let touches = 2;
      for (let k = p1.index + 1; k < p2.index; k++) {
        const linePrice = p1.price + slope * (k - p1.index);
        if (bars[k].close > linePrice * 1.002) { // 0.2% tolerance (strict)
          valid = false;
          break;
        }
        // count additional touches (high within 0.3% of line — tight)
        if (Math.abs(bars[k].high - linePrice) / linePrice < 0.003) {
          touches++;
        }
      }
      if (!valid) continue;

      // check if recent price (last 3 bars) broke above
      const lastIdx = n - 1;
      const linePriceAtEnd = p1.price + slope * (lastIdx - p1.index);
      const currentPrice = bars[lastIdx].close;
      const broke = currentPrice > linePriceAtEnd;

      // only consider if trendline extends close to current time
      if (lastIdx - p2.index > 30) continue; // trendline too old

      trendlines.push({
        p1, p2, slope, touches, broke,
        lineAtCurrent: linePriceAtEnd,
        breakoutPct: broke ? (currentPrice - linePriceAtEnd) / linePriceAtEnd : 0,
        span: p2.index - p1.index,
        age: lastIdx - p2.index,
      });
    }
  }

  // sort by: broke first, then touches, then recency
  trendlines.sort((a, b) => {
    if (a.broke !== b.broke) return b.broke ? 1 : -1;
    if (b.touches !== a.touches) return b.touches - a.touches;
    return a.age - b.age;
  });

  return trendlines;
}

// ─── RSI Divergence Detection ───────────────────────────────────────────────

function detectBullishRSIDivergence(bars, period = 14, lookback = 30) {
  const n = bars.length;
  if (n < lookback + period) return { found: false };

  const swingLows = findSwingLows(bars.slice(0, -1), 3);
  const recentLows = swingLows.filter(s => s.index > n - lookback - 5);
  if (recentLows.length < 2) return { found: false };

  // check last 2 swing lows
  const low1 = recentLows[recentLows.length - 2];
  const low2 = recentLows[recentLows.length - 1];

  // price making lower lows
  if (low2.price >= low1.price) return { found: false };

  // RSI at those points
  const rsi1 = calcRSI(bars.slice(0, low1.index + 1), period);
  const rsi2 = calcRSI(bars.slice(0, low2.index + 1), period);

  // RSI making higher lows (divergence)
  if (rsi2 <= rsi1) return { found: false };

  return {
    found: true,
    priceLow1: low1.price, priceLow2: low2.price,
    rsiLow1: rsi1, rsiLow2: rsi2,
    strength: (rsi2 - rsi1) / rsi1,
  };
}

// ─── Support/Resistance Zone Detection ──────────────────────────────────────

function findResistanceZones(bars, lookback = 100) {
  const n = bars.length;
  const start = Math.max(0, n - lookback);
  const highs = [];
  for (let i = start; i < n; i++) highs.push(bars[i].high);
  highs.sort((a, b) => b - a);

  const zones = [];
  const used = new Set();
  const tolerance = 0.015; // 1.5% clustering

  for (const h of highs) {
    if (used.has(h)) continue;
    const cluster = highs.filter(p => Math.abs(p - h) / h < tolerance && !used.has(p));
    if (cluster.length >= 2) {
      const avg = cluster.reduce((s, p) => s + p, 0) / cluster.length;
      zones.push({ price: avg, touches: cluster.length });
      cluster.forEach(p => used.add(p));
    }
  }

  return zones.sort((a, b) => a.price - b.price);
}

function findSupportZones(bars, lookback = 100) {
  const n = bars.length;
  const start = Math.max(0, n - lookback);
  const lows = [];
  for (let i = start; i < n; i++) lows.push(bars[i].low);
  lows.sort((a, b) => a - b);

  const zones = [];
  const used = new Set();
  const tolerance = 0.015;

  for (const l of lows) {
    if (used.has(l)) continue;
    const cluster = lows.filter(p => Math.abs(p - l) / l < tolerance && !used.has(p));
    if (cluster.length >= 2) {
      const avg = cluster.reduce((s, p) => s + p, 0) / cluster.length;
      zones.push({ price: avg, touches: cluster.length });
      cluster.forEach(p => used.add(p));
    }
  }

  return zones.sort((a, b) => a.price - b.price);
}

// ─── Scoring ────────────────────────────────────────────────────────────────

function scoreTicker(ticker, bars) {
  const n = bars.length;
  const price = bars[n - 1].close;
  const rsi = calcRSI(bars, 14);
  const atr = calcATR(bars, 14);
  const atrPct = atr / price;
  const sma50 = calcSMA(bars, 50);
  const sma200 = calcSMA(bars, 200);
  const mom20 = calcMomentum(bars, 20);

  // find swing highs and descending trendlines
  const swingHighs = findSwingHighs(bars, 5);
  if (swingHighs.length < 2) return null;

  const trendlines = findDescendingTrendlines(swingHighs, bars);
  if (trendlines.length === 0) return null;

  const best = trendlines[0];
  if (!best.broke) return null; // no breakout yet

  // breakout must be recent (within last 5 bars)
  const lastBarDate = bars[n - 1].date;
  let breakoutBar = -1;
  for (let i = n - 1; i >= Math.max(0, n - 5); i--) {
    const lineP = best.p1.price + best.slope * (i - best.p1.index);
    if (bars[i].close > lineP && (i === 0 || bars[i - 1].close <= best.p1.price + best.slope * (i - 1 - best.p1.index))) {
      breakoutBar = i;
      break;
    }
  }
  // if breakout happened more than 5 bars ago, still valid but lower score
  const breakoutRecency = n - 1 - (breakoutBar >= 0 ? breakoutBar : best.p2.index);

  // RSI divergence
  const rsiDiv = detectBullishRSIDivergence(bars);

  // resistance zones for TP
  const resistanceZones = findResistanceZones(bars, 200);
  const supportZones = findSupportZones(bars, 50);

  // TP = next resistance above current price
  let tp1 = null, tp2 = null;
  const aboveResistances = resistanceZones.filter(z => z.price > price * 1.01);
  if (aboveResistances.length >= 1) tp1 = +aboveResistances[0].price.toFixed(6);
  if (aboveResistances.length >= 2) tp2 = +aboveResistances[1].price.toFixed(6);

  // fallback TP: previous swing high before the trendline
  if (!tp1 && swingHighs.length > 0) {
    const prevHigh = swingHighs.reduce((max, s) => s.price > max ? s.price : max, 0);
    if (prevHigh > price * 1.01) tp1 = +prevHigh.toFixed(6);
  }
  // ultimate fallback: ATR-based
  if (!tp1) tp1 = +(price + 3 * atr).toFixed(6);
  if (!tp2) tp2 = +(price + 5 * atr).toFixed(6);

  // stop = below recent swing low or 2*ATR
  const recentLows = findSwingLows(bars.slice(Math.max(0, n - 20)), 3);
  let stop;
  if (recentLows.length > 0) {
    stop = Math.min(...recentLows.map(s => s.price));
    stop = Math.min(stop, price - 1.5 * atr);
  } else {
    stop = price - 2 * atr;
  }
  stop = +stop.toFixed(6);

  const rr = stop < price && tp1 > price ? (tp1 - price) / (price - stop) : 0;
  if (rr < 1.5) return null; // minimum R:R

  // ─── Scoring ─────────────────────────────────────────────────────────
  let score = 0;

  // trendline quality (0-30) — cap touches scoring at 5
  score += Math.min(best.touches, 5) * 6;

  // breakout strength (0-20)
  score += Math.min(best.breakoutPct * 500, 20);

  // RSI divergence (0-20)
  if (rsiDiv.found) {
    score += 10 + Math.min(rsiDiv.strength * 50, 10);
  }

  // RSI not overbought (0-10) — prefer entries when RSI < 60
  if (rsi < 40) score += 10;
  else if (rsi < 50) score += 7;
  else if (rsi < 60) score += 4;

  // R:R quality (0-15)
  score += Math.min(rr * 5, 15);

  // recency bonus (0-10) — breakout in last 3 bars gets max
  if (breakoutRecency <= 1) score += 10;
  else if (breakoutRecency <= 3) score += 7;
  else if (breakoutRecency <= 5) score += 4;

  // trendline span (0-10) — longer trendlines = stronger breakout
  if (best.span >= 40) score += 10;
  else if (best.span >= 25) score += 7;
  else if (best.span >= 15) score += 5;

  // EMA trend context (0-5)
  if (sma50 > 0 && sma200 > 0 && sma50 > sma200) score += 5;
  else if (sma50 > 0 && price > sma50) score += 3;

  score = +score.toFixed(1);

  return {
    ticker, score, price: +price.toFixed(6), entry: +price.toFixed(6), stop, tp1, tp2,
    rr: +rr.toFixed(2), horizon: 21,
    metrics: {
      rsi: +rsi.toFixed(1), atrPct: +atrPct.toFixed(4), mom20: +mom20.toFixed(4),
      trendlineTouches: best.touches, trendlineSpan: best.span,
      breakoutPct: +(best.breakoutPct * 100).toFixed(2),
      rsiDivergence: rsiDiv.found,
      rsiDivStrength: rsiDiv.found ? +(rsiDiv.strength * 100).toFixed(1) : 0,
    },
    trendline: {
      startDate: best.p1.date, endDate: best.p2.date,
      startPrice: +best.p1.price.toFixed(6), endPrice: +best.p2.price.toFixed(6),
    },
  };
}

// ─── Region detection ───────────────────────────────────────────────────────

function detectRegion(ticker) {
  if (ticker.includes('=X')) return 'FX';
  if (ticker.startsWith('^') || ticker.includes('=F')) return 'IDX';
  return 'US';
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const tickers = loadUniverse();
  console.error(`📐 Trendline Breakout Scanner`);
  console.error(`   Universe: ${tickers.length} tickers (${UNIVERSE_NAME}) | minScore: ${MIN_SCORE} | top: ${TOP_N}`);
  console.error(`   Date: ${SCAN_DATE} | Regime: ${REGIME || 'auto'}`);
  console.error('📡 Fetching OHLCV data via Yahoo...');

  const allBars = await fetchBatch(tickers);

  console.error('🔍 Scoring candidates (trendline breakout detection)...');

  const candidates = [];
  for (const ticker of tickers) {
    const bars = allBars[ticker];
    if (!bars) continue;
    try {
      const result = scoreTicker(ticker, bars);
      if (result && result.score >= MIN_SCORE) {
        candidates.push(result);
      }
    } catch (e) {
      // skip ticker on error
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const topCandidates = candidates.slice(0, TOP_N);

  // ─── Output ─────────────────────────────────────────────────────────
  if (topCandidates.length === 0) {
    console.error('\n⚠️  No trendline breakout signals found.');
  } else {
    console.error(`\n✅ Found ${candidates.length} signals (passed all filters), top ${Math.min(TOP_N, topCandidates.length)}:`);
    for (const c of topCandidates) {
      const divIcon = c.metrics.rsiDivergence ? '🔀' : '  ';
      console.error(
        `  📐 ${c.ticker.padEnd(10)} score: ${String(c.score).padStart(5)} ${divIcon}` +
        ` Touches:${c.metrics.trendlineTouches} Span:${c.metrics.trendlineSpan}bars` +
        ` Brkout:${c.metrics.breakoutPct}% RSI:${c.metrics.rsi} R:R=${c.rr}`
      );
    }
  }

  if (DRY_RUN) {
    console.error('\n🏷️  Dry run — no files written.');
  } else if (OUTPUT_MODE === 'json') {
    const outPath = path.join(ROOT, 'data', `trendline-signals-${SCAN_DATE.replace(/-/g, '')}.json`);
    fs.writeFileSync(outPath, JSON.stringify(topCandidates, null, 2));
    console.error(`\n📁 Written ${topCandidates.length} signals to ${outPath}`);
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
        ticker: c.ticker, name: c.ticker, score: c.score, strategy: 'TrendlineBreakout',
        entry: c.entry, stop: c.stop, tp1: c.tp1, tp2: c.tp2, rr: c.rr,
        horizon: c.horizon, region: detectRegion(c.ticker),
        sharia: null,
        thesis: `Trendline breakout: ${c.metrics.trendlineTouches} touches, span ${c.metrics.trendlineSpan} bars, breakout +${c.metrics.breakoutPct}%` +
          (c.metrics.rsiDivergence ? `, RSI div +${c.metrics.rsiDivStrength}%` : ''),
        extension: {
          trendlineTouches: c.metrics.trendlineTouches,
          trendlineSpan: c.metrics.trendlineSpan,
          rsiDivergence: c.metrics.rsiDivergence,
        },
      });
      existing.add(c.ticker);
      added++;
    }
    fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
    console.error(`\n📁 Appended ${added} trendline signals to ${sigPath}`);
  }

  return topCandidates;
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
