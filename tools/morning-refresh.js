#!/usr/bin/env node
'use strict';

/**
 * morning-refresh.js — 7am ET recalibration
 *
 * Re-runs tracking + frozen sweep + API regen so portfolio JSON reflects
 * overnight price action before the market opens. Does NOT run the full
 * grid search (--frozen-only keeps it fast, ~30-60s total).
 *
 * Cron (via Discord bot):
 *   every weekday at 07:00 articles morning refresh
 *
 * Steps:
 *   1. update-tracking.js — refresh Yahoo OHLC on open trades
 *   2. sweep.js --frozen-only — re-price closed trades with new data
 *   3. gen-status-page.js — snapshot status dashboard
 *   4. gen-api.js — refresh public portfolio/v1/*.json
 *
 * No git commit here — that's explicit via /publish-daily-card.sh in evening.
 * This is a pure read/compute refresh of public state.
 */

const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function run(cmd, label) {
  console.log(`\n▶ ${label}`);
  console.log(`  $ ${cmd}`);
  const t0 = Date.now();
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
    console.log(`  ✓ ${label} done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } catch (e) {
    console.error(`  ✗ ${label} failed (exit ${e.status}) — continuing`);
  }
}

console.log('=== Morning Recalibration ===');
console.log(`Date: ${new Date().toISOString()}`);

run('node tools/update-tracking.js', 'Step 1/4 — Tracking refresh (Yahoo OHLC)');
run('node tools/sweep.js --frozen-only', 'Step 2/4 — Frozen sweep (closed trades re-price)');
run('node tools/gen-status-page.js', 'Step 3/4 — Status page snapshot');
run('node tools/gen-api.js', 'Step 4/4 — Public JSON API regen');

console.log('\n✅ Morning recalibration complete. Public portfolio state refreshed.');
