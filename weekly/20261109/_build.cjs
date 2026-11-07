#!/usr/bin/env node
'use strict';

// Hebdo de la semaine du 9 novembre 2026. Chaque chiffre visible est un claim lié à un artefact
// collecté (_data, _focus, _themes) ou au registre primaire de l'édition ; le reste est déclaré.
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { renderValue } = require('../../tools/validate-content-claims');
const { renderEventTimeline } = require('../../tools/lib/event-timeline.cjs');

const ROOT = path.resolve(__dirname, '../..');
const REL = 'weekly/20261109';
const DIR = path.join(ROOT, REL);
const read = rel => JSON.parse(fs.readFileSync(path.join(DIR, rel), 'utf8'));
const digest = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex');
const esc = s => String(s).replace(/~/g, '~0').replace(/\//g, '~1');
const sources = {
  indices: '_data/bars_indices.json', sectors: '_data/bars_sectors.json', crypto: '_data/bars_crypto.json',
  regime: '_data/regime.json', options: '_data/options_sentiment.json', status: '_data/status.json',
  earnings: '_data/earnings_calendar.json', economic: '_data/economic_events.json', sys: '_data/regime_systematic.json',
  focus: '_focus/focus_bars.json', fund: '_focus/focus_fundamentals.json', tech: '_focus/focus_technicals.json',
  flows: '_focus/focus_flows.json', blastA: '_focus/blast_bars_a.json', blastB: '_focus/blast_bars_b.json',
  themes: '_themes/bars_themes.json'
};
const D = Object.fromEntries(Object.entries(sources).map(([k, v]) => [k, read(v)]));
const artifact = key => `${REL}/${sources[key]}`;
const REF = '2026-11-06';
const START = '2026-10-30';
const PRIMARY = `${REL}/primary-reference.json`;
const primary = JSON.parse(fs.readFileSync(path.join(ROOT, PRIMARY), 'utf8'));
const SCHED = 'data/scheduled-events.json';
const sched = JSON.parse(fs.readFileSync(path.join(ROOT, SCHED), 'utf8'));

function walk(node, pred, ptr = '') {
  if (pred(node)) return { node, ptr };
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) { const hit = walk(node[i], pred, `${ptr}/${i}`); if (hit) return hit; }
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) { const hit = walk(v, pred, `${ptr}/${esc(k)}`); if (hit) return hit; }
  }
  return null;
}
function all(node, pred, ptr = '', out = []) {
  if (pred(node)) out.push({ node, ptr });
  if (Array.isArray(node)) node.forEach((v, i) => all(v, pred, `${ptr}/${i}`, out));
  else if (node && typeof node === 'object') Object.entries(node).forEach(([k, v]) => all(v, pred, `${ptr}/${esc(k)}`, out));
  return out;
}
function barHit(symbol) {
  for (const key of ['indices', 'sectors', 'crypto', 'themes', 'focus', 'blastA', 'blastB']) {
    const hit = walk(D[key], x => x && x.symbol === symbol && Array.isArray(x.bars) && x.bars.length && Array.isArray(x.bars[0]));
    if (hit) return { ...hit, key };
  }
  throw new Error(`barres absentes: ${symbol}`);
}
function econOn(name, day) {
  const hit = walk(D.economic, x => x && x.name === name && typeof x.event_time === 'string' && x.event_time.slice(0, 10) === day);
  if (!hit) throw new Error(`macro absent: ${name} ${day}`);
  return { ...hit, key: 'economic' };
}
function objectHit(key, pred, label) {
  const hit = walk(D[key], pred);
  if (!hit) throw new Error(`${label} absent`);
  return { ...hit, key };
}

const claims = [];
const literals = new Set();
let seq = 0;
function claim(key, pointer, value, render, stem = 'c', formula) {
  const rendered = renderValue(formula ? formula.result : value, render);
  if (rendered == null) throw new Error(`rendu impossible ${stem}: ${JSON.stringify(value)} ${JSON.stringify(render)}`);
  const id = `${stem}_${++seq}`.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const row = { id, rendered_text: rendered, source_artifact: artifact(key), source_sha256: digest(artifact(key)), source_pointer: pointer, source_value: value, render };
  if (formula) row.formula = formula;
  claims.push(row);
  return `<span data-claim="${id}">${rendered}</span>`;
}
const lit = value => { literals.add(String(value)); return `<span data-literal>${value}</span>`; };
function fileClaim(rel, obj, pointer, render, stem, authority) {
  const value = pointer.slice(1).split('/').reduce((n, k) => n[k], obj);
  if (value === undefined) throw new Error(`registre: ${pointer} absent`);
  if (!obj.sources[authority]) throw new Error(`autorité absente: ${authority}`);
  const rendered = renderValue(value, render);
  if (rendered == null) throw new Error(`rendu registre impossible ${stem}`);
  const id = `${stem}_${++seq}`.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  claims.push({ id, rendered_text: rendered, source_artifact: rel, source_sha256: digest(rel), source_pointer: pointer, source_value: value, render, authority });
  return `<span data-claim="${id}">${rendered}</span>`;
}
const registryClaim = (pointer, render, stem, authority) => fileClaim(PRIMARY, primary, pointer, render, stem, authority);
const regDate = (pointer, authority, stem, parts = 'weekday_day_month') => registryClaim(pointer, { format: 'fr_date', parts }, stem, authority);
const regTime = (k, authority, stem) => registryClaim(`/facts/calendar/${k}`, { format: 'fr_time', zone: 'Europe/Paris' }, stem, authority);
const regDay = (k, authority, stem, parts = 'weekday_day_month') => registryClaim(`/facts/calendar/${k}`, { format: 'fr_date', parts }, stem, authority);
const reg = (ptr, auth, stem, decimals = 0, suffix = '') => registryClaim(ptr, { scale: 1, decimals, suffix, format: 'fr' }, stem, auth);
const n = (key, pointer, value, decimals = 1, suffix = '', stem = 'n', sign) => claim(key, pointer, value, { scale: 1, decimals, suffix, format: 'fr', ...(sign ? { sign: 'always' } : {}) }, stem);
const pct = (key, pointer, value, decimals = 1, stem = 'p') => claim(key, pointer, value, { scale: 100, decimals, suffix: ' %', format: 'fr' }, stem);
const dt = (key, pointer, value, parts = 'weekday_day_month', stem = 'date') => claim(key, pointer, value, { format: 'fr_date', parts }, stem);
const tm = (key, pointer, value, zone = 'Europe/Paris', stem = 'time') => claim(key, pointer, value, { format: 'fr_time', zone }, stem);

function perfBetween(symbol, a, b = REF, decimals = 1, stem = 'pb') {
  const h = barHit(symbol), bars = h.node.bars, i = bars.findIndex(x => x[0] === b), j = bars.findIndex(x => x[0] === a);
  if (i < 0 || j < 0 || j >= i) throw new Error(`${symbol}: fenêtre ${a}→${b} absente`);
  if (b === REF && i !== bars.length - 1) throw new Error(`${symbol}: barre postérieure à la clôture`);
  const value = (bars[i][4] / bars[j][4] - 1) * 100;
  return claim(h.key, `${h.ptr}/bars/${i}/4`, bars[i][4], { scale: 1, decimals, suffix: ' %', sign: 'always', format: 'fr' }, `${stem}_${symbol}`, {
    operation: 'ratio_pct', numerator_pointer: `${h.ptr}/bars/${i}/4`, denominator_pointer: `${h.ptr}/bars/${j}/4`, result: value
  });
}
const perf = (symbol, decimals = 1, stem = 'perf') => perfBetween(symbol, START, REF, decimals, stem);
function perfBack(symbol, sessions, decimals = 1, stem = 'm') {
  const h = barHit(symbol), b = h.node.bars, i = b.length - 1, j = i - sessions;
  if (j < 0) throw new Error(`${symbol}: fenêtre ${sessions} impossible`);
  if (b[i][0] !== REF) throw new Error(`${symbol}: dernière barre ${b[i][0]}`);
  const value = (b[i][4] / b[j][4] - 1) * 100;
  return claim(h.key, `${h.ptr}/bars/${i}/4`, b[i][4], { scale: 1, decimals, suffix: ' %', sign: 'always', format: 'fr' }, `${stem}_${symbol}`, {
    operation: 'ratio_pct', numerator_pointer: `${h.ptr}/bars/${i}/4`, denominator_pointer: `${h.ptr}/bars/${j}/4`, result: value
  });
}
function px(symbol, date = REF, col = 4, decimals = 2, stem = 'px') {
  const h = barHit(symbol), b = h.node.bars, i = b.findIndex(x => x[0] === date);
  if (i < 0) throw new Error(`${symbol}: ${date} absente`);
  return n(h.key, `${h.ptr}/bars/${i}/${col}`, b[i][col], decimals, ' $', `${stem}_${symbol}`);
}
const close = (symbol, decimals = 2) => px(symbol, REF, 4, decimals, 'close');
function barDate(symbol, date, parts = 'weekday_day_month', stem = 'bdate') {
  const h = barHit(symbol), b = h.node.bars, j = b.findIndex(x => x[0] === date);
  if (j < 0) throw new Error(`${symbol}: date ${date} absente`);
  return dt(h.key, `${h.ptr}/bars/${j}/0`, b[j][0], parts, `${stem}_${symbol}`);
}
const barsOf = symbol => barHit(symbol).node.bars;
const closeOn = (symbol, date) => { const r = barsOf(symbol).find(x => x[0] === date); if (!r) throw new Error(`${symbol} ${date}`); return r[4]; };
const pbValue = (symbol, a, b = REF) => (closeOn(symbol, b) / closeOn(symbol, a) - 1) * 100;
const perfValue = symbol => pbValue(symbol, START);
const perfBackValue = (symbol, sessions) => { const b = barsOf(symbol), i = b.length - 1; return (b[i][4] / b[i - sessions][4] - 1) * 100; };
const day = (d, stem, parts = 'day_month') => barDate('SPY', d, parts, stem);
const SP = () => { literals.add('S&P 500'); return '<span data-literal>S&amp;P 500</span>'; };

const labels = {
  SPY: 'S&P 500', QQQ: 'Nasdaq-100 (QQQ)', IWM: 'Russell', DIA: 'Dow Jones', GLD: 'Or', SLV: 'Argent', TLT: 'Obligations longues', USO: 'Pétrole',
  XLK: 'Technologie', XLB: 'Matériaux', XLF: 'Finance', XLV: 'Santé', XLI: 'Industrie', XLY: 'Consommation discrétionnaire',
  XLP: 'Consommation de base', XLU: 'Services collectifs', XLC: 'Communication', XLRE: 'Immobilier', XLE: 'Énergie',
  IBIT: 'Bitcoin', ETHA: 'Ethereum', SOLZ: 'Solana', SMH: 'Semi-conducteurs', SPHB: 'Actions nerveuses', RSP: 'Action moyenne',
  EWY: 'Corée', EWT: 'Taïwan',
  CRWV: 'CoreWeave', NVDA: 'Nvidia', CSCO: 'Cisco', AMAT: 'Applied Materials', CEG: 'Constellation Energy', TTWO: 'Take-Two',
  ORCL: 'Oracle', MSFT: 'Microsoft', AMD: 'AMD', MU: 'Micron', AVGO: 'Broadcom', TSM: 'TSMC',
  ANET: 'Arista', DELL: 'Dell', SMCI: 'Super Micro', VRT: 'Vertiv', LRCX: 'Lam Research', GEV: 'GE Vernova'
};

// ── Garde-fous de lecture : la page décrit ces faits, ils doivent être vrais dans le snapshot ──
const SYS = D.sys;
if (SYS.asof !== REF || SYS.data_asof !== REF || SYS.regime !== 'EARLY_RISK_OFF') throw new Error('moteur de régime non aligné');
if (!(SYS.index_price < SYS.sma50 && SYS.index_price < SYS.sma100 && SYS.index_price > SYS.sma200)) throw new Error('position du S&P face aux moyennes changée');
const PREV_SYS = 'weekly/20261026/_data/regime_systematic.json';
const prevSys = JSON.parse(fs.readFileSync(path.join(ROOT, PREV_SYS), 'utf8'));
if (prevSys.regime !== 'RECOVERY' || !(SYS.regime_score < prevSys.regime_score)) throw new Error('comparaison de régime inattendue');
const regimeRoot = objectHit('regime', x => x && x.dtx_regime && x.probabilities && x.transition_5d, 'régime');
const R = regimeRoot.node, outerPtr = regimeRoot.ptr;
if (R.current_state !== 'neutral') throw new Error('état du modèle inattendu');
const term = all(D.options, x => x && x.tenor && typeof x.level === 'number');
const termOf = t => { const h = term.find(x => x.node.tenor === t); if (!h) throw new Error(`échéance ${t}`); return h; };
if (!(termOf('9D').node.prev_close > termOf('30D').node.prev_close && termOf('30D').node.prev_close > termOf('3M').node.prev_close)) throw new Error('courbe de volatilité plus inversée');
if (termOf('30D').node.prev_close !== SYS.vix_level) throw new Error('VIX incohérent entre sources');
const termClose = (t, stem) => n('options', `${termOf(t).ptr}/prev_close`, termOf(t).node.prev_close, 2, '', stem);
const sysN = (field, decimals, suffix, stem) => n('sys', `/${field}`, SYS[field], decimals, suffix, stem);
const sysScore = stem => claim('sys', '/regime_score', SYS.regime_score, { scale: 100, decimals: 0, format: 'fr' }, stem);
function extClaim(rel, obj, pointer, render, stem) {
  const value = pointer.slice(1).split('/').reduce((o, k) => o[k], obj);
  const rendered = renderValue(value, render);
  const id = `${stem}_${++seq}`.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  claims.push({ id, rendered_text: rendered, source_artifact: rel, source_sha256: digest(rel), source_pointer: pointer, source_value: value, render });
  return `<span data-claim="${id}">${rendered}</span>`;
}
// L'hebdo précédent n'est pas un artefact de cette collecte : sa valeur est citée, déclarée en littéral.
const prevScore = () => lit(String(Math.round(prevSys.regime_score * 100)));
const prevVix = () => lit(prevSys.vix_level.toFixed(2).replace('.', ','));
const st = (pm, d = 1) => pct('regime', `${pm.ptr}/yes_price`, pm.node.yes_price, d, 'pm');
const pmHit = (re, label) => objectHit('regime', x => x && x.type === 'prediction_market' && re.test(x.question || '') && typeof x.yes_price === 'number', label);
const pmHike = pmHit(/Fed increase interest rates by 25 bps after the December 2026/, 'Polymarket hausse décembre');
const pmIran = pmHit(/US x Iran effective ceasefire continues through November 15/, 'Polymarket Iran');
const pmGen = objectHit('regime', x => x && typeof x.generated_at === 'string' && x.markets_found !== undefined, 'horodatage Polymarket');
const pmDate = stem => dt('regime', `${pmGen.ptr}/generated_at`, pmGen.node.generated_at, 'weekday_day_month', stem);
const pmTime = stem => tm('regime', `${pmGen.ptr}/generated_at`, pmGen.node.generated_at, 'Europe/Paris', stem);
const pmInvade = pmHit(/U\.S\. invade Iran before 2027/, 'Polymarket invasion');

// Séance de New York (heure d'hiver des deux côtés depuis le 1er novembre).
const sessionHit = objectHit('tech', x => x && x.session_open_utc && x.session_close_utc && x.session_open_utc.startsWith('2026-11-06'), 'séance de New York');
const nyOpen = stem => tm('tech', `${sessionHit.ptr}/session_open_utc`, sessionHit.node.session_open_utc, 'Europe/Paris', stem);
const nyClose = stem => tm('tech', `${sessionHit.ptr}/session_close_utc`, sessionHit.node.session_close_utc, 'Europe/Paris', stem);
const paris = (h, stem) => tm('economic', `${h.ptr}/event_time`, h.node.event_time, 'Europe/Paris', stem);
const econDate = (h, stem, parts = 'weekday_day_month') => dt('economic', `${h.ptr}/event_time`, h.node.event_time, parts, stem);

// Feed macro : le CPI est bien le 10 ; le PPI y est daté du 12, la BLS le publie le 13. La BLS fait foi.
const cpiFeed = econOn('Consumer Price Index (CPI)', '2026-11-10');
const ppiFeed = econOn('Producer Price Index (PPI)', '2026-11-12');
if (primary.facts.calendar.ppi_release.slice(0, 10) !== '2026-11-13') throw new Error('registre PPI');
const schedPpi = sched.events.findIndex(e => e.id === 'ppi' && e.date === '2026-11-13');
const schedFomc = sched.events.findIndex(e => e.id === 'fomc' && e.date === '2026-12-09');
if (schedPpi < 0 || schedFomc < 0) throw new Error('registre des rendez-vous');
const schedDate = (idx, stem, parts = 'day_month') => fileClaim(SCHED, sched, `/events/${idx}/date`, { format: 'fr_date', parts }, stem, sched.events[idx].source);
const waller = econOn('Federal Reserve Speech - Governor Christopher J. Waller: Economic Outlook', '2026-11-10');
const claimsJob = econOn('Initial Jobless Claims', '2026-11-12');
const barr = econOn('Federal Reserve Speech - Governor Michael S. Barr: Artificial Intelligence and Inequality', '2026-11-12');
const michigan = econOn('Michigan Consumer Sentiment (prelim)', '2026-11-13');

// Calendrier filtré : il s'arrête au lundi 9.
const calEvents = all(D.earnings, x => x && x.symbol && typeof x.report_date === 'string' && x.report_time);
const calLast = calEvents.reduce((m, x) => (x.node.report_date > m.node.report_date ? x : m));
if (calLast.node.report_date !== '2026-11-09') throw new Error('fin du calendrier inattendue');
const calEnd = (stem = 'cal_end') => dt('earnings', `${calLast.ptr}/report_date`, calLast.node.report_date, 'weekday_day_month', stem);
const eventHit = symbol => { const h = calEvents.find(x => x.node.symbol === symbol); if (!h) throw new Error(`publication ${symbol}`); return h; };
const ceg = eventHit('CEG'), ttwo = eventHit('TTWO'), kkr = eventHit('KKR');
if (ceg.node.report_time !== 'BMO' || ttwo.node.report_time !== 'AMC' || kkr.node.report_time !== 'BMO') throw new Error('horaires du lundi');
const cap = (h, stem) => n('earnings', `${h.ptr}/market_cap_b`, h.node.market_cap_b, 0, ' Md$', stem);
const impl = (h, stem) => n('earnings', `${h.ptr}/implied_move_pct`, h.node.implied_move_pct, 1, ' %', stem);

// Résultats : réaction passée, publications au-dessus du consensus, technique.
function reactionHit(symbol) {
  const hit = walk(D.fund, x => x && x.symbol === symbol && x.summary && Array.isArray(x.reactions));
  if (!hit) throw new Error(`réactions absentes: ${symbol}`);
  return { ...hit, key: 'fund' };
}
function beatsHit(symbol) {
  const hit = walk(D.fund, x => x && x.symbol === symbol && typeof x.consecutive_beats === 'number' && Array.isArray(x.quarters));
  if (!hit) throw new Error(`surprises absentes: ${symbol}`);
  return { ...hit, key: 'fund' };
}
function techHit(symbol) {
  const hit = walk(D.tech, x => x && x.symbol === symbol && typeof x.rsi === 'number' && typeof x.ema200 === 'number');
  if (!hit) throw new Error(`technique absente: ${symbol}`);
  if (hit.node.last_bar_date !== REF) throw new Error(`${symbol}: technique au ${hit.node.last_bar_date}`);
  return { ...hit, key: 'tech' };
}
function quoteHit(symbol) {
  const hit = walk(D.tech, x => x && x.symbol === symbol && x.type === 'instrument_quote');
  if (!hit) throw new Error(`cotation absente: ${symbol}`);
  return { ...hit, key: 'tech' };
}
const median = s => { const h = reactionHit(s); return n('fund', `${h.ptr}/summary/median_abs_move_percent`, h.node.summary.median_abs_move_percent, 1, ' %', `med_${s}`); };
const medianValue = s => reactionHit(s).node.summary.median_abs_move_percent;
const reactEvents = s => { const h = reactionHit(s); return n('fund', `${h.ptr}/summary/events`, h.node.summary.events, 0, '', `ev_${s}`); };
const downCount = s => { const h = reactionHit(s); return n('fund', `${h.ptr}/summary/down_count`, h.node.summary.down_count, 0, '', `dn_${s}`); };
const beatCount = s => { const h = beatsHit(s); return `${n('fund', `${h.ptr}/beats`, h.node.beats, 0, '', `beatn_${s}`)} sur ${n('fund', `${h.ptr}/quarters_available`, h.node.quarters_available, 0, '', `beatq_${s}`)}`; };
const rsi = s => { const h = techHit(s); return n('tech', `${h.ptr}/rsi`, h.node.rsi, 0, '', `rsi_${s}`); };
const ema200 = s => { const h = techHit(s); return n('tech', `${h.ptr}/ema200`, h.node.ema200, 2, ' $', `e200_${s}`); };
const belowEma200 = s => closeOn(s, REF) < techHit(s).node.ema200;
for (const s of ['CRWV', 'NVDA', 'CSCO', 'AMAT', 'CEG']) if (!belowEma200(s)) throw new Error(`${s} n’est plus sous sa moyenne 200`);
const crwvR = reactionHit('CRWV');
if (crwvR.node.summary.events !== 4 || crwvR.node.summary.down_count !== 3) throw new Error('historique CoreWeave changé');
const crwvQ = quoteHit('CRWV');
const crwvSi = objectHit('flows', x => x && x.symbol === 'CRWV' && Array.isArray(x.points) && x.points.length && x.points[0].short_pct_float !== undefined, 'vente à découvert CoreWeave');
const crwvSiLast = crwvSi.node.points.length - 1;
if (crwvSi.node.points[crwvSiLast].settlement_date !== '2026-10-15') throw new Error('date de vente à découvert');
const siPct = stem => n('flows', `${crwvSi.ptr}/points/${crwvSiLast}/short_pct_float`, crwvSi.node.points[crwvSiLast].short_pct_float, 1, ' %', stem);
const siDate = stem => dt('flows', `${crwvSi.ptr}/points/${crwvSiLast}/settlement_date`, crwvSi.node.points[crwvSiLast].settlement_date, 'day_month', stem);

// Les deux tests de vendredi et les trois feux verts.
const SMH_LINE = 478;
if (!(closeOn('SMH', REF) < SMH_LINE)) throw new Error('SMH au-dessus de la ligne');
const qqqBar = barsOf('QQQ').find(x => x[0] === REF);
if (!((qqqBar[4] - qqqBar[3]) / (qqqBar[2] - qqqBar[3]) < 0.5)) throw new Error('QQQ dans la moitié haute');
const TH_DATE = '2026-11-03';
const sphbTh = closeOn('SPHB', TH_DATE);
if (Math.abs(sphbTh - 137.10) > 1e-9) throw new Error('seuil SPHB');
const light1 = closeOn('SPHB', REF) > sphbTh;
const light2 = pbValue('SPY', START) > pbValue('RSP', START);
const light3 = pbValue('EWY', START) > 0 && pbValue('EWT', START) > 0;
if (light1 || light2 || light3) throw new Error('un feu est allumé : réécrire');
const D28 = '2026-10-28', D29 = '2026-10-29', D04 = '2026-11-04', D05 = '2026-11-05';
const D02 = '2026-11-02', D03 = '2026-11-03';
const qqqPos = (qqqBar[4] - qqqBar[3]) / (qqqBar[2] - qqqBar[3]) * 100; const qqqPosTxt = Math.round(qqqPos) + ' %'; if (qqqPosTxt !== '20 %') throw new Error('position QQQ');
const offTxt = ((R.transition_5d.early_risk_off + R.transition_5d.crisis) * 100).toFixed(1).replace('.', ',') + ' %'; if (offTxt !== '36,3 %') throw new Error(`repli ${offTxt}`);
const sphbNeedV = (sphbTh / closeOn('SPHB', REF) - 1) * 100;
const sphbNeed = '+' + sphbNeedV.toFixed(1).replace('.', ',') + ' %';
if (sphbNeed !== '+6,7 %') throw new Error(`écart SPHB ${sphbNeed}`);
if (Math.abs(closeOn('CRWV', REF) / crwvQ.node.fiftyTwoWeekLow - 1.14) > 0.005) throw new Error('écart au plus bas CoreWeave');
if (barsOf('CRWV').find(x => x[0] === D05)[3] !== crwvQ.node.fiftyTwoWeekLow) throw new Error('plus bas CoreWeave hors du 5 novembre');
if (!(closeOn('MSFT', D29) < closeOn('MSFT', D28))) throw new Error('bilan Microsoft');

function chart(id, title, note) {
  return `<figure class="chart-card"><h3>${title}</h3><div id="${id}" class="echart-box" style="width:100%;height:360px"></div><figcaption><strong>Lecture :</strong> ${note}</figcaption></figure>`;
}
function section(id, icon, title, body) { return `<section id="${id}" class="report-section"><h2><i class="fas ${icon}"></i> ${title}</h2>${body}</section>`; }
function card(body, cls = 'insight-card') { return `<div class="${cls}">${body}</div>`; }
function table(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
const badge = (text, tone = 'blue') => `<span class="badge badge-${tone}">${text}</span>`;
const sections = [];

// 1. Verdict
const ETF_UCITS = `un ETF large européen (UCITS) sur le ${'<span data-literal>S&amp;P 500</span>'} ou l’indice monde, logeable en PEA ou en compte-titres, en version filtrée charia si votre courtier la propose`;
literals.add('S&P 500');
const DAILY7 = `<a href="/daily/20261107/">notre daily du ${lit('7 novembre')}</a>`;
sections.push(section('verdict', 'fa-flag-checkered', 'Verdict',
  `<div class="decision-banner" data-status="ATTENDRE"><div class="decision-label">DÉCISION</div><div class="decision-value">RESTER EN LIQUIDITÉS JUSQU’À LA CLÔTURE DE MERCREDI (${nyClose('v_close')} À PARIS)</div><p>Le ${day(D05, 'v_d05', 'weekday_day_month')}, les semi-conducteurs ont entraîné toute la cote. Vendredi, le seuil de SMH est raté et le QQQ a fini près de son plus bas. Mardi, l’inflation d’octobre tombe à ${regTime('cpi_release', 'bls_cpi', 'v_cpi')}, puis CoreWeave, loueur de puces d’IA, présente ses comptes à ${regTime('coreweave_call', 'coreweave_ir', 'v_crw')}. La réponse se lit mercredi soir, après une séance complète. Pour qui a des liquidités à placer : rien avant mercredi soir, puis une première tranche seulement si les ${lit('deux tests')} ci-dessous passent. Information générale, pas un conseil personnalisé.</p></div>`
  + `<div class="stats-grid">${card(`<span class="stat-label">${SP()} sur la semaine</span><strong>${perf('SPY')}</strong>`)}${card(`<span class="stat-label">${lit('Nasdaq-100')} (QQQ)</span><strong>${perf('QQQ')}</strong>`)}${card(`<span class="stat-label">Semi-conducteurs (SMH)</span><strong>${perf('SMH')}</strong>`)}${card(`<span class="stat-label">VIX, la peur implicite</span><strong>${sysN('vix_level', 2, '', 'vix_v')}</strong>`)}</div>`));

// 2. Ce qui mérite une action
sections.push(section('fab', 'fa-crosshairs', 'Ce qui mérite une action',
  `<div class="scenario-grid">${card(`<h3>Lundi à mercredi soir : rien à acheter</h3><p>Aucun de nos ${lit('trois')} feux verts n’est allumé, le seuil de SMH est raté et le QQQ a fini vendredi près de son plus bas. Ne pas acheter avant l’inflation de mardi, ni pendant la nuit de CoreWeave, quand les cours bougent avec peu d’échanges. Ne pas vendre non plus sur la seule baisse de jeudi dernier, hors stops et invalidations des plans déjà publiés (voir ${DAILY7}).</p>`)}`
  + `${card(`<h3>Première tranche : les ${lit('deux tests')} de mercredi</h3><p>Mercredi ${regDay('veterans_day', 'sifma_holidays', 'f_wed', 'day_month')} à ${nyClose('f_close')}, SMH doit finir au-dessus de ${lit('478 $')} et le QQQ dans la ${lit('moitié haute')} de sa séance, c’est-à-dire au-dessus du milieu entre son plus haut et son plus bas du jour. Si les ${lit('deux tests')} passent : achat jeudi entre ${lit('15h45')} et ${lit('17h30')}, heure de Paris, pendant la séance européenne, de ${lit('20 à 25 %')} de ce qu’on prévoit d’investir, sur ${ETF_UCITS}. Le QQQ et SMH servent seulement de signal.</p><p>Ordre à cours limité, au plus à la clôture de mercredi de l’ETF plus ${lit('1 %')}, sans relever la limite. Il reste valable jusqu’au vendredi ${regDay('ppi_release', 'bls_ppi', 'f_exp', 'day_month')} à ${lit('17h30')}, puis il est abandonné s’il n’est pas exécuté ; si l’ordre n’est pas servi, on ne court pas après. Si le QQQ clôture sous ${px('QQQ', D05, 4, 2, 'stop_cx')} jeudi ${lit('12')}, annulez l’ordre non exécuté avant l’ouverture européenne de vendredi. Cisco et Applied Materials, jeudi à ${regTime('cisco_call', 'cisco_pr', 'f_csco')}, pèsent peu dans un ETF large ; les prix à la production tombent vendredi à ${regTime('ppi_release', 'bls_ppi', 'f_ppi_t')}.</p><p>Coupure : une clôture du QQQ sous ${px('QQQ', D05, 4, 2, 'stop_f')}, sa clôture du ${day(D05, 'f_d05')}, ce jour-là au plus bas de la séance, fait vendre la tranche à l’ouverture européenne suivante, à un prix qui peut être plus bas. Elle reste en vigueur jusqu’au mercredi ${lit('18 novembre')} inclus, que les feux soient allumés ou non ; l’hebdo du ${lit('16 novembre')} la confirme ou la remplace.</p>`)}`
  + `${card(`<h3>Vendredi ${regDay('ppi_release', 'bls_ppi', 'f_ppi_d', 'day_month')}, ${nyClose('f_close2')} : le relevé des feux</h3><p>Le relevé officiel se fait à la clôture du vendredi, sur les ${lit('cinq séances')} depuis celle du ${barDate('SPY', REF, 'day_month', 'f_ref')}. La règle des ${lit('deux feux sur trois')} date du ${lit('5 novembre')} ; mesure sur ${lit('cinq séances')}, fixée le ${lit('6 novembre')} avant l’ouverture. Notre daily du ${lit('6 novembre')} jugeait encore les feux sur une séance : sur cette base, le rebond de vendredi aurait allumé les feux ${lit('2')} et ${lit('3')}. Jeudi, la chute du ${day(D05, 'f_d05b')} sort de la fenêtre glissante : les feux ${lit('2')} et ${lit('3')} peuvent alors s’allumer par simple effet de calcul. Un allumage avant le relevé ne lève pas la prudence.</p><p>Deuxième tranche, ou première ligne pour qui n’a pas pris la première : seulement si ${lit('deux feux sur trois')} sont allumés au relevé. ${lit('20 à 25 %')} de ce qu’on prévoit d’investir, sur le même ETF large européen. Achat le mercredi ${lit('18 novembre')}, lendemain des comptes de Nvidia (${regDay('nvidia_results', 'nvidia_ir', 'f_nv', 'day_month')}), entre ${lit('15h45')} et ${lit('17h30')}, ordre limité au plus à la clôture de mardi ${lit('17')} de l’ETF plus ${lit('1 %')}, sans relever la limite, valable ce seul mercredi jusqu’à ${lit('17h30')}. Et seulement si à ${lit('15h45')} le QQQ cote au-dessus de ${px('QQQ', D05, 4, 2, 'stop_f2')} et ne recule pas de plus de ${lit('2 %')} par rapport à sa clôture du mardi ${lit('17')}. Sinon, pas d’achat ce jour-là : on attend la suite, cadrée par l’hebdo du ${lit('16 novembre')}.</p>`)}</div>`));

// 3. Alerte données
sections.push(section('alerte', 'fa-triangle-exclamation', 'Alerte données',
  `<div class="alert-box" data-status="PARTIEL"><strong>PARTIEL.</strong> Clôtures certifiées du ${barDate('SPY', REF, 'full', 'refdate')} ; résultats après le ${calEnd('cal_end_alert')} datés par les sociétés ; prix à la production datés par la BLS (${regDay('ppi_release', 'bls_ppi', 'ppi_bls', 'day_month')}), notre calendrier se trompant d’un jour ; taux à ${lit('dix ans')} de Reuters ; SPHB révisé à ${close('SPHB')} après les ${lit('128,37 $')} de notre message de vendredi soir, sans effet sur les conclusions.</div>`));

// 4. Agenda
const cegDay = stem => dt('earnings', `${ceg.ptr}/report_date`, ceg.node.report_date, 'weekday_day_month', stem);
const echeancier = renderEventTimeline({
  id: 'echeancier', asof: '2026-11-09', from: '2026-11-09', to: '2026-11-17', requireProof: true,
  keyWindow: { from: '2026-11-10', to: '2026-11-11', labelHtml: `Fenêtre clé · mardi ${regTime('cpi_release', 'bls_cpi', 'kw_a')} → mercredi ${nyClose('kw_b')}` },
  events: [
    { date: '2026-11-09', category: 'earnings', impact: 'medium', label: 'Constellation', detail: 'électricité des centres de données', icon: 'bolt', href: '#earnings', proof: cegDay('tl_ceg'), proofHidden: true },
    { date: '2026-11-10', category: 'macro', impact: 'strong', label: 'Inflation (CPI)', detail: 'octobre', icon: 'data', href: '#macro', proof: regTime('cpi_release', 'bls_cpi', 'tl_cpi') },
    { date: '2026-11-10', category: 'earnings', impact: 'strong', label: 'CoreWeave', detail: 'loueur de puces', icon: 'chip', href: '#earnings', proof: regTime('coreweave_call', 'coreweave_ir', 'tl_crw') },
    { date: '2026-11-11', category: 'market', impact: 'medium', label: 'Obligations fermées', detail: 'actions ouvertes', icon: 'closed', href: '#macro', proof: regDay('veterans_day', 'sifma_holidays', 'tl_vd'), proofHidden: true },
    { date: '2026-11-12', category: 'macro', impact: 'medium', label: 'Chômage', detail: 'inscriptions', icon: 'data', href: '#macro', proof: paris(claimsJob, 'tl_ijc') },
    { date: '2026-11-12', category: 'earnings', impact: 'strong', label: 'Cisco', detail: '+ Applied Materials', icon: 'chip', href: '#earnings', proof: regTime('cisco_call', 'cisco_pr', 'tl_csco') },
    { date: '2026-11-13', category: 'macro', impact: 'medium', label: 'Prix à la production', detail: 'octobre', icon: 'data', href: '#macro', proof: regTime('ppi_release', 'bls_ppi', 'tl_ppi') },
    { date: '2026-11-17', category: 'earnings', impact: 'strong', label: 'Nvidia', detail: 'toute la chaîne', icon: 'chip', href: '#earnings', proof: regTime('nvidia_results', 'nvidia_ir', 'tl_nv') }
  ],
  chains: [
    { steps: [{ label: 'Inflation forte', icon: 'data', category: 'macro' }, { label: 'Fed de décembre', icon: 'bank', tone: 'up' }, { label: 'Tech', category: 'earnings', icon: 'chip', tone: 'down' }] },
    { steps: [{ label: 'CoreWeave rassure', icon: 'chip', category: 'earnings' }, { label: 'Financement', icon: 'bank', tone: 'up' }, { label: 'Puces', category: 'earnings', icon: 'chip', tone: 'up' }] },
    { steps: [{ label: 'Pétrole repart', icon: 'oil', category: 'geo' }, { label: 'Inflation', icon: 'data', tone: 'up' }, { label: 'Toute la cote', icon: 'company', tone: 'down' }] }
  ]
});
const agendaCards = [
  [econDate(waller, 'c_wal_d'), paris(waller, 'c_wal_t'), 'Christopher Waller, gouverneur de la Fed, sur la conjoncture'],
  [regDay('cpi_release', 'bls_cpi', 'c_cpi_d'), regTime('cpi_release', 'bls_cpi', 'c_cpi_t'), 'Indice des prix à la consommation d’octobre (BLS)'],
  [regDay('coreweave_call', 'coreweave_ir', 'c_crw_d'), regTime('coreweave_call', 'coreweave_ir', 'c_crw_t'), 'CoreWeave, conférence sur ses résultats'],
  [regDay('veterans_day', 'sifma_holidays', 'c_vd_d'), lit('toute la journée'), 'Veterans Day : marché obligataire fermé, Bourse ouverte'],
  [econDate(claimsJob, 'c_ijc_d'), paris(claimsJob, 'c_ijc_t'), 'Inscriptions hebdomadaires au chômage'],
  [econDate(barr, 'c_barr_d'), paris(barr, 'c_barr_t'), 'Michael Barr, gouverneur de la Fed : l’IA et les inégalités'],
  [regDay('cisco_call', 'cisco_pr', 'c_csco_d'), regTime('cisco_call', 'cisco_pr', 'c_csco_t'), 'Cisco et Applied Materials, résultats et conférences'],
  [regDay('ppi_release', 'bls_ppi', 'c_ppi_d'), regTime('ppi_release', 'bls_ppi', 'c_ppi_t'), 'Indice des prix à la production d’octobre (BLS)'],
  [econDate(michigan, 'c_mich_d'), paris(michigan, 'c_mich_t'), 'Confiance des consommateurs (Michigan), première estimation']
];
sections.push(section('agenda', 'fa-calendar-week', 'Agenda de la semaine',
  echeancier
  + `<p>Heures de Paris. Les États-Unis sont passés à l’heure d’hiver le ${lit('1er novembre')} : New York ouvre à ${nyOpen('ny_open')} et ferme à ${nyClose('ny_close')}. Lundi, Constellation Energy (${cap(ceg, 'ceg_cap')} de capitalisation) et KKR (${cap(kkr, 'kkr_cap')}) publient avant l’ouverture, Take-Two après la clôture. Mardi porte la semaine : l’inflation à ${regTime('cpi_release', 'bls_cpi', 'cpi_p')}, puis CoreWeave à ${regTime('coreweave_call', 'coreweave_ir', 'crw_p')}. Mercredi ${regDay('veterans_day', 'sifma_holidays', 'vd_p', 'day_month')}, le marché obligataire américain est fermé (SIFMA) mais la Bourse ouvre normalement (NYSE) : le marché obligataire au comptant ne réagira à CoreWeave que jeudi. Jeudi soir, Cisco et Applied Materials publient ensemble, conférences à ${regTime('cisco_call', 'cisco_pr', 'csco_p')}. Nvidia suit le mardi ${regDay('nvidia_results', 'nvidia_ir', 'nv_p', 'day_month')}, vers ${regTime('nvidia_results', 'nvidia_ir', 'nv_t')}.</p>`
  + `<div class="scenario-grid" aria-label="Rendez-vous de la semaine, heures de Paris">${agendaCards.map(([d, t, label]) => card(`<div class="stat-label">${d} · ${t}</div><h3>${label}</h3>`)).join('')}</div>`
  + chart('calendarChart', 'Où se concentrent les rendez-vous', 'Mardi et jeudi portent l’essentiel : l’inflation et CoreWeave, puis Cisco et Applied Materials. Invalidation : si les cours bougent fort dès lundi, la semaine ne se joue plus seulement mardi.')));

// 5. Synthèse
sections.push(section('executive-summary', 'fa-list-check', 'Synthèse exécutive',
  `<ul class="key-list"><li>La semaine des élections de mi-mandat a coûté ${perf('SPY', 1, 'spy2')} au ${SP()}, ${perf('QQQ', 1, 'qqq2')} au ${lit('Nasdaq-100')} (QQQ) et ${perf('SMH', 1, 'smh2')} aux semi-conducteurs. Le Dow Jones (${perf('DIA')}) et le Russell (${perf('IWM')}) ont mieux résisté.</li><li>Le ${day(D05, 'es_d05', 'weekday_day_month')}, toute la cote a baissé : QQQ ${perfBetween('QQQ', D04, D05, 1, 'thu')}, SMH ${perfBetween('SMH', D04, D05, 1, 'thu')}. Vendredi, SMH a repris ${perfBetween('SMH', D05, REF, 1, 'fri')}, le QQQ ${perfBetween('QQQ', D05, REF, 1, 'fri')}, et le ${SP()} seulement ${perfBetween('SPY', D05, REF, 1, 'fri')}.</li><li>L’or (GLD) a pris ${perf('GLD')}, l’argent (SLV) ${perf('SLV')}. Le pétrole (USO) fait ${perf('USO')}, le fonds de l’énergie (XLE) ${perf('XLE')}.</li><li>Notre moteur de régime est passé en début de prudence, à ${sysScore('score_a')} ${lit('sur cent')} contre ${prevScore()} à notre hebdo du ${lit('26 octobre')}. Le VIX, l’indice de la peur tiré des options sur le ${SP()}, finit à ${sysN('vix_level', 2, '', 'vix_a')}, au-dessus de sa moyenne des ${lit('quatorze dernières séances')} (${sysN('vix_sma14', 2, '', 'vix14_a')}).</li><li>Le ${SP()} (${sysN('index_price', 2, '', 'spx_a')}) reste de peu au-dessus de sa moyenne des ${lit('deux cents dernières séances')}, environ ${sysN('sma200', 0, '', 'sma200_a')} (elle bouge de quelques points par séance). C’est le dernier repère de tendance encore intact.</li></ul>`
  + `<div class="pedagogy-box"><h4>L’économie tient</h4><p>L’économie ne cale pas. Selon Reuters, l’emploi américain a progressé de ${reg('/facts/reuters_1106/payrolls', 'reuters_1106', 'nfp')} postes en octobre, et les salaires de ${reg('/facts/reuters_1106/wage_growth_pct', 'reuters_1106', 'wage', 1, ' %')} sur un an. La vente de l’IA, jeudi, est venue d’ailleurs : la crainte de règles plus strictes après la victoire démocrate et le coût des centres de données, selon Reuters. Mais un emploi solide entretient le pari d’une hausse des taux en décembre. C’est ce risque que l’inflation de mardi peut réveiller.</p></div>`));

// 6. Bilan
sections.push(section('bilan', 'fa-clock-rotate-left', 'Bilan de la semaine écoulée',
  `<p>Notre hebdo du ${lit('26 octobre')} conditionnait une première ligne à une clôture de Microsoft et d’Alphabet, le lendemain de leurs comptes, au-dessus de celle du mercredi ${day(D28, 'b_d28')}, jour de leur publication. Microsoft a fini le ${day(D29, 'b_d29', 'weekday_day_month')} à ${px('MSFT', D29, 4, 2, 'b_msft29')}, sous les ${px('MSFT', D28, 4, 2, 'b_msft28')} de la veille : la condition n’était pas remplie, aucune ligne n’a été ouverte. Depuis ce mercredi, le QQQ fait ${perfBetween('QQQ', D28, REF, 1, 'since')} et SMH ${perfBetween('SMH', D28, REF, 1, 'since')}.</p>`
  + `<p>Le ${lit('5 novembre')}, nous avions écrit qu’un SMH au-dessus de ${lit('478 $')} en clôture nous donnerait tort, soit ${lit('un peu plus de la moitié')} de la chute de jeudi effacée ; il finit à ${close('SMH')}. Notre notification de vendredi ${lit('22h38')} y a ajouté une lecture de clôture : le QQQ finit à ${lit(qqqPosTxt)} de sa fourchette (${close('QQQ')}, pour un plus bas de ${px('QQQ', REF, 3, 2, 'lo')} et un plus haut de ${px('QQQ', REF, 2, 2, 'hi')}), près du plus bas.</p>`
  + chart('crossAssetChart', 'Semaine écoulée, variation en %', 'L’or et l’argent montent, le pétrole chute, le QQQ recule bien plus que le Dow Jones. Invalidation : un rattrapage du QQQ mardi soir pendant que l’or baisse.')));

// 7. Macro et taux
const transitions = `${pct('regime', `${outerPtr}/transition_5d/risk_on`, R.transition_5d.risk_on, 1, 'tr_on')} à l’appétit pour le risque, ${pct('regime', `${outerPtr}/transition_5d/neutral`, R.transition_5d.neutral, 1, 'tr_neu')} au neutre, ${pct('regime', `${outerPtr}/transition_5d/early_risk_off`, R.transition_5d.early_risk_off, 1, 'tr_ero')} au début de prudence et ${pct('regime', `${outerPtr}/transition_5d/crisis`, R.transition_5d.crisis, 1, 'tr_cr')} à la crise`;
sections.push(section('macro', 'fa-landmark', 'Macro et taux',
  `<p>L’inflation d’octobre sort mardi ${regDay('cpi_release', 'bls_cpi', 'cpi_d2', 'day_month')} à ${regTime('cpi_release', 'bls_cpi', 'cpi_t2')}, les prix à la production le vendredi ${regDay('ppi_release', 'bls_ppi', 'ppi_d2', 'day_month')} à ${regTime('ppi_release', 'bls_ppi', 'ppi_t2')}. La Fed ne décide pas avant le ${schedDate(schedFomc, 'fomc_d')}. Cette semaine, ce sont les paris sur cette décision qui bougent. Sur Polymarket, un site de paris sur l’actualité, une hausse de ${lit('0,25 point')} en décembre était cotée ${st(pmHike)} le ${pmDate('pm_d')} à ${pmTime('pm_t')}, heure de Paris, contre ${lit('66,5 %')} vendredi matin (notre daily du ${lit('6 novembre')}) : la hausse a coïncidé avec l’emploi de vendredi. Une inflation au-dessus des attentes renforcerait ce pari ; c’est le scénario qui pèse le plus sur la tech.</p>`
  + `<p>Le taux à ${lit('dix ans')} américain finissait vendredi à ${reg('/facts/reuters_1106/ust10y_pct', 'reuters_1106', 'tnx', 2, ' %')} selon Reuters. Les obligations longues (TLT) n’ont presque pas bougé sur la semaine (${perf('TLT')}) : la chute des actions ne s’est pas accompagnée d’une ruée sur les emprunts d’État. Mercredi, Veterans Day, le marché obligataire est fermé : le marché au comptant ne réagira aux comptes de CoreWeave que jeudi.</p>`
  + `<p>Notre moteur de régime combine le ${SP()}, le dollar, le crédit, les obligations, le VIX et la liquidité. Il est passé de la reprise (${prevScore()} ${lit('sur cent')}, le ${lit('23 octobre')}) au début de prudence (${sysScore('score_b')}). Le ${SP()} est sous ses moyennes des ${lit('cinquante')} (${sysN('sma50', 2, '', 'sma50_b')}) et des ${lit('cent dernières séances')} (${sysN('sma100', 2, '', 'sma100_b')}). Le modèle d’états, lui, voit encore un marché neutre (confiance ${pct('regime', `${outerPtr}/current_state_confidence`, R.current_state_confidence, 1, 'state_conf')}). À une semaine, il donne ${transitions}. Sur ${n('regime', `${outerPtr}/horizon_days`, R.horizon_days, 0, '', 'horizon')} jours, il attend ${n('regime', `${outerPtr}/expected_return_spy_pct`, R.expected_return_spy_pct, 2, ' %', 'exp_ret', true)} pour le ${SP()}, avec un creux possible de ${n('regime', `${outerPtr}/expected_drawdown_pct`, R.expected_drawdown_pct, 2, ' %', 'exp_dd')} en route.</p>`
  + `<p>Le VIX finit vendredi à ${termClose('30D', 'v30')}, contre ${prevVix()} le ${lit('23 octobre')}. La protection à ${lit('neuf jours')} (${termClose('9D', 'v9')}) coûte plus cher qu’à ${lit('trois mois')} (${termClose('3M', 'v3m')}) : la courbe est inversée, la peur se concentre sur les jours qui viennent.</p>`
  + `<div class="pedagogy-box"><h4>Pourquoi l’inflation passe avant CoreWeave</h4><p>CoreWeave achète, en bonne partie à crédit selon CNBC, des puces qu’elle loue ensuite. Plus les taux montent, plus ce modèle coûte cher, et plus la Bourse escompte durement des profits lointains. Mardi à ${regTime('cpi_release', 'bls_cpi', 'p_cpi')}, l’inflation fixe le décor ; CoreWeave parle le soir, sur des cours qui auront déjà bougé.</p></div>`
  + chart('volChart', 'Volatilité implicite par échéance, clôture de vendredi', 'Le court terme coûte plus cher que le long terme : la peur porte sur la semaine. Invalidation : le VIX à court terme repasse sous celui à plus long terme, signe que le choc se dissipe.')));

// 8. Métaux et matières premières
sections.push(section('metaux', 'fa-coins', 'Métaux et matières premières',
  `<p>L’or a rebondi : le fonds GLD prend ${perf('GLD', 1, 'gld3')} sur la semaine, surtout mercredi (${perfBetween('GLD', D03, D04, 1, 'wed')}) ; le jour de la chute, il n’a pris que ${perfBetween('GLD', D04, D05, 1, 'thu')}. Il clôture à ${close('GLD')} ; l’argent (SLV) fait ${perf('SLV', 1, 'slv3')}. Le pétrole fait ${perf('USO', 1, 'uso3')} (fonds USO), surtout lundi (${perfBetween('USO', START, D02, 1, 'mon')}) et mercredi (${perfBetween('USO', D03, D04, 1, 'wed')}), et le secteur de l’énergie ${perf('XLE', 1, 'xle3')}. Nos sources ne donnent pas la cause de ces séances. Vendredi, selon Reuters, le Brent a fini presque inchangé à ${reg('/facts/reuters_1106/brent_usd', 'reuters_1106', 'brent', 2, ' $')}, soutenu par l’espoir que les élections poussent Donald Trump à désamorcer la guerre avec l’Iran.</p>`
  + `<div class="pedagogy-box"><h4>Le pétrole compte pour mardi</h4><p>Un baril en baisse freine l’inflation des mois à venir, pas celle d’octobre, déjà mesurée. Si l’indice de mardi surprend à la hausse malgré la chute du pétrole, le marché lira une inflation plus tenace, donc une Fed plus dure en décembre. Un pétrole qui repartirait sur une rupture avec l’Iran ajouterait le choc inverse.</p></div>`
  + chart('metalsChart', 'Or, argent, pétrole, énergie, obligations longues', 'L’or et l’argent montent, le pétrole et l’énergie chutent, les obligations ne bougent pas. Invalidation : or et obligations longues qui baissent ensemble après l’inflation, signe que la hausse des taux reprend la main.')));

// 9. Crypto
sections.push(section('crypto', 'fa-bitcoin-sign', 'Crypto',
  `<p>Le fonds bitcoin coté IBIT fait ${perf('IBIT')} sur la semaine, Ethereum (ETHA) ${perf('ETHA')}, Solana (SOLZ) ${perf('SOLZ')}. Sur ${lit('21 séances')}, IBIT fait ${perfBack('IBIT', 21)}. Selon le bilan hebdomadaire de CryptoProwl, le bitcoin cotait vers ${reg('/facts/crypto_wrap_1106/btc_usd_1106', 'crypto_wrap_1106', 'btc', 0, ' $')} vendredi, son plus bas depuis fin août, après le vol record de ${reg('/facts/crypto_wrap_1106/binance_theft_busd', 'crypto_wrap_1106', 'hack', 1, ' Md$')} subi par Binance le ${regDate('/facts/crypto_wrap_1106/binance_theft_date', 'crypto_wrap_1106', 'hack_d', 'day_month')}, attribué par les autorités américaines à la Corée du Nord. Les clients ont retiré ${reg('/facts/crypto_wrap_1106/binance_withdrawals_busd', 'crypto_wrap_1106', 'wd', 2, ' Md$')} depuis la reprise des retraits.</p>`
  + `<div class="pedagogy-box"><h4>La crypto n’a pas servi d’abri</h4><p>Le bitcoin a moins baissé que le QQQ cette semaine, mais il baisse depuis un mois avec la tech. Selon CryptoProwl, la victoire démocrate au Congrès rend aussi incertain l’avenir du Clarity Act, le texte attendu par le secteur. Mardi soir le concerne autant que les actions : il réagit au coût de l’argent.</p></div>`
  + chart('cryptoChart', 'Véhicules crypto, semaine écoulée', 'Bitcoin et Ethereum presque stables, Solana en recul. Invalidation : un rebond de la crypto pendant une baisse du QQQ, qui la détacherait de la tech.')));

// 10. Résultats
const earnRows = [
  ['CEG', cegDay('tbl_ceg'), 'avant l’ouverture'],
  ['TTWO', dt('earnings', `${ttwo.ptr}/report_date`, ttwo.node.report_date, 'weekday_day_month', 'tbl_ttwo'), 'après la clôture'],
  ['CRWV', regDate('/facts/earnings/crwv', 'coreweave_ir', 'tbl_crwv'), 'après la clôture'],
  ['CSCO', regDate('/facts/earnings/csco', 'cisco_pr', 'tbl_csco'), 'après la clôture'],
  ['AMAT', regDate('/facts/earnings/amat', 'amat_pr', 'tbl_amat'), 'après la clôture'],
  ['NVDA', regDate('/facts/earnings/nvda', 'nvidia_ir', 'tbl_nvda'), 'après la clôture']
].map(([s, date, when]) => [labels[s], date, when, median(s), beatCount(s), perf(s, 1, 'tbl')]);
sections.push(section('earnings', 'fa-building', 'Résultats : CoreWeave mardi soir, Cisco et Applied Materials jeudi',
  `<p>CoreWeave loue des capacités de calcul bâties sur des puces Nvidia. Il fait partie des « neoclouds », ces loueurs de puces d’IA financés par la dette : selon CNBC, la sienne atteint environ ${reg('/facts/cnbc_1024/coreweave_total_debt_busd', 'cnbc_neoclouds', 'crwv_debt', 1, ' Md$')}. Ses comptes sont le premier test de la semaine pour ce modèle, après la chute du ${day(D05, 'e_d05')}. Le titre finit la semaine à ${close('CRWV')} (${perf('CRWV', 1, 'crwv_w')}), à ${lit('14 %')} au-dessus de son plus bas sur un an, ${n('tech', `${crwvQ.ptr}/fiftyTwoWeekLow`, crwvQ.node.fiftyTwoWeekLow, 2, ' $', 'crwv_lo')}, touché en séance jeudi, et loin de son plus haut (${n('tech', `${crwvQ.ptr}/fiftyTwoWeekHigh`, crwvQ.node.fiftyTwoWeekHigh, 2, ' $', 'crwv_hi')}). Lors de ses ${reactEvents('CRWV')} dernières publications, il a bougé en général de ${median('CRWV')} entre la veille et le lendemain, et baissé ${downCount('CRWV')} fois. Au ${siDate('si_d')}, ${siPct('si_p')} des actions disponibles étaient vendues à découvert : des comptes rassurants pourraient forcer ces vendeurs à racheter, ce qui amplifierait une hausse.</p>`
  + `<p>Jeudi soir, Cisco et Applied Materials publient le même soir. Cisco vend des équipements de réseau, notamment pour les centres de données ; Applied Materials, les machines qui fabriquent les puces. Ils arrivent affaiblis : Cisco clôture à ${close('CSCO')}, sous sa moyenne mobile exponentielle des ${lit('deux cents dernières séances')} (${ema200('CSCO')}), avec un RSI de ${rsi('CSCO')}, et Applied Materials à ${close('AMAT')}, sous la sienne (${ema200('AMAT')}), RSI ${rsi('AMAT')}. Le RSI mesure la vitesse des dernières hausses et baisses ; sous ${lit('30')}, un titre est dit survendu. Survendu ne veut pas dire bon marché, et avant des comptes ce n’est pas un signal d’achat.</p>`
  + `<p>Nvidia publie le ${regDate('/facts/earnings/nvda', 'nvidia_ir', 'nv_e', 'day_month')}, hors de cette semaine, mais tout ce qui précède se lira comme un avant-goût. Le titre finit à ${close('NVDA')}, sous sa moyenne mobile exponentielle des ${lit('deux cents dernières séances')} (${ema200('NVDA')}), RSI ${rsi('NVDA')}. Lundi, Constellation Energy, qui vend de l’électricité nucléaire aux centres de données, ouvre la semaine (amplitude prévue par les options jusqu’au ${dt('earnings', `${ceg.ptr}/implied_move_expiration`, ceg.node.implied_move_expiration, 'weekday_day_month', 'ceg_exp')}, inflation comprise : ${impl(ceg, 'ceg_impl')}).</p>`
  + table(['Société', 'Date', 'Moment', 'Réaction médiane passée', 'Trimestres au-dessus du consensus', 'Semaine écoulée'], earnRows)
  + chart('earningsChart', 'Réaction médiane passée, à la hausse comme à la baisse', 'CoreWeave bouge en général bien plus que les autres le lendemain de ses comptes. Ce n’est pas une prévision de sens. Invalidation : un écart très au-delà de la médiane, de mardi soir à mercredi soir pour CoreWeave, de jeudi soir à vendredi soir pour Cisco et Applied Materials.')));

// 11. Géopolitique
sections.push(section('geopolitics', 'fa-globe', 'Géopolitique',
  `<p><strong>Les centres de données deviennent un sujet politique.</strong> Selon Reuters, la gouverneure démocrate élue du Texas, État qui accueille déjà une grande part des centres de données américains, a annoncé des lois pour protéger les communautés locales de leur multiplication. Le mouvement était déjà dans les urnes : selon CNBC, sur les mesures visant à restreindre les centres de données soumises au vote le ${lit('3 novembre')}, les électeurs ont tranché contre les centres de données partout, sauf à Harwood, dans le Dakota du Nord. C’est la crainte que CNBC a citée pour la chute des puces du ${day(D05, 'g_d05')} : des décisions locales qui freinent la construction, donc les commandes futures.</p>`
  + `<p><strong>L’Iran.</strong> Sur Polymarket, un cessez-le-feu effectif entre les États-Unis et l’Iran jusqu’au ${lit('15 novembre')} est coté ${st(pmIran, 2)} : les parieurs n’y croient pas. Une invasion américaine avant ${lit('2027')} est cotée ${st(pmInvade)}. Le pétrole a pourtant chuté cette semaine, surtout lundi et mercredi, sans cause établie dans nos sources ; vendredi, selon Reuters, l’espoir d’une désescalade le soutenait. Une rupture ferait remonter le baril, donc l’inflation que la Fed regarde.</p>`
  + `<p><strong>L’Asie.</strong> Selon Reuters, le Nikkei et le Kospi ont perdu environ ${reg('/facts/reuters_1106/nikkei_kospi_drop_pct', 'reuters_1106', 'asia', 0, ' %')} vendredi, au lendemain de la chute de New York. Les fonds Corée (EWY) et Taïwan (EWT), cotés à New York, font ${perf('EWY')} et ${perf('EWT')} sur la semaine : ces pays fabriquent l’essentiel des puces et de la mémoire de l’IA.</p>`));

// 12. Rotation et feux verts
const sectorList = ['XLK', 'XLB', 'XLF', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU', 'XLC', 'XLRE', 'XLE'];
const sectorOrder = sectorList.slice().sort((a, b) => perfValue(a) - perfValue(b));
if (sectorOrder[0] !== 'XLE' || sectorOrder[1] !== 'XLK' || sectorOrder[10] !== 'XLC') throw new Error(`ordre sectoriel inattendu ${sectorOrder}`);
sections.push(section('rotation', 'fa-arrows-rotate', `Rotation et nos ${lit('trois')} feux verts`,
  `<p>En bas, l’énergie (${perf('XLE', 1, 'xle4')}) et la technologie (${perf('XLK')}). En haut, la communication (${perf('XLC')}), l’immobilier (${perf('XLRE')}) et la consommation discrétionnaire (${perf('XLY')}). La santé (${perf('XLV', 2)}) et la consommation de base (${perf('XLP')}) finissent presque à plat. Les capitaux sont sortis de la tech et du pétrole ; les défensives ont à peine bougé cette semaine, après avoir mené le mois : sur ${lit('21 séances')}, la santé fait ${perfBack('XLV', 21, 1, 'xlv21')} et la consommation de base ${perfBack('XLP', 21, 1, 'xlp21')}.</p>`
  + chart('sectorChart', 'Secteurs, du plus faible au plus fort sur la semaine', 'Énergie et technologie en bas, communication en haut. Invalidation : la technologie qui repasse en tête mercredi soir, après l’inflation et CoreWeave.')
  + `<h3>Nos ${lit('trois')} feux verts pour revenir : aucun n’est allumé</h3><p>Notre règle, publiée le ${lit('5 novembre')} : quand ${lit('deux des trois')} passent au vert, on lève la prudence. Les feux ${lit('2')} et ${lit('3')} se mesurent sur ${lit('cinq séances')}.</p>`
  + table(['Feu', 'Condition', 'Clôture du 6 novembre'.replace('6 novembre', lit('6 novembre')), `Relevé du vendredi ${regDay('ppi_release', 'bls_ppi', 'l_rel', 'day_month')}, ${nyClose('l_rel_t')}`], [
    [lit('1'), `Les actions nerveuses (SPHB) repassent au-dessus de ${px('SPHB', TH_DATE, 4, 2, 'th1')}, leur clôture du ${day(TH_DATE, 'th1_d')}`, close('SPHB', 2), `SPHB au-dessus de ${px('SPHB', TH_DATE, 4, 2, 'th1b')} : il faut ${lit(sphbNeed)}`],
    [lit('2'), `Sur ${lit('cinq séances')}, le ${SP()} (SPY) fait mieux que l’action moyenne (RSP)`, `SPY ${perf('SPY', 1, 'l2_spy')}, RSP ${perf('RSP', 1, 'l2_rsp')}`, `Vendredi ${regDay('ppi_release', 'bls_ppi', 'l2_d', 'day_month')}, SPY doit avoir mieux fait que RSP depuis ${close('SPY')} et ${close('RSP')}`],
    [lit('3'), `Sur ${lit('cinq séances')}, Corée (EWY) et Taïwan (EWT) finissent en hausse, l’une et l’autre`, `EWY ${perf('EWY', 1, 'l3_ewy')}, EWT ${perf('EWT', 1, 'l3_ewt')}`, `Vendredi, EWY au-dessus de ${close('EWY')} et EWT au-dessus de ${close('EWT')}`]
  ])
  + `<div class="pedagogy-box"><h4>Pourquoi ces feux-là</h4><p>Le premier dit si l’appétit pour le risque revient. Le deuxième, si les grandes valeurs, qui portent l’IA, reprennent la tête du marché. Le troisième, si les pays qui fabriquent les puces cessent de baisser. Une seule séance ne suffit pas : c’est pour cela que les feux ${lit('2')} et ${lit('3')} se lisent sur une semaine glissante.</p></div>`
  + chart('lightsChart', `Feux ${lit('2')} et ${lit('3')} sur ${lit('cinq séances')} glissantes, en points`, `Au-dessus de zéro, le feu est vert. Les courbes sont loin dessous depuis la fin octobre. Attention : jeudi, la chute du ${lit('5 novembre')} sort de la fenêtre et les courbes peuvent remonter par simple effet de calcul. Seul le relevé à la clôture du vendredi ${lit('13 novembre')} compte.`)));

// 13. Risques
sections.push(section('risks', 'fa-shield-halved', 'Matrice des risques',
  table(['Risque', 'Signal actuel', 'Conséquence', 'Invalidation'], [
    ['Inflation au-dessus des attentes', `Hausse de décembre cotée ${st(pmHike)} sur Polymarket`, 'La tech et l’or baissent ensemble mardi', 'Indice conforme, taux longs en repli jeudi'],
    ['CoreWeave inquiète sur son financement', `Titre à ${close('CRWV')}, ${perfBack('CRWV', 21, 1, 'crwv21')} sur ${lit('21 séances')}`, 'Nouvelle vente des loueurs de puces et de leurs fournisseurs', 'CoreWeave au-dessus de sa clôture de mardi, mercredi soir'],
    [`${SP()} sous sa moyenne des ${lit('deux cents séances')}`, `${sysN('index_price', 0, '', 'r_spx')} contre environ ${sysN('sma200', 0, '', 'r_sma')}`, 'La correction devient une tendance baissière', 'Clôtures au-dessus de la moyenne toute la semaine'],
    ['Peur concentrée sur la semaine', `VIX à ${lit('neuf jours')} ${termClose('9D', 'r_v9')} contre ${termClose('3M', 'r_v3m')} à ${lit('trois mois')}`, 'Écarts larges, ordres exécutés loin du prix voulu', 'Courbe de volatilité qui se redresse'],
    ['Rupture avec l’Iran', `Cessez-le-feu jusqu’au ${lit('15 novembre')} coté ${st(pmIran, 2)}`, 'Pétrole en hausse, inflation attendue plus haute', 'Pétrole stable jusqu’à vendredi'],
    ['Lois locales contre les centres de données', 'Annonce de la gouverneure élue du Texas (Reuters)', 'Moins de constructions, moins de commandes de puces', 'Comptes de CoreWeave et de Cisco sans baisse des carnets']
  ])));

// 14. Allocation
sections.push(section('allocation', 'fa-chart-pie', 'Allocation tactique',
  `<div class="allocation-grid">${card(`<h3>Liquidités</h3><p>Garder l’argent disponible jusqu’à la clôture de mercredi. Ce n’est ni une consigne de vente ni l’arrêt d’un versement programmé. Le modèle attend ${n('regime', `${outerPtr}/expected_return_spy_pct`, R.expected_return_spy_pct, 2, ' %', 'exp_ret2', true)} sur ${n('regime', `${outerPtr}/horizon_days`, R.horizon_days, 0, '', 'horizon2')} jours, mais met ${lit(offTxt)} à une semaine sur le début de prudence et la crise réunis ; et la semaine apporte des réponses qui peuvent faire bouger les cours fort dans un sens comme dans l’autre.</p>`)}${card(`<h3>Actions</h3><p>Ne pas renforcer la tech avant mercredi soir. Si les ${lit('deux tests')} passent, la première tranche porte sur un ETF large européen (UCITS), pas sur des titres choisis un à un ; la deuxième attend ${lit('deux feux sur trois')} au relevé du vendredi et ne s’achète qu’après Nvidia.</p>`)}${card(`<h3>Or, pétrole, crypto</h3><p>Rien à changer. GLD, USO, IBIT, comme SPUS ou HLAL, sont des fonds américains, souvent inaccessibles à un particulier français : ici des thermomètres, pas des produits à acheter.</p>`)}</div>`
  + `<div class="pedagogy-box"><h4>Euro et dollar</h4><p>Une inflation américaine forte soutient le dollar, donc la valeur en euros des actions américaines, même quand leur cours ne bouge pas. L’inverse vaut pour un chiffre faible.</p></div>`
  + chart('regimeChart', 'Composantes du moteur de régime', 'Seul le dollar est au plus haut de son échelle ; le VIX et le crédit tirent le score vers le bas : la composante VIX est à zéro, son plus mauvais score. Invalidation : un VIX qui retombe sous sa moyenne récente et un crédit qui se redresse feraient sortir le moteur du début de prudence.')));

// 15. Trades
sections.push(section('trades', 'fa-scale-balanced', 'Trades de la semaine',
  `<h3>Bilan de la consigne précédente</h3><p>L’hebdo du ${lit('26 octobre')} ne publiait aucun ordre et sa condition d’achat n’a pas été remplie. Il n’y a pas de gain ou de perte à comptabiliser.</p>`
  + `<div class="alert-box" data-status="no_setup"><strong>Pas de configuration exploitable avant mercredi soir.</strong> Aucun titre ne réunit cette semaine une tendance intacte, un catalyseur daté et un risque mesurable avant l’inflation et CoreWeave. Les clôtures de vendredi (CoreWeave ${close('CRWV')}, Nvidia ${close('NVDA')}, Cisco ${close('CSCO')}, Applied Materials ${close('AMAT')}) sont des repères, pas des prix d’entrée. La seule action prévue relève de l’allocation : la tranche sur ETF large européen décrite plus haut, si les ${lit('deux tests')} passent.</div>`));

// 16. Chaîne de l’IA
const chain = [
  ['NVDA', 'Fournisseur principal des puces d’IA'], ['AMD', 'Processeurs graphiques concurrents'], ['AVGO', 'Puces sur mesure et réseau'], ['MU', 'Mémoire à haute bande passante'], ['TSM', 'Fonderie des puces d’IA'],
  ['AMAT', 'Machines de fabrication des puces'], ['LRCX', 'Machines de gravure'], ['ORCL', 'Cloud, gros acheteur de puces d’IA'], ['MSFT', 'Client des loueurs de capacités'],
  ['CSCO', 'Réseau des centres de données'], ['ANET', 'Réseau des centres de données'], ['DELL', 'Serveurs d’IA'], ['SMCI', 'Serveurs d’IA'], ['VRT', 'Alimentation et refroidissement'], ['GEV', 'Turbines et réseau électrique'], ['CEG', 'Électricité nucléaire sous contrat']
];
if (!chain.filter(([s]) => s !== 'MSFT' && s !== 'ANET').every(([s]) => perfValue(s) < 0)) throw new Error('la chaîne n’a plus entièrement baissé');
if (!(perfValue('MSFT') > 0 && perfValue('ANET') > 0)) throw new Error('Microsoft / Arista');
sections.push(section('themes', 'fa-diagram-project', 'Qui dépend des comptes de CoreWeave',
  `<p>Les dépenses de CoreWeave sont les ventes de ses fournisseurs : puces, mémoire, serveurs, réseau, électricité. Sur la semaine, toute la chaîne baisse, sauf Microsoft (${perf('MSFT', 1, 'msft_t')}), client plus que fournisseur, et Arista (${perf('ANET', 1, 'anet_t')}). Micron (${perf('MU', 1, 'mu_t')}), Dell (${perf('DELL', 1, 'dell_t')}) et Vertiv (${perf('VRT', 1, 'vrt_t')}) perdent le plus. Vendredi, le rebond a été le plus fort chez AMD (${perfBetween('AMD', D05, REF, 1, 'amd_f')}) et Lam Research (${perfBetween('LRCX', D05, REF, 1, 'lrcx_f')}) ; Reuters chiffre à ${reg('/facts/reuters_1106/sox_pct', 'reuters_1106', 'sox', 1, ' %')} la hausse de l’indice des semi-conducteurs de Philadelphie.</p>`
  + table(['Titre', 'Lien avec CoreWeave', 'Semaine', 'Vendredi', lit('21 séances')], chain.map(([s, role]) => [labels[s], role, perf(s, 1, 'ch'), perfBetween(s, D05, REF, 1, 'chf'), perfBack(s, 21, 1, 'chm')]))
  + `<div class="pedagogy-box"><h4>Ce que la chaîne a déjà fait</h4><p>Sur ${lit('21 séances')}, Dell (${perfBack('DELL', 21, 1, 'dell21')}) et CoreWeave (${perfBack('CRWV', 21, 1, 'crwv21b')}) ont perdu plus de ${lit('40 %')}. Une partie de la mauvaise nouvelle est donc dans les cours. Si CoreWeave confirme ses contrats et son financement, le rebond peut être brutal ; s’il réduit ses prévisions, la baisse touchera d’abord les serveurs et la mémoire.</p></div>`
  + chart('blastChart', `Fournisseurs et clients de l’IA, sur ${lit('21 séances')}`, 'Presque toute la chaîne est rouge sur un mois, Microsoft fait exception. Invalidation : une reprise groupée mercredi soir effacerait la lecture d’une demande en baisse.')
  + chart('focusChart', `CoreWeave, Nvidia, Cisco, Applied Materials, base ${lit('100')} le ${lit('23 octobre')}`, `CoreWeave décroche le plus ; Nvidia, Cisco et Applied Materials finissent groupés, vers ${lit('−12 %')} depuis le ${lit('23 octobre')}. Invalidation : si ces lignes repartent ensemble mercredi, le marché aura acheté la demande plutôt qu’un nom.`)));

// 17. Perspectives
sections.push(section('outlook', 'fa-binoculars', 'Perspectives',
  `<div class="scenario-grid">${card(`<h3>Scénario central</h3><p>Une inflation proche des attentes, des comptes de CoreWeave sans surprise majeure. Le marché rebondit par à-coups sans effacer la chute du ${day(D05, 'o_d05')}. Le signal : SMH reste sous ${lit('478 $')} mercredi soir. Action : rester en liquidités, puis relever les feux vendredi à la clôture.</p>`)}${card(`<h3>Scénario haussier</h3><p>Une inflation sage et un CoreWeave qui confirme ses contrats et son financement. Le signal : mercredi à ${nyClose('o_close')}, SMH au-dessus de ${lit('478 $')} et le QQQ dans la ${lit('moitié haute')} de sa séance. Action : première tranche jeudi entre ${lit('15h45')} et ${lit('17h30')}, à cours limité (clôture de mercredi de l’ETF plus ${lit('1 %')} au plus), sur un ETF large européen, coupée si le QQQ clôture sous ${px('QQQ', D05, 4, 2, 'o_stop')}.</p>`)}${card(`<h3>Scénario baissier</h3><p>Une inflation forte, une hausse de décembre qui se renforce, puis un CoreWeave qui réduit ses prévisions. Le signal : le ${SP()} clôture sous sa moyenne des ${lit('deux cents séances')}, environ ${sysN('sma200', 0, '', 'o_sma')}. Action : ne pas acheter la baisse, attendre Nvidia, le ${regDate('/facts/earnings/nvda', 'nvidia_ir', 'o_nv', 'day_month')}.</p>`)}</div>`
  + `<p><strong>Cas mixte.</strong> Inflation forte mais CoreWeave rassurant : les puces peuvent rebondir pendant que l’or et les obligations baissent. Un seul test passé ne suffit pas ; on attend.</p><p>Le modèle d’états ne chiffre pas ces scénarios. Aujourd’hui, il exclut la crise (${pct('regime', `${outerPtr}/probabilities/crisis`, R.probabilities.crisis, 0, 'now_cr')}) ; à une semaine, il lui donne ${pct('regime', `${outerPtr}/transition_5d/crisis`, R.transition_5d.crisis, 1, 'tr_cr2')}, et ${pct('regime', `${outerPtr}/transition_5d/risk_on`, R.transition_5d.risk_on, 1, 'tr_on2')} à l’appétit pour le risque.</p>`
  + `<div class="pedagogy-box"><h4>Ce qu’il faut surveiller</h4><p>Mardi à ${regTime('cpi_release', 'bls_cpi', 's_cpi')}, l’inflation, et la réaction de l’or et du dollar. Mardi à ${regTime('coreweave_call', 'coreweave_ir', 's_crw')}, CoreWeave : contrats signés, dette, prévisions. Mercredi à ${nyClose('s_close')}, SMH et le QQQ face aux ${lit('deux tests')}. Jeudi soir, Cisco et Applied Materials. Vendredi, les prix à la production à ${regTime('ppi_release', 'bls_ppi', 's_ppi')}, puis le relevé des feux à la clôture.</p></div>`));

// 18. Sources
const links = [
  ['bls_cpi', 'Bureau of Labor Statistics, calendrier de l’inflation'], ['bls_ppi', 'Bureau of Labor Statistics, calendrier des prix à la production'],
  ['nyse_hours', 'NYSE, jours de Bourse'], ['sifma_holidays', 'SIFMA, jours fériés du marché obligataire'], ['fomc_calendar', 'Réserve fédérale, calendrier des réunions'],
  ['coreweave_ir', 'CoreWeave, date des résultats'], ['cisco_pr', 'Cisco, date des résultats'], ['amat_pr', 'Applied Materials, date des résultats'], ['nvidia_ir', 'Nvidia, date des résultats'],
  ['reuters_1106', `Reuters, la séance du ${lit('6 novembre')}`], ['crypto_wrap_1106', 'CryptoProwl, bilan crypto de la semaine'], ['cnbc_1105', `CNBC, la séance du ${lit('5 novembre')} et les votes sur les centres de données`], ['cnbc_neoclouds', 'CNBC, Nvidia et les neoclouds']
].map(([k, label]) => { const u = primary.sources[k] && primary.sources[k].url; if (!u) throw new Error(`lien absent ${k}`); return `<li><a href="${u}" rel="noopener" target="_blank">${label}</a></li>`; });
links.push(`<li><a href="/daily/20261106/">Notre daily du ${lit('6 novembre')}</a></li>`, `<li><a href="/weekly/20261026/">Notre hebdo du ${lit('26 octobre')}</a></li>`, '<li><a href="/rotation/">Rotation des secteurs et des pays</a></li>');
sections.push(section('sources', 'fa-database', 'Sources et qualité',
  table(['Bloc', 'Statut', 'Limite'], [
    ['Prix, secteurs, pays', badge('VALIDÉ', 'green'), `Clôture US du ${barDate('SPY', REF, 'full', 'refdate2')}`],
    ['Crypto', badge('VALIDÉ', 'green'), 'Dernière clôture complétée des fonds cotés'],
    ['Agenda macro', badge('VALIDÉ', 'green'), 'Calendrier collecté ; inflation, prix à la production et jours fériés lus sur les sites officiels'],
    ['Dates de CoreWeave, Cisco, Applied Materials, Nvidia', badge('VALIDÉ', 'green'), 'Communiqués des sociétés'],
    ['Calendrier des autres résultats', badge('PARTIEL', 'yellow'), `Couvre jusqu’au ${calEnd('cal_end_src')} seulement`],
    [`Taux à ${lit('dix ans')}`, badge('PARTIEL', 'yellow'), 'Non certifiable en clôture chez notre source ; chiffre de Reuters'],
    ['Prix à la production', badge('CORRIGÉ', 'yellow'), 'Le calendrier collecté se trompe de jour ; la date de la BLS fait foi']
  ])
  + `<div class="source-links"><h3>Sources officielles et presse</h3><ul>${links.join('')}</ul><h3>Méthode</h3><p>Chaque variation de semaine part de la clôture du ${barDate('SPY', START, 'full', 'start2')} et finit à celle du ${barDate('SPY', REF, 'full', 'refdate3')}. La fenêtre de ${lit('21 séances')} est un décompte de barres, pas un mois civil. La réaction aux résultats compare la clôture de la veille de chaque publication à celle du lendemain. Le VIX et les échéances de volatilité sont les clôtures de vendredi. Les graphiques reprennent ces mêmes séries.</p></div>`));

if (sections.length !== 18) throw new Error(`sections: ${sections.length}`);

// ── Graphiques ───────────────────────────────────────────────────────────────
const barSpec = (syms, fn = perfValue) => ({
  grid: { left: 170, right: 56, top: 16, bottom: 36 },
  xAxis: { type: 'value', name: '%' },
  yAxis: { type: 'category', data: syms.map(s => labels[s]), axisLabel: { fontSize: 11 } },
  series: [{ type: 'bar', data: syms.map(s => ({ value: +fn(s).toFixed(2), itemStyle: { color: fn(s) >= 0 ? '#15803d' : '#b91c1c' } })), label: { show: true, position: 'right', formatter: '{c} %' } }]
});
// Rendez-vous par jour : lundi Constellation, KKR, Take-Two ; mardi Waller, inflation, CoreWeave ; mercredi le jour férié obligataire ;
// jeudi chômage, Barr, Cisco, Applied Materials ; vendredi prix à la production, Michigan.
const dayCounts = [3, 3, 1, 4, 2];
const w5 = (s, i, b) => (b[i][4] / b[i - 5][4] - 1) * 100;
const lightDates = barsOf('SPY').map(x => x[0]).filter(d => d >= '2026-10-26' && d <= REF);
const l2 = lightDates.map(d => { const a = barsOf('SPY'), c = barsOf('RSP'); const i = a.findIndex(x => x[0] === d), j = c.findIndex(x => x[0] === d); return +(w5('SPY', i, a) - w5('RSP', j, c)).toFixed(2); });
const l3 = lightDates.map(d => { const a = barsOf('EWY'), c = barsOf('EWT'); const i = a.findIndex(x => x[0] === d), j = c.findIndex(x => x[0] === d); return +Math.min(w5('EWY', i, a), w5('EWT', j, c)).toFixed(2); });
const chartSeries = symbol => { const b = barsOf(symbol).filter(x => x[0] >= '2026-10-23'); const base = b[0][4]; return b.map(x => [x[0], +(x[4] / base * 100).toFixed(3)]); };
const chartSpecs = [
  ['calendarChart', { grid: { left: 40, right: 16, top: 20, bottom: 36 }, xAxis: { type: 'category', data: ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.'] }, yAxis: { type: 'value', name: 'rendez-vous', minInterval: 1 }, series: [{ type: 'bar', data: dayCounts, itemStyle: { color: '#2563eb' } }] }],
  ['crossAssetChart', barSpec(['SPY', 'QQQ', 'IWM', 'DIA', 'SMH', 'TLT', 'GLD', 'SLV', 'USO'])],
  ['volChart', { grid: { left: 48, right: 16, top: 20, bottom: 36 }, xAxis: { type: 'category', data: term.map(x => x.node.tenor) }, yAxis: { type: 'value', scale: true }, series: [{ type: 'line', smooth: true, symbolSize: 8, data: term.map(x => x.node.prev_close), lineStyle: { width: 3, color: '#7c3aed' } }] }],
  ['metalsChart', barSpec(['GLD', 'SLV', 'USO', 'XLE', 'TLT'])],
  ['cryptoChart', barSpec(['IBIT', 'ETHA', 'SOLZ'])],
  ['earningsChart', { grid: { left: 150, right: 48, top: 16, bottom: 36 }, xAxis: { type: 'value', name: '%' }, yAxis: { type: 'category', data: ['CEG', 'NVDA', 'CSCO', 'AMAT', 'TTWO', 'CRWV'].map(s => labels[s]) }, series: [{ type: 'bar', data: ['CEG', 'NVDA', 'CSCO', 'AMAT', 'TTWO', 'CRWV'].map(s => +medianValue(s).toFixed(2)), itemStyle: { color: '#ea580c' }, label: { show: true, position: 'right', formatter: '{c} %' } }] }],
  ['sectorChart', barSpec(sectorOrder)],
  ['lightsChart', { grid: { left: 48, right: 16, top: 36, bottom: 36 }, legend: { data: ['Feu 2 : SPY moins RSP', 'Feu 3 : le plus faible de EWY et EWT'] }, xAxis: { type: 'category', data: lightDates.map(d => d.slice(8) + '/' + d.slice(5, 7)) }, yAxis: { type: 'value', name: 'points' }, series: [{ name: 'Feu 2 : SPY moins RSP', type: 'line', data: l2, itemStyle: { color: '#2563eb' }, lineStyle: { width: 3, color: '#2563eb' }, markLine: { symbol: 'none', data: [{ yAxis: 0 }], lineStyle: { color: '#15803d', type: 'dashed' } } }, { name: 'Feu 3 : le plus faible de EWY et EWT', type: 'line', data: l3, itemStyle: { color: '#ea580c' }, lineStyle: { width: 3, color: '#ea580c' } }] }],
  ['regimeChart', { radar: { indicator: [['credit_score', 'Crédit'], ['dxy_score', 'Dollar'], ['spx_score', 'S&P 500'], ['tlt_score', 'Obligations'], ['vix_score', 'VIX'], ['liquidity_score', 'Liquidité']].map(([, name]) => ({ name, max: 1 })) }, series: [{ type: 'radar', data: [{ value: ['credit_score', 'dxy_score', 'spx_score', 'tlt_score', 'vix_score', 'liquidity_score'].map(k => +Number(SYS[k]).toFixed(3)), areaStyle: { color: 'rgba(37,99,235,.2)' } }] }] }],
  ['blastChart', barSpec(chain.map(([s]) => s).concat(['CRWV']), s => perfBackValue(s, 21))],
  ['focusChart', { grid: { left: 48, right: 16, top: 28, bottom: 36 }, legend: { data: ['CRWV', 'NVDA', 'CSCO', 'AMAT'] }, xAxis: { type: 'time' }, yAxis: { type: 'value', name: 'base 100', scale: true }, series: ['CRWV', 'NVDA', 'CSCO', 'AMAT'].map(s => ({ name: s, type: 'line', smooth: true, symbolSize: 6, data: chartSeries(s) })) }]
].map(([id, spec]) => ({ id, spec }));


const title = 'Mardi, l’inflation puis CoreWeave';
const description = 'La chute des puces du 5 novembre n’a pas été rattrapée : vendredi, le rebond est resté faible. Mardi, l’inflation d’octobre puis les comptes de CoreWeave diront si le coût de l’argent et le financement des centres de données pèsent encore.';
const html = `<!doctype html><html lang="fr" dir="ltr" data-level="intermediate" data-tags="us,asia,macro,earnings,tech,semis,ai,gold,crypto,commodity" data-tab="weekly"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DailyTickers | ${title}</title><meta name="description" content="${description}"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:image" content="https://articles.dailytickers.com/logo.svg"><meta property="og:url" content="https://articles.dailytickers.com/weekly/20261109/"><meta property="og:type" content="article"><script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-T5Z595CW');</script><link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/assets/report.css"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&amp;display=swap" rel="stylesheet"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"><script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script></head><body class="weekly-brief"><noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-T5Z595CW" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript><nav class="brand-bar"><div class="brand-bar-inner"><a href="/" class="brand-logo"><img src="/logo.svg" alt="" width="36" height="36"><span class="brand-title">DailyTickers</span></a><div class="brand-nav"><a href="/?tab=weekly">Hebdo</a><a href="/?tab=daily">Daily</a><a href="/?tab=analyses">Analyses</a><a href="/?tab=scanner">Scanner</a><a href="/?tab=radar">Radar</a><a href="/?tab=series">S&eacute;ries</a></div><div class="brand-actions"><a href="/" class="brand-home-btn" title="Accueil"><i class="fas fa-house"></i></a></div></div></nav><main class="report-container"><header class="hero-section"><div class="report-card-meta">Semaine du ${lit('9 au 13 novembre 2026')} · données au ${barDate('SPY', REF, 'full', 'refdate_hero')}</div><h1>${title}</h1><p class="hero-subtitle">${description.replace('5 novembre', lit('5 novembre'))}</p><div id="article-clickable-tags" class="card-tags"></div></header><nav class="report-jump-nav" aria-label="Sommaire"><a href="#verdict">Verdict</a><a href="#agenda">Agenda</a><a href="#earnings">Résultats</a><a href="#rotation">Feux verts</a><a href="#risks">Risques</a><a href="#outlook">Perspectives</a></nav>${sections.join('\n')}</main><div class="fnav"><a href="#verdict" title="Verdict"><i class="fas fa-flag-checkered"></i></a><a href="#agenda" title="Agenda"><i class="fas fa-calendar-week"></i></a><a href="#earnings" title="Résultats"><i class="fas fa-building"></i></a><a href="#rotation" title="Feux verts"><i class="fas fa-arrows-rotate"></i></a><a href="#outlook" title="Perspectives"><i class="fas fa-binoculars"></i></a><a href="#sources" title="Sources"><i class="fas fa-database"></i></a></div><footer class="article-footer">&copy; 2026 DailyTickers. Données arrêtées à la dernière clôture. Information générale, pas un conseil en investissement.<br><a href="/" title="Home"><i class="fas fa-house"></i></a></footer><script>const CHART_SPECS=${JSON.stringify(chartSpecs)};(function(){if(typeof echarts==='undefined')return;const xs=[];for(const c of CHART_SPECS){const el=document.getElementById(c.id);if(!el)continue;const x=echarts.init(el);x.setOption(Object.assign({animation:false,textStyle:{fontFamily:'Inter,system-ui,sans-serif'},tooltip:{trigger:'axis'}},c.spec));xs.push(x)}addEventListener('resize',()=>xs.forEach(x=>x.resize()))})();</script><script src="/assets/core.js"></script><script src="/assets/tag-renderer.js"></script><script src="/assets/echarts-responsive.js"></script></body></html>`;

fs.writeFileSync(path.join(DIR, 'index.html'), html);
const articleSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, 'index.html'))).digest('hex');
fs.writeFileSync(path.join(DIR, '_data/chart-data.json'), JSON.stringify({ reference_close: REF, start_close: START, chart_specs: chartSpecs }, null, 2) + '\n');
fs.writeFileSync(path.join(DIR, '_data/claims.json'), JSON.stringify({ reference_close: REF, article_path: `${REL}/index.html`, article_sha256: articleSha, generated_by: `${REL}/_build.cjs`, literals: [...literals].sort(), claims }, null, 2) + '\n');
console.log(`weekly rendu: ${sections.length} sections, ${chartSpecs.length} graphiques, ${claims.length} claims, ${(html.length / 1024).toFixed(1)} Ko`);
