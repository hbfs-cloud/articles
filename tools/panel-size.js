#!/usr/bin/env node
'use strict';
/**
 * panel-size — choisit QUELLES lentilles du panel adversarial lancer.
 *
 *   node tools/panel-size.js --type scanner --materiality 45 --channels web,telegram [--json]
 *
 * ── Le bon axe n'est pas la matérialité seule ────────────────────────────────
 * Dimensionner sur la seule matérialité-pour-email serait une faute : un scanner
 * à matérialité 20 publie quand même des niveaux sur lesquels un lecteur passe un
 * ordre. La question n'est pas « ce contenu est-il important ? » mais :
 *
 *     QU'EST-CE QUE LES GATES DÉTERMINISTES NE COUVRENT PAS DÉJÀ ?
 *
 * Un relecteur qui refait un calcul que validate-scan a déjà fait ne trouve rien.
 * Un relecteur qui lit une prose qu'aucun script ne sait juger trouve tout.
 *
 * Deux entrées, donc :
 *   COUVERTURE  ce que les scripts vérifient déjà pour ce type de contenu
 *   PORTÉE      email > telegram > web — un email interrompt, le web attend
 *
 * ── Plancher non négociable ──────────────────────────────────────────────────
 * Dès qu'un contenu publie des NIVEAUX DE TRADE, le panel ne descend jamais sous
 * 3 lentilles, quelle que soit la matérialité. Décision du 2026-08-11 : le panel
 * est non négociable. On le DIMENSIONNE, on ne le supprime pas.
 */

// Ce que les gates déterministes couvrent, PAR TYPE. Recensé, pas supposé.
const COUVERTURE = {
  scanner: {
    couvert: ['R/R depuis le milieu de zone', 'tp1_reachability 1-2×ATR', 'anti-dilution',
              'fenêtre résultats ±3 séances', 'schéma et cohérence data/signals',
              'planchers de score', 'diversification', 'anti-répétition'],
    gates: ['validate-scan.js', 'qa-check.js', 'check-freshness.js'],
    // Le quant et le QA sont largement redondants ici : les scripts refont les
    // mêmes calculs, de façon plus fiable et gratuitement.
    redondantes: ['quant', 'qa'],
  },
  weekly:  { couvert: ['taille et sections', 'tics d\'IA', 'fraîcheur des sources'],
             gates: ['qa-content.js', 'check-ai-tells.js', 'check-freshness.js'],
             // Rien ne vérifie une cotation, un signe, ou une thèse. D'où le weekly
             // du 10/08 : ~19 chiffres faux, tous les gates au vert.
             redondantes: [] },
  daily:   { couvert: ['sections', 'tics d\'IA', 'fraîcheur'],
             gates: ['qa-content.js', 'check-ai-tells.js', 'check-freshness.js'], redondantes: [] },
  analyse: { couvert: ['sections', 'tics d\'IA', 'fraîcheur'],
             gates: ['qa-content.js', 'check-ai-tells.js'], redondantes: [] },
  retro:   { couvert: ['politique de fill', 'chaîne d\'intégrité des trades'],
             gates: ['fill-policy.js', 'trade-integrity.js'], redondantes: ['qa'] },
};

// Lentilles par valeur marginale décroissante. L'ordre EST la priorité.
const LENTILLES = [
  { k: 'quant',    r: 'refait tous les calculs — R/R, ATR, extensions, indépendance des confluences' },
  { k: 'risk',     r: 'corrélation, concentration, exposition au drawdown, taille de position' },
  { k: 'trader',   r: 'tradabilité réelle : stop vs bruit, entrée atteignable, sortie qui existe' },
  { k: 'forensics',r: 'texture d\'IA, thèse non falsifiable, chiffres qui ne prouvent rien' },
  { k: 'analyst',  r: 'cohérence macro, catalyseur vérifiable, contradiction avec le déjà publié' },
  { k: 'qa',       r: 'intégrité des données, cohérence entre fichiers, conventions' },
  { k: 'ux',       r: 'lisibilité mobile, clarté des niveaux pour qui doit passer un ordre' },
];

const PUBLIE_DES_NIVEAUX = new Set(['scanner', 'daily', 'analyse', 'signals', 'aplus', 'swing']);
const PLANCHER_NIVEAUX = 3;

function choisir({ type, materiality, channels }) {
  const cov = COUVERTURE[type] || { couvert: [], gates: [], redondantes: [] };
  const ch = new Set(channels || ['web']);

  // PORTÉE — un email interrompt tout le monde et ne se rattrape pas.
  let base;
  let motifPortee;
  if (ch.has('email'))         { base = 7; motifPortee = 'email : interrompt toute la liste, irréversible'; }
  else if (ch.has('telegram')) { base = 5; motifPortee = 'telegram : notification poussée'; }
  else                         { base = 3; motifPortee = 'web seul : le lecteur vient, rien n\'est poussé'; }

  // MATÉRIALITÉ — module à la marge, ne décide pas seule.
  const m = Number.isFinite(materiality) ? materiality : 50;
  let ajust = 0;
  if (m >= 70) { ajust = +2; }
  else if (m < 25) { ajust = -1; }

  let n = Math.max(1, Math.min(LENTILLES.length, base + ajust));

  // Retirer les lentilles rendues redondantes par les gates déterministes :
  // un relecteur qui refait un calcul déjà fait par un script ne trouve rien.
  const retirees = [];
  let ordre = LENTILLES.filter(l => {
    if (cov.redondantes.includes(l.k)) { retirees.push(l.k); return false; }
    return true;
  });

  // PLANCHER — un contenu qui publie des niveaux ne descend jamais sous 3.
  const niveaux = PUBLIE_DES_NIVEAUX.has(type);
  if (niveaux && n < PLANCHER_NIVEAUX) n = PLANCHER_NIVEAUX;

  const retenues = ordre.slice(0, n);
  return {
    type, materiality: m, channels: [...ch],
    n_lentilles: retenues.length,
    lentilles: retenues.map(l => ({ lentille: l.k, role: l.r })),
    ecartees_redondantes: retirees,
    couvert_par_scripts: cov.couvert,
    gates: cov.gates,
    plancher_applique: niveaux && retenues.length === PLANCHER_NIVEAUX,
    raisonnement: [
      `portée → base ${base} (${motifPortee})`,
      `matérialité ${m}/100 → ${ajust >= 0 ? '+' : ''}${ajust}`,
      retirees.length ? `${retirees.join(', ')} écartée(s) : déjà couvert par ${cov.gates.join(', ')}` : 'aucune lentille redondante pour ce type',
      niveaux ? `type publiant des niveaux → plancher ${PLANCHER_NIVEAUX}` : 'pas de niveaux publiés, pas de plancher',
    ],
  };
}

const argv = process.argv;
const arg = (n, d) => { const i = argv.indexOf(n); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };
const type = arg('--type');
if (!type) { console.error('Usage: --type <type> [--materiality N] [--channels web,telegram,email] [--json]'); process.exit(2); }

const r = choisir({
  type,
  materiality: Number(arg('--materiality', NaN)),
  channels: (arg('--channels', 'web') || 'web').split(',').map(s => s.trim()).filter(Boolean),
});

if (argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
else {
  console.log(`${r.type} — ${r.n_lentilles} lentille(s) : ${r.lentilles.map(l => l.lentille).join(', ')}`);
  if (r.ecartees_redondantes.length) console.log(`écartées : ${r.ecartees_redondantes.join(', ')}`);
  console.log('raisonnement :');
  for (const x of r.raisonnement) console.log('  · ' + x);
  if (r.plancher_applique) console.log('  ⚠️  plancher appliqué — ce contenu publie des niveaux de trade');
}
