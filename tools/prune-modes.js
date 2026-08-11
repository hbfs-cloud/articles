#!/usr/bin/env node
'use strict';
/**
 * prune-modes — retire définitivement des modes du dépôt.
 *
 *   node tools/prune-modes.js --dry     # simulation, n'écrit rien
 *   node tools/prune-modes.js --apply
 *
 * Décision du 2026-08-12 : le catalogue passe de 25 modes à 5 — `best` (moteur
 * systematic, panier multi-poches) côté scripté, `turbo` / `dynamic` /
 * `balanced` / `fortress` côté éditorial. Les 21 autres sont supprimés du code
 * ET de l'historique, sur instruction explicite du propriétaire, après que les
 * conséquences aient été posées : 27 positions ouvertes perdent leur suivi,
 * 89 trades scellés disparaissent, et la chaîne d'intégrité SHA-256 de
 * trade-chain.json est rompue pour ces modes. Ce n'est pas récupérable depuis
 * le dépôt une fois le commit poussé.
 *
 * L'appariement est EXACT — jamais par sous-chaîne. « ep » ou « gap » comme
 * fragment de texte se retrouve partout ; comme clé d'objet ou valeur de champ
 * `mode`, il ne désigne qu'une chose. Confondre les deux effacerait des données
 * sans rapport, silencieusement.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const KEEP = new Set(['turbo', 'dynamic', 'balanced', 'fortress', 'best']);
const DROP = new Set([
  'secured', 'tkl', 'alpha', 'aplus', 'highvol', 'hybrid', 'forex', 'etf', 'etf_eu',
  'eu_smallcap', 'stockbox', 'factor', 'pead', 'filings', 'gap',
  'book_honest', 'us_highvol', 'hvep', 'stockbox_pit', 'etf_us', 'ep',
]);
// Champs dont la VALEUR identifie un mode. Tout autre champ portant par hasard
// la chaîne « ep » n'est pas concerné.
const MODE_FIELDS = ['mode', 'modeId', 'mode_id', 'portfolio', 'portfolioId', 'strategy_id'];

const APPLY = process.argv.includes('--apply');
const report = { files: 0, keysRemoved: 0, itemsRemoved: 0, filesDeleted: [], dirsDeleted: [] };

function isDropped(v) { return typeof v === 'string' && DROP.has(v); }

// Élague récursivement : supprime les CLÉS d'objet qui nomment un mode retiré,
// et les ÉLÉMENTS de tableau dont un champ d'identité pointe vers un mode retiré.
function prune(node) {
  if (Array.isArray(node)) {
    const kept = [];
    for (const item of node) {
      if (item && typeof item === 'object' && MODE_FIELDS.some(f => isDropped(item[f]))) { report.itemsRemoved++; continue; }
      kept.push(prune(item));
    }
    return kept;
  }
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (DROP.has(k)) { report.keysRemoved++; continue; }
      out[k] = prune(v);
    }
    return out;
  }
  return node;
}

function pruneFile(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return;
  let json;
  try { json = JSON.parse(fs.readFileSync(abs, 'utf8')); }
  catch { console.error(`  ⚠ ${rel} illisible — laissé intact`); return; }
  const before = { k: report.keysRemoved, i: report.itemsRemoved };
  const out = prune(json);
  const dk = report.keysRemoved - before.k, di = report.itemsRemoved - before.i;
  if (!dk && !di) return;
  report.files++;
  console.log(`  ${rel} — ${dk} clé(s), ${di} élément(s)`);
  if (APPLY) fs.writeFileSync(abs, JSON.stringify(out, null, 2) + '\n');
}

function rm(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return;
  const dir = fs.statSync(abs).isDirectory();
  (dir ? report.dirsDeleted : report.filesDeleted).push(rel);
  if (APPLY) fs.rmSync(abs, { recursive: true, force: true });
}

console.log(APPLY ? '── SUPPRESSION RÉELLE ──' : '── SIMULATION (aucune écriture) ──');
console.log(`gardés : ${[...KEEP].join(', ')}`);
console.log(`retirés : ${DROP.size} modes\n`);

// 1. Fichiers de données à élaguer
console.log('Élagage des données :');
for (const f of fs.readdirSync(path.join(ROOT, 'data'))) {
  if (f.endsWith('.json')) pruneFile(`data/${f}`);
}

// 2. Fichiers entiers dédiés à un mode supprimé
console.log('\nFichiers entièrement dédiés à un mode retiré :');
for (const f of fs.readdirSync(path.join(ROOT, 'data'))) {
  if (/^(stockbox|forex|tkl|factor)[-.]/.test(f)) { console.log(`  data/${f}`); rm(`data/${f}`); }
}

// 3. Dossiers d'API par mode
console.log('\nDossiers portfolio/v1 :');
const apiDir = path.join(ROOT, 'portfolio/v1');
for (const d of fs.readdirSync(apiDir)) {
  if (DROP.has(d) && fs.statSync(path.join(apiDir, d)).isDirectory()) { console.log(`  portfolio/v1/${d}/`); rm(`portfolio/v1/${d}`); }
}

// 4. Cartes PNG par mode
console.log('\nCartes de mode :');
const stDir = path.join(ROOT, 'scanner/status');
let png = 0;
for (const f of fs.readdirSync(stDir)) {
  const m = f.match(/^mode-([a-z_]+)-\d+\.png$/);
  if (m && DROP.has(m[1])) { rm(`scanner/status/${f}`); png++; }
}
console.log(`  ${png} carte(s)`);

console.log(`\n── ${report.files} fichier(s) élagué(s) · ${report.keysRemoved} clé(s) · ${report.itemsRemoved} élément(s)`);
console.log(`   ${report.filesDeleted.length} fichier(s) et ${report.dirsDeleted.length} dossier(s) supprimés`);
if (!APPLY) console.log('\nRien n\'a été écrit. Relancer avec --apply.');
