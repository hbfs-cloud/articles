#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const programRoot = path.join(repoRoot, 'data', 'substack', 'programs', 'retail-market-operating-system');
const program = JSON.parse(fs.readFileSync(path.join(programRoot, 'program.json'), 'utf8'));
const calendar = JSON.parse(fs.readFileSync(path.join(programRoot, 'calendar.json'), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(path.join(repoRoot, program.inventory.catalog_path), 'utf8'));
const outputPath = path.join(repoRoot, program.inventory.snapshot_path);

function fail(message) {
  console.error(`Evergreen inventory build failed: ${message}`);
  process.exit(1);
}

function hrefToSourceFile(href) {
  const clean = String(href || '').split(/[?#]/, 1)[0].replace(/^\/+|\/+$/g, '');
  return `${clean}/index.html`;
}

const selectedBySource = new Map();
for (const slot of calendar.slots || []) {
  if (selectedBySource.has(slot.source_file)) fail(`duplicate selected source ${slot.source_file}`);
  selectedBySource.set(slot.source_file, slot);
}

const chapters = [];
const seenHrefs = new Set();
for (const series of catalog.series || []) {
  for (const chapter of series.chapters || []) {
    if (seenHrefs.has(chapter.href)) fail(`duplicate catalog href ${chapter.href}`);
    seenHrefs.add(chapter.href);
    const sourceFile = hrefToSourceFile(chapter.href);
    const selected = selectedBySource.get(sourceFile);
    chapters.push({
      series_slug: series.slug,
      series_title: series.title,
      chapter_number: chapter.number,
      chapter_title: chapter.title,
      href: chapter.href,
      source_file: sourceFile,
      source_exists: fs.existsSync(path.join(repoRoot, sourceFile)),
      disposition: selected ? 'selected' : 'deferred',
      reason: selected ? 'selected_for_evergreen_curriculum' : 'outside_selected_84_week_evergreen_curriculum',
      selected_week: selected?.week ?? null,
      module_id: selected?.module_id ?? null,
      target_file: selected?.target_file ?? null
    });
  }
}

const selectedCount = chapters.filter(chapter => chapter.disposition === 'selected').length;
const deferredCount = chapters.filter(chapter => chapter.disposition === 'deferred').length;
const missingSources = chapters.filter(chapter => !chapter.source_exists);
if (chapters.length !== catalog.chapterCount) fail(`expected ${catalog.chapterCount} rows, found ${chapters.length}`);
if (selectedCount !== program.inventory.selected_episodes) fail(`expected ${program.inventory.selected_episodes} selected rows, found ${selectedCount}`);
if (deferredCount !== program.inventory.deferred_chapters) fail(`expected ${program.inventory.deferred_chapters} deferred rows, found ${deferredCount}`);
if (missingSources.length) fail(`${missingSources.length} catalog source files are missing`);
if ([...selectedBySource].some(([source]) => !chapters.some(chapter => chapter.source_file === source))) fail('calendar contains a source outside the canonical catalog');

const inventory = {
  schema_version: 'substack-program-inventory.v1',
  program_id: program.program_id,
  generated_at: program.created_at,
  catalog_path: program.inventory.catalog_path,
  selection_rule: program.inventory.selection_rule,
  summary: {
    catalog_series: catalog.seriesCount,
    candidate_chapters: chapters.length,
    selected: selectedCount,
    deferred: deferredCount,
    missing_sources: 0
  },
  chapters
};
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(inventory, null, 2)}\n`);
console.log(`${outputPath}: ${chapters.length} chapters, ${selectedCount} selected, ${deferredCount} deferred`);
