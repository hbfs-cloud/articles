#!/usr/bin/env node
'use strict';

// Daily du 6 novembre 2026 : la séance du 5 novembre (chute de la puce, puis de toute la cote en fin de
// séance), la rotation recalculée, et le statut de nos prévisions depuis le 31 octobre. Chaque chiffre
// visible dans <main> est un claim lié à un artefact collecté (socle, focus, lots thématiques) ou au
// registre primaire du jour. Les niveaux et chiffres que nous avons publiés (plans du 31 octobre, scan du
// 5 novembre, notifications du 5 novembre) sont des littéraux relus depuis leur source ; les résultats en
// % et en R sont recalculés ici depuis les barres liées, les statistiques historiques depuis _hist/.

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { renderValue } = require('../../tools/validate-content-claims');
const { renderEventTimeline } = require('../../tools/lib/event-timeline.cjs');
const { addUSTradingDays } = require('../../tools/lib/market-calendar.js');

const ROOT = path.resolve(__dirname, '../..');
const REL = 'daily/20261106';
const DIR = path.join(ROOT, REL);
const REF = '2026-11-05';
const D4 = '2026-11-04';
const D3 = '2026-11-03';
const D2 = '2026-11-02';
const PRIMARY = `${REL}/primary-reference.json`;
const SCAN = 'scanner/20261105/signals.json';

const sources = {
  idx: `${REL}/_data/bars_indices.json`, dia: `${REL}/_data/bars_dia.json`, sec: `${REL}/_data/bars_sectors.json`,
  cry: `${REL}/_data/bars_crypto.json`, off: `${REL}/_data/off_hours.json`, eco: `${REL}/_data/economic_events.json`,
  st: `${REL}/_data/status.json`, opt: `${REL}/_data/options_sentiment.json`,
  fb: `${REL}/_focus/focus_bars.json`, ta: `${REL}/_themes_a/bars_themes.json`, tb: `${REL}/_themes_b/bars_themes.json`,
  tc: `${REL}/_themes_c/bars_themes.json`, td: `${REL}/_themes_d/bars_themes.json`, te: `${REL}/_themes_e/bars_themes.json`,
  tf: `${REL}/_themes_f/bars_themes.json`
};
const D = Object.fromEntries(Object.entries(sources).map(([k, v]) => [k, JSON.parse(fs.readFileSync(path.join(ROOT, v), 'utf8'))]));
const primary = JSON.parse(fs.readFileSync(path.join(ROOT, PRIMARY), 'utf8'));
const scan = JSON.parse(fs.readFileSync(path.join(ROOT, SCAN), 'utf8'));
const prev = JSON.parse(fs.readFileSync(path.join(ROOT, 'daily/20261105/_themes_a/bars_themes.json'), 'utf8'));
const prevB = JSON.parse(fs.readFileSync(path.join(ROOT, 'daily/20261105/_themes_b/bars_themes.json'), 'utf8'));
const HIST = JSON.parse(fs.readFileSync(path.join(DIR, '_hist/qqq_minus5_days.json'), 'utf8'));
const QBARS = JSON.parse(fs.readFileSync(path.join(DIR, '_hist/qqq_bars_adjusted.json'), 'utf8'));
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

// ── Barres ───────────────────────────────────────────────────────────────────
const SERIES_KEYS = ['idx', 'dia', 'sec', 'cry', 'fb', 'ta', 'tb', 'tc', 'td', 'te', 'tf'];
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
function chg(sym, from = D4, to = REF, decimals = 1, stem = 'chg') {
  const s = series(sym), i = idxOf(s, to), j = idxOf(s, from);
  const value = (s.bars[i][4] / s.bars[j][4] - 1) * 100;
  return claim(s.key, `${s.ptr}/bars/${i}/4`, s.bars[i][4], fr(decimals, ' %', true), `${stem}_${sym}`,
    { operation: 'ratio_pct', numerator_pointer: `${s.ptr}/bars/${i}/4`, denominator_pointer: `${s.ptr}/bars/${j}/4`, result: value });
}
const chgV = (sym, from = D4, to = REF) => { const s = series(sym); return (s.bars[idxOf(s, to)][4] / s.bars[idxOf(s, from)][4] - 1) * 100; };
function volx(sym, date, window, stem = 'volx') {
  const s = series(sym), i = idxOf(s, date);
  const first = i - window; if (first < 0) throw new Error(`${sym} : fenêtre de volume trop courte`);
  const mean = s.bars.slice(first, i).reduce((t, b) => t + b[5], 0) / window;
  return claim(s.key, `${s.ptr}/bars/${i}/5`, s.bars[i][5], fr(1, ' fois'), `${stem}_${sym}`,
    { operation: 'ratio_to_mean', numerator_pointer: `${s.ptr}/bars/${i}/5`, window, offset: 1, result: s.bars[i][5] / mean });
}
const bdate = (sym, date, parts = 'weekday_day_month', stem = 'd') => { const s = series(sym), i = idxOf(s, date); return claim(s.key, `${s.ptr}/bars/${i}/0`, s.bars[i][0], dateR(parts), `${stem}_${sym}`); };
const dir = v => (v >= 0 ? 'up' : 'down');
const atLow = sym => { const b = bar(sym, REF); return (b[4] - b[3]) / (b[2] - b[3]); };

// Révisions : les séances du 2 au 4 novembre des plans du 31 octobre n'ont pas bougé depuis l'édition d'hier,
// aux arrondis près de la barre définitive (MSFT : plus-bas du 4 novembre 542,341 $ devenu 542,30 $), sans
// effet sur une exécution : la tolérance est de six centimes.
const prevBars = (sym) => { const h = walk(prev, x => x && x.symbol === sym && Array.isArray(x.bars)) || walk(prevB, x => x && x.symbol === sym && Array.isArray(x.bars)); return h && h.node.bars; };
for (const s of ['MSFT', 'UNH', 'CRM', 'CRWD', 'JCI', 'FAST', 'CNC', 'OKTA', 'IGV']) {
  const p = prevBars(s); if (!p) throw new Error(`barres d'hier ${s}`);
  for (const d of [D2, D3, D4]) {
    const a = bar(s, d), b = p.find(x => x[0] === d);
    if (!b || [1, 2, 3, 4].some(c => Math.abs(a[c] - b[c]) > 0.06)) throw new Error(`${s} ${d} : barre révisée depuis hier`);
  }
}

// ── Contexte : volatilité, contrats à terme, cotes, horaires ────────────────
const vixPt = sym => { const i = D.opt.items.findIndex(x => x && x.symbol === sym && x.type === 'term_structure_point'); if (i < 0) throw new Error(sym); return { i, node: D.opt.items[i] }; };
const vix9 = vixPt('^VIX9D'), vix30 = vixPt('^VIX'), vix3m = vixPt('^VIX3M');
const vixR = (h, stem) => claim('opt', `/items/${h.i}/level`, h.node.level, fr(2), stem);
// Courbe inversée : la peur à neuf jours dépasse celle à trois mois.
if (!String(vix30.node.last_trade_time).startsWith(REF) || !(vix9.node.level > vix30.node.level && vix30.node.level > vix3m.node.level)) throw new Error('courbe du VIX à revoir');
const offObs = (facet, test) => { const f = D.off.facets[facet]; const i = f.observations.findIndex(test); if (i < 0) throw new Error(`hors séance ${facet}`); return { ptr: `/facets/${facet}/observations/${i}`, node: f.observations[i] }; };
const es = offObs('futures', o => o.canonical_asset === 'ES'), nq = offObs('futures', o => o.canonical_asset === 'NQ'), wti = offObs('futures', o => o.canonical_asset === 'WTI');
const btcLive = offObs('crypto', o => o.canonical_asset === 'BTC');
const fedDec = offObs('predictions', o => /increase interest rates by 25 bps after the December 2026/.test(o.metadata && o.metadata.question || ''));
const offPx = (o, d, stem, suffix = '') => claim('off', `${o.ptr}/price`, o.node.price, fr(d, suffix), stem);
const offAt = (o, stem) => claim('off', `${o.ptr}/observed_at`, o.node.observed_at, timeR('Europe/Paris'), stem);
const offRet = (o, k, stem, d = 1) => claim('off', `${o.ptr}/returns/${k}`, o.node.returns[k], fr(d, ' %', true), stem);
const fedR = stem => claim('off', `${fedDec.ptr}/price`, fedDec.node.price, pct(1), stem);
const fedD = stem => claim('off', `${fedDec.ptr}/returns/24h_probability_points`, fedDec.node.returns['24h_probability_points'], { scale: 100, decimals: 0, suffix: ' pts', format: 'fr', sign: 'always' }, stem);
const parisOf = iso => { const p = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso)); return `${p.find(x => x.type === 'hour').value}h${p.find(x => x.type === 'minute').value}`; };
const fedAt = () => lit(parisOf(fedDec.node.event_at));
// Le matin : contrats à peu près stables sur quatre heures après la chute, pétrole en nette reprise sur 24 heures.
if (!(Math.abs(es.node.returns['4h_pct']) < 0.5 && Math.abs(nq.node.returns['4h_pct']) < 0.5 && wti.node.returns['24h_pct'] > 3 && fedDec.node.returns['24h_probability_points'] < -0.05)) throw new Error('lecture du matin à revoir');

const econ = (name, day) => hit('eco', x => x && typeof x.name === 'string' && x.name.startsWith(name) && typeof x.event_time === 'string' && x.event_time.slice(0, 10) === day, name);
const nfp = econ('Non-Farm Payrolls (Employment Situation)', '2026-11-06'), bowman = econ('Federal Reserve Discussion - Vice Chair for Supervision Michelle W. Bowman: Supervision', '2026-11-06');
const paris = (h, stem) => claim('eco', `${h.ptr}/event_time`, h.node.event_time, timeR('Europe/Paris'), stem);
const stEq = D.st.operation_readiness.bars_daily_us_equity;
if (stEq.current_bar_date !== '2026-11-06' || stEq.current_bar_closes_at !== '2026-11-06T21:00:00Z' || stEq.served_completed_end !== REF) throw new Error('séance du jour inattendue');
const sessionDay = (stem, parts = 'weekday_day_month') => claim('st', '/operation_readiness/bars_daily_us_equity/current_bar_date', stEq.current_bar_date, dateR(parts), stem);
const nyClose = stem => claim('st', '/operation_readiness/bars_daily_us_equity/current_bar_closes_at', stEq.current_bar_closes_at, timeR('Europe/Paris'), stem);
const regT = (k, auth, stem) => reg(`/facts/calendar/${k}`, timeR('Europe/Paris'), stem, auth);
const regD = (k, auth, stem) => reg(`/facts/calendar/${k}`, dateR('day_month'), stem, auth);

// ── La séance du 5 novembre : constats qui gouvernent la prose ──────────────
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const dfull = d => `${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
const SECTORS = ['XLK', 'XLB', 'XLF', 'XLE', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU', 'XLC', 'XLRE'];
const SECT_DOWN = SECTORS.filter(s => chgV(s) < 0).length;
if (SECT_DOWN !== 11) throw new Error(`secteurs en baisse : ${SECT_DOWN}`);
// Clôtures au plus bas de la séance (moins de 5 % de l'amplitude au-dessus du plus-bas).
if (!(atLow('QQQ') < 0.05 && atLow('SPY') < 0.05 && atLow('IWM') < 0.05)) throw new Error('clôture au plus bas à revoir');
// Ce que notre visuel de 17 h 11 affichait comme « tenant » (assets/notifs/krach-puces-20261105.png, relevés de
// 17 h 02, heure de Paris) et la clôture : littéraux relus dans le visuel publié, clôtures liées.
const HELD = [['ALL', 'Allstate', 4.2], ['COST', 'Costco', 3.2], ['SO', 'Southern', 2.6], ['CB', 'Chubb', 2.6], ['DUK', 'Duke Energy', 2.4], ['XOM', 'Exxon', 2.1], ['WMT', 'Walmart', 1.7]];
// Les mêmes relevés figurent dans la notification longue de 17 h 03, archivée dans _hist/.
const notifLong = fs.readFileSync(path.join(DIR, '_hist/notif-20261105-1703.html'), 'utf8');
for (const [, name, v] of HELD) if (!notifLong.includes(`${name === 'Duke Energy' ? 'Duke' : name} +${frNum(v, 1)} %`)) throw new Error(`relevé de 17 h absent : ${name}`);
const heldClose = HELD.map(([s, n, v]) => ({ s, n, v, c: chgV(s) }));
const RELS = heldClose.map(x => x.c - chgV('SPY')), RELMIN = Math.min(...RELS), RELMAX = Math.max(...RELS);
if (!(RELMIN > 2 && RELMAX < 7)) throw new Error('écart relatif à SPY');
const turned = heldClose.filter(x => x.c < 0).map(x => x.s);
if (turned.join() !== 'ALL,CB,XOM,WMT') throw new Error(`valeurs passées en baisse : ${turned.join()}`);
if (!heldClose.every(x => x.c < x.v)) throw new Error('une valeur a fini au-dessus de son relevé de 17 h');

// ── Les 27 ans du QQQ ────────────────────────────────────────────────────────
{
  const q = series('QQQ'), today = bar('QQQ', REF)[4] / bar('QQQ', D4)[4] - 1;
  if (Math.abs(today - HIST.today.ret) > 1e-12 || HIST.last_date !== D4 || HIST.first_date !== '1999-03-10') throw new Error('historique QQQ désaligné');
  if (crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, '_hist/qqq_bars_adjusted.json'))).digest('hex') !== HIST.input_sha256) throw new Error('barres historiques modifiées');
  const s = HIST.stats;
  if (!(HIST.days_count === 57 && s.n === 13 && s.f21_down === 8 && s.f252_up === 8 && s.second_within_30 === 8 && HIST.worse_since === '2020-03-16' && HIST.last_day_before === '2025-04-04')) throw new Error('statistiques historiques');
}
const H = HIST.stats;
const NEAR = HIST.episodes.filter(e => e.dd_before > -0.12);
if (NEAR.map(e => e.date).join() !== '2000-01-04,2000-04-03,2011-08-08,2020-02-27,2020-09-03,2025-04-03') throw new Error('épisodes proches du sommet');
const LOSS1Y = HIST.episodes.filter(e => e.f252 != null && e.f252 < 0);
if (!(LOSS1Y.length === 5 && LOSS1Y.every(e => /^200[01]-/.test(e.date)))) throw new Error('pertes à un an');
if (!(HIST.stats.f63_median > 0.02 && HIST.stats.f63_median < 0.04)) throw new Error('médiane à trois mois');
const JAN00 = HIST.episodes[0];
if (!(JAN00.date === '2000-01-04' && JAN00.f21 > 0 && JAN00.f63 > 0 && JAN00.f252 < 0)) throw new Error('épisode de janvier 2000');
const hp = (v, d = 1) => lit(frSigned(v * 100, d));
// Moyenne des 200 dernières clôtures brutes du QQQ, séance du 5 novembre comprise.
const raw = QBARS.map(b => b.close).concat([bar('QQQ', REF)[4]]);
if (QBARS[QBARS.length - 1].date !== D4 || Math.abs(QBARS[QBARS.length - 1].close - bar('QQQ', D4)[4]) > 0.011) throw new Error('clôture brute du 4 novembre');
const SMA200 = raw.slice(-200).reduce((t, v) => t + v, 0) / 200;
const SMA_TXT = frNum(Math.ceil(SMA200), 0);
if (!(SMA200 > 675 && SMA200 < 690 && bar('QQQ', REF)[4] < SMA200 && bar('QQQ', D4)[4] > SMA200)) throw new Error(`moyenne 200 séances ${SMA200}`);

// ── Les plans du 31 octobre, suivis jusqu'au 5 novembre ─────────────────────
const DAYS = [D2, D3, D4, REF];
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
if (S.CRWD.exitDay !== REF || S.IGV.exitDay !== REF || S.JCI.exitDay !== D4 || S.OKTA.exitDay !== D3) throw new Error('chronologie des stops');
const sumR = executed.reduce((t, x) => t + x.r, 0), realizedR = closedL.reduce((t, x) => t + x.r, 0), latentR = openL.reduce((t, x) => t + x.r, 0);
// Règle de clôture (prescrite le 3 novembre) : clôture sous le stop = vente à l'ouverture suivante ; une
// clôture sous le stop le 5 novembre laisse une vente à faire ce vendredi, comptée ici à la clôture de jeudi.
for (const x of executed) {
  x.c = { status: 'ouverte' };
  for (let k = DAYS.indexOf(x.fillDay); k < DAYS.length; k++) {
    const d = DAYS[k], i = idxOf(x.ser, d), [, o, h, , c] = x.ser.bars[i];
    if (k > DAYS.indexOf(x.fillDay) && h >= x.target) { x.c = { status: 'cible', exit: Math.max(o, x.target) }; break; }
    if (c <= x.stop) {
      if (k + 1 >= DAYS.length) { x.c = { status: 'à vendre', pending: true }; break; }
      x.c = { status: 'stop', exit: x.ser.bars[idxOf(x.ser, DAYS[k + 1])][1] }; break;
    }
  }
  x.c.r = ((x.c.exit !== undefined ? x.c.exit : x.close) - x.fill) / x.risk;
  x.c.closed = x.c.exit !== undefined;
}
const expectC = { MSFT: 'cible', UNH: 'ouverte', CRM: 'ouverte', CRWD: 'à vendre', JCI: 'à vendre', CNC: 'cible', OKTA: 'à vendre', IGV: 'ouverte' };
for (const x of executed) if (x.c.status !== expectC[x.s]) throw new Error(`${x.s} : statut clôture ${x.c.status}`);
const sumRc = executed.reduce((t, x) => t + x.c.r, 0), realizedRc = executed.filter(x => x.c.closed).reduce((t, x) => t + x.c.r, 0);
if (!(sumR > sumRc)) throw new Error('le stop posé devait faire mieux que la règle de clôture');
const END31 = addUSTradingDays(D2, 12);
if (END31 !== '2026-11-18') throw new Error(`fin des lignes du 31 octobre : ${END31}`);
const END31_TXT = dfull(END31);
const igvCloseAbove = S.IGV.close - S.IGV.stop;
if (!(igvCloseAbove > 0 && igvCloseAbove < 0.05)) throw new Error('IGV à la clôture');

// ── Le scan du 5 novembre : exécution de jeudi ──────────────────────────────
// Règles publiées : ordre valable la seule séance du 5 novembre, au prix de la clôture du 4, jamais
// au-dessus ; pas d'ordre si l'ouverture est sous le plus-bas du 4 ; stop posé dès l'achat ; clôture
// sous ce plus-bas = vente à l'ouverture suivante. Ouverture sous le prix : ordre stop-limite servi quand
// le cours remonte au prix ; ouverture au-dessus : ordre limité servi quand le cours redescend au prix.
// L'ordre des prix dans la séance a été vérifié sur les barres de 30 minutes pour Nike : plus-haut de
// 40,88 $ atteint dans la première demi-heure, dont le plus-bas (40,125 $) reste au-dessus de l'invalidation.
const SHORT = { XLB: 'Fonds des matériaux', XLP: 'Fonds de la consommation de base' };
const LINES = scan.signals.map(sig => {
  const b = bar(sig.ticker, REF), w = bar(sig.ticker, D4);
  if (Math.abs(w[4] - sig.entry) > 0.006) throw new Error(`${sig.ticker} : entrée ≠ clôture du 4 novembre`);
  const [, o, h, l, c] = b;
  const x = { ...sig, o, h, l, c };
  if (o < sig.invalidation_level) x.state = 'pas d’ordre';
  else if (o <= sig.entry ? h >= sig.entry : l <= sig.entry) {
    x.fill = sig.entry; x.via = o <= sig.entry ? 'stop-limite' : 'limite';
    if (l <= sig.stop) { x.state = 'stop'; x.exit = sig.stop; }
    else if (h >= sig.tp1 && o > sig.entry) throw new Error(`${sig.ticker} : objectif et achat dans la même séance`);
    else x.state = c < sig.invalidation_level ? 'à vendre' : 'ouverte';
  } else x.state = 'non servi';
  if (x.fill !== undefined) { x.risk = x.fill - sig.stop; x.r = ((x.exit !== undefined ? x.exit : c) - x.fill) / x.risk; x.ret = ((x.exit !== undefined ? x.exit : c) / x.fill - 1) * 100; }
  return x;
});
const SL = Object.fromEntries(LINES.map(x => [x.ticker, x]));
const expectS = { HCA: 'ouverte', PHM: 'ouverte', ADSK: 'ouverte', CP: 'ouverte', TRV: 'ouverte', NKE: 'ouverte', XLB: 'stop', XLP: 'ouverte' };
for (const x of LINES) if (x.state !== expectS[x.ticker]) throw new Error(`${x.ticker} : ${x.state}`);
if (SL.NKE.via !== 'stop-limite' || SL.CP.via !== 'stop-limite' || SL.HCA.via !== 'limite') throw new Error('mode d’exécution');
const scanR = LINES.reduce((t, x) => t + x.r, 0);
const nkeMargin = SL.NKE.c - SL.NKE.invalidation_level;
if (!(nkeMargin > 0 && nkeMargin < 0.1)) throw new Error('Nike près de son invalidation');
const nearInv = LINES.filter(x => x.state === 'ouverte').sort((a, b) => (a.c / a.invalidation_level) - (b.c / b.invalidation_level));
if (nearInv[0].ticker !== 'NKE') throw new Error('ligne la plus proche de l’invalidation');

// ── Rotation : instantané du 5 novembre ─────────────────────────────────────
const RO = JSON.parse(fs.readFileSync(path.join(DIR, 'rotation-indices.json'), 'utf8'));
if (RO.asof !== REF || RO.event.base !== D3) throw new Error('instantané de rotation désaligné');
if (!/MTUM, QUAL/.test(RO.method.splits || '') || RO.etfs.some(e => ['MTUM', 'QUAL'].includes(e.symbol))) throw new Error('fractionnement MTUM/QUAL non écarté');
{
  const sp = RO.indices.sp500, st = k => sp.dims.style.find(g => g.key === k).ret, vq = k => sp.dims.vol.find(g => g.key === k).ret;
  const secBy = w => sp.dims.sector.slice().sort((a, b) => b.ret[w].cw - a.ret[w].cw).map(g => g.key);
  const regionBy = w => RO.etfs.filter(e => e.kind === 'region' && !['SPY', 'DIA', 'QQQ', 'IWM'].includes(e.symbol)).sort((a, b) => a.ret[w] - b.ret[w]).map(e => e.symbol);
  const checks = {
    cw_below_ew_event: sp.total.ret.event.cw < sp.total.ret.event.ew,
    defensive_first_growth_last_event: st('defensive').event.cw > 0 && st('growth').event.cw < st('cyclical').event.cw,
    q5_worst_q1_best_event: vq('q5').event.cw < vq('q4').event.cw && vq('q1').event.cw > 0,
    nvda_first_drag_event: sp.contributors.event.bottom[0].s === 'NVDA',
    staples_first_event: secBy('event')[0] === 'consumer_staples',
    energy_tech_last_event: secBy('event').slice(-2).sort().join() === 'energy,technology',
    korea_taiwan_worst_event: regionBy('event').slice(0, 2).sort().join() === 'EWT,EWY',
    china_best_event: regionBy('event').slice(-1)[0] === 'MCHI',
    tech_comm_bottom_1m: secBy('1m').slice(-2).sort().join() === 'communication_services,technology',
  };
  const bad = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  if (bad.length) throw new Error(`prose de rotation contredite par l'instantané : ${bad.join(', ')}`);
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
const dshort = d => lit(dfull(d));

// 1. L'essentiel
sections.push(`<section id="alerte" class="decision-strip" data-status="validated">`
  + `<article class="decision-card primary"><div class="decision-kicker">Décision</div><h2>La chute de la puce a gagné toute la cote en fin de séance : rien de neuf à acheter aujourd’hui, les stops restent où ils sont</h2>`
  + `<p>Jeudi, le Nasdaq-100 (QQQ) a perdu ${chg('QQQ', D4, REF, 2, 'qqq_a')}, sa pire séance depuis le ${lit('16 mars 2020')} sur nos cours, les semi-conducteurs (SMH) ${chg('SMH', D4, REF, 1, 'smh_a')}, le S&amp;P 500 (SPY) ${chg('SPY', D4, REF, 2, 'spy_a')}. Les ${lit('onze')} fonds sectoriels ont fini en baisse, et les indices ont clôturé sur leur plus-bas du jour. La peur à neuf jours (VIX9D, ${vixR(vix9, 'vix9_a')}) dépasse celle à trois mois (${vixR(vix3m, 'vix3m_a')}) : c’est le signe d’un stress de court terme.</p>`
  + `<p><strong>Ce qu’on fait aujourd’hui.</strong> Aucun nouvel achat (l’ordre Fastenal du ${lit('31 octobre')} reste posé, voir plus bas). Si vous suivez la règle de clôture, Okta, Johnson Controls et CrowdStrike se vendent à l’ouverture de New York, à ${lit('15h30')} heure de Paris. XLB est sorti à son stop jeudi ; s’il n’était pas posé, vente à l’ouverture. Toutes les autres lignes gardent leur stop. Nike et l’ETF IGV se jouent à la clôture de ce soir, à ${nyClose('nyc_top')} heure de Paris.</p><p>Notre notification de ${lit('17h03')} disait que les valeurs solides tenaient. C’était vrai à ${lit('17 heures')}, plus à la clôture : Allstate, Chubb, Exxon et Walmart ont fini en baisse. Seuls Costco, Southern et Duke Energy ont gardé un peu de hausse. Le détail est plus bas.</p></article>`
  + `<article class="decision-card">${pill('NOS PRÉVISIONS', 'risk')}<h3>Plans du 31 octobre : ${lit(frSigned(sumR, 2, ' R'))} avec le stop posé, ${lit(frSigned(sumRc, 2, ' R'))} avec la règle de clôture</h3><p>R mesure le résultat en pertes prévues : ${lit('−1 R')}, c’est un plan perdu jusqu’à son stop ; ${lit('+2 R')}, deux fois la somme mise en risque. Avec le stop posé, CrowdStrike et l’ETF IGV ont touché leur stop jeudi ; avec la règle de clôture, IGV reste ouvert. Les huit lignes du scan du ${lit('5 novembre')} ont été achetées le jour de la chute ; le fonds des matériaux (XLB) est déjà sorti à son stop. Total du scan à la clôture : ${lit(frSigned(scanR, 2, ' R'))}.</p></article>`
  + `<article class="decision-card">${pill('CE MATIN', 'partial')}<h3>Tokyo et Séoul plongent, les contrats américains se stabilisent</h3><p>Le Nikkei a fini à ${reg('/facts/asia/nikkei_pct', fr(1, ' %', true), 'nik_a', 'ap_asia_20261106')} et le Kospi à ${reg('/facts/asia/kospi_pct', fr(1, ' %', true), 'ksp_a', 'ap_asia_20261106')} (AP). Relevé à ${offAt(nq, 'nq_t_a')}, heure de Paris, le contrat Nasdaq-100 fait ${offRet(nq, '4h_pct', 'nq4_a', 2)} sur quatre heures : pas de nouvelle glissade pour l’instant. Ce ne sont pas des clôtures.</p></article>`
  + `</section>`);

// 2. Tableau de bord
const moveList = ['DIA', 'SPY', 'RSP', 'IWM', 'QQQ', 'SMH', 'XLK', 'XLI', 'XLY', 'XLE', 'XLB', 'XLF', 'XLV', 'XLRE', 'XLP', 'XLU', 'XLC', 'TLT', 'GLD', 'USO', 'SPHB', 'SPLV', 'EWY', 'EWT', 'FEZ'];
const LABEL = { DIA: 'Dow Jones (DIA)', SPY: 'S&P 500 (SPY)', RSP: 'S&P 500 équipondéré (RSP)', IWM: 'Petites valeurs (IWM)', QQQ: 'Nasdaq-100 (QQQ)', SMH: 'Semi-conducteurs (SMH)', XLK: 'Technologie (XLK)', XLI: 'Industrie (XLI)', XLY: 'Conso. discrétionnaire (XLY)', XLE: 'Énergie (XLE)', XLB: 'Matériaux (XLB)', XLF: 'Finance (XLF)', XLV: 'Santé (XLV)', XLRE: 'Immobilier (XLRE)', XLP: 'Conso. de base (XLP)', XLU: 'Services publics (XLU)', XLC: 'Communication (XLC)', TLT: 'Obligations 20 ans (TLT)', GLD: 'Or (GLD)', USO: 'Pétrole (USO)', SPHB: 'Actions à bêta élevé (SPHB)', SPLV: 'Actions peu volatiles (SPLV)', EWY: 'Corée (EWY)', EWT: 'Taïwan (EWT)', FEZ: 'Euro Stoxx 50 (FEZ)' };
const moveData = moveList.map(s => ({ label: LABEL[s], v: +chgV(s).toFixed(2) })).sort((a, b) => a.v - b.v);
sections.push(section('dashboard', 'Le tableau', 'Jeudi 5 novembre : onze secteurs sur onze en baisse', pill('VALIDÉ'), 'validated',
  `<div class="dashboard-grid">`
  + dash('Nasdaq-100 (QQQ)', px('QQQ', REF, 'close', 2, 'qqq_px'), chg('QQQ', D4, REF, 2, 'qqq_d'), 'clôture sur le plus-bas du jour', 'down')
  + dash('S&amp;P 500 (SPY)', px('SPY', REF, 'close', 2, 'spy_px'), chg('SPY', D4, REF, 2, 'spy_d'), 'clôture sur le plus-bas du jour', 'down')
  + dash('Dow Jones (DIA)', px('DIA', REF, 'close', 2, 'dia_px'), chg('DIA', D4, REF, 2, 'dia_d'), `${reg('/facts/close/dow_points', fr(0), 'dowp', 'ap_asia_20261106')} points de Dow (AP)`, 'down')
  + dash('Semi-conducteurs (SMH)', px('SMH', REF, 'close', 2, 'smh_px'), chg('SMH', D4, REF, 2, 'smh_d'), `volume : ${volx('SMH', REF, 10, 'smh_v')} la moyenne de dix séances`, 'down')
  + dash('Volatilité à 30 jours (VIX)', vixR(vix30, 'vix_a'), `à ${lit('9 jours')} : ${vixR(vix9, 'vix9_b')}`, 'courbe inversée', 'down')
  + dash('Pétrole (USO)', px('USO', REF, 'close', 2, 'uso_px'), chg('USO', D4, REF, 1, 'uso_d'), `WTI ce matin : ${offPx(wti, 2, 'wti_a', ' $')}`, dir(chgV('USO')))
  + dash('Obligations 20 ans (TLT)', px('TLT', REF, 'close', 2, 'tlt_px'), chg('TLT', D4, REF, 2, 'tlt_d'), `dix ans à ${reg('/facts/close/ust10y_pct', fr(2, ' %'), 'ust_a', 'ap_asia_20261106')} (AP)`, dir(chgV('TLT')))
  + dash('Bitcoin', px('BTC-USD', REF, 'close', 0, 'btc_px'), chg('BTC-USD', D4, REF, 1, 'btc_d'), 'bougie UTC du 5 novembre', 'down')
  + `</div>`
  + `<div id="movesChart" class="echart-box" role="img" aria-label="Variation de chaque indice, secteur et fonds entre la clôture du mercredi 4 novembre et celle du jeudi 5 novembre, en pourcentage" style="width:100%; height:680px; margin-top:1rem;"></div>`
  + `<p class="provenance">Variations de la clôture du ${bdate('SPY', D4, 'weekday_day_month', 'prev_c')} à celle du ${refDay('ref_c')}, cours vérifiés. Volatilité : clôtures de jeudi des indices VIX à ${lit('9 jours')}, ${lit('30 jours')} et ${lit('3 mois')}. WTI : relevé de ce vendredi matin.</p>`));

// 3. La séance
const heldRows = heldClose.map(x => [`<strong>${x.n}</strong>`, lit(frSigned(x.v, 1)), chg(x.s, D4, REF, 1, 'held'), x.c < 0 ? verdict('Passé en baisse', 'faux') : verdict('Resté en hausse', 'vrai')]);
const crashRows = [['SNDK', 'Sandisk', 'mémoire'], ['MU', 'Micron', 'mémoire'], ['AMD', 'AMD', 'processeurs'], ['IREN', 'IREN', 'location de centres de données'], ['BE', 'Bloom Energy', 'électricité des centres de données'], ['VRT', 'Vertiv', 'refroidissement et électricité'], ['AVGO', 'Broadcom', 'puces sur mesure'], ['CRWV', 'CoreWeave', 'location de centres de données'], ['QCOM', 'Qualcomm', 'puces de téléphone'], ['NVDA', 'Nvidia', 'processeurs d’IA']]
  .map(([s, n, what]) => [`<strong>${n}</strong> · ${what}`, chg(s, D4, REF, 1, 'cr'), px(s, REF, 'close', 2, 'crc')]);
sections.push(section('seance', 'La séance', 'D’abord la puce, puis presque tout le reste en fin de séance', pill('MESURÉ'), 'validated',
  `<p class="section-intro">À l’ouverture de New York, le marché ne baissait pas en bloc. La puce, la mémoire et les loueurs de centres de données chutaient, pendant que la consommation de base, l’assurance et l’électricité montaient. Puis la vente s’est étendue : en fin de séance, presque tout a cédé. Le S&amp;P 500 équipondéré (RSP, où chaque titre pèse le même poids) a fini à ${chg('RSP', D4, REF, 2, 'rsp_s')}, mieux que SPY (${chg('SPY', D4, REF, 2, 'spy_s')}), parce que les géants de la puce pèsent lourd dans l’indice. Mais il a baissé lui aussi.</p>`
  + table(['Ce qui a cassé', 'Jeudi', 'Clôture'], crashRows)
  + `<p class="section-intro">Nvidia a échangé ${volx('NVDA', REF, 10, 'nvda_v')} son volume moyen des dix séances précédentes, Micron ${volx('MU', REF, 10, 'mu_v')}. AppLovin fait exception, à ${chg('APP', D4, REF, 1, 'app_s')} après ses résultats : une histoire propre à la société.</p>`
  + `<h3 class="sub-head">Ce que notre visuel de 17 heures appelait « ce qui tient »</h3>`
  + table(['Valeur', `À ${lit('17h02')} (notre visuel)`, 'Clôture de jeudi', 'Verdict'], heldRows)
  + `<div class="quality-note warning-note"><strong>Notre erreur de 17 heures.</strong> Le visuel et les deux notifications de jeudi après-midi présentaient ces valeurs comme le côté qui tient. Quatre sur sept ont fini en baisse. Costco a tenu pour une raison qui lui est propre : ses ventes comparables américaines d’octobre ont progressé de ${reg('/facts/costco/us_comps_ex_gas_pct', fr(1, ' %'), 'cost_c', 'proactive_costco_20261105')} hors carburant (Proactive). La leçon : un relevé de séance n’est pas une clôture. Nous ne savons pas qui a vendu ces valeurs en fin de séance ; nous savons qu’un jour où la baisse gagne les indices entiers, les valeurs défensives ne protègent pas forcément jusqu’au soir. Nos messages en séance porteront désormais l’heure dans leur titre et diront « à cette heure », pas « tient ».</div>`
  + `<p class="provenance">Relevés de ${lit('17h02')} : visuel publié à ${lit('17h11')}, heure de Paris. Clôtures : cours vérifiés du ${refDay('ref_held')}.</p>`));

// 4. Pourquoi
sections.push(section('pourquoi', 'Pourquoi', 'Trois causes, et une nouvelle ce matin', pill('ATTRIBUÉ', 'partial'), 'partial',
  `<div class="three-col">`
  + `<article class="focus-card"><div class="focus-symbol">Le vote</div><p>Dans ${reg('/facts/ballots/states', fr(0), 'bal_st', 'cnbc_ai_meltdown_20261105')} États, ${reg('/facts/ballots/measures', fr(0), 'bal_m', 'cnbc_ai_meltdown_20261105')} mesures soumises au vote portaient sur des restrictions aux centres de données ; les électeurs se sont prononcés contre les centres de données partout sauf à Harwood, dans le Dakota du Nord (CNBC). Le même scrutin a donné aux démocrates les deux chambres du Congrès (voir notre daily du ${lit('5 novembre')}). Les stratèges d’UBS estiment qu’environ ${reg('/facts/ubs/dc_2028_at_risk_pct', fr(0, ' %'), 'ubs_a', 'etfcom_ai_selloff_20261106')} des capacités attendues en ${lit('2028')} sont menacées (etf.com).</p></article>`
  + `<article class="focus-card"><div class="focus-symbol">Les chiffres</div><p>Qualcomm a déçu sur ses puces de téléphone. Son directeur général affirme pourtant manquer d’offre, pas de demande : « We don’t have a demand issue; it’s a supply issue » (CNBC). Selon The Information, Microsoft a investi ${reg('/facts/msft/capex_shortfall_busd', fr(0, ' Md$'), 'msft_s', 'information_msft_20261105')} de moins que prévu au trimestre de septembre, faute de capacités louées livrées à temps ; Microsoft n’a reconnu que des retards de livraison.</p></article>`
  + `<article class="focus-card"><div class="focus-symbol">Ce matin</div><p>Reuters révèle qu’environ ${reg('/facts/chips/h200_hong_kong_units', fr(0), 'h200', 'reuters_h200_20261106')} puces ${lit('H200')} de Nvidia attendent à Hong Kong une autorisation d’importation que Pékin ne donne pas à grande échelle. C’est un risque de plus sur les ventes de Nvidia en Chine, à onze jours de ses résultats.</p></article>`
  + `</div>`
  + `<p class="section-intro">Notre lecture, faite sur les prix : le vote a servi de déclencheur à des doutes qui existaient déjà, sur les retards de livraison des centres de données. La politique peut ralentir les chantiers. Elle ne dit rien des commandes de puces déjà passées. Ce sont les résultats de CoreWeave le ${regD('coreweave_call', 'coreweave_ir_20261027', 'crw_d')} et de Nvidia le ${regD('nvidia_results', 'nvidia_ir_fy27q3', 'nv_d')} qui trancheront.</p>`
  + `<p class="provenance">Une attribution de presse dit ce qu’un journaliste ou un analyste affirme, pas ce que nous avons prouvé. Aucune donnée de flux ne nous dit qui a vendu.</p>`));

// 5. L'histoire du QQQ
const pz = v => Math.abs(v) < 0.0005 ? lit('0,0 %') : lit(frSigned(v * 100, 1));
const epRows = HIST.episodes.map(e => [lit(dfull(e.date)), lit(frSigned(e.ret * 100, 1)), pz(e.dd_before), e.f21 == null ? '' : lit(frSigned(e.f21 * 100, 1)), e.low63 == null ? '' : lit(frSigned(e.low63 * 100, 1)), e.f252 == null ? '' : lit(frSigned(e.f252 * 100, 1)), e.second_within_30 ? 'oui' : 'non']);
sections.push(section('histoire', 'Ce que disent 27 ans de QQQ', `Une séance à −5 % a été suivie d’une autre ${lit(String(H.second_within_30))} fois sur ${lit(String(H.n))}`, pill('MESURÉ'), 'validated',
  `<p class="section-intro">Depuis mars ${lit('1999')}, le QQQ a clôturé ${lit(String(HIST.days_count))} fois en baisse de ${lit('5 %')} ou plus avant jeudi, dont ${lit(String(HIST.days_by_year['2000'] + HIST.days_by_year['2001'] + HIST.days_by_year['2002']))} pendant l’éclatement de la bulle internet et ${lit(String(HIST.days_by_year['2008']))} en ${lit('2008')}. En regroupant les séances proches, cela fait ${lit(String(H.n))} épisodes. Voici ce qui a suivi le premier jour de chacun.</p>`
  + table(['Premier jour', 'Ce jour-là', 'Écart au plus-haut d’un an, la veille', 'Un mois après', 'Plus-bas des trois mois suivants', 'Un an après', 'Autre séance à −5 % dans les six semaines'], epRows)
  + `<div class="three-col">`
  + `<article class="focus-card"><div class="focus-symbol">Le mois suivant</div><div class="focus-what">${lit(String(H.f21_down))} fois sur ${lit(String(H.n))} plus bas</div><p>Médiane à un mois : ${hp(H.f21_median)} ; à trois mois, elle remonte à ${hp(H.f63_median)}. Acheter le premier jour a rarement payé tout de suite.</p></article>`
  + `<article class="focus-card"><div class="focus-symbol">Le creux</div><div class="focus-what">${hp(H.low63_median)} en médiane</div><p>C’est l’écart entre la clôture du premier jour et le plus-bas des trois mois suivants. Il va de presque rien (${lit('2011')}) à plus d’un tiers (septembre ${lit('2000')} et ${lit('2008')}).</p></article>`
  + `<article class="focus-card"><div class="focus-symbol">Un an après</div><div class="focus-what">${lit(String(H.f252_up))} fois sur ${lit(String(H.n))} plus haut</div><p>Médiane à un an : ${hp(H.f252_median)}. Les ${lit(String(LOSS1Y.length))} pertes à un an datent de ${lit('2000')} et ${lit('2001')}.</p></article>`
  + `</div>`
  + `<p class="section-intro">Avant jeudi, le QQQ n’était qu’à ${lit(frSigned((bar('QQQ', D4)[4] / Math.max(...QBARS.slice(-252).map(b => b.close)) - 1) * 100, 1))} de son plus-haut d’un an. ${lit(String(NEAR.length))} épisodes partaient à moins de ${lit('12 %')} du sommet : ${lit('2011')}, février ${lit('2020')}, septembre ${lit('2020')} et ${lit('2025')} se sont refermés en quelques mois. Janvier ${lit('2000')} aussi, avant l’éclatement de la bulle internet deux mois plus tard ; avril ${lit('2000')} en a ouvert le long marché baissier. Le chiffre ne dit pas lequel des deux nous vivons. Ce qu’il montre : ${lit(String(H.second_within_30))} épisodes sur ${lit(String(H.n))} ont connu une autre séance à ${lit('−5 %')} dans les six semaines.</p>`
  + `<p class="provenance">Clôtures ajustées des dividendes du QQQ, du ${lit('10 mars 1999')} au ${lit('4 novembre 2026')}, plus la séance de jeudi ; un épisode commence au premier jour à ${lit('−5 %')} après au moins ${lit('30')} séances sans. Pour janvier ${lit('2000')}, l’écart au plus-haut se mesure sur moins d’une année d’historique. ${lit(String(H.n))} épisodes, c’est peu : ce sont des fréquences passées. Calcul : <a href="/daily/20261106/_hist/qqq_minus5_days.json">données</a>.</p>`));

// 6. La rotation
const rotWin = `<div class="rot-windowbar" role="toolbar" aria-label="Fenêtre de calcul"><span class="rot-windowbar-label">Fenêtre</span><div class="rotation-tabs" id="rotWinTabs"></div></div>`;
const rotChart = (id, title, aria, h) => `<div class="rotation-chart-block"><div class="rotation-chart-title">${title}</div>${id === 'rotRisk' ? '' : `<div class="rot-controls" id="${id}Ctl"></div>`}<div id="${id}" class="rotation-chart-host rot-auto" role="img" aria-label="${aria}" style="height:${h}px"></div></div>`;
sections.push(section('rotation-indices', 'La rotation, mise à jour', 'Depuis l’élection, la puce et les titres nerveux reculent le plus', pill('MESURÉ'), 'validated',
  `<p class="section-intro">Nous avons recalculé le S&amp;P 500, le Nasdaq-100 et le Dow Jones titre par titre sur les clôtures de jeudi. Depuis le vote du ${lit('3 novembre')}, l’indice pondéré par les capitalisations recule plus que la moyenne simple de ses titres : les géants tirent vers le bas. Nvidia est, de loin, la société qui a le plus coûté à l’indice. Par famille, les valeurs défensives montent encore, la croissance recule le plus. Le cinquième le plus volatil du S&amp;P 500 chute, le cinquième le plus calme progresse. Par secteur, la consommation de base mène ; l’énergie et la technologie ferment la marche, l’énergie parce que le pétrole a chuté mercredi.</p>`
  + `<p class="section-intro">Hors des États-Unis, la Corée et Taïwan, les deux places de la puce, sont les plus touchées depuis l’élection, et la Chine est la seule grande place en nette hausse. Jeudi, la Corée (EWY) a fait ${chg('EWY', D4, REF, 1, 'rx_ewy')}, Taïwan (EWT) ${chg('EWT', D4, REF, 1, 'rx_ewt')}, l’Euro Stoxx ${lit('50')} (FEZ, en dollars) ${chg('FEZ', D4, REF, 1, 'rx_fez')}. Les actions à bêta élevé (SPHB, celles qui amplifient les mouvements du marché) ont perdu ${chg('SPHB', D4, REF, 1, 'rx_sphb')}, les actions peu volatiles (SPLV) ${chg('SPLV', D4, REF, 1, 'rx_splv')}.</p>`
  + `<div class="quality-note"><strong>Correction de la page Rotations.</strong> Deux fonds factoriels d’iShares, MTUM (momentum) et QUAL (qualité), affichaient ce matin une chute de plus de ${lit('75 %')}. Ce n’était pas une chute : leurs cours n’étaient pas ajustés d’une division du nombre de parts. Nous les avons retirés de la page jusqu’à disposer de cours ajustés, et le calcul écarte désormais tout fonds qui perd ${lit('40 %')} ou gagne ${lit('67 %')} en une séance.</div>`
  + `<div class="rotation-page rot-embed">${rotWin}<div class="rot-grid-2">`
  + rotChart('rotSect', 'S&amp;P 500 par secteur, pondéré par les capitalisations', 'Course des secteurs du S&amp;P 500, variation cumulée depuis la base de la fenêtre', 360)
  + rotChart('rotPlaces', 'Places boursières (ETF cotés à New York, en dollars)', 'Course des ETF des places boursières, variation cumulée depuis la base de la fenêtre', 560)
  + `</div>` + rotChart('rotRisk', 'Thermomètre du risque : rapports entre ETF, rebasés à zéro à la base', 'Rapports entre ETF de risque, rebasés à la date de base de la fenêtre', 380) + `</div>`
  + `<p class="provenance">Instantané figé des clôtures du ${lit('5 novembre')} (<a href="/daily/20261106/rotation-indices.json">données</a>) : composition actuelle des indices, pondération par la capitalisation de début de fenêtre avec le nombre d’actions actuel, cours hors dividendes. Les places étrangères passent par leur ETF coté à New York, change compris. Thèmes, tailles, volatilité, Nasdaq-100 et Dow Jones : <a href="/rotation/?w=event">page Rotations</a>.</p>`));

// 7. Nos prévisions
const sig1 = `SPHB à ${px('SPHB', REF, 'close', 2, 'sg_sphb')}, loin des ${lit('137,10 $')} à repasser ; jeudi ${chg('SPHB', D4, REF, 1, 'sg_sphb_d')} contre ${chg('SPLV', D4, REF, 1, 'sg_splv_d')} pour SPLV`;
const sig2 = `SPY ${chg('SPY', D4, REF, 2, 'sg_spy')}, RSP ${chg('RSP', D4, REF, 2, 'sg_rsp')} : l’indice fait pire que l’action moyenne`;
const sig3 = `Corée (EWY) ${chg('EWY', D4, REF, 1, 'sg_ewy')}, Taïwan (EWT) ${chg('EWT', D4, REF, 1, 'sg_ewt')}`;
const usoD3 = bar('USO', D3)[4];
if (!(bar('USO', REF)[4] < usoD3 && bar('HCA', REF)[4] > SL.HCA.invalidation_level && bar('PHM', REF)[4] > SL.PHM.invalidation_level)) throw new Error('test « on a tort » du 5 novembre');
const smhNeed = (478 / bar('SMH', REF)[4] - 1) * 100;
const prevRows = [
  [`Visuel du ${lit('5 novembre')}, signe de fin n° ${lit('1')} : les actions risquées repartent`, sig1, verdict('Éteint', 'faux')],
  [`Signe n° ${lit('2')} : les géants rebondissent et l’indice rattrape l’action moyenne`, sig2, verdict('Éteint', 'faux')],
  [`Signe n° ${lit('3')} : la Corée et Taïwan arrêtent de baisser`, sig3, verdict('Éteint', 'faux')],
  [`Daily du ${lit('5 novembre')}, « nous changeons d’avis si » le pétrole (USO) repasse au-dessus de ${px('USO', D3, 'close', 2, 'pv_uso3')} ou si HCA et PulteGroup clôturent sous leur plus-bas de mercredi, d’ici vendredi soir`, `USO ${px('USO', REF, 'close', 2, 'pv_uso')}, HCA ${px('HCA', REF, 'close', 2, 'pv_hca')}, PulteGroup ${px('PHM', REF, 'close', 2, 'pv_phm')} : aucun des trois seuils touché`, verdict('Tient, jusqu’à ce soir', 'partiel')],
  [`Daily du ${lit('5 novembre')}, scénario contraire : « la baisse de la puce peut aussi gagner les indices »`, `SPY ${chg('SPY', D4, REF, 2, 'pv_spy')}, onze secteurs sur onze en baisse`, verdict('Vrai', 'vrai')],
  [`Daily du ${lit('5 novembre')}, scénario de base : la rotation continue`, `Défensives devant la croissance, mais tout baisse : consommation de base (XLP) ${chg('XLP', D4, REF, 2, 'pv_xlp')}, technologie (XLK) ${chg('XLK', D4, REF, 1, 'pv_xlk')}`, verdict('Partiel', 'partiel')],
  [`Daily du ${lit('5 novembre')} : « pas de nouvelle ligne de semi-conducteur »`, `SMH ${chg('SMH', D4, REF, 1, 'pv_smh')}`, verdict('Vrai', 'vrai')],
  [`Notifications de ${lit('17 heures')} : « les valeurs solides tiennent »`, `Allstate ${chg('ALL', D4, REF, 1, 'pv_all')}, Exxon ${chg('XOM', D4, REF, 1, 'pv_xom')}, Walmart ${chg('WMT', D4, REF, 1, 'pv_wmt')} à la clôture. En relatif, les sept valeurs ont battu SPY (${chg('SPY', D4, REF, 2, 'pv_spy2')}) de ${lit(frNum(RELMIN, 1))} à ${lit(frNum(RELMAX, 1) + ' points')}`, verdict('Faux en absolu', 'faux')],
  [`Notifications de ${lit('17 heures')}, « on a tort si » SMH finit vendredi au-dessus de ${usd(478)}`, `SMH ${px('SMH', REF, 'close', 2, 'pv_smhc')} jeudi soir : il lui faut ${lit(frSigned(smhNeed, 1))} aujourd’hui`, verdict('En cours', 'neutre')]
];
sections.push(section('previsions', 'Nos prévisions', 'Ce qu’elles valaient jeudi soir', pill('MESURÉ', 'risk'), 'partial',
  table(['Ce que nous avons publié', 'Jeudi à la clôture', 'Verdict'], prevRows)
  + `<p class="section-intro">Nos trois signes de fin de rotation restent éteints, et l’écart s’est creusé : la puce continue de mener la baisse. Nos deux erreurs de la semaine vont dans le même sens. Le ${lit('3 novembre')}, nous attendions un vote sans surprise ; jeudi après-midi, nous avons pris une baisse ciblée pour une baisse contenue. Dans les deux cas, nous avons sous-estimé la vitesse à laquelle un choc sur la puce se propage au reste du marché.</p>`));

// 8. Bilan du 31 octobre
const execCell = x => {
  if (x.fill === undefined) return `${verdict('Non exécuté', 'neutre')} · plus bas ${bp(x, x.closeI, 3, 'lofa')} jeudi`;
  if (x.fillAtOpen) return `${dshort(x.fillDay)} à l’ouverture, ${bp(x, x.fillI, 1, 'fo')}`;
  return `${dshort(x.fillDay)} à ${usd(x.entry)}`;
};
const exitCell = x => {
  if (x.status === 'cible') return `${verdict('Cible', 'vrai')} ${usd(x.target)} le ${dshort(x.exitDay)}`;
  if (x.status === 'stop') return `${verdict('Stop', 'faux')} ${usd(x.stop)} le ${dshort(x.exitDay)} (plus bas ${bp(x, x.exitI, 3, 'xl')})`;
  if (x.status === 'ouverte') return `${verdict('Ouverte', 'partiel')} · clôture ${bp(x, x.closeI, 4, 'xc')}`;
  return `ordre toujours posé, clôture ${bp(x, x.closeI, 4, 'xcf')}`;
};
const cCell = x => `${lit(frSigned(x.c.r, 2, ' R'))}${x.c.status === 'à vendre' ? ` · à vendre ce vendredi (clôture ${bp(x, x.closeI, 4, 'cc')})` : x.c.status !== x.status ? (x.c.closed ? ' · soldée' : ' latents · ouverte') : ''}`;
const bilanRows = SETUPS.map(x => [`<strong>${x.s}</strong> · ${x.name}`, `${usd(x.entry)} / ${usd(x.stop)} / ${usd(x.target)}`, execCell(x), exitCell(x), x.fill === undefined ? '' : lit(frSigned(x.r, 2, ' R')), x.fill === undefined ? '' : cCell(x)]);
const rData = executed.map(x => ({ s: x.s, v: +x.r.toFixed(2), vc: +x.c.r.toFixed(2), closed: x.closed }));
sections.push(section('bilan', 'Suite du daily du 31 octobre', 'Deux stops de plus, et la règle de clôture coûte désormais plus cher', pill('MESURÉ', 'risk'), 'partial',
  `<p class="section-intro">Mêmes règles que dans notre édition d’hier. Stop posé : un plus-bas sous le stop vaut sortie au stop. Règle de clôture, celle que nous avions prescrite le ${lit('3 novembre')} : une clôture sous le stop vaut vente à l’ouverture suivante. Dans les deux cas, un plus-haut au-dessus de la cible vaut vente à la cible.</p>`
  + table(['Titre', 'Entrée / stop / cible', 'Achat', 'Stop posé : état', 'En R, stop posé', 'En R, règle de clôture'], bilanRows)
  + `<div id="bilanChart" class="echart-box" role="img" aria-label="Résultat de chaque plan exécuté du 31 octobre, en multiples du risque prévu, au 5 novembre, selon le stop posé et selon la règle de clôture" style="width:100%; height:320px; margin-top:1rem;"></div>`
  + `<div class="two-col">`
  + `<article class="focus-card"><div class="focus-symbol">Stop posé</div><div class="focus-what">${lit(frSigned(sumR, 2, ' R'))}</div><p>Dont ${lit(frSigned(realizedR, 2, ' R'))} encaissés sur ${lit('six')} lignes soldées (deux cibles, quatre stops) et ${lit(frSigned(latentR, 2, ' R'))} latents sur UnitedHealth et Salesforce, arrondis au centième.</p></article>`
  + `<article class="focus-card"><div class="focus-symbol">Règle de clôture</div><div class="focus-what">${lit(frSigned(sumRc, 2, ' R'))}</div><p>Mercredi, elle faisait mieux. Jeudi, Okta, Johnson Controls et CrowdStrike ont clôturé sous leur stop : la vente se fait ce vendredi à l’ouverture, plus bas que le stop. Comptées à la clôture de jeudi, ces trois lignes pèsent ${lit(frSigned(S.OKTA.c.r, 2, ' R'))}, ${lit(frSigned(S.JCI.c.r, 2, ' R'))} et ${lit(frSigned(S.CRWD.c.r, 2, ' R'))}.</p></article>`
  + `</div>`
  + `<div class="quality-note warning-note"><strong>Si vous appliquez la règle de clôture.</strong> Okta, Johnson Controls et CrowdStrike se vendent ce vendredi à l’ouverture de New York (${lit('15h30')} à Paris), quel que soit le prix. L’ETF IGV a clôturé ${lit(frNum(igvCloseAbove, 2) + ' $')} au-dessus de son stop de ${usd(99)} : il reste ouvert, et une clôture dessous ce soir, à ${nyClose('nyc_igv')} heure de Paris, le fait vendre lundi. UnitedHealth et Salesforce gardent leurs niveaux. Fin de toutes ces lignes le ${lit(END31_TXT)}, avant ${lit('21h45')}, heure de Paris. L’ordre Fastenal à ${usd(50.8)} n’a jamais été servi et s’annule à la même date. Frais et glissement d’exécution (l’écart entre le prix visé et le prix obtenu) ne sont pas comptés.</div>`));

// 9. Le scan du 5 novembre
const scanRows = LINES.map(x => [
  `<strong>${x.ticker}</strong> · ${SHORT[x.ticker] || x.name}`, `${usd2(x.entry)} / ${usd2(x.stop)} / ${usd2(x.tp1)}`, usd2(x.invalidation_level),
  x.via === 'limite' ? `ordre limité, servi en baisse` : `stop-limite, servi en hausse`,
  x.state === 'stop' ? `${verdict('Stop', 'faux')} ${usd2(x.stop)} (plus bas ${px(x.ticker, REF, 'low', 2, 'sl')})` : `${verdict('Ouverte', 'partiel')} · clôture ${px(x.ticker, REF, 'close', 2, 'sc')}`,
  lit(frSigned(x.r, 2, ' R'))]);
sections.push(section('trade', 'Le scan du 5 novembre', 'Huit achats le jour de la chute, aucune idée nouvelle aujourd’hui', pill('ATTENDRE', 'partial'), 'partial',
  `<p class="section-intro">Les huit lignes ont été servies jeudi, au prix de la clôture de mercredi : six parce que le cours est redescendu jusqu’au prix, Canadian Pacific et Nike parce qu’il y est remonté après une ouverture plus basse. Acheter huit lignes le même jour expose à la même séance. Nous l’écrivions hier : « si la séance de mercredi se défait, elles reculent ensemble ». C’est ce qui s’est passé.</p>`
  + `<p class="scroll-hint" aria-hidden="true">Faites glisser le tableau →</p>`
  + table(['Ligne', 'Entrée / stop / objectif', 'Invalidation : clôture qui annule l’idée', 'Ordre d’achat', 'État jeudi soir', 'En R'], scanRows)
  + `<div class="two-col">`
  + `<article class="focus-card"><div class="focus-symbol">Total à la clôture</div><div class="focus-what">${lit(frSigned(scanR, 2, ' R'))}</div><p>Le fonds des matériaux (XLB) a touché son stop dans la séance : ${lit('−1 R')}. Si votre stop XLB n’était pas posé, vendez à l’ouverture : il a aussi clôturé sous son invalidation. Les sept autres lignes restent ouvertes, stops en place.</p></article>`
  + `<article class="focus-card"><div class="focus-symbol">La plus fragile</div><div class="focus-what">Nike</div><p>Clôture à ${px('NKE', REF, 'close', 2, 'nke_c')}, ${lit(frNum(nkeMargin, 2) + ' $')} au-dessus de son invalidation (${usd2(SL.NKE.invalidation_level)}). Une clôture dessous ce soir (${nyClose('nyc_nke')}, heure de Paris) la fait vendre lundi à l’ouverture. Le stop, ${usd2(SL.NKE.stop)}, reste en place pendant la séance.</p></article>`
  + `</div>`
  + `<ul class="checklist">`
  + `<li><i class="fas fa-ban"></i><div><strong>Aucune idée nouvelle aujourd’hui.</strong><br>Pas de scan ce matin, et nous n’achetons pas le lendemain d’une première séance à ${lit('−5 %')} : ${lit(String(H.f21_down))} fois sur ${lit(String(H.n))}, le QQQ était plus bas un mois plus tard.</div></li>`
  + `<li><i class="fas fa-shield-halved"></i><div><strong>Les stops restent où ils sont.</strong><br>Ne les baissez pas pour « laisser une chance ». Attention à l’ouverture : si une action ouvre sous votre stop, l’ordre part au premier cours disponible, parfois bien plus bas. Un stop ne garantit pas son prix. Pour sortir, utilisez un stop simple (au marché), pas un stop-limite, qui peut ne jamais s’exécuter sur un trou de cotation. Pour vendre à l’ouverture, passez un ordre au marché avant ${lit('15h30')}. La sortie forcée du scan reste le ${lit('18 novembre')}, avant ${lit('21h45')}, heure de Paris.</div></li>`
  + `<li><i class="fas fa-scale-balanced"></i><div><strong>Plafond de risque : ${lit('4 %')} du capital sur l’ensemble.</strong><br>Risque d’une ligne = (cours actuel − stop) × nombre de titres. Additionnez toutes les lignes ouvertes, celles du ${lit('31 octobre')} comme celles du scan. Au-delà de ${lit('4 %')} du capital, allégez d’abord le logiciel : Autodesk, Salesforce et l’ETF IGV sont le même pari.</div></li><li><i class="fas fa-hourglass-half"></i><div><strong>L’ordre Fastenal du ${lit('31 octobre')}.</strong><br>C’est un ordre d’achat déjà publié, à ${usd2(50.8)}, loin sous le cours. Nous le laissons compter tel quel jusqu’au ${lit(END31_TXT)}. Si vous ne voulez rien acheter tant que la puce baisse, annulez-le : c’est cohérent avec cette édition.</div></li>`
  + `</ul>`));

// 10. Formation
sections.push(section('formation', 'Formation du jour', 'La règle de clôture a perdu sa meilleure journée', pill('PÉDAGOGIE'), 'validated',
  `<div class="pedagogy-box"><p>Mercredi, la règle de clôture paraissait plus généreuse que le stop posé : Okta et Johnson Controls avaient touché leur stop en séance sans clôturer dessous. Jeudi, les deux titres ont clôturé loin sous leur stop, et CrowdStrike aussi. Celui qui tient ces lignes avec la règle de clôture vend ce vendredi à l’ouverture, au prix du jour, plus bas que le stop d’origine.</p>`
  + `<p><strong>Ce que montre cette semaine.</strong> Le stop posé coûte parfois une sortie inutile, comme Okta le ${lit('3 novembre')}, sorti à ${usd(183)} avant de remonter. La règle de clôture, elle, laisse filer la perte les jours où tout baisse. Sur ces plans, le premier compte fait ${lit(frSigned(sumR, 2, ' R'))}, le second ${lit(frSigned(sumRc, 2, ' R'))}. Une semaine ne prouve rien. Mais elle montre que le choix d’une règle se fait avant l’achat, jamais après avoir vu ce qui aurait mieux marché.</p>`
  + `<p><strong>La règle que nous appliquons désormais à nos plans :</strong> stop posé dès l’achat dans le système du courtier, et, en plus, une clôture sous l’invalidation fait vendre à l’ouverture suivante. C’est celle du scan du ${lit('5 novembre')}. Le stop limite la perte du jour ; l’invalidation sort plus tôt quand la thèse casse sans toucher le stop.</p></div>`));

// 11. Scénarios
sections.push(section('scenarios', 'Scénarios', 'Ce qui peut se passer d’ici le 17 novembre', pill('À SURVEILLER', 'partial'), 'partial',
  `<div class="scenario-grid">`
  + `<article class="scenario base"><h3>Base : la baisse se prolonge par à-coups</h3><p>Dans ${lit(String(H.second_within_30))} épisodes sur ${lit(String(H.n))}, une autre séance à ${lit('−5 %')} a suivi dans les six semaines. La puce et les loueurs de centres de données restent sous pression jusqu’aux résultats de CoreWeave et de Nvidia.</p></article>`
  + `<article class="scenario down"><h3>Contraire : l’emploi ajoute un choc de taux</h3><p>Sur Polymarket, la hausse de la Fed en décembre est cotée ${fedR('fed_s')} ce matin, ${fedD('fed_sd')} en ${lit('24 heures')} (cote de ${fedAt()}, heure de Paris). Un emploi très fort à ${paris(nfp, 'nfp_s')} relancerait ce pari et frapperait un marché déjà fragile.</p></article>`
  + `<article class="scenario flat"><h3>Rebond partiel</h3><p>Un emploi modéré et le recul du dix ans (${reg('/facts/close/ust10y_pct', fr(2, ' %'), 'ust_s', 'ap_asia_20261106')} contre ${reg('/facts/close/ust10y_prev_pct', fr(2, ' %'), 'ust_s0', 'ap_asia_20261106')}, AP) peuvent suffire à un rattrapage, sans effacer la moitié de la chute. ${lit(String(H.n - H.f21_down))} épisodes sur ${lit(String(H.n))} étaient plus hauts un mois après le premier jour.</p></article>`
  + `<article class="scenario up"><h3>Quand nous aurons tort</h3><p>SMH au-dessus de ${usd(478)} à la clôture de ce soir suffit à nous donner tort sur la suite : la moitié de la chute de jeudi serait effacée, un simple coup de vent. Un QQQ au-dessus de sa moyenne des ${lit('200')} dernières séances, ${lit(SMA_TXT + ' $')} environ, en clôture d’ici le ${lit('17 novembre')}, nous ferait lever la prudence.</p></article>`
  + `</div>`));

// 12. Agenda
const echeancier = renderEventTimeline({
  id: 'echeancier', asof: '2026-11-06', from: '2026-11-06', to: '2026-11-13', requireProof: true,
  keyWindow: { from: '2026-11-10', to: '2026-11-10', labelHtml: `Fenêtre clé · mardi ${regT('cpi_release', 'bls_cpi', 'kw_a')} → ${regT('coreweave_call', 'coreweave_ir_20261027', 'kw_b')}` },
  events: [
    { date: '2026-11-06', category: 'macro', impact: 'strong', label: 'Emploi américain', detail: 'octobre', icon: 'data', proof: paris(nfp, 'tl_nfp') },
    { date: '2026-11-06', category: 'macro', impact: 'medium', label: 'Fed, Bowman', detail: 'supervision bancaire', icon: 'bank', proof: paris(bowman, 'tl_bow') },
    { date: '2026-11-10', category: 'macro', impact: 'strong', label: 'Inflation (CPI)', detail: 'octobre', icon: 'data', proof: regT('cpi_release', 'bls_cpi', 'tl_cpi') },
    { date: '2026-11-10', category: 'earnings', impact: 'strong', label: 'CoreWeave', detail: 'conférence de résultats', icon: 'chip', proof: regT('coreweave_call', 'coreweave_ir_20261027', 'tl_crw') },
    { date: '2026-11-13', category: 'macro', impact: 'medium', label: 'Prix à la production', detail: 'octobre', icon: 'data', proof: regT('ppi_release', 'bls_ppi', 'tl_ppi') }
  ],
  chains: [
    { steps: [{ label: 'Emploi fort', icon: 'data', category: 'macro' }, { label: 'Hausse de taux', icon: 'bank', tone: 'up' }, { label: 'Croissance', category: 'plan', icon: 'chip', tone: 'down' }] },
    { steps: [{ label: 'CoreWeave rassure', icon: 'chip', category: 'earnings' }, { label: 'Financement', icon: 'bank', tone: 'up' }, { label: 'Centres de données', category: 'plan', icon: 'company', tone: 'up' }] },
    { steps: [{ label: 'Pétrole monte', icon: 'oil', category: 'geo' }, { label: 'Inflation', icon: 'data', tone: 'up' }, { label: 'Toute la cote', category: 'plan', icon: 'company', tone: 'down' }] }
  ]
});
sections.push(section('agenda', 'Agenda', 'Ce qui peut bouger la Bourse jusqu’au vendredi 13', pill('DATÉ'), 'validated',
  echeancier
  + `<p class="section-intro">L’emploi d’octobre tombe aujourd’hui à ${paris(nfp, 'nfp_p')}, heure de Paris ; New York ouvre à ${lit('15h30')} et clôture à ${nyClose('nyc_a')}. Mardi ${regD('cpi_release', 'bls_cpi', 'cpi_d')}, l’inflation à ${regT('cpi_release', 'bls_cpi', 'cpi_p')}, puis CoreWeave à ${regT('coreweave_call', 'coreweave_ir_20261027', 'crw_p')}, le même jour. Nvidia publie le ${regD('nvidia_results', 'nvidia_ir_fy27q3', 'nv_d2')} vers ${regT('nvidia_results', 'nvidia_ir_fy27q3', 'nv_p')}, date confirmée par la société ; la sortie forcée du scan, le ${lit('18 novembre')}, suit le lendemain.</p>`
  + `<p class="provenance">Horaires : calendrier macro collecté (emploi, Fed), calendrier officiel de la BLS (inflation, prix à la production), communiqués de CoreWeave et de Nvidia.</p>`));

// 13. Ailleurs
sections.push(section('ailleurs', 'Ailleurs', 'Asie, crypto, matières premières', pill('PARTIEL', 'partial'), 'partial',
  `<div class="two-col"><article class="data-card"><h3>Asie ce vendredi</h3><p>Le Nikkei a fini à ${reg('/facts/asia/nikkei_level', fr(2), 'nik_l', 'ap_asia_20261106')} (${reg('/facts/asia/nikkei_pct', fr(1, ' %', true), 'nik_b', 'ap_asia_20261106')}), sous ${lit('60 000')} points pour la première fois depuis environ six mois ; le Kospi à ${reg('/facts/asia/kospi_level', fr(2), 'ksp_l', 'ap_asia_20261106')} (${reg('/facts/asia/kospi_pct', fr(1, ' %', true), 'ksp_b', 'ap_asia_20261106')}). Hong Kong (${reg('/facts/asia/hang_seng_pct', fr(1, ' %', true), 'hsi', 'ap_asia_20261106')}) et Shanghai (${reg('/facts/asia/shanghai_pct', fr(1, ' %', true), 'sha', 'ap_asia_20261106')}) résistent mieux (AP). Selon l’AFP, Pékin a réactivé des outils destinés à encourager les achats d’actions.</p></article>`
  + `<article class="data-card"><h3>Crypto, pétrole, or</h3><p>Sur la bougie UTC du ${lit('5 novembre')}, le bitcoin a fini à ${px('BTC-USD', REF, 'close', 0, 'btc_c')} (${chg('BTC-USD', D4, REF, 1, 'btc_c2')}) et l’ether à ${px('ETH-USD', REF, 'close', 2, 'eth_c')} (${chg('ETH-USD', D4, REF, 1, 'eth_c2')}) ; ce matin, le bitcoin cote ${offPx(btcLive, 0, 'btc_l', ' $')}, un relevé. Le pétrole a pris ${chg('USO', D4, REF, 1, 'uso_c')} jeudi (USO) et le Brent cote ${reg('/facts/asia/brent_usd', fr(2, ' $'), 'brent', 'ap_asia_20261106')} selon AP. L’or (GLD) a gagné ${chg('GLD', D4, REF, 1, 'gld_c')}, les obligations à long terme (TLT) ${chg('TLT', D4, REF, 2, 'tlt_c')}.</p></article></div>`));

// 14. À surveiller
sections.push(section('surveiller', 'À surveiller', 'Cinq points de contrôle aujourd’hui', pill('CHECKLIST'), 'validated',
  `<ul class="checklist">`
  + `<li><i class="fas fa-briefcase"></i><div><strong>L’emploi à ${paris(nfp, 'nfp_w')}.</strong><br>Un chiffre très fort relance la hausse de taux de décembre, cotée ${fedR('fed_w')} ce matin sur Polymarket.</div></li>`
  + `<li><i class="fas fa-microchip"></i><div><strong>SMH à la clôture, ${nyClose('nyc_w')} heure de Paris.</strong><br>Au-dessus de ${usd(478)}, nous avons eu tort sur la suite. Clôture de jeudi : ${px('SMH', REF, 'close', 2, 'smh_w')}.</div></li>`
  + `<li><i class="fas fa-chart-line"></i><div><strong>Le QQQ face à sa moyenne des ${lit('200')} séances.</strong><br>Environ ${lit(SMA_TXT + ' $')} ; clôture de jeudi à ${px('QQQ', REF, 'close', 2, 'qqq_w')}.</div></li>`
  + `<li><i class="fas fa-list-check"></i><div><strong>Nike et l’ETF IGV.</strong><br>Nike à ${lit(frNum(nkeMargin, 2) + ' $')} de son invalidation, IGV à ${lit(frNum(igvCloseAbove, 2) + ' $')} de son stop pour la règle de clôture.</div></li>`
  + `<li><i class="fas fa-oil-can"></i><div><strong>Le pétrole.</strong><br>Le WTI cote ${offPx(wti, 2, 'wti_s', ' $')} ce matin, ${offRet(wti, '24h_pct', 'wti_24')} sur ${lit('24 heures')}. Un baril durablement plus cher pèserait sur les anticipations d’inflation. USO au-dessus de ${px('USO', D3, 'close', 2, 'uso_w')} ce soir ferait tomber notre scénario de rotation du ${lit('5 novembre')}.</div></li>`
  + `</ul>`));

// 15. Sources
const srcLinks = [
  ['https://www.cnbc.com/2026/11/05/qualcomm-earnings-chip-stocks-election.html', 'CNBC, 5 novembre : la séance, les mesures sur les centres de données, Qualcomm'],
  ['https://finance.yahoo.com/markets/stocks/articles/ai-selloff-deepens-chip-etfs-025227411.html', 'etf.com, 6 novembre : les ETF de la puce, UBS'],
  ['https://finance.yahoo.com/news/exclusive-nvidia-chips-pile-hong-112651215.html', 'Reuters, 6 novembre : les puces de Nvidia bloquées à Hong Kong'],
  ['https://finance.yahoo.com/technology/ai/articles/iren-sinks-9-report-links-145050332.html', '24/7 Wall St., 5 novembre, d’après The Information : Microsoft'],
  ['https://finance.yahoo.com/markets/stocks/articles/costco-retains-bofa-buy-october-192000711.html', 'Proactive, 5 novembre : les ventes d’octobre de Costco'],
  ['https://www.wsls.com/business/2026/11/06/japans-stock-benchmark-nikkei-tumbles-more-than-6-after-trading-opens/', 'AP, 6 novembre : l’Asie, le pétrole, les taux'],
  ['https://finance.yahoo.com/technology/ai/articles/beijing-seeks-bolster-ai-shares-071756887.html', 'AFP, 6 novembre : Pékin soutient ses valeurs de l’IA'],
  ['https://investors.coreweave.com/news/news-details/2026/CoreWeave-Announces-Date-of-Third-Quarter-2026-Financial-Results-and-Conference-Call/default.aspx', 'CoreWeave : date des résultats'],
  ['https://investor.nvidia.com/events-and-presentations/events-and-presentations/event-details/2026/NVIDIA-3rd-Quarter-FY27-Financial-Results/default.aspx', 'Nvidia : date des résultats'],
  ['https://www.bls.gov/schedule/news_release/cpi.htm', 'BLS : calendrier de l’inflation'],
  ['https://www.bls.gov/schedule/news_release/ppi.htm', 'BLS : calendrier des prix à la production'],
  ['/daily/20261105/', 'Notre daily du 5 novembre'],
  ['/scanner/20261105/', 'Notre scan du 5 novembre'],
  ['/daily/20261031/', 'Notre daily du 31 octobre : les neuf plans'],
  ['/rotation/', 'La page Rotations']
].map(([u, l]) => `<li><a href="${u}"${u.startsWith('http') ? ' rel="noopener" target="_blank"' : ''}>${l}</a></li>`).join('');
sections.push(section('sources', 'Sources et limites', 'Sur quoi repose cette édition', pill('PARTIEL', 'partial'), 'partial',
  `<div class="source-list">`
  + `<div class="source-item"><strong>Cours</strong><span>Clôtures vérifiées du ${refDay('ref_s', 'full')} ; bougies crypto UTC terminées à la même date. Plans du ${lit('31 octobre')} suivis du ${lit('2')} au ${lit('5 novembre')}, lignes du scan sur la séance du ${lit('5 novembre')}.</span></div>`
  + `<div class="source-item"><strong>Relevés de ce vendredi</strong><span>Contrats à terme, pétrole, bitcoin et cotes Polymarket : relevés de la matinée, jamais des clôtures.</span></div>`
  + `<div class="source-item"><strong>Attributions</strong><span>CNBC, etf.com, Reuters, The Information (par 24/7 Wall St.), Proactive, AP et l’AFP ; BLS, CoreWeave et Nvidia pour le calendrier.</span></div>`
  + `</div>`
  + `<ul class="provenance">${srcLinks}</ul>`
  + `<div class="quality-note warning-note"><strong>Limites.</strong> L’exécution des ordres est reconstituée sur les barres du jour ; l’ordre des prix dans la séance n’est vérifié que lorsqu’il change le résultat (Nike). Les bilans ne comptent ni frais ni glissement. Les statistiques historiques portent sur ${lit(String(H.n))} épisodes.</div>`
  + `<p class="section-intro">Ce contenu est informatif. Il ne constitue pas un conseil en investissement. Investir comporte un risque de perte en capital.</p>`));

// ── Noms et repères écrits en toutes lettres : littéraux déclarés, liste close ─
const LITERAL_PATTERNS = [
  /S&amp;P 500/g, /S&P 500/g, /Nasdaq-100/g, /\b(?:19|20)\d{2}\b/g,
  /\b\d{1,2}(?:er)? (?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\b/g,
  /\b(?:30 jours|24 heures|17 heures|9 jours|3 mois)\b/g, /(?<![\p{L}])(?:deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|vingt|tiers|moitié)(?![\p{L}])/giu,
  /24\/7 Wall St\./g, /\b20 ans\b/g, /\bvendredi 13\b/g, /\b17 h 02\b/g, /\b27 ans\b/g, /−5 %/g, /\b4 novembre\b/g
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
  { id: 'movesChart', spec: { grid: { left: 210, right: 56, top: 12, bottom: 32 }, xAxis: { type: 'value', axisLabel: { formatter: '{value} %' } }, yAxis: { type: 'category', data: moveData.map(x => x.label), axisLabel: { fontSize: 11 } }, series: [{ type: 'bar', data: moveData.map(x => ({ value: x.v, itemStyle: { color: x.v >= 0 ? '#0b8f62' : '#c73d4b' } })), label: { show: true, position: 'right', formatter: '{c} %', fontSize: 10 } }] } },
  { id: 'bilanChart', spec: { grid: { left: 56, right: 18, top: 40, bottom: 32 }, xAxis: { type: 'category', data: rData.map(x => x.s) }, yAxis: { type: 'value', name: 'R', axisLabel: { formatter: '{value} R' } }, legend: { top: 0, data: ['Stop posé', 'Règle de clôture'] }, series: [{ name: 'Stop posé', type: 'bar', data: rData.map(x => ({ value: x.v, itemStyle: { color: x.v >= 0 ? '#0b8f62' : '#c73d4b', opacity: x.closed ? 1 : 0.55 } })), label: { show: true, position: 'top', formatter: '{c} R', fontSize: 10 } }, { name: 'Règle de clôture', type: 'bar', itemStyle: { color: '#5b6b80' }, data: rData.map(x => x.vc), label: { show: true, position: 'top', formatter: '{c} R', fontSize: 10 } }] } }
];

// ── Page ─────────────────────────────────────────────────────────────────────
const title = 'La puce a entraîné toute la cote : on attend, stops en place';
const description = `Daily du 6 novembre 2026. Jeudi, le Nasdaq-100 (QQQ) a perdu ${frSigned(chgV('QQQ'), 1)}, sa pire séance depuis mars 2020, les semi-conducteurs ${frSigned(chgV('SMH'), 1)} et le S&P 500 ${frSigned(chgV('SPY'), 1)}. Ce qui a cassé, ce qui a lâché en fin de séance, ce que disent 27 ans de QQQ, la rotation recalculée et le statut de nos prévisions depuis le 31 octobre.`;
const badges = [`QQQ ${frSigned(chgV('QQQ'), 1)}`, `Puces ${frSigned(chgV('SMH'), 1)}`, `S&P 500 ${frSigned(chgV('SPY'), 1)}`, `Plans du 31 octobre : ${frSigned(sumR, 2, ' R')}`, `Scan du 5 novembre : ${frSigned(scanR, 2, ' R')}`, 'Emploi à 14h30'];
const css = fs.readFileSync(path.join(DIR, '_style.css'), 'utf8');
const html = `<!DOCTYPE html>
<html lang="fr" data-tags="us,macro,semis,ai,asia,retrospective,formation" data-tab="daily">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily — 6 novembre 2026 : la puce entraîne toute la cote</title>
  <meta name="description" content="${description}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://articles.dailytickers.com/daily/20261106/">
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

<section class="hero-section"><div class="container"><div class="hero-date">Vendredi 6 novembre 2026 &bull; clôtures du jeudi 5 novembre</div><h1 class="hero-title">${title}</h1><p class="hero-subtitle">${description}</p><div class="hero-badges">${badges.map(b => `<span class="hero-badge">${b}</span>`).join('')}</div><div id="article-clickable-tags" class="card-tags"></div></div></section>

<main class="report-main"><div class="container">
${sections.join('\n')}
</div></main>

<div class="fnav" id="floatingNav"><div class="fnav-menu" id="fnavMenu"><a href="#alerte" class="fnav-item" data-section="alerte"><i class="fas fa-bullhorn"></i><span>L’essentiel</span></a><a href="#seance" class="fnav-item" data-section="seance"><i class="fas fa-chart-column"></i><span>La séance</span></a><a href="#histoire" class="fnav-item" data-section="histoire"><i class="fas fa-clock-rotate-left"></i><span>27 ans de QQQ</span></a><a href="#rotation-indices" class="fnav-item" data-section="rotation-indices"><i class="fas fa-arrows-rotate"></i><span>La rotation</span></a><a href="#previsions" class="fnav-item" data-section="previsions"><i class="fas fa-list-check"></i><span>Nos prévisions</span></a><a href="#agenda" class="fnav-item" data-section="agenda"><i class="fas fa-calendar"></i><span>Agenda</span></a></div><button class="fnav-btn" id="fnavBtn" type="button" aria-label="Navigation"><i class="fas fa-bars" id="fnavIcon"></i><span class="fnav-btn-label" id="fnavLabel">Menu</span></button></div>
<footer class="article-footer">&copy; 2026 DailyTickers. Clôtures du 5 novembre 2026 ; contrats à terme et cotes relevés le 6 novembre au matin. Ceci n&rsquo;est pas un conseil financier.<br><a href="/" title="Accueil" aria-label="Accueil"><i class="fas fa-house"></i></a></footer>
<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js"></script>
<script>const CHART_SPECS=${JSON.stringify(chartSpecs)};(function(){if(typeof echarts==='undefined')return;var xs=[];CHART_SPECS.forEach(function(c){var el=document.getElementById(c.id);if(!el)return;var x=echarts.init(el);x.setOption(Object.assign({animation:false,textStyle:{fontFamily:'Inter,system-ui,sans-serif'},tooltip:{trigger:'axis'}},c.spec));xs.push(x);});window.addEventListener('resize',function(){xs.forEach(function(x){x.resize();});});})();</script>
<script src="/assets/rotation-race.js"></script>
<script>(function(){var R=window.DTRotation;if(!R||typeof echarts==='undefined')return;var D,W='event',rc={};var RAT=[['SPHB','SPLV'],['RSP','SPY'],['IWM','SPY'],['FEZ','SPY'],['EWY','SPY']];
function e(s){return D.etfs.find(function(x){return x.symbol===s})}function base(){return D.windows.find(function(w){return w.key===W}).base}
function race(id,items){if(rc[id])rc[id].dispose();var el=document.getElementById(id);el.style.height=Math.max(260,items.length*(el.clientWidth<520?24:27)+56)+'px';rc[id]=R.race(el,{dates:D.dates,base:base(),items:items,controls:R.controls(document.getElementById(id+'Ctl'))})}
function draw(){var sp=D.indices.sp500.dims.sector;race('rotSect',sp.map(function(g){return{name:g.label,series:g.series,sub:g.n+' titres'}}));race('rotPlaces',D.etfs.filter(function(x){return x.kind==='region'}).map(function(x){return{name:x.symbol+' · '+x.label,series:x.series}}));
R.lines(document.getElementById('rotRisk'),{dates:D.dates,base:base(),lead:10,baseLabel:'base',items:RAT.map(function(r){var a=e(r[0]),b=e(r[1]);return{name:r[0]+'/'+r[1],series:a.series.map(function(v,i){return v/b.series[i]*100})}})});
var t=document.getElementById('rotWinTabs');t.innerHTML=D.windows.map(function(w){return '<button type="button" class="rotation-tab'+(w.key===W?' active':'')+'" aria-pressed="'+(w.key===W)+'" data-k="'+w.key+'">'+w.label+'</button>'}).join('');Array.prototype.forEach.call(t.children,function(b){b.onclick=function(){W=b.dataset.k;draw()}})}
R.load('/daily/20261106/rotation-indices.json').then(function(d){D=d;draw()}).catch(function(){var n=document.querySelector('.rot-embed');if(n)n.innerHTML='<p class="provenance">Graphiques de rotation indisponibles pour le moment.</p>'})})();</script>
<script src="/assets/echarts-responsive.js"></script>
<script src="/assets/core.js"></script>
<script src="/assets/tag-renderer.js"></script>
</body>
</html>
`;

fs.writeFileSync(path.join(DIR, 'index.html'), html);
const articleSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, 'index.html'))).digest('hex');
fs.writeFileSync(path.join(DIR, '_data/chart-data.json'), JSON.stringify({ reference_close: REF, previous_close: D4, chart_specs: chartSpecs }, null, 2) + '\n');
fs.writeFileSync(path.join(DIR, '_data/claims.json'), JSON.stringify({ reference_close: REF, article_path: `${REL}/index.html`, article_sha256: articleSha, generated_by: `${REL}/_build.cjs`, literals: [...literals].sort(), claims }, null, 2) + '\n');
console.log(`daily rendu : ${sections.length} sections, ${claims.length} claims, ${literals.size} littéraux, ${(html.length / 1024).toFixed(1)} Ko`);
console.log(JSON.stringify({ setups: SETUPS.map(x => [x.s, x.status, x.r && +x.r.toFixed(3), x.c && x.c.status, x.c && +x.c.r.toFixed(3)]), sumR, realizedR, latentR, sumRc, realizedRc, scan: LINES.map(x => [x.ticker, x.state, x.via, +x.r.toFixed(3)]), scanR, SMA200, nkeMargin, igvCloseAbove, heldClose }, null, 1));
