#!/usr/bin/env node
'use strict';
/**
 * dtx-scan.js — orchestrator: drive the REAL systematic-tss engine (dtx binary) per book config.
 *
 * Phase 1 = PARALLEL, STAGING-ONLY pipeline. It does NOT touch the live JS scanners, sweep.js,
 * signals.json, backtest-trades.json, trade-chain.json, or modes-config.json. It writes to a
 * staging dir (data/dtx/<mode>.json) and persists per-mode engine state (data/dtx/state/<mode>.json).
 *
 * Per book config it:
 *   1. resolves the universe (dtx-bars.resolveUniverse)
 *   2. builds PIT-safe bars for --asof (dtx-bars.buildBars, anti-look-ahead)
 *   3. `dtx decide --asof <session>` → maps actions.CREATE (BUY) into our order/pool shape
 *   4. `dtx replay` over the bars window → equity + metrics
 *
 * Usage:
 *   node tools/dtx-scan.js --mode highvol --asof 2026-06-30 [--cap 1200] [--no-replay] [--quiet]
 *   node tools/dtx-scan.js --all --asof 2026-06-30
 *   node tools/dtx-scan.js --list
 *
 * Modes are auto-discovered from config/dtx/portfolio_*.yaml (mode id = portfolio id).
 */

const fs = require('fs');
const path = require('path');
const engine = require('./lib/dtx-engine');
const dtxBars = require('./lib/dtx-bars');

const REPO_ROOT = path.resolve(__dirname, '..');
const CONFIG_DIR = path.join(REPO_ROOT, 'config', 'dtx');
const STAGING_DIR = path.join(REPO_ROOT, 'data', 'dtx');
const STATE_DIR = path.join(STAGING_DIR, 'state');

// ---------------------------------------------------------------------------
// arg parsing
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const o = { replay: true, quiet: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--mode') o.mode = argv[++i];
    else if (a === '--asof') o.asof = argv[++i];
    else if (a === '--cap') o.cap = parseInt(argv[++i], 10);
    else if (a === '--from') o.from = argv[++i];
    else if (a === '--to') o.to = argv[++i];
    else if (a === '--all') o.all = true;
    else if (a === '--list') o.list = true;
    else if (a === '--no-replay') o.replay = false;
    else if (a === '--quiet') o.quiet = true;
    else if (a === '--out') o.out = argv[++i];
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
function mapOrder(or, bars) {
  // dtx serializes OrderRequest in snake_case: {order_id,symbol,side,order_type,qty,limit_price,
  // stop_price,stop_loss,take_profit,reason,priority}.
  const sym = or.symbol;
  const lastClose = bars[sym] && bars[sym].length ? bars[sym][bars[sym].length - 1].close : null;
  const entry = or.limit_price || or.stop_price || lastClose;
  return {
    symbol: sym,
    side: or.side,
    orderType: or.order_type,
    qty: or.qty,
    entry,
    limitPrice: or.limit_price || null,
    stopPrice: or.stop_price || null,
    stopLoss: or.stop_loss || null,
    takeProfit: or.take_profit || null,
    reason: or.reason || null,
    priority: or.priority != null ? or.priority : null,
    orderId: or.order_id || null,
    lastClose,
  };
}

/** min/max bar date across the bars map. */
function barsDateRange(bars) {
  let min = null, max = null;
  for (const arr of Object.values(bars)) {
    if (!arr.length) continue;
    const f = arr[0].date, l = arr[arr.length - 1].date;
    if (min === null || f < min) min = f;
    if (max === null || l > max) max = l;
  }
  return { min, max };
}

// ---------------------------------------------------------------------------
// scan one mode
// ---------------------------------------------------------------------------
function scanMode(modeInfo, opts) {
  const asof = opts.asof;
  const log = (...m) => { if (!opts.quiet) console.log(...m); };
  const t0 = Date.now();

  const cfg = dtxBars.readConfig(modeInfo.path);
  const alloc = cfg.allocations[0];
  const cacheSet = dtxBars.listCacheTickers();

  const uni = dtxBars.resolveUniverse(alloc, { cacheSet, cap: opts.cap });
  const { bars, resolved, missing, thin } = dtxBars.buildBars(uni.symbols, asof, { market: uni.market, cacheSet });

  if (resolved.length === 0) {
    throw new Error(`no bars resolved for mode ${modeInfo.id} (universe=${uni.symbols.length}, source="${uni.source}", missing=${missing.length}). Cache lacks these symbols.`);
  }

  const currency = cfg.currency || 'USD';
  const balances = { [currency]: cfg.initial_capital || 100000 };
  const statePath = path.join(STATE_DIR, `${modeInfo.id}.json`);

  // 1) decide → orders for the session
  const decision = engine.decide({
    portfolioPath: modeInfo.path, asof, bars,
    positions: [], orders: [], balances, statePath,
  });
  const create = (decision.actions && decision.actions.CREATE) || [];
  const orders = create.map((or) => mapOrder(or, bars));

  // 2) replay → metrics + equity over the available window
  let metrics = null, equity = null, replayErr = null;
  if (opts.replay) {
    try {
      const range = barsDateRange(bars);
      const from = opts.from || range.min;
      const to = opts.to || (asof < range.max ? asof : range.max);
      const rep = engine.replay({ portfolioPath: modeInfo.path, bars, from, to });
      const r = rep.results && rep.results[0];
      if (r) {
        metrics = {
          allocation: r.allocation, strategy: r.strategy,
          final_equity: r.final_equity, total_trades: r.total_trades, win_rate: r.win_rate,
          return_pct: r.return_pct, cagr_pct: r.cagr_pct, max_dd_pct: r.max_dd_pct,
          sharpe: r.sharpe, r2: r.r2, from, to,
        };
        // trim equity to endpoints + length to keep staging small; keep full series but compact
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
    engine: 'dtx (systematic-tss)',
    config: path.relative(REPO_ROOT, modeInfo.path),
    currency,
    universe: {
      market: uni.market, source: uni.source, note: uni.note,
      requested: uni.symbols.length, resolved: resolved.length,
      missing: missing.length, missingSample: missing.slice(0, 20),
      thin: thin.length,
    },
    orders,
    updates: (decision.actions && decision.actions.UPDATE) || [],
    cancels: (decision.actions && decision.actions.CANCEL) || [],
    metrics,
    equity,
    replayError: replayErr,
    stateFile: path.relative(REPO_ROOT, statePath),
    tookMs: Date.now() - t0,
  };

  const outPath = opts.out || path.join(STAGING_DIR, `${modeInfo.id}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');

  log(`  [${modeInfo.id}] ${uni.market} src="${uni.source}"`);
  log(`    universe ${resolved.length}/${uni.symbols.length} resolved (${missing.length} missing) | orders(BUY)=${orders.length}`);
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
    console.log('Discovered modes (config/dtx/):');
    for (const m of Object.values(modes)) {
      if (m.error) console.log(`  ${String(m.id).padEnd(22)} ERROR: ${m.error}`);
      else console.log(`  ${m.id.padEnd(22)} ${m.currency} ${m.initialCapital}  (${m.file})`);
    }
    return;
  }

  if (!opts.asof) { console.error('ERROR: --asof YYYY-MM-DD required'); process.exit(2); }

  let targets;
  if (opts.all) targets = Object.values(modes).filter((m) => !m.error);
  else if (opts.mode) {
    // accept portfolio id OR a friendly alias (highvol→us_highvol, stockbox→stockbox_nasdaq)
    const alias = { highvol: 'us_highvol', stockbox: 'stockbox_nasdaq' };
    const id = modes[opts.mode] ? opts.mode : (alias[opts.mode] && modes[alias[opts.mode]] ? alias[opts.mode] : null);
    if (!id) { console.error(`ERROR: unknown mode "${opts.mode}". Try --list.`); process.exit(2); }
    targets = [modes[id]];
  } else { console.error('ERROR: --mode <id> or --all required'); process.exit(2); }

  console.log(`dtx-scan asof=${opts.asof} modes=${targets.map((m) => m.id).join(',')}\n`);
  const summary = [];
  for (const m of targets) {
    try {
      const out = scanMode(m, opts);
      summary.push({ mode: m.id, ok: true, orders: out.orders.length, resolved: out.universe.resolved, cagr: out.metrics && out.metrics.cagr_pct, trades: out.metrics && out.metrics.total_trades, replayError: out.replayError });
    } catch (e) {
      console.error(`  [${m.id}] FAILED: ${e.message}`);
      summary.push({ mode: m.id, ok: false, error: e.message });
    }
  }

  console.log('\n=== SUMMARY ===');
  for (const s of summary) {
    if (s.ok) console.log(`  ${s.mode.padEnd(22)} OK   orders=${s.orders} universe=${s.resolved} cagr=${s.cagr != null ? s.cagr : '-'} trades=${s.trades != null ? s.trades : '-'}${s.replayError ? ' (replay err: ' + s.replayError + ')' : ''}`);
    else console.log(`  ${s.mode.padEnd(22)} FAIL ${s.error}`);
  }
}

if (require.main === module) main();

module.exports = { scanMode, discoverModes };
