#!/usr/bin/env node
'use strict';

/**
 * hybrid-scanner.js — Port of systematic-tss Hybrid Scanner
 *
 * Switches between AF (fractal-scanner), MegaCap, and DSL based on market breadth:
 *   - AF (aggressive) when >15% of stocks have >30% gain in 60d (broad momentum frenzy)
 *   - MEGACAP when narrow rally (index up but weak breadth, like 2023 Mag 7)
 *   - DSL (defensive) otherwise
 *   - BLEND modes for gray zones
 *
 * This scanner reads the shared cache from candlestick/fractal scanners.
 * It appends signals to an existing signals.json with strategy: "Hybrid-AF" / "Hybrid-MegaCap" / "Hybrid-DSL"
 *
 * Usage:
 *   node tools/hybrid-scanner.js --date 20260626 --folder 20260629 --output signals
 *   node tools/hybrid-scanner.js --date 20260626 --dry-run    # breadth analysis only
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const {
  calcSMA, calcRSI, calcATR, calcVolatility, calcMomentum,
  calcAvgVolume, calcDollarVolumePercentile, calcStochastic,
} = require('./lib/fractal-indicators');

const ROOT = path.join(__dirname, '..');
const CACHE_DIR = path.join(ROOT, 'data', '.price-cache');

const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}
const hasFlag = name => args.includes(`--${name}`);

const SCAN_DATE = getArg('date', new Date().toISOString().slice(0, 10));
const SCAN_FOLDER = getArg('folder', null);
const REGIME = getArg('regime', null);
const DRY_RUN = hasFlag('dry-run');
const OUTPUT_MODE = getArg('output', 'stdout');
const TOP_N = parseInt(getArg('top', '30'));
const CONCURRENCY = parseInt(getArg('concurrency', '15'));

const MEGA_CAP_TICKERS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK-B',
  'UNH', 'LLY', 'JPM', 'V', 'XOM', 'MA', 'JNJ', 'PG', 'HD', 'COST',
  'ABBV', 'MRK', 'AVGO', 'KO', 'PEP', 'WMT', 'BAC', 'CRM', 'TMO',
  'ORCL', 'ACN', 'MCD', 'LIN', 'AMD', 'CSCO', 'ABT', 'ADBE', 'NFLX',
  'WFC', 'GE', 'CAT', 'PM', 'TXN', 'QCOM', 'INTU', 'ISRG', 'AMGN',
  'GS', 'ELV', 'BKNG', 'AMAT', 'BLK',
];

// ─── Yahoo OHLCV fetcher ──────────────────────────────────────────────────

function readCache(ticker, minBars = 60) {
  const fp = path.join(CACHE_DIR, `${ticker}_ohlcv.json`);
  if (!fs.existsSync(fp)) return null;
  const age = (Date.now() - fs.statSync(fp).mtimeMs) / 3600000;
  if (age > 24) return null; // 24h for breadth analysis
  try {
    const bars = JSON.parse(fs.readFileSync(fp, 'utf8'));
    return bars.length >= minBars ? bars : null;
  } catch { return null; }
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
          if (bars.length >= 60) {
            fs.mkdirSync(CACHE_DIR, { recursive: true });
            fs.writeFileSync(path.join(CACHE_DIR, `${ticker}_ohlcv.json`), JSON.stringify(bars));
          }
          resolve(bars.length >= 60 ? bars : null);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null)).on('timeout', function() { this.destroy(); resolve(null); });
  });
}

async function ensureCached(tickers) {
  const missing = tickers.filter(t => !readCache(t));
  if (!missing.length) return;
  console.log(`  Fetching ${missing.length} uncached tickers...`);
  const queue = [...missing];
  async function worker() {
    while (queue.length) {
      const t = queue.shift();
      await fetchOHLCV(t);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
}

// ─── Breadth analysis (port of calcExtremePct, calcMegaCapConcentration) ────

function sliceBars(bars, scanDate) {
  const norm = scanDate.replace(/-/g, '');
  const cutIdx = bars.findIndex(b => b.date.replace(/-/g, '') > norm);
  return cutIdx > 0 ? bars.slice(0, cutIdx) : bars;
}

function calcExtremePct(allBars, scanDate) {
  let total = 0, extreme = 0;
  for (const [, rawBars] of allBars) {
    const bars = sliceBars(rawBars, scanDate);
    if (bars.length < 60) continue;
    total++;
    const n = bars.length;
    const mom60 = (bars[n - 1].close - bars[n - 60].close) / bars[n - 60].close;
    if (mom60 > 0.30) extreme++;
  }
  return total > 0 ? extreme / total : 0;
}

function calcMegaCapMomentum(allBars, megaTickers, scanDate) {
  const moms = [];
  for (const t of megaTickers) {
    const rawBars = allBars.get(t);
    if (!rawBars) continue;
    const bars = sliceBars(rawBars, scanDate);
    if (bars.length < 60) continue;
    const n = bars.length;
    const mom60 = (bars[n - 1].close - bars[n - 60].close) / bars[n - 60].close;
    moms.push(mom60);
  }
  return moms.length ? moms.reduce((s, m) => s + m, 0) / moms.length : 0;
}

function calcMegaCapConcentration(allBars, megaTickers, scanDate) {
  const stocks = [];
  for (const [ticker, rawBars] of allBars) {
    const bars = sliceBars(rawBars, scanDate);
    if (bars.length < 60) continue;
    const n = bars.length;
    const mom60 = (bars[n - 1].close - bars[n - 60].close) / bars[n - 60].close;
    if (mom60 > 0) {
      stocks.push({ ticker, mom60, isMega: megaTickers.includes(ticker) });
    }
  }
  if (stocks.length < 20) return 0;
  stocks.sort((a, b) => b.mom60 - a.mom60);
  const top20 = stocks.slice(0, 20);
  return top20.filter(s => s.isMega).length / 20;
}

function determineMode(allBars, scanDate, regime) {
  const extremePct = calcExtremePct(allBars, scanDate);
  const megaConc = calcMegaCapConcentration(allBars, MEGA_CAP_TICKERS, scanDate);
  const megaMom = calcMegaCapMomentum(allBars, MEGA_CAP_TICKERS, scanDate);
  const isRiskOn = regime && regime.toUpperCase().includes('RISK_ON');

  const isMegaCapRally = megaConc > 0.25 && extremePct < 0.10 && isRiskOn;

  let mode = 'DSL';
  if (extremePct > 0.15) {
    mode = 'AF';
  } else if (isMegaCapRally) {
    mode = 'MEGACAP';
  } else if (extremePct >= 0.12 && extremePct <= 0.15) {
    mode = 'BLEND';
  } else if (isRiskOn && extremePct >= 0.08) {
    mode = 'BLEND';
  } else if (megaConc >= 0.20 && megaMom >= 0.05 && extremePct < 0.08) {
    mode = 'MEGACAP';
  }

  return {
    mode,
    extremePct: +(extremePct * 100).toFixed(1),
    megaCapConcentration: +(megaConc * 100).toFixed(1),
    megaCapMomentum: +(megaMom * 100).toFixed(1),
  };
}

// ─── MegaCap scorer (simplified AF for mega-caps only) ──────────────────────

function scoreMegaCap(bars, regime) {
  const n = bars.length;
  if (n < 120) return null;
  const price = bars[n - 1].close;
  if (price <= 0) return null;

  const sma20 = calcSMA(bars, 20);
  const sma50 = calcSMA(bars, 50);
  const sma200 = n >= 200 ? calcSMA(bars, 200) : sma50;
  const rsi = calcRSI(bars, 14);
  const atr = calcATR(bars, 14);
  const mom60 = calcMomentum(bars, 60);
  const mom120 = calcMomentum(bars, 120);

  if (rsi > 80 || rsi < 25) return null;
  if (price < sma50) return null;
  if (mom60 < -0.05) return null;

  let score = 50;
  if (price > sma20 && sma20 > sma50) score += 20;
  if (mom60 > 0.15) score += 15;
  if (mom120 > 0.30) score += 15;
  if (rsi >= 50 && rsi <= 65) score += 10;
  if (rsi > 70) score -= 5;

  const distMA20 = sma20 > 0 ? (price - sma20) / sma20 : 0;
  const distMA50 = sma50 > 0 ? (price - sma50) / sma50 : 0;

  return {
    score: +score.toFixed(2),
    price, entry: price,
    stop: +(price - atr * 2.0).toFixed(4),
    atr, rsi, mom60, mom120,
    distMA20: +distMA20.toFixed(4),
    distMA50: +distMA50.toFixed(4),
    sma20, sma50,
    strategy: 'megacap',
  };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔄 Hybrid Scanner (systematic-tss port)');
  console.log(`   Date: ${SCAN_DATE} | Regime: ${REGIME || 'auto'}`);

  // Load universe for breadth analysis
  const uniPath = path.join(ROOT, 'data', 'americanbull-universe.json');
  if (!fs.existsSync(uniPath)) { console.error('❌ americanbull-universe.json not found'); process.exit(1); }
  const universe = JSON.parse(fs.readFileSync(uniPath, 'utf8')).tickers || [];

  // Read all cached bars for breadth calculation
  console.log('📊 Loading cached OHLCV for breadth analysis...');
  const allBars = new Map();
  let loaded = 0;
  for (const t of universe) {
    const bars = readCache(t);
    if (bars) { allBars.set(t, bars); loaded++; }
  }
  console.log(`   ${loaded}/${universe.length} tickers cached`);

  if (loaded < 200) {
    console.log('⚠️  Insufficient cached data for breadth. Run fractal-scanner first to populate cache.');
    console.log('   Defaulting to DSL mode.');
    console.log(JSON.stringify({ mode: 'DSL', extremePct: 0, megaCapConcentration: 0, note: 'insufficient data' }));
    return;
  }

  // Determine scanner mode based on breadth
  const analysis = determineMode(allBars, SCAN_DATE, REGIME);
  console.log(`\n📈 Breadth Analysis:`);
  console.log(`   Extreme Momentum: ${analysis.extremePct}% of stocks with >30% gain in 60d`);
  console.log(`   MegaCap Concentration: ${analysis.megaCapConcentration}% of top-20 momentum are mega-caps`);
  console.log(`   MegaCap Avg Momentum: ${analysis.megaCapMomentum}%`);
  console.log(`   → Mode: ${analysis.mode}`);

  if (DRY_RUN) {
    console.log(JSON.stringify(analysis, null, 2));
    return;
  }

  // For AF and BLEND modes, the fractal-scanner.js already ran and produced signals.
  // For MEGACAP mode, we need to score mega-caps specifically.
  if (analysis.mode === 'MEGACAP' || analysis.mode === 'BLEND_MEGA') {
    console.log('\n🏢 Scoring Mega-Cap candidates...');
    await ensureCached(MEGA_CAP_TICKERS);
    const candidates = [];
    const scanDateNorm = SCAN_DATE.replace(/-/g, '');

    for (const t of MEGA_CAP_TICKERS) {
      const rawBars = readCache(t);
      if (!rawBars) continue;
      const cutIdx = rawBars.findIndex(b => b.date.replace(/-/g, '') > scanDateNorm);
      const bars = cutIdx > 0 ? rawBars.slice(0, cutIdx) : rawBars;
      const result = scoreMegaCap(bars, REGIME);
      if (!result || result.score < 50) continue;

      const risk = result.entry - result.stop;
      if (risk <= 0) continue;
      candidates.push({
        ticker: t, score: result.score,
        entry: +result.entry.toFixed(2), stop: +result.stop.toFixed(2),
        tp1: +(result.entry + risk * 2).toFixed(2),
        tp2: +(result.entry + risk * 3).toFixed(2),
        rr: '1:2.0',
        metrics: result,
      });
    }
    candidates.sort((a, b) => b.score - a.score);
    const top = candidates.slice(0, TOP_N);
    console.log(`   Found ${candidates.length} mega-cap signals, top ${top.length}:`);
    for (const c of top) {
      console.log(`     ${c.ticker.padEnd(6)} score:${c.score} E:${c.entry} RSI:${c.metrics.rsi.toFixed(0)} Mom60:${(c.metrics.mom60 * 100).toFixed(0)}%`);
    }

    if (OUTPUT_MODE === 'signals' && top.length) {
      const scanDir = SCAN_FOLDER || SCAN_DATE.replace(/-/g, '');
      const sigPath = path.join(ROOT, 'scanner', scanDir, 'signals.json');
      if (fs.existsSync(sigPath)) {
        const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
        const existing = new Set((signals.signals || []).map(s => s.ticker));
        let added = 0;
        for (const c of top) {
          if (existing.has(c.ticker)) continue;
          signals.signals.push({
            ticker: c.ticker, name: c.ticker, score: c.score, strategy: 'HybridMegaCap',
            entry: c.entry, stop: c.stop, tp1: c.tp1, tp2: c.tp2, rr: c.rr,
            horizon: 21, region: 'US', sharia: null,
            thesis: `MegaCap score ${c.score}: Mom60=${(c.metrics.mom60 * 100).toFixed(0)}%, RSI=${c.metrics.rsi.toFixed(0)}`,
          });
          existing.add(c.ticker);
          added++;
        }
        fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
        console.log(`   Appended ${added} mega-cap signals to ${sigPath}`);
      }
    }
  }

  // Write breadth analysis to signals metadata
  if (OUTPUT_MODE === 'signals') {
    const scanDir = SCAN_FOLDER || SCAN_DATE.replace(/-/g, '');
    const sigPath = path.join(ROOT, 'scanner', scanDir, 'signals.json');
    if (fs.existsSync(sigPath)) {
      const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
      signals.breadth = analysis;
      fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
      console.log(`\n📁 Breadth analysis written to ${sigPath}`);
    }
  }

  console.log('\n✅ Done.');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
