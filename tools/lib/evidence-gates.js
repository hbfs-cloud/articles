'use strict';

const fs = require('fs');
const path = require('path');
const { sha256 } = require('./workflow-contract');

const SHA256_RE = /^[a-f0-9]{64}$/;

function validateCollectedArtifact(abs, expectedHash, expectedReferenceClose, root) {
  const errors = [];
  const dir = path.dirname(abs);
  let harness; let journal;
  try { harness = JSON.parse(fs.readFileSync(path.join(dir, 'harness.json'), 'utf8')); }
  catch { return ['no valid sibling harness.json']; }
  try { journal = JSON.parse(fs.readFileSync(path.join(dir, '_collect.json'), 'utf8')); }
  catch { return ['no valid sibling _collect.json']; }
  const alias = path.basename(abs, '.json');
  const source = (harness.sources || []).find(item => item.name === alias);
  if (!source || source.sha256 !== expectedHash || source.required === false) errors.push('artifact is not a required hash-certified harness source');
  if (harness.reference_close !== expectedReferenceClose || journal.reference_date !== expectedReferenceClose) errors.push('reference close differs across payload/harness/journal');
  if (!journal.resolved_input || sha256(Buffer.from(require('./workflow-contract').stableStringify(journal.resolved_input))) !== journal.input_sha256
    || journal.input_sha256 !== harness.input_sha256) errors.push('resolved input hash mismatch');
  if (journal.plan !== harness.plan || journal.plan_sha256 !== harness.plan_sha256) errors.push('plan provenance differs across harness/journal');
  const planPath = path.resolve(root, journal.plan || '');
  if (path.relative(root, planPath).startsWith('..') || !fs.existsSync(planPath)
    || sha256(fs.readFileSync(planPath)) !== journal.plan_sha256) errors.push('plan file hash mismatch');
  const call = (journal.waves || []).flatMap(wave => wave.calls || []).find(item => item.as === alias);
  if (!call || call.ok !== true || call.output_sha256 !== expectedHash) errors.push('collector journal has no matching successful output hash');
  const resolvedCall = (journal.resolved_input && journal.resolved_input.waves || []).flatMap(wave => wave.calls || []).find(item => item.as === alias);
  if (!resolvedCall || !call || resolvedCall.server !== call.server || resolvedCall.tool !== call.tool) {
    errors.push('collector output alias is absent from resolved plan input');
  }
  return errors;
}

function validateEvidenceManifest(payload, root, requiredIds = []) {
  const errors = [];
  const evidence = payload && payload.evidence;
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    return ['evidence must be an object mapping source IDs to hash-bound MCP artifacts'];
  }

  const ids = new Set(requiredIds);
  for (const item of [...(payload.ideas || []), ...(payload.candidates || [])]) {
    for (const id of item.source_ids || []) ids.add(id);
  }

  for (const id of ids) {
    const entry = evidence[id];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`evidence.${id} is missing`);
      continue;
    }
    if (!entry.path || typeof entry.path !== 'string' || path.isAbsolute(entry.path)) {
      errors.push(`evidence.${id}.path must be a repository-relative path`);
      continue;
    }
    const abs = path.resolve(root, entry.path);
    const relative = path.relative(root, abs);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      errors.push(`evidence.${id}.path escapes the repository`);
      continue;
    }
    if (!SHA256_RE.test(String(entry.sha256 || ''))) {
      errors.push(`evidence.${id}.sha256 is missing or invalid`);
      continue;
    }
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      errors.push(`evidence.${id}.path does not exist: ${entry.path}`);
      continue;
    }
    const realRoot = fs.realpathSync(root);
    const realAbs = fs.realpathSync(abs);
    const realRelative = path.relative(realRoot, realAbs);
    if (!realRelative || realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
      errors.push(`evidence.${id}.path resolves outside the repository`);
      continue;
    }
    const actualHash = sha256(fs.readFileSync(abs));
    if (actualHash !== entry.sha256) {
      errors.push(`evidence.${id} hash mismatch`);
      continue;
    }

    for (const error of validateCollectedArtifact(abs, actualHash, payload.reference_close, root)) errors.push(`evidence.${id}: ${error}`);

    if ((payload.ideas || []).length || (payload.candidates || []).length) {
      let serialized = '';
      try { serialized = JSON.stringify(JSON.parse(fs.readFileSync(abs, 'utf8'))); }
      catch { errors.push(`evidence.${id} is not valid JSON`); continue; }
      for (const item of [...(payload.ideas || []), ...(payload.candidates || [])]) {
        if (!(item.source_ids || []).includes(id)) continue;
        const ticker = String(item.ticker || item.symbol || '').toUpperCase();
        const escaped = ticker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (ticker && !new RegExp(`(?:^|[^A-Z0-9.-])${escaped}(?:$|[^A-Z0-9.-])`, 'i').test(serialized)) {
          errors.push(`evidence.${id} does not contain referenced ticker ${ticker}`);
        }
      }
    }
  }

  return [...new Set(errors)];
}

module.exports = { validateCollectedArtifact, validateEvidenceManifest };
