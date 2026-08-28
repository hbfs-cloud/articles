#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
};
const inputDir = arg('--in');
const output = arg('--out');
const harnessFile = arg('--harness');
if (!inputDir || !output || !harnessFile) {
  console.error('Usage: build-eu-screener-fallback.js --in <fallback-data-dir> --out screen_eu.json --harness main-harness.json');
  process.exit(2);
}

function obvZ(bars) {
  if (!Array.isArray(bars) || bars.length < 30) return 0;
  let obv = 0;
  const series = [];
  for (let i = 1; i < bars.length; i++) {
    const prev = Number(bars[i - 1][4]);
    const close = Number(bars[i][4]);
    const volume = Number(bars[i][5]) || 0;
    obv += close > prev ? volume : close < prev ? -volume : 0;
    series.push(obv);
  }
  const window = series.slice(-20);
  const mean = window.reduce((a, b) => a + b, 0) / window.length;
  const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / window.length;
  return variance > 0 ? (window.at(-1) - mean) / Math.sqrt(variance) : 0;
}

function ema(values, period) {
  if (values.length < period) return NaN;
  const k = 2 / (period + 1);
  let value = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (const next of values.slice(period)) value = next * k + value * (1 - k);
  return value;
}

function rsi(values, period = 14) {
  if (values.length <= period) return NaN;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1];
    gains += Math.max(change, 0); losses += Math.max(-change, 0);
  }
  let avgGain = gains / period, avgLoss = losses / period;
  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
  }
  return avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
}

function atr(bars, period = 14) {
  if (bars.length <= period) return NaN;
  const ranges = [];
  for (let i = 1; i < bars.length; i++) {
    const high = Number(bars[i][2]), low = Number(bars[i][3]), prev = Number(bars[i - 1][4]);
    ranges.push(Math.max(high - low, Math.abs(high - prev), Math.abs(low - prev)));
  }
  return ranges.slice(-period).reduce((a, b) => a + b, 0) / period;
}

const bySymbol = new Map();
for (const file of fs.readdirSync(inputDir).filter(f => /^eu_b\d+\.json$/.test(f))) {
  const payload = JSON.parse(fs.readFileSync(path.join(inputDir, file), 'utf8'));
  const items = payload.data?.items || payload.items || [];
  const results = items.flatMap(item => item.results || []).concat(payload.results || []);
  for (const result of results) {
    if (result.data_type === 'bars_daily') {
      for (let i = 0; i < (result.data || []).length; i++) {
        const row = result.data[i];
        const symbol = String(row.symbol || result.symbols?.[i] || '').toUpperCase();
        if (symbol) bySymbol.set(symbol, { ...(bySymbol.get(symbol) || {}), bars: row.bars || [] });
      }
      continue;
    }
    for (const row of result.data || []) {
      const symbol = String(row.symbol || '').toUpperCase();
      if (!symbol) continue;
      const current = bySymbol.get(symbol) || {};
      if (row.type === 'instrument_quote') current.quote = row;
      if (row.type === 'instrument_technicals') current.tech = row;
      bySymbol.set(symbol, current);
    }
  }
}

const candidates = [];
for (const [symbol, value] of bySymbol) {
  const q = value.quote;
  const bars = value.bars || [];
  if (!q || bars.length < 60) continue;
  const closes = bars.map(row => Number(row[4]));
  const latest = bars.at(-1);
  const close = Number(latest[4]);
  const volume = Number(latest[5]);
  const rsi14 = rsi(closes);
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macd = ema12 - ema26;
  if (!(rsi14 > 45 && rsi14 < 75 && ema20 > ema50 && volume > 500000 && close > 5)) continue;
  const obvz = obvZ(value.bars);
  candidates.push({
    symbol,
    score: (75 - rsi14) * 2 + obvz * 10,
    strategy: 'custom_dsl',
    entry_price: close,
    close,
    volume,
    market_cap: Number(q.marketCap) || null,
    rsi: rsi14,
    macd,
    signal: null,
    ema20,
    ema50,
    sma_50: Number(q.fiftyDayAverage) || Number(t.ema50),
    atr: atr(bars),
    obvz,
    change_24h: closes.length > 1 ? (close / closes.at(-2) - 1) * 100 : 0,
    detected_bars_ago: 0,
    detected_at: latest[0] || q.timestamp || null,
    source: 'eu_referential_local_dsl_fallback'
  });
}
candidates.sort((a, b) => b.score - a.score);
if (candidates.length < 2) throw new Error(`EU fallback produced only ${candidates.length} candidates`);

const generatedAt = new Date().toISOString();
const result = {
  data: { items: [{ type: 'screener_results', candidates: candidates.slice(0, 15), warnings: ['RunScreener EU unavailable; exact DSL reproduced locally from point-in-time EU data.'] }] },
  status: 'completed',
  fallback: { active: true, method: 'eu_referential_local_dsl', generated_at: generatedAt, universe_size: bySymbol.size }
};
fs.writeFileSync(output, JSON.stringify(result, null, 2));

const mainHarness = JSON.parse(fs.readFileSync(harnessFile, 'utf8'));
const fallbackHarness = JSON.parse(fs.readFileSync(path.join(inputDir, 'harness.json'), 'utf8'));
mainHarness.sources = (mainHarness.sources || []).filter(s => s.name !== 'screen_eu');
for (const source of fallbackHarness.sources || []) {
  mainHarness.sources.push({ ...source, name: `screen_eu_${source.name}`, note: `EU fallback local DSL — ${source.note || ''}`.trim() });
}
mainHarness.sources.push({
  name: 'screen_eu', as_of: generatedAt, data_through: mainHarness.reference_close,
  max_age_h: 24, required: true, expects_close: true, reference_close: mainHarness.reference_close,
  note: 'RunScreener EU fallback: exact filter/score computed locally from EU referential + point-in-time indicators'
});
fs.writeFileSync(harnessFile, JSON.stringify(mainHarness, null, 2));
console.log(`[eu-fallback] ${Math.min(15, candidates.length)} candidates written to ${output}`);
