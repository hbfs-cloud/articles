#!/usr/bin/env node
'use strict';

/**
 * gap-scanner.js — Gap-and-Go premarket continuation scanner (Brique 3, VOIE A).
 *
 * SPEC: docs/specs/event-driven-scanners.md §2.3 (+ §2.0 shared gates, §2.5 output schema,
 * §3.1 pipeline). Modelled EXACTLY on tools/momentum-scanner.js — same fetch path (Yahoo via
 * tools/lib/price-cache), same anti-look-ahead slice, same signals.json merge pattern.
 *
 * SCOPE — SIM-ONLY. This script ONLY generates signals (gap_pool) + a run marker. It never
 * places an order and never calls any broker/simulator tool. Perf is simulated downstream by
 * sweep.js → gen-status-page.js → gen-api.js, exactly like every other asset-class pool.
 *
 * VOIE A — fetch direct, ZERO MCP. Runs as a pure node subprocess (local + `claude -p` cloud):
 * it fetches public Yahoo daily bars and computes everything from them. No OAuth2 token, no
 * proprietary data → never blocking. (PEAD/filings are voie B — staging AGENT → ingest — and
 * live in their own scripts; this one shares NONE of that.)
 *
 * Daily-bar proxies (documented, not hidden): true premarket tape isn't fetchable here, so
 *   - gap        = last completed session's OPEN vs the prior session's CLOSE
 *   - "premarket volume anomaly" = gap-day volume ratio vs the prior 20-session average volume
 *   - VWAP entry = gap-day typical price (H+L+C)/3  (opening-VWAP continuation proxy)
 * These are conservative stand-ins; the RunBacktest DSL validation (spec §2.3, gap_pct()/hhv/vol)
 * is the clean bar-derived arm that governs promotion out of draft.
 *
 * Earnings dedup (spec §2.3 pt 5 + §3.1): the gap pool takes ONLY non-earnings gaps — an
 * earnings gap belongs to pead_pool (one ticker is never in two pools). Voie A has NO earnings
 * calendar (that's MCP-only), so classification is done at INGEST/pipeline level. Concretely this
 * script dedups against any pead_pool ALREADY present in the same signals.json, and against an
 * optional --earnings-exclude <file> list staged by the AGENT from the MCP earnings calendar.
 * Absent that info, is_earnings_gap stays null (unknown) — NEVER fabricated (MCP hard-stop).
 *
 * Usage:
 *   node tools/gap-scanner.js --output signals --date 20260711 --folder 20260711 --regime RISK-ON --min-gap 4 --top 15
 *   node tools/gap-scanner.js --dry-run --min-gap 5
 *   node tools/gap-scanner.js --universe americanbull --earnings-exclude /tmp/earnings-window.json
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { calcATR, calcAvgVolume, calcDollarVolumePercentile } = require('./lib/fractal-indicators');
const priceCache = require('./lib/price-cache');

const ROOT = path.join(__dirname, '..');

const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}
const hasFlag = name => args.includes(`--${name}`);

// ─── Thresholds — SOURCE OF TRUTH is data/scanner-filters.json (spec §6). CLI overrides per-run. ─
const FILTERS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'scanner-filters.json'), 'utf8'));
const ED = (FILTERS.event_driven || {});
const ED_STOPS = ED.stops || FILTERS.stops || { min_pct_from_entry: 3, max_pct_from_entry: 8, min_atr_multiple: 1.5 };
const RR_BY_REGIME = ED.rr_min_by_regime || {
  'RISK-ON': 1.5, 'NEUTRAL': 1.5, 'RECOVERY': 1.5, 'EARLY RISK-OFF': 2.0, 'RISK-OFF': 2.0,
};
const SECTOR_MAP = (FILTERS.diversification && FILTERS.diversification.sector_map) || {};
const SCORE_CAP = (FILTERS.score_limits && FILTERS.score_limits.max_score) || ED.score_cap || 98;
const SCORE_BASE = 58; // spec §2.3: score = 58 + gap_tier + vol_tier (+ news bonus if voie-B enrichment)

// CLI --min-gap overrides event_driven.min_gap_pct; other gates from config.
const MIN_GAP_PCT = parseFloat(getArg('min-gap', String(ED.min_gap_pct ?? 4)));
const MIN_VOL_RATIO = parseFloat(ED.premarket_vol_ratio ?? 3);
const MIN_DOLLAR_VOL = parseFloat(ED.min_dollar_volume_usd ?? 1_000_000);
const MIN_PRICE = parseFloat(ED.min_price_usd ?? 5);
const EXCLUDE_EARNINGS = ED.exclude_earnings_gap !== false;
const HORIZON = parseInt(String(ED.horizon ?? (FILTERS.modes_gap_horizon ?? 6)), 10) || 6;

const STOP_MIN_PCT = (ED_STOPS.min_pct_from_entry ?? 3) / 100;
const STOP_MAX_PCT = (ED_STOPS.max_pct_from_entry ?? 8) / 100;
const STOP_MIN_ATR = ED_STOPS.min_atr_multiple ?? 1.5;

const UNIVERSE_NAME = getArg('universe', 'americanbull');
const CUSTOM_TICKERS = getArg('tickers', '').split(',').filter(Boolean);
const TOP_N = parseInt(getArg('top', '15'), 10);
const OUTPUT_MODE = getArg('output', 'stdout');
const DRY_RUN = hasFlag('dry-run');
const SCAN_DATE = getArg('date', new Date().toISOString().slice(0, 10));
const SCAN_FOLDER = getArg('folder', null);
const REGIME = getArg('regime', null);
const REGIME_KEY = (REGIME || 'EARLY RISK-OFF').toUpperCase().trim(); // fail-closed: unknown → defensive
const RR_MIN = RR_BY_REGIME[REGIME_KEY] ?? 2.0; // unknown regime → strictest floor
const CONCURRENCY = parseInt(getArg('concurrency', '10'), 10);
const EARNINGS_EXCLUDE_FILE = getArg('earnings-exclude', null);

const UNIVERSE_FILES = {
  americanbull: 'americanbull-universe.json',
  eu: 'eu-universe.json',
};

// Cache prix DATÉ partagé (US, interval 1d) — point-in-time rejouable, comme momentum-scanner.
const CACHE_OPTS = { date: SCAN_DATE, market: priceCache.MARKETS.US, interval: '1d' };
const MIN_BARS = 30; // need >=22 for hhv20(excl gap day)+atr14; 30 for a comfortable margin.

// ─── Universe loader (same 3-format tolerance as momentum-scanner) ────────────

function loadUniverse() {
  if (CUSTOM_TICKERS.length) return CUSTOM_TICKERS;
  const file = UNIVERSE_FILES[UNIVERSE_NAME];
  if (!file) { console.error(`❌ Unknown universe: ${UNIVERSE_NAME}`); process.exit(1); }
  const fp = path.join(ROOT, 'data', file);
  if (!fs.existsSync(fp)) { console.error(`❌ Universe file not found: ${fp}`); process.exit(1); }
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const raw = data.tickers || data.stocks || (Array.isArray(data) ? data : []);
  return raw.map(x => (typeof x === 'string' ? x : (x && (x.symbol || x.ticker)))).filter(Boolean);
}

// ─── Yahoo OHLCV fetcher (shared dated cache — identical path to momentum-scanner) ─

function readCache(ticker) {
  const bars = priceCache.readBars(ticker, CACHE_OPTS);
  if (bars && bars.length >= MIN_BARS) return bars;
  return null;
}

function fetchOHLCV(ticker) {
  return new Promise((resolve) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1y&interval=1d`;
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
              adjClose: adj?.[i] || c2, volume: v || 0,
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
      if (done % 100 === 0) process.stderr.write(`  fetched ${done}/${tickers.length} (${result.size} valid, ${cached} cached)\r`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  process.stderr.write(`  fetched ${done}/${tickers.length} (${result.size} valid, ${cached} cached)\n`);
  return result;
}

// ─── Local helpers (EMA20 / VWAP proxy / hhv20 — not in fractal-indicators) ───

function calcEMA(bars, period) {
  const n = bars.length;
  if (n < period) return 0;
  const k = 2 / (period + 1);
  let ema = bars[n - period].close;
  for (let i = n - period + 1; i < n; i++) ema = bars[i].close * k + ema * (1 - k);
  return ema;
}

// Highest high over the `period` bars STRICTLY BEFORE the last (gap) bar — the resistance the
// gap has to clear. Excludes the gap day itself so "above resistance" isn't self-referential.
function priorHHV(bars, period) {
  const n = bars.length;
  const end = n - 1;                 // exclusive: skip gap day
  const start = Math.max(0, end - period);
  let hh = -Infinity;
  for (let i = start; i < end; i++) if (bars[i].high > hh) hh = bars[i].high;
  return hh;
}

// ─── Gap evaluation (the momentum-scanner scoreSymbol analog) ─────────────────

function gapTier(gap) {
  if (gap >= 15) return 16;
  if (gap >= 10) return 14;
  if (gap >= 6) return 10;
  return 6; // gap >= MIN_GAP_PCT
}
function volTier(vr) {
  if (vr >= 5) return 14;
  if (vr >= 3) return 12;
  if (vr >= 2) return 8;
  if (vr >= 1.5) return 4;
  return 0;
}

function evaluateGap(bars) {
  const n = bars.length;
  if (n < MIN_BARS) return null;

  const gapDay = bars[n - 1];
  const prev = bars[n - 2];
  const price = gapDay.close;
  if (!(price >= MIN_PRICE) || !isFinite(price)) return null; // penny/invalid reject
  if (!(prev.close > 0)) return null;

  // 1) Gap up vs prior close.
  const gap = (gapDay.open / prev.close - 1) * 100;
  if (gap < MIN_GAP_PCT) return null;

  // 2) Premarket volume anomaly (proxy: gap-day volume vs prior 20-session average).
  const avgVol20 = calcAvgVolume(bars.slice(0, n - 1), 20);
  const volRatio = avgVol20 > 0 ? (gapDay.volume || 0) / avgVol20 : 0;
  if (volRatio < MIN_VOL_RATIO) return null;

  // 3) Liquidity floor — "normal" dollar-volume (median of prior 20 sessions, excludes the spike).
  const dollarVol = calcDollarVolumePercentile(bars.slice(0, n - 1), 20, 0.5);
  if (dollarVol < MIN_DOLLAR_VOL) return null;

  // 4) Above prior resistance — gap must clear the 20-bar high, not fire into the void.
  const hhv20 = priorHHV(bars, 20);
  if (!(price > hhv20) || !isFinite(hhv20)) return null;

  const atr = calcATR(bars, 14);
  if (!(atr > 0)) return null;
  const ema20 = calcEMA(bars, 20);

  // Entry = opening-VWAP continuation proxy = gap-day typical price (H+L+C)/3.
  const vwapEst = (gapDay.high + gapDay.low + gapDay.close) / 3;
  const entry = vwapEst;

  // Stop = min(vwap*0.97, gap-day low), then clamp to [3%,8%] AND >= 1.5x ATR (spec §2.0 gates).
  let stop = Math.min(vwapEst * (1 - 0.03), gapDay.low);
  let stopDist = entry - stop;
  const minDist = Math.max(entry * STOP_MIN_PCT, STOP_MIN_ATR * atr);
  const maxDist = entry * STOP_MAX_PCT;
  if (stopDist < minDist) stopDist = minDist;
  if (stopDist > maxDist) stopDist = maxDist;
  stop = entry - stopDist;
  if (!(stop > 0) || stopDist <= 0) return null;

  // TP1 = measured move: project the overnight gap ("flag-pole") height, floored at 2x ATR.
  const poleHeight = gapDay.open - prev.close;
  const measuredMove = Math.max(poleHeight, 2 * atr);
  const tp1 = entry + measuredMove;
  const tp2 = entry + 2 * measuredMove; // display/order-form second leg (measured extension)

  const rr = (tp1 - entry) / stopDist;
  if (rr < RR_MIN) return null; // R/R computed FROM technicals, gated by regime floor

  let score = SCORE_BASE + gapTier(gap) + volTier(volRatio); // + news bonus (voie B only, 0 here)
  if (score > SCORE_CAP) score = SCORE_CAP;

  const extEma20 = ema20 > 0 ? (price - ema20) / ema20 * 100 : 0;

  return {
    score,
    gap: +gap.toFixed(2),
    volRatio: +volRatio.toFixed(2),
    dollarVol: Math.round(dollarVol),
    entry: +entry.toFixed(2),
    stop: +stop.toFixed(2),
    tp1: +tp1.toFixed(2),
    tp2: +tp2.toFixed(2),
    rr: +rr.toFixed(2),
    atr: +atr.toFixed(4),
    extEma20: +extEma20.toFixed(2),
    hhv20: +hhv20.toFixed(2),
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function loadEarningsExclude() {
  const set = new Set();
  if (!EARNINGS_EXCLUDE_FILE) return set;
  try {
    const raw = JSON.parse(fs.readFileSync(EARNINGS_EXCLUDE_FILE, 'utf8'));
    const list = Array.isArray(raw) ? raw : (raw.tickers || raw.symbols || []);
    for (const x of list) {
      const t = typeof x === 'string' ? x : (x && (x.symbol || x.ticker));
      if (t) set.add(String(t).toUpperCase());
    }
    console.log(`   Earnings-exclude list: ${set.size} tickers from ${EARNINGS_EXCLUDE_FILE}`);
  } catch (e) {
    console.error(`⚠️  --earnings-exclude unreadable (${e.message}) — proceeding with pead_pool dedup only`);
  }
  return set;
}

async function main() {
  const universe = loadUniverse();
  console.log(`⚡ Gap-and-Go Scanner (voie A — fetch direct, zero MCP)`);
  console.log(`   Universe: ${universe.length} tickers (${UNIVERSE_NAME}) | min-gap: ${MIN_GAP_PCT}% | vol>=${MIN_VOL_RATIO}x | top: ${TOP_N}`);
  console.log(`   Date: ${SCAN_DATE} | Regime: ${REGIME || 'auto'} | R/R floor: ${RR_MIN}`);

  // Earnings dedup source (voie A can't fetch the calendar): staged list + pead_pool already in file.
  const earningsExclude = loadEarningsExclude();

  console.log(`📡 Fetching OHLCV data via Yahoo...`);
  const priceData = await batchFetch(universe, CONCURRENCY);
  if (!priceData.size) { console.error('❌ No OHLCV data — aborting.'); process.exit(1); }

  console.log('🔍 Scanning for gap-and-go continuation setups...');
  const candidates = [];
  const scanDateNorm = SCAN_DATE.replace(/-/g, '');

  for (const [ticker, rawBars] of priceData) {
    // Anti-look-ahead: keep only bars up to SCAN_DATE (identical slice to momentum-scanner).
    const cutIdx = rawBars.findIndex(b => b.date.replace(/-/g, '') > scanDateNorm);
    const bars = cutIdx > 0 ? rawBars.slice(0, cutIdx) : rawBars;

    const r = evaluateGap(bars);
    if (!r) continue;

    candidates.push({ ticker, ...r });
  }

  candidates.sort((a, b) => b.score - a.score || b.gap - a.gap);
  const topCandidates = candidates.slice(0, TOP_N);

  console.log(`\n✅ Found ${candidates.length} gap-and-go setups, top ${topCandidates.length}:`);
  for (const c of topCandidates) {
    const icon = c.gap >= 10 ? '🚀' : c.gap >= 6 ? '📈' : '  ';
    console.log(`  ${icon} ${c.ticker.padEnd(8)} score:${String(c.score).padStart(3)} gap:+${c.gap.toFixed(1)}% vol:${c.volRatio}x R/R:${c.rr} entry:${c.entry} stop:${c.stop} tp1:${c.tp1}`);
  }

  if (DRY_RUN) { console.log('\n🏷️  Dry run — no files written.'); return topCandidates; }

  if (OUTPUT_MODE === 'json') {
    const outPath = path.join(ROOT, 'data', `gap-scan-${UNIVERSE_NAME}-${SCAN_DATE}.json`);
    fs.writeFileSync(outPath, JSON.stringify({ scanDate: SCAN_DATE, regime: REGIME, universe: UNIVERSE_NAME, candidates: topCandidates }, null, 2));
    console.log(`\n📁 Written to ${outPath}`);
    return topCandidates;
  }

  if (OUTPUT_MODE === 'signals') {
    const scanDir = SCAN_FOLDER || SCAN_DATE.replace(/-/g, '');
    const sigPath = path.join(ROOT, 'scanner', scanDir, 'signals.json');
    if (!fs.existsSync(sigPath)) { console.error(`❌ ${sigPath} not found`); process.exit(1); }
    // Read the WHOLE existing object and mutate only our keys — every other pool/marker is preserved.
    const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));

    // Earnings dedup: a ticker already in pead_pool is an earnings gap → it stays there, never here.
    const peadTickers = new Set((signals.pead_pool || []).map(s => String(s.ticker).toUpperCase()));

    const pool = [];
    let skippedEarnings = 0;
    for (const c of topCandidates) {
      const up = c.ticker.toUpperCase();
      if (EXCLUDE_EARNINGS && (peadTickers.has(up) || earningsExclude.has(up))) { skippedEarnings++; continue; }
      pool.push({
        ticker: c.ticker,
        name: c.ticker,
        score: c.score,
        strategy: 'GapAndGo',
        source: 'gap_pool',            // MUST equal assetClass('gap')+'_pool' — gen-status-page.signalsFor gate
        market: 'us',                  // americanbull = US; EU handled by a separate --universe run if ever added
        region: 'US',
        sector: SECTOR_MAP[c.ticker] || null,
        entry: c.entry,
        stop: c.stop,
        tp1: c.tp1,
        tp2: c.tp2,
        rr: `1:${c.rr.toFixed(2)}`,    // canonical forex_pool format "1:x.xx" (rendered verbatim by gen-status-page); sweep recomputes rr internally
        horizon: HORIZON,
        sharia: null,                  // voie A can't run the ratio screen (no MCP) → untagged, like momentum
        // is_earnings_gap: null = UNKNOWN (voie A has no earnings calendar). True classification +
        // dedup happens at ingest/pipeline (MCP earnings window) — never fabricated here.
        is_earnings_gap: null,
        catalyst: {
          type: 'premarket_gap',
          date: SCAN_DATE,
          detail: `Gap +${c.gap.toFixed(1)}% above 20-bar high ($${c.hhv20}), volume ${c.volRatio}x avg`,
        },
        thesis: `Gap-and-go: +${c.gap.toFixed(1)}% gap on ${c.volRatio}x volume, clearing the ${c.hhv20} resistance. Entry on hold above the opening-VWAP proxy ${c.entry}, stop ${c.stop} (≥1.5×ATR), measured-move TP1 ${c.tp1} for R/R ${c.rr}. Ext EMA20 ${c.extEma20 >= 0 ? '+' : ''}${c.extEma20}%.`,
        extension: { gap_pct: c.gap, vol_ratio: c.volRatio, ext_ema20_pct: c.extEma20, atr14: c.atr },
      });
    }

    // REPLACE the gap_pool wholesale (idempotent regen), leave all sibling keys untouched.
    signals.gap_pool = pool;

    // Scan marker — proof the gap scanner ran (0 signal on a calm day is LEGITIMATE; a MISSING
    // marker = silent crash = qa-check ❌). Merged into the shared _scanRuns without clobbering.
    if (!signals._scanRuns) signals._scanRuns = {};
    signals._scanRuns.gap = {
      at: new Date().toISOString(),
      universe: UNIVERSE_NAME,
      universeFetched: priceData.size,   // qa-check guards this >= 100 (source data OK), like bull
      candidates: candidates.length,
      signals: pool.length,
      skippedEarnings,
      regime: REGIME || null,
      minGap: MIN_GAP_PCT,
    };

    fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
    console.log(`\n📁 Wrote gap_pool (${pool.length} signals, ${skippedEarnings} earnings-gaps deferred to pead_pool) to ${sigPath}`);
    return pool;
  }

  return topCandidates;
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
