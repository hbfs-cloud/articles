/**
 * Watchlist sync + monitoring
 * Downloads scanner picks from Market Watch, monitors prices in realtime
 */

import * as yahoo from './yahoo.js';
import * as alerts from './alerts.js';

let currentWatchlist = null;
let syncInterval = null;
let monitorInterval = null;

// ══════════════════════════════════════
// SYNC FROM MARKET WATCH
// ══════════════════════════════════════

export async function sync(url = 'https://articles.market-watch.xyz/mcp/watchlist.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Watchlist sync failed: ${res.status}`);
  currentWatchlist = await res.json();

  // Auto-generate alerts from watchlist picks
  alerts.createWatchlistAlerts(currentWatchlist);

  console.error(`[Watchlist] Synced: ${currentWatchlist.picks?.length} picks, regime: ${currentWatchlist.regime}`);
  return currentWatchlist;
}

export function get() {
  return currentWatchlist;
}

export function getTickers() {
  if (!currentWatchlist?.picks) return [];
  return currentWatchlist.picks.map(p => p.ticker);
}

// ══════════════════════════════════════
// ADD CUSTOM TICKERS
// ══════════════════════════════════════

export function addTicker(ticker, opts = {}) {
  if (!currentWatchlist) currentWatchlist = { picks: [], custom: [] };
  if (!currentWatchlist.custom) currentWatchlist.custom = [];

  const existing = currentWatchlist.custom.find(t => t.ticker === ticker.toUpperCase());
  if (existing) return existing;

  const custom = {
    ticker: ticker.toUpperCase(),
    entry: opts.entry || null,
    stop: opts.stop || null,
    tp1: opts.tp1 || null,
    tp2: opts.tp2 || null,
    note: opts.note || '',
    addedAt: new Date().toISOString()
  };

  currentWatchlist.custom.push(custom);

  // Create alerts if levels provided
  if (custom.entry || custom.stop || custom.tp1) {
    alerts.createWatchlistAlerts({ picks: [custom] });
  }

  return custom;
}

export function removeTicker(ticker) {
  if (!currentWatchlist?.custom) return false;
  const idx = currentWatchlist.custom.findIndex(t => t.ticker === ticker.toUpperCase());
  if (idx === -1) return false;
  currentWatchlist.custom.splice(idx, 1);
  return true;
}

// ══════════════════════════════════════
// MONITORING LOOP
// ══════════════════════════════════════

export async function startMonitoring(intervalMs = 15000) {
  if (monitorInterval) clearInterval(monitorInterval);

  const check = async () => {
    try {
      const tickers = getAllTickers();
      if (tickers.length === 0) return;

      const quotes = await yahoo.getQuotes(tickers);
      const triggered = await alerts.checkAlerts(quotes);

      if (triggered.length > 0) {
        console.error(`[Monitor] ${triggered.length} alerts triggered:`, triggered.map(t => `${t.ticker}:${t.type}`).join(', '));
      }
    } catch (err) {
      console.error('[Monitor] Error:', err.message);
    }
  };

  // Initial check
  await check();
  monitorInterval = setInterval(check, intervalMs);
  console.error(`[Monitor] Started, checking every ${intervalMs / 1000}s for ${getAllTickers().length} tickers`);
}

export function stopMonitoring() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.error('[Monitor] Stopped');
  }
}

export function startAutoSync(url, intervalMs = 3600000) {
  if (syncInterval) clearInterval(syncInterval);
  sync(url); // initial sync
  syncInterval = setInterval(() => sync(url), intervalMs);
}

function getAllTickers() {
  const tickers = new Set();
  for (const p of currentWatchlist?.picks || []) tickers.add(p.ticker);
  for (const c of currentWatchlist?.custom || []) tickers.add(c.ticker);
  return [...tickers];
}

// ══════════════════════════════════════
// STATUS
// ══════════════════════════════════════

export function status() {
  return {
    synced: !!currentWatchlist,
    lastSync: currentWatchlist?.updated || null,
    regime: currentWatchlist?.regime || null,
    scannerPicks: currentWatchlist?.picks?.length || 0,
    customTickers: currentWatchlist?.custom?.length || 0,
    totalTickers: getAllTickers().length,
    monitoring: !!monitorInterval,
    activeAlerts: alerts.listAlerts({ status: 'active' }).length
  };
}
