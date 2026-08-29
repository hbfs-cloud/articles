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

function validatePrimarySecManifest(source, root) {
  const errors = [];
  if (source.kind !== 'primary_sec_manifest_v1') return null;
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(String(source.as_of || ''))) errors.push('primary SEC manifest as_of is invalid');
  if (!Number.isInteger(source.inventory_count) || source.inventory_screened_count !== source.inventory_count) errors.push('primary SEC inventory was not fully screened');
  if (!Number.isInteger(source.opened_count) || source.opened_count !== source.reviewed_count || source.reviewed_count !== source.decision_relevant_count) errors.push('primary SEC opened/reviewed counts are inconsistent');
  if (!Array.isArray(source.documents) || source.documents.length !== source.local_primary_count) errors.push('primary SEC local document count is inconsistent');
  for (const doc of source.documents || []) {
    const abs = path.resolve(root, doc.path || '');
    if (!doc.accession || !doc.form || !/^https:\/\/www\.sec\.gov\//.test(doc.url || '')) errors.push(`primary SEC metadata incomplete: ${doc.path || 'unknown'}`);
    if (path.relative(root, abs).startsWith('..') || !fs.existsSync(abs) || hash(fs.readFileSync(abs)) !== doc.sha256) errors.push(`primary SEC artifact/hash mismatch: ${doc.path || 'unknown'}`);
  }
  for (const [id, finding] of Object.entries(source.semantic_findings || {})) {
    const abs = path.resolve(root, finding.source_path || '');
    if (path.relative(root, abs).startsWith('..') || !fs.existsSync(abs) || hash(fs.readFileSync(abs)) !== finding.source_sha256) {
      errors.push(`primary SEC semantic finding artifact/hash mismatch: ${id}`);
      continue;
    }
    const bytes = fs.readFileSync(abs, 'utf8');
    for (const needle of finding.source_needles || []) if (!bytes.includes(needle)) errors.push(`primary SEC semantic finding needle missing: ${id} -> ${needle}`);
  }
  return errors;
}

function validateDeterministicCalculation(source, abs, expectedHash, manifest, root) {
  const errors = [];
  if (source.kind !== 'deterministic_analysis_calculation_v1') return null;
  if (hash(fs.readFileSync(abs)) !== expectedHash) errors.push('calculation source hash mismatch');
  if (source.ticker !== manifest.ticker || source.reference_close !== manifest.reference_close) errors.push('calculation identity mismatch');
  if (source.analysis_sha256 !== manifest.analysis_sha256) errors.push('calculation analysis hash mismatch');
  const generator = path.resolve(root, source.generator_path || '');
  if (!fs.existsSync(generator) || hash(fs.readFileSync(generator)) !== source.generator_sha256) errors.push('calculation generator hash mismatch');
  if (!Array.isArray(source.inputs) || !source.inputs.length) errors.push('calculation inputs are missing');
  const score = Object.values(source.score_components || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  if (score !== source.values?.verdict?.score) errors.push('calculation score components do not reproduce verdict score');
  const scenario = source.valuation_scenario || {};
  const enterpriseValue = Number(scenario.multiple) * Number(scenario.ebitda);
  const equityValue = enterpriseValue - Number(scenario.debt) + Number(scenario.cash);
  const scenarioPrice = equityValue / Number(scenario.shares);
  const downside = (scenarioPrice / Number(scenario.close) - 1) * 100;
  const closeEnough = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= Math.max(1e-8, Math.abs(a) * 1e-10);
  if (!closeEnough(enterpriseValue, Number(scenario.enterprise_value)) || !closeEnough(equityValue, Number(scenario.equity_value))
    || !closeEnough(scenarioPrice, Number(scenario.price)) || !closeEnough(downside, Number(scenario.downside_pct))) {
    errors.push('valuation scenario is not reproducible');
  }
  let analysis;
  try { analysis = JSON.parse(fs.readFileSync(path.resolve(root, manifest.analysis_path), 'utf8')); } catch { analysis = null; }
  const numericStrings = {};
  const visitStrings = (value, prefix = '') => {
    if (typeof value === 'string' && /\d/.test(value)) numericStrings[prefix] = value;
    else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) visitStrings(child, prefix ? `${prefix}.${key}` : key);
  };
  visitStrings(analysis);
  if (JSON.stringify(numericStrings) !== JSON.stringify(source.string_numeric_claims || {})) errors.push('numeric-bearing string claims are not exhaustively certified');
  const expectedClaimPaths = [...new Set([...numericPaths(analysis || {}), ...Object.keys(numericStrings)])];
  for (const dotted of expectedClaimPaths) {
    const provenance = source.claim_provenance?.[dotted];
    if (!provenance?.input_path || !provenance?.input_sha256 || typeof provenance.source_pointer !== 'string' || !provenance.method) errors.push(`claim provenance missing for ${dotted}`);
    const declaredInput = (source.inputs || []).find(input => input.path === provenance?.input_path && input.sha256 === provenance?.input_sha256);
    if (provenance && !declaredInput) errors.push(`claim provenance input is not declared for ${dotted}`);
    if (declaredInput) {
      let rawInput;
      try { rawInput = JSON.parse(fs.readFileSync(path.resolve(root, declaredInput.path), 'utf8')); } catch { rawInput = null; }
      if (rawInput == null || pointerGet(rawInput, provenance.source_pointer) === undefined) errors.push(`claim provenance pointer does not resolve for ${dotted}`);
    }
  }
  for (const dotted of numericPaths(analysis || {})) if (!source.methods?.[dotted]) errors.push(`calculation method missing for ${dotted}`);
  for (const input of source.inputs || []) {
    const inputAbs = path.resolve(root, input.path || '');
    if (!fs.existsSync(inputAbs) || hash(fs.readFileSync(inputAbs)) !== input.sha256) {
      errors.push(`calculation input hash mismatch: ${input.name || input.path}`);
      continue;
    }
    let inputSource;
    try { inputSource = JSON.parse(fs.readFileSync(inputAbs, 'utf8')); } catch { inputSource = null; }
    const primarySecErrors = inputSource ? validatePrimarySecManifest(inputSource, root) : null;
    const inputErrors = primarySecErrors === null ? validateCollectedArtifact(inputAbs, input.sha256, manifest.reference_close, root) : primarySecErrors;
    for (const error of inputErrors) errors.push(`calculation input ${input.name || input.path}: ${error}`);
  }
  return errors;
}

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
  const numericStringPaths = [];
  const visitNumericStrings = (value, prefix = '') => {
    if (typeof value === 'string' && /\d/.test(value)) numericStringPaths.push(prefix);
    else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) visitNumericStrings(child, prefix ? `${prefix}.${key}` : key);
  };
  visitNumericStrings(analysis);
  const required = [...new Set([...numericPaths(analysis), ...numericStringPaths])];
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
    let source;
    try { source = JSON.parse(bytes); } catch { errors.push(`${dotted}: source artifact is not valid JSON`); continue; }
    const calculationErrors = validateDeterministicCalculation(source, abs, claim.source_sha256, manifest, root);
    const collectedErrors = calculationErrors === null ? validateCollectedArtifact(abs, claim.source_sha256, manifest.reference_close, root) : calculationErrors;
    if (collectedErrors.length) { errors.push(`${dotted}: source collector provenance invalid: ${collectedErrors.join('; ')}`); continue; }
    if (!new RegExp(`(?:^|[^A-Z0-9.-])${ticker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^A-Z0-9.-])`, 'i').test(bytes.toString('utf8'))) {
      errors.push(`${dotted}: source artifact does not contain ${ticker}`);
    }
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
