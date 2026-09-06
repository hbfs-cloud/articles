#!/usr/bin/env node
'use strict';

// Suit ce qui a été poussé vers Substack, et ce qui reste.
//
// Les 129 épisodes sont DÉJÀ PROGRAMMÉS chez Substack. On ne les recrée donc pas — `create_draft`
// perdrait la date de publication — on met à jour le brouillon existant avec `update_draft`, qui
// préserve `postSchedules` (vérifié trois fois avant de s'y fier).
//
// Pousser 129 corps de texte est un travail long, interrompu par la limite de session ou par une
// autre urgence. Sans état persistant on reprend au début, on repousse ce qui est déjà à jour, et
// surtout on ne sait plus lesquels ont reçu la version enrichie. L'empreinte du corps poussé sert
// exactement à ça : elle dit si le fichier a bougé depuis, donc s'il faut repousser.
//
//   node tools/episode-push-state.js                  → ce qui reste, en ordre de programmation
//   node tools/episode-push-state.js --next 5         → les 5 prochains, avec leur draft_id
//   node tools/episode-push-state.js --mark <clé>     → note la clé comme poussée (empreinte du build)
//   node tools/episode-push-state.js --all            → l'état complet

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { queue } = require('./lib/episode-queue');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };

const STATE_FILE = path.join(ROOT, 'data/substack/episode-push-state.json');
// `resolve` et non `join` : un chemin ABSOLU passé à `join` est recollé derrière la racine du dépôt
// et l'outil annonce « pas de build » pour des fichiers qui existent. Utile pour marquer l'état
// contre une version ANTÉRIEURE du build (git archive), donc contre ce qui a réellement été poussé.
const BUILD_DIR = path.resolve(ROOT, arg('--build', 'build/substack'));

const state = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : { pushed: {} };

const bodyOf = key => {
  const f = path.join(BUILD_DIR, key);
  if (!fs.existsSync(f)) return null;
  // Le front matter n'est pas poussé : il sert au pipeline, pas au lecteur.
  return fs.readFileSync(f, 'utf8').replace(/^---\n[\s\S]*?\n---\n?/, '');
};
const digest = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

// Marquage GROUPÉ, jamais concurrent. Plusieurs agents qui poussent en parallèle appelaient chacun
// `--mark`, donc chacun relisait l'état, ajoutait sa ligne et réécrivait le fichier : le dernier
// écrasait les autres et l'état sous-comptait ce qui était réellement poussé. Les agents renvoient
// désormais leurs clés, et le marquage se fait ici, en une passe.
const mark = arg('--mark');
if (mark) {
  const keys = mark.split(',').map(k => k.trim()).filter(Boolean);
  const done = [];
  for (const k of keys) {
    const body = bodyOf(k);
    if (!body) { console.error(`[poussée] pas de build pour ${k}`); process.exit(1); }
    state.pushed[k] = { sha256_16: digest(body), chars: body.length };
    done.push(k);
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
  console.log(`[poussée] ${done.length} clé(s) notée(s)`);
  process.exit(0);
}

// UNE DATE PASSÉE N'EST PLUS UN BROUILLON. `update_draft` ne modifie pas le corps d'un billet déjà
// publié (vérifié) : il faut supprimer et recréer. Les confondre ferait croire à une mise à jour qui
// n'a pas eu lieu — on les sépare donc, et on les traite à la main, un par un.
const NOW = arg('--now') || new Date().toISOString();

const rows = queue().map(r => {
  const key = `${r.series}/${r.file}`;
  const body = bodyOf(key);
  const rec = state.pushed[key];
  // « à jour » ne veut rien dire sans comparer : un épisode poussé PUIS enrichi doit repartir.
  const status = String(r.scheduled_at) < NOW ? 'déjà publié'
    : !body ? 'sans build'
    : !rec ? 'à pousser'
    : rec.sha256_16 === digest(body) ? 'à jour' : 'modifié depuis';
  return { ...r, key, status, chars: body ? body.length : 0 };
});

const pending = rows.filter(r => r.status === 'à pousser' || r.status === 'modifié depuis');
const next = Number(arg('--next', '0'));

if (argv.includes('--all')) {
  for (const r of rows) console.log(`${String(r.scheduled_at).slice(0, 10)}  ${r.status.padEnd(15)} ${r.key.padEnd(46)} ${r.draft_id || '—'}`);
} else if (next > 0) {
  for (const r of pending.slice(0, next)) {
    console.log(`${String(r.scheduled_at).slice(0, 10)}  ${r.key.padEnd(46)} draft=${r.draft_id}  ${r.chars} car.  (${r.status})`);
  }
} else {
  const by = s => rows.filter(r => r.status === s).length;
  console.log(`[poussée] ${rows.length} épisode(s) au calendrier`);
  console.log(`  déjà publié     : ${by('déjà publié')}  (update_draft sans effet — supprimer et recréer)`);
  console.log(`  à jour          : ${by('à jour')}`);
  console.log(`  à pousser       : ${by('à pousser')}`);
  console.log(`  modifié depuis  : ${by('modifié depuis')}`);
  console.log(`  sans build      : ${by('sans build')}`);
  if (pending.length) console.log(`\n  prochain : ${pending[0].key} (draft ${pending[0].draft_id}, ${String(pending[0].scheduled_at).slice(0, 10)})`);
}
