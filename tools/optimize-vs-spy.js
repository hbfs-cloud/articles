#!/usr/bin/env node
'use strict';

/**
 * optimize-vs-spy.js — READ-ONLY optimizer against the user's success criterion:
 *   "≥3× SPY return EVERY week, with max drawdown ≤ 8%."
 *
 * Evaluates ONLY on a chosen segment (default: 2026-04-20, when balanced went bad)
 * — not the full history — per the regime-aware/adaptive methodology.
 *
 * Weekly rule (per ISO week over the segment):
 *   - if SPY week > 0  → PASS when strat_week >= 3 * SPY_week
 *   - if SPY week <= 0 → PASS when strat_week >= 0  (protect capital when SPY drops)
 * Score = #weeks passing (the user's "always 3× better"); tie-break cumulative ratio.
 * Hard filter: segment maxDD <= 8%.
 *
 * Writes NOTHING.
 *   node tools/optimize-vs-spy.js --mode balanced --from 2026-04-20
 *   node tools/optimize-vs-spy.js --mode balanced --from 2026-04-20 --baseline-only
 */

const fs = require('fs');
const path = require('path');
const sweep = require('./sweep.js');

const ROOT = path.join(__dirname, '..');
const SCANNER_DIR = path.join(ROOT, 'scanner');

const args = process.argv.slice(2);
const getArg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const has = n => args.includes('--' + n);
const MODE = getArg('mode', 'balanced');
const FROM = getArg('from', '2026-04-20');
const DD_MAX = parseFloat(getArg('dd-max', '8'));
const MULT = parseFloat(getArg('mult', '3'));
const BASELINE_ONLY = has('baseline-only');

const CUR = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'modes-config.json'), 'utf8')).modes;

function isoWeek(dateStr) {
  // dateStr YYYY-MM-DD → "YYYY-Www" (deterministic, no Date.now)
  const [y, m, d] = dateStr.split('-').map(Number);
  // Zeller-free: compute day-of-year then week index. Use UTC Date is allowed (explicit date, not now).
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayNum = (dt.getUTCDay() + 6) % 7; // Mon=0
  dt.setUTCDate(dt.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThu = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((dt - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return dt.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
}

// Weekly returns from a [{date,value}] series, restricted to dates >= from.
function weeklyReturns(series, from) {
  const pts = series.filter(p => p.date >= from).sort((a, b) => a.date.localeCompare(b.date));
  if (pts.length < 2) return {};
  // last value per ISO week
  const lastByWeek = {};
  const order = [];
  for (const p of pts) { const w = isoWeek(p.date); if (!(w in lastByWeek)) order.push(w); lastByWeek[w] = p.value; }
  // also need the value at the start of the segment as the prior anchor
  const ret = {};
  let prev = pts[0].value;
  for (const w of order) { ret[w] = (lastByWeek[w] - prev) / prev * 100; prev = lastByWeek[w]; }
  return ret;
}

function maxDDof(series, from) {
  const pts = series.filter(p => p.date >= from).sort((a, b) => a.date.localeCompare(b.date));
  let peak = -Infinity, dd = 0;
  for (const p of pts) { if (p.value > peak) peak = p.value; const x = (p.value - peak) / peak * 100; if (x < dd) dd = x; }
  return +dd.toFixed(2);
}

function segReturn(series, from) {
  const pts = series.filter(p => p.date >= from).sort((a, b) => a.date.localeCompare(b.date));
  if (pts.length < 2) return 0;
  return +(((pts[pts.length - 1].value - pts[0].value) / pts[0].value) * 100).toFixed(2);
}

function evalVsSpy(stratWeekly, spyWeekly) {
  let pass = 0, total = 0;
  const detail = [];
  for (const w of Object.keys(stratWeekly)) {
    if (!(w in spyWeekly)) continue;
    total++;
    const sv = stratWeekly[w], bv = spyWeekly[w];
    const target = bv > 0 ? MULT * bv : 0;
    const ok = bv > 0 ? sv >= target : sv >= 0;
    if (ok) pass++;
    detail.push({ w, strat: +sv.toFixed(2), spy: +bv.toFixed(2), target: +target.toFixed(2), ok });
  }
  return { pass, total, detail };
}

async function main() {
  console.log(`=== Optimize ${MODE} vs SPY (≥${MULT}× weekly, DD≤${DD_MAX}%) — segment from ${FROM} ===\n`);

  const scanDirs = fs.readdirSync(SCANNER_DIR).filter(d => /^\d{8}(-\d+)?$/.test(d))
    .filter(d => (d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8)) >= '2026-02-15').sort();
  const scans = scanDirs.map(sweep.parseScan).filter(Boolean);
  const allSetups = scans.flatMap(s => {
    const list = s.setups.slice(); list.push(...(s.tklPool || []));
    return list.map(t => ({ ...t, scanDate: s.scanDate, dir: s.dir, regime: s.regime, regimeScore: s.regimeScore }));
  });

  const tickers = [...new Set(allSetups.map(t => t.ticker))];
  process.stdout.write(`Fetching ${tickers.length} tickers + SPY (cached)... `);
  for (const t of tickers) await sweep.fetchOHLCV(t);
  await sweep.fetchOHLCV('SPY');
  console.log('done');

  // SPY weekly returns over segment
  const spyHist = sweep.priceCache['SPY'];
  if (!spyHist) { console.error('No SPY data'); process.exit(1); }
  const spySeries = Object.keys(spyHist).sort().map(d => ({ date: d, value: spyHist[d].close }));
  const spyWeekly = weeklyReturns(spySeries, FROM);
  const spySegRet = segReturn(spySeries, FROM);
  const spyDD = maxDDof(spySeries, FROM);
  console.log(`\nSPY over segment: ${spySegRet > 0 ? '+' : ''}${spySegRet}% | maxDD ${spyDD}% | ${Object.keys(spyWeekly).length} weeks`);
  console.log('SPY weekly: ' + Object.entries(spyWeekly).map(([w, r]) => `${w.slice(5)}:${r > 0 ? '+' : ''}${r.toFixed(1)}%`).join('  '));

  // Restrict to the SEGMENT: only scans/setups on/after FROM. The config is evaluated
  // purely on this tronçon (equity restarts at 100 on the first segment scan) — exactly
  // what "optimize only on the segment" means; no uniform full-history replay.
  const segScans = scans.filter(s => s.scanDate >= FROM);
  const segSetups = allSetups.filter(s => s.scanDate >= FROM);

  const STRAT = sweep.STRATEGY_FILTERS_MAP;
  function simWith(cfg) {
    // pre-sim trades for this cfg's exit params (segment setups only), then portfolio
    const trades = [];
    for (const setup of segSetups) {
      const r = sweep.simulateTrade(setup, setup.scanDate, sweep.priceCache[setup.ticker], {
        horizonDays: cfg.horizon, partialTP: cfg.partialTP || false, partialTPPct: cfg.partialTPPct || 0.5,
        trailingStop: cfg.trailingStop || false, maxStopPct: cfg.maxStopPct || 0, atrStopMult: cfg.atrStopMult || 0,
        dailyTrailPct: cfg.dailyTrailPct || 0, breakevenPct: cfg.breakevenPct || 0,
        partialTPGain: cfg.partialTPGain || 0, disableTP2: cfg.disableTP2 || false,
        entryGatePct: cfg.entryGatePct || 0, vwapGate: cfg.vwapGate !== false,
        trailMultR: cfg.trailMultR ?? 1.5, trailGraceDays: cfg.trailGraceDays ?? 0,
      });
      if (r) trades.push({ ...r, regime: setup.regime || null, regimeScore: setup.regimeScore ?? null });
    }
    return sweep.simulatePortfolio(trades, segScans, {
      portfolioSize: cfg.portfolioSize, topN: cfg.topN, minScore: cfg.minScore || 0, rotation: cfg.rotation,
      strategyFilter: STRAT[cfg.filterName], horizonDays: cfg.horizon, partialTP: cfg.partialTP || false,
      trailingStop: cfg.trailingStop || false, regimeFilters: cfg.regimeFilters || null,
      regimeScoreOverride: cfg.regimeScoreOverride || false,
      ddBreakerPct: cfg.ddBreakerPct ?? 0, sectorCapMax: cfg.sectorCapMax ?? 0,
      correlationCap: cfg.correlationCap ?? 0, vixKillThreshold: cfg.vixKillThreshold ?? 0,
      circuitBreakerStops: cfg.circuitBreakerStops ?? 0, circuitBreakerWindow: cfg.circuitBreakerWindow ?? 5,
      circuitBreakerPause: cfg.circuitBreakerPause ?? 3, positionSizePct: cfg.positionSizePct || 1,
    });
  }

  // Optional: evaluate an explicit proposed config (overrides on top of current).
  // Preserve the live regimeFilters unless the override explicitly sets them, so tests
  // reflect the real regime-aware config (avoids confounding the result).
  const evalJson = getArg('eval-config', null);
  const evalOverrides = evalJson ? JSON.parse(evalJson) : null;
  const evalCfg = evalOverrides ? {
    ...CUR[MODE], ...evalOverrides,
    regimeFilters: 'regimeFilters' in evalOverrides ? evalOverrides.regimeFilters : CUR[MODE].regimeFilters,
  } : null;

  // BASELINE: current config (or the proposed config if --eval-config given)
  const baseLabel = evalCfg ? `${MODE} PROPOSED ${evalJson}` : `${MODE} current config`;
  console.log(`\n────────── BASELINE: ${baseLabel} ──────────`);
  const baseM = simWith(evalCfg || CUR[MODE]);
  if (baseM) {
    const bw = weeklyReturns(baseM.equityCurve, FROM);
    const ev = evalVsSpy(bw, spyWeekly);
    const dd = maxDDof(baseM.equityCurve, FROM);
    const ret = segReturn(baseM.equityCurve, FROM);
    console.log(`Segment: ${ret > 0 ? '+' : ''}${ret}% (SPY ${spySegRet}%, ratio ${(ret / (spySegRet || 1)).toFixed(1)}×) | maxDD ${dd}% | weeks ≥${MULT}×SPY: ${ev.pass}/${ev.total}`);
    console.log('Weekly strat vs target:');
    ev.detail.forEach(d => console.log(`   ${d.w.slice(5)}  strat ${d.strat > 0 ? '+' : ''}${d.strat}%  vs SPY ${d.spy > 0 ? '+' : ''}${d.spy}% (need ${d.target >= 0 ? '≥' + d.target + '%' : ''}) ${d.ok ? '✓' : '✗'}`));
  } else console.log('  (no trades on segment)');

  if (BASELINE_ONLY) { console.log('\n=== baseline-only (no files written) ==='); return; }

  // SEARCH: diversified configs (balanced identity preserved)
  console.log(`\n────────── SEARCH (diversified configs, DD≤${DD_MAX}%) ──────────`);
  const grid = {
    portfolioSize: MODE === 'balanced' ? [3, 4, 5] : MODE === 'fortress' ? [3, 4, 5] : [CUR[MODE].portfolioSize],
    topN: [2, 3, 4],
    minScore: [85, 88, 90],
    filterName: ['mom_bo', 'breakout_only', 'no_sq_pb', 'momentum_only', 'all'],
    rotation: ['none', 'daily_max1', 'aggressive'],
    horizon: [5, 8, 10],
    partialTP: [false, true],
    trailingStop: [false, true],
    atrStopMult: [1, 2, 2.5],
    maxStopPct: [0, 8],
  };
  const base = CUR[MODE];
  const results = [];
  let tested = 0;
  for (const portfolioSize of grid.portfolioSize)
    for (const topN of grid.topN) {
      if (topN > portfolioSize) continue;
      for (const minScore of grid.minScore)
        for (const filterName of grid.filterName)
          for (const rotation of grid.rotation)
            for (const horizon of grid.horizon)
              for (const partialTP of grid.partialTP)
                for (const trailingStop of grid.trailingStop)
                  for (const atrStopMult of grid.atrStopMult)
                    for (const maxStopPct of grid.maxStopPct) {
                      const cfg = { ...base, portfolioSize, topN, minScore, filterName, rotation, horizon,
                        partialTP, trailingStop, atrStopMult, maxStopPct, regimeFilters: null };
                      const m = simWith(cfg);
                      tested++;
                      if (!m) continue;
                      const dd = maxDDof(m.equityCurve, FROM);
                      if (Math.abs(dd) > DD_MAX) continue;
                      const ret = segReturn(m.equityCurve, FROM);
                      if (ret <= 0) continue;
                      const ev = evalVsSpy(weeklyReturns(m.equityCurve, FROM), spyWeekly);
                      if (ev.total < 3) continue;
                      results.push({ portfolioSize, topN, minScore, filterName, rotation, horizon,
                        partialTP, trailingStop, atrStopMult, maxStopPct, ret, dd,
                        pass: ev.pass, total: ev.total, ratio: +(ret / (spySegRet || 1)).toFixed(1) });
                      if (tested % 500 === 0) process.stdout.write(`  tested ${tested}\r`);
                    }
    }
  // rank: most weeks passing, then cumulative ratio, then lower DD
  results.sort((a, b) => (b.pass - a.pass) || (b.ratio - a.ratio) || (Math.abs(a.dd) - Math.abs(b.dd)));
  console.log(`Tested ${tested} configs; ${results.length} passed DD≤${DD_MAX}% & positive. Top 12:\n`);
  console.log('  pass/wk  ratio  Ret      DD      | config');
  results.slice(0, 12).forEach(r => {
    console.log(`  ${(r.pass + '/' + r.total).padEnd(8)} ${(r.ratio + '×').padEnd(6)} ${((r.ret > 0 ? '+' : '') + r.ret + '%').padEnd(8)} ${(r.dd + '%').padEnd(7)} | pS=${r.portfolioSize} tN=${r.topN} ms=${r.minScore} ${r.filterName} rot=${r.rotation} h=${r.horizon} pTP=${r.partialTP} trail=${r.trailingStop} atrX=${r.atrStopMult} maxStop=${r.maxStopPct}`);
  });
  console.log('\n=== Done (no files written) ===');
}

main().catch(e => { console.error('Fatal:', e.message, e.stack); process.exit(1); });
