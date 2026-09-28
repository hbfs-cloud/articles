#!/usr/bin/env node
'use strict';
/*
 * etf-fiche.cjs — générateur de fiches ETF UCITS (hors harnais company v3).
 *
 * CONTEXTE : les ETF UCITS européens sont hors couverture des données marché
 * internes (US-only) et n'ont NI fondamentaux société NI dépôts SEC. Le harnais
 * de preuve « company v3 » (us-gaap / XBRL / blast-radius de pairs) ne s'applique
 * donc PAS. Cette fiche repose sur des DONNÉES PUBLIQUES sourcées :
 *   - justETF (profil par ISIN)        → indice, TER, encours, réplication,
 *                                         distribution, domicile, composition,
 *                                         performances, volatilité
 *   - factsheet / KIID de l'émetteur   → recoupement TER / holdings
 *   - Yahoo Finance (par ticker)       → dernier cours, bornes 52 semaines
 *
 * Chaque donnée porte une source-ref inline datée. Aucune valeur inventée :
 * une donnée absente est marquée « indisponible ».
 *
 * API : buildHtml(data) -> string HTML complet.
 *       buildCard(data) -> objet JSON minimal pour data/analyses-data/<T>.json
 *
 * Le schéma de `data` est documenté dans tools/templates/etf-fiche.md.
 */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ESC[c]); }

// Bloc source-ref inline (lien daté vers la source publique).
function ref(url, name, date) {
  return `<a href="${esc(url)}" class="source-ref" target="_blank" rel="noopener">` +
    `<i class="fa-solid fa-arrow-up-right-from-square source-icon"></i>` +
    `<span class="source-name">${esc(name)}</span>` +
    `<span class="source-date">&middot; ${esc(date)}</span></a>`;
}
function refBlock(refs) {
  return `<div class="source-refs" style="display:flex;flex-wrap:wrap;gap:0.5rem 1rem;margin-top:0.75rem;padding-top:0.5rem;border-top:1px solid #e2e8f0;">` +
    refs.map(r => ref(r.url, r.name, r.date)).join('') + `</div>`;
}

const SEV = {
  high:   { cls: 'risk-card-high',     label: 'Élevé',  icon: 'fa-triangle-exclamation' },
  medium: { cls: 'risk-card-medium',   label: 'Moyen',  icon: 'fa-circle-info' },
  low:    { cls: 'risk-card-low',      label: 'Faible', icon: 'fa-circle-check' },
};

function riskCard(r) {
  const s = SEV[r.sev] || SEV.medium;
  return `<div class="risk-card ${s.cls}">
      <div class="risk-card-header">
        <div class="risk-card-icon"><i class="fa-solid ${esc(r.icon || s.icon)}"></i></div>
        <h4>${esc(r.title)}</h4>
        <span class="risk-severity">${s.label}</span>
      </div>
      <div class="risk-card-body"><p>${r.body}</p></div>
      <div class="risk-verdict"><i class="fa-solid ${s.icon}"></i> ${esc(r.verdict)}</div>
    </div>`;
}

function tableRows(rows, cols) {
  return rows.map(row => '<tr>' + cols.map(c => `<td>${row[c] == null ? '<span style="color:#94a3b8;">indisponible</span>' : row[c]}</td>`).join('') + '</tr>').join('');
}

function buildHtml(d) {
  const je = d.sources.justetf;
  const ya = d.sources.yahoo;
  const iss = d.sources.issuer;

  // FNAV
  const fnav = [
    ['verdict', 'fa-gavel', 'Verdict'],
    ['mandat', 'fa-bullseye', 'Mandat & indice'],
    ['composition', 'fa-layer-group', 'Composition'],
    ['performance', 'fa-chart-line', 'Performance'],
    ['couts', 'fa-coins', 'Coûts & structure'],
    ['technique', 'fa-chart-area', 'Technique'],
    ['risques', 'fa-shield-halved', 'Risques'],
    ['portefeuille', 'fa-scale-balanced', 'Rôle'],
    ['sources', 'fa-book', 'Sources'],
  ].map(([id, ic, lb]) => `<a href="#${id}" class="fnav-item" data-section="${id}"><i class="fas ${ic}"></i><span>${lb}</span></a>`).join('');

  const top10Rows = d.top10.map((h, i) => ({
    n: `<td style="text-align:right;color:#94a3b8;">${i + 1}</td>`,
  }));
  // build holdings table manually to include rank
  const holdingsTable = d.top10.map((h, i) =>
    `<tr><td style="color:#94a3b8;">${i + 1}</td><td>${esc(h.name)}</td><td style="text-align:right;font-weight:600;">${esc(h.weight)}</td></tr>`).join('');

  const sectorTable = d.sectors.map(s =>
    `<tr><td>${esc(s.name)}</td><td style="text-align:right;font-weight:600;">${esc(s.pct)}</td></tr>`).join('');

  const countryTable = d.countries.map(c =>
    `<tr><td>${esc(c.name)}</td><td style="text-align:right;font-weight:600;">${esc(c.pct)}</td></tr>`).join('');

  // ECharts data arrays
  const sectorNames = JSON.stringify(d.sectorsChart.map(s => s.name));
  const sectorVals = JSON.stringify(d.sectorsChart.map(s => s.value));
  const holdNames = JSON.stringify(d.holdingsChart.map(h => h.name).reverse());
  const holdVals = JSON.stringify(d.holdingsChart.map(h => h.value).reverse());
  const perfLabels = JSON.stringify(['YTD', '1 an', '3 ans']);
  const perfVals = JSON.stringify(d.perfChart);

  const metrics = [
    ['ter', d.ter, 'Frais courants (TER)'],
    ['aum', d.aum, 'Encours du fonds'],
    ['index', d.indexShort, 'Indice répliqué'],
    ['replication', d.replication, 'Réplication'],
    ['distribution', d.distribution, 'Distribution'],
    ['domicile', d.domicile, 'Domicile'],
  ].map(([k, v, lb]) => `<div class="ticker-metric"><div class="tm-value">${esc(v)}</div><div class="tm-label">${esc(lb)}</div></div>`).join('\n            ');

  const badges = d.badges.map(b => `<span class="badge badge-${esc(b.color)}">${esc(b.text)}</span>`).join('\n            ');

  return `<!DOCTYPE html>
<html lang="fr" data-tags="${esc(d.dataTags)}" data-tab="analyses" data-grade="${esc(d.grade)}" data-level="intermediate">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DailyTickers | Fiche ETF ${esc(d.ticker)} (${esc(d.name)}) | ${esc(d.dateDisplay)}</title>
    <meta name="description" content="${esc(d.metaDescription)}">
    <meta property="og:title" content="DailyTickers — Fiche ETF ${esc(d.ticker)}">
    <meta property="og:description" content="${esc(d.ogDescription)}">
    <meta property="og:image" content="https://articles.dailytickers.com/logo.svg">
    <meta property="og:type" content="article">
    <meta property="og:url" content="https://articles.dailytickers.com/analyses/${esc(d.ticker)}/">
    <script>(function (w, d, s, l, i) { w[l] = w[l] || []; w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' }); var f = d.getElementsByTagName(s)[0], j = d.createElement(s), dl = l != 'dataLayer' ? '&l=' + l : ''; j.async = true; j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl; f.parentNode.insertBefore(j, f); })(window, document, 'script', 'dataLayer', 'GTM-T5Z595CW');</script>
    <link rel="icon" href="/favicon.ico">
    <link rel="stylesheet" href="/assets/report.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
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

    <!-- HEADER -->
    <div class="ticker-header">
        <a href="/"
            style="display:inline-flex;align-items:center;gap:10px;margin-bottom:1.5rem;text-decoration:none;color:#0f172a;font-weight:800;font-size:1.1rem;"><img
                src="/logo.svg" alt="MW" style="height:28px;"> MARKET WATCH</a>
        <div class="ticker-symbol">${esc(d.ticker)}</div>
        <div class="ticker-name">${esc(d.name)} &mdash; ${esc(d.exchange)} &bull; ISIN ${esc(d.isin)} &bull; ${esc(d.tradingCurrency)}</div>
        <div class="ticker-price">${esc(d.price)} <span style="font-size:1.05rem;color:${d.changeColor};">${esc(d.changeLabel)}</span></div>
        <div class="ticker-metrics">
            ${metrics}
        </div>
        <div style="display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;margin-top:1.25rem;">
            ${badges}
        </div>
        <div id="article-clickable-tags" class="card-tags" style="margin-top:1.5rem; display:flex; justify-content:center;"></div>
        <div style="margin-top:0.5rem;font-size:0.8rem;color:#64748b;">
            ${esc(d.dateDisplay)} &bull; Données publiques (émetteur, justETF, Yahoo Finance), hors circuit de certification interne
        </div>
    </div>

    <!-- LIEN GRAPHE YAHOO -->
    <div style="max-width:900px;margin:0 auto;padding:0 1rem;">
        <a href="${esc(ya.url)}" target="_blank" rel="noopener"
            style="display:flex;align-items:center;justify-content:space-between;gap:1rem;border:1px solid #e2e8f0;border-radius:12px;padding:0.9rem 1.1rem;text-decoration:none;color:#0f172a;transition:0.2s;"
            onmouseover="this.style.borderColor='#3b82f6'" onmouseout="this.style.borderColor='#e2e8f0'">
            <span style="font-weight:600;font-size:0.9rem;"><i class="fa-solid fa-chart-line" style="color:#3b82f6;margin-right:6px;"></i> Graphe interactif et historique complet</span>
            <span style="font-size:0.78rem;color:#64748b;">Yahoo Finance &middot; ${esc(d.yahooTicker)} <i class="fa-solid fa-arrow-up-right-from-square"></i></span>
        </a>
    </div>

    <div class="container">

<!-- VERDICT -->
        <div id="verdict" class="content-card">
            <h2><i class="fa-solid fa-gavel" style="color:#3b82f6;"></i> Verdict express</h2>
            <div class="alert-box" style="margin-bottom:1rem;"><strong>${esc(d.verdict.label)}.</strong> ${d.verdict.summary}</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem;">
                <div class="verdict-pro">
                    <h4 style="margin-top:0;">Ce que la fiche valide</h4>
                    <ul>${d.verdict.pros.map(p => `<li>${p}</li>`).join('')}</ul>
                </div>
                <div class="verdict-con">
                    <h4 style="margin-top:0;">Ce qu'il faut accepter</h4>
                    <ul>${d.verdict.cons.map(c => `<li>${c}</li>`).join('')}</ul>
                </div>
            </div>
            <div class="pedagogy-box" style="margin-top:1rem;"><strong>Pour qui.</strong> ${d.verdict.forWho}</div>
            ${refBlock(d.verdict.refs)}
        </div>

<!-- MANDAT -->
        <div id="mandat" class="content-card">
            <h2><i class="fa-solid fa-bullseye" style="color:#3b82f6;"></i> Mandat &amp; indice</h2>
            ${d.mandat.body}
            <table class="data-table" style="margin-top:1rem;">
                <tbody>
                    <tr><td style="font-weight:600;">Indice</td><td>${esc(d.index)}</td></tr>
                    <tr><td style="font-weight:600;">Nombre de composants</td><td>${esc(d.holdingsCount)}</td></tr>
                    <tr><td style="font-weight:600;">Devise du fonds</td><td>${esc(d.fundCurrency)}</td></tr>
                    <tr><td style="font-weight:600;">Date de lancement</td><td>${esc(d.launchDate)}</td></tr>
                </tbody>
            </table>
            ${refBlock(d.mandat.refs)}
        </div>

<!-- COMPOSITION -->
        <div id="composition" class="content-card">
            <h2><i class="fa-solid fa-layer-group" style="color:#3b82f6;"></i> Composition</h2>
            <p>${d.composition.intro}</p>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1.5rem;margin-top:1rem;">
                <div>
                    <h4>10 premières lignes</h4>
                    <table class="data-table">
                        <thead><tr><th>#</th><th>Ligne</th><th style="text-align:right;">Poids</th></tr></thead>
                        <tbody>${holdingsTable}</tbody>
                    </table>
                </div>
                <div>
                    <div id="holdingsChart" style="width:100%;height:340px;"></div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1.5rem;margin-top:1.5rem;">
                <div>
                    <h4>Répartition sectorielle</h4>
                    <table class="data-table">
                        <thead><tr><th>Secteur</th><th style="text-align:right;">Poids</th></tr></thead>
                        <tbody>${sectorTable}</tbody>
                    </table>
                </div>
                <div>
                    <h4>Répartition géographique</h4>
                    <table class="data-table">
                        <thead><tr><th>Pays</th><th style="text-align:right;">Poids</th></tr></thead>
                        <tbody>${countryTable}</tbody>
                    </table>
                </div>
            </div>
            <div id="sectorChart" style="width:100%;height:320px;margin-top:1.5rem;"></div>
            <div class="pedagogy-box" style="margin-top:1rem;">${d.composition.note}</div>
            ${refBlock(d.composition.refs)}
        </div>

<!-- PERFORMANCE -->
        <div id="performance" class="content-card">
            <h2><i class="fa-solid fa-chart-line" style="color:#3b82f6;"></i> Performance &amp; suivi d'indice</h2>
            <table class="data-table">
                <thead><tr><th>Horizon</th><th style="text-align:right;">Performance (net de frais)</th></tr></thead>
                <tbody>
                    <tr><td>Depuis le 1ᵉʳ janvier</td><td style="text-align:right;font-weight:600;">${esc(d.perf.ytd)}</td></tr>
                    <tr><td>1 an</td><td style="text-align:right;font-weight:600;">${esc(d.perf.y1)}</td></tr>
                    <tr><td>3 ans (cumulé)</td><td style="text-align:right;font-weight:600;">${esc(d.perf.y3)}</td></tr>
                    <tr><td>Depuis le lancement</td><td style="text-align:right;font-weight:600;">${esc(d.perf.since)}</td></tr>
                    <tr><td>Volatilité (1 an)</td><td style="text-align:right;">${esc(d.perf.vol)}</td></tr>
                </tbody>
            </table>
            <div id="perfChart" style="width:100%;height:300px;margin-top:1.25rem;"></div>
            <div class="pedagogy-box" style="margin-top:1rem;">${d.perf.note}</div>
            ${refBlock(d.perf.refs)}
        </div>

<!-- COUTS -->
        <div id="couts" class="content-card">
            <h2><i class="fa-solid fa-coins" style="color:#3b82f6;"></i> Coûts &amp; structure</h2>
            <table class="data-table">
                <tbody>
                    <tr><td style="font-weight:600;">Frais courants (TER)</td><td>${esc(d.ter)} par an</td></tr>
                    <tr><td style="font-weight:600;">Méthode de réplication</td><td>${esc(d.replicationLong)}</td></tr>
                    <tr><td style="font-weight:600;">Politique de distribution</td><td>${esc(d.distributionLong)}</td></tr>
                    <tr><td style="font-weight:600;">Domicile / enveloppe</td><td>${esc(d.domicileLong)}</td></tr>
                    <tr><td style="font-weight:600;">Prêt de titres</td><td>${d.securitiesLending}</td></tr>
                </tbody>
            </table>
            <div class="pedagogy-box" style="margin-top:1rem;">${d.couts.note}</div>
            ${refBlock(d.couts.refs)}
        </div>

<!-- TECHNIQUE -->
        <div id="technique" class="content-card">
            <h2><i class="fa-solid fa-chart-area" style="color:#3b82f6;"></i> Repères techniques</h2>
            <div class="alert-box" style="margin-bottom:1rem;background:#fffbeb;border-color:#fcd34d;color:#78350f;">
                <strong>Avertissement.</strong> Cours et bornes ci-dessous relevés sur Yahoo Finance, non certifiés en interne. À prendre comme repères, pas comme niveaux de référence.
            </div>
            <table class="data-table">
                <tbody>
                    <tr><td style="font-weight:600;">Dernier cours (${esc(d.yahooTicker)})</td><td>${esc(d.tech.last)}</td></tr>
                    <tr><td style="font-weight:600;">Plus bas 52 semaines</td><td>${esc(d.tech.low52)}</td></tr>
                    <tr><td style="font-weight:600;">Plus haut 52 semaines</td><td>${esc(d.tech.high52)}</td></tr>
                    <tr><td style="font-weight:600;">Position dans le canal 52 s.</td><td>${esc(d.tech.pos)}</td></tr>
                    <tr><td style="font-weight:600;">Tendance</td><td>${esc(d.tech.trend)}</td></tr>
                </tbody>
            </table>
            <div class="pedagogy-box" style="margin-top:1rem;">${d.tech.note}</div>
            ${refBlock(d.tech.refs)}
        </div>

<!-- RISQUES -->
        <div id="risques" class="content-card">
            <h2><i class="fa-solid fa-shield-halved" style="color:#3b82f6;"></i> Risques</h2>
            <div class="risk-grid">
                ${d.risks.map(riskCard).join('\n                ')}
            </div>
            <div class="pedagogy-box" style="margin-top:1rem;">${d.risksNote}</div>
        </div>

<!-- ROLE PORTEFEUILLE -->
        <div id="portefeuille" class="content-card">
            <h2><i class="fa-solid fa-scale-balanced" style="color:#3b82f6;"></i> Rôle en portefeuille</h2>
            ${d.role.body}
            ${refBlock(d.role.refs)}
        </div>

<!-- SOURCES -->
        <div id="sources" class="content-card">
            <h2><i class="fa-solid fa-book" style="color:#3b82f6;"></i> Sources</h2>
            <p>Fiche construite sur données publiques. Aucun chiffre estimé : une donnée absente est marquée « indisponible ».</p>
            <ul>
                <li><strong>justETF</strong> — profil de l'ISIN : indice, frais, encours, réplication, distribution, domicile, composition, performances, volatilité. ${ref(je.url, 'justETF', je.date)}</li>
                <li><strong>Émetteur (${esc(iss.name)})</strong> — factsheet / document d'informations clés, pour recouper frais et composition. ${ref(iss.url, iss.name, iss.date)}</li>
                <li><strong>Yahoo Finance</strong> — dernier cours et bornes 52 semaines de la ligne cotée. ${ref(ya.url, 'Yahoo Finance', ya.date)}</li>
            </ul>
            <p style="font-size:0.8rem;color:#64748b;margin-top:0.75rem;">Cette fiche porte sur un fonds indiciel UCITS européen, hors périmètre des données marché et des dépôts réglementaires société utilisés pour les analyses d'actions américaines. Elle ne passe donc pas le circuit de certification interne réservé aux émetteurs cotés aux États-Unis. Ceci n'est pas un conseil en investissement.</p>
        </div>

    </div>

    <script src="/assets/core.js"></script>

  <footer class="article-footer">
    &copy; 2026 DailyTickers. Données publiques (émetteur, justETF, Yahoo Finance), datées à la source.
    Ceci n'est pas un conseil financier.
    <br><a href="/" title="Accueil"><i class="fas fa-house" style="margin-right:4px;"></i></a>
  </footer>

<div class="fnav" id="floatingNav"><div class="fnav-menu" id="fnavMenu">${fnav}</div><button class="fnav-btn" id="fnavBtn" type="button" aria-label="Navigation"><i class="fas fa-bars" id="fnavIcon"></i><span class="fnav-btn-label" id="fnavLabel">Menu</span></button></div>
<script>
(function() {
  var fab = document.getElementById('fnavBtn');
  var menu = document.getElementById('fnavMenu');
  var icon = document.getElementById('fnavIcon');
  var label = document.getElementById('fnavLabel');
  if (!fab || !menu) return;
  var items = menu.querySelectorAll('.fnav-item');
  var sections = [];
  var isOpen = false;
  items.forEach(function(item) {
    var id = item.getAttribute('data-section');
    var el = document.getElementById(id);
    if (el) sections.push({ id: id, el: el, item: item });
  });
  function toggle() {
    isOpen = !isOpen;
    menu.classList.toggle('open', isOpen);
    fab.classList.toggle('open', isOpen);
    if (icon) icon.className = isOpen ? 'fas fa-xmark' : 'fas fa-bars';
    if (label) label.textContent = isOpen ? 'Fermer' : 'Menu';
  }
  fab.addEventListener('click', function(e) { e.stopPropagation(); toggle(); });
  document.addEventListener('click', function(e) { if (isOpen && !menu.contains(e.target) && !fab.contains(e.target)) toggle(); });
  menu.addEventListener('click', function(e) { var link = e.target.closest('.fnav-item'); if (link && isOpen) toggle(); });
  function onScroll() {
    var y = window.scrollY + 140; var current = null;
    sections.forEach(function(s) { if (s.el.offsetTop <= y) current = s; });
    items.forEach(function(i) { i.classList.remove('active'); });
    if (current) current.item.classList.add('active');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
</script>
<script>
(function() {
  if (typeof echarts === 'undefined') return;
  var accent = '#3b82f6', green = '#16a34a', slate = '#64748b';
  var holdings = echarts.init(document.getElementById('holdingsChart'));
  holdings.setOption({
    title: { text: '10 premières lignes (% du fonds)', left: 'center', textStyle: { fontSize: 13 } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: function(v){ return v + ' %'; } },
    grid: { left: 130, right: 30, top: 40, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { formatter: '{value} %' } },
    yAxis: { type: 'category', data: ${holdNames}, axisLabel: { fontSize: 11 } },
    series: [{ type: 'bar', data: ${holdVals}, itemStyle: { color: accent, borderRadius: [0,4,4,0] } }]
  });
  var sector = echarts.init(document.getElementById('sectorChart'));
  sector.setOption({
    title: { text: 'Répartition sectorielle (%)', left: 'center', textStyle: { fontSize: 13 } },
    tooltip: { trigger: 'item', formatter: '{b} : {c} %' },
    series: [{ type: 'treemap', roam: false, breadcrumb: { show: false }, label: { fontSize: 12, formatter: '{b}\\n{c} %' },
      data: ${sectorNames}.map(function(n, i){ return { name: n, value: ${sectorVals}[i] }; }),
      levels: [{ itemStyle: { borderColor: '#fff', borderWidth: 2, gapWidth: 2 }, color: ['#1d4ed8','#3b82f6','#60a5fa','#93c5fd','#bfdbfe','#dbeafe'] }] }]
  });
  var perf = echarts.init(document.getElementById('perfChart'));
  perf.setOption({
    title: { text: 'Performance nette de frais (%)', left: 'center', textStyle: { fontSize: 13 } },
    tooltip: { trigger: 'axis', valueFormatter: function(v){ return v + ' %'; } },
    grid: { left: 50, right: 30, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: ${perfLabels} },
    yAxis: { type: 'value', axisLabel: { formatter: '{value} %' } },
    series: [{ type: 'bar', data: ${perfVals}, itemStyle: { color: function(p){ return p.value >= 0 ? green : '#dc2626'; }, borderRadius: [4,4,0,0] }, barWidth: '46%',
      label: { show: true, position: 'top', formatter: '{c} %', fontSize: 11 } }]
  });
  window.addEventListener('resize', function() { holdings.resize(); sector.resize(); perf.resize(); });
})();
</script>
<script src="/assets/tag-renderer.js"></script>
</body>
</html>`;
}

function buildCard(d) {
  return {
    meta: {
      lang: 'fr',
      dir: 'ltr',
      level: 'intermediate',
      name: d.name,
      tags: d.tagsList,
      grade: d.grade,
      date: d.date,
      dateDisplay: d.dateDisplay,
      version: 1,
      status: d.status,
      assetType: 'etf',
      levelsCloseDate: d.levelsCloseDate,
      description: d.metaDescription,
      ogDescription: d.ogDescription,
      dataScope: 'public-etf-no-mcp-harness',
    },
    header: {
      ticker: d.ticker,
      name: d.name,
      isin: d.isin,
      exchange: d.exchange,
      yahooTicker: d.yahooTicker,
      currency: d.tradingCurrency,
      price: d.priceNum,
      changePct: d.changePctNum,
      badges: d.badges,
      metrics: {
        ter: d.ter,
        aum: d.aum,
        index: d.indexShort,
        replication: d.replication,
        distribution: d.distribution,
        domicile: d.domicile,
      },
      halalStatus: 'unknown',
    },
    card: {
      title: d.cardTitle,
      subtitle: d.cardSubtitle,
      logo: `https://assets.parqet.com/logos/isin/${d.isin}?format=jpg`,
      url: `/analyses/${d.ticker}/`,
      chartTicker: d.yahooTicker,
    },
  };
}

module.exports = { buildHtml, buildCard, esc };
