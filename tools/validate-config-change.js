#!/usr/bin/env node
'use strict';

/**
 * validate-config-change.js — READ-ONLY A/B validator for mode config changes.
 *
 * Simulates named config variants over the full scan history using sweep.js's
 * exported simulateTrade/simulatePortfolio, INCLUDING regimeFilters (so numbers
 * match the live frozen path, not the optimizer's static-filter approximation).
 *
 * Reports full-period + out-of-sample (walk-forward) Return/DD/WR/PF per variant.
 * Writes NOTHING.
 *
 * Edit the VARIANTS array below to compare proposals, then:
 *   node tools/validate-config-change.js
 */

const fs = require('fs');
const path = require('path');
const sweep = require('./sweep.js');

const ROOT = path.join(__dirname, '..');
const SCANNER_DIR = path.join(ROOT, 'scanner');
const FROM_DATE = '2026-02-15';
const OOS_FRAC = 0.70;

const CUR = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'modes-config.json'), 'utf8')).modes;

// Build a full config from a base mode + overrides. Mirrors cfg2 in sweep.js main().
function cfgFrom(baseModeId, overrides = {}) {
  const c = { ...CUR[baseModeId], ...overrides };
  if (overrides.regimeFilters) c.regimeFilters = overrides.regimeFilters;
  return c;
}

// ── Variants to compare. Each: { label, base, cfg } ──
// Define proposals against each mode's current config.
const VARIANTS = [
  // BALANCED — the priority
  { label: 'balanced CURRENT', base: 'balanced', cfg: {} },
  { label: 'balanced FIX regimeFilter early_risk_off->breakout', base: 'balanced', cfg: {
      regimeFilters: { risk_on: 'mom_bo', early_risk_off: 'breakout_only', risk_off: 'breakout_only', neutral: 'mom_bo', recovery: 'mom_bo' },
  }},
  { label: 'balanced FIX +neutral->breakout +maxStop5 +grace4', base: 'balanced', cfg: {
      regimeFilters: { risk_on: 'mom_bo', early_risk_off: 'breakout_only', risk_off: 'breakout_only', neutral: 'breakout_only', recovery: 'mom_bo' },
      maxStopPct: 5, trailGraceDays: 4,
  }},
  { label: 'balanced FULL breakout (static) +maxStop5 +grace4 +atrX1 noTrail', base: 'balanced', cfg: {
      filterName: 'breakout_only',
      regimeFilters: { risk_on: 'breakout_only', early_risk_off: 'breakout_only', risk_off: 'breakout_only', neutral: 'breakout_only', recovery: 'breakout_only' },
      maxStopPct: 5, atrStopMult: 1, trailingStop: false, partialTP: false, rotation: 'daily_max1', minScore: 88,
  }},

  // FORTRESS
  { label: 'fortress CURRENT', base: 'fortress', cfg: {} },
  { label: 'fortress FIX early_risk_off->breakout +maxStop5', base: 'fortress', cfg: {
      regimeFilters: { risk_on: 'mom_bo', early_risk_off: 'breakout_only', risk_off: 'breakout_only', neutral: 'mom_bo', recovery: 'mom_bo' },
      maxStopPct: 5,
  }},

  // DYNAMIC
  { label: 'dynamic CURRENT', base: 'dynamic', cfg: {} },
  { label: 'dynamic +maxStop6 +early_risk_off->breakout', base: 'dynamic', cfg: {
      regimeFilters: { risk_on: 'mom_bo', early_risk_off: 'breakout_only', risk_off: 'breakout_only', neutral: 'mom_bo', recovery: 'mom_bo' },
      maxStopPct: 6,
  }},

  // TURBO (safety only — keep strategy)
  { label: 'turbo CURRENT', base: 'turbo', cfg: {} },
  { label: 'turbo +maxStop6', base: 'turbo', cfg: { maxStopPct: 6 } },
];

function oosFromEquity(equityCurve, oosStartDate) {
  if (!equityCurve || equityCurve.length < 2) return { ret: 0, dd: 0 };
  const slice = equityCurve.filter(p => p.date >= oosStartDate);
  if (slice.length < 2) return { ret: 0, dd: 0 };
  const startV = slice[0].value, endV = slice[slice.length - 1].value;
  const ret = +(((endV - startV) / startV) * 100).toFixed(2);
  let peak = slice[0].value, maxDD = 0;
  for (const p of slice) { if (p.value > peak) peak = p.value; const dd = (p.value - peak) / peak * 100; if (dd < maxDD) maxDD = dd; }
  return { ret, dd: +maxDD.toFixed(2) };
}

function exitKey(c) {
  // Build the pre-sim key for a config's exit params (matches sweep.js tradesByKey schema subset)
  return [c.horizon, c.partialTP || false, c.partialTPPct || 0.5, c.trailingStop || false,
    c.maxStopPct || 0, c.atrStopMult || 0, c.dailyTrailPct || 0, c.breakevenPct || 0,
    c.beGraceDays || 0, c.staleGraceDays || 0, c.staleRaiseRate ?? 0.001, c.staleAccel || 'log',
    c.partialTPGain || 0, c.disableTP2 || false, c.entryGatePct || 0, c.vwapGate || false,
    c.trailMultR ?? 1.5, c.trailGraceDays ?? 0].join('_');
}

async function main() {
  console.log('=== Config-Change A/B Validator (READ-ONLY, regime-aware) ===\n');
  const scanDirs = fs.readdirSync(SCANNER_DIR)
    .filter(d => /^\d{8}(-\d+)?$/.test(d))
    .filter(d => (d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6,8)) >= FROM_DATE)
    .sort();
  const scans = scanDirs.map(sweep.parseScan).filter(Boolean);
  const allSetups = scans.flatMap(s => {
    const list = s.setups.slice(); list.push(...(s.tklPool || []));
    return list.map(t => ({ ...t, scanDate: s.scanDate, dir: s.dir, regime: s.regime }));
  });
  const sortedDates = [...new Set(scans.map(s => s.scanDate))].sort();
  const oosStartDate = sortedDates[Math.floor(sortedDates.length * OOS_FRAC)];
  console.log(`${scans.length} scans, ${allSetups.length} setups, OOS from ${oosStartDate}\n`);

  const tickers = [...new Set(allSetups.map(t => t.ticker))];
  process.stdout.write(`Fetching ${tickers.length} tickers (cached)... `);
  for (const t of tickers) await sweep.fetchOHLCV(t);
  console.log('done\n');

  // Pre-sim trades per unique exit key needed by variants
  const tradeCache = {};
  function tradesFor(c) {
    const k = exitKey(c);
    if (tradeCache[k]) return tradeCache[k];
    const trades = [];
    for (const setup of allSetups) {
      const r = sweep.simulateTrade(setup, setup.scanDate, sweep.priceCache[setup.ticker], {
        horizonDays: c.horizon, partialTP: c.partialTP || false, partialTPPct: c.partialTPPct || 0.5,
        trailingStop: c.trailingStop || false, maxStopPct: c.maxStopPct || 0, atrStopMult: c.atrStopMult || 0,
        dailyTrailPct: c.dailyTrailPct || 0, breakevenPct: c.breakevenPct || 0, beGraceDays: c.beGraceDays || 0,
        staleGraceDays: c.staleGraceDays || 0, staleRaiseRate: c.staleRaiseRate ?? 0.001, staleAccel: c.staleAccel || 'log',
        partialTPGain: c.partialTPGain || 0, disableTP2: c.disableTP2 || false,
        entryGatePct: c.entryGatePct || 0, vwapGate: c.vwapGate || false,
        trailMultR: c.trailMultR ?? 1.5, trailGraceDays: c.trailGraceDays ?? 0,
        postWideningRRMin: c.postWideningRRMin || 0, blacklist: c.blacklist || null,
      });
      if (r) trades.push({ ...r, regime: setup.regime || null });
    }
    tradeCache[k] = trades;
    return trades;
  }

  const STRAT = sweep.STRATEGY_FILTERS_MAP;
  const rows = [];
  for (const v of VARIANTS) {
    const c = cfgFrom(v.base, v.cfg);
    const trades = tradesFor(c);
    const m = sweep.simulatePortfolio(trades, scans, {
      portfolioSize: c.portfolioSize, topN: c.topN, minScore: c.minScore || 0, rotation: c.rotation,
      strategyFilter: STRAT[c.filterName], horizonDays: c.horizon, partialTP: c.partialTP || false,
      trailingStop: c.trailingStop || false, regimeFilters: c.regimeFilters || null,
      ddBreakerPct: c.ddBreakerPct ?? 0, sectorCapMax: c.sectorCapMax ?? 0,
      correlationCap: c.correlationCap ?? 0, vixKillThreshold: c.vixKillThreshold ?? 0,
      circuitBreakerStops: c.circuitBreakerStops ?? 0, circuitBreakerWindow: c.circuitBreakerWindow ?? 5,
      circuitBreakerPause: c.circuitBreakerPause ?? 3, positionSizePct: c.positionSizePct || 1,
      sizingMethod: c.sizingMethod || null, targetRiskPct: c.targetRiskPct ?? 0,
    });
    if (!m) { rows.push({ label: v.label, err: 'no metrics' }); continue; }
    const oos = oosFromEquity(m.equityCurve, oosStartDate);
    rows.push({ label: v.label, ret: m.returnTotal, dd: m.maxDD, wr: m.winRate, pf: m.profitFactor,
      cal: m.calmar, n: m.trades, oosRet: oos.ret, oosDD: oos.dd });
  }

  console.log('VARIANT'.padEnd(62) + 'FULL Ret    DD     WR    PF     n   | OOS Ret    DD');
  console.log('-'.repeat(120));
  for (const r of rows) {
    if (r.err) { console.log(r.label.padEnd(62) + r.err); continue; }
    const isCur = r.label.includes('CURRENT');
    const mark = isCur ? '  ' : '→ ';
    console.log(mark + r.label.padEnd(60) +
      `${(r.ret>0?'+':'')+r.ret}%`.padEnd(11) + `${r.dd}%`.padEnd(7) +
      `${r.wr}%`.padEnd(6) + `${r.pf}`.padEnd(7) + `${r.n}`.padEnd(4) + '| ' +
      `${(r.oosRet>0?'+':'')+r.oosRet}%`.padEnd(11) + `${r.oosDD}%`);
  }
  console.log('\n=== Done (no files written) ===');
}

main().catch(e => { console.error('Fatal:', e.message, e.stack); process.exit(1); });
