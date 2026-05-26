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
const { recentDilutionFilings } = require('./pre-scan-filter');

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
  return { dir, dirName, signals: loaded.signals, tklPool: loaded.tklPool || [], regime: loaded.regime || null };
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

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node tools/validate-scan.js <scanner/YYYYMMDD/ or signals.json or index.html>');
    process.exit(2);
  }
  const skipEdgar = process.argv.includes('--skip-edgar');

  const filters = loadFilters();
  const { dir, dirName, signals, tklPool, regime } = loadScanSignals(arg);
  const openPositions = loadOpenPositions();

  const violations = [];
  const advisoriesFromEdgar = [];

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
    // SECTOR_MAP now lives in scanner-filters.json (source of truth). Fallback to empty map.
    const SECTOR_MAP = filters.diversification.sector_map || {};
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

  // ── TKL POOL HARD CHECKS ──────────────────────────────────────────────────
  // TKL pool gets the same strategy + stops checks as top 10.
  for (const s of tklPool) {
    const strat = (s.strategy || '').trim();
    if (strat && forbiddenStrats.has(strat)) {
      violations.push({
        rule: 'tkl.strategies.forbidden',
        message: `TKL ${s.ticker}: strategy "${strat}" is forbidden.`
      });
    }
    if (typeof s.entry === 'number' && typeof s.stop === 'number' && filters.stops) {
      const pct = Math.abs((s.entry - s.stop) / s.entry) * 100;
      if (filters.stops.min_pct_from_entry != null && pct < filters.stops.min_pct_from_entry) {
        violations.push({
          rule: 'tkl.stops.min_pct',
          message: `TKL ${s.ticker}: stop ${pct.toFixed(2)}% from entry (min ${filters.stops.min_pct_from_entry}%).`
        });
      }
    }
    if (openPositions.has(String(s.ticker).toUpperCase())) {
      violations.push({
        rule: 'tkl.anti_duplicate',
        message: `TKL ${s.ticker}: already in open_positions.`
      });
    }
  }

  // ── SEC EDGAR DILUTION CHECK (TKL pool — hard block) ─────────────────────
  // MCP flags don't surface 424B5/S-3 as dilution signals. Cross-reference
  // SEC EDGAR directly for recent prospectus supplements on all TKL tickers.
  // Top 10 checked as advisory (Claude already ran MCP anti-dilution v2).
  if (!skipEdgar && (tklPool.length > 0 || signals.length > 0)) {
    console.log('  Checking SEC EDGAR for recent dilution filings...');
    const allTickers = [
      ...tklPool.map(s => ({ ticker: s.ticker, pool: 'tkl' })),
      ...signals.map(s => ({ ticker: s.ticker, pool: 'top10' })),
    ];
    for (const { ticker, pool } of allTickers) {
      try {
        const edgar = await recentDilutionFilings(ticker, filters);
        if (edgar.hits.length > 0) {
          const detail = edgar.hits.map(h => `${h.form} (${h.ageDays}d ago)`).join(', ');
          if (pool === 'tkl') {
            violations.push({
              rule: 'tkl.edgar_dilution',
              message: `TKL ${ticker}: recent SEC dilution filings — ${detail}. Remove from tkl_pool.`
            });
          } else {
            // Top 10 = advisory (Claude did MCP check; EDGAR is a safety net)
            advisoriesFromEdgar.push(`${ticker}: SEC EDGAR found ${detail} — verify dilution_clear [edgar_dilution]`);
          }
        }
      } catch { /* SEC EDGAR down — non-fatal, skip */ }
    }
  } else if (skipEdgar) {
    console.log('  Skipping SEC EDGAR dilution check (--skip-edgar).');
  }

  // ── ADVISORY CHECKS (warnings only, do NOT block publish) ─────────────────
  // Lessons from scanner-lessons.json are SELECTION-TIME inputs at /scanner Phase 2.
  // validate-scan.js only blocks gross errors (strategy whitelist, sector cap, stops abs %).
  // The advisory section below surfaces lesson-rule deviations so Claude can iterate at
  // selection time — but a passing scan with warnings still publishes.
  const advisories = [];

  // R/R minimum by regime (advisory)
  const RR_MIN_BY_REGIME = {
    'RISK-ON': 1.5, 'RECOVERY': 1.7, 'NEUTRAL': 1.7,
    'EARLY RISK-OFF': 2.0, 'RISK-OFF': 2.0
  };
  if (regime) {
    const rrMin = RR_MIN_BY_REGIME[String(regime).toUpperCase().trim()] || 1.5;
    for (const s of signals) {
      if (!s.rr) continue;
      const m = String(s.rr).match(/1:(\d+\.?\d*)/);
      if (!m) continue;
      const ratio = parseFloat(m[1]);
      if (ratio < rrMin) advisories.push(`${s.ticker}: R/R 1:${ratio} < regime min 1:${rrMin} (${regime}) [rr_min_by_regime]`);
    }
  }

  // Stop ATR multiple (advisory)
  if (filters.stops?.min_atr_multiple) {
    const minMult = filters.stops.min_atr_multiple;
    for (const s of signals) {
      if (typeof s.extension?.atr !== 'number' || !s.entry || !s.stop || s.extension.atr <= 0) continue;
      const r = Math.abs(s.entry - s.stop) / s.extension.atr;
      if (r < minMult) advisories.push(`${s.ticker}: stop ${r.toFixed(2)}× ATR (recommend ≥${minMult}×) [stops_atr_multiple]`);
    }
  }

  // RSI overextension (advisory)
  const maxRsi = filters.overextension?.max_rsi14_daily;
  if (maxRsi) for (const s of signals) {
    if (typeof s.extension?.rsi === 'number' && s.extension.rsi > maxRsi)
      advisories.push(`${s.ticker}: RSI ${s.extension.rsi.toFixed(1)} > ${maxRsi} (parabolic risk) [overextension_rsi]`);
  }

  // Distance 50-DMA by strategy (advisory)
  const maxByStrat = filters.overextension?.max_distance_50dma_pct_by_strategy;
  if (maxByStrat) for (const s of signals) {
    if (typeof s.extension?.distance_50dma_pct !== 'number') continue;
    const cap = maxByStrat[s.strategy]; if (cap == null) continue;
    if (s.extension.distance_50dma_pct > cap)
      advisories.push(`${s.ticker}: ${s.extension.distance_50dma_pct.toFixed(1)}% above 50-DMA > ${s.strategy} cap ${cap}% [overextension_50dma]`);
  }

  // Earnings + dilution flags (advisory — Claude's selection should set true; only flag if false)
  const allSignals = [...signals, ...tklPool];
  for (const s of allSignals) {
    const prefix = tklPool.includes(s) ? `TKL ${s.ticker}` : s.ticker;
    if (s.earnings_clear === false) advisories.push(`${prefix}: earnings_clear=false (±3d window) [earnings_window]`);
    if (s.dilution_clear === false) advisories.push(`${prefix}: dilution_clear=false [dilution_clear]`);
  }

  // Merge EDGAR-discovered advisories (top 10 only — TKL EDGAR hits are hard blocks above)
  advisories.push(...advisoriesFromEdgar);

  // Diversification floors (advisory — Claude's selection should hit these)
  if (filters.diversification) {
    const counts = { US: 0, EU: 0, APAC: 0, ETF: 0, Other: 0 };
    for (const s of signals) {
      const r = String(s.region || '').toUpperCase().trim();
      if (r === 'US') counts.US++;
      else if (['EU', 'UK', 'FR', 'DE', 'IT', 'ES', 'NL', 'CH'].includes(r)) counts.EU++;
      else if (['ASIA', 'APAC', 'CHINA', 'JAPAN', 'KOREA', 'HK', 'TW'].includes(r)) counts.APAC++;
      else if (r === 'ETF') counts.ETF++;
      else counts.Other++;
    }
    const floors = {
      US: filters.diversification.min_us_count,
      EU: filters.diversification.min_eu_count,
      APAC: filters.diversification.min_apac_count,
      ETF: filters.diversification.min_etf_count
    };
    for (const [region, floor] of Object.entries(floors)) {
      if (floor == null) continue;
      if (counts[region] < floor) advisories.push(`Region "${region}" has ${counts[region]} setups (recommend ≥${floor}) [diversification_floor]`);
    }
  }

  if (advisories.length) {
    console.warn(`\n⚠️  ${advisories.length} advisory note(s) from scanner-lessons.json (non-blocking — selection-time hints):`);
    advisories.forEach((a, i) => console.warn(`  ${i + 1}. ${a}`));
    console.warn('  → Claude should incorporate these at /scanner Phase 2 for the NEXT scan, not block this one.\n');
  }

  if (violations.length) fail(violations);
  ok(dirName, signals.length);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(2); });

module.exports = { loadFilters, loadScanSignals };
