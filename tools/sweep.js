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
const FULL_SWEEP = process.argv.includes('--full-sweep');
const FROZEN_ONLY = !FULL_SWEEP;
const SHARIA = process.argv.includes('--sharia');
const FROM_ARG = process.argv.find(a => a.startsWith('--from='));
const FROM_DATE = FROM_ARG ? FROM_ARG.split('=')[1] : null;

// FALLBACK Sharia exclusion list — used ONLY for old scans that don't have data-sharia attributes.
// New scans have data-sharia="true/false" on each <tr> in the synthese table (evaluated at generation
// time using real financial ratios per scanner/CLAUDE.md "Sharia Compliance Tagging" section).
const SHARIA_EXCLUDED = new Set([
  // Banks & financial services (interest-based revenue / riba)
  'JPM','BAC','GS','MS','C','WFC','USB','PNC','TFC','SCHW','BK','STT','AIG','MET','PRU',
  'BBVA','BNP','HSBC','DB','UBS','CS','ING','SAN','BNPQY','RY','TD','BMO','XLF',
  // Insurance (conventional, non-takaful)
  'UNH','CI','HUM','ELV','ALL','PGR','TRV','AFL','MCK','XLV',
  // Defense & weapons
  'LMT','RTX','NOC','GD','BA','HII','LHX','LDOS','HEI','TXT','KTOS','ITA',
  // Alcohol, tobacco, gambling
  'BUD','DEO','STZ','SAM','TAP','PM','MO','BTI','DKNG','MGM','WYNN','LVS','CZR','GENI',
  // Bond/Treasury ETFs (interest-based instruments)
  'TLT','TBT','SHY','IEF','AGG','BND','GOVT','BNDX','HYG','LQD','JNK','MUB',
  // Leveraged & inverse ETFs (gharar — excessive uncertainty)
  'TQQQ','SQQQ','SPXU','UPRO','LABU','LABD','UVXY','SVXY','SOXL','SOXS','FAS','FAZ',
  'SH','SDS','QID','PSQ',
]);

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

// ─── Parse scan → setups (JSON-first, HTML fallback via scanner-parser.js) ───

const scannerParser = require('./lib/scanner-parser');

const STRAT_PATTERNS = {
  short_squeeze: /short.?squeeze/i,
  pre_squeeze: /pre.?squeeze/i,
  breakout: /breakout/i,
  momentum: /momentum/i,
  pullback: /pullback/i,
};

function detectStrategy(text) {
  for (const [k, re] of Object.entries(STRAT_PATTERNS)) {
    if (re.test(text)) return k;
  }
  return 'momentum';
}

function parseScan(dir) {
  const dm = dir.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!dm) return null;
  const scanDate = `${dm[1]}-${dm[2]}-${dm[3]}`;

  const loaded = scannerParser.loadSignals(dir);
  if (!loaded || !loaded.signals.length) return null;

  const setups = [];
  for (const s of loaded.signals) {
    const { entry, stop, tp1, tp2 } = s;
    if (!entry || !stop || !tp1 || entry <= 0 || stop <= 0) continue;
    if (stop >= entry) continue;
    if (tp1 <= entry) continue;
    setups.push({
      ticker: s.ticker,
      strategy: detectStrategy(s.strategy || ''),
      score: s.score || 80,
      entry, stop, tp1, tp2,
      sharia: s.sharia,
    });
  }

  const seen = new Set();
  return {
    dir, scanDate,
    regime: loaded.regime || null,
    setups: setups.filter(s => {
      if (seen.has(s.ticker)) return false;
      seen.add(s.ticker);
      return true;
    }).sort((a, b) => b.score - a.score),
  };
}

// VIX/regime-based sizing multiplier (risk-off halves exposure)
function regimeSizeMultiplier(regime) {
  if (!regime) return 1;
  const r = String(regime).toUpperCase();
  if (r === 'RISK-OFF') return 0.5;          // halve exposure in risk-off
  if (r === 'EARLY RISK-OFF') return 0.75;   // ¾ exposure in early risk-off
  return 1;
}

// Sector lookup — embedded GICS-ish map for the scanner universe.
// Unknown tickers fall back to 'Other' (cap still enforced for the bucket).
const SECTOR_MAP = {
  // Tech
  'AAPL':'Tech','MSFT':'Tech','GOOGL':'Tech','GOOG':'Tech','META':'Tech','NFLX':'Tech',
  'CRM':'Tech','ORCL':'Tech','ADBE':'Tech','NOW':'Tech','INTU':'Tech','PANW':'Tech',
  'FTNT':'Tech','CRWD':'Tech','ZS':'Tech','SNOW':'Tech','PLTR':'Tech','DDOG':'Tech',
  'NET':'Tech','OKTA':'Tech','TEAM':'Tech','SHOP':'Tech','SQ':'Tech','PYPL':'Tech',
  // Semis
  'NVDA':'Semis','AMD':'Semis','AVGO':'Semis','TSM':'Semis','INTC':'Semis','MU':'Semis',
  'QCOM':'Semis','MRVL':'Semis','LRCX':'Semis','AMAT':'Semis','KLAC':'Semis','ASML':'Semis',
  'ARM':'Semis','SMCI':'Semis','ON':'Semis','ADI':'Semis','TXN':'Semis',
  // Consumer
  'AMZN':'Consumer','TSLA':'Consumer','HD':'Consumer','MCD':'Consumer','NKE':'Consumer',
  'SBUX':'Consumer','TGT':'Consumer','WMT':'Consumer','COST':'Consumer','LULU':'Consumer',
  'ABNB':'Consumer','UBER':'Consumer','LYFT':'Consumer','DASH':'Consumer','BKNG':'Consumer',
  // Health
  'UNH':'Health','LLY':'Health','PFE':'Health','MRK':'Health','ABBV':'Health','JNJ':'Health',
  'TMO':'Health','DHR':'Health','BMY':'Health','GILD':'Health','REGN':'Health','VRTX':'Health',
  'MRNA':'Health','BIIB':'Health','SRPT':'Health','AMGN':'Health',
  // Finance
  'JPM':'Finance','BAC':'Finance','WFC':'Finance','GS':'Finance','MS':'Finance','C':'Finance',
  'V':'Finance','MA':'Finance','BLK':'Finance','SCHW':'Finance','AXP':'Finance','COF':'Finance',
  'BRK-B':'Finance','BRK.B':'Finance',
  // Energy
  'XOM':'Energy','CVX':'Energy','COP':'Energy','OXY':'Energy','EOG':'Energy','SLB':'Energy',
  'PSX':'Energy','MPC':'Energy','VLO':'Energy','HAL':'Energy','BKR':'Energy','BTU':'Energy',
  // Industrials
  'CAT':'Industrials','BA':'Industrials','HON':'Industrials','UPS':'Industrials','UNP':'Industrials',
  'GE':'Industrials','DE':'Industrials','MMM':'Industrials','LMT':'Industrials','RTX':'Industrials',
  'NOC':'Industrials','GD':'Industrials','IOT':'Industrials',
  // Materials
  'FCX':'Materials','NEM':'Materials','GOLD':'Materials','MOS':'Materials','CF':'Materials',
  'NUE':'Materials','LIN':'Materials','APD':'Materials','SHW':'Materials',
  // Comms
  'DIS':'Comms','CMCSA':'Comms','T':'Comms','VZ':'Comms','TMUS':'Comms','CHTR':'Comms',
  // Crypto
  'BTC-USD':'Crypto','ETH-USD':'Crypto','SOL-USD':'Crypto','XRP-USD':'Crypto','COIN':'Crypto',
  'MSTR':'Crypto','MARA':'Crypto','RIOT':'Crypto','HUT':'Crypto','CLSK':'Crypto',
  // Broad ETFs
  'SPY':'ETF-Broad','QQQ':'ETF-Broad','DIA':'ETF-Broad','IWM':'ETF-Broad','EFA':'ETF-Broad',
  'EEM':'ETF-Broad','FXI':'ETF-Broad','VTI':'ETF-Broad','VOO':'ETF-Broad',
  'XLF':'ETF-Sector','XLK':'ETF-Sector','XLV':'ETF-Sector','XLE':'ETF-Sector','XLI':'ETF-Sector',
  'XLY':'ETF-Sector','XLP':'ETF-Sector','XLU':'ETF-Sector','XLB':'ETF-Sector','XLRE':'ETF-Sector',
  'XLC':'ETF-Sector','SMH':'ETF-Sector','SOXX':'ETF-Sector','XBI':'ETF-Sector','ITA':'ETF-Sector','ANET':'Tech',
  'GLD':'ETF-Commodity','SLV':'ETF-Commodity','USO':'ETF-Commodity','TLT':'ETF-Bond',
};

function getSector(ticker) {
  if (!ticker) return 'Other';
  return SECTOR_MAP[ticker] || SECTOR_MAP[String(ticker).toUpperCase()] || 'Other';
}

// VIX kill switch — backtest doesn't carry VIX numerics, so map regime label
// to approximate VIX band per CLAUDE.md convention.
function vixKillTriggered(regime, threshold) {
  if (!threshold) return false;
  if (!regime) return false;
  const r = String(regime).toUpperCase().trim();
  const regimeVix = (
    r === 'RISK-OFF' ? 32 :
    (r === 'EARLY RISK-OFF' || r === 'EARLY-RISK-OFF') ? 24 :
    r === 'NEUTRAL' ? 18 :
    r === 'RISK-ON' ? 13 :
    18
  );
  return regimeVix >= threshold;
}

// Pairwise correlation helpers — used by correlationCap gate.
function _logReturns(history, datesSorted) {
  const r = [];
  let prev = null;
  for (const d of datesSorted) {
    const bar = history[d];
    if (!bar || !(bar.close > 0)) continue;
    if (prev != null && prev > 0) r.push(Math.log(bar.close / prev));
    prev = bar.close;
  }
  return r;
}
function _pearson(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 10) return null;
  const ax = a.slice(-n), bx = b.slice(-n);
  let mA = 0, mB = 0;
  for (let i = 0; i < n; i++) { mA += ax[i]; mB += bx[i]; }
  mA /= n; mB /= n;
  let num = 0, dA = 0, dB = 0;
  for (let i = 0; i < n; i++) {
    const da = ax[i] - mA, db = bx[i] - mB;
    num += da * db; dA += da * da; dB += db * db;
  }
  if (dA <= 0 || dB <= 0) return null;
  return num / Math.sqrt(dA * dB);
}
// Compute max |correlation| of candidate vs each open position (60-day log returns).
// Returns null when not computable. Uses module-scope priceCache.
function maxCorrToOpen(cand, openPositions, lookbackDays) {
  const candHist = priceCache[cand.ticker];
  if (!candHist || openPositions.length === 0) return null;
  const allDates = Object.keys(candHist).sort();
  const window = allDates.slice(-Math.max(lookbackDays + 1, 20));
  const candRet = _logReturns(candHist, window);
  if (candRet.length < 10) return null;
  let maxAbs = 0, signed = 0;
  for (const pos of openPositions) {
    const posHist = priceCache[pos.trade.ticker];
    if (!posHist) continue;
    const posRet = _logReturns(posHist, window);
    const rho = _pearson(candRet, posRet);
    if (rho != null && Math.abs(rho) > Math.abs(maxAbs)) { maxAbs = rho; signed = rho; }
  }
  return signed;
}

// Module-scope strategy filter map (used by regime-aware filtering and grid search)
const STRATEGY_FILTERS_MAP = {
  'all': new Set(),
  'no_sq': new Set(['short_squeeze']),
  'no_sq_pb': new Set(['short_squeeze', 'pullback']),
  'momentum_only': new Set(['short_squeeze', 'pre_squeeze', 'breakout', 'pullback']),
  'breakout_only': new Set(['short_squeeze', 'pre_squeeze', 'momentum', 'pullback']),
  'mom_bo': new Set(['short_squeeze', 'pre_squeeze', 'pullback']),
};

// Normalize regime string to lookup key
function normalizeRegime(regime) {
  if (!regime) return '';
  return String(regime).toLowerCase().replace(/[\s-]+/g, '_');
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
    entryGatePct = 0, // reject if open > entry * (1 + X%) — 0 = disabled
    vwapGate = false, // skip trade if open gaps above VWAP * 1.01 (gap-up trap filter)
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

  // Entry gate: reject if open gaps too far above target entry (cascade to next candidate)
  if (entryGatePct > 0 && actualEntry > setup.entry * (1 + entryGatePct / 100)) return null;

  // VWAP entry gate: skip if open gaps above reference price (gap-up trap filter).
  //
  // ⚠️ NO LOOKAHEAD: we use the previous day's typical price ((H+L+C)/3) as the
  // pre-market reference. The original implementation used the entry bar's own
  // close — which is unknown at the open and constituted lookahead bias.
  // Same convention as gen-status-page.js ("previous day typical price").
  // If no prevBar exists (first scan day, gap in cache) → skip the gate entirely
  // and return a normal trade (do not reject).
  let entryPrice = actualEntry; // default: market open
  let vwapRef = null;
  const allDates = Object.keys(priceHistory).sort();
  const entryIdx = allDates.indexOf(entryDate);
  const prevBar = entryIdx > 0 ? priceHistory[allDates[entryIdx - 1]] : null;
  if (prevBar && prevBar.high && prevBar.low && prevBar.close) {
    vwapRef = (prevBar.high + prevBar.low + prevBar.close) / 3;
  }
  if (vwapGate && vwapRef !== null) {
    if (actualEntry > vwapRef * 1.01) return null; // gap-up trap — skip
    entryPrice = Math.min(actualEntry, vwapRef);
  }

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
    const maxRisk = entryPrice * (effectiveMaxStop / 100);
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

  const actualStop = entryPrice - riskPerUnit;
  const rewardMult1 = (setup.tp1 - setup.entry) / riskPerUnit;
  const actualTp1 = entryPrice + riskPerUnit * rewardMult1;
  const rewardMult2 = setup.tp2 ? (setup.tp2 - setup.entry) / riskPerUnit : rewardMult1 * 1.5;
  const actualTp2 = entryPrice + riskPerUnit * rewardMult2;

  // R:R gate: reject trades with reward/risk below 1.5
  const rrRatio = (actualTp1 - entryPrice) / riskPerUnit;
  if (rrRatio < 1.5) return null;

  const expireDate = addBizDays(scanDate, horizonDays);
  const sortedDates = Object.keys(priceHistory)
    .filter(d => d >= entryDate && d <= expireDate).sort();

  let currentStop = actualStop;
  let status = 'open';
  let exitDate = null;
  let exitPrice = null;
  let partialRealized = 0; // P&L from partial close at TP1
  let highWaterMark = entryPrice;
  let daysSinceNewHigh = 0;
  let breakevenActivated = false;

  for (const date of sortedDates) {
    const bar = priceHistory[date];
    if (!bar) continue;

    // Check SL first — distinguish initial stop vs breakeven vs trailing
    if (bar.low <= currentStop) {
      // Ambiguous-bar: same bar hit SL AND TP → first-touch policy picks SL (conservative for loss, but tag it)
      const ambiguous = (bar.high >= actualTp1) || (actualTp2 && bar.high >= actualTp2);
      if (partialRealized > 0) status = 'tp1_partial';
      else if (currentStop > entryPrice) status = 'trail';       // stop moved above entry → positive exit
      else if (currentStop >= entryPrice) status = 'breakeven';  // stop moved to entry → 0 exit
      else status = 'sl';                                         // original stop hit → loss
      exitDate = date;
      exitPrice = currentStop;
      if (ambiguous) status = status + '_amb';                    // _amb suffix for audit
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
        partialRealized = ((actualTp1 - entryPrice) / entryPrice) * tpFrac;
        if (trailingStop) {
          currentStop = entryPrice; // Move stop to breakeven
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
      const currentGain = (bar.high - entryPrice) / entryPrice * 100;
      if (currentGain >= breakevenPct) {
        breakevenActivated = true;
        if (entryPrice > currentStop) currentStop = entryPrice;
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
        const staleRaise = (daysSinceNewHigh - staleDays + 1) * 0.002 * entryPrice; // 0.2% per day
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
    vwap: vwapRef ? +vwapRef.toFixed(4) : null, // previous day typical price (no-lookahead reference)
    status,
    exitDate,
    exitPrice,
    pnlPct: +(pnlPct * 100).toFixed(2),
    holdDays: sortedDates.indexOf(exitDate) + 1,
  };
}

// ─── Stats from a flat closed-trade list (append-only mode) ──────────────────
// Computes returnTotal, maxDD, winRate, profitFactor, equityCurve from a
// pre-existing list of closed trades without re-running portfolio simulation.
// Trades must have: pnlPct, exitDate, scanDate, status, holdDays.
// Uses configVersion on each trade to look up the correct weight from config history.
function computeStatsFromTrades(closedTrades, portfolioSize, positionSizePct, modeId) {
  if (!closedTrades || closedTrades.length === 0) return null;
  const defaultWeight = (1 / portfolioSize) * (positionSizePct || 1);

  // Load config history for per-trade weight lookup
  const cfgHistPath = path.join(ROOT, 'data', 'modes-config-history.json');
  let cfgVersions = {};
  if (fs.existsSync(cfgHistPath)) {
    try {
      const hist = JSON.parse(fs.readFileSync(cfgHistPath, 'utf8'));
      for (const v of (hist.versions || [])) {
        cfgVersions[v.id] = v.config;
      }
    } catch(e) {}
  }

  function getWeight(trade, modeId) {
    const ver = trade.configVersion;
    if (ver && cfgVersions[ver] && cfgVersions[ver][modeId]) {
      const c = cfgVersions[ver][modeId];
      return (1 / (c.portfolioSize || 1)) * (c.positionSizePct || 1);
    }
    return defaultWeight;
  }

  const RESOLVED_STATUSES = ['tp1', 'tp1_partial', 'tp2', 'sl', 'expired', 'rotated', 'breakeven', 'trail'];
  const resolved = closedTrades.filter(t => {
    const base = (t.status || '').replace(/_amb$/, '');
    return RESOLVED_STATUSES.includes(base);
  });
  if (resolved.length === 0) return null;

  // Build a simple equity curve: accumulate realized P&L in exit-date order
  const sorted = [...resolved].sort((a, b) => (a.exitDate || '').localeCompare(b.exitDate || ''));
  let equity = 100;
  let peak = 100;
  let maxDD = 0;
  const equityCurve = [{ date: sorted[0].scanDate || sorted[0].exitDate, value: 100 }];
  for (const t of sorted) {
    equity += (t.pnlPct || 0) * getWeight(t, modeId || '');
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDD) maxDD = dd;
    equityCurve.push({ date: t.exitDate || t.scanDate, value: +equity.toFixed(2) });
  }

  const returnTotal = +(equity - 100).toFixed(2);
  const wins = resolved.filter(t => (t.pnlPct || 0) > 0);
  const losses = resolved.filter(t => (t.pnlPct || 0) <= 0);
  const winRate = resolved.length ? +((wins.length / resolved.length) * 100).toFixed(1) : 0;
  const grossWin = wins.reduce((s, t) => s + t.pnlPct, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));
  const profitFactor = grossLoss > 0 ? +(grossWin / grossLoss).toFixed(2) : grossWin > 0 ? 99 : 0;

  // Risk-adjusted return metrics
  // returnDDRatio = legacy field (was misnamed "sharpe"); kept for backward compat.
  const returnDDRatio = maxDD > 0 ? +(returnTotal / maxDD).toFixed(2) : returnTotal > 0 ? 99 : 0;

  // True Sharpe ratio: sqrt(252) * mean(daily_returns) / std(daily_returns)
  // Uses log returns on the equity curve for robustness.
  let sharpe = 0;
  if (equityCurve.length > 2) {
    const dailyReturns = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const prev = equityCurve[i - 1].value;
      const curr = equityCurve[i].value;
      if (prev > 0) dailyReturns.push((curr - prev) / prev);
    }
    if (dailyReturns.length > 1) {
      const mean = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
      const variance = dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (dailyReturns.length - 1);
      const stdev = Math.sqrt(variance);
      if (stdev > 0) sharpe = +(Math.sqrt(252) * mean / stdev).toFixed(2);
    }
  }

  const firstDate = sorted[0]?.exitDate || sorted[0]?.scanDate;
  const lastDate = sorted[sorted.length - 1]?.exitDate || firstDate;
  let dayCount = 1;
  if (firstDate && lastDate) {
    const ms = new Date(lastDate).getTime() - new Date(firstDate).getTime();
    dayCount = Math.max(1, Math.round(ms / 86400000));
  }
  const annReturn = returnTotal * (252 / dayCount);
  const calmar = maxDD > 0 ? +(annReturn / maxDD).toFixed(2) : 0;

  return {
    returnTotal,
    maxDD: +(-maxDD).toFixed(2),
    winRate,
    profitFactor,
    trades: resolved.length,
    calmar,
    sharpe,             // TRUE Sharpe: sqrt(252) * mean(daily_returns) / std(daily_returns)
    returnDDRatio,      // legacy "sharpe" alias: returnTotal / |maxDD|
    equityCurve,
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

  // Group trades by scan date; capture per-date regime as canonical source-of-truth
  // Strategy filter is deferred to per-date level for regime-aware filter switching
  const byDate = {};
  const regimeByDate = {};
  for (const t of allTrades) {
    if (t.score < minScore) continue;
    if (!byDate[t.scanDate]) byDate[t.scanDate] = [];
    byDate[t.scanDate].push(t);
    if (t.regime && !regimeByDate[t.scanDate]) regimeByDate[t.scanDate] = t.regime;
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
  const positionSizePct = config.positionSizePct || 1;
  const weight = (1 / portfolioSize) * positionSizePct;
  const equityCurve = [{ date: startDate, value: 100 }];
  const scanDateSet = new Set(allScanDates);

  for (const day of allDays) {
    // ─── Close expired/exited positions ───────────────────────────────
    const stillOpen = [];
    for (const pos of openPositions) {
      if (pos.trade.exitDate && pos.trade.exitDate <= day) {
        realizedPnl += pos.trade.pnlPct * (pos.weight ?? weight);
        closedTrades.push(pos.trade);
      } else {
        stillOpen.push(pos);
      }
    }
    openPositions.length = 0;
    openPositions.push(...stillOpen);

    // ─── On scan dates: rotation + new entries ────────────────────────
    if (scanDateSet.has(day)) {
      // Regime-aware strategy filter: override filter based on scan date's regime
      let activeFilter = strategyFilter;
      if (config.regimeFilters) {
        const scanRegimeRaw = regimeByDate[day];
        if (scanRegimeRaw) {
          const regimeKey = normalizeRegime(scanRegimeRaw);
          const overrideName = config.regimeFilters[regimeKey];
          if (overrideName && STRATEGY_FILTERS_MAP[overrideName]) {
            activeFilter = STRATEGY_FILTERS_MAP[overrideName];
          }
        }
      }
      // Apply strategy filter per date (deferred from global loop for regime awareness)
      const filtered = (byDate[day] || []).filter(t => !activeFilter.has(t.strategy));
      const candidates = filtered.slice(0, topN);
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
              realizedPnl += forcePnl * (worst.weight ?? weight);
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

      // Add new positions — risk layer v1: VIX kill, DD breaker, sector cap, correlation cap,
      // inverse-ATR sizing, cross-mode dedup
      const openTickers = new Set(openPositions.map(p => p.trade.ticker));
      const scanRegime = regimeByDate[day] || (candidates[0] && candidates[0].regime);

      // VIX kill switch — skip all new entries this scan if regime tier exceeds threshold
      const vixKill = vixKillTriggered(scanRegime, config.vixKillThreshold);

      // DD circuit breaker — uses *prior-day close* equity to avoid same-day mark bias
      let ddBreakerActive = false;
      if (config.ddBreakerPct && equityCurve.length >= 2) {
        let peakSoFar = 100;
        for (let i = 0; i < equityCurve.length - 1; i++) {
          if (equityCurve[i].value > peakSoFar) peakSoFar = equityCurve[i].value;
        }
        const priorClose = equityCurve[equityCurve.length - 2].value;
        const currentDD = peakSoFar - priorClose;
        ddBreakerActive = currentDD > config.ddBreakerPct;
      }

      const regimeMult = (config.vixKillSwitch !== false) ? regimeSizeMultiplier(scanRegime) : 1;
      const scanWeight = weight * regimeMult;
      const SIZING_REF_STOP_PCT = 0.03;   // 3% reference stop width for relative sizing
      const SIZING_MIN_FACTOR = 0.5;
      const SIZING_MAX_FACTOR = 1.5;

      // Track sector exposure already in portfolio (count by sector)
      const sectorCounts = {};
      for (const pos of openPositions) {
        const sec = getSector(pos.trade.ticker);
        sectorCounts[sec] = (sectorCounts[sec] || 0) + 1;
      }

      let added = 0;
      for (const cand of candidates) {
        if (added >= slotsAvailable) break;
        if (vixKill || ddBreakerActive) break;          // halt new entries
        if (openTickers.has(cand.ticker)) continue;
        // Cross-mode dedup — skip ticker already picked by another mode this scan day
        if (config.crossModeDedup && config.crossModePicked) {
          const dedupKey = `${day}|${cand.ticker}`;
          if (config.crossModePicked.has(dedupKey)) continue;
        }
        // Sector concentration cap
        if (config.sectorCapMax) {
          const sec = getSector(cand.ticker);
          if ((sectorCounts[sec] || 0) >= config.sectorCapMax) continue;
        }
        // Pairwise correlation cap (vs already-open positions in this mode)
        if (config.correlationCap > 0 && openPositions.length > 0) {
          const rho = maxCorrToOpen(cand, openPositions, 60);
          if (rho != null && Math.abs(rho) > config.correlationCap) continue;
        }
        // ETF at 52w high penalty: reduce effective score by 5 for ETFs near yearly highs
        const candSector = getSector(cand.ticker);
        if (candSector.startsWith('ETF-')) {
          const hist = priceCache[cand.ticker];
          if (hist) {
            const lookbackDays = Object.keys(hist).filter(d => d <= day).sort().slice(-252);
            const yearHigh = Math.max(...lookbackDays.map(d => hist[d]?.high || 0));
            if (yearHigh > 0 && cand.actualEntry >= yearHigh * 0.98) {
              cand.score = (cand.score || 0) - 5;
              if (cand.score < (config.minScore || 85)) continue;
            }
          }
        }
        // Inverse-ATR sizing — RELATIVE adjustment to scanWeight (0.5x..1.5x clamp).
        // High stop (vol) → smaller weight; tight stop → larger weight; mean ≈ scanWeight.
        let candWeight = scanWeight;
        if (config.sizingMethod === 'inverse_atr' && cand.actualEntry > 0 && cand.actualStop > 0) {
          const stopPct = (cand.actualEntry - cand.actualStop) / cand.actualEntry;
          if (stopPct > 0) {
            const adj = Math.max(SIZING_MIN_FACTOR, Math.min(SIZING_MAX_FACTOR, SIZING_REF_STOP_PCT / Math.max(stopPct, 0.005)));
            candWeight = scanWeight * adj;
          }
        }
        openPositions.push({ trade: cand, weight: candWeight });
        openTickers.add(cand.ticker);
        const candSec = getSector(cand.ticker);
        sectorCounts[candSec] = (sectorCounts[candSec] || 0) + 1;
        if (config.crossModeDedup && config.crossModePicked) {
          config.crossModePicked.add(`${day}|${cand.ticker}`);
        }
        added++;
      }
    }

    // ─── Daily MtM: realized + unrealized at close ───────────────────
    let unrealizedPnl = 0;
    for (const pos of openPositions) {
      const hist = priceCache[pos.trade.ticker];
      if (hist && hist[day]) {
        unrealizedPnl += ((hist[day].close - pos.trade.actualEntry) / pos.trade.actualEntry) * 100 * (pos.weight ?? weight);
      }
    }
    const dailyEquity = 100 + realizedPnl + unrealizedPnl;
    equityCurve.push({ date: day, value: +dailyEquity.toFixed(2) });
  }

  // Snapshot realized (closed) vs unrealized (still open, mark-to-market) at last day
  const returnRealized = +realizedPnl.toFixed(2);
  let unrealizedSnapshot = 0;
  const lastDay = allDays[allDays.length - 1];
  for (const pos of openPositions) {
    const hist = priceCache[pos.trade.ticker];
    if (hist && hist[lastDay]) {
      unrealizedSnapshot += ((hist[lastDay].close - pos.trade.actualEntry) / pos.trade.actualEntry) * 100 * (pos.weight ?? weight);
    }
  }
  const returnUnrealized = +unrealizedSnapshot.toFixed(2);

  // Flush remaining positions at last known price into total (preserves legacy behaviour)
  for (const pos of openPositions) {
    if (pos.trade.pnlPct != null) {
      realizedPnl += pos.trade.pnlPct * (pos.weight ?? weight);
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

  // Include breakeven/trail exits (real fills, just locked at 0/positive) + _amb variants
  const RESOLVED_STATUSES = ['tp1', 'tp1_partial', 'tp2', 'sl', 'expired', 'rotated', 'breakeven', 'trail'];
  const resolved = closedTrades.filter(t => {
    const base = (t.status || '').replace(/_amb$/, '');
    return RESOLVED_STATUSES.includes(base);
  });
  const wins = resolved.filter(t => (t.pnlPct || 0) > 0);
  const losses = resolved.filter(t => (t.pnlPct || 0) <= 0);
  const winRate = resolved.length ? +((wins.length / resolved.length) * 100).toFixed(1) : 0;
  const avgWin = wins.length ? +(wins.reduce((s, t) => s + t.pnlPct, 0) / wins.length).toFixed(2) : 0;
  const avgLoss = losses.length ? +(losses.reduce((s, t) => s + t.pnlPct, 0) / losses.length).toFixed(2) : 0;
  const grossWin = wins.reduce((s, t) => s + t.pnlPct, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));
  const profitFactor = grossLoss > 0 ? +(grossWin / grossLoss).toFixed(2) : grossWin > 0 ? 99 : 0;

  // returnDDRatio = legacy field (was misnamed "sharpe"); kept for backward compat.
  const returnDDRatio = maxDD > 0 ? +(returnTotal / maxDD).toFixed(2) : returnTotal > 0 ? 99 : 0;

  // True Sharpe ratio: sqrt(252) * mean(daily_returns) / std(daily_returns)
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
    const sumYY = values.reduce((a, b) => a + b * b, 0);
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
    returnRealized,
    returnUnrealized,
    maxDD: +(-maxDD).toFixed(2),
    r2,
    winRate,
    avgWin,
    avgLoss,
    profitFactor,
    sharpe,
    returnDDRatio,
    calmar,
    sortino,
    avgHold,
    trades: resolved.length,
    wins: wins.length,
    losses: losses.length,
    equityCurve,
    closedTrades: resolved.map(t => ({
      ticker: t.ticker, strategy: t.strategy, score: t.score,
      scanDate: t.scanDate, entryDate: t.entryDate, exitDate: t.exitDate || null,
      actualEntry: t.actualEntry, exitPrice: t.exitPrice,
      status: t.status, pnlPct: t.pnlPct, holdDays: t.holdDays || 0,
      actualStop: t.actualStop || null, actualTp1: t.actualTp1 || null, actualTp2: t.actualTp2 || null,
      regime: t.regime || null,
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
      return date >= (FROM_DATE || '2026-02-15');
    })
    .sort();

  console.log(`Parsing ${scanDirs.length} scans...`);
  const scans = scanDirs.map(parseScan).filter(Boolean);
  let allSetups = scans.flatMap(s => s.setups.map(t => ({ ...t, scanDate: s.scanDate, dir: s.dir, regime: s.regime })));
  if (SHARIA) {
    const before = allSetups.length;
    // Use parsed data-sharia flag if available, fallback to SHARIA_EXCLUDED for old untagged scans
    allSetups = allSetups.filter(s => {
      if (s.sharia === true) return true;   // explicitly tagged compliant
      if (s.sharia === false) return false;  // explicitly tagged non-compliant
      return !SHARIA_EXCLUDED.has(s.ticker); // untagged (old scan) → use fallback list
    });
    console.log(`🕌 Sharia filter: ${before - allSetups.length} setups excluded (${before} → ${allSetups.length})`);
  }
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
  const PORTFOLIO_SIZES = QUICK ? [1, 3, 5] : [1, 2, 3, 4, 5, 8, 10, 15];
  const TOP_NS = QUICK ? [1, 2] : [1, 2, 3, 4, 5, 8, 10];
  const MIN_SCORES = QUICK ? [85] : [85, 90];
  const HORIZONS = QUICK ? [5, 15] : [2, 3, 5, 8, 10, 15];
  const STRATEGY_FILTERS = STRATEGY_FILTERS_MAP; // reference module-scope map
  const ENTRY_GATE_PCTS = [0, 3]; // 0 = disabled, 3% = reject opens gapping >3% above entry
  // VWAP gate always ON — proven +29% total PnL improvement, not grid-searched to save memory
  const VWAP_GATE_FIXED = true;
  const ROTATIONS = ['none', 'daily_max1', 'aggressive'];
  const TP_MODES = [false, true]; // partialTP
  const TP_PCTS = [0.5]; // partial TP fraction (0.5 is the balanced default)
  const TRAIL_MODES = [false, true]; // trailingStop: turbo uses true
  const MAX_STOP_PCTS = [0, 2, 3, 5, 7]; // 0 = no cap, 2% = turbo tight
  const ATR_STOP_MULTS = [0, 1, 2]; // 0 = disabled
  const DAILY_TRAIL_PCTS = [0, 2, 3]; // 0 = disabled, 2% = turbo tight, 3% = proven sweet spot
  const BREAKEVEN_PCTS = [0, 0.5, 1]; // 0 = disabled, 0.5% = turbo fast, 1% = standard
  const STALE_DAYS = [0, 2]; // 0 = disabled, 2 = turbo exit on stale momentum

  // TP_PCTS only matter when partialTP=true, so effective count = (1 + TP_PCTS.length) for TP dimension
  const tpCombos = [[false, 0.5], ...TP_PCTS.map(p => [true, p])]; // [partialTP, partialTPPct]

  const total = PORTFOLIO_SIZES.length * TOP_NS.length * MIN_SCORES.length
    * Object.keys(STRATEGY_FILTERS).length * ROTATIONS.length * HORIZONS.length
    * tpCombos.length * TRAIL_MODES.length * MAX_STOP_PCTS.length * ATR_STOP_MULTS.length
    * DAILY_TRAIL_PCTS.length * BREAKEVEN_PCTS.length * STALE_DAYS.length * ENTRY_GATE_PCTS.length;
  console.log(`\n=== GRID SEARCH (${total} combinations) ===\n`);

  // Pre-simulate all trades for each unique trade-level config
  const tradesByKey = {};
  const preSimTotal = HORIZONS.length * tpCombos.length * TRAIL_MODES.length
    * MAX_STOP_PCTS.length * ATR_STOP_MULTS.length * DAILY_TRAIL_PCTS.length
    * BREAKEVEN_PCTS.length * STALE_DAYS.length * ENTRY_GATE_PCTS.length;
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
                  for (const entryGate of ENTRY_GATE_PCTS) {
                  const vwapGate = VWAP_GATE_FIXED;
                  const key = `${horizon}_${ptp}_${ptpPct}_${trail}_${maxStop}_${atrMult}_${dailyTrail}_${bePct}_${stale}_${entryGate}_${vwapGate}`;
                  const trades = [];
                  for (const setup of allSetups) {
                    const history = priceCache[setup.ticker];
                    const result = simulateTrade(setup, setup.scanDate, history, {
                      horizonDays: horizon, partialTP: ptp, partialTPPct: ptpPct, trailingStop: trail,
                      maxStopPct: maxStop, atrStopMult: atrMult, dailyTrailPct: dailyTrail,
                      breakevenPct: bePct, staleDays: stale, entryGatePct: entryGate, vwapGate,
                    });
                    if (result) {
                      // Preserve regime from setup so simulatePortfolio's regimeByDate map
                      // populates correctly. Without this, VIX kill is dead code on backtest.
                      trades.push({ ...result, regime: setup.regime || null, _horizon: horizon, _partialTP: ptp, _ptpPct: ptpPct, _trail: trail, _maxStop: maxStop, _atrMult: atrMult, _dailyTrail: dailyTrail, _bePct: bePct, _stale: stale });
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
  }
  console.log(`Pre-simulated ${preSimDone} trade sets`);

  // Pre-simulate frozen mode configs that fall outside the grid dimensions
  const FROZEN_CFG_PATH = path.join(ROOT, "data", "modes-config.json");
  if (fs.existsSync(FROZEN_CFG_PATH)) {
    const frozenModes = JSON.parse(fs.readFileSync(FROZEN_CFG_PATH)).modes || {};
    let frozenExtra = 0;
    for (const [modeId, cfg] of Object.entries(frozenModes)) {
      const fKey = `${cfg.horizon}_${cfg.partialTP || false}_${cfg.partialTPPct || 0.5}_${cfg.trailingStop || false}_${cfg.maxStopPct || 0}_${cfg.atrStopMult || 0}_${cfg.dailyTrailPct || 0}_${cfg.breakevenPct || 0}_${cfg.staleDays || 0}_${cfg.entryGatePct || 0}_${cfg.vwapGate || false}`;
      if (!tradesByKey[fKey]) {
        const trades = [];
        for (const setup of allSetups) {
          const history = priceCache[setup.ticker];
          const result = simulateTrade(setup, setup.scanDate, history, {
            horizonDays: cfg.horizon, partialTP: cfg.partialTP || false, partialTPPct: cfg.partialTPPct || 0.5,
            trailingStop: cfg.trailingStop || false, maxStopPct: cfg.maxStopPct || 0, atrStopMult: cfg.atrStopMult || 0,
            dailyTrailPct: cfg.dailyTrailPct || 0, breakevenPct: cfg.breakevenPct || 0, staleDays: cfg.staleDays || 0,
            entryGatePct: cfg.entryGatePct || 0, vwapGate: cfg.vwapGate || false,
          });
          if (result) trades.push({ ...result, regime: setup.regime || null });
        }
        tradesByKey[fKey] = trades;
        frozenExtra++;
        console.log(`  Pre-sim extra for ${modeId}: key=${fKey} (${trades.length} trades)`);
      }
    }
    if (frozenExtra) console.log(`Pre-simulated ${frozenExtra} extra frozen-mode trade sets`);
  }

  // Bounded top-N tracker to avoid OOM on large grids
  const TOP_K = 50;
  const MIN_TRADES = 8;
  const topBySharpe = [];
  const topByReturn = [];
  const topByCalmar = [];
  const topByComposite = [];
  const topByLowestDD = []; // sorted ascending by |DD| (lowest first)
  // Mode-specific trackers with constraints
  const advTurbo = [];           // strict: Return≥40%, DD≤10%, WR≥55%, trades≥8
  const advDynamic = [];         // strict: Return≥35%, DD≤6%, WR≥60%, trades≥10
  const advBalanced = [];        // strict: Return≥24%, DD≤4%, WR≥60%, trades≥10
  const advSecured = [];         // strict: Return≥12%, DD≤2%, WR≥75%, trades≥10
  const advFortress = [];        // strict: Return≥8%, DD≤1.5%, WR≥70%, trades≥10
  const advTurboRelaxed = [];    // relaxed: Return≥30%, DD≤15%, WR≥50%, trades≥8
  const advDynamicRelaxed = [];  // relaxed: Return≥30%, DD≤10%, WR≥55%, trades≥10
  const advBalancedRelaxed = []; // relaxed: Return≥20%, DD≤5%, WR≥55%, trades≥10
  const advSecuredRelaxed = [];  // relaxed: Return≥10%, DD≤2.5%, WR≥65%, trades≥10
  const advFortressRelaxed = []; // relaxed: Return≥5%, DD≤2%, WR≥65%, trades≥10

  function insertTop(arr, item, compareFn) {
    if (arr.length < TOP_K) { arr.push(item); arr.sort(compareFn); return; }
    if (compareFn(item, arr[arr.length - 1]) < 0) { arr[arr.length - 1] = item; arr.sort(compareFn); }
  }

  let tested = 0;
  if (!FROZEN_ONLY) {
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
                          for (const entryGatePct of ENTRY_GATE_PCTS) {
                          const vwapGate = VWAP_GATE_FIXED;
                            const key = `${horizon}_${partialTP}_${partialTPPct}_${trailingStop}_${maxStopPct}_${atrStopMult}_${dailyTrailPct}_${breakevenPct}_${staleDays}_${entryGatePct}_${vwapGate}`;
                            const trades = tradesByKey[key] || [];

                            const config = {
                              portfolioSize, topN, minScore, rotation,
                              strategyFilter: filterSet, horizonDays: horizon, partialTP, trailingStop
                            };

                            const metrics = simulatePortfolio(trades, scans, config);
                            if (metrics && metrics.trades >= MIN_TRADES && metrics.returnTotal > 0) {
                              const r = {
                                portfolioSize, topN, minScore, filterName, rotation,
                                horizon, partialTP, partialTPPct, trailingStop, maxStopPct, atrStopMult, dailyTrailPct,
                                breakevenPct, staleDays, entryGatePct, vwapGate,
                                ...metrics,
                              };
                              r.composite = (r.returnTotal / 30) + (1 / Math.max(0.5, Math.abs(r.maxDD))) + (r.winRate / 100) + (r.calmar / 10) + (r.profitFactor / 5);
                              insertTop(topBySharpe, r, (a, b) => b.sharpe - a.sharpe);
                              insertTop(topByReturn, r, (a, b) => b.returnTotal - a.returnTotal);
                              insertTop(topByCalmar, r, (a, b) => b.calmar - a.calmar);
                              insertTop(topByComposite, r, (a, b) => b.composite - a.composite);
                              insertTop(topByLowestDD, r, (a, b) => Math.abs(a.maxDD) - Math.abs(b.maxDD));
                              // Mode advisors — strict targets (aspirational)
                              if (r.returnTotal >= 40 && Math.abs(r.maxDD) <= 10 && r.winRate >= 55 && r.trades >= 8) {
                                insertTop(advTurbo, r, (a, b) => b.returnTotal - a.returnTotal);
                              }
                              if (r.returnTotal >= 35 && Math.abs(r.maxDD) <= 6 && r.winRate >= 60 && r.trades >= 10) {
                                insertTop(advDynamic, r, (a, b) => b.returnTotal - a.returnTotal);
                              }
                              if (r.returnTotal >= 24 && Math.abs(r.maxDD) <= 4 && r.winRate >= 60 && r.trades >= 10) {
                                insertTop(advBalanced, r, (a, b) => b.returnTotal - a.returnTotal);
                              }
                              if (r.returnTotal >= 12 && Math.abs(r.maxDD) <= 2 && r.winRate >= 75 && r.trades >= 10) {
                                insertTop(advSecured, r, (a, b) => b.returnTotal - a.returnTotal);
                              }
                              if (r.returnTotal >= 8 && Math.abs(r.maxDD) <= 1.5 && r.winRate >= 70 && r.trades >= 10) {
                                insertTop(advFortress, r, (a, b) => Math.abs(a.maxDD) - Math.abs(b.maxDD));
                              }
                              // Near-miss advisors — best achievable with relaxed constraints
                              if (r.returnTotal >= 30 && Math.abs(r.maxDD) <= 15 && r.winRate >= 50 && r.trades >= 8) {
                                insertTop(advTurboRelaxed, r, (a, b) => b.returnTotal - a.returnTotal);
                              }
                              if (r.returnTotal >= 30 && Math.abs(r.maxDD) <= 10 && r.winRate >= 55 && r.trades >= 10) {
                                insertTop(advDynamicRelaxed, r, (a, b) => b.returnTotal - a.returnTotal);
                              }
                              if (r.returnTotal >= 20 && Math.abs(r.maxDD) <= 5 && r.winRate >= 55 && r.trades >= 10) {
                                insertTop(advBalancedRelaxed, r, (a, b) => b.returnTotal - a.returnTotal);
                              }
                              if (r.returnTotal >= 10 && Math.abs(r.maxDD) <= 2.5 && r.winRate >= 65 && r.trades >= 10) {
                                insertTop(advSecuredRelaxed, r, (a, b) => b.returnTotal - a.returnTotal);
                              }
                              if (r.returnTotal >= 5 && Math.abs(r.maxDD) <= 2 && r.winRate >= 65 && r.trades >= 10) {
                                insertTop(advFortressRelaxed, r, (a, b) => Math.abs(a.maxDD) - Math.abs(b.maxDD));
                              }
                            }

                            tested++;
                            if (tested % 5000 === 0) process.stdout.write(`  ${tested}/${total}\r`);
                          } // end entryGatePct
                          } // end staleDays
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
  }

  // 5. Rank and display
  const ranked = topBySharpe;

  if (!FROZEN_ONLY) {
    console.log(`TOP 20 COMBOS by Sharpe (min ${MIN_TRADES} trades):`);
    console.log('PSize TopN MinSc Filter          Rotation      Horiz  PTP  Trail MaxSt  ATR Trail Gate  Return  MaxDD    WR    PF   Sharpe Calmar Trades');
    console.log('─'.repeat(160));

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
      (r.entryGatePct ? r.entryGatePct + '%' : '—').padStart(4),
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
      const wfKey = `${r.horizon}_${r.partialTP}_${r.partialTPPct || 0.5}_${r.trailingStop}_${r.maxStopPct || 0}_${r.atrStopMult || 0}_${r.dailyTrailPct || 0}_${r.breakevenPct || 0}_${r.staleDays || 0}_${r.entryGatePct || 0}_${r.vwapGate || false}`;
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

      console.log(`P${r.portfolioSize}/Top${r.topN}/Score${r.minScore}/${r.filterName}/${r.rotation}/H${r.horizon}/MaxSt=${r.maxStopPct || 0}%/ATR=${r.atrStopMult || 0}x/Trail=${r.dailyTrailPct || 0}%:`);
      console.log(`  In-sample:  ${isR} (${isMetrics?.trades || 0} trades)`);
      console.log(`  Out-sample: ${osR} (${osMetrics?.trades || 0} trades)`);
      console.log(`  Degradation: ${degradation}`);
      console.log();
    }
  }

  // Top by different metrics
  const fmtR = r => `P${r.portfolioSize} Top${r.topN} Score≥${r.minScore} ${r.filterName} ${r.rotation} H${r.horizon} MaxSt=${r.maxStopPct || 0}% ATR=${r.atrStopMult || 0}x Trail=${r.dailyTrailPct || 0}% TR=${r.trailingStop ? 'Y' : 'N'} BE=${r.breakevenPct || 0}% Stale=${r.staleDays || 0}d${r.partialTP ? ' PTP=' + ((r.partialTPPct || 0.5) * 100) + '%' : ''}`;

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

  console.log('TURBO (Return≥40%, DD≤10%, WR≥55%, trades≥8 — ultra-aggressive short-term):');
  for (const r of advTurbo.slice(0, 10)) {
    console.log(`  ${fmtR(r)}: Ret=${r.returnTotal > 0 ? '+' : ''}${r.returnTotal}% DD=${r.maxDD}% R2=${r.r2.toFixed(3)} WR=${r.winRate}% PF=${r.profitFactor} trades=${r.trades}`);
  }

  console.log('\nDYNAMIC (Return≥35%, DD≤6%, WR≥60%, trades≥10 — sweep finds optimal P/filter/exit):');
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

  console.log('\nFORTRESS (Return≥8%, DD≤1.5%, WR≥70%, trades≥10 — ultra-conservative capital preservation):');
  for (const r of advFortress.slice(0, 10)) {
    console.log(`  ${fmtR(r)}: Ret=${r.returnTotal > 0 ? '+' : ''}${r.returnTotal}% DD=${r.maxDD}% R2=${r.r2.toFixed(3)} WR=${r.winRate}% PF=${r.profitFactor} trades=${r.trades}`);
  }

  console.log('\n─── NEAR-MISS (relaxed constraints — best achievable) ───\n');

  console.log('TURBO near-miss (Return≥30%, DD≤15%, WR≥50%, trades≥8):');
  if (advTurboRelaxed.length === 0) console.log('  (none found)');
  for (const r of advTurboRelaxed.slice(0, 5)) {
    console.log(`  ${fmtR(r)}: Ret=${r.returnTotal > 0 ? '+' : ''}${r.returnTotal}% DD=${r.maxDD}% WR=${r.winRate}% PF=${r.profitFactor} trades=${r.trades}`);
  }

  console.log('\nDYNAMIC near-miss (Return≥30%, DD≤10%, WR≥55%, trades≥10):');
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

  console.log('\nFORTRESS near-miss (Return≥5%, DD≤2%, WR≥65%, trades≥10):');
  if (advFortressRelaxed.length === 0) console.log('  (none found)');
  for (const r of advFortressRelaxed.slice(0, 5)) {
    console.log(`  ${fmtR(r)}: Ret=${r.returnTotal > 0 ? '+' : ''}${r.returnTotal}% DD=${r.maxDD}% WR=${r.winRate}% PF=${r.profitFactor} trades=${r.trades}`);
  }

  console.log();
  }

  // 6. Save results
  const output = {
    generated_at: new Date().toISOString(),
    version: 2,
    period: { start: '2026-02-15', end: new Date().toISOString().slice(0, 10), scans: scans.length },
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
    advisor_turbo: advTurbo[0] || null,
    advisor_dynamic: advDynamic[0] || null,
    advisor_balanced: advBalanced[0] || null,
    advisor_secured: advSecured[0] || null,
    advisor_fortress: advFortress[0] || null,
    advisor_turbo_relaxed: advTurboRelaxed[0] || null,
    advisor_dynamic_relaxed: advDynamicRelaxed[0] || null,
    advisor_balanced_relaxed: advBalancedRelaxed[0] || null,
    advisor_secured_relaxed: advSecuredRelaxed[0] || null,
    advisor_fortress_relaxed: advFortressRelaxed[0] || null,
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


  // Save trade lists for all FROZEN modes (from modes-config.json)
  const MODES_CFG_PATH = path.join(ROOT, "data", "modes-config.json");
  const HISTORY_PATH = path.join(ROOT, "data", "modes-config-history.json");
  const BACKTEST_TRADES_PATH = path.join(ROOT, "data", "backtest-trades.json");
  const frozenTrades = {};
  // Load config version history for trade tagging
  let configHistory = [];
  if (fs.existsSync(HISTORY_PATH)) {
    try { configHistory = JSON.parse(fs.readFileSync(HISTORY_PATH)).versions || []; } catch(e) {}
  }
  function getConfigVersion(scanDate) {
    // Find the config version active at scanDate (last version with timestamp <= scanDate)
    let ver = configHistory.length ? configHistory[0].id : 'unknown';
    for (const h of configHistory) {
      const hDate = (h.timestamp || '').slice(0, 10); // "2026-04-18T..." → "2026-04-18"
      if (hDate <= scanDate) ver = h.id;
      else break;
    }
    return ver;
  }

  // Always load existing trades and results — history is never rewritten
  let existingTrades = {};
  if (fs.existsSync(BACKTEST_TRADES_PATH)) {
    try { existingTrades = JSON.parse(fs.readFileSync(BACKTEST_TRADES_PATH, 'utf8')); } catch(e) {}
  }
  let existingResults = {};
  const RESULTS_PATH = path.join(ROOT, 'data', 'backtest-results.json');
  if (fs.existsSync(RESULTS_PATH)) {
    try { existingResults = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf8')); } catch(e) {}
  }

  // Preserve advisor_* values when daily run (FROZEN_ONLY) does not regenerate them.
  // The advisor arrays only populate during a full grid search; without this fallback
  // the output gets stale nulls overwriting the last good advisor recommendation.
  for (const k of Object.keys(existingResults)) {
    if (!k.startsWith('advisor_')) continue;
    if (output[k] == null && existingResults[k] != null) {
      output[k] = existingResults[k];
    }
  }

  if (fs.existsSync(MODES_CFG_PATH)) {
    const modesConfig = JSON.parse(fs.readFileSync(MODES_CFG_PATH));
    // Shared scoreboard — modes with crossModeDedup=true skip tickers already picked.
    // Priority order (most conservative first): fortress → secured → balanced → dynamic → turbo.
    // Conservative modes need diversification most, so they consume the candidate pool first.
    const crossModePicked = new Set();
    const DEDUP_PRIORITY = ['fortress', 'secured', 'balanced', 'dynamic', 'turbo'];
    const orderedModeIds = [
      ...DEDUP_PRIORITY.filter(id => modesConfig.modes[id]),
      ...Object.keys(modesConfig.modes).filter(id => !DEDUP_PRIORITY.includes(id)),
    ];
    for (const id of orderedModeIds) {
      const cfg = modesConfig.modes[id];
      const frozenKey = `${cfg.horizon}_${cfg.partialTP || false}_${cfg.partialTPPct || 0.5}_${cfg.trailingStop || false}_${cfg.maxStopPct || 0}_${cfg.atrStopMult || 0}_${cfg.dailyTrailPct || 0}_${cfg.breakevenPct || 0}_${cfg.staleDays || 0}_${cfg.entryGatePct || 0}_${cfg.vwapGate || false}`;
      const cfg2 = {
        portfolioSize: cfg.portfolioSize, topN: cfg.topN, minScore: cfg.minScore || 0,
        rotation: cfg.rotation, strategyFilter: STRATEGY_FILTERS[cfg.filterName],
        horizonDays: cfg.horizon, partialTP: cfg.partialTP || false, partialTPPct: cfg.partialTPPct || 0.5,
        trailingStop: cfg.trailingStop || false, positionSizePct: cfg.positionSizePct || 1,
        regimeFilters: cfg.regimeFilters || null,
        // Risk layer v1 — forwarded as-is so simulatePortfolio applies them at entry time
        ddBreakerPct: cfg.ddBreakerPct ?? 0,
        sectorCapMax: cfg.sectorCapMax ?? 0,
        sizingMethod: cfg.sizingMethod || null,
        targetRiskPct: cfg.targetRiskPct ?? 0,
        vixKillThreshold: cfg.vixKillThreshold ?? 0,
        correlationCap: cfg.correlationCap ?? 0,
        crossModeDedup: cfg.crossModeDedup === true,
        crossModePicked,        // shared Set across all modes
      };

      if (FROZEN_ONLY) {
        // Append-only: preserve existing trades, only simulate scans AFTER the latest existing one
        const existing = existingTrades[id] || [];
        const latestExistingScan = existing.reduce((max, t) => t.scanDate > max ? t.scanDate : max, '');

        // Only process scans strictly after the latest existing scan date
        const newScans = latestExistingScan
          ? scans.filter(s => s.scanDate > latestExistingScan)
          : scans;

        let newClosedTrades = [];
        if (newScans.length > 0) {
          // Build a trade list for only the new scans using the frozen config key
          const allTradesForKey = tradesByKey[frozenKey] || [];
          const newScanDateSet = new Set(newScans.map(s => s.scanDate));
          const newTrades = allTradesForKey.filter(t => newScanDateSet.has(t.scanDate));

          if (newTrades.length > 0) {
            const sim2 = simulatePortfolio(newTrades, newScans, cfg2);
            if (sim2 && sim2.closedTrades) {
              newClosedTrades = sim2.closedTrades
                .map(t => ({ ...t, configVersion: getConfigVersion(t.scanDate || t.entryDate) }));
            }
          }
        }

        // Merge: existing trades + new closed trades (deduplicate by scanDate+ticker)
        const existingKey = t => `${t.scanDate}|${t.ticker}`;
        const existingKeys = new Set(existing.map(existingKey));
        const toAppend = newClosedTrades.filter(t => !existingKeys.has(existingKey(t)));
        const merged = [...existing, ...toAppend]
          .sort((a, b) => (a.scanDate || '').localeCompare(b.scanDate || ''));

        frozenTrades[id] = merged;

        // Always recompute frozen stats from merged trades — old caches may carry
        // legacy "sharpe" formula (Return/MaxDD) that is now exposed as returnDDRatio.
        // Recomputing guarantees true sharpe + IS/OOS partitioning fields are fresh.
        const stats = computeStatsFromTrades(merged, cfg.portfolioSize, cfg.positionSizePct || 1, id);
        const isOosSets = (typeof inSampleDates !== 'undefined') ? { inSample: inSampleDates, outSample: outSampleDates } : null;
        const isStats = isOosSets ? computeStatsFromTrades(merged.filter(t => isOosSets.inSample.has(t.scanDate)), cfg.portfolioSize, cfg.positionSizePct || 1, id) : null;
        const oosStats = isOosSets ? computeStatsFromTrades(merged.filter(t => isOosSets.outSample.has(t.scanDate)), cfg.portfolioSize, cfg.positionSizePct || 1, id) : null;
        if (stats) {
          output[`frozen_${id}`] = {
            returnTotal: stats.returnTotal, maxDD: stats.maxDD, winRate: stats.winRate,
            profitFactor: stats.profitFactor, trades: stats.trades,
            calmar: stats.calmar, sharpe: stats.sharpe, returnDDRatio: stats.returnDDRatio,
            equityCurve: stats.equityCurve,
            in_sample: isStats ? {
              returnTotal: isStats.returnTotal, maxDD: isStats.maxDD, winRate: isStats.winRate,
              profitFactor: isStats.profitFactor, trades: isStats.trades,
              calmar: isStats.calmar, sharpe: isStats.sharpe, returnDDRatio: isStats.returnDDRatio,
            } : null,
            out_sample: oosStats ? {
              returnTotal: oosStats.returnTotal, maxDD: oosStats.maxDD, winRate: oosStats.winRate,
              profitFactor: oosStats.profitFactor, trades: oosStats.trades,
              calmar: oosStats.calmar, sharpe: oosStats.sharpe, returnDDRatio: oosStats.returnDDRatio,
            } : null,
          };
          const tag = toAppend.length === 0 ? '0 new' : `${toAppend.length} new`;
          const oosTag = oosStats ? ` | OOS Ret=${oosStats.returnTotal}% WR=${oosStats.winRate}% n=${oosStats.trades}` : '';
          console.log(`  ${id} (${cfg.label}): ${merged.length} trades (${tag}), return=${stats.returnTotal}%, DD=${stats.maxDD}%${oosTag}`);
        } else {
          console.log(`  ${id} (${cfg.label}): ${merged.length} trades, no stats computable`);
        }
      } else {
        // FULL_SWEEP: keep existing trades and stats intact
        const existing = existingTrades[id] || [];
        frozenTrades[id] = existing;
        const existingStats = existingResults[`frozen_${id}`];
        if (existingStats) {
          output[`frozen_${id}`] = existingStats;
          console.log(`  ${id} (${cfg.label}): ${existing.length} trades (preserved), return=${existingStats.returnTotal}%, DD=${existingStats.maxDD}%`);
        } else {
          console.log(`  ${id} (${cfg.label}): ${existing.length} trades (preserved), no stats`);
        }
      }
    }
  } else {
    console.log('⚠️  No modes-config.json found — skipping frozen trades. Run sweep --full-sweep to discover optimal strategy.');
  }
  // Backfill vwap for trades that predate the vwap field.
  // ⚠️ NO LOOKAHEAD: use the *previous* day's typical price (pre-market reference),
  // never the entry day's bar (its close is unknown at the open).
  for (const id of Object.keys(frozenTrades)) {
    for (const t of frozenTrades[id]) {
      if (t.vwap != null) continue;
      const bars = priceCache[t.ticker];
      if (!bars) continue;
      const d = t.entryDate || t.scanDate;
      const sortedDs = Object.keys(bars).sort();
      const idx = sortedDs.indexOf(d);
      if (idx <= 0) continue; // no prev bar available
      const prev = bars[sortedDs[idx - 1]];
      if (prev && prev.high && prev.low && prev.close) {
        t.vwap = +((prev.high + prev.low + prev.close) / 3).toFixed(4);
      }
    }
  }
  fs.writeFileSync(BACKTEST_TRADES_PATH, JSON.stringify(frozenTrades, null, 2));
  console.log("✅ Trade lists saved to data/backtest-trades.json (frozen modes)");

  // Save equity curve for optimal combo
  if (ranked[0]) {
    const best = ranked[0];
    fs.writeFileSync(path.join(ROOT, 'data', 'portfolio-history.json'), JSON.stringify({
      combo: {
        portfolioSize: best.portfolioSize, topN: best.topN, minScore: best.minScore,
        filterName: best.filterName, rotation: best.rotation, horizon: best.horizon,
        partialTP: best.partialTP, partialTPPct: best.partialTPPct, trailingStop: best.trailingStop, maxStopPct: best.maxStopPct || 0, atrStopMult: best.atrStopMult || 0, dailyTrailPct: best.dailyTrailPct || 0, breakevenPct: best.breakevenPct || 0, staleDays: best.staleDays || 0, entryGatePct: best.entryGatePct || 0,
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

    const optMap = { turbo: topByReturn[0], dynamic: topByReturn[0], balanced: topByCalmar[0], secured: ranked[0], fortress: ranked[0] };
    for (const [id, cfg] of Object.entries(config.modes)) {
      const opt = optMap[id];
      if (!opt) continue;
      const same = opt.portfolioSize === cfg.portfolioSize && opt.topN === cfg.topN
        && opt.horizon === cfg.horizon && opt.filterName === cfg.filterName
        && opt.rotation === cfg.rotation && (opt.maxStopPct || 0) === (cfg.maxStopPct || 0)
        && (opt.atrStopMult || 0) === (cfg.atrStopMult || 0) && (opt.dailyTrailPct || 0) === (cfg.dailyTrailPct || 0)
        && (opt.breakevenPct || 0) === (cfg.breakevenPct || 0) && (opt.staleDays || 0) === (cfg.staleDays || 0);
      const frozen = `P${cfg.portfolioSize}/Top${cfg.topN}/H${cfg.horizon}/${cfg.filterName}/${cfg.rotation}/MaxSt=${cfg.maxStopPct || 0}%/ATR=${cfg.atrStopMult || 0}x/Trail=${cfg.dailyTrailPct || 0}%/BE=${cfg.breakevenPct || 0}%/Stale=${cfg.staleDays || 0}d/Gate=${cfg.entryGatePct || 0}%`;
      const sweep = `P${opt.portfolioSize}/Top${opt.topN}/H${opt.horizon}/${opt.filterName}/${opt.rotation}/MaxSt=${opt.maxStopPct || 0}%/ATR=${opt.atrStopMult || 0}x/Trail=${opt.dailyTrailPct || 0}%/BE=${opt.breakevenPct || 0}%/Stale=${opt.staleDays || 0}d/Gate=${opt.entryGatePct || 0}%`;
      console.log(`${id.toUpperCase()} (${cfg.label}):`);
      console.log(`  Frozen: ${frozen}`);
      console.log(`  Sweep : ${sweep} (Return=${opt.returnTotal}% Sharpe=${opt.sharpe})`);
      console.log(`  ${same ? "✅ Match" : "⚠️  DIFFERENT — consider manual update"}`);
      console.log();
    }
  }
}

main().catch(e => { console.error('Fatal:', e.message, e.stack); process.exit(1); });
