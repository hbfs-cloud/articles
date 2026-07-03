#!/usr/bin/env node
/**
 * One-off, idempotent data recovery: stamp configVersion on the NVS pending
 * position injected by sweep.js's "Inject real open positions" block BEFORE
 * that block called getConfigVersion (fixed 2026-07 in the same commit).
 *
 * Scope, by design, is surgical:
 *   - ticker === 'NVS'
 *   - status === 'pending'
 *   - _injected === true
 *   - configVersion missing (falsy)
 *   - modes: balanced, secured ONLY
 *
 * NVS entryDate/scanDate = 2026-06-26. v9.4-20260616 (effectiveFrom 2026-06-17)
 * was the config version in effect that day — v10.0-20260629 only becomes
 * effective 2026-06-29. See report for a separate, NOT fixed here, bug in
 * getConfigVersion()/modes-config-history.json that would otherwise mis-tag
 * this window.
 *
 * NVS is an OPEN (pending) position, not a closed trade — the immutable-trades
 * rule protects closed trades and their stats. Stamping a missing field on an
 * open position is data recovery, not a rewrite of history.
 *
 * Idempotent: re-running with the fix already applied is a no-op.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TRADES_PATH = path.join(ROOT, 'data', 'backtest-trades.json');
const TARGET_VERSION = 'v9.4-20260616';
const MODES = ['balanced', 'secured'];

const trades = JSON.parse(fs.readFileSync(TRADES_PATH, 'utf8'));

let patched = 0;
for (const mode of MODES) {
  const list = trades[mode];
  if (!Array.isArray(list)) continue;
  for (const t of list) {
    if (
      t.ticker === 'NVS' &&
      t.status === 'pending' &&
      t._injected === true &&
      !t.configVersion
    ) {
      t.configVersion = TARGET_VERSION;
      patched++;
      console.log(`  ${mode}: NVS pending @ ${t.scanDate} → configVersion=${TARGET_VERSION}`);
    }
  }
}

if (patched === 0) {
  console.log('No matching trade found (already patched, or criteria no longer match). No-op.');
  process.exit(0);
}

fs.writeFileSync(TRADES_PATH, JSON.stringify(trades, null, 2) + '\n');
console.log(`Patched ${patched} trade(s). Written to ${TRADES_PATH}`);
