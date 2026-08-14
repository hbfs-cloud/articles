#!/usr/bin/env node
/**
 * gen-mandat-page.js — page publique « Le mandat, à découvert »
 *
 * Lit  : data/mandat/staging.json  (instantané de la séance : ordres, exposition, métriques,
 *                                   courbe du backtest)
 *        data/mandat/history.ndjson (registre append-only : une ligne par séance publiée)
 * Écrit: mandat/index.html — page STATIQUE autonome (CSS + données embarquées, ECharts CDN).
 *
 * Contrat éditorial : FR, aucun terme interne (pas de nom de moteur, de serveur ni de script),
 * aucune valeur `undefined`/`NaN` rendue (tout passe par les formateurs → « — »).
 *
 * Usage :
 *   node tools/gen-mandat-page.js
 *   node tools/gen-mandat-page.js --staging data/mandat/staging.json --out mandat/index.html
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ARGV = process.argv.slice(2);
const argOf = (flag, def) => { const i = ARGV.indexOf(flag); return i >= 0 && ARGV[i + 1] ? ARGV[i + 1] : def; };

const STAGING_PATH = path.resolve(ROOT, argOf('--staging', 'data/mandat/staging.json'));
const HISTORY_PATH = path.resolve(ROOT, argOf('--history', 'data/mandat/history.ndjson'));
const OUT_PATH = path.resolve(ROOT, argOf('--out', 'mandat/index.html'));

// Bande d'exposition cible du mandat (en % de l'équity).
const BAND_MIN = 60;
const BAND_MAX = 85;
// Démarrage de l'historique réel (le backtest s'arrête la veille).
const LIVE_START_ISO = '2026-08-14';
const BACKTEST_START_YEAR = 2021;
// Au-delà, la donnée est signalée en rouge.
const STALE_HOURS = 24;
// Heure de référence de clôture retenue pour dater `data_asof` (clôture US ≈ 21:00 UTC).
const CLOSE_UTC = 'T21:00:00Z';

// ── Poches : libellés publics. Aucun identifiant interne ne doit fuir dans le HTML. ──
const SLEEVES = {
  uhv_tp999: { label: 'Momentum haute volatilité', group: 'coeur', note: 'Cassures sur titres très volatils, corrélations bornées' },
  ep:        { label: 'Pivots post-résultats',     group: 'coeur', note: 'Reprises de tendance après publication' },
  mx:        { label: 'Explosion de momentum',     group: 'coeur', note: 'Accélérations de volume et de prix' },
  etf_us:    { label: 'Rotation ETF US',           group: 'coeur', note: 'Rotation sur les fonds indiciels les plus forts' },
  panier:    { label: 'Panier défensif',           group: 'panier', note: 'Dividendes, matières premières, or — détenu en continu' },
};
const sleeveOf = id => SLEEVES[id] || { label: 'Autre poche', group: 'coeur', note: '' };

const ENTRY_KIND = {
  EVENING: 'Entrée du soir',
  ROTATION_IN: 'Entrée de rotation',
  ROTATION_OUT: 'Sortie de rotation',
  MORNING: 'Entrée à l’ouverture',
};

// ─────────────────────────────── formateurs (jamais de NaN/undefined) ───────────────────────────────
const NBSP = ' ';
const NNBSP = ' ';

const isNum = v => typeof v === 'number' && Number.isFinite(v);

function group3(intStr) {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
}
function num(v, d = 2) {
  if (!isNum(v)) return '—';
  const neg = v < 0;
  const fixed = Math.abs(v).toFixed(d);
  const [int, dec] = fixed.split('.');
  return (neg ? '−' : '') + group3(int) + (dec ? ',' + dec : '');
}
function pct(v, d = 1) { return isNum(v) ? num(v, d) + NNBSP + '%' : '—'; }
function usd(v, d = 0) { return isNum(v) ? num(v, d) + NNBSP + '$' : '—'; }
function usdCompact(v) {
  if (!isNum(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e6) return num(v / 1e6, 2) + NNBSP + 'M$';
  if (a >= 1e3) return num(v / 1e3, 1) + NNBSP + 'k$';
  return usd(v, 0);
}
function int(v) { return isNum(v) ? group3(String(Math.round(v))) : '—'; }

const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
function dateFR(iso) {
  if (!iso || typeof iso !== 'string') return '—';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '—';
  return `${Number(m[3])}${NBSP}${MONTHS_FR[Number(m[2]) - 1]}${NBSP}${m[1]}`;
}
function dateShortFR(iso) {
  const m = (iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}` : '—';
}
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ─────────────────────────────── lecture des sources ───────────────────────────────
function readStaging() {
  if (!fs.existsSync(STAGING_PATH)) {
    console.error(`[mandat] introuvable : ${path.relative(ROOT, STAGING_PATH)}`);
    process.exit(1);
  }
  let raw;
  try { raw = JSON.parse(fs.readFileSync(STAGING_PATH, 'utf8')); }
  catch (e) { console.error(`[mandat] JSON illisible (${path.relative(ROOT, STAGING_PATH)}) : ${e.message}`); process.exit(1); }
  return raw;
}

function readHistory() {
  if (!fs.existsSync(HISTORY_PATH)) return [];
  return fs.readFileSync(HISTORY_PATH, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

// ─────────────────────────────── dérivations ───────────────────────────────
function orderNotional(o) {
  const px = isNum(o.limit_price) ? o.limit_price : (isNum(o.price) ? o.price : null);
  if (!isNum(o.qty) || !isNum(px)) return null;
  return o.qty * px;
}
function stopDistancePct(o) {
  const px = isNum(o.limit_price) ? o.limit_price : (isNum(o.price) ? o.price : null);
  if (!isNum(px) || !isNum(o.stop_loss) || px === 0) return null;
  return ((px - o.stop_loss) / px) * 100;
}

function buildComposition(orders) {
  const bySleeve = new Map();
  let total = 0;
  for (const o of orders) {
    const id = o.sleeve || 'autre';
    const notional = orderNotional(o);
    const cur = bySleeve.get(id) || { id, lines: 0, notional: 0, symbols: [] };
    cur.lines += 1;
    if (isNum(notional)) { cur.notional += notional; total += notional; }
    if (o.symbol) cur.symbols.push(o.symbol);
    bySleeve.set(id, cur);
  }
  const rows = [...bySleeve.values()]
    .map(r => ({ ...r, ...sleeveOf(r.id), share: total > 0 ? (r.notional / total) * 100 : null }))
    .sort((a, b) => b.notional - a.notional);
  const sum = g => rows.filter(r => r.group === g).reduce((s, r) => s + r.notional, 0);
  const coeur = sum('coeur');
  const panier = sum('panier');
  return {
    rows, total,
    coeur, panier,
    coeurShare: total > 0 ? (coeur / total) * 100 : null,
    panierShare: total > 0 ? (panier / total) * 100 : null,
  };
}

function freshness(dataAsof, now) {
  const ts = Date.parse(String(dataAsof || '') + CLOSE_UTC);
  if (!Number.isFinite(ts)) return { hours: null, stale: true };
  const hours = (now - ts) / 36e5;
  return { hours, stale: hours > STALE_HOURS };
}

// ─────────────────────────────── rendu ───────────────────────────────
function renderOrdersTable(list, kind) {
  if (!Array.isArray(list) || !list.length) return '';
  const rows = list.map(o => {
    const s = sleeveOf(o.sleeve);
    const dist = stopDistancePct(o);
    const notional = orderNotional(o);
    return `<tr>
      <td class="sym">${esc(o.symbol || '—')}</td>
      <td><span class="side ${o.side === 'SELL' ? 'sell' : 'buy'}">${o.side === 'SELL' ? 'Vente' : 'Achat'}</span></td>
      <td class="n">${int(o.qty)}</td>
      <td class="n">${usd(isNum(o.limit_price) ? o.limit_price : null, 2)}</td>
      <td class="n">${usd(isNum(o.stop_loss) ? o.stop_loss : null, 2)}</td>
      <td class="n">${dist == null ? '—' : '−' + pct(Math.abs(dist), 1)}</td>
      <td class="n">${usdCompact(notional)}</td>
      <td class="muted">${esc(s.label)}</td>
      <td class="muted">${esc(ENTRY_KIND[o.entry_kind] || 'Ordre courant')}</td>
    </tr>`;
  }).join('\n');
  return `<div class="tw"><table class="t">
    <caption class="sr-only">${esc(kind)}</caption>
    <thead><tr>
      <th>Titre</th><th>Sens</th><th class="n">Qté</th><th class="n">Limite</th>
      <th class="n">Stop</th><th class="n">Éloignement</th><th class="n">Montant</th>
      <th>Poche</th><th>Motif</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function renderCompositionTable(comp) {
  const rows = comp.rows.map(r => `<tr class="${r.group === 'panier' ? 'is-panier' : 'is-coeur'}">
    <td><span class="dot ${r.group === 'panier' ? 'd-panier' : 'd-coeur'}" aria-hidden="true"></span>${esc(r.label)}</td>
    <td class="muted">${r.group === 'panier' ? 'Panier défensif' : 'Cœur momentum'}</td>
    <td class="n">${int(r.lines)}</td>
    <td class="n">${usdCompact(r.notional)}</td>
    <td class="n strong">${pct(r.share, 1)}</td>
    <td class="muted small">${esc(r.symbols.slice(0, 6).join(' · ') || '—')}${r.symbols.length > 6 ? ' …' : ''}</td>
  </tr>`).join('\n');
  return `<div class="tw"><table class="t">
    <thead><tr><th>Poche</th><th>Groupe</th><th class="n">Lignes</th><th class="n">Montant</th><th class="n">Part</th><th>Titres</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function renderSleeveMetrics(perSleeve) {
  if (!Array.isArray(perSleeve) || !perSleeve.length) return '';
  const rows = perSleeve.map(s => {
    const meta = sleeveOf(s.allocation);
    return `<tr>
      <td>${esc(meta.label)}</td>
      <td class="n">${usdCompact(s.initial_capital)}</td>
      <td class="n">${usdCompact(s.final_equity)}</td>
      <td class="n ${isNum(s.cagr_pct) && s.cagr_pct >= 0 ? 'pos' : 'neg'}">${pct(s.cagr_pct, 2)}</td>
      <td class="n neg">${isNum(s.max_dd_pct) ? '−' + pct(Math.abs(s.max_dd_pct), 2) : '—'}</td>
      <td class="n">${num(s.sharpe, 2)}</td>
      <td class="n">${s.total_trades ? pct(s.win_rate, 1) : '—'}</td>
      <td class="n">${int(s.total_trades)}</td>
    </tr>`;
  }).join('\n');
  return `<div class="tw"><table class="t">
    <thead><tr><th>Poche</th><th class="n">Capital de départ</th><th class="n">Valeur finale</th><th class="n">Rendement annualisé</th><th class="n">Perte max.</th><th class="n">Sharpe</th><th class="n">Réussite</th><th class="n">Opérations</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function renderHistory(hist) {
  if (!hist.length) return '';
  const rows = hist.slice(0, 12).map(h => `<tr>
    <td class="sym">${esc(dateFR(h.date))}</td>
    <td class="n">${int(h.orders_create)}</td>
    <td class="n">${pct(h.notional_pct, 1)}</td>
  </tr>`).join('\n');
  return `<section class="card" id="journal">
    <h2>Journal des séances</h2>
    <p class="lede">Une ligne par séance publiée. Rien n’est réécrit après coup.</p>
    <div class="tw"><table class="t">
      <thead><tr><th>Séance</th><th class="n">Ordres envoyés</th><th class="n">Exposition</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </section>`;
}

function renderGauge(expo) {
  const v = isNum(expo.notional_pct_equity) ? expo.notional_pct_equity : null;
  const clamped = v == null ? null : Math.max(0, Math.min(100, v));
  let state = 'unknown', label = 'Exposition inconnue', explain = 'Aucune exposition exploitable dans l’instantané de la séance.';
  if (v != null) {
    if (v < BAND_MIN) { state = 'below'; label = 'Sous la bande'; explain = `Le portefeuille est investi à ${pct(v, 1)} alors que le mandat vise ${BAND_MIN}${NNBSP}–${NNBSP}${BAND_MAX}${NNBSP}%. Le reste dort en liquidités : c’est un choix de prudence, pas un oubli.`; }
    else if (v > BAND_MAX) { state = 'above'; label = 'Au-dessus de la bande'; explain = `Le portefeuille est investi à ${pct(v, 1)}, au-dessus du plafond de ${BAND_MAX}${NNBSP}%. La prochaine séance réduit la voilure.`; }
    else { state = 'in'; label = 'Dans la bande'; explain = `Le portefeuille est investi à ${pct(v, 1)}, à l’intérieur de la bande visée ${BAND_MIN}${NNBSP}–${NNBSP}${BAND_MAX}${NNBSP}%.`; }
  }
  const marker = clamped == null ? 0 : clamped;
  return `<section class="card" id="exposition">
    <h2>Exposition</h2>
    <p class="lede">Le mandat s’engage à rester investi entre ${BAND_MIN}${NNBSP}% et ${BAND_MAX}${NNBSP}% de l’encours. Voilà où en est le curseur.</p>
    <div class="gauge-head">
      <div class="gauge-value">${pct(v, 1)}</div>
      <span class="pill p-${state}">${esc(label)}</span>
    </div>
    <div class="gauge" role="img" aria-label="Exposition ${esc(pct(v, 1))} sur une bande cible de ${BAND_MIN} à ${BAND_MAX} pour cent">
      <div class="gauge-track">
        <div class="gauge-band" style="left:${BAND_MIN}%;width:${BAND_MAX - BAND_MIN}%"></div>
        <div class="gauge-fill g-${state}" style="width:${marker}%"></div>
        <div class="gauge-marker" style="left:${marker}%"></div>
      </div>
      <div class="gauge-scale">
        <span style="left:0%">0${NNBSP}%</span>
        <span style="left:${BAND_MIN}%">${BAND_MIN}${NNBSP}%</span>
        <span style="left:${BAND_MAX}%">${BAND_MAX}${NNBSP}%</span>
        <span style="left:100%">100${NNBSP}%</span>
      </div>
    </div>
    <p class="explain">${explain}</p>
    <div class="kpis kpi-3">
      <div class="kpi"><div class="kpi-v">${usdCompact(expo.notional_total)}</div><div class="kpi-k">Montant investi</div></div>
      <div class="kpi"><div class="kpi-v">${usdCompact(expo.equity_basis)}</div><div class="kpi-k">Encours de référence</div></div>
      <div class="kpi"><div class="kpi-v">${pct(expo.risk_to_stop_pct_equity, 2)}</div><div class="kpi-k">Risque jusqu’aux stops</div></div>
    </div>
  </section>`;
}

function buildHtml(staging, hist, now) {
  const asof = staging.asof || null;
  const dataAsof = staging.data_asof || null;
  const fresh = freshness(dataAsof, now);
  const orders = staging.orders || {};
  const creates = Array.isArray(orders.CREATE) ? orders.CREATE : [];
  const updates = Array.isArray(orders.UPDATE) ? orders.UPDATE : [];
  const cancels = Array.isArray(orders.CANCEL) ? orders.CANCEL : [];
  const expo = staging.exposure || {};
  const metrics = staging.metrics || {};
  const comp = buildComposition(creates);

  const eqDates = Array.isArray(staging.equity && staging.equity.dates) ? staging.equity.dates : [];
  const eqValsRaw = Array.isArray(staging.equity && staging.equity.values) ? staging.equity.values : [];
  const pairs = eqDates
    .map((d, i) => [String(d), Number(eqValsRaw[i])])
    .filter(([d, v]) => /^\d{4}-\d{2}-\d{2}/.test(d) && Number.isFinite(v));
  const chartDates = pairs.map(p => p[0]);
  const chartVals = pairs.map(p => Math.round(p[1] * 100) / 100);

  const staleBanner = `<div class="stale" id="staleBanner"${fresh.stale ? '' : ' hidden'}>
    <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
    <div><strong>Données en retard.</strong> La dernière clôture prise en compte remonte à <span id="staleAge">${fresh.hours == null ? 'plus de 24 h' : int(fresh.hours) + NBSP + 'h'}</span>. Tant que ce bandeau est affiché, considérez les chiffres ci-dessous comme périmés.</div>
  </div>`;

  const kpiTiles = `<div class="kpis kpi-6">
    <div class="kpi"><div class="kpi-v pos">${pct(metrics.cagr_pct, 2)}</div><div class="kpi-k">Rendement annualisé</div></div>
    <div class="kpi"><div class="kpi-v neg">${isNum(metrics.max_dd_pct) ? '−' + pct(Math.abs(metrics.max_dd_pct), 2) : '—'}</div><div class="kpi-k">Pire perte subie</div></div>
    <div class="kpi"><div class="kpi-v">${num(metrics.sharpe, 2)}</div><div class="kpi-k">Sharpe</div></div>
    <div class="kpi"><div class="kpi-v">${pct(metrics.win_rate, 1)}</div><div class="kpi-k">Opérations gagnantes</div></div>
    <div class="kpi"><div class="kpi-v">${int(metrics.total_trades)}</div><div class="kpi-k">Opérations</div></div>
    <div class="kpi"><div class="kpi-v">${num(metrics.r2, 2)}</div><div class="kpi-k">Régularité (R²)</div></div>
  </div>`;

  const chartBlock = chartVals.length >= 2 ? `
    <div id="eqChart" class="chart" role="img" aria-label="Courbe de capital du backtest, du ${esc(dateFR(chartDates[0]))} au ${esc(dateFR(chartDates[chartDates.length - 1]))}"></div>
    <p class="chart-note">De ${usdCompact(chartVals[0])} le ${dateFR(chartDates[0])} à ${usdCompact(chartVals[chartVals.length - 1])} le ${dateFR(chartDates[chartDates.length - 1])} — simulation, frais et exécution imparfaite non modélisés au tick près.</p>` :
    `<p class="explain">Courbe indisponible dans l’instantané de la séance.</p>`;

  const updBlock = (updates.length || cancels.length) ? `
    <h3>Ajustements et annulations</h3>
    ${renderOrdersTable(updates, 'Ordres modifiés')}
    ${renderOrdersTable(cancels, 'Ordres annulés')}` : '';

  return `<!DOCTYPE html>
<html lang="fr" data-tags="etf,momentum,technique" data-tab="mandat">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Le mandat, à découvert — DailyTickers</title>
<meta name="description" content="Exposition, composition, ordres de la dernière séance et courbe de capital du portefeuille mandat — publiés après la clôture d'exécution.">
<meta name="robots" content="index,follow">
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-T5Z595CW');</script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
<style>
:root{
  --bg:oklch(17.5% 0.014 250);
  --surface:oklch(21.5% 0.015 250);
  --surface-2:oklch(25% 0.016 250);
  --border:oklch(31% 0.014 250);
  --border-2:oklch(27% 0.013 250);
  --ink:oklch(95% 0.006 250);
  --ink-2:oklch(84% 0.008 250);
  --muted:oklch(66% 0.014 250);
  --accent:oklch(74% 0.128 237);
  --pos:oklch(76% 0.145 158);
  --neg:oklch(68% 0.175 25);
  --warn:oklch(80% 0.135 78);
  --mono:'JetBrains Mono','SF Mono',ui-monospace,Menlo,Consolas,monospace;
  --r:10px;--r-s:6px;
}
*{box-sizing:border-box}
html,body{max-width:100vw;overflow-x:hidden}
body{margin:0;background:var(--bg);color:var(--ink);font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased;font-size:15px;line-height:1.55}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}

/* Brand bar */
.brand-bar{background:oklch(15% 0.012 250);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:50}
.brand-bar-inner{max-width:1080px;margin:0 auto;padding:.6rem 1.25rem;display:flex;align-items:center;gap:1rem}
.brand-logo{display:flex;align-items:center;gap:.55rem;color:var(--ink);font-weight:800;letter-spacing:-.01em}
.brand-logo:hover{text-decoration:none}
.brand-nav{display:flex;gap:.9rem;margin-left:auto;overflow-x:auto;scrollbar-width:none}
.brand-nav::-webkit-scrollbar{display:none}
.brand-nav a{color:var(--muted);font-size:.8rem;font-weight:600;white-space:nowrap}
.brand-nav a:hover{color:var(--ink);text-decoration:none}

.w{max-width:1080px;margin:0 auto;padding:0 1.25rem 4rem}

/* Hero */
.hero{padding:2.4rem 0 1.6rem;border-bottom:1px solid var(--border-2)}
.hero h1{font-size:clamp(1.9rem,5vw,2.7rem);line-height:1.08;margin:0 0 .6rem;font-weight:800;letter-spacing:-.02em}
.hero p.lede{margin:0 0 1.2rem;color:var(--ink-2);max-width:62ch;font-size:1.02rem}
.asof{display:inline-flex;align-items:baseline;gap:.75rem;flex-wrap:wrap;background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:var(--r);padding:.7rem 1.1rem}
.asof .k{font-family:var(--mono);font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.asof .v{font-family:var(--mono);font-size:clamp(1.35rem,4vw,2rem);font-weight:700;color:var(--ink);letter-spacing:-.01em}
.asof .sub{font-size:.78rem;color:var(--muted)}
.asof.is-stale{border-left-color:var(--neg)}
.asof.is-stale .v{color:var(--neg)}
.stale{display:flex;gap:.7rem;align-items:flex-start;margin:1rem 0 0;padding:.85rem 1rem;border:1px solid var(--neg);border-radius:var(--r);background:oklch(30% 0.08 25);color:var(--ink);font-size:.86rem;line-height:1.45}
.stale i{color:var(--neg);margin-top:.15rem}
.stale[hidden]{display:none}

/* Cards */
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:1.4rem 1.35rem;margin:1.6rem 0}
.card h2{margin:0 0 .35rem;font-size:1.12rem;font-weight:700;letter-spacing:-.01em}
.card h3{margin:1.6rem 0 .5rem;font-size:.85rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-family:var(--mono)}
.lede{margin:0 0 1.1rem;color:var(--muted);font-size:.88rem;max-width:70ch}
.explain{margin:.9rem 0 0;color:var(--ink-2);font-size:.88rem;max-width:70ch}
.note{margin:.9rem 0 0;padding:.65rem .8rem;border-left:2px solid var(--border);background:var(--surface-2);border-radius:0 var(--r-s) var(--r-s) 0;color:var(--muted);font-size:.8rem;line-height:1.5}

/* KPIs */
.kpis{display:grid;gap:.6rem;margin-top:1.2rem}
.kpi-6{grid-template-columns:repeat(6,1fr)}
.kpi-3{grid-template-columns:repeat(3,1fr)}
.kpi{background:var(--surface-2);border:1px solid var(--border-2);border-radius:var(--r-s);padding:.7rem .75rem;min-width:0}
.kpi-v{font-family:var(--mono);font-size:1.02rem;font-weight:700;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kpi-k{font-size:.66rem;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-top:.2rem;font-weight:600}
.pos{color:var(--pos)}.neg{color:var(--neg)}

/* Gauge */
.gauge-head{display:flex;align-items:baseline;gap:.8rem;flex-wrap:wrap;margin-bottom:.9rem}
.gauge-value{font-family:var(--mono);font-size:2.1rem;font-weight:700;letter-spacing:-.02em}
.pill{font-family:var(--mono);font-size:.64rem;font-weight:700;letter-spacing:.09em;text-transform:uppercase;padding:.25rem .5rem;border-radius:var(--r-s);border:1px solid}
.p-in{color:var(--pos);border-color:var(--pos)}
.p-below{color:var(--warn);border-color:var(--warn)}
.p-above{color:var(--neg);border-color:var(--neg)}
.p-unknown{color:var(--muted);border-color:var(--border)}
.gauge{margin:.2rem 0 1.6rem;position:relative}
.gauge-track{position:relative;height:16px;background:var(--surface-2);border:1px solid var(--border-2);border-radius:99px;overflow:hidden}
.gauge-band{position:absolute;top:0;bottom:0;background:oklch(76% 0.145 158/.18);border-left:1px dashed var(--pos);border-right:1px dashed var(--pos)}
.gauge-fill{position:absolute;top:0;bottom:0;left:0;border-radius:99px 0 0 99px}
.g-in{background:var(--pos)}.g-below{background:var(--warn)}.g-above{background:var(--neg)}.g-unknown{background:var(--muted)}
.gauge-marker{position:absolute;top:-4px;bottom:-4px;width:2px;background:var(--ink);transform:translateX(-1px)}
.gauge-scale{position:relative;height:1.1rem;margin-top:.35rem}
.gauge-scale span{position:absolute;transform:translateX(-50%);font-family:var(--mono);font-size:.62rem;color:var(--muted);white-space:nowrap}
.gauge-scale span:first-child{transform:none}
.gauge-scale span:last-child{transform:translateX(-100%)}

/* Split coeur / panier */
.split{display:flex;height:34px;border-radius:var(--r-s);overflow:hidden;border:1px solid var(--border-2);margin:.2rem 0 .7rem}
.split div{display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:.7rem;font-weight:700;color:oklch(17% 0.01 250);min-width:0;overflow:hidden;white-space:nowrap}
.s-coeur{background:var(--accent)}
.s-panier{background:var(--pos)}
.legend{display:flex;gap:1.1rem;flex-wrap:wrap;font-size:.78rem;color:var(--muted);margin-bottom:1rem}
.legend span{display:inline-flex;align-items:center;gap:.4rem}
.dot{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:.45rem;vertical-align:baseline}
.d-coeur{background:var(--accent)}
.d-panier{background:var(--pos)}

/* Tables */
.tw{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:.2rem -.35rem 0;padding:0 .35rem}
.t{width:100%;border-collapse:collapse;font-family:var(--mono);font-size:.76rem;white-space:nowrap}
.t th{text-align:left;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:700;padding:.45rem .55rem;border-bottom:1px solid var(--border)}
.t td{padding:.42rem .55rem;border-bottom:1px solid var(--border-2);color:var(--ink-2)}
.t tbody tr:hover td{background:var(--surface-2)}
.t .n{text-align:right;font-variant-numeric:tabular-nums}
.t th.n{text-align:right}
.t .sym{color:var(--ink);font-weight:700}
.t .muted{color:var(--muted)}
.t .small{font-size:.7rem;white-space:normal;min-width:14ch}
.t .strong{color:var(--ink);font-weight:700}
.side{font-size:.62rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:.1rem .35rem;border-radius:3px;border:1px solid}
.side.buy{color:var(--pos);border-color:var(--pos)}
.side.sell{color:var(--neg);border-color:var(--neg)}

/* Chart */
.chart{width:100%;height:340px;margin:.4rem 0 .2rem}
.chart-note{margin:.5rem 0 0;font-size:.78rem;color:var(--muted)}

/* Footer */
footer.article-footer{border-top:1px solid var(--border);padding:1.8rem 0 2.4rem;color:var(--muted);font-size:.8rem}
footer.article-footer .fw{max-width:1080px;margin:0 auto;padding:0 1.25rem;display:flex;gap:1rem;justify-content:space-between;flex-wrap:wrap}
footer.article-footer strong{color:var(--ink-2)}
.disclaimer{font-family:var(--mono);font-size:.68rem;letter-spacing:.06em;text-transform:uppercase;color:var(--warn)}

@media(max-width:880px){
  .kpi-6{grid-template-columns:repeat(3,1fr)}
}
@media(max-width:560px){
  body{font-size:14px}
  .kpi-6,.kpi-3{grid-template-columns:repeat(2,1fr)}
  .card{padding:1.1rem 1rem}
  .gauge-scale span{font-size:.56rem}
  .chart{height:280px}
}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>
</head>
<body>
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-T5Z595CW" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>

<nav class="brand-bar">
  <div class="brand-bar-inner">
    <a href="/" class="brand-logo"><img src="/logo.svg" alt="" width="30" height="30"><span>DailyTickers</span></a>
    <div class="brand-nav">
      <a href="/?tab=weekly">Hebdo</a><a href="/?tab=daily">Daily</a><a href="/?tab=analyses">Analyses</a><a href="/?tab=scanner">Scanner</a><a href="/?tab=radar">Radar</a><a href="/?tab=series">Séries</a>
    </div>
  </div>
</nav>

<div class="w">
  <header class="hero">
    <h1>Le mandat, à découvert</h1>
    <p class="lede">Un portefeuille piloté par un jeu de règles fixes. Chaque soir, la même page : combien est investi, dans quoi, quels ordres sont partis, et ce que valait la stratégie sur les cinq dernières années de marché. Rien de plus, rien de caché.</p>
    <div class="asof${fresh.stale ? ' is-stale' : ''}" id="asofBox">
      <div>
        <div class="k">Séance</div>
        <div class="v">${esc(dateFR(asof))}</div>
      </div>
      <div class="sub">Dernière clôture prise en compte&nbsp;: <strong>${esc(dateFR(dataAsof))}</strong></div>
    </div>
    ${staleBanner}
  </header>

  ${renderGauge(expo)}

  <section class="card" id="composition">
    <h2>Ce qu’il y a dedans</h2>
    <p class="lede">Deux blocs. Un cœur momentum qui va chercher la performance, un panier défensif détenu en continu — dividendes, matières premières, or — qui amortit.</p>
    <div class="split">
      ${isNum(comp.coeurShare) && comp.coeurShare > 0 ? `<div class="s-coeur" style="width:${comp.coeurShare}%">${comp.coeurShare >= 12 ? 'Cœur ' + pct(comp.coeurShare, 0) : ''}</div>` : ''}
      ${isNum(comp.panierShare) && comp.panierShare > 0 ? `<div class="s-panier" style="width:${comp.panierShare}%">${comp.panierShare >= 12 ? 'Panier ' + pct(comp.panierShare, 0) : ''}</div>` : ''}
    </div>
    <div class="legend">
      <span><i class="dot d-coeur" aria-hidden="true"></i>Cœur momentum — ${usdCompact(comp.coeur)} (${pct(comp.coeurShare, 1)})</span>
      <span><i class="dot d-panier" aria-hidden="true"></i>Panier défensif — ${usdCompact(comp.panier)} (${pct(comp.panierShare, 1)})</span>
    </div>
    ${renderCompositionTable(comp)}
    <p class="note">Le panier défensif n’est pas un fond de tiroir&nbsp;: il est dimensionné pour rester en place quand le cœur momentum se fait sortir. C’est lui qui tient la barre pendant les phases où la tendance ne paie plus.</p>
  </section>

  <section class="card" id="ordres">
    <h2>Ordres de la dernière séance</h2>
    <p class="lede">${int(creates.length)} ordre${creates.length > 1 ? 's' : ''} sur la séance du ${dateFR(asof)}.</p>
    <p class="note"><strong>Publiés après la clôture d’exécution.</strong> Cette page paraît une fois les ordres passés&nbsp;: on montre ce qui a été fait, pas ce qui va l’être. Les prix affichés sont les limites transmises, pas des prix de revient.</p>
    ${creates.length ? renderOrdersTable(creates, 'Ordres envoyés') : '<p class="explain">Aucun ordre d’entrée sur cette séance.</p>'}
    ${updBlock}
  </section>

  <section class="card" id="performance">
    <h2>Ce que valait la stratégie</h2>
    <p class="lede">Simulation des règles du mandat sur données historiques, capital de départ ${usdCompact(chartVals.length ? chartVals[0] : null)}.</p>
    ${kpiTiles}
    ${chartBlock}
    <p class="note"><strong>Backtest depuis ${BACKTEST_START_YEAR}, historique réel démarré le ${dateShortFR(LIVE_START_ISO)}/${LIVE_START_ISO.slice(0, 4)}.</strong> Tout ce qui précède cette date est une simulation&nbsp;: les règles ont été appliquées à des prix passés, pas à des ordres réellement exécutés. La colonne de droite de l’histoire — celle qui compte — commence maintenant et s’écrit une séance à la fois.</p>
    ${renderSleeveMetrics(metrics.per_sleeve)}
  </section>

  ${renderHistory(hist)}
</div>

<footer class="article-footer">
  <div class="fw">
    <div><strong>DailyTickers</strong> — Le mandat, à découvert. Page mise à jour à chaque séance, après la clôture d’exécution.</div>
    <div class="disclaimer">Éducatif — pas un conseil en investissement</div>
  </div>
</footer>

<script>
(function(){
  var DATA_ASOF = ${JSON.stringify(String(dataAsof || '') + CLOSE_UTC)};
  var STALE_HOURS = ${STALE_HOURS};
  var banner = document.getElementById('staleBanner');
  var box = document.getElementById('asofBox');
  var ageEl = document.getElementById('staleAge');
  if (!banner || !box) return;
  var ts = Date.parse(DATA_ASOF);
  var stale = true, hours = null;
  if (isFinite(ts)) { hours = (Date.now() - ts) / 36e5; stale = hours > STALE_HOURS; }
  if (stale) {
    banner.hidden = false;
    box.classList.add('is-stale');
    if (ageEl) ageEl.textContent = (hours === null || !isFinite(hours)) ? 'plus de 24 h' : Math.floor(hours) + '\\u00a0h';
  } else {
    banner.hidden = true;
    box.classList.remove('is-stale');
  }
})();
</script>

<script>
(function(){
  var DATES = ${JSON.stringify(chartDates)};
  var VALUES = ${JSON.stringify(chartVals)};
  var el = document.getElementById('eqChart');
  if (!el || !window.echarts || DATES.length < 2) return;
  function money(v){
    if (typeof v !== 'number' || !isFinite(v)) return '—';
    var a = Math.abs(v);
    if (a >= 1e6) return (v/1e6).toFixed(2).replace('.', ',') + ' M$';
    if (a >= 1e3) return Math.round(v/1e3) + ' k$';
    return Math.round(v) + ' $';
  }
  var chart = echarts.init(el, null, { renderer: 'canvas' });
  chart.setOption({
    animation: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    grid: { left: 58, right: 18, top: 18, bottom: 34 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(24,28,36,.96)',
      borderColor: 'rgba(255,255,255,.14)',
      textStyle: { color: '#e9edf3', fontSize: 12 },
      formatter: function(p){
        if (!p || !p.length) return '';
        return p[0].axisValue + '<br/><b>' + money(p[0].data) + '</b>';
      }
    },
    xAxis: {
      type: 'category', data: DATES, boundaryGap: false,
      axisLine: { lineStyle: { color: 'rgba(255,255,255,.18)' } },
      axisLabel: { color: 'rgba(233,237,243,.55)', fontSize: 10, formatter: function(v){ return String(v).slice(0,7); } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value', scale: true,
      axisLabel: { color: 'rgba(233,237,243,.55)', fontSize: 10, formatter: money },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,.07)' } }
    },
    series: [{
      type: 'line', data: VALUES, smooth: true, showSymbol: false,
      lineStyle: { width: 2, color: '#5fb8ef' },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(95,184,239,.32)' },
          { offset: 1, color: 'rgba(95,184,239,.02)' }
        ])
      },
      markLine: {
        silent: true, symbol: 'none',
        lineStyle: { color: 'rgba(240,190,110,.85)', type: 'dashed', width: 1 },
        label: { formatter: 'début du réel', color: 'rgba(240,190,110,.95)', fontSize: 10, position: 'insideEndTop', rotate: 0, align: 'right', padding: [0, 4, 0, 0] },
        data: [{ xAxis: DATES[DATES.length - 1] }]
      }
    }]
  });
  window.addEventListener('resize', function(){ chart.resize(); });
})();
</script>
</body>
</html>
`;
}

// ─────────────────────────────── main ───────────────────────────────
function main() {
  const staging = readStaging();
  const hist = readHistory();
  const html = buildHtml(staging, hist, Date.now());
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, html, 'utf8');
  const kb = Math.round(Buffer.byteLength(html, 'utf8') / 1024);
  const nOrders = ((staging.orders || {}).CREATE || []).length;
  console.log(`[mandat] ${path.relative(ROOT, OUT_PATH)} — ${kb} KB · séance ${staging.asof || '?'} · ${nOrders} ordres · clôture ${staging.data_asof || '?'}`);
}

if (require.main === module) main();

module.exports = { buildHtml, buildComposition, freshness, num, pct, usd, usdCompact, dateFR };
