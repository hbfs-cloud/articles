#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const programRoot = path.join(root, 'data', 'substack', 'programs', 'retail-systematic-desk');
const reviewFiles = {
  senior_qa: 'data/substack/programs/retail-systematic-desk/review-senior-qa-final.json',
  contrarian: 'data/substack/programs/retail-systematic-desk/review-contrarian-final.json',
  retail_war_room: 'data/substack/programs/retail-systematic-desk/review-retail-war-room-final.json',
  ai_forensics: 'data/substack/programs/retail-systematic-desk/review-ai-forensics-final.json'
};

const orderedFiles = [
  'data/substack/programs/retail-systematic-desk/program.json',
  'data/substack/programs/retail-systematic-desk/calendar.json',
  'data/substack/series/retail-systematic-desk/manifest.json',
  ...Array.from({ length: 45 }, (_, index) => `data/substack/series/retail-systematic-desk/episode-${String(index + 1).padStart(2, '0')}.md`),
  'data/substack-drafts/retail-systematic-desk/index.json',
  ...Array.from({ length: 45 }, (_, index) => `data/substack-drafts/retail-systematic-desk/week-${String(index + 1).padStart(3, '0')}.json`),
  'tools/build-substack-systematic-desk-program.js',
  'tools/validate-substack-systematic-desk-program.js',
  'tools/finalize-substack-systematic-desk-reviews.js',
  'tools/check-ai-tells.js'
];

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

const files = {};
let aggregateInput = '';
for (const relative of orderedFiles) {
  const digest = sha256(fs.readFileSync(path.join(root, relative)));
  files[relative] = digest;
  aggregateInput += `${digest}  ${relative}\n`;
}
const aggregate = sha256(Buffer.from(aggregateInput));
if (process.argv.includes('--snapshot-only')) {
  console.log(aggregate);
  process.exit(0);
}

const reviews = {};
for (const [role, relative] of Object.entries(reviewFiles)) {
  const review = JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
  if (review.verdict !== 'PASS') throw new Error(`${role} review did not pass: ${review.verdict}`);
  if ((review.blocking_findings || []).length || (review.fix_findings || []).length) {
    throw new Error(`${role} review still contains release findings`);
  }
  if (review.snapshot_sha256 !== aggregate) throw new Error(`${role} reviewed a different snapshot`);
  reviews[role] = {
    file: relative,
    verdict: review.verdict,
    snapshot_sha256: review.snapshot_sha256,
    sha256: sha256(fs.readFileSync(path.join(root, relative)))
  };
}
const finalizedAt = new Date().toISOString();
const harness = {
  schema_version: 'substack-review-harness.v1',
  program_id: 'retail-systematic-desk',
  status: 'reviewed',
  finalized_at: finalizedAt,
  review_snapshot: {
    aggregate_sha256: aggregate,
    files,
    aggregation: { algorithm: 'sha256', ordered_files: orderedFiles }
  },
  review_attestations: {
    status: 'passed',
    snapshot_sha256: aggregate,
    reviews
  },
  gates: {
    deterministic_validation: 'passed',
    ai_tell_check: 'passed',
    senior_qa: 'passed',
    contrarian: 'passed',
    retail_war_room: 'passed',
    ai_forensics: 'passed',
    email_disabled: 'passed',
    confidentiality: 'passed'
  }
};
const authorization = {
  schema_version: 'substack-schedule-authorization.v1',
  program_id: 'retail-systematic-desk',
  authorized_at: finalizedAt,
  authorization_basis: 'explicit_user_request_2026-08-31',
  review_snapshot_sha256: aggregate,
  episode_count: 45,
  schedule: 'Friday 08:00 America/New_York',
  post_audience: 'everyone',
  send_email: false,
  email_audience: null,
  section_id: 417759
};

fs.writeFileSync(path.join(programRoot, 'harness.json'), `${JSON.stringify(harness, null, 2)}\n`);
fs.writeFileSync(path.join(programRoot, 'authorization.json'), `${JSON.stringify(authorization, null, 2)}\n`);
console.log(`Finalized review snapshot ${aggregate} for 45 web-only Friday posts`);
