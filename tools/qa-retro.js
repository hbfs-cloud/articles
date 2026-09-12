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
const crypto = require('crypto');
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

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function underRoot(relativePath) {
  if (typeof relativePath !== 'string' || !relativePath) return null;
  const resolved = path.resolve(ROOT, relativePath);
  return resolved === ROOT || resolved.startsWith(ROOT + path.sep) ? resolved : null;
}

function renderedGroupRows(html, heading) {
  const headingAt = html.indexOf(`<h2>${heading}</h2>`);
  if (headingAt < 0) return null;
  const sectionEnd = html.indexOf('</section>', headingAt);
  const body = html.slice(headingAt, sectionEnd < 0 ? html.length : sectionEnd).match(/<tbody>([\s\S]*?)<\/tbody>/);
  if (!body) return null;
  const rows = [];
  for (const match of body[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const cells = [...match[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map(cell => cell[1].replace(/<[^>]+>/g, '').trim());
    if (cells.length !== 7 || !Number.isInteger(Number(cells[1])) || !Number.isInteger(Number(cells[2])) || !Number.isInteger(Number(cells[3]))) return null;
    rows.push({ name: cells[0], proposed: Number(cells[1]), resolved: Number(cells[2]), pending: Number(cells[3]) });
  }
  return rows;
}

function coverageReviewMain(dir, html) {
  const failures = [];
  const resultsPath = path.join(dir, 'retro-results.json');
  let results;
  try {
    results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  } catch (error) {
    console.error(`❌ qa-retro coverage_review: retro-results.json illisible (${error.message}).`);
    process.exit(1);
  }
  const summary = results.summary || {};
  const outcomes = Array.isArray(results.outcomes) ? results.outcomes : [];
  const expect = (condition, message) => { if (!condition) failures.push(message); };

  expect(results.publication?.type === 'coverage_review', 'retro-results.publication.type doit être coverage_review.');
  expect(results.publication?.cohort_performance_certified === false, 'retro-results doit déclarer cohort_performance_certified:false.');
  expect(results.cohort?.path && results.cohort?.sha256 && Number.isInteger(results.cohort?.certified_proposals), 'référence de cohorte ou empreinte absente de retro-results.json.');
  const cohortPath = underRoot(results.cohort?.path);
  let cohort;
  if (!cohortPath || !fs.existsSync(cohortPath)) {
    failures.push('manifeste de cohorte introuvable ou hors dépôt.');
  } else {
    try {
      cohort = JSON.parse(fs.readFileSync(cohortPath, 'utf8'));
      expect(sha256(cohortPath) === results.cohort.sha256, 'empreinte du manifeste de cohorte divergente.');
    } catch (error) {
      failures.push(`manifeste de cohorte illisible (${error.message}).`);
    }
  }
  const proposed = cohort?.certified_trade_cohort?.proposals;
  expect(Number.isInteger(proposed), 'compteur certified_trade_cohort.proposals absent du manifeste.');
  expect(summary.proposed === proposed, `summary.proposed=${summary.proposed} diffère de la cohorte=${proposed}.`);
  expect(results.cohort?.certified_proposals === proposed, `cohort.certified_proposals=${results.cohort?.certified_proposals} diffère de la cohorte=${proposed}.`);
  expect(outcomes.length === proposed, `outcomes=${outcomes.length} diffère de la cohorte=${proposed}.`);

  const excluded = new Set(['no_fill', 'data_error', 'open_unverified', 'ambiguous']);
  const filled = outcomes.filter(outcome => !excluded.has(outcome.status));
  const resolved = filled.filter(outcome => outcome.status !== 'pending');
  const fullyClosed = resolved.filter(outcome => outcome.status !== 'tp1_pending');
  const count = status => outcomes.filter(outcome => outcome.status === status).length;
  expect(summary.filled === filled.length, `summary.filled=${summary.filled}, calcul=${filled.length}.`);
  expect(summary.resolved === resolved.length, `summary.resolved=${summary.resolved}, calcul=${resolved.length}.`);
  expect(summary.fully_closed === fullyClosed.length, `summary.fully_closed=${summary.fully_closed}, calcul=${fullyClosed.length}.`);
  expect(summary.pending === filled.length - resolved.length, `summary.pending=${summary.pending}, calcul=${filled.length - resolved.length}.`);
  expect(summary.open_runners === resolved.length - fullyClosed.length, `summary.open_runners=${summary.open_runners}, calcul=${resolved.length - fullyClosed.length}.`);
  for (const key of ['no_fill', 'data_error', 'open_unverified', 'ambiguous', 'stopped']) {
    expect(summary[key] === count(key), `summary.${key}=${summary[key]}, calcul=${count(key)}.`);
  }
  const winners = resolved.filter(outcome => outcome.status === 'tp2' || outcome.status.startsWith('tp1'));
  expect(summary.tp1_or_better === winners.length, `summary.tp1_or_better=${summary.tp1_or_better}, calcul=${winners.length}.`);
  expect(summary.filled + summary.no_fill + summary.data_error + summary.open_unverified + summary.ambiguous === proposed, 'les catégories de cohorte ne totalisent pas le dénominateur certifié.');

  for (const [heading, groups] of [['Par scan', results.by_scan], ['Par stratégie', results.by_strategy]]) {
    const rendered = renderedGroupRows(html, heading);
    expect(Array.isArray(groups), `${heading}: agrégat absent de retro-results.json.`);
    expect(rendered !== null, `${heading}: table HTML absente ou structure invalide.`);
    if (Array.isArray(groups) && rendered) {
      expect(groups.reduce((sum, group) => sum + group.proposed, 0) === proposed, `${heading}: les propositions agrégées ne totalisent pas ${proposed}.`);
      expect(rendered.length === groups.length, `${heading}: nombre de lignes HTML divergent.`);
      groups.forEach((group, index) => {
        const line = rendered[index];
        if (!line || line.name !== group.name || line.proposed !== group.proposed || line.resolved !== group.resolved || line.pending !== group.pending) {
          failures.push(`${heading}: ligne HTML ${index + 1} divergente de retro-results.json.`);
        }
      });
    }
  }

  expect(html.includes('data-retro-publication="coverage_review"'), 'HTML: flag data-retro-publication=coverage_review absent.');
  expect(html.includes('Couverture de mesure incomplète'), 'HTML: alerte de couverture absente.');
  expect(html.includes(`${summary.resolved} résultats résolus sur ${summary.proposed} propositions`), 'HTML: compteur de couverture divergent ou absent.');
  expect(html.includes('Statistiques diagnostiques, sans verdict') && html.includes('ne permettent aucun verdict sur la cohorte scanner'), 'HTML: absence du cadrage documentaire sans verdict de cohorte.');

  const input = results.measurement_input;
  expect(input?.type === 'bars_15m' && typeof input.path === 'string' && typeof input.sha256 === 'string', 'measurement_input (bars_15m, path, sha256) absent de retro-results.json.');
  const inputPath = underRoot(input?.path);
  if (inputPath && fs.existsSync(inputPath)) expect(sha256(inputPath) === input.sha256, 'empreinte de measurement_input divergente.');
  else if (input?.path) console.warn('⚠️  qa-retro coverage_review: measurement_input local indisponible; empreinte non recalculée.');

  const entriesCache = {};
  for (const outcome of resolved) {
    const scanDate = String(outcome.scan_date || '').replaceAll('-', '');
    if (!/^\d{8}$/.test(scanDate)) {
      failures.push(`${outcome.ticker}: scan_date invalide pour la vérification de fill.`);
      continue;
    }
    if (entriesCache[scanDate] === undefined) entriesCache[scanDate] = loadPublishedEntries(scanDate);
    const record = entriesCache[scanDate]?.[outcome.ticker];
    const published = typeof record === 'object' ? record.high : record;
    if (!record || typeof published !== 'number' || (typeof record === 'object' && record.source === 'AMBIGU')) {
      failures.push(`${outcome.ticker} (${scanDate}): borne haute publiée indisponible ou ambiguë.`);
      continue;
    }
    const fill = decideFill(published, outcome.effective_entry);
    if (fill.status === 'no_fill') {
      failures.push(`${outcome.ticker} (${scanDate}): entrée ${outcome.effective_entry} hors tolérance de la borne haute ${published} (${fill.deviationPct}% > ${CHASE_TOLERANCE_PCT}%).`);
    } else if (fill.status === 'chase' && outcome.fill_policy !== 'chase') {
      failures.push(`${outcome.ticker} (${scanDate}): chase ${fill.deviationPct}% sans fill_policy=chase.`);
    } else if (fill.status === 'filled' && outcome.fill_policy === 'chase') {
      failures.push(`${outcome.ticker} (${scanDate}): fill_policy=chase alors que l’entrée est dans la zone.`);
    }
  }

  if (failures.length) {
    console.error(`\n❌ qa-retro COVERAGE_REVIEW FAILED — ${failures.length} contrôle(s) bloquant(s) :\n`);
    failures.forEach((failure, index) => console.error(`  ${index + 1}. ${failure}`));
    process.exit(1);
  }
  console.log(`✅ qa-retro COVERAGE_REVIEW PASSED — publication_review=PASS, cohort_performance_certified=false, ${resolved.length} fills conformes, cohorte ${proposed}.`);
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

  // Publication documentaire multi-scans : vérifier le résultat structuré et les
  // tableaux rendus, puis conserver la branche historique ci-dessous inchangée.
  if (html.includes('data-retro-publication="coverage_review"')) {
    coverageReviewMain(dir, html);
    return;
  }

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
