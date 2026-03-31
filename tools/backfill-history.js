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

  // Track cumulative mark-to-market equity curves per mode across all dates
  const modeEquityCurves = {};

  // Forward DD accumulation: DD can only get worse (more negative) or stay the same
  const worstDD = {};

  // Pre-load live snapshots (from gen-status-page.js) — never overwrite these
  const liveSnapshots = new Set();
  try {
    const files = fs.readdirSync(HISTORY_DIR).filter(f => /^\d{8}\.json$/.test(f));
    for (const f of files) {
      const snap = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, f), 'utf8'));
      if (snap.updatedAt && snap.updatedAt !== 'backfill') {
        liveSnapshots.add(f.replace('.json', ''));
      }
    }
  } catch (e) {}
  if (liveSnapshots.size) console.log(`🔒 ${liveSnapshots.size} live snapshots protected: ${[...liveSnapshots].join(', ')}`);

  for (const dateISO of sortedDates) {
    const dateKey = dateISO.replace(/-/g, '');

    // Never overwrite snapshots saved by gen-status-page.js (live ground truth)
    if (liveSnapshots.has(dateKey)) {
      // Still compute equity curves so the MtM curve stays continuous
      for (const [tradeKey, trades] of Object.entries(allTrades)) {
        const modeId = MODE_MAP[tradeKey] || tradeKey;
        const cfg = modesCfg.modes[modeId];
        if (!cfg) continue;
        if (!modeEquityCurves[modeId]) modeEquityCurves[modeId] = [];
        // Read the live snapshot's equity value for this date
        try {
          const liveSnap = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, dateKey + '.json'), 'utf8'));
          if (liveSnap.modes[modeId] && liveSnap.modes[modeId].equity) {
            const ec = liveSnap.modes[modeId].equity;
            if (ec.v && ec.v.length > 0) {
              modeEquityCurves[modeId].push({ date: dateISO, value: ec.v[ec.v.length - 1] });
            }
          }
        } catch (e) {}
      }
      continue;
    }

    const snapshot = { date: dateISO, updatedAt: 'backfill', scanDir: dateKey, modes: {} };

    for (const [tradeKey, trades] of Object.entries(allTrades)) {
      const modeId = MODE_MAP[tradeKey] || tradeKey;
      const cfg = modesCfg.modes[modeId];
      if (!cfg) continue;
      if (!modeEquityCurves[modeId]) modeEquityCurves[modeId] = [];

      // Exit date for a trade: use holdDays if the trade actually completed (tp/sl),
      // otherwise use cfg.horizon (trade was "premature"/expired early by rotation).
      // This aligns with gen-status-page.js _premature logic.
      function tradeExitDate(t) {
        // holdDays=0 means same-day exit (e.g. stop loss) — NOT falsy
        if (t.status === 'tp' || t.status === 'sl' || t.holdDays === 0) {
          return addBizDays(t.entryDate, t.holdDays != null ? t.holdDays : cfg.horizon);
        }
        // expired with holdDays < horizon = premature (rotation), use full horizon
        if (t.status === 'expired' && t.holdDays != null && t.holdDays < cfg.horizon) {
          return addBizDays(t.entryDate, cfg.horizon);
        }
        return addBizDays(t.entryDate, t.holdDays != null ? t.holdDays : cfg.horizon);
      }

      // 1. Closed trades up to this date (trades fully exited on or before dateISO)
      const closedByDate = trades.filter(t => {
        if (!t.entryDate) return false;
        if (t.holdDays == null) return false; // no hold info
        const exitDate = tradeExitDate(t);
        return exitDate <= dateISO;
      });

      // Sort closedByDate chronologically by exit date before computing stats.
      // Without this, trades in raw array order can insert a profitable trade
      // BEFORE a losing one in the equity loop, pushing the peak higher and
      // artificially shrinking maxDD — causing DD to improve (go less negative)
      // as new trades close, which is physically impossible for a running max DD.
      closedByDate.sort((a, b) => {
        const ea = tradeExitDate(a), eb = tradeExitDate(b);
        if (ea !== eb) return ea < eb ? -1 : 1;
        return (a.entryDate || '') < (b.entryDate || '') ? -1 : 1;
      });

      // 2. Stats from closed trades (realized only for stats)
      const stats = computeStatsUpTo(closedByDate, cfg.portfolioSize);

      // Forward DD accumulation: DD can only get worse (more negative) over time
      if (!(modeId in worstDD)) worstDD[modeId] = 0;
      worstDD[modeId] = Math.min(worstDD[modeId], stats.dd);
      stats.dd = worstDD[modeId];

      // Approximate bizDaysHeld matching gen-status-page.js (uses scanDate, not entryDate)
      function bizDaysHeldApprox(scanDate) {
        if (!scanDate) return 0;
        const sd = new Date(scanDate + 'T12:00:00Z');
        const rd = new Date(dateISO + 'T12:00:00Z');
        const age = Math.round((rd - sd) / 86400000);
        return Math.round(age * 5 / 7);
      }

      // 3. Open positions on this date (entered but not yet fully exited)
      // Matching gen-status-page.js posFor(): trades still within their holding period
      let openPositions = [];
      for (const t of trades) {
        if (!t.entryDate) continue;
        const exitDate = tradeExitDate(t);
        if (t.entryDate <= dateISO && exitDate > dateISO) {
          // Use scanDate-based held days (matching gen-status-page.js)
          const held = bizDaysHeldApprox(t.scanDate);
          const daysRemaining = Math.max(0, cfg.horizon - held);
          // Don't use exitPrice for open positions — that's future data!
          // For open positions, best we can do is entry price (no live data in backfill)
          const currentPrice = t.actualEntry || 0;
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

      // 3b. Cap open positions at portfolioSize (newest/highest-score first)
      openPositions.sort((a, b) => (b.scan_date || '').localeCompare(a.scan_date || ''));
      if (openPositions.length > cfg.portfolioSize) {
        openPositions = openPositions.slice(0, cfg.portfolioSize);
      }

      // 3c. Close Now: positions where scanDate-based held >= horizon
      // (matching gen-status-page.js timedOut logic — computed FROM openPositions)
      const closeNow = openPositions
        .filter(p => bizDaysHeldApprox(p.scan_date) >= cfg.horizon)
        .map(p => ({
          ticker: p.ticker, scan_date: p.scan_date, entry: p.entry,
          current_price: p.current_price, return_pct: p.return_pct,
          days_held: bizDaysHeldApprox(p.scan_date), horizon: cfg.horizon
        }));

      // 4. New signals for this date — collect from ALL modes for this scanDate
      // to show the full scanner output, not just per-mode filtered trades
      const allSignalsForDate = [];
      for (const [mk, mt] of Object.entries(allTrades)) {
        for (const t of mt) {
          if (t.scanDate === dateISO && !allSignalsForDate.find(s => s.ticker === t.ticker)) {
            allSignalsForDate.push(t);
          }
        }
      }
      const signals = allSignalsForDate
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .map(t => ({
          ticker: t.ticker,
          score: t.score || 85,
          strategy: t.strategy,
          entry: '$' + (t.actualEntry || 0).toFixed(2),
          stop: '$' + (t.actualEntry * (1 - (cfg.maxStopPct || 8) / 100)).toFixed(2),
          tp1: '$' + (t.actualEntry * 1.10).toFixed(2),
          tp2: '$' + (t.actualEntry * 1.20).toFixed(2),
          rr: '1:1.5'
        }));

      // 5. Orders (new entries for this date, respecting portfolio capacity)
      const openTickers = new Set(openPositions.map(p => p.ticker));
      const availableSlots = Math.max(0, cfg.portfolioSize - openPositions.length);
      const orders = signals
        .filter(s => !openTickers.has(s.ticker))
        .slice(0, availableSlots)
        .map(s => ({ ...s, action: 'BUY' }));

      // Mark-to-market equity: realized (closed) + unrealized (open positions)
      const realized = stats.ret; // cumulative realized return %
      const unrealized = openPositions.reduce((s, p) => s + (p.return_pct || 0), 0) / cfg.portfolioSize;
      const mtmEquity = +(100 + realized + unrealized).toFixed(2);

      // Only add equity points once the mode has actual activity
      const hasActivity = closedByDate.length > 0 || openPositions.length > 0;
      const curveStarted = modeEquityCurves[modeId].length > 0;
      if (hasActivity || curveStarted) {
        modeEquityCurves[modeId].push({ date: dateISO, value: mtmEquity });
      }

      // Build equity { d, v } from cumulative MtM curve
      const ec = {
        d: modeEquityCurves[modeId].map(p => p.date.slice(5).replace('-', '/')),
        v: modeEquityCurves[modeId].map(p => p.value)
      };

      // Stats use REALIZED values only (matching live page gen-status-page.js)
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
        expiresTomorrow: openPositions
          .filter(p => { const left = Math.max(0, cfg.horizon - bizDaysHeldApprox(p.scan_date)); return left === 1; })
          .map(p => ({
            ticker: p.ticker, entry: p.entry, return_pct: p.return_pct, stop: p.stop,
            days_held: bizDaysHeldApprox(p.scan_date), horizon: cfg.horizon
          })),
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
