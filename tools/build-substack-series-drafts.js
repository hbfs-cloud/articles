#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const target = process.argv[2];
if (!target) {
  console.error('Usage: node tools/build-substack-series-drafts.js <series-directory>');
  process.exit(2);
}

const root = path.resolve(target);
const repoRoot = path.resolve(__dirname, '..');
const outputDir = path.join(repoRoot, 'data', 'substack-drafts');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

const validation = spawnSync(process.execPath, [path.join(repoRoot, 'tools', 'validate-substack-series.js'), root, '--require-reviews'], {
  cwd: repoRoot,
  stdio: 'inherit'
});
if (validation.status !== 0) {
  console.error('Substack draft build failed: review closure is required before draft payload generation');
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });
for (const episode of manifest.episodes) {
  const markdown = fs.readFileSync(path.join(root, episode.file), 'utf8');
  const body = markdown.replace(/^---\n[\s\S]*?\n---\n+/, '');
  const record = {
    title: episode.title,
    subtitle: episode.subtitle,
    body_markdown: body
  };
  const number = String(episode.number).padStart(2, '0');
  const output = path.join(outputDir, `${manifest.series_id}-episode-${number}.json`);
  fs.writeFileSync(output, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  console.log(path.relative(repoRoot, output));
}
