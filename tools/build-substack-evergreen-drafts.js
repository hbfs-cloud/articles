#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const programRoot = path.join(repoRoot, 'data', 'substack', 'programs', 'retail-market-operating-system');
const calendar = JSON.parse(fs.readFileSync(path.join(programRoot, 'calendar.json'), 'utf8'));
const outputDir = path.join(repoRoot, 'data', 'substack-drafts', 'evergreen-program');

function fail(message) {
  console.error(`Evergreen draft build failed: ${message}`);
  process.exit(1);
}

const validation = spawnSync(process.execPath, [path.join(repoRoot, 'tools', 'validate-substack-evergreen-program.js'), '--require-reviews'], {
  cwd: repoRoot,
  stdio: 'inherit'
});
if (validation.status !== 0) fail('review closure is required before draft payload generation');

function parseEpisode(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) fail(`${path.relative(repoRoot, file)}: front matter missing`);
  const metadata = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    try { metadata[key] = JSON.parse(value); }
    catch { metadata[key] = value; }
  }
  return { metadata, body_markdown: raw.slice(match[0].length).trim() };
}

fs.mkdirSync(outputDir, { recursive: true });
const index = [];
for (const slot of calendar.slots.filter(item => item.module_id !== 'trade-signal-check')) {
  if (slot.send_email !== false || slot.email_audience !== null) fail(`week ${slot.week}: email must be disabled`);
  const source = path.join(repoRoot, slot.target_file);
  if (!fs.existsSync(source)) fail(`week ${slot.week}: missing ${slot.target_file}`);
  const episode = parseEpisode(source);
  if (episode.metadata.title !== slot.title || episode.metadata.subtitle !== slot.subtitle) fail(`week ${slot.week}: calendar metadata drift`);
  const filename = `week-${String(slot.week).padStart(3, '0')}.json`;
  const payload = {
    title: episode.metadata.title,
    subtitle: episode.metadata.subtitle,
    body_markdown: episode.body_markdown
  };
  fs.writeFileSync(path.join(outputDir, filename), `${JSON.stringify(payload, null, 2)}\n`);
  index.push({
    week: slot.week,
    module_id: slot.module_id,
    module_episode: slot.module_episode,
    payload_file: path.posix.join('data/substack-drafts/evergreen-program', filename),
    scheduled_at: slot.scheduled_at,
    post_audience: slot.post_audience,
    send_email: false,
    email_audience: null
  });
}
fs.writeFileSync(path.join(outputDir, 'index.json'), `${JSON.stringify({
  program_id: calendar.program_id,
  generated_at: calendar.generated_at,
  draft_count: index.length,
  drafts: index
}, null, 2)}\n`);
console.log(`${outputDir}: ${index.length} no-email draft payloads`);
