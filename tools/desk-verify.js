#!/usr/bin/env node
'use strict';
/**
 * desk-verify — rapproche ce qui est SUR LE DISQUE de ce qui est DANS LE REGISTRE.
 *
 *   node tools/desk-verify.js [--json] [--window-h 24]
 *
 * ── Pourquoi ce fichier existe ──────────────────────────────────────────────
 * Rien ne signalait un `--record` oublié. Le panel a été long, l'enregistrement
 * saute, et au run suivant le même jour la cadence ne retient plus le produit :
 * il ressort en double sur le web et sur Telegram. L'oubli est le mode de panne
 * le plus probable de tout le dispositif — bien plus que le contournement, parce
 * qu'il ne demande aucune intention.
 *
 * Le rapprochement porte sur les produits qui laissent un ARTEFACT DATÉ sur
 * disque. Les autres (signals, rotation, earnings, macro) ne produisent pas de
 * fichier canonique : leur absence de trace ne prouve rien, donc on ne prétend
 * pas les vérifier. Dire ce qu'on ne couvre pas fait partie du contrôle.
 *
 * Sortie : 0 = tout artefact récent a sa ligne de registre. 1 = écart.
 */
const fs = require('fs');
const path = require('path');

process.chdir(path.join(__dirname, '..'));

const argv = process.argv;
const arg = (n, d) => { const i = argv.indexOf(n); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };
const WINDOW_H = Number(arg('--window-h', 24)) || 24;
const SINCE = Date.now() - WINDOW_H * 3600000;

const LEDGER = path.join('data', 'publication-ledger.ndjson');
const LEGACY = path.join('data', 'publication-ledger.json');

function ledgerEntries() {
  const out = [];
  try {
    const d = JSON.parse(fs.readFileSync(LEGACY, 'utf8'));
    if (d && Array.isArray(d.entries)) out.push(...d.entries);
  } catch { /* absent : normal */ }
  let raw = '';
  try { raw = fs.readFileSync(LEDGER, 'utf8'); } catch { /* absent : premier run */ }
  for (const l of raw.split('\n')) {
    const s = l.trim();
    if (!s || /^(<{7}|={7}|>{7}|\|{7})/.test(s)) continue;
    try { const e = JSON.parse(s); if (e && typeof e === 'object') out.push(e); } catch { /* ligne abîmée : le gate la signale déjà */ }
  }
  return out;
}

const ls = d => { try { return fs.readdirSync(d); } catch { return []; } };
const mtime = p => { try { return fs.statSync(p).mtimeMs; } catch { return null; } };

// Artefacts canoniques : le fichier que l'on publie, pas un fichier de travail.
function recentArtifacts() {
  const found = [];
  const push = (type, file) => { const m = mtime(file); if (m != null && m >= SINCE) found.push({ type, file, at: new Date(m).toISOString() }); };
  for (const d of ls('scanner')) {
    if (!/^\d{8}$/.test(d)) continue;
    push('scanner', `scanner/${d}/index.html`);
    push('retro', `scanner/${d}/retro/index.html`);
  }
  for (const d of ls('daily')) if (/^\d{8}$/.test(d)) push('daily', `daily/${d}/index.html`);
  for (const d of ls('weekly')) if (/^\d{8}$/.test(d)) push('weekly', `weekly/${d}/index.html`);
  return found;
}

const entries = ledgerEntries().filter(e => {
  const t = Date.parse(e.at);
  return Number.isFinite(t) && t >= SINCE;
});
const recorded = new Set(entries.map(e => e.type));
const artifacts = recentArtifacts();

const gaps = [];
for (const a of artifacts) {
  if (!recorded.has(a.type)) {
    gaps.push({
      type: a.type, artifact: a.file, produced_at: a.at,
      probleme: `artefact publié il y a moins de ${WINDOW_H} h, AUCUNE ligne « ${a.type} » dans le registre`,
      consequence: `au prochain run, la cadence croira « ${a.type} » jamais publié et le republiera — double page, double notification`,
      correctif: `bash tools/desk-run.sh --record ${a.type} --channels web,telegram`,
    });
  }
}

const NON_COUVERTS = ['signals', 'rotation', 'earnings', 'macro', 'squeeze'];
const report = {
  window_h: WINDOW_H,
  artefacts_recents: artifacts,
  types_enregistres: [...recorded].sort(),
  ecarts: gaps,
  non_couverts: NON_COUVERTS,
  non_couverts_raison: 'ces produits ne laissent pas d\'artefact canonique daté sur disque — leur absence de trace ne prouve rien, le rapprochement ne les couvre donc pas.',
};

if (argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`\n  desk-verify — fenêtre ${WINDOW_H} h`);
  console.log(`  artefacts récents : ${artifacts.length || 'aucun'}`);
  for (const a of artifacts) console.log(`    ${a.type.padEnd(9)} ${a.file}`);
  console.log(`  registre          : ${[...recorded].sort().join(', ') || 'vide'}`);
  if (!gaps.length) console.log('\n  ✓ tout artefact récent a sa ligne de registre.');
  else {
    console.log(`\n  ✗ ${gaps.length} ÉCART(S) :`);
    for (const g of gaps) {
      console.log(`\n    ${g.type} — ${g.artifact}`);
      console.log(`      ${g.probleme}`);
      console.log(`      conséquence : ${g.consequence}`);
      console.log(`      → ${g.correctif}`);
    }
  }
  console.log(`\n  non couverts : ${NON_COUVERTS.join(', ')} — ${report.non_couverts_raison}\n`);
}

process.exit(gaps.length ? 1 : 0);
