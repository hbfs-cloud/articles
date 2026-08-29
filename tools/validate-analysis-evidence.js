#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { validateCollectedArtifact } = require('./lib/evidence-gates');

const ROOT = path.resolve(__dirname, '..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const get = (value, dotted) => dotted.split('.').reduce((node, key) => node && node[key], value);
const pointerGet = (value, pointer) => pointer === '' ? value : String(pointer || '').startsWith('/')
  ? pointer.slice(1).split('/').reduce((node, raw) => node == null ? undefined : node[raw.replace(/~1/g, '/').replace(/~0/g, '~')], value)
  : undefined;

function numericPaths(value, prefix = '', output = []) {
  if (typeof value === 'number' && Number.isFinite(value)) { output.push(prefix); return output; }
  if (!value || typeof value !== 'object') return output;
  for (const [key, child] of Object.entries(value)) numericPaths(child, prefix ? `${prefix}.${key}` : key, output);
  return output;
}

function validate(manifest, root = ROOT) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') return ['manifest must be an object'];
  const ticker = String(manifest.ticker || '').toUpperCase();
  if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(ticker)) errors.push('ticker is invalid');
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(String(manifest.reference_close || ''))) errors.push('reference_close is invalid');
  const relAnalysis = manifest.analysis_path;
  if (!relAnalysis || path.isAbsolute(relAnalysis)) return [...errors, 'analysis_path must be repository-relative'];
  const analysisPath = path.resolve(root, relAnalysis);
  if (path.relative(root, analysisPath).startsWith('..') || !fs.existsSync(analysisPath)) return [...errors, 'analysis_path is missing or escapes repository'];
  const analysisBytes = fs.readFileSync(analysisPath);
  if (hash(analysisBytes) !== manifest.analysis_sha256) errors.push('analysis_sha256 mismatch');
  let analysis;
  try { analysis = JSON.parse(analysisBytes); } catch { return [...errors, 'analysis JSON is invalid']; }
  if (String(analysis.header && analysis.header.ticker || '').toUpperCase() !== ticker) errors.push('analysis ticker mismatch');
  if (analysis.meta && analysis.meta.levelsCloseDate !== manifest.reference_close) errors.push('analysis levelsCloseDate must equal reference_close');

  const claims = Array.isArray(manifest.claims) ? manifest.claims : [];
  const byPath = new Map(claims.map(claim => [claim && claim.path, claim]));
  const required = numericPaths(analysis);
  for (const dotted of required) {
    const value = get(analysis, dotted);
    if (value == null) continue; // optional schema field absent means no published claim
    const claim = byPath.get(dotted);
    if (!claim) { errors.push(`missing claim for ${dotted}`); continue; }
    if (JSON.stringify(claim.value) !== JSON.stringify(value)) errors.push(`${dotted}: claim value differs from analysis`);
    if (claim.as_of !== manifest.reference_close) errors.push(`${dotted}: claim as_of must equal reference_close`);
    const rel = claim.source_artifact;
    if (!rel || path.isAbsolute(rel) || !/^[a-f0-9]{64}$/.test(String(claim.source_sha256 || ''))) {
      errors.push(`${dotted}: source artifact/hash missing`); continue;
    }
    const abs = path.resolve(root, rel);
    if (path.relative(root, abs).startsWith('..') || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      errors.push(`${dotted}: source artifact missing or outside repository`); continue;
    }
    const bytes = fs.readFileSync(abs);
    if (abs === analysisPath) { errors.push(`${dotted}: analysis cannot prove itself`); continue; }
    if (hash(bytes) !== claim.source_sha256) errors.push(`${dotted}: source hash mismatch`);
    const collectedErrors = validateCollectedArtifact(abs, claim.source_sha256, manifest.reference_close, root);
    if (collectedErrors.length) { errors.push(`${dotted}: source collector provenance invalid: ${collectedErrors.join('; ')}`); continue; }
    if (!new RegExp(`(?:^|[^A-Z0-9.-])${ticker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^A-Z0-9.-])`, 'i').test(bytes.toString('utf8'))) {
      errors.push(`${dotted}: source artifact does not contain ${ticker}`);
    }
    let source;
    try { source = JSON.parse(bytes); } catch { errors.push(`${dotted}: source artifact is not valid JSON`); continue; }
    if (typeof claim.source_pointer !== 'string' || !claim.source_pointer.startsWith('/')) {
      errors.push(`${dotted}: source_pointer is required`); continue;
    }
    const observed = pointerGet(source, claim.source_pointer);
    const equal = typeof value === 'number' && typeof observed === 'number'
      ? Math.abs(value - observed) <= Math.max(1e-9, Math.abs(value) * 1e-9)
      : observed === value;
    if (!equal) errors.push(`${dotted}: source_pointer value differs from analysis`);
  }
  const duplicates = claims.map(claim => claim && claim.path).filter((value, index, all) => value && all.indexOf(value) !== index);
  if (duplicates.length) errors.push(`duplicate claim paths: ${[...new Set(duplicates)].join(', ')}`);
  return [...new Set(errors)];
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('Usage: validate-analysis-evidence.js <evidence.json>'); process.exit(2); }
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { console.error(`[analysis-evidence] invalid JSON: ${error.message}`); process.exit(1); }
  const errors = validate(manifest);
  if (errors.length) {
    console.error('[analysis-evidence] FAIL');
    errors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
  }
  console.log(`[analysis-evidence] PASS (${manifest.claims.length} claims)`);
}

module.exports = { numericPaths, validate };
