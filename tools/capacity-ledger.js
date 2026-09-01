#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  DEFAULT_CONFIG_HISTORY_PATH,
  DEFAULT_LEDGER_PATH,
  appendCandidateDecision,
  appendPositionExit,
  assertAppendOnly,
  buildGenesisRegistry,
  loadConfigHistory,
  loadRegistry,
  validateRegistry,
  writeRegistryAtomic,
} = require('./lib/capacity-ledger');

function parseArgs(argv) {
  const out = { command: argv[0] || 'verify' };
  for (let index = 1; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg.startsWith('--')) throw new Error(`unexpected argument ${arg}`);
    const [key, inline] = arg.slice(2).split('=', 2);
    if (key === 'force') { out.force = true; continue; }
    const value = inline === undefined ? argv[++index] : inline;
    if (!value || value.startsWith('--')) throw new Error(`--${key} requires a value`);
    out[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
  }
  return out;
}

function usage() {
  console.error('Usage:');
  console.error('  node tools/capacity-ledger.js init [--out FILE] [--boundary YYYY-MM-DD] [--created-at ISO] [--force]');
  console.error('  node tools/capacity-ledger.js verify [--ledger FILE]');
  console.error('  node tools/capacity-ledger.js append-candidate --input FILE [--ledger FILE]');
  console.error('  node tools/capacity-ledger.js append-exit --input FILE [--ledger FILE]');
}

function withLock(filePath, fn) {
  const lockPath = `${filePath}.lock`;
  let fd;
  try {
    fd = fs.openSync(lockPath, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`ledger is locked: ${lockPath}`);
    throw error;
  }
  try { return fn(); }
  finally {
    fs.closeSync(fd);
    fs.unlinkSync(lockPath);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const historyPath = path.resolve(args.configHistory || DEFAULT_CONFIG_HISTORY_PATH);
  const history = loadConfigHistory(historyPath);
  const ledgerPath = path.resolve(args.ledger || args.out || DEFAULT_LEDGER_PATH);

  if (args.command === 'init') {
    if (fs.existsSync(ledgerPath) && !args.force) throw new Error(`${ledgerPath} already exists; refusing to overwrite`);
    const registry = buildGenesisRegistry({
      configHistory: history,
      boundarySession: args.boundary || '2026-09-01',
      createdAt: args.createdAt,
      effectiveAt: args.effectiveAt,
    });
    writeRegistryAtomic(ledgerPath, registry, { configHistory: history });
    console.log(`capacity ledger genesis written: ${ledgerPath}`);
    console.log(`registryHash=${registry.registryHash}`);
    return;
  }

  if (args.command === 'verify') {
    const registry = loadRegistry(ledgerPath);
    const errors = validateRegistry(registry, { configHistory: history });
    if (errors.length) throw new Error(errors.join('\n'));
    console.log(`capacity ledger valid: ${ledgerPath}`);
    console.log(`registryHash=${registry.registryHash}`);
    return;
  }

  if (!['append-candidate', 'append-exit'].includes(args.command)) {
    usage();
    throw new Error(`unknown command ${args.command}`);
  }
  if (!args.input) throw new Error(`${args.command} requires --input FILE`);
  const input = JSON.parse(fs.readFileSync(path.resolve(args.input), 'utf8'));
  withLock(ledgerPath, () => {
    const previous = loadRegistry(ledgerPath);
    const next = args.command === 'append-candidate'
      ? appendCandidateDecision(previous, input, { configHistory: history })
      : appendPositionExit(previous, input, { configHistory: history });
    assertAppendOnly(previous, next);
    writeRegistryAtomic(ledgerPath, next, { configHistory: history });
    console.log(`${args.command} appended: ${ledgerPath}`);
    console.log(`registryHash=${next.registryHash}`);
  });
}

try { main(); }
catch (error) {
  console.error(`capacity-ledger: ${error.message}`);
  process.exitCode = 1;
}
