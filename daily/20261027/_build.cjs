#!/usr/bin/env node
'use strict';

// Édition spéciale Or du 27 octobre 2026. Chaque chiffre visible dans <main> est un claim lié à
// un artefact collecté (harnais du jour, ou run certifié de la fiche EQX du même jour, même
// clôture de référence) ou au registre primaire du 22 octobre ; les niveaux de nos plans passés
// sont des littéraux déclarés (règles publiées, pas des mesures).

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { renderValue } = require('../../tools/validate-content-claims');
const { renderEventTimeline } = require('../../tools/lib/event-timeline.cjs');

const ROOT = path.resolve(__dirname, '../..');
const REL = 'daily/20261027';
const DIR = path.join(ROOT, REL);
const REF = '2026-10-26';
const WEEK = '2026-10-19';
const JUNE = '2026-06-25';
const AUG = '2026-08-25';
const PRIMARY = 'daily/20261022/primary-reference.json';

const sources = {
  idx: `${REL}/_data/bars_indices.json`, off: `${REL}/_data/off_hours.json`, reg: `${REL}/_data/regime.json`,
  eco: `${REL}/_data/economic_events.json`, st: `${REL}/_data/status.json`,
  fb: `${REL}/_focus/focus_bars.json`, ft: `${REL}/_focus/focus_technicals.json`,
  th: `${REL}/_themes/bars_themes.json`, thb: `${REL}/_themes-b/bars_themes.json`,
  cmp: 'analyses/EQX/_data/comparison_bars.json', eqb: 'analyses/EQX/_data/bars.json',
  rb: 'analyses/EQX/_data/rank_beta.json', ce: 'analyses/EQX/_data/comparison_earnings.json',
  er: 'analyses/EQX/_data/earnings_risk.json', ins: 'analyses/EQX/_data/instrument.json'
};
const D = Object.fromEntries(Object.entries(sources).map(([k, v]) => [k, JSON.parse(fs.readFileSync(path.join(ROOT, v), 'utf8'))]));
const primary = JSON.parse(fs.readFileSync(path.join(ROOT, PRIMARY), 'utf8'));
const digest = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex');
const esc = s => String(s).replace(/~/g, '~0').replace(/\//g, '~1');

function walk(node, pred, ptr = '') {
  if (pred(node)) return { node, ptr };
  if (Array.isArray(node)) { for (let i = 0; i < node.length; i++) { const h = walk(node[i], pred, `${ptr}/${i}`); if (h) return h; } }
  else if (node && typeof node === 'object') { for (const [k, v] of Object.entries(node)) { const h = walk(v, pred, `${ptr}/${esc(k)}`); if (h) return h; } }
  return null;
}
function hit(key, pred, label) { const h = walk(D[key], pred); if (!h) throw new Error(`${label} absent de ${key}`); return { ...h, key }; }

const claims = [];
const literals = new Set();
let seq = 0;
function claim(key, pointer, value, render, stem, formula) {
  const rendered = renderValue(formula ? formula.result : value, render);
  if (rendered == null) throw new Error(`rendu impossible ${stem}: ${JSON.stringify(value)}`);
  const id = `${stem}_${++seq}`.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const row = { id, rendered_text: rendered, source_artifact: sources[key], source_sha256: digest(sources[key]), source_pointer: pointer, source_value: value, render };
  if (formula) row.formula = formula;
  claims.push(row);
  return `<span data-claim="${id}">${rendered}</span>`;
}
const lit = v => { literals.add(String(v)); return `<span data-literal>${v}</span>`; };
function registry(pointer, render, stem, authority) {
  const value = pointer.slice(1).split('/').reduce((n, k) => n[k], primary);
  if (value === undefined || !primary.sources[authority]) throw new Error(`registre ${pointer}`);
  const rendered = renderValue(value, render);
  const id = `${stem}_${++seq}`.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  claims.push({ id, rendered_text: rendered, source_artifact: PRIMARY, source_sha256: digest(PRIMARY), source_pointer: pointer, source_value: value, render, authority });
  return `<span data-claim="${id}">${rendered}</span>`;
}
const fr = (decimals, suffix = '', sign) => ({ scale: 1, decimals, suffix, format: 'fr', ...(sign ? { sign: 'always' } : {}) });
const dateR = parts => ({ format: 'fr_date', parts });
const timeR = zone => ({ format: 'fr_time', zone });

// ── Barres ───────────────────────────────────────────────────────────────────
function series(key, symbol) {
  const h = hit(key, x => x && x.symbol === symbol && Array.isArray(x.bars) && x.bars.length, `barres ${symbol}`);
  const b = h.node.bars;
  if (b[b.length - 1][0] !== REF) throw new Error(`${symbol}@${key}: dernière barre ${b[b.length - 1][0]}`);
  return { key, ptr: h.ptr, bars: b };
}
const idxOf = (s, date) => { const i = s.bars.findIndex(x => x[0] === date); if (i < 0) throw new Error(`date ${date} absente`); return i; };
const COL = { open: 1, high: 2, low: 3, close: 4, volume: 5 };
function px(key, symbol, date = REF, col = 'close', decimals = 2, stem = 'px') {
  const s = series(key, symbol), i = idxOf(s, date), c = COL[col];
  return claim(key, `${s.ptr}/bars/${i}/${c}`, s.bars[i][c], fr(decimals, col === 'volume' ? '' : ' $'), `${stem}_${symbol}`);
}
function chg(key, symbol, from, to = REF, decimals = 1, stem = 'chg') {
  const s = series(key, symbol), i = idxOf(s, to), j = idxOf(s, from);
  const value = (s.bars[i][4] / s.bars[j][4] - 1) * 100;
  return claim(key, `${s.ptr}/bars/${i}/4`, s.bars[i][4], fr(decimals, ' %', true), `${stem}_${symbol}`,
    { operation: 'ratio_pct', numerator_pointer: `${s.ptr}/bars/${i}/4`, denominator_pointer: `${s.ptr}/bars/${j}/4`, result: value });
}
const chgValue = (key, symbol, from, to = REF) => { const s = series(key, symbol); return (s.bars[idxOf(s, to)][4] / s.bars[idxOf(s, from)][4] - 1) * 100; };
function bdate(key, symbol, date, parts = 'day_month', stem = 'd') {
  const s = series(key, symbol), i = idxOf(s, date);
  return claim(key, `${s.ptr}/bars/${i}/0`, s.bars[i][0], dateR(parts), `${stem}_${symbol}`);
}
// Première séance après `after` dont la colonne franchit le seuil (pour l'audit des plans).
function firstTouch(key, symbol, after, col, test) {
  const s = series(key, symbol), c = COL[col];
  const i = s.bars.findIndex(x => x[0] > after && test(x[c]));
  if (i < 0) return null;
  return { s, i, date: s.bars[i][0], value: s.bars[i][c], c };
}
const touchVal = (t, decimals, stem) => claim(t.s.key, `${t.s.ptr}/bars/${t.i}/${t.c}`, t.value, fr(decimals, ' $'), stem);
const touchDate = (t, stem, parts = 'day_month') => claim(t.s.key, `${t.s.ptr}/bars/${t.i}/0`, t.date, dateR(parts), stem);
function extreme(key, symbol, after, before, col, kind) {
  const s = series(key, symbol), c = COL[col];
  let best = -1;
  s.bars.forEach((x, i) => { if (x[0] > after && x[0] <= before && (best < 0 || (kind === 'min' ? x[c] < s.bars[best][c] : x[c] > s.bars[best][c]))) best = i; });
  return { s, i: best, date: s.bars[best][0], value: s.bars[best][c], c };
}

// ── Contexte courant, régime, agenda ─────────────────────────────────────────
const obs = (facet, asset) => {
  const f = D.off.facets[facet];
  const i = f.observations.findIndex(o => o.canonical_asset === asset);
  if (i < 0) throw new Error(`hors séance: ${asset}`);
  return { ptr: `/facets/${facet}/observations/${i}`, node: f.observations[i] };
};
const xau = obs('metals', 'XAU_USD_SPOT'), dxy = obs('futures', 'DXY');
if (Math.abs(xau.node.price / 4026.3 - 1) > 0.01 || Math.abs(dxy.node.price / 102.2 - 1) > 0.01) throw new Error('relevé hors séance inattendu');
const offAsOf = stem => claim('off', '/as_of', D.off.as_of, timeR('Europe/Paris'), stem);
const xauPx = stem => claim('off', `${xau.ptr}/price`, xau.node.price, fr(0, ' $'), stem);
const dxyPx = stem => claim('off', `${dxy.ptr}/price`, dxy.node.price, fr(1), stem);
const dxyTime = stem => claim('off', `${dxy.ptr}/observed_at`, dxy.node.observed_at, timeR('Europe/Paris'), stem);

const pm = re => hit('reg', x => x && x.type === 'prediction_market' && re.test(x.question || '') && typeof x.yes_price === 'number', 'Polymarket');
const pmHold = pm(/no change in Fed interest rates after the October 2026/), pmHike = pm(/increase interest rates by 25 bps after the October 2026/);
const pmv = (h, stem) => claim('reg', `${h.ptr}/yes_price`, h.node.yes_price, { scale: 100, decimals: 1, suffix: ' %', format: 'fr' }, stem);

const econ = (name, day) => hit('eco', x => x && x.name === name && typeof x.event_time === 'string' && x.event_time.slice(0, 10) === day, name);
const fomc = econ('FOMC Rate Decision', '2026-10-28'), press = econ('Federal Reserve FOMC Press Conference', '2026-10-28');
const pce = econ('Core PCE Price Index (Personal Income & Outlays)', '2026-10-29'), ecb = econ('ECB Rate Decision', '2026-10-29');
const hicp = econ('Euro Area Flash HICP (Inflation)', '2026-10-30');
const paris = (h, stem) => claim('eco', `${h.ptr}/event_time`, h.node.event_time, timeR('Europe/Paris'), stem);
const eday = (h, stem, parts = 'weekday_day_month') => claim('eco', `${h.ptr}/event_time`, h.node.event_time, dateR(parts), stem);
const nyCloseH = '/operation_readiness/bars_daily_us_equity/current_bar_closes_at';
const nyClose = stem => claim('st', nyCloseH, D.st.operation_readiness.bars_daily_us_equity.current_bar_closes_at, timeR('Europe/Paris'), stem);
if (D.st.operation_readiness.bars_daily_us_equity.current_bar_closes_at !== '2026-10-27T20:00:00Z') throw new Error('heure de clôture de New York inattendue');

const earn = sym => hit('ce', x => x && x.symbol === sym && x.report_date, `résultats ${sym}`);
const aem = earn('AEM'), kgc = earn('KGC'), wpm = earn('WPM');
if (aem.node.report_date !== '2026-10-28' || kgc.node.report_date !== '2026-10-28' || wpm.node.report_date !== '2026-11-05') throw new Error('dates de résultats décalées');
const edate = (h, stem, parts = 'weekday_day_month') => claim(h.key, `${h.ptr}/report_date`, h.node.report_date, dateR(parts), stem);
const eqxEarn = hit('er', x => x && x.symbol === 'EQX' && x.report_date, 'résultats EQX');
if (eqxEarn.node.report_date !== '2026-11-09') throw new Error('date EQX décalée');

const rbRow = sym => hit('rb', x => x && x.symbol === sym && typeof x.dollar_adv_median === 'number', `rank_beta ${sym}`);
const capB = (sym, stem) => { const h = rbRow(sym); return claim('rb', `${h.ptr}/market_cap`, h.node.market_cap, { scale: 1e-9, decimals: 1, suffix: ' Md$', format: 'fr' }, stem); };
const advM = (sym, stem) => { const h = rbRow(sym); return claim('rb', `${h.ptr}/dollar_adv_median`, h.node.dollar_adv_median, { scale: 1e-6, decimals: 0, suffix: ' M$', format: 'fr' }, stem); };
const tech = sym => hit('ft', x => x && x.symbol === sym && typeof x.rsi === 'number', `technique ${sym}`);
const rsi = (sym, stem) => { const h = tech(sym); if (h.node.last_bar_date !== REF) throw new Error(`RSI ${sym}`); return claim('ft', `${h.ptr}/rsi`, h.node.rsi, fr(0), stem); };
const eqxCapH = hit('ins', x => x && typeof x.marketCap === 'number', 'capitalisation EQX');
const eqxCap = stem => claim('ins', `${eqxCapH.ptr}/marketCap`, eqxCapH.node.marketCap, { scale: 1e-9, decimals: 1, suffix: ' Md$', format: 'fr' }, stem);

// ── Contrôles de cohérence : la page n'écrit que ce que les barres disent ────
const wk = (k, s) => chgValue(k, s, WEEK);
if (!(wk('cmp', 'GDX') < wk('cmp', 'GLD') && wk('th', 'SIL') < wk('cmp', 'GDX'))) throw new Error('ordre or / mines / argent inattendu');
if (!(chgValue('idx', 'TLT', '2026-10-21', '2026-10-22') > 0 && chgValue('idx', 'GLD', '2026-10-21', '2026-10-22') < 0)) throw new Error('lecture du 22 octobre à revoir');
if (Math.abs(chgValue('cmp', 'GLD', JUNE)) > 1) throw new Error('GLD ne serait plus à son niveau du 25 juin');
const gldMinClose = extreme('cmp', 'GLD', JUNE, REF, 'close', 'min');
if (gldMinClose.date !== '2026-07-16' || gldMinClose.value < 363) throw new Error('plus bas de clôture GLD inattendu');
const gldTp = firstTouch('cmp', 'GLD', JUNE, 'high', v => v >= 391);
const gldConf = firstTouch('cmp', 'GLD', JUNE, 'close', v => v > 391);
if (gldTp.date !== '2026-08-05' || gldConf.date !== '2026-08-07') throw new Error('confirmation GLD décalée');
const juneStops = [['FNV', 200, 'Franco-Nevada', 'redevances, palier prudent'], ['AEM', 143, 'Agnico Eagle', 'producteur, palier prudent'],
  ['WPM', 105.5, 'Wheaton', 'redevances, palier intermédiaire'], ['AGI', 28.2, 'Alamos', 'producteur, palier intermédiaire'],
  ['IAG', 14.55, 'Iamgold', 'producteur, palier intermédiaire'], ['RGLD', 193, 'Royal Gold', 'redevances, hors paliers']];
const stopRows = juneStops.map(([s, stop, name, role]) => {
  const t = firstTouch('cmp', s, JUNE, 'low', v => v <= stop);
  if (!t || t.date > '2026-07-15') throw new Error(`${s}: stop de juin non touché en juillet`);
  const top = extreme('cmp', s, JUNE, REF, 'high', 'max');
  if (top.date < '2026-08-25' || top.date > '2026-08-28') throw new Error(`${s}: sommet hors fin août`);
  return { s, stop, name, role, t, top };
});
const egoLow = extreme('cmp', 'EGO', '2026-08-06', REF, 'low', 'min');
if (egoLow.value <= 30.6) throw new Error('EGO serait entré dans sa zone');
const febFill = firstTouch('cmp', 'GLD', '2026-02-13', 'low', v => v <= 465);
const febTop = extreme('cmp', 'GLD', '2026-02-13', '2026-03-18', 'close', 'max');
const febStop = firstTouch('cmp', 'GLD', '2026-02-13', 'low', v => v <= 420);
if (febFill.date !== '2026-02-17' || febTop.date !== '2026-03-02' || febStop.date !== '2026-03-19' || extreme('cmp', 'GLD', '2026-02-13', '2026-03-18', 'high', 'max').value >= 510) throw new Error('audit de février à revoir');
const julyTp = ['GLD', 'GDX', 'AEM'].map(s => firstTouch('cmp', s, '2026-07-27', 'high', v => v >= { GLD: 389, GDX: 80, AEM: 160 }[s]));
if (!julyTp.every(t => t.date === '2026-08-05')) throw new Error('objectifs du 28 juillet décalés');
const julyGld2 = firstTouch('cmp', 'GLD', '2026-07-27', 'high', v => v >= 400);
const julyEqx = firstTouch('eqb', 'EQX', '2026-07-27', 'high', v => v >= 11);
const julyStops = [['GLD', 364], ['GDX', 71], ['AEM', 137]].map(([s, st]) => firstTouch('cmp', s, '2026-07-27', 'low', v => v <= st));
const eqxJulStop = firstTouch('eqb', 'EQX', '2026-07-27', 'low', v => v <= 8.75);
const eqxJulMinClose = extreme('eqb', 'EQX', '2026-07-27', '2026-08-07', 'close', 'min');
if (julyGld2.date !== '2026-08-07' || julyEqx.date !== '2026-08-07' || julyStops.some(t => t && t.date < '2026-08-08') || eqxJulStop.date !== '2026-07-29' || eqxJulMinClose.value <= 8.75) throw new Error('audit du 28 juillet à revoir');
const sepAbandon = firstTouch('eqb', 'EQX', '2026-09-25', 'close', v => v < 11.42);
const sepTrigger = firstTouch('eqb', 'EQX', '2026-09-25', 'high', v => v >= 12.87);
if (sepAbandon.date !== '2026-09-28' || (sepTrigger && sepTrigger.date < sepAbandon.date)) throw new Error('audit EQX de septembre à revoir');
// Plan or au comptant du 21 juin : notre fiche de février faisait correspondre 365,04 $ sur GLD
// à environ 3 980 $ l'once (le stop). On ne mesure que les plus bas de séance de GLD sous ce repère.
const xauLow1 = { s: series('cmp', 'GLD'), date: '2026-06-24' }, xauLow2 = { s: series('cmp', 'GLD'), date: '2026-07-17' };
for (const t of [xauLow1, xauLow2]) { t.i = idxOf(t.s, t.date); t.c = 3; t.value = t.s.bars[t.i][3]; if (!(t.value < 365.04)) throw new Error('audit du 21 juin à revoir'); }
const xauClose24 = series('cmp', 'GLD').bars[idxOf(series('cmp', 'GLD'), '2026-06-24')][4];
if (!(xauClose24 > 365.04)) throw new Error('clôture du 24 juin à revoir');
// Plan Equinox du 11 juillet (archive) : stop 8,85 $ touché le 16 juillet.
const eqxJul11 = firstTouch('eqb', 'EQX', '2026-07-10', 'low', v => v <= 8.85);
if (eqxJul11.date !== '2026-07-16') throw new Error('audit EQX du 11 juillet à revoir');
// USAS : ligne à défendre de 3,53 $ cédée le 22 octobre.
const usasBreak = firstTouch('th', 'USAS', '2026-10-05', 'close', v => v < 3.53);
if (usasBreak.date !== '2026-10-22') throw new Error('audit USAS à revoir');
// Achats autorisés par la confirmation du 7 août, jamais soldés (seule sortie : GLD < 363 $ en clôture).
const CONF = '2026-08-07';
if (!(chgValue('cmp', 'GDX', CONF) < 0 && chgValue('cmp', 'GDXJ', CONF) < 0)) throw new Error('lignes post-confirmation à revoir');
const eqxAug7Low = series('eqb', 'EQX').bars[idxOf(series('eqb', 'EQX'), CONF)][3];
if (!(eqxAug7Low > 10.8)) throw new Error('EQX sous son premier objectif le 7 août');
const fbWk = chgValue('cmp', 'FNV', WEEK), rgWk = chgValue('cmp', 'RGLD', WEEK);
if (!['GDX', 'NEM', 'AEM', 'KGC', 'WPM'].every(s => chgValue('cmp', s, WEEK) < Math.max(fbWk, rgWk))) throw new Error('les redevances ne baissent plus le moins');

// ── Mise en page ─────────────────────────────────────────────────────────────
const section = (id, kicker, title, pill, status, body) => `<section id="${id}" class="section-shell" data-status="${status}"><div class="section-head"><div><div class="section-kicker">${kicker}</div><h2>${title}</h2></div>${pill}</div>${body}</section>`;
const pill = (t, cls = '') => `<span class="status-pill${cls ? ' ' + cls : ''}">${t}</span>`;
const table = (head, rows, cls = 'data-table') => `<div class="table-scroll"><table class="${cls}"><thead><tr>${head.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const dash = (label, value, move, note, dir) => `<article class="dash-card"><div class="dash-label">${label}</div><div class="dash-value">${value}</div><div class="dash-move ${dir}">${move}</div><div class="dash-note">${note}</div></article>`;
const dir = v => (v >= 0 ? 'up' : 'down');
const sections = [];

const weekFrom = stem => bdate('idx', 'GLD', WEEK, 'weekday_day_month', stem);
const refDay = (stem, parts = 'weekday_day_month') => bdate('idx', 'GLD', REF, parts, stem);
const d22 = '2026-10-22', d21 = '2026-10-21';
const gld21 = stem => px('cmp', 'GLD', d21, 'close', 2, stem);
const gldLow = stem => touchVal(gldMinClose, 2, stem);
const pmHoldR = (stem) => claim('reg', `${pmHold.ptr}/yes_price`, pmHold.node.yes_price, { scale: 100, decimals: 2, suffix: ' %', format: 'fr' }, stem);
const ceaseIdx = D.off.facets.predictions.observations.findIndex(o => /US x Iran ceasefire continues through October 31/.test(o.metadata && o.metadata.question || ''));
if (ceaseIdx < 0) throw new Error('cessez-le-feu absent');
const ceaseNode = D.off.facets.predictions.observations[ceaseIdx];
const ceasePtr = `/facets/predictions/observations/${ceaseIdx}`;
const reg = (ptr, render, stem, auth) => registry(ptr, render, stem, auth);

// 1. L'essentiel
sections.push(`<section id="essentiel" class="decision-strip" data-status="validated">`
  + `<article class="decision-card primary"><div class="decision-kicker">Décision</div><h2>Ni achat ni vente sur l’or avant jeudi ${nyClose('nyc_h')}</h2><p>L’once au comptant valait ${xauPx('xau_a')} ce mardi à ${offAsOf('xau_t_a')}, heure de Paris. Depuis la clôture du ${weekFrom('wk_a')}, GLD, fonds américain adossé à l’or, a fait ${chg('cmp', 'GLD', WEEK, REF, 1, 'gld_wk_a')}, les mines d’or (GDX) ${chg('cmp', 'GDX', WEEK, REF, 1, 'gdx_wk_a')}, les mines d’argent (SIL) ${chg('th', 'SIL', WEEK, REF, 1, 'sil_wk_a')}. Selon la presse, le marché parie sur une nouvelle hausse des taux de la Fed en décembre, et le dollar monte.</p><p>D’ici jeudi : la Fed mercredi à ${paris(fomc, 'fomc_a')}, Agnico Eagle et Kinross mercredi après la clôture de New York (${nyClose('nyc_a2')} à Paris), l’inflation américaine jeudi à ${paris(pce, 'pce_a')}. Le verdict tombe à la clôture de New York jeudi, ${nyClose('nyc_a')} à Paris, Bourses européennes fermées : rien ne se fait avant vendredi matin sur un fonds or coté en Europe. D’ici là, aucun achat, et pas de vente de panique sur une ligne d’or gardée pour diversifier une épargne. Equinox Gold : rien avant ses résultats du ${edate(eqxEarn, 'eqx_d0', 'day_month')}.</p></article>`
  + `<article class="decision-card">${pill('À SURVEILLER', 'partial')}<h3>Les niveaux sur GLD</h3><p>Une clôture sous ${gldLow('gld_min_a')}, son plus bas de clôture depuis juin, prolonge la baisse. Au-dessus de ${gld21('gld_21_a0')}, sa clôture du ${bdate('cmp', 'GLD', d21, 'day_month', 'd21_a0')}, le décrochage du ${bdate('idx', 'GLD', d22, 'day_month', 'd22_a0')} est effacé. Lundi : ${px('cmp', 'GLD', REF, 'close', 2, 'gld_px_a')}. GLD n’est pas achetable depuis la France : suivez sa clôture comme un thermomètre.</p></article>`
  + `<article class="decision-card">${pill('BILAN', 'risk')}<h3>Nos appels</h3><p>En juin, GLD a touché notre objectif de ${lit('391 $')} le ${touchDate(gldTp, 'gld_tp_a')}. Mais toutes nos lignes de mines ont touché leur stop en juillet, avant la hausse d’août, et les mines que notre règle faisait acheter après la confirmation d’août sont en perte.</p></article>`
  + `</section>`);

// 2. Tableau
const moveSyms = [['cmp', 'GLD', 'Or (GLD)'], ['idx', 'SLV', 'Argent (SLV)'], ['cmp', 'GDX', 'Mines d’or (GDX)'], ['cmp', 'GDXJ', 'Petites mines d’or (GDXJ)'], ['th', 'SIL', 'Mines d’argent (SIL)'],
  ['cmp', 'NEM', 'Newmont'], ['cmp', 'AEM', 'Agnico Eagle'], ['cmp', 'KGC', 'Kinross'], ['cmp', 'FNV', 'Franco-Nevada'], ['cmp', 'RGLD', 'Royal Gold'], ['cmp', 'WPM', 'Wheaton'],
  ['fb', 'EQX', 'Equinox Gold'], ['fb', 'HL', 'Hecla'], ['fb', 'CDE', 'Coeur'], ['fb', 'EXK', 'Endeavour Silver'], ['fb', 'NG', 'NovaGold'],
  ['th', 'HYMC', 'Hycroft'], ['th', 'USAS', 'Americas Gold & Silver'], ['thb', 'AUGO', 'Aura Minerals'], ['thb', 'AYA', 'Aya Gold & Silver'], ['th', 'ITRG', 'Integra'],
  ['th', 'COPX', 'Mines de cuivre (COPX)'], ['idx', 'TLT', 'Obligations longues (TLT)'], ['idx', 'USO', 'Pétrole (USO)']];
const moveData = moveSyms.map(([k, s, label]) => ({ s, label, v: +wk(k, s).toFixed(2) })).sort((a, b) => a.v - b.v);
sections.push(section('dashboard', 'Le tableau', 'Une semaine de repli, les mines au premier rang', pill('CONTRÔLÉ'), 'validated',
  `<div class="dashboard-grid">`
  + dash('Or au comptant', xauPx('xau_b'), `relevé à ${offAsOf('xau_t_b')}`, 'indicatif, pas une clôture', 'flat')
  + dash('Fonds or GLD', px('cmp', 'GLD', REF, 'close', 2, 'gld_px'), chg('cmp', 'GLD', WEEK, REF, 1, 'gld_wk_b'), 'clôture de lundi', dir(wk('cmp', 'GLD')))
  + dash('Fonds argent SLV', px('idx', 'SLV', REF, 'close', 2, 'slv_px'), chg('idx', 'SLV', WEEK, REF, 1, 'slv_wk_b'), 'clôture de lundi', dir(wk('idx', 'SLV')))
  + dash('Mines d’or GDX', px('cmp', 'GDX', REF, 'close', 2, 'gdx_px'), chg('cmp', 'GDX', WEEK, REF, 1, 'gdx_wk_b'), 'clôture de lundi', dir(wk('cmp', 'GDX')))
  + dash('Mines d’argent SIL', px('th', 'SIL', REF, 'close', 2, 'sil_px'), chg('th', 'SIL', WEEK, REF, 1, 'sil_wk_b'), 'clôture de lundi', dir(wk('th', 'SIL')))
  + dash('Obligations longues TLT', px('idx', 'TLT', REF, 'close', 2, 'tlt_px'), chg('idx', 'TLT', WEEK, REF, 1, 'tlt_wk_b'), 'en hausse : taux longs en baisse', dir(wk('idx', 'TLT')))
  + dash('Indice du dollar DXY', dxyPx('dxy_b'), `relevé à ${dxyTime('dxy_t_b')}`, 'indicatif, pas une clôture', 'flat')
  + dash('Fed mercredi : taux inchangés', pmHoldR('pm_hold_b'), `hausse : ${pmv(pmHike, 'pm_hike_b')}`, 'chances selon Polymarket', 'flat')
  + `</div>`
  + `<div id="movesChart" class="echart-box" role="img" aria-label="Variation de chaque fonds et de chaque mine depuis la clôture du lundi précédent, en pourcentage" style="width:100%; height:640px; margin-top:1rem;"></div>`
  + `<p class="provenance">Variations de la clôture du ${weekFrom('wk_c')} à celle du ${refDay('ref_c')}. L’once au comptant et le dollar sont des relevés de ce mardi pendant la séance, pas des clôtures. Lecture : toutes les mines baissent plus que l’or ; les sociétés de redevances (Royal Gold, Franco-Nevada) baissent le moins. La taille ne départage pas : Coeur, la plus grosse capitalisation de notre tableau des mines (${capB('CDE', 'cap_cde_c')}), fait ${chg('fb', 'CDE', WEEK, REF, 1, 'cde_wk_c')}, plus que Hycroft (${chg('th', 'HYMC', WEEK, REF, 1, 'hymc_wk_c')}).</p>`));

// 3. Pourquoi
sections.push(section('pourquoi', 'La cause', 'Ce qui pèse sur l’or : la réunion de décembre, pas celle de mercredi', pill('ATTRIBUÉ', 'partial'), 'partial',
  `<p class="section-intro">Mercredi, la Fed ne devrait pas bouger : sur Polymarket, un site de paris en ligne, les contrats donnent ${pmHoldR('pm_hold_c')} de chances à des taux inchangés et ${pmv(pmHike, 'pm_hike_c')} à une petite hausse. Le sujet est la réunion suivante. Selon une dépêche Reuters reprise par Kitco ce mardi matin, les contrats à terme sur les taux donnent une nette majorité de chances à une hausse en décembre, et le dollar touche son plus haut depuis une quinzaine de jours. La Fed a déjà relevé son taux le ${reg('/facts/fed/last_decision_date', dateR('day_month'), 'fed_last', 'fomc_statement_20260916')}, à ${reg('/facts/fed/target_low_pct', fr(2, ' %'), 'fed_lo', 'fomc_statement_20260916')}–${reg('/facts/fed/target_high_pct', fr(0, ' %'), 'fed_hi', 'fomc_statement_20260916')}. Publiés le ${reg('/facts/cpi/release_date', dateR('day_month'), 'cpi_rel', 'bls_cpi')}, les prix de septembre étaient en hausse de ${reg('/facts/cpi/sep_yoy_pct', fr(1, ' %'), 'cpi', 'bls_cpi')} sur un an. L’or ne verse aucun intérêt : quand les placements sans risque rapportent plus, il perd de son attrait.</p>`
  + `<p class="section-intro">La chute s’est faite le ${bdate('idx', 'GLD', d22, 'weekday_day_month', 'd22')}. Le Brent est monté jusqu’à ${reg('/facts/oil/brent_high_usd', fr(2, ' $'), 'brent', 'press_reuters_brent')} (Reuters) ; l’annonce iranienne de pétroliers touchés près d’Ormuz n’était pas confirmée, comme nous l’écrivions ce jour-là. Selon TIKR, le marché misait alors largement sur une hausse en décembre. GLD a fait ${chg('idx', 'GLD', d21, d22, 1, 'gld_22')}, SLV ${chg('idx', 'SLV', d21, d22, 1, 'slv_22')}, Americas Gold &amp; Silver ${chg('th', 'USAS', d21, d22, 1, 'usas_22')}, Coeur ${chg('fb', 'CDE', d21, d22, 1, 'cde_22')}. Le même jour, selon TIKR, le courtier Freedom Broker a abaissé Barrick, Newmont et Agnico Eagle à « conserver ».</p>`
  + `<div class="quality-note"><strong>Ce que nos chiffres montrent, et ce qu’ils ne mesurent pas.</strong> Ce jeudi-là, le Nasdaq ${lit('100')} (QQQ) a fait ${chg('idx', 'QQQ', d21, d22, 1, 'qqq_22')} et le fonds d’obligations longues TLT ${chg('idx', 'TLT', d21, d22, 1, 'tlt_22')} : l’or a été vendu avec la tech pendant que l’argent allait vers la dette américaine, comme le relevait notre hebdo du ${lit('26 octobre')}. La baisse de la semaine ne vient pas d’une hausse des taux longs (TLT ${chg('idx', 'TLT', WEEK, REF, 1, 'tlt_wk_c')}). Leur niveau, lui, pèse : le taux américain à ${lit('10 ans')} est à ${lit('5 %')} ou plus depuis le ${reg('/facts/curve/y10_streak_ge5_start', dateR('day_month'), 'y10_start', 'treasury_par_curve')}, avec un sommet de l’année à ${reg('/facts/curve/y10_2026_max', fr(2, ' %'), 'y10_max', 'treasury_par_curve')} le ${reg('/facts/curve/y10_2026_max_date', dateR('day_month'), 'y10_maxd', 'treasury_par_curve')}. Le taux à ${lit('2 ans')}, qui suit les attentes sur la Fed, est passé de ${reg('/facts/curve/y2/2026-08-25', fr(2, ' %'), 'y2_a', 'treasury_par_curve')} le ${bdate('cmp', 'GLD', AUG, 'day_month', 'aug_y2')} à ${reg('/facts/curve/y2/2026-10-21', fr(2, ' %'), 'y2_b', 'treasury_par_curve')} le ${bdate('cmp', 'GLD', d21, 'day_month', 'd21_y2')}, pendant que GLD faisait ${chg('cmp', 'GLD', AUG, d21, 1, 'gld_aug21')}. Le pari sur décembre et le plus haut du dollar viennent de la presse : nous ne les mesurons pas pour jeudi. Ce mardi, l’indice du dollar (DXY) est à ${dxyPx('dxy_c')}, ${claim('off', `${dxy.ptr}/returns/72h_pct`, dxy.node.returns['72h_pct'], fr(1, ' %', true), 'dxy_72')} sur les dernières ${lit('72 heures')}. Autre lecture à garder en tête : sur Polymarket, le maintien du cessez-le-feu entre les États-Unis et l’Iran jusqu’au ${lit('31 octobre')} est coté ${claim('off', `${ceasePtr}/price`, ceaseNode.price, { scale: 100, decimals: 1, suffix: ' %', format: 'fr' }, 'cease')}, ${claim('off', `${ceasePtr}/metadata/price_change_7d`, ceaseNode.metadata.price_change_7d, { scale: 100, decimals: 0, suffix: ' pts', format: 'fr', sign: 'always' }, 'cease7')} en ${lit('sept jours')} : une prime de guerre qui se dégonfle pèse aussi sur l’or.</div>`));

// 4. Mines
const mineRows = [
  ['HL', 'Hecla', 'or', 'fb'], ['CDE', 'Coeur', 'argent', 'fb'], ['AUGO', 'Aura Minerals', 'or, argent', 'thb'], ['EXK', 'Endeavour Silver', 'argent', 'fb'],
  ['NG', 'NovaGold', 'or', 'fb'], ['AYA', 'Aya Gold &amp; Silver', 'or, argent, cuivre', 'thb'], ['HYMC', 'Hycroft', 'or, argent', 'th'], ['USAS', 'Americas Gold &amp; Silver', 'or, argent', 'th']
].map(([s, name, list, k]) => [`<strong>${s}</strong> · ${name}`, list, chg(k, s, WEEK, REF, 1, `m_${s}`), advM(s, `adv_${s}`), capB(s, `cap_${s}`)]);
mineRows.push(['<strong>EQX</strong> · Equinox Gold', 'cuivre', chg('fb', 'EQX', WEEK, REF, 1, 'm_EQX'), 'n.d.', eqxCap('cap_eqx')]);
mineRows.push(['<strong>ITRG</strong> · Integra', 'aucune', chg('th', 'ITRG', WEEK, REF, 1, 'm_ITRG'), `absente du classement (seuil ${lit('10 M$')})`, 'n.d.']);
if (!(wk('th', 'USAS') < wk('fb', 'CDE') && wk('fb', 'CDE') < wk('fb', 'HL'))) throw new Error('classement des mines à revoir');
const rsiAll = ['CDE', 'HL', 'EXK', 'NG', 'EQX', 'AEM'].map(s => [s, tech(s).node.rsi]).sort((a, b) => a[1] - b[1]);
if (rsiAll[0][0] !== 'CDE' || rsiAll[1][0] !== 'HL') throw new Error('ordre des RSI à revoir');
sections.push(section('mines', 'Propagation', 'Les mines baissent bien plus que l’or', pill('CONTRÔLÉ'), 'validated',
  `<p class="section-intro">Depuis le sommet de l’été, la clôture du ${bdate('cmp', 'GLD', AUG, 'day_month', 'aug_a')}, GLD a fait ${chg('cmp', 'GLD', AUG, REF, 1, 'gld_aug')}, GDX ${chg('cmp', 'GDX', AUG, REF, 1, 'gdx_aug')}, les petites mines (GDXJ) ${chg('cmp', 'GDXJ', AUG, REF, 1, 'gdxj_aug')} et Equinox Gold ${chg('eqb', 'EQX', AUG, REF, 1, 'eqx_aug')}. Une mine a des coûts en bonne partie fixes, et ils montent avec le carburant : quand l’once baisse pendant que le pétrole monte, sa marge se resserre par le haut et par le bas ; notre fiche Equinox Gold de ce matin le détaille. Les sociétés de redevances, qui ne paient pas ces coûts, ont le moins baissé cette semaine : Royal Gold ${chg('cmp', 'RGLD', WEEK, REF, 1, 'rgld_wk')}, Franco-Nevada ${chg('cmp', 'FNV', WEEK, REF, 1, 'fnv_wk')}.</p>`
  + `<p class="section-intro">Selon notre page <a href="/rotation/">Rotation</a>, recalculée sur la clôture du ${lit('26 octobre')}, les titres qui amplifient le plus les mines d’or (GDX) et d’argent (SIL) sont Hycroft, Americas Gold &amp; Silver, Aura Minerals, NovaGold, Aya Gold &amp; Silver, Hecla, Endeavour Silver et Coeur. La page donne leurs bêtas ; voici leur semaine et leur liquidité, contre ${chg('cmp', 'GDX', WEEK, REF, 1, 'gdx_wk_m')} pour GDX et ${chg('th', 'SIL', WEEK, REF, 1, 'sil_wk_m')} pour SIL.</p>`
  + table(['Titre', 'Liste Rotation', 'Sur la semaine', 'Échangé par jour, médiane', 'Capitalisation'], mineRows)
  + `<p class="section-intro">Americas Gold &amp; Silver a fait ${chg('th', 'USAS', WEEK, REF, 1, 'usas_wk')} pour une médiane de ${advM('USAS', 'adv_usas_b')} échangés par jour : le plus nerveux, et l’un des moins liquides. Hecla et Coeur échangent ${advM('HL', 'adv_hl_b')} et ${advM('CDE', 'adv_cde_b')} par jour : ce sont les plus faciles à acheter et à revendre, le jour où GLD aura repassé ${gld21('gld_21_m')}. Parmi les titres dont nous avons le RSI, les plus survendus sont liés à l’argent : ${rsi('CDE', 'rsi_cde_b')} pour Coeur, ${rsi('HL', 'rsi_hl_b')} pour Hecla. Survendu ne fait pas un signal d’achat la veille d’une Fed.</p>`
  + `<p class="section-intro">Equinox Gold figure aussi dans la liste cuivre de Rotation, mais c’est un mouvement commun, pas un métier : notre fiche de ce matin le traite comme un levier sur l’or, avec le pétrole en second facteur, par le carburant.</p>`
  + `<p class="provenance">Échanges et capitalisation : classement de notre fiche Equinox Gold du jour (fenêtre d’environ ${lit('six mois')} finie le ${lit('26 octobre')} ; capitalisation relevée par un fournisseur). La page Rotation, sur une fenêtre plus courte, affiche d’autres médianes. RSI relevé ce mardi sur la clôture de lundi. n.d. : non disponible.</p>`));

// 5. Bilan
const stopTable = stopRows.map(r => [`<strong>${r.s}</strong> · ${r.name}`, lit(`${String(r.stop).replace('.', ',')} $`),
  `${touchDate(r.t, `lowd_${r.s}`)} (${touchVal(r.t, 2, `low_${r.s}`)})`,
  `${claim(r.top.s.key, `${r.top.s.ptr}/bars/${r.top.i}/2`, r.top.value, fr(2, ' $'), `top_${r.s}`)} le ${claim(r.top.s.key, `${r.top.s.ptr}/bars/${r.top.i}/0`, r.top.date, dateR('day_month'), `topd_${r.s}`)}`,
  chg('cmp', r.s, JUNE, REF, 1, `june_${r.s}`)]);
const xv = (t, stem) => claim('cmp', `${t.s.ptr}/bars/${t.i}/3`, t.value, fr(2, ' $'), stem);
const xd = (t, stem) => claim('cmp', `${t.s.ptr}/bars/${t.i}/0`, t.date, dateR('day_month'), stem);
const bilanRows = [
  [lit('15 février'), `Or et argent (fiches XAU et XAG) : achat de GLD entre ${lit('450 $')} et ${lit('465 $')}, stop ${lit('420 $')}, objectifs ${lit('510 $')} et ${lit('550 $')} ; achat de SLV, stop ${lit('58 $')}.`,
    `GLD est entré dans la zone le ${touchDate(febFill, 'feb_fill')}, a culminé à ${touchVal(febTop, 2, 'feb_top')} en clôture le ${touchDate(febTop, 'feb_topd')}, sous le premier objectif, puis a touché le stop en séance le ${touchDate(febStop, 'feb_stop')}. SLV clôture lundi à ${px('idx', 'SLV', REF, 'close', 2, 'slv_feb')}, sous son stop ; nos données du jour ne datent pas la sortie.`, '<span class="verdict faux">Perdu</span>'],
  [lit('21 juin'), `Or au comptant (fiche XAUUSD) : entrée ${lit('4 160 $')}, stop ${lit('3 980 $')}, objectifs ${lit('4 360 $')} et ${lit('4 545 $')}, sur ${lit('30 jours')}.`,
    `Pas de série vérifiée de l’once. À la publication, elle valait ${lit('4 155,59 $')}, au niveau de l’entrée ; notre fiche de février faisait correspondre ${lit('365,04 $')} sur GLD à environ ${lit('3 980 $')}, le stop. GLD a clôturé au-dessus le ${xd(xauLow1, 'xau_d1')} (${px('cmp', 'GLD', '2026-06-24', 'close', 2, 'xau_c1')}) mais est descendu à ${xv(xauLow1, 'xau_l1')} en séance, puis à ${xv(xauLow2, 'xau_l2')} le ${xd(xauLow2, 'xau_d2')}, dans les ${lit('30 jours')} du plan, jamais soldé dans nos pages.`, '<span class="verdict faux">Stop très probable, en séance</span>'],
  [lit('26 juin'), `« Jouer la reprise » : GLD sous ${lit('370 $')}, thèse cassée sous ${lit('363 $')} en clôture, objectif ${lit('391 $')} ; mines en paliers (détail ci-dessous).`,
    `GLD n’a jamais clôturé sous ${lit('363 $')} (plus bas de clôture ${touchVal(gldMinClose, 2, 'gld_min')} le ${touchDate(gldMinClose, 'gld_mind')}) et a touché ${lit('391 $')} le ${touchDate(gldTp, 'gld_tp')}. Toutes les lignes de mines ont touché leur stop en juillet. GDX et GDXJ, à acheter après la confirmation d’août, sont en perte et n’ont jamais été soldés.`, '<span class="verdict faux">GLD gagné, mines perdues</span>'],
  [lit('11 juillet'), `Equinox Gold : entrée ${lit('9,75 $')}, stop ${lit('8,85 $')}, objectifs ${lit('11,40 $')} et ${lit('12,90 $')}.`,
    `Stop touché en séance le ${touchDate(eqxJul11, 'eqx11_d')} (plus bas ${touchVal(eqxJul11, 2, 'eqx11_l')}), avant la hausse d’août.`, '<span class="verdict faux">Perdu</span>'],
  [lit('28 juillet'), `Setups actifs : GLD à ${lit('374,6 $')} (stop ${lit('364 $')}, objectifs ${lit('389 $')} puis ${lit('400 $')}), GDX à ${lit('75,7 $')}, Agnico Eagle à ${lit('146 $')}, EQX à ${lit('9,5 $')} (stop ${lit('8,75 $')}).`,
    `Premiers objectifs touchés le ${touchDate(julyTp[0], 'jul_tp')} pour GLD, GDX et Agnico Eagle, sans stop touché avant ; second objectif de GLD le ${touchDate(julyGld2, 'jul_gld2')}. EQX a touché son stop en séance (${touchVal(eqxJulStop, 2, 'eqx_jul_low')} le ${touchDate(eqxJulStop, 'eqx_jul_lowd')}) sans clôturer dessous, puis son objectif le ${touchDate(julyEqx, 'jul_eqx')}.`, '<span class="verdict vrai">Gagné ; EQX sorti en séance</span>'],
  [lit('31 juillet'), `Americas Gold &amp; Silver : éviter à ${lit('3,82 $')} ; acheter seulement si le titre reprenait sa moyenne de ${lit('20 séances')}, vers ${lit('4,17 $')}, après les résultats du ${lit('11 août')}, avec l’argent au-dessus de ${lit('55 $')} ; ligne à défendre ${lit('3,53 $')}.`,
    `Le titre a d’abord monté (hebdo du ${lit('10 août')}) et valait encore ${px('th', 'USAS', '2026-10-06', 'close', 2, 'usas_06')} le ${bdate('th', 'USAS', '2026-10-06', 'day_month', 'usas_06d')} : la condition d’achat a pu jouer, nos données ne la datent pas. La ligne de ${lit('3,53 $')} a cédé le ${touchDate(usasBreak, 'usas_brk_d')} (${touchVal(usasBreak, 2, 'usas_brk')}) ; lundi, ${px('th', 'USAS', REF, 'close', 2, 'usas_px')}.`, '<span class="verdict partiel">Raté, issue de l’achat non datée</span>'],
  [lit('25 septembre'), `Equinox Gold : achat sur cassure de ${lit('12,87 $')}, abandon sur une clôture sous ${lit('11,42 $')}.`,
    `Jamais déclenché : la condition d’abandon a joué dès le ${touchDate(sepAbandon, 'sep_ab')}, clôture à ${touchVal(sepAbandon, 2, 'sep_px')}.`, '<span class="verdict neutre">Rien engagé</span>']
];
sections.push(section('bilan', 'Bilan', 'Nos appels sur l’or, sans retouche', pill('PARTIEL', 'partial'), 'partial',
  `<p class="section-intro">Nos principaux appels sur l’or et ses mines depuis février, mesurés sur les cours de clôture et les extrêmes de séance. Ne figurent pas ici : Endeavour Silver (${lit('14 février')}), les lignes secondaires et argent des setups du ${lit('28 juillet')}, les versions intermédiaires de la fiche Equinox Gold (juillet et août), Coeur et First Majestic (${lit('28 août')}), et les signaux du scanner, suivis sur leur propre page.</p>`
  + table(['Publié le', 'Ce que nous avons écrit', 'Ce qui s’est passé', 'Verdict'], bilanRows, 'data-table check-table')
  + `@@PATH@@`
  + `<h3>Le panier du ${lit('26 juin')}, ligne par ligne</h3>`
  + table(['Titre', 'Stop publié', 'Stop touché le (plus bas de la séance)', 'Plus haut ensuite', `Lundi, contre le ${bdate('cmp', 'GLD', JUNE, 'day_month', 'june_h')}`], stopTable)
  + `<p class="section-intro">Toutes les lignes de mines ont touché leur stop en séance entre le ${touchDate(stopRows[0].t, 'stops_a')} et le ${touchDate(stopRows.find(r => r.s === 'IAG').t, 'stops_b')}, alors que leurs stops étaient plus larges que le seuil de GLD : en juillet, elles ont reculé bien plus que l’or. GLD a repassé ${lit('391 $')} en clôture le ${touchDate(gldConf, 'gld_conf')}, première condition de notre confirmation de juin (l’autre, une probabilité de crise sous ${lit('20 %')}, n’est pas dans nos données). Cette confirmation autorisait l’achat de GDX « sur force » et des petites mines, avec une seule sortie, une clôture de GLD sous ${lit('363 $')}, jamais venue : depuis la clôture du ${bdate('cmp', 'GLD', CONF, 'day_month', 'conf_d')}, GDX a fait ${chg('cmp', 'GDX', CONF, REF, 1, 'gdx_conf')} et GDXJ ${chg('cmp', 'GDXJ', CONF, REF, 1, 'gdxj_conf')}, sans être soldés dans nos pages. Eldorado n’est jamais revenu dans sa zone ; Equinox Gold était déjà au-dessus de son premier objectif à la confirmation. Avant elle, nos mines ont sauté au premier creux ; après, notre règle les faisait acheter près du sommet d’août.</p>`
  + `<div class="quality-note warning-note"><strong>Ces plans sont clos ; aucun de leurs niveaux ne vaut aujourd’hui,</strong> ni l’entrée à ${lit('4 160 $')} du ${lit('21 juin')} (l’once vaut ${xauPx('xau_q')}), ni la zone « GLD sous ${lit('370 $')} » du ${lit('26 juin')} (GLD à ${px('cmp', 'GLD', REF, 'close', 2, 'gld_px_q')}). Notre registre des fiches montre encore le plan du ${lit('21 juin')} comme actif et les fiches de février comme « sans plan » : ce tableau fait foi. En février, notre fiche or disait l’or affranchi des taux réels ; cette semaine, la presse le relie de nouveau à la Fed. L’hebdo du ${lit('26 octobre')} disait « or et pétrole : rien à changer » : cette édition ne change rien à cette consigne.</div>`));

// 6. Agenda (échéancier)
const echeancier = renderEventTimeline({
  id: 'echeancier', asof: '2026-10-27', from: '2026-10-27', to: '2026-10-30', requireProof: true,
  keyWindow: { from: '2026-10-28', to: '2026-10-29', labelHtml: `Fenêtre clé · mer. ${paris(fomc, 'kw_a')} → jeu. ${nyClose('kw_b')}` },
  events: [
    { date: '2026-10-28', category: 'macro', impact: 'strong', label: 'Fed', detailHtml: `décision, puis conférence à ${paris(press, 'tl_press')}`, icon: 'bank', href: '#pourquoi', proof: paris(fomc, 'tl_fed') },
    { date: '2026-10-28', category: 'earnings', impact: 'strong', label: 'Agnico Eagle, Kinross', detail: 'résultats après la clôture', icon: 'company', href: '#trade', proof: `${edate(aem, 'tl_aem')}${edate(kgc, 'tl_kgc')}`, proofHidden: true },
    { date: '2026-10-29', category: 'macro', impact: 'strong', label: 'Inflation PCE, PIB', detail: 'l’indice suivi par la Fed', icon: 'data', href: '#scenarios', proof: paris(pce, 'tl_pce') },
    { date: '2026-10-29', category: 'macro', impact: 'medium', label: 'BCE', detail: 'euro face au dollar', icon: 'bank', proof: paris(ecb, 'tl_ecb') },
    { date: '2026-10-30', category: 'macro', impact: 'medium', label: 'Inflation zone euro', detail: 'euro face au dollar', icon: 'data', proof: paris(hicp, 'tl_hicp') },
    { date: '2026-10-30', category: 'macro', impact: 'medium', label: 'Banque du Japon', detail: 'yen, dollar', icon: 'bank', proof: reg('/facts/boj/decision_date', dateR('weekday_day_month'), 'tl_boj', 'boj_calendar'), proofHidden: true }
  ],
  chains: [
    { steps: [{ label: 'Fed ferme sur décembre', icon: 'bank' }, { label: 'Dollar', icon: 'coin', tone: 'up' }, { label: 'Or', category: 'geo', icon: 'coin', tone: 'down' }, { label: 'Mines', category: 'earnings', icon: 'company', tone: 'down' }] },
    { steps: [{ label: 'PCE sage', icon: 'data' }, { label: 'Pari sur décembre', icon: 'bank', tone: 'down' }, { label: 'Or', category: 'geo', icon: 'coin', tone: 'up' }, { label: 'Mines d’argent', category: 'earnings', icon: 'company', tone: 'up' }] },
    { steps: [{ label: 'Pétrole', category: 'geo', icon: 'oil', tone: 'up' }, { label: 'Inflation', icon: 'data', tone: 'up' }, { label: 'Fed plus dure', icon: 'bank' }, { label: 'Or', category: 'geo', icon: 'coin', tone: 'down' }] }
  ]
});
sections.push(section('agenda', 'Agenda', 'Mercredi soir et jeudi décident', pill('CONTRÔLÉ'), 'validated',
  echeancier
  + `<p class="section-intro">Heures de Paris. La France est à l’heure d’hiver, New York pas encore : cette semaine, Wall Street ferme à ${nyClose('nyc_b')}, heure de Paris. À partir du lundi ${lit('2 novembre')}, elle fermera à ${lit('22h00')} : c’est l’heure qui vaut pour les résultats d’Equinox Gold. Agnico Eagle et Kinross ont confirmé leur date dans un avis déposé à la SEC. Après vendredi : l’emploi américain le ${reg('/facts/jobs/next_release_date', dateR('day_month'), 'jobs', 'bls_empsit')}, Wheaton le ${edate(wpm, 'wpm_d', 'day_month')} (date d’une seule source, non confirmée par la société), Equinox Gold le ${edate(eqxEarn, 'eqx_d1', 'day_month')}.</p>`));

// 7. Scénarios
sections.push(section('scenarios', 'Scénarios', 'Ce qui peut se passer jeudi soir', pill('À SURVEILLER', 'partial'), 'partial',
  `<div class="scenario-grid">`
  + `<article class="scenario base"><h3>Scénario de base</h3><p>La Fed ne bouge pas et laisse la porte ouverte pour décembre. Le dollar reste ferme, l’or tourne autour de son niveau, les mines restent sous pression au moins jusqu’aux comptes d’Agnico Eagle et de Kinross. Conséquence : on attend.</p></article>`
  + `<article class="scenario up"><h3>Scénario contraire</h3><p>La conférence de mercredi ou l’inflation PCE de jeudi fait reculer le pari sur décembre : dollar en baisse, or en hausse. Les mines rebondissent plus fort que l’or. Conséquence : si GLD clôture jeudi au-dessus de ${gld21('gld_21_s')}, sa clôture du ${bdate('cmp', 'GLD', d21, 'day_month', 'd21_s')}, le décrochage du ${bdate('idx', 'GLD', d22, 'day_month', 'd22_s')} est effacé ; on réexamine les mines vendredi, sans niveau fixé d’avance.</p></article>`
  + `<article class="scenario down"><h3>Baisse prolongée</h3><p>La Fed confirme le pari et le pétrole remonte. Une clôture de GLD sous ${gldLow('gld_min_s')}, son plus bas de clôture depuis juin (${touchDate(gldMinClose, 'gld_mind_s')}), ouvrirait une nouvelle étape de baisse, et les mines la feraient en plus grand. Conséquence : aucun achat de mines, même après une forte baisse ; une ligne d’or d’épargne n’a pas à être vendue pour autant.</p></article>`
  + `<article class="scenario flat"><h3>Quand nous aurons tort</h3><p>Notre lecture tombe si, à la clôture du ${eday(pce, 'pce_day', 'weekday_day_month')}, GLD a repassé ${gld21('gld_21_t')} alors que l’indice du dollar (DXY) est resté au-dessus de ${dxyPx('dxy_t')} : l’or monterait avec un dollar ferme, pour une autre raison que la Fed. Elle tombe aussi dans l’autre sens si le dollar repasse sous ${dxyPx('dxy_t2')} et que GLD clôture quand même sous ${gldLow('gld_min_t')}.</p></article>`
  + `</div>`));

// 8. Ce qu'on fait
sections.push(section('trade', 'Idées de trading', 'Ce qu’on fait demain matin', pill('ATTENDRE'), 'validated',
  `<ul class="checklist">`
  + `<li><i class="fas fa-hourglass-half"></i><div><strong>Pas d’achat avant jeudi ${nyClose('nyc_c')}, ni sur l’or, ni sur les mines.</strong><br>Pas de vente de panique non plus : une ligne d’or d’épargne ne se solde pas sur une semaine de baisse, un versement programmé peut continuer, un stop déjà posé sur une mine reste en place.</div></li>`
  + `<li><i class="fas fa-hand"></i><div><strong>N’achetez pas le saut de jeudi matin.</strong><br>Agnico Eagle et Kinross publient mercredi soir, juste après la Fed : leurs cours ouvriront jeudi loin de la clôture de mercredi, et un stop s’exécute alors au premier prix disponible, parfois bien en dessous de son niveau. Un fonds or coté en Europe encaissera lui aussi la Fed d’un coup, jeudi à l’ouverture. On juge à la clôture de New York.</div></li>`
  + `<li><i class="fas fa-ruler-horizontal"></i><div><strong>Les seuils se lisent sur la clôture de GLD,</strong> affichée par tout site de cotation.<br>En bas ${gldLow('gld_min_c')}, le plus bas de clôture depuis juin ; en haut ${gld21('gld_21_c')}, la clôture d’avant le décrochage ; lundi ${px('cmp', 'GLD', REF, 'close', 2, 'gld_px_c')}, tout près du bas. Entre ces niveaux, on ne fait rien. Pas de seuil sur l’once (pas de clôture vérifiée, le relevé de ${xauPx('xau_c')} n’est qu’un repère), et pas de copie de ces niveaux sur un fonds en euros.</div></li>`
  + `<li><i class="fas fa-euro-sign"></i><div><strong>Depuis un compte français.</strong><br>GLD, SLV, GDX et SIL sont des fonds américains, en général fermés aux particuliers européens faute de document d’information clé : ici, des thermomètres. L’or en Bourse se détient par un ETC adossé à de l’or physique, coté en Europe, en compte-titres (pas en PEA). Sauf couverture de change, il bouge aussi avec le dollar : un dollar qui monte amortit la baisse en euros, un dollar qui recule après la Fed efface une partie de la hausse. Les mines américaines s’achètent en compte-titres, en dollars, avec des frais de change ; la BCE, jeudi à ${paris(ecb, 'ecb_c')}, peut aussi faire bouger l’euro.</div></li>`
  + `</ul>`
  + `<div class="three-col">`
  + `<article class="focus-card"><div class="focus-symbol">EQX</div><div class="focus-what">Equinox Gold · plan publié ce matin, inchangé</div><p>Rien avant les résultats du ${edate(eqxEarn, 'eqx_d2', 'weekday_day_month')}, publiés après la clôture de New York, soit après ${lit('22h00')} à Paris. Ne passez aucun ordre d’ici là : un ordre d’achat limité à ${lit('11,64 $')} passé maintenant s’exécuterait tout de suite au cours du moment (${px('fb', 'EQX', REF, 'close', 2, 'eqx_px')} lundi), avant les résultats et sans déclencheur.</p><p>Le plan ne s’ouvre qu’après une clôture à ${lit('11,42 $')} ou plus, venue après les résultats et au plus tard le ${lit('16 novembre')}. L’achat se fait à la séance suivante, si le titre cote encore au-dessus de ${lit('11,42 $')}, par un ordre limité à ${lit('11,64 $')} au plus, valable pour la séance. Le stop à ${lit('10,84 $')} se pose une fois la ligne achetée. Objectifs : ${lit('12,85 $')} pour une partie de la ligne, puis ${lit('13,19 $')}. Une clôture sous ${lit('8,48 $')} avant l’achat abandonne le plan ; une prévision de production abaissée sous ${lit('870 000 onces')}, ou un coût tout compris prévu au-dessus de ${lit('2 000 $')} l’once, l’annule aussi.</p><p><a href="/analyses/EQX/">Lire la fiche Equinox Gold</a></p></article>`
  + `<article class="focus-card"><div class="focus-symbol">ITRG</div><div class="focus-what">Integra Resources · pas de plan</div><p>Notre choix « agressif » de juin, sans plan aujourd’hui. Lundi : ${px('th', 'ITRG', REF, 'close', 2, 'itrg_px')}, ${px('th', 'ITRG', REF, 'volume', 0, 'itrg_vol')} actions échangées : trop peu pour notre classement des mines qui amplifient l’or, qui exige au moins ${lit('10 M$')} échangés par jour. Sur un titre aussi peu échangé, un gros ordre peut faire bouger le prix, et revendre coûte cher quand tout le monde veut sortir. Notre règle de juin n’autorisait les petites mines qu’au-dessus de ${lit('391 $')} sur GLD ; GLD est à ${px('cmp', 'GLD', REF, 'close', 2, 'gld_px_i')}. Pas de ligne.</p></article>`
  + `<article class="focus-card"><div class="focus-symbol">Mines</div><div class="focus-what">Si GLD repasse ${gld21('gld_21_f')} jeudi</div><p>Nous réexaminons les mines vendredi. D’ici là, nous ne publions ni prix d’entrée ni stop : n’achetez pas sur la foi de cette liste, et pas Agnico Eagle ou Kinross au lendemain de leurs résultats. Le jour venu, Hecla et Coeur, très échangés, coûtent moins cher à acheter et à revendre que les petites mines comme Americas Gold &amp; Silver ou Aya.</p></article>`
  + `</div>`
  + `<p class="provenance">Aucune nouvelle idée de trade dans cette édition : nous n’en ouvrons aucune avant la Fed. Le seul plan cité est celui de la fiche Equinox Gold publiée ce matin.</p>`));

// 9. Sources
const srcLinks = [
  ['https://www.kitco.com/news/off-the-wire/2026-10-27/gold-retreats-stronger-dollar-traders-brace-fed', 'Kitco (Reuters), mardi : l’or recule, le dollar monte avant la Fed'],
  ['https://finance.yahoo.com/markets/commodities/articles/americas-gold-silver-sinks-11-173728086.html', 'TIKR, jeudi : l’argent et ses mines décrochent'],
  ['https://finance.yahoo.com/markets/stocks/articles/barrick-sinks-5-7-freedom-170427725.html', 'TIKR, jeudi : Freedom Broker abaisse Barrick, Newmont, Agnico Eagle'],
  ['https://www.sec.gov/Archives/edgar/data/2809/000110465926111750/tm2626580d1_ex99-1.htm', 'Agnico Eagle, avis de publication déposé à la SEC'],
  ['https://www.sec.gov/Archives/edgar/data/701818/000117184326006470/exh_991.htm', 'Kinross, avis de publication déposé à la SEC'],
  ['https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm', 'Réserve fédérale, calendrier']
].map(([u, l]) => `<li><a href="${u}" rel="noopener" target="_blank">${l}</a></li>`).join('');
sections.push(section('sources', 'Sources et limites', 'Sur quoi repose cette édition', pill('PARTIEL', 'partial'), 'partial',
  `<div class="source-list">`
  + `<div class="source-item"><strong>Cours</strong><span>Clôtures vérifiées du ${refDay('ref_s', 'full')}. Historique long de GLD, des mines et d’Equinox Gold repris des cours vérifiés de notre fiche Equinox Gold de ce matin, même clôture.</span></div>`
  + `<div class="source-item"><strong>Relevés de ce mardi</strong><span>Once au comptant à ${offAsOf('xau_t_s')}, indice du dollar à ${dxyTime('dxy_t_s')}, heure de Paris, et cotes Polymarket : des relevés pendant la séance, jamais des clôtures.</span></div>`
  + `<div class="source-item"><strong>Agenda et taux</strong><span>Calendrier macro collecté ; dates d’Agnico Eagle et de Kinross lues sur leurs avis déposés à la SEC ; Fed, Trésor américain, Bureau of Labor Statistics, Banque du Japon. Presse : Reuters (via Kitco) et TIKR, pour l’attribution des mouvements.</span></div>`
  + `</div>`
  + `<ul class="provenance">${srcLinks}</ul>`
  + `<div class="quality-note warning-note"><strong>Limites.</strong> Les chances d’une hausse de taux en décembre viennent de la presse, pas de nos calculs. Pas de série vérifiée de l’once au comptant : l’or est mesuré par GLD. ITRG et les petites mines n’ont qu’un historique court dans nos données du jour.</div>`
  + `<p class="section-intro">Ce contenu est informatif. Il ne constitue pas un conseil en investissement. Investir comporte un risque de perte en capital.</p>`));

// ── Graphiques ───────────────────────────────────────────────────────────────
const base100 = (key, s) => { const b = series(key, s).bars; const i = b.findIndex(x => x[0] === JUNE); return b.slice(i).map(x => [x[0], +(x[4] / b[i][4] * 100).toFixed(2)]); };
const chartSpecs = [
  { id: 'movesChart', spec: { grid: { left: 190, right: 56, top: 12, bottom: 32 }, xAxis: { type: 'value', axisLabel: { formatter: '{value} %' } }, yAxis: { type: 'category', data: moveData.map(x => x.label), axisLabel: { fontSize: 11 } }, series: [{ type: 'bar', data: moveData.map(x => ({ value: x.v, itemStyle: { color: x.v >= 0 ? '#0b8f62' : '#c73d4b' } })), label: { show: true, position: 'right', formatter: '{c} %', fontSize: 10 } }] } },
  { id: 'pathChart', spec: { grid: { left: 48, right: 18, top: 36, bottom: 36 }, legend: { data: ['GLD', 'GDX', 'Agnico Eagle', 'Equinox Gold'] }, xAxis: { type: 'time' }, yAxis: { type: 'value', name: 'base 100', scale: true }, series: [['cmp', 'GLD', 'GLD'], ['cmp', 'GDX', 'GDX'], ['cmp', 'AEM', 'Agnico Eagle'], ['eqb', 'EQX', 'Equinox Gold']].map(([k, s, name]) => ({ name, type: 'line', showSymbol: false, data: base100(k, s) })) } }
];
const pathEnd = s => { const d = chartSpecs[1].spec.series.find(x => x.name === s).data; return d[d.length - 1][1]; };
if (!(pathEnd('GLD') < 100 && pathEnd('GDX') > 100 && pathEnd('Agnico Eagle') > 100 && pathEnd('Equinox Gold') > 100)) throw new Error('lecture du parcours à revoir');
const pathFigure = `<div id="pathChart" class="echart-box" role="img" aria-label="Parcours de GLD, GDX, Agnico Eagle et Equinox Gold depuis la veille du panier de juin, en indice" style="width:100%; height:380px; margin-top:1rem;"></div><p class="provenance">Indice de base à la clôture du ${bdate('cmp', 'GLD', JUNE, 'day_month', 'june_c')}. Lecture : la hausse d’août a eu lieu, plus forte sur les mines ; l’or est revenu à son niveau de juin, les mines restent un peu au-dessus.</p>`;
sections[4] = sections[4].replace('@@PATH@@', pathFigure);

// ── Page ─────────────────────────────────────────────────────────────────────
const fmt = v => renderValue(v, fr(1, ' %', true));
const title = 'L’or recule avant la Fed, les mines paient plus cher';
const description = `Édition spéciale or. GLD ${fmt(wk('cmp', 'GLD'))} sur la semaine, les mines d’or ${fmt(wk('cmp', 'GDX'))}, celles d’argent ${fmt(wk('th', 'SIL'))}. Le dollar et le pari d’une hausse de taux en décembre pèsent. Ni achat ni vente avant la clôture de New York jeudi.`;
const badges = [`GLD ${fmt(wk('cmp', 'GLD'))} sur la semaine`, `Mines d’or ${fmt(wk('cmp', 'GDX'))}`, `Mines d’argent ${fmt(wk('th', 'SIL'))}`, 'Fed mercredi soir', 'Édition spéciale'];
const css = fs.readFileSync(path.join(DIR, '_style.css'), 'utf8');
const html = `<!DOCTYPE html>
<html lang="fr" data-tags="gold,mining,commodity,special-edition,macro,us" data-tab="daily">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily — 27 octobre 2026 : édition spéciale or et mines avant la Fed</title>
  <meta name="description" content="${description}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://articles.dailytickers.com/daily/20261027/">
  <meta property="og:image" content="https://articles.dailytickers.com/logo.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link rel="stylesheet" href="/assets/report.css">
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-T5Z595CW');</script>
  <style>${css}</style>
</head>
<body>
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-T5Z595CW" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<nav class="brand-bar"><div class="brand-bar-inner"><a href="/" class="brand-logo"><img src="/logo.svg" alt="" width="36" height="36"><span class="brand-title">DailyTickers</span></a><div class="brand-nav"><a href="/?tab=weekly">Hebdo</a><a href="/?tab=daily">Daily</a><a href="/?tab=analyses">Analyses</a><a href="/?tab=scanner">Scanner</a><a href="/?tab=radar">Radar</a><a href="/?tab=series">Séries</a></div><div class="brand-actions"><a href="/" class="brand-home-btn" title="Accueil" aria-label="Accueil"><i class="fas fa-house"></i></a></div></div></nav>

<section class="hero-section"><div class="container"><div class="hero-date">Mardi 27 octobre 2026 &bull; Édition spéciale or &bull; clôtures du lundi 26 octobre</div><h1 class="hero-title">${title}</h1><p class="hero-subtitle">${description}</p><div class="hero-badges">${badges.map(b => `<span class="hero-badge">${b}</span>`).join('')}</div><div id="article-clickable-tags" class="card-tags"></div></div></section>

<main class="report-main"><div class="container">
${sections.join('\n')}
</div></main>

<div class="fnav" id="floatingNav"><div class="fnav-menu" id="fnavMenu"><a href="#essentiel" class="fnav-item" data-section="essentiel"><i class="fas fa-bullhorn"></i><span>L’essentiel</span></a><a href="#pourquoi" class="fnav-item" data-section="pourquoi"><i class="fas fa-magnifying-glass"></i><span>La cause</span></a><a href="#mines" class="fnav-item" data-section="mines"><i class="fas fa-mountain"></i><span>Les mines</span></a><a href="#bilan" class="fnav-item" data-section="bilan"><i class="fas fa-clock-rotate-left"></i><span>Nos appels</span></a><a href="#agenda" class="fnav-item" data-section="agenda"><i class="fas fa-calendar-days"></i><span>Agenda</span></a><a href="#trade" class="fnav-item" data-section="trade"><i class="fas fa-crosshairs"></i><span>Ce qu’on fait</span></a></div><button class="fnav-btn" id="fnavBtn" type="button" aria-label="Navigation"><i class="fas fa-bars" id="fnavIcon"></i><span class="fnav-btn-label" id="fnavLabel">Menu</span></button></div>
<footer class="article-footer">&copy; 2026 DailyTickers. Clôtures du 26 octobre 2026 ; or au comptant et dollar relevés le 27 octobre pendant la séance. Ceci n&rsquo;est pas un conseil financier.<br><a href="/" title="Accueil" aria-label="Accueil"><i class="fas fa-house"></i></a></footer>
<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js"></script>
<script>const CHART_SPECS=${JSON.stringify(chartSpecs)};(function(){if(typeof echarts==='undefined')return;var xs=[];CHART_SPECS.forEach(function(c){var el=document.getElementById(c.id);if(!el)return;var x=echarts.init(el);x.setOption(Object.assign({animation:false,textStyle:{fontFamily:'Inter,system-ui,sans-serif'},tooltip:{trigger:'axis'}},c.spec));xs.push(x);});window.addEventListener('resize',function(){xs.forEach(function(x){x.resize();});});})();</script>
<script src="/assets/echarts-responsive.js"></script>
<script src="/assets/core.js"></script>
<script src="/assets/tag-renderer.js"></script>
</body>
</html>
`;

fs.writeFileSync(path.join(DIR, 'index.html'), html);
const articleSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, 'index.html'))).digest('hex');
fs.writeFileSync(path.join(DIR, '_data/chart-data.json'), JSON.stringify({ reference_close: REF, week_start: WEEK, june_base: JUNE, chart_specs: chartSpecs }, null, 2) + '\n');
fs.writeFileSync(path.join(DIR, '_data/claims.json'), JSON.stringify({ reference_close: REF, article_path: `${REL}/index.html`, article_sha256: articleSha, generated_by: `${REL}/_build.cjs`, literals: [...literals].sort(), claims }, null, 2) + '\n');
console.log(`daily rendu : ${sections.length} sections, ${claims.length} claims, ${literals.size} littéraux, ${(html.length / 1024).toFixed(1)} Ko`);
