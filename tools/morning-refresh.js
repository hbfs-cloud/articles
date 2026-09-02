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

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOG_DIR = path.join(ROOT, 'data', 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const LOG_FILE = path.join(LOG_DIR, `morning-refresh-${new Date().toISOString().slice(0, 10)}.log`);

const failedSteps = [];

function log(line) {
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function run(bin, args, label, opts = {}) {
  const { critical = false } = opts;
  log(`\n▶ ${label}`);
  log(`  $ ${bin} ${args.join(' ')}`);
  const t0 = Date.now();
  const res = spawnSync(bin, args, { cwd: ROOT, stdio: 'inherit' });
  const dur = ((Date.now() - t0) / 1000).toFixed(1);
  if (res.status === 0) {
    log(`  ✓ ${label} done in ${dur}s`);
    return true;
  }
  log(`  ✗ ${label} failed (exit ${res.status}) — ${critical ? 'aborting' : 'continuing'}`);
  failedSteps.push(label);
  if (critical) {
    log(`\n❌ Critical step failed — downstream steps skipped. See ${LOG_FILE}`);
    process.exit(1);
  }
  return false;
}

log('=== Morning Recalibration ===');
log(`Date: ${new Date().toISOString()}`);
log(`Log:  ${LOG_FILE}`);

// Steps 1-2 are critical — step 2 reads the output of step 1. Abort if either fails.
run('node', ['tools/update-tracking.js'], 'Step 1/4 — Tracking refresh (Yahoo OHLC)', { critical: true });
run('node', ['tools/sweep.js', '--frozen-only'], 'Step 2/4 — Frozen sweep (closed trades re-price)', { critical: true });
// Steps 3-4 are non-critical regenerators — allow one to fail without killing the other.
run('node', ['tools/gen-status-page.js'], 'Step 3/4 — Status page snapshot');
run('node', ['tools/gen-api.js'], 'Step 4/4 — Public JSON API regen');

if (failedSteps.length) {
  log(`\n⚠️  Morning refresh completed with ${failedSteps.length} failed step(s): ${failedSteps.join(', ')}`);
  process.exit(2);
} else {
  log('\n✅ Morning recalibration complete. Public portfolio state refreshed.');
}
