#!/usr/bin/env node
/**
 * sweep.js — Enhanced grid search for DailyTickers scanner optimal setup
 *
 * Improvements over v1:
 *   - Proper daily mark-to-market equity tracking
 *   - Score threshold as sweep dimension
 *   - Horizon as sweep dimension
 *   - Partial TP strategy (50% at TP1, trail rest to TP2)
 *   - Trailing stop (move to breakeven after TP1)
 *   - Walk-forward validation (70/30 in-sample/out-of-sample)
 *   - Calmar ratio + Sortino as additional metrics
 *   - Minimum trades filter to avoid overfitting
 *
 * Métrique d'optimisation : Sharpe = Return / |MaxDD|
 *
 * Usage: node tools/sweep.js [--quick] [--verbose]
 */
'use strict';

const fs = require('fs');
const https = require('https');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCANNER_DIR = path.join(ROOT, 'scanner');
const QUICK = process.argv.includes('--quick');
const VERBOSE = process.argv.includes('--verbose');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function toDateStr(ts) {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

function nextBizDay(dateStr) {
  let d = new Date(dateStr + 'T12:00:00Z');
  do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
  return d.toISOString().slice(0, 10);
}

function addBizDays(dateStr, n) {
  let d = new Date(dateStr + 'T12:00:00Z');
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

function parsePrice(s) {
  if (!s) return null;
  const clean = String(s).replace(/[$,\s–—]/g, '-').replace(/[^\d.-]/g, '');
  const nums = clean.split('-').map(Number).filter(n => n > 0);
  if (!nums.length) return null;
  return nums.length >= 2 ? (nums[0] + nums[1]) / 2 : nums[0];
}

function getAllBizDays(startDate, endDate) {
  const days = [];
  let d = new Date(startDate + 'T12:00:00Z');
  const end = new Date(endDate + 'T12:00:00Z');
  while (d <= end) {
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      days.push(d.toISOString().slice(0, 10));
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

// ─── Parse scan HTML → setups ─────────────────────────────────────────────────

const STRAT_PATTERNS = {
  short_squeeze: /short.?squeeze/i,
  pre_squeeze:   /pre.?squeeze/i,
  breakout:      /breakout/i,
  momentum:      /momentum/i,
  pullback:      /pullback/i,
};

function detectStrategy(text) {
  for (const [k, re] of Object.entries(STRAT_PATTERNS)) {
    if (re.test(text)) return k;
  }
  return 'momentum';
}

function parseScan(dir) {
  const htmlPath = path.join(SCANNER_DIR, dir, 'index.html');
  if (!fs.existsSync(htmlPath)) return null;
  const html = fs.readFileSync(htmlPath, 'utf8');
  const dm = dir.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!dm) return null;
  const scanDate = `${dm[1]}-${dm[2]}-${dm[3]}`;

  const setups = [];
  const synthMatch = html.match(/id="synthese"[\s\S]{0,12000}/);
  if (synthMatch) {
    const rows = synthMatch[0].match(/<tr[\s\S]*?<\/tr>/gi) || [];
    for (const row of rows) {
      const cells = (row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [])
        .map(c => c.replace(/<[^>]+>/g, '').replace(/,/g, '.').trim());
      if (cells.length < 4) continue;
      const ticker = cells.find(c => /^[A-Z]{1,5}$/.test(c));
      if (!ticker) continue;
      const score = cells.map(c => parseFloat(c)).find(n => n >= 70 && n <= 100) || 80;
      const pf = cells.filter(c => /^\$[\d.]/.test(c));
      if (pf.length < 3) continue;
      const stratText = cells.find(c => /squeeze|momentum|breakout|pullback/i.test(c)) || '';
      const strategy = detectStrategy(stratText);
      const entry = parsePrice(pf[0]);
      const stop  = parsePrice(pf[1]);
      const tp1   = parsePrice(pf[2]);
      const tp2   = pf[3] ? parsePrice(pf[3]) : null;
      if (!entry || !stop || !tp1 || entry <= 0 || stop <= 0) continue;
      if (stop >= entry) continue;
      if (tp1 <= entry) continue;
      setups.push({ ticker, strategy, score, entry, stop, tp1, tp2 });
    }
  }

  // Fallback: parse setup cards
  if (setups.length === 0) {
    const setupRe = /id="setup-([A-Z0-9]+)"[\s\S]*?(?=id="setup-|id="synthese"|id="performance"|$)/gi;
    let m;
    while ((m = setupRe.exec(html)) !== null) {
      const ticker = m[1];
      const block = m[0].slice(0, 3000);
      const scoreMatch = block.match(/Score[\s\S]{0,100}?(9[0-9]|8[5-9]|7[0-9])/);
      const score = scoreMatch ? parseFloat(scoreMatch[1]) : 85;
      const entryM = block.match(/[Ee]ntr[eé][e]?[\s\S]{0,50}\$([\d.,–\-]+)/);
      const stopM  = block.match(/[Ss]top[\s\S]{0,50}\$([\d.,]+)/);
      const tp1M   = block.match(/[Tt]arget\s*1[\s\S]{0,50}\$([\d.,]+)/);
      const tp2M   = block.match(/[Tt]arget\s*2[\s\S]{0,50}\$([\d.,]+)/);
      const stratText = block.match(/badge[^>]*>(Momentum|Breakout|Pullback|Pre.?Squeeze|Short.?Squeeze)/i);
      if (entryM && stopM && tp1M) {
        const entry = parsePrice(entryM[1]), stop = parsePrice(stopM[1]),
              tp1 = parsePrice(tp1M[1]), tp2 = tp2M ? parsePrice(tp2M[1]) : null;
        if (entry && stop && tp1 && stop < entry && tp1 > entry) {
          setups.push({ ticker, strategy: detectStrategy(stratText ? stratText[1] : ''), score, entry, stop, tp1, tp2 });
        }
      }
    }
  }

  const seen = new Set();
  return {
    dir, scanDate,
    setups: setups.filter(s => {
      if (seen.has(s.ticker)) return false;
      seen.add(s.ticker);
      return true;
    }).sort((a, b) => b.score - a.score),
  };
}

// ─── Fetch Yahoo Finance OHLCV (file-cached) ─────────────────────────────────

const PRICE_CACHE_DIR = path.join(ROOT, 'data', '.price-cache');
fs.mkdirSync(PRICE_CACHE_DIR, { recursive: true });

const priceCache = {};

function loadCachedPrice(ticker) {
  const fp = path.join(PRICE_CACHE_DIR, `${ticker}.json`);
  if (!fs.existsSync(fp)) return null;
  const stat = fs.statSync(fp);
  // Cache valid for 12 hours (today's bar may update during session)
  if (Date.now() - stat.mtimeMs > 12 * 3600 * 1000) return null;
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return null; }
}

function saveCachedPrice(ticker, history) {
  const fp = path.join(PRICE_CACHE_DIR, `${ticker}.json`);
  fs.writeFileSync(fp, JSON.stringify(history));
}

async function fetchOHLCV(ticker) {
  if (priceCache[ticker]) return priceCache[ticker];
  // Try file cache first
  const cached = loadCachedPrice(ticker);
  if (cached) { priceCache[ticker] = cached; return cached; }
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=120d`;
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 12000,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          const result = j?.chart?.result?.[0];
          if (!result) return resolve(null);
          const timestamps = result.timestamp || [];
          const q = result.indicators?.quote?.[0] || {};
          const history = {};
          for (let i = 0; i < timestamps.length; i++) {
            const dateStr = toDateStr(timestamps[i]);
            if (q.open?.[i] != null && q.high?.[i] != null && q.low?.[i] != null && q.close?.[i] != null) {
              history[dateStr] = { open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i] };
            }
          }
          priceCache[ticker] = history;
          saveCachedPrice(ticker, history);
          resolve(history);
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// ─── Simulate a single trade (enhanced with partial TP + trailing stop) ───────

function computeATR(priceHistory, beforeDate, periods = 14) {
  const dates = Object.keys(priceHistory).filter(d => d < beforeDate).sort().slice(-periods - 1);
  if (dates.length < 2) return null;
  let sum = 0, count = 0;
  for (let i = 1; i < dates.length; i++) {
    const prev = priceHistory[dates[i - 1]];
    const cur = priceHistory[dates[i]];
    if (!prev || !cur) continue;
    const tr = Math.max(cur.high - cur.low, Math.abs(cur.high - prev.close), Math.abs(cur.low - prev.close));
    sum += tr;
    count++;
  }
  return count > 0 ? sum / count : null;
}

function simulateTrade(setup, scanDate, priceHistory, config = {}) {
  const {
    horizonDays = 20, partialTP = false, partialTPPct = 0.5, trailingStop = false,
    maxStopPct = 0, atrStopMult = 0, dailyTrailPct = 0,
    breakevenPct = 0, // after +X% gain, move stop to entry (0 = disabled)
    staleDays = 0,    // exit if no new high for N days (0 = disabled)
  } = config;
  if (!priceHistory) return null;

  // Scanner folder IS the entry day (generated D-1 at 23h, folder = D+1 = entry day)
  const entryDate = scanDate;
  const entryBar = priceHistory[entryDate];
  if (!entryBar) return null;

  const actualEntry = entryBar.open;
  if (!actualEntry || actualEntry <= 0) return null;

  // Reject trade if entry gaps below stop level (e.g. BTU 03-31: open $34.52 < stop $35)
  if (actualEntry <= setup.stop) return null;

  let riskPerUnit = setup.entry - setup.stop;
  if (riskPerUnit <= 0) return null;

  // Per-strategy stop cap: tighter for volatile strategies
  const STRATEGY_STOP_CAP = {
    'pre_squeeze': 10,
    'short_squeeze': 10,
    'breakout': 10,
    'momentum': 10,
    'pullback': 10,
  };
  const effectiveMaxStop = Math.min(
    maxStopPct > 0 ? maxStopPct : 100,
    STRATEGY_STOP_CAP[setup.strategy] || (maxStopPct > 0 ? maxStopPct : 100),
  );
  if (effectiveMaxStop < 100) {
    const maxRisk = actualEntry * (effectiveMaxStop / 100);
    if (riskPerUnit > maxRisk) riskPerUnit = maxRisk;
  }

  // ATR-based stop: use tightest of setup stop and N*ATR
  if (atrStopMult > 0) {
    const atr = computeATR(priceHistory, entryDate);
    if (atr) {
      const atrRisk = atr * atrStopMult;
      if (atrRisk < riskPerUnit) riskPerUnit = atrRisk;
    }
  }

  const actualStop = actualEntry - riskPerUnit;
  const rewardMult1 = (setup.tp1 - setup.entry) / riskPerUnit;
  const actualTp1 = actualEntry + riskPerUnit * rewardMult1;
  const rewardMult2 = setup.tp2 ? (setup.tp2 - setup.entry) / riskPerUnit : rewardMult1 * 1.5;
  const actualTp2 = actualEntry + riskPerUnit * rewardMult2;

  const expireDate = addBizDays(scanDate, horizonDays);
  const sortedDates = Object.keys(priceHistory)
    .filter(d => d >= entryDate && d <= expireDate).sort();

  let currentStop = actualStop;
  let status = 'open';
  let exitDate = null;
  let exitPrice = null;
  let partialRealized = 0; // P&L from partial close at TP1
  let highWaterMark = actualEntry;
  let daysSinceNewHigh = 0;
  let breakevenActivated = false;

  for (const date of sortedDates) {
    const bar = priceHistory[date];
    if (!bar) continue;

    // Check SL first
    if (bar.low <= currentStop) {
      status = partialRealized > 0 ? 'tp1_partial' : 'sl';
      exitDate = date;
      exitPrice = currentStop;
      break;
    }

    // Check TP2 (only if partial TP mode and TP1 already hit, or normal mode)
    if (bar.high >= actualTp2) {
      status = 'tp2';
      exitDate = date;
      exitPrice = actualTp2;
      break;
    }

    // Check TP1
    if (bar.high >= actualTp1 && partialRealized === 0) {
      if (partialTP) {
        // Close partialTPPct at TP1, trail the rest
        const tpFrac = partialTPPct * 100; // e.g. 0.5 → 50
        partialRealized = ((actualTp1 - actualEntry) / actualEntry) * tpFrac;
        if (trailingStop) {
          currentStop = actualEntry; // Move stop to breakeven
        }
        // Continue with remaining fraction
      } else {
        status = 'tp1';
        exitDate = date;
        exitPrice = actualTp1;
        break;
      }
    }

    // Trailing stop: if price made new high, trail stop
    if (trailingStop && partialRealized > 0) {
      const trailLevel = bar.high - riskPerUnit * 1.5; // Trail at 1.5R from high
      if (trailLevel > currentStop) currentStop = trailLevel;
    }

    // Daily trailing stop: move stop up based on highest close seen
    if (dailyTrailPct > 0) {
      const trailLevel = bar.close * (1 - dailyTrailPct / 100);
      if (trailLevel > currentStop) currentStop = trailLevel;
    }

    // Breakeven stop: after +X% gain, move stop to entry (no loss possible)
    if (breakevenPct > 0 && !breakevenActivated) {
      const currentGain = (bar.high - actualEntry) / actualEntry * 100;
      if (currentGain >= breakevenPct) {
        breakevenActivated = true;
        if (actualEntry > currentStop) currentStop = actualEntry;
      }
    }

    // Stale exit: track high water mark, tighten stop if stale
    if (staleDays > 0) {
      if (bar.high > highWaterMark) {
        highWaterMark = bar.high;
        daysSinceNewHigh = 0;
      } else {
        daysSinceNewHigh++;
      }
      // After staleDays without new high, progressively tighten stop
      if (daysSinceNewHigh >= staleDays) {
        const staleRaise = (daysSinceNewHigh - staleDays + 1) * 0.002 * actualEntry; // 0.2% per day
        const tightenedStop = currentStop + staleRaise;
        if (tightenedStop > currentStop && tightenedStop < bar.close) currentStop = tightenedStop;
      }
    }
  }

  // Expired
  if (status === 'open') {
    const lastDate = sortedDates[sortedDates.length - 1];
    const expireBar = priceHistory[lastDate];
    if (expireBar) {
      status = 'expired';
      exitDate = lastDate;
      exitPrice = expireBar.close;
    } else {
      return null;
    }
  }

  let pnlPct;
  if (partialTP && partialRealized > 0) {
    const tpFrac = partialTPPct * 100;
    const remainingPnl = ((exitPrice - actualEntry) / actualEntry) * (100 - tpFrac);
    pnlPct = (partialRealized + remainingPnl) / 100;
  } else {
    pnlPct = (exitPrice - actualEntry) / actualEntry;
  }

  return {
    ticker: setup.ticker,
    strategy: setup.strategy,
    score: setup.score,
    scanDate,
    entryDate,
    actualEntry,
    actualStop,
    actualTp1,
    actualTp2,
    status,
    exitDate,
    exitPrice,
    pnlPct: +(pnlPct * 100).toFixed(2),
    holdDays: sortedDates.indexOf(exitDate) + 1,
  };
}

// ─── Portfolio simulation (proper daily MtM) ─────────────────────────────────

function simulatePortfolio(allTrades, scans, config) {
  const {
    portfolioSize,
    topN,
    minScore = 0,
    rotation,
    strategyFilter,
    horizonDays = 20,
    partialTP = false,
    trailingStop = false,
  } = config;

  // Group trades by scan date
  const byDate = {};
  for (const t of allTrades) {
    if (t.score < minScore) continue;
    if (strategyFilter.has(t.strategy)) continue;
    if (!byDate[t.scanDate]) byDate[t.scanDate] = [];
    byDate[t.scanDate].push(t);
  }

  // Build portfolio: track open positions day by day
  const openPositions = []; // { trade, weight }
  const closedTrades = [];
  const allScanDates = Object.keys(byDate).sort();
  if (allScanDates.length === 0) return null;

  // Get date range for daily equity curve
  const startDate = allScanDates[0];
  const endDate = allScanDates[allScanDates.length - 1];
  const allDays = getAllBizDays(startDate, addBizDays(endDate, horizonDays + 5));

  // Equity tracking — daily mark-to-market
  let realizedPnl = 0; // cumulative realized P&L (%)
  const weight = 1 / portfolioSize;
  const equityCurve = [{ date: startDate, value: 100 }];
  const scanDateSet = new Set(allScanDates);

  for (const day of allDays) {
    // ─── Close expired/exited positions ───────────────────────────────
    const stillOpen = [];
    for (const pos of openPositions) {
      if (pos.trade.exitDate && pos.trade.exitDate <= day) {
        realizedPnl += pos.trade.pnlPct * weight;
        closedTrades.push(pos.trade);
      } else {
        stillOpen.push(pos);
      }
    }
    openPositions.length = 0;
    openPositions.push(...stillOpen);

    // ─── On scan dates: rotation + new entries ────────────────────────
    if (scanDateSet.has(day)) {
      const candidates = (byDate[day] || []).slice(0, topN);
      let slotsAvailable = portfolioSize - openPositions.length;

      // Rotation logic
      if (rotation !== 'none' && slotsAvailable <= 0 && candidates.length > 0) {
        const sorted = [...openPositions].sort((a, b) => a.trade.score - b.trade.score);
        const rotLimit = rotation === 'daily_max1' ? 1 : rotation === 'daily_max2' ? 2 : portfolioSize;
        const margin = rotation === 'aggressive' ? 0 : 5;

        let rotated = 0;
        for (const cand of candidates) {
          if (rotated >= rotLimit) break;
          if (rotated >= sorted.length) break;
          const worst = sorted[rotated];
          if (cand.score > worst.trade.score + margin) {
            const hist = priceCache[worst.trade.ticker];
            if (hist && hist[day]) {
              const forcePnl = ((hist[day].close - worst.trade.actualEntry) / worst.trade.actualEntry) * 100;
              realizedPnl += forcePnl * weight;
              closedTrades.push({ ...worst.trade, status: 'rotated', exitDate: day, pnlPct: +forcePnl.toFixed(2) });
            } else {
              closedTrades.push(worst.trade);
            }
            const idx = openPositions.indexOf(worst);
            if (idx >= 0) openPositions.splice(idx, 1);
            slotsAvailable++;
            rotated++;
          }
        }
      }

      // Add new positions
      const openTickers = new Set(openPositions.map(p => p.trade.ticker));
      let added = 0;
      for (const cand of candidates) {
        if (added >= slotsAvailable) break;
        if (openTickers.has(cand.ticker)) continue;
        openPositions.push({ trade: cand, weight });
        openTickers.add(cand.ticker);
        added++;
      }
    }

    // ─── Daily MtM: realized + unrealized at close ───────────────────
    let unrealizedPnl = 0;
    for (const pos of openPositions) {
      const hist = priceCache[pos.trade.ticker];
      if (hist && hist[day]) {
        unrealizedPnl += ((hist[day].close - pos.trade.actualEntry) / pos.trade.actualEntry) * 100 * weight;
      }
    }
    const dailyEquity = 100 + realizedPnl + unrealizedPnl;
    equityCurve.push({ date: day, value: +dailyEquity.toFixed(2) });
  }

  // Flush remaining positions at last known price
  for (const pos of openPositions) {
    if (pos.trade.pnlPct != null) {
      realizedPnl += pos.trade.pnlPct * weight;
    }
    closedTrades.push(pos.trade);
  }
  const equity = 100 + realizedPnl;

  // Compute metrics
  const values = equityCurve.map(d => d.value);
  const returnTotal = +(equity - 100).toFixed(2);

  // Max drawdown (from daily MtM curve)
  let peak = 100, maxDD = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    const dd = peak - v;
    if (dd > maxDD) maxDD = dd;
  }

  const resolved = closedTrades.filter(t => ['tp1', 'tp1_partial', 'tp2', 'sl', 'expired', 'rotated'].includes(t.status));
  const wins = resolved.filter(t => (t.pnlPct || 0) > 0);
  const losses = resolved.filter(t => (t.pnlPct || 0) <= 0);
  const winRate = resolved.length ? +((wins.length / resolved.length) * 100).toFixed(1) : 0;
  const avgWin = wins.length ? +(wins.reduce((s, t) => s + t.pnlPct, 0) / wins.length).toFixed(2) : 0;
  const avgLoss = losses.length ? +(losses.reduce((s, t) => s + t.pnlPct, 0) / losses.length).toFixed(2) : 0;
  const grossWin = wins.reduce((s, t) => s + t.pnlPct, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));
  const profitFactor = grossLoss > 0 ? +(grossWin / grossLoss).toFixed(2) : grossWin > 0 ? 99 : 0;
  const sharpe = maxDD > 0 ? +(returnTotal / maxDD).toFixed(2) : returnTotal > 0 ? 99 : 0;

  // Calmar: annualized return / maxDD
  const dayCount = allDays.length || 1;
  const annReturn = returnTotal * (252 / dayCount);
  const calmar = maxDD > 0 ? +(annReturn / maxDD).toFixed(2) : 0;

  // Sortino: return / downside deviation
  const negReturns = resolved.filter(t => t.pnlPct < 0).map(t => t.pnlPct);
  const downsideDev = negReturns.length > 1
    ? Math.sqrt(negReturns.reduce((s, r) => s + r * r, 0) / negReturns.length)
    : 1;
  const sortino = +(returnTotal / downsideDev).toFixed(2);

  // R2 calculation (Linearity of equity curve)
  let r2 = 0;
  const n = values.length;
  if (n > 1) {
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;
    const sumYY = values.reduce((a, b) => a + b*b, 0);
    let sumXY = 0;
    for (let i = 0; i < n; i++) sumXY += i * values[i];
    const meanX = sumX / n;
    const meanY = sumY / n;
    const denom = (sumXX - n * meanX * meanX) * (sumYY - n * meanY * meanY);
    const num = (sumXY - n * meanX * meanY);
    r2 = denom !== 0 ? +(num * num / denom).toFixed(3) : 0;
  }

  // Average hold days
  const avgHold = resolved.filter(t => t.holdDays).length
    ? +(resolved.filter(t => t.holdDays).reduce((s, t) => s + t.holdDays, 0) / resolved.filter(t => t.holdDays).length).toFixed(1)
    : 0;

  return {
    returnTotal,
    maxDD: +(-maxDD).toFixed(2),
    r2,
    winRate,
    avgWin,
    avgLoss,
    profitFactor,
    sharpe,
    calmar,
    sortino,
    avgHold,
    trades: resolved.length,
    wins: wins.length,
    losses: losses.length,
    equityCurve,
    closedTrades: resolved.map(t => ({
      ticker: t.ticker, strategy: t.strategy, score: t.score,
      scanDate: t.scanDate, entryDate: t.entryDate,
      actualEntry: t.actualEntry, exitPrice: t.exitPrice,
      status: t.status, pnlPct: t.pnlPct, holdDays: t.holdDays || 0,
    })),
  };
}

// ─── Main sweep ───────────────────────────────────────────────────────────────

async function main() {
  console.log('=== DailyTickers Scanner — Enhanced Sweep Optimizer v2 ===\n');

  // 1. Parse all scans
  const scanDirs = fs.readdirSync(SCANNER_DIR)
    .filter(d => /^\d{8}(-\d+)?$/.test(d))
    .filter(d => {
      const date = d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8);
      return date >= '2026-02-15';
    })
    .sort();

  console.log(`Parsing ${scanDirs.length} scans...`);
  const scans = scanDirs.map(parseScan).filter(Boolean);
  const allSetups = scans.flatMap(s => s.setups.map(t => ({ ...t, scanDate: s.scanDate, dir: s.dir })));
  console.log(`Total setups parsed: ${allSetups.length} across ${scans.length} scans`);

  // 2. Fetch all ticker histories
  const tickers = [...new Set(allSetups.map(t => t.ticker))];
  console.log(`\nFetching price history for ${tickers.length} tickers...`);
  let fetched = 0;
  for (const ticker of tickers) {
    await fetchOHLCV(ticker);
    fetched++;
    if (fetched % 5 === 0) process.stdout.write(`  ${fetched}/${tickers.length}\r`);
    await sleep(120);
  }
  const fetchedOK = Object.keys(priceCache).filter(k => priceCache[k]).length;
  console.log(`Fetched prices for ${fetchedOK}/${tickers.length} tickers\n`);

  // 3. Walk-forward split
  const sortedScans = [...scans].sort((a, b) => a.scanDate.localeCompare(b.scanDate));
  const splitIdx = Math.floor(sortedScans.length * 0.7);
  const inSampleDates = new Set(sortedScans.slice(0, splitIdx).map(s => s.scanDate));
  const outSampleDates = new Set(sortedScans.slice(splitIdx).map(s => s.scanDate));
  console.log(`Walk-forward split: ${inSampleDates.size} in-sample / ${outSampleDates.size} out-of-sample scans`);

  // 4. Grid dimensions — ~311K combos, ~5 min nightly run
  const PORTFOLIO_SIZES = QUICK ? [1, 3, 5] : [1, 2, 3, 4, 5, 8, 10];
  const TOP_NS = QUICK ? [1, 2] : [1, 2, 3, 4, 5, 8, 10];
  const MIN_SCORES = QUICK ? [85] : [85, 90];
  const HORIZONS = QUICK ? [5, 15] : [3, 5, 8, 10, 15];
  const STRATEGY_FILTERS = {
    'all':            new Set(),
    'no_sq':          new Set(['short_squeeze']),
    'no_sq_pb':       new Set(['short_squeeze', 'pullback']),
    'momentum_only':  new Set(['short_squeeze', 'pre_squeeze', 'breakout', 'pullback']),
    'breakout_only':  new Set(['short_squeeze', 'pre_squeeze', 'momentum', 'pullback']),
    'mom_bo':         new Set(['short_squeeze', 'pre_squeeze', 'pullback']),
  };
  const ROTATIONS = ['none', 'daily_max1', 'aggressive'];
  const TP_MODES = [false, true]; // partialTP
  const TP_PCTS = [0.5]; // partial TP fraction (0.5 is the balanced default)
  const TRAIL_MODES = [false]; // trailingStop disabled (rarely wins, adds 2× combos)
  const MAX_STOP_PCTS = [0, 5, 7]; // 0 = no cap
  const ATR_STOP_MULTS = [0, 1, 2]; // 0 = disabled
  const DAILY_TRAIL_PCTS = [0, 3]; // 0 = disabled, 3% is the proven sweet spot
  const BREAKEVEN_PCTS = [0, 1]; // 0 = disabled, 1% is the standard
  const STALE_DAYS = [0]; // disabled — too situational for nightly sweep

  // TP_PCTS only matter when partialTP=true, so effective count = (1 + TP_PCTS.length) for TP dimension
  const tpCombos = [[false, 0.5], ...TP_PCTS.map(p => [true, p])]; // [partialTP, partialTPPct]

  const total = PORTFOLIO_SIZES.length * TOP_NS.length * MIN_SCORES.length
    * Object.keys(STRATEGY_FILTERS).length * ROTATIONS.length * HORIZONS.length
    * tpCombos.length * TRAIL_MODES.length * MAX_STOP_PCTS.length * ATR_STOP_MULTS.length
    * DAILY_TRAIL_PCTS.length * BREAKEVEN_PCTS.length * STALE_DAYS.length;
  console.log(`\n=== GRID SEARCH (${total} combinations) ===\n`);

  // Pre-simulate all trades for each unique trade-level config
  const tradesByKey = {};
  const preSimTotal = HORIZONS.length * tpCombos.length * TRAIL_MODES.length
    * MAX_STOP_PCTS.length * ATR_STOP_MULTS.length * DAILY_TRAIL_PCTS.length
    * BREAKEVEN_PCTS.length * STALE_DAYS.length;
  console.log(`Pre-simulating ${preSimTotal} trade sets...`);
  let preSimDone = 0;
  for (const horizon of HORIZONS) {
    for (const [ptp, ptpPct] of tpCombos) {
      for (const trail of TRAIL_MODES) {
        for (const maxStop of MAX_STOP_PCTS) {
          for (const atrMult of ATR_STOP_MULTS) {
            for (const dailyTrail of DAILY_TRAIL_PCTS) {
              for (const bePct of BREAKEVEN_PCTS) {
                for (const stale of STALE_DAYS) {
                  const key = `${horizon}_${ptp}_${ptpPct}_${trail}_${maxStop}_${atrMult}_${dailyTrail}_${bePct}_${stale}`;
                  const trades = [];
                  for (const setup of allSetups) {
                    const history = priceCache[setup.ticker];
                    const result = simulateTrade(setup, setup.scanDate, history, {
                      horizonDays: horizon, partialTP: ptp, partialTPPct: ptpPct, trailingStop: trail,
                      maxStopPct: maxStop, atrStopMult: atrMult, dailyTrailPct: dailyTrail,
                      breakevenPct: bePct, staleDays: stale,
                    });
                    if (result) {
                      trades.push({ ...result, _horizon: horizon, _partialTP: ptp, _ptpPct: ptpPct, _trail: trail, _maxStop: maxStop, _atrMult: atrMult, _dailyTrail: dailyTrail, _bePct: bePct, _stale: stale });
                    }
                  }
                  tradesByKey[key] = trades;
                  preSimDone++;
                  if (preSimDone % 200 === 0) process.stdout.write(`  Pre-sim ${preSimDone}/${preSimTotal}\r`);
                }
              }
            }
          }
        }
      }
    }
  }
  console.log(`Pre-simulated ${preSimDone} trade sets`);

  // Bounded top-N tracker to avoid OOM on large grids
  const TOP_K = 50;
  const MIN_TRADES = 8;
  const topBySharpe = [];
  const topByReturn = [];
  const topByCalmar = [];
  const topByComposite = [];
  const topByLowestDD = []; // sorted ascending by |DD| (lowest first)
  // Mode-specific trackers with constraints
  const advDynamic = [];         // strict: Return≥35%, DD≤6%, WR≥60%, trades≥10
  const advBalanced = [];        // strict: Return≥24%, DD≤4%, WR≥60%, trades≥10
  const advSecured = [];         // strict: Return≥12%, DD≤2%, WR≥75%, trades≥10
  const advDynamicRelaxed = [];  // relaxed: Return≥30%, DD≤10%, WR≥55%, trades≥10
  const advBalancedRelaxed = []; // relaxed: Return≥20%, DD≤5%, WR≥55%, trades≥10
  const advSecuredRelaxed = [];  // relaxed: Return≥10%, DD≤2.5%, WR≥65%, trades≥10

  function insertTop(arr, item, compareFn) {
    if (arr.length < TOP_K) { arr.push(item); arr.sort(compareFn); return; }
    if (compareFn(item, arr[arr.length - 1]) < 0) { arr[arr.length - 1] = item; arr.sort(compareFn); }
  }

  let tested = 0;

  for (const portfolioSize of PORTFOLIO_SIZES) {
    for (const topN of TOP_NS) {
      if (topN > portfolioSize) continue;
      for (const minScore of MIN_SCORES) {
        for (const [filterName, filterSet] of Object.entries(STRATEGY_FILTERS)) {
          for (const rotation of ROTATIONS) {
            for (const horizon of HORIZONS) {
              for (const [partialTP, partialTPPct] of tpCombos) {
                for (const trailingStop of TRAIL_MODES) {
                  for (const maxStopPct of MAX_STOP_PCTS) {
                    for (const atrStopMult of ATR_STOP_MULTS) {
                      for (const dailyTrailPct of DAILY_TRAIL_PCTS) {
                        for (const breakevenPct of BREAKEVEN_PCTS) {
                          for (const staleDays of STALE_DAYS) {
                        const key = `${horizon}_${partialTP}_${partialTPPct}_${trailingStop}_${maxStopPct}_${atrStopMult}_${dailyTrailPct}_${breakevenPct}_${staleDays}`;
                        const trades = tradesByKey[key] || [];

                        const config = { portfolioSize, topN, minScore, rotation,
                          strategyFilter: filterSet, horizonDays: horizon, partialTP, trailingStop };

                        const metrics = simulatePortfolio(trades, scans, config);
                        if (metrics && metrics.trades >= MIN_TRADES && metrics.returnTotal > 0) {
                          const r = {
                            portfolioSize, topN, minScore, filterName, rotation,
                            horizon, partialTP, partialTPPct, trailingStop, maxStopPct, atrStopMult, dailyTrailPct,
                            breakevenPct, staleDays,
                            ...metrics,
                          };
                          r.composite = (r.returnTotal / 30) + (1 / Math.max(0.5, Math.abs(r.maxDD))) + (r.winRate / 100) + (r.calmar / 10) + (r.profitFactor / 5);
                          insertTop(topBySharpe, r, (a, b) => b.sharpe - a.sharpe);
                          insertTop(topByReturn, r, (a, b) => b.returnTotal - a.returnTotal);
                          insertTop(topByCalmar, r, (a, b) => b.calmar - a.calmar);
                          insertTop(topByComposite, r, (a, b) => b.composite - a.composite);
                          insertTop(topByLowestDD, r, (a, b) => Math.abs(a.maxDD) - Math.abs(b.maxDD));
                          // Mode advisors — strict targets (aspirational)
                          if (r.returnTotal >= 35 && Math.abs(r.maxDD) <= 6 && r.winRate >= 60 && r.trades >= 10) {
                            insertTop(advDynamic, r, (a, b) => b.returnTotal - a.returnTotal);
                          }
                          if (r.returnTotal >= 24 && Math.abs(r.maxDD) <= 4 && r.winRate >= 60 && r.trades >= 10) {
                            insertTop(advBalanced, r, (a, b) => b.returnTotal - a.returnTotal);
                          }
                          if (r.returnTotal >= 12 && Math.abs(r.maxDD) <= 2 && r.winRate >= 75 && r.trades >= 10) {
                            insertTop(advSecured, r, (a, b) => b.returnTotal - a.returnTotal);
                          }
                          // Near-miss advisors — best achievable with relaxed constraints
                          if (r.returnTotal >= 30 && Math.abs(r.maxDD) <= 10 && r.winRate >= 55 && r.trades >= 10) {
                            insertTop(advDynamicRelaxed, r, (a, b) => b.returnTotal - a.returnTotal);
                          }
                          if (r.returnTotal >= 20 && Math.abs(r.maxDD) <= 5 && r.winRate >= 55 && r.trades >= 10) {
                            insertTop(advBalancedRelaxed, r, (a, b) => b.returnTotal - a.returnTotal);
                          }
                          if (r.returnTotal >= 10 && Math.abs(r.maxDD) <= 2.5 && r.winRate >= 65 && r.trades >= 10) {
                            insertTop(advSecuredRelaxed, r, (a, b) => b.returnTotal - a.returnTotal);
                          }
                        }

                        tested++;
                        if (tested % 5000 === 0) process.stdout.write(`  ${tested}/${total}\r`);
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  console.log(`\nTested ${tested} combinations\n`);

  // 5. Rank and display
  const ranked = topBySharpe;

  console.log(`TOP 20 COMBOS by Sharpe (min ${MIN_TRADES} trades):`);
  console.log('PSize TopN MinSc Filter          Rotation      Horiz  PTP  Trail MaxSt  ATR Trail  Return  MaxDD    WR    PF   Sharpe Calmar Trades');
  console.log('─'.repeat(150));

  for (const r of ranked.slice(0, 20)) {
    console.log(
      String(r.portfolioSize).padStart(5),
      String(r.topN).padStart(4),
      String(r.minScore).padStart(5),
      r.filterName.padEnd(16),
      r.rotation.padEnd(14),
      String(r.horizon).padStart(5),
      (r.partialTP ? 'Y' : 'N').padStart(4),
      (r.trailingStop ? 'Y' : 'N').padStart(5),
      (r.maxStopPct ? r.maxStopPct + '%' : '—').padStart(5),
      (r.atrStopMult ? r.atrStopMult + 'x' : '—').padStart(4),
      (r.dailyTrailPct ? r.dailyTrailPct + '%' : '—').padStart(5),
      ((r.returnTotal > 0 ? '+' : '') + r.returnTotal.toFixed(2) + '%').padStart(8),
      (r.maxDD.toFixed(2) + '%').padStart(8),
      (r.r2.toFixed(3)).padStart(6),
      (r.winRate.toFixed(1) + '%').padStart(6),
      (r.profitFactor.toFixed(2) + 'x').padStart(6),
      r.sharpe.toFixed(2).padStart(7),
      r.calmar.toFixed(1).padStart(6),
      String(r.trades).padStart(6),
    );
  }

  // Walk-forward validation on top 5
  if (ranked.length > 0) {
    console.log('\n=== WALK-FORWARD VALIDATION (top 5 in-sample → out-of-sample) ===\n');
    for (const r of ranked.slice(0, 5)) {
      // Re-simulate on in-sample only
      const wfKey = `${r.horizon}_${r.partialTP}_${r.trailingStop}_${r.maxStopPct || 0}_${r.atrStopMult || 0}_${r.dailyTrailPct || 0}`;
      const isTrades = (tradesByKey[wfKey] || [])
        .filter(t => inSampleDates.has(t.scanDate));
      const osTrades = (tradesByKey[wfKey] || [])
        .filter(t => outSampleDates.has(t.scanDate));

      const cfg = {
        portfolioSize: r.portfolioSize, topN: r.topN, minScore: r.minScore,
        rotation: r.rotation, strategyFilter: STRATEGY_FILTERS[r.filterName],
        horizonDays: r.horizon, partialTP: r.partialTP, trailingStop: r.trailingStop,
      };

      const isMetrics = simulatePortfolio(isTrades, scans, cfg);
      const osMetrics = simulatePortfolio(osTrades, scans, cfg);

      const isR = isMetrics ? `+${isMetrics.returnTotal.toFixed(2)}% DD=${isMetrics.maxDD.toFixed(2)}% Sharpe=${isMetrics.sharpe}` : 'N/A';
      const osR = osMetrics ? `+${osMetrics.returnTotal.toFixed(2)}% DD=${osMetrics.maxDD.toFixed(2)}% Sharpe=${osMetrics.sharpe}` : 'N/A';
      const degradation = (isMetrics && osMetrics && isMetrics.sharpe > 0)
        ? ((1 - osMetrics.sharpe / isMetrics.sharpe) * 100).toFixed(0) + '%'
        : 'N/A';

      console.log(`P${r.portfolioSize}/Top${r.topN}/Score${r.minScore}/${r.filterName}/${r.rotation}/H${r.horizon}/MaxSt=${r.maxStopPct||0}%/ATR=${r.atrStopMult||0}x/Trail=${r.dailyTrailPct||0}%:`);
      console.log(`  In-sample:  ${isR} (${isMetrics?.trades || 0} trades)`);
      console.log(`  Out-sample: ${osR} (${osMetrics?.trades || 0} trades)`);
      console.log(`  Degradation: ${degradation}`);
      console.log();
    }
  }

  // Top by different metrics
  const fmtR = r => `P${r.portfolioSize} Top${r.topN} Score≥${r.minScore} ${r.filterName} ${r.rotation} H${r.horizon} MaxSt=${r.maxStopPct||0}% ATR=${r.atrStopMult||0}x Trail=${r.dailyTrailPct||0}% TR=${r.trailingStop?'Y':'N'} BE=${r.breakevenPct||0}% Stale=${r.staleDays||0}d${r.partialTP ? ' PTP='+((r.partialTPPct||0.5)*100)+'%' : ''}`;

  console.log('TOP 5 by Composite (return + low DD + high WR + calmar + PF):');
  for (const r of topByComposite.slice(0, 5)) {
    console.log(`  ${fmtR(r)}: Return=${r.returnTotal > 0 ? '+' : ''}${r.returnTotal}% DD=${r.maxDD}% R2=${r.r2.toFixed(3)} WR=${r.winRate}% PF=${r.profitFactor} Composite=${r.composite.toFixed(2)}`);
  }

  console.log('\nTOP 5 by Return:');
  for (const r of topByReturn.slice(0, 5)) {
    console.log(`  ${fmtR(r)}: Return=${r.returnTotal > 0 ? '+' : ''}${r.returnTotal}% DD=${r.maxDD}% Sharpe=${r.sharpe}`);
  }

  console.log('\nTOP 5 by Calmar:');
  for (const r of topByCalmar.slice(0, 5)) {
    console.log(`  ${fmtR(r)}: Return=${r.returnTotal > 0 ? '+' : ''}${r.returnTotal}% DD=${r.maxDD}% Calmar=${r.calmar}`);
  }

  // ─── MODE ADVISOR: find best config for each objective ───────────────────
  console.log('\n═══ MODE ADVISOR ═══\n');

  console.log('DYNAMIC (Return≥35%, DD≤6%, WR≥60%, trades≥10 — sweep finds optimal P/filter/exit):');
  for (const r of advDynamic.slice(0, 10)) {
    console.log(`  ${fmtR(r)}: Ret=${r.returnTotal > 0 ? '+' : ''}${r.returnTotal}% DD=${r.maxDD}% R2=${r.r2.toFixed(3)} WR=${r.winRate}% PF=${r.profitFactor} trades=${r.trades}`);
  }

  console.log('\nBALANCED (Return≥24%, DD≤4%, WR≥60%, trades≥10 — sweep finds optimal P/filter/exit):');
  for (const r of advBalanced.slice(0, 10)) {
    console.log(`  ${fmtR(r)}: Ret=${r.returnTotal > 0 ? '+' : ''}${r.returnTotal}% DD=${r.maxDD}% R2=${r.r2.toFixed(3)} WR=${r.winRate}% PF=${r.profitFactor} trades=${r.trades}`);
  }

  console.log('\nSECURED (Return≥12%, DD≤2%, WR≥75%, trades≥10 — sweep finds optimal P/filter/exit):');
  for (const r of advSecured.slice(0, 10)) {
    console.log(`  ${fmtR(r)}: Ret=${r.returnTotal > 0 ? '+' : ''}${r.returnTotal}% DD=${r.maxDD}% R2=${r.r2.toFixed(3)} WR=${r.winRate}% PF=${r.profitFactor} trades=${r.trades}`);
  }

  console.log('\n─── NEAR-MISS (relaxed constraints — best achievable) ───\n');

  console.log('DYNAMIC near-miss (Return≥30%, DD≤10%, WR≥55%, trades≥10):');
  if (advDynamicRelaxed.length === 0) console.log('  (none found)');
  for (const r of advDynamicRelaxed.slice(0, 5)) {
    console.log(`  ${fmtR(r)}: Ret=${r.returnTotal > 0 ? '+' : ''}${r.returnTotal}% DD=${r.maxDD}% WR=${r.winRate}% PF=${r.profitFactor} trades=${r.trades}`);
  }

  console.log('\nBALANCED near-miss (Return≥20%, DD≤5%, WR≥55%, trades≥10):');
  if (advBalancedRelaxed.length === 0) console.log('  (none found)');
  for (const r of advBalancedRelaxed.slice(0, 5)) {
    console.log(`  ${fmtR(r)}: Ret=${r.returnTotal > 0 ? '+' : ''}${r.returnTotal}% DD=${r.maxDD}% WR=${r.winRate}% PF=${r.profitFactor} trades=${r.trades}`);
  }

  console.log('\nSECURED near-miss (Return≥10%, DD≤2.5%, WR≥65%, trades≥10):');
  if (advSecuredRelaxed.length === 0) console.log('  (none found)');
  for (const r of advSecuredRelaxed.slice(0, 5)) {
    console.log(`  ${fmtR(r)}: Ret=${r.returnTotal > 0 ? '+' : ''}${r.returnTotal}% DD=${r.maxDD}% WR=${r.winRate}% PF=${r.profitFactor} trades=${r.trades}`);
  }

  console.log();

  // 6. Save results
  const output = {
    generated_at: new Date().toISOString(),
    version: 2,
    period: { start: '2026-02-15', end: new Date().toISOString().slice(0,10), scans: scans.length },
    universe: { tickers: tickers.length, total_setups: allSetups.length, fetched: fetchedOK },
    walk_forward: { in_sample_scans: inSampleDates.size, out_sample_scans: outSampleDates.size },
    grid: {
      portfolio_sizes: PORTFOLIO_SIZES, top_ns: TOP_NS, min_scores: MIN_SCORES,
      horizons: HORIZONS, strategies: Object.keys(STRATEGY_FILTERS),
      rotations: ROTATIONS, tp_modes: TP_MODES, trail_modes: TRAIL_MODES, max_stop_pcts: MAX_STOP_PCTS, atr_stop_mults: ATR_STOP_MULTS, daily_trail_pcts: DAILY_TRAIL_PCTS, breakeven_pcts: BREAKEVEN_PCTS, stale_days: STALE_DAYS, tp_pcts: TP_PCTS,
      total_combos: tested,
    },
    optimal_sharpe: ranked[0] || null,
    optimal_return: topByReturn[0] || null,
    optimal_calmar: topByCalmar[0] || null,
    optimal_composite: topByComposite[0] || null,
    advisor_dynamic: advDynamic[0] || null,
    advisor_balanced: advBalanced[0] || null,
    advisor_secured: advSecured[0] || null,
    advisor_dynamic_relaxed: advDynamicRelaxed[0] || null,
    advisor_balanced_relaxed: advBalancedRelaxed[0] || null,
    advisor_secured_relaxed: advSecuredRelaxed[0] || null,
    top20_sharpe: ranked.slice(0, 20).map(r => ({
      portfolioSize: r.portfolioSize, topN: r.topN, minScore: r.minScore,
      filterName: r.filterName, rotation: r.rotation, horizon: r.horizon,
      partialTP: r.partialTP, partialTPPct: r.partialTPPct, trailingStop: r.trailingStop, maxStopPct: r.maxStopPct || 0, atrStopMult: r.atrStopMult || 0, dailyTrailPct: r.dailyTrailPct || 0, breakevenPct: r.breakevenPct || 0, staleDays: r.staleDays || 0,
      returnTotal: r.returnTotal, maxDD: r.maxDD, r2: r.r2, winRate: r.winRate,
      profitFactor: r.profitFactor, sharpe: r.sharpe, calmar: r.calmar,
      sortino: r.sortino, avgHold: r.avgHold, trades: r.trades,
    })),
    top20_return: topByReturn.slice(0, 20).map(r => ({
      portfolioSize: r.portfolioSize, topN: r.topN, minScore: r.minScore,
      filterName: r.filterName, rotation: r.rotation, horizon: r.horizon,
      partialTP: r.partialTP, partialTPPct: r.partialTPPct, trailingStop: r.trailingStop, maxStopPct: r.maxStopPct || 0, atrStopMult: r.atrStopMult || 0, dailyTrailPct: r.dailyTrailPct || 0, breakevenPct: r.breakevenPct || 0, staleDays: r.staleDays || 0,
      returnTotal: r.returnTotal, maxDD: r.maxDD, r2: r.r2, winRate: r.winRate,
      profitFactor: r.profitFactor, sharpe: r.sharpe, calmar: r.calmar,
      sortino: r.sortino, avgHold: r.avgHold, trades: r.trades,
    })),
    top20_calmar: topByCalmar.slice(0, 20).map(r => ({
      portfolioSize: r.portfolioSize, topN: r.topN, minScore: r.minScore,
      filterName: r.filterName, rotation: r.rotation, horizon: r.horizon,
      partialTP: r.partialTP, partialTPPct: r.partialTPPct, trailingStop: r.trailingStop, maxStopPct: r.maxStopPct || 0, atrStopMult: r.atrStopMult || 0, dailyTrailPct: r.dailyTrailPct || 0, breakevenPct: r.breakevenPct || 0, staleDays: r.staleDays || 0,
      returnTotal: r.returnTotal, maxDD: r.maxDD, r2: r.r2, winRate: r.winRate,
      profitFactor: r.profitFactor, sharpe: r.sharpe, calmar: r.calmar,
      sortino: r.sortino, avgHold: r.avgHold, trades: r.trades,
    })),
    top20_composite: topByComposite.slice(0, 20).map(r => ({
      portfolioSize: r.portfolioSize, topN: r.topN, minScore: r.minScore,
      filterName: r.filterName, rotation: r.rotation, horizon: r.horizon,
      partialTP: r.partialTP, partialTPPct: r.partialTPPct, trailingStop: r.trailingStop, maxStopPct: r.maxStopPct || 0, atrStopMult: r.atrStopMult || 0, dailyTrailPct: r.dailyTrailPct || 0, breakevenPct: r.breakevenPct || 0, staleDays: r.staleDays || 0,
      returnTotal: r.returnTotal, maxDD: r.maxDD, r2: r.r2, winRate: r.winRate,
      profitFactor: r.profitFactor, sharpe: r.sharpe, calmar: r.calmar,
      sortino: r.sortino, avgHold: r.avgHold, trades: r.trades,
    })),
  };


  // Save trade lists for 3 FROZEN modes (from modes-config.json)
  const MODES_CFG_PATH = path.join(ROOT, "data", "modes-config.json");
  const frozenTrades = {};
  if (fs.existsSync(MODES_CFG_PATH)) {
    const modesConfig = JSON.parse(fs.readFileSync(MODES_CFG_PATH));
    for (const [id, cfg] of Object.entries(modesConfig.modes)) {
      const frozenKey = `${cfg.horizon}_${cfg.partialTP || false}_${cfg.partialTPPct || 0.5}_${cfg.trailingStop || false}_${cfg.maxStopPct || 0}_${cfg.atrStopMult || 0}_${cfg.dailyTrailPct || 0}_${cfg.breakevenPct || 0}_${cfg.staleDays || 0}`;
      const trades2 = tradesByKey[frozenKey] || [];
      const cfg2 = {
        portfolioSize: cfg.portfolioSize, topN: cfg.topN, minScore: cfg.minScore || 0,
        rotation: cfg.rotation, strategyFilter: STRATEGY_FILTERS[cfg.filterName],
        horizonDays: cfg.horizon, partialTP: cfg.partialTP || false, partialTPPct: cfg.partialTPPct || 0.5,
        trailingStop: cfg.trailingStop || false,
      };
      const sim2 = simulatePortfolio(trades2, scans, cfg2);
      if (sim2 && sim2.closedTrades) {
        frozenTrades[id] = sim2.closedTrades.sort((a,b) => (a.scanDate||"").localeCompare(b.scanDate||""));
        // Save MtM metrics for gen-status-page.js
        output[`frozen_${id}`] = {
          returnTotal: sim2.returnTotal, maxDD: sim2.maxDD, winRate: sim2.winRate,
          profitFactor: sim2.profitFactor, trades: sim2.closedTrades.length,
          equityCurve: sim2.equityCurve,
        };
        console.log(`  ${id} (${cfg.label}): ${sim2.closedTrades.length} trades, return=${sim2.returnTotal}%, DD=${sim2.maxDD}%`);
      } else {
        console.log(`  ${id} (${cfg.label}): no trades`);
      }
    }
  } else {
    // Fallback: use optimal combos if no modes-config
    for (const [key, combo] of [["dynamic", topByReturn[0]], ["balanced", topByCalmar[0]], ["secured", ranked[0]]]) {
      if (!combo) continue;
      const fbKey = `${combo.horizon}_${combo.partialTP}_${combo.partialTPPct || 0.5}_${combo.trailingStop}_${combo.maxStopPct || 0}_${combo.atrStopMult || 0}_${combo.dailyTrailPct || 0}_${combo.breakevenPct || 0}_${combo.staleDays || 0}`;
      const trades2 = tradesByKey[fbKey] || [];
      const cfg2 = {
        portfolioSize: combo.portfolioSize, topN: combo.topN, minScore: combo.minScore,
        rotation: combo.rotation, strategyFilter: STRATEGY_FILTERS[combo.filterName],
        horizonDays: combo.horizon, partialTP: combo.partialTP, trailingStop: combo.trailingStop,
      };
      const sim2 = simulatePortfolio(trades2, scans, cfg2);
      if (sim2 && sim2.closedTrades) {
        frozenTrades[key] = sim2.closedTrades.sort((a,b) => (a.scanDate||"").localeCompare(b.scanDate||""));
      }
    }
  }
  fs.writeFileSync(path.join(ROOT, "data", "backtest-trades.json"), JSON.stringify(frozenTrades, null, 2));
  console.log("✅ Trade lists saved to data/backtest-trades.json (frozen modes)");

  // Save equity curve for optimal combo
  if (ranked[0]) {
    const best = ranked[0];
    fs.writeFileSync(path.join(ROOT, 'data', 'portfolio-history.json'), JSON.stringify({
      combo: {
        portfolioSize: best.portfolioSize, topN: best.topN, minScore: best.minScore,
        filterName: best.filterName, rotation: best.rotation, horizon: best.horizon,
        partialTP: best.partialTP, partialTPPct: best.partialTPPct, trailingStop: best.trailingStop, maxStopPct: best.maxStopPct || 0, atrStopMult: best.atrStopMult || 0, dailyTrailPct: best.dailyTrailPct || 0, breakevenPct: best.breakevenPct || 0, staleDays: best.staleDays || 0,
      },
      metrics: {
        returnTotal: best.returnTotal, maxDD: best.maxDD, winRate: best.winRate,
        sharpe: best.sharpe, calmar: best.calmar, sortino: best.sortino,
        profitFactor: best.profitFactor, avgHold: best.avgHold, trades: best.trades,
      },
      daily: best.equityCurve,
    }, null, 2));
    console.log('✅ Equity curve saved to data/portfolio-history.json');
  }
  
  fs.writeFileSync(path.join(ROOT, 'data', 'backtest-results.json'), JSON.stringify(output, null, 2));
  console.log('\n✅ Results saved to data/backtest-results.json');


  // ─── Compare with frozen modes ─────────────────────────────────────────────
  const MODES_CFG = path.join(ROOT, "data", "modes-config.json");
  if (fs.existsSync(MODES_CFG)) {
    const config = JSON.parse(fs.readFileSync(MODES_CFG));
    console.log("\n=== FROZEN MODES vs SWEEP OPTIMAL ===\n");
    console.log("All modes are FROZEN in data/modes-config.json.");
    console.log("The sweep NEVER modifies them. Comparison below:\n");

    const optMap = { dynamic: topByReturn[0], balanced: topByCalmar[0], secured: ranked[0] };
    for (const [id, cfg] of Object.entries(config.modes)) {
      const opt = optMap[id];
      if (!opt) continue;
      const same = opt.portfolioSize === cfg.portfolioSize && opt.topN === cfg.topN
        && opt.horizon === cfg.horizon && opt.filterName === cfg.filterName
        && opt.rotation === cfg.rotation && (opt.maxStopPct || 0) === (cfg.maxStopPct || 0)
        && (opt.atrStopMult || 0) === (cfg.atrStopMult || 0) && (opt.dailyTrailPct || 0) === (cfg.dailyTrailPct || 0)
        && (opt.breakevenPct || 0) === (cfg.breakevenPct || 0) && (opt.staleDays || 0) === (cfg.staleDays || 0);
      const frozen = `P${cfg.portfolioSize}/Top${cfg.topN}/H${cfg.horizon}/${cfg.filterName}/${cfg.rotation}/MaxSt=${cfg.maxStopPct||0}%/ATR=${cfg.atrStopMult||0}x/Trail=${cfg.dailyTrailPct||0}%/BE=${cfg.breakevenPct||0}%/Stale=${cfg.staleDays||0}d`;
      const sweep = `P${opt.portfolioSize}/Top${opt.topN}/H${opt.horizon}/${opt.filterName}/${opt.rotation}/MaxSt=${opt.maxStopPct||0}%/ATR=${opt.atrStopMult||0}x/Trail=${opt.dailyTrailPct||0}%/BE=${opt.breakevenPct||0}%/Stale=${opt.staleDays||0}d`;
      console.log(`${id.toUpperCase()} (${cfg.label}):`);
      console.log(`  Frozen: ${frozen}`);
      console.log(`  Sweep : ${sweep} (Return=${opt.returnTotal}% Sharpe=${opt.sharpe})`);
      console.log(`  ${same ? "✅ Match" : "⚠️  DIFFERENT — consider manual update"}`);
      console.log();
    }
  }
}

main().catch(e => { console.error('Fatal:', e.message, e.stack); process.exit(1); });
