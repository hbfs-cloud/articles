#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { sha256, stableStringify } = require('./lib/workflow-contract');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'socle-reuse-'));
try {
  const plan = {
    artifact: 'unused', reference_date: '2026-08-28',
    waves: [{ name: 'base', calls: [{ as: 'bars', server: 'marketdata', tool: 'QueryData', args: { types: 'bars_daily', symbols: 'SPY', end_date: '$refdate' }, freshness: { max_age_h: 24, required: true } }] }],
  };
  const planPath = path.join(temp, 'plan.json');
  const socle = path.join(temp, 'socle');
  fs.mkdirSync(socle);
  fs.writeFileSync(planPath, JSON.stringify(plan));
  fs.writeFileSync(path.join(socle, 'bars.json'), '{}');
  const args = { types: 'bars_daily', symbols: 'SPY', end_date: '2026-08-28' };
  const index = {
    reference_date: '2026-08-28', entries: { bars: {
      file: 'bars.json', server: 'marketdata', tool: 'QueryData', as_of: new Date().toISOString(),
      args_sha256: sha256(stableStringify(args)),
    } },
  };
  const run = () => spawnSync(process.execPath, ['tools/collect.js', '--plan', planPath, '--out', path.join(temp, 'out'), '--socle', socle, '--plan-only'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
  fs.writeFileSync(path.join(socle, '_socle.json'), JSON.stringify(index));
  let result = run();
  assert.strictEqual(result.status, 0);
  assert.match(result.stdout, /socle : 1\/1/);
  index.reference_date = '2026-08-27';
  fs.writeFileSync(path.join(socle, '_socle.json'), JSON.stringify(index));
  result = run();
  assert.match(result.stdout, /socle : 0\/1/);
  index.reference_date = '2026-08-28';
  index.entries.bars.args_sha256 = '0'.repeat(64);
  fs.writeFileSync(path.join(socle, '_socle.json'), JSON.stringify(index));
  result = run();
  assert.match(result.stdout, /socle : 0\/1/);
  const historicalPlan = path.join(temp, 'historical.json');
  fs.writeFileSync(historicalPlan, JSON.stringify({ artifact: 'unused', reference_date: '2020-01-02', waves: [{ name: 'bad', calls: [{
    as: 'regime', server: 'marketdata', tool: 'GetMarketContext', args: { facets: 'regime' }, freshness: { max_age_h: 1, required: true },
  }] }] }));
  const pit = spawnSync(process.execPath, ['tools/collect.js', '--plan', historicalPlan, '--out', path.join(temp, 'pit'), '--plan-only'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
  assert.notStrictEqual(pit.status, 0);
  assert.match(pit.stderr, /current-only interdits/);
  console.log('socle reuse tests: PASS');
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
