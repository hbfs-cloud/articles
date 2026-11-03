#!/usr/bin/env node
'use strict';

// Édition spéciale midterms du 3 novembre 2026, avec la suite du daily du 31 octobre. Chaque
// chiffre visible dans <main> est un claim lié à un artefact collecté (harnais du jour, ou fenêtre
// historique collectée en mode covers_close) ou au registre primaire du jour ; les niveaux publiés
// le 31 octobre sont des littéraux déclarés (règles publiées, pas des mesures), et les écarts à ces
// niveaux sont recalculés ici depuis les clôtures liées.

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { renderValue } = require('../../tools/validate-content-claims');
const { renderEventTimeline } = require('../../tools/lib/event-timeline.cjs');

const ROOT = path.resolve(__dirname, '../..');
const REL = 'daily/20261103';
const DIR = path.join(ROOT, REL);
const REF = '2026-11-02';
const PREV = '2026-10-30';
const PRIMARY = `${REL}/primary-reference.json`;
const YEARS = ['2002', '2006', '2010', '2014', '2018', '2022'];
const SPLIT = { 2006: ['2006a', '2006b'], 2018: ['2018a', '2018b'] };

const sources = {
  idx: `${REL}/_data/bars_indices.json`, dia: `${REL}/_data/bars_dia.json`, sec: `${REL}/_data/bars_sectors.json`,
  reg: `${REL}/_data/regime.json`, off: `${REL}/_data/off_hours.json`, eco: `${REL}/_data/economic_events.json`,
  st: `${REL}/_data/status.json`, opt: `${REL}/_data/options_sentiment.json`, ern: `${REL}/_data/earnings_today.json`,
  dos: `${REL}/_dossier/bars_dossier.json`, ft: `${REL}/_focus/focus_technicals.json`
};
for (const y of YEARS) for (const part of (SPLIT[y] || [y])) sources[`h${part}`] = `${REL}/_history/${part}/bars_history.json`;
const D = Object.fromEntries(Object.entries(sources).map(([k, v]) => [k, JSON.parse(fs.readFileSync(path.join(ROOT, v), 'utf8'))]));
const HREF = Object.fromEntries(Object.keys(sources).filter(k => /^h\d/.test(k)).map(k => [k, JSON.parse(fs.readFileSync(path.join(DIR, '_history', k.slice(1), 'harness.json'), 'utf8')).reference_close]));
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
  if (HREF[key]) row.historical_reference_close = HREF[key];
  claims.push(row);
  return `<span data-claim="${id}">${rendered}</span>`;
}
const lit = v => { literals.add(String(v)); return `<span data-literal>${v}</span>`; };
function registry(pointer, render, stem, authority) {
  const value = pointer.slice(1).split('/').reduce((n, k) => n[k], primary);
  if (value === undefined || !primary.sources[authority]) throw new Error(`registre ${pointer}`);
  const rendered = renderValue(value, render);
  if (rendered == null) throw new Error(`rendu registre ${pointer}`);
  const id = `${stem}_${++seq}`.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  claims.push({ id, rendered_text: rendered, source_artifact: PRIMARY, source_sha256: digest(PRIMARY), source_pointer: pointer, source_value: value, render, authority });
  return `<span data-claim="${id}">${rendered}</span>`;
}
const fr = (decimals, suffix = '', sign) => ({ scale: 1, decimals, suffix, format: 'fr', ...(sign ? { sign: 'always' } : {}) });
const pct = (decimals = 1) => ({ scale: 100, decimals, suffix: ' %', format: 'fr' });
const dateR = parts => ({ format: 'fr_date', parts });
const timeR = zone => ({ format: 'fr_time', zone });
const frNum = (v, d) => renderValue(v, fr(d));
const frSigned = (v, d, suffix = ' %') => suffix === ' R' ? `${renderValue(v, fr(d, '', true))} R` : renderValue(v, fr(d, suffix, true));

// ── Barres ───────────────────────────────────────────────────────────────────
function series(key, symbol, last = REF) {
  const h = hit(key, x => x && x.symbol === symbol && Array.isArray(x.bars) && x.bars.length, `barres ${symbol}`);
  const b = h.node.bars;
  if (last && b[b.length - 1][0] !== last) throw new Error(`${symbol}@${key}: dernière barre ${b[b.length - 1][0]}`);
  return { key, ptr: h.ptr, bars: b };
}
const idxOf = (s, date) => { const i = s.bars.findIndex(x => x[0] === date); if (i < 0) throw new Error(`date ${date} absente`); return i; };
const COL = { open: 1, high: 2, low: 3, close: 4, volume: 5 };
function px(key, symbol, date = REF, col = 'close', decimals = 2, stem = 'px') {
  const s = series(key, symbol), i = idxOf(s, date), c = COL[col];
  return claim(key, `${s.ptr}/bars/${i}/${c}`, s.bars[i][c], fr(decimals, ' $'), `${stem}_${symbol}`);
}
function chg(key, symbol, from = PREV, to = REF, decimals = 1, stem = 'chg') {
  const s = series(key, symbol), i = idxOf(s, to), j = idxOf(s, from);
  const value = (s.bars[i][4] / s.bars[j][4] - 1) * 100;
  return claim(key, `${s.ptr}/bars/${i}/4`, s.bars[i][4], fr(decimals, ' %', true), `${stem}_${symbol}`,
    { operation: 'ratio_pct', numerator_pointer: `${s.ptr}/bars/${i}/4`, denominator_pointer: `${s.ptr}/bars/${j}/4`, result: value });
}
const chgValue = (key, symbol, from = PREV, to = REF) => { const s = series(key, symbol); return (s.bars[idxOf(s, to)][4] / s.bars[idxOf(s, from)][4] - 1) * 100; };
const bdate = (key, symbol, date, parts = 'day_month', stem = 'd') => { const s = series(key, symbol), i = idxOf(s, date); return claim(key, `${s.ptr}/bars/${i}/0`, s.bars[i][0], dateR(parts), `${stem}_${symbol}`); };
const dir = v => (v >= 0 ? 'up' : 'down');

// ── Contexte : prédictions, volatilité, horaires ────────────────────────────
const pmItems = D.reg.facets.prediction_markets.items;
const pm = re => { const i = pmItems.findIndex(x => x && re.test(x.question || '') && typeof x.yes_price === 'number'); if (i < 0) throw new Error(`Polymarket ${re}`); return { i, node: pmItems[i] }; };
const pmDH = pm(/^Will the Democratic Party control the House after the 2026 Midterm/), pmDS = pm(/^Will the Democratic Party control the Senate after the 2026 Midterm/);
const pmRS = pm(/^Will the Republican Party control the Senate after the 2026 Midterm/), pmRH = pm(/^Will the Republican Party control the House after the 2026 Midterm/);
const pmDD = pm(/^2026 Balance of Power: D Senate, D House/), pmRR = pm(/^2026 Balance of Power: R Senate, R House/);
const pmTX = pm(/^Will the Democrats win the Texas Senate race in 2026/), pmMI = pm(/^Will the Democrats win the Michigan Senate race in 2026/);
const pmv = (h, stem, d = 1) => claim('reg', `/facets/prediction_markets/items/${h.i}/yes_price`, h.node.yes_price, pct(d), stem);
const pmVol = (h, stem) => claim('reg', `/facets/prediction_markets/items/${h.i}/volume_24h`, h.node.volume_24h, { scale: 1e-6, decimals: 1, suffix: ' M$', format: 'fr' }, stem);
const pmAt = stem => claim('reg', '/facets/prediction_markets/generated_at', D.reg.facets.prediction_markets.generated_at, timeR('Europe/Paris'), stem);
if (!(pmDH.node.yes_price > 0.9 && pmDS.node.yes_price > 0.7 && pmDD.node.yes_price > 0.7 && pmRR.node.yes_price < 0.1)) throw new Error('cotes Polymarket inattendues');
if (Math.abs(pmDS.node.yes_price + pmRS.node.yes_price - 1) > 0.03) throw new Error('Sénat : cotes incohérentes');

const offObs = (facet, test) => { const f = D.off.facets[facet]; const i = f.observations.findIndex(test); if (i < 0) throw new Error(`hors séance ${facet}`); return { ptr: `/facets/${facet}/observations/${i}`, node: f.observations[i] }; };
const es = offObs('futures', o => o.canonical_asset === 'ES'), nq = offObs('futures', o => o.canonical_asset === 'NQ'), wti = offObs('futures', o => o.canonical_asset === 'WTI');
const fedDec = offObs('predictions', o => /increase interest rates by 25 bps after the December 2026/.test(o.metadata && o.metadata.question || ''));
const offPx = (o, d, stem, suffix = '') => claim('off', `${o.ptr}/price`, o.node.price, fr(d, suffix), stem);
const offAt = (o, stem) => claim('off', `${o.ptr}/observed_at`, o.node.observed_at, timeR('Europe/Paris'), stem);
const fedDecR = stem => claim('off', `${fedDec.ptr}/price`, fedDec.node.price, pct(1), stem);

const vixPt = sym => { const i = D.opt.items.findIndex(x => x && x.symbol === sym && x.type === 'term_structure_point'); if (i < 0) throw new Error(sym); return { i, node: D.opt.items[i] }; };
const vix9 = vixPt('^VIX9D'), vix30 = vixPt('^VIX'), vix3m = vixPt('^VIX3M');
const vixR = (h, stem) => claim('opt', `/items/${h.i}/level`, h.node.level, fr(1), stem);
if (!(vix9.node.level > vix30.node.level && String(vix30.node.last_trade_time).startsWith(REF))) throw new Error('courbe du VIX à revoir');

const econ = (name, day) => hit('eco', x => x && x.name === name && typeof x.event_time === 'string' && x.event_time.slice(0, 10) === day, name);
const ism = econ('ISM Services PMI', '2026-11-04'), claimsJ = econ('Initial Jobless Claims', '2026-11-05'), nfp = econ('Non-Farm Payrolls (Employment Situation)', '2026-11-06');
const paris = (h, stem) => claim('eco', `${h.ptr}/event_time`, h.node.event_time, timeR('Europe/Paris'), stem);
const nyCloseH = '/operation_readiness/bars_daily_us_equity/current_bar_closes_at';
if (D.st.operation_readiness.bars_daily_us_equity.current_bar_closes_at !== '2026-11-03T21:00:00Z') throw new Error('heure de clôture de New York inattendue');
const nyClose = stem => claim('st', nyCloseH, D.st.operation_readiness.bars_daily_us_equity.current_bar_closes_at, timeR('Europe/Paris'), stem);
const earn = sym => hit('ern', x => x && x.symbol === sym && Array.isArray(x.date_sources), `résultats ${sym}`);
const anet = earn('ANET');
if (anet.node.date_sources[0].report_date !== '2026-11-03') throw new Error('date Arista');
const anetDate = stem => claim('ern', `${anet.ptr}/date_sources/0/report_date`, anet.node.date_sources[0].report_date, dateR('weekday_day_month'), stem);

const reg = (ptr, render, stem, auth) => registry(ptr, render, stem, auth);
const pollP = (k, stem) => reg(`/facts/polls/${k}`, timeR('Europe/Paris'), stem, 'qz_poll_closing_20261030');
const amdCall = stem => reg('/facts/amd/call_time', timeR('Europe/Paris'), stem, 'amd_ir_20261006');
const amdDay = (stem, parts = 'weekday_day_month') => reg('/facts/amd/report_date', dateR(parts), stem, 'amd_ir_20261006');
const elec = (k, stem, auth = 'ballotpedia_congress_2026') => reg(`/facts/election/${k}`, fr(0), stem, auth);
const voteDay = (stem, parts = 'weekday_day_month') => reg('/facts/election/date', dateR(parts), stem, 'ballotpedia_congress_2026');

// ── Histoire : les midterms depuis 2002 ──────────────────────────────────────
const HS = ['SPY', 'QQQ', 'IWM', 'XLV', 'XLE', 'XLF', 'XLI', 'XLK'];
const SECT = { QQQ: 'Nasdaq-100', IWM: 'petites valeurs', XLV: 'santé', XLE: 'énergie', XLF: 'finance', XLI: 'industrie', XLK: 'technologie' };
const electionDay = y => { const d = new Date(Date.UTC(+y, 10, 1)); while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
// Série jointe par élection : [{key, ptr, i, bar}] pour savoir quel artefact porte chaque séance.
function joined(y, sym) {
  const out = [];
  for (const part of (SPLIT[y] || [y])) {
    const key = `h${part}`, s = series(key, sym, null);
    s.bars.forEach((bar, i) => out.push({ key, ptr: s.ptr, i, bar }));
  }
  for (let k = 1; k < out.length; k++) if (!(out[k].bar[0] > out[k - 1].bar[0])) throw new Error(`série ${y} ${sym} non ordonnée`);
  return out;
}
function hmove(y, sym, from, to, stem) {
  const j = joined(y, sym), day = electionDay(y), e = j.findIndex(x => x.bar[0] === day);
  if (e < 0) throw new Error(`${y}: jour du vote absent`);
  const a = j[e + from], b = j[e + to];
  if (!a || !b) throw new Error(`${y} ${sym}: fenêtre trop courte`);
  const value = (b.bar[4] / a.bar[4] - 1) * 100;
  if (a.key === b.key) {
    return { value, html: claim(b.key, `${b.ptr}/bars/${b.i}/4`, b.bar[4], fr(1, ' %', true), `${stem}_${y}_${sym}`,
      { operation: 'ratio_pct', numerator_pointer: `${b.ptr}/bars/${b.i}/4`, denominator_pointer: `${a.ptr}/bars/${a.i}/4`, result: value }) };
  }
  // Fenêtre coupée par une séance fermée (obsèques nationales) : deux artefacts, deux clôtures liées.
  return { value, split: true, html: `${lit(frSigned(value, 1))}<sup>*</sup>`, from: claim(a.key, `${a.ptr}/bars/${a.i}/4`, a.bar[4], fr(2, ' $'), `${stem}_a_${y}_${sym}`), to: claim(b.key, `${b.ptr}/bars/${b.i}/4`, b.bar[4], fr(2, ' $'), `${stem}_b_${y}_${sym}`) };
}
const H = {};
for (const y of YEARS) {
  H[y] = {
    j1: hmove(y, 'SPY', -1, 1, 'hj1'), p5: hmove(y, 'SPY', 0, 5, 'hp5'), p21: hmove(y, 'SPY', 0, 21, 'hp21'), p63: hmove(y, 'SPY', 0, 63, 'hp63'),
    sect: HS.slice(1).map(s => ({ s, v: (() => { const j = joined(y, s), e = j.findIndex(x => x.bar[0] === electionDay(y)); return (j[e + 21].bar[4] / j[e].bar[4] - 1) * 100; })() }))
  };
}
const countPos = k => YEARS.filter(y => H[y][k].value > 0).length;
if (countPos('j1') !== 5 || countPos('p21') !== 4 || countPos('p63') !== 4 || countPos('p5') !== 4) throw new Error(`décompte historique à revoir ${['j1', 'p5', 'p21', 'p63'].map(countPos)}`);
const sectAvg = s => YEARS.reduce((t, y) => t + H[y].sect.find(x => x.s === s).v, 0) / YEARS.length;
const spyAvg21 = YEARS.reduce((t, y) => t + H[y].p21.value, 0) / YEARS.length;
const xlvBeat = YEARS.filter(y => H[y].sect.find(x => x.s === 'XLV').v > H[y].p21.value).length;
const xleBeat = YEARS.filter(y => H[y].sect.find(x => x.s === 'XLE').v > H[y].p21.value).length;
if (!(H['2002'].j1.value > 0 && H['2002'].p21.value < 0 && H['2018'].j1.value > 0 && H['2018'].p21.value < 0)) throw new Error('2002/2018 à revoir');
if (!(pmDD.node.yes_price > 0.75)) throw new Error('3 chances sur 4');
if (xlvBeat !== 3 || xleBeat !== 3) throw new Error(`secteurs contre SPY : santé ${xlvBeat}, énergie ${xleBeat}`);

// ── Le daily du 31 octobre ───────────────────────────────────────────────────
const SETUPS = [
  ['MSFT', 'Microsoft', 515, 497, 551], ['UNH', 'UnitedHealth', 402, 385, 432], ['CRM', 'Salesforce', 224, 210, 250],
  ['CRWD', 'CrowdStrike', 244, 224, 278], ['JCI', 'Johnson Controls', 146, 138, 160], ['FAST', 'Fastenal', 50.8, 48.9, 54.5],
  ['CNC', 'Centene', 65.8, 61.7, 72.5], ['OKTA', 'Okta', 202, 183, 233], ['IGV', 'ETF logiciel IGV', 103.5, 99, 111.5]
].map(([s, name, entry, stop, target]) => {
  const ser = series('dos', s), i = idxOf(ser, REF), bar = ser.bars[i];
  const filled = bar[3] <= entry, openAbove = bar[1] > entry;
  if (!openAbove) throw new Error(`${s}: ouverture sous l'entrée, prix d'exécution à revoir`);
  if (bar[4] <= stop) throw new Error(`${s}: stop cassé en clôture`);
  return { s, name, entry, stop, target, bar, i, ser, filled, ret: (bar[4] / entry - 1) * 100, r: (bar[4] - entry) / (entry - stop), gap: (bar[4] / entry - 1) * 100, toStop: (bar[4] / stop - 1) * 100 };
});
const filled = SETUPS.filter(x => x.filled), pending = SETUPS.filter(x => !x.filled);
if (filled.length !== 7 || pending.map(x => x.s).join() !== 'CRM,FAST') throw new Error('exécutions inattendues');
const sumR = filled.reduce((t, x) => t + x.r, 0), avgRet = filled.reduce((t, x) => t + x.ret, 0) / filled.length;
const okta = SETUPS.find(x => x.s === 'OKTA');
const oktaAtrH = hit('ft', x => x && x.symbol === 'OKTA' && typeof x.atr === 'number' && x.last_bar_date === REF, 'ATR OKTA');
if (!(okta.toStop < 1.1 && oktaAtrH.node.atr > okta.bar[4] - okta.stop)) throw new Error('lecture OKTA à revoir');
const lo = x => claim('dos', `${x.ser.ptr}/bars/${x.i}/3`, x.bar[3], fr(2, ' $'), `low_${x.s}`);
const cl = x => claim('dos', `${x.ser.ptr}/bars/${x.i}/4`, x.bar[4], fr(2, ' $'), `close_${x.s}`);
const op = x => claim('dos', `${x.ser.ptr}/bars/${x.i}/1`, x.bar[1], fr(2, ' $'), `open_${x.s}`);
const L = v => lit(`${frNum(v, Number.isInteger(v) ? 0 : (String(v).split('.')[1] || '').length)} $`);

// ── Mise en page ─────────────────────────────────────────────────────────────
const section = (id, kicker, title, pill, status, body) => `<section id="${id}" class="section-shell" data-status="${status}"><div class="section-head"><div><div class="section-kicker">${kicker}</div><h2>${title}</h2></div>${pill}</div>${body}</section>`;
const pill = (t, cls = '') => `<span class="status-pill${cls ? ' ' + cls : ''}">${t}</span>`;
const table = (head, rows, cls = 'data-table') => `<div class="table-scroll"><table class="${cls}"><thead><tr>${head.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const dash = (label, value, move, note, d) => `<article class="dash-card"><div class="dash-label">${label}</div><div class="dash-value">${value}</div><div class="dash-move ${d}">${move}</div><div class="dash-note">${note}</div></article>`;
const sections = [];
const refDay = (stem, parts = 'weekday_day_month') => bdate('idx', 'SPY', REF, parts, stem);

// 1. L'essentiel
sections.push(`<section id="essentiel" class="decision-strip" data-status="validated">`
  + `<article class="decision-card primary"><div class="decision-kicker">Décision</div><h2>Ce soir, aucun ordre nouveau : on laisse voter, puis on juge à la clôture</h2><p>Les Américains votent ce ${voteDay('vote_a')} pour toute la Chambre et un tiers du Sénat. Les premiers bureaux ferment à ${pollP('first_in_ky', 'p_first_a')} heure de Paris, les derniers à ${pollP('hi_ak', 'p_last_a')}. Wall Street ferme avant, à ${nyClose('nyc_a')}, et AMD publie ses comptes juste après. Le verdict de la nuit se lira mercredi à l’ouverture de New York, pas dans les premiers chiffres.</p><p>Nos ordres du ${lit('31 octobre')} restent tels quels : les stops se jugent à la clôture, les deux ordres non exécutés gardent leur prix. Aucun achat en plus d’ici là.</p></article>`
  + `<article class="decision-card">${pill('PARIS DU MARCHÉ', 'partial')}<h3>Le Congrès bascule, selon Polymarket</h3><p>Chambre démocrate : ${pmv(pmDH, 'dh_a')}. Sénat démocrate : ${pmv(pmDS, 'ds_a')}. Les deux à la fois : ${pmv(pmDD, 'dd_a')}. Relevé à ${pmAt('pm_t_a')}, heure de Paris. Le marché a donc déjà parié sur un Congrès démocrate face à un président républicain : la surprise serait l’inverse.</p></article>`
  + `<article class="decision-card">${pill('BILAN', 'risk')}<h3>Nos neuf achats du ${lit('31 octobre')}</h3><p>${lit(String(filled.length))} ordres sur ${lit(String(SETUPS.length))} exécutés lundi, tous le même jour : ${lit(frSigned(avgRet, 1))} en moyenne à la clôture, ${lit(frSigned(sumR, 2, ' R'))} au total. Aucun stop touché en clôture, mais Okta n’est plus qu’à ${lit(frNum(okta.toStop, 1) + ' %')} du sien.</p></article>`
  + `</section>`);

// 2. Tableau de bord
const moveList = [['sec', 'XLY', 'Consommation (XLY)'], ['sec', 'XLF', 'Finance (XLF)'], ['dos', 'KRE', 'Banques régionales (KRE)'], ['dos', 'ITA', 'Défense (ITA)'],
  ['dos', 'TAN', 'Solaire (TAN)'], ['dos', 'ICLN', 'Énergies propres (ICLN)'], ['sec', 'XLP', 'Conso. de base (XLP)'], ['dia', 'DIA', 'Dow Jones (DIA)'],
  ['idx', 'IWM', 'Petites valeurs (IWM)'], ['sec', 'XLV', 'Santé (XLV)'], ['idx', 'SPY', 'S&P 500 (SPY)'], ['idx', 'QQQ', 'Nasdaq-100 (QQQ)'],
  ['dos', 'IHF', 'Assureurs et cliniques (IHF)'], ['dos', 'SMH', 'Semi-conducteurs (SMH)'], ['sec', 'XLK', 'Technologie (XLK)'], ['sec', 'XLE', 'Énergie (XLE)'],
  ['dos', 'XOP', 'Pétroliers (XOP)'], ['idx', 'USO', 'Pétrole (USO)'], ['dos', 'AMD', 'AMD'], ['dos', 'ORCL', 'Oracle']];
const moveData = moveList.map(([k, s, label]) => ({ label, v: +chgValue(k, s).toFixed(2) })).sort((a, b) => a.v - b.v);
sections.push(section('dashboard', 'Le tableau', 'Lundi, la tech et le pétrole ont payé, la finance et le solaire ont monté', pill('CONTRÔLÉ'), 'validated',
  `<div class="dashboard-grid">`
  + dash('S&P 500 (SPY)', px('idx', 'SPY', REF, 'close', 2, 'spy_px'), chg('idx', 'SPY', PREV, REF, 2, 'spy_d'), 'clôture de lundi', dir(chgValue('idx', 'SPY')))
  + dash('Nasdaq-100 (QQQ)', px('idx', 'QQQ', REF, 'close', 2, 'qqq_px'), chg('idx', 'QQQ', PREV, REF, 2, 'qqq_d'), 'clôture de lundi', dir(chgValue('idx', 'QQQ')))
  + dash('Dow Jones (DIA)', px('dia', 'DIA', REF, 'close', 2, 'dia_px'), chg('dia', 'DIA', PREV, REF, 2, 'dia_d'), 'clôture de lundi', dir(chgValue('dia', 'DIA')))
  + dash('Petites valeurs (IWM)', px('idx', 'IWM', REF, 'close', 2, 'iwm_px'), chg('idx', 'IWM', PREV, REF, 2, 'iwm_d'), 'clôture de lundi', dir(chgValue('idx', 'IWM')))
  + dash('Volatilité à 30 jours (VIX)', vixR(vix30, 'vix_a'), `à ${lit('9 jours')} : ${vixR(vix9, 'vix9_a')}`, 'la semaine du vote coûte plus cher', 'flat')
  + dash('Pétrole (USO)', px('idx', 'USO', REF, 'close', 2, 'uso_px'), chg('idx', 'USO', PREV, REF, 1, 'uso_d'), 'espoir de discussions avec l’Iran', dir(chgValue('idx', 'USO')))
  + dash('Contrat S&P 500 ce matin', offPx(es, 2, 'es_a'), `relevé à ${offAt(es, 'es_t_a')}`, 'indicatif, pas une clôture', 'flat')
  + dash('Hausse de la Fed en décembre', fedDecR('fed_a'), 'chances selon Polymarket', 'avant l’emploi de vendredi', 'flat')
  + `</div>`
  + `<div id="movesChart" class="echart-box" role="img" aria-label="Variation de chaque indice, secteur et titre entre la clôture du vendredi 30 octobre et celle du lundi 2 novembre, en pourcentage" style="width:100%; height:620px; margin-top:1rem;"></div>`
  + `<p class="provenance">Variations de la clôture du ${bdate('idx', 'SPY', PREV, 'weekday_day_month', 'prev_c')} à celle du ${refDay('ref_c')}. Volatilité : clôture de lundi des indices VIX à ${lit('9 jours')}, ${lit('30 jours')} (${vixR(vix30, 'vix_c')}) et ${lit('3 mois')} (${vixR(vix3m, 'vix3m_c')}). Contrats à terme et cote de la Fed : relevés de ce mardi matin, pas des clôtures.</p>`));

// 3. La séance
sections.push(section('seance', 'La séance', 'Les géants de l’IA empruntent, le marché vend', pill('ATTRIBUÉ', 'partial'), 'partial',
  `<p class="section-intro">Lundi, le Nasdaq-100 a fait ${chg('idx', 'QQQ', PREV, REF, 1, 'qqq_b')} et le Dow Jones ${chg('dia', 'DIA', PREV, REF, 1, 'dia_b')} : une rotation, pas une panique. Selon Stocktwits, Oracle propose ${reg('/facts/session/orcl_debt_bn', fr(0, ' Md$'), 'orcl_debt', 'stocktwits_session_20261102')} de dette et autant en actions nouvelles, et Meta envisage ${reg('/facts/session/meta_bonds_bn', fr(0, ' Md$'), 'meta_bonds', 'stocktwits_session_20261102')} d’obligations. Quand les plus gros acheteurs de puces doivent emprunter pour suivre leur propre rythme d’investissement, le marché se demande qui paiera la suite : Oracle a fini à ${chg('dos', 'ORCL', PREV, REF, 1, 'orcl_b')}, les semi-conducteurs (SMH) à ${chg('dos', 'SMH', PREV, REF, 1, 'smh_b')}, AMD à ${chg('dos', 'AMD', PREV, REF, 1, 'amd_b')} la veille de ses résultats.</p>`
  + `<p class="section-intro">Le pétrole (USO) a fini à ${chg('idx', 'USO', PREV, REF, 1, 'uso_b')}. Toujours selon Stocktwits, Marco Rubio a dit que le président n’avait pas décidé d’action militaire contre l’Iran, et le ministre iranien des Affaires étrangères juge un accord possible. Les pétroliers (XOP) ont suivi, à ${chg('dos', 'XOP', PREV, REF, 1, 'xop_b')}. Ce matin, le baril de WTI cote ${offPx(wti, 2, 'wti_a', ' $')} à ${offAt(wti, 'wti_t')}, heure de Paris.</p>`
  + `<p class="section-intro">Ce qui a monté ressemble à un pari sur le vote. Le solaire (TAN) a pris ${chg('dos', 'TAN', PREV, REF, 1, 'tan_b')} et les énergies propres (ICLN) ${chg('dos', 'ICLN', PREV, REF, 1, 'icln_b')} : selon Reuters, ce sont les premiers gagnants cités d’une victoire démocrate. Les banques régionales (KRE) ${chg('dos', 'KRE', PREV, REF, 1, 'kre_b')} et la défense (ITA) ${chg('dos', 'ITA', PREV, REF, 1, 'ita_b')} ont monté aussi. En face, les assureurs santé ont reculé : Centene ${chg('dos', 'CNC', PREV, REF, 1, 'cnc_b')}, UnitedHealth ${chg('dos', 'UNH', PREV, REF, 1, 'unh_b')}, Elevance ${chg('dos', 'ELV', PREV, REF, 1, 'elv_b')}. Le lien avec le vote est une lecture, pas une preuve : aucune dépêche ne l’attribue à l’élection.</p>`
  + `<div class="quality-note"><strong>Apple, après la clôture.</strong> Selon Investing.com, le trimestre a battu les attentes, mais Apple prévoit une marge brute de ${reg('/facts/session/aapl_gm_low_pct', fr(0), 'gm_lo', 'investing_apple_20261102')} à ${reg('/facts/session/aapl_gm_high_pct', fr(0, ' %'), 'gm_hi', 'investing_apple_20261102')}, sous les ${reg('/facts/session/aapl_gm_consensus_pct', fr(1, ' %'), 'gm_cons', 'investing_apple_20261102')} attendus, à cause du prix de la mémoire. Le titre avait fini lundi à ${chg('dos', 'AAPL', PREV, REF, 1, 'aapl_b')}. Ce matin, le contrat Nasdaq-100 cote ${offPx(nq, 2, 'nq_a')} à ${offAt(nq, 'nq_t')}.</div>`));

// 4. Les enjeux
const pmRows = [
  ['Chambre démocrate', pmv(pmDH, 'dh_t'), pmVol(pmDH, 'dhv')], ['Chambre républicaine', pmv(pmRH, 'rh_t'), pmVol(pmRH, 'rhv')],
  ['Sénat démocrate', pmv(pmDS, 'ds_t'), pmVol(pmDS, 'dsv')], ['Sénat républicain', pmv(pmRS, 'rs_t'), pmVol(pmRS, 'rsv')],
  ['Les deux chambres démocrates', pmv(pmDD, 'dd_t'), pmVol(pmDD, 'ddv')], ['Les deux chambres républicaines', pmv(pmRR, 'rr_t'), pmVol(pmRR, 'rrv')],
  ['Texas, siège de sénateur démocrate', pmv(pmTX, 'tx_t'), pmVol(pmTX, 'txv')], ['Michigan, siège de sénateur démocrate', pmv(pmMI, 'mi_t'), pmVol(pmMI, 'miv')]];
sections.push(section('enjeux', 'Les enjeux', 'Un Congrès qui change de main, un président qui reste', pill('SOURCÉ'), 'validated',
  `<div class="two-col"><article class="data-card"><h3>La Chambre</h3><p>Les ${elec('house_seats', 'h_seats')} sièges sont en jeu. Les républicains la tiennent par ${elec('house_r', 'h_r', 'npr_house_20261029')} sièges contre ${elec('house_d', 'h_d', 'npr_house_20261029')} (NPR) ; il suffit aux démocrates d’en gagner ${elec('dem_house_net_needed', 'h_need')} de plus (Ballotpedia). Le Cook Political Report en donne ${elec('cook_dem_favored', 'cook_d', 'npr_house_20261029')} favorables aux démocrates et ${elec('cook_tossups', 'cook_t', 'npr_house_20261029')} indécis. Le sondage NPR/PBS/Marist donne aux démocrates ${reg('/facts/election/generic_lv_pts', fr(0, ' pts'), 'gen_lv', 'npr_house_20261029')} d’avance chez les votants probables.</p></article>`
  + `<article class="data-card"><h3>Le Sénat</h3><p>${elec('senate_seats_up', 's_up')} sièges sur ${lit('100')} sont en jeu, dont ${elec('senate_special', 's_spec')} en élection partielle. Les républicains en ont ${elec('senate_r', 's_r')} ; les démocrates doivent en gagner ${elec('dem_senate_net_needed', 's_need')} de plus pour la majorité (Ballotpedia). Polymarket donne même le siège du Texas aux démocrates à ${pmv(pmTX, 'tx_a')}. Le nouveau Congrès siège le ${reg('/facts/election/new_congress_date', dateR('full'), 'jan3', 'ballotpedia_congress_2026')} : rien ne change dans les lois avant.</p></article></div>`
  + table(['Pari Polymarket', 'Chance', 'Échangé sur 24 heures'], pmRows)
  + `<p class="provenance">Cotes relevées à ${pmAt('pm_t_b')}, heure de Paris, ce mardi. Une cote n’est pas un sondage : c’est le prix auquel des parieurs échangent de l’argent. Chambre et Sénat se cotent sur des contrats séparés, d’où des totaux qui ne tombent pas pile.</p>`
  + `<div class="quality-note"><strong>Pourquoi ça compte pour un portefeuille.</strong> Le président garde son veto, ses droits de douane et ses décrets (CNBC). Un Congrès démocrate ne peut donc pas défaire sa politique ; il peut en revanche convoquer, enquêter, ralentir les nominations et marchander chaque budget. C’est ce levier, secteur par secteur, qui fait bouger les cours.</div>`));

// 5. La nuit
const nightRows = [
  [pollP('first_in_ky', 'n1'), 'Indiana et Kentucky (comtés à l’heure de l’Est)', 'premiers résultats, rarement décisifs'],
  [pollP('ga_sc_vt_va', 'n2'), 'Géorgie, Caroline du Sud, Vermont, Virginie', 'Géorgie : siège démocrate au Sénat, dans un État gagné par Trump en 2024 (Ballotpedia)'],
  [pollP('nc_oh_wv', 'n3'), 'Caroline du Nord, Ohio, Virginie-Occidentale', 'Ohio : élection partielle au Sénat (Ballotpedia)'],
  [pollP('pa_nj_md_de', 'n4'), 'Pennsylvanie, New Jersey, Maryland, Delaware', ''],
  [pollP('ny_mn_wi_ia_co', 'n5'), 'New York, Minnesota, Wisconsin, Iowa, Colorado', 'Iowa : deux circonscriptions parmi les plus chères de la campagne (NPR)'],
  [pollP('nv_mt_ut', 'n6'), 'Nevada, Montana, Utah', ''],
  [pollP('ca_wa', 'n7'), 'Californie, État de Washington', ''],
  [pollP('hi_ak', 'n8'), 'Hawaï, Alaska', '']
];
const echeancier = renderEventTimeline({
  id: 'echeancier', asof: '2026-11-03', from: '2026-11-03', to: '2026-11-06', requireProof: true,
  keyWindow: { from: '2026-11-03', to: '2026-11-04', labelHtml: `Nuit clé · mar. ${nyClose('kw_a')} → mer. ${pollP('hi_ak', 'kw_b')}` },
  events: [
    { date: '2026-11-03', category: 'geo', impact: 'strong', label: 'Vote des midterms', detail: 'Chambre et un tiers du Sénat', icon: 'vote', href: '#enjeux', proof: voteDay('tl_vote', 'day_month'), proofHidden: true },
    { date: '2026-11-03', category: 'earnings', impact: 'strong', label: 'AMD', detailHtml: `résultats après la clôture, conférence à ${amdCall('tl_amd_c')}`, icon: 'chip', href: '#seance', proof: amdDay('tl_amd', 'day_month'), proofHidden: true },
    { date: '2026-11-04', category: 'geo', impact: 'strong', label: 'Fermeture des bureaux', detailHtml: `de ${pollP('first_in_ky', 'tl_p1')} à ${pollP('hi_ak', 'tl_p8')}`, icon: 'vote', href: '#nuit', proof: pollP('ga_sc_vt_va', 'tl_p2'), proofHidden: true },
    { date: '2026-11-04', category: 'macro', impact: 'medium', label: 'ISM des services', detail: 'activité américaine', icon: 'data', proof: paris(ism, 'tl_ism') },
    { date: '2026-11-05', category: 'macro', impact: 'medium', label: 'Inscriptions au chômage', detail: 'hebdomadaires', icon: 'data', proof: paris(claimsJ, 'tl_claims') },
    { date: '2026-11-06', category: 'macro', impact: 'strong', label: 'Emploi américain', detail: 'le chiffre qui fixe les taux', icon: 'data', proof: paris(nfp, 'tl_nfp') }
  ],
  chains: [
    { steps: [{ label: 'Congrès démocrate', icon: 'vote', category: 'geo' }, { label: 'Contrôle de Medicaid', icon: 'pill' }, { label: 'Assureurs santé', category: 'plan', icon: 'company', tone: 'down' }] },
    { steps: [{ label: 'Congrès démocrate', icon: 'vote', category: 'geo' }, { label: 'Crédits verts préservés', icon: 'bolt' }, { label: 'Solaire, réseau', category: 'earnings', icon: 'company', tone: 'up' }] },
    { steps: [{ label: 'Sénat républicain', icon: 'vote', category: 'geo' }, { label: 'Statu quo', icon: 'gavel' }, { label: 'Banques, défense', category: 'earnings', icon: 'bank', tone: 'up' }] },
    { steps: [{ label: 'AMD déçoit', icon: 'chip', category: 'earnings' }, { label: 'Semi-conducteurs', icon: 'chip', tone: 'down' }, { label: 'Nos lignes logiciel', category: 'plan', icon: 'company', tone: 'down' }] }
  ]
});
sections.push(section('nuit', 'La nuit électorale', 'Heure par heure, en heure de Paris', pill('DATÉ'), 'validated',
  echeancier
  + table(['Fermeture (Paris)', 'États', 'Ce qu’on y regarde'], nightRows)
  + `<p class="section-intro">Les États-Unis sont repassés à l’heure d’hiver dimanche : l’écart avec Paris est de ${lit('six heures')} cette semaine, et Wall Street ferme à ${nyClose('nyc_n')}. Le Michigan et le Texas, deux sièges de sénateur très suivis, sont à cheval sur deux fuseaux : leurs bureaux ne ferment pas tous à la même heure (Quartz). AMD publie ce soir après la clôture, conférence à ${amdCall('amd_n')} ; Arista aussi, le ${anetDate('anet_d')}, date d’une seule source non confirmée par la société.</p>`
  + `<p class="provenance">Horaires de fermeture : Quartz, mis à jour le ${lit('30 octobre')}, d’après les lois de chaque État ; un électeur déjà dans la file peut encore voter. Date et heure d’AMD : communiqué de la société. ISM, chômage et emploi : calendrier collecté.</p>`));

// 6. L'histoire
const histRows = YEARS.map(y => {
  const h = H[y], best = h.sect.slice().sort((a, b) => b.v - a.v)[0], worst = h.sect.slice().sort((a, b) => a.v - b.v)[0];
  const sc = (s, v, stem) => { const j = joined(y, s), e = j.findIndex(x => x.bar[0] === electionDay(y)), a = j[e], b = j[e + 21]; if (a.key !== b.key) return `${lit(frSigned(v, 1))}<sup>*</sup>`; return claim(b.key, `${b.ptr}/bars/${b.i}/4`, b.bar[4], fr(1, ' %', true), `${stem}_${y}_${s}`, { operation: 'ratio_pct', numerator_pointer: `${b.ptr}/bars/${b.i}/4`, denominator_pointer: `${a.ptr}/bars/${a.i}/4`, result: (b.bar[4] / a.bar[4] - 1) * 100 }); };
  return [`<strong>${lit(y)}</strong> · ${claim(`h${(SPLIT[y] || [y])[0]}`, `${series(`h${(SPLIT[y] || [y])[0]}`, 'SPY', null).ptr}/bars/${idxOf(series(`h${(SPLIT[y] || [y])[0]}`, 'SPY', null), electionDay(y))}/0`, electionDay(y), dateR('day_month'), `hd_${y}`)}`,
    h.j1.html, h.p5.html, h.p21.html, h.p63.html, `${SECT[best.s]} ${sc(best.s, best.v, 'hb')}`, `${SECT[worst.s]} ${sc(worst.s, worst.v, 'hw')}`];
});
const HLAB = { j1: 'veille → lendemain', p5: 'semaine', p21: 'mois', p63: 'trimestre' };
const splitNotes = YEARS.flatMap(y => ['j1', 'p5', 'p21', 'p63'].filter(k => H[y][k].split).map(k => `${lit(y)}, ${HLAB[k]} : SPY de ${H[y][k].from} à ${H[y][k].to}`));
sections.push(section('histoire', 'L’histoire', 'Ce que la Bourse a fait après les six derniers votes', pill('CONTRÔLÉ'), 'validated',
  `<p class="section-intro">Nous avons mesuré le S&amp;P 500 (SPY) autour de chaque élection de mi-mandat depuis ${lit('2002')}, sur nos cours vérifiés : du jour d’avant au jour d’après le vote, puis sur ${lit('5')}, ${lit('21')} et ${lit('63')} séances, soit une semaine, un mois et un trimestre de Bourse. Les deux dernières colonnes donnent le meilleur et le pire compartiment sur le mois qui suit, parmi les grands secteurs, le Nasdaq-100 et les petites valeurs.</p>`
  + table(['Vote', 'Veille → lendemain', 'Semaine', 'Mois', 'Trimestre', 'Meilleur compartiment, un mois', 'Pire compartiment, un mois'], histRows)
  + `<div id="histChart" class="echart-box" role="img" aria-label="Performance du S&amp;P 500 sur le mois de Bourse suivant chaque élection de mi-mandat depuis 2002" style="width:100%; height:320px; margin-top:1rem;"></div>`
  + `<p class="section-intro">Le lendemain du vote, le marché a monté ${lit('cinq fois sur six')} : la fin de l’incertitude se paie tout de suite. Ensuite, rien d’automatique. Sur un mois, ${lit('quatre')} hausses et ${lit('deux')} baisses ; sur un trimestre, pareil. La santé a fait mieux que le S&amp;P 500 sur le mois suivant ${lit('trois fois sur six')}, l’énergie aussi : aucune règle sectorielle ne ressort de six élections.</p>`
  + `<div class="quality-note"><strong>Ce que disent les études plus longues.</strong> Selon CNBC, cité par BeInCrypto, le S&amp;P 500 a gagné en moyenne ${reg('/facts/history_press/cnbc_avg_1y_pct', fr(1, ' %'), 'cnbc_avg', 'beincrypto_cnbc_20261103')} un an après les ${reg('/facts/history_press/cnbc_midterms_count', fr(0), 'cnbc_n', 'beincrypto_cnbc_20261103')} élections de mi-mandat depuis ${lit('1982')}, sans une seule année de baisse. Morgan Stanley, cité par CNBC, compte ${reg('/facts/history_press/ms_split_congress_pct', fr(0, ' %'), 'ms_split', 'cnbc_sectors_20261102')} en moyenne sous un président républicain quand le Congrès était partagé, contre ${reg('/facts/history_press/ms_dem_both_pct', fr(0, ' %'), 'ms_dem', 'cnbc_sectors_20261102')} quand les démocrates tenaient les deux chambres : le scénario coté ce matin est le moins bon des deux, et il reste positif dans l’histoire. Nos fenêtres plus courtes rappellent que ce gain ne vient pas en ligne droite.</div>`
  + `<p class="provenance">Clôtures vérifiées de chaque fenêtre, sans dividendes. Jour du vote : le mardi qui suit le premier lundi de novembre (loi fédérale). ${splitNotes.length ? `<sup>*</sup> Fenêtre coupée par une séance fermée (obsèques nationales de ${lit('2007')} et ${lit('2018')}) : calcul sur deux relevés de chaque fonds (${splitNotes.join(' ; ')}). ` : ''}Six élections forment un petit échantillon, chacune dans son propre contexte de taux et de bénéfices.</p>`));

// 7. Scénarios
sections.push(section('scenarios', 'Scénarios', 'Trois résultats possibles, et ce qu’ils changent', pill('À SURVEILLER', 'partial'), 'partial',
  `<div class="scenario-grid">`
  + `<article class="scenario base"><h3>Scénario de base : Congrès démocrate (${pmv(pmDD, 'dd_s')})</h3><p>Les cotes en font le grand favori : c’est le résultat le moins capable de surprendre. Selon Reuters, une victoire démocrate nette profiterait aux énergies propres, au logement et à une partie de la santé, et mettrait sous contrôle l’IA, les centres de données et la défense. Pour les assureurs, Reuters cite un examen plus serré de Medicaid et de Medicare Advantage ; TD Cowen n’y voit pas de grande réforme. La loi fiscale de ${lit('2025')} retire déjà ${reg('/facts/policy/medicaid_cut_bn', fr(0, ' Md$'), 'medicaid', 'cnbc_sectors_20261102')} à Medicaid d’ici ${lit('2034')} (KFF, d’après le CBO, cité par CNBC) : c’est ce texte que des démocrates voudraient rouvrir. Société Générale juge le pari IA intact, faute de majorité capable de passer outre un veto.</p></article>`
  + `<article class="scenario flat"><h3>Partage : Chambre démocrate, Sénat républicain (${pmv(pmRS, 'rs_s')})</h3><p>Le Sénat garde la main sur les nominations, Fed comprise (CNBC). Morgan Stanley y voit un terrain plutôt favorable à la défense, à la technologie et à la finance. Si ce scénario sort, le solaire, monté lundi sur l’hypothèse inverse, a le plus à rendre.</p></article>`
  + `<article class="scenario up"><h3>Surprise : Congrès républicain (${pmv(pmRR, 'rr_s')})</h3><p>Le moins probable. Selon BNY, il serait lu d’abord comme favorable aux actions : déréglementation, pétrole et gaz, centres de données. Il pèserait sur les obligations, avec plus de dépenses à financer. Le solaire rendrait sa hausse de lundi.</p></article>`
  + `<article class="scenario down"><h3>Quand nous aurons tort</h3><p>Notre lecture, « le vote est déjà dans les prix, l’IA et les taux comptent plus », tombe si mercredi à la clôture le Nasdaq-100 (QQQ) a perdu plus que les petites valeurs (IWM) alors qu’AMD a rassuré : ce serait le Congrès, pas l’IA, que le marché vend. Elle tombe aussi si la volatilité à ${lit('9 jours')} reste au-dessus de ${vixR(vix9, 'vix9_s')} après le décompte : l’incertitude n’aurait pas été levée.</p></article>`
  + `</div>`
  + `<p class="provenance">Mécanismes attribués : Reuters et CNBC (${lit('2 novembre')}), Morgan Stanley (${lit('5 août')}), BNY. Le décompte d’un siège serré peut prendre plusieurs jours ; le contrôle de la Chambre peut rester inconnu mercredi matin.</p>`));

// 8. Le bilan du 31 octobre
const bilanRows = SETUPS.map(x => [
  `<strong>${x.s}</strong> · ${x.name}`, L(x.entry), op(x), lo(x), x.filled ? '<span class="verdict vrai">Oui</span>' : '<span class="verdict neutre">Non</span>', cl(x),
  x.filled ? `${lit(frSigned(x.ret, 1))} (${lit(frSigned(x.r, 2, ' R'))})` : `${lit(frNum(x.gap, 1) + ' %')} au-dessus`,
  `${L(x.stop)} / ${L(x.target)}`]);
const lineNote = x => `${lit(frNum(x.toStop, 1) + ' %')}`;
const filledSorted = filled.slice().sort((a, b) => a.toStop - b.toStop);
sections.push(section('bilan', 'Suite du daily du 31 octobre', 'Sept ordres sur neuf exécutés le même jour', pill('MESURÉ', 'risk'), 'partial',
  `<p class="section-intro">Le ${lit('31 octobre')}, nous avions publié neuf achats à cours limité après le repli de la tech, avec une règle : l’ordre attend son prix jusqu’à la mi-novembre, et le stop se juge à la clôture. Tous ont ouvert lundi au-dessus de leur prix d’entrée ; ${lit(String(filled.length))} sont descendus l’atteindre dans la séance. L’achat s’est donc fait au prix publié.</p>`
  + table(['Titre', 'Entrée', 'Ouverture', 'Plus bas du jour', 'Exécuté ?', 'Clôture', 'Depuis l’entrée', 'Stop / cible'], bilanRows)
  + `<p class="provenance">R : gain ou perte rapporté au risque prévu, l’écart entre l’entrée et le stop. Clôtures vérifiées du ${refDay('ref_b')} ; écarts calculés depuis les prix publiés le ${lit('31 octobre')}.</p>`
  + `<div class="quality-note warning-note"><strong>Le risque que l’article signalait s’est produit.</strong> Nous écrivions que détenir les neuf n’était pas une vraie diversification, et qu’il ne fallait pas les prendre d’un coup. Lundi, la vente de la tech a déclenché ${lit(String(filled.length))} ordres en une séance. Les ${lit(String(filled.length))} lignes exécutées font ${lit(frSigned(avgRet, 1))} en moyenne, ${lit(frSigned(sumR, 2, ' R'))} au total. Okta a fait le plus de dégâts : ouvert à ${op(okta)} dans l’élan de son entrée annoncée dans le S&amp;P 500 (GuruFocus), il a fini à ${cl(okta)}, ${chg('dos', 'OKTA', PREV, REF, 1, 'okta_d')} par rapport à vendredi. Nous n’avons trouvé aucune nouvelle propre au titre qui explique cette chute.</div>`
  + `<div class="three-col">`
  + `<article class="focus-card"><div class="focus-symbol">OKTA</div><div class="focus-what">À ${lineNote(okta)} de son stop</div><p>Stop à ${L(okta.stop)}, jugé à la clôture de ce soir, ${nyClose('nyc_okta')} à Paris. L’amplitude moyenne récente d’une séance d’Okta est de ${claim('ft', `${oktaAtrH.ptr}/atr`, oktaAtrH.node.atr, fr(2, ' $'), 'okta_atr')} : bien plus que l’écart qui reste. Une clôture sous ${L(okta.stop)} solde la ligne à la séance suivante, sans discussion. Okta publie ses propres comptes le ${lit('1er décembre')}.</p></article>`
  + `<article class="focus-card"><div class="focus-symbol">MSFT · IGV</div><div class="focus-what">Les plus proches ensuite</div><p>Microsoft, acheté à ${L(515)}, a fini à ${cl(SETUPS[0])} : ${lineNote(SETUPS[0])} au-dessus du stop de ${L(497)}. L’ETF logiciel IGV est à ${lineNote(SETUPS[8])} du sien (${L(99)}). AMD publie ce soir : c’est le prochain test pour ces deux lignes.</p></article>`
  + `<article class="focus-card"><div class="focus-symbol">CRM · FAST</div><div class="focus-what">Pas exécutés, toujours valables</div><p>Salesforce a touché ${lo(SETUPS[2])}, à ${lit(frNum(SETUPS[2].bar[3] - SETUPS[2].entry, 2) + ' $')} de son entrée de ${L(224)}. Fastenal est resté à ${lit(frNum(SETUPS[5].gap, 1) + ' %')} au-dessus de la sienne. Les ordres restent posés jusqu’à la mi-novembre ; s’ils s’exécutent mercredi, ce sera au prix d’après le vote, et c’est voulu. Si l’un d’eux ouvre sous son stop (${L(210)} pour Salesforce, ${L(48.9)} pour Fastenal), on l’annule : c’est la règle du ${lit('31 octobre')}.</p></article>`
  + `</div>`
  + `<p class="section-intro">Les autres lignes ont de la marge : ${filledSorted.filter(x => !['OKTA', 'MSFT', 'IGV'].includes(x.s)).map(x => `${x.name} à ${lineNote(x)} de son stop`).join(', ')}.</p>`));

// 9. Ce qu'on fait
sections.push(section('trade', 'Ce qu’on fait', 'Mardi et mercredi, sans courir', pill('ATTENDRE'), 'validated',
  `<ul class="checklist">`
  + `<li><i class="fas fa-hourglass-half"></i><div><strong>Aucun achat nouveau avant la clôture de mercredi, en dehors des deux ordres déjà posés.</strong><br>Le marché a coté un Congrès démocrate à plus de ${lit('3 chances sur 4')} ; une surprise se paierait à l’ouverture de mercredi, pas dans les premiers résultats de la nuit, qui arrivent par vagues.</div></li>`
  + `<li><i class="fas fa-ruler-horizontal"></i><div><strong>Les stops du ${lit('31 octobre')} se jugent à la clôture, à ${nyClose('nyc_t')} à Paris.</strong><br>Okta en premier. Un stop passé comme ordre au marché pendant la nuit peut s’exécuter bien en dessous de son niveau si le titre ouvre en baisse : on garde la règle de l’article, la clôture.</div></li>`
  + `<li><i class="fas fa-hand"></i><div><strong>N’achetez pas le saut de mercredi matin.</strong><br>Ni sur le solaire si le Sénat bascule, ni sur les banques s’il reste républicain. En ${lit('2002')} et en ${lit('2018')}, le S&amp;P 500 a monté le lendemain du vote, puis baissé sur le mois suivant.</div></li>`
  + `<li><i class="fas fa-scale-balanced"></i><div><strong>Pas de nouvelle ligne logiciel.</strong><br>Microsoft, CrowdStrike, Okta, IGV, et Salesforce s’il s’exécute : c’est déjà le même pari, et AMD le met à l’épreuve ce soir.</div></li>`
  + `</ul>`
  + `<p class="provenance">Aucune nouvelle idée de trade dans cette édition : seuls les plans du ${lit('31 octobre')} sont suivis, avec leurs niveaux d’origine.</p>`));

// 10. Sources
const srcLinks = [
  ['https://www.npr.org/2026/10/29/nx-s1-6020921/2026-house-map-democrats-flip-republicans-tossup-triage', 'NPR, 29 octobre : la carte de la Chambre'],
  ['https://ballotpedia.org/United_States_Congress_elections,_2026', 'Ballotpedia : élections au Congrès 2026'],
  ['https://qz.com/poll-closing-times-election-day-2026', 'Quartz, 30 octobre : horaires de fermeture des bureaux'],
  ['https://ir.amd.com/news-events/press-releases/detail/1300/amd-to-report-fiscal-third-quarter-2026-financial-results', 'AMD : date de publication du trimestre'],
  ['https://www.investing.com/news/stock-market-news/sectors-bracing-for-a-pivot-as-usmidterm-elections-loom-4990811', 'Reuters, 2 novembre : les secteurs face au vote'],
  ['https://www.cnbc.com/2026/11/02/midterm-election-stocks-defense-healthcare-crypto-ai.html', 'CNBC, 2 novembre : défense, santé, IA et vote'],
  ['https://finance.yahoo.com/markets/stocks/articles/p-500-nasdaq-drop-capex-002235205.html', 'Stocktwits, 2 novembre : la séance, Oracle, Meta, pétrole'],
  ['https://finance.yahoo.com/markets/stocks/articles/u-stock-futures-steady-apple-013106272.html', 'Investing.com, 2 novembre : les comptes d’Apple'],
  ['https://finance.yahoo.com/markets/stocks/articles/stocks-rose-every-midterm-since-060000279.html', 'BeInCrypto, 3 novembre : la Bourse un an après les midterms'],
  ['https://www.morganstanley.com/insights/articles/2026-midterm-elections-market-impact-investor-outlook', 'Morgan Stanley, 5 août : midterms et marchés'],
  ['/daily/20261031/', 'Notre daily du 31 octobre : les neuf setups']
].map(([u, l]) => `<li><a href="${u}"${u.startsWith('http') ? ' rel="noopener" target="_blank"' : ''}>${l}</a></li>`).join('');
sections.push(section('sources', 'Sources et limites', 'Sur quoi repose cette édition', pill('PARTIEL', 'partial'), 'partial',
  `<div class="source-list">`
  + `<div class="source-item"><strong>Cours</strong><span>Clôtures vérifiées du ${refDay('ref_s', 'full')} ; fenêtres historiques vérifiées autour de chaque vote depuis ${lit('2002')}.</span></div>`
  + `<div class="source-item"><strong>Relevés de ce mardi</strong><span>Cotes Polymarket, contrats à terme et pétrole : relevés pendant la nuit et la matinée, jamais des clôtures.</span></div>`
  + `<div class="source-item"><strong>Élection et agenda</strong><span>NPR, Ballotpedia, Quartz, communiqué d’AMD et calendrier macro collecté. Presse pour l’attribution des mouvements : Reuters, CNBC, Stocktwits, Investing.com, BeInCrypto.</span></div>`
  + `</div>`
  + `<ul class="provenance">${srcLinks}</ul>`
  + `<div class="quality-note warning-note"><strong>Limites.</strong> Les mécanismes par secteur sont ceux des analystes cités, pas nos calculs. Le lien entre la séance de lundi et le vote est une lecture. Notre historique couvre six élections, sans dividendes ; les moyennes sur un an viennent de la presse.</div>`
  + `<p class="section-intro">Ce contenu est informatif. Il ne constitue pas un conseil en investissement. Investir comporte un risque de perte en capital.</p>`));

// ── Noms et dates écrits en toutes lettres : littéraux déclarés, liste close ─
// « S&P 500 », « Nasdaq-100 », les années, les dates d'articles et quelques nombres en toutes
// lettres sont des noms ou des repères, pas des mesures. Ils sont déclarés un par un ici ; tout autre
// chiffre non lié fera échouer le contrôle des claims.
const LITERAL_PATTERNS = [
  /S&amp;P 500/g, /S&P 500/g, /Nasdaq-100/g, /\b(?:19|20)\d{2}\b/g,
  /\b\d{1,2}(?:er)? (?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\b/g,
  /\b(?:30 jours|24 heures)\b/g, /(?<![\p{L}])(?:deux|trois|six|sept|neuf|tiers)(?![\p{L}])/giu
];
function declareNames(htmlIn) {
  let skip = 0, out = '';
  for (const tok of htmlIn.split(/(<[^>]+>)/)) {
    if (tok.startsWith('<')) {
      if (/^<(span|time)\b[^>]*(data-claim|data-literal|data-calendar-date)/.test(tok)) skip++;
      else if (skip && /^<\/(span|time)>/.test(tok)) skip--;
      else if (/^<(script|style)\b/.test(tok)) skip += 1000;
      else if (/^<\/(script|style)>/.test(tok)) skip -= 1000;
      out += tok; continue;
    }
    if (skip) { out += tok; continue; }
    let t = tok;
    for (const re of LITERAL_PATTERNS) t = t.replace(re, m => { literals.add(m.replace('&amp;', '&')); return `\u0000${m}\u0001`; });
    out += t.replace(/\u0000([^\u0001]*)\u0001/g, (_, m) => `<span data-literal>${m}</span>`);
  }
  return out;
}
for (let k = 0; k < sections.length; k++) sections[k] = declareNames(sections[k]);

// ── Graphiques ───────────────────────────────────────────────────────────────
const chartSpecs = [
  { id: 'movesChart', spec: { grid: { left: 200, right: 56, top: 12, bottom: 32 }, xAxis: { type: 'value', axisLabel: { formatter: '{value} %' } }, yAxis: { type: 'category', data: moveData.map(x => x.label), axisLabel: { fontSize: 11 } }, series: [{ type: 'bar', data: moveData.map(x => ({ value: x.v, itemStyle: { color: x.v >= 0 ? '#0b8f62' : '#c73d4b' } })), label: { show: true, position: 'right', formatter: '{c} %', fontSize: 10 } }] } },
  { id: 'histChart', spec: { grid: { left: 48, right: 18, top: 24, bottom: 32 }, xAxis: { type: 'category', data: YEARS }, yAxis: { type: 'value', axisLabel: { formatter: '{value} %' } }, series: [{ name: 'S&P 500, un mois après le vote', type: 'bar', data: YEARS.map(y => ({ value: +H[y].p21.value.toFixed(2), itemStyle: { color: H[y].p21.value >= 0 ? '#0b8f62' : '#c73d4b' } })), label: { show: true, position: 'top', formatter: '{c} %', fontSize: 10 } }] } }
];

// ── Page ─────────────────────────────────────────────────────────────────────
const title = 'Midterms : Wall Street a déjà parié sur un Congrès démocrate';
const description = `Édition spéciale du 3 novembre 2026. Polymarket donne la Chambre démocrate à ${renderValue(pmDH.node.yes_price, pct(1))} et le Sénat à ${renderValue(pmDS.node.yes_price, pct(1))}. La nuit heure par heure, ce que la Bourse a fait après les six derniers votes, et la suite de nos neuf achats du 31 octobre : sept exécutés, Okta près de son stop.`;
const badges = [`Chambre démocrate ${renderValue(pmDH.node.yes_price, pct(0))}`, `Sénat démocrate ${renderValue(pmDS.node.yes_price, pct(0))}`, `Nasdaq-100 ${frSigned(chgValue('idx', 'QQQ'), 1)} lundi`, 'AMD ce soir', 'Édition spéciale'];
const css = fs.readFileSync(path.join(DIR, '_style.css'), 'utf8');
const html = `<!DOCTYPE html>
<html lang="fr" data-tags="us,macro,geopolitique,special-edition,tech,software,healthcare,energy,trade-idea,retrospective" data-tab="daily">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily — 3 novembre 2026 : édition spéciale midterms</title>
  <meta name="description" content="${description}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://articles.dailytickers.com/daily/20261103/">
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

<section class="hero-section"><div class="container"><div class="hero-date">Mardi 3 novembre 2026 &bull; Édition spéciale midterms &bull; clôtures du lundi 2 novembre</div><h1 class="hero-title">${title}</h1><p class="hero-subtitle">${description}</p><div class="hero-badges">${badges.map(b => `<span class="hero-badge">${b}</span>`).join('')}</div><div id="article-clickable-tags" class="card-tags"></div></div></section>

<main class="report-main"><div class="container">
${sections.join('\n')}
</div></main>

<div class="fnav" id="floatingNav"><div class="fnav-menu" id="fnavMenu"><a href="#essentiel" class="fnav-item" data-section="essentiel"><i class="fas fa-bullhorn"></i><span>L’essentiel</span></a><a href="#enjeux" class="fnav-item" data-section="enjeux"><i class="fas fa-landmark"></i><span>Les enjeux</span></a><a href="#nuit" class="fnav-item" data-section="nuit"><i class="fas fa-moon"></i><span>La nuit</span></a><a href="#histoire" class="fnav-item" data-section="histoire"><i class="fas fa-clock-rotate-left"></i><span>L’histoire</span></a><a href="#bilan" class="fnav-item" data-section="bilan"><i class="fas fa-list-check"></i><span>Nos achats</span></a><a href="#trade" class="fnav-item" data-section="trade"><i class="fas fa-crosshairs"></i><span>Ce qu’on fait</span></a></div><button class="fnav-btn" id="fnavBtn" type="button" aria-label="Navigation"><i class="fas fa-bars" id="fnavIcon"></i><span class="fnav-btn-label" id="fnavLabel">Menu</span></button></div>
<footer class="article-footer">&copy; 2026 DailyTickers. Clôtures du 2 novembre 2026 ; cotes et contrats à terme relevés le 3 novembre au matin. Ceci n&rsquo;est pas un conseil financier.<br><a href="/" title="Accueil" aria-label="Accueil"><i class="fas fa-house"></i></a></footer>
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
fs.writeFileSync(path.join(DIR, '_data/chart-data.json'), JSON.stringify({ reference_close: REF, previous_close: PREV, years: YEARS, chart_specs: chartSpecs }, null, 2) + '\n');
fs.writeFileSync(path.join(DIR, '_data/claims.json'), JSON.stringify({ reference_close: REF, article_path: `${REL}/index.html`, article_sha256: articleSha, generated_by: `${REL}/_build.cjs`, literals: [...literals].sort(), claims }, null, 2) + '\n');
console.log(`daily rendu : ${sections.length} sections, ${claims.length} claims, ${literals.size} littéraux, ${(html.length / 1024).toFixed(1)} Ko`);
console.log(JSON.stringify({ counts: { j1: countPos('j1'), p5: countPos('p5'), p21: countPos('p21'), p63: countPos('p63') }, spyAvg21, sectAvg: Object.fromEntries(HS.slice(1).map(s => [s, +sectAvg(s).toFixed(2)])), xlvBeat, xleBeat, sumR, avgRet, toStop: Object.fromEntries(SETUPS.map(x => [x.s, +x.toStop.toFixed(2)])) }));
