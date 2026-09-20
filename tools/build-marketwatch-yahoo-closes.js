#!/usr/bin/env node
'use strict';

const fs = require('fs');
const https = require('https');
const path = require('path');

const DEFAULT_ROOT = path.resolve(__dirname, '..');
// Yahoo rejects spark requests containing more than 20 symbols.
const BATCH_SIZE = 20;

function marketFor(id, ticker, name) {
  const symbolId = String(id || '').toUpperCase(), symbol = String(ticker || '').toUpperCase();
  if (/_US_/.test(symbolId)) return 'US';
  if (/_JP_|_HK_|_AU_|_SG_|6857/.test(symbolId)) return 'APAC';
  if (/^#|XAU|XAG|EURUSD/.test(symbolId) || /^(USA500|CRUDE)$/.test(symbol)) return 'MACRO';
  if (symbolId.includes('_CRYPTO') || /^(BTC|ETH|SOL|XRP)(?:[/-](?:USD|EUR))?$/.test(symbol)) return 'CRYPTO';
  return 'EU';
}

function yahooSymbol(asset) {
  const id = String(asset.id || '').toUpperCase();
  const ticker = String(asset.ticker || '').toUpperCase();
  if (asset.market === 'CRYPTO') {
    const base = ticker.match(/^(BTC|ETH|SOL|XRP)/)?.[1] || id.match(/^(BTC|ETH|SOL|XRP)/)?.[1];
    if (base) return `${base}-USD`;
  }
  if (asset.market === 'MACRO') {
    if (/XAU|GOLD/.test(`${id} ${ticker}`)) return 'GC=F';
    if (/XAG|SILVER/.test(`${id} ${ticker}`)) return 'SI=F';
    if (/BRENT/.test(`${id} ${ticker}`)) return 'BZ=F';
    if (/CRUDE|OIL/.test(`${id} ${ticker}`)) return 'CL=F';
    if (/EURUSD|EURO \/ US DOLLAR/.test(`${id} ${ticker}`)) return 'EURUSD=X';
    if (/USA500|SPX/.test(`${id} ${ticker}`)) return '^GSPC';
    if (/VIX|VOLX/.test(`${id} ${ticker}`)) return '^VIX';
  }
  if (asset.market === 'US') return asset.ticker.replace(/\./g, '-');
  if (/_JP_/.test(id) || /^\d{4}$/.test(asset.ticker)) return `${asset.ticker}.T`;
  if (/_CA_/.test(id)) return `${asset.ticker}.TO`;
  if (/_FR_|P_EQ$/.test(id)) return `${asset.ticker}.PA`;
  if (/_DE_|D_EQ$/.test(id)) return `${asset.ticker}.DE`;
  if (/_GB_|L_EQ$/.test(id)) return `${asset.ticker}.L`;
  if (/_NL_/.test(id)) return `${asset.ticker}.AS`;
  if (/_IT_|M_EQ$/.test(id)) return `${asset.ticker}.MI`;
  return asset.ticker;
}

function universeSymbols(root) {
  const [lists, rawAssets] = JSON.parse(fs.readFileSync(path.join(root, 'marketwatch/data/watchlists.json'), 'utf8'));
  const excluded = new Set(['Les meilleurs mouvements', 'Plus empruntées', 'Ma Liste de surveillance']);
  const included = new Set(lists.filter(([name]) => !excluded.has(name)).flatMap(([, indexes]) => indexes));
  const assets = rawAssets.filter((_, index) => included.has(index)).map(([id, ticker, name]) => ({ id, ticker, name, market:marketFor(id, ticker, name) }));
  const autoFile = path.join(root, 'marketwatch/data/auto-universe.json');
  if (fs.existsSync(autoFile)) assets.push(...JSON.parse(fs.readFileSync(autoFile, 'utf8')).assets);
  return [...new Set(assets.map(asset => yahooSymbol(asset)).filter(Boolean))].sort();
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers:{ 'User-Agent':'Mozilla/5.0', Accept:'application/json' }, timeout:20000 }, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode !== 200) return reject(new Error(`Yahoo HTTP ${response.statusCode}`));
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    });
    request.on('timeout', () => request.destroy(new Error('Yahoo timeout')));
    request.on('error', reject);
  });
}

function sessionDate(timestamp) {
  if (!Number.isFinite(timestamp)) return null;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone:'America/New_York', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date(timestamp * 1000));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function closeFromSpark(row) {
  const closes = Array.isArray(row?.close) ? row.close : [];
  const timestamps = Array.isArray(row?.timestamp) ? row.timestamp : [];
  const valid = closes.map((value, index) => ({ value:value == null ? NaN : Number(value), timestamp:Number(timestamps[index]) })).filter(item => Number.isFinite(item.value) && item.value > 0);
  if (!valid.length) return null;
  const latest = valid.at(-1), previous = valid.length > 1 ? valid.at(-2).value : Number(row.chartPreviousClose);
  return {
    price: latest.value,
    previousClose: Number.isFinite(previous) && previous > 0 ? previous : null,
    change: Number.isFinite(previous) && previous > 0 ? (latest.value / previous - 1) * 100 : null,
    sessionDate: sessionDate(latest.timestamp)
  };
}

async function fetchBatch(symbols, attempt = 0) {
  const encoded = encodeURIComponent(symbols.join(','));
  try {
    return await getJson(`https://query2.finance.yahoo.com/v8/finance/spark?symbols=${encoded}&range=5d&interval=1d`);
  } catch (error) {
    if (attempt >= 2) throw error;
    await new Promise(resolve => setTimeout(resolve, 800 * (attempt + 1)));
    return fetchBatch(symbols, attempt + 1);
  }
}

async function buildYahooCloses(root = DEFAULT_ROOT) {
  const symbols = universeSymbols(root), quotes = {}, failures = [];
  for (let index = 0; index < symbols.length; index += BATCH_SIZE) {
    const batch = symbols.slice(index, index + BATCH_SIZE);
    try {
      const payload = await fetchBatch(batch);
      for (const symbol of batch) {
        const quote = closeFromSpark(payload?.[symbol]);
        if (quote) quotes[symbol] = quote; else failures.push(symbol);
      }
    } catch { failures.push(...batch); }
  }
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: 'Yahoo Finance spark v8',
    requested: symbols.length,
    covered: Object.keys(quotes).length,
    failures,
    quotes
  };
}

async function main() {
  const args = process.argv.slice(2), valueAfter = flag => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : null; };
  const root = path.resolve(valueAfter('--root') || DEFAULT_ROOT);
  const output = path.resolve(valueAfter('--output') || path.join(root, 'marketwatch/data/yahoo-closes.json'));
  const previous = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output, 'utf8')) : { quotes:{} };
  const fresh = await buildYahooCloses(root);
  const retained = Object.fromEntries(Object.entries(previous.quotes || {}).filter(([, quote]) => Number.isFinite(quote?.price) && quote.price > 0));
  fresh.quotes = { ...retained, ...fresh.quotes };
  fresh.retained = Object.keys(fresh.quotes).length - fresh.covered;
  fs.writeFileSync(output, `${JSON.stringify(fresh, null, 2)}\n`);
  console.log(`Yahoo closes: ${fresh.covered}/${fresh.requested} refreshed, ${fresh.retained} retained → ${output}`);
  if (fresh.covered < Math.max(1, Math.floor(fresh.requested * 0.6))) process.exitCode = 1;
}

module.exports = { buildYahooCloses, closeFromSpark, marketFor, sessionDate, universeSymbols, yahooSymbol };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
