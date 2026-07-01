#!/usr/bin/env node
'use strict';
// build-metadata.js — build ticker sector/market-cap metadata + EU universe
// from StockAnalysis, using tools/lib/stockanalysis-fetcher.js.
//
// Outputs:
//   data/ticker-metadata.json  { "<SYMBOL>": {sector, marketCap, industry, country} }  (US + EU)
//   data/eu-universe.json      EU stocks (DE/FR/NL/IT/ES/PL/CH/UK/GR) sorted by MarketCap desc
//
// Does NOT touch data/americanbull-universe.json.
//
// Method mirrors systematic-tss internal/universe/universe.go (Region == "EU").
// NO HALLUCINATION: if the API is unreachable and no cache exists, the run aborts
// with a non-zero exit code rather than emitting fabricated metadata.

const fs = require('fs');
const path = require('path');
const {
  fetchStocks,
  fetchEuUniverse,
  EU_REGIONS,
} = require('./lib/stockanalysis-fetcher');

const DATA_DIR = path.join(__dirname, '..', 'data');
const META_OUT = path.join(DATA_DIR, 'ticker-metadata.json');
const EU_OUT = path.join(DATA_DIR, 'eu-universe.json');

// Asset-class tagging (port of universe.go section 3, EU-focused).
function classify(sector, region) {
  const s = sector || '';
  if (/Materials|Mining|Gold/.test(s)) return 'GOLD';
  if (/Energy|Oil/.test(s)) return 'CRUDE';
  return 'STOCKS_EU';
}

async function main() {
  const forceRefresh = process.argv.includes('--refresh');
  const today = new Date().toISOString().slice(0, 10);
  console.log(`[build-metadata] ${today} — fetching StockAnalysis (US + EU ${EU_REGIONS.join('/')})`);

  // 1. US universe (default screener, no &c) ------------------------------
  const us = await fetchStocks('US', { forceRefresh });
  console.log(`[build-metadata] US: ${us.count} tickers (source=${us.source}, dropped ${us.dropped} secondary listings)`);
  if (us.count < 1000) {
    throw new Error(`US universe too small (${us.count}); refusing to write partial metadata`);
  }

  // 2. EU universe (per-region, merged, sorted by mcap) -------------------
  const eu = await fetchEuUniverse({ forceRefresh });
  const euCount = eu.stocks.length;
  console.log(`[build-metadata] EU per-region: ${JSON.stringify(eu.regionCounts)}`);
  console.log(`[build-metadata] EU merged+deduped: ${euCount} tickers`);
  if (euCount < 100) {
    throw new Error(`EU universe too small (${euCount}); refusing to write partial universe`);
  }

  // 3. ticker-metadata.json (US + EU) -------------------------------------
  const metadata = {};
  for (const [sym, rec] of Object.entries(us.data)) {
    metadata[sym] = {
      sector: rec.sector,
      marketCap: rec.marketCap,
      industry: rec.industry,
      country: rec.country,
    };
  }
  for (const rec of eu.stocks) {
    // do not clobber a US listing of the same symbol
    if (metadata[rec.symbol]) continue;
    metadata[rec.symbol] = {
      sector: rec.sector,
      marketCap: rec.marketCap,
      industry: rec.industry,
      country: rec.country,
    };
  }
  const metaKeys = Object.keys(metadata);
  const withSector = metaKeys.filter(k => metadata[k].sector).length;
  const withMcap = metaKeys.filter(k => (metadata[k].marketCap || 0) > 0).length;
  fs.writeFileSync(META_OUT, JSON.stringify(metadata, null, 0));
  console.log(`[build-metadata] wrote ${path.relative(process.cwd(), META_OUT)} — ${metaKeys.length} tickers (${withSector} w/sector, ${withMcap} w/mcap)`);

  // 4. eu-universe.json ----------------------------------------------------
  const euStocks = eu.stocks.map(r => ({
    symbol: r.symbol,
    name: r.name,
    marketCap: r.marketCap,
    sector: r.sector,
    industry: r.industry,
    country: r.country,
    region: r.region,
    exchange: r.exchange,
    assetClass: classify(r.sector, r.region),
  }));
  const euDoc = {
    updated: today,
    source: 'stockanalysis.com data-points screener (type=s, per-region)',
    method: 'systematic-tss universe.go Region==EU (merge regions, dedupe by symbol, sort by MarketCap desc)',
    regions: EU_REGIONS,
    regionCounts: eu.regionCounts,
    minAvgVolume: 1000,
    count: euStocks.length,
    tickers: euStocks.map(s => s.symbol),
    stocks: euStocks,
  };
  fs.writeFileSync(EU_OUT, JSON.stringify(euDoc, null, 0));
  console.log(`[build-metadata] wrote ${path.relative(process.cwd(), EU_OUT)} — ${euStocks.length} EU tickers`);

  // sample for the operator
  const sample = metaKeys
    .filter(k => metadata[k].sector && metadata[k].marketCap > 0)
    .slice(0, 3)
    .map(k => `${k}: ${metadata[k].sector} / mcap=${(metadata[k].marketCap / 1e9).toFixed(1)}B / ${metadata[k].country}`);
  console.log('[build-metadata] sample:', JSON.stringify(sample, null, 2));
}

main().catch(err => {
  console.error(`[build-metadata] FATAL: ${err.message}`);
  process.exit(1);
});
