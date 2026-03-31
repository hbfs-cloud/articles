#!/usr/bin/env node
'use strict';

/**
 * tools/backtest.js
 * 
 * Corrected backtest engine for DailyTickers Scanner:
 * 1. Fetches historical OHLCV from Yahoo Finance
 * 2. Simulates trades entering at Open(T+1)
 * 3. Uses R-multiples for robust stop/target calculation relative to actual entry
 * 4. Generates grid search results and equity curve
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCANNER_DIR = path.join(ROOT, 'scanner');
const DATA_DIR = path.join(ROOT, 'data');

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function nextBusinessDay(dateStr) {
  let d = new Date(dateStr + 'T12:00:00Z');
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return toDateStr(d);
}

function getPrevBusinessDay(dateStr) {
  let d = new Date(dateStr + 'T12:00:00Z');
  d.setDate(d.getDate() - 1);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() - 1);
  }
  return toDateStr(d);
}

function stripHtml(s) {
  return s.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').trim();
}

function parsePrice(s) {
  if (!s) return null;
  const clean = String(s).replace(/[$,\s]/g, '').replace(/&ndash;/g, '-').replace(/–/g, '-').replace(/\s+/g, '');
  const nums = clean.match(/[\d.]+/g);
  if (!nums || nums.length === 0) return null;
  const vals = nums.map(Number).filter(n => n > 0);
  if (vals.length === 0) return null;
  // If range "100-102", take avg
  if (vals.length >= 2) return (vals[0] + vals[1]) / 2;
  return vals[0];
}

// ─── 1. Parse scan HTML ───────────────────────────────────────────────────────

function parseScannerDir(dirName) {
  const htmlPath = path.join(SCANNER_DIR, dirName, 'index.html');
  if (!fs.existsSync(htmlPath)) return null;

  const html = fs.readFileSync(htmlPath, 'utf8');
  const dateMatch = dirName.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!dateMatch) return null;
  const scanDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;

  const setups = [];
  
  // Split by setup card to isolate context
  const parts = html.split(/(?=<div[^>]+class="setup-card")/i);

  for (const part of parts.slice(1)) {
    // Extract ticker
    let ticker = null;
    const idMatch = part.match(/id="(?:setup-)?([A-Z0-9.]{1,10})"/i);
    if (idMatch) {
      const candidate = idMatch[1].toUpperCase();
      if (!['SETUP', 'SYNTHESE', 'REGIME', 'METHODO', 'DISCLAIMER'].includes(candidate)) {
        ticker = candidate;
      }
    }
    if (!ticker) continue;

    // Extract strategy
    let strategy = 'momentum';
    if (/short.?squeeze/i.test(part)) strategy = 'short_squeeze';
    else if (/breakout/i.test(part)) strategy = 'breakout';
    else if (/pullback/i.test(part)) strategy = 'pullback';
    else if (/reversal/i.test(part)) strategy = 'reversal';

    // Extract score
    let score = 80;
    const scoreMatch = part.match(/sf-value"[^>]*>(\d+)</i) || part.match(/score['":\s]*(\d{2,3})/i);
    if (scoreMatch) score = parseInt(scoreMatch[1]);

    // Extract levels
    let entry = null, stop = null, tp1 = null, tp2 = null;
    
    // Try data attributes first (most reliable if present)
    const dataM = part.match(/data-entry="([\d.]+)"[^>]*data-stop="([\d.]+)"[^>]*data-tp1="([\d.]+)"/i);
    if (dataM) {
      entry = parseFloat(dataM[1]);
      stop = parseFloat(dataM[2]);
      tp1 = parseFloat(dataM[3]);
      const tp2M = part.match(/data-tp2="([\d.]+)"/i);
      if (tp2M) tp2 = parseFloat(tp2M[1]);
    } else {
      // Fallback to regex parsing of visible text
      const stopMatch = part.match(/Stop Loss\s*:?\s*<\/strong>\s*\$?([\d.,]+)/i);
      const tp1Match = part.match(/Target 1\s*:?\s*<\/strong>\s*\$?([\d.,]+)/i);
      const tp2Match = part.match(/Target 2\s*:?\s*<\/strong>\s*\$?([\d.,]+)/i);
      const entMatch = part.match(/Entr[eé]e\s*:?\s*<\/strong>\s*\$?([\d.,]+)/i);
      
      if (stopMatch) stop = parsePrice(stopMatch[1]);
      if (tp1Match) tp1 = parsePrice(tp1Match[1]);
      if (tp2Match) tp2 = parsePrice(tp2Match[1]);
      if (entMatch) entry = parsePrice(entMatch[1]);
    }

    if (!entry || !stop || !tp1) continue;

    setups.push({
      ticker,
      strategy,
      score,
      entry, stop, tp1, tp2
    });
  }

  // Deduplicate tickers per scan
  const unique = [];
  const seen = new Set();
  for (const s of setups) {
    if (!seen.has(s.ticker)) {
      seen.add(s.ticker);
      unique.push(s);
    }
  }

  return { dir: dirName, date: scanDate, setups: unique };
}

// ─── 2. Fetch Yahoo Finance ───────────────────────────────────────────────────

function fetchYahooHistory(ticker) {
  return new Promise((resolve) => {
    // 90 days range to cover Feb 15 - Mar 20
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=90d`;
    const opts = {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    };
    
    const req = https.get(url, opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          const result = j?.chart?.result?.[0];
          if (!result) return resolve(null);
          
          const timestamps = result.timestamp || [];
          const quote = result.indicators?.quote?.[0] || {};
          const history = {};
          
          for (let i = 0; i < timestamps.length; i++) {
            if (quote.open[i] === null) continue;
            const d = new Date(timestamps[i] * 1000);
            const dateStr = toDateStr(d);
            history[dateStr] = {
              open: quote.open[i],
              high: quote.high[i],
              low: quote.low[i],
              close: quote.close[i],
              volume: quote.volume[i]
            };
          }
          resolve(history);
        } catch (e) {
          resolve(null);
        }
      });
    });
    
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// ─── 3. Simulation Logic ──────────────────────────────────────────────────────

function simulateTrade(setup, scanDate, priceData) {
  // Execution: Next Open
  const entryDate = nextBusinessDay(scanDate);
  const entryCandle = priceData[entryDate];
  
  if (!entryCandle) {
    // Try one more day if holiday mismatch
    const nextDate = nextBusinessDay(entryDate);
    const nextCandle = priceData[nextDate];
    if (!nextCandle) return { status: 'no_data' };
    return simulateTradeRun(setup, nextDate, nextCandle.open, priceData);
  }
  
  return simulateTradeRun(setup, entryDate, entryCandle.open, priceData);
}

function simulateTradeRun(setup, entryDate, actualEntryPrice, priceData) {
  // Calculate R-multiples based on setup plan
  // R = |Entry - Stop|
  // StopDist = Entry - Stop (for long)
  // TP1Dist = TP1 - Entry
  
  // We apply these R-multiples to the ACTUAL entry price to maintain the trade structure
  // This avoids "ghost" levels if the gap is large
  
  const setupR = Math.abs(setup.entry - setup.stop);
  const setupRiskPct = setupR / setup.entry;
  
  // Safety: if risk is tiny (<0.5%) or huge (>20%), normalize it? 
  // For now, trust the setup but clamp slightly
  
  // Logic: Re-construct levels based on actual entry
  // If setup was Long (Entry > Stop):
  const isLong = setup.entry > setup.stop;
  
  let actualStop, actualTp1, actualTp2;
  
  if (isLong) {
    actualStop = actualEntryPrice * (1 - setupRiskPct);
    const tp1Mult = (setup.tp1 - setup.entry) / setup.entry;
    const tp2Mult = setup.tp2 ? (setup.tp2 - setup.entry) / setup.entry : tp1Mult * 2;
    actualTp1 = actualEntryPrice * (1 + tp1Mult);
    actualTp2 = actualEntryPrice * (1 + tp2Mult);
  } else {
    // Short setup? (Rare but possible)
    actualStop = actualEntryPrice * (1 + setupRiskPct);
    const tp1Mult = (setup.entry - setup.tp1) / setup.entry;
    const tp2Mult = setup.tp2 ? (setup.entry - setup.tp2) / setup.entry : tp1Mult * 2;
    actualTp1 = actualEntryPrice * (1 - tp1Mult);
    actualTp2 = actualEntryPrice * (1 - tp2Mult);
  }

  // Run simulation day by day
  const dates = Object.keys(priceData).sort().filter(d => d >= entryDate);
  let daysHeld = 0;
  const MAX_HOLD = 15; // 3 weeks max

  for (const date of dates) {
    const candle = priceData[date];
    daysHeld++;
    
    // Check stop (Low <= Stop)
    if (isLong && candle.low <= actualStop) {
      const pnl = (actualStop - actualEntryPrice) / actualEntryPrice * 100;
      return { status: 'loss', pnl, exitDate: date, daysHeld };
    }
    
    // Check TP1
    if (isLong && candle.high >= actualTp1) {
      // Check TP2 same day?
      if (candle.high >= actualTp2) {
        const pnl = (actualTp2 - actualEntryPrice) / actualEntryPrice * 100;
        return { status: 'win_tp2', pnl, exitDate: date, daysHeld };
      }
      // Hit TP1 -> move stop to BE?
      // Simplified: Take profit at TP1 for conservative test
      const pnl = (actualTp1 - actualEntryPrice) / actualEntryPrice * 100;
      return { status: 'win_tp1', pnl, exitDate: date, daysHeld };
    }

    // Time exit
    if (daysHeld >= MAX_HOLD) {
      const pnl = (candle.close - actualEntryPrice) / actualEntryPrice * 100;
      return { status: 'timeout', pnl, exitDate: date, daysHeld };
    }
  }

  // Still open
  const lastDate = dates[dates.length - 1];
  const lastPrice = priceData[lastDate].close;
  const pnl = (lastPrice - actualEntryPrice) / actualEntryPrice * 100;
  return { status: 'open', pnl, exitDate: lastDate, daysHeld };
}

// ─── 4. Main Workflow ─────────────────────────────────────────────────────────

async function main() {
  console.log('Starting Corrected Backtest...');
  
  // 1. Get Scans
  const scanDirs = fs.readdirSync(SCANNER_DIR).filter(d => /^\d{8}/.test(d)).sort();
  const scans = [];
  const tickers = new Set();
  
  for (const d of scanDirs) {
    const s = parseScannerDir(d);
    if (s && s.setups.length > 0) {
      scans.push(s);
      s.setups.forEach(x => tickers.add(x.ticker));
    }
  }
  console.log(`Loaded ${scans.length} scans with ${tickers.size} unique tickers.`);

  // 2. Fetch Data
  const priceHistory = {};
  let fetched = 0;
  for (const t of tickers) {
    const hist = await fetchYahooHistory(t);
    if (hist) priceHistory[t] = hist;
    fetched++;
    if (fetched % 10 === 0) process.stdout.write('.');
    await sleep(100);
  }
  console.log('\nData fetched.');

  // 3. Simulate All Trades
  const tradeResults = []; // Flattened list of all possible trades
  for (const scan of scans) {
    for (const setup of scan.setups) {
      if (!priceHistory[setup.ticker]) continue;
      const res = simulateTrade(setup, scan.date, priceHistory[setup.ticker]);
      if (res.status !== 'no_data') {
        tradeResults.push({
          ...setup,
          scanDate: scan.date,
          result: res
        });
      }
    }
  }
  console.log(`Simulated ${tradeResults.length} trades.`);

  // 4. Grid Search
  const configs = [];
  const rotations = ['none', 'daily_max2'];
  const filters = ['all', 'no_short_squeeze', 'momentum_only', 'breakout_only'];
  const positions = [1, 2, 3, 4, 5];

  for (const rot of rotations) {
    for (const filt of filters) {
      for (const pos of positions) {
        configs.push({ rotation: rot, filter: filt, n_positions: pos });
      }
    }
  }

  const gridResults = configs.map(cfg => evaluatePortfolio(cfg, tradeResults));
  
  // Sort by Sharpe
  gridResults.sort((a, b) => b.sharpe - a.sharpe);
  
  const best = gridResults[0];
  console.log('Best Config:', best);

  // 5. Save Results
  const output = {
    generated_at: new Date().toISOString(),
    grid_results: gridResults,
    best_config: best
  };
  
  fs.writeFileSync(path.join(DATA_DIR, 'backtest-results.json'), JSON.stringify(output, null, 2));
  
  // Save Portfolio History for Best
  fs.writeFileSync(path.join(DATA_DIR, 'portfolio-history.json'), JSON.stringify(best.history, null, 2));
  
  console.log('Saved backtest-results.json and portfolio-history.json');
}

function evaluatePortfolio(config, allTrades) {
  // Filter trades by strategy
  let candidates = allTrades.filter(t => {
    if (config.filter === 'all') return true;
    if (config.filter === 'no_short_squeeze') return t.strategy !== 'short_squeeze';
    if (config.filter === 'momentum_only') return t.strategy === 'momentum';
    if (config.filter === 'breakout_only') return t.strategy === 'breakout';
    return true;
  });

  // Sort by date, then score
  candidates.sort((a, b) => {
    if (a.scanDate !== b.scanDate) return a.scanDate.localeCompare(b.scanDate);
    return b.score - a.score;
  });

  // Simulate Portfolio
  let cash = 10000;
  let equity = 10000;
  const equityCurve = [];
  const activePositions = []; // { trade, amount, exitDate }
  
  // Group by date for easier processing
  const tradesByDate = {};
  candidates.forEach(t => {
    if (!tradesByDate[t.scanDate]) tradesByDate[t.scanDate] = [];
    tradesByDate[t.scanDate].push(t);
  });

  const dates = Array.from(new Set(allTrades.map(t => t.scanDate))).sort();
  // Generate business days timeline (approx)
  // Actually we need to step through every day from start to end
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];
  
  // Just iterate through known trade dates + exit dates involved
  // A cleaner way is to simulate day-by-day
  
  // Simplified: Iterate through business days
  let current = new Date(startDate);
  const end = new Date(endDate);
  // Add 2 weeks to end to allow closing
  end.setDate(end.getDate() + 15);

  let maxDD = 0;
  let peakEquity = 10000;
  let wins = 0;
  let totalTrades = 0;

  while (current <= end) {
    const dateStr = toDateStr(current);
    const dayOfWeek = current.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      current.setDate(current.getDate() + 1);
      continue;
    }

    // 1. Close positions
    for (let i = activePositions.length - 1; i >= 0; i--) {
      const pos = activePositions[i];
      // If today is exit date or past it
      if (dateStr >= pos.trade.result.exitDate) {
        const pnlPct = pos.trade.result.pnl;
        const returned = pos.amount * (1 + pnlPct / 100);
        cash += returned;
        activePositions.splice(i, 1);
        
        if (pnlPct > 0) wins++;
        totalTrades++;
      }
    }

    // 2. Open new positions (if scan happened yesterday/today)
    // In our logic, trade entry is nextBusinessDay(scanDate)
    // We check if today matches any trade's entry date
    
    // Reverse lookup: find trades entering today
    // This is inefficient, better to pre-process
    // But for grid search with N=200 it's ok
    
    // Find trades whose scanDate corresponds to today being entry date
    const prevDay = getPrevBusinessDay(dateStr);
    const potential = tradesByDate[prevDay] || [];
    
    // Apply rotation limits
    let toOpen = potential;
    if (config.rotation === 'daily_max2') {
      toOpen = potential.slice(0, 2);
    }
    
    for (const trade of toOpen) {
      if (activePositions.length < config.n_positions) {
        // Position Sizing: Equal weight of current equity
        const size = equity / config.n_positions;
        if (cash >= size) {
          cash -= size;
          activePositions.push({ trade, amount: size });
        }
      }
    }

    // 3. Update Equity
    let openPL = 0;
    activePositions.forEach(p => {
      // Simplified: Assume constant value until close (no daily MTM in this fast version)
      // or better: use linear interpolation for MTM?
      // For speed, just use cost basis. It underestimates volatility but is safe.
      openPL += p.amount; 
    });
    
    equity = cash + openPL;
    equityCurve.push({ date: dateStr, equity: Math.round(equity) });

    if (equity > peakEquity) peakEquity = equity;
    const dd = (peakEquity - equity) / peakEquity * 100;
    if (dd > maxDD) maxDD = dd;

    current.setDate(current.getDate() + 1);
  }

  const returnTotal = (equity - 10000) / 10000 * 100;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const sharpe = maxDD === 0 ? 0 : returnTotal / maxDD; // Proxy sharpe

  return {
    ...config,
    return_total: parseFloat(returnTotal.toFixed(2)),
    max_drawdown: parseFloat(maxDD.toFixed(2)),
    win_rate: parseFloat(winRate.toFixed(1)),
    sharpe: parseFloat(sharpe.toFixed(2)),
    profit_factor: 0, // todo
    history: { daily: equityCurve }
  };
}

main().catch(console.error);
