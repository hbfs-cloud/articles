#!/usr/bin/env node
'use strict';

/**
 * check-openapi-reality.js — portfolio/v1/openapi.yaml ↔ fichiers réellement publiés
 *
 * openapi.yaml est écrit À LA MAIN (gen-api.js ne le génère pas), donc rien ne le rattache au
 * catalogue de modes. Résultat au 2026-08-12 : il annonçait 21 modes, listait 17 ids supprimés
 * (secured, tkl, alpha, aplus, highvol, hybrid, forex, etf, etf_eu, etf_us, stockbox,
 * stockbox_pit, factor, book_honest, us_highvol, hvep, ep) qui rendent tous 404, et omettait
 * `best` — le seul répertoire nouvellement publié. 160 anomalies.
 *
 * Ce script rend cette dérive impossible à ignorer :
 *   1. le YAML parse et tous ses $ref internes résolvent
 *   2. chaque mode de l'enum a un répertoire publié, et chaque répertoire publié est dans l'enum
 *   3. chaque (mode × path) déclaré existe sur disque — aucun 404 documenté
 *   4. aucun JSON publié (par mode ou à la racine) n'est laissé hors du contrat
 *
 * Usage :
 *   node tools/check-openapi-reality.js              # exit 1 si anomalie
 *   node tools/check-openapi-reality.js --warn-only  # exit 0, anomalies quand même listées
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
const API = path.join(ROOT, 'portfolio', 'v1');
const WARN_ONLY = process.argv.includes('--warn-only');
const problems = [];

const spec = yaml.load(fs.readFileSync(path.join(API, 'openapi.yaml'), 'utf8'));

// 1. $ref internes
(function walk(node, trail) {
  if (!node || typeof node !== 'object') return;
  for (const [k, v] of Object.entries(node)) {
    if (k === '$ref') {
      let cur = spec;
      for (const seg of String(v).replace(/^#\//, '').split('/')) cur = cur && cur[seg];
      if (!cur) problems.push(`$ref cassé : ${v} (en ${trail})`);
    } else walk(v, `${trail}/${k}`);
  }
})(spec, '');

// 2. enum de modes ↔ répertoires publiés
const enumModes = ((spec.servers || [])[0] || {}).variables?.mode?.enum || [];
const dirs = fs.readdirSync(API, { withFileTypes: true })
  .filter(d => d.isDirectory() && d.name !== 'docs')
  .map(d => d.name).sort();
for (const m of enumModes) if (!dirs.includes(m)) problems.push(`enum → 404 : mode « ${m} » déclaré, aucun répertoire publié`);
for (const d of dirs) if (!enumModes.includes(d)) problems.push(`publié mais absent de l'enum : mode « ${d} »`);

// 3/4. paths déclarés ↔ fichiers sur disque
const modePaths = [];
const rootPaths = [];
for (const [p, def] of Object.entries(spec.paths || {})) {
  (def.servers ? rootPaths : modePaths).push(p.replace(/^\//, ''));
}
for (const m of enumModes) {
  for (const f of modePaths) {
    if (!fs.existsSync(path.join(API, m, f))) problems.push(`404 déclaré : /${m}/${f}`);
  }
}
for (const f of rootPaths) {
  if (!fs.existsSync(path.join(API, f))) problems.push(`404 déclaré (racine) : /${f}`);
}
const sample = dirs[0];
if (sample) {
  for (const f of fs.readdirSync(path.join(API, sample)).filter(f => f.endsWith('.json'))) {
    if (!modePaths.includes(f)) problems.push(`publié par mode mais non documenté : ${f}`);
  }
}
for (const f of fs.readdirSync(API).filter(f => f.endsWith('.json'))) {
  if (!rootPaths.includes(f) && !modePaths.includes(f)) problems.push(`publié à la racine mais non documenté : ${f}`);
}

for (const p of problems) console.log(`❌ ${p}`);
console.log(`openapi.yaml v${spec.info?.version} — modes déclarés: ${enumModes.length} | paths: ${Object.keys(spec.paths || {}).length} | anomalies: ${problems.length}`);
process.exit(problems.length && !WARN_ONLY ? 1 : 0);
