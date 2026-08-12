#!/usr/bin/env node
'use strict';
/**
 * extract-retro-symbols — charnière de la rétrospective. Lit les signaux d'un
 * scan CLOS et émet les variables dont `plans/retro.json` a besoin.
 *
 *   node tools/extract-retro-symbols.js --scan scanner/20260612 \
 *        --out scanner/20260612/retro/_data/vars.json [--scope equity|all] [--limit 60]
 *
 * Pendant rétro d'`extract-universe.js` : sans elle, `$symbols` devrait être
 * recopié à la main du `signals.json` vers le plan de collecte — exactement le
 * transport de données que la doctrine llm-script-boundary interdit (un modèle
 * qui recopie douze tickers en oublie un, et personne ne le voit).
 *
 * Ce qu'elle émet (toutes des chaînes, consommables en $var par collect.js) :
 *   symbols        vivier de la rétro selon --scope (défaut: equity)
 *   symbols_all    union de TOUS les paniers publiés, sans filtre de classe
 *   symbols_crypto / symbols_forex   paniers exotiques, isolés (voir plus bas)
 *   scandate       YYYYMMDD — sert à l'artefact scanner/$scandate/retro/
 *   scandate_iso   YYYY-MM-DD
 *   horizon        horizon max des symboles retenus, en séances
 *   horizon_signals horizon max de signals[] seul — la définition de desk-plan.js
 *   count          taille du vivier retenu
 *   batch1..N      lots de 12 symboles pour les appels multi-symboles
 *
 * Pourquoi `--scope equity` par défaut. Le plan rétro demande des `bars_daily`
 * REQUIS sur `$symbols` : un seul symbole exotique sans barres (paire forex
 * `EURJPY=X`, paire crypto `BNX-USD`) fait échouer un appel requis, donc le gate
 * de fraîcheur, donc la rétro entière — un panier de 4 métaux ferait tomber la
 * notation de 12 positions actions. Les paniers crypto et forex ne sont pas
 * perdus pour autant : ils sortent dans leurs propres variables, prêtes pour une
 * vague dédiée, et le décompte est affiché. `--scope all` force l'union.
 *
 * Sort en 1 si le vivier est vide : une rétro sans position à noter n'est pas
 * une rétro vide, c'est une lecture ratée du scan. Ne pas poursuivre en silence.
 */
const fs = require('fs');
const path = require('path');

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const scanArg = arg('--scan');
const outFile = arg('--out');
const scope = (arg('--scope', 'equity') || 'equity').toLowerCase();
const limit = Number(arg('--limit', 60));

if (!scanArg || !outFile) {
  console.error('Usage: --scan <scanner/YYYYMMDD> --out <vars.json> [--scope equity|all] [--limit N]');
  process.exit(2);
}
if (!['equity', 'all'].includes(scope)) { console.error(`[extract-retro-symbols] --scope inconnu: ${scope}`); process.exit(2); }

// --scan accepte le dossier du scan ou directement le signals.json.
const scanDir = scanArg.endsWith('.json') ? path.dirname(scanArg) : scanArg;
const sigFile = scanArg.endsWith('.json') ? scanArg : path.join(scanDir, 'signals.json');
if (!fs.existsSync(sigFile)) { console.error(`[extract-retro-symbols] ${sigFile} introuvable — pas de scan à noter.`); process.exit(1); }

let sig;
try { sig = JSON.parse(fs.readFileSync(sigFile, 'utf8')); }
catch (e) { console.error(`[extract-retro-symbols] ${sigFile} illisible: ${e.message}`); process.exit(1); }

// Un JSON corrompu à moitié lu vaut zéro : illisible ≠ vide.
if (!sig || typeof sig !== 'object') { console.error('[extract-retro-symbols] signals.json vide ou non conforme.'); process.exit(1); }

// ── Date du scan ────────────────────────────────────────────────────────────
// Priorité au champ déclaré DANS le fichier ; le nom de dossier n'est qu'un
// repli. Les deux divergents = on le dit, on ne choisit pas en silence.
const dirDate = (path.basename(scanDir).match(/^(\d{8})$/) || [])[1] || null;
const isoFromField = String(sig.scanDate || '').slice(0, 10);
const iso = /^\d{4}-\d{2}-\d{2}$/.test(isoFromField)
  ? isoFromField
  : (dirDate ? `${dirDate.slice(0, 4)}-${dirDate.slice(4, 6)}-${dirDate.slice(6)}` : null);
if (!iso) { console.error('[extract-retro-symbols] date du scan indéterminable (ni scanDate, ni dossier YYYYMMDD).'); process.exit(1); }
const compact = iso.replace(/-/g, '');
if (dirDate && dirDate !== compact) {
  console.error(`[extract-retro-symbols] ATTENTION: dossier ${dirDate} ≠ scanDate ${iso} — c'est scanDate qui fait foi.`);
}

// ── Collecte des positions publiées ─────────────────────────────────────────
// Tout tableau d'objets porteurs d'un ticker compte : `signals` et chaque
// `*_pool`. Énumérer les paniers un par un daterait le script au prochain
// panier ajouté (le pool métaux n'existait pas au premier scan).
const rows = [];
for (const [key, val] of Object.entries(sig)) {
  if (!Array.isArray(val)) continue;
  if (key !== 'signals' && !/_pool$/.test(key)) continue;
  for (const r of val) {
    if (!r || typeof r !== 'object') continue;
    const sym = String(r.ticker || r.symbol || '').trim().toUpperCase();
    if (!sym) continue;
    rows.push({ sym, pool: key, score: Number(r.score) || 0, horizon: Number(r.horizon) || 0, assetClass: String(r.assetClass || '').toLowerCase() });
  }
}
if (!rows.length) { console.error('[extract-retro-symbols] aucun signal dans le scan — rien à noter.'); process.exit(1); }

// Classe d'actif : le suffixe du symbole fait foi, l'étiquette du panier n'est
// qu'un indice (un ETF a pu tomber dans un pool exotique).
const classOf = (r) => {
  if (/-USD$/.test(r.sym) || r.assetClass === 'crypto') return 'crypto';
  if (/=X$/.test(r.sym) || r.assetClass === 'forex') return 'forex';
  return 'equity';
};

const best = new Map(); // symbole -> meilleure ligne vue (score max)
for (const r of rows) {
  const prev = best.get(r.sym);
  if (!prev || prev.score < r.score) best.set(r.sym, r);
}
const uniq = [...best.values()].sort((a, b) => b.score - a.score);

const bucket = { equity: [], crypto: [], forex: [] };
for (const r of uniq) bucket[classOf(r)].push(r.sym);

const all = uniq.map((r) => r.sym);
const picked = (scope === 'all' ? all : bucket.equity).slice(0, limit);
if (!picked.length) {
  console.error(`[extract-retro-symbols] vivier VIDE pour --scope ${scope} (crypto=${bucket.crypto.length}, forex=${bucket.forex.length}). Relancer avec --scope all si c'est voulu.`);
  process.exit(1);
}

// Deux horizons, parce qu'il y a deux questions. `horizon` couvre les symboles
// RÉELLEMENT retenus (une position métaux à 14 séances n'est pas clôturée par
// l'horizon de 10 d'une action). `horizon_signals` reprend la définition de
// desk-plan.js — max sur `signals[]` seulement — pour que les deux pièces
// puissent être rapprochées au lieu de diverger en silence.
const pickedSet = new Set(picked);
const horizon = Math.max(10, ...uniq.filter((r) => pickedSet.has(r.sym)).map((r) => r.horizon).filter(Boolean));
const horizonSignals = Math.max(10, ...rows.filter((r) => r.pool === 'signals').map((r) => r.horizon).filter(Boolean));

const B = 12, batches = [];
for (let i = 0; i < picked.length; i += B) batches.push(picked.slice(i, i + B).join(','));

const vars = {
  symbols: picked.join(','),
  symbols_all: all.join(','),
  symbols_crypto: bucket.crypto.join(','),
  symbols_forex: bucket.forex.join(','),
  scandate: compact,
  scandate_iso: iso,
  horizon: String(horizon),
  horizon_signals: String(horizonSignals),
  count: String(picked.length),
};
batches.forEach((b, i) => { vars['batch' + (i + 1)] = b; });

fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(vars, null, 2));

console.log(`[extract-retro-symbols] scan ${iso} — ${picked.length} symbole(s) retenu(s) (scope=${scope}), ${batches.length} lot(s) → ${outFile}`);
console.log('  ' + picked.slice(0, 12).join(', ') + (picked.length > 12 ? ' …' : ''));
if (scope !== 'all' && (bucket.crypto.length || bucket.forex.length)) {
  console.log(`  écartés du vivier requis : ${bucket.crypto.length} crypto, ${bucket.forex.length} forex — disponibles en $symbols_crypto / $symbols_forex.`);
}
