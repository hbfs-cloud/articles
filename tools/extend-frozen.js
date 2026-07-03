#!/usr/bin/env node
/*
 * extend-frozen.js — Forward-extend a SEALED equity curve with recently-closed
 * trades, WITHOUT ever rewriting a sealed point and WITHOUT the config-blind
 * uniform recompute that deflated dynamic 91.18%→75.45% on 2026-07-02.
 *
 * Contract (per mode):
 *   1. Load frozen_<mode>.equityCurve (SEALED). anchorDate/anchorValue = last point.
 *   2. Load data/backtest-trades.json[<mode>]. New closed trades = exitDate > anchorDate.
 *   3. SEAM GUARD (critical): recompute the equity value AT anchorDate from the trades
 *      using the SAME MtM formula as sweep.js/computeStatsFromTrades (realized + unrealized,
 *      getWeight portfolio-aware). If |recompute − sealed| > epsilon → ABORT this mode.
 *      This is the honest gate: a mismatch means the current trade set no longer reproduces
 *      the sealed anchor, so any forward extension would inject a config-blind discontinuity.
 *   4. If the seam reconciles: append ONLY the new daily points (dates > anchorDate) via the
 *      engine's own append-only path (opts.priorEC), which copies sealed points VERBATIM and
 *      fast-forwards realized PnL to the anchor before computing new days.
 *   5. Prove invariants: (a) extended prefix is BYTE-IDENTICAL to the sealed curve;
 *      (b) length >= sealed length; (c) returnTotal only moves through the new points.
 *
 * DRY by default. --apply writes back to backtest-results.json (NOT used in preview).
 *
 * ⚠️ ADOPTED PATH = tools/pit-forward.js. The production status page shows current equity via
 * the forward-only layer (data/pit-forward.json): sealed history (immutable) + a forward delta
 * of trades closed/opened since the anchor, WITHOUT ever writing back to backtest-results.json.
 * This script (extend-frozen.js) is now a DIAGNOSTIC only — use it to investigate a seam
 * mismatch (does the current trade set still reproduce the sealed anchor under the sweep MtM?),
 * NOT to persist a forward curve. Prefer pit-forward.js for anything user-visible.
 *
 * Usage: node tools/extend-frozen.js --modes fortress,dynamic,balanced [--epsilon 0.05] [--apply] [--json]
 */

const fs = require('fs');
const path = require('path');

// Reuse the EXACT engine formula. sweep.js only runs main() when invoked directly
// (require.main === module guard), so requiring it here is side-effect free.
const sweep = require('./sweep.js');
const { computeStatsFromTrades, fetchOHLCV } = sweep;

const ROOT = path.join(__dirname, '..');
const RESULTS_PATH = path.join(ROOT, 'data', 'backtest-results.json');
const TRADES_PATH = path.join(ROOT, 'data', 'backtest-trades.json');
const CONFIG_PATH = path.join(ROOT, 'data', 'modes-config.json');

const RESOLVED_STATUSES = ['tp1', 'tp1_partial', 'tp2', 'sl', 'expired', 'rotated', 'breakeven', 'trail'];
const isResolved = t => RESOLVED_STATUSES.includes((t.status || '').replace(/_amb$/, ''));

function parseArgs(argv) {
  const out = { modes: ['fortress', 'dynamic', 'balanced'], epsilon: 0.05, apply: false, json: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--modes') out.modes = (argv[++i] || '').split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--epsilon') out.epsilon = parseFloat(argv[++i]);
    else if (a === '--apply') out.apply = true;
    else if (a === '--json') out.json = true;
  }
  return out;
}

// Warm the shared priceCache so the MtM unrealized leg has bars. fetchOHLCV mutates
// sweep.js's module-scope priceCache — the same object computeStatsFromTrades reads.
async function warmPriceCache(trades) {
  const tickers = [...new Set(trades.map(t => t.ticker).filter(Boolean))];
  let ok = 0;
  for (const tk of tickers) {
    try { if (await fetchOHLCV(tk)) ok++; } catch { /* skip */ }
  }
  return { requested: tickers.length, resolved: ok };
}

function ecEqual(a, b) {
  // Byte-identity of a point = identical JSON serialization (date + value).
  return JSON.stringify(a) === JSON.stringify(b);
}

async function extendMode(mode, allResults, allTrades, cfgModes, epsilon) {
  const rep = { mode };
  const frozen = allResults[`frozen_${mode}`];
  if (!frozen || !Array.isArray(frozen.equityCurve) || frozen.equityCurve.length === 0) {
    return { ...rep, status: 'ABORT', reason: `no frozen_${mode}.equityCurve` };
  }
  const cfg = (cfgModes || {})[mode];
  if (!cfg) return { ...rep, status: 'ABORT', reason: `no modes-config entry for ${mode}` };

  const sealedEC = frozen.equityCurve;
  const anchorDate = sealedEC[sealedEC.length - 1].date;
  const anchorValue = sealedEC[sealedEC.length - 1].value;
  const pSize = cfg.portfolioSize;
  const posPct = cfg.positionSizePct || 1;
  const calendar = cfg.calendar;

  const trades = (allTrades[mode] || []);
  const closed = trades.filter(isResolved);
  const newClosed = closed.filter(t => t.exitDate && t.exitDate > anchorDate);
  rep.anchorDate = anchorDate;
  rep.anchorValue = anchorValue;
  rep.sealedLen = sealedEC.length;
  rep.sealedTrades = frozen.trades;
  rep.fileClosedTotal = closed.length;
  rep.fileClosedPreAnchor = closed.filter(t => t.exitDate && t.exitDate <= anchorDate).length;
  rep.newClosedTrades = newClosed.map(t => ({ ticker: t.ticker, exitDate: t.exitDate, status: t.status, pnlPct: t.pnlPct }));

  // Warm bars for this mode's tickers (unrealized leg needs closes).
  rep.priceCache = await warmPriceCache(trades);

  // ── SEAM GUARD: fresh full recompute (NO priorEC), read value at anchorDate ──
  const fresh = computeStatsFromTrades(trades, pSize, posPct, mode, calendar, {});
  if (!fresh || !Array.isArray(fresh.equityCurve)) {
    return { ...rep, status: 'ABORT', reason: 'fresh recompute produced no equity curve' };
  }
  const anchorPt = fresh.equityCurve.find(p => p.date === anchorDate);
  if (!anchorPt) {
    return { ...rep, status: 'ABORT', reason: `anchorDate ${anchorDate} absent from fresh recompute — cannot verify seam` };
  }
  const recomputedAnchor = anchorPt.value;
  const seamDiff = +(recomputedAnchor - anchorValue).toFixed(4);
  rep.recomputedAnchor = recomputedAnchor;
  rep.seamDiff = seamDiff;
  rep.epsilon = epsilon;
  rep.seamReconciles = Math.abs(seamDiff) <= epsilon;

  if (!rep.seamReconciles) {
    rep.status = 'ABORT';
    rep.reason = `seam mismatch: recompute anchor=${recomputedAnchor} vs sealed=${anchorValue} (Δ=${seamDiff}, eps=${epsilon}) — extension impossible sans divergence config-aveugle`;
    return rep;
  }

  // ── Seam OK: append-only extension (sealed points copied VERBATIM by the engine) ──
  const ext = computeStatsFromTrades(trades, pSize, posPct, mode, calendar, { priorEC: sealedEC });
  if (!ext || !Array.isArray(ext.equityCurve)) {
    return { ...rep, status: 'ABORT', reason: 'append-only extension produced no equity curve' };
  }
  const extendedCurve = ext.equityCurve;

  // ── INVARIANT (a): prefix is byte-identical to the sealed curve ──
  let prefixIdentical = extendedCurve.length >= sealedEC.length;
  let firstMismatch = -1;
  if (prefixIdentical) {
    for (let i = 0; i < sealedEC.length; i++) {
      if (!ecEqual(extendedCurve[i], sealedEC[i])) { prefixIdentical = false; firstMismatch = i; break; }
    }
  }
  // ── INVARIANT (b): length monotonic ──
  const lengthOk = extendedCurve.length >= sealedEC.length;
  const newPointsCount = extendedCurve.length - sealedEC.length;

  const oldReturn = frozen.returnTotal;
  const newReturn = ext.returnTotal;
  const oldMaxDD = frozen.maxDD;
  const newMaxDD = ext.maxDD;

  // ── INVARIANT (c): returnTotal only moves through the new points ──
  // Prefix identical ⇒ if there are 0 new points, return/curve tail is unchanged.
  const returnMovedOnlyViaNewPoints = (newPointsCount > 0) || (Math.abs((newReturn ?? 0) - (oldReturn ?? 0)) <= 1e-9);

  rep.status = (prefixIdentical && lengthOk && returnMovedOnlyViaNewPoints) ? 'OK' : 'ABORT';
  if (rep.status === 'ABORT') {
    rep.reason = !prefixIdentical
      ? `prefix NOT byte-identical (first mismatch at index ${firstMismatch})`
      : !lengthOk ? 'extended curve shorter than sealed'
      : 'returnTotal changed without any new points';
  }
  rep.prefixByteIdentical = prefixIdentical;
  rep.lengthOk = lengthOk;
  rep.newPointsCount = newPointsCount;
  rep.oldReturn = oldReturn;
  rep.newReturn = newReturn;
  rep.oldMaxDD = oldMaxDD;
  rep.newMaxDD = newMaxDD;
  rep.oldTrades = frozen.trades;
  rep.newTrades = ext.trades;
  rep.newWinRate = ext.winRate;
  rep.newProfitFactor = ext.profitFactor;
  rep.extendedTail = extendedCurve.slice(-Math.min(newPointsCount + 1, 6));
  // stash the fully-built extension for --apply (not serialized in report)
  Object.defineProperty(rep, '_extendedFrozen', {
    enumerable: false,
    value: {
      ...frozen,
      returnTotal: ext.returnTotal, returnRealized: ext.returnRealized,
      returnUnrealized: ext.returnUnrealized, maxDD: ext.maxDD,
      winRate: ext.winRate, profitFactor: ext.profitFactor, trades: ext.trades,
      calmar: ext.calmar, sharpe: ext.sharpe, returnDDRatio: ext.returnDDRatio,
      equityCurve: extendedCurve,
    },
  });
  return rep;
}

async function main() {
  const args = parseArgs(process.argv);
  const allResults = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf8'));
  const allTrades = JSON.parse(fs.readFileSync(TRADES_PATH, 'utf8'));
  const cfgModes = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')).modes || {};

  const reports = [];
  for (const mode of args.modes) {
    // eslint-disable-next-line no-await-in-loop
    reports.push(await extendMode(mode, allResults, allTrades, cfgModes, args.epsilon));
  }

  if (args.json) {
    console.log(JSON.stringify(reports, null, 2));
  } else {
    console.log(`\n=== extend-frozen ${args.apply ? '(APPLY)' : '(DRY)'} — eps=${args.epsilon} ===\n`);
    for (const r of reports) {
      console.log(`── ${r.mode} ──`);
      console.log(`  status            : ${r.status}${r.reason ? '  (' + r.reason + ')' : ''}`);
      if (r.anchorDate) {
        console.log(`  anchor            : ${r.anchorDate} = ${r.anchorValue}`);
        console.log(`  sealed len/trades : ${r.sealedLen} pts / ${r.sealedTrades} trades`);
        console.log(`  file closed       : ${r.fileClosedTotal} (${r.fileClosedPreAnchor} <=anchor, ${r.newClosedTrades.length} >anchor)`);
        if (r.recomputedAnchor !== undefined)
          console.log(`  seam              : recompute=${r.recomputedAnchor} vs sealed=${r.anchorValue}  Δ=${r.seamDiff} (eps ${r.epsilon}) → ${r.seamReconciles ? 'RECONCILES' : 'MISMATCH'}`);
        if (r.priceCache) console.log(`  price bars        : ${r.priceCache.resolved}/${r.priceCache.requested} tickers`);
      }
      if (r.status === 'OK') {
        console.log(`  returnTotal       : ${r.oldReturn}%  →  ${r.newReturn}%`);
        console.log(`  maxDD             : ${r.oldMaxDD}%  →  ${r.newMaxDD}%`);
        console.log(`  trades            : ${r.oldTrades}  →  ${r.newTrades}  (WR ${r.newWinRate}% / PF ${r.newProfitFactor})`);
        console.log(`  new points        : ${r.newPointsCount}`);
        console.log(`  prefix byte-ident : ${r.prefixByteIdentical}   length>= : ${r.lengthOk}`);
        if (r.newClosedTrades.length) {
          console.log(`  new closed trades :`);
          for (const t of r.newClosedTrades) console.log(`      ${t.ticker} ${t.status} ${t.exitDate} ${t.pnlPct >= 0 ? '+' : ''}${t.pnlPct}%`);
        }
      } else if (r.newClosedTrades && r.newClosedTrades.length) {
        console.log(`  (new closed trades that WOULD extend, blocked by seam):`);
        for (const t of r.newClosedTrades) console.log(`      ${t.ticker} ${t.status} ${t.exitDate} ${t.pnlPct >= 0 ? '+' : ''}${t.pnlPct}%`);
      }
      console.log('');
    }
  }

  if (args.apply) {
    let wrote = 0;
    for (const r of reports) {
      if (r.status === 'OK' && r._extendedFrozen) {
        allResults[`frozen_${r.mode}`] = r._extendedFrozen;
        wrote++;
      }
    }
    if (wrote > 0) {
      fs.writeFileSync(RESULTS_PATH, JSON.stringify(allResults, null, 2));
      console.log(`APPLIED: rewrote ${wrote} frozen_* block(s) in ${RESULTS_PATH}`);
    } else {
      console.log('APPLY requested but no mode passed all invariants — nothing written.');
    }
  }

  const anyAbort = reports.some(r => r.status === 'ABORT');
  process.exit(anyAbort && !args.apply ? 0 : 0); // report-only tool: never nonzero in DRY
}

main().catch(e => { console.error('Fatal:', e.message, e.stack); process.exit(1); });
