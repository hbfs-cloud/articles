#!/usr/bin/env node
/**
 * incremental-optimize.js — Apply plateau-recommended changes ONE AT A TIME
 *
 * For each proposed change:
 *   1. Save baseline stats
 *   2. Apply the single param change to modes-config.json
 *   3. Clear trades for that mode only
 *   4. Run sweep (re-simulates that mode)
 *   5. Compare stats: if improved → KEEP, if degraded → REVERT
 *   6. Move to next change
 *
 * Usage: node tools/incremental-optimize.js [--mode X] [--dry-run]
 */

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'modes-config.json');
const TRADES_PATH = path.join(__dirname, '..', 'data', 'backtest-trades.json');
const RESULTS_PATH = path.join(__dirname, '..', 'data', 'backtest-results.json');

const DRY_RUN = process.argv.includes('--dry-run');
const ONLY_MODE = process.argv.find((a, i) => process.argv[i - 1] === '--mode') || null;

const CHANGES = [
  { mode: 'balanced', param: 'partialTP', from: false, to: true, reason: 'plateau stability 75%' },
  { mode: 'balanced', param: 'breakevenPct', from: 0, to: 1, reason: 'plateau stability 60%' },
  { mode: 'balanced', param: 'staleDays', from: 0, to: 3, reason: 'plateau stability 55%' },
  { mode: 'balanced', param: 'dailyTrailPct', from: 2, to: 4, reason: 'plateau stability 50%' },
  { mode: 'balanced', param: 'topN', from: 2, to: 5, reason: 'plateau stability 65%' },
  { mode: 'turbo', param: 'minScore', from: 90, to: 85, reason: 'plateau stability 60%' },
  { mode: 'dynamic', param: 'minScore', from: 90, to: 85, reason: 'plateau stability 55%' },
  { mode: 'dynamic', param: 'partialTP', from: false, to: true, reason: 'plateau stability 70%' },
  { mode: 'secured', param: 'partialTP', from: false, to: true, reason: 'plateau stability 65%' },
  { mode: 'tkl', param: 'horizon', from: 252, to: 8, reason: 'plateau stability 55%' },
];

function getStats(mode) {
  const trades = JSON.parse(fs.readFileSync(TRADES_PATH, 'utf8'));
  const mt = trades[mode] || [];
  const closed = mt.filter(t => t.status !== 'open' && !t._premature);
  const wins = closed.filter(t => t.pnlPct > 0);
  const wr = closed.length ? wins.length / closed.length * 100 : 0;
  const sumPnl = closed.reduce((s, t) => s + (t.pnlPct || 0), 0);
  const avgPnl = closed.length ? sumPnl / closed.length : 0;
  return { trades: closed.length, wr: +wr.toFixed(1), sumPnl: +sumPnl.toFixed(2), avgPnl: +avgPnl.toFixed(2) };
}

function applyChange(mode, param, value) {
  const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  cfg.modes[mode][param] = value;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

function clearModeTrades(mode) {
  const trades = JSON.parse(fs.readFileSync(TRADES_PATH, 'utf8'));
  trades[mode] = [];
  fs.writeFileSync(TRADES_PATH, JSON.stringify(trades, null, 2));
}

function runSweep() {
  try {
    execSync('node tools/sweep.js 2>&1', { cwd: path.join(__dirname, '..'), timeout: 300000 });
  } catch (e) {
    console.error('  Sweep error (continuing):', e.message.slice(0, 200));
  }
}

function scoreDelta(before, after) {
  if (before.trades === 0 && after.trades === 0) return 0;
  const pnlDelta = after.sumPnl - before.sumPnl;
  const wrDelta = after.wr - before.wr;
  return pnlDelta + wrDelta * 0.5;
}

console.log('=== Incremental Plateau Optimization ===');
console.log(`Changes to test: ${CHANGES.length} | Mode filter: ${ONLY_MODE || 'all'} | Dry-run: ${DRY_RUN}`);
console.log('');

const applied = [];
const rejected = [];

for (const change of CHANGES) {
  if (ONLY_MODE && change.mode !== ONLY_MODE) continue;

  console.log(`--- Testing: ${change.mode}.${change.param} = ${change.from} → ${change.to} (${change.reason}) ---`);

  const before = getStats(change.mode);
  console.log(`  Before: ${before.trades}T, WR ${before.wr}%, PnL ${before.sumPnl}%, avg ${before.avgPnl}%`);

  if (DRY_RUN) {
    console.log('  [DRY-RUN] Skipping actual change');
    continue;
  }

  const cfgBackup = fs.readFileSync(CONFIG_PATH, 'utf8');
  const tradesBackup = fs.readFileSync(TRADES_PATH, 'utf8');

  applyChange(change.mode, change.param, change.to);
  clearModeTrades(change.mode);

  console.log('  Running sweep...');
  runSweep();

  const after = getStats(change.mode);
  console.log(`  After:  ${after.trades}T, WR ${after.wr}%, PnL ${after.sumPnl}%, avg ${after.avgPnl}%`);

  const delta = scoreDelta(before, after);
  const pnlDelta = after.sumPnl - before.sumPnl;
  const wrDelta = (after.wr - before.wr).toFixed(1);

  if (pnlDelta >= -2 && (pnlDelta > 0 || parseFloat(wrDelta) > 2)) {
    console.log(`  ✅ KEEP — PnL ${pnlDelta >= 0 ? '+' : ''}${pnlDelta.toFixed(2)}%, WR ${wrDelta >= 0 ? '+' : ''}${wrDelta}% (score: ${delta.toFixed(1)})`);
    applied.push({ ...change, before, after, pnlDelta: +pnlDelta.toFixed(2), wrDelta: +parseFloat(wrDelta) });
  } else {
    console.log(`  ❌ REVERT — PnL ${pnlDelta >= 0 ? '+' : ''}${pnlDelta.toFixed(2)}%, WR ${wrDelta >= 0 ? '+' : ''}${wrDelta}% (score: ${delta.toFixed(1)})`);
    fs.writeFileSync(CONFIG_PATH, cfgBackup);
    fs.writeFileSync(TRADES_PATH, tradesBackup);
    rejected.push({ ...change, before, after, pnlDelta: +pnlDelta.toFixed(2), wrDelta: +parseFloat(wrDelta) });
  }
  console.log('');
}

console.log('=== SUMMARY ===');
console.log(`Applied: ${applied.length} | Rejected: ${rejected.length}`);
if (applied.length) {
  console.log('\nKEPT:');
  for (const a of applied)
    console.log(`  ✅ ${a.mode}.${a.param} ${a.from}→${a.to} | PnL ${a.pnlDelta >= 0 ? '+' : ''}${a.pnlDelta}% WR ${a.wrDelta >= 0 ? '+' : ''}${a.wrDelta}%`);
}
if (rejected.length) {
  console.log('\nREJECTED:');
  for (const r of rejected)
    console.log(`  ❌ ${r.mode}.${r.param} ${r.from}→${r.to} | PnL ${r.pnlDelta >= 0 ? '+' : ''}${r.pnlDelta}% WR ${r.wrDelta >= 0 ? '+' : ''}${r.wrDelta}%`);
}
