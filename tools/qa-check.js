#!/usr/bin/env node
/**
 * qa-check.js — QA post-publication pour le projet articles
 *
 * Vérifie tous les invariants critiques après chaque cron qui touche à articles :
 *   - scanner/status : signaux présents, taille, structure
 *   - radar.json : champs label/detail/importance sur tous les items
 *   - scanner.json : tile LIVE en position 0
 *   - index.html : structure générale
 *   - data/scanner-metrics.json + positions.json : fraîcheur des données
 *   - Scan du jour : taille > 30KB, id="synthese" présent
 *
 * Usage:
 *   node tools/qa-check.js              # Affiche les erreurs et exit 0 (avertissement)
 *   node tools/qa-check.js --strict     # Exit 1 si des erreurs critiques
 *   node tools/qa-check.js --discord    # Poster les résultats dans Discord (via openclaw)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STRICT = process.argv.includes('--strict');
const DISCORD = process.argv.includes('--discord');

const errors = [];
const warnings = [];
const ok = [];

function check(label, fn) {
  try {
    const result = fn();
    if (result === true || result === undefined) {
      ok.push(`✅ ${label}`);
    } else if (typeof result === 'string') {
      errors.push(`❌ ${label}: ${result}`);
    }
  } catch (e) {
    errors.push(`❌ ${label}: ${e.message}`);
  }
}

function warn(label, fn) {
  try {
    const result = fn();
    if (result === true || result === undefined) {
      ok.push(`✅ ${label}`);
    } else if (typeof result === 'string') {
      warnings.push(`⚠️  ${label}: ${result}`);
    }
  } catch (e) {
    warnings.push(`⚠️  ${label}: ${e.message}`);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function readJSON(relPath) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) throw new Error(`File not found: ${relPath}`);
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function readFile(relPath) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) throw new Error(`File not found: ${relPath}`);
  return fs.readFileSync(full, 'utf8');
}

function fileSize(relPath) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) return 0;
  return fs.statSync(full).size;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}

function isFresh(isoDate, maxAgeHours = 48) {
  if (!isoDate) return false;
  const age = (Date.now() - new Date(isoDate).getTime()) / 3600000;
  return age <= maxAgeHours;
}

// ─── Checks ─────────────────────────────────────────────────────────────────

// 1. scanner/status/index.html — signaux présents + taille
check('scanner/status: fichier existe et > 20KB', () => {
  const size = fileSize('scanner/status/index.html');
  if (size === 0) return 'fichier manquant';
  if (size < 20000) return `taille trop petite: ${Math.round(size/1024)}KB (min 20KB)`;
});

check('scanner/status: signaux présents (pill-score)', () => {
  const html = readFile('scanner/status/index.html');
  const matches = (html.match(/pill-score/g) || []).length;
  // 1 définition CSS + N occurrences de tickers
  if (matches < 2) return `aucun signal trouvé (pill-score × ${matches})`;
});

check('scanner/status: pas de "No signals for this mode today"', () => {
  const html = readFile('scanner/status/index.html');
  if (html.includes('No signals for this mode today')) return 'message "no signals" présent — parser KO';
});

// 2. radar.json — tous les items ont label, detail, importance
check('radar.json: tous les items ont label+detail+importance', () => {
  const d = readJSON('data/radar.json');
  const all = [...(d.risks||[]), ...(d.opportunities||[]), ...(d.events||[])];
  if (all.length === 0) return 'aucun item (risks+opportunities+events vides)';
  const noLabel = all.filter(i => !i.label);
  const noDetail = all.filter(i => i.detail === undefined || i.detail === null);
  const noImportance = all.filter(i => typeof i.importance !== 'number');
  const issues = [];
  if (noLabel.length) issues.push(`${noLabel.length} sans label`);
  if (noDetail.length) issues.push(`${noDetail.length} sans detail`);
  if (noImportance.length) issues.push(`${noImportance.length} sans importance`);
  if (issues.length) return issues.join(', ');
});

check('radar.json: detail n\'est pas une valeur impact ("high"/"medium")', () => {
  const d = readJSON('data/radar.json');
  const all = [...(d.risks||[]), ...(d.opportunities||[]), ...(d.events||[])];
  const bad = all.filter(i => ['high','medium','low','critical'].includes(i.detail));
  if (bad.length) return `${bad.length} items ont detail="${bad[0].detail}" (valeur impact copiée)`;
});

warn('radar.json: fraîcheur < 48h', () => {
  const d = readJSON('data/radar.json');
  if (!isFresh(d.updated, 48)) return `dernière MAJ: ${d.updated} (> 48h)`;
});

// 3. scanner.json — tile LIVE en position 0
check('scanner.json: tile LIVE en position 0', () => {
  const d = readJSON('data/scanner.json');
  if (!d[0]) return 'scanner.json vide';
  if (!d[0].includes('scanner/status') && !d[0].includes('Scanner Live')) {
    return `position 0 = "${d[0].substring(0,60).replace(/\n/g,' ')}..." (pas le tile LIVE)`;
  }
  if (!d[0].includes('LIVE')) return 'tile en position 0 mais badge LIVE absent';
  if (!d[0].includes('#059669') && !d[0].includes('059669')) return 'tile LIVE sans couleur verte (#059669)';
});

// 4. Scan du jour
const today = todayStr();
const scanPath = `scanner/${today}/index.html`;
warn(`scan du jour (${today}): fichier généré > 30KB`, () => {
  const size = fileSize(scanPath);
  if (size === 0) return `scanner/${today}/index.html manquant`;
  if (size < 30000) return `taille ${Math.round(size/1024)}KB < 30KB`;
});

check(`scan du jour: id="synthese" présent`, () => {
  if (!fs.existsSync(path.join(ROOT, scanPath))) return true; // skip si pas de scan du jour (week-end)
  const html = readFile(scanPath);
  if (!html.includes('id="synthese"')) return 'id="synthese" absent — parser gen-status-page.js cassé';
});

// 5. data/scanner-metrics.json + positions.json — fraîcheur
warn('scanner-metrics.json: fraîcheur < 48h', () => {
  const d = readJSON('data/scanner-metrics.json');
  if (!isFresh(d.updated_at, 48)) return `updated_at: ${d.updated_at}`;
});

warn('scanner-positions.json: fraîcheur < 48h', () => {
  const d = readJSON('data/scanner-positions.json');
  if (!isFresh(d.updated_at, 48)) return `updated_at: ${d.updated_at}`;
});

// 6. index.html — structure basique
check('index.html: tab-scanner existe', () => {
  const html = readFile('index.html');
  if (!html.includes('id="tab-scanner"')) return 'id="tab-scanner" absent';
});

check('index.html: tab-radar existe', () => {
  const html = readFile('index.html');
  if (!html.includes('id="tab-radar"')) return 'id="tab-radar" absent';
});

// 7. scanner/status/index.html — pas de "undefined" brut
check('scanner/status: pas de "undefined" brut dans le HTML', () => {
  const html = readFile('scanner/status/index.html');
  // Chercher "undefined" en dehors des JS (dans le contenu visible)
  // Heuristique : >undefined< ou ">undefined" ou "undefined<"
  const badMatches = html.match(/>undefined[<\s]|[>\s]undefined</g) || [];
  if (badMatches.length > 0) return `"undefined" présent dans le contenu HTML (${badMatches.length}×)`;
});

// 8. mcp/watchlist.json — picks avec score/strategy valides (bug #1 du 28 mars)
check('watchlist.json: picks non vides et champs valides (score, strategy, entry)', () => {
  const d = readJSON('mcp/watchlist.json');
  if (!d.picks || d.picks.length === 0) return 'aucun pick dans watchlist.json';
  const nullScore = d.picks.filter(p => p.score === null || p.score === undefined);
  const noStrat  = d.picks.filter(p => !p.strategy);
  const noEntry  = d.picks.filter(p => !p.entry && p.entry !== 0);
  const issues = [];
  if (nullScore.length) issues.push(`${nullScore.length} picks avec score null`);
  if (noStrat.length)  issues.push(`${noStrat.length} picks sans strategy`);
  if (noEntry.length)  issues.push(`${noEntry.length} picks sans entry`);
  if (issues.length) return issues.join(', ');
});

// 9. radar.json — events ET opportunities présents (bug #2 du 28 mars)
check('radar.json: events et opportunities présents (pas que risks)', () => {
  const d = readJSON('data/radar.json');
  const missing = [];
  if (!d.events || d.events.length === 0) missing.push('events vide');
  if (!d.opportunities || d.opportunities.length === 0) missing.push('opportunities vide');
  if (missing.length) return missing.join(', ') + ' — radar affichera uniquement les risques';
});

// 10. scanner.json — tiles retro ont le style purple (bug #3 du 28 mars)
// Filtre : uniquement les tiles avec le badge "RÉTROSPECTIVE" (les vraies retros)
// Les tiles normales avec le tag "retrospective" dans data-tags ne sont pas des vraies retros
check('scanner.json: tiles retrospective ont le style visuel retro', () => {
  const d = readJSON('data/scanner.json');
  const retroTiles = d.filter(t => t.includes('RÉTROSPECTIVE'));
  if (retroTiles.length === 0) return true; // pas de tile retro → skip
  const noStyle = retroTiles.filter(t => !t.includes('8b5cf6') && !t.includes('badge-purple'));
  if (noStyle.length) return `${noStyle.length}/${retroTiles.length} tiles retro sans style violet (8b5cf6)`;
});

// ─── Résumé ──────────────────────────────────────────────────────────────────

const total = ok.length + warnings.length + errors.length;
const hasErrors = errors.length > 0;

console.log('');
console.log('╔══════════════════════════════════════════════════╗');
console.log('║        QA Check — articles.market-watch.xyz      ║');
console.log('╚══════════════════════════════════════════════════╝');
console.log(`  Date: ${new Date().toISOString()}`);
console.log(`  Checks: ${total} | ✅ ${ok.length} | ⚠️  ${warnings.length} | ❌ ${errors.length}`);
console.log('');

if (ok.length > 0 && (errors.length > 0 || warnings.length > 0)) {
  // Only show OK list if there are also issues (for context)
  ok.forEach(l => console.log('  ' + l));
  console.log('');
}

if (warnings.length > 0) {
  warnings.forEach(l => console.log('  ' + l));
  console.log('');
}

if (errors.length > 0) {
  errors.forEach(l => console.log('  ' + l));
  console.log('');
}

if (!hasErrors && warnings.length === 0) {
  console.log('  🎉 Tout est OK — aucune anomalie détectée');
  console.log('');
}

// Discord report si demandé
if (DISCORD) {
  let msg;
  if (!hasErrors && warnings.length === 0) {
    msg = `✅ **QA articles** — ${ok.length}/${total} checks OK`;
  } else {
    const lines = [
      `**QA articles — ${new Date().toLocaleDateString('fr-FR')}**`,
      `${ok.length} OK | ${warnings.length} warnings | ${errors.length} erreurs`,
      '',
    ];
    if (errors.length > 0) {
      lines.push('**Erreurs critiques:**');
      errors.forEach(e => lines.push('• ' + e.replace('❌ ', '')));
      lines.push('');
    }
    if (warnings.length > 0) {
      lines.push('**Avertissements:**');
      warnings.forEach(w => lines.push('• ' + w.replace('⚠️  ', '')));
    }
    msg = lines.join('\n');
  }

  // Write to a temp file for the caller to pick up
  const outPath = '/tmp/qa-discord-report.txt';
  fs.writeFileSync(outPath, msg);
  console.log(`  📤 Discord report écrit dans ${outPath}`);
}

// Exit code
if (STRICT && hasErrors) {
  console.log('  ⛔ Mode strict — exit 1 (erreurs critiques détectées)');
  process.exit(1);
}

process.exit(0);
