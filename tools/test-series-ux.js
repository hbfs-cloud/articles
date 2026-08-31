#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const ROOT = path.resolve(__dirname, '..');
const SERIES_ROOT = path.join(ROOT, 'series');
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'series-catalog.json'), 'utf8'));
const techCatalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'tech-series-catalog.json'), 'utf8'));
const core = fs.readFileSync(path.join(ROOT, 'assets', 'core.js'), 'utf8');
const style = fs.readFileSync(path.join(ROOT, 'assets', 'style.css'), 'utf8');
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function walkHtml(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(target, files);
    else if (entry.name === 'index.html') files.push(target);
  }
  return files;
}

const allSeriesPages = walkHtml(SERIES_ROOT);
const allTechPages = walkHtml(path.join(ROOT, 'tech'));
const publishedHrefs = new Set();
let publishedChapters = 0;
let takeawayItems = 0;

assert(Array.isArray(catalog.series) && catalog.series.length > 0, 'series catalog must not be empty');
assert(!/\.scrollIntoView\s*\(/.test(core), 'series runtime must not change the page vertical scroll position');
assert(!core.includes('series-enhanced'), 'removed series-enhanced generation must not return');
assert(core.includes('normalizeTakeawayLists'), 'shared takeaway alignment normalizer is required');
assert(/\.series-catalog-card\s*\{[\s\S]*?height:\s*300px/.test(style), 'desktop cards need a stable height');
assert(/assets\/style\.css\?v=/.test(indexHtml), 'series index stylesheet must be cache-busted');

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
  assert(/\/assets\/core\.js\?v=/.test(html), `series runtime is missing or not cache-busted: ${path.relative(ROOT, file)}`);
  assert(/\/assets\/report\.css\?v=/.test(html), `series stylesheet is missing or not cache-busted: ${path.relative(ROOT, file)}`);
  assert(!/href=["'][^"']*(?:t\.me|telegram\.me|youtube\.com|youtu\.be|feed\.xml)/i.test(html), `legacy follow link remains: ${path.relative(ROOT, file)}`);
  $('.series-step').each((_, step) => {
    assert($(step).is('a[href]'), `visible series step has no destination: ${path.relative(ROOT, file)}`);
  });
  $('a[href^="/series/"]').each((_, link) => {
    const href = String($(link).attr('href')).split(/[?#]/)[0];
    const target = path.join(ROOT, href.replace(/^\//, ''), href.endsWith('/') ? 'index.html' : '');
    assert(fs.existsSync(target), `broken internal series link ${href}: ${path.relative(ROOT, file)}`);
  });
  $('.takeaway-list li').each((_, item) => {
    takeawayItems++;
    assert($(item).children().first().is('i,svg'), `takeaway item has no leading icon column: ${path.relative(ROOT, file)}`);
  });
}

for (const series of techCatalog.series) {
  assert(series.title && Array.isArray(series.chapters) && series.chapters.length > 1, `invalid tech series: ${series.title || 'unknown'}`);
  for (const chapter of series.chapters) {
    const file = path.join(ROOT, chapter.href.replace(/^\//, ''), 'index.html');
    assert(fs.existsSync(file), `tech chapter is missing: ${chapter.href}`);
    const html = fs.readFileSync(file, 'utf8');
    assert(/data-tab=["']tech["']/.test(html), `tech chapter has the wrong tab: ${chapter.href}`);
    assert(/\/assets\/core\.js\?v=/.test(html), `tech runtime is not cache-busted: ${chapter.href}`);
    assert(/\/assets\/report\.css\?v=/.test(html), `tech stylesheet is not cache-busted: ${chapter.href}`);
    assert(html.includes('series-bar'), `tech chapter has no navigation host: ${chapter.href}`);
  }
}

for (const file of allTechPages) {
  const html = fs.readFileSync(file, 'utf8');
  assert(/data-tab=["']tech["']/.test(html), `tech page has the wrong tab: ${path.relative(ROOT, file)}`);
  assert(/\/assets\/core\.js\?v=/.test(html), `tech runtime is missing or not cache-busted: ${path.relative(ROOT, file)}`);
  assert(/\/assets\/report\.css\?v=/.test(html), `tech stylesheet is missing or not cache-busted: ${path.relative(ROOT, file)}`);
  const $ = cheerio.load(html);
  $('a[href^="/tech/"]').each((_, link) => {
    const href = String($(link).attr('href')).split(/[?#]/)[0];
    const target = path.join(ROOT, href.replace(/^\//, ''), href.endsWith('/') ? 'index.html' : '');
    assert(fs.existsSync(target), `broken internal tech link ${href}: ${path.relative(ROOT, file)}`);
  });
}

assert(core.includes('https://dailytickers.substack.com'), 'Substack must remain the single shared follow destination');
assert(indexHtml.includes('techCatalogCard'), 'tech index cards must use the normalized renderer');
assert(/#tab-tech \.report-card\s*\{[\s\S]*?height:\s*286px/.test(style), 'tech index cards need a stable height');

console.log(`PASS content UX: ${catalog.series.length} series / ${publishedChapters} chapters / ${allSeriesPages.length} pages; ${techCatalog.series.length} tech series / ${allTechPages.length} tech pages; ${takeawayItems} aligned takeaway rows`);
