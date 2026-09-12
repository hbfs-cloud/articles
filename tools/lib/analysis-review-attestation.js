'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SCHEMA_VERSION = 'AQ-1.1';
const RUBRIC_VERSION = 'AQ-1';
const ATTESTATION_SCHEMA_VERSION = 'AQ-1.1-attestation';
const ROLES = new Set(['senior_qa', 'contrarian', 'retail_war_room']);
const CHECK_STATUSES = new Set(['PASS', 'BLOCK', 'N/A']);
const SHA256 = /^[a-f0-9]{64}$/;
const TICKER = /^[A-Z][A-Z0-9.-]{0,14}$/;
const safeRelativePath = value => typeof value === 'string' && value.length > 0 && !path.isAbsolute(value) && !value.split(/[\\/]+/).includes('..');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const genericReviewerName = value => /^(?:senior|contrarian|retail|reviewer|qa|quality|war|room|editorial|gate)(?:\s+(?:senior|contrarian|retail|reviewer|qa|quality|war|room|editorial|gate))*$/i.test(String(value || '').trim());
const isNamedReviewer = value => typeof value === 'string' && value.trim().split(/\s+/).length >= 2 && value.trim().length >= 3 && !genericReviewerName(value) && !/deterministic gate/i.test(value);
const canonicalEvidencePath = ticker => `data/analyses-evidence/${ticker}.json`;

function rubricCheckIds(root) {
  const rubricPath = path.join(root, 'plans', 'analysis-quality-rubric-20260828.md');
  const rubric = fs.readFileSync(rubricPath, 'utf8');
  const ids = [...new Set(rubric.match(/AQ-[A-Z]+-\d{3}/g) || [])].sort();
  if (ids.length !== 38) throw new Error(`AQ-1 rubric must expose 38 checks, found ${ids.length}`);
  return ids;
}

function exactIdSet(ids, expected) {
  if (!Array.isArray(ids) || ids.length !== expected.length) return false;
  const actual = new Set(ids);
  return actual.size === expected.length && expected.every(id => actual.has(id));
}

function exactIdPartition(passed, notApplicable, expected) {
  if (!Array.isArray(passed) || !Array.isArray(notApplicable)) return false;
  const combined = [...passed, ...notApplicable];
  return exactIdSet(combined, expected);
}

function deriveOutcomes(submissions, checkIds) {
  const passedCheckIds = [];
  const notApplicableCheckIds = [];
  for (const id of checkIds) {
    const statuses = submissions.map(submission => submission.checks.find(check => check.id === id).status);
    if (statuses.every(status => status === 'N/A')) notApplicableCheckIds.push(id);
    else if (statuses.every(status => status !== 'BLOCK') && statuses.some(status => status === 'PASS')) passedCheckIds.push(id);
    else throw new Error(`AQ-1 outcome is not publishable for ${id}`);
  }
  return { passedCheckIds, notApplicableCheckIds };
}

function validateChecks(checks, checkIds) {
  const errors = [];
  if (!Array.isArray(checks)) return ['checks must be an array'];
  const ids = checks.map(check => check && check.id);
  if (!exactIdSet(ids, checkIds)) errors.push('checks must contain each AQ-1 ID exactly once');
  for (const check of checks) {
    if (!check || typeof check !== 'object') { errors.push('each check must be an object'); continue; }
    if (!CHECK_STATUSES.has(check.status)) errors.push(`invalid check status for ${check.id || 'unknown'}`);
    if (typeof check.rationale !== 'string' || check.rationale.trim().length < 5) errors.push(`check rationale is required for ${check.id || 'unknown'}`);
    if (!Array.isArray(check.evidenceRefs) || !check.evidenceRefs.length || check.evidenceRefs.some(ref => typeof ref !== 'string' || !ref.trim())) {
      errors.push(`check evidenceRefs must be non-empty strings for ${check.id || 'unknown'}`);
    }
  }
  return [...new Set(errors)];
}

function validateSubmission(submission, { ticker, analysisPath, analysisSha256, evidencePath, evidenceSha256, checkIds }) {
  const errors = [];
  if (!submission || typeof submission !== 'object') return ['attestation submission must be an object'];
  if (submission.schemaVersion !== ATTESTATION_SCHEMA_VERSION) errors.push(`attestation schemaVersion must be ${ATTESTATION_SCHEMA_VERSION}`);
  if (String(submission.ticker || '').toUpperCase() !== ticker) errors.push(`${ticker}: attestation ticker mismatch`);
  if (submission.analysisPath !== analysisPath || !safeRelativePath(submission.analysisPath)) errors.push(`${ticker}: analysisPath mismatch or unsafe`);
  if (!SHA256.test(String(submission.analysisSha256 || ''))) errors.push(`${ticker}: analysisSha256 is missing or invalid`);
  else if (submission.analysisSha256 !== analysisSha256) errors.push(`${ticker}: attestation analysisSha256 does not match current dossier`);
  if (submission.evidencePath !== evidencePath || !safeRelativePath(submission.evidencePath)) errors.push(`${ticker}: evidencePath mismatch or unsafe`);
  if (submission.evidencePath !== canonicalEvidencePath(ticker)) errors.push(`${ticker}: evidencePath must be the canonical sidecar`);
  if (!SHA256.test(String(submission.evidenceSha256 || ''))) errors.push(`${ticker}: evidenceSha256 is missing or invalid`);
  else if (submission.evidenceSha256 !== evidenceSha256) errors.push(`${ticker}: attestation evidenceSha256 mismatch`);
  if (typeof submission.reviewerId !== 'string' || !/^[a-z0-9][a-z0-9._-]{2,63}$/i.test(submission.reviewerId)) errors.push(`${ticker}: reviewerId is invalid`);
  if (!isNamedReviewer(submission.reviewerName)) errors.push(`${ticker}: reviewerName must name a non-generic reviewer`);
  if (!Array.isArray(submission.roles) || !submission.roles.length || new Set(submission.roles).size !== submission.roles.length || submission.roles.some(role => !ROLES.has(role))) errors.push(`${ticker}: reviewer roles are invalid`);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(String(submission.reviewedAt || ''))) errors.push(`${ticker}: reviewedAt must be ISO timestamp`);
  if (submission.status !== 'PASS') errors.push(`${ticker}: submission status must be PASS before recording`);
  if (!Number.isFinite(Number(submission.score)) || Number(submission.score) < 80 || Number(submission.score) > 100) errors.push(`${ticker}: reviewer score must be 80-100`);
  errors.push(...validateChecks(submission.checks, checkIds).map(error => `${ticker}: ${error}`));
  const blocking = (submission.checks || []).filter(check => check && check.status === 'BLOCK');
  if (blocking.length) errors.push(`${ticker}: submission retains BLOCK checks: ${blocking.map(check => check.id).join(', ')}`);
  return [...new Set(errors)];
}

function normalizeSubmission(submission, source) {
  return {
    ...submission,
    attestationPath: source.path,
    attestationSha256: source.sha256
  };
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function withoutProvenance(reviewer) {
  const { attestationPath, attestationSha256, ...submission } = reviewer;
  return submission;
}

function validateRecordedFile(root, relativePath, expectedHash, label) {
  if (!root) return [];
  if (!safeRelativePath(relativePath)) return [`${label} path is unsafe`];
  const absolute = path.resolve(root, relativePath);
  const relative = path.relative(root, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(absolute)) return [`${label} is missing`];
  return sha256(fs.readFileSync(absolute)) === expectedHash ? [] : [`${label} hash no longer matches`];
}

function validateRecordedSubmission(root, reviewer) {
  if (!root || !safeRelativePath(reviewer.attestationPath)) return [];
  const absolute = path.resolve(root, reviewer.attestationPath);
  const relative = path.relative(root, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(absolute)) return [];
  try {
    const payload = JSON.parse(fs.readFileSync(absolute, 'utf8'));
    if (payload.schemaVersion !== ATTESTATION_SCHEMA_VERSION || !Array.isArray(payload.reviews)) {
      return [`reviewer ${reviewer.reviewerId || 'unknown'} attestation payload is malformed`];
    }
    const expected = canonicalJson(withoutProvenance(reviewer));
    return payload.reviews.some(submission => canonicalJson(submission) === expected)
      ? []
      : [`reviewer ${reviewer.reviewerId || 'unknown'} does not match the attestation submission`];
  } catch {
    return [`reviewer ${reviewer.reviewerId || 'unknown'} attestation payload is unreadable`];
  }
}

function validateReviewRecord(review, { ticker, analysisPath, analysisSha256, checkIds, requireCurrent = false, root = null }) {
  const errors = [];
  if (!review || typeof review !== 'object') return ['missing external editorial review manifest entry'];
  if (review.schemaVersion !== SCHEMA_VERSION) {
    if (requireCurrent) errors.push(`external review must use ${SCHEMA_VERSION}`);
    return errors;
  }
  if (review.rubricVersion !== RUBRIC_VERSION) errors.push('external review rubricVersion must be AQ-1');
  if (String(review.ticker || '').toUpperCase() !== ticker) errors.push('external review ticker mismatch');
  if (review.status !== 'PASS') errors.push('external editorial review is not PASS');
  if (!Number.isFinite(Number(review.score)) || Number(review.score) < 80 || Number(review.score) > 100) errors.push(`external editorial score is invalid (${review.score ?? 'missing'})`);
  if (review.fileSha256 !== analysisSha256) errors.push('external review hash does not match dossier JSON');
  if (review.analysisPath !== analysisPath || !safeRelativePath(review.analysisPath)) errors.push('external review analysis path is unsafe or mismatched');
  else errors.push(...validateRecordedFile(root, review.analysisPath, review.fileSha256, 'external review dossier'));
  if (!SHA256.test(String(review.evidenceSha256 || ''))) errors.push('external review evidence hash is missing');
  if (!safeRelativePath(review.evidencePath)) errors.push('external review evidence path is unsafe');
  if (review.evidencePath !== canonicalEvidencePath(ticker)) errors.push('external review evidence path is not the canonical sidecar');
  else errors.push(...validateRecordedFile(root, review.evidencePath, review.evidenceSha256, 'external review evidence'));
  if (!exactIdPartition(review.passedCheckIds, review.notApplicableCheckIds, checkIds)) errors.push('external review lacks an exact AQ-1 PASS/N/A partition');
  if (!Array.isArray(review.failedCheckIds) || review.failedCheckIds.length !== 0) errors.push('external review retains failed AQ checks');
  const reviewers = review.reviewers;
  if (!Array.isArray(reviewers) || reviewers.length < 2) return [...errors, 'external review needs at least two independent reviewers'];
  const ids = new Set(), names = new Set(), roles = new Set();
  for (const reviewer of reviewers) {
    if (!reviewer || typeof reviewer !== 'object') { errors.push('reviewer entry must be an object'); continue; }
    if (typeof reviewer.reviewerId !== 'string' || !/^[a-z0-9][a-z0-9._-]{2,63}$/i.test(reviewer.reviewerId) || /deterministic[-_ ]?gate/i.test(reviewer.reviewerId) || ids.has(reviewer.reviewerId)) errors.push('reviewer IDs must be distinct named reviewer IDs');
    ids.add(reviewer.reviewerId);
    if (!isNamedReviewer(reviewer.reviewerName) || names.has(String(reviewer.reviewerName || '').trim().toLowerCase())) errors.push('reviewer names must be distinct named reviewers');
    names.add(String(reviewer.reviewerName || '').trim().toLowerCase());
    if (!Array.isArray(reviewer.roles) || !reviewer.roles.length || new Set(reviewer.roles).size !== reviewer.roles.length || reviewer.roles.some(role => !ROLES.has(role))) errors.push(`reviewer ${reviewer.reviewerId || 'unknown'} roles are invalid`);
    for (const role of reviewer.roles || []) roles.add(role);
    if (reviewer.schemaVersion !== ATTESTATION_SCHEMA_VERSION) errors.push(`reviewer ${reviewer.reviewerId || 'unknown'} attestation schema is invalid`);
    if (reviewer.status !== 'PASS') errors.push(`reviewer ${reviewer.reviewerId || 'unknown'} status is not PASS`);
    if (!Number.isFinite(Number(reviewer.score)) || Number(reviewer.score) < 80 || Number(reviewer.score) > 100) errors.push(`reviewer ${reviewer.reviewerId || 'unknown'} score is invalid`);
    if (!/^\d{4}-\d{2}-\d{2}T/.test(String(reviewer.reviewedAt || ''))) errors.push(`reviewer ${reviewer.reviewerId || 'unknown'} reviewedAt is invalid`);
    if (reviewer.analysisPath !== review.analysisPath || !safeRelativePath(reviewer.analysisPath)) errors.push(`reviewer ${reviewer.reviewerId || 'unknown'} analysis path is unsafe or mismatched`);
    if (reviewer.analysisSha256 !== analysisSha256) errors.push(`reviewer ${reviewer.reviewerId || 'unknown'} hash does not match dossier`);
    if (reviewer.evidencePath !== review.evidencePath) errors.push(`reviewer ${reviewer.reviewerId || 'unknown'} evidence path does not match review evidence`);
    if (reviewer.evidenceSha256 !== review.evidenceSha256) errors.push(`reviewer ${reviewer.reviewerId || 'unknown'} evidence hash does not match review evidence`);
    if (!SHA256.test(String(reviewer.evidenceSha256 || ''))) errors.push(`reviewer ${reviewer.reviewerId || 'unknown'} evidence hash is missing`);
    if (!safeRelativePath(reviewer.evidencePath)) errors.push(`reviewer ${reviewer.reviewerId || 'unknown'} evidence path is unsafe`);
    if (!SHA256.test(String(reviewer.attestationSha256 || ''))) errors.push(`reviewer ${reviewer.reviewerId || 'unknown'} attestation hash is missing`);
    if (!safeRelativePath(reviewer.attestationPath)) errors.push(`reviewer ${reviewer.reviewerId || 'unknown'} attestation path is unsafe`);
    else errors.push(...validateRecordedFile(root, reviewer.attestationPath, reviewer.attestationSha256, `reviewer ${reviewer.reviewerId || 'unknown'} attestation`));
    errors.push(...validateRecordedSubmission(root, reviewer));
    errors.push(...validateChecks(reviewer.checks, checkIds).map(error => `reviewer ${reviewer.reviewerId || 'unknown'}: ${error}`));
    if ((reviewer.checks || []).some(check => check && check.status === 'BLOCK')) errors.push(`reviewer ${reviewer.reviewerId || 'unknown'} retains BLOCK checks`);
  }
  for (const role of ROLES) if (!roles.has(role)) errors.push(`review panel lacks required ${role} role`);
  return [...new Set(errors)];
}

function buildReviewRecord({ ticker, analysisPath, analysisSha256, evidencePath, evidenceSha256, submissions, checkIds }) {
  const errors = [];
  if (!TICKER.test(ticker)) errors.push('ticker is invalid');
  if (!SHA256.test(String(analysisSha256 || ''))) errors.push(`${ticker}: current analysis hash is invalid`);
  if (!SHA256.test(String(evidenceSha256 || ''))) errors.push(`${ticker}: current evidence hash is invalid`);
  const reviewerIds = new Set();
  for (const submission of submissions || []) {
    errors.push(...validateSubmission(submission, { ticker, analysisPath, analysisSha256, evidencePath, evidenceSha256, checkIds }));
    if (reviewerIds.has(submission?.reviewerId)) errors.push(`${ticker}: duplicate reviewerId ${submission?.reviewerId}`);
    reviewerIds.add(submission?.reviewerId);
  }
  if ((submissions || []).length < 2) errors.push(`${ticker}: at least two independent reviewer submissions are required`);
  if (errors.length) throw new Error([...new Set(errors)].join('\n'));
  const roles = new Set(submissions.flatMap(submission => submission.roles));
  for (const role of ROLES) if (!roles.has(role)) throw new Error(`${ticker}: review panel lacks required ${role} role`);
  const outcomes = deriveOutcomes(submissions, checkIds);
  return {
    schemaVersion: SCHEMA_VERSION,
    rubricVersion: RUBRIC_VERSION,
    ticker,
    status: 'PASS',
    score: Math.min(...submissions.map(submission => Number(submission.score))),
    reviewers: submissions,
    reviewedAt: new Date().toISOString(),
    passedCheckIds: outcomes.passedCheckIds,
    notApplicableCheckIds: outcomes.notApplicableCheckIds,
    failedCheckIds: [],
    notes: submissions.map(submission => submission.notes).filter(Boolean).join('\n'),
    analysisPath,
    fileSha256: analysisSha256,
    evidencePath,
    evidenceSha256
  };
}

function mergeManifest(existing, additions) {
  const prior = Array.isArray(existing?.reviews) ? existing.reviews.slice() : [];
  const byTicker = new Map(prior.map(review => [String(review.ticker || '').toUpperCase(), review]));
  for (const review of additions) {
    const ticker = String(review.ticker || '').toUpperCase();
    const previous = byTicker.get(ticker);
    if (previous && previous.fileSha256 !== review.fileSha256) throw new Error(`${ticker}: refusing to overwrite an existing review for a different dossier hash`);
    byTicker.set(ticker, review);
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    rubricVersion: RUBRIC_VERSION,
    generatedAt: new Date().toISOString(),
    reviews: [...byTicker.values()].sort((a, b) => String(a.ticker).localeCompare(String(b.ticker)))
  };
}

module.exports = {
  ATTESTATION_SCHEMA_VERSION,
  RUBRIC_VERSION,
  SCHEMA_VERSION,
  buildReviewRecord,
  canonicalEvidencePath,
  deriveOutcomes,
  mergeManifest,
  normalizeSubmission,
  rubricCheckIds,
  sha256,
  validateReviewRecord,
  validateSubmission
};
