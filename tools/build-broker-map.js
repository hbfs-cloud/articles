#!/usr/bin/env node
/**
 * build-broker-map.js — Build reverse broker-instrument lookup
 * Reads all 5 broker instrument files from systematic-tss and produces
 * data/broker-instruments.json: per-symbol list of supporting brokers + their trading params.
 *
 * Usage: node tools/build-broker-map.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TSS_INSTRUMENTS = '/Users/marketwatchxyz/GolandProjects/systematic-tss/data/instruments';
const OUT_PATH = path.join(ROOT, 'data', 'broker-instruments.json');

const BROKER_FILES = ['alpaca', 'ibkr', 'trading212', 'saxo', 'binance'];

// For IBKR: prefer SMART (primary US routing) over exchange-specific listings
const IBKR_PRIMARY_EXCHANGES = new Set(['SMART', 'NASDAQ', 'NYSE', 'ARCA', 'BATS', 'BINANCE']);

function pickIbkrPrimary(entries) {
  // Sort: SMART first, then major US exchanges, rest as alternatives
  const primary = entries.find(e => e.exchange === 'SMART')
    || entries.find(e => IBKR_PRIMARY_EXCHANGES.has(e.exchange))
    || entries[0];
  const alternatives = entries
    .filter(e => e !== primary)
    .map(e => ({
      symbol: e.broker_symbol,
      exchange: e.exchange,
      currency: e.currency || null,
    }));
  return { primary, alternatives };
}

function extractFields(inst) {
  return {
    symbol: inst.broker_symbol,
    exchange: inst.exchange || null,
    tradable: inst.tradable === true,
    marginable: inst.marginable === true,
    shortable: inst.shortable === true,
    min_order_size: inst.min_order_size != null ? inst.min_order_size : null,
    price_increment: inst.price_increment != null ? inst.price_increment : null,
  };
}

// Map: internal_symbol -> { name, brokers: { brokerName: brokerEntry } }
const symbolMap = {};

for (const brokerName of BROKER_FILES) {
  const filePath = path.join(TSS_INSTRUMENTS, `${brokerName}.json`);
  if (!fs.existsSync(filePath)) {
    console.log(`  [warn] ${brokerName}.json not found at ${filePath}, skipping`);
    continue;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const instruments = data.instruments || [];
  console.log(`  [load] ${brokerName}: ${instruments.length} instruments`);

  // Group by internal_symbol (IBKR may have multiple entries per symbol)
  const grouped = {};
  for (const inst of instruments) {
    const sym = inst.internal_symbol;
    if (!sym) continue;
    if (!inst.tradable) continue; // only include tradable instruments
    if (!grouped[sym]) grouped[sym] = [];
    grouped[sym].push(inst);
  }

  for (const [sym, entries] of Object.entries(grouped)) {
    if (!symbolMap[sym]) {
      symbolMap[sym] = { name: entries[0].name || sym, brokers: {} };
    } else if (!symbolMap[sym].name && entries[0].name) {
      symbolMap[sym].name = entries[0].name;
    }

    if (brokerName === 'ibkr' && entries.length > 1) {
      const { primary, alternatives } = pickIbkrPrimary(entries);
      const entry = extractFields(primary);
      if (alternatives.length > 0) entry.alternatives = alternatives;
      symbolMap[sym].brokers[brokerName] = entry;
    } else {
      symbolMap[sym].brokers[brokerName] = extractFields(entries[0]);
    }
  }
}

// Filter: only symbols tradable on at least 1 broker (already enforced above)
// Sort symbols alphabetically for stable diffs
const sortedSymbols = {};
for (const sym of Object.keys(symbolMap).sort()) {
  sortedSymbols[sym] = symbolMap[sym];
}

const output = {
  generated_at: new Date().toISOString(),
  brokers: BROKER_FILES,
  symbol_count: Object.keys(sortedSymbols).length,
  symbols: sortedSymbols,
};

fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
console.log(`\n  [ok] data/broker-instruments.json — ${output.symbol_count} symbols`);
