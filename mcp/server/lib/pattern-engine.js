/**
 * Pattern Engine — technical pattern scoring on OHLCV bar arrays
 *
 * All functions are pure (no side effects, no I/O).
 * Input: bars[] = [{ time, open, high, low, close, volume, adjClose }]
 *        sorted ascending (oldest first), all floats.
 *
 * Scores are 0-100 integers.
 * Pattern detections return { detected: bool, score: 0-100, ... }
 *
 * Exported:
 *   breakoutScore(bars)         — breakout above consolidation range
 *   reversalScore(bars)         — bullish reversal from oversold/support
 *   squeezeScore(bars)          — Bollinger Band squeeze (coiling)
 *   volAcceleration(bars)       — current volume vs N-bar avg (ratio)
 *   rollingVwap(bars, n)        — N-day rolling VWAP (support/resistance)
 *   detectDoubleTop(bars)       — bearish double-top pattern
 *   detectDoubleBottom(bars)    — bullish double-bottom / W-pattern
 *   detectBreakout(bars)        — confirmed breakout with volume
 *   detectVwapApproach(bars, q) — price approaching VWAP from above/below
 *   enrichBars(bars, quote)     — full enrichment object (all scores + patterns)
 */

// ─── Internal helpers ─────────────────────────────────────────────────────────

function ema(closes, period) {
  if (!closes || closes.length < period) return null;
  const k = 2 / (period + 1);
  let v = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) v = closes[i] * k + v * (1 - k);
  return +v.toFixed(4);
}

function sma(arr, period) {
  if (!arr || arr.length < period) return null;
  const sl = arr.slice(-period);
  return sl.reduce((a, b) => a + b, 0) / period;
}

function stddev(arr) {
  if (!arr || arr.length < 2) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

function rsi(closes, period = 14) {
  if (!closes || closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  let avgG = gains / period, avgL = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgG = (avgG * (period - 1) + Math.max(d, 0)) / period;
    avgL = (avgL * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (avgL === 0) return 100;
  return +(100 - 100 / (1 + avgG / avgL)).toFixed(2);
}

function atr(bars, period = 14) {
  if (!bars || bars.length < period + 1) return null;
  const trs = bars.slice(1).map((b, i) => {
    const prev = bars[i].close;
    return Math.max(b.high - b.low, Math.abs(b.high - prev), Math.abs(b.low - prev));
  });
  let a = trs.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < trs.length; i++) a = (a * (period - 1) + trs[i]) / period;
  return +a.toFixed(4);
}

function clamp(v, lo = 0, hi = 100) {
  return Math.round(Math.min(hi, Math.max(lo, v)));
}

// ─── Local extrema helpers ─────────────────────────────────────────────────────

/**
 * Find local peaks (high > neighbors on both sides over `window` bars).
 * Returns indices in the bar array.
 */
function localPeaks(bars, window = 3) {
  const peaks = [];
  for (let i = window; i < bars.length - window; i++) {
    const h = bars[i].high;
    const isMax = bars.slice(i - window, i).every(b => b.high <= h)
               && bars.slice(i + 1, i + window + 1).every(b => b.high <= h);
    if (isMax) peaks.push(i);
  }
  return peaks;
}

/**
 * Find local troughs (low < neighbors on both sides over `window` bars).
 */
function localTroughs(bars, window = 3) {
  const troughs = [];
  for (let i = window; i < bars.length - window; i++) {
    const l = bars[i].low;
    const isMin = bars.slice(i - window, i).every(b => b.low >= l)
               && bars.slice(i + 1, i + window + 1).every(b => b.low >= l);
    if (isMin) troughs.push(i);
  }
  return troughs;
}

// ─── BREAKOUT SCORE ───────────────────────────────────────────────────────────

/**
 * Measures how convincingly price is breaking above recent consolidation.
 * High score = price near/above 20-bar high with volume confirmation.
 *
 * Components:
 *   40pts — proximity to 20-bar range high (0 = at low, 40 = at/above high)
 *   25pts — volume confirmation (current > 1.5x 10-bar avg vol)
 *   20pts — 5-day momentum (>2% move = full score)
 *   15pts — close above EMA20
 */
export function breakoutScore(bars, lookback = 20) {
  if (!bars || bars.length < lookback + 2) return null;

  const current = bars[bars.length - 1];
  const history = bars.slice(-lookback - 1, -1);

  const rangeHigh = Math.max(...history.map(b => b.high));
  const rangeLow  = Math.min(...history.map(b => b.low));
  const range     = rangeHigh - rangeLow;

  // 1. Proximity to range high (40pts)
  const proximity = range > 0
    ? Math.max(0, 1 - Math.max(0, rangeHigh - current.close) / range)
    : 0;

  // 2. Volume confirmation (25pts)
  const avgVol = history.slice(-10).reduce((s, b) => s + (b.volume || 0), 0) / 10;
  const volRatio = avgVol > 0 ? (current.volume || 0) / avgVol : 0;
  const volScore = Math.min(volRatio / 2, 1);  // 2x avg = full score

  // 3. 5-day momentum (20pts)
  const base5 = bars.length >= 6 ? bars[bars.length - 6].close : current.close;
  const mom5  = base5 > 0 ? (current.close - base5) / base5 : 0;
  const momScore = Math.min(Math.max(mom5 / 0.05, 0), 1);  // 5% = full

  // 4. Above EMA20 (15pts)
  const ema20    = ema(history.map(b => b.close), Math.min(20, history.length));
  const aboveEma = ema20 && current.close > ema20 ? 1 : 0;

  return clamp(proximity * 40 + volScore * 25 + momScore * 20 + aboveEma * 15);
}

// ─── REVERSAL SCORE ───────────────────────────────────────────────────────────

/**
 * Bullish reversal probability from oversold / key support.
 *
 * Components:
 *   30pts — RSI level (< 25 = 30, < 35 = 20, < 45 = 8)
 *   25pts — Hammer / bullish candle pattern
 *   25pts — Proximity to 52-week (or available history) low
 *   20pts — RSI bullish divergence (price lower low, RSI higher low)
 */
export function reversalScore(bars) {
  if (!bars || bars.length < 17) return null;

  const current = bars[bars.length - 1];
  let score = 0;

  // 1. RSI (30pts)
  const rsiVal = rsi(bars.slice(-16).map(b => b.close));
  if (rsiVal !== null) {
    if (rsiVal < 25)      score += 30;
    else if (rsiVal < 35) score += 20;
    else if (rsiVal < 45) score += 8;
  }

  // 2. Hammer / bullish engulfing (25pts)
  const body        = Math.abs(current.close - current.open);
  const lowerShadow = Math.min(current.open, current.close) - current.low;
  const totalRange  = current.high - current.low;
  const bodyMid     = (current.open + current.close) / 2;

  const isHammer = totalRange > 0
    && lowerShadow >= body * 2
    && bodyMid > current.low + totalRange * 0.5;

  if (isHammer) score += 15;

  // Bullish engulfing (vs previous bar)
  if (bars.length >= 2) {
    const prev = bars[bars.length - 2];
    const prevWasBearish = prev.close < prev.open;
    const currIsBullish  = current.close > current.open;
    const engulfs = current.open < prev.close && current.close > prev.open;
    if (prevWasBearish && currIsBullish && engulfs) score += 10;
  }

  // 3. Near historical low (25pts) — use min 252 bars if available
  const histLow = Math.min(...bars.slice(-Math.min(bars.length, 252)).map(b => b.low));
  const distLow = histLow > 0 ? (current.close - histLow) / histLow : 1;
  if (distLow < 0.03)      score += 25;
  else if (distLow < 0.08) score += 15;
  else if (distLow < 0.15) score += 5;

  // 4. RSI divergence (20pts): price lower low vs 10 bars ago, RSI higher low
  if (bars.length >= 12) {
    const lag    = bars[bars.length - 11];
    const rsiOld = rsi(bars.slice(-27, -11).map(b => b.close));
    if (rsiOld !== null && rsiVal !== null
        && current.close < lag.close   // price lower low
        && rsiVal > rsiOld) {          // RSI higher low → divergence
      score += 20;
    }
  }

  return clamp(score);
}

// ─── SQUEEZE SCORE ────────────────────────────────────────────────────────────

/**
 * Bollinger Band squeeze — measures price coiling / low volatility compression.
 * Based on the Squeeze Momentum Indicator (LazyBear).
 *
 * Components:
 *   40pts — BB width < KC width (squeeze is ON)
 *   40pts — tightness: current BB width vs 50-bar historical avg BB width
 *   20pts — volume declining into the squeeze (consolidation confirmation)
 */
export function squeezeScore(bars, period = 20) {
  if (!bars || bars.length < period + 5) return null;

  const recent = bars.slice(-period);
  const closes = recent.map(b => b.close);

  // Bollinger Bands (2σ)
  const midBB  = sma(closes, period);
  const sigBB  = stddev(closes);
  const bbW    = midBB > 0 ? (4 * sigBB) / midBB : 0;  // (upper - lower) / mid

  // Keltner Channel (1.5 × ATR) as volatility baseline
  const atrVal = atr(recent);
  const kcW    = (midBB && atrVal) ? (atrVal * 1.5 * 2) / midBB : bbW * 1.5;

  // Squeeze active = BB inside KC
  const squeezeOn = bbW < kcW;

  // Historical avg BB width over last 50 bars (for relative tightness)
  let avgBBW = bbW;
  if (bars.length >= 50) {
    const bwSamples = [];
    for (let i = period; i <= bars.length; i++) {
      const sl = bars.slice(i - period, i).map(b => b.close);
      const m  = sma(sl, period);
      const s  = stddev(sl);
      if (m) bwSamples.push((4 * s) / m);
    }
    if (bwSamples.length) avgBBW = bwSamples.reduce((a, b) => a + b, 0) / bwSamples.length;
  }
  const tightness = avgBBW > 0 ? Math.max(0, 1 - bbW / avgBBW) : 0;

  // Volume declining into squeeze
  const vol5  = recent.slice(-5).reduce((s, b)  => s + (b.volume || 0), 0) / 5;
  const vol15 = recent.slice(0, 15).reduce((s, b) => s + (b.volume || 0), 0) / 15;
  const volDecl = vol15 > 0 && vol5 < vol15 * 0.85 ? 1 : 0;

  return clamp((squeezeOn ? 40 : 0) + tightness * 40 + volDecl * 20);
}

// ─── VOLUME ACCELERATION ──────────────────────────────────────────────────────

/**
 * Volume acceleration: ratio of current bar volume to N-bar average.
 * 1.0 = normal, 2.0 = double, etc.
 */
export function volAcceleration(bars, period = 20) {
  if (!bars || bars.length < 2) return null;
  const current = bars[bars.length - 1];
  const history = bars.slice(-period - 1, -1);
  if (!history.length) return 1;
  const avg = history.reduce((s, b) => s + (b.volume || 0), 0) / history.length;
  return avg > 0 ? +((current.volume || 0) / avg).toFixed(2) : null;
}

// ─── ROLLING VWAP ─────────────────────────────────────────────────────────────

/**
 * N-day rolling VWAP — weighted average of typical prices over last n bars.
 * Useful as dynamic support/resistance.
 * typical_price = (high + low + close) / 3
 */
export function rollingVwap(bars, n = 10) {
  if (!bars || bars.length < 1) return null;
  const slice = bars.slice(-n);
  let tv = 0, v = 0;
  for (const b of slice) {
    const vol = b.volume || 0;
    const tp  = (b.high + b.low + b.close) / 3;
    tv += tp * vol;
    v  += vol;
  }
  return v > 0 ? +(tv / v).toFixed(4) : slice[slice.length - 1].close;
}

// ─── DOUBLE TOP ───────────────────────────────────────────────────────────────

/**
 * Bearish double-top detection.
 * Looks for two peaks within 2% of each other with a valley ≥ 3% between.
 *
 * Returns { detected, score, leftPeak, rightPeak, valley, neckline }
 */
export function detectDoubleTop(bars, lookback = 60) {
  if (!bars || bars.length < 20) return { detected: false, score: 0 };

  const recent = bars.slice(-lookback);
  const peaks  = localPeaks(recent, 3);
  if (peaks.length < 2) return { detected: false, score: 0 };

  const last2 = peaks.slice(-2);
  const [i1, i2] = last2;
  const p1 = recent[i1].high;
  const p2 = recent[i2].high;

  // Peaks within 2% of each other
  const peakDiff = Math.abs(p1 - p2) / Math.max(p1, p2);
  if (peakDiff > 0.02) return { detected: false, score: 0 };

  // Valley between the peaks
  const between = recent.slice(i1, i2);
  const valley  = Math.min(...between.map(b => b.low));
  const topLevel = (p1 + p2) / 2;
  const valleyDrop = (topLevel - valley) / topLevel;

  if (valleyDrop < 0.03) return { detected: false, score: 0 };

  // Volume: second peak should have lower volume (bearish confirmation)
  const vol1 = recent[i1].volume || 0;
  const vol2 = recent[i2].volume || 0;
  const volConfirm = vol1 > 0 && vol2 < vol1;

  // Current price: breaking below neckline?
  const neckline    = valley;
  const currentBar  = bars[bars.length - 1];
  const belowNeck   = currentBar.close < neckline;

  const score = clamp(
    30                          // pattern found
    + (valleyDrop > 0.05 ? 20 : 10)   // valley depth
    + (peakDiff < 0.01 ? 20 : 10)     // peak symmetry
    + (volConfirm ? 20 : 0)            // volume confirmation
    + (belowNeck ? 10 : 0)             // neckline broken
  );

  return {
    detected:  score >= 50,
    score,
    leftPeak:  p1,
    rightPeak: p2,
    valley,
    neckline,
    belowNeckline: belowNeck,
  };
}

// ─── DOUBLE BOTTOM ────────────────────────────────────────────────────────────

/**
 * Bullish double-bottom (W-pattern) detection.
 * Two troughs within 2% of each other with a peak ≥ 3% between.
 *
 * Returns { detected, score, leftTrough, rightTrough, peak, neckline }
 */
export function detectDoubleBottom(bars, lookback = 60) {
  if (!bars || bars.length < 20) return { detected: false, score: 0 };

  const recent   = bars.slice(-lookback);
  const troughs  = localTroughs(recent, 3);
  if (troughs.length < 2) return { detected: false, score: 0 };

  const last2 = troughs.slice(-2);
  const [i1, i2] = last2;
  const t1 = recent[i1].low;
  const t2 = recent[i2].low;

  const troughDiff = Math.abs(t1 - t2) / Math.min(t1, t2);
  if (troughDiff > 0.02) return { detected: false, score: 0 };

  const between   = recent.slice(i1, i2);
  const peak      = Math.max(...between.map(b => b.high));
  const botLevel  = (t1 + t2) / 2;
  const peakRise  = (peak - botLevel) / botLevel;

  if (peakRise < 0.03) return { detected: false, score: 0 };

  // RSI divergence: price similar lows, RSI higher low → bullish
  const rsi1 = rsi(bars.slice(Math.max(0, bars.length - lookback + i1 - 15), bars.length - lookback + i1 + 1).map(b => b.close));
  const rsi2 = rsi(bars.slice(Math.max(0, bars.length - lookback + i2 - 15), bars.length - lookback + i2 + 1).map(b => b.close));
  const rsiDiv = rsi1 !== null && rsi2 !== null && t2 <= t1 && rsi2 > rsi1;

  const currentBar = bars[bars.length - 1];
  const neckline   = peak;
  const aboveNeck  = currentBar.close > neckline;

  const score = clamp(
    30
    + (peakRise > 0.05 ? 20 : 10)
    + (troughDiff < 0.01 ? 20 : 10)
    + (rsiDiv ? 20 : 0)
    + (aboveNeck ? 10 : 0)
  );

  return {
    detected:       score >= 50,
    score,
    leftTrough:     t1,
    rightTrough:    t2,
    peak,
    neckline,
    aboveNeckline:  aboveNeck,
    rsiDivergence:  rsiDiv,
  };
}

// ─── BREAKOUT DETECTION ───────────────────────────────────────────────────────

/**
 * Confirmed breakout: price closing above N-bar resistance with volume surge.
 * Returns { detected, score, level, volumeRatio, daysAbove }
 */
export function detectBreakout(bars, lookback = 20, volMultiple = 1.5) {
  if (!bars || bars.length < lookback + 2) return { detected: false, score: 0 };

  const history = bars.slice(-lookback - 1, -1);
  const current = bars[bars.length - 1];

  const resistance = Math.max(...history.map(b => b.high));
  const avgVol     = history.reduce((s, b) => s + (b.volume || 0), 0) / history.length;
  const volRatio   = avgVol > 0 ? (current.volume || 0) / avgVol : 0;

  const closedAbove = current.close > resistance;
  const volSurge    = volRatio >= volMultiple;

  // How many bars have closed above resistance?
  let daysAbove = 0;
  for (let i = bars.length - 1; i >= 0 && bars[i].close > resistance; i--) daysAbove++;

  const score = clamp(
    (closedAbove ? 40 : 0)
    + Math.min(volRatio / volMultiple, 1) * 30
    + (daysAbove >= 2 ? 20 : daysAbove >= 1 ? 10 : 0)
    + (current.close > current.open ? 10 : 0)  // bullish close
  );

  return {
    detected:   closedAbove && volSurge,
    score,
    level:      resistance,
    volumeRatio: +volRatio.toFixed(2),
    daysAbove,
    closedAbove,
    volumeSurge: volSurge,
  };
}

// ─── VWAP APPROACH ────────────────────────────────────────────────────────────

/**
 * Returns VWAP proximity info for use in alerts.
 * dist_vwap > 0 = price above VWAP, < 0 = below.
 */
export function detectVwapApproach(bars, currentPrice, n = 10) {
  const vwap   = rollingVwap(bars, n);
  if (!vwap || !currentPrice) return { vwap: null, distVwap: null };
  const distVwap = +((currentPrice - vwap) / vwap * 100).toFixed(3);
  return { vwap, distVwap };
}

// ─── FULL ENRICHMENT ─────────────────────────────────────────────────────────

/**
 * Compute all pattern scores and signals for a symbol.
 *
 * @param {Array} bars  OHLCV bars, ascending
 * @param {object} quote  Current quote (optional — for VWAP dist calc)
 * @returns {object} enrichment object — merged into quote before alert eval
 */
export function enrichBars(bars, quote = {}) {
  if (!bars || bars.length < 5) return {};

  const currentPrice = quote.price || (bars[bars.length - 1]?.close) || 0;

  const bs = breakoutScore(bars);
  const rs = reversalScore(bars);
  const ss = squeezeScore(bars);
  const va = volAcceleration(bars);
  const { vwap, distVwap } = detectVwapApproach(bars, currentPrice);
  const dTop    = detectDoubleTop(bars);
  const dBot    = detectDoubleBottom(bars);
  const brk     = detectBreakout(bars);

  // ATR as % of price (for DSL field atr_pct)
  const atrVal = atr(bars);
  const atrPct = (atrVal && currentPrice) ? +(atrVal / currentPrice * 100).toFixed(3) : null;

  // RSI
  const rsiVal = rsi(bars.slice(-16).map(b => b.close));

  // Aggregate pattern list (for notifications)
  const patterns = [];
  if (brk.detected)   patterns.push('breakout');
  if (dTop.detected)  patterns.push('double_top');
  if (dBot.detected)  patterns.push('double_bottom');
  if (ss >= 65)       patterns.push('squeeze');
  if (rs >= 60)       patterns.push('reversal');

  return {
    // DSL fields
    breakoutScore:  bs,
    reversalScore:  rs,
    squeezeScore:   ss,
    volAccel:       va,
    vwap,
    distVwap,
    atrPct,
    rsi14:          rsiVal,  // overrides quote rsi14 with bars-computed value

    // Pattern detail (for notifications + test_alert_dsl)
    patterns,
    breakoutDetail:     brk,
    doubleTopDetail:    dTop,
    doubleBottomDetail: dBot,
    enrichedAt:         new Date().toISOString(),
  };
}
