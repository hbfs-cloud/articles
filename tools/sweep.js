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
const { verify: verifyTradeChain, seal: sealTradeChain } = require('./lib/trade-integrity');
const SWEEP_SHARD = +(process.env.SWEEP_SHARD ?? -1);
const SWEEP_SHARDS = +(process.env.SWEEP_SHARDS ?? 1);
const SHARD_OUT = process.env.SWEEP_SHARD_OUT || '';
const SHARIA = process.argv.includes('--sharia');
const FROM_ARG = process.argv.find(a => a.startsWith('--from='));
const FROM_DATE = FROM_ARG ? FROM_ARG.split('=')[1] : null;
// TKL pool ingestion policy:
//   off      → published Top 10 only (revert to pre-tkl-pool behavior)
//   hybrid   → Top 10 + tkl_pool merged into shared candidate pool (gated by per-mode minScore/regime/etc.)
//   isolated → Top 10 only for non-tkl modes; tkl mode also gets tkl_pool. Requires per-mode candidate filtering.
const TKL_POLICY_ARG = process.argv.find(a => a.startsWith('--tkl-policy='));
const TKL_POLICY = TKL_POLICY_ARG
  ? TKL_POLICY_ARG.split('=')[1]
  : (process.env.TKL_POLICY || 'hybrid');
if (!['off', 'hybrid', 'isolated'].includes(TKL_POLICY)) {
  console.error(`Invalid --tkl-policy=${TKL_POLICY}. Use off|hybrid|isolated.`);
  process.exit(1);
}

// Sharia (Halal) compliance filter — single source of truth shared with gen-status-page.js.
// SHARIA_EXCLUDED (fallback list for untagged old scans), SECTOR_MAP/getSector, HARAM_SECTORS and
// isHaramForHalalMode all live in ./lib/sharia-filter so the backtest (positions) and the public page
// (signals/orders) never diverge on what counts as haram for a shariaOnly mode.
const { SHARIA_EXCLUDED, HARAM_SECTORS, SECTOR_MAP, getSector, isHaramForHalalMode } = require('./lib/sharia-filter');

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
  const step = n >= 0 ? 1 : -1;
  let added = 0;
  while (added < Math.abs(n)) {
    d.setDate(d.getDate() + step);
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

// ─── Calendar-day variants (24/7 markets: crypto, and forex-leaning) ─────────
// Same signatures as the biz-day helpers but counting EVERY calendar day (no
// weekend skip). Used only by modes that opt in via config.calendar='24/7'.
function addCalDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function getAllCalDays(startDate, endDate) {
  const days = [];
  let d = new Date(startDate + 'T12:00:00Z');
  const end = new Date(endDate + 'T12:00:00Z');
  while (d <= end) {
    days.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return days;
}
function calDaysBetween(dateA, dateB) {
  const a = new Date(dateA + 'T12:00:00Z');
  const b = new Date(dateB + 'T12:00:00Z');
  if (a >= b) return 0;
  return Math.round((b - a) / 86400000);
}

// Calendar selector. Equity modes (no `calendar` field) get the EXACT biz-day
// functions → byte-identical results (parity guaranteed by construction). Only
// modes with calendar='24/7' (crypto/forex) switch to calendar-day counting.
const BIZ_DAY_FNS = { addDays: addBizDays, allDays: getAllBizDays, daysBetween: bizDaysBetween };
const CAL_DAY_FNS = { addDays: addCalDays, allDays: getAllCalDays, daysBetween: calDaysBetween };
function dayFnsFor(calendar) {
  return calendar === '24/7' || calendar === 'cal' || calendar === 'calendar' ? CAL_DAY_FNS : BIZ_DAY_FNS;
}

// ─── Parse scan → setups (JSON-first, HTML fallback via scanner-parser.js) ───

const scannerParser = require('./lib/scanner-parser');
const { isPatternInvalidated, checkBearishExit } = require('./lib/americanbull-pm');
const { detectBearishExit } = require('./lib/candlestick-patterns');

const scannerFiltersPath = path.join(ROOT, 'data', 'scanner-filters.json');
const scannerFilters = fs.existsSync(scannerFiltersPath) ? JSON.parse(fs.readFileSync(scannerFiltersPath, 'utf8')) : {};

const STRAT_PATTERNS = {
  short_squeeze: /short.?squeeze/i,
  pre_squeeze: /pre.?squeeze/i,
  adaptive_fractal: /adaptive.?fractal/i,
  highvol_breakout: /high.?vol.?breakout/i,
  trendline_breakout: /trendline.?breakout/i,
  momentum_rotation: /momentum.?rotation/i,
  etf_momentum: /etf.?momentum/i,
  hybrid_megacap: /hybrid.?mega.?cap|megacap/i,
  breakout: /breakout/i,
  momentum: /momentum/i,
  pullback: /pullback/i,
  candlestick: /candlestick/i,
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

  const buildSetups = (arr, source) => {
    const out = [];
    for (const s of arr || []) {
      const { entry, stop, tp1, tp2 } = s;
      if (!entry || !stop || !tp1 || entry <= 0 || stop <= 0) continue;
      if (stop >= entry) continue;
      if (tp1 <= entry) continue;
      // Score derivation: tkl_pool entries from screeners commonly arrive at a fixed
      // ceiling (e.g. 99) — useless for sorting. Replace with a composite derived
      // from setup geometry (R/R) + strategy bias so tkl candidates rank within
      // [85, 95] and remain ELIGIBLE for high-minScore modes (turbo/dynamic = 90).
      // Main "signals" keep their published Claude-curated score as-is.
      let score = s.score || 80;
      if (source === 'tkl_pool') {
        const rr = (tp1 - entry) / Math.max(1e-6, entry - stop);
        const strat = detectStrategy(s.strategy || '');
        // Strategy bias from retro hit-rate: breakout/momentum strongest on small-caps,
        // pre_squeeze actionable when volume contracts, pullback decent, short_squeeze last.
        const stratBonus =
          strat === 'breakout' ? 4 :
          strat === 'highvol_breakout' ? 4 :
          strat === 'adaptive_fractal' ? 4 :
          strat === 'momentum' ? 4 :
          strat === 'momentum_rotation' ? 3.5 :
          strat === 'candlestick' ? 3.5 :
          strat === 'trendline_breakout' ? 3.5 :
          strat === 'etf_momentum' ? 3 :
          strat === 'pre_squeeze' ? 3 :
          strat === 'pullback' ? 3 :
          2; // short_squeeze / unknown
        // R/R bonus: 1.5 → +0, 2 → +2, 2.5 → +4, 3+ → +6
        const rrBonus = Math.min(6, Math.max(0, (rr - 1.5) * 4));
        score = Math.min(95, Math.round(85 + stratBonus * 0.4 + rrBonus));
      }
      out.push({
        ticker: s.ticker,
        strategy: detectStrategy(s.strategy || ''),
        score,
        entry, stop, tp1, tp2,
        sharia: s.sharia,
        source: source || s.source || 'signals',
        pattern: s.pattern || null,
        universe: s.universe || null, // for universeFilter modes (casablanca/highvol/etf)
      });
    }
    return out;
  };

  const dedup = arr => {
    const seen = new Set();
    return arr.filter(s => {
      if (seen.has(s.ticker)) return false;
      seen.add(s.ticker);
      return true;
    }).sort((a, b) => b.score - a.score);
  };

  const setups = dedup(buildSetups(loaded.signals, 'signals'));
  // tklPool kept separate so call sites can opt-in per-mode (see TKL_POLICY in main()).
  const signalTickers = new Set(setups.map(s => s.ticker));
  const tklPool = dedup(buildSetups(loaded.tklPool, 'tkl_pool'))
    .filter(s => !signalTickers.has(s.ticker));
  // Asset-class pools (crypto/metals/forex) keep their raw scanner score (buildSetups only
  // re-normalizes tkl_pool). Each is consumed exclusively by the matching assetClass mode.
  const cryptoPool = dedup(buildSetups(loaded.cryptoPool, 'crypto_pool'));
  const metalsPool = dedup(buildSetups(loaded.metalsPool, 'metals_pool'));
  const forexPool = dedup(buildSetups(loaded.forexPool, 'forex_pool'));
  const casablancaPool = dedup(buildSetups(loaded.casablancaPool, 'casablanca_pool'));

  return {
    dir, scanDate,
    regime: loaded.regime || null,
    regimeScore: loaded.regimeScore ?? null,
    setups,
    tklPool,
    cryptoPool,
    metalsPool,
    forexPool,
    casablancaPool,
  };
}

// Asset-class pool registry: source tag → assetClass. Equity modes exclude ALL of these;
// each asset-class mode trades ONLY its own pool. Generalizes the crypto wiring to N classes.
const ASSET_POOL_SOURCES = { crypto: 'crypto_pool', metals: 'metals_pool', forex: 'forex_pool', casablanca: 'casablanca_pool' };
const ALL_ASSET_POOL_SOURCES = Object.values(ASSET_POOL_SOURCES);

// ─── Regime-score override (proactive de-risk / "parachute") ─────────────────
// The published regime LABEL lags: in June 2026 scans were labelled RISK-ON while the
// regimeScore had already collapsed to 41-47 (caution territory), so momentum-heavy
// modes loaded a correlated cluster right before the -2.58% reversal. The override maps
// the numeric score to the regime it actually implies, then takes the MORE DEFENSIVE of
// (label, score-implied) — fail-to-caution. Score scale is 0-100.
// Calibrated from historical (label,score) distribution: RISK-ON medians ~55-87, but
// laggy RISK-ON days sat at 38-49; genuine risk-on needs score >= 65.
function scoreToRegime(score) {
  if (score == null) return null;
  const s = score <= 1 ? score * 100 : score; // tolerate 0-1 scale slips
  if (s >= 65) return 'risk_on';
  if (s >= 55) return 'recovery';
  if (s >= 45) return 'neutral';
  if (s >= 38) return 'early_risk_off';
  return 'risk_off';
}
// Defensive ordering: lower index = more defensive. Used to take the safer of two regimes.
const REGIME_DEFENSIVENESS = ['risk_off', 'early_risk_off', 'neutral', 'recovery', 'risk_on'];
function moreDefensiveRegime(a, b) {
  const ia = REGIME_DEFENSIVENESS.indexOf(a);
  const ib = REGIME_DEFENSIVENESS.indexOf(b);
  if (ia < 0) return b;
  if (ib < 0) return a;
  return ia <= ib ? a : b;
}

// VIX/regime-based sizing multiplier (risk-off halves exposure)
function regimeSizeMultiplier(regime) {
  if (!regime) return 1;
  const r = String(regime).toUpperCase();
  if (r === 'RISK-OFF') return 0.5;          // halve exposure in risk-off
  if (r === 'EARLY RISK-OFF') return 0.75;   // ¾ exposure in early risk-off
  return 1;
}

// SECTOR_MAP, getSector, HARAM_SECTORS and isHaramForHalalMode are imported from
// ./lib/sharia-filter at the top of this file (shared with gen-status-page.js).

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

// BTC-beta helper (v8.8 crypto cluster guard, analog of v8.7 equity correlation fix).
// Computes the OLS beta of a ticker's 60d log returns vs BTC-USD log returns over the
// same overlapping window. Returns null when not computable (no BTC cache, <10 overlap).
// Uses module-scope priceCache. BTC's own beta is 1 by construction.
function betaToBTC(ticker, lookbackDays) {
  const btcHist = priceCache['BTC-USD'];
  const tHist = priceCache[ticker];
  if (!btcHist || !tHist) return null;
  if (ticker === 'BTC-USD') return 1;
  // Build a common date window so returns align on shared bars.
  const btcDates = new Set(Object.keys(btcHist));
  const common = Object.keys(tHist).filter(d => btcDates.has(d)).sort();
  const window = common.slice(-Math.max(lookbackDays + 1, 20));
  if (window.length < 11) return null;
  const tRet = _logReturns(tHist, window);
  const bRet = _logReturns(btcHist, window);
  const n = Math.min(tRet.length, bRet.length);
  if (n < 10) return null;
  const tx = tRet.slice(-n), bx = bRet.slice(-n);
  let mT = 0, mB = 0;
  for (let i = 0; i < n; i++) { mT += tx[i]; mB += bx[i]; }
  mT /= n; mB /= n;
  let cov = 0, varB = 0;
  for (let i = 0; i < n; i++) {
    const db = bx[i] - mB;
    cov += (tx[i] - mT) * db;
    varB += db * db;
  }
  if (varB <= 0) return null;
  return cov / varB;
}

// Module-scope strategy filter map (used by regime-aware filtering and grid search)
const STRATEGY_FILTERS_MAP = {
  'all': new Set(['candlestick']),
  'no_sq': new Set(['short_squeeze']),
  'no_sq_pb': new Set(['short_squeeze', 'pullback']),
  'momentum_only': new Set(['short_squeeze', 'pre_squeeze', 'breakout', 'highvol_breakout', 'adaptive_fractal', 'trendline_breakout', 'hybrid_megacap', 'pullback', 'candlestick']),
  'breakout_only': new Set(['short_squeeze', 'pre_squeeze', 'momentum', 'momentum_rotation', 'etf_momentum', 'hybrid_megacap', 'pullback', 'candlestick']),
  'mom_bo': new Set(['short_squeeze', 'pre_squeeze', 'pullback', 'candlestick']),
  'candlestick_only': new Set(['short_squeeze', 'pre_squeeze', 'momentum', 'momentum_rotation', 'breakout', 'highvol_breakout', 'adaptive_fractal', 'trendline_breakout', 'etf_momentum', 'hybrid_megacap', 'pullback']),
  'adaptive_fractal': new Set(['short_squeeze', 'pre_squeeze', 'momentum', 'momentum_rotation', 'breakout', 'highvol_breakout', 'hybrid_megacap', 'pullback', 'candlestick']),
  'hybrid_af': new Set(['short_squeeze', 'pre_squeeze', 'pullback', 'candlestick']),
  'highvol_breakout': new Set(['short_squeeze', 'pre_squeeze', 'momentum', 'momentum_rotation', 'breakout', 'adaptive_fractal', 'hybrid_megacap', 'pullback', 'candlestick']),
  'momentum_rotation': new Set(['short_squeeze', 'pre_squeeze', 'breakout', 'highvol_breakout', 'adaptive_fractal', 'trendline_breakout', 'hybrid_megacap', 'pullback', 'candlestick']),
  'etf_momentum': new Set(['short_squeeze', 'pre_squeeze', 'momentum', 'momentum_rotation', 'breakout', 'highvol_breakout', 'adaptive_fractal', 'trendline_breakout', 'hybrid_megacap', 'pullback', 'candlestick']),
  'trendline_breakout': new Set(['short_squeeze', 'pre_squeeze', 'momentum', 'momentum_rotation', 'breakout', 'highvol_breakout', 'adaptive_fractal', 'etf_momentum', 'hybrid_megacap', 'pullback', 'candlestick']),
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

// Crypto OHLCV via Binance klines (crypto is Binance-native, NOT on Yahoo).
// Tickers use the project's BTC-USD convention; Binance wants BTCUSDT.
const isCryptoTicker = t => /-USD$/.test(t);
function fetchBinanceOHLCV(ticker) {
  const sym = ticker.replace(/-USD$/, '') + 'USDT';
  const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(sym)}&interval=1d&limit=250`;
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 12000 }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const arr = JSON.parse(data);
          if (!Array.isArray(arr) || !arr.length) return resolve(null); // {code:-1121} for unlisted alts
          const history = {};
          for (const k of arr) {
            // kline: [openTime, open, high, low, close, volume, ...]
            const dateStr = new Date(k[0]).toISOString().slice(0, 10);
            history[dateStr] = { open: +k[1], high: +k[2], low: +k[3], close: +k[4] };
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

async function fetchOHLCV(ticker) {
  if (priceCache[ticker]) return priceCache[ticker];
  // Try file cache first
  const cached = loadCachedPrice(ticker);
  if (cached) { priceCache[ticker] = cached; return cached; }
  // Crypto → Binance (not Yahoo)
  if (isCryptoTicker(ticker)) return fetchBinanceOHLCV(ticker);
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
          const rmp = result.meta?.regularMarketPrice;
          const history = {};
          for (let i = 0; i < timestamps.length; i++) {
            const dateStr = toDateStr(timestamps[i]);
            if (q.open?.[i] != null && q.high?.[i] != null && q.low?.[i] != null && q.close?.[i] != null) {
              history[dateStr] = { open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i] };
            } else if (i === timestamps.length - 1 && rmp != null) {
              // Last bar may have null OHLC before Yahoo finalizes — use regularMarketPrice
              const o = q.open?.[i] ?? rmp;
              const h = q.high?.[i] ?? rmp;
              const l = q.low?.[i] ?? rmp;
              history[dateStr] = { open: o, high: h, low: l, close: rmp };
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
    beGraceDays = 0,  // min days held before breakeven/trail can activate (0 = immediate)
    staleDays = 0,    // LEGACY compat — use staleGraceDays instead
    // v3 stale tightening (systematic-tss inspired): progressive stop raise after grace period
    staleGraceDays = 0,     // days without new high before tightening starts (0 = disabled)
    staleRaiseRate = 0.001, // fraction of entry price raised per excess day
    staleAccel = 'log',     // acceleration: 'linear', 'log', 'quadratic', 'sqrt'
    // v3 partial TP at gain threshold (systematic-tss: 30% sold at +10% gain)
    partialTPGain = 0,   // trigger partial TP at this % gain (0 = use TP1 level)
    disableTP2 = false,  // skip TP2 hard exit — let trailing/stale handle runner exits
    entryGatePct = 0, // reject if open > entry * (1 + X%) — 0 = disabled
    vwapGate = false, // skip trade if open gaps above VWAP * 1.01 (gap-up trap filter)
    trailMultR = 1.5,    // trail distance as multiple of riskPerUnit (1.5R default)
    trailGraceDays = 0,  // min days held before trailing stop activates (0 = immediate)
    // v8.3 post-widening R:R gate — reject trades where ATR-widened risk destroys reward
    postWideningRRMin = 0, // 0 = disabled; e.g. 1.5 = require actual R:R >= 1.5 after widening
    // v8.3 blacklist — serial losers excluded from candidate pool
    blacklist = null,      // array of ticker strings to skip
  } = config;
  const _staleGrace = staleGraceDays > 0 ? staleGraceDays : staleDays;
  const _staleRate = staleGraceDays > 0 ? staleRaiseRate : 0.002;
  const _staleAccel = staleGraceDays > 0 ? staleAccel : 'linear';
  const _blacklist = blacklist && blacklist.length ? new Set(blacklist.map(t => t.toUpperCase())) : null;
  // Calendar selector: equities (no config.calendar) → biz-day (identical to before);
  // crypto/forex (calendar:'24/7') → calendar-day (weekends count).
  const DF = dayFnsFor(config.calendar);
  if (!priceHistory) return null;

  // v8.3 blacklist — skip serial losers
  if (_blacklist && _blacklist.has((setup.ticker || '').toUpperCase())) return null;

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
    entryPrice = Math.max(Math.min(actualEntry, vwapRef), entryBar.low);
  }

  // Gap-down reject: TKL-only. Large-cap gap-downs mean-revert (SM +14.76%, EOG +7.73%),
  // but small-cap gap-downs are distribution (MNTS -7%, POET -7%, AXTI -7%). Net +18.9% on TKL.
  // Thresholds: breakout 5%, momentum 6%, pre_squeeze 7%, pullback disabled.
  if (setup.source && setup.source.startsWith('tkl')) {
    const GAP_DOWN_PCT = { breakout: 5, momentum: 6, pre_squeeze: 7, pullback: 0 };
    const stratKey = (setup.strategy || '').toLowerCase().replace(/[^a-z_]/g, '');
    const gapDownThresh = GAP_DOWN_PCT[stratKey] ?? 5;
    if (gapDownThresh > 0 && prevBar && prevBar.close) {
      const gapPct = (prevBar.close - actualEntry) / prevBar.close * 100;
      if (gapPct > gapDownThresh) return null;
    }
  }

  let riskPerUnit = setup.entry - setup.stop;
  if (riskPerUnit <= 0) return null;
  const originalRisk = riskPerUnit;

  // ATR-based stop: use widest of setup stop and N*ATR
  if (atrStopMult > 0) {
    const atr = computeATR(priceHistory, entryDate);
    if (atr) {
      const atrRisk = atr * atrStopMult;
      if (atrRisk > riskPerUnit) riskPerUnit = atrRisk;
    }
  }

  // maxStopPct ceiling AFTER ATR widening (was before → ATR override bypassed cap)
  const effectiveMaxStop = maxStopPct > 0 ? maxStopPct : 100;
  if (effectiveMaxStop < 100) {
    const maxRisk = entryPrice * (effectiveMaxStop / 100);
    if (riskPerUnit > maxRisk) riskPerUnit = maxRisk;
  }

  const actualStop = entryPrice - riskPerUnit;
  // TP levels preserve original signal dollar distance (not affected by ATR widening)
  const actualTp1 = entryPrice + (setup.tp1 - setup.entry);
  const actualTp2 = setup.tp2 ? entryPrice + (setup.tp2 - setup.entry) : null;

  // R:R gate uses ORIGINAL signal risk (not ATR-widened) to avoid silent rejection
  const rrRatio = (setup.tp1 - setup.entry) / originalRisk;
  if (rrRatio < 1.5) return null;

  // v8.3 post-widening R:R gate — reject trades where ATR widening collapses actual R:R
  // This prevents the Orbit R:R inversion problem (signal R:R=2.0 but actual R:R=0.8)
  if (postWideningRRMin > 0 && riskPerUnit > 0) {
    const actualRR = (actualTp1 - entryPrice) / riskPerUnit;
    if (actualRR < postWideningRRMin) return null;
  }

  const expireDate = DF.addDays(scanDate, horizonDays);
  const sortedDates = Object.keys(priceHistory)
    .filter(d => d >= entryDate && d <= expireDate).sort();

  let currentStop = actualStop;
  let status = 'open';
  let exitDate = null;
  let exitPrice = null;
  let partialRealized = 0; // P&L from partial close at TP1
  let partialTriggerDay = null;
  let highWaterMark = entryPrice;
  let daysSinceNewHigh = 0;
  let breakevenActivated = false;
  let daysHeld = 0;

  for (const date of sortedDates) {
    const bar = priceHistory[date];
    if (!bar) continue;
    daysHeld++;

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

    // Americanbull PM: pattern invalidation + bearish exit signals (candlestick only)
    if (setup.strategy === 'candlestick' && daysHeld >= 2) {
      // Pattern geometry invalidation
      if (setup.pattern) {
        const inv = isPatternInvalidated(setup, bar, entryPrice);
        if (inv.invalidated) {
          status = bar.close >= entryPrice ? 'trail' : 'sl';
          exitDate = date; exitPrice = bar.close; break;
        }
      }
      // Bearish candlestick exit signals (Bearish Engulfing, Three Black Crows, etc.)
      const allKeys = Object.keys(priceHistory).sort();
      const dateIdx = allKeys.indexOf(date);
      if (dateIdx >= 59) {
        const recentBars = [];
        for (let bi = dateIdx - 59; bi <= dateIdx; bi++) {
          const bd = allKeys[bi], bb = priceHistory[bd];
          if (bb) recentBars.push({ date: bd, open: bb.open, high: bb.high, low: bb.low, close: bb.close, volume: 0 });
        }
        if (recentBars.length >= 60) {
          const bearish = detectBearishExit(recentBars);
          if (bearish) {
            status = bar.close >= entryPrice ? 'trail' : 'sl';
            exitDate = date; exitPrice = bar.close; break;
          }
        }
      }
    }

    // Check TP2 (only when real tp2 set and not disabled — no synthetic fallback)
    if (!disableTP2 && actualTp2 !== null && bar.high >= actualTp2) {
      status = 'tp2';
      exitDate = date;
      exitPrice = actualTp2;
      break;
    }

    // v3 gain-based partial TP (systematic-tss: sell 30% at +10%, let rest ride)
    if (partialTPGain > 0 && partialRealized === 0) {
      const currentGain = (bar.high - entryPrice) / entryPrice * 100;
      if (currentGain >= partialTPGain) {
        const tpFrac = partialTPPct * 100;
        partialRealized = (partialTPGain / 100) * tpFrac;
        partialTriggerDay = daysHeld;
        // DO NOT snap stop to entry immediately — 3-day grace before BE lock
      }
    }
    // BE lock after partial TP: wait 3 days to avoid instant breakeven trap
    if (partialRealized > 0 && !trailingStop && typeof partialTriggerDay === 'number') {
      if (daysHeld - partialTriggerDay >= 3 && entryPrice > currentStop) {
        currentStop = entryPrice;
      }
    }

    // Check TP1 (original logic — only fires when no gain-based partial TP is configured)
    if (partialTPGain <= 0 && bar.high >= actualTp1 && partialRealized === 0) {
      if (partialTP) {
        const tpFrac = partialTPPct * 100;
        partialRealized = ((actualTp1 - entryPrice) / entryPrice) * tpFrac;
        partialTriggerDay = daysHeld;
      } else {
        status = 'tp1';
        exitDate = date;
        exitPrice = actualTp1;
        break;
      }
    }

    // Trailing stop: trail from high at trailMultR × riskPerUnit
    // When partialTP is disabled (partialTPGain=0 && !partialTP), trail activates unconditionally
    // after grace period. When partialTP is enabled, trail gates on partialRealized > 0.
    const trailGated = (partialTPGain > 0 || partialTP) ? partialRealized > 0 : true;
    if (trailingStop && trailGated && daysHeld > trailGraceDays) {
      const trailLevel = bar.high - riskPerUnit * trailMultR;
      if (trailLevel > currentStop) currentStop = trailLevel;
    }

    // Daily trailing stop: move stop up based on highest close seen
    // Grace period: don't trail until position held beGraceDays
    if (dailyTrailPct > 0 && daysHeld > beGraceDays) {
      const trailLevel = bar.close * (1 - dailyTrailPct / 100);
      if (trailLevel > currentStop) currentStop = trailLevel;
    }

    // Breakeven stop: after +X% gain, move stop to entry (no loss possible)
    // Grace period: don't activate until position held beGraceDays
    if (breakevenPct > 0 && !breakevenActivated && daysHeld > beGraceDays) {
      const currentGain = (bar.high - entryPrice) / entryPrice * 100;
      if (currentGain >= breakevenPct) {
        breakevenActivated = true;
        if (entryPrice > currentStop) currentStop = entryPrice;
      }
    }

    // Stale tightening: after grace days without new high, progressively raise stop
    // v3: log/sqrt/quadratic acceleration (systematic-tss inspired)
    if (_staleGrace > 0) {
      if (bar.high > highWaterMark) {
        highWaterMark = bar.high;
        daysSinceNewHigh = 0;
      } else {
        daysSinceNewHigh++;
      }
      if (daysSinceNewHigh >= _staleGrace) {
        const excess = daysSinceNewHigh - _staleGrace + 1;
        const accelMult = _staleAccel === 'log' ? Math.log(excess + 1)
          : _staleAccel === 'quadratic' ? excess * excess * 0.1
          : _staleAccel === 'sqrt' ? Math.sqrt(excess)
          : excess;
        const staleRaise = accelMult * _staleRate * entryPrice;
        const tightenedStop = currentStop + staleRaise;
        if (tightenedStop > currentStop && tightenedStop < bar.close) currentStop = tightenedStop;
      }
    }
  }

  // Expired or pending (not enough forward data yet)
  if (status === 'open') {
    const lastDate = sortedDates[sortedDates.length - 1];
    const expireBar = priceHistory[lastDate];
    if (!expireBar) return null;
    if (lastDate < expireDate) {
      // Check if price data has clearly ended (delisted/no data for >10 biz days)
      // If so, resolve to terminal status instead of leaving as phantom "pending"
      const today = new Date().toISOString().slice(0, 10);
      const gapDays = DF.daysBetween(lastDate, today);
      if (gapDays > 10) {
        // Price data ended — resolve based on P&L
        exitDate = lastDate;
        exitPrice = expireBar.close;
        const rawPnl = (exitPrice - entryPrice) / entryPrice;
        if (partialRealized > 0) status = 'tp1_partial';
        else if (Math.abs(rawPnl) < 0.005) status = 'breakeven';  // <0.5% = breakeven
        else if (rawPnl > 0) status = 'expired';
        else status = 'sl';
      } else {
        // Mark-to-market at last available bar — gen-status-page shows as open position
        status = 'pending';
        exitDate = null;
        exitPrice = expireBar.close;
      }
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
    vwap: vwapRef ? +vwapRef.toFixed(4) : null, // previous day typical price (no-lookahead reference)
    status,
    exitDate,
    exitPrice,
    pnlPct: +(pnlPct * 100).toFixed(2),
    holdDays: daysHeld,
    source: setup.source || 'signals',
  };
}

// ─── Stats from a flat closed-trade list (append-only mode) ──────────────────
// Computes returnTotal, maxDD, winRate, profitFactor, equityCurve from a
// pre-existing list of trades (resolved + pending/open).
// Daily MtM equity curve: realized P&L from closed trades + unrealized from
// open positions at each business day's close (via priceCache).
// Trades must have: pnlPct, exitDate, scanDate, status, holdDays, actualEntry.
// Uses configVersion on each trade to look up the correct weight from config history.
function computeStatsFromTrades(closedTrades, portfolioSize, positionSizePct, modeId, calendar, opts = {}) {
  const DF = dayFnsFor(calendar);
  const allTrades = (closedTrades || []).filter(t => t.actualEntry > 0);
  if (allTrades.length === 0) return null;
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
  const resolved = allTrades.filter(t => {
    const base = (t.status || '').replace(/_amb$/, '');
    return RESOLVED_STATUSES.includes(base);
  });
  const pendingTrades = allTrades.filter(t => t.status === 'pending')
    .sort((a, b) => {
      // Injected (real broker positions) always take priority over sim2 artifacts
      if (a._injected && !b._injected) return -1;
      if (!a._injected && b._injected) return 1;
      return (a.scanDate || '').localeCompare(b.scanDate || '');
    });

  if (resolved.length === 0 && pendingTrades.length === 0) return null;

  // ─── Daily MtM equity curve: realized + unrealized at each biz day close ───
  const allDates = [
    ...resolved.flatMap(t => [t.scanDate, t.entryDate, t.exitDate]),
    ...pendingTrades.flatMap(t => [t.scanDate, t.entryDate, t.exitDate]),
  ].filter(Boolean).sort();
  const firstDate = allDates[0];
  // Use last available price date (not today) to avoid zero-unrealized tail
  // when Yahoo data hasn't arrived yet for the current day.
  const lastTradeDate = allDates[allDates.length - 1];
  let lastPriceDate = '';
  const allMtmTickers = [...new Set([...pendingTrades.map(t => t.ticker), ...resolved.map(t => t.ticker)])];
  for (const ticker of allMtmTickers) {
    const hist = priceCache[ticker];
    if (hist) {
      const dates = Object.keys(hist).sort();
      if (dates.length > 0 && dates[dates.length - 1] > lastPriceDate) {
        lastPriceDate = dates[dates.length - 1];
      }
    }
  }
  // Clamp to today — never extend the equity curve into future dates
  const todayClamp = new Date().toISOString().slice(0, 10);
  if (lastPriceDate > todayClamp) lastPriceDate = todayClamp;
  const endDate = lastPriceDate || lastTradeDate;

  const allDays = DF.allDays(firstDate, endDate);
  const sortedResolved = [...resolved].sort((a, b) => (a.exitDate || '').localeCompare(b.exitDate || ''));

  let realizedPnl = 0;
  let resolvedIdx = 0;
  let peak = 100, maxDD = 0;
  const equityCurve = [];
  const lastKnownClose = {};

  // Append-only: if prior equity curve provided, copy frozen points and fast-forward
  const priorEC = opts.priorEC || [];
  let appendAfter = '';
  if (priorEC.length > 0) {
    for (const pt of priorEC) {
      equityCurve.push(pt);
      if (pt.value > peak) peak = pt.value;
      const dd = ((peak - pt.value) / peak) * 100;
      if (dd > maxDD) maxDD = dd;
    }
    appendAfter = priorEC[priorEC.length - 1].date;
    // Fast-forward realized PnL and resolvedIdx to match the frozen point
    for (let i = 0; i < sortedResolved.length; i++) {
      if (sortedResolved[i].exitDate <= appendAfter) {
        realizedPnl += (sortedResolved[i].pnlPct || 0) * getWeight(sortedResolved[i], modeId || '');
        resolvedIdx = i + 1;
      }
    }
  }

  function getClose(ticker, day) {
    const hist = priceCache[ticker];
    if (hist && hist[day]) {
      lastKnownClose[ticker] = hist[day].close;
      return hist[day].close;
    }
    return lastKnownClose[ticker] || null;
  }

  for (const day of allDays) {
    if (appendAfter && day <= appendAfter) continue;
    // Accumulate realized from trades closing on or before this day
    while (resolvedIdx < sortedResolved.length && sortedResolved[resolvedIdx].exitDate <= day) {
      realizedPnl += (sortedResolved[resolvedIdx].pnlPct || 0) * getWeight(sortedResolved[resolvedIdx], modeId || '');
      resolvedIdx++;
    }

    // Unrealized: resolved trades not yet closed + pending trades
    let unrealizedPnl = 0;

    // Resolved trades entered but not yet exited as of this day
    // Cap at portfolioSize to prevent inflated equity when FROZEN_ONLY merges
    // overlapping old + new trades (e.g. 23 positions at 10% each = 230% exposure)
    let resolvedExposure = 0;
    const maxExposure = (1 / portfolioSize) * (positionSizePct || 1) * portfolioSize; // = positionSizePct (1.0)
    for (let i = resolvedIdx; i < sortedResolved.length; i++) {
      const t = sortedResolved[i];
      const entryDay = t.entryDate || t.scanDate;
      if (entryDay && entryDay <= day && t.actualEntry > 0) {
        const w = getWeight(t, modeId || '');
        if (resolvedExposure + w > maxExposure + 1e-9) continue;
        const close = getClose(t.ticker, day);
        if (close) {
          resolvedExposure += w;
          unrealizedPnl += ((close - t.actualEntry) / t.actualEntry) * 100 * w;
        }
      }
    }

    // Pending trades (still open) — cap total unrealized exposure at 1.0 (100% capital)
    let pendingExposure = 0;
    for (const t of pendingTrades) {
      const w = getWeight(t, modeId || '');
      if (pendingExposure + w > 1.0 + 1e-9) continue;
      const entryDay = t.entryDate || t.scanDate;
      if (entryDay && entryDay <= day && t.actualEntry > 0) {
        const close = getClose(t.ticker, day);
        if (close) {
          pendingExposure += w;
          unrealizedPnl += ((close - t.actualEntry) / t.actualEntry) * 100 * w;
        }
      }
    }

    const dailyEquity = 100 + realizedPnl + unrealizedPnl;
    equityCurve.push({ date: day, value: +dailyEquity.toFixed(2) });

    if (dailyEquity > peak) peak = dailyEquity;
    const dd = ((peak - dailyEquity) / peak) * 100;
    if (dd > maxDD) maxDD = dd;
  }

  // Keep ALL business days in equity curve — flat days are real (capital idle, no trade)

  const returnTotal = equityCurve.length > 0
    ? +(equityCurve[equityCurve.length - 1].value - 100).toFixed(2) : 0;
  const returnRealized = +realizedPnl.toFixed(2);
  const returnUnrealized = +(returnTotal - returnRealized).toFixed(2);

  // WR, PF — from resolved trades only (unrealized don't count)
  const wins = resolved.filter(t => (t.pnlPct || 0) > 0);
  const losses = resolved.filter(t => (t.pnlPct || 0) <= 0);
  const winRate = resolved.length ? +((wins.length / resolved.length) * 100).toFixed(1) : 0;
  const grossWin = wins.reduce((s, t) => s + t.pnlPct, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));
  const profitFactor = grossLoss > 0 ? +(grossWin / grossLoss).toFixed(2) : grossWin > 0 ? 99 : 0;

  // Risk-adjusted return metrics
  const returnDDRatio = maxDD > 0 ? +(returnTotal / maxDD).toFixed(2) : returnTotal > 0 ? 99 : 0;

  // True Sharpe ratio from daily MtM returns
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

  const dayCount = allDays.length || 1;
  const annReturn = returnTotal * (252 / dayCount);
  const calmar = maxDD > 0 ? +(annReturn / maxDD).toFixed(2) : 0;

  return {
    returnTotal,
    returnRealized,
    returnUnrealized,
    maxDD: +(-maxDD).toFixed(2),
    winRate,
    profitFactor,
    trades: resolved.length,
    calmar,
    sharpe,
    returnDDRatio,
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
    excludeSources = null, // e.g. ['tkl_pool'] — skip candidates whose source matches
  } = config;
  const excludeSet = excludeSources && excludeSources.length ? new Set(excludeSources) : null;
  // v8.3 blacklist — serial losers excluded at portfolio level
  const _blSet = config.blacklist && config.blacklist.length
    ? new Set(config.blacklist.map(t => t.toUpperCase())) : null;
  // Calendar selector (equity biz-day default; crypto/forex calendar-day via config.calendar)
  const DF = dayFnsFor(config.calendar);

  // Group trades by scan date; capture per-date regime as canonical source-of-truth
  // Strategy filter is deferred to per-date level for regime-aware filter switching
  const byDate = {};
  const regimeByDate = {};
  const regimeScoreByDate = {};
  for (const t of allTrades) {
    if (t.score < minScore) continue;
    if (excludeSet && excludeSet.has(t.source || 'signals')) continue;
    if (!byDate[t.scanDate]) byDate[t.scanDate] = [];
    byDate[t.scanDate].push(t);
    if (t.regime && !regimeByDate[t.scanDate]) regimeByDate[t.scanDate] = t.regime;
    if (t.regimeScore != null && regimeScoreByDate[t.scanDate] == null) regimeScoreByDate[t.scanDate] = t.regimeScore;
  }
  // Trend-aware regime-score override: precompute, per scan date, the trailing max score.
  // The override de-risks only on genuine DETERIORATION (score low AND falling from a
  // recent high) — so stable moderate-score rally days keep their momentum upside, while
  // a sharp decline (e.g. June 2026: 58→47→41 under a lagging RISK-ON label) flips defensive.
  const _scoredDates = Object.keys(regimeScoreByDate).filter(d => regimeScoreByDate[d] != null).sort();
  const _norm = v => (v != null && v <= 1 ? v * 100 : v);
  function regimeScoreDowngrade(day) {
    const ov = config.regimeScoreOverride;
    if (!ov) return null;
    const sc = _norm(regimeScoreByDate[day]);
    if (sc == null) return null;
    // Config forms: true → defaults; number → absolute floor only; object → {floor, drop, lookback}.
    const floor = typeof ov === 'object' ? (ov.floor ?? 55) : (typeof ov === 'number' ? ov : 55);
    const drop = typeof ov === 'object' ? (ov.drop ?? 8) : 0;     // 0 ⇒ pure absolute-floor mode
    const lookback = typeof ov === 'object' ? (ov.lookback ?? 4) : 0;
    if (sc >= floor) return null;
    if (drop > 0) {
      const idx = _scoredDates.indexOf(day);
      if (idx < 0) return null;
      let recentMax = sc;
      for (let i = Math.max(0, idx - lookback); i < idx; i++) {
        const v = _norm(regimeScoreByDate[_scoredDates[i]]);
        if (v != null && v > recentMax) recentMax = v;
      }
      if (recentMax - sc < drop) return null; // not deteriorating enough → trust the label
    }
    return scoreToRegime(sc);
  }

  // Build portfolio: track open positions day by day
  const openPositions = []; // { trade, weight }
  // Seed with existing open positions from prior FROZEN_ONLY runs to prevent over-allocation
  if (config.initialPositions && config.initialPositions.length > 0) {
    openPositions.push(...config.initialPositions);
  }
  const closedTrades = [];
  const slCooldown = new Map(); // ticker → exitDate (10 biz day re-entry ban after SL)
  // v3 circuit breaker (systematic-tss inspired): pause entries after stop streak
  const cbStopDates = []; // dates of SL events for circuit breaker window
  // Seed CB history from existing trades (FROZEN_ONLY sim2 fix — without this,
  // sim2 starts with empty cbStopDates and never triggers the circuit breaker)
  if (config.initialCBHistory && config.initialCBHistory.length > 0) {
    cbStopDates.push(...config.initialCBHistory);
  }
  const cbMaxStops = config.circuitBreakerStops || 0; // 0 = disabled
  const cbWindowDays = config.circuitBreakerWindow || 5;
  const cbPauseDays = config.circuitBreakerPause || 3;
  // Pre-compute cbPauseUntil from seeded history so sim2 starts with CB already
  // active if existing trades already exceeded the SL threshold
  let cbPauseUntil = null;
  if (cbMaxStops > 0 && cbStopDates.length >= cbMaxStops) {
    const sorted = [...cbStopDates].sort();
    for (let i = sorted.length - 1; i >= 0; i--) {
      const windowStart = DF.addDays(sorted[i], -cbWindowDays);
      const recentStops = sorted.filter(d => d >= windowStart && d <= sorted[i]).length;
      if (recentStops >= cbMaxStops) {
        cbPauseUntil = DF.addDays(sorted[i], cbPauseDays);
        break;
      }
    }
  }
  const allScanDates = Object.keys(byDate).sort();
  if (allScanDates.length === 0) return null;

  // Get date range for daily equity curve
  const startDate = allScanDates[0];
  const endDate = allScanDates[allScanDates.length - 1];
  const allDays = DF.allDays(startDate, DF.addDays(endDate, horizonDays));

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
      if (pos.trade.exitDate && pos.trade.exitDate <= day && pos.trade.status !== 'pending') {
        if (!pos.trade._phantom) {
          if (pos.trade.status !== 'pending') realizedPnl += pos.trade.pnlPct * (pos.weight ?? weight);
          closedTrades.push(pos.trade);
        }
        // Cooldown: SL=10d, breakeven=5d, expired/rotated=3d re-entry ban
        if (pos.trade.status === 'sl') {
          slCooldown.set(pos.trade.ticker, { date: pos.trade.exitDate, days: 10 });
        } else if (pos.trade.status === 'breakeven') {
          slCooldown.set(pos.trade.ticker, { date: pos.trade.exitDate, days: 5 });
        } else if (['expired', 'rotated'].includes(pos.trade.status)) {
          slCooldown.set(pos.trade.ticker, { date: pos.trade.exitDate, days: 3 });
        }
        if (pos.trade.status === 'sl') {
          // v3 circuit breaker: track SL events
          if (cbMaxStops > 0) {
            cbStopDates.push(day);
            const windowStart = DF.addDays(day, -cbWindowDays);
            const recentStops = cbStopDates.filter(d => d >= windowStart).length;
            if (recentStops >= cbMaxStops) {
              cbPauseUntil = DF.addDays(day, cbPauseDays);
            }
          }
        }
      } else {
        stillOpen.push(pos);
      }
    }
    openPositions.length = 0;
    openPositions.push(...stillOpen);

    // ─── On scan dates: rotation + new entries ────────────────────────
    if (scanDateSet.has(day)) {
      // Config-version-aware entry: scans STRICTLY BEFORE the current config's effective date
      // were traded under the PRIOR config — re-sim them with the prior filter so a forward-only
      // config change never retroactively rewrites realized history (the displayed return must
      // not move when only future trading is affected). Gated by config._effectiveFrom, which is
      // set ONLY by the frozen re-sim path → validator / live executor / other modes unaffected.
      const _preChange = config._effectiveFrom && day < config._effectiveFrom;
      const _baseFilter = (_preChange && config._priorStrategyFilter) ? config._priorStrategyFilter : strategyFilter;
      const _rf = (_preChange && config._priorRegimeFilters) ? config._priorRegimeFilters : config.regimeFilters;
      // Forward-only capacity change: a portfolioSize/topN increase (e.g. Fortress 4→10) must NOT
      // retroactively backfill phantom positions on pre-change scans. Before _effectiveFrom, cap
      // slots + entries at the PRIOR capacity so history reflects what was actually tradeable then.
      const _pfSize = (_preChange && config._priorPortfolioSize) ? config._priorPortfolioSize : portfolioSize;
      const _topN = (_preChange && config._priorTopN) ? config._priorTopN : topN;
      // Regime-aware strategy filter: override filter based on scan date's regime
      let activeFilter = _baseFilter;
      // Effective regime = label, optionally downgraded by the regime-score override
      // (proactive de-risk: when the numeric score has deteriorated below what the label
      // implies, treat the day as the MORE DEFENSIVE regime — the "parachute" that would
      // have kept momentum-heavy modes out of the June correlated cluster).
      let effectiveRegimeKey = null;
      if (regimeByDate[day]) effectiveRegimeKey = normalizeRegime(regimeByDate[day]);
      const scoreRegime = regimeScoreDowngrade(day);
      if (scoreRegime) {
        effectiveRegimeKey = effectiveRegimeKey
          ? moreDefensiveRegime(effectiveRegimeKey, scoreRegime)
          : scoreRegime;
      }
      if (_rf && effectiveRegimeKey) {
        const overrideName = _rf[effectiveRegimeKey];
        if (overrideName && STRATEGY_FILTERS_MAP[overrideName]) {
          activeFilter = STRATEGY_FILTERS_MAP[overrideName];
        }
      }
      // Apply strategy filter per date (deferred from global loop for regime awareness)
      // Candlestick vol ratio trading filter: scanner detects at 1.0×,
      // but only 8× volume spikes enter the portfolio (matches Go AB portfolio config)
      const candleVolMin = scannerFilters?.candlestick?.min_vol_ratio_trading ?? 8.0;
      const filtered = (byDate[day] || [])
        .filter(t => !activeFilter.has(t.strategy))
        .filter(t => t.strategy !== 'candlestick' || (t.pattern && t.pattern.volRatio >= candleVolMin))
        // Per-mode Sharia mandate (e.g. Fortress = PM Halal): exclude non-compliant tickers via
        // explicit flag + known-haram ticker list + mapped haram sector (catches NNI/Nelnet finance
        // and ING even when the scan tagged them sharia:null).
        .filter(t => !config.shariaOnly || !isHaramForHalalMode(t))
        // Per-mode universe restriction (casablanca=BVC, highvol=americanbull, etf=etf): only trade
        // signals tagged with the mode's universe. Without this, casablanca (empty BVC pool) leaked
        // US adaptive_fractal stocks (SAH/SNA) into a Bourse-de-Casablanca mode.
        .filter(t => !config.universeFilter || (t.universe || '') === config.universeFilter)
        .sort((a, b) => b.score - a.score);
      // Defer topN slicing until after cooldown/dedup checks — ensures the best
      // ELIGIBLE candidates are picked, not just the top N before filtering.
      let slotsAvailable = _pfSize - openPositions.length;

      // Build eligible candidates: apply cooldown, dedup, and topN AFTER filtering
      const candidates = filtered.slice(0, _topN * 3); // generous pool for cooldown filtering

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
              if (!worst.trade._phantom) {
                realizedPnl += forcePnl * (worst.weight ?? weight);
                closedTrades.push({ ...worst.trade, status: 'rotated', exitDate: day, pnlPct: +forcePnl.toFixed(2) });
              }
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
      // v3 circuit breaker — pause new entries after stop streak
      const cbActive = cbPauseUntil && day < cbPauseUntil;

      // DD circuit breaker — uses *prior-day close* equity to avoid same-day mark bias
      // v8.3 adaptiveDrawdown: profit-aware threshold that widens as equity grows
      let ddBreakerActive = false;
      if (config.ddBreakerPct && equityCurve.length >= 2) {
        let peakSoFar = 100;
        for (let i = 0; i < equityCurve.length - 1; i++) {
          if (equityCurve[i].value > peakSoFar) peakSoFar = equityCurve[i].value;
        }
        const priorClose = equityCurve[equityCurve.length - 2].value;
        const currentDD = ((peakSoFar - priorClose) / peakSoFar) * 100;
        let effectiveDDPct = config.ddBreakerPct;
        if (config.adaptiveDrawdown) {
          const ad = config.adaptiveDrawdown;
          const profitPct = Math.max(0, priorClose - 100); // cumulative profit from baseline
          const cushion = profitPct * (ad.cushion || 0.05);
          effectiveDDPct = Math.min(ad.max || 15, Math.max(ad.min || config.ddBreakerPct, (ad.base || config.ddBreakerPct) + cushion));
        }
        ddBreakerActive = currentDD > effectiveDDPct;
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
        if (vixKill || ddBreakerActive || cbActive) break; // halt new entries
        if (openTickers.has(cand.ticker)) continue;
        // v8.3 blacklist — serial losers excluded from candidate pool
        if (_blSet && _blSet.has((cand.ticker || '').toUpperCase())) continue;
        // Exit cooldown — re-entry ban after SL (10d), breakeven (5d), expired/rotated (3d)
        const cooldown = slCooldown.get(cand.ticker);
        if (cooldown) {
          const cd = typeof cooldown === 'string' ? { date: cooldown, days: 10 } : cooldown;
          if (DF.daysBetween(cd.date, day) < cd.days) continue;
        }
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
          if (rho != null && rho > config.correlationCap) continue;
        }
        // BTC-beta single-cluster guard (v8.8 crypto, analog of v8.7 equity cluster fix).
        // Gated by config.btcBetaCap: crypto mode sets 1.5; equity modes leave it unset
        // (0/undefined) → this whole block is skipped → equity parity preserved.
        // Reject a candidate whose 60d beta to BTC exceeds the cap, or whose addition
        // would push the portfolio's aggregate BTC-beta past portfolioSize*btcBetaCap.
        if (config.btcBetaCap > 0) {
          const candBeta = betaToBTC(cand.ticker, 60);
          if (candBeta != null) {
            if (candBeta > config.btcBetaCap) continue;
            let aggBeta = 0;
            for (const pos of openPositions) {
              const b = betaToBTC(pos.trade.ticker, 60);
              if (b != null) aggBeta += b;
            }
            if (aggBeta + candBeta > portfolioSize * config.btcBetaCap) continue;
          }
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
    if (pos.trade._phantom) continue;
    if (pos.trade.pnlPct != null && pos.trade.status !== 'pending') {
      realizedPnl += pos.trade.pnlPct * (pos.weight ?? weight);
    }
    closedTrades.push(pos.trade);
  }
  // MtM-inclusive: returnTotal reflects realized + unrealized (matches equity curve)
  const equity = 100 + returnRealized + returnUnrealized;

  // Compute metrics
  const values = equityCurve.map(d => d.value);
  const returnTotal = +(equity - 100).toFixed(2);

  // Max drawdown (from daily MtM curve)
  let peak = 100, maxDD = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    const dd = peak > 0 ? ((peak - v) / peak) * 100 : 0;
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
    closedTrades: closedTrades.map(t => ({
      ticker: t.ticker, strategy: t.strategy, score: t.score,
      scanDate: t.scanDate, entryDate: t.entryDate, exitDate: t.exitDate || null,
      actualEntry: t.actualEntry, exitPrice: t.exitPrice,
      status: t.status, pnlPct: t.pnlPct, holdDays: t.holdDays || 0,
      actualStop: t.actualStop || null, actualTp1: t.actualTp1 || null, actualTp2: t.actualTp2 || null,
      regime: t.regime || null,
      source: t.source || 'signals',
      entryTime: t.entryDate ? '09:30' : null,
      exitTime: t.exitDate ? (['expired','pending'].includes(t.status) ? '16:00' : t.status === 'rotated' ? '09:30' : ['sl'].includes(t.status) ? '10:00' : ['tp1','tp1_partial'].includes(t.status) ? '11:00' : ['tp2'].includes(t.status) ? '13:00' : ['breakeven','trail'].includes(t.status) ? '14:00' : '16:00') : null,
    })),
  };
}

// ─── Rolling window stats for advisor constraints ────────────────────────────
const ROLLING_WINDOW_DAYS = 20;

function computeRollingStats(metrics, windowDays) {
  const ec = metrics.equityCurve;
  if (!ec || ec.length < windowDays + 1) return null;
  const startIdx = ec.length - windowDays;
  const startVal = ec[startIdx].value;
  const endVal = ec[ec.length - 1].value;
  const rollReturn = startVal > 0 ? ((endVal / startVal) - 1) * 100 : 0;
  let peak = startVal, maxDD = 0;
  for (let i = startIdx; i < ec.length; i++) {
    if (ec[i].value > peak) peak = ec[i].value;
    if (peak > 0) {
      const dd = ((peak - ec[i].value) / peak) * 100;
      if (dd > maxDD) maxDD = dd;
    }
  }
  const cutoffDate = ec[startIdx].date;
  const ct = (metrics.closedTrades || []).filter(t => t.exitDate && t.exitDate >= cutoffDate);
  const w = ct.filter(t => (t.pnlPct || 0) > 0);
  const l = ct.filter(t => (t.pnlPct || 0) <= 0);
  const wr = ct.length >= 2 ? (w.length / ct.length) * 100 : -1;
  const gw = w.reduce((s, t) => s + (t.pnlPct || 0), 0);
  const gl = Math.abs(l.reduce((s, t) => s + (t.pnlPct || 0), 0));
  const pf = gl > 0 ? gw / gl : gw > 0 ? 99 : 0;
  return { returnTotal: +rollReturn.toFixed(2), maxDD: +maxDD.toFixed(2), winRate: +wr.toFixed(1), profitFactor: +pf.toFixed(2), trades: ct.length };
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

  console.log(`Parsing ${scanDirs.length} scans... (TKL_POLICY=${TKL_POLICY})`);
  const scans = scanDirs.map(parseScan).filter(Boolean);
  // TKL_POLICY governs whether scanner/.../signals.json#tkl_pool candidates feed the candidate pool.
  // off: published Top 10 only.
  // hybrid: Top 10 + tkl_pool merged (per-mode minScore/regime/sector caps still apply).
  // isolated: identical to hybrid here; non-tkl modes filter source==='tkl_pool' downstream via simulatePortfolio.
  const includeTklPool = TKL_POLICY !== 'off';
  let allSetups = scans.flatMap(s => {
    const list = s.setups.slice();
    if (includeTklPool) list.push(...(s.tklPool || []));
    // Asset-class pools (crypto/metals/forex); equity modes exclude these via excludeSources.
    list.push(...(s.cryptoPool || []), ...(s.metalsPool || []), ...(s.forexPool || []), ...(s.casablancaPool || []));
    return list.map(t => ({ ...t, scanDate: s.scanDate, dir: s.dir, regime: s.regime, regimeScore: s.regimeScore }));
  });
  const tklPoolCount = allSetups.filter(s => s.source === 'tkl_pool').length;
  const assetCounts = ALL_ASSET_POOL_SOURCES.map(src => `${allSetups.filter(s => s.source === src).length} ${src}`).join(' + ');
  const equityCount = allSetups.filter(s => !s.source || s.source === 'signals').length;
  console.log(`Setup pool composition: ${equityCount} top-10 + ${tklPoolCount} tkl_pool + ${assetCounts}`);
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
  const ALL_PORTFOLIO_SIZES = QUICK ? [1, 3, 5] : [1, 2, 3, 4, 5, 8, 10, 15];
  const PORTFOLIO_SIZES = SWEEP_SHARD >= 0
    ? ALL_PORTFOLIO_SIZES.filter((_, i) => i % SWEEP_SHARDS === SWEEP_SHARD)
    : ALL_PORTFOLIO_SIZES;
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
  const BREAKEVEN_PCTS = [0, 0.5]; // 0 = disabled (v3 uses stale tightening), 0.5% = legacy compat
  // v3 stale params (staleGraceDays, staleRaiseRate, staleAccel) are NOT grid-searched —
  // they're set per-mode in modes-config.json and pre-simulated via the frozen config path.
  // Same for partialTPGain and disableTP2. Grid uses defaults (all disabled).

  // TP_PCTS only matter when partialTP=true, so effective count = (1 + TP_PCTS.length) for TP dimension
  const tpCombos = [[false, 0.5], ...TP_PCTS.map(p => [true, p])]; // [partialTP, partialTPPct]

  const total = PORTFOLIO_SIZES.length * TOP_NS.length * MIN_SCORES.length
    * Object.keys(STRATEGY_FILTERS).length * ROTATIONS.length * HORIZONS.length
    * tpCombos.length * TRAIL_MODES.length * MAX_STOP_PCTS.length * ATR_STOP_MULTS.length
    * DAILY_TRAIL_PCTS.length * BREAKEVEN_PCTS.length * ENTRY_GATE_PCTS.length;
  console.log(`\n=== GRID SEARCH (${total} combinations) ===\n`);

  // Pre-simulate all trades for each unique trade-level config
  const tradesByKey = {};
  const preSimTotal = HORIZONS.length * tpCombos.length * TRAIL_MODES.length
    * MAX_STOP_PCTS.length * ATR_STOP_MULTS.length * DAILY_TRAIL_PCTS.length
    * BREAKEVEN_PCTS.length * ENTRY_GATE_PCTS.length;
  console.log(`Pre-simulating ${preSimTotal} trade sets...`);
  let preSimDone = 0;
  for (const horizon of HORIZONS) {
    for (const [ptp, ptpPct] of tpCombos) {
      for (const trail of TRAIL_MODES) {
        for (const maxStop of MAX_STOP_PCTS) {
          for (const atrMult of ATR_STOP_MULTS) {
            for (const dailyTrail of DAILY_TRAIL_PCTS) {
              for (const bePct of BREAKEVEN_PCTS) {
                for (const entryGate of ENTRY_GATE_PCTS) {
                  const vwapGate = VWAP_GATE_FIXED;
                  const beGrace = 0, staleGrace = 0, staleRate = 0.001, staleAccelV = 'log', ptpGain = 0, noTP2 = false;
                  const trMultR = 1.5, trGrace = 0;
                  const key = `${horizon}_${ptp}_${ptpPct}_${trail}_${maxStop}_${atrMult}_${dailyTrail}_${bePct}_${beGrace}_${staleGrace}_${staleRate}_${staleAccelV}_${ptpGain}_${noTP2}_${entryGate}_${vwapGate}_${trMultR}_${trGrace}`;
                  const trades = [];
                  for (const setup of allSetups) {
                    const history = priceCache[setup.ticker];
                    const result = simulateTrade(setup, setup.scanDate, history, {
                      horizonDays: horizon, partialTP: ptp, partialTPPct: ptpPct, trailingStop: trail,
                      maxStopPct: maxStop, atrStopMult: atrMult, dailyTrailPct: dailyTrail,
                      breakevenPct: bePct, beGraceDays: beGrace,
                      staleGraceDays: staleGrace, staleRaiseRate: staleRate, staleAccel: staleAccelV,
                      partialTPGain: ptpGain, disableTP2: noTP2,
                      entryGatePct: entryGate, vwapGate,
                    });
                    if (result) {
                      trades.push({ ...result, regime: setup.regime || null, regimeScore: setup.regimeScore ?? null, _horizon: horizon, _partialTP: ptp, _ptpPct: ptpPct, _trail: trail, _maxStop: maxStop, _atrMult: atrMult, _dailyTrail: dailyTrail, _bePct: bePct });
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

  // Pre-simulate frozen mode configs that fall outside the grid dimensions
  const FROZEN_CFG_PATH = path.join(ROOT, "data", "modes-config.json");
  if (fs.existsSync(FROZEN_CFG_PATH)) {
    const frozenModes = JSON.parse(fs.readFileSync(FROZEN_CFG_PATH)).modes || {};
    // Skip stopped modes
    for (const id of Object.keys(frozenModes)) {
      if (frozenModes[id].status === 'stopped') delete frozenModes[id];
    }
    let frozenExtra = 0;
    for (const [modeId, cfg] of Object.entries(frozenModes)) {
      const fKey = `${cfg.horizon}_${cfg.partialTP || false}_${cfg.partialTPPct || 0.5}_${cfg.trailingStop || false}_${cfg.maxStopPct || 0}_${cfg.atrStopMult || 0}_${cfg.dailyTrailPct || 0}_${cfg.breakevenPct || 0}_${cfg.beGraceDays || 0}_${cfg.staleGraceDays || 0}_${cfg.staleRaiseRate ?? 0.001}_${cfg.staleAccel || 'log'}_${cfg.partialTPGain || 0}_${cfg.disableTP2 || false}_${cfg.entryGatePct || 0}_${cfg.vwapGate || false}_${cfg.trailMultR ?? 1.5}_${cfg.trailGraceDays ?? 0}`;
      console.log(`  DEBUG ${modeId}: fKey=${fKey} inGrid=${!!tradesByKey[fKey]}`);
      if (!tradesByKey[fKey]) {
        const trades = [];
        for (const setup of allSetups) {
          const history = priceCache[setup.ticker];
          const result = simulateTrade(setup, setup.scanDate, history, {
            horizonDays: cfg.horizon, partialTP: cfg.partialTP || false, partialTPPct: cfg.partialTPPct || 0.5,
            trailingStop: cfg.trailingStop || false, maxStopPct: cfg.maxStopPct || 0, atrStopMult: cfg.atrStopMult || 0,
            dailyTrailPct: cfg.dailyTrailPct || 0, breakevenPct: cfg.breakevenPct || 0, beGraceDays: cfg.beGraceDays || 0,
            staleGraceDays: cfg.staleGraceDays || 0, staleRaiseRate: cfg.staleRaiseRate ?? 0.001,
            staleAccel: cfg.staleAccel || 'log', partialTPGain: cfg.partialTPGain || 0,
            disableTP2: cfg.disableTP2 || false,
            entryGatePct: cfg.entryGatePct || 0, vwapGate: cfg.vwapGate || false,
            trailMultR: cfg.trailMultR ?? 1.5, trailGraceDays: cfg.trailGraceDays ?? 0,
            postWideningRRMin: cfg.postWideningRRMin || 0,
            blacklist: cfg.blacklist || null,
          });
          if (result) trades.push({ ...result, regime: setup.regime || null, regimeScore: setup.regimeScore ?? null });
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
  // Mode advisors — evaluated on ROLLING 20-day window (not full period)
  const advTurbo = [];           // rolling: Ret≥10%, DD≤10%, WR≥45%, rollTrades≥2, fullTrades≥8
  const advDynamic = [];         // rolling: Ret≥8%, DD≤6%, WR≥50%, rollTrades≥2, fullTrades≥10
  const advBalanced = [];        // rolling: Ret≥5%, DD≤4%, WR≥50%, rollTrades≥2, fullTrades≥10
  const advSecured = [];         // rolling: Ret≥3%, DD≤2.5%, WR≥55%, rollTrades≥2, fullTrades≥10
  const advFortress = [];        // rolling: Ret≥2%, DD≤1.5%, WR≥55%, rollTrades≥2, fullTrades≥10
  const advTkl = [];             // rolling: Ret≥4%, DD≤5%, WR≥40%, rollTrades≥5, fullTrades≥30
  const advTurboRelaxed = [];    // relaxed rolling: Ret≥5%, DD≤15%, WR≥40%, rollTrades≥2, fullTrades≥8
  const advDynamicRelaxed = [];  // relaxed rolling: Ret≥5%, DD≤10%, WR≥45%, rollTrades≥2, fullTrades≥10
  const advBalancedRelaxed = []; // relaxed rolling: Ret≥3%, DD≤6%, WR≥45%, rollTrades≥2, fullTrades≥10
  const advSecuredRelaxed = [];  // relaxed rolling: Ret≥1.5%, DD≤3%, WR≥50%, rollTrades≥2, fullTrades≥10
  const advFortressRelaxed = []; // relaxed rolling: Ret≥1%, DD≤2.5%, WR≥50%, rollTrades≥2, fullTrades≥10
  const advTklRelaxed = [];      // relaxed rolling: Ret≥2%, DD≤8%, WR≥35%, rollTrades≥3, fullTrades≥20

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
                          for (const entryGatePct of ENTRY_GATE_PCTS) {
                          const vwapGate = VWAP_GATE_FIXED;
                            const key = `${horizon}_${partialTP}_${partialTPPct}_${trailingStop}_${maxStopPct}_${atrStopMult}_${dailyTrailPct}_${breakevenPct}_0_0_0.001_log_0_false_${entryGatePct}_${vwapGate}`;
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
                                breakevenPct, entryGatePct, vwapGate,
                                ...metrics,
                              };
                              r.composite = (r.returnTotal / 30) + (1 / Math.max(0.5, Math.abs(r.maxDD))) + (r.winRate / 100) + (r.calmar / 10) + (r.profitFactor / 5);
                              insertTop(topBySharpe, r, (a, b) => b.sharpe - a.sharpe);
                              insertTop(topByReturn, r, (a, b) => b.returnTotal - a.returnTotal);
                              insertTop(topByCalmar, r, (a, b) => b.calmar - a.calmar);
                              insertTop(topByComposite, r, (a, b) => b.composite - a.composite);
                              insertTop(topByLowestDD, r, (a, b) => Math.abs(a.maxDD) - Math.abs(b.maxDD));
                              // Mode advisors — rolling 20-day window constraints (recent performance gate)
                              const roll = computeRollingStats(metrics, ROLLING_WINDOW_DAYS);
                              const useRoll = roll && roll.trades >= 2;
                              const rr = useRoll ? roll.returnTotal : r.returnTotal;
                              const rd = useRoll ? roll.maxDD : Math.abs(r.maxDD);
                              const rw = useRoll ? (roll.winRate >= 0 ? roll.winRate : r.winRate) : r.winRate;
                              const rt = useRoll ? roll.trades : r.trades;
                              // Strict targets (scaled for 20-day rolling window)
                              if (rr >= 10 && rd <= 10 && rw >= 45 && rt >= 2 && r.trades >= 8) {
                                insertTop(advTurbo, r, (a, b) => b.returnTotal - a.returnTotal);
                              }
                              if (rr >= 8 && rd <= 6 && rw >= 50 && rt >= 2 && r.trades >= 10) {
                                insertTop(advDynamic, r, (a, b) => b.returnTotal - a.returnTotal);
                              }
                              if (rr >= 5 && rd <= 4 && rw >= 50 && rt >= 2 && r.trades >= 10) {
                                insertTop(advBalanced, r, (a, b) => b.returnTotal - a.returnTotal);
                              }
                              if (rr >= 3 && rd <= 2.5 && rw >= 55 && rt >= 2 && r.trades >= 10) {
                                insertTop(advSecured, r, (a, b) => b.returnTotal - a.returnTotal);
                              }
                              if (rr >= 2 && rd <= 1.5 && rw >= 55 && rt >= 2 && r.trades >= 10) {
                                insertTop(advFortress, r, (a, b) => Math.abs(a.maxDD) - Math.abs(b.maxDD));
                              }
                              if (rr >= 4 && rd <= 5 && rw >= 40 && rt >= 5 && r.trades >= 30) {
                                insertTop(advTkl, r, (a, b) => b.returnTotal - a.returnTotal);
                              }
                              // Near-miss advisors — relaxed rolling constraints
                              if (rr >= 5 && rd <= 15 && rw >= 40 && rt >= 2 && r.trades >= 8) {
                                insertTop(advTurboRelaxed, r, (a, b) => b.returnTotal - a.returnTotal);
                              }
                              if (rr >= 5 && rd <= 10 && rw >= 45 && rt >= 2 && r.trades >= 10) {
                                insertTop(advDynamicRelaxed, r, (a, b) => b.returnTotal - a.returnTotal);
                              }
                              if (rr >= 3 && rd <= 6 && rw >= 45 && rt >= 2 && r.trades >= 10) {
                                insertTop(advBalancedRelaxed, r, (a, b) => b.returnTotal - a.returnTotal);
                              }
                              if (rr >= 1.5 && rd <= 3 && rw >= 50 && rt >= 2 && r.trades >= 10) {
                                insertTop(advSecuredRelaxed, r, (a, b) => b.returnTotal - a.returnTotal);
                              }
                              if (rr >= 1 && rd <= 2.5 && rw >= 50 && rt >= 2 && r.trades >= 10) {
                                insertTop(advFortressRelaxed, r, (a, b) => Math.abs(a.maxDD) - Math.abs(b.maxDD));
                              }
                              if (rr >= 2 && rd <= 8 && rw >= 35 && rt >= 3 && r.trades >= 20) {
                                insertTop(advTklRelaxed, r, (a, b) => b.returnTotal - a.returnTotal);
                              }
                            }

                            tested++;
                            if (tested % 5000 === 0) process.stdout.write(`  ${tested}/${total}\r`);
                          } // end entryGatePct
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
      const wfKey = `${r.horizon}_${r.partialTP}_${r.partialTPPct || 0.5}_${r.trailingStop}_${r.maxStopPct || 0}_${r.atrStopMult || 0}_${r.dailyTrailPct || 0}_${r.breakevenPct || 0}_0_0_0.001_log_0_false_${r.entryGatePct || 0}_${r.vwapGate || false}`;
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
  const fmtR = r => `P${r.portfolioSize} Top${r.topN} Score≥${r.minScore} ${r.filterName} ${r.rotation} H${r.horizon} MaxSt=${r.maxStopPct || 0}% ATR=${r.atrStopMult || 0}x Trail=${r.dailyTrailPct || 0}% TR=${r.trailingStop ? 'Y' : 'N'} BE=${r.breakevenPct || 0}%${r.partialTP ? ' PTP=' + ((r.partialTPPct || 0.5) * 100) + '%' : ''}`;

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

  console.log(`(Rolling ${ROLLING_WINDOW_DAYS}-day window — recent performance gate, ranked by full-period return)\n`);
  console.log('TURBO (roll: Ret≥10%, DD≤10%, WR≥45%, rollTrades≥2, fullTrades≥8):');
  for (const r of advTurbo.slice(0, 10)) {
    console.log(`  ${fmtR(r)}: Ret=${r.returnTotal > 0 ? '+' : ''}${r.returnTotal}% DD=${r.maxDD}% R2=${r.r2.toFixed(3)} WR=${r.winRate}% PF=${r.profitFactor} trades=${r.trades}`);
  }

  console.log('\nDYNAMIC (roll: Ret≥8%, DD≤6%, WR≥50%, rollTrades≥2, fullTrades≥10):');
  for (const r of advDynamic.slice(0, 10)) {
    console.log(`  ${fmtR(r)}: Ret=${r.returnTotal > 0 ? '+' : ''}${r.returnTotal}% DD=${r.maxDD}% R2=${r.r2.toFixed(3)} WR=${r.winRate}% PF=${r.profitFactor} trades=${r.trades}`);
  }

  console.log('\nBALANCED (roll: Ret≥5%, DD≤4%, WR≥50%, rollTrades≥2, fullTrades≥10):');
  for (const r of advBalanced.slice(0, 10)) {
    console.log(`  ${fmtR(r)}: Ret=${r.returnTotal > 0 ? '+' : ''}${r.returnTotal}% DD=${r.maxDD}% R2=${r.r2.toFixed(3)} WR=${r.winRate}% PF=${r.profitFactor} trades=${r.trades}`);
  }

  console.log('\nSECURED (roll: Ret≥3%, DD≤2.5%, WR≥55%, rollTrades≥2, fullTrades≥10):');
  for (const r of advSecured.slice(0, 10)) {
    console.log(`  ${fmtR(r)}: Ret=${r.returnTotal > 0 ? '+' : ''}${r.returnTotal}% DD=${r.maxDD}% R2=${r.r2.toFixed(3)} WR=${r.winRate}% PF=${r.profitFactor} trades=${r.trades}`);
  }

  console.log('\nFORTRESS (roll: Ret≥2%, DD≤1.5%, WR≥55%, rollTrades≥2, fullTrades≥10):');
  for (const r of advFortress.slice(0, 10)) {
    console.log(`  ${fmtR(r)}: Ret=${r.returnTotal > 0 ? '+' : ''}${r.returnTotal}% DD=${r.maxDD}% R2=${r.r2.toFixed(3)} WR=${r.winRate}% PF=${r.profitFactor} trades=${r.trades}`);
  }

  console.log('\n─── NEAR-MISS (relaxed constraints — best achievable) ───\n');

  console.log('TURBO near-miss (roll: Ret≥5%, DD≤15%, WR≥40%, rollTrades≥2, fullTrades≥8):');
  if (advTurboRelaxed.length === 0) console.log('  (none found)');
  for (const r of advTurboRelaxed.slice(0, 5)) {
    console.log(`  ${fmtR(r)}: Ret=${r.returnTotal > 0 ? '+' : ''}${r.returnTotal}% DD=${r.maxDD}% WR=${r.winRate}% PF=${r.profitFactor} trades=${r.trades}`);
  }

  console.log('\nDYNAMIC near-miss (roll: Ret≥5%, DD≤10%, WR≥45%, rollTrades≥2, fullTrades≥10):');
  if (advDynamicRelaxed.length === 0) console.log('  (none found)');
  for (const r of advDynamicRelaxed.slice(0, 5)) {
    console.log(`  ${fmtR(r)}: Ret=${r.returnTotal > 0 ? '+' : ''}${r.returnTotal}% DD=${r.maxDD}% WR=${r.winRate}% PF=${r.profitFactor} trades=${r.trades}`);
  }

  console.log('\nBALANCED near-miss (roll: Ret≥3%, DD≤6%, WR≥45%, rollTrades≥2, fullTrades≥10):');
  if (advBalancedRelaxed.length === 0) console.log('  (none found)');
  for (const r of advBalancedRelaxed.slice(0, 5)) {
    console.log(`  ${fmtR(r)}: Ret=${r.returnTotal > 0 ? '+' : ''}${r.returnTotal}% DD=${r.maxDD}% WR=${r.winRate}% PF=${r.profitFactor} trades=${r.trades}`);
  }

  console.log('\nSECURED near-miss (roll: Ret≥1.5%, DD≤3%, WR≥50%, rollTrades≥2, fullTrades≥10):');
  if (advSecuredRelaxed.length === 0) console.log('  (none found)');
  for (const r of advSecuredRelaxed.slice(0, 5)) {
    console.log(`  ${fmtR(r)}: Ret=${r.returnTotal > 0 ? '+' : ''}${r.returnTotal}% DD=${r.maxDD}% WR=${r.winRate}% PF=${r.profitFactor} trades=${r.trades}`);
  }

  console.log('\nFORTRESS near-miss (roll: Ret≥1%, DD≤2.5%, WR≥50%, rollTrades≥2, fullTrades≥10):');
  if (advFortressRelaxed.length === 0) console.log('  (none found)');
  for (const r of advFortressRelaxed.slice(0, 5)) {
    console.log(`  ${fmtR(r)}: Ret=${r.returnTotal > 0 ? '+' : ''}${r.returnTotal}% DD=${r.maxDD}% WR=${r.winRate}% PF=${r.profitFactor} trades=${r.trades}`);
  }

  console.log();
  }

  // 6a. Shard mode — write only advisor top-K arrays and exit
  if (SHARD_OUT) {
    const shardData = {
      shard: SWEEP_SHARD, portfolioSizes: PORTFOLIO_SIZES, tested,
      topBySharpe: topBySharpe.slice(0, 50), topByReturn: topByReturn.slice(0, 50),
      topByCalmar: topByCalmar.slice(0, 50), topByComposite: topByComposite.slice(0, 50),
      advTurbo: advTurbo.slice(0, 50), advDynamic: advDynamic.slice(0, 50),
      advBalanced: advBalanced.slice(0, 50), advSecured: advSecured.slice(0, 50),
      advFortress: advFortress.slice(0, 50), advTkl: advTkl.slice(0, 50),
      advTurboRelaxed: advTurboRelaxed.slice(0, 50), advDynamicRelaxed: advDynamicRelaxed.slice(0, 50),
      advBalancedRelaxed: advBalancedRelaxed.slice(0, 50), advSecuredRelaxed: advSecuredRelaxed.slice(0, 50),
      advFortressRelaxed: advFortressRelaxed.slice(0, 50), advTklRelaxed: advTklRelaxed.slice(0, 50),
    };
    fs.writeFileSync(SHARD_OUT, JSON.stringify(shardData));
    console.log(`  [shard ${SWEEP_SHARD}] wrote ${tested} combos to ${SHARD_OUT}`);
    return;
  }

  // 6. Save results
  const output = {
    generated_at: new Date().toISOString(),
    version: 2,
    period: { start: '2026-02-15', end: new Date().toISOString().slice(0, 10), scans: scans.length },
    universe: { tickers: tickers.length, total_setups: allSetups.length, fetched: fetchedOK },
    walk_forward: { in_sample_scans: inSampleDates.size, out_sample_scans: outSampleDates.size },
    advisor_rolling_window_days: ROLLING_WINDOW_DAYS,
    grid: {
      portfolio_sizes: PORTFOLIO_SIZES, top_ns: TOP_NS, min_scores: MIN_SCORES,
      horizons: HORIZONS, strategies: Object.keys(STRATEGY_FILTERS),
      rotations: ROTATIONS, tp_modes: TP_MODES, trail_modes: TRAIL_MODES, max_stop_pcts: MAX_STOP_PCTS, atr_stop_mults: ATR_STOP_MULTS, daily_trail_pcts: DAILY_TRAIL_PCTS, breakeven_pcts: BREAKEVEN_PCTS, tp_pcts: TP_PCTS,
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
    advisor_tkl: advTkl[0] || null,
    advisor_turbo_relaxed: advTurboRelaxed[0] || null,
    advisor_dynamic_relaxed: advDynamicRelaxed[0] || null,
    advisor_balanced_relaxed: advBalancedRelaxed[0] || null,
    advisor_secured_relaxed: advSecuredRelaxed[0] || null,
    advisor_fortress_relaxed: advFortressRelaxed[0] || null,
    advisor_tkl_relaxed: advTklRelaxed[0] || null,
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
  const MODES_CFG_PATH = process.env.MODES_CFG_OVERRIDE || path.join(ROOT, "data", "modes-config.json");
  const HISTORY_PATH = path.join(ROOT, "data", "modes-config-history.json");
  const BACKTEST_TRADES_PATH = path.join(ROOT, "data", "backtest-trades.json");
  const frozenTrades = {};
  // Load config version history for trade tagging
  let configHistory = [];
  if (fs.existsSync(HISTORY_PATH)) {
    try { configHistory = JSON.parse(fs.readFileSync(HISTORY_PATH)).versions || []; } catch(e) {}
  }
  function getConfigVersion(scanDate) {
    // Find the config version active at scanDate. Use effectiveFrom (the first scan date a
    // forward-only change applies to) when present, else fall back to the timestamp date —
    // a same-day config change applies to the NEXT session, not the scan already traded.
    let ver = configHistory.length ? configHistory[0].id : 'unknown';
    for (const h of configHistory) {
      const hDate = h.effectiveFrom || (h.timestamp || '').slice(0, 10);
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

  // Load live positions from scanner-positions.json for MtM injection.
  // These are REAL open positions tracked by update-tracking.js — they must
  // contribute to returnUnrealized so stats match the status page.
  const SCANNER_POS_PATH = path.join(ROOT, 'data', 'scanner-positions.json');
  let livePositions = [];
  if (FROZEN_ONLY && fs.existsSync(SCANNER_POS_PATH)) {
    try {
      const spData = JSON.parse(fs.readFileSync(SCANNER_POS_PATH, 'utf8'));
      livePositions = spData.open_positions || [];
      if (livePositions.length > 0) {
        console.log(`\nLoaded ${livePositions.length} live positions for MtM injection`);
        const liveTickers = [...new Set(livePositions.map(p => p.ticker))];
        // Force-refresh ALL live position tickers — bypass 12h TTL cache.
        // Stale cache caused TSM MtM to lag by a full trading day (2026-06-19 incident).
        console.log(`  Force-refreshing ${liveTickers.length} live tickers (bypass cache TTL)...`);
        for (const t of liveTickers) {
          delete priceCache[t];
          const fp = path.join(PRICE_CACHE_DIR, `${t}.json`);
          if (fs.existsSync(fp)) fs.unlinkSync(fp);
          await fetchOHLCV(t);
          await sleep(120);
        }
        // Seed priceCache from scanner-positions.json current_price for dates
        // where Yahoo hasn't delivered a bar yet (entry day = nextBizDay of scan,
        // which may be today or tomorrow depending on timing).
        let seeded = 0;
        for (const p of livePositions) {
          if (!p.current_price || p.current_price <= 0) continue;
          if (!priceCache[p.ticker]) priceCache[p.ticker] = {};
          const entryDay = nextBizDay(p.scan_date);
          if (!priceCache[p.ticker][entryDay]) {
            priceCache[p.ticker][entryDay] = {
              open: p.current_price, high: p.current_price,
              low: p.current_price, close: p.current_price,
            };
            seeded++;
          }
        }
        if (seeded > 0) console.log(`  Seeded ${seeded} tickers with live price for entry day`);
      }
    } catch(e) { console.log('⚠️ Could not load scanner-positions.json:', e.message); }
  }

  if (fs.existsSync(MODES_CFG_PATH)) {
    // TRADE CHAIN INTEGRITY CHECK — abort if historical trades were tampered with
    const chainCheck = verifyTradeChain();
    if (!chainCheck.ok) {
      console.error('🛑 TRADE CHAIN INTEGRITY VIOLATION — aborting sweep. Historical trades were modified.');
      console.error('   Run `node tools/lib/trade-integrity.js verify` for details.');
      console.error('   If this is intentional, run `node tools/lib/trade-integrity.js seal` first.');
      process.exit(1);
    }

    const modesConfig = JSON.parse(fs.readFileSync(MODES_CFG_PATH));
    // Shared scoreboard — modes with crossModeDedup=true skip tickers already picked.
    // Priority order (most conservative first): fortress → secured → balanced → dynamic → turbo.
    // Conservative modes need diversification most, so they consume the candidate pool first.
    const crossModePicked = new Set();
    const DEDUP_PRIORITY = ['fortress', 'secured', 'balanced', 'dynamic', 'turbo'];
    const orderedModeIds = [
      ...DEDUP_PRIORITY.filter(id => modesConfig.modes[id] && modesConfig.modes[id].status !== 'stopped'),
      ...Object.keys(modesConfig.modes).filter(id => !DEDUP_PRIORITY.includes(id) && modesConfig.modes[id].status !== 'stopped'),
    ];
    for (const id of orderedModeIds) {
      const cfg = modesConfig.modes[id];
      const frozenKey = `${cfg.horizon}_${cfg.partialTP || false}_${cfg.partialTPPct || 0.5}_${cfg.trailingStop || false}_${cfg.maxStopPct || 0}_${cfg.atrStopMult || 0}_${cfg.dailyTrailPct || 0}_${cfg.breakevenPct || 0}_${cfg.beGraceDays || 0}_${cfg.staleGraceDays || 0}_${cfg.staleRaiseRate ?? 0.001}_${cfg.staleAccel || 'log'}_${cfg.partialTPGain || 0}_${cfg.disableTP2 || false}_${cfg.entryGatePct || 0}_${cfg.vwapGate || false}_${cfg.trailMultR ?? 1.5}_${cfg.trailGraceDays ?? 0}`;
      // Config-version-aware immutability: if the current config carries an effectiveFrom (a
      // forward-only change), scans BEFORE it were traded under the prior config — re-sim them
      // with the prior entry-filter so a forward change never rewrites realized history. Only
      // engages when the mode's entry filter actually changed; no-op otherwise.
      let _effFrom = null, _priorRF = null, _priorSF = null, _priorPF = null, _priorTN = null;
      if (configHistory.length >= 2) {
        const curVer = configHistory[configHistory.length - 1];
        const priorVer = configHistory[configHistory.length - 2];
        const priorModeCfg = priorVer && priorVer.config && priorVer.config[id];
        if (curVer && curVer.effectiveFrom && priorModeCfg) {
          const priorRF = priorModeCfg.regimeFilters || null;
          const filterChanged = priorModeCfg.filterName !== cfg.filterName;
          const rfChanged = JSON.stringify(priorRF) !== JSON.stringify(cfg.regimeFilters || null);
          const capacityChanged = (priorModeCfg.portfolioSize !== cfg.portfolioSize) || (priorModeCfg.topN !== cfg.topN);
          if (filterChanged || rfChanged || capacityChanged) {
            _effFrom = curVer.effectiveFrom;
            _priorRF = priorRF;
            _priorSF = STRATEGY_FILTERS[priorModeCfg.filterName] || null;
            if (capacityChanged) { _priorPF = priorModeCfg.portfolioSize; _priorTN = priorModeCfg.topN; }
          }
        }
      }
      // Explicit forward-only change declared directly on the mode config (self-documenting, no
      // history dependency). Takes precedence — used when a capacity/filter pivot must NOT backfill
      // phantom positions (e.g. Fortress 4→10 PM Halal transition). See data/modes-config.json.
      if (cfg._effectiveFrom) {
        _effFrom = cfg._effectiveFrom;
        if (cfg._priorFilterName) _priorSF = STRATEGY_FILTERS[cfg._priorFilterName] || _priorSF;
        if (cfg._priorRegimeFilters) _priorRF = cfg._priorRegimeFilters;
        if (cfg._priorPortfolioSize != null) _priorPF = cfg._priorPortfolioSize;
        if (cfg._priorTopN != null) _priorTN = cfg._priorTopN;
      }
      const cfg2 = {
        _effectiveFrom: _effFrom, _priorRegimeFilters: _priorRF, _priorStrategyFilter: _priorSF,
        _priorPortfolioSize: _priorPF, _priorTopN: _priorTN,
        portfolioSize: cfg.portfolioSize, topN: cfg.topN, minScore: cfg.minScore || 0,
        rotation: cfg.rotation, strategyFilter: STRATEGY_FILTERS[cfg.filterName],
        shariaOnly: cfg.shariaOnly === true, // PM Halal mandate (Fortress) — gates candidate selection
        universeFilter: cfg.universeFilter || null, // restrict to a signal universe (casablanca/americanbull/etf)
        btcBetaCap: cfg.btcBetaCap ?? 0, // BTC-beta cluster guard (crypto) — was read but never carried into cfg2
        horizonDays: cfg.horizon, partialTP: cfg.partialTP || false, partialTPPct: cfg.partialTPPct || 0.5,
        trailingStop: cfg.trailingStop || false, positionSizePct: cfg.positionSizePct || 1,
        regimeFilters: cfg.regimeFilters || null,
        regimeScoreOverride: cfg.regimeScoreOverride || false,
        calendar: cfg.calendar || null,
        ddBreakerPct: cfg.ddBreakerPct ?? 0,
        sectorCapMax: cfg.sectorCapMax ?? 0,
        sizingMethod: cfg.sizingMethod || null,
        targetRiskPct: cfg.targetRiskPct ?? 0,
        vixKillThreshold: cfg.vixKillThreshold ?? 0,
        correlationCap: cfg.correlationCap ?? 0,
        crossModeDedup: cfg.crossModeDedup === true,
        crossModePicked,
        circuitBreakerStops: cfg.circuitBreakerStops ?? 0,
        circuitBreakerWindow: cfg.circuitBreakerWindow ?? 5,
        circuitBreakerPause: cfg.circuitBreakerPause ?? 3,
        // v8.3 features
        blacklist: cfg.blacklist || null,
        adaptiveDrawdown: cfg.adaptiveDrawdown || null,
        excludeSources: (() => {
          const excl = [];
          const ownPool = ASSET_POOL_SOURCES[cfg.assetClass]; // crypto_pool / metals_pool / forex_pool, or undefined
          if (ownPool) {
            // Asset-class mode (crypto/metals/forex): trade ONLY its own pool — exclude equity
            // signals, tkl, and every OTHER asset pool.
            excl.push('signals', 'tkl_pool', ...ALL_ASSET_POOL_SOURCES.filter(s => s !== ownPool));
          } else {
            // Equity/other modes NEVER trade asset-class candidates → equity parity preserved.
            excl.push(...ALL_ASSET_POOL_SOURCES);
            if (cfg.tklPoolEnabled === false) excl.push('tkl_pool');
            if (cfg.tklExcludeSignals === true) excl.push('signals');
          }
          return excl.length ? excl : null;
        })(),
      };

      if (FROZEN_ONLY) {
        // Append-only: preserve existing trades, only simulate scans AFTER the latest existing one
        const allExisting = existingTrades[id] || [];
        // statusSince gate: drop trades before mode inception date (e.g. Orbit replacing Secured)
        const sinceISO = cfg.statusSince ? cfg.statusSince.slice(0, 10) : null;
        const sinceCutoff = sinceISO ? sinceISO.replace(/-/g, '') : null;
        const afterSince = sinceISO
          ? allExisting.filter(t => (t.scanDate || '') >= sinceISO)
          : allExisting;
        if (sinceISO && afterSince.length < allExisting.length) {
          console.log(`  ${id}: filtered ${allExisting.length - afterSince.length} trades before statusSince ${sinceISO}`);
        }
        // Purge: pending trades only (always re-simulate with latest data).
        // Never purge closed/expired trades — they were simulated with their original config
        // and changing the current horizon must not retroactively invalidate them.
        const shouldPurge = t => t.status === 'pending' || t.status === 'sim2_artifact';
        const existing = afterSince.filter(t => !shouldPurge(t));
        const purged = afterSince.length - existing.length;
        if (purged > 0) console.log(`  ⚠️ ${id}: purged ${purged} pending/early-expired trades for re-simulation`);
        const latestExistingScan = existing.reduce((max, t) => t.scanDate > max ? t.scanDate : max, '');

        // Include scans after latest valid trade AND scans whose trades were purged
        const purgedDates = new Set(afterSince.filter(shouldPurge).map(t => t.scanDate));
        const modeScans = sinceISO ? scans.filter(s => s.scanDate >= sinceISO) : scans;
        const newScans = latestExistingScan
          ? modeScans.filter(s => s.scanDate > latestExistingScan || purgedDates.has(s.scanDate))
          : modeScans;

        let newClosedTrades = [];
        if (newScans.length > 0) {
          // Build a trade list for only the new scans using the frozen config key
          const allTradesForKey = tradesByKey[frozenKey] || [];
          const newScanDateSet = new Set(newScans.map(s => s.scanDate));
          const newTrades = allTradesForKey.filter(t => newScanDateSet.has(t.scanDate));

          // Seed sim2 with existing positions still open at start of new simulation period.
          // Without this, sim2 starts with empty openPositions and over-allocates slots.
          const firstNewScan = newScans.map(s => s.scanDate).sort()[0];
          const existingOpen = firstNewScan ? existing.filter(t =>
            t.entryDate && t.entryDate < firstNewScan &&
            t.exitDate && t.exitDate >= firstNewScan &&
            t.actualEntry > 0
          ) : [];
          if (existingOpen.length > 0) {
            cfg2.initialPositions = existingOpen.map(t => ({
              trade: { ...t, _phantom: true },
              weight: (1 / (cfg.portfolioSize || 10)) * (cfg.positionSizePct || 1),
            }));
          }

          // Seed circuit breaker with RECENT SL history only (within CB window before
          // the first new scan). Seeding ALL historical SLs would retroactively block
          // entries that were legitimately accepted under the original simulation.
          const cbWin = cfg.circuitBreakerWindow || 5;
          if (firstNewScan && (cfg.circuitBreakerStops || 0) > 0) {
            const dfLocal = dayFnsFor(cfg.calendar);
            const windowStart = dfLocal.addDays(firstNewScan, -(cbWin + 2));
            const slHistory = existing
              .filter(t => t.status === 'sl' && t.exitDate && t.exitDate >= windowStart)
              .map(t => t.exitDate);
            if (slHistory.length > 0) {
              cfg2.initialCBHistory = slHistory;
            }
          }

          if (newTrades.length > 0) {
            const sim2 = simulatePortfolio(newTrades, newScans, cfg2);
            if (sim2 && sim2.closedTrades) {
              newClosedTrades = sim2.closedTrades
                .filter(t => !t._phantom)
                .map(t => ({ ...t, configVersion: getConfigVersion(t.scanDate || t.entryDate) }));
            }
          }
        }

        // Merge: existing trades + new closed trades (deduplicate by scanDate+ticker)
        const existingKey = t => `${t.scanDate}|${t.ticker}`;
        const existingKeys = new Set(existing.map(existingKey));
        const toAppend = newClosedTrades.filter(t => !existingKeys.has(existingKey(t)));
        const merged = [...existing, ...toAppend];

        // Pending trades are now produced by sim2.closedTrades (which already respects
        // portfolioSize, rotation, sector caps). The previous injection from the per-ticker
        // pre-sim list bypassed portfolio constraints — turbo (portfolioSize=1) ended up
        // with 5+ "pending" tickers on the same scan day. Removed.

        merged.sort((a, b) => (a.scanDate || '').localeCompare(b.scanDate || ''));

        // Dedup pending trades by ticker: keep only the most recent scanDate per ticker
        const pendingByTicker = new Map();
        for (let i = merged.length - 1; i >= 0; i--) {
          if (merged[i].status === 'pending') {
            if (pendingByTicker.has(merged[i].ticker)) {
              merged.splice(i, 1);
            } else {
              pendingByTicker.set(merged[i].ticker, true);
            }
          }
        }

        // ── Inject real open positions from scanner-positions.json ──
        // Positions visible on the status page (posFor) must contribute to
        // returnUnrealized so MtM stats match what the user sees.
        if (livePositions.length > 0) {
          const RES_SET = new Set(['tp1','tp1_partial','tp2','sl','expired','rotated','breakeven','trail']);
          const resolvedKeys = new Set(
            merged.filter(t => RES_SET.has((t.status||'').replace(/_amb$/,'')))
              .map(t => `${t.ticker}_${t.scanDate}`)
          );
          const mergedKeys = new Set(merged.map(t => `${t.ticker}_${t.scanDate}`));

          const activeFilter = STRATEGY_FILTERS[cfg.filterName] || new Set();
          const horizonCalDays = Math.ceil(cfg.horizon * 7 / 5) + 2;
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - horizonCalDays);
          const cutoffISO = cutoff.toISOString().slice(0,10);

          const eligible = new Map();
          const exclSources = new Set(cfg2.excludeSources || []);
          for (const scan of scans) {
            if (scan.scanDate < cutoffISO) continue;
            const pool = [...scan.setups];
            if (cfg.tklPoolEnabled !== false) pool.push(...(scan.tklPool || []));
            // Asset-class pools; each mode keeps only its own via exclSources.
            pool.push(...(scan.cryptoPool || []), ...(scan.metalsPool || []), ...(scan.forexPool || []), ...(scan.casablancaPool || []));
            const filtered = pool
              .filter(s => exclSources.size === 0 || !exclSources.has(s.source || 'signals'))
              .filter(s => !activeFilter.has(s.strategy))
              .filter(s => cfg.minScore <= 0 || (s.score || 0) >= cfg.minScore)
              // Per-mode Sharia mandate also gates live-position injection (Fortress = PM Halal):
              // a non-compliant live position (e.g. ING bank, NNI/Nelnet finance) must NOT be injected.
              .filter(s => !cfg.shariaOnly || !isHaramForHalalMode(s))
              // Universe restriction also gates injection (casablanca must not hold US stocks).
              .filter(s => !cfg.universeFilter || (s.universe || '') === cfg.universeFilter)
              .sort((a, b) => (b.score || 0) - (a.score || 0))
              .slice(0, cfg.topN);
            for (const s of filtered) {
              const key = `${s.ticker}_${scan.scanDate}`;
              if (!resolvedKeys.has(key)) eligible.set(key, { ...s, scanDate: scan.scanDate });
            }
          }

          const injected = [];
          const seenTickers = new Set();
          // Pre-seed with tickers already pending in merged (prevent duplicate positions)
          for (const t of merged) {
            if (t.status === 'pending') seenTickers.add(t.ticker);
          }
          const todayISO = new Date().toISOString().slice(0, 10);
          for (const p of livePositions) {
            if (seenTickers.has(p.ticker)) continue;
            const key = `${p.ticker}_${p.scan_date}`;
            const sig = eligible.get(key);
            if (!sig) continue;
            if (mergedKeys.has(key)) continue;
            if (!priceCache[p.ticker]) continue;
            // Skip if mode horizon already expired for this trade
            const modeExpire = dayFnsFor(cfg.calendar).addDays(p.scan_date, cfg.horizon);
            if (modeExpire <= todayISO) continue;
            seenTickers.add(p.ticker);
            // MtM from last cached bar vs actual entry (real position, not simulated)
            const bars = priceCache[p.ticker];
            const lastBarDate = Object.keys(bars).sort().pop();
            const lastClose = bars[lastBarDate]?.close || p.entry;
            const mtmPnl = +((lastClose - p.entry) / p.entry * 100).toFixed(2);
            injected.push({
              ticker: p.ticker, scanDate: p.scan_date,
              entryDate: p.scan_date,
              actualEntry: p.entry, actualStop: p.stop || sig.stop,
              entry: sig.entry, stop: p.stop || sig.stop,
              tp1: p.tp1 || sig.tp1, tp2: p.tp2 || sig.tp2,
              score: sig.score, strategy: sig.strategy,
              status: 'pending', pnlPct: mtmPnl,
              exitDate: null, exitPrice: lastClose,
              holdDays: Object.keys(bars).filter(d => d >= nextBizDay(p.scan_date) && d <= lastBarDate).length,
              source: sig.source || 'signals',
              entryTime: '09:30',
              exitTime: null,
              _injected: true,
            });
          }

          injected.sort((a,b) => b.score - a.score);
          // Cap at REMAINING slots, not portfolioSize: merged already holds the sweep-simulated
          // pending positions. Injecting up to portfolioSize MORE would push total pending past the
          // cap (the balanced 5>3 / momentum 9>5 phantom-position bug). Total open <= portfolioSize.
          const alreadyPending = merged.filter(t => t.status === 'pending').length;
          const remainingSlots = Math.max(0, cfg.portfolioSize - alreadyPending);
          const capped = injected.slice(0, remainingSlots);
          if (capped.length > 0) {
            merged.push(...capped);
            console.log(`  ${id}: injected ${capped.length} live positions as pending for MtM (${alreadyPending} already pending, ${remainingSlots} slots free)`);
          }

        }

        frozenTrades[id] = merged;

        // ═══════════════════════════════════════════════════════════════════
        // IMMUTABLE HISTORY — ABSOLUTE RULE: never rewrite closed trades.
        // The sweep is APPEND-ONLY: new trades extend the equity curve,
        // existing trades and their stats are NEVER recalculated.
        // ═══════════════════════════════════════════════════════════════════
        const existingFrozen = existingResults[`frozen_${id}`];
        const existingTradeCount = (existingTrades[id] || []).filter(t => t.status !== 'pending' && t.status !== 'sim2_artifact').length;
        const mergedClosedCount = merged.filter(t => t.status !== 'pending' && t.status !== 'sim2_artifact').length;

        // HARD GUARD: closed trade count must never decrease
        if (existingFrozen && mergedClosedCount < existingTradeCount) {
          console.error(`  ❌ ${id}: BLOCKED — would lose ${existingTradeCount - mergedClosedCount} closed trades (${existingTradeCount} → ${mergedClosedCount}). History is immutable.`);
          output[`frozen_${id}`] = existingFrozen;
          frozenTrades[id] = existingTrades[id] || merged;
          continue;
        }

        let stats;
        if (existingFrozen) {
          // IMMUTABLE: existing frozen stats are preserved byte-for-byte.
          // New trades are appended to backtest-trades.json but stats are
          // ONLY updated by gen-status-page snapshots, never by sweep recalculation.
          stats = existingFrozen;
          const tag = toAppend.length > 0 ? `${toAppend.length} new trades appended` : 'unchanged';
          console.log(`  ${id} (${cfg.label}): ${merged.length} trades (${tag}), return=${stats.returnTotal}%, DD=${stats.maxDD}% [IMMUTABLE]`);
          output[`frozen_${id}`] = existingFrozen;
          frozenTrades[id] = merged;
          continue;
        }
        // First-time computation only (no existing frozen stats)
        stats = computeStatsFromTrades(merged, cfg.portfolioSize, cfg.positionSizePct || 1, id);
        const isOosSets = (typeof inSampleDates !== 'undefined') ? { inSample: inSampleDates, outSample: outSampleDates } : null;
        const isStats = isOosSets ? computeStatsFromTrades(merged.filter(t => isOosSets.inSample.has(t.scanDate)), cfg.portfolioSize, cfg.positionSizePct || 1, id) : null;
        const oosStats = isOosSets ? computeStatsFromTrades(merged.filter(t => isOosSets.outSample.has(t.scanDate)), cfg.portfolioSize, cfg.positionSizePct || 1, id) : null;
        if (stats) {
          output[`frozen_${id}`] = {
            returnTotal: stats.returnTotal, returnRealized: stats.returnRealized,
            returnUnrealized: stats.returnUnrealized,
            maxDD: stats.maxDD, winRate: stats.winRate,
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
  // Backfill entryTime/exitTime on all trades (including legacy ones lacking them)
  for (const id of Object.keys(frozenTrades)) {
    for (const t of frozenTrades[id]) {
      if (!t.entryTime && t.entryDate) t.entryTime = '09:30';
      if (!t.exitTime && t.exitDate) {
        t.exitTime = ['expired','pending'].includes(t.status) ? '16:00'
          : t.status === 'rotated' ? '09:30'
          : t.status === 'sl' ? '10:00'
          : ['tp1','tp1_partial'].includes(t.status) ? '11:00'
          : t.status === 'tp2' ? '13:00'
          : ['breakeven','trail'].includes(t.status) ? '14:00'
          : '16:00';
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

  // Re-seal the trade chain after writing
  sealTradeChain();


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

module.exports = {
  parseScan, simulateTrade, simulatePortfolio, computeStatsFromTrades,
  fetchOHLCV, priceCache, getSector, normalizeRegime,
  STRATEGY_FILTERS_MAP,
  vixKillTriggered, regimeSizeMultiplier, maxCorrToOpen, betaToBTC,
};

if (require.main === module) {
  main().catch(e => { console.error('Fatal:', e.message, e.stack); process.exit(1); });
}
