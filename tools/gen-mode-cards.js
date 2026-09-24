#!/usr/bin/env node
'use strict';

/**
 * gen-mode-cards.js
 * Generates PNG card images for all portfolio modes, read DYNAMICALLY from
 * data/modes-config.json (single source of truth — mirrors gen-status-page.js /
 * gen-api.js). Any non-draft mode in the config gets a card automatically; draft
 * modes (config created, never run) are skipped until they go live. label/color
 * come from the config; only the emoji has no home in the config and lives in a
 * small explicit override table below (with a neutral fallback).
 * Reads metrics from scanner/status/index.html (same source of truth as notify-scanner-status.js)
 * Saves to scanner/status/mode-{mode}-{timestamp}.png
 * Updates scanner/status/manifest.json
 *
 * Usage:
 *   node tools/gen-mode-cards.js
 *   node tools/gen-mode-cards.js --dry-run
 */

const fs   = require('fs');
const path = require('path');

const ROOT      = path.join(__dirname, '..');
const SCOPE = require('./lib/scanner-scope').loadScannerScope(ROOT);
if (SCOPE.active) console.log('[scope] ' + JSON.stringify(SCOPE.audit));
const STATUS_DIR = path.join(ROOT, 'scanner/status');

const DRY_RUN = process.argv.includes('--dry-run');
const escHtml = value => String(value).replace(/[&<>\"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[c]));

// ─── Mode emoji (presentation-only override; label/color come from config) ──────
// The config has no emoji field, so this small map supplies one per known mode.
// A mode absent here still renders with the neutral fallback emoji.
const MODE_EMOJI = {
  turbo: '🚀', dynamic: '🔥', balanced: '⚖️', secured: '🪐',
  fortress: '🏰', tkl: '🎯', alpha: '🎯', aplus: '💎', bull: '🐂',
};
const DEFAULT_EMOJI = '📊';
// Vrai logo du site, embarqué en data-URI (convention images du projet : jamais de wordmark
// dessiné à la main ni d'emoji à la place du logo).
const LOGO_DATA_URI = 'data:image/svg+xml;base64,' + require('fs').readFileSync(require('path').join(__dirname, '..', 'logo.svg')).toString('base64');
const FRENCH_GOALS = {
  'Risk-Adjusted Growth': 'Croissance ajustée du risque',
  'Maximum Return': 'Rendement maximal',
  'Maximum Capital Preservation': 'Préservation maximale du capital',
  'Maximum Short-Term Alpha': 'Alpha maximal à court terme',
};
const FRENCH_RISK_PROFILES = {
  'Ultra-Low': 'très faible', Low: 'faible', Medium: 'modéré', High: 'élevé', Extreme: 'extrême',
};
// Libellés internes du moteur jamais affichés tels quels sur une image publique.
const INTERNAL_TERMS = [[/protection engine_managed/g, 'protection gérée par le moteur'], [/engine_managed/g, 'géré par le moteur'], [/dtx_engine/g, 'moteur']];
const plain = text => INTERNAL_TERMS.reduce((t, [re, to]) => t.replace(re, to), String(text));
const frenchGoal = goal => plain(FRENCH_GOALS[goal] || goal || 'Objectif non précisé');
const frenchRiskProfile = profile => FRENCH_RISK_PROFILES[profile] || profile || 'non précisé';
// Draft modes are config-only (never run) — skip them exactly like the public API
// surface (gen-api.js NON_PUBLIC_API_STATUSES). They appear automatically once live.
const CARD_SKIP_STATUSES = new Set(['draft']);
function metaFor(modeKey, cfg) {
  return { emoji: MODE_EMOJI[modeKey] || DEFAULT_EMOJI, label: (cfg && cfg.label) || modeKey };
}

// ─── Load .env ────────────────────────────────────────────────────────────────
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}

// ─── Read metrics from scanner/status/index.html (source of truth) ───────────
function readStatusMetrics(modeKey) {
  const htmlPath = path.join(STATUS_DIR, 'index.html');
  if (!fs.existsSync(htmlPath)) return null;
  const statusHtml = fs.readFileSync(htmlPath, 'utf8');
  const panelId = `p-${modeKey}`;
  const start = statusHtml.indexOf(`id="${panelId}"`);
  if (start < 0) return null;
  const next = statusHtml.indexOf('id="p-', start + panelId.length);
  const html = statusHtml.slice(start, next < 0 ? statusHtml.length : next);

  const perfBlock = html.match(/class="perf-stats"[\s\S]{0,4000}?<\/div>\s*<\/div>/);
  const perfHtml  = perfBlock ? perfBlock[0] : '';

  // ⛔ CHIFFRE PUBLIÉ FABRIQUÉ (défaut PRÉ-EXISTANT, identique sur l'index.html de HEAD).
  // Les valeurs étaient lues POSITIONNELLEMENT (vals[0]=ret, vals[1]=dd, …) sur un motif exigeant
  // `class="ps-v"` EXACTEMENT. Trois cellules sur neuf échappent à ce motif :
  //   · Total Return  → `class="ps-v pos"`  (classe de couleur)
  //   · Max Drawdown  → `class="ps-v neg"`  (classe de couleur)
  //   · Profit Factor → `<span class="ps-v"><span class="ps-num">1.8x</span></span>` (valeur imbriquée)
  // Les trois étaient donc silencieusement sautées et tout l'index glissait : la carte fortress
  // publiait « +39,40 % TOTAL RETURN » (= le win rate) et « -109,00 % MAX DRAWDOWN » (= le nombre
  // de trades) au lieu de +19,87 % et -4,43 % — un rendement doublé et un drawdown 25× pire que la
  // réalité, sur une image poussée en Telegram/Discord et servie en Open Graph.
  // On n'indexe plus par POSITION mais par LIBELLÉ : un ajout, un retrait ou un réordonnancement
  // de cellule dans gen-status-page.js ne peut plus décaler silencieusement les chiffres. Un
  // libellé inconnu reste indisponible, plutôt que de publier 0 ou la valeur du voisin.
  const byLabel = {};
  const cellRe = /<span class="ps-v[^"]*"[^>]*>([\s\S]*?)<\/span>\s*<span class="ps-l"[^>]*>([\s\S]*?)<\/span>/g;
  for (let m; (m = cellRe.exec(perfHtml));) {
    const num = String(m[1]).replace(/<[^>]*>/g, '').trim();
    const lab = String(m[2]).replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim().toLowerCase();
    const v = parseFloat(String(num).replace(/[^0-9.+-]/g, ''));
    if (!isNaN(v)) byLabel[lab.split('(')[0].trim()] = v;
  }
  const L = (...names) => {
    for (const n of names) {
      if (byLabel[n] != null) return byLabel[n];
      const k = Object.keys(byLabel).find(x => x === n || x.startsWith(n + ' '));
      if (k) return byLabel[k];
    }
    return null;
  };

  const worstM = html.match(/Worst:\s*([+\-]?[\d.]+)%/);
  const nowM   = html.match(/Now:\s*([+\-]?[\d.]+)%/);
  const bestM  = html.match(/Best:\s*([+\-]?[\d.]+)%/);

  return {
    ret:    L('total return', 'engine return'),
    dd:     L('max drawdown'),
    wr:     L('win rate'),
    pf:     L('profit factor'),
    trades: L('closed trades', 'trades'),
    // A missing scenario is unknown, not a neutral 0% scenario. The card
    // deliberately renders an unavailable state instead of fabricated values.
    worst:  worstM ? parseFloat(worstM[1]) : null,
    now:    nowM   ? parseFloat(nowM[1])   : null,
    best:   bestM  ? parseFloat(bestM[1])  : null,
  };
}

// ─── Canonical open positions per mode ──────────────────────────────────────
// Cards are a public snapshot.  They must use the exact per-mode artifact made
// by gen-api, never infer an "open" position from an old terminal trade.
function latestStatusSnapshotDate() {
  const datesPath = path.join(STATUS_DIR, 'history', 'dates.json');
  if (!fs.existsSync(datesPath)) return null;
  let dates;
  try { dates = JSON.parse(fs.readFileSync(datesPath, 'utf8')); } catch (_) { return null; }
  if (!Array.isArray(dates)) return null;
  const valid = dates.filter(d => /^\d{8}$/.test(String(d))).sort();
  if (!valid.length) return null;
  const d = valid[valid.length - 1];
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

function unavailablePositions(reason) {
  return { positions: [], available: false, snapshotDate: null, reason };
}

function canonicalPositions(modeKey) {
  if (!/^[a-z0-9_]+$/i.test(modeKey)) return unavailablePositions('identifiant de mode invalide');
  const expectedDate = latestStatusSnapshotDate();
  if (!expectedDate) return unavailablePositions('date du snapshot de statut indisponible');
  const positionsPath = path.join(ROOT, 'portfolio', 'v1', modeKey, 'positions.json');
  if (!fs.existsSync(positionsPath)) return unavailablePositions('snapshot canonique des positions absent');

  let doc;
  try { doc = JSON.parse(fs.readFileSync(positionsPath, 'utf8')); }
  catch (_) { return unavailablePositions('snapshot canonique des positions illisible'); }
  if (!doc || doc.mode !== modeKey || !/^\d{4}-\d{2}-\d{2}$/.test(String(doc.date || ''))) {
    return unavailablePositions('snapshot canonique des positions invalide');
  }
  if (doc.date !== expectedDate) {
    return unavailablePositions(`snapshot positions ${doc.date} ≠ snapshot statut ${expectedDate}`);
  }
  if (!Array.isArray(doc.positions)) return unavailablePositions('liste canonique des positions absente');

  const toFinite = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const positions = [];
  for (const position of doc.positions) {
    if (!position || typeof position.ticker !== 'string' || !position.ticker) {
      return unavailablePositions('une position canonique ne porte pas de ticker');
    }
    const entry = toFinite(position.entry);
    const currentPrice = toFinite(position.currentPrice ?? position.current_price);
    const declaredReturn = toFinite(position.returnPct ?? position.return_pct);
    const returnPct = declaredReturn ?? (entry !== null && currentPrice !== null && entry > 0
      ? +(((currentPrice - entry) / entry * 100).toFixed(2)) : null);
    const stop = toFinite(position.stop);
    const tp1 = toFinite(position.tp1);
    const daysRemaining = toFinite(position.daysRemaining ?? position.days_remaining);
    positions.push({
      ticker: position.ticker,
      entry,
      current_price: currentPrice,
      return_pct: returnPct,
      stop,
      tp1,
      left: daysRemaining,
      stopDist: entry !== null && stop !== null && entry > 0 ? +((entry - stop) / entry * 100).toFixed(2) : null,
    });
  }
  return { positions: positions.sort((a, b) => (b.return_pct ?? -Infinity) - (a.return_pct ?? -Infinity)), available: true, snapshotDate: doc.date, reason: null };
}

// ─── Generate HTML for one mode card ─────────────────────────────────────────
function buildCardHtml(modeKey, cfg, metrics, positionState) {
  const positions = positionState.positions;
  const meta     = metaFor(modeKey, cfg);
  const generatedToday = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  const modeColor = cfg.color || '#888';

  // KPI formatting helpers
  const known = Number.isFinite;
  // Format français : virgule décimale et espace avant %, comme sur le site.
  const fr = (v, d) => v.toFixed(d).replace('.', ',');
  const fmtPct  = v => known(v) ? (v >= 0 ? '+' : '−') + fr(Math.abs(v), 2) + ' %' : 'N/D';
  const fmtDD   = v => known(v) ? '−' + fr(Math.abs(v), 2) + ' %' : 'N/D';
  const fmtWR   = v => known(v) ? fr(v, 1) + ' %' : 'N/D';
  const fmtPF   = v => known(v) ? fr(v, 2) : 'N/D';

  const retColor = !known(metrics.ret) ? '#94a3b8' : metrics.ret >= 0 ? '#10b981' : '#ef4444';
  const ddColor  = '#ef4444';
  const wrColor  = !known(metrics.wr) ? '#94a3b8' : metrics.wr >= 55 ? '#10b981' : metrics.wr >= 45 ? '#f59e0b' : '#ef4444';
  const pfColor  = !known(metrics.pf) ? '#94a3b8' : metrics.pf >= 1.5 ? '#10b981' : metrics.pf >= 1 ? '#f59e0b' : '#ef4444';

  // Scenario bar
  const worstNum = metrics.worst;
  const nowNum   = metrics.now;
  const bestNum  = metrics.best;
  const scenarioAvailable = [worstNum, nowNum, bestNum].every(Number.isFinite);
  const allVals  = scenarioAvailable ? [worstNum, nowNum, bestNum, 0] : [0];
  const minV     = Math.min(...allVals) - 2;
  const maxV     = Math.max(...allVals) + 2;
  const range    = maxV - minV || 1;
  const pct      = v => ((v - minV) / range * 100).toFixed(1);
  const nowColor = scenarioAvailable && nowNum >= 0 ? '#10b981' : '#64748b';

  // Positions rows
  const posRows = !positionState.available
    ? `<tr><td colspan="5" style="text-align:center;color:#fbbf24;padding:18px 0;font-size:13px;">Positions indisponibles — ${escHtml(positionState.reason)}</td></tr>`
    : positions.length === 0
      ? `<tr><td colspan="5" style="text-align:center;color:#6b7280;padding:18px 0;font-size:13px;">Aucune position ouverte à cette date</td></tr>`
      : positions.slice(0, 6).map(p => {
          const knownReturn = Number.isFinite(p.return_pct);
          const rc = !knownReturn ? '#94a3b8' : p.return_pct >= 0 ? '#10b981' : '#ef4444';
          const returnText = knownReturn ? `${p.return_pct >= 0 ? '+' : ''}${p.return_pct.toFixed(2)}%` : 'N/D';
          return `<tr>
            <td style="font-weight:700;color:#f1f5f9;font-size:15px;">${escHtml(p.ticker)}</td>
            <td style="color:${rc};font-weight:700;font-size:15px;">${returnText}</td>
            <td style="color:#94a3b8;font-size:13px;">${Number.isFinite(p.left) ? `${p.left} j restants` : 'N/D'}</td>
            <td style="color:#6b7280;font-size:13px;">${Number.isFinite(p.stopDist) && p.stopDist > 0 ? p.stopDist.toFixed(1) + '% jusqu’au stop' : '—'}</td>
            <td style="color:#94a3b8;font-size:13px;">${Number.isFinite(p.tp1) && p.tp1 > 0 ? 'TP1: $' + p.tp1.toFixed(2) : '—'}</td>
          </tr>`;
        }).join('\n');
  const positionsTitle = positionState.available
    ? `Positions ouvertes (${positions.length}) · au ${positionState.snapshotDate}`
    : 'Positions ouvertes — indisponibles';
  const scenarioHtml = scenarioAvailable
    ? `<div class="scenario-wrap">
      <div class="scenario-title">Scénario de portefeuille (défavorable / actuel / favorable)</div>
      <div class="scenario-bar-bg">
        <div class="scenario-bar-fill"></div>
        <div class="scenario-bar-marker" style="left:${pct(0)}%;background:#475569;"></div>
        <div class="scenario-bar-marker" style="left:${pct(nowNum)}%;background:${nowColor};"></div>
      </div>
      <div class="scenario-labels">
        <span>Défavorable : ${worstNum >= 0 ? '+' : ''}${worstNum.toFixed(2)}%</span>
        <span class="scenario-now">Actuel : ${nowNum >= 0 ? '+' : ''}${nowNum.toFixed(2)}%</span>
        <span>Favorable : ${bestNum >= 0 ? '+' : ''}${bestNum.toFixed(2)}%</span>
      </div>
    </div>`
    : `<div class="scenario-wrap"><div class="scenario-title">Scénario de portefeuille indisponible</div><p style="color:#94a3b8;font-size:15px">Aucune position ouverte : pas de scénario à calculer. La carte ne remplace pas ces valeurs par 0 %.</p></div>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  background: #0a0e1a;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  color: #f1f5f9;
  width: 1920px;
}
.card {
  width: 1920px;
  min-height: 1080px;
  background: #0a0e1a;
  padding: 56px 80px;
  display: flex;
  flex-direction: column;
  gap: 40px;
}

/* ── Header ── */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 2px solid ${modeColor}44;
  padding-bottom: 32px;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 24px;
}
.mode-badge {
  background: ${modeColor}22;
  border: 2px solid ${modeColor};
  border-radius: 16px;
  padding: 14px 32px;
  font-size: 42px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: ${modeColor};
  display: flex;
  align-items: center;
  gap: 14px;
}
.mode-goal {
  color: #94a3b8;
  font-size: 18px;
  margin-top: 6px;
}
.header-right {
  text-align: right;
}
.brand {
  font-size: 22px;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 2px;
  text-transform: uppercase;
}
.date {
  color: #475569;
  font-size: 16px;
  margin-top: 4px;
}

/* ── KPI row ── */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 24px;
}
.kpi-card {
  background: #141825;
  border: 1px solid #1e2538;
  border-radius: 12px;
  padding: 28px 24px;
  text-align: center;
}
.kpi-value {
  font-size: 36px;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 10px;
}
.kpi-label {
  font-size: 14px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* ── Positions ── */
.section-title {
  font-size: 18px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 2px;
  margin-bottom: 16px;
}
.positions-table {
  width: 100%;
  border-collapse: collapse;
}
.positions-table th {
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: 10px 16px;
  border-bottom: 1px solid #1e2538;
}
.positions-table td {
  padding: 16px;
  border-bottom: 1px solid #141825;
}
.empty-pos {
  color: #6b7280;
  font-size: 15px;
  padding: 24px 0;
  text-align: center;
}

/* ── Scenario bar ── */
.scenario-wrap {
  background: #141825;
  border: 1px solid #1e2538;
  border-radius: 12px;
  padding: 28px 40px;
}
.scenario-title {
  font-size: 14px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  margin-bottom: 20px;
}
.scenario-bar-bg {
  background: #0f1629;
  border-radius: 6px;
  height: 12px;
  position: relative;
  margin-bottom: 16px;
}
.scenario-bar-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: ${pct(nowNum)}%;
  background: linear-gradient(90deg, #1e2538, ${nowColor});
  border-radius: 6px;
}
.scenario-bar-marker {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 4px;
  height: 22px;
  border-radius: 3px;
}
.scenario-labels {
  display: flex;
  justify-content: space-between;
  font-size: 15px;
  color: #64748b;
}
.scenario-now {
  color: ${nowColor};
  font-weight: 700;
  font-size: 16px;
}

/* ── Footer ── */
.footer {
  margin-top: auto;
  border-top: 1px solid #1e2538;
  padding-top: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #374151;
  font-size: 13px;
}
</style>
</head>
<body>
<div class="card">

  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <div>
        <div class="mode-badge">${meta.label}</div>
        <div class="mode-goal">${frenchGoal(cfg.goal)} — risque ${frenchRiskProfile(cfg.riskProfile)}</div>
      </div>
    </div>
    <div class="header-right">
      <div class="brand"><img src="${LOGO_DATA_URI}" alt="" width="44" height="44" style="vertical-align:middle;margin-right:10px">DailyTickers</div>
      <div class="date">Généré le ${generatedToday}</div>
      <div style="color:#475569;font-size:14px;margin-top:4px;">Carte de mode portefeuille</div>
    </div>
  </div>

  <!-- KPIs -->
  <div class="kpi-row">
    <div class="kpi-card">
      <div class="kpi-value" style="color:${retColor}">${fmtPct(metrics.ret)}</div>
      <div class="kpi-label">Rendement total</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value" style="color:${known(metrics.dd) ? ddColor : '#94a3b8'}">${fmtDD(metrics.dd)}</div>
      <div class="kpi-label">Perte maximale</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value" style="color:${wrColor}">${fmtWR(metrics.wr)}</div>
      <div class="kpi-label">Taux de réussite</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value" style="color:${pfColor}">${fmtPF(metrics.pf)}</div>
      <div class="kpi-label">Facteur de profit</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value" style="color:#94a3b8">${known(metrics.trades) ? metrics.trades : 'N/D'}</div>
      <div class="kpi-label">Transactions closes</div>
    </div>
  </div>

  <!-- Open Positions -->
  <div>
    <div class="section-title">${positionsTitle}</div>
    <table class="positions-table">
      <thead>
        <tr>
          <th>Ticker</th>
          <th>Rendement</th>
          <th>Temps restant</th>
          <th>Stop</th>
          <th>Objectif</th>
        </tr>
      </thead>
      <tbody>
        ${posRows}
      </tbody>
    </table>
  </div>

  <!-- Scenario -->
  ${scenarioHtml}

  <!-- Footer -->
  <div class="footer">
    <span>articles.dailytickers.com/scanner/status/</span>
    <span>Information générale, pas un conseil financier.</span>
    <span>Horizon ${cfg.horizon || '?'} séances · ${cfg.portfolioSize || 1} position${cfg.portfolioSize > 1 ? 's' : ''} au plus</span>
  </div>

</div>
</body>
</html>`;
}

// ─── Generate PNG via Puppeteer ───────────────────────────────────────────────
async function generatePNG(html, outputPath) {
  const puppeteer = require('puppeteer');
  const fsSync    = require('fs');
  let browser;

  // Chrome for Testing 146 on macOS can hang indefinitely in
  // Page.captureScreenshot. The Playwright CLI uses the installed browser
  // channel and avoids that protocol regression.
  if (process.platform === 'darwin' && !process.env.PUPPETEER_EXECUTABLE_PATH) {
    const { execFileSync } = require('child_process');
    const os = require('os');
    const tmp = path.join(os.tmpdir(), `dtx-mode-card-${process.pid}-${Date.now()}.html`);
    try {
      fsSync.writeFileSync(tmp, html);
      execFileSync('playwright', [
        'screenshot', '--browser', 'chromium', '--viewport-size', '1920,1080',
        '--full-page', '--wait-for-timeout', '300', '--timeout', '60000',
        `file://${tmp}`, outputPath,
      ], { stdio: 'pipe', timeout: 65000 });
      console.log(`  PNG: ${outputPath}`);
      return;
    } finally {
      try { fsSync.unlinkSync(tmp); } catch (_) {}
    }
  }

  let executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  const playwrightBase = '/home/ci/.cache/ms-playwright';
  if (!executablePath && fsSync.existsSync(playwrightBase)) {
    try {
      const dirs = fsSync.readdirSync(playwrightBase)
        .filter(d => d.startsWith('chromium-')).sort().reverse();
      for (const dir of dirs) {
        const candidate = `${playwrightBase}/${dir}/chrome-linux/chrome`;
        if (fsSync.existsSync(candidate)) { executablePath = candidate; break; }
      }
    } catch (_) { /* fallback */ }
  }

  try {
    browser = await puppeteer.launch({
    executablePath,
      protocolTimeout: 60000,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: outputPath, type: 'png', fullPage: true, timeout: 30000 });
    console.log(`  PNG: ${outputPath}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== gen-mode-cards.js ===');
  console.log(`Date: ${new Date().toISOString()}`);
  if (DRY_RUN) console.log('DRY RUN — no files written');

  // Load modes-config
  const modesConfigPath = path.join(ROOT, 'data/modes-config.json');
  if (!fs.existsSync(modesConfigPath)) {
    console.error('ERROR: data/modes-config.json not found');
    process.exit(1);
  }
  const modesObj = JSON.parse(fs.readFileSync(modesConfigPath)).modes;

  // Modes to render = every non-draft mode in the config (source of truth).
  // No more hardcoded 7-mode list: highvol/hybrid/forex etc. appear automatically
  // once they flip out of draft, and any newly-added live mode is picked up too.
  const MODES = Object.entries(modesObj)
    .filter(([id, cfg]) => !CARD_SKIP_STATUSES.has(cfg && cfg.status) && !SCOPE.excludesMode(id, cfg))
    .map(([id]) => id);
  console.log(`Modes (non-draft, from config): ${MODES.join(', ')}`);

  // Load manifest
  const manifestPath = path.join(STATUS_DIR, 'manifest.json');
  let manifest = {};
  try { manifest = JSON.parse(fs.readFileSync(manifestPath)); } catch (_) {}
  if (SCOPE.active) {
    for (const id of Object.keys(manifest)) if (SCOPE.excludesMode(id.replace(/^mode-/, ''))) delete manifest[id];
  }

  const ts = Date.now();

  for (const modeKey of MODES) {
    console.log(`\n[${modeKey}]`);
    const cfgRaw = modesObj[modeKey];
    if (!cfgRaw) { console.log('  No config found, skipping'); continue; }
    const cfg = { id: modeKey, ...cfgRaw };

    // Metrics from status page
    const metrics = readStatusMetrics(modeKey) || { ret: null, dd: null, wr: null, pf: null, trades: null, worst: null, now: null, best: null };
    console.log(`  metrics: ret=${metrics.ret} dd=${metrics.dd} wr=${metrics.wr} pf=${metrics.pf}`);

    // Open positions
    const positionState = canonicalPositions(modeKey);
    console.log(`  positions: ${positionState.available ? positionState.positions.length : 'unavailable (' + positionState.reason + ')'}`);

    if (DRY_RUN) {
      console.log('  [dry-run] skipping PNG');
      continue;
    }

    // Build HTML
    const html     = buildCardHtml(modeKey, cfg, metrics, positionState);
    const filename = `mode-${modeKey}-${ts}.png`;
    const outPath  = path.join(STATUS_DIR, filename);

    // Generate PNG
    try {
      await generatePNG(html, outPath);
      manifest[`mode-${modeKey}`] = filename;
      // Retain the previous usable card if rendering fails. Prune only after
      // the replacement exists, and never remove the just-generated image.
      for (const f of fs.readdirSync(STATUS_DIR)) {
        if (f !== filename && new RegExp(`^mode-${modeKey}-\\d+\\.png$`).test(f)) {
          fs.unlinkSync(path.join(STATUS_DIR, f));
        }
      }
    } catch (err) {
      process.exitCode = 1;
      if (err.code === 'MODULE_NOT_FOUND') {
        console.warn(`  Puppeteer not available — skipping PNG for ${modeKey}`);
      } else {
        console.error(`  Error generating PNG for ${modeKey}:`, err.message);
      }
    }
  }

  // Write updated manifest
  if (!DRY_RUN) {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`\nManifest updated: ${manifestPath}`);
  }

  console.log('\nDone.');
}

if (require.main === module) main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });

module.exports = { latestStatusSnapshotDate, canonicalPositions, buildCardHtml, readStatusMetrics };
