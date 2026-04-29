#!/usr/bin/env node
/**
 * VWAP Entry Gate — Impact Study
 * Compares 3 entry strategies across all historical trades:
 *   A) Market open (current: entry = open price)
 *   B) VWAP entry (entry = typical price = (H+L+C)/3 of day 1)
 *   C) VWAP gate (skip trade if open > VWAP*1.01, else enter at min(open, VWAP))
 *
 * Uses daily OHLC from the price cache built by sweep.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HISTORY_DIR = path.join(ROOT, 'scanner', 'status', 'history');

// Load latest snapshot for closed trades
const dates = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, 'dates.json'), 'utf8'));
const latestSnap = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, `${dates[dates.length - 1]}.json`), 'utf8'));

// Load price data from scanner data files
const SCAN_DIR = path.join(ROOT, 'data');
const priceCache = {};

function loadPrices(ticker) {
  if (priceCache[ticker]) return priceCache[ticker];
  // Try Yahoo-style daily bars from data/scanner-metrics or fetch from data files
  return null;
}

// Build price history from all scanner data.json files
const scannerDir = path.join(ROOT, 'scanner');
const scanDates = fs.readdirSync(scannerDir).filter(f => /^\d{8}$/.test(f)).sort();

// We need intraday-approximated VWAP. With daily bars only, VWAP ≈ (H+L+C)/3
// Load backtest-trades.json which has actualEntry (=open) for each trade
const tradesFile = path.join(SCAN_DIR, 'backtest-trades.json');
const allModes = JSON.parse(fs.readFileSync(tradesFile, 'utf8'));

// Load price histories from scanner-positions or scanner-metrics
const metricsFile = path.join(SCAN_DIR, 'scanner-metrics.json');
let metrics = {};
if (fs.existsSync(metricsFile)) {
  metrics = JSON.parse(fs.readFileSync(metricsFile, 'utf8'));
}

// We need daily OHLCV for each trade's entry date. Let's use Yahoo via the price cache
// that sweep.js builds. Actually, let's reconstruct from the snapshots.

// Collect all unique trades across all modes
const modes = ['turbo', 'dynamic', 'balanced', 'secured', 'fortress'];
const uniqueTrades = new Map(); // key: ticker|scanDate|mode

for (const modeId of modes) {
  const modeData = allModes[modeId];
  if (!modeData) continue;
  for (const t of modeData) {
    const key = `${t.ticker}|${t.scanDate}|${modeId}`;
    if (!uniqueTrades.has(key)) {
      uniqueTrades.set(key, { ...t, mode: modeId });
    }
  }
}

console.log(`Total trades loaded: ${uniqueTrades.size}`);

// For each trade we need the entry day's OHLC to compute VWAP proxy
// The trade has actualEntry (=open). We need H, L, C of entry day.
// Let's fetch from Yahoo for the tickers we need.

const tickers = [...new Set([...uniqueTrades.values()].map(t => t.ticker))];
console.log(`Unique tickers: ${tickers.length} — ${tickers.join(', ')}`);

// Use the sweep price cache approach — read from data/price-cache/ if exists
const CACHE_DIR = path.join(SCAN_DIR, 'price-cache');

async function fetchDailyBars(ticker) {
  // Try local cache first
  const cacheFile = path.join(CACHE_DIR, `${ticker}.json`);
  if (fs.existsSync(cacheFile)) {
    return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  }
  return null;
}

// Since we may not have a price cache, let's use the data embedded in snapshots
// Each snapshot has modes[x].positions with current_price, and closedTrades with actualEntry/exitPrice
// But we need OHLC of entry day specifically.

// Alternative: compute from the trade data we DO have
// actualEntry = open, exitPrice = close/stop/tp
// For VWAP proxy, we need H and L of entry day which we don't have directly.

// BEST APPROACH: Use Yahoo Finance API to fetch daily bars for all tickers
const https = require('https');
const http = require('http');

function yahooFetch(ticker, period1, period2) {
  return new Promise((resolve, reject) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${period1}&period2=${period2}&interval=1d`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          const r = j.chart?.result?.[0];
          if (!r) { resolve({}); return; }
          const ts = r.timestamp || [];
          const q = r.indicators?.quote?.[0] || {};
          const bars = {};
          for (let i = 0; i < ts.length; i++) {
            const d = new Date(ts[i] * 1000);
            const key = d.toISOString().slice(0, 10).replace(/-/g, '');
            bars[key] = {
              open: q.open?.[i] || 0,
              high: q.high?.[i] || 0,
              low: q.low?.[i] || 0,
              close: q.close?.[i] || 0,
              volume: q.volume?.[i] || 0
            };
          }
          resolve(bars);
        } catch (e) { resolve({}); }
      });
      res.on('error', () => resolve({}));
    }).on('error', () => resolve({}));
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  // Fetch 6 months of daily bars for all tickers
  const period1 = Math.floor(new Date('2026-02-01').getTime() / 1000);
  const period2 = Math.floor(Date.now() / 1000);

  const priceData = {};
  console.log('\nFetching daily bars from Yahoo...');
  for (let i = 0; i < tickers.length; i++) {
    const t = tickers[i];
    priceData[t] = await yahooFetch(t, period1, period2);
    const barCount = Object.keys(priceData[t]).length;
    if (barCount === 0) console.log(`  ⚠ ${t}: no data`);
    if (i > 0 && i % 5 === 0) await sleep(500); // rate limit
  }
  console.log(`Fetched bars for ${tickers.length} tickers\n`);

  // Now analyze each trade under 3 strategies
  const results = { A: [], B: [], C: [] };

  for (const [key, trade] of uniqueTrades) {
    const bars = priceData[trade.ticker];
    if (!bars) continue;
    const dateKey = (trade.scanDate || trade.entryDate || '').replace(/-/g, '');
    const entryDay = bars[dateKey];
    if (!entryDay || !entryDay.high || !entryDay.low) continue;

    const openPrice = entryDay.open;
    const vwap = (entryDay.high + entryDay.low + entryDay.close) / 3;
    const actualExit = trade.exitPrice || 0;
    if (!openPrice || !actualExit) continue;

    // Strategy A: Market open (current system)
    const pnlA = (actualExit - openPrice) / openPrice * 100;

    // Strategy B: VWAP entry (enter at VWAP if reachable during the day)
    // VWAP is between low and high by definition, so it's always reachable
    const entryB = vwap;
    // But exit logic changes — if entry is different, stop/tp distances shift proportionally
    // For simplicity: assume same exit price (conservative — real impact may be bigger)
    const pnlB = (actualExit - entryB) / entryB * 100;

    // Strategy C: VWAP gate — skip if open > VWAP*1.01, else enter at min(open, VWAP)
    const gapAboveVwap = openPrice > vwap * 1.01;
    const entryC = gapAboveVwap ? null : Math.min(openPrice, vwap);
    const pnlC = entryC ? (actualExit - entryC) / entryC * 100 : null;

    results.A.push({ ...trade, entry: openPrice, pnl: pnlA, vwap, exitPrice: actualExit });
    results.B.push({ ...trade, entry: entryB, pnl: pnlB, vwap, exitPrice: actualExit });
    if (pnlC !== null) {
      results.C.push({ ...trade, entry: entryC, pnl: pnlC, vwap, exitPrice: actualExit, skipped: false });
    } else {
      results.C.push({ ...trade, entry: null, pnl: 0, vwap, exitPrice: actualExit, skipped: true });
    }
  }

  // Compute aggregate stats
  function stats(arr, label) {
    const executed = arr.filter(t => !t.skipped);
    const skipped = arr.filter(t => t.skipped);
    const wins = executed.filter(t => t.pnl > 0.1);
    const losses = executed.filter(t => t.pnl < -0.1);
    const be = executed.filter(t => Math.abs(t.pnl) <= 0.1);
    const totalPnl = executed.reduce((s, t) => s + t.pnl, 0);
    const avgPnl = executed.length ? totalPnl / executed.length : 0;
    const winPnl = wins.reduce((s, t) => s + t.pnl, 0);
    const lossPnl = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    const pf = lossPnl > 0 ? winPnl / lossPnl : 99;
    const wr = executed.length ? (wins.length / executed.length * 100) : 0;

    console.log(`\n═══ Strategy ${label} ═══`);
    console.log(`  Trades executed: ${executed.length}  |  Skipped: ${skipped.length}`);
    console.log(`  Wins: ${wins.length}  |  Losses: ${losses.length}  |  BE: ${be.length}`);
    console.log(`  Win Rate: ${wr.toFixed(1)}%`);
    console.log(`  Avg PnL/trade: ${avgPnl.toFixed(3)}%`);
    console.log(`  Total PnL: ${totalPnl.toFixed(2)}%`);
    console.log(`  Profit Factor: ${pf.toFixed(2)}x`);

    // Show worst trades
    const worst = [...executed].sort((a, b) => a.pnl - b.pnl).slice(0, 5);
    console.log(`  Worst 5:`);
    worst.forEach(t => console.log(`    ${t.ticker} ${t.scanDate} ${t.mode}: ${t.pnl.toFixed(2)}% (entry=${t.entry.toFixed(2)}, vwap=${t.vwap.toFixed(2)})`));

    if (skipped.length > 0) {
      const skippedWouldWin = skipped.filter(t => {
        // What would have happened at open?
        const openEntry = t.vwap; // approximate
        return t.exitPrice > openEntry;
      });
      console.log(`  Skipped trades that would have been winners: ${skippedWouldWin.length}/${skipped.length}`);
    }

    return { executed: executed.length, skipped: skipped.length, wr, avgPnl, totalPnl, pf };
  }

  console.log('\n' + '='.repeat(60));
  console.log('VWAP ENTRY GATE — IMPACT STUDY');
  console.log(`Dataset: ${uniqueTrades.size} trades, ${tickers.length} tickers`);
  console.log(`Period: Feb 2026 — Apr 2026`);
  console.log('='.repeat(60));

  const sA = stats(results.A, 'A — Market Open (current)');
  const sB = stats(results.B, 'B — VWAP Entry (always enter at VWAP)');
  const sC = stats(results.C, 'C — VWAP Gate (skip if open > VWAP*1.01)');

  console.log('\n' + '='.repeat(60));
  console.log('COMPARATIVE SUMMARY');
  console.log('='.repeat(60));
  console.log(`| Strategy    | Trades | WR     | Avg PnL | Total PnL | PF    |`);
  console.log(`|-------------|--------|--------|---------|-----------|-------|`);
  console.log(`| A Open      | ${sA.executed.toString().padEnd(6)} | ${sA.wr.toFixed(1).padEnd(6)}%| ${sA.avgPnl.toFixed(3).padEnd(7)}%| ${sA.totalPnl.toFixed(1).padEnd(9)}%| ${sA.pf.toFixed(2).padEnd(5)}x|`);
  console.log(`| B VWAP      | ${sB.executed.toString().padEnd(6)} | ${sB.wr.toFixed(1).padEnd(6)}%| ${sB.avgPnl.toFixed(3).padEnd(7)}%| ${sB.totalPnl.toFixed(1).padEnd(9)}%| ${sB.pf.toFixed(2).padEnd(5)}x|`);
  console.log(`| C VWAP Gate | ${sC.executed.toString().padEnd(6)} | ${sC.wr.toFixed(1).padEnd(6)}%| ${sC.avgPnl.toFixed(3).padEnd(7)}%| ${sC.totalPnl.toFixed(1).padEnd(9)}%| ${sC.pf.toFixed(2).padEnd(5)}x|`);

  const deltaAvg = sC.avgPnl - sA.avgPnl;
  const deltaWR = sC.wr - sA.wr;
  console.log(`\nVWAP Gate vs Open: Avg PnL ${deltaAvg > 0 ? '+' : ''}${deltaAvg.toFixed(3)}%/trade, WR ${deltaWR > 0 ? '+' : ''}${deltaWR.toFixed(1)}pp`);
  console.log(`Trades skipped by gate: ${sC.skipped}`);

  // Per-mode breakdown
  console.log('\n── Per-mode breakdown (Strategy C vs A) ──');
  for (const modeId of modes) {
    const modeA = results.A.filter(t => t.mode === modeId);
    const modeC = results.C.filter(t => t.mode === modeId);
    const execC = modeC.filter(t => !t.skipped);
    const skipC = modeC.filter(t => t.skipped);
    const pnlA = modeA.reduce((s, t) => s + t.pnl, 0);
    const pnlC = execC.reduce((s, t) => s + t.pnl, 0);
    console.log(`  ${modeId.padEnd(10)}: A=${pnlA.toFixed(1)}% (${modeA.length}t) → C=${pnlC.toFixed(1)}% (${execC.length}t, ${skipC.length} skipped) | Δ=${(pnlC-pnlA).toFixed(1)}%`);
  }
}

main().catch(console.error);
