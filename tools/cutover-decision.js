#!/usr/bin/env node
'use strict';

/**
 * cutover-decision.js — Stage 5 self-reverting source-of-truth selector (articles ⇄ sim).
 *
 * Reads data/reconciliation-log.json (appended by reconcile-simulator.js each night) and, per
 * pilot mode, computes the count of CONSECUTIVE most-recent zero-divergence reconciliations.
 * It then writes data/source-of-truth.json:
 *
 *   { "<mode>": "sim" | "articles", "_meta": { ... } }
 *
 * A mode is promoted to "sim" iff:
 *   • its consecutive-zero-divergence streak >= CUTOVER_DAYS (default from simulator-config.json
 *     cutoverDays, fallback 20; overridable via env CUTOVER_DAYS), AND
 *   • the LATEST reconcile for that mode is itself zero-divergence.
 *
 * Self-reverting: a mode currently "sim" that shows a FRESH divergence (latest reconcile not
 * zero-divergence) flips straight back to "articles" and fires a Discord alert
 * "AUTO-REVERTED <mode>". A mode that flips to "sim" for the first time fires "AUTO-CUTOVER
 * <mode>". The read-switch (gen-api / gen-status-page) treats anything other than "sim" — and
 * any read error — as "articles", so reverting is always the safe default.
 *
 * NON-BLOCKING by contract: missing log / config / network never aborts the nightly (exit 0).
 *
 * Usage:
 *   node tools/cutover-decision.js              # decide + write source-of-truth.json + alert
 *   node tools/cutover-decision.js --dry-run    # decide + print, no write, no alert
 *
 * Env: CUTOVER_DAYS (override the streak threshold).
 */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT     = path.join(__dirname, '..');
const LOG_FILE = path.join(ROOT, 'data', 'reconciliation-log.json');
const SOT_FILE = path.join(ROOT, 'data', 'source-of-truth.json');
const DISCORD_CHANNEL = '1483382014588747778'; // same alert channel as reconcile-simulator.js

function parseArgs(argv) {
  const out = { dryRun: false };
  for (const a of argv) if (a === '--dry-run') out.dryRun = true;
  return out;
}

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

// A mode's per-entry reconcile result is "zero-divergence" iff it exists, ok===true, carries no
// breaches and no error. Anything else (breach, reconcile error, or absent from the entry) breaks
// the streak — absence is treated as non-zero so a mode that stops reconciling can't drift to sim.
function isClean(modeResult) {
  return !!modeResult
    && modeResult.ok === true
    && !modeResult.error
    && (!Array.isArray(modeResult.breaches) || modeResult.breaches.length === 0);
}

// Walk the log newest→oldest; count consecutive entries where the mode is clean, stopping at the
// first entry where the mode is present-but-dirty OR absent. Returns { streak, latestClean,
// latestPresent }. latestPresent=false means the mode never appeared (no reconcile yet).
function streakFor(mode, logNewestFirst) {
  let streak = 0, latestClean = false, latestPresent = false, seenFirst = false;
  for (const entry of logNewestFirst) {
    const r = (entry.modes || []).find(m => m && m.mode === mode);
    const present = !!r;
    if (!seenFirst) {
      latestPresent = present;
      latestClean = present && isClean(r);
      seenFirst = true;
    }
    if (present && isClean(r)) { streak++; }
    else { break; } // absent or dirty → streak ends here
  }
  return { streak, latestClean, latestPresent };
}

function sendAlert(text) {
  try {
    const safe = text.replace(/'/g, "'\\''");
    execSync(`openclaw message send --channel discord --target "${DISCORD_CHANNEL}" --message '${safe}'`, {
      stdio: 'pipe', timeout: 15000,
    });
    console.log('alert sent to Discord');
  } catch (e) {
    console.warn(`alert send failed (non-blocking): ${e.message}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  // Config (pilot modes + default cutoverDays). loadConfig may throw if config is absent; the
  // top-level guard turns that into a clean exit 0.
  let cfg = {};
  try { const { loadConfig } = require('./lib/simulator-client'); cfg = loadConfig(); } catch { cfg = {}; }
  const pilotModes = cfg.pilotModes || ['turbo', 'dynamic', 'balanced', 'bull', 'secured'];
  const cutoverDays = (() => {
    const env = parseInt(process.env.CUTOVER_DAYS || '', 10);
    if (Number.isFinite(env) && env > 0) return env;
    if (Number.isFinite(cfg.cutoverDays) && cfg.cutoverDays > 0) return cfg.cutoverDays;
    return 20;
  })();

  const log = readJSON(LOG_FILE, []);
  if (!Array.isArray(log) || log.length === 0) {
    console.log('cutover-decision: no reconciliation-log.json yet — all modes stay on articles');
  }
  const logNewestFirst = Array.isArray(log) ? [...log].reverse() : [];

  const prev = readJSON(SOT_FILE, {}) || {};
  const next = { _meta: {
    updatedAt: new Date().toISOString(),
    cutoverDays,
    reconcileEntries: logNewestFirst.length,
    note: 'Per pilot mode: "sim" once it has cutoverDays consecutive zero-divergence reconciliations AND its latest reconcile is clean; auto-reverts to "articles" on any fresh divergence. Read-switch (gen-api/gen-status-page) falls back to articles on anything but "sim".',
    modes: {},
  } };

  const flips = []; // {mode, to, reason}
  for (const mode of pilotModes) {
    const prevSrc = prev[mode] === 'sim' ? 'sim' : 'articles';
    const { streak, latestClean, latestPresent } = streakFor(mode, logNewestFirst);

    let src;
    if (prevSrc === 'sim' && !latestClean) {
      // Self-revert: a mode on sim that is no longer clean (fresh divergence, error, or stopped
      // reconciling) drops straight back to articles. This is the safety net.
      src = 'articles';
    } else {
      src = (streak >= cutoverDays && latestClean) ? 'sim' : 'articles';
    }

    next[mode] = src;
    next._meta.modes[mode] = { source: src, streak, threshold: cutoverDays, latestClean, latestPresent };

    if (src !== prevSrc) {
      if (src === 'sim') flips.push({ mode, to: 'sim', reason: `streak=${streak}>=${cutoverDays}` });
      else flips.push({ mode, to: 'articles', reason: latestPresent ? 'fresh divergence' : 'no reconcile data' });
    }

    const tag = src === 'sim' ? 'SIM' : 'articles';
    console.log(`  ${mode}: ${tag} (streak=${streak}/${cutoverDays}, latestClean=${latestClean}, prev=${prevSrc})`);
  }

  if (args.dryRun) {
    console.log('[DRY] source-of-truth.json:');
    console.log(JSON.stringify(next, null, 2));
    console.log(`[DRY] flips: ${flips.map(f => `${f.mode}->${f.to}`).join(', ') || 'none'}`);
    return;
  }

  fs.writeFileSync(SOT_FILE, JSON.stringify(next, null, 2) + '\n');
  console.log(`wrote ${path.relative(ROOT, SOT_FILE)}`);

  for (const f of flips) {
    if (f.to === 'sim') {
      sendAlert(`✅ AUTO-CUTOVER ${f.mode} — broker-sim is now the source of truth (${f.reason}). Public positions + equity for "${f.mode}" now render from the sim, with hard fallback to articles on any error.`);
    } else {
      sendAlert(`🔁 AUTO-REVERTED ${f.mode} — back to articles as source of truth (${f.reason}). Sim diverged; the public page keeps showing articles' shadow state.`);
    }
  }
}

// Top-level guard: this decision step must never throw up the nightly chain.
try { main(); }
catch (e) { console.error(`cutover-decision: ${e.message} — non-blocking`); process.exit(0); }
