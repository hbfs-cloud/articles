#!/usr/bin/env node
/**
 * purge-tkl-from-modes.js — One-off cleanup after introducing per-mode tklPoolEnabled flag.
 *
 * Reads each scan's signals.json#tkl_pool ticker list, then removes matching entries
 * from data/backtest-trades.json[mode] for any mode where tklPoolEnabled === false.
 *
 * Idempotent. Safe to re-run.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCANNER_DIR = path.join(ROOT, 'scanner');
const TRADES_FILE = path.join(ROOT, 'data/backtest-trades.json');
const MODES_FILE = path.join(ROOT, 'data/modes-config.json');

const cfg = JSON.parse(fs.readFileSync(MODES_FILE, 'utf8'));
const trades = JSON.parse(fs.readFileSync(TRADES_FILE, 'utf8'));

// Build (scanDate → Set<ticker>) for tkl_pool entries across all scanners
const tklByDate = {};
const dirs = fs.readdirSync(SCANNER_DIR).filter(d => /^\d{8}(-\d+)?$/.test(d));
for (const d of dirs) {
  const sigPath = path.join(SCANNER_DIR, d, 'signals.json');
  if (!fs.existsSync(sigPath)) continue;
  const sig = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
  const date = d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8);
  const pool = sig.tkl_pool || [];
  if (pool.length === 0) continue;
  const top10Tickers = new Set((sig.signals || []).map(s => s.ticker));
  // Only purge tickers that are in tkl_pool but NOT in the published Top 10
  const onlyTkl = new Set(pool.filter(s => !top10Tickers.has(s.ticker)).map(s => s.ticker));
  if (onlyTkl.size > 0) tklByDate[date] = onlyTkl;
}
console.log(`Found ${Object.keys(tklByDate).length} scan dates with tkl_pool entries`);

let totalPurged = 0;
for (const [modeId, m] of Object.entries(cfg.modes)) {
  if (m.tklPoolEnabled !== false) continue;
  const arr = trades[modeId] || [];
  const before = arr.length;
  const filtered = arr.filter(t => {
    const tklTickers = tklByDate[t.scanDate];
    if (!tklTickers) return true;
    return !tklTickers.has(t.ticker);
  });
  trades[modeId] = filtered;
  const removed = before - filtered.length;
  totalPurged += removed;
  console.log(`  ${modeId}: removed ${removed} tkl_pool entries (${before} → ${filtered.length})`);
}

fs.writeFileSync(TRADES_FILE, JSON.stringify(trades, null, 2));
console.log(`\nTotal purged: ${totalPurged} trade entries`);
console.log(`Wrote ${path.relative(ROOT, TRADES_FILE)}`);
