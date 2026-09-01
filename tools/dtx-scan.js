#!/usr/bin/env node
'use strict';
/**
 * dtx-scan.js - DTX staging schema, Contract V2 validation and mode discovery.
 *
 * The hosted systematic MCP is the sole engine. Scripted collection uses a
 * short-lived server-scoped token for DtxDecide/DtxReplay; DtxBookEquity is
 * captured by the authenticated agent and verified offline. This module never
 * executes broker orders and never falls back to a local strategy engine.
 */

const fs = require('fs');
const path = require('path');
const { bookCurveSha256 } = require('./lib/dtx-book-proof');
// dtx-bars (→ js-yaml) est chargé PARESSEUSEMENT : seul discoverModes()/le CLI en a besoin.
// Un require top-level faisait crasher writeStagingCompleteness/stagingStatus dans tout
// environnement sans node_modules (js-yaml manquant) → le filet Step 4d mourait AVANT d'écrire
// le marqueur, et qa-check traitait « pas de marqueur » comme OK. Constaté le 2026-07-16
// (marqueur jamais écrit depuis le cut-over). Les fonctions de complétude ne dépendent plus
// que de fs/path.
let _dtxBars = null;
function dtxBars() { if (!_dtxBars) _dtxBars = require('./lib/dtx-bars'); return _dtxBars; }

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
// dtx MCP v15 cut-over (2026-07-13): the 6 cost-honest strategies. Fresh ids => identity map
// (dashboard mode id == dtx portfolio id == staging file). Legacy scripted modes are stopped.
// Un seul portefeuille depuis le 2026-08-12 : « best », panier multi-poches qui
// remplace et agrège les six précédents. Cette table était restée sur les six
// supprimés — conséquence : le moteur rendait ses 18 ordres et rien ne les
// routait vers le mode, dont le panneau restait vide sur la page publiée.
const PORTFOLIO_TO_MODE = { best: 'best' };
// Livres multi-poches : leur portefeuille EST le bloc `combined`, pas results[0]
// qui ne serait que la première poche. « best » en est un — porteur haute
// volatilité, poche défensive, ETF, explosion de momentum.
const MULTI_ALLOC_BOOKS = new Set(['best']);
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

// The 6 dtx modes wired to the engine (the MCP produces their staging).
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
      const p = dtxBars().readConfig(path.join(CONFIG_DIR, f));
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

/**
 * Index symbole → POCHE du livre, LU dans l'état que le moteur renvoie lui-même.
 *
 * POURQUOI (R7, fermé le 2026-08-12). Un ordre CREATE ne porte que 7 champs
 * (symbol, side, order_type, qty, limit_price, stop_loss, reason) — aucun ne nomme la poche. On a
 * longtemps cru le tag irrécupérable, donc le DRIFT des sorties (poches uhv/ep/etf_us/mx aux
 * take-profit 999/20/aucun/25) non diagnosticable. Mais `DtxDecide` renvoie AUSSI `state`, et
 * `state` est INDEXÉ PAR POCHE : `state.<poche>.pm_state.position_open_dates` liste les symboles
 * que cette poche tient. Vérifié sur la séance du 2026-08-12 — partition exacte des 18 ordres :
 * ep(NIQ,RNW) + etf_us(7) + mx(8) + uhv_tp999(NN), sans recouvrement.
 *
 * Ce n'est donc PAS une inférence (« GDX est un ETF donc etf_us »), c'est une LECTURE de ce que le
 * moteur déclare. Un symbole revendiqué par deux poches est AMBIGU : on rend `null` et on le dit,
 * plutôt que de trancher au hasard.
 */
function sleeveIndex(decision) {
  const state = (decision && decision.state) || null;
  if (!state || typeof state !== 'object') return { map: {}, conflicts: [] };
  const map = Object.create(null);
  const conflicts = [];
  for (const [sleeve, blk] of Object.entries(state)) {
    const pm = (blk && blk.pm_state) || null;
    if (!pm) continue;
    // position_open_dates est la liste faisant foi (présente même quand position_stops est vide —
    // les poches de ROTATION n'émettent pas de stop, cf. etf_us).
    const syms = Object.keys(pm.position_open_dates || {});
    for (const s of syms) {
      if (map[s] && map[s] !== sleeve) { conflicts.push(`${s} (${map[s]} vs ${sleeve})`); map[s] = null; continue; }
      if (map[s] === null) continue; // déjà marqué ambigu
      map[s] = sleeve;
    }
  }
  return { map, conflicts };
}

function mapOrder(or, sleeves) {
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
    // POCHE du livre — lue dans decision.state (voir sleeveIndex). `null` = état absent ou symbole
    // revendiqué par deux poches ; jamais deviné depuis le type d'actif.
    sleeve: or.sleeve || (sleeves && Object.prototype.hasOwnProperty.call(sleeves, or.symbol) ? sleeves[or.symbol] : null) || null,
    // Execution metadata so the status page / analyses can surface the gates a consumer must honor.
    execOptions: or.exec_options || null,
    alternates: alts,
    groupId: or.group_id || null,
    candidateId: or.candidate_id || null,
    rank: or.rank != null ? Number(or.rank) : null,
    broker: or.broker || null,
    protection: or.protection || null,
    execution: or.execution || null,
    decisionContext: or.decision_context || null,
  };
}

function validateDecisionV2(decision, expected = {}) {
  const errors = [];
  const requiredText = (value, field) => {
    if (typeof value !== 'string' || !value.trim()) errors.push(`${field} missing`);
  };
  if (!decision || typeof decision !== 'object') return ['decision missing'];
  if (decision.contract_version !== '2.0') errors.push('contract_version must equal 2.0');
  for (const key of ['request_id', 'run_id', 'call_id']) requiredText(decision[key], key);
  if (expected.requestId && decision.request_id !== expected.requestId) {
    errors.push(`request_id=${decision.request_id || 'missing'} != ${expected.requestId}`);
  }
  if (expected.asof && decision.requested_asof !== expected.asof) {
    errors.push(`requested_asof=${decision.requested_asof || 'missing'} != ${expected.asof}`);
  }
  const plan = decision.execution_plan;
  if (!plan || typeof plan !== 'object') return [...errors, 'execution_plan missing'];
  requiredText(plan.plan_id, 'execution_plan.plan_id');
  if (!Number.isInteger(plan.revision) || plan.revision < 1) errors.push('execution_plan.revision must be >= 1');
  const validFrom = Date.parse(plan.valid_from || '');
  const validUntil = Date.parse(plan.valid_until || '');
  if (!Number.isFinite(validFrom)) errors.push('execution_plan.valid_from invalid');
  if (!Number.isFinite(validUntil)) errors.push('execution_plan.valid_until invalid');
  if (Number.isFinite(validFrom) && Number.isFinite(validUntil) && validUntil <= validFrom) errors.push('execution_plan validity window is empty');
  if (!Array.isArray(plan.groups)) return [...errors, 'execution_plan.groups missing'];

  const groupIds = new Set();
  const candidateIds = new Set();
  for (let gi = 0; gi < plan.groups.length; gi++) {
    const group = plan.groups[gi] || {};
    const gp = `execution_plan.groups[${gi}]`;
    requiredText(group.group_id, `${gp}.group_id`);
    if (group.group_id && groupIds.has(group.group_id)) errors.push(`${gp}.group_id duplicate`);
    if (group.group_id) groupIds.add(group.group_id);
    if (group.max_winners !== 1) errors.push(`${gp}.max_winners must equal 1`);
    if (!group.promotion_policy || !Array.isArray(group.promotion_policy.promote_on) || !Array.isArray(group.promotion_policy.stop_on)) errors.push(`${gp}.promotion_policy incomplete`);
    if (!Array.isArray(group.candidates) || !group.candidates.length) {
      errors.push(`${gp}.candidates missing`);
      continue;
    }
    let previousRank = 0;
    for (let ci = 0; ci < group.candidates.length; ci++) {
      const c = group.candidates[ci] || {};
      const cp = `${gp}.candidates[${ci}]`;
      requiredText(c.candidate_id, `${cp}.candidate_id`);
      if (c.candidate_id && candidateIds.has(c.candidate_id)) errors.push(`${cp}.candidate_id duplicate`);
      if (c.candidate_id) candidateIds.add(c.candidate_id);
      if (!Number.isInteger(c.rank) || c.rank <= previousRank) errors.push(`${cp}.rank must be strictly increasing`);
      if (ci === 0 && c.rank !== 1) errors.push(`${cp}.rank must start at 1`);
      previousRank = Number.isInteger(c.rank) ? c.rank : previousRank;
      for (const key of ['symbol', 'side', 'broker', 'sleeve', 'reason']) requiredText(c[key], `${cp}.${key}`);
      if (!Number.isFinite(Number(c.qty)) || Number(c.qty) <= 0) errors.push(`${cp}.qty invalid`);
      if (!c.order || typeof c.order !== 'object') {
        errors.push(`${cp}.order missing`);
      } else {
        requiredText(c.order.order_type, `${cp}.order.order_type`);
        requiredText(c.order.time_in_force, `${cp}.order.time_in_force`);
        if (c.order.order_type === 'LIMIT' && !Number.isFinite(Number(c.order.limit_price))) errors.push(`${cp}.order.limit_price missing for LIMIT`);
        if (!Number.isFinite(Number(c.order.max_notional)) || Number(c.order.max_notional) <= 0) errors.push(`${cp}.order.max_notional invalid`);
        if (typeof c.order.extended_hours !== 'boolean') errors.push(`${cp}.order.extended_hours missing`);
      }
      if (!c.protection || typeof c.protection !== 'object') {
        errors.push(`${cp}.protection missing`);
      } else {
        const mode = c.protection.mode;
        if (!['native_bracket', 'native_oco', 'engine_managed', 'none'].includes(mode)) errors.push(`${cp}.protection.mode unsupported`);
        if (c.side === 'BUY' && mode === 'none') errors.push(`${cp}.new BUY cannot use protection.mode=none`);
        if (mode === 'native_bracket' && (!Number.isFinite(Number(c.protection.stop_loss)) || !Number.isFinite(Number(c.protection.take_profit)))) errors.push(`${cp}.native_bracket incomplete`);
        if (mode === 'engine_managed' && (!Number.isFinite(Number(c.protection.stop_loss)) || !c.protection.exit_policy_ref)) errors.push(`${cp}.engine_managed incomplete`);
      }
      if (!c.execution || typeof c.execution !== 'object') {
        errors.push(`${cp}.execution missing`);
      } else {
        for (const key of ['window_start', 'window_end', 'timezone']) requiredText(c.execution[key], `${cp}.execution.${key}`);
        for (const key of ['gate_timeout_sec', 'fill_timeout_sec', 'min_fill_qty', 'gap_up_pct', 'gap_down_pct', 'max_slippage_bps']) {
          if (!Number.isFinite(Number(c.execution[key]))) errors.push(`${cp}.execution.${key} missing`);
        }
        if (typeof c.execution.vwap_weak_skip !== 'boolean') errors.push(`${cp}.execution.vwap_weak_skip missing`);
      }
      if (!c.decision_context || typeof c.decision_context !== 'object') errors.push(`${cp}.decision_context missing`);
    }
  }
  const actions = decision.actions || {};
  for (const actionType of ['UPDATE', 'CANCEL']) {
    const rows = actions[actionType] || [];
    if (!Array.isArray(rows)) {
      errors.push(`actions.${actionType} must be an array`);
      continue;
    }
    for (let i = 0; i < rows.length; i++) {
      const action = rows[i] || {};
      const ap = `actions.${actionType}[${i}]`;
      for (const key of ['run_id', 'call_id', 'candidate_id', 'group_id', 'target_order_id', 'reason']) requiredText(action[key], `${ap}.${key}`);
      if (!action.parent_candidate_id && !action.parent_engine_order_fingerprint) errors.push(`${ap}.parent reference missing`);
      if (!action.levels_before || typeof action.levels_before !== 'object') errors.push(`${ap}.levels_before missing`);
      if (!action.levels_after || typeof action.levels_after !== 'object') errors.push(`${ap}.levels_after missing`);
      if (typeof action.place_now !== 'boolean') errors.push(`${ap}.place_now missing`);
    }
  }
  return errors;
}

function rankOneOrdersFromV2(decision) {
  return decision.execution_plan.groups.map(group => {
    const c = [...group.candidates].sort((a, b) => a.rank - b.rank)[0];
    return {
      symbol: c.symbol, side: c.side, order_type: c.order.order_type, qty: c.qty,
      limit_price: c.order.limit_price, stop_price: c.order.stop_price,
      stop_loss: c.protection.stop_loss, take_profit: c.protection.take_profit,
      reason: c.reason, sleeve: c.sleeve, broker: c.broker,
      group_id: group.group_id, candidate_id: c.candidate_id, rank: c.rank,
      protection: c.protection, execution: c.execution, decision_context: c.decision_context,
    };
  });
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
  const rows = rep && rep.results;
  const r = rows && rows[0];
  if (!r) return { metrics: null, equity: null };
  // Multi-allocation BOOK (book_honest, hvep, …): the portfolio IS the `combined` block, NOT
  // results[0] (just the first/dominant sleeve — publishing that would overstate the book, e.g.
  // book_honest's 81% highvol sleeve instead of the 58% blend). Stamp the TRUE combined metrics
  // and build the book curve = element-wise sum of the sleeve equity, rebased to 100k start and
  // rescaled so the endpoint honours combined.final_equity / Σ(sleeve initial_capital).
  // ⚠️ `rep.combined` N'EST PAS LE LIVRE. Il additionne des poches rejouées à
  // CAPITAL FIXE (best v2 : 70k/45k/25k/15k), alors que le livre réel rééquilibre
  // dynamiquement entre elles — le capital suit les gagnants. Mesuré le 12/08 sur
  // best : combined rendait 39,59 % de CAGR et 20,2 % de drawdown quand les
  // statistiques servies du livre donnent 70,9 % et 27,2 %, avec une queue à
  // 38,3 %. Publier combined MINORAIT LE RISQUE sur un tableau public, ce qui est
  // la pire direction. Le nombre de trades est également faux : 4 577 en sommant
  // les poches contre 3 638 réels, puisque le rééquilibrage en empêche certains.
  // Pour un livre à allocation dynamique, prendre les statistiques servies et
  // marquer metricsSource — ne jamais reconstruire depuis combined.
  if (rows.length > 1 && rep.combined) {
    const c = rep.combined;
    const dates = r.equity_dates || [];
    const n = dates.length;
    const summed = new Array(n).fill(0);
    for (const row of rows) {
      const ev = row.equity_values || [];
      for (let i = 0; i < n; i++) summed[i] += (ev[i] || 0);
    }
    const sumInit = rows.reduce((s, x) => s + (x.initial_capital || 0), 0) || 100000;
    const base0 = summed[0] || sumInit;
    const targetFinal = 100000 * ((c.final_equity || summed[n - 1]) / sumInit); // combined multiple × 100k
    let curve = summed.map(v => v * (100000 / base0));                          // rebase to 100k start
    const rescale = curve[n - 1] ? targetFinal / curve[n - 1] : 1;
    curve = curve.map(v => Math.round(v * rescale * 100) / 100);
    const winners = rows.reduce((s, x) => s + (x.winners || 0), 0);
    const losers = rows.reduce((s, x) => s + (x.losers || 0), 0);
    const trades = rows.reduce((s, x) => s + (x.total_trades || 0), 0);
    return {
      metrics: {
        allocation: rep.portfolio_id || r.allocation, strategy: r.strategy,
        initial_capital: 100000,
        final_equity: curve[n - 1], total_trades: trades,
        winners, losers,
        win_rate: (winners + losers) ? Math.round(winners / (winners + losers) * 10000) / 100 : c.win_rate,
        return_pct: Math.round((curve[n - 1] / 1000 - 100) * 100) / 100,
        cagr_pct: c.cagr_pct, max_dd_pct: c.max_dd_pct, sharpe: c.sharpe, r2: c.r2, from, to,
      },
      equity: { dates, values: curve },
    };
  }
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
  // Empty/unlaunched replay (≈0 trades) is NOT "corrupt metrics" — it's a no-data condition handled by the
  // completeness gate, not the sanity gate. Skip the metric tripwires below the minimum sample to avoid false
  // positives on modes that legitimately produced no trades (e.g. metals with no universe data → win_rate 0).
  if (tr != null && tr < 10) return warns;
  // Universal tripwires (asset-class-agnostic; systematic-tss configs with real risk mgmt never breach these).
  if (dd != null && Math.abs(dd) > U.max_dd_abs_ceiling) warns.push(`max_dd_pct=${dd} (|DD|>${U.max_dd_abs_ceiling}% ⇒ replay corrompu — cf. incident etf_eu 2026-07-09 DD-89.6%)`);
  if (sh != null && sh < U.min_sharpe) warns.push(`sharpe=${sh} (<${U.min_sharpe} ⇒ métriques cassées)`);
  if (wr != null && (wr < U.win_rate_min || wr > U.win_rate_max)) warns.push(`win_rate=${wr} (hors [${U.win_rate_min},${U.win_rate_max}])`);
  if (cg != null && cg < U.min_cagr) warns.push(`cagr_pct=${cg} (<${U.min_cagr}% sur fenêtre complète ⇒ suspect)`);
  // Per-mode baseline deviation (trade-count blowup is THE signature of the ingest corruption).
  // Les portefeuilles RETIRÉS du catalogue gardent leur staging dans data/dtx/ (règle "No Delete SSD" :
  // rien ne se supprime sans validation par item). Ne lire que `modes` laissait donc 6 stagings
  // (book_honest, us_highvol, hvep, stockbox_pit, etf_us, ep) ré-ingérables SANS ratio de trades —
  // la garde la plus discriminante s'éteignait exactement sur les fichiers que personne ne surveille
  // plus. On retombe sur `_retired.modes` : les bornes de 2026-07-13 sont datées, mais un ratio daté
  // couvre infiniment mieux qu'aucun ratio. Le warning le DIT, pour qu'un retour au catalogue passe
  // par un replay de contrôle et une remontée dans `modes`, jamais par ces chiffres en silence.
  const mb = (base && base.modes && base.modes[portfolioId]) || null;
  const rb = !mb && base && base._retired && base._retired.modes ? base._retired.modes[portfolioId] : null;
  const bl = mb || rb;
  if (bl && tr != null && num(bl.total_trades)) {
    const src = rb ? ` [baseline RETIRÉE du ${base._retired.retired_on || '?'}]` : '';
    const ratio = tr / bl.total_trades;
    if (ratio > U.trades_ratio_high) warns.push(`total_trades=${tr} = ${ratio.toFixed(1)}× baseline ${bl.total_trades}${src} (>${U.trades_ratio_high}× ⇒ double-comptage/concaténation)`);
    else if (ratio < U.trades_ratio_low) warns.push(`total_trades=${tr} = ${ratio.toFixed(2)}× baseline ${bl.total_trades}${src} (<${U.trades_ratio_low}× ⇒ replay tronqué)`);
  }
  return warns;
}

/** Build staging from DtxDecide Contract V2. Rank-1 candidates come exclusively from
 * execution_plan.groups; actions.UPDATE/CANCEL remain compatibility control actions. */
function buildStaging({ modeInfo, cfg, asof, currency, decision, metrics, equity, replayErr, engineLabel, engineMode, t0 }) {
  const contractErrors = validateDecisionV2(decision, { asof });
  if (contractErrors.length) throw new Error(`DtxDecide Contract V2 rejected: ${contractErrors.join('; ')}`);
  // Contract V2 execution_plan.groups is authoritative. actions.CREATE is only
  // the V1 compatibility projection and must never be consumed in parallel.
  const create = rankOneOrdersFromV2(decision);
  const sanityWarnings = assertReplaySanity(cfg.id, metrics);
  const { map: sleeves, conflicts: sleeveConflicts } = sleeveIndex(decision);
  const untagged = create.filter((o) => !sleeves[o.symbol]).map((o) => o.symbol);
  return {
    mode: modeInfo.id,
    portfolioId: cfg.id,
    name: cfg.name,
    asof,
    generatedAt: new Date().toISOString(),
    engine: engineLabel,
    engineMode,
    decisionProvenance: decision ? {
      contractVersion: decision.contract_version || null,
      requestId: decision.request_id || null,
      runId: decision.run_id || null,
      callId: decision.call_id || null,
      requestedAsOf: decision.requested_asof || null,
      expectedDataDate: decision.expected_data_date || null,
      dataAsOf: decision.data_asof || decision.last_data_date || null,
      planId: decision.execution_plan?.plan_id || null,
      planRevision: decision.execution_plan?.revision || null,
      validFrom: decision.execution_plan?.valid_from || null,
      validUntil: decision.execution_plan?.valid_until || null,
    } : null,
    executionPlan: {
      planId: decision.execution_plan.plan_id,
      revision: decision.execution_plan.revision,
      validFrom: decision.execution_plan.valid_from,
      validUntil: decision.execution_plan.valid_until,
      supersedesPlanId: decision.execution_plan.supersedes_plan_id || null,
      groups: decision.execution_plan.groups,
      source: 'execution_plan.groups',
    },
    // MCP is the config source of truth. If a local yaml exists we cite its relative path;
    // otherwise the config lives only server-side (systematic.dailytickers.com).
    config: modeInfo.path ? path.relative(REPO_ROOT, modeInfo.path) : `MCP:${cfg.id}`,
    currency,
    orders: create.map((o) => mapOrder(o, sleeves)),
    // Traçabilité du tag de poche : combien d'ordres n'ont pas pu être rattachés, et pourquoi.
    // Un staging où TOUS les ordres sont sans poche signale que le moteur a cessé de renvoyer
    // `state` — le tracker retombe alors sur les sorties du mode, ce qui doit se voir.
    sleeveCoverage: {
      tagged: create.length - untagged.length,
      total: create.length,
      untagged,
      conflicts: sleeveConflicts,
      source: 'DtxDecide.state[<poche>].pm_state.position_open_dates',
    },
    updates: (decision && decision.actions && decision.actions.UPDATE) || [],
    cancels: (decision && decision.actions && decision.actions.CANCEL) || [],
    metrics,
    equity,
    metricsSource: metrics ? 'mcp_replay' : null,
    equityResolution: equity ? 'replay' : null,
    equitySource: equity ? 'DtxReplay (reconstruction combinée à capital fixe)' : null,
    replayError: replayErr,
    metricsSuspect: sanityWarnings.length > 0,
    _sanityWarning: sanityWarnings.length > 0 ? sanityWarnings : null,
    stateless: true,
    tookMs: Date.now() - t0,
  };
}

/**
 * A served book snapshot is reusable only when its curve reproduces both
 * same-vintage headline metrics and its provenance labels describe that exact
 * curve. DtxStats is a separate measurement campaign and is never accepted as
 * evidence for DtxBookEquity.
 */
function bookSnapshotCoherence(snapshot, expected = {}) {
  const errors = [];
  if (!snapshot || snapshot.metricsSource !== 'book_served_stats') return { ok: false, errors: ['not a served book snapshot'] };
  const dates = snapshot.equity?.dates;
  const values = snapshot.equity?.values;
  const metrics = snapshot.metrics || {};
  const proof = snapshot.bookSnapshot || {};
  if (!Array.isArray(dates) || !Array.isArray(values) || dates.length < 2 || dates.length !== values.length) {
    errors.push('book curve missing or length mismatch');
    return { ok: false, errors };
  }
  const numeric = values.map(Number);
  if (numeric.some(value => !Number.isFinite(value) || value <= 0)) errors.push('book curve contains invalid values');
  if (snapshot.equityResolution !== 'daily') errors.push('book curve resolution is not daily');
  if (proof.sameVintage !== true) errors.push('same-vintage proof missing');
  if (proof.scope !== 'performance_only' || proof.decisionIndependent !== true) errors.push('book/decision scope is ambiguous');
  if (!proof.portfolio) errors.push('book portfolio proof missing');
  if (expected.expectedPortfolio && proof.portfolio !== expected.expectedPortfolio) errors.push('book portfolio mismatch');
  if (proof.expectedClose !== dates[dates.length - 1]) errors.push('proof expected-close mismatch');
  if (expected.expectedClose && proof.expectedClose !== expected.expectedClose) errors.push('book snapshot is not current for expected close');
  if (!/^[a-f0-9]{64}$/.test(String(proof.sourceSha256 || ''))) errors.push('source SHA-256 missing');
  if (!/^[a-f0-9]{64}$/.test(String(proof.curveSha256 || ''))) errors.push('durable curve SHA-256 missing');
  else if (proof.curveSha256 !== bookCurveSha256(dates, values, metrics)) errors.push('durable curve SHA-256 mismatch');
  if (proof.points !== dates.length) errors.push('proof point count mismatch');
  if (proof.curveThrough !== dates[dates.length - 1]) errors.push('proof curve-through mismatch');
  if (proof.measuredAt !== metrics.measured_at) errors.push('proof/metric vintage mismatch');
  if (proof.measuredAt !== proof.expectedClose) errors.push('book measurement is not from expected close');

  const committed = Number(metrics.committed_capital);
  const cagrServed = Number(metrics.cagr_pct);
  const ddServed = Number(metrics.max_dd_pct);
  const sessions = Number(metrics.trading_days_per_year);
  if (!(committed > 0)) errors.push('committed capital missing');
  if (sessions !== 252) errors.push('trading-days convention must equal 252');
  let curveMaxDd = null;
  let curveCagr = null;
  if (!errors.some(error => error.includes('curve contains')) && numeric.length) {
    let peak = numeric[0];
    let worst = 0;
    for (const value of numeric) {
      peak = Math.max(peak, value);
      if (peak > 0) worst = Math.max(worst, (peak - value) / peak * 100);
    }
    curveMaxDd = worst;
    curveCagr = (Math.pow(numeric[numeric.length - 1] / committed, 1 / (numeric.length / sessions)) - 1) * 100;
    if (!Number.isFinite(ddServed) || Math.abs(curveMaxDd - ddServed) > 0.05) errors.push('book curve/MaxDD mismatch');
    if (!Number.isFinite(cagrServed) || Math.abs(curveCagr - cagrServed) > 0.05) errors.push('book curve/CAGR mismatch');
  }
  return { ok: errors.length === 0, errors, curveMaxDd, curveCagr };
}

/** Write the staging object (pretty JSON, mkdir -p). */
function writeStaging(out, outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  // Des métriques SERVIES par le livre priment sur toute reconstruction only when
  // their curve reproduces both same-vintage headline metrics. Un livre
  // à allocation dynamique ne se reconstitue pas en additionnant des poches
  // rejouées à capital fixe : sur best v2, la reconstruction rendait 39,6 % de
  // CAGR et 20,2 % de drawdown quand le livre sert 70,9 % et 27,2 %. La réingestion
  // nocturne écrasait la correction sans rien signaler, et c'est le RISQUE qu'elle
  // minorait. A stale book curve paired with newer metrics is rejected rather than
  // being presented as a coherent same-run snapshot.
  try {
    if (fs.existsSync(outPath)) {
      const prev = JSON.parse(fs.readFileSync(outPath, 'utf8'));
      if (prev && prev.rejectedServedSnapshot) out.rejectedServedSnapshot = prev.rejectedServedSnapshot;
      const coherence = bookSnapshotCoherence(prev, {
        expectedPortfolio: out.portfolioId,
        expectedClose: out.decisionProvenance && out.decisionProvenance.expectedDataDate,
      });
      if (prev && prev.metricsSource === 'book_served_stats' && prev.metrics && coherence.ok) {
        out.metrics = prev.metrics;
        out.metricsSource = prev.metricsSource;
        // La courbe ET SA PROVENANCE. Ne préserver que `equity` laissait tomber
        // `equityResolution`/`equitySource` à chaque ré-ingestion nocturne — or gen-api teste
        // `equityResolution === 'daily'` pour publier la courbe DU LIVRE. Sans eux il retombait sur
        // la branche de repli et republiait l'avertissement « ceci est la courbe de la poche, ne
        // recalculez pas le drawdown » sur une courbe qui EST celle du livre. Une donnée conservée
        // sans son étiquette de provenance redevient une donnée non identifiée.
        if (prev.equity) out.equity = prev.equity;
        if (prev.equityResolution) out.equityResolution = prev.equityResolution;
        if (prev.equitySource) out.equitySource = prev.equitySource;
        if (prev.equityVerifiedAt) out.equityVerifiedAt = prev.equityVerifiedAt;
        if (prev.bookSnapshot) out.bookSnapshot = prev.bookSnapshot;
      } else if (prev && prev.metricsSource === 'book_served_stats' && prev.metrics) {
        out.rejectedServedSnapshot = {
          reason: 'book snapshot failed same-vintage curve/metric provenance checks; fresh MCP replay published instead',
          errors: coherence.errors,
          served_max_dd_pct: Number(prev?.metrics?.max_dd_pct),
          curve_max_dd_pct: coherence.curveMaxDd == null ? null : Math.round(coherence.curveMaxDd * 100) / 100,
          served_cagr_pct: Number(prev?.metrics?.cagr_pct),
          curve_cagr_pct: coherence.curveCagr == null ? null : Math.round(coherence.curveCagr * 100) / 100,
          prior_equity_source: prev.equitySource || null,
          rejected_at: new Date().toISOString(),
        };
      }
    }
  } catch (_) { /* staging illisible : on écrit la version fraîche */ }
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
}

/**
 * POINT-IN-TIME staging path (idea #8 : end_date dans la clé).
 *
 * LIVE (nightly, forward) → data/dtx/<id>.json (INCHANGÉ — c'est ce que gen-status-page lit).
 * PIT / RÉTRO ({pit:true}) → data/dtx/<id>@<asof>.json — une ENTRÉE DÉDIÉE par as-of, pour qu'un
 *   replay historique (rétro) n'ÉCRASE PAS la staging live du mode (et réciproquement). La clé
 *   encode l'as-of exactement comme price-cache.js encode la date dans le chemin : chaque date =
 *   snapshot isolé, jamais de collision live↔rétro.
 * Sans {pit} → chemin live, quel que soit l'as-of (zéro régression sur le pipeline nocturne).
 */
function stagingPathFor(portfolioId, { asof = null, pit = false } = {}) {
  const id = String(portfolioId);
  if (pit && asof) return path.join(STAGING_DIR, `${id}@${String(asof).slice(0, 10)}.json`);
  return path.join(STAGING_DIR, `${id}.json`);
}

// ---------------------------------------------------------------------------
// Staging freshness helper — used by the pipeline guard (publish-daily-card.sh Step 4d) and here.
// ---------------------------------------------------------------------------
/** Inspect a mode's committed staging. Returns {exists, engineMode, generatedAt, fresh} where
 *  fresh = engineMode:"mcp" AND generatedAt is today (UTC). Never throws. */
function stagingSnapshotErrors(snapshot, portfolioId, { todayIso, scanDateIso, expectedClose } = {}) {
  const errors = [];
  const today = todayIso || new Date().toISOString().slice(0, 10);
  const generated = String(snapshot && snapshot.generatedAt || '').slice(0, 10);
  const provenance = snapshot && snapshot.decisionProvenance || {};
  if (!snapshot || snapshot.engineMode !== 'mcp') errors.push('engineMode must be mcp');
  if (generated !== today) errors.push(`generatedAt ${generated || 'missing'} != ${today}`);
  if (snapshot && snapshot.portfolioId !== portfolioId) errors.push(`portfolioId ${snapshot.portfolioId || 'missing'} != ${portfolioId}`);
  if (scanDateIso && snapshot && snapshot.asof !== scanDateIso) errors.push(`asof ${snapshot.asof || 'missing'} != ${scanDateIso}`);
  if (provenance.contractVersion !== '2.0') errors.push('Contract V2 provenance missing');
  if (scanDateIso && provenance.requestedAsOf !== scanDateIso) errors.push(`requestedAsOf ${provenance.requestedAsOf || 'missing'} != ${scanDateIso}`);
  if (scanDateIso && !expectedClose) errors.push('certified scanner reference close is missing');
  if (!provenance.expectedDataDate || provenance.expectedDataDate !== provenance.dataAsOf) errors.push('expectedDataDate/dataAsOf mismatch');
  if (expectedClose && provenance.expectedDataDate !== expectedClose) errors.push(`expectedDataDate ${provenance.expectedDataDate || 'missing'} != ${expectedClose}`);
  const failClosed = snapshot && snapshot.actionable === false;
  if (failClosed) {
    const fault = snapshot.invalidDecision || {};
    if (!Array.isArray(snapshot.orders) || snapshot.orders.length !== 0) errors.push('fail-closed staging orders must be empty');
    if (snapshot.executionPlan != null) errors.push('fail-closed staging executionPlan must be null');
    if (snapshot.failureMode !== 'fail_closed') errors.push('fail-closed staging failureMode missing');
    if (fault.code !== 'IDEMPOTENCY_FINGERPRINT_CONFLICT') errors.push('fail-closed staging invalidDecision.code unsupported');
    if (typeof fault.message !== 'string' || !fault.message.trim()) errors.push('fail-closed staging invalidDecision.message missing');
    if (typeof fault.sourceArtifact !== 'string' || !fault.sourceArtifact.trim()) errors.push('fail-closed staging invalidDecision.sourceArtifact missing');
    if (!provenance.requestId) errors.push('fail-closed staging requestId missing');
    if (provenance.runId || provenance.callId || provenance.planId) errors.push('fail-closed staging must not invent run/call/plan identifiers');
  } else if (!provenance.requestId || !provenance.runId || !provenance.callId || !provenance.planId) {
    errors.push('decision provenance identifiers missing');
  }
  return errors;
}

function stagingStatus(portfolioId, todayIso, expectations = {}) {
  const today = todayIso || new Date().toISOString().slice(0, 10);
  const p = path.join(STAGING_DIR, `${portfolioId}.json`);
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    const gen = String(j.generatedAt || '').slice(0, 10);
    const errors = stagingSnapshotErrors(j, portfolioId, { ...expectations, todayIso: today });
    return { exists: true, engineMode: j.engineMode || null, generatedAt: gen, fresh: errors.length === 0, errors };
  } catch (_) {
    return { exists: false, engineMode: null, generatedAt: null, fresh: false, errors: ['staging missing or invalid'] };
  }
}

function inferScannerReferenceClose(scanDateIso) {
  const folder = String(scanDateIso || '').replace(/-/g, '');
  if (!/^20\d{6}$/.test(folder)) return null;
  for (const subdir of ['_dtx', '_data', '_data2']) {
    try {
      const harness = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'scanner', folder, subdir, 'harness.json'), 'utf8'));
      if (harness.reference_close) return harness.reference_close;
    } catch (_) { /* try next certified harness */ }
  }
  return null;
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
  const expectedClose = inferScannerReferenceClose(scanDateIso);
  const modes = {};
  const generated = [];
  const skipped = [];
  for (const id of SCRIPTED_MODES) {
    let s;
    try { s = stagingStatus(id, today, { scanDateIso, expectedClose }); } catch (_) { s = { exists: false, engineMode: null, generatedAt: null, fresh: false, errors: ['status exception'] }; }
    let status;
    if (s.fresh) { status = 'fresh'; generated.push(id); }
    else if (s.exists) { status = 'stale'; skipped.push(id); }
    else { status = 'missing'; skipped.push(id); }
    modes[id] = { status, engineMode: s.engineMode, generatedAt: s.generatedAt, fresh: !!s.fresh, errors: s.errors || [] };
    const icon = s.fresh ? '✅ fresh' : (s.exists ? '⚠️  STALE' : '❌ MISSING');
    console.log(`  [${id}] ${icon} (engineMode:${s.engineMode || '—'}, generatedAt:${s.generatedAt || '—'})`);
  }
  const complete = skipped.length === 0;
  const marker = {
    scanDate: scanDateIso || null,
    expectedClose,
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

  // Any actual --mode/--all "scan": the binary is gone. This compatibility CLI
  // does not refresh staging; downstream completeness remains a hard blocker.
  const targets = opts.all ? SCRIPTED_MODES : (opts.mode ? [opts.mode] : []);
  console.warn('⚠️  dtx-scan: the local dtx binary + data bundle have been REMOVED (2026-07-08 cut-over).');
  console.warn('⚠️  dtx-scan: this tool no longer produces staging. The hosted dtx MCP is the SOLE engine.');
  console.warn('⚠️  dtx-scan: use scan-parallel.sh for token-scoped DtxDecide/DtxReplay collection and staging.');
  console.warn('⚠️  dtx-scan: for a manual authenticated-agent capture, write raw JSON then run:');
  console.warn('⚠️      node tools/dtx-mcp-ingest.js --portfolio <id> --decide <f> --replay <f> --asof <J+1> --expected-close <REF>');
  if (targets.length) {
    console.warn(`⚠️  dtx-scan: requested mode(s) [${targets.join(', ')}] — the pipeline will READ the`);
    console.warn('⚠️      committed staging (data/dtx/<id>.json) as-is. Incomplete/stale staging blocks downstream publication.');
  }
  // Exit 0 only means this deprecated compatibility command did not execute.
  // downstream-split and the completeness marker decide whether publication is allowed.
  process.exit(0);
}

if (require.main === module) main();

module.exports = {
  discoverModes, stagingSnapshotErrors, stagingStatus, writeStagingCompleteness, COMPLETENESS_MARKER, SCRIPTED_MODES,
  // Shared schema surface — reused by tools/dtx-mcp-ingest.js so the MCP path is byte-compatible.
  buildStaging, writeStaging, stagingPathFor, extractReplayMetrics, assertReplaySanity, mapOrder, sleeveIndex,
  bookSnapshotCoherence,
  validateDecisionV2, rankOneOrdersFromV2, goLiveFor,
  DEFAULT_FROM, STAGING_DIR, CONFIG_DIR, REPO_ROOT, PORTFOLIO_TO_MODE,
};
