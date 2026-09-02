#!/usr/bin/env node
'use strict';
/**
 * gen-track-record.js — page Track Record publique (tech/track-record/index.html)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * INVARIANT — SEALED-PRIMARY (cf. .claude/memory/feedback_sealed_primary_display.md)
 * ══════════════════════════════════════════════════════════════════════════════
 * Cette page ne CALCULE RIEN. Elle RECOPIE les agrégats déjà scellés :
 *
 *   1. data/backtest-results.json  → `frozen_<mode>`  = SOURCE PRIMAIRE
 *      (returnTotal, maxDD, winRate, profitFactor, trades, sharpe, calmar,
 *       equityCurve[{date,value}], in_sample, out_sample)
 *   2. portfolio/v1/<mode>/equity.json → libellé, config, statut, `reliability`
 *      (période d'échantillon, avertissements hors-échantillon)
 *   3. scanner/status/history/<latest>.json → date de la dernière séance suivie
 *      (badge « as of » uniquement — AUCUN chiffre de performance n'en sort)
 *
 * Interdits explicites, pour que la page ne puisse pas rejouer les incidents
 * du 2026-07-02 et du 2026-07-13 :
 *   - aucun recalcul de return / DD / WR / PF à partir des trades ou des courbes ;
 *   - aucun carnet live ni forward-view incl. mark-to-market en chiffre de tête ;
 *   - un mode sans `frozen_<id>` n'est PAS inventé, il est marqué « pas encore de
 *     registre scellé » et ses métriques restent à « — ».
 *
 * Usage :
 *   node tools/gen-track-record.js            # génère tech/track-record/index.html
 *   node tools/gen-track-record.js --json     # + résumé machine-lisible sur stdout
 *   node tools/gen-track-record.js --out X    # chemin de sortie alternatif
 *
 * Appelé automatiquement en fin de `tools/gen-status-page.js` (voir §Track record).
 * À défaut, le lancer APRÈS gen-status-page.js — il lit les artefacts que celui-ci
 * (et gen-api.js) viennent d'écrire.
 *
 * Après génération (gates de publication) :
 *   node tools/qa-content.js tech/track-record/index.html --strict
 *   node tools/check-ai-tells.js tech/track-record/index.html
 *   node tools/add_card.js tech/track-record/index.html
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DEFAULT = path.join(ROOT, 'tech/track-record/index.html');

// Modes exposés publiquement, dans l'ordre d'affichage voulu. Un mode de cette
// liste absent de portfolio/v1/status.json (ou non `live`) est simplement ignoré.
const PUBLIC_MODES = ['turbo', 'dynamic', 'balanced', 'fortress', 'best'];

// Une ligne descriptive par carnet — factuelle, dérivée de la config publiée.
const MODE_BLURB = {
  turbo: 'Une seule ligne en portefeuille, tenue trois séances, sur les candidats les mieux notés.',
  dynamic: 'Une ligne, horizon dix séances : la même sélection tenue plus longtemps.',
  balanced: 'Trois lignes en parallèle, horizon six séances, avec une rotation par jour au maximum.',
  fortress: 'Dix lignes, horizon huit séances : la diversification sert de parachute.',
  best: 'Quinze lignes, horizon quatorze séances, décidées le soir par le moteur systématique.',
};

const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

// ─── Utilitaires de formatage (aucun calcul métier) ──────────────────────────
function frDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS_FR[m - 1]} ${y}`;
}
function num(v, dec = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return Number(v).toFixed(dec).replace('.', ',');
}
function pct(v, dec = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const s = Number(v) > 0 ? '+' : '';
  return `${s}${num(v, dec)} %`;
}
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function signClass(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return 'tr-flat';
  return Number(v) > 0 ? 'tr-pos' : Number(v) < 0 ? 'tr-neg' : 'tr-flat';
}
function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

// ─── Lecture des sources scellées ────────────────────────────────────────────
function latestSnapshot() {
  const dir = path.join(ROOT, 'scanner/status/history');
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter(f => /^\d{8}\.json$/.test(f)).sort();
  if (!files.length) return null;
  const f = files[files.length - 1];
  const snap = readJSON(path.join(dir, f));
  if (!snap) return null;
  return { file: f, date: snap.date || null, updatedAt: snap.updatedAt || null };
}

function collectModes() {
  const results = readJSON(path.join(ROOT, 'data/backtest-results.json'));
  if (!results) throw new Error('data/backtest-results.json illisible — registre scellé introuvable');
  const status = readJSON(path.join(ROOT, 'portfolio/v1/status.json')) || { modes: {} };

  const out = [];
  for (const id of PUBLIC_MODES) {
    const st = (status.modes || {})[id];
    if (!st) continue;
    if (st.state !== 'live') continue;
    if (st.publiclyVisible === false) continue;

    const eq = readJSON(path.join(ROOT, `portfolio/v1/${id}/equity.json`)) || {};
    const cfg = eq.config || {};
    const rel = eq.reliability || {};
    const frozen = results[`frozen_${id}`] || null;

    // Courbe scellée : on recopie les points datés tels quels.
    const curve = (frozen && Array.isArray(frozen.equityCurve) ? frozen.equityCurve : [])
      .filter(p => p && p.date && typeof p.value === 'number');

    // Un registre n'est "parlant" que s'il porte de vrais trades clôturés.
    const trades = frozen && typeof frozen.trades === 'number' ? frozen.trades : 0;
    const sealed = !!frozen && trades > 0;

    out.push({
      id,
      label: cfg.label || (id.charAt(0).toUpperCase() + id.slice(1)),
      color: cfg.color || '#2563eb',
      blurb: MODE_BLURB[id] || '',
      config: {
        portfolioSize: cfg.portfolioSize ?? null,
        horizon: cfg.horizon ?? null,
        minScore: cfg.minScore ?? null,
        rotation: cfg.rotation || 'none',
      },
      sealed,
      // Chiffres RECOPIÉS du registre scellé — jamais recalculés.
      stats: frozen ? {
        ret: frozen.returnTotal ?? null,
        dd: frozen.maxDD ?? null,
        wr: frozen.winRate ?? null,
        pf: frozen.profitFactor ?? null,
        trades,
        sharpe: frozen.sharpe ?? null,
        calmar: frozen.calmar ?? null,
      } : { ret: null, dd: null, wr: null, pf: null, trades: 0, sharpe: null, calmar: null },
      oos: frozen && frozen.out_sample ? frozen.out_sample : null,
      oosWarn: rel.out_of_sample_warning || null,
      periodStart: curve.length ? curve[0].date : null,
      periodEnd: curve.length ? curve[curve.length - 1].date : null,
      sampleDays: rel.sample_period_days ?? null,
      closedTrades: rel.closed_trades ?? null,
      curve,
      since: st.since || null,
    });
  }
  return out;
}

// ─── Rendu ───────────────────────────────────────────────────────────────────
function modeCard(m) {
  const chartId = `tr-chart-${m.id}`;
  const hasCurve = m.sealed && m.curve.length >= 2;

  const metric = (label, value, cls) =>
    `<div class="tr-metric"><div class="tr-metric-value ${cls || ''}">${value}</div>` +
    `<div class="tr-metric-label">${esc(label)}</div></div>`;

  const s = m.stats;
  const metrics = [
    metric('Trades clôturés', m.sealed ? String(s.trades) : '—'),
    metric('Taux de réussite', m.sealed ? `${num(s.wr, 1)} %` : '—'),
    metric('Facteur de profit', m.sealed && s.pf ? `${num(s.pf, 2)}×` : '—'),
    metric('Rendement cumulé', m.sealed ? pct(s.ret) : '—', signClass(m.sealed ? s.ret : null)),
    metric('Pire repli', m.sealed ? `${num(s.dd, 2)} %` : '—', m.sealed ? 'tr-neg' : ''),
  ].join('\n        ');

  const asOf = m.sealed ? frDate(m.periodEnd) : null;
  const from = m.sealed ? frDate(m.periodStart) : null;

  const chartBlock = hasCurve
    ? `<div class="echart-box"><div id="${chartId}" class="tr-chart-slot"></div></div>
      <p class="tr-caption">Base 100 au premier jour du registre. La courbe s'arrête au jour du dernier trade scellé. Elle n'est pas prolongée par la valorisation des positions encore ouvertes.</p>`
    : `<p class="tr-empty">Pas encore de courbe : ce carnet n'a aucun trade clôturé et scellé à ce jour. Rien n'est affiché à la place.</p>`;

  const oosLine = (m.oosWarn && m.oosWarn.oosTrades)
    ? `<p class="tr-warn"><i class="fa-solid fa-triangle-exclamation"></i>
        Hors échantillon, ce carnet se dégrade : réussite ${num(m.oosWarn.isWR, 1)} % → ${num(m.oosWarn.oosWR, 1)} %,
        facteur de profit ${num(m.oosWarn.isPF, 2)}× → ${num(m.oosWarn.oosPF, 2)}× sur ${m.oosWarn.oosTrades} trades.
        Les chiffres d'ensemble ci-dessus intègrent une part ajustée après coup : lisez-les comme un plafond, pas comme une attente.</p>`
    : '';

    const secondary = m.sealed
      ? `<p class="tr-secondary">Sharpe ${num(s.sharpe, 2)} · Calmar ${num(s.calmar, 2)} · ` +
        `${m.config.portfolioSize} ligne${m.config.portfolioSize > 1 ? 's' : ''} · horizon ${m.config.horizon} séances</p>`
      : `<p class="tr-secondary">${m.config.portfolioSize} ligne${m.config.portfolioSize > 1 ? 's' : ''} · horizon ${m.config.horizon} séances</p>`;

  return `
    <div id="mode-${m.id}" class="content-card tr-mode" style="border-top: 4px solid ${esc(m.color)}">
      <div class="tr-mode-head">
        <h2>${esc(m.label)}</h2>
        <span class="tr-asof">${asOf ? `Arrêté au ${esc(asOf)}` : 'Registre vide'}</span>
      </div>
      <p class="tr-blurb">${esc(m.blurb)}</p>
      <div class="tr-metrics">
        ${metrics}
      </div>
      ${secondary}
      ${chartBlock}
      ${oosLine}
      <p class="tr-period">${from && asOf
        ? `Période couverte : du ${esc(from)} au ${esc(asOf)}${m.sampleDays ? `, soit ${m.sampleDays} jours` : ''}.`
        : `Période couverte : aucune${m.since && frDate(m.since.slice(0, 10)) ? `, ce carnet a ouvert le ${esc(frDate(m.since.slice(0, 10)))}` : ', ce carnet vient d\'ouvrir'}.`}</p>
    </div>`;
}

function buildHTML(modes, snap) {
  const asOfGlobal = frDate(snap && snap.date) || frDate(modes.map(m => m.periodEnd).filter(Boolean).sort().pop());
  const sealedModes = modes.filter(m => m.sealed);

  // ── Prose de la section « limites », adossée aux données pour ne pas dériver ──
  // Aucune statistique n'est produite ici : on lit une date d'ouverture, on compte
  // les avertissements déjà présents dans les fichiers, on cite un carnet existant.
  const inception = frDate(
    modes.map(m => m.periodStart).filter(Boolean).sort()[0]
    || (modes.map(m => (m.since || '').slice(0, 10)).filter(Boolean).sort()[0] || null)
  );
  const degraded = sealedModes.filter(m => m.oosWarn && m.oosWarn.oosTrades);
  const degradedLine = degraded.length
    ? `${degraded.length === 1 ? 'Un carnet porte' : `${['', '', 'Deux', 'Trois', 'Quatre', 'Cinq'][degraded.length] || degraded.length} carnets portent`} une dégradation hors
       échantillon signalée plus haut (${degraded.map(m => esc(m.label)).join(', ')}). Elle est affichée parce
       qu'elle existe, pas parce qu'elle arrange : la partie de l'historique postérieure au dernier réglage est
       systématiquement la plus sincère, et c'est celle-là qu'il faut regarder en premier.`
    : `Aucun carnet ne porte aujourd'hui d'avertissement de dégradation hors échantillon. Cela ne vaut pas
       promesse : la partie de l'historique postérieure au dernier réglage reste la plus sincère, et c'est
       celle-là qu'il faut regarder en premier.`;
  // Illustration WR vs PF : on cite le carnet scellé au plus faible taux de réussite,
  // face au plus élevé. Les deux chiffres sont recopiés, aucun n'est dérivé.
  const byWR = [...sealedModes].filter(m => m.stats.wr != null && m.stats.pf).sort((a, b) => a.stats.wr - b.stats.wr);
  const lowWR = byWR[0] || null;
  const highWR = byWR.length > 1 ? byWR[byWR.length - 1] : null;
  const wrPfLine = (lowWR && highWR)
    ? `Le taux de réussite se lit avec le facteur de profit, jamais seul. ${esc(lowWR.label)} gagne
       ${num(lowWR.stats.wr, 1)} % de ses trades et affiche ${num(lowWR.stats.ret)} % cumulés ;
       ${esc(highWR.label)} en gagne ${num(highWR.stats.wr, 1)} % pour ${num(highWR.stats.ret)} %.
       C'est la taille du gain moyen face à la perte moyenne qui décide, pas la fréquence.`
    : `Le taux de réussite se lit avec le facteur de profit, jamais seul : c'est la taille du gain moyen
       face à la perte moyenne qui décide, pas la fréquence des trades gagnants.`;

  const fabItems = [
    ['lecture', 'fa-file-signature', 'Ce que vous lisez'],
    ...modes.map(m => [`mode-${m.id}`, 'fa-chart-line', m.label]),
    ['limites', 'fa-triangle-exclamation', 'Limites'],
    ['verifier', 'fa-magnifying-glass', 'Vérifier'],
  ].map(([id, icon, label]) =>
    `            <a href="#${id}" class="fnav-item" data-section="${id}"><i class="fa-solid ${icon}"></i><span>${esc(label)}</span></a>`
  ).join('\n');

  const chartData = modes.filter(m => m.sealed && m.curve.length >= 2).map(m => ({
    id: `tr-chart-${m.id}`,
    label: m.label,
    color: m.color,
    d: m.curve.map(p => p.date.slice(5).replace('-', '/')),
    v: m.curve.map(p => p.value),
  }));

  return `<!DOCTYPE html>
<html lang="fr" data-tags="tech,technique,retrospective,education" data-tab="tech">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Track record scellé : les carnets, chiffres figés | DailyTickers</title>
    <meta name="description"
        content="Les performances des carnets publics, recopiées d'un registre scellé en ajout seul : trades clôturés, taux de réussite, facteur de profit, rendement, pire repli. Aucun chiffre recalculé pour l'affichage.">
    <meta property="og:title" content="Track record scellé : les carnets, chiffres figés">
    <meta property="og:description"
        content="Trades clôturés, taux de réussite, facteur de profit, rendement, pire repli : recopiés d'un registre scellé, jamais recalculés pour la page.">
    <meta property="og:image" content="/logo.svg">
    <meta property="og:url" content="https://articles.dailytickers.com/tech/track-record/">
    <meta property="og:type" content="article">
    <meta name="twitter:card" content="summary_large_image">
    <!-- Google Tag Manager -->
    <script>(function (w, d, s, l, i) {
            w[l] = w[l] || []; w[l].push({
                'gtm.start':
                    new Date().getTime(), event: 'gtm.js'
            }); var f = d.getElementsByTagName(s)[0],
                j = d.createElement(s), dl = l != 'dataLayer' ? '&l=' + l : ''; j.async = true; j.src =
                    'https://www.googletagmanager.com/gtm.js?id=' + i + dl; f.parentNode.insertBefore(j, f);
        })(window, document, 'script', 'dataLayer', 'GTM-T5Z595CW');</script>
    <!-- End Google Tag Manager -->
    <link rel="icon" href="/favicon.ico">
    <link rel="stylesheet" href="/assets/report.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
    <style>
        .hero-section {
            padding: 5rem 2rem 8rem 2rem;
            background: linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%);
            text-align: center;
            border-bottom: 1px solid #cbd5e1;
        }

        .hero-date {
            font-size: 0.85rem;
            font-weight: 800;
            color: #334155;
            text-transform: uppercase;
            letter-spacing: 0.15em;
            margin-bottom: 1rem;
        }

        .hero-title {
            font-size: 3rem;
            font-weight: 900;
            color: #0f172a;
            margin: 1rem 0;
            letter-spacing: -0.03em;
            line-height: 1.1;
        }

        .hero-sub {
            font-size: 1.15rem;
            color: #334155;
            max-width: 720px;
            margin: 0 auto 2rem;
            line-height: 1.65;
        }

        .hero-badges {
            display: flex;
            justify-content: center;
            gap: 0.6rem;
            flex-wrap: wrap;
            margin-bottom: 1.5rem;
        }

        .hero-badge {
            background: rgba(255, 255, 255, 0.85);
            border: 1px solid #cbd5e1;
            border-radius: 99px;
            padding: 0.35rem 0.9rem;
            font-size: 0.8rem;
            font-weight: 700;
            color: #334155;
        }

        .tr-mode-head {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            gap: 1rem;
            flex-wrap: wrap;
        }

        .tr-mode-head h2 {
            margin: 0;
        }

        .tr-asof {
            font-size: 0.78rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #475569;
            background: #f1f5f9;
            border: 1px solid #e2e8f0;
            border-radius: 99px;
            padding: 0.3rem 0.8rem;
            white-space: nowrap;
        }

        .tr-blurb {
            color: #475569;
            margin: 0.6rem 0 1.4rem;
        }

        .tr-metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 0.75rem;
            margin-bottom: 1rem;
        }

        .tr-metric {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 0.85rem 0.6rem;
            text-align: center;
        }

        .tr-metric-value {
            font-family: var(--mono);
            font-variant-numeric: tabular-nums;
            font-size: 1.35rem;
            font-weight: 800;
            color: #0f172a;
            line-height: 1.2;
        }

        .tr-metric-label {
            font-size: 0.7rem;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: #64748b;
            font-weight: 700;
            margin-top: 0.3rem;
        }

        .tr-pos {
            color: #15803d;
        }

        .tr-neg {
            color: #b91c1c;
        }

        .tr-flat {
            color: #475569;
        }

        .tr-chart-slot {
            width: 100%;
            height: 300px;
        }

        .tr-caption,
        .tr-period,
        .tr-secondary {
            font-size: 0.82rem;
            color: #64748b;
            margin: 0.5rem 0 0;
        }

        .tr-secondary {
            font-family: var(--mono);
            font-variant-numeric: tabular-nums;
            margin-bottom: 1rem;
        }

        .tr-warn {
            background: #fef3c7;
            border-left: 4px solid #d97706;
            border-radius: 0 10px 10px 0;
            padding: 0.9rem 1.1rem;
            font-size: 0.9rem;
            color: #78350f;
            margin: 1.2rem 0 0;
        }

        .tr-empty {
            background: #f1f5f9;
            border-radius: 12px;
            padding: 1.5rem;
            text-align: center;
            color: #475569;
            font-size: 0.92rem;
        }

        .tr-seal {
            border-left: 4px solid var(--accent);
            padding-left: 1.1rem;
            margin: 1.5rem 0;
        }

        .tr-seal li {
            margin-bottom: 0.55rem;
            color: #334155;
        }

        @media (max-width: 640px) {
            .hero-title {
                font-size: 2.1rem;
            }

            .content-card {
                padding: 1.5rem;
            }

            .tr-metric-value {
                font-size: 1.1rem;
            }
        }
    </style>
</head>

<body>
    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-T5Z595CW" height="0" width="0"
            style="display:none;visibility:hidden"></iframe></noscript>

    <nav class="brand-bar">
        <div class="brand-bar-inner">
            <a href="/" class="brand-logo">
                <img src="/logo.svg" alt="" width="36" height="36">
                <span class="brand-title">DailyTickers</span>
            </a>
            <div class="brand-nav">
                <a href="/?tab=weekly">Hebdo</a>
                <a href="/?tab=daily">Daily</a>
                <a href="/?tab=analyses">Analyses</a>
                <a href="/?tab=scanner">Scanner</a>
                <a href="/?tab=radar">Radar</a>
                <a href="/?tab=series">Séries</a>
            </div>
            <div class="brand-actions">
                <a href="/" class="brand-home-btn" title="Accueil"><i class="fas fa-house"></i></a>
            </div>
        </div>
    </nav>

    <header class="hero-section">
        <div class="hero-date">TRACK RECORD SCELLÉ</div>
        <h1 class="hero-title">Les chiffres, tels qu'ils ont été figés</h1>
        <p class="hero-sub">
            Chaque carnet public tient un registre en ajout seul. Un trade clôturé y reçoit une
            empreinte et n'en ressort plus. Cette page ne fait que recopier ces registres :
            ni recalcul, ni arrondi favorable, ni période choisie après coup.
        </p>
        <div class="hero-badges">
            <div class="hero-badge"><i class="fa-solid fa-lock"></i> ${sealedModes.length} carnet${sealedModes.length > 1 ? 's' : ''} scellé${sealedModes.length > 1 ? 's' : ''}</div>
            <div class="hero-badge"><i class="fa-solid fa-calendar-check"></i> ${asOfGlobal ? `Au ${esc(asOfGlobal)}` : 'Date en attente'}</div>
            <div class="hero-badge"><i class="fa-solid fa-rotate"></i> Mis à jour chaque séance</div>
        </div>
        <div id="article-clickable-tags" class="card-tags"></div>
    </header>

    <div class="container">

        <div id="lecture" class="content-card">
            <h2><i class="fa-solid fa-file-signature"></i> Ce que vous lisez</h2>
            <p>Une performance affichée ne vaut que par ce qu'on s'interdit d'en faire. Ici,
                trois interdits tiennent toute la page.</p>
            <ol class="tr-seal">
                <li>Un trade clôturé entre dans un registre en ajout seul, avec une empreinte
                    SHA-256 qui intègre celle de l'entrée précédente : retoucher une ligne
                    ancienne casse toute la chaîne, et la routine de mise à jour s'arrête.</li>
                <li>Les agrégats de cette page (trades clôturés, taux de réussite, facteur de
                    profit, rendement cumulé, pire repli) sont recopiés depuis ces registres
                    scellés, jamais recalculés au moment d'afficher la page.</li>
                <li>Les positions encore ouvertes ne comptent pas. Aucune plus-value latente
                    n'est fondue dans le rendement affiché, et aucune courbe n'est prolongée
                    jusqu'à aujourd'hui pour faire joli.</li>
            </ol>
            <p>Conséquence directe : ces chiffres bougent moins vite que le marché. La courbe
                d'un carnet s'arrête au jour de son dernier trade scellé, pas à la séance
                d'hier. C'est le prix d'un historique qu'on ne peut pas réécrire.</p>
        </div>

${modes.map(modeCard).join('\n')}

        <div id="limites" class="content-card">
            <h2><i class="fa-solid fa-triangle-exclamation"></i> Ce que ces chiffres ne disent pas</h2>
            <p>Le plus ancien registre commence ${inception ? `le ${esc(inception)}` : 'en 2026'}. Aucun carnet
                n'a traversé un marché baissier comparable à 2022 ou à mars 2020. Un rendement obtenu
                dans un marché porteur ne prouve pas la résistance en marché cassant : il prouve
                seulement qu'on n'a pas raté le marché porteur.</p>
            <p>${wrPfLine}</p>
            <p>${degradedLine}</p>
        </div>

        <div id="verifier" class="content-card">
            <h2><i class="fa-solid fa-magnifying-glass"></i> Vérifier soi-même</h2>
            <p>Les mêmes chiffres sont servis en accès libre, au format machine, avec la liste
                des trades et la courbe de chaque carnet.</p>
            <ul class="tr-seal">
                <li><a href="/portfolio/v1/status.json">Statut des carnets</a> : état, date d'ouverture,
                    raison du dernier changement.</li>
                <li><a href="/portfolio/v1/turbo/equity.json">Courbe et agrégats par carnet</a> :
                    remplacez <code>turbo</code> par le nom du carnet voulu.</li>
                <li><a href="/portfolio/v1/trades.json">Trades</a> : chaque ligne clôturée, avec
                    sa date d'entrée, sa sortie et son résultat.</li>
                <li><a href="/scanner/status/">Tableau de bord des carnets</a> : la vue jour par jour,
                    positions ouvertes comprises, séparée des chiffres scellés.</li>
            </ul>
            <p>Un écart entre cette page et ces fichiers est un défaut, pas une nuance de
                présentation. Il se signale.</p>
        </div>

    </div>

    <div class="fnav" id="floatingNav">
        <div class="fnav-menu" id="fnavMenu">
${fabItems}
        </div>
        <button class="fnav-btn" id="fnavBtn" type="button" aria-label="Navigation">
            <i class="fas fa-bars" id="fnavIcon"></i>
            <span class="fnav-btn-label" id="fnavLabel">Menu</span>
        </button>
    </div>

    <footer class="article-footer">
        &copy; 2026 DailyTickers. Ceci n'est pas un conseil financier.
        <br><a href="/" title="Accueil"><i class="fas fa-house"></i></a>
    </footer>

    <script src="/assets/core.js"></script>
    <script src="/assets/tag-renderer.js"></script>

    <script>
        (function () {
            var CURVES = ${JSON.stringify(chartData)};
            CURVES.forEach(function (c) {
                var el = document.getElementById(c.id);
                if (!el || !window.echarts) return;
                var chart = echarts.init(el);
                chart.setOption({
                    animation: false,
                    tooltip: {
                        trigger: 'axis',
                        valueFormatter: function (v) { return v.toFixed(2).replace('.', ','); }
                    },
                    grid: { left: 58, right: 24, bottom: 42, top: 24 },
                    xAxis: {
                        type: 'category',
                        data: c.d,
                        boundaryGap: false,
                        axisLabel: { color: '#64748b', fontSize: 11 },
                        axisTick: { show: false }
                    },
                    yAxis: {
                        type: 'value',
                        scale: true,
                        splitLine: { lineStyle: { color: '#e2e8f0' } },
                        axisLabel: { color: '#64748b', fontSize: 11 }
                    },
                    series: [{
                        name: c.label,
                        type: 'line',
                        data: c.v,
                        smooth: false,
                        showSymbol: false,
                        lineStyle: { width: 2, color: c.color },
                        itemStyle: { color: c.color },
                        areaStyle: {
                            color: {
                                type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                                colorStops: [
                                    { offset: 0, color: c.color + '44' },
                                    { offset: 1, color: c.color + '05' }
                                ]
                            }
                        },
                        markLine: {
                            silent: true,
                            symbol: 'none',
                            data: [{ yAxis: 100 }],
                            lineStyle: { color: '#94a3b8', type: 'dashed', width: 1 },
                            label: { show: false }
                        }
                    }]
                });
                window.addEventListener('resize', function () { chart.resize(); });
            });
        })();
    </script>
    <script src="/assets/echarts-responsive.js"></script>
</body>

</html>
`;
}

// ─── Entrée programmatique ───────────────────────────────────────────────────
function generate(opts = {}) {
  const outPath = opts.out || OUT_DEFAULT;
  const modes = collectModes();
  if (!modes.length) throw new Error('aucun carnet live publiable — page non écrite');
  const snap = latestSnapshot();
  const html = buildHTML(modes, snap);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html);
  return {
    path: path.relative(ROOT, outPath),
    modes: modes.length,
    sealed: modes.filter(m => m.sealed).length,
    asOf: (snap && snap.date) || null,
    bytes: Buffer.byteLength(html),
    detail: modes.map(m => ({ id: m.id, sealed: m.sealed, trades: m.stats.trades, ret: m.stats.ret, asOf: m.periodEnd })),
  };
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const oi = argv.indexOf('--out');
  const out = oi >= 0 ? path.resolve(ROOT, argv[oi + 1]) : null;
  try {
    const r = generate({ out });
    if (argv.includes('--json')) {
      console.log(JSON.stringify(r, null, 2));
    } else {
      console.log(`✅ ${r.path} généré (${(r.bytes / 1024).toFixed(0)}KB) — ${r.modes} carnets, ${r.sealed} scellés`);
      for (const d of r.detail) {
        console.log(`   ${d.id.padEnd(9)} ${d.sealed ? String(d.trades).padStart(4) + ' trades' : '   registre vide'}` +
          `${d.sealed ? `, ${d.ret > 0 ? '+' : ''}${d.ret}%` : ''}${d.asOf ? ` (au ${d.asOf})` : ''}`);
      }
    }
  } catch (e) {
    console.error(`❌ gen-track-record: ${e.message}`);
    process.exit(1);
  }
}

module.exports = { generate, collectModes };
