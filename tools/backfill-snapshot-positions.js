#!/usr/bin/env node
// Backfill historical snapshot positions from backtest-trades.json (source of truth).
// Old posFor() re-derived positions from scanner-positions.json (flat, mode-agnostic),
// causing wrong positions per mode. This script fixes all historical snapshots.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const histDir = path.join(ROOT, 'scanner', 'status', 'history');
const tradesData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'backtest-trades.json'), 'utf8'));
const modesConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'modes-config.json'), 'utf8'));

function addBizDays(dateStr, n) {
  let d = new Date(dateStr + 'T12:00:00Z');
  let added = 0;
  while (added < n) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) added++; }
  return d.toISOString().slice(0, 10);
}

function bizDaysBetween(from, to) {
  let d = new Date(from + 'T12:00:00Z'), count = 0;
  const end = new Date(to + 'T12:00:00Z');
  while (d < end) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) count++; }
  return count;
}

const snapFiles = fs.readdirSync(histDir).filter(f => /^\d{8}\.json$/.test(f)).sort();
let fixed = 0;

for (const file of snapFiles) {
  const dateKey = file.replace('.json', '');
  const dateISO = `${dateKey.slice(0, 4)}-${dateKey.slice(4, 6)}-${dateKey.slice(6, 8)}`;
  const snapPath = path.join(histDir, file);
  const snap = JSON.parse(fs.readFileSync(snapPath, 'utf8'));

  if (!snap.modes) continue;
  let changed = false;

  for (const [modeId, modeSnap] of Object.entries(snap.modes)) {
    const cfg = modesConfig.modes ? modesConfig.modes[modeId] : modesConfig[modeId];
    if (!cfg) continue;
    const allTrades = tradesData[modeId] || [];
    const horizon = cfg.horizon || 10;
    const portfolioSize = cfg.portfolioSize || 3;

    // Positions open on this date: entered on or before dateISO, not yet exited
    // A trade is open if: entryDate <= dateISO AND (exitDate > dateISO OR no exitDate/pending)
    const openOnDate = allTrades.filter(t => {
      if (!t.entryDate) return false;
      if (t.entryDate > dateISO) return false;
      if (t.status === 'skipped') return false;
      // No exit = still open
      if (!t.exitDate) return true;
      // Exited after this date = was open on this date
      return t.exitDate > dateISO;
    });

    // Closed on this date (terminal): exited on dateISO
    const closedOnDate = allTrades.filter(t => {
      if (!t.exitDate || t.status === 'skipped') return false;
      return t.exitDate === dateISO && t.entryDate <= dateISO;
    });

    const positions = [];

    // Active positions
    for (const t of openOnDate) {
      const held = bizDaysBetween(t.scanDate || t.entryDate, dateISO);
      const expired = held >= horizon;
      positions.push({
        ticker: t.ticker,
        scan_date: t.scanDate || t.entryDate,
        entry: t.actualEntry || t.entry || 0,
        current_price: t.exitPrice || t.actualEntry || t.entry || 0,
        return_pct: t.pnlPct || 0,
        score: t.score || 0,
        stop: t.actualStop || t.stop || 0,
        tp1: t.tp1 || 0,
        tp2: t.tp2 || null,
        days_remaining: Math.max(0, horizon - held),
        strategy: t.strategy || '',
        thesis: '',
        _expired: expired,
      });
    }

    // Same-day closed (terminal) — grayed in UI
    for (const t of closedOnDate) {
      // Skip if already in openOnDate (shouldn't happen but safety)
      if (openOnDate.some(o => o.ticker === t.ticker && o.scanDate === t.scanDate)) continue;
      positions.push({
        ticker: t.ticker,
        scan_date: t.scanDate || t.entryDate,
        entry: t.actualEntry || t.entry || 0,
        current_price: t.exitPrice || t.actualEntry || 0,
        return_pct: t.pnlPct || 0,
        score: t.score || 0,
        stop: t.actualStop || t.stop || 0,
        tp1: t.tp1 || 0,
        tp2: t.tp2 || null,
        days_remaining: 0,
        strategy: t.strategy || '',
        thesis: '',
        _terminal: true,
        _terminalStatus: t.status,
      });
    }

    // Sort: active first (by return desc), then terminal, then expired
    const live = positions.filter(p => !p._expired && !p._terminal).sort((a, b) => b.return_pct - a.return_pct);
    const terminal = positions.filter(p => p._terminal);
    const expired = positions.filter(p => p._expired && !p._terminal).sort((a, b) => b.return_pct - a.return_pct);
    const finalPositions = [...live, ...terminal, ...expired];

    // Also fix closedTrades: only include trades that were actually closed on or before this date
    const closedTradesAsOf = allTrades.filter(t => {
      if (t.status === 'skipped') return false;
      if (!t.exitDate) return false;
      return t.exitDate <= dateISO;
    }).map(t => ({
      ticker: t.ticker, scanDate: t.scanDate, entryDate: t.entryDate,
      actualEntry: t.actualEntry, exitPrice: t.exitPrice,
      pnlPct: t.pnlPct, holdDays: t.holdDays, status: t.status, strategy: t.strategy,
    }));

    const oldPosTickers = (modeSnap.positions || []).map(p => p.ticker).sort().join(',');
    const newPosTickers = finalPositions.map(p => p.ticker).sort().join(',');

    if (oldPosTickers !== newPosTickers) {
      changed = true;
    }

    // Clean output: remove internal flags
    modeSnap.positions = finalPositions.map(p => {
      const { _expired, _terminal, _terminalStatus, ...rest } = p;
      const clean = { ...rest };
      if (_terminal) { clean._terminal = true; clean._terminalStatus = _terminalStatus; }
      return clean;
    });
    modeSnap.closedTrades = closedTradesAsOf;

    // Recompute closeNow from positions
    modeSnap.closeNow = finalPositions
      .filter(p => p._expired)
      .map(p => ({ ticker: p.ticker, scan_date: p.scan_date, entry: p.entry, current_price: p.current_price, return_pct: p.return_pct, days_held: bizDaysBetween(p.scan_date, dateISO), horizon }));
  }

  fs.writeFileSync(snapPath, JSON.stringify(snap));
  if (changed) {
    const modes = Object.keys(snap.modes).map(m => {
      const pos = (snap.modes[m].positions || []).filter(p => !p._terminal);
      return `${m}:${pos.map(p => p.ticker).join('+')||'∅'}`;
    }).join(' | ');
    console.log(`✅ ${dateKey}: ${modes}`);
    fixed++;
  }
}

console.log(`\nDone. ${fixed}/${snapFiles.length} snapshots updated.`);
