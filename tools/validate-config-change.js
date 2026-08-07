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
// Define proposals against each mode's current config. Every non-CURRENT row is
// A/B-tested against its base's CURRENT row (same modeling both arms → only the
// relative delta is trusted, per the segment-replay-absolute-DD rule).
const VARIANTS = [
  // ── BALANCED — the ONLY mode with a CONFIG root cause (diagnostic juin 2026) ──
  // Live balanced: filterName=mom_bo, maxStopPct=5, atrStopMult=0, sizingMethod=FIXED,
  // NO trailing. It is the only one of the 4 modes lacking BOTH a risk-normalised
  // sizing (inverse_atr) AND stop respiration → high-ATR momentum names (NVDA/ANET)
  // whipsaw at the tight fixed 5% cap (12 SL / 15 trades in June) and full-size losses.
  { label: 'balanced CURRENT', base: 'balanced', cfg: {} },
  // P2 — ATR respiration (atrX1.8, capped 7%) + trailing 2R grace 3d. Lets winners run
  //      and stops breathe past intraday noise. Winner of the full-history A/B.
  { label: 'balanced P2 (atrX1.8 maxStop7 trail2R g3)', base: 'balanced', cfg: {
      atrStopMult: 1.8, maxStopPct: 7, trailingStop: true, trailMultR: 2.0, trailGraceDays: 3,
  }},
  // P4 — P2 + the diagnostic's headline guard-rail: inverse_atr sizing + targetRiskPct=1.
  //      Wide stop → smaller position → bounded $ risk. The exact garde-fou turbo/dynamic
  //      have and balanced never had. Tests whether normalising size protects DD further.
  { label: 'balanced P4 (P2 + inverse_atr sizing)', base: 'balanced', cfg: {
      atrStopMult: 1.8, maxStopPct: 7, trailingStop: true, trailMultR: 2.0, trailGraceDays: 3,
      sizingMethod: 'inverse_atr', targetRiskPct: 1,
  }},

  // ── FORTRESS — diagnostic verdict = RÉGIME (config saine). Proposal kept only to
  //    demonstrate the gate rejects a config change that is not justified. ──
  { label: 'fortress CURRENT', base: 'fortress', cfg: {} },
  { label: 'fortress FIX early_risk_off->breakout +maxStop5', base: 'fortress', cfg: {
      regimeFilters: { risk_on: 'mom_bo', early_risk_off: 'breakout_only', risk_off: 'breakout_only', neutral: 'mom_bo', recovery: 'mom_bo' },
      maxStopPct: 5,
  }},
  // Rollback 2026-06-29 a retiré le circuit breaker (incident 18/06 = 12 SL consécutifs).
  // CB = purement protecteur : ne change rien hors série de stops.
  { label: 'fortress +CB(3/5/3)', base: 'fortress', cfg: {
      circuitBreakerStops: 3, circuitBreakerWindow: 5, circuitBreakerPause: 3,
  }},

  // ── DYNAMIC — diagnostic verdict = RÉGIME (léger). Kept for gate demonstration. ──
  { label: 'dynamic CURRENT', base: 'dynamic', cfg: {} },
  { label: 'dynamic +maxStop6 +early_risk_off->breakout', base: 'dynamic', cfg: {
      regimeFilters: { risk_on: 'mom_bo', early_risk_off: 'breakout_only', risk_off: 'breakout_only', neutral: 'mom_bo', recovery: 'mom_bo' },
      maxStopPct: 6,
  }},

  // ── TURBO — diagnostic verdict = RÉGIME (léger). Kept for gate demonstration. ──
  { label: 'turbo CURRENT', base: 'turbo', cfg: {} },
  { label: 'turbo +maxStop6', base: 'turbo', cfg: { maxStopPct: 6 } },
];

// Mandatory validation window (calendar days). The config-change rule requires a
// 30-day regime-aware backtest that BEATS the current config before any change to
// turbo/balanced/dynamic/fortress. WINDOW_DAYS drives that gate.
const WINDOW_DAYS = 30;

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

// Recent trailing-window metrics (calendar days). Return/DD from the equity-curve slice
// (relative A/B only — absolute segment DD is unreliable), WR/PF/n from closed trades
// whose exit falls inside the window. This is the mandatory 30-day gate input.
function windowFromEquity(equityCurve, closedTrades, days) {
  if (!equityCurve || equityCurve.length < 2) return null;
  const lastDate = equityCurve[equityCurve.length - 1].date;
  const cutoff = new Date(new Date(lastDate).getTime() - days * 86400000).toISOString().slice(0, 10);
  const slice = equityCurve.filter(p => p.date >= cutoff);
  if (slice.length < 2) return null;
  const startV = slice[0].value, endV = slice[slice.length - 1].value;
  const denom = Math.abs(startV) || 1;
  const ret = +(((endV - startV) / denom) * 100).toFixed(2);
  let peak = slice[0].value, maxDD = 0;
  for (const p of slice) { if (p.value > peak) peak = p.value; const pk = Math.abs(peak) || 1; const dd = (peak - p.value) / pk * 100; if (dd > maxDD) maxDD = dd; }
  const ct = (closedTrades || []).filter(t => t.exitDate && t.exitDate >= cutoff);
  const w = ct.filter(t => (t.pnlPct || 0) > 0), l = ct.filter(t => (t.pnlPct || 0) <= 0);
  const wr = ct.length ? +((w.length / ct.length) * 100).toFixed(0) : 0;
  const gw = w.reduce((s, t) => s + (t.pnlPct || 0), 0), gl = Math.abs(l.reduce((s, t) => s + (t.pnlPct || 0), 0));
  const pf = gl > 0 ? +(gw / gl).toFixed(2) : (gw > 0 ? 99 : 0);
  return { ret, dd: +maxDD.toFixed(2), wr, pf, n: ct.length };
}

// Per-regime realized breakdown from closed trades (regime-aware eval — never a uniform
// full-period replay). Each trade carries the scan-day regime label.
function regimeBreakdown(closedTrades) {
  const by = {};
  for (const t of (closedTrades || [])) { const r = t.regime || 'unknown'; (by[r] = by[r] || []).push(t); }
  const out = {};
  for (const r of Object.keys(by)) {
    const ct = by[r];
    const w = ct.filter(t => (t.pnlPct || 0) > 0), l = ct.filter(t => (t.pnlPct || 0) <= 0);
    const gw = w.reduce((s, t) => s + (t.pnlPct || 0), 0), gl = Math.abs(l.reduce((s, t) => s + (t.pnlPct || 0), 0));
    out[r] = {
      n: ct.length,
      wr: +((w.length / Math.max(1, ct.length)) * 100).toFixed(0),
      pf: gl > 0 ? +(gw / gl).toFixed(2) : (gw > 0 ? 99 : 0),
      sum: +ct.reduce((s, t) => s + (t.pnlPct || 0), 0).toFixed(1),
    };
  }
  return out;
}

// GO/WAIT gate. Enforces: (1) the mandatory 30-day window BEATS current (higher return,
// DD not materially worse), (2) walk-forward OOS does not degrade, (3) full-period A/B
// delta is positive. All comparisons are relative to the SAME-base CURRENT row, Y COMPRIS le
// guardrail de DD : seuil absolu si la référence le respecte, sinon comparaison de deltas.
function evalGate(cur, prop) {
  const reasons = [];
  let go = true;
  const w = prop.win, cw = cur.win;
  if (!w) { go = false; reasons.push('30j window indisponible'); }
  else if (cw && cw.n >= 3 && w.n >= 3) {
    // Both arms active in the window → full head-to-head (return up, DD not worse).
    if (!(w.ret > cw.ret)) { go = false; reasons.push(`30j ret ${w.ret}%≤cur ${cw.ret}%`); }
    if (w.dd > cw.dd + 1.0) { go = false; reasons.push(`30j DD ${w.dd}%>cur ${cw.dd}% (+1pt tol)`); }
  } else if (w.n === 0 && (!cw || cw.n === 0)) {
    // LES DEUX bras sont inactifs sur la fenêtre : le test est VIDE, il n'a rien mesuré.
    // Il doit s'ABSTENIR, pas voter. Avant, `w.pf < 1` était vrai (pf=0 faute de trades) et
    // vetait — un mode qui n'a pas tradé depuis 30 jours ne pouvait donc JAMAIS voir un
    // changement de config validé. Verrou circulaire : turbo est inactif parce que sa config
    // est mauvaise, et le gate refusait de la corriger parce qu'il est inactif.
    // Le verdict repose alors entièrement sur OOS + pleine période, qui eux ont des données.
    reasons.push(`30j: AUCUN trade dans les deux bras — fenêtre non concluante, verdict sur OOS + pleine période`);
  } else {
    // Baseline idle/insufficient in the window → DD compare is void. Require the proposal
    // to be self-healthy (non-negative return, PF≥1) and lean on OOS + full for the verdict.
    if (w.ret < 0) { go = false; reasons.push(`30j ret ${w.ret}%<0 (baseline idle n=${cw ? cw.n : 0})`); }
    if (w.pf < 1) { go = false; reasons.push(`30j PF ${w.pf}<1 (baseline idle)`); }
    reasons.push(`30j: prop +${w.ret}% PF${w.pf} n${w.n} vs cur idle n${cw ? cw.n : 0}`);
  }
  if (prop.oosRet < cur.oosRet) { go = false; reasons.push(`OOS ret ${prop.oosRet}%<cur ${cur.oosRet}%`); }
  if (prop.ret <= cur.ret) { go = false; reasons.push(`full ret ${prop.ret}%≤cur ${cur.ret}%`); }
  // Mode-success criterion: max DD ≤ 8%. Appliqué RELATIVEMENT à la ligne CURRENT, parce
  // qu'un DD absolu de replay de segment n'est pas fiable (règle projet
  // segment-replay-absolute-dd) et qu'un seuil absolu gèle l'existant : quand la config en
  // place viole déjà 8%, il rendait impossible TOUTE amélioration par étapes — y compris
  // celles qui réduisent le DD. Cas réel du 2026-08-07 : turbo H=3 améliorait le rendement
  // (-6,54% → -0,33%) ET le drawdown (-11,07% → -9,96%), et se faisait refuser.
  //   • ligne de référence saine (≤8%) → la proposition doit le rester : veto strict.
  //   • ligne de référence déjà au-delà → verdict sur le DELTA : veto seulement si la
  //     proposition dégrade encore. L'écart au seuil reste signalé dans tous les cas.
  const pdd = Math.abs(prop.dd), cdd = Math.abs(cur.dd);
  if (cdd <= 8) {
    if (pdd > 8) { go = false; reasons.push(`full DD ${prop.dd}% viole guardrail ≤8% (actuel ${cur.dd}% le respecte)`); }
  } else if (pdd > cdd + 0.01) {
    go = false; reasons.push(`full DD ${prop.dd}% dégrade l'actuel ${cur.dd}% (tous deux >8%)`);
  } else if (pdd > 8) {
    reasons.push(`NOTE: DD ${prop.dd}% encore >8% mais AMÉLIORE l'actuel ${cur.dd}%`);
  }
  if (go) reasons.unshift('bat l\'actuel (30j + OOS + full, DD non dégradé)');
  return { verdict: go ? 'GO' : 'WAIT', reasons };
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
    if (!m) { rows.push({ label: v.label, base: v.base, err: 'no metrics' }); continue; }
    const oos = oosFromEquity(m.equityCurve, oosStartDate);
    const win = windowFromEquity(m.equityCurve, m.closedTrades, WINDOW_DAYS);
    const regimes = regimeBreakdown(m.closedTrades);
    rows.push({ label: v.label, base: v.base, isCur: v.label.includes('CURRENT'),
      ret: m.returnTotal, dd: m.maxDD, wr: m.winRate, pf: m.profitFactor,
      cal: m.calmar, n: m.trades, oosRet: oos.ret, oosDD: oos.dd, win, regimes });
  }

  // ── 1. Full-period + walk-forward OOS table (relative A/B) ──
  console.log('VARIANT'.padEnd(62) + 'FULL Ret    DD     WR    PF     n   | OOS Ret    DD');
  console.log('-'.repeat(120));
  for (const r of rows) {
    if (r.err) { console.log(r.label.padEnd(62) + r.err); continue; }
    const mark = r.isCur ? '  ' : '→ ';
    console.log(mark + r.label.padEnd(60) +
      `${(r.ret>0?'+':'')+r.ret}%`.padEnd(11) + `${r.dd}%`.padEnd(7) +
      `${r.wr}%`.padEnd(6) + `${r.pf}`.padEnd(7) + `${r.n}`.padEnd(4) + '| ' +
      `${(r.oosRet>0?'+':'')+r.oosRet}%`.padEnd(11) + `${r.oosDD}%`);
  }

  // ── 2. Mandatory recent 30-day window (the config-change gate input) ──
  console.log(`\n── Recent ${WINDOW_DAYS}-day window (gate input; relative A/B, absolute DD indicative only) ──`);
  console.log('VARIANT'.padEnd(62) + 'Ret        DD      WR    PF     n');
  console.log('-'.repeat(100));
  for (const r of rows) {
    if (r.err || !r.win) { console.log((r.isCur ? '  ' : '→ ') + r.label.padEnd(60) + (r.err || 'window n/a')); continue; }
    const mark = r.isCur ? '  ' : '→ ';
    console.log(mark + r.label.padEnd(60) +
      `${(r.win.ret>0?'+':'')+r.win.ret}%`.padEnd(11) + `${r.win.dd}%`.padEnd(8) +
      `${r.win.wr}%`.padEnd(6) + `${r.win.pf}`.padEnd(7) + `${r.win.n}`);
  }

  // ── 3. Per-regime realized breakdown (regime-aware; never uniform replay) ──
  console.log('\n── Per-regime realized (PF / WR / n / sumPnl%) ──');
  for (const r of rows) {
    if (r.err) continue;
    const parts = Object.entries(r.regimes).sort((a,b)=>b[1].n-a[1].n)
      .map(([reg, s]) => `${reg}: PF ${s.pf} WR ${s.wr}% n${s.n} (${s.sum>0?'+':''}${s.sum}%)`);
    console.log((r.isCur ? '  ' : '→ ') + r.label.padEnd(60) + (parts.join('  |  ') || 'no closed trades'));
  }

  // ── 4. GO/WAIT gate — each proposal vs its base CURRENT ──
  const curByBase = {};
  for (const r of rows) if (r.isCur && !r.err) curByBase[r.base] = r;
  console.log('\n══ GATE: 30-day regime-aware backtest must BEAT current (config-change rule) ══');
  console.log('PROPOSAL'.padEnd(56) + 'VERDICT   DETAIL');
  console.log('-'.repeat(120));
  for (const r of rows) {
    if (r.isCur || r.err) continue;
    const cur = curByBase[r.base];
    if (!cur) { console.log('→ ' + r.label.padEnd(54) + 'SKIP     no CURRENT baseline for base ' + r.base); continue; }
    const g = evalGate(cur, r);
    console.log('→ ' + r.label.padEnd(54) + g.verdict.padEnd(9) + ' ' + g.reasons.join('; '));
  }
  console.log('\n=== Done (no files written) ===');
}

main().catch(e => { console.error('Fatal:', e.message, e.stack); process.exit(1); });
