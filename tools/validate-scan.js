#!/usr/bin/env node
'use strict';

/**
 * validate-scan.js — pre-publish gate for scanner output
 *
 * Reads data/scanner-filters.json (hard rules) and asserts a scanner's
 * signals.json complies. Exits non-zero on violation. Wired into
 * publish-daily-card.sh BEFORE add_card.js so a non-compliant scan
 * never ships.
 *
 * Usage:
 *   node tools/validate-scan.js scanner/YYYYMMDD/
 *   node tools/validate-scan.js scanner/YYYYMMDD/signals.json
 *   node tools/validate-scan.js scanner/YYYYMMDD/index.html  (HTML fallback via parser)
 */

const fs = require('fs');
const path = require('path');
const parser = require('./lib/scanner-parser');

const ROOT = path.join(__dirname, '..');
const FILTERS_FILE = path.join(ROOT, 'data', 'scanner-filters.json');

function loadFilters() {
  return JSON.parse(fs.readFileSync(FILTERS_FILE, 'utf8'));
}

function loadScanSignals(arg) {
  // arg can be: scanner/YYYYMMDD/, scanner/YYYYMMDD/signals.json, scanner/YYYYMMDD/index.html
  const abs = path.resolve(ROOT, arg);
  // Path traversal guard — reject anything that escapes ROOT
  const rootWithSep = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
  if (!abs.startsWith(rootWithSep) && abs !== ROOT) {
    throw new Error(`Path traversal detected: ${arg} resolves outside ${ROOT}`);
  }
  let dir = abs;
  if (fs.statSync(abs).isFile()) dir = path.dirname(abs);

  const dirName = path.basename(dir);
  const loaded = parser.loadSignals(dirName);
  if (!loaded || !loaded.signals.length) {
    throw new Error(`No signals found in ${dir}`);
  }
  return { dir, dirName, signals: loaded.signals, regime: loaded.regime || null };
}

function loadOpenPositions() {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'scanner-positions.json'), 'utf8'));
    return new Set((j.open_positions || []).map(p => String(p.ticker).toUpperCase()));
  } catch { return new Set(); }
}

function fail(violations) {
  console.error('\n❌ Scan validation FAILED — do NOT publish.\n');
  violations.forEach((v, i) => console.error(`  ${i + 1}. [${v.rule}] ${v.message}`));
  console.error(`\nTotal violations: ${violations.length}`);
  console.error('Fix scanner/YYYYMMDD/signals.json (or regenerate the scan), then re-run.\n');
  process.exit(1);
}

function ok(scanRef, signalCount) {
  console.log(`\n✅ Scan validation PASSED — ${signalCount} signals in ${scanRef}\n`);
}

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node tools/validate-scan.js <scanner/YYYYMMDD/ or signals.json or index.html>');
    process.exit(2);
  }

  const filters = loadFilters();
  const { dir, dirName, signals, regime } = loadScanSignals(arg);
  const openPositions = loadOpenPositions();

  const violations = [];

  // 1. Scan size
  if (filters.scan_size && filters.scan_size.exact && signals.length !== filters.scan_size.exact) {
    violations.push({
      rule: 'scan_size',
      message: `Expected exactly ${filters.scan_size.exact} signals, got ${signals.length}.`
    });
  }

  // 2. Regime label whitelist
  if (regime && filters.regime_labels?.allowed) {
    const r = String(regime).toUpperCase().trim();
    if (!filters.regime_labels.allowed.includes(r)) {
      violations.push({
        rule: 'regime_labels',
        message: `Regime "${regime}" not in allowed set: ${filters.regime_labels.allowed.join(', ')}`
      });
    }
  }

  // 3. Strategy whitelist + blacklist
  const allowedStrats = new Set(filters.strategies?.allowed || []);
  const forbiddenStrats = new Set(filters.strategies?.forbidden || []);
  for (const s of signals) {
    const strat = (s.strategy || '').trim();
    if (!strat) continue;
    if (forbiddenStrats.has(strat)) {
      violations.push({
        rule: 'strategies.forbidden',
        message: `${s.ticker}: strategy "${strat}" is forbidden (use Momentum/Pre-Squeeze/Breakout/Pullback).`
      });
    } else if (allowedStrats.size > 0 && !allowedStrats.has(strat)) {
      violations.push({
        rule: 'strategies.allowed',
        message: `${s.ticker}: strategy "${strat}" not in whitelist [${[...allowedStrats].join(', ')}].`
      });
    }
  }

  // 4. Anti-duplicate vs open positions
  if (filters.anti_duplicate?.behavior === 'disqualify') {
    for (const s of signals) {
      const t = String(s.ticker).toUpperCase();
      if (openPositions.has(t)) {
        violations.push({
          rule: 'anti_duplicate',
          message: `${s.ticker}: already in open_positions — never enter a 2nd position on the same ticker.`
        });
      }
    }
  }

  // 5. Stops sanity (min/max pct from entry)
  if (filters.stops) {
    const minPct = filters.stops.min_pct_from_entry;
    const maxPct = filters.stops.max_pct_from_entry;
    for (const s of signals) {
      if (typeof s.entry !== 'number' || typeof s.stop !== 'number') continue;
      const pct = Math.abs((s.entry - s.stop) / s.entry) * 100;
      if (minPct != null && pct < minPct) {
        violations.push({
          rule: 'stops.min_pct',
          message: `${s.ticker}: stop only ${pct.toFixed(2)}% from entry (min ${minPct}%) — too tight, will trigger intraday.`
        });
      }
      if (maxPct != null && pct > maxPct) {
        violations.push({
          rule: 'stops.max_pct',
          message: `${s.ticker}: stop ${pct.toFixed(2)}% from entry (max ${maxPct}%) — too loose, breaks R/R math.`
        });
      }
    }
  }

  // 6. Risk overlay — sector concentration cap (max_per_sector)
  if (filters.diversification?.max_per_sector) {
    const SECTOR_MAP = {
      // Financials
      JPM:'Financials', GS:'Financials', MS:'Financials', BAC:'Financials', C:'Financials', WFC:'Financials', XLF:'Financials', V:'Financials', MA:'Financials',
      // Tech
      AAPL:'Tech', MSFT:'Tech', NVDA:'Tech', AMD:'Tech', INTC:'Tech', ASML:'Tech', TSM:'Tech', AVGO:'Tech', CRM:'Tech', ORCL:'Tech', SAP:'Tech', ADBE:'Tech', XLK:'Tech', SMH:'Tech',
      // Consumer/Comm
      AMZN:'Consumer', GOOGL:'Comm', META:'Comm', NFLX:'Comm', DIS:'Comm', TSLA:'Consumer', XLY:'Consumer', XLC:'Comm',
      // Healthcare
      UNH:'Healthcare', JNJ:'Healthcare', LLY:'Healthcare', MRK:'Healthcare', PFE:'Healthcare', ABBV:'Healthcare', XLV:'Healthcare',
      // Energy
      XOM:'Energy', CVX:'Energy', COP:'Energy', OXY:'Energy', EOG:'Energy', SLB:'Energy', XLE:'Energy', USO:'Energy',
      // Industrials/Defense
      BA:'Industrials', CAT:'Industrials', HON:'Industrials', GE:'Industrials', LMT:'Defense', NOC:'Defense', RTX:'Defense', GD:'Defense', XLI:'Industrials',
      // Materials
      FCX:'Materials', NEM:'Materials', XLB:'Materials', GLD:'Materials', SLV:'Materials', GDX:'Materials',
      // Staples/Utilities
      KO:'Staples', PEP:'Staples', WMT:'Staples', XLP:'Staples', XLU:'Utilities',
      // Bonds (blocked for sharia)
      TLT:'Bonds', HYG:'Bonds', LQD:'Bonds',
    };
    const sectorCount = {};
    for (const s of signals) {
      const sect = SECTOR_MAP[String(s.ticker).toUpperCase()] || 'Other';
      sectorCount[sect] = (sectorCount[sect] || 0) + 1;
    }
    const cap = filters.diversification.max_per_sector;
    // Cap 'Other' too — unknown tickers shouldn't be a concentration backdoor
    for (const [sect, n] of Object.entries(sectorCount)) {
      if (n > cap) {
        violations.push({
          rule: 'diversification.max_per_sector',
          message: `Sector "${sect}" has ${n} setups (max ${cap})${sect === 'Other' ? ' — add to SECTOR_MAP if this is a real sector' : ''} — concentration risk.`
        });
      }
    }
  }

  // 7. Sharia ETF tag honesty (don't block — ensure tag matches blocklist)
  const blockedEtfs = new Set(filters.sharia?.blocked_etf_examples || []);
  for (const s of signals) {
    if (blockedEtfs.has(String(s.ticker).toUpperCase()) && s.sharia === true) {
      violations.push({
        rule: 'sharia.blocked_etf',
        message: `${s.ticker}: marked sharia=true but is in blocked_etf_examples (bond/leveraged/inverse ETF).`
      });
    }
  }

  if (violations.length) fail(violations);
  ok(dirName, signals.length);
}

if (require.main === module) main();

module.exports = { loadFilters, loadScanSignals };
