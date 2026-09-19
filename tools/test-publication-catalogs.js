#!/usr/bin/env node
'use strict';

// Actual publisher, validators, card/search/catalog generators and Git commits;
// only the article content is a non-financial fixture. No network or hooks.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'publication-catalogs-'));
const write = (file, value) => {
  const target = path.join(temp, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, value);
};
const json = file => JSON.parse(fs.readFileSync(path.join(temp, file), 'utf8'));
const git = (...args) => execFileSync('git', args, { cwd: temp, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const run = (...args) => execFileSync(process.execPath, args, { cwd: temp, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const source = fs.readFileSync(path.join(ROOT, 'tech/pipeline-qui-refuse/index.html'), 'utf8');
const article = title => source.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`)
  .replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, `<h1>${title}</h1>`);
function publish(type, file, title) {
  write(file, article(title));
  run('tools/publish.js', '--type', type, '--path', file, '--no-push', '--no-notify');
  assert.equal(git('status', '--porcelain'), '', 'publisher must commit all generated indexes');
  assert.ok(git('show', `HEAD:${file}`).includes(title));
}

try {
  for (const file of ['package.json', 'tools/package.json', 'tools/publish.js', 'tools/add_card.js',
    'tools/build_search_module.js', 'tools/gen-series-catalog.js', 'tools/gen-tech-catalog.cjs',
    'tools/validate-article.js', 'tools/lib/analysis-publication-gate.js', 'tools/lib/refresh-tech-series.js']) {
    write(file, fs.readFileSync(path.join(ROOT, file)));
  }
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(temp, 'node_modules'), 'dir');
  write('.gitignore', 'node_modules/\n');
  for (const type of ['tech', 'series']) write(`data/${type}.json`, '[]');
  const curated = { title: 'Curated cross-slug group', chapters: [
    { number: 1, href: '/tech/existing-one/', title: 'Short label one' },
    { number: 2, href: '/tech/existing-two/', title: 'Short label two' },
  ] };
  write('data/tech-series-catalog.json', JSON.stringify({ series: [curated] }));
  write('data/series-catalog.json', JSON.stringify({ series: [] }));
  git('init', '-b', 'main');
  git('config', 'user.name', 'Publication QA');
  git('config', 'user.email', 'qa@example.invalid');
  git('add', '.'); git('commit', '-m', 'fixture');

  publish('tech', 'tech/guide/index.html', 'Guide initial');
  assert.equal(json('data/tech-catalog.json').guides[0].title, 'Guide initial');
  assert.ok(fs.readFileSync(path.join(temp, 'data/search_data.js'), 'utf8').includes('Guide initial'));
  publish('tech', 'tech/guide/index.html', 'Guide actualisé');
  const guides = json('data/tech-catalog.json').guides;
  assert.equal(guides.length, 1, 'refresh must not duplicate the card');
  assert.equal(guides[0].title, 'Guide actualisé');
  assert.ok(git('show', 'HEAD:data/tech-catalog.json').includes('Guide actualisé'));

  publish('series', 'series/course/part1-start/index.html', 'Introduction');
  for (const [part, title] of [['part2-next', 'Approfondissement'], ['ep3', 'Exercices']]) {
    publish('series', `series/course/${part}/index.html`, title);
  }
  assert.equal(json('data/series.json').length, 1, 'chapters must not duplicate the series card');
  assert.deepEqual(json('data/series-catalog.json').series[0].chapters.map(ch => ch.title),
    ['Introduction', 'Approfondissement', 'Exercices']);
  publish('series', 'series/course/part2-next/index.html', 'Chapitre actualisé');
  assert.equal(json('data/series-catalog.json').series[0].chapters[1].title, 'Chapitre actualisé');
  assert.ok(git('show', 'HEAD:data/series-catalog.json').includes('Chapitre actualisé'));

  publish('series', 'series/root-course/index.html', 'Partie 1 sur 2 : racine');
  publish('series', 'series/root-course/ep2/index.html', 'Suite');
  const rootCourse = json('data/series-catalog.json').series.find(item => item.slug === 'root-course');
  assert.equal(rootCourse.href, '/series/root-course/');
  assert.deepEqual(rootCourse.chapters.map(chapter => chapter.number), [1, 2]);

  publish('tech', 'tech/course/part1/index.html', 'Première partie');
  publish('tech', 'tech/course/part2/index.html', 'Deuxième partie');
  publish('tech', 'tech/course/part2/index.html', 'Partie corrigée');
  const techCourse = json('data/tech-catalog.json').guides.find(item => item.href === '/tech/course/part1/');
  assert.equal(techCourse.chapterCount, 2);
  assert.equal(techCourse.chapters[1].title, 'Partie corrigée');
  assert.equal(json('data/tech-series-catalog.json').series[1].chapters[1].title, 'Partie corrigée');
  assert.equal(json('data/tech.json').length, 2, 'tech chapters must not duplicate cards');
  assert.deepEqual(json('data/tech-series-catalog.json').series[0], curated, 'unrelated curated groups must be unchanged');

  publish('tech', 'tech/landing/index.html', 'Sommaire');
  write('tech/landing/part1/index.html', article('Premier chapitre'));
  publish('tech', 'tech/landing/part2/index.html', 'Second chapitre');
  const landing = json('data/tech-catalog.json').guides.find(item => item.href === '/tech/landing/');
  assert.equal(landing.chapterCount, 2, 'a landing card must link to its registered chapter group');

  write('series/orphan/ep2/index.html', article('Chapitre sans parent'));
  assert.throws(() => run('tools/publish.js', '--type', 'series', '--path', 'series/orphan/ep2/index.html', '--no-push', '--no-notify'),
    /Publish the landing page or first chapter/, 'an unindexed series must fail with a recovery instruction');

  // Removing a published guide and reindexing must remove the stale UI entry.
  write('data/tech.json', '[]');
  run('tools/gen-tech-catalog.cjs');
  assert.equal(json('data/tech-catalog.json').guides.length, 0);
  console.log('PASS publication catalogs: real Git + canonical publisher; tech create/refresh/remove, series create/add/refresh chapters');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
