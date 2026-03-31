#!/usr/bin/env node
/**
 * backfill-history.js — Rebuild time machine snapshots from backtest-trades.json
 *
 * For each scan date, reconstructs the full state:
 *   - Stats (return, DD, WR, PF) cumulative up to that date
 *   - Equity curve up to that date
 *   - Open positions on that date
 *   - Closed trades up to that date
 *   - Signals/orders from trades entered on that date
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TRADES_FILE = path.join(ROOT, 'data/backtest-trades.json');
const MODES_FILE = path.join(ROOT, 'data/modes-config.json');
const POSITIONS_FILE = path.join(ROOT, 'data/scanner-positions.json');
const HISTORY_DIR = path.join(ROOT, 'scanner/status/history');

// Mode ID mapping: backtest-trades.json uses 'sharpe', modes-config uses 'zero'
const MODE_MAP = { growth: 'growth', calmar: 'calmar', sharpe: 'zero' };
const REVERSE_MAP = { growth: 'growth', calmar: 'calmar', zero: 'sharpe' };

function addBizDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z');
  let added = 0;
  while (added < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

function bizDaysBetween(d1, d2) {
  const a = new Date(d1 + 'T12:00:00Z');
  const b = new Date(d2 + 'T12:00:00Z');
  let count = 0;
  const iter = new Date(a);
  while (iter < b) {
    iter.setUTCDate(iter.getUTCDate() + 1);
    const dow = iter.getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

function computeStatsUpTo(trades, portfolioSize) {
  const wins = trades.filter(t => t.pnlPct > 0);
  const losses = trades.filter(t => t.pnlPct <= 0);
  const totalReturn = trades.reduce((s, t) => s + (t.pnlPct || 0) / portfolioSize, 0);

  let equity = 0, peak = 0, maxDD = 0;
  const equityCurve = [{ date: null, value: 100 }];
  for (const t of trades) {
    equity += (t.pnlPct || 0) / portfolioSize;
    if (equity > peak) peak = equity;
    if (peak - equity > maxDD) maxDD = peak - equity;
    equityCurve.push({ date: t.scanDate, value: +(100 + equity).toFixed(2) });
  }

  const grossWin = wins.reduce((s, t) => s + t.pnlPct, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));
  const pf = grossLoss > 0 ? +(grossWin / grossLoss).toFixed(2) : (grossWin > 0 ? 99 : 0);
  const wr = trades.length ? +((wins.length / trades.length) * 100).toFixed(1) : 0;
  const holdDays = trades.filter(t => t.holdDays).map(t => t.holdDays);
  const avgHold = holdDays.length ? +(holdDays.reduce((a, b) => a + b, 0) / holdDays.length).toFixed(1) : 0;

  return {
    ret: +totalReturn.toFixed(2),
    dd: +(-maxDD).toFixed(2),
    wr,
    pf,
    trades: trades.length,
    avgHold,
    equityCurve
  };
}

function equityDV(curve) {
  const byDate = {};
  for (const p of curve) { if (p.date) byDate[p.date] = p.value; }
  const dates = Object.keys(byDate).sort();
  return { d: dates.map(d => d.slice(5).replace('-', '/')), v: dates.map(d => byDate[d]) };
}

function main() {
  const allTrades = JSON.parse(fs.readFileSync(TRADES_FILE, 'utf8'));
  const modesCfg = JSON.parse(fs.readFileSync(MODES_FILE, 'utf8'));

  // Load current positions for enriching the latest snapshot
  let currentPositions = [];
  try {
    const posData = JSON.parse(fs.readFileSync(POSITIONS_FILE, 'utf8'));
    currentPositions = posData.open_positions || [];
  } catch (e) {}

  // Collect all unique scan dates across all modes
  const allDates = new Set();
  for (const modeKey of Object.keys(allTrades)) {
    for (const t of allTrades[modeKey]) {
      if (t.scanDate) allDates.add(t.scanDate);
      // Also add entry dates to have more granular snapshots
      if (t.entryDate) allDates.add(t.entryDate);
    }
  }

  // Also add dates from scanner directories
  const scannerDir = path.join(ROOT, 'scanner');
  try {
    const dirs = fs.readdirSync(scannerDir).filter(d => /^\d{8}$/.test(d));
    dirs.forEach(d => {
      const iso = d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8);
      allDates.add(iso);
    });
  } catch (e) {}

  const sortedDates = [...allDates].sort();
  console.log(`📅 Rebuilding ${sortedDates.length} snapshots from ${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]}`);

  fs.mkdirSync(HISTORY_DIR, { recursive: true });
  let count = 0;

  for (const dateISO of sortedDates) {
    const snapshot = { date: dateISO, updatedAt: 'backfill', modes: {} };

    for (const [tradeKey, trades] of Object.entries(allTrades)) {
      const modeId = MODE_MAP[tradeKey] || tradeKey;
      const cfg = modesCfg.modes[modeId];
      if (!cfg) continue;

      // 1. Closed trades up to this date (trades whose exit happened on or before dateISO)
      const closedByDate = trades.filter(t => {
        if (!t.entryDate || !t.holdDays) return false;
        const exitDate = addBizDays(t.entryDate, t.holdDays);
        return exitDate <= dateISO;
      });

      // 2. Stats from closed trades
      const stats = computeStatsUpTo(closedByDate, cfg.portfolioSize);
      const ec = equityDV(stats.equityCurve);

      // 3. Open positions on this date (entered but not yet exited)
      const openPositions = [];
      for (const t of trades) {
        if (!t.entryDate) continue;
        const exitDate = addBizDays(t.entryDate, t.holdDays || cfg.horizon);
        if (t.entryDate <= dateISO && exitDate > dateISO) {
          const daysHeld = bizDaysBetween(t.entryDate, dateISO);
          const daysRemaining = Math.max(0, cfg.horizon - daysHeld);

          // For current price on that date, use exit price as approximation
          // (we don't have intraday data, so this is the best we can do)
          const currentPrice = t.exitPrice || t.actualEntry;
          const returnPct = t.actualEntry > 0 ? +((currentPrice - t.actualEntry) / t.actualEntry * 100).toFixed(1) : 0;

          openPositions.push({
            ticker: t.ticker,
            scan_date: t.scanDate,
            entry: t.actualEntry,
            current_price: currentPrice,
            return_pct: returnPct,
            stop: t.actualEntry * (1 - (cfg.maxStopPct || 8) / 100),
            tp1: t.actualEntry * 1.10,
            tp2: t.actualEntry * 1.20,
            days_remaining: daysRemaining,
            strategy: t.strategy
          });
        }
      }

      // 4. New signals for this date (trades that were scanned on this date)
      const signals = trades
        .filter(t => t.scanDate === dateISO)
        .map(t => ({
          ticker: t.ticker,
          score: t.score || 0,
          strategy: t.strategy,
          entry: '$' + (t.actualEntry || 0).toFixed(2),
          stop: '$' + (t.actualEntry * (1 - (cfg.maxStopPct || 8) / 100)).toFixed(2),
          tp1: '$' + (t.actualEntry * 1.10).toFixed(2),
          tp2: '$' + (t.actualEntry * 1.20).toFixed(2),
          rr: '1:1.5'
        }));

      // 5. Orders (new entries for this date)
      const openTickers = new Set(openPositions.map(p => p.ticker));
      const orders = signals
        .filter(s => !openTickers.has(s.ticker))
        .slice(0, Math.max(0, cfg.portfolioSize - openPositions.length))
        .map(s => ({ ...s, action: 'BUY' }));

      // 6. Close Now (positions past horizon)
      const closeNow = openPositions
        .filter(p => p.days_remaining <= 0)
        .map(p => ({
          ticker: p.ticker,
          scan_date: p.scan_date,
          entry: p.entry,
          current_price: p.current_price,
          return_pct: p.return_pct
        }));

      snapshot.modes[modeId] = {
        stats: {
          ret: stats.ret,
          dd: stats.dd,
          wr: stats.wr,
          pf: stats.pf,
          trades: stats.trades,
          avgHold: stats.avgHold
        },
        equity: ec,
        signals,
        positions: openPositions,
        orders,
        closeNow,
        closedTrades: closedByDate.map(t => ({
          ticker: t.ticker,
          scanDate: t.scanDate,
          entryDate: t.entryDate,
          actualEntry: t.actualEntry,
          exitPrice: t.exitPrice,
          pnlPct: t.pnlPct,
          holdDays: t.holdDays,
          status: t.status,
          strategy: t.strategy
        })),
        config: {
          portfolioSize: cfg.portfolioSize,
          horizon: cfg.horizon,
          filterName: cfg.filterName,
          rotation: cfg.rotation,
          color: cfg.color
        }
      };
    }

    // Skip dates with zero data across all modes
    let hasData = false;
    for (const modeId of Object.keys(snapshot.modes)) {
      const md = snapshot.modes[modeId];
      if ((md.signals || []).length || (md.positions || []).length ||
          (md.closedTrades || []).length || (md.orders || []).length) {
        hasData = true; break;
      }
    }
    if (!hasData) continue;

    const dateKey = dateISO.replace(/-/g, '');
    fs.writeFileSync(path.join(HISTORY_DIR, dateKey + '.json'), JSON.stringify(snapshot));
    count++;
  }

  // Write dates index
  const existingDates = fs.readdirSync(HISTORY_DIR)
    .filter(f => /^\d{8}\.json$/.test(f))
    .map(f => f.replace('.json', ''))
    .sort();
  fs.writeFileSync(path.join(HISTORY_DIR, 'dates.json'), JSON.stringify(existingDates));

  console.log(`✅ ${count} snapshots saved to ${HISTORY_DIR}`);
  console.log(`   Date range: ${existingDates[0]} → ${existingDates[existingDates.length - 1]}`);
  console.log(`   dates.json: ${existingDates.length} entries`);
}

main();
