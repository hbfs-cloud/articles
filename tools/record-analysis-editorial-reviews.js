#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const arg = name => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};
const date = arg('--date');
const attestationArg = arg('--attestations');
const files = argv.filter((value, index) => !value.startsWith('--') && argv[index - 1] !== '--date' && argv[index - 1] !== '--attestations');

if (!/^\d{8}$/.test(date || '') || !attestationArg || !files.length) {
  console.error('Usage: node tools/record-analysis-editorial-reviews.js --date YYYYMMDD --attestations file1.json,file2.json dossier.json ...');
  process.exit(2);
}

const rubricPath = path.join(ROOT, 'plans', 'analysis-quality-rubric-20260828.md');
const rubric = fs.readFileSync(rubricPath, 'utf8');
const checkIds = [...new Set(rubric.match(/AQ-[A-Z]+-\d{3}/g) || [])].sort();
if (checkIds.length !== 38) throw new Error(`AQ-1 rubric must expose 38 checks, found ${checkIds.length}`);

const attestations = attestationArg.split(',').flatMap(file => {
  const payload = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  return payload.reviews || [];
});

const reviews = [];
for (const file of files) {
  const abs = path.resolve(file);
  const raw = fs.readFileSync(abs, 'utf8');
  const dossier = JSON.parse(raw);
  const ticker = dossier.header?.ticker || path.basename(file, '.json');
  const panel = attestations.find(x => x.ticker === ticker);
  if (!panel) throw new Error(`${ticker}: no external panel attestation`);
  if (panel.status !== 'PASS' || Number(panel.score) < 80 || (panel.failedCheckIds || []).length) {
    throw new Error(`${ticker}: panel did not clear AQ-1 (${panel.status}, score ${panel.score})`);
  }
  execFileSync(process.execPath, [path.join(ROOT, 'tools', 'render-analysis.js'), abs, '--dry'], { stdio: 'pipe' });
  execFileSync(process.execPath, [path.join(ROOT, 'tools', 'check-analysis-editorial-quality.js'), '--strict', '--pre-review', abs], { stdio: 'pipe' });
  reviews.push({
    ticker,
    rubricVersion: 'AQ-1',
    status: 'PASS',
    score: Number(panel.score),
    reviewers: ['AQ-1 deterministic gate', panel.reviewer],
    reviewedAt: new Date().toISOString(),
    passedCheckIds: checkIds,
    failedCheckIds: [],
    notes: panel.notes || '',
    fileSha256: crypto.createHash('sha256').update(raw).digest('hex')
  });
}

reviews.sort((a, b) => a.ticker.localeCompare(b.ticker));
const outDir = path.join(ROOT, 'data', 'analysis-editorial-reviews');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `${date}.json`);
fs.writeFileSync(out, JSON.stringify({ rubricVersion: 'AQ-1', generatedAt: new Date().toISOString(), reviews }, null, 2) + '\n');
console.log(`[AQ-1] wrote ${reviews.length} hash-bound reviews to ${path.relative(ROOT, out)}`);
