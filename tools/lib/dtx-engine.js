'use strict';
/**
 * dtx-engine.js — Node wrapper around the `dtx` binary (systematic-tss prod engine, JSON-in/JSON-out).
 *
 * The `dtx` binary exposes the EXACT production strategy engine (scanners + position managers +
 * regime + sizing + VIX) as a CLI. We feed our own bars (injected/offline mode, deterministic) and
 * get orders/metrics back. Parity by construction — no hand-ported strategy logic.
 *
 * Provenance: tools/bin/PROVENANCE.json (systematic-tss commit + go version + sha256).
 * README: tools/bin/README.md.
 *
 * FAIL-CLOSED philosophy (MCP hard-stop): if the platform binary is absent or a run exits non-zero,
 * we THROW with a clear error — NEVER fabricate output. STDOUT carries JSON; STDERR carries logs.
 *
 * Subcommands wrapped:
 *   decide  — daily orders  : State(N) → Actions(N+1)   → {state, actions:{CREATE,UPDATE,CANCEL}}
 *   replay  — metrics+equity : decide looped over history → {portfolio_id, results:[{...}]}
 *   regime  — market regime  : macro basket             → {regime, regime_score, ...}
 *
 * Selftest: node tools/lib/dtx-engine.js --selftest
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const BIN_DIR = path.resolve(__dirname, '..', 'bin');

/** Resolve the platform binary. darwin-arm64 locally, linux-amd64 on cloud/CI. */
function resolveBinary() {
  const platform = os.platform(); // 'darwin' | 'linux'
  const arch = os.arch();         // 'arm64' | 'x64'
  let name;
  if (platform === 'darwin') name = 'dtx-darwin-arm64';
  else if (platform === 'linux') name = 'dtx-linux-amd64';
  else name = null;

  if (!name) {
    throw new Error(
      `dtx-engine: unsupported platform ${platform}/${arch} — only darwin-arm64 and linux-amd64 ` +
      `binaries are vendored (tools/bin/). Rebuild from systematic-tss for this platform.`
    );
  }
  const bin = path.join(BIN_DIR, name);
  if (!fs.existsSync(bin)) {
    throw new Error(
      `dtx-engine: binary NOT FOUND at ${bin}. ` +
      `On cloud/CI this usually means git-lfs did not pull the file — run \`git lfs pull\`. ` +
      `FAIL-CLOSED: refusing to fabricate engine output.`
    );
  }
  // git-lfs pointer files are tiny text stubs (<200 bytes). A real binary is ~17-18MB.
  try {
    const sz = fs.statSync(bin).size;
    if (sz < 100000) {
      const head = fs.readFileSync(bin, 'utf8').slice(0, 120);
      if (/git-lfs|oid sha256/.test(head)) {
        throw new Error(
          `dtx-engine: ${bin} is an UNRESOLVED git-lfs pointer (${sz} bytes), not the real binary. ` +
          `Run \`git lfs pull\`. FAIL-CLOSED.`
        );
      }
    }
  } catch (e) {
    if (/git-lfs pointer/.test(e.message)) throw e;
    // stat/read hiccup — let the spawn surface the real problem
  }
  return bin;
}

/** Write a temp JSON file, return its path. Caller cleans up. */
function writeTmp(dir, name, obj) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, JSON.stringify(obj), 'utf8');
  return p;
}

/** Run the binary; parse STDOUT JSON. Throw on non-zero exit or unparseable stdout. */
function run(args, { cwd } = {}) {
  const bin = resolveBinary();
  const res = spawnSync(bin, args, {
    cwd: cwd || process.cwd(),
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024, // equity arrays over long windows can be large
  });
  if (res.error) {
    throw new Error(`dtx-engine: spawn failed for ${bin}: ${res.error.message}`);
  }
  if (res.status !== 0) {
    const err = (res.stderr || '').trim().split('\n').slice(-25).join('\n');
    throw new Error(
      `dtx-engine: \`dtx ${args[0]}\` exited ${res.status}.\nSTDERR (tail):\n${err || '(empty)'}`
    );
  }
  const out = (res.stdout || '').trim();
  if (!out) {
    const err = (res.stderr || '').trim().split('\n').slice(-15).join('\n');
    throw new Error(`dtx-engine: \`dtx ${args[0]}\` produced empty STDOUT.\nSTDERR (tail):\n${err}`);
  }
  try {
    return JSON.parse(out);
  } catch (e) {
    // The last line of stdout should be the JSON payload; try to recover if logs leaked to stdout.
    const lastBrace = out.lastIndexOf('\n{');
    if (lastBrace >= 0) {
      try { return JSON.parse(out.slice(lastBrace + 1)); } catch (_) { /* fallthrough */ }
    }
    throw new Error(`dtx-engine: could not parse STDOUT as JSON (${e.message}). First 300 chars:\n${out.slice(0, 300)}`);
  }
}

/** Make a throwaway temp dir for a single invocation. */
function withTmpDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dtx-'));
  try {
    return fn(dir);
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  }
}

/**
 * replay — loop the decide primitive over history → metrics + equity curve.
 * @param {string} portfolioPath  path to portfolio_*.yaml
 * @param {object} bars           { TICKER: [{date,open,high,low,close,volume}, ...] }
 * @param {string} [from]         YYYY-MM-DD
 * @param {string} [to]          YYYY-MM-DD
 * @returns {object} { portfolio_id, results:[{allocation,strategy,final_equity,total_trades,win_rate,
 *                     return_pct,cagr_pct,max_dd_pct,sharpe,r2,equity_dates[],equity_values[]}] }
 */
function replay({ portfolioPath, bars, from, to }) {
  if (!portfolioPath) throw new Error('dtx-engine.replay: portfolioPath required');
  if (!bars || typeof bars !== 'object') throw new Error('dtx-engine.replay: bars object required');
  return withTmpDir((dir) => {
    const barsPath = writeTmp(dir, 'bars.json', bars);
    const args = ['replay', '--portfolio', portfolioPath, '--bars', barsPath];
    if (from) args.push('--from', from);
    if (to) args.push('--to', to);
    return run(args);
  });
}

/** Re-key a position to the snake_case schema decide expects. Pass-through if already snake. */
function normalizePosition(p) {
  return {
    symbol: p.symbol || p.Symbol,
    qty: p.qty != null ? p.qty : p.Qty,
    avg_entry: p.avg_entry != null ? p.avg_entry : (p.avgEntry != null ? p.avgEntry : p.AvgEntry),
    current_price: p.current_price != null ? p.current_price : (p.currentPrice != null ? p.currentPrice : p.CurrentPrice),
    unrealized_pnl: p.unrealized_pnl != null ? p.unrealized_pnl : (p.unrealizedPnL != null ? p.unrealizedPnL : 0),
    change_today: p.change_today != null ? p.change_today : (p.changeToday != null ? p.changeToday : 0),
    currency: p.currency || p.Currency || undefined,
  };
}

/** Re-key an order to the snake_case schema decide expects. */
function normalizeOrder(o) {
  return {
    order_id: o.order_id || o.orderId || o.OrderID,
    symbol: o.symbol || o.Symbol,
    side: o.side || o.Side,
    order_type: o.order_type || o.orderType || o.OrderType,
    qty: o.qty != null ? o.qty : o.Qty,
    limit_price: o.limit_price != null ? o.limit_price : (o.limitPrice != null ? o.limitPrice : o.LimitPrice),
    stop_price: o.stop_price != null ? o.stop_price : (o.stopPrice != null ? o.stopPrice : o.StopPrice),
    currency: o.currency || o.Currency || undefined,
  };
}

/**
 * Build the balanceInput payload. Accepts either the full schema (has cash_by_currency) or a flat
 * convenience map {USD:100000}. total_equity = Σ cash + Σ(position qty * current_price) unless given.
 */
function normalizeBalances(balances, positions, baseCurrency) {
  if (balances && balances.cash_by_currency && typeof balances.cash_by_currency === 'object') {
    return balances; // already full schema — trust the caller
  }
  const cash = { ...balances };
  const cashSum = Object.values(cash).reduce((a, v) => a + (Number(v) || 0), 0);
  const posValue = (positions || []).reduce((a, p) => a + (Number(p.qty) || 0) * (Number(p.current_price) || 0), 0);
  const base = baseCurrency || Object.keys(cash)[0] || 'USD';
  return { base_currency: base, cash_by_currency: cash, total_equity: cashSum + posValue };
}

/**
 * decide — daily orders: State(N) → Actions(N+1).
 *
 * GOTCHAs (verified against cmd/dtx/decide_cmd.go @ 076c38ab):
 *  - positions & orders are JSON ARRAYS; balances is an OBJECT.
 *  - The balances object schema is { base_currency, cash_by_currency:{CUR:amt}, total_equity } —
 *    NOT a flat {"USD":100000}. A flat object parses to total_equity=0 → zero buying power →
 *    ZERO orders (silent). This wrapper accepts the CONVENIENCE flat form {USD:100000} and
 *    normalizes it (total_equity = Σ cash + Σ position value) so callers can't trip that wire.
 *  - positionInput keys are snake_case: {symbol, qty, avg_entry, current_price, unrealized_pnl,
 *    change_today, currency}. orderInput: {order_id, symbol, side, order_type, qty, limit_price,
 *    stop_price, currency}. This wrapper re-keys camelCase inputs to snake_case.
 *
 * @param {string} portfolioPath
 * @param {string} asof            YYYY-MM-DD
 * @param {object} bars
 * @param {Array}  [positions]     open positions (snake_case or camelCase accepted)
 * @param {Array}  [orders]        working orders
 * @param {object} [balances]      flat {USD:100000} OR full {base_currency,cash_by_currency,total_equity}
 * @param {string} [baseCurrency]  base currency for the balance snapshot (default: first cash key)
 * @param {string} [statePath]     persisted state from previous run (absent on first run);
 *                                 the returned state is written back here if provided.
 * @returns {object} { state, actions:{ CREATE:[orderReq], UPDATE:[], CANCEL:[] } }
 *          orderReq keys (snake_case): order_id, symbol, side, order_type, qty, limit_price,
 *          stop_price, stop_loss, take_profit, reason, priority.
 */
function decide({ portfolioPath, asof, bars, positions = [], orders = [], balances = {}, baseCurrency, statePath }) {
  if (!portfolioPath) throw new Error('dtx-engine.decide: portfolioPath required');
  if (!asof) throw new Error('dtx-engine.decide: asof (YYYY-MM-DD) required');
  if (!bars || typeof bars !== 'object') throw new Error('dtx-engine.decide: bars object required');
  if (!Array.isArray(positions)) throw new Error('dtx-engine.decide: positions must be an array');
  if (!Array.isArray(orders)) throw new Error('dtx-engine.decide: orders must be an array');
  if (Array.isArray(balances) || typeof balances !== 'object') {
    throw new Error('dtx-engine.decide: balances must be an object');
  }
  const posSnake = positions.map(normalizePosition);
  const ordSnake = orders.map(normalizeOrder);
  const balancePayload = normalizeBalances(balances, posSnake, baseCurrency);
  return withTmpDir((dir) => {
    const barsPath = writeTmp(dir, 'bars.json', bars);
    const posPath = writeTmp(dir, 'positions.json', posSnake);
    const ordPath = writeTmp(dir, 'orders.json', ordSnake);
    const balPath = writeTmp(dir, 'balances.json', balancePayload);
    const args = [
      'decide', '--portfolio', portfolioPath, '--asof', asof,
      '--bars', barsPath, '--positions', posPath, '--orders', ordPath, '--balances', balPath,
    ];
    // Pass prior state if it exists on disk (first run has none).
    if (statePath && fs.existsSync(statePath)) {
      args.push('--state', statePath);
    }
    const result = run(args);
    // Persist state for the next run if a path was requested.
    if (statePath && result && result.state !== undefined) {
      fs.mkdirSync(path.dirname(statePath), { recursive: true });
      fs.writeFileSync(statePath, JSON.stringify(result.state), 'utf8');
    }
    return result;
  });
}

/**
 * regime — market regime from the macro basket (^GSPC/^VIX/IWM/SPY/TLT/HYG/GLD).
 * @param {string} asof       YYYY-MM-DD
 * @param {object} macroBars  bars object keyed by macro symbols
 * @returns {object} { regime, regime_score, sma_regime, ... }
 */
function regime({ asof, macroBars }) {
  if (!asof) throw new Error('dtx-engine.regime: asof required');
  if (!macroBars || typeof macroBars !== 'object') throw new Error('dtx-engine.regime: macroBars object required');
  return withTmpDir((dir) => {
    const barsPath = writeTmp(dir, 'macro_bars.json', macroBars);
    return run(['regime', '--asof', asof, '--bars', barsPath]);
  });
}

module.exports = { resolveBinary, replay, decide, regime, BIN_DIR };

// ---------------------------------------------------------------------------
// Selftest : node tools/lib/dtx-engine.js --selftest
// ---------------------------------------------------------------------------
if (require.main === module && process.argv.includes('--selftest')) {
  runSelftest();
}

function runSelftest() {
  let failed = 0;
  const ok = (l) => console.log(`  ok  ${l}`);

  try {
    const bin = resolveBinary();
    ok(`binary resolved: ${path.basename(bin)}`);

    // Synthetic bars: a strong uptrend + a macro basket so decide/regime have something to chew on.
    const days = [];
    const start = new Date(Date.UTC(2024, 0, 2));
    for (let i = 0; i < 260; i++) {
      const d = new Date(start.getTime() + i * 86400000);
      // skip weekends for realism (not required, engine sorts)
      if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
      days.push(d.toISOString().slice(0, 10));
    }
    const mk = (base, drift, vol) => days.map((date, i) => {
      const c = base * (1 + drift * i) * (1 + (Math.sin(i / 5) * vol));
      return { date, open: c * 0.99, high: c * 1.02, low: c * 0.98, close: c, volume: 20_000_000 + i * 10000 };
    });
    const bars = {
      AAAA: mk(50, 0.004, 0.03),
      BBBB: mk(30, 0.003, 0.04),
      CCCC: mk(80, 0.002, 0.02),
    };
    const macro = {
      '^GSPC': mk(4500, 0.001, 0.01),
      '^VIX': mk(15, 0, 0.05),
      'SPY': mk(450, 0.001, 0.01),
      'IWM': mk(190, 0.001, 0.02),
      'TLT': mk(95, -0.0002, 0.01),
      'HYG': mk(76, 0.0002, 0.008),
      'GLD': mk(190, 0.0008, 0.01),
    };

    const cfg = path.resolve(__dirname, '..', '..', 'config', 'dtx', 'portfolio_us_highvol.yaml');
    if (!fs.existsSync(cfg)) throw new Error(`selftest needs ${cfg}`);

    const rep = replay({ portfolioPath: cfg, bars, from: days[0], to: days[days.length - 1] });
    if (!rep || !Array.isArray(rep.results)) throw new Error('replay returned no results[]');
    ok(`replay → portfolio_id=${rep.portfolio_id}, results=${rep.results.length}, trades=${rep.results[0] ? rep.results[0].total_trades : '?'}`);

    const tmpState = path.join(os.tmpdir(), `dtx-selftest-state-${process.pid}.json`);
    try { fs.rmSync(tmpState, { force: true }); } catch (_) {}
    const dec = decide({
      portfolioPath: cfg, asof: days[days.length - 1], bars,
      positions: [], orders: [], balances: { USD: 100000 }, statePath: tmpState,
    });
    if (!dec || !dec.actions) throw new Error('decide returned no actions');
    ok(`decide → CREATE=${(dec.actions.CREATE || []).length} UPDATE=${(dec.actions.UPDATE || []).length} CANCEL=${(dec.actions.CANCEL || []).length}, state persisted=${fs.existsSync(tmpState)}`);
    try { fs.rmSync(tmpState, { force: true }); } catch (_) {}

    const reg = regime({ asof: days[days.length - 1], macroBars: macro });
    ok(`regime → ${reg.regime} (score=${reg.regime_score})`);

    // fail-closed check: a non-existent portfolio must throw, not fabricate.
    let threw = false;
    try { replay({ portfolioPath: '/nope/missing.yaml', bars }); } catch (_) { threw = true; }
    if (!threw) throw new Error('expected replay to throw on missing portfolio');
    ok('fail-closed on bad portfolio (throws, no fabrication)');

    console.log('\n  SELFTEST PASS — dtx-engine wrapper OK\n');
  } catch (e) {
    failed = 1;
    console.error('\n  SELFTEST FAIL:', e && e.message ? e.message : e);
    if (e && e.stack) console.error(e.stack.split('\n').slice(0, 4).join('\n'));
  }
  process.exit(failed);
}
