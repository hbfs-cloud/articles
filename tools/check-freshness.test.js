#!/usr/bin/env node
'use strict';

/**
 * check-freshness.test.js — verrouille la leçon du 2026-08-12.
 *
 * Ce soir-là, `check-freshness` a certifié « 10 sources vérifiées, 0 bloquante(s) », toutes à
 * « 0,0 h », sur une collecte partie 9 minutes après la clôture US — avant l'ingestion des barres
 * du jour. Les DIX sources décrivaient la séance de la VEILLE. Un briefing publié dessus aurait
 * raconté hier en se présentant comme celui du jour, et le gate censé rendre exactement cela
 * impossible l'aurait laissé passer : il mesurait l'ÂGE DE LA COLLECTE, jamais la SÉANCE DÉCRITE.
 *
 * Ces tests figent les deux propriétés qui manquaient, plus les faux positifs qu'il ne faut pas
 * réintroduire en corrigeant (dates futures d'un calendrier, harnais anciens sans les champs).
 *
 * Run: node tools/check-freshness.test.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const SCRIPT = path.join(__dirname, 'check-freshness.js');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'freshness-test-'));

let passed = 0, failed = 0;
function assert(cond, name, detail) {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? '  → ' + detail : ''}`); }
}

/** Lance le gate sur un manifeste et rend {code, out}. */
function run(manifest, args = []) {
  const f = path.join(TMP, `h-${Math.abs(hash(JSON.stringify(manifest)))}.json`);
  fs.writeFileSync(f, JSON.stringify(manifest, null, 2));
  try {
    const out = execFileSync('node', [SCRIPT, f, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status, out: String(e.stdout || '') + String(e.stderr || '') };
  }
}
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

const NOW = new Date().toISOString();
const src = (o) => Object.assign({ as_of: NOW, max_age_h: 24, required: true }, o);

// ── Test 1 : LE cas du 2026-08-12 ────────────────────────────────────────────
console.log('\nTest 1: une source fraîche qui décrit la séance précédente est BLOQUANTE');
{
  const r = run({
    reference_close: '2026-08-12',
    sources: [src({ name: 'bars_indices', expects_close: true, reference_close: '2026-08-12', data_through: '2026-08-11' })],
  });
  assert(r.code === 1, 'exit 1 (le gate refuse)', `code=${r.code}`);
  assert(/SÉANCE EN RETARD/.test(r.out), 'la raison nomme le retard de séance');
  assert(/2026-08-11/.test(r.out) && /2026-08-12/.test(r.out), 'les deux dates sont citées');
  assert(/0\.0h/.test(r.out), 'le message dit qu\'elle était pourtant « fraîche » — c\'est le piège à documenter');
}

// ── Test 2 : la même source à jour passe ─────────────────────────────────────
console.log('\nTest 2: la même source atteignant la clôture passe');
{
  const r = run({
    reference_close: '2026-08-12',
    sources: [src({ name: 'bars_indices', expects_close: true, reference_close: '2026-08-12', data_through: '2026-08-12' })],
  });
  assert(r.code === 0, 'exit 0', `code=${r.code}`);
  assert(/séance 2026-08-12 = clôture de référence/.test(r.out), 'le succès ATTESTE la séance, il ne dit pas seulement « frais »');
}

// ── Test 3 : une source EN AVANCE est du lookahead ──────────────────────────
console.log('\nTest 3: une source dépassant la clôture de référence est bloquante');
{
  const r = run({
    reference_close: '2026-08-11',
    sources: [src({ name: 'bars_indices', expects_close: true, reference_close: '2026-08-11', data_through: '2026-08-12' })],
  });
  assert(r.code === 1, 'exit 1 — une preuve point-in-time doit être exacte', `code=${r.code}`);
  assert(/LOOKAHEAD/.test(r.out), 'la raison nomme explicitement la contamination future');
}

// ── Test 4 : pas de faux positif sur les sources non déclarées ───────────────
console.log('\nTest 4: sans expects_close, la date du contenu n\'est PAS un motif de blocage');
{
  // Un calendrier économique porte des dates futures ; un screener une date d'exécution.
  // Leur imposer la clôture produirait des blocages faux, donc un gate qu'on finirait par désarmer.
  const r = run({
    reference_close: '2026-08-12',
    sources: [
      src({ name: 'economic_events', data_through: '2026-08-20' }),
      src({ name: 'screen_swing', data_through: '2026-08-11' }),
    ],
  });
  assert(r.code === 0, 'exit 0', `code=${r.code}`);
  assert(/données jusqu'au 2026-08-20/.test(r.out), 'la date est tout de même AFFICHÉE (informative, non bloquante)');
}

// ── Test 5 : rétrocompatibilité ──────────────────────────────────────────────
console.log('\nTest 5: un harnais ancien (sans data_through ni expects_close) passe comme avant');
{
  const r = run({ reference_close: '2026-08-12', sources: [src({ name: 'status' }), src({ name: 'regime' })] });
  assert(r.code === 0, 'exit 0 — aucun blocage rétroactif sur les manifestes déjà écrits', `code=${r.code}`);
}

// ── Test 6 : expects_close sans donnée lisible = BLOQUANT ───────────────────
console.log('\nTest 6: expects_close sans data_through est bloquant (ne pas savoir ≠ être à jour)');
{
  const r = run({
    reference_close: '2026-08-12',
    sources: [src({ name: 'bars_indices', expects_close: true, reference_close: '2026-08-12' })],
  });
  assert(r.code === 1, 'exit 1', `code=${r.code}`);
  assert(/aucune date lisible/.test(r.out), 'la raison distingue « illisible » de « périmé »');
}

// ── Test 7 : expects_close sans clôture de référence = BLOQUANT ─────────────
console.log('\nTest 7: expects_close sans clôture de référence est bloquant (contrat incomplet)');
{
  const r = run({ sources: [src({ name: 'bars_indices', expects_close: true, data_through: '2026-08-12' })] });
  assert(r.code === 1, 'exit 1 — un contrat de date sans date ne vaut rien', `code=${r.code}`);
}

// ── Test 8 : l'ancien contrôle d'âge n'a pas été perdu ──────────────────────
console.log('\nTest 8: le contrôle d\'âge reste actif (non-régression)');
{
  const old = new Date(Date.now() - 100 * 3600e3).toISOString();
  const r = run({ reference_close: '2026-08-12', sources: [{ name: 'regime', as_of: old, max_age_h: 6, required: true }] });
  assert(r.code === 1, 'exit 1 sur une source périmée', `code=${r.code}`);
  assert(/STALE/.test(r.out), 'le motif d\'âge est toujours nommé');
}

console.log('\n' + '─'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
if (failed) { console.log('SOME TESTS FAILED'); process.exit(1); }
console.log('ALL TESTS PASSED');
