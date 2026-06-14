'use strict';

/**
 * forex-indicators.js — faithful port of systematic-tss indicators used by
 * scanner_forex.go.
 *
 * Ports (file: internal/engine/indicators.go unless noted):
 *   - calcSMA    (indicators.go:17-27)
 *   - calcRSI    (indicators.go:30-49)
 *   - calcATR    (indicators.go:52-67)
 *   - calcBBPctB (indicators.go:295-323)  Bollinger Band %B — mean-reversion axis
 *   - calcReturn (calculateReturn, scanner_crypto_momentum.go:215-226 — same
 *                 helper used by scanner_forex.go via calculateReturn)
 *
 * All functions take the FULL bar array plus a `period` and operate on the last
 * `period` bars (tail-relative), mirroring the Go signatures exactly. Bars are
 * { date, open, high, low, close, volume }.
 */

// calcSMA — Simple Moving Average over the last `period` closes.
// Port of calcSMA, indicators.go:17-27.
function calcSMA(bars, period) {
  const n = bars.length;
  if (n < period) return 0;
  let sum = 0;
  for (let i = n - period; i < n; i++) sum += bars[i].close;
  return sum / period;
}

// calcRSI — Relative Strength Index over the last `period` bars.
// Port of calcRSI, indicators.go:30-49.
function calcRSI(bars, period = 14) {
  const n = bars.length;
  if (n < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = n - period; i < n; i++) {
    const change = bars[i].close - bars[i - 1].close;
    if (change > 0) gains += change;
    else losses -= change;
  }
  if (losses === 0) return 100;
  const rs = (gains / period) / (losses / period);
  return 100.0 - (100.0 / (1.0 + rs));
}

// calcATR — Average True Range over the last `period` bars.
// Port of calcATR, indicators.go:52-67.
function calcATR(bars, period = 14) {
  const n = bars.length;
  if (n < period + 1) return 0;
  let sum = 0;
  for (let i = n - period; i < n; i++) {
    let tr = bars[i].high - bars[i].low;
    if (i > 0) {
      tr = Math.max(tr, Math.abs(bars[i].high - bars[i - 1].close));
      tr = Math.max(tr, Math.abs(bars[i].low - bars[i - 1].close));
    }
    sum += tr;
  }
  return sum / period;
}

// calcReturn — percentage return over N days (close[-1] vs close[-N-1]).
// Port of calculateReturn (scanner_forex.go calls calculateReturn,
// scanner_crypto_momentum.go:215-226).
function calcReturn(bars, days) {
  const n = bars.length;
  if (n < days + 1) return 0;
  const oldPrice = bars[n - days - 1].close;
  const newPrice = bars[n - 1].close;
  if (oldPrice <= 0) return 0;
  return ((newPrice - oldPrice) / oldPrice) * 100.0;
}

// calcBBPctB — Bollinger Band %B over the last `period` bars.
// Port of calcBBPctB, indicators.go:295-323.
//   sma = mean(close); std = sqrt(sum((close-sma)^2)/period)  (population std)
//   upper = sma + std*mult ; lower = sma - std*mult
//   %B = (price - lower) / (upper - lower)
// Returns 0.5 when insufficient bars or flat bands (indicators.go:296-298,319-321).
function calcBBPctB(bars, period = 20, stdDevMult = 2.0) {
  const n = bars.length;
  if (n < period) return 0.5;

  const price = bars[n - 1].close;

  let sum = 0;
  for (let i = n - period; i < n; i++) sum += bars[i].close;
  const sma = sum / period;

  let varSum = 0;
  for (let i = n - period; i < n; i++) {
    const diff = bars[i].close - sma;
    varSum += diff * diff;
  }
  const std = Math.sqrt(varSum / period);

  const upperBand = sma + std * stdDevMult;
  const lowerBand = sma - std * stdDevMult;

  if (upperBand === lowerBand) return 0.5;
  return (price - lowerBand) / (upperBand - lowerBand);
}

module.exports = { calcSMA, calcRSI, calcATR, calcReturn, calcBBPctB };
