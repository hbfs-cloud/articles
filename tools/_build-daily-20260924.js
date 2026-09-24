#!/usr/bin/env node
'use strict';

/* Constructeur du briefing du 24 septembre 2026.
 *
 * Même principe que les éditions précédentes : le HTML et `_data/claims.json` sortent du même
 * passage, chaque nombre visible est lu une seule fois dans un artefact haché puis rendu par la
 * fonction du validateur. Les indices sont résolus par SYMBOLE et par DATE, jamais par position
 * supposée : DIA a quitté le lot des indices (barre Yahoo du 22/09 invalide, servie par Tiingo).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { renderValue } = require('./validate-content-claims');

const ROOT = path.resolve(__dirname, '..');
const DAY = 'daily/20260924';
const DATA = `${DAY}/_data`;
const FOCUS = `${DAY}/_focus`;
const THEMES = `${DAY}/_themes`;
const INTL = `${DAY}/_themes_intl`;
const ARTICLE = `${DAY}/index.html`;
const REFERENCE_CLOSE = '2026-09-23';

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
const readJson = rel => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const hashOf = rel => sha256(fs.readFileSync(path.join(ROOT, rel)));
const pointerGet = (value, pointer) => pointer.slice(1).split('/').reduce((node, raw) => {
  if (node == null || typeof node !== 'object') return undefined;
  const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
  return Array.isArray(node) ? node[Number(key)] : node[key];
}, value);

// ---------------------------------------------------------------- registre de claims

const claims = [];
const literals = new Set();
const sourceCache = new Map();
const used = new Map();
function uniqueId(base) {
  const n = (used.get(base) || 0) + 1;
  used.set(base, n);
  return n === 1 ? base : `${base}_${n}`;
}
function source(rel) {
  if (!sourceCache.has(rel)) sourceCache.set(rel, { json: readJson(rel), sha: hashOf(rel) });
  return sourceCache.get(rel);
}
function claim(baseId, rel, pointer, render, opts = {}) {
  const id = uniqueId(baseId);
  const { json, sha } = source(rel);
  const value = pointerGet(json, pointer);
  const entry = { id, source_artifact: rel, source_sha256: sha, source_pointer: pointer, source_value: value, render };
  if (opts.authority) entry.authority = opts.authority;
  const text = renderValue(value, render);
  if (text == null) throw new Error(`claim ${id}: rendu impossible pour ${JSON.stringify(value)} (${rel}${pointer})`);
  entry.rendered_text = text;
  claims.push(entry);
  return `<span data-claim="${id}">${text}</span>`;
}
function formulaClaim(baseId, rel, formula, render) {
  const id = uniqueId(baseId);
  const { json, sha } = source(rel);
  const a = pointerGet(json, formula.numerator_pointer);
  const b = pointerGet(json, formula.denominator_pointer);
  if (typeof a !== 'number' || typeof b !== 'number') throw new Error(`formule ${id}: opérandes absents`);
  const result = formula.operation === 'ratio' ? a / b : (a / b - 1) * 100;
  const entry = {
    id, source_artifact: rel, source_sha256: sha,
    source_pointer: formula.numerator_pointer, source_value: a,
    formula: { ...formula, result }, render,
  };
  const text = renderValue(result, render);
  if (text == null) throw new Error(`claim ${id}: rendu impossible pour ${result}`);
  entry.rendered_text = text;
  claims.push(entry);
  return `<span data-claim="${id}">${text}</span>`;
}
function literal(text) {
  literals.add(text);
  return `<span data-literal>${text}</span>`;
}

const NOMBRES_FR = ['deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'vingt', 'vingts', 'trente',
  'quarante', 'cinquante', 'soixante', 'cent', 'cents', 'mille', 'demi', 'demie', 'quart',
  'quarts', 'tiers', 'moitié'];
const SPELLED = new RegExp(`(?<!\\p{L})(?:${NOMBRES_FR.join('|')})(?!\\p{L})`, 'giu');
function declareSpelledNumbers(document) {
  const open = document.indexOf('<main');
  const close = document.indexOf('</main>');
  if (open < 0 || close < 0) throw new Error('bloc <main> introuvable');
  const body = document.slice(open, close);
  const wrap = text => text.replace(SPELLED, word => { literals.add(word); return `<span data-literal>${word}</span>`; });
  let out = '';
  let cursor = 0;
  let inside = 0;
  const tags = /<[^>]*>/g;
  let tag;
  while ((tag = tags.exec(body)) !== null) {
    const text = body.slice(cursor, tag.index);
    out += inside > 0 ? text : wrap(text);
    out += tag[0];
    if (/^<span[^>]*\bdata-(?:claim|literal)\b/i.test(tag[0])) inside += 1;
    else if (inside > 0 && /^<span[\s>]/i.test(tag[0])) inside += 1;
    else if (inside > 0 && /^<\/span>/i.test(tag[0])) inside -= 1;
    cursor = tags.lastIndex;
  }
  const rest = body.slice(cursor);
  out += inside > 0 ? rest : wrap(rest);
  return document.slice(0, open) + out + document.slice(close);
}

// ---------------------------------------------------------------- rendus

const USD = { scale: 1, decimals: 2, suffix: ' $', format: 'fr' };
const USD0 = { scale: 1, decimals: 0, suffix: ' $', format: 'fr' };
const PCT_SIGNED = { scale: 1, decimals: 2, suffix: ' %', sign: 'always', format: 'fr' };
const PCT2 = { scale: 1, decimals: 2, suffix: ' %', format: 'fr' };
const PCT3 = { scale: 1, decimals: 3, suffix: ' %', format: 'fr' };
const PCT1 = { scale: 1, decimals: 1, suffix: ' %', format: 'fr' };
const NUM0 = { scale: 1, decimals: 0, format: 'fr' };
const NUM1 = { scale: 1, decimals: 1, format: 'fr' };
const NUM2 = { scale: 1, decimals: 2, format: 'fr' };
const BP = { scale: 1, decimals: 0, sign: 'always', format: 'fr' };
const EPS = { scale: 1, decimals: 2, suffix: ' $', format: 'fr' };
const EPS3 = { scale: 1, decimals: 3, suffix: ' $', format: 'fr' };
const MDUSD = { scale: 1, decimals: 1, suffix: ' Md$', format: 'fr' };
const MDUSD2 = { scale: 1, decimals: 2, suffix: ' Md$', format: 'fr' };
const DATE_DM = { format: 'fr_date', parts: 'day_month' };
const DATE_WDM = { format: 'fr_date', parts: 'weekday_day_month' };
const DATE_FULL = { format: 'fr_date', parts: 'full' };
const TIME_PARIS = { format: 'fr_time', zone: 'Europe/Paris' };

// ---------------------------------------------------------------- sources

const BI = `${DATA}/bars_indices.json`;
const BD = `${DATA}/bars_dia.json`;
const BS = `${DATA}/bars_sectors.json`;
const BC = `${DATA}/bars_crypto.json`;
const OPT = `${DATA}/options_sentiment.json`;
const EARN = `${DATA}/earnings_today.json`;
const ECO = `${DATA}/economic_events.json`;
const OFF = `${DATA}/off_hours.json`;
const FB = `${FOCUS}/focus_bars.json`;
const FF = `${FOCUS}/focus_fundamentals.json`;
const TB = `${THEMES}/bars_themes.json`;
const IB = `${INTL}/bars_themes.json`;
const PRIM = `${DAY}/primary-reference.json`;
const FED = 'daily/20260917/primary-reference.json';
const REGISTRY = 'data/scheduled-events.json';

// Une série = { rel, prefix, dates, idx(date) } résolue par symbole.
function series(rel, rowsPointer, symbol) {
  const rows = pointerGet(readJson(rel), rowsPointer);
  const n = rows.findIndex(r => r.symbol === symbol);
  if (n < 0) throw new Error(`${symbol} absent de ${rel}`);
  const prefix = `${rowsPointer}/${n}/bars`;
  const dates = rows[n].bars.map(b => b[0]);
  const at = d => { const i = dates.indexOf(d); if (i < 0) throw new Error(`${symbol}: séance ${d} absente`); return i; };
  return { rel, prefix, dates, at, bars: rows[n].bars, last: at(REFERENCE_CLOSE) };
}
const S = {};
for (const s of ['SPY', 'QQQ', 'IWM', 'GLD', 'SLV', 'TLT', 'USO']) S[s] = series(BI, '/results/0/data', s);
S.DIA = series(BD, '/results/0/data', 'DIA');
for (const s of ['XLK', 'XLB', 'XLF', 'XLE', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU', 'XLC', 'XLRE']) S[s] = series(BS, '/results/0/data', s);
for (const s of ['BTC-USD', 'ETH-USD', 'SOL-USD', 'XRP-USD']) S[s] = series(BC, '/results/0/data', s);
for (const s of ['COST', 'DRI', 'SNX']) S[s] = series(FB, '/data/items/0/results/0/data', s);
for (const s of ['IEF', 'SHY', 'XHB', 'KRE', 'GDX', 'HYG']) S[s] = series(TB, '/data/items/0/results/0/data', s);
for (const s of ['EZU', 'EWJ', 'FXI', 'EWU', 'UUP', 'IBIT']) S[s] = series(IB, '/data/items/0/results/0/data', s);

const idOf = s => s.toLowerCase().replace(/-usd$/, '').replace(/[^a-z0-9]/g, '_');
const close = (s, r = USD) => claim(`${idOf(s)}_close`, S[s].rel, `${S[s].prefix}/${S[s].last}/4`, r);
const barAt = (s, date, col, r = USD, tag = 'lvl') => claim(`${idOf(s)}_${tag}`, S[s].rel, `${S[s].prefix}/${S[s].at(date)}/${col}`, r);
const move = (s, back, tag) => formulaClaim(`${idOf(s)}_${tag}`, S[s].rel, {
  operation: 'ratio_pct',
  numerator_pointer: `${S[s].prefix}/${S[s].last}/4`,
  denominator_pointer: `${S[s].prefix}/${S[s].last - back}/4`,
}, PCT_SIGNED);
const d1 = s => move(s, 1, '1d');
const d5 = s => move(s, 5, '5d');
const d20 = s => move(s, 20, '20d');
const raw1d = s => { const b = S[s].bars; return (b[S[s].last][4] / b[S[s].last - 1][4] - 1) * 100; };

const prim = (id, pointer, r, authority) => claim(id, PRIM, pointer, r, { authority });
const curve = (k, field, r = PCT2) => prim(`${k}_${field.replace(/-/g, '')}`, `/facts/curve/${k}/${field}`, r, 'treasury_par_curve');
const auction = (field, r) => prim(`auction_${field}`, `/facts/auction_5y/${field}`, r, 'treasury_auction_5y');
const auctionHist = (field, r) => prim(`auctionh_${field}`, `/facts/auction_5y/${field}`, r, 'treasury_auction_5y_history');
const ecoTime = (i, id) => claim(id, ECO, `/results/0/data/events/${i}/event_time`, TIME_PARIS);
const ecoDate = (i, id) => claim(id, ECO, `/results/0/data/events/${i}/event_time`, DATE_WDM);
const EARN_IDX = Object.fromEntries(readJson(EARN).events.map((e, i) => [e.symbol, i]));
const earnEps = s => claim(`${idOf(s)}_eps_cons`, EARN, `/events/${EARN_IDX[s]}/consensus_eps`, EPS3);
const earnCap = s => claim(`${idOf(s)}_cap`, EARN, `/events/${EARN_IDX[s]}/market_cap_b`, MDUSD);
const earnDate = s => claim(`${idOf(s)}_rdate`, EARN, `/events/${EARN_IDX[s]}/report_date`, DATE_WDM);
const EQ = readJson(FF).data.items[0].results.findIndex(r => r.data_type === 'earnings_quarterly');
const FSYM = { COST: 0, DRI: 1, SNX: 2 };
if (readJson(FF).data.items[0].results[EQ].data[FSYM.SNX][0].symbol !== 'SNX') throw new Error('ordre des résultats trimestriels inattendu');
const eq = (s, q, field) => claim(`${idOf(s)}_q${q}_${field}`, FF, `/data/items/0/results/${EQ}/data/${FSYM[s]}/${q}/${field}`, EPS);

// ---------------------------------------------------------------- tableaux

const dashboard = [
  ['SPY', 'grand marché américain'], ['QQQ', 'technologie et croissance'], ['DIA', 'valeurs industrielles établies'],
  ['IWM', 'petites capitalisations'], ['TLT', 'obligations d’État longues'], ['USO', 'pétrole coté'],
  ['GLD', 'or coté'], ['SLV', 'argent coté'],
].map(([s, note]) => [s, close(s), d1(s), note]);

const SECTOR_FR = {
  XLE: 'Énergie', XLI: 'Industrie', XLP: 'Consommation de base', XLK: 'Technologie', XLF: 'Finance',
  XLB: 'Matériaux', XLV: 'Santé', XLC: 'Communication', XLRE: 'Immobilier', XLY: 'Consommation discrétionnaire',
  XLU: 'Services aux collectivités',
};
const sectorOrder = Object.keys(SECTOR_FR).sort((a, b) => raw1d(b) - raw1d(a) || a.localeCompare(b));
const sectorRows = sectorOrder.map(s => [SECTOR_FR[s], s, close(s), d1(s), d5(s)]);

const TRANSMISSION = [
  ['SHY', `Obligations d’État ${literal('1 à 3 ans')}`], ['IEF', `Obligations d’État ${literal('7 à 10 ans')}`], ['HYG', 'Crédit à haut rendement'],
  ['KRE', 'Banques régionales'], ['XHB', 'Construction résidentielle'], ['GDX', 'Mines d’or'],
];
const transRows = TRANSMISSION.map(([s, what]) => [s, what, close(s), d1(s), d5(s)]);

const INTL_ROWS = [
  ['EZU', 'Zone euro'], ['EWU', 'Royaume-Uni'], ['EWJ', 'Japon'], ['FXI', 'Chine, grandes capitalisations'], ['UUP', 'Dollar contre panier'],
].map(([s, what]) => [s, what, close(s), d1(s), d5(s)]);

const cryptoRows = [['BTC-USD', 'Bitcoin'], ['ETH-USD', 'Ether'], ['SOL-USD', 'Solana'], ['XRP-USD', 'XRP']]
  .map(([s, name]) => [name, close(s, s === 'XRP-USD' ? { scale: 1, decimals: 3, suffix: ' $', format: 'fr' } : USD0), d1(s), d5(s)]);

const focusRows = [
  ['COST', 'Grande distribution par abonnement'], ['DRI', 'Restauration assise'], ['SNX', 'Distribution de matériel informatique'],
].map(([s, what]) => [s, what, close(s), d1(s), d5(s), d20(s)]);

// ---------------------------------------------------------------- graphiques (valeurs lues, jamais saisies)

const chartDates = S.SPY.dates.slice(S.SPY.last - 9, S.SPY.last + 1);
const norm = (s, n = 9) => {
  const b = S[s].bars.slice(S[s].last - n, S[s].last + 1);
  return b.map(x => Number(((x[4] / b[0][4] - 1) * 100).toFixed(2)));
};
const line = s => `{name:'${s}',type:'line',showSymbol:false,data:${JSON.stringify(norm(s))}}`;
const sectorChart = sectorOrder.map(s => Number(raw1d(s).toFixed(2)));
const transChart = TRANSMISSION.map(([s]) => Number(raw1d(s).toFixed(2)));
const cryDates = S['BTC-USD'].dates.slice(S['BTC-USD'].last - 9, S['BTC-USD'].last + 1);
const btcLine = S['BTC-USD'].bars.slice(S['BTC-USD'].last - 9, S['BTC-USD'].last + 1).map(b => b[4]);
const ethLine = S['ETH-USD'].bars.slice(S['ETH-USD'].last - 9, S['ETH-USD'].last + 1).map(b => b[4]);
// Courbe officielle : lue dans le CSV du Trésor via la référence primaire.
const P = readJson(PRIM).facts.curve;
const curveTenors = [['3 mois', 'm3'], ['2 ans', 'y2'], ['5 ans', 'y5'], ['10 ans', 'y10'], ['30 ans', 'y30']];
const curveNow = curveTenors.map(([, k]) => P[k]['2026-09-23']);
const curveMonth = curveTenors.map(([, k]) => P[k]['2026-08-19']);

// ---------------------------------------------------------------- styles (layout du 15/09 conservé)

const template = fs.readFileSync(path.join(ROOT, 'tools/_build-daily-20260915.js'), 'utf8');
const cssMatch = /const CSS = ("(?:[^"\\]|\\.)*");/.exec(template);
if (!cssMatch) throw new Error('feuille de style de référence introuvable');
const CSS = JSON.parse(cssMatch[1]);

const up = t => (t.includes('−') ? 'down' : 'up');
const T2 = () => literal('2 ans');
const T5 = () => literal('5 ans');
const T10 = () => literal('10 ans');
const T30 = () => literal('30 ans');

// ---------------------------------------------------------------- page

const html = `<!DOCTYPE html>
<html lang="fr" data-tags="macro,us,etf,crypto,earnings,energy,formation" data-tab="daily">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Briefing — 24 septembre 2026</title>
  <meta name="description" content="Briefing du 24 septembre 2026 : le taux à 10 ans américain clôture à 5,11 %, plus haut depuis juillet 2007. Une adjudication à 5 ans mal couverte, une courbe qui s'aplatit, et ce que cela change pour la séance.">
  <meta property="og:title" content="Daily Briefing — 24 septembre 2026">
  <meta property="og:description" content="Le marché obligataire a mené la séance. Le signal vient du court terme, pas du long.">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://articles.dailytickers.com/daily/20260924/">
  <meta property="og:image" content="https://articles.dailytickers.com/logo.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link rel="stylesheet" href="/assets/report.css">
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-T5Z595CW');</script>
  <style>
${CSS}
  </style>
</head>
<body>
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-T5Z595CW" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<nav class="brand-bar"><div class="brand-bar-inner"><a href="/" class="brand-logo"><img src="/logo.svg" alt="" width="36" height="36"><span class="brand-title">DailyTickers</span></a><div class="brand-nav"><a href="/?tab=weekly">Hebdo</a><a href="/?tab=daily">Daily</a><a href="/?tab=analyses">Analyses</a><a href="/?tab=scanner">Scanner</a><a href="/?tab=radar">Radar</a><a href="/?tab=series">Séries</a></div><div class="brand-actions"><a href="/" class="brand-home-btn" title="Accueil"><i class="fas fa-house"></i></a></div></div></nav>

<section class="hero-section"><div class="container"><div class="hero-date">Jeudi 24 septembre 2026 &bull; Clôtures arrêtées au mercredi 23 septembre</div><h1 class="hero-title">Les obligations ont décidé de la séance.</h1><p class="hero-subtitle">Le taux américain à dix ans a fini mercredi à son plus haut niveau depuis l’été 2007. Les actions ont suivi, l’or et l’argent aussi. La hausse vient surtout du court terme, donc de la Réserve fédérale.</p><div class="hero-badges"><span class="hero-badge">Taux à dix ans : plus haut depuis 2007</span><span class="hero-badge">Adjudication à cinq ans mal couverte</span><span class="hero-badge">Énergie seul secteur en hausse</span><span class="hero-badge">Costco publie ce soir</span></div><div id="article-clickable-tags" class="card-tags"></div></div></section>

<main class="report-main"><div class="container">
  <section id="alerte" class="decision-strip" data-status="validated">
    <article class="decision-card primary"><div class="decision-kicker">Alerte du jour</div><h2>Ne pas acheter la baisse des valeurs sensibles aux taux tant que le court terme monte</h2><p>Le rendement officiel du Trésor à ${T10()} a clôturé à ${curve('y10', '2026-09-23')}, soit ${curve('y10', 'change_1d_bp', BP)} points de base sur la séance. Aucune clôture n’avait atteint ce niveau depuis le ${prim('y10_prev_high_date', '/facts/ten_year_high/previous_equal_or_higher_date', DATE_FULL, 'treasury_par_curve_2007')}. Immobilier, services aux collectivités et construction résidentielle ont reculé nettement plus que le marché. Tant que le taux à ${T2()} ne se stabilise pas, un rebond de ces secteurs reste un rebond contre la tendance des taux.</p></article>
    <article class="decision-card"><span class="status-pill">CONTRÔLÉ</span><h3>Clôture de référence</h3><p>Actions, fonds cotés et obligations cotées : séance américaine du ${claim('ref_close', BI, `${S.SPY.prefix}/${S.SPY.last}/0`, DATE_WDM)}. Cryptomonnaies : bougie quotidienne complète du même jour en heure universelle. Taux : courbe officielle publiée par le Trésor américain pour la même date.</p></article>
    <article class="decision-card"><span class="status-pill partial">PARTIEL</span><h3>Trois réserves</h3><p>Le PMI de S&amp;P Global est cité d’après la presse : le communiqué original n’a pas pu être lu. L’Europe et l’Asie sont approchées par des fonds cotés à New York, pas par leurs indices locaux. La courbe de volatilité date de la clôture précédente.</p></article>
  </section>

  <section id="dashboard" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Vue instantanée</div><h2>Tout baisse, sauf le pétrole</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <p class="section-intro">Séance du ${claim('ref_close_short', BI, `${S.SPY.prefix}/${S.SPY.last}/0`, DATE_DM)}. Le grand marché cède ${d1('SPY')}, les petites capitalisations ${d1('IWM')}. Le fonds d’obligations longues perd ${d1('TLT')}, ce qui est beaucoup pour un actif censé amortir. Le seul actif du tableau en hausse est le pétrole coté, à ${d1('USO')}. Quand actions et obligations baissent ensemble, la diversification classique ne protège plus.</p>
    <div class="dashboard-grid">
${dashboard.map(([label, c, m, note]) => `      <article class="dash-card"><div class="dash-label">${label}</div><div class="dash-value">${c}</div><div class="dash-move ${up(m)}">${m}</div><div class="dash-note">${note}</div></article>`).join('\n')}
    </div>
    <div id="indicesChart" class="echart-box" style="width:100%; height:300px; margin-top:1rem;"></div>
    <p class="provenance">Variation cumulée depuis le ${literal('10 septembre')}, en pourcentage, à partir des clôtures relevées. Certaines séries ont été contrôlées sur une seconde source.</p>
  </section>

  <section id="taux" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Taux</div><h2>Ce que dit la courbe, maturité par maturité</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <div class="table-scroll"><table class="data-table">
      <thead><tr><th>Maturité</th><th>Mercredi</th><th>Sur la séance</th><th>Depuis le ${literal('19 août')}</th></tr></thead>
      <tbody>
        <tr><td>${literal('3 mois')}</td><td>${curve('m3', '2026-09-23')}</td><td>${curve('m3', 'change_1d_bp', BP)} pb</td><td>${curve('m3', 'change_since_0819_bp', BP)} pb</td></tr>
        <tr><td>${T2()}</td><td>${curve('y2', '2026-09-23')}</td><td>${curve('y2', 'change_1d_bp', BP)} pb</td><td>${curve('y2', 'change_since_0819_bp', BP)} pb</td></tr>
        <tr><td>${T5()}</td><td>${curve('y5', '2026-09-23')}</td><td>${curve('y5', 'change_1d_bp', BP)} pb</td><td>${curve('y5', 'change_since_0819_bp', BP)} pb</td></tr>
        <tr><td>${T10()}</td><td>${curve('y10', '2026-09-23')}</td><td>${curve('y10', 'change_1d_bp', BP)} pb</td><td>${curve('y10', 'change_since_0819_bp', BP)} pb</td></tr>
        <tr><td>${T30()}</td><td>${curve('y30', '2026-09-23')}</td><td>${curve('y30', 'change_1d_bp', BP)} pb</td><td>${curve('y30', 'change_since_0819_bp', BP)} pb</td></tr>
      </tbody>
    </table></div>
    <p class="provenance">Courbe officielle du Trésor américain (taux officiels du Trésor), relevée le ${literal('24 septembre')}. « pb » : points de base, un centième de point de pourcentage. Écarts calculés entre deux valeurs publiées.</p>
    <p class="section-intro">Une partie des commentaires y voit une prime de risque budgétaire : les investisseurs exigeraient davantage pour prêter à long terme à un État très endetté. Les chiffres du mois pointent ailleurs. En un mois, le taux à ${T2()} a pris ${curve('y2', 'change_since_0819_bp', BP)} points de base, celui à ${T30()} seulement ${curve('y30', 'change_since_0819_bp', BP)}. L’écart entre ${T10()} et ${T2()} est passé de ${prim('slope_0819', '/facts/curve/slope_2s10s_bp/2026-08-19', NUM0, 'treasury_par_curve')} à ${prim('slope_0923', '/facts/curve/slope_2s10s_bp/2026-09-23', NUM0, 'treasury_par_curve')} points de base. Une courbe qui s’aplatit en montant, c’est un marché qui anticipe d’autres hausses de taux directeurs. Pas un marché qui fuit la dette longue. Sur la seule séance, c’est d’ailleurs le milieu de courbe qui a le plus monté : ${curve('y3', 'change_1d_bp', BP)} points de base pour le ${literal('3 ans')}, ${curve('y5', 'change_1d_bp', BP)} pour le ${T5()}, ${curve('y7', 'change_1d_bp', BP)} pour le ${literal('7 ans')}. Réserve : le long terme part déjà de haut. Le ${literal('20 ans')} est à ${prim('y20_now', '/facts/curve/y20/2026-09-23', PCT2, 'treasury_par_curve')}, au-dessus du ${T30()} ; ce niveau déjà élevé peut limiter son amplitude.</p>
    <p class="section-intro">C’est cohérent avec le calendrier. La Réserve fédérale a relevé sa fourchette à ${claim('fed_low', FED, '/facts/decision/target_range_low_pct', PCT2, { authority: 'fomc_statement_20260916' })}–${claim('fed_high', FED, '/facts/decision/target_range_high_pct', PCT2, { authority: 'fomc_statement_20260916' })} la semaine dernière. Mercredi, selon la presse économique qui cite S&amp;P Global, l’indice composite PMI flash de septembre est ressorti à ${prim('pmi_sep', '/facts/pmi/composite_flash_sep', NUM1, 'pmi_press')}, contre ${prim('pmi_aug', '/facts/pmi/composite_aug', NUM1, 'pmi_press')} en août. Le même jour, le pétrole coté gagnait ${d1('USO')} : un baril plus cher nourrit l’inflation que la Fed cherche à contenir. Une activité forte et une énergie chère : c’est l’argument le plus simple pour une nouvelle hausse le ${claim('fomc_date', REGISTRY, '/events/6/date', DATE_DM, { authority: 'fomc' })}.</p>
    <div class="quality-note risk-note"><strong>L’adjudication à ${T5()} a confirmé la pression en fin de séance.</strong> Le Trésor a placé ${auction('offering_bn', MDUSD)} de titres à ${T5()} au taux de ${auction('high_yield_pct', PCT3)}. Le ratio de couverture, c’est-à-dire les montants demandés rapportés aux montants offerts, n’a été que de ${auction('bid_to_cover', NUM2)}. Le précédent plus faible remonte au ${auctionHist('lower_cover_date', DATE_FULL)}, à ${auctionHist('lower_cover', NUM2)}. Les primary dealers, ces banques tenues d’acheter ce que les autres ne prennent pas, ont absorbé ${auction('dealer_accepted_bn', MDUSD2)}, soit ${auction('dealer_share_pct', PCT1)} de l’émission contre ${auctionHist('prev_dealer_share_pct', PCT1)} en août. Le taux adjugé dépasse de ${auctionHist('yield_change_vs_prev_bp', BP)} points de base celui de l’adjudication du ${auctionHist('prev_date', DATE_DM)}, soit à peu près la hausse du ${T5()} sur le marché dans l’intervalle : la vente n’a pas créé le mouvement, elle l’a validé.</div>
    <div id="curveChart" class="echart-box" style="width:100%; height:300px; margin-top:1rem;"></div>
    <p class="provenance">Courbe officielle au ${literal('23 septembre')} comparée à celle du ${literal('19 août')}. Le court terme a monté davantage que le long.</p>
  </section>

  <section id="rotation" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Secteurs</div><h2>La sensibilité aux taux explique le classement</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <p class="section-intro">Le classement suit en grande partie la duration, c’est-à-dire la sensibilité d’un actif à une hausse de taux. Les services aux collectivités, financés à crédit et valorisés comme des obligations, ferment la marche à ${d1('XLU')}. L’immobilier suit à ${d1('XLRE')}. En tête, l’énergie gagne ${d1('XLE')}, portée par le baril. La technologie limite la casse à ${d1('XLK')} et reste le secteur le plus fort sur cinq séances, à ${d5('XLK')}.</p>
    <div class="table-scroll"><table class="data-table">
      <thead><tr><th>Secteur</th><th>Fonds</th><th>Clôture</th><th>Séance</th><th>Cinq séances</th></tr></thead>
      <tbody>
${sectorRows.map(([name, s, c, a, b]) => `        <tr><td>${name}</td><td><strong>${s}</strong></td><td>${c}</td><td class="${up(a)}">${a}</td><td class="${up(b)}">${b}</td></tr>`).join('\n')}
      </tbody>
    </table></div>
    <div id="sectorChart" class="echart-box" style="width:100%; height:320px; margin-top:1rem;"></div>
  </section>

  <section id="transmission" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Courroies de transmission</div><h2>Où le choc de taux s’est propagé</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <p class="section-intro">Six fonds cotés montrent le chemin pris par la hausse des taux. Les obligations courtes perdent peu, ${d1('SHY')}, les obligations à ${literal('7-10 ans')} beaucoup plus, ${d1('IEF')}. La construction résidentielle cède ${d1('XHB')} : un taux long plus haut, c’est un crédit immobilier plus cher, donc moins d’acheteurs. Le crédit à haut rendement recule de ${d1('HYG')}, sans panique.</p>
    <p class="section-intro">La plus forte baisse est celle des mines d’or, ${d1('GDX')}. L’or coté perd ${d1('GLD')} et l’argent ${d1('SLV')} pendant que le fonds dollar gagne ${d1('UUP')}. Les métaux précieux ne rapportent aucun intérêt : quand les taux montent et que le dollar se raffermit, ils perdent leur principal argument. Les mines, endettées et à coûts fixes, amplifient le mouvement.</p>
    <div class="table-scroll"><table class="data-table">
      <thead><tr><th>Fonds</th><th>Exposition</th><th>Clôture</th><th>Séance</th><th>Cinq séances</th></tr></thead>
      <tbody>
${transRows.map(([s, what, c, a, b]) => `        <tr><td><strong>${s}</strong></td><td>${what}</td><td>${c}</td><td class="${up(a)}">${a}</td><td class="${up(b)}">${b}</td></tr>`).join('\n')}
      </tbody>
    </table></div>
    <div id="transChart" class="echart-box" style="width:100%; height:280px; margin-top:1rem;"></div>
  </section>

  <section id="agenda" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Agenda</div><h2>Jeudi et vendredi, heures de Paris</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <div class="timeline">
      <div class="timeline-item"><div class="timeline-time">Jeudi, avant ${literal('15h30')}</div><div class="timeline-copy"><strong>Résultats de Darden Restaurants et de TD Synnex</strong><span>Consensus de bénéfice par action : ${earnEps('DRI')} pour Darden, ${earnEps('SNX')} pour TD Synnex. Publication avant l’ouverture de Wall Street, qui a lieu à ${literal('15h30')} à Paris. Calendrier d’une source unique, non recoupé par un dépôt de l’émetteur.</span></div></div>
      <div class="timeline-item"><div class="timeline-time">Jeudi, ${ecoTime(1, 'claims_time')}</div><div class="timeline-copy"><strong>Inscriptions hebdomadaires au chômage</strong><span>Le premier chiffre d’emploi depuis le PMI. Un chiffre faible donnerait au marché un motif de revoir à la baisse ses anticipations de hausse.</span></div></div>
      <div class="timeline-item"><div class="timeline-time">Jeudi, après ${literal('22h00')}</div><div class="timeline-copy"><strong>Résultats de Costco</strong><span>Consensus : ${earnEps('COST')} par action, pour une capitalisation de ${earnCap('COST')}. Publication après la clôture de ${literal('22h00')} à Paris. La réaction se lira vendredi.</span></div></div>
      <div class="timeline-item"><div class="timeline-time">Vendredi, ${ecoTime(2, 'ifo_time')}</div><div class="timeline-copy"><strong>Climat des affaires allemand (Ifo)</strong><span>Pour l’Europe, la question est de savoir si la hausse des taux américains se propage aux taux allemands.</span></div></div>
      <div class="timeline-item"><div class="timeline-time">Vendredi, ${ecoTime(3, 'michigan_time')}</div><div class="timeline-copy"><strong>Confiance des consommateurs, Université du Michigan (final)</strong><span>À surveiller surtout pour les anticipations d’inflation des ménages.</span></div></div>
    </div>
    <p class="provenance">Horaires convertis depuis le calendrier collecté. Prochaine décision de la Réserve fédérale : ${claim('fomc_date_b', REGISTRY, '/events/6/date', DATE_WDM, { authority: 'fomc' })}. Prochain indice des prix à la consommation : ${claim('cpi_date', REGISTRY, '/events/17/date', DATE_WDM, { authority: 'bls_cpi' })}.</p>
  </section>

  <section id="international" class="section-shell" data-status="partial">
    <div class="section-head"><div><div class="section-kicker">Europe et Asie-Pacifique</div><h2>Vues depuis New York, pas depuis leurs places</h2></div><span class="status-pill partial">PARTIEL</span></div>
    <p class="section-intro">Aucune clôture d’indice local n’a été relevée pour cette édition. Les fonds cotés à New York en donnent une image, valorisée sur la séance américaine et en dollars. Ils ont tous baissé, entre ${d1('EWU')} pour le Royaume-Uni et ${d1('FXI')} pour les grandes valeurs chinoises. Une partie de ce recul est un effet de change : le fonds dollar a monté pendant la même séance.</p>
    <div class="table-scroll"><table class="data-table">
      <thead><tr><th>Fonds</th><th>Exposition</th><th>Clôture</th><th>Séance</th><th>Cinq séances</th></tr></thead>
      <tbody>
${INTL_ROWS.map(([s, what, c, a, b]) => `        <tr><td><strong>${s}</strong></td><td>${what}</td><td>${c}</td><td class="${up(a)}">${a}</td><td class="${up(b)}">${b}</td></tr>`).join('\n')}
      </tbody>
    </table></div>
    <div class="quality-note warning-note"><strong>Limite.</strong> Ces fonds ne remplacent ni le DAX, ni le CAC, ni le Nikkei. Ils ne disent rien de la séance asiatique de jeudi, déjà en cours à l’heure de ce briefing. Aucun palmarès de valeurs européennes ou asiatiques n’est publié.</div>
  </section>

  <section id="crypto" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Cryptomonnaies</div><h2>Le numérique suit les taux, pas l’inverse</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <p class="section-intro">Le bitcoin a clôturé la journée universelle du ${claim('btc_date', BC, `${S['BTC-USD'].prefix}/${S['BTC-USD'].last}/0`, DATE_DM)} à ${close('BTC-USD', USD0)}, en baisse de ${d1('BTC-USD')}. Les autres baissent davantage : Ether ${d1('ETH-USD')}, Solana ${d1('SOL-USD')}, XRP ${d1('XRP-USD')}. C’est le comportement d’un actif risqué qui réagit au coût de l’argent. Sur cinq journées, le bilan reste positif pour les quatre.</p>
    <div class="table-scroll"><table class="data-table">
      <thead><tr><th>Actif</th><th>Clôture UTC</th><th>Journée</th><th>Cinq journées</th></tr></thead>
      <tbody>
${cryptoRows.map(([n, c, a, b]) => `        <tr><td><strong>${n}</strong></td><td>${c}</td><td class="${up(a)}">${a}</td><td class="${up(b)}">${b}</td></tr>`).join('\n')}
      </tbody>
    </table></div>
    <div id="cryptoChart" class="echart-box" style="width:100%; height:300px; margin-top:1rem;"></div>
    <p class="provenance">La bougie crypto de jeudi, encore ouverte, n’est comptée nulle part.</p>
  </section>

  <section id="valeurs" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Valeurs du jour</div><h2>Darden, TD Synnex, Costco : trois cas différents</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <p class="section-intro">Les trois noms viennent du calendrier de résultats du jour, pas d’une liste préparée. Détail notable : les trois ont fini en hausse une séance où presque tout baissait. La règle commune pour jeudi : laisser passer la première demi-heure de cotation, jusqu’à ${literal('16h00')} à Paris, avant de juger une réaction aux résultats.</p>
    <div class="table-scroll"><table class="data-table">
      <thead><tr><th>Valeur</th><th>Activité</th><th>Clôture</th><th>Séance</th><th>Cinq séances</th><th>Vingt séances</th></tr></thead>
      <tbody>
${focusRows.map(([s, what, c, a, b, e]) => `        <tr><td><strong>${s}</strong></td><td>${what}</td><td>${c}</td><td class="${up(a)}">${a}</td><td class="${up(b)}">${b}</td><td class="${up(e)}">${e}</td></tr>`).join('\n')}
      </tbody>
    </table></div>
    <div class="three-col">
      <article class="focus-card"><div class="focus-symbol">SNX</div><div class="focus-what">Ne pas acheter après la hausse</div><p>Le titre a pris ${d5('SNX')} en cinq séances avant sa publication. Mercredi, il a touché ${barAt('SNX', REFERENCE_CLOSE, 2, USD, 'high_0923')} en séance pour clôturer à ${close('SNX')}, loin du plus haut. Les quatre derniers trimestres ont tous battu le consensus, l’écart le plus large des quatre remonte à deux trimestres : ${eq('SNX', 2, 'actual')} contre ${eq('SNX', 2, 'estimate')} attendus. Après une telle montée en cinq séances, la marge d’erreur est plus mince : un bon trimestre peut déjà être dans le prix.</p><p><strong>Repère :</strong> le plus bas du ${claim('snx_gap_date', FB, `${S.SNX.prefix}/${S.SNX.at('2026-09-21')}/0`, DATE_DM)}, à ${barAt('SNX', '2026-09-21', 3, USD, 'low_0921')}. Lundi, le titre a ouvert nettement au-dessus de sa clôture de vendredi ; une clôture sous ce niveau commencerait à effacer ce saut.</p></article>
      <article class="focus-card"><div class="focus-symbol">DRI</div><div class="focus-what">Attendre ${literal('16h00')}</div><p>Darden publie avant l’ouverture. Le titre clôture à ${close('DRI')}, stable, sous son plus haut récent de ${barAt('DRI', '2026-08-13', 2, USD, 'high_0813')} atteint le ${claim('dri_high_date', FB, `${S.DRI.prefix}/${S.DRI.at('2026-08-13')}/0`, DATE_DM)}. Les quatre derniers bénéfices ont été très proches du consensus, dans un sens comme dans l’autre : pas d’habitude de surprise sur laquelle parier.</p><p><strong>Repère :</strong> le plus bas du ${claim('dri_low_date', FB, `${S.DRI.prefix}/${S.DRI.at('2026-09-17')}/0`, DATE_DM)}, à ${barAt('DRI', '2026-09-17', 3, USD, 'low_0917')}. Une ouverture sous ce niveau signalerait des résultats mal reçus : ne pas acheter la baisse le jour même.</p></article>
      <article class="focus-card"><div class="focus-symbol">COST</div><div class="focus-what">Surveiller, rien avant vendredi</div><p>Costco reste en baisse de ${d20('COST')} sur vingt séances malgré le rebond de mercredi. Les bénéfices des quatre derniers trimestres ont tous battu le consensus, de très peu pour le plus récent : ${eq('COST', 3, 'actual')} publiés contre ${eq('COST', 3, 'estimate')} attendus. Pour une valeur dont le prix repose sur des bénéfices réguliers et lointains, un taux à ${T10()} au-dessus de ${literal('5 %')} pèse. Ne pas acheter jeudi soir hors séance : peu d’échanges, prix instables. Juger vendredi après ${literal('16h00')}.</p><p><strong>Repère :</strong> le plus bas du ${claim('cost_low_date', FB, `${S.COST.prefix}/${S.COST.at('2026-09-21')}/0`, DATE_DM)}, à ${barAt('COST', '2026-09-21', 3, USD, 'low_0921')}.</p></article>
    </div>
    <p class="provenance">Historique contrôlé sur une seconde source. Les niveaux cités sont des plus hauts et plus bas de séances effectivement cotées.</p>
  </section>

  <section id="trade" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Scénarios</div><h2>Ce qui confirme, ce qui invalide</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <div class="scenario-grid">
      <article class="scenario base"><h3>Scénario de base — le marché intègre une hausse en octobre</h3><p>Les valeurs sensibles aux taux continuent de sous-performer, l’énergie et la technologie tiennent mieux. Lecture : immobilier et services aux collectivités restent les plus exposés tant que le ${T2()} monte. Ce scénario tombe si le ${T2()} clôture sous ${curve('y2', '2026-09-22')}, sa clôture de mardi, le vendredi ${literal('2 octobre')}.</p></article>
      <article class="scenario down"><h3>Scénario contraire — la dette longue décroche seule</h3><p>Le taux à ${T30()} se met à monter plus vite que celui à ${T2()}. On passerait alors d’une histoire de Réserve fédérale à une histoire de financement de l’État, potentiellement plus défavorable aux actions dans leur ensemble. Une partie des commentaires le raconte déjà ; les chiffres du mois ne le montrent pas encore.</p></article>
      <article class="scenario up"><h3>Détente — l’emploi déçoit</h3><p>Des inscriptions au chômage nettement plus élevées jeudi feraient reculer le court terme en premier. Les secteurs les plus punis mercredi, services aux collectivités et construction, rebondiraient les premiers.</p></article>
      <article class="scenario flat"><h3>Invalidation datée</h3><p>La lecture « c’est la Fed » est fausse si, d’ici la clôture du vendredi ${literal('2 octobre')}, le ${T30()} termine en hausse d’au moins ${literal('10 points de base')} et d’au moins autant de plus que le ${T2()}, ou si l’écart entre ${T5()} et ${T30()} dépasse ${literal('55 points de base')} avec un ${T30()} en hausse. Une courbe qui se redresse parce que le court terme baisse ne compte pas : ce serait encore la Fed. L’écart ${T5()}–${T30()} est à ${prim('slope_5s30s', '/facts/curve/slope_5s30s_bp/2026-09-23', NUM0, 'treasury_par_curve')} aujourd’hui.</p></article>
    </div>
    <p class="provenance">Aucun ordre, aucune position et aucune donnée de compte ne sont utilisés dans ce briefing.</p>
  </section>

  <section id="watch" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">À surveiller</div><h2>La liste de la séance</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <ul class="checklist">
      <li><i class="fas fa-chart-line"></i><div><strong>Le taux à ${T2()}, avant celui à ${T10()}</strong><br>C’est lui qui dit si le marché ajoute des hausses de taux directeurs. Le taux long suit.</div></li>
      <li><i class="fas fa-users"></i><div><strong>Les inscriptions au chômage de ${ecoTime(1, 'claims_time_b')}</strong><br>Seule donnée américaine de la journée capable de faire reculer le court terme.</div></li>
      <li><i class="fas fa-store"></i><div><strong>La première demi-heure de Darden et de TD Synnex</strong><br>Un écart d’ouverture n’est pas un signal d’entrée. Rien avant ${literal('16h00')} à Paris : l’écart entre prix d’achat et de vente est large à l’ouverture.</div></li>
      <li><i class="fas fa-coins"></i><div><strong>L’or face au dollar</strong><br>Tant que les deux évoluent en sens contraire, la baisse des métaux reste une affaire de taux, pas de demande physique.</div></li>
    </ul>
  </section>

  <section id="formation" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Formation du jour</div><h2>Pourquoi une adjudication peut faire baisser la Bourse</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <p class="section-intro">Quand l’État américain emprunte, il ne fixe pas son taux lui-même. Il annonce un montant, et les acheteurs proposent le taux auquel ils sont prêts à prêter. Le Trésor sert d’abord les offres les moins chères pour lui, puis remonte jusqu’à avoir placé tout le montant. Le dernier taux accepté devient le taux de l’emprunt.</p>
    <p class="section-intro">Deux chiffres suffisent pour juger une adjudication. Le ratio de couverture compare les montants demandés aux montants offerts : plus il est bas, moins il y avait de candidats. La part des primary dealers mesure ce qui reste aux banques obligées d’acheter : plus elle est haute, plus la demande naturelle a manqué. Mercredi, les deux signaux allaient dans le mauvais sens en même temps.</p>
    <p class="section-intro">Le lien avec les actions est mécanique. Le taux sans risque sert à actualiser les bénéfices futurs. S’il monte, une entreprise dont les profits sont lointains vaut moins aujourd’hui, même si rien n’a changé dans ses comptes. Les petites capitalisations ont baissé davantage que le grand marché en partie pour cette raison, et parce qu’elles empruntent davantage à taux variable : chaque hausse de taux leur coûte rapidement.</p>
  </section>

  <section id="limites" class="section-shell" data-status="partial">
    <div class="section-head"><div><div class="section-kicker">Contrôle contradictoire</div><h2>Ce que ce briefing ne prouve pas</h2></div><span class="status-pill partial">PARTIEL</span></div>
    <p class="section-intro">La causalité n’est pas mesurée. Le PMI est sorti le matin, avant l’adjudication, et le pétrole montait déjà. Attribuer toute la baisse à l’adjudication serait trop simple : elle a confirmé, en fin de journée, une pression déjà installée. Aucune mesure des anticipations d’inflation de marché n’a été relevée : ce briefing ne peut pas dire si le court terme monte à cause des taux réels ou de l’inflation attendue.</p>
    <p class="section-intro">L’aplatissement sur un mois repose sur deux dates choisies, le ${literal('19 août')} et le ${literal('23 septembre')}. Le choix du point de départ change l’amplitude, pas le sens, sur deux semaines, un mois ou trois mois. L’essentiel de l’aplatissement a pourtant eu lieu avant le ${literal('21 septembre')} : depuis, l’écart s’est un peu redressé. Sur la seule séance de mercredi, le taux à ${T2()} a bougé presque autant que celui à ${T10()}, et le taux à ${T30()} moins que les deux.</p>
  </section>

  <section id="sources" class="section-shell" data-status="partial">
    <div class="section-head"><div><div class="section-kicker">Sources et limites</div><h2>Sur quoi repose ce briefing</h2></div><span class="status-pill partial">PARTIEL</span></div>
    <div class="source-list">
      <div class="source-item"><strong>Cours de clôture quotidiens</strong><span>Indices, secteurs, métaux, obligations, énergie, fonds thématiques et internationaux, cryptomonnaies, trois valeurs. Dernière clôture américaine terminée ; dernière journée complète en heure universelle pour les cryptomonnaies.</span></div>
      <div class="source-item"><strong>Courbe des taux et adjudications</strong><span>Fichiers officiels du Trésor américain (courbe au pair, résultats d’adjudication et leur historique), téléchargés et conservés avec cette édition.</span></div>
      <div class="source-item"><strong>PMI flash de septembre</strong><span>Chiffres attribués à S&amp;P Global via la presse financière ; le communiqué original n’a pas pu être consulté.</span></div>
      <div class="source-item"><strong>Calendriers</strong><span>Dates de politique monétaire et de prix issues du registre officiel ; calendrier de résultats d’une source unique, traité comme indicatif.</span></div>
    </div>
    <div class="quality-note warning-note"><strong>Limites.</strong> La courbe de volatilité relevée date de la clôture du ${claim('vix_date', OPT, '/items/1/last_trade_time', DATE_WDM)}, à ${claim('vix_30d', OPT, '/items/1/level', NUM2)} pour l’échéance à un mois : elle précède la séance décrite et n’est pas utilisée dans l’analyse. Le relevé des déclarations d’initiés n’a couvert qu’une partie de l’univers et ne donne lieu à aucune conclusion.</div>
    <p class="section-intro">Ce contenu est informatif et pédagogique. Il ne constitue pas un conseil financier. Toute décision doit tenir compte de votre horizon, de votre tolérance au risque et du risque de perte en capital.</p>
  </section>
</div></main>

<div class="fnav" id="floatingNav"><div class="fnav-menu" id="fnavMenu"><a href="#alerte" class="fnav-item" data-section="alerte"><i class="fas fa-bullhorn"></i><span>Alerte</span></a><a href="#dashboard" class="fnav-item" data-section="dashboard"><i class="fas fa-gauge-high"></i><span>Tableau</span></a><a href="#taux" class="fnav-item" data-section="taux"><i class="fas fa-percent"></i><span>Taux</span></a><a href="#rotation" class="fnav-item" data-section="rotation"><i class="fas fa-layer-group"></i><span>Secteurs</span></a><a href="#valeurs" class="fnav-item" data-section="valeurs"><i class="fas fa-crosshairs"></i><span>Valeurs</span></a><a href="#formation" class="fnav-item" data-section="formation"><i class="fas fa-graduation-cap"></i><span>Formation</span></a></div><button class="fnav-btn" id="fnavBtn" type="button" aria-label="Navigation"><i class="fas fa-bars" id="fnavIcon"></i><span class="fnav-btn-label" id="fnavLabel">Menu</span></button></div>
<footer class="article-footer">&copy; 2026 DailyTickers. Données arrêtées à la dernière clôture. Ceci n&rsquo;est pas un conseil financier.<br><a href="/" title="Home"><i class="fas fa-house"></i></a></footer>
<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js"></script>
<script>
(function(){
  var pct=function(v){return v.toFixed(2)+' %';};
  var indices=echarts.init(document.getElementById('indicesChart'));
  indices.setOption({tooltip:{trigger:'axis',valueFormatter:pct},legend:{data:['SPY','IWM','TLT','USO']},grid:{left:52,right:20,top:48,bottom:42},xAxis:{type:'category',data:${JSON.stringify(chartDates)}},yAxis:{type:'value',scale:true},series:[${line('SPY')},${line('IWM')},${line('TLT')},${line('USO')}]});
  var curve=echarts.init(document.getElementById('curveChart'));
  curve.setOption({tooltip:{trigger:'axis',valueFormatter:pct},legend:{data:['23 septembre','19 août']},grid:{left:52,right:20,top:48,bottom:42},xAxis:{type:'category',data:${JSON.stringify(curveTenors.map(t => t[0]))}},yAxis:{type:'value',scale:true},series:[{name:'23 septembre',type:'line',data:${JSON.stringify(curveNow)},lineStyle:{color:'#c73d4b'}},{name:'19 août',type:'line',data:${JSON.stringify(curveMonth)},lineStyle:{color:'#5f6f83',type:'dashed'}}]});
  var sectors=echarts.init(document.getElementById('sectorChart'));
  sectors.setOption({tooltip:{trigger:'axis',valueFormatter:pct},grid:{left:55,right:24,top:25,bottom:92},xAxis:{type:'category',data:${JSON.stringify(sectorOrder.map(s => SECTOR_FR[s]))},axisLabel:{interval:0,rotate:38,fontSize:10}},yAxis:{type:'value'},series:[{type:'bar',data:${JSON.stringify(sectorChart)}}]});
  var trans=echarts.init(document.getElementById('transChart'));
  trans.setOption({tooltip:{trigger:'axis',valueFormatter:pct},grid:{left:55,right:24,top:25,bottom:42},xAxis:{type:'category',data:${JSON.stringify(TRANSMISSION.map(t => t[0]))}},yAxis:{type:'value'},series:[{type:'bar',data:${JSON.stringify(transChart)}}]});
  var crypto=echarts.init(document.getElementById('cryptoChart'));
  crypto.setOption({tooltip:{trigger:'axis'},legend:{data:['Bitcoin','Ether']},grid:{left:66,right:56,top:48,bottom:42},xAxis:{type:'category',data:${JSON.stringify(cryDates)}},yAxis:[{type:'value',scale:true},{type:'value',scale:true}],series:[{name:'Bitcoin',type:'line',showSymbol:false,data:${JSON.stringify(btcLine)},lineStyle:{color:'#f59e0b'}},{name:'Ether',type:'line',yAxisIndex:1,showSymbol:false,data:${JSON.stringify(ethLine)},lineStyle:{color:'#7b61ff'}}]});
  window.addEventListener('resize',function(){indices.resize();curve.resize();sectors.resize();trans.resize();crypto.resize();});
})();
</script>
<script src="/assets/echarts-responsive.js"></script>
<script src="/assets/core.js"></script>
<script src="/assets/tag-renderer.js"></script>
</body></html>
`;

// ---------------------------------------------------------------- écriture

const document = declareSpelledNumbers(html);
fs.writeFileSync(path.join(ROOT, ARTICLE), document);
const manifest = {
  schema_version: 1,
  reference_close: REFERENCE_CLOSE,
  article_path: ARTICLE,
  article_sha256: sha256(fs.readFileSync(path.join(ROOT, ARTICLE))),
  literals: [...literals],
  claims,
};
fs.writeFileSync(path.join(ROOT, `${DATA}/claims.json`), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`[build-daily] ${ARTICLE} — ${document.length} octets, ${claims.length} claims, ${literals.size} littéraux`);
