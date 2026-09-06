#!/usr/bin/env node
'use strict';

// Transforme un épisode de série en version illustrée, prête pour le connecteur Substack.
//
// Constat mesuré sur les 129 épisodes programmés jusqu'en avril 2028 : UN tableau au total, zéro
// image, zéro graphique, 573 mots médians. Le texte est bon — concret, sourcé, avec ses limites
// déclarées — mais lu d'affilée il est assommant, et rien n'accroche l'œil.
//
// L'épisode source reste la vérité : ce fichier AUGMENTE, il ne réécrit pas. Sept composants, tous
// optionnels, tous déclarés dans `data/substack/episode-illustrations.json` :
//
//   figure         un schéma de mécanisme, après l'accroche
//   chart          un exemple chiffré rejouant le calcul de l'épisode (voir worked-example.js)
//   tables         les puces à libellé gras deviennent un tableau — Substack le rend en image
//   numbered       une liste de gestes ordonnés devient une liste numérotée
//   key_line       LA phrase à retenir, surlignée sur place (jamais répétée en exergue)
//   takeaway       un exergue de clôture, quand l'épisode n'en porte pas déjà un
//   orientation    une ligne de repérage visible des seuls non-abonnés (::audience)
//
// LA FRONTIÈRE, qui décide de tout : la mise en page se décide librement, les chiffres jamais.
// Une puce mise en tableau ne crée aucune affirmation — les mots sont ceux de l'auteur. Un chiffre
// mis en graphique en crée une, parce qu'un graphique se lit comme une mesure. Le vérificateur de
// `lib/episode-illustration.js` fait échouer la construction sur tout chiffre absent du texte.
//
// Ce que l'outil ne fait toujours PAS : inventer un chiffre, illustrer une statistique dont la
// source citée ne répond pas d'elle, ou toucher au raisonnement.
//
//   node tools/build-substack-episode.js --series gap-risk-survival --out build/substack
//   node tools/build-substack-episode.js --all --out build/substack

const fs = require('fs');
const path = require('path');
const { foreignNumbers, proseOf } = require('./lib/episode-illustration');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const has = n => argv.includes(n);

const SERIES_DIR = path.join(ROOT, 'data/substack/series');
const MAP_FILE = path.join(ROOT, 'data/substack/episode-illustrations.json');
const CDN = 'https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets';

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
const KNOWN_FIG = new Set(FIGURES.figures.map(f => f.id));
const EX_INDEX = path.join(ROOT, 'substack-assets/examples/index.json');
const KNOWN_EX = new Set(fs.existsSync(EX_INDEX)
  ? (JSON.parse(fs.readFileSync(EX_INDEX, 'utf8')).examples || []).map(e => e.id) : []);
const TITLES = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/substack/schematic-titles.json'), 'utf8'));

// ── puces → tableau ─────────────────────────────────────────────────────────
// Un bloc n'est converti que si TOUTES ses puces portent un libellé gras : une liste mixte
// deviendrait un tableau à trous, moins lisible que la liste d'origine.
function bulletsToTable(lines, headers) {
  const rows = [];
  for (const line of lines) {
    const m = /^[-*]\s+\*\*(.+?)\s*:?\*\*:?\s*(.*)$/.exec(line);
    if (!m) return null;
    const labelCell = m[1].replace(/\s*:\s*$/, '').trim();
    // Substack rend le tableau en IMAGE : le gras Markdown y resterait littéral (« **Cause** »).
    const bodyCell = m[2].trim().replace(/\*\*/g, '').replace(/\|/g, '\\|');
    if (!labelCell || !bodyCell) return null;
    rows.push([labelCell, bodyCell]);
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

// Une image ne doit jamais couper une phrase de sa démonstration. Placée à l'aveugle, la figure
// tombait entre « voici les deux ratios » et le bloc de code qui les montre : le lecteur perd le fil
// au moment précis où il allait comprendre. On avance jusqu'après le support annoncé.
function safeSlot(paras, wanted) {
  let at = Math.min(Math.max(wanted, 1), paras.length);
  const isSupport = t => /^```/.test(t) || /^\|/.test(t) || /^[-*]\s/.test(t) || /^\d+\.\s/.test(t) || /^!\[/.test(t) || /^>/.test(t);
  const announces = t => /:\s*$/.test(String(t).trim());
  while (at < paras.length && (isSupport(paras[at]) || (at > 0 && announces(paras[at - 1])))) at++;
  return at;
}

function transform(md, spec, key, meta) {
  const fmMatch = /^---\n([\s\S]*?)\n---\n?/.exec(md);
  const front = fmMatch ? fmMatch[0] : '';
  let body = fmMatch ? md.slice(fmMatch[0].length) : md;

  const rw = applyRewrites(body, key);
  body = rw.body;
  const prose = proseOf(body);
  const applied = { tables: 0, numbered: 0, figure: null, chart: null, keyLine: false, takeaway: false, orientation: false };

  // ── tableaux et listes numérotées ─────────────────────────────────────────
  const lines = body.split('\n');
  const out = [];
  let listIdx = 0;

  // UN INTERTITRE QUI RÉPÈTE LA PHRASE JUSTE AU-DESSUS EST UN BÉGAIEMENT.
  // « Before writing anything about a balance-sheet announcement, do this. » suivi de
  // « ### Before you write about a balance-sheet announcement » : le lecteur lit deux fois la même
  // annonce et l'auteur passe pour distrait. Le titre ne sert que quand le texte n'annonce rien.
  const alreadyAnnounced = () => {
    for (let k = out.length - 1; k >= 0; k--) {
      const t = out[k].trim();
      if (!t) continue;
      return /:$/.test(t) || /\b(do this|here'?s how|as follows|in this order|the checklist)\b[.:]?$/i.test(t);
    }
    return false;
  };
  const heading = title => { if (title && !alreadyAnnounced()) out.push(`### ${title}`, ''); };
  for (let i = 0; i < lines.length; i++) {
    if (!/^[-*]\s/.test(lines[i])) { out.push(lines[i]); continue; }
    let j = i;
    while (j < lines.length && /^[-*]\s/.test(lines[j])) j++;
    const block = lines.slice(i, j);
    const thisList = listIdx++;
    i = j - 1;

    if (/^[-*]\s+\*\*/.test(block[0])) {
      const headers = (spec.tables && spec.tables[String(applied.tables)]) || spec.table_headers || ['What to check', 'What it means'];
      const table = bulletsToTable(block, headers);
      if (table) {
        // Un intertitre au-dessus du tableau : sans lui, l'image tombe sans annonce au milieu du texte.
        heading(spec.table_titles && spec.table_titles[String(applied.tables)]);
        out.push(table);
        applied.tables++;
        continue;
      }
    }
    // Une suite de gestes ordonnés se lit en liste numérotée : l'ordre y est une information.
    // Markdown renumérote seul, d'où le « 1. » répété.
    if (Array.isArray(spec.numbered) && spec.numbered.includes(thisList)) {
      heading(spec.numbered_titles && spec.numbered_titles[String(thisList)]);
      out.push(...block.map(l => l.replace(/^[-*]\s+/, '1. ')));
      applied.numbered++;
      continue;
    }
    out.push(...block);
  }
  body = out.join('\n');

  // ── phrase-clé surlignée, sur place ───────────────────────────────────────
  // Sur place et non en exergue : dans un texte de 570 mots, répéter une phrase se voit. Le
  // surlignage marque la leçon là où elle est écrite, sans rien ajouter.
  if (spec.key_line) {
    if (!body.includes(spec.key_line)) throw new Error(`${key}: phrase-clé absente du texte — « ${spec.key_line.slice(0, 70)}… »`);
    body = body.replace(spec.key_line, `<mark>${spec.key_line}</mark>`);
    applied.keyLine = true;
  }

  const paras = body.split(/\n\n+/);

  // ── exemple chiffré ───────────────────────────────────────────────────────
  if (spec.chart) {
    const id = key.replace(/\.md$/, '').replace(/\//g, '_');
    if (!KNOWN_EX.has(id)) throw new Error(`${key}: exemple chiffré déclaré mais non rendu — lancer render-worked-examples.js`);
    paras.splice(safeSlot(paras, spec.chart_after || 6), 0, `![${spec.chart.title}](${CDN}/examples/${id}.png)`);
    applied.chart = id;
  }

  // ── schéma de mécanisme ───────────────────────────────────────────────────
  // Après l'accroche : deux ou trois paragraphes posent la question, l'image répond avant que le
  // lecteur ne décroche. Inséré APRÈS le graphique pour que les index déclarés restent ceux du
  // texte source et non d'un texte déjà modifié.
  if (spec.figure) {
    if (!KNOWN_FIG.has(spec.figure)) throw new Error(`${key}: figure inconnue — ${spec.figure}`);
    const t = TITLES[spec.figure];
    paras.splice(safeSlot(paras, spec.figure_after || 3), 0, `![${t.title}](${CDN}/schematics/${spec.figure}.png)`);
    applied.figure = spec.figure;
  }

  // ── exergue de clôture ────────────────────────────────────────────────────
  // Avant les sources : c'est la dernière chose lue, donc celle qui reste.
  if (spec.takeaway) {
    const foreign = foreignNumbers(spec.takeaway, prose);
    if (foreign.length) throw new Error(`${key}: l'exergue apporte un chiffre absent du texte — ${foreign.join(', ')}`);
    const at = paras.findIndex(p => /^Sources?:/.test(p.trim()));
    paras.splice(at < 0 ? paras.length : at, 0, `> ${spec.takeaway}`);
    applied.takeaway = true;
  }

  // ── repérage pour les seuls non-abonnés ───────────────────────────────────
  // Un lecteur qui arrive sur l'épisode 4 d'une série de 6 ne sait pas s'il lui manque quelque
  // chose. Un abonné qui suit depuis le début n'a pas besoin qu'on le lui redise chaque semaine —
  // d'où le bloc ciblé plutôt qu'une ligne pour tout le monde.
  if (meta && meta.number > 1 && meta.total > 1 && spec.orientation !== false) {
    paras.splice(1, 0,
      `::audience non_sub,free_sub\nEach part stands on its own. This is ${meta.number} of ${meta.total} in ${meta.series}; ` +
      `earlier parts cover the groundwork but you can start here.\n::end`);
    applied.orientation = true;
  }

  body = paras.join('\n\n');
  return { front, body: body.replace(/\n{3,}/g, '\n\n').trim() + '\n', applied, rewrites: rw.applied };
}

// ── exécution ───────────────────────────────────────────────────────────────
const seriesList = onlySeries ? [onlySeries] : fs.readdirSync(SERIES_DIR).filter(d => fs.existsSync(path.join(SERIES_DIR, d, 'manifest.json')));
const outDir = path.resolve(ROOT, outRel);
const report = [];

for (const series of seriesList) {
  const base = path.join(SERIES_DIR, series);
  const mfPath = path.join(base, 'manifest.json');
  if (!fs.existsSync(mfPath)) { console.error(`[episode] série inconnue : ${series}`); process.exit(1); }
  const mf = JSON.parse(fs.readFileSync(mfPath, 'utf8'));
  const total = (mf.episodes || []).length;
  for (const file of fs.readdirSync(base).filter(f => f.endsWith('.md')).sort()) {
    const key = `${series}/${file}`;
    const spec = MAP[key] || MAP[series] || {};
    const ep = (mf.episodes || []).find(e => e.file === file);
    const meta = ep ? { number: ep.number, total, series: mf.title } : null;
    const md = fs.readFileSync(path.join(base, file), 'utf8');
    let res;
    try { res = transform(md, spec, key, meta); }
    catch (e) { console.error(`[episode] ${e.message}`); process.exit(1); }
    const dest = path.join(outDir, series, file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, res.front + res.body);
    report.push({ key, ...res.applied, rewrites: res.rewrites, words: res.body.split(/\s+/).length });
  }
}

const n = report.length;
const count = f => report.filter(f).length;
console.log(`[episode] ${n} épisode(s) → ${outRel}`);
console.log(`  schéma          : ${count(r => r.figure)}/${n}`);
console.log(`  exemple chiffré : ${count(r => r.chart)}/${n}`);
console.log(`  tableau         : ${count(r => r.tables > 0)}/${n} (${report.reduce((s, r) => s + r.tables, 0)} au total)`);
console.log(`  liste ordonnée  : ${count(r => r.numbered > 0)}/${n}`);
console.log(`  phrase-clé      : ${count(r => r.keyLine)}/${n}`);
console.log(`  exergue         : ${count(r => r.takeaway)}/${n}`);
console.log(`  réécritures     : ${report.reduce((s, r) => s + (r.rewrites || 0), 0)} sur ${count(r => r.rewrites)} épisode(s)`);

// Le compte des composants par épisode dit où le travail reste à faire. Un épisode à un seul
// composant est un épisode qu'on n'a pas encore regardé.
const richness = r => (r.figure ? 1 : 0) + (r.chart ? 1 : 0) + (r.tables > 0 ? 1 : 0) + (r.numbered > 0 ? 1 : 0) + (r.keyLine ? 1 : 0) + (r.takeaway ? 1 : 0);
const thin = report.filter(r => richness(r) <= 1);
if (thin.length) {
  console.log(`\n  À ENRICHIR (un composant ou moins) : ${thin.length}`);
  for (const r of thin.slice(0, 12)) console.log(`    - ${r.key}`);
  if (thin.length > 12) console.log(`    … et ${thin.length - 12} autre(s)`);
}
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ generated_at_source: 'tools/build-substack-episode.js', episodes: report }, null, 2) + '\n');
