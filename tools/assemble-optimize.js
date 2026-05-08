#!/usr/bin/env node
/**
 * assemble-optimize.js — Étape 3+4 of plateau methodology
 *
 * 1. Record baseline stats (v5.3)
 * 2. Apply ALL plateau optima at once (assembly)
 * 3. Re-simulate → compare vs baseline
 * 4. If regression > 15% on any mode: binary-search conflicting params
 *    - Remove each param one at a time from assembly
 *    - The param whose removal helps the most = the conflict
 *    - Drop it, re-test
 * 5. Fine-tune (±1-2 steps) on the surviving assembled config
 *
 * Usage: node tools/assemble-optimize.js
 */

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'modes-config.json');
const TRADES_PATH = path.join(__dirname, '..', 'data', 'backtest-trades.json');

const PLATEAU_CHANGES = {
  turbo:    [{ param: 'minScore', from: 90, to: 85 }],
  dynamic:  [{ param: 'minScore', from: 90, to: 85 }, { param: 'partialTP', from: false, to: true }],
  balanced: [
    { param: 'partialTP', from: false, to: true },
    { param: 'breakevenPct', from: 0, to: 1 },
    { param: 'staleDays', from: 0, to: 3 },
    { param: 'dailyTrailPct', from: 2, to: 4 },
    { param: 'topN', from: 2, to: 5 },
  ],
  secured:  [{ param: 'partialTP', from: false, to: true }],
  fortress: [],
  tkl:      [{ param: 'horizon', from: 252, to: 8 }],
};

function getStats(mode) {
  delete require.cache[require.resolve(TRADES_PATH)];
  const trades = JSON.parse(fs.readFileSync(TRADES_PATH, 'utf8'));
  const mt = trades[mode] || [];
  const closed = mt.filter(t => t.status !== 'open' && !t._premature);
  const wins = closed.filter(t => (t.pnlPct || 0) > 0);
  const wr = closed.length ? wins.length / closed.length * 100 : 0;
  const sumPnl = closed.reduce((s, t) => s + (t.pnlPct || 0), 0);
  return { trades: closed.length, wr: +wr.toFixed(1), sumPnl: +sumPnl.toFixed(2) };
}

function applyChanges(mode, changes) {
  const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  for (const c of changes) cfg.modes[mode][c.param] = c.to;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

function revertChanges(mode, changes) {
  const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  for (const c of changes) cfg.modes[mode][c.param] = c.from;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

function clearAndSweep(modes) {
  const trades = JSON.parse(fs.readFileSync(TRADES_PATH, 'utf8'));
  for (const m of modes) trades[m] = [];
  fs.writeFileSync(TRADES_PATH, JSON.stringify(trades, null, 2));
  try {
    execSync('node tools/sweep.js 2>&1', { cwd: path.join(__dirname, '..'), timeout: 300000 });
  } catch (e) {
    console.error('  Sweep warning:', e.message.slice(0, 150));
  }
}

function fmt(s) {
  return `${s.trades}T WR${s.wr}% PnL${s.sumPnl >= 0 ? '+' : ''}${s.sumPnl}%`;
}

// ─── Étape 1: Baseline ─────────────────────────────────────────────────────────
console.log('=== Étape 1: Baseline (v5.3) ===\n');
const baseline = {};
const affectedModes = Object.keys(PLATEAU_CHANGES).filter(m => PLATEAU_CHANGES[m].length > 0);
for (const mode of Object.keys(PLATEAU_CHANGES)) {
  baseline[mode] = getStats(mode);
  console.log(`  ${mode}: ${fmt(baseline[mode])}`);
}

// ─── Étape 3: Assembly — apply ALL optima at once ───────────────────────────────
console.log('\n=== Étape 3: Assembly (all plateau optima) ===\n');
for (const mode of affectedModes) {
  console.log(`  ${mode}: applying ${PLATEAU_CHANGES[mode].map(c => c.param + '=' + c.to).join(', ')}`);
  applyChanges(mode, PLATEAU_CHANGES[mode]);
}

console.log('\n  Running sweep (all affected modes)...');
clearAndSweep(affectedModes);

const assembled = {};
for (const mode of Object.keys(PLATEAU_CHANGES)) {
  assembled[mode] = getStats(mode);
}

console.log('\n  Assembly results vs baseline:');
const regressions = [];
for (const mode of Object.keys(PLATEAU_CHANGES)) {
  const b = baseline[mode];
  const a = assembled[mode];
  const pnlDelta = a.sumPnl - b.sumPnl;
  const pnlPct = b.sumPnl !== 0 ? (pnlDelta / Math.abs(b.sumPnl) * 100) : 0;
  const tag = pnlPct < -15 ? ' ⚠️ REGRESSION' : pnlPct >= 0 ? ' ✅' : ' ⚡ minor';
  console.log(`  ${mode}: ${fmt(a)} | Δ PnL ${pnlDelta >= 0 ? '+' : ''}${pnlDelta.toFixed(2)}% (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(0)}%)${tag}`);
  if (pnlPct < -15 && PLATEAU_CHANGES[mode].length > 1) {
    regressions.push(mode);
  }
}

// ─── Étape 3b: Identify conflicting params (for modes with regression) ──────────
if (regressions.length > 0) {
  console.log(`\n=== Étape 3b: Conflict detection for ${regressions.join(', ')} ===\n`);

  for (const mode of regressions) {
    const changes = PLATEAU_CHANGES[mode];
    console.log(`  ${mode}: testing removal of each param from assembly...`);

    // For each param, remove it and re-test (leave-one-out)
    const leaveOneOutResults = [];
    for (let i = 0; i < changes.length; i++) {
      const removed = changes[i];
      // Revert just this one param
      const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      cfg.modes[mode][removed.param] = removed.from;
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));

      // Clear and re-sweep
      const trades = JSON.parse(fs.readFileSync(TRADES_PATH, 'utf8'));
      trades[mode] = [];
      fs.writeFileSync(TRADES_PATH, JSON.stringify(trades, null, 2));
      try {
        execSync('node tools/sweep.js 2>&1', { cwd: path.join(__dirname, '..'), timeout: 300000 });
      } catch (e) { /* ignore */ }

      const stats = getStats(mode);
      const pnlDelta = stats.sumPnl - baseline[mode].sumPnl;
      leaveOneOutResults.push({ removed: removed.param, stats, pnlDelta });
      console.log(`    without ${removed.param}: ${fmt(stats)} | Δ baseline ${pnlDelta >= 0 ? '+' : ''}${pnlDelta.toFixed(2)}%`);

      // Re-apply the param for next iteration
      cfg.modes[mode][removed.param] = removed.to;
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
    }

    // Find which removal helps most (highest PnL vs assembled)
    leaveOneOutResults.sort((a, b) => b.pnlDelta - a.pnlDelta);
    const bestRemoval = leaveOneOutResults[0];
    console.log(`\n  → Biggest conflict: ${bestRemoval.removed} (removing it gives PnL ${bestRemoval.pnlDelta >= 0 ? '+' : ''}${bestRemoval.pnlDelta.toFixed(2)}%)`);

    // If removing the worst offender brings us to ≥ 85% of baseline, drop it
    const threshold = baseline[mode].sumPnl * 0.85;
    if (bestRemoval.stats.sumPnl >= threshold) {
      console.log(`  → Dropping ${bestRemoval.removed}, keeping the rest (PnL ${bestRemoval.stats.sumPnl.toFixed(2)}% ≥ 85% threshold ${threshold.toFixed(2)}%)`);
      // Apply: revert the conflicting param
      const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      cfg.modes[mode][bestRemoval.removed] = changes.find(c => c.param === bestRemoval.removed).from;
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
      // Clear and re-sweep to get final trades
      const trades = JSON.parse(fs.readFileSync(TRADES_PATH, 'utf8'));
      trades[mode] = [];
      fs.writeFileSync(TRADES_PATH, JSON.stringify(trades, null, 2));
      try {
        execSync('node tools/sweep.js 2>&1', { cwd: path.join(__dirname, '..'), timeout: 300000 });
      } catch (e) { /* ignore */ }
    } else {
      // Still below threshold — drop the two worst
      console.log(`  → Still below 85% threshold. Trying to drop top 2 conflicts...`);
      const secondRemoval = leaveOneOutResults[1];
      const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      cfg.modes[mode][bestRemoval.removed] = changes.find(c => c.param === bestRemoval.removed).from;
      cfg.modes[mode][secondRemoval.removed] = changes.find(c => c.param === secondRemoval.removed).from;
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
      const trades = JSON.parse(fs.readFileSync(TRADES_PATH, 'utf8'));
      trades[mode] = [];
      fs.writeFileSync(TRADES_PATH, JSON.stringify(trades, null, 2));
      try {
        execSync('node tools/sweep.js 2>&1', { cwd: path.join(__dirname, '..'), timeout: 300000 });
      } catch (e) { /* ignore */ }
      const finalStats = getStats(mode);
      console.log(`  → After dropping ${bestRemoval.removed} + ${secondRemoval.removed}: ${fmt(finalStats)}`);
      if (finalStats.sumPnl < threshold) {
        console.log(`  → Still below threshold. Reverting ALL changes for ${mode}.`);
        revertChanges(mode, changes);
        const trades2 = JSON.parse(fs.readFileSync(TRADES_PATH, 'utf8'));
        trades2[mode] = [];
        fs.writeFileSync(TRADES_PATH, JSON.stringify(trades2, null, 2));
        try {
          execSync('node tools/sweep.js 2>&1', { cwd: path.join(__dirname, '..'), timeout: 300000 });
        } catch (e) { /* ignore */ }
      }
    }
  }

  // For modes with single-param regression (not in regressions list), just revert
  for (const mode of affectedModes) {
    if (regressions.includes(mode)) continue;
    const a = assembled[mode];
    const b = baseline[mode];
    const pnlPct = b.sumPnl !== 0 ? ((a.sumPnl - b.sumPnl) / Math.abs(b.sumPnl) * 100) : 0;
    if (pnlPct < -15) {
      console.log(`\n  ${mode}: single-param regression > 15%, reverting`);
      revertChanges(mode, PLATEAU_CHANGES[mode]);
      const trades = JSON.parse(fs.readFileSync(TRADES_PATH, 'utf8'));
      trades[mode] = [];
      fs.writeFileSync(TRADES_PATH, JSON.stringify(trades, null, 2));
      try {
        execSync('node tools/sweep.js 2>&1', { cwd: path.join(__dirname, '..'), timeout: 300000 });
      } catch (e) { /* ignore */ }
    }
  }
}

// ─── Final summary ──────────────────────────────────────────────────────────────
console.log('\n=== FINAL RESULTS ===\n');
const finalCfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
for (const mode of Object.keys(PLATEAU_CHANGES)) {
  const final = getStats(mode);
  const b = baseline[mode];
  const pnlDelta = final.sumPnl - b.sumPnl;
  const changes = PLATEAU_CHANGES[mode];
  const keptParams = changes.filter(c => finalCfg.modes[mode][c.param] === c.to);
  const droppedParams = changes.filter(c => finalCfg.modes[mode][c.param] !== c.to);
  console.log(`${mode}:`);
  console.log(`  Baseline: ${fmt(b)}`);
  console.log(`  Final:    ${fmt(final)} | Δ PnL ${pnlDelta >= 0 ? '+' : ''}${pnlDelta.toFixed(2)}%`);
  if (keptParams.length) console.log(`  Kept:     ${keptParams.map(c => c.param + '=' + c.to).join(', ')}`);
  if (droppedParams.length) console.log(`  Dropped:  ${droppedParams.map(c => c.param).join(', ')}`);
  console.log('');
}
