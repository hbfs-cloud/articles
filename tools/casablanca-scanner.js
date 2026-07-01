#!/usr/bin/env node
'use strict';

/**
 * casablanca-scanner.js — Momentum-Rotation scanner for Casablanca Bourse (BVC)
 *
 * Uses BVC API directly (api.casablanca-bourse.com) — NOT Yahoo Finance.
 *
 * ENTRY-LOGIC PARITY: the Casablanca / MA book runs `strategy: momentum-rotation`
 * in systematic-tss (config/later|pre-live/portfolio_ma.yaml → NewScanner("momentum-rotation")
 * paired with the adaptive-fractal *PM* for exits/sizing). Entry candidate selection & scoring
 * is therefore MOMENTUM-ROTATION, not adaptive-fractal. This scanner ports
 * internal/engine/scanner_momentum_rotation.go (scoreSymbol) so it natively emits the same
 * ranked BUY candidates as the Go backtest. The "AdaptiveFractal" mode label is a downstream
 * routing tag only (see signals.json write-out).
 *
 * Usage:
 *   node tools/casablanca-scanner.js --dry-run
 *   node tools/casablanca-scanner.js --output signals --folder 20260629
 *   node tools/casablanca-scanner.js --min-score 0 --top 15
 */

const fs = require('fs');
const path = require('path');
const {
  calcSMA, calcRSI, calcATR, calcVolatility, calcMomentum,
  calcAvgVolume, calcMedianVolume, calcDollarVolumePercentile, calcStochastic,
} = require('./lib/fractal-indicators');
const { batchFetchBVC } = require('./lib/bvc-fetcher');

const ROOT = path.join(__dirname, '..');

const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}
const hasFlag = name => args.includes(`--${name}`);

// Go momentum-rotation default minScore = 0.0 (config/later/portfolio_ma.yaml sets no min_score).
// Scores are momentum-weighted (mom20*50+mom50*30+mom100*20, ×1.2 if all positive) → small range,
// so a high pre-filter would silently drop valid candidates. Default 0 to match Go; ranking + --top
// select the same candidate set the Go scanner returns (limit = MaxCandidates).
const MIN_SCORE = parseFloat(getArg('min-score', '0'));
const TOP_N = parseInt(getArg('top', '15'));
const OUTPUT_MODE = getArg('output', 'stdout');
const DRY_RUN = hasFlag('dry-run');
const SCAN_DATE = getArg('date', new Date().toISOString().slice(0, 10));
const SCAN_FOLDER = getArg('folder', null);
const REGIME = getArg('regime', null);
const CONCURRENCY = parseInt(getArg('concurrency', '5'));

// ─── Momentum-Rotation Scoring ──────────────────────────────────────────────
// Faithful port of systematic-tss internal/engine/scanner_momentum_rotation.go (scoreSymbol),
// with the MA book's *effective* config (config/later|pre-live/portfolio_ma.yaml).
//
// MA scanner_filters and how Go actually consumes them:
//   min_price: 20         → maps to MinPrice, but momentum-rotation.scoreSymbol NEVER reads
//                           MinPrice → INERT in Go (documented divergence: no price floor applied).
//   min_momentum_20d: 0.0 → NOT a recognized yaml key (struct tag is `min_mom10`) → ignored →
//                           default minMom20 = 0.0.
//   min_volume_ratio: 1.0 → NOT a recognized yaml key (struct tag is `min_vol_ratio`) → ignored →
//                           NO volume-ratio filter applied.
//   skip_months: [9]      → seasonality gate applied at the strategy layer, not in the scanner.
// => Effective scanner gates are the Go defaults below.
//
// SECTOR META: Go's scoreSymbol early-returns when a symbol has no metadata, but MA config sets
// no sector white/blacklist, so meta only ever gates on presence. Go's MA universe carries meta
// from secmaster for every symbol → all pass. We have no BVC sector meta locally, so we do NOT
// replicate the hasMeta gate (replicating it would zero every candidate). Net effect identical
// for MA since no sector filter is active.
const MR = {
  minMom20: 0.0,   // FILTER 2 threshold (MinMom10 default, repurposed for 20d momentum)
  minATRPct: 0.01, // FILTER 3 lower band (MinATRPct default)
  maxATRPct: 0.10, // FILTER 3 upper band (MaxATRRatio default)
  minRSI: 30.0,    // FILTER 4 (MinRSI default)
  maxRSI: 80.0,    // FILTER 4 (MaxRSI default)
  minScore: 0.0,   // MinScore default
};

function scoreSymbolMomentumRotation(bars) {
  const n = bars.length;
  if (n < 200) return null; // momentum-rotation requires >= 200 bars

  const price = bars[n - 1].close;
  if (!(price > 0) || !isFinite(price)) return null;

  const mom20 = calcMomentum(bars, 20);
  const mom50 = calcMomentum(bars, 50);
  const mom100 = calcMomentum(bars, 100);

  const ma50 = calcSMA(bars, 50);
  const ma200 = calcSMA(bars, 200);
  const atr = calcATR(bars, 14);
  const rsi = calcRSI(bars, 14);

  if (ma50 <= 0 || ma200 <= 0 || atr <= 0) return null;

  const atrPct = atr / price;

  // FILTER 1: confirmed uptrend (MA50 > MA200)
  if (ma50 <= ma200) return null;
  // FILTER 2: 20d momentum positive (already moving)
  if (mom20 < MR.minMom20) return null;
  // FILTER 3: ATR within reasonable band
  if (atrPct < MR.minATRPct || atrPct > MR.maxATRPct) return null;
  // FILTER 4: RSI in optimal zone
  if (rsi < MR.minRSI || rsi > MR.maxRSI) return null;

  // SCORING: momentum-weighted — recent (20d) counts more than older (100d)
  let score = mom20 * 50 + mom50 * 30 + mom100 * 20;
  // Consistency bonus: all momentum periods positive
  if (mom20 > 0 && mom50 > 0 && mom100 > 0) score *= 1.2;
  // Match Go's math.Round(score*100)/100
  score = Math.round(score * 100) / 100;

  if (score < MR.minScore) return null;

  // Stop loss at 2x ATR (Go: price - 2*atr)
  const stop = price - 2 * atr;

  const ma20 = calcSMA(bars, 20);
  const distMA20 = ma20 > 0 ? (price - ma20) / ma20 : 0;
  const distMA50 = ma50 > 0 ? (price - ma50) / ma50 : 0;
  const distMA200 = ma200 > 0 ? (price - ma200) / ma200 : 0;
  const avgVol = calcAvgVolume(bars, 20);
  const volRatio = avgVol > 0 ? (bars[n - 1].volume || 0) / avgVol : 0;

  // No MinVolRatio / MinDistMA20 / liquidity filters active for MA config → none applied.

  return {
    score, price, entry: price,
    stop: +stop.toFixed(4),
    atr, rsi, volatility: atrPct,
    mom20, mom50, mom100,
    volRatio: +volRatio.toFixed(2),
    distMA20: +distMA20.toFixed(4), distMA50: +distMA50.toFixed(4), distMA200: +distMA200.toFixed(4),
    ma50, ma200, strategy: 'momentum-rotation',
  };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🏛️  Casablanca Bourse Scanner (AF scoring, BVC API)`);
  console.log(`   minScore: ${MIN_SCORE} | top: ${TOP_N}`);
  console.log(`   Date: ${SCAN_DATE} | Regime: ${REGIME || 'auto'}`);

  const priceData = await batchFetchBVC(CONCURRENCY);
  if (!priceData.size) { console.error('❌ No BVC OHLCV data — aborting.'); process.exit(1); }

  console.log('🔍 Scoring candidates (momentum-rotation)...');
  const candidates = [];
  const scanDateNorm = SCAN_DATE.replace(/-/g, '');

  for (const [ticker, rawBars] of priceData) {
    const cutIdx = rawBars.findIndex(b => b.date.replace(/-/g, '') > scanDateNorm);
    const bars = cutIdx > 0 ? rawBars.slice(0, cutIdx) : rawBars;

    const result = scoreSymbolMomentumRotation(bars);
    if (!result) continue;
    if (result.score < MIN_SCORE) continue;

    const risk = result.entry - result.stop;
    if (risk <= 0) continue;

    const tp1 = +(result.entry + risk * 2).toFixed(2);
    const tp2 = +(result.entry + risk * 3).toFixed(2);

    candidates.push({
      ticker, score: result.score,
      entry: +result.entry.toFixed(2), stop: +result.stop.toFixed(2), tp1, tp2,
      rr: '1:2.0', metrics: result,
    });
  }

  // Match Go ranking: score DESC, tie-break Symbol ASC (deterministic top-N = scanner limit).
  candidates.sort((a, b) => (b.score - a.score) || a.ticker.localeCompare(b.ticker));
  const topCandidates = candidates.slice(0, TOP_N);

  console.log(`\n✅ Found ${candidates.length} signals (passed all filters), top ${topCandidates.length}:`);
  for (const c of topCandidates) {
    const icon = c.score >= 20 ? '📈' : c.score >= 10 ? '📊' : '  ';
    const trend = c.metrics.distMA20 > 0 && c.metrics.distMA50 > 0 && c.metrics.distMA200 > 0 ? '↑↑↑' :
                  c.metrics.distMA50 > 0 && c.metrics.distMA200 > 0 ? '↑↑' : '↑';
    console.log(`  ${icon} ${c.ticker.padEnd(8)} score:${String(c.score).padStart(6)} ${trend} E:${c.entry} S:${c.stop} RSI:${c.metrics.rsi.toFixed(0)} Mom20:${(c.metrics.mom20 * 100).toFixed(0)}%`);
  }

  if (DRY_RUN) { console.log('\n🏷️  Dry run — no files written.'); return topCandidates; }

  if (OUTPUT_MODE === 'json') {
    const outPath = path.join(ROOT, 'data', `fractal-scan-casablanca-${SCAN_DATE}.json`);
    fs.writeFileSync(outPath, JSON.stringify({ scanDate: SCAN_DATE, regime: REGIME, assetClass: 'casablanca', candidates: topCandidates }, null, 2));
    console.log(`\n📁 Written to ${outPath}`);
  } else if (OUTPUT_MODE === 'signals') {
    const scanDir = SCAN_FOLDER || SCAN_DATE.replace(/-/g, '');
    const sigPath = path.join(ROOT, 'scanner', scanDir, 'signals.json');
    if (!fs.existsSync(sigPath)) { console.error(`❌ ${sigPath} not found`); process.exit(1); }
    const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
    if (!signals.casablanca_pool) signals.casablanca_pool = [];
    const existing = new Set(signals.casablanca_pool.map(s => s.ticker));
    let added = 0;
    for (const c of topCandidates) {
      if (existing.has(c.ticker)) continue;
      signals.casablanca_pool.push({
        // strategy label stays 'AdaptiveFractal' = downstream routing tag for the casablanca mode
        // (modes-config filterName/regimeFilters = adaptive_fractal). The scoring is momentum-rotation.
        ticker: c.ticker, name: c.ticker, score: c.score, strategy: 'AdaptiveFractal',
        entry: c.entry, stop: c.stop, tp1: c.tp1, tp2: c.tp2, rr: c.rr,
        horizon: 21, region: 'CASABLANCA', universe: 'casablanca',
        sharia: null,
        thesis: `MomRotation score ${c.score}: Mom20=${(c.metrics.mom20 * 100).toFixed(0)}%, Mom50=${(c.metrics.mom50 * 100).toFixed(0)}%, Mom100=${(c.metrics.mom100 * 100).toFixed(0)}%, RSI=${c.metrics.rsi.toFixed(0)}, ATR%=${(c.metrics.volatility * 100).toFixed(1)}`,
        extension: { rsi: +c.metrics.rsi.toFixed(1), mom20: +c.metrics.mom20.toFixed(3), mom50: +c.metrics.mom50.toFixed(3), mom100: +c.metrics.mom100.toFixed(3) },
      });
      existing.add(c.ticker);
      added++;
    }
    fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
    console.log(`\n📁 Appended ${added} Casablanca signals to ${sigPath}`);
  }

  return topCandidates;
}

if (require.main === module) {
  main().catch(e => { console.error('❌', e.message); process.exit(1); });
}

module.exports = { scoreSymbolMomentumRotation, MR };
