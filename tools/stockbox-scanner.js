#!/usr/bin/env node
'use strict';

/**
 * stockbox-scanner.js — StockBox Nasdaq index-rotation scanner (ISO port of systematic-tss).
 *
 * Reproduces engine.IndexRotationStrategy (internal/engine/strategy_index_rotation.go),
 * config config/portfolio_stockbox_nasdaq.yaml: the WH SelfInvest "Stock-Box Nasdaq" =
 * top-8 momentum Nasdaq-100 names, equal-weight, MONTHLY rebalance (21 trading days).
 *
 * WHAT THIS DOES (exact ISO of computeRanking + top-K selection)
 * -------------------------------------------------------------
 *   momentum(sym) = close[last] / close[last - lookback] - 1     (lookback = 84 trading bars)
 *   • skip "^..." index / vol tickers, skip symbols with < lookback+1 bars, skip close<=0
 *   • rank momentum DESC, tie-break symbol ASC (deterministic — byte-for-byte the Go comparator)
 *   • hold the top-K (rotation_top_k = 8); rotation_abs_filter = 0 → the box ALWAYS holds 8,
 *     pure momentum RANK (no momentum>0 cash filter)
 * The strategy has NO per-name stops — rotation IS the exit (a name leaving the top-8 is sold
 * at the next monthly rebalance). So emitted signals carry entry + rank + weight, NOT SL/TP.
 *
 * Total-return parity: the Go reference ranks on TOTAL_RETURN=1 (dividend-adjusted) closes, so
 * this scanner ranks on Yahoo adjClose when present (falls back to raw close). For the
 * high-momentum semis that dominate the box the two are within rounding, but adjClose is the
 * faithful choice.
 *
 * Cache: shared DATED cache (tools/lib/price-cache.js), market=US interval=1d — point-in-time,
 * replayable, anti-look-ahead truncation. Never a flat inline cache.
 *
 * Usage:
 *   node tools/stockbox-scanner.js --dry-run
 *   node tools/stockbox-scanner.js --date 2026-07-03 --top 8
 *   node tools/stockbox-scanner.js --output json  --date 2026-07-03
 *   node tools/stockbox-scanner.js --output signals --folder 20260703
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const priceCache = require('./lib/price-cache');

const ROOT = path.join(__dirname, '..');

// ─── Strategy params — kept in sync (MANUALLY) with systematic-tss config ────
// Source of truth: systematic-tss/config/portfolio_stockbox_nasdaq.yaml
//   scanner_filters.params.rotation_lookback_days = 84   (optimizer-validated plateau)
//   scanner_filters.params.rotation_top_k         = 8    (the box holds exactly 8)
//   scanner_filters.params.rotation_rebalance_days = 21  (monthly rebalance)
//   scanner_filters.params.rotation_abs_filter    = 0    (always 8, momentum RANK only)
// articles stays INDEPENDENT of the Go engine — these are copied values, not a call.
const LOOKBACK_DAYS = 84;
const TOP_K = 8;
const REBALANCE_DAYS = 21;
const ABS_FILTER = false; // rotation_abs_filter = 0 → hold 8 regardless of sign

// Nasdaq-100 whitelist (2026 membership) — copied VERBATIM from
// portfolio_stockbox_nasdaq.yaml portfolios[0].allocations[0].whitelist. Do NOT invent.
const WHITELIST = 'NVDA,AAPL,MSFT,AMZN,AVGO,META,GOOGL,GOOG,TSLA,NFLX,COST,PLTR,ASML,CSCO,AMD,TMUS,AZN,LIN,INTU,PEP,ISRG,BKNG,ADBE,QCOM,TXN,AMGN,GILD,HON,CMCSA,AMAT,PANW,ADP,VRTX,MU,ADI,LRCX,MELI,KLAC,SBUX,INTC,CRWD,MDLZ,CTAS,CEG,CDNS,ORLY,MAR,SNPS,PYPL,MRVL,REGN,FTNT,DASH,ADSK,WDAY,MNST,NXPI,ROP,AEP,TTD,CPRT,PCAR,CHTR,PAYX,ROST,KDP,FANG,ODFL,FAST,EA,BKR,VRSK,CTSH,EXC,XEL,CCEP,GEHC,KHC,LULU,DDOG,TTWO,IDXX,CSGP,ANSS,ON,ZS,BIIB,ARM,MDB,GFS,WBD,ILMN,DXCM,MCHP,SMCI,STX,SNDK,ALAB,NBIS'
  .split(',').map(s => s.trim()).filter(Boolean);
const UNIVERSE = Array.from(new Set(WHITELIST)); // dedupe (GOOGL/GOOG both present, but distinct)

// ─── CLI ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}
const hasFlag = name => args.includes(`--${name}`);

const TOP_N = parseInt(getArg('top', String(TOP_K)));
const OUTPUT_MODE = getArg('output', 'stdout');
const DRY_RUN = hasFlag('dry-run');
const SCAN_DATE = getArg('date', new Date().toISOString().slice(0, 10));
const SCAN_FOLDER = getArg('folder', null);
const CONCURRENCY = parseInt(getArg('concurrency', '10'));

const CACHE_OPTS = { date: SCAN_DATE, market: priceCache.MARKETS.US, interval: '1d' };
// Need at least lookback+1 bars to rank a symbol (mirrors Go: len(bars) < lookback+1 → skip).
const MIN_BARS = LOOKBACK_DAYS + 1;

// ─── Yahoo OHLCV fetcher (shared dated cache) ───────────────────────────────

function readCache(ticker) {
  // Snapshot GELÉ pour SCAN_DATE : date passée = immuable ; date == aujourd'hui = TTL 12h (helper).
  const bars = priceCache.readBars(ticker, CACHE_OPTS);
  if (bars && bars.length >= MIN_BARS) return bars;
  return null;
}

function fetchOHLCV(ticker) {
  return new Promise((resolve) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=2y&interval=1d`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (!j.chart?.result?.[0]) return resolve(null);
          const q = j.chart.result[0];
          const ts = q.timestamp || [];
          const ind = q.indicators?.quote?.[0];
          const adj = q.indicators?.adjclose?.[0]?.adjclose;
          if (!ind || !ts.length) return resolve(null);
          const bars = [];
          for (let i = 0; i < ts.length; i++) {
            const o = ind.open?.[i], h = ind.high?.[i], l = ind.low?.[i], c2 = ind.close?.[i], v = ind.volume?.[i];
            if (o == null || c2 == null) continue;
            bars.push({
              date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
              open: o, high: h || o, low: l || o, close: c2,
              adjClose: adj?.[i] != null ? adj[i] : c2, volume: v || 0,
            });
          }
          if (bars.length >= MIN_BARS) {
            // writeBars TRONQUE à bar.date <= SCAN_DATE (anti-look-ahead ; no-op en forward).
            priceCache.writeBars(ticker, bars, CACHE_OPTS);
          }
          resolve(bars.length >= MIN_BARS ? bars : null);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null)).on('timeout', function () { this.destroy(); resolve(null); });
  });
}

async function batchFetch(tickers, concurrency) {
  const result = new Map();
  const queue = [...tickers];
  let done = 0, cached = 0;
  async function worker() {
    while (queue.length) {
      const t = queue.shift();
      let bars = readCache(t);
      if (bars) { cached++; } else { bars = await fetchOHLCV(t); }
      if (bars) result.set(t, bars);
      done++;
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  process.stderr.write(`  fetched ${done}/${tickers.length} (${result.size} valid, ${cached} cached)\n`);
  return result;
}

// ─── computeRanking — EXACT ISO of strategy_index_rotation.go computeRanking ─
// momentum = px[last] / px[last - lookback] - 1  (px = adjClose for total-return parity,
// falls back to close). Rank desc, tie-break symbol asc. Skip < lookback+1 bars / px<=0.
function px(bar) {
  const p = bar.adjClose != null ? bar.adjClose : bar.close;
  return p;
}

function computeRanking(priceData) {
  const scanDateNorm = SCAN_DATE.replace(/-/g, '');
  const ranked = [];
  for (const [sym, rawBars] of priceData) {
    if (sym.startsWith('^')) continue; // index / vol ticker, not investable
    // Point-in-time slice: keep only bars with date <= SCAN_DATE (mirrors the other scanners;
    // the dated cache already truncates on write, this also handles a forward-fetched array).
    const cutIdx = rawBars.findIndex(b => b.date.replace(/-/g, '') > scanDateNorm);
    const bars = cutIdx > 0 ? rawBars.slice(0, cutIdx) : rawBars;
    const n = bars.length;
    if (n < LOOKBACK_DAYS + 1) continue;
    const last = px(bars[n - 1]);
    const prev = px(bars[n - 1 - LOOKBACK_DAYS]);
    if (!(prev > 0) || !(last > 0)) continue;
    ranked.push({
      symbol: sym,
      momentum: last / prev - 1,
      entry: bars[n - 1].close, // raw close = the tradable last price for the order
      asOf: bars[n - 1].date,
    });
  }
  // Deterministic: momentum desc, then symbol asc as tie-break (byte-for-byte the Go comparator).
  ranked.sort((a, b) => {
    if (a.momentum !== b.momentum) return b.momentum - a.momentum;
    return a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0;
  });
  return ranked;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`📦 StockBox Nasdaq Scanner (index-rotation, systematic-tss port)`);
  console.log(`   Universe: ${UNIVERSE.length} NDX names | lookback: ${LOOKBACK_DAYS}d | top-${TOP_N} | rebalance: ${REBALANCE_DAYS}d`);
  console.log(`   Date: ${SCAN_DATE} | abs_filter: ${ABS_FILTER ? 'on' : 'off (always holds K)'}`);

  console.log(`📡 Fetching OHLCV data via Yahoo (shared dated cache)...`);
  const priceData = await batchFetch(UNIVERSE, CONCURRENCY);
  if (!priceData.size) { console.error('❌ No OHLCV data — aborting.'); process.exit(1); }

  console.log('🔍 Ranking by relative strength (84d total-return momentum)...');
  const ranked = computeRanking(priceData);

  // Top-K selection. rotation_abs_filter = 0 → no momentum>0 gate (box always holds K).
  const targetList = [];
  for (const r of ranked) {
    if (targetList.length >= TOP_N) break;
    if (ABS_FILTER && r.momentum <= 0) continue; // slot stays in cash (OFF for stockbox)
    targetList.push(r);
  }

  const weight = +(1 / TOP_N).toFixed(4); // equal-weight

  console.log(`\n✅ Ranked ${ranked.length} names, holding top ${targetList.length} (equal-weight ${(weight * 100).toFixed(1)}%):`);
  targetList.forEach((r, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. ${r.symbol.padEnd(6)} mom84: ${(r.momentum * 100).toFixed(2).padStart(7)}%  px:${r.entry.toFixed(2)}`);
  });

  if (DRY_RUN) { console.log('\n🏷️  Dry run — no files written.'); return targetList; }

  // Build the pool objects (rotation strategy: entry + rank + weight; NO SL/TP — rotation is the exit).
  const pool = targetList.map((r, i) => ({
    ticker: r.symbol, name: r.symbol,
    rank: i + 1,
    score: +(r.momentum * 100).toFixed(2), // momentum % = the ranking score
    momentum: +r.momentum.toFixed(4),
    entry: +r.entry.toFixed(2),
    weight,
    stop: null, tp1: null, tp2: null, rr: 'n/a', // no per-name stops — rotation IS the exit
    horizon: REBALANCE_DAYS, region: 'US', universe: 'stockbox',
    strategy: 'IndexRotation', sharia: null,
    thesis: `StockBox top-${TOP_N} rank #${i + 1}: 84d total-return momentum +${(r.momentum * 100).toFixed(1)}%, equal-weight, monthly rebalance`,
    extension: { momentum84: +r.momentum.toFixed(4), rank: i + 1, weight, lookbackDays: LOOKBACK_DAYS, rebalanceDays: REBALANCE_DAYS },
  }));

  if (OUTPUT_MODE === 'json') {
    const outPath = path.join(ROOT, 'data', `stockbox-scan-${SCAN_DATE}.json`);
    fs.writeFileSync(outPath, JSON.stringify({
      scanDate: SCAN_DATE, strategy: 'index-rotation', lookbackDays: LOOKBACK_DAYS,
      topK: TOP_N, rebalanceDays: REBALANCE_DAYS, universeSize: UNIVERSE.length,
      ranked: ranked.length, candidates: pool,
    }, null, 2));
    console.log(`\n📁 Written to ${outPath}`);
  } else if (OUTPUT_MODE === 'signals') {
    const scanDir = SCAN_FOLDER || SCAN_DATE.replace(/-/g, '');
    const sigPath = path.join(ROOT, 'scanner', scanDir, 'signals.json');
    if (!fs.existsSync(sigPath)) { console.error(`❌ ${sigPath} not found`); process.exit(1); }
    const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));

    // Dedicated pool — self-contained top-8 targets (the box's holdings for this rebalance).
    signals.stockbox_pool = pool;

    // Also expose in the shared signals[] array for listing/visibility (dedup by ticker).
    const existing = new Set((signals.signals || []).map(s => s.ticker));
    if (!signals.signals) signals.signals = [];
    let added = 0;
    for (const p of pool) {
      if (existing.has(p.ticker)) continue;
      signals.signals.push({
        ticker: p.ticker, name: p.ticker, score: p.score, strategy: 'IndexRotation',
        entry: p.entry, stop: p.stop, tp1: p.tp1, tp2: p.tp2, rr: p.rr,
        horizon: p.horizon, region: p.region, universe: p.universe,
        sharia: null, thesis: p.thesis, extension: p.extension,
      });
      existing.add(p.ticker);
      added++;
    }

    // Scan marker — proof the stockbox scanner ran for this date (even with 0 signals).
    if (!signals._scanRuns) signals._scanRuns = {};
    signals._scanRuns.stockbox = {
      at: new Date().toISOString(),
      universe: 'stockbox',
      ranked: ranked.length,
      signals: pool.length,
      added,
    };
    fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
    console.log(`\n📁 Wrote stockbox_pool (${pool.length}) + appended ${added} signals to ${sigPath}`);
  }

  return targetList;
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
