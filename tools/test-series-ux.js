#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const ROOT = path.resolve(__dirname, '..');
const SERIES_ROOT = path.join(ROOT, 'series');
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'series-catalog.json'), 'utf8'));
const core = fs.readFileSync(path.join(ROOT, 'assets', 'core.js'), 'utf8');
const style = fs.readFileSync(path.join(ROOT, 'assets', 'style.css'), 'utf8');

function walkHtml(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(target, files);
    else if (entry.name === 'index.html') files.push(target);
  }
  return files;
}

const allSeriesPages = walkHtml(SERIES_ROOT);
const publishedHrefs = new Set();
let publishedChapters = 0;
let takeawayItems = 0;

assert(Array.isArray(catalog.series) && catalog.series.length > 0, 'series catalog must not be empty');
assert(!/\.scrollIntoView\s*\(/.test(core), 'series runtime must not change the page vertical scroll position');
assert(!core.includes('series-enhanced'), 'removed series-enhanced generation must not return');
assert(core.includes('normalizeTakeawayLists'), 'shared takeaway alignment normalizer is required');
assert(/\.series-catalog-card\s*\{[\s\S]*?height:\s*300px/.test(style), 'desktop cards need a stable height');

for (const series of catalog.series) {
  assert(series.slug && Array.isArray(series.chapters) && series.chapters.length > 0, `invalid catalog entry: ${series.slug || 'unknown'}`);
  for (const chapter of series.chapters) {
    assert(/^\/series\/.+\/$/.test(chapter.href), `invalid chapter href: ${chapter.href}`);
    assert(!publishedHrefs.has(chapter.href), `duplicate chapter href: ${chapter.href}`);
    publishedHrefs.add(chapter.href);
    publishedChapters++;

    const file = path.join(ROOT, chapter.href.replace(/^\//, ''), 'index.html');
    assert(fs.existsSync(file), `catalog chapter is missing: ${chapter.href}`);
    const html = fs.readFileSync(file, 'utf8');
    const $ = cheerio.load(html);
    assert(html.includes('/assets/core.js'), `shared runtime missing: ${chapter.href}`);
    if (series.chapters.length > 1) {
      assert($('.series-bar').length > 0, `multi-part series has no navigation host: ${chapter.href}`);
    }
  }
}

for (const file of allSeriesPages) {
  const html = fs.readFileSync(file, 'utf8');
  const $ = cheerio.load(html);
  assert(html.includes('/assets/core.js'), `series page bypasses shared UX runtime: ${path.relative(ROOT, file)}`);
  assert(!/href=["'][^"']*(?:t\.me|telegram\.me|youtube\.com|youtu\.be|feed\.xml)/i.test(html), `legacy follow link remains: ${path.relative(ROOT, file)}`);
  $('.takeaway-list li').each((_, item) => {
    takeawayItems++;
    assert($(item).children().first().is('i,svg'), `takeaway item has no leading icon column: ${path.relative(ROOT, file)}`);
  });
}

assert(core.includes('https://dailytickers.substack.com'), 'Substack must remain the single shared follow destination');

console.log(`PASS series UX: ${catalog.series.length} series, ${publishedChapters} chapters, ${allSeriesPages.length} pages, ${takeawayItems} aligned takeaway rows`);
