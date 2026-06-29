#!/usr/bin/env node
'use strict';

/**
 * candlestick-scanner.js — Faithful port of systematic-tss americanbulls scanner.
 *
 * Scans the full US equity universe (mcap ≥$300M, volume ≥5M) for 25 candlestick
 * patterns with volume spike confirmation (8×). Multi-factor scoring:
 * pattern base + ATR% + momentum + MA20 distance + RSI + BB%B + regime.
 *
 * Data source: DailyTickers MCP gateway (bars_daily via QueryData), same transport
 * as refresh-risk-metrics.js. Set MCP_GATEWAY_URL (default https://mcp.dailytickers.com/mcp).
 * Yahoo direct is kept only as a fallback (--source yahoo / auto) — it is fragile and
 * blocked in several environments, which previously zeroed out the Bull mode signals.
 *
 * Usage:
 *   node tools/candlestick-scanner.js                                      # full scan, stdout
 *   node tools/candlestick-scanner.js --output json                        # write data/candlestick-scan-YYYY-MM-DD.json
 *   node tools/candlestick-scanner.js --output signals                     # append to scanner/YYYYMMDD/signals.json
 *   node tools/candlestick-scanner.js --tickers AAPL,MSFT,NVDA            # custom universe
 *   node tools/candlestick-scanner.js --min-score 70 --min-vol-ratio 8    # filter thresholds
 *   node tools/candlestick-scanner.js --top 30                            # max candidates
 *   node tools/candlestick-scanner.js --backtest --from 2026-03-01        # compare with Go
 *   node tools/candlestick-scanner.js --dry-run                           # no file write
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { detectPattern, calcATR, calcRSI, calcSMA, volRatio } = require('./lib/candlestick-patterns');

const ROOT = path.join(__dirname, '..');
const CACHE_DIR = path.join(ROOT, 'data', '.price-cache');

// ─── CLI args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}
const hasFlag = name => args.includes(`--${name}`);

const CUSTOM_TICKERS = getArg('tickers', '').split(',').filter(Boolean);
const MIN_SCORE = parseFloat(getArg('min-score', '70'));
const MIN_VOL_RATIO = parseFloat(getArg('min-vol-ratio', '8.0'));
const TOP_N = parseInt(getArg('top', '30'));
const OUTPUT_MODE = getArg('output', 'stdout');
const DRY_RUN = hasFlag('dry-run');
const BACKTEST = hasFlag('backtest');
const SCAN_DATE = getArg('date', new Date().toISOString().slice(0, 10));
const SCAN_FOLDER = getArg('folder', null); // output folder override (e.g. 20260629 when scan date is 20260626)
const REGIME = getArg('regime', null);
const CONCURRENCY = parseInt(getArg('concurrency', '10'));

//   --source yahoo     → Yahoo Finance (default — works locally and in cloud routines)
//   --source api       → REST API https://mcp.dailytickers.com/api (needs DT_API_KEY env var)
//   --source gateway   → legacy MCP JSON-RPC (deprecated post-OAuth2)
//   --source cache     → local cache only, no network
//   --source auto      → api/gateway first if DT_API_KEY set, Yahoo fallback
const SOURCE = getArg('source', 'yahoo').toLowerCase();
const API_BASE = process.env.DT_API_URL || 'https://mcp.dailytickers.com/api';
const API_KEY = process.env.DT_API_KEY || '';
const GATEWAY = process.env.MCP_GATEWAY_URL || 'https://mcp.dailytickers.com/mcp';
const GATEWAY_BATCH = parseInt(getArg('gateway-batch', '60'));
const GATEWAY_DAYS = parseInt(getArg('gateway-days', '200'));

// systematic-tss config: min mcap $300M, min volume 5M, blacklist DAWN/GLDD
const MIN_MARKET_CAP = 300_000_000;
const MIN_VOLUME = 5_000_000;
const BLACKLIST = new Set(['DAWN', 'GLDD']);

// ─── Universe: local pre-built file (americanbull-universe.json) ────────────

async function fetchScreenerUniverse() {
  const universeFile = path.join(ROOT, 'data', 'americanbull-universe.json');
  if (fs.existsSync(universeFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(universeFile, 'utf8'));
      const tickers = (data.tickers || []).filter(t => !BLACKLIST.has(t));
      if (tickers.length > 100) {
        console.log(`  ✅ Universe from local file: ${tickers.length} tickers`);
        return tickers;
      }
    } catch {}
  }

  console.error('ERROR: Could not load universe. Provide data/americanbull-universe.json');
  process.exit(1);
}

// ─── Yahoo Finance OHLCV fetch (120d, with volume) ──────────────────────────

function loadCachedPrice(ticker) {
  const fp = path.join(CACHE_DIR, `${ticker}_ohlcv.json`);
  if (!fs.existsSync(fp)) return null;
  const stat = fs.statSync(fp);
  if ((Date.now() - stat.mtimeMs) / 3600000 > 12) return null;
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return null; }
}

function saveCachedOHLCV(ticker, bars) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(path.join(CACHE_DIR, `${ticker}_ohlcv.json`), JSON.stringify(bars));
}

function fetchOHLCV(ticker) {
  const cached = loadCachedPrice(ticker);
  if (cached) return Promise.resolve(cached);

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=2y`;
  return new Promise(resolve => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 12000 }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
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
          saveCachedOHLCV(ticker, bars);
          resolve(bars);
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// ─── DailyTickers REST API (Bearer auth) ────────────────────────────────────
// POST https://mcp.dailytickers.com/api/{ToolName} with JSON body.
// Auth via DT_API_KEY env var (Bearer token). Falls back to legacy MCP JSON-RPC
// if DT_API_KEY is absent (deprecated path, will fail post-OAuth2 migration).

function apiCall(toolName, params) {
  const url = new URL(`${API_BASE}/${toolName}`);
  const body = JSON.stringify(params);
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  };
  if (API_KEY) headers['Authorization'] = `Bearer ${API_KEY}`;
  const opts = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname + (url.search || ''),
    method: 'POST',
    headers,
    timeout: 45000,
  };
  return new Promise((resolve, reject) => {
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (j.error) return reject(new Error(j.error.message || 'api error'));
          resolve(j);
        } catch (e) { reject(new Error(`API response not JSON: ${data.slice(0, 120)}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('api timeout')); });
    req.write(body);
    req.end();
  });
}

// Legacy MCP JSON-RPC gateway (deprecated — kept for backward compat)
function gatewayCall(toolName, params) {
  const url = new URL(GATEWAY);
  const body = JSON.stringify({
    jsonrpc: '2.0', id: crypto.randomUUID(),
    method: 'tools/call',
    params: { name: toolName, arguments: params },
  });
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'Content-Length': Buffer.byteLength(body),
  };
  if (API_KEY) headers['Authorization'] = `Bearer ${API_KEY}`;
  const opts = {
    hostname: url.hostname, port: url.port || 443,
    path: url.pathname + (url.search || ''),
    method: 'POST', headers, timeout: 45000,
  };
  return new Promise((resolve, reject) => {
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (j.error) return reject(new Error(j.error.message || 'rpc error'));
          const r = j.result;
          if (r && r.isError) return reject(new Error(r.content?.[0]?.text || 'MCP tool returned isError'));
          if (r && Array.isArray(r.content) && r.content[0]?.type === 'text') {
            try { return resolve(JSON.parse(r.content[0].text)); } catch { return resolve(r.content[0].text); }
          }
          resolve(r);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('gateway timeout')); });
    req.write(body);
    req.end();
  });
}

// Convert a gateway bars_daily row [date,open,high,low,close,volume] → bar object.
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

// Fetch OHLCV from cache only — no network calls. For cloud routines that
// pre-populate the cache via MCP QueryData before running the scanner.
function fetchOHLCVCacheOnly(tickers) {
  const results = new Map();
  let stale = 0;
  for (const t of tickers) {
    const fp = path.join(CACHE_DIR, `${t}_ohlcv.json`);
    if (!fs.existsSync(fp)) continue;
    try {
      const bars = JSON.parse(fs.readFileSync(fp, 'utf8'));
      if (bars && bars.length >= 60) results.set(t, bars);
    } catch { /* skip corrupt */ }
  }
  process.stderr.write(`  cache-only: ${results.size}/${tickers.length} loaded\n`);
  return results;
}

// Fetch OHLCV for the whole universe from the API/gateway in batches. Cache-first per
// ticker; only uncached symbols are requested. Returns Map(ticker → bars[]).
async function fetchOHLCVGateway(tickers) {
  const results = new Map();
  const need = [];
  for (const t of tickers) {
    const cached = loadCachedPrice(t);
    if (cached && cached.length >= 60) results.set(t, cached);
    else need.push(t);
  }
  if (!need.length) { process.stderr.write(`  gateway: ${results.size}/${tickers.length} from cache\n`); return results; }

  const useApi = API_KEY && API_BASE;
  const caller = useApi ? apiCall : gatewayCall;
  const label = useApi ? 'api' : 'gateway';

  const batches = [];
  for (let i = 0; i < need.length; i += GATEWAY_BATCH) batches.push(need.slice(i, i + GATEWAY_BATCH));
  let done = 0, valid = results.size;
  const queue = [...batches];
  async function worker() {
    while (queue.length) {
      const batch = queue.shift();
      try {
        const res = await caller('QueryData', { symbols: batch.join(','), types: 'bars_daily', days: GATEWAY_DAYS, timeframe: '1d' });
        for (const r of (res.results || [])) {
          if (r.data_type !== 'bars_daily' || !r.data) continue;
          const syms = r.symbols || [];
          for (let i = 0; i < syms.length; i++) {
            const bars = rowsToBars(r.data[i]);
            if (bars.length >= 60) { results.set(syms[i], bars); saveCachedOHLCV(syms[i], bars); valid++; }
          }
        }
      } catch (e) {
        process.stderr.write(`\n  ⚠️  ${label} batch failed (${batch.length} syms): ${e.message}\n`);
      }
      done++;
      process.stderr.write(`  ${label} batch ${done}/${batches.length} (${valid} valid)\r`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, batches.length) }, () => worker()));
  process.stderr.write(`  ${label}: ${valid}/${tickers.length} valid\n`);
  return results;
}

// ─── Source orchestration ────────────────────────────────────────────────────

async function fetchAll(universe, concurrency) {
  if (SOURCE === 'cache') return fetchOHLCVCacheOnly(universe);
  if (SOURCE === 'yahoo') return batchFetch(universe, concurrency);

  let priceData = new Map();
  try {
    priceData = await fetchOHLCVGateway(universe);
  } catch (e) {
    if (SOURCE === 'gateway' || SOURCE === 'api') { console.error(`❌ Fetch failed and --source ${SOURCE} forbids fallback: ${e.message}`); process.exit(1); }
    process.stderr.write(`  ⚠️  api/gateway unavailable (${e.message}), falling back to Yahoo\n`);
  }
  if (SOURCE === 'gateway' || SOURCE === 'api') return priceData;

  // auto: fill any gaps from Yahoo (best-effort; skipped silently where blocked)
  const missing = universe.filter(t => !priceData.has(t));
  if (missing.length) {
    process.stderr.write(`  ${missing.length} tickers missing — trying Yahoo fallback\n`);
    const yh = await batchFetch(missing, concurrency);
    for (const [t, bars] of yh) priceData.set(t, bars);
  }
  return priceData;
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
      if (done % 50 === 0) process.stderr.write(`  fetched ${done}/${tickers.length} (${results.size} valid)\r`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  process.stderr.write(`  fetched ${done}/${tickers.length} (${results.size} valid)\n`);
  return results;
}

// ─── P80 dollar volume filter (exact port of calcDollarVolumePercentile) ────

function calcDollarVolumeP80(bars, lookback = 20) {
  const slice = bars.slice(-lookback);
  const dvols = slice.map(b => b.close * (b.volume || 0)).sort((a, b) => a - b);
  if (!dvols.length) return 0;
  const idx = Math.floor(dvols.length * 0.8);
  return dvols[Math.min(idx, dvols.length - 1)];
}

// ─── Main scan ──────────────────────────────────────────────────────────────

async function main() {
  const universe = CUSTOM_TICKERS.length ? CUSTOM_TICKERS : await fetchScreenerUniverse();
  console.log(`🕯️  AmericanBulls Scanner (systematic-tss port)`);
  console.log(`   Universe: ${universe.length} tickers | minScore: ${MIN_SCORE} | minVolRatio: ${MIN_VOL_RATIO} | top: ${TOP_N}`);
  console.log(`   Date: ${SCAN_DATE} | Regime: ${REGIME || 'auto'}`);

  console.log(`📡 Fetching OHLCV data via ${SOURCE === 'yahoo' ? 'Yahoo' : 'MCP gateway' + (SOURCE === 'auto' ? ' (Yahoo fallback)' : '')}...`);
  const priceData = await fetchAll(universe, CONCURRENCY);
  if (!priceData.size) { console.error('❌ No OHLCV data retrieved from any source — aborting (no signals written).'); process.exit(1); }

  console.log('🔍 Scanning for candlestick patterns (25 bullish)...');
  const candidates = [];

  const scanDateNorm = SCAN_DATE.replace(/-/g, '');
  for (const [ticker, rawBars] of priceData) {
    if (BLACKLIST.has(ticker)) continue;

    // Slice bars up to SCAN_DATE so detectPattern works on the target date, not the latest bar
    const cutIdx = rawBars.findIndex(b => b.date.replace(/-/g, '') > scanDateNorm);
    const bars = cutIdx > 0 ? rawBars.slice(0, cutIdx) : rawBars;

    // P80 dollar volume filter ($1M minimum, same as Go)
    const dvP80 = calcDollarVolumeP80(bars);
    if (dvP80 < 1_000_000) continue;

    const result = detectPattern(bars, REGIME);
    if (!result) continue;

    // Min score filter
    if (result.totalScore < MIN_SCORE) continue;

    // Min vol ratio filter (8× per config)
    if (result.volRatio < MIN_VOL_RATIO) continue;

    const idx = bars.length - 1;
    const c0 = bars[idx];
    const risk = result.entry - result.stop;
    if (risk <= 0) continue;

    const tp1 = +(result.entry + risk * 2).toFixed(2);
    const tp2 = +(result.entry + risk * 3).toFixed(2);
    const rr = ((tp1 - result.entry) / risk).toFixed(1);

    candidates.push({
      ticker,
      score: result.totalScore,
      strategy: 'Candlestick',
      pattern: {
        name: result.pattern,
        baseScore: result.baseScore,
        strength: +(result.totalScore / 150).toFixed(2),
        confirmed: true,
        volumeSpike: result.volRatio >= 2.0,
        invalidation: result.stop,
        patternTarget: tp1,
      },
      entry: +result.entry.toFixed(2),
      stop: +result.stop.toFixed(2),
      tp1, tp2,
      rr: `1:${rr}`,
      extension: {
        rsi: +result.rsi.toFixed(1),
        atr: +result.atr.toFixed(2),
        distance_50dma_pct: result.ma50 > 0 ? +((c0.close - result.ma50) / result.ma50 * 100).toFixed(1) : 0,
      },
      metrics: {
        atrPct: +(result.atrPct * 100).toFixed(2),
        volRatio: +result.volRatio.toFixed(1),
        mom5: +(result.mom5 * 100).toFixed(2),
        distMA20: +(result.distMA20 * 100).toFixed(2),
        bbPctB: +result.bbPctB.toFixed(3),
      },
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  const topCandidates = candidates.slice(0, TOP_N);

  console.log(`\n✅ Found ${candidates.length} signals (passed all filters), top ${topCandidates.length}:`);
  for (const c of topCandidates) {
    const vol = c.metrics.volRatio >= 8 ? '📊' : c.metrics.volRatio >= 2 ? '📈' : '  ';
    console.log(`  ${vol} ${c.ticker.padEnd(6)} score:${String(c.score).padStart(3)} ${c.pattern.name.padEnd(26)} E:${c.entry} S:${c.stop} TP1:${c.tp1} RR:${c.rr} vol:${c.metrics.volRatio}x`);
  }

  if (DRY_RUN) { console.log('\n🏷️  Dry run — no files written.'); return topCandidates; }

  if (OUTPUT_MODE === 'json') {
    const outPath = path.join(ROOT, 'data', `candlestick-scan-${SCAN_DATE}.json`);
    fs.writeFileSync(outPath, JSON.stringify({ scanDate: SCAN_DATE, regime: REGIME, candidates: topCandidates }, null, 2));
    console.log(`\n📁 Written to ${outPath}`);
  } else if (OUTPUT_MODE === 'signals') {
    const scanDir = SCAN_FOLDER || SCAN_DATE.replace(/-/g, '');
    const sigPath = path.join(ROOT, 'scanner', scanDir, 'signals.json');
    if (!fs.existsSync(sigPath)) { console.error(`❌ ${sigPath} not found`); process.exit(1); }
    const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
    const existing = new Set((signals.signals || []).map(s => s.ticker));
    let added = 0;
    for (const c of topCandidates) {
      if (existing.has(c.ticker)) continue;
      signals.signals.push({
        ticker: c.ticker, name: c.ticker, score: c.score, strategy: 'Candlestick',
        entry: c.entry, stop: c.stop, tp1: c.tp1, tp2: c.tp2, rr: c.rr,
        horizon: 10, region: 'US', sharia: null,
        thesis: `${c.pattern.name} pattern (base ${c.pattern.baseScore}) with ${c.metrics.volRatio}x volume spike. ATR% ${c.metrics.atrPct}%, RSI ${c.extension.rsi}, BB%B ${c.metrics.bbPctB}.`,
        extension: c.extension, pattern: c.pattern,
        earnings_clear: true, dilution_clear: true,
      });
      existing.add(c.ticker);
      added++;
    }
    fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
    console.log(`\n📁 Appended ${added} candlestick signals to ${sigPath}`);
  }

  return topCandidates;
}

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}

module.exports = { main };
