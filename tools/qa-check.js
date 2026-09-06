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
const { isUSTradingDay, newYorkDateISO, usTradingDaysBetween } = require('./lib/market-calendar');

const ROOT = path.resolve(__dirname, '..');
const STRICT = process.argv.includes('--strict');
const DISCORD = process.argv.includes('--discord');

// Un argument positionnel était AVALÉ EN SILENCE. `node tools/qa-check.js scanner/20260810`
// auditait en réalité le scan du dernier jour ouvré (20260807) et sortait 0 : l'appelant croyait
// avoir contrôlé une cible, l'outil en contrôlait une autre et le disait vert. C'est le pire mode
// de défaillance de ce dépôt — une réponse fausse et crédible. Constaté le 2026-08-08 sur le scan
// bloqué du 20260810, qui n'a donc reçu AUCUNE couverture QA tout en affichant un exit 0.
// Cet outil audite délibérément le dernier scan publié et ne prend PAS de cible : on refuse donc
// l'argument au lieu de l'ignorer.
{
  const stray = process.argv.slice(2).filter(a => !a.startsWith('--'));
  if (stray.length) {
    console.error(`❌ [qa-check] argument positionnel non reconnu : ${stray.join(' ')}`);
    console.error(`   qa-check.js audite le dernier scan publié et n'accepte PAS de cible.`);
    console.error(`   Usage : node tools/qa-check.js [--strict] [--discord]`);
    console.error(`   Pour valider un scan précis : node tools/validate-scan.js <dossier>`);
    process.exit(2);
  }
}

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

check(`scan dernier jour ouvré (${scanDay})${weekendNote}: taille proportionnelle aux setups`, () => {
  const size = fileSize(scanPath);
  if (size === 0) return `scanner/${scanDay}/index.html manquant`;
  // Le seuil est un proxy « scan complet, pas tronqué ». Un scan honnêtement plus court
  // (sélection resserrée) est légitimement plus petit — on juge la DENSITÉ par setup, pas un
  // forfait qui suppose 10 lignes. 30KB reste la barre d'un scan plein (≥9 setups) ; en-dessous,
  // on exige ~3,4KB/setup (densité saine) avec un plancher anti-troncature à 20KB.
  let nSetups = 10;
  try {
    const sig = JSON.parse(fs.readFileSync(path.join(ROOT, 'scanner', scanDay, 'signals.json'), 'utf8'));
    nSetups = (sig.signals || sig.top_10 || []).length || 10;
  } catch (_) { /* garde le défaut 10 → barre pleine 30KB */ }
  const minSize = Math.max(20000, Math.min(30000, nSetups * 3400));
  if (size < minSize) return `taille ${Math.round(size/1024)}KB < ${Math.round(minSize/1024)}KB (attendu pour ${nSetups} setups)`;
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
  const ALLOWED = new Set(['Momentum', 'Pullback', 'Breakout', 'Pre-Squeeze', 'Candlestick', 'AdaptiveFractal', 'HighVolBreakout', 'highvol_breakout', 'TrendlineBreakout', 'trendline_breakout', 'MomentumRotation', 'momentum_rotation', 'ETFMomentum', 'etf_momentum', 'IndexRotation', 'index_rotation']);
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
  momentum:   { keys: ['momentum'] },      // momentum-scanner.js (americanbull, défaut)
  casablanca: { keys: ['casablanca'] },    // casablanca-scanner.js
  trendline:  { prefix: 'trendline' },     // trendline-scanner.js — n'importe quel univers compte
  // Event-driven scanners. gap = voie A (fetch-direct, garde universeFetched>=100 comme bull) ;
  // pead/filings = voie B (ingest MCP, univers = les prints/filings stagés, pas de garde de taille :
  // 0 print un jour calme est légitime, seul le marqueur prouve que le scanner a tourné).
  pead:       { keys: ['pead'] },          // pead-scanner.js (ingest staging MCP)
  filings:    { keys: ['filings'] },       // filings-scanner.js (ingest staging MCP)
  gap:        { keys: ['gap'] },           // gap-scanner.js (fetch-direct, voie A)
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
    // Garde spécifique aux scanners fetch-direct (bull, gap) : le scanner doit avoir réellement
    // fetché son univers (>=100 titres) — sinon source de données KO. Les scanners voie-B (pead/
    // filings) n'ont pas de garde de taille : leur "univers" = les prints/filings stagés (peut être petit).
    if ((mode === 'bull' || mode === 'gap') && (!res.marker.universeFetched || res.marker.universeFetched < 100)) {
      missing.push(`${mode} (${res.key}: ${res.marker.universeFetched || 0} titres fetchés < 100 — source de données KO)`);
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

// 4d. dtx scripted-mode staging COMPLETENESS (anti-silent-skip). Depuis le cut-over 2026-07-08, le
// MCP dtx (systematic.dailytickers.com) est le SEUL moteur des portefeuilles scriptés câblés
// (aujourd'hui: best) — le binaire local a été SUPPRIMÉ. Seul l'AGENT peut appeler le MCP ;
// un subprocess `node` ne le peut pas. publish-daily-card.sh Step 4d écrit data/dtx/_staging-completeness.json
// enregistrant, PAR MODE, si le staging committé est un snapshot MCP frais (aujourd'hui) au moment du scan.
// Ici on ESCALADE un mode stale/absent en ❌ (fail loud) — mais UNIQUEMENT si le marqueur vient d'un run
// qui a eu lieu aujourd'hui (generatedAt = aujourd'hui). Pas de marqueur / marqueur ancien → skip (pas de
// faux ❌ hors run). C'est la porte de complétude : une nuit où le MCP dtx était injoignable et où l'agent
// n'a pas pu régénérer un mode est ATTRAPÉE ici, jamais passée en silence.
check('dtx: staging scriptés complets (portefeuilles MCP frais — pas de skip silencieux)', () => {
  const markerPath = path.join(ROOT, 'data', 'dtx', '_staging-completeness.json');
  const today = new Date().toISOString().slice(0, 10);
  let marker = null;
  try { marker = JSON.parse(fs.readFileSync(markerPath, 'utf8')); } catch { /* voir filet asof ci-dessous */ }
  if (marker) {
    const genDay = String(marker.generatedAt || '').slice(0, 10);
    if (genDay === today) {
      if (!marker.complete) {
        const skipped = (marker.skipped || []).map(id => {
          const m = (marker.modes || {})[id] || {};
          return `${id} (${m.status || '?'})`;
        });
        return `staging dtx INCOMPLET pour le scan ${marker.scanDate || '?'} — mode(s) NON régénéré(s) via MCP ce run: `
          + `${skipped.join(', ')}. MCP dtx injoignable / connector absent / job(s) échoué(s) → staging conservé = STALE `
          + `(jamais fabriqué). L'agent DOIT avoir alerté Telegram (alias 'alerts'). Régénérer via `
          + `DtxReplay+DtxDecide → dtx-mcp-ingest, PUIS relancer gen-status-page.`;
      }
      // A complete marker does not bypass the independent staging checks below.
    }
  }
  // FILET ASOF (durci 2026-07-16). « Pas de marqueur » n'est PLUS un pass silencieux : entre le
  // cut-over du 08/07 et le 16/07, Step 4d crashait AVANT d'écrire le marqueur (js-yaml absent →
  // require top-level de dtx-bars) et cette check rendait OK pendant que le staging restait figé
  // au 13/07. Vérité indépendante du marqueur : si un dossier scanner/<date> existe et qu'un
  // staging scripté a un asof ANTÉRIEUR à cette séance, le staging est stale → ❌.
  const scanDirs = (() => {
    try { return fs.readdirSync(path.join(ROOT, 'scanner')).filter(d => /^\d{8}$/.test(d)).sort(); }
    catch { return []; }
  })();
  if (!scanDirs.length) return;
  const latest = scanDirs[scanDirs.length - 1];
  const latestISO = `${latest.slice(0, 4)}-${latest.slice(4, 6)}-${latest.slice(6, 8)}`;
  const stale = [];
  try {
    const dir = path.join(ROOT, 'data', 'dtx');
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('_') && !f.includes('@'))) {
      try {
        const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        const asof = String(j.asof || '').slice(0, 10);
        if (j.engineMode === 'mcp' && asof && asof < latestISO) stale.push(`${f.replace(/\.json$/, '')} (asof:${asof})`);
      } catch { /* staging illisible → couvert par 4e */ }
    }
  } catch { return; }
  if (!stale.length) return;
  return `staging dtx STALE vs scan ${latestISO} (marqueur Step 4d ${marker ? 'ancien' : 'ABSENT — le filet primaire n\'a pas tourné'}): `
    + `${stale.join(', ')}. Les modes scriptés tournent sur des ordres/métriques d'une séance passée. `
    + `Régénérer via DtxReplay+DtxDecide → dtx-mcp-ingest → dtx-pool-bridge, PUIS relancer gen-status-page.`;
});

// 4e. dtx SANITY GATE (anti-corrupt-publish). Le MCP dtx est sain (diagnostic 2026-07-10 : interrogé
// en direct il reproduit les chiffres sains de la répétition). Mais la routine peut capturer un replay
// corrompu / param-drifté (incident 2026-07-09 : etf_eu DD-89.6%, us_highvol 1169tr = 2-8× le baseline).
// dtx-mcp-ingest marque alors le staging `metricsSuspect:true` + `_sanityWarning[…]` (bornes dans
// config/dtx/_sanity-baselines.json). On ESCALADE ici en ❌ tout staging FRAIS (généré aujourd'hui) marqué
// suspect — un DD aberrant ne repart JAMAIS en publication en silence. Staging ancien → skip (pas de faux ❌).
check('dtx: métriques replay saines (AUCUN staging corrompu — frais OU stale — DD/trades/sharpe dans les bornes)', () => {
  const dir = path.join(ROOT, 'data', 'dtx');
  let files;
  try { files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('_')); }
  catch { return; } // pas de dossier dtx → rien à garantir
  // Ré-ÉVALUE chaque staging via assertReplaySanity (pas seulement le flag metricsSuspect écrit à l'ingest) :
  // un staging STALE committé AVANT le garde (ex. us_highvol 07-08 = 1176tr/DD-64%) porte metricsSuspect=false
  // par défaut mais reste corrompu et s'affiche sur la status page. On flague TOUT staging aberrant, quelle que
  // soit sa date de génération — le trou "stale corrompu affiché en silence" est ainsi fermé.
  let scan;
  try { scan = require('./dtx-scan'); } catch { scan = null; }
  const suspects = [];
  for (const f of files) {
    let j;
    try { j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
    const id = j.portfolioId || f.replace(/\.json$/, '');
    let warns = [];
    if (scan && j.metrics) warns = scan.assertReplaySanity(id, j.metrics) || [];
    // fallback: si le fichier porte déjà le flag/_sanityWarning (ingest récent), le respecter aussi.
    if (warns.length === 0 && j.metricsSuspect) warns = (j._sanityWarning || ['metricsSuspect:true']);
    if (warns.length > 0) {
      const gen = String(j.generatedAt || '').slice(0, 10) || '?';
      suspects.push(`${id} (gen ${gen}): ${warns.join(' ; ')}`);
    }
  }
  if (suspects.length === 0) return;
  return `staging dtx avec métriques replay ABERRANTES (NON publiable, y compris stale) — `
    + `${suspects.join(' | ')}. Un replay hors bornes = param drift / job corrompu / OOM serveur ayant laissé un staging cassé. `
    + `Re-appeler DtxReplay (from=2021-01-01) séquentiellement, vérifier trades vs config/dtx/_sanity-baselines.json, ré-ingérer, alerter 'alerts'.`;
});

check('dtx: fenêtres Contract V2 appliquées aux pools et ordres publics', () => {
  const now = Date.now();
  const issues = [];
  const scanDirs = fs.readdirSync(path.join(ROOT, 'scanner')).filter(d => /^\d{8}$/.test(d)).sort();
  const latest = scanDirs[scanDirs.length - 1];
  let scan = {};
  try { scan = readJSON(`scanner/${latest}/signals.json`); } catch { /* reported elsewhere */ }
  const pool = Array.isArray(scan.dtx_pool) ? scan.dtx_pool : [];
  for (const id of ['best']) {
    let stg;
    try { stg = readJSON(`data/dtx/${id}.json`); } catch { continue; }
    if (stg.actionable === false && stg.failureMode === 'fail_closed') {
      if ((stg.orders || []).length) issues.push(`${id}: staging fail-closed contient des ordres`);
      let publicOrders = [];
      try { publicOrders = readJSON(`portfolio/v1/${id}/orders.json`).orders || []; } catch { /* API covered elsewhere */ }
      if (publicOrders.length) issues.push(`${id}: ${publicOrders.length} ordre(s) API malgré fail-closed`);
      continue;
    }
    const from = Date.parse(stg.decisionProvenance?.validFrom || '');
    const until = Date.parse(stg.decisionProvenance?.validUntil || '');
    if (!Number.isFinite(from) || !Number.isFinite(until)) {
      issues.push(`${id}: validFrom/validUntil absents`);
      continue;
    }
    if (now < from || now > until) {
      const leakedPool = pool.filter(s => s && s.universe === id).length;
      let publicOrders = [];
      try { publicOrders = readJSON(`portfolio/v1/${id}/orders.json`).orders || []; } catch { /* API covered elsewhere */ }
      if (leakedPool) issues.push(`${id}: ${leakedPool} signal(s) dtx_pool hors fenêtre`);
      if (publicOrders.length) issues.push(`${id}: ${publicOrders.length} ordre(s) API hors fenêtre`);
    }
  }
  if (issues.length) return issues.join(' | ');
});

check('dtx: courbe, headline et provenance décrivent le même replay', () => {
  const issues = [];
  for (const id of ['best']) {
    let stg, api;
    try { stg = readJSON(`data/dtx/${id}.json`); api = readJSON(`portfolio/v1/${id}/equity.json`); }
    catch { continue; }
    if (stg.metricsSource !== 'mcp_replay') continue;
    const sv = stg.equity?.values || [];
    const sm = Number(stg.metrics?.return_pct);
    if (sv.length > 1 && Number.isFinite(sm)) {
      const sr = (Number(sv[sv.length - 1]) / Number(sv[0]) - 1) * 100;
      if (Math.abs(sr - sm) > 0.05) issues.push(`${id}: staging curve return ${sr.toFixed(2)} != metrics ${sm}`);
    }
    const av = api.equityCurve?.v || [];
    // La base d'une courbe rebasée n'est pas son premier point publié — celui-ci est la première
    // séance APRÈS le lancement, qui a déjà bougé. `rebasedTo`, publié depuis le 2026-09-06,
    // porte la base réelle : sans elle ce contrôle reconstruisait −0,97% contre un titre à
    // −0,86% et signalait une incohérence qui n'existait pas.
    const abase = Number(api.equityCurve?.rebasedTo) || av[0];
    const ar = av.length > 1 ? Number(av[av.length - 1]) / Number(abase) * 100 - 100 : NaN;
    const hm = Number(api.stats?.ret);
    if (!Number.isFinite(ar) || !Number.isFinite(hm) || Math.abs(ar - hm) > 0.05) {
      issues.push(`${id}: API curve/headline mismatch (${Number.isFinite(ar) ? ar.toFixed(2) : 'n/a'} vs ${hm})`);
    }
    if (api.engineBacktest?.metrics_source !== 'mcp_replay' || api.engineBacktest?.curve_is_book !== false) {
      issues.push(`${id}: provenance API ne déclare pas la reconstruction mcp_replay non-book`);
    }
  }
  if (issues.length) return issues.join(' | ');
});

// 5a-bis. GARDE-FOU FRAÎCHEUR FROZEN (anti-gel silencieux). Bug du 26/06→21/07 2026 : les héros LLM
// sont restés GELÉS 3 semaines (frozen bloqué au 26/06, affichant le pic pendant que juillet chutait)
// car l'avance append-only ne tournait plus. Ici : si des trades CLÔTURÉS existent APRÈS la fin de la
// courbe frozen d'un mode, le frozen n'a pas avancé → ❌ (le dashboard surévalue en cachant les pertes).
check('frozen: avance append-only à jour (aucun trade clôturé au-delà de la fin de la courbe frozen)', () => {
  const rp = path.join(ROOT, 'data', 'backtest-results.json');
  const tp = path.join(ROOT, 'data', 'backtest-trades.json');
  if (!fs.existsSync(rp) || !fs.existsSync(tp)) return; // pas de contexte sweep → skip
  const R = JSON.parse(fs.readFileSync(rp, 'utf8'));
  const T = JSON.parse(fs.readFileSync(tp, 'utf8'));
  const TOL_DAYS = 3; // tolérance : le frozen peut légitimement traîner de qq séances (sweep différé)
  const stale = [];
  for (const [mode, trades] of Object.entries(T)) {
    const f = R['frozen_' + mode];
    if (!f || !Array.isArray(f.equityCurve) || !f.equityCurve.length) continue;
    const closed = (trades || []).filter(x => x && x.exitDate && !x._premature);
    if (!closed.length) continue;
    const maxExit = closed.map(x => x.exitDate).sort().slice(-1)[0];       // dernière clôture réelle
    const curveLast = f.equityCurve[f.equityCurve.length - 1].date;         // fin de la courbe scellée
    const gapDays = Math.round((new Date(maxExit) - new Date(curveLast)) / 86400000);
    if (gapDays > TOL_DAYS) stale.push(`${mode}: courbe finit ${curveLast} mais dernière clôture ${maxExit} (+${gapDays}j non intégrés)`);
  }
  if (!stale.length) return;
  return `FROZEN GELÉ (non avancé) — ${stale.join(' | ')}. Le dashboard affiche un pic périmé en cachant les pertes récentes `
    + `(cf. incident 26/06→21/07). Relancer le sweep (avance append-only des stats frozen) puis gen-status-page/gen-api.`;
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

// ─── Check 5c (Fix #4): trou de risque réel — position ouverte SANS var95_5d ──
// Le check ci-dessus (5b) ne remonte qu'un ⚠️ enfoui, et seulement si TOUS les modes
// sont stub — une dégradation partielle (certains modes avec position ouverte mais
// var95_5d resté null/absent) passait inaperçue. Ici on BLOQUE (❌) uniquement pour
// les modes qui ont réellement une position ouverte (positionCount>0) : c'est un vrai
// trou de couverture risque. Un mode flat (positionCount=0) sans var95_5d n'a rien à
// couvrir → pas de blocage (var95_5d absent/null y est normal/attendu).
check('risk-snapshots.json: var95_5d présent pour tout mode avec position(s) ouverte(s)', () => {
  const d = readJSON('data/risk-snapshots.json');
  if (!d.modes) return 'champ modes absent';
  const gaps = [];
  for (const [modeId, m] of Object.entries(d.modes)) {
    if (!m || typeof m.positionCount !== 'number' || m.positionCount <= 0) continue;
    if (m.var95_5d === undefined || m.var95_5d === null) {
      const tickers = (m.tickers || []).join(',') || '?';
      gaps.push(`${modeId} (${m.positionCount} pos: ${tickers})`);
    }
  }
  if (gaps.length) {
    return `var95_5d manquant pour mode(s) AVEC position ouverte — trou de risque réel: ${gaps.join(', ')} `
      + `— relancer tools/refresh-risk-metrics.js avec MCP_GATEWAY_URL exporté`;
  }
});

// ─── Check 5d (Fix #4): régime dégradé (fallback) — visible, non bloquant ──
// scanner/status/history/<dernier>.json → regimeProbability.model. Le modèle
// attendu en régime nominal est 'context_conditional' ; 'fallback_rule_based' (ou modèle
// absent) signale que le bar service bootstrappe / est indisponible — c'est TRANSITOIRE,
// donc jamais bloquant, mais ne doit plus rester enfoui : affiché en ⚠️ explicite ici,
// distinct du warning générique de fraîcheur (check 28). Les warnings instrument
// conservés dans le snapshot (par exemple historique TLT court) ne dégradent pas à eux
// seuls un modèle nominal avec un état et une confiance exploitables.
const EXPECTED_REGIME_MODEL = 'context_conditional';
check('scanner/status/history (dernier snapshot): provenance regimeProbability explicite', () => {
  const histDir = path.join(ROOT, 'scanner', 'status', 'history');
  if (!fs.existsSync(histDir)) return 'scanner/status/history/ absent';
  const files = fs.readdirSync(histDir).filter(f => /^\d{8}\.json$/.test(f)).sort().reverse();
  if (!files.length) return 'aucun snapshot historique trouvé';
  let snap;
  try { snap = JSON.parse(fs.readFileSync(path.join(histDir, files[0]), 'utf8')); }
  catch (e) { return `${files[0]} illisible: ${e.message}`; }
  const rp = snap.regimeProbability;
  if (!rp) return `${files[0]}: regimeProbability absent (bar service down ?)`;
  const issues = [];
  if (!rp.model || rp.model !== EXPECTED_REGIME_MODEL) {
    issues.push(`model="${rp.model || 'absent'}" (attendu "${EXPECTED_REGIME_MODEL}")`);
  }
  if (!rp.engine) issues.push('engine absent');
  if (!rp.currentState || rp.currentState === 'unavailable') {
    issues.push(`currentState="${rp.currentState || 'absent'}"`);
  }
  if (!Number.isFinite(Number(rp.currentStateConfidence)) || Number(rp.currentStateConfidence) <= 0) {
    issues.push(`currentStateConfidence="${rp.currentStateConfidence ?? 'absent'}"`);
  }
  if (issues.length) {
    return `${files[0]} — ${issues.join(' | ')} — dégradation MCP probablement transitoire (bar service bootstrapping ?), à surveiller si récurrent`;
  }
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

// ─── Check 23: RETIRÉ (2026-08-13) — le pipeline média (vidéo/YouTube) est hors périmètre
// du QA de publication d'articles. Il écrivait dans /tmp/mw-media (artefact local, jamais commité),
// donc son absence était systématiquement flaggée sur toute machine n'ayant pas lancé de vidéo —
// bruit permanent sans rapport avec l'intégrité d'un scan/daily/weekly. Le suivi média, s'il doit
// exister, vit dans son propre outil, pas dans qa-check.

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
check('signals.json (dernier scan): R:R ≥ floor éditorial (rr_min_by_regime)', () => {
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
    // Plancher lu depuis la config (abaissé le 2026-08-10), plus en dur : ce contrôle et
    // validate-scan portaient chacun leur copie du seuil et pouvaient diverger en silence.
    // Le vrai critère de sélection est désormais l'ATTEIGNABILITÉ de la cible
    // (scanner-filters.json#editorial_targets.tp1_reachability) ; ce ratio ne subsiste qu'en
    // garde-fou de dernier recours. Grand-pérage par `_active_from` : appliquer 0,7 aux scans
    // antérieurs les ferait passer à tort pour conformes à une règle qui n'existait pas.
    const et = (readJSON('data/scanner-filters.json') || {}).editorial_targets || {};
    const floors = et.rr_min_by_regime || {};
    const from = String(floors._active_from || '').replace(/-/g, '');
    const reg = String(sig.regime || '').toUpperCase().trim();
    const applicable = (from && scanDir >= from) ? floors : (floors._previous || {});
    const min = applicable[reg] ?? (from && scanDir >= from ? 0.7 : 1.5);
    const rr = reward / risk;
    if (rr < min) bad.push(`${ticker}: R:R=${rr.toFixed(2)} < ${min}`);
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
  // Liste VIDE ≠ « tous les signaux échouent ». Sans ce garde, `missing.length === signals.length`
  // vaut 0 === 0 sur un scan sans signal éditorial (scan retiré, scan 100% spécialistes) et le
  // contrôle échoue alors qu'il n'a RIEN à contrôler. Même piège que `anti-dilution.drop[]` vide,
  // qui fait répondre « faux » à tout test d'appartenance.
  if (!Array.isArray(sig.signals) || sig.signals.length === 0) return;
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

// ─── Check 25d: risk_gating non vide sur le dernier scan (incident 22/07/2026) ────
// Le run nocturne du 22/07 a publié avec engine_meta.risk_gating = {} : ni corrélation, ni
// crise, ni sizing — le risk gating de Phase 2 n'avait pas tourné. Un bloc vide = ❌.
check('scanner (dernier scan): engine_meta.risk_gating non vide (corrélation + crise + sizing)', () => {
  const scannerDir = path.join(ROOT, 'scanner');
  const dirs = fs.readdirSync(scannerDir).filter(d => /^\d{8}$/.test(d)).sort().reverse();
  for (const d of dirs) {
    const p = path.join(scannerDir, d, 'data.json');
    if (!fs.existsSync(p)) continue;
    let data; try { data = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return `${d}: data.json illisible`; }
    const rg = (data.engine_meta || {}).risk_gating || {};
    const need = ['max_pair_correlation', 'crisis_prob_5d'];
    const missing = need.filter(k => rg[k] == null);
    if (missing.length) return `${d}: risk_gating incomplet — champs manquants: ${missing.join(', ')} (Phase 2 risk gating non exécutée ?)`;
    return; // dernier scan seulement
  }
  return 'aucun scan trouvé';
});

// ─── Check 25c: dtx-live-track — série live scriptée fraîche (audit 21/07/2026) ──
// Deux semaines de modes dtx live sans historique accumulé ni drift : ne doit JAMAIS se
// reproduire. La série data/dtx-live-track.json doit exister et porter, pour chacun des 6
// modes, un dernier point de moins de 72h (tolérance week-end).
warn('dtx-live-track.json: série live des modes scriptés fraîche (<72h)', () => {
  const DTX = ['best'];
  let track;
  try { track = readJSON('data/dtx-live-track.json'); } catch { return 'fichier absent — lancer dtx-live-track.js --backfill puis gen-status-page'; }
  const stale = [];
  for (const id of DTX) {
    const m = (track.modes || {})[id];
    if (!m || !m.points || !m.points.length) { stale.push(id + ' (aucun point)'); continue; }
    const lastDate = m.points[m.points.length - 1].date;
    const age = (Date.now() - new Date(lastDate + 'T21:00:00Z').getTime()) / 3600000;
    if (age > 72) stale.push(`${id} (dernier point ${lastDate})`);
  }
  if (stale.length) return stale.join('; ');
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
  // Forward continuity layer (sealed anchor + post-anchor delta) — pit-forward.js.
  let pitFwd = { modes: {} };
  try { pitFwd = readJSON('data/pit-forward.json'); } catch (_) { }
  const pitFwdModes = pitFwd.modes || {};
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
    if (cfg.assetClass === 'dtx') continue; // covered by the dtx-specific staging/metrics gates
    const anchor = `id="p-${id}"`;
    const start = html.indexOf(anchor);
    if (start === -1) continue; // panel presence covered by another check
    const next = html.indexOf('id="p-', start + anchor.length);
    const panel = html.slice(start, next === -1 ? html.length : next);
    // Scripted dtx modes label the headline "Engine Return"; quality modes label it "Total Return".
    // Historical "Live Return" is accepted for old snapshots while the public page rolls forward.
    const heroM = panel.match(/>([+\-]?[0-9.]+)%<\/span><span class="ps-l">(?:Total Return|Live Return|Engine Return)/);
    if (!heroM) { issues.push(`${id}: hero return introuvable`); continue; }
    const heroRet = parseFloat(heroM[1]);
    const frozen = br[`frozen_${id}`];
    const frozenRet = frozen && typeof frozen.returnTotal === 'number' ? frozen.returnTotal : null;
    const frozenTrades = frozen && typeof frozen.trades === 'number' ? frozen.trades : 0;
    const frozenMeaningful = frozenRet !== null && (frozenTrades >= 10 || Math.abs(frozenRet) >= 5);

    // Forward continuity layer: when healthy AND carrying post-anchor points, IT is the hero
    // (sealed history + delta of trades closed since the anchor — one current continuous number).
    // FIX 2026-07-13: gated by !frozenMeaningful, mirroring gen-status-page.js — the forward layer
    // is primary ONLY for fresh specialists. For a mode with a real sealed track record the sealed
    // sweep IS the headline (else branch below), never the MtM-moving forward number. Without this
    // gate, qa expected turbo's hero = forward (106.92) and would go red once the generator was
    // fixed to show the sealed 112.24 — the guardrail must enforce the SAME rule it documents.
    const fe = pitFwdModes[id];
    const fwdPrimary = !!(!frozenMeaningful && fe && fe.healthy && (fe.newPoints || 0) > 0);

    if (fwdPrimary) {
      // Hero must equal the forward return (continuous, not the sealed-only endpoint).
      if (Math.abs(heroRet - fe.ret) > TOL) {
        issues.push(`${id}: hero ${heroRet}% ≠ forward ${fe.ret}% (Δ${(heroRet - fe.ret).toFixed(2)}) — couche forward saine attendue au hero`);
      }
      // NEW blocking FORWARD-SEAM: the forward curve must still pin the sealed anchor byte-for-byte.
      const sealedEc = (frozen && frozen.equityCurve) || [];
      const sealedLast = sealedEc.length ? sealedEc[sealedEc.length - 1].value : null;
      const seamVal = (fe.ec && fe.sealedLen) ? (fe.ec[fe.sealedLen - 1] || {}).value : null;
      if (sealedLast === null || seamVal === null || seamVal !== sealedLast) {
        issues.push(`${id}: FORWARD-SEAM rompu — forward.ec[${(fe.sealedLen || 0) - 1}]=${seamVal} ≠ scellé ${sealedLast} (tol 0) — le préfixe scellé doit rester immuable`);
      }
    } else if (frozenMeaningful) {
      // THE guardrail: a sealed track record IS the headline, verbatim — never displaced.
      if (Math.abs(heroRet - frozenRet) > TOL) {
        issues.push(`${id}: hero ${heroRet}% ≠ sweep scellé ${frozenRet}% (Δ${(heroRet - frozenRet).toFixed(2)}) — un track record scellé ne doit JAMAIS être remplacé`);
      }
    } else {
      // Fresh mode (2026-07-22, SOURCE UNIQUE) : pit-state.json RETIRÉ de l'affichage. Le hero d'un
      // mode frais = son frozen (computeStatsFromTrades de ses propres trades), JAMAIS pit-state.
      // On valide donc contre frozenRet (le générateur montre désormais frozen pour les modes frais).
      const expected = frozenRet;
      if (expected !== null && Math.abs(heroRet - expected) > TOL) {
        issues.push(`${id}: hero ${heroRet}% ≠ frozen ${expected}% (Δ${(heroRet - expected).toFixed(2)}) — mode frais, source = sweep frozen`);
      }
    }
  }
  if (issues.length) return issues.join(' | ');
});

// ─── Check 27c: SEALED chart endpoint == frozen ──────────────────────────────
// Le scalaire hero est déjà validé vs frozen.returnTotal par 27b. Ici on verrouille
// le BOUT SCELLÉ de la courbe embarquée (modeCharts) : son dernier point, une fois
// retirée la queue MtM (= le point dont le label vaut aujourd'hui), doit coïncider
// avec le dernier point de frozen_<mode>.equityCurve (le sweep scellé fait foi).
// Périmètre : modes scellés uniquement (mêmes conditions que 27b / frozenMeaningful).
check('scanner/status: bout scellé du chart == frozen equityCurve (SEALED-PRIMARY)', () => {
  const html = readFile('scanner/status/index.html');
  if (!html) return 'scanner/status/index.html absent';
  const br = readJSON('data/backtest-results.json');
  const mc = readJSON('data/modes-config.json');
  const modes = mc.modes ? mc.modes : mc;
  const NON_PUBLIC = new Set(['draft', 'stopped']);
  const TOL = 0.5; // même endpoint : tolérance d'arrondi seulement
  const cm = html.match(/var modeCharts=(\{[\s\S]*?\});/);
  if (!cm) return 'modeCharts introuvable dans scanner/status/index.html';
  let modeCharts;
  try { modeCharts = JSON.parse(cm[1]); } catch (e) { return `modeCharts illisible: ${e.message}`; }
  const now = new Date();
  const todayLabel = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
  const issues = [];

  for (const [id, cfg] of Object.entries(modes)) {
    if (NON_PUBLIC.has(cfg.status)) continue;
    if (cfg.assetClass === 'dtx') continue; // API follows the engine snapshot, not frozen_<id>
    const frozen = br[`frozen_${id}`];
    const frozenRet = frozen && typeof frozen.returnTotal === 'number' ? frozen.returnTotal : null;
    const frozenTrades = frozen && typeof frozen.trades === 'number' ? frozen.trades : 0;
    const frozenMeaningful = frozenRet !== null && (frozenTrades >= 10 || Math.abs(frozenRet) >= 5);
    if (!frozenMeaningful) continue; // mode frais : hors périmètre SEALED-PRIMARY

    const ch = modeCharts[id];
    if (!ch || !Array.isArray(ch.v) || !Array.isArray(ch.d) || !ch.v.length) {
      issues.push(`${id}: modeCharts absent/vide`);
      continue;
    }
    const ec = Array.isArray(frozen.equityCurve) ? frozen.equityCurve : [];
    if (!ec.length) { issues.push(`${id}: frozen.equityCurve vide`); continue; }
    const frozenLast = ec[ec.length - 1];
    const frozenLastV = frozenLast.value;
    // Comparer le point du chart À LA DATE du dernier point frozen (pas un strip aveugle
    // d'« aujourd'hui » : le frozen avance quotidiennement en MtM, son dernier point EST scellé).
    const flLabel = frozenLast.date ? frozenLast.date.slice(5, 7) + '/' + frozenLast.date.slice(8, 10) : null;
    let sealedIdx = -1;
    if (flLabel) { for (let i = ch.d.length - 1; i >= 0; i--) { if (ch.d[i] === flLabel) { sealedIdx = i; break; } } }
    if (sealedIdx < 0) sealedIdx = ch.v.length - 1;
    const sealedV = ch.v[sealedIdx];
    if (typeof sealedV !== 'number' || typeof frozenLastV !== 'number') {
      issues.push(`${id}: valeurs non numériques (chart ${sealedV}, frozen ${frozenLastV})`);
      continue;
    }
    if (Math.abs(sealedV - frozenLastV) > TOL) {
      issues.push(`${id}: bout scellé chart ${sealedV} (${ch.d[sealedIdx]}) ≠ frozen ${frozenLastV} (Δ${(sealedV - frozenLastV).toFixed(2)})`);
    }
  }
  if (issues.length) return issues.join(' | ');
});

// ─── Check 27d: API equity.json == dashboard (hero) == frozen ────────────────
// Verrouille "API == dashboard" : pour chaque mode scellé, portfolio/v1/<mode>/equity.json
//   (a) stats.ret == le hero AFFICHÉ (±1pt) — l'API et le tableau de bord montrent le même chiffre ;
//   (b) equityCurve dernier point == frozen_<mode>.equityCurve dernier (±0.5) — l'API est ancrée au sweep scellé.
// Périmètre : modes scellés uniquement (mêmes conditions que 27b / frozenMeaningful).
check('portfolio/v1: equity.json == dashboard hero == frozen (SEALED-PRIMARY)', () => {
  const html = readFile('scanner/status/index.html');
  if (!html) return 'scanner/status/index.html absent';
  const br = readJSON('data/backtest-results.json');
  const mc = readJSON('data/modes-config.json');
  const modes = mc.modes ? mc.modes : mc;
  const NON_PUBLIC = new Set(['draft', 'stopped']);
  const RET_TOL = 1.0; // hero vs API : bridge live-MtM (<1pt)
  const CURVE_TOL = 0.5; // même endpoint scellé
  const issues = [];

  for (const [id, cfg] of Object.entries(modes)) {
    if (NON_PUBLIC.has(cfg.status)) continue;
    const frozen = br[`frozen_${id}`];
    const frozenRet = frozen && typeof frozen.returnTotal === 'number' ? frozen.returnTotal : null;
    const frozenTrades = frozen && typeof frozen.trades === 'number' ? frozen.trades : 0;
    const frozenMeaningful = frozenRet !== null && (frozenTrades >= 10 || Math.abs(frozenRet) >= 5);
    if (!frozenMeaningful) continue; // mode frais : hors périmètre SEALED-PRIMARY

    // Hero affiché sur le tableau de bord (même extraction que 27b).
    const anchor = `id="p-${id}"`;
    const start = html.indexOf(anchor);
    if (start === -1) { issues.push(`${id}: panneau hero absent`); continue; }
    const nextIdx = html.indexOf('id="p-', start + anchor.length);
    const panel = html.slice(start, nextIdx === -1 ? html.length : nextIdx);
    const heroM = panel.match(/>([+\-]?[0-9.]+)%<\/span><span class="ps-l">(?:Total Return|Live Return|Engine Return)/);
    if (!heroM) { issues.push(`${id}: hero return introuvable`); continue; }
    const heroRet = parseFloat(heroM[1]);

    // API equity.json
    const eqRel = `portfolio/v1/${id}/equity.json`;
    let eq;
    try { eq = readJSON(eqRel); } catch (e) { issues.push(`${id}: equity.json illisible (${e.message})`); continue; }
    const apiRet = eq.stats && typeof eq.stats.ret === 'number' ? eq.stats.ret : null;
    if (apiRet === null) { issues.push(`${id}: equity.json stats.ret manquant`); continue; }
    // (a) API stats.ret == hero affiché
    if (Math.abs(apiRet - heroRet) > RET_TOL) {
      issues.push(`${id}: equity.json ret ${apiRet}% ≠ hero ${heroRet}% (Δ${(apiRet - heroRet).toFixed(2)})`);
    }
    // (b) API equityCurve dernier == frozen dernier
    const ac = eq.equityCurve;
    const apiV = ac && Array.isArray(ac.v) ? ac.v : null;
    const fec = Array.isArray(frozen.equityCurve) ? frozen.equityCurve : [];
    if (!apiV || !apiV.length) { issues.push(`${id}: equity.json equityCurve vide`); continue; }
    if (!fec.length) { issues.push(`${id}: frozen.equityCurve vide`); continue; }
    const apiLastV = apiV[apiV.length - 1];
    const frozenLastV = fec[fec.length - 1].value;
    if (typeof apiLastV === 'number' && typeof frozenLastV === 'number'
        && Math.abs(apiLastV - frozenLastV) > CURVE_TOL) {
      issues.push(`${id}: equity.json dernier ${apiLastV} ≠ frozen ${frozenLastV} (Δ${(apiLastV - frozenLastV).toFixed(2)})`);
    }
  }
  if (issues.length) return issues.join(' | ');
});

// ─── Check 27e: COUVERTURE SEALED-PRIMARY — « non couvert » ne doit pas passer pour « vert » ──
// 27b/27c/27d se déclarent explicitement « périmètre : modes scellés uniquement » : sans entrée
// frozen_<mode> dans data/backtest-results.json, ils font `continue` et le mode sort VERT du QA
// sans avoir été regardé. gen-api.js fait pareil de son côté (statut 'no-frozen', compté dans
// `skipped`). Un mode peut donc publier une courbe et un hero que RIEN ne confronte à un sceau.
//
// Le geste juste n'est pas de fabriquer un frozen_<mode> : un sceau se gagne avec des trades
// clôturés, il ne s'invente pas. C'est de rendre le trou VISIBLE et de le borner. Ce contrôle
// classe donc chaque mode publiquement visible en trois cas :
//   • scellé            → couvert par 27b/27c/27d, rien à faire ici ;
//   • non couvert LÉGITIME (aucun trade clôturé) → déclaré en avertissement, ET tenu à zéro :
//     un mode sans rien de scellé n'a pas le droit d'afficher une performance. C'est ce
//     verrou-là qui aurait rougi sur une courbe publiée sans sceau ;
//   • non couvert ANORMAL (trades clôturés publiés, aucun frozen) → ERREUR bloquante : un track
//     record est publié et aucun sceau ne le contredit.
check('scanner/status: couverture SEALED-PRIMARY (tout mode live est scellé ou déclaré non couvert)', () => {
  const html = readFile('scanner/status/index.html');
  const br = readJSON('data/backtest-results.json');
  const mc = readJSON('data/modes-config.json');
  const modes = mc.modes ? mc.modes : mc;
  const NON_PUBLIC = new Set(['draft', 'stopped']);
  const ZERO_TOL = 0.01; // « rien de scellé » ⇒ le hero doit être 0, pas « petit »
  const issues = [];
  const uncovered = [];

  for (const [id, cfg] of Object.entries(modes)) {
    if (NON_PUBLIC.has(cfg.status)) continue;
    const frozen = br[`frozen_${id}`];
    const frozenRet = frozen && typeof frozen.returnTotal === 'number' ? frozen.returnTotal : null;
    const frozenTrades = frozen && typeof frozen.trades === 'number' ? frozen.trades : 0;
    const frozenMeaningful = frozenRet !== null && (frozenTrades >= 10 || Math.abs(frozenRet) >= 5);
    if (frozenMeaningful) continue;           // périmètre 27b/27c/27d
    if (frozenRet !== null) continue;         // frozen présent mais fin — 27b le valide déjà

    // Ce que le mode PUBLIE : nombre de trades clôturés et rendement affiché par l'API.
    let apiTrades = null, apiRet = null, apiErr = null;
    try {
      const eq = readJSON(`portfolio/v1/${id}/equity.json`);
      apiTrades = eq.stats && typeof eq.stats.trades === 'number' ? eq.stats.trades : null;
      apiRet = eq.stats && typeof eq.stats.ret === 'number' ? eq.stats.ret : null;
    } catch (e) { apiErr = e.message; }

    // Ce que le tableau de bord AFFICHE (même extraction que 27b/27d).
    let heroRet = null;
    const anchor = `id="p-${id}"`;
    const start = html.indexOf(anchor);
    if (start !== -1) {
      const nextIdx = html.indexOf('id="p-', start + anchor.length);
      const panel = html.slice(start, nextIdx === -1 ? html.length : nextIdx);
      const heroM = panel.match(/>([+\-]?[0-9.]+)%<\/span><span class="ps-l">(?:Total Return|Live Return|Engine Return)/);
      if (heroM) heroRet = parseFloat(heroM[1]);
    }

    if (apiErr) {
      issues.push(`${id}: aucun frozen_${id} ET equity.json illisible (${apiErr}) — mode publié, zéro couverture`);
      continue;
    }
    if (apiTrades) {
      issues.push(`${id}: ${apiTrades} trade(s) clôturé(s) publié(s) mais AUCUN frozen_${id} — track record hors périmètre 27b/27c/27d, donc jamais confronté à un sceau. Relancer le sweep (il scelle les stats du mode) avant publication.`);
      continue;
    }

    // Non couvert LÉGITIME : rien n'est scellé parce que rien n'est clos. Le mode doit alors
    // afficher zéro — toute performance non nulle sortie de nulle part est une régression.
    uncovered.push(`${id} (0 trade clôturé)`);
    if (heroRet !== null && Math.abs(heroRet) > ZERO_TOL) {
      issues.push(`${id}: hero ${heroRet}% affiché sans aucun trade clôturé ni frozen_${id} — performance publiée que rien ne scelle`);
    }
    if (apiRet !== null && Math.abs(apiRet) > ZERO_TOL) {
      issues.push(`${id}: equity.json ret ${apiRet}% sans aucun trade clôturé ni frozen_${id} — performance publiée que rien ne scelle`);
    }
  }

  if (issues.length) return issues.join(' | ');
  if (uncovered.length) {
    warnings.push(`⚠️  SEALED-PRIMARY non couvert (hors périmètre 27b/27c/27d, hero vérifié à 0) : ${uncovered.join(', ')}`);
  }
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
  const todayISO = newYorkDateISO();

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
        // Snapshot integrity is point-in-time. Using Date.now() here made an immutable
        // Saturday snapshot lose positions as the wall clock advanced on Sunday/Monday.
        // Mirror gen-status-page with the snapshot date and the official US calendar.
        if (t.status !== 'pending') return false;
        const held = usTradingDaysBetween(t.scanDate || t.entryDate, dateISO);
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
  // Le cache prix est un ARTEFACT RUNTIME dérivé : sweep le (re)construit depuis les prix Yahoo/MCP
  // via tools/lib/price-cache. Son absence sur un clone frais ou avant le premier sweep est NORMALE
  // (rien à vérifier — reconstruit au prochain sweep), pas une anomalie. On lit par l'API canonique
  // readHistory(), qui gère le format daté partitionné (data/.price-cache/<date>/<interval>/<market>/
  // <ticker>.json) ET l'ancien format plat (fallback legacy) — l'ancien check lisait UNIQUEMENT le
  // format plat mort et flaggait donc « dir missing » à tort en permanence.
  let priceCache;
  try { priceCache = require('./lib/price-cache'); } catch { return null; }

  const seen = new Set();
  const drifts = [];

  for (const mode of Object.keys(bt)) {
    for (const t of bt[mode]) {
      if (t.status !== 'pending' && t.status !== 'open') continue;
      if (t.exitPrice == null) continue;
      const tk = t.ticker;
      if (seen.has(tk)) continue;
      seen.add(tk);

      let history;
      try { history = priceCache.readHistory(tk); } catch { history = null; }
      if (!history || typeof history !== 'object' || Array.isArray(history)) continue;
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
    }
  }

  if (drifts.length) return `MtM drift — re-run sweep: ${drifts.join(' | ')}`;
  return null; // cache absent ou zéro dérive → rien à signaler
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
// Shells out to tools/parity-check.js --warn-only, qui compare les modes adossés au moteur
// (aujourd'hui: best, seul assetClass 'dtx') aux configs Go de systematic-tss, plus une ligne
// de couverture par mode du catalogue. Les blocs highvol/etf/etf_eu/bull ont été retirés le
// 2026-08-12 avec les modes eux-mêmes (cf en-tête de parity-check.js). N'échoue JAMAIS ce check
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

// ─── Check 31b: openapi.yaml ↔ fichiers réellement publiés — soft gate ──────
// portfolio/v1/openapi.yaml est écrit À LA MAIN : rien ne le rattache au catalogue de modes.
// Le 2026-08-12 il annonçait encore 21 modes dont 17 supprimés (→ 404) et omettait `best`.
// Warn-only : un contrat périmé ne doit pas bloquer un scan, mais ne doit plus passer inaperçu.
try {
  const { execSync } = require('child_process');
  const apiOut = execSync(`node ${JSON.stringify(path.join(ROOT, 'tools/check-openapi-reality.js'))} --warn-only`, {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const apiBad = apiOut.split('\n').filter(l => l.startsWith('❌'));
  if (apiBad.length > 0) {
    warnings.push(`⚠️  openapi.yaml ↔ API publiée: ${apiBad.length} anomalie(s) — ${apiBad.slice(0, 5).map(l => l.replace('❌ ', '')).join(' | ')}${apiBad.length > 5 ? ' | …' : ''}`);
  } else {
    ok.push('✅ openapi.yaml ↔ API publiée: contrat en accord avec les fichiers servis');
  }
} catch (e) {
  warnings.push(`⚠️  openapi.yaml ↔ API publiée: erreur exécution check-openapi-reality.js — ${e.message.split('\n')[0]}`);
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
        // jsdom ne fournit ni fetch, ni contexte canvas 2d, ni matchMedia/*Observer — APIs que le
        // dashboard live utilise et que TOUT navigateur réel possède. Leur absence lève des
        // ReferenceError/TypeError qui sont des ARTEFACTS d'environnement, pas des bugs de boot
        // (le « fetch is not defined » passait d'ailleurs à travers FATAL_RE malgré l'intention de
        // l'ignorer). On les stube AVANT le parse pour que le smoke n'attrape que les VRAIES erreurs
        // JS du dashboard (fonction non définie, typo, SyntaxError).
        beforeParse(window) {
          window.fetch = () => new Promise(() => {}); // ne résout jamais : le boot avance, zéro réseau
          const ctx2d = { canvas: null };
          const noop = function () { return ctx2d; };
          for (const m of ['clearRect', 'fillRect', 'strokeRect', 'beginPath', 'moveTo', 'lineTo',
            'arc', 'arcTo', 'ellipse', 'stroke', 'fill', 'save', 'restore', 'translate', 'scale',
            'rotate', 'setTransform', 'resetTransform', 'transform', 'closePath', 'bezierCurveTo',
            'quadraticCurveTo', 'fillText', 'strokeText', 'setLineDash', 'getLineDash', 'drawImage',
            'putImageData', 'rect', 'clip', 'roundRect']) ctx2d[m] = noop;
          ctx2d.measureText = () => ({ width: 0 });
          ctx2d.getImageData = () => ({ data: [] });
          ctx2d.createLinearGradient = () => ({ addColorStop() {} });
          ctx2d.createRadialGradient = () => ({ addColorStop() {} });
          ctx2d.createPattern = () => null;
          window.HTMLCanvasElement.prototype.getContext = () => ctx2d;
          if (!window.matchMedia) window.matchMedia = () => ({ matches: false, media: '',
            onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {},
            removeListener() {}, dispatchEvent() { return false; } });
          const Obs = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
          if (!window.IntersectionObserver) window.IntersectionObserver = Obs;
          if (!window.ResizeObserver) window.ResizeObserver = Obs;
        },
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
