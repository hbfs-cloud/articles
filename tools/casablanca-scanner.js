#!/usr/bin/env node
'use strict';

/**
 * casablanca-scanner.js — Adaptive Fractal scanner for Casablanca Bourse
 *
 * Uses BVC API directly (api.casablanca-bourse.com) — NOT Yahoo Finance.
 * Same AF scoring as fractal-scanner.js but with BVC-specific data pipeline.
 *
 * Usage:
 *   node tools/casablanca-scanner.js --dry-run
 *   node tools/casablanca-scanner.js --output signals --folder 20260629
 *   node tools/casablanca-scanner.js --min-score 20 --top 15
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

const MIN_SCORE = parseFloat(getArg('min-score', '25'));
const TOP_N = parseInt(getArg('top', '15'));
const OUTPUT_MODE = getArg('output', 'stdout');
const DRY_RUN = hasFlag('dry-run');
const SCAN_DATE = getArg('date', new Date().toISOString().slice(0, 10));
const SCAN_FOLDER = getArg('folder', null);
const REGIME = getArg('regime', null);
const CONCURRENCY = parseInt(getArg('concurrency', '5'));

// ─── AF Scoring (same as fractal-scanner.js) ────────────────────────────────

function calcQualityScore(bars, rsi, mom60, mom120, avgVol20) {
  const n = bars.length;
  if (n < 20) return 0;
  let score = 0;

  if (rsi >= 45 && rsi <= 60) score += 25;
  else if (rsi < 45) score += 20;
  else if (rsi <= 70) score += 15;
  else score += 5;

  const [stochK] = calcStochastic(bars, 14);
  if (stochK < 70) score += 20;
  else if (stochK < 80) score += 15;
  else score += 5;

  if (mom120 > 0.50) score += 25;
  else if (mom120 > 0.30) score += 20;
  else if (mom120 > 0.15) score += 15;
  else score += 5;

  if (mom120 > 0 && mom60 > 0 && mom120 > mom60) score += 15;
  else if (mom120 > 0 && mom60 > 0) score += 10;

  if (avgVol20 > 0) {
    const volRatio = (bars[n - 1].volume || 0) / avgVol20;
    if (volRatio > 1.3) score += 15;
    else if (volRatio > 1.0) score += 10;
    else score += 5;
  }
  return score;
}

const FILTERS = { minPrice: 0, maxVol: 0.20, maxATRPct: 0.15, rsiMin: 28, rsiMax: 82, minMom10: 0.00, requireAboveSMA200: true };

function scoreSymbolAF(bars, regime) {
  const n = bars.length;
  if (n < 120) return null;
  const f = FILTERS;

  const price = bars[n - 1].close;
  if (price <= 0) return null;

  const sma20 = calcSMA(bars, 20);
  const sma50 = calcSMA(bars, 50);
  const sma200 = calcSMA(bars, 200);
  const rsi = calcRSI(bars, 14);
  const atr = calcATR(bars, 14);
  const volatility = calcVolatility(bars, 20);
  const mom10 = calcMomentum(bars, 10);
  const mom60 = calcMomentum(bars, 60);
  const mom120 = calcMomentum(bars, 120);

  if (price < f.minPrice) return null;
  if (f.requireAboveSMA200 && sma200 > 0 && price < sma200) return null;
  if (rsi < f.rsiMin || rsi > f.rsiMax) return null;
  if (mom10 < f.minMom10) return null;
  if (volatility > f.maxVol) return null;
  if (atr / price > f.maxATRPct) return null;

  const avgVol20 = calcAvgVolume(bars, 20);
  let volRatio = 0;
  if (avgVol20 > 0) {
    volRatio = (bars[n - 1].volume || 0) / avgVol20;
    if (volRatio < 0.5) return null;
  }

  const qualityScore = calcQualityScore(bars, rsi, mom60, mom120, avgVol20);
  let riskScore = volatility * 100;
  if (price < sma50) riskScore *= 1.5;

  let rewardScore = (mom60 * 0.3 + mom120 * 0.7) * 100;
  if (rewardScore < 0) rewardScore = 0;
  if (price > sma20 && sma20 > sma50 && sma50 > sma200) rewardScore *= 1.5;
  else if (price > sma50 && sma50 > sma200) rewardScore *= 1.2;
  if (rewardScore > 100) rewardScore = 100;

  let timingScore = 0;
  if (rsi < 30) timingScore += 50;
  else if (rsi < 45) timingScore += 40;
  else if (rsi < 55) timingScore += 25;
  else if (rsi < 65) timingScore += 10;
  if (rsi > 75) timingScore -= 30;
  else if (rsi > 70) timingScore -= 20;
  if (sma50 > sma200 && price > sma50) timingScore += 20;

  const distFromMA20 = sma20 > 0 ? (price - sma20) / sma20 : 0;
  if (distFromMA20 > 0.30) timingScore -= 25;
  else if (distFromMA20 > 0.20) timingScore -= 10;

  const riskAdjusted = 100 / (riskScore + 1);
  let finalScore = (rewardScore * 0.30) + (timingScore * 0.20) + (riskAdjusted * 0.25) + (qualityScore * 0.25);

  if (regime) {
    const r = regime.toUpperCase().replace(/[- ]/g, '_');
    if (r.includes('RISK_ON')) finalScore *= 1.1;
    else if (r.includes('RISK_OFF') && !r.includes('EARLY')) finalScore *= 0.8;
  }

  const distMA20 = sma20 > 0 ? (price - sma20) / sma20 : 0;
  const distMA50 = sma50 > 0 ? (price - sma50) / sma50 : 0;
  const distMA200 = sma200 > 0 ? (price - sma200) / sma200 : 0;

  return {
    score: +finalScore.toFixed(2), price, entry: price,
    stop: +(price - atr * 2.5).toFixed(4),
    atr, rsi, volatility, mom10, mom60, mom120,
    volRatio: +volRatio.toFixed(2), qualityScore,
    rewardScore: +rewardScore.toFixed(1), timingScore,
    distMA20: +distMA20.toFixed(4), distMA50: +distMA50.toFixed(4), distMA200: +distMA200.toFixed(4),
    sma20, sma50, sma200, strategy: 'adaptive-fractal',
  };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🏛️  Casablanca Bourse Scanner (AF scoring, BVC API)`);
  console.log(`   minScore: ${MIN_SCORE} | top: ${TOP_N}`);
  console.log(`   Date: ${SCAN_DATE} | Regime: ${REGIME || 'auto'}`);

  const priceData = await batchFetchBVC(CONCURRENCY);
  if (!priceData.size) { console.error('❌ No BVC OHLCV data — aborting.'); process.exit(1); }

  console.log('🔍 Scoring candidates (multi-factor)...');
  const candidates = [];
  const scanDateNorm = SCAN_DATE.replace(/-/g, '');

  for (const [ticker, rawBars] of priceData) {
    const cutIdx = rawBars.findIndex(b => b.date.replace(/-/g, '') > scanDateNorm);
    const bars = cutIdx > 0 ? rawBars.slice(0, cutIdx) : rawBars;

    const result = scoreSymbolAF(bars, REGIME);
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

  candidates.sort((a, b) => b.score - a.score);
  const topCandidates = candidates.slice(0, TOP_N);

  console.log(`\n✅ Found ${candidates.length} signals (passed all filters), top ${topCandidates.length}:`);
  for (const c of topCandidates) {
    const icon = c.score >= 70 ? '📈' : c.score >= 50 ? '📊' : '  ';
    const trend = c.metrics.distMA20 > 0 && c.metrics.distMA50 > 0 && c.metrics.distMA200 > 0 ? '↑↑↑' :
                  c.metrics.distMA50 > 0 && c.metrics.distMA200 > 0 ? '↑↑' : '↑';
    console.log(`  ${icon} ${c.ticker.padEnd(8)} score:${String(c.score).padStart(5)} ${trend} E:${c.entry} S:${c.stop} RSI:${c.metrics.rsi.toFixed(0)} Mom120:${(c.metrics.mom120 * 100).toFixed(0)}%`);
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
    const existing = new Set((signals.signals || []).map(s => s.ticker));
    let added = 0;
    for (const c of topCandidates) {
      if (existing.has(c.ticker)) continue;
      signals.signals.push({
        ticker: c.ticker, name: c.ticker, score: c.score, strategy: 'AdaptiveFractal',
        entry: c.entry, stop: c.stop, tp1: c.tp1, tp2: c.tp2, rr: c.rr,
        horizon: 21, region: 'CASABLANCA',
        sharia: null,
        thesis: `AF score ${c.score}: Mom120=${(c.metrics.mom120 * 100).toFixed(0)}%, RSI=${c.metrics.rsi.toFixed(0)}, Vol=${c.metrics.volatility.toFixed(3)}, Quality=${c.metrics.qualityScore.toFixed(0)}`,
        extension: { rsi: +c.metrics.rsi.toFixed(1), mom120: +c.metrics.mom120.toFixed(3) },
      });
      existing.add(c.ticker);
      added++;
    }
    fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
    console.log(`\n📁 Appended ${added} Casablanca signals to ${sigPath}`);
  }

  return topCandidates;
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
