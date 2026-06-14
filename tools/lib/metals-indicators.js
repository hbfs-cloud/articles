'use strict';

/**
 * metals-indicators.js — faithful port of systematic-tss indicators used by
 * scanner_metals.go.
 *
 * Metals ETFs/miners trade on the EQUITY business-day calendar (no 24/7), but
 * the indicator math is calendar-agnostic — these are near-identical to
 * crypto-indicators.js. Re-ported here so the metals scanner is self-contained.
 *
 * Ports (file: internal/engine/indicators.go):
 *   - calcSMA                     (indicators.go:17-27)
 *   - calcRSI                     (indicators.go:30-49)
 *   - calcATR                     (indicators.go:52-67)
 *   - calcDollarVolumePercentile  (indicators.go:217-233)  → calcDollarVolumePercentile
 * And the momentum helpers used by scanner_metals.go:
 *   - calculateReturn             (scanner_metals.go:172-174 calls; impl shared)
 *   - volume ratio block          (scanner_metals.go:176-187)  → volRatio
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
// Port of calculateReturn (shared helper, called by scanner_metals.go:172-174).
function calcReturn(bars, days) {
  const n = bars.length;
  if (n < days + 1) return 0;
  const oldPrice = bars[n - days - 1].close;
  const newPrice = bars[n - 1].close;
  if (oldPrice <= 0) return 0;
  return ((newPrice - oldPrice) / oldPrice) * 100.0;
}

// volRatio — current volume vs trailing `period`-day average volume.
// Port of the volume-ratio block, scanner_metals.go:176-187
// (default period 30 to match the Go 30-day average).
function volRatio(bars, period = 30) {
  const n = bars.length;
  const volume = bars[n - 1].volume;
  let avgVol = 0;
  if (n >= period) {
    for (let i = n - period; i < n; i++) avgVol += bars[i].volume;
    avgVol /= period;
  }
  if (avgVol > 0) return volume / avgVol;
  return 1.0;
}

// calcDollarVolumePercentile — `percentile` of daily dollar volume (close*volume)
// over the last `period` bars. Robust liquidity filter (resists single-day spikes).
// Port of calcDollarVolumePercentile, indicators.go:217-233.
function calcDollarVolumePercentile(bars, period = 20, percentile = 0.80) {
  const n = bars.length;
  if (n < period) return 0;
  const dolVols = new Array(period);
  for (let i = 0; i < period; i++) {
    const b = bars[n - period + i];
    dolVols[i] = b.close * (b.volume || 0);
  }
  dolVols.sort((a, b) => a - b);
  let idx = Math.floor(period * percentile);
  if (idx >= period) idx = period - 1;
  return dolVols[idx];
}

module.exports = { calcSMA, calcRSI, calcATR, calcReturn, volRatio, calcDollarVolumePercentile };
