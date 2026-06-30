#!/usr/bin/env node
'use strict';

// backtest-trendline.js — Walk-forward backtest for trendline breakout scanner
//
// Usage:
//   node tools/backtest-trendline.js --universe americanbull --sample 200
//   node tools/backtest-trendline.js --universe etf
//   node tools/backtest-trendline.js --universe forex
//   node tools/backtest-trendline.js --universe indices --interval 4h

const fs = require('fs');
const path = require('path');
const {
  calcSMA, calcRSI, calcATR, calcMomentum,
} = require('./lib/fractal-indicators');

const ROOT = path.join(__dirname, '..');

const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}

const UNIVERSE_NAME = getArg('universe', 'etf');
const INTERVAL = getArg('interval', '1d');
const SAMPLE_N = parseInt(getArg('sample', '0'));
const MIN_SCORE = parseFloat(getArg('min-score', '40'));
const HORIZON = parseInt(getArg('horizon', '21'));
const TOP_N = parseInt(getArg('top', '5'));
const PORTFOLIO_SIZE = parseInt(getArg('portfolio', '5'));
const INITIAL_CAPITAL = 100000;

// ─── Interval config ────────────────────────────────────────────────────────

const INTERVAL_CONFIG = {
  '1h': { cacheDir: '.price-cache-1h', minBars: 120 },
  '4h': { cacheDir: '.price-cache-1h', minBars: 120, aggregate: 4 },
  '1d': { cacheDir: '.price-cache', minBars: 120 },
};
const IC = INTERVAL_CONFIG[INTERVAL] || INTERVAL_CONFIG['1d'];
const CACHE_DIR = path.join(ROOT, 'data', IC.cacheDir);
const SWING_LOOKBACK = INTERVAL === '1d' ? 5 : 3;

// ─── Indices universe ───────────────────────────────────────────────────────

const INDICES_TICKERS = [
  '^GSPC', '^NDX', '^DJI', '^RUT',
  '^FCHI', '^GDAXI', '^FTSE', '^STOXX50E',
  '^N225', '^HSI', '^AXJO', '^KS11',
  '^IBEX', '^AEX', '^SSMI', '^BFX',
  'ES=F', 'NQ=F', 'YM=F', 'RTY=F',
  'GC=F', 'SI=F', 'CL=F', 'NG=F',
];

// ─── Universe loader ────────────────────────────────────────────────────────

function loadUniverse() {
  if (UNIVERSE_NAME === 'indices') return INDICES_TICKERS;
  const aliases = {
    forex: 'forex-universe.json',
    americanbull: 'americanbull-universe.json',
    metals: 'metals-universe.json',
    etf: 'etf-universe.json',
  };
  const file = aliases[UNIVERSE_NAME];
  if (!file) { console.error(`Unknown universe: ${UNIVERSE_NAME}`); process.exit(1); }
  const fp = path.join(ROOT, 'data', file);
  if (!fs.existsSync(fp)) { console.error(`Not found: ${fp}`); process.exit(1); }
  return JSON.parse(fs.readFileSync(fp, 'utf8')).tickers || [];
}

// ─── Load cached bars (no network) ──────────────────────────────────────────

function loadCachedBars(ticker) {
  const safeName = ticker.replace(/[^a-zA-Z0-9]/g, '_');
  const fp = path.join(CACHE_DIR, `${safeName}_ohlcv.json`);
  if (!fs.existsSync(fp)) return null;
  try {
    const bars = JSON.parse(fs.readFileSync(fp, 'utf8'));
    if (IC.aggregate === 4) return aggregateTo4h(bars);
    return bars;
  } catch { return null; }
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

// ─── Trendline detection (exact copy from trendline-scanner.js) ─────────────

function findSwingHighs(bars, lookback = SWING_LOOKBACK) {
  const swings = [];
  for (let i = lookback; i < bars.length - lookback; i++) {
    let isHigh = true;
    for (let j = 1; j <= lookback; j++) {
      if (bars[i].high <= bars[i - j].high || bars[i].high <= bars[i + j].high) { isHigh = false; break; }
    }
    if (isHigh) swings.push({ index: i, price: bars[i].high, date: bars[i].date });
  }
  return swings;
}

function findSwingLows(bars, lookback = SWING_LOOKBACK) {
  const swings = [];
  for (let i = lookback; i < bars.length - lookback; i++) {
    let isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (bars[i].low >= bars[i - j].low || bars[i].low >= bars[i + j].low) { isLow = false; break; }
    }
    if (isLow) swings.push({ index: i, price: bars[i].low, date: bars[i].date });
  }
  return swings;
}

function findDescendingTrendlines(swingHighs, bars) {
  const trendlines = [];
  const n = bars.length;
  const minSpan = INTERVAL === '1d' ? 10 : 6;

  for (let i = 0; i < swingHighs.length - 1; i++) {
    for (let j = i + 1; j < swingHighs.length; j++) {
      const p1 = swingHighs[i], p2 = swingHighs[j];
      if (p2.price >= p1.price) continue;
      if (p2.index - p1.index < minSpan) continue;
      const slope = (p2.price - p1.price) / (p2.index - p1.index);
      const dropPct = (p1.price - p2.price) / p1.price;
      if (dropPct < 0.02) continue;

      let valid = true, touches = 2;
      for (let k = p1.index + 1; k < p2.index; k++) {
        const linePrice = p1.price + slope * (k - p1.index);
        if (bars[k].close > linePrice * 1.002) { valid = false; break; }
        if (Math.abs(bars[k].high - linePrice) / linePrice < 0.003) touches++;
      }
      if (!valid) continue;

      const lastIdx = n - 1;
      const linePriceAtEnd = p1.price + slope * (lastIdx - p1.index);
      const currentPrice = bars[lastIdx].close;
      const broke = currentPrice > linePriceAtEnd;

      const maxAge = INTERVAL === '1d' ? 30 : 50;
      if (lastIdx - p2.index > maxAge) continue;

      trendlines.push({ p1, p2, slope, touches, broke, lineAtCurrent: linePriceAtEnd,
        breakoutPct: broke ? (currentPrice - linePriceAtEnd) / linePriceAtEnd : 0,
        span: p2.index - p1.index, age: lastIdx - p2.index });
    }
  }
  trendlines.sort((a, b) => {
    if (a.broke !== b.broke) return b.broke ? 1 : -1;
    if (b.touches !== a.touches) return b.touches - a.touches;
    return a.age - b.age;
  });
  return trendlines;
}

function findResistanceZones(bars, lookback = 100) {
  const n = bars.length, start = Math.max(0, n - lookback);
  const highs = [];
  for (let i = start; i < n; i++) highs.push(bars[i].high);
  highs.sort((a, b) => b - a);
  const zones = [], used = new Set();
  for (const h of highs) {
    if (used.has(h)) continue;
    const cluster = highs.filter(p => Math.abs(p - h) / h < 0.015 && !used.has(p));
    if (cluster.length >= 2) {
      zones.push({ price: cluster.reduce((s, p) => s + p, 0) / cluster.length, touches: cluster.length });
      cluster.forEach(p => used.add(p));
    }
  }
  return zones.sort((a, b) => a.price - b.price);
}

function detectBullishRSIDivergence(bars, period = 14, lookback = 30) {
  const n = bars.length;
  if (n < lookback + period) return { found: false };
  const swingLows = findSwingLows(bars.slice(0, -1), 3);
  const recentLows = swingLows.filter(s => s.index > n - lookback - 5);
  if (recentLows.length < 2) return { found: false };
  const low1 = recentLows[recentLows.length - 2], low2 = recentLows[recentLows.length - 1];
  if (low2.price >= low1.price) return { found: false };
  const rsi1 = calcRSI(bars.slice(0, low1.index + 1), period);
  const rsi2 = calcRSI(bars.slice(0, low2.index + 1), period);
  if (rsi2 <= rsi1) return { found: false };
  return { found: true, strength: (rsi2 - rsi1) / rsi1 };
}

// ─── Score a signal at bar index `endIdx` (bars sliced to [0..endIdx]) ──────

function scoreAtBar(bars, endIdx) {
  const slice = bars.slice(0, endIdx + 1);
  const n = slice.length;
  if (n < IC.minBars) return null;

  const price = slice[n - 1].close;
  const rsi = calcRSI(slice, 14);
  const atr = calcATR(slice, 14);
  if (atr === 0) return null;
  const sma50 = calcSMA(slice, 50);
  const sma200 = calcSMA(slice, 200);

  const swingHighs = findSwingHighs(slice, SWING_LOOKBACK);
  if (swingHighs.length < 2) return null;

  const trendlines = findDescendingTrendlines(swingHighs, slice);
  if (trendlines.length === 0) return null;

  const best = trendlines[0];
  if (!best.broke) return null;

  // breakout recency
  let breakoutBar = -1;
  for (let i = n - 1; i >= Math.max(0, n - 3); i--) {
    const lineP = best.p1.price + best.slope * (i - best.p1.index);
    if (slice[i].close > lineP && (i === 0 || slice[i - 1].close <= best.p1.price + best.slope * (i - 1 - best.p1.index))) {
      breakoutBar = i;
      break;
    }
  }
  // only take fresh breakouts (within last 2 bars for backtest to avoid stale re-entries)
  const breakoutRecency = n - 1 - (breakoutBar >= 0 ? breakoutBar : best.p2.index);
  if (breakoutRecency > 2) return null;

  const rsiDiv = detectBullishRSIDivergence(slice);

  // TP
  const resistanceZones = findResistanceZones(slice, 200);
  let tp1 = null;
  const aboveRes = resistanceZones.filter(z => z.price > price * 1.01);
  if (aboveRes.length >= 1) tp1 = aboveRes[0].price;
  if (!tp1) {
    const prevHigh = swingHighs.reduce((max, s) => s.price > max ? s.price : max, 0);
    if (prevHigh > price * 1.01) tp1 = prevHigh;
  }
  if (!tp1) tp1 = price + 3 * atr;

  // Stop
  const recentLows = findSwingLows(slice.slice(Math.max(0, n - 20)), 3);
  let stop;
  if (recentLows.length > 0) {
    stop = Math.min(...recentLows.map(s => s.price));
    stop = Math.min(stop, price - 1.5 * atr);
  } else {
    stop = price - 2 * atr;
  }

  const rr = stop < price && tp1 > price ? (tp1 - price) / (price - stop) : 0;
  if (rr < 1.5) return null;

  // Score
  let score = 0;
  score += Math.min(best.touches, 5) * 6;
  score += Math.min(best.breakoutPct * 500, 20);
  if (rsiDiv.found) score += 10 + Math.min(rsiDiv.strength * 50, 10);
  if (rsi < 40) score += 10; else if (rsi < 50) score += 7; else if (rsi < 60) score += 4;
  score += Math.min(rr * 5, 15);
  if (breakoutRecency <= 1) score += 10; else if (breakoutRecency <= 3) score += 7;
  if (best.span >= 40) score += 10; else if (best.span >= 25) score += 7; else if (best.span >= 15) score += 5;
  if (sma50 > 0 && sma200 > 0 && sma50 > sma200) score += 5;
  else if (sma50 > 0 && price > sma50) score += 3;

  if (score < MIN_SCORE) return null;

  return { score, entry: price, stop, tp1, rr, atr };
}

// ─── Walk-forward backtest ──────────────────────────────────────────────────

function backtestTicker(ticker, bars) {
  const trades = [];
  const n = bars.length;
  const startBar = Math.max(200, IC.minBars);
  let inTrade = false;
  let tradeEntry = 0, tradeStop = 0, tradeTp1 = 0, entryBar = 0;

  for (let i = startBar; i < n; i++) {
    // check open positions
    if (inTrade) {
      const bar = bars[i];
      const barsHeld = i - entryBar;

      // stop hit (check low)
      if (bar.low <= tradeStop) {
        trades.push({ ticker, entryBar, exitBar: i, entry: tradeEntry, exit: tradeStop,
          pnlPct: (tradeStop - tradeEntry) / tradeEntry, result: 'stop', barsHeld });
        inTrade = false;
        continue;
      }
      // TP1 hit (check high)
      if (bar.high >= tradeTp1) {
        trades.push({ ticker, entryBar, exitBar: i, entry: tradeEntry, exit: tradeTp1,
          pnlPct: (tradeTp1 - tradeEntry) / tradeEntry, result: 'tp1', barsHeld });
        inTrade = false;
        continue;
      }
      // horizon expired
      if (barsHeld >= HORIZON) {
        trades.push({ ticker, entryBar, exitBar: i, entry: tradeEntry, exit: bar.close,
          pnlPct: (bar.close - tradeEntry) / tradeEntry, result: 'expired', barsHeld });
        inTrade = false;
        continue;
      }
      continue;
    }

    // scan for new signal
    const signal = scoreAtBar(bars, i);
    if (signal) {
      inTrade = true;
      tradeEntry = signal.entry;
      tradeStop = signal.stop;
      tradeTp1 = signal.tp1;
      entryBar = i;
    }
  }

  return trades;
}

// ─── Compute metrics from trades ────────────────────────────────────────────

function computeMetrics(allTrades, allBars) {
  if (allTrades.length === 0) return null;

  const wins = allTrades.filter(t => t.pnlPct > 0);
  const losses = allTrades.filter(t => t.pnlPct <= 0);
  const winRate = wins.length / allTrades.length;
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnlPct, 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((s, t) => s + t.pnlPct, 0) / losses.length : 0;
  const avgPnl = allTrades.reduce((s, t) => s + t.pnlPct, 0) / allTrades.length;
  const tp1Hits = allTrades.filter(t => t.result === 'tp1').length;
  const stopHits = allTrades.filter(t => t.result === 'stop').length;
  const expired = allTrades.filter(t => t.result === 'expired').length;
  const avgBarsHeld = allTrades.reduce((s, t) => s + t.barsHeld, 0) / allTrades.length;

  // simulate equity curve (equal weight per trade, sequential by entry bar)
  const sorted = [...allTrades].sort((a, b) => a.entryBar - b.entryBar);
  let equity = INITIAL_CAPITAL;
  let peak = equity;
  let maxDD = 0;
  const equityCurve = [equity];
  const posSize = 1 / PORTFOLIO_SIZE; // fraction of equity per trade

  for (const t of sorted) {
    const alloc = equity * posSize;
    equity += alloc * t.pnlPct;
    if (equity > peak) peak = equity;
    const dd = (peak - equity) / peak;
    if (dd > maxDD) maxDD = dd;
    equityCurve.push(equity);
  }

  const totalReturn = (equity - INITIAL_CAPITAL) / INITIAL_CAPITAL;

  // approximate CAGR (assume ~250 trading days per year for daily, scaled for intraday)
  const barsPerYear = INTERVAL === '1d' ? 252 : INTERVAL === '4h' ? 252 * 6.5 / 4 : 252 * 6.5;
  const firstBar = Math.min(...sorted.map(t => t.entryBar));
  const lastBar = Math.max(...sorted.map(t => t.exitBar));
  const barSpan = lastBar - firstBar;
  const years = barSpan / barsPerYear;
  const cagr = years > 0 ? (Math.pow(equity / INITIAL_CAPITAL, 1 / years) - 1) : totalReturn;

  // Sharpe (annualized from per-trade returns)
  const returns = sorted.map(t => t.pnlPct);
  const meanR = returns.reduce((s, r) => s + r, 0) / returns.length;
  const stdR = Math.sqrt(returns.reduce((s, r) => s + (r - meanR) ** 2, 0) / returns.length);
  const tradesPerYear = allTrades.length / Math.max(years, 0.1);
  const sharpe = stdR > 0 ? (meanR / stdR) * Math.sqrt(tradesPerYear) : 0;

  // Profit Factor
  const grossProfit = wins.reduce((s, t) => s + t.pnlPct, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));
  const pf = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  return {
    trades: allTrades.length, wins: wins.length, losses: losses.length,
    winRate, avgWin, avgLoss, avgPnl, avgBarsHeld,
    tp1Hits, stopHits, expired,
    totalReturn, cagr, maxDD, sharpe, pf,
    finalEquity: equity,
  };
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  let tickers = loadUniverse();

  // sample if requested
  if (SAMPLE_N > 0 && tickers.length > SAMPLE_N) {
    // deterministic shuffle with seed
    const seeded = tickers.map((t, i) => ({ t, r: (i * 2654435761 >>> 0) / 4294967296 }));
    seeded.sort((a, b) => a.r - b.r);
    tickers = seeded.slice(0, SAMPLE_N).map(s => s.t);
  }

  console.log(`\n📐 Trendline Breakout Backtest`);
  console.log(`   Universe: ${tickers.length} tickers (${UNIVERSE_NAME}) | Interval: ${INTERVAL}`);
  console.log(`   MinScore: ${MIN_SCORE} | Horizon: ${HORIZON} | TopN: ${TOP_N} | Portfolio: ${PORTFOLIO_SIZE}`);
  console.log(`   Capital: $${INITIAL_CAPITAL.toLocaleString()}`);
  console.log('');

  // load all cached bars
  let loaded = 0, skipped = 0;
  const allBars = {};
  for (const ticker of tickers) {
    const bars = loadCachedBars(ticker);
    if (bars && bars.length >= IC.minBars) {
      allBars[ticker] = bars;
      loaded++;
    } else {
      skipped++;
    }
  }
  console.log(`   Loaded: ${loaded} tickers (${skipped} skipped — no cache or insufficient bars)`);

  // run walk-forward on each ticker
  const allTrades = [];
  let tickersWithSignals = 0;
  const tickerList = Object.keys(allBars);

  for (let i = 0; i < tickerList.length; i++) {
    const ticker = tickerList[i];
    const trades = backtestTicker(ticker, allBars[ticker]);
    if (trades.length > 0) {
      tickersWithSignals++;
      allTrades.push(...trades);
    }
    if ((i + 1) % 50 === 0 || i === tickerList.length - 1) {
      process.stdout.write(`   Backtested ${i + 1}/${tickerList.length} tickers (${allTrades.length} trades so far)\r`);
    }
  }
  console.log('');

  if (allTrades.length === 0) {
    console.log('\n⚠️  No trades generated. Strategy may be too restrictive for this universe/interval.');
    return;
  }

  const m = computeMetrics(allTrades);

  // ─── Results ────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  TRENDLINE BREAKOUT BACKTEST — ${UNIVERSE_NAME.toUpperCase()} (${INTERVAL})`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`  Tickers scanned    : ${loaded}`);
  console.log(`  Tickers w/ signals : ${tickersWithSignals}`);
  console.log(`  Total trades       : ${m.trades}`);
  console.log(`  Winners / Losers   : ${m.wins} / ${m.losses}`);
  console.log(`  Win Rate           : ${(m.winRate * 100).toFixed(1)}%`);
  console.log(`  Avg Win            : +${(m.avgWin * 100).toFixed(2)}%`);
  console.log(`  Avg Loss           : ${(m.avgLoss * 100).toFixed(2)}%`);
  console.log(`  Avg PnL/trade      : ${(m.avgPnl * 100).toFixed(2)}%`);
  console.log(`  Avg Bars Held      : ${m.avgBarsHeld.toFixed(1)}`);
  console.log(`  TP1 / Stop / Exp   : ${m.tp1Hits} / ${m.stopHits} / ${m.expired}`);
  console.log(`  ─────────────────────────────────`);
  console.log(`  Total Return       : ${(m.totalReturn * 100).toFixed(1)}%`);
  console.log(`  CAGR               : ${(m.cagr * 100).toFixed(1)}%`);
  console.log(`  Max Drawdown       : ${(m.maxDD * 100).toFixed(1)}%`);
  console.log(`  Sharpe Ratio       : ${m.sharpe.toFixed(2)}`);
  console.log(`  Profit Factor      : ${m.pf === Infinity ? '∞' : m.pf.toFixed(2)}`);
  console.log(`  Final Equity       : $${m.finalEquity.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`);
  console.log(`${'═'.repeat(60)}`);

  // top winners
  const topWins = [...allTrades].sort((a, b) => b.pnlPct - a.pnlPct).slice(0, 5);
  console.log(`\n  Top 5 Winners:`);
  for (const t of topWins) {
    console.log(`    ${t.ticker.padEnd(10)} +${(t.pnlPct * 100).toFixed(1)}% (${t.result}, ${t.barsHeld} bars)`);
  }

  // worst losers
  const topLoss = [...allTrades].sort((a, b) => a.pnlPct - b.pnlPct).slice(0, 5);
  console.log(`\n  Top 5 Losers:`);
  for (const t of topLoss) {
    console.log(`    ${t.ticker.padEnd(10)} ${(t.pnlPct * 100).toFixed(1)}% (${t.result}, ${t.barsHeld} bars)`);
  }
  console.log('');
}

main();
