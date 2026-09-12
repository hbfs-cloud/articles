/** Explicit per-run symbol exclusions; never inferred from data availability. */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATE_RE = /^\d{8}$/;
const REFDATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SYMBOL_RE = /^[A-Z][A-Z0-9.-]{0,14}$/;
const OPTION = '--symbol-exclusions=';
const REQUIRED_KEYS = [
  'all_other_gates_required',
  'date',
  'preserve_existing_records',
  'refdate',
  'symbols',
  'user_instruction',
];

function validIsoDate(value) {
  if (typeof value !== 'string' || !REFDATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function suppliedManifest(argv) {
  const args = argv.filter(arg => arg === '--symbol-exclusions' || arg.startsWith(OPTION));
  if (args.length > 1 || args[0] === '--symbol-exclusions') {
    throw new Error('Use exactly one --symbol-exclusions=scanner/YYYYMMDD/_symbol-exclusions.json');
  }
  return args.length ? args[0].slice(OPTION.length) : null;
}

function noOp() {
  const excludesSymbol = () => false;
  return Object.freeze({
    active: false,
    audit: null,
    excludesSymbol,
    filterSymbols: symbols => {
      if (!Array.isArray(symbols)) throw new Error('filterSymbols expects an array');
      return symbols.slice();
    },
    preserveExcludedRecords: current => {
      if (!Array.isArray(current)) throw new Error('preserveExcludedRecords expects current records as an array');
      return current.slice();
    },
    assertReference: () => true,
  });
}

function loadScannerSymbolExclusions(root, argv = process.argv.slice(2)) {
  const supplied = suppliedManifest(argv);
  if (!supplied) return noOp();

  root = fs.realpathSync(root);
  const absolute = path.resolve(root, supplied);
  const relative = path.relative(root, absolute).split(path.sep).join('/');
  const match = /^scanner\/(\d{8})\/_symbol-exclusions\.json$/.exec(relative);
  if (!match || !fs.existsSync(absolute) || fs.realpathSync(absolute) !== absolute) {
    throw new Error('Symbol exclusions must be the real scanner/YYYYMMDD/_symbol-exclusions.json in this workspace');
  }

  const raw = fs.readFileSync(absolute);
  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid symbol exclusions JSON: ${error.message}`);
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('Symbol exclusions manifest must be an object');
  }
  const keys = Object.keys(manifest).sort();
  if (JSON.stringify(keys) !== JSON.stringify(REQUIRED_KEYS)) {
    throw new Error('Symbol exclusions manifest has unsupported or missing fields');
  }

  const date = match[1];
  const expectedRefdate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  if (manifest.date !== date || !DATE_RE.test(manifest.date)) {
    throw new Error('Symbol exclusions date must match its scanner folder');
  }
  if (!validIsoDate(manifest.refdate)) throw new Error('Symbol exclusions refdate must be a valid ISO date');
  if (manifest.refdate >= expectedRefdate) {
    throw new Error('Symbol exclusions refdate must precede its scanner date');
  }
  if (typeof manifest.user_instruction !== 'string' || !manifest.user_instruction.trim()) {
    throw new Error('Symbol exclusions require a non-empty explicit user_instruction');
  }
  if (manifest.preserve_existing_records !== true) {
    throw new Error('Symbol exclusions must preserve existing records');
  }
  if (manifest.all_other_gates_required !== true) {
    throw new Error('Symbol exclusions must retain every other gate');
  }
  if (!Array.isArray(manifest.symbols) || manifest.symbols.length === 0) {
    throw new Error('Symbol exclusions require one or more symbols');
  }
  for (const symbol of manifest.symbols) {
    if (typeof symbol !== 'string' || !SYMBOL_RE.test(symbol)) {
      throw new Error(`Invalid excluded symbol: ${String(symbol)}`);
    }
  }
  const excluded = new Set(manifest.symbols);
  if (excluded.size !== manifest.symbols.length) throw new Error('Excluded symbols must be unique');

  const audit = Object.freeze({
    status: 'EXCLUDED_BY_EXPLICIT_USER_INSTRUCTION',
    date,
    refdate: manifest.refdate,
    path: relative,
    sha256: crypto.createHash('sha256').update(raw).digest('hex'),
    symbols: Object.freeze([...manifest.symbols]),
    user_instruction: manifest.user_instruction,
    preserve_existing_records: true,
    all_other_gates_required: true,
  });
  const excludesSymbol = symbol => typeof symbol === 'string' && excluded.has(symbol.trim().toUpperCase());
  const preserveExcludedRecords = (current, previous, tickerOf = record => record && record.ticker) => {
    if (!Array.isArray(current) || !Array.isArray(previous)) {
      throw new Error('preserveExcludedRecords expects current and previous records as arrays');
    }
    if (typeof tickerOf !== 'function') throw new Error('preserveExcludedRecords expects tickerOf to be a function');
    const wasExcluded = record => excludesSymbol(tickerOf(record));
    const output = current.filter(record => !wasExcluded(record));
    previous.forEach((record, index) => {
      if (!wasExcluded(record)) return;
      const insertionIndex = Math.min(index, output.length);
      output.splice(insertionIndex, 0, structuredClone(record));
    });
    return output;
  };
  const assertReference = refdate => {
    if (refdate !== manifest.refdate) {
      throw new Error(`Symbol exclusions refdate mismatch: expected ${manifest.refdate}, received ${String(refdate)}`);
    }
    return true;
  };
  return Object.freeze({
    active: true,
    audit,
    excludesSymbol,
    filterSymbols: symbols => {
      if (!Array.isArray(symbols)) throw new Error('filterSymbols expects an array');
      return symbols.filter(symbol => !excludesSymbol(symbol));
    },
    preserveExcludedRecords,
    assertReference,
  });
}

module.exports = { loadScannerSymbolExclusions };
