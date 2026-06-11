#!/usr/bin/env node
'use strict';

/**
 * test-ab-compare.js — Compare JS candlestick scanner output vs Go ab-scan-history.
 *
 * Runs both scanners on the same tickers and date range, then compares
 * pattern names, scores, buy levels, and stop levels.
 *
 * Usage:
 *   node tools/test-ab-compare.js                           # default: AAPL,MSFT,WMT
 *   node tools/test-ab-compare.js --tickers AAPL,NVDA       # custom
 *   node tools/test-ab-compare.js --start 2026-05-01        # date range
 */

const { execSync } = require('child_process');
const path = require('path');
const https = require('https');
const { detectPattern, avgBodySize, matchPattern, calcATR, calcRSI, calcSMA, calcBBPctB, volRatio } = require('./lib/candlestick-patterns');

const GO_PROJECT = '/Users/marketwatchxyz/GolandProjects/systematic-tss';
const GO_BIN = path.join(GO_PROJECT, 'bin', 'ab-scan-history');

const args = process.argv.slice(2);
function getArg(name, def) { const i = args.indexOf(`--${name}`); return i >= 0 && args[i+1] ? args[i+1] : def; }

const TICKERS = getArg('tickers', 'AAPL,MSFT,WMT').split(',');
const START = getArg('start', '2026-05-01');

// ─── Fetch OHLCV bars (with volume) ────────────────────────────────────────

function fetchOHLCV(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=2y`;
  return new Promise(resolve => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          const r = j?.chart?.result?.[0];
          if (!r) return resolve([]);
          const ts = r.timestamp || [];
          const q = r.indicators?.quote?.[0] || {};
          const bars = [];
          for (let i = 0; i < ts.length; i++) {
            const d = new Date(ts[i] * 1000).toISOString().slice(0, 10);
            const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i], v = q.volume?.[i] || 0;
            if (o != null && h != null && l != null && c != null) bars.push({ date: d, open: o, high: h, low: l, close: c, volume: v });
          }
          resolve(bars);
        } catch { resolve([]); }
      });
    });
    req.on('error', () => resolve([]));
    req.on('timeout', () => { req.destroy(); resolve([]); });
  });
}

// ─── Run Go scanner ────────────────────────────────────────────────────────

function runGoScanner(tickers, start) {
  const cmd = `${GO_BIN} -ticker "${tickers.join(',')}" -start "${start}" 2>/dev/null`;
  const output = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  const lines = output.trim().split('\n');
  const header = lines[0];
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length < 10) continue;
    results.push({
      date: parts[0], ticker: parts[1], direction: parts[2], pattern: parts[3],
      buyLevel: parseFloat(parts[4]), stopLevel: parseFloat(parts[5]),
      score: parseFloat(parts[6]), rsi: parseFloat(parts[7]),
      volRatio: parseFloat(parts[8]), close: parseFloat(parts[9]),
    });
  }
  return results;
}

// ─── Run JS scanner day-by-day ──────────────────────────────────────────────

function runJSScanner(ticker, bars, start) {
  const results = [];
  const startIdx = bars.findIndex(b => b.date >= start);
  if (startIdx < 0) return results;

  for (let i = Math.max(startIdx, 60); i < bars.length; i++) {
    const slice = bars.slice(0, i + 1);
    const det = detectPattern(slice, null);
    if (!det) continue;
    results.push({
      date: bars[i].date, ticker, direction: 'LONG', pattern: det.pattern,
      buyLevel: +det.entry.toFixed(4), stopLevel: +det.stop.toFixed(4),
      score: det.totalScore, rsi: +det.rsi.toFixed(1),
      volRatio: +det.volRatio.toFixed(2), close: +bars[i].close.toFixed(4),
    });
  }
  return results;
}

// ─── Compare ────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🔬 Comparing JS vs Go AmericanBulls scanner`);
  console.log(`   Tickers: ${TICKERS.join(', ')} | Start: ${START}\n`);

  // Run Go
  console.log('🐹 Running Go scanner...');
  const goResults = runGoScanner(TICKERS, START);
  console.log(`   Go: ${goResults.length} patterns detected\n`);

  // Run JS
  console.log('📦 Running JS scanner...');
  const allJSResults = [];
  for (const ticker of TICKERS) {
    process.stderr.write(`  Fetching ${ticker}...`);
    const bars = await fetchOHLCV(ticker);
    process.stderr.write(` ${bars.length} bars\n`);
    const jsResults = runJSScanner(ticker, bars, START);
    allJSResults.push(...jsResults);
  }
  console.log(`   JS: ${allJSResults.length} patterns detected\n`);

  // Build lookup maps
  const goMap = new Map();
  for (const r of goResults) goMap.set(`${r.date}|${r.ticker}`, r);
  const jsMap = new Map();
  for (const r of allJSResults) jsMap.set(`${r.date}|${r.ticker}`, r);

  // Compare
  let matches = 0, patternMismatch = 0, goOnly = 0, jsOnly = 0;
  const allKeys = new Set([...goMap.keys(), ...jsMap.keys()]);

  console.log('📊 Comparison:');
  console.log(''.padEnd(100, '─'));
  console.log(`${'Date'.padEnd(12)} ${'Ticker'.padEnd(7)} ${'Go Pattern'.padEnd(30)} ${'JS Pattern'.padEnd(30)} ${'Match'.padEnd(8)} Score(Go/JS)`);
  console.log(''.padEnd(100, '─'));

  const sortedKeys = [...allKeys].sort();
  for (const key of sortedKeys) {
    const go = goMap.get(key);
    const js = jsMap.get(key);

    if (go && js) {
      const same = go.pattern === js.pattern;
      if (same) matches++; else patternMismatch++;
      const icon = same ? '  ✅' : '  ⚠️ ';
      console.log(`${go.date.padEnd(12)} ${go.ticker.padEnd(7)} ${go.pattern.padEnd(30)} ${js.pattern.padEnd(30)} ${icon.padEnd(8)} ${go.score}/${js.score}`);
    } else if (go && !js) {
      goOnly++;
      console.log(`${go.date.padEnd(12)} ${go.ticker.padEnd(7)} ${go.pattern.padEnd(30)} ${'---'.padEnd(30)} ${'  🔴 Go'.padEnd(8)} ${go.score}/-`);
    } else if (js && !go) {
      jsOnly++;
      console.log(`${js.date.padEnd(12)} ${js.ticker.padEnd(7)} ${'---'.padEnd(30)} ${js.pattern.padEnd(30)} ${'  🟡 JS'.padEnd(8)} -/${js.score}`);
    }
  }

  console.log(''.padEnd(100, '─'));
  console.log(`\n📈 Summary:`);
  console.log(`   Pattern matches:    ${matches}/${allKeys.size} (${(matches/allKeys.size*100).toFixed(1)}%)`);
  console.log(`   Pattern mismatches: ${patternMismatch}`);
  console.log(`   Go-only:           ${goOnly}`);
  console.log(`   JS-only:           ${jsOnly}`);
  console.log(`   Total Go:          ${goResults.length}`);
  console.log(`   Total JS:          ${allJSResults.length}`);

  if (matches / allKeys.size > 0.8) {
    console.log(`\n✅ Pattern detection parity > 80% — scanner port is faithful.`);
  } else {
    console.log(`\n⚠️  Pattern detection parity < 80% — investigate discrepancies.`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
