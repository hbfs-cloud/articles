#!/usr/bin/env node
'use strict';

// Transforme un épisode de série en version illustrée, prête pour le connecteur Substack.
//
// Constat mesuré sur les 129 épisodes programmés jusqu'en avril 2028 : UN tableau au total, zéro
// image, zéro graphique, 570 mots de moyenne. Le texte est bon — concret, sourcé, avec ses limites
// déclarées — mais lu d'affilée il est assommant, et rien n'accroche l'œil.
//
// Deux transformations, toutes deux DÉTERMINISTES et réversibles :
//
//  1. Les listes à puces à libellé gras deviennent des tableaux. 112 épisodes sur 129 en ont, avec
//     six puces médianes. « **Cause:** an issuer filing… » porte déjà une structure à deux colonnes ;
//     la rendre visible ne change pas un mot du texte. Substack rend les tableaux en image.
//  2. Un schéma est inséré après l'accroche, choisi épisode par épisode dans un manifeste. Le choix
//     est éditorial et vit donc hors du code.
//
// Ce que l'outil NE fait PAS : inventer un chiffre, mettre en graphique une statistique dont la
// source ne répond pas d'elle, ou toucher au corps du raisonnement. Les épisodes citent des
// statistiques que leurs sources ne couvrent pas ; illustrer celles-là les rendrait plus crédibles
// sans les rendre plus vraies.
//
//   node tools/build-substack-episode.js --series gap-risk-survival --out build/substack
//   node tools/build-substack-episode.js --all --out build/substack

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const has = n => argv.includes(n);

const SERIES_DIR = path.join(ROOT, 'data/substack/series');
const MAP_FILE = path.join(ROOT, 'data/substack/episode-illustrations.json');
const CDN_BASE = 'https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics';

const outRel = arg('--out', 'build/substack');
const onlySeries = arg('--series');
if (!onlySeries && !has('--all')) {
  console.error('Usage: build-substack-episode.js (--series <nom> | --all) [--out <dossier>]');
  process.exit(2);
}

const MAP = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));

// Réécritures de phrases : le jugement vit dans un manifeste relisible, l'application dans le code.
//
// Motif : 112 phrases sur 50 épisodes avancent une statistique de population sans étude citée, et
// les faits datés vérifiables se sont révélés faux de façon SYSTÉMATIQUE — « Meta opened 26.4%
// lower » est la variation de CLÔTURE ; le titre a ouvert à −24,3 %. Idem Netflix (−29,7 % à
// l'ouverture, pas −35,1 %) et Nvidia (+26,1 %, pas +24,4 %). Dans une série qui enseigne que
// c'est l'ÉCART D'OUVERTURE qui vous coûte, publier la clôture sous ce nom vide la leçon.
//
// Une réécriture dont le texte source est introuvable fait ÉCHOUER la construction : sans cela une
// correction obsolète deviendrait un silence, et on croirait avoir corrigé.
const REWRITES = fs.existsSync(path.join(ROOT, 'data/substack/claim-rewrites.json'))
  ? JSON.parse(fs.readFileSync(path.join(ROOT, 'data/substack/claim-rewrites.json'), 'utf8'))
  : { rewrites: {} };
const FIGURES = JSON.parse(fs.readFileSync(path.join(ROOT, 'substack-assets/schematics/index.json'), 'utf8'));
const KNOWN = new Set(FIGURES.figures.map(f => f.id));
const TITLES = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/substack/schematic-titles.json'), 'utf8'));

// ── conversion des puces en tableau ─────────────────────────────────────────
// Un bloc n'est converti que si TOUTES ses puces portent un libellé gras : une liste mixte
// deviendrait un tableau à trous, moins lisible que la liste d'origine.
function bulletsToTable(lines, headers) {
  const rows = [];
  for (const line of lines) {
    const m = /^[-*]\s+\*\*(.+?)\s*:?\*\*:?\s*(.*)$/.exec(line);
    if (!m) return null;
    const label = m[1].replace(/\s*:\s*$/, '').trim();
    const body = m[2].trim().replace(/\|/g, '\\|');
    if (!label || !body) return null;
    rows.push([label, body]);
  }
  if (rows.length < 3) return null;          // deux lignes ne valent pas un tableau
  return [`| ${headers[0]} | ${headers[1]} |`, '|---|---|', ...rows.map(r => `| ${r[0]} | ${r[1]} |`)].join('\n');
}

function applyRewrites(body, key) {
  const list = REWRITES.rewrites[key] || [];
  let out = body, applied = 0;
  for (const r of list) {
    if (!out.includes(r.from)) throw new Error(`${key}: texte à réécrire introuvable — « ${r.from.slice(0, 70)}… »`);
    out = out.split(r.from).join(r.to);
    applied++;
  }
  return { body: out, applied };
}

function transform(md, spec, key) {
  const fmMatch = /^---\n([\s\S]*?)\n---\n?/.exec(md);
  const front = fmMatch ? fmMatch[0] : '';
  let body = fmMatch ? md.slice(fmMatch[0].length) : md;

  const rw = applyRewrites(body, key);
  body = rw.body;

  const lines = body.split('\n');
  const out = [];
  let converted = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!/^[-*]\s+\*\*/.test(lines[i])) { out.push(lines[i]); continue; }
    let j = i;
    while (j < lines.length && /^[-*]\s/.test(lines[j])) j++;
    const block = lines.slice(i, j);
    const headers = (spec.tables && spec.tables[String(converted)]) || spec.table_headers || ['What to check', 'What it means'];
    const table = bulletsToTable(block, headers);
    if (table) { out.push(table); converted++; } else out.push(...block);
    i = j - 1;
  }
  body = out.join('\n');

  // Le schéma vient après l'accroche : deux ou trois paragraphes suffisent à poser la question,
  // et l'image répond avant que le lecteur ne décroche.
  let figure = null;
  if (spec.figure) {
    if (!KNOWN.has(spec.figure)) throw new Error(`figure inconnue : ${spec.figure}`);
    const meta = TITLES[spec.figure];
    figure = `![${meta.title}](${CDN_BASE}/${spec.figure}.png)`;
    const paras = body.split(/\n\n+/);
    let at = Math.min(spec.figure_after || 3, paras.length);
    // NE PAS COUPER UNE PHRASE DE SA DÉMONSTRATION.
    // Placée à l'aveugle, la figure tombait entre « voici les deux ratios » et le bloc de code qui
    // les montre : le lecteur perd le fil au moment précis où il allait comprendre. On avance
    // jusqu'après le bloc de code, le tableau ou la liste que le paragraphe annonçait.
    const isSupport = t => /^```/.test(t) || /^\|/.test(t) || /^[-*]\s/.test(t);
    const announces = t => /:\s*$/.test(String(t).trim());
    while (at < paras.length && (isSupport(paras[at]) || (at > 0 && announces(paras[at - 1])))) at++;
    paras.splice(at, 0, figure);
    body = paras.join('\n\n');
  }

  return { front, body: body.replace(/\n{3,}/g, '\n\n').trim() + '\n', converted, figure: spec.figure || null, rewrites: rw.applied };
}

const seriesList = onlySeries ? [onlySeries] : fs.readdirSync(SERIES_DIR).filter(d => fs.existsSync(path.join(SERIES_DIR, d, 'manifest.json')));
const outDir = path.resolve(ROOT, outRel);
const report = [];

for (const series of seriesList) {
  const base = path.join(SERIES_DIR, series);
  if (!fs.existsSync(path.join(base, 'manifest.json'))) { console.error(`[episode] série inconnue : ${series}`); process.exit(1); }
  for (const file of fs.readdirSync(base).filter(f => f.endsWith('.md')).sort()) {
    const key = `${series}/${file}`;
    const spec = MAP[key] || MAP[series] || {};
    const md = fs.readFileSync(path.join(base, file), 'utf8');
    let res;
    try { res = transform(md, spec, key); }
    catch (e) { console.error(`[episode] ${key}: ${e.message}`); process.exit(1); }
    const dest = path.join(outDir, series, file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, res.front + res.body);
    report.push({ key, tables: res.converted, figure: res.figure, rewrites: res.rewrites, words: res.body.split(/\s+/).length });
  }
}

const withFig = report.filter(r => r.figure).length;
const withTbl = report.filter(r => r.tables > 0).length;
console.log(`[episode] ${report.length} épisode(s) → ${outRel}`);
console.log(`  avec figure  : ${withFig}/${report.length}`);
console.log(`  avec tableau : ${withTbl}/${report.length} (${report.reduce((s, r) => s + r.tables, 0)} tableaux au total)`);
console.log(`  réécritures  : ${report.reduce((s, r) => s + (r.rewrites || 0), 0)} sur ${report.filter(r => r.rewrites).length} épisode(s)`);
const naked = report.filter(r => !r.figure && !r.tables);
if (naked.length) {
  console.log(`  SANS AUCUNE ILLUSTRATION : ${naked.length}`);
  naked.forEach(r => console.log(`    - ${r.key}`));
}
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ generated_at_source: 'tools/build-substack-episode.js', episodes: report }, null, 2) + '\n');
