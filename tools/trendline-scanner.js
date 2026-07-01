#!/usr/bin/env node
'use strict';

// trendline-scanner.js — Trend Momentum Scanner (faithful port of systematic-tss eu-trend)
//
// Aligned NATIVELY on systematic-tss/internal/engine/scanner_eu_trend.go (Cluster C4 "TREND
// MOMENTUM", the daily-bread trend cluster) + its position manager pm_eu_trend.go. This scanner
// produces the same BUY entry candidates as the Go backtest by replicating its gates and scoring:
//   - >= 200 bars, not a macro symbol, P80 daily $-volume >= threshold (liquidity)
//   - last-bar volume >= 1000
//   - DistMA200 >= 20% (strong uptrend, KEY discriminant)
//   - RSI in [50, 70] (healthy momentum, not overbought)
//   - ATR% in [4%, 12%] (enough vol, not excessive)
//   - additive score (base 50 + DistMA200/RSI/MA-alignment/pullback/ATR%/volume/momentum) >= 50
//   - global VIX gate: skip all entries when VIX > 35 (panic clusters handle it)
// Entry price = last close; stop = price - 2.5xATR; horizon = 25d (Go PM uses trailing, no fixed TP).
//
// articles STAYS INDEPENDENT of systematic-tss: this is a faithful JS re-implementation, it does NOT
// call the Go binary. tools/tss-orders.js is only a dev-time parity comparator.
//
// Usage:
//   node tools/trendline-scanner.js --universe americanbull --dry-run
//   node tools/trendline-scanner.js --universe americanbull --output signals --folder 20260701

const fs = require('fs');
const path = require('path');
const https = require('https');
const {
  calcSMA, calcRSI, calcATR, calcMomentum, calcAvgVolume,
  calcVolatility, calcDollarVolumePercentile,
} = require('./lib/fractal-indicators');

const ROOT = path.join(__dirname, '..');

const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}
const hasFlag = name => args.includes(`--${name}`);

const UNIVERSE_NAME = getArg('universe', 'americanbull');
const MIN_SCORE = parseFloat(getArg('min-score', '50'));   // eu-trend MinScore default = 50
const TOP_N = parseInt(getArg('top', '15'));
const OUTPUT_MODE = getArg('output', 'stdout');
const DRY_RUN = hasFlag('dry-run');
const SCAN_DATE = getArg('date', new Date().toISOString().slice(0, 10));
const SCAN_FOLDER = getArg('folder', null);
const REGIME = getArg('regime', null);
const CONCURRENCY = parseInt(getArg('concurrency', '10'));
const INTERVAL = getArg('interval', '1d'); // 1h, 4h, 1d

// ── eu-trend (scanner_eu_trend.go) faithful-port thresholds (CLI-overridable) ──
const MIN_DIST_MA200 = parseFloat(getArg('min-dist-ma200', '0.20')); // strong uptrend
const MIN_RSI = parseFloat(getArg('min-rsi', '50'));                 // momentum zone lo
const MAX_RSI = parseFloat(getArg('max-rsi', '70'));                 // momentum zone hi
const MIN_ATR_PCT = parseFloat(getArg('min-atr-pct', '0.04'));       // enough volatility
const MAX_ATR_PCT = parseFloat(getArg('max-atr-pct', '0.12'));       // not excessive
const MIN_P80_DVOL = parseFloat(getArg('min-p80-dvol', '100000'));   // P80 daily $-vol liquidity (US cfg = $100K)
const MAX_VIX = parseFloat(getArg('max-vix', '35'));                 // skip all entries above (panic clusters)

// Macro symbols excluded from scanning (mirror of staticdata.IsMacroSymbols in systematic-tss).
const MACRO_SYMBOLS = new Set([
  '^GSPC', '^VIX', '^STOXX50E', '^FCHI', 'V2TX.DE', '^N225', '^HSI', '^TNX',
  'DX-Y.NYB', 'USDJPY=X', 'EURUSD=X', 'EURGBP=X', 'EURCHF=X', 'EURJPY=X',
  'EURCNY=X', 'EURCAD=X', 'EURHKD=X', 'EURPLN=X', 'EURBRL=X', 'EURINR=X',
  'TLT', 'HYG', 'LQD', 'SPY', 'IWM', 'QQQ', 'GC=F', 'CL=F', 'SI=F', 'BTC-USD',
]);
const isMacroSymbol = sym => MACRO_SYMBOLS.has(sym);
const VOL_TICKER = '^VIX';

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
    eu: 'eu-universe.json', // univers EU (stockanalysis) — trendline EU
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
  // Supporte {tickers:[strings]}, {stocks:[{symbol}]} (eu-universe), array brut.
  const raw = data.tickers || data.stocks || (Array.isArray(data) ? data : []);
  return raw.map(x => (typeof x === 'string' ? x : (x && (x.symbol || x.ticker)))).filter(Boolean);
}

// ─── Yahoo OHLCV fetcher (shared cache) ─────────────────────────────────────

// ─── Interval-aware config ───────────────────────────────────────────────────

const INTERVAL_CONFIG = {
  '1h': { yahooInterval: '1h', range: '6mo', cacheDir: '.price-cache-1h', cacheTTL: 1, minBars: 120 },
  '4h': { yahooInterval: '1h', range: '6mo', cacheDir: '.price-cache-1h', cacheTTL: 1, minBars: 120, aggregate: 4 },
  '1d': { yahooInterval: '1d', range: '2y',  cacheDir: '.price-cache',    cacheTTL: 12, minBars: 120 },
};
const IC = INTERVAL_CONFIG[INTERVAL] || INTERVAL_CONFIG['1d'];
const CACHE_DIR = path.join(ROOT, 'data', IC.cacheDir);
const MIN_BARS = IC.minBars;

function readCache(ticker) {
  const fp = path.join(CACHE_DIR, `${ticker.replace(/[^a-zA-Z0-9]/g, '_')}_ohlcv.json`);
  if (!fs.existsSync(fp)) return null;
  const age = (Date.now() - fs.statSync(fp).mtimeMs) / 3600000;
  if (age > IC.cacheTTL) return null;
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return null; }
}

function writeCache(ticker, bars) {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  const fp = path.join(CACHE_DIR, `${ticker.replace(/[^a-zA-Z0-9]/g, '_')}_ohlcv.json`);
  fs.writeFileSync(fp, JSON.stringify(bars));
}

function aggregateTo4h(bars1h) {
  const grouped = {};
  for (const bar of bars1h) {
    const dt = new Date(bar.date);
    const h = dt.getUTCHours();
    const bucket = Math.floor(h / 4) * 4;
    const key = `${dt.toISOString().slice(0, 10)}T${String(bucket).padStart(2, '0')}`;
    if (!grouped[key]) {
      grouped[key] = { date: key, open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume };
    } else {
      const g = grouped[key];
      g.high = Math.max(g.high, bar.high);
      g.low = Math.min(g.low, bar.low);
      g.close = bar.close;
      g.volume += bar.volume;
    }
  }
  return Object.values(grouped);
}

function fetchYahoo(ticker) {
  return new Promise((resolve) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${IC.range}&interval=${IC.yahooInterval}`;
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
                date: new Date(ts[i] * 1000).toISOString().slice(0, 19),
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

async function fetchWithInterval(ticker) {
  // for 1h: use 1h cache directly (shared with 4h)
  // for 4h: fetch 1h, aggregate, but cache 1h raw data
  if (INTERVAL === '4h') {
    let bars1h = readCache(ticker);
    if (!bars1h) {
      bars1h = await fetchYahoo(ticker);
      if (bars1h) writeCache(ticker, bars1h);
    }
    if (!bars1h) return null;
    const bars4h = aggregateTo4h(bars1h);
    return bars4h.length >= MIN_BARS ? bars4h : null;
  }
  // 1h or 1d: fetch directly
  let bars = readCache(ticker);
  if (!bars) {
    bars = await fetchYahoo(ticker);
    if (bars) writeCache(ticker, bars);
  }
  return bars;
}

async function fetchBatch(tickers) {
  const results = {};
  let done = 0, valid = 0, cached = 0;
  for (let i = 0; i < tickers.length; i += CONCURRENCY) {
    const batch = tickers.slice(i, i + CONCURRENCY);
    const promises = batch.map(async t => {
      const cachedBars = readCache(t);
      if (cachedBars && INTERVAL !== '4h') { cached++; valid++; results[t] = cachedBars; return; }
      const bars = await fetchWithInterval(t);
      if (bars) { valid++; results[t] = bars; if (cachedBars) cached++; }
    });
    await Promise.all(promises);
    done += batch.length;
    process.stderr.write(`  fetched ${done}/${tickers.length} (${valid} valid, ${cached} cached)\r`);
  }
  process.stderr.write('\n');
  return results;
}

// ─── Trend-momentum scoring (faithful port of scanner_eu_trend.go::scoreSymbol) ──
//
// Same gates, same additive scoring, same tie-order semantics as the Go eu-trend scanner.
// vixLevel is passed only for the RewardScore/TimingScore fields (not used in gating here —
// the VIX skip is a global gate applied once in main(), matching Go's Scan()).

function scoreTicker(ticker, bars, vixLevel) {
  const n = bars.length;
  if (n < 200) return null; // Go Scan(): len(bars) < 200 → skip

  const price = bars[n - 1].close;
  if (price <= 0) return null;

  const atr = calcATR(bars, 14);
  const atrPct = atr / price;
  const ma20 = calcSMA(bars, 20);
  const ma50 = calcSMA(bars, 50);
  const ma200 = calcSMA(bars, 200);
  const rsi = calcRSI(bars, 14);
  const volatility = calcVolatility(bars, 20);
  const mom120 = calcMomentum(bars, 120);
  const avgVol20 = calcAvgVolume(bars, 20);

  let volRatio = 1.0;
  if (avgVol20 > 0) volRatio = (bars[n - 1].volume || 0) / avgVol20;

  const distMA20 = ma20 > 0 ? (price - ma20) / ma20 : 0;
  const distMA50 = ma50 > 0 ? (price - ma50) / ma50 : 0;
  const distMA200 = ma200 > 0 ? (price - ma200) / ma200 : 0;

  // Volume floor
  if ((bars[n - 1].volume || 0) < 1000) return null;

  // ── C4 gates: DistMA200 > 20% AND RSI 50-70 AND ATR% in [4%, 12%] ──
  if (distMA200 < MIN_DIST_MA200) return null;
  if (rsi < MIN_RSI || rsi > MAX_RSI) return null;
  if (atrPct < MIN_ATR_PCT) return null;
  if (atrPct > MAX_ATR_PCT) return null;

  // ── Scoring: trend strength focus ──
  let score = 50.0;

  // DistMA200 bonus (stronger trend = better)
  if (distMA200 >= 0.50) score += 35;
  else if (distMA200 >= 0.40) score += 30;
  else if (distMA200 >= 0.30) score += 25;
  else score += 15;

  // RSI sweet spot (55-65 ideal)
  if (rsi >= 55 && rsi <= 65) score += 20;
  else if (rsi >= 52 && rsi <= 68) score += 15;
  else score += 10;

  // MA alignment bonus (MA20 > MA50 > MA200)
  if (ma20 > ma50 && ma50 > ma200) score += 15;
  else if (price > ma20 && ma20 > ma200) score += 10;

  // Pullback bonus (slightly below MA20 but above MA50)
  if (distMA20 < 0.02 && distMA50 > 0) score += 15;

  // ATR% bonus
  if (atrPct >= 0.08) score += 15;
  else if (atrPct >= 0.06) score += 10;
  else score += 5;

  // Volume confirmation
  if (volRatio >= 2.0) score += 10;
  else if (volRatio >= 1.5) score += 5;

  // Momentum bonus
  if (mom120 > 0.30) score += 15;
  else if (mom120 > 0.20) score += 10;
  else if (mom120 > 0.10) score += 5;

  // Min score filter (Go MinScore default = 50)
  if (score < MIN_SCORE) return null;

  // ── Position-management values (Go PM eu-trend): 2.5xATR stop, 25d timeout, trailing ──
  // Go eu-trend has no fixed take-profit (trailing only); tp1/tp2 are informational ATR targets
  // for our own book display and are NOT part of entry-parity comparison.
  const stop = +(price - atr * 2.5).toFixed(6);
  const tp1 = +(price + atr * 3).toFixed(6);
  const tp2 = +(price + atr * 5).toFixed(6);
  const rr = price > stop ? +((tp1 - price) / (price - stop)).toFixed(2) : 0;

  return {
    ticker, score: +score.toFixed(1), price: +price.toFixed(6), entry: +price.toFixed(6),
    stop, tp1, tp2, rr, horizon: 25,
    metrics: {
      rsi: +rsi.toFixed(1), atrPct: +atrPct.toFixed(4), mom120: +mom120.toFixed(4),
      distMA200: +distMA200.toFixed(4), distMA20: +distMA20.toFixed(4), distMA50: +distMA50.toFixed(4),
      volRatio: +volRatio.toFixed(2), volatility: +volatility.toFixed(4),
      maAligned: (ma20 > ma50 && ma50 > ma200),
    },
    strategy: 'TrendlineBreakout',
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
  console.error(`📈 Trend-Momentum Scanner (eu-trend port)`);
  console.error(`   Universe: ${tickers.length} tickers (${UNIVERSE_NAME}) | minScore: ${MIN_SCORE} | top: ${TOP_N}`);
  console.error(`   Gates: DistMA200≥${(MIN_DIST_MA200 * 100).toFixed(0)}% RSI[${MIN_RSI},${MAX_RSI}] ATR%[${(MIN_ATR_PCT * 100).toFixed(0)},${(MAX_ATR_PCT * 100).toFixed(0)}] P80$vol≥${MIN_P80_DVOL} VIX≤${MAX_VIX}`);
  console.error(`   Date: ${SCAN_DATE} | Interval: ${INTERVAL} | Regime: ${REGIME || 'auto'}`);
  console.error('📡 Fetching OHLCV data via Yahoo...');

  // Fetch universe + volatility index (for the global VIX gate).
  const fetchList = tickers.includes(VOL_TICKER) ? tickers : [...tickers, VOL_TICKER];
  const allBars = await fetchBatch(fetchList);

  // Global VIX gate (Go Scan(): vixLevel > maxVIX → return nil for all).
  let vixLevel = 0;
  const vixBars = allBars[VOL_TICKER];
  if (vixBars && vixBars.length) vixLevel = vixBars[vixBars.length - 1].close;
  const vixStandDown = vixLevel > MAX_VIX;
  if (vixStandDown) {
    console.error(`   ⚠️  VIX ${vixLevel.toFixed(1)} > ${MAX_VIX} — trend cluster stands down (no entries, panic clusters handle it)`);
  }

  console.error('🔍 Scoring candidates (trend-momentum: DistMA200 / RSI zone / ATR%)...');

  const candidates = [];
  if (!vixStandDown) for (const ticker of tickers) {
    if (isMacroSymbol(ticker)) continue;             // Go: staticdata.IsMacroSymbols skip
    const bars = allBars[ticker];
    if (!bars || bars.length < 200) continue;        // Go: len(bars) < 200 skip
    // P80 daily $-volume liquidity filter (Go: MinP80DollarVolume)
    if (MIN_P80_DVOL > 0 && calcDollarVolumePercentile(bars, 20, 0.80) < MIN_P80_DVOL) continue;
    try {
      const result = scoreTicker(ticker, bars, vixLevel);
      if (result && result.score >= MIN_SCORE) {
        candidates.push(result);
      }
    } catch (e) {
      // skip ticker on error
    }
  }

  // Go sort: score desc, tie-break symbol asc.
  candidates.sort((a, b) => (b.score - a.score) || (a.ticker < b.ticker ? -1 : a.ticker > b.ticker ? 1 : 0));
  const topCandidates = candidates.slice(0, TOP_N);

  // ─── Output ─────────────────────────────────────────────────────────
  if (topCandidates.length === 0) {
    console.error('\n⚠️  No trend-momentum signals found.');
  } else {
    console.error(`\n✅ Found ${candidates.length} signals (passed all filters), top ${Math.min(TOP_N, topCandidates.length)}:`);
    for (const c of topCandidates) {
      const alignIcon = c.metrics.maAligned ? '📶' : '  ';
      console.error(
        `  📈 ${c.ticker.padEnd(10)} score: ${String(c.score).padStart(5)} ${alignIcon}` +
        ` DistMA200:${(c.metrics.distMA200 * 100).toFixed(0)}% RSI:${c.metrics.rsi}` +
        ` ATR%:${(c.metrics.atrPct * 100).toFixed(1)} Vol×:${c.metrics.volRatio} Mom120:${(c.metrics.mom120 * 100).toFixed(0)}%`
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
        horizon: c.horizon, region: detectRegion(c.ticker), universe: UNIVERSE_NAME,
        sharia: null,
        thesis: `Trend momentum: DistMA200 +${(c.metrics.distMA200 * 100).toFixed(0)}%, RSI ${c.metrics.rsi}, ATR% ${(c.metrics.atrPct * 100).toFixed(1)}%` +
          (c.metrics.maAligned ? `, MA20>MA50>MA200 aligned` : ''),
        extension: {
          distMA200: c.metrics.distMA200,
          rsi: c.metrics.rsi,
          atrPct: c.metrics.atrPct,
          volRatio: c.metrics.volRatio,
          maAligned: c.metrics.maAligned,
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
