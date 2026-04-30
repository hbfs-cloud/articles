#!/usr/bin/env node
/**
 * fetch-bench-spy.js — Fetch SPY daily closes and compute benchmark stats.
 * Writes data/bench-spy.json with returnTotal, maxDD, sharpe, calmar.
 *
 * Usage: node tools/fetch-bench-spy.js
 */

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const ROOT    = path.resolve(__dirname, '..');
const OUT     = path.join(ROOT, 'data', 'bench-spy.json');
const SYMBOL  = 'SPY';

// period1 = 2026-01-01 00:00:00 UTC
const START_DATE = '2026-01-01';
const period1 = Math.floor(new Date('2026-01-01T00:00:00Z').getTime() / 1000);
const period2 = Math.floor(Date.now() / 1000);

const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(SYMBOL)}` +
            `?period1=${period1}&period2=${period2}&interval=1d`;

function toDateStr(ts) {
  const d = new Date(ts * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function computeStats(closes) {
  const dates = Object.keys(closes).sort();
  if (dates.length < 2) return { returnTotal: 0, maxDD: 0, sharpe: 0, calmar: 0 };

  const prices = dates.map(d => closes[d]);
  const first  = prices[0];
  const last   = prices[prices.length - 1];

  // Total return
  const returnTotal = (last - first) / first;

  // Daily log returns for Sharpe
  const dailyReturns = [];
  for (let i = 1; i < prices.length; i++) {
    dailyReturns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  const n    = dailyReturns.length;
  const mean = dailyReturns.reduce((a, b) => a + b, 0) / n;
  const variance = dailyReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const std  = Math.sqrt(variance);
  // Annualised Sharpe (true: sqrt(252) * mean/std)
  const sharpe = std > 0 ? (Math.sqrt(252) * mean / std) : 0;

  // Max drawdown
  let peak   = prices[0];
  let maxDD  = 0;
  for (const p of prices) {
    if (p > peak) peak = p;
    const dd = (peak - p) / peak;
    if (dd > maxDD) maxDD = dd;
  }

  // Calmar = annualised return / maxDD
  const tradingDays = prices.length;
  const annualisedReturn = returnTotal * (252 / tradingDays);
  const calmar = maxDD > 0 ? annualisedReturn / maxDD : 0;

  return {
    returnTotal: +returnTotal.toFixed(6),
    maxDD:       +maxDD.toFixed(6),
    sharpe:      +sharpe.toFixed(4),
    calmar:      +calmar.toFixed(4),
  };
}

function fetchSPY() {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000,
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          const result = j?.chart?.result?.[0];
          if (!result) return reject(new Error('No chart result for SPY'));
          const timestamps = result.timestamp || [];
          const q = result.indicators?.quote?.[0] || {};
          const closes = {};
          for (let i = 0; i < timestamps.length; i++) {
            if (q.close?.[i] != null) {
              closes[toDateStr(timestamps[i])] = +q.close[i].toFixed(4);
            }
          }
          resolve(closes);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout fetching SPY')); });
  });
}

async function main() {
  console.log(`[fetch-bench-spy] Fetching ${SYMBOL} closes from ${START_DATE} …`);
  let closes;
  try {
    closes = await fetchSPY();
  } catch (e) {
    console.error(`[fetch-bench-spy] ERROR: ${e.message}`);
    process.exit(1);
  }

  const dates = Object.keys(closes).sort();
  if (dates.length < 5) {
    console.error(`[fetch-bench-spy] Too few data points: ${dates.length}`);
    process.exit(1);
  }

  const stats = computeStats(closes);
  const out = {
    symbol:     SYMBOL,
    updated_at: new Date().toISOString(),
    period:     { start: dates[0], end: dates[dates.length - 1] },
    stats,
    closes,
  };

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`[fetch-bench-spy] Wrote ${path.relative(ROOT, OUT)} (${dates.length} trading days)`);
  console.log(`[fetch-bench-spy] Stats: returnTotal=${stats.returnTotal} maxDD=${stats.maxDD} sharpe=${stats.sharpe} calmar=${stats.calmar}`);
}

main();
