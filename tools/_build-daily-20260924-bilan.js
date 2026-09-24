#!/usr/bin/env node
'use strict';

/* Dossier spécial du 24 septembre 2026 : « La chaîne IA, quatre semaines après le 27 août ».
 *
 * Même contrat que les briefings quotidiens : le HTML et claims.json sortent du même passage.
 * Toutes les mesures viennent des trois collectes certifiées du dossier (barres tiingo
 * completed_only au close du 23/09) ; le taux à dix ans vient de la référence primaire du Trésor
 * enregistrée pour le daily du jour. Les seuils cités sont ceux publiés le 27 août : ce sont des
 * règles, pas des mesures, et ils sont déclarés comme littéraux relus.
 *
 * L'évaluation des niveaux se fait sur CLÔTURES, jour par jour, depuis la séance du 27 août
 * incluse. Le même calcul est écrit dans _calc/levels.json pour relecture, mais chaque date et
 * chaque prix publiés pointent directement la barre certifiée.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { renderValue } = require('./validate-content-claims');

const ROOT = path.resolve(__dirname, '..');
const DIR = 'daily/20260924/bilan-chaine-ia-27-aout';
const ARTICLE = `${DIR}/index.html`;
const CLAIMS = `${DIR}/_data1/claims.json`;
const REFERENCE_CLOSE = '2026-09-23';
const D26 = '2026-08-26';
const D27 = '2026-08-27';

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
const readJson = rel => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const hashOf = rel => sha256(fs.readFileSync(path.join(ROOT, rel)));
const pointerGet = (value, pointer) => pointer.slice(1).split('/').reduce((node, raw) => {
  if (node == null || typeof node !== 'object') return undefined;
  const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
  return Array.isArray(node) ? node[Number(key)] : node[key];
}, value);

// ---------------------------------------------------------------- claims

const claims = [];
const literals = new Set();
const cache = new Map();
const used = new Map();
const uid = base => { const n = (used.get(base) || 0) + 1; used.set(base, n); return n === 1 ? base : `${base}_${n}`; };
const source = rel => { if (!cache.has(rel)) cache.set(rel, { json: readJson(rel), sha: hashOf(rel) }); return cache.get(rel); };
function claim(base, rel, pointer, render, opts = {}) {
  const id = uid(base);
  const { json, sha } = source(rel);
  const value = pointerGet(json, pointer);
  const text = renderValue(value, render);
  if (text == null) throw new Error(`claim ${id}: rendu impossible (${rel}${pointer} = ${JSON.stringify(value)})`);
  const entry = { id, source_artifact: rel, source_sha256: sha, source_pointer: pointer, source_value: value, render, rendered_text: text };
  if (opts.authority) entry.authority = opts.authority;
  claims.push(entry);
  return `<span data-claim="${id}">${text}</span>`;
}
function ratioClaim(base, rel, num, den, render) {
  const id = uid(base);
  const { json, sha } = source(rel);
  const a = pointerGet(json, num), b = pointerGet(json, den);
  if (typeof a !== 'number' || typeof b !== 'number') throw new Error(`formule ${id}: opérandes absents`);
  const result = (a / b - 1) * 100;
  const text = renderValue(result, render);
  claims.push({ id, source_artifact: rel, source_sha256: sha, source_pointer: num, source_value: a,
    formula: { operation: 'ratio_pct', numerator_pointer: num, denominator_pointer: den, result }, render, rendered_text: text });
  return `<span data-claim="${id}">${text}</span>`;
}
const literal = text => { literals.add(text); return `<span data-literal>${text}</span>`; };

const NOMBRES_FR = ['deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze',
  'treize', 'quatorze', 'quinze', 'seize', 'vingt', 'vingts', 'trente', 'quarante', 'cinquante', 'soixante',
  'cent', 'cents', 'mille', 'demi', 'demie', 'quart', 'quarts', 'tiers', 'moitié'];
const SPELLED = new RegExp(`(?<!\\p{L})(?:${NOMBRES_FR.join('|')})(?!\\p{L})`, 'giu');
// Repères éditoriaux du dossier : dates de référence et noms propres chiffrés. Ce sont le sujet du
// dossier, pas des mesures ; ils sont déclarés comme littéraux, jamais liés à une valeur.
const EDITORIAL = ['27 août', '26 août', '24 août', '22 octobre', '23 septembre', '24 septembre', 'juillet 2007', '27/08', '23/09',
  'S&amp;P 500', 'Nasdaq 100', 'Hut 8', 'Base 100'];
const EDITORIAL_RE = new RegExp(EDITORIAL.map(t => t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('|'), 'g');
function declareSpelledNumbers(document) {
  const open = document.indexOf('<main'), close = document.indexOf('</main>');
  const body = document.slice(open, close);
  const wrap = t => t.replace(EDITORIAL_RE, w => { literals.add(w.replace(/&amp;/g, '&')); return `\u0000${w}\u0001`; })
    .replace(SPELLED, w => { literals.add(w); return `<span data-literal>${w}</span>`; })
    .replace(/\u0000/g, '<span data-literal>').replace(/\u0001/g, '</span>');
  let out = '', cursor = 0, inside = 0, tag;
  const tags = /<[^>]*>/g;
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
const USD3 = { scale: 1, decimals: 3, suffix: ' $', format: 'fr' };
const PCT = { scale: 1, decimals: 1, suffix: ' %', sign: 'always', format: 'fr' };
const PCT2 = { scale: 1, decimals: 2, suffix: ' %', format: 'fr' };
const DATE_DM = { format: 'fr_date', parts: 'day_month' };

// ---------------------------------------------------------------- séries

const FILES = [1, 2, 3].map(i => `${DIR}/_data${i}/bars_dossier.json`);
const CRYPTO = `${DIR}/_data1/bars_crypto.json`;
const S = {};
function register(rel, rowsPointer) {
  const rows = pointerGet(readJson(rel), rowsPointer);
  rows.forEach((row, n) => {
    const dates = row.bars.map(b => b[0]);
    S[row.symbol] = { rel, provider: row.source || null, prefix: `${rowsPointer}/${n}/bars`, bars: row.bars, dates,
      at: d => { const i = dates.indexOf(d); if (i < 0) throw new Error(`${row.symbol}: ${d} absent`); return i; } };
  });
}
FILES.forEach(f => register(f, '/data/items/0/results/0/data'));
register(CRYPTO, '/results/0/data');
for (const s of Object.values(S)) s.last = s.at(REFERENCE_CLOSE);

const idOf = s => s.toLowerCase().replace(/-usd$/, '').replace(/[^a-z0-9]/g, '_');
const px = (s, d = REFERENCE_CLOSE, col = 4, r) => {
  const rr = r || (S[s].bars[S[s].last][4] < 5 ? USD3 : (S[s].bars[S[s].last][4] > 20000 ? USD0 : USD));
  return claim(`${idOf(s)}_${col}_${d.slice(5).replace('-', '')}`, S[s].rel, `${S[s].prefix}/${S[s].at(d)}/${col}`, rr);
};
const chg = (s, from, to = REFERENCE_CLOSE, tag) => ratioClaim(`${idOf(s)}_${tag || from.slice(5).replace('-', '')}`,
  S[s].rel, `${S[s].prefix}/${S[s].at(to)}/4`, `${S[s].prefix}/${S[s].at(from)}/4`, PCT);
const gap = s => chg(s, D26, D27, 'jour');
const since = s => chg(s, D27);
const barDate = (s, d) => claim(`${idOf(s)}_d_${d.slice(5).replace('-', '')}`, S[s].rel, `${S[s].prefix}/${S[s].at(d)}/0`, DATE_DM);
const raw = (s, from, to = REFERENCE_CLOSE) => (S[s].bars[S[s].at(to)][4] / S[s].bars[S[s].at(from)][4] - 1) * 100;
const cls = t => (t.includes('−') ? 'down' : 'up');
const minCloseDate = (s, from) => S[s].bars.filter(b => b[0] > from).reduce((m, b) => (b[4] < m[4] ? b : m))[0];

// ---------------------------------------------------------------- niveaux du 27/08

const LEVELS = [
  { s: 'AMKR', trig: 55, weak: 50.10, t: '55', w: '50,10' },
  { s: 'KLAC', trig: 190.89, weak: 186.50, t: '190,89', w: '186,50' },
  { s: 'TTMI', trig: 130, weak: 125, t: '130', w: '125' },
  { s: 'VICR', trig: 216.66, weak: null, t: '216,66', w: null },
  { s: 'AAOI', trig: 125, weak: 117.58, t: '125', w: '117,58' },
  { s: 'RZLV', trig: 3.04, weak: 2.83, t: '3,04', w: '2,83' },
  { s: 'MRSH', trig: 191.82, weak: 187.55, t: '191,82', w: '187,55', second: 193.26, s2: '193,26' },
  { s: 'LPLA', trig: 365, weak: 344.45, t: '365', w: '344,45' },
  { s: 'LUNR', trig: 16.45, weak: 16.05, t: '16,45', w: '16,05' },
  { s: 'STRL', trig: 514.47, weak: 504.50, t: '514,47', w: '504,50' },
  { s: 'EQX', trig: 13.79, weak: 13.58, t: '13,79', w: '13,58' },
  { s: 'ALLR', trig: 1.41, weak: 1.34, t: '1,41', w: '1,34', second: 1.55, s2: '1,55' },
];
const evalLevel = L => {
  const b = S[L.s].bars.filter(x => x[0] >= D27);
  const trigDate = (b.find(x => x[4] >= L.trig) || [])[0] || null;
  const weakDate = L.weak == null ? null : (b.find(x => x[4] < L.weak) || [])[0] || null;
  const weakAfter = trigDate && L.weak != null ? (b.find(x => x[0] > trigDate && x[4] < L.weak) || [])[0] || null : null;
  const secondDate = L.second ? (b.find(x => x[4] >= L.second) || [])[0] || null : null;
  const trigIntraday = (b.find(x => x[2] >= L.trig) || [])[0] || null;
  const weakIntradayAfterTrigger = L.weak == null || !trigDate ? null : (b.find(x => x[0] > trigDate && x[3] < L.weak) || [])[0] || null;
  const weakIntradayFirst = L.weak == null ? null : (b.find(x => x[3] < L.weak) || [])[0] || null;
  return { ...L, trigDate, weakDate, weakAfter, secondDate, trigIntraday, weakIntradayFirst, weakIntradayAfterTrigger };
};
const levelRows = LEVELS.map(evalLevel);
const triggered = levelRows.filter(r => r.trigDate);
const winners = triggered.filter(r => !r.weakAfter && raw(r.s, r.trigDate) > 0);
fs.mkdirSync(path.join(ROOT, DIR, '_calc'), { recursive: true });
fs.writeFileSync(path.join(ROOT, DIR, '_calc/levels.json'), `${JSON.stringify({
  method: 'Clôtures quotidiennes certifiées (completed_only), séance du 27/08 incluse. Déclenchement = première clôture ≥ seuil ; faiblesse = première clôture < niveau ; faiblesse après déclenchement = première clôture < niveau après la date de déclenchement. trigIntraday = premier plus haut de séance ≥ seuil ; weakIntradayFirst = premier plus bas de séance < niveau de faiblesse ; weakIntradayAfterTrigger = même mesure après la date de déclenchement en clôture. Ces champs mesurent le biais des clôtures.',
  sources: Object.fromEntries(LEVELS.map(L => [L.s, { artifact: S[L.s].rel, provider: S[L.s].provider }])),
  rows: levelRows.map(({ t, w, s2, ...rest }) => ({ ...rest, sinceTriggerPct: rest.trigDate ? raw(rest.s, rest.trigDate) : null, triggerToExitPct: rest.trigDate && rest.weakAfter ? raw(rest.s, rest.trigDate, rest.weakAfter) : null })),
  summary: { levels: levelRows.length, triggered: triggered.length, winners: winners.map(r => r.s) },
}, null, 2)}\n`);

function levelOutcome(r) {
  const parts = [];
  if (r.trigDate) {
    if (r.weakDate && r.weakDate < r.trigDate) parts.push(`faiblesse d’abord franchie le ${barDate(r.s, r.weakDate)} à ${px(r.s, r.weakDate)}`);
    parts.push(`déclenché le ${barDate(r.s, r.trigDate)} à ${px(r.s, r.trigDate)}`);
    if (r.second && !r.secondDate) parts.push(`second seuil de ${literal(r.s2)} jamais atteint en clôture`);
    if (r.weakAfter) parts.push(`sorti le ${barDate(r.s, r.weakAfter)} à ${px(r.s, r.weakAfter)}`);
    else if (r.weak != null) parts.push('aucune clôture sous le niveau de faiblesse depuis');
  } else {
    parts.push('jamais déclenché');
    if (r.weakDate) parts.push(`faiblesse franchie le ${barDate(r.s, r.weakDate)} à ${px(r.s, r.weakDate)}`);
  }
  return parts.join(' ; ');
}
const levelTable = levelRows.map(r => {
  const v = since(r.s);
  const post = r.trigDate ? chg(r.s, r.trigDate, REFERENCE_CLOSE, 'post') : '—';
  const toExit = r.trigDate && r.weakAfter ? chg(r.s, r.trigDate, r.weakAfter, 'toexit') : '—';
  return `        <tr><td><strong>${r.s}</strong></td><td>${literal(r.t)}${r.w ? ` / ${literal(r.w)}` : ''}</td><td>${levelOutcome(r)}</td><td>${px(r.s)}</td><td class="${cls(toExit)}">${toExit}</td><td class="${cls(post)}">${post}</td><td class="${cls(v)}">${v}</td></tr>`;
}).join('\n');

// Valeurs de la séance du 27/08 : publications (NVDA, CRWD, OKTA, CRM) et suiveurs cités ce matin-là.
const SESSION = [
  ['NVDA', 'Publication de la veille'], ['CRWD', 'Publication de la veille'], ['OKTA', 'Publication de la veille'],
  ['CRM', 'Publication de la veille'], ['PANW', 'Suiveur cybersécurité'], ['TENB', 'Suiveur cybersécurité'],
  ['NOW', 'Suiveur logiciel'], ['SNPS', 'Liste de surveillance'],
];
const fromOpen = (s, tag) => {
  const id = uid(`${idOf(s)}_${tag || 'open27'}`);
  const { json, sha } = source(S[s].rel);
  const num = `${S[s].prefix}/${S[s].last}/4`, den = `${S[s].prefix}/${S[s].at(D27)}/1`;
  const a = pointerGet(json, num), b = pointerGet(json, den);
  const result = (a / b - 1) * 100;
  const text = renderValue(result, PCT);
  claims.push({ id, source_artifact: S[s].rel, source_sha256: sha, source_pointer: num, source_value: a,
    formula: { operation: 'ratio_pct_open_to_close', numerator_pointer: num, denominator_pointer: den, result }, render: PCT, rendered_text: text });
  return `<span data-claim="${id}">${text}</span>`;
};
const rawOpen = s => (S[s].bars[S[s].last][4] / S[s].bars[S[s].at(D27)][1] - 1) * 100;
const sessionRows = SESSION.map(([s, what]) => {
  const g = gap(s), o = fromOpen(s), a = since(s);
  return `        <tr><td><strong>${s}</strong></td><td>${what}</td><td class="${cls(g)}">${g}</td><td>${px(s, D27, 1)}</td><td class="${cls(o)}">${o}</td><td class="${cls(a)}">${a}</td></tr>`;
}).join('\n');
const positiveFromOpen = SESSION.filter(([s]) => rawOpen(s) > 0).length;

const SYMPATHY = ['VICR', 'INTC', 'AMD', 'AMKR', 'CIFR', 'KLAC', 'CORZ', 'DDOG', 'APLD', 'WULF', 'AVGO', 'AAOI'];
const sympathyRows = [...SYMPATHY].sort((a, b) => raw(b, D27) - raw(a, D27) || a.localeCompare(b)).map(s => {
  const a = since(s);
  return `        <tr><td><strong>${s}</strong></td><td>${px(s, D27)}</td><td>${px(s)}</td><td class="${cls(a)}">${a}</td></tr>`;
}).join('\n');
// Moyenne équipondérée : somme des variations / 12, via sum_divide_pct n'exprime pas une moyenne de
// rendements ; on publie donc des comptes et la médiane en littéraux relus, calculés ici et écrits
// dans _calc/sympathy.json pour relecture.
const symVals = SYMPATHY.map(s => raw(s, D27)).sort((a, b) => a - b);
const symMean = symVals.reduce((x, y) => x + y, 0) / symVals.length;
const symMedian = (symVals[5] + symVals[6]) / 2;
const smh = raw('SMH', D27);
const belowSmh = symVals.filter(v => v < smh).length;
fs.writeFileSync(path.join(ROOT, DIR, '_calc/sympathy.json'), `${JSON.stringify({ method: 'Variation close 27/08 → close 23/09 par valeur ; moyenne arithmétique équipondérée ; médiane = moyenne des 6e et 7e valeurs triées ; belowSmh = nombre de valeurs < variation SMH.', series: Object.fromEntries([...SYMPATHY, 'SMH'].map(s => [s, { artifact: S[s].rel, sha256: source(S[s].rel).sha, numerator_pointer: `${S[s].prefix}/${S[s].last}/4`, denominator_pointer: `${S[s].prefix}/${S[s].at(D27)}/4` }])), symbols: SYMPATHY, sinceAug27Pct: Object.fromEntries(SYMPATHY.map(s => [s, raw(s, D27)])), equalWeightMeanPct: symMean, medianPct: symMedian, smhPct: smh, belowSmh }, null, 2)}\n`);
const frPct = v => `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(1).replace('.', ',')} %`;

const LINKS = [
  ['Cybersécurité', ['CRWD', 'OKTA', 'ZS', 'S', 'FTNT', 'PANW', 'TENB'], 'CIBR'],
  ['Semi-conducteurs et matériel', ['VICR', 'INTC', 'AMD', 'DELL', 'MU', 'HPE', 'MRVL', 'SMCI', 'AMKR', 'KLAC', 'ANET', 'TTMI', 'NVDA', 'AVGO', 'AAOI', 'SNPS'], 'SMH'],
  ['Logiciel et cloud', ['DDOG', 'SNOW', 'NOW', 'MDB', 'ORCL', 'CRM'], 'IGV'],
  ['Électricité des centres de données', ['BE', 'GEV', 'VST', 'CEG'], null],
  ['Calcul IA et mineurs', ['HUT', 'IREN', 'MARA', 'CLSK', 'CIFR', 'NBIS', 'CORZ', 'CRWV', 'APLD', 'WULF', 'CAN'], null],
  ['Crypto et trésoreries', ['BTC-USD', 'ETH-USD', 'MSTR', 'SBET', 'BMNR', 'COIN'], null],
  ['Mines de métaux précieux', ['EQX', 'AG', 'CDE'], null],
];
const linkBlocks = LINKS.map(([name, syms, etf]) => {
  const sorted = [...syms].sort((a, b) => raw(b, D27) - raw(a, D27) || a.localeCompare(b));
  const cells = sorted.map(s => { const v = since(s); return `<span class="chip ${cls(v)}"><strong>${s.replace('-USD', '')}</strong> ${v}</span>`; }).join(' ');
  const ref = etf ? `Fonds de référence ${etf} : ${since(etf)}.` : '';
  return `      <article class="data-card"><h3>${name}</h3><p class="chips">${cells}</p><p>${ref}</p></article>`;
}).join('\n');

// Graphiques : valeurs lues dans les barres, jamais saisies.
const allSyms = LINKS.flatMap(([, syms]) => syms).filter((s, i, a) => a.indexOf(s) === i).sort((a, b) => raw(b, D27) - raw(a, D27));
const chartSyms = [...allSyms.slice(0, 10), ...allSyms.slice(-10)];
const chartVals = chartSyms.map(s => Number(raw(s, D27).toFixed(1)));
const baseDates = S.NVDA.dates.slice(S.NVDA.at(D27), S.NVDA.last + 1);
const base100 = s => S[s].bars.slice(S[s].at(D27), S[s].last + 1).map(b => Number((b[4] / S[s].bars[S[s].at(D27)][1] * 100).toFixed(2)));
const leaderLine = s => `{name:'${s}',type:'line',showSymbol:false,endLabel:{show:true,formatter:'${s}'},data:${JSON.stringify(base100(s))}}`;
const vicrDates = S.VICR.dates.slice(S.VICR.at(D26), S.VICR.last + 1);
const vicrLine = S.VICR.bars.slice(S.VICR.at(D26), S.VICR.last + 1).map(b => b[4]);

const template = fs.readFileSync(path.join(ROOT, 'tools/_build-daily-20260915.js'), 'utf8');
const CSS = JSON.parse(/const CSS = ("(?:[^"\\]|\\.)*");/.exec(template)[1])
  + '.chips{display:flex;flex-wrap:wrap;gap:.4rem;margin:.4rem 0}.chip{font-size:.8rem;border-radius:999px;padding:.25rem .55rem;background:#edf3fa}.chip.up{color:var(--daily-green)}.chip.down{color:var(--daily-red)}';

const ref10 = () => claim('us10y', 'daily/20260924/primary-reference.json', '/facts/curve/y10/2026-09-23', PCT2, { authority: 'treasury_par_curve' });

// ---------------------------------------------------------------- page

const html = `<!DOCTYPE html>
<html lang="fr" data-tags="ai,tech,semis,software,retrospective,formation,crypto" data-tab="daily">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dossier spécial — la chaîne IA quatre semaines après le 27 août</title>
  <meta name="description" content="Dossier spécial du 24 septembre 2026 : ce que sont devenues la soixantaine de valeurs de la chaîne IA suivies le 27 août. Les niveaux publiés ont trié plus qu'ils n'ont prédit.">
  <meta property="og:title" content="Dossier spécial — la chaîne IA quatre semaines après le 27 août">
  <meta property="og:description" content="Cybersécurité et semi-conducteurs en tête, logiciel et électricité en retard, mines d'or en baisse.">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://articles.dailytickers.com/daily/20260924/bilan-chaine-ia-27-aout/">
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

<section class="hero-section"><div class="container"><div class="hero-date">Jeudi 24 septembre 2026 &bull; Dossier spécial &bull; Clôtures arrêtées au mardi 23 septembre</div><h1 class="hero-title">Le 27 août, revu quatre semaines plus tard.</h1><p class="hero-subtitle">Ce matin-là, le briefing suivait une soixantaine de valeurs de la chaîne de l’intelligence artificielle au lendemain des résultats de Nvidia. On reprend chaque appel, séance par séance. Les niveaux publiés ont surtout servi à trier ; les gaps ont tenu pour les uns, lâché pour les autres.</p><div class="hero-badges"><span class="hero-badge">Dossier spécial</span><span class="hero-badge">Bilan des niveaux du 27 août</span><span class="hero-badge">Chaîne IA par maillon</span></div><div id="article-clickable-tags" class="card-tags"></div></div></section>

<main class="report-main"><div class="container">
  <section id="alerte" class="decision-strip" data-status="validated">
    <article class="decision-card primary"><div class="decision-kicker">Verdict</div><h2>Les niveaux du 27 août ont servi de filtre, pas de prévision</h2><p>Douze valeurs avaient un seuil publié ce matin-là. Cinq l’ont franchi à la clôture, et une seule y a gagné : Vicor, ${chg('VICR', '2026-09-18', REFERENCE_CLOSE, 'post_verdict')} depuis son déclenchement. Les quatre autres ont échoué ou stagné. Rester à l’écart des sept qui n’ont jamais déclenché a peu coûté : toutes ont franchi leur niveau de faiblesse, quatre ont continué de baisser.</p></article>
    <article class="decision-card"><span class="status-pill">CONTRÔLÉ</span><h3>Méthode</h3><p>Clôtures quotidiennes du ${barDate('NVDA', '2026-08-24')} au ${barDate('NVDA', REFERENCE_CLOSE)}. Un seuil compte comme franchi à la première clôture au-delà, séance du 27 août incluse.</p></article>
    <article class="decision-card"><span class="status-pill partial">PARTIEL</span><h3>Ce qui n’est pas revu ici</h3><p>Les chiffres de résultats publiés le 27 août ne sont pas recontrôlés dans ce dossier. Le jugement porte sur les clôtures : ni le volume ni le prix moyen de séance ne sont testés.</p></article>
  </section>

  <section id="dashboard" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Tableau de bord</div><h2>Les fonds de référence depuis le 27 août</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <p class="section-intro">Le marché large a peu bougé : ${since('SPY')} pour le fonds S&amp;P 500 depuis la clôture du 27 août, ${since('QQQ')} pour le Nasdaq 100. L’écart est ailleurs. La cybersécurité (${since('CIBR')}) et les semi-conducteurs (${since('SMH')}) ont avancé ; le logiciel (${since('IGV')}) a rendu une partie de son gap. Le taux américain à dix ans a fini à ${ref10()} le 23 septembre.</p>
    <div class="dashboard-grid">
${['SPY', 'QQQ', 'XLK', 'SMH', 'SOXX', 'CIBR', 'HACK', 'IGV'].map(s => { const v = since(s); return `      <article class="dash-card"><div class="dash-label">${s}</div><div class="dash-value">${px(s)}</div><div class="dash-move ${cls(v)}">${v}</div><div class="dash-note">depuis le 27 août</div></article>`; }).join('\n')}
    </div>
  </section>

  <section id="leaders" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Séance du 27 août</div><h2>Les valeurs de la séance du 27 août</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <p class="section-intro">Nvidia, CrowdStrike, Okta et Salesforce avaient publié la veille au soir ; les quatre autres étaient suivies ce matin-là comme suiveurs ou en liste de surveillance. CrowdStrike était désigné comme la réaction la plus propre. Le conseil général était de ne pas payer un écart d’ouverture sans base, c’est-à-dire sans quelques séances de stabilisation.</p>
    <div class="table-scroll"><table class="data-table">
      <thead><tr><th>Valeur</th><th>Rôle le 27/08</th><th>Écart du jour</th><th>Ouverture 27/08</th><th>Depuis l’ouverture</th><th>Depuis la clôture</th></tr></thead>
      <tbody>
${sessionRows}
      </tbody>
    </table></div>
    <p class="section-intro">Tout dépend du point de départ. Acheté à l’ouverture du 27 août, ${literal(String(positiveFromOpen))} titres sur ${literal(String(SESSION.length))} sont en hausse aujourd’hui : CrowdStrike ${fromOpen('CRWD', 'open_txt')}, Okta ${fromOpen('OKTA', 'open_txt')}. Pris à la clôture du même jour, après le saut, Salesforce (${since('CRM')}), Nvidia (${since('NVDA')}), Tenable (${since('TENB')}) et Synopsys (${since('SNPS')}) sont en perte. Le conseil a protégé ceux qui auraient acheté tard dans la séance. Attendre n’a rien coûté sur CrowdStrike et Okta non plus, à condition d’accepter de voir le titre reculer d’environ ${literal('10 %')} sans acheter : la base s’est formée autour du prix d’ouverture. Du ${barDate('CRWD', '2026-09-02')} au ${barDate('CRWD', '2026-09-11')}, CrowdStrike a clôturé entre ${px('CRWD', '2026-09-02')} et ${px('CRWD', '2026-09-03')} (ouverture du 27 août : ${px('CRWD', D27, 1)}), Okta entre ${px('OKTA', '2026-09-02')} et ${px('OKTA', '2026-09-09')} (ouverture : ${px('OKTA', D27, 1)}). Même acheté au haut de cette base, CrowdStrike gagne ${chg('CRWD', '2026-09-03', REFERENCE_CLOSE, 'basehigh')} et Okta ${chg('OKTA', '2026-09-09', REFERENCE_CLOSE, 'basehigh')}.</p>
    <div id="leadersChart" class="echart-box" style="width:100%; height:300px; margin-top:1rem;"></div>
    <p class="provenance">Base 100 à l’ouverture du 27 août, puis clôtures quotidiennes.</p>
    <div class="quality-note warning-note"><strong>Il y a eu une base, mais elle était profonde.</strong> À la clôture du ${barDate('CRWD', '2026-09-02')}, par rapport à celle du 27 août, CrowdStrike était à ${ratioClaim('crwd_drawdown', S.CRWD.rel, `${S.CRWD.prefix}/${S.CRWD.at('2026-09-02')}/4`, `${S.CRWD.prefix}/${S.CRWD.at(D27)}/4`, PCT)} et Okta à ${ratioClaim('okta_drawdown', S.OKTA.rel, `${S.OKTA.prefix}/${S.OKTA.at('2026-09-02')}/4`, `${S.OKTA.prefix}/${S.OKTA.at(D27)}/4`, PCT)}. Celui qui avait acheté l’écart devait tenir ce creux sans savoir qu’il serait rattrapé.</div>
  </section>

  <section id="sympathies" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Appel révisé</div><h2>Les « rebonds sous résistance » : juste en moyenne, faux pour Intel et AMD</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <p class="section-intro">Douze valeurs étaient rangées parmi les rebonds de sympathie encore sous résistance, donc à ne pas poursuivre. Pris en bloc, le panier a bien avancé : ${literal(frPct(symMean))} en moyenne équipondérée, contre ${since('SMH')} pour le fonds des semi-conducteurs. Mais cette moyenne tient à trois noms : ${literal(String(belowSmh))} valeurs sur ${literal(String(SYMPATHY.length))} font moins bien que ce fonds, et la médiane n’est qu’à ${literal(frPct(symMedian))}.</p>
    <div class="table-scroll"><table class="data-table">
      <thead><tr><th>Valeur</th><th>Clôture 27/08</th><th>Clôture 23/09</th><th>Depuis le 27/08</th></tr></thead>
      <tbody>
${sympathyRows}
      </tbody>
    </table></div>
    <p class="section-intro">Intel et AMD sont de vrais ratés : aucun seuil n’avait été publié pour eux, et leur pire clôture après le 27 août n’a été qu’à ${ratioClaim('intc_pullback', S.INTC.rel, `${S.INTC.prefix}/${S.INTC.at(minCloseDate('INTC', D27))}/4`, `${S.INTC.prefix}/${S.INTC.at(D27)}/4`, PCT)} et ${ratioClaim('amd_pullback', S.AMD.rel, `${S.AMD.prefix}/${S.AMD.at(minCloseDate('AMD', D27))}/4`, `${S.AMD.prefix}/${S.AMD.at(D27)}/4`, PCT)}. Il n’y a pas eu de repli sérieux à attendre. Vicor est un autre cas : le 27 août fixait son seuil de réparation à ${literal('216,66 $')}, et ce seuil a fonctionné.</p>
    <p class="section-intro">Pour les trois, l’essentiel est venu tard. À la clôture du ${barDate('INTC', '2026-09-16')}, Intel n’avait pris que ${chg('INTC', D27, '2026-09-16', 'to0916')}, AMD ${chg('AMD', D27, '2026-09-16', 'to0916')}, et Vicor était encore à ${chg('VICR', D27, '2026-09-16', 'to0916')}.</p>
    <div class="quality-note risk-note"><strong>Pour qui n’a pas de position.</strong> Une hausse de trente pour cent en quatre semaines n’est pas une entrée. Aucun niveau n’est validé ici sur Intel ni sur AMD.</div>
  </section>

  <section id="niveaux" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Niveaux pré-ouverture</div><h2>Douze seuils publiés, cinq franchis à la clôture, un seul gagnant</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <p class="section-intro">Seuils tels qu’écrits le 27 août : déclenchement, puis niveau de faiblesse. Canaan n’avait pas de seuil (veto avant ses résultats) et reste hors du tableau.</p>
    <div class="table-scroll"><table class="data-table">
      <thead><tr><th>Valeur</th><th>Seuil / faiblesse</th><th>Ce qui s’est passé</th><th>Clôture 23/09</th><th>Du déclenchement à la sortie</th><th>Du déclenchement au 23/09</th><th>Depuis le 27/08</th></tr></thead>
      <tbody>
${levelTable}
      </tbody>
    </table></div>
    <div id="vicrChart" class="echart-box" style="width:100%; height:280px; margin-top:1rem;"></div>
    <p class="provenance">Vicor, clôtures depuis le 26 août, avec le seuil de ${literal('216,66 $')} publié le 27 août.</p>
    <div class="two-col">
      <div class="quality-note"><strong>Vicor : la règle a fait les deux choses.</strong> Elle a tenu à l’écart pendant la chute jusqu’à ${px('VICR', '2026-09-01')} le ${barDate('VICR', '2026-09-01')}, puis elle a déclenché au-dessus du seuil.</div>
      <div class="quality-note risk-note"><strong>MRSH, LPLA et ALLR : le niveau de faiblesse a coupé tôt.</strong> Les trois ont déclenché le lendemain, puis sont repassés sous leur niveau. Depuis cette sortie : MRSH ${chg('MRSH', '2026-09-04', REFERENCE_CLOSE, 'exit')}, LPLA ${chg('LPLA', '2026-09-15', REFERENCE_CLOSE, 'exit')}, ALLR ${chg('ALLR', '2026-09-08', REFERENCE_CLOSE, 'exit')}. Le déclenchement de MRSH n’était que partiel : son second seuil n’a jamais été franchi en clôture.</div>
    </div>
  </section>

  <section id="propagation" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Propagation</div><h2>Maillon par maillon, depuis la clôture du 27 août</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <p class="section-intro">Le 27 août posait une question simple : l’argent de l’IA reste-t-il dans les puces ou se diffuse-t-il ? Quatre semaines plus tard, il est allé dans la cybersécurité et dans une partie du matériel. Il a peu touché le logiciel.</p>
    <div class="three-col">
${linkBlocks}
    </div>
    <div id="linkChart" class="echart-box" style="width:100%; height:420px; margin-top:1rem;"></div>
    <p class="provenance">Les dix plus fortes hausses et les dix plus fortes baisses parmi les valeurs classées par maillon, depuis la clôture du 27 août.</p>
  </section>

  <section id="power" class="section-shell" data-status="partial">
    <div class="section-head"><div><div class="section-kicker">Deuxième ordre</div><h2>L’électricité n’a pas suivi, sans vraiment décrocher</h2></div><span class="status-pill partial">PARTIEL</span></div>
    <p class="section-intro">Le briefing du 27 août faisait de l’électricité le test d’un « cycle d’infrastructure ». Le signal est resté faible. GE Vernova (${since('GEV')}) et Vistra (${since('VST')}) sont à plat ; seul Constellation (${since('CEG')}) recule nettement, et Bloom Energy (${since('BE')}) a fortement monté sur la production sur site. Ce n’est donc pas « les puces seules » : la cybersécurité et Bloom ont suivi aussi.</p>
    <p class="section-intro">La hausse des taux longs pourrait peser sur les producteurs, qui financent leurs centrales à crédit. Ce dossier ne compare pas le groupe à un fonds des services aux collectivités : le lien reste une hypothèse.</p>
  </section>

  <section id="crypto" class="section-shell" data-status="partial">
    <div class="section-head"><div><div class="section-kicker">Crypto et métaux</div><h2>Une partie des mineurs a fait mieux que le bitcoin</h2></div><span class="status-pill partial">PARTIEL</span></div>
    <p class="section-intro">Le bitcoin a gagné ${since('BTC-USD')} depuis la bougie du 27 août, l’ether ${since('ETH-USD')}. Hut 8 (${since('HUT')}), IREN (${since('IREN')}) et Marathon (${since('MARA')}) ont fait mieux ; TeraWulf (${since('WULF')}) et Core Scientific (${since('CORZ')}) non. Le marché a payé certains passages du minage aux centres de données, pas tous.</p>
    <p class="section-intro">Les mines de métaux précieux ont reculé : Coeur ${since('CDE')}, First Majestic ${since('AG')}, Equinox ${since('EQX')}. La hausse des taux, défavorable aux métaux qui ne rapportent rien, pourrait y avoir contribué ; faute de fonds or ou argent dans ce dossier, le lien n’est pas mesuré.</p>
  </section>

  <section id="trade" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Et maintenant</div><h2>Niveaux à surveiller, revue le 22 octobre</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <p class="section-intro">Chaque ligne donne un seuil et ce qu’il invaliderait. Revue à la clôture du 22 octobre.</p>
    <div class="scenario-grid">
      <article class="scenario base"><h3>Cybersécurité : la diffusion tient</h3><p>CrowdStrike clôture à ${px('CRWD')}, au plus haut de la période (${px('CRWD', REFERENCE_CLOSE, 2)} en séance le 23 septembre). Une clôture sous ${px('CRWD', '2026-09-22')}, sa clôture du ${barDate('CRWD', '2026-09-22')}, mettrait la diffusion par la cybersécurité en doute.</p></article>
      <article class="scenario down"><h3>Synopsys : le saut du 27 août est presque effacé</h3><p>Le titre est revenu à ${px('SNPS')}, contre ${px('SNPS', D26)} la veille. Une clôture au-dessus de ${px('SNPS', D27)}, sa clôture du 27 août, montrerait que le marché rachète le mouvement.</p></article>
      <article class="scenario flat"><h3>Nvidia et Salesforce : en suspens</h3><p>Nvidia clôture à ${px('NVDA')}, sous sa clôture du 27 août (${px('NVDA', D27)}). Salesforce à ${px('CRM')}, contre ${px('CRM', D27)}. Reprendre ces clôtures est le premier test ; tant qu’elles ne le sont pas, les deux titres restent sous leur niveau du jour des résultats.</p></article>
      <article class="scenario up"><h3>Les gagnants tardifs : tenir, pas entrer</h3><p>Vicor (${px('VICR')}), Intel (${px('INTC')}) et AMD (${px('AMD')}) ont fait l’essentiel de leur hausse en septembre. Pour Vicor, une clôture sous ${literal('216,66 $')} annulerait la réparation. Pour Intel et AMD, aucun niveau n’est validé.</p></article>
    </div>
    <p class="provenance">Aucune de ces lignes n’est une idée de trade : aucun niveau d’entrée n’est validé ici. Aucun ordre ni aucune position ne sont utilisés.</p>
  </section>

  <section id="contexte" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Contexte</div><h2>Le décor a changé : les taux</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <p class="section-intro">Le 27 août se jouait sur des publications. Le 24 septembre se joue sur la courbe des taux : le dix ans a fini à ${ref10()}, son plus haut de clôture depuis juillet 2007, et le court terme monte plus vite que le long. Sur la même période, le logiciel a reculé et la cybersécurité a progressé ; ce dossier ne mesure pas quelle part revient aux taux.</p>
  </section>

  <section id="formation" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Formation</div><h2>Un niveau est un filtre, pas une prévision</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <p class="section-intro">Un seuil publié ne dit pas si le titre va monter. Il dit à partir de quand l’idée devient vraie, et à partir de quand elle devient fausse. Ce dossier le montre en chiffres : la plupart des seuils n’ont jamais été franchis, et ceux qui l’ont été ont souvent échoué juste après.</p>
    <p class="section-intro">Deux règles en sortent. D’abord, un seuil non atteint n’est pas un échec : AAOI, RZLV et Equinox ont baissé ensuite. Ensuite, le niveau de faiblesse sert surtout juste après le déclenchement : MRSH, LPLA et ALLR ont continué de baisser bien après la sortie.</p>
  </section>

  <section id="limites" class="section-shell" data-status="partial">
    <div class="section-head"><div><div class="section-kicker">Contrôle contradictoire</div><h2>Ce que ce bilan ne prouve pas</h2></div><span class="status-pill partial">PARTIEL</span></div>
    <p class="section-intro">Le jugement sur clôtures joue dans les deux sens. Il évite des faux déclenchements : RZLV a touché son seuil en séance dès le ${barDate('RZLV', '2026-08-28')} (plus haut ${px('RZLV', '2026-08-28', 2)}), TTMI le ${barDate('TTMI', '2026-09-08')} (plus haut ${px('TTMI', '2026-09-08', 2)}), sans jamais clôturer au-dessus. Il retarde aussi les sorties : MRSH est passé sous son niveau en séance le ${barDate('MRSH', '2026-09-01')} (plus bas ${px('MRSH', '2026-09-01', 3)}), trois séances avant la clôture qui compte ; LPLA le ${barDate('LPLA', '2026-09-14')}, une séance avant. Ni le volume ni le prix moyen de séance ne sont testés.</p>
    <p class="section-intro">La liste du 27 août venait d’un matin de résultats. Elle n’est pas un échantillon neutre de la chaîne IA, et quatre semaines ne suffisent pas à juger une thèse d’investissement.</p>
  </section>

  <section id="sources" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Sources et limites</div><h2>Sur quoi repose ce dossier</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <div class="source-list">
      <div class="source-item"><strong>Clôtures quotidiennes certifiées</strong><span>Cinquante-sept actions et huit fonds cotés américains, plus quatre cryptomonnaies en journée universelle, du 24 août au 23 septembre. Deux fournisseurs de barres, contrôlés séance par séance.</span></div>
      <div class="source-item"><strong>Seuils du 27 août</strong><span>Recopiés tels que publiés dans le briefing du 27 août ; ce sont des règles, pas des mesures.</span></div>
      <div class="source-item"><strong>Taux à dix ans</strong><span>Courbe officielle du Trésor américain pour la séance du 23 septembre.</span></div>
      <div class="source-item"><strong>Calcul des niveaux</strong><span>Reproductible, sur clôtures, publié avec ce dossier.</span></div>
    </div>
    <p class="section-intro">Ce contenu est informatif et pédagogique. Il ne constitue pas un conseil financier. Toute décision doit tenir compte de votre horizon, de votre tolérance au risque et du risque de perte en capital.</p>
  </section>
</div></main>

<div class="fnav" id="floatingNav"><div class="fnav-menu" id="fnavMenu"><a href="#alerte" class="fnav-item" data-section="alerte"><i class="fas fa-bullhorn"></i><span>Verdict</span></a><a href="#leaders" class="fnav-item" data-section="leaders"><i class="fas fa-trophy"></i><span>Leaders</span></a><a href="#niveaux" class="fnav-item" data-section="niveaux"><i class="fas fa-ruler-horizontal"></i><span>Niveaux</span></a><a href="#propagation" class="fnav-item" data-section="propagation"><i class="fas fa-diagram-project"></i><span>Maillons</span></a><a href="#trade" class="fnav-item" data-section="trade"><i class="fas fa-crosshairs"></i><span>Et maintenant</span></a><a href="#formation" class="fnav-item" data-section="formation"><i class="fas fa-graduation-cap"></i><span>Formation</span></a></div><button class="fnav-btn" id="fnavBtn" type="button" aria-label="Navigation"><i class="fas fa-bars" id="fnavIcon"></i><span class="fnav-btn-label" id="fnavLabel">Menu</span></button></div>
<footer class="article-footer">&copy; 2026 DailyTickers. Données arrêtées à la dernière clôture. Ceci n&rsquo;est pas un conseil financier.<br><a href="/" title="Home"><i class="fas fa-house"></i></a></footer>
<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js"></script>
<script>
(function(){
  var leaders=echarts.init(document.getElementById('leadersChart'));
  leaders.setOption({tooltip:{trigger:'axis'},legend:{data:['NVDA','CRWD','OKTA','CRM','SNPS','QQQ']},color:['#0072B2','#E69F00','#009E73','#CC79A7','#D55E00','#56B4E9'],grid:{left:48,right:70,top:48,bottom:42},xAxis:{type:'category',data:${JSON.stringify(baseDates)}},yAxis:{type:'value',scale:true},series:[${['NVDA', 'CRWD', 'OKTA', 'CRM', 'SNPS', 'QQQ'].map(leaderLine).join(',')}]});
  var vicr=echarts.init(document.getElementById('vicrChart'));
  vicr.setOption({tooltip:{trigger:'axis'},grid:{left:56,right:120,top:24,bottom:42},xAxis:{type:'category',data:${JSON.stringify(vicrDates)}},yAxis:{type:'value',scale:true},series:[{name:'VICR',type:'line',showSymbol:false,data:${JSON.stringify(vicrLine)},markPoint:{data:[{coord:['2026-09-18',${S.VICR.bars[S.VICR.at('2026-09-18')][4]}],value:'18/09'}]},markLine:{symbol:'none',label:{formatter:'seuil du 27/08 : 216,66 $'},data:[{yAxis:216.66}]}}]});
  var links=echarts.init(document.getElementById('linkChart'));
  links.setOption({tooltip:{trigger:'axis',valueFormatter:function(v){return v.toFixed(1)+' %';}},grid:{left:52,right:20,top:20,bottom:90},xAxis:{type:'category',data:${JSON.stringify(chartSyms.map(s => s.replace('-USD', '')))},axisLabel:{interval:0,rotate:60,fontSize:9}},yAxis:{type:'value'},series:[{type:'bar',data:${JSON.stringify(chartVals)}}]});
  window.addEventListener('resize',function(){leaders.resize();vicr.resize();links.resize();});
})();
</script>
<script src="/assets/echarts-responsive.js"></script>
<script src="/assets/core.js"></script>
<script src="/assets/tag-renderer.js"></script>
</body></html>
`;

const document = declareSpelledNumbers(html);
fs.writeFileSync(path.join(ROOT, ARTICLE), document);
fs.writeFileSync(path.join(ROOT, CLAIMS), `${JSON.stringify({
  schema_version: 1, reference_close: REFERENCE_CLOSE, article_path: ARTICLE,
  article_sha256: sha256(fs.readFileSync(path.join(ROOT, ARTICLE))), literals: [...literals], claims,
}, null, 2)}\n`);
console.log(`[build-bilan] ${ARTICLE} — ${document.length} octets, ${claims.length} claims, ${literals.size} littéraux`);
