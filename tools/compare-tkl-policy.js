#!/usr/bin/env node
/**
 * compare-tkl-policy.js — A/B test for tkl_pool ingestion across all modes.
 *
 * For each mode in modes-config.json, runs full historical re-simulation under:
 *   - off:     published Top 10 only
 *   - hybrid:  Top 10 + tkl_pool merged into shared candidate pool
 *
 * Uses each mode's CURRENT frozen params, so the comparison isolates the
 * effect of the candidate pool — not parameter tuning.
 *
 * Outputs a per-mode table (Return / DD / WR / PF / Trades) and recommends a
 * winner based on calmar (Return / |DD|), with a guard against WR collapse.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const sweep = require('./sweep');
const { parseScan, simulateTrade, simulatePortfolio, computeStatsFromTrades, fetchOHLCV, priceCache } = sweep;

const ROOT = path.join(__dirname, '..');
const SCANNER_DIR = path.join(ROOT, 'scanner');
const MODES_CFG = path.join(ROOT, 'data/modes-config.json');
const FROM_DATE = process.env.FROM || '2026-02-15';

function fmtPct(v) { return (v >= 0 ? '+' : '') + Number(v || 0).toFixed(2) + '%'; }

async function main() {
  const cfg = JSON.parse(fs.readFileSync(MODES_CFG, 'utf8'));
  const modes = cfg.modes;

  // Parse all scans, get setups + tklPool per scan
  const scanDirs = fs.readdirSync(SCANNER_DIR)
    .filter(d => /^\d{8}(-\d+)?$/.test(d))
    .filter(d => {
      const date = d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8);
      return date >= FROM_DATE;
    })
    .sort();

  console.log(`Parsing ${scanDirs.length} scans from ${FROM_DATE}...`);
  const scans = scanDirs.map(parseScan).filter(Boolean);
  const top10 = scans.flatMap(s => s.setups.map(t => ({ ...t, scanDate: s.scanDate, dir: s.dir, regime: s.regime })));
  const pool = scans.flatMap(s => (s.tklPool || []).map(t => ({ ...t, scanDate: s.scanDate, dir: s.dir, regime: s.regime })));
  console.log(`Top10 setups: ${top10.length} | tkl_pool setups: ${pool.length}`);

  // Pre-fetch OHLCV for all unique tickers
  const allTickers = [...new Set([...top10, ...pool].map(t => t.ticker))];
  console.log(`Fetching OHLCV for ${allTickers.length} tickers...`);
  let fetched = 0;
  for (const t of allTickers) {
    await fetchOHLCV(t);
    fetched++;
    if (fetched % 25 === 0) process.stdout.write(`  ${fetched}/${allTickers.length}\r`);
  }
  console.log(`Fetched ${Object.keys(priceCache).filter(k => priceCache[k]).length}/${allTickers.length}\n`);

  // For each mode × policy, simulate
  const results = {}; // results[mode][policy] = stats
  for (const [modeId, mc] of Object.entries(modes)) {
    results[modeId] = {};

    for (const policy of ['off', 'hybrid']) {
      const setups = policy === 'off' ? top10.slice() : top10.concat(pool);

      // Resolve each setup → closed trade
      const tradeCfg = {
        horizonDays: mc.horizon || 10,
        partialTP: !!mc.partialTP, partialTPPct: mc.partialTPPct ?? 0.5,
        trailingStop: !!mc.trailingStop,
        maxStopPct: mc.maxStopPct || 0,
        atrStopMult: mc.atrStopMult || 0,
        dailyTrailPct: mc.dailyTrailPct || 0,
        breakevenPct: mc.breakevenPct || 0,
        staleDays: mc.staleDays || 0,
        entryGatePct: mc.entryGatePct || 0,
        vwapGate: !!mc.vwapGate,
      };
      const resolved = [];
      for (const setup of setups) {
        const hist = priceCache[setup.ticker];
        if (!hist) continue;
        const r = simulateTrade(setup, setup.scanDate, hist, tradeCfg);
        if (r) resolved.push({ ...r, regime: setup.regime || null });
      }

      // Portfolio simulation
      const portCfg = {
        portfolioSize: mc.portfolioSize || 1,
        topN: mc.topN || 1,
        minScore: mc.minScore || 0,
        rotation: mc.rotation || 'none',
        strategyFilter: sweep.STRATEGY_FILTERS_MAP[mc.filterName] || sweep.STRATEGY_FILTERS_MAP.all,
        horizonDays: mc.horizon || 10,
        partialTP: !!mc.partialTP,
        trailingStop: !!mc.trailingStop,
        positionSizePct: mc.positionSizePct || 1,
        regimeFilters: mc.regimeFilters || null,
        ddBreakerPct: mc.ddBreakerPct ?? 0,
        sectorCapMax: mc.sectorCapMax ?? 0,
        sizingMethod: mc.sizingMethod || null,
        targetRiskPct: mc.targetRiskPct ?? 0,
        vixKillThreshold: mc.vixKillThreshold ?? 0,
        correlationCap: mc.correlationCap ?? 0,
        crossModeDedup: false,
      };

      const sim = simulatePortfolio(resolved, scans, portCfg);
      if (!sim) { results[modeId][policy] = null; continue; }
      const stats = computeStatsFromTrades(sim.closedTrades || [], portCfg.portfolioSize, portCfg.positionSizePct, modeId);
      const tklTrades = (sim.closedTrades || []).filter(t => t.source === 'tkl_pool').length;
      results[modeId][policy] = stats ? {
        ret: stats.returnTotal, dd: stats.maxDD, wr: stats.winRate, pf: stats.profitFactor,
        trades: stats.trades, calmar: stats.calmar, tklTrades,
      } : null;
    }
  }

  // Print comparison table
  console.log('\n=== TKL_POLICY A/B (each mode = current frozen params) ===\n');
  const fmtRow = (label, off, hyb) => {
    if (!off || !hyb) { console.log(`${label}  (no data)`); return; }
    const dRet = (hyb.ret - off.ret).toFixed(2);
    const dDD = (hyb.dd - off.dd).toFixed(2);
    const dWR = (hyb.wr - off.wr).toFixed(1);
    console.log(`${label}`);
    console.log(`  off   : Ret ${fmtPct(off.ret).padStart(8)} | DD ${fmtPct(off.dd).padStart(7)} | WR ${off.wr.toFixed(1).padStart(5)}% | PF ${off.pf.toFixed(2).padStart(5)} | Calmar ${off.calmar.toFixed(2).padStart(5)} | trades ${off.trades}`);
    console.log(`  hybrid: Ret ${fmtPct(hyb.ret).padStart(8)} | DD ${fmtPct(hyb.dd).padStart(7)} | WR ${hyb.wr.toFixed(1).padStart(5)}% | PF ${hyb.pf.toFixed(2).padStart(5)} | Calmar ${hyb.calmar.toFixed(2).padStart(5)} | trades ${hyb.trades} (tkl_pool=${hyb.tklTrades})`);
    console.log(`  Δ     : Ret ${dRet >= 0 ? '+' : ''}${dRet}pp | DD ${dDD >= 0 ? '+' : ''}${dDD}pp | WR ${dWR >= 0 ? '+' : ''}${dWR}pp`);

    // Recommendation:
    //   • If both sides have non-zero DD → use Calmar (Return / |DD|).
    //   • If both DD ≈ 0 (small/monotonic curves) → fall back to Return + WR delta.
    //   • Hard guard: hybrid is rejected if WR drops > 5pp OR Return drops > 1pp.
    const winner = (() => {
      if (!off || !hyb) return 'n/a';
      const wrDrop = off.wr - hyb.wr;
      const retDrop = off.ret - hyb.ret;
      if (wrDrop > 5 || retDrop > 1) return 'off';

      const dd0 = Math.abs(off.dd) < 0.01 && Math.abs(hyb.dd) < 0.01;
      if (dd0) {
        const retGain = hyb.ret - off.ret;
        const wrGain = hyb.wr - off.wr;
        if (retGain > 1 && wrGain >= -1) return 'hybrid';
        if (retGain < -1) return 'off';
        return 'off';
      }
      const calmarBetter = (hyb.calmar || 0) > (off.calmar || 0) + 0.05;
      const ddOK = Math.abs(hyb.dd) <= Math.abs(off.dd) * 1.25;
      if (calmarBetter && ddOK) return 'hybrid';
      return 'off';
    })();
    console.log(`  → recommend: ${winner}`);
    console.log();
  };

  for (const id of Object.keys(results)) {
    fmtRow(id.toUpperCase(), results[id].off, results[id].hybrid);
  }

  // Write JSON for downstream
  const outPath = path.join(ROOT, 'data/tkl-policy-comparison.json');
  fs.writeFileSync(outPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    from: FROM_DATE,
    top10_setups: top10.length,
    tkl_pool_setups: pool.length,
    modes: results,
  }, null, 2));
  console.log(`Wrote ${path.relative(ROOT, outPath)}`);
}

main().catch(e => { console.error('Fatal:', e.message, e.stack); process.exit(1); });
