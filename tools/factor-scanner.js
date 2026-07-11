#!/usr/bin/env node
'use strict';

/**
 * factor-scanner.js — Low-turnover multi-factor scanner (SIM-ONLY, US universe).
 *
 * Builds a monthly-rebalanced, equal-weight factor portfolio on the EXISTING US stock
 * universe (data/tkl-universe.json). Three price-derived factors are z-scored
 * cross-sectionally and summed into a composite; the top-N by composite are held equal-weight
 * and the MONTHLY ROTATION is the exit — there are NO per-name SL/TP in the strategy (same
 * shape as stockbox-scanner.js / IndexRotation). Emits a self-contained `factor_pool` into
 * scanner/YYYYMMDD/signals.json, consumed by sweep.js (assetClass 'us_factor') and rendered
 * on scanner/status like the other scripted modes.
 *
 * ─── FACTORS (what is REALLY computed, from real Yahoo price bars — zero fabrication) ───────
 *   1. momentum_12_1  = adjClose[t-21] / adjClose[t-252] - 1          (Jegadeesh-Titman 12-1,
 *      skips the last month to avoid short-term reversal). Needs >= 253 bars.               [REAL]
 *   2. low_vol        = stdev(daily returns, 120) * sqrt(252)         (6-month realized vol,
 *      annualized). Ranked ASC (less vol = better), so contributes -z(vol).                 [REAL]
 *   3. quality_proxy  = -maxDrawdown(252)                             (a PRICE-BASED robustness
 *      proxy — shallower drawdown = steadier equity = higher "quality" score).              [PROXY]
 *
 *   ⚠️ SCOPE / HONESTY: factor #3 is a *price-based robustness proxy*, NOT the academic
 *   FUNDAMENTAL quality factor (ROE / gross margin / leverage / earnings stability). Those
 *   ratios are NOT available from the price cache and this subprocess makes NO MCP call
 *   (OAuth2 — same constraint as every other scanner here). Fundamental quality is therefore
 *   OUT OF SCOPE for this v1 and left as a documented TODO (would require an AGENT MCP step
 *   `QueryData(types=financials,stats)`, staged to a local file, then read here). We do NOT
 *   invent ROE/margins. See docs/specs/factor-scanners-lowturnover.md §2.1-C.
 *
 * composite(sym) = z(momentum_12_1) + z(-low_vol) + z(quality_proxy)   (equal-weighted z-sum)
 *   • cross-sectional z over the ELIGIBLE universe of the scan (recomputed each rebalance)
 *   • rank composite DESC, tie-break symbol ASC (deterministic, byte-for-byte)
 *   • hold the top-N equal-weight (1/N); rotation IS the exit (no per-name stops)
 *
 * ─── LOW-TURNOVER MECHANICS ─────────────────────────────────────────────────────────────────
 *   The scan runs daily inside /scanner, but the portfolio only CHANGES on a rebalance day
 *   (every 21 trading days since the mode's statusSince). On non-rebalance days the scanner
 *   RE-EMITS the last committed basket verbatim (rebalance_day:false, holdings frozen) so the
 *   sim doesn't churn the book daily — that is what makes turnover low and tax-efficient.
 *
 * ─── SIM-ONLY BORNE ─────────────────────────────────────────────────────────────────────────
 *   Output stops at simulation + signals (a factor_pool + a walk-forward backtest). NO paper,
 *   NO live broker, NO order execution. Disaster-stop fields (stop = entry×0.75, tp1 far) are
 *   INFORMATIONAL only — they exist so sweep.js can simulate a downstream safety net, they are
 *   NOT part of the strategy.
 *
 * Cache: shared DATED cache (tools/lib/price-cache.js), market=US interval=1d — point-in-time,
 * replayable, anti-look-ahead. Backtest fetches the full 2y series once and slices PIT in memory.
 *
 * Usage:
 *   node tools/factor-scanner.js --dry-run
 *   node tools/factor-scanner.js --backtest                 # walk-forward metrics (real bars)
 *   node tools/factor-scanner.js --date 2026-07-11 --top 15
 *   node tools/factor-scanner.js --output signals --folder 20260711
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const priceCache = require('./lib/price-cache');

const ROOT = path.join(__dirname, '..');

// ─── Strategy params (FIGÉ — the factor definitions are academic, not tuned) ──────────────────
// Only the GUARD-RAILS (topN, liquidity floor, disaster-stop) are optimizable (Mountain Plateau);
// the 252/21 lookbacks and the factor formulae are NEVER tuned (anti data-snooping — see spec §4).
const MOM_LOOKBACK = 252;   // ~12 months
const MOM_SKIP = 21;        // skip the last ~1 month (12-1)
const VOL_WINDOW = 120;     // ~6 months realized vol
const DD_WINDOW = 252;      // ~12 months max drawdown (quality proxy)
const REBALANCE_DAYS = 21;  // monthly rebalance
const DEFAULT_TOP_N = 15;   // equal-weight lines
const MIN_BARS = MOM_LOOKBACK + MOM_SKIP + 2; // need t-252 .. t-21 present (+margin)
const MIN_DOLLAR_VOL = 2_000_000; // $2M/day median — tradable, capacity-friendly floor
const DISASTER_STOP_PCT = 25;     // informational downstream net (NOT a strategy stop)
const FAR_TP_PCT = 50;            // informational far target so sweep buildSetups keeps the row
// Hysteresis buffer (a GUARD-RAIL, not factor tuning): an incumbent is kept as long as it is
// still ranked within topN×BUFFER_MULT; only names that fall out of the buffer zone are sold.
// This is the standard low-turnover lever — it cuts rebalance churn well below the 40% tripwire
// without touching the factor definitions. Free slots are filled by the highest-ranked non-held.
const BUFFER_MULT = 1.5;

// ─── CLI ──────────────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}
const hasFlag = name => args.includes(`--${name}`);

const TOP_N = parseInt(getArg('top', String(DEFAULT_TOP_N)), 10);
const OUTPUT_MODE = getArg('output', 'stdout');
const DRY_RUN = hasFlag('dry-run');
const BACKTEST = hasFlag('backtest');
const SCAN_DATE = getArg('date', new Date().toISOString().slice(0, 10));
const SCAN_FOLDER = getArg('folder', null);
const CONCURRENCY = parseInt(getArg('concurrency', '10'), 10);
const UNIVERSE_ARG = getArg('universe', 'data/tkl-universe.json');
const MIN_DVOL = parseFloat(getArg('min-dollar-vol', String(MIN_DOLLAR_VOL)));

const CACHE_OPTS = { date: SCAN_DATE, market: priceCache.MARKETS.US, interval: '1d' };

// ─── Universe (existing US stock list — no new/risky data source) ───────────────────────────────
function loadUniverse(arg) {
  const fp = path.isAbsolute(arg) ? arg : path.join(ROOT, arg);
  const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const list = Array.isArray(raw) ? raw : (raw.stocks || raw.tickers || raw.symbols || []);
  const out = [];
  for (const e of list) {
    const sym = typeof e === 'string' ? e : e.symbol;
    if (sym && !sym.startsWith('^')) out.push(sym);
  }
  return Array.from(new Set(out));
}

// ─── Yahoo OHLCV fetcher (shared dated cache; backtest uses the raw 2y series) ──────────────────
function readCache(ticker) {
  const bars = priceCache.readBars(ticker, CACHE_OPTS);
  if (bars && bars.length >= MIN_BARS) return bars;
  return null;
}

function fetchOHLCV(ticker, writeCache, range = '2y') {
  return new Promise((resolve) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=1d`;
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
              adjClose: adj?.[i] != null ? adj[i] : c2, volume: v || 0,
            });
          }
          if (writeCache && bars.length >= MIN_BARS) {
            // writeBars TRUNCATES to bar.date <= SCAN_DATE (anti-look-ahead; no-op forward).
            priceCache.writeBars(ticker, bars, CACHE_OPTS);
          }
          resolve(bars.length >= MIN_BARS ? bars : null);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null)).on('timeout', function () { this.destroy(); resolve(null); });
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// batchFetch: cache-first for forward scans; the backtest passes useCache=false to always pull
// the full 2y series (it slices PIT itself). Bounded retry makes the ~586-name pull deterministic.
async function batchFetch(tickers, concurrency, useCache = true, range = '2y') {
  const result = new Map();
  let cached = 0;
  async function pass(list, conc) {
    const queue = [...list];
    const failed = [];
    async function worker() {
      while (queue.length) {
        const t = queue.shift();
        let bars = useCache ? readCache(t) : null;
        if (bars) { cached++; } else { bars = await fetchOHLCV(t, useCache, range); }
        if (bars) result.set(t, bars);
        else failed.push(t);
      }
    }
    await Promise.all(Array.from({ length: conc }, () => worker()));
    return failed;
  }
  let failed = await pass(tickers, concurrency);
  for (let r = 0; r < 3 && failed.length > 0; r++) {
    process.stderr.write(`  retry ${r + 1}/3: ${failed.length} symbols (rate-limit recovery)\n`);
    await sleep(1200 * (r + 1));
    failed = await pass(failed, Math.max(3, Math.floor(concurrency / 2)));
  }
  process.stderr.write(`  fetched ${result.size}/${tickers.length} valid (${cached} cached, ${failed.length} unresolved)\n`);
  return result;
}

// ─── Factor math (all point-in-time on a truncated bar slice) ───────────────────────────────────
const px = b => (b.adjClose != null ? b.adjClose : b.close);

// Momentum 12-1: px[n-1-skip] / px[n-1-lookback] - 1.
function momentum12_1(bars) {
  const n = bars.length;
  if (n < MOM_LOOKBACK + MOM_SKIP + 1) return null;
  const recent = px(bars[n - 1 - MOM_SKIP]);
  const old = px(bars[n - 1 - MOM_LOOKBACK]);
  if (!(old > 0) || !(recent > 0)) return null;
  return recent / old - 1;
}

// Realized annualized vol over the last VOL_WINDOW daily returns. Also returns the share of
// zero-volume days in the window (illiquidity guard — a "low vol" that is really no-quotation).
function realizedVol(bars) {
  const n = bars.length;
  if (n < VOL_WINDOW + 1) return null;
  const rets = [];
  let zeroVolDays = 0;
  for (let i = n - VOL_WINDOW; i < n; i++) {
    const p0 = px(bars[i - 1]), p1 = px(bars[i]);
    if (p0 > 0) rets.push(p1 / p0 - 1);
    if (!(bars[i].volume > 0)) zeroVolDays++;
  }
  if (rets.length < 2) return null;
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  const varc = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1);
  return { vol: Math.sqrt(varc) * Math.sqrt(252), zeroFrac: zeroVolDays / VOL_WINDOW };
}

// Max drawdown over the last DD_WINDOW bars (positive fraction, e.g. 0.30 = -30%). Quality proxy
// = -maxDD (shallower drawdown ranks higher).
function maxDrawdown(bars) {
  const n = bars.length;
  if (n < DD_WINDOW) return null;
  let peak = -Infinity, maxDD = 0;
  for (let i = n - DD_WINDOW; i < n; i++) {
    const p = px(bars[i]);
    if (p > peak) peak = p;
    if (peak > 0) { const dd = (peak - p) / peak; if (dd > maxDD) maxDD = dd; }
  }
  return maxDD;
}

// Median dollar volume over the trailing 20 bars (liquidity floor).
function medianDollarVol(bars, period = 20) {
  const n = bars.length;
  if (n < period) return 0;
  const dv = [];
  for (let i = n - period; i < n; i++) dv.push(px(bars[i]) * (bars[i].volume || 0));
  dv.sort((a, b) => a - b);
  return dv[Math.floor(period / 2)];
}

function zscores(values) {
  const n = values.length;
  if (!n) return [];
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const varc = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const sd = Math.sqrt(varc);
  if (!(sd > 0)) return values.map(() => 0);
  return values.map(v => (v - mean) / sd);
}

// Truncate raw bars to <= asOf (PIT). asOf = 'YYYY-MM-DD'.
function sliceTo(rawBars, asOf) {
  const norm = asOf.replace(/-/g, '');
  const cut = rawBars.findIndex(b => b.date.replace(/-/g, '') > norm);
  return cut > 0 ? rawBars.slice(0, cut) : rawBars;
}

// Core ranking: from a Map<sym, barsSliced> compute composite z-sum and return sorted eligible.
// Each eligible carries the raw factor values + the composite. Deterministic (composite desc,
// symbol asc). Names lacking any factor (too few bars / illiquid) are EXCLUDED (never invented).
function rankComposite(barsBySym, minDvol) {
  const rows = [];
  for (const [sym, bars] of barsBySym) {
    const mom = momentum12_1(bars);
    const rv = realizedVol(bars);
    const mdd = maxDrawdown(bars);
    if (mom == null || rv == null || mdd == null) continue;       // fail-closed: missing factor
    if (rv.zeroFrac > 0.20) continue;                              // illiquid "low vol" trap
    const dvol = medianDollarVol(bars, 20);
    if (dvol < minDvol) continue;                                 // liquidity floor
    const last = bars[bars.length - 1];
    rows.push({
      symbol: sym, mom, vol: rv.vol, maxDD: mdd, dvol,
      entry: last.close, asOf: last.date,
    });
  }
  if (!rows.length) return [];
  // Winsorize each z at ±3 so no single fat-tailed factor (momentum) can swamp the blend —
  // a genuine multi-factor composite, not a momentum proxy. Standard robustification, not
  // tuning of the factor definitions themselves.
  const clip = z => Math.max(-3, Math.min(3, z));
  const zMom = zscores(rows.map(r => r.mom)).map(clip);
  const zVolNeg = zscores(rows.map(r => -r.vol)).map(clip);   // less vol = better
  const zQual = zscores(rows.map(r => -r.maxDD)).map(clip);   // shallower DD = better
  rows.forEach((r, i) => { r.composite = zMom[i] + zVolNeg[i] + zQual[i]; });
  rows.sort((a, b) => (b.composite - a.composite) || (a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0));
  return rows;
}

// Hysteresis buffer: given the freshly-ranked eligible rows and the previously-held symbols,
// return the top-N to hold. Incumbents still inside the buffer zone (rank < N×BUFFER_MULT) are
// retained first; remaining slots go to the highest-ranked non-incumbents. Deterministic.
function applyBuffer(ranked, prevHold, topN) {
  if (!prevHold || !prevHold.size) return ranked.slice(0, topN);
  const bufferSize = Math.ceil(topN * BUFFER_MULT);
  const bufferZone = new Set(ranked.slice(0, bufferSize).map(r => r.symbol));
  const held = [], fresh = [];
  for (const r of ranked) {
    if (prevHold.has(r.symbol) && bufferZone.has(r.symbol)) held.push(r);
    else fresh.push(r);
  }
  const out = held.slice(0, topN);
  for (const r of fresh) { if (out.length >= topN) break; out.push(r); }
  // Preserve composite order for stable rank labels.
  out.sort((a, b) => (b.composite - a.composite) || (a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0));
  return out;
}

// Display score in a sane [1,98] band, monotonic with the composite (rank is the real signal).
function displayScore(composite) {
  return Math.max(1, Math.min(98, Math.round(50 + composite * 12)));
}

// ─── modes-config: statusSince + rebalance-day detection ────────────────────────────────────────
function factorStatusSince() {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'modes-config.json'), 'utf8'));
    const modes = m.modes || m;
    const since = modes.factor?.statusSince;
    return since ? since.slice(0, 10) : null;
  } catch { return null; }
}

// Count SPY trading bars in (since, asOf]. Deterministic PIT rebalance clock.
function tradingDaysSince(spyBars, since, asOf) {
  if (!spyBars || !since) return null;
  const s = since.replace(/-/g, ''), a = asOf.replace(/-/g, '');
  let count = 0;
  for (const b of spyBars) {
    const d = b.date.replace(/-/g, '');
    if (d > s && d <= a) count++;
  }
  return count;
}

// Find the most recent prior scanner/*/signals.json with a non-empty factor_pool (for freeze).
function lastCommittedPool(beforeDir) {
  const scanRoot = path.join(ROOT, 'scanner');
  let dirs;
  try { dirs = fs.readdirSync(scanRoot).filter(d => /^\d{8}$/.test(d)); } catch { return null; }
  dirs = dirs.filter(d => d < beforeDir).sort().reverse();
  for (const d of dirs) {
    try {
      const s = JSON.parse(fs.readFileSync(path.join(scanRoot, d, 'signals.json'), 'utf8'));
      if (Array.isArray(s.factor_pool) && s.factor_pool.length) return s.factor_pool;
    } catch { /* skip */ }
  }
  return null;
}

// ─── Build the factor_pool objects (rotation = exit; disaster-stop is informational only) ───────
function buildPool(top, weight, rebalanceDay) {
  return top.map((r, i) => {
    const entry = +r.entry.toFixed(2);
    const stop = +(entry * (1 - DISASTER_STOP_PCT / 100)).toFixed(2);
    const tp1 = +(entry * (1 + FAR_TP_PCT / 100)).toFixed(2);
    const rr = +((tp1 - entry) / Math.max(1e-6, entry - stop)).toFixed(2);
    return {
      ticker: r.symbol, name: r.symbol,
      rank: i + 1,
      score: displayScore(r.composite),
      weight,
      strategy: 'FactorComposite', region: 'US', universe: 'factor',
      entry, stop, tp1, tp2: null, rr: `1:${rr.toFixed(2)}`,
      horizon: REBALANCE_DAYS,
      rebalance_day: rebalanceDay,
      sharia: null,
      thesis: `Factor composite rank #${i + 1}: 12-1 mom ${(r.mom * 100).toFixed(1)}%, vol ${(r.vol * 100).toFixed(0)}%, maxDD ${(r.maxDD * 100).toFixed(0)}% — equal-weight, monthly rebalance`,
      extension: {
        composite: +r.composite.toFixed(3),
        momentum_12_1: +r.mom.toFixed(4),
        vol_annualized: +r.vol.toFixed(4),
        max_drawdown: +r.maxDD.toFixed(4),
        rank: i + 1, weight, rebalanceDays: REBALANCE_DAYS,
        factorsReal: ['momentum_12_1', 'low_vol'], factorProxy: ['quality=-maxDD (price-based)'],
      },
    };
  });
}

// ─── Walk-forward backtest (real bars, monthly rebalance, equal-weight) ─────────────────────────
async function runBacktest(universe) {
  console.log('📈 Factor composite — walk-forward backtest (monthly rebalance, equal-weight)');
  console.log(`   Universe: ${universe.length} US names | top-${TOP_N} | rebalance ${REBALANCE_DAYS}d | liq floor $${(MIN_DVOL / 1e6).toFixed(1)}M`);
  console.log('📡 Fetching 5y bars (Yahoo)...');
  const data = await batchFetch(universe, CONCURRENCY, /*useCache*/ false, '5y');
  if (data.size < 20) { console.error(`❌ Only ${data.size} names with data — cannot backtest.`); process.exit(1); }

  // Build a common trading-date axis from SPY (fetch if not in universe).
  let spy = data.get('SPY');
  if (!spy) spy = await fetchOHLCV('SPY', false, '5y');
  if (!spy) { console.error('❌ No SPY calendar — cannot backtest.'); process.exit(1); }
  const dates = spy.map(b => b.date);

  // Rebalance indices: every REBALANCE_DAYS starting once we have MIN_BARS of history.
  const startIdx = MIN_BARS;
  const rebalIdx = [];
  for (let i = startIdx; i < dates.length - 1; i += REBALANCE_DAYS) rebalIdx.push(i);
  if (rebalIdx.length < 3) { console.error('❌ Too few rebalance points in 2y — cannot backtest.'); process.exit(1); }

  let equity = 1.0;
  const equityCurve = [{ date: dates[rebalIdx[0]], equity }];
  let prevHold = new Set();
  const turnovers = [], periodRets = [];
  let peak = equity, maxDD = 0;

  for (let k = 0; k < rebalIdx.length - 1; k++) {
    const asOf = dates[rebalIdx[k]];
    const nextDate = dates[rebalIdx[k + 1]];
    // PIT ranking at asOf
    const sliced = new Map();
    for (const [sym, bars] of data) {
      if (sym === 'SPY') continue;
      const s = sliceTo(bars, asOf);
      if (s.length >= MIN_BARS) sliced.set(sym, s);
    }
    const ranked = rankComposite(sliced, MIN_DVOL);
    if (!ranked.length) { equityCurve.push({ date: nextDate, equity }); continue; }
    const hold = applyBuffer(ranked, prevHold, TOP_N);
    const holdSet = new Set(hold.map(h => h.symbol));

    // Forward equal-weight return asOf -> nextDate (close to close, PIT-safe).
    let ret = 0, counted = 0;
    for (const h of hold) {
      const bars = data.get(h.symbol);
      const b0 = bars.find(b => b.date === asOf);
      const b1 = bars.find(b => b.date === nextDate);
      if (!b0 || !b1 || !(px(b0) > 0)) continue;
      ret += (px(b1) / px(b0) - 1);
      counted++;
    }
    if (counted > 0) ret /= counted;
    periodRets.push(ret);
    equity *= (1 + ret);
    if (equity > peak) peak = equity;
    const dd = (peak - equity) / peak; if (dd > maxDD) maxDD = dd;
    equityCurve.push({ date: nextDate, equity: +equity.toFixed(4) });

    // Turnover = |new \ old| / N (share of the book that changed).
    if (prevHold.size) {
      let changed = 0;
      for (const s of holdSet) if (!prevHold.has(s)) changed++;
      turnovers.push(changed / holdSet.size);
    }
    prevHold = holdSet;
  }

  const nP = periodRets.length;
  const totalRet = equity - 1;
  const years = nP * REBALANCE_DAYS / 252;
  const cagr = years > 0 ? Math.pow(equity, 1 / years) - 1 : 0;
  const meanR = periodRets.reduce((s, r) => s + r, 0) / nP;
  const sdR = Math.sqrt(periodRets.reduce((s, r) => s + (r - meanR) ** 2, 0) / Math.max(1, nP - 1));
  const periodsPerYear = 252 / REBALANCE_DAYS;
  const sharpe = sdR > 0 ? (meanR / sdR) * Math.sqrt(periodsPerYear) : 0;
  const winRate = periodRets.filter(r => r > 0).length / nP;
  const avgTurnover = turnovers.length ? turnovers.reduce((s, t) => s + t, 0) / turnovers.length : 0;

  console.log('\n─── BACKTEST RESULTS (real Yahoo bars, sim-only) ───────────────────────────');
  console.log(`   Rebalances:      ${nP} (~${years.toFixed(2)}y, ${dates[rebalIdx[0]]} → ${dates[rebalIdx[nP]]})`);
  console.log(`   Total return:    ${(totalRet * 100).toFixed(1)}%`);
  console.log(`   CAGR:            ${(cagr * 100).toFixed(1)}%`);
  console.log(`   Max drawdown:    ${(maxDD * 100).toFixed(1)}%`);
  console.log(`   Sharpe (ann.):   ${sharpe.toFixed(2)}`);
  console.log(`   Win rate:        ${(winRate * 100).toFixed(0)}% of months`);
  console.log(`   Avg turnover:    ${(avgTurnover * 100).toFixed(1)}% of book / rebalance  ${avgTurnover <= 0.40 ? '✅ low-turnover' : '⚠️ HIGH (>40%)'}`);
  console.log(`   Avg lines held:  ${TOP_N} (equal-weight ${(100 / TOP_N).toFixed(1)}%)`);
  console.log('────────────────────────────────────────────────────────────────────────────');
  return { cagr, maxDD, sharpe, winRate, avgTurnover, totalRet, rebalances: nP, equityCurve };
}

// ─── Main ───────────────────────────────────────────────────────────────────────────────────────
async function main() {
  const universe = loadUniverse(UNIVERSE_ARG);

  if (BACKTEST) { await runBacktest(universe); return; }

  console.log('🧮 Factor Scanner (momentum 12-1 / low-vol / quality-proxy composite, low-turnover)');
  console.log(`   Universe: ${universe.length} US names (${path.basename(UNIVERSE_ARG)}) | top-${TOP_N} | rebalance ${REBALANCE_DAYS}d`);
  console.log(`   Date: ${SCAN_DATE} | liquidity floor $${(MIN_DVOL / 1e6).toFixed(1)}M/day`);

  // Rebalance-day clock (SPY calendar since the mode's statusSince). Bootstrap = rebalance.
  const scanDir = SCAN_FOLDER || SCAN_DATE.replace(/-/g, '');
  const since = factorStatusSince();
  let spyBars = readCache('SPY') || await fetchOHLCV('SPY', true);
  const tds = tradingDaysSince(spyBars, since, SCAN_DATE);
  const prior = lastCommittedPool(scanDir);
  // Rebalance if: no statusSince yet, no prior committed basket (bootstrap), or on the 21d beat.
  const isRebalanceDay = (tds == null) || (prior == null) || (tds % REBALANCE_DAYS === 0);
  console.log(`   Rebalance clock: ${tds == null ? 'n/a' : tds + ' trading days since ' + since} → ${isRebalanceDay ? 'REBALANCE' : 'frozen (hold last basket)'}`);

  let pool;
  if (!isRebalanceDay && prior) {
    // Freeze: re-emit the last committed basket verbatim (low-turnover), just flip the flag.
    pool = prior.map(p => ({ ...p, rebalance_day: false }));
    console.log(`   Holding ${pool.length} frozen positions (next rebalance in ${REBALANCE_DAYS - (tds % REBALANCE_DAYS)} trading days).`);
  } else {
    console.log('📡 Fetching OHLCV (shared dated cache)...');
    const data = await batchFetch(universe, CONCURRENCY, true);
    if (!data.size) { console.error('❌ No OHLCV data — aborting (MCP/data hard-stop, nothing fabricated).'); process.exit(1); }
    // PIT slice each series to <= SCAN_DATE.
    const sliced = new Map();
    for (const [sym, bars] of data) { const s = sliceTo(bars, SCAN_DATE); if (s.length >= MIN_BARS) sliced.set(sym, s); }
    const ranked = rankComposite(sliced, MIN_DVOL);
    if (ranked.length < TOP_N) {
      console.error(`⚠️  Only ${ranked.length} eligible names (< ${TOP_N}) — emitting what is real, nothing invented.`);
    }
    // Hysteresis vs the last committed basket (low-turnover). Bootstrap → plain top-N.
    const prevHold = new Set((prior || []).map(p => p.ticker));
    const top = applyBuffer(ranked, prevHold, TOP_N);
    const weight = +(1 / Math.max(1, top.length)).toFixed(4);
    pool = buildPool(top, weight, true);
    console.log(`\n✅ Ranked ${ranked.length} eligible, holding top ${top.length} (equal-weight ${(weight * 100).toFixed(1)}%):`);
    top.forEach((r, i) => console.log(`  ${String(i + 1).padStart(2)}. ${r.symbol.padEnd(6)} comp:${r.composite.toFixed(2).padStart(6)}  mom:${(r.mom * 100).toFixed(1).padStart(6)}%  vol:${(r.vol * 100).toFixed(0).padStart(3)}%  maxDD:${(r.maxDD * 100).toFixed(0).padStart(3)}%`));
  }

  if (DRY_RUN) { console.log('\n🏷️  Dry run — no files written.'); return pool; }

  if (OUTPUT_MODE === 'json') {
    const outPath = path.join(ROOT, 'data', `factor-scan-${SCAN_DATE}.json`);
    fs.writeFileSync(outPath, JSON.stringify({ scanDate: SCAN_DATE, topN: TOP_N, rebalanceDays: REBALANCE_DAYS, rebalanceDay: isRebalanceDay, candidates: pool }, null, 2));
    console.log(`\n📁 Written to ${outPath}`);
  } else if (OUTPUT_MODE === 'signals') {
    const sigPath = path.join(ROOT, 'scanner', scanDir, 'signals.json');
    if (!fs.existsSync(sigPath)) { console.error(`❌ ${sigPath} not found`); process.exit(1); }
    const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
    signals.factor_pool = pool; // self-contained basket — consumed by sweep (assetClass us_factor)
    if (!signals._scanRuns) signals._scanRuns = {};
    signals._scanRuns.factor = {
      at: new Date().toISOString(), universe: 'factor',
      rebalanceDay: isRebalanceDay, signals: pool.length,
    };
    fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
    console.log(`\n📁 Wrote factor_pool (${pool.length}, ${isRebalanceDay ? 'rebalance' : 'frozen'}) to ${sigPath}`);
  }
  return pool;
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
