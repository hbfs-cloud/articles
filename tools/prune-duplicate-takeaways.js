#!/usr/bin/env node
'use strict';

// Retire les exergues qui recopient mot pour mot une phrase de leur épisode.
//
// Un exergue sert à faire ressortir la leçon quand le texte ne la pose pas nettement. Recopier une
// phrase déjà écrite trois lignes plus haut ne fait pas ressortir : ça répète. Dans un texte de
// 570 mots la répétition se voit, et elle fait passer l'auteur pour distrait.
//
// Le retrait ne perd donc rien — c'est bien pourquoi il peut être automatique, contrairement au
// choix d'une figure ou d'une phrase-clé, qui demandent un jugement et restent à la main.
//
//   node tools/prune-duplicate-takeaways.js --dry-run
//   node tools/prune-duplicate-takeaways.js

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const dry = process.argv.includes('--dry-run');
const MAP_FILE = path.join(ROOT, 'data/substack/episode-illustrations.json');
const SERIES_DIR = path.join(ROOT, 'data/substack/series');

const map = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
const removed = [];

for (const [key, spec] of Object.entries(map)) {
  if (key.startsWith('_') || !spec || !spec.takeaway) continue;
  const src = path.join(SERIES_DIR, key);
  if (!fs.existsSync(src)) continue;
  const body = fs.readFileSync(src, 'utf8');
  if (!body.includes(spec.takeaway.trim())) continue;
  removed.push({ key, takeaway: spec.takeaway });
  delete spec.takeaway;
}

console.log(`[exergue] ${removed.length} exergue(s) redondant(s)${dry ? ' (essai à blanc)' : ' retiré(s)'}`);
for (const r of removed) console.log(`  ${r.key}\n    « ${r.takeaway.slice(0, 80)} »`);
if (!dry && removed.length) {
  fs.writeFileSync(MAP_FILE, JSON.stringify(map, null, 2) + '\n');
  console.log(`[exergue] → ${path.relative(ROOT, MAP_FILE)}`);
}
