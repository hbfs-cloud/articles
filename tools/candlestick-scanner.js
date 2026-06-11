#!/usr/bin/env node
'use strict';

/**
 * candlestick-scanner.js — Standalone candlestick pattern scanner.
 * Replicates systematic-tss "americanbulls" strategy.
 *
 * Scans a universe of tickers for Hammer, Engulfing, Pin Bar patterns
 * with volume spike confirmation. Outputs candidates in signals.json format.
 *
 * Usage:
 *   node tools/candlestick-scanner.js                              # scan default US universe
 *   node tools/candlestick-scanner.js --universe sp500             # S&P 500 only
 *   node tools/candlestick-scanner.js --universe custom --tickers AAPL,MSFT,NVDA
 *   node tools/candlestick-scanner.js --min-score 80 --top 30
 *   node tools/candlestick-scanner.js --output signals             # write to signals.json (append candlestick entries)
 *   node tools/candlestick-scanner.js --output json                # write standalone results file
 *   node tools/candlestick-scanner.js --dry-run                    # print results, no file write
 *
 * Output per candidate:
 *   { ticker, score, strategy: "Candlestick", pattern, entry, stop, tp1, tp2, rr, volumeSpike }
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { scanPatterns, scoreCandlestick, hasVolumeSpike } = require('./lib/candlestick-patterns');

const ROOT = path.join(__dirname, '..');
const CACHE_DIR = path.join(ROOT, 'data', '.price-cache');
const UNIVERSE_DIR = path.join(ROOT, 'data');

// ─── CLI args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}
const hasFlag = name => args.includes(`--${name}`);

const UNIVERSE = getArg('universe', 'broad');
const CUSTOM_TICKERS = getArg('tickers', '').split(',').filter(Boolean);
const MIN_SCORE = parseInt(getArg('min-score', '80'));
const TOP_N = parseInt(getArg('top', '30'));
const OUTPUT_MODE = getArg('output', 'stdout');
const DRY_RUN = hasFlag('dry-run');
const SCAN_DATE = getArg('date', new Date().toISOString().slice(0, 10));
const CONCURRENCY = parseInt(getArg('concurrency', '8'));

// ─── Universe definitions ───────────────────────────────────────────────────

const BROAD_US = [
  'AAPL','MSFT','GOOGL','AMZN','NVDA','META','TSLA','BRK-B','UNH','JNJ',
  'V','XOM','JPM','PG','MA','HD','CVX','MRK','ABBV','PEP',
  'KO','AVGO','COST','LLY','WMT','MCD','CSCO','ACN','ABT','TMO',
  'NKE','CRM','ORCL','AMD','INTC','QCOM','TXN','AMAT','LRCX','KLAC',
  'CAT','DE','UPS','FDX','RTX','LMT','GD','BA','HON','MMM',
  'GS','MS','BLK','SCHW','AXP','C','BAC','WFC','PNC','USB',
  'AMGN','GILD','BIIB','REGN','VRTX','BMY','SYK','EW','ZTS','ISRG',
  'NEE','DUK','SO','D','AEP','EXC','SRE','XEL','WEC','ES',
  'PLD','AMT','CCI','EQIX','SPG','DLR','WELL','AVB','O','PSA',
  'XLP','XLV','XLU','XLB','XLI','XLE','XLF','XLK','XLY','XLRE',
  'GLD','SLV','QQQ','SPY','IWM','DIA','VTI','EEM','EFA','HYG',
  'CASY','MUSA','OGN','OLPX','FANG','ANET','SPOT','LIN','ASML','NSRGY',
  'TTE','EWG','CVS','WBA','CI','HUM','CNC','MCK','CAH','ABC',
  'CL','EL','CHD','CLX','SJM','GIS','K','CPB','HSY','MKC',
];

function getUniverse() {
  if (UNIVERSE === 'custom' && CUSTOM_TICKERS.length) return CUSTOM_TICKERS;
  if (UNIVERSE === 'sp500') {
    const spFile = path.join(UNIVERSE_DIR, 'sp500-tickers.json');
    if (fs.existsSync(spFile)) return JSON.parse(fs.readFileSync(spFile, 'utf8'));
  }
  return BROAD_US;
}

// ─── Yahoo Finance OHLCV fetch (reuses sweep.js price cache) ────────────────

function loadCachedPrice(ticker) {
  const fp = path.join(CACHE_DIR, `${ticker}.json`);
  if (!fs.existsSync(fp)) return null;
  const stat = fs.statSync(fp);
  const ageH = (Date.now() - stat.mtimeMs) / 3600000;
  if (ageH > 12) return null;
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return null; }
}

function saveCachedPrice(ticker, data) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(path.join(CACHE_DIR, `${ticker}.json`), JSON.stringify(data));
}

function fetchOHLCV(ticker) {
  const cached = loadCachedPrice(ticker);
  if (cached) return Promise.resolve(cached);

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=120d`;
  return new Promise(resolve => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 12000 }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          const result = j?.chart?.result?.[0];
          if (!result) return resolve(null);
          const timestamps = result.timestamp || [];
          const q = result.indicators?.quote?.[0] || {};
          const rmp = result.meta?.regularMarketPrice;
          const bars = [];
          for (let i = 0; i < timestamps.length; i++) {
            const d = new Date(timestamps[i] * 1000);
            const dateStr = d.toISOString().slice(0, 10);
            const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
            const v = q.volume?.[i] || 0;
            if (o != null && h != null && l != null && c != null) {
              bars.push({ date: dateStr, open: o, high: h, low: l, close: c, volume: v });
            } else if (i === timestamps.length - 1 && rmp != null) {
              bars.push({
                date: dateStr,
                open: o ?? rmp, high: h ?? rmp, low: l ?? rmp, close: rmp,
                volume: v,
              });
            }
          }
          // Also cache as hash for sweep.js compatibility
          const hash = {};
          for (const b of bars) hash[b.date] = { open: b.open, high: b.high, low: b.low, close: b.close };
          saveCachedPrice(ticker, hash);
          resolve(bars);
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// ─── Batch fetch with concurrency control ───────────────────────────────────

async function batchFetch(tickers, concurrency = 8) {
  const results = new Map();
  const queue = [...tickers];
  let done = 0;

  async function worker() {
    while (queue.length) {
      const ticker = queue.shift();
      const bars = await fetchOHLCV(ticker);
      if (bars) results.set(ticker, bars);
      done++;
      if (done % 20 === 0) process.stderr.write(`  fetched ${done}/${tickers.length}\r`);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  process.stderr.write(`  fetched ${done}/${tickers.length}\n`);
  return results;
}

// ─── Compute entry/stop/TP from pattern geometry ────────────────────────────

function computeLevels(bars, pattern) {
  const last = bars[bars.length - 1];
  const entry = last.close;
  const stop = pattern.invalidation;
  const risk = entry - stop;
  if (risk <= 0) return null;

  const tp1Target = pattern.patternTarget;
  const tp1 = Math.max(tp1Target, entry + risk * 2);
  const tp2 = entry + risk * 3;
  const rr = ((tp1 - entry) / risk).toFixed(1);

  return { entry: +entry.toFixed(2), stop: +stop.toFixed(2), tp1: +tp1.toFixed(2), tp2: +tp2.toFixed(2), rr: `1:${rr}` };
}

// ─── ATR calculation ────────────────────────────────────────────────────────

function computeATR(bars, periods = 14) {
  if (bars.length < periods + 1) return null;
  const slice = bars.slice(-(periods + 1));
  let sum = 0;
  for (let i = 1; i < slice.length; i++) {
    const prev = slice[i - 1], cur = slice[i];
    sum += Math.max(cur.high - cur.low, Math.abs(cur.high - prev.close), Math.abs(cur.low - prev.close));
  }
  return sum / periods;
}

// ─── RSI calculation ────────────────────────────────────────────────────────

function computeRSI(bars, period = 14) {
  if (bars.length < period + 1) return null;
  const slice = bars.slice(-(period + 1));
  let gains = 0, losses = 0;
  for (let i = 1; i < slice.length; i++) {
    const diff = slice[i].close - slice[i - 1].close;
    if (diff > 0) gains += diff; else losses -= diff;
  }
  const avgGain = gains / period, avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return +(100 - 100 / (1 + rs)).toFixed(1);
}

// ─── Main scan loop ─────────────────────────────────────────────────────────

async function main() {
  const universe = getUniverse();
  console.log(`🕯️  Candlestick Scanner — ${universe.length} tickers, min score ${MIN_SCORE}, top ${TOP_N}`);
  console.log(`   Universe: ${UNIVERSE}, Date: ${SCAN_DATE}`);

  console.log('📡 Fetching OHLCV data...');
  const priceData = await batchFetch(universe, CONCURRENCY);

  console.log('🔍 Scanning for candlestick patterns...');
  const candidates = [];

  for (const [ticker, bars] of priceData) {
    if (!Array.isArray(bars)) {
      // Cached data is a hash — convert to array
      const entries = Object.entries(bars).sort(([a], [b]) => a.localeCompare(b));
      const arrBars = entries.map(([date, b]) => ({ date, ...b, volume: 0 }));
      if (arrBars.length < 25) continue;
      const patterns = scanPatterns(arrBars);
      if (!patterns.length) continue;
      const best = patterns[0];
      const volumeSpike = best.volumeSpike;
      if (!best.confirmed) continue;

      const score = scoreCandlestick(patterns, volumeSpike);
      if (score < MIN_SCORE) continue;

      const levels = computeLevels(arrBars, best);
      if (!levels) continue;

      const atr = computeATR(arrBars);
      const rsi = computeRSI(arrBars);

      candidates.push({
        ticker, score, strategy: 'Candlestick',
        pattern: { name: best.name, strength: best.strength, confirmed: best.confirmed, volumeSpike },
        ...levels,
        extension: {
          rsi: rsi || 0,
          atr: atr ? +atr.toFixed(2) : 0,
          distance_50dma_pct: 0,
        },
      });
      continue;
    }

    if (bars.length < 25) continue;
    const patterns = scanPatterns(bars);
    if (!patterns.length) continue;
    const best = patterns[0];
    if (!best.confirmed) continue;

    const score = scoreCandlestick(patterns, best.volumeSpike);
    if (score < MIN_SCORE) continue;

    const levels = computeLevels(bars, best);
    if (!levels) continue;

    const atr = computeATR(bars);
    const rsi = computeRSI(bars);

    candidates.push({
      ticker, score, strategy: 'Candlestick',
      pattern: { name: best.name, strength: best.strength, confirmed: best.confirmed, volumeSpike: best.volumeSpike },
      ...levels,
      extension: {
        rsi: rsi || 0,
        atr: atr ? +atr.toFixed(2) : 0,
        distance_50dma_pct: 0,
      },
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  const topCandidates = candidates.slice(0, TOP_N);

  console.log(`\n✅ Found ${candidates.length} patterns, top ${topCandidates.length}:`);
  for (const c of topCandidates) {
    const flag = c.pattern.volumeSpike ? '📊' : '  ';
    console.log(`  ${flag} ${c.ticker.padEnd(6)} ${c.score} ${c.pattern.name.padEnd(18)} E:${c.entry} S:${c.stop} TP1:${c.tp1} RR:${c.rr}`);
  }

  if (DRY_RUN) {
    console.log('\n🏷️  Dry run — no files written.');
    return topCandidates;
  }

  if (OUTPUT_MODE === 'json') {
    const outPath = path.join(ROOT, 'data', `candlestick-scan-${SCAN_DATE}.json`);
    fs.writeFileSync(outPath, JSON.stringify({ scanDate: SCAN_DATE, candidates: topCandidates }, null, 2));
    console.log(`\n📁 Written to ${outPath}`);
  } else if (OUTPUT_MODE === 'signals') {
    const scanDir = SCAN_DATE.replace(/-/g, '');
    const sigPath = path.join(ROOT, 'scanner', scanDir, 'signals.json');
    if (!fs.existsSync(sigPath)) {
      console.error(`❌ signals.json not found at ${sigPath} — run the main scanner first.`);
      process.exit(1);
    }
    const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
    const existing = new Set((signals.signals || []).map(s => s.ticker));

    let added = 0;
    for (const c of topCandidates) {
      if (existing.has(c.ticker)) continue;
      signals.signals.push({
        ticker: c.ticker,
        name: c.ticker,
        score: c.score,
        strategy: 'Candlestick',
        entry: c.entry,
        stop: c.stop,
        tp1: c.tp1,
        tp2: c.tp2,
        rr: c.rr,
        horizon: 8,
        region: 'US',
        sharia: null,
        thesis: `Candlestick ${c.pattern.name} pattern with ${c.pattern.volumeSpike ? 'volume spike confirmation' : 'moderate volume'}. Strength ${c.pattern.strength}.`,
        extension: c.extension,
        earnings_clear: true,
        dilution_clear: true,
      });
      existing.add(c.ticker);
      added++;
    }

    fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
    console.log(`\n📁 Appended ${added} candlestick signals to ${sigPath}`);
  }

  return topCandidates;
}

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}

module.exports = { main, scanPatterns, scoreCandlestick };
