#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const root = path.join(repoRoot, 'data', 'substack', 'series', 'trade-signal-check');
const harnessPath = path.join(root, 'harness.json');
const previous = fs.existsSync(harnessPath) ? JSON.parse(fs.readFileSync(harnessPath, 'utf8')) : {};
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const ordered = [
  'data/substack/series/trade-signal-check/manifest.json',
  'data/substack/series/trade-signal-check/episode-01.md',
  'data/substack/series/trade-signal-check/episode-02.md',
  'data/substack/series/trade-signal-check/episode-03.md',
  'data/substack/series/trade-signal-check/episode-04.md',
  'data/substack/series/trade-signal-check/episode-05.md',
  'data/substack/series/trade-signal-check/episode-06.md',
  'data/substack/series/trade-signal-check/evidence/clf-case.json',
  'data/substack/series/trade-signal-check/evidence/marketdata-status.json',
  'data/substack/series/trade-signal-check/evidence/official-sources.json',
  'data/substack/series/trade-signal-check/evidence/tpr-gap-case.json',
  'data/substack/series/trade-signal-check/evidence/raw/clf-bars-reconstruction-20260831.json',
  'data/substack/series/trade-signal-check/evidence/raw/tpr-bars-reconstruction-20260831.json',
  ...manifest.source_files,
  'tools/build-substack-series-drafts.js',
  'tools/build-trade-signal-check-harness.js',
  'tools/check-ai-tells.js',
  'tools/validate-substack-series.js',
  'tools/validate-trade-signal-check.js',
  'docs/substack-series-workflow.md'
];

function fail(message) {
  console.error(`Trade signal harness build failed: ${message}`);
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

const episodeFiles = manifest.episodes.map(episode => path.join(root, episode.file));
runGate('series validator', [path.join(repoRoot, 'tools', 'validate-substack-series.js'), root, '--skip-harness']);
runGate('domain validator', [path.join(repoRoot, 'tools', 'validate-trade-signal-check.js')]);
runGate('AI phrase linter', [path.join(repoRoot, 'tools', 'check-ai-tells.js'), '--strict', ...episodeFiles]);
for (const script of [
  'tools/build-substack-series-drafts.js',
  'tools/build-trade-signal-check-harness.js',
  'tools/check-ai-tells.js',
  'tools/validate-substack-series.js',
  'tools/validate-trade-signal-check.js'
]) runGate(`syntax ${script}`, ['--check', path.join(repoRoot, script)]);

const files = {};
let aggregateInput = '';
for (const relative of ordered) {
  const file = path.join(repoRoot, relative);
  if (!fs.existsSync(file)) fail(`missing snapshot file ${relative}`);
  const digest = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  files[relative] = digest;
  aggregateInput += `${digest}  ${relative}\n`;
}
const aggregate = crypto.createHash('sha256').update(aggregateInput).digest('hex');
const unchanged = previous.review_snapshot?.aggregate_sha256 === aggregate;
const reviewGates = ['senior_qa', 'contrarian', 'retail_war_room', 'ai_forensics'];
const gates = {
  series_validator: 'passed',
  domain_validator: 'passed',
  ai_phrase_linter: 'passed',
  javascript_syntax: 'passed'
};
for (const gate of reviewGates) gates[gate] = unchanged && previous.gates?.[gate] === 'passed' ? 'passed' : 'pending';

const harness = {
  schema_version: 'content-harness.v1',
  run_id: 'substack-series-trade-signal-check-20260831',
  workflow: 'substack_series',
  artifact: 'data/substack/series/trade-signal-check/manifest.json',
  reference_close: '2026-08-28',
  captured_at: previous.captured_at || new Date().toISOString(),
  status: reviewGates.every(gate => gates[gate] === 'passed') ? 'reviewed' : 'reviewing',
  review_snapshot: {
    aggregate_sha256: aggregate,
    aggregation: {
      algorithm: 'sha256',
      line_format: '<sha256><two spaces><repo_relative_path>\\n',
      ordered_files: ordered
    },
    files
  },
  source_health: previous.source_health || {},
  gates,
  review_attestations: unchanged ? previous.review_attestations : {
    snapshot_sha256: aggregate,
    status: 'pending',
    reason: 'Content and executable controls changed; same-snapshot reviews are required.',
    supersedes_snapshot_sha256: previous.review_snapshot?.aggregate_sha256 || null
  },
  remote: unchanged ? previous.remote : {
    phase: 'pre_schedule',
    section_id: manifest.section.id,
    section_name: manifest.section.name,
    post_audience: manifest.delivery.post_audience,
    send_email: false,
    email_audience: null,
    intended_episode_count: manifest.episodes.length,
    metadata_updated_for_snapshot: false,
    drafts_validated_for_snapshot: false,
    schedule_readback_verified: false,
    scheduled_episodes: []
  }
};
fs.writeFileSync(harnessPath, `${JSON.stringify(harness, null, 2)}\n`);
console.log(`Trade signal harness ${aggregate}: ${ordered.length} files`);
