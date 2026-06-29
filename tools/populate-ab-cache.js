#!/usr/bin/env node
'use strict';

/**
 * populate-ab-cache.js — Pre-populate the price cache for candlestick-scanner.js
 *
 * Reads QueryData JSON results from stdin and writes to data/.price-cache/<T>_ohlcv.json.
 * Designed to be called by Claude agents that fetch data via MCP QueryData tool,
 * then pipe the JSON results here.
 *
 * Usage (from Claude agent):
 *   1. Call MCP QueryData(symbols="AAPL,MSFT,...", types="bars_daily", days=200)
 *   2. Pipe the JSON result: echo '<result>' | node tools/populate-ab-cache.js
 *
 * Or with a file:
 *   node tools/populate-ab-cache.js --file /tmp/query-result.json
 *
 * Or list the universe tickers (for the agent to batch):
 *   node tools/populate-ab-cache.js --list-universe
 *   node tools/populate-ab-cache.js --list-universe --batch-size 200
 *
 * Or check cache freshness:
 *   node tools/populate-ab-cache.js --check-cache
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CACHE_DIR = path.join(ROOT, 'data', '.price-cache');
const UNIVERSE_FILE = path.join(ROOT, 'data', 'americanbull-universe.json');

const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}
const hasFlag = name => args.includes(`--${name}`);

// ─── List universe tickers (for agent to batch into QueryData calls) ────────
if (hasFlag('list-universe')) {
  const batchSize = parseInt(getArg('batch-size', '200'));
  const data = JSON.parse(fs.readFileSync(UNIVERSE_FILE, 'utf8'));
  const tickers = data.tickers || [];
  const batches = [];
  for (let i = 0; i < tickers.length; i += batchSize) {
    batches.push(tickers.slice(i, i + batchSize).join(','));
  }
  console.log(JSON.stringify({ total: tickers.length, batches: batches.length, batchSize, symbols: batches }));
  process.exit(0);
}

// ─── Check cache freshness ─────────────────────────────────────────────────
if (hasFlag('check-cache')) {
  const maxAge = parseFloat(getArg('max-age', '12'));
  const data = JSON.parse(fs.readFileSync(UNIVERSE_FILE, 'utf8'));
  const tickers = data.tickers || [];
  let fresh = 0, stale = 0, missing = 0;
  const now = Date.now();
  for (const t of tickers) {
    const fp = path.join(CACHE_DIR, `${t}_ohlcv.json`);
    if (!fs.existsSync(fp)) { missing++; continue; }
    const age = (now - fs.statSync(fp).mtimeMs) / 3600000;
    if (age <= maxAge) fresh++; else stale++;
  }
  console.log(JSON.stringify({ total: tickers.length, fresh, stale, missing, needsRefresh: stale + missing }));
  process.exit(0);
}

// ─── Ingest QueryData results into cache ───────────────────────────────────

function rowsToBars(rows) {
  const bars = [];
  for (const row of (rows || [])) {
    if (!Array.isArray(row) || row.length < 5) continue;
    const [d, o, h, l, c, v] = row;
    if (o == null || h == null || l == null || c == null) continue;
    bars.push({ date: d, open: o, high: h, low: l, close: c, volume: v || 0 });
  }
  return bars;
}

async function ingest(jsonStr) {
  const data = JSON.parse(jsonStr);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  let written = 0;
  for (const r of (data.results || [])) {
    if (r.data_type !== 'bars_daily' || !r.data) continue;
    const syms = r.symbols || [];
    for (let i = 0; i < syms.length; i++) {
      const bars = rowsToBars(r.data[i]);
      if (bars.length >= 60) {
        fs.writeFileSync(path.join(CACHE_DIR, `${syms[i]}_ohlcv.json`), JSON.stringify(bars));
        written++;
      }
    }
  }
  console.log(JSON.stringify({ written, symbols: written }));
}

// Read from file or stdin
const inputFile = getArg('file', null);
if (inputFile) {
  ingest(fs.readFileSync(inputFile, 'utf8')).catch(e => { console.error(e.message); process.exit(1); });
} else {
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', c => buf += c);
  process.stdin.on('end', () => ingest(buf).catch(e => { console.error(e.message); process.exit(1); }));
}
