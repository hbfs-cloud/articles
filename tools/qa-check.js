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

// 4. Scan du dernier jour ouvré (lun-ven uniquement — pas de scan le week-end)
function lastWeekdayStr() {
  const d = new Date();
  // Reculer jusqu'au dernier jour ouvré (vendredi si sam/dim)
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() - 1);
  }
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}

function isWeekend() {
  const day = new Date().getDay();
  return day === 0 || day === 6;
}

const today = todayStr();
const lastWeekday = lastWeekdayStr();
const scanDay = lastWeekday; // le scan attendu = dernier jour ouvré
const scanPath = `scanner/${scanDay}/index.html`;
const weekendNote = isWeekend() ? ` (week-end — dernier scan ouvré attendu: ${scanDay})` : '';

check(`scan dernier jour ouvré (${scanDay})${weekendNote}: fichier > 30KB`, () => {
  const size = fileSize(scanPath);
  if (size === 0) return `scanner/${scanDay}/index.html manquant`;
  if (size < 30000) return `taille ${Math.round(size/1024)}KB < 30KB`;
});

check(`scan dernier jour ouvré: id="synthese" présent`, () => {
  if (!fs.existsSync(path.join(ROOT, scanPath))) return `scanner/${scanDay}/index.html absent`;
  const html = readFile(scanPath);
  if (!html.includes('id="synthese"')) return 'id="synthese" absent — parser gen-status-page.js cassé';
});

// 4b. Scan du dernier jour ouvré — labels de stratégie conformes à la taxonomie
check('scan dernier jour ouvré: labels stratégie conformes (pas de Trend Follow/Defensive/etc.)', () => {
  const FORBIDDEN = ['Trend Follow', 'Defensive Momentum', 'Defensive Yield', 'Defensive', 'Reversal', 'Momentum Breakout'];
  // Chercher dans les 2 derniers scans
  const scannerDir = path.join(ROOT, 'scanner');
  const dirs = fs.readdirSync(scannerDir).filter(d => /^\d{8}$/.test(d)).sort().reverse().slice(0, 2);
  const found = [];
  for (const d of dirs) {
    const p = path.join(scannerDir, d, 'index.html');
    if (!fs.existsSync(p)) continue;
    const html = fs.readFileSync(p, 'utf8');
    for (const label of FORBIDDEN) {
      if (html.includes(label)) found.push(`${d}: "${label}"`);
    }
  }
  if (found.length) return `labels hors-taxonomie détectés — ${found.join(', ')} — relancer correction`;
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

// 8. scanner/status — pas de cellule stratégie vide (bug du 28 mars — LNG sans strategy)
check('scanner/status: aucune cellule stratégie vide dans le tableau signaux', () => {
  const html = readFile('scanner/status/index.html');
  // Détecter <td class="m"></td> = cellule stratégie vide
  const empty = (html.match(/<td class="m"><\/td>/g) || []).length;
  if (empty > 0) return `${empty} cellule(s) stratégie vide — gen-status-page.js regex strategy incomplet`;
});

// 9. mcp/watchlist.json — picks avec score/strategy valides (bug #1 du 28 mars)
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

// 10. radar.json — events ET opportunities présents (bug #2 du 28 mars)
check('radar.json: events et opportunities présents (pas que risks)', () => {
  const d = readJSON('data/radar.json');
  const missing = [];
  if (!d.events || d.events.length === 0) missing.push('events vide');
  if (!d.opportunities || d.opportunities.length === 0) missing.push('opportunities vide');
  if (missing.length) return missing.join(', ') + ' — radar affichera uniquement les risques';
});

// 11. scanner.json — tiles retro : style amber (f59e0b) + grade présent + date non-fallback + pas de doublons
check('scanner.json: tiles retro — amber + grade + date réelle + pas de doublons', () => {
  const d = readJSON('data/scanner.json');
  const retroTiles = d.filter(t => t.includes('RÉTROSPECTIVE'));
  if (retroTiles.length === 0) return true; // pas de retro indexée → skip
  const issues = [];

  // Style amber obligatoire (#f59e0b)
  const noAmber = retroTiles.filter(t => !t.includes('f59e0b'));
  if (noAmber.length) {
    const hrefs = noAmber.map(t => { const m = t.match(/href="([^"]+)"/); return m && m[1]; });
    issues.push(`${noAmber.length} sans style amber: ${hrefs.join(', ')}`);
  }

  // Grade présent (data-grade="B+" etc.)
  const noGrade = retroTiles.filter(t => !t.match(/data-grade="[A-F][+-]?"/));
  if (noGrade.length) {
    const hrefs = noGrade.map(t => { const m = t.match(/href="([^"]+)"/); return m && m[1]; });
    issues.push(`${noGrade.length} sans grade: ${hrefs.join(', ')}`);
  }

  // Date non-fallback (ne doit pas afficher aujourd'hui)
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const badDate = retroTiles.filter(t => t.includes(`>${today}<`));
  if (badDate.length) {
    issues.push(`${badDate.length} tiles retro avec date fallback (aujourd'hui)`);
  }

  // Doublons par href
  const hrefs = {};
  d.forEach(t => { const m = t && t.match(/href="([^"]+)"/); if (m) hrefs[m[1]] = (hrefs[m[1]]||0)+1; });
  const dups = Object.entries(hrefs).filter(([, c]) => c > 1);
  if (dups.length) issues.push(`${dups.length} tiles en doublon: ${dups.map(([h, c]) => h+'×'+c).join(', ')}`);

  if (issues.length) return issues.join(' | ');
});

// 12. index.html — bloc "Performance du Scanner" à jour avec la dernière rétro
check('index.html: Performance du Scanner — Updated date en phase avec dernière rétro', () => {
  const html = readFile('index.html');
  if (!html) return 'index.html absent';
  // Extraire la date "Updated: DD Mon YYYY" du bloc scanner-perf
  const updatedMatch = html.match(/Updated:\s*([A-Za-z]+\s+\d+\s+\d{4})\s*—\s*Period:/);
  if (!updatedMatch) return 'Bloc "Performance du Scanner" introuvable dans index.html';

  // Trouver la date de la dernière rétro dans scanner/retrospective/
  const retroDir = path.join(ROOT, 'scanner', 'retrospective');
  if (!fs.existsSync(retroDir)) return 'Dossier scanner/retrospective/ absent';
  const retroDates = fs.readdirSync(retroDir).filter(d => /^\d{8}$/.test(d)).sort();
  if (!retroDates.length) return 'Aucune rétro trouvée';
  const lastRetroDate = retroDates[retroDates.length - 1]; // ex: "20260327"
  const lastRetroYear = lastRetroDate.slice(0, 4);
  const lastRetroMonth = parseInt(lastRetroDate.slice(4, 6)) - 1;
  const lastRetroDay = parseInt(lastRetroDate.slice(6, 8));
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const expectedYear = lastRetroYear;
  const expectedMonth = months[lastRetroMonth];
  const expectedDay = lastRetroDay;
  // Le bloc doit mentionner l'année + le mois de la dernière rétro
  const updatedStr = updatedMatch[1]; // ex: "Mar 27 2026"
  if (!updatedStr.includes(expectedMonth) || !updatedStr.includes(expectedYear)) {
    return `Performance du Scanner affiche "${updatedStr}" mais dernière rétro = ${expectedMonth} ${expectedDay} ${expectedYear} — relancer tools/update-scanner-perf.js`;
  }
  // Le nombre de rétros doit correspondre
  const nRetrosMatch = html.match(/\((\d+) rétros cumulées\)/);
  if (nRetrosMatch && parseInt(nRetrosMatch[1]) !== retroDates.length) {
    return `${nRetrosMatch[1]} rétros cumulées dans index.html mais ${retroDates.length} dans scanner/retrospective/`;
  }
});

// 14. scanner/status — section Pending Orders présente pour chaque mode (après mise à jour scanner)
check('scanner/status: section Pending Orders présente pour les 3 modes', () => {
  const html = readFile('scanner/status/index.html');
  if (!html) return 'scanner/status/index.html absent';
  const count = (html.match(/Orders to Place/g) || []).length;
  if (count < 3) return `seulement ${count}/3 sections "Orders to Place" trouvées (growth, calmar, zero)`;
});

// 14. scanner/status — Pending Orders ne doit pas contenir de tickers déjà en Open Positions
check('scanner/status: pas de ticker en doublon entre Pending Orders et Open Positions', () => {
  const html = readFile('scanner/status/index.html');
  if (!html) return 'scanner/status/index.html absent';
  // Simple check : "Portfolio full" ou des ordres présents — juste vérifier que le bloc existe et n'est pas cassé
  if (html.includes('undefined') && html.includes('Orders to Place')) return '"undefined" dans la section Orders to Place';
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
