#!/usr/bin/env node
'use strict';

/**
 * morning-refresh.js — 7am ET recalibration
 *
 * Re-runs the certified frozen sweep + API regen before the market opens.
 * It never infers executions from a public quote feed. Does NOT run the full
 * grid search (--frozen-only keeps it fast, ~30-60s total).
 *
 * Cron (via Discord bot):
 *   every weekday at 07:00 articles morning refresh
 *
 * Steps:
 *   1. sweep.js --frozen-only — certified completed-close refresh
 *   2. gen-status-page.js — snapshot status dashboard
 *   3. gen-api.js — refresh public portfolio/v1/*.json
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

// Completed-close certification is critical; a missing Marketdata proof stops
// the refresh before any public generator can publish stale/fabricated marks.
run('node', ['tools/sweep.js', '--frozen-only'], 'Step 1/3 — Certified frozen sweep', { critical: true });
// Regenerators are independent presentation steps once the certified input exists.
run('node', ['tools/gen-status-page.js'], 'Step 2/3 — Status page snapshot');
run('node', ['tools/gen-api.js'], 'Step 3/3 — Public JSON API regen');

if (failedSteps.length) {
  log(`\n⚠️  Morning refresh completed with ${failedSteps.length} failed step(s): ${failedSteps.join(', ')}`);
  process.exit(2);
} else {
  log('\n✅ Morning recalibration complete. Public portfolio state refreshed.');
}
