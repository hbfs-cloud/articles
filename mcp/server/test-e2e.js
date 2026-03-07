#!/usr/bin/env node
/**
 * MCP Server E2E Tests
 * Tests all major features directly against the library modules (no MCP transport).
 * Run: node test-e2e.js
 */

import { strict as assert } from 'assert';
import { existsSync, unlinkSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0, failed = 0;

async function test(name, fn) {
  process.stdout.write(`  ${name} ... `);
  try {
    await fn();
    console.log('✓');
    passed++;
  } catch (e) {
    console.log(`✗ ${e.message}`);
    failed++;
  }
}

function section(name) {
  console.log(`\n── ${name} ──`);
}

// ─── Imports ──────────────────────────────────────────────────────────────────

section('Loading modules');

const { default: Database } = await import('better-sqlite3');
const cache        = await import('./lib/cache.js');
const yahoo        = await import('./lib/yahoo.js');
const binance      = await import('./lib/binance.js');
const bvc          = await import('./lib/bvc.js');
const alertEngine   = await import('./lib/alert-engine.js');
const patternEngine = await import('./lib/pattern-engine.js');
const tickEnricher  = await import('./lib/tick-enricher.js');
const { stream: yahooWS } = await import('./lib/yahoo-ws.js');
const { BarsStorage, getStorage } = await import('./lib/storage.js');
const screener    = await import('./lib/screener.js');
const universe    = await import('./lib/universe.js');
const barsWorker  = await import('./lib/bars-worker.js');
const regime      = await import('./lib/regime.js');

console.log('  All modules loaded ✓');

// ─── 1. Cache ─────────────────────────────────────────────────────────────────

section('Cache (lib/cache.js)');

await test('set and get', () => {
  cache.set('test:key', { val: 42 }, 60);
  const v = cache.get('test:key');
  assert.equal(v?.val, 42);
});

await test('TTL expiry', async () => {
  cache.set('test:expire', 'gone', 0.001); // 1ms
  await new Promise(r => setTimeout(r, 5));
  assert.equal(cache.get('test:expire'), null);
});

await test('invalidate', () => {
  cache.set('test:inv', 'x', 60);
  cache.invalidate('test:inv');
  assert.equal(cache.get('test:inv'), null);
});

await test('stats returns object', () => {
  const s = cache.stats();
  assert.ok(typeof s.total === 'number');
});

// ─── 2. BarsStorage (SQLite) ──────────────────────────────────────────────────

section('BarsStorage (lib/storage.js)');

const TEST_DB = resolve(__dirname, 'data/test-e2e.db');
const store   = new BarsStorage(TEST_DB);

const FAKE_BARS = [
  { time: '2024-01-02T00:00:00.000Z', open: 185, high: 188, low: 184, close: 187, volume: 60e6, adjClose: 187 },
  { time: '2024-01-03T00:00:00.000Z', open: 187, high: 192, low: 186, close: 191, volume: 70e6, adjClose: 191 },
  { time: '2024-01-04T00:00:00.000Z', open: 191, high: 193, low: 188, close: 189, volume: 55e6, adjClose: 189 },
];

await test('save bars', () => {
  const n = store.save('AAPL', '1d', FAKE_BARS, 'yahoo');
  assert.equal(n, 3);
});

await test('get bars', () => {
  const rows = store.get('AAPL', '1d');
  assert.equal(rows.length, 3);
  assert.equal(rows[0].symbol, 'AAPL');
});

await test('latestDate', () => {
  const d = store.latestDate('AAPL', '1d');
  assert.ok(d?.startsWith('2024-01-04'));
});

await test('countBars', () => {
  assert.equal(store.countBars('AAPL', '1d'), 3);
});

await test('saveMeta + getMeta', () => {
  store.saveMeta({ symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', marketcap: 3_000_000, exchange: 'NASDAQ', region: 'US', type: 'EQUITY', currency: 'USD' });
  const m = store.getMeta('AAPL');
  assert.equal(m.name, 'Apple Inc.');
  assert.equal(m.sector, 'Technology');
});

await test('exportCSV returns string with header', () => {
  const csv = store.exportCSV('AAPL', '1d');
  assert.ok(csv.startsWith('date,open,high,low,close'));
  assert.ok(csv.includes('2024-01-02'));
});

await test('exportNDJSON returns valid JSON lines', () => {
  const ndjson = store.exportNDJSON('AAPL', '1d');
  const lines  = ndjson.trim().split('\n');
  assert.equal(lines.length, 3);
  const first  = JSON.parse(lines[0]);
  assert.ok('close' in first && 'volume' in first);
});

await test('catalog lists symbol', () => {
  const cat = store.catalog();
  assert.ok(cat.some(r => r.symbol === 'AAPL'));
});

await test('storageStats', () => {
  const s = store.storageStats();
  assert.ok(s.barCount >= 3);
  assert.ok(s.symbolCount >= 1);
});

// Intraday cleanup
const intradayBars = [
  { time: new Date(Date.now() - 10 * 86_400_000).toISOString(), open:1, high:1, low:1, close:1, volume:1 },
  { time: new Date(Date.now() -  1 * 86_400_000).toISOString(), open:2, high:2, low:2, close:2, volume:2 },
];
store.save('AAPL', '5m', intradayBars, 'yahoo');

await test('cleanOldIntraday removes stale bars', () => {
  const deleted = store.cleanOldIntraday(5); // keep 5 days
  assert.ok(deleted >= 1, `Expected >= 1 deleted, got ${deleted}`);
  const remaining = store.countBars('AAPL', '5m');
  assert.equal(remaining, 1); // only the recent one remains
});

// Clean up test DB
try { unlinkSync(TEST_DB); } catch {}

// ─── 3. Binance ───────────────────────────────────────────

section('Binance (lib/binance.js)');

await test('getTicker returns price for BTCUSDT', async () => {
  const t = await binance.getTicker('BTCUSDT');
  assert.ok(t.price > 0, `Price is ${t.price}`);
  assert.ok(typeof t.changePct === 'number');
  assert.ok(t.quoteVolume > 0);
});

await test('getMultiTicker returns data for multiple crypto', async () => {
  const tickers = await binance.getMultiTicker(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);
  assert.equal(tickers.length, 3);
  assert.ok(tickers.every(t => t.price > 0));
});

await test('getBars returns daily bars for BTCUSDT', async () => {
  const { bars } = await binance.getBars('BTCUSDT', '1d', 30);
  assert.ok(bars.length >= 25, `Expected >= 25 bars, got ${bars.length}`);
  assert.ok(bars[0].close > 0);
  assert.ok(bars[0].time);
});

await test('screener run() with crypto universe uses Binance', async () => {
  const result = await screener.run({
    universe: 'BTCUSDT,ETHUSDT,SOLUSDT',
    filter:   'change1d > -50',
    limit:    5
  });
  assert.ok(result.picks.length > 0, 'No picks for crypto screener');
  assert.ok(result.picks[0].exchange === 'BINANCE', `Expected BINANCE exchange, got ${result.picks[0].exchange}`);
});

// ─── 3b. Yahoo Finance ─────────────────────────────────────────────────────────

section('Yahoo Finance (lib/yahoo.js)');

await test('getQuotes returns price for AAPL', async () => {
  const quotes = await yahoo.getQuotes(['AAPL']);
  assert.ok(quotes.length > 0, 'No quotes returned');
  assert.ok(quotes[0].price > 0, `Price is ${quotes[0].price}`);
});

await test('getBars returns OHLCV bars for SPY', async () => {
  const { bars } = await yahoo.getBars('SPY', '1d', '1mo');
  assert.ok(bars.length >= 15, `Expected >= 15 bars, got ${bars.length}`);
  assert.ok(bars[0].close > 0);
  assert.ok(bars[0].time);
});

await test('getQuotes handles multiple symbols', async () => {
  const quotes = await yahoo.getQuotes(['AAPL', 'MSFT', 'NVDA']);
  assert.ok(quotes.length >= 2, `Expected >= 2, got ${quotes.length}`);
});

// ─── 4. DSL Compiler ─────────────────────────────────────────────────────────

section('DSL Compiler (lib/screener.js)');

await test('compileDSL simple expression', () => {
  const { fn, ok } = screener.compileDSL('change1d > 1.0');
  assert.ok(ok);
  assert.ok(fn({ changePct: 2.0 }));
  assert.ok(!fn({ changePct: 0.5 }));
});

await test('compileDSL AND connector', () => {
  const { fn, ok } = screener.compileDSL('change1d > 1.0 AND rvol > 1.5');
  assert.ok(ok);
  assert.ok(fn({ changePct: 2, rvol: 2 }));
  assert.ok(!fn({ changePct: 2, rvol: 1 }));
});

await test('compileDSL OR connector', () => {
  const { fn, ok } = screener.compileDSL('change1d > 3 OR rsi14 < 30');
  assert.ok(ok);
  assert.ok(fn({ changePct: 4, rsi14: 50 }));
  assert.ok(fn({ changePct: 1, rsi14: 25 }));
  assert.ok(!fn({ changePct: 1, rsi14: 50 }));
});

await test('compileDSL invalid expression returns error', () => {
  const { ok, error } = screener.compileDSL('change1d >>>>>> broken!!!');
  assert.ok(!ok);
  assert.ok(error);
});

await test('calcRSI returns value in 0-100', () => {
  const closes = [100,102,101,103,102,104,103,105,104,106,105,107,106,108,107,109];
  const rsi = screener.calcRSI(closes);
  assert.ok(rsi >= 0 && rsi <= 100, `RSI out of range: ${rsi}`);
});

await test('calcEMA returns value close to last price', () => {
  const closes = Array.from({ length: 60 }, (_, i) => 100 + i * 0.5);
  const ema = screener.calcEMA(closes, 20);
  assert.ok(Math.abs(ema - closes[closes.length - 1]) < 15);
});

await test('calcATR returns positive value', () => {
  const bars = [
    { open:100, high:102, low:98,  close:101 },
    { open:101, high:104, low:100, close:103 },
    { open:103, high:105, low:101, close:102 },
    { open:102, high:106, low:99,  close:104 },
    { open:104, high:107, low:102, close:105 },
    { open:105, high:108, low:103, close:106 },
    { open:106, high:109, low:104, close:107 },
    { open:107, high:110, low:105, close:108 },
    { open:108, high:111, low:106, close:109 },
    { open:109, high:112, low:107, close:110 },
    { open:110, high:113, low:108, close:111 },
    { open:111, high:114, low:109, close:112 },
    { open:112, high:115, low:110, close:113 },
    { open:113, high:116, low:111, close:114 },
    { open:114, high:117, low:112, close:115 },
  ];
  const atr = screener.calcATR(bars);
  assert.ok(atr > 0, `ATR should be positive, got ${atr}`);
});

// ─── 5. Screener run() ────────────────────────────────────────────────────────

section('Screener run() (live, may be slow)');

await test('run() with custom symbol list returns picks', async () => {
  const result = await screener.run({
    universe: 'AAPL,MSFT,NVDA,AMZN,GOOGL',
    filter:   'change1d > -50',  // accept everything
    limit:    5
  });
  assert.ok(result.picks.length > 0, 'No picks returned');
  assert.ok(result.meta.totalScanned >= 1);
  assert.ok(typeof result.meta.regime === 'string');
});

await test('run() DSL filter works', async () => {
  const result = await screener.run({
    universe: 'AAPL,MSFT,NVDA,AMZN,GOOGL',
    filter:   'price > 1000000',  // impossible — should return 0
    limit:    10
  });
  assert.equal(result.picks.length, 0, 'Should have 0 picks with impossible filter');
});

await test('run() bars=true enriches with RSI', async () => {
  const result = await screener.run({
    universe: 'AAPL,MSFT',
    filter:   'change1d > -50',
    bars:     true,
    limit:    5
  });
  assert.ok(result.picks.length > 0);
  // At least one pick should have rsi14
  const hasRSI = result.picks.some(p => p.rsi14 !== null);
  assert.ok(hasRSI, 'Expected at least one pick with rsi14 computed');
});

// ─── 6. Backtest ─────────────────────────────────────────────────────────────

section('Screener backtest() (live)');

await test('backtest() returns summary + trades', async () => {
  const result = await screener.backtest({
    universe:  'SPY,QQQ,IWM',
    filter:    'change1d > -50',
    hold_days: 5,
    tp_pct:    3,
    stop_pct:  -2
  });
  assert.ok(result.summary, 'No summary');
  assert.ok(Array.isArray(result.trades));
  assert.ok(result.summary.totalTrades >= 0);
  assert.ok(['A+','A','B+','B','C','D'].includes(result.summary.grade));
});

await test('backtest() saves bars to storage', async () => {
  const storage = getStorage();
  await screener.backtest({
    universe:  'AAPL',
    filter:    'change1d > -50',
    hold_days: 5
  });
  const count = storage.countBars('AAPL', '1d');
  assert.ok(count > 50, `Expected bars in storage for AAPL, got ${count}`);
});

// ─── 7. Universe ─────────────────────────────────────────────────────────────

section('Universe (lib/universe.js)');

await test('list() returns array of universe configs', () => {
  const list = universe.list();
  assert.ok(Array.isArray(list) && list.length > 5);
  assert.ok(list.some(u => u.key === 'us_large'));
  assert.ok(list.some(u => u.key === 'etf'));
});

await test('searchTickers() returns results for "apple"', async () => {
  const results = await universe.searchTickers('apple', null, 10);
  assert.ok(Array.isArray(results));
  assert.ok(results.some(r => r.symbol === 'AAPL'), 'AAPL not found');
});

await test('fetchYahooScreener() returns symbols for most_actives', async () => {
  const syms = await universe.fetchYahooScreener('most_actives', 20);
  assert.ok(Array.isArray(syms) && syms.length > 0, `Expected symbols, got ${syms.length}`);
});

// StockAnalysis API test (will fetch live)
await test('get("us_large") returns 100+ Yahoo-compatible symbols', async () => {
  const syms = await universe.get('us_large');
  assert.ok(Array.isArray(syms), 'Not an array');
  assert.ok(syms.length >= 100, `Expected >= 100 symbols, got ${syms.length}`);
  assert.ok(syms.every(s => typeof s === 'string'), 'Symbols should be strings');
  // US symbols should not contain slash (SA format) or unknown formats
  assert.ok(!syms.some(s => s.includes('/')), 'Found slash in symbol — SA format not converted');
});

await test('get("eu") returns Yahoo-compatible symbols (.DE, .PA, .AS etc.)', async () => {
  const syms = await universe.get('eu');
  assert.ok(syms.length >= 50, `Expected >= 50 EU symbols, got ${syms.length}`);
  assert.ok(!syms.some(s => s.includes('/')), 'EU symbols should not contain SA exchange prefix');
  // Should have recognizable Yahoo suffixes
  const hasSuffix = syms.some(s => s.includes('.DE') || s.includes('.PA') || s.includes('.AS') || s.includes('.ST') || s.includes('.L'));
  assert.ok(hasSuffix, 'No Yahoo-format EU symbols found');
});

await test('get("crypto") returns 25 Binance USDT symbols', async () => {
  const syms = await universe.get('crypto');
  assert.equal(syms.length, 25);
  assert.ok(syms.includes('BTCUSDT'), 'Missing BTCUSDT');
  assert.ok(syms.includes('ETHUSDT'), 'Missing ETHUSDT');
  assert.ok(syms.every(s => s.endsWith('USDT')), 'All crypto should be USDT pairs');
});

await test('isCrypto() detects Binance symbols correctly', () => {
  assert.ok(universe.isCrypto('BTCUSDT'));
  assert.ok(universe.isCrypto('ETHUSDT'));
  assert.ok(!universe.isCrypto('AAPL'));
  assert.ok(!universe.isCrypto('SPY'));
  assert.ok(!universe.isCrypto('SAP.DE'));
});

await test('saToYahoo converts SA format correctly', () => {
  assert.equal(universe.saToYahoo('ETR/SAP'),    'SAP.DE');
  assert.equal(universe.saToYahoo('EPA/MC'),     'MC.PA');
  assert.equal(universe.saToYahoo('AMS/ASML'),   'ASML.AS');
  assert.equal(universe.saToYahoo('STO/INVE.B'), 'INVE-B.ST');
  assert.equal(universe.saToYahoo('AAPL'),       'AAPL');   // US: unchanged
  assert.equal(universe.saToYahoo('OSL/EQNR'),  'EQNR.OL');
  assert.equal(universe.saToYahoo('XXX/FOO'),   null);       // unknown exchange
});

await test('getWithMeta("us_large") returns objects with required fields', async () => {
  const metas = await universe.getWithMeta('us_large');
  assert.ok(metas.length >= 100);
  const first = metas[0];
  assert.ok(first.symbol,      'Missing symbol');
  assert.ok(first.yahooSymbol, 'Missing yahooSymbol');
  assert.ok(first.name,        'Missing name');
  assert.ok(first.dollarVolume != null, 'Missing dollarVolume');
  // Sorted by dollarVolume desc
  assert.ok(metas[0].dollarVolume >= metas[1].dollarVolume, 'Not sorted by dollarVolume');
});

// ─── 8. BVC (Casablanca Bourse) ──────────────────────────────────────────────

section('BVC — Casablanca Bourse (lib/bvc.js)');

await test('loadInstruments() returns 50+ symbols', async () => {
  const instruments = await bvc.loadInstruments();
  const keys = Object.keys(instruments);
  assert.ok(keys.length >= 50, `Expected >= 50 instruments, got ${keys.length}`);
  // Each entry should have symbol, instrumentID, isin
  const first = instruments[keys[0]];
  assert.ok(first.symbol,       'Missing symbol');
  assert.ok(first.instrumentID, 'Missing instrumentID');
});

await test('isBVC() detects CSE symbols', async () => {
  // ATW (Attijariwafa Bank) should be a BVC symbol
  const isAtw = await bvc.isBVC('ATW');
  assert.ok(isAtw, 'ATW should be recognized as BVC symbol');
  const notBvc = await bvc.isBVC('AAPL');
  assert.ok(!notBvc, 'AAPL should not be a BVC symbol');
});

await test('getBars() returns OHLCV bars for ATW', async () => {
  const { bars, source } = await bvc.getBars('ATW');
  assert.ok(bars.length >= 100, `Expected >= 100 bars for ATW, got ${bars.length}`);
  assert.equal(source, 'bvc');
  assert.ok(bars[0].time, 'Missing time field');
  assert.ok(bars[0].close > 0, 'Close price should be > 0');
  // Should be sorted ascending
  assert.ok(bars[0].time < bars[bars.length - 1].time, 'Bars not sorted ascending');
});

await test('getQuote() returns latest price for ATW', async () => {
  const q = await bvc.getQuote('ATW');
  assert.ok(q, 'No quote returned');
  assert.ok(q.price > 0, `Price should be > 0, got ${q.price}`);
  assert.equal(q.exchange, 'CSE');
  assert.equal(q.source, 'bvc');
  assert.ok(q.date, 'Missing date field');
  assert.ok(typeof q.changePct === 'number', 'changePct should be a number');
});

await test('get("ma") universe returns BVC symbols', async () => {
  const syms = await universe.get('ma');
  assert.ok(Array.isArray(syms) && syms.length >= 50, `Expected >= 50 MA symbols, got ${syms.length}`);
  assert.ok(syms.includes('ATW'), 'ATW missing from MA universe');
  assert.ok(syms.includes('BCP'), 'BCP missing from MA universe');
});

await test('screener run() with MA universe fetches BVC quotes', async () => {
  const result = await screener.run({
    universe: 'ATW,BCP,IAM',
    filter:   'change1d > -50',
    limit:    5
  });
  assert.ok(result.picks.length > 0, 'No picks for BVC screener');
  assert.ok(result.picks[0].exchange === 'CSE', `Expected CSE exchange, got ${result.picks[0].exchange}`);
});

// ─── 8. Alert Engine ─────────────────────────────────────────────────────────

section('Alert Engine — DSL (lib/alert-engine.js)');

await test('compileAlertDSL simple threshold', () => {
  const { fn, ok } = alertEngine.compileAlertDSL('price > 100');
  assert.ok(ok);
  assert.ok(fn({ price: 150 }, null));
  assert.ok(!fn({ price: 50 }, null));
});

await test('compileAlertDSL AND compound', () => {
  const { fn, ok } = alertEngine.compileAlertDSL('rvol >= 2 AND changePct > 1.5');
  assert.ok(ok);
  assert.ok(fn({ rvol: 3, changePct: 2 }, null));
  assert.ok(!fn({ rvol: 1, changePct: 2 }, null));
});

await test('compileAlertDSL crosses_above (stateful)', () => {
  const { fn, ok } = alertEngine.compileAlertDSL('price crosses_above ema50');
  assert.ok(ok);
  // prev below, curr above → fires
  assert.ok(fn({ price: 105, ema50: 100 }, { price: 95, ema50: 100 }));
  // both above → does not fire
  assert.ok(!fn({ price: 105, ema50: 100 }, { price: 102, ema50: 100 }));
  // no prev → does not fire
  assert.ok(!fn({ price: 105, ema50: 100 }, null));
});

await test('compileAlertDSL crosses_below (stateful)', () => {
  const { fn, ok } = alertEngine.compileAlertDSL('rsi14 crosses_below 30');
  assert.ok(ok);
  assert.ok(fn({ rsi14: 28 }, { rsi14: 35 }));    // crosses into oversold
  assert.ok(!fn({ rsi14: 28 }, { rsi14: 25 }));   // already below
});

await test('compileAlertDSL touches', () => {
  const { fn, ok } = alertEngine.compileAlertDSL('price touches high52w');
  assert.ok(ok);
  assert.ok(fn({ price: 99.8, high52w: 100 }, null));   // within 0.5%
  assert.ok(!fn({ price: 95, high52w: 100 }, null));    // too far
});

await test('compileAlertDSL drawdown/gain fields', () => {
  const { fn, ok } = alertEngine.compileAlertDSL('drawdown > 5');
  assert.ok(ok);
  assert.ok(fn({ drawdown: 6 }, null));
  assert.ok(!fn({ drawdown: 3 }, null));
});

await test('compileAlertDSL invalid → error reported', () => {
  const { ok, error } = alertEngine.compileAlertDSL('price >>>>>> ???');
  assert.ok(!ok);
  assert.ok(typeof error === 'string' && error.length > 0);
});

await test('createAlert returns public object without _fn', () => {
  const a = alertEngine.createAlert({
    ticker: 'AAPL', name: 'Test', when: 'price > 100', once: true
  });
  assert.ok(a.id > 0);
  assert.equal(a.ticker, 'AAPL');
  assert.ok(!('_fn' in a), '_fn should be stripped from public object');
  assert.equal(a.status, 'active');
});

await test('pause/resume alert', () => {
  const a = alertEngine.createAlert({ ticker: 'MSFT', name: 'Test2', when: 'price > 1' });
  alertEngine.pauseAlert(a.id);
  assert.equal(alertEngine.getAlert(a.id).status, 'paused');
  alertEngine.resumeAlert(a.id);
  assert.equal(alertEngine.getAlert(a.id).status, 'active');
});

await test('tick() fires alert when condition met', async () => {
  const a = alertEngine.createAlert({ ticker: 'TEST', name: 'tick test', when: 'price > 200', channels: [] });
  const quotes = new Map([['TEST', { price: 250, changePct: 1, rvol: 1.5 }]]);
  const triggered = await alertEngine.tick(quotes, new Map());
  assert.ok(triggered.some(ev => ev.alertId === a.id), 'Alert should have fired');
  alertEngine.deleteAlert(a.id);
});

await test('tick() once=true disables after first trigger', async () => {
  const a = alertEngine.createAlert({ ticker: 'TEST2', name: 'once test', when: 'price > 0', once: true, throttle: 0, channels: [] });
  const quotes = new Map([['TEST2', { price: 1, changePct: 0, rvol: 1 }]]);
  await alertEngine.tick(quotes, new Map());
  assert.equal(alertEngine.getAlert(a.id).status, 'triggered', 'Should be disabled after once=true trigger');
  alertEngine.deleteAlert(a.id);
});

await test('getErrors() returns array', () => {
  const errs = alertEngine.getErrors();
  assert.ok(Array.isArray(errs));
});

await test('status() has expected shape', () => {
  const s = alertEngine.status();
  assert.ok(typeof s.total   === 'number');
  assert.ok(typeof s.active  === 'number');
  assert.ok(Array.isArray(s.recentErrors));
});

// ─── Pattern Engine ───────────────────────────────────────────────────────────

section('Pattern Engine (lib/pattern-engine.js)');

// Generate 100 synthetic daily bars (uptrend into breakout)
function syntheticBars(n = 100, trend = 0.001) {
  const bars = [];
  let price = 100;
  for (let i = 0; i < n; i++) {
    const open  = price;
    const close = +(open * (1 + (Math.random() - 0.48) * 0.02 + trend)).toFixed(2);
    const high  = +(Math.max(open, close) * (1 + Math.random() * 0.005)).toFixed(2);
    const low   = +(Math.min(open, close) * (1 - Math.random() * 0.005)).toFixed(2);
    const vol   = Math.round(1e6 * (1 + Math.random()));
    bars.push({ time: new Date(Date.now() - (n - i) * 86400000).toISOString(), open, high, low, close, volume: vol });
    price = close;
  }
  return bars;
}

const BARS = syntheticBars(120);
const BARS_DOWN = syntheticBars(120, -0.001);

await test('breakoutScore returns 0-100', () => {
  const s = patternEngine.breakoutScore(BARS);
  assert.ok(s !== null, 'Should return a value');
  assert.ok(s >= 0 && s <= 100, `Out of range: ${s}`);
});

await test('reversalScore returns 0-100', () => {
  const s = patternEngine.reversalScore(BARS_DOWN);
  assert.ok(s !== null);
  assert.ok(s >= 0 && s <= 100, `Out of range: ${s}`);
});

await test('squeezeScore returns 0-100', () => {
  // Create flat bars for squeeze
  const flat = syntheticBars(60, 0);
  const s = patternEngine.squeezeScore(flat);
  assert.ok(s !== null);
  assert.ok(s >= 0 && s <= 100);
});

await test('volAcceleration returns ratio', () => {
  const v = patternEngine.volAcceleration(BARS);
  assert.ok(v !== null);
  assert.ok(v > 0, `Expected positive ratio, got ${v}`);
});

await test('rollingVwap returns price-level value', () => {
  const vwap = patternEngine.rollingVwap(BARS, 10);
  const last = BARS[BARS.length - 1].close;
  assert.ok(vwap !== null);
  assert.ok(Math.abs(vwap - last) / last < 0.1, `VWAP ${vwap} too far from price ${last}`);
});

await test('detectDoubleTop returns shape', () => {
  const r = patternEngine.detectDoubleTop(BARS);
  assert.ok(typeof r.detected === 'boolean');
  assert.ok(typeof r.score === 'number');
});

await test('detectDoubleBottom returns shape', () => {
  const r = patternEngine.detectDoubleBottom(BARS_DOWN);
  assert.ok(typeof r.detected === 'boolean');
  assert.ok(r.score >= 0 && r.score <= 100);
});

await test('detectBreakout returns shape', () => {
  const r = patternEngine.detectBreakout(BARS);
  assert.ok(typeof r.detected === 'boolean');
  assert.ok('level' in r && 'volumeRatio' in r);
});

await test('enrichBars returns all expected fields', () => {
  const e = patternEngine.enrichBars(BARS, { price: BARS[BARS.length - 1].close });
  assert.ok('breakoutScore'  in e, 'Missing breakoutScore');
  assert.ok('reversalScore'  in e, 'Missing reversalScore');
  assert.ok('squeezeScore'   in e, 'Missing squeezeScore');
  assert.ok('volAccel'       in e, 'Missing volAccel');
  assert.ok('vwap'           in e, 'Missing vwap');
  assert.ok('distVwap'       in e, 'Missing distVwap');
  assert.ok('patterns'       in e, 'Missing patterns');
  assert.ok('enrichedAt'     in e, 'Missing enrichedAt');
  assert.ok(Array.isArray(e.patterns));
});

await test('enrichBars scores are in 0-100 range', () => {
  const e = patternEngine.enrichBars(BARS);
  for (const field of ['breakoutScore','reversalScore','squeezeScore']) {
    const v = e[field];
    if (v !== null) assert.ok(v >= 0 && v <= 100, `${field}=${v} out of range`);
  }
});

// ─── Tick Enricher ────────────────────────────────────────────────────────────

section('Tick Enricher (lib/tick-enricher.js)');

await test('status() returns expected shape', () => {
  const s = tickEnricher.status();
  assert.ok(typeof s.trackedCount  === 'number');
  assert.ok(typeof s.enrichedCount === 'number');
  assert.ok(Array.isArray(s.trackedTickers));
  assert.ok(Array.isArray(s.recentErrors));
});

await test('track() and getEnrichment() (live — fetches bars)', async () => {
  tickEnricher.track('SPY');
  await tickEnricher.runNow();
  const e = tickEnricher.getEnrichment('SPY');
  // After runNow, SPY should be enriched (has 2y of bars)
  assert.ok('breakoutScore' in e, `SPY not enriched: ${JSON.stringify(e)}`);
  assert.ok(e.breakoutScore >= 0 && e.breakoutScore <= 100);
});

await test('alert tick() uses enriched pattern scores', async () => {
  // Create an alert on breakoutScore
  const a = alertEngine.createAlert({
    ticker:   'SPY',
    name:     'SPY breakout',
    when:     'breakout_score > 0',  // should always be true for SPY
    channels: [],
    throttle: 0,
  });
  const spyEnrich = tickEnricher.getEnrichment('SPY');
  const q = { price: 500, changePct: 0.5, rvol: 1.2, ...spyEnrich };
  const quotes = new Map([['SPY', q]]);
  const triggered = await alertEngine.tick(quotes, new Map());
  assert.ok(triggered.some(ev => ev.alertId === a.id), 'Alert on breakout_score should fire when score > 0');
  alertEngine.deleteAlert(a.id);
});

// ─── Yahoo WebSocket ──────────────────────────────────────────────────────────

section('Yahoo WebSocket (lib/yahoo-ws.js)');

await test('status() returns expected shape before connect', () => {
  const s = yahooWS.status();
  assert.ok('connected' in s);
  assert.ok(Array.isArray(s.subscriptions));
  assert.ok('quotesLive' in s);
  assert.ok('stats' in s);
});

await test('connect + subscribe + disconnect (live)', async () => {
  yahooWS.subscribe(['AAPL', 'MSFT']);
  // Give 3 seconds to connect and receive at least one quote
  await new Promise(r => setTimeout(r, 3000));
  const s = yahooWS.status();
  assert.ok(s.subscriptions.includes('AAPL'));
  // We may or may not have received quotes depending on Yahoo availability
  // Just check it did not throw and connection was attempted
  assert.ok(s.stats.reconnects >= 0);
  yahooWS.disconnect();
  await new Promise(r => setTimeout(r, 200));
  assert.ok(!yahooWS.isConnected(), 'Should be disconnected after disconnect()');
});

// ─── 9. Bars Worker ───────────────────────────────────────────────────────────

section('Bars Worker (lib/bars-worker.js)');

await test('status() returns expected shape', () => {
  const s = barsWorker.status();
  assert.ok('running' in s);
  assert.ok('lastRun' in s);
  assert.ok('duckdbAvailable' in s);
  assert.ok('parquetDir' in s);
  assert.ok('storage' in s);
});

await test('runNow() completes without throwing', async () => {
  await barsWorker.runNow();  // will attempt cleanup + maybe Parquet export
  const s = barsWorker.status();
  assert.ok(s.lastRun !== null);
});

// ─── 9. Regime detection ─────────────────────────────────────────────────────

section('Regime detection (lib/regime.js)');

await test('detect() returns regime string', async () => {
  const r = await regime.detect();
  const valid = ['RISK-ON','EARLY RISK-ON','NEUTRAL','EARLY RISK-OFF','RISK-OFF'];
  assert.ok(valid.includes(r?.regime), `Unexpected regime: ${r?.regime}`);
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('Some tests failed. See above for details.');
  process.exit(1);
} else {
  console.log('All tests passed.');
}
