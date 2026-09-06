#!/usr/bin/env node
'use strict';

// Audite le corpus publié : les dates d'événements programmés y sont-elles justes ?
//
// Le 2026-09-06, deux articles ont été publiés avec le PPI daté de quatre jours trop tard et sans
// la réunion de la Réserve fédérale, parce qu'un flux de données servait de source pour des dates
// qu'une autorité publie un an d'avance. Le harnais empêche désormais la récidive — mais il ne dit
// rien des centaines d'articles déjà en ligne. Cet outil le dit.
//
// Il ne « corrige » rien : un article daté est un instantané, et on ne réécrit pas l'histoire. Il
// produit la liste de ce qui est faux, pour décider quoi faire — publier un rectificatif sur les
// pages encore consultées, laisser les autres.
//
// ANGLE MORT CONNU : l'outil n'apparie qu'une date portant son mois (« 13 août »). Une date écrite
// « …et l'indice des prix à la production le 13 » lui échappe et se signale à tort. Sur le corpus
// du 2026-09-06, les 3 remontées sont toutes de cette forme et toutes CORRECTES dans l'article.
// Lire les remontées, ne pas les appliquer mécaniquement.
//
//   node tools/audit-corpus-dates.js
//   node tools/audit-corpus-dates.js --since 2026-01-01 --json rapport.json

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const since = arg('--since', '2026-01-01');
const jsonOut = arg('--json');

const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/scheduled-events.json'), 'utf8'));
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

// Un article ne peut être jugé que sur la fenêtre que le registre couvre.
const covered = reg.events.filter(e => e.date >= since && e.date <= reg.coverage_until);
const byId = {};
for (const e of covered) (byId[e.id] = byId[e.id] || []).push(e);

const dirs = [];
for (const type of ['weekly', 'daily', 'analyses', 'scanner', 'series', 'tech']) {
  const base = path.join(ROOT, type);
  if (!fs.existsSync(base)) continue;
  for (const d of fs.readdirSync(base, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const file = path.join(base, d.name, 'index.html');
    if (fs.existsSync(file)) dirs.push({ type, name: d.name, file });
  }
}

// Repère « <événement> ... jeudi 14 septembre » (ou l'inverse) dans un rayon de quelques dizaines de
// caractères : au-delà, l'association entre le nom et la date n'est plus fiable, et un audit qui
// crie faux se fait ignorer.
function findDated(text, ev) {
  const hits = [];
  const dateRe = new RegExp(`(\\d{1,2})(?:er)?\\s+(${MOIS.join('|')})`, 'gi');
  for (const key of (ev.match || [])) {
    const kRe = new RegExp(key, 'gi');
    let k;
    while ((k = kRe.exec(text)) !== null) {
      const window = text.slice(Math.max(0, k.index - 90), k.index + 160);
      let m;
      dateRe.lastIndex = 0;
      while ((m = dateRe.exec(window)) !== null) {
        const day = Number(m[1]);
        const month = MOIS.indexOf(m[2].toLowerCase()) + 1;
        hits.push({ day, month, phrase: window.replace(/\s+/g, ' ').trim().slice(0, 120) });
      }
    }
  }
  return hits;
}

const findings = [];
let scanned = 0, mentioning = 0;
for (const d of dirs) {
  const raw = fs.readFileSync(d.file, 'utf8');
  const text = raw.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  scanned++;
  let touched = false;
  for (const [id, events] of Object.entries(byId)) {
    const proto = events[0];
    const hits = findDated(text, proto);
    if (!hits.length) continue;
    touched = true;
    // SI LA BONNE DATE FIGURE DANS LA FENÊTRE, L'ARTICLE A RAISON.
    // Sans cette règle, un tableau d'agenda déclenchait une alerte par ligne voisine : « 12 août »
    // était correct et l'outil se plaignait de « 11 » et « 13 » happés par le rayon de recherche.
    // Un audit qui crie faux se fait ignorer, et alors il ne protège plus de rien.
    const correctPresent = hits.some(hit =>
      events.some(e => Number(e.date.slice(8, 10)) === hit.day && Number(e.date.slice(5, 7)) === hit.month));
    if (correctPresent) continue;
    for (const hit of hits) {
      const ok = events.some(e => Number(e.date.slice(8, 10)) === hit.day && Number(e.date.slice(5, 7)) === hit.month);
      if (ok) continue;
      // Un jour proche d'une occurrence réelle est une erreur ; un mois entier d'écart est plus
      // probablement une phrase sans rapport happée par la fenêtre de recherche.
      const near = events.find(e => Number(e.date.slice(5, 7)) === hit.month);
      if (!near) continue;
      findings.push({
        article: path.relative(ROOT, d.file), type: d.type,
        event: id, cited: `${hit.day} ${MOIS[hit.month - 1]}`,
        authority: near.date, source: reg.sources[near.source].authority,
        phrase: hit.phrase,
      });
    }
  }
  if (touched) mentioning++;
}

console.log(`[audit] ${scanned} articles lus · ${mentioning} citent un événement du registre · fenêtre ${since} → ${reg.coverage_until}`);
if (!findings.length) {
  console.log('[audit] aucune date en désaccord avec une autorité');
} else {
  console.log(`[audit] ${findings.length} date(s) en désaccord :\n`);
  for (const f of findings) {
    console.log(`  ${f.article}`);
    console.log(`    « ${f.event} » cité au ${f.cited}, l'autorité le fixe au ${f.authority} (${f.source})`);
    console.log(`    …${f.phrase}…\n`);
  }
}
if (jsonOut) {
  fs.writeFileSync(path.resolve(ROOT, jsonOut), JSON.stringify({ since, coverage_until: reg.coverage_until, scanned, mentioning, findings }, null, 2) + '\n');
  console.log(`[audit] rapport → ${jsonOut}`);
}
process.exit(0);
