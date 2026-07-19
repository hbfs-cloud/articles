#!/usr/bin/env node
'use strict';

/**
 * qa-retro.js — assertion CI d'intégrité de notation d'une rétrospective scanner.
 *
 * Pour CHAQUE ligne notée de la table des setups (data-status pending/tp1/tp2/stopped) :
 *   |entrée_effective − entrée_publiée| <= tolérance chase  OU  statut NON REMPLI,
 * sinon le build de la rétro ÉCHOUE (exit 1). La tolérance vient de
 * tools/lib/fill-policy.js (constante unique partagée scan/rétro — audit 13-19/07/2026,
 * tag lecon-20260717). Une entrée chassée dans la tolérance doit porter le tag chase.
 *
 * L'entrée publiée est relue depuis scanner/YYYYMMDD/signals.json (champ `entry` =
 * borne HAUTE de la zone publiée — le chase se mesure au-dessus de la zone, donc de sa
 * borne haute ; un fill à l'intérieur de la zone n'est jamais un chase), avec fallback
 * sur l'attribut data-entry de la page pour les vieux scans sans signals.json — jamais
 * depuis la rétro elle-même, pour rendre le rebasing silencieux impossible.
 * ⚠️ Constat 19/07 : les pages des 14-16/07 n'affichaient que la borne BASSE de la zone
 * (UAA « 6.6 » pour une zone 6,60-6,80) — c'est cette divergence page/record qui a rendu
 * la notation ambiguë. Le template scanner doit afficher la zone complète (voir
 * docs/scanner-gates.md) pour que page et record ne puissent plus diverger.
 *
 * Branché dans publish.js --type retro (Step 4b). Utilisable seul :
 *   node tools/qa-retro.js scanner/retrospective/YYYYMMDD/
 */

const fs = require('fs');
const path = require('path');
const { CHASE_TOLERANCE_PCT, decideFill } = require('./lib/fill-policy');

const ROOT = path.join(__dirname, '..');

function usage() {
  console.error('Usage: node tools/qa-retro.js <scanner/retrospective/YYYYMMDD/ ou index.html>');
  process.exit(2);
}

function loadPublishedEntries(scanDate) {
  const map = {};
  // 1. Record machine de la zone : signals.json, champ `entry` (borne haute).
  const p = path.join(ROOT, 'scanner', scanDate, 'signals.json');
  if (fs.existsSync(p)) {
    try {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      for (const pool of ['signals', 'momentum', 'breakout', 'pullback', 'pre_squeeze']) {
        for (const s of j[pool] || []) {
          if (s && s.ticker && map[s.ticker] === undefined) map[s.ticker] = s.entry;
        }
      }
    } catch { /* signals.json illisible : fallback page ci-dessous */ }
  }
  // 2. Fallback (vieux scans sans signals.json) : data-entry de la page publiée.
  const htmlP = path.join(ROOT, 'scanner', scanDate, 'index.html');
  if (fs.existsSync(htmlP)) {
    const html = fs.readFileSync(htmlP, 'utf8');
    const re = /data-ticker="([A-Z.]+)"[^>]*\bdata-entry="([\d.]+)"/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      if (map[m[1]] === undefined) map[m[1]] = parseFloat(m[2]);
    }
  }
  return Object.keys(map).length ? map : null;
}

// « lun. 13 » + date de rétro (fin de semaine) → dossier scan YYYYMMDD.
// Un jour supérieur au jour de la rétro appartient au mois précédent (semaine à cheval).
function dayToScanDate(dayNum, retroCompact) {
  const y = +retroCompact.slice(0, 4), m = +retroCompact.slice(4, 6), endDay = +retroCompact.slice(6, 8);
  let yy = y, mm = m;
  if (dayNum > endDay) { mm -= 1; if (mm === 0) { mm = 12; yy -= 1; } }
  return `${yy}${String(mm).padStart(2, '0')}${String(dayNum).padStart(2, '0')}`;
}

function main() {
  const arg = process.argv[2];
  if (!arg) usage();
  let dir = path.resolve(ROOT, arg);
  if (fs.existsSync(dir) && fs.statSync(dir).isFile()) dir = path.dirname(dir);
  const retroCompact = path.basename(dir);
  if (!/^\d{8}$/.test(retroCompact)) {
    console.error(`❌ qa-retro: dossier "${retroCompact}" — attendu un dossier de rétro YYYYMMDD.`);
    process.exit(2);
  }
  const htmlPath = path.join(dir, 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Lignes notées : jour, ticker, présence du tag chase, entrée effective (décimale FR).
  const rowRe = /<tr data-status="(pending|tp1|tp2|stopped)"><td>\w+\.\s*(\d{1,2})<\/td><td><strong>([A-Z.]+)<\/strong>(.*?)<\/td><td>[^<]*<\/td><td>([\d]+(?:,\d+)?)<\/td>/g;
  const entriesCache = {};
  const failures = [];
  const warnings = [];
  let checked = 0;

  let m;
  while ((m = rowRe.exec(html)) !== null) {
    const [, , dayStr, ticker, tickerCellRest, effStr] = m;
    const hasChaseTag = tickerCellRest.includes('class="chase"');
    const effective = parseFloat(effStr.replace(',', '.'));
    const scanDate = dayToScanDate(+dayStr, retroCompact);
    if (entriesCache[scanDate] === undefined) entriesCache[scanDate] = loadPublishedEntries(scanDate);
    const published = entriesCache[scanDate] ? entriesCache[scanDate][ticker] : undefined;
    checked++;

    if (typeof published !== 'number') {
      failures.push(`${ticker} (${scanDate}): entrée publiée introuvable dans scanner/${scanDate}/signals.json — notation inattestable (fail-closed).`);
      continue;
    }
    const fill = decideFill(published, effective);
    if (fill.status === 'no_fill') {
      failures.push(`${ticker} (${scanDate}): entrée effective ${effective} vs publiée ${published} = ${fill.deviationPct > 0 ? '+' : ''}${fill.deviationPct}% — au-delà de la tolérance chase ${CHASE_TOLERANCE_PCT}% : la ligne doit être NON REMPLI (écart à documenter en « Transparence process », jamais rebasé).`);
    } else if (fill.status === 'chase' && !hasChaseTag) {
      failures.push(`${ticker} (${scanDate}): entrée chassée à +${fill.deviationPct}% (<= ${CHASE_TOLERANCE_PCT}%) sans tag chase — tagger la ligne.`);
    } else if (fill.status === 'filled' && hasChaseTag) {
      warnings.push(`${ticker} (${scanDate}): tag chase mais entrée ${effective} <= publiée ${published} (${fill.deviationPct}%) — tag superflu.`);
    }
  }

  if (checked === 0) {
    console.error('❌ qa-retro: aucune ligne notée trouvée dans la table — structure inattendue (fail-closed).');
    process.exit(1);
  }
  for (const w of warnings) console.warn(`⚠️  ${w}`);
  if (failures.length) {
    console.error(`\n❌ qa-retro FAILED — ${failures.length} ligne(s) notée(s) hors politique de fill (tolérance ${CHASE_TOLERANCE_PCT}%) :\n`);
    failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}`));
    console.error('\nRequalifier en NON REMPLI (ou tagger chase) + mention « Transparence process », puis re-lancer.\n');
    process.exit(1);
  }
  console.log(`✅ qa-retro PASSED — ${checked} lignes notées conformes à la politique de fill (tolérance ${CHASE_TOLERANCE_PCT}%, ${warnings.length} avertissement(s)).`);
}

main();
