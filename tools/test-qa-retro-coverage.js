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

function fixture(name, revision = '20260912') {
  const target = path.join(temp, name, revision);
  fs.mkdirSync(target, { recursive: true });
  for (const file of ['index.html', 'retro-results.json', 'cohort-manifest.json']) {
    fs.copyFileSync(path.join(ROOT, 'scanner', 'retrospective', revision, file), path.join(target, file));
  }
  return target;
}

function qa(dir) {
  return spawnSync(process.execPath, ['tools/qa-retro.js', dir], { cwd: ROOT, encoding: 'utf8' });
}

try {
  const valid = qa(fixture('valid'));
  assert.strictEqual(valid.status, 0, valid.stdout + valid.stderr);
  assert.match(valid.stdout, /publication_review=PASS, cohort_performance_certified=false/);

  const missingActivationDisclosure = fixture('missing-activation-disclosure');
  const modeFile = path.join(missingActivationDisclosure, 'retro-results.json');
  const modeData = JSON.parse(fs.readFileSync(modeFile));
  modeData.publication.performance_basis = 'hypothetical_published_levels_without_activation_confirmation';
  modeData.publication.execution_certified = false;
  fs.writeFileSync(modeFile, JSON.stringify(modeData));
  const missingDisclosure = qa(missingActivationDisclosure);
  assert.strictEqual(missingDisclosure.status, 1);
  assert.match(missingDisclosure.stderr, /conditions d’activation absentes/);
  const htmlFile = path.join(missingActivationDisclosure, 'index.html');
  fs.appendFileSync(htmlFile, '<h2>Simulation des niveaux, exécution non certifiée</h2>');
  assert.strictEqual(qa(missingActivationDisclosure).status, 0);
  modeData.publication.execution_certified = true;
  fs.writeFileSync(modeFile, JSON.stringify(modeData));
  const falseCertification = qa(missingActivationDisclosure);
  assert.strictEqual(falseCertification.status, 1);
  assert.match(falseCertification.stderr, /présentée comme exécution certifiée/);

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

  const completedPath = path.join(ROOT, 'scanner', 'retrospective', '20260912-completed', 'index.html');
  if (fs.existsSync(completedPath)) {
    const completed = qa(fixture('completed', '20260912-completed'));
    assert.strictEqual(completed.status, 0, completed.stdout + completed.stderr);
    const badMaturity = fixture('bad-maturity', '20260912-completed');
    const file = path.join(badMaturity, 'retro-results.json');
    const data = JSON.parse(fs.readFileSync(file));
    const measured = data.outcomes.find(o => o.horizon_end <= data.summary.reference_close && ['stopped','tp2','tp1_be','tp1_expired','expired'].includes(o.status));
    assert(measured, 'mature measured fixture required');
    measured.horizon_end = '2026-09-30';
    fs.writeFileSync(file, JSON.stringify(data));
    const failure = qa(badMaturity);
    assert.strictEqual(failure.status, 1, failure.stdout + failure.stderr);
    assert.match(failure.stderr, /summary\.resolved|mature_filled/);
    const badCoverage = fixture('bad-coverage', '20260912-completed');
    const coverageFile = path.join(badCoverage, 'retro-results.json');
    const coverage = JSON.parse(fs.readFileSync(coverageFile));
    coverage.outcomes[0].missing_sessions = [{date:'2026-09-10',error:'missing'}];
    fs.writeFileSync(coverageFile, JSON.stringify(coverage));
    const gapFailure = qa(badCoverage);
    assert.strictEqual(gapFailure.status, 1, gapFailure.stdout + gapFailure.stderr);
    assert.match(gapFailure.stderr, /séances manquantes/);
  }

  console.log('✅ test-qa-retro-coverage: valid coverage review accepted; counter and fill mutations rejected.');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
