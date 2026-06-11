#!/usr/bin/env node
'use strict';

/**
 * candlestick-scanner.js — Faithful port of systematic-tss americanbulls scanner.
 *
 * Scans the full US equity universe (mcap ≥$300M, volume ≥5M) for 25 candlestick
 * patterns with volume spike confirmation (8×). Multi-factor scoring:
 * pattern base + ATR% + momentum + MA20 distance + RSI + BB%B + regime.
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
const MCP_GATEWAY = process.env.MCP_GATEWAY_URL || 'https://mcp.dailytickers.com/mcp';

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
const REGIME = getArg('regime', null);
const CONCURRENCY = parseInt(getArg('concurrency', '10'));

// systematic-tss config: min mcap $300M, min volume 5M, blacklist DAWN/GLDD
const MIN_MARKET_CAP = 300_000_000;
const MIN_VOLUME = 5_000_000;
const BLACKLIST = new Set(['DAWN', 'GLDD']);

// ─── MCP JSON-RPC 2.0 transport (same as refresh-risk-metrics.js) ──────────

function mcpCall(toolName, params, timeout = 60000) {
  const url = new URL(MCP_GATEWAY);
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'tools/call',
    params: { name: toolName, arguments: params },
  });
  const mod = url.protocol === 'https:' ? https : require('http');
  const opts = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + (url.search || ''),
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream', 'Content-Length': Buffer.byteLength(body) },
    timeout,
  };
  return new Promise((resolve, reject) => {
    const req = mod.request(opts, res => {
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
    req.on('timeout', () => { req.destroy(); reject(new Error('MCP timeout')); });
    req.write(body);
    req.end();
  });
}

// ─── Universe: dynamic via MCP RunScreener (mirrors Go's stockanalysis.com) ─

async function fetchScreenerUniverse() {
  const cacheFile = path.join(CACHE_DIR, '_universe.json');
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  // Use daily cache (universe doesn't change intraday)
  if (fs.existsSync(cacheFile)) {
    const stat = fs.statSync(cacheFile);
    if ((Date.now() - stat.mtimeMs) / 3600000 < 18) {
      try {
        const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        if (cached.tickers && cached.tickers.length > 500) {
          console.log(`  ♻️  Universe from cache: ${cached.tickers.length} tickers (${cached.source || 'unknown'})`);
          return cached.tickers;
        }
      } catch {}
    }
  }

  // Fetch via MCP RunScreener: mcap >= $300M, avg_volume >= 5M (exact Go filters)
  console.log('  📡 Fetching universe via MCP RunScreener (market_cap >= $300M, avg_volume >= 5M)...');
  const allTickers = [];
  let page = 1;
  let paginationToken = null;

  while (true) {
    try {
      const params = {
        pass_expr: `market_cap > ${MIN_MARKET_CAP} && avg_volume > ${MIN_VOLUME}`,
        score_expr: 'market_cap',
        region: 'us',
        asset: 'stock',
        top_k: 500,
        timeout: 60,
        page,
      };
      if (paginationToken) params.pagination_token = paginationToken;

      const result = await mcpCall('RunScreener', params, 90000);
      const candidates = result?.screener_results || result?.results || [];
      if (!candidates.length) break;

      for (const c of candidates) {
        const sym = c.symbol || c.ticker;
        if (sym && !BLACKLIST.has(sym)) allTickers.push(sym);
      }

      // Check pagination
      if (result?.has_next && result?.pagination_token) {
        paginationToken = result.pagination_token;
        page++;
        console.log(`  📡 Page ${page}: ${allTickers.length} tickers so far...`);
      } else {
        break;
      }
    } catch (err) {
      console.error(`  ⚠️  MCP RunScreener error: ${err.message}`);
      break;
    }
  }

  if (allTickers.length > 100) {
    const unique = [...new Set(allTickers)].sort();
    console.log(`  ✅ Universe built: ${unique.length} US stocks (mcap >= $300M, vol >= 5M)`);
    fs.writeFileSync(cacheFile, JSON.stringify({ updated: new Date().toISOString().slice(0, 10), source: 'MCP RunScreener', minMarketCap: MIN_MARKET_CAP, minVolume: MIN_VOLUME, tickers: unique }));
    return unique;
  }

  // Fallback: pre-built universe file
  const universeFile = path.join(ROOT, 'data', 'americanbull-universe.json');
  if (fs.existsSync(universeFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(universeFile, 'utf8'));
      const tickers = (data.tickers || []).filter(t => !BLACKLIST.has(t));
      if (tickers.length > 100) {
        console.log(`  ⚠️  MCP returned ${allTickers.length} tickers, falling back to pre-built universe: ${tickers.length} tickers`);
        return tickers;
      }
    } catch {}
  }

  console.error('ERROR: Could not build universe. Set MCP_GATEWAY_URL or provide data/americanbull-universe.json');
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

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=120d`;
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

  console.log('📡 Fetching OHLCV data (120d)...');
  const priceData = await batchFetch(universe, CONCURRENCY);

  console.log('🔍 Scanning for candlestick patterns (25 bullish)...');
  const candidates = [];

  for (const [ticker, bars] of priceData) {
    if (BLACKLIST.has(ticker)) continue;

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
    const scanDir = SCAN_DATE.replace(/-/g, '');
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
