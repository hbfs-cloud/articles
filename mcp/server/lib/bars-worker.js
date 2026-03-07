/**
 * Background Bars Worker
 *
 * Responsibilities:
 *  1. Auto-export SQLite bars → Parquet via DuckDB (every 6h by default)
 *  2. Clean intraday bars older than keepDays (default: 7 days) to limit disk usage
 *  3. Clean NDJSON temp files after successful Parquet export
 *
 * DuckDB is optional — if not installed, Parquet export is skipped gracefully.
 * Install: brew install duckdb (macOS) / https://duckdb.org/docs/installation/
 *
 * Parquet output: data/parquet/{SYMBOL}_{interval}.parquet
 * NDJSON temp:    data/parquet/tmp/{SYMBOL}_{interval}.ndjson  (auto-deleted)
 */

import { execFile } from 'child_process';
import { mkdirSync, existsSync, unlinkSync, readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getStorage } from './storage.js';

const __dirname   = dirname(fileURLToPath(import.meta.url));
const PARQUET_DIR = resolve(__dirname, '../../data/parquet');
const TMP_DIR     = join(PARQUET_DIR, 'tmp');

// ─── State ────────────────────────────────────────────────────────────────────

let _timer         = null;
let _running       = false;
let _lastRun       = null;
let _lastExport    = { count: 0, errors: 0, skipped: 0 };
let _lastClean     = { deleted: 0 };
let _duckdb        = null;    // null = unchecked, true/false = result

// ─── DuckDB probe ─────────────────────────────────────────────────────────────

function probeDuckDB() {
  return new Promise(resolve => {
    if (_duckdb !== null) { resolve(_duckdb); return; }
    execFile('duckdb', ['--version'], { timeout: 5_000 }, err => {
      _duckdb = !err;
      if (!_duckdb) {
        console.error('[bars-worker] DuckDB not found — Parquet export disabled.');
        console.error('[bars-worker] Install: brew install duckdb  or  https://duckdb.org/docs/installation/');
      }
      resolve(_duckdb);
    });
  });
}

// ─── Single-symbol Parquet export ─────────────────────────────────────────────

function exportToParquet(symbol, interval) {
  return new Promise(resolve => {
    const storage    = getStorage();
    const safeSym    = symbol.replace(/[^A-Za-z0-9-]/g, '_');
    const ndjsonPath = join(TMP_DIR, `${safeSym}_${interval}.ndjson`);
    const parqPath   = join(PARQUET_DIR, `${safeSym}_${interval}.parquet`);

    const written = storage.exportNDJSON(symbol, interval, ndjsonPath);
    if (!written) {
      resolve({ symbol, interval, status: 'empty' });
      return;
    }

    const sql = `COPY (SELECT * FROM read_ndjson('${ndjsonPath}', auto_detect=true)) TO '${parqPath}' (FORMAT PARQUET, COMPRESSION 'snappy')`;
    execFile('duckdb', ['-c', sql], { timeout: 60_000 }, err => {
      // Clean up temp NDJSON regardless of outcome
      try { unlinkSync(ndjsonPath); } catch { /* ignore */ }
      if (err) {
        resolve({ symbol, interval, status: 'error', error: err.message.slice(0, 200) });
      } else {
        resolve({ symbol, interval, status: 'ok', path: parqPath });
      }
    });
  });
}

// ─── Clean Parquet files for symbols no longer in storage ─────────────────────

function cleanOrphanedParquet(catalogSymbols) {
  if (!existsSync(PARQUET_DIR)) return 0;
  const known = new Set(catalogSymbols.map(({ symbol, interval }) => {
    const s = symbol.replace(/[^A-Za-z0-9-]/g, '_');
    return `${s}_${interval}.parquet`;
  }));
  let removed = 0;
  for (const f of readdirSync(PARQUET_DIR)) {
    if (!f.endsWith('.parquet')) continue;
    if (!known.has(f)) {
      try { unlinkSync(join(PARQUET_DIR, f)); removed++; } catch { /* ignore */ }
    }
  }
  return removed;
}

// ─── Main worker run ──────────────────────────────────────────────────────────

async function runWorker() {
  if (_running) return;
  _running = true;
  _lastRun = new Date().toISOString();

  try {
    const storage = getStorage();

    // 1. Clean old intraday bars
    const deleted = storage.cleanOldIntraday(7);
    _lastClean = { deleted, at: _lastRun };
    if (deleted > 0) {
      console.error(`[bars-worker] Cleaned ${deleted} old intraday bars`);
    }

    // 2. Export to Parquet if DuckDB available
    const hasDuckDB = await probeDuckDB();
    if (!hasDuckDB) return;

    const catalog = storage.catalog();
    if (!catalog.length) {
      _lastExport = { count: 0, errors: 0, skipped: 0, at: _lastRun };
      return;
    }

    mkdirSync(PARQUET_DIR, { recursive: true });
    mkdirSync(TMP_DIR,     { recursive: true });

    // Export all symbols in parallel (capped at 8 concurrent to avoid thrashing)
    const CONCURRENCY = 8;
    let count = 0, errors = 0, skipped = 0;

    for (let i = 0; i < catalog.length; i += CONCURRENCY) {
      const batch   = catalog.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(({ symbol, interval }) => exportToParquet(symbol, interval))
      );
      for (const r of results) {
        if (r.status !== 'fulfilled') { errors++; continue; }
        if (r.value.status === 'ok')    count++;
        else if (r.value.status === 'error') errors++;
        else skipped++;  // empty
      }
    }

    // Clean up Parquet files for removed symbols
    cleanOrphanedParquet(catalog);

    _lastExport = { count, errors, skipped, total: catalog.length, at: _lastRun };
    console.error(`[bars-worker] Parquet export done: ${count} ok, ${errors} errors, ${skipped} empty`);

  } catch (e) {
    console.error('[bars-worker] Unexpected error:', e.message);
  } finally {
    _running = false;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Start the background worker.
 * @param {number} intervalMs  Interval between runs (default: 6 hours)
 */
export function start(intervalMs = 6 * 3600_000) {
  if (_timer) return;
  // First run after 30s (let MCP finish startup), then on interval
  setTimeout(() => runWorker().catch(console.error), 30_000);
  _timer = setInterval(() => runWorker().catch(console.error), intervalMs);
  _timer.unref?.();
  console.error(`[bars-worker] Started — interval: ${intervalMs / 3600_000}h, Parquet dir: ${PARQUET_DIR}`);
}

export function stop() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

/**
 * Force an immediate export run (async).
 */
export function runNow() {
  return runWorker();
}

export function status() {
  const storage = getStorage();
  return {
    running:        _running,
    lastRun:        _lastRun,
    lastExport:     _lastExport,
    lastClean:      _lastClean,
    duckdbAvailable: _duckdb,
    parquetDir:     PARQUET_DIR,
    storage:        storage.storageStats(),
  };
}
