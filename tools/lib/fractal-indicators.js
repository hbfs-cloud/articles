'use strict';
// Exact port of systematic-tss/internal/engine/indicators.go

function calcSMA(bars, period) {
  const n = bars.length;
  if (n < period) return 0;
  let sum = 0;
  for (let i = n - period; i < n; i++) sum += bars[i].close;
  return sum / period;
}

function calcRSI(bars, period) {
  const n = bars.length;
  if (n < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = n - period; i < n; i++) {
    const change = bars[i].close - bars[i - 1].close;
    if (change > 0) gains += change; else losses -= change;
  }
  if (losses === 0) return 100;
  const rs = (gains / period) / (losses / period);
  return 100 - 100 / (1 + rs);
}

function calcATR(bars, period) {
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

function calcVolatility(bars, period) {
  const n = bars.length;
  if (n < period + 1) return 0;
  const returns = [];
  for (let i = n - period; i < n; i++) {
    if (bars[i - 1].close > 0) {
      returns.push((bars[i].close - bars[i - 1].close) / bars[i - 1].close);
    }
  }
  if (!returns.length) return 0;
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance);
}

function calcMomentum(bars, period) {
  const n = bars.length;
  if (n <= period) return 0;
  const prev = bars[n - 1 - period].close;
  if (prev === 0) return 0;
  return (bars[n - 1].close - prev) / prev;
}

function calcAvgVolume(bars, period) {
  const n = bars.length;
  if (n < period) return 0;
  let sum = 0;
  for (let i = n - period; i < n; i++) sum += (bars[i].volume || 0);
  return sum / period;
}

function calcMedianVolume(bars, period) {
  const n = bars.length;
  if (n < period) return 0;
  const vols = [];
  for (let i = n - period; i < n; i++) vols.push(bars[i].volume || 0);
  vols.sort((a, b) => a - b);
  if (period % 2 === 0) return (vols[period / 2 - 1] + vols[period / 2]) / 2;
  return vols[Math.floor(period / 2)];
}

function calcDollarVolumePercentile(bars, period, percentile) {
  const n = bars.length;
  if (n < period) return 0;
  const dvols = [];
  for (let i = n - period; i < n; i++) {
    dvols.push(bars[i].close * (bars[i].volume || 0));
  }
  dvols.sort((a, b) => a - b);
  const idx = Math.min(Math.floor(period * percentile), period - 1);
  return dvols[idx];
}

function calcStochastic(bars, period) {
  const n = bars.length;
  if (n < period) return [50, 50];
  let high = bars[n - period].high, low = bars[n - period].low;
  for (let i = n - period; i < n; i++) {
    if (bars[i].high > high) high = bars[i].high;
    if (bars[i].low < low) low = bars[i].low;
  }
  if (high === low) return [50, 50];
  const k = ((bars[n - 1].close - low) / (high - low)) * 100;
  return [k, k]; // simplified — %D would need smoothing
}

module.exports = {
  calcSMA, calcRSI, calcATR, calcVolatility, calcMomentum,
  calcAvgVolume, calcMedianVolume, calcDollarVolumePercentile, calcStochastic,
};
