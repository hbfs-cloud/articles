#!/usr/bin/env node
'use strict';

/**
 * regime-strategy-breakdown.js — READ-ONLY per-regime × per-strategy edge analysis.
 *
 * The CORRECT unit of analysis for a regime-aware system: for each market regime,
 * which strategy actually had an edge on trades taken DURING that regime. This
 * directly informs regimeFilters (per-regime strategy selection) WITHOUT the invalid
 * "apply one static config uniformly over the whole period" fallacy.
 *
 * Walk-forward: reports in-sample (calibration) and out-of-sample (validation) so a
 * per-regime rule is only trusted if it holds on unseen data.
 *
 * Writes NOTHING.
 *
 * Usage:
 *   node tools/regime-strategy-breakdown.js                 # default exit params
 *   node tools/regime-strategy-breakdown.js --horizon 8 --atr 2 --maxstop 5
 */

const fs = require('fs');
const path = require('path');
const sweep = require('./sweep.js');

const ROOT = path.join(__dirname, '..');
const SCANNER_DIR = path.join(ROOT, 'scanner');
const FROM_DATE = '2026-02-15';
const OOS_FRAC = 0.70;

const args = process.argv.slice(2);
const getArg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const HORIZON = parseInt(getArg('horizon', '8'));
const ATR = parseFloat(getArg('atr', '2'));
const MAXSTOP = parseFloat(getArg('maxstop', '0'));
const TRAIL = getArg('trail', 'false') === 'true';

// Normalize regime label → regimeFilters key (mirror sweep.js normalizeRegime → key)
function regimeKey(raw) {
  const r = (raw || '').toUpperCase();
  if (r.includes('EARLY')) return 'early_risk_off';
  if (r.includes('RISK-OFF') || r.includes('RISK_OFF')) return 'risk_off';
  if (r.includes('RISK-ON') || r.includes('RISK_ON')) return 'risk_on';
  if (r.includes('RECOVERY')) return 'recovery';
  if (r.includes('NEUTRAL')) return 'neutral';
  return 'neutral';
}

// Map setup.strategy → which filters INCLUDE it (so we can attribute to mom_bo vs breakout_only)
// STRATEGY_FILTERS_MAP holds EXCLUDE sets. A strategy is "in" a filter if NOT excluded.
function strategyClass(strat) {
  const s = (strat || '').toLowerCase();
  if (s.includes('breakout')) return 'breakout';
  if (s.includes('momentum')) return 'momentum';
  if (s.includes('pullback')) return 'pullback';
  if (s.includes('squeeze')) return 'squeeze';
  if (s.includes('candle')) return 'candlestick';
  return s || 'other';
}

function stats(trades) {
  const resolved = trades.filter(t => ['tp1','tp1_partial','tp2','sl','expired','rotated','breakeven','trail'].includes((t.status||'').replace(/_amb$/,'')));
  if (!resolved.length) return null;
  const wins = resolved.filter(t => t.pnlPct > 0);
  const losses = resolved.filter(t => t.pnlPct <= 0);
  const gross = wins.reduce((s,t)=>s+t.pnlPct,0);
  const grossLoss = Math.abs(losses.reduce((s,t)=>s+t.pnlPct,0));
  const pf = grossLoss > 0 ? +(gross/grossLoss).toFixed(2) : (gross > 0 ? 99 : 0);
  const avg = +(resolved.reduce((s,t)=>s+t.pnlPct,0)/resolved.length).toFixed(2);
  return { n: resolved.length, wr: +(wins.length/resolved.length*100).toFixed(1), avg, pf,
    sumPnl: +resolved.reduce((s,t)=>s+t.pnlPct,0).toFixed(1) };
}

async function main() {
  console.log('=== Per-Regime × Per-Strategy Edge (READ-ONLY, walk-forward) ===');
  console.log(`Exit params: horizon=${HORIZON} atrStopMult=${ATR} maxStopPct=${MAXSTOP} trail=${TRAIL}\n`);

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
  const oosStart = sortedDates[Math.floor(sortedDates.length * OOS_FRAC)];
  console.log(`${scans.length} scans, ${allSetups.length} setups. OOS (validation) from ${oosStart}\n`);

  const tickers = [...new Set(allSetups.map(t => t.ticker))];
  process.stdout.write(`Fetching ${tickers.length} tickers (cached)... `);
  for (const t of tickers) await sweep.fetchOHLCV(t);
  console.log('done\n');

  // Simulate every setup once with the chosen exit params
  const trades = [];
  for (const setup of allSetups) {
    const r = sweep.simulateTrade(setup, setup.scanDate, sweep.priceCache[setup.ticker], {
      horizonDays: HORIZON, partialTP: false, partialTPPct: 0.5, trailingStop: TRAIL,
      maxStopPct: MAXSTOP, atrStopMult: ATR, dailyTrailPct: 0, breakevenPct: 0, vwapGate: true,
    });
    if (r) trades.push({ ...r, regime: setup.regime, scanDate: setup.scanDate,
      strat: strategyClass(setup.strategy), rk: regimeKey(setup.regime) });
  }
  console.log(`Simulated ${trades.length} trades\n`);

  const REGIMES = ['risk_on', 'early_risk_off', 'risk_off', 'neutral', 'recovery'];
  const STRATS = ['momentum', 'breakout', 'pullback', 'squeeze', 'candlestick'];

  for (const seg of [['IN-SAMPLE', t => t.scanDate < oosStart], ['OUT-OF-SAMPLE', t => t.scanDate >= oosStart], ['FULL PERIOD', () => true]]) {
    const [segName, segFilter] = seg;
    const segTrades = trades.filter(segFilter);
    console.log(`\n################## ${segName} (${segTrades.length} trades) ##################`);
    console.log('REGIME'.padEnd(16) + 'STRATEGY'.padEnd(13) + 'n'.padEnd(5) + 'WR'.padEnd(8) + 'avgPnL'.padEnd(9) + 'PF'.padEnd(7) + 'sumPnL');
    console.log('-'.repeat(64));
    for (const rk of REGIMES) {
      const regimeTrades = segTrades.filter(t => t.rk === rk);
      if (!regimeTrades.length) continue;
      // Per strategy within regime
      const rows = [];
      for (const st of STRATS) {
        const s = stats(regimeTrades.filter(t => t.strat === st));
        if (s) rows.push({ st, ...s });
      }
      // mom_bo aggregate (momentum + breakout) vs breakout_only — the actual filter choice
      const momBo = stats(regimeTrades.filter(t => t.strat === 'momentum' || t.strat === 'breakout'));
      const boOnly = stats(regimeTrades.filter(t => t.strat === 'breakout'));
      rows.sort((a,b) => b.pf - a.pf);
      for (const r of rows) {
        console.log(`${rk.padEnd(16)}${r.st.padEnd(13)}${String(r.n).padEnd(5)}${(r.wr+'%').padEnd(8)}${((r.avg>0?'+':'')+r.avg).padEnd(9)}${String(r.pf).padEnd(7)}${(r.sumPnl>0?'+':'')+r.sumPnl}`);
      }
      if (momBo) console.log(`${''.padEnd(16)}${'[mom_bo]'.padEnd(13)}${String(momBo.n).padEnd(5)}${(momBo.wr+'%').padEnd(8)}${((momBo.avg>0?'+':'')+momBo.avg).padEnd(9)}${String(momBo.pf).padEnd(7)}${(momBo.sumPnl>0?'+':'')+momBo.sumPnl}`);
      if (boOnly) console.log(`${''.padEnd(16)}${'[breakout]'.padEnd(13)}${String(boOnly.n).padEnd(5)}${(boOnly.wr+'%').padEnd(8)}${((boOnly.avg>0?'+':'')+boOnly.avg).padEnd(9)}${String(boOnly.pf).padEnd(7)}${(boOnly.sumPnl>0?'+':'')+boOnly.sumPnl}`);
      console.log('');
    }
  }
  console.log('=== Done (no files written) ===');
}

main().catch(e => { console.error('Fatal:', e.message, e.stack); process.exit(1); });
