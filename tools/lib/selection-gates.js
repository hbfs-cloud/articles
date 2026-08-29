'use strict';

const fs = require('fs');
const path = require('path');
const { sha256 } = require('./workflow-contract');
const { validateCollectedArtifact } = require('./evidence-gates');

function extractRankable(value, out = []) {
  if (Array.isArray(value)) { value.forEach(item => extractRankable(item, out)); return out; }
  if (!value || typeof value !== 'object') return out;
  const ticker = String(value.symbol || value.ticker || '').toUpperCase();
  const score = Number(value.score ?? value.source_score ?? value.features?.custom_score);
  if (/^[A-Z][A-Z0-9.-]{0,14}$/.test(ticker) && Number.isFinite(score)) out.push({ ticker, score });
  Object.values(value).forEach(child => extractRankable(child, out));
  return out;
}

function validateSelection(payload, root, maxSelected) {
  const errors = [];
  const selection = payload && payload.selection;
  if (!selection || !Array.isArray(selection.source_artifacts) || !selection.source_artifacts.length) {
    return ['selection.source_artifacts[] is required'];
  }
  const candidates = new Map();
  for (const source of selection.source_artifacts) {
    if (!source.path || path.isAbsolute(source.path) || !/^[a-f0-9]{64}$/.test(String(source.sha256 || ''))) {
      errors.push('selection source path/hash invalid'); continue;
    }
    const abs = path.resolve(root, source.path);
    if (path.relative(root, abs).startsWith('..') || !fs.existsSync(abs)) { errors.push(`selection source missing: ${source.path}`); continue; }
    const bytes = fs.readFileSync(abs);
    if (sha256(bytes) !== source.sha256) { errors.push(`selection source hash mismatch: ${source.path}`); continue; }
    const harnessPath = path.join(path.dirname(abs), 'harness.json');
    let harness;
    try { harness = JSON.parse(fs.readFileSync(harnessPath, 'utf8')); }
    catch { errors.push(`selection source has no valid sibling harness: ${source.path}`); continue; }
    const alias = path.basename(abs, '.json');
    const certified = (harness.sources || []).find(item => item.name === alias);
    if (!certified || certified.sha256 !== source.sha256 || certified.required === false) {
      errors.push(`selection source is not a required hash-certified harness source: ${source.path}`); continue;
    }
    if (harness.reference_close !== payload.reference_close
      || !/^[a-f0-9]{64}$/.test(String(harness.plan_sha256 || ''))
      || !/^[a-f0-9]{64}$/.test(String(harness.input_sha256 || ''))) {
      errors.push(`selection source harness provenance is incomplete: ${source.path}`); continue;
    }
    const collectedErrors = validateCollectedArtifact(abs, source.sha256, payload.reference_close, root);
    if (collectedErrors.length) { errors.push(`selection source collector provenance invalid: ${collectedErrors.join('; ')}`); continue; }
    if (!['plans/aplus-screen.json', 'plans/signals-desk.json'].includes(harness.plan)) {
      errors.push(`selection source plan is not an authorized screener plan: ${source.path}`); continue;
    }
    const planPath = path.resolve(root, harness.plan);
    if (path.relative(root, planPath).startsWith('..') || !fs.existsSync(planPath)
      || sha256(fs.readFileSync(planPath)) !== harness.plan_sha256) {
      errors.push(`selection source plan hash is invalid: ${source.path}`); continue;
    }
    let plan;
    try { plan = JSON.parse(fs.readFileSync(planPath, 'utf8')); } catch { errors.push(`selection plan JSON is invalid: ${harness.plan}`); continue; }
    const declaration = (plan.waves || []).flatMap(wave => wave.calls || []).find(call => call.as === alias);
    if (!declaration || declaration.server !== 'marketdata' || !['RunScreener', 'RunAutoScreener'].includes(declaration.tool)) {
      errors.push(`selection source alias is not an authorized screener call: ${alias}`); continue;
    }
    let parsed;
    try { parsed = JSON.parse(bytes); } catch { errors.push(`selection source is invalid JSON: ${source.path}`); continue; }
    for (const row of extractRankable(parsed)) {
      if (!candidates.has(row.ticker) || candidates.get(row.ticker) < row.score) candidates.set(row.ticker, row.score);
    }
  }
  const expected = [...candidates].map(([ticker, score]) => ({ ticker, score }))
    .sort((a, b) => b.score - a.score || a.ticker.localeCompare(b.ticker));
  const ranking = Array.isArray(selection.ranking) ? selection.ranking : [];
  if (ranking.length !== expected.length) errors.push(`selection ranking has ${ranking.length} rows; source universe has ${expected.length}`);
  for (let i = 0; i < expected.length; i++) {
    const actual = ranking[i] || {};
    if (actual.rank !== i + 1 || actual.ticker !== expected[i].ticker || actual.source_score !== expected[i].score) {
      errors.push(`selection rank ${i + 1} must be ${expected[i].ticker} at score ${expected[i].score}`);
    }
  }
  const selected = Array.isArray(selection.selected_for_verify) ? selection.selected_for_verify : [];
  const expectedSelected = expected.slice(0, maxSelected).map(row => row.ticker);
  if (JSON.stringify(selected) !== JSON.stringify(expectedSelected)) errors.push('selected_for_verify must equal the deterministic top-ranked slice');
  const finalTickers = new Set([...(payload.ideas || []), ...(payload.candidates || [])].map(item => String(item.ticker || '').toUpperCase()));
  const rejected = new Map((selection.verification_rejections || []).map(row => [row.ticker, row.reasons]));
  for (const ticker of selected) {
    if (finalTickers.has(ticker)) continue;
    if (!Array.isArray(rejected.get(ticker)) || rejected.get(ticker).length === 0) errors.push(`${ticker}: selected name is neither final nor explicitly rejected`);
  }
  for (const ticker of finalTickers) if (!selected.includes(ticker)) errors.push(`${ticker}: final item was not selected_for_verify`);
  return [...new Set(errors)];
}

module.exports = { extractRankable, validateSelection };
