#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const source = path.join(ROOT, 'scanner', 'retrospective', '20260912');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-retro-coverage-'));

function fixture(name) {
  const target = path.join(temp, name, '20260912');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
  return target;
}

function qa(dir) {
  return spawnSync(process.execPath, ['tools/qa-retro.js', dir], { cwd: ROOT, encoding: 'utf8' });
}

try {
  const valid = qa(fixture('valid'));
  assert.strictEqual(valid.status, 0, valid.stdout + valid.stderr);
  assert.match(valid.stdout, /publication_review=PASS, cohort_performance_certified=false/);

  const badCount = fixture('bad-count');
  const countResults = JSON.parse(fs.readFileSync(path.join(badCount, 'retro-results.json'), 'utf8'));
  countResults.summary.proposed += 1;
  fs.writeFileSync(path.join(badCount, 'retro-results.json'), JSON.stringify(countResults, null, 2) + '\n');
  const countFailure = qa(badCount);
  assert.strictEqual(countFailure.status, 1, countFailure.stdout + countFailure.stderr);
  assert.match(countFailure.stderr, /summary\.proposed/);

  const badFill = fixture('bad-fill');
  const fillResults = JSON.parse(fs.readFileSync(path.join(badFill, 'retro-results.json'), 'utf8'));
  const measured = fillResults.outcomes.find(outcome => !['no_fill', 'data_error', 'open_unverified', 'ambiguous', 'pending'].includes(outcome.status));
  assert(measured, 'fixture must contain a measured outcome');
  measured.effective_entry = 100000;
  fs.writeFileSync(path.join(badFill, 'retro-results.json'), JSON.stringify(fillResults, null, 2) + '\n');
  const fillFailure = qa(badFill);
  assert.strictEqual(fillFailure.status, 1, fillFailure.stdout + fillFailure.stderr);
  assert.match(fillFailure.stderr, /hors tolérance/);

  console.log('✅ test-qa-retro-coverage: valid coverage review accepted; counter and fill mutations rejected.');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
