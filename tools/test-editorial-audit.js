#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const { latestPublishedScan } = require('./lib/published-scan');
const { sessionDate, horizonEnd, calendarProse, mentionsFomcDecision } = require('./validate-horizon-risk');

assert.equal(latestPublishedScan([
  '<a href="/scanner/status/">LIVE</a>',
  '<a href="/scanner/20260901/">older</a>',
  '<a href="/scanner/retrospective/20260909/">retro</a>',
  '<a href="/scanner/20260908/">next session after Labor Day</a>',
]), '20260908');
assert.throws(() => latestPublishedScan(['<a href="/scanner/status/">LIVE</a>']), /aucune édition/);
for (const input of ['20260908', '2026-09-08']) {
  assert.equal(sessionDate(input), '2026-09-08');
  assert.equal(horizonEnd(sessionDate(input), 10), '2026-09-21');
}
for (const input of ['20260907', '2026-02-30', '', null, '2026-09-08extra']) {
  assert.throws(() => sessionDate(input));
}
assert.equal(mentionsFomcDecision(calendarProse('<main><p>Discours Fed jeudi.</p><section id="sources">Réserve fédérale · calendrier FOMC</section></main>')), false);
assert.equal(mentionsFomcDecision(calendarProse('<main><p>La réunion de la Réserve fédérale tombe le 16 septembre.</p></main>')), true);
assert.equal(mentionsFomcDecision('FOMC le 16 septembre'), true);
assert.equal(calendarProse('<main><p>Décision le <span>16 septembre</span>.</p><script>99</script></main>'), 'Décision le 16 septembre.');

// Run the actual card CLI with an in-memory filesystem: validate rendered cards and dedup,
// without touching live indexes or rebuilding the repository-wide search during the test.
function cardFor(tab, date, body, preceding = [], documentTitle = 'DailyTickers | Test') {
  const root = path.resolve(__dirname, '..');
  const edition = `${tab}/${date}/index.html`;
  const index = path.join(root, 'data', `${tab}.json`);
  const files = new Map([
    [path.join(root, edition), `<html lang="fr"><head><title>${documentTitle}</title></head><body>${body}</body></html>`],
    [index, JSON.stringify([...preceding, `<a href="/${tab}/${date}/">old title</a>`])],
  ]);
  const fakeFs = {
    existsSync: file => files.has(file),
    readFileSync: file => { assert(files.has(file), `unexpected read: ${file}`); return files.get(file); },
    writeFileSync: (file, value) => files.set(file, value),
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'add_card.js'), 'utf8'), {
    require: name => name === 'fs' ? fakeFs : name === './build_search_module.js' ? () => {} : require(name),
    __dirname,
    process: { argv: ['node', 'add_card.js', edition], exit: code => { throw new Error(`unexpected exit ${code}`); } },
    console: { log() {}, error() {} },
  });
  const cards = JSON.parse(files.get(index));
  assert.equal(cards.length, preceding.length + 1, 'reindex must replace the existing URL');
  if (preceding.length) assert.deepEqual(cards.slice(0, preceding.length), preceding, 'archive correction must preserve newer cards');
  return new JSDOM(cards[preceding.length]).window.document;
}

const weekly = cardFor('weekly', '20260907', '<section class="hero-section"><h1>Oracle face à ses promesses</h1></section>');
assert.equal(weekly.querySelector('h2').textContent, 'Oracle face à ses promesses');
const scanner = cardFor('scanner', '20260908', '<div class="ticker-name">Séance du mardi 8 septembre 2026</div>');
assert.equal(scanner.querySelector('.report-card-meta').textContent, '8 septembre 2026');
const daily = cardFor('daily', '20260901', '<h1>Le risque tient</h1><div class="ticker-name">Autre libellé</div>');
assert.equal(daily.querySelector('h2').textContent, 'Le risque tient');
assert.equal(daily.querySelector('.report-card-meta').textContent, '1 septembre 2026');
cardFor('daily', '20260901', '<h1>Archive corrigée</h1>', ['<a href="/daily/20260907/">Latest</a>']);
const suspended = cardFor('scanner', '20260908', '<meta property="og:description" content="RISK-ON"><div data-ticker="AMZN"></div>', [], 'AMZN suspendu · 7 autres plans conditionnels | DailyTickers');
assert.equal(suspended.querySelector('h2').textContent, 'AMZN suspendu · 7 autres plans conditionnels', 'index must preserve a suspension instead of rebuilding a positive setup headline');
console.log('editorial audit regressions: PASS');
