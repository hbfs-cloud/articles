#!/usr/bin/env node
'use strict';

// Quick test: fetch AAPL from all sources and display results.

const YahooWSSource = require('./sources/yahoo-ws');
const WebullSource = require('./sources/webull');
const T212Source = require('./sources/t212');
const YahooRESTSource = require('./sources/yahoo-rest');

const SYMBOL = 'AAPL';

async function testWebullRT() {
  console.log('\n━━━ 1. WEBULL RT (snapshot quote) ━━━');
  const src = new WebullSource({ verbose: true });
  try {
    const tick = await src.getQuote(SYMBOL);
    if (tick) {
      console.log(`  Price: $${tick.price}`);
      console.log(`  Bid/Ask: $${tick.bid || '?'} / $${tick.ask || '?'}`);
      console.log(`  Day H/L: $${tick.dayHigh || '?'} / $${tick.dayLow || '?'}`);
      console.log(`  Day Volume: ${tick.dayVolume?.toLocaleString()}`);
      console.log(`  Source: ${tick.source}`);
    } else {
      console.log('  ❌ No data returned');
    }
  } catch (e) { console.log(`  ❌ Error: ${e.message}`); }
}

async function testT212RT() {
  console.log('\n━━━ 2. T212 RT (deviation endpoint) ━━━');
  const src = new T212Source({ verbose: true });
  try {
    const tick = await src.getQuote(SYMBOL);
    if (tick) {
      console.log(`  Price: $${tick.price}`);
      console.log(`  Day High: $${tick.dayHigh || '?'}`);
      console.log(`  Day Low: $${tick.dayLow || '?'}`);
      console.log(`  Source: ${tick.source}`);
    } else {
      console.log('  ❌ No data returned');
    }
  } catch (e) { console.log(`  ❌ Error: ${e.message}`); }
}

async function testT212OHLCV() {
  console.log('\n━━━ 3. T212 OHLCV (1m bars, last 5) ━━━');
  const src = new T212Source({ verbose: true });
  try {
    const bars = await src.getBars(SYMBOL, '1m', 5);
    if (bars && bars.length > 0) {
      console.log(`  Got ${bars.length} bars:`);
      for (const b of bars.slice(-5)) {
        const t = new Date(b.ts).toISOString().slice(11, 19);
        console.log(`  ${t} O:${b.open.toFixed(2)} H:${b.high.toFixed(2)} L:${b.low.toFixed(2)} C:${b.close.toFixed(2)} V:${b.volume}`);
      }
    } else {
      console.log('  ❌ No bars returned');
    }
  } catch (e) { console.log(`  ❌ Error: ${e.message}`); }

  console.log('\n━━━ 4. T212 OHLCV (1d bars, last 5) ━━━');
  const src2 = new T212Source({ verbose: true });
  try {
    const bars = await src2.getBars(SYMBOL, '1d', 5);
    if (bars && bars.length > 0) {
      console.log(`  Got ${bars.length} bars:`);
      for (const b of bars.slice(-5)) {
        const t = new Date(b.ts).toISOString().slice(0, 10);
        console.log(`  ${t} O:${b.open.toFixed(2)} H:${b.high.toFixed(2)} L:${b.low.toFixed(2)} C:${b.close.toFixed(2)} V:${b.volume}`);
      }
    } else {
      console.log('  ❌ No bars returned');
    }
  } catch (e) { console.log(`  ❌ Error: ${e.message}`); }
}

async function testYahooREST() {
  console.log('\n━━━ 5. YAHOO REST OHLCV (1d bars, last 5) ━━━');
  const src = new YahooRESTSource({ verbose: true });
  try {
    const bars = await src.getBars(SYMBOL, '1d', 5);
    if (bars && bars.length > 0) {
      console.log(`  Got ${bars.length} bars (showing last 5):`);
      for (const b of bars.slice(-5)) {
        const t = new Date(b.ts).toISOString().slice(0, 10);
        console.log(`  ${t} O:${b.open.toFixed(2)} H:${b.high.toFixed(2)} L:${b.low.toFixed(2)} C:${b.close.toFixed(2)} V:${b.volume?.toLocaleString()}`);
      }
    } else {
      console.log('  ❌ No bars returned');
    }
  } catch (e) { console.log(`  ❌ Error: ${e.message}`); }

  console.log('\n━━━ 6. YAHOO REST OHLCV (1m bars, last 5) ━━━');
  try {
    const bars = await src.getBars(SYMBOL, '1m', 5);
    if (bars && bars.length > 0) {
      console.log(`  Got ${bars.length} bars (showing last 5):`);
      for (const b of bars.slice(-5)) {
        const t = new Date(b.ts).toISOString().slice(11, 19);
        console.log(`  ${t} O:${b.open.toFixed(2)} H:${b.high.toFixed(2)} L:${b.low.toFixed(2)} C:${b.close.toFixed(2)} V:${b.volume?.toLocaleString()}`);
      }
    } else {
      console.log('  ❌ No bars returned');
    }
  } catch (e) { console.log(`  ❌ Error: ${e.message}`); }
}

async function testYahooWS() {
  console.log('\n━━━ 7. YAHOO WS RT (streaming, wait 5s) ━━━');
  const src = new YahooWSSource({ verbose: true });
  try {
    await src.init();
    let ticks = [];
    src.subscribe([SYMBOL], (tick) => {
      ticks.push(tick);
    });
    // Wait up to 5s for ticks
    await new Promise(r => setTimeout(r, 5000));
    src.destroy();

    if (ticks.length > 0) {
      console.log(`  Received ${ticks.length} ticks in 5s:`);
      const last = ticks[ticks.length - 1];
      console.log(`  Last: $${last.price} (vol: ${last.dayVolume?.toLocaleString()}) H:${last.dayHigh} L:${last.dayLow}`);
      console.log(`  Source: ${last.source}`);
    } else {
      console.log('  ⚠️  No ticks in 5s (market might be closed or WS slow to connect)');
    }
  } catch (e) { console.log(`  ❌ Error: ${e.message}`); }
}

async function main() {
  console.log(`\n🔍 Testing market data sources for ${SYMBOL}`);
  console.log(`   Time: ${new Date().toISOString()}`);
  console.log(`   Note: Market is ${isWeekend() ? 'CLOSED (weekend)' : 'check hours'}`);

  // Run REST sources in parallel
  await Promise.all([testWebullRT(), testT212RT()]);
  await testT212OHLCV();
  await testYahooREST();
  await testYahooWS();

  console.log('\n✅ Done');
  process.exit(0);
}

function isWeekend() { const d = new Date().getDay(); return d === 0 || d === 6; }

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
