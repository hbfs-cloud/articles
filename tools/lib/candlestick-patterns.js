'use strict';

/**
 * Candlestick pattern detection library — replicates systematic-tss americanbulls scanner.
 *
 * Detects: Hammer, Bullish Engulfing, Pin Bar + volume spike confirmation.
 * Each detector returns { name, strength, confirmed, patternLow, patternTarget } or null.
 *
 * Usage:
 *   const { scanPatterns } = require('./lib/candlestick-patterns');
 *   const patterns = scanPatterns(bars);  // bars = [{ date, open, high, low, close, volume }, ...]
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

function bodySize(bar) { return Math.abs(bar.close - bar.open); }
function upperWick(bar) { return bar.high - Math.max(bar.open, bar.close); }
function lowerWick(bar) { return Math.min(bar.open, bar.close) - bar.low; }
function isBullish(bar) { return bar.close > bar.open; }
function isBearish(bar) { return bar.close < bar.open; }
function range(bar) { return bar.high - bar.low; }

function avgVolume(bars, end, lookback = 20) {
  const slice = bars.slice(Math.max(0, end - lookback), end);
  if (!slice.length) return 0;
  return slice.reduce((s, b) => s + (b.volume || 0), 0) / slice.length;
}

function sma(bars, end, period, field = 'close') {
  const slice = bars.slice(Math.max(0, end - period), end);
  if (slice.length < period * 0.7) return null;
  return slice.reduce((s, b) => s + b[field], 0) / slice.length;
}

// ─── Pattern Detectors ──────────────────────────────────────────────────────

/**
 * Hammer: long lower wick (≥2× body), small upper wick (<30% range), bullish close preferred.
 * Must appear after downtrend (close < SMA20).
 */
function detectHammer(bars, idx) {
  if (idx < 20) return null;
  const bar = bars[idx];
  const body = bodySize(bar);
  const lower = lowerWick(bar);
  const upper = upperWick(bar);
  const r = range(bar);

  if (r < 0.001) return null;
  if (lower < body * 2) return null;
  if (upper > r * 0.30) return null;

  const ma20 = sma(bars, idx, 20);
  if (!ma20 || bar.close > ma20) return null;

  const strength = Math.min(1.0, (lower / body - 2) * 0.2 + 0.6);
  const patternLow = bar.low;
  const patternTarget = bar.close + r;

  return {
    name: 'hammer',
    strength: +strength.toFixed(2),
    confirmed: isBullish(bar),
    barsInvolved: 1,
    patternLow,
    patternTarget,
    invalidation: patternLow,
  };
}

/**
 * Bullish Engulfing: bearish bar followed by bullish bar whose body engulfs the prior.
 * Volume on engulfing bar > prior bar volume.
 */
function detectBullishEngulfing(bars, idx) {
  if (idx < 20) return null;
  const prev = bars[idx - 1];
  const cur = bars[idx];

  if (!isBearish(prev) || !isBullish(cur)) return null;
  if (cur.open > prev.close) return null;
  if (cur.close < prev.open) return null;

  const engulfRatio = bodySize(cur) / Math.max(bodySize(prev), 0.001);
  if (engulfRatio < 1.0) return null;

  const ma20 = sma(bars, idx, 20);
  if (!ma20 || cur.close > ma20 * 1.02) return null;

  const volRatio = (cur.volume || 0) / Math.max(prev.volume || 1, 1);
  const strength = Math.min(1.0, 0.5 + (engulfRatio - 1) * 0.2 + (volRatio > 1.2 ? 0.15 : 0));

  return {
    name: 'bullish_engulfing',
    strength: +strength.toFixed(2),
    confirmed: volRatio > 1.0,
    barsInvolved: 2,
    patternLow: Math.min(prev.low, cur.low),
    patternTarget: cur.close + bodySize(cur),
    invalidation: Math.min(prev.low, cur.low),
  };
}

/**
 * Pin Bar: long wick (≥2.5× body) in one direction, tiny body, rejection from level.
 * Bullish pin bar = long lower wick rejection (like hammer but stricter geometry).
 */
function detectPinBar(bars, idx) {
  if (idx < 20) return null;
  const bar = bars[idx];
  const body = bodySize(bar);
  const lower = lowerWick(bar);
  const upper = upperWick(bar);
  const r = range(bar);

  if (r < 0.001) return null;

  const isBullPin = lower >= body * 2.5 && upper < r * 0.25;
  if (!isBullPin) return null;
  if (body > r * 0.33) return null;

  const ma20 = sma(bars, idx, 20);
  const ma50 = sma(bars, idx, 50);
  const nearSupport = (ma20 && bar.low <= ma20 * 1.01) || (ma50 && bar.low <= ma50 * 1.01);

  const strength = Math.min(1.0, 0.55 + (lower / body - 2.5) * 0.1 + (nearSupport ? 0.15 : 0));

  return {
    name: 'pin_bar',
    strength: +strength.toFixed(2),
    confirmed: isBullish(bar) && nearSupport,
    barsInvolved: 1,
    patternLow: bar.low,
    patternTarget: bar.close + lower * 0.618,
    invalidation: bar.low,
  };
}

// ─── Volume Spike Detection ─────────────────────────────────────────────────

function hasVolumeSpike(bars, idx, threshold = 1.5) {
  const bar = bars[idx];
  if (!bar.volume) return false;
  const avg = avgVolume(bars, idx, 20);
  return avg > 0 && bar.volume >= avg * threshold;
}

// ─── Main Scanner ───────────────────────────────────────────────────────────

/**
 * Scan OHLCV bars for candlestick patterns at the last bar.
 * @param {Array<{date,open,high,low,close,volume}>} bars — sorted ASC by date, min 25 bars
 * @returns {Array<{name, strength, confirmed, volumeSpike, patternLow, patternTarget, invalidation}>}
 */
function scanPatterns(bars) {
  if (!bars || bars.length < 25) return [];
  const idx = bars.length - 1;
  const detectors = [detectHammer, detectBullishEngulfing, detectPinBar];
  const results = [];

  for (const detect of detectors) {
    const pattern = detect(bars, idx);
    if (pattern) {
      pattern.volumeSpike = hasVolumeSpike(bars, idx);
      if (pattern.confirmed && pattern.volumeSpike) {
        pattern.strength = Math.min(1.0, pattern.strength + 0.1);
      }
      results.push(pattern);
    }
  }

  return results.sort((a, b) => b.strength - a.strength);
}

/**
 * Score a ticker based on detected candlestick patterns.
 * Returns 0-100 composite score or 0 if no pattern found.
 */
function scoreCandlestick(patterns, volumeSpike) {
  if (!patterns.length) return 0;
  const best = patterns[0];
  let score = 70;
  score += best.strength * 15;
  if (best.confirmed) score += 5;
  if (volumeSpike) score += 5;
  if (patterns.length > 1) score += 3;
  return Math.min(100, Math.round(score));
}

module.exports = { scanPatterns, scoreCandlestick, detectHammer, detectBullishEngulfing, detectPinBar, hasVolumeSpike };
