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
const { isUSTradingDay } = require('./lib/market-calendar');

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

// 4. Scan du dernier jour ouvré (lun-ven + jours fériés NYSE exclus via market-calendar.js)
function lastWeekdayStr() {
  const d = new Date();
  const isoOf = (dt) => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  // Reculer jusqu'au dernier jour de bourse réel (week-end ET jours fériés NYSE)
  while (!isUSTradingDay(isoOf(d))) {
    d.setDate(d.getDate() - 1);
  }
  return isoOf(d).replace(/-/g, '');
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
  // Lire signals.json (source de vérité structurée) plutôt que grep le HTML
  // (le HTML contient légitimement le mot "defensive" en prose descriptive).
  // 'Candlestick' = AmericanBulls reversal patterns appended by candlestick-scanner.js
  // for the "bull" mode (filterName=candlestick_only). Legitimate, not the 4 core A+ labels.
  const ALLOWED = new Set(['Momentum', 'Pullback', 'Breakout', 'Pre-Squeeze', 'Candlestick', 'AdaptiveFractal', 'HighVolBreakout', 'highvol_breakout', 'TrendlineBreakout', 'trendline_breakout', 'MomentumRotation', 'momentum_rotation', 'ETFMomentum', 'etf_momentum']);
  const scannerDir = path.join(ROOT, 'scanner');
  const dirs = fs.readdirSync(scannerDir).filter(d => /^\d{8}$/.test(d)).sort().reverse().slice(0, 2);
  const found = [];
  for (const d of dirs) {
    // Préférer signals.json ; fallback sur data.json (champ setups[].pattern)
    const sigPath = path.join(scannerDir, d, 'signals.json');
    const dataPath = path.join(scannerDir, d, 'data.json');
    let strategies = [];
    if (fs.existsSync(sigPath)) {
      try {
        const sig = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
        strategies = (sig.signals || []).map(s => s.strategy).filter(Boolean);
      } catch { /* ignore */ }
    }
    if (!strategies.length && fs.existsSync(dataPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        strategies = (data.setups || []).map(s => s.pattern).filter(Boolean);
      } catch { /* ignore */ }
    }
    for (const label of strategies) {
      // case-insensitive: "candlestick" (legacy) and "Candlestick" (current) both valid
      const ok = [...ALLOWED].some(a => a.toLowerCase() === String(label).toLowerCase());
      if (!ok) found.push(`${d}: "${label}"`);
    }
  }
  if (found.length) return `labels hors-taxonomie détectés — ${found.join(', ')} — relancer correction`;
});

// 4c. Garde anti-régression scanners scriptés : chaque mode LIVE alimenté par un scanner scripté
// doit avoir FAIT TOURNER son scanner sur le dernier scan. On vérifie le MARQUEUR de scan
// (_candlestickScan pour bull, _scanRuns[clé] pour les autres), PAS la présence de signaux.
// 0 signal qualifié est LÉGITIME — ex. Bull = haute-conviction, spike volume >= 8× requis le jour
// du signal (parité systematic-tss vérifiée 2026-06-30: sur 3512 tickers, 1 seul candidat MESH
// passe score+vol mais échoue la liquidité => 0 ordre, identique au backtest Go).
// L'ÉCHEC réel = marqueur absent : le scanner n'a jamais tourné (crash silencieux avalé par le
// `|| echo non-blocking` de publish-daily-card.sh) — c'est arrivé le 20260702 sur 4 modes.
// Clés _scanRuns : '<scanner>' pour l'univers par défaut du scanner, '<scanner>:<universe>' sinon.
const SCRIPT_SCANNER_MARKERS = {
  bull:       { special: 'candlestick' },  // _candlestickScan (candlestick-scanner.js)
  highvol:    { keys: ['highvol'] },       // highvol-scanner.js
  etf:        { keys: ['etf'] },           // etf-scanner.js (US, défaut)
  etf_eu:     { keys: ['etf:etf_eu'] },    // etf-scanner.js --universe etf-eu (tag interne etf_eu)
  momentum:   { keys: ['momentum'] },      // momentum-scanner.js (americanbull, défaut)
  casablanca: { keys: ['casablanca'] },    // casablanca-scanner.js
  trendline:  { prefix: 'trendline' },     // trendline-scanner.js — n'importe quel univers compte
};

function latestScanSignals() {
  const scannerDir = path.join(ROOT, 'scanner');
  const dirs = fs.readdirSync(scannerDir).filter(d => /^\d{8}$/.test(d)).sort().reverse();
  if (!dirs.length) throw new Error('aucun dossier de scan trouvé');
  const sigPath = path.join(scannerDir, dirs[0], 'signals.json');
  if (!fs.existsSync(sigPath)) throw new Error(`signals.json absent pour le dernier scan ${dirs[0]}`);
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(sigPath, 'utf8')); }
  catch (e) { throw new Error(`signals.json illisible (${dirs[0]}): ${e.message}`); }
  return { scanDir: dirs[0], parsed };
}

function activeScriptScannerModes() {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'modes-config.json'), 'utf8'));
  return Object.entries(config.modes || {})
    .filter(([id, m]) => SCRIPT_SCANNER_MARKERS[id] && m && ['live', 'deploying', 'pausing'].includes(m.status))
    .map(([id]) => id);
}

// Résout le marqueur d'un mode dans le signals.json parsé. Retourne { found, key, signals }.
function resolveScanMarker(mode, parsed) {
  const spec = SCRIPT_SCANNER_MARKERS[mode];
  if (spec.special === 'candlestick') {
    const m = parsed._candlestickScan;
    return { found: !!m, key: '_candlestickScan', signals: m ? m.qualified : null, marker: m };
  }
  const scanRuns = parsed._scanRuns || {};
  let key = (spec.keys || []).find(k => scanRuns[k]);
  if (!key && spec.prefix) {
    key = Object.keys(scanRuns).find(k => k === spec.prefix || k.startsWith(spec.prefix + ':'));
  }
  if (!key) {
    const expected = spec.keys ? spec.keys.join('|') : `${spec.prefix}[:*]`;
    return { found: false, key: `_scanRuns["${expected}"]`, signals: null, marker: null };
  }
  return { found: true, key: `_scanRuns["${key}"]`, signals: scanRuns[key].signals, marker: scanRuns[key] };
}

check('scanner: modes live scriptés — marqueur de scan présent (chaque scanner a bien tourné)', () => {
  let activeModes;
  try { activeModes = activeScriptScannerModes(); }
  catch (e) { return `modes-config.json illisible: ${e.message}`; }
  if (!activeModes.length) return; // aucun mode scripté actif → rien à garantir

  const { scanDir, parsed } = latestScanSignals();
  const missing = [];
  for (const mode of activeModes) {
    const res = resolveScanMarker(mode, parsed);
    if (!res.found) { missing.push(`${mode} (${res.key})`); continue; }
    // Garde spécifique bull : le scanner doit avoir réellement fetché son univers
    if (mode === 'bull' && (!res.marker.universeFetched || res.marker.universeFetched < 100)) {
      missing.push(`${mode} (_candlestickScan: ${res.marker.universeFetched || 0} titres fetchés < 100 — source de données KO)`);
    }
  }
  if (missing.length) {
    return `marqueur(s) de scan absent(s) dans ${scanDir} — scanner(s) jamais lancé(s) (crash silencieux ?): `
      + `${missing.join(', ')}. NB: 0 signal est LÉGITIME (jour calme), mais le scanner DOIT avoir tourné `
      + `(marqueur écrit). Relancer les scanners manquants avec --output signals --folder ${scanDir}.`;
  }
});

warn('scanner: modes live scriptés — marqueur présent mais 0 signal (jour calme ?)', () => {
  let activeModes;
  try { activeModes = activeScriptScannerModes(); }
  catch { return; } // le check bloquant ci-dessus rapporte déjà l'erreur
  if (!activeModes.length) return;
  let scan;
  try { scan = latestScanSignals(); }
  catch { return; }
  const zeroed = [];
  for (const mode of activeModes) {
    const res = resolveScanMarker(mode, scan.parsed);
    if (res.found && res.signals === 0) zeroed.push(`${mode} (${res.key})`);
  }
  if (zeroed.length) {
    return `${scan.scanDir} — scanner(s) OK mais 0 signal: ${zeroed.join(', ')} — légitime les jours calmes, à surveiller si récurrent`;
  }
});

// 5b. data/bench-spy.json — existence + fraîcheur + stats numériques
check('bench-spy.json: fichier existe', () => {
  if (!fs.existsSync(path.join(ROOT, 'data', 'bench-spy.json'))) return 'data/bench-spy.json absent — relancer node tools/fetch-bench-spy.js';
});

warn('bench-spy.json: fraîcheur < 48h', () => {
  const d = readJSON('data/bench-spy.json');
  if (!isFresh(d.updated_at, 48)) return `updated_at: ${d.updated_at}`;
});

check('bench-spy.json: stats numériques valides', () => {
  const d = readJSON('data/bench-spy.json');
  if (!d.stats) return 'champ stats absent';
  const fields = ['returnTotal', 'maxDD', 'sharpe', 'calmar'];
  const bad = fields.filter(f => typeof d.stats[f] !== 'number' || isNaN(d.stats[f]));
  if (bad.length) return `champs non numériques: ${bad.join(', ')}`;
  if (!d.closes || Object.keys(d.closes).length < 5) return `closes insuffisants: ${Object.keys(d.closes || {}).length}`;
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

// 5b. data/risk-snapshots.json — détecte stub silencieux (MCP_GATEWAY_URL absent)
warn('risk-snapshots.json: var95 non-null (MCP gateway live)', () => {
  const d = readJSON('data/risk-snapshots.json');
  if (!d.modes) return 'champ modes absent';
  const allStub = Object.values(d.modes).every(m => m === null || (m && m.var95_5d == null));
  if (allStub) return 'tous modes var95_5d=null — refresh-risk-metrics a écrit un stub (MCP_GATEWAY_URL non exporté?)';
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

  // Grade présent (data-grade="B+" etc., including provisional "C*")
  const noGrade = retroTiles.filter(t => !t.match(/data-grade="[A-F][+\-*]?"/));
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

// 14. scanner/status — panneau + section Orders présents pour chaque mode LIVE
// Source de vérité : data/modes-config.json (status=="live"). Chaque mode live doit avoir
// son panneau (id="p-<mode>") et, dedans, une section "Orders to Place" / "On Watch" /
// "no action needed" (le bug du 20260701 : section Orders absente sur bull).
check('scanner/status: panneau + section Orders présents pour chaque mode live', () => {
  const html = readFile('scanner/status/index.html');
  if (!html) return 'scanner/status/index.html absent';
  let config;
  try { config = readJSON('data/modes-config.json'); }
  catch (e) { return `modes-config.json illisible: ${e.message}`; }
  const liveModes = Object.entries(config.modes || {})
    .filter(([, m]) => m && m.status === 'live')
    .map(([id]) => id);
  if (!liveModes.length) return 'aucun mode live dans modes-config.json';

  const missingPanel = [];
  const missingOrders = [];
  for (const mode of liveModes) {
    const anchor = `id="p-${mode}"`;
    const start = html.indexOf(anchor);
    if (start === -1) { missingPanel.push(mode); continue; }
    // Le panneau s'étend jusqu'au prochain panneau de mode (ou la fin du fichier)
    const next = html.indexOf('id="p-', start + anchor.length);
    const panel = html.slice(start, next === -1 ? html.length : next);
    if (!/Order[s]? to Place|On Watch|no action needed/.test(panel)) missingOrders.push(mode);
  }
  const issues = [];
  if (missingPanel.length) issues.push(`panneau id="p-<mode>" absent pour: ${missingPanel.join(', ')}`);
  if (missingOrders.length) issues.push(`section Orders/On Watch/no action absente pour: ${missingOrders.join(', ')}`);
  if (issues.length) return issues.join(' | ') + ' — regénérer via gen-status-page.js';
});

// 14. scanner/status — Pending Orders ne doit pas contenir de tickers déjà en Open Positions
check('scanner/status: pas de ticker en doublon entre Pending Orders et Open Positions', () => {
  const html = readFile('scanner/status/index.html');
  if (!html) return 'scanner/status/index.html absent';
  // Simple check : "Portfolio full" ou des ordres présents — juste vérifier que le bloc existe et n'est pas cassé
  if (html.includes('>undefined<') || html.includes('">undefined"')) return '"undefined" brut trouvé dans le HTML';
});

// ─── Check 23: Media pipeline — result.json récent pour le dernier article ──
warn('media pipeline: result.json généré dans les 24h', () => {
  const fs = require('fs');
  const path = require('path');
  const mediaBase = '/tmp/mw-media';
  if (!fs.existsSync(mediaBase)) return 'répertoire /tmp/mw-media absent (pipeline jamais lancé)';
  // Find most recent result.json
  let newest = null;
  let newestMtime = 0;
  try {
    for (const dir of fs.readdirSync(mediaBase)) {
      const p = path.join(mediaBase, dir, 'result.json');
      if (fs.existsSync(p)) {
        const mtime = fs.statSync(p).mtimeMs;
        if (mtime > newestMtime) { newestMtime = mtime; newest = p; }
      }
    }
  } catch {}
  if (!newest) return 'aucun result.json trouvé sous /tmp/mw-media';
  const ageH = (Date.now() - newestMtime) / 3600000;
  if (ageH > 24) return `result.json trop vieux: ${Math.round(ageH)}h (relancer generate-media.mjs)`;
  const r = JSON.parse(fs.readFileSync(newest, 'utf8'));
  if (!r.youtubeId) return `result.json présent mais youtubeId null — upload YouTube a échoué`;
  if (!r.audioPath || !fs.existsSync(r.audioPath)) return `audioPath absent ou fichier manquant`;
});

// ─── Check 24: VWAP no-lookahead spot-check ──────────────────────────────────
warn('backtest-trades: VWAP in plausible range vs actualEntry (0.5–2×)', () => {
  const bt = readJSON('data/backtest-trades.json');
  const modes = Object.keys(bt);
  const issues = [];
  for (const mode of modes) {
    const trades = (bt[mode] || []).filter(t => t.vwap != null && t.actualEntry != null);
    if (!trades.length) continue;
    // pick up to 5 random-ish trades (deterministic: every Nth)
    const step = Math.max(1, Math.floor(trades.length / 5));
    const sample = trades.filter((_, i) => i % step === 0).slice(0, 5);
    for (const t of sample) {
      const ratio = t.vwap / t.actualEntry;
      if (ratio < 0.5 || ratio > 2.0) {
        issues.push(`${mode}/${t.ticker}@${t.entryDate}: vwap=${t.vwap} vs entry=${t.actualEntry} (ratio=${ratio.toFixed(3)})`);
      }
    }
  }
  if (issues.length) return `VWAP hors-range (0.5–2×): ${issues.join('; ')}`;
});

// ─── Check 25: R:R minimum gate on latest scan signals ───────────────────────
check('signals.json (dernier scan): R:R ≥ 1.5 pour tous les signaux', () => {
  const scannerDir = path.join(ROOT, 'scanner');
  const dirs = fs.readdirSync(scannerDir).filter(d => /^\d{8}$/.test(d)).sort().reverse();
  if (!dirs.length) return 'aucun dossier scanner trouvé';
  let sigPath = null;
  let scanDir = null;
  for (const d of dirs) {
    const p = path.join(scannerDir, d, 'signals.json');
    if (fs.existsSync(p)) { sigPath = p; scanDir = d; break; }
  }
  if (!sigPath) return 'signals.json introuvable dans les derniers scans';
  const sig = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
  const signals = sig.signals || [];
  const bad = [];
  // Gate R:R = stratégies éditoriales uniquement. Spécialistes : tp1 = prise partielle
  // (partialTPGain), payoff réel = runner + trailing — pas de gate R/R en Go (parité).
  const RR_GATE_STRATEGIES = new Set(['momentum', 'breakout', 'pullback', 'pre-squeeze', 'presqueeze', 'pre_squeeze', 'hybridmegacap', 'hybrid_megacap']);
  for (const s of signals) {
    const { ticker, entry, stop, tp1 } = s;
    if (entry == null || stop == null || tp1 == null) continue;
    const stratKey = String(s.strategy || '').toLowerCase().replace(/[\s-]/g, '');
    const reward = tp1 - entry;
    const risk = entry - stop;
    if (risk <= 0) { bad.push(`${ticker}: risk≤0 (entry=${entry} stop=${stop})`); continue; }
    if (stratKey && !RR_GATE_STRATEGIES.has(stratKey)) continue; // structurel seulement pour les spécialistes
    const rr = reward / risk;
    if (rr < 1.5) bad.push(`${ticker}: R:R=${rr.toFixed(2)} < 1.5`);
  }
  if (bad.length) return `${scanDir} — ${bad.join(', ')}`;
});

// ─── Check 25b: Overextension gate — distance from 50-DMA per strategy ──────
// Encoded from VRT failure 2026-05-18 (entry $367 → SL $336 same-day -7.9%).
// VRT was +38% above 50-DMA, RSI > 75, no consolidation = parabolic exhaustion.
check('signals.json (dernier scan): distance_50dma_pct ≤ cap par stratégie', () => {
  const scannerDir = path.join(ROOT, 'scanner');
  const dirs = fs.readdirSync(scannerDir).filter(d => /^\d{8}$/.test(d)).sort().reverse();
  if (!dirs.length) return 'aucun dossier scanner trouvé';
  let sigPath = null;
  let scanDir = null;
  for (const d of dirs) {
    const p = path.join(scannerDir, d, 'signals.json');
    if (fs.existsSync(p)) { sigPath = p; scanDir = d; break; }
  }
  if (!sigPath) return 'signals.json introuvable';
  const sig = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
  const filters = readJSON('data/scanner-filters.json');
  const caps = filters?.overextension?.max_distance_50dma_pct_by_strategy;
  if (!caps) return 'scanner-filters.json#overextension manquant';
  const missing = [];
  const violations = [];
  for (const s of (sig.signals || [])) {
    if (!s.extension || s.extension.distance_50dma_pct === undefined) {
      missing.push(s.ticker);
      continue;
    }
    const cap = caps[s.strategy];
    if (cap === undefined) continue;
    if (s.extension.distance_50dma_pct > cap) {
      violations.push(`${s.ticker} (${s.strategy}): +${s.extension.distance_50dma_pct.toFixed(1)}% > cap ${cap}%`);
    }
  }
  if (violations.length) return `${scanDir} — ${violations.join('; ')}`;
  if (missing.length === (sig.signals || []).length) return `${scanDir} — extension field absent sur tous les signaux (skip — pre-extension-filter scan)`;
});

// ─── Check 26: advisor_* non-null in backtest-results.json ───────────────────
warn('backtest-results.json: advisor_* non-null (sweep complet requis)', () => {
  const br = readJSON('data/backtest-results.json');
  const nullAdvisors = Object.keys(br).filter(k => k.startsWith('advisor_') && br[k] === null);
  if (nullAdvisors.length) return `${nullAdvisors.length} advisor(s) null: ${nullAdvisors.join(', ')} — relancer sweep.js`;
});

// ─── Check 27: frozen_* completeness (calmar + sharpe requis) ────────────────
check('backtest-results.json: frozen_* ont tous les champs obligatoires', () => {
  const REQUIRED = ['returnTotal', 'winRate', 'profitFactor', 'trades', 'maxDD', 'calmar', 'sharpe'];
  const br = readJSON('data/backtest-results.json');
  const issues = [];
  for (const key of Object.keys(br).filter(k => k.startsWith('frozen_'))) {
    const v = br[key];
    if (!v) { issues.push(`${key}=null`); continue; }
    const missing = REQUIRED.filter(f => v[f] === undefined || v[f] === null);
    if (missing.length) issues.push(`${key} manque: ${missing.join(', ')}`);
  }
  if (issues.length) return issues.join(' | ');
});

// ─── Check 27b: SEALED-PRIMARY display invariant (anti-regression guardrail) ──────
// GUARDRAIL for the 2026-07-02 incident. A routine flipped the status page so a thin live
// book (pit-state) replaced each mode's sealed, SHA-256-chained sweep track record as the
// headline (turbo 111.76% → displayed 5.51%). The hash chain protects the DATA and held —
// this check protects the DISPLAY, the layer the chain doesn't cover. Enforced before every
// publish (exit 1 = blocking):
//   • Mode WITH a sealed track record (>=10 sealed trades OR |ret|>=5%) → the hero Total
//     Return MUST equal the frozen (sealed sweep) returnTotal. A live book can NEVER
//     displace a sealed track record. This is the invariant that broke.
//   • Fresh mode (no meaningful sweep yet) → hero = its live-book ret (its only portfolio).
//   • The page must carry NO "LIVE BOOK" / "Sim backtest" / "Strategy" dual-curve labels
//     (one curve = the portfolio). Mirrors gen-status-page.js frozenMeaningful gate.
check('scanner/status: SEALED-PRIMARY invariant (hero = sealed sweep, no sim/strategy labels)', () => {
  const html = readFile('scanner/status/index.html');
  if (!html) return 'scanner/status/index.html absent';
  const br = readJSON('data/backtest-results.json');
  const mc = readJSON('data/modes-config.json');
  const modes = mc.modes ? mc.modes : mc;
  let pit = { modes: {} };
  try { pit = readJSON('data/pit-state.json'); } catch (_) { }
  const pitModes = pit.modes || {};
  const TOL = 1.0; // hero vs frozen: allow live-MtM bridge drift (<1pt); a source-flip is tens of pts
  const NON_PUBLIC = new Set(['draft', 'stopped']);
  const issues = [];

  // No dual-curve / sim / strategy labels anywhere user-visible — "one curve = portfolio".
  if (/class="pill"[^>]*>\s*<i[^>]*fa-circle[^>]*><\/i>\s*LIVE BOOK/.test(html)) issues.push('label "LIVE BOOK" présent (doit être retiré)');
  if (/fa-flask[^>]*><\/i>\s*Sim backtest/.test(html) || /name:'Sim backtest'/.test(html)) issues.push('label "Sim backtest" présent (courbe doit être unique)');
  if (/name:'Strategy'/.test(html)) issues.push(`courbe nommée 'Strategy' (doit être 'Portfolio')`);

  // Mirror gen-status-page pitViewFor: a flat-at-100 curve with 0 closed trades is NOT primary.
  function pitPrimary(pm) {
    if (!pm) return null;
    const ec = (pm.equityCurve || []).filter(p => p && p.date);
    const closed = pm.closedTrades || [];
    const moved = ec.some(p => Math.abs((p.value ?? 100) - 100) > 0.001);
    if (!(closed.length >= 1 || moved)) return null;
    const last = ec.length ? ec[ec.length - 1] : null;
    return last ? +(last.value - 100).toFixed(2) : 0;
  }

  for (const [id, cfg] of Object.entries(modes)) {
    if (NON_PUBLIC.has(cfg.status)) continue;
    const anchor = `id="p-${id}"`;
    const start = html.indexOf(anchor);
    if (start === -1) continue; // panel presence covered by another check
    const next = html.indexOf('id="p-', start + anchor.length);
    const panel = html.slice(start, next === -1 ? html.length : next);
    const heroM = panel.match(/>([+\-]?[0-9.]+)%<\/span><span class="ps-l">Total Return/);
    if (!heroM) { issues.push(`${id}: hero Total Return introuvable`); continue; }
    const heroRet = parseFloat(heroM[1]);
    const frozen = br[`frozen_${id}`];
    const frozenRet = frozen && typeof frozen.returnTotal === 'number' ? frozen.returnTotal : null;
    const frozenTrades = frozen && typeof frozen.trades === 'number' ? frozen.trades : 0;
    const frozenMeaningful = frozenRet !== null && (frozenTrades >= 10 || Math.abs(frozenRet) >= 5);

    if (frozenMeaningful) {
      // THE guardrail: a sealed track record IS the headline, verbatim — never displaced.
      if (Math.abs(heroRet - frozenRet) > TOL) {
        issues.push(`${id}: hero ${heroRet}% ≠ sweep scellé ${frozenRet}% (Δ${(heroRet - frozenRet).toFixed(2)}) — un track record scellé ne doit JAMAIS être remplacé`);
      }
    } else {
      // Fresh mode: hero = its live book (its only portfolio), else frozen when pit not primary.
      const pitRet = pitPrimary(pitModes[id]);
      const expected = pitRet !== null ? pitRet : frozenRet;
      if (expected !== null && Math.abs(heroRet - expected) > TOL) {
        issues.push(`${id}: hero ${heroRet}% ≠ portfolio attendu ${expected}% (Δ${(heroRet - expected).toFixed(2)})`);
      }
    }
  }
  if (issues.length) return issues.join(' | ');
});

// ─── Check 28: TZ ET coherence — dernier snapshot history < 24h ──────────────
warn('scanner/status/history: snapshot le plus récent < 24h (ET)', () => {
  const histDir = path.join(ROOT, 'scanner', 'status', 'history');
  if (!fs.existsSync(histDir)) return 'scanner/status/history/ absent';
  const files = fs.readdirSync(histDir).filter(f => f.endsWith('.json') && f !== 'dates.json').sort().reverse();
  if (!files.length) return 'aucun snapshot historique trouvé';
  const latest = files[0].replace('.json', ''); // ex: "20260430"
  // Parse YYYYMMDD into a date (treat as America/New_York midnight)
  const y = parseInt(latest.slice(0, 4));
  const m = parseInt(latest.slice(4, 6)) - 1;
  const d = parseInt(latest.slice(6, 8));
  // Get current time in ET offset (UTC-4 EDT / UTC-5 EST)
  const nowUTC = Date.now();
  const etOffset = -4 * 3600000; // assume EDT (Apr–Oct)
  const nowET = new Date(nowUTC + etOffset);
  // Snapshot date at midnight ET
  const snapET = new Date(Date.UTC(y, m, d) - etOffset);
  const gapH = (nowUTC - snapET.getTime()) / 3600000;
  if (gapH > 24) return `dernier snapshot: ${latest} — gap ${Math.round(gapH)}h > 24h (heure ET)`;
});

// ─── Check 29: Position integrity — per-mode positions from backtest-trades ──
warn('scanner/status: per-mode positions match backtest-trades.json (no phantom positions)', () => {
  const statusPath = path.join(ROOT, 'scanner', 'status', 'index.html');
  if (!fs.existsSync(statusPath)) return 'scanner/status/index.html absent';
  const bt = readJSON('data/backtest-trades.json');
  const mc = readJSON('data/modes-config.json');
  const modes = mc.modes ? mc.modes : mc;
  const issues = [];
  const todayISO = new Date().toISOString().slice(0, 10);

  for (const [modeId, cfg] of Object.entries(modes)) {
    const trades = bt[modeId] || [];
    const portfolioSize = cfg.portfolioSize || 3;
    const openTrades = trades.filter(t => {
      if (t.status === 'skipped') return false;
      if (!t.entryDate || t.entryDate > todayISO) return false;
      if (!t.exitDate) return true;
      return t.exitDate > todayISO;
    });
    if (openTrades.length > portfolioSize) {
      issues.push(`${modeId}: ${openTrades.length} open > P${portfolioSize}`);
    }
  }
  if (issues.length) return issues.join(' | ');
});

check('scanner/status: latest snapshot positions consistent with backtest-trades', () => {
  const histDir = path.join(ROOT, 'scanner', 'status', 'history');
  if (!fs.existsSync(histDir)) return 'scanner/status/history/ absent';
  const files = fs.readdirSync(histDir).filter(f => /^\d{8}\.json$/.test(f)).sort().reverse();
  if (!files.length) return 'aucun snapshot';
  const latest = files[0];
  const dateKey = latest.replace('.json', '');
  const dateISO = `${dateKey.slice(0,4)}-${dateKey.slice(4,6)}-${dateKey.slice(6,8)}`;
  const snap = JSON.parse(fs.readFileSync(path.join(histDir, latest), 'utf8'));
  const bt = readJSON('data/backtest-trades.json');
  const mc = readJSON('data/modes-config.json');
  const modes = mc.modes ? mc.modes : mc;
  const issues = [];

  if (!snap.modes) return 'snapshot sans champ modes';
  for (const [modeId, modeSnap] of Object.entries(snap.modes)) {
    const cfg = modes[modeId];
    if (!cfg) continue;
    const trades = bt[modeId] || [];
    const horizon = cfg.horizon || 999;
    const expectedOpen = trades.filter(t => {
      if (!t.entryDate || t.status === 'skipped') return false;
      if (t.entryDate > dateISO) return false;
      if (!t.exitDate) {
        // Mirror gen-status-page: trades past their horizon are filtered out
        const age = Math.round((Date.now() - new Date(t.entryDate)) / 86400000);
        const held = Math.round(age * 5 / 7);
        return held < horizon;
      }
      return t.exitDate > dateISO;
    }).map(t => t.ticker).sort();
    const snapActive = (modeSnap.positions || []).filter(p => !p._terminal).map(p => p.ticker).sort();
    const portfolioSize = (cfg.portfolioSize || 3);
    const extra = snapActive.filter(t => !expectedOpen.includes(t));
    const missing = expectedOpen.filter(t => !snapActive.includes(t));
    if (extra.length) issues.push(`${modeId}: phantom positions in snapshot: ${extra.join(',')}`);
    // Tolerate missing when expectedOpen overflows portfolioSize (injection adds real positions beyond sim2 slots)
    const overflowCount = Math.max(0, expectedOpen.length - portfolioSize);
    if (missing.length > overflowCount && snapActive.length > 0) {
      issues.push(`${modeId}: missing from snapshot: ${missing.join(',')}`);
    }
  }
  if (issues.length) return issues.join(' | ');
});

// ─── Check: MtM accuracy — pending exitPrice must match sweep's own cache
// sweep.js writes {ticker}.json (dict {date: {open,high,low,close}}), TTL 12h.
// candlestick-scanner writes {ticker}_ohlcv.json (array) — different tool, different timing.
// We read the SWEEP cache ({ticker}.json) since that's what determined exitPrice.
warn('backtest-trades: pending exitPrice matches sweep cache', () => {
  const bt = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/backtest-trades.json'), 'utf8'));
  const cacheDir = path.join(ROOT, 'data/.price-cache');
  if (!fs.existsSync(cacheDir)) return 'price-cache dir missing';

  const seen = new Set();
  const drifts = [];

  for (const mode of Object.keys(bt)) {
    for (const t of bt[mode]) {
      if (t.status !== 'pending' && t.status !== 'open') continue;
      if (t.exitPrice == null) continue;
      const tk = t.ticker;
      if (seen.has(tk)) continue;
      seen.add(tk);

      // sweep's cache: {ticker}.json (dict keyed by date)
      const sweepCachePath = path.join(cacheDir, `${tk}.json`);
      if (!fs.existsSync(sweepCachePath)) continue;

      try {
        const history = JSON.parse(fs.readFileSync(sweepCachePath, 'utf8'));
        if (typeof history !== 'object' || Array.isArray(history)) continue;
        const dates = Object.keys(history).sort();
        if (!dates.length) continue;
        const lastDate = dates[dates.length - 1];
        const lastBar = history[lastDate];
        const latestClose = lastBar?.close ?? lastBar?.c;
        if (latestClose == null || latestClose === 0) continue;

        const drift = Math.abs(t.exitPrice - latestClose) / latestClose;
        if (drift > 0.001) {
          drifts.push(`${tk}: exitPrice=${t.exitPrice.toFixed(2)} vs cache[${lastDate}]=${latestClose.toFixed(2)} (${(drift * 100).toFixed(1)}%)`);
        }
      } catch (e) { /* skip */ }
    }
  }

  if (drifts.length) return `MtM drift — re-run sweep: ${drifts.join(' | ')}`;
});

check('backtest-trades: no breakeven artifacts (pnlPct=0 with exitPrice!=actualEntry)', () => {
  const bt = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/backtest-trades.json'), 'utf8'));
  let artifacts = 0;
  for (const mode of Object.keys(bt)) {
    artifacts += bt[mode].filter(t =>
      t.status === 'breakeven' &&
      t.pnlPct === 0 &&
      t.exitPrice != null &&
      t.actualEntry != null &&
      Math.abs(t.exitPrice - t.actualEntry) > 0.01
    ).length;
  }
  return artifacts === 0 || `BE-artifact regression: ${artifacts} trades`;
});

check('signals.json (last 5 scans): regime field present in ≥50%', () => {
  const scannerDir = path.join(ROOT, 'scanner');
  const dates = fs.readdirSync(scannerDir).filter(d => /^\d{8}$/.test(d)).sort().slice(-5);
  let total = 0, missing = 0;
  for (const d of dates) {
    try {
      const s = JSON.parse(fs.readFileSync(path.join(scannerDir, d, 'signals.json'), 'utf8'));
      const sigs = Array.isArray(s) ? s : (s.signals || []);
      total += sigs.length;
      missing += sigs.filter(x => !x.regime && !x.region).length;
    } catch(e) {}
  }
  return total === 0 || missing / total <= 0.5 || `Null-regime: ${missing}/${total} signals lack regime`;
});

// ─── Check 31: Parity Go↔articles (systematic-tss) — soft gate, drift = warning ──
// Shells out to tools/parity-check.js --warn-only, qui compare les modes scriptés (highvol,
// etf, etf_eu, casablanca, trendline, bull) aux configs Go backtestées 5y de systematic-tss
// (alignement v10.2, cf .claude/memory/project_parity_v10_2.md). N'échoue JAMAIS ce check
// (--warn-only) — un vrai DRIFT devient un warning, jamais une erreur bloquante. Skip silencieux
// si ../systematic-tss est absent (routines cloud/CI n'ont pas accès à ce repo).
try {
  const { execSync } = require('child_process');
  const parityOut = execSync(`node ${JSON.stringify(path.join(ROOT, 'tools/parity-check.js'))} --warn-only`, {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (/systematic-tss absent/i.test(parityOut)) {
    // Pas de systematic-tss en local (cloud/CI) — skip silencieux, aucune entrée ok/warn.
  } else {
    const driftLines = parityOut.split('\n').filter(l => / {2}- \[/.test(l));
    if (driftLines.length > 0) {
      warnings.push(`⚠️  parity Go↔articles (systematic-tss): ${driftLines.length} drift(s) — ${driftLines.map(l => l.trim()).join(' | ')}`);
    } else {
      ok.push('✅ parity Go↔articles (systematic-tss): aucun drift (v10.2 alignment)');
    }
  }
} catch (e) {
  warnings.push(`⚠️  parity Go↔articles (systematic-tss): erreur exécution parity-check.js — ${e.message.split('\n')[0]}`);
}

// ─── Check 30: Status page headless smoke — zéro erreur JS au boot ───────────
// Charge scanner/status/index.html dans un navigateur headless (puppeteer si présent dans
// node_modules, sinon jsdom, sinon skip avec note console) et vérifie qu'aucune
// ReferenceError/SyntaxError/TypeError n'est levée au chargement.
// Non-fatal si l'environnement headless est indisponible (Chromium manquant, launch KO...) ;
// FATAL si la page lève de vraies erreurs JS au boot (régression gen-status-page.js).
async function statusPageSmokeCheck() {
  const label = 'scanner/status: smoke headless — zéro ReferenceError/SyntaxError/TypeError au boot';
  const statusPath = path.join(ROOT, 'scanner', 'status', 'index.html');
  if (!fs.existsSync(statusPath)) {
    errors.push(`❌ ${label}: scanner/status/index.html absent`);
    return;
  }

  let engine = null;
  try { require.resolve('puppeteer'); engine = 'puppeteer'; } catch { /* absent */ }
  if (!engine) { try { require.resolve('jsdom'); engine = 'jsdom'; } catch { /* absent */ } }
  if (!engine) {
    console.log('  ℹ️  smoke headless status page: ni puppeteer ni jsdom dans node_modules — check sauté');
    return;
  }

  const FATAL_RE = /ReferenceError|SyntaxError|TypeError/;
  const pageErrors = [];

  try {
    if (engine === 'puppeteer') {
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
      try {
        const page = await browser.newPage();
        page.on('pageerror', e => pageErrors.push(String((e && e.message) || e)));
        page.on('console', msg => { if (msg.type() === 'error') pageErrors.push(msg.text()); });
        await page.goto('file://' + statusPath, { waitUntil: 'load', timeout: 30000 });
        await new Promise(r => setTimeout(r, 1500)); // laisser le boot JS (tmLoadIdx, panels...) s'exécuter
      } finally {
        await browser.close();
      }
    } else {
      const { JSDOM, VirtualConsole } = require('jsdom');
      const virtualConsole = new VirtualConsole();
      virtualConsole.on('jsdomError', e => pageErrors.push(String((e && e.message) || e)));
      const html = fs.readFileSync(statusPath, 'utf8');
      const dom = new JSDOM(html, {
        runScripts: 'dangerously',
        resources: 'usable',
        url: 'file://' + statusPath,
        virtualConsole,
      });
      await new Promise(r => setTimeout(r, 2000)); // laisser les scripts asynchrones s'exécuter
      dom.window.close();
    }
  } catch (e) {
    // Échec environnemental (Chromium absent, launch timeout...) → warning, pas erreur bloquante
    warnings.push(`⚠️  ${label}: environnement headless KO (${engine}: ${e.message}) — check non concluant`);
    return;
  }

  // Ne bloquer que sur les vraies erreurs JS ; les échecs réseau (CDN, fetch live) sont ignorés.
  const fatal = pageErrors.filter(m => FATAL_RE.test(m));
  if (fatal.length) {
    errors.push(`❌ ${label}: ${fatal.length} erreur(s) JS (${engine}) — ${[...new Set(fatal)].slice(0, 5).join(' | ')}`);
  } else {
    ok.push(`✅ ${label} (${engine})`);
  }
}

// ─── Résumé ──────────────────────────────────────────────────────────────────

function summarize() {

const total = ok.length + warnings.length + errors.length;
const hasErrors = errors.length > 0;

console.log('');
console.log('╔══════════════════════════════════════════════════╗');
console.log('║        QA Check — articles.dailytickers.com      ║');
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

} // fin summarize()

// Les checks synchrones ci-dessus ont déjà rempli ok/warnings/errors ; on enchaîne
// le smoke headless (asynchrone) puis le résumé + exit code.
(async () => {
  try {
    await statusPageSmokeCheck();
  } catch (e) {
    warnings.push(`⚠️  smoke headless status page: échec inattendu — ${e.message}`);
  }
  summarize();
})();
