#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  ATTESTATION_SCHEMA_VERSION,
  buildReviewRecord,
  mergeManifest,
  normalizeSubmission,
  rubricCheckIds,
  sha256
} = require('./lib/analysis-review-attestation');

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

const checkIds = rubricCheckIds(ROOT);
const safeRepoPath = file => {
  const abs = path.resolve(file);
  const relative = path.relative(ROOT, abs);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`attestation must be inside repository: ${file}`);
  return { abs, relative };
};

const attestations = attestationArg.split(',').flatMap(file => {
  const source = safeRepoPath(file);
  const bytes = fs.readFileSync(source.abs);
  const payload = JSON.parse(bytes);
  if (payload.schemaVersion !== ATTESTATION_SCHEMA_VERSION || !Array.isArray(payload.reviews)) {
    throw new Error(`${source.relative}: expected ${ATTESTATION_SCHEMA_VERSION} with reviews[]`);
  }
  return payload.reviews.map(review => normalizeSubmission(review, { path: source.relative, sha256: sha256(bytes) }));
});

const reviews = [];
const seenTickers = new Set();
for (const file of files) {
  const abs = path.resolve(file);
  const raw = fs.readFileSync(abs, 'utf8');
  const dossier = JSON.parse(raw);
  const ticker = String(dossier.header?.ticker || path.basename(file, '.json')).toUpperCase();
  if (seenTickers.has(ticker)) throw new Error(`${ticker}: duplicate dossier ticker in recording request`);
  seenTickers.add(ticker);
  const analysisPath = path.relative(ROOT, abs);
  if (analysisPath.startsWith('..') || path.isAbsolute(analysisPath)) throw new Error(`${ticker}: dossier must be inside repository`);
  const analysisSha256 = sha256(raw);
  const submissions = attestations.filter(review => String(review.ticker || '').toUpperCase() === ticker);
  if (!submissions.length) throw new Error(`${ticker}: no AQ-1.1 reviewer submissions`);
  const evidencePath = submissions[0].evidencePath;
  const evidenceAbs = path.resolve(ROOT, evidencePath || '');
  if (!evidencePath || path.relative(ROOT, evidenceAbs).startsWith('..') || path.isAbsolute(path.relative(ROOT, evidenceAbs)) || !fs.existsSync(evidenceAbs)) {
    throw new Error(`${ticker}: submitted evidencePath is missing or outside repository`);
  }
  const evidenceSha256 = sha256(fs.readFileSync(evidenceAbs));

  const review = buildReviewRecord({
    ticker,
    analysisPath,
    analysisSha256,
    evidencePath,
    evidenceSha256,
    submissions,
    checkIds
  });
  execFileSync(process.execPath, [path.join(ROOT, 'tools', 'render-analysis.js'), abs, '--dry'], { stdio: 'pipe' });
  execFileSync(process.execPath, [path.join(ROOT, 'tools', 'check-analysis-editorial-quality.js'), '--strict', '--pre-review', abs], { stdio: 'pipe' });
  reviews.push(review);
}

const outDir = path.join(ROOT, 'data', 'analysis-editorial-reviews');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `${date}.json`);
const existing = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : { reviews: [] };
const merged = mergeManifest(existing, reviews);
const temp = `${out}.tmp-${process.pid}`;
fs.writeFileSync(temp, JSON.stringify(merged, null, 2) + '\n');
fs.renameSync(temp, out);
console.log(`[AQ-1.1] wrote ${reviews.length} current hash-bound review(s) to ${path.relative(ROOT, out)}; ${merged.reviews.length} total review(s) preserved`);
