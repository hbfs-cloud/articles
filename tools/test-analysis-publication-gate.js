#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { assertAnalysisPublicationReady } = require('./lib/analysis-publication-gate');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'analysis-publication-gate-'));
const relative = 'data/analyses-data/TEST.json';
const dossier = path.join(root, relative);
const evidencePath = path.join(root, 'data/analyses-evidence/TEST.json');
const bytes = JSON.stringify({ header: { ticker: 'TEST' }, meta: {} });
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
try {
  fs.mkdirSync(path.dirname(dossier), { recursive: true });
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  fs.writeFileSync(dossier, bytes);
  const evidence = { ticker: 'TEST', analysis_path: relative, analysis_sha256: hash(bytes) };
  const saveEvidence = () => fs.writeFileSync(evidencePath, JSON.stringify(evidence));
  saveEvidence();
  // Le gate lit le plan déclaré par le harnais et exige qu'il soit enregistré pour `analyse`.
  const harnessFile = path.join(root, 'analyses/TEST/_data/harness.json');
  fs.mkdirSync(path.dirname(harnessFile), { recursive: true });
  fs.mkdirSync(path.join(root, 'config'), { recursive: true });
  fs.writeFileSync(path.join(root, 'config/workflow-contracts.json'), JSON.stringify({
    workflows: { analyse: { plans: [{ path: 'plans/analyse.json' }, { path: 'plans/analyse-tiingo.json' }] } },
  }));
  const saveHarness = plan => fs.writeFileSync(harnessFile, JSON.stringify({ plan }));
  saveHarness('plans/analyse-tiingo.json');
  const calls = [];
  const runner = (bin, args) => { calls.push(args); return { status: 0 }; };
  assert.equal(assertAnalysisPublicationReady(relative, { root, runner }).ticker, 'TEST');
  assert.equal(calls.length, 4);
  assert.equal(calls[0][0], 'tools/check-freshness.js');
  assert.equal(calls[1][0], 'tools/validate-workflows.js');
  assert.equal(calls[1][2], 'plans/analyse-tiingo.json', 'run-plan must use the plan declared by the harness');
  saveHarness('plans/unregistered.json');
  assert.throws(() => assertAnalysisPublicationReady(relative, { root, runner }), /not registered/);
  saveHarness('plans/analyse.json');
  assert.equal(calls[2][0], 'tools/validate-analysis-evidence.js');
  assert(calls[3].includes('--strict') && calls[3].includes('--require-current-attestation'));
  // Failed evidence/reviews cannot be ignored, including a failed process launch.
  for (const result of [{ status: 1 }, { status: null, error: new Error('spawn failed') }]) {
    assert.throws(() => assertAnalysisPublicationReady(relative, { root, runner: () => result }), /gate failed/);
  }
  let count = 0;
  assert.throws(() => assertAnalysisPublicationReady(relative, {
    root, runner: () => ({ status: ++count === 4 ? 1 : 0 }),
  }), /editorial-quality/);
  evidence.analysis_sha256 = '0'.repeat(64); saveEvidence();
  assert.throws(() => assertAnalysisPublicationReady(relative, { root, runner }), /not bound/);
  evidence.analysis_sha256 = hash(bytes); saveEvidence();
  assert.throws(() => assertAnalysisPublicationReady(relative, {
    root, runner: () => { fs.writeFileSync(dossier, bytes + '\n'); return { status: 0 }; },
  }), /changed during/);
  fs.writeFileSync(dossier, bytes);
  assert.throws(() => assertAnalysisPublicationReady(relative, { root, runner, htmlPath: 'analyses/OTHER/index.html' }), /does not match/);
  const { render } = require('./render-analysis');
  const renderData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/analyses-data/AVGO.json'), 'utf8'));
  renderData.header.ticker = 'TEST';
  const renderBytes = JSON.stringify(renderData);
  fs.writeFileSync(dossier, renderBytes);
  evidence.analysis_sha256 = hash(renderBytes); saveEvidence();
  const htmlPath = 'analyses/TEST/index.html';
  fs.mkdirSync(path.dirname(path.join(root, htmlPath)), { recursive: true });
  fs.writeFileSync(path.join(root, htmlPath), render(renderData));
  assert.equal(assertAnalysisPublicationReady(relative, { root, runner, htmlPath }).ticker, 'TEST');
  fs.appendFileSync(path.join(root, htmlPath), '\nChanged after review');
  assert.throws(() => assertAnalysisPublicationReady(relative, { root, runner, htmlPath }), /HTML differs/);
  // Exercise the real entry points in a disposable repository, never live content.
  const sourceRepo = path.resolve(__dirname, '..');
  const repo = fs.mkdtempSync(path.join(root, 'publisher-fixture-'));
  for (const file of ['tools/publish-analysis.js', 'tools/publish.js',
    'tools/lib/analysis-publication-gate.js', 'tools/lib/analysis-schema.json',
    'data/analyses-data/AVGO.json']) {
    fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
    fs.copyFileSync(path.join(sourceRepo, file), path.join(repo, file));
  }
  const protectedPaths = ['analyses/AVGO/index.html', 'data/analyses.json', 'data/analyses_archive.json'];
  for (const file of protectedPaths) {
    fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
    fs.writeFileSync(path.join(repo, file), file.endsWith('.html') ? 'x'.repeat(12000) : '[]');
  }
  const before = protectedPaths.map(file => hash(fs.readFileSync(path.join(repo, file))));
  for (const args of [
    ['tools/publish-analysis.js', 'data/analyses-data/AVGO.json'],
    ['tools/publish.js', '--type', 'analysis', '--path', 'analyses/AVGO/index.html', '--dry-run', '--skip-validate'],
  ]) {
    const result = spawnSync(process.execPath, args, { cwd: repo, encoding: 'utf8' });
    assert.notEqual(result.status, 0, 'unreviewed dossier must not publish');
    assert(!result.stdout.includes('[ARCHIVED]') && !result.stdout.includes('Step 3/7'));
  }
  assert.deepEqual(protectedPaths.map(file => hash(fs.readFileSync(path.join(repo, file)))), before);
  console.log('analysis publication gate: PASS');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
