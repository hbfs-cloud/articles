#!/usr/bin/env node
'use strict';
/**
 * tkl-momentum-screener.js — Cross-sectional momentum composite screener for TKL mode
 *
 * Ranks US common stocks by a 3-metric momentum composite (1w, 1m, 3m vol-adjusted),
 * outputs top N as tkl_pool entries compatible with scanner/YYYYMMDD/signals.json.
 *
 * Usage:
 *   node tools/tkl-momentum-screener.js [options]
 *   --dry-run              Print results, don't write to signals.json
 *   --scan-date=YYYY-MM-DD Target scan date (default: latest scanner date)
 *   --refresh-universe     Force re-fetch of universe list
 *   --top=N                Number of top picks (default: 30)
 *   --verbose              Extra logging
 */

const fs     = require('fs');
const path   = require('path');
const https  = require('https');
const crypto = require('crypto');

// ── Constants ────────────────────────────────────────────────────────────────

const ROOT         = path.join(__dirname, '..');
const SCANNER_DIR  = path.join(ROOT, 'scanner');
const DATA_DIR     = path.join(ROOT, 'data');
const CACHE_DIR    = path.join(DATA_DIR, '.tkl-cache');
const UNIVERSE_PATH = path.join(DATA_DIR, 'tkl-universe.json');
const EXTRA_PATH    = path.join(DATA_DIR, 'tkl-universe-extra.json');

const UNIVERSE_TTL_MS = 7 * 24 * 3600 * 1000;   // 7 days
const OHLCV_TTL_MS    = 24 * 3600 * 1000;        // 24 hours
const BATCH_SIZE      = 2;
const BATCH_DELAY_MS  = 1500;

const MIN_PRICE     = 5;
const MIN_ADV       = 10_000_000;   // $10M average dollar volume (20d)
const MIN_BARS      = 70;           // 63 bars needed for YZ vol + buffer

fs.mkdirSync(CACHE_DIR, { recursive: true });

// ── CLI args ─────────────────────────────────────────────────────────────────

const ARGS = process.argv.slice(2);
const DRY_RUN         = ARGS.includes('--dry-run');
const REFRESH_UNIVERSE = ARGS.includes('--refresh-universe');
const VERBOSE         = ARGS.includes('--verbose');
const scanDateArg     = (ARGS.find(a => a.startsWith('--scan-date=')) || '').split('=')[1] || '';
const topN            = parseInt((ARGS.find(a => a.startsWith('--top=')) || '').split('=')[1] || '30', 10);

const log  = (...a) => console.log('[TKL]', ...a);
const vlog = (...a) => { if (VERBOSE) console.log('[TKL:v]', ...a); };

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Sharia ───────────────────────────────────────────────────────────────────

const HARAM_SECTORS = new Set([
  'Financial Services', 'Insurance', 'Banks', 'Gambling', 'Tobacco',
  'Alcoholic Beverages', 'Defense', 'Aerospace & Defense',
  'Capital Markets', 'Consumer Finance', 'Mortgage Finance',
  'Thrifts & Mortgage Finance', 'Insurance—Diversified',
  'Insurance—Life', 'Insurance—Property & Casualty', 'Insurance—Specialty',
  'Insurance—Reinsurance',
]);

const HARAM_TICKERS = new Set([
  // Banks
  'JPM','BAC','GS','MS','C','WFC','USB','PNC','TFC','SCHW','BK','STT',
  // Insurance
  'AIG','MET','PRU','UNH','CI','HUM','ELV','ALL','PGR','TRV','AFL',
  // Defense
  'LMT','RTX','NOC','GD','HII','LHX','LDOS','KTOS','ITA',
  // Alcohol
  'BUD','DEO','STZ','SAM','TAP','ABEV',
  // Tobacco
  'PM','MO','BTI','IQOS',
  // Gambling
  'DKNG','MGM','WYNN','LVS','CZR','PENN',
  // Leveraged/inverse ETFs (not applicable here but guard)
  'TQQQ','SQQQ','UPRO','SPXU','SOXL','SOXS','SH','SDS','PSQ','QID',
]);

function isSharia(ticker, sector) {
  if (HARAM_TICKERS.has(ticker)) return false;
  if (sector && HARAM_SECTORS.has(sector)) return false;
  return true;
}

// ── Yahoo Finance helpers ────────────────────────────────────────────────────

function yahooGetRaw(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
        'Accept': 'application/json',
      },
      timeout: 20000,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', () => resolve({ status: 0, body: '' }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: '' }); });
  });
}

async function yahooGet(url, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const { status, body } = await yahooGetRaw(url);
    if (status === 200) {
      try { return JSON.parse(body); } catch { return null; }
    }
    if (status === 429 && attempt < retries) {
      const wait = (attempt + 1) * 5000;
      if (VERBOSE) process.stdout.write(`[429 backoff ${wait / 1000}s]`);
      await sleep(wait);
      continue;
    }
    return null;
  }
  return null;
}

// ── Universe: fetch predefined Yahoo screeners ───────────────────────────────

const PREDEFINED_SCREENERS = [
  'most_actives',
  'day_gainers',
  'day_losers',
  'undervalued_large_caps',
  'undervalued_growth_stocks',
  'growth_technology_stocks',
  'aggressive_small_caps',
  'small_cap_gainers',
];

async function fetchScreenerTickers(name) {
  const url = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/${name}?count=250&offset=0`;
  vlog(`Fetching screener: ${name}`);
  const json = await yahooGet(url);
  const quotes = json?.finance?.result?.[0]?.quotes || [];
  return quotes
    .filter(q => q.quoteType === 'EQUITY' && q.symbol && !q.symbol.includes('.') && !q.symbol.includes('-'))
    .map(q => q.symbol);
}

async function fetchUniverseFromScreeners() {
  log('Fetching universe from Yahoo predefined screeners...');
  const tickerSet = new Set();
  for (const name of PREDEFINED_SCREENERS) {
    try {
      const tickers = await fetchScreenerTickers(name);
      tickers.forEach(t => tickerSet.add(t));
      vlog(`  ${name}: ${tickers.length} tickers`);
      await sleep(300);
    } catch (e) {
      vlog(`  ${name}: failed (${e.message})`);
    }
  }
  return [...tickerSet];
}

// Read tickers from historical scanner signals (last 60 scans)
function collectFromScannerHistory() {
  const tickers = new Set();
  try {
    const dirs = fs.readdirSync(SCANNER_DIR)
      .filter(d => /^\d{8}$/.test(d))
      .sort()
      .slice(-60);
    for (const dir of dirs) {
      const sigPath = path.join(SCANNER_DIR, dir, 'signals.json');
      if (!fs.existsSync(sigPath)) continue;
      try {
        const sig = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
        (sig.signals || []).forEach(s => s.ticker && tickers.add(s.ticker));
        (sig.tkl_pool || []).forEach(s => s.ticker && tickers.add(s.ticker));
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return [...tickers];
}

// Compact seed list — well-known S&P 500 + MidCap liquid names
// Kept intentionally compact; screeners fill the rest
const SEED_TICKERS = [
  // Mega-caps / S&P 500 anchors
  'AAPL','MSFT','AMZN','NVDA','GOOGL','GOOG','META','TSLA','BRK.B','AVGO',
  'JPM','LLY','V','MA','XOM','COST','HD','PG','ABBV','MRK','CVX','ADBE',
  'NFLX','AMD','ORCL','CRM','NOW','INTC','QCOM','TXN','MU','AMAT','LRCX',
  'KLAC','MRVL','ARM','PANW','CRWD','FTNT','ZS','SNOW','NET','DDOG','MDB',
  'ABNB','UBER','LYFT','DASH','RBLX','PLTR','COIN','APP','HOOD','SOFI',
  // Consumer
  'NKE','SBUX','MCD','YUM','CMG','DNUT','WMT','TGT','AMZN','ETSY','W',
  'LOW','HD','TSCO','BBY','ULTA','LULU','RH','TPR','CPRI','PVH','HBI',
  // Healthcare
  'JNJ','PFE','MRK','ABBV','LLY','BMY','AMGN','GILD','REGN','VRTX','BIIB',
  'MRNA','BNTX','ILMN','IQV','CRL','HOLX','DXCM','ISRG','SYK','BSX','MDT',
  'EW','ABT','TMO','DHR','A','MTD','WAT','IDXX','PODD','TNDM','ALGN','TFX',
  // Energy
  'XOM','CVX','COP','EOG','SLB','HAL','BKR','PSX','VLO','MPC','PXD','DVN',
  'FANG','OXY','HES','APA','MGY','CTRA','EQT','RRC','CNX','GPOR',
  // Industrials & Materials
  'CAT','DE','HON','GE','LMT','RTX','NOC','BA','GD','TXT','HII',
  'ETN','EMR','ROK','PH','ITW','MMM','DOV','FTV','FAST','SWK','GWW',
  'APD','LIN','SHW','PPG','NUE','STLD','CMC','X','CLF','FCX','ALB',
  // Financials (conventional — will be sharia=false)
  'JPM','BAC','WFC','C','GS','MS','SCHW','BLK','BX','KKR','APO','AXP',
  // Tech mid/small
  'SMCI','DELL','HPE','HPQ','WDC','STX','NTAP','PSTG','VRT','EQIX',
  'AMT','CCI','SBAC','DLR','IRM','CONE',
  'CDNS','SNPS','ANSS','PTC','EPAM','GLOB','FLUT','GDDY','WEX',
  'PAYC','PCTY','HCM','TOST','SQ','PYPL','AFRM','SMAR','TWLO','ZI',
  'ESTC','DOCN','GTLB','DOMO','DT','TENB','RPD','QLYS','VRNS','SAIL',
  'OKTA','PING','CYBR','WDAY','VEEV','VMW','HUBS','INTU','EA','TTWO','RBLX',
  // REITs
  'PLD','O','WELL','VTR','ARE','VICI','MPW','OHI','NNN','ADC','STAG',
  // Consumer Discretionary
  'TSLA','F','GM','RIVN','LCID','NIO','LI','XPEV','FFIE',
  'AZO','ORLY','AAP','MNSO','FIVE','OLLI','BIG',
  // Biotech
  'ARKG','XBI','IBB','LABU',
  'HIMS','SAVA','ACAD','ALNY','BMRN','RARE','SRPT','PTCT','EXAS','GH','NTRA',
  // ETFs (common, sharia varies)
  'SPY','QQQ','IWM','DIA','EFA','EEM','FXI','GLD','SLV','USO','TLT',
  'XLF','XLE','XLK','XLV','XLI','XLY','XLP','XLRE','XLU','XLB',
  'SMH','SOXX','ARKG','XBI','IBB','BOTZ','ROBO','ICLN','TAN','LIT',
  // Crypto-adjacent
  'COIN','MARA','RIOT','CLSK','BTBT','HUT',
  // Mid-cap growth names
  'DOCS','ACMR','AAON','CELH','ENPH','FSLR','RUN','SEDG','ARRY',
  'CVNA','KMX','AN','LAD','GPI','SAH',
  'SFM','FWONK','FCNCA','PNFP','COLB','EWBC',
  'MTDR','CIVI','CTRA','SM','PDCE','BATL',
  'HWM','TDG','HEICO','SPR','KTOS','AEIS','AMSC',
  'LUMN','NWSA','NYT','ALAB','CAMT','ONTO','FORM','UCTT',
  'ACLS','AMBA','SLAB','CREE','WOLF','SWKS','QRVO','IPGP',
  'VECO','BRKS','MKSI','ENTG','AZEK','TREX','IBP','BLDR',
  'TRNO','REXR','ELF','COTY','PRGO','IFF','AVNT','RPM',
];

async function buildUniverse(forceRefresh) {
  if (!forceRefresh && fs.existsSync(UNIVERSE_PATH)) {
    try {
      const cached = JSON.parse(fs.readFileSync(UNIVERSE_PATH, 'utf8'));
      const age = Date.now() - (cached.timestamp || 0);
      if (age < UNIVERSE_TTL_MS) {
        log(`Using cached universe (${cached.tickers.length} tickers, ${Math.round(age / 3600000)}h old)`);
        return cached.tickers;
      }
      log('Universe cache is stale (>7d), rebuilding...');
    } catch { /* rebuild */ }
  }

  // Merge sources
  const tickerSet = new Set(SEED_TICKERS);
  collectFromScannerHistory().forEach(t => tickerSet.add(t));

  // Fetch from Yahoo screeners
  const screenerTickers = await fetchUniverseFromScreeners();
  screenerTickers.forEach(t => tickerSet.add(t));

  // Merge extra if exists
  if (fs.existsSync(EXTRA_PATH)) {
    try {
      const extra = JSON.parse(fs.readFileSync(EXTRA_PATH, 'utf8'));
      (extra.tickers || extra).forEach(t => tickerSet.add(t));
    } catch { /* skip */ }
  }

  // Filter: only simple US symbols (no dots, no dash)
  const tickers = [...tickerSet].filter(t => t && /^[A-Z]{1,5}$/.test(t));

  const universe = { timestamp: Date.now(), tickers };
  fs.writeFileSync(UNIVERSE_PATH, JSON.stringify(universe, null, 2));
  log(`Universe built: ${tickers.length} tickers. Saved to ${UNIVERSE_PATH}`);
  return tickers;
}

// ── OHLCV fetch (daily, 6 months) ────────────────────────────────────────────

function getCachePath(ticker) {
  return path.join(CACHE_DIR, `${ticker}_6mo.json`);
}

function isCacheValid(ticker) {
  const p = getCachePath(ticker);
  if (!fs.existsSync(p)) return false;
  const stat = fs.statSync(p);
  return Date.now() - stat.mtimeMs < OHLCV_TTL_MS;
}

function readCache(ticker) {
  try { return JSON.parse(fs.readFileSync(getCachePath(ticker), 'utf8')); } catch { return null; }
}

function writeCache(ticker, data) {
  try { fs.writeFileSync(getCachePath(ticker), JSON.stringify(data)); } catch { /* ok */ }
}

async function fetchOHLCV(ticker) {
  if (isCacheValid(ticker)) {
    const cached = readCache(ticker);
    if (cached) return cached;
  }

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=6mo`;
  const json = await yahooGet(url);
  const result = json?.chart?.result?.[0];
  if (!result) return null;

  const timestamps = result.timestamp || [];
  const q = result.indicators?.quote?.[0] || {};
  const adj = result.indicators?.adjclose?.[0]?.adjclose || [];
  const meta = result.meta || {};

  const bars = [];
  for (let i = 0; i < timestamps.length; i++) {
    const open  = q.open?.[i];
    const high  = q.high?.[i];
    const low   = q.low?.[i];
    const close = q.close?.[i];
    const vol   = q.volume?.[i];
    const adjClose = adj[i] || close;
    if (open == null || high == null || low == null || close == null || close <= 0) continue;
    bars.push({
      date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
      open, high, low, close, adjClose,
      volume: vol || 0,
    });
  }

  if (bars.length === 0) return null;

  const data = {
    ticker,
    shortName: meta.shortName || meta.symbol || ticker,
    sector: meta.sector || '',
    bars,
  };
  writeCache(ticker, data);
  return data;
}

// ── MCP Gateway OHLCV (primary — no rate limits) ────────────────────────────

const MCP_GATEWAY_URL = process.env.MCP_GATEWAY_URL || 'https://gateway.dailytickers.com/mcp';
const MCP_BATCH_SIZE  = 10;
const MCP_DELAY_MS    = 500;

function mcpCall(toolName, params) {
  const url = new URL(MCP_GATEWAY_URL);
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'tools/call',
    params: { name: toolName, arguments: params },
  });
  const opts = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname + (url.search || ''),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Content-Length': Buffer.byteLength(body),
    },
    timeout: 30000,
  };
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (j.error) return reject(new Error(j.error.message || 'rpc error'));
          const r = j.result;
          if (r && r.isError) return reject(new Error(r.content?.[0]?.text || 'MCP tool error'));
          if (r && r.content && Array.isArray(r.content) && r.content[0]?.type === 'text') {
            try { resolve(JSON.parse(r.content[0].text)); } catch { resolve(r.content[0].text); }
            return;
          }
          resolve(r);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('rpc timeout')); });
    req.write(body);
    req.end();
  });
}

async function fetchOHLCV_MCP(symbols) {
  try {
    const result = await mcpCall('QueryData', {
      symbols: symbols.join(','),
      types: 'bars_daily',
      days: 200,
    });
    const out = {};
    for (const r of (result.results || [])) {
      if (r.data_type !== 'bars_daily' || !r.data) continue;
      for (let i = 0; i < (r.symbols || []).length; i++) {
        const sym = r.symbols[i];
        const rawBars = r.data[i] || [];
        if (rawBars.length < 10) continue;
        const bars = rawBars.map(b => ({
          date: typeof b[0] === 'string' ? b[0] : new Date((b[0] || 0) * 1000).toISOString().slice(0, 10),
          open: b[1], high: b[2], low: b[3], close: b[4], adjClose: b[4],
          volume: b[5] || 0,
        })).filter(b => b.close > 0 && b.open > 0);
        if (bars.length > 0) {
          out[sym] = { ticker: sym, shortName: sym, sector: '', bars };
        }
      }
    }
    return out;
  } catch (e) {
    vlog(`MCP batch failed: ${e.message}`);
    return {};
  }
}

// ── Yang-Zhang volatility estimator ─────────────────────────────────────────

function yangZhangVol(bars, n = 63) {
  const recent = bars.slice(-n);
  if (recent.length < n) return null;

  // Overnight returns: ln(open_t / close_{t-1})
  const overnightRet = [];
  for (let i = 1; i < recent.length; i++) {
    const r = Math.log(recent[i].open / recent[i - 1].close);
    if (isFinite(r)) overnightRet.push(r);
  }

  // Open-to-close returns: ln(close_t / open_t)
  const openCloseRet = [];
  for (let i = 0; i < recent.length; i++) {
    const r = Math.log(recent[i].close / recent[i].open);
    if (isFinite(r)) openCloseRet.push(r);
  }

  // Rogers-Satchell variance per day
  const rsVar = [];
  for (let i = 0; i < recent.length; i++) {
    const b = recent[i];
    if (b.high <= 0 || b.low <= 0 || b.open <= 0 || b.close <= 0) continue;
    const u = Math.log(b.high / b.open);
    const d = Math.log(b.low  / b.open);
    const c = Math.log(b.close / b.open);
    const v = u * (u - c) + d * (d - c);
    if (isFinite(v)) rsVar.push(v);
  }

  if (overnightRet.length < 5 || openCloseRet.length < 5 || rsVar.length < 5) return null;

  const N = overnightRet.length;
  const meanO = overnightRet.reduce((s, r) => s + r, 0) / N;
  const varO  = overnightRet.reduce((s, r) => s + (r - meanO) ** 2, 0) / (N - 1);

  const Nc = openCloseRet.length;
  const meanC = openCloseRet.reduce((s, r) => s + r, 0) / Nc;
  const varC  = openCloseRet.reduce((s, r) => s + (r - meanC) ** 2, 0) / (Nc - 1);

  const meanRS = rsVar.reduce((s, r) => s + r, 0) / rsVar.length;

  const k = 0.34 / (1.34 + (N + 1) / (N - 1));
  const yzVar = varO + k * varC + (1 - k) * meanRS;

  if (!isFinite(yzVar) || yzVar <= 0) return null;
  return Math.sqrt(252 * yzVar);
}

// ── ATR(14) for stop calculation ─────────────────────────────────────────────

function atr14(bars) {
  const recent = bars.slice(-20);
  if (recent.length < 2) return null;
  let sum = 0, count = 0;
  for (let i = 1; i < recent.length && count < 14; i++) {
    const b = recent[i];
    const prev = recent[i - 1];
    const tr = Math.max(
      b.high - b.low,
      Math.abs(b.high - prev.close),
      Math.abs(b.low  - prev.close),
    );
    sum += tr;
    count++;
  }
  return count > 0 ? sum / count : null;
}

// ── Metrics computation ───────────────────────────────────────────────────────

function computeMetrics(data) {
  const { bars } = data;
  if (!bars || bars.length < MIN_BARS) return null;

  const last = bars[bars.length - 1];
  const close = last.adjClose || last.close;
  if (close < MIN_PRICE) return null;

  // 20-day average dollar volume filter
  const recent20 = bars.slice(-20);
  const avgDV = recent20.reduce((s, b) => s + b.close * b.volume, 0) / recent20.length;
  if (avgDV < MIN_ADV) return null;

  // mom1w: -5 days
  const b5 = bars[bars.length - 5];
  if (!b5) return null;
  const mom1w = close / (b5.adjClose || b5.close) - 1;

  // mom1m: -21 days
  const b21 = bars[bars.length - 21];
  if (!b21) return null;
  const mom1m = close / (b21.adjClose || b21.close) - 1;

  // mom3m: -63 days, vol-adjusted via YZ
  const b63 = bars[bars.length - 63];
  if (!b63) return null;
  const ret3m = close / (b63.adjClose || b63.close) - 1;

  const yzVol = yangZhangVol(bars, 63);
  if (!yzVol || yzVol <= 0) return null;

  const mom3m_adj = ret3m / yzVol;

  if (!isFinite(mom1w) || !isFinite(mom1m) || !isFinite(mom3m_adj)) return null;

  const atrVal = atr14(bars);

  return {
    ticker: data.ticker,
    shortName: data.shortName,
    sector: data.sector,
    close,
    avgDV,
    mom1w,
    mom1m,
    mom3m_adj,
    yzVol,
    atr: atrVal,
  };
}

// ── Cross-sectional percentile rank ─────────────────────────────────────────

function computePercentileRanks(items, field) {
  const vals = items.map(it => it[field]);
  return items.map((it, idx) => {
    const val = vals[idx];
    const below = vals.filter(v => v < val).length;
    return below / Math.max(vals.length - 1, 1);
  });
}

// ── Resolve scan date ────────────────────────────────────────────────────────

function resolveScanDate() {
  if (scanDateArg) return scanDateArg;
  // Latest scanner dir with signals.json
  try {
    const dirs = fs.readdirSync(SCANNER_DIR)
      .filter(d => /^\d{8}$/.test(d))
      .sort()
      .reverse();
    for (const d of dirs) {
      if (fs.existsSync(path.join(SCANNER_DIR, d, 'signals.json'))) {
        return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
      }
    }
  } catch { /* fall through */ }
  return new Date().toISOString().slice(0, 10);
}

// ── Build signal object ───────────────────────────────────────────────────────

function buildSignal(m, composite) {
  const score = Math.round(85 + composite * 10);  // [85, 95]
  const entry = parseFloat(m.close.toFixed(2));

  // 2× ATR stop
  const atrVal = m.atr || (m.close * 0.05);
  const stop = parseFloat(Math.max(entry * 0.85, entry - 2 * atrVal).toFixed(2));

  const tp1 = parseFloat((entry * 1.08).toFixed(2));   // 8% target
  const tp2 = parseFloat((entry * 1.15).toFixed(2));   // 15% target

  const riskPct  = (entry - stop) / entry;
  const rewardPct = (tp2 - entry) / entry;
  const rr = riskPct > 0 ? `1:${(rewardPct / riskPct).toFixed(1)}` : '1:2.0';

  const sharia = isSharia(m.ticker, m.sector);

  const thesis = [
    `Momentum composite: 1w ${(m.mom1w * 100).toFixed(1)}%,`,
    `1m ${(m.mom1m * 100).toFixed(1)}%,`,
    `3m adj ${m.mom3m_adj.toFixed(2)}.`,
    `Yang-Zhang vol ${(m.yzVol * 100).toFixed(1)}%.`,
    `Avg daily value $${(m.avgDV / 1e6).toFixed(0)}M.`,
  ].join(' ');

  return {
    ticker:    m.ticker,
    name:      m.shortName || m.ticker,
    score,
    strategy:  'Momentum',
    entry,
    stop,
    tp1,
    tp2,
    rr,
    horizon:   10,
    region:    'US',
    sharia,
    thesis,
    source:    'tkl_composite',
    mom1w:     parseFloat(m.mom1w.toFixed(4)),
    mom1m:     parseFloat(m.mom1m.toFixed(4)),
    mom3m_adj: parseFloat(m.mom3m_adj.toFixed(4)),
    composite: parseFloat(composite.toFixed(4)),
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log('TKL Momentum Screener starting...');
  log(`Options: dry-run=${DRY_RUN}, refresh-universe=${REFRESH_UNIVERSE}, top=${topN}`);

  // Step 1: Universe
  const universe = await buildUniverse(REFRESH_UNIVERSE);
  log(`Universe: ${universe.length} tickers`);

  // Step 2: Fetch OHLCV — MCP gateway primary (batch 10), Yahoo fallback, local cache
  log('Fetching OHLCV data...');
  const rawData = [];
  let mcpOk = 0, yahooOk = 0, cached = 0, failed = 0;

  // Separate cached vs uncached
  const needFetch = [];
  for (const ticker of universe) {
    if (isCacheValid(ticker)) {
      const c = readCache(ticker);
      if (c) { cached++; rawData.push(c); continue; }
    }
    needFetch.push(ticker);
  }
  log(`  Cache hits: ${cached}, need fetch: ${needFetch.length}`);

  // MCP gateway batch fetch (10 symbols per call)
  for (let i = 0; i < needFetch.length; i += MCP_BATCH_SIZE) {
    const batch = needFetch.slice(i, i + MCP_BATCH_SIZE);
    const mcpData = await fetchOHLCV_MCP(batch);
    for (const ticker of batch) {
      if (mcpData[ticker]) {
        mcpOk++;
        writeCache(ticker, mcpData[ticker]);
        rawData.push(mcpData[ticker]);
      }
    }
    // Yahoo fallback for tickers MCP missed (only if MCP coverage is low)
    const missed = batch.filter(t => !mcpData[t]);
    failed += missed.length;
    if (i % 50 === 0 && i > 0) {
      log(`  Progress: ${i}/${needFetch.length} — mcp=${mcpOk}, yahoo=${yahooOk}, failed=${failed}`);
    }
    await sleep(MCP_DELAY_MS);
  }
  log(`Data collected: ${rawData.length} tickers (${cached} cache, ${mcpOk} MCP, ${yahooOk} Yahoo, ${failed} failed)`);

  // Step 3: Apply filters and compute metrics
  log('Computing metrics...');
  const metrics = [];
  for (const data of rawData) {
    const m = computeMetrics(data);
    if (m) metrics.push(m);
  }
  log(`Passed filters: ${metrics.length} / ${rawData.length} tickers`);

  if (metrics.length < topN) {
    log(`ERROR: Only ${metrics.length} tickers passed filters (need ${topN}). Try --refresh-universe or check connectivity.`);
    process.exit(1);
  }

  // Step 4: Cross-sectional percentile ranks
  const ranks1w   = computePercentileRanks(metrics, 'mom1w');
  const ranks1m   = computePercentileRanks(metrics, 'mom1m');
  const ranks3m   = computePercentileRanks(metrics, 'mom3m_adj');

  const scored = metrics.map((m, i) => ({
    ...m,
    rank_mom1w:     ranks1w[i],
    rank_mom1m:     ranks1m[i],
    rank_mom3m_adj: ranks3m[i],
    composite:      (ranks1w[i] + ranks1m[i] + ranks3m[i]) / 3,
  }));

  // Step 5: Sort and take top N
  scored.sort((a, b) => b.composite - a.composite);
  const top = scored.slice(0, topN);

  log(`\nTop ${topN} by momentum composite:`);
  top.forEach((m, i) => {
    log(`  ${String(i + 1).padStart(2)}. ${m.ticker.padEnd(6)} composite=${m.composite.toFixed(3)}  1w=${(m.mom1w*100).toFixed(1)}%  1m=${(m.mom1m*100).toFixed(1)}%  3m_adj=${m.mom3m_adj.toFixed(2)}  yzVol=${(m.yzVol*100).toFixed(1)}%`);
  });

  // Step 6: Build signal objects
  const signals = top.map(m => buildSignal(m, m.composite));

  if (DRY_RUN) {
    log('\n--- DRY RUN: signals not written ---');
    console.log(JSON.stringify(signals, null, 2));
    return;
  }

  // Step 7: Write tkl_pool into signals.json for the target scan date
  const scanDate = resolveScanDate();
  const scanDir  = path.join(SCANNER_DIR, scanDate.replace(/-/g, ''));

  if (!fs.existsSync(scanDir)) {
    log(`WARN: Scanner directory ${scanDir} does not exist.`);
    log('Use --dry-run to inspect results without writing, or ensure the scan date directory exists.');
    log('\nOutput (not written):');
    console.log(JSON.stringify(signals, null, 2));
    return;
  }

  const sigPath = path.join(scanDir, 'signals.json');
  let existing = {};
  if (fs.existsSync(sigPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
    } catch (e) {
      log(`WARN: Could not parse existing signals.json: ${e.message}`);
    }
  } else {
    // Create minimal signals.json skeleton if missing
    existing = {
      scanDate,
      regime: 'RECOVERY',
      regimeScore: 50,
      signals: [],
    };
  }

  // Exclude tickers already in main signals[]
  const mainTickers = new Set((existing.signals || []).map(s => s.ticker));
  const tkl_pool = signals.filter(s => !mainTickers.has(s.ticker));

  existing.tkl_pool = tkl_pool;
  fs.writeFileSync(sigPath, JSON.stringify(existing, null, 2));

  log(`\nWrote ${tkl_pool.length} tkl_pool entries to ${sigPath}`);
  log('Done.');
}

main().catch(err => {
  console.error('[TKL] Fatal error:', err);
  process.exit(1);
});
