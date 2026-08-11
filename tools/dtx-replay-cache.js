#!/usr/bin/env node
'use strict';
/**
 * dtx-replay-cache — évite de rejouer chaque soir un backtest de 2021 à aujourd'hui.
 *
 *   node tools/dtx-replay-cache.js --dir <staging> --asof YYYY-MM-DD [--max-age-days 7] [--force]
 *
 * Un DtxReplay coûtait 300 à 348 s par portefeuille (393 s pour la vague complète le
 * 2026-08-10) — le plus gros poste de /scanner. Or il couvre 2021→aujourd'hui et
 * n'avance QUE D'UNE SÉANCE entre deux runs quotidiens.
 *
 * On le rejoue donc quand ça change quelque chose, pas tous les soirs :
 *   - cache plus vieux que --max-age-days (défaut 7)
 *   - configuration du portefeuille modifiée (empreinte de config/dtx)
 *   - --force
 *
 * Sortie : la liste des portefeuilles à REJOUER. Ceux qui sont à jour sont copiés
 * depuis le cache vers le staging, donc le consommateur en aval ne voit aucune
 * différence — dtx-mcp-ingest reçoit toujours --decide ET --replay (sans replay le
 * dashboard retombe sur un placeholder figé, incident du 23/07).
 *
 * Les DÉCISIONS ne sont JAMAIS mises en cache : elles portent les ordres du jour.
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 && process.argv[i+1] ? process.argv[i+1] : d; };
const has = n => process.argv.includes(n);

const dir = arg('--dir'), asof = arg('--asof');
const maxAgeDays = Number(arg('--max-age-days', 7));
const force = has('--force');
const CACHE = 'data/dtx-replay-cache';
if (!dir || !asof) { console.error('Usage: --dir <staging> --asof YYYY-MM-DD [--max-age-days 7] [--force]'); process.exit(2); }

function configFingerprint() {
  // Toute modification de config invalide le cache : un backtest calculé sur des
  // paramètres périmés décrirait une stratégie qu'on ne trade plus.
  const h = crypto.createHash('sha256');
  for (const f of ['data/modes-config.json']) {
    try { h.update(fs.readFileSync(f)); } catch { /* absent = ignoré */ }
  }
  return h.digest('hex').slice(0, 16);
}

fs.mkdirSync(CACHE, { recursive: true });
const fp = configFingerprint();
const stale = [], fresh = [];

for (const f of (fs.existsSync(dir) ? fs.readdirSync(dir) : [])) {
  if (!f.startsWith('replay_') || !f.endsWith('.json')) continue;
  const pf = f.slice('replay_'.length, -'.json'.length);
  const cf = path.join(CACHE, `${pf}.json`);
  let meta = null;
  try { meta = JSON.parse(fs.readFileSync(cf + '.meta', 'utf8')); } catch { /* pas de cache */ }
  const ageDays = meta ? (Date.parse(asof) - Date.parse(meta.asof)) / 86400000 : Infinity;
  const ok = !force && meta && meta.fingerprint === fp && ageDays <= maxAgeDays && fs.existsSync(cf);
  if (ok) { fresh.push({ pf, age: Math.round(ageDays) }); }
  else { stale.push({ pf, why: force ? 'forcé' : !meta ? 'aucun cache' : meta.fingerprint !== fp ? 'config modifiée' : `âge ${Math.round(ageDays)}j > ${maxAgeDays}j` }); }
}

// Rafraîchir le cache depuis le staging fraîchement collecté
for (const { pf } of stale) {
  const src = path.join(dir, `replay_${pf}.json`);
  if (!fs.existsSync(src)) continue;
  fs.copyFileSync(src, path.join(CACHE, `${pf}.json`));
  fs.writeFileSync(path.join(CACHE, `${pf}.json.meta`), JSON.stringify({ asof, fingerprint: fp, cached_at: new Date().toISOString() }, null, 2));
}
// Servir depuis le cache ceux qui restent valides
let served = 0;
for (const { pf } of fresh) {
  const dst = path.join(dir, `replay_${pf}.json`);
  fs.copyFileSync(path.join(CACHE, `${pf}.json`), dst);
  served++;
}

console.log(`[replay-cache] ${served} servi(s) depuis le cache, ${stale.length} à rejouer`);
for (const s of stale) console.log(`  rejouer ${s.pf} — ${s.why}`);
for (const f of fresh) console.log(`  cache   ${f.pf} — ${f.age}j`);
// Liste consommable par un plan de collecte : les portefeuilles à rejouer ce soir
fs.writeFileSync(path.join(dir, '_replay_needed.json'), JSON.stringify({ asof, fingerprint: fp, replay: stale.map(s => s.pf) }, null, 2));
