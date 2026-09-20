#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { closeFromSpark, marketFor, yahooSymbol } = require('./build-marketwatch-yahoo-closes');

(async () => {
  const routing = await import(pathToFileURL(path.join(__dirname, '../marketwatch/quote-routing.js')).href);

  assert.strictEqual(routing.isHyperliquidWindow(new Date('2026-09-20T16:00:00Z')), true, 'Sunday uses Hyperliquid window');
  assert.strictEqual(routing.isHyperliquidWindow(new Date('2026-09-21T07:59:00Z')), true, '03:59 New York is overnight');
  assert.strictEqual(routing.isHyperliquidWindow(new Date('2026-09-21T08:00:00Z')), false, '04:00 New York starts Yahoo extended hours');
  assert.strictEqual(routing.isHyperliquidWindow(new Date('2026-09-21T23:59:00Z')), false, '19:59 New York remains Yahoo extended hours');
  assert.strictEqual(routing.isHyperliquidWindow(new Date('2026-09-22T00:00:00Z')), true, '20:00 New York starts overnight');

  assert.strictEqual(routing.hyperliquidCoin({ market:'US', ticker:'AAOI' }, 'AAOI'), 'xyz:AAOI');
  assert.strictEqual(routing.hyperliquidCoin({ market:'MACRO', ticker:'Gold' }, 'GC=F'), 'xyz:GOLD');
  assert.strictEqual(routing.hyperliquidCoin({ market:'EU', ticker:'AIR' }, 'AIR.PA'), null);

  assert.strictEqual(marketFor('GS_US_EQ', 'GS', 'Goldman Sachs'), 'US');
  assert.strictEqual(yahooSymbol({ id:'GS_US_EQ', ticker:'GS', name:'Goldman Sachs', market:'US' }), 'GS');
  assert.strictEqual(yahooSymbol({ id:'PAAS_US_EQ', ticker:'PAAS', name:'Pan American Silver', market:'US' }), 'PAAS');
  assert.strictEqual(marketFor('CYFRF_US_EQ', 'STKE', 'Sol Strategies Inc'), 'US');
  assert.strictEqual(marketFor('ALCBIp_EQ', 'ALCBI', 'Crypto Blockchain Industries'), 'EU');
  assert.strictEqual(yahooSymbol({ id:'ALCBIp_EQ', ticker:'ALCBI', name:'Crypto Blockchain Industries', market:'EU' }), 'ALCBI.PA');
  assert.strictEqual(yahooSymbol({ id:'#VIXOCT26', ticker:'VOLX', name:'Volatility Index', market:'MACRO' }), '^VIX');
  assert.strictEqual(yahooSymbol({ id:'X_CA_EQ', ticker:'X', name:'TMX Group', market:'EU' }), 'X.TO');
  assert.strictEqual(yahooSymbol({ id:'IQSAm_EQ', ticker:'IQSA', name:'Invesco Global Active ESG Equity', market:'EU' }), 'IQSA.MI');

  const now = Date.parse('2026-09-20T16:00:00Z');
  const asset = {
    ticker:'AAOI', priceNumber:90, change:1, tech:{ close:91, change:2 },
    yahooClose:{ price:100, previousClose:98, change:2.04, sessionDate:'2026-09-18' },
    yahooRt:{ price:101, change:3, at:now - 1000 },
    hyperliquidRt:{ price:104, at:now - 1000 }
  };
  const hyperliquidQuote = routing.effectiveQuote(asset, now, true);
  assert.strictEqual(hyperliquidQuote.price, 104);
  assert(Math.abs(hyperliquidQuote.change - 4) < 1e-10);
  assert.deepStrictEqual({ ...hyperliquidQuote, change:4 }, {
    price:104, change:4, source:'hyperliquid', label:'HL RT', realtime:true, at:now - 1000
  });
  assert.strictEqual(routing.effectiveQuote(asset, now, false).source, 'yahoo-rt', 'Yahoo wins during extended/regular session');
  asset.yahooRt.at = now - routing.QUOTE_MAX_AGE.yahoo - 1;
  asset.hyperliquidRt.at = now - routing.QUOTE_MAX_AGE.hyperliquid - 1;
  assert.strictEqual(routing.effectiveQuote(asset, now, true).source, 'yahoo-close', 'stale real-time feeds fall back to Yahoo close');
  delete asset.yahooClose;
  assert.strictEqual(routing.effectiveQuote(asset, now, true).source, 'snapshot', 'local snapshot is the last explicit fallback');

  assert.deepStrictEqual(closeFromSpark({
    close:[10, null, 11], timestamp:[100, 200, 300], chartPreviousClose:9
  }), { price:11, previousClose:10, change:10.000000000000009, sessionDate:'1969-12-31' });
  assert.strictEqual(closeFromSpark({ close:[null, 0], timestamp:[100, 200], chartPreviousClose:9 }), null, 'null and zero closes are rejected');
  assert.strictEqual(routing.isFresh({ price:0, at:now - 1000 }, routing.QUOTE_MAX_AGE.yahoo, now), false, 'zero cannot be a live quote');

  const html = fs.readFileSync(path.join(__dirname, '../marketwatch/index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '../marketwatch/app.js'), 'utf8');
  assert(html.includes('⏳ Yahoo close') && html.includes('id="connectionHint"'), 'visible close legend and connection detail are required');
  assert(app.includes("wss://api.hyperliquid.xyz/ws") && app.includes("wss://streamer.finance.yahoo.com/"), 'both real-time feeds are wired');
  assert(app.includes('quoteBadge(quote)'), 'each table price must render its provenance badge');

  console.log('MarketWatch quote routing tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
