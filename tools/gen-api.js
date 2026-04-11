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
