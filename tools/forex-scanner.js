#!/usr/bin/env node
'use strict';

/**
 * forex-scanner.js — Faithful port of systematic-tss ForexScanner.
 *
 * Source: internal/engine/scanner_forex.go (3-axis scoring: Momentum 40%,
 * Mean Reversion 30%, Relative Strength vs DXY 30%).
 *
 * SCORING (scanner_forex.go:141-251):
 *   MOMENTUM (40%) — scanner_forex.go:141-172:
 *     momRaw   = ret30d*0.40 + ret14d*0.35 + ret7d*0.25            (lines 142-159)
 *     trendBonus = 15 (price>MA20>MA50>MA200) / 10 (price>MA50>MA200)
 *                  / 5 (price>MA200) / 0                            (lines 162-169)
 *     momentumScore = clamp(momRaw*5 + 25 + trendBonus, 0, 50)     (line 172)
 *
 *   MEAN REVERSION (30%) — scanner_forex.go:174-199:
 *     bbPctB = calcBBPctB(20, 2.0) ; distMA20 = (price-MA20)/MA20  (lines 176-180)
 *     if bbPctB<0.3 && rsi<40: mrScore = (0.3-bbPctB)*100 + (40-rsi)*0.5  (184-186)
 *     if bbPctB>0.8 && rsi>65: mrScore = -10                       (lines 188-190)
 *     if |distMA20|>0.05 && distMA20<-0.03: mrScore += 10          (lines 192-197)
 *     mrScoreNorm = clamp(mrScore, -10, 40)                        (line 199)
 *
 *   RELATIVE STRENGTH (30%) — scanner_forex.go:201-236:
 *     pairMom = ret30d ; isUSDBase = symbol.startsWith("USD")      (lines 208-209)
 *     if dxyMom30 != 0:
 *       USD base  (USDJPY): dxy<0&&pair<0 →15 ; dxy>0&&pair>0 →10  (lines 212-218)
 *       USD quote (EURUSD): dxy<0&&pair>0 →15 ; dxy>0&&pair<0 →10  (lines 219-226)
 *     if |pairMom|>3.0: rsScore += 10 ; elif |pairMom|>1.5: +5     (lines 230-234)
 *     rsScoreNorm = min(rsScore, 30)                               (line 236)
 *
 *   FINAL = momentumScore*0.40 + mrScoreNorm*0.30 + rsScoreNorm*0.30  (line 251)
 *
 * FILTERS (scanner_forex.go):
 *   - need ≥200 bars (line 74)
 *   - atrPct ≥ 0.001 (lines 113-119)
 *   - RSI in [20, 80] (lines 122-134)
 *   - finalScore ≥ 5.0 (lines 261-263)  [plus --min-score CLI gate]
 *
 * DXY: fetched once (DX-Y.NYB) and dxyMom30 = calcReturn(dxy, 30) used for the
 * relative-strength axis (scanner_forex.go:58-62, 211-227). Equity business-day
 * calendar (Yahoo daily bars) — NO 24/7, despite FX trading 24/5.
 *
 * Mirrors tools/crypto-scanner.js conventions: getArg/hasFlag CLI parsing,
 * data/.price-cache OHLCV cache, batchFetch concurrency, output modes
 * (json | signals | stdout), --dry-run, --top, --min-score, --date, --as-of.
 *
 * Usage:
 *   node tools/forex-scanner.js                            # full scan, stdout
 *   node tools/forex-scanner.js --dry-run --top 8         # quick test, no write
 *   node tools/forex-scanner.js --output json             # data/forex-scan-YYYY-MM-DD.json
 *   node tools/forex-scanner.js --output signals          # append forex_pool to scanner/YYYYMMDD/signals.json
 *   node tools/forex-scanner.js --as-of 2026-05-01        # point-in-time (bars <= as-of)
 *   node tools/forex-scanner.js --tickers EURUSD=X,GBPUSD=X
 *   node tools/forex-scanner.js --min-score 20 --top 10
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { calcSMA, calcRSI, calcATR, calcReturn, calcBBPctB } = require('./lib/forex-indicators');

const ROOT = path.join(__dirname, '..');
const CACHE_DIR = path.join(ROOT, 'data', '.price-cache');

// ─── CLI args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}
const hasFlag = name => args.includes(`--${name}`);

const CUSTOM_TICKERS = getArg('tickers', '').split(',').filter(Boolean);
const MIN_SCORE = parseFloat(getArg('min-score', '5'));   // scanner_forex.go:261 floor is 5.0
const TOP_N = parseInt(getArg('top', '10'));
const OUTPUT_MODE = getArg('output', 'stdout');
const DRY_RUN = hasFlag('dry-run');
const SCAN_DATE = getArg('date', new Date().toISOString().slice(0, 10));
const AS_OF = getArg('as-of', '');                         // YYYY-MM-DD point-in-time; '' = today/all bars
const CONCURRENCY = parseInt(getArg('concurrency', '8'));
const KLINE_RANGE = '250d';                                // enough for MA200 + 30d return headroom

// Momentum weights (scanner_forex.go:147)
const MW30 = 0.40, MW14 = 0.35, MW7 = 0.25;
// Combined-axis weights (scanner_forex.go:239)
const W_MOM = 0.40, W_MR = 0.30, W_RS = 0.30;

const DXY_SYMBOL_DEFAULT = 'DX-Y.NYB';

// ─── Universe: local pre-built file (forex-universe.json) ───────────────────

function loadUniverse() {
  if (CUSTOM_TICKERS.length) return { tickers: CUSTOM_TICKERS, names: {}, dxySymbol: DXY_SYMBOL_DEFAULT };
  const universeFile = path.join(ROOT, 'data', 'forex-universe.json');
  if (!fs.existsSync(universeFile)) {
    console.error('ERROR: Could not load universe. Provide data/forex-universe.json');
    process.exit(1);
  }
  try {
    const data = JSON.parse(fs.readFileSync(universeFile, 'utf8'));
    const tickers = data.tickers || [];
    if (tickers.length < 3) throw new Error('too few tickers');
    console.log(`  ✅ Universe from local file: ${tickers.length} pairs`);
    return { tickers, names: data.names || {}, dxySymbol: data.dxySymbol || DXY_SYMBOL_DEFAULT };
  } catch (e) {
    console.error(`ERROR: Could not parse data/forex-universe.json: ${e.message}`);
    process.exit(1);
  }
}

// ─── Yahoo chart OHLCV fetch (daily, business-day calendar) ─────────────────
// Same endpoint as candlestick-scanner.js:93 — query1.finance.yahoo.com/v8/finance/chart.

function loadCachedPrice(ticker) {
  const fp = path.join(CACHE_DIR, `${cacheKey(ticker)}_ohlcv.json`);
  if (!fs.existsSync(fp)) return null;
  const stat = fs.statSync(fp);
  if ((Date.now() - stat.mtimeMs) / 3600000 > 12) return null;
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return null; }
}

function saveCachedOHLCV(ticker, bars) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(path.join(CACHE_DIR, `${cacheKey(ticker)}_ohlcv.json`), JSON.stringify(bars));
}

// Filesystem-safe cache key (EURUSD=X, DX-Y.NYB → safe filenames).
function cacheKey(ticker) {
  return ticker.replace(/[^A-Za-z0-9._-]/g, '_');
}

function fetchYahooChart(ticker, attempt = 0) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=${KLINE_RANGE}`;
  return new Promise(resolve => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 12000 }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          if (attempt < 1 && (res.statusCode === 429 || res.statusCode >= 500)) {
            setTimeout(() => resolve(fetchYahooChart(ticker, attempt + 1)), 600);
          } else {
            resolve(null);
          }
          return;
        }
        try {
          const j = JSON.parse(data);
          const result = j?.chart?.result?.[0];
          if (!result) return resolve(null);
          const ts = result.timestamp || [];
          const q = result.indicators?.quote?.[0] || {};
          const rmp = result.meta?.regularMarketPrice;
          const bars = [];
          for (let i = 0; i < ts.length; i++) {
            const d = new Date(ts[i] * 1000).toISOString().slice(0, 10);
            const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i], v = q.volume?.[i] || 0;
            if (o != null && h != null && l != null && c != null) {
              bars.push({ date: d, open: o, high: h, low: l, close: c, volume: v });
            } else if (i === ts.length - 1 && rmp != null) {
              bars.push({ date: d, open: o ?? rmp, high: h ?? rmp, low: l ?? rmp, close: rmp, volume: v });
            }
          }
          if (!bars.length) return resolve(null);
          saveCachedOHLCV(ticker, bars);
          resolve(bars);
        } catch { resolve(null); }
      });
    });
    req.on('error', () => {
      if (attempt < 1) setTimeout(() => resolve(fetchYahooChart(ticker, attempt + 1)), 600);
      else resolve(null);
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function fetchOHLCV(ticker) {
  const cached = loadCachedPrice(ticker);
  if (cached) return Promise.resolve(cached);
  return fetchYahooChart(ticker);
}

// ─── --as-of point-in-time slice ────────────────────────────────────────────
// Keep only bars with date <= asOf so historical backfill is reproducible.
function sliceAsOf(bars, asOf) {
  if (!asOf) return bars;
  return bars.filter(b => b.date <= asOf);
}

// ─── Batch fetch with concurrency ───────────────────────────────────────────

async function batchFetch(tickers, concurrency) {
  const results = new Map();
  const queue = [...tickers];
  let done = 0;
  async function worker() {
    while (queue.length) {
      const t = queue.shift();
      const bars = await fetchOHLCV(t);
      if (bars && bars.length >= 60) results.set(t, bars);
      done++;
      if (done % 10 === 0) process.stderr.write(`  fetched ${done}/${tickers.length} (${results.size} valid)\r`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  process.stderr.write(`  fetched ${done}/${tickers.length} (${results.size} valid)\n`);
  return results;
}

function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }

// ─── Scoring (port of scoreForexPair, scanner_forex.go:99-311) ──────────────

function scoreForexPair(symbol, bars, dxyMom30) {
  const n = bars.length;
  const price = bars[n - 1].close;
  if (!(price > 0) || !Number.isFinite(price)) return null;          // scanner_forex.go:103-105

  // Technical indicators (scanner_forex.go:108-110)
  const rsi = calcRSI(bars, 14);
  const atr = calcATR(bars, 14);
  const atrPct = atr / price;

  // Filter: dead pairs (scanner_forex.go:113-119)
  const minATRPct = 0.001;
  if (atrPct < minATRPct) return null;

  // RSI band filter (scanner_forex.go:122-134)
  const minRSI = 20.0, maxRSI = 80.0;
  if (rsi < minRSI || rsi > maxRSI) return null;

  // Moving averages (scanner_forex.go:137-139)
  const sma20 = calcSMA(bars, 20);
  const sma50 = calcSMA(bars, 50);
  const sma200 = calcSMA(bars, 200);

  // === MOMENTUM SCORE (40%) === scanner_forex.go:141-172
  const ret30d = calcReturn(bars, 30);
  const ret14d = calcReturn(bars, 14);
  const ret7d = calcReturn(bars, 7);
  const momRaw = ret30d * MW30 + ret14d * MW14 + ret7d * MW7;        // scanner_forex.go:159

  let trendBonus = 0.0;                                              // scanner_forex.go:162-169
  if (price > sma20 && sma20 > sma50 && sma50 > sma200) trendBonus = 15.0;
  else if (price > sma50 && sma50 > sma200) trendBonus = 10.0;
  else if (price > sma200) trendBonus = 5.0;

  const momentumScore = clamp(momRaw * 5.0 + 25.0 + trendBonus, 0, 50); // scanner_forex.go:172

  // === MEAN REVERSION SCORE (30%) === scanner_forex.go:174-199
  const bbPctB = calcBBPctB(bars, 20, 2.0);                          // scanner_forex.go:176
  let distMA20 = 0.0;
  if (sma20 > 0) distMA20 = (price - sma20) / sma20;                 // scanner_forex.go:178-180

  let mrScore = 0.0;
  if (bbPctB < 0.3 && rsi < 40) {                                    // scanner_forex.go:184-186
    mrScore = (0.3 - bbPctB) * 100 + (40 - rsi) * 0.5;
  }
  if (bbPctB > 0.8 && rsi > 65) {                                    // scanner_forex.go:188-190
    mrScore = -10.0;
  }
  if (Math.abs(distMA20) > 0.05) {                                   // scanner_forex.go:192-197
    if (distMA20 < -0.03) mrScore += 10.0;
  }
  const mrScoreNorm = clamp(mrScore, -10, 40);                       // scanner_forex.go:199

  // === RELATIVE STRENGTH SCORE (30%) === scanner_forex.go:201-236
  let rsScore = 0.0;
  const pairMom = ret30d;                                            // scanner_forex.go:208
  const isUSDBase = symbol.startsWith('USD');                        // scanner_forex.go:209

  if (dxyMom30 !== 0) {                                              // scanner_forex.go:211-227
    if (isUSDBase) {
      if (dxyMom30 < 0 && pairMom < 0) rsScore = 15.0;
      else if (dxyMom30 > 0 && pairMom > 0) rsScore = 10.0;
    } else {
      if (dxyMom30 < 0 && pairMom > 0) rsScore = 15.0;
      else if (dxyMom30 > 0 && pairMom < 0) rsScore = 10.0;
    }
  }
  if (Math.abs(pairMom) > 3.0) rsScore += 10.0;                      // scanner_forex.go:230-234
  else if (Math.abs(pairMom) > 1.5) rsScore += 5.0;

  const rsScoreNorm = Math.min(rsScore, 30);                        // scanner_forex.go:236

  // === COMBINED SCORE === scanner_forex.go:239-251
  const finalScore = momentumScore * W_MOM + mrScoreNorm * W_MR + rsScoreNorm * W_RS;

  // Skip negative/low scores (scanner_forex.go:261-263)
  if (finalScore < 5.0) return null;

  // Distances from MAs (scanner_forex.go:276-283)
  const distMA50 = sma50 > 0 ? (price - sma50) / sma50 : 0;
  const distMA200 = sma200 > 0 ? (price - sma200) / sma200 : 0;

  return {
    symbol,
    score: Math.round(finalScore * 100) / 100,                      // scanner_forex.go:287
    price,
    atr,
    atrPct,
    rsi,
    bbPctB,
    ret30d,
    ret14d,
    ret7d,
    momentumScore,
    mrScoreNorm,
    rsScoreNorm,
    sma20,
    sma50,
    sma200,
    distMA20,
    distMA50,
    distMA200,
  };
}

// ─── Main scan ──────────────────────────────────────────────────────────────

async function main() {
  const { tickers: universe, names, dxySymbol } = loadUniverse();
  console.log(`💱  Forex Multi-Strategy Scanner (systematic-tss port)`);
  console.log(`   Universe: ${universe.length} pairs | minScore: ${MIN_SCORE} | top: ${TOP_N} | DXY: ${dxySymbol}`);
  console.log(`   Date: ${SCAN_DATE}${AS_OF ? ` | as-of: ${AS_OF} (point-in-time)` : ''}`);

  console.log(`📡 Fetching Yahoo daily bars (${KLINE_RANGE}, biz-day calendar) incl. DXY...`);
  // Fetch DXY separately for the relative-strength axis (scanner_forex.go:58-62).
  const dxyBarsRaw = await fetchOHLCV(dxySymbol);
  const dxyBars = sliceAsOf(dxyBarsRaw || [], AS_OF);
  let dxyMom30 = 0.0;
  if (dxyBars.length > 30) dxyMom30 = calcReturn(dxyBars, 30);       // scanner_forex.go:60-62
  console.log(`   DXY 30d momentum: ${dxyBars.length ? dxyMom30.toFixed(2) + '%' : 'N/A (DXY fetch failed → rsScore neutral)'}`);

  const priceData = await batchFetch(universe, CONCURRENCY);

  console.log('🔍 Scoring 3 axes (momentum 40% / mean-reversion 30% / relative-strength 30%)...');
  const candidates = [];

  for (const [symbol, barsRaw] of priceData) {
    const bars = sliceAsOf(barsRaw, AS_OF);
    if (bars.length < 200) continue;                                 // scanner_forex.go:73-76

    const r = scoreForexPair(symbol, bars, dxyMom30);
    if (!r) continue;
    if (r.score < MIN_SCORE) continue;

    // FX prices: 4-5 decimals for non-JPY, 2-3 for JPY crosses. Use price magnitude.
    const dec = r.price >= 50 ? 3 : 5;
    const entry = +r.price.toFixed(dec);

    // Stop / take-profit (scanner_forex.go:273-274): SL = price - 2*ATR, TP = price + 3*ATR.
    const stop = +(entry - r.atr * 2.0).toFixed(dec);
    const risk = entry - stop;
    if (risk <= 0) continue;
    const tp1 = +(entry + risk * 1.5).toFixed(dec);                  // intermediate (1.5R)
    const tp2 = +(entry + r.atr * 3.0).toFixed(dec);                 // full target (scanner_forex.go:274)
    const rr = ((tp2 - entry) / risk).toFixed(1);

    candidates.push({
      ticker: symbol,
      name: names[symbol] || symbol,
      score: r.score,
      strategy: 'ForexMultiStrategy',
      entry,
      stop,
      tp1,
      tp2,
      rr: `1:${rr}`,
      horizon: 14,
      region: 'FOREX',
      sharia: null,
      assetClass: 'forex',
      thesis: `3-axis FX setup: mom ${r.momentumScore.toFixed(1)}/50 (${r.ret30d >= 0 ? '+' : ''}${r.ret30d.toFixed(1)}% 30d / ${r.ret14d >= 0 ? '+' : ''}${r.ret14d.toFixed(1)}% 14d / ${r.ret7d >= 0 ? '+' : ''}${r.ret7d.toFixed(1)}% 7d), mean-rev ${r.mrScoreNorm.toFixed(1)}/40 (BB%B ${r.bbPctB.toFixed(2)}, RSI ${r.rsi.toFixed(0)}), rel-strength ${r.rsScoreNorm.toFixed(1)}/30 vs DXY (${dxyMom30 >= 0 ? '+' : ''}${dxyMom30.toFixed(1)}% 30d).`,
      extension: {
        rsi: +r.rsi.toFixed(1),
        atr: +r.atr.toFixed(r.price >= 50 ? 3 : 5),
        distance_50dma_pct: +(r.distMA50 * 100).toFixed(1),
      },
      metrics: {
        return30d: +r.ret30d.toFixed(2),
        return14d: +r.ret14d.toFixed(2),
        return7d: +r.ret7d.toFixed(2),
        bbPctB: +r.bbPctB.toFixed(3),
        atrPct: +(r.atrPct * 100).toFixed(3),
        momentumScore: +r.momentumScore.toFixed(2),
        mrScore: +r.mrScoreNorm.toFixed(2),
        rsScore: +r.rsScoreNorm.toFixed(2),
        distance_20dma_pct: +(r.distMA20 * 100).toFixed(2),
        distance_200dma_pct: +(r.distMA200 * 100).toFixed(2),
      },
    });
  }

  // Sort by score desc, tie-break by ticker (scanner_forex.go:85-90)
  candidates.sort((a, b) => (b.score - a.score) || (a.ticker < b.ticker ? -1 : 1));
  const topCandidates = candidates.slice(0, TOP_N);

  console.log(`\n✅ Found ${candidates.length} candidates (≥200 bars, RSI/ATR filters, score≥5), top ${topCandidates.length}:`);
  for (const c of topCandidates) {
    console.log(
      `  💱 ${c.ticker.padEnd(10)} score:${String(c.score).padStart(6)} ` +
      `30d:${c.metrics.return30d >= 0 ? '+' : ''}${c.metrics.return30d}% ` +
      `mom:${c.metrics.momentumScore} mr:${c.metrics.mrScore} rs:${c.metrics.rsScore} ` +
      `E:${c.entry} S:${c.stop} TP2:${c.tp2} RR:${c.rr} RSI:${c.extension.rsi} BB%B:${c.metrics.bbPctB}`
    );
  }

  if (DRY_RUN) { console.log('\n🏷️  Dry run — no files written.'); return topCandidates; }

  if (OUTPUT_MODE === 'json') {
    const outPath = path.join(ROOT, 'data', `forex-scan-${SCAN_DATE}.json`);
    fs.writeFileSync(outPath, JSON.stringify({ scanDate: SCAN_DATE, asOf: AS_OF || null, dxyMom30, candidates: topCandidates }, null, 2));
    console.log(`\n📁 Written to ${outPath}`);
  } else if (OUTPUT_MODE === 'signals') {
    const scanDir = SCAN_DATE.replace(/-/g, '');
    const sigPath = path.join(ROOT, 'scanner', scanDir, 'signals.json');
    if (!fs.existsSync(sigPath)) { console.error(`❌ ${sigPath} not found`); process.exit(1); }
    const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
    // forex_pool — analogous to crypto_pool; consumed downstream by sweep for the forex mode.
    if (!Array.isArray(signals.forex_pool)) signals.forex_pool = [];
    const existing = new Set(signals.forex_pool.map(s => s.ticker));
    let added = 0;
    for (const c of topCandidates) {
      if (existing.has(c.ticker)) continue;
      signals.forex_pool.push(c);
      existing.add(c.ticker);
      added++;
    }
    fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
    console.log(`\n📁 Appended ${added} forex signals to forex_pool in ${sigPath}`);
  }

  return topCandidates;
}

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}

module.exports = { main, scoreForexPair };
