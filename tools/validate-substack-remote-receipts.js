#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const programRoot = path.join(repoRoot, 'data', 'substack', 'programs', 'retail-market-operating-system');
const program = JSON.parse(fs.readFileSync(path.join(programRoot, 'program.json'), 'utf8'));
const calendar = JSON.parse(fs.readFileSync(path.join(programRoot, 'calendar.json'), 'utf8'));
const harness = JSON.parse(fs.readFileSync(path.join(programRoot, 'harness.json'), 'utf8'));
const receiptPath = path.join(repoRoot, program.remote_contract.receipts_path);
const errors = [];
const fail = message => errors.push(message);

function frontMatterAndBody(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) throw new Error(`${file}: front matter missing`);
  const metadata = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    try { metadata[key] = JSON.parse(value); }
    catch { metadata[key] = value; }
  }
  return { metadata, body: raw.slice(match[0].length).trim() };
}

if (!fs.existsSync(receiptPath)) fail(`remote receipt file is missing: ${program.remote_contract.receipts_path}`);
else {
  const receipts = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  if (harness.status !== 'reviewed' || harness.review_attestations?.status !== 'passed') fail('review harness is not closed');
  if (harness.review_attestations?.snapshot_sha256 !== harness.review_snapshot?.aggregate_sha256) fail('review attestation snapshot mismatch');
  if (receipts.schema_version !== 'substack-remote-receipts.v1' || receipts.program_id !== program.program_id) fail('remote receipt identity mismatch');
  if (receipts.section_id !== program.remote_contract.section_id) fail('remote receipt section mismatch');
  if (receipts.send_email !== false || receipts.email_audience !== null) fail('remote receipts do not explicitly disable email');
  if (receipts.review_snapshot_sha256 !== harness.review_snapshot?.aggregate_sha256) fail('remote receipts are not tied to the reviewed snapshot');
  if (receipts.episodes?.length !== calendar.episode_count) fail(`expected ${calendar.episode_count} remote receipts`);
  const weeks = new Set();
  const draftIds = new Set();
  for (const receipt of receipts.episodes || []) {
    const slot = calendar.slots.find(item => item.week === receipt.week);
    if (!slot) {
      fail(`remote receipt has unknown week ${receipt.week}`);
      continue;
    }
    if (weeks.has(receipt.week)) fail(`duplicate remote receipt week ${receipt.week}`);
    weeks.add(receipt.week);
    if (!receipt.draft_id || draftIds.has(String(receipt.draft_id))) fail(`missing or duplicate draft id at week ${receipt.week}`);
    draftIds.add(String(receipt.draft_id));
    if (receipt.module_id !== slot.module_id || receipt.module_episode !== slot.module_episode) fail(`week ${receipt.week}: module metadata mismatch`);
    if (Date.parse(receipt.scheduled_at) !== Date.parse(slot.scheduled_at)) fail(`week ${receipt.week}: schedule mismatch`);
    if (receipt.post_audience !== slot.post_audience || receipt.email_audience !== null || receipt.send_email !== false) fail(`week ${receipt.week}: audience or email mismatch`);
    if (receipt.section_id !== program.remote_contract.section_id) fail(`week ${receipt.week}: section mismatch`);
    if (receipt.metadata_updated !== true || receipt.draft_validated !== true || receipt.schedule_readback_verified !== true) fail(`week ${receipt.week}: remote operation is incomplete`);
    if (!receipt.updated_at || !receipt.validated_at || !receipt.schedule_verified_at) fail(`week ${receipt.week}: remote timestamps are incomplete`);
    const local = frontMatterAndBody(path.join(repoRoot, slot.target_file));
    const reviewedFileHash = harness.review_snapshot?.files?.[slot.target_file];
    const currentFileHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(repoRoot, slot.target_file))).digest('hex');
    if (!reviewedFileHash || currentFileHash !== reviewedFileHash) fail(`week ${receipt.week}: current file differs from the reviewed snapshot`);
    if (receipt.reviewed_file_sha256 !== reviewedFileHash) fail(`week ${receipt.week}: receipt is not tied to the reviewed file`);
    const expectedHash = crypto.createHash('sha256').update(JSON.stringify({
      title: local.metadata.title,
      subtitle: local.metadata.subtitle,
      body_markdown: local.body
    })).digest('hex');
    if (receipt.content_sha256 !== expectedHash) fail(`week ${receipt.week}: local content hash mismatch`);
  }
  if (receipts.summary?.total !== calendar.episode_count || receipts.summary?.validated !== calendar.episode_count || receipts.summary?.schedule_verified !== calendar.episode_count) {
    fail('remote receipt summary is incomplete');
  }
}

for (const error of errors) console.error(`FAIL ${error}`);
if (errors.length) {
  console.error(`Remote receipt validation failed: ${errors.length} error(s)`);
  process.exit(1);
}
console.log(`Remote receipt validation passed: ${calendar.episode_count} no-email schedules verified`);
