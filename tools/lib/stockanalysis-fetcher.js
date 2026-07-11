'use strict';
// StockAnalysis metadata fetcher (sector / market-cap / universe).
//
// JS re-implementation of the CLEAN method used by dailytickers-mcp
// (internal/staticdata/stock.go + etf.go) and systematic-tss
// (internal/staticdata/staticdata.go + internal/universe/universe.go).
//
// Method — NOT a copy of the Go cache:
//   * endpoint  : https://stockanalysis.com/_api/endpoints/screener/data-points
//   * type=s    -> stocks, type=e -> ETFs
//   * &c=<code> -> per-country/exchange screener (default = US-listed universe)
//   * response  : { status, data: { data: { "<exchange/TICKER>": {fields...} } } }
//                 (also tolerates the array-of-pairs form [[symbol,{...}], ...])
//   * symbols   : converted exchange/TICKER -> Yahoo symbol (epa/AI -> AI.PA, etr/SAP -> SAP.DE)
//   * filter    : averageVolume >= 1000, blacklist removed
//
// HTTP style (cert-permissive agent + UA) mirrors tools/lib/bvc-fetcher.js.

const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = 'https://stockanalysis.com/_api/endpoints/screener/data-points';
const CACHE_DIR = path.join(__dirname, '..', '..', 'data', '.stockanalysis-cache');

// Field lists requested from the data-points endpoint (validated HTTP 200).
const STOCK_IDS = 'name+marketCap+sector+industry+dollarVolume+rsi+atr+close+averageVolume+country+exchange';
const ETF_IDS = 'name+assetClass+etfCategory+etfCountry+etfRegion+etfLeverage+exchange+dollarVolume+close+averageVolume+rsi';

// EU regions built by systematic-tss universe.go (cfg.Region == "EU").
const EU_REGIONS = ['DE', 'FR', 'NL', 'IT', 'ES', 'PL', 'CH', 'UK', 'GR'];

// BLACKLIST — dual-class / illiquid duplicates (port of systematic-tss staticdata.go).
const BLACKLIST = new Set([
  'TVAI', 'OYSE', 'MOG.A', 'CHPG', 'CRAC', 'BLUW', 'BRK.B', 'CWEN.A', 'BACC',
  'HEI.A', 'DGIC.A', 'IMKT.A', 'CCCX', 'KCHV', 'AACI', 'RUSH.A', 'CGCT', 'WENN',
  'PBR.A', 'BF.A', 'GTEN', 'BSAA', 'FWON.K', 'BHK.RT', 'GRP.U', 'AKO.B', 'CIG.C',
  'GTN.A', 'PACH', 'MKC.V', 'AXIN', 'AKO.A', 'CRD.A', 'BH.A', 'CRD.B',
]);

// exchange-prefix -> Yahoo suffix (port of ConvertToYahooSymbol, staticdata.go).
// "" = US (no suffix). Prefixes absent from this map are duplicate/secondary
// listings (e.g. Frankfurt `fra` vs Xetra `etr`) and are dropped by default.
const EXCHANGE_SUFFIX = {
  nasdaq: '', nyse: '', arca: '', amex: '', bats: '', otc: '',
  tsx: '.TO', tsxv: '.V', cse: '.CN', xngo: '.NE', neo: '.NE',
  lon: '.L', aim: '.L',
  epa: '.PA', etr: '.DE', bit: '.MI', bme: '.MC', ams: '.AS', bru: '.BR', ebr: '.BR',
  six: '.SW', swx: '.SW', sto: '.ST', cph: '.CO', osl: '.OL', hel: '.HE',
  els: '.LS', eli: '.LS', wse: '.WA',
  bvmf: '.SA', bmv: '.MX', asx: '.AX', nze: '.NZ',
  tyo: '.T', jp: '.T', fkse: '.T', krx: '.KS', kosdaq: '.KQ', xkon: '.KQ',
  sha: '.SS', she: '.SZ', hkg: '.HK', nse: '.NS', bse: '.BO', bom: '.BO',
  tpe: '.TW', tpex: '.TWO', sgx: '.SI', set: '.BK', bkk: '.BK', klse: '.KL',
  idx: '.JK', hose: '.VN', hnx: '.HNX', pse: '.PS', bist: '.IS', moex: '.ME',
  tadawul: '.SR', egx: '.CA', jse: '.JO', cbse: '.CS', difx: '.DU', tlv: '.TA',
  ath: '.AT', pra: '.PR', bud: '.BD', bvb: '.BU', ux: '.UX',
};

/**
 * Convert an exchange/TICKER key from StockAnalysis to a Yahoo-style symbol.
 * Returns null when the exchange prefix is unknown (secondary/duplicate listing).
 * US symbols (no "/" or a US prefix) are returned unchanged.
 */
function convertToYahooSymbol(apiSymbol) {
  if (!apiSymbol.includes('/')) return apiSymbol; // already a plain symbol (US)
  const idx = apiSymbol.indexOf('/');
  const prefix = apiSymbol.slice(0, idx).toLowerCase();
  const ticker = apiSymbol.slice(idx + 1);
  const suffix = EXCHANGE_SUFFIX[prefix];
  if (suffix === undefined) return null; // unknown / duplicate exchange -> drop
  return ticker + suffix;
}

// cert-permissive agent (same posture as bvc-fetcher)
const agent = new https.Agent({ rejectUnauthorized: false });

function httpGetJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      agent,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://stockanalysis.com/stocks/screener/',
      },
      timeout: 45000,
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`StockAnalysis HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        }
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('StockAnalysis timeout')); });
  });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Normalise an as-of date to 'YYYY-MM-DD' (accepts 'YYYY-MM-DD' or 'YYYYMMDD'). null on empty/invalid.
function normAsof(d) {
  if (!d) return null;
  const s = String(d).trim();
  let m;
  if ((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s))) return `${m[1]}-${m[2]}-${m[3]}`;
  if ((m = /^(\d{4})(\d{2})(\d{2})$/.exec(s))) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

// Normalize data.data into a [ [apiSymbol, obj], ... ] list (map OR array-of-pairs).
function toPairs(dataData) {
  if (!dataData) return [];
  if (Array.isArray(dataData)) return dataData; // array-of-pairs form
  return Object.entries(dataData);              // map form
}

function pickStock(o) {
  return {
    name: o.name || '',
    marketCap: o.marketCap || 0,
    sector: o.sector || '',
    industry: o.industry || '',
    dollarVolume: o.dollarVolume || 0,
    rsi: o.rsi || 0,
    atr: o.atr || 0,
    close: o.close || 0,
    avgVolume: o.averageVolume || 0,
    country: o.country || '',
    exchange: o.exchange || '',
  };
}

function pickEtf(o) {
  return {
    name: o.name || '',
    assetClass: o.assetClass || '',
    etfCategory: o.etfCategory || '',
    etfCountry: o.etfCountry || '',
    etfRegion: o.etfRegion || '',
    etfLeverage: o.etfLeverage || '',
    exchange: o.exchange || '',
    dollarVolume: o.dollarVolume || 0,
    close: o.close || 0,
    avgVolume: o.averageVolume || 0,
    rsi: o.rsi || 0,
  };
}

function buildUrl(type, country) {
  const ids = type === 'e' ? ETF_IDS : STOCK_IDS;
  let url = `${BASE}?type=${type}&ids=${ids}`;
  const c = (country || '').toUpperCase();
  if (c && c !== 'US') url += `&c=${c}`;
  return url;
}

function cacheFileFor(type, country, date) {
  const c = (country || 'US').toUpperCase();
  return path.join(CACHE_DIR, `${type}-${c}-${date}.json`);
}

// Latest on-disk cache for a given type+country (fallback when the API fails).
//
// POINT-IN-TIME (anti-look-ahead) : `maxDate` (YYYY-MM-DD) borne le fichier renvoyé à une date
// <= maxDate. En mode rétro (as-of historique) c'est OBLIGATOIRE — sans borne, ce fallback sert le
// snapshot LE PLUS RÉCENT (donc POSTÉRIEUR au setup) à une date passée : exactement le look-ahead
// que la clé de cache PIT vise à interdire (leçons IOVA/INDO ; cf. data/scanner-lessons.json
// pit-cache-key-end-date). Sans maxDate → comportement inchangé (dernier snapshot, usage forward).
function findLatestCache(type, country, maxDate = null) {
  if (!fs.existsSync(CACHE_DIR)) return null;
  const c = (country || 'US').toUpperCase();
  const prefix = `${type}-${c}-`;
  const bound = normAsof(maxDate);
  const files = fs.readdirSync(CACHE_DIR)
    .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
    .map(f => ({ f, d: (f.slice(prefix.length, -'.json'.length)) })) // date encoded in the filename
    .filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x.d))
    .filter(x => !bound || x.d <= bound) // PIT guard: never a snapshot dated AFTER the as-of
    .sort((a, b) => a.d.localeCompare(b.d));
  return files.length ? path.join(CACHE_DIR, files[files.length - 1].f) : null;
}

/**
 * Fetch a StockAnalysis screener (stocks or ETFs) and return a normalized map
 * { yahooSymbol: {fields} }.
 *
 * @param {object} opts
 * @param {'s'|'e'} opts.type            's' = stocks (default), 'e' = ETFs
 * @param {string}  opts.country         '' or 'US' for the default US universe, else a region code (FR, DE, ...)
 * @param {number}  opts.minAvgVolume    filter threshold (default 1000, as in Go filterStock)
 * @param {boolean} opts.dropUnmappedExchanges  drop secondary listings (default true)
 * @param {number}  opts.maxAgeHours     reuse today's cache if younger than this (default 24)
 * @param {boolean} opts.forceRefresh    ignore cache and hit the API
 * @param {string}  opts.asof            POINT-IN-TIME as-of date (YYYY-MM-DD). When set to a PAST
 *                                       date, the cache key becomes `type-country-asof` and the
 *                                       fetcher runs READ-ONLY over frozen snapshots dated <= asof —
 *                                       it NEVER hits the live API (which would return TODAY's, i.e.
 *                                       posterior, fundamentals and mislabel them under the as-of key).
 *                                       No snapshot <= asof on disk → THROW (MCP HARD STOP; the caller
 *                                       must not fabricate). This is idea #8: end_date in the cache key.
 * @returns {Promise<{data: object, count: number, source: string, url: string}>}
 */
async function fetchScreener(opts = {}) {
  const {
    type = 's',
    country = 'US',
    minAvgVolume = 1000,
    dropUnmappedExchanges = true,
    maxAgeHours = 24,
    forceRefresh = false,
    asof = null,
  } = opts;

  const c = (country || 'US').toUpperCase();
  const url = buildUrl(type, c);
  const today = todayStr();
  const asofN = normAsof(asof);
  // PIT mode = an as-of strictly in the PAST. as-of == today (or absent) → normal forward mode.
  const pit = !!asofN && asofN < today;
  const date = pit ? asofN : today;
  const cacheFile = cacheFileFor(type, c, date);

  let raw = null;
  let source = '';

  // ── POINT-IN-TIME (rétro) : snapshot GELÉ, lecture seule, borné <= asof ────────────────────────
  // On ne rejoue JAMAIS l'API en mode PIT (elle renverrait les fondamentaux d'AUJOURD'HUI et les
  // étiquetterait sous la clé as-of → filing/rapport postérieur au setup, leçons IOVA/INDO). Le
  // cache daté est IMMUABLE (pas de TTL sur une date passée, comme price-cache.js). Rien <= asof
  // → on THROW (le fork agent doit STOPPER, jamais substituer un snapshot postérieur — anti-pattern
  // "fallback silencieux" documenté dans scanner-lessons.json:pit-cache-key-end-date).
  if (pit) {
    if (fs.existsSync(cacheFile)) {
      try { raw = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); source = `pit:${path.basename(cacheFile)}`; } catch { raw = null; }
    }
    if (!raw) {
      const fb = findLatestCache(type, c, asofN); // borné <= asof (jamais un snapshot postérieur)
      if (fb) {
        try { raw = JSON.parse(fs.readFileSync(fb, 'utf8')); source = `pit-fallback:${path.basename(fb)}`; } catch { raw = null; }
      }
    }
    if (!raw) {
      throw new Error(`StockAnalysis PIT (as-of ${asofN}) : aucun snapshot gelé <= ${asofN} pour type=${type} c=${c}. ` +
        `MCP HARD STOP — ne pas servir un snapshot postérieur (look-ahead). Backfill un snapshot daté <= ${asofN} d'abord.`);
    }
  } else {
    // ── FORWARD (as-of == aujourd'hui ou absent) : comportement inchangé ─────────────────────────
    // 1. Fresh-enough cache for today
    if (!forceRefresh && fs.existsSync(cacheFile)) {
      const ageH = (Date.now() - fs.statSync(cacheFile).mtimeMs) / 3600000;
      if (ageH < maxAgeHours) {
        try { raw = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); source = `cache:${path.basename(cacheFile)}`; } catch { raw = null; }
      }
    }

    // 2. Live API
    if (!raw) {
      try {
        const resp = await httpGetJSON(url);
        if (!resp || !resp.data || !resp.data.data) throw new Error('malformed response (no data.data)');
        raw = resp;
        source = 'api';
        fs.mkdirSync(CACHE_DIR, { recursive: true });
        fs.writeFileSync(cacheFile, JSON.stringify(resp));
      } catch (err) {
        // 3. Fallback: latest on-disk cache (API down). Forward mode → no PIT bound.
        const fb = findLatestCache(type, c);
        if (fb) {
          try { raw = JSON.parse(fs.readFileSync(fb, 'utf8')); source = `fallback:${path.basename(fb)}`; }
          catch { raw = null; }
        }
        if (!raw) {
          throw new Error(`StockAnalysis fetch failed for type=${type} c=${c} and no cache fallback: ${err.message}`);
        }
        process.stderr.write(`[stockanalysis-fetcher] WARN api failed (${err.message}) -> ${source}\n`);
      }
    }
  }

  const pairs = toPairs(raw.data.data);
  const out = {};
  let dropped = 0;
  for (const [apiSymbol, o] of pairs) {
    if (!o || typeof o !== 'object') continue;
    let sym = convertToYahooSymbol(apiSymbol);
    if (sym === null) { dropped++; continue; } // unmapped/duplicate exchange
    if (!dropUnmappedExchanges && sym === null) sym = apiSymbol;
    sym = sym.toUpperCase();
    const rec = type === 'e' ? pickEtf(o) : pickStock(o);
    if ((rec.avgVolume || 0) < minAvgVolume) continue;
    if (BLACKLIST.has(sym) || BLACKLIST.has(apiSymbol)) continue;
    // keep the higher-marketCap / higher-volume record on collision
    if (out[sym]) {
      const prev = out[sym];
      const prevRank = (prev.marketCap || 0) || (prev.dollarVolume || 0);
      const curRank = (rec.marketCap || 0) || (rec.dollarVolume || 0);
      if (curRank <= prevRank) continue;
    }
    out[sym] = rec;
  }

  return { data: out, count: Object.keys(out).length, source, url, dropped };
}

// Convenience wrappers.
async function fetchStocks(country = 'US', opts = {}) {
  return fetchScreener({ ...opts, type: 's', country });
}
async function fetchEtfs(country = 'US', opts = {}) {
  return fetchScreener({ ...opts, type: 'e', country });
}

/**
 * Build the EU stock universe (systematic-tss universe.go, cfg.Region == "EU").
 * Loads each EU region, merges, dedups by symbol, sorts by MarketCap desc.
 * @returns {Promise<{stocks: Array, regionCounts: object, source: object}>}
 */
async function fetchEuUniverse(opts = {}) {
  const regions = opts.regions || EU_REGIONS;
  const merged = {};       // symbol -> record (+ region)
  const regionCounts = {};
  const source = {};
  for (const region of regions) {
    let res;
    try {
      res = await fetchStocks(region, opts);
    } catch (err) {
      process.stderr.write(`[stockanalysis-fetcher] WARN EU region ${region} failed: ${err.message}\n`);
      regionCounts[region] = 0;
      source[region] = `error:${err.message}`;
      continue;
    }
    regionCounts[region] = res.count;
    source[region] = res.source;
    for (const [sym, rec] of Object.entries(res.data)) {
      const cur = { ...rec, symbol: sym, region };
      const prev = merged[sym];
      if (!prev || (cur.marketCap || 0) > (prev.marketCap || 0)) merged[sym] = cur;
    }
  }
  const stocks = Object.values(merged).sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
  return { stocks, regionCounts, source };
}

module.exports = {
  fetchScreener,
  fetchStocks,
  fetchEtfs,
  fetchEuUniverse,
  convertToYahooSymbol,
  findLatestCache,
  normAsof,
  cacheFileFor,
  EU_REGIONS,
  BLACKLIST,
  CACHE_DIR,
  STOCK_IDS,
  ETF_IDS,
};
