'use strict';
// Port of systematic-tss/internal/ohlcv/bvc.go + staticdata/bvc.go
// Fetches OHLCV data from Casablanca Bourse (BVC) API — no Yahoo dependency.

const https = require('https');
const fs = require('fs');
const path = require('path');

const BVC_API = 'https://api.casablanca-bourse.com/fr/api/bourse_data';
const CACHE_DIR = path.join(__dirname, '..', '..', 'data', '.price-cache');

// BVC uses self-signed/incomplete cert chain
const agent = new https.Agent({ rejectUnauthorized: false });

function bvcGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { agent, headers: { 'Accept': 'application/vnd.api+json', 'User-Agent': 'Mozilla/5.0' }, timeout: 30000 }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`BVC API ${res.statusCode}: ${data.slice(0, 200)}`));
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('BVC timeout')); });
  });
}

async function loadInstruments() {
  const cacheFile = path.join(CACHE_DIR, '_bvc_instruments.json');
  if (fs.existsSync(cacheFile)) {
    const age = (Date.now() - fs.statSync(cacheFile).mtimeMs) / 3600000;
    if (age < 24) {
      try { return JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch {}
    }
  }

  const instruments = {};
  let url = `${BVC_API}/instrument?fields[instrument]=drupal_internal__id,symbol,codeISIN&page[limit]=200`;
  let page = 0;

  while (url && page < 5) {
    page++;
    const result = await bvcGet(url);
    for (const rec of result.data || []) {
      const a = rec.attributes;
      if (a.symbol && a.drupal_internal__id) {
        instruments[a.symbol] = { id: a.drupal_internal__id, isin: a.codeISIN || '' };
      }
    }
    url = result.links?.next?.href || '';
    if (url) await new Promise(r => setTimeout(r, 200));
  }

  if (Object.keys(instruments).length > 0) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(instruments, null, 2));
  }
  return instruments;
}

function parseFloat2(raw) {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') return parseFloat(raw) || 0;
  return 0;
}

async function fetchOHLCV(symbol, instrumentID) {
  // Check cache first
  const cached = path.join(CACHE_DIR, `${symbol}_ohlcv.json`);
  if (fs.existsSync(cached)) {
    const age = (Date.now() - fs.statSync(cached).mtimeMs) / 3600000;
    if (age < 12) {
      try {
        const bars = JSON.parse(fs.readFileSync(cached, 'utf8'));
        if (bars.length >= 60) return bars;
      } catch {}
    }
  }

  const baseUrl = `${BVC_API}/instrument_history?` +
    `fields%5Binstrument_history%5D=drupal_internal__id,coursCourant,cumulVolumeEchange,created,lowPrice,highPrice,openingPrice,closingPrice,ratioConsolide` +
    `&sort%5Bdate-seance%5D%5Bdirection%5D=ASC` +
    `&sort%5Bdate-seance%5D%5Bpath%5D=created` +
    `&filter%5Binstrument%5D%5Bcondition%5D%5Bpath%5D=symbol.meta.drupal_internal__target_id` +
    `&filter%5Binstrument%5D%5Bcondition%5D%5Bvalue%5D=${instrumentID}` +
    `&filter%5Binstrument%5D%5Bcondition%5D%5Boperator%5D=%3D` +
    `&page%5Blimit%5D=5000`;

  const bars = [];
  let url = baseUrl;
  let page = 0;

  while (url && page < 10) {
    page++;
    const result = await bvcGet(url);
    for (const rec of result.data || []) {
      const a = rec.attributes;
      if (!a.created) continue;
      const date = a.created.slice(0, 10);
      let close = parseFloat2(a.closingPrice);
      if (!close) close = parseFloat2(a.coursCourant);
      if (!close) continue;
      const open = parseFloat2(a.openingPrice) || close;
      const high = parseFloat2(a.highPrice) || close;
      const low = parseFloat2(a.lowPrice) || close;
      const volume = parseFloat2(a.cumulVolumeEchange);
      bars.push({ date, open, high, low, close, volume });
    }
    url = result.links?.next?.href || '';
    if (url) await new Promise(r => setTimeout(r, 200));
  }

  bars.sort((a, b) => a.date.localeCompare(b.date));

  if (bars.length >= 60) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(cached, JSON.stringify(bars));
  }
  return bars.length >= 60 ? bars : null;
}

async function batchFetchBVC(concurrency = 5) {
  const instruments = await loadInstruments();
  const symbols = Object.keys(instruments);
  console.log(`📊 BVC: ${symbols.length} instruments from Casablanca Bourse`);

  const results = new Map();
  const queue = [...symbols];
  let done = 0;

  async function worker() {
    while (queue.length) {
      const s = queue.shift();
      const bars = await fetchOHLCV(s, instruments[s].id).catch(() => null);
      if (bars) results.set(s, bars);
      done++;
      if (done % 10 === 0) process.stderr.write(`  BVC: ${done}/${symbols.length} (${results.size} valid)\r`);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  process.stderr.write(`  BVC: ${done}/${symbols.length} (${results.size} valid)\n`);
  return results;
}

module.exports = { loadInstruments, fetchOHLCV, batchFetchBVC };
