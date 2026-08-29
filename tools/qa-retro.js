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
 * ⚠️ RÉPARÉ le 2026-08-11 — deux défauts rendaient ce contrôle inapplicable :
 *
 * (a) SÉMANTIQUE DU CHAMP `entry`. Le script postulait « entry = borne HAUTE ». C'est vrai
 *     pour les scans récents (20260811 : entry_low 87,41 + entry 88,11) mais FAUX pour juin
 *     2026, où `entry` seul vaut le MILIEU de fourchette (345-355 → 350) et où ni entry_low
 *     ni entry_high n'existent. Mesurer un chase au-dessus d'un milieu déplace la tolérance
 *     d'une demi-largeur de zone : sur la rétro du 20260612, 8 lignes basculaient en « chase »
 *     et une dépassait la tolérance, uniquement à cause de ce postulat.
 *     → La borne haute est désormais DÉDUITE (entry_high, sinon entry>entry_low), et quand
 *       elle est INDÉDUCTIBLE le script refuse d'attester au lieu de deviner. L'opérateur
 *       peut lever l'ambiguïté avec --assume-entry=mid|high, et son choix est IMPRIMÉ dans
 *       la sortie : une convention supposée doit rester visible, jamais tacite.
 *
 * (b) SCHÉMA DE LIGNE. Le script n'acceptait qu'une rétro HEBDOMADAIRE (colonne « lun. 13 »
 *     dont il dérivait la date de scan). Une rétro MONO-SCAN (scanner/YYYYMMDD/retro/) n'a
 *     pas de colonne jour — toutes ses lignes viennent du même scan — donc zéro ligne était
 *     reconnue et le fail-closed se déclenchait sur un article parfaitement valide.
 *     → Les deux formes sont acceptées ; en mono-scan la date vient du CHEMIN.
 *
 * L'entrée publiée est relue depuis scanner/YYYYMMDD/signals.json (borne HAUTE de la zone — le chase se mesure au-dessus de la zone, donc de sa
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
      // ⚠️ ÉTENDU le 2026-08-14 (rétro 20260721) : `tkl_pool` est un pool PUBLIÉ, avec zone
      // d'entrée complète (entry_low + entry + entry_high). Il était absent de cette liste, donc
      // toute ligne notée issue de ce pool tombait en fail-closed « entrée publiée introuvable »
      // et rendait la rétro inattestable — 8 lignes sur 18 pour le scan du 21/07. L'ajout n'assouplit
      // rien : il donne au contrôle la donnée qui lui manquait pour attester ces lignes.
      for (const pool of ['signals', 'momentum', 'breakout', 'pullback', 'pre_squeeze', 'tkl_pool']) {
        for (const s of j[pool] || []) {
          if (!s || !s.ticker || map[s.ticker] !== undefined) continue;
          // Borne HAUTE de la zone : le chase se mesure au-dessus de la zone.
          // Ordre de préférence — explicite, puis déductible, puis ambigu.
          let high = null, source = null;
          if (typeof s.entry_high === 'number') { high = s.entry_high; source = 'entry_high'; }
          else if (typeof s.entry_low === 'number' && typeof s.entry === 'number' && s.entry > s.entry_low) {
            high = s.entry; source = 'entry>entry_low';
          } else if (typeof s.entry === 'number') {
            // Seul `entry` : impossible de savoir si c'est le milieu ou la borne haute.
            high = s.entry; source = 'AMBIGU';
          }
          if (high !== null) map[s.ticker] = { high, source };
        }
      }
    } catch { /* signals.json illisible : fallback page ci-dessous */ }
  }
  // 2. Fallback (vieux scans sans signals.json) : data-entry de la page publiée.
  const htmlP = path.join(ROOT, 'scanner', scanDate, 'index.html');
  if (fs.existsSync(htmlP)) {
    const html = fs.readFileSync(htmlP, 'utf8');
    const re = /data-ticker="([A-Z.]+)"[^>]*\bdata-entry="([\d.]+)"/g;  // forme {high,source} ci-dessous
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

function addBusinessDays(dateStr, days) {
  const date = new Date(`${dateStr}T12:00:00Z`);
  let added = 0;
  while (added < days) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) added++;
  }
  return date.toISOString().slice(0, 10);
}

function main() {
  const argv = process.argv.slice(2);
  const arg = argv.find(a => !a.startsWith('--'));
  if (!arg) usage();
  const assumeArg = (argv.find(a => a.startsWith('--assume-entry=')) || '').split('=')[1] || null;
  if (assumeArg && !['mid', 'high'].includes(assumeArg)) {
    console.error('❌ qa-retro: --assume-entry attend "mid" ou "high".');
    process.exit(2);
  }
  let dir = path.resolve(ROOT, arg);
  if (fs.existsSync(dir) && fs.statSync(dir).isFile()) dir = path.dirname(dir);

  // Deux formes de rétro :
  //   HEBDO      scanner/retrospective/YYYYMMDD/  → la date de scan vient de la colonne jour
  //   MONO-SCAN  scanner/YYYYMMDD/retro/          → la date vient du CHEMIN, pas de colonne jour
  let retroCompact = path.basename(dir);
  let monoScanDate = null;
  if (retroCompact === 'retro') {
    monoScanDate = path.basename(path.dirname(dir));
    if (!/^\d{8}$/.test(monoScanDate)) {
      console.error(`❌ qa-retro: rétro mono-scan attendue sous scanner/YYYYMMDD/retro/ — reçu "${dir}".`);
      process.exit(2);
    }
    retroCompact = monoScanDate;
  } else if (!/^\d{8}$/.test(retroCompact)) {
    console.error(`❌ qa-retro: dossier "${retroCompact}" — attendu scanner/retrospective/YYYYMMDD/ ou scanner/YYYYMMDD/retro/.`);
    process.exit(2);
  }
  const htmlPath = path.join(dir, 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Lignes notées : jour, ticker, présence du tag chase, entrée effective (décimale FR).
  // Deux schémas acceptés : hebdo (colonne « lun. 13 ») et mono-scan (pas de colonne jour).
  const rowRe = monoScanDate
    ? /<tr data-status="(pending|expired|expired_after_tp1|tp1|tp1_be|tp2|stopped|no_fill|chase)"><td><strong>([A-Z.]+)<\/strong>(.*?)<\/td><td>[^<]*<\/td><td>([\d]+(?:[.,]\d+)?)<\/td>/g
    : /<tr data-status="(pending|expired|tp1|tp2|stopped)"><td>\w+\.\s*(\d{1,2})<\/td><td><strong>([A-Z.]+)<\/strong>(.*?)<\/td><td>[^<]*<\/td><td>([\d]+(?:[.,]\d+)?)<\/td>/g;
  const entriesCache = {};
  const failures = [];
  const warnings = [];
  let checked = 0, ambiguous = 0;

  let m;
  while ((m = rowRe.exec(html)) !== null) {
    const [ticker, tickerCellRest, effStr] = monoScanDate
      ? [m[2], m[3], m[4]]
      : [m[3], m[4], m[5]];
    const hasChaseTag = tickerCellRest.includes('class="chase"');
    const effective = parseFloat(effStr.replace(',', '.'));
    const scanDate = monoScanDate || dayToScanDate(+m[2], retroCompact);
    if (entriesCache[scanDate] === undefined) entriesCache[scanDate] = loadPublishedEntries(scanDate);
    const rec = entriesCache[scanDate] ? entriesCache[scanDate][ticker] : undefined;
    checked++;

    let published;
    if (rec && typeof rec === 'object') {
      if (rec.source === 'AMBIGU') {
        if (!assumeArg) {
          failures.push(`${ticker} (${scanDate}): signals.json ne porte que \`entry\` (${rec.high}), sans entry_low ni entry_high — impossible de savoir si c'est le MILIEU ou la borne HAUTE de la zone. Le chase n'est pas mesurable : relancer avec --assume-entry=mid|high pour trancher explicitement (le choix sera imprimé), ou corriger le record du scan.`);
          continue;
        }
        ambiguous++;
        published = rec.high; // 'high' : tel quel. 'mid' : voir ci-dessous.
        if (assumeArg === 'mid') {
          // Convention MILIEU : le haut de zone est inconnu, donc tout fill au-dessus du
          // milieu serait compté comme chase à tort. On ne mesure QUE le dépassement franc.
          published = rec.high;
        }
      } else published = rec.high;
    } else published = rec;

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

  // A mono-scan is executable on D0 but expires after N subsequent business
  // days. This mirrors update-tracking/gen-status-page and prevents a retro
  // from silently dropping the final session by slicing N bars from D0.
  if (monoScanDate) {
    const resultsPath = path.join(dir, 'retro-results.json');
    const signalsPath = path.join(ROOT, 'scanner', monoScanDate, 'signals.json');
    try {
      const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
      const signals = JSON.parse(fs.readFileSync(signalsPath, 'utf8'));
      const scanDate = signals.scanDate;
      const maxHorizon = Math.max(...(signals.signals || []).map(s => s.horizon || 0));
      const expectedEnd = addBusinessDays(scanDate, maxHorizon);
      if (results.summary?.horizon_end !== expectedEnd) {
        failures.push(`fenêtre: horizon_end=${results.summary?.horizon_end || 'absent'}, attendu ${expectedEnd} (scan_date ${scanDate} + ${maxHorizon} jours ouvrés; D0 exécutable).`);
      }
      const signalByTicker = Object.fromEntries((signals.signals || []).map(s => [s.ticker, s]));
      for (const outcome of results.outcomes || []) {
        const signal = signalByTicker[outcome.ticker];
        if (!signal) continue;
        const tickerEnd = addBusinessDays(scanDate, signal.horizon || maxHorizon);
        if (outcome.horizon_end !== tickerEnd) {
          failures.push(`${outcome.ticker}: horizon_end=${outcome.horizon_end || 'absent'}, attendu ${tickerEnd}.`);
        }
      }
    } catch (error) {
      failures.push(`fenêtre: contrôle horizon impossible (${error.message}).`);
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
  if (ambiguous) console.warn(`\n⚠️  ${ambiguous} ligne(s) mesurée(s) sous la convention SUPPOSÉE --assume-entry=${assumeArg} : le record du scan ne dit pas ce que vaut \`entry\`. À corriger à la source.`);
  console.log(`✅ qa-retro PASSED — ${checked} lignes notées conformes à la politique de fill (tolérance ${CHASE_TOLERANCE_PCT}%, ${warnings.length} avertissement(s)).`);
}

main();
