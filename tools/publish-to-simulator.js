#!/usr/bin/env node
'use strict';

/**
 * publish-to-simulator.js — Stage 5 nightly intent publisher (articles -> broker-simulator).
 *
 * Runs AFTER sweep.js has written data/pit-state.json. For each pilot mode it finds the NEW
 * open positions (entryDate == pit-state.asOf, i.e. entered on the day just swept) and POSTs a
 * /mirror-order INTENT to the "mirror:<mode>" sim account. The SIM (not articles) executes the
 * intent the next morning via mirror-run.
 *
 *   client_order_id = <mode>|<ticker>|<entryDate>   (idempotent; same key as the backfill)
 *
 * NON-BLOCKING by contract: every failure is caught and logged; this tool never throws up the
 * pipeline chain (publish-daily-card.sh wires it with `|| echo`). It always exits 0.
 *
 * Usage:
 *   node tools/publish-to-simulator.js                 # publish new intents, all pilot modes
 *   node tools/publish-to-simulator.js --mode dynamic  # one mode only
 *   node tools/publish-to-simulator.js --dry-run       # print intents, no POST
 *   node tools/publish-to-simulator.js --day 2026-03-20  # override the "new entries" day
 *
 * Env: BROKERSIM_SERVICE_TOKEN (service token; never hardcoded).
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function parseArgs(argv) {
  const out = { dryRun: false, mode: null, day: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') out.dryRun = true;
    else if (argv[i] === '--mode') out.mode = argv[++i];
    else if (argv[i] === '--day') out.day = argv[++i];
  }
  return out;
}

function loadJSON(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function clientId(mode, ticker, entryDate) {
  return `${mode}|${ticker}|${entryDate}`;
}

function buildIntent(mode, p, modeCfg, day) {
  return {
    symbol:          p.ticker,
    side:            'BUY',
    mode,
    signal_date:     p.scanDate || p.entryDate || day,
    stop:            p.actualStop,
    tp1:             p.actualTp1 != null ? p.actualTp1 : null,
    tp2:             p.actualTp2 != null ? p.actualTp2 : null,
    horizon:         modeCfg.horizon || 2,
    vwap_gate:       !!modeCfg.vwapGate,
    partial_tp:      !!modeCfg.partialTP,
    partial_tp_pct:  modeCfg.partialTPPct || 0,
    weight:          p.weight,
    client_order_id: clientId(mode, p.ticker, p.entryDate || day),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Everything below is best-effort: a missing config / token / network must NOT break the
  // nightly pipeline. Load lazily and bail quietly on any setup failure.
  let SimulatorClient, loadConfig;
  try {
    ({ SimulatorClient, loadConfig } = require('./lib/simulator-client'));
  } catch (e) {
    console.warn(`publish-to-simulator: client unavailable (${e.message}) — skip`);
    return;
  }

  let cfg, pit, modesCfg;
  try {
    cfg      = loadConfig();
    pit      = loadJSON('data/pit-state.json');
    modesCfg = loadJSON('data/modes-config.json').modes || {};
  } catch (e) {
    console.warn(`publish-to-simulator: cannot read inputs (${e.message}) — skip`);
    return;
  }

  const pilotModes = cfg.pilotModes || ['turbo', 'dynamic', 'balanced', 'bull', 'secured'];
  const day   = args.day || pit.asOf;
  const modes = pit.modes || {};
  const targetModes = (args.mode ? [args.mode] : pilotModes).filter(m => pilotModes.includes(m));

  let client = null;
  if (!args.dryRun) {
    try { client = new SimulatorClient(); }
    catch (e) { console.warn(`publish-to-simulator: ${e.message} — skip`); return; }
  }

  let published = 0, failed = 0;
  for (const mode of targetModes) {
    const modeData = modes[mode];
    if (!modeData) continue;

    // NEW entries = positions opened on the swept day (entryDate == asOf/day override).
    const fresh = (modeData.positions || []).filter(
      p => p.ticker && p.weight > 0 && (p.entryDate === day),
    );
    if (fresh.length === 0) continue;

    let accountId = null;
    if (!args.dryRun) {
      try { accountId = await client.resolveAccountId(mode); }
      catch (e) { console.warn(`  ${mode}: ${e.message} — skip mode`); failed += fresh.length; continue; }
    }

    for (const p of fresh) {
      const intent = buildIntent(mode, p, modesCfg[mode] || {}, day);
      if (args.dryRun) {
        console.log(`[DRY] ${mode} ${p.ticker} ${intent.client_order_id}`);
        console.log(JSON.stringify(intent, null, 2));
        continue;
      }
      try {
        await client.mirrorOrder(accountId, intent);
        published++;
        console.log(`  ${mode} ${p.ticker}: published intent (${intent.client_order_id})`);
      } catch (e) {
        failed++;
        console.warn(`  ${mode} ${p.ticker}: FAILED ${e.message}`);
      }
    }
  }

  console.log(`publish-to-simulator: day=${day} published=${published} failed=${failed}`);
}

// Top-level guard: this tool must never throw up the pipeline chain.
main().catch(e => { console.warn(`publish-to-simulator: unexpected ${e.message} — non-blocking`); });
