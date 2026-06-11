'use strict';

/**
 * Candlestick pattern detection — faithful port of systematic-tss scanner_americanbulls.go.
 *
 * 25 bullish patterns with adaptive body sizing (10-bar rolling average).
 * Scoring: pattern base + ATR% + momentum5d + distMA20 + RSI14 + BB%B + regime.
 * Volume spike: today / avg(20d), threshold 8× for filter, scored at 1.4× and 2.0×.
 */

// ─── Bar helpers ────────────────────────────────────────────────────────────

function bodySize(bar) { return Math.abs(bar.close - bar.open); }
function isBullish(bar) { return bar.close >= bar.open; }
function isBearish(bar) { return bar.close < bar.open; }
function barRange(bar) { return bar.high - bar.low; }

function shadows(bar) {
  if (isBullish(bar)) {
    return { lower: bar.open - bar.low, upper: bar.high - bar.close };
  }
  return { lower: bar.close - bar.low, upper: bar.high - bar.open };
}

// ─── Adaptive body sizing (rolling 10-bar average, mirrors TA-Lib CDL) ─────

function avgBodySize(bars, idx, n = 10) {
  const end = idx;
  const start = Math.max(0, end - n);
  if (start >= end) return 0;
  let sum = 0;
  for (let i = start; i < end; i++) sum += bodySize(bars[i]);
  return sum / (end - start);
}

// ─── Technical indicators ───────────────────────────────────────────────────

function calcATR(bars, idx, period = 14) {
  if (idx < period + 1) return 0;
  let sum = 0;
  for (let i = idx - period; i < idx; i++) {
    const prev = bars[i - 1], cur = bars[i];
    sum += Math.max(cur.high - cur.low, Math.abs(cur.high - prev.close), Math.abs(cur.low - prev.close));
  }
  return sum / period;
}

function calcSMA(bars, idx, period) {
  if (idx < period) return 0;
  let sum = 0;
  for (let i = idx - period; i < idx; i++) sum += bars[i].close;
  return sum / period;
}

function calcRSI(bars, idx, period = 14) {
  if (idx < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = idx - period; i < idx; i++) {
    const diff = bars[i].close - bars[i - 1].close;
    if (diff > 0) gains += diff; else losses -= diff;
  }
  const avgGain = gains / period, avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function calcBBPctB(bars, idx, period = 20, mult = 2.0) {
  if (idx < period) return 0.5;
  const sma = calcSMA(bars, idx, period);
  let sumSq = 0;
  for (let i = idx - period; i < idx; i++) {
    const d = bars[i].close - sma;
    sumSq += d * d;
  }
  const stdDev = Math.sqrt(sumSq / period);
  const upper = sma + mult * stdDev;
  const lower = sma - mult * stdDev;
  if (upper === lower) return 0.5;
  return (bars[idx].close - lower) / (upper - lower);
}

function volRatio(bars, idx, n = 20) {
  if (idx < n + 1) return 1.0;
  const today = bars[idx].volume || 0;
  if (today <= 0) return 1.0;
  let sum = 0;
  for (let i = idx - n; i < idx; i++) sum += (bars[i].volume || 0);
  const avg = sum / n;
  return avg > 0 ? today / avg : 1.0;
}

// ─── Pattern Matcher (exact port of matchPattern from Go) ───────────────────

function matchPattern(c0, c1, c2, atr, avgBody) {
  const body0 = bodySize(c0), body1 = bodySize(c1), body2 = bodySize(c2);
  const range0 = barRange(c0);
  const bull0 = isBullish(c0), bull1 = isBullish(c1), bull2 = isBullish(c2);
  const bear1 = !bull1, bear2 = !bull2;
  const s0 = shadows(c0);

  const smallBody = 0.5 * avgBody;
  const largeBody = 1.5 * avgBody;
  const dojiThresh = 0.1 * avgBody;
  const stop01 = Math.min(c0.low, c1.low);

  // THREE_WHITE_SOLDIERS (80)
  if (bull0 && bull1 && bull2 && body0 > avgBody && body1 > avgBody && body2 > avgBody) {
    const openedIn10 = c0.open > c1.open && c0.open <= c1.close;
    const openedIn21 = c1.open > c2.open && c1.open <= c2.close;
    const smallUpper0 = s0.upper <= body0 * 0.3;
    const smallUpper1 = (c1.high - c1.close) <= body1 * 0.3;
    if (openedIn10 && openedIn21 && smallUpper0 && smallUpper1) return { name: 'THREE_WHITE_SOLDIERS', score: 80, stop: stop01 };
  }

  // ABANDONED_BABY_BULLISH (78)
  if (bear2 && bull0 && body2 > largeBody && body0 > largeBody) {
    const isDoji1 = body1 <= dojiThresh || (barRange(c1) > 0 && body1 <= barRange(c1) * 0.05);
    if (isDoji1 && c1.high < c2.low && c0.low > c1.high) return { name: 'ABANDONED_BABY_BULLISH', score: 78, stop: stop01 };
  }

  // MORNING_DOJI_STAR (75)
  if (bear2 && bull0 && body2 > avgBody && body0 > smallBody) {
    const isDoji1 = body1 <= dojiThresh || (barRange(c1) > 0 && body1 <= barRange(c1) * 0.05);
    if (isDoji1 && c0.close > c2.close + body2 * 0.1) return { name: 'MORNING_DOJI_STAR', score: 75, stop: stop01 };
  }

  // MORNING_STAR (72)
  if (bear2 && bull0 && body2 > avgBody && body0 > smallBody) {
    const starHigh = Math.max(c1.open, c1.close);
    if (starHigh <= c2.close * 1.005 && body1 < body2 && c0.close > c2.close + body2 * 0.1)
      return { name: 'MORNING_STAR', score: 72, stop: stop01 };
  }

  // THREE_OUTSIDE_UP (70)
  if (bear2 && bull1 && bull0) {
    const engulfs = c1.open <= c2.close * 1.005 && c1.close >= c2.open * 0.995 && body1 > body2 * 0.8;
    const gapUp = c1.open > c2.close && c1.close >= c2.open * 0.995 && body1 > body2 * 0.8;
    if ((engulfs || gapUp) && c0.close > c1.close) return { name: 'THREE_OUTSIDE_UP', score: 70, stop: stop01 };
  }

  // BULLISH_ENGULFING (68)
  if (bull0 && bear1 && body1 > dojiThresh) {
    if (c0.open <= c1.close * 1.005 && c0.close >= c1.open * 0.995 && body0 > body1 * 0.8)
      return { name: 'BULLISH_ENGULFING', score: 68, stop: stop01 };
  }

  // BULLISH_STRONG_REVERSAL (68)
  if (bull0 && bear1 && body1 > dojiThresh) {
    if (c0.close >= c1.open * 0.995 && body0 > dojiThresh && c0.open > c1.close)
      return { name: 'BULLISH_STRONG_REVERSAL', score: 68, stop: stop01 };
  }

  // THREE_INSIDE_UP (65)
  if (bear2 && bull1 && bull0 && body2 > avgBody) {
    const harami = c1.open >= c2.close * 0.999 && c1.close <= c2.open * 1.001 && body1 < body2 * 0.75;
    if (harami && c0.close >= c2.open * 0.999) return { name: 'THREE_INSIDE_UP', score: 65, stop: stop01 };
  }

  // RISING_THREE_METHODS (65)
  if (bull2 && bull0 && body2 > largeBody && body0 > largeBody) {
    const smallPullback = bear1 && body1 <= smallBody;
    const insideC2 = c1.high <= c2.close && c1.low >= c2.open;
    if (smallPullback && insideC2 && c0.close > c2.close) return { name: 'RISING_THREE_METHODS', score: 65, stop: stop01 };
  }

  // BULLISH_KICKER (65)
  if (bear1 && bull0 && body1 > avgBody && body0 > avgBody) {
    if (c0.open >= c1.open * 0.999) return { name: 'BULLISH_KICKER', score: 65, stop: stop01 };
  }

  // THREE_BULLISH_CONTINUATION (62)
  if (bull0 && bull1 && bull2) {
    const ascending = c0.close > c1.close && c1.close > c2.close;
    const atLeast1 = body0 > smallBody || body1 > smallBody || body2 > smallBody;
    if (ascending && atLeast1) return { name: 'THREE_BULLISH_CONTINUATION', score: 62, stop: stop01 };
  }

  // PIERCING_PATTERN (62)
  if (bull0 && bear1 && body1 > avgBody) {
    const mid1 = (c1.open + c1.close) / 2;
    if (c0.open < c1.close && c0.close > mid1 && c0.close < c1.open)
      return { name: 'PIERCING_PATTERN', score: 62, stop: stop01 };
  }

  // MEETING_LINES_BULLISH (62)
  if (bull0 && bear1 && body0 > avgBody && body1 > avgBody) {
    if (Math.abs(c0.close - c1.close) <= c1.close * 0.002)
      return { name: 'MEETING_LINES_BULLISH', score: 62, stop: stop01 };
  }

  // WHITE_MARUBOZU (60)
  if (bull0 && body0 > largeBody) {
    if (s0.upper <= body0 * 0.05 && s0.lower <= body0 * 0.05)
      return { name: 'WHITE_MARUBOZU', score: 60, stop: c0.low };
  }

  // HOMING_PIGEON (58)
  if (!bull0 && bear1 && body1 > largeBody) {
    const contained = c0.open <= c1.open * 1.001 && c0.close >= c1.close * 0.999 && body0 < body1 * 0.7;
    if (contained) return { name: 'HOMING_PIGEON', score: 58, stop: stop01 };
  }

  // COUNTERATTACK_BULLISH (58)
  if (bull0 && bear1 && body0 > avgBody && body1 > avgBody) {
    if (c0.open < c1.close * 0.99 && Math.abs(c0.close - c1.close) <= c1.close * 0.003)
      return { name: 'COUNTERATTACK_BULLISH', score: 58, stop: stop01 };
  }

  // BULLISH_DOJI_STAR (58)
  if (bear1 && body1 > largeBody) {
    const isDoji0 = body0 <= dojiThresh || (range0 > 0 && body0 <= range0 * 0.05);
    if (isDoji0) return { name: 'BULLISH_DOJI_STAR', score: 58, stop: stop01 };
  }

  // BULLISH_HARAMI_CROSS (55)
  if (bear1 && body1 > largeBody) {
    const isDoji0 = body0 <= dojiThresh || (range0 > 0 && body0 <= range0 * 0.05);
    const contained = Math.max(c0.open, c0.close) < c1.open * 1.001 && Math.min(c0.open, c0.close) > c1.close * 0.999;
    if (isDoji0 && contained) return { name: 'BULLISH_HARAMI_CROSS', score: 55, stop: stop01 };
  }

  // BULLISH_HARAMI (52)
  if (bull0 && bear1 && body1 > avgBody) {
    const contained = c0.open >= c1.close * 0.999 && c0.close <= c1.open * 1.001;
    if (contained && body0 <= body1 * 0.6) return { name: 'BULLISH_HARAMI', score: 52, stop: stop01 };
  }

  // TWEEZER_BOTTOM (52)
  if (bull0 && bear1) {
    if (Math.abs(c0.low - c1.low) <= c1.low * 0.002 && body0 > smallBody && body1 > smallBody)
      return { name: 'TWEEZER_BOTTOM', score: 52, stop: c0.low };
  }

  // HAMMER (52)
  if (range0 > 0 && body0 > 0 && body0 <= smallBody) {
    if (s0.lower >= 2.0 * body0 && s0.upper <= body0 && body0 <= range0 * 0.4)
      return { name: 'HAMMER', score: 52, stop: c0.low };
  }

  // DRAGONFLY_DOJI (50)
  if (range0 > 0) {
    const isDoji0 = body0 <= dojiThresh || body0 <= range0 * 0.05;
    if (isDoji0 && s0.lower >= range0 * 0.6 && s0.upper <= range0 * 0.15)
      return { name: 'DRAGONFLY_DOJI', score: 50, stop: c0.low };
  }

  // LONG_LEGGED_DOJI (first check)
  if (range0 > 0) {
    const isDoji0 = body0 <= dojiThresh || body0 <= range0 * 0.05;
    if (isDoji0 && s0.lower >= range0 * 0.3 && s0.upper >= range0 * 0.3)
      return { name: 'BULLISH_SPINNING_TOP', score: 40, stop: c0.low };
  }

  // INVERTED_HAMMER (48)
  if (range0 > 0 && body0 > 0 && body0 <= smallBody && bear1) {
    if (s0.upper >= 2.0 * body0 && s0.lower <= body0 && body0 <= range0 * 0.4)
      return { name: 'INVERTED_HAMMER', score: 48, stop: stop01 };
  }

  // BULLISH_BELT_HOLD (48)
  if (bull0 && body0 > largeBody) {
    if (s0.lower <= body0 * 0.05) return { name: 'BULLISH_BELT_HOLD', score: 48, stop: c0.low };
  }

  // BULLISH_SPINNING_TOP after downtrend (40)
  if (bear1 && range0 > 0 && body0 > 0 && body0 <= smallBody) {
    if (s0.lower >= body0 && s0.upper >= body0)
      return { name: 'BULLISH_SPINNING_TOP', score: 40, stop: stop01 };
  }

  return null;
}

// ─── Bearish patterns (for PM exit signals) ─────────────────────────────────

const BEARISH_EXIT_PATTERNS = [
  'BEARISH_ENGULFING', 'BEARISH_STRONG_REVERSAL', 'THREE_BLACK_CROWS', 'THREE_OUTSIDE_DOWN',
];

function matchBearishPattern(c0, c1, c2, avgBody) {
  const body0 = bodySize(c0), body1 = bodySize(c1), body2 = bodySize(c2);
  const bull0 = isBullish(c0), bull1 = isBullish(c1), bull2 = isBullish(c2);
  const bear0 = !bull0, bear1 = !bull1, bear2 = !bull2;
  const dojiThresh = 0.1 * avgBody;

  // BEARISH_ENGULFING
  if (bear0 && bull1 && body1 > dojiThresh) {
    if (c0.open >= c1.close * 0.995 && c0.close <= c1.open * 1.005 && body0 > body1 * 0.8)
      return 'BEARISH_ENGULFING';
  }

  // THREE_BLACK_CROWS
  if (bear0 && bear1 && bear2 && body0 > avgBody && body1 > avgBody && body2 > avgBody) {
    const desc = c0.close < c1.close && c1.close < c2.close;
    if (desc) return 'THREE_BLACK_CROWS';
  }

  // THREE_OUTSIDE_DOWN
  if (bull2 && bear1 && bear0) {
    const engulfs = c1.open >= c2.close * 0.995 && c1.close <= c2.open * 1.005 && body1 > body2 * 0.8;
    if (engulfs && c0.close < c1.close) return 'THREE_OUTSIDE_DOWN';
  }

  // BEARISH_STRONG_REVERSAL
  if (bear0 && bull1 && body1 > dojiThresh) {
    if (c0.close <= c1.open * 1.005 && body0 > dojiThresh && c0.open < c1.close)
      return 'BEARISH_STRONG_REVERSAL';
  }

  return null;
}

// ─── Full scoring (exact port of detectPattern scoring from Go) ─────────────

function scoreCandidate(bars, idx, pattern, regime) {
  const c0 = bars[idx];
  let score = pattern.score;

  const atr = calcATR(bars, idx);
  const atrPct = atr / c0.close;
  const vr = volRatio(bars, idx, 20);
  const rsi = calcRSI(bars, idx);
  const bbPctB = calcBBPctB(bars, idx, 20, 2.0);
  const ma20 = calcSMA(bars, idx, 20);
  const ma50 = calcSMA(bars, idx, 50);

  const distMA20 = ma20 > 0 ? (c0.close - ma20) / ma20 : 0;
  const mom5 = idx >= 5 ? (c0.close - bars[idx - 5].close) / bars[idx - 5].close : 0;

  // ATR% scoring
  if (atrPct > 0.09) score += 20;
  else if (atrPct > 0.066) score += 15;
  else if (atrPct > 0.05) score += 10;
  else if (atrPct < 0.035) score -= 10;

  // Volume scoring
  if (vr >= 2.0) score += 15;
  else if (vr >= 1.4) score += 10;

  // Momentum scoring
  if (mom5 >= 0.11) score += 15;
  else if (mom5 <= -0.09) score += 15;
  else if (mom5 >= -0.02 && mom5 <= 0.03) score -= 5;

  // Trend & MA20 distance
  if (distMA20 > 0.085) score += 15;
  else if (distMA20 < -0.077) score += 15;
  else if (distMA20 >= -0.02 && distMA20 <= 0.02) score -= 5;

  if (ma50 > 0 && c0.close > ma50) score += 10;

  // RSI scoring
  if (rsi >= 66) score += 15;
  else if (rsi <= 35) score += 15;
  else if (rsi >= 45 && rsi <= 55) score -= 5;

  // Bollinger %B
  if (bbPctB > 0.8) score += 20;
  else if (bbPctB < 0.2) score += 20;
  else if (bbPctB >= 0.4 && bbPctB <= 0.6) score -= 10;

  // Regime scoring
  if (regime) {
    const r = regime.toLowerCase().replace(/[\s-]+/g, '_');
    if (r === 'risk_on' || r === 'recovery') score += 10;
    else if (r === 'early_risk_off') score -= 5;
    else if (r === 'risk_off') score -= 20;
  }

  return {
    totalScore: Math.max(0, score),
    atr, atrPct, volRatio: vr, rsi, bbPctB, distMA20, mom5,
    ma20, ma50,
  };
}

// ─── Main scanner entry point ───────────────────────────────────────────────

/**
 * Scan bars for candlestick patterns at the last bar.
 * @param {Array} bars — OHLCV sorted ASC, min 60 bars
 * @param {string} [regime] — current market regime
 * @returns {object|null} — { pattern, score, stop, entry, metrics } or null
 */
function detectPattern(bars, regime) {
  if (!bars || bars.length < 60) return null;
  const idx = bars.length - 1;
  const c0 = bars[idx], c1 = bars[idx - 1], c2 = bars[idx - 2];
  if (c0.close <= 0 || c0.high <= c0.low) return null;

  const atr = calcATR(bars, idx);
  if (atr <= 0) return null;

  const ab = avgBodySize(bars, idx, 10);
  const pattern = matchPattern(c0, c1, c2, atr, ab);
  if (!pattern) return null;

  const metrics = scoreCandidate(bars, idx, pattern, regime);

  return {
    pattern: pattern.name,
    baseScore: pattern.score,
    totalScore: metrics.totalScore,
    entry: c0.close,
    stop: pattern.stop,
    atr, ...metrics,
  };
}

/**
 * Detect bearish exit signals on held position.
 * @param {Array} bars — OHLCV sorted ASC, min 60 bars
 * @returns {string|null} — bearish pattern name or null
 */
function detectBearishExit(bars) {
  if (!bars || bars.length < 60) return null;
  const idx = bars.length - 1;
  const ab = avgBodySize(bars, idx, 10);
  return matchBearishPattern(bars[idx], bars[idx - 1], bars[idx - 2], ab);
}

module.exports = {
  detectPattern, detectBearishExit, matchPattern, matchBearishPattern,
  scoreCandidate, calcATR, calcRSI, calcSMA, calcBBPctB, volRatio,
  avgBodySize, BEARISH_EXIT_PATTERNS,
};
