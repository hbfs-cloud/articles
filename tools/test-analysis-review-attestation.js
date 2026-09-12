'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ATTESTATION_SCHEMA_VERSION,
  buildReviewRecord,
  mergeManifest,
  rubricCheckIds,
  sha256,
  validateReviewRecord
} = require('./lib/analysis-review-attestation');

const ROOT = path.resolve(__dirname, '..');
const checkIds = rubricCheckIds(ROOT);
const analysisSha256 = 'a'.repeat(64);
const evidenceSha256 = 'b'.repeat(64);
const attestationSha256 = 'c'.repeat(64);
const base = {
  ticker: 'TEST',
  analysisPath: 'data/analyses-data/TEST.json',
  analysisSha256,
  evidencePath: 'data/analyses-evidence/TEST.json',
  evidenceSha256
};

function submission(id, name, roles) {
  return {
    schemaVersion: ATTESTATION_SCHEMA_VERSION,
    ...base,
    reviewerId: id,
    reviewerName: name,
    roles,
    reviewedAt: '2026-09-12T10:00:00.000Z',
    status: 'PASS',
    score: 91,
    notes: `${name} review complete`,
    attestationPath: `data/analysis-review-queue/20260912/TEST/submissions/${id}.json`,
    attestationSha256,
    checks: checkIds.map(id => ({ id, status: 'PASS', rationale: 'Reviewed against the cited dossier evidence.', evidenceRefs: ['data/analyses-evidence/TEST.json'] }))
  };
}

function record(submissions) {
  return buildReviewRecord({ ...base, submissions, checkIds });
}

const valid = record([
  submission('senior-01', 'Aline Durand', ['senior_qa']),
  submission('contrarian-01', 'Benoit Martin', ['contrarian', 'retail_war_room'])
]);
assert.deepStrictEqual(validateReviewRecord(valid, { ticker: 'TEST', analysisPath: base.analysisPath, analysisSha256, checkIds, requireCurrent: true }), []);
assert.strictEqual(valid.passedCheckIds.length, 38);
assert.strictEqual(valid.reviewers.length, 2);

const notApplicableSenior = submission('senior-01', 'Aline Durand', ['senior_qa']);
const notApplicableContrarian = submission('contrarian-01', 'Benoit Martin', ['contrarian', 'retail_war_room']);
notApplicableSenior.checks[0].status = 'N/A';
notApplicableContrarian.checks[0].status = 'N/A';
const withNotApplicable = record([notApplicableSenior, notApplicableContrarian]);
assert(!withNotApplicable.passedCheckIds.includes(checkIds[0]));
assert.deepStrictEqual(withNotApplicable.notApplicableCheckIds, [checkIds[0]]);
assert.deepStrictEqual(validateReviewRecord(withNotApplicable, { ticker: 'TEST', analysisPath: base.analysisPath, analysisSha256, checkIds, requireCurrent: true }), []);

const missingHash = submission('senior-01', 'Aline Durand', ['senior_qa']);
missingHash.analysisSha256 = '';
assert.throws(() => record([missingHash, submission('contrarian-01', 'Benoit Martin', ['contrarian', 'retail_war_room'])]), /analysisSha256 is missing or invalid/);

const wrongHash = submission('senior-01', 'Aline Durand', ['senior_qa']);
wrongHash.analysisSha256 = 'd'.repeat(64);
assert.throws(() => record([wrongHash, submission('contrarian-01', 'Benoit Martin', ['contrarian', 'retail_war_room'])]), /does not match current dossier/);

const duplicateIds = submission('senior-01', 'Aline Durand', ['senior_qa']);
duplicateIds.checks[1].id = duplicateIds.checks[0].id;
assert.throws(() => record([duplicateIds, submission('contrarian-01', 'Benoit Martin', ['contrarian', 'retail_war_room'])]), /each AQ-1 ID exactly once/);

const unrelatedEvidence = submission('senior-01', 'Aline Durand', ['senior_qa']);
unrelatedEvidence.evidencePath = 'data/analyses-evidence/OTHER.json';
assert.throws(() => record([unrelatedEvidence, submission('contrarian-01', 'Benoit Martin', ['contrarian', 'retail_war_room'])]), /canonical sidecar/);

assert.throws(() => record([
  submission('senior-01', 'Aline Durand', ['senior_qa']),
  submission('retail-01', 'Carla Smith', ['retail_war_room'])
]), /lacks required contrarian role/);

assert.throws(() => record([
  submission('contrarian-01', 'Benoit Martin', ['senior_qa', 'contrarian', 'retail_war_room'])
]), /at least two independent reviewer submissions/);

const other = { ticker: 'OTHER', fileSha256: 'e'.repeat(64), status: 'PASS', rubricVersion: 'AQ-1' };
const merged = mergeManifest({ rubricVersion: 'AQ-1', reviews: [other] }, [valid]);
assert.strictEqual(merged.schemaVersion, 'AQ-1.1');
assert.deepStrictEqual(merged.reviews.map(review => review.ticker), ['OTHER', 'TEST']);
assert.throws(() => mergeManifest({ reviews: [{ ...valid, fileSha256: 'f'.repeat(64) }] }, [valid]), /refusing to overwrite/);

const proofRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aq11-proof-'));
const proofDossier = path.join(proofRoot, base.analysisPath);
const proofEvidence = path.join(proofRoot, base.evidencePath);
const proofAttestation = path.join(proofRoot, 'data/analysis-review-queue/20260912/TEST/submissions/panel.json');
fs.mkdirSync(path.dirname(proofDossier), { recursive: true });
fs.mkdirSync(path.dirname(proofEvidence), { recursive: true });
fs.mkdirSync(path.dirname(proofAttestation), { recursive: true });
fs.writeFileSync(proofDossier, '{"ticker":"TEST"}\n');
fs.writeFileSync(proofEvidence, '{"evidence":"current"}\n');
const proofRecord = JSON.parse(JSON.stringify(valid));
proofRecord.fileSha256 = sha256(fs.readFileSync(proofDossier));
proofRecord.evidenceSha256 = sha256(fs.readFileSync(proofEvidence));
proofRecord.reviewers.forEach(reviewer => {
  reviewer.analysisSha256 = proofRecord.fileSha256;
  reviewer.evidenceSha256 = proofRecord.evidenceSha256;
  reviewer.attestationPath = 'data/analysis-review-queue/20260912/TEST/submissions/panel.json';
});
const sourcePayload = { schemaVersion: ATTESTATION_SCHEMA_VERSION, reviews: proofRecord.reviewers.map(({ attestationPath, attestationSha256, ...submission }) => submission) };
fs.writeFileSync(proofAttestation, JSON.stringify(sourcePayload));
const proofHash = sha256(fs.readFileSync(proofAttestation));
proofRecord.reviewers.forEach(reviewer => { reviewer.attestationSha256 = proofHash; });
assert.deepStrictEqual(validateReviewRecord(proofRecord, { ticker: 'TEST', analysisPath: base.analysisPath, analysisSha256: proofRecord.fileSha256, checkIds, requireCurrent: true, root: proofRoot }), []);
fs.writeFileSync(proofEvidence, '{"evidence":"mutated"}\n');
assert(validateReviewRecord(proofRecord, { ticker: 'TEST', analysisPath: base.analysisPath, analysisSha256: proofRecord.fileSha256, checkIds, requireCurrent: true, root: proofRoot }).some(error => /evidence hash no longer matches/.test(error)));
fs.writeFileSync(proofEvidence, '{"evidence":"current"}\n');
const alteredPayload = JSON.parse(JSON.stringify(sourcePayload));
alteredPayload.reviews[0].reviewerName = 'Celia Laurent';
fs.writeFileSync(proofAttestation, JSON.stringify(alteredPayload));
const alteredProofHash = sha256(fs.readFileSync(proofAttestation));
proofRecord.reviewers.forEach(reviewer => { reviewer.attestationSha256 = alteredProofHash; });
assert(validateReviewRecord(proofRecord, { ticker: 'TEST', analysisPath: base.analysisPath, analysisSha256: proofRecord.fileSha256, checkIds, requireCurrent: true, root: proofRoot }).some(error => /does not match the attestation submission/.test(error)));
fs.rmSync(proofRoot, { recursive: true, force: true });

console.log('analysis review attestation: PASS; hash, reviewers, exact AQ IDs, roles, and same-date merge are fail-closed');
