'use strict';
/**
 * dtx-bars.js — assemble PIT-safe bars {TICKER:[bars]} for a dtx book config, from our price cache.
 *
 * Two jobs:
 *  1. resolveUniverse(config) — turn a portfolio_*.yaml allocation into a concrete ticker list.
 *     - Explicit lists win: `whitelist` (stocks/index), `forex_universe`, `crypto_universe`.
 *     - Region+flags with NO explicit list (us_highvol, etf_us/eu, uk): intersect our price-cache
 *       with a sensible, documented heuristic + cap. ⚠️ This is CURRENT-membership → survivorship
 *       biased; a proper point-in-time universe list is a Phase-2 follow-up (see UNIVERSE_NOTE).
 *  2. buildBars(symbols, asof) — read each symbol from the dated PIT price-cache (price-cache.js),
 *     TRUNCATE to bar.date <= asof (anti-look-ahead — the legacy flat cache is NOT auto-truncated),
 *     emit under the CONFIG symbol key the engine expects.
 *
 * The engine (injected mode) scans the symbols present in the bars map, applying the YAML filters
 * (blacklist, scanner_filters) on top. So bars keys MUST match the config's universe symbol form
 * (forex "EURUSD" not "EURUSD=X"; crypto "BTC-USDC" not "BTC-USD") — we source from the differently
 * named cache file but re-key to the config form.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const priceCache = require('./price-cache');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(REPO_ROOT, 'data');
const FLAT_CACHE_DIR = priceCache.PRICE_CACHE_ROOT; // data/.price-cache

const DEFAULT_STOCK_CAP = 1200; // documented cap for region-based stock universes (survivorship note)
const DEFAULT_ETF_CAP = 1500;

const UNIVERSE_NOTE =
  'CURRENT price-cache membership (survivorship-biased). Phase-2: swap for point-in-time universe lists.';

// ---------------------------------------------------------------------------
// Cache ticker inventory
// ---------------------------------------------------------------------------

let _cacheTickersCache = null;
/** All tickers present as legacy flat arrays in data/.price-cache/<T>_ohlcv.json. */
function listCacheTickers() {
  if (_cacheTickersCache) return _cacheTickersCache;
  let files = [];
  try { files = fs.readdirSync(FLAT_CACHE_DIR); } catch (_) { files = []; }
  const set = new Set();
  for (const f of files) {
    const m = /^(.+)_ohlcv\.json$/.exec(f);
    if (m) set.add(m[1]);
  }
  _cacheTickersCache = set;
  return set;
}

function loadJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return null; }
}

/** Load a curated universe file's ticker array (etf/forex/crypto/metals). Returns [] on miss. */
function loadUniverseFile(name) {
  const j = loadJSON(path.join(DATA_DIR, name));
  if (!j) return [];
  if (Array.isArray(j)) return j.map(String);
  // {tickers:[...]} or {etfs:[{symbol}]} or {symbols:[...]}
  if (Array.isArray(j.tickers)) return j.tickers.map(String);
  if (Array.isArray(j.symbols)) return j.symbols.map(String);
  if (Array.isArray(j.etfs)) return j.etfs.map((e) => (typeof e === 'string' ? e : e.symbol)).filter(Boolean);
  return [];
}

// ---------------------------------------------------------------------------
// Config parsing
// ---------------------------------------------------------------------------

/** Read a portfolio_*.yaml → { id, name, currency, initial_capital, allocations:[...] }. */
function readConfig(portfolioPath) {
  const raw = fs.readFileSync(portfolioPath, 'utf8');
  const doc = yaml.load(raw);
  const p = doc && doc.portfolios && doc.portfolios[0];
  if (!p) throw new Error(`dtx-bars: no portfolios[0] in ${portfolioPath}`);
  return p;
}

function splitCsv(v) {
  if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

// ---------------------------------------------------------------------------
// Symbol → cache-file variant resolution
// ---------------------------------------------------------------------------

/** Given a config symbol and asset market, return candidate cache-ticker forms (ordered). */
function cacheVariants(configSym, market) {
  const s = configSym;
  if (market === 'FX') {
    // config "EURUSD" → cache "EURUSD=X" (yahoo), then "EURUSD_X", then bare.
    return [`${s}=X`, `${s}_X`, s];
  }
  if (market === 'CRYPTO') {
    // config "BTC-USDC" → cache "BTC-USD"; also try as-is.
    return [s.replace(/-USDC$/, '-USD'), s, `${s.replace(/-USDC$/, '')}-USD`];
  }
  return [s];
}

/** First cache-ticker variant that actually has a flat cache file. null if none. */
function findCacheTicker(configSym, market, cacheSet) {
  for (const v of cacheVariants(configSym, market)) {
    if (cacheSet.has(v)) return v;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Universe resolution
// ---------------------------------------------------------------------------

/** Heuristic classifiers on cache-ticker strings. */
const isForexTicker = (t) => /(=X|_X)$/.test(t);
const isCryptoTicker = (t) => /-USD[CT]?$/.test(t);
const isForeignTicker = (t) => /\.[A-Z]{1,3}$/.test(t); // .L .PA .DE .TO ...
const isUkTicker = (t) => /\.L$/.test(t);

/**
 * Resolve a config allocation → concrete universe.
 * @returns { market, source, symbols:[configSym], note }
 *   market ∈ {US, FX, CRYPTO, CVA}. source describes how the list was derived.
 */
function resolveUniverse(allocation, opts = {}) {
  const cacheSet = opts.cacheSet || listCacheTickers();
  const a = allocation;

  // 1) Forex — explicit forex_universe
  if (a.forex || Array.isArray(a.forex_universe)) {
    const symbols = splitCsv(a.forex_universe);
    return { market: 'FX', source: 'forex_universe', symbols, note: 'explicit forex pairs' };
  }

  // 2) Crypto — explicit crypto_universe (fallback to curated crypto-universe.json)
  if (a.crypto || Array.isArray(a.crypto_universe)) {
    let symbols = splitCsv(a.crypto_universe);
    if (!symbols.length) symbols = loadUniverseFile('crypto-universe.json');
    return { market: 'CRYPTO', source: a.crypto_universe ? 'crypto_universe' : 'crypto-universe.json', symbols, note: 'crypto pairs' };
  }

  // 3) Explicit whitelist (index-rotation stockbox/dax, metals GLD/SLV, ...)
  if (a.whitelist) {
    const symbols = splitCsv(a.whitelist);
    return { market: 'US', source: 'whitelist', symbols, note: 'explicit whitelist' };
  }

  // 4) Region-based, no explicit list → intersect cache (documented, survivorship-biased).
  const region = String(a.region || '').toUpperCase();
  const blacklist = new Set(splitCsv(a.blacklist));
  const scannerBlacklist = new Set(
    splitCsv((a.scanner_filters && a.scanner_filters.params && a.scanner_filters.params.blacklist) || [])
  );
  const drop = (t) => blacklist.has(t) || scannerBlacklist.has(t);

  // 4a) ETFs → curated ETF universe ∩ cache
  if (a.etfs && !a.stocks) {
    const isEU = /(FR|DE|NL|IT|ES|EU)/.test(region);
    const file = isEU ? 'etf-eu-universe.json' : 'etf-us-universe.json';
    const uni = loadUniverseFile(file);
    const symbols = uni.filter((t) => cacheSet.has(t) && !drop(t)).slice(0, opts.cap || DEFAULT_ETF_CAP);
    return { market: 'US', source: `${file} ∩ cache`, symbols, note: UNIVERSE_NOTE };
  }

  // 4b) Foreign stock regions (UK/JP/IN/DE/FR/...) → intersect cache by Yahoo suffix.
  //     NEVER substitute US stocks for a foreign config (that silently produces bogus metrics).
  //     If the cache has no coverage for the region, return an EMPTY universe → the mode fails
  //     honestly ("no bars resolved") instead of scanning the wrong market.
  const REGION_SUFFIX = { UK: ['.L'], JP: ['.T'], IN: ['.NS', '.BO'], DE: ['.DE'], FR: ['.PA'], NL: ['.AS'], IT: ['.MI'], ES: ['.MC'], HK: ['.HK'], AU: ['.AX'], CA: ['.TO'] };
  if (region && region !== 'US' && REGION_SUFFIX[region]) {
    const sfx = REGION_SUFFIX[region];
    const symbols = [...cacheSet].filter((t) => sfx.some((s) => t.endsWith(s)) && !drop(t)).sort().slice(0, opts.cap || DEFAULT_STOCK_CAP);
    return { market: 'US', source: `${region} stocks (${sfx.join('/')} ∩ cache)`, symbols, note: symbols.length ? UNIVERSE_NOTE : `cache has NO ${region} coverage — Phase-2 needs a ${region} universe + bars` };
  }
  if (region && region !== 'US') {
    // Unknown foreign region with no suffix mapping and no whitelist → cannot resolve safely.
    return { market: 'US', source: `unsupported region ${region} (no whitelist, no suffix map)`, symbols: [], note: `Phase-2: provide an explicit universe for region ${region}` };
  }

  // 4c) US stocks → cache minus forex/crypto/ETFs/foreign, capped alphabetically.
  const etfSet = new Set(loadUniverseFile('etf-us-universe.json'));
  const symbols = [...cacheSet]
    .filter((t) => !isForexTicker(t) && !isCryptoTicker(t) && !isForeignTicker(t) && !etfSet.has(t) && !drop(t))
    .sort()
    .slice(0, opts.cap || DEFAULT_STOCK_CAP);
  return { market: 'US', source: `US stocks (cache − forex/crypto/etf/foreign, cap ${opts.cap || DEFAULT_STOCK_CAP})`, symbols, note: UNIVERSE_NOTE };
}

// ---------------------------------------------------------------------------
// PIT bars assembly
// ---------------------------------------------------------------------------

/**
 * Build {configSym:[bars<=asof]} for a resolved universe.
 * @param {Array<string>} symbols   config-form symbols
 * @param {string} asof             YYYY-MM-DD (PIT cutoff, inclusive)
 * @param {object} opts             { market, interval='1d', cacheSet, minBars=60 }
 * @returns { bars, resolved:[configSym], missing:[configSym], thin:[{sym,n}] }
 */
function buildBars(symbols, asof, opts = {}) {
  const market = opts.market || 'US';
  const interval = opts.interval || '1d';
  const cacheSet = opts.cacheSet || listCacheTickers();
  const minBars = opts.minBars != null ? opts.minBars : 2;

  const bars = {};
  const resolved = [];
  const missing = [];
  const thin = [];

  for (const configSym of symbols) {
    const cacheTicker = findCacheTicker(configSym, market, cacheSet);
    if (!cacheTicker) { missing.push(configSym); continue; }
    // Read via price-cache (dated snapshot if present, else legacy flat array), then PIT-truncate.
    let raw = priceCache.readBars(cacheTicker, {
      date: asof,
      market: market === 'FX' ? priceCache.MARKETS.FX : (market === 'CRYPTO' ? priceCache.MARKETS.CRYPTO : (market === 'CVA' ? priceCache.MARKETS.CVA : priceCache.MARKETS.US)),
      interval,
      allowLegacyFallback: true,
    });
    if (!raw || !raw.length) { missing.push(configSym); continue; }
    // Anti-look-ahead: the legacy flat cache returns the FULL array, so truncate here explicitly.
    // Normalize dates to YYYY-MM-DD (some cache files carry datetime stamps the engine rejects).
    const cut = raw
      .map((b) => ({ date: String(b.date).slice(0, 10), open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume != null ? b.volume : 0 }))
      .filter((b) => b.date <= asof);
    if (cut.length < minBars) { thin.push({ sym: configSym, n: cut.length }); if (cut.length === 0) { missing.push(configSym); continue; } }
    bars[configSym] = cut;
    resolved.push(configSym);
  }

  return { bars, resolved, missing, thin };
}

/**
 * Macro basket bars for `dtx regime`. Sources ^GSPC/^VIX/SPY/IWM/TLT/HYG/GLD from cache, PIT-cut.
 */
function buildMacroBars(asof, opts = {}) {
  const macro = ['^GSPC', '^VIX', 'SPY', 'IWM', 'TLT', 'HYG', 'GLD'];
  const cacheSet = opts.cacheSet || listCacheTickers();
  // ^GSPC/^VIX are cached as _GSPC/_VIX in some dumps — try both forms.
  const out = {};
  const missing = [];
  for (const sym of macro) {
    const variants = [sym, sym.replace('^', '_'), sym.replace('^', '')];
    let picked = null;
    for (const v of variants) { if (cacheSet.has(v)) { picked = v; break; } }
    if (!picked) { missing.push(sym); continue; }
    const raw = priceCache.readBars(picked, { date: asof, interval: '1d', allowLegacyFallback: true });
    if (!raw || !raw.length) { missing.push(sym); continue; }
    out[sym] = raw.map((b) => ({ date: String(b.date).slice(0, 10), open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume || 0 }))
      .filter((b) => b.date <= asof);
  }
  return { macroBars: out, missing };
}

module.exports = {
  readConfig,
  resolveUniverse,
  buildBars,
  buildMacroBars,
  listCacheTickers,
  cacheVariants,
  findCacheTicker,
  UNIVERSE_NOTE,
};

// ---------------------------------------------------------------------------
// Selftest : node tools/lib/dtx-bars.js --selftest
// ---------------------------------------------------------------------------
if (require.main === module && process.argv.includes('--selftest')) {
  const ok = (l) => console.log(`  ok  ${l}`);
  try {
    const cacheSet = listCacheTickers();
    ok(`cache tickers indexed: ${cacheSet.size}`);

    const cfgDir = path.join(REPO_ROOT, 'config', 'dtx');
    for (const [file, expectMarket] of [
      ['portfolio_us_highvol.yaml', 'US'],
      ['portfolio_forex.yaml', 'FX'],
      ['portfolio_etf_us.yaml', 'US'],
      ['portfolio_stockbox_nasdaq.yaml', 'US'],
      ['portfolio_crypto.yaml', 'CRYPTO'],
      ['portfolio_metals.yaml', 'US'],
    ]) {
      const p = readConfig(path.join(cfgDir, file));
      const alloc = p.allocations[0];
      const u = resolveUniverse(alloc, { cacheSet });
      if (u.market !== expectMarket) throw new Error(`${file}: market ${u.market} != ${expectMarket}`);
      const { resolved, missing } = buildBars(u.symbols.slice(0, 30), '2026-06-30', { market: u.market, cacheSet });
      ok(`${file.padEnd(30)} market=${u.market} src="${u.source}" symbols=${u.symbols.length} sample-resolved=${resolved.length}/${Math.min(30, u.symbols.length)} missing=${missing.length}`);
    }

    // PIT check: last bar must be <= asof
    const p = readConfig(path.join(cfgDir, 'portfolio_us_highvol.yaml'));
    const u = resolveUniverse(p.allocations[0], { cacheSet });
    const asof = '2025-06-30';
    const { bars, resolved } = buildBars(u.symbols.slice(0, 5), asof, { market: 'US', cacheSet });
    for (const s of resolved) {
      const last = bars[s][bars[s].length - 1].date;
      if (last > asof) throw new Error(`PIT violation: ${s} last=${last} > ${asof}`);
    }
    ok(`PIT truncation verified (all last-bars <= ${asof})`);

    const { macroBars, missing } = buildMacroBars('2026-06-30');
    ok(`macro basket: ${Object.keys(macroBars).length} present, missing=[${missing.join(',')}]`);

    console.log('\n  SELFTEST PASS — dtx-bars OK\n');
    process.exit(0);
  } catch (e) {
    console.error('\n  SELFTEST FAIL:', e && e.message ? e.message : e);
    if (e && e.stack) console.error(e.stack.split('\n').slice(0, 5).join('\n'));
    process.exit(1);
  }
}
