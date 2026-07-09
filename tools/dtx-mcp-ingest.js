#!/usr/bin/env node
'use strict';
/**
 * dtx-mcp-ingest.js — ingest a hosted dtx MCP (systematic.dailytickers.com) DtxDecide + DtxReplay
 * payload into the staging JSON that gen-status-page reads (data/dtx/<portfolioId>.json).
 *
 * WHY this exists (the no-token architecture): a `node` SUBPROCESS cannot call the dtx MCP — the MCP
 * is OAuth2 on claude.ai and the repo rule is ZERO token in .env / no hardcoded secrets. Only the
 * AGENT (the 23h routine runs via `claude -p`, which HAS the registered MCP tools) can call
 * DtxDecide / DtxReplay. So the wiring is:
 *
 *   AGENT calls mcp__claude_ai_systematic__DtxDecide / DtxReplay
 *     → writes each raw tool result to a JSON file
 *       → `node tools/dtx-mcp-ingest.js --portfolio <id> --decide <file> [--replay <file>]`
 *         → writes data/dtx/<id>.json in the EXACT schema the NATIVE path (dtx-scan.js) produces
 *           → gen-status-page.js reads it (orders = decide CREATE, equity/metrics = replay).
 *
 * The staging schema is built via dtx-scan.js's shared helpers (buildStaging / extractReplayMetrics /
 * writeStaging) so this file is byte-compatible with the binary producer by construction — only the
 * provenance fields differ: engine = "dtx (systematic-tss) — MCP", engineMode = "mcp".
 *
 * The local binary path (`node tools/dtx-scan.js`) stays the OFFLINE / no-agent FALLBACK.
 *
 * DtxDecide JSON shape : { state, actions:{ CREATE:[{symbol,side,order_type,qty,limit_price,
 *                         stop_price,stop_loss,take_profit,reason,priority,order_id,
 *                         exec_options?{gap_*,vwap_weak_skip,regime…,slicer,fill_window…},
 *                         alternates?[{symbol,limit_price,qty,stop_loss}]}], UPDATE, CANCEL } }
 * DtxReplay JSON shape : { portfolio_id, results:[{cagr_pct,max_dd_pct,sharpe,r2,win_rate,
 *                         total_trades,final_equity,equity_dates[],equity_values[], ...}] }
 * Order fields are snake_case; dtx-scan.mapOrder maps them → the staging camelCase order fields.
 *
 * Usage:
 *   node tools/dtx-mcp-ingest.js --portfolio etf_eu --decide decide.json --replay replay.json \
 *        --asof 2026-07-09 [--from 2021-01-01] [--to 2026-07-06] [--out path] [--quiet]
 *
 *   --portfolio <id>   dtx portfolio id (see DtxListConfigs): us_highvol|forex|etf_us|etf_eu|stockbox_nasdaq|…
 *   --decide <file>    REQUIRED — path to the DtxDecide JSON result (or "-" to read stdin)
 *   --replay <file>    OPTIONAL — path to the DtxReplay JSON result (omit → metrics/equity = null)
 *   --asof YYYY-MM-DD  REQUIRED — the session the decide was run for
 *   --from / --to      OPTIONAL — replay window stamp (default from=2021-01-01, to=go-live splice||asof)
 *   --out <file>       OPTIONAL — override output path (default data/dtx/<id>.json)
 */

const fs = require('fs');
const path = require('path');
const scan = require('./dtx-scan');
const dtxBars = require('./lib/dtx-bars');

function parseArgs(argv) {
  const o = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--portfolio' || a === '--mode') o.portfolio = argv[++i];
    else if (a === '--decide') o.decide = argv[++i];
    else if (a === '--replay') o.replay = argv[++i];
    else if (a === '--asof') o.asof = argv[++i];
    else if (a === '--from') o.from = argv[++i];
    else if (a === '--to') o.to = argv[++i];
    else if (a === '--out') o.out = argv[++i];
    else if (a === '--quiet') o.quiet = true;
  }
  return o;
}

function readJson(p, label) {
  let raw;
  if (p === '-') raw = fs.readFileSync(0, 'utf8');
  else {
    if (!fs.existsSync(p)) throw new Error(`${label}: file not found: ${p}`);
    raw = fs.readFileSync(p, 'utf8');
  }
  let j;
  try { j = JSON.parse(raw); }
  catch (e) { throw new Error(`${label}: invalid JSON in ${p}: ${e.message}`); }
  return j;
}

/** Resolve the config for a portfolio id from config/dtx/. Reuses dtx-scan's discovery so name /
 *  currency / config path match the native producer exactly. */
function resolveMode(portfolioId) {
  const modes = scan.discoverModes();
  const m = modes[portfolioId];
  if (!m || m.error) {
    const known = Object.keys(modes).filter((k) => !k.startsWith('__err_')).join(', ');
    throw new Error(`unknown portfolio "${portfolioId}". Known: ${known}`);
  }
  const cfg = dtxBars.readConfig(m.path);
  return { modeInfo: m, cfg };
}

function main() {
  const opts = parseArgs(process.argv);
  const t0 = Date.now();
  if (!opts.portfolio) { console.error('ERROR: --portfolio <id> required'); process.exit(2); }
  if (!opts.decide) { console.error('ERROR: --decide <file> required (DtxDecide JSON)'); process.exit(2); }
  if (!opts.asof) { console.error('ERROR: --asof YYYY-MM-DD required'); process.exit(2); }

  const { modeInfo, cfg } = resolveMode(opts.portfolio);
  const currency = cfg.currency || 'USD';

  // 1) decide payload → orders. Tolerate either the bare {actions:…} or a wrapper {result:{actions}}.
  let decide = readJson(opts.decide, 'decide');
  if (decide && !decide.actions && decide.result && decide.result.actions) decide = decide.result;
  if (!decide || !decide.actions) {
    console.error(`ERROR: decide JSON has no .actions (got keys: ${decide ? Object.keys(decide).join(',') : 'null'})`);
    process.exit(3);
  }

  // 2) optional replay payload → metrics + equity (same window stamp logic as the native path).
  let metrics = null, equity = null, replayErr = null;
  if (opts.replay) {
    try {
      let rep = readJson(opts.replay, 'replay');
      if (rep && !rep.results && rep.result && rep.result.results) rep = rep.result;
      if (!rep || !Array.isArray(rep.results)) throw new Error('replay JSON has no results[]');
      const from = opts.from || scan.DEFAULT_FROM;
      const to = opts.to || scan.goLiveFor(cfg.id) || opts.asof;
      ({ metrics, equity } = scan.extractReplayMetrics(rep, from, to));
      if (!metrics) throw new Error('replay results[0] empty');
    } catch (e) {
      replayErr = e.message;
    }
  }

  const out = scan.buildStaging({
    modeInfo, cfg, asof: opts.asof, currency,
    decision: decide, metrics, equity, replayErr,
    engineLabel: 'dtx (systematic-tss) — MCP', engineMode: 'mcp', t0,
  });

  const outPath = opts.out || path.join(scan.STAGING_DIR, `${modeInfo.id}.json`);
  scan.writeStaging(out, outPath);

  if (!opts.quiet) {
    console.log(`  [${modeInfo.id}] MCP ${currency} | orders(CREATE)=${out.orders.length}`);
    if (metrics) console.log(`    replay ${metrics.from}→${metrics.to}: cagr=${metrics.cagr_pct} dd=${metrics.max_dd_pct} sharpe=${metrics.sharpe} trades=${metrics.total_trades} wr=${metrics.win_rate}`);
    else if (replayErr) console.log(`    replay SKIPPED/ERROR: ${replayErr}`);
    console.log(`    → ${path.relative(scan.REPO_ROOT, outPath)} (${out.tookMs}ms)`);
  }

  // DETERMINISTIC SANITY GATE — a corrupt/param-drifted replay (2026-07-09 incident: DD-89.6%,
  // 2-8× trade blowup) is caught HERE, at ingest, before the number can reach the status page.
  // The staging is still written (metricsSuspect:true + _sanityWarning[…]) so the corruption is
  // auditable and qa-check.js fails loud on it — but we exit NON-ZERO so the calling routine sees
  // the failure, ALERTS Telegram (alias 'alerts'), and does NOT publish this mode's metrics.
  if (out.metricsSuspect) {
    console.error(`⛔ [${modeInfo.id}] REPLAY SUSPECT — métriques hors bornes de sanité (staging marqué metricsSuspect:true, NON publiable) :`);
    for (const w of out._sanityWarning) console.error(`     • ${w}`);
    console.error(`   → Le MCP dtx est sain (vérifié). Un replay aberrant = param drift / job result corrompu au run.`);
    console.error(`     Re-appeler DtxReplay(${cfg.id}, from=2021-01-01, to=<J-1 ou 2026-07-06>), re-vérifier trades vs baseline, PUIS ré-ingérer.`);
    console.error(`     ALERTER Telegram 'alerts' + NE PAS publier les métriques de ce mode.`);
    process.exitCode = 7;
  }
  return out;
}

if (require.main === module) main();

module.exports = { main };
