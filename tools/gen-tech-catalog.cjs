#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const ROOT = path.resolve(__dirname, '..');
const cards = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'tech.json'), 'utf8'));
const techSeries = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'tech-series-catalog.json'), 'utf8')).series;
const learningSeries = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'series-catalog.json'), 'utf8')).series;

const seriesByFirstChapter = new Map(techSeries.map(item => [item.chapters[0].href, item]));
for (const item of learningSeries) seriesByFirstChapter.set(item.chapters[0].href, item);
const guides = [];
const seen = new Set();

function discoverSeriesChapters(href) {
  const match = href.match(/^\/series\/([^/]+)\//);
  if (!match) return [];
  const dir = path.join(ROOT, 'series', match[1]);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => {
    const numberMatch = entry.name.match(/(?:part|ep)(\d+)/i);
    const file = path.join(dir, entry.name, 'index.html');
    if (!numberMatch || !fs.existsSync(file)) return null;
    const page = cheerio.load(fs.readFileSync(file, 'utf8'));
    return {
      number: Number(numberMatch[1]),
      href: `/series/${match[1]}/${entry.name}/`,
      title: page('h1').first().text().replace(/\s+/g, ' ').trim() || `Partie ${numberMatch[1]}`,
    };
  }).filter(Boolean).sort((left, right) => left.number - right.number);
}

for (const cardHtml of cards) {
  const $ = cheerio.load(cardHtml);
  const card = $('.report-card').first();
  const link = card.find('.actions a[href], a[href]').first();
  const href = link.attr('href');
  if (!href || seen.has(href)) continue;
  seen.add(href);

  const heading = card.find('h2').first().text().trim() || card.find('h3').first().text().trim();
  const description = card.find('p').first().text().replace(/\s+/g, ' ').trim();
  const series = seriesByFirstChapter.get(href);
  const discovered = discoverSeriesChapters(href);
  const chapters = series ? series.chapters : (discovered.length ? discovered : [{ number: 1, href, title: heading }]);
  guides.push({
    slug: href.split('/').filter(Boolean).join('/'),
    title: series ? series.title : heading,
    latestTitle: heading,
    description,
    lang: card.attr('data-lang') || 'fr',
    tags: String(card.attr('data-tags') || 'tech').split(',').map(value => value.trim()).filter(Boolean),
    href,
    chapterCount: chapters.length,
    chapters,
  });
}

const output = {
  schema: 'tech-catalog.v1',
  generatedAt: new Date().toISOString(),
  guideCount: guides.length,
  chapterCount: guides.reduce((sum, guide) => sum + guide.chapters.length, 0),
  guides,
};

fs.writeFileSync(path.join(ROOT, 'data', 'tech-catalog.json'), JSON.stringify(output, null, 2) + '\n');
console.log(`[tech-catalog] ${output.guideCount} guides, ${output.chapterCount} chapitres`);
