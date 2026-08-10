#!/usr/bin/env node
'use strict';
/**
 * extract-universe — lit les sorties de screeners produites par collect.js et
 * émet le vivier dédupliqué sous forme de variables réutilisables.
 *
 *   node tools/extract-universe.js --in <dir> --out vars.json [--limit 60] [--exclude A,B]
 *
 * Sert de charnière entre deux vagues : la vague 1 découvre les candidats, la
 * vague 2 les enrichit. Sans cette étape il faudrait un LLM pour recopier une
 * liste de tickers d'un fichier vers un autre — exactement le transport qu'on
 * cherche à supprimer.
 */
const fs = require('fs'), path = require('path');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 && process.argv[i+1] ? process.argv[i+1] : d; };
const inDir = arg('--in'), outFile = arg('--out');
const limit = Number(arg('--limit', 60));
const exclude = new Set((arg('--exclude', '') || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean));
if (!inDir || !outFile) { console.error('Usage: --in <dir> --out <vars.json> [--limit N] [--exclude A,B]'); process.exit(2); }

const seen = new Map(); // symbole -> meilleur score vu
for (const f of fs.readdirSync(inDir).filter(f => f.endsWith('.json') && !f.startsWith('_') && f !== 'harness.json')) {
  let d; try { d = JSON.parse(fs.readFileSync(path.join(inDir, f), 'utf8')); } catch { continue; }
  const items = (d.data && d.data.items) || d.items || [];
  for (const it of items) for (const c of (it.candidates || [])) {
    const sym = (c.symbol || c.ticker || '').toUpperCase();
    if (!sym || exclude.has(sym)) continue;
    const sc = typeof c.score === 'number' ? c.score : 0;
    if (!seen.has(sym) || seen.get(sym) < sc) seen.set(sym, sc);
  }
}
const ranked = [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([s]) => s);
if (!ranked.length) { console.error('[extract-universe] vivier VIDE — screeners en échec ou aucun candidat. Ne pas poursuivre en silence.'); process.exit(1); }

// Découpage en lots pour les appels multi-symboles (QueryData accepte un CSV).
const B = 12, batches = [];
for (let i = 0; i < ranked.length; i += B) batches.push(ranked.slice(i, i + B).join(','));
const vars = { symbols: ranked.join(','), count: String(ranked.length) };
batches.forEach((b, i) => { vars['batch' + (i + 1)] = b; });
fs.writeFileSync(outFile, JSON.stringify(vars, null, 2));
console.log(`[extract-universe] ${ranked.length} tickers, ${batches.length} lot(s) → ${outFile}`);
console.log('  ' + ranked.slice(0, 12).join(', ') + (ranked.length > 12 ? ' …' : ''));
