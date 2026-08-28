#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
};
const input = arg('--in');
const output = arg('--out');
if (!input || !output) {
  console.error('Usage: extract-eu-fallback-universe.js --in eu_referential.json --out vars.json');
  process.exit(2);
}

function csvRow(line) {
  const fields = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      fields.push(value); value = '';
    } else value += ch;
  }
  fields.push(value);
  return fields;
}

const nativeCountries = new Set([
  'Austria', 'Belgium', 'Denmark', 'Finland', 'France', 'Germany', 'Ireland', 'Italy',
  'Luxembourg', 'Netherlands', 'Norway', 'Poland', 'Portugal', 'Spain', 'Sweden',
  'Switzerland', 'United Kingdom'
]);
const preferredSuffix = /\.(AS|BR|CO|DE|HE|IR|L|LS|MC|MI|OL|PA|ST|SW|VI|WA)$/;
const homeSuffix = {
  Austria: '.VI', Belgium: '.BR', Denmark: '.CO', Finland: '.HE', France: '.PA',
  Germany: '.DE', Ireland: '.IR', Italy: '.MI', Netherlands: '.AS', Norway: '.OL',
  Poland: '.WA', Portugal: '.LS', Spain: '.MC', Sweden: '.ST', Switzerland: '.SW',
  'United Kingdom': '.L'
};
const raw = JSON.parse(fs.readFileSync(input, 'utf8'));
const csv = (raw.data?.items || []).map(item => item.data).find(Array.isArray);
if (!csv || csv.length < 2) throw new Error('EU referential payload has no CSV rows');

const headers = csvRow(csv[0]);
const rows = csv.slice(1).map(line => {
  const fields = csvRow(line);
  return Object.fromEntries(headers.map((h, i) => [h, fields[i] || '']));
})
  .filter(r => nativeCountries.has(r.country))
  .filter(r => preferredSuffix.test(r.symbol))
  .filter(r => !/^\d/.test(r.symbol))
  .filter(r => Number(r.market_cap) >= 1e9);

const byName = new Map();
for (const row of rows) {
  const key = row.name.trim().toLowerCase();
  if (!key) continue;
  const prior = byName.get(key);
  const suffix = homeSuffix[row.country];
  const isHome = suffix && row.symbol.endsWith(suffix);
  const priorIsHome = prior && suffix && prior.symbol.endsWith(suffix);
  if (!prior || (isHome && !priorIsHome)) byName.set(key, row);
}
const symbols = [...byName.values()]
  .sort((a, b) => Number(b.market_cap) - Number(a.market_cap))
  .slice(0, 60)
  .map(row => row.symbol.toUpperCase());
if (symbols.length < 24) throw new Error(`EU fallback universe too small: ${symbols.length}`);

const vars = { eu_symbols: symbols.join(','), eu_count: String(symbols.length) };
for (let i = 0; i < 5; i++) vars[`batch${i + 1}`] = symbols.slice(i * 12, (i + 1) * 12).join(',');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(vars, null, 2));
console.log(`[eu-fallback] ${symbols.length} native EU names selected from referential`);
