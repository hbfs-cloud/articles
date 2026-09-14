#!/usr/bin/env node
'use strict';
/**
 * Le seuil de score d'un mode n'est JAMAIS court-circuité par un chemin d'affichage.
 *
 * Régression du 2026-09-13 (commit 97cf792c6, « Show next-session scanner orders as pending ») :
 * l'aperçu de week-end appelait signalsFor(cfg, {pending:true}) et le filtre portait
 *   .filter(s => options.pending || cfg.minScore <= 0 || s.score >= cfg.minScore)
 * Le court-circuit `options.pending ||` publiait « 1 Order to Place : META » pour un signal à 80
 * face au seuil 90 de turbo, pendant que l'instantané JSON du même scan portait 0 ordre. Deux
 * surfaces du même produit se contredisaient, et surtout le zéro réel — aucun signal classé
 * depuis le 2026-09-08 — restait invisible derrière un « No new orders » qui ressemblait à une
 * séance calme.
 *
 * Un aperçu montre en avance ce qui VA se passer. Il n'invente pas une éligibilité.
 */
const assert = require('assert'), fs = require('fs'), path = require('path');
const RAW = fs.readFileSync(path.join(__dirname, 'gen-status-page.js'), 'utf8');
// Les commentaires sont retirés : ce fichier DOCUMENTE la régression qu'il interdit, et un test
// qui lirait sa propre documentation comme une infraction se déclencherait sur sa propre mémoire.
const SRC = RAW.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
let n = 0;
const check = (label, fn) => { fn(); n++; console.log(`PASS ${label}`); };

check('aucun court-circuit du seuil de score dans signalsFor', () => {
  const gate = /\.filter\(s => ([^)]*?)cfg\.minScore <= 0 \|\| s\.score >= cfg\.minScore\)/.exec(SRC);
  assert.ok(gate, 'le filtre minScore de signalsFor est introuvable — a-t-il été renommé ?');
  assert.strictEqual(gate[1], '',
    `le seuil de score est précédé de « ${gate[1].trim()} », qui peut le court-circuiter. ` +
    'Un chemin d\'affichage ne doit jamais rendre éligible un signal que le mode rejette.');
});

check('la branche d\'aperçu ne détourne pas la source des signaux', () => {
  assert.ok(!/signalsFor\(cfg, \{ ?pending: ?true ?\}\)/.test(SRC),
    'signalsFor est encore appelée avec {pending:true} : ce drapeau n\'existait que pour porter le court-circuit.');
});

check('un rejet par le seuil se distingue d\'une séance sans candidat', () => {
  assert.ok(/function belowScoreGate\(/.test(SRC),
    'belowScoreGate() a disparu : « No new orders » redeviendrait indiscernable d\'un seuil que plus aucun signal n\'atteint.');
  assert.ok(/par le seuil de score/.test(SRC),
    'la ligne de statut n\'annonce plus le rejet par seuil.');
  assert.ok(/belowScoreGate\(cfg\)/.test(SRC),
    'belowScoreGate est définie mais jamais appelée — la ligne honnête ne serait jamais rendue.');
});

console.log(`\n${n} assertions OK`);
