#!/usr/bin/env node
/**
 * gen-api.js — Portfolio endpoint generator
 * Reads the latest scanner status snapshot and writes flat JSON to portfolio/v1/
 * This ensures API endpoints match exactly what the scanner status page shows.
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
const cal = snap.modes.balanced || snap.modes.calmar;
const now = new Date().toISOString();

console.log(`  Source: ${path.relative(ROOT, latestFile)} (${snap.date})`);

// ─── 1. signals.json — current scanner signals ─────────────────────────────
write('signals.json', {
  updatedAt: now,
  date: snap.date,
  signals: (cal.signals || []).map(s => ({
    ticker: s.ticker,
    score: s.score,
    strategy: s.strategy,
    entry: s.entry,
    stop: s.stop,
    tp1: s.tp1,
    tp2: s.tp2,
    rr: s.rr,
    thesis: s.thesis || ''
  }))
});

// ─── 2. positions.json — current open positions ────────────────────────────
write('positions.json', {
  updatedAt: now,
  date: snap.date,
  positions: (cal.positions || []).map(p => ({
    ticker: p.ticker,
    entry: p.entry,
    currentPrice: p.current_price,
    returnPct: p.return_pct,
    stop: p.stop,
    tp1: p.tp1,
    tp2: p.tp2,
    scanDate: p.scan_date,
    daysRemaining: p.days_remaining
  }))
});

// ─── 3. trades.json — closed trade history ──────────────────────────────────
write('trades.json', {
  updatedAt: now,
  trades: (cal.closedTrades || []).map(t => ({
    ticker: t.ticker,
    scanDate: t.scanDate,
    entryDate: t.entryDate,
    entry: t.actualEntry,
    exitPrice: t.exitPrice,
    pnlPct: t.pnlPct,
    holdDays: t.holdDays,
    status: t.status,
    strategy: t.strategy
  }))
});

// ─── 4. equity.json — stats + equity curve ──────────────────────────────────
write('equity.json', {
  updatedAt: now,
  config: cal.config || {},
  stats: cal.stats || {},
  equityCurve: cal.equity || {}
});

// ─── 5. orders.json — buy/rotate orders to place ────────────────────────────
write('orders.json', {
  updatedAt: now,
  date: snap.date,
  orders: (cal.orders || []).map(o => ({
    ticker: o.ticker,
    action: o.action || 'BUY',
    score: o.score,
    strategy: o.strategy,
    entry: o.entry,
    stop: o.stop,
    tp1: o.tp1,
    tp2: o.tp2,
    rr: o.rr,
    replaces: o.replaces || null,
    thesis: o.thesis || ''
  }))
});

// ─── 6. actions.json — positions requiring action (close/check) ─────────────
write('actions.json', {
  updatedAt: now,
  date: snap.date,
  closeNow: (cal.closeNow || []).map(p => ({
    ticker: p.ticker,
    scanDate: p.scan_date,
    entry: p.entry,
    currentPrice: p.current_price,
    returnPct: p.return_pct,
    daysHeld: p.days_held,
    horizon: p.horizon
  })),
  expiresTomorrow: (cal.expiresTomorrow || []).map(p => ({
    ticker: p.ticker,
    entry: p.entry,
    returnPct: p.return_pct,
    stop: p.stop,
    daysHeld: p.days_held,
    horizon: p.horizon
  }))
});

// ─── 7. all.json — full portfolio state for LLM analysis ────────────────────
write('all.json', {
  updatedAt: now,
  date: snap.date,
  config: cal.config || {},
  stats: cal.stats || {},
  equityCurve: cal.equity || {},
  signals: (cal.signals || []).map(s => ({
    ticker: s.ticker, score: s.score, strategy: s.strategy,
    entry: s.entry, stop: s.stop, tp1: s.tp1, tp2: s.tp2, rr: s.rr, thesis: s.thesis || ''
  })),
  orders: (cal.orders || []).map(o => ({
    ticker: o.ticker, action: o.action || 'BUY', score: o.score, strategy: o.strategy,
    entry: o.entry, stop: o.stop, tp1: o.tp1, tp2: o.tp2, rr: o.rr,
    replaces: o.replaces || null, thesis: o.thesis || ''
  })),
  positions: (cal.positions || []).map(p => ({
    ticker: p.ticker, entry: p.entry, currentPrice: p.current_price,
    returnPct: p.return_pct, stop: p.stop, tp1: p.tp1, tp2: p.tp2,
    scanDate: p.scan_date, daysRemaining: p.days_remaining
  })),
  closeNow: (cal.closeNow || []).map(p => ({
    ticker: p.ticker, scanDate: p.scan_date, entry: p.entry,
    currentPrice: p.current_price, returnPct: p.return_pct,
    daysHeld: p.days_held, horizon: p.horizon
  })),
  expiresTomorrow: (cal.expiresTomorrow || []).map(p => ({
    ticker: p.ticker, entry: p.entry, returnPct: p.return_pct,
    stop: p.stop, daysHeld: p.days_held, horizon: p.horizon
  })),
  closedTrades: (cal.closedTrades || []).map(t => ({
    ticker: t.ticker, scanDate: t.scanDate, entryDate: t.entryDate,
    entry: t.actualEntry, exitPrice: t.exitPrice, pnlPct: t.pnlPct,
    holdDays: t.holdDays, status: t.status, strategy: t.strategy
  }))
});

console.log(`\nDone. 7 endpoints written to portfolio/v1/ at ${now}`);
