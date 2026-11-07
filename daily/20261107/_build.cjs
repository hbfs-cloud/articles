#!/usr/bin/env node
'use strict';

// Daily du samedi 7 novembre 2026 : la séance du vendredi 6 novembre (emploi d'octobre, rebond de la puce
// sans tenue en clôture), notre seuil, la lecture de clôture et nos trois feux verts, le bilan de la semaine, la rotation
// recalculée, et le statut des plans du 31 octobre et du scan du 5 novembre au 6 novembre. Chaque chiffre
// visible dans <main> est un claim lié à un artefact collecté (socle, focus, lots thématiques) ou au
// registre primaire du jour. Les niveaux que nous avons publiés (plans du 31 octobre, scan du 5 novembre,
// seuils des tests et des feux) sont des littéraux relus depuis leur source ; les résultats en % et en R
// sont recalculés ici depuis les barres liées.

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { renderValue } = require('../../tools/validate-content-claims');
const { renderEventTimeline } = require('../../tools/lib/event-timeline.cjs');
const { addUSTradingDays } = require('../../tools/lib/market-calendar.js');

const ROOT = path.resolve(__dirname, '../..');
const REL = 'daily/20261107';
const DIR = path.join(ROOT, REL);
const REF = '2026-11-06';
const D5 = '2026-11-05';
const D4 = '2026-11-04';
const D3 = '2026-11-03';
const D2 = '2026-11-02';
const W0 = '2026-10-30';
const PRIMARY = `${REL}/primary-reference.json`;
const SCAN = 'scanner/20261105/signals.json';

const sources = {
  idx: `${REL}/_data/bars_indices.json`, dia: `${REL}/_data/bars_dia.json`, sec: `${REL}/_data/bars_sectors.json`,
  cry: `${REL}/_data/bars_crypto.json`, off: `${REL}/_data/off_hours.json`, eco: `${REL}/_data/economic_events.json`,
  st: `${REL}/_data/status.json`, opt: `${REL}/_data/options_sentiment.json`,
  fb: `${REL}/_focus/focus_bars.json`, ta: `${REL}/_themes_a/bars_themes.json`, tb: `${REL}/_themes_b/bars_themes.json`,
  tc: `${REL}/_themes_c/bars_themes.json`, td: `${REL}/_themes_d/bars_themes.json`, te: `${REL}/_themes_e/bars_themes.json`
};
const D = Object.fromEntries(Object.entries(sources).map(([k, v]) => [k, JSON.parse(fs.readFileSync(path.join(ROOT, v), 'utf8'))]));
const primary = JSON.parse(fs.readFileSync(path.join(ROOT, PRIMARY), 'utf8'));
const scan = JSON.parse(fs.readFileSync(path.join(ROOT, SCAN), 'utf8'));
const HIST = JSON.parse(fs.readFileSync(path.join(ROOT, 'daily/20261106/_hist/qqq_minus5_days.json'), 'utf8'));
const QBARS = JSON.parse(fs.readFileSync(path.join(ROOT, 'daily/20261106/_hist/qqq_bars_adjusted.json'), 'utf8'));
const notifClose = fs.readFileSync(path.join(DIR, '_hist/notif-20261106-2238.html'), 'utf8');
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
function registryClaim(file, obj, pointer, render, stem, authority) {
  const value = pointer.slice(1).split('/').reduce((n, k) => n[k], obj);
  if (value === undefined || !obj.sources[authority]) throw new Error(`registre ${file} ${pointer}`);
  const rendered = renderValue(value, render);
  if (rendered == null) throw new Error(`rendu registre ${pointer}`);
  const id = `${stem}_${++seq}`.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  claims.push({ id, rendered_text: rendered, source_artifact: file, source_sha256: digest(file), source_pointer: pointer, source_value: value, render, authority });
  return `<span data-claim="${id}">${rendered}</span>`;
}
const reg = (ptr, render, stem, auth) => registryClaim(PRIMARY, primary, ptr, render, stem, auth);
const fr = (decimals, suffix = '', sign) => ({ scale: 1, decimals, suffix, format: 'fr', ...(sign ? { sign: 'always' } : {}) });
const pct = (decimals = 1) => ({ scale: 100, decimals, suffix: ' %', format: 'fr' });
const dateR = parts => ({ format: 'fr_date', parts });
const timeR = zone => ({ format: 'fr_time', zone });
const frNum = (v, d) => renderValue(v, fr(d));
const frSigned = (v, d, suffix = ' %') => suffix === ' R' ? `${renderValue(v, fr(d, '', true))} R` : renderValue(v, fr(d, suffix, true));
const usd = v => lit(`${frNum(v, Number.isInteger(v) ? 0 : (String(v).split('.')[1] || '').length)} $`);
const usd2 = v => lit(`${frNum(v, 2)} $`);
const jobs = (k, render, stem, auth = 'bls_empsit_202610') => reg(`/facts/jobs/${k}`, render, stem, auth);
const kjobs = (k, stem, auth) => jobs(k.replace(/_k$/, ''), fr(0), stem, auth);

// ── Barres ───────────────────────────────────────────────────────────────────
const SERIES_KEYS = ['idx', 'dia', 'sec', 'cry', 'fb', 'ta', 'tb', 'tc', 'td', 'te'];
function series(symbol, last = REF) {
  for (const key of SERIES_KEYS) {
    const h = walk(D[key], x => x && x.symbol === symbol && Array.isArray(x.bars) && x.bars.length);
    if (!h) continue;
    const b = h.node.bars;
    if (last && b[b.length - 1][0] !== last) throw new Error(`${symbol}@${key}: dernière barre ${b[b.length - 1][0]}`);
    return { key, ptr: h.ptr, bars: b, symbol };
  }
  throw new Error(`barres ${symbol} absentes`);
}
const idxOf = (s, date) => { const i = s.bars.findIndex(x => x[0] === date); if (i < 0) throw new Error(`${s.symbol} : date ${date} absente`); return i; };
const COL = { open: 1, high: 2, low: 3, close: 4, volume: 5 };
const bar = (sym, date) => { const s = series(sym); return s.bars[idxOf(s, date)]; };
function px(sym, date = REF, col = 'close', decimals = 2, stem = 'px', suffix = ' $') {
  const s = series(sym), i = idxOf(s, date), c = COL[col];
  return claim(s.key, `${s.ptr}/bars/${i}/${c}`, s.bars[i][c], fr(decimals, suffix), `${stem}_${sym}`);
}
function chg(sym, from = D5, to = REF, decimals = 1, stem = 'chg') {
  const s = series(sym), i = idxOf(s, to), j = idxOf(s, from);
  const value = (s.bars[i][4] / s.bars[j][4] - 1) * 100;
  return claim(s.key, `${s.ptr}/bars/${i}/4`, s.bars[i][4], fr(decimals, ' %', true), `${stem}_${sym}`,
    { operation: 'ratio_pct', numerator_pointer: `${s.ptr}/bars/${i}/4`, denominator_pointer: `${s.ptr}/bars/${j}/4`, result: value });
}
function ocPct(sym, date = REF, stem = 'oc') {
  const s = series(sym), i = idxOf(s, date);
  return claim(s.key, `${s.ptr}/bars/${i}/4`, s.bars[i][4], fr(1, ' %', true), `${stem}_${sym}`,
    { operation: 'ratio_pct_open_to_close', numerator_pointer: `${s.ptr}/bars/${i}/4`, denominator_pointer: `${s.ptr}/bars/${i}/1`, result: (s.bars[i][4] / s.bars[i][1] - 1) * 100 });
}
const volM = (sym, date, stem) => { const s = series(sym), i = idxOf(s, date); return claim(s.key, `${s.ptr}/bars/${i}/5`, s.bars[i][5], { scale: 1e-6, decimals: 0, format: 'fr' }, `${stem}_${sym}`); };
const chgV = (sym, from = D5, to = REF) => { const s = series(sym); return (s.bars[idxOf(s, to)][4] / s.bars[idxOf(s, from)][4] - 1) * 100; };
function volx(sym, date, window, stem = 'volx') {
  const s = series(sym), i = idxOf(s, date);
  const first = i - window; if (first < 0) throw new Error(`${sym} : fenêtre de volume trop courte`);
  const mean = s.bars.slice(first, i).reduce((t, b) => t + b[5], 0) / window;
  return claim(s.key, `${s.ptr}/bars/${i}/5`, s.bars[i][5], fr(1, ' fois'), `${stem}_${sym}`,
    { operation: 'ratio_to_mean', numerator_pointer: `${s.ptr}/bars/${i}/5`, window, offset: 1, result: s.bars[i][5] / mean });
}
const bdate = (sym, date, parts = 'weekday_day_month', stem = 'd') => { const s = series(sym), i = idxOf(s, date); return claim(s.key, `${s.ptr}/bars/${i}/0`, s.bars[i][0], dateR(parts), `${stem}_${sym}`); };
const dir = v => (v >= 0 ? 'up' : 'down');
// Place de la clôture dans la séance : 0 = plus-bas, 1 = plus-haut. Calcul local, publié en pourcentage.
const rangePos = (sym, date = REF) => { const b = bar(sym, date); return (b[4] - b[3]) / (b[2] - b[3]); };
const posTxt = (sym, date = REF) => lit(`${frNum(rangePos(sym, date) * 100, 0)} %`);

// ── Contexte : volatilité, contrats, cotes, horaires ────────────────────────
const vixPt = sym => { const i = D.opt.items.findIndex(x => x && x.symbol === sym && x.type === 'term_structure_point'); if (i < 0) throw new Error(sym); return { i, node: D.opt.items[i] }; };
const vix9 = vixPt('^VIX9D'), vix30 = vixPt('^VIX'), vix3m = vixPt('^VIX3M');
const vixR = (h, stem) => claim('opt', `/items/${h.i}/level`, h.node.level, fr(2), stem);
if (!String(vix30.node.last_trade_time).startsWith(REF) || !(vix9.node.level > vix30.node.level && vix30.node.level > vix3m.node.level)) throw new Error('courbe du VIX à revoir');
const offObs = (facet, test) => { const f = D.off.facets[facet]; const i = f.observations.findIndex(test); if (i < 0) throw new Error(`hors séance ${facet}`); return { ptr: `/facets/${facet}/observations/${i}`, node: f.observations[i] }; };
const btcLive = offObs('crypto', o => o.canonical_asset === 'BTC');
const fedDec = offObs('predictions', o => /increase interest rates by 25 bps after the December 2026/.test(o.metadata && o.metadata.question || ''));
const offPx = (o, d, stem, suffix = '') => claim('off', `${o.ptr}/price`, o.node.price, fr(d, suffix), stem);
const parisOf = iso => { const p = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso)); return `${p.find(x => x.type === 'hour').value}h${p.find(x => x.type === 'minute').value}`; };
// Horodatage du relevé (précision à la nanoseconde, hors du format horaire des claims) : littéral relu.
const offAt = (o) => lit(parisOf(o.node.observed_at));
const fedR = stem => claim('off', `${fedDec.ptr}/price`, fedDec.node.price, pct(1), stem);
const fedD = stem => claim('off', `${fedDec.ptr}/returns/24h_probability_points`, fedDec.node.returns['24h_probability_points'], { scale: 100, decimals: 0, suffix: ' pts', format: 'fr', sign: 'always' }, stem);
if (!(fedDec.node.returns['24h_probability_points'] > 0.05 && fedDec.node.price > 0.7)) throw new Error('cote de la Fed à revoir');

const econ = (name, day) => hit('eco', x => x && typeof x.name === 'string' && x.name.startsWith(name) && typeof x.event_time === 'string' && x.event_time.slice(0, 10) === day, name);
const cpiEco = econ('Consumer Price Index (CPI)', '2026-11-10');
const bowman = econ('Federal Reserve Discussion - Vice Chair for Supervision Michelle W. Bowman: Community Banking', '2026-11-09');
const bowman2 = hit('eco', x => x && typeof x.name === 'string' && x.name.startsWith('Federal Reserve Speech - Vice Chair for Supervision Michelle W. Bowman: Economic Outlook') && x.event_time === '2026-11-10T15:30:00-05:00', 'Bowman 10 novembre');
const waller = econ('Federal Reserve Speech - Governor Christopher J. Waller', '2026-11-10');
const paris = (h, stem) => claim('eco', `${h.ptr}/event_time`, h.node.event_time, timeR('Europe/Paris'), stem);
const stEq = D.st.operation_readiness.bars_daily_us_equity;
if (stEq.served_completed_end !== REF || stEq.next_complete_available_at !== '2026-11-09T21:30:00Z') throw new Error('statut de la séance inattendu');
const regT = (k, auth, stem) => reg(`/facts/calendar/${k}`, timeR('Europe/Paris'), stem, auth);
const regD = (k, auth, stem) => reg(`/facts/calendar/${k}`, dateR('day_month'), stem, auth);
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const dfull = d => `${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
const dshort = d => lit(`${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`);

// ── La séance du 6 novembre : constats qui gouvernent la prose ──────────────
const SECTORS = ['XLK', 'XLB', 'XLF', 'XLE', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU', 'XLC', 'XLRE'];
const SECT_UP = SECTORS.filter(s => chgV(s) > 0);
if (SECT_UP.slice().sort().join() !== 'XLC,XLI,XLK') throw new Error(`secteurs en hausse : ${SECT_UP.join()}`);
// Rebond de la puce, mais clôtures dans le bas de la séance pour les grands indices et les leaders.
if (!(rangePos('QQQ') < 0.25 && rangePos('SPY') < 0.15 && rangePos('IWM') > 0.75 && rangePos('NVDA') < 0.2 && rangePos('SMH') < 0.5)) throw new Error('place des clôtures à revoir');
if (!(chgV('SMH') > 3 && chgV('QQQ') > 1 && chgV('DIA') < 0 && chgV('RSP') < 0 && chgV('XLP') < -1 && chgV('SPLV') < 0)) throw new Error('lecture de la séance à revoir');
const GEANTS = ['AMZN', 'BRK-B', 'GOOGL', 'MSFT', 'AAPL', 'META', 'TSM', 'NVDA', 'AVGO', 'TSLA', 'MU', 'SNDK', 'AMD', 'INTC', 'CRWV'];
if (!(chgV('TSLA') > 4 && ['AAPL', 'MSFT', 'AMZN'].every(x => chgV(x) < 0))) throw new Error('géants du vendredi');
const CHIPS = ['AMD', 'INTC', 'TSM', 'CRWV', 'MU', 'SNDK', 'NVDA'];
// La hausse s'est faite à l'ouverture : SMH ouvre près de son plus-haut puis finit sous son ouverture.
{ const b = bar('SMH', REF); if (!((b[2] - b[1]) / b[1] < 0.01 && b[4] < b[1] && bar('NVDA', REF)[4] < bar('NVDA', REF)[1] && bar('SNDK', REF)[4] < bar('SNDK', REF)[1])) throw new Error('hausse à l’ouverture à revoir'); }
if (CHIPS.filter(s => rangePos(s) >= 0.5).sort().join() !== 'AMD,CRWV,INTC,TSM' || CHIPS.filter(s => rangePos(s) < 0.5).sort().join() !== 'MU,NVDA,SNDK') throw new Error('puces : haut et bas de séance');
if (!(rangePos('XLV') > 0.75 && bar('SPY', REF)[5] < 0.5 * bar('SPY', D5)[5])) throw new Error('santé ou volume du SPY');
if (!(chgV('XLP', D4, D5) < 0 && chgV('SPLV', D4, D5) < 0)) throw new Error('refuges jeudi');
if (!(chgV('USO', D2, D2) === 0 && chgV('USO', W0, D2) < -6 && chgV('USO', D3, D4) < -7)) throw new Error('pétrole lundi et mercredi');
if (!(Math.abs(chgV('TLT')) < 0.05)) throw new Error('TLT vendredi');
if (!(bar('USO', REF)[4] < bar('USO', D3)[4] && bar('HCA', REF)[4] > 492.12 && bar('PHM', REF)[4] > 131.58 && bar('HCA', D5)[4] > 492.12 && bar('PHM', D5)[4] > 131.58)) throw new Error('invalidation du 5 novembre');
if (!(bar('RSP', REF)[4] > bar('RSP', REF)[1] && bar('IWM', REF)[4] > bar('IWM', REF)[1])) throw new Error('RSP et IWM au-dessus de leur ouverture');
for (const s of CHIPS) if (!(chgV(s) > 2)) throw new Error(`${s} n'a pas rebondi`);
// Cinq séances : du vendredi 30 octobre au vendredi 6 novembre.
const W = s => chgV(s, W0, REF);
if (!(W('SPY') < -2.5 && W('QQQ') < -4.5 && W('XLE') < -11 && W('XLK') < -8 && W('XLC') > 4 && W('AMZN') > 7 && W('BRK-B') > 5 && W('SNDK') < -25 && W('MU') < -20)) throw new Error('bilan de la semaine à revoir');
const SECT_W = SECTORS.slice().sort((a, b) => W(b) - W(a));
if (SECT_W[0] !== 'XLC' || SECT_W[SECT_W.length - 1] !== 'XLE' || SECT_W[SECT_W.length - 2] !== 'XLK') throw new Error('classement hebdomadaire des secteurs');

// ── Les deux tests et les trois feux verts (définitions publiées le 6 novembre) ─
const TEST1 = 478, TH1 = 137.10;
const smhC = bar('SMH', REF)[4], qPos = rangePos('QQQ');
const test1 = smhC > TEST1, test2 = qPos >= 0.5;
const r5 = s => chgV(s, W0, REF);
const light1 = bar('SPHB', REF)[4] > TH1;
const gap2 = r5('SPY') - r5('RSP'), light2 = gap2 > 0;
const light3 = r5('EWY') > 0 && r5('EWT') > 0;
const LIGHTS = [light1, light2, light3].filter(Boolean).length;
// Effet de fenêtre : le 12 novembre, la séance du 5 sort du calcul. Depuis la clôture du 5, mesures déjà positives.
const since5gap = chgV('SPY') - chgV('RSP');
if (!(Math.abs(chgV('EWY') - 4) < 0.5 && Math.abs(chgV('EWT') - 4) < 0.5)) throw new Error('Corée et Taïwan vers +4 %');
if (!(chgV('EWY') > 0 && chgV('EWT') > 0 && since5gap > 0 && addUSTradingDays(REF, 4) === '2026-11-12')) throw new Error('effet de fenêtre des feux');
if (test1 || test2 || LIGHTS !== 0) throw new Error('tests ou feux : la décision publiée ne tient plus');
if (!/Ce qu'on fait lundi<\/b>\nOn reste en cash\. Rien à acheter\./.test(notifClose)) throw new Error('notification de clôture : décision absente');
// La notification de vendredi soir citait SPHB à 128,37 $, relevé avant la consolidation nocturne des cours.
if (!notifClose.includes('SPHB : 128,37 $') || !notifClose.includes('5 séances : −1,6 pt') || !notifClose.includes('Taïwan −11,8 %')) throw new Error('notification de clôture : chiffres corrigés');
const sphbRevision = bar('SPHB', REF)[4] - 128.37;
if (bar('IGV', D5)[3] !== 98.5 || bar('XLB', D5)[3] !== 51.89) throw new Error('plus-bas consolidés du 5 novembre');
if (!(sphbRevision > 0.05 && sphbRevision < 0.2)) throw new Error('écart SPHB avec la notification');
// Série des feux sur un mois : écart SPY − RSP et plus faible des deux pays, sur cinq séances glissantes.
const spy = series('SPY');
const lightDates = spy.bars.map(b => b[0]).filter(d => d >= '2026-10-26' && d <= REF);
const r5at = (s, d) => { const x = series(s), i = idxOf(x, d); return (x.bars[i][4] / x.bars[i - 5][4] - 1) * 100; };
const lightSeries = lightDates.map(d => ({ d, gap: +(r5at('SPY', d) - r5at('RSP', d)).toFixed(2), asia: +Math.min(r5at('EWY', d), r5at('EWT', d)).toFixed(2), sphb: bar('SPHB', d)[4] }));
if (lightSeries.filter(x => x.d >= W0).some(x => x.gap > 0 || x.asia > 0 || (x.d > D3 && x.sphb > TH1))) throw new Error('feux allumés depuis le 30 octobre');
if (!lightSeries.some(x => x.asia > 0 && x.d < W0)) throw new Error('feu 3 du 29 octobre');

// ── La moyenne des 200 séances du QQQ ───────────────────────────────────────
const raw = QBARS.map(b => b.close).concat([bar('QQQ', D5)[4], bar('QQQ', REF)[4]]);
if (QBARS[QBARS.length - 1].date !== D4 || Math.abs(QBARS[QBARS.length - 1].close - bar('QQQ', D4)[4]) > 0.011) throw new Error('clôture brute du 4 novembre');
const SMA200 = raw.slice(-200).reduce((t, v) => t + v, 0) / 200;
const SMA_TXT = frNum(Math.ceil(SMA200), 0);
if (!(SMA200 > 675 && SMA200 < 690 && bar('QQQ', REF)[4] < SMA200)) throw new Error(`moyenne 200 séances ${SMA200}`);
const H = HIST.stats;
const POST03 = HIST.episodes.filter(e => e.date >= '2003'), POST03_2 = POST03.filter(e => e.second_within_30).length;
if (!(POST03.length === 7 && POST03_2 === 3)) throw new Error('épisodes depuis 2003');

// ── Les plans du 31 octobre, suivis jusqu'au 6 novembre ─────────────────────
const DAYS = [D2, D3, D4, D5, REF];
const SETUPS = [
  ['MSFT', 'Microsoft', 515, 497, 551], ['UNH', 'UnitedHealth', 402, 385, 432], ['CRM', 'Salesforce', 224, 210, 250],
  ['CRWD', 'CrowdStrike', 244, 224, 278], ['JCI', 'Johnson Controls', 146, 138, 160], ['FAST', 'Fastenal', 50.8, 48.9, 54.5],
  ['CNC', 'Centene', 65.8, 61.7, 72.5], ['OKTA', 'Okta', 202, 183, 233], ['IGV', 'ETF logiciel IGV', 103.5, 99, 111.5]
].map(([s, name, entry, stop, target]) => {
  const ser = series(s);
  const x = { s, name, entry, stop, target, ser, status: 'attente' };
  for (const d of DAYS) {
    const i = idxOf(ser, d), [, o, h, l] = ser.bars[i];
    if (x.status === 'attente') {
      if (o <= stop) { x.status = 'annulé'; x.cancelDay = d; break; }
      if (o <= entry) { x.fill = o; x.fillDay = d; x.fillI = i; x.fillAtOpen = true; }
      else if (l <= entry) { x.fill = entry; x.fillDay = d; x.fillI = i; x.fillAtOpen = false; }
      else continue;
      x.status = 'ouverte';
      if (l <= stop) { x.status = 'stop'; x.exit = stop; x.exitDay = d; x.exitI = i; break; }
      if (h >= target) throw new Error(`${s} : cible touchée le jour de l'exécution`);
      continue;
    }
    if (x.status === 'ouverte') {
      const stopHit = l <= stop, targetHit = h >= target;
      if (stopHit && targetHit) throw new Error(`${s} ${d} : stop et cible dans la même séance`);
      if (stopHit) { x.status = 'stop'; x.exit = Math.min(o, stop); x.gap = o < stop; x.exitDay = d; x.exitI = i; break; }
      if (targetHit) { x.status = 'cible'; x.exit = Math.max(o, target); x.gap = o > target; x.exitDay = d; x.exitI = i; break; }
    }
  }
  x.closeI = idxOf(ser, REF); x.close = ser.bars[x.closeI][4];
  if (x.fill !== undefined) {
    x.risk = x.fill - stop;
    const out = x.exit !== undefined ? x.exit : x.close;
    x.ret = (out / x.fill - 1) * 100; x.r = (out - x.fill) / x.risk; x.closed = x.exit !== undefined;
  }
  return x;
});
const S = Object.fromEntries(SETUPS.map(x => [x.s, x]));
const executed = SETUPS.filter(x => x.fill !== undefined), closedL = executed.filter(x => x.closed), openL = executed.filter(x => !x.closed);
const expect = { MSFT: 'cible', UNH: 'ouverte', CRM: 'ouverte', CRWD: 'stop', JCI: 'stop', FAST: 'attente', CNC: 'cible', OKTA: 'stop', IGV: 'stop' };
for (const x of SETUPS) if (x.status !== expect[x.s]) throw new Error(`${x.s} : statut ${x.status}`);
if (SETUPS.some(x => x.gap)) throw new Error('écart d\'ouverture sur une sortie');
const sumR = executed.reduce((t, x) => t + x.r, 0), realizedR = closedL.reduce((t, x) => t + x.r, 0), latentR = openL.reduce((t, x) => t + x.r, 0);
// Règle de clôture : clôture sous le stop = vente à l'ouverture suivante ; une clôture sous le stop le
// 6 novembre laisse une vente à faire lundi, comptée ici à la clôture de vendredi.
for (const x of executed) {
  x.c = { status: 'ouverte' };
  for (let k = DAYS.indexOf(x.fillDay); k < DAYS.length; k++) {
    const d = DAYS[k], i = idxOf(x.ser, d), [, o, h, , c] = x.ser.bars[i];
    if (k > DAYS.indexOf(x.fillDay) && h >= x.target) { x.c = { status: 'cible', exit: Math.max(o, x.target) }; break; }
    if (c <= x.stop) {
      if (k + 1 >= DAYS.length) { x.c = { status: 'à vendre', pending: true }; break; }
      const j = idxOf(x.ser, DAYS[k + 1]);
      x.c = { status: 'stop', exit: x.ser.bars[j][1], exitDay: DAYS[k + 1], exitI: j }; break;
    }
  }
  x.c.r = ((x.c.exit !== undefined ? x.c.exit : x.close) - x.fill) / x.risk;
  x.c.closed = x.c.exit !== undefined;
}
const expectC = { MSFT: 'cible', UNH: 'ouverte', CRM: 'ouverte', CRWD: 'stop', JCI: 'stop', CNC: 'cible', OKTA: 'stop', IGV: 'à vendre' };
for (const x of executed) if (x.c.status !== expectC[x.s]) throw new Error(`${x.s} : statut clôture ${x.c.status}`);
for (const s of ['CRWD', 'JCI', 'OKTA']) if (S[s].c.exitDay !== REF) throw new Error(`${s} : vente de la règle de clôture`);
const sumRc = executed.reduce((t, x) => t + x.c.r, 0), realizedRc = executed.filter(x => x.c.closed).reduce((t, x) => t + x.c.r, 0);
if (!(S.CRWD.c.r > -1 && S.JCI.c.r < -1 && S.OKTA.c.r < -1)) throw new Error('ventes de la règle de clôture');
if (!(sumR > sumRc)) throw new Error('le stop posé devait faire mieux que la règle de clôture');
const END31 = addUSTradingDays(D2, 12);
if (END31 !== '2026-11-18') throw new Error(`fin des lignes du 31 octobre : ${END31}`);
const END31_TXT = dfull(END31);
const igvBelow = S.IGV.stop - S.IGV.close;
if (!(igvBelow > 0 && igvBelow < 0.2)) throw new Error('IGV sous son stop');
const crmAbove = bar('CRM', REF)[3] - S.CRM.stop;
if (!(crmAbove > 0 && crmAbove < 1.5)) throw new Error('Salesforce près de son stop');

// ── Le scan du 5 novembre : la séance de vendredi ───────────────────────────
// Règles publiées : stop posé dès l'achat ; clôture sous l'invalidation = vente à l'ouverture suivante.
// Une ouverture sous le stop sort au premier cours, l'ouverture, plus bas que le stop.
const SHORT = { XLB: 'Fonds des matériaux', XLP: 'Fonds de la consommation de base' };
const LINES = scan.signals.map(sig => {
  const b5 = bar(sig.ticker, D5), b6 = bar(sig.ticker, REF), w = bar(sig.ticker, D4);
  if (Math.abs(w[4] - sig.entry) > 0.006) throw new Error(`${sig.ticker} : entrée ≠ clôture du 4 novembre`);
  const x = { ...sig, fill: sig.entry, risk: sig.entry - sig.stop };
  if (b5[3] <= sig.stop) { x.state = 'stop'; x.exit = sig.stop; x.exitDay = D5; }
  else if (b5[4] < sig.invalidation_level) throw new Error(`${sig.ticker} : invalidation le 5 novembre`);
  else {
    const [, o, h, l, c] = b6;
    if (h >= sig.tp1) throw new Error(`${sig.ticker} : objectif touché vendredi`);
    if (o <= sig.stop) { x.state = 'stop'; x.exit = o; x.gap = true; x.exitDay = REF; }
    else if (l <= sig.stop) { x.state = 'stop'; x.exit = sig.stop; x.exitDay = REF; }
    else x.state = c < sig.invalidation_level ? 'à vendre' : 'ouverte';
  }
  x.c = bar(sig.ticker, REF)[4];
  x.r = ((x.exit !== undefined ? x.exit : x.c) - x.fill) / x.risk;
  if (x.gap) x.slip = (sig.stop - x.exit) / x.risk;
  return x;
});
const SL = Object.fromEntries(LINES.map(x => [x.ticker, x]));
const expectS = { HCA: 'ouverte', PHM: 'ouverte', ADSK: 'ouverte', CP: 'stop', TRV: 'stop', NKE: 'stop', XLB: 'stop', XLP: 'stop' };
for (const x of LINES) if (x.state !== expectS[x.ticker]) throw new Error(`${x.ticker} : ${x.state}`);
const GAPPED = LINES.filter(x => x.gap).map(x => x.ticker);
if (GAPPED.join() !== 'TRV,NKE,XLP') throw new Error(`ouvertures sous le stop : ${GAPPED.join()}`);
const scanR = LINES.reduce((t, x) => t + x.r, 0);
const slipR = LINES.filter(x => x.gap).reduce((t, x) => t + x.slip, 0);
const openS = LINES.filter(x => x.state === 'ouverte').map(x => ({ ...x, margin: x.c - x.invalidation_level })).sort((a, b) => a.margin / a.c - b.margin / b.c);
if (openS.map(x => x.ticker).join() !== 'HCA,PHM,ADSK' || !(openS[0].margin / openS[0].c < 0.01 && openS[1].margin / openS[1].c < 0.01)) throw new Error('lignes les plus proches de leur invalidation');
const END5 = addUSTradingDays(D5, 9);
if (END5 !== '2026-11-18') throw new Error(`sortie forcée du scan : ${END5}`);

// ── Rotation : instantané du 6 novembre ─────────────────────────────────────
const RO_PATH = path.join(DIR, 'rotation-indices.json');
const RO = fs.existsSync(RO_PATH) ? JSON.parse(fs.readFileSync(RO_PATH, 'utf8')) : null;
if (RO && (RO.asof !== REF || RO.event.base !== D3)) throw new Error('instantané de rotation désaligné');
let ROT = null;
if (RO) {
  const sp = RO.indices.sp500, st = k => sp.dims.style.find(g => g.key === k).ret, vq = k => sp.dims.vol.find(g => g.key === k).ret;
  const secBy = w => sp.dims.sector.slice().sort((a, b) => b.ret[w].cw - a.ret[w].cw).map(g => g.key);
  const regionBy = w => RO.etfs.filter(e => e.kind === 'region' && !['SPY', 'DIA', 'QQQ', 'IWM'].includes(e.symbol)).sort((a, b) => a.ret[w] - b.ret[w]).map(e => e.symbol);
  const checks = {
    cw_below_ew_event: sp.total.ret.event.cw < sp.total.ret.event.ew,
    defensive_first_growth_last_event: st('defensive').event.cw > 0 && st('growth').event.cw < st('cyclical').event.cw,
    q5_worst_q1_flat_ew_event: ['q1', 'q2', 'q3', 'q4'].every(k => vq('q5').event.ew < vq(k).event.ew) && Math.abs(vq('q1').event.ew) < 0.5,
    nvda_first_drag_event: sp.contributors.event.bottom[0].s === 'NVDA',
    aapl_amzn_msft_top_event: sp.contributors.event.top.slice(0, 3).map(x => x.s).join() === 'AAPL,AMZN,MSFT',
    comm_staples_first_event: secBy('event').slice(0, 2).join() === 'communication_services,consumer_staples',
    energy_tech_ind_last_event: secBy('event').slice(-3).sort().join() === 'energy,industrials,technology',
    korea_taiwan_worst_event: regionBy('event').slice(0, 2).sort().join() === 'EWT,EWY',
    china_best_event: regionBy('event').slice(-1)[0] === 'MCHI'
  };
  const bad = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  if (bad.length) throw new Error(`prose de rotation contredite par l'instantané : ${bad.join(', ')}`);
  ROT = { sp };
}

// ── Mise en page ─────────────────────────────────────────────────────────────
const section = (id, kicker, title, pillHtml, status, body) => `<section id="${id}" class="section-shell" data-status="${status}"><div class="section-head"><div><div class="section-kicker">${kicker}</div><h2>${title}</h2></div>${pillHtml}</div>${body}</section>`;
const pill = (t, cls = '') => `<span class="status-pill${cls ? ' ' + cls : ''}">${t}</span>`;
const table = (head, rows, cls = 'data-table') => `<div class="table-scroll"><table class="${cls}"><thead><tr>${head.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const dash = (label, value, move, note, d) => `<article class="dash-card"><div class="dash-label">${label}</div><div class="dash-value">${value}</div><div class="dash-move ${d}">${move}</div><div class="dash-note">${note}</div></article>`;
const verdict = (t, cls) => `<span class="verdict ${cls}">${t}</span>`;
const sections = [];
const refDay = (stem, parts = 'weekday_day_month') => bdate('SPY', REF, parts, stem);
const bp = (x, i, col, stem) => {
  const v = x.ser.bars[i][col], half = Math.round(v * 100 + 1e-7) / 100;
  if (renderValue(v, fr(2)) !== renderValue(half, fr(2))) return usd(half);
  return claim(x.ser.key, `${x.ser.ptr}/bars/${i}/${col}`, v, fr(2, ' $'), `${stem}_${x.s}`);
};

// 1. L'essentiel
sections.push(`<section id="alerte" class="decision-strip" data-status="validated">`
  + `<article class="decision-card primary"><div class="decision-kicker">Décision</div><h2>Les puces ont rebondi vendredi sans tenir jusqu’au soir : aucun nouvel achat lundi, les lignes ouvertes gardent leurs stops et invalidations</h2>`
  + `<p>Après la chute de jeudi, les semi-conducteurs (SMH) ont fini à ${chg('SMH', D5, REF, 1, 'smh_a')} et le Nasdaq-100 (QQQ) à ${chg('QQQ', D5, REF, 1, 'qqq_a')}. Mais la hausse s’est faite dès l’ouverture, puis les géants de la tech et la puce en ont rendu une partie en séance : le QQQ, monté jusqu’à ${px('QQQ', REF, 'high', 2, 'qqq_hi')}, a fini à ${posTxt('QQQ')} de sa fourchette du jour, près de son plus-bas, et le S&amp;P 500 (SPY, ${chg('SPY', D5, REF, 1, 'spy_a')}) à ${posTxt('SPY')}. L’emploi d’octobre, bien plus fort que prévu (${kjobs('payrolls_k', 'nfp_a')} créations contre ${kjobs('consensus_payrolls_k', 'nfp_ca', 'cnbc_jobs_20261106')} attendues selon le consensus Dow Jones cité par CNBC), rapproche une hausse des taux en décembre, sans avoir fait rechuter la Bourse.</p>`
  + `<p><strong>Ce qu’on fait lundi.</strong> Aucun nouvel achat : le seuil de SMH est raté et aucun de nos trois feux verts n’est allumé. Nous retirons aussi l’ordre d’achat Fastenal du ${lit('31 octobre')} à ${usd2(50.8)}, jamais servi : pas d’achat avant le test de mercredi soir, décrit dans notre <a href="/weekly/20261109/">hebdo de la semaine du 9 novembre</a>. Les lignes encore ouvertes gardent leurs niveaux :</p>`
  + `<ul class="checklist">`
  + `<li><i class="fas fa-shield-halved"></i><div><strong>Plans du ${lit('31 octobre')}.</strong><br>UnitedHealth, stop ${usd(S.UNH.stop)} ; Salesforce, stop ${usd(S.CRM.stop)}, passé à ${lit(frNum(crmAbove, 2) + ' $')} de son stop vendredi. L’ETF logiciel IGV est sorti à son stop le ${lit('5 novembre')} si le stop était posé ; avec la règle de clôture (une clôture sous le stop fait vendre à l’ouverture suivante), il se vend lundi par un ordre au marché passé avant ${lit('15h30')}, heure de Paris.</div></li>`
  + `<li><i class="fas fa-list-check"></i><div><strong>Scan du ${lit('5 novembre')}.</strong><br>HCA : stop ${usd2(SL.HCA.stop)}, clôture d’invalidation ${usd2(SL.HCA.invalidation_level)}. PulteGroup : stop ${usd2(SL.PHM.stop)}, invalidation ${usd2(SL.PHM.invalidation_level)}. Autodesk : stop ${usd2(SL.ADSK.stop)}, invalidation ${usd2(SL.ADSK.invalidation_level)}.</div></li>`
  + `</ul></article>`
  + `<article class="decision-card">${pill('NOS REPÈRES', 'risk')}<h3>Un seuil raté, zéro feu vert sur trois</h3><p>Il fallait un SMH au-dessus de ${usd(TEST1)} à la clôture : il a fini à ${px('SMH', REF, 'close', 2, 'smh_t')}. La lecture de clôture du QQQ, à ${posTxt('QQQ')} de sa fourchette, va dans le même sens. Les trois feux restent éteints ; nous les relèverons officiellement vendredi ${lit('13 novembre')} à la clôture.</p></article>`
  + `<article class="decision-card">${pill('NOS LIGNES', 'partial')}<h3>Quatre stops de plus vendredi, dont trois sous le prix prévu</h3><p>Travelers, Nike et le fonds de la consommation de base (XLP) ont ouvert sous leur stop : la vente s’est faite au premier cours, plus bas. Canadian Pacific a touché le sien dans la séance. Total du scan : ${lit(frSigned(scanR, 2, ' R'))}. R mesure le résultat en pertes prévues : ${lit('−1 R')}, c’est une ligne perdue jusqu’à son stop.</p></article>`
  + `</section>`);

// 2. Tableau de bord
const moveList = ['DIA', 'SPY', 'RSP', 'IWM', 'QQQ', 'SMH', 'XLK', 'XLC', 'XLI', 'XLE', 'XLV', 'XLY', 'XLU', 'XLF', 'XLRE', 'XLB', 'XLP', 'TLT', 'GLD', 'USO', 'SPHB', 'SPLV', 'EWY', 'EWT', 'FEZ'];
const LABEL = { DIA: 'Dow Jones (DIA)', SPY: 'S&P 500 (SPY)', RSP: 'S&P 500 équipondéré (RSP)', IWM: 'Petites valeurs (IWM)', QQQ: 'Nasdaq-100 (QQQ)', SMH: 'Semi-conducteurs (SMH)', XLK: 'Technologie (XLK)', XLI: 'Industrie (XLI)', XLY: 'Conso. discrétionnaire (XLY)', XLE: 'Énergie (XLE)', XLB: 'Matériaux (XLB)', XLF: 'Finance (XLF)', XLV: 'Santé (XLV)', XLRE: 'Immobilier (XLRE)', XLP: 'Conso. de base (XLP)', XLU: 'Services publics (XLU)', XLC: 'Communication (XLC)', TLT: 'Obligations 20 ans (TLT)', GLD: 'Or (GLD)', USO: 'Pétrole (USO)', SPHB: 'Actions à bêta élevé (SPHB)', SPLV: 'Actions peu volatiles (SPLV)', EWY: 'Corée (EWY)', EWT: 'Taïwan (EWT)', FEZ: 'Euro Stoxx 50 (FEZ)' };
const moveData = moveList.map(s => ({ label: LABEL[s], v: +chgV(s).toFixed(2), w: +W(s).toFixed(2) }));
sections.push(section('dashboard', 'Le tableau', 'Vendredi 6 novembre : la puce rebondit, la défense recule', pill('VALIDÉ'), 'validated',
  `<div class="dashboard-grid">`
  + dash('Nasdaq-100 (QQQ)', px('QQQ', REF, 'close', 2, 'qqq_px'), chg('QQQ', D5, REF, 2, 'qqq_d'), `semaine : ${chg('QQQ', W0, REF, 1, 'qqq_w')}`, 'up')
  + dash('S&amp;P 500 (SPY)', px('SPY', REF, 'close', 2, 'spy_px'), chg('SPY', D5, REF, 2, 'spy_d'), `semaine : ${chg('SPY', W0, REF, 1, 'spy_w')}`, 'up')
  + dash('Dow Jones (DIA)', px('DIA', REF, 'close', 2, 'dia_px'), chg('DIA', D5, REF, 2, 'dia_d'), `semaine : ${chg('DIA', W0, REF, 1, 'dia_w')}`, 'down')
  + dash('Semi-conducteurs (SMH)', px('SMH', REF, 'close', 2, 'smh_px'), chg('SMH', D5, REF, 2, 'smh_d'), `semaine : ${chg('SMH', W0, REF, 1, 'smh_w')}`, 'up')
  + dash('Volatilité à 30 jours (VIX)', vixR(vix30, 'vix_a'), `à ${lit('9 jours')} : ${vixR(vix9, 'vix9_b')}`, 'la peur à 9 jours dépasse celle à 30 jours', 'down')
  + dash('Pétrole (USO)', px('USO', REF, 'close', 2, 'uso_px'), chg('USO', D5, REF, 1, 'uso_d'), `semaine : ${chg('USO', W0, REF, 1, 'uso_w')}`, dir(chgV('USO')))
  + dash('Or (GLD)', px('GLD', REF, 'close', 2, 'gld_px'), chg('GLD', D5, REF, 1, 'gld_d'), `semaine : ${chg('GLD', W0, REF, 1, 'gld_w')}`, dir(chgV('GLD')))
  + dash('Bitcoin', px('BTC-USD', REF, 'close', 0, 'btc_px'), chg('BTC-USD', D5, REF, 1, 'btc_d'), 'bougie UTC du 6 novembre', dir(chgV('BTC-USD')))
  + `</div>`
  + `<div id="movesChart" class="echart-box" role="img" aria-label="Variation de chaque indice, secteur et fonds le vendredi 6 novembre et sur la semaine du 2 au 6 novembre, en pourcentage" style="width:100%; height:720px; margin-top:1rem;"></div>`
  + `<p class="provenance">Variations de la clôture du ${bdate('SPY', D5, 'weekday_day_month', 'prev_c')} à celle du ${refDay('ref_c')} ; semaine : depuis la clôture du ${bdate('SPY', W0, 'weekday_day_month', 'w0_c')}. Cours vérifiés. Volatilité : clôtures de vendredi des indices VIX à ${lit('9 jours')} et ${lit('30 jours')}.</p>`));

// 3. La séance
const chipRows = CHIPS.map(s => [`<strong>${{ AMD: 'AMD', INTC: 'Intel', TSM: 'TSMC', CRWV: 'CoreWeave', MU: 'Micron', SNDK: 'Sandisk', NVDA: 'Nvidia' }[s]}</strong>`, chg(s, D5, REF, 1, 'cr'), posTxt(s), chg(s, W0, REF, 1, 'crw'), volx(s, REF, 10, 'crv')]);
sections.push(section('seance', 'La séance', 'La puce a ouvert en hausse, le Nasdaq-100 et Nvidia ont fini près de leurs plus-bas', pill('MESURÉ'), 'validated',
  `<p class="section-intro">L’emploi d’octobre est tombé à ${lit('14h30')}, heure de Paris : ${kjobs('payrolls_k', 'nfp_s')} créations de postes selon le Bureau des statistiques du travail, pour ${kjobs('consensus_payrolls_k', 'nfp_cs', 'cnbc_jobs_20261106')} attendues. Le chômage est à ${jobs('unemployment_pct', fr(1, ' %'), 'unr')}, quasi stable selon le Bureau (${jobs('consensus_unemployment_pct', fr(1, ' %'), 'unr_c', 'cnbc_jobs_20261106')} attendu), le salaire horaire progresse de ${jobs('ahe_yoy_pct', fr(1, ' %'), 'ahe')} sur un an (${jobs('consensus_ahe_yoy_pct', fr(1, ' %'), 'ahe_c', 'cnbc_jobs_20261106')} attendu), et août et septembre sont révisés de ${kjobs('revisions_total_k', 'rev')} emplois à la hausse. Un marché du travail qui reste solide rapproche une hausse des taux en décembre : sur Polymarket, la hausse d’un quart de point en décembre cote ${fedR('fed_s')} ce samedi matin, ${fedD('fed_sd')} en ${lit('24 heures')}. Le dix ans américain a légèrement remonté, après un plus-bas depuis le ${lit('9 septembre')} dans la nuit (Reuters) ; le fonds des obligations à vingt ans (TLT) a fini à ${chg('TLT', D5, REF, 2, 'tlt_s')}. Selon Reuters, l’emploi a été éclipsé par la tech, encore secouée par la crainte d’une régulation de l’IA née des victoires démocrates ; vendredi, la gouverneure élue du Texas a annoncé de nouvelles lois sur les centres de données.</p>`
  + `<p class="section-intro">La puce a pourtant rebondi : ${chg('SMH', D5, REF, 1, 'smh_s')} pour le fonds des semi-conducteurs (SMH). Les plus fortes hausses ont tenu : AMD, Intel, TSMC et CoreWeave ont fini dans la moitié haute de leur séance. Nvidia (${posTxt('NVDA')} de sa fourchette), Sandisk (${posTxt('SNDK')}) et Micron (${posTxt('MU')}) ont rendu l’essentiel. Les semi-conducteurs (SMH) ont ouvert à ${px('SMH', REF, 'open', 2, 'smh_o')}, presque à leur plus-haut de ${px('SMH', REF, 'high', 2, 'smh_h')}, puis ont fini à ${px('SMH', REF, 'close', 2, 'smh_c')}, soit ${ocPct('SMH', REF, 'smh_oc')} depuis l’ouverture. Et sur la semaine, aucun de ces titres n’a effacé sa chute.</p>`
  + table(['Valeur', 'Vendredi', `Place de la clôture dans la séance (${lit('0 %')} = plus-bas)`, 'Sur la semaine', 'Volume, en multiple de la moyenne de dix séances'], chipRows)
  + `<p class="section-intro">Les valeurs refuges, qui avaient le mieux résisté jeudi sans échapper à la baisse, ont reculé vendredi : consommation de base (XLP) ${chg('XLP', D5, REF, 1, 'xlp_s')}, actions peu volatiles (SPLV) ${chg('SPLV', D5, REF, 1, 'splv_s')}, Dow Jones ${chg('DIA', D5, REF, 1, 'dia_s')}. Seuls ${lit('trois')} secteurs sur ${lit('onze')} ont fini en hausse : technologie, communication et industrie. Le S&amp;P 500 équipondéré (RSP) a fini à ${chg('RSP', D5, REF, 2, 'rsp_s')} : l’action moyenne a baissé. La hausse est venue de la puce et de Tesla (${chg('TSLA', D5, REF, 1, 'g_tsla')}) ; Apple (${chg('AAPL', D5, REF, 1, 'g_aapl')}), Microsoft (${chg('MSFT', D5, REF, 1, 'g_msft')}) et Amazon (${chg('AMZN', D5, REF, 1, 'g_amzn')}) ont fini en baisse. Les petites valeurs (IWM, ${chg('IWM', D5, REF, 1, 'iwm_s')}) ont fini à ${posTxt('IWM')} de leur fourchette, la santé (XLV) à ${posTxt('XLV')}. Le rebond s’est fait avec moitié moins d’échanges : ${volM('SPY', REF, 'spyv6')} millions de parts de SPY vendredi, contre ${volM('SPY', D5, 'spyv5')} millions jeudi.</p>`
  + `<p class="provenance">Emploi : communiqué du ${lit('6 novembre')} du Bureau des statistiques du travail ; attentes : consensus Dow Jones cité par CNBC. L’ordre des prix dans la séance n’est pas mesuré ; seules l’ouverture, les extrêmes et la clôture le sont. Place de la clôture : (clôture − plus-bas) ÷ (plus-haut − plus-bas) de la séance, cours vérifiés du ${refDay('ref_s1')}. Cote Polymarket relevée à ${offAt(fedDec, 'fed_t')}, heure de Paris.</p>`));

// 4. Les tests et les feux
// Relevé officiel des feux (amendement du 7 novembre) : clôture du 13 novembre, 5 séances depuis celle du 6.
const BASE13 = { SPY: bar('SPY', REF)[4], RSP: bar('RSP', REF)[4], EWY: bar('EWY', REF)[4], EWT: bar('EWT', REF)[4] };
if (BASE13.SPY !== 735.29 || BASE13.RSP !== 216.05 || BASE13.EWY !== 137.01 || BASE13.EWT !== 89.24 || addUSTradingDays(REF, 5) !== '2026-11-13') throw new Error('bases du relevé du 13 novembre');
// Le daily du 6 jugeait les signes sur une seule séance : vendredi les aurait allumés (feux 2 et 3).
if (!(chgV('SPY') > chgV('RSP') && chgV('EWY') > 0 && chgV('EWT') > 0)) throw new Error('mesure sur une séance');
const testRows = [
  [`Seuil publié le ${lit('5 novembre')} : SMH clôture au-dessus de ${usd(TEST1)}`, px('SMH', REF, 'close', 2, 't1'), `il fallait ${lit(frSigned((TEST1 / smhC - 1) * 100, 1))}`, verdict('Raté', 'faux')],
  [`Lecture de clôture, publiée vendredi à ${lit('22h38')} : le QQQ finit dans la moitié haute de sa séance`, `${posTxt('QQQ')} de la fourchette (plus-bas ${px('QQQ', REF, 'low', 2, 't2l')}, plus-haut ${px('QQQ', REF, 'high', 2, 't2h')}, clôture ${px('QQQ', REF, 'close', 2, 't2c')})`, `sous le milieu de la fourchette`, verdict('Négative', 'faux')]
];
const lightRows = [
  [`Feu ${lit('1')} : les actions risquées repartent, SPHB (le fonds des ${lit('100')} actions du S&amp;P 500 au bêta le plus élevé) clôture au-dessus de ${usd2(TH1)}`, px('SPHB', REF, 'close', 2, 'l1'), `il faut ${lit(frSigned((TH1 / bar('SPHB', REF)[4] - 1) * 100, 1))}`, verdict('Éteint', 'faux')],
  [`Feu ${lit('2')} : les géants reprennent la main, sur ${lit('5 séances')} SPY fait mieux que RSP`, `SPY ${chg('SPY', W0, REF, 2, 'l2a')}, RSP ${chg('RSP', W0, REF, 2, 'l2b')}`, `SPY en retard de ${lit(frNum(-gap2, 1))} point de pourcentage`, verdict('Éteint', 'faux')],
  [`Feu ${lit('3')} : la Corée et Taïwan se redressent, sur ${lit('5 séances')} EWY et EWT en hausse`, `Corée ${chg('EWY', W0, REF, 1, 'l3a')}, Taïwan ${chg('EWT', W0, REF, 1, 'l3b')}`, `les deux en hausse`, verdict('Éteint', 'faux')]
];
sections.push(section('tests', 'Nos repères', 'Vendredi soir : un seuil raté, zéro feu vert sur trois', pill('MESURÉ', 'risk'), 'validated',
  `<p class="section-intro">Le ${lit('5 novembre')}, nous avions publié un seuil : un SMH au-dessus de ${usd(TEST1)} en clôture nous donnerait tort. Le même jour, nos trois feux verts : quand deux sur trois s’allument, nous levons la prudence. Vendredi soir, notre notification de ${lit('22h38')} y a ajouté une lecture de clôture, la place du QQQ dans sa séance.</p>`
  + table(['Repère de vendredi', 'Clôture', 'Écart', 'Verdict'], testRows)
  + table(['Feu vert', 'Vendredi soir', 'Ce qu’il manque', 'État'], lightRows)
  + `<div id="lightsChart" class="echart-box" role="img" aria-label="Feux verts deux et trois du 26 octobre au 6 novembre : écart sur cinq séances entre SPY et RSP, et plus faible des rendements sur cinq séances de la Corée et de Taïwan, en points ; au-dessus de zéro, le feu s’allume" style="width:100%; height:320px; margin-top:1rem;"></div>`
  + `<p class="section-intro">Une clôture près du plus-bas montre que la hausse n’a pas tenu sur le QQQ et Nvidia ; nous ne savons pas qui a vendu. Le reflux est venu des géants et de la puce : l’action moyenne (RSP) et les petites valeurs (IWM) ont fini au-dessus de leur cours d’ouverture. Notre lecture de clôture est simple : un QQQ qui finit dans la moitié haute de sa séance, au-dessus du milieu entre plus-haut et plus-bas, montre une hausse qui tient. C’est une habitude de lecture, pas une loi.</p>`
  + `<div class="quality-note warning-note"><strong>Notre règle des feux, précisée ce ${lit('7 novembre')}.</strong> La règle des deux feux sur trois date du ${lit('5 novembre')} ; la mesure sur ${lit('5 séances')} a été fixée par nos visuels du ${lit('6 novembre')} à ${lit('10h28')} et ${lit('10h48')}, avant l’ouverture de New York. Notre daily du ${lit('6 novembre')} jugeait encore ces signes sur une seule séance ; sur cette base, vendredi aurait allumé les feux ${lit('2')} et ${lit('3')}. La mesure sur ${lit('5 séances')}, publiée avant la séance, fait foi. À partir de cette édition, le relevé officiel se fait uniquement à la clôture du vendredi ${lit('13 novembre')}, à ${lit('22h00')} heure de Paris, sur les ${lit('5 séances')} depuis la clôture du ${lit('6 novembre')} : SPY ${px('SPY', REF, 'close', 2, 'b_spy')} contre RSP ${px('RSP', REF, 'close', 2, 'b_rsp')} ; EWY ${px('EWY', REF, 'close', 2, 'b_ewy')} et EWT ${px('EWT', REF, 'close', 2, 'b_ewt')} ; SPHB au-dessus de ${usd2(TH1)}. Jeudi ${lit('12 novembre')}, la chute du ${lit('5 novembre')} sortira de la fenêtre glissante : depuis la clôture du ${lit('5')}, la Corée (${chg('EWY', D5, REF, 1, 'win_ewy')}) et Taïwan (${chg('EWT', D5, REF, 1, 'win_ewt')}) montent déjà et SPY devance RSP de ${lit(frNum(since5gap, 1))} point. Les feux ${lit('2')} et ${lit('3')} peuvent donc s’allumer ce jour-là par simple effet de calcul ; un allumage avant le relevé du vendredi ne lève pas la prudence. Cette règle remplace la variante de notre notification du ${lit('5 novembre')} à ${lit('17h03')} (« QQQ au-dessus de ${lit('681 $')} et au moins deux signes ») et la condition de notre daily du ${lit('6 novembre')} (un QQQ qui reclôture au-dessus de sa moyenne des ${lit('200')} séances, vers ${lit('681 $')}).</div>`
  + `<div class="quality-note"><strong>Notre règle pour revenir, commune avec notre <a href="/weekly/20261109/">hebdo de la semaine du 9 novembre</a>.</strong><ul class="checklist"><li><i class="fas fa-1"></i><div><strong>Première tranche.</strong><br>Seulement si mercredi ${lit('11 novembre')} à la clôture (${lit('22h00')}, heure de Paris) le SMH finit au-dessus de ${usd(TEST1)} et le QQQ finit dans la moitié haute de sa séance (clôture au-dessus du milieu entre plus-haut et plus-bas). Achat jeudi ${lit('12 novembre')} entre ${lit('15h45')} et ${lit('17h30')}, heure de Paris (séance européenne de l’ETF UCITS), à cours limité au plus à la clôture de mercredi de l’ETF + ${lit('1 %')}, sans relever la limite. Ordre valable jusqu’à vendredi ${lit('13 novembre')} à ${lit('17h30')}, puis abandonné s’il n’est pas exécuté ; si l’ordre n’est pas servi, on ne court pas après. Si le QQQ clôture sous ${px('QQQ', D5, 'close', 2, 'cut_q12')} jeudi ${lit('12 novembre')}, annulez l’ordre non exécuté avant l’ouverture européenne de vendredi. ${lit('20')} à ${lit('25 %')} de ce qu’on prévoit d’investir, sur un ETF large européen (UCITS) sur le S&amp;P 500 ou l’indice monde, logeable en PEA ou compte-titres, en version filtrée charia si le courtier la propose ; le QQQ et SMH servent seulement de signal. Le détail est dans <a href="/weekly/20261109/">notre hebdo de la semaine du 9 novembre</a>.</div></li><li><i class="fas fa-scissors"></i><div><strong>Coupure.</strong><br>Une clôture du QQQ sous ${px('QQQ', D5, 'close', 2, 'cut_q')} (sa clôture du ${lit('5 novembre')}, ce jour-là au plus-bas de séance) fait vendre la tranche à l’ouverture européenne suivante, à un prix possiblement plus bas. Elle reste en vigueur jusqu’au mercredi ${lit('18 novembre')} inclus, que les feux soient allumés ou non ; l’hebdo du ${lit('16 novembre')} la confirme ou la remplace.</div></li><li><i class="fas fa-2"></i><div><strong>Deuxième tranche, ou première ligne pour qui n’a pas pris la première.</strong><br>Seulement si deux feux sur trois sont allumés au relevé du vendredi ${lit('13 novembre')}. ${lit('20')} à ${lit('25 %')} de ce qu’on prévoit d’investir, sur le même ETF large européen ; achat mercredi ${lit('18 novembre')} entre ${lit('15h45')} et ${lit('17h30')}, ordre limité au plus à la clôture de mardi ${lit('17 novembre')} de l’ETF + ${lit('1 %')}, sans relever la limite, valable ce seul mercredi jusqu’à ${lit('17h30')}, et seulement si à ${lit('15h45')} le QQQ cote au-dessus de ${px('QQQ', D5, 'close', 2, 't2_q')} et ne recule pas de plus de ${lit('2 %')} par rapport à sa clôture du mardi ${lit('17 novembre')}, prise avant les résultats de Nvidia publiés ce soir-là. Sinon, pas d’achat ce jour-là : on attend la suite, et l’hebdo du ${lit('16 novembre')} aura posé le cadre. Ce mercredi cumule deux opérations distinctes : la sortie forcée des lignes du ${lit('31 octobre')} et du scan avant ${lit('21h45')}, et cette tranche possible entre ${lit('15h45')} et ${lit('17h30')} sur l’ETF large.</div></li></ul></div>`
  + `<div class="quality-note"><strong>Correction de chiffres.</strong> Notre notification de vendredi soir donnait SPHB à ${lit('128,37 $')}, l’écart SPY − RSP à ${lit('1,6 pt')} et Taïwan à ${lit('−11,8 %')}, sur des cours relevés avant leur consolidation de la nuit. Cours consolidés : ${px('SPHB', REF, 'close', 2, 'sphb_fix')}, ${lit(frNum(-gap2, 1))} point et ${chg('EWT', W0, REF, 1, 'ewt_fix')}. Notre daily du ${lit('6 novembre')} donnait pour le ${lit('5 novembre')} un plus-bas de ${lit('98,59 $')} pour IGV et de ${lit('51,90 $')} pour XLB ; les barres consolidées disent ${px('IGV', D5, 'low', 2, 'igv_fix')} et ${px('XLB', D5, 'low', 2, 'xlb_fix')}. Aucun verdict ne change.</div>`
  + `<p class="provenance">Seuils : SMH et règle des feux publiés le ${lit('5 novembre')} (notifications et visuels), mesure sur ${lit('5 séances')} fixée par nos visuels du ${lit('6 novembre')} ; lecture du QQQ, notification du ${lit('6 novembre')} à ${lit('22h38')}. Feux ${lit('2')} et ${lit('3')} mesurés de la clôture du ${bdate('SPY', W0, 'weekday_day_month', 'w0_t')} à celle du ${refDay('ref_t')}. Graphique : mêmes mesures, recalculées chaque séance depuis le ${lit('26 octobre')}.</p>`));

// 5. La semaine
const megaRows = [['AMZN', 'Amazon'], ['BRK-B', 'Berkshire Hathaway'], ['GOOGL', 'Alphabet'], ['MSFT', 'Microsoft'], ['AAPL', 'Apple'], ['META', 'Meta'], ['TSM', 'TSMC'], ['NVDA', 'Nvidia'], ['AVGO', 'Broadcom'], ['TSLA', 'Tesla'], ['MU', 'Micron'], ['SNDK', 'Sandisk']]
  .map(([s, n]) => [`<strong>${n}</strong>`, chg(s, W0, REF, 1, 'mw'), px(s, REF, 'close', 2, 'mc')]);
const secW = SECT_W.map(s => [LABEL[s], chg(s, W0, REF, 2, 'sw')]);
sections.push(section('semaine', 'Bilan de la semaine', 'Les géants diversifiés ont tenu, la chaîne des centres de données a plongé', pill('MESURÉ'), 'validated',
  `<p class="section-intro">Du vendredi ${lit('30 octobre')} au vendredi ${lit('6 novembre')}, le S&amp;P 500 (SPY) a fait ${chg('SPY', W0, REF, 1, 'spy_w2')}, sa pire semaine depuis avril 2025 selon 24/7 Wall St., le Nasdaq-100 (QQQ) ${chg('QQQ', W0, REF, 1, 'qqq_w2')}. Le Dow (DIA, ${chg('DIA', W0, REF, 1, 'dia_w2')}) et l’action moyenne (RSP, ${chg('RSP', W0, REF, 1, 'rsp_w2')}) ont nettement moins souffert.</p>`
  + `<p class="section-intro">La semaine a coupé les géants en deux ; c’est notre lecture. Ceux aux activités diversifiées ont tenu : Amazon ${chg('AMZN', W0, REF, 1, 'amzn_w')}, Alphabet ${chg('GOOGL', W0, REF, 1, 'goog_w')}, Microsoft ${chg('MSFT', W0, REF, 1, 'msft_w')}. Tout ce qui dépend du rythme de construction des centres de données a plongé, concepteurs de puces, fabricants de mémoire et loueurs de capacités : Nvidia ${chg('NVDA', W0, REF, 1, 'nvda_w')}, Micron ${chg('MU', W0, REF, 1, 'mu_w')}, Sandisk ${chg('SNDK', W0, REF, 1, 'sndk_w')}, CoreWeave ${chg('CRWV', W0, REF, 1, 'crwv_w2')}. Berkshire Hathaway, qui publie ses résultats ce samedi, a gagné ${chg('BRK-B', W0, REF, 1, 'brk_w')} et touché un record de clôture mercredi selon 24/7 Wall St.</p>`
  + `<div class="two-col"><div>${table(['Valeur', 'Semaine', 'Clôture'], megaRows)}</div><div>${table(['Secteur', 'Semaine'], secW)}</div></div>`
  + `<p class="section-intro">Par secteur, cinq sur onze ont fini la semaine en hausse ; la communication mène et l’énergie ferme la marche, derrière la technologie. Le pétrole (USO) a fait ${chg('USO', W0, REF, 1, 'uso_w2')} sur la semaine, surtout lundi (${chg('USO', W0, D2, 1, 'uso_l')}) et mercredi (${chg('USO', D3, D4, 1, 'uso_m')}). Vendredi, le pétrole a fini quasi stable (USO ${chg('USO', D5, REF, 1, 'uso_v')}) ; Reuters lie ce calme du Brent à l’espoir que le résultat des élections pousse Donald Trump à désamorcer la guerre avec l’Iran. L’or (GLD) a fait ${chg('GLD', W0, REF, 1, 'gld_w2')}.</p>`
  + `<p class="provenance">Variations de clôture à clôture, du ${bdate('SPY', W0, 'weekday_day_month', 'w0_w')} au ${refDay('ref_w')}, cours vérifiés.</p>`));

// 6. La rotation
if (ROT) {
  const rotWin = `<div class="rot-windowbar" role="toolbar" aria-label="Fenêtre de calcul"><span class="rot-windowbar-label">Fenêtre</span><div class="rotation-tabs" id="rotWinTabs"></div></div>`;
  const rotChart = (id, title, aria, h) => `<div class="rotation-chart-block"><div class="rotation-chart-title">${title}</div>${id === 'rotRisk' ? '' : `<div class="rot-controls" id="${id}Ctl"></div>`}<div id="${id}" class="rotation-chart-host rot-auto" role="img" aria-label="${aria}" style="height:${h}px"></div></div>`;
  sections.push(section('rotation-indices', 'La rotation, mise à jour', 'Depuis l’élection, la puce et les titres nerveux restent derrière', pill('MESURÉ'), 'validated',
    `<p class="section-intro">Nous avons recalculé le S&amp;P 500, le Nasdaq-100 et le Dow Jones titre par titre sur les clôtures de vendredi. Le rebond d’une séance n’a pas changé le classement depuis le vote du ${lit('3 novembre')}. L’indice pondéré par les capitalisations recule toujours plus que la moyenne simple de ses titres. Nvidia reste, de loin, la société qui a le plus coûté à l’indice ; Apple, Amazon et Microsoft sont celles qui l’ont le plus soutenu. Par famille, les valeurs défensives montent, la croissance recule le plus. Les titres les plus volatils reculent nettement, les plus calmes sont stables. Par secteur, la communication et la consommation de base mènent ; l’industrie, la technologie et l’énergie ferment la marche.</p><p class="section-intro">Hors des États-Unis, la Corée et Taïwan restent les places les plus touchées depuis l’élection, malgré leur rebond de vendredi, et la Chine (MCHI) est la plus forte.</p>`
    + `<div class="rotation-page rot-embed">${rotWin}<div class="rot-grid-2">`
    + rotChart('rotSect', 'S&amp;P 500 par secteur, pondéré par les capitalisations', 'Course des secteurs du S&amp;P 500, variation cumulée depuis la base de la fenêtre', 360)
    + rotChart('rotPlaces', 'Places boursières (ETF cotés à New York, en dollars)', 'Course des ETF des places boursières, variation cumulée depuis la base de la fenêtre', 560)
    + `</div>` + rotChart('rotRisk', 'Thermomètre du risque : rapports entre ETF, rebasés à zéro à la base', 'Rapports entre ETF de risque, rebasés à la date de base de la fenêtre', 380) + `</div>`
    + `<p class="provenance">Instantané figé des clôtures du ${lit('6 novembre')} (<a href="/daily/20261107/rotation-indices.json">données</a>) : composition actuelle des indices, pondération par la capitalisation de début de fenêtre avec le nombre d’actions actuel, cours hors dividendes. Les places étrangères passent par leur ETF coté à New York, change compris. Thèmes, tailles, volatilité, Nasdaq-100 et Dow Jones : <a href="/rotation/?w=event">page Rotations</a>.</p>`));
}

// 7. Nos prévisions
const prevRows = [
  [`Daily du ${lit('6 novembre')}, « nous aurons tort si » SMH clôture vendredi au-dessus de ${usd(TEST1)}`, `SMH ${px('SMH', REF, 'close', 2, 'pv_smh')}, plus-haut de séance ${px('SMH', REF, 'high', 2, 'pv_smhh')}`, verdict('Pas invalidée', 'vrai')],
  [`Daily du ${lit('6 novembre')}, scénario contraire : « l’emploi ajoute un choc de taux »`, `Emploi à ${kjobs('payrolls_k', 'pv_nfp')} contre ${kjobs('consensus_payrolls_k', 'pv_nfpc', 'cnbc_jobs_20261106')} attendus, hausse de décembre à ${fedR('pv_fed')} sur Polymarket ; mais TLT ${chg('TLT', D5, REF, 2, 'pv_tlt')} et SPY ${chg('SPY', D5, REF, 2, 'pv_spy')}`, verdict('Faux sur le marché : la cause est venue, pas l’effet', 'faux')],
  [`Daily du ${lit('6 novembre')}, « rebond partiel, sans effacer la moitié de la chute »`, `QQQ ${chg('QQQ', D5, REF, 1, 'pv_qqq')} après ${chg('QQQ', D4, D5, 1, 'pv_qqq5')} jeudi ; mais l’emploi n’a pas été modéré`, verdict('Bon résultat, mauvaise raison', 'partiel')],
  [`Daily du ${lit('6 novembre')}, scénario de base : « la puce reste sous pression »`, `SMH ${chg('SMH', D5, REF, 1, 'pv_smh2')}, AMD ${chg('AMD', D5, REF, 1, 'pv_amd')}`, verdict('Faux vendredi', 'faux')],
  [`Daily du ${lit('6 novembre')} : Nike, « la plus fragile » du scan`, `Ouverture à ${px('NKE', REF, 'open', 2, 'pv_nke')}, sous son stop de ${usd2(SL.NKE.stop)}`, verdict('Vrai', 'vrai')],
  [`Daily du ${lit('6 novembre')} : le QQQ sous sa moyenne des ${lit('200')} séances`, `Clôture ${px('QQQ', REF, 'close', 2, 'pv_qqqc')}, moyenne vers ${lit(SMA_TXT + ' $')}`, verdict('Toujours dessous', 'neutre')],
  [`Daily du ${lit('5 novembre')} : « nous changeons d’avis si » USO repasse au-dessus de ${px('USO', D3, 'close', 2, 'pv_uso3')}, ou si HCA et PulteGroup clôturent sous ${usd2(SL.HCA.invalidation_level)} et ${usd2(SL.PHM.invalidation_level)} d’ici vendredi soir`, `USO ${px('USO', REF, 'close', 2, 'pv_uso')}, HCA ${px('HCA', REF, 'close', 2, 'pv_hca')}, PulteGroup ${px('PHM', REF, 'close', 2, 'pv_phm')} : aucun seuil franchi`, verdict('Non invalidée sur le papier, mais seuil mal choisi : la rotation n’a pas protégé le scan, et les refuges ont reculé vendredi', 'partiel')],
  [`Notification de vendredi ${lit('22h38')} : « lundi, on reste en cash »`, `Seuil raté, zéro feu vert`, verdict('Maintenu : aucun nouvel achat', 'vrai')]
];
sections.push(section('previsions', 'Nos prévisions', 'Ce que valaient celles d’hier', pill('MESURÉ', 'risk'), 'partial',
  table(['Ce que nous avons publié', 'Vendredi à la clôture', 'Verdict'], prevRows)
  + `<p class="section-intro">Le contraire de ce que nous redoutions s’est produit sur un point. L’emploi fort a fait monter la cote d’une hausse en décembre, à peine le dix ans, et il n’a pas fait rechuter la puce. Notre scénario de base, une puce sous pression, a eu tort vendredi. Ce n’est pas une bonne nouvelle pour autant : le marché a ignoré un chiffre de taux défavorable une séance, il peut cesser de l’ignorer avant l’inflation de mardi.</p>`));

// 8. Bilan du 31 octobre
const execCell = x => {
  if (x.fill === undefined) return `${verdict('Ordre retiré', 'neutre')} le ${lit('7 novembre')}, jamais servi, compté ${lit('0 R')}`;
  if (x.fillAtOpen) return `${dshort(x.fillDay)} à l’ouverture, ${bp(x, x.fillI, 1, 'fo')}`;
  return `${dshort(x.fillDay)} à ${usd(x.entry)}`;
};
const exitCell = x => {
  if (x.status === 'cible') return `${verdict('Cible', 'vrai')} ${usd(x.target)} le ${dshort(x.exitDay)}`;
  if (x.status === 'stop') return `${verdict('Stop', 'faux')} ${usd(x.stop)} le ${dshort(x.exitDay)} (plus-bas ${bp(x, x.exitI, 3, 'xl')})`;
  if (x.status === 'ouverte') return `${verdict('Ouverte', 'partiel')} · clôture ${bp(x, x.closeI, 4, 'xc')}`;
  return `ordre retiré, jamais servi`;
};
const cCell = x => {
  const r = lit(frSigned(x.c.r, 2, ' R'));
  if (x.c.status === 'à vendre') return `${r} · à vendre lundi (clôture ${bp(x, x.closeI, 4, 'cc')})`;
  if (x.c.status === 'stop') return `${r} · vendue le ${dshort(x.c.exitDay)} à l’ouverture, ${bp(x, x.c.exitI, 1, 'co')}`;
  if (x.c.status === 'ouverte') return `${r} latents · ouverte`;
  return r;
};
const bilanRows = SETUPS.map(x => [`<strong>${x.s}</strong> · ${x.name}`, `${usd(x.entry)} / ${usd(x.stop)} / ${usd(x.target)}`, execCell(x), exitCell(x), x.fill === undefined ? '' : lit(frSigned(x.r, 2, ' R')), x.fill === undefined ? '' : cCell(x)]);
const rData = executed.map(x => ({ s: x.s, v: +x.r.toFixed(2), vc: +x.c.r.toFixed(2), closed: x.closed }));
sections.push(section('bilan', 'Suite du daily du 31 octobre', 'La règle de clôture a vendu plus bas que le stop, sauf CrowdStrike', pill('MESURÉ', 'risk'), 'partial',
  `<p class="section-intro">Mêmes règles que dans nos deux éditions précédentes. Stop posé : un plus-bas sous le stop vaut sortie au stop. Règle de clôture : une clôture sous le stop vaut vente à l’ouverture suivante. Dans les deux cas, un plus-haut au-dessus de la cible vaut vente à la cible.</p>`
  + `<p class="scroll-hint" aria-hidden="true">Faites glisser le tableau →</p>`
  + table(['Titre', 'Entrée / stop / cible', 'Achat', 'Stop posé : état', 'En R, stop posé', 'En R, règle de clôture'], bilanRows)
  + `<div id="bilanChart" class="echart-box" role="img" aria-label="Résultat de chaque plan exécuté du 31 octobre, en multiples du risque prévu, au 6 novembre, selon le stop posé et selon la règle de clôture" style="width:100%; height:320px; margin-top:1rem;"></div>`
  + `<div class="two-col">`
  + `<article class="focus-card"><div class="focus-symbol">Stop posé</div><div class="focus-what">${lit(frSigned(sumR, 2, ' R'))}</div><p>Dont ${lit(frSigned(realizedR, 2, ' R'))} encaissés sur ${lit('six')} lignes soldées (deux cibles, quatre stops) et ${lit(frSigned(latentR, 2, ' R'))} latents sur UnitedHealth et Salesforce. Salesforce est passé à ${lit(frNum(crmAbove, 2) + ' $')} de son stop vendredi, au plus-bas de la séance.</p></article>`
  + `<article class="focus-card"><div class="focus-symbol">Règle de clôture</div><div class="focus-what">${lit(frSigned(sumRc, 2, ' R'))}</div><p>Okta, Johnson Controls et CrowdStrike sont sortis vendredi à l’ouverture, à ${lit(frSigned(S.OKTA.c.r, 2, ' R'))}, ${lit(frSigned(S.JCI.c.r, 2, ' R'))} et ${lit(frSigned(S.CRWD.c.r, 2, ' R'))} : CrowdStrike a rouvert au-dessus de son stop, les deux autres en dessous. L’ETF IGV a clôturé ${lit(frNum(igvBelow, 2) + ' $')} sous son stop : vente lundi à l’ouverture.</p></article>`
  + `</div>`
  + `<div class="quality-note warning-note"><strong>Si vous appliquez la règle de clôture.</strong> IGV se vend lundi à l’ouverture de New York, quel que soit le prix : ordre au marché passé avant ${lit('15h30')}, heure de Paris. UnitedHealth et Salesforce gardent leurs niveaux. Fin de toutes ces lignes le ${lit(END31_TXT)}, avant ${lit('21h45')}, heure de Paris. L’ordre Fastenal, jamais servi, est retiré ce ${lit('7 novembre')}. Les totaux sont calculés sur les valeurs non arrondies. Frais et glissement d’exécution (l’écart entre le prix visé et le prix obtenu) ne sont pas comptés.</div>`));

// 9. Le scan du 5 novembre
const scanState = x => {
  if (x.state === 'stop' && x.gap) return `${verdict('Stop', 'faux')} sortie à l’ouverture du ${dshort(x.exitDay)}, ${px(x.ticker, REF, 'open', 2, 'so')}, sous le stop`;
  if (x.state === 'stop') return `${verdict('Stop', 'faux')} ${usd2(x.stop)} le ${dshort(x.exitDay)} (plus-bas ${px(x.ticker, x.exitDay, 'low', 2, 'sl')})`;
  return `${verdict('Ouverte', 'partiel')} · clôture ${px(x.ticker, REF, 'close', 2, 'sc')}`;
};
const scanRows = LINES.map(x => [`<strong>${x.ticker}</strong> · ${SHORT[x.ticker] || x.name}`, `${usd2(x.entry)} / ${usd2(x.stop)} / ${usd2(x.tp1)}`, usd2(x.invalidation_level), scanState(x), lit(frSigned(x.r, 2, ' R'))]);
const [ph, pq] = openS;
const mPct = x => lit(`${frNum(x.margin / x.c * 100, 1)} %`);
sections.push(section('trade', 'Le scan du 5 novembre', 'Cinq lignes sur huit sorties, trois encore ouvertes', pill('ATTENDRE', 'partial'), 'partial',
  `<p class="section-intro">Les huit lignes avaient été achetées jeudi, le jour de la chute. Vendredi, trois ont ouvert directement sous leur stop : Travelers, Nike et le fonds de la consommation de base. Le stop est alors parti au premier cours, l’ouverture, plus bas que prévu. Canadian Pacific a touché le sien dans la séance. HCA, PulteGroup et Autodesk tiennent.</p>`
  + `<p class="scroll-hint" aria-hidden="true">Faites glisser le tableau →</p>`
  + table(['Ligne', 'Entrée / stop / objectif', 'Invalidation : clôture qui annule l’idée', 'État vendredi soir', 'En R'], scanRows)
  + `<div class="two-col">`
  + `<article class="focus-card"><div class="focus-symbol">Total</div><div class="focus-what">${lit(frSigned(scanR, 2, ' R'))}</div><p>Dont ${lit(frSigned(-slipR, 2, ' R'))} dus aux seules ouvertures sous le stop : c’est ce que la séance a coûté au-delà de la perte prévue. Les trois lignes ouvertes gardent leur stop.</p></article>`
  + `<article class="focus-card"><div class="focus-symbol">Les plus fragiles</div><div class="focus-what">HCA et PulteGroup</div><p>HCA a clôturé à ${px('HCA', REF, 'close', 2, 'hca_c')}, ${mPct(ph)} au-dessus de son invalidation (${usd2(ph.invalidation_level)}) ; PulteGroup à ${px('PHM', REF, 'close', 2, 'phm_c')}, ${mPct(pq)} au-dessus de la sienne (${usd2(pq.invalidation_level)}). Une clôture dessous lundi fait vendre mardi à l’ouverture ; ce jour-là, l’ouverture de ${lit('15h30')} suit l’inflation de ${lit('14h30')}, et le prix de sortie peut être nettement plus bas que l’invalidation.</p></article>`
  + `</div>`
  + `<ul class="checklist">`
  + `<li><i class="fas fa-ban"></i><div><strong>Aucune idée nouvelle lundi.</strong><br>Le seuil de SMH est raté et aucun feu n’est allumé. Nous ne rachetons pas une ligne sortie à son stop vendredi. Prochain rendez-vous : le test de mercredi soir (<a href="/weekly/20261109/">notre hebdo de la semaine du 9 novembre</a>).</div></li>`
  + `<li><i class="fas fa-shield-halved"></i><div><strong>Les stops restent où ils sont.</strong><br>Vendredi l’a montré trois fois : un stop ne garantit pas son prix quand le titre ouvre en dessous. Pour sortir, un stop simple (au marché) s’exécute ; un stop-limite peut ne pas s’exécuter du tout. La sortie forcée du scan reste le ${lit('18 novembre')} : vente au marché avant ${lit('21h45')}, heure de Paris. Ce jour-là, l’ouverture de ${lit('15h30')} suivra les résultats de Nvidia publiés la veille vers ${regT('nvidia_results', 'nvidia_ir_fy27q3', 'nv_t18')} : même risque de trou sous le stop. L’objectif se pose dès l’achat, en ordre de vente à cours limité au prix indiqué.</div></li>`
  + `<li><i class="fas fa-scale-balanced"></i><div><strong>Plafond de risque : ${lit('4 %')} du capital sur l’ensemble.</strong><br>Risque d’une ligne = (cours actuel − stop) × nombre de titres. Additionnez toutes les lignes encore ouvertes, celles du ${lit('31 octobre')} comme celles du scan du ${lit('5 novembre')}. Si ce total dépasse déjà ${lit('4 %')}, n’ajoutez rien. Pour vos prochains achats, à partir de cette édition, comptez ${lit('1,5')} fois l’écart au stop, pour tenir compte des ouvertures sous le stop. Les lignes déjà ouvertes gardent leur plan : stop, invalidation et sortie le ${lit('18 novembre')}.</div></li>`
  + `</ul>`));

// 10. Formation
const ex = SL.TRV;
sections.push(section('formation', 'Formation du jour', 'Le stop qui ne protège pas de l’ouverture', pill('PÉDAGOGIE'), 'validated',
  `<div class="pedagogy-box"><p>Un stop est un ordre qui dort chez le courtier. Il se réveille quand un cours atteint son prix. Si le titre cote toute la séance au-dessus, puis passe dessous, la vente part près du stop. Mais si le titre ouvre directement plus bas, le premier cours qui réveille l’ordre est l’ouverture. La vente part là.</p>`
  + `<p><strong>Vendredi, sur Travelers.</strong> Achat à ${usd2(ex.entry)}, stop à ${usd2(ex.stop)} : un risque prévu de ${lit(frNum(ex.risk, 2) + ' $')} par action, soit ${lit('−1 R')}. Le titre a ouvert à ${px('TRV', REF, 'open', 2, 'f_trv')}. La sortie s’est faite à ce prix, pour ${lit(frSigned(ex.r, 2, ' R'))} : la perte dépasse de ${lit(frNum(ex.slip * 100, 0) + ' %')} le risque prévu.</p>`
  + `<p><strong>Ce qu’on peut faire.</strong> Rien ne supprime ce risque, mais on peut le réduire. D’abord en ne mettant pas plusieurs lignes du même pari le même jour : vendredi, trois titres ont sauté leur stop ensemble. Ensuite en calculant la taille de la position avec une marge, par exemple en supposant une perte de ${lit('1,5 R')} plutôt que ${lit('1 R')}. Enfin en évitant de garder une position fragile avant un rendez-vous majeur, comme l’inflation de mardi. Ce conseil vaut pour les prochains achats ; pour les lignes déjà ouvertes, le plan ne change pas : stop, invalidation et sortie le ${lit('18 novembre')}.</p></div>`));

// 11. Scénarios
sections.push(section('scenarios', 'Scénarios', 'Ce qui peut se passer d’ici le 17 novembre', pill('À SURVEILLER', 'partial'), 'partial',
  `<div class="scenario-grid">`
  + `<article class="scenario base"><h3>Central : un rebond par à-coups</h3><p>Le marché rebondit par à-coups sans effacer la chute du ${lit('5 novembre')}. Le signal : SMH reste sous ${usd(TEST1)} mercredi soir. La puce reste exposée jusqu’à CoreWeave mardi et Nvidia le ${regD('nvidia_results', 'nvidia_ir_fy27q3', 'nv_s')}.</p></article>`
  + `<article class="scenario down"><h3>Aggravant : une autre secousse</h3><p>Une secousse, ici, c’est une clôture du QQQ sous ${px('QQQ', D5, 'close', 2, 'sc_q')}, sa clôture du ${lit('5 novembre')}, ou une séance du SMH à ${lit('−5 %')} ou pire, d’ici le ${lit('17 novembre')} ; la clôture sous ce seuil déclenche aussi notre coupure.</p><p>Repère historique, distinct de cette définition : depuis ${lit('1999')}, une seconde séance du QQQ à ${lit('−5 %')} a suivi la première dans les six semaines dans ${lit(String(H.second_within_30))} épisodes sur ${lit(String(H.n))} (${lit(String(POST03_2))} sur ${lit(String(POST03.length))} depuis ${lit('2003')}). Un échantillon mince, mesuré sur six semaines, pas sur les sept séances qui nous séparent de Nvidia.</p><p>Une inflation forte mardi, après l’emploi de vendredi, installerait la hausse de décembre, déjà cotée ${fedR('fed_sc')} sur Polymarket, alors que la menace d’une régulation des centres de données, au Texas notamment, pèse déjà sur la puce.</p></article>`
  + `<article class="scenario flat"><h3>Contraire : le rebond s’installe</h3><p>Hors de la puce, le marché tient : cinq secteurs sur onze sont en hausse sur la semaine. Vendredi, RSP et IWM ont fini au-dessus de leur ouverture, la Corée et Taïwan ont pris environ ${lit('4 %')}, et le SMH a touché ${px('SMH', REF, 'high', 2, 'sc_smhh')} en séance. Une inflation sage et des résultats de CoreWeave rassurants sur la demande de centres de données peuvent relancer la puce. Le signe serait un QQQ qui finit dans la moitié haute de sa séance (au-dessus du milieu), pas seulement un pourcentage positif.</p></article>`
  + `<article class="scenario up"><h3>Quand nous aurons tort</h3><p>Deux feux verts sur trois au relevé du vendredi ${lit('13 novembre')} nous font lever la prudence. Au relevé du vendredi ${lit('13 novembre')}, les feux ${lit('2')} et ${lit('3')} partent de zéro (SPY contre RSP, EWY et EWT depuis la clôture du ${lit('6 novembre')}) ; SPHB doit encore prendre ${lit(frSigned((TH1 / bar('SPHB', REF)[4] - 1) * 100, 1))}. La moyenne des ${lit('200')} séances du QQQ, vers ${lit(SMA_TXT + ' $')}, reste un simple repère, plus une condition.</p></article>`
  + `</div>`));

// 12. Agenda
const echeancier = renderEventTimeline({
  id: 'echeancier', asof: '2026-11-07', from: '2026-11-09', to: '2026-11-13', requireProof: true,
  keyWindow: { from: '2026-11-10', to: '2026-11-10', labelHtml: `Fenêtre clé · mardi ${regT('cpi_release', 'bls_cpi', 'kw_a')} → ${regT('coreweave_call', 'coreweave_ir_20261027', 'kw_b')}` },
  events: [
    { date: '2026-11-09', category: 'macro', impact: 'medium', label: 'Fed, Bowman', detail: 'petites banques', icon: 'bank', proof: paris(bowman, 'tl_bow') },
    { date: '2026-11-10', category: 'macro', impact: 'medium', label: 'Fed, Waller', detail: 'perspectives', icon: 'bank', proof: paris(waller, 'tl_wal') },
    { date: '2026-11-10', category: 'macro', impact: 'medium', label: 'Fed, Bowman', detail: 'perspectives', icon: 'bank', proof: paris(bowman2, 'tl_bow2') },
    { date: '2026-11-10', category: 'macro', impact: 'strong', label: 'Inflation (CPI)', detail: 'octobre', icon: 'data', proof: regT('cpi_release', 'bls_cpi', 'tl_cpi') },
    { date: '2026-11-10', category: 'earnings', impact: 'strong', label: 'CoreWeave', detail: 'conférence de résultats', icon: 'chip', proof: regT('coreweave_call', 'coreweave_ir_20261027', 'tl_crw') },
    { date: '2026-11-13', category: 'macro', impact: 'medium', label: 'Prix à la production', detail: 'octobre', icon: 'data', proof: regT('ppi_release', 'bls_ppi', 'tl_ppi') }
  ],
  chains: [
    { steps: [{ label: 'Inflation forte', icon: 'data', category: 'macro' }, { label: 'Hausse de taux', icon: 'bank', tone: 'up' }, { label: 'Croissance', category: 'plan', icon: 'chip', tone: 'down' }] },
    { steps: [{ label: 'CoreWeave rassure', icon: 'chip', category: 'earnings' }, { label: 'Demande de puces', icon: 'company', tone: 'up' }, { label: 'Semi-conducteurs', category: 'plan', icon: 'chip', tone: 'up' }] }
  ]
});
sections.push(section('agenda', 'La semaine prochaine', 'Ce qui peut bouger la Bourse jusqu’au vendredi 13', pill('DATÉ'), 'validated',
  echeancier
  + `<p class="section-intro">Mardi ${regD('cpi_release', 'bls_cpi', 'cpi_d')} concentre la semaine : l’inflation d’octobre à ${regT('cpi_release', 'bls_cpi', 'cpi_p')}, heure de Paris, puis la conférence de résultats de CoreWeave à ${regT('coreweave_call', 'coreweave_ir_20261027', 'crw_p')}, premier test pour les sociétés qui louent des centres de données. Les prix à la production suivent vendredi ${regD('ppi_release', 'bls_ppi', 'ppi_d')}. Nvidia publie le ${regD('nvidia_results', 'nvidia_ir_fy27q3', 'nv_d2')} vers ${regT('nvidia_results', 'nvidia_ir_fy27q3', 'nv_p')}, date confirmée par la société ; la sortie forcée de nos lignes, le ${lit('18 novembre')}, suit le lendemain. <a href="/weekly/20261109/">Notre hebdo de la semaine du 9 novembre</a> la détaille.</p>`
  + `<p class="provenance">Horaires : calendrier macro collecté (Fed), calendrier officiel de la BLS (inflation, prix à la production), communiqués de CoreWeave et de Nvidia.</p>`));

// 13. Ailleurs
sections.push(section('ailleurs', 'Ailleurs', 'Asie, Europe, crypto', pill('PARTIEL', 'partial'), 'partial',
  `<div class="two-col"><article class="data-card"><h3>Asie et Europe vendredi</h3><p>L’Asie a encaissé vendredi la chute de Wall Street de la veille : le Nikkei et le Kospi ont lourdement chuté, et le STOXX ${lit('600')} a reculé (Reuters). En dollars, l’Euro Stoxx ${lit('50')} (FEZ) a fait ${chg('FEZ', D5, REF, 1, 'fez')}. À New York, les fonds de la Corée (EWY, ${chg('EWY', D5, REF, 1, 'ewy')}) et de Taïwan (EWT, ${chg('EWT', D5, REF, 1, 'ewt')}) ont rebondi avec la puce américaine.</p></article>`
  + `<article class="data-card"><h3>Crypto</h3><p>Sur la bougie UTC du ${lit('6 novembre')}, le bitcoin a fini à ${px('BTC-USD', REF, 'close', 0, 'btc_c')} (${chg('BTC-USD', D5, REF, 1, 'btc_c2')}) et ${chg('BTC-USD', W0, REF, 1, 'btc_w')} sur la semaine ; l’ether à ${px('ETH-USD', REF, 'close', 2, 'eth_c')}. Ce samedi matin, le bitcoin cote ${offPx(btcLive, 0, 'btc_l', ' $')}, un relevé de ${offAt(btcLive, 'btc_t')}. Selon CryptoProwl, vers ${lit('75 000 $')} vendredi, il touchait son plus bas depuis fin août, avec deux poids propres au secteur : le vol de ${reg('/facts/crypto/binance_hack_busd', fr(1, ' Md$'), 'bnb', 'cryptoprowl_20261106')} chez Binance le ${lit('30 octobre')}, et le doute sur la loi Clarity avec un Congrès démocrate.</p></article></div>`));

// 14. À surveiller
sections.push(section('surveiller', 'À surveiller', 'Les points de contrôle de la semaine', pill('CHECKLIST'), 'validated',
  `<ul class="checklist">`
  + `<li><i class="fas fa-flag-checkered"></i><div><strong>Mercredi ${lit('22h00')} : le test.</strong><br>SMH au-dessus de ${usd(TEST1)} et QQQ dans la moitié haute de sa séance (clôture au-dessus du milieu entre plus-haut et plus-bas) : première tranche possible jeudi. Détail dans <a href="/weekly/20261109/">notre hebdo de la semaine du 9 novembre</a>.</div></li><li><i class="fas fa-traffic-light"></i><div><strong>SPHB, suivi seulement.</strong><br>Relevé officiel vendredi ${lit('13 novembre')} à ${lit('22h00')} ; le feu ${lit('1')} s’allume au-dessus de ${usd2(TH1)}. Clôture de vendredi : ${px('SPHB', REF, 'close', 2, 'sphb_w')}.</div></li>`
  + ``
  + `<li><i class="fas fa-fire"></i><div><strong>L’inflation, mardi à ${paris(cpiEco, 'cpi_w')}.</strong><br>Après l’emploi, c’est le chiffre qui peut installer la hausse de taux de décembre.</div></li>`
  + `<li><i class="fas fa-server"></i><div><strong>CoreWeave, mardi à ${regT('coreweave_call', 'coreweave_ir_20261027', 'crw_w')}.</strong><br>Le titre a fait ${chg('CRWV', W0, REF, 1, 'crwv_w')} sur la semaine malgré son rebond de vendredi.</div></li>`
  + `<li><i class="fas fa-list-check"></i><div><strong>PulteGroup et HCA.</strong><br>Les deux lignes du scan les plus proches de leur invalidation ; une clôture dessous fait vendre à l’ouverture suivante.</div></li>`
  + `</ul>`));

// 15. Sources
const srcLinks = [
  ['https://www.bls.gov/news.release/empsit.nr0.htm', 'BLS, 6 novembre : l’emploi d’octobre'],
  ['https://www.cnbc.com/2026/11/06/jobs-report-october-2026.html', 'CNBC, 6 novembre : les attentes et FedWatch'],
  ['https://finance.yahoo.com/markets/world-indices/articles/asia-stocks-drop-ai-rout-235808955.html', 'Reuters, 6 novembre : la séance, l’Europe, les taux, le pétrole'],
  ['https://finance.yahoo.com/markets/stocks/articles/warren-buffett-berkshire-rose-5-030000467.html', '24/7 Wall St., 7 novembre : la semaine, Berkshire'],
  ['https://finance.yahoo.com/markets/crypto/articles/weekly-wrap-bitcoin-falls-u-225000991.html', 'CryptoProwl, 6 novembre : la crypto'],
  ['https://investors.coreweave.com/news/news-details/2026/CoreWeave-Announces-Date-of-Third-Quarter-2026-Financial-Results-and-Conference-Call/default.aspx', 'CoreWeave : date des résultats'],
  ['https://investor.nvidia.com/events-and-presentations/events-and-presentations/event-details/2026/NVIDIA-3rd-Quarter-FY27-Financial-Results/default.aspx', 'Nvidia : date des résultats'],
  ['https://www.bls.gov/schedule/news_release/cpi.htm', 'BLS : calendrier de l’inflation'],
  ['https://www.bls.gov/schedule/news_release/ppi.htm', 'BLS : calendrier des prix à la production'],
  ['/daily/20261106/', 'Notre daily du 6 novembre'],
  ['/scanner/20261105/', 'Notre scan du 5 novembre'],
  ['/daily/20261031/', 'Notre daily du 31 octobre : les neuf plans'],
  ['/rotation/', 'La page Rotations']
].map(([u, l]) => `<li><a href="${u}"${u.startsWith('http') ? ' rel="noopener" target="_blank"' : ''}>${l}</a></li>`).join('');
sections.push(section('sources', 'Sources et limites', 'Sur quoi repose cette édition', pill('PARTIEL', 'partial'), 'partial',
  `<div class="source-list">`
  + `<div class="source-item"><strong>Cours</strong><span>Clôtures vérifiées du ${refDay('ref_src', 'full')} ; bougies crypto UTC terminées à la même date. Plans du ${lit('31 octobre')} suivis du ${lit('2')} au ${lit('6 novembre')}, lignes du scan sur les séances des ${lit('5')} et ${lit('6 novembre')}.</span></div>`
  + `<div class="source-item"><strong>Relevés de ce samedi</strong><span>Bitcoin et cotes Polymarket : relevés du matin, jamais des clôtures.</span></div>`
  + `<div class="source-item"><strong>Attributions</strong><span>BLS pour l’emploi ; CNBC, Reuters, 24/7 Wall St. et CryptoProwl pour les attentes, la séance hors de nos cours, l’Asie et la crypto ; BLS, CoreWeave et Nvidia pour le calendrier.</span></div>`
  + `</div>`
  + `<ul class="provenance">${srcLinks}</ul>`
  + `<div class="quality-note warning-note"><strong>Limites.</strong> L’exécution des ordres est reconstituée sur les barres du jour : une ouverture sous le stop est comptée à l’ouverture, un stop touché en séance au prix du stop. Les bilans ne comptent ni frais ni glissement au-delà de l’ouverture. Les statistiques historiques portent sur ${lit(String(H.n))} épisodes.</div>`
  + `<p class="section-intro">Ce contenu est informatif. Il ne constitue pas un conseil en investissement. Investir comporte un risque de perte en capital.</p>`));

// ── Noms et repères écrits en toutes lettres : littéraux déclarés, liste close ─
const LITERAL_PATTERNS = [
  /S&amp;P 500/g, /S&P 500/g, /Nasdaq-100/g, /\b(?:19|20)\d{2}\b/g,
  /\b\d{1,2}(?:er)? (?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\b/g,
  /\b(?:30 jours|24 heures|9 jours|5 séances)\b/g, /(?<![\p{L}])(?:deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|vingt|tiers|moitié|cinquième|quart)(?![\p{L}])/giu,
  /24\/7 Wall St\./g, /\bvendredi 13\b/g, /−5 %/g, /\bSTOXX 600\b/g, /\bEuro Stoxx 50\b/g
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
const mv = moveData.slice().sort((a, b) => a.v - b.v);
const chartSpecs = [
  { id: 'movesChart', spec: { grid: { left: 210, right: 56, top: 36, bottom: 32 }, legend: { top: 0, data: ['Vendredi', 'Semaine'] }, xAxis: { type: 'value', axisLabel: { formatter: '{value} %' } }, yAxis: { type: 'category', data: mv.map(x => x.label), axisLabel: { fontSize: 11 } }, series: [{ name: 'Vendredi', type: 'bar', data: mv.map(x => ({ value: x.v, itemStyle: { color: x.v >= 0 ? '#0b8f62' : '#c73d4b' } })), label: { show: true, position: 'right', formatter: '{c} %', fontSize: 10 } }, { name: 'Semaine', type: 'bar', itemStyle: { color: '#94a3b8' }, data: mv.map(x => x.w) }] } },
  { id: 'lightsChart', spec: { grid: { left: 52, right: 18, top: 40, bottom: 32 }, legend: { top: 0, data: ['Feu 2 : SPY − RSP, 5 séances', 'Feu 3 : le plus faible de EWY et EWT, 5 séances'] }, xAxis: { type: 'category', data: lightSeries.map(x => x.d.slice(8) + '/' + x.d.slice(5, 7)) }, yAxis: { type: 'value', axisLabel: { formatter: '{value} pt' } }, series: [{ name: 'Feu 2 : SPY − RSP, 5 séances', type: 'line', data: lightSeries.map(x => x.gap), lineStyle: { width: 3 }, markLine: { silent: true, symbol: 'none', data: [{ yAxis: 0 }], lineStyle: { color: '#0b8f62', type: 'dashed', width: 2 }, label: { formatter: 'feu vert au-dessus' } } }, { name: 'Feu 3 : le plus faible de EWY et EWT, 5 séances', type: 'line', data: lightSeries.map(x => x.asia), lineStyle: { width: 3 } }] } },
  { id: 'bilanChart', spec: { grid: { left: 56, right: 18, top: 40, bottom: 32 }, xAxis: { type: 'category', data: rData.map(x => x.s) }, yAxis: { type: 'value', name: 'R', axisLabel: { formatter: '{value} R' } }, legend: { top: 0, data: ['Stop posé', 'Règle de clôture'] }, series: [{ name: 'Stop posé', type: 'bar', data: rData.map(x => ({ value: x.v, itemStyle: { color: x.v >= 0 ? '#0b8f62' : '#c73d4b', opacity: x.closed ? 1 : 0.55 } })), label: { show: true, position: 'top', formatter: '{c} R', fontSize: 10 } }, { name: 'Règle de clôture', type: 'bar', itemStyle: { color: '#5b6b80' }, data: rData.map(x => x.vc), label: { show: true, position: 'top', formatter: '{c} R', fontSize: 10 } }] } }
];

// ── Page ─────────────────────────────────────────────────────────────────────
const title = 'Les puces rebondissent sans convaincre : lundi, aucun achat';
const description = `Daily du samedi 7 novembre 2026. Vendredi, les semi-conducteurs ont repris ${frSigned(chgV('SMH'), 1)} et le Nasdaq-100 ${frSigned(chgV('QQQ'), 1)}, mais la séance a fini près de ses plus-bas après un emploi bien plus fort que prévu. Notre seuil sur les semi-conducteurs est raté, aucun feu vert n’est allumé. Bilan de la semaine, rotation recalculée, et le statut de nos plans du 31 octobre et du scan du 5 novembre.`;
const badges = [`Puces ${frSigned(chgV('SMH'), 1)}`, `QQQ ${frSigned(chgV('QQQ'), 1)}`, `Semaine S&P 500 ${frSigned(W('SPY'), 1)}`, 'Emploi : 165 000', 'Feux verts : 0 sur 3', 'Lundi : aucun achat'];
const css = fs.readFileSync(path.join(DIR, '_style.css'), 'utf8');
const rotScript = ROT ? `<script src="/assets/rotation-race.js"></script>
<script>(function(){var R=window.DTRotation;if(!R||typeof echarts==='undefined')return;var D,W='event',rc={};var RAT=[['SPHB','SPLV'],['RSP','SPY'],['IWM','SPY'],['FEZ','SPY'],['EWY','SPY']];
function e(s){return D.etfs.find(function(x){return x.symbol===s})}function base(){return D.windows.find(function(w){return w.key===W}).base}
function race(id,items){if(rc[id])rc[id].dispose();var el=document.getElementById(id);el.style.height=Math.max(260,items.length*(el.clientWidth<520?24:27)+56)+'px';rc[id]=R.race(el,{dates:D.dates,base:base(),items:items,controls:R.controls(document.getElementById(id+'Ctl'))})}
function draw(){var sp=D.indices.sp500.dims.sector;race('rotSect',sp.map(function(g){return{name:g.label,series:g.series,sub:g.n+' titres'}}));race('rotPlaces',D.etfs.filter(function(x){return x.kind==='region'}).map(function(x){return{name:x.symbol+' · '+x.label,series:x.series}}));
R.lines(document.getElementById('rotRisk'),{dates:D.dates,base:base(),lead:10,baseLabel:'base',items:RAT.map(function(r){var a=e(r[0]),b=e(r[1]);return{name:r[0]+'/'+r[1],series:a.series.map(function(v,i){return v/b.series[i]*100})}})});
var t=document.getElementById('rotWinTabs');t.innerHTML=D.windows.map(function(w){return '<button type="button" class="rotation-tab'+(w.key===W?' active':'')+'" aria-pressed="'+(w.key===W)+'" data-k="'+w.key+'">'+w.label+'</button>'}).join('');Array.prototype.forEach.call(t.children,function(b){b.onclick=function(){W=b.dataset.k;draw()}})}
R.load('/daily/20261107/rotation-indices.json').then(function(d){D=d;draw()}).catch(function(){var n=document.querySelector('.rot-embed');if(n)n.innerHTML='<p class="provenance">Graphiques de rotation indisponibles pour le moment.</p>'})})();</script>` : '';
const html = `<!DOCTYPE html>
<html lang="fr" data-tags="us,macro,semis,ai,retrospective,formation" data-tab="daily">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily — 7 novembre 2026 : les puces rebondissent sans convaincre</title>
  <meta name="description" content="${description}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://articles.dailytickers.com/daily/20261107/">
  <meta property="og:image" content="https://articles.dailytickers.com/assets/og-card.png">
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

<section class="hero-section"><div class="container"><div class="hero-date">Samedi 7 novembre 2026 &bull; clôtures du vendredi 6 novembre</div><h1 class="hero-title">${title}</h1><p class="hero-subtitle">${description}</p><div class="hero-badges">${badges.map(b => `<span class="hero-badge">${b}</span>`).join('')}</div><div id="article-clickable-tags" class="card-tags"></div></div></section>

<main class="report-main"><div class="container">
${sections.join('\n')}
</div></main>

<div class="fnav" id="floatingNav"><div class="fnav-menu" id="fnavMenu"><a href="#alerte" class="fnav-item" data-section="alerte"><i class="fas fa-bullhorn"></i><span>L’essentiel</span></a><a href="#seance" class="fnav-item" data-section="seance"><i class="fas fa-chart-column"></i><span>La séance</span></a><a href="#tests" class="fnav-item" data-section="tests"><i class="fas fa-traffic-light"></i><span>Tests et feux</span></a><a href="#semaine" class="fnav-item" data-section="semaine"><i class="fas fa-calendar-week"></i><span>La semaine</span></a><a href="#trade" class="fnav-item" data-section="trade"><i class="fas fa-list-check"></i><span>Nos lignes</span></a><a href="#agenda" class="fnav-item" data-section="agenda"><i class="fas fa-calendar"></i><span>Agenda</span></a></div><button class="fnav-btn" id="fnavBtn" type="button" aria-label="Navigation"><i class="fas fa-bars" id="fnavIcon"></i><span class="fnav-btn-label" id="fnavLabel">Menu</span></button></div>
<footer class="article-footer">&copy; 2026 DailyTickers. Clôtures du 6 novembre 2026 ; bitcoin et cotes relevés le 7 novembre au matin. Ceci n&rsquo;est pas un conseil financier.<br><a href="/" title="Accueil" aria-label="Accueil"><i class="fas fa-house"></i></a></footer>
<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js"></script>
<script>const CHART_SPECS=${JSON.stringify(chartSpecs)};(function(){if(typeof echarts==='undefined')return;var xs=[];CHART_SPECS.forEach(function(c){var el=document.getElementById(c.id);if(!el)return;var x=echarts.init(el);x.setOption(Object.assign({animation:false,textStyle:{fontFamily:'Inter,system-ui,sans-serif'},tooltip:{trigger:'axis'}},c.spec));xs.push(x);});window.addEventListener('resize',function(){xs.forEach(function(x){x.resize();});});})();</script>
${rotScript}
<script src="/assets/echarts-responsive.js"></script>
<script src="/assets/core.js"></script>
<script src="/assets/tag-renderer.js"></script>
</body>
</html>
`;

fs.writeFileSync(path.join(DIR, 'index.html'), html);
const articleSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, 'index.html'))).digest('hex');
fs.writeFileSync(path.join(DIR, '_data/chart-data.json'), JSON.stringify({ reference_close: REF, previous_close: D5, week_base: W0, chart_specs: chartSpecs }, null, 2) + '\n');
fs.writeFileSync(path.join(DIR, '_data/claims.json'), JSON.stringify({ reference_close: REF, article_path: `${REL}/index.html`, article_sha256: articleSha, generated_by: `${REL}/_build.cjs`, literals: [...literals].sort(), claims }, null, 2) + '\n');
console.log(`daily rendu : ${sections.length} sections${ROT ? '' : ' (SANS rotation)'}, ${claims.length} claims, ${literals.size} littéraux, ${(html.length / 1024).toFixed(1)} Ko`);
console.log(JSON.stringify({ setups: SETUPS.map(x => [x.s, x.status, x.r && +x.r.toFixed(3), x.c && x.c.status, x.c && +x.c.r.toFixed(3)]), sumR, realizedR, latentR, sumRc, realizedRc, scan: LINES.map(x => [x.ticker, x.state, +x.r.toFixed(3), x.slip && +x.slip.toFixed(3)]), scanR, slipR, SMA200, igvBelow, crmAbove, gap2, qPos, lights: LIGHTS }, null, 1));
