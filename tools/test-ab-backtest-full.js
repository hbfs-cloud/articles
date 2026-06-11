#!/usr/bin/env node
'use strict';

/**
 * test-ab-backtest-full.js — Full portfolio-level AmericanBulls backtest.
 *
 * Faithful port of Go cmd/backtest/main.go: day-by-day iteration with
 * simulated broker, PM mode switching, position limits, rotation, equity curve.
 *
 * Phases:
 *   1. Fetch 5Y OHLCV from Yahoo for universe + ^VIX
 *   2. Pre-compute all candlestick signals (JS scanner)
 *   3. Day-by-day portfolio simulation with full PM
 *   4. Compute CAGR, MaxDD, R², Sharpe, WR, PF from equity curve
 *
 * Usage:
 *   node tools/test-ab-backtest-full.js                         # default 300 tickers, 5Y
 *   node tools/test-ab-backtest-full.js --count 500             # more tickers
 *   node tools/test-ab-backtest-full.js --start 2023-01-01      # shorter period
 *   node tools/test-ab-backtest-full.js --capital 96785         # match Go initial
 *   node tools/test-ab-backtest-full.js --go-signals            # use Go ab-scan-history
 */

const { execSync } = require('child_process');
const path = require('path');
const https = require('https');
const fs = require('fs');
const { detectPattern, detectBearishExit } = require('./lib/candlestick-patterns');
const { DEFAULT_CONFIG, selectMode, resolveConfig, bleedingFraction } = require('./lib/americanbull-pm');

const GO_BIN = path.join('/Users/marketwatchxyz/GolandProjects/systematic-tss/bin/ab-scan-history');

const args = process.argv.slice(2);
function getArg(name, def) { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] ? args[i + 1] : def; }
function hasFlag(name) { return args.includes(`--${name}`); }

const INITIAL_CAPITAL = parseFloat(getArg('capital', '100000'));
const START = getArg('start', '2021-06-01');
const END = getArg('end', '');
const TICKER_COUNT = parseInt(getArg('count', '300'));
const MIN_SCORE = parseFloat(getArg('min-score', '0'));
const USE_GO_SIGNALS = hasFlag('go-signals');
const VERBOSE = hasFlag('verbose');

// Top US stocks by market cap + liquidity (captures >80% of AB signals)
const TOP_UNIVERSE = [
  'AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','BRK-B','LLY','AVGO',
  'JPM','V','UNH','XOM','MA','COST','HD','PG','JNJ','ABBV',
  'WMT','NFLX','CRM','BAC','ORCL','CVX','MRK','AMD','KO','PEP',
  'TMO','ACN','ADBE','LIN','CSCO','MCD','ABT','WFC','PM','GE',
  'IBM','ISRG','CAT','INTU','VZ','CMCSA','TXN','NOW','AXP','QCOM',
  'DHR','AMGN','GS','T','PFE','RTX','BLK','LOW','SPGI','BKNG',
  'NEE','DE','MS','SYK','AMAT','UNP','HON','BX','LRCX','MDT',
  'LMT','VRTX','TJX','SCHW','ELV','REGN','CB','ADI','ADP','PANW',
  'KLAC','SNPS','MU','CDNS','CI','BSX','SO','FI','BMY','PLD',
  'SHW','ICE','CL','MMC','MCO','CME','AON','EQIX','WM','DUK',
  'PYPL','INTC','NOC','HCA','USB','PNC','EMR','CTAS','ITW','COP',
  'GD','APD','ORLY','AJG','TGT','WELL','TT','SLB','CEG','NXPI',
  'ECL','BDX','SPG','FCX','CMG','CARR','MPC','MSI','PSX','OXY',
  'RCL','NEM','AZO','PSA','NSC','KMB','AFL','MET','TRV','D',
  'SRE','O','MNST','ALL','YUM','KHC','ROST','BK','ED','WEC',
  'DLR','FAST','PAYX','AEP','GIS','EXC','DD','PPG','STZ','CTSH',
  'FIS','VRSK','RSG','A','HIG','EA','GLW','PEG','WBA','DG',
  'VLO','HAL','HES','DVN','FANG','KR','DLTR','LHX','IFF','MCHP',
  'ON','SWKS','MPWR','ENPH','TER','LSCC','ALGN','MTCH','GNRC','EPAM',
  'F','GM','DAL','UAL','LUV','AAL','CCL','NCLH','MAR','HLT',
  'WYNN','LVS','MGM','DRI','CMI','FDX','UPS','CSX','WAB','GWW',
  'ROK','DOV','XYL','AME','HUBB','NDSN','RRX','PH','ETN','IR',
  'NWL','MUSA','CASY','OLPX','VECO','ANET','SMCI','PLTR','ARM','APP',
  'CRWD','ZS','DDOG','NET','MDB','SNOW','COIN','MSTR','HOOD','RBLX',
  'UBER','DASH','ABNB','SQ','SHOP','SE','NU','GRAB','CPNG','MELI',
  'WMB','OKE','TRGP','KMI','ET','LNG','AR','EQT','SWN','RRC',
  'BIIB','GILD','REGN','VRTX','MRNA','ILMN','DXCM','IDXX','ZTS','VEEV',
  'DHI','LEN','PHM','TOL','NVR','MTH','GRMN','TYL','FICO','CPRT',
  'WST','PODD','HOLX','EW','ISRG','GEHC','RMD','BAX','ZBH','STE',
  'NKE','LULU','TPR','DECK','ONON','BIRK','SKX','CROX','FL','GPS',
];

// ─── Yahoo OHLCV fetch ─────────────────────────────────────────────────────

function fetchOHLCV(ticker, range = '5y') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=${range}`;
  return new Promise(resolve => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 20000 }, res => {
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
            if (o != null && h != null && l != null && c != null && o > 0 && h > 0) {
              bars.push({ date: d, open: +o.toFixed(4), high: +h.toFixed(4), low: +l.toFixed(4), close: +c.toFixed(4), volume: v });
            }
          }
          resolve(bars);
        } catch { resolve([]); }
      });
    });
    req.on('error', () => resolve([]));
    req.on('timeout', () => { req.destroy(); resolve([]); });
  });
}

// ─── Signal pre-computation ────────────────────────────────────────────────

function computeJSSignals(ticker, bars, startDate, minScore) {
  const signals = [];
  const startIdx = bars.findIndex(b => b.date >= startDate);
  if (startIdx < 0) return signals;

  for (let i = Math.max(startIdx, 60); i < bars.length; i++) {
    const slice = bars.slice(0, i + 1);
    const det = detectPattern(slice, null);
    if (!det) continue;
    if (minScore > 0 && det.totalScore < minScore) continue;
    signals.push({
      date: bars[i].date, ticker,
      pattern: det.pattern, score: det.totalScore,
      entry: det.entry, stop: det.stop, atr: det.atr || 0,
    });
  }
  return signals;
}

function runGoScanner(tickers, start, minScore) {
  try {
    const cmd = `${GO_BIN} -ticker "${tickers.join(',')}" -start "${start}" -min-score ${minScore} 2>/dev/null`;
    const output = execSync(cmd, { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024, timeout: 120000 });
    const lines = output.trim().split('\n');
    const results = [];
    for (let i = 1; i < lines.length; i++) {
      const p = lines[i].split(',');
      if (p.length < 10) continue;
      results.push({
        date: p[0], ticker: p[1], pattern: p[3],
        entry: parseFloat(p[4]), stop: parseFloat(p[5]),
        score: parseFloat(p[6]), atr: 0,
      });
    }
    return results;
  } catch (e) {
    console.error(`  Go scanner failed: ${e.message}`);
    return [];
  }
}

// ─── Regime & VIX helpers ──────────────────────────────────────────────────

function getRegime(vixClose) {
  if (vixClose < 15) return 'risk_on';
  if (vixClose < 20) return 'neutral';
  if (vixClose < 28) return 'early_risk_off';
  return 'risk_off';
}

// ─── Performance metrics (exact port of Go metrics.go) ─────────────────────

function calcPerformanceMetrics(equityCurve, startDate, endDate) {
  if (equityCurve.length < 2) return {};
  const initial = equityCurve[0].equity;
  const final = equityCurve[equityCurve.length - 1].equity;
  if (initial <= 0) return {};

  const totalReturn = (final - initial) / initial * 100;

  // CAGR
  const msPerYear = 365.25 * 24 * 3600 * 1000;
  const years = (new Date(endDate) - new Date(startDate)) / msPerYear;
  const cagr = years > 0 ? (Math.pow(final / initial, 1 / years) - 1) * 100 : 0;

  // Max Drawdown
  let peak = equityCurve[0].equity, maxDD = 0;
  for (const pt of equityCurve) {
    if (pt.equity > peak) peak = pt.equity;
    const dd = (peak - pt.equity) / peak;
    if (dd > maxDD) maxDD = dd;
  }

  // Daily returns for Sharpe
  const returns = [];
  for (let i = 1; i < equityCurve.length; i++) {
    if (equityCurve[i - 1].equity > 0) {
      returns.push((equityCurve[i].equity - equityCurve[i - 1].equity) / equityCurve[i - 1].equity);
    }
  }

  let sharpe = 0;
  if (returns.length > 1) {
    const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
    const stdDev = Math.sqrt(variance);
    if (stdDev > 0) sharpe = (mean * 252) / (stdDev * Math.sqrt(252));
  }

  // R² of log equity curve (exact port of Go calculateR2)
  const n = equityCurve.length;
  const logEq = equityCurve.map(p => p.equity > 0 ? Math.log(p.equity) : 0);
  let sumX = 0, sumY = 0;
  for (let i = 0; i < n; i++) { sumX += i; sumY += logEq[i]; }
  const meanX = sumX / n, meanY = sumY / n;

  let ssTotal = 0, ssResidual = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumXY += (i - meanX) * (logEq[i] - meanY);
    sumXX += (i - meanX) ** 2;
    ssTotal += (logEq[i] - meanY) ** 2;
  }

  let r2 = 0;
  if (sumXX > 0 && ssTotal > 0) {
    const slope = sumXY / sumXX;
    const intercept = meanY - slope * meanX;
    for (let i = 0; i < n; i++) {
      const residual = logEq[i] - (slope * i + intercept);
      ssResidual += residual * residual;
    }
    r2 = Math.max(0, Math.min(1, 1 - ssResidual / ssTotal));
  }

  return {
    totalReturn: +totalReturn.toFixed(2),
    cagr: +cagr.toFixed(2),
    maxDD: +(maxDD * 100).toFixed(2),
    sharpe: +sharpe.toFixed(2),
    r2: +r2.toFixed(2),
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

// Calendar days between two dates (Go uses calendar days for daysHeld)
function calendarDays(d1, d2) {
  return Math.round((new Date(d2) - new Date(d1)) / (24 * 3600 * 1000));
}

// ─── Portfolio simulation engine ────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  AmericanBulls Full Portfolio Backtest Engine');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Capital: $${INITIAL_CAPITAL.toLocaleString()} | Start: ${START}`);
  console.log(`  Universe: ${TICKER_COUNT} tickers | Min score: ${MIN_SCORE}`);
  console.log(`  Signal source: ${USE_GO_SIGNALS ? 'Go ab-scan-history' : 'JS scanner'}`);
  console.log(`  Go ref: 1042 trades, WR 48.85%, CAGR 411.86%, DD 27.45%`);
  console.log('───────────────────────────────────────────────────────────\n');

  // ── Phase 1: Select universe ────────────────────────────────────────────
  let tickers = TOP_UNIVERSE.slice(0, TICKER_COUNT);
  const customTickers = getArg('tickers', '');
  if (customTickers) tickers = customTickers.split(',').filter(Boolean);

  // Load more from universe file if needed
  if (tickers.length < TICKER_COUNT) {
    try {
      const uniFile = path.join(__dirname, '..', 'data', 'americanbull-universe.json');
      const uniData = JSON.parse(fs.readFileSync(uniFile, 'utf8'));
      const existing = new Set(tickers);
      for (const t of uniData.tickers || []) {
        if (tickers.length >= TICKER_COUNT) break;
        if (!existing.has(t)) { tickers.push(t); existing.add(t); }
      }
    } catch {}
  }

  console.log(`[1/4] Fetching OHLCV for ${tickers.length} tickers + VIX...`);

  // Fetch VIX first
  const vixBars = await fetchOHLCV('^VIX', '5y');
  if (vixBars.length < 100) {
    console.error('  Failed to fetch VIX data. Aborting.');
    process.exit(1);
  }
  const vixByDate = new Map(vixBars.map(b => [b.date, b.close]));

  // Fetch OHLCV in parallel batches
  const priceData = new Map(); // ticker → bars[]
  const batchSize = 15;
  let fetched = 0;
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(t => fetchOHLCV(t, '5y').then(bars => [t, bars])));
    for (const [t, bars] of results) {
      if (bars.length >= 100) priceData.set(t, bars);
    }
    fetched += batch.length;
    process.stderr.write(`  ${fetched}/${tickers.length} tickers (${priceData.size} loaded)\r`);
    if (i + batchSize < tickers.length) await new Promise(r => setTimeout(r, 200));
  }
  console.log(`  Loaded: ${priceData.size}/${tickers.length} tickers, VIX: ${vixBars.length} bars\n`);

  // Build bar index: ticker → Map(date → {bar, idx})
  const barIndex = new Map();
  for (const [ticker, bars] of priceData) {
    const idx = new Map();
    for (let i = 0; i < bars.length; i++) idx.set(bars[i].date, i);
    barIndex.set(ticker, idx);
  }

  function getBar(ticker, date) {
    const bars = priceData.get(ticker);
    const idx = barIndex.get(ticker);
    if (!bars || !idx) return null;
    const i = idx.get(date);
    return i != null ? bars[i] : null;
  }

  function getBarIdx(ticker, date) {
    const idx = barIndex.get(ticker);
    return idx ? idx.get(date) : undefined;
  }

  // ── Phase 2: Compute signals ───────────────────────────────────────────

  console.log(`[2/4] Computing signals...`);
  const signalsByDate = new Map(); // date → [{ticker, score, entry, stop, atr, pattern}]
  let totalSignals = 0;

  if (USE_GO_SIGNALS) {
    const tickerList = [...priceData.keys()];
    const goBatchSize = 50;
    for (let i = 0; i < tickerList.length; i += goBatchSize) {
      const batch = tickerList.slice(i, i + goBatchSize);
      const signals = runGoScanner(batch, START, MIN_SCORE);
      for (const s of signals) {
        if (!signalsByDate.has(s.date)) signalsByDate.set(s.date, []);
        signalsByDate.get(s.date).push(s);
        totalSignals++;
      }
      process.stderr.write(`  Go scanner: ${i + batch.length}/${tickerList.length} tickers, ${totalSignals} signals\r`);
    }
  } else {
    let processed = 0;
    for (const [ticker, bars] of priceData) {
      const signals = computeJSSignals(ticker, bars, START, MIN_SCORE);
      for (const s of signals) {
        if (!signalsByDate.has(s.date)) signalsByDate.set(s.date, []);
        signalsByDate.get(s.date).push(s);
        totalSignals++;
      }
      processed++;
      if (processed % 20 === 0) process.stderr.write(`  JS scanner: ${processed}/${priceData.size} tickers, ${totalSignals} signals\r`);
    }
  }

  // Sort each day's signals by score descending
  for (const [, sigs] of signalsByDate) {
    sigs.sort((a, b) => b.score - a.score);
  }

  console.log(`  Total signals: ${totalSignals} across ${signalsByDate.size} trading days\n`);

  // ── Phase 3: Day-by-day portfolio simulation ───────────────────────────

  console.log(`[3/4] Running portfolio simulation...`);

  // Build trading calendar from VIX (reliable market-open indicator)
  const tradingDates = vixBars.filter(b => b.date >= START && (!END || b.date <= END)).map(b => b.date);
  if (tradingDates.length < 20) {
    console.error('  Not enough trading days. Check date range.');
    process.exit(1);
  }

  // Portfolio state
  let cash = INITIAL_CAPITAL;
  const positions = [];    // {symbol, qty, entry, openDate, softStop, hardStop}
  let pendingBuys = [];    // {symbol, qty, limitPrice, softStop, hardStop, placedDate, score}
  let pendingSells = [];   // {symbol, qty, type:'market'|'stop', price, reason}
  const closedTrades = []; // {symbol, entry, exitPrice, exitDate, pnlPct, pnlAbs, status, holdDays}
  const equityCurve = [];  // {date, equity}
  let prevVix = 20;
  let modeHistory = { AGGRESSIVE: 0, NORMAL: 0, DEFENSIVE: 0 };

  for (let dayIdx = 0; dayIdx < tradingDates.length; dayIdx++) {
    const date = tradingDates[dayIdx];

    // ── Step 1: Execute yesterday's orders against today's OHLC ──────

    // 1a. Execute pending MARKET sells
    const newPendingSells = [];
    for (const sell of pendingSells) {
      if (sell.type !== 'market') { newPendingSells.push(sell); continue; }
      const bar = getBar(sell.symbol, date);
      if (!bar) { newPendingSells.push(sell); continue; }
      const fillPrice = bar.open;
      const posIdx = positions.findIndex(p => p.symbol === sell.symbol);
      if (posIdx < 0) continue;
      const pos = positions[posIdx];
      const pnlPct = (fillPrice - pos.entry) / pos.entry;
      closedTrades.push({
        symbol: pos.symbol, entry: pos.entry, exitPrice: fillPrice, exitDate: date,
        pnlPct, pnlAbs: pos.qty * (fillPrice - pos.entry),
        status: sell.reason, holdDays: calendarDays(pos.openDate, date),
        pattern: pos.pattern || '', score: pos.score || 0,
      });
      cash += pos.qty * fillPrice;
      positions.splice(posIdx, 1);
    }
    pendingSells = newPendingSells;

    // 1b. Check hard stops on existing positions
    for (let i = positions.length - 1; i >= 0; i--) {
      const pos = positions[i];
      const bar = getBar(pos.symbol, date);
      if (!bar || !pos.hardStop || pos.hardStop <= 0) continue;
      if (bar.low <= pos.hardStop) {
        const fillPrice = bar.open <= pos.hardStop ? bar.open : pos.hardStop;
        const pnlPct = (fillPrice - pos.entry) / pos.entry;
        closedTrades.push({
          symbol: pos.symbol, entry: pos.entry, exitPrice: fillPrice, exitDate: date,
          pnlPct, pnlAbs: pos.qty * (fillPrice - pos.entry),
          status: 'hard_stop', holdDays: calendarDays(pos.openDate, date),
          pattern: pos.pattern || '', score: pos.score || 0,
        });
        cash += pos.qty * fillPrice;
        positions.splice(i, 1);
      }
    }

    // 1c. Execute pending STOP sells (safety net stops placed in previous days)
    const remainingSells = [];
    for (const sell of pendingSells) {
      if (sell.type !== 'stop') { remainingSells.push(sell); continue; }
      const bar = getBar(sell.symbol, date);
      if (!bar) { remainingSells.push(sell); continue; }
      if (bar.low <= sell.price) {
        const fillPrice = bar.open <= sell.price ? bar.open : sell.price;
        const posIdx = positions.findIndex(p => p.symbol === sell.symbol);
        if (posIdx < 0) continue;
        const pos = positions[posIdx];
        const pnlPct = (fillPrice - pos.entry) / pos.entry;
        closedTrades.push({
          symbol: pos.symbol, entry: pos.entry, exitPrice: fillPrice, exitDate: date,
          pnlPct, pnlAbs: pos.qty * (fillPrice - pos.entry),
          status: 'safety_stop', holdDays: calendarDays(pos.openDate, date),
          pattern: pos.pattern || '', score: pos.score || 0,
        });
        cash += pos.qty * fillPrice;
        positions.splice(posIdx, 1);
      } else {
        remainingSells.push(sell);
      }
    }
    pendingSells = remainingSells;

    // 1d. Process pending BUY limit orders
    const newPendingBuys = [];
    for (const buy of pendingBuys) {
      const bar = getBar(buy.symbol, date);
      const age = calendarDays(buy.placedDate, date);

      // Cancel stale pending (Go: pendingBuyCancelDays, default 1-3)
      if (age >= (DEFAULT_CONFIG.pendingBuyCancelDays || 3)) {
        cash += buy.reservedCash;
        continue;
      }

      if (!bar) { newPendingBuys.push(buy); continue; }

      // Check fill conditions (exact port of Go BUY LIMIT logic)
      let fillPrice = null;
      if (bar.open <= buy.limitPrice) fillPrice = bar.open;
      else if (bar.low <= buy.limitPrice) fillPrice = buy.limitPrice;

      if (fillPrice && fillPrice > 0) {
        // Fill: create position
        const actualQty = Math.floor(buy.reservedCash / fillPrice);
        if (actualQty <= 0) { cash += buy.reservedCash; continue; }
        const cost = actualQty * fillPrice;
        cash += buy.reservedCash - cost;

        // Recalculate stops based on actual fill price
        const atr = buy.atr || (fillPrice * 0.03);
        const baseStopATR = DEFAULT_CONFIG.baseStopATR || 1.5;
        let softStop = Math.min(buy.softStop, fillPrice - atr * baseStopATR);
        const maxLossStop = fillPrice * (1 - (DEFAULT_CONFIG.maxLossPct || 0.07));
        if (softStop < maxLossStop) softStop = maxLossStop;
        const dist = fillPrice - softStop;
        const hardStop = fillPrice - dist * (buy.safetyMult || DEFAULT_CONFIG.safetyStopMult || 3.0);

        positions.push({
          symbol: buy.symbol, qty: actualQty, entry: fillPrice,
          openDate: buy.placedDate, softStop, hardStop: Math.max(hardStop, 0),
          pattern: buy.pattern, score: buy.score,
        });
      } else {
        newPendingBuys.push(buy);
      }
    }
    pendingBuys = newPendingBuys;

    // ── Step 2: PM decisions using today's close ─────────────────────

    const vixClose = vixByDate.get(date) || prevVix;
    const vixRising = vixClose > prevVix;
    prevVix = vixClose;
    const regime = getRegime(vixClose);

    // Compute equity for mode selection
    let posVal = 0;
    for (const pos of positions) {
      const bar = getBar(pos.symbol, date);
      posVal += pos.qty * (bar ? bar.close : pos.entry);
    }
    let pendVal = 0;
    for (const buy of pendingBuys) pendVal += buy.reservedCash;
    const equity = cash + posVal + pendVal;

    // Select mode
    const positionsForMode = positions.map(p => {
      const bar = getBar(p.symbol, date);
      return { currentPrice: bar ? bar.close : p.entry, entry: p.entry };
    });
    const currentMode = selectMode(vixClose, vixRising, equity, INITIAL_CAPITAL, positionsForMode, DEFAULT_CONFIG);
    modeHistory[currentMode] = (modeHistory[currentMode] || 0) + 1;
    const config = resolveConfig(DEFAULT_CONFIG, currentMode, regime, vixRising);

    // 2a. Check standard exits (SL, TP, timeout using close — exact port of CheckStandardExits)
    const exitingSymbols = new Set();
    for (const pos of positions) {
      const bar = getBar(pos.symbol, date);
      if (!bar) continue;
      const pnlPct = (bar.close - pos.entry) / pos.entry;
      const daysHeld = calendarDays(pos.openDate, date);

      let exitReason = null;

      // SL by maxLossPct (close-based, like Go)
      if (config.maxLossPct > 0 && pnlPct <= -config.maxLossPct) {
        exitReason = 'sl';
      }
      // TP
      let tpPct = config.takeProfitPct;
      if (tpPct > 1.0) tpPct = tpPct / 100.0;
      if (!exitReason && tpPct > 0 && pnlPct >= tpPct) {
        exitReason = 'tp';
      }
      // Timeout
      const timeoutDays = config.timeoutDays || DEFAULT_CONFIG.timeoutDays || 10;
      if (!exitReason && daysHeld >= timeoutDays) {
        exitReason = 'timeout';
      }

      if (exitReason) {
        exitingSymbols.add(pos.symbol);
        pendingSells.push({ symbol: pos.symbol, qty: pos.qty, type: 'market', reason: exitReason });
      }
    }

    // 2b. Bearish pattern exits
    for (const pos of positions) {
      if (exitingSymbols.has(pos.symbol)) continue;
      const daysHeld = calendarDays(pos.openDate, date);
      if (daysHeld < 2) continue;

      const bars = priceData.get(pos.symbol);
      const bidx = getBarIdx(pos.symbol, date);
      if (bidx == null || bidx < 3) continue;

      const slice = bars.slice(Math.max(0, bidx - 59), bidx + 1);
      if (slice.length >= 3) {
        const bearish = detectBearishExit(slice);
        if (bearish) {
          exitingSymbols.add(pos.symbol);
          pendingSells.push({ symbol: pos.symbol, qty: pos.qty, type: 'market', reason: 'bearish' });
        }
      }
    }

    // 2c. Rotation (exact port of rotateWorstLoser)
    if (config.enableRotation && positions.length >= config.maxOpenPositions) {
      const candidates = signalsByDate.get(date) || [];
      const heldSymbols = new Set(positions.map(p => p.symbol));

      // Best non-held candidate
      const bestCandidate = candidates.find(c =>
        !heldSymbols.has(c.ticker) && c.score >= (config.rotationMinScore || 80)
      );

      if (bestCandidate) {
        const minDays = config.rotationMinDays || 7;
        const minLoss = config.rotationMinLoss || 0.05;
        let worstSymbol = null, worstQty = 0, worstPct = 0;

        for (const pos of positions) {
          if (exitingSymbols.has(pos.symbol)) continue;
          const daysHeld = calendarDays(pos.openDate, date);
          if (daysHeld < minDays) continue;
          const bar = getBar(pos.symbol, date);
          if (!bar) continue;
          const lossPct = (pos.entry - bar.close) / pos.entry;
          if (lossPct >= minLoss && lossPct > worstPct) {
            worstSymbol = pos.symbol;
            worstQty = pos.qty;
            worstPct = lossPct;
          }
        }

        if (worstSymbol) {
          exitingSymbols.add(worstSymbol);
          pendingSells.push({ symbol: worstSymbol, qty: worstQty, type: 'market', reason: 'rotation' });
        }
      }
    }

    // 2d. Create new entry orders (exact port of createConfirmationEntries)
    // Slots: active positions (including those being sold) + pending buys
    const slotsUsed = positions.length + pendingBuys.length;
    let slotsAvailable = config.maxOpenPositions - slotsUsed;

    if (slotsAvailable > 0 && cash > 100) {
      const candidates = signalsByDate.get(date) || [];
      const heldOrPending = new Set([
        ...positions.map(p => p.symbol),
        ...pendingBuys.map(p => p.symbol),
      ]);
      let entered = 0;

      for (const candidate of candidates) {
        if (entered >= slotsAvailable) break;
        if (heldOrPending.has(candidate.ticker)) continue;

        // Position size: available cash / available slots (Go logic)
        const effectiveSlots = slotsAvailable - entered;
        const posSize = Math.min(cash * 0.98, cash / effectiveSlots);
        if (posSize < 100) break;

        const limitPrice = candidate.entry * 1.001;
        const qty = Math.floor(posSize / limitPrice);
        if (qty <= 0) continue;
        const reservedCash = qty * limitPrice;
        if (reservedCash > cash) continue;

        // Compute stops
        const atr = candidate.atr || (candidate.entry * 0.03);
        const baseStopATR = config.baseStopATR || 1.5;
        let softStop = Math.min(candidate.stop, candidate.entry - atr * baseStopATR);
        const maxLossStop = candidate.entry * (1 - config.maxLossPct);
        if (softStop < maxLossStop) softStop = maxLossStop;
        const dist = candidate.entry - softStop;
        const safetyMult = config.safetyStopMult || 3.0;
        const hardStop = candidate.entry - dist * safetyMult;

        cash -= reservedCash;
        pendingBuys.push({
          symbol: candidate.ticker, qty, limitPrice, softStop,
          hardStop: Math.max(hardStop, 0), atr, safetyMult,
          placedDate: date, score: candidate.score, pattern: candidate.pattern,
          reservedCash,
        });
        heldOrPending.add(candidate.ticker);
        entered++;
      }
    }

    // ── Step 3: Record equity ────────────────────────────────────────

    let finalPosVal = 0;
    for (const pos of positions) {
      const bar = getBar(pos.symbol, date);
      finalPosVal += pos.qty * (bar ? bar.close : pos.entry);
    }
    let finalPendVal = 0;
    for (const buy of pendingBuys) finalPendVal += buy.reservedCash;
    const finalEquity = cash + finalPosVal + finalPendVal;
    equityCurve.push({ date, equity: finalEquity });

    // Progress
    if (dayIdx % 100 === 0 || dayIdx === tradingDates.length - 1) {
      process.stderr.write(`  Day ${dayIdx + 1}/${tradingDates.length} (${date}) | Equity: $${Math.round(finalEquity).toLocaleString()} | Positions: ${positions.length} | Trades: ${closedTrades.length} | Mode: ${currentMode}\r`);
    }
  }

  // Close any remaining positions at last close
  const lastDate = tradingDates[tradingDates.length - 1];
  for (const pos of [...positions]) {
    const bar = getBar(pos.symbol, lastDate);
    if (!bar) continue;
    const pnlPct = (bar.close - pos.entry) / pos.entry;
    closedTrades.push({
      symbol: pos.symbol, entry: pos.entry, exitPrice: bar.close, exitDate: lastDate,
      pnlPct, pnlAbs: pos.qty * (bar.close - pos.entry),
      status: 'eod_close', holdDays: calendarDays(pos.openDate, lastDate, tradingDates),
      pattern: pos.pattern || '', score: pos.score || 0,
    });
  }

  console.log('\n');

  // ── Phase 4: Compute stats ─────────────────────────────────────────

  console.log(`[4/4] Computing statistics...\n`);

  const winners = closedTrades.filter(t => t.pnlPct > 0);
  const losers = closedTrades.filter(t => t.pnlPct <= 0);
  const wr = closedTrades.length ? (winners.length / closedTrades.length * 100) : 0;
  const avgWin = winners.length ? winners.reduce((s, t) => s + t.pnlPct, 0) / winners.length * 100 : 0;
  const avgLoss = losers.length ? losers.reduce((s, t) => s + t.pnlPct, 0) / losers.length * 100 : 0;
  const pf = losers.length && losers.reduce((s, t) => s + Math.abs(t.pnlPct), 0) > 0
    ? winners.reduce((s, t) => s + t.pnlPct, 0) / Math.abs(losers.reduce((s, t) => s + t.pnlPct, 0))
    : Infinity;
  const avgHold = closedTrades.length ? closedTrades.reduce((s, t) => s + t.holdDays, 0) / closedTrades.length : 0;

  const endDate = END || tradingDates[tradingDates.length - 1];
  const perf = calcPerformanceMetrics(equityCurve, START, endDate);

  // Status breakdown
  const statusCounts = {};
  for (const t of closedTrades) statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;

  const finalEquity = equityCurve.length ? equityCurve[equityCurve.length - 1].equity : INITIAL_CAPITAL;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  JS PORTFOLIO BACKTEST RESULTS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Period:          ${START} → ${endDate} (${tradingDates.length} trading days)`);
  console.log(`  Initial Capital: $${INITIAL_CAPITAL.toLocaleString()}`);
  console.log(`  Final Equity:    $${Math.round(finalEquity).toLocaleString()}`);
  console.log(`  Return:          ${perf.totalReturn?.toFixed(1)}%`);
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`  CAGR:            ${perf.cagr}%`);
  console.log(`  Max Drawdown:    ${perf.maxDD}%`);
  console.log(`  Sharpe:          ${perf.sharpe}`);
  console.log(`  R²:              ${perf.r2}`);
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`  Total Trades:    ${closedTrades.length}`);
  console.log(`  Winners:         ${winners.length} (${wr.toFixed(1)}%)`);
  console.log(`  Losers:          ${losers.length}`);
  console.log(`  Avg Win:         +${avgWin.toFixed(2)}%`);
  console.log(`  Avg Loss:        ${avgLoss.toFixed(2)}%`);
  console.log(`  Profit Factor:   ${pf === Infinity ? '∞' : pf.toFixed(2)}`);
  console.log(`  Avg Hold:        ${avgHold.toFixed(1)} days`);
  console.log(`  Exit breakdown:  ${Object.entries(statusCounts).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`  Mode usage:      AGG=${modeHistory.AGGRESSIVE} NORM=${modeHistory.NORMAL} DEF=${modeHistory.DEFENSIVE}`);
  console.log(`  Universe:        ${priceData.size} tickers, ${totalSignals} signals`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  GO REFERENCE (5Y, 3300+ tickers):');
  console.log('  1042 trades | WR 48.85% | CAGR 411.86% | DD 27.45% | R² 0.98 | Sharpe 1.44');
  console.log('═══════════════════════════════════════════════════════════════');

  // Delta comparison
  console.log('\n  DELTA (JS vs Go):');
  console.log(`    WR:    ${wr.toFixed(1)}% vs 48.85%  (${(wr - 48.85) >= 0 ? '+' : ''}${(wr - 48.85).toFixed(1)}pp)`);
  console.log(`    CAGR:  ${perf.cagr}% vs 411.86%`);
  console.log(`    DD:    ${perf.maxDD}% vs 27.45%`);
  console.log(`    R²:    ${perf.r2} vs 0.98`);
  console.log(`    Sharpe:${perf.sharpe} vs 1.44`);

  // Top patterns
  const patternCounts = {};
  for (const t of closedTrades) {
    const p = t.pattern || 'unknown';
    if (!patternCounts[p]) patternCounts[p] = { total: 0, wins: 0, pnl: 0 };
    patternCounts[p].total++;
    if (t.pnlPct > 0) patternCounts[p].wins++;
    patternCounts[p].pnl += t.pnlPct * 100;
  }
  const sortedPatterns = Object.entries(patternCounts).sort((a, b) => b[1].total - a[1].total);
  console.log('\n  Top patterns:');
  for (const [name, st] of sortedPatterns.slice(0, 8)) {
    console.log(`    ${name.padEnd(28)} ${String(st.total).padStart(4)} trades  WR ${(st.wins / st.total * 100).toFixed(0)}%  Avg ${(st.pnl / st.total).toFixed(1)}%`);
  }

  // Best/worst trades
  const sorted = [...closedTrades].sort((a, b) => a.pnlPct - b.pnlPct);
  console.log('\n  Worst 5:');
  for (const t of sorted.slice(0, 5)) {
    console.log(`    ${t.symbol.padEnd(6)} ${(t.pnlPct * 100).toFixed(1).padStart(7)}%  ${t.status.padEnd(10)} ${t.holdDays}d  ${t.pattern}`);
  }
  console.log('\n  Best 5:');
  for (const t of sorted.slice(-5).reverse()) {
    console.log(`    ${t.symbol.padEnd(6)} +${(t.pnlPct * 100).toFixed(1).padStart(6)}%  ${t.status.padEnd(10)} ${t.holdDays}d  ${t.pattern}`);
  }

  // Equity curve sample (for debugging)
  if (VERBOSE && equityCurve.length > 10) {
    console.log('\n  Equity curve (sampled):');
    const step = Math.max(1, Math.floor(equityCurve.length / 20));
    for (let i = 0; i < equityCurve.length; i += step) {
      const pt = equityCurve[i];
      console.log(`    ${pt.date}  $${Math.round(pt.equity).toLocaleString()}`);
    }
    const last = equityCurve[equityCurve.length - 1];
    console.log(`    ${last.date}  $${Math.round(last.equity).toLocaleString()} (final)`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
