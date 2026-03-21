/**
 * Trade Journal — SQLite-backed
 * Auto-logs alert events, manual trade entries, statistics
 */

import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

let db = null;

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════

export async function init(dbPath = './data/journal.db') {
  try {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const Database = (await import('better-sqlite3')).default;
    db = new Database(dbPath);

    db.exec(`
      CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT NOT NULL,
        direction TEXT DEFAULT 'long',
        strategy TEXT,
        entry_price REAL,
        stop_price REAL,
        tp1_price REAL,
        tp2_price REAL,
        exit_price REAL,
        shares INTEGER,
        risk_pct REAL,
        r_multiple REAL,
        pnl REAL,
        pnl_pct REAL,
        status TEXT DEFAULT 'open',
        entry_date TEXT,
        exit_date TEXT,
        entry_reason TEXT,
        exit_reason TEXT,
        notes TEXT,
        emotional_state TEXT,
        screenshot_url TEXT,
        tags TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS alert_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT NOT NULL,
        alert_type TEXT,
        message TEXT,
        price REAL,
        rvol REAL,
        triggered_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_trades_ticker ON trades(ticker);
      CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
      CREATE INDEX IF NOT EXISTS idx_trades_date ON trades(entry_date);
      CREATE INDEX IF NOT EXISTS idx_alert_log_ticker ON alert_log(ticker);
    `);

    console.error('[Journal] Database initialized');
    return true;
  } catch (err) {
    console.warn('[Journal] SQLite not available, using in-memory store:', err.message);
    db = null;
    return false;
  }
}

// ══════════════════════════════════════
// TRADES CRUD
// ══════════════════════════════════════

export function addTrade(trade) {
  if (!db) return inMemoryAdd(trade);

  const stmt = db.prepare(`
    INSERT INTO trades (ticker, direction, strategy, entry_price, stop_price, tp1_price, tp2_price,
      shares, risk_pct, entry_date, entry_reason, notes, emotional_state, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    trade.ticker?.toUpperCase(), trade.direction || 'long', trade.strategy,
    trade.entry_price, trade.stop_price, trade.tp1_price, trade.tp2_price,
    trade.shares, trade.risk_pct, trade.entry_date || new Date().toISOString().split('T')[0],
    trade.entry_reason, trade.notes, trade.emotional_state,
    Array.isArray(trade.tags) ? trade.tags.join(',') : trade.tags
  );

  return { id: result.lastInsertRowid, ...trade };
}

export function closeTrade(id, { exit_price, exit_reason, notes }) {
  if (!db) return null;

  const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(id);
  if (!trade) return null;

  const pnl = trade.direction === 'long'
    ? (exit_price - trade.entry_price) * (trade.shares || 1)
    : (trade.entry_price - exit_price) * (trade.shares || 1);

  const pnl_pct = trade.direction === 'long'
    ? ((exit_price - trade.entry_price) / trade.entry_price) * 100
    : ((trade.entry_price - exit_price) / trade.entry_price) * 100;

  const risk = Math.abs(trade.entry_price - trade.stop_price);
  const r_multiple = risk > 0 ? (trade.direction === 'long' ? exit_price - trade.entry_price : trade.entry_price - exit_price) / risk : null;

  db.prepare(`
    UPDATE trades SET exit_price = ?, exit_date = datetime('now'), exit_reason = ?,
    pnl = ?, pnl_pct = ?, r_multiple = ?, status = 'closed',
    notes = COALESCE(?, notes), updated_at = datetime('now')
    WHERE id = ?
  `).run(exit_price, exit_reason, pnl, pnl_pct, r_multiple, notes, id);

  return db.prepare('SELECT * FROM trades WHERE id = ?').get(id);
}

export function getTrades(filter = {}) {
  if (!db) return inMemoryTrades;

  let sql = 'SELECT * FROM trades WHERE 1=1';
  const params = [];

  if (filter.ticker) { sql += ' AND ticker = ?'; params.push(filter.ticker.toUpperCase()); }
  if (filter.status) { sql += ' AND status = ?'; params.push(filter.status); }
  if (filter.strategy) { sql += ' AND strategy = ?'; params.push(filter.strategy); }
  if (filter.from) { sql += ' AND entry_date >= ?'; params.push(filter.from); }
  if (filter.to) { sql += ' AND entry_date <= ?'; params.push(filter.to); }

  sql += ' ORDER BY entry_date DESC';
  if (filter.limit) { sql += ' LIMIT ?'; params.push(filter.limit); }

  return db.prepare(sql).all(...params);
}

export function getTradeById(id) {
  if (!db) return null;
  return db.prepare('SELECT * FROM trades WHERE id = ?').get(id);
}

// ══════════════════════════════════════
// ALERT LOG
// ══════════════════════════════════════

export function logAlert(alert) {
  if (!db) return;
  db.prepare(`
    INSERT INTO alert_log (ticker, alert_type, message, price, rvol)
    VALUES (?, ?, ?, ?, ?)
  `).run(alert.ticker, alert.type, alert.message, alert.currentPrice, alert.rvol);
}

export function getAlertLog(limit = 100) {
  if (!db) return [];
  return db.prepare('SELECT * FROM alert_log ORDER BY triggered_at DESC LIMIT ?').all(limit);
}

// ══════════════════════════════════════
// STATISTICS
// ══════════════════════════════════════

export function getStats(filter = {}) {
  if (!db) return {};

  let where = "status = 'closed'";
  const params = [];
  if (filter.from) { where += ' AND entry_date >= ?'; params.push(filter.from); }
  if (filter.to) { where += ' AND entry_date <= ?'; params.push(filter.to); }
  if (filter.strategy) { where += ' AND strategy = ?'; params.push(filter.strategy); }

  const trades = db.prepare(`SELECT * FROM trades WHERE ${where} ORDER BY entry_date`).all(...params);

  if (trades.length === 0) return { totalTrades: 0, message: 'No closed trades yet' };

  const winners = trades.filter(t => t.pnl > 0);
  const losers = trades.filter(t => t.pnl <= 0);
  const totalPnl = trades.reduce((s, t) => s + (t.pnl || 0), 0);
  const avgWin = winners.length ? winners.reduce((s, t) => s + t.pnl, 0) / winners.length : 0;
  const avgLoss = losers.length ? losers.reduce((s, t) => s + t.pnl, 0) / losers.length : 0;
  const profitFactor = avgLoss !== 0 ? Math.abs(avgWin * winners.length / (avgLoss * losers.length)) : Infinity;
  const avgR = trades.filter(t => t.r_multiple != null).reduce((s, t) => s + t.r_multiple, 0) / trades.filter(t => t.r_multiple != null).length || 0;

  // Max drawdown
  let peak = 0, maxDD = 0, cumPnl = 0;
  for (const t of trades) {
    cumPnl += t.pnl || 0;
    if (cumPnl > peak) peak = cumPnl;
    const dd = peak - cumPnl;
    if (dd > maxDD) maxDD = dd;
  }

  return {
    totalTrades: trades.length,
    winRate: +(winners.length / trades.length * 100).toFixed(1),
    winners: winners.length,
    losers: losers.length,
    totalPnl: +totalPnl.toFixed(2),
    avgWin: +avgWin.toFixed(2),
    avgLoss: +avgLoss.toFixed(2),
    profitFactor: +profitFactor.toFixed(2),
    avgRMultiple: +avgR.toFixed(2),
    bestTrade: trades.reduce((best, t) => (!best || (t.pnl || 0) > (best.pnl || 0)) ? t : best, null),
    worstTrade: trades.reduce((worst, t) => (!worst || (t.pnl || 0) < (worst.pnl || 0)) ? t : worst, null),
    maxDrawdown: +maxDD.toFixed(2),
    byStrategy: getStatsByStrategy(trades)
  };
}

function getStatsByStrategy(trades) {
  const groups = {};
  for (const t of trades) {
    const s = t.strategy || 'unknown';
    if (!groups[s]) groups[s] = [];
    groups[s].push(t);
  }
  const result = {};
  for (const [strategy, strades] of Object.entries(groups)) {
    const w = strades.filter(t => t.pnl > 0);
    result[strategy] = {
      trades: strades.length,
      winRate: +(w.length / strades.length * 100).toFixed(1),
      totalPnl: +strades.reduce((s, t) => s + (t.pnl || 0), 0).toFixed(2)
    };
  }
  return result;
}

// In-memory fallback
const inMemoryTrades = [];
function inMemoryAdd(trade) {
  const t = { id: inMemoryTrades.length + 1, ...trade, created_at: new Date().toISOString() };
  inMemoryTrades.push(t);
  return t;
}
