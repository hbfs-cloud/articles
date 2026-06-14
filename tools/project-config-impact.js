#!/usr/bin/env node
'use strict';

/**
 * project-config-impact.js — READ-ONLY impact projection for proposed config changes.
 *
 * Methodology (respects regime-aware + adaptive system — NO uniform full-period replay):
 *   1. maxStopPct cap: re-simulate each mode's ACTUAL closed trades' entries with the
 *      mode's CURRENT exit params, once as-is and once with the proposed cap. The delta
 *      is bounded to the specific trades the cap actually binds on. True intraday
 *      counterfactual via simulateTrade (handles gap-through, TP-before-stop ordering).
 *   2. early_risk_off filter: among the mode's ACTUAL closed trades taken during
 *      early_risk_off regime, identify which are momentum (dropped by breakout_only)
 *      vs breakout (kept). Shows the regime-bounded composition change.
 *
 * Writes NOTHING.
 *   node tools/project-config-impact.js
 */

const fs = require('fs');
const path = require('path');
const sweep = require('./sweep.js');

const ROOT = path.join(__dirname, '..');
const SCANNER_DIR = path.join(ROOT, 'scanner');
const FROM_DATE = '2026-02-15';

const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'modes-config.json'), 'utf8')).modes;
const TRADES = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'backtest-trades.json'), 'utf8'));

// Proposed changes
const MAXSTOP_CHANGES = { turbo: 6, dynamic: 6, balanced: 5, bull: 5 }; // mode -> new cap
const FILTER_CHANGES = ['balanced', 'secured']; // early_risk_off mom_bo -> breakout_only

function regimeKey(raw) {
  const r = (raw || '').toUpperCase();
  if (r.includes('EARLY')) return 'early_risk_off';
  if (r.includes('RISK-OFF') || r.includes('RISK_OFF')) return 'risk_off';
  if (r.includes('RISK-ON') || r.includes('RISK_ON')) return 'risk_on';
  if (r.includes('RECOVERY')) return 'recovery';
  return 'neutral';
}
function stratClass(s){ s=(s||'').toLowerCase(); if(s.includes('breakout'))return'breakout'; if(s.includes('momentum'))return'momentum'; if(s.includes('pullback'))return'pullback'; if(s.includes('squeeze'))return'squeeze'; if(s.includes('candle'))return'candlestick'; return s; }

const RESOLVED = new Set(['tp1','tp1_partial','tp2','sl','expired','rotated','breakeven','trail']);

async function main() {
  console.log('=== Config-Change Impact Projection (READ-ONLY, trade-level attribution) ===\n');

  // Build setup lookup from scans: key ticker|scanDate -> setup
  const scanDirs = fs.readdirSync(SCANNER_DIR).filter(d=>/^\d{8}(-\d+)?$/.test(d))
    .filter(d => (d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6,8)) >= FROM_DATE).sort();
  const scans = scanDirs.map(sweep.parseScan).filter(Boolean);
  const setupMap = {};
  for (const s of scans) {
    const pool = [...s.setups, ...(s.tklPool||[])];
    for (const su of pool) setupMap[`${su.ticker}|${s.scanDate}`] = { ...su, scanDate: s.scanDate, regime: s.regime };
  }

  // Fetch prices for tickers in affected modes' trades
  const allTickers = new Set();
  for (const mode of Object.keys(MAXSTOP_CHANGES)) (TRADES[mode]||[]).forEach(t=>allTickers.add(t.ticker));
  process.stdout.write(`Fetching ${allTickers.size} tickers (cached)... `);
  for (const t of allTickers) await sweep.fetchOHLCV(t);
  console.log('done\n');

  // ───────────────────────────────────────────────────────────────────────
  // CHANGE 1: maxStopPct cap — re-simulate actual entries with/without cap
  // ───────────────────────────────────────────────────────────────────────
  console.log('████████ CHANGE 1: maxStopPct tail-cap ████████');
  console.log('(re-simulating each mode\'s ACTUAL closed-trade entries with current exit params, with vs without the cap)\n');

  const CAP_LEVELS = [5, 6, 7, 8, 10, 12];
  for (const mode of Object.keys(MAXSTOP_CHANGES)) {
    const c = CFG[mode];
    const closed = (TRADES[mode]||[]).filter(t => RESOLVED.has((t.status||'').replace(/_amb$/,'')) && t.actualEntry > 0);
    const weight = 1 / (c.portfolioSize || 1) * (c.positionSizePct || 1);
    const baseExit = {
      horizonDays: c.horizon, partialTP: c.partialTP||false, partialTPPct: c.partialTPPct||0.5,
      trailingStop: c.trailingStop||false, atrStopMult: c.atrStopMult||0, dailyTrailPct: c.dailyTrailPct||0,
      breakevenPct: c.breakevenPct||0, beGraceDays: c.beGraceDays||0, partialTPGain: c.partialTPGain||0,
      disableTP2: c.disableTP2||false, entryGatePct: c.entryGatePct||0, vwapGate: c.vwapGate||false,
      trailMultR: c.trailMultR??1.5, trailGraceDays: c.trailGraceDays??0,
    };
    // Baseline (no cap) per actual entry — compute once
    const baseByTrade = [];
    for (const t of closed) {
      const setup = setupMap[`${t.ticker}|${t.scanDate}`];
      const hist = setup ? sweep.priceCache[t.ticker] : null;
      if (!setup || !hist) continue;
      const base = sweep.simulateTrade(setup, t.scanDate, hist, { ...baseExit, maxStopPct: 0 });
      if (base) baseByTrade.push({ t, setup, hist, base });
    }
    console.log(`── ${mode}  (pSize=${c.portfolioSize}, weight=${(weight*100).toFixed(1)}%, ${baseByTrade.length} re-simmable closed trades) ──`);
    console.log(`   cap%  | netWeighted | helped(losers capped) | hurt(winners whipsawed) | worstWhipsaw`);
    for (const cap of CAP_LEVELS) {
      let netW = 0, helped = 0, hurt = 0, worstHurt = 0, worstHurtTk = '';
      for (const { t, setup, hist, base } of baseByTrade) {
        const capped = sweep.simulateTrade(setup, t.scanDate, hist, { ...baseExit, maxStopPct: cap });
        if (!capped) continue;
        const d = (capped.pnlPct||0) - (base.pnlPct||0);
        if (Math.abs(d) < 0.01) continue;
        netW += d * weight;
        if (d > 0) helped++; else { hurt++; if (d < worstHurt) { worstHurt = d; worstHurtTk = t.ticker; } }
      }
      console.log(`   ${String(cap).padStart(3)}%  | ${(netW>0?'+':'')+netW.toFixed(2)}pp`.padEnd(28) + `| ${helped}`.padEnd(24) + `| ${hurt}`.padEnd(26) + `| ${worstHurtTk} ${worstHurt.toFixed(1)}pp`);
    }
    console.log('');
  }

  // ───────────────────────────────────────────────────────────────────────
  // CHANGE 2: early_risk_off mom_bo -> breakout_only (regime-bounded composition)
  // ───────────────────────────────────────────────────────────────────────
  console.log('\n████████ CHANGE 2: early_risk_off mom_bo -> breakout_only ████████');
  console.log('(actual closed trades taken during early_risk_off regime — which momentum trades breakout_only would have dropped)\n');

  for (const mode of FILTER_CHANGES) {
    const c = CFG[mode];
    const weight = 1 / (c.portfolioSize || 1) * (c.positionSizePct || 1);
    const eroTrades = (TRADES[mode]||[]).filter(t => RESOLVED.has((t.status||'').replace(/_amb$/,'')) && regimeKey(t.regime) === 'early_risk_off');
    const mom = eroTrades.filter(t => stratClass(t.strategy) === 'momentum');
    const bo = eroTrades.filter(t => stratClass(t.strategy) === 'breakout');
    const sumMom = mom.reduce((s,t)=>s+(t.pnlPct||0),0);
    console.log(`── ${mode} (pSize=${c.portfolioSize}) — ${eroTrades.length} closed early_risk_off trades ──`);
    console.log(`   DROPPED (momentum, ${mom.length}): ${mom.map(t=>t.ticker+' '+t.pnlPct+'%').join(', ')||'none'}  → raw ΣPnL=${sumMom.toFixed(1)}% (weighted ${(sumMom*weight).toFixed(2)}pp)`);
    console.log(`   KEPT (breakout, ${bo.length}):    ${bo.map(t=>t.ticker+' '+t.pnlPct+'%').join(', ')||'none'}`);
    console.log(`   → Going forward, early_risk_off slots go to breakout (PF 2.14) instead of diluting with momentum (PF 1.29). Recent impact small if recent ERO picks were already breakout.\n`);
  }

  console.log('=== Done (no files written) ===');
}

main().catch(e => { console.error('Fatal:', e.message, e.stack); process.exit(1); });
