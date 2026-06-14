#!/usr/bin/env node
'use strict';

/**
 * crypto-scanner.js — Faithful port of systematic-tss CryptoMomentumScanner.
 *
 * Ranks cryptos by a momentum composite for the crypto rotation mode. Source:
 * internal/engine/scanner_crypto_momentum.go.
 *
 * SCORING (scanner_crypto_momentum.go:179-186):
 *   score = return30d*0.40 + return14d*0.25 + return7d*0.15
 *         + min(volRatio*10, 20)*0.10 + min(distMA50, 30)*0.10
 *   normalizedScore = min(max((score+50)/2, 0), 100)
 *
 * FILTERS:
 *   - Price > MA200 bull filter (scanner_crypto_momentum.go:111-121)
 *   - minScore (Scan filter loop, scanner_crypto_momentum.go:66-83)
 *   - need ≥200 bars (scanner_crypto_momentum.go:50-56)
 *
 * Mirrors tools/candlestick-scanner.js conventions: getArg/hasFlag CLI parsing,
 * data/.price-cache OHLCV cache, batchFetch concurrency, output modes
 * (json | signals | stdout), --dry-run.
 *
 * Usage:
 *   node tools/crypto-scanner.js                            # full scan, stdout
 *   node tools/crypto-scanner.js --dry-run --top 8         # quick test, no write
 *   node tools/crypto-scanner.js --output json             # data/crypto-scan-YYYY-MM-DD.json
 *   node tools/crypto-scanner.js --output signals          # append crypto_pool to scanner/YYYYMMDD/signals.json
 *   node tools/crypto-scanner.js --tickers BTC-USD,ETH-USD # custom universe
 *   node tools/crypto-scanner.js --min-score 55 --top 10
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { calcSMA, calcRSI, calcATR, calcReturn, volRatio } = require('./lib/crypto-indicators');

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
const MIN_SCORE = parseFloat(getArg('min-score', '50'));
const TOP_N = parseInt(getArg('top', '10'));
const OUTPUT_MODE = getArg('output', 'stdout');
const DRY_RUN = hasFlag('dry-run');
const SCAN_DATE = getArg('date', new Date().toISOString().slice(0, 10));
// --as-of YYYY-MM-DD: point-in-time scoring. When set, OHLCV bars are sliced to
// only those with date <= AS_OF before scoring, so historical backfills score on
// the data that was knowable at that date. Absent = use all bars (current/default).
const AS_OF = getArg('as-of', '');
const CONCURRENCY = parseInt(getArg('concurrency', '8'));
const MA_FILTER_PERIOD = parseInt(getArg('ma-filter', '200')); // bull filter (default 200)
const KLINE_LIMIT = 250; // enough for MA200 + 30d return headroom

// Momentum weights (scanner_crypto_momentum.go:161)
const W30D = 0.40, W14D = 0.25, W7D = 0.15, W_VOL = 0.10, W_MA50 = 0.10;

// ─── Universe: local pre-built file (crypto-universe.json) ──────────────────

function loadUniverse() {
  if (CUSTOM_TICKERS.length) return { tickers: CUSTOM_TICKERS, names: {} };
  const universeFile = path.join(ROOT, 'data', 'crypto-universe.json');
  if (!fs.existsSync(universeFile)) {
    console.error('ERROR: Could not load universe. Provide data/crypto-universe.json');
    process.exit(1);
  }
  try {
    const data = JSON.parse(fs.readFileSync(universeFile, 'utf8'));
    const tickers = data.tickers || [];
    if (tickers.length < 5) throw new Error('too few tickers');
    console.log(`  ✅ Universe from local file: ${tickers.length} tickers`);
    return { tickers, names: data.names || {} };
  } catch (e) {
    console.error(`ERROR: Could not parse data/crypto-universe.json: ${e.message}`);
    process.exit(1);
  }
}

// ─── Binance symbol conversion ──────────────────────────────────────────────
// BTC-USD → BTCUSDT (mirrors assets/live-tracker.js:204-205).
// Port intent of ConvertToBinanceSymbol, internal/ohlcv/binance.go:170-182.
function toBinanceSymbol(ticker) {
  return ticker.replace(/-USD$/i, '').toUpperCase() + 'USDT';
}

// ─── Binance klines OHLCV fetch (daily, with volume) ────────────────────────

function loadCachedPrice(ticker) {
  const fp = path.join(CACHE_DIR, `${ticker}_ohlcv.json`);
  if (!fs.existsSync(fp)) return null;
  const stat = fs.statSync(fp);
  if ((Date.now() - stat.mtimeMs) / 3600000 > 12) return null;
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return null; }
}

function saveCachedOHLCV(ticker, bars) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(path.join(CACHE_DIR, `${ticker}_ohlcv.json`), JSON.stringify(bars));
}

// Binance klines API: GET /api/v3/klines?symbol=BTCUSDT&interval=1d&limit=250
// Response: [[openTime, open, high, low, close, volume, ...], ...]
// (internal/ohlcv/binance.go:75-142)
function fetchBinanceKlines(ticker, attempt = 0) {
  const sym = toBinanceSymbol(ticker);
  const url = `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=1d&limit=${KLINE_LIMIT}`;
  return new Promise(resolve => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 12000 }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          // Retry once on transient/rate-limit errors; otherwise give up quietly.
          if (attempt < 1 && (res.statusCode === 429 || res.statusCode >= 500)) {
            setTimeout(() => resolve(fetchBinanceKlines(ticker, attempt + 1)), 600);
          } else {
            resolve(null);
          }
          return;
        }
        try {
          const klines = JSON.parse(data);
          if (!Array.isArray(klines) || klines.length === 0) return resolve(null);
          const bars = [];
          for (const k of klines) {
            if (!Array.isArray(k) || k.length < 6) continue;
            const d = new Date(Number(k[0])).toISOString().slice(0, 10);
            bars.push({
              date: d,
              open: parseFloat(k[1]),
              high: parseFloat(k[2]),
              low: parseFloat(k[3]),
              close: parseFloat(k[4]),
              volume: parseFloat(k[5]),
            });
          }
          saveCachedOHLCV(ticker, bars);
          resolve(bars);
        } catch { resolve(null); }
      });
    });
    req.on('error', () => {
      if (attempt < 1) setTimeout(() => resolve(fetchBinanceKlines(ticker, attempt + 1)), 600);
      else resolve(null);
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function fetchOHLCV(ticker) {
  const cached = loadCachedPrice(ticker);
  if (cached) return Promise.resolve(cached);
  return fetchBinanceKlines(ticker);
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
      if (done % 20 === 0) process.stderr.write(`  fetched ${done}/${tickers.length} (${results.size} valid)\r`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  process.stderr.write(`  fetched ${done}/${tickers.length} (${results.size} valid)\n`);
  return results;
}

// ─── Point-in-time slicing ──────────────────────────────────────────────────
// When --as-of is set, restrict bars to those at or before the as-of date so that
// scores/returns are computed only from data knowable at that point in time.
// Default (asOf falsy) returns the bars unchanged → current behavior preserved.
function sliceAsOf(bars, asOf) {
  if (!asOf) return bars;
  return bars.filter(b => b.date <= asOf);
}

// ─── Scoring (port of scoreSymbol, scanner_crypto_momentum.go:101-212) ──────

function scoreSymbol(ticker, bars) {
  const n = bars.length;
  const price = bars[n - 1].close;
  if (!(price > 0) || !Number.isFinite(price)) return null;

  // MA bull filter — skip cryptos below MA200 (scanner_crypto_momentum.go:111-121)
  if (n < MA_FILTER_PERIOD) return null;
  const maFilter = calcSMA(bars, MA_FILTER_PERIOD);
  if (price < maFilter) return null;

  // Momentum returns (scanner_crypto_momentum.go:136-138)
  const return30d = calcReturn(bars, 30);
  const return14d = calcReturn(bars, 14);
  const return7d = calcReturn(bars, 7);

  // Volume ratio: current vs 30d avg (scanner_crypto_momentum.go:140-151)
  const vr = volRatio(bars, 30);

  // Distance from MA50 (scanner_crypto_momentum.go:154-158)
  const ma50 = calcSMA(bars, 50);
  const distMA50 = ma50 > 0 ? ((price - ma50) / ma50) * 100.0 : 0;

  // Composite score (scanner_crypto_momentum.go:179-183)
  const score = (return30d * W30D)
    + (return14d * W14D)
    + (return7d * W7D)
    + (Math.min(vr * 10.0, 20.0) * W_VOL)
    + (Math.min(distMA50, 30.0) * W_MA50);

  // Normalize to 0-100 (scanner_crypto_momentum.go:186)
  const normalizedScore = Math.min(Math.max((score + 50.0) / 2.0, 0), 100.0);

  // Other indicators (scanner_crypto_momentum.go:189-194)
  const atr = calcATR(bars, 14);
  const atrPct = price > 0 ? atr / price : 0;
  const rsi = calcRSI(bars, 14);

  return {
    ticker,
    score: Math.round(normalizedScore * 100) / 100, // scanner_crypto_momentum.go:198
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

// ─── Main scan ──────────────────────────────────────────────────────────────

async function main() {
  const { tickers: universe, names } = loadUniverse();
  console.log(`🪙  Crypto Momentum Scanner (systematic-tss port)`);
  console.log(`   Universe: ${universe.length} tickers | minScore: ${MIN_SCORE} | top: ${TOP_N} | MA-filter: ${MA_FILTER_PERIOD}`);
  console.log(`   Date: ${SCAN_DATE}${AS_OF ? ` | as-of (point-in-time): ${AS_OF}` : ''}`);

  console.log('📡 Fetching Binance klines (daily, 250 bars)...');
  const priceData = await batchFetch(universe, CONCURRENCY);

  console.log('🔍 Scoring momentum...');
  const candidates = [];

  for (const [ticker, allBars] of priceData) {
    const bars = sliceAsOf(allBars, AS_OF); // point-in-time slice (no-op when --as-of absent)
    if (bars.length < 60) continue;         // not enough history at as-of date
    const r = scoreSymbol(ticker, bars);
    if (!r) continue;                       // failed MA200 bull filter / insufficient bars
    if (r.score < MIN_SCORE) continue;      // minScore filter

    const entry = +r.price.toFixed(r.price < 1 ? 6 : 2);
    // Stop: max(entry - 1.5*ATR, MA50) when MA50 below price (structural floor),
    // else entry - 1.5*ATR.
    let stop = entry - 1.5 * r.atr;
    if (r.ma50 > 0 && r.ma50 < entry && r.ma50 > stop) stop = r.ma50;
    stop = +stop.toFixed(entry < 1 ? 6 : 2);

    const risk = entry - stop;
    if (risk <= 0) continue;

    const tp1 = +(entry + risk * 2).toFixed(entry < 1 ? 6 : 2);
    const tp2 = +(entry + risk * 3).toFixed(entry < 1 ? 6 : 2);
    const rr = ((tp1 - entry) / risk).toFixed(1);

    candidates.push({
      ticker,
      name: names[ticker] || ticker,
      score: r.score,
      strategy: 'CryptoMomentum',
      entry,
      stop,
      tp1,
      tp2,
      rr: `1:${rr}`,
      horizon: 14,
      region: 'CRYPTO',
      sharia: null,
      assetClass: 'crypto',
      thesis: `Momentum leader: +${r.return30d.toFixed(1)}% 30d / +${r.return14d.toFixed(1)}% 14d / +${r.return7d.toFixed(1)}% 7d, above MA${MA_FILTER_PERIOD} bull filter, ${r.distMA50.toFixed(1)}% over MA50, vol ${r.volRatio.toFixed(2)}× 30d avg.`,
      extension: {
        rsi: +r.rsi.toFixed(1),
        atr: +r.atr.toFixed(r.atr < 1 ? 6 : 2),
        distance_50dma_pct: +r.distMA50.toFixed(1),
      },
      metrics: {
        return30d: +r.return30d.toFixed(2),
        return14d: +r.return14d.toFixed(2),
        return7d: +r.return7d.toFixed(2),
        volRatio: +r.volRatio.toFixed(2),
      },
    });
  }

  // Sort by score desc, tie-break by ticker (scanner_crypto_momentum.go:86-91)
  candidates.sort((a, b) => (b.score - a.score) || (a.ticker < b.ticker ? -1 : 1));
  const topCandidates = candidates.slice(0, TOP_N);

  console.log(`\n✅ Found ${candidates.length} candidates (passed bull filter + minScore), top ${topCandidates.length}:`);
  for (const c of topCandidates) {
    console.log(
      `  🪙 ${c.ticker.padEnd(11)} score:${String(c.score).padStart(6)} ` +
      `30d:${c.metrics.return30d >= 0 ? '+' : ''}${c.metrics.return30d}% ` +
      `E:${c.entry} S:${c.stop} TP1:${c.tp1} RR:${c.rr} ` +
      `RSI:${c.extension.rsi} vol:${c.metrics.volRatio}x`
    );
  }

  if (DRY_RUN) { console.log('\n🏷️  Dry run — no files written.'); return topCandidates; }

  if (OUTPUT_MODE === 'json') {
    const outPath = path.join(ROOT, 'data', `crypto-scan-${SCAN_DATE}.json`);
    fs.writeFileSync(outPath, JSON.stringify({ scanDate: SCAN_DATE, candidates: topCandidates }, null, 2));
    console.log(`\n📁 Written to ${outPath}`);
  } else if (OUTPUT_MODE === 'signals') {
    const scanDir = SCAN_DATE.replace(/-/g, '');
    const sigPath = path.join(ROOT, 'scanner', scanDir, 'signals.json');
    if (!fs.existsSync(sigPath)) { console.error(`❌ ${sigPath} not found`); process.exit(1); }
    const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
    // crypto_pool — analogous to tkl_pool, consumed downstream by sweep for the crypto mode.
    if (!Array.isArray(signals.crypto_pool)) signals.crypto_pool = [];
    const existing = new Set(signals.crypto_pool.map(s => s.ticker));
    let added = 0;
    for (const c of topCandidates) {
      if (existing.has(c.ticker)) continue;
      signals.crypto_pool.push(c);
      existing.add(c.ticker);
      added++;
    }
    fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
    console.log(`\n📁 Appended ${added} crypto signals to crypto_pool in ${sigPath}`);
  }

  return topCandidates;
}

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}

module.exports = { main, scoreSymbol, toBinanceSymbol };
