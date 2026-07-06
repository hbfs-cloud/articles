#!/usr/bin/env node
'use strict';

/**
 * etf-scanner.js — Regime-Adaptive ETF Momentum Scanner (exact port of systematic-tss)
 *
 * Cluster-based regime-adaptive scanner for ETFs.
 * Detects regime (RISK_OFF/NEUTRAL/RISK_ON/RECOVERY/EARLY_RISK_OFF) and applies
 * cluster-specific filters: mean reversion in bear markets, momentum in bull.
 * Market breadth (SPY/QQQ/IWM above MA50) + VIX ratio for trend.
 *
 * Usage:
 *   node tools/etf-scanner.js --dry-run
 *   node tools/etf-scanner.js --regime recovery --top 10
 *   node tools/etf-scanner.js --output signals --folder 20260629
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const yaml = require('js-yaml');
const {
  calcSMA, calcRSI, calcATR, calcVolatility, calcMomentum,
  calcAvgVolume, calcMedianVolume, calcDollarVolumePercentile,
} = require('./lib/fractal-indicators');
// Cache prix DATÉ, partagé (source unique de vérité). Remplace la logique inline plate
// (data/.price-cache/${ticker}_ohlcv.json sans date) qui polluait les snapshots passés.
// Marché=US, interval=1d pour ce scanner (US + EU passent tous par le pool US Yahoo).
const { readBars, writeBars } = require('./lib/price-cache');

const ROOT = path.join(__dirname, '..');

// ─── Scanner filter params — LOADED from the Go config (resync-friendly) ─────
// Root cause of the etf_eu ISO gap: scoreSymbol() hardcoded the *default* Go
// thresholds (getParamFloat64 defaults in scanner_etf_momentum.go), but the EU
// config OVERRIDES many of them via scanner_filters.params (tuned by backtest).
// We now read scanner_filters (+ .params) straight from the source-of-truth YAML,
// per universe, so the JS port stays aligned automatically when the Go side
// re-tunes. If the systematic-tss repo is absent (e.g. a cloud routine that only
// clones `articles`), we fall back to DEFAULT_PARAMS_{US,EU} — verbatim copies of
// the two configs — so the scanner still runs stand-alone.
//
// Source of truth:
//   US → systematic-tss/config/pre-live/portfolio_etf_us.yaml
//   EU → systematic-tss/config/pre-live/portfolio_etf_eu.yaml
// Both set allocation `pure` (US true = non-leveraged only; EU false = leveraged OK)
// and their own blacklist. These embedded defaults MUST mirror the YAML exactly.

// portfolio_etf_us.yaml → scanner_filters (+ .params). min_score removed in the
// config (per-regime params handle filtering) → treated as 0 here.
const DEFAULT_PARAMS_US = {
  min_price: 10,
  max_atr_ratio: 0.06,
  min_score: 0,
  blacklist: ['BITI', 'VXX', 'VXZ', 'COPJ', 'CTEX'],
  // RISK_ON
  riskon_max_atr: 0.045,
  riskon_min_mom: 0.02,
  riskon_rsi_boost_thresh: 60,
  riskon_rsi_boost_factor: 2.0,
  // RECOVERY
  recovery_max_rsi: 48,
  recovery_max_atr: 0.04,
  recovery_min_mom: 0.03,
  // RISK_OFF
  riskoff_deep_dip_dist: -0.05,
  riskoff_oversold_rsi: 40,
  riskoff_meanrev_rsi: 50,
  // NEUTRAL
  neutral_meanrev_rsi: 40,
  neutral_meanrev_dist: -0.03,
  neutral_lowvol_atr: 0.04,
  neutral_lowvol_mom: 0.05,
  // EARLY_RISK_OFF
  early_riskoff_max_rsi: 25,
  early_riskoff_min_dist: -0.10,
  // EXTREME fallback
  extreme_mom_thresh: 0.15,
  extreme_oversold_rsi: 30,
  extreme_oversold_dist: -0.05,
  extreme_min_dist_ma20: 0.0,
  // extreme_skip_* not set in US config → default 0 (fallback active)
};

// portfolio_etf_eu.yaml → scanner_filters (+ .params). These are the TUNED values
// that the old hardcoded JS ignored (recovery_max_rsi 45, neutral_lowvol_atr 0.035,
// neutral_lowvol_mom 0.08, riskon_min_mom 0.06, riskon_rsi_boost_thresh/factor 70/3,
// early_riskoff_max_rsi 18, extreme_skip_neutral / extreme_skip_early_riskoff 1.0).
const DEFAULT_PARAMS_EU = {
  min_price: 5,
  max_atr_ratio: 0.06,
  min_score: 80,
  blacklist: [
    'ZETH.DE', 'GDXJ.PA', 'BRE.PA', 'IQQH.DE', 'EXV7.DE', 'EXH2.DE', 'EXV2.DE',
    'ZPRR.DE', 'EXV4.DE', 'EXV5.DE', 'EXV6.DE', 'CC1.PA', 'BTC.PA', '3OIL.MI',
    'NUKL.DE', 'BNXG.DE', 'SLVR.DE', 'NGAS.MI', 'VVMX.DE', 'DAXLEV.MI', 'M9SD.DE',
    'GDXJ.MI', 'PHAU.AS', 'WDNA.MI', '3USS.MI', 'XCNA.MI', 'CURE.MI', 'REMX.MI',
  ],
  // RISK_ON
  riskon_max_atr: 0.045,
  riskon_min_mom: 0.06,
  riskon_rsi_boost_thresh: 70,
  riskon_rsi_boost_factor: 3.0,
  // RECOVERY
  recovery_max_rsi: 45,
  recovery_max_atr: 0.04,
  recovery_min_mom: 0.03,
  // RISK_OFF
  riskoff_deep_dip_dist: -0.05,
  riskoff_oversold_rsi: 40,
  riskoff_meanrev_rsi: 50,
  // NEUTRAL
  neutral_meanrev_rsi: 40,
  neutral_meanrev_dist: -0.03,
  neutral_lowvol_atr: 0.035,
  neutral_lowvol_mom: 0.08,
  // EARLY_RISK_OFF
  early_riskoff_max_rsi: 18,
  early_riskoff_min_dist: -0.10,
  // EXTREME fallback
  extreme_mom_thresh: 0.15,
  extreme_oversold_rsi: 30,
  extreme_oversold_dist: -0.05,
  extreme_min_dist_ma20: 0.0,
  extreme_skip_early_riskoff: 1.0,
  extreme_skip_neutral: 1.0,
};

// systematic-tss repo root (configurable via --tss-root / env TSS_ROOT; default
// sibling of the articles repo). Only used to READ the YAML source-of-truth.
function resolveTssRoot() {
  const cli = (() => { const i = process.argv.indexOf('--tss-root'); return i >= 0 ? process.argv[i + 1] : null; })();
  const cand = cli || process.env.TSS_ROOT || path.join(ROOT, '..', 'systematic-tss');
  return cand;
}

// Read scanner_filters (+ .params) from the Go portfolio YAML for the given universe.
// Returns { ...DEFAULTS, ...yamlOverrides }. Falls back to embedded DEFAULTS if the
// file is missing/unparseable (so the scanner is usable without systematic-tss).
function loadScannerParams(isEu) {
  const defaults = isEu ? DEFAULT_PARAMS_EU : DEFAULT_PARAMS_US;
  const rel = isEu ? 'config/pre-live/portfolio_etf_eu.yaml' : 'config/pre-live/portfolio_etf_us.yaml';
  const fp = path.join(resolveTssRoot(), rel);
  try {
    const doc = yaml.load(fs.readFileSync(fp, 'utf8'));
    const alloc = doc?.portfolios?.[0]?.allocations?.[0];
    const sf = alloc?.scanner_filters;
    if (!sf) throw new Error('no scanner_filters');
    const out = { ...defaults };
    // scanner_filters-level scalars
    if (sf.min_price != null) out.min_price = sf.min_price;
    if (sf.max_atr_ratio != null) out.max_atr_ratio = sf.max_atr_ratio;
    // min_score may be absent (US) → 0
    out.min_score = sf.min_score != null ? sf.min_score : 0;
    // params.* overrides (numeric thresholds + blacklist)
    const p = sf.params || {};
    for (const [k, v] of Object.entries(p)) out[k] = v;
    if (Array.isArray(p.blacklist)) out.blacklist = p.blacklist;
    return { params: out, source: fp };
  } catch (e) {
    console.error(`⚠️  etf-scanner: could not read ${fp} (${e.message}) — using embedded DEFAULT_PARAMS_${isEu ? 'EU' : 'US'}.`);
    return { params: { ...defaults }, source: 'embedded-defaults' };
  }
}

// Read a numeric param with a Go getParamFloat64-style default (for optional
// filters absent from the embedded defaults, e.g. MA200/VIX filters = 0 → off).
function paramF(params, name, def) {
  const v = params[name];
  return (typeof v === 'number' && isFinite(v)) ? v : def;
}

// ─── tp1/tp2/rr exit model (mirrors data/modes-config.json modes.etf / modes.etf_eu) ───
// Both modes share partialTPGain=10, disableTP2=true — identical values, so one constant
// covers etf-us and etf-eu. tp1 = entry × (1 + partialTPGain/100) is the REAL partial-TP
// trigger (not a fixed R multiple); rr is computed per-ticker from the actual stop distance
// instead of the previous hardcoded '1:2.0' (audit finding: uniform R/R across all signals).
// tp2 = 2x the TP1 gain (informational — disableTP2=true means sweep.js's own simulation
// never checks TP2 for this mode, gated on cfg.disableTP2 independently of this field; kept
// for display/gen-trading-plan.js consistency and to avoid a TP2<TP1 inversion at low ATR%).
const PARTIAL_TP_GAIN_PCT = 10; // modes-config.json modes.etf.partialTPGain / modes.etf_eu.partialTPGain
// Blacklist is now loaded from scanner_filters.params.blacklist (see loadScannerParams
// / DEFAULT_PARAMS_{US,EU}) and exposed as ACTIVE_BLACKLIST once the universe is resolved.

// ─── Established-liquidity gate (parity strategy_trend.go applyEstablishedLiquidityGate) ──
// Uniform point-in-time gate in Go: a candidate is only tradeable if its MEDIAN dollar
// volume over the trailing ESTABLISHED_LOOKBACK bars exceeds MIN_ESTABLISHED_DOLLAR_VOLUME.
// Go applies it AFTER diversifyByCategory (on the ≤MaxCandidates set), and does NOT backfill.
//
// ⚠️ OFF BY DEFAULT — this gate is NOT part of the ISO reference. The etf_us source of truth
// is config/pre-live/portfolio_etf_us.yaml (single-sleeve; the JS ETF-only universe can only
// be ISO with a single-sleeve Go config — the multi-survivors etf sleeve shares a global
// mkData and also ranks stocks). portfolio_etf_us.yaml sets NO min_established_dollar_volume,
// so applyEstablishedLiquidityGate is a no-op there. Applying it in JS therefore over-prunes
// vs the Go reference (drops liquid-but-sub-$5M-median ETFs Go keeps). The gate is kept as an
// opt-in (--established-gate) for anyone wanting the OLD multi-survivors parity (which HAD it,
// value 5_000_000 / lookback 60), but the DEFAULT is ISO with portfolio_etf_us.yaml (no gate).
const MIN_ESTABLISHED_DOLLAR_VOLUME = 5_000_000;
const ESTABLISHED_LOOKBACK_DAYS = 60;

const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}
const hasFlag = name => args.includes(`--${name}`);

const MIN_SCORE = parseFloat(getArg('min-score', '0'));
const TOP_N = parseInt(getArg('top', '10'));
const OUTPUT_MODE = getArg('output', 'stdout');
const DRY_RUN = hasFlag('dry-run');
const SCAN_DATE = getArg('date', new Date().toISOString().slice(0, 10));
const SCAN_FOLDER = getArg('folder', null);
const CONCURRENCY = parseInt(getArg('concurrency', '10'));
// Established-liquidity gate is OFF by default (ISO with portfolio_etf_us.yaml which has none).
// Opt in with --established-gate for legacy multi-survivors parity. US-only regardless.
const ESTABLISHED_GATE = hasFlag('established-gate');

// Regime: CLI > signals.json > default
function resolveRegime() {
  const cliRegime = getArg('regime', null);
  if (cliRegime) return cliRegime;
  if (SCAN_FOLDER) {
    try {
      const sigPath = path.join(ROOT, 'scanner', SCAN_FOLDER, 'signals.json');
      const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
      if (signals.regime) return signals.regime;
    } catch {}
  }
  return 'recovery';
}
const REGIME = resolveRegime();

// ─── ETF Universe ────────────────────────────────────────────────────────────
// PRIMARY source (US): data/etf-us-universe.json — an ISO dump of the FULL Go etf_us
// secmaster pool (~4000 non-leveraged US ETFs), generated by tools/gen-etf-us-universe.js
// (universe.go GetAssets §2 core + §4 dynamic). Loaded by loadUSUniverse() below.
// The hardcoded list under ETF_UNIVERSE_FALLBACK is kept ONLY as a safety net if the data
// file is missing — it is the legacy ~45 mega-ETF list whose tiny overlap with the Go pool
// was the root cause of the etf ISO divergence (fixed by loading the full universe).
const ETF_UNIVERSE_FALLBACK = [
  'SPY', 'QQQ', 'IWM', 'DIA',
  'XLK', 'XLE', 'XLF', 'XLV', 'XLI', 'XLB', 'XLC', 'XLY', 'XLP', 'XLU', 'XLRE',
  'VTI', 'VOO', 'VEA', 'VWO', 'EEM', 'EFA',
  'GDX', 'GDXJ', 'SLV', 'GLD', 'USO',
  'TLT', 'HYG', 'LQD',
  'ARKK', 'ARKG', 'GBTC', 'BITO',
  // NOTE: SOXL/TQQQ (3x leveraged) removed — config allocation is `pure: true` (non-leveraged only).
  // These were the RSI 83-89 overbought momentum entries the Go PM never takes.
  'FXI', 'EWJ', 'EWZ', 'EWN', 'INDA', 'VGK', 'VPL', 'IEMG',
  'XBI', 'IBB', 'SMH', 'SOXX', 'KWEB', 'TAN',
];

// ETF categories for diversification (max 2 per category).
// Aligned VERBATIM to systematic-tss `etfCategory` (staticdata frozen cache) so
// diversifyByCategory gates identically to the Go scanner. Previously our coarse
// buckets (e.g. XLV+XBI+IBB+ARKG were 3 categories; Go = all "Health") diverged.
const ETF_CATEGORIES_FALLBACK = {
  SPY: 'Large Blend', QQQ: 'Large Growth', IWM: 'Small Blend', DIA: 'Large Value',
  XLK: 'Technology', XLE: 'Equity Energy', XLF: 'Financial', XLV: 'Health',
  XLI: 'Industrials', XLB: 'Natural Resources', XLC: 'Communications', XLY: 'Consumer Cyclical',
  XLP: 'Consumer Defensive', XLU: 'Utilities', XLRE: 'Real Estate',
  VTI: 'Large Blend', VOO: 'Large Blend', VEA: 'Foreign Large Blend', VWO: 'Diversified Emerging Mkts',
  EEM: 'Diversified Emerging Mkts', EFA: 'Foreign Large Blend',
  GDX: 'Equity Precious Metals', GDXJ: 'Equity Precious Metals',
  SLV: 'Commodities Focused', GLD: 'Commodities Focused', USO: 'Commodities Focused',
  TLT: 'Long Government', HYG: 'High Yield Bond', LQD: 'Corporate Bond',
  ARKK: 'Mid-Cap Growth', ARKG: 'Health', GBTC: 'Digital Assets', BITO: 'Digital Assets',
  FXI: 'China Region', EWJ: 'Japan Stock', INDA: 'India Equity', VPL: 'Diversified Pacific/Asia', KWEB: 'China Region',
  EWZ: 'Latin America Stock', EWN: 'Miscellaneous Region', VGK: 'Europe Stock', IEMG: 'Diversified Emerging Mkts',
  XBI: 'Health', IBB: 'Health', SMH: 'Technology', SOXX: 'Technology', TAN: 'Miscellaneous Sector',
};

// Top ETF bonus multipliers (from Go analysis) — US universe only
const TOP_ETF_BONUS = {
  XLE: 1.15, XLK: 1.15, EWN: 1.20,
  GBTC: 1.10, SLV: 1.10, GDX: 1.10,
  VOO: 1.05, VTI: 1.05, QQQ: 1.05,
};

// ─── Active universe resolution (US default | EU | custom file) ─────────────
// --universe etf-us (default) | etf-eu | <path-to-json>
// EU signals are tagged universe='etf_eu' / region='EU' so gen-status-page routes
// them to the dedicated "ETF Europe" mode (universeFilter='etf_eu'), keeping the
// US ETF pool (universe='etf') fully separate. Same momentum strategy on both.
const UNIVERSE_ARG = getArg('universe', 'etf-us');
const UNIVERSE_TAG_ARG = getArg('universe-tag', null);
const REGION_ARG = getArg('region', null);

// Load the full US ETF universe (ISO dump of the Go etf_us secmaster pool). Returns the
// legacy hardcoded fallback if the data file is missing/empty so the scanner never hard-fails.
function loadUSUniverse() {
  const fp = path.join(ROOT, 'data', 'etf-us-universe.json');
  let list = null;
  try {
    const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
    list = Array.isArray(raw) ? raw : (raw.etfs || raw.stocks || raw.tickers || null);
  } catch { /* file missing → fallback below */ }
  if (!Array.isArray(list) || list.length === 0) {
    console.error('⚠️  data/etf-us-universe.json missing/empty — falling back to legacy hardcoded ETF list.');
    console.error('    Regenerate with: node tools/gen-etf-us-universe.js');
    return { tickers: ETF_UNIVERSE_FALLBACK, categories: ETF_CATEGORIES_FALLBACK };
  }
  const tickers = [];
  const categories = {};
  for (const e of list) {
    const sym = typeof e === 'string' ? e : e.symbol;
    if (!sym) continue;
    tickers.push(sym);
    if (e && e.category) categories[sym] = e.category; // raw etfCategory → matches Go diversifyByCategory
  }
  return { tickers, categories };
}

function loadEUUniverse() {
  const fp = path.join(ROOT, 'data', 'etf-eu-universe.json');
  const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const list = Array.isArray(raw) ? raw : (raw.etfs || raw.stocks || []);
  const tickers = [];
  const categories = {};
  for (const e of list) {
    const sym = typeof e === 'string' ? e : e.symbol;
    if (!sym) continue;
    tickers.push(sym);
    if (e && e.category) categories[sym] = e.category;
  }
  return { tickers, categories };
}

function resolveUniverse(arg) {
  const a = (arg || 'etf-us').toLowerCase();
  if (a === 'etf-us' || a === 'us' || a === 'etf' || a === 'us_etf') {
    const us = loadUSUniverse();
    return { tickers: us.tickers, categories: us.categories, bonus: TOP_ETF_BONUS, tag: 'etf', region: 'US', label: 'US' };
  }
  if (a === 'etf-eu' || a === 'eu' || a === 'eu_etf' || a === 'europe') {
    const eu = loadEUUniverse();
    return { tickers: eu.tickers, categories: eu.categories, bonus: {}, tag: 'etf_eu', region: 'EU', label: 'EU' };
  }
  // Treat anything else as a path to a JSON universe file
  const raw = JSON.parse(fs.readFileSync(path.isAbsolute(arg) ? arg : path.join(ROOT, arg), 'utf8'));
  const list = Array.isArray(raw) ? raw : (raw.etfs || raw.stocks || []);
  const tickers = [], categories = {};
  for (const e of list) {
    const sym = typeof e === 'string' ? e : e.symbol;
    if (!sym) continue;
    tickers.push(sym);
    if (e && e.category) categories[sym] = e.category;
  }
  return { tickers, categories, bonus: {}, tag: UNIVERSE_TAG_ARG || 'etf', region: REGION_ARG || 'US', label: 'CUSTOM' };
}

const ACTIVE = resolveUniverse(UNIVERSE_ARG);
// CLI overrides (allow re-tagging a custom run)
if (UNIVERSE_TAG_ARG) ACTIVE.tag = UNIVERSE_TAG_ARG;
if (REGION_ARG) ACTIVE.region = REGION_ARG;
// Parité Go par univers (portfolio_etf_us.yaml / portfolio_etf_eu.yaml):
// EU = min_score 80 (testé 50-100, 80 optimal) + stop 1.5xATR ; US = stop 2.5xATR.
const IS_EU = ACTIVE.tag === 'etf_eu';
const STOP_ATR_MULT = IS_EU ? 1.5 : 2.5;

// Load scanner_filters (+ .params) from the per-universe Go config (or embedded
// defaults). ALL scoring thresholds now come from here — no more hardcoded values.
const { params: PARAMS, source: PARAMS_SOURCE } = loadScannerParams(IS_EU);
// scanner_filters-level scalars (per-config: US min_price 10 / max_atr 0.06 / no min_score;
// EU min_price 5 / max_atr 0.06 / min_score 80).
const MAX_ATR_RATIO = paramF(PARAMS, 'max_atr_ratio', 0.06);
const EFFECTIVE_MIN_PRICE = paramF(PARAMS, 'min_price', IS_EU ? 5 : 10);
const CONFIG_MIN_SCORE = paramF(PARAMS, 'min_score', 0);
const EFFECTIVE_MIN_SCORE = MIN_SCORE > 0 ? MIN_SCORE : CONFIG_MIN_SCORE;
// Blacklist from scanner_filters.params.blacklist (per-config; the JS ETF-only
// universes never overlap so each config uses only its own list).
const ACTIVE_BLACKLIST = new Set(Array.isArray(PARAMS.blacklist) ? PARAMS.blacklist : []);

// ─── Yahoo OHLCV fetcher (shared cache) ─────────────────────────────────────

const MIN_BARS = 200;

function readCache(ticker) {
  // Snapshot GELÉ pour SCAN_DATE : date passée = immuable ; date == aujourd'hui = TTL 12h (géré par le helper).
  const bars = readBars(ticker, { date: SCAN_DATE, market: 'US', interval: '1d' });
  if (bars && bars.length >= MIN_BARS) return bars;
  return null;
}

function fetchOHLCV(ticker) {
  return new Promise((resolve) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=2y&interval=1d`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (!j.chart?.result?.[0]) return resolve(null);
          const q = j.chart.result[0];
          const ts = q.timestamp || [];
          const ind = q.indicators?.quote?.[0];
          const adj = q.indicators?.adjclose?.[0]?.adjclose;
          if (!ind || !ts.length) return resolve(null);
          const bars = [];
          for (let i = 0; i < ts.length; i++) {
            const o = ind.open?.[i], h = ind.high?.[i], l = ind.low?.[i], c2 = ind.close?.[i], v = ind.volume?.[i];
            if (o == null || c2 == null) continue;
            bars.push({
              date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
              open: o, high: h || o, low: l || o, close: c2,
              adjClose: adj?.[i] || c2, volume: v || 0,
            });
          }
          if (bars.length >= MIN_BARS) {
            // Écrit en daté ; writeBars TRONQUE à bar.date <= SCAN_DATE (anti-look-ahead au backfill,
            // no-op en forward). L'array en mémoire retourné reste complet et est tronqué par main() via cutIdx.
            writeBars(ticker, bars, { date: SCAN_DATE, market: 'US', interval: '1d' });
          }
          resolve(bars.length >= MIN_BARS ? bars : null);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null)).on('timeout', function () { this.destroy(); resolve(null); });
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function batchFetch(tickers, concurrency) {
  const result = new Map();
  let cached = 0;

  // One pass over a list of symbols at the given concurrency. Returns the symbols that
  // yielded no data (so callers can retry — Yahoo 429s a fraction of a ~4000-symbol burst).
  async function pass(list, conc) {
    const queue = [...list];
    const failed = [];
    async function worker() {
      while (queue.length) {
        const t = queue.shift();
        let bars = readCache(t);
        if (bars) { cached++; } else { bars = await fetchOHLCV(t); }
        if (bars) result.set(t, bars);
        else failed.push(t);
      }
    }
    await Promise.all(Array.from({ length: conc }, () => worker()));
    return failed;
  }

  let failed = await pass(tickers, concurrency);
  // Bounded retry of rate-limited misses: cached hits are skipped instantly, so each retry
  // only re-hits Yahoo for the shrinking failure set at reduced concurrency. Makes the large
  // (~4000-ETF) universe DETERMINISTIC instead of dropping a random ~10% every cold run.
  const MAX_RETRIES = 3;
  for (let r = 0; r < MAX_RETRIES && failed.length > 0; r++) {
    process.stderr.write(`  retry ${r + 1}/${MAX_RETRIES}: ${failed.length} symbols (rate-limit recovery)\n`);
    await sleep(1500 * (r + 1));
    const conc = Math.max(3, Math.floor(concurrency / 2));
    failed = await pass(failed, conc);
  }

  process.stderr.write(`  fetched ${result.size}/${tickers.length} valid (${cached} cached, ${failed.length} unresolved)\n`);
  return result;
}

// ─── Market Breadth (SPY/QQQ/IWM above MA50) ───────────────────────────────

function calcMarketBreadth(priceData) {
  let bullishCount = 0;
  const check = (ticker) => {
    const bars = priceData.get(ticker);
    if (!bars || bars.length < 50) return false;
    const ma50 = calcSMA(bars, 50);
    return bars[bars.length - 1].close > ma50;
  };
  const spyAbove = check('SPY'); if (spyAbove) bullishCount++;
  const qqqAbove = check('QQQ'); if (qqqAbove) bullishCount++;
  const iwmAbove = check('IWM'); if (iwmAbove) bullishCount++;
  return {
    bullishCount, spyAbove, qqqAbove, iwmAbove,
    isBullish: bullishCount === 3,
    isBearish: bullishCount === 0,
  };
}

// ─── ETF Momentum Scoring (exact port of scanner_etf_momentum.go) ──────────

function scoreSymbol(ticker, bars, regime, vixRatio, vixLevel) {
  // Blacklist (scanner_filters.params.blacklist) — skip before any scoring
  if (ACTIVE_BLACKLIST.has(ticker)) return null;

  const n = bars.length;
  if (n < 200) return null;
  const price = bars[n - 1].close;
  if (price <= 0 || !isFinite(price)) return null;
  if (price < EFFECTIVE_MIN_PRICE) return null;

  const mom20 = calcMomentum(bars, 20);
  const ma20 = calcSMA(bars, 20);
  const ma50 = calcSMA(bars, 50);
  const ma200 = calcSMA(bars, 200);
  const atr = calcATR(bars, 14);
  const rsi = calcRSI(bars, 14);

  if (ma20 <= 0 || ma50 <= 0 || ma200 <= 0 || atr <= 0) return null;

  const atrPct = atr / price;
  const distMA20 = (price - ma20) / ma20;
  const distMA50 = (price - ma50) / ma50;
  const distMA200 = (price - ma200) / ma200;

  const avgVol20 = calcAvgVolume(bars, 20);
  let volRatio = 1.0;
  if (avgVol20 > 0) volRatio = (bars[n - 1].volume || 0) / avgVol20;

  // ATR filter (scanner_filters.max_atr_ratio)
  if (atrPct > MAX_ATR_RATIO) return null;

  const r = (regime || 'recovery').toUpperCase().replace(/[- ]/g, '_');
  const vr = (typeof vixRatio === 'number' && isFinite(vixRatio)) ? vixRatio : 1.0;
  const vl = (typeof vixLevel === 'number' && isFinite(vixLevel)) ? vixLevel : 20.0;

  // ── Optional VIX filters (params vix_riskon_filter / vix_recovery_filter; default 0 = off)
  if (paramF(PARAMS, 'vix_riskon_filter', 0) > 0 && r === 'RISK_ON' && vr >= 1.00 && vr < 1.02) return null;
  if (paramF(PARAMS, 'vix_recovery_filter', 0) > 0 && r === 'RECOVERY' && vr >= 1.02 && vr < 1.05) return null;

  // ── Optional global MA200 filters (params ma200_above_filter / ma200_below_filter; default 0 = off)
  if (paramF(PARAMS, 'ma200_above_filter', 0) > 0 && distMA200 < 0) return null;
  if (paramF(PARAMS, 'ma200_below_filter', 0) > 0 && distMA200 > 0) return null;

  // Blow-off top filter (params blowoff_rsi / blowoff_dist_ma20)
  const blowoffRSI = paramF(PARAMS, 'blowoff_rsi', 85.0);
  const blowoffDistMA20 = paramF(PARAMS, 'blowoff_dist_ma20', 0.20);
  if (rsi > blowoffRSI && distMA20 > blowoffDistMA20) return null;

  // ── Optional per-regime MA200 filters (all default 0 = off in both configs)
  if (paramF(PARAMS, 'ma200_riskon_filter', 0) > 0 && r === 'RISK_ON' && distMA200 < 0) return null;
  if (paramF(PARAMS, 'ma200_recovery_filter', 0) > 0 && r === 'RECOVERY' && distMA200 < 0) return null;
  if (paramF(PARAMS, 'ma200_riskoff_filter', 0) > 0 && r === 'RISK_OFF' && distMA200 > 0) return null;
  if (paramF(PARAMS, 'ma200_early_riskoff_filter', 0) > 0 && r === 'EARLY_RISK_OFF' && distMA200 > 0) return null;
  if (paramF(PARAMS, 'ma200_lowvix_filter', 0) > 0 && vl < 15 && distMA200 < 0) return null;
  if (paramF(PARAMS, 'ma200_highvix_filter', 0) > 0 && vl >= 20 && distMA200 > 0) return null;

  // ── Regime-specific thresholds (loaded from scanner_filters.params) ──
  // RISK_OFF
  const riskoffDeepDipDist = paramF(PARAMS, 'riskoff_deep_dip_dist', -0.05);
  const riskoffOversoldRSI = paramF(PARAMS, 'riskoff_oversold_rsi', 40.0);
  const riskoffMeanrevRSI = paramF(PARAMS, 'riskoff_meanrev_rsi', 50.0);
  const riskoffMaxDistMA20 = paramF(PARAMS, 'riskoff_max_dist_ma20', 0.0); // 0 = disabled
  // NEUTRAL
  const neutralMeanrevRSI = paramF(PARAMS, 'neutral_meanrev_rsi', 40.0);
  const neutralMeanrevDist = paramF(PARAMS, 'neutral_meanrev_dist', -0.03);
  const neutralLowvolATR = paramF(PARAMS, 'neutral_lowvol_atr', 0.04);
  const neutralLowvolMom = paramF(PARAMS, 'neutral_lowvol_mom', 0.05);
  // RISK_ON
  const riskonMaxATR = paramF(PARAMS, 'riskon_max_atr', 0.045);
  const riskonMinMom = paramF(PARAMS, 'riskon_min_mom', 0.02);
  const riskonRSIBoostThresh = paramF(PARAMS, 'riskon_rsi_boost_thresh', 60.0);
  const riskonRSIBoostFactor = paramF(PARAMS, 'riskon_rsi_boost_factor', 2.0);
  const riskonMinRSI = paramF(PARAMS, 'riskon_min_rsi', 0.0);            // 0 = disabled
  const riskonMinDistMA20 = paramF(PARAMS, 'riskon_min_dist_ma20', 0.0); // 0 = disabled
  // RECOVERY
  const recoveryMaxRSI = paramF(PARAMS, 'recovery_max_rsi', 48.0);
  const recoveryMaxATR = paramF(PARAMS, 'recovery_max_atr', 0.04);
  const recoveryMinMom = paramF(PARAMS, 'recovery_min_mom', 0.03);
  // EARLY_RISK_OFF
  const earlyRiskoffMaxRSI = paramF(PARAMS, 'early_riskoff_max_rsi', 25.0);
  const earlyRiskoffMinDist = paramF(PARAMS, 'early_riskoff_min_dist', -0.10);
  // EXTREME
  const extremeMomThresh = paramF(PARAMS, 'extreme_mom_thresh', 0.15);
  const extremeOversoldRSI = paramF(PARAMS, 'extreme_oversold_rsi', 30.0);
  const extremeOversoldDist = paramF(PARAMS, 'extreme_oversold_dist', -0.05);
  const extremeMinDistMA20 = paramF(PARAMS, 'extreme_min_dist_ma20', 0.0);
  const extremeSkipEarlyRiskoff = paramF(PARAMS, 'extreme_skip_early_riskoff', 0.0);
  const extremeSkipNeutral = paramF(PARAMS, 'extreme_skip_neutral', 0.0);

  // Regime-adaptive cluster detection
  let cluster = '';
  let score = 0;
  let validEntry = false;

  if (r === 'RISK_OFF') {
    // Strict quality filter if configured (riskoff_max_dist_ma20 < 0)
    if (!(riskoffMaxDistMA20 < 0 && distMA20 > riskoffMaxDistMA20)) {
      if (distMA20 < riskoffDeepDipDist) {
        validEntry = true; cluster = 'RISKOFF_DEEP_DIP';
        score = 150 + Math.abs(distMA20) * 1000;
      } else if (rsi < riskoffOversoldRSI) {
        validEntry = true; cluster = 'RISKOFF_OVERSOLD';
        score = 140 + (riskoffOversoldRSI - rsi) * 3;
      } else if (rsi < riskoffMeanrevRSI && distMA20 < 0) {
        validEntry = true; cluster = 'RISKOFF_MEANREV';
        score = 120 + (riskoffMeanrevRSI - rsi) * 2 + Math.abs(distMA20) * 500;
      }
    }
  } else if (r === 'NEUTRAL') {
    if (rsi < neutralMeanrevRSI && distMA20 < neutralMeanrevDist) {
      validEntry = true; cluster = 'NEUTRAL_MEANREV';
      score = 100 + (neutralMeanrevRSI - rsi) * 2 + Math.abs(distMA20) * 400;
    } else if (atrPct < neutralLowvolATR && mom20 > neutralLowvolMom) {
      validEntry = true; cluster = 'NEUTRAL_LOWVOL_MOM';
      score = 80 + mom20 * 500;
    }
  } else if (r === 'RISK_ON') {
    if (atrPct < riskonMaxATR && mom20 > riskonMinMom) {
      // Strict quality filters if configured (both default 0 = disabled)
      if (!((riskonMinRSI > 0 && rsi < riskonMinRSI) || (riskonMinDistMA20 > 0 && distMA20 < riskonMinDistMA20))) {
        validEntry = true; cluster = 'RISKON_MOMENTUM';
        let rsiBoost = 0;
        if (rsi > riskonRSIBoostThresh) rsiBoost = (rsi - riskonRSIBoostThresh) * riskonRSIBoostFactor;
        score = 80 + mom20 * 500 + rsiBoost;
      }
    }
  } else if (r === 'RECOVERY') {
    if (rsi < recoveryMaxRSI && atrPct < recoveryMaxATR && mom20 > recoveryMinMom) {
      validEntry = true; cluster = 'RECOVERY_FILTERED';
      score = 70 + mom20 * 400 + (recoveryMaxRSI - rsi) * 1.5;
    }
  } else if (r === 'EARLY_RISK_OFF') {
    if (rsi < earlyRiskoffMaxRSI && distMA20 < earlyRiskoffMinDist) {
      validEntry = true; cluster = 'EARLY_RISKOFF_EXTREME';
      score = 100 + (earlyRiskoffMaxRSI - rsi) * 5 + Math.abs(distMA20) * 500;
    }
  }

  // EXTREME fallback (for very strong signals) — skippable per regime via config
  if (!validEntry) {
    let skipAllExtreme = false;
    if (extremeSkipEarlyRiskoff > 0 && r === 'EARLY_RISK_OFF') skipAllExtreme = true;
    if (extremeSkipNeutral > 0 && r === 'NEUTRAL') skipAllExtreme = true;
    if (skipAllExtreme) return null;

    if (mom20 > extremeMomThresh) {
      // In RECOVERY/NEUTRAL: require trend confirmation (distMA20 >= extreme_min_dist_ma20)
      let skipExtreme = false;
      if ((r === 'RECOVERY' || r === 'NEUTRAL') && distMA20 < extremeMinDistMA20) skipExtreme = true;
      if (!skipExtreme) {
        validEntry = true; cluster = 'EXTREME_MOMENTUM';
        score = 120 + mom20 * 500;
      }
    }
    if (!validEntry && rsi < extremeOversoldRSI && distMA20 < extremeOversoldDist) {
      // Skip EXTREME_OVERSOLD in RISK_ON (momentum regime)
      if (r !== 'RISK_ON') {
        validEntry = true; cluster = 'EXTREME_OVERSOLD';
        score = 110 + (extremeOversoldRSI - rsi) * 3 + Math.abs(distMA20) * 600;
      }
    }
  }

  if (!validEntry) return null;

  // Top ETF bonus (US universe only; EU/custom pass an empty map)
  const mult = ACTIVE.bonus[ticker];
  if (mult) score *= mult;

  score = Math.round(score * 100) / 100;

  if (score < EFFECTIVE_MIN_SCORE) return null;

  return {
    score, price, entry: price,
    stop: +(price - atr * STOP_ATR_MULT).toFixed(4),
    atr, atrPct, rsi, mom20,
    distMA20: +distMA20.toFixed(4), distMA50: +distMA50.toFixed(4), distMA200: +distMA200.toFixed(4),
    volRatio: +volRatio.toFixed(2),
    sma20: ma20, sma50: ma50, sma200: ma200,
    cluster, strategy: 'etf-momentum',
  };
}

// ─── Category diversification (max 2 per category) ──────────────────────────

function diversifyByCategory(candidates, limit) {
  const maxPerCategory = 2;
  const categoryCount = {};
  const result = [];

  for (const c of candidates) {
    if (result.length >= limit) break;
    const category = ACTIVE.categories[c.ticker] || 'OTHER';
    if ((categoryCount[category] || 0) >= maxPerCategory) continue;
    result.push(c);
    categoryCount[category] = (categoryCount[category] || 0) + 1;
  }
  return result;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`📊 ETF Momentum Scanner (systematic-tss port) — ${ACTIVE.label} universe`);
  console.log(`   Universe: ${ACTIVE.tickers.length} ETFs (${ACTIVE.tag}) | minScore: ${EFFECTIVE_MIN_SCORE} | top: ${TOP_N}`);
  console.log(`   Params: ${PARAMS_SOURCE === 'embedded-defaults' ? 'embedded defaults' : path.relative(ROOT, PARAMS_SOURCE)} (maxATR ${MAX_ATR_RATIO}, minPrice ${EFFECTIVE_MIN_PRICE}, recovery_max_rsi ${paramF(PARAMS, 'recovery_max_rsi', 48)})`);
  console.log(`   Date: ${SCAN_DATE} | Regime: ${REGIME}`);

  console.log(`📡 Fetching OHLCV data via Yahoo...`);
  // Fetch VIX + US breadth proxies alongside the active ETF universe (deduped).
  // Breadth (SPY/QQQ/IWM) stays a global-regime proxy even for the EU universe.
  const allTickers = [...new Set([...ACTIVE.tickers, 'SPY', 'QQQ', 'IWM', '^VIX'])];
  const priceData = await batchFetch(allTickers, CONCURRENCY);
  if (!priceData.size) { console.error('❌ No OHLCV data — aborting.'); process.exit(1); }

  // VIX analysis
  const vixBars = priceData.get('^VIX');
  let vixLevel = 0, vixRatio = 1.0;
  if (vixBars && vixBars.length >= 14) {
    const vn = vixBars.length;
    vixLevel = vixBars[vn - 1].close;
    const vixSma14 = calcSMA(vixBars, 14);
    if (vixSma14 > 0) vixRatio = vixLevel / vixSma14;
    const vixTrend = vixRatio < 0.90 ? 'falling' : vixRatio > 1.10 ? 'rising' : 'stable';
    console.log(`   VIX: ${vixLevel.toFixed(1)} (${vixTrend}, ratio: ${vixRatio.toFixed(3)})`);
  }

  // Market breadth
  const breadth = calcMarketBreadth(priceData);
  console.log(`   Breadth: ${breadth.bullishCount}/3 above MA50 (SPY:${breadth.spyAbove ? 'Y' : 'N'} QQQ:${breadth.qqqAbove ? 'Y' : 'N'} IWM:${breadth.iwmAbove ? 'Y' : 'N'})`);

  console.log('🔍 Scoring candidates (regime-adaptive clusters)...');
  const candidates = [];
  const scanDateNorm = SCAN_DATE.replace(/-/g, '');

  for (const ticker of ACTIVE.tickers) {
    const rawBars = priceData.get(ticker);
    if (!rawBars) continue;

    const cutIdx = rawBars.findIndex(b => b.date.replace(/-/g, '') > scanDateNorm);
    const bars = cutIdx > 0 ? rawBars.slice(0, cutIdx) : rawBars;

    const result = scoreSymbol(ticker, bars, REGIME, vixRatio, vixLevel);
    if (!result) continue;

    const risk = result.entry - result.stop;
    if (risk <= 0) continue;

    const tp1 = +(result.entry * (1 + PARTIAL_TP_GAIN_PCT / 100)).toFixed(2);
    const tp2 = +(result.entry * (1 + (PARTIAL_TP_GAIN_PCT * 2) / 100)).toFixed(2);
    const rr = +((tp1 - result.entry) / risk).toFixed(2);

    // Point-in-time median dollar volume for the established-liquidity gate (bars already
    // truncated to <= SCAN_DATE, so this is look-ahead-safe). 0 if < lookback bars available.
    const estDolVol = calcDollarVolumePercentile(bars, ESTABLISHED_LOOKBACK_DAYS, 0.50);
    const estBars = bars.length;

    candidates.push({
      ticker, score: result.score,
      entry: +result.entry.toFixed(2), stop: +result.stop.toFixed(2), tp1, tp2,
      rr: `1:${rr.toFixed(2)}`, metrics: result, estDolVol, estBars,
    });
  }

  // Sort: score desc, then symbol asc — matches Go sort.Slice (Score> then Symbol<).
  candidates.sort((a, b) => (b.score - a.score) || (a.ticker < b.ticker ? -1 : a.ticker > b.ticker ? 1 : 0));

  // Category diversification (max 2/category) — Go applies this at limit=MaxCandidates.
  let topCandidates = diversifyByCategory(candidates, TOP_N);

  // Established-liquidity gate (US only) — parity strategy_trend.go applyEstablishedLiquidityGate:
  // applied AFTER diversification, drops (never backfills) names whose median $-volume over the
  // trailing lookback is below the threshold, or that lack enough point-in-time history.
  // EU path is a separate config/mode and is intentionally left unchanged.
  if (!IS_EU && ESTABLISHED_GATE) {
    const before = topCandidates.length;
    topCandidates = topCandidates.filter(c =>
      c.estBars >= ESTABLISHED_LOOKBACK_DAYS && c.estDolVol >= MIN_ESTABLISHED_DOLLAR_VOLUME);
    const dropped = before - topCandidates.length;
    if (dropped > 0) console.log(`   Established-liquidity gate: dropped ${dropped} (median $-vol < $${(MIN_ESTABLISHED_DOLLAR_VOLUME / 1e6)}M over ${ESTABLISHED_LOOKBACK_DAYS}d)`);
  }

  console.log(`\n✅ Found ${candidates.length} signals (passed all filters), top ${topCandidates.length} (diversified):`);
  for (const c of topCandidates) {
    const cat = ACTIVE.categories[c.ticker] || 'OTHER';
    console.log(`  📊 ${c.ticker.padEnd(6)} score:${String(c.score).padStart(7)} [${c.metrics.cluster}] Mom20:${(c.metrics.mom20 * 100).toFixed(1)}% RSI:${c.metrics.rsi.toFixed(0)} ATR%:${(c.metrics.atrPct * 100).toFixed(1)}% (${cat})`);
  }

  if (DRY_RUN) { console.log('\n🏷️  Dry run — no files written.'); return topCandidates; }

  if (OUTPUT_MODE === 'json') {
    const suffix = ACTIVE.tag === 'etf' ? '' : `-${ACTIVE.tag}`;
    const outPath = path.join(ROOT, 'data', `etf-scan-${SCAN_DATE}${suffix}.json`);
    fs.writeFileSync(outPath, JSON.stringify({
      scanDate: SCAN_DATE, regime: REGIME, vix: { level: vixLevel, ratio: vixRatio },
      breadth, candidates: topCandidates,
    }, null, 2));
    console.log(`\n📁 Written to ${outPath}`);
  } else if (OUTPUT_MODE === 'signals') {
    const scanDir = SCAN_FOLDER || SCAN_DATE.replace(/-/g, '');
    const sigPath = path.join(ROOT, 'scanner', scanDir, 'signals.json');
    if (!fs.existsSync(sigPath)) { console.error(`❌ ${sigPath} not found`); process.exit(1); }
    const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
    const existing = new Set((signals.signals || []).map(s => s.ticker));
    let added = 0;
    for (const c of topCandidates) {
      if (existing.has(c.ticker)) continue;
      signals.signals.push({
        ticker: c.ticker, name: c.ticker, score: c.score, strategy: 'ETFMomentum',
        entry: c.entry, stop: c.stop, tp1: c.tp1, tp2: c.tp2, rr: c.rr,
        horizon: 21, region: ACTIVE.region, universe: ACTIVE.tag,
        sharia: null,
        thesis: `ETF ${c.metrics.cluster}: Mom20=${(c.metrics.mom20 * 100).toFixed(1)}%, RSI=${c.metrics.rsi.toFixed(0)}, ATR%=${(c.metrics.atrPct * 100).toFixed(1)}%`,
        extension: { cluster: c.metrics.cluster, atrPct: +c.metrics.atrPct.toFixed(4) },
      });
      existing.add(c.ticker);
      added++;
    }
    // Scan marker — proof the ETF scanner actually ran for this universe (even with 0 signals).
    // Key: 'etf' (US default) | 'etf:etf_eu' (EU) — merged into the shared _scanRuns object
    // without clobbering other scanners' entries.
    if (!signals._scanRuns) signals._scanRuns = {};
    signals._scanRuns[ACTIVE.tag === 'etf' ? 'etf' : `etf:${ACTIVE.tag}`] = {
      at: new Date().toISOString(),
      universe: ACTIVE.tag,
      candidates: candidates.length,
      signals: topCandidates.length,
      added,
    };
    fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
    console.log(`\n📁 Appended ${added} ETF signals to ${sigPath}`);
  }

  return topCandidates;
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
