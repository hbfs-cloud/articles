#!/usr/bin/env node
/**
 * set-mode-status.js — CLI to transition a mode's status.
 *
 * Usage:
 *   node tools/set-mode-status.js --mode <modeId> --to <state> --reason "..." [--by manual] [--review YYYY-MM-DD]
 *
 * Example:
 *   node tools/set-mode-status.js --mode secured --to live-to-pause \
 *     --reason "OOS PF=0.53 sur n=11 — monitor 30j" --review 2026-06-22
 */

const fs = require('fs');
const path = require('path');
const {
  VALID_STATES,
  canTransition,
  isValidState,
  DEFAULT_STATE,
} = require('./lib/mode-status');

const ROOT = path.join(__dirname, '..');
const CFG = path.join(ROOT, 'data/modes-config.json');
const HISTORY = path.join(ROOT, 'data/modes-status-history.json');

function parseArgs(argv) {
  const a = { by: 'manual' };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === '--mode')   { a.mode = v; i++; }
    else if (k === '--to') { a.to = v; i++; }
    else if (k === '--reason') { a.reason = v; i++; }
    else if (k === '--by') { a.by = v; i++; }
    else if (k === '--review') { a.review = v; i++; }
    else if (k === '--force') { a.force = true; }
    else if (k === '--help' || k === '-h') { a.help = true; }
  }
  return a;
}

function help() {
  console.log(`set-mode-status.js — transition a mode's status

Usage:
  node tools/set-mode-status.js --mode <modeId> --to <state> [options]

States: ${VALID_STATES.join(', ')}

Options:
  --mode    <id>        Mode id (turbo, dynamic, balanced, secured, fortress, tkl)
  --to      <state>     Target state
  --reason  "..."       Reason for transition (recorded in history)
  --by      <name>      Author (default: manual)
  --review  YYYY-MM-DD  Optional next-review date
  --force               Skip transition-validity check (use with care)
  -h, --help            Show this message
`);
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    if (fallback !== undefined) return fallback;
    throw e;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.mode || !args.to) { help(); process.exit(args.help ? 0 : 1); }

  if (!isValidState(args.to)) {
    console.error(`[set-mode-status] invalid target state '${args.to}'. Valid: ${VALID_STATES.join(', ')}`);
    process.exit(1);
  }

  const cfg = readJson(CFG);
  if (!cfg.modes || !cfg.modes[args.mode]) {
    console.error(`[set-mode-status] mode '${args.mode}' not found in ${CFG}`);
    process.exit(1);
  }

  const mode = cfg.modes[args.mode];
  const from = mode.status || DEFAULT_STATE;

  if (from === args.to) {
    console.log(`[set-mode-status] ${args.mode} already in state '${from}'. No-op.`);
    process.exit(0);
  }

  if (!args.force && !canTransition(from, args.to)) {
    console.error(`[set-mode-status] invalid transition '${from}' → '${args.to}' for ${args.mode}. Use --force to override.`);
    process.exit(1);
  }

  const at = new Date().toISOString();
  mode.status = args.to;
  mode.statusSince = at;
  if (args.reason) mode.statusReason = args.reason;
  else delete mode.statusReason;
  if (args.review) mode.statusNextReviewAt = args.review;
  else delete mode.statusNextReviewAt;

  writeJson(CFG, cfg);

  const history = readJson(HISTORY, { transitions: [] });
  history.transitions.push({
    mode: args.mode,
    from,
    to: args.to,
    at,
    reason: args.reason || null,
    by: args.by,
    nextReviewAt: args.review || null,
  });
  writeJson(HISTORY, history);

  console.log(`[set-mode-status] ${args.mode}: ${from} → ${args.to} (by ${args.by})`);
  if (args.reason) console.log(`  reason: ${args.reason}`);
  if (args.review) console.log(`  review: ${args.review}`);
}

if (require.main === module) main();

module.exports = { parseArgs };
