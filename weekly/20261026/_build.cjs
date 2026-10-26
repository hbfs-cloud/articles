#!/usr/bin/env node
'use strict';

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { renderValue } = require('../../tools/validate-content-claims');

const ROOT = path.resolve(__dirname, '../..');
const REL = 'weekly/20261026';
const DIR = path.join(ROOT, REL);
const read = rel => JSON.parse(fs.readFileSync(path.join(DIR, rel), 'utf8'));
const digest = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex');
const esc = s => String(s).replace(/~/g, '~0').replace(/\//g, '~1');
const sources = {
  indices: '_data/bars_indices.json', sectors: '_data/bars_sectors.json', crypto: '_data/bars_crypto.json',
  regime: '_data/regime.json', options: '_data/options_sentiment.json',
  earnings: '_data/earnings_calendar.json', systemic: '_data/earnings_systemic.json', economic: '_data/economic_events.json',
  focus: '_focus/focus_bars.json', fund: '_focus/focus_fundamentals.json', tech: '_focus/focus_technicals.json',
  blastA: '_focus/blast_bars_a.json', blastB: '_focus/blast_bars_b.json',
  chainA: '_focus/chain_reactions_a.json', sys: '_data/regime_systematic.json'
};
const D = Object.fromEntries(Object.entries(sources).map(([k, v]) => [k, read(v)]));
const artifact = key => `${REL}/${sources[key]}`;
const REF = '2026-10-23';
const START = '2026-10-16';
const PRIMARY = 'daily/20261022/primary-reference.json';
const primary = JSON.parse(fs.readFileSync(path.join(ROOT, PRIMARY), 'utf8'));

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
  for (const key of ['indices', 'sectors', 'crypto', 'focus', 'blastA', 'blastB']) {
    const hit = walk(D[key], x => x && x.symbol === symbol && Array.isArray(x.bars) && x.bars.length);
    if (hit) return { ...hit, key };
  }
  throw new Error(`barres absentes: ${symbol}`);
}
function eventHit(key, symbol) {
  const hit = walk(D[key], x => x && x.symbol === symbol && x.report_date);
  if (!hit) throw new Error(`publication absente: ${symbol}`);
  return { ...hit, key };
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
function registryClaim(pointer, render, stem, authority) {
  const value = pointer.slice(1).split('/').reduce((n, k) => n[k], primary);
  if (value === undefined) throw new Error(`registre: ${pointer} absent`);
  if (!primary.sources[authority]) throw new Error(`autorité absente: ${authority}`);
  const rendered = renderValue(value, render);
  if (rendered == null) throw new Error(`rendu registre impossible ${stem}`);
  const id = `${stem}_${++seq}`.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  claims.push({ id, rendered_text: rendered, source_artifact: PRIMARY, source_sha256: digest(PRIMARY), source_pointer: pointer, source_value: value, render, authority });
  return `<span data-claim="${id}">${rendered}</span>`;
}
const regDate = (pointer, authority, stem, parts = 'weekday_day_month') => registryClaim(pointer, { format: 'fr_date', parts }, stem, authority);
const n = (key, pointer, value, decimals = 1, suffix = '', stem = 'n', sign) => claim(key, pointer, value, { scale: 1, decimals, suffix, format: 'fr', ...(sign ? { sign: 'always' } : {}) }, stem);
const pct = (key, pointer, value, decimals = 1, stem = 'p') => claim(key, pointer, value, { scale: 100, decimals, suffix: ' %', format: 'fr' }, stem);
const dt = (key, pointer, value, parts = 'weekday_day_month', stem = 'date') => claim(key, pointer, value, { format: 'fr_date', parts }, stem);
const tm = (key, pointer, value, zone = 'America/New_York', stem = 'time') => claim(key, pointer, value, { format: 'fr_time', zone }, stem);

function perf(symbol, startDate = START, decimals = 1, stem = 'perf') {
  const h = barHit(symbol), b = h.node.bars, i = b.length - 1, j = b.findIndex(x => x[0] === startDate);
  if (b[i][0] !== REF) throw new Error(`${symbol}: dernière barre ${b[i][0]}`);
  if (j < 0 || j >= i) throw new Error(`${symbol}: base ${startDate} absente`);
  const value = (b[i][4] / b[j][4] - 1) * 100;
  return claim(h.key, `${h.ptr}/bars/${i}/4`, b[i][4], { scale: 1, decimals, suffix: ' %', sign: 'always', format: 'fr' }, `${stem}_${symbol}`, {
    operation: 'ratio_pct', numerator_pointer: `${h.ptr}/bars/${i}/4`, denominator_pointer: `${h.ptr}/bars/${j}/4`, result: value
  });
}
function perfBack(symbol, sessions, decimals = 1, stem = 'm') {
  const h = barHit(symbol), b = h.node.bars, i = b.length - 1, j = i - sessions;
  if (j < 0) throw new Error(`${symbol}: fenêtre ${sessions} impossible`);
  if (b[i][0] !== REF) throw new Error(`${symbol}: dernière barre ${b[i][0]}`);
  const value = (b[i][4] / b[j][4] - 1) * 100;
  return claim(h.key, `${h.ptr}/bars/${i}/4`, b[i][4], { scale: 1, decimals, suffix: ' %', sign: 'always', format: 'fr' }, `${stem}_${symbol}`, {
    operation: 'ratio_pct', numerator_pointer: `${h.ptr}/bars/${i}/4`, denominator_pointer: `${h.ptr}/bars/${j}/4`, result: value
  });
}
function close(symbol, decimals = 2) {
  const h = barHit(symbol), i = h.node.bars.length - 1, v = h.node.bars[i][4];
  return n(h.key, `${h.ptr}/bars/${i}/4`, v, decimals, ' $', `close_${symbol}`);
}
function barDate(symbol, date, parts = 'weekday_day_month', stem = 'bdate') {
  const h = barHit(symbol), b = h.node.bars, j = b.findIndex(x => x[0] === date);
  if (j < 0) throw new Error(`${symbol}: date ${date} absente`);
  return dt(h.key, `${h.ptr}/bars/${j}/0`, b[j][0], parts, `${stem}_${symbol}`);
}
const perfValue = (symbol, startDate = START) => {
  const b = barHit(symbol).node.bars, i = b.length - 1, j = b.findIndex(x => x[0] === startDate);
  return (b[i][4] / b[j][4] - 1) * 100;
};
const perfBackValue = (symbol, sessions) => { const b = barHit(symbol).node.bars, i = b.length - 1; return (b[i][4] / b[i - sessions][4] - 1) * 100; };
const chartSeries = symbol => {
  const b = barHit(symbol).node.bars.filter(x => x[0] >= START);
  const base = b[0][4];
  return b.map(x => [x[0], +(x[4] / base * 100).toFixed(3)]);
};

const labels = {
  SPY: 'S&P', QQQ: 'Nasdaq', IWM: 'Russell', DIA: 'Dow Jones', GLD: 'Or', SLV: 'Argent', TLT: 'Obligations longues', USO: 'Pétrole',
  XLK: 'Technologie', XLB: 'Matériaux', XLF: 'Finance', XLV: 'Santé', XLI: 'Industrie', XLY: 'Consommation discrétionnaire',
  XLP: 'Consommation de base', XLU: 'Services collectifs', XLC: 'Communication', XLRE: 'Immobilier',
  IBIT: 'Bitcoin', ETHA: 'Ethereum', SOLZ: 'Solana',
  MSFT: 'Microsoft', GOOG: 'Alphabet', AMZN: 'Amazon', META: 'Meta', NVDA: 'Nvidia', KO: 'Coca-Cola',
  AVGO: 'Broadcom', AMD: 'AMD', TSM: 'TSMC', MU: 'Micron', LRCX: 'Lam Research', AMAT: 'Applied Materials',
  ORCL: 'Oracle', ANET: 'Arista', VRT: 'Vertiv', CEG: 'Constellation Energy', DELL: 'Dell', MRVL: 'Marvell'
};

// ── Régime, volatilité ───────────────────────────────────────────────────────
const regimeRoot = objectHit('regime', x => x && x.dtx_regime && x.probabilities && x.transition_5d, 'régime');
const regime = regimeRoot.node.dtx_regime;
const outerPtr = regimeRoot.ptr;
if (regime.regime !== 'recovery') throw new Error(`régime inattendu ${regime.regime}`);
const term = all(D.options, x => x && x.tenor && typeof x.level === 'number').sort((a, b) => String(a.ptr).localeCompare(String(b.ptr), undefined, { numeric: true }));
if (term.length < 4) throw new Error('courbe de volatilité incomplète');
const termOf = t => { const h = term.find(x => x.node.tenor === t); if (!h) throw new Error(`échéance ${t}`); return h; };

// ── Résultats : réaction historique et série de publications au-dessus du consensus ──
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
  return { ...hit, key: 'tech' };
}
const median = s => { const h = reactionHit(s); return n('fund', `${h.ptr}/summary/median_abs_move_percent`, h.node.summary.median_abs_move_percent, 1, ' %', `med_${s}`); };
const medianValue = s => reactionHit(s).node.summary.median_abs_move_percent;
const reactEvents = s => { const h = reactionHit(s); return n('fund', `${h.ptr}/summary/events`, h.node.summary.events, 0, '', `ev_${s}`); };
const beats = s => { const h = beatsHit(s); return n('fund', `${h.ptr}/consecutive_beats`, h.node.consecutive_beats, 0, '', `beats_${s}`); };
const rsi = s => { const h = techHit(s); return n('tech', `${h.ptr}/rsi`, h.node.rsi, 0, '', `rsi_${s}`); };
const ema200 = s => { const h = techHit(s); if (h.node.last_bar_date !== REF) throw new Error(`${s}: technique au ${h.node.last_bar_date}`); return n('tech', `${h.ptr}/ema200`, h.node.ema200, 2, ' $', `e200_${s}`); };
const aboveEma200 = s => { const b = barHit(s).node.bars; return b[b.length - 1][4] > techHit(s).node.ema200; };
if (aboveEma200('GOOG') || !aboveEma200('MSFT')) throw new Error('position face à la moyenne 200 inattendue');
const msftReact = reactionHit('MSFT');
const msftMax = msftReact.node.reactions.find(r => Math.abs(r.move_percent - msftReact.node.summary.max_up_percent) < 1e-9);
if (!msftMax || msftMax.announced_date !== '2026-07-29') throw new Error('réaction maximale MSFT inattendue');

// ── Agenda ───────────────────────────────────────────────────────────────────
const macroCards = [
  ['2026-10-26', 'German ifo Business Climate', 'Climat des affaires allemand (ifo)', 'Europe/Paris'],
  ['2026-10-28', 'FOMC Rate Decision', 'Décision de taux de la Réserve fédérale', 'America/New_York'],
  ['2026-10-28', 'Federal Reserve FOMC Press Conference', 'Conférence de presse de la Fed', 'America/New_York'],
  ['2026-10-29', 'Core PCE Price Index (Personal Income & Outlays)', 'Inflation PCE hors alimentation et énergie', 'America/New_York'],
  ['2026-10-29', 'GDP', 'PIB américain', 'America/New_York'],
  ['2026-10-29', 'ECB Rate Decision', 'Décision de taux de la BCE', 'Europe/Paris'],
  ['2026-10-30', 'Euro Area Flash HICP (Inflation)', 'Inflation de la zone euro, estimation rapide', 'Europe/Paris'],
  ['2026-10-30', 'Euro Area GDP Growth (Flash)', 'Croissance de la zone euro, estimation rapide', 'Europe/Paris']
].map(([day, name, label, zone]) => ({ day, label, zone, h: econOn(name, day) }));
const stamp = (card, kind) => kind === 'date'
  ? dt('economic', `${card.h.ptr}/event_time`, card.h.node.event_time, 'weekday_day_month', 'macro_date')
  : tm('economic', `${card.h.ptr}/event_time`, card.h.node.event_time, card.zone, 'macro_time');
const calEvents = all(D.earnings, x => x && x.symbol && typeof x.report_date === 'string' && x.report_time);
const calLast = calEvents.reduce((m, x) => (x.node.report_date > m.node.report_date ? x : m));
if (calLast.node.report_date !== '2026-10-27') throw new Error('fin du calendrier inattendue');
const calEnd = (stem = 'cal_end') => dt('earnings', `${calLast.ptr}/report_date`, calLast.node.report_date, 'weekday_day_month', stem);
const pmHit = (re, label) => objectHit('regime', x => x && x.type === 'prediction_market' && re.test(x.question || '') && typeof x.yes_price === 'number', label);
const pmFed = pmHit(/no change in Fed interest rates after the October 2026/, 'Polymarket Fed');
const pmHike = pmHit(/Fed increase interest rates by 25 bps after the October 2026/, 'Polymarket hausse');
const pmIran = pmHit(/US x Iran ceasefire continues through October 31/, 'Polymarket Iran');
const pmHouse = pmHit(/Democratic Party control the House after the 2026 Midterm/, 'Polymarket Chambre');
const pm = (h, stem) => pct('regime', `${h.ptr}/yes_price`, h.node.yes_price, 1, stem);
const metaReact = reactionHit('META');
const metaLast = metaReact.node.reactions.findIndex(r => r.announced_date === '2026-10-21');
if (metaLast < 0) throw new Error('réaction Meta du 21 octobre absente');
const metaMove = stem => n('fund', `${metaReact.ptr}/reactions/${metaLast}/move_percent`, metaReact.node.reactions[metaLast].move_percent, 1, ' %', stem);
const reg = (ptr, auth, stem, decimals = 0, suffix = '') => registryClaim(ptr, { scale: 1, decimals, suffix, format: 'fr' }, stem, auth);
const fomc = macroCards.find(x => x.label.startsWith('Décision de taux de la Réserve'));
const paris = (card, stem = 'paris_time') => tm('economic', `${card.h.ptr}/event_time`, card.h.node.event_time, 'Europe/Paris', stem);
const sessionHit = objectHit('tech', x => x && x.session_open_utc && x.session_close_utc && x.session_open_utc.startsWith('2026-10-26'), 'séance de New York');
const nyOpen = stem => tm('tech', `${sessionHit.ptr}/session_open_utc`, sessionHit.node.session_open_utc, 'Europe/Paris', stem);
const nyClose = stem => tm('tech', `${sessionHit.ptr}/session_close_utc`, sessionHit.node.session_close_utc, 'Europe/Paris', stem);
const beatCount = s => { const h = beatsHit(s); return `${n('fund', `${h.ptr}/beats`, h.node.beats, 0, '', `beatn_${s}`)} sur ${n('fund', `${h.ptr}/quarters_available`, h.node.quarters_available, 0, '', `beatq_${s}`)}`; };
const googQ = beatsHit('GOOG');
if (googQ.node.quarters[0].beat !== false || googQ.node.quarters[0].period !== '2Q2026') throw new Error('surprise Alphabet inattendue');
const press = macroCards.find(x => x.label.startsWith('Conférence de presse'));
const ecb = macroCards.find(x => x.label.startsWith('Décision de taux de la BCE'));
const pce = macroCards.find(x => x.label.startsWith('Inflation PCE'));
const ko = eventHit('systemic', 'KO');
const vz = eventHit('earnings', 'VZ');
if (ko.node.report_date !== '2026-10-27' || vz.node.report_date !== '2026-10-26') throw new Error('dates KO/VZ inattendues');
if (primary.facts.earnings.msft !== '2026-10-28' || primary.facts.earnings.googl !== '2026-10-28' || primary.facts.earnings.amzn !== '2026-10-29' || primary.facts.boj.decision_date !== '2026-10-30') throw new Error('registre primaire décalé');

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
const R = regimeRoot.node;
// Moteur de régime systématique : la source canonique du score, du VIX de clôture et des moyennes.
const SYS = D.sys;
if (SYS.asof !== REF || SYS.data_asof !== REF || SYS.regime !== 'RECOVERY') throw new Error('moteur de régime non aligné sur la clôture');
const sysN = (field, decimals, suffix, stem, sign) => n('sys', `/${field}`, SYS[field], decimals, suffix, stem, sign);
const sysScore = stem => claim('sys', '/regime_score', SYS.regime_score, { scale: 100, decimals: 0, format: 'fr' }, stem);
const vixClose = stem => sysN('vix_level', 2, '', stem);
const vixAvg = stem => sysN('vix_sma14', 2, '', stem);
const PREV_SYS = 'weekly/20261005/_data/regime_systematic.json';
const prevSys = JSON.parse(fs.readFileSync(path.join(ROOT, PREV_SYS), 'utf8'));
function extClaim(rel, pointer, value, render, stem) {
  const rendered = renderValue(value, render);
  if (rendered == null) throw new Error(`rendu externe impossible ${stem}`);
  const id = `${stem}_${++seq}`.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  claims.push({ id, rendered_text: rendered, source_artifact: rel, source_sha256: digest(rel), source_pointer: pointer, source_value: value, render });
  return `<span data-claim="${id}">${rendered}</span>`;
}
if (SYS.regime_score >= prevSys.regime_score) throw new Error('le score de régime ne baisse plus');
if (!(SYS.index_price < SYS.sma50)) throw new Error('le S&P n’est plus sous sa moyenne à cinquante séances');
// Variation entre deux clôtures quelconques d'une même série.
function perfBetween(symbol, a, b, decimals = 1, stem = 'pb') {
  const h = barHit(symbol), bars = h.node.bars, i = bars.findIndex(x => x[0] === b), j = bars.findIndex(x => x[0] === a);
  if (i < 0 || j < 0 || j >= i) throw new Error(`${symbol}: fenêtre ${a}→${b} absente`);
  const value = (bars[i][4] / bars[j][4] - 1) * 100;
  return claim(h.key, `${h.ptr}/bars/${i}/4`, bars[i][4], { scale: 1, decimals, suffix: ' %', sign: 'always', format: 'fr' }, `${stem}_${symbol}`, {
    operation: 'ratio_pct', numerator_pointer: `${h.ptr}/bars/${i}/4`, denominator_pointer: `${h.ptr}/bars/${j}/4`, result: value
  });
}
const pbValue = (symbol, a, b) => { const bars = barHit(symbol).node.bars; return (bars.find(x => x[0] === b)[4] / bars.find(x => x[0] === a)[4] - 1) * 100; };
const D02 = '2026-10-02', D09 = '2026-10-09', D21 = '2026-10-21', D22 = '2026-10-22';
const thu22 = stem => barDate('SPY', D22, 'weekday_day_month', stem);
const day = (d, stem) => barDate('SPY', d, 'day_month', stem);
const chain = [
  ['NVDA', 'Principal fournisseur des processeurs d’IA'], ['AVGO', 'Puces sur mesure et réseau'], ['AMD', 'Processeurs graphiques concurrents'],
  ['TSM', 'Fonderie des puces d’IA'], ['MU', 'Mémoire à haute bande passante'], ['LRCX', 'Machines de gravure'], ['AMAT', 'Machines de dépôt et de gravure'],
  ['ORCL', 'Cloud, gros acheteur de puces d’IA'], ['ANET', 'Réseau des centres de données'], ['VRT', 'Alimentation et refroidissement'], ['CEG', 'Électricité nucléaire sous contrat'],
  ['DELL', 'Serveurs d’IA'], ['MRVL', 'Puces sur mesure et optique']
];
if (!chain.every(([s]) => pbValue(s, D21, D22) < 0)) throw new Error('la chaîne n’a pas entièrement baissé le 22 octobre');
const sectorList = ['XLK', 'XLB', 'XLF', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU', 'XLC', 'XLRE'];
if (sectorList.filter(s => perfValue(s) > 0).length * 2 <= sectorList.length) throw new Error('la plupart des secteurs ne montent plus');
if (!(perfValue('XLK') > perfValue('MSFT') && perfValue('XLK') > perfValue('NVDA'))) throw new Error('lecture technologie / Microsoft à revoir');
// Lam Research a publié le 21 octobre, le même soir que Meta.
const lamHit = (() => { const hit = walk(D.chainA, x => x && x.symbol === 'LRCX' && Array.isArray(x.reactions)); if (!hit) throw new Error('réactions Lam absentes'); return hit; })();
const lamIdx = lamHit.node.reactions.findIndex(r => r.announced_date === '2026-10-21');
if (lamIdx < 0) throw new Error('publication Lam du 21 octobre absente');
const lamMove = n('chainA', `${lamHit.ptr}/reactions/${lamIdx}/move_percent`, lamHit.node.reactions[lamIdx].move_percent, 1, ' %', 'lam_react');
// Historique de réaction de Microsoft, publication par publication.
const msftR = msftReact.node.reactions;
const msftAt = d => { const i = msftR.findIndex(r => r.announced_date === d); if (i < 0) throw new Error(`MSFT ${d}`); return i; };
const msftMoveOn = (d, stem) => n('fund', `${msftReact.ptr}/reactions/${msftAt(d)}/move_percent`, msftR[msftAt(d)].move_percent, 1, ' %', stem, true);
const msftDateOn = (d, parts, stem) => dt('fund', `${msftReact.ptr}/reactions/${msftAt(d)}/announced_date`, d, parts, stem);
const regFacts = primary.facts;
const reg2 = (ptr, auth, stem, render) => registryClaim(ptr, render, stem, auth);
const md = { scale: 1e-3, decimals: 1, suffix: ' Md$', format: 'fr' };
const jobless = { day: '2026-10-29', label: 'Inscriptions hebdomadaires au chômage', zone: 'America/New_York', h: econOn('Initial Jobless Claims', '2026-10-29') };
const agendaCards = [...macroCards.slice(0, 5), jobless, ...macroCards.slice(5)];
const cds = eventHit('earnings', 'CDNS'), cls = eventHit('earnings', 'CLS');
if (cds.node.report_date !== '2026-10-26' || cls.node.report_date !== '2026-10-26' || cds.node.report_time !== 'AMC' || cls.node.report_time !== 'AMC') throw new Error('Cadence / Celestica décalés');
const cap = (h, stem) => n('earnings', `${h.ptr}/market_cap_b`, h.node.market_cap_b, 0, ' Md$', stem);
const term30 = termOf('30D');
if (term30.node.prev_close !== SYS.vix_level) throw new Error('VIX de clôture incohérent entre sources');
const metaDay = stem => regDate('/facts/meta/report_date', 'sec_meta_ex991', stem, 'weekday_day_month');
const tesla = stem => `environ ${reg('/facts/tesla/capex_2026_new_bn', 'press_cnbc_tesla', stem + '_new', 0, ' Md$')}, contre plus de ${reg('/facts/tesla/capex_2026_prev_bn', 'press_cnbc_tesla', stem + '_prev', 0, ' Md$')}`;
const offSum = R.transition_5d.early_risk_off + R.transition_5d.crisis;
if (Math.abs(R.transition_5d.risk_on - offSum) > 0.05) throw new Error('équilibre risk-on / repli à revoir');
const termClose = (t, stem) => n('options', `${termOf(t).ptr}/prev_close`, termOf(t).node.prev_close, 2, '', stem);

sections.push(section('verdict', 'fa-flag-checkered', 'Verdict',
  `<div class="decision-banner" data-status="ATTENDRE"><div class="decision-label">DÉCISION</div><div class="decision-value">ATTENDRE LA CLÔTURE DE JEUDI (${nyClose('v_close')} À PARIS) POUR LA TECH</div><p>Les fournisseurs de l’IA reculent depuis début octobre, avec une chute du ${day(D09, 'v_d09')} au ${day(START, 'v_d16')}, puis de nouveau le ${thu22('v_d22')}. Mercredi, la Fed décide à ${paris(fomc, 'v_fomc')}, heure de Paris ; Microsoft et Alphabet publient après la clôture de New York. N’achetez rien sur la tech avant la clôture de jeudi : ni mercredi soir, ni jeudi matin sur les places européennes qui cotent ces titres.</p></div>`
  + `<div class="stats-grid">${card(`<span class="stat-label">S&P sur la semaine</span><strong>${perf('SPY')}</strong>`)}${card(`<span class="stat-label">Russell</span><strong>${perf('IWM')}</strong>`)}${card(`<span class="stat-label">Meta</span><strong>${perf('META')}</strong>`)}${card(`<span class="stat-label">VIX</span><strong>${vixClose('vix_verdict')}</strong>`)}</div>`));

sections.push(section('fab', 'fa-crosshairs', 'Ce qui mérite une action',
  `<div class="scenario-grid">${card(`<h3>Jusqu’à jeudi, ${nyClose('f_close1')}</h3><p>Ne rien ajouter sur la tech ni sur les fournisseurs de l’IA, et ne pas vendre non plus sur la seule baisse de la semaine. Lundi soir, Cadence et Celestica, fournisseurs de l’IA, publient : une première lecture, pas encore la réponse.</p>`)}${card(`<h3>Jeudi, ${nyClose('f_close2')}</h3><p>Microsoft et Alphabet publient mercredi après la clôture. Leurs cours bougent ensuite la nuit, puis jeudi matin sur les places européennes qui les cotent, avec peu d’échanges et des écarts larges entre prix d’achat et prix de vente. N’achetez pas ce premier saut. Jeudi, l’inflation PCE et le PIB tombent à ${paris(pce, 'f_pce')}, New York ouvre à ${nyOpen('f_open')} : jugez à la clôture. Une hausse qui tient toute la séance compte ; un saut de la nuit, pas encore.</p>`)}${card(`<h3>Or et pétrole : rien à changer</h3><p>Le fonds adossé à l’or fait ${perf('GLD', START, 1, 'gld_fab')} sur la semaine, celui du pétrole ${perf('USO', START, 1, 'uso_fab')}. Ces mouvements ne se lisent pas dans les comptes de Microsoft.</p>`)}</div>`));

sections.push(section('alerte', 'fa-triangle-exclamation', 'Alerte données',
  `<div class="alert-box" data-status="PARTIEL"><strong>PARTIEL.</strong> Les prix de cette édition sont les clôtures certifiées du ${barDate('SPY', REF, 'full', 'refdate')} ; les variations de la semaine partent de la clôture du ${barDate('SPY', START, 'full', 'start')}. Le calendrier des résultats de notre source s’arrête au ${calEnd('cal_end_alert')} : les dates de Microsoft, d’Alphabet et d’Amazon viennent de leurs relations investisseurs, lues le ${registryClaim('/sources/msft_ir/fetched_at', { format: 'fr_date', parts: 'day_month' }, 'ir_read', 'msft_ir')}. L’amplitude que les options prévoient pour chaque publication n’est pas disponible ; la page la remplace par la réaction passée du titre. Le secteur de l’énergie manque à nos données sectorielles ; le pétrole est suivi par le fonds USO.</div>`));

sections.push(section('agenda', 'fa-calendar-week', 'Agenda de la semaine',
  `<p>Heures de Paris. La France est passée à l’heure d’hiver, les États-Unis pas encore : cette semaine, New York ouvre à ${nyOpen('ny_open')} et ferme à ${nyClose('ny_close')}. Lundi, Verizon publie avant l’ouverture ; le soir, Cadence et Celestica ouvrent la lecture de l’IA. Mercredi concentre tout : la Fed, sa conférence de presse, puis Microsoft et Alphabet, le ${regDate('/facts/earnings/msft', 'msft_ir', 'msft_date')}. Amazon publie le ${regDate('/facts/earnings/amzn', 'amzn_ir', 'amzn_date')} au soir, la Banque du Japon décide le ${regDate('/facts/boj/decision_date', 'boj_calendar', 'boj_date')}. Apple publie le ${regDate('/facts/earnings/aapl', 'aapl_ir', 'aapl_date')}, et les Américains votent le lendemain.</p>`
  + `<div class="scenario-grid" aria-label="Rendez-vous de la semaine, heures de Paris">${agendaCards.map(x => card(`<div class="stat-label">${stamp(x, 'date')} · ${paris(x, 'card_time')}</div><h3>${x.label}</h3>`)).join('')}</div>`
  + chart('calendarChart', 'Où se concentrent les rendez-vous', 'Mercredi et jeudi portent la Fed, Microsoft, Alphabet, Amazon, l’inflation PCE et la BCE. Invalidation : si les cours bougent fort dès lundi ou mardi, la semaine ne se joue plus seulement mercredi et jeudi.')));

sections.push(section('executive-summary', 'fa-list-check', 'Synthèse exécutive',
  `<ul class="key-list"><li>L’indice tient, les petites valeurs montent : S&P ${perf('SPY', START, 1, 'spy2')}, Nasdaq ${perf('QQQ')}, Dow ${perf('DIA')}, Russell ${perf('IWM', START, 1, 'iwm2')}.</li><li>La plupart des fournisseurs de l’IA ont rebondi jusqu’à mercredi (Nvidia ${perfBetween('NVDA', START, D21, 1, 'up')}, Dell ${perfBetween('DELL', START, D21, 1, 'up')}), puis ont tous baissé le ${thu22('es_d22')} : AMD ${perfBetween('AMD', D21, D22, 1, 'thu')}, Marvell ${perfBetween('MRVL', D21, D22, 1, 'thu')}, Lam Research ${perfBetween('LRCX', D21, D22, 1, 'thu')}.</li><li>Sur la semaine, Meta fait ${perf('META', START, 1, 'meta2')}, Alphabet ${perf('GOOG')}, Microsoft ${perf('MSFT')}.</li><li>Fonds adossés à l’or ${perf('GLD', START, 1, 'gld2')} et à l’argent ${perf('SLV')} ; pétrole ${perf('USO', START, 1, 'uso2')}, dont ${perfBetween('USO', D22, REF, 1, 'fri')} vendredi ; obligations longues ${perf('TLT')}.</li><li>Notre moteur de régime reste en reprise, à ${sysScore('score_a')} ${lit('sur cent')}, un score en baisse depuis notre hebdo du ${lit('5 octobre')}. Le S&P (${sysN('index_price', 2, '', 'spx_a')}) est sous sa moyenne des ${lit('cinquante dernières séances')} (${sysN('sma50', 2, '', 'sma50_a')}). Le VIX finit à ${vixClose('vix_a')}, au-dessus de sa moyenne des ${lit('quatorze dernières séances')} (${vixAvg('vix_avg_a')}).</li></ul>`
  + `<div class="pedagogy-box"><h4>Ce que Meta a annoncé</h4><p>Meta n’a pas relevé le plafond de ses investissements de l’année : elle a resserré sa fourchette en relevant le bas, désormais de ${reg('/facts/meta/capex_2026_low_bn', 'sec_meta_ex991', 'meta_capex_lo')} à ${reg('/facts/meta/capex_2026_high_bn', 'sec_meta_ex991', 'meta_capex_hi', 0, ' Md$')}, contre un plancher de ${reg('/facts/meta/capex_2026_prior_low_bn', 'sec_meta_ex991', 'meta_capex_prev', 0, ' Md$')}. L’argent qui lui reste après ses investissements, le flux de trésorerie disponible, tombe sur le trimestre à ${reg('/facts/meta/free_cash_flow_m/1/1', 'sec_meta_ex991', 'meta_fcf', 0, ' M$')}. S’y ajoutent une charge juridique de ${reg('/facts/meta/legal_charge_bn', 'sec_meta_ex991', 'meta_legal', 2, ' Md$')}, qui ramène le bénéfice par action à ${reg('/facts/meta/eps_diluted', 'sec_meta_ex991', 'meta_eps', 2, ' $')} contre ${reg('/facts/meta/eps_ex_charge', 'sec_meta_ex991', 'meta_eps_ex', 2, ' $')} hors charge, aucun rachat d’actions depuis janvier (${reg2('/facts/meta/buybacks_9m_m/0/1', 'sec_meta_ex991', 'meta_bb_prev', md)} un an plus tôt sur la même période) et une dette à long terme passée de ${reg2('/facts/meta/long_term_debt_m/0/1', 'sec_meta_ex991', 'meta_debt0', md)} à ${reg2('/facts/meta/long_term_debt_m/1/1', 'sec_meta_ex991', 'meta_debt1', md)} depuis décembre.</p><p>Le titre a fait ${metaMove('meta_react')} entre la veille et le lendemain, moins que sa réaction habituelle (${median('META')} en médiane sur ses ${reactEvents('META')} dernières publications, celle-ci comprise). Le même soir, le ${metaDay('meta_day')}, Lam Research a publié et, selon des notes d’analystes citées par CNBC, Tesla a ramené son budget d’investissement de l’année à ${tesla('tsla')}. Le lendemain, toute la chaîne de l’IA a baissé, avec l’or et le bitcoin. La semaine ne dit donc pas comment la Bourse traite une hausse franche des dépenses : Microsoft et Alphabet le diront mercredi.</p></div>`));

sections.push(section('bilan', 'fa-clock-rotate-left', 'Bilan de la semaine écoulée',
  `<p>Le dernier hebdo, celui du ${lit('5 octobre')}, ne publiait aucun trade et gardait des liquidités jusqu’au compte rendu de la Fed. Depuis sa base, la clôture du ${barDate('SPY', D02, 'weekday_day_month', 'b_d02')}, le Nasdaq fait ${perfBetween('QQQ', D02, REF, 1, 'since')} et la technologie ${perfBetween('XLK', D02, REF, 1, 'since')}.</p>`
  + `<p>L’essentiel de la vente de la chaîne de l’IA a eu lieu entre nos hebdos, du ${day(D09, 'b_d09')} au ${day(START, 'b_d16')} : Dell ${perfBetween('DELL', D09, START, 1, 'w1')}, Applied Materials ${perfBetween('AMAT', D09, START, 1, 'w1')}, Arista ${perfBetween('ANET', D09, START, 1, 'w1')}. Cette semaine, la plupart des noms ont d’abord rebondi, puis ont tout rendu jeudi. Lam Research publiait ses propres comptes le même soir que Meta : sa baisse de la semaine (${perf('LRCX', START, 1, 'lam_w')}) tient d’abord à sa réaction à ses résultats (${lamMove} entre la veille et le lendemain).</p>`
  + `<p>Sur la semaine, le S&P fait ${perf('SPY', START, 1, 'spy3')} et le Russell ${perf('IWM', START, 1, 'iwm3')}. Vendredi, les défensives reculent (consommation de base ${perfBetween('XLP', D22, REF, 1, 'fri')}, santé ${perfBetween('XLV', D22, REF, 1, 'fri')}) et les puces rebondissent (Micron ${perfBetween('MU', D22, REF, 1, 'fri')}, Marvell ${perfBetween('MRVL', D22, REF, 1, 'fri')}).</p>`
  + chart('crossAssetChart', 'Semaine écoulée, variation en %', 'L’indice est plat, les petites valeurs montent, les métaux précieux baissent, le pétrole monte. Invalidation : un rattrapage simultané du Nasdaq et de l’or dès lundi.')));

sections.push(section('macro', 'fa-landmark', 'Macro et taux',
  `<p>La Fed décide mercredi. Sa fourchette est de ${registryClaim('/facts/fed/target_low_pct', { scale: 1, decimals: 2, suffix: ' %', format: 'fr' }, 'fed_low', 'fomc_statement_20260916')} à ${registryClaim('/facts/fed/target_high_pct', { scale: 1, decimals: 0, suffix: ' %', format: 'fr' }, 'fed_high', 'fomc_statement_20260916')} depuis le ${regDate('/facts/fed/last_decision_date', 'fomc_statement_20260916', 'fed_last', 'day_month')}. Jeudi tombent l’inflation PCE, l’indice que la Fed suit en priorité, et le PIB : la Fed parle la veille sans les avoir vus. Le taux de dépôt de la BCE est de ${registryClaim('/facts/ecb/deposit_rate_pct', { scale: 1, decimals: 1, suffix: ' %', format: 'fr' }, 'ecb_rate', 'ecb_rates')} ; elle décide jeudi. Le rapport sur l’emploi américain sort le ${regDate('/facts/jobs/next_release_date', 'bls_empsit', 'jobs_date')} et l’indice des prix à la consommation le ${regDate('/facts/cpi/next_release_date', 'bls_cpi', 'cpi_date')}, hors de cette semaine.</p>`
  + `<p>Sur Polymarket, un site de paris sur l’actualité, les parieurs donnent ${pm(pmFed, 'pm_fed')} de chances à des taux inchangés mercredi et ${pm(pmHike, 'pm_hike')} à une hausse. Ce qui peut bouger les prix, c’est ce que la Fed dira de la suite.</p>`
  + `<p>Nous suivons l’humeur du marché avec un moteur de régime et un modèle d’états. Le moteur combine le S&P, le dollar, le crédit, les obligations, le VIX et la liquidité : il classe le marché en reprise, à ${sysScore('score_b')} ${lit('sur cent')}, avec le crédit comme composante la plus faible (${claim('sys', '/credit_score', SYS.credit_score, { scale: 100, decimals: 0, format: 'fr' }, 'credit_b')} ${lit('sur cent')}). Le modèle d’états range le marché parmi l’appétit pour le risque (« risk-on »), le neutre, le début de prudence (« risk-off ») et la crise, c’est-à-dire une baisse brutale et générale. Aujourd’hui, il voit un marché neutre (confiance ${pct('regime', `${outerPtr}/current_state_confidence`, R.current_state_confidence, 1, 'state_conf')}). À une semaine, il donne ${pct('regime', `${outerPtr}/transition_5d/risk_on`, R.transition_5d.risk_on, 1, 'tr_on')} à l’appétit pour le risque, ${pct('regime', `${outerPtr}/transition_5d/neutral`, R.transition_5d.neutral, 1, 'tr_neu')} au neutre, ${pct('regime', `${outerPtr}/transition_5d/early_risk_off`, R.transition_5d.early_risk_off, 1, 'tr_ero')} au début de prudence et ${pct('regime', `${outerPtr}/transition_5d/crisis`, R.transition_5d.crisis, 1, 'tr_cr')} à la crise, contre ${pct('regime', `${outerPtr}/probabilities/early_risk_off`, R.probabilities.early_risk_off, 1, 'now_ero')} au début de prudence et ${pct('regime', `${outerPtr}/probabilities/crisis`, R.probabilities.crisis, 0, 'now_cr')} à la crise aujourd’hui. Sur ${n('regime', `${outerPtr}/horizon_days`, R.horizon_days, 0, '', 'horizon')} jours, il attend ${n('regime', `${outerPtr}/expected_return_spy_pct`, R.expected_return_spy_pct, 2, ' %', 'exp_ret', true)} pour le S&P, avec un creux possible de ${n('regime', `${outerPtr}/expected_drawdown_pct`, R.expected_drawdown_pct, 2, ' %', 'exp_dd')} en route.</p>`
  + `<p>Le VIX finit vendredi à ${vixClose('vix_b')}. La volatilité implicite, ce que coûtent les options pour se protéger, monte avec l’échéance : ${termClose('9D', 'v9')} à ${lit('neuf jours')}, ${termClose('30D', 'v30')} à ${lit('trente jours')}, ${termClose('3M', 'v3m')} à ${lit('trois mois')}. Pas de peur concentrée sur la semaine, mais un niveau au-dessus de la moyenne récente.</p>`
  + `<div class="pedagogy-box"><h4>Pourquoi la Fed passe avant Microsoft</h4><p>À ${paris(fomc, 'p_fomc')}, heure de Paris, la Fed fixe le coût de l’argent. Une valeur dont les profits sont loin dans le temps, comme une entreprise qui investit lourdement dans l’IA, vaut moins quand ce coût monte. Microsoft et Alphabet publient ensuite, sur un prix qui aura déjà bougé.</p></div>`
  + chart('volChart', 'Volatilité implicite par échéance, clôture de vendredi', 'La courbe monte : la protection coûte plus cher à long terme qu’à très court terme. Invalidation : le court terme dépasse le long terme, signe d’une peur concentrée sur la semaine.')));

sections.push(section('metaux', 'fa-coins', 'Métaux et matières premières',
  `<p>Le fonds GLD, adossé à l’or, fait ${perf('GLD', START, 1, 'gld3')} sur la semaine et clôture à ${close('GLD')}. Le fonds SLV, adossé à l’argent, fait ${perf('SLV', START, 1, 'slv2')} (clôture ${close('SLV')}). Le pétrole, via le fonds USO, prend ${perf('USO', START, 1, 'uso3')}. Les obligations longues montent (${perf('TLT', START, 1, 'tlt2')}), donc les taux longs reculent : la baisse de l’or ne vient pas des taux cette semaine. Le ${thu22('m_d22')}, l’or a baissé (${perfBetween('GLD', D21, D22, 1, 'thu')}) le même jour que le bitcoin et le Nasdaq.</p>`
  + `<div class="pedagogy-box"><h4>Ce qui ferait bouger l’or mercredi</h4><p>Une Fed qui laisse entendre des taux élevés plus longtemps pèse sur l’or, qui ne rapporte pas d’intérêts. Une Fed plus prudente le soutient. La baisse de la semaine écoulée s’est faite avant la décision : elle ne la juge pas.</p></div>`
  + chart('metalsChart', 'Or, argent, pétrole, obligations longues', 'L’or et l’argent baissent, le pétrole et les obligations montent. Invalidation : or et obligations longues qui baissent ensemble après la Fed, signe que la hausse des taux longs reprend la main.')));

sections.push(section('crypto', 'fa-bitcoin-sign', 'Crypto',
  `<p>Bitcoin, via son fonds coté IBIT, fait ${perf('IBIT')} sur la semaine ; Ethereum fait ${perf('ETHA')}, Solana ${perf('SOLZ')}. Sur ${lit('21 séances')}, Bitcoin fait ${perfBack('IBIT', 21)}.</p>`
  + `<div class="pedagogy-box"><h4>La crypto suit l’humeur sur la tech</h4><p>Le ${thu22('c_d22')}, le fonds bitcoin a fait ${perfBetween('IBIT', D21, D22, 1, 'thu')}, le même jour que le Nasdaq (${perfBetween('QQQ', D21, D22, 1, 'thu')}). Ces véhicules réagissent au coût de l’argent et à l’appétit pour le risque : mercredi soir et jeudi les concernent autant que les actions.</p></div>`
  + chart('cryptoChart', 'Véhicules crypto, semaine écoulée', 'Les véhicules crypto finissent la semaine presque à plat. Invalidation : un rebond de la crypto jeudi pendant que le Nasdaq baisse, qui la détacherait de la tech.')));

const earnRows = [
  ['MSFT', regDate('/facts/earnings/msft', 'msft_ir', 'tbl_msft'), 'après la clôture'],
  ['GOOG', regDate('/facts/earnings/googl', 'googl_ir', 'tbl_googl'), 'après la clôture'],
  ['AMZN', regDate('/facts/earnings/amzn', 'amzn_ir', 'tbl_amzn'), 'après la clôture'],
  ['KO', dt('systemic', `${ko.ptr}/report_date`, ko.node.report_date, 'weekday_day_month', 'tbl_ko'), 'avant l’ouverture']
].map(([s, date, when]) => [labels[s], date, when, median(s), beatCount(s), perf(s, START, 1, 'tbl')]);
sections.push(section('earnings', 'fa-building', 'Résultats : Microsoft et Alphabet mercredi soir',
  `<p>Lundi soir, Cadence, éditeur des logiciels de conception de puces (capitalisation ${cap(cds, 'cds_cap')}), et Celestica, assembleur de serveurs et d’équipements réseau (${cap(cls, 'cls_cap')}), donnent une première lecture de l’IA. Mardi, Coca-Cola (${n('systemic', `${ko.ptr}/market_cap_b`, ko.node.market_cap_b, 0, ' Md$', 'ko_cap')}) publie avant l’ouverture. Notre calendrier filtré s’arrête au ${calEnd('cal_end_earn')} ; les publications qui comptent pour l’indice viennent après, dates lues sur les pages investisseurs.</p>`
  + `<p>Lors de ses ${reactEvents('MSFT')} dernières publications, Microsoft a bougé en général de ${median('MSFT')} entre la veille et le lendemain, à la hausse comme à la baisse : c’est la médiane. Il a baissé ${n('fund', `${msftReact.ptr}/summary/down_count`, msftReact.node.summary.down_count, 0, '', 'msft_down')} fois, et ses dernières réactions sont ${msftMoveOn('2025-10-29', 'm1')} après les comptes du ${msftDateOn('2025-10-29', 'full', 'm1d')}, ${msftMoveOn('2026-01-28', 'm2')} le ${msftDateOn('2026-01-28', 'day_month', 'm2d')}, ${msftMoveOn('2026-04-29', 'm3')} le ${msftDateOn('2026-04-29', 'day_month', 'm3d')}, puis ${msftMoveOn('2026-07-29', 'm4')} le ${msftDateOn('2026-07-29', 'day_month', 'm4d')}, alors qu’il battait le consensus à chaque trimestre. Sur ${lit('21 séances')}, il fait ${perfBack('MSFT', 21, 1, 'msft21')} : il arrive en hausse, donc avec plus à perdre que ses voisins.</p>`
  + `<p>Alphabet arrive affaibli. Au dernier trimestre, son bénéfice par action (${n('fund', `${googQ.ptr}/quarters/0/eps_actual`, googQ.node.quarters[0].eps_actual, 2, ' $', 'goog_eps')}) est passé sous le consensus, la prévision moyenne des analystes (${n('fund', `${googQ.ptr}/quarters/0/eps_estimate`, googQ.node.quarters[0].eps_estimate, 2, ' $', 'goog_est')}). Son RSI, un indicateur de la vitesse des dernières hausses et baisses, est à ${rsi('GOOG')} : le titre approche de la survente, une baisse rapide et prolongée. Il clôture à ${close('GOOG')}, sous sa moyenne mobile exponentielle des ${lit('deux cents dernières séances')} (${ema200('GOOG')}), repère de la tendance de fond. Survendu ne veut pas dire bon marché ; avant des comptes, ce n’est pas un signal d’achat. Microsoft (RSI ${rsi('MSFT')}, zone neutre) finit à ${close('MSFT')}, au-dessus de la sienne (${ema200('MSFT')}).</p>`
  + table(['Société', 'Date', 'Moment', 'Réaction médiane passée', 'Trimestres au-dessus du consensus', 'Semaine écoulée'], earnRows)
  + chart('earningsChart', 'Réaction médiane passée, à la hausse comme à la baisse', 'Plus la barre est haute, plus le titre bouge en général entre la veille et le lendemain de ses comptes. Ce n’est pas une prévision de sens. Invalidation : un écart très au-delà de la médiane, de mardi soir à jeudi soir pour Microsoft et Alphabet, de mercredi soir à vendredi soir pour Amazon.')));

sections.push(section('geopolitics', 'fa-globe', 'Géopolitique',
  `<p>Le fonds pétrole USO prend ${perf('USO', START, 1, 'uso4')} sur la semaine, dont ${perfBetween('USO', D22, REF, 1, 'fri2')} vendredi, sans cause établie dans nos sources pour cette séance. Notre daily du ${lit('22 octobre')} rapportait l’annonce, non confirmée, par la télévision iranienne de pétroliers touchés près d’Ormuz. Le trafic y était très faible le ${regDate('/facts/hormuz/portwatch_day', 'press_portwatch', 'hz_date', 'day_month')} : ${reg('/facts/hormuz/portwatch_transits_day', 'press_portwatch', 'hz_day')} passages, contre ${reg('/facts/hormuz/portwatch_oct2025_daily_avg', 'press_portwatch', 'hz_avg', 1)} par jour en moyenne un an plus tôt, selon PortWatch. Lundi matin, hors clôture de référence, le pétrole recule selon CNBC, entre la menace de nouvelles attaques contre des installations saoudiennes et la crainte que des prix élevés freinent la demande.</p>`
  + `<p>Sur Polymarket, le maintien du cessez-le-feu entre les États-Unis et l’Iran jusqu’au ${lit('31 octobre')} est coté ${pm(pmIran, 'pm_iran')}, sur un marché peu profond : ${n('regime', `${pmIran.ptr}/liquidity`, pmIran.node.liquidity, 0, ' $', 'pm_iran_liq')} disponibles à l’achat et à la vente, pour ${claim('regime', `${pmIran.ptr}/volume`, pmIran.node.volume, { scale: 1e-6, decimals: 1, suffix: ' M$', format: 'fr' }, 'pm_iran_vol')} échangés au total. Une rupture reste possible ; elle passerait par le pétrole, donc par l’inflation que la Fed regarde.</p>`
  + `<p>Les élections de mi-mandat américaines ont lieu le ${regDate('/facts/election/date', 'usagov_midterms', 'election_date')}. Polymarket donne ${pct('regime', `${pmHouse.ptr}/yes_price`, pmHouse.node.yes_price, 0, 'pm_house')} aux démocrates pour le contrôle de la Chambre : un résultat déjà largement attendu.</p>`));

const sectorOrder = sectorList.slice().sort((a, b) => perfValue(a) - perfValue(b));
if (sectorOrder[0] !== 'XLC' || sectorOrder[1] !== 'XLI' || sectorOrder[9] !== 'XLV') throw new Error(`ordre sectoriel inattendu ${sectorOrder}`);
sections.push(section('rotation', 'fa-arrows-rotate', 'Rotation sectorielle',
  `<p>Parmi les secteurs suivis, la santé mène à ${perf('XLV', START, 1, 'xlv2')}, devant l’immobilier (${perf('XLRE')}) et les services collectifs (${perf('XLU')}). En bas, la communication à ${perf('XLC', START, 1, 'xlc4')} et l’industrie à ${perf('XLI')}. La technologie finit presque à plat (${perf('XLK')}), mieux que Microsoft (${perf('MSFT', START, 1, 'msft_r')}) et Nvidia (${perf('NVDA', START, 1, 'nvda_r')}).</p>`
  + `<div class="pedagogy-box"><h4>Pas une fuite vers la défense</h4><p>Avec le Russell à ${perf('IWM', START, 1, 'iwm4')} et la plupart des secteurs en hausse, la semaine ressemble à une sortie des grandes valeurs de l’IA plutôt qu’à une fuite vers la défense. La préférence pour les défensives se lit plus loin : depuis le ${day(D02, 'r_d02')}, la consommation de base fait ${perfBetween('XLP', D02, REF, 1, 'since')}, la santé ${perfBetween('XLV', D02, REF, 1, 'since')}, la technologie ${perfBetween('XLK', D02, REF, 1, 'since2')}.</p></div>`
  + chart('sectorChart', 'Secteurs suivis, du plus faible au plus fort', 'La communication et l’industrie en bas, la santé en haut. Invalidation : communication et technologie qui repassent en tête jeudi après Microsoft et Alphabet.')));

sections.push(section('risks', 'fa-shield-halved', 'Matrice des risques',
  table(['Risque', 'Signal actuel', 'Conséquence', 'Invalidation'], [
    ['Dépenses d’IA mal reçues', `Le ${thu22('r_d22')}, toute la chaîne baisse, AMD ${perfBetween('AMD', D21, D22, 1, 'thu2')}`, 'Fournisseurs de puces et d’infrastructure à nouveau vendus', 'Microsoft et Alphabet au-dessus de leur clôture de mercredi, jeudi soir'],
    ['Fed qui laisse entendre des taux élevés plus longtemps', `${stamp(fomc, 'date')} à ${paris(fomc, 'r_fomc')}`, 'Pression sur la tech, l’or et la crypto le même soir', 'Taux longs en baisse jeudi'],
    ['Inflation PCE au-dessus', `${stamp(pce, 'date')} à ${paris(pce, 'r_pce')}`, 'La décision de la veille paraît trop souple', 'Chiffre conforme, sans réaction des obligations'],
    ['Pétrole et Ormuz', `Fonds pétrole ${perfBetween('USO', D22, REF, 1, 'fri3')} vendredi ; ${reg('/facts/hormuz/portwatch_transits_day', 'press_portwatch', 'hz_day2')} passages à Ormuz le ${regDate('/facts/hormuz/portwatch_day', 'press_portwatch', 'hz_date2', 'day_month')}`, 'Inflation plus haute, Fed plus dure, pression sur toute la cote', 'Pétrole en net repli avant mercredi'],
    ['Volatilité qui monte', `VIX ${vixClose('vix_r')} contre ${vixAvg('vix_avg_r')} en moyenne`, 'Écarts plus larges sur toutes les lignes', 'Retour sous sa moyenne récente'],
    ['Chaîne de l’IA déjà basse', `Lam Research ${perfBack('LRCX', 21, 1, 'lrcx_r')} sur ${lit('21 séances')}`, 'Un rebond brutal si les clients confirment leurs dépenses', 'Nouvelle baisse après des comptes rassurants']
  ])));

sections.push(section('allocation', 'fa-chart-pie', 'Allocation tactique',
  `<div class="allocation-grid">${card(`<h3>Liquidités</h3><p>Ne pas investir l’argent disponible avant jeudi, ${nyClose('al_close')}. Ce n’est ni une consigne de vente, ni l’arrêt d’un versement programmé. Le modèle ne prévoit pas de baisse sur ${n('regime', `${outerPtr}/horizon_days`, R.horizon_days, 0, '', 'horizon2')} jours : il attend ${n('regime', `${outerPtr}/expected_return_spy_pct`, R.expected_return_spy_pct, 2, ' %', 'exp_ret2', true)}, avec un creux possible de ${n('regime', `${outerPtr}/expected_drawdown_pct`, R.expected_drawdown_pct, 2, ' %', 'exp_dd2')} en route. L’attente tient aux réponses de mercredi et jeudi, qui peuvent faire bouger les cours dans un sens comme dans l’autre.</p>`)}${card(`<h3>Actions</h3><p>Garder les défensives déjà en portefeuille sans en ajouter. Ne pas renforcer la tech avant la clôture de jeudi ; ne pas la vendre sur la seule baisse de la semaine. La consigne vaut aussi pour un achat ponctuel d’ETF S&P ou Nasdaq dans un PEA ; un versement programmé, lui, suit son cours.</p>`)}${card(`<h3>Or et pétrole</h3><p>Pas de changement. GLD, SLV, USO ou IBIT sont des fonds américains, souvent inaccessibles à un particulier français : ici des thermomètres, pas des produits à acheter.</p>`)}</div>`
  + `<div class="pedagogy-box"><h4>Euro et dollar</h4><p>La Fed mercredi et la BCE jeudi font bouger l’euro face au dollar, donc la valeur en euros des actions américaines, même quand leur cours ne change pas.</p></div>`
  + chart('regimeChart', 'Composantes du moteur de régime', 'Le dollar et le S&P portent le score, le crédit est la composante la plus faible. Invalidation : sortie du régime de reprise, ou crédit qui se dégrade encore.')));

sections.push(section('trades', 'fa-scale-balanced', 'Trades de la semaine',
  `<h3>Bilan de la consigne précédente</h3><p>L’hebdo du ${lit('5 octobre')} ne publiait aucun ordre. Il n’y a pas de gain ou de perte de trade à comptabiliser.</p>`
  + `<div class="alert-box" data-status="no_setup"><strong>Pas de configuration exploitable avant jeudi soir.</strong> La réaction se lit de la clôture de mercredi, prise après la Fed, à celle de jeudi, ${nyClose('t_close')} à Paris. Nos médianes passées couvrent la veille et le lendemain de chaque publication : pour Microsoft, de mardi soir à jeudi soir. Les clôtures de vendredi dernier (Microsoft ${close('MSFT')}, Alphabet ${close('GOOG')}, Amazon ${close('AMZN')}, Nvidia ${close('NVDA')}) sont des repères, pas des prix d’entrée.</div>`));

sections.push(section('themes', 'fa-diagram-project', 'Qui dépend des dépenses de Microsoft et d’Alphabet',
  `<p>Leurs dépenses sont les ventes des fournisseurs : puces, mémoire, machines, réseau, électricité. En principe, des dépenses relevées soutiennent ces titres. Le soir du ${metaDay('t_meta_day')}, Meta a seulement resserré sa fourchette ; le lendemain, toute la chaîne a baissé. Une hausse franche des budgets de Microsoft et d’Alphabet serait donc un signal nouveau. Une autre inquiétude court en parallèle : selon CNBC (articles des ${lit('24 et 26 octobre')}, hors clôture de référence), les « neoclouds », ces loueurs de puces d’IA financés par la dette, chutent en Bourse, et le rôle de Nvidia comme financier du secteur est mis en question. Les comptes de mercredi ne trancheront pas ce point.</p>`
  + table(['Titre', 'Lien avec les dépenses d’IA', 'Semaine', `Le ${thu22('tbl_d22')}`, lit('21 séances')], chain.map(([s, role]) => [labels[s], role, perf(s, START, 1, 'ch'), perfBetween(s, D21, D22, 1, 'chj'), perfBack(s, 21, 1, 'chm')]))
  + `<div class="pedagogy-box"><h4>Ce que la chaîne a déjà fait</h4><p>La grosse baisse date de la semaine précédente. Cette semaine, la plupart des noms ont monté jusqu’à mercredi, puis ont tout rendu jeudi. Sur la semaine, TSMC (${perf('TSM', START, 1, 'tsm2')}) et Dell (${perf('DELL', START, 1, 'dell2')}) finissent en hausse : la vente n’a pas été uniforme.</p></div>`
  + chart('blastChart', `Fournisseurs de l’IA : sur ${lit('21 séances')}`, 'Presque toute la chaîne est rouge sur un mois. Invalidation : reprise groupée jeudi, qui effacerait la baisse si les clients confirment.')
  + chart('focusChart', 'Microsoft, Alphabet, Amazon, Meta, Nvidia, base commune', 'Meta et Alphabet décrochent, Microsoft recule moins. Invalidation : si ces lignes repartent ensemble jeudi, le marché aura acheté la dépense plutôt qu’un nom.')));

sections.push(section('outlook', 'fa-binoculars', 'Perspectives',
  `<div class="scenario-grid">${card(`<h3>Scénario central</h3><p>La Fed ne surprend pas ; Microsoft et Alphabet confirment leurs dépenses avec une croissance du cloud (Azure, Google Cloud) qui les justifie. Action : si Microsoft et Alphabet finissent jeudi au-dessus de leur clôture de mercredi, une première ligne réduite redevient possible vendredi, après l’ouverture de New York à ${nyOpen('o_open1')}, et non vendredi matin sur les places européennes, qui refléteront la nuit d’Amazon. Elle porte sur un ETF Nasdaq, pas sur des titres choisis un à un. Sinon, on reste en liquidités.</p>`)}${card(`<h3>Scénario haussier</h3><p>La croissance du cloud accélère chez Microsoft et Alphabet. Le signal : jeudi à ${nyClose('o_close1')}, Microsoft, Lam Research, Vertiv et Micron finissent au-dessus de leur clôture de mercredi. Action : le même geste, vendredi après ${nyOpen('o_open2')}, sans courir après le saut de la nuit d’Amazon.</p>`)}${card(`<h3>Scénario baissier</h3><p>Une Fed qui laisse entendre des taux élevés plus longtemps, puis des dépenses relevées sans croissance du cloud à la hauteur. Le signal : Microsoft finit jeudi sous sa clôture de mercredi, avec les fournisseurs. Action : ne pas acheter la baisse, garder les liquidités jusqu’à Apple, le ${regDate('/facts/earnings/aapl', 'aapl_ir', 'o_aapl', 'day_month')}, et l’élection du lendemain.</p>`)}</div>`
  + `<p><strong>Cas mixte.</strong> Microsoft en hausse, mais Lam Research et Vertiv en baisse : la dépense ralentit. Si Alphabet finit aussi en hausse, la ligne réduite reste possible ; sinon, on attend.</p><p><strong>Sortie, quel que soit le scénario.</strong> Une ligne ouverte vendredi se coupe si Microsoft finit une séance sous sa clôture de mercredi, ce qui se juge à la clôture de New York, jamais en cours de séance. Attention : New York passe à l’heure d’hiver le dimanche ${lit('1er novembre')}, la clôture tombe alors une heure plus tard, heure de Paris. Ces gestes relèvent de l’allocation : aucun niveau d’entrée n’est publié, la section des trades reste sans configuration.</p><p>Le modèle d’états ne chiffre pas ces scénarios. À une semaine, il donne ${pct('regime', `${outerPtr}/transition_5d/risk_on`, R.transition_5d.risk_on, 1, 'tr_on2')} à l’appétit pour le risque, ${pct('regime', `${outerPtr}/transition_5d/early_risk_off`, R.transition_5d.early_risk_off, 1, 'tr_ero2')} au début de prudence et ${pct('regime', `${outerPtr}/transition_5d/crisis`, R.transition_5d.crisis, 1, 'tr_cr2')} à la crise : les issues de repli, réunies, pèsent presque autant que l’appétit pour le risque. Rien qui pousse à vendre, rien qui pousse à acheter avant jeudi soir.</p>`
  + `<div class="pedagogy-box"><h4>Ce qu’il faut surveiller</h4><p>Lundi soir, Cadence et Celestica. Mercredi à ${paris(fomc, 's_fomc')}, la Fed, et la réaction de l’or et des obligations ; après la clôture, Microsoft et Alphabet. Jeudi à ${paris(pce, 's_pce')}, l’inflation PCE ; à ${nyClose('s_close')}, la clôture de Microsoft, d’Alphabet et de Lam Research, puis Amazon. Vendredi, la Banque du Japon et l’inflation de la zone euro, puis l’ouverture de New York à ${nyOpen('s_open')} : seul moment pour une ligne réduite, si la clôture de jeudi l’autorise.</p></div>`));

const links = [
  ['msft_ir', 'Microsoft, relations investisseurs'], ['googl_ir', 'Alphabet, relations investisseurs'], ['amzn_ir', 'Amazon, relations investisseurs'], ['aapl_ir', 'Apple, relations investisseurs'],
  ['fomc_calendar', 'Réserve fédérale, calendrier des réunions'], ['fomc_statement_20260916', 'Réserve fédérale, communiqué de septembre'], ['ecb_rates', 'BCE, taux directeurs'],
  ['boj_calendar', 'Banque du Japon, calendrier des réunions'], ['bls_empsit', 'Bureau of Labor Statistics, emploi'], ['bls_cpi', 'Bureau of Labor Statistics, prix à la consommation'],
  ['sec_meta_ex991', 'Meta, communiqué de résultats déposé à la SEC'], ['sec_lrcx_ex991', 'Lam Research, communiqué de résultats déposé à la SEC'],
  ['usagov_midterms', 'USA.gov, élections de mi-mandat'], ['press_cnbc_tesla', 'CNBC, notes d’analystes sur Tesla'], ['press_portwatch', 'FMI PortWatch, passages dans le détroit d’Ormuz']
].map(([k, label]) => { const u = primary.sources[k] && primary.sources[k].url; if (!u) throw new Error(`lien absent ${k}`); return `<li><a href="${u}" rel="noopener" target="_blank">${label}</a></li>`; });
links.push('<li><a href="https://www.cnbc.com/2026/10/26/oil-prices-today-wti-brent.html" rel="noopener" target="_blank">CNBC, pétrole lundi matin</a></li>',
  '<li><a href="https://www.cnbc.com/2026/10/24/nvidias-role-as-ai-financier-faces-first-big-test-as-neoclouds-take-market-hit.html" rel="noopener" target="_blank">CNBC, Nvidia et les neoclouds</a></li>',
  '<li><a href="https://www.cnbc.com/2026/10/26/neocloud-stocks-today-coreweave-nebius-iren-elon-musk.html" rel="noopener" target="_blank">CNBC, chute des neoclouds</a></li>');
sections.push(section('sources', 'fa-database', 'Sources et qualité',
  table(['Bloc', 'Statut', 'Limite'], [
    ['Prix et secteurs', badge('VALIDÉ', 'green'), 'Clôture US du ' + barDate('SPY', REF, 'full', 'refdate2') + ' ; énergie absente des secteurs suivis'],
    ['Crypto', badge('VALIDÉ', 'green'), 'Dernière clôture complétée du véhicule coté'],
    ['Agenda macro', badge('VALIDÉ', 'green'), 'Calendrier collecté ; Banque du Japon et emploi lus sur les sites officiels'],
    ['Dates de Microsoft, Alphabet, Amazon', badge('VALIDÉ', 'green'), `Relations investisseurs, lues le ${registryClaim('/sources/msft_ir/fetched_at', { format: 'fr_date', parts: 'day_month' }, 'ir_read2', 'msft_ir')}`],
    ['Calendrier des autres résultats', badge('PARTIEL', 'yellow'), `Couvre jusqu’au ${calEnd('cal_end_src')} seulement`],
    ['Amplitude prévue par les options', badge('INDISPONIBLE', 'yellow'), 'Remplacée par la réaction passée'],
    ['Options inhabituelles sur Microsoft, Alphabet, Amazon', badge('INDISPONIBLE', 'yellow'), 'Source hors délai à chaque tentative ; aucune conclusion de la page n’en dépend'],
    ['Alphabet', badge('VALIDÉ', 'green'), 'Suivi sous GOOG, actions de classe C']
  ])
  + `<div class="source-links"><h3>Sources officielles et presse</h3><ul>${links.join('')}</ul><h3>Méthode</h3><p>Chaque variation de semaine part de la clôture du ${barDate('SPY', START, 'full', 'start2')} et finit à la clôture du ${barDate('SPY', REF, 'full', 'refdate3')}. La fenêtre de ${lit('21 séances')} est un décompte de barres, pas un mois civil. La réaction aux résultats compare la clôture de la veille de chaque publication à celle du lendemain ; la date vient du dépôt de résultats de la société à la SEC. Le VIX et les échéances de volatilité sont les clôtures de vendredi. Les graphiques reprennent ces mêmes séries. Information générale, pas un conseil en investissement.</p></div>`));

if (sections.length !== 18) throw new Error(`sections: ${sections.length}`);

const days = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'];
// Publications de sociétés par jour : Verizon, Cadence, Celestica ; Coca-Cola ; Microsoft, Alphabet ; Amazon ; puis la Banque du Japon vendredi.
const corp = { '2026-10-26': 3, '2026-10-27': 1, '2026-10-28': 2, '2026-10-29': 1, '2026-10-30': 1 };
const dayCounts = days.map(d => agendaCards.filter(x => x.day === d).length + corp[d]);
const barSpec = (syms, fn = perfValue) => ({
  grid: { left: 170, right: 56, top: 16, bottom: 36 },
  xAxis: { type: 'value', name: '%' },
  yAxis: { type: 'category', data: syms.map(s => labels[s]), axisLabel: { fontSize: 11 } },
  series: [{ type: 'bar', data: syms.map(s => ({ value: +fn(s).toFixed(2), itemStyle: { color: fn(s) >= 0 ? '#15803d' : '#b91c1c' } })), label: { show: true, position: 'right', formatter: '{c} %' } }]
});
const chartSpecs = [
  ['calendarChart', { grid: { left: 40, right: 16, top: 20, bottom: 36 }, xAxis: { type: 'category', data: ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.'] }, yAxis: { type: 'value', name: 'rendez-vous' }, series: [{ type: 'bar', data: dayCounts, itemStyle: { color: '#2563eb' } }] }],
  ['crossAssetChart', barSpec(['SPY', 'QQQ', 'IWM', 'DIA', 'TLT', 'GLD', 'SLV', 'USO'])],
  ['volChart', { grid: { left: 48, right: 16, top: 20, bottom: 36 }, xAxis: { type: 'category', data: term.map(x => x.node.tenor) }, yAxis: { type: 'value', scale: true }, series: [{ type: 'line', smooth: true, symbolSize: 8, data: term.map(x => x.node.prev_close), lineStyle: { width: 3, color: '#7c3aed' } }] }],
  ['metalsChart', barSpec(['GLD', 'SLV', 'USO', 'TLT'])],
  ['cryptoChart', barSpec(['IBIT', 'ETHA', 'SOLZ'])],
  ['earningsChart', { grid: { left: 90, right: 48, top: 16, bottom: 36 }, xAxis: { type: 'value', name: '%' }, yAxis: { type: 'category', data: ['MSFT', 'GOOG', 'AMZN', 'KO'].map(s => labels[s]) }, series: [{ type: 'bar', data: ['MSFT', 'GOOG', 'AMZN', 'KO'].map(s => +medianValue(s).toFixed(2)), itemStyle: { color: '#ea580c' }, label: { show: true, position: 'right', formatter: '{c} %' } }] }],
  ['sectorChart', barSpec(sectorOrder)],
  ['regimeChart', { radar: { indicator: [['credit_score', 'Crédit'], ['dxy_score', 'Dollar'], ['spx_score', 'S&P'], ['tlt_score', 'Obligations'], ['vix_score', 'VIX'], ['liquidity_score', 'Liquidité']].map(([, name]) => ({ name, max: 1 })) }, series: [{ type: 'radar', data: [{ value: ['credit_score', 'dxy_score', 'spx_score', 'tlt_score', 'vix_score', 'liquidity_score'].map(k => +Number(SYS[k]).toFixed(3)), areaStyle: { color: 'rgba(37,99,235,.2)' } }] }] }],
  ['blastChart', barSpec(chain.map(([s]) => s), s => perfBackValue(s, 21))],
  ['focusChart', { grid: { left: 48, right: 16, top: 28, bottom: 36 }, legend: { data: ['MSFT', 'GOOG', 'AMZN', 'META', 'NVDA'] }, xAxis: { type: 'time' }, yAxis: { type: 'value', name: 'base 100', scale: true }, series: ['MSFT', 'GOOG', 'AMZN', 'META', 'NVDA'].map(s => ({ name: s, type: 'line', smooth: true, symbolSize: 6, data: chartSeries(s) })) }]
].map(([id, spec]) => ({ id, spec }));

const title = 'La Fed et Microsoft le même soir';
const description = 'Jeudi dernier, au lendemain des comptes de Meta et de Lam Research, toute la chaîne de l’IA a baissé. Mercredi soir, la Fed puis Microsoft et Alphabet diront si la Bourse accepte encore leurs dépenses.';
const html = `<!doctype html><html lang="fr" dir="ltr" data-level="intermediate" data-tags="us,eu,asia,macro,earnings,tech,semis,ai,gold,crypto,etf" data-tab="weekly"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DailyTickers | ${title}</title><meta name="description" content="${description}"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:image" content="https://articles.dailytickers.com/logo.svg"><meta property="og:url" content="https://articles.dailytickers.com/weekly/20261026/"><meta property="og:type" content="article"><script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-T5Z595CW');</script><link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/assets/report.css"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&amp;display=swap" rel="stylesheet"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"><script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script></head><body class="weekly-brief"><noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-T5Z595CW" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript><nav class="brand-bar"><div class="brand-bar-inner"><a href="/" class="brand-logo"><img src="/logo.svg" alt="" width="36" height="36"><span class="brand-title">DailyTickers</span></a><div class="brand-nav"><a href="/?tab=weekly">Hebdo</a><a href="/?tab=daily">Daily</a><a href="/?tab=analyses">Analyses</a><a href="/?tab=scanner">Scanner</a><a href="/?tab=radar">Radar</a><a href="/?tab=series">S&eacute;ries</a></div><div class="brand-actions"><a href="/" class="brand-home-btn" title="Accueil"><i class="fas fa-house"></i></a></div></div></nav><main class="report-container"><header class="hero-section"><div class="report-card-meta">Semaine du ${lit('26 au 30 octobre 2026')} · données au ${barDate('SPY', REF, 'full', 'refdate_hero')}</div><h1>${title}</h1><p class="hero-subtitle">${description}</p><div id="article-clickable-tags" class="card-tags"></div></header><nav class="report-jump-nav" aria-label="Sommaire"><a href="#verdict">Verdict</a><a href="#agenda">Agenda</a><a href="#earnings">Résultats</a><a href="#rotation">Rotation</a><a href="#risks">Risques</a><a href="#outlook">Perspectives</a></nav>${sections.join('\n')}</main><div class="fnav"><a href="#verdict" title="Verdict"><i class="fas fa-flag-checkered"></i></a><a href="#agenda" title="Agenda"><i class="fas fa-calendar-week"></i></a><a href="#earnings" title="Résultats"><i class="fas fa-building"></i></a><a href="#rotation" title="Rotation"><i class="fas fa-arrows-rotate"></i></a><a href="#outlook" title="Perspectives"><i class="fas fa-binoculars"></i></a><a href="#sources" title="Sources"><i class="fas fa-database"></i></a></div><footer class="article-footer">&copy; 2026 DailyTickers. Données arrêtées à la dernière clôture. Not financial advice.<br><a href="/" title="Home"><i class="fas fa-house"></i></a></footer><script>const CHART_SPECS=${JSON.stringify(chartSpecs)};(function(){if(typeof echarts==='undefined')return;const xs=[];for(const c of CHART_SPECS){const el=document.getElementById(c.id);if(!el)continue;const x=echarts.init(el);x.setOption(Object.assign({animation:false,textStyle:{fontFamily:'Inter,system-ui,sans-serif'},tooltip:{trigger:'axis'}},c.spec));xs.push(x)}addEventListener('resize',()=>xs.forEach(x=>x.resize()))})();</script><script src="/assets/core.js"></script><script src="/assets/tag-renderer.js"></script><script src="/assets/echarts-responsive.js"></script></body></html>`;

fs.writeFileSync(path.join(DIR, 'index.html'), html);
const articleSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, 'index.html'))).digest('hex');
fs.writeFileSync(path.join(DIR, '_data/chart-data.json'), JSON.stringify({ reference_close: REF, start_close: START, chart_specs: chartSpecs }, null, 2) + '\n');
fs.writeFileSync(path.join(DIR, '_data/claims.json'), JSON.stringify({ reference_close: REF, article_path: `${REL}/index.html`, article_sha256: articleSha, generated_by: `${REL}/_build.cjs`, literals: [...literals].sort(), claims }, null, 2) + '\n');
console.log(`weekly rendu: ${sections.length} sections, ${chartSpecs.length} graphiques, ${claims.length} claims, ${(html.length / 1024).toFixed(1)} Ko`);
