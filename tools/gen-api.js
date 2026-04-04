#!/usr/bin/env node
/**
 * gen-api.js — Portfolio endpoint generator (multi-mode)
 * Reads the latest scanner status snapshot and writes flat JSON to portfolio/v1/
 * Outputs per-mode endpoints in portfolio/v1/{mode}/ for all 3 modes.
 * Root portfolio/v1/ endpoints point to balanced mode (backward compat).
 *
 * Usage: node tools/gen-api.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'portfolio', 'v1');
const HISTORY = path.join(ROOT, 'scanner', 'status', 'history');

fs.mkdirSync(OUT, { recursive: true });

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

console.log(`  Source: ${path.relative(ROOT, latestFile)} (${snap.date})`);

// ─── Helper: write all 7 endpoints for a mode ─────────────────────────────────
function writeMode(mode, prefix) {
  const p = prefix ? `${prefix}/` : '';

  // 1. signals.json
  write(`${p}signals.json`, {
    updatedAt: now, date: snap.date, mode: prefix || 'balanced',
    signals: (mode.signals || []).map(s => ({
      ticker: s.ticker, score: s.score, strategy: s.strategy,
      entry: s.entry, stop: s.stop, tp1: s.tp1, tp2: s.tp2, rr: s.rr, thesis: s.thesis || ''
    }))
  });

  // 2. positions.json
  write(`${p}positions.json`, {
    updatedAt: now, date: snap.date, mode: prefix || 'balanced',
    positions: (mode.positions || []).map(p => ({
      ticker: p.ticker, entry: p.entry, currentPrice: p.current_price,
      returnPct: p.return_pct, stop: p.stop, tp1: p.tp1, tp2: p.tp2,
      scanDate: p.scan_date, daysRemaining: p.days_remaining
    }))
  });

  // 3. trades.json
  write(`${p}trades.json`, {
    updatedAt: now, mode: prefix || 'balanced',
    trades: (mode.closedTrades || []).map(t => ({
      ticker: t.ticker, scanDate: t.scanDate, entryDate: t.entryDate,
      entry: t.actualEntry, exitPrice: t.exitPrice, pnlPct: t.pnlPct,
      holdDays: t.holdDays, status: t.status, strategy: t.strategy
    }))
  });

  // 4. equity.json
  write(`${p}equity.json`, {
    updatedAt: now, mode: prefix || 'balanced',
    config: mode.config || {}, stats: mode.stats || {},
    equityCurve: mode.equity || {}
  });

  // 5. orders.json
  write(`${p}orders.json`, {
    updatedAt: now, date: snap.date, mode: prefix || 'balanced',
    orders: (mode.orders || []).map(o => ({
      ticker: o.ticker, action: o.action || 'BUY', score: o.score, strategy: o.strategy,
      entry: o.entry, stop: o.stop, tp1: o.tp1, tp2: o.tp2, rr: o.rr,
      replaces: o.replaces || null, thesis: o.thesis || ''
    }))
  });

  // 6. actions.json
  write(`${p}actions.json`, {
    updatedAt: now, date: snap.date, mode: prefix || 'balanced',
    closeNow: (mode.closeNow || []).map(p => ({
      ticker: p.ticker, scanDate: p.scan_date, entry: p.entry,
      currentPrice: p.current_price, returnPct: p.return_pct,
      daysHeld: p.days_held, horizon: p.horizon
    })),
    expiresTomorrow: (mode.expiresTomorrow || []).map(p => ({
      ticker: p.ticker, entry: p.entry, returnPct: p.return_pct,
      stop: p.stop, daysHeld: p.days_held, horizon: p.horizon
    }))
  });

  // 7. all.json
  write(`${p}all.json`, {
    updatedAt: now, date: snap.date, mode: prefix || 'balanced',
    config: mode.config || {}, stats: mode.stats || {},
    equityCurve: mode.equity || {},
    signals: (mode.signals || []).map(s => ({
      ticker: s.ticker, score: s.score, strategy: s.strategy,
      entry: s.entry, stop: s.stop, tp1: s.tp1, tp2: s.tp2, rr: s.rr, thesis: s.thesis || ''
    })),
    orders: (mode.orders || []).map(o => ({
      ticker: o.ticker, action: o.action || 'BUY', score: o.score, strategy: o.strategy,
      entry: o.entry, stop: o.stop, tp1: o.tp1, tp2: o.tp2, rr: o.rr,
      replaces: o.replaces || null, thesis: o.thesis || ''
    })),
    positions: (mode.positions || []).map(p => ({
      ticker: p.ticker, entry: p.entry, currentPrice: p.current_price,
      returnPct: p.return_pct, stop: p.stop, tp1: p.tp1, tp2: p.tp2,
      scanDate: p.scan_date, daysRemaining: p.days_remaining
    })),
    closeNow: (mode.closeNow || []).map(p => ({
      ticker: p.ticker, scanDate: p.scan_date, entry: p.entry,
      currentPrice: p.current_price, returnPct: p.return_pct,
      daysHeld: p.days_held, horizon: p.horizon
    })),
    expiresTomorrow: (mode.expiresTomorrow || []).map(p => ({
      ticker: p.ticker, entry: p.entry, returnPct: p.return_pct,
      stop: p.stop, daysHeld: p.days_held, horizon: p.horizon
    })),
    closedTrades: (mode.closedTrades || []).map(t => ({
      ticker: t.ticker, scanDate: t.scanDate, entryDate: t.entryDate,
      entry: t.actualEntry, exitPrice: t.exitPrice, pnlPct: t.pnlPct,
      holdDays: t.holdDays, status: t.status, strategy: t.strategy
    }))
  });
}

// ─── Load forecast data (if available) ──────────────────────────────────────
const forecastFile = path.join(ROOT, 'data', 'forecast-latest.json');
let forecastData = null;
if (fs.existsSync(forecastFile)) {
  try {
    forecastData = JSON.parse(fs.readFileSync(forecastFile, 'utf8'));
    console.log(`  Forecast data loaded (${Object.keys(forecastData.forecasts || {}).length} tickers)`);
  } catch (e) {
    console.log(`  [warn] Could not parse forecast data: ${e.message}`);
  }
}

const regimeForecastFile = path.join(ROOT, 'data', 'regime-forecast.json');
let regimeForecast = null;
if (fs.existsSync(regimeForecastFile)) {
  try {
    regimeForecast = JSON.parse(fs.readFileSync(regimeForecastFile, 'utf8'));
  } catch (_) {}
}

// ─── Helper: write forecast endpoint for a mode ─────────────────────────────
function writeForecast(mode, prefix) {
  if (!forecastData?.forecasts) return;
  const p = prefix ? `${prefix}/` : '';
  const positions = mode.positions || [];
  const positionTickers = new Set(positions.map(p => p.ticker));

  const forecasts = [];
  for (const [ticker, fc] of Object.entries(forecastData.forecasts)) {
    if (!positionTickers.has(ticker)) continue;
    const pos = positions.find(p => p.ticker === ticker);
    forecasts.push({
      ticker,
      currentPrice: pos?.current_price || fc.last_close,
      forecastedPrice5d: fc.predicted_prices?.[4] || null,
      forecastedPrice10d: fc.predicted_prices?.[9] || null,
      predictedReturn5d: fc.predicted_prices?.[4]
        ? round((fc.predicted_prices[4] - fc.last_close) / fc.last_close * 100)
        : null,
      predictedReturn10d: fc.predicted_return_pct,
      confidence: fc.confidence,
      direction: fc.predicted_direction,
      confluence: fc.confluence || null,
    });
  }

  write(`${p}forecast.json`, {
    updatedAt: now,
    date: snap.date,
    mode: prefix || 'balanced',
    model: forecastData.model || 'timesfm-2.0-500m',
    forecasts,
    regimeForecast: regimeForecast ? {
      currentVix: regimeForecast.current_vix,
      predictedVix5d: regimeForecast.predicted_vix_5d,
      vixDelta: regimeForecast.vix_delta,
      transitionRisk: regimeForecast.regime_transition_risk,
    } : null,
  });
}

function round(n) { return Math.round(n * 100) / 100; }

// ─── Write all 3 modes ──────────────────────────────────────────────────────
const MODE_IDS = ['dynamic', 'balanced', 'secured'];
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
  if (forecastData) {
    writeForecast(mode, id);
    count += 1;
  }
}

// ─── Root endpoints = balanced (backward compat) ───────────────────────────
const balanced = snap.modes.balanced || snap.modes.calmar;
if (balanced) {
  console.log(`\n─── Root (= balanced) ───`);
  writeMode(balanced, '');
  count += 7;
  if (forecastData) {
    writeForecast(balanced, '');
    count += 1;
  }
}

// ─── Summary endpoint: all modes overview ──────────────────────────────────
write('modes.json', {
  updatedAt: now, date: snap.date,
  modes: MODE_IDS.filter(id => snap.modes[id]).map(id => {
    const m = snap.modes[id];
    return {
      id,
      label: m.config?.label || id,
      color: m.config?.color || '#888',
      stats: m.stats || {},
      positionCount: (m.positions || []).length,
      orderCount: (m.orders || []).length,
    };
  })
});
count++;

console.log(`\nDone. ${count} endpoints written to portfolio/v1/ at ${now}`);
