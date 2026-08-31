#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const programRoot = path.join(repoRoot, 'data', 'substack', 'programs', 'retail-market-operating-system');
const program = JSON.parse(fs.readFileSync(path.join(programRoot, 'program.json'), 'utf8'));
const calendar = JSON.parse(fs.readFileSync(path.join(programRoot, 'calendar.json'), 'utf8'));

function fail(message) {
  console.error(`Evergreen module build failed: ${message}`);
  process.exit(1);
}

function frontMatter(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) fail(`${path.relative(repoRoot, file)}: missing front matter`);
  const result = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    try { result[key] = JSON.parse(value); }
    catch { result[key] = value; }
  }
  return result;
}

for (const module of program.modules.filter(item => !item.existing_manifest)) {
  const slots = calendar.slots.filter(slot => slot.module_id === module.id);
  if (slots.length !== module.expected_episodes) fail(`${module.id}: calendar count mismatch`);
  const targetDir = path.join(repoRoot, module.target_dir);
  const episodes = slots.map(slot => {
    const file = path.join(repoRoot, slot.target_file);
    if (!fs.existsSync(file)) fail(`${slot.target_file}: missing episode`);
    const metadata = frontMatter(file);
    if (!metadata.title || !metadata.subtitle) fail(`${slot.target_file}: title/subtitle missing`);
    return {
      number: slot.module_episode,
      file: path.basename(slot.target_file),
      title: metadata.title,
      subtitle: metadata.subtitle,
      scheduled_at: slot.scheduled_at,
      source_path: slot.source_file
    };
  });
  const manifest = {
    schema_version: 'substack-series.v1',
    series_id: module.id,
    title: module.title,
    channel: 'substack',
    language: 'en',
    section: program.section,
    audience: program.schedule.post_audience,
    delivery: {
      post_audience: program.schedule.post_audience,
      send_email: false,
      email_audience: null
    },
    reference_close: null,
    created_at: program.created_at,
    source_series: module.source_dir,
    tags: ['Education', 'Risk Management'],
    cadence: {
      timezone: program.schedule.timezone,
      local_time: program.schedule.local_time,
      frequency: program.schedule.frequency,
      weekday: program.schedule.weekday
    },
    episodes,
    rollout: {
      phase: 'authorized-for-scheduling',
      authorized_episode_count: episodes.length,
      held_as_drafts: [],
      continuation_gate: 'Every episode belongs to the authorized no-email evergreen program.'
    },
    selection_disclosure: program.inventory.selection_rule,
    conflict_attestation: {
      issuer_sponsorship_or_compensation: false,
      selection_based_on_issuer_relationship: false,
      positions_disclosure: 'DailyTickers and its authors may hold securities discussed; holdings are not represented as evidence and did not govern topic selection.'
    },
    review_snapshot_harness: path.relative(targetDir, path.join(programRoot, 'harness.json')).split(path.sep).join('/'),
    governing_evidence: [],
    source_files: episodes.map(episode => episode.source_path),
    domain_validator: 'tools/validate-substack-evergreen-program.js',
    publication_contract: {
      website_references_forbidden: true,
      self_contained: true,
      max_words_per_episode: program.quality_contract.max_words,
      min_words_per_episode: program.quality_contract.min_words,
      required_reviews: program.quality_contract.required_reviews
    }
  };
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`${module.id}: ${episodes.length} episodes`);
}
