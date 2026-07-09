#!/usr/bin/env node
'use strict';
/**
 * dtx-scan.js — staging SCHEMA authority + mode discovery for the SCRIPTED dtx modes.
 *
 * ⚠️ CUT-OVER (2026-07-08): the hosted dtx MCP (systematic.dailytickers.com) is now the SOLE engine
 * ("le MCP fait foi"). The vendored local binaries + data bundle (tools/bin/dtx-*, tools/bin/dtx-data/)
 * have been REMOVED. This file NO LONGER spawns any binary and NO LONGER produces staging on its own.
 *
 * WHY a `node` subprocess can't produce staging anymore (the no-token architecture): the dtx MCP is
 * OAuth2 on claude.ai and the repo rule is ZERO token in .env / no hardcoded secrets. Only the AGENT
 * (Claude Code locally; `claude -p` in the cloud bot) holds `mcp__claude_ai_systematic__*`. So the
 * staging MUST be produced by the AGENT, BEFORE the shell pipeline reads data/dtx/*.json:
 *
 *   AGENT calls mcp__claude_ai_systematic__DtxDecide / DtxReplay (async → poll DtxJobStatus)
 *     → writes each raw tool result to a JSON file
 *       → `node tools/dtx-mcp-ingest.js --portfolio <id> --decide <f> [--replay <f>] --asof <J+1>`
 *         → writes data/dtx/<id>.json (engineMode:"mcp")
 *           → gen-status-page.js reads it (orders = decide CREATE, equity/metrics = replay).
 *
 * This file's remaining jobs:
 *   1. Own the staging SCHEMA (buildStaging / extractReplayMetrics / writeStaging / mapOrder) — the ONE
 *      source of truth, imported by tools/dtx-mcp-ingest.js so the MCP producer stays byte-compatible.
 *   2. Discover modes from config/dtx/portfolio_*.yaml + expose the go-live splice (goLiveFor).
 *   3. As a CLI: `--list` still works; an actual `--mode/--all` scan is a GRACEFUL no-op that points at
 *      the MCP-ingest path (exit 0 — never crashes the pipeline, never falls back to a deleted binary).
 *
 * This is a PARALLEL, STAGING-ONLY concern. It does NOT touch the live JS scanners, sweep.js,
 * signals.json, backtest-trades.json, trade-chain.json, or modes-config.json.
 *
 * Usage:
 *   node tools/dtx-scan.js --list
 *   node tools/dtx-scan.js --mode etf_eu --asof 2026-07-09   # → prints MCP-ingest guidance, exit 0
 *
 * Modes are auto-discovered from config/dtx/portfolio_*.yaml (mode id = portfolio id).
 */

const fs = require('fs');
const path = require('path');
const dtxBars = require('./lib/dtx-bars'); // still used for readConfig()

const REPO_ROOT = path.resolve(__dirname, '..');
const CONFIG_DIR = path.join(REPO_ROOT, 'config', 'dtx');
const STAGING_DIR = path.join(REPO_ROOT, 'data', 'dtx');

// Default replay window start. Configs cite "2021-present" honest track records.
const DEFAULT_FROM = '2021-01-01';

// ── Backtest→Live splice: replay ends at each mode's GO-LIVE date ──────────────
// The status-page hero shows one continuous curve: dtx BACKTEST (2021→go-live) then the
// mode's REAL live track (go-live→now, from the sweep). So the replay `--to` must be the
// mode's go-live date (modes-config.json statusSince) — NOT a fixed date — so the backtest
// ends exactly where live begins (no gap, no overlap). Maps the dtx portfolio id → the
// dashboard mode id that carries statusSince. Unwired portfolios (crypto/eu_dax/…) fall back
// to --asof (they are not launched, so there is no live segment to splice against).
const MODES_CFG = path.join(REPO_ROOT, 'data', 'modes-config.json');
const PORTFOLIO_TO_MODE = {
  us_highvol: 'highvol', forex: 'forex', etf_us: 'etf', etf_eu: 'etf_eu', stockbox_nasdaq: 'stockbox',
};
let _modesCfgCache;
function loadModesCfg() {
  if (_modesCfgCache !== undefined) return _modesCfgCache;
  try { _modesCfgCache = JSON.parse(fs.readFileSync(MODES_CFG, 'utf8')); }
  catch (_) { _modesCfgCache = null; }
  return _modesCfgCache;
}
/** Go-live (YYYY-MM-DD) for a dtx portfolio id, from the dashboard mode's statusSince. null if unwired. */
function goLiveFor(portfolioId) {
  const modeId = PORTFOLIO_TO_MODE[portfolioId];
  if (!modeId) return null;
  const cfg = loadModesCfg();
  const modes = (cfg && (cfg.modes || cfg)) || {};
  const since = modes[modeId] && modes[modeId].statusSince;
  return since ? String(since).slice(0, 10) : null;
}

// The 5 SCRIPTED modes wired to the dtx engine (the MCP produces their staging).
const SCRIPTED_MODES = Object.keys(PORTFOLIO_TO_MODE);

// ---------------------------------------------------------------------------
// arg parsing
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const o = { replay: true, quiet: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--mode') o.mode = argv[++i];
    else if (a === '--asof') o.asof = argv[++i];
    else if (a === '--from') o.from = argv[++i];
    else if (a === '--to') o.to = argv[++i];
    else if (a === '--all') o.all = true;
    else if (a === '--list') o.list = true;
    else if (a === '--no-replay') o.replay = false;
    else if (a === '--quiet') o.quiet = true;
    else if (a === '--out') o.out = argv[++i];
    // Legacy pipeline flags (--skip-if-no-tss / --skip-if-no-data) are accepted and IGNORED — the
    // binary/bundle they guarded is gone. Kept only so an old invocation doesn't error on the token.
    else if (a === '--skip-if-no-tss' || a === '--skip-if-no-data') o.skipIfNoTss = true;
  }
  return o;
}

/** Discover mode → config path from config/dtx/. */
function discoverModes() {
  const files = fs.readdirSync(CONFIG_DIR).filter((f) => /^portfolio_.*\.yaml$/.test(f));
  const modes = {};
  for (const f of files) {
    try {
      const p = dtxBars.readConfig(path.join(CONFIG_DIR, f));
      modes[p.id] = { id: p.id, name: p.name, currency: p.currency, initialCapital: p.initial_capital, file: f, path: path.join(CONFIG_DIR, f) };
    } catch (e) {
      modes[`__err_${f}`] = { id: f, error: e.message, path: path.join(CONFIG_DIR, f) };
    }
  }
  return modes;
}

// ---------------------------------------------------------------------------
// CREATE OrderRequest → our order/pool shape
// ---------------------------------------------------------------------------
function parseScore(reason) {
  const m = /Score=(-?\d+(?:\.\d+)?)/.exec(reason || '');
  return m ? Number(m[1]) : null;
}

function mapOrder(or) {
  // dtx serializes OrderRequest in snake_case: {order_id,symbol,side,order_type,qty,limit_price,
  // stop_price,stop_loss,take_profit,reason,priority} plus optional execution metadata:
  // exec_options {gap_up_pct,gap_down_pct,vwap_weak_skip,regime…,slicer,fill_window…} and
  // alternates [{symbol,limit_price,qty,stop_loss}] (the gap-gate substitution cascade).
  const entry = or.limit_price || or.stop_price || null;
  const alts = Array.isArray(or.alternates)
    ? or.alternates.map((a) => ({
        symbol: a.symbol,
        limitPrice: a.limit_price || null,
        qty: a.qty || null,
        stopLoss: a.stop_loss || null,
      }))
    : null;
  return {
    symbol: or.symbol,
    side: or.side,
    orderType: or.order_type,
    qty: or.qty,
    entry,
    limitPrice: or.limit_price || null,
    stopPrice: or.stop_price || null,
    stopLoss: or.stop_loss || null,
    takeProfit: or.take_profit || null,
    score: parseScore(or.reason),
    reason: or.reason || null,
    priority: or.priority != null ? or.priority : null,
    orderId: or.order_id || null,
    // Execution metadata so the status page / analyses can surface the gates a consumer must honor.
    execOptions: or.exec_options || null,
    alternates: alts,
  };
}

// ---------------------------------------------------------------------------
// SHARED schema helpers — the ONE source of truth for the staging JSON shape.
// The MCP ingest (tools/dtx-mcp-ingest.js) builds the staging via these, so the sole producer is
// byte-consistent with this schema by construction. gen-status-page reads orders + metrics + equity
// from this shape — see DTX_STAGING_MAP there.
// ---------------------------------------------------------------------------

/** Extract {metrics, equity} from a replay result envelope ({results:[{...}]}). from/to stamp the
 *  window (metrics.to = go-live splice). Returns {metrics:null, equity:null} if no result row. */
function extractReplayMetrics(rep, from, to) {
  const r = rep && rep.results && rep.results[0];
  if (!r) return { metrics: null, equity: null };
  return {
    metrics: {
      allocation: r.allocation, strategy: r.strategy,
      initial_capital: r.initial_capital,
      final_equity: r.final_equity, total_trades: r.total_trades,
      winners: r.winners, losers: r.losers, win_rate: r.win_rate,
      return_pct: r.return_pct, cagr_pct: r.cagr_pct, max_dd_pct: r.max_dd_pct,
      sharpe: r.sharpe, r2: r.r2, from, to,
    },
    equity: { dates: r.equity_dates || [], values: r.equity_values || [] },
  };
}

// ---------------------------------------------------------------------------
// DETERMINISTIC SANITY GUARD on replay metrics (anti-corrupt-publish).
// The MCP engine is trustworthy (verified 2026-07-10 diagnostic: queried live it reproduces the
// healthy rehearsal numbers). But the NIGHTLY ROUTINE can capture a corrupt/param-drifted replay
// result (2026-07-09 incident: us_highvol 1169tr/DD-63%, etf_eu 3404tr/DD-89.6% — a 2-8× trade
// blowup + DD explosion NOT reproducible on the server). extractReplayMetrics is a faithful
// pass-through, so a garbage input reaches the published status page unchecked. This guard runs at
// INGEST time: any metric outside sane bounds (or wildly off the committed per-mode baseline) marks
// the staging `metricsSuspect:true` + `_sanityWarning:[…]`, which (a) makes dtx-mcp-ingest exit 7 so
// the routine alerts+skips publishing that mode, and (b) makes qa-check.js fail loud. Bounds live in
// config/dtx/_sanity-baselines.json (universal tripwires + per-mode baselines from the healthy run).
let _sanityBaselinesCache;
function loadSanityBaselines() {
  if (_sanityBaselinesCache !== undefined) return _sanityBaselinesCache;
  try {
    _sanityBaselinesCache = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, '_sanity-baselines.json'), 'utf8'));
  } catch (_) { _sanityBaselinesCache = null; }
  return _sanityBaselinesCache;
}

/** Returns an array of warning strings for a replay metrics row that fails sanity bounds (empty = OK).
 *  Never throws. `portfolioId` selects the per-mode baseline; unknown modes get only universal checks. */
function assertReplaySanity(portfolioId, metrics) {
  const warns = [];
  if (!metrics) return warns;
  const base = loadSanityBaselines();
  const U = (base && base._universal) || {
    max_dd_abs_ceiling: 50, min_sharpe: 0, win_rate_min: 15, win_rate_max: 92, min_cagr: -5,
    trades_ratio_high: 2.2, trades_ratio_low: 0.4,
  };
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
  const dd = num(metrics.max_dd_pct);
  const sh = num(metrics.sharpe);
  const wr = num(metrics.win_rate);
  const cg = num(metrics.cagr_pct);
  const tr = num(metrics.total_trades);
  // Universal tripwires (asset-class-agnostic; systematic-tss configs with real risk mgmt never breach these).
  if (dd != null && Math.abs(dd) > U.max_dd_abs_ceiling) warns.push(`max_dd_pct=${dd} (|DD|>${U.max_dd_abs_ceiling}% ⇒ replay corrompu — cf. incident etf_eu 2026-07-09 DD-89.6%)`);
  if (sh != null && sh < U.min_sharpe) warns.push(`sharpe=${sh} (<${U.min_sharpe} ⇒ métriques cassées)`);
  if (wr != null && (wr < U.win_rate_min || wr > U.win_rate_max)) warns.push(`win_rate=${wr} (hors [${U.win_rate_min},${U.win_rate_max}])`);
  if (cg != null && cg < U.min_cagr) warns.push(`cagr_pct=${cg} (<${U.min_cagr}% sur fenêtre complète ⇒ suspect)`);
  // Per-mode baseline deviation (trade-count blowup is THE signature of the ingest corruption).
  const mb = base && base.modes && base.modes[portfolioId];
  if (mb && tr != null && num(mb.total_trades)) {
    const ratio = tr / mb.total_trades;
    if (ratio > U.trades_ratio_high) warns.push(`total_trades=${tr} = ${ratio.toFixed(1)}× baseline ${mb.total_trades} (>${U.trades_ratio_high}× ⇒ double-comptage/concaténation)`);
    else if (ratio < U.trades_ratio_low) warns.push(`total_trades=${tr} = ${ratio.toFixed(2)}× baseline ${mb.total_trades} (<${U.trades_ratio_low}× ⇒ replay tronqué)`);
  }
  return warns;
}

/** Build the staging object. `decision` = {actions:{CREATE,UPDATE,CANCEL}} (MCP DtxDecide, snake_case
 *  — mapOrder handles it). engineLabel/engineMode carry provenance (MCP path: "…— MCP" / "mcp"). */
function buildStaging({ modeInfo, cfg, asof, currency, decision, metrics, equity, replayErr, engineLabel, engineMode, t0 }) {
  const create = (decision && decision.actions && decision.actions.CREATE) || [];
  const sanityWarnings = assertReplaySanity(cfg.id, metrics);
  return {
    mode: modeInfo.id,
    portfolioId: cfg.id,
    name: cfg.name,
    asof,
    generatedAt: new Date().toISOString(),
    engine: engineLabel,
    engineMode,
    config: path.relative(REPO_ROOT, modeInfo.path),
    currency,
    orders: create.map(mapOrder),
    updates: (decision && decision.actions && decision.actions.UPDATE) || [],
    cancels: (decision && decision.actions && decision.actions.CANCEL) || [],
    metrics,
    equity,
    replayError: replayErr,
    metricsSuspect: sanityWarnings.length > 0,
    _sanityWarning: sanityWarnings.length > 0 ? sanityWarnings : null,
    stateless: true,
    tookMs: Date.now() - t0,
  };
}

/** Write the staging object (pretty JSON, mkdir -p). */
function writeStaging(out, outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// Staging freshness helper — used by the pipeline guard (publish-daily-card.sh Step 4d) and here.
// ---------------------------------------------------------------------------
/** Inspect a mode's committed staging. Returns {exists, engineMode, generatedAt, fresh} where
 *  fresh = engineMode:"mcp" AND generatedAt is today (UTC). Never throws. */
function stagingStatus(portfolioId, todayIso) {
  const today = todayIso || new Date().toISOString().slice(0, 10);
  const p = path.join(STAGING_DIR, `${portfolioId}.json`);
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    const gen = String(j.generatedAt || '').slice(0, 10);
    return { exists: true, engineMode: j.engineMode || null, generatedAt: gen, fresh: j.engineMode === 'mcp' && gen === today };
  } catch (_) {
    return { exists: false, engineMode: null, generatedAt: null, fresh: false };
  }
}

// ---------------------------------------------------------------------------
// Staging COMPLETENESS marker (anti-silent-skip) — written by publish-daily-card.sh Step 4d,
// READ by tools/qa-check.js. Since the local binary was removed (2026-07-08 cut-over) the dtx MCP
// is the SOLE engine and only the AGENT can call it; a `node` subprocess CANNOT regenerate staging.
// This function is the secondary FRESHNESS NET: it records, per scripted mode, whether the committed
// staging is a fresh (today, engineMode:"mcp") MCP snapshot AT SCAN TIME, and persists the verdict so
// the run is provably marked complete/INCOMPLETE — never a silent pass. It NEVER throws.
const COMPLETENESS_MARKER = path.join(STAGING_DIR, '_staging-completeness.json');
function writeStagingCompleteness(scanDateIso, todayIso) {
  const today = todayIso || new Date().toISOString().slice(0, 10);
  const modes = {};
  const generated = [];
  const skipped = [];
  for (const id of SCRIPTED_MODES) {
    let s;
    try { s = stagingStatus(id, today); } catch (_) { s = { exists: false, engineMode: null, generatedAt: null, fresh: false }; }
    let status;
    if (s.fresh) { status = 'fresh'; generated.push(id); }
    else if (s.exists) { status = 'stale'; skipped.push(id); }
    else { status = 'missing'; skipped.push(id); }
    modes[id] = { status, engineMode: s.engineMode, generatedAt: s.generatedAt, fresh: !!s.fresh };
    const icon = s.fresh ? '✅ fresh' : (s.exists ? '⚠️  STALE' : '❌ MISSING');
    console.log(`  [${id}] ${icon} (engineMode:${s.engineMode || '—'}, generatedAt:${s.generatedAt || '—'})`);
  }
  const complete = skipped.length === 0;
  const marker = {
    scanDate: scanDateIso || null,
    generatedAt: new Date().toISOString(),
    engine: 'dtx-mcp',
    modes,
    generated,   // modes with a fresh MCP staging this run
    skipped,     // modes NOT regenerated (stale/missing) → run is incomplete
    complete,
  };
  try { writeStaging(marker, COMPLETENESS_MARKER); } catch (_) { /* never crash the pipeline */ }
  return marker;
}

// ---------------------------------------------------------------------------
// main — CLI. Actual scanning is delegated to the AGENT + MCP ingest (binary removed).
// ---------------------------------------------------------------------------
function main() {
  const opts = parseArgs(process.argv);
  const modes = discoverModes();

  if (opts.list) {
    console.log('Discovered modes (config/dtx/) — staging produced by the AGENT via MCP + dtx-mcp-ingest:');
    for (const m of Object.values(modes)) {
      if (m.error) console.log(`  ${String(m.id).padEnd(22)} ERROR: ${m.error}`);
      else {
        const wired = SCRIPTED_MODES.includes(m.id) ? ' [scripted/wired]' : '';
        console.log(`  ${m.id.padEnd(22)} ${m.currency} ${m.initialCapital}  (${m.file})${wired}`);
      }
    }
    return;
  }

  // Any actual --mode/--all "scan": the binary is gone. Emit clear guidance and exit 0 (graceful,
  // non-blocking) — NEVER crash the pipeline and NEVER fall back to a deleted binary.
  const targets = opts.all ? SCRIPTED_MODES : (opts.mode ? [opts.mode] : []);
  console.warn('⚠️  dtx-scan: the local dtx binary + data bundle have been REMOVED (2026-07-08 cut-over).');
  console.warn('⚠️  dtx-scan: this tool no longer produces staging. The hosted dtx MCP is the SOLE engine.');
  console.warn('⚠️  dtx-scan: staging MUST be produced by the AGENT, BEFORE the shell pipeline, e.g.:');
  console.warn('⚠️      (agent) DtxReplay + DtxDecide → poll DtxJobStatus → write raw JSON, then:');
  console.warn('⚠️      node tools/dtx-mcp-ingest.js --portfolio <id> --decide <f> --replay <f> --asof <J+1>');
  if (targets.length) {
    console.warn(`⚠️  dtx-scan: requested mode(s) [${targets.join(', ')}] — the pipeline will READ the`);
    console.warn('⚠️      committed staging (data/dtx/<id>.json) as-is. Skipping (no regeneration). exit 0.');
  }
  // exit 0: graceful degrade. If the agent already refreshed staging via MCP, it is used; otherwise
  // the last committed staging is read by gen-status-page. Either way we never block the scan.
  process.exit(0);
}

if (require.main === module) main();

module.exports = {
  discoverModes, stagingStatus, writeStagingCompleteness, COMPLETENESS_MARKER, SCRIPTED_MODES,
  // Shared schema surface — reused by tools/dtx-mcp-ingest.js so the MCP path is byte-compatible.
  buildStaging, writeStaging, extractReplayMetrics, assertReplaySanity, mapOrder, goLiveFor,
  DEFAULT_FROM, STAGING_DIR, CONFIG_DIR, REPO_ROOT, PORTFOLIO_TO_MODE,
};
