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

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'portfolio', 'v1');
const HISTORY = path.join(ROOT, 'scanner', 'status', 'history');

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

function write(filename, content) {
  const outPath = path.join(OUT, filename);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(content, null, 2));
  console.log(`  [ok]   ${path.relative(ROOT, outPath)}`);
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

// ─── Helper: write all 7 endpoints for a mode ─────────────────────────────────
function writeMode(mode, prefix) {
  const p = prefix ? `${prefix}/` : '';

  // 1. signals.json
  write(`${p}signals.json`, {
    updatedAt: now, date: snap.date, scanDate: scanDir, mode: prefix || 'balanced',
    signals: (mode.signals || []).map(s => ({
      ticker: s.ticker, score: s.score, strategy: s.strategy,
      entry: parsePrice(s.entry), stop: parsePrice(s.stop),
      tp1: parsePrice(s.tp1), tp2: parsePrice(s.tp2), rr: s.rr,
      sharia: s.sharia != null ? s.sharia : null,
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
    allocPct,
    positions: (mode.positions || []).map(p => {
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
    configVersion: modesConfigMeta.configVersion,
    regime: modesConfigMeta.regime,
    trades: (mode.closedTrades || []).map(t => ({
      ticker: t.ticker, scanDate: t.scanDate, entryDate: t.entryDate,
      entry: t.actualEntry, exitPrice: t.exitPrice, pnlPct: t.pnlPct,
      holdDays: t.holdDays, status: t.status, strategy: t.strategy,
      configVersion: t.configVersion || null
    }))
  });

  // 4. equity.json (with reliability disclosures)
  // Compute sample period from equity curve (first → last data point)
  const ec = mode.equity && Array.isArray(mode.equity.d) ? mode.equity : null;
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
    config: mode.config || {}, stats: mode.stats || {},
    reliability,
    equityCurve: mode.equity || {}
  });

  // 5. orders.json — orders only valid on scan date
  const modeOrders = ordersStale ? [] : (mode.orders || []).map(o => ({
    ticker: o.ticker, action: o.action || 'BUY', score: o.score, strategy: o.strategy,
    entry: parsePrice(o.entry), stop: parsePrice(o.stop), tp1: parsePrice(o.tp1), tp2: parsePrice(o.tp2), rr: o.rr,
    sharia: o.sharia != null ? o.sharia : null,
    allocPct, replaces: o.replaces || null, scoreDelta: o.scoreDelta || null,
    thesis: o.thesis || '',
    broker_symbols: getBrokerSymbols(o.ticker),
  }));
  write(`${p}orders.json`, {
    updatedAt: now, date: snap.date, scanDate: scanDir, mode: prefix || 'balanced',
    allocPct, orders: modeOrders
  });

  // 6. actions.json
  write(`${p}actions.json`, {
    updatedAt: now, date: snap.date, mode: prefix || 'balanced',
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
    config: mode.config || {}, stats: mode.stats || {},
    equityCurve: mode.equity || {},
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
    positions: (mode.positions || []).map(p => {
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
    closedTrades: (mode.closedTrades || []).map(t => ({
      ticker: t.ticker, scanDate: t.scanDate, entryDate: t.entryDate,
      entry: t.actualEntry, exitPrice: t.exitPrice, pnlPct: t.pnlPct,
      holdDays: t.holdDays, status: t.status, strategy: t.strategy,
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
    configVersion: modesConfigMeta.configVersion,
    regime: modesConfigMeta.regime,
    risk: riskPayload,
    notes: riskNotes,
    bench: benchField,
  });
}

// ─── Write all modes ────────────────────────────────────────────────────────
const MODE_IDS = Object.keys(require('../data/modes-config.json').modes);
let count = 0;

for (const id of MODE_IDS) {
  const mode = snap.modes[id];
  if (!mode) {
    console.log(`  [skip] Mode "${id}" not found in snapshot`);
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
function computeStreaks(trades) {
  const sorted = [...(trades || [])]
    .filter(t => t && (t.entryDate || t.scanDate))
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

console.log(`\nDone. ${count} endpoints written to portfolio/v1/ at ${now}`);
