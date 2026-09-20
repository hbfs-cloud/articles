#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const contract = require('./lib/marketdata-bars-contract');

const ROOT = path.resolve(__dirname, '..');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const arg = name => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; };
const mode = process.argv[2];

function inside(relative, pattern) {
  const absolute = path.resolve(ROOT, relative || '');
  const rel = path.relative(ROOT, absolute).split(path.sep).join('/');
  if (!pattern.test(rel) || !fs.existsSync(absolute) || fs.realpathSync(absolute) !== absolute) {
    throw new Error(`invalid repository path: ${String(relative)}`);
  }
  return { absolute, relative: rel };
}

function resultNodes(value, out = []) {
  if (!value || typeof value !== 'object') return out;
  if (!Array.isArray(value) && Array.isArray(value.cells)) { out.push(value); return out; }
  for (const child of Object.values(value)) resultNodes(child, out);
  return out;
}

function validateManifest(file) {
  const location = inside(file, /^scanner\/\d{8}\/_history-rejections\.json$/);
  const manifest = JSON.parse(fs.readFileSync(location.absolute, 'utf8'));
  if (manifest.schema !== 'scanner-history-rejections.v1') throw new Error('invalid rejection schema');
  const date = location.relative.split('/')[1];
  if (manifest.date !== date || !/^\d{4}-\d{2}-\d{2}$/.test(manifest.refdate)) throw new Error('rejection date mismatch');
  if (!Array.isArray(manifest.sources) || !manifest.sources.length || !Array.isArray(manifest.rejected)) throw new Error('incomplete rejection manifest');
  const seen = new Set();
  for (const item of manifest.rejected) {
    if (!item || !/^[A-Z][A-Z0-9.-]{0,14}$/.test(item.symbol) || seen.has(item.symbol) || !Array.isArray(item.reasons) || !item.reasons.length) {
      throw new Error('invalid rejected symbol record');
    }
    seen.add(item.symbol);
  }
  for (const source of manifest.sources) {
    const sourceFile = inside(source.file, /^scanner\/\d{8}\/_data2\.failed-[^/]+\/bars_b\d+\.json$/);
    if (sha256(fs.readFileSync(sourceFile.absolute)) !== source.sha256) throw new Error(`rejection source hash mismatch: ${source.file}`);
  }
  if (manifest.input_symbols !== manifest.accepted_symbols + manifest.rejected.length) throw new Error('rejection partition mismatch');
  return manifest;
}

function build() {
  const source = inside(arg('--source-dir'), /^scanner\/\d{8}\/_data2\.failed-[^/]+$/);
  const output = arg('--out');
  const refdate = arg('--refdate');
  const out = inside(path.dirname(output), /^scanner\/\d{8}$/);
  const outputRelative = path.relative(ROOT, path.resolve(ROOT, output)).split(path.sep).join('/');
  if (outputRelative !== `${out.relative}/_history-rejections.json` || !/^\d{4}-\d{2}-\d{2}$/.test(refdate || '')) throw new Error('invalid build arguments');
  const date = out.relative.split('/')[1];
  const vars = JSON.parse(fs.readFileSync(path.join(ROOT, `scanner/${date}/_data/vars.json`), 'utf8'));
  const symbols = String(vars.symbols || '').split(',').filter(Boolean);
  const assessed = new Map();
  const sources = [];
  for (const name of fs.readdirSync(source.absolute).filter(name => /^bars_b\d+\.json$/.test(name)).sort()) {
    const absolute = path.join(source.absolute, name), bytes = fs.readFileSync(absolute);
    const payload = JSON.parse(bytes);
    sources.push({ file: `${source.relative}/${name}`, sha256: sha256(bytes) });
    for (const result of resultNodes(payload)) {
      const rows = new Map((result.data || []).map(row => [row.symbol || row.instrument_id, row]));
      for (const cell of result.cells) {
        const symbol = cell.symbol || cell.instrument_id;
        if (!symbol || assessed.has(symbol)) continue;
        const row = rows.get(symbol);
        const check = contract.validateQueryData({ results: [{ cells: [cell], data: row ? [row] : [] }] }, {
          symbols: symbol, assetCalendar: 'us_equity_exchange_sessions', expectedCompletedEnd: refdate,
        });
        assessed.set(symbol, check.errors);
      }
    }
  }
  const rejected = symbols.map(symbol => ({ symbol, reasons: assessed.get(symbol) || ['symbol missing from failed history capture'] }))
    .filter(item => item.reasons.length);
  const manifest = {
    schema: 'scanner-history-rejections.v1', date, refdate,
    plan: 'plans/scanner-wave2.json', source_directory: source.relative,
    input_symbols: symbols.length, accepted_symbols: symbols.length - rejected.length,
    rejected, sources,
  };
  fs.writeFileSync(path.resolve(ROOT, output), JSON.stringify(manifest, null, 2) + '\n');
  validateManifest(outputRelative);
  console.log(`[history-rejections] ${rejected.length} rejet(s), ${manifest.accepted_symbols} historique(s) conservé(s)`);
}

if (mode === 'build') build();
else if (mode === 'csv') console.log(validateManifest(arg('--file')).rejected.map(item => item.symbol).join(','));
else if (mode === 'validate') { const m = validateManifest(arg('--file')); console.log(`[history-rejections] PASS (${m.rejected.length} rejet(s))`); }
else { console.error('Usage: scanner-history-rejections.js build --source-dir <failed-dir> --out scanner/YYYYMMDD/_history-rejections.json --refdate YYYY-MM-DD | csv|validate --file <manifest>'); process.exit(2); }
