#!/usr/bin/env node
'use strict';

/**
 * test-ab-backtest.js — Backtest parity test: Go signals → JS PM simulation.
 *
 * 1. Runs Go ab-scan-history to get all pattern signals for N tickers over a date range
 * 2. Fetches OHLCV data for those tickers from Yahoo
 * 3. Runs each signal through the JS PM (americanbull-pm.js) trade simulator
 * 4. Computes aggregate stats (WR, PF, avg PnL, DD) and compares with Go reference
 *
 * Usage:
 *   node tools/test-ab-backtest.js                                  # default 50 tickers, 1y
 *   node tools/test-ab-backtest.js --tickers AAPL,MSFT,NVDA         # specific tickers
 *   node tools/test-ab-backtest.js --count 100 --start 2024-01-01   # 100 tickers, custom start
 */

const { execSync } = require('child_process');
const path = require('path');
const https = require('https');
const { detectPattern } = require('./lib/candlestick-patterns');
const { simulateAmericanBullTrade, DEFAULT_CONFIG, resolveConfig } = require('./lib/americanbull-pm');

const GO_BIN = path.join('/Users/marketwatchxyz/GolandProjects/systematic-tss/bin/ab-scan-history');

const args = process.argv.slice(2);
function getArg(name, def) { const i = args.indexOf(`--${name}`); return i >= 0 && args[i+1] ? args[i+1] : def; }

const CUSTOM_TICKERS = getArg('tickers', '').split(',').filter(Boolean);
const TICKER_COUNT = parseInt(getArg('count', '50'));
const START = getArg('start', '2025-06-01');
const MIN_SCORE = parseFloat(getArg('min-score', '70'));

// Representative universe for backtest — diverse sectors, different volatility profiles
const DEFAULT_UNIVERSE = [
  'AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','AMD','AVGO','CRM',
  'NFLX','ADBE','INTC','ORCL','CSCO','TXN','QCOM','MU','AMAT','LRCX',
  'JPM','BAC','GS','MS','WFC','C','BLK','SCHW','AXP','COF',
  'UNH','JNJ','PFE','ABBV','MRK','LLY','TMO','ABT','BMY','AMGN',
  'XOM','CVX','COP','SLB','EOG','MPC','OXY','HAL','PSX','VLO',
  'CAT','DE','HON','GE','RTX','BA','LMT','NOC','GD','MMM',
  'HD','WMT','COST','TGT','LOW','DG','DLTR','ROST','TJX','NKE',
  'DIS','CMCSA','T','VZ','TMUS','CHTR','NFLX','SPOT','PARA','WBD',
  'NWL','MUSA','CASY','FANG','ANET','OLPX','VECO','ON','SWKS','MCHP',
  'F','GM','DAL','UAL','LUV','CCL','RCL','MAR','HLT','WYNN',
];

// ─── Yahoo OHLCV fetch ─────────────────────────────────────────────────────

function fetchOHLCV(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=2y`;
  return new Promise(resolve => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          const r = j?.chart?.result?.[0];
          if (!r) return resolve([]);
          const ts = r.timestamp || [];
          const q = r.indicators?.quote?.[0] || {};
          const bars = [];
          for (let i = 0; i < ts.length; i++) {
            const d = new Date(ts[i] * 1000).toISOString().slice(0, 10);
            const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i], v = q.volume?.[i] || 0;
            if (o != null && h != null && l != null && c != null) bars.push({ date: d, open: o, high: h, low: l, close: c, volume: v });
          }
          resolve(bars);
        } catch { resolve([]); }
      });
    });
    req.on('error', () => resolve([]));
    req.on('timeout', () => { req.destroy(); resolve([]); });
  });
}

// ─── Run Go scanner ─────────────────────────────────────────────────────────

function runGoScanner(tickers, start, minScore) {
  const cmd = `${GO_BIN} -ticker "${tickers.join(',')}" -start "${start}" -min-score ${minScore} 2>/dev/null`;
  const output = execSync(cmd, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  const lines = output.trim().split('\n');
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const p = lines[i].split(',');
    if (p.length < 10) continue;
    results.push({
      date: p[0], ticker: p[1], direction: p[2], pattern: p[3],
      buyLevel: parseFloat(p[4]), stopLevel: parseFloat(p[5]),
      score: parseFloat(p[6]), rsi: parseFloat(p[7]),
      volRatio: parseFloat(p[8]), close: parseFloat(p[9]),
    });
  }
  return results;
}

// ─── JS trade simulation ────────────────────────────────────────────────────

function simulateJSTrade(signal, bars) {
  // Build price history from scan date forward (20 trading days)
  const scanIdx = bars.findIndex(b => b.date === signal.date);
  if (scanIdx < 0 || scanIdx + 1 >= bars.length) return null;

  // Entry day = D+1 (confirmation)
  const entryIdx = scanIdx + 1;
  const entryBar = bars[entryIdx];
  if (!entryBar) return null;

  // Confirmation: price must exceed buyLevel (close of pattern candle)
  const confirmLevel = signal.buyLevel * 1.001;
  if (entryBar.high < confirmLevel) return null;

  const actualEntry = Math.max(entryBar.open, confirmLevel);
  if (actualEntry <= signal.stopLevel) return null;

  // Resolve PM config
  const config = resolveConfig(DEFAULT_CONFIG, 'NORMAL', null, false);
  const maxLossPct = config.maxLossPct;
  const tpPct = config.takeProfitPct;
  const timeoutDays = config.timeoutDays;

  // Compute stops
  const softStop = signal.stopLevel;
  const maxLossStop = actualEntry * (1 - maxLossPct);
  const currentStop = Math.max(softStop, maxLossStop);
  const tp = actualEntry * (1 + tpPct / 100);

  let status = 'open', exitPrice = null, exitDate = null, daysHeld = 0;

  for (let i = entryIdx; i < bars.length && daysHeld <= timeoutDays; i++) {
    const bar = bars[i];
    daysHeld++;

    // SL
    if (bar.low <= currentStop) {
      status = 'sl'; exitPrice = currentStop; exitDate = bar.date; break;
    }
    // TP
    if (bar.high >= tp) {
      status = 'tp'; exitPrice = tp; exitDate = bar.date; break;
    }
  }

  // Timeout
  if (status === 'open') {
    const lastIdx = Math.min(entryIdx + timeoutDays, bars.length - 1);
    status = 'expired';
    exitPrice = bars[lastIdx].close;
    exitDate = bars[lastIdx].date;
    daysHeld = lastIdx - entryIdx + 1;
  }

  const pnlPct = (exitPrice - actualEntry) / actualEntry;

  return {
    ticker: signal.ticker, pattern: signal.pattern, score: signal.score,
    scanDate: signal.date, entryDate: bars[entryIdx].date,
    entry: +actualEntry.toFixed(4), stop: +currentStop.toFixed(4), tp: +tp.toFixed(4),
    status, exitDate, exitPrice: +exitPrice.toFixed(4),
    pnlPct: +(pnlPct * 100).toFixed(2), daysHeld,
  };
}

// ─── Run JS pattern detection day-by-day (same as Go) ────────────────────────

function runJSScanner(bars, start, minScore) {
  const results = [];
  const startIdx = bars.findIndex(b => b.date >= start);
  if (startIdx < 0) return results;

  for (let i = Math.max(startIdx, 60); i < bars.length; i++) {
    const slice = bars.slice(0, i + 1);
    const det = detectPattern(slice, null);
    if (!det) continue;
    if (det.totalScore < minScore) continue;
    results.push({
      date: bars[i].date, pattern: det.pattern,
      totalScore: det.totalScore, entry: det.entry, stop: det.stop,
    });
  }
  return results;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const tickers = CUSTOM_TICKERS.length ? CUSTOM_TICKERS : DEFAULT_UNIVERSE.slice(0, TICKER_COUNT);
  console.log(`🔬 AmericanBulls Backtest Parity Test`);
  console.log(`   Tickers: ${tickers.length} | Start: ${START} | MinScore: ${MIN_SCORE}`);
  console.log(`   Go reference: 5Y stats → 1042 trades, WR 48.85%, CAGR 411.86%, DD 27.45%\n`);

  // Step 1: Run Go scanner
  console.log('🐹 Running Go ab-scan-history...');
  const goSignals = runGoScanner(tickers, START, MIN_SCORE);
  console.log(`   Go: ${goSignals.length} signals (score >= ${MIN_SCORE})\n`);

  // Step 2: Fetch OHLCV for all tickers
  console.log('📡 Fetching 2Y OHLCV data...');
  const priceData = new Map();
  const batchSize = 10;
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(t => fetchOHLCV(t).then(bars => [t, bars])));
    for (const [t, bars] of results) {
      if (bars.length >= 60) priceData.set(t, bars);
    }
    process.stderr.write(`  ${Math.min(i + batchSize, tickers.length)}/${tickers.length} tickers fetched\r`);
  }
  console.log(`   Loaded: ${priceData.size}/${tickers.length} tickers\n`);

  // Step 3: Pattern detection parity check
  console.log('🔍 Checking pattern detection parity (JS vs Go)...');
  let patternMatches = 0, patternTotal = 0;
  const goByKey = new Map();
  for (const s of goSignals) goByKey.set(`${s.date}|${s.ticker}`, s);

  for (const [ticker, bars] of priceData) {
    const jsPatterns = runJSScanner(bars, START, MIN_SCORE);
    for (const jp of jsPatterns) {
      const key = `${jp.date}|${ticker}`;
      patternTotal++;
      if (goByKey.has(key)) {
        const go = goByKey.get(key);
        if (go.pattern === jp.pattern) patternMatches++;
      }
    }
  }
  const goPatternsByTicker = {};
  for (const s of goSignals) {
    if (!goPatternsByTicker[s.ticker]) goPatternsByTicker[s.ticker] = 0;
    goPatternsByTicker[s.ticker]++;
  }
  console.log(`   Pattern match: ${patternMatches}/${goSignals.length} Go signals matched by JS (${(patternMatches/goSignals.length*100).toFixed(1)}%)\n`);

  // Step 4: Simulate trades for Go signals through JS PM
  console.log('💰 Simulating trades (Go signals → JS PM)...');
  const trades = [];
  let skipped = 0;

  for (const signal of goSignals) {
    const bars = priceData.get(signal.ticker);
    if (!bars) { skipped++; continue; }

    const trade = simulateJSTrade(signal, bars);
    if (!trade) { skipped++; continue; }
    trades.push(trade);
  }

  console.log(`   Trades simulated: ${trades.length} (${skipped} skipped — no data or no confirm)\n`);

  // Step 5: Compute stats
  const winners = trades.filter(t => t.pnlPct > 0);
  const losers = trades.filter(t => t.pnlPct <= 0);
  const wr = trades.length ? (winners.length / trades.length * 100) : 0;
  const avgWin = winners.length ? winners.reduce((s, t) => s + t.pnlPct, 0) / winners.length : 0;
  const avgLoss = losers.length ? losers.reduce((s, t) => s + t.pnlPct, 0) / losers.length : 0;
  const totalPnl = trades.reduce((s, t) => s + t.pnlPct, 0);
  const avgPnl = trades.length ? totalPnl / trades.length : 0;
  const pf = losers.length ? Math.abs(winners.reduce((s, t) => s + t.pnlPct, 0) / losers.reduce((s, t) => s + t.pnlPct, 0)) : Infinity;
  const avgHold = trades.length ? trades.reduce((s, t) => s + t.daysHeld, 0) / trades.length : 0;

  // Status breakdown
  const statusCounts = {};
  for (const t of trades) statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;

  // Max drawdown (simple sequential PnL)
  let peak = 0, equity = 0, maxDD = 0;
  for (const t of trades) {
    equity += t.pnlPct;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDD) maxDD = dd;
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  JS BACKTEST RESULTS (Go signals → JS PM simulation)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Total Trades:    ${trades.length}`);
  console.log(`  Winners:         ${winners.length} (${wr.toFixed(1)}%)`);
  console.log(`  Losers:          ${losers.length}`);
  console.log(`  Avg Win:         +${avgWin.toFixed(2)}%`);
  console.log(`  Avg Loss:        ${avgLoss.toFixed(2)}%`);
  console.log(`  Avg PnL/trade:   ${avgPnl.toFixed(2)}%`);
  console.log(`  Profit Factor:   ${pf.toFixed(2)}`);
  console.log(`  Max DD (seq):    ${maxDD.toFixed(1)}%`);
  console.log(`  Avg Hold:        ${avgHold.toFixed(1)}d`);
  console.log(`  Exit breakdown:  ${Object.entries(statusCounts).map(([k,v]) => `${k}=${v}`).join(', ')}`);
  console.log('───────────────────────────────────────────────────────────');
  console.log('  GO REFERENCE (5Y full universe):');
  console.log('  1042 trades, WR 48.85%, CAGR 411.86%, DD 27.45%');
  console.log('═══════════════════════════════════════════════════════════');

  // Top patterns by frequency
  const patternCounts = {};
  for (const t of trades) patternCounts[t.pattern] = (patternCounts[t.pattern] || 0) + 1;
  const sortedPatterns = Object.entries(patternCounts).sort((a, b) => b[1] - a[1]);
  console.log('\n📊 Pattern frequency:');
  for (const [name, count] of sortedPatterns.slice(0, 10)) {
    const pTrades = trades.filter(t => t.pattern === name);
    const pWR = pTrades.filter(t => t.pnlPct > 0).length / pTrades.length * 100;
    console.log(`  ${name.padEnd(30)} ${count} trades (WR ${pWR.toFixed(0)}%)`);
  }

  // Worst and best trades
  const sorted = [...trades].sort((a, b) => a.pnlPct - b.pnlPct);
  console.log('\n🔴 Worst 5:');
  for (const t of sorted.slice(0, 5)) {
    console.log(`  ${t.ticker.padEnd(6)} ${t.pattern.padEnd(26)} ${t.pnlPct.toFixed(1)}% (${t.status}, ${t.daysHeld}d)`);
  }
  console.log('\n🟢 Best 5:');
  for (const t of sorted.slice(-5).reverse()) {
    console.log(`  ${t.ticker.padEnd(6)} ${t.pattern.padEnd(26)} +${t.pnlPct.toFixed(1)}% (${t.status}, ${t.daysHeld}d)`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
