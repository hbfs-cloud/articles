#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const programRoot = path.join(root, 'data', 'substack', 'programs', 'retail-systematic-desk');
const calendar = JSON.parse(fs.readFileSync(path.join(programRoot, 'calendar.json'), 'utf8'));
const harness = JSON.parse(fs.readFileSync(path.join(programRoot, 'harness.json'), 'utf8'));
const authorization = JSON.parse(fs.readFileSync(path.join(programRoot, 'authorization.json'), 'utf8'));
const receipts = JSON.parse(fs.readFileSync(path.join(programRoot, 'remote-receipts.json'), 'utf8'));
const errors = [];
const fail = message => errors.push(message);
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

if (receipts.episodes?.length !== 45) fail('expected 45 remote receipts');
if (receipts.summary?.validated !== 45 || receipts.summary?.schedule_verified !== 45) fail('remote summary is incomplete');
if (receipts.summary?.email_enabled !== 0) fail('remote summary reports email delivery');
if (receipts.send_email !== false || receipts.email_audience !== null) fail('remote delivery contract enables email');
if (receipts.review_snapshot_sha256 !== harness.review_snapshot.aggregate_sha256) fail('receipt snapshot does not match harness');
if (authorization.review_snapshot_sha256 !== harness.review_snapshot.aggregate_sha256) fail('authorization snapshot does not match harness');

const seenWeeks = new Set();
const seenDates = new Set();
const seenDraftIds = new Set();
for (const receipt of receipts.episodes || []) {
  if (seenWeeks.has(receipt.week)) fail(`duplicate receipt week ${receipt.week}`);
  seenWeeks.add(receipt.week);
  const slot = calendar.slots[receipt.week - 1];
  if (!slot) { fail(`unknown receipt week ${receipt.week}`); continue; }
  if (receipt.title !== slot.title || receipt.scheduled_at !== slot.scheduled_at) fail(`week ${receipt.week}: calendar mismatch`);
  if (receipt.post_audience !== 'everyone' || receipt.send_email !== false || receipt.email_audience !== null) fail(`week ${receipt.week}: delivery mismatch`);
  if (receipt.section_id !== 417759 || receipt.schedule_readback_verified !== true) fail(`week ${receipt.week}: schedule verification missing`);
  if (seenDates.has(receipt.scheduled_at)) fail(`duplicate remote date ${receipt.scheduled_at}`);
  seenDates.add(receipt.scheduled_at);
  if (receipt.draft_id !== null) {
    if (seenDraftIds.has(receipt.draft_id)) fail(`duplicate draft id ${receipt.draft_id}`);
    seenDraftIds.add(receipt.draft_id);
  }
  const payloadFile = path.join(root, receipt.payload_file);
  if (!fs.existsSync(payloadFile)) fail(`week ${receipt.week}: payload missing`);
  else if (sha256(payloadFile) !== receipt.payload_file_sha256) fail(`week ${receipt.week}: payload hash mismatch`);
  if (receipt.review_snapshot_sha256 !== harness.review_snapshot.aggregate_sha256) fail(`week ${receipt.week}: reviewed snapshot mismatch`);
}

const missingDraftIds = (receipts.episodes || []).filter(item => item.draft_id === null).map(item => item.week);
const incidentWeeks = receipts.incidents?.find(item => item.id === 'SUBSTACK-RATE-429-001')?.weeks || [];
if (JSON.stringify(missingDraftIds) !== JSON.stringify(incidentWeeks)) fail('missing draft ids are not fully covered by the rate-limit incident');
if (seenWeeks.size !== 45 || seenDates.size !== 45) fail('remote calendar has a gap or duplicate');

for (const error of errors) console.error(`FAIL ${error}`);
if (errors.length) {
  console.error(`Remote schedule validation failed: ${errors.length} error(s)`);
  process.exit(1);
}
console.log(`Remote schedule validation passed: 45 Fridays, 45 readbacks, email disabled; ${seenDraftIds.size} draft ids retained`);
