'use strict';

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Refresh only the published group. Preserve curated cross-slug groups and the
// labels of unrelated chapters instead of rebuilding the registry from scratch.
module.exports = function refreshTechSeries(articlePath) {
  const root = path.resolve(__dirname, '../..');
  const relative = path.relative(root, path.resolve(root, articlePath)).split(path.sep).join('/');
  if (!relative.startsWith('tech/')) return;
  const href = '/' + relative.replace(/index\.html$/, '');
  const registryPath = path.join(root, 'data/tech-series-catalog.json');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const original = JSON.stringify(registry);
  const page = cheerio.load(fs.readFileSync(path.join(root, relative), 'utf8'));
  const title = page('h1').first().text().replace(/\s+/g, ' ').trim();
  let group = registry.series.find(item => item.chapters.some(chapter => chapter.href === href));
  const family = relative.split('/').slice(0, 2).join('/');
  const directory = path.join(root, family);
  const discovered = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const match = /^(?:part|ep)(\d+)(?:-|$)/i.exec(entry.name);
    const file = path.join(directory, entry.name, 'index.html');
    if (!entry.isDirectory() || !match || !fs.existsSync(file)) continue;
    const chapterPage = cheerio.load(fs.readFileSync(file, 'utf8'));
    discovered.push({ number: Number(match[1]), href: `/${family}/${entry.name}/`,
      title: chapterPage('h1').first().text().replace(/\s+/g, ' ').trim() });
  }
  if (!group) group = registry.series.find(item => item.chapters.some(chapter =>
    chapter.href.startsWith(`/${family}/`)));
  const rootFile = path.join(directory, 'index.html');
  if (discovered.length && !discovered.some(chapter => chapter.number === 1) && fs.existsSync(rootFile)) {
    const html = fs.readFileSync(rootFile, 'utf8');
    if (!/http-equiv\s*=\s*["']refresh/i.test(html) && /(?:Partie|Part|Épisode|Episode)\s*1\s*(?:sur|of|\/)/i.test(html)) {
      discovered.push({ number: 1, href: `/${family}/`, title: cheerio.load(html)('h1').first().text().trim() });
    }
  }
  if (!group && discovered.length > 1 && discovered.some(chapter => chapter.number === 1)) {
    group = { title: page('.series-title').first().text().trim() || discovered.find(chapter => chapter.number === 1).title, chapters: [] };
    registry.series.push(group);
  }
  if (!group) return;
  for (const chapter of discovered) {
    if (!group.chapters.some(existing => existing.href === chapter.href)) group.chapters.push(chapter);
  }
  const current = group.chapters.find(chapter => chapter.href === href);
  if (current && title) current.title = title;
  group.chapters.sort((left, right) => left.number - right.number || left.href.localeCompare(right.href));
  if (JSON.stringify(registry) !== original) fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');
};
