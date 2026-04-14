#!/usr/bin/env node
'use strict';

/**
 * pre-scan-filter.js — optional pre-scan risk filter
 *
 * Takes a list of candidate tickers, queries SEC EDGAR for recent S-3/424B
 * dilution filings, and checks them against scanner-filters.json blocklists.
 * Outputs a JSON report that can be fed into the scanner to EXCLUDE risky tickers
 * before they reach the signals.json stage.
 *
 * Usage:
 *   node tools/pre-scan-filter.js --tickers NVDA,AMD,INDO,MARA
 *   node tools/pre-scan-filter.js --file candidates.txt
 *
 * Output:
 *   data/pre-scan-report-YYYYMMDD.json
 *   { date, safe: [...], blocked: [{ticker, reasons[]}] }
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const FILTERS_FILE = path.join(ROOT, 'data', 'scanner-filters.json');

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : null;
}

function fetchJson(url) {
  return new Promise((resolve) => {
    https.get(url, {
      headers: { 'User-Agent': 'DailyTickers/1.0 contact@dailytickers.com', 'Accept': 'application/json' },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    }).on('error', () => resolve(null)).on('timeout', function () { this.destroy(); resolve(null); });
  });
}

// SEC EDGAR: company tickers → CIK lookup
let _cikMap = null;
async function lookupCIK(ticker) {
  if (!_cikMap) {
    const j = await fetchJson('https://www.sec.gov/files/company_tickers.json');
    if (!j) return null;
    _cikMap = {};
    for (const k of Object.keys(j)) {
      const row = j[k];
      if (row && row.ticker) _cikMap[row.ticker.toUpperCase()] = String(row.cik_str).padStart(10, '0');
    }
  }
  return _cikMap[ticker.toUpperCase()] || null;
}

async function recentDilutionFilings(ticker, filters) {
  const cik = await lookupCIK(ticker);
  if (!cik) return { ticker, cik: null, hits: [] };

  const j = await fetchJson(`https://data.sec.gov/submissions/CIK${cik}.json`);
  if (!j || !j.filings?.recent) return { ticker, cik, hits: [] };

  const forms = j.filings.recent.form || [];
  const dates = j.filings.recent.filingDate || [];
  const maxDays = filters.dilution_blocklist?.max_recent_sec_filing_days || 90;
  const formsToCheck = new Set(filters.dilution_blocklist?.filings_to_check || ['S-1', 'S-3', '424B']);

  const now = Date.now();
  const hits = [];
  for (let i = 0; i < forms.length; i++) {
    const f = String(forms[i] || '');
    const d = String(dates[i] || '');
    if (!d) continue;
    const ageDays = (now - new Date(d).getTime()) / 86400000;
    if (ageDays > maxDays) continue;
    for (const want of formsToCheck) {
      if (f.startsWith(want)) { hits.push({ form: f, date: d, ageDays: Math.round(ageDays) }); break; }
    }
  }
  return { ticker, cik, hits };
}

async function main() {
  const filters = JSON.parse(fs.readFileSync(FILTERS_FILE, 'utf8'));

  let tickers = [];
  const tArg = getArg('--tickers');
  const fArg = getArg('--file');
  if (tArg) tickers = tArg.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  else if (fArg) tickers = fs.readFileSync(fArg, 'utf8').split(/\s+/).map(s => s.trim().toUpperCase()).filter(Boolean);
  else {
    console.error('Usage: node tools/pre-scan-filter.js --tickers AAA,BBB  |  --file candidates.txt');
    process.exit(2);
  }

  const safe = [];
  const blocked = [];
  const blockedEtfs = new Set(filters.sharia?.blocked_etf_examples || []);

  for (const t of tickers) {
    const reasons = [];

    // 1. Hard ETF blocklist (Sharia — bonds/leveraged/inverse)
    if (blockedEtfs.has(t)) reasons.push(`Sharia-blocked ETF (${t} in blocked_etf_examples)`);

    // 2. SEC dilution filing check
    const edgar = await recentDilutionFilings(t, filters);
    if (edgar.hits.length > 0) {
      reasons.push(`Recent SEC filings: ${edgar.hits.map(h => `${h.form}(${h.ageDays}d)`).join(', ')}`);
    }

    if (reasons.length) blocked.push({ ticker: t, reasons });
    else safe.push(t);
  }

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const outPath = path.join(ROOT, 'data', `pre-scan-report-${today}.json`);
  const report = { date: today, safe, blocked, input_count: tickers.length };
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(`\nPre-scan filter report → ${outPath}`);
  console.log(`  Input:   ${tickers.length} tickers`);
  console.log(`  Safe:    ${safe.length}`);
  console.log(`  Blocked: ${blocked.length}`);
  if (blocked.length) {
    console.log('\n  Blocked tickers:');
    blocked.forEach(b => console.log(`    - ${b.ticker}: ${b.reasons.join(' | ')}`));
  }
}

if (require.main === module) main();

module.exports = { recentDilutionFilings, lookupCIK };
