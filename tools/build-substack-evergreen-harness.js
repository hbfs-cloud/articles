#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const programRoot = path.join(repoRoot, 'data', 'substack', 'programs', 'retail-market-operating-system');
const program = JSON.parse(fs.readFileSync(path.join(programRoot, 'program.json'), 'utf8'));
const calendar = JSON.parse(fs.readFileSync(path.join(programRoot, 'calendar.json'), 'utf8'));
const verifiedExistingSchedules = calendar.slots.filter(slot =>
  slot.module_id === 'trade-signal-check' && slot.remote_status === 'verified_scheduled'
).length;

function fail(message) {
  console.error(`Evergreen harness build failed: ${message}`);
  process.exit(1);
}

function runGate(label, commandArgs) {
  const result = spawnSync(process.execPath, commandArgs, { cwd: repoRoot, encoding: 'utf8' });
  if (result.status !== 0) {
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    fail(`${label} gate failed`);
  }
}

function verifyNestedReviewAttestations(module) {
  const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, module.existing_manifest), 'utf8'));
  const harnessPath = path.join(repoRoot, module.target_dir, manifest.review_snapshot_harness || '');
  if (!fs.existsSync(harnessPath)) fail(`${module.id}: nested review harness is missing`);
  const harness = JSON.parse(fs.readFileSync(harnessPath, 'utf8'));
  const snapshotSha = harness.review_snapshot?.aggregate_sha256;
  const attestations = harness.review_attestations;
  if (harness.status !== 'reviewed' || attestations?.status !== 'passed' || attestations?.snapshot_sha256 !== snapshotSha) {
    fail(`${module.id}: nested review attestations are not closed on the current snapshot`);
  }
  for (const gate of ['senior_qa', 'contrarian', 'retail_war_room', 'ai_forensics']) {
    const review = attestations.reviews?.[gate];
    if (harness.gates?.[gate] !== 'passed' || review?.verdict !== 'PASS' || !review.agent_id || !review.attested_at) {
      fail(`${module.id}: nested review attestation is incomplete for ${gate}`);
    }
  }
}

runGate('program validator', [path.join(repoRoot, 'tools', 'validate-substack-evergreen-program.js')]);
for (const module of program.modules) {
  const validatorArgs = [
    path.join(repoRoot, 'tools', 'validate-substack-series.js'),
    path.join(repoRoot, module.target_dir)
  ];
  validatorArgs.push(module.existing_manifest ? '--require-reviews' : '--skip-harness');
  runGate(`series validator ${module.id}`, validatorArgs);
  if (module.existing_manifest) verifyNestedReviewAttestations(module);
}
runGate('trade signal domain validator', [path.join(repoRoot, 'tools', 'validate-trade-signal-check.js')]);
runGate('AI phrase linter', [
  path.join(repoRoot, 'tools', 'check-ai-tells.js'),
  '--strict',
  ...calendar.slots.map(slot => path.join(repoRoot, slot.target_file))
]);
for (const script of [
  'tools/audit-substack-evergreen-links.js',
  'tools/build-substack-evergreen-calendar.js',
  'tools/build-substack-evergreen-inventory.js',
  'tools/build-substack-evergreen-modules.js',
  'tools/build-substack-evergreen-drafts.js',
  'tools/build-substack-evergreen-harness.js',
  'tools/build-trade-signal-check-harness.js',
  'tools/build-substack-series-drafts.js',
  'tools/check-ai-tells.js',
  'tools/validate-substack-evergreen-program.js',
  'tools/validate-substack-remote-receipts.js',
  'tools/validate-substack-series.js',
  'tools/validate-trade-signal-check.js'
]) runGate(`syntax ${script}`, ['--check', path.join(repoRoot, script)]);

const ordered = [
  'data/substack/programs/retail-market-operating-system/program.json',
  'data/substack/programs/retail-market-operating-system/calendar.json',
  program.inventory.snapshot_path,
  program.evidence.source_link_audit_path,
  program.inventory.catalog_path
];

for (const module of program.modules) {
  const manifestPath = module.existing_manifest || path.posix.join(module.target_dir, 'manifest.json');
  if (!fs.existsSync(path.join(repoRoot, manifestPath))) fail(`missing ${manifestPath}`);
  ordered.push(manifestPath);
  const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, manifestPath), 'utf8'));
  for (const episode of manifest.episodes || []) ordered.push(path.posix.join(module.target_dir, episode.file));
  for (const source of manifest.source_files || []) ordered.push(source);
  for (const evidence of manifest.governing_evidence || []) ordered.push(path.posix.join(module.target_dir, evidence));
  if (module.existing_manifest && manifest.review_snapshot_harness) {
    ordered.push(path.posix.join(module.target_dir, manifest.review_snapshot_harness));
  }
  if (module.existing_manifest && manifest.domain_validator) ordered.push(manifest.domain_validator);
}

ordered.push(
  'tools/audit-substack-evergreen-links.js',
  'tools/build-substack-evergreen-calendar.js',
  'tools/build-substack-evergreen-inventory.js',
  'tools/build-substack-evergreen-modules.js',
  'tools/build-substack-evergreen-drafts.js',
  'tools/build-substack-evergreen-harness.js',
  'tools/build-trade-signal-check-harness.js',
  'tools/validate-substack-evergreen-program.js',
  'tools/validate-substack-remote-receipts.js',
  'tools/validate-substack-series.js',
  'tools/check-ai-tells.js',
  'docs/substack-series-workflow.md'
);

const unique = [...new Set(ordered)];
const files = {};
let aggregateInput = '';
for (const relative of unique) {
  const file = path.join(repoRoot, relative);
  if (!fs.existsSync(file)) fail(`missing snapshot file ${relative}`);
  const digest = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  files[relative] = digest;
  aggregateInput += `${digest}  ${relative}\n`;
}
const aggregate = crypto.createHash('sha256').update(aggregateInput).digest('hex');
const harness = {
  schema_version: 'content-harness.v1',
  run_id: 'substack-evergreen-program-20260831',
  workflow: 'substack_evergreen_program',
  artifact: 'data/substack/programs/retail-market-operating-system/program.json',
  captured_at: new Date().toISOString(),
  status: 'reviewing',
  delivery: {
    post_audience: program.schedule.post_audience,
    send_email: false,
    email_audience: null
  },
  coverage: {
    episode_count: calendar.episode_count,
    starts_at: calendar.starts_at,
    ends_at: calendar.ends_at,
    module_count: program.modules.length
  },
  review_snapshot: {
    aggregate_sha256: aggregate,
    aggregation: {
      algorithm: 'sha256',
      line_format: '<sha256><two spaces><repo_relative_path>\\n',
      ordered_files: unique
    },
    files
  },
  review_attestations: {
    snapshot_sha256: aggregate,
    status: 'pending',
    reviews: {}
  },
  gates: {
    program_validator: 'passed',
    series_validators: 'passed',
    ai_phrase_linter: 'passed',
    javascript_syntax: 'passed',
    senior_qa: 'pending',
    contrarian: 'pending',
    retail_war_room: 'pending',
    ai_forensics: 'pending'
  },
  remote: {
    existing_drafts_scheduled: verifiedExistingSchedules,
    existing_schedule_verified: verifiedExistingSchedules === 6,
    new_drafts_created: 0,
    new_drafts_validated: 0,
    new_drafts_scheduled: 0,
    schedule_verified: false
  }
};
fs.writeFileSync(path.join(programRoot, 'harness.json'), `${JSON.stringify(harness, null, 2)}\n`);
console.log(`Evergreen harness ${aggregate}: ${unique.length} files`);
