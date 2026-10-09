#!/usr/bin/env node
'use strict';
// Répare les liens des cartes d'archive (data/analyses_archive.json) d'après le CONTENU des dossiers
// analyses/<TICKER>/archive/<YYYYMMDD>/ (voir tools/lib/archive-folders.js).
//
// Règles, dans l'ordre, pour chaque carte d'archive (lien /analyses/T/archive/D/) :
//   1. un dossier contient la version datée de la carte → le lien vise ce dossier ;
//   2. sinon, le dossier visé existe et porte une autre date lisible → la carte est réétiquetée à la date
//      réelle de la version qu'elle ouvre (date, libellé, titre) ;
//   3. sinon (dossier absent ou sans date) → un dossier du ticker non encore lié par une autre carte et de date
//      la plus proche est retenu, la carte est réétiquetée ; à défaut, la carte est signalée, non modifiée.
// Les cartes qui pointent encore vers la page vivante (/analyses/T/) ne sont repointées que si un dossier
// contient exactement leur date ; si leur page a été supprimée et qu'aucune archive n'existe, elles sont retirées
// (lien mort). Doublons (même lien, même date) : départagés par la note de la carte (voir plus bas).
// Usage : node tools/repair-archive-links.js [--dry]
const fs = require('fs');
const path = require('path');
const { archiveFolders, findArchiveFolder } = require('./lib/archive-folders');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'data', 'analyses_archive.json');
const dry = process.argv.includes('--dry');
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const label = d => { const [y, m, j] = d.split('-').map(Number); return `${j} ${MOIS[m - 1]} ${y}`; };
const HREF = /href="\/analyses\/([A-Z0-9.-]+)\/(?:archive\/(\d{8})\/)?"/i;
const days = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / 864e5;

function retarget(card, ticker, folder, date, relabel) {
  let c = card.replace(HREF, `href="/analyses/${ticker}/archive/${folder}/"`);
  if (relabel) {
    c = c.replace(/(<div class="report-card-meta">\s*)\d{1,2}\s+[A-Za-zÀ-ÿ]+\s+20\d{2}/i, `$1${label(date)}`)
      .replace(/(<h2[^>]*>[^<]*— Version archivée du )[^<]*(<\/h2>)/i, `$1${label(date)}$2`);
  }
  return c;
}

const archive = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const folderCache = {};
const folders = t => (folderCache[t] = folderCache[t] || archiveFolders(ROOT, t));
const stats = { removed_dead: 0, ok: 0, relinked: 0, relabeled: 0, fallback: 0, live_relinked: 0, unresolved: 0, merged: 0 };
const log = [];

// Dossiers déjà correctement liés (règle 1) : la règle 3 ne doit pas les réattribuer à une autre carte.
const claimed = new Set();
for (const e of archive) {
  const m = (e.card || '').match(HREF); if (!m || !m[2]) continue;
  const f = findArchiveFolder(ROOT, m[1], e.date); if (f) claimed.add(m[1] + '/' + f);
}

const out = archive.map(e => {
  const m = (e.card || '').match(HREF);
  if (!m) return e;
  const [, t, cur] = m;
  // Dossier actuel déjà porteur de la bonne date (plusieurs dossiers peuvent partager une date) : inchangé.
  const curDate = cur && (folders(t).find(f => f.folder === cur) || {}).date;
  if (cur && curDate === e.date) { stats.ok++; return e; }
  const target = findArchiveFolder(ROOT, t, e.date);
  if (!cur) { // carte encore liée à la page vivante
    const exact = folders(t).filter(f => f.date === e.date);
    if (!exact.length) {
      // Page vivante supprimée et aucune archive : la carte mène à une 404 (ex. fiches retirées le 10 juin).
      if (!fs.existsSync(path.join(ROOT, 'analyses', t, 'index.html')) && !folders(t).length) {
        stats.removed_dead++; log.push(`${t} ${e.date}: page supprimée et aucune archive → carte retirée`); return null;
      }
      return e;
    }
    stats.live_relinked++; log.push(`${t} ${e.date}: page vivante → archive/${exact[exact.length - 1].folder}`);
    return { ...e, card: retarget(e.card, t, exact[exact.length - 1].folder, e.date, false) };
  }
  if (target) {
    if (target === cur) { stats.ok++; return e; }
    stats.relinked++; log.push(`${t} ${e.date}: archive/${cur} → archive/${target}`);
    return { ...e, card: retarget(e.card, t, target, e.date, false) };
  }
  const curInfo = folders(t).find(f => f.folder === cur);
  if (curInfo && curInfo.date) {
    stats.relabeled++; log.push(`${t}: carte du ${e.date} réétiquetée au ${curInfo.date} (contenu réel de archive/${cur})`);
    return { ...e, date: curInfo.date, card: retarget(e.card, t, cur, curInfo.date, true) };
  }
  const free = folders(t).filter(f => f.date && !claimed.has(t + '/' + f.folder)).sort((a, b) => days(a.date, e.date) - days(b.date, e.date));
  if (free.length) {
    const f = free[0]; claimed.add(t + '/' + f.folder); stats.fallback++;
    log.push(`${t} ${e.date}: archive/${cur} ${curInfo ? 'sans date lisible' : 'absent'} → archive/${f.folder} (version du ${f.date})`);
    return { ...e, date: f.date, card: retarget(e.card, t, f.folder, f.date, true) };
  }
  stats.unresolved++; log.push(`NON RÉSOLU ${t} ${e.date}: archive/${cur} ${curInfo ? 'sans date lisible' : 'absent'}, aucun dossier disponible`);
  return e;
});

// Doublons sur un même lien et une même date. La note affichée sur la carte (data-grade) est comparée à celle
// de la page archivée visée : même note → même version, la carte est fusionnée ; note différente → c'est une
// autre version mal datée, réattribuée au dossier non lié qui porte exactement cette note (date la plus proche
// en cas d'égalité) et réétiquetée à la date de ce dossier ; aucun dossier de même note → fusionnée.
const gradeOf = html => ((String(html).match(/data-grade="([^"]+)"/) || [])[1] || null);
const folderGrade = (t, f) => gradeOf(fs.readFileSync(path.join(ROOT, 'analyses', t, 'archive', f, 'index.html'), 'utf8'));
const seen = new Set();
const merged = [];
for (const e of out.filter(Boolean)) {
  const m = (e.card || '').match(HREF);
  if (!m || !m[2]) { merged.push(e); continue; }
  const [, t, f0] = m, k = t + '/' + f0 + '@' + e.date;
  if (!seen.has(k)) { seen.add(k); claimed.add(t + '/' + f0); merged.push(e); continue; }
  const g = gradeOf(e.card);
  if (!g || g === folderGrade(t, f0)) { stats.merged++; continue; }
  const free = folders(t).filter(f => f.date && !claimed.has(t + '/' + f.folder) && folderGrade(t, f.folder) === g)
    .sort((a, b) => days(a.date, e.date) - days(b.date, e.date));
  if (!free.length) { stats.merged++; log.push(`${t} ${e.date}: doublon de note ${g} sans dossier de même note, fusionné`); continue; }
  const f = free[0]; claimed.add(t + '/' + f.folder); stats.fallback++;
  log.push(`${t} ${e.date}: doublon de note ${g} (autre version) → archive/${f.folder}, réétiqueté au ${f.date}`);
  merged.push({ ...e, date: f.date, card: retarget(e.card, t, f.folder, f.date, true) });
}

for (const l of log) console.log('  ' + l);
console.log(`[archive-links] ${JSON.stringify(stats)} — ${archive.length} → ${merged.length} cartes${dry ? ' (dry-run, rien écrit)' : ''}`);
if (!dry) fs.writeFileSync(FILE, JSON.stringify(merged, null, 2));
