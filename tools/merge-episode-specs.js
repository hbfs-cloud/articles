#!/usr/bin/env node
'use strict';

// Fusionne des spécifications d'illustration dans `data/substack/episode-illustrations.json`.
//
// Les spécifications sont un travail ÉDITORIAL — quelle figure éclaire quel mécanisme, quelle
// phrase porte la leçon — donc rédigées épisode par épisode et non calculées. Ce script ne juge
// rien : il range, et il refuse ce qui ne peut pas s'appliquer.
//
// Trois refus, chacun payé par une erreur réelle :
//   - une clé qui ne correspond à aucun épisode (un « episode-7.md » sans zéro) créait une entrée
//     morte que personne ne remarquait, et l'épisode restait nu ;
//   - une phrase-clé absente du texte : le surlignage ne s'appliquerait pas, en silence ;
//   - `reasoning` n'est pas rangé — c'est la justification du choix, utile à la relecture, pas au
//     rendu ; la laisser gonflerait le manifeste sans rien produire.
//
//   node tools/merge-episode-specs.js specs.json
//   node tools/merge-episode-specs.js specs.json --dry-run

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const file = argv.find(a => !a.startsWith('--'));
const dry = argv.includes('--dry-run');
if (!file) { console.error('Usage: merge-episode-specs.js <specs.json> [--dry-run]'); process.exit(2); }

const MAP_FILE = path.join(ROOT, 'data/substack/episode-illustrations.json');
const SERIES_DIR = path.join(ROOT, 'data/substack/series');

const input = JSON.parse(fs.readFileSync(path.resolve(ROOT, file), 'utf8'));
const specs = Array.isArray(input) ? input : (input.specs || []);
const map = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));

// Les champs que le constructeur consomme. Tout le reste est du commentaire de rédaction.
const KEEP = ['figure', 'figure_after', 'key_line', 'takeaway', 'table_headers', 'table_titles',
  'tables', 'numbered', 'numbered_titles', 'chart', 'chart_after', 'orientation'];

const errors = [];
const merged = [];
for (const spec of specs) {
  const key = spec.key;
  const src = path.join(SERIES_DIR, key || '');
  if (!key || !fs.existsSync(src)) { errors.push(`clé sans épisode : ${key}`); continue; }
  const body = fs.readFileSync(src, 'utf8');

  // La phrase-clé est surlignée SUR PLACE : si elle n'est pas dans le texte au caractère près, le
  // surlignage ne s'applique pas et rien ne le signale. On le signale ici.
  if (spec.key_line && !body.includes(spec.key_line)) {
    errors.push(`${key} : phrase-clé absente du texte — « ${spec.key_line.slice(0, 60)}… »`);
    continue;
  }

  const entry = { ...(map[key] || {}) };
  for (const f of KEEP) if (spec[f] !== undefined) entry[f] = spec[f];
  map[key] = entry;
  merged.push(key);
}

if (errors.length) {
  console.error(`[fusion] ${errors.length} spécification(s) rejetée(s) :`);
  for (const e of errors) console.error(`  - ${e}`);
}
console.log(`[fusion] ${merged.length}/${specs.length} spécification(s) rangée(s)${dry ? ' (essai à blanc)' : ''}`);
if (!dry) {
  fs.writeFileSync(MAP_FILE, JSON.stringify(map, null, 2) + '\n');
  console.log(`[fusion] → ${path.relative(ROOT, MAP_FILE)}`);
}
process.exit(errors.length ? 1 : 0);
