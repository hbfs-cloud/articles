#!/usr/bin/env node
'use strict';

/**
 * rollback.js — Revert the last commit and push
 *
 * Usage:
 *   node tools/rollback.js [--force]
 */

const { spawnSync } = require('child_process');
const path = require('path');
const readline = require('readline');

const ROOT = path.join(__dirname, '..');
const force = process.argv.includes('--force');

function run(args) {
  const res = spawnSync('git', args, { cwd: ROOT, stdio: 'inherit' });
  if (res.status !== 0) {
    console.error(`ERROR: git ${args[0]} failed (exit ${res.status})`);
    process.exit(res.status || 1);
  }
}

async function main() {
  const log = spawnSync('git', ['log', '--oneline', '-1'], { cwd: ROOT, encoding: 'utf8' });
  console.log(`\nLast commit: ${log.stdout.trim()}`);

  if (!force) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise(resolve => rl.question('Revert this commit and push? [y/N] ', resolve));
    rl.close();
    if (answer.toLowerCase() !== 'y') {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  console.log('\nReverting...');
  run(['revert', 'HEAD', '--no-edit']);

  console.log('Pushing...');
  run(['push', 'origin', 'main']);

  console.log('✅ Rollback complete.');
}

main();
