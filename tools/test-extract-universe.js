#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'extract-universe-'));
try {
  fs.writeFileSync(path.join(tmp, 'autoscreen_squeeze_us.json'), JSON.stringify({
    data: {
      items: [{
        candidates: [
          { symbol: 'AAA', strategy: 'short_squeeze', score: 90 },
          { symbol: 'BBB', strategy: 'momentum', score: 99 },
          { symbol: 'CCC.PA', strategy: 'short_squeeze', score: 95 },
        ],
      }],
    },
  }));
  fs.writeFileSync(path.join(tmp, 'screen_stale_eu.json'), JSON.stringify({
    data: { items: [{ candidates: [{ symbol: 'DDD', strategy: 'short_squeeze', score: 100 }] }] },
  }));
  const out = path.join(tmp, 'vars.json');
  const result = spawnSync(process.execPath, [
    'tools/extract-universe.js', '--in', tmp, '--out', out, '--strategy', 'short_squeeze', '--limit', '36',
  ], { cwd: root, encoding: 'utf8' });
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  const vars = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.strictEqual(vars.symbols, 'AAA');
  assert.strictEqual(vars.count, '1');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('extract universe: PASS');
