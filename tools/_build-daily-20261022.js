#!/usr/bin/env node
'use strict';

/* Constructeur de l'édition du 22 octobre 2026 : la baisse de la tech, vérifiée ligne par ligne.
 *
 * Même principe que les éditions précédentes : le HTML et `_data/claims.json` sortent du même
 * passage. Chaque nombre visible est lu une seule fois dans un artefact haché (collecte certifiée
 * ou référence primaire déclarée) puis rendu par la fonction du validateur. Les séries sont
 * résolues par SYMBOLE et par DATE, jamais par position supposée.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { renderValue } = require('./validate-content-claims');

const ROOT = path.resolve(__dirname, '..');
const DAY = process.env.BUILD_DAY || 'daily/20261022';
const DATA = `${DAY}/_data`;
const FOCUS = `${DAY}/_focus`;
const ARTICLE = `${DAY}/index.html`;
const REFERENCE_CLOSE = process.env.BUILD_REF || '2026-10-21';
const SESSION_DAY = '2026-10-22';
const PREVIOUS_CLOSE = process.env.BUILD_PREV || '2026-10-21';

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
function formulaClaim(baseId, rel, formula, render, opts = {}) {
  const id = uniqueId(baseId);
  const { json, sha } = source(rel);
  const a = pointerGet(json, formula.numerator_pointer);
  const b = pointerGet(json, formula.denominator_pointer);
  if (typeof a !== 'number' || typeof b !== 'number') throw new Error(`formule ${id}: opérandes absents`);
  let result;
  if (formula.operation === 'ratio') result = a / b;
  else if (formula.operation === 'ratio_pct' || formula.operation === 'ratio_pct_open_to_close') result = (a / b - 1) * 100;
  else throw new Error(`formule ${id}: opération ${formula.operation} non gérée ici`);
  const entry = {
    id, source_artifact: rel, source_sha256: sha,
    source_pointer: formula.numerator_pointer, source_value: a,
    formula: { ...formula, result }, render,
  };
  if (opts.authority) entry.authority = opts.authority;
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
const L = literal;

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
const PCT_SIGNED1 = { scale: 1, decimals: 1, suffix: ' %', sign: 'always', format: 'fr' };
const PCT2 = { scale: 1, decimals: 2, suffix: ' %', format: 'fr' };
const PCT1 = { scale: 1, decimals: 1, suffix: ' %', format: 'fr' };
const PCT0 = { scale: 1, decimals: 0, suffix: ' %', format: 'fr' };
const PROB = { scale: 100, decimals: 1, suffix: ' %', format: 'fr' };
const NUM0 = { scale: 1, decimals: 0, format: 'fr' };
const NUM2 = { scale: 1, decimals: 2, format: 'fr' };
const BP = { scale: 1, decimals: 0, sign: 'always', format: 'fr' };
const EPS = { scale: 1, decimals: 2, suffix: ' $', format: 'fr' };
const MD_FROM_M = { scale: 1e-3, decimals: 2, suffix: ' Md$', format: 'fr' };
const MD_FROM_M1 = { scale: 1e-3, decimals: 1, suffix: ' Md$', format: 'fr' };
const MD = { scale: 1, decimals: 2, suffix: ' Md$', format: 'fr' };
const MD0 = { scale: 1, decimals: 0, suffix: ' Md$', format: 'fr' };
const FOIS = { scale: 1, decimals: 1, suffix: ' fois', format: 'fr' };
const DATE_DM = { format: 'fr_date', parts: 'day_month' };
const DATE_WDM = { format: 'fr_date', parts: 'weekday_day_month' };
const DATE_FULL = { format: 'fr_date', parts: 'full' };
const TIME_PARIS = { format: 'fr_time', zone: 'Europe/Paris' };


// ---------------------------------------------------------------- sources

const BI = `${DATA}/bars_indices.json`;
const BD = `${DATA}/bars_dia.json`;
const REG = `${DATA}/regime.json`;
const ECO = `${DATA}/economic_events.json`;
const PRIM = 'daily/20261022/primary-reference.json';
const REGISTRY = 'data/scheduled-events.json';
const TH = name => `${DAY}/_themes_${name}/bars_themes.json`;

// Une série = { rel, prefix, dates, at(date), last } résolue par symbole puis par date.
function series(rel, rowsPointer, symbol) {
  const rows = pointerGet(readJson(rel), rowsPointer);
  if (!Array.isArray(rows)) throw new Error(`${rel}${rowsPointer} n'est pas une liste`);
  const n = rows.findIndex(r => r && r.symbol === symbol);
  if (n < 0) throw new Error(`${symbol} absent de ${rel}`);
  const bars = rows[n].bars;
  if (!Array.isArray(bars) || !Array.isArray(bars[0])) throw new Error(`${symbol}: barres au format inattendu dans ${rel}`);
  const prefix = `${rowsPointer}/${n}/bars`;
  const dates = bars.map(b => b[0]);
  const at = d => { const i = dates.indexOf(d); if (i < 0) throw new Error(`${symbol}: séance ${d} absente de ${rel}`); return i; };
  return { rel, prefix, dates, at, bars, last: at(REFERENCE_CLOSE) };
}
const S = { SPY: series(BI, '/results/0/data', 'SPY') };

// Instantané en séance : une ligne par symbole, retrouvée par son nom.
const LIVE = `${DAY}/_live/quotes_live.json`;
const QROWS = readJson(LIVE).data.items[0].results[0].data;
const qi = s => { const i = QROWS.findIndex(r => r.symbol === s); if (i < 0) throw new Error(`${s} absent de l'instantané`); return i; };
for (const r of QROWS) if (r.session_state !== 'open' || typeof r.changePercent !== 'number') throw new Error(`${r.symbol}: cotation hors séance ou incomplète`);
const qp = (s, field) => `/data/items/0/results/0/data/${qi(s)}/${field}`;
const idOf = s => s.toLowerCase().replace(/[^a-z0-9]/g, '_');
const close = (s, r = USD) => claim(`${idOf(s)}_px`, LIVE, qp(s, 'price'), r);
const low = (s, r = USD) => claim(`${idOf(s)}_low`, LIVE, qp(s, 'low'), r);
const d1 = s => claim(`${idOf(s)}_1d`, LIVE, qp(s, 'changePercent'), PCT_SIGNED);
const raw = s => QROWS[qi(s)].changePercent;
const plain = (value, render) => renderValue(value, render);
const snap = id => claim(id, LIVE, qp('SPY', 'timestamp'), TIME_PARIS);
const snapText = plain(QROWS[qi('SPY')].timestamp, TIME_PARIS);

const prim = (id, pointer, r, authority) => claim(id, PRIM, pointer, r, { authority });
const primRatio = (id, seriesPointer, r, authority, operation = 'ratio') => formulaClaim(id, PRIM, {
  operation, numerator_pointer: `${seriesPointer}/1/1`, denominator_pointer: `${seriesPointer}/0/1`,
}, r, { authority });
const PR = readJson(PRIM);

// Paris en ligne : cotes relevées dans la même collecte que le régime, retrouvées par l'intitulé.
const PM = readJson(REG).facets.prediction_markets.items;
const pmIndex = question => {
  const i = PM.findIndex(m => m.question === question);
  if (i < 0) throw new Error(`marché absent de la collecte : ${question}`);
  return i;
};
const pm = (id, question) => claim(id, REG, `/facets/prediction_markets/items/${pmIndex(question)}/yes_price`, PROB);
const Q_HOUSE_D = 'Will the Democratic Party control the House after the 2026 Midterm elections?';
const Q_DD = '2026 Balance of Power: D Senate, D House';
const Q_RD = '2026 Balance of Power: R Senate, D House';
const Q_RR = '2026 Balance of Power: R Senate, R House';
const Q_FED_HOLD = 'Will there be no change in Fed interest rates after the October 2026 meeting?';
const Q_FED_25 = 'Will the Fed increase interest rates by 25 bps after the October 2026 meeting?';

// Consensus de bénéfice par action de Meta : relevé avec l'instantané.
const FF = `${DAY}/_live/consensus.json`;
const FFJ = readJson(FF);
const EQ = FFJ.data.items[0].results.findIndex(r => r.data_type === 'earnings_quarterly');
if (EQ < 0) throw new Error('résultats trimestriels absents');
const EQROWS = FFJ.data.items[0].results[EQ].data;
const metaRow = EQROWS.findIndex(rows => Array.isArray(rows) && rows.length && rows[0].symbol === 'META');
if (metaRow < 0) throw new Error('META absent des résultats trimestriels');
const metaQ = EQROWS[metaRow].findIndex(q => q.date === '3Q2026');
if (metaQ < 0) throw new Error('trimestre 3Q2026 de META absent');
const metaEq = (field, id) => claim(id, FF, `/data/items/0/results/${EQ}/data/${metaRow}/${metaQ}/${field}`, EPS);

const up = t => (t.includes('−') ? 'down' : 'up');
// Lignes du tableau électoral : seules les cotes effectivement collectées sont publiées.
const ELECTION_MARKETS = [
  ['pm_house', Q_HOUSE_D, 'Les démocrates prennent la Chambre des représentants', true],
  ['pm_dd', Q_DD, 'Démocrates majoritaires dans les deux chambres'],
  ['pm_rd', Q_RD, 'Chambre démocrate, Sénat républicain'],
  ['pm_rr', Q_RR, 'Républicains majoritaires dans les deux chambres'],
];
const electionRows = ELECTION_MARKETS.filter(([, q]) => PM.some(m => m.question === q))
  .map(([id, q, label, strong]) => `        <tr><td>${label}</td><td>${strong ? `<strong>${pm(id, q)}</strong>` : pm(id, q)}</td></tr>`).join('\n');
const verdict = (kind, label) => `<span class="verdict ${kind}">${label}</span>`;

// ---------------------------------------------------------------- dates et chiffres primaires

const dPREV = id => claim(id, S.SPY.rel, `${S.SPY.prefix}/${S.SPY.last}/0`, DATE_WDM);
const pd = (id, key, r = DATE_DM) => {
  const map = {
    meta_report: ['/facts/meta/report_date', 'sec_meta_ex991'],
    class_c: ['/facts/meta/class_c_effective_date', 'sec_meta_8k'],
    fed_next: ['/facts/fed/next_decision_date', 'fomc_calendar'],
    fed_last: ['/facts/fed/last_decision_date', 'fomc_statement_20260916'],
    msft: ['/facts/earnings/msft', 'msft_ir'],
    googl: ['/facts/earnings/googl', 'googl_ir'],
    amzn: ['/facts/earnings/amzn', 'amzn_ir'],
    aapl: ['/facts/earnings/aapl', 'aapl_ir'],
    ecb: ['/facts/ecb/decision_date', 'ecb_calendar'],
    ecb_since: ['/facts/ecb/deposit_rate_since', 'ecb_rates'],
    ecb_last: ['/facts/ecb/last_decision_date', 'ecb_rates'],
    boj: ['/facts/boj/decision_date', 'boj_calendar'],
    jobs: ['/facts/jobs/next_release_date', 'bls_empsit'],
    cpi_next: ['/facts/cpi/next_release_date', 'bls_cpi'],
    vote: ['/facts/election/date', 'uscode_2usc7'],
    term_end: ['/facts/election/presidential_term_end', 'archives_20th_amendment'],
    war: ['/facts/oil/war_start_date', 'press_ap_tankers'],
    brent_prev: ['/facts/oil/brent_prev_high_date', 'press_reuters_brent'],
    streak: ['/facts/curve/y10_streak_ge5_start', 'treasury_par_curve'],
    y10max_date: ['/facts/curve/y10_2026_max_date', 'treasury_par_curve'],
    chips_since: ['/facts/chips/since_date', 'press_yahoo_chips'],
    portwatch_day: ['/facts/hormuz/portwatch_day', 'press_portwatch'],
    lrcx_q_end: ['/facts/lrcx/guide_quarter_end', 'sec_lrcx_ex991'],
  }[key];
  if (!map) throw new Error(`date primaire inconnue : ${key}`);
  return prim(id, map[0], r, map[1]);
};
const y10 = date => prim(`y10_${date.replace(/-/g, '')}`, `/facts/curve/y10/${date}`, PCT2, 'treasury_par_curve');
const y10Today = PR.facts.curve.y10[SESSION_DAY];
const y10Change = PR.facts.curve.y10_change_1d_bp;
const fedTime = id => prim(id, '/facts/fed/next_statement_time', TIME_PARIS, 'fomc_calendar');
const M = (id, field, r) => prim(id, `/facts/meta/${field}`, r, 'sec_meta_ex991');
const LR = (id, field, r) => prim(id, `/facts/lrcx/${field}`, r, 'sec_lrcx_ex991');
const pctPress = (id, pointer, authority, r = PCT_SIGNED1) => prim(id, pointer, r, authority);
const T$ = { scale: 1, decimals: 0, suffix: ' T$', format: 'fr' };
const MUSD = { scale: 1, decimals: 0, suffix: ' M$', format: 'fr' };
const PCT3 = { scale: 1, decimals: 3, suffix: ' %', format: 'fr' };
const NUM1 = { scale: 1, decimals: 1, format: 'fr' };

// ---------------------------------------------------------------- tableaux

const dashboard = [
  ['SPY', `S&amp;P ${L('500')}`, 'fonds SPY'], ['QQQ', `Nasdaq ${L('100')}`, 'fonds QQQ'], ['DIA', 'Dow Jones', 'fonds DIA'],
  ['IWM', 'Petites valeurs', 'fonds IWM'], ['SMH', 'Semi-conducteurs', 'fonds SMH'], ['META', 'Meta', 'action'],
  ['BNO', 'Fonds pétrole Brent', 'fonds BNO'], ['IEF', 'Obligations d’État américaines', 'fonds IEF'],
].map(([s, label, note]) => [label, close(s), d1(s), note]);

const CHIPS = [['NVDA', 'Nvidia'], ['AMD', 'AMD'], ['AVGO', 'Broadcom'], ['TSM', 'TSMC'], ['MU', 'Micron'], ['AMAT', 'Applied Materials'], ['LRCX', 'Lam Research'], ['SMH', 'Fonds semi-conducteurs']];
const chipRows = CHIPS.map(([s, name]) => [name, s, close(s), d1(s)]);

const WORLD = [
  ['Séoul', `KOSPI ${pctPress('kospi', '/facts/asia/kospi_pct', 'press_yonhap', PCT_SIGNED)}`, 'EWY', 'Corée du Sud'],
  ['Tokyo', `Nikkei ${pctPress('nikkei', '/facts/asia/nikkei_pct', 'press_rthk', PCT_SIGNED)}`, 'EWJ', 'Japon'],
  ['Hong Kong', `Hang Seng ${pctPress('hang_seng', '/facts/asia/hang_seng_pct', 'press_rthk', PCT_SIGNED)}`, 'FXI', 'grandes valeurs chinoises'],
  ['Paris', `CAC ${L('40')} ${pctPress('cac', '/facts/europe/cac_pct', 'press_alliance')}`, 'EWQ', 'France'],
  ['Francfort', `DAX ${pctPress('dax', '/facts/europe/dax_pct', 'press_alliance')}`, 'EWG', 'Allemagne'],
  ['Londres', `FTSE ${L('100')} ${pctPress('ftse', '/facts/europe/ftse_pct', 'press_alliance')}`, 'EWU', 'Royaume-Uni'],
].map(([place, local, s, what]) => [place, local, s, what, d1(s)]);

// ---------------------------------------------------------------- graphiques (valeurs lues, jamais saisies)

const BAR_LIST = ['META', 'LRCX', 'AMD', 'AMAT', 'SMH', 'NVDA', 'MU', 'TSM', 'AVGO', 'QQQ', 'AMZN', 'GOOGL', 'MSFT', 'TSLA', 'SPY', 'RSP', 'IWM', 'DIA', 'AAPL', 'IEF', 'BNO'];
const barOrder = BAR_LIST.slice().sort((a, b) => raw(a) - raw(b) || a.localeCompare(b));
const barData = barOrder.map(s => Number(raw(s).toFixed(2)));
// ---------------------------------------------------------------- styles (layout des éditions précédentes conservé)

const template = fs.readFileSync(path.join(ROOT, 'tools/_build-daily-20260915.js'), 'utf8');
const cssMatch = /const CSS = ("(?:[^"\\]|\\.)*");/.exec(template);
if (!cssMatch) throw new Error('feuille de style de référence introuvable');
const CSS = JSON.parse(cssMatch[1]) + `
.verdict{display:inline-block;border-radius:999px;padding:.28rem .6rem;font-size:.7rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap}
.verdict.vrai{background:#e5f6ef;color:#087653}.verdict.partiel{background:#fff2d7;color:#8a5800}.verdict.faux{background:#fff1f3;color:#a3283a}.verdict.neutre{background:#eef2f7;color:#40546b}
.check-table td:first-child{font-style:italic;color:#40546b;min-width:190px}.check-table td:nth-child(2){width:1%}
.pull-quote{background:var(--daily-soft);border-radius:12px;padding:.8rem 1.1rem;margin:1rem 0;color:#24364f;font-size:1.02rem;line-height:1.6}.pull-quote cite{display:block;margin-top:.35rem;font-size:.78rem;color:var(--daily-muted);font-style:normal}
.metric-row.six{grid-template-columns:repeat(3,minmax(0,1fr))}@media(max-width:620px){.metric-row.six{grid-template-columns:1fr 1fr}.check-table td:first-child{min-width:130px}}
`;

const hero = {
  meta: plain(raw('META'), PCT_SIGNED), smh: plain(raw('SMH'), PCT_SIGNED), qqq: plain(raw('QQQ'), PCT_SIGNED),
  spy: plain(raw('SPY'), PCT_SIGNED), dia: plain(raw('DIA'), PCT_SIGNED),
};

// ---------------------------------------------------------------- page

const tauxJeudi = (lead = 'Jeudi, le') => (y10Today !== undefined
  ? `${lead} taux officiel a fini à ${y10(SESSION_DAY)}.`
  : 'Le taux officiel de jeudi n’était pas encore publié par le Trésor à l’heure de cette édition.');
const tauxVerdict = y10Today === undefined ? verdict('partiel', 'Vrai jusqu’à mercredi')
  : (y10Today >= 5 ? verdict('vrai', 'Vrai') : verdict('partiel', 'Vrai jusqu’à mercredi'));

const html = `<!DOCTYPE html>
<html lang="fr" data-tags="macro,us,eu,asia,tech,semis,ai,earnings,energy,geopolitique,formation,debutant" data-tab="daily">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily — 22 octobre 2026 : Meta, les puces, le pétrole et les élections américaines vérifiés</title>
  <meta name="description" content="Jeudi 22 octobre 2026, en séance : Meta ${hero.meta}, les semi-conducteurs ${hero.smh}, le Nasdaq 100 ${hero.qqq}. Un message qui circule explique la baisse par Meta, le pétrole, les taux et les élections du 3 novembre : vérification phrase par phrase, puis perspectives pour New York, l’Europe et l’Asie.">
  <meta property="og:title" content="Meta dépense plus qu’elle n’encaisse. La tech a payé l’addition jeudi.">
  <meta property="og:description" content="Ce qui est vrai, ce qui est faux, et ce qui compte avant le vote américain du 3 novembre.">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://articles.dailytickers.com/daily/20261022/">
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
<nav class="brand-bar"><div class="brand-bar-inner"><a href="/" class="brand-logo"><img src="/logo.svg" alt="" width="36" height="36"><span class="brand-title">DailyTickers</span></a><div class="brand-nav"><a href="/?tab=weekly">Hebdo</a><a href="/?tab=daily">Daily</a><a href="/?tab=analyses">Analyses</a><a href="/?tab=scanner">Scanner</a><a href="/?tab=radar">Radar</a><a href="/?tab=series">Séries</a></div><div class="brand-actions"><a href="/" class="brand-home-btn" title="Accueil" aria-label="Accueil"><i class="fas fa-house"></i></a></div></div></nav>

<section class="hero-section"><div class="container"><div class="hero-date">Jeudi 22 octobre 2026 &bull; Séance de New York en cours, relevé de ${snapText}</div><h1 class="hero-title">Meta dépense plus qu’elle n’encaisse. La tech a payé l’addition jeudi.</h1><p class="hero-subtitle">Un message circule pour expliquer la baisse de Wall Street : Meta, le pétrole, les taux, les élections américaines. Nous l’avons repris phrase par phrase. Une partie tient, une autre non. Et ce qui va compter arrive avant le vote du 3 novembre.</p><div class="hero-badges"><span class="hero-badge">Meta ${hero.meta}</span><span class="hero-badge">Semi-conducteurs ${hero.smh}</span><span class="hero-badge">Brent au plus haut depuis le 18 mai</span><span class="hero-badge">Fed mercredi 28 octobre</span></div><div id="article-clickable-tags" class="card-tags"></div></div></section>

<main class="report-main"><div class="container">
  <section id="essentiel" class="decision-strip" data-status="validated">
    <article class="decision-card primary"><div class="decision-kicker">L’essentiel</div><h2>À New York, la baisse vient surtout de l’IA</h2><p>Jeudi à ${snap('snap_a')}, heure de Paris, le Nasdaq ${L('100')} est à ${d1('QQQ')} depuis la veille et le S&amp;P ${L('500')} à ${d1('SPY')}. Le Dow Jones, où la tech pèse moins lourd, est à ${d1('DIA')}. Mercredi soir, Meta a montré qu’elle dépensait pour l’IA plus d’argent que son activité n’en rapporte. Lam Research, qui fabrique les machines servant à graver les puces, a prévenu qu’elle ne pourrait pas livrer tout ce qu’on lui commande. Et le Brent a touché ${prim('brent_hi_e', '/facts/oil/brent_high_usd', USD, 'press_reuters_brent')}, son plus haut depuis le ${pd('brent_prev_e', 'brent_prev')}.</p></article>
    <article class="decision-card"><span class="status-pill partial">PARTIEL</span><h3>Le message qui circule</h3><p>Partagé sur les réseaux sociaux, il a raison sur Meta et sur le pétrole. Il se trompe quand il annonce que tout se jouera la nuit du vote : la Fed, la banque centrale américaine, puis Microsoft et Alphabet parlent avant, le ${pd('fed_e1', 'fed_next')}.</p></article>
    <article class="decision-card"><span class="status-pill partial">À SUIVRE</span><h3>Ce que le message oublie</h3><p>Lam Research et ses livraisons retardées, Tesla qui réduit ses dépenses, le taux de l’État français au-dessus de ${L('5 %')}, et les plans de frappes sur l’Iran envisagés pour après le vote.</p></article>
  </section>

  <section id="dashboard" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Le tableau</div><h2>Ce qui a baissé, ce qui a tenu</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <p class="section-intro">Les grandes valeurs de la tech et des puces portent l’essentiel de la baisse. Le fonds RSP donne le même poids à chacune des ${L('500')} entreprises du S&amp;P : il est à ${d1('RSP')}. Les prix ci-dessous sont ceux des fonds cotés qui copient chaque indice, pas les indices eux-mêmes.</p>
    <div class="dashboard-grid">
${dashboard.map(([label, c, m, note]) => `      <article class="dash-card"><div class="dash-label">${label}</div><div class="dash-value">${c}</div><div class="dash-move ${up(m)}">${m}</div><div class="dash-note">${note}</div></article>`).join('\n')}
    </div>
    <div id="movesChart" class="echart-box" role="img" aria-label="Variation de jeudi, en pourcentage, pour chaque valeur et fonds cité" style="width:100%; height:440px; margin-top:1rem;"></div>
    <p class="provenance">Variation depuis la clôture du ${dPREV('prev_close')}, relevée jeudi à ${snap('snap_b')}, heure de Paris, pendant la séance. Les chiffres de clôture seront différents.</p>
  </section>

  <section id="verif" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Vérification</div><h2>Le message, phrase par phrase</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <p class="section-intro">Le texte qui circule mélange des faits justes, des faits dépassés et des paris sur l’avenir.</p>
    <div class="table-scroll"><table class="data-table check-table">
      <thead><tr><th>Ce qui est écrit</th><th>Verdict</th><th>Ce que disent les chiffres</th></tr></thead>
      <tbody>
        <tr><td>« Rouge vif » sur les marchés américains</td><td>${verdict('partiel', 'En partie')}</td><td>Surtout pour la tech : Nasdaq ${L('100')} ${d1('QQQ')}, semi-conducteurs ${d1('SMH')}. Beaucoup moins pour le reste : Dow Jones ${d1('DIA')}, petites valeurs ${d1('IWM')}. Apple est même à ${d1('AAPL')}.</td></tr>
        <tr><td>Les résultats de Meta sont « excellents »</td><td>${verdict('vrai', 'Plutôt vrai')}</td><td>Les ventes, oui : ${M('meta_rev', 'revenue_m/1/1', MD_FROM_M1)} (milliards de dollars), en hausse de ${M('meta_rev_g', 'revenue_growth_pct', PCT0)} sur un an, mieux que prévu selon les analystes cités par la presse. Le bénéfice dépend du calcul : ${metaEq('actual', 'meta_eps')} par action en comptant une somme exceptionnelle de ${M('meta_charge', 'legal_charge_bn', MD)} pour régler un procès, ${M('meta_eps_x', 'eps_ex_charge', EPS)} sans. La moyenne des analystes, ${metaEq('estimate', 'meta_eps_est')}, mélange probablement les deux méthodes. Les investisseurs regardent surtout sa trésorerie.</td></tr>
        <tr><td>« Le problème, c’est le CapEx », les dépenses d’investissement</td><td>${verdict('vrai', 'Vrai')}</td><td>${M('meta_capex', 'capex_incl_leases_bn', MD)} investis en un trimestre, plus que les ${M('meta_ocf', 'operating_cash_flow_m', MD_FROM_M)} rapportés par l’activité. Ce qui reste en caisse une fois ces investissements payés, le cash-flow libre, tombe à ${M('meta_fcf', 'free_cash_flow_m/1/1', MD_FROM_M)}.</td></tr>
        <tr><td>Meta « réaccélère massivement » ses investissements</td><td>${verdict('vrai', 'Vrai')}</td><td>En neuf mois, Meta a investi ${M('meta_cx_9m', 'capex_9m_incl_leases_m', MD_FROM_M1)}. Pour tenir son objectif de l’année, entre ${M('meta_cx_lo', 'capex_2026_low_bn', NUM0)} et ${M('meta_cx_hi', 'capex_2026_high_bn', MD0)}, elle doit encore dépenser de ${M('meta_q4_imp_lo', 'capex_q4_implied_low_m', { scale: 1e-3, decimals: 1, format: 'fr' })} à ${M('meta_q4_imp_hi', 'capex_q4_implied_high_m', MD_FROM_M1)} d’ici fin décembre, contre ${M('meta_capex_q3', 'capex_incl_leases_bn', MD)} cet été. Et elle prévient qu’elle continuera d’investir « de façon agressive » l’an prochain.</td></tr>
        <tr><td>« Contagion » à Nvidia, AMD, Amazon</td><td>${verdict('partiel', 'En partie')}</td><td>Nvidia ${d1('NVDA')}, AMD ${d1('AMD')}, Amazon ${d1('AMZN')}. Mais les puces avaient leurs propres raisons : Lam Research (${d1('LRCX')}), et Tesla, qui ramène son budget d’investissement de l’année à environ ${prim('tsla_cx_new', '/facts/tesla/capex_2026_new_bn', MD0, 'press_cnbc_tesla')}, contre plus de ${prim('tsla_cx_prev', '/facts/tesla/capex_2026_prev_bn', MD0, 'press_cnbc_tesla')}, selon les notes d’analystes citées par CNBC. Leur chute avait commencé avant Meta, dès le ${pd('chips_since_v', 'chips_since')}.</td></tr>
        <tr><td>Le conflit « fait craindre des blocages » à Ormuz</td><td>${verdict('vrai', 'Vrai')}</td><td>Le détroit est perturbé depuis le début de la guerre, le ${pd('war_a', 'war')}, mais une bonne partie du pétrole passe encore : ${prim('kpler_v', '/facts/hormuz/kpler_share_prewar_pct', PCT0, 'press_reuters_kpler')} des volumes d’avant-guerre selon le cabinet Kpler, cité par Reuters. Jeudi, la crainte d’une aggravation a poussé le Brent jusqu’à ${prim('brent_hi', '/facts/oil/brent_high_usd', USD, 'press_reuters_brent')}.</td></tr>
        <tr><td>Le taux à ${L('10 ans')} reste « au-dessus des ${L('5 %')} »</td><td>${tauxVerdict}</td><td>Clôture officielle à ${y10(REFERENCE_CLOSE)} mercredi, au-dessus de ${L('5 %')} sans interruption depuis le ${pd('streak_a', 'streak')}. ${tauxJeudi()}</td></tr>
        <tr><td>Des taux élevés « compressent automatiquement » la tech</td><td>${verdict('partiel', 'Exagéré')}</td><td>Depuis janvier, l’action Lam Research avait pris ${LR('lrcx_ytd', 'ytd_gain_pct', PCT1)} (selon AP) pendant que le taux à ${L('10 ans')} passait de ${y10('2026-01-02')} à plus de ${L('5 %')}. Et jeudi, la tech a chuté pendant que les taux baissaient.</td></tr>
        <tr><td>L’inflation « menace de repartir »</td><td>${verdict('faux', 'Déjà repartie')}</td><td>Les prix ont monté de ${prim('cpi_sep', '/facts/cpi/sep_yoy_pct', PCT1, 'bls_cpi')} sur un an en septembre, après ${prim('cpi_aug', '/facts/cpi/aug_yoy_pct', PCT1, 'bls_cpi')} en août.</td></tr>
        <tr><td>« Dans ${L('12 jours')} », les Américains votent</td><td>${verdict('vrai', 'Vrai')}</td><td>Le ${pd('vote_a', 'vote', DATE_WDM)} : les ${prim('house_seats', '/facts/election/house_seats', NUM0, 'usagov_midterms')} sièges de la Chambre des représentants, ${prim('senate_seats', '/facts/election/senate_regular_seats', NUM0, 'senate_class_ii')} sièges du Sénat, plus deux élections partielles.</td></tr>
        <tr><td>« ${L('8 milliards')} de personnes » dépendent de ce vote</td><td>${verdict('partiel', 'Exagéré')}</td><td>Le vote change le Congrès, pas le président, en fonction jusqu’au ${pd('term_a', 'term_end', DATE_FULL)}. La guerre et la diplomatie se décident d’abord à la Maison-Blanche.</td></tr>
        <tr><td>Scénarios « statu quo » ou « blocage », que les investisseurs « aiment »</td><td>${verdict('neutre', 'Déjà attendu')}</td><td>Sur Polymarket, un site de paris, les démocrates ont ${pm('pm_house_a', Q_HOUSE_D)} de chances de prendre la Chambre, les républicains ${pm('pm_rr_a', Q_RR)} de garder les deux chambres. La Bourse s’attend déjà à un Congrès en partie opposé au président.</td></tr>
        <tr><td>Un « accord géopolitique » après le vote fera baisser le pétrole</td><td>${verdict('faux', 'Rien ne l’annonce')}</td><td>Donald Trump a déclaré mercredi : « Je pense que nous ne négocions pas. » Selon le New York Times, repris par Time, les armées américaine et israélienne ont préparé des plans de frappes sur l’Iran pour après le vote, sans que le président les ait approuvés.</td></tr>
        <tr><td>« La vraie direction » se jouera dans la nuit du ${L('3 au 4 novembre')}</td><td>${verdict('partiel', 'Exagéré')}</td><td>La Fed, Microsoft et Alphabet parlent avant, le ${pd('fed_a', 'fed_next')}, puis la BCE, Amazon, la Banque du Japon et Apple (voir l’agenda).</td></tr>
      </tbody>
    </table></div>
    <p class="provenance">Comptes : communiqués de résultats déposés à la SEC, le gendarme de la Bourse américaine. Consensus : moyenne des estimations d’analystes relevée avec les cours. Taux : courbe officielle du Trésor américain. Inflation : Bureau of Labor Statistics. Paris en ligne : cotes Polymarket relevées jeudi avec les cours.</p>
  </section>

  <section id="meta" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Meta</div><h2>Plus de ventes, moins d’argent en caisse</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <div class="metric-row six">
      <div class="metric"><span>Chiffre d’affaires du trimestre</span><strong>${M('meta_rev_b', 'revenue_m/1/1', MD_FROM_M1)}</strong></div>
      <div class="metric"><span>Investissements du trimestre</span><strong>${M('meta_capex_b', 'capex_incl_leases_bn', MD)}</strong></div>
      <div class="metric"><span>Argent rapporté par l’activité</span><strong>${M('meta_ocf_b', 'operating_cash_flow_m', MD_FROM_M)}</strong></div>
      <div class="metric"><span>Cash-flow libre</span><strong>${M('meta_fcf_b', 'free_cash_flow_m/1/1', MD_FROM_M)}</strong></div>
      <div class="metric"><span>Cash-flow libre un an plus tôt</span><strong>${M('meta_fcf_prev', 'free_cash_flow_m/0/1', MD_FROM_M)}</strong></div>
      <div class="metric"><span>Dette à long terme fin septembre</span><strong>${M('meta_debt', 'long_term_debt_m/1/1', MD_FROM_M)}</strong></div>
    </div>
    <p class="section-intro">Meta, ce sont Facebook, Instagram et WhatsApp. La publicité rapporte de plus en plus : le prix moyen d’une annonce a monté de ${M('meta_ppa', 'price_per_ad_growth_pct', PCT0)} en un an. Mais pour l’IA, Meta construit des centres de données géants et les remplit de serveurs, et cet été elle y a mis plus d’argent que son activité n’en a fait rentrer. Sa dette à long terme est passée de ${M('meta_debt_prev', 'long_term_debt_m/0/1', MD_FROM_M)} fin décembre à ${M('meta_debt_c', 'long_term_debt_m/1/1', MD_FROM_M)} fin septembre. Elle n’a racheté aucune de ses propres actions en Bourse depuis janvier, contre ${M('meta_bb_prev', 'buybacks_9m_m/0/1', MD_FROM_M)} sur la même période un an plus tôt.</p>
    <p class="section-intro">Meta a aussi annoncé des actions sans droit de vote, à partir du ${pd('class_c_a', 'class_c', DATE_FULL)}. Chaque actionnaire en recevra une par action détenue, ce qui ne change la part de personne. Mais le communiqué précise qu’elles donneront à Meta la capacité de financer sa croissance. Si Meta vendait plus tard des actions nouvelles, chaque action existante représenterait une plus petite part de l’entreprise. Les prêteurs s’inquiètent eux aussi : selon CNBC, le prix de l’assurance contre un défaut de paiement de Meta, à cinq ans, a atteint un record jeudi. À ${snap('snap_c')}, l’action valait ${close('META')}, soit ${d1('META')}.</p>
    <blockquote class="pull-quote">« Les engagements futurs sont énormes. Pourtant, on ne voit pas bien quand, ni même si, ces dépenses rapporteront. »<cite>David Morrison, Trade Nation, cité par Benzinga. Traduction DailyTickers.</cite></blockquote>
    <p class="section-intro">Meta n’est pas en danger : elle garde ${M('meta_cash', 'cash_and_securities_bn', MD)} de trésorerie et de placements, et prévoit entre ${M('meta_q4_lo', 'revenue_q4_low_bn', NUM0)} et ${M('meta_q4_hi', 'revenue_q4_high_bn', MD0)} de ventes au dernier trimestre.</p>
  </section>

  <section id="puces" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Semi-conducteurs</div><h2>Lam Research : des commandes, mais pas assez de place pour les livrer</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <p class="section-intro">Lam Research vend à TSMC, Samsung ou SK hynix les machines qui gravent les puces. Ventes du trimestre : ${LR('lrcx_rev', 'revenue_q_bn', MD)}. Pour le trimestre qui finit le ${pd('lrcx_end', 'lrcx_q_end')} : ${LR('lrcx_guide', 'guide_revenue_bn', MD)}, à ${LR('lrcx_range', 'guide_revenue_range_m', MUSD)} près. Devant les analystes, son directeur financier a dit que ce chiffre aurait été un peu plus élevé sans certaines difficultés d’approvisionnement : des livraisons de décembre glissent à mars. Son patron voit le manque de place dans les salles ultra-propres, celles où l’on fabrique les puces, et de certains composants freiner encore le secteur l’an prochain, tout en promettant un retard vite rattrapé. Autre frein : la Chine, ${LR('lrcx_china', 'china_share_pct', PCT0)} de ses ventes cet été, pèsera nettement moins. L’action avait beaucoup monté depuis janvier, et la moindre déception coûtait cher. Jeudi en séance, elle est à ${d1('LRCX')}, son concurrent Applied Materials à ${d1('AMAT')}.</p>
    <p class="section-intro">Meta et Lam ont baissé le même jour : Meta parce que ses dépenses dépassent ce que rapporte son activité, Lam parce qu’il lui manque des pièces et de la place pour livrer. Selon Yahoo Finance, un panier de ${prim('chips_n', '/facts/chips/basket_size', NUM0, 'press_yahoo_chips')} valeurs de puces a perdu environ ${prim('chips_bn', '/facts/chips/basket_loss_bn', MD0, 'press_yahoo_chips')} de valeur boursière depuis le ${pd('chips_since_a', 'chips_since')}, dont plus de ${prim('chips_oct22', '/facts/chips/loss_oct22_bn', MD0, 'press_yahoo_chips')} jeudi, en cours de séance.</p>
    <div class="table-scroll"><table class="data-table">
      <thead><tr><th>Valeur</th><th>Symbole</th><th>Cours à ${snap('snap_t')}</th><th>Depuis mercredi</th></tr></thead>
      <tbody>
${chipRows.map(([n, s, c, a]) => `        <tr><td>${n}</td><td><strong>${s}</strong></td><td>${c}</td><td class="${up(a)}">${a}</td></tr>`).join('\n')}
      </tbody>
    </table></div>
  </section>

  <section id="petrole" class="section-shell" data-status="partial">
    <div class="section-head"><div><div class="section-kicker">Pétrole et taux</div><h2>Le pétrole monte, les taux américains reculent</h2></div><span class="status-pill partial">PARTIEL</span></div>
    <p class="section-intro">Le Brent, le pétrole de référence en Europe, est monté jusqu’à ${prim('brent_hi_b', '/facts/oil/brent_high_usd', USD, 'press_reuters_brent')} le baril jeudi, un sommet depuis le ${pd('brent_prev_b', 'brent_prev')} selon Reuters. Le fonds BNO, qui le suit, est à ${d1('BNO')}. Deux nouvelles l’ont poussé : des frappes des rebelles houthis du Yémen sur l’Arabie saoudite, et l’annonce par la télévision iranienne de ${prim('tankers', '/facts/oil/tankers_claimed', NUM0, 'press_ap_tankers')} pétroliers touchés dans le détroit d’Ormuz. Selon l’agence AP, l’organisme britannique de sécurité maritime n’avait rien signalé.</p>
    <p class="section-intro">Combien de navires passent encore ? Le Fonds monétaire international (FMI) ne compte que ${prim('pw_day', '/facts/hormuz/portwatch_transits_day', NUM0, 'press_portwatch')} passages le ${pd('pw_date', 'portwatch_day')}, contre ${prim('pw_avg', '/facts/hormuz/portwatch_oct2025_daily_avg', NUM1, 'press_portwatch')} par jour en moyenne en ${L('octobre 2025')}. Kpler, lui, estime les volumes de pétrole à ${prim('kpler', '/facts/hormuz/kpler_share_prewar_pct', PCT0, 'press_reuters_kpler')} de leur niveau d’avant-guerre. Les deux peuvent être vrais : beaucoup de navires coupent leur balise de position, et le FMI ne voit que ceux qui la laissent allumée.</p>
    <blockquote class="pull-quote">« Aucune désescalade n’est attendue avant les élections de mi-mandat américaines, ce qui devrait maintenir les prix du pétrole à un niveau élevé. »<cite>Tamas Varga, analyste chez le courtier PVM, cité par Reuters. Traduction DailyTickers.</cite></blockquote>
    <p class="section-intro">Les taux n’expliquent pas la baisse de jeudi. Le taux de l’État américain à ${L('10 ans')} a passé l’automne au-dessus de ${L('5 %')}, avec un sommet de l’année à ${prim('y10_max', '/facts/curve/y10_2026_max', PCT2, 'treasury_par_curve')} le ${pd('y10_max_d', 'y10max_date')}. Jeudi, le fonds d’obligations d’État IEF est à ${d1('IEF')} : son prix a monté, donc les taux ont baissé, parce que de l’argent quittait les actions pour la dette américaine, jugée plus sûre. ${tauxJeudi('Le')}</p>
    <p class="section-intro">L’inflation, elle, est déjà repartie : ${prim('cpi_sep_b', '/facts/cpi/sep_yoy_pct', PCT1, 'bls_cpi')} sur un an en septembre. La Fed a relevé son taux le ${pd('fed_last_b', 'fed_last')}, entre ${prim('fed_lo', '/facts/fed/target_low_pct', PCT2, 'fomc_statement_20260916')} et ${prim('fed_hi', '/facts/fed/target_high_pct', PCT0, 'fomc_statement_20260916')}. Pour sa décision du ${pd('fed_b', 'fed_next')}, les parieurs donnent ${pm('pm_fed_hold', Q_FED_HOLD)} de chances à un taux inchangé et ${pm('pm_fed_25', Q_FED_25)} à une nouvelle hausse.</p>
    <div class="quality-note warning-note"><strong>En France, c’est l’inverse.</strong> Le taux de l’État français à ${L('10 ans')} a monté jeudi, à ${prim('oat', '/facts/europe/oat10_pct', PCT3, 'press_sharecast_oat')}, son plus haut depuis ${L('2002')}, selon Sharecast. Les banques de Paris, Milan et Madrid, qui détiennent beaucoup d’obligations de leur pays, ont reculé.</div>
  </section>

  <section id="monde" class="section-shell" data-status="partial">
    <div class="section-head"><div><div class="section-kicker">Asie, Europe, États-Unis</div><h2>Qui a le plus à perdre si l’IA continue de baisser</h2></div><span class="status-pill partial">PARTIEL</span></div>
    <div class="table-scroll"><table class="data-table">
      <thead><tr><th>Place</th><th>Indice local jeudi (presse)</th><th>Fonds coté à New York</th><th>Depuis mercredi</th></tr></thead>
      <tbody>
${WORLD.map(([place, local, s, what, a]) => `        <tr><td>${place}</td><td>${local}</td><td><strong>${s}</strong> · ${what}</td><td class="${up(a)}">${a}</td></tr>`).join('\n')}
      </tbody>
    </table></div>
    <p class="provenance">Indices locaux : Yonhap pour Séoul, RTHK pour Tokyo et Hong Kong, Alliance News pour Paris, Francfort et Londres. Les fonds sont cotés à New York, en dollars : leur variation mêle la Bourse locale, la monnaie et la séance américaine.</p>
    <div class="three-col">
      <article class="focus-card"><div class="focus-symbol">Asie</div><div class="focus-what">La première touchée</div><p>L’Asie fabrique ce que l’Amérique achète pour l’IA : les puces mémoire de Samsung et SK hynix, celles de TSMC, les machines de Tokyo Electron. Elle a baissé la première, avant même l’ouverture de New York. À Séoul, SK hynix a fini à ${prim('hynix', '/facts/asia/sk_hynix_pct', PCT_SIGNED1, 'press_yonhap')} selon Yonhap, et la fin de son programme de rachat d’actions a retiré un acheteur. À Tokyo, SoftBank, gros investisseur de l’IA, a terminé à ${prim('softbank', '/facts/asia/softbank_pct', PCT_SIGNED1, 'press_rthk')} selon RTHK.</p><p><strong>À suivre :</strong> tant que les géants américains n’ont pas dit combien ils dépenseront l’an prochain, ces marchés restent les plus exposés. La Banque du Japon décide le ${pd('boj_b', 'boj', DATE_WDM)}.</p></article>
      <article class="focus-card"><div class="focus-symbol">Europe</div><div class="focus-what">Les mêmes raisons, plus les taux</div><p>L’Europe a baissé pour les mêmes raisons, l’IA et le pétrole, avec en plus la hausse des taux de ses États. À Paris, Hermès a chuté de ${prim('hermes', '/facts/europe/hermes_drop_pct', PCT1, 'press_reuters_europe')} dans la matinée après des ventes décevantes, selon Reuters, et les banques ont suivi les obligations françaises. Londres a le mieux résisté, à ${pctPress('ftse_b', '/facts/europe/ftse_pct', 'press_alliance')}, grâce à ses pétrolières et à ses valeurs jugées plus sûres, selon les commentateurs cités par Sharecast.</p><p><strong>Prochaine étape :</strong> la BCE, la banque centrale de la zone euro, qui a porté son taux à ${prim('ecb_rate', '/facts/ecb/deposit_rate_pct', PCT2, 'ecb_rates')} le ${pd('ecb_last_a', 'ecb_last')}, décide le ${pd('ecb_b', 'ecb', DATE_WDM)}. Avec un baril aussi cher, elle n’a guère de raison de le baisser.</p></article>
      <article class="focus-card"><div class="focus-symbol">États-Unis</div><div class="focus-what">La semaine des acheteurs d’IA</div><p>Microsoft et Alphabet publient le ${pd('msft_b', 'msft')}, Amazon le ${pd('amzn_b', 'amzn')}, Apple le ${pd('aapl_b', 'aapl')}. On saura alors si leur trésorerie suit leurs dépenses en IA.</p><p>S’ils dépensent plus et que leur cash suit, les puces devraient rebondir avant le reste. Si leur caisse fond comme celle de Meta, la baisse de la tech peut durer.</p></article>
    </div>
  </section>

  <section id="agenda" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Agenda</div><h2>Douze jours avant le vote, heures de Paris</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <div class="timeline">
      <div class="timeline-item"><div class="timeline-time">${L('dimanche 25 octobre')}</div><div class="timeline-copy"><strong>Passage à l’heure d’hiver en France</strong><span>Les États-Unis changent d’heure une semaine plus tard. Pendant cette semaine, Wall Street ouvre à ${L('14h30')} et ferme à ${L('21h00')}, heure de Paris.</span></div></div>
      <div class="timeline-item"><div class="timeline-time">${pd('fed_c', 'fed_next', DATE_WDM)}</div><div class="timeline-copy"><strong>Décision de la Fed à ${fedTime('fed_time')}, puis Microsoft et Alphabet</strong><span>Les deux géants publient après la clôture de New York. Leur budget d’investissement pour l’an prochain dira si la dépense en IA ralentit.</span></div></div>
      <div class="timeline-item"><div class="timeline-time">${pd('ecb_c', 'ecb', DATE_WDM)}</div><div class="timeline-copy"><strong>BCE, puis Amazon</strong><span>Décision de taux pour la zone euro, et résultats d’Amazon après la clôture américaine.</span></div></div>
      <div class="timeline-item"><div class="timeline-time">${pd('boj_c', 'boj', DATE_WDM)}</div><div class="timeline-copy"><strong>Banque du Japon</strong><span>Décision de taux, et rapport sur les perspectives de l’économie japonaise.</span></div></div>
      <div class="timeline-item"><div class="timeline-time">${pd('aapl_c', 'aapl', DATE_WDM)}</div><div class="timeline-copy"><strong>Apple, après la clôture</strong><span>Le dernier géant à publier avant le vote.</span></div></div>
      <div class="timeline-item"><div class="timeline-time">${pd('vote_c', 'vote', DATE_WDM)}</div><div class="timeline-copy"><strong>Élections de mi-mandat</strong><span>Les premiers résultats tombent dans la nuit, heure de Paris. Il faut parfois plusieurs jours pour savoir qui tient la Chambre.</span></div></div>
      <div class="timeline-item"><div class="timeline-time">${pd('jobs_c', 'jobs', DATE_WDM)}</div><div class="timeline-copy"><strong>Chiffres de l’emploi américain d’octobre</strong><span>Un marché du travail encore solide donnerait à la Fed un argument de plus pour relever encore son taux.</span></div></div>
      <div class="timeline-item"><div class="timeline-time">${pd('cpi_c', 'cpi_next', DATE_WDM)}</div><div class="timeline-copy"><strong>Inflation américaine d’octobre</strong><span>Premier chiffre de prix qui intègre tout le pétrole d’octobre.</span></div></div>
    </div>
    <p class="provenance">Dates : calendriers officiels de la Fed, de la BCE, de la Banque du Japon et du Bureau of Labor Statistics, pages des relations investisseurs des entreprises, loi fixant le jour de l’élection. Heure de la Fed convertie depuis l’heure de New York.</p>
  </section>

  <section id="elections" class="section-shell" data-status="partial">
    <div class="section-head"><div><div class="section-kicker">Élections de mi-mandat</div><h2>Le résultat le plus attendu est déjà dans les prix</h2></div><span class="status-pill partial">PARTIEL</span></div>
    <div class="table-scroll"><table class="data-table">
      <thead><tr><th>Issue du vote</th><th>Chances selon les parieurs</th></tr></thead>
      <tbody>
${electionRows}
      </tbody>
    </table></div>
    <p class="section-intro">Le président reste en place jusqu’en ${L('2029')}. Le vote décide qui tient le Congrès, qui vote les lois, le budget et la limite d’emprunt de l’État. Les parieurs voient très majoritairement une Chambre démocrate face à un président républicain, et la Bourse s’y attend déjà. La surprise serait l’inverse, des républicains qui gardent tout, ou un résultat si serré qu’il faudrait des jours, voire des recours, pour le connaître.</p>
    <div class="quality-note warning-note"><strong>À lire avec prudence.</strong> Ces chiffres viennent de Polymarket, un site de paris en ligne, relevés jeudi. Ce ne sont pas des sondages. Ils bougent chaque jour, et un marché de paris peut se tromper.</div>
  </section>

  <section id="trade" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">À surveiller</div><h2>Ce que nous surveillons jusqu’au ${pd('fed_e', 'fed_next')}</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <ul class="checklist">
      <li><i class="fas fa-scale-balanced"></i><div><strong>Acheter après la baisse, ou garder son argent de côté jusqu’au vote ?</strong><br>Le message pose la question. Nous ne répondons pas à la place de chacun. Nous notons seulement que le premier vrai test tombe le ${pd('fed_f', 'fed_next')}, avant le vote, avec la Fed et les comptes de Microsoft et d’Alphabet.</div></li>
      <li><i class="fas fa-hand"></i><div><strong>Un rebond vendredi à l’ouverture ne prouverait rien</strong><br>Wall Street ouvre à ${L('15h30')}, heure de Paris. Les premières minutes sont les plus agitées : le cours de ${L('16h00')} est plus parlant.</div></li>
      <li><i class="fas fa-chart-line"></i><div><strong>Meta sous ${low('META')}</strong><br>C’est son plus bas de la séance au moment de ce relevé. Une clôture en dessous voudrait dire que la baisse n’est pas finie.</div></li>
      <li><i class="fas fa-microchip"></i><div><strong>Le fonds des semi-conducteurs sous ${low('SMH')}</strong><br>Son plus bas de la séance au moment de ce relevé. Même lecture.</div></li>
      <li><i class="fas fa-oil-well"></i><div><strong>Le Brent au-dessus de ${prim('brent_hi_c', '/facts/oil/brent_high_usd', USD, 'press_reuters_brent')}</strong><br>Le plus haut cité par Reuters jeudi, en séance. Au-delà, l’inflation redevient le premier sujet, et une hausse de taux de la Fed n’est plus un pari marginal.</div></li>
    </ul>
    <div class="scenario-grid">
      <article class="scenario base"><h3>Scénario de base</h3><p>Jusqu’aux comptes des géants, la tech reste fragile et le reste de la Bourse tient mieux.</p></article>
      <article class="scenario down"><h3>Scénario contraire</h3><p>Le Brent dépasse son plus haut de jeudi et la Fed laisse entendre une hausse de taux. La baisse quitte la tech et touche tout le marché.</p></article>
      <article class="scenario flat"><h3>Quand nous aurons tort</h3><p>Notre lecture, « c’est l’IA, pas toute la Bourse », tombe si, à la clôture du ${pd('boj_d', 'boj', DATE_WDM)}, après Microsoft, Alphabet et Amazon, le fonds RSP (chaque entreprise y pèse autant) a baissé depuis jeudi, et plus que le fonds QQQ. La baisse serait alors générale.</p></article>
    </div>
    <p class="provenance">Aucune idée de trade, aucun ordre et aucune donnée de compte dans cette édition. Les niveaux cités sont des cours réellement traités jeudi.</p>
  </section>

  <section id="lecon" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Formation du jour</div><h2>Gagner de l’argent et avoir de l’argent, ce n’est pas pareil</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <p class="section-intro">Meta a gagné ${M('meta_ni', 'net_income_m', MD_FROM_M)} ce trimestre, et son cash-flow libre est négatif. Quand Meta achète un serveur, elle le paie tout de suite. Dans son bénéfice, ce serveur ne compte que petit à petit, sur plusieurs années, au rythme où il s’use. Le bénéfice dit si une entreprise vend plus cher que ce que lui coûte son activité. Le cash-flow libre dit ce qu’il reste dans la caisse une fois toutes les factures payées, serveurs compris.</p>
  </section>

  <section id="sources" class="section-shell" data-status="partial">
    <div class="section-head"><div><div class="section-kicker">Sources et limites</div><h2>Sur quoi repose cette édition</h2></div><span class="status-pill partial">PARTIEL</span></div>
    <div class="source-list">
      <div class="source-item"><strong>Cours</strong><span>Fonds cotés et actions : relevés jeudi à ${snap('snap_d')}, heure de Paris, pendant la séance de New York. Variations depuis la clôture de mercredi, calculées par le fournisseur de cotations.</span></div>
      <div class="source-item"><strong>Comptes des entreprises</strong><span>Communiqués de résultats de Meta et de Lam Research déposés à la SEC le ${pd('meta_report_s', 'meta_report', DATE_DM)}, conservés avec cette édition. Consensus d’analystes relevé avec les cours.</span></div>
      <div class="source-item"><strong>Taux, inflation, banques centrales, élections</strong><span>Trésor américain, Bureau of Labor Statistics, Réserve fédérale, BCE, Banque du Japon, Code des États-Unis, USA.gov, Sénat américain.</span></div>
      <div class="source-item"><strong>Presse</strong><span>Associated Press, Reuters, Yonhap, RTHK, Alliance News, Sharecast, CNBC, Time, Yahoo Finance, Benzinga, FMI (PortWatch), transcription de la conférence de Lam Research.</span></div>
    </div>
    <div class="quality-note warning-note"><strong>Limites.</strong> Les indices locaux, le plus haut du Brent, la perte des valeurs de puces, le taux français et l’assurance contre un défaut de Meta sont des chiffres de presse, cités avec leur source. L’annonce iranienne des pétroliers touchés n’est pas confirmée. Les mesures du trafic à Ormuz divergent selon les méthodes. Les cotes Polymarket sont un instantané de paris en ligne. Le consensus d’analystes de Meta mélange probablement des estimations qui incluaient ou non la charge judiciaire.</div>
    <p class="section-intro">Ce contenu est informatif et pédagogique. Il ne constitue pas un conseil financier. Toute décision doit tenir compte de votre horizon, de votre tolérance au risque et du risque de perte en capital.</p>
  </section>
</div></main>

<div class="fnav" id="floatingNav"><div class="fnav-menu" id="fnavMenu"><a href="#essentiel" class="fnav-item" data-section="essentiel"><i class="fas fa-bullhorn"></i><span>L’essentiel</span></a><a href="#verif" class="fnav-item" data-section="verif"><i class="fas fa-magnifying-glass"></i><span>Vérification</span></a><a href="#meta" class="fnav-item" data-section="meta"><i class="fas fa-sack-dollar"></i><span>Meta</span></a><a href="#monde" class="fnav-item" data-section="monde"><i class="fas fa-earth-europe"></i><span>Monde</span></a><a href="#agenda" class="fnav-item" data-section="agenda"><i class="fas fa-calendar-days"></i><span>Agenda</span></a><a href="#elections" class="fnav-item" data-section="elections"><i class="fas fa-landmark"></i><span>Élections</span></a></div><button class="fnav-btn" id="fnavBtn" type="button" aria-label="Navigation"><i class="fas fa-bars" id="fnavIcon"></i><span class="fnav-btn-label" id="fnavLabel">Menu</span></button></div>
<footer class="article-footer">&copy; 2026 DailyTickers. Cours relevés le 22 octobre 2026 à ${snapText}, heure de Paris, séance en cours. Ceci n&rsquo;est pas un conseil financier.<br><a href="/" title="Accueil" aria-label="Accueil"><i class="fas fa-house"></i></a></footer>
<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js"></script>
<script>
(function(){
  var pct=function(v){return v.toFixed(2)+' %';};
  var moves=echarts.init(document.getElementById('movesChart'));
  moves.setOption({tooltip:{trigger:'axis',valueFormatter:pct},grid:{left:72,right:28,top:20,bottom:36},xAxis:{type:'value',axisLabel:{formatter:'{value} %'}},yAxis:{type:'category',data:${JSON.stringify(barOrder)}},series:[{type:'bar',data:${JSON.stringify(barData.map(v => ({ value: v, itemStyle: { color: v < 0 ? '#c73d4b' : '#0b8f62' } })))}}]});
  window.addEventListener('resize',function(){moves.resize();});
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
