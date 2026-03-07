/**
 * Tick Enricher — background worker that computes pattern scores
 * for tracked tickers and feeds them into the alert engine.
 *
 * Flow:
 *   1. Maintains a Set of tracked tickers (from alerts + watchlist)
 *   2. Every intervalMs (default 5min), pulls bars from SQLite storage
 *   3. Computes pattern scores via pattern-engine.js (pure, no I/O)
 *   4. Stores enrichment in _enriched Map
 *   5. Alert engine calls getEnrichment(symbol) before each tick eval
 *
 * If a ticker has no cached bars, it fetches from Yahoo/Binance and stores.
 * Errors per ticker are logged and do not block other tickers.
 */

import { enrichBars } from './pattern-engine.js';
import { getStorage } from './storage.js';
import * as yahoo from './yahoo.js';
import * as binance from './binance.js';
import * as universe from './universe.js';

const _enriched = new Map();   // symbol → enriched fields
const _tickers  = new Set();   // tracked symbols
const _errors   = [];          // last 50 per-ticker errors

let _timer       = null;
let _running     = false;
let _lastRun     = null;
let _lastCount   = 0;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Track a symbol for background enrichment.
 */
export function track(symbols) {
  for (const s of [symbols].flat()) _tickers.add(s.toUpperCase());
}

/**
 * Untrack symbols.
 */
export function untrack(symbols) {
  for (const s of [symbols].flat()) _tickers.delete(s.toUpperCase());
}

/**
 * Get the latest enrichment for a symbol.
 * Returns {} if not yet enriched (non-blocking).
 */
export function getEnrichment(symbol) {
  return _enriched.get(symbol.toUpperCase()) ?? {};
}

/**
 * Return all enriched symbols.
 */
export function allEnrichments() {
  return Object.fromEntries(_enriched);
}

// ─── Enrichment core ─────────────────────────────────────────────────────────

/**
 * Enrich one symbol: get bars from storage (or fetch if missing), run patterns.
 */
async function enrichOne(sym, quote = {}) {
  const storage = getStorage();
  let bars = storage.get(sym, '1d');

  // Fetch from source if not cached or stale (< 50 bars)
  if (bars.length < 50) {
    try {
      if (universe.isCrypto(sym)) {
        const data = await binance.getBars(sym, '1d', 365);
        bars = data.bars;
      } else {
        const data = await yahoo.getBars(sym, '1d', '2y');
        bars = data.bars;
      }
      if (bars.length > 0) storage.save(sym, '1d', bars, universe.isCrypto(sym) ? 'binance' : 'yahoo');
    } catch (e) {
      _logError(sym, `fetch failed: ${e.message}`);
      return null;
    }
  }

  if (bars.length < 5) return null;

  try {
    const enrichment = enrichBars(bars, quote);
    _enriched.set(sym, enrichment);
    return enrichment;
  } catch (e) {
    _logError(sym, `pattern error: ${e.message}`);
    return null;
  }
}

/**
 * Run enrichment on all tracked tickers.
 * Concurrency = 8 parallel, rate-limited to avoid hammering Yahoo.
 */
export async function runNow(extraQuotes = {}) {
  if (_running) return;
  _running = true;

  const syms = [..._tickers];
  let count  = 0;

  const BATCH = 8;
  for (let i = 0; i < syms.length; i += BATCH) {
    const batch = syms.slice(i, i + BATCH);
    await Promise.allSettled(
      batch.map(async sym => {
        const q = extraQuotes[sym] ?? {};
        const result = await enrichOne(sym, q);
        if (result) count++;
      })
    );
    // Small pause between batches (polite to Yahoo)
    if (i + BATCH < syms.length) await _sleep(300);
  }

  _lastRun   = new Date().toISOString();
  _lastCount = count;
  _running   = false;
  console.error(`[TickEnricher] Enriched ${count}/${syms.length} tickers`);
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

/**
 * Start background enrichment loop.
 * @param {number} intervalMs  default 5 minutes
 * @param {number} initialDelay default 10 seconds (let server start first)
 */
export function start(intervalMs = 5 * 60_000, initialDelay = 10_000) {
  if (_timer) return;
  setTimeout(() => {
    runNow().catch(e => console.error('[TickEnricher] runNow error:', e.message));
    _timer = setInterval(() => {
      runNow().catch(e => console.error('[TickEnricher] runNow error:', e.message));
    }, intervalMs);
  }, initialDelay);
  console.error(`[TickEnricher] Started — interval ${intervalMs / 1000}s, initial delay ${initialDelay / 1000}s`);
}

export function stop() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

// ─── Status ───────────────────────────────────────────────────────────────────

export function status() {
  const storage   = getStorage();
  const storeStat = storage.storageStats();
  return {
    running:       _running,
    timerActive:   !!_timer,
    lastRun:       _lastRun,
    lastEnriched:  _lastCount,
    trackedCount:  _tickers.size,
    trackedTickers: [..._tickers],
    enrichedCount: _enriched.size,
    recentErrors:  _errors.slice(-10),
    storage:       storeStat,
  };
}

export function getErrors() { return [..._errors]; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _logError(sym, msg) {
  const entry = { symbol: sym, msg, at: new Date().toISOString() };
  _errors.push(entry);
  if (_errors.length > 50) _errors.shift();
  console.error(`[TickEnricher] ${sym}: ${msg}`);
}

function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
