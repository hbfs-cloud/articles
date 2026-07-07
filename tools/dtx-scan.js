#!/usr/bin/env node
'use strict';
/**
 * dtx-scan.js — orchestrator: drive the REAL systematic-tss engine (dtx binary) per book config,
 * in NATIVE mode.
 *
 * NATIVE mode (Phase 2): we OMIT --bars. dtx resolves the universe from the YAML filters
 * (region / min_market_cap / min_volume / stocks/etfs / whitelist / forex_universe / blacklist via
 * staticdata) AND fetches OHLCV itself (Yahoo/Binance/BVC), exactly like cmd/backtest. The books
 * self-manage universe + cache — we do NOT build universe lists or backfill bars anymore.
 *
 * CWD: native mode runs dtx with CWD = a "TSS data root" that provides data/instruments/<broker>.json
 * (the only thing read from disk; staticdata is compiled into the binary). This context is now VENDORED
 * in-repo at vendor/dtx-tss/ (git-lfs) — no sibling systematic-tss checkout required. Only network
 * (Yahoo/Binance/BVC OHLCV) remains external. Set DTX_TSS_ROOT to override the resolved root.
 *
 * This is a PARALLEL, STAGING-ONLY pipeline. It does NOT touch the live JS scanners, sweep.js,
 * signals.json, backtest-trades.json, trade-chain.json, or modes-config.json. It writes to a
 * staging dir (data/dtx/<mode>.json) and persists per-mode engine state (data/dtx/state/<mode>.json).
 *
 * Per book config it:
 *   1. `dtx decide --asof <session>` (native) → maps actions.CREATE (BUY) into our order/pool shape
 *   2. `dtx replay --from --to` (native) → equity curve + aggregate metrics
 *
 * Usage:
 *   node tools/dtx-scan.js --mode highvol --asof 2026-06-30 [--from 2021-01-01] [--no-replay] [--quiet]
 *   node tools/dtx-scan.js --all --asof 2026-06-30
 *   node tools/dtx-scan.js --list
 *
 * Modes are auto-discovered from config/dtx/portfolio_*.yaml (mode id = portfolio id).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const engine = require('./lib/dtx-engine');
const dtxBars = require('./lib/dtx-bars'); // still used for readConfig()

const REPO_ROOT = path.resolve(__dirname, '..');
const CONFIG_DIR = path.join(REPO_ROOT, 'config', 'dtx');
const STAGING_DIR = path.join(REPO_ROOT, 'data', 'dtx');

// DATA BUNDLE — self-contained, autoportant (no sibling systematic-tss checkout needed) ────────────
// NATIVE mode resolves the universe from the YAML filters + fetches OHLCV itself. It needs a small
// referential on disk: the stockanalysis frozen ticker lists (universe) + broker instrument lists.
// This is now VENDORED in-repo as a compacted 9.9M BUNDLE at tools/bin/dtx-data/ (git-lfs) — the same
// bundle proven in the `trading` desk: fields stripped/minified/market-cap-pruned (behavior-preserving,
// parity-verified). The `dtx` binary (Jul-2026 build, commit 43d53455) auto-discovers a `dtx-data/`
// folder NEXT TO the binary, or takes `--data-dir DIR` / `$DTX_DATA_DIR`. Strategy logic + staticdata
// are compiled INTO the binary; configs are passed by absolute path. Only network (Yahoo/Binance OHLCV)
// remains external.
//
// Resolution order:
//   1. process.env.DTX_DATA_DIR   — explicit override
//   2. <repo>/tools/bin/dtx-data  — VENDORED bundle (default, autoportant)
//   3. legacy DTX_TSS_ROOT / ../systematic-tss  — last-resort fallback (dev who still has the sibling)
// The last fallback is a CWD (old binary behaviour: reads data/instruments + cache RELATIVE to cwd);
// the bundle path is passed via --data-dir so cwd is irrelevant with the new binary.
const BUNDLE_DIR = path.resolve(__dirname, 'bin', 'dtx-data');
const SIBLING_TSS_ROOT = process.env.DTX_TSS_ROOT || path.resolve(REPO_ROOT, '..', 'systematic-tss');

// Where the engine writes its OHLCV cache. The new binary honours $DTX_WRITABLE_CACHE_DIR (else it
// MkdirTemps) so the bundle/repo stays read-only — essential on a cloud checkout. A stable dir keeps
// the cache warm across runs (faster + deterministic replay).
const WRITABLE_CACHE_DIR = process.env.DTX_WRITABLE_CACHE_DIR ||
  path.join(os.tmpdir(), 'dtx-ohlcv-cache');

/** Resolve the data context. Returns { dataDir, cwd } — dataDir passed via --data-dir (preferred),
 *  cwd only used for the legacy sibling fallback. null if nothing resolves. */
function resolveDataCtx() {
  if (process.env.DTX_DATA_DIR && fs.existsSync(process.env.DTX_DATA_DIR)) {
    return { dataDir: process.env.DTX_DATA_DIR, cwd: undefined, kind: 'env' };
  }
  if (fs.existsSync(path.join(BUNDLE_DIR, 'data', 'instruments'))) {
    return { dataDir: BUNDLE_DIR, cwd: undefined, kind: 'bundle' };
  }
  if (fs.existsSync(path.join(SIBLING_TSS_ROOT, 'data', 'instruments'))) {
    // Legacy fallback: old binary reads relative to cwd; pass no --data-dir, chdir into sibling.
    return { dataDir: undefined, cwd: SIBLING_TSS_ROOT, kind: 'sibling' };
  }
  return null;
}
const DATA_CTX = resolveDataCtx();

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
    // FAIL-SAFE (pipeline/cloud): if NO data context resolves at all, skip cleanly (exit 0) instead of
    // erroring. With the vendored bundle committed this should never trigger on a normal checkout — it
    // only fires if git-lfs did not pull tools/bin/dtx-data/. Then the 23h routine keeps going on the
    // COMMITTED staging (data/dtx/*.json). A direct manual run WITHOUT this flag still hard-errors.
    // (--skip-if-no-tss kept as the flag name for backward-compat with existing pipeline invocations.)
    else if (a === '--skip-if-no-tss' || a === '--skip-if-no-data') o.skipIfNoTss = true;
  }
  return o;
}

/** Fail-closed: verify a native data context (vendored bundle / env / sibling) resolves. */
function assertDataCtx() {
  if (!DATA_CTX) {
    throw new Error(
      `dtx-scan: NATIVE mode needs a data context. Expected the vendored bundle at ` +
      `"${BUNDLE_DIR}" (data/instruments + cache/stockanalysis). Not found — git-lfs may not have ` +
      `pulled tools/bin/dtx-data/ (run \`git lfs pull\`), or set DTX_DATA_DIR. FAIL-CLOSED (won't fabricate).`
    );
  }
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
  // stop_price,stop_loss,take_profit,reason,priority}.
  const entry = or.limit_price || or.stop_price || null;
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
  };
}

// ---------------------------------------------------------------------------
// scan one mode (NATIVE)
// ---------------------------------------------------------------------------
function scanMode(modeInfo, opts) {
  const asof = opts.asof;
  const log = (...m) => { if (!opts.quiet) console.log(...m); };
  const t0 = Date.now();

  const cfg = dtxBars.readConfig(modeInfo.path);
  const currency = cfg.currency || 'USD';
  const balances = { [currency]: cfg.initial_capital || 100000 };

  // 1) decide → orders for the session (NATIVE: no bars; universe/instruments from the vendored bundle
  // via --data-dir). STATELESS / COLD by design: the articles dashboard is a stateless nightly advisory
  // (like the legacy JS scanners) — it holds no live book. We start from a FLAT book (positions:[], no
  // --state) so CREATE = the FULL set of BUY orders the engine would place tomorrow given no holdings.
  // (A warm state makes decide incremental → re-running the same asof yields 0 new orders — correct
  // for a live book, wrong for a stateless advisory. See dtx README "state persists".)
  const decision = engine.decide({
    portfolioPath: modeInfo.path, asof,
    positions: [], orders: [], balances,
    dataDir: DATA_CTX.dataDir, cwd: DATA_CTX.cwd,
  });
  const create = (decision.actions && decision.actions.CREATE) || [];
  const orders = create.map(mapOrder);

  // 2) replay → metrics + equity over the window (NATIVE)
  let metrics = null, equity = null, replayErr = null;
  if (opts.replay) {
    try {
      const from = opts.from || DEFAULT_FROM;
      // Backtest ends at go-live (splice with live track); unwired modes fall back to asof.
      const to = opts.to || goLiveFor(cfg.id) || asof;
      const rep = engine.replay({ portfolioPath: modeInfo.path, from, to, dataDir: DATA_CTX.dataDir, cwd: DATA_CTX.cwd });
      const r = rep.results && rep.results[0];
      if (r) {
        metrics = {
          allocation: r.allocation, strategy: r.strategy,
          initial_capital: r.initial_capital,
          final_equity: r.final_equity, total_trades: r.total_trades,
          winners: r.winners, losers: r.losers, win_rate: r.win_rate,
          return_pct: r.return_pct, cagr_pct: r.cagr_pct, max_dd_pct: r.max_dd_pct,
          sharpe: r.sharpe, r2: r.r2, from, to,
        };
        equity = { dates: r.equity_dates || [], values: r.equity_values || [] };
      }
    } catch (e) {
      replayErr = e.message;
    }
  }

  const out = {
    mode: modeInfo.id,
    portfolioId: cfg.id,
    name: cfg.name,
    asof,
    generatedAt: new Date().toISOString(),
    engine: 'dtx (systematic-tss) — NATIVE',
    engineMode: 'native',
    config: path.relative(REPO_ROOT, modeInfo.path),
    currency,
    orders,
    updates: (decision.actions && decision.actions.UPDATE) || [],
    cancels: (decision.actions && decision.actions.CANCEL) || [],
    metrics,
    equity,
    replayError: replayErr,
    stateless: true,
    tookMs: Date.now() - t0,
  };

  const outPath = opts.out || path.join(STAGING_DIR, `${modeInfo.id}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');

  log(`  [${modeInfo.id}] native ${currency} | orders(CREATE)=${orders.length}`);
  if (metrics) log(`    replay ${metrics.from}→${metrics.to}: cagr=${metrics.cagr_pct} dd=${metrics.max_dd_pct} sharpe=${metrics.sharpe} trades=${metrics.total_trades} wr=${metrics.win_rate}`);
  else if (replayErr) log(`    replay ERROR: ${replayErr}`);
  log(`    → ${path.relative(REPO_ROOT, outPath)} (${out.tookMs}ms)`);

  return out;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
function main() {
  const opts = parseArgs(process.argv);
  const modes = discoverModes();

  if (opts.list) {
    const ctx = DATA_CTX ? `${DATA_CTX.kind} (${DATA_CTX.dataDir || DATA_CTX.cwd})` : 'NONE';
    console.log(`Discovered modes (config/dtx/) — NATIVE mode, data-ctx=${ctx}:`);
    for (const m of Object.values(modes)) {
      if (m.error) console.log(`  ${String(m.id).padEnd(22)} ERROR: ${m.error}`);
      else console.log(`  ${m.id.padEnd(22)} ${m.currency} ${m.initialCapital}  (${m.file})`);
    }
    return;
  }

  if (!opts.asof) { console.error('ERROR: --asof YYYY-MM-DD required'); process.exit(2); }

  try {
    assertDataCtx();
  } catch (e) {
    if (opts.skipIfNoTss) {
      // Fail-SAFE skip: the pipeline reads the committed staging instead.
      console.warn(`⚠️  dtx-scan: ${e.message}`);
      console.warn('⚠️  dtx-scan: --skip-if-no-data set → SKIPPING native refresh. The pipeline will ' +
        'READ the committed staging (data/dtx/<mode>.json). Only happens if the vendored bundle was not ' +
        'pulled (git lfs pull). Staging is only as fresh as the last upstream dtx-scan+commit.');
      process.exit(0);
    }
    console.error(`ERROR: ${e.message}`);
    process.exit(3);
  }

  // Point the engine's OHLCV cache at a writable dir so the bundle/repo stays read-only (cloud-safe).
  if (!process.env.DTX_WRITABLE_CACHE_DIR) process.env.DTX_WRITABLE_CACHE_DIR = WRITABLE_CACHE_DIR;
  try { fs.mkdirSync(process.env.DTX_WRITABLE_CACHE_DIR, { recursive: true }); } catch (_) {}

  let targets;
  if (opts.all) targets = Object.values(modes).filter((m) => !m.error);
  else if (opts.mode) {
    // accept portfolio id OR a friendly alias
    const alias = { highvol: 'us_highvol', stockbox: 'stockbox_nasdaq', etf: 'etf_us', bull: 'us_ablite' };
    const id = modes[opts.mode] ? opts.mode : (alias[opts.mode] && modes[alias[opts.mode]] ? alias[opts.mode] : null);
    if (!id) { console.error(`ERROR: unknown mode "${opts.mode}". Try --list.`); process.exit(2); }
    targets = [modes[id]];
  } else { console.error('ERROR: --mode <id> or --all required'); process.exit(2); }

  console.log(`dtx-scan (NATIVE) asof=${opts.asof} data-ctx=${DATA_CTX.kind}:${DATA_CTX.dataDir || DATA_CTX.cwd} cache=${process.env.DTX_WRITABLE_CACHE_DIR} modes=${targets.map((m) => m.id).join(',')}\n`);
  const summary = [];
  for (const m of targets) {
    try {
      const out = scanMode(m, opts);
      summary.push({ mode: m.id, ok: true, orders: out.orders.length, cagr: out.metrics && out.metrics.cagr_pct, trades: out.metrics && out.metrics.total_trades, dd: out.metrics && out.metrics.max_dd_pct, replayError: out.replayError });
    } catch (e) {
      console.error(`  [${m.id}] FAILED: ${e.message}`);
      summary.push({ mode: m.id, ok: false, error: e.message });
    }
  }

  console.log('\n=== SUMMARY ===');
  for (const s of summary) {
    if (s.ok) console.log(`  ${s.mode.padEnd(22)} OK   orders=${s.orders} cagr=${s.cagr != null ? s.cagr : '-'} dd=${s.dd != null ? s.dd : '-'} trades=${s.trades != null ? s.trades : '-'}${s.replayError ? ' (replay err: ' + s.replayError + ')' : ''}`);
    else console.log(`  ${s.mode.padEnd(22)} FAIL ${s.error}`);
  }
}

if (require.main === module) main();

module.exports = { scanMode, discoverModes, DATA_CTX, BUNDLE_DIR };
