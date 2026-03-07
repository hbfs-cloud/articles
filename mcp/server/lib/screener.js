/**
 * Market Screener Engine
 *
 * DSL syntax (case-insensitive):
 *   change1d > 2.0                   # 1-day change > 2%
 *   volume > avgvol3m * 1.5          # Volume 1.5x the 3-month average
 *   price > ema50                    # Price above 50-day moving average
 *   rsi14 < 30                       # RSI(14) in oversold territory
 *   marketcap > 500                  # Market cap > $500M
 *   pct_from_high > -5               # Within 5% of 52-week high
 *   above_ema200 = 1                 # Trading above 200 MA
 *   rvol > 2.0                       # Relative volume > 2x
 *   AND / OR connectors
 *
 * Available fields (from Yahoo quote batch):
 *   price, open, high, low, prev_close
 *   change1d (%), changePct (alias)
 *   volume, avgvol10d, avgvol3m, rvol
 *   marketcap (in $M), pe, forward_pe, beta
 *   ema50, ema200, high52w, low52w
 *   pct_from_high, pct_from_low
 *   above_ema50 (0/1), above_ema200 (0/1)
 *   rsi14 (requires bars=true option, fetched on demand)
 */

import * as yahoo from './yahoo.js';
import * as universe from './universe.js';
import * as regime from './regime.js';
import { getStorage } from './storage.js';

// ═══════════════════════════════════════════════════════
// TECHNICAL INDICATORS (pure functions on bar arrays)
// ═══════════════════════════════════════════════════════

export function calcRSI(closes, period = 14) {
  if (!closes || closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  let avgG = gains / period;
  let avgL = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgG = (avgG * (period - 1) + Math.max(d, 0)) / period;
    avgL = (avgL * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (avgL === 0) return 100;
  return +(100 - 100 / (1 + avgG / avgL)).toFixed(2);
}

export function calcEMA(closes, period) {
  if (!closes || closes.length < period) return null;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return +ema.toFixed(4);
}

export function calcATR(bars, period = 14) {
  if (!bars || bars.length < period + 1) return null;
  const trValues = bars.slice(1).map((b, i) => {
    const prev = bars[i].close;
    return Math.max(b.high - b.low, Math.abs(b.high - prev), Math.abs(b.low - prev));
  });
  let atr = trValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trValues.length; i++) {
    atr = (atr * (period - 1) + trValues[i]) / period;
  }
  return +atr.toFixed(4);
}

// ═══════════════════════════════════════════════════════
// DSL COMPILER
// Maps DSL field names to quote object properties, then
// compiles the expression string to a JS function.
// ═══════════════════════════════════════════════════════

const FIELD_MAP = {
  price:           'q.price',
  open:            'q.open',
  high:            'q.high',
  low:             'q.low',
  prev_close:      'q.previousClose',
  change1d:        'q.changePct',
  changepct:       'q.changePct',
  volume:          'q.volume',
  avgvol10d:       'q.avgvol10d',
  avgvol3m:        'q.avgvol3m',
  rvol:            'q.rvol',
  marketcap:       'q.marketCapM',
  pe:              'q.pe',
  forward_pe:      'q.forwardPe',
  beta:            'q.beta',
  ema50:           'q.ema50',
  ema200:          'q.ema200',
  high52w:         'q.high52w',
  low52w:          'q.low52w',
  pct_from_high:   'q.pctFromHigh',
  pct_from_low:    'q.pctFromLow',
  above_ema50:     'q.aboveEma50',
  above_ema200:    'q.aboveEma200',
  rsi14:           'q.rsi14',
  atr14:           'q.atr14'
};

export function compileDSL(expr) {
  // Normalize operators written as english words
  let js = expr
    .replace(/\band\b/gi, '&&')
    .replace(/\bor\b/gi,  '||')
    .replace(/\bnot\b/gi, '!');

  // Single-pass replacement: build one alternation regex so that already-substituted
  // text (e.g. q.changePct) is never re-processed by a later iteration.
  const pattern = new RegExp(
    `\\b(${Object.keys(FIELD_MAP).join('|')})\\b`,
    'gi'
  );
  js = js.replace(pattern, match => FIELD_MAP[match.toLowerCase()] ?? match);

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('q', `"use strict"; return !!(${js});`);
    // Smoke-test with a dummy quote
    fn({ price: 100, changePct: 1, volume: 1e6, avgvol3m: 5e5, rvol: 2, marketCapM: 1000,
         pe: 20, forwardPe: 15, beta: 1, ema50: 98, ema200: 90, high52w: 120, low52w: 80,
         pctFromHigh: -5, pctFromLow: 15, aboveEma50: 1, aboveEma200: 1, rsi14: 45, atr14: 2,
         avgvol10d: 4e5, open: 99, high: 102, low: 97, previousClose: 98 });
    return { fn, ok: true, js };
  } catch (e) {
    return { fn: null, ok: false, error: e.message, js };
  }
}

// ═══════════════════════════════════════════════════════
// QUOTE NORMALISER
// Maps Yahoo quote response to DSL fields
// ═══════════════════════════════════════════════════════

function normaliseQuote(q) {
  const price   = q.price || 0;
  const ema50   = q.fiftyDayAvg  || price;
  const ema200  = q.twoHundredDayAvg || price;
  const h52     = q.fiftyTwoWeekHigh || price;
  const l52     = q.fiftyTwoWeekLow  || price;
  const vol     = q.volume || 0;
  const avgvol  = q.avgVolume || 1;
  return {
    symbol:        q.symbol,
    name:          q.shortName || q.symbol,
    price,
    open:          q.open,
    high:          q.high,
    low:           q.low,
    previousClose: q.previousClose,
    changePct:     q.changePct || 0,
    volume:        vol,
    avgvol3m:      avgvol,
    avgvol10d:     q.avgVolume || avgvol,
    rvol:          avgvol ? +(vol / avgvol).toFixed(2) : 0,
    marketCapM:    q.marketCap ? +(q.marketCap / 1e6).toFixed(0) : null,
    pe:            q.pe || null,
    forwardPe:     q.forwardPe || null,
    beta:          q.beta || null,
    ema50,
    ema200,
    high52w:       h52,
    low52w:        l52,
    pctFromHigh:   h52 ? +((price - h52) / h52 * 100).toFixed(2) : null,
    pctFromLow:    l52 ? +((price - l52) / l52 * 100).toFixed(2) : null,
    aboveEma50:    price >= ema50 ? 1 : 0,
    aboveEma200:   price >= ema200 ? 1 : 0,
    rsi14:         null, // filled on demand
    atr14:         null, // filled on demand
    exchange:      q.exchange,
    marketState:   q.marketState
  };
}

// ═══════════════════════════════════════════════════════
// REGIME-AWARE SCORER
// Returns a 0-100 score based on the current market regime
// ═══════════════════════════════════════════════════════

const REGIME_WEIGHTS = {
  'RISK-ON': {
    changePct:   { w: 30, fn: v => Math.min(v / 5 * 30, 30) },
    rvol:        { w: 25, fn: v => Math.min((v - 1) / 2 * 25, 25) },
    aboveEma50:  { w: 15, fn: v => v * 15 },
    aboveEma200: { w: 10, fn: v => v * 10 },
    pctFromHigh: { w: 20, fn: v => Math.max(0, (v + 20) / 20 * 20) }
  },
  'EARLY RISK-ON': {
    changePct:   { w: 20, fn: v => Math.min(v / 5 * 20, 20) },
    rvol:        { w: 20, fn: v => Math.min((v - 1) / 2 * 20, 20) },
    aboveEma50:  { w: 20, fn: v => v * 20 },
    aboveEma200: { w: 15, fn: v => v * 15 },
    pctFromLow:  { w: 25, fn: v => Math.min(v / 30 * 25, 25) }
  },
  'RISK-OFF': {
    changePct:   { w: 30, fn: v => v < 0 ? Math.min(Math.abs(v) / 5 * 30, 30) : 0 },
    rvol:        { w: 20, fn: v => Math.min((v - 1) / 2 * 20, 20) },
    aboveEma200: { w: 20, fn: v => (1 - v) * 20 },  // reward being below (shorts)
    beta:        { w: 30, fn: v => v != null ? Math.max(0, (2 - Math.abs(v)) / 2 * 30) : 15 }
  },
  'EARLY RISK-OFF': {
    changePct:   { w: 20, fn: v => Math.min(v / 5 * 20, 20) },
    rvol:        { w: 15, fn: v => Math.min((v - 1) / 2 * 15, 15) },
    aboveEma50:  { w: 20, fn: v => v * 20 },
    beta:        { w: 25, fn: v => v != null ? Math.max(0, (1.5 - v) / 1.5 * 25) : 12 },
    pctFromLow:  { w: 20, fn: v => Math.min(v / 30 * 20, 20) }
  },
  'NEUTRAL': {
    changePct:   { w: 20, fn: v => Math.min(Math.abs(v) / 5 * 20, 20) },
    rvol:        { w: 20, fn: v => Math.min((v - 1) / 2 * 20, 20) },
    aboveEma50:  { w: 20, fn: v => v * 20 },
    aboveEma200: { w: 20, fn: v => v * 20 },
    rsi14:       { w: 20, fn: v => v != null ? Math.max(0, (70 - Math.abs(v - 50)) / 70 * 20) : 10 }
  }
};

function scoreQuote(q, reg) {
  const weights = REGIME_WEIGHTS[reg] || REGIME_WEIGHTS['NEUTRAL'];
  let score = 0;
  for (const [field, cfg] of Object.entries(weights)) {
    const val = q[field];
    if (val != null) score += cfg.fn(val);
  }
  return Math.round(Math.min(100, Math.max(0, score)));
}

// ═══════════════════════════════════════════════════════
// MAIN SCREENER FUNCTION
// ═══════════════════════════════════════════════════════

/**
 * run(options) → { picks, meta }
 *
 * options:
 *   universe  {string}   Universe name or comma-separated symbols
 *   filter    {string}   DSL filter expression
 *   sort      {string}   Field to sort by (default: score)
 *   limit     {number}   Max results (default: 20)
 *   bars      {boolean}  Fetch bars to calculate RSI/ATR (slower, default: false)
 *   regime    {string}   Override regime detection
 */
export async function run(options = {}) {
  const {
    filter    = '',
    sort      = 'score',
    limit     = 20,
    bars      = false,
    regimeOverride = null
  } = options;

  // 1. Resolve universe
  const univName = options.universe || 'us_large';
  let symbols = [];
  if (univName.includes(',')) {
    symbols = univName.split(',').map(s => s.trim().toUpperCase());
  } else {
    symbols = await universe.get(univName);
    if (!symbols.length) {
      // Try as Yahoo predefined screener ID
      symbols = await universe.fetchYahooScreener(univName, 100);
    }
  }

  if (!symbols.length) throw new Error(`Unknown universe: "${univName}"`);

  // 2. Compile DSL
  const compiled = filter ? compileDSL(filter) : null;
  if (compiled && !compiled.ok) {
    throw new Error(`DSL parse error: ${compiled.error}\nCompiled JS: ${compiled.js}`);
  }

  // 3. Detect regime
  let currentRegime = regimeOverride;
  if (!currentRegime) {
    try {
      const r = await regime.detect();
      currentRegime = r?.regime || 'NEUTRAL';
    } catch {
      currentRegime = 'NEUTRAL';
    }
  }

  // 4. Batch-fetch quotes (chunks of 50 to respect Yahoo limits)
  const CHUNK = 50;
  const rawQuotes = [];
  for (let i = 0; i < symbols.length; i += CHUNK) {
    const chunk = symbols.slice(i, i + CHUNK);
    try {
      const quotes = await yahoo.getQuotes(chunk);
      rawQuotes.push(...quotes);
    } catch {
      // partial failure — skip chunk
    }
  }

  // 5. Normalise
  const quotes = rawQuotes
    .filter(q => q.price && q.price > 0)
    .map(normaliseQuote);

  // 6. Apply DSL filter
  let filtered = quotes;
  if (compiled?.fn) {
    filtered = quotes.filter(q => {
      try { return compiled.fn(q); } catch { return false; }
    });
  }

  // 7. Optionally enrich with bars (RSI, ATR) — top 40 candidates max
  if (bars && filtered.length > 0) {
    const runStorage  = getStorage();
    const candidates  = filtered.slice(0, 40);
    await Promise.allSettled(
      candidates.map(async q => {
        try {
          const barData = await yahoo.getBars(q.symbol, '1d', '3mo');
          runStorage.save(q.symbol, '1d', barData.bars, 'yahoo');
          const closes = barData.bars.map(b => b.close);
          q.rsi14 = calcRSI(closes);
          q.atr14 = calcATR(barData.bars);
        } catch { /* leave null */ }
      })
    );
    // Re-apply filter after RSI enrichment (handles rsi14 conditions)
    if (compiled?.fn) {
      filtered = candidates.filter(q => {
        try { return compiled.fn(q); } catch { return false; }
      });
    } else {
      filtered = candidates;
    }
  }

  // 8. Score each result
  filtered.forEach(q => { q.score = scoreQuote(q, currentRegime); });

  // 9. Sort
  const sortField = sort === 'score' ? 'score' :
                    sort === 'change' ? 'changePct' :
                    sort === 'volume' ? 'volume' :
                    sort === 'rvol'   ? 'rvol' :
                    sort === 'rsi'    ? 'rsi14' : 'score';
  filtered.sort((a, b) => (b[sortField] ?? -Infinity) - (a[sortField] ?? -Infinity));

  // 10. Trim
  const picks = filtered.slice(0, limit);

  return {
    picks,
    meta: {
      universe: univName,
      totalScanned: quotes.length,
      totalPassed: filtered.length,
      regime: currentRegime,
      filter: filter || '(none)',
      barsEnriched: bars,
      timestamp: new Date().toISOString()
    }
  };
}

// ═══════════════════════════════════════════════════════
// BACKTEST
// Given a DSL filter, simulate past performance by fetching
// historical bars and checking when conditions were met.
// ═══════════════════════════════════════════════════════

/**
 * backtest(options) → { results, summary }
 *
 * options:
 *   universe     {string}   Universe name (keep small for speed)
 *   filter       {string}   DSL filter expression
 *   lookback     {number}   Days of history to test (default: 60)
 *   hold_days    {number}   Days to hold after signal (default: 10)
 *   tp_pct       {number}   Take-profit % (default: 5)
 *   stop_pct     {number}   Stop-loss % (default: -3)
 */
export async function backtest(options = {}) {
  const {
    filter       = '',
    lookback     = 60,
    hold_days    = 10,
    tp_pct       = 5,
    stop_pct     = -3
  } = options;

  const univName = options.universe || 'us_large';
  let symbols;
  if (univName.includes(',')) {
    symbols = univName.split(',').map(s => s.trim().toUpperCase());
  } else {
    symbols = await universe.get(univName);
    // If universe key unknown, treat as single ticker
    if (!symbols.length) symbols = [univName.trim().toUpperCase()];
  }
  if (!symbols.length) throw new Error(`Unknown universe: "${univName}"`);

  const compiled = compileDSL(filter);
  if (!compiled.ok) throw new Error(`DSL error: ${compiled.error}`);

  // Fetch 1-year bars — check SQLite storage first (L2 cache), fallback to Yahoo
  const storage  = getStorage();
  const today    = new Date().toISOString().slice(0, 10);
  const allBars  = {};

  await Promise.allSettled(
    symbols.map(async sym => {
      try {
        // Use storage if bars are fresh (latest within 2 calendar days) and sufficient
        const latest   = storage.latestDate(sym, '1d');
        const latestD  = latest ? latest.slice(0, 10) : null;
        const daysOld  = latestD ? Math.floor((Date.now() - new Date(latestD)) / 86_400_000) : 99;
        const barCount = storage.countBars(sym, '1d');

        if (daysOld <= 2 && barCount >= 200) {
          const rows = storage.get(sym, '1d');
          allBars[sym] = rows.map(r => ({
            time: r.time, open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume
          }));
          return;
        }

        // Not cached or stale — fetch from Yahoo and persist
        const { bars } = await yahoo.getBars(sym, '1d', '1y');
        if (bars.length > 20) {
          allBars[sym] = bars;
          storage.save(sym, '1d', bars, 'yahoo');
        }
      } catch { /* skip */ }
    })
  );

  const trades = [];

  for (const [sym, bars] of Object.entries(allBars)) {
    // Walk backwards from today — skip most-recent hold_days (no forward data)
    for (let i = 30; i < bars.length - hold_days; i++) {
      const window = bars.slice(Math.max(0, i - 60), i + 1);
      const closes = window.map(b => b.close);
      const latest = bars[i];

      // Build a synthetic quote from historical data
      const q = {
        price:       latest.close,
        changePct:   closes.length > 1 ? +((closes[closes.length - 1] / closes[closes.length - 2] - 1) * 100).toFixed(2) : 0,
        volume:      latest.volume,
        avgvol3m:    closes.length > 1 ? latest.volume : 0, // simplified
        avgvol10d:   latest.volume,
        rvol:        1,
        marketCapM:  null,
        pe:          null,
        forwardPe:   null,
        beta:        null,
        ema50:       calcEMA(closes, Math.min(50, closes.length)) || latest.close,
        ema200:      calcEMA(closes, Math.min(200, closes.length)) || latest.close,
        high52w:     Math.max(...window.map(b => b.high)),
        low52w:      Math.min(...window.map(b => b.low)),
        rsi14:       calcRSI(closes),
        atr14:       calcATR(window)
      };
      q.pctFromHigh  = q.high52w ? +((q.price - q.high52w) / q.high52w * 100).toFixed(2) : null;
      q.pctFromLow   = q.low52w  ? +((q.price - q.low52w)  / q.low52w  * 100).toFixed(2) : null;
      q.aboveEma50   = q.price >= q.ema50  ? 1 : 0;
      q.aboveEma200  = q.price >= q.ema200 ? 1 : 0;

      // Check if DSL filter matched at this point in time
      let matched = false;
      try { matched = compiled.fn(q); } catch { continue; }
      if (!matched) continue;

      // Simulate holding for hold_days bars
      const entry = latest.close;
      const future = bars.slice(i + 1, i + 1 + hold_days);
      if (future.length < hold_days) continue;

      let exitPrice = future[future.length - 1].close;
      let exitReason = 'timeout';
      let hitTP = false, hitStop = false;

      for (const fb of future) {
        const chg = (fb.high - entry) / entry * 100;
        const chgL = (fb.low - entry) / entry * 100;
        if (chg >= tp_pct) { exitPrice = entry * (1 + tp_pct / 100); exitReason = 'tp'; hitTP = true; break; }
        if (chgL <= stop_pct) { exitPrice = entry * (1 + stop_pct / 100); exitReason = 'stop'; hitStop = true; break; }
      }

      const returnPct = +((exitPrice / entry - 1) * 100).toFixed(2);

      trades.push({
        symbol: sym,
        date:   latest.time.split('T')[0],
        entry,
        exit:   +exitPrice.toFixed(4),
        returnPct,
        exitReason,
        rsi14:  q.rsi14,
        rvol:   q.rvol
      });

      // Only take first signal per symbol (avoid stacking)
      break;
    }
  }

  // Compute summary
  const wins   = trades.filter(t => t.returnPct > 0);
  const losses = trades.filter(t => t.returnPct < 0);
  const avgReturn = trades.length ? +(trades.reduce((s, t) => s + t.returnPct, 0) / trades.length).toFixed(2) : 0;
  const hitRate   = trades.length ? +(wins.length / trades.length * 100).toFixed(1) : 0;
  const bestTrade = trades.length ? trades.reduce((a, b) => a.returnPct > b.returnPct ? a : b) : null;
  const worstTrade = trades.length ? trades.reduce((a, b) => a.returnPct < b.returnPct ? a : b) : null;
  const tpHits   = trades.filter(t => t.exitReason === 'tp').length;
  const stopHits = trades.filter(t => t.exitReason === 'stop').length;

  return {
    summary: {
      universe: univName,
      filter,
      totalTrades:  trades.length,
      hitRate:      `${hitRate}%`,
      avgReturn:    `${avgReturn}%`,
      tpHits,
      stopHits,
      tp_pct:       `${tp_pct}%`,
      stop_pct:     `${stop_pct}%`,
      hold_days,
      bestTrade:    bestTrade ? `${bestTrade.symbol} +${bestTrade.returnPct}% on ${bestTrade.date}` : null,
      worstTrade:   worstTrade ? `${worstTrade.symbol} ${worstTrade.returnPct}% on ${worstTrade.date}` : null,
      grade: gradeResults(hitRate, avgReturn)
    },
    trades: trades.sort((a, b) => b.returnPct - a.returnPct)
  };
}

function gradeResults(hitRate, avgReturn) {
  if (hitRate >= 65 && avgReturn >= 4)  return 'A+';
  if (hitRate >= 60 && avgReturn >= 3)  return 'A';
  if (hitRate >= 55 && avgReturn >= 2)  return 'B+';
  if (hitRate >= 50 && avgReturn >= 1)  return 'B';
  if (hitRate >= 45)                    return 'C';
  return 'D';
}

// ═══════════════════════════════════════════════════════
// AUTO-OPTIMIZE
// Grid-search over numeric thresholds in a DSL filter
// and return the configuration with best backtest grade.
// ═══════════════════════════════════════════════════════

/**
 * optimize(options) → { best, candidates }
 *
 * options:
 *   universe      {string}  Universe name
 *   filter        {string}  DSL with placeholders: $RSI_THRESH, $VOL_MULT, $CHANGE_MIN
 *   param_ranges  {object}  { RSI_THRESH: [25,30,35], VOL_MULT: [1.5,2.0], ... }
 *   hold_days     {number}  Backtest hold period
 */
export async function optimize(options = {}) {
  const {
    filter       = '',
    param_ranges = {},
    hold_days    = 10,
    tp_pct       = 5,
    stop_pct     = -3
  } = options;

  const univName = options.universe || 'us_large';

  // Build cartesian product of parameter combinations
  const paramKeys = Object.keys(param_ranges);
  const combinations = cartesian(Object.values(param_ranges));

  const candidates = [];

  for (const combo of combinations.slice(0, 30)) { // cap at 30 combos
    const params = {};
    paramKeys.forEach((k, i) => { params[k] = combo[i]; });

    // Replace placeholders in filter
    let filledFilter = filter;
    for (const [k, v] of Object.entries(params)) {
      filledFilter = filledFilter.replace(new RegExp(`\\$${k}`, 'g'), String(v));
    }

    try {
      const result = await backtest({ universe: univName, filter: filledFilter, hold_days, tp_pct, stop_pct });
      candidates.push({ params, filter: filledFilter, ...result.summary });
    } catch { /* skip invalid combo */ }
  }

  // Sort by composite score (hit rate + avg return)
  candidates.sort((a, b) => {
    const scoreA = parseFloat(a.hitRate) * 0.6 + parseFloat(a.avgReturn) * 4;
    const scoreB = parseFloat(b.hitRate) * 0.6 + parseFloat(b.avgReturn) * 4;
    return scoreB - scoreA;
  });

  return {
    best:       candidates[0] || null,
    candidates: candidates.slice(0, 10)
  };
}

function cartesian(arrays) {
  return arrays.reduce((acc, arr) => acc.flatMap(x => arr.map(y => [...x, y])), [[]]);
}
