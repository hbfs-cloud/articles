/**
 * Universe management — Dynamic via StockAnalysis.com API
 *
 * Replaces static hardcoded lists with live data from StockAnalysis.com,
 * covering 15,000+ stocks and ETFs across all major markets.
 *
 * Features:
 *  - Daily disk cache (date-stamped JSON, auto-cleaned after 3 days)
 *  - Rich metadata: sector, marketCap, dollarVolume, RSI, MAs, exchange, ISIN
 *  - Configurable minDolVol filter (default 500K)
 *  - Supports US, EU (GB/DE/FR/NL/IT/ES/SE/CH/...), APAC (JP/KR/HK/AU/...)
 *
 * API reference (same pattern as systematic-tss staticdata.go):
 *   Stocks: https://stockanalysis.com/api/screener/s/bd/{fields}.json[?c=CC]
 *   ETFs:   https://stockanalysis.com/api/screener/e/bd/{fields}.json[?c=CC]
 *   Response: { data: { data: { "AAPL": { n, marketCap, sector, ... } } } }
 */

import * as cache from './cache.js';
import { mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '../../data/cache/stockanalysis');

// ─── StockAnalysis API ────────────────────────────────────────────────────────

const SA_BASE = 'https://stockanalysis.com/api/screener';

// Fields requested from the stock screener
const SA_STOCK_FIELDS = [
  'n','marketCap','sector','industry','dollarVolume','avgVol',
  'close','high52','low52','ma50','ma200','rsi',
  'beta','exchange','country','isin','currency','marketCapCat'
].join('+');

// Fields requested from the ETF screener
const SA_ETF_FIELDS = [
  'n','assetClass','etfCategory','etfCountry','etfRegion',
  'exchange','dollarVolume','avgVol','close'
].join('+');

const SA_HEADERS = {
  'User-Agent':  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Accept':      'application/json',
  'Referer':     'https://stockanalysis.com/'
};

// ─── Country code mapping ─────────────────────────────────────────────────────
// SA uses ISO 3166-1 alpha-2; US = no param (or empty string)

const COUNTRY_CODES = {
  us: '', uk: 'GB', gb: 'GB',
  de: 'DE', fr: 'FR', nl: 'NL', it: 'IT', es: 'ES',
  se: 'SE', ch: 'CH', no: 'NO', dk: 'DK', fi: 'FI',
  be: 'BE', at: 'AT', pt: 'PT', ie: 'IE', pl: 'PL',
  jp: 'JP', kr: 'KR', hk: 'HK', au: 'AU', sg: 'SG',
  tw: 'TW', cn: 'CN', in: 'IN', nz: 'NZ',
  ca: 'CA', br: 'BR', mx: 'MX', za: 'ZA',
};

// ─── Crypto universe (hardcoded — StockAnalysis doesn't list crypto) ──────────
// Yahoo Finance symbols for top crypto pairs

const CRYPTO_SYMBOLS = [
  'BTC-USD','ETH-USD','BNB-USD','SOL-USD','XRP-USD','DOGE-USD',
  'ADA-USD','AVAX-USD','DOT-USD','LINK-USD','LTC-USD',
  'BCH-USD','UNI-USD','ATOM-USD','APT-USD','ARB-USD',
  'SUI-USD','TRX-USD','SHIB-USD','TON-USD','PEPE-USD',
  'INJ-USD','SEI-USD','WLD-USD','JUP-USD'
];

// ─── Universe definitions ─────────────────────────────────────────────────────
// Each entry: { type, countries[], minDolVol, minMcap?, maxMcap?, cap? }
// cap: max symbols returned by get() — taken from top dollarVolume after filtering.
//      Prevents screeners from hitting Yahoo with thousands of requests.
//      getWithMeta() always returns the full filtered list (no cap).

// NOTE: marketCap and dollarVolume from StockAnalysis are in raw USD dollars.
//   dollarVolume: daily $ traded  (e.g. NVDA = $33B/day)
//   marketCap:    market cap $    (e.g. NVDA = $4.3T = 4_300_000_000_000)
//
// cap: max symbols returned by get() — top N by dollarVolume.
//   Keeps screeners from making thousands of Yahoo API requests.
//   getWithMeta() returns the full filtered list (no cap applied).

const _M  = 1_000_000;       // 1 million USD
const _B  = 1_000_000_000;   // 1 billion USD

const UNIVERSE_CONFIG = {
  // US stocks
  us:       { type: 'stock', countries: ['us'], minDolVol:   5 * _M,              cap: 800 },
  us_large: { type: 'stock', countries: ['us'], minDolVol:  50 * _M, minMcap: 2 * _B,  cap: 500 },
  us_mid:   { type: 'stock', countries: ['us'], minDolVol:   5 * _M, minMcap: 300 * _M, maxMcap: 10 * _B, cap: 400 },
  us_small: { type: 'stock', countries: ['us'], minDolVol:   1 * _M, maxMcap: 2 * _B,  cap: 300 },

  // Europe — main markets combined
  eu:       { type: 'stock', countries: ['gb','de','fr','nl','it','es','se','ch','be','at','no','dk','fi','pt'], minDolVol: 5 * _M,  cap: 400 },
  eu_large: { type: 'stock', countries: ['gb','de','fr','nl','it','es','se','ch'], minDolVol: 10 * _M, minMcap: 1 * _B, cap: 200 },
  uk:       { type: 'stock', countries: ['gb'], minDolVol: 2 * _M, cap: 150 },
  de:       { type: 'stock', countries: ['de'], minDolVol: 2 * _M, cap: 100 },
  fr:       { type: 'stock', countries: ['fr'], minDolVol: 2 * _M, cap: 100 },
  ch:       { type: 'stock', countries: ['ch'], minDolVol: 2 * _M, cap:  80 },

  // APAC
  apac:     { type: 'stock', countries: ['jp','kr','hk','au','sg','tw','cn','in'], minDolVol: 5 * _M, cap: 300 },
  jp:       { type: 'stock', countries: ['jp'], minDolVol: 3 * _M, cap: 150 },
  kr:       { type: 'stock', countries: ['kr'], minDolVol: 3 * _M, cap: 100 },
  au:       { type: 'stock', countries: ['au'], minDolVol: 1 * _M, cap: 100 },
  hk:       { type: 'stock', countries: ['hk'], minDolVol: 3 * _M, cap: 100 },

  // ETFs — top liquid only
  etf:      { type: 'etf', countries: ['us'], minDolVol: 10 * _M, cap: 200 },
  etf_eu:   { type: 'etf', countries: ['gb','de','fr'], minDolVol: 2 * _M, cap: 100 },

  // Combined
  all:      { type: 'both', countries: ['us','gb','de','fr','nl','jp','kr','hk','au'], minDolVol: 20 * _M, cap: 600 },
};

// ─── Disk cache helpers ───────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function diskCachePath(type, country) {
  const dir = join(CACHE_DIR, type, country || 'us');
  mkdirSync(dir, { recursive: true });
  return join(dir, `tickers-${todayStr()}.json`);
}

function readDiskCache(type, country) {
  const p = diskCachePath(type, country);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

function writeDiskCache(type, country, data) {
  const p = diskCachePath(type, country);
  try { writeFileSync(p, JSON.stringify(data), 'utf8'); } catch { /* ignore */ }
}

// Remove disk cache files older than maxAgeDays (run once per process)
let _cleanedUp = false;
function cleanOldCaches(maxAgeDays = 3) {
  if (_cleanedUp) return;
  _cleanedUp = true;
  const cutoff = Date.now() - maxAgeDays * 86_400_000;
  try {
    const walk = (dir) => {
      if (!existsSync(dir)) return;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) { walk(p); continue; }
        if (!entry.name.startsWith('tickers-')) continue;
        const dateStr = entry.name.replace('tickers-', '').replace('.json', '');
        if (new Date(dateStr).getTime() < cutoff) {
          try { unlinkSync(p); } catch { /* ignore */ }
        }
      }
    };
    walk(CACHE_DIR);
  } catch { /* non-fatal */ }
}

// ─── StockAnalysis fetch ──────────────────────────────────────────────────────

async function fetchFromSA(type, country) {
  cleanOldCaches();

  const memKey = `sa:${type}:${country || 'us'}`;
  const memCached = cache.get(memKey);
  if (memCached) return memCached;

  const disk = readDiskCache(type, country);
  if (disk) {
    cache.set(memKey, disk, 3600);
    return disk;
  }

  const cc  = COUNTRY_CODES[country] ?? (country?.length === 2 ? country.toUpperCase() : '');
  const qs  = cc ? `?c=${cc}` : '';
  const url = type === 'etf'
    ? `${SA_BASE}/e/bd/${SA_ETF_FIELDS}.json${qs}`
    : `${SA_BASE}/s/bd/${SA_STOCK_FIELDS}.json${qs}`;

  let res;
  try {
    res = await fetch(url, { headers: SA_HEADERS, signal: AbortSignal.timeout(20_000) });
  } catch (e) {
    console.error(`[universe] SA fetch failed (${type}/${country || 'us'}): ${e.message}`);
    return {};
  }

  if (!res.ok) {
    console.error(`[universe] SA HTTP ${res.status} for ${url}`);
    return {};
  }

  let json;
  try { json = await res.json(); } catch { return {}; }

  // Response shape: { data: { data: { "AAPL": { n, marketCap, ... }, ... } } }
  const raw = json?.data?.data ?? {};
  const result = {};

  for (const [sym, f] of Object.entries(raw)) {
    result[sym.toUpperCase()] = {
      symbol:       sym.toUpperCase(),
      name:         f.n         ?? sym,
      sector:       f.sector    ?? null,
      industry:     f.industry  ?? null,
      marketCap:    f.marketCap ?? null,   // $M
      marketCapCat: f.marketCapCat ?? null,
      dollarVolume: f.dollarVolume ?? null,
      avgVol:       f.avgVol    ?? null,
      close:        f.close     ?? null,
      high52:       f.high52    ?? null,
      low52:        f.low52     ?? null,
      ma50:         f.ma50      ?? null,
      ma200:        f.ma200     ?? null,
      rsi:          f.rsi       ?? null,
      beta:         f.beta      ?? null,
      exchange:     f.exchange  ?? null,
      country:      f.country   ?? null,
      isin:         f.isin      ?? null,
      currency:     f.currency  ?? null,
      // ETF-specific
      assetClass:   f.assetClass   ?? null,
      etfCategory:  f.etfCategory  ?? null,
      etfCountry:   f.etfCountry   ?? null,
      etfRegion:    f.etfRegion    ?? null,
      type:         type === 'etf' ? 'ETF' : 'EQUITY',
    };
  }

  cache.set(memKey, result, 3600);
  writeDiskCache(type, country, result);
  return result;
}

// ─── Build universe (multi-country merge + filter) ────────────────────────────

async function buildUniverse(config) {
  const { type, countries, minDolVol = 0, minMcap = null, maxMcap = null } = config;
  const types = type === 'both' ? ['stock', 'etf'] : [type];
  const merged = {};

  // Fetch all countries in parallel
  await Promise.allSettled(
    types.flatMap(t => countries.map(async c => {
      const data = await fetchFromSA(t, c);
      Object.assign(merged, data);
    }))
  );

  // Filter
  const filtered = {};
  for (const [sym, meta] of Object.entries(merged)) {
    if (minDolVol && (meta.dollarVolume ?? 0) < minDolVol) continue;
    if (minMcap   && (meta.marketCap   ?? 0) < minMcap)   continue;
    if (maxMcap   && (meta.marketCap   ?? Infinity) > maxMcap) continue;
    filtered[sym] = meta;
  }
  return filtered;
}

// ─── SA symbol → Yahoo Finance symbol conversion ──────────────────────────────
// StockAnalysis uses {EXCHANGE_CODE}/{TICKER} for non-US stocks.
// Yahoo Finance uses {TICKER}.{SUFFIX} format.

const SA_TO_YF_SUFFIX = {
  // Europe
  'ETR':  '.DE',   // Deutsche Börse Xetra (Germany)
  'FRA':  '.F',    // Frankfurt (Germany, less liquid)
  'EPA':  '.PA',   // Euronext Paris (France)
  'AMS':  '.AS',   // Euronext Amsterdam (Netherlands)
  'BIT':  '.MI',   // Borsa Italiana (Italy)
  'BME':  '.MC',   // Bolsa Madrid (Spain)
  'STO':  '.ST',   // Nasdaq Stockholm (Sweden)
  'NGM':  '.ST',   // Nordic Growth Market (Sweden, same suffix)
  'OSL':  '.OL',   // Oslo Stock Exchange (Norway)
  'CPH':  '.CO',   // Nasdaq Copenhagen (Denmark)
  'HEL':  '.HE',   // Nasdaq Helsinki (Finland)
  'SWX':  '.SW',   // SIX Swiss Exchange
  'VIE':  '.VI',   // Vienna Stock Exchange
  'EBR':  '.BR',   // Euronext Brussels (Belgium)
  'ELI':  '.LS',   // Euronext Lisbon (Portugal)
  'XSAT': '.ST',   // Nasdaq First North (Sweden)
  // APAC
  'TYO':  '.T',    // Tokyo Stock Exchange (Japan)
  'TSE':  '.T',    // Tokyo (alt code)
  'KRX':  '.KS',   // Korea Stock Exchange
  'XKRX': '.KS',
  'HKEX': '.HK',   // Hong Kong Exchanges
  'ASX':  '.AX',   // Australian Securities Exchange
  'SGX':  '.SI',   // Singapore Exchange
  'TWSE': '.TW',   // Taiwan Stock Exchange
  'TAI':  '.TW',
  'SHH':  '.SS',   // Shanghai Stock Exchange
  'SHZ':  '.SZ',   // Shenzhen Stock Exchange
  'NSE':  '.NS',   // India NSE
  'BSE':  '.BO',   // India BSE
  // Americas (non-US)
  'TSX':  '.TO',   // Toronto Stock Exchange (Canada)
  'TSXV': '.V',    // TSX Venture
  'BVMF': '.SA',   // Brazil B3
  'BMV':  '.MX',   // Mexico
  // Other
  'JSE':  '.JO',   // Johannesburg
};

/**
 * Convert a StockAnalysis symbol to Yahoo Finance format.
 * US symbols (no prefix) are returned unchanged.
 * Returns null if the exchange code is unknown.
 */
export function saToYahoo(saSymbol) {
  if (!saSymbol.includes('/')) return saSymbol;  // US stock, no conversion needed

  const slashIdx  = saSymbol.indexOf('/');
  const exchange  = saSymbol.slice(0, slashIdx);
  const ticker    = saSymbol.slice(slashIdx + 1);
  const suffix    = SA_TO_YF_SUFFIX[exchange];

  if (!suffix) return null;  // unknown exchange — skip

  // Share-class dots: INVE.B → INVE-B (Yahoo uses dash, SA uses dot)
  const yahooTicker = ticker.replace(/\.([A-Z])$/, '-$1');

  return `${yahooTicker}${suffix}`;
}

// ─── In-memory universe cache ─────────────────────────────────────────────────

const _built = new Map();

async function getBuilt(name) {
  if (_built.has(name)) return _built.get(name);

  const config = UNIVERSE_CONFIG[name.toLowerCase()];
  if (!config) return {};

  const data = await buildUniverse(config);
  _built.set(name, data);

  // Expire in-memory at midnight (so next day picks up fresh SA data)
  const msToMidnight = new Date().setHours(24, 0, 0, 0) - Date.now();
  setTimeout(() => _built.delete(name), msToMidnight).unref?.();

  return data;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get symbol array for a universe, sorted by dollarVolume desc.
 * Applies the universe cap (if configured) to keep screener calls manageable.
 * @param {string} name  Universe key (us, us_large, eu, apac, etf, crypto, all, …)
 * @returns {Promise<string[]>}
 */
export async function get(name) {
  const key = name.toLowerCase();
  if (key === 'crypto') return [...CRYPTO_SYMBOLS];

  const meta   = await getBuilt(key);
  const sorted = Object.values(meta)
    .sort((a, b) => (b.dollarVolume ?? 0) - (a.dollarVolume ?? 0));
  const config = UNIVERSE_CONFIG[key];
  const capped = config?.cap ? sorted.slice(0, config.cap) : sorted;

  // Convert SA symbol format to Yahoo Finance format; drop unknowns
  return capped
    .map(m => saToYahoo(m.symbol))
    .filter(Boolean);
}

/**
 * Get full metadata objects for a universe, sorted by dollarVolume desc.
 * Returns all filtered symbols (no cap — intended for metadata/analysis, not live screeners).
 * @param {string} name  Universe key
 * @returns {Promise<object[]>}
 */
export async function getWithMeta(name) {
  const key = name.toLowerCase();
  if (key === 'crypto') {
    return CRYPTO_SYMBOLS.map(s => ({ symbol: s, yahooSymbol: s, type: 'CRYPTO', name: s }));
  }
  const meta = await getBuilt(key);
  return Object.values(meta)
    .sort((a, b) => (b.dollarVolume ?? 0) - (a.dollarVolume ?? 0))
    .map(m => ({ ...m, yahooSymbol: saToYahoo(m.symbol) }))
    .filter(m => m.yahooSymbol !== null);  // drop stocks on unknown exchanges
}

/**
 * List all configured universes. Returns live counts for already-cached ones.
 */
export function list() {
  return Object.entries(UNIVERSE_CONFIG).map(([key, cfg]) => ({
    key,
    type:      cfg.type,
    countries: cfg.countries,
    count:     _built.has(key) ? Object.keys(_built.get(key)).length : null,
    minDolVol: cfg.minDolVol,
  }));
}

/**
 * Pre-fetch a specific country (stocks or ETFs) and warm the cache.
 */
export async function fetchCountry(country, type = 'stock') {
  return fetchFromSA(type, country);
}

// ─── Yahoo Finance dynamic screeners (compatibility) ─────────────────────────

const YF_SCREENER = 'https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved';
const YF_SEARCH   = 'https://query1.finance.yahoo.com/v1/finance/search';
const YF_HEADERS  = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' };

export const YF_SCREENER_IDS = {
  most_actives:      'most_actives',
  day_gainers:       'day_gainers',
  day_losers:        'day_losers',
  undervalued_large: 'undervalued_large_caps',
  growth_tech:       'growth_technology_stocks',
  aggressive_small:  'aggressive_small_caps',
  high_yield_bond:   'high_yield_bond'
};

export async function searchTickers(query, type = null, count = 20) {
  const cacheKey = `universe:search:${query}:${type}`;
  const cached   = cache.get(cacheKey);
  if (cached) return cached;

  const url = `${YF_SEARCH}?q=${encodeURIComponent(query)}&quotesCount=${count}&newsCount=0`;
  const res = await fetch(url, { headers: YF_HEADERS }).catch(() => null);
  if (!res?.ok) return [];

  const data    = await res.json();
  const results = (data.quotes || [])
    .filter(q => !type || q.quoteType?.toLowerCase() === type.toLowerCase())
    .map(q => ({
      symbol:   q.symbol,
      name:     q.shortname || q.longname,
      exchange: q.exchange,
      type:     q.quoteType,
    }));

  cache.set(cacheKey, results, 3600);
  return results;
}

export async function fetchYahooScreener(scrId, count = 50) {
  const cacheKey = `universe:screener:${scrId}:${count}`;
  const cached   = cache.get(cacheKey);
  if (cached) return cached;

  const url = `${YF_SCREENER}?scrIds=${scrId}&count=${count}&start=0`;
  const res = await fetch(url, { headers: YF_HEADERS }).catch(() => null);
  if (!res?.ok) return [];

  const data    = await res.json();
  const symbols = (data.finance?.result?.[0]?.quotes || []).map(q => q.symbol).filter(Boolean);

  cache.set(cacheKey, symbols, 600);
  return symbols;
}
