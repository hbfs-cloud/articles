#!/usr/bin/env node
/**
 * gen-api.js — Portfolio endpoint generator (multi-mode)
 * Reads the latest scanner status snapshot and writes flat JSON to portfolio/v1/
 * Outputs per-mode endpoints in portfolio/v1/{mode}/ for all modes (read dynamically from data/modes-config.json).
 * Root portfolio/v1/ endpoints point to balanced mode (backward compat).
 *
 * Usage: node tools/gen-api.js
 */

const fs = require('fs');
const path = require('path');
const ms = require('./lib/mode-status');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'portfolio', 'v1');
// Resolved trade statuses (same set the frozen stats use) — defined early because
// reconcileStoppedMode() runs in the main loop and calls computeStreaks() before the
// original definition site would execute (const TDZ). Excludes pending + liquidated.
const STREAK_RESOLVED = new Set(['tp1', 'tp1_partial', 'tp2', 'sl', 'expired', 'rotated', 'breakeven', 'trail']);
const HISTORY = path.join(ROOT, 'scanner', 'status', 'history');
const STATUS_HISTORY_PATH = path.join(ROOT, 'data', 'modes-status-history.json');

function parsePrice(s) {
  if (s == null || s === '—' || s === '') return null;
  const n = parseFloat(String(s).replace(/[$,]/g, ''));
  return isNaN(n) ? null : n;
}

fs.mkdirSync(OUT, { recursive: true });

// Load modes-config for version/regime metadata
const MODES_CFG_PATH = path.join(ROOT, 'data', 'modes-config.json');
let modesConfigMeta = {};
let modesConfigFull = null;
if (fs.existsSync(MODES_CFG_PATH)) {
  const mc = JSON.parse(fs.readFileSync(MODES_CFG_PATH, 'utf8'));
  modesConfigMeta = { configVersion: mc._version || null, regime: mc._regime || null };
  modesConfigFull = mc;
}

// Load risk snapshot (VaR / stress / regime-prob / correlations).
// Populated by tools/refresh-risk-metrics.js. Missing file = no-op.
const RISK_SNAP_PATH = path.join(ROOT, 'data', 'risk-snapshots.json');
let riskSnap = {};
if (fs.existsSync(RISK_SNAP_PATH)) {
  try { riskSnap = JSON.parse(fs.readFileSync(RISK_SNAP_PATH, 'utf8')) || {}; }
  catch (e) { console.log('  [warn] risk-snapshots.json unreadable, skipping risk fields'); riskSnap = {}; }
}

// Load broker-instruments map (build-broker-map.js). Missing file = no-op.
const BROKER_MAP_PATH = path.join(ROOT, 'data', 'broker-instruments.json');
let brokerMap = null;
if (fs.existsSync(BROKER_MAP_PATH)) {
  try { brokerMap = JSON.parse(fs.readFileSync(BROKER_MAP_PATH, 'utf8')) || null; }
  catch (e) { console.log('  [warn] broker-instruments.json unreadable, skipping broker fields'); brokerMap = null; }
}
function getBrokersFor(ticker) {
  if (!brokerMap || !brokerMap.symbols) return null;
  const entry = brokerMap.symbols[ticker];
  if (!entry) return null;
  return Object.keys(entry.brokers);
}
function getBrokerSymbols(ticker) {
  if (!brokerMap || !brokerMap.symbols) return null;
  const entry = brokerMap.symbols[ticker];
  if (!entry) return null;
  const out = {};
  for (const [broker, info] of Object.entries(entry.brokers)) {
    out[broker] = { symbol: info.symbol, tradable: info.tradable };
    if (info.uic) out[broker].uic = info.uic;
    if (info.isin) out[broker].isin = info.isin;
    if (info.currency) out[broker].currency = info.currency;
  }
  return out;
}

// Load SPY benchmark (fetch-bench-spy.js). Missing file = no-op.
const BENCH_SPY_PATH = path.join(ROOT, 'data', 'bench-spy.json');
let benchSpy = null;
if (fs.existsSync(BENCH_SPY_PATH)) {
  try { benchSpy = JSON.parse(fs.readFileSync(BENCH_SPY_PATH, 'utf8')) || null; }
  catch (e) { console.log('  [warn] bench-spy.json unreadable, skipping bench fields'); benchSpy = null; }
}
function getRiskFor(modeId) {
  const haveSnap = riskSnap && Object.keys(riskSnap).length > 0;
  if (!haveSnap) return { status: 'pending', reason: 'risk-snapshots.json absent — run tools/refresh-risk-metrics.js' };
  const r = (riskSnap.modes || {})[modeId];
  if (!r) return { status: 'unavailable', reason: `mode "${modeId}" missing from snapshot` };
  if (r.reason === 'no_positions') return { status: 'no_positions', asOf: r.asOf || null };
  return {
    status: 'ok',
    asOf: r.asOf || riskSnap.asOf || null,
    var95_5d: r.var95_5d != null ? r.var95_5d : null,
    var99_5d: r.var99_5d != null ? r.var99_5d : null,
    expectedShortfall95_5d: r.expectedShortfall95_5d != null ? r.expectedShortfall95_5d : null,
    portfolioValueUsd: r.portfolioValueUsd != null ? r.portfolioValueUsd : null,
    stressScenarios: r.stressScenarios || [],
    regimeProbability: riskSnap.regimeProbability || null,  // shared market-level signal
    maxPairwiseCorrelation: r.maxPairwiseCorrelation != null ? r.maxPairwiseCorrelation : null,
    avgCorrelation: r.avgCorrelation != null ? r.avgCorrelation : null,
    method: r.method || 'historical',
  };
}
function getGlobalRegime() {
  if (!riskSnap.regimeProbability) return { status: 'pending', reason: 'no regime probability in snapshot' };
  return { status: 'ok', ...riskSnap.regimeProbability };
}

function getStatusFor(modeId) {
  const m = (modesConfigFull && modesConfigFull.modes && modesConfigFull.modes[modeId]) || {};
  const state = ms.isValidState(m.status) ? m.status : ms.DEFAULT_STATE;
  return ms.statusBlock(state, m.statusSince || null, m.statusReason || null, m.statusNextReviewAt || null);
}

function write(filename, content) {
  const outPath = path.join(OUT, filename);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(content, null, 2));
  console.log(`  [ok]   ${path.relative(ROOT, outPath)}`);
}

// A stopped/liquidated mode holds nothing: positions.json is already 0 (posFor returns []),
// so any still-open (pending) trade surfaced as "open" in trades.json is a self-contradiction.
// Transition such a trade to a terminal 'liquidated' close at its LAST MARK — exitDate = the
// stop date (statusSince), exitPrice/pnlPct preserved (the mark-to-market IS the realistic
// exit when the mode was pulled). This is a legitimate pending→closed state change, NOT a
// rewrite of sealed history: backtest-trades.json and the immutable trade-chain (SHA) are
// never touched (they carry no pending rows for stopped modes). Non-pending trades pass through
// unchanged, so realized P&L / win-rate / DD of the track record are preserved byte-for-byte.
function liquidatePending(t, sinceISO) {
  if (!t || (t.status !== 'pending' && t.status !== 'open')) return t;
  return {
    ...t,
    status: 'liquidated',
    exitDate: t.exitDate || sinceISO || t.entryDate || t.scanDate || null,
    exitPrice: t.exitPrice != null ? t.exitPrice : (t.actualEntry != null ? t.actualEntry : t.entry ?? null),
    exitTime: t.exitTime || '16:00',
  };
}

// Find latest snapshot
const snapshots = fs.readdirSync(HISTORY).filter(f => /^\d{8}\.json$/.test(f)).sort();
if (!snapshots.length) {
  console.error('  [err]  No snapshots found in scanner/status/history/');
  process.exit(1);
}
const latestFile = path.join(HISTORY, snapshots[snapshots.length - 1]);
const snap = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
const now = new Date().toISOString();
const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })
  .format(new Date()).replace(/-/g, '');
const scanDir = snap.scanDir || '';
const nextBizDay = (() => {
  const d = new Date(todayKey.slice(0,4) + '-' + todayKey.slice(4,6) + '-' + todayKey.slice(6) + 'T12:00:00Z');
  do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
  return d.toISOString().slice(0,10).replace(/-/g, '');
})();
const ordersStale = scanDir !== todayKey && scanDir !== nextBizDay;

console.log(`  Source: ${path.relative(ROOT, latestFile)} (${snap.date})${ordersStale ? ` [orders stale: scanDir=${scanDir} != today=${todayKey}]` : ''}`);

// ─── T2: coherence guard (equity.json ⇄ frozen source of truth) ──────────────
// gen-api copies mode.stats / mode.equity from the daily snapshot, which already
// carries the SEALED (frozen) curve — so the API is coherent with the dashboard by
// construction. This guard makes that coherence VERIFIABLE: for every mode that has
// a frozen entry in data/backtest-results.json (frozenMeaningful=true), it asserts
// equity.json.stats.ret == frozen_<mode>.returnTotal AND equity.json.equityCurve's
// last point == frozen_<mode>.equityCurve's last point (0.01 tolerance). A divergence
// is logged as a clear warning — never fatal. Modes with no frozen entry are "fresh"
// (frozenMeaningful=false): their stats come from computeStatsFromTrades of their own
// trades and there is nothing sealed to check against, so they are skipped.
let _modeStatsLib = null;
try { _modeStatsLib = require('./lib/mode-stats'); } catch (_) { _modeStatsLib = null; }
let _frozenResults = null;
try {
  _frozenResults = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'backtest-results.json'), 'utf8'));
} catch (_) { _frozenResults = null; }
const coherenceReport = { checked: 0, ok: 0, warnings: 0, skipped: 0, details: [] };
const COH_TOL = 0.01;

function verifyEquityCoherence(modeId, stats, equity) {
  // Guard only arms when the shared accounting lib AND the frozen results are both present.
  if (!_modeStatsLib || typeof _modeStatsLib.computeStatsFromTrades !== 'function' || !_frozenResults) {
    coherenceReport.skipped++;
    return;
  }
  const frozen = _frozenResults[`frozen_${modeId}`];
  if (!frozen) {
    // Fresh mode (frozenMeaningful=false) — nothing sealed to check against.
    coherenceReport.skipped++;
    coherenceReport.details.push({ mode: modeId, status: 'no-frozen' });
    return;
  }
  coherenceReport.checked++;
  const problems = [];

  // (1) returnTotal — snapshot stats.ret vs frozen.returnTotal
  const apiRet = stats && typeof stats.ret === 'number' ? stats.ret : null;
  const frozenRet = typeof frozen.returnTotal === 'number' ? frozen.returnTotal : null;
  if (apiRet === null || frozenRet === null) {
    problems.push(`ret unavailable (api=${apiRet}, frozen=${frozenRet})`);
  } else if (Math.abs(apiRet - frozenRet) > COH_TOL) {
    problems.push(`ret ${apiRet} != frozen.returnTotal ${frozenRet} (Δ=${(apiRet - frozenRet).toFixed(2)})`);
  }

  // (2) equityCurve last point — snapshot equity is {d:[…], v:[…]}, frozen is [{date,value}]
  const apiLastV = equity && Array.isArray(equity.v) && equity.v.length ? equity.v[equity.v.length - 1] : null;
  const fEC = Array.isArray(frozen.equityCurve) ? frozen.equityCurve : [];
  const fLast = fEC.length ? fEC[fEC.length - 1] : null;
  const frozenLastV = fLast && typeof fLast.value === 'number' ? fLast.value : null;
  if (apiLastV === null || frozenLastV === null) {
    problems.push(`equityCurve tail unavailable (api=${apiLastV}, frozen=${frozenLastV})`);
  } else if (Math.abs(apiLastV - frozenLastV) > COH_TOL) {
    problems.push(`equityCurve last ${apiLastV} != frozen ${frozenLastV} (Δ=${(apiLastV - frozenLastV).toFixed(2)})`);
  }

  if (problems.length) {
    coherenceReport.warnings++;
    coherenceReport.details.push({ mode: modeId, status: 'divergence', problems });
    console.warn(`  [warn] [coherence] "${modeId}" equity.json diverges from frozen_${modeId}: ${problems.join('; ')}`);
  } else {
    coherenceReport.ok++;
    coherenceReport.details.push({ mode: modeId, status: 'ok', ret: apiRet, lastV: apiLastV });
  }
}

// ─── Helper: write all 7 endpoints for a mode ─────────────────────────────────
function writeMode(mode, prefix) {
  const p = prefix ? `${prefix}/` : '';
  const status = getStatusFor(prefix || 'balanced');
  const modeId = prefix || 'balanced';

  // Stopped/liquidated modes hold nothing: terminalize any pending trade so trades.json's open
  // count matches positions.json (0). posFor() already empties positions upstream; this keeps the
  // two endpoints consistent when a mode is stopped while still present in the current snapshot.
  const isTerminalMode = status.state === 'stopped' || status.state === 'liquidated';
  const _sinceISO = (((modesConfigFull && modesConfigFull.modes && modesConfigFull.modes[modeId]) || {}).statusSince || '').slice(0, 10) || null;
  // Trade History (trades.json / all.json#closedTrades) = CLOSED trades ONLY. A genuinely-open
  // trade (status 'pending' or no exitDate) is surfaced via positions.json / all.json#positions —
  // it must NOT also appear in the closed-trade ledger (that produced the "open leaks into Trade
  // History" bug). Terminal modes (stopped/liquidated) hold nothing → liquidatePending() realizes
  // any still-open trade so the closed ledger and positions (0) stay consistent.
  const _isOpenTrade = t => t.status === 'pending' || !t.exitDate;
  const closedTradesSrc = isTerminalMode
    ? (mode.closedTrades || []).map(t => liquidatePending(t, _sinceISO))
    : (mode.closedTrades || []).filter(t => !_isOpenTrade(t));

  const positions = mode.positions || [];
  const equity = mode.equity || {};

  // High-conviction candlestick gate (Bull): signals require a >= Nx volume spike on the signal
  // day's close (parity systematic-tss). Surface the condition in the API so consumers understand
  // why a quiet day yields 0 signals — and never auto-place an unconfirmed candlestick order.
  const _modeCfgFull = (modesConfigFull && modesConfigFull.modes && modesConfigFull.modes[modeId]) || {};
  const _highConviction = _modeCfgFull.preSignal === true;
  let _candleVolGate = 8.0;
  try { const _sf = require(path.join(ROOT, 'data', 'scanner-filters.json')); if (_sf.candlestick?.min_vol_ratio_trading) _candleVolGate = _sf.candlestick.min_vol_ratio_trading; } catch (_) {}
  const _entryCondition = _highConviction
    ? { type: 'volume_spike_confirmation', min_vol_ratio: _candleVolGate, measured_on: 'signal_day_close_vs_20d_avg', note: `High-conviction: only candlestick patterns with a >= ${_candleVolGate}x close-volume spike on the signal day become tradeable. Quiet days legitimately yield 0 signals (parity with systematic-tss americanbull trading config).` }
    : null;

  // 1. signals.json
  write(`${p}signals.json`, {
    updatedAt: now, date: snap.date, scanDate: scanDir, mode: prefix || 'balanced',
    status,
    ...(_entryCondition ? { entry_condition: _entryCondition } : {}),
    signals: (mode.signals || []).map(s => ({
      ticker: s.ticker, score: s.score, strategy: s.strategy,
      entry: parsePrice(s.entry), stop: parsePrice(s.stop),
      tp1: parsePrice(s.tp1), tp2: parsePrice(s.tp2), rr: s.rr,
      sharia: s.sharia != null ? s.sharia : null,
      ...(_highConviction ? { signal_state: (s.pattern && s.pattern.volRatio >= _candleVolGate) ? 'confirmed_volume_spike' : 'pending_volume_confirmation' } : {}),
      thesis: s.thesis || '',
      brokers: getBrokersFor(s.ticker),
      broker_symbols: getBrokerSymbols(s.ticker),
    }))
  });

  // 2. positions.json
  const portfolioSize = (mode.config || {}).portfolioSize || 1;
  const positionSizePct = (mode.config || {}).positionSizePct || 1;
  const allocPct = Math.round(100 / portfolioSize * positionSizePct);
  write(`${p}positions.json`, {
    updatedAt: now, date: snap.date, mode: prefix || 'balanced',
    status,
    allocPct,
    positions: positions.map(p => {
      const entry = p.entry || 0;
      const stop = p.stop || 0;
      // riskPct = % loss IF stop hits (per-trade). Use riskPctOfPortfolio for portfolio-level exposure.
      const riskPct = entry > 0 && stop > 0 ? +((entry - stop) / entry * 100).toFixed(2) : 0;
      const riskPctOfPortfolio = +((riskPct * allocPct) / 100).toFixed(3);
      return {
        ticker: p.ticker, entry, currentPrice: p.current_price,
        returnPct: p.return_pct, score: p.score || 0,
        stop, tp1: p.tp1 || null, tp2: p.tp2 || null,
        riskPct,                  // % loss per-trade if stop hits
        riskPctOfPortfolio,       // % of total portfolio at risk on this position
        allocPct,
        scanDate: p.scan_date, daysRemaining: p.days_remaining,
        broker_symbols: getBrokerSymbols(p.ticker),
      };
    })
  });

  // 3. trades.json
  write(`${p}trades.json`, {
    updatedAt: now, mode: prefix || 'balanced',
    status,
    configVersion: modesConfigMeta.configVersion,
    regime: modesConfigMeta.regime,
    trades: closedTradesSrc.map(t => ({
      ticker: t.ticker, scanDate: t.scanDate, entryDate: t.entryDate,
      exitDate: t.exitDate || null,
      entry: t.actualEntry, exitPrice: t.exitPrice, pnlPct: t.pnlPct,
      holdDays: t.holdDays, status: t.status, strategy: t.strategy,
      entryTime: t.entryTime || null, exitTime: t.exitTime || null,
      replayEntry: t.replayEntry || null, replayExit: t.replayExit || null,
      replayPnlPct: t.replayPnlPct != null ? t.replayPnlPct : null,
      replayStatus: t.replayStatus || null,
      configVersion: t.configVersion || null
    }))
  });

  // 4. equity.json (with reliability disclosures)
  // Compute sample period from equity curve (first → last data point).
  const ec = equity && Array.isArray(equity.d) ? equity : null;
  let samplePeriodDays = null, samplePeriodStart = null, samplePeriodEnd = null;
  if (ec && ec.d.length >= 2) {
    samplePeriodStart = ec.d[0];
    samplePeriodEnd = ec.d[ec.d.length - 1];
    try {
      // Dates are like "MM/DD" — parse with current year
      const yr = new Date().getFullYear();
      const ds = new Date(`${yr}-${samplePeriodStart}T00:00:00Z`);
      const de = new Date(`${yr}-${samplePeriodEnd}T00:00:00Z`);
      samplePeriodDays = Math.round((de - ds) / 86400000);
    } catch {}
  }
  const tradesN = ((mode.stats || {}).trades) || 0;
  const oosWarn = (mode.stats || {}).oosWarn || null;
  const reliability = {
    sample_period_days: samplePeriodDays,
    sample_period_start: samplePeriodStart,
    sample_period_end: samplePeriodEnd,
    closed_trades: tradesN,
    statistically_reliable: tradesN >= 30,
    pf_reliable: ((mode.stats || {}).pfReliable) === true,
    pf_low: (mode.stats || {}).pfLow ?? null,
    pf_high: (mode.stats || {}).pfHigh ?? null,
    out_of_sample_warning: oosWarn,
    warnings: [
      ...(samplePeriodDays !== null && samplePeriodDays < 90 ? [`Sample period only ${samplePeriodDays} days (${(samplePeriodDays/7).toFixed(1)} weeks). Statistical significance limited.`] : []),
      ...(tradesN < 30 ? [`Only ${tradesN} closed trades (need n≥30 for reliable WR/PF inference).`] : []),
      ...(((mode.stats || {}).pfReliable) === false ? ['Profit Factor below n=50 reliability threshold — bootstrapped 90% CI in pf_low / pf_high.'] : []),
      ...(oosWarn ? [`Out-of-sample degradation: IS WR ${oosWarn.isWR}% / PF ${oosWarn.isPF}x → OOS WR ${oosWarn.oosWR}% / PF ${oosWarn.oosPF}x (n=${oosWarn.oosTrades}). Treat in-sample stats as overfit-prone.`] : []),
      'No bear-market test (2022 / 2020 type) included — system inception was 2026-02-26.',
    ],
  };
  write(`${p}equity.json`, {
    updatedAt: now, mode: prefix || 'balanced',
    status,
    config: mode.config || {}, stats: mode.stats || {},
    reliability,
    equityCurve: equity || {},
  });

  // T2 coherence guard — cross-check the just-written equity.json against the frozen seal.
  // Only for the real per-mode pass (prefix truthy); the root copy (= balanced) is byte-identical
  // and already verified in the loop, so skipping it avoids double-counting.
  if (prefix) verifyEquityCoherence(modeId, mode.stats || {}, equity || {});

  // 5. orders.json — orders only valid on scan date
  // Modes that do not accept new entries (paused, stopped, pausing, liquidated, draft) emit empty orders.
  const ordersAllowed = status.acceptsNewEntries;
  const modeOrders = (!ordersAllowed || ordersStale) ? [] : (mode.orders || []).map(o => ({
    ticker: o.ticker, action: o.action || 'BUY', score: o.score, strategy: o.strategy,
    entry: parsePrice(o.entry), stop: parsePrice(o.stop), tp1: parsePrice(o.tp1), tp2: parsePrice(o.tp2), rr: o.rr,
    sharia: o.sharia != null ? o.sharia : null,
    allocPct, replaces: o.replaces || null, scoreDelta: o.scoreDelta || null,
    thesis: o.thesis || '',
    broker_symbols: getBrokerSymbols(o.ticker),
  }));
  write(`${p}orders.json`, {
    updatedAt: now, date: snap.date, scanDate: scanDir, mode: prefix || 'balanced',
    status,
    allocPct, orders: modeOrders
  });

  // 6. actions.json
  write(`${p}actions.json`, {
    updatedAt: now, date: snap.date, mode: prefix || 'balanced',
    status,
    closeNow: (mode.closeNow || []).map(p => ({
      ticker: p.ticker, scanDate: p.scan_date, entry: p.entry,
      currentPrice: p.current_price, returnPct: p.return_pct,
      daysHeld: p.days_held, horizon: p.horizon,
      broker_symbols: getBrokerSymbols(p.ticker),
    })),
    expiresTomorrow: (mode.expiresTomorrow || []).map(p => ({
      ticker: p.ticker, entry: p.entry, returnPct: p.return_pct,
      stop: p.stop, daysHeld: p.days_held, horizon: p.horizon,
      broker_symbols: getBrokerSymbols(p.ticker),
    }))
  });

  // 7. all.json
  write(`${p}all.json`, {
    updatedAt: now, date: snap.date, scanDate: scanDir, mode: prefix || 'balanced',
    status,
    config: mode.config || {}, stats: mode.stats || {},
    equityCurve: equity || {},
    signals: (mode.signals || []).map(s => ({
      ticker: s.ticker, score: s.score, strategy: s.strategy,
      entry: parsePrice(s.entry), stop: parsePrice(s.stop),
      tp1: parsePrice(s.tp1), tp2: parsePrice(s.tp2), rr: s.rr,
      sharia: s.sharia != null ? s.sharia : null,
      thesis: s.thesis || '',
      brokers: getBrokersFor(s.ticker),
      broker_symbols: getBrokerSymbols(s.ticker),
    })),
    orders: modeOrders,
    positions: positions.map(p => {
      const entry = p.entry || 0;
      const stop = p.stop || 0;
      const riskPct = entry > 0 && stop > 0 ? +((entry - stop) / entry * 100).toFixed(2) : 0;
      const riskPctOfPortfolio = +((riskPct * allocPct) / 100).toFixed(3);
      return {
        ticker: p.ticker, entry, currentPrice: p.current_price,
        returnPct: p.return_pct, score: p.score || 0,
        stop, tp1: p.tp1 || null, tp2: p.tp2 || null,
        riskPct,                  // % loss per-trade if stop hits
        riskPctOfPortfolio,       // % of total portfolio at risk on this position
        allocPct,
        scanDate: p.scan_date, daysRemaining: p.days_remaining,
        broker_symbols: getBrokerSymbols(p.ticker),
      };
    }),
    closeNow: (mode.closeNow || []).map(p => ({
      ticker: p.ticker, scanDate: p.scan_date, entry: p.entry,
      currentPrice: p.current_price, returnPct: p.return_pct,
      daysHeld: p.days_held, horizon: p.horizon,
      broker_symbols: getBrokerSymbols(p.ticker),
    })),
    expiresTomorrow: (mode.expiresTomorrow || []).map(p => ({
      ticker: p.ticker, entry: p.entry, returnPct: p.return_pct,
      stop: p.stop, daysHeld: p.days_held, horizon: p.horizon,
      broker_symbols: getBrokerSymbols(p.ticker),
    })),
    closedTrades: closedTradesSrc.map(t => ({
      ticker: t.ticker, scanDate: t.scanDate, entryDate: t.entryDate,
      exitDate: t.exitDate || null,
      entry: t.actualEntry, exitPrice: t.exitPrice, pnlPct: t.pnlPct,
      holdDays: t.holdDays, status: t.status, strategy: t.strategy,
      entryTime: t.entryTime || null, exitTime: t.exitTime || null,
      replayEntry: t.replayEntry || null, replayExit: t.replayExit || null,
      replayPnlPct: t.replayPnlPct != null ? t.replayPnlPct : null,
      replayStatus: t.replayStatus || null,
      configVersion: t.configVersion || null
    })),
    risk: getRiskFor(prefix || 'balanced'),
  });

  // 8. risk.json — VaR, stress scenarios, regime probability, correlations.
  // Standalone endpoint so consumers can poll risk independently.
  // mode.stats.ret = percentage points (e.g. 32.86 = +32.86%)
  const modeReturnTotal = (mode.stats || {}).ret;
  let benchField = null;
  if (benchSpy && benchSpy.stats) {
    // benchSpy.stats.returnTotal is decimal fraction (e.g. 0.045 = 4.5%)
    // modeReturnTotal is percentage points (e.g. 12.5 = +12.5%) → convert to pct points
    const spyReturnPct = benchSpy.stats.returnTotal * 100;
    const alpha = modeReturnTotal != null ? +(modeReturnTotal - spyReturnPct).toFixed(4) : null;
    benchField = {
      spy: {
        returnTotal: benchSpy.stats.returnTotal,
        sharpe: benchSpy.stats.sharpe,
        period: benchSpy.period || null,
        updated_at: benchSpy.updated_at || null,
      },
      alpha,
    };
  }
  // Note for mono-position modes: pairwise correlation requires ≥ 2 symbols.
  const _ps = ((mode.config || {}).portfolioSize) || 1;
  const riskPayload = getRiskFor(prefix || 'balanced');
  const riskNotes = [];
  if (_ps === 1) {
    riskNotes.push('Single-position mode — pairwise correlation N/A (requires ≥ 2 symbols). VaR is per-position only.');
  }
  if (riskPayload && riskPayload.maxPairwiseCorrelation === null && _ps > 1) {
    riskNotes.push('Correlation matrix temporarily unavailable from gateway. VaR/ES values remain valid.');
  }
  write(`${p}risk.json`, {
    updatedAt: now,
    mode: prefix || 'balanced',
    status,
    configVersion: modesConfigMeta.configVersion,
    regime: modesConfigMeta.regime,
    risk: riskPayload,
    notes: riskNotes,
    bench: benchField,
  });
}

// Reconcile the ALREADY-PUBLISHED endpoints of a stopped/liquidated mode that has dropped out
// of the daily snapshot. gen-status-page stops emitting these modes into new snapshots (and
// posFor returns [] anyway), and the main loop below skips modes missing from the snapshot — so
// their published files freeze in whatever state they had on their last live day. That is how
// trades.json keeps stale "pending" rows (tkl 14 / alpha 4 / crypto 1) while positions.json is
// already 0: a permanent self-contradiction that no later run corrects. Here we heal it in place:
// pending → terminal 'liquidated' close at last mark, positions/orders/closeNow emptied. Only the
// published JSON is rewritten (presentation) — backtest-trades.json and the immutable SHA chain
// are never touched. Files already consistent (no pending, empty positions) are left untouched so
// stopped modes that never held anything (forex/metals) produce no diff.
function reconcileStoppedMode(id) {
  const status = getStatusFor(id);
  const sinceISO = (((modesConfigFull && modesConfigFull.modes && modesConfigFull.modes[id]) || {}).statusSince || '').slice(0, 10) || null;
  const dir = path.join(OUT, id);
  let touched = 0;
  const statusStale = j => !j.status || j.status.state !== status.state;
  const rewrite = (fname, mutate) => {
    const fp = path.join(dir, fname);
    if (!fs.existsSync(fp)) return;
    let j;
    try { j = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return; }
    // Rewrite when there is stale content to clear OR the published status block still reflects a
    // prior (pre-stop) state — otherwise leave the file (and its git blob) untouched.
    const cleared = mutate(j);
    if (!cleared && !statusStale(j)) return;
    j.updatedAt = now;
    j.status = status;
    write(`${id}/${fname}`, j);
    touched++;
  };
  const hasOpen = arr => (arr || []).some(t => t.status === 'pending' || t.status === 'open');

  rewrite('trades.json', j => {
    if (!hasOpen(j.trades)) return false;
    j.trades = (j.trades || []).map(t => liquidatePending(t, sinceISO));
    return true;
  });
  rewrite('positions.json', j => {
    if (!(j.positions || []).length) return false;
    j.positions = [];
    return true;
  });
  rewrite('orders.json', j => {
    if (!(j.orders || []).length) return false;
    j.orders = [];
    return true;
  });
  rewrite('actions.json', j => {
    if (!(j.closeNow || []).length && !(j.expiresTomorrow || []).length) return false;
    j.closeNow = [];
    j.expiresTomorrow = [];
    return true;
  });
  rewrite('all.json', j => {
    if (!hasOpen(j.closedTrades) && !(j.positions || []).length && !(j.orders || []).length) return false;
    j.closedTrades = (j.closedTrades || []).map(t => liquidatePending(t, sinceISO));
    j.positions = [];
    j.orders = [];
    return true;
  });
  // winning-streaks was frozen at the mode's last live day (alpha 06-11, tkl 06-10) → stale, and it
  // contradicted the reconciled log (e.g. alpha 0% vs recompute). Recompute from the healed trades
  // (computeStreaks excludes pending + liquidated, so it reflects real resolved outcomes).
  rewrite('winning-streaks.json', j => {
    let tj; try { tj = JSON.parse(fs.readFileSync(path.join(dir, 'trades.json'), 'utf8')); } catch { return false; }
    const fresh = computeStreaks(tj.trades || []);
    const changed = j.totalTrades !== fresh.totalTrades || j.winRate !== fresh.winRate || j.totalWins !== fresh.totalWins;
    Object.assign(j, fresh);
    return changed;
  });
  // Remaining endpoints carry no pending/positions but may still advertise a pre-stop status block.
  // Refresh it only (mutate is a no-op) so the whole mode API consistently reports the stopped state.
  rewrite('signals.json', () => false);
  rewrite('equity.json', () => false);
  rewrite('risk.json', () => false);

  if (touched) console.log(`  [reconcile] stopped mode "${id}": ${touched} endpoint(s) healed (pending→liquidated, positions/orders cleared)`);
  else console.log(`  [ok]   stopped mode "${id}" already consistent`);
}

// ─── Write all modes ────────────────────────────────────────────────────────
// Public API excludes draft modes (config created, never run — e.g. crypto/metals/forex
// not yet operational). stopped modes (tkl/alpha) stay published for their track record.
const NON_PUBLIC_API_STATUSES = new Set(['draft']);
const MODE_IDS = Object.entries(require('../data/modes-config.json').modes)
  .filter(([, cfg]) => !NON_PUBLIC_API_STATUSES.has(cfg.status))
  .map(([id]) => id);
let count = 0;

for (const id of MODE_IDS) {
  const mode = snap.modes[id];
  if (!mode) {
    // Stopped/liquidated modes drop out of the snapshot but keep published files for their track
    // record. Heal any stale pending/positions so the frozen API stays self-consistent (0 open).
    const st = ((modesConfigFull && modesConfigFull.modes && modesConfigFull.modes[id]) || {}).status;
    if (st === 'stopped' || st === 'liquidated') {
      console.log(`\n─── Mode: ${id} (stopped — reconcile published) ───`);
      reconcileStoppedMode(id);
    } else {
      console.log(`  [skip] Mode "${id}" not found in snapshot`);
    }
    continue;
  }
  console.log(`\n─── Mode: ${id} ───`);
  writeMode(mode, id);
  count += 7;
}

// ─── Root endpoints = balanced (backward compat) ───────────────────────────
const balanced = snap.modes.balanced || snap.modes.calmar;
if (balanced) {
  console.log(`\n─── Root (= balanced) ───`);
  writeMode(balanced, '');
  count += 7;
}

// ─── Winning streaks endpoint (computed from trades.json per mode) ──────────
// A "streak" = longest consecutive run of winning trades (TP1 or TP2), sorted chronologically.
// Provides social-proof stats for the API consumers without needing an extra scan pass.
// computeStreaks counts only STREAK_RESOLVED trades (defined near the top): excludes 'pending'/'open'
// (was inflating counts — momentum reported "5 trades, 0% WR" over 5 pending rows) AND 'liquidated'
// (force-close artifact, kept out so stopped-mode streaks match their frozen WR denominator).
function computeStreaks(trades) {
  const sorted = [...(trades || [])]
    .filter(t => t && (t.entryDate || t.scanDate) && STREAK_RESOLVED.has(t.status))
    .sort((a, b) => ((a.entryDate || a.scanDate || '').localeCompare(b.entryDate || b.scanDate || '')));
  let curr = 0, currStart = null, best = 0, bestStart = null, bestEnd = null;
  let totalWins = 0, totalLosses = 0;
  for (const t of sorted) {
    const isWin = t.status === 'tp1' || t.status === 'tp2' || (t.pnlPct || 0) > 0;
    if (isWin) {
      totalWins++;
      if (curr === 0) currStart = t.entryDate || t.scanDate;
      curr++;
      if (curr > best) {
        best = curr;
        bestStart = currStart;
        bestEnd = t.entryDate || t.scanDate;
      }
    } else {
      totalLosses++;
      curr = 0;
    }
  }
  // Current streak (trailing)
  let tail = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const t = sorted[i];
    const isWin = t.status === 'tp1' || t.status === 'tp2' || (t.pnlPct || 0) > 0;
    if (!isWin) break;
    tail++;
  }
  return {
    currentStreak: tail,
    bestStreak: best,
    bestStreakStart: bestStart,
    bestStreakEnd: bestEnd,
    totalWins,
    totalLosses,
    totalTrades: sorted.length,
    winRate: sorted.length ? +((totalWins / sorted.length) * 100).toFixed(1) : 0,
  };
}

const streaksByMode = {};
for (const id of MODE_IDS) {
  const mode = snap.modes[id];
  if (!mode) continue;
  streaksByMode[id] = computeStreaks(mode.closedTrades || []);
  // Also write a per-mode streaks endpoint
  write(`${id}/winning-streaks.json`, {
    updatedAt: now,
    mode: id,
    ...streaksByMode[id],
  });
  count++;
}

// Root winning-streaks.json = balanced (backward compat pattern)
write('winning-streaks.json', {
  updatedAt: now,
  mode: 'balanced',
  ...(streaksByMode.balanced || {}),
  modes: streaksByMode,
});
count++;

// ─── Summary endpoint: all modes overview ──────────────────────────────────
write('modes.json', {
  updatedAt: now, date: snap.date,
  configVersion: modesConfigMeta.configVersion,
  regime: modesConfigMeta.regime,
  modes: MODE_IDS.filter(id => snap.modes[id]).map(id => {
    const m = snap.modes[id];
    const r = getRiskFor(id);
    return {
      id,
      label: m.config?.label || id,
      color: m.config?.color || '#888',
      status: getStatusFor(id),
      stats: m.stats || {},
      positionCount: (m.positions || []).length,
      orderCount: (m.orders || []).length,
      portfolioSize: m.config?.portfolioSize || 1,
      maxStopPct: m.config?.maxStopPct || 0,
      atrStopMult: m.config?.atrStopMult || 0,
      dailyTrailPct: m.config?.dailyTrailPct || 0,
      breakevenPct: m.config?.breakevenPct || 0,
      partialTP: m.config?.partialTP || false,
      trailingStop: m.config?.trailingStop || false,
      rotation: m.config?.rotation || 'none',
      vwapGate: m.config?.vwapGate || false,
      minScore: m.config?.minScore || 85,
      horizon: m.config?.horizon || 10,
      slotsAvailable: (m.config?.portfolioSize || 1) - (m.positions || []).length,
      // Risk-layer-v1 fields propagated from modes-config
      ddBreakerPct: m.config?.ddBreakerPct || 0,
      sectorCapMax: m.config?.sectorCapMax || 0,
      sizingMethod: m.config?.sizingMethod || null,
      vixKillThreshold: m.config?.vixKillThreshold || 0,
      // Risk snapshot summary (null when refresh-risk-metrics.js hasn't run yet)
      risk: r ? {
        var95_5d: r.var95_5d, var99_5d: r.var99_5d,
        expectedShortfall95_5d: r.expectedShortfall95_5d,
        maxPairwiseCorrelation: r.maxPairwiseCorrelation,
        regimeState: r.regimeProbability?.currentState || null,
        asOf: r.asOf,
      } : null,
    };
  })
});
count++;

// ─── Global regime endpoint (market-wide regime probability) ────────────────
write('regime.json', {
  updatedAt: now,
  configVersion: modesConfigMeta.configVersion,
  regimeLabel: modesConfigMeta.regime,
  regimeProbability: getGlobalRegime(),
});
count++;

// ─── Mode status aggregate (lightweight integrations) ──────────────────────
const allModeIds = (modesConfigFull && modesConfigFull.modes ? Object.keys(modesConfigFull.modes) : MODE_IDS)
  .filter(id => { const c = modesConfigFull && modesConfigFull.modes && modesConfigFull.modes[id]; return !(c && NON_PUBLIC_API_STATUSES.has(c.status)); });
const statusByMode = {};
for (const id of allModeIds) statusByMode[id] = getStatusFor(id);
let recentTransitions = [];
if (fs.existsSync(STATUS_HISTORY_PATH)) {
  try {
    const sh = JSON.parse(fs.readFileSync(STATUS_HISTORY_PATH, 'utf8'));
    recentTransitions = (sh.transitions || []).slice(-20).reverse();
  } catch (e) {
    console.log('  [warn] modes-status-history.json unreadable, skipping recentTransitions');
  }
}
write('status.json', {
  updatedAt: now,
  configVersion: modesConfigMeta.configVersion,
  modes: statusByMode,
  recentTransitions,
});
count++;

// ─── Config history endpoint ─────────────────────────────────────────────────
const CFG_HIST_PATH = path.join(ROOT, 'data', 'modes-config-history.json');
if (fs.existsSync(CFG_HIST_PATH)) {
  const hist = JSON.parse(fs.readFileSync(CFG_HIST_PATH, 'utf8'));
  write('config-history.json', {
    updatedAt: now,
    versions: (hist.versions || []).map(v => ({
      id: v.id,
      timestamp: v.timestamp,
      regime: v.regime || null,
      config: v.config,
    }))
  });
  count++;
}

// ─── Broker instruments endpoint ────────────────────────────────────────────
if (brokerMap) {
  write('instruments.json', brokerMap);
  count++;
}

// ─── T2 coherence summary — equity.json ⇄ frozen source of truth ─────────────
if (coherenceReport.checked > 0 || coherenceReport.warnings > 0) {
  console.log(`\n[coherence] equity.json ⇄ frozen: ${coherenceReport.ok}/${coherenceReport.checked} OK, ${coherenceReport.warnings} divergence(s), ${coherenceReport.skipped} skipped (fresh mode / lib absent).`);
  if (coherenceReport.warnings > 0) {
    console.warn(`  [warn] [coherence] ${coherenceReport.warnings} mode(s) drift from the sealed curve — inspect the warnings above (non-fatal).`);
  }
} else if (!_modeStatsLib || !_frozenResults) {
  console.log(`\n[coherence] guard inactive (${!_modeStatsLib ? 'mode-stats lib' : 'backtest-results.json'} unavailable).`);
}

console.log(`\nDone. ${count} endpoints written to portfolio/v1/ at ${now}`);
