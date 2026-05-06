'use strict';

const fs = require('fs');
const path = require('path');

const INSTRUMENTS_DIR = path.join(__dirname, 'trading-executor', 'instruments');
const OUTPUT = path.join(__dirname, '..', 'data', 'broker-instruments.json');

const BROKER_FILES = {
  alpaca: 'alpaca.json',
  ibkr: 'ibkr.json',
  trading212: 'trading212.json',
  saxo: 'saxo.json',
  binance: 'binance.json',
};

const symbols = {};

for (const [broker, file] of Object.entries(BROKER_FILES)) {
  const fpath = path.join(INSTRUMENTS_DIR, file);
  if (!fs.existsSync(fpath)) { console.warn(`  skip ${broker}: ${file} not found`); continue; }

  const raw = JSON.parse(fs.readFileSync(fpath, 'utf8'));
  const instruments = raw.instruments || [];
  let mapped = 0;

  for (const inst of instruments) {
    const key = inst.internal_symbol;
    if (!key) continue;

    if (!symbols[key]) symbols[key] = { name: inst.name || '', brokers: {} };

    const entry = {
      symbol: inst.broker_symbol,
      exchange: inst.exchange || '',
      tradable: inst.tradable !== false,
      marginable: inst.marginable === true,
      shortable: inst.shortable === true,
      min_order_size: inst.min_order_size || 0,
      price_increment: inst.price_increment || 0.01,
    };

    if (inst.isin) entry.isin = inst.isin;
    if (inst.saxo_uic) entry.uic = inst.saxo_uic;
    if (inst.asset_type) entry.asset_type = inst.asset_type;
    if (inst.currency) entry.currency = inst.currency;

    symbols[key].brokers[broker] = entry;
    if (inst.name && (!symbols[key].name || symbols[key].name.length < inst.name.length)) {
      symbols[key].name = inst.name;
    }
    mapped++;
  }

  console.log(`  ${broker}: ${mapped} instruments mapped`);
}

const output = {
  generated_at: new Date().toISOString(),
  source: 'tools/trading-executor/instruments/',
  brokers: Object.keys(BROKER_FILES),
  symbol_count: Object.keys(symbols).length,
  symbols,
};

fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2));
console.log(`\n✅ ${OUTPUT}: ${output.symbol_count} symbols, ${(fs.statSync(OUTPUT).size / 1024 / 1024).toFixed(1)}MB`);
