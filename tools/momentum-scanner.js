#!/usr/bin/env node
'use strict';

/**
 * momentum-scanner.js — Momentum Rotation Scanner (exact port of systematic-tss)
 *
 * Momentum ranking scanner: MA50>MA200 uptrend, positive momentum 20/50/100d,
 * weighted scoring, consistency bonus. Used by Casablanca (MA) and EU configs.
 *
 * Usage:
 *   node tools/momentum-scanner.js --dry-run
 *   node tools/momentum-scanner.js --universe americanbull --top 20
 *   node tools/momentum-scanner.js --output signals --folder 20260629
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const {
  calcSMA, calcRSI, calcATR, calcVolatility, calcMomentum,
  calcAvgVolume, calcMedianVolume, calcDollarVolumePercentile,
} = require('./lib/fractal-indicators');
const { batchFetchBVC } = require('./lib/bvc-fetcher');

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
const MIN_SCORE = parseFloat(getArg('min-score', '5'));
const TOP_N = parseInt(getArg('top', '20'));
const OUTPUT_MODE = getArg('output', 'stdout');
const DRY_RUN = hasFlag('dry-run');
const SCAN_DATE = getArg('date', new Date().toISOString().slice(0, 10));
const SCAN_FOLDER = getArg('folder', null);
const REGIME = getArg('regime', null);
const CONCURRENCY = parseInt(getArg('concurrency', '10'));

const IS_BVC = UNIVERSE_NAME === 'casablanca';

const UNIVERSE_FILES = {
  americanbull: 'americanbull-universe.json',
  metals: 'metals-universe.json',
  forex: 'forex-universe.json',
  casablanca: 'casablanca-universe.json',
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

// ─── Yahoo OHLCV fetcher (shared cache) ─────────────────────────────────────

const MIN_BARS = IS_BVC ? 120 : 200;

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
      if (done % 100 === 0) process.stderr.write(`  fetched ${done}/${tickers.length} (${result.size} valid, ${cached} cached)\r`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  process.stderr.write(`  fetched ${done}/${tickers.length} (${result.size} valid, ${cached} cached)\n`);
  return result;
}

// ─── Momentum Rotation Scoring (exact port of scanner_momentum_rotation.go) ─

function scoreSymbol(bars, regime) {
  const n = bars.length;
  if (n < MIN_BARS) return null;
  const price = bars[n - 1].close;
  if (price <= 0 || !isFinite(price)) return null;

  const mom20 = calcMomentum(bars, 20);
  const mom50 = calcMomentum(bars, 50);
  const mom100 = calcMomentum(bars, 100);
  const ma50 = calcSMA(bars, 50);
  const ma200 = calcSMA(bars, 200);
  const ma20 = calcSMA(bars, 20);
  const atr = calcATR(bars, 14);
  const rsi = calcRSI(bars, 14);

  if (ma50 <= 0 || atr <= 0) return null;

  const atrPct = atr / price;

  // FILTER 1: Uptrend (MA50 > MA200). SMA200 returns 0 if < 200 bars → filter passes.
  if (ma200 > 0 && ma50 <= ma200) return null;

  // FILTER 2: Positive momentum 20d
  if (mom20 < 0) return null;

  // FILTER 3: ATR% between 1-10%
  if (atrPct < 0.01 || atrPct > 0.10) return null;

  // FILTER 4: RSI 30-80
  if (rsi < 30 || rsi > 80) return null;

  // SCORING: Weighted momentum combination
  let score = mom20 * 50 + mom50 * 30 + mom100 * 20;

  // Consistency bonus (all 3 momentum periods positive)
  if (mom20 > 0 && mom50 > 0 && mom100 > 0) {
    score *= 1.2;
  }

  score = Math.round(score * 100) / 100;

  if (score < MIN_SCORE) return null;

  const distMA20 = ma20 > 0 ? (price - ma20) / ma20 : 0;
  const distMA50 = (price - ma50) / ma50;
  const distMA200 = (price - ma200) / ma200;
  const avgVol20 = calcAvgVolume(bars, 20);
  const volRatio = avgVol20 > 0 ? (bars[n - 1].volume || 0) / avgVol20 : 0;

  const stopLoss = price - 2 * atr;

  return {
    score, price, entry: price,
    stop: +stopLoss.toFixed(4),
    atr, atrPct, rsi,
    mom20, mom50, mom100,
    volRatio: +volRatio.toFixed(2),
    distMA20: +distMA20.toFixed(4),
    distMA50: +distMA50.toFixed(4),
    distMA200: +distMA200.toFixed(4),
    sma20: ma20, sma50: ma50, sma200: ma200,
    strategy: 'momentum-rotation',
  };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const universe = loadUniverse();
  console.log(`🔄 Momentum Rotation Scanner (systematic-tss port)`);
  console.log(`   Universe: ${universe.length} tickers (${UNIVERSE_NAME}) | minScore: ${MIN_SCORE} | top: ${TOP_N}`);
  console.log(`   Date: ${SCAN_DATE} | Regime: ${REGIME || 'auto'}`);

  let priceData;
  if (IS_BVC) {
    console.log(`📡 Fetching OHLCV data via BVC API...`);
    priceData = await batchFetchBVC(CONCURRENCY);
  } else {
    console.log(`📡 Fetching OHLCV data via Yahoo...`);
    priceData = await batchFetch(universe, CONCURRENCY);
  }
  if (!priceData.size) { console.error('❌ No OHLCV data — aborting.'); process.exit(1); }

  console.log('🔍 Scoring candidates (momentum ranking)...');
  const candidates = [];
  const scanDateNorm = SCAN_DATE.replace(/-/g, '');

  for (const [ticker, rawBars] of priceData) {
    const cutIdx = rawBars.findIndex(b => b.date.replace(/-/g, '') > scanDateNorm);
    const bars = cutIdx > 0 ? rawBars.slice(0, cutIdx) : rawBars;

    if (!IS_BVC) {
      const dvP80 = calcDollarVolumePercentile(bars, 20, 0.80);
      if (dvP80 < 100_000) continue;
    }

    const result = scoreSymbol(bars, REGIME);
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
  const topCandidates = candidates.slice(0, TOP_N);

  console.log(`\n✅ Found ${candidates.length} signals (passed all filters), top ${topCandidates.length}:`);
  for (const c of topCandidates) {
    const icon = c.score >= 30 ? '🚀' : c.score >= 15 ? '📈' : '  ';
    const consistent = c.metrics.mom20 > 0 && c.metrics.mom50 > 0 && c.metrics.mom100 > 0 ? '★' : ' ';
    console.log(`  ${icon} ${c.ticker.padEnd(8)} score:${c.score.toFixed(1).padStart(6)} ${consistent} Mom20:${(c.metrics.mom20 * 100).toFixed(1)}% Mom50:${(c.metrics.mom50 * 100).toFixed(1)}% Mom100:${(c.metrics.mom100 * 100).toFixed(1)}% RSI:${c.metrics.rsi.toFixed(0)}`);
  }

  if (DRY_RUN) { console.log('\n🏷️  Dry run — no files written.'); return topCandidates; }

  if (OUTPUT_MODE === 'json') {
    const outPath = path.join(ROOT, 'data', `momentum-scan-${UNIVERSE_NAME}-${SCAN_DATE}.json`);
    fs.writeFileSync(outPath, JSON.stringify({ scanDate: SCAN_DATE, regime: REGIME, universe: UNIVERSE_NAME, candidates: topCandidates }, null, 2));
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
        ticker: c.ticker, name: c.ticker, score: c.score, strategy: 'MomentumRotation',
        entry: c.entry, stop: c.stop, tp1: c.tp1, tp2: c.tp2, rr: c.rr,
        horizon: 21, region: UNIVERSE_NAME === 'americanbull' ? 'US' : UNIVERSE_NAME.toUpperCase(),
        sharia: null,
        thesis: `MomRot score ${c.score.toFixed(1)}: Mom20=${(c.metrics.mom20 * 100).toFixed(1)}%, Mom50=${(c.metrics.mom50 * 100).toFixed(1)}%, Mom100=${(c.metrics.mom100 * 100).toFixed(1)}%, RSI=${c.metrics.rsi.toFixed(0)}`,
        extension: { mom20: +c.metrics.mom20.toFixed(4), mom50: +c.metrics.mom50.toFixed(4), mom100: +c.metrics.mom100.toFixed(4) },
      });
      existing.add(c.ticker);
      added++;
    }
    fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
    console.log(`\n📁 Appended ${added} momentum signals to ${sigPath}`);
  }

  return topCandidates;
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
