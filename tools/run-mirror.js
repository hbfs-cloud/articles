#!/usr/bin/env node
/**
 * run-mirror.js — trigger the broker-simulator's faithful-mirror engine for a given day
 * on every pilot mode's account, so the sim catches up to the day before we reconcile.
 *
 * The sim does NOT self-schedule: each evening (after the session has closed and its
 * intraday bars exist) this drives `POST /api/accounts/{id}/mirror-run?day=...`, which
 * enters that day's pending mirror-orders at the next-open + VWAP gate and replays the
 * day's intraday bars for first-touch SL/TP / horizon-close exits. Run it BEFORE
 * reconcile-simulator.js, for the SAME day the latest pit-state.json represents.
 *
 * Usage:  node tools/run-mirror.js [--day YYYY-MM-DD] [--interval 5m]
 *         (default day = today; the actual calendar date of the nightly run.)
 *
 * Non-blocking by contract: a sim outage NEVER fails the nightly (exit 0 always).
 */
'use strict';
const { SimulatorClient, loadConfig } = require('./lib/simulator-client');

function parseArgs(argv) {
  const out = { day: null, interval: '5m' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--day') out.day = argv[++i];
    else if (argv[i] === '--interval') out.interval = argv[++i];
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const day = args.day || new Date().toISOString().slice(0, 10);
  const cfg = loadConfig();
  const client = new SimulatorClient(); // throws if token missing → caught below

  console.log(`[run-mirror] day=${day} interval=${args.interval} modes=${cfg.pilotModes.join(',')}`);
  for (const mode of cfg.pilotModes) {
    try {
      const accountId = await client.resolveAccountId(mode);
      if (!accountId) { console.log(`  ${mode}: no mirror account, skip`); continue; }
      const r = await client.mirrorRun(accountId, day, args.interval);
      console.log(`  ${mode}: entered=${r.entered} exited=${r.exited} fills=${r.fills} open=${r.open}`);
    } catch (e) {
      console.error(`  ${mode}: mirror-run failed: ${e.message}`);
    }
  }
}

main().catch((e) => {
  // Never break the nightly on a sim/config/token problem.
  console.error(`[run-mirror] disabled: ${e.message}`);
  process.exit(0);
});
