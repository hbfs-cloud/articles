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
 *   node tools/test-ab-backtest-full.js                         # full 3500+ universe, 5Y
 *   node tools/test-ab-backtest-full.js --quick 300             # quick test with 300 tickers
 *   node tools/test-ab-backtest-full.js --start 2023-01-01      # shorter period
 *   node tools/test-ab-backtest-full.js --capital 96785         # match Go initial
 *   node tools/test-ab-backtest-full.js --go-signals            # use Go ab-scan-history
 *   node tools/test-ab-backtest-full.js --no-cache              # force Yahoo refetch
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

const INITIAL_CAPITAL = parseFloat(getArg('capital', '96785'));
const START = getArg('start', '2021-01-01');
const END = getArg('end', '2026-04-12');
const QUICK = getArg('quick', '');
const MIN_SCORE = parseFloat(getArg('min-score', '70'));
const MIN_VOL_RATIO = parseFloat(getArg('min-vol-ratio', '8.0'));
const USE_GO_SIGNALS = hasFlag('go-signals');
const VERBOSE = hasFlag('verbose');
const NO_CACHE = hasFlag('no-cache');

const CACHE_DIR = path.join(__dirname, '..', 'cache', 'ab-ohlcv');
const UNIVERSE_FILE = path.join(__dirname, '..', 'data', 'americanbull-universe.json');

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

// ─── OHLCV Cache ──────────────────────────────────────────────────────────

function getCachePath(ticker) {
  return path.join(CACHE_DIR, `${ticker.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`);
}

function loadCached(ticker) {
  if (NO_CACHE) return null;
  try {
    const p = getCachePath(ticker);
    if (!fs.existsSync(p)) return null;
    const stat = fs.statSync(p);
    const ageHours = (Date.now() - stat.mtimeMs) / 3600000;
    if (ageHours > 48) return null; // stale after 48h
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    return data.bars && data.bars.length > 0 ? data.bars : null;
  } catch { return null; }
}

function saveCache(ticker, bars) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(getCachePath(ticker), JSON.stringify({ ticker, fetched: new Date().toISOString(), bars }));
  } catch {}
}

// ─── Yahoo OHLCV fetch (with disk cache) ──────────────────────────────────

function fetchOHLCVFromYahoo(ticker, range = '10y') {
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

async function fetchOHLCV(ticker, range = '10y') {
  const cached = loadCached(ticker);
  if (cached) return cached;
  const bars = await fetchOHLCVFromYahoo(ticker, range);
  if (bars.length > 0) saveCache(ticker, bars);
  return bars;
}

// ─── Signal pre-computation ────────────────────────────────────────────────

function computeJSSignals(ticker, bars, startDate, minScore, minVolRatio, vixByDate) {
  const signals = [];
  const startIdx = bars.findIndex(b => b.date >= startDate);
  if (startIdx < 0) return signals;

  for (let i = Math.max(startIdx, 60); i < bars.length; i++) {
    // Compute regime from VIX for this date (exact Go behavior)
    const date = bars[i].date;
    const vix = vixByDate ? vixByDate.get(date) : null;
    const regime = hasFlag('no-regime') ? null : (vix != null ? getRegime(vix, date) : null);

    const slice = bars.slice(0, i + 1);
    const det = detectPattern(slice, regime);
    if (!det) continue;
    if (minScore > 0 && det.totalScore < minScore) continue;
    if (minVolRatio > 0 && det.volRatio < minVolRatio) continue;
    signals.push({
      date, ticker,
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

// ─── Multi-factor regime model (exact port of Go regime.go) ──────────────

const REGIME_TICKERS = ['^GSPC', 'DX-Y.NYB', 'TLT', 'HYG', 'LQD', 'BTC-USD'];
const REGIME_WEIGHTS = { spx: 0.30, vix: 0.25, dxy: 0.15, tlt: 0.10, credit: 0.15, liquidity: 0.05 };
const VOL_NEUTRAL = 14.0, VOL_RANGE = 10.0;
const VOL_RISK_OFF = 35.0, VOL_EARLY_RO = 30.0, VOL_EXIT_RO = 28.0, VOL_EXIT_EARLY_RO = 25.0;

function clamp(val, lo, hi) { return Math.max(lo, Math.min(hi, val)); }

function regimeCalcEMA(bars, period) {
  if (bars.length < period) return 0;
  const mult = 2.0 / (period + 1);
  let ema = bars[0].close;
  for (let i = 1; i < bars.length; i++) ema = (bars[i].close - ema) * mult + ema;
  return ema;
}

function regimeCalcEMAValues(bars, period) {
  if (bars.length < period) return [];
  const mult = 2.0 / (period + 1);
  const vals = [bars[0].close];
  for (let i = 1; i < bars.length; i++) vals.push((bars[i].close - vals[i - 1]) * mult + vals[i - 1]);
  return vals;
}

function regimeCalcSMA(bars, period) {
  if (bars.length < period) return 0;
  let sum = 0;
  for (let i = bars.length - period; i < bars.length; i++) sum += bars[i].close;
  return sum / period;
}

function regimeCalcLinRegSlope(values) {
  const n = values.length;
  if (n < 2) return 0;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i; sumY += values[i]; sumXY += i * values[i]; sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  let slope = (n * sumXY - sumX * sumY) / denom;
  const avgY = sumY / n;
  if (avgY !== 0) slope /= avgY;
  return slope;
}

function computeSPXScore(bars) {
  if (!bars || bars.length < 50) return { score: 0.5, trend: 1.0 };
  const ema20 = regimeCalcEMA(bars, 20);
  const ema50 = regimeCalcEMA(bars, 50);
  if (ema50 === 0) return { score: 0.5, trend: 1.0 };
  const trend = (ema20 - ema50) / ema50;
  return { score: clamp((trend + 0.02) / 0.04, 0, 1), trend: ema20 / ema50 };
}

function computeVIXScore(bars) {
  if (!bars || bars.length === 0) return { score: 0.5, level: 0, sma14: 0, rising: false };
  const level = bars[bars.length - 1].close;
  let sma14 = 0, rising = false;
  if (bars.length >= 14) {
    sma14 = regimeCalcSMA(bars, 14);
    rising = level > sma14;
  }
  return { score: clamp(1.0 - (level - VOL_NEUTRAL) / VOL_RANGE, 0, 1), level, sma14, rising };
}

function computeDXYScore(bars) {
  if (!bars || bars.length < 20) return { score: 0.5, trend: 0 };
  const sma20 = regimeCalcSMA(bars, 20);
  const current = bars[bars.length - 1].close;
  if (sma20 === 0) return { score: 0.5, trend: 0 };
  const change = (current - sma20) / sma20;
  return { score: clamp(1.0 - change / 0.04, 0, 1), trend: change };
}

function computeTLTScore(bars) {
  if (!bars || bars.length < 30) return { score: 0.5, trend: 0 };
  const ema10Values = regimeCalcEMAValues(bars, 10);
  if (ema10Values.length < 20) return { score: 0.5, trend: 0 };
  const slope = regimeCalcLinRegSlope(ema10Values.slice(-20));
  return { score: clamp((-slope + 0.02) / 0.04, 0, 1), trend: slope };
}

function computeCreditScore(hygBars, lqdBars) {
  if (!hygBars || !lqdBars || hygBars.length < 20 || lqdBars.length < 20) return { score: 0.5, spread: 0 };
  const hygClose = hygBars[hygBars.length - 1].close;
  const lqdClose = lqdBars[lqdBars.length - 1].close;
  if (lqdClose === 0 || hygClose === 0) return { score: 0.5, spread: 0 };
  const currentRatio = hygClose / lqdClose;
  let ratioSum = 0;
  for (let i = 0; i < 20; i++) {
    const hi = hygBars.length - 20 + i, li = lqdBars.length - 20 + i;
    if (hygBars[hi].close > 0 && lqdBars[li].close > 0) ratioSum += hygBars[hi].close / lqdBars[li].close;
  }
  const avgRatio = ratioSum / 20;
  if (avgRatio === 0) return { score: 0.5, spread: 0 };
  const spread = (currentRatio - avgRatio) / avgRatio;
  return { score: clamp((spread + 0.02) / 0.04, 0, 1), spread };
}

function computeLiquidityScore(bars) {
  if (!bars || bars.length < 25) return 0.5;
  const ema10Values = regimeCalcEMAValues(bars, 10);
  const ema20 = regimeCalcEMA(bars, 20);
  if (ema20 === 0 || ema10Values.length < 20) return 0.5;
  const strength = (ema10Values[ema10Values.length - 1] / ema20) - 1.0;
  const slope = regimeCalcLinRegSlope(ema10Values.slice(-20));
  // ATR for normalization
  let trSum = 0, trCount = 0;
  for (let i = bars.length - 14; i < bars.length; i++) {
    if (i < 1) continue;
    const tr = Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - bars[i - 1].close), Math.abs(bars[i].low - bars[i - 1].close));
    trSum += tr; trCount++;
  }
  const atr = trCount > 0 ? trSum / trCount : 0.01;
  const raw = ((slope + strength) / (atr + 1e-6) + 0.05) / 0.10;
  return clamp(raw, 0, 1);
}

function classifyRegime(score, vixScore, vixLevel, prevRegime) {
  // VIX override with hysteresis
  if (prevRegime === 'risk_off') {
    if (vixLevel > VOL_EXIT_RO) return 'risk_off';
  } else {
    if (vixLevel > VOL_RISK_OFF) return 'risk_off';
  }
  if (vixLevel > VOL_EARLY_RO) {
    if (prevRegime === 'early_risk_off' || prevRegime === 'risk_off') return 'early_risk_off';
    if (score > 0.40) return 'early_risk_off';
  } else if (vixLevel > VOL_EXIT_EARLY_RO && prevRegime === 'early_risk_off') {
    if (score >= 0.35) return 'early_risk_off';
  }
  if (score >= 0.40 && score < 0.60 && vixScore < 0.3) return 'early_risk_off';

  const buffer = 0.05;
  switch (prevRegime) {
    case 'risk_on': if (score > 0.75 - buffer) return 'risk_on'; break;
    case 'recovery': if (score > 0.75) return 'risk_on'; if (score >= 0.60 - buffer) return 'recovery'; break;
    case 'neutral': if (score >= 0.60) return 'recovery'; if (score >= 0.40 - buffer) return 'neutral'; break;
    case 'early_risk_off': if (score >= 0.40) return 'neutral'; if (score >= 0.25 - buffer) return 'early_risk_off'; break;
    case 'risk_off': if (score >= 0.25) return 'early_risk_off'; return 'risk_off';
  }

  if (score > 0.75) return 'risk_on';
  if (score >= 0.60) return 'recovery';
  if (score >= 0.40) return 'neutral';
  if (score >= 0.25) return 'early_risk_off';
  return 'risk_off';
}

// State for multi-factor regime (needs history up to current date)
let regimeDataMap = null; // Will be populated by buildRegimeDataMap()
let prevRegimeState = 'neutral';

function buildRegimeDataMap(spxBars, vixBars, dxyBars, tltBars, hygBars, lqdBars, btcBars) {
  regimeDataMap = new Map();
  prevRegimeState = 'neutral';

  // Build date-indexed slices for each ticker
  const allDates = new Set();
  for (const bars of [spxBars, vixBars, dxyBars, tltBars, hygBars, lqdBars, btcBars]) {
    if (bars) for (const b of bars) allDates.add(b.date);
  }
  const sortedDates = [...allDates].sort();

  // Build cumulative bar index for each ticker
  const idxOf = (bars) => { const m = new Map(); if (bars) bars.forEach((b, i) => m.set(b.date, i)); return m; };
  const spxIdx = idxOf(spxBars), vixIdx = idxOf(vixBars), dxyIdx = idxOf(dxyBars);
  const tltIdx = idxOf(tltBars), hygIdx = idxOf(hygBars), lqdIdx = idxOf(lqdBars), btcIdx = idxOf(btcBars);

  const sliceTo = (bars, idx, date) => {
    const i = idx.get(date);
    if (i == null) return null;
    return bars.slice(0, i + 1);
  };

  for (const date of sortedDates) {
    const spxSlice = sliceTo(spxBars, spxIdx, date);
    const vixSlice = sliceTo(vixBars, vixIdx, date);
    const dxySlice = sliceTo(dxyBars, dxyIdx, date);
    const tltSlice = sliceTo(tltBars, tltIdx, date);
    const hygSlice = sliceTo(hygBars, hygIdx, date);
    const lqdSlice = sliceTo(lqdBars, lqdIdx, date);
    const btcSlice = sliceTo(btcBars, btcIdx, date);

    if (!vixSlice || vixSlice.length === 0) continue;

    const spx = computeSPXScore(spxSlice);
    const vix = computeVIXScore(vixSlice);
    const dxy = computeDXYScore(dxySlice);
    const tlt = computeTLTScore(tltSlice);
    const credit = computeCreditScore(hygSlice, lqdSlice);
    const liquidity = computeLiquidityScore(btcSlice);

    let totalWeight = REGIME_WEIGHTS.spx + REGIME_WEIGHTS.vix + REGIME_WEIGHTS.dxy + REGIME_WEIGHTS.tlt + REGIME_WEIGHTS.credit;
    let weightedScore = REGIME_WEIGHTS.spx * spx.score + REGIME_WEIGHTS.vix * vix.score +
      REGIME_WEIGHTS.dxy * dxy.score + REGIME_WEIGHTS.tlt * tlt.score + REGIME_WEIGHTS.credit * credit.score;
    if (liquidity !== 0.5) {
      totalWeight += REGIME_WEIGHTS.liquidity;
      weightedScore += REGIME_WEIGHTS.liquidity * liquidity;
    }
    const regimeScore = totalWeight > 0 ? clamp(weightedScore / totalWeight, 0, 1) : 0.5;
    const regime = classifyRegime(regimeScore, vix.score, vix.level, prevRegimeState);
    prevRegimeState = regime;

    regimeDataMap.set(date, { regime, score: regimeScore, vixLevel: vix.level, vixRising: vix.rising });
  }
}

function getRegime(vixClose, date) {
  // If multi-factor regime is available, use it
  if (regimeDataMap && date) {
    const rd = regimeDataMap.get(date);
    if (rd) return rd.regime;
  }
  // Fallback: simple VIX thresholds (same as Go's VIX override thresholds)
  if (vixClose > VOL_RISK_OFF) return 'risk_off';
  if (vixClose > VOL_EARLY_RO) return 'early_risk_off';
  if (vixClose < 15) return 'risk_on';
  return 'neutral';
}

function getRegimeVixRising(date) {
  if (regimeDataMap && date) {
    const rd = regimeDataMap.get(date);
    if (rd) return rd.vixRising;
  }
  return false;
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
  // ── Phase 1: Select universe ────────────────────────────────────────────
  let tickers;
  const customTickers = getArg('tickers', '');
  if (customTickers) {
    tickers = customTickers.split(',').filter(Boolean);
  } else if (QUICK) {
    // Quick mode: use TOP_UNIVERSE subset
    const quickN = parseInt(QUICK) || 300;
    tickers = TOP_UNIVERSE.slice(0, quickN);
  } else {
    // Default: FULL universe from americanbull-universe.json (same as Go)
    try {
      const uniData = JSON.parse(fs.readFileSync(UNIVERSE_FILE, 'utf8'));
      tickers = uniData.tickers || [];
    } catch (e) {
      console.error(`  Cannot load ${UNIVERSE_FILE}: ${e.message}`);
      console.error('  Falling back to TOP_UNIVERSE (300 tickers)');
      tickers = TOP_UNIVERSE.slice();
    }
  }

  // Count cached tickers
  let cachedCount = 0;
  if (!NO_CACHE) {
    try {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      for (const t of tickers) {
        if (fs.existsSync(getCachePath(t))) cachedCount++;
      }
    } catch {}
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  AmericanBulls Full Portfolio Backtest Engine');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Capital: $${INITIAL_CAPITAL.toLocaleString()} | Start: ${START}`);
  console.log(`  Universe: ${tickers.length} tickers | Min score: ${MIN_SCORE} | Min vol ratio: ${MIN_VOL_RATIO}`);
  console.log(`  Cache: ${cachedCount}/${tickers.length} cached (${NO_CACHE ? 'disabled' : 'cache/ab-ohlcv/'})`);
  console.log(`  Signal source: ${USE_GO_SIGNALS ? 'Go ab-scan-history' : 'JS scanner'}`);
  console.log(`  Go ref: 1042 trades, WR 48.85%, CAGR 411.86%, DD 27.45%`);
  console.log('───────────────────────────────────────────────────────────\n');

  console.log(`[1/4] Fetching OHLCV for ${tickers.length} tickers + VIX + regime tickers...`);

  // Fetch VIX + regime tickers
  const regimeTickerNames = ['^VIX', '^GSPC', 'DX-Y.NYB', 'TLT', 'HYG', 'LQD', 'BTC-USD'];
  const regimeTickerBars = {};
  for (const t of regimeTickerNames) {
    const bars = await fetchOHLCV(t, '10y');
    regimeTickerBars[t] = bars;
    console.log(`  Regime ticker ${t}: ${bars.length} bars`);
  }
  const vixBars = regimeTickerBars['^VIX'];
  if (vixBars.length < 100) {
    console.error('  Failed to fetch VIX data. Aborting.');
    process.exit(1);
  }
  const vixByDate = new Map(vixBars.map(b => [b.date, b.close]));

  // Build multi-factor regime map
  if (!hasFlag('no-regime')) {
    console.log('  Building multi-factor regime model...');
    buildRegimeDataMap(
      regimeTickerBars['^GSPC'], vixBars, regimeTickerBars['DX-Y.NYB'],
      regimeTickerBars['TLT'], regimeTickerBars['HYG'], regimeTickerBars['LQD'],
      regimeTickerBars['BTC-USD']
    );
    // Log regime distribution
    const regimeCounts = {};
    for (const [, rd] of regimeDataMap) {
      regimeCounts[rd.regime] = (regimeCounts[rd.regime] || 0) + 1;
    }
    console.log(`  Regime map: ${regimeDataMap.size} days — ${JSON.stringify(regimeCounts)}`);
  }

  // Fetch OHLCV in parallel batches (with disk cache)
  const priceData = new Map(); // ticker → bars[]
  const batchSize = 30;
  let fetched = 0, cacheHits = 0, yahooFetches = 0;
  const fetchStart = Date.now();
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    let batchYahoo = 0;
    const results = await Promise.all(batch.map(async t => {
      const cached = loadCached(t);
      if (cached) { cacheHits++; return [t, cached]; }
      batchYahoo++;
      const bars = await fetchOHLCVFromYahoo(t, '10y');
      if (bars.length > 0) { saveCache(t, bars); yahooFetches++; }
      return [t, bars];
    }));
    for (const [t, bars] of results) {
      if (bars.length >= 100) priceData.set(t, bars);
    }
    fetched += batch.length;
    const elapsed = ((Date.now() - fetchStart) / 1000).toFixed(0);
    process.stderr.write(`  ${fetched}/${tickers.length} (${priceData.size} ok, ${cacheHits} cached, ${yahooFetches} fetched) ${elapsed}s\r`);
    if (batchYahoo > 0 && i + batchSize < tickers.length) {
      await new Promise(r => setTimeout(r, 150));
    }
  }
  const totalElapsed = ((Date.now() - fetchStart) / 1000).toFixed(1);
  console.log(`  Loaded: ${priceData.size}/${tickers.length} tickers, VIX: ${vixBars.length} bars`);
  console.log(`  Cache: ${cacheHits} hits, ${yahooFetches} Yahoo fetches (${totalElapsed}s)\n`);

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
      const signals = computeJSSignals(ticker, bars, START, MIN_SCORE, MIN_VOL_RATIO, vixByDate);
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
        if (VERBOSE && dayIdx < 60) console.error(`    FILL BUY ${buy.symbol} ${actualQty}sh @${fillPrice.toFixed(2)} cost=$${Math.round(cost)} soft=${softStop.toFixed(2)} hard=${Math.max(hardStop,0).toFixed(2)}`);
      } else {
        newPendingBuys.push(buy);
      }
    }
    pendingBuys = newPendingBuys;

    // ── Step 2: PM decisions using today's close ─────────────────────

    const vixClose = vixByDate.get(date) || prevVix;
    const vixRising = regimeDataMap ? getRegimeVixRising(date) : (vixClose > prevVix);
    prevVix = vixClose;
    const regime = getRegime(vixClose, date);

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
    const useRegime = hasFlag('no-regime') ? null : regime;
    const config = resolveConfig(DEFAULT_CONFIG, currentMode, useRegime, vixRising);

    // Go uses piecewise linear interpolation for maxLoss based on regime score (0-1)
    // Anchors: [0.0=risk_off, 0.25=early_risk_off, 0.50=neutral, 0.67=recovery, 1.0=risk_on]
    if (regimeDataMap && !hasFlag('no-regime')) {
      const rd = regimeDataMap.get(date);
      if (rd) {
        const dml = DEFAULT_CONFIG.dynamicMaxLoss;
        const anchors = [0.0, 0.25, 0.50, 0.67, 1.0];
        let vals;
        if (vixRising) {
          vals = [dml.risk_off || 0.04, dml.early_risk_off || 0.05, dml.neutral_vix_rising || 0.075,
                  dml.recovery_vix_rising || 0.075, dml.risk_on_vix_rising || 0.075];
        } else {
          vals = [dml.risk_off || 0.04, dml.early_risk_off || 0.05, dml.neutral || 0.07,
                  dml.recovery || 0.07, dml.risk_on || 0.07];
        }
        const s = rd.score;
        let maxLossInterp = vals[vals.length - 1];
        if (s <= anchors[0]) maxLossInterp = vals[0];
        else if (s >= anchors[anchors.length - 1]) maxLossInterp = vals[vals.length - 1];
        else {
          for (let i = 1; i < anchors.length; i++) {
            if (s <= anchors[i]) {
              const t = (s - anchors[i - 1]) / (anchors[i] - anchors[i - 1]);
              maxLossInterp = vals[i - 1] + t * (vals[i] - vals[i - 1]);
              break;
            }
          }
        }
        config.maxLossPct = maxLossInterp;
      }
    }

    // J+1 fix: recalculate softStop daily based on current ATR and regime maxLoss (Go's CheckStandardExits behavior)
    for (const pos of positions) {
      const bars = priceData.get(pos.symbol);
      const bidx = getBarIdx(pos.symbol, date);
      if (!bars || bidx == null || bidx < 15) continue;
      // Compute current ATR
      let atrSum = 0, atrN = 0;
      for (let k = bidx - 13; k <= bidx; k++) {
        if (k < 1) continue;
        const tr = Math.max(bars[k].high - bars[k].low, Math.abs(bars[k].high - bars[k - 1].close), Math.abs(bars[k].low - bars[k - 1].close));
        atrSum += tr; atrN++;
      }
      const atr = atrN > 0 ? atrSum / atrN : pos.entry * 0.03;
      const baseStopATR = config.baseStopATR || 1.5;
      let idealStop = pos.entry - atr * baseStopATR;
      if (config.maxLossPct > 0) {
        const minStop = pos.entry * (1 - config.maxLossPct);
        if (idealStop < minStop) idealStop = minStop;
      }
      if (pos.softStop > 0 && pos.softStop < idealStop * 0.99) {
        pos.softStop = idealStop;
      }
      // syncStopOrders: ALWAYS recalculate hardStop from current mode's safetyMult (Go does this every day)
      if (pos.softStop > 0 && pos.entry > pos.softStop) {
        const dist = pos.entry - pos.softStop;
        const mult = config.safetyStopMult || 3.0;
        pos.hardStop = Math.max(pos.entry - dist * mult, 0);
      }
    }

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
        if (VERBOSE && dayIdx < 60) console.error(`    EXIT ${pos.symbol} reason=${exitReason} pnl=${(pnlPct*100).toFixed(1)}% days=${daysHeld} maxLoss=${(config.maxLossPct*100).toFixed(1)}% tp=${config.takeProfitPct}`);
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

      // Go: availableCash = cash - (totalEquity * minCashReserve/100) - pendingBuyCashLocked
      // Note: In JS, cash is already reduced by pending buys. Go's broker also deducts cash
      // for pending buys, so pendingBuyCashLocked may double-count. Match Go exactly.
      const minCashReserve = config.minCashReserve || 2.0;
      const availableCash = cash - (equity * minCashReserve / 100);
      let posSize = availableCash > 0 ? availableCash / slotsAvailable : 0;
      // Go AmericanBulls PM: positionSize = availableCash/slotsAvailable (no PositionSizePct cap)
      // Only MaxPositionValue cap applies (not configured in AB YAML)
      if (posSize > availableCash * 0.98) posSize = availableCash * 0.98;

      for (const candidate of candidates) {
        if (entered >= slotsAvailable) break;
        if (heldOrPending.has(candidate.ticker)) continue;

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

    // Verbose debug for first N days
    if (VERBOSE && dayIdx < 30) {
      const posStr = positions.map(p => `${p.symbol}@${p.entry.toFixed(2)}`).join(', ');
      const pendStr = pendingBuys.map(p => `${p.symbol}@${p.limitPrice.toFixed(2)}`).join(', ');
      console.error(`  D${dayIdx} ${date} | Eq=$${Math.round(finalEquity)} Mode=${currentMode} Cash=$${Math.round(cash)} | Pos[${positions.length}]: ${posStr} | Pend[${pendingBuys.length}]: ${pendStr} | Regime=${regime} VIX=${vixClose.toFixed(1)} | Trades=${closedTrades.length}`);
    }

    // Progress
    if ((!VERBOSE || dayIdx >= 30) && (dayIdx % 100 === 0 || dayIdx === tradingDates.length - 1)) {
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
