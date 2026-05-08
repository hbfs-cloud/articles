#!/usr/bin/env node
'use strict';
/**
 * optimize-param.js — Single-parameter sweep with plateau detection
 *
 * Follows the mountain plateau methodology: sweep one param at a time,
 * all others fixed at baseline. Identify the stable plateau (not the peak),
 * then pick the center of the widest plateau.
 *
 * Usage:
 *   node tools/optimize-param.js --mode balanced --param maxStopPct --range 1,2,3,4,5,6,7,8,9,10
 *   node tools/optimize-param.js --mode balanced --param filterName --range all,momentum_only,breakout_only,mom_bo
 *   node tools/optimize-param.js --mode balanced --all   # sweep all params sequentially
 *   node tools/optimize-param.js --mode balanced --all --quick  # fewer values per param
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCANNER_DIR = path.join(ROOT, 'scanner');
const PRICE_CACHE_DIR = path.join(ROOT, 'data', '.price-cache');
fs.mkdirSync(PRICE_CACHE_DIR, { recursive: true });

const scannerParser = require('./lib/scanner-parser');

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.findIndex(a => a === name || a.startsWith(name + '='));
  if (idx === -1) return null;
  if (args[idx].includes('=')) return args[idx].split('=').slice(1).join('=');
  return args[idx + 1] || null;
}
function hasFlag(name) { return args.includes(name); }

const MODE_ARG = getArg('--mode');
const PARAM_ARG = getArg('--param');
const RANGE_ARG = getArg('--range');
const ALL_MODE = hasFlag('--all');
const QUICK = hasFlag('--quick');
const FROM_ARG = args.find(a => a.startsWith('--from='));
const FROM_DATE = FROM_ARG ? FROM_ARG.split('=')[1] : null;

if (!MODE_ARG) {
  console.error('Usage: node tools/optimize-param.js --mode <mode> [--param <param>] [--range <v1,v2,...>] [--all]');
  process.exit(1);
}
if (!ALL_MODE && !PARAM_ARG) {
  console.error('Specify --param <name> or --all');
  process.exit(1);
}

// ─── Default parameter ranges ─────────────────────────────────────────────────

const PARAM_RANGES_FULL = {
  portfolioSize:  [1, 2, 3, 4, 5, 8, 10, 15],
  topN:           [1, 2, 3, 4, 5, 8, 10],
  maxStopPct:     [0, 1, 2, 3, 4, 5, 7, 10],
  atrStopMult:    [0, 0.5, 1, 1.5, 2, 2.5, 3],
  horizon:        [2, 3, 5, 8, 10, 15],
  dailyTrailPct:  [0, 1, 2, 3, 4, 5],
  breakevenPct:   [0, 0.5, 1, 1.5, 2, 3],
  staleDays:      [0, 1, 2, 3, 5],
  minScore:       [80, 82, 85, 88, 90, 92, 95],
  filterName:     ['all', 'momentum_only', 'breakout_only', 'mom_bo', 'no_sq_pb'],
  rotation:       ['none', 'daily_max1', 'aggressive'],
  partialTP:      [false, true],
  entryGatePct:   [0, 1, 2, 3, 5],
};

const PARAM_RANGES_QUICK = {
  portfolioSize:  [1, 2, 3, 5, 8],
  topN:           [1, 2, 3, 5],
  maxStopPct:     [0, 2, 5, 7, 10],
  atrStopMult:    [0, 1, 2, 3],
  horizon:        [2, 5, 8, 15],
  dailyTrailPct:  [0, 1, 2, 4],
  breakevenPct:   [0, 0.5, 1, 2],
  staleDays:      [0, 1, 2, 5],
  minScore:       [80, 85, 90, 95],
  filterName:     ['all', 'momentum_only', 'breakout_only', 'mom_bo'],
  rotation:       ['none', 'daily_max1', 'aggressive'],
  partialTP:      [false, true],
  entryGatePct:   [0, 2, 5],
};

const PARAM_RANGES = QUICK ? PARAM_RANGES_QUICK : PARAM_RANGES_FULL;

// Order params are swept in --all mode (highest impact first)
const PARAM_ORDER = [
  'portfolioSize', 'topN', 'maxStopPct', 'atrStopMult', 'horizon',
  'dailyTrailPct', 'breakevenPct', 'staleDays', 'minScore',
  'filterName', 'rotation', 'partialTP', 'entryGatePct',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function toDateStr(ts) {
  return new Date(ts * 1000).toISOString().slice(0, 10);
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

function bizDaysBetween(dateA, dateB) {
  let d = new Date(dateA + 'T12:00:00Z');
  const end = new Date(dateB + 'T12:00:00Z');
  if (d >= end) return 0;
  let count = 0;
  while (d < end) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) count++;
  }
  return count;
}

// ─── Strategy filter map (copied from sweep.js) ───────────────────────────────

const STRATEGY_FILTERS_MAP = {
  'all':           new Set(),
  'no_sq':         new Set(['short_squeeze']),
  'no_sq_pb':      new Set(['short_squeeze', 'pullback']),
  'momentum_only': new Set(['short_squeeze', 'pre_squeeze', 'breakout', 'pullback']),
  'breakout_only': new Set(['short_squeeze', 'pre_squeeze', 'momentum', 'pullback']),
  'mom_bo':        new Set(['short_squeeze', 'pre_squeeze', 'pullback']),
};

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

function normalizeRegime(regime) {
  if (!regime) return '';
  return String(regime).toLowerCase().replace(/[\s-]+/g, '_');
}

// ─── Price cache ──────────────────────────────────────────────────────────────

const priceCache = {};

function loadCachedPrice(ticker) {
  const fp = path.join(PRICE_CACHE_DIR, `${ticker}.json`);
  if (!fs.existsSync(fp)) return null;
  const stat = fs.statSync(fp);
  if (Date.now() - stat.mtimeMs > 12 * 3600 * 1000) return null;
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return null; }
}

function saveCachedPrice(ticker, history) {
  const fp = path.join(PRICE_CACHE_DIR, `${ticker}.json`);
  try { fs.writeFileSync(fp, JSON.stringify(history)); } catch {}
}

async function fetchOHLCV(ticker) {
  if (priceCache[ticker]) return priceCache[ticker];
  const cached = loadCachedPrice(ticker);
  if (cached) { priceCache[ticker] = cached; return cached; }
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=120d`;
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 12000 }, (res) => {
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

// ─── Scan parsing ─────────────────────────────────────────────────────────────

function parseScan(dir) {
  const dm = dir.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!dm) return null;
  const scanDate = `${dm[1]}-${dm[2]}-${dm[3]}`;
  const loaded = scannerParser.loadSignals(dir);
  if (!loaded || !loaded.signals.length) return null;

  const buildSetups = (arr) => {
    const out = [];
    for (const s of arr || []) {
      const { entry, stop, tp1, tp2 } = s;
      if (!entry || !stop || !tp1 || entry <= 0 || stop <= 0) continue;
      if (stop >= entry) continue;
      if (tp1 <= entry) continue;
      out.push({
        ticker: s.ticker,
        strategy: detectStrategy(s.strategy || ''),
        score: s.score || 80,
        entry, stop, tp1, tp2,
        sharia: s.sharia,
        source: s.source || 'signals',
      });
    }
    return out;
  };

  const seen = new Set();
  const setups = buildSetups(loaded.signals)
    .filter(s => { if (seen.has(s.ticker)) return false; seen.add(s.ticker); return true; })
    .sort((a, b) => b.score - a.score);

  return { dir, scanDate, regime: loaded.regime || null, setups };
}

// ─── ATR computation ──────────────────────────────────────────────────────────

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

// ─── simulateTrade (ported from sweep.js) ────────────────────────────────────

function simulateTrade(setup, scanDate, priceHistory, config = {}) {
  const {
    horizonDays = 20, partialTP = false, partialTPPct = 0.5, trailingStop = false,
    maxStopPct = 0, atrStopMult = 0, dailyTrailPct = 0,
    breakevenPct = 0, staleDays = 0, entryGatePct = 0, vwapGate = false,
  } = config;
  if (!priceHistory) return null;

  const entryDate = scanDate;
  const entryBar = priceHistory[entryDate];
  if (!entryBar) return null;

  const actualEntry = entryBar.open;
  if (!actualEntry || actualEntry <= 0) return null;
  if (actualEntry <= setup.stop) return null;
  if (entryGatePct > 0 && actualEntry > setup.entry * (1 + entryGatePct / 100)) return null;

  let entryPrice = actualEntry;
  let vwapRef = null;
  const allDates = Object.keys(priceHistory).sort();
  const entryIdx = allDates.indexOf(entryDate);
  const prevBar = entryIdx > 0 ? priceHistory[allDates[entryIdx - 1]] : null;
  if (prevBar && prevBar.high && prevBar.low && prevBar.close) {
    vwapRef = (prevBar.high + prevBar.low + prevBar.close) / 3;
  }
  if (vwapGate && vwapRef !== null) {
    if (actualEntry > vwapRef * 1.01) return null;
    entryPrice = Math.max(Math.min(actualEntry, vwapRef), entryBar.low);
  }

  let riskPerUnit = setup.entry - setup.stop;
  if (riskPerUnit <= 0) return null;

  const effectiveMaxStop = maxStopPct > 0 ? maxStopPct : 100;
  if (effectiveMaxStop < 100) {
    const maxRisk = entryPrice * (effectiveMaxStop / 100);
    if (riskPerUnit > maxRisk) riskPerUnit = maxRisk;
  }

  if (atrStopMult > 0) {
    const atr = computeATR(priceHistory, entryDate);
    if (atr) {
      const atrRisk = atr * atrStopMult;
      if (atrRisk < riskPerUnit) riskPerUnit = atrRisk;
    }
  }

  const actualStop = entryPrice - riskPerUnit;
  const rewardMult1 = (setup.tp1 - setup.entry) / riskPerUnit;
  const actualTp1 = entryPrice + riskPerUnit * rewardMult1;
  const rewardMult2 = setup.tp2 ? (setup.tp2 - setup.entry) / riskPerUnit : rewardMult1 * 1.5;
  const actualTp2 = entryPrice + riskPerUnit * rewardMult2;

  const rrRatio = (actualTp1 - entryPrice) / riskPerUnit;
  if (rrRatio < 1.5) return null;

  const expireDate = addBizDays(scanDate, horizonDays);
  const sortedDates = Object.keys(priceHistory)
    .filter(d => d >= entryDate && d <= expireDate).sort();

  let currentStop = actualStop;
  let status = 'open';
  let exitDate = null;
  let exitPrice = null;
  let partialRealized = 0;
  let highWaterMark = entryPrice;
  let daysSinceNewHigh = 0;
  let breakevenActivated = false;

  for (const date of sortedDates) {
    const bar = priceHistory[date];
    if (!bar) continue;

    if (bar.low <= currentStop) {
      if (partialRealized > 0) status = 'tp1_partial';
      else if (currentStop > entryPrice) status = 'trail';
      else if (currentStop >= entryPrice) status = 'breakeven';
      else status = 'sl';
      exitDate = date;
      exitPrice = currentStop;
      break;
    }

    if (bar.high >= actualTp2) {
      status = 'tp2';
      exitDate = date;
      exitPrice = actualTp2;
      break;
    }

    if (bar.high >= actualTp1 && partialRealized === 0) {
      if (partialTP) {
        const tpFrac = partialTPPct * 100;
        partialRealized = ((actualTp1 - entryPrice) / entryPrice) * tpFrac;
        if (trailingStop) currentStop = entryPrice;
      } else {
        status = 'tp1';
        exitDate = date;
        exitPrice = actualTp1;
        break;
      }
    }

    if (trailingStop && partialRealized > 0) {
      const trailLevel = bar.high - riskPerUnit * 1.5;
      if (trailLevel > currentStop) currentStop = trailLevel;
    }

    if (dailyTrailPct > 0) {
      const trailLevel = bar.close * (1 - dailyTrailPct / 100);
      if (trailLevel > currentStop) currentStop = trailLevel;
    }

    if (breakevenPct > 0 && !breakevenActivated) {
      const currentGain = (bar.high - entryPrice) / entryPrice * 100;
      if (currentGain >= breakevenPct) {
        breakevenActivated = true;
        if (entryPrice > currentStop) currentStop = entryPrice;
      }
    }

    if (staleDays > 0) {
      if (bar.high > highWaterMark) {
        highWaterMark = bar.high;
        daysSinceNewHigh = 0;
      } else {
        daysSinceNewHigh++;
      }
      if (daysSinceNewHigh >= staleDays) {
        const staleRaise = (daysSinceNewHigh - staleDays + 1) * 0.002 * entryPrice;
        const tightenedStop = currentStop + staleRaise;
        if (tightenedStop > currentStop && tightenedStop < bar.close) currentStop = tightenedStop;
      }
    }
  }

  if (status === 'open') {
    const lastDate = sortedDates[sortedDates.length - 1];
    const expireBar = priceHistory[lastDate];
    if (!expireBar) return null;
    if (lastDate < expireDate) {
      status = 'pending';
      exitDate = lastDate;
      exitPrice = expireBar.close;
    } else {
      status = 'expired';
      exitDate = lastDate;
      exitPrice = expireBar.close;
    }
  }

  let pnlPct;
  if (partialTP && partialRealized > 0) {
    const tpFrac = partialTPPct * 100;
    const remainingPnl = ((exitPrice - entryPrice) / entryPrice) * (100 - tpFrac);
    pnlPct = (partialRealized + remainingPnl) / 100;
  } else {
    pnlPct = (exitPrice - entryPrice) / entryPrice;
  }

  return {
    ticker: setup.ticker,
    strategy: setup.strategy,
    score: setup.score,
    scanDate,
    entryDate,
    actualEntry: entryPrice,
    actualStop,
    actualTp1,
    actualTp2,
    status,
    exitDate,
    exitPrice,
    pnlPct: +(pnlPct * 100).toFixed(2),
    holdDays: sortedDates.indexOf(exitDate) + 1,
    source: setup.source || 'signals',
  };
}

// ─── simulatePortfolio (ported from sweep.js, simplified) ─────────────────────

function simulatePortfolio(allTrades, config) {
  const {
    portfolioSize, topN, minScore = 0, filterName = 'all',
    rotation = 'none', horizonDays = 20, partialTP = false,
    regimeFilters = null,
  } = config;

  const strategyFilter = STRATEGY_FILTERS_MAP[filterName] || new Set();
  const weight = (1 / portfolioSize) * (config.positionSizePct || 1);

  const byDate = {};
  const regimeByDate = {};
  for (const t of allTrades) {
    if (t.score < minScore) continue;
    if (!byDate[t.scanDate]) byDate[t.scanDate] = [];
    byDate[t.scanDate].push(t);
    if (t.regime && !regimeByDate[t.scanDate]) regimeByDate[t.scanDate] = t.regime;
  }

  const openPositions = [];
  const closedTrades = [];
  const slCooldown = new Map();
  const allScanDates = Object.keys(byDate).sort();
  if (allScanDates.length === 0) return null;

  const startDate = allScanDates[0];
  const endDate = allScanDates[allScanDates.length - 1];
  const allDays = getAllBizDays(startDate, addBizDays(endDate, horizonDays + 5));

  let realizedPnl = 0;
  const equityCurve = [{ date: startDate, value: 100 }];
  const scanDateSet = new Set(allScanDates);

  for (const day of allDays) {
    const stillOpen = [];
    for (const pos of openPositions) {
      if (pos.trade.exitDate && pos.trade.exitDate <= day) {
        if (pos.trade.status !== 'pending') realizedPnl += pos.trade.pnlPct * weight;
        closedTrades.push(pos.trade);
        if (pos.trade.status === 'sl') slCooldown.set(pos.trade.ticker, pos.trade.exitDate);
      } else {
        stillOpen.push(pos);
      }
    }
    openPositions.length = 0;
    openPositions.push(...stillOpen);

    if (scanDateSet.has(day)) {
      let activeFilter = strategyFilter;
      if (regimeFilters) {
        const scanRegimeRaw = regimeByDate[day];
        if (scanRegimeRaw) {
          const regimeKey = normalizeRegime(scanRegimeRaw);
          const overrideName = regimeFilters[regimeKey];
          if (overrideName && STRATEGY_FILTERS_MAP[overrideName]) {
            activeFilter = STRATEGY_FILTERS_MAP[overrideName];
          }
        }
      }

      const filtered = (byDate[day] || []).filter(t => !activeFilter.has(t.strategy));
      const candidates = filtered.slice(0, topN);
      let slotsAvailable = portfolioSize - openPositions.length;

      // Rotation
      if (rotation !== 'none' && slotsAvailable <= 0 && candidates.length > 0) {
        const sorted = [...openPositions].sort((a, b) => a.trade.score - b.trade.score);
        const rotLimit = rotation === 'daily_max1' ? 1 : rotation === 'daily_max2' ? 2 : portfolioSize;
        const margin = rotation === 'aggressive' ? 0 : 5;
        let rotated = 0;
        for (const cand of candidates) {
          if (rotated >= rotLimit || rotated >= sorted.length) break;
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

      const openTickers = new Set(openPositions.map(p => p.trade.ticker));
      for (const cand of candidates) {
        if (openPositions.length >= portfolioSize) break;
        if (openTickers.has(cand.ticker)) continue;
        const lastSL = slCooldown.get(cand.ticker);
        if (lastSL && bizDaysBetween(lastSL, day) < 10) continue;
        openPositions.push({ trade: cand });
        openTickers.add(cand.ticker);
      }
    }

    let unrealizedPnl = 0;
    for (const pos of openPositions) {
      const hist = priceCache[pos.trade.ticker];
      if (hist && hist[day]) {
        unrealizedPnl += ((hist[day].close - pos.trade.actualEntry) / pos.trade.actualEntry) * 100 * weight;
      }
    }
    equityCurve.push({ date: day, value: +(100 + realizedPnl + unrealizedPnl).toFixed(2) });
  }

  let unrealizedSnapshot = 0;
  const lastDay = allDays[allDays.length - 1];
  for (const pos of openPositions) {
    const hist = priceCache[pos.trade.ticker];
    if (hist && hist[lastDay]) {
      unrealizedSnapshot += ((hist[lastDay].close - pos.trade.actualEntry) / pos.trade.actualEntry) * 100 * weight;
    }
    closedTrades.push(pos.trade);
  }

  const equity = 100 + realizedPnl + unrealizedSnapshot;
  const values = equityCurve.map(d => d.value);

  let peak = 100, maxDD = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    const dd = peak - v;
    if (dd > maxDD) maxDD = dd;
  }

  const RESOLVED_STATUSES = new Set(['tp1', 'tp1_partial', 'tp2', 'sl', 'expired', 'rotated', 'breakeven', 'trail']);
  const resolved = closedTrades.filter(t => {
    const base = (t.status || '').replace(/_amb$/, '');
    return RESOLVED_STATUSES.has(base);
  });

  const wins = resolved.filter(t => (t.pnlPct || 0) > 0);
  const losses = resolved.filter(t => (t.pnlPct || 0) <= 0);
  const winRate = resolved.length ? +((wins.length / resolved.length) * 100).toFixed(1) : 0;
  const grossWin = wins.reduce((s, t) => s + t.pnlPct, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));
  const profitFactor = grossLoss > 0 ? +(grossWin / grossLoss).toFixed(2) : grossWin > 0 ? 99 : 0;
  const returnTotal = +(equity - 100).toFixed(2);
  const returnDDRatio = maxDD > 0 ? +(returnTotal / maxDD).toFixed(2) : returnTotal > 0 ? 99 : 0;

  let sharpe = 0;
  if (values.length > 2) {
    const dailyRet = [];
    for (let i = 1; i < values.length; i++) {
      if (values[i - 1] > 0) dailyRet.push((values[i] - values[i - 1]) / values[i - 1]);
    }
    if (dailyRet.length > 1) {
      const mean = dailyRet.reduce((s, r) => s + r, 0) / dailyRet.length;
      const variance = dailyRet.reduce((s, r) => s + (r - mean) ** 2, 0) / (dailyRet.length - 1);
      const stdev = Math.sqrt(variance);
      if (stdev > 0) sharpe = +(Math.sqrt(252) * mean / stdev).toFixed(2);
    }
  }

  return {
    returnTotal,
    maxDD: +(-maxDD).toFixed(2),
    winRate,
    profitFactor,
    sharpe,
    returnDDRatio,
    trades: resolved.length,
  };
}

// ─── Plateau detection ────────────────────────────────────────────────────────

/**
 * Detect the widest plateau where all returns are within `threshold` (0–1)
 * of the max return in that region. Returns { start, end, center } as indices.
 */
function detectPlateau(values, threshold = 0.85) {
  if (values.length === 0) return null;
  const maxVal = Math.max(...values);
  if (maxVal <= 0) return null;

  // Mark each value as "in plateau" if it's within threshold of max
  const inPlateau = values.map(v => v / maxVal >= threshold);

  // Find widest contiguous plateau region
  let bestStart = 0, bestLen = 0;
  let curStart = -1, curLen = 0;
  for (let i = 0; i < inPlateau.length; i++) {
    if (inPlateau[i]) {
      if (curStart === -1) curStart = i;
      curLen++;
      if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
    } else {
      curStart = -1; curLen = 0;
    }
  }

  if (bestLen === 0) {
    // No plateau — just pick the max
    const maxIdx = values.indexOf(maxVal);
    return { start: maxIdx, end: maxIdx, center: maxIdx, width: 1 };
  }

  const end = bestStart + bestLen - 1;
  const center = bestStart + Math.floor(bestLen / 2);
  return { start: bestStart, end, center, width: bestLen };
}

// ─── Table formatting ─────────────────────────────────────────────────────────

function fmtNum(v, decimals = 1) {
  if (v == null || isNaN(v)) return '  N/A';
  return v.toFixed(decimals).padStart(6);
}

function printTable(paramName, values, results, plateau) {
  const colW = { val: 10, ret: 8, dd: 8, wr: 7, pf: 6, sh: 7, trades: 7, mark: 12 };

  const header =
    padR('Value', colW.val) + padR('Return', colW.ret) + padR('MaxDD', colW.dd) +
    padR('WinRate', colW.wr) + padR('PF', colW.pf) + padR('Sharpe', colW.sh) +
    padR('Trades', colW.trades) + 'Plateau?';
  console.log(header);
  console.log('-'.repeat(header.length));

  for (let i = 0; i < values.length; i++) {
    const r = results[i];
    const val = String(values[i]);
    let mark = '';
    if (plateau) {
      if (i === plateau.center) mark = '<- recommended';
      else if (i >= plateau.start && i <= plateau.end) mark = 'plateau';
    }
    if (!r) {
      console.log(padR(val, colW.val) + '  (no trades)');
      continue;
    }
    const line =
      padR(val, colW.val) +
      padL(fmtNum(r.returnTotal) + '%', colW.ret) +
      padL(fmtNum(r.maxDD) + '%', colW.dd) +
      padL(fmtNum(r.winRate) + '%', colW.wr) +
      padL(fmtNum(r.profitFactor, 2), colW.pf) +
      padL(fmtNum(r.sharpe, 2), colW.sh) +
      padL(String(r.trades), colW.trades) +
      (mark ? '  ' + mark : '');
    console.log(line);
  }
}

function padR(s, w) { return String(s).padEnd(w); }
function padL(s, w) { return String(s).padStart(w); }

// ─── Single-param sweep ───────────────────────────────────────────────────────

async function sweepParam(paramName, range, baselineConfig, allSetups) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Optimizing: ${paramName} for mode "${MODE_ARG}"`);

  // Build baseline description
  const bc = baselineConfig;
  const baselineDesc = [
    `P${bc.portfolioSize}`, `Top${bc.topN}`, `H${bc.horizon}`,
    bc.filterName, bc.rotation, `MaxSt=${bc.maxStopPct}%`,
    `ATR${bc.atrStopMult}x`, `Trail${bc.dailyTrailPct}%`,
    `BE${bc.breakevenPct}%`, `Score${bc.minScore}`,
  ].join('/');
  console.log(`Baseline: ${baselineDesc}`);
  console.log(`Sweeping ${range.length} values: ${range.join(', ')}`);

  const results = [];

  for (let i = 0; i < range.length; i++) {
    const value = range[i];
    process.stdout.write(`  [${i + 1}/${range.length}] ${paramName}=${value}...`);

    // Build config for this iteration
    const cfg = buildConfig(baselineConfig, paramName, value);

    // Pre-simulate trades with trade-level config
    const trades = [];
    for (const setup of allSetups) {
      const history = priceCache[setup.ticker];
      const result = simulateTrade(setup, setup.scanDate, history, {
        horizonDays: cfg.horizon,
        partialTP: cfg.partialTP || false,
        partialTPPct: cfg.partialTPPct || 0.5,
        trailingStop: cfg.trailingStop || false,
        maxStopPct: cfg.maxStopPct || 0,
        atrStopMult: cfg.atrStopMult || 0,
        dailyTrailPct: cfg.dailyTrailPct || 0,
        breakevenPct: cfg.breakevenPct || 0,
        staleDays: cfg.staleDays || 0,
        entryGatePct: cfg.entryGatePct || 0,
        vwapGate: cfg.vwapGate !== false,
      });
      if (result) trades.push({ ...result, regime: setup.regime || null });
    }

    // Run portfolio simulation
    const metrics = simulatePortfolio(trades, cfg);
    results.push(metrics);

    const ret = metrics ? `${metrics.returnTotal.toFixed(1)}%` : 'N/A';
    const sh = metrics ? `sh=${metrics.sharpe.toFixed(2)}` : '';
    const tr = metrics ? `${metrics.trades}tr` : '';
    process.stdout.write(` return=${ret} ${sh} ${tr}\n`);
  }

  // Detect plateau on returnTotal
  const returnValues = results.map(r => r ? r.returnTotal : 0);
  const plateau = detectPlateau(returnValues);

  console.log('');
  printTable(paramName, range, results, plateau);

  if (plateau) {
    const centerVal = range[plateau.center];
    const plateauRange = plateau.start === plateau.end
      ? `[${range[plateau.start]}]`
      : `[${range[plateau.start]} – ${range[plateau.end]}]`;
    const stability = (plateau.width / range.length * 100).toFixed(0);
    console.log(`\nPlateau: ${plateauRange} (${plateau.width} of ${range.length} values, ${stability}% stable)`);
    console.log(`Recommended: ${paramName} = ${centerVal}  (center of plateau)`);
    console.log(`Current baseline: ${baselineConfig[paramName]}`);
    if (String(centerVal) !== String(baselineConfig[paramName])) {
      console.log(`  -> Suggestion: change ${paramName} from ${baselineConfig[paramName]} to ${centerVal}`);
    } else {
      console.log(`  -> Baseline is already optimal.`);
    }
    return { paramName, recommended: centerVal, plateau: plateauRange, stability: `${stability}%`, results };
  }

  return { paramName, recommended: null, plateau: null, stability: '0%', results };
}

// ─── Config builder ───────────────────────────────────────────────────────────

function buildConfig(baseline, paramName, value) {
  const cfg = { ...baseline };

  // Map filterName → strategyFilter internally
  if (paramName === 'filterName') {
    cfg.filterName = value;
  } else if (paramName === 'partialTP') {
    cfg.partialTP = value === true || value === 'true';
  } else {
    cfg[paramName] = typeof value === 'string' && !isNaN(value) ? parseFloat(value) : value;
  }

  return cfg;
}

// ─── Parse CLI range ──────────────────────────────────────────────────────────

function parseRange(rawRange, paramName) {
  if (!rawRange) return PARAM_RANGES[paramName] || [];
  return rawRange.split(',').map(v => {
    const trimmed = v.trim();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    const n = parseFloat(trimmed);
    return isNaN(n) ? trimmed : n;
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== DailyTickers — Parameter Optimizer (Plateau Method) ===\n');

  // 1. Load baseline config
  const cfgPath = path.join(ROOT, 'data', 'modes-config.json');
  if (!fs.existsSync(cfgPath)) { console.error('modes-config.json not found'); process.exit(1); }
  const modesConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const baselineConfig = modesConfig.modes[MODE_ARG];
  if (!baselineConfig) {
    console.error(`Mode "${MODE_ARG}" not found. Available: ${Object.keys(modesConfig.modes).join(', ')}`);
    process.exit(1);
  }

  console.log(`Mode: ${MODE_ARG} (${baselineConfig.label})`);
  console.log(`Regime: ${modesConfig._regime || 'N/A'}  Version: ${modesConfig._version || 'N/A'}\n`);

  // 2. Parse scans
  const scanDirs = fs.readdirSync(SCANNER_DIR)
    .filter(d => /^\d{8}(-\d+)?$/.test(d))
    .filter(d => {
      const date = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
      return date >= (FROM_DATE || '2026-02-15');
    })
    .sort();

  console.log(`Parsing ${scanDirs.length} scans...`);
  const scans = scanDirs.map(d => parseScan(d)).filter(Boolean);
  let allSetups = scans.flatMap(s =>
    s.setups.map(t => ({ ...t, scanDate: s.scanDate, dir: s.dir, regime: s.regime }))
  );
  console.log(`Total setups: ${allSetups.length} across ${scans.length} scans`);

  // 3. Fetch prices (with file cache — fast on repeat runs)
  const tickers = [...new Set(allSetups.map(t => t.ticker))];
  console.log(`\nFetching price history for ${tickers.length} tickers...`);
  let fetched = 0;
  for (const ticker of tickers) {
    await fetchOHLCV(ticker);
    fetched++;
    if (fetched % 10 === 0) process.stdout.write(`  ${fetched}/${tickers.length}\r`);
    // Only sleep if we didn't get it from cache
    if (!loadCachedPrice(ticker) && fetched < tickers.length) await sleep(100);
  }
  const fetchedOK = Object.keys(priceCache).filter(k => priceCache[k]).length;
  console.log(`\nFetched prices for ${fetchedOK}/${tickers.length} tickers`);

  // 4. Sweep param(s)
  const summaries = [];

  if (ALL_MODE) {
    // Sweep all params sequentially, using baseline (not updating after each)
    for (const paramName of PARAM_ORDER) {
      if (!PARAM_RANGES[paramName]) continue;
      const range = PARAM_RANGES[paramName];
      const result = await sweepParam(paramName, range, baselineConfig, allSetups);
      summaries.push(result);
    }
  } else {
    const range = parseRange(RANGE_ARG, PARAM_ARG);
    if (range.length === 0) {
      console.error(`No range for param "${PARAM_ARG}". Provide --range or ensure param is in PARAM_RANGES.`);
      process.exit(1);
    }
    const result = await sweepParam(PARAM_ARG, range, baselineConfig, allSetups);
    summaries.push(result);
  }

  // 5. Final summary
  if (summaries.length > 1) {
    console.log(`\n${'='.repeat(60)}`);
    console.log('SUMMARY — All Parameters');
    console.log('='.repeat(60));
    console.log(padR('Parameter', 18) + padR('Current', 12) + padR('Recommended', 14) + padR('Plateau', 20) + 'Stability');
    console.log('-'.repeat(70));
    for (const s of summaries) {
      const cur = String(baselineConfig[s.paramName] ?? 'N/A');
      const rec = String(s.recommended ?? 'N/A');
      const changed = rec !== cur && rec !== 'N/A' ? ' *' : '';
      console.log(
        padR(s.paramName, 18) +
        padR(cur, 12) +
        padR(rec + changed, 14) +
        padR(s.plateau || 'N/A', 20) +
        s.stability
      );
    }
    const changed = summaries.filter(s => s.recommended != null && String(s.recommended) !== String(baselineConfig[s.paramName]));
    if (changed.length) {
      console.log(`\n${changed.length} parameter(s) suggest changes (marked with *):`);
      for (const s of changed) {
        console.log(`  ${s.paramName}: ${baselineConfig[s.paramName]} -> ${s.recommended}`);
      }
    } else {
      console.log('\nBaseline is at plateau center for all parameters — config is stable.');
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
