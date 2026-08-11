#!/usr/bin/env node
'use strict';
/**
 * dtx-replay-cache — évite de rejouer chaque soir un backtest de 2021 à aujourd'hui.
 *
 *   node tools/dtx-replay-cache.js --dir <staging> --asof YYYY-MM-DD [--max-age-days 7] [--force]
 *                                  [--plan plans/scanner-dtx.json]
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
const planPath = arg('--plan');
const CACHE = 'data/dtx-replay-cache';
if (!dir || !asof) { console.error('Usage: --dir <staging> --asof YYYY-MM-DD [--max-age-days 7] [--force] [--plan <plan.json>]'); process.exit(2); }

/**
 * Portefeuilles ATTENDUS, lus dans le plan de collecte.
 *
 * Sans ça, ce script n'inventorie que ce qu'il TROUVE déjà dans le staging : un
 * portefeuille jamais rejoué n'y a aucun fichier, donc il n'est ni « frais » ni
 * « périmé » — il est INVISIBLE. Le compte tombe à « 0 à rejouer », scan-parallel.sh
 * bascule sur le plan decide-only, et le portefeuille n'est jamais collecté. C'est
 * la boucle qui a laissé hvep et stockbox_pit sans backtest jusqu'au 2026-08-11
 * (ingestion sautée à chaque run, collecte manuelle pour rattraper).
 *
 * Le plan est la seule source de vérité de ce qui DOIT exister. Drapeau optionnel :
 * sans --plan, comportement strictement inchangé.
 */
function expectedFromPlan(p) {
  if (!p) return [];
  try {
    const plan = JSON.parse(fs.readFileSync(p, 'utf8'));
    return (plan.waves || [])
      .flatMap(w => w.calls || [])
      .filter(c => c && typeof c.as === 'string' && c.as.startsWith('replay_'))
      .map(c => (c.args && c.args.portfolio) || c.as.slice('replay_'.length));
  } catch (e) {
    // Un plan illisible ne doit pas faire échouer le run : on retombe sur
    // l'inventaire par fichiers, qui est le comportement historique.
    console.error(`[replay-cache] plan illisible (${p}) : ${e.message} — inventaire par fichiers seul`);
    return [];
  }
}

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
// Le staging d'une séance neuve n'existe pas encore. Sans ce mkdir, servir le cache
// ou écrire _replay_needed.json lève ENOENT : le script sortait en 1, le fichier
// manquait, et l'appelant retombait sur le plan complet PAR ACCIDENT. On préfère un
// inventaire qui s'écrit toujours à une sécurité qui tient à un plantage.
fs.mkdirSync(dir, { recursive: true });
const fp = configFingerprint();
const stale = [], fresh = [];

// Union : ce qui traîne déjà dans le staging + ce que le plan exige. Un portefeuille
// attendu mais sans cache ni fichier tombe en « aucun cache » donc en « à rejouer ».
const found = (fs.existsSync(dir) ? fs.readdirSync(dir) : [])
  .filter(f => f.startsWith('replay_') && f.endsWith('.json'))
  .map(f => f.slice('replay_'.length, -'.json'.length));
const portfolios = [...new Set([...found, ...expectedFromPlan(planPath)])];

for (const pf of portfolios) {
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
