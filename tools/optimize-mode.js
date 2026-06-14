#!/usr/bin/env node
'use strict';

/**
 * optimize-mode.js — READ-ONLY constrained per-mode optimizer.
 *
 * Problem: sweep.js advisor_* gates only on rolling perf thresholds then sorts by
 * raw returnTotal → every mode collapses to the same concentrated pSize=1/topN=1
 * combo, destroying each mode's structural identity (balanced should stay diversified).
 *
 * This tool reuses sweep.js's exported simulateTrade/simulatePortfolio over a focused
 * exit-param grid, but searches portfolio configs WITHIN each mode's structural identity
 * (e.g. balanced = diversified pSize>=3). It ranks by a robustness-aware score that
 * rewards BOTH full-period and out-of-sample (walk-forward) return-to-DD.
 *
 * Writes NOTHING. Pure report. Safe to run anytime.
 *
 * Usage:
 *   node tools/optimize-mode.js                 # all modes
 *   node tools/optimize-mode.js --mode balanced # single mode, verbose top-15
 *   node tools/optimize-mode.js --from 2026-02-15
 */

const fs = require('fs');
const path = require('path');
const sweep = require('./sweep.js'); // require.main !== module → main() does NOT auto-run

const ROOT = path.join(__dirname, '..');
const SCANNER_DIR = path.join(ROOT, 'scanner');

const args = process.argv.slice(2);
const getArg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const ONLY_MODE = getArg('mode', null);
const FROM_DATE = getArg('from', '2026-02-15');
const WR_FLOOR = parseFloat(getArg('wr-floor', '0')); // skip configs below this win rate (cleaner profiles)
const MAXSTOP_FLOOR = parseFloat(getArg('maxstop-floor', '0')); // require maxStopPct >= this (panel's tail-cap)
const OOS_FRAC = 0.70; // walk-forward split — last 30% of scans = out-of-sample

// ── Per-mode structural identity + DD ceiling (the constraint sweep.js lacks) ──
// portfolioSizes/topNs restrict the search to configs that KEEP the mode's character.
// ddCeiling = max acceptable full-period drawdown for that risk profile.
const MODE_SEARCH = {
  turbo:    { portfolioSizes: [1],        topNs: [1],       filters: ['mom_bo','breakout_only','all'],            ddCeiling: 12, minTrades: 12 },
  dynamic:  { portfolioSizes: [1],        topNs: [1],       filters: ['mom_bo','breakout_only','all'],            ddCeiling: 8,  minTrades: 12 },
  balanced: { portfolioSizes: [3,4,5],    topNs: [2,3],     filters: ['mom_bo','breakout_only','no_sq_pb','all'], ddCeiling: 6,  minTrades: 15 },
  secured:  { portfolioSizes: [2,3],      topNs: [2,3],     filters: ['mom_bo','breakout_only','no_sq_pb'],       ddCeiling: 5,  minTrades: 12, horizons: [10,15,20] },
  fortress: { portfolioSizes: [4,5,8],    topNs: [2,3,4],   filters: ['mom_bo','breakout_only','no_sq_pb','all'], ddCeiling: 3,  minTrades: 15 },
  bull:     { portfolioSizes: [2,3],      topNs: [2,3],     filters: ['candlestick_only'],                        ddCeiling: 6,  minTrades: 8 },
};

// ── Focused exit-param grid (keeps pre-sim fast; covers the meaningful knobs) ──
const HORIZONS_DEFAULT = [5, 8, 10];
const TP_COMBOS    = [[false, 0.5], [true, 0.5]]; // [partialTP, partialTPPct]
const TRAIL_MODES  = [false, true];
const MAX_STOPS    = [0, 5, 7];
const ATR_MULTS    = [1, 2, 2.5];   // current balanced=2; widening candidate=2.5
const DAILY_TRAILS = [0];
const BREAKEVENS   = [0, 0.5];
const MIN_SCORES   = [85, 88, 90];
const ROTATIONS    = ['none', 'daily_max1', 'aggressive'];

function loadCurrentConfigs() {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'modes-config.json'), 'utf8'));
  return cfg.modes || {};
}

function loadScans() {
  const scanDirs = fs.readdirSync(SCANNER_DIR)
    .filter(d => /^\d{8}(-\d+)?$/.test(d))
    .filter(d => {
      const date = d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8);
      return date >= FROM_DATE;
    })
    .sort();
  const scans = scanDirs.map(sweep.parseScan).filter(Boolean);
  const allSetups = scans.flatMap(s => {
    const list = s.setups.slice();
    list.push(...(s.tklPool || []));
    return list.map(t => ({ ...t, scanDate: s.scanDate, dir: s.dir, regime: s.regime }));
  });
  return { scans, allSetups };
}

// OOS metrics from the portfolio equity curve (consistent with frozen in/out split).
function oosFromEquity(equityCurve, oosStartDate) {
  if (!equityCurve || equityCurve.length < 2) return { ret: 0, dd: 0 };
  const slice = equityCurve.filter(p => p.date >= oosStartDate);
  if (slice.length < 2) return { ret: 0, dd: 0 };
  const startV = slice[0].value;
  const endV = slice[slice.length - 1].value;
  const ret = +(((endV - startV) / startV) * 100).toFixed(2);
  let peak = slice[0].value, maxDD = 0;
  for (const p of slice) {
    if (p.value > peak) peak = p.value;
    const dd = (p.value - peak) / peak * 100;
    if (dd < maxDD) maxDD = dd;
  }
  return { ret, dd: +maxDD.toFixed(2) };
}

// Robustness-aware score: reward full + OOS return-to-DD. OOS weighted 2x (it's what
// matters going forward). Penalize negative OOS hard. ddSafe avoids div-by-tiny.
function scoreOf(full, oos) {
  const ddSafe = x => Math.max(1.0, Math.abs(x));
  const fullRDD = full.returnTotal / ddSafe(full.maxDD);
  const oosRDD = oos.ret / ddSafe(oos.dd);
  let s = fullRDD + 2 * oosRDD;
  if (oos.ret <= 0) s -= 5;          // OOS must be positive to be deployable
  if (full.returnTotal <= 0) s -= 10;
  return +s.toFixed(3);
}

async function main() {
  console.log('=== Constrained Per-Mode Optimizer (READ-ONLY) ===\n');
  const currentCfgs = loadCurrentConfigs();
  const { scans, allSetups } = loadScans();
  console.log(`Loaded ${scans.length} scans, ${allSetups.length} setups (from ${FROM_DATE})`);

  // Walk-forward split
  const sortedDates = [...new Set(scans.map(s => s.scanDate))].sort();
  const splitIdx = Math.floor(sortedDates.length * OOS_FRAC);
  const oosStartDate = sortedDates[splitIdx];
  console.log(`Walk-forward: ${splitIdx} in-sample / ${sortedDates.length - splitIdx} out-of-sample scans (OOS from ${oosStartDate})\n`);

  // Fetch prices (disk-cached → fast on re-run)
  const tickers = [...new Set(allSetups.map(t => t.ticker))];
  process.stdout.write(`Fetching ${tickers.length} tickers (cached)... `);
  let fetched = 0;
  for (const t of tickers) { await sweep.fetchOHLCV(t); if (++fetched % 50 === 0) process.stdout.write(`${fetched} `); }
  console.log('done\n');

  // Pre-simulate trades for each exit-param combo → keyed trade arrays
  const modesToRun = ONLY_MODE ? [ONLY_MODE] : Object.keys(MODE_SEARCH);
  const horizonsNeeded = [...new Set(modesToRun.flatMap(m => MODE_SEARCH[m].horizons || HORIZONS_DEFAULT))];
  console.log(`Pre-simulating exit grid over horizons [${horizonsNeeded.join(',')}]...`);
  const tradesByKey = {};
  let presim = 0;
  for (const horizon of horizonsNeeded)
    for (const [ptp, ptpPct] of TP_COMBOS)
      for (const trail of TRAIL_MODES)
        for (const maxStop of MAX_STOPS)
          for (const atrMult of ATR_MULTS)
            for (const dailyTrail of DAILY_TRAILS)
              for (const bePct of BREAKEVENS) {
                const key = `${horizon}_${ptp}_${ptpPct}_${trail}_${maxStop}_${atrMult}_${dailyTrail}_${bePct}`;
                const trades = [];
                for (const setup of allSetups) {
                  const r = sweep.simulateTrade(setup, setup.scanDate, sweep.priceCache[setup.ticker], {
                    horizonDays: horizon, partialTP: ptp, partialTPPct: ptpPct, trailingStop: trail,
                    maxStopPct: maxStop, atrStopMult: atrMult, dailyTrailPct: dailyTrail,
                    breakevenPct: bePct, vwapGate: true,
                  });
                  if (r) trades.push({ ...r, regime: setup.regime || null });
                }
                tradesByKey[key] = trades;
                if (++presim % 50 === 0) process.stdout.write(`  ${presim}\r`);
              }
  console.log(`Pre-simulated ${presim} exit combos\n`);

  const STRAT = sweep.STRATEGY_FILTERS_MAP;

  for (const mode of modesToRun) {
    const m = MODE_SEARCH[mode];
    if (!m) { console.log(`(no search profile for ${mode})`); continue; }
    const horizons = m.horizons || HORIZONS_DEFAULT;
    const results = [];

    for (const horizon of horizons)
      for (const [ptp, ptpPct] of TP_COMBOS)
        for (const trail of TRAIL_MODES)
          for (const maxStop of MAX_STOPS)
            for (const atrMult of ATR_MULTS)
              for (const bePct of BREAKEVENS) {
                const key = `${horizon}_${ptp}_${ptpPct}_${trail}_${maxStop}_${atrMult}_0_${bePct}`;
                const trades = tradesByKey[key];
                if (!trades) continue;
                for (const portfolioSize of m.portfolioSizes)
                  for (const topN of m.topNs) {
                    if (topN > portfolioSize) continue;
                    for (const minScore of MIN_SCORES)
                      for (const filterName of m.filters)
                        for (const rotation of ROTATIONS) {
                          const metrics = sweep.simulatePortfolio(trades, scans, {
                            portfolioSize, topN, minScore, rotation,
                            strategyFilter: STRAT[filterName], horizonDays: horizon,
                            partialTP: ptp, trailingStop: trail,
                          });
                          if (!metrics || metrics.trades < m.minTrades) continue;
                          if (metrics.returnTotal <= 0) continue;
                          if (Math.abs(metrics.maxDD) > m.ddCeiling) continue;
                          if (metrics.winRate < WR_FLOOR) continue;
                          if (maxStop < MAXSTOP_FLOOR) continue;
                          const oos = oosFromEquity(metrics.equityCurve, oosStartDate);
                          const score = scoreOf(metrics, oos);
                          results.push({
                            portfolioSize, topN, minScore, filterName, rotation, horizon,
                            partialTP: ptp, trailingStop: trail, maxStopPct: maxStop,
                            atrStopMult: atrMult, breakevenPct: bePct,
                            ret: metrics.returnTotal, dd: metrics.maxDD, wr: metrics.winRate,
                            pf: metrics.profitFactor, calmar: metrics.calmar, sharpe: metrics.sharpe,
                            n: metrics.trades, oosRet: oos.ret, oosDD: oos.dd, score,
                          });
                        }
                  }
              }

    results.sort((a, b) => b.score - a.score);
    const top = results.slice(0, ONLY_MODE ? 15 : 5);

    console.log(`\n========================= ${mode.toUpperCase()} =========================`);
    const c = currentCfgs[mode] || {};
    console.log(`CURRENT: pS=${c.portfolioSize} tN=${c.topN} ms=${c.minScore} ${c.filterName} rot=${c.rotation} h=${c.horizon} pTP=${c.partialTP} trail=${c.trailingStop} maxStop=${c.maxStopPct} atrX=${c.atrStopMult} be=${c.breakevenPct}`);
    console.log(`Searched ${results.length} valid configs (ddCeiling=${m.ddCeiling}%, minTrades=${m.minTrades}). Top ${top.length} by robustness:\n`);
    if (!top.length) { console.log('  ⚠️ No config passed the DD ceiling + minTrades filters. Mode may need relaxed constraints.'); continue; }
    top.forEach((r, i) => {
      console.log(`  #${i + 1} [score=${r.score}] pS=${r.portfolioSize} tN=${r.topN} ms=${r.minScore} ${r.filterName} rot=${r.rotation} h=${r.horizon} pTP=${r.partialTP} trail=${r.trailingStop} maxStop=${r.maxStopPct} atrX=${r.atrStopMult} be=${r.breakevenPct}`);
      console.log(`        FULL: Ret=${r.ret > 0 ? '+' : ''}${r.ret}% DD=${r.dd}% WR=${r.wr}% PF=${r.pf} Cal=${r.calmar} n=${r.n}  |  OOS: Ret=${r.oosRet > 0 ? '+' : ''}${r.oosRet}% DD=${r.oosDD}%`);
    });
  }
  console.log('\n=== Done (no files written) ===');
}

main().catch(e => { console.error('Fatal:', e.message, e.stack); process.exit(1); });
