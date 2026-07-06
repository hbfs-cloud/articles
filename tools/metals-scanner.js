#!/usr/bin/env node
'use strict';

/**
 * metals-scanner.js — Faithful port of systematic-tss MetalsScanner.
 *
 * Ranks precious-metals ETFs and mining stocks by a momentum composite for a
 * metals rotation mode. Source: internal/engine/scanner_metals.go.
 *
 * SCORING (scanner_metals.go:197, 215-227) — 14d-dominant:
 *   score = return30d*0.20 + return14d*0.50 + return7d*0.15
 *         + min(volRatio*10, 20)*0.10 + min(distMA50, 30)*0.05
 *   // GLD sector bonus (scanner_metals.go:221-224): when gold trends up, miners
 *   //   get a beta boost. Applied to every symbol EXCEPT GLD itself:
 *   if (gldMom30d > 0 && ticker !== 'GLD') score += gldMom30d * 0.1
 *   normalizedScore = min(max((score+50)/2, 0), 100)   // scanner_metals.go:227
 *
 * FILTERS:
 *   - Price > MA200 bull filter (scanner_metals.go:147-157)
 *   - MinP80DollarVolume liquidity filter (scanner_metals.go:80-85;
 *       impl indicators.go:217-233) — P80 of 20d close*volume ≥ minVolumeUsd
 *   - minScore (Scan filter loop, scanner_metals.go:96-112)
 *   - need ≥maPeriod (default 200) bars (scanner_metals.go:71-77, 143-145)
 *
 * Mirrors tools/crypto-scanner.js conventions: getArg/hasFlag CLI parsing,
 * data/.price-cache OHLCV cache, batchFetch concurrency, output modes
 * (json | signals | stdout), --dry-run, --top, --min-score, --date, --as-of.
 *
 * DATA SOURCE: Yahoo Finance chart endpoint (equity business-day calendar),
 * the same endpoint candlestick-scanner.js uses:
 *   query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=250d
 * These are plain Yahoo equity tickers (GLD, GDX, NEM, FCX, ...).
 *
 * Usage:
 *   node tools/metals-scanner.js                            # full scan, stdout
 *   node tools/metals-scanner.js --dry-run --top 8          # quick test, no write
 *   node tools/metals-scanner.js --output json              # data/metals-scan-YYYY-MM-DD.json
 *   node tools/metals-scanner.js --output signals           # append metals_pool to scanner/YYYYMMDD/signals.json
 *   node tools/metals-scanner.js --tickers GLD,GDX,NEM      # custom universe
 *   node tools/metals-scanner.js --as-of 2026-05-01         # point-in-time scoring
 *   node tools/metals-scanner.js --min-score 55 --top 10
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const {
  calcSMA, calcRSI, calcATR, calcReturn, volRatio, calcDollarVolumePercentile,
} = require('./lib/metals-indicators');
const priceCache = require('./lib/price-cache');

const ROOT = path.join(__dirname, '..');
// Marché/intervalle du scanner metals (Yahoo equity tickers, daily).
const CACHE_MARKET = priceCache.MARKETS.US;
const CACHE_INTERVAL = '1d';

// ─── CLI args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}
const hasFlag = name => args.includes(`--${name}`);

const CUSTOM_TICKERS = getArg('tickers', '').split(',').filter(Boolean);
const MIN_SCORE = parseFloat(getArg('min-score', '50'));
const TOP_N = parseInt(getArg('top', '10'));
const OUTPUT_MODE = getArg('output', 'stdout');
const DRY_RUN = hasFlag('dry-run');
const SCAN_DATE = getArg('date', new Date().toISOString().slice(0, 10));
// --as-of YYYY-MM-DD: point-in-time scoring. When set, OHLCV bars are sliced to
// only those with date <= AS_OF before scoring, so historical backfills score on
// the data that was knowable at that date. Absent = use all bars (current/default).
const AS_OF = getArg('as-of', '');
const CONCURRENCY = parseInt(getArg('concurrency', '8'));
const MA_FILTER_PERIOD = parseInt(getArg('ma-filter', '200')); // bull filter (default 200)
const RANGE = '250d'; // enough for MA200 + 30d return headroom

// Momentum weights (scanner_metals.go:197) — 14d-dominant
const W30D = 0.20, W14D = 0.50, W7D = 0.15, W_VOL = 0.10, W_MA50 = 0.05;

// ─── Universe: local pre-built file (metals-universe.json) ──────────────────

function loadUniverse() {
  if (CUSTOM_TICKERS.length) return { tickers: CUSTOM_TICKERS, names: {}, minVolumeUsd: 0 };
  const universeFile = path.join(ROOT, 'data', 'metals-universe.json');
  if (!fs.existsSync(universeFile)) {
    console.error('ERROR: Could not load universe. Provide data/metals-universe.json');
    process.exit(1);
  }
  try {
    const data = JSON.parse(fs.readFileSync(universeFile, 'utf8'));
    const tickers = data.tickers || [];
    if (tickers.length < 5) throw new Error('too few tickers');
    console.log(`  ✅ Universe from local file: ${tickers.length} tickers`);
    return { tickers, names: data.names || {}, minVolumeUsd: data.minVolumeUsd || 0 };
  } catch (e) {
    console.error(`ERROR: Could not parse data/metals-universe.json: ${e.message}`);
    process.exit(1);
  }
}

// ─── Yahoo Finance OHLCV fetch (250d, with volume) ──────────────────────────
// Same endpoint as candlestick-scanner.js — equity business-day calendar.

// Cache prix DATÉ, point-in-time (helper partagé tools/lib/price-cache.js).
// Lecture : snapshot gelé …/<SCAN_DATE>/1d/US/<ticker>.json (TTL 12h seulement si
// SCAN_DATE == aujourd'hui ; date passée = immuable). Fallback lecture legacy plat.
function loadCachedPrice(ticker) {
  return priceCache.readBars(ticker, { date: SCAN_DATE, market: CACHE_MARKET, interval: CACHE_INTERVAL });
}

// Écriture : toujours en daté, tronqué à bar.date <= SCAN_DATE (anti-look-ahead ;
// no-op en pipeline forward où SCAN_DATE == aujourd'hui).
function saveCachedOHLCV(ticker, bars) {
  priceCache.writeBars(ticker, bars, { date: SCAN_DATE, market: CACHE_MARKET, interval: CACHE_INTERVAL });
}

function fetchYahooChart(ticker, attempt = 0) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=${RANGE}`;
  return new Promise(resolve => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 12000 }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          // Retry once on transient/rate-limit errors; otherwise give up quietly.
          if (attempt < 1 && (res.statusCode === 429 || res.statusCode >= 500)) {
            setTimeout(() => resolve(fetchYahooChart(ticker, attempt + 1)), 600);
          } else {
            resolve(null);
          }
          return;
        }
        try {
          const j = JSON.parse(data);
          const result = j?.chart?.result?.[0];
          if (!result) return resolve(null);
          const ts = result.timestamp || [];
          const q = result.indicators?.quote?.[0] || {};
          const rmp = result.meta?.regularMarketPrice;
          const bars = [];
          for (let i = 0; i < ts.length; i++) {
            const d = new Date(ts[i] * 1000).toISOString().slice(0, 10);
            const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i], v = q.volume?.[i] || 0;
            if (o != null && h != null && l != null && c != null) {
              bars.push({ date: d, open: o, high: h, low: l, close: c, volume: v });
            } else if (i === ts.length - 1 && rmp != null) {
              bars.push({ date: d, open: o ?? rmp, high: h ?? rmp, low: l ?? rmp, close: rmp, volume: v });
            }
          }
          if (!bars.length) return resolve(null);
          saveCachedOHLCV(ticker, bars);
          resolve(bars);
        } catch { resolve(null); }
      });
    });
    req.on('error', () => {
      if (attempt < 1) setTimeout(() => resolve(fetchYahooChart(ticker, attempt + 1)), 600);
      else resolve(null);
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function fetchOHLCV(ticker) {
  const cached = loadCachedPrice(ticker);
  // A cache hit must carry enough history to be scoreable (≥ maPeriod bars).
  // This rejects short/foreign legacy caches the original scanner never consulted —
  // notably a sweep-written date-keyed ${ticker}.json (< maPeriod bars) that the
  // shared helper now also reads as legacy fallback (e.g. GOLD/Barrick 120 bars).
  // Preserves iso candidate output; a fresh fetch then writes a full dated snapshot.
  if (cached && cached.length >= MA_FILTER_PERIOD) return Promise.resolve(cached);
  return fetchYahooChart(ticker);
}

// ─── Batch fetch with concurrency ───────────────────────────────────────────

async function batchFetch(tickers, concurrency) {
  const results = new Map();
  const queue = [...tickers];
  let done = 0;
  async function worker() {
    while (queue.length) {
      const t = queue.shift();
      const bars = await fetchOHLCV(t);
      if (bars && bars.length >= 60) results.set(t, bars);
      done++;
      if (done % 10 === 0) process.stderr.write(`  fetched ${done}/${tickers.length} (${results.size} valid)\r`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  process.stderr.write(`  fetched ${done}/${tickers.length} (${results.size} valid)\n`);
  return results;
}

// ─── Point-in-time slicing (--as-of) ─────────────────────────────────────────
// Keep only bars dated <= asOf so historical backfills score on knowable data.
function sliceAsOf(bars, asOf) {
  if (!asOf) return bars;
  return bars.filter(b => b.date <= asOf);
}

// ─── Scoring (port of scoreSymbol, scanner_metals.go:129-254) ───────────────

function scoreSymbol(ticker, bars, gldMom30d) {
  const n = bars.length;
  const price = bars[n - 1].close;
  if (!(price > 0) || !Number.isFinite(price)) return null; // scanner_metals.go:134

  // Need maPeriod bars (scanner_metals.go:143-145)
  if (n < MA_FILTER_PERIOD) return null;

  // Bull market filter: price > SMA(maPeriod) (scanner_metals.go:147-157)
  const maFilter = calcSMA(bars, MA_FILTER_PERIOD);
  if (price < maFilter) return null;

  // Momentum returns (scanner_metals.go:172-174): 30/14/7
  const return30d = calcReturn(bars, 30);
  const return14d = calcReturn(bars, 14);
  const return7d = calcReturn(bars, 7);

  // Volume ratio: current vs 30d avg (scanner_metals.go:176-187)
  const vr = volRatio(bars, 30);

  // Distance from MA50 (scanner_metals.go:189-194)
  const ma50 = calcSMA(bars, 50);
  const distMA50 = ma50 > 0 ? ((price - ma50) / ma50) * 100.0 : 0;

  // Composite score (scanner_metals.go:215-219) — 14d-dominant weights
  let score = (return30d * W30D)
    + (return14d * W14D)
    + (return7d * W7D)
    + (Math.min(vr * 10.0, 20.0) * W_VOL)
    + (Math.min(distMA50, 30.0) * W_MA50);

  // GLD sector bonus (scanner_metals.go:221-224): when gold trends up, miners
  // (and all non-GLD metals names) get a small beta boost proportional to gold.
  if (gldMom30d > 0 && ticker !== 'GLD') {
    score += gldMom30d * 0.1;
  }

  // Normalize to 0-100 (scanner_metals.go:227)
  const normalizedScore = Math.min(Math.max((score + 50.0) / 2.0, 0), 100.0);

  // Other indicators (scanner_metals.go:230-235)
  const atr = calcATR(bars, 14);
  const atrPct = price > 0 ? atr / price : 0;
  const rsi = calcRSI(bars, 14);

  return {
    ticker,
    score: Math.round(normalizedScore * 100) / 100, // scanner_metals.go:239
    price,
    atr,
    atrPct,
    rsi,
    return30d,
    return14d,
    return7d,
    volRatio: vr,
    distMA50,
    ma50,
  };
}

// ─── Main scan ──────────────────────────────────────────────────────────────

async function main() {
  const { tickers: universe, names, minVolumeUsd } = loadUniverse();
  console.log(`🥇  Metals Momentum Scanner (systematic-tss port)`);
  console.log(`   Universe: ${universe.length} tickers | minScore: ${MIN_SCORE} | top: ${TOP_N} | MA-filter: ${MA_FILTER_PERIOD} | minVolUsd: ${minVolumeUsd}`);
  console.log(`   Date: ${SCAN_DATE}${AS_OF ? ` | as-of: ${AS_OF} (point-in-time)` : ''}`);

  console.log('📡 Fetching Yahoo chart OHLCV (daily, 250 bars)...');
  const priceDataRaw = await batchFetch(universe, CONCURRENCY);

  // Apply --as-of slicing up front so GLD momentum + all scoring are point-in-time.
  const priceData = new Map();
  for (const [t, bars] of priceDataRaw) {
    const sliced = sliceAsOf(bars, AS_OF);
    if (sliced.length >= 60) priceData.set(t, sliced);
  }

  // GLD 30d momentum for the sector bonus (scanner_metals.go:57-61).
  let gldMom30d = 0;
  const gldBars = priceData.get('GLD');
  if (gldBars && gldBars.length > 30) gldMom30d = calcReturn(gldBars, 30);
  console.log(`   GLD 30d momentum: ${gldMom30d >= 0 ? '+' : ''}${gldMom30d.toFixed(2)}%${gldMom30d > 0 ? ' → miner sector bonus active' : ' → no sector bonus'}`);

  console.log('🔍 Scoring momentum...');
  const candidates = [];

  for (const [ticker, bars] of priceData) {
    // MinP80DollarVolume liquidity filter (scanner_metals.go:80-85).
    if (minVolumeUsd > 0) {
      const dvP80 = calcDollarVolumePercentile(bars, 20, 0.80);
      if (dvP80 < minVolumeUsd) continue;
    }

    const r = scoreSymbol(ticker, bars, gldMom30d);
    if (!r) continue;                       // failed MA200 bull filter / insufficient bars
    if (r.score < MIN_SCORE) continue;      // minScore filter

    const entry = +r.price.toFixed(2);
    // Stop: max(entry - 1.5*ATR, MA50) when MA50 below price (structural floor),
    // else entry - 1.5*ATR. (mirrors crypto-scanner stop logic)
    let stop = entry - 1.5 * r.atr;
    if (r.ma50 > 0 && r.ma50 < entry && r.ma50 > stop) stop = r.ma50;
    stop = +stop.toFixed(2);

    const risk = entry - stop;
    if (risk <= 0) continue;

    const tp1 = +(entry + risk * 2).toFixed(2);
    const tp2 = +(entry + risk * 3).toFixed(2);
    const rr = ((tp1 - entry) / risk).toFixed(1);

    candidates.push({
      ticker,
      name: names[ticker] || ticker,
      score: r.score,
      strategy: 'MetalsMomentum',
      entry,
      stop,
      tp1,
      tp2,
      rr: `1:${rr}`,
      horizon: 14,
      region: 'METALS',
      sharia: null,
      assetClass: 'metals',
      thesis: `Metals momentum: +${r.return30d.toFixed(1)}% 30d / +${r.return14d.toFixed(1)}% 14d / +${r.return7d.toFixed(1)}% 7d, above MA${MA_FILTER_PERIOD} bull filter, ${r.distMA50.toFixed(1)}% over MA50, vol ${r.volRatio.toFixed(2)}× 30d avg${gldMom30d > 0 && ticker !== 'GLD' ? ` (GLD +${gldMom30d.toFixed(1)}% sector bonus)` : ''}.`,
      extension: {
        rsi: +r.rsi.toFixed(1),
        atr: +r.atr.toFixed(2),
        distance_50dma_pct: +r.distMA50.toFixed(1),
      },
      metrics: {
        return30d: +r.return30d.toFixed(2),
        return14d: +r.return14d.toFixed(2),
        return7d: +r.return7d.toFixed(2),
        volRatio: +r.volRatio.toFixed(2),
        atrPct: +(r.atrPct * 100).toFixed(2),
        gldMom30d: +gldMom30d.toFixed(2),
      },
    });
  }

  // Sort by score desc, tie-break by ticker (scanner_metals.go:115-120)
  candidates.sort((a, b) => (b.score - a.score) || (a.ticker < b.ticker ? -1 : 1));
  const topCandidates = candidates.slice(0, TOP_N);

  console.log(`\n✅ Found ${candidates.length} candidates (passed bull filter + liquidity + minScore), top ${topCandidates.length}:`);
  for (const c of topCandidates) {
    console.log(
      `  🥇 ${c.ticker.padEnd(6)} score:${String(c.score).padStart(6)} ` +
      `30d:${c.metrics.return30d >= 0 ? '+' : ''}${c.metrics.return30d}% ` +
      `14d:${c.metrics.return14d >= 0 ? '+' : ''}${c.metrics.return14d}% ` +
      `E:${c.entry} S:${c.stop} TP1:${c.tp1} RR:${c.rr} ` +
      `RSI:${c.extension.rsi} vol:${c.metrics.volRatio}x`
    );
  }

  if (DRY_RUN) { console.log('\n🏷️  Dry run — no files written.'); return topCandidates; }

  if (OUTPUT_MODE === 'json') {
    const outPath = path.join(ROOT, 'data', `metals-scan-${SCAN_DATE}.json`);
    fs.writeFileSync(outPath, JSON.stringify({ scanDate: SCAN_DATE, asOf: AS_OF || null, gldMom30d: +gldMom30d.toFixed(2), candidates: topCandidates }, null, 2));
    console.log(`\n📁 Written to ${outPath}`);
  } else if (OUTPUT_MODE === 'signals') {
    const scanDir = SCAN_DATE.replace(/-/g, '');
    const sigPath = path.join(ROOT, 'scanner', scanDir, 'signals.json');
    if (!fs.existsSync(sigPath)) { console.error(`❌ ${sigPath} not found`); process.exit(1); }
    const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
    // metals_pool — analogous to crypto_pool, consumed downstream by sweep for the metals mode.
    if (!Array.isArray(signals.metals_pool)) signals.metals_pool = [];
    const existing = new Set(signals.metals_pool.map(s => s.ticker));
    let added = 0;
    for (const c of topCandidates) {
      if (existing.has(c.ticker)) continue; // dedup by ticker
      signals.metals_pool.push(c);
      existing.add(c.ticker);
      added++;
    }
    fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
    console.log(`\n📁 Appended ${added} metals signals to metals_pool in ${sigPath}`);
  }

  return topCandidates;
}

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}

module.exports = { main, scoreSymbol, sliceAsOf };
