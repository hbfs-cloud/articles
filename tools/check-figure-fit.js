#!/usr/bin/env node
'use strict';

// Signale les figures qui n'ont probablement rien à voir avec leur épisode.
//
// Motif : un épisode sur le bilan de la Réserve fédérale avait reçu le schéma « Many tickers can be
// one bet ». La justification tenait debout à l'écrit — « un chiffre global qu'il faut décomposer »
// — mais à la lecture l'image ne dit rien de l'épisode. C'est exactement la figure décorative que
// le lecteur apprend à sauter, et une fois qu'il saute les images, les bonnes ne servent plus.
//
// LA MÉCANIQUE NE DÉCIDE PAS, ELLE TRIE. Elle mesure le vocabulaire commun entre le titre et le
// sous-titre de la figure d'une part, le texte de l'épisode d'autre part. Un recouvrement nul est
// un signal fort ; un recouvrement fort ne prouve rien (deux textes sur les taux partagent du
// vocabulaire sans que la figure éclaire quoi que ce soit). D'où un seuil bas et une sortie qui
// invite à relire, jamais à corriger en masse.
//
// ⚠️ PORTÉE RÉELLE, MESURÉE : l'outil NE TROUVE PAS le cas qui l'a motivé.
// Le schéma « Many tickers can be one bet » sur l'épisode du bilan de la Fed partage quatre mots
// avec lui — « many », « hides », « actually », « number » — tous génériques : l'épisode écrit
// « the summary HIDES the part that matters » et « the single NUMBER ». Il faut monter le seuil à
// six pour le voir apparaître, et à six la sortie compte des dizaines de faux positifs.
//
// Conclusion à ne pas enjoliver : ce contrôle attrape les appariements SANS AUCUN vocabulaire
// commun, et rien d'autre. La pertinence d'une figure demande un jugement, pas un compte de mots.
// Le passer au vert ne vaut pas relecture.
//
//   node tools/check-figure-fit.js
//   node tools/check-figure-fit.js --min 2

const fs = require('fs');
const path = require('path');
const { proseOf } = require('./lib/episode-illustration');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const MIN = Number(arg('--min', '2'));

const MAP = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/substack/episode-illustrations.json'), 'utf8'));
const TITLES = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/substack/schematic-titles.json'), 'utf8'));
const SERIES_DIR = path.join(ROOT, 'data/substack/series');

// Mots vides anglais + le vocabulaire que TOUT épisode de la collection emploie. Sans cette seconde
// liste, « risk », « trade », « market » suffiraient à valider n'importe quel appariement.
const STOP = new Set(`a an and are as at be been but by can cannot for from get gets had has have how
in into is it its more most no not of on once one only or out over own same so than that the their
them then there these they this those to too under until up very was way we what when where which
while who why will with you your yours does do did done not never always each every both few
risk risks trade trades trading market markets price prices money position positions plan plans
you your they it that this what how why when order orders`.split(/\s+/));

const words = s => new Set(String(s).toLowerCase().match(/[a-z]{4,}/g) || []);

const rows = [];
for (const [key, spec] of Object.entries(MAP)) {
  if (key.startsWith('_') || !spec || !spec.figure) continue;
  const meta = TITLES[spec.figure];
  if (!meta) { rows.push({ key, figure: spec.figure, shared: [], note: 'figure sans titre déclaré' }); continue; }
  const src = path.join(SERIES_DIR, key);
  if (!fs.existsSync(src)) continue;
  const ep = words(proseOf(fs.readFileSync(src, 'utf8')));
  const fig = [...words(`${meta.title} ${meta.subtitle}`)].filter(w => !STOP.has(w));
  const shared = fig.filter(w => ep.has(w));
  rows.push({ key, figure: spec.figure, title: meta.title, terms: fig.length, shared });
}

const weak = rows.filter(r => r.shared.length < MIN).sort((a, b) => a.shared.length - b.shared.length);
console.log(`[figure] ${rows.length} épisode(s) portant un schéma · seuil ${MIN} terme(s) en commun`);
if (!weak.length) { console.log('[figure] aucun appariement suspect'); process.exit(0); }
console.log(`[figure] ${weak.length} appariement(s) à relire :\n`);
for (const r of weak) {
  console.log(`  ${r.key}`);
  console.log(`    « ${r.title || r.note} » (${r.figure})`);
  console.log(`    en commun : ${r.shared.length ? r.shared.join(', ') : 'RIEN'}\n`);
}
// Sortie 0 : c'est une invitation à relire, pas un échec de construction. Bloquer ferait dépendre la
// publication d'une heuristique lexicale, ce qu'elle n'est pas en droit d'exiger.
process.exit(0);
