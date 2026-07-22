#!/usr/bin/env node
'use strict';
/**
 * check-freshness.js — gate anti-stale-data des pipelines de contenu (daily/weekly/retro/analyse/series/scanner).
 *
 * POURQUOI (feedback 22/07/2026) : la règle « MCP HARD STOP si données stale > 48h » existait en prose
 * (CLAUDE.md) mais rien ne la RENDAIT bloquante. Un article pouvait partir avec des cotations de
 * l'avant-veille présentées comme fraîches. Ce tool transforme la règle en exit code.
 *
 * CONTRAT :
 *  - L'AGENT écrit un manifeste `harness.json` à côté de l'artefact pendant la collecte : chaque source
 *    de données y est déclarée avec son horodatage RÉEL (celui renvoyé par l'appel, jamais "now").
 *  - Ce script ne fetch RIEN et n'estime RIEN : il compare des timestamps. Manifeste absent, source
 *    requise manquante, as_of manquant/illisible, source périmée (> max_age_h) ou datée du futur
 *    (> 15 min d'avance = horloge fausse ou timestamp inventé) ⇒ exit 1 (BLOQUANT).
 *  - `--warn-only` réservé au débogage local. Les commandes de publication l'interdisent.
 *
 * Manifeste attendu :
 * {
 *   "content": "daily/20260722",
 *   "generated_at": "2026-07-22T10:20:00Z",
 *   "sources": [
 *     { "name": "us_close",        "as_of": "2026-07-21T20:00:00Z", "max_age_h": 24,  "required": true,
 *       "origin": "market context overview" },
 *     { "name": "regime",          "as_of": "2026-07-22T10:14:00Z", "max_age_h": 6,   "required": true },
 *     { "name": "earnings_cal",    "as_of": "2026-07-22T10:16:00Z", "max_age_h": 24,  "required": true },
 *     { "name": "insiders",        "as_of": "2026-07-22T10:16:00Z", "max_age_h": 96,  "required": false }
 *   ]
 * }
 *
 * Usage :
 *   node tools/check-freshness.js daily/20260722/harness.json
 *   node tools/check-freshness.js <manifest> --now 2026-07-22T12:00:00Z   # tests reproductibles
 */

const fs = require('fs');

function fail(msg) { console.error(`❌ [freshness] ${msg}`); return 1; }

function main() {
  const args = process.argv.slice(2);
  const file = args.find(a => !a.startsWith('--'));
  const warnOnly = args.includes('--warn-only');
  const nowIdx = args.indexOf('--now');
  const now = nowIdx >= 0 && args[nowIdx + 1] ? new Date(args[nowIdx + 1]) : new Date();
  if (!file) { console.error('Usage: check-freshness.js <harness.json> [--now ISO] [--warn-only]'); return 2; }
  if (Number.isNaN(now.getTime())) return fail(`--now illisible`);

  let m;
  try { m = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return fail(`manifeste absent ou illisible : ${file} (${e.message})`); }

  if (!Array.isArray(m.sources) || !m.sources.length) return fail('manifeste sans sources[] — la collecte n\'a pas été tracée');

  let errors = 0, checked = 0;
  for (const s of m.sources) {
    const name = s.name || '(sans nom)';
    if (s.as_of == null) {
      if (s.required !== false) { errors++; console.error(`❌ ${name}: as_of manquant (source requise non collectée ?)`); }
      else console.log(`⚠️  ${name}: absent (optionnel, dégradé documenté)`);
      continue;
    }
    const asOf = new Date(s.as_of);
    if (Number.isNaN(asOf.getTime())) { errors++; console.error(`❌ ${name}: as_of illisible (${s.as_of})`); continue; }
    const ageH = (now - asOf) / 36e5;
    if (ageH < -0.25) { errors++; console.error(`❌ ${name}: daté du futur (${s.as_of}) — timestamp inventé ou horloge fausse`); continue; }
    const maxH = typeof s.max_age_h === 'number' ? s.max_age_h : 48; // défaut = règle MCP HARD STOP
    checked++;
    if (ageH > maxH) {
      if (s.required === false) { console.log(`⚠️  ${name}: stale ${ageH.toFixed(1)}h > ${maxH}h (optionnel)`); }
      else { errors++; console.error(`❌ ${name}: STALE — ${ageH.toFixed(1)}h > max ${maxH}h (as_of ${s.as_of})`); }
    } else {
      console.log(`✅ ${name}: ${ageH.toFixed(1)}h (max ${maxH}h)`);
    }
  }
  console.log(`[freshness] ${checked} sources datées vérifiées — ${errors} bloquante(s)`);
  if (errors && warnOnly) { console.error('⚠️  --warn-only : erreurs non bloquantes (INTERDIT en publication)'); return 0; }
  return errors ? 1 : 0;
}

process.exit(main());
