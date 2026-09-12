#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const compact = process.argv[2];
if (!/^\d{8}$/.test(compact || '')) {
  console.error('Usage: node tools/render-period-retro.js YYYYMMDD');
  process.exit(2);
}
const dir = path.join(ROOT, 'scanner', 'retrospective', compact);
const results = JSON.parse(fs.readFileSync(path.join(dir, 'retro-results.json'), 'utf8'));
const s = results.summary;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n, digits = 2) => Number.isFinite(n) ? Number(n).toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : 'N/D';
const signed = (n, suffix) => Number.isFinite(n) ? (n > 0 ? '+' : '') + fmt(n) + suffix : 'N/D';
const day = iso => new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso + 'T12:00:00Z'));
const period = 'du ' + day(s.period_start) + ' au ' + day(s.period_end);
const resolvedLabel = s.resolved + ' résultat' + (s.resolved === 1 ? '' : 's') + ' résolu' + (s.resolved === 1 ? '' : 's');
const statusLabel = {
  tp2: 'Objectif 2 atteint', tp1_be: 'Objectif 1 puis seuil de rentabilité', tp1_expired: 'Objectif 1 puis horizon', tp1_pending: 'Objectif 1, reliquat ouvert',
  stopped: 'Stop atteint', expired: 'Horizon atteint', pending: 'Ouvert', no_fill: 'Entrée non exécutée',
  ambiguous: 'Séquence ambiguë', data_error: 'Mesure indisponible', open_unverified: 'Ouvert non vérifié'
};
const reasonLabel = {
  opening_window_missed: 'Fenêtre d’entrée non atteinte',
  incomplete_intraday_15m_coverage: 'Couverture 15 min incomplète',
  horizon_not_elapsed_incomplete_intraday_15m_coverage: 'Horizon non mûr, couverture 15 min incomplète',
  intraday_calendar_not_supported_for_listing: 'Calendrier intraday non certifié pour cette cotation'
};
const reason = value => reasonLabel[value] || (value ? String(value).replaceAll('_', ' ') : '—');
const row = o => '<tr><td>' + esc(o.scan_date) + '</td><td><strong>' + esc(o.ticker) + '</strong></td><td>' + esc(o.strategy) + '</td><td>' + esc(statusLabel[o.status] || o.status) + '</td><td>' + (Number.isFinite(o.effective_entry) ? fmt(o.effective_entry, 4) : 'N/D') + '</td><td>' + (Number.isFinite(o.exit_price) ? fmt(o.exit_price, 4) : 'N/D') + '</td><td>' + signed(o.r_multiple, ' R') + '</td><td>' + signed(o.return_pct, ' %') + '</td><td>' + esc(reason(o.reason)) + '</td></tr>';
const groupRow = x => '<tr><td>' + esc(x.name) + '</td><td>' + x.proposed + '</td><td>' + x.resolved + '</td><td>' + x.pending + '</td><td>' + (x.hit_rate_pct == null ? 'N/D' : fmt(x.hit_rate_pct, 1) + ' %') + '</td><td>' + (x.average_r == null ? 'N/D' : signed(x.average_r, ' R')) + '</td><td>' + (x.profit_factor == null ? 'N/D' : fmt(x.profit_factor)) + '</td></tr>';
const cohortNote = results.cohort
  ? 'Cohorte certifiée : ' + results.cohort.certified_proposals + ' propositions. ' + results.cohort.review_only_records_preserved + ' enregistrements « review only » restent archivés, hors dénominateur de trading.'
  : 'La cohorte provient des sources scanner incluses dans cette période.';
const methodology = 'Les seules propositions évaluées sont les signaux primaires publiés. Pour les cotations US, chaque séance de l’horizon doit contenir les 26 barres régulières de quinze minutes. L’entrée, le stop et les objectifs sont évalués dans l’ordre chronologique de ces barres ; une barre contenant des événements incompatibles reste ambiguë et sort des statistiques. Une cotation hors US sans calendrier intraday propre reste comptée comme mesure indisponible.';
const measurementNote = results.measurement_input && results.measurement_input.path && results.measurement_input.sha256
  ? 'Le résultat référence le manifeste de cohorte et l’empreinte SHA-256 de l’entrée de mesure 15 minutes.'
  : 'Le résultat référence le manifeste de cohorte et les limites de mesure disponibles.';
const coverageAlert = 'Couverture de mesure incomplète : ' + resolvedLabel + ' sur ' + s.proposed + ' propositions. Les statistiques ci-dessous portent uniquement sur ces ' + s.resolved + ' résultats et ne permettent aucun verdict sur la cohorte scanner.';
const html = [
  '<!doctype html><html lang="fr" data-tags="scanner,retrospective,marche" data-tab="scanner" data-retro-publication="coverage_review"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
  '<title>Rétrospective de couverture scanner | ' + esc(period) + ' | DailyTickers</title>',
  '<meta name="description" content="' + esc('Couverture de la cohorte scanner : ' + s.proposed + ' propositions, ' + resolvedLabel + '. Sans verdict de performance global.') + '">',
  '<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({"gtm.start":new Date().getTime(),event:"gtm.js"});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!=="dataLayer"?"&l="+l:"";j.async=true;j.src="https://www.googletagmanager.com/gtm.js?id="+i+dl;f.parentNode.insertBefore(j,f);})(window,document,"script","dataLayer","GTM-T5Z595CW");</script>',
  '<link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/assets/report.css"><style>body{font-family:Inter,system-ui,sans-serif;color:#172033;margin:0;background:#f7f9fc}.wrap{max-width:1180px;margin:auto;padding:24px}.wrap p{font-size:16px!important;line-height:1.6}.hero{background:#12233f;color:#fff;padding:34px 0}.hero p{margin:.5rem 0}.hero h1{margin:.35rem 0;font-size:clamp(1.8rem,4vw,2.8rem)}.coverage{background:#7c2d12;color:#fff;border-radius:12px;padding:16px 18px;margin-top:18px;font-weight:650;line-height:1.45}.card{background:#fff;border:1px solid #dbe3ee;border-radius:12px;padding:20px;margin:18px 0}.kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.kpi{background:#fff;border:1px solid #dbe3ee;border-radius:10px;padding:16px}.n{font-size:1.6rem;font-weight:800}table{width:100%;border-collapse:collapse;font-size:.9rem}th,td{text-align:left;padding:9px;border-bottom:1px solid #e3e8ef;vertical-align:top}.scroll{overflow:auto}.warn{border-left:4px solid #b45309;background:#fffbeb}.muted{color:#536273}.section-note{font-size:.92rem;color:#536273;margin-top:0}@media(max-width:700px){.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.wrap{padding:14px}.hero{padding:24px 0}}</style></head><body>',
  '<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-T5Z595CW" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>',
  '<nav class="brand-bar"><div class="brand-bar-inner"><a href="/" class="brand-logo"><img src="/logo.svg" alt="" width="36" height="36"><span class="brand-title">DailyTickers</span></a><div class="brand-nav"><a href="/?tab=weekly">Hebdo</a><a href="/?tab=daily">Daily</a><a href="/?tab=analyses">Analyses</a><a href="/?tab=scanner">Scanner</a><a href="/?tab=radar">Radar</a><a href="/?tab=series">Séries</a></div><div class="brand-actions"><a href="/" class="brand-home-btn" title="Accueil">Accueil</a></div></div></nav>',
  '<header class="hero"><div class="wrap"><p>Scanner · rétrospective de couverture point-in-time</p><h1>Couverture des niveaux publiés</h1><p>' + esc(period) + ' · clôture US de référence ' + esc(s.reference_close) + '</p><div id="article-clickable-tags" class="card-tags"></div><div class="coverage"><strong>Mesure incomplète.</strong> ' + esc(coverageAlert) + '</div></div></header>',
  '<main class="wrap"><section class="card"><h2>Ce que cette page établit</h2><p>' + esc(cohortNote) + '</p><p>' + esc(coverageAlert) + '</p><p class="muted">' + esc(methodology) + '</p></section>',
  '<section class="kpis" aria-label="Indicateurs de couverture"><div class="kpi"><div class="n">' + s.proposed + '</div>propositions de la cohorte</div><div class="kpi"><div class="n">' + s.scans + '</div>scans certifiés</div><div class="kpi"><div class="n">' + s.resolved + ' / ' + s.proposed + '</div>résultats mesurés</div><div class="kpi"><div class="n">' + s.data_error + '</div>mesures indisponibles</div><div class="kpi"><div class="n">' + s.open_unverified + '</div>ouverts non vérifiés</div><div class="kpi"><div class="n">' + s.non_mature + '</div>horizons non mûrs</div></section>',
  '<section class="card warn"><h2>Statistiques diagnostiques, sans verdict</h2><p>Les chiffres suivants décrivent seulement les ' + s.resolved + ' résultats mesurés : TP1 ou mieux <strong>' + fmt(s.hit_rate_pct, 1) + ' %</strong>, R moyen <strong>' + signed(s.average_r, ' R') + '</strong>, profit factor <strong>' + fmt(s.profit_factor) + '</strong> et taux de stop <strong>' + fmt(s.stop_rate_pct, 1) + ' %</strong>. Ils ne décrivent pas les ' + s.proposed + ' propositions et ne sont ni une note ni une conclusion sur la qualité du scanner.</p></section>',
  '<section class="card"><h2>Par scan</h2><p class="section-note">Les colonnes TP1+, R moyen et PF sont calculées seulement sur les résultats résolus de chaque ligne.</p><div class="scroll"><table class="scroll table-scroll"><thead><tr><th>Scan</th><th>Cohorte</th><th>Résolus</th><th>Ouverts</th><th>TP1+</th><th>R moyen</th><th>PF</th></tr></thead><tbody>' + results.by_scan.map(groupRow).join('') + '</tbody></table></div></section>',
  '<section class="card"><h2>Par stratégie</h2><p class="section-note">Même périmètre diagnostique : les données indisponibles et les horizons non mûrs ne sont pas transformés en pertes ou en gains.</p><div class="scroll"><table class="scroll table-scroll"><thead><tr><th>Stratégie</th><th>Cohorte</th><th>Résolus</th><th>Ouverts</th><th>TP1+</th><th>R moyen</th><th>PF</th></tr></thead><tbody>' + results.by_strategy.map(groupRow).join('') + '</tbody></table></div></section>',
  '<section class="card"><h2>Détail des propositions</h2><p class="section-note">Les motifs sont traduits pour lecture ; la cohorte et l’entrée de mesure restent référencées dans le fichier de résultats.</p><div class="scroll"><table class="scroll table-scroll"><thead><tr><th>Scan</th><th>Ticker</th><th>Stratégie</th><th>Statut</th><th>Entrée</th><th>Sortie</th><th>R</th><th>Rendement</th><th>Motif</th></tr></thead><tbody>' + results.outcomes.map(row).join('') + '</tbody></table></div></section>',
  '<section class="card"><h2>Sources et limites</h2><p>Le fichier public <a href="./retro-results.json">retro-results.json</a> contient le résultat, la référence au manifeste de cohorte et l’entrée de mesure. ' + esc(measurementNote) + ' Les facettes SEC, événements, actualités, analystes et initiés constituent un corpus courant observé après la période : elles ne modifient ni les entrées ni les sorties. Toute cotation non US sans calendrier intraday propre reste une mesure indisponible.</p></section></main>',
  '<footer class="article-footer"><p><strong>DailyTickers</strong> — contenu éducatif, pas un conseil en investissement.</p><p>Rétrospective de couverture : aucune conclusion de performance de cohorte tant que les mesures sont incomplètes.</p></footer><script src="/assets/core.js"></script><script src="/assets/tag-renderer.js"></script></body></html>'
].join('');
fs.writeFileSync(path.join(dir, 'index.html'), html);
console.log(path.relative(ROOT, path.join(dir, 'index.html')) + ': ' + results.outcomes.length + ' rows');
