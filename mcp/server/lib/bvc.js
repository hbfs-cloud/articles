/**
 * Casablanca Bourse (BVC) data module
 * Source: https://api.casablanca-bourse.com/fr/api/bourse_data
 *
 * Two endpoints:
 *  1. /instrument        — list all instruments (symbol, drupalID, ISIN), paginated
 *  2. /instrument_history — OHLCV history for one instrument by drupalID, paginated
 *
 * Notes from systematic-tss:
 *  - BVC certificate chain is incomplete → TLS verification disabled per-request
 *  - Numbers returned as quoted strings ("755.3000000000")
 *  - ratioConsolide: split/dividend adjustment factor
 *  - Only daily bars available (no intraday)
 */

import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import * as cache from './cache.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '../../data/cache/bvc');
const BVC_BASE   = 'https://api.casablanca-bourse.com/fr/api/bourse_data';

// Custom HTTPS agent that skips TLS verification (BVC cert chain is broken)
const insecureAgent = new https.Agent({ rejectUnauthorized: false });

// ─── HTTP helper (uses https module — native fetch ignores agent option) ─────

function bvcFetch(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      agent: insecureAgent,
      headers: { 'Accept': 'application/vnd.api+json', 'User-Agent': 'Mozilla/5.0' },
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`BVC HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
        }
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`BVC JSON parse error: ${e.message}`)); }
      });
    });
    req.on('error', e => reject(new Error(`BVC fetch failed: ${url} — ${e.message}`)));
    req.end();
  });
}

// ─── Disk cache helpers ───────────────────────────────────────────────────────

function today() { return new Date().toISOString().slice(0, 10); }

function instrCachePath() {
  const dir = resolve(CACHE_DIR, today());
  mkdirSync(dir, { recursive: true });
  return resolve(dir, 'instruments.json');
}

function barsCachePath(symbol) {
  const dir = resolve(CACHE_DIR, today());
  mkdirSync(dir, { recursive: true });
  return resolve(dir, `${symbol}.json`);
}

function readJSON(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

// ─── Instruments (symbol list + drupal IDs) ───────────────────────────────────

/**
 * Load all BVC instruments (symbol → { symbol, instrumentID, isin }).
 * Paginated (page[limit]=200). Cached daily on disk + in-memory.
 * @returns {Promise<Record<string, {symbol: string, instrumentID: number, isin: string}>>}
 */
export async function loadInstruments() {
  const memKey = 'bvc:instruments';
  const mem = cache.get(memKey);
  if (mem) return mem;

  const path = instrCachePath();
  const disk = readJSON(path);
  if (disk && Object.keys(disk).length > 0) {
    cache.set(memKey, disk, 3600);
    return disk;
  }

  // Fetch paginated instrument list
  const instruments = {};
  let url = `${BVC_BASE}/instrument?fields%5Binstrument%5D=drupal_internal__id,symbol,codeISIN&page%5Blimit%5D=200`;
  let page = 0;

  while (url && page < 10) {
    page++;
    const json = await bvcFetch(url);
    for (const rec of (json.data || [])) {
      const { drupal_internal__id: id, symbol, codeISIN } = rec.attributes || {};
      if (!symbol || !id) continue;
      instruments[symbol.toUpperCase()] = {
        symbol:       symbol.toUpperCase(),
        instrumentID: id,
        isin:         codeISIN || null,
        name:         symbol.toUpperCase(),   // BVC doesn't return names in this endpoint
      };
    }
    url = json.links?.next?.href || null;
    if (url) await sleep(200);  // be polite
  }

  if (!Object.keys(instruments).length) throw new Error('BVC: no instruments found');

  writeFileSync(path, JSON.stringify(instruments), 'utf8');
  cache.set(memKey, instruments, 3600);
  console.error(`[bvc] Loaded ${Object.keys(instruments).length} instruments from Casablanca Bourse`);
  return instruments;
}

// ─── OHLCV bars ───────────────────────────────────────────────────────────────

/**
 * Fetch daily OHLCV bars for a BVC symbol.
 * @param {string} symbol  Ticker (e.g. ATW, BCP, IAM)
 * @returns {Promise<{symbol: string, bars: Array}>}
 */
export async function getBars(symbol) {
  const sym    = symbol.toUpperCase();
  const memKey = `bvc:bars:${sym}`;
  const mem    = cache.get(memKey);
  if (mem) return mem;

  // Disk cache
  const barsPath = barsCachePath(sym);
  const disk = readJSON(barsPath);
  if (disk?.bars?.length > 0) {
    cache.set(memKey, disk, 3600);
    return disk;
  }

  // Need instrumentID — load instruments first
  const instruments = await loadInstruments();
  const inst = instruments[sym];
  if (!inst) throw new Error(`BVC: unknown symbol "${sym}". Call loadInstruments() first.`);

  // Fetch history (paginated, up to 10 pages × 5000 records = 50k bars)
  const bars  = [];
  let   url   = buildHistoryURL(inst.instrumentID);
  let   page  = 0;

  while (url && page < 10) {
    page++;
    const json = await bvcFetch(url);
    for (const rec of (json.data || [])) {
      const bar = parseBar(rec.attributes);
      if (bar) bars.push(bar);
    }
    url = json.links?.next?.href || null;
    if (url) await sleep(200);
  }

  // Sort ascending by time
  bars.sort((a, b) => a.time < b.time ? -1 : a.time > b.time ? 1 : 0);

  const result = { symbol: sym, source: 'bvc', bars };
  writeFileSync(barsPath, JSON.stringify(result), 'utf8');
  cache.set(memKey, result, 3600);
  return result;
}

// ─── Get quote (latest bar as real-time proxy) ────────────────────────────────

/**
 * Get a quote-like object for a BVC symbol using the latest daily bar.
 * Since BVC has no real-time feed, the "quote" is the most recent close.
 */
export async function getQuote(symbol) {
  const { bars } = await getBars(symbol);
  if (!bars.length) return null;

  const last = bars[bars.length - 1];
  const prev = bars.length > 1 ? bars[bars.length - 2] : last;
  const changePct = prev.close ? +((last.close - prev.close) / prev.close * 100).toFixed(4) : 0;

  return {
    symbol:        symbol.toUpperCase(),
    price:         last.close,
    open:          last.open,
    high:          last.high,
    low:           last.low,
    previousClose: prev.close,
    changePct,
    volume:        last.volume,
    date:          last.time.slice(0, 10),
    source:        'bvc',
    exchange:      'CSE',  // Casablanca Stock Exchange
  };
}

// ─── Symbol helpers ───────────────────────────────────────────────────────────

/**
 * Returns true if a symbol is a BVC (Casablanca) ticker.
 * BVC symbols are short uppercase strings without exchange suffixes or USDT.
 * Since BVC symbols look like normal tickers (ATW, BCP, IAM), detection
 * requires matching against the known instrument list.
 */
export async function isBVC(symbol) {
  try {
    const instruments = await loadInstruments();
    return symbol.toUpperCase() in instruments;
  } catch {
    return false;
  }
}

// ─── Internals ────────────────────────────────────────────────────────────────

function buildHistoryURL(instrumentID) {
  // URL-encoded per BVC API requirements (square brackets must be %5B/%5D)
  return `${BVC_BASE}/instrument_history?` +
    `fields%5Binstrument_history%5D=drupal_internal__id,coursCourant,cumulVolumeEchange,created,lowPrice,highPrice,openingPrice,closingPrice,ratioConsolide` +
    `&sort%5Bdate-seance%5D%5Bdirection%5D=ASC` +
    `&sort%5Bdate-seance%5D%5Bpath%5D=created` +
    `&filter%5Binstrument%5D%5Bcondition%5D%5Bpath%5D=symbol.meta.drupal_internal__target_id` +
    `&filter%5Binstrument%5D%5Bcondition%5D%5Bvalue%5D=${instrumentID}` +
    `&filter%5Binstrument%5D%5Bcondition%5D%5Boperator%5D=%3D` +
    `&page%5Blimit%5D=5000`;
}

function parseBar(attr) {
  if (!attr?.created) return null;

  // Parse date — BVC returns "2026-02-18T00:00:00+01:00" or "2026-02-18"
  let dateStr = attr.created;
  if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
  const time = `${dateStr}T00:00:00.000Z`;

  const close  = parseRawFloat(attr.closingPrice) || parseRawFloat(attr.coursCourant);
  if (!close) return null;

  const open   = parseRawFloat(attr.openingPrice) || close;
  const high   = parseRawFloat(attr.highPrice)    || close;
  const low    = parseRawFloat(attr.lowPrice)     || close;
  const volume = parseRawFloat(attr.cumulVolumeEchange);

  const ratio    = parseRawFloat(attr.ratioConsolide);
  const adjClose = ratio ? +(close * ratio).toFixed(4) : close;

  return { time, open, high, low, close, volume, adjClose };
}

function parseRawFloat(raw) {
  if (raw == null || raw === 'null') return 0;
  const n = parseFloat(typeof raw === 'string' ? raw : String(raw));
  return isNaN(n) ? 0 : +n.toFixed(4);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
