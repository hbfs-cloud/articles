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
const path = require('path');

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
  // ── Contrôle de RÉALISATION, en plus du contrôle d'âge ────────────────────────────────
  // Le contrôle d'âge seul est FAIL-OPEN : le 2026-08-08, ce gate a certifié « 4 sources
  // vérifiées, 0 bloquante(s) », exit 0, sur le scan 20260810 dont la collecte avait
  // intégralement échoué (connecteur marketdata en 404). Le manifeste attestait des
  // horodatages frais pour des données qui n'existaient nulle part. Un manifeste décrit une
  // INTENTION de collecte ; il ne prouve pas qu'elle a abouti.
  //
  // Deux vérifications ajoutées, toutes deux sur le répertoire déclaré par `content` :
  //  (a) les fichiers de rôle du harnais (<content>/_wf/*.json) sont lus, et tout statut
  //      bloquant fait échouer. Ces fichiers existaient déjà et n'étaient lus PAR AUCUN
  //      outil du dépôt (`grep -rln "_wf" tools/` → zéro) : les agents consignaient
  //      correctement leur blocage dans le vide.
  //  (b) `--require-artifacts` exige la présence non vide des artefacts publiables. Non
  //      activé par défaut : le manifeste est légitimement écrit PENDANT la collecte,
  //      avant que les artefacts existent. Les commandes de publication doivent le passer.
  const contentDir = m.content ? path.join(path.dirname(path.resolve(file)), '..', path.basename(m.content)) : null;
  const baseDir = m.content && fs.existsSync(m.content) ? m.content : path.dirname(path.resolve(file));

  const wfDir = path.join(baseDir, '_wf');
  if (fs.existsSync(wfDir)) {
    const BLOCKING_RE = /BLOCK|UNAVAIL|ERROR|HARD_STOP|FAIL/i;
    for (const f of fs.readdirSync(wfDir).filter(x => x.endsWith('.json'))) {
      let d;
      try { d = JSON.parse(fs.readFileSync(path.join(wfDir, f), 'utf8')); }
      catch (e) { errors++; console.error(`❌ _wf/${f}: illisible (${e.message})`); continue; }
      // Un fichier de rôle SANS champ `blocking` explicite est traité comme bloquant :
      // l'absence de déclaration ne vaut pas feu vert (calendrier.json, le fichier du gate
      // G4 lui-même, était le seul des 9 à ne pas porter ce champ).
      const st = String(d.status || d.state || '');
      if (d.blocking === true || BLOCKING_RE.test(st)) {
        errors++; console.error(`❌ _wf/${f}: statut bloquant « ${st || 'blocking:true'} » — la collecte de ce rôle a échoué`);
      } else if (d.blocking === undefined && !st) {
        errors++; console.error(`❌ _wf/${f}: ni champ blocking ni status — indéterminé, donc traité comme bloquant`);
      }
    }
  }

  if (args.includes('--require-artifacts')) {
    const REQUIRED = { scanner: ['data.json', 'signals.json'], analyses: ['index.html'] };
    const kind = (m.content || '').split('/')[0];
    for (const f of (REQUIRED[kind] || ['index.html'])) {
      const p = path.join(baseDir, f);
      if (!fs.existsSync(p) || fs.statSync(p).size === 0) {
        errors++; console.error(`❌ artefact publiable absent ou vide : ${path.join(m.content || baseDir, f)}`);
      }
    }
  }

  console.log(`[freshness] ${checked} sources datées vérifiées — ${errors} bloquante(s)`);
  if (errors && warnOnly) { console.error('⚠️  --warn-only : erreurs non bloquantes (INTERDIT en publication)'); return 0; }
  return errors ? 1 : 0;
}

process.exit(main());
