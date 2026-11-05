#!/usr/bin/env node
'use strict';

// Daily du 5 novembre 2026 : suite de l'édition midterms du 3 novembre, bilan des neuf plans du
// 31 octobre avec un ordre stop réel, et lecture du scan publié le 5 novembre. Chaque chiffre
// visible dans <main> est un claim lié à un artefact collecté (socle, focus, lots thématiques) ou au
// registre primaire du jour. Les niveaux publiés (31 octobre, scan du 5 novembre) et les seuils
// publiés le 3 novembre sont des littéraux déclarés, relus depuis leur source ; les résultats en %
// et en R sont recalculés ici depuis les barres liées.

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { renderValue } = require('../../tools/validate-content-claims');
const { renderEventTimeline } = require('../../tools/lib/event-timeline.cjs');
const { addUSTradingDays } = require('../../tools/lib/market-calendar.js');

const ROOT = path.resolve(__dirname, '../..');
const REL = 'daily/20261105';
const DIR = path.join(ROOT, REL);
const REF = '2026-11-04';
const D3 = '2026-11-03';
const D2 = '2026-11-02';
const PRIMARY = `${REL}/primary-reference.json`;
const REGISTRY = 'data/scheduled-events.json';
const SCAN = 'scanner/20261105/signals.json';

const sources = {
  idx: `${REL}/_data/bars_indices.json`, dia: `${REL}/_data/bars_dia.json`, sec: `${REL}/_data/bars_sectors.json`,
  cry: `${REL}/_data/bars_crypto.json`, off: `${REL}/_data/off_hours.json`, eco: `${REL}/_data/economic_events.json`,
  st: `${REL}/_data/status.json`, opt: `${REL}/_data/options_sentiment.json`, ern: `${REL}/_data/earnings_today.json`,
  fb: `${REL}/_focus/focus_bars.json`, ta: `${REL}/_themes_a/bars_themes.json`, tb: `${REL}/_themes_b/bars_themes.json`,
  tc: `${REL}/_themes_c/bars_themes.json`, td: `${REL}/_themes_d/bars_themes.json`,
  te: `${REL}/_themes_e/bars_themes.json`
};
const D = Object.fromEntries(Object.entries(sources).map(([k, v]) => [k, JSON.parse(fs.readFileSync(path.join(ROOT, v), 'utf8'))]));
const primary = JSON.parse(fs.readFileSync(path.join(ROOT, PRIMARY), 'utf8'));
const registryFile = JSON.parse(fs.readFileSync(path.join(ROOT, REGISTRY), 'utf8'));
const scan = JSON.parse(fs.readFileSync(path.join(ROOT, SCAN), 'utf8'));
const tiingo1103 = JSON.parse(fs.readFileSync(path.join(ROOT, 'daily/20261103/_dossier/bars_dossier.json'), 'utf8'));
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
function chg(sym, from = D3, to = REF, decimals = 1, stem = 'chg') {
  const s = series(sym), i = idxOf(s, to), j = idxOf(s, from);
  const value = (s.bars[i][4] / s.bars[j][4] - 1) * 100;
  return claim(s.key, `${s.ptr}/bars/${i}/4`, s.bars[i][4], fr(decimals, ' %', true), `${stem}_${sym}`,
    { operation: 'ratio_pct', numerator_pointer: `${s.ptr}/bars/${i}/4`, denominator_pointer: `${s.ptr}/bars/${j}/4`, result: value });
}
const chgV = (sym, from = D3, to = REF) => { const s = series(sym); return (s.bars[idxOf(s, to)][4] / s.bars[idxOf(s, from)][4] - 1) * 100; };
function o2c(sym, date = REF, decimals = 2, stem = 'o2c') {
  const s = series(sym), i = idxOf(s, date), value = (s.bars[i][4] / s.bars[i][1] - 1) * 100;
  return claim(s.key, `${s.ptr}/bars/${i}/4`, s.bars[i][4], fr(decimals, ' %', true), `${stem}_${sym}`,
    { operation: 'ratio_pct_open_to_close', numerator_pointer: `${s.ptr}/bars/${i}/4`, denominator_pointer: `${s.ptr}/bars/${i}/1`, result: value });
}
function volx(sym, date, window, stem = 'volx') {
  const s = series(sym), i = idxOf(s, date);
  const first = i - window; if (first < 0) throw new Error(`${sym} : fenêtre de volume trop courte`);
  const mean = s.bars.slice(first, i).reduce((t, b) => t + b[5], 0) / window;
  return claim(s.key, `${s.ptr}/bars/${i}/5`, s.bars[i][5], fr(1, ' fois'), `${stem}_${sym}`,
    { operation: 'ratio_to_mean', numerator_pointer: `${s.ptr}/bars/${i}/5`, window, offset: 1, result: s.bars[i][5] / mean });
}
const bdate = (sym, date, parts = 'weekday_day_month', stem = 'd') => { const s = series(sym), i = idxOf(s, date); return claim(s.key, `${s.ptr}/bars/${i}/0`, s.bars[i][0], dateR(parts), `${stem}_${sym}`); };
const dir = v => (v >= 0 ? 'up' : 'down');

// Cohérence des sources : les barres yahoo des lots thématiques reproduisent les barres tiingo
// collectées le 3 novembre sur les séances du 30 octobre et du 2 novembre.
const tiingoBars = sym => { const h = walk(tiingo1103, x => x && x.symbol === sym && Array.isArray(x.bars)); if (!h) throw new Error(`tiingo ${sym}`); return h.node.bars; };

// ── Contexte : volatilité, contrats à terme, cote de la Fed, horaires ────────
const vixPt = sym => { const i = D.opt.items.findIndex(x => x && x.symbol === sym && x.type === 'term_structure_point'); if (i < 0) throw new Error(sym); return { i, node: D.opt.items[i] }; };
const vix9 = vixPt('^VIX9D'), vix30 = vixPt('^VIX'), vix3m = vixPt('^VIX3M');
const vixR = (h, stem) => claim('opt', `/items/${h.i}/level`, h.node.level, fr(2), stem);
if (!String(vix30.node.last_trade_time).startsWith(REF) || !(vix9.node.level < vix30.node.level && vix30.node.level < vix3m.node.level)) throw new Error('courbe du VIX à revoir');
const offObs = (facet, test) => { const f = D.off.facets[facet]; const i = f.observations.findIndex(test); if (i < 0) throw new Error(`hors séance ${facet}`); return { ptr: `/facets/${facet}/observations/${i}`, node: f.observations[i] }; };
const es = offObs('futures', o => o.canonical_asset === 'ES'), nq = offObs('futures', o => o.canonical_asset === 'NQ'), wti = offObs('futures', o => o.canonical_asset === 'WTI');
const btcLive = offObs('crypto', o => o.canonical_asset === 'BTC');
const fedDec = offObs('predictions', o => /increase interest rates by 25 bps after the December 2026/.test(o.metadata && o.metadata.question || ''));
const offPx = (o, d, stem, suffix = '') => claim('off', `${o.ptr}/price`, o.node.price, fr(d, suffix), stem);
const offAt = (o, stem) => claim('off', `${o.ptr}/observed_at`, o.node.observed_at, timeR('Europe/Paris'), stem);
const offRet = (o, k, stem) => claim('off', `${o.ptr}/returns/${k}`, o.node.returns[k], fr(1, ' %', true), stem);
const fedR = stem => claim('off', `${fedDec.ptr}/price`, fedDec.node.price, pct(1), stem);
if (!(nq.node.returns['4h_pct'] < -1 && nq.node.returns['24h_pct'] > 1 && fedDec.node.price > 0.7)) throw new Error('lecture du matin à revoir');
// Cotes Polymarket : l'horodatage de la cote (event_at) porte des fractions de seconde que le rendu
// horaire des claims refuse ; l'heure de Paris est donc un littéral déclaré, converti ici depuis event_at.
const parisOf = iso => { const p = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso)); return `${p.find(x => x.type === 'hour').value}h${p.find(x => x.type === 'minute').value}`; };
const fedAt = () => lit(parisOf(fedDec.node.event_at));
const iranCf = offObs('predictions', o => /^US x Iran effective ceasefire continues through December 31, 2026/.test(o.metadata && o.metadata.question || ''));
if (!(Math.abs(iranCf.node.price - 0.28) < 1e-9 && Math.abs(iranCf.node.returns['24h_probability_points'] + 0.12) < 1e-9)) throw new Error('cote du cessez-le-feu à revoir');
const iranR = stem => claim('off', `${iranCf.ptr}/price`, iranCf.node.price, pct(0), stem);
const iranD = stem => claim('off', `${iranCf.ptr}/returns/24h_probability_points`, iranCf.node.returns['24h_probability_points'], { scale: 100, decimals: 0, suffix: ' pts', format: 'fr', sign: 'always' }, stem);
const iranAt = () => lit(parisOf(iranCf.node.event_at));
const offRet2 = (o, k, stem) => claim('off', `${o.ptr}/returns/${k}`, o.node.returns[k], fr(2, ' %', true), stem);

const econ = (name, day) => hit('eco', x => x && typeof x.name === 'string' && x.name.startsWith(name) && typeof x.event_time === 'string' && x.event_time.slice(0, 10) === day, name);
const claimsJ = econ('Initial Jobless Claims', '2026-11-05'), nfp = econ('Non-Farm Payrolls (Employment Situation)', '2026-11-06'), bowman = econ('Federal Reserve Discussion - Vice Chair for Supervision Michelle W. Bowman', '2026-11-06');
const paris = (h, stem) => claim('eco', `${h.ptr}/event_time`, h.node.event_time, timeR('Europe/Paris'), stem);
const stEq = D.st.operation_readiness.bars_daily_us_equity;
if (stEq.current_bar_date !== '2026-11-05' || stEq.current_bar_closes_at !== '2026-11-05T21:00:00Z' || stEq.served_completed_end !== REF) throw new Error('séance du jour inattendue');
const sessionDay = (stem, parts = 'weekday_day_month') => claim('st', '/operation_readiness/bars_daily_us_equity/current_bar_date', stEq.current_bar_date, dateR(parts), stem);
const nyClose = stem => claim('st', '/operation_readiness/bars_daily_us_equity/current_bar_closes_at', stEq.current_bar_closes_at, timeR('Europe/Paris'), stem);
const ci = hit('ern', x => x && x.symbol === 'CI' && Array.isArray(x.date_sources), 'résultats Cigna');
if (ci.node.report_date !== '2026-11-05' || ci.node.report_time !== 'BMO') throw new Error('Cigna');
const ciDate = stem => claim('ern', `${ci.ptr}/report_date`, ci.node.report_date, dateR('day_month'), stem);
const regIdx = id => { const i = registryFile.events.findIndex(e => e.id === id && e.date.startsWith('2026-11')); if (i < 0) throw new Error(id); return i; };
const regDate = (id, auth, stem) => registryClaim(REGISTRY, registryFile, `/events/${regIdx(id)}/date`, dateR('day_month'), stem, auth);
const cpiT = stem => reg('/facts/calendar/cpi_release', timeR('Europe/Paris'), stem, 'bls_cpi');
const ppiT = stem => reg('/facts/calendar/ppi_release', timeR('Europe/Paris'), stem, 'bls_ppi');
if (registryFile.events[regIdx('cpi')].date !== primary.facts.calendar.cpi_release.slice(0, 10) || registryFile.events[regIdx('ppi')].date !== primary.facts.calendar.ppi_release.slice(0, 10)) throw new Error('calendrier BLS incohérent');

// ── Les neuf plans du 31 octobre, avec un ordre stop réel ────────────────────
// Règles : ordre limite posé le 2 novembre ; ouverture sous la limite = exécution à l'ouverture ;
// ouverture sous le stop avant exécution = ordre annulé ; stop posé dès l'achat comme ordre stop
// (plus-bas sous le stop = sortie au stop, ou à l'ouverture si elle se fait sous le stop) ; plus-haut
// au-dessus de la cible = vente à la cible (ou à l'ouverture si elle se fait au-dessus).
const DAYS = [D2, D3, REF];
const SETUPS = [
  ['MSFT', 'Microsoft', 515, 497, 551], ['UNH', 'UnitedHealth', 402, 385, 432], ['CRM', 'Salesforce', 224, 210, 250],
  ['CRWD', 'CrowdStrike', 244, 224, 278], ['JCI', 'Johnson Controls', 146, 138, 160], ['FAST', 'Fastenal', 50.8, 48.9, 54.5],
  ['CNC', 'Centene', 65.8, 61.7, 72.5], ['OKTA', 'Okta', 202, 183, 233], ['IGV', 'ETF logiciel IGV', 103.5, 99, 111.5]
].map(([s, name, entry, stop, target]) => {
  const ser = series(s);
  for (const d of ['2026-10-30', D2]) {
    const a = ser.bars[idxOf(ser, d)], b = tiingoBars(s).find(x => x[0] === d);
    if (!b || [1, 2, 3, 4].some(c => Math.abs(a[c] - b[c]) > 0.011)) throw new Error(`${s} ${d} : barres yahoo et tiingo divergent`);
  }
  const x = { s, name, entry, stop, target, ser, status: 'attente' };
  for (const d of DAYS) {
    const i = idxOf(ser, d), [, o, h, l, c] = ser.bars[i];
    if (x.status === 'attente') {
      if (o <= stop) { x.status = 'annulé'; x.cancelDay = d; break; }
      if (o <= entry) { x.fill = o; x.fillDay = d; x.fillI = i; x.fillAtOpen = true; }
      else if (l <= entry) { x.fill = entry; x.fillDay = d; x.fillI = i; x.fillAtOpen = false; }
      else continue;
      x.status = 'ouverte';
      if (l <= stop) { x.status = 'stop'; x.exit = stop; x.exitDay = d; x.exitI = i; x.exitCol = 3; break; }
      if (h >= target) throw new Error(`${s} : cible touchée le jour de l'exécution, ordre des prix inconnu`);
      continue;
    }
    if (x.status === 'ouverte') {
      const stopHit = l <= stop, targetHit = h >= target;
      if (stopHit && targetHit) throw new Error(`${s} ${d} : stop et cible dans la même séance`);
      if (stopHit) { x.status = 'stop'; x.exit = Math.min(o, stop); x.gap = o < stop; x.exitDay = d; x.exitI = i; x.exitCol = 3; break; }
      if (targetHit) { x.status = 'cible'; x.exit = Math.max(o, target); x.gap = o > target; x.exitDay = d; x.exitI = i; x.exitCol = 2; break; }
    }
  }
  const last = ser.bars[idxOf(ser, REF)];
  x.close = last[4]; x.closeI = idxOf(ser, REF);
  if (x.fill !== undefined) {
    x.risk = x.fill - stop;
    const out = x.exit !== undefined ? x.exit : x.close;
    x.ret = (out / x.fill - 1) * 100; x.r = (out - x.fill) / x.risk; x.closed = x.exit !== undefined;
  }
  return x;
});
const S = Object.fromEntries(SETUPS.map(x => [x.s, x]));
const executed = SETUPS.filter(x => x.fill !== undefined), closedL = executed.filter(x => x.closed), openL = executed.filter(x => !x.closed);
const expect = { MSFT: 'cible', UNH: 'ouverte', CRM: 'ouverte', CRWD: 'ouverte', JCI: 'stop', FAST: 'attente', CNC: 'cible', OKTA: 'stop', IGV: 'ouverte' };
for (const x of SETUPS) if (x.status !== expect[x.s]) throw new Error(`${x.s} : statut ${x.status}`);
if (SETUPS.some(x => x.gap)) throw new Error('écart d\'ouverture sur une sortie : prix à revoir');
if (!(S.CRM.fillAtOpen && S.CRM.fillDay === D3) || S.OKTA.exitDay !== D3 || S.JCI.exitDay !== REF) throw new Error('chronologie à revoir');
const sumR = executed.reduce((t, x) => t + x.r, 0), realizedR = closedL.reduce((t, x) => t + x.r, 0), latentR = openL.reduce((t, x) => t + x.r, 0);
const avgRet = executed.reduce((t, x) => t + x.ret, 0) / executed.length;
// Règle « clôture sous le stop » de la fiche : OKTA et JCI n'auraient jamais clôturé sous leur stop.
const closeRuleKeeps = ['OKTA', 'JCI'].filter(s => !DAYS.some(d => bar(s, d)[4] <= S[s].stop));
if (closeRuleKeeps.join() !== 'OKTA,JCI') throw new Error('règle de clôture à revoir');
// Bilan selon la règle prescrite le 3 novembre : stop jugé à la CLÔTURE (clôture sous le stop =
// vente à l'ouverture suivante), cible toujours vendue par ordre limite. Mêmes achats.
for (const x of executed) {
  x.c = { status: 'ouverte' };
  for (let k = DAYS.indexOf(x.fillDay); k < DAYS.length; k++) {
    const d = DAYS[k], i = idxOf(x.ser, d), [, o, h, , c] = x.ser.bars[i];
    if (k > DAYS.indexOf(x.fillDay) && h >= x.target) { x.c = { status: 'cible', exit: Math.max(o, x.target) }; break; }
    if (c <= x.stop) {
      if (h >= x.target) throw new Error(`${x.s} ${d} : clôture sous le stop et cible dans la même séance`);
      if (k + 1 >= DAYS.length) throw new Error(`${x.s} : clôture sous le stop le ${d}, ouverture suivante inconnue`);
      x.c = { status: 'stop', exit: x.ser.bars[idxOf(x.ser, DAYS[k + 1])][1] }; break;
    }
  }
  x.c.r = ((x.c.exit !== undefined ? x.c.exit : x.close) - x.fill) / x.risk;
  x.c.closed = x.c.exit !== undefined;
}
const expectC = { MSFT: 'cible', UNH: 'ouverte', CRM: 'ouverte', CRWD: 'ouverte', JCI: 'ouverte', CNC: 'cible', OKTA: 'ouverte', IGV: 'ouverte' };
for (const x of executed) if (x.c.status !== expectC[x.s]) throw new Error(`${x.s} : statut clôture ${x.c.status}`);
for (const x of executed) if (x.status === 'cible' && Math.abs(x.c.r - x.r) > 1e-12) throw new Error(`${x.s} : cible divergente selon la règle`);
const sumRc = executed.reduce((t, x) => t + x.c.r, 0), realizedRc = executed.filter(x => x.c.closed).reduce((t, x) => t + x.c.r, 0), latentRc = sumRc - realizedRc;
// Fin ferme des lignes du 31 octobre : la fiche visait « 5 à 12 séances, jusqu'à la mi-novembre ».
// Douze séances de Bourse après l'entrée du 2 novembre, calendrier NYSE.
const END31 = addUSTradingDays(D2, 12);
if (END31 !== '2026-11-18') throw new Error(`fin des lignes du 31 octobre : ${END31}`);
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const dfull = d => `${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
const END31_TXT = dfull(END31);
const NEAR = openL.slice().sort((a, b) => a.close / a.stop - b.close / b.stop)[0];
if (NEAR.s !== 'IGV') throw new Error('ligne la plus proche du stop');
const fastGap = (S.FAST.close / S.FAST.entry - 1) * 100;

// Prix de barre au centime. Quand la barre porte une demi-unité au troisième chiffre (51,985), le
// rendu binaire de toFixed arrondit vers le bas ; on publie alors l'arrondi correct comme littéral.
const bp = (x, i, col, stem) => {
  const v = x.ser.bars[i][col], half = Math.round(v * 100 + 1e-7) / 100;
  if (renderValue(v, fr(2)) !== renderValue(half, fr(2))) return usd(half);
  return claim(x.ser.key, `${x.ser.ptr}/bars/${i}/${col}`, v, fr(2, ' $'), `${stem}_${x.s}`);
};
const dshort = d => lit(dfull(d));

// ── Le scan du 5 novembre ────────────────────────────────────────────────────
const SHORT = { XLB: 'Fonds des matériaux', XLP: 'Fonds de la consommation de base' };
const FAMILY = { Breakout: 'Cassure', Momentum: 'Suivi de tendance' };
const LINES = scan.signals.map(sig => {
  const b = bar(sig.ticker, REF);
  if (Math.abs(b[4] - sig.price) > 0.006 || Math.abs(b[4] - sig.entry) > 0.006) throw new Error(`${sig.ticker} : prix du scan ≠ clôture du 4 novembre`);
  if (Math.abs(b[3] - sig.invalidation_level) > 0.006) throw new Error(`${sig.ticker} : invalidation ≠ plus-bas du 4 novembre`);
  const rr = (sig.tp1 - sig.entry) / (sig.entry - sig.stop);
  if (Math.abs(rr - sig.rr_entry) > 0.006 || sig.horizon !== 10) throw new Error(`${sig.ticker} : gain/risque ou horizon`);
  return { ...sig, rr, move: chgV(sig.ticker) };
});
if (Math.abs(bar('PHM', REF)[3] - 131.575) > 1e-9) throw new Error('plus-bas PHM');
if (LINES.map(x => x.ticker).join() !== 'HCA,PHM,ADSK,CP,TRV,NKE,XLB,XLP') throw new Error('lignes du scan');
if (LINES.some(x => x.move <= 0)) throw new Error('une ligne du scan n\'a pas monté le 4 novembre');
const avgMove = LINES.reduce((t, x) => t + x.move, 0) / LINES.length;
const CAUSE = {
  HCA: () => `Reuters : hôpitaux et assureurs montent sur l’espoir d’un report des coupes de Medicaid`,
  PHM: () => `Yahoo Finance : rallye du logement, attente de mesures sur l’accès à la propriété`,
  ADSK: () => `aucune dépêche ne le relie au vote : simultanéité`,
  CP: () => `aucune dépêche ne le relie au vote : simultanéité`,
  TRV: () => `aucune dépêche ne le relie au vote : simultanéité`,
  NKE: () => `24/7 Wall St. : les valeurs de consommation vendues profitent du retour du risque`,
  XLB: () => `aucune dépêche sur les matériaux : simultanéité`,
  XLP: () => `aucune dépêche ne le relie au vote : simultanéité (etf.com le range seulement parmi les secteurs à plus de ${lit('3 %')})`
};

const SECTORS = ['XLK', 'XLB', 'XLF', 'XLE', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU', 'XLC', 'XLRE'];
const SECT_UP = SECTORS.filter(s => chgV(s) > 0).length;
if (SECT_UP !== 8 || !(Math.abs(chgV('XLK')) < 0.05)) throw new Error(`secteurs en hausse : ${SECT_UP}`);

// ── Mise en page ─────────────────────────────────────────────────────────────
const section = (id, kicker, title, pillHtml, status, body) => `<section id="${id}" class="section-shell" data-status="${status}"><div class="section-head"><div><div class="section-kicker">${kicker}</div><h2>${title}</h2></div>${pillHtml}</div>${body}</section>`;
const pill = (t, cls = '') => `<span class="status-pill${cls ? ' ' + cls : ''}">${t}</span>`;
const table = (head, rows, cls = 'data-table') => `<div class="table-scroll"><table class="${cls}"><thead><tr>${head.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const dash = (label, value, move, note, d) => `<article class="dash-card"><div class="dash-label">${label}</div><div class="dash-value">${value}</div><div class="dash-move ${d}">${move}</div><div class="dash-note">${note}</div></article>`;
const verdict = (t, cls) => `<span class="verdict ${cls}">${t}</span>`;
const sections = [];
const refDay = (stem, parts = 'weekday_day_month') => bdate('SPY', REF, parts, stem);

// 1. Alerte
sections.push(`<section id="alerte" class="decision-strip" data-status="validated">`
  + `<article class="decision-card primary"><div class="decision-kicker">Décision</div><h2>Après le vote, la puce recule, l’hôpital et la maison bondissent : le scan achète ces hausses au prix de clôture de mercredi, jamais plus cher</h2>`
  + `<p>Les démocrates prennent la majorité dans les deux chambres (etf.com) : ${reg('/facts/election/senate_flipped', fr(0), 'sen_a', 'cnbc_results_20261104')} sièges de sénateur repris aux républicains et au moins ${reg('/facts/election/house_flipped_min', fr(0), 'house_a', 'cnbc_results_20261104')} circonscriptions reprises à la Chambre, ${reg('/facts/election/house_uncalled', fr(0), 'unc_a', 'cnbc_results_20261104')} encore non attribuées (CNBC). Mercredi, le Dow Jones (DIA) a fait ${chg('DIA', D3, REF, 2, 'dia_a')}, le S&amp;P 500 (SPY) ${chg('SPY', D3, REF, 2, 'spy_a')}, les semi-conducteurs (SMH) ${chg('SMH', D3, REF, 2, 'smh_a')} et le pétrole (USO) ${chg('USO', D3, REF, 1, 'uso_a')}. Les géants ont porté l’indice : Microsoft ${chg('MSFT', D3, REF, 1, 'msft_a')} sur nos cours, Amazon ${reg('/facts/big_tech/amzn_pct', fr(0, ' %', true), 'amzn_a', 'etfcom_20261105')} et Apple ${reg('/facts/big_tech/aapl_pct', fr(1, ' %', true), 'aapl_a', 'etfcom_20261105')} selon etf.com. Ce sont des prix ; nous n’avons aucune donnée de flux qui dise où l’argent est allé.</p>`
  + `<p>Le scan publié ce matin retient six actions et deux fonds qui ont tous monté mercredi. Ordre d’achat valable la seule séance de ce jeudi, au prix de la clôture du ${lit('4 novembre')}, jamais au-dessus ; aucun ordre si l’ouverture ou le cours du moment est sous le plus-bas du ${lit('4 novembre')}. Une fois acheté, une clôture sous ce plus-bas fait vendre à l’ouverture suivante, même au-dessus du stop. Sortie forcée le ${lit('18 novembre')} avant ${lit('21h45')}, heure de Paris.</p></article>`
  + `<article class="decision-card">${pill('BILAN 31 OCTOBRE', 'partial')}<h3>Huit exécutions sur neuf, ${lit(frSigned(sumR, 2, ' R'))} dont ${lit(frSigned(realizedR, 2, ' R'))} encaissés</h3><p>Compté avec un stop posé dès l’achat : Microsoft et Centene vendus à leur cible, Okta et Johnson Controls sortis au stop, quatre lignes encore ouvertes. Avec la règle de clôture que nous avions prescrite le ${lit('3 novembre')}, le total serait ${lit(frSigned(sumRc, 2, ' R'))}. Fastenal n’a toujours pas touché son prix d’achat.</p></article>`
  + `<article class="decision-card">${pill('À SURVEILLER', 'risk')}<h3>Ce matin, le contrat Nasdaq recule sur quatre heures</h3><p>Relevé à ${offAt(nq, 'nq_t_a')}, heure de Paris : le contrat Nasdaq-100 fait ${offRet2(nq, '4h_pct', 'nq4_a')} sur les quatre dernières heures, après les prévisions d’Arm et de Qualcomm (Investing.com). Le contrat S&amp;P 500 cote ${offPx(es, 0, 'es_a', ' pts')}. Ce ne sont pas des clôtures.</p></article>`
  + `</section>`);

// 2. Tableau de bord
const moveList = ['DIA', 'XLY', 'XLC', 'XLF', 'XLRE', 'XLP', 'XLV', 'XLB', 'IWM', 'SPY', 'QQQ', 'XLU', 'XLK', 'XLI', 'TLT', 'GLD', 'TAN', 'HCA', 'CNC', 'DG', 'ITB', 'MSFT', 'LMT', 'SMH', 'XLE', 'XOP', 'USO'];
const LABEL = { DIA: 'Dow Jones (DIA)', XLY: 'Conso. discrétionnaire (XLY)', XLC: 'Communication (XLC)', XLF: 'Finance (XLF)', XLRE: 'Immobilier (XLRE)', XLP: 'Conso. de base (XLP)', XLV: 'Santé (XLV)', XLB: 'Matériaux (XLB)', IWM: 'Petites valeurs (IWM)', SPY: 'S&P 500 (SPY)', QQQ: 'Nasdaq-100 (QQQ)', XLU: 'Services publics (XLU)', XLK: 'Technologie (XLK)', XLI: 'Industrie (XLI)', TLT: 'Obligations 20 ans (TLT)', GLD: 'Or (GLD)', TAN: 'Solaire (TAN)', HCA: 'HCA (hôpitaux)', CNC: 'Centene (Medicaid)', DG: 'Dollar General', ITB: 'Construction de logements (ITB)', MSFT: 'Microsoft', LMT: 'Lockheed Martin', SMH: 'Semi-conducteurs (SMH)', XLE: 'Énergie (XLE)', XOP: 'Pétroliers (XOP)', USO: 'Pétrole (USO)' };
const moveData = moveList.map(s => ({ label: LABEL[s], v: +chgV(s).toFixed(2) })).sort((a, b) => a.v - b.v);
sections.push(section('dashboard', 'Le tableau', 'Mercredi 4 novembre : le Dow devant, la puce et le pétrole derrière', pill('VALIDÉ'), 'validated',
  `<div class="dashboard-grid">`
  + dash('Dow Jones (DIA)', px('DIA', REF, 'close', 2, 'dia_px'), chg('DIA', D3, REF, 2, 'dia_d'), 'meilleure séance depuis avril 2025 (WSJ)', dir(chgV('DIA')))
  + dash('S&amp;P 500 (SPY)', px('SPY', REF, 'close', 2, 'spy_px'), chg('SPY', D3, REF, 2, 'spy_d'), 'clôture de mercredi', dir(chgV('SPY')))
  + dash('Nasdaq-100 (QQQ)', px('QQQ', REF, 'close', 2, 'qqq_px'), chg('QQQ', D3, REF, 2, 'qqq_d'), 'les géants montent, la puce baisse', dir(chgV('QQQ')))
  + dash('Petites valeurs (IWM)', px('IWM', REF, 'close', 2, 'iwm_px'), chg('IWM', D3, REF, 2, 'iwm_d'), 'clôture de mercredi', dir(chgV('IWM')))
  + dash('Volatilité à 30 jours (VIX)', vixR(vix30, 'vix_a'), `à ${lit('9 jours')} : ${vixR(vix9, 'vix9_a')}`, 'courbe redevenue croissante', 'flat')
  + dash('Pétrole (USO)', px('USO', REF, 'close', 2, 'uso_px'), chg('USO', D3, REF, 1, 'uso_d'), `WTI ce matin : ${offPx(wti, 2, 'wti_a', ' $')}`, dir(chgV('USO')))
  + dash('Obligations 20 ans (TLT)', px('TLT', REF, 'close', 2, 'tlt_px'), chg('TLT', D3, REF, 2, 'tlt_d'), `dix ans à ${reg('/facts/session/ust10y_tokyo_pct', fr(2, ' %'), 'ust_a', 'reuters_oil_20261105')} à Tokyo (Reuters)`, dir(chgV('TLT')))
  + dash('Bitcoin', px('BTC-USD', REF, 'close', 0, 'btc_px'), chg('BTC-USD', D3, REF, 1, 'btc_d'), 'bougie UTC du 4 novembre', dir(chgV('BTC-USD')))
  + `</div>`
  + `<div id="movesChart" class="echart-box" role="img" aria-label="Variation de chaque indice, secteur et titre entre la clôture du mardi 3 novembre et celle du mercredi 4 novembre, en pourcentage" style="width:100%; height:700px; margin-top:1rem;"></div>`
  + `<p class="provenance">Variations de la clôture du ${bdate('SPY', D3, 'weekday_day_month', 'prev_c')} à celle du ${refDay('ref_c')}, cours vérifiés. Volatilité : clôture de mercredi des indices VIX à ${lit('9 jours')}, ${lit('30 jours')} et ${lit('3 mois')} (${vixR(vix3m, 'vix3m_c')}). Contrats à terme : relevés de ce jeudi matin, pas des clôtures.</p>`));

// 3. Le vote et la séance
sections.push(section('vote', 'Le verdict', 'Une vague, pas une alternance de routine', pill('SOURCÉ'), 'validated',
  `<p class="section-intro">CNBC compte, mercredi soir à ${reg('/facts/election/cnbc_published_at', timeR('Europe/Paris'), 'cnbc_t', 'cnbc_results_20261104')} heure de Paris, ${reg('/facts/election/senate_flipped', fr(0), 'sen_b', 'cnbc_results_20261104')} sièges de sénateur repris aux républicains, dont le Texas, l’Ohio et le Kansas, sans un seul siège démocrate perdu, et au moins ${reg('/facts/election/house_flipped_min', fr(0), 'house_b', 'cnbc_results_20261104')} circonscriptions reprises aux républicains à la Chambre. À cette heure-là, ${reg('/facts/election/house_uncalled', fr(0), 'unc_h', 'cnbc_results_20261104')} sièges de députés et ${reg('/facts/election/senate_uncalled', fr(0), 'unc_s', 'cnbc_results_20261104')} de sénateurs restaient à attribuer. Polymarket donnait ce double basculement à ${lit('76,5 %')} mardi matin : le sens était attendu, l’ampleur non. « C’est l’ampleur de la victoire qui a pris les marchés de court », dit Chris Weston (Pepperstone) à Reuters.</p>`
  + `<p class="section-intro">Le pétrole a fait le gros du travail. Le Brent a fini mercredi à ${reg('/facts/session/brent_settle_usd', fr(2, ' $'), 'brent_px', 'ap_asia_20261105')} (${reg('/facts/session/brent_drop_pct', fr(1, ' %', true), 'brent_d', 'ap_asia_20261105')}, AP), soit environ ${reg('/facts/session/brent_week_drop_pct', fr(0, ' %', true), 'brent_w', 'reuters_oil_20261105')} sur la semaine selon Reuters : les opérateurs parient que Donald Trump, face à un Congrès démocrate et pénalisé par la cherté de l’énergie, sera moins enclin à étendre la guerre avec l’Iran (dépêche de ${reg('/facts/press/reuters_oil_published_at', timeR('Europe/Paris'), 'reu_t', 'reuters_oil_20261105')}, heure de Paris). Un pari, pas un accord : sur Polymarket, la cote d’un cessez-le-feu effectif entre les États-Unis et l’Iran tenu jusqu’au ${lit('31 décembre')} est à ${iranR('iran_a')}, ${iranD('iran_d')} de probabilité en ${lit('24 heures')} (cote de ${iranAt()}, heure de Paris). Le dix ans américain a reculé de ${reg('/facts/session/ust10y_drop_bp', fr(0), 'bp_a', 'reuters_oil_20261105')} points de base dans la nuit. Les obligations à long terme (TLT) ont pris ${chg('TLT', D3, REF, 2, 'tlt_b')}, l’or (GLD) ${chg('GLD', D3, REF, 1, 'gld_b')}, l’argent (SLV) ${chg('SLV', D3, REF, 1, 'slv_b')}, et le dollar (UUP) a fini à ${chg('UUP', D3, REF, 2, 'uup_b')}.</p>`
  + `<p class="section-intro">La puce a payé l’autre facette du vote. Dans ${reg('/facts/session/dc_ballot_states', fr(0), 'dc_st', 'etfcom_20261105')} États, les électeurs ont approuvé des interdictions ou des moratoires sur les centres de données ; la nouvelle gouverneure du Texas promet un moratoire immédiat, dans un État qui porte près de ${reg('/facts/session/texas_dc_share_pct', fr(0, ' %'), 'tx_dc', 'etfcom_20261105')} des capacités attendues en ${lit('2028')} (etf.com, d’après SemiAnalysis). Les semi-conducteurs (SMH) ont fini à ${chg('SMH', D3, REF, 1, 'smh_b')}. Microsoft, lui, a pris ${chg('MSFT', D3, REF, 1, 'msft_b')}, Amazon ${reg('/facts/big_tech/amzn_pct', fr(0, ' %', true), 'amzn_b', 'etfcom_20261105')} et Apple ${reg('/facts/big_tech/aapl_pct', fr(1, ' %', true), 'aapl_b', 'etfcom_20261105')} : celui qui possède déjà ses centres de données voit leur valeur monter si les nouveaux tardent. C’est la lecture d’etf.com, qui ajoute que ces poids lourds ont porté le marché large ; elle explique pourquoi la technologie (XLK) finit à ${chg('XLK', D3, REF, 2, 'xlk_b')} pendant que la puce baisse. Reuters tempère : la plupart des analystes pensent que le vote n’entamera pas, à terme, la demande d’IA, de centres de données ou de puces, et attendent au moins un ralentissement temporaire.</p>`
  + `<div class="quality-note"><strong>Ce que nous n’attribuons pas au vote.</strong> AMD a publié mardi soir et fini mercredi à ${chg('AMD', D3, REF, 1, 'amd_b')} ; aucune dépêche collectée ne lie ce mouvement à l’élection. Le bitcoin a pris ${chg('BTC-USD', D3, REF, 1, 'btc_b')} sur la bougie UTC du ${lit('4 novembre')} : simultanéité, pas causalité.</div>`));

// 4. La rotation
const rotRows = [
  ['HCA', 'Hôpitaux', chg('HCA', D3, REF, 1, 'r_hca'), 'Reuters : report possible des coupes de Medicaid et prolongation des aides Obamacare'],
  ['CNC', 'Assureur Medicaid', chg('CNC', D3, REF, 1, 'r_cnc'), 'Reuters, même dépêche : Centene cité'],
  ['DG', 'Magasins à petits prix', chg('DG', D3, REF, 1, 'r_dg'), 'AP : enseignes des ménages modestes en tête de la hausse'],
  ['ITB', 'Construction de logements', chg('ITB', D3, REF, 1, 'r_itb'), 'Yahoo Finance : attente de mesures sur l’accès au logement, taux plus bas'],
  ['TAN', 'Solaire', chg('TAN', D3, REF, 1, 'r_tan'), 'Reuters : soutien attendu aux renouvelables'],
  ['LMT', 'Défense', chg('LMT', D3, REF, 1, 'r_lmt'), 'AP : un Congrès démocrate pousserait à freiner la guerre'],
  ['SMH', 'Semi-conducteurs', chg('SMH', D3, REF, 1, 'r_smh'), 'etf.com : moratoires sur les centres de données'],
  ['XOP', 'Pétroliers', chg('XOP', D3, REF, 1, 'r_xop'), 'Reuters et AP : espoir d’une fin de la guerre avec l’Iran']
].map(([s, l, v, src]) => [`<strong>${s}</strong> · ${l}`, v, src]);
sections.push(section('rotation', 'La rotation', 'Qui a gagné, qui a perdu, et qui le dit', pill('ATTRIBUÉ', 'partial'), 'partial',
  table(['Compartiment', 'Mercredi', 'Attribution'], rotRows)
  + `<p class="section-intro">Notre lecture, faite sur les prix et sans donnée de flux pour la prouver : ce qui monte est ce qu’un Congrès démocrate peut financer (soins des ménages modestes, logement, solaire), ce qui baisse est ce qu’il peut freiner (guerre, centres de données, pétrole). La rotation ne s’est pas faite contre les grands indices : ${lit(String(SECT_UP))} de nos ${lit('onze')} fonds sectoriels ont monté. La technologie (XLK) a fini à plat, à ${chg('XLK', D3, REF, 2, 'xlk_r')}, l’industrie (XLI) à ${chg('XLI', D3, REF, 1, 'xli_r')} et l’énergie (XLE) à ${chg('XLE', D3, REF, 1, 'xle_r')}.</p>`
  + `<p class="provenance">Variations mesurées sur nos cours vérifiés, du ${lit('3')} au ${lit('4 novembre')}. La colonne « attribution » cite la dépêche ; elle ne prouve pas la cause, elle dit qui l’affirme.</p>`));

// 4 bis. Ajout du 5 novembre en fin de matinée : la rotation recalculée titre par titre (instantané figé
// rotation-indices.json, produit par tools/gen-rotation-indices.js sur les clôtures du 4 novembre).
const RO = JSON.parse(fs.readFileSync(path.join(DIR, 'rotation-indices.json'), 'utf8'));
if (RO.asof !== REF || RO.event.base !== D3) throw new Error('instantané de rotation désaligné');
const W1 = '2026-10-28';
if (RO.windows.find(w => w.key === '1w').base !== W1) throw new Error('base une semaine désalignée');
// La prose décrit ces agrégats sans les chiffrer ; chaque phrase est vérifiée ici contre l'instantané
// (relectures du 5 novembre : un texte qui contredit le graphique placé dessous est bloquant).
const M1 = RO.windows.find(w => w.key === '1m').base;
{
  const sp = RO.indices.sp500, st = k => sp.dims.style.find(g => g.key === k).ret, q5 = sp.dims.vol.find(g => g.key === 'q5').ret;
  const con = (side, sym) => sp.contributors.event[side].find(x => x.s === sym).contrib;
  const secBy = w => sp.dims.sector.slice().sort((a, b) => b.ret[w].cw - a.ret[w].cw).map(g => g.key);
  const capBest = sp.dims.cap.slice().sort((a, b) => b.ret.event.cw - a.ret.event.cw)[0].key;
  const US = new Set(['SPY', 'DIA', 'QQQ', 'IWM']);
  const worst1m = RO.etfs.filter(e => e.kind === 'region' && !US.has(e.symbol)).sort((a, b) => a.ret['1m'] - b.ret['1m']).slice(0, 3).map(e => e.symbol).sort().join(',');
  const tech = sp.dims.sector.find(g => g.key === 'technology').series, im = RO.dates.indexOf(M1);
  const checks = {
    ew_close_to_cw_event: Math.abs(sp.total.ret.event.ew - sp.total.ret.event.cw) < 0.5,
    mega_lead_event: capBest === 'c1',
    msft_aapl_each_beat_nvda: Math.min(con('top', 'MSFT'), con('top', 'AAPL')) > -con('bottom', 'NVDA'),
    defensive_beats_cyclical_event: st('defensive').event.cw > st('cyclical').event.cw,
    top2_sectors_event: secBy('event').slice(0, 2).join() === 'consumer_discretionary,financials',
    bottom2_sectors_event: secBy('event').slice(-2).sort().join() === 'energy,industrials',
    q5_slightly_down_event: q5.event.cw < 0 && q5.event.cw > -0.5,
    tech_peak_at_1m_base: M1 === '2026-10-06' && tech[im] === Math.max(...tech),
    cw_down_ew_up_1m: sp.total.ret['1m'].cw < 0 && sp.total.ret['1m'].ew > 0,
    defensive_first_growth_last_1m: st('defensive')['1m'].cw > st('cyclical')['1m'].cw && st('cyclical')['1m'].cw > st('growth')['1m'].cw,
    tech_comm_bottom_1m: secBy('1m').slice(-2).sort().join() === 'communication_services,technology',
    worst_places_1m: worst1m === 'EWT,EWY,EWZ',
    scan_lines: LINES.map(x => x.ticker).sort().join() === 'ADSK,CP,HCA,NKE,PHM,TRV,XLB,XLP',
  };
  const bad = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  if (bad.length) throw new Error(`prose de rotation contredite par l'instantané : ${bad.join(', ')}`);
}
const rotWin = `<div class="rot-windowbar" role="toolbar" aria-label="Fenêtre de calcul"><span class="rot-windowbar-label">Fenêtre</span><div class="rotation-tabs" id="rotWinTabs"></div></div>`;
const rotChart = (id, title, aria, h) => `<div class="rotation-chart-block"><div class="rotation-chart-title">${title}</div>${id === 'rotRisk' ? '' : `<div class="rot-controls" id="${id}Ctl"></div>`}<div id="${id}" class="rotation-chart-host rot-auto" role="img" aria-label="${aria}" style="height:${h}px"></div></div>`;
sections.push(section('rotation-indices', `Ajout du ${lit('5 novembre')}, ${lit('11 h 50')} · la rotation indice par indice`, 'Le lendemain du vote, la séance a suivi une rotation entamée début octobre', pill('MESURÉ'), 'validated',
  `<p class="section-intro">Nous avons recalculé le S&amp;P 500, le Nasdaq-100 et le Dow Jones titre par titre ; les places étrangères passent par leur ETF coté à New York. Les graphiques ci-dessous rejouent la course séance par séance. Mercredi, poids lourds et titre moyen ont avancé presque au même pas : l’ETF du S&amp;P 500 équipondéré (RSP) a pris ${chg('RSP', D3, REF, 2, 'rx_rsp_e')}, contre ${chg('SPY', D3, REF, 2, 'rx_spy_e')} pour SPY. Les plus grosses sociétés ont même mené les tranches de taille : Microsoft et Apple ont chacune apporté davantage à la performance de l’indice que Nvidia n’en a retiré.</p>`
  + `<p class="section-intro">Par famille, les défensives ont fait mieux que les cycliques, portées par la santé, la consommation de base et l’immobilier. Les deux meilleurs secteurs sont pourtant cycliques : consommation discrétionnaire et finance. L’énergie et l’industrie ferment la marche, la technologie reste presque à plat, et le cinquième le plus volatil de l’indice a fini à peine en baisse. Mercredi, l’Euro Stoxx ${lit('50')} (FEZ, en dollars) a pris ${chg('FEZ', D3, REF, 1, 'rx_fez_e')}, la Corée (EWY) ${chg('EWY', D3, REF, 1, 'rx_ewy_e')}.</p>`
  + `<p class="section-intro">La séance a prolongé la sortie de la technologie et du bêta engagée depuis le pic de la technologie du ${lit('6 octobre')} ; elle n’a creusé que de peu l’avance du titre moyen, comme le montre l’écart entre RSP et SPY. Choisissez la fenêtre « ${lit('1 mois')} » : l’indice pondéré recule pendant que la moyenne simple de ses titres monte, les défensives sont en tête, la technologie et la communication ferment la marche. Hors des États-Unis, les trois places les plus faibles sur cette fenêtre sont le Brésil, la Corée et Taïwan, ces deux dernières très liées à la puce. Ce sont des mesures du passé, pas une prévision.</p>`
  + `<div class="quality-note"><strong>Le repère à suivre jusqu’au ${lit('18 novembre')}, date de sortie forcée des lignes du scan.</strong> Mercredi, le S&amp;P 500 à bêta élevé (SPHB) a fait ${chg('SPHB', D3, REF, 1, 'rx_sphb_e')} et sa version à faible volatilité (SPLV) ${chg('SPLV', D3, REF, 1, 'rx_splv_e')}. Une clôture de SPHB au-dessus de ${px('SPHB', D3, 'close', 2, 'rx_sphb3')}, son niveau du ${lit('3 novembre')}, effacerait la séance de mercredi pour les titres à fort bêta. Ce serait un premier indice, à confirmer sur la courbe SPHB/SPLV de la page Rotations : si ce rapport repasse au-dessus de son niveau du ${lit('3 novembre')}, le goût du risque revient. Le scan n’est pas un panier défensif. HCA, le fonds de la consommation de base (XLP) et Travelers, un assureur peu sensible au bêta, vont dans le sens de la rotation ; PulteGroup, Autodesk, Canadian Pacific, Nike et le fonds des matériaux (XLB) sont cycliques ou de croissance, et une poursuite de la sortie du bêta pourrait les freiner. Ce repère ne change ni les stops ni la sortie forcée : il sert de contexte au prochain scan. Pour le suivre chaque soir : <a href="/rotation/?w=1w">page Rotations, fenêtre « ${lit('1 semaine')} »</a>.</div>`
  + `<div class="rotation-page rot-embed">${rotWin}<div class="rot-grid-2">`
  + rotChart('rotSect', 'S&amp;P 500 par secteur, pondéré par les capitalisations', 'Course des secteurs du S&amp;P 500, variation cumulée depuis la base de la fenêtre', 360)
  + rotChart('rotPlaces', 'Places boursières (ETF cotés à New York, en dollars)', 'Course des ETF des places boursières, variation cumulée depuis la base de la fenêtre', 560)
  + `</div>` + rotChart('rotRisk', 'Thermomètre du risque : rapports entre ETF, rebasés à zéro à la base', 'Rapports entre ETF de risque, rebasés à la date de base de la fenêtre', 380) + `</div>`
  + `<p class="provenance">Instantané figé des clôtures du ${lit('4 novembre')}, calculé ce jeudi matin (<a href="/daily/20261105/rotation-indices.json">données</a>) : composition actuelle des indices (léger biais en faveur des sociétés restées dans l’indice), pondération par la capitalisation de début de fenêtre avec le nombre d’actions actuel, cours hors dividendes. Les chiffres de RSP, SPY, FEZ, EWY, SPHB et SPLV cités ci-dessus sont ceux des ETF ; les graphiques montrent le recalcul titre par titre, très proche. Les places étrangères passent par leur ETF coté à New York, change compris ; EWY suit le MSCI Korea, proche du Kospi sans lui être identique. Thèmes, tailles, volatilité, Nasdaq-100 et Dow Jones : <a href="/rotation/?w=event">page Rotations</a>, mise à jour chaque soir.</p>`));

// 5. Ce que valait l'édition du 3 novembre
const sxRows = [
  ['Congrès démocrate, scénario de base', `${reg('/facts/election/senate_flipped', fr(0), 'sen_c', 'cnbc_results_20261104')} sièges repris au Sénat, au moins ${reg('/facts/election/house_flipped_min', fr(0), 'house_c', 'cnbc_results_20261104')} circonscriptions reprises à la Chambre, ${reg('/facts/election/house_uncalled', fr(0), 'unc_c', 'cnbc_results_20261104')} non attribuées (CNBC)`, verdict('Vrai', 'vrai')],
  ['« Le vote est déjà dans les prix », « le résultat le moins capable de surprendre »', `Dow ${chg('DIA', D3, REF, 1, 'dia_c')} ; « l’ampleur a pris les marchés de court » (Reuters)`, verdict('Faux', 'faux')],
  ['Solaire et énergies propres gagnants', `Solaire (TAN) ${chg('TAN', D2, REF, 1, 'tan_c')}, énergies propres (ICLN) ${chg('ICLN', D2, REF, 1, 'icln_c')} en deux séances`, verdict('Vrai', 'vrai')],
  ['Assureurs santé sous la pression de Medicaid', `Centene ${chg('CNC', D2, REF, 1, 'cnc_c')}, UnitedHealth ${chg('UNH', D2, REF, 1, 'unh_c')}, assureurs et cliniques (IHF) ${chg('IHF', D2, REF, 1, 'ihf_c')} en deux séances`, verdict('Faux', 'faux')],
  ['IA et centres de données sous contrôle', `Semi-conducteurs (SMH) ${chg('SMH', D2, REF, 1, 'smh_c')} en deux séances, mais Microsoft ${chg('MSFT', D2, REF, 1, 'msft_c')} : la puce baisse, les géants qui possèdent les centres montent`, verdict('Partiel', 'partiel')],
  ['Défense sous contrôle', `Lockheed Martin ${chg('LMT', D2, REF, 1, 'lmt_c')}, mais le fonds défense (ITA) seulement ${chg('ITA', D2, REF, 1, 'ita_c')} en deux séances`, verdict('Partiel', 'partiel')],
  [`Test d’invalidation n° ${lit('1')} : la thèse tombe si la volatilité à ${lit('9 jours')} reste au-dessus de ${lit('22,5')}`, `${vixR(vix9, 'vix9_c')} à la clôture de mercredi : test passé`, verdict('Passé', 'neutre')],
  [`Test d’invalidation n° ${lit('2')} : la thèse tombe si le Nasdaq-100 perd plus que les petites valeurs`, `QQQ ${chg('QQQ', D3, REF, 2, 'qqq_c')}, IWM ${chg('IWM', D3, REF, 2, 'iwm_c')} : aucun des deux ne perd, test passé`, verdict('Passé', 'neutre')],
  ['« N’achetez pas le saut de mercredi matin », solaire', `De l’ouverture à la clôture : TAN ${o2c('TAN', REF, 2, 'o2c_tan')}, First Solar ${o2c('FSLR', REF, 2, 'o2c_fslr')}`, verdict('Vrai', 'vrai')],
  ['« N’achetez pas le saut de mercredi matin », indices', `De l’ouverture à la clôture : SPY ${o2c('SPY', REF, 2, 'o2c_spy')}, DIA ${o2c('DIA', REF, 2, 'o2c_dia')}`, verdict('Partiel', 'partiel')]
];
sections.push(section('suite', 'Suite du 3 novembre', 'Ce que valaient nos scénarios', pill('MESURÉ', 'partial'), 'partial',
  table(['Ce que nous écrivions mardi', 'Ce qui s’est passé', 'Verdict'], sxRows)
  + `<p class="section-intro">Nos deux tests d’invalidation sont passés, et la thèse a quand même échoué. Ils guettaient la peur (volatilité, Nasdaq vendu) ; le marché a répondu par l’ampleur, avec la meilleure séance du Dow depuis avril ${lit('2025')} selon le Wall Street Journal. Des tests mal choisis ne sauvent pas une thèse fausse : nous la classons fausse.</p>`
  + `<p class="section-intro">L’autre erreur pèse davantage pour la suite. Nous avions lu Medicaid comme une menace pour les assureurs, d’après Reuters et CNBC avant le vote. Le marché a fait l’inverse : un Congrès démocrate peut retarder les coupes de la loi budgétaire de ${lit('2025')} qui devaient réduire les inscriptions, et cela profite d’abord aux assureurs et aux hôpitaux qui vivent de Medicaid (Reuters, ${lit('4 novembre')}). Le contrôle accru sur leurs pratiques viendra peut-être ; il pèse moins que le volume de patients.</p>`
  + `<p class="section-intro">Sur le solaire, « n’achetez pas le saut » avait raison dans la séance : le fonds TAN a ouvert en forte hausse, à ${px('TAN', REF, 'open', 2, 'tan_o')} contre ${px('TAN', D3, 'close', 2, 'tan_pc')} la veille, puis a fait ${o2c('TAN', REF, 2, 'o2c_tan2')} de l’ouverture à la clôture ; First Solar ${o2c('FSLR', REF, 2, 'o2c_fslr2')}. Acheter l’ouverture, c’était perdre dès le premier jour. Sur les indices, le conseil a coûté peu. Sur le S&amp;P 500, le lendemain du vote a monté une ${lit('sixième')} fois sur ${lit('sept')} depuis ${lit('2002')} : ${chg('SPY', D2, REF, 2, 'spy_c2')} de la clôture de lundi à celle de mercredi. AP le rappelle (dépêche de ${reg('/facts/press/ap_asia_published_at', timeR('Europe/Paris'), 'ap_t', 'ap_asia_20261105')}, heure de Paris) : les actions américaines montent d’habitude après les élections de mi-mandat, quel que soit le vainqueur. Le sens de mercredi n’avait donc rien d’exceptionnel ; son ampleur, si. En ${lit('2002')} et en ${lit('2018')}, cette hausse du lendemain avait été suivie d’un mois de baisse. Le tableau historique du ${lit('3 novembre')} reste valable.</p>`));

// 6. Le bilan du 31 octobre
const execCell = x => {
  if (x.fill === undefined) return `${verdict('Non exécuté', 'neutre')} · plus bas ${bp(x, idxOf(x.ser, REF), 3, 'lofa')} le ${dshort(REF)}`;
  if (x.fillAtOpen) return `${dshort(x.fillDay)} à l’ouverture, ${bp(x, x.fillI, 1, 'fo')}`;
  return `${dshort(x.fillDay)} à ${usd(x.entry)} (plus bas ${bp(x, x.fillI, 3, 'fl')})`;
};
const exitCell = x => {
  if (x.status === 'cible') return `${verdict('Cible', 'vrai')} ${usd(x.target)} le ${dshort(x.exitDay)} (plus haut ${bp(x, x.exitI, 2, 'xh')})`;
  if (x.status === 'stop') return `${verdict('Stop', 'faux')} ${usd(x.stop)} le ${dshort(x.exitDay)} (plus bas ${bp(x, x.exitI, 3, 'xl')})`;
  if (x.status === 'ouverte') return `${verdict('Ouverte', 'partiel')} · clôture ${bp(x, x.closeI, 4, 'xc')}`;
  return `ordre toujours posé, clôture ${bp(x, x.closeI, 4, 'xcf')}`;
};
const bilanRows = SETUPS.map(x => [
  `<strong>${x.s}</strong> · ${x.name}`, `${usd(x.entry)} / ${usd(x.stop)} / ${usd(x.target)}`, execCell(x), exitCell(x),
  x.fill === undefined ? '' : lit(frSigned(x.ret, 1)), x.fill === undefined ? '' : lit(frSigned(x.r, 2, ' R')),
  x.fill === undefined ? '' : `${lit(frSigned(x.c.r, 2, ' R'))}${x.c.status !== x.status ? ` · ${x.c.closed ? 'soldée' : 'ouverte'}` : ''}`]);
const rData = executed.map(x => ({ s: x.s, v: +x.r.toFixed(2), vc: +x.c.r.toFixed(2), closed: x.closed }));
const okC = S.OKTA, jcC = S.JCI;
const pctAbove = x => lit(frNum((x.close / x.stop - 1) * 100, 1) + ' %');
sections.push(section('bilan', 'Suite du daily du 31 octobre', 'Huit ordres exécutés, et deux façons de compter les stops', pill('MESURÉ', 'risk'), 'partial',
  `<p class="section-intro"><strong>Un aveu d’abord.</strong> Le ${lit('3 novembre')}, nous avons prescrit de juger ces stops à la clôture : « on garde la règle de l’article, la clôture », et pour Okta, « une clôture sous ${usd(183)} solde la ligne ». Le même jour, Okta est descendu à ${bp(okC, okC.exitI, 3, 'okta_l0')} en séance avant de remonter. Aujourd’hui, nous comptons le stop posé dès l’achat, comme le recommandait la formation du ${lit('31 octobre')}. C’est moins favorable à notre bilan, et c’est un changement de règle fait après avoir vu le résultat : nous publions donc les deux comptes côte à côte.</p>`
  + `<p class="section-intro">Le reste de la méthode ne change pas. L’ordre d’achat attend son prix ; si le titre ouvre dessous, l’achat se fait à l’ouverture. Stop posé : un plus-bas de séance sous le stop vaut sortie au stop, ou à l’ouverture si elle se fait plus bas. Règle de clôture : une clôture sous le stop vaut vente à l’ouverture suivante. Dans les deux cas, un plus-haut au-dessus de la cible vaut vente à la cible.</p>`
  + table(['Titre', 'Entrée / stop / cible', 'Achat', 'Sortie ou état (stop posé)', 'Résultat', 'En R, stop posé', 'En R, règle de clôture'], bilanRows)
  + `<div id="bilanChart" class="echart-box" role="img" aria-label="Résultat de chaque plan exécuté du 31 octobre, en multiples du risque prévu, au 4 novembre, selon le stop posé et selon la règle de clôture" style="width:100%; height:320px; margin-top:1rem;"></div>`
  + `<div class="three-col">`
  + `<article class="focus-card"><div class="focus-symbol">Stop posé</div><div class="focus-what">${lit(frSigned(sumR, 2, ' R'))}</div><p>Dont ${lit(frSigned(realizedR, 2, ' R'))} encaissés sur les ${lit('quatre')} lignes soldées et ${lit(frSigned(latentR, 2, ' R'))} latents sur les ${lit('quatre')} ouvertes, comptés à la clôture de mercredi. En risquant ${lit('1 %')} du capital par ligne, cela fait ${lit(frSigned(sumR, 2))} du capital.</p></article>`
  + `<article class="focus-card"><div class="focus-symbol">Règle de clôture du ${lit('3 novembre')}</div><div class="focus-what">${lit(frSigned(sumRc, 2, ' R'))}</div><p>Dont ${lit(frSigned(realizedRc, 2, ' R'))} encaissés (Microsoft et Centene) et ${lit(frSigned(latentRc, 2, ' R'))} latents sur ${lit('six')} lignes ouvertes. Okta et Johnson Controls n’ont jamais clôturé sous leur stop : comptés à leur clôture de mercredi, ils pèsent ${lit(frSigned(okC.c.r, 2, ' R'))} et ${lit(frSigned(jcC.c.r, 2, ' R'))} au lieu de ${lit('−1 R')} chacun.</p></article>`
  + `<article class="focus-card"><div class="focus-symbol">Montants égaux</div><div class="focus-what">${lit(frSigned(avgRet, 2))} en moyenne</div><p>Stop posé, la même somme sur chacune des ${lit('huit')} lignes rapporte bien moins : Okta, le plus nerveux, pesait autant que Microsoft alors que son stop était à ${lit(frNum(S.OKTA.risk / S.OKTA.fill * 100, 1) + ' %')} sous l’achat, contre ${lit(frNum(S.MSFT.risk / S.MSFT.fill * 100, 1) + ' %')} pour Microsoft.</p></article>`
  + `</div>`
  + `<p class="section-intro">Salesforce s’est acheté mardi à l’ouverture, sous son prix limite : son risque se mesure donc depuis ${bp(S.CRM, S.CRM.fillI, 1, 'crm_o')}, pas depuis ${usd(224)}. Okta a touché son stop mardi : plus bas à ${bp(S.OKTA, S.OKTA.exitI, 3, 'okta_l')}, sur un volume de ${volx('OKTA', D3, 10, 'okta_v')} sa moyenne des ${lit('dix')} séances précédentes, puis clôture à ${bp(S.OKTA, S.OKTA.exitI, 4, 'okta_c')}. Johnson Controls, le pari du refroidissement des centres de données, a touché ${bp(S.JCI, S.JCI.exitI, 3, 'jci_l')} mercredi, le jour où le vote a frappé ce thème ; c’est une simultanéité, aucune dépêche ne cite le titre.</p>`
  + `<div class="quality-note"><strong>Si vous avez suivi notre édition du ${lit('3 novembre')}.</strong> Okta (stop ${usd(183)}) et Johnson Controls (stop ${usd(138)}) sont encore ouverts chez vous, stop jugé à la clôture. Okta a fini mercredi à ${bp(okC, okC.closeI, 4, 'okta_c2')}, ${pctAbove(okC)} au-dessus de son stop ; Johnson Controls à ${bp(jcC, jcC.closeI, 4, 'jci_c2')}, ${pctAbove(jcC)} au-dessus. Gardez la règle que vous appliquez : une clôture sous le stop, vente à l’ouverture suivante. Ne changez pas de règle en cours de route.</div>`
  + `<div class="quality-note warning-note"><strong>Ce qui reste en jeu, et jusqu’à quand.</strong> UnitedHealth (stop ${usd(385)}, cible ${usd(432)}), Salesforce (${usd(210)}, ${usd(250)}), CrowdStrike (${usd(224)}, ${usd(278)}) et l’ETF IGV (${usd(99)}, ${usd(111.5)}) gardent leurs niveaux d’origine. La fiche du ${lit('31 octobre')} donnait une durée visée de « ${lit('5')} à ${lit('12')} séances, jusqu’à la mi-novembre », sans date de sortie. Nous fixons la fin au ${lit(END31_TXT)}, ${lit('douzième')} séance après l’entrée du ${lit('2 novembre')} : ce qui est encore ouvert ce jour-là, Okta et Johnson Controls compris pour qui les tient, se vend avant ${lit('21h45')}, heure de Paris. L’ordre Fastenal à ${usd(50.8)} n’a jamais été servi : plus bas de mercredi à ${bp(S.FAST, idxOf(S.FAST.ser, REF), 3, 'lofa2')}, clôture ${lit(frNum(fastGap, 1) + ' %')} au-dessus du prix d’achat. Il vaut jusqu’au ${lit(END31_TXT)} inclus, puis s’annule ; il s’annule aussi si le titre ouvre sous ${usd(48.9)}. S’il est servi, stop posé dès l’achat à ${usd(48.9)} ; servi tard, il n’aura que peu de séances avant la sortie du ${lit(END31_TXT)}. Frais et glissement d’exécution ne sont pas comptés.</div>`));

// 7. Formation
sections.push(section('formation', 'Formation du jour', 'Stop posé et sortie sur clôture : le scan cumule les deux', pill('PÉDAGOGIE'), 'validated',
  `<div class="pedagogy-box"><p>Nos fiches du ${lit('31 octobre')} disaient deux choses différentes. La fiche : « On se trompe si&nbsp;: Clôture sous ${usd(497)} » pour Microsoft, et de même pour chaque ligne. La formation : « Poser le stop tout de suite ». Le ${lit('3 novembre')}, nous avons tranché pour la clôture ; aujourd’hui, nous comptons le stop posé. Changer de règle selon ce qui aurait mieux marché la veille revient à choisir le résultat. C’est l’erreur à ne pas reproduire.</p>`
  + `<p><strong>L’ordre stop posé</strong> sort dès que le prix touche le niveau, même une minute. Okta est descendu à ${bp(S.OKTA, S.OKTA.exitI, 3, 'okta_l2')} mardi, ${lit(frNum(S.OKTA.stop - S.OKTA.ser.bars[S.OKTA.exitI][3], 2) + ' $')} sous le stop, avant de remonter : la ligne est soldée à ${lit('−1 R')}. L’avantage : la perte est connue d’avance, sauf écart d’ouverture.</p>`
  + `<p><strong>La sortie sur clôture</strong> ignore les mèches de séance mais fait vendre le lendemain, au prix de l’ouverture. Seule, elle protège mal un titre qui s’effondre en séance ou ouvre en chute après une mauvaise nouvelle : la perte peut dépasser ${lit('1 R')}.</p>`
  + `<p><strong>Le scan du ${lit('5 novembre')} ne choisit pas : il cumule les deux.</strong> Le stop est posé dès l’achat dans le système du courtier, avec une validité « à révocation » ou jusqu’à la sortie forcée, jamais « jour ». Stop et objectif dans un ordre lié (OCO) si votre courtier le propose ; sinon, stop posé et objectif surveillé vous-même. En plus, une clôture sous le plus-bas du ${lit('4 novembre')}, l’invalidation, fait vendre à l’ouverture suivante, même si le cours est resté au-dessus du stop. Le stop limite la perte dans la séance ; l’invalidation sort plus tôt quand la thèse casse sans toucher le stop. Les deux règles sont écrites avant l’achat, et on n’en change plus.</p></div>`));

// 8. L'opportunité : le scan du 5 novembre
const scanRows = LINES.map(x => [
  `<strong>${x.ticker}</strong> · ${SHORT[x.ticker] || x.name}`,
  `${usd(x.entry)} / ${usd(x.stop)} / ${usd(x.tp1)}`, usd(x.invalidation_level), lit(frNum(x.rr, 2)),
  FAMILY[x.strategy], chg(x.ticker, D3, REF, 1, 'sc'), CAUSE[x.ticker]()]);
const hcaLine = LINES.find(x => x.ticker === 'HCA');
const lowRR = LINES.filter(x => x.rr < 0.9);
// Paire la plus corrélée du scan, relue dans le texte publié du scan (corrélation sur 120 séances).
const CORR_TXT = '0,66';
if (!/PulteGroup et le fonds XLB des matériaux ont corrélé à 0,66 sur 120 séances, la paire la plus liée de la liste/.test(JSON.stringify(scan))) throw new Error('corrélation PHM/XLB du scan');
if (!(jcC.close / jcC.stop < okC.close / okC.stop)) throw new Error('ordre JCI/Okta, règle de clôture');
if (lowRR.map(x => x.ticker).join() !== 'XLB,XLP') throw new Error('lignes à gain/risque inférieur à 1');
if (LINES.some(x => !(x.invalidation_level > x.stop && x.invalidation_level < x.entry))) throw new Error('invalidation hors de l’intervalle stop-entrée');
sections.push(section('trade', 'Idées de trading', 'Le scan du 5 novembre suit la rotation, pas la puce', pill('ATTENDRE l’ouverture', 'partial'), 'partial',
  `<p class="section-intro">Les huit lignes viennent du scan publié ce matin, qui fait foi pour les niveaux et pour les règles de sortie, reprises ci-dessous sans les raccourcir. Elles collent à la carte de mercredi : hôpitaux (HCA), logement (PulteGroup et le fonds des matériaux, liés entre eux), consommation (Nike et le fonds de la consommation de base), assurance dommages (Travelers), rail (Canadian Pacific) et un logiciel de conception (Autodesk). Aucune n’est un semi-conducteur, aucune n’est pétrolière ; le scan a écarté Chevron pour cette raison.</p>`
  + `<p class="scroll-hint" aria-hidden="true">Faites glisser le tableau →</p>`
  + table(['Ligne', 'Entrée / stop / objectif', 'Invalidation (plus-bas du 4 novembre)', 'Gain/risque', 'Famille', 'Mercredi', 'Lien avec le vote'], scanRows)
  + `<p class="provenance">Niveaux : scan publié du ${lit('5 novembre')} (entrée = clôture du ${lit('4 novembre')}, invalidation = plus-bas du ${lit('4 novembre')}, horizon de ${lit('10')} séances, sortie forcée le ${lit('18 novembre')} avant ${lit('21h45')}, heure de Paris). Gain/risque recalculé ici depuis les niveaux publiés. Variations de mercredi mesurées sur nos cours vérifiés.</p>`
  + `<ul class="checklist">`
  + `<li><i class="fas fa-clock"></i><div><strong>Ordre d’achat valable la seule séance de ce ${sessionDay('sd_t')}, posé après l’ouverture de New York (${lit('15h30')} à Paris).</strong><br>Stop-limite au prix publié si le cours est dessous, ordre limité au même prix s’il est déjà au-dessus. Jamais plus cher : HCA à ${usd(hcaLine.entry)} au plus. Prix non touché dans la séance : pas d’achat.</div></li>`
  + `<li><i class="fas fa-ban"></i><div><strong>Pas d’ordre si l’ouverture ou le cours du moment est sous le plus-bas du ${lit('4 novembre')}.</strong><br>Si vous arrivez tard, vérifiez les deux cours : l’un des deux sous l’invalidation, pas d’ordre, même si le cours est remonté depuis.</div></li>`
  + `<li><i class="fas fa-shield-halved"></i><div><strong>Stop posé dès l’achat, validité « à révocation » ou jusqu’au ${lit('18 novembre')}, jamais « jour ».</strong><br>Stop et objectif dans un ordre lié (OCO) si votre courtier le propose ; sinon, stop posé et objectif surveillé vous-même.</div></li>`
  + `<li><i class="fas fa-door-open"></i><div><strong>Une clôture sous le plus-bas du ${lit('4 novembre')} fait vendre à l’ouverture suivante, même au-dessus du stop.</strong><br>Le stop ne dispense pas de cette règle : l’invalidation est plus proche que le stop sur chaque ligne.</div></li>`
  + `<li><i class="fas fa-flag-checkered"></i><div><strong>Sortie forcée le ${lit('18 novembre')}, avant ${lit('21h45')}, heure de Paris.</strong><br>Ce qui n’a touché ni le stop, ni l’objectif, ni l’invalidation se vend ce jour-là.</div></li>`
  + `</ul>`
  + `<div class="quality-note warning-note"><strong>Le risque commun : huit achats après la même séance.</strong> Les huit lignes ont pris ${lit(frSigned(avgMove, 1))} en moyenne mercredi, de ${lit(frSigned(Math.min(...LINES.map(x => x.move)), 1))} à ${chg('HCA', D3, REF, 1, 'hca_r')} pour HCA, qui a échangé ${volx('HCA', REF, 20, 'hca_v')} son volume moyen des ${lit('vingt')} séances précédentes. Toutes entrent au même prix, la clôture de ce jour-là. Si la séance de mercredi se défait, elles reculent ensemble. Selon Investing.com, à ${reg('/facts/press/investing_futures_at', timeR('Europe/Paris'), 'inv_t', 'investing_futures_20261105')} heure de Paris, le contrat Nasdaq-100 était à ${reg('/facts/press/investing_nq_future_pct', fr(1, ' %', true), 'inv_nq', 'investing_futures_20261105')} et le contrat Dow Jones à ${reg('/facts/press/investing_dow_future_pct', fr(1, ' %', true), 'inv_dow', 'investing_futures_20261105')}. Si vous n’en prenez qu’une partie, ne choisissez pas sur la hausse de mercredi : le scan n’établit aucun classement entre les lignes.</div>`
  + `<ul class="checklist">`
  + `<li><i class="fas fa-scale-balanced"></i><div><strong>Le scan dit seulement ${lit('0,5 à 1 %')} du capital risqué par ligne. Notre règle : pas plus de ${lit('4 %')} en risque sur l’ensemble.</strong><br>Budget restant = ${lit('4 %')} moins le risque déjà engagé sur les lignes encore ouvertes, ordre Fastenal compris s’il est servi ; divisez-le par ${lit('0,5 %')} pour savoir combien de nouvelles lignes prendre à ${lit('0,5 %')} chacune (deux fois moins si vous risquez ${lit('1 %')} par ligne). Exemple : lignes du ${lit('31 octobre')} prises à ${lit('1 %')}, il en reste ${lit('quatre')} ouvertes avec le stop posé, ${lit('six')} avec la règle de clôture (Okta et Johnson Controls en plus) : le budget est déjà plein ou dépassé, aucune nouvelle ligne tant qu’une n’est pas soldée. Pour choisir ensuite : compte européen, les ${lit('six')} actions seulement, car XLB et XLP sont souvent inachetables et visent moins qu’ils ne risquent ; une seule ligne entre PulteGroup et XLB, corrélés à ${lit(CORR_TXT)} sur ${lit('120')} séances, la paire la plus liée du scan ; pas d’Autodesk si vous tenez déjà du logiciel (Salesforce, CrowdStrike, IGV, ou Okta pour la règle de clôture).</div></li>`
  + `<li><i class="fas fa-triangle-exclamation"></i><div><strong>XLB (${lit(frNum(lowRR[0].rr, 2))}) et XLP (${lit(frNum(lowRR[1].rr, 2))}) visent moins qu’ils ne risquent.</strong><br>Leur objectif est plus proche de l’entrée que leur stop. Et ces deux fonds n’ont pas de document d’informations clés : la plupart des courtiers européens refusent leur achat à un particulier.</div></li>`
  + `<li><i class="fas fa-layer-group"></i><div><strong>Autodesk est un logiciel.</strong><br>Avec Salesforce, CrowdStrike et l’ETF IGV encore ouverts du ${lit('31 octobre')}, et Okta pour qui applique la règle de clôture, c’est le même pari, celui d’un rebond du logiciel : comptez-les ensemble dans le plafond de risque.</div></li>`
  + `<li><i class="fas fa-ban"></i><div><strong>Pas de nouvelle ligne de semi-conducteur ni de pétrolier.</strong><br>Le vote les a frappés, les prévisions d’Arm et de Qualcomm pèsent sur le contrat Nasdaq ce matin ; aucun scan ne les retient.</div></li>`
  + `</ul>`));

// 9. Scénarios
sections.push(section('scenarios', 'Scénarios', 'La rotation tient-elle jusqu’au 18 novembre ?', pill('À SURVEILLER', 'partial'), 'partial',
  `<div class="scenario-grid">`
  + `<article class="scenario base"><h3>Base : la rotation continue</h3><p>Le pétrole reste bas, les taux reculent, l’emploi de vendredi et l’inflation de mardi ne surprennent pas. Hôpitaux, logement et consommation gardent la main ; les huit lignes ont alors leur meilleure chance d’atteindre un objectif volontairement proche.</p></article>`
  + `<article class="scenario down"><h3>Contraire : le soulagement s’épuise</h3><p>Sur Polymarket, la hausse de la Fed en décembre est passée de ${lit('72,5 %')} mardi à ${fedR('fed_s')} ce matin (cote de ${fedAt()}, heure de Paris) : sur ce marché au moins, la chute du pétrole n’a pas effacé le risque de taux. Un emploi solide vendredi relèverait les rendements et frapperait d’abord PulteGroup et le fonds des matériaux. La baisse de la puce peut aussi gagner les indices.</p></article>`
  + `<article class="scenario flat"><h3>Le pétrole rebondit</h3><p>La baisse du baril repose sur un pari politique, pas sur un accord. Un incident dans le Golfe effacerait l’argument des taux plus bas ; c’est le scénario qui toucherait la liste entière en même temps.</p></article>`
  + `<article class="scenario up"><h3>Quand nous aurons tort</h3><p>Nous changeons d’avis si le pétrole (USO) repasse au-dessus de sa clôture de mardi, ${px('USO', D3, 'close', 2, 'uso_inv')}, ou si HCA et PulteGroup clôturent sous leurs plus-bas de mercredi (${usd(LINES[0].invalidation_level)} et ${usd(LINES[1].invalidation_level)}) avant vendredi soir : la rotation n’aurait été qu’une séance. Ce seuil n’est pas qu’un signal pour nous : c’est l’invalidation du scan, et une clôture dessous fait déjà vendre ces lignes à l’ouverture suivante.</p></article>`
  + `</div>`));

// 10. Agenda
const echeancier = renderEventTimeline({
  id: 'echeancier', asof: '2026-11-05', from: '2026-11-05', to: '2026-11-13', requireProof: true,
  keyWindow: { from: '2026-11-05', to: '2026-11-06', labelHtml: `Fenêtre clé · jeu. ${paris(claimsJ, 'kw_a')} → ven. ${paris(bowman, 'kw_b')}` },
  events: [
    { date: '2026-11-05', category: 'earnings', impact: 'medium', label: 'Cigna', detail: 'assureurs santé, avant l’ouverture', icon: 'pill', href: '#bilan', uncertain: true, proof: ciDate('tl_ci'), proofHidden: true },
    { date: '2026-11-05', category: 'macro', impact: 'medium', label: 'Chômage', detail: 'inscriptions hebdomadaires', icon: 'data', proof: paris(claimsJ, 'tl_claims') },
    { date: '2026-11-05', category: 'plan', impact: 'strong', label: 'Ordres du scan', detail: 'après l’ouverture de New York', icon: 'entry', href: '#trade', proof: sessionDay('tl_scan', 'day_month'), proofHidden: true },
    { date: '2026-11-06', category: 'macro', impact: 'strong', label: 'Emploi américain', detail: 'taux, logement', icon: 'data', proof: paris(nfp, 'tl_nfp') },
    { date: '2026-11-06', category: 'macro', impact: 'medium', label: 'Fed, Bowman', detail: 'supervision bancaire', icon: 'bank', proof: paris(bowman, 'tl_bow') },
    { date: '2026-11-10', category: 'macro', impact: 'strong', label: 'Inflation (CPI)', detail: 'octobre', icon: 'data', proof: cpiT('tl_cpi') },
    { date: '2026-11-13', category: 'macro', impact: 'medium', label: 'Prix à la production', detail: 'octobre', icon: 'data', proof: ppiT('tl_ppi') }
  ],
  chains: [
    { steps: [{ label: 'Emploi fort', icon: 'data', category: 'macro' }, { label: 'Taux', icon: 'bank', tone: 'up' }, { label: 'Logement, matériaux', category: 'plan', icon: 'company', tone: 'down' }] },
    { steps: [{ label: 'Pétrole rebondit', icon: 'oil', category: 'geo' }, { label: 'Inflation', icon: 'data', tone: 'up' }, { label: 'Toute la liste', category: 'plan', icon: 'company', tone: 'down' }] },
    { steps: [{ label: 'Puce vendue', icon: 'chip', category: 'earnings' }, { label: 'Nasdaq', icon: 'chip', tone: 'down' }, { label: 'Logiciel encore ouvert', category: 'plan', icon: 'company', tone: 'down' }] }
  ]
});
sections.push(section('agenda', 'Agenda du jour et de la semaine', 'Ce qui peut bouger la Bourse jusqu’au vendredi 13', pill('DATÉ'), 'validated',
  echeancier
  + `<p class="section-intro">Les États-Unis sont à l’heure d’hiver depuis le ${lit('1er novembre')} : six heures d’écart avec Paris, ouverture de New York à ${lit('15h30')} et clôture à ${nyClose('nyc_a')}. L’emploi d’octobre tombe vendredi à ${paris(nfp, 'nfp_p')}, l’inflation d’octobre mardi ${regDate('cpi', 'bls_cpi', 'cpi_d')} à ${cpiT('cpi_p')} (BLS), les prix à la production le ${regDate('ppi', 'bls_ppi', 'ppi_d')}. Cigna publie ce matin selon une seule source de calendrier, non confirmée par la société : un test pour UnitedHealth, encore ouvert dans le bilan. La sortie forcée des lignes du scan, le ${lit('18 novembre')}, tombe après cette frise.</p>`
  + `<p class="provenance">Horaires : calendrier macro collecté (chômage, emploi, Fed) et calendrier officiel de la BLS (inflation, prix à la production). Date de Cigna : calendrier de résultats collecté, source unique.</p>`));

// 11. Ailleurs
sections.push(section('ailleurs', 'Ailleurs', 'Asie, crypto, métaux : la même ligne de fracture', pill('PARTIEL', 'partial'), 'partial',
  `<div class="two-col"><article class="data-card"><h3>Asie ce jeudi</h3><p>La puce entraîne Séoul : le Kospi était à ${reg('/facts/asia/kospi_pct', fr(1, ' %', true), 'kospi', 'ap_asia_20261105')} à ${reg('/facts/asia/kospi_level', fr(2), 'kospi_l', 'ap_asia_20261105')} en fin de matinée, le Nikkei ${reg('/facts/asia/nikkei_pct', fr(1, ' %', true), 'nikkei', 'ap_asia_20261105')}. Hong Kong, moins exposé à l’IA, gagnait ${reg('/facts/asia/hang_seng_pct', fr(1, ' %', true), 'hsi', 'ap_asia_20261105')} (AP). Relevés de presse en cours de séance, pas des clôtures.</p></article>`
  + `<article class="data-card"><h3>Crypto et métaux</h3><p>Sur la bougie UTC du ${lit('4 novembre')}, le bitcoin a fini à ${px('BTC-USD', REF, 'close', 0, 'btc_c')} (${chg('BTC-USD', D3, REF, 1, 'btc_c2')}) et l’ether à ${px('ETH-USD', REF, 'close', 2, 'eth_c')} (${chg('ETH-USD', D3, REF, 1, 'eth_c2')}). Ce jeudi matin, il cote ${offPx(btcLive, 0, 'btc_l', ' $')}, un relevé, pas une clôture. L’or (GLD) a pris ${chg('GLD', D3, REF, 1, 'gld_c')} et l’argent (SLV) ${chg('SLV', D3, REF, 1, 'slv_c')}, en même temps que le dollar et les taux reculaient. Aucune dépêche collectée ne relie ces mouvements au vote.</p></article></div>`
  + `<p class="provenance">Europe : selon Reuters, les actions européennes ont atteint mercredi un plus-haut de deux mois ; aucune clôture européenne n’est collectée dans cette édition.</p>`));

// 12. À surveiller
sections.push(section('surveiller', 'À surveiller', 'Cinq points de contrôle d’ici vendredi soir', pill('CHECKLIST'), 'validated',
  `<ul class="checklist">`
  + `<li><i class="fas fa-eye"></i><div><strong>L’ouverture des huit lignes du scan.</strong><br>Ouverture ou cours du moment sous le plus-bas de mercredi : pas d’ordre. Après l’achat, une clôture dessous fait vendre à l’ouverture suivante. HCA : ${usd(LINES[0].invalidation_level)}. PulteGroup : ${usd(LINES[1].invalidation_level)}.</div></li>`
  + `<li><i class="fas fa-microchip"></i><div><strong>Le Nasdaq-100 face au Dow.</strong><br>Mercredi, le Dow a battu le Nasdaq-100 de ${lit(frNum(chgV('DIA') - chgV('QQQ'), 1) + ' points')}. Si l’écart se creuse encore, la rotation s’installe ; s’il se referme par une baisse du Dow, elle s’arrête.</div></li>`
  + `<li><i class="fas fa-oil-can"></i><div><strong>Le pétrole.</strong><br>WTI à ${offPx(wti, 2, 'wti_w', ' $')} ce matin. Le seuil qui nous ferait changer d’avis : USO au-dessus de ${px('USO', D3, 'close', 2, 'uso_w')}.</div></li>`
  + `<li><i class="fas fa-briefcase"></i><div><strong>L’emploi de vendredi, ${paris(nfp, 'nfp_w')}.</strong><br>Un chiffre fort relance la hausse de taux de décembre, déjà cotée à ${fedR('fed_w')} sur Polymarket (cote de ${fedAt()}, heure de Paris).</div></li>`
  + `<li><i class="fas fa-list-check"></i><div><strong>Les lignes du 31 octobre.</strong><br>Avec le stop posé, l’ETF IGV est la plus proche de son stop parmi celles encore ouvertes : ${lit(frNum((NEAR.close / NEAR.stop - 1) * 100, 1) + ' %')} au-dessus de ${usd(NEAR.stop)}. Avec la règle de clôture, Johnson Controls est à ${pctAbove(jcC)} de son stop, puis Okta à ${pctAbove(okC)}. Fastenal attend toujours ${usd(50.8)}. Fin que nous fixons pour ces lignes et cet ordre : le ${lit(END31_TXT)}, avant ${lit('21h45')}, heure de Paris.</div></li>`
  + `</ul>`));

// 13. Sources
const srcLinks = [
  ['https://www.cnbc.com/2026/11/04/democrats-2026-midterm-election-results.html', 'CNBC, 4 novembre : le résultat des midterms'],
  ['https://finance.yahoo.com/energy/articles/oil-data-centre-stocks-sink-023443660.html', 'Reuters, 5 novembre : pétrole et centres de données après le vote'],
  ['https://finance.yahoo.com/healthcare/articles/health-insurers-hospitals-rally-sweeping-150037226.html', 'Reuters, 4 novembre : assureurs santé et hôpitaux'],
  ['https://finance.yahoo.com/markets/world-indices/articles/asian-shares-mostly-advance-following-025925939.html', 'AP, 5 novembre : Asie, Wall Street, pétrole, défense'],
  ['https://finance.yahoo.com/markets/stocks/articles/stocks-rally-midterms-chip-stocks-052100921.html', 'etf.com, 5 novembre : la puce et les moratoires sur les centres de données'],
  ['https://finance.yahoo.com/economy/article/housing-stocks-rally-following-midterm-elections-treasury-yields-dip-lower-171937967.html', 'Yahoo Finance, 4 novembre : le logement après le vote'],
  ['https://finance.yahoo.com/markets/stocks/articles/nike-climbs-7-dow-rally-175741566.html', '24/7 Wall St., 4 novembre : Nike et la consommation'],
  ['https://finance.yahoo.com/markets/stocks/articles/u-stock-index-futures-steady-011139159.html', 'Investing.com, 5 novembre : contrats à terme, Arm et Qualcomm'],
  ['https://finance.yahoo.com/m/38b7f7a9-4dc7-32b3-8cb1-4d7a5f3fb683/the-dow%E2%80%99s-big-winners-today.html', 'The Wall Street Journal, 4 novembre : la séance du Dow'],
  ['https://www.bls.gov/schedule/news_release/cpi.htm', 'BLS : calendrier de l’inflation'],
  ['https://www.bls.gov/schedule/news_release/ppi.htm', 'BLS : calendrier des prix à la production'],
  ['/scanner/20261105/', 'Notre scan du 5 novembre : les huit lignes'],
  ['/daily/20261103/', 'Notre édition spéciale du 3 novembre'],
  ['/daily/20261031/', 'Notre daily du 31 octobre : les neuf plans']
].map(([u, l]) => `<li><a href="${u}"${u.startsWith('http') ? ' rel="noopener" target="_blank"' : ''}>${l}</a></li>`).join('');
sections.push(section('sources', 'Sources et limites', 'Sur quoi repose cette édition', pill('PARTIEL', 'partial'), 'partial',
  `<div class="source-list">`
  + `<div class="source-item"><strong>Cours</strong><span>Clôtures vérifiées du ${refDay('ref_s', 'full')} ; bougies crypto UTC terminées à la même date. Les plans du ${lit('31 octobre')} sont suivis sur les séances du ${lit('2')}, ${lit('3')} et ${lit('4 novembre')}.</span></div>`
  + `<div class="source-item"><strong>Relevés de ce jeudi</strong><span>Contrats à terme, pétrole, bitcoin et cotes Polymarket : relevés pendant la nuit et la matinée, jamais des clôtures.</span></div>`
  + `<div class="source-item"><strong>Vote et attributions</strong><span>CNBC pour le résultat ; Reuters, AP, etf.com, Yahoo Finance, 24/7 Wall St., Investing.com et le Wall Street Journal pour l’attribution des mouvements. BLS pour le calendrier de l’inflation.</span></div>`
  + `</div>`
  + `<ul class="provenance">${srcLinks}</ul>`
  + `<div class="quality-note warning-note"><strong>Limites.</strong> Le décompte de quelques sièges continue. Une attribution de presse dit ce qu’un journaliste ou un analyste affirme, pas ce que nous avons prouvé ; quand aucune dépêche ne relie un titre au vote, nous écrivons « simultanéité ». Le bilan ne compte ni frais ni glissement d’exécution. Les lignes du scan sont des plans conditionnels, pas des ordres validés.</div>`
  + `<p class="section-intro">Ce contenu est informatif. Il ne constitue pas un conseil en investissement. Investir comporte un risque de perte en capital.</p>`));

// ── Noms et repères écrits en toutes lettres : littéraux déclarés, liste close ─
const LITERAL_PATTERNS = [
  /S&amp;P 500/g, /S&P 500/g, /Nasdaq-100/g, /\b(?:19|20)\d{2}\b/g,
  /\b\d{1,2}(?:er)? (?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\b/g,
  /\b(?:30 jours|24 heures)\b/g, /(?<![\p{L}])(?:deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|vingt|tiers|moitié)(?![\p{L}])/giu,
  /\b31\/10\b/g, /24\/7 Wall St\./g, /\b20 ans\b/g, /\bvendredi 13\b/g, /\b31 OCTOBRE\b/g
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
const title = 'Après la vague démocrate, la puce recule, l’hôpital et la maison bondissent';
const description = `Daily du 5 novembre 2026. Mercredi, le Dow Jones (DIA) a pris ${frSigned(chgV('DIA'), 1)}, les semi-conducteurs ${frSigned(chgV('SMH'), 1)} et le pétrole ${frSigned(chgV('USO'), 1)}. Nos scénarios du 3 novembre confrontés au vote, le bilan des neuf plans du 31 octobre compté de deux façons (${frSigned(sumR, 2, ' R')} avec un stop posé, ${frSigned(sumRc, 2, ' R')} avec la règle de clôture du 3 novembre) et les huit lignes du scan post-élections, avec leurs règles de sortie complètes.`;
const badges = [`Dow ${frSigned(chgV('DIA'), 1)} mercredi`, `Puces ${frSigned(chgV('SMH'), 1)}`, `Pétrole ${frSigned(chgV('USO'), 1)}`, `Bilan du 31 octobre : ${frSigned(sumR, 2, ' R')}, dont ${frSigned(realizedR, 2, ' R')} encaissés`, 'Scan : 8 lignes', 'Ajout 11 h 50 : la rotation indice par indice'];
const css = fs.readFileSync(path.join(DIR, '_style.css'), 'utf8');
const html = `<!DOCTYPE html>
<html lang="fr" data-tags="us,macro,geopolitique,healthcare,semis,energy,trade-idea,retrospective,formation" data-tab="daily">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily — 5 novembre 2026 : la rotation d’après les midterms</title>
  <meta name="description" content="${description}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://articles.dailytickers.com/daily/20261105/">
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

<section class="hero-section"><div class="container"><div class="hero-date">Jeudi 5 novembre 2026 &bull; Suite de l’édition midterms &bull; clôtures du mercredi 4 novembre</div><h1 class="hero-title">${title}</h1><p class="hero-subtitle">${description}</p><div class="hero-badges">${badges.map(b => `<span class="hero-badge">${b}</span>`).join('')}</div><div id="article-clickable-tags" class="card-tags"></div></div></section>

<main class="report-main"><div class="container">
${sections.join('\n')}
</div></main>

<div class="fnav" id="floatingNav"><div class="fnav-menu" id="fnavMenu"><a href="#alerte" class="fnav-item" data-section="alerte"><i class="fas fa-bullhorn"></i><span>L’essentiel</span></a><a href="#vote" class="fnav-item" data-section="vote"><i class="fas fa-landmark"></i><span>Le verdict</span></a><a href="#rotation-indices" class="fnav-item" data-section="rotation-indices"><i class="fas fa-arrows-rotate"></i><span>La rotation</span></a><a href="#bilan" class="fnav-item" data-section="bilan"><i class="fas fa-list-check"></i><span>Bilan du 31 octobre</span></a><a href="#trade" class="fnav-item" data-section="trade"><i class="fas fa-crosshairs"></i><span>Le scan</span></a><a href="#agenda" class="fnav-item" data-section="agenda"><i class="fas fa-calendar"></i><span>Agenda</span></a></div><button class="fnav-btn" id="fnavBtn" type="button" aria-label="Navigation"><i class="fas fa-bars" id="fnavIcon"></i><span class="fnav-btn-label" id="fnavLabel">Menu</span></button></div>
<footer class="article-footer">&copy; 2026 DailyTickers. Clôtures du 4 novembre 2026 ; contrats à terme et cotes relevés le 5 novembre au matin. Ceci n&rsquo;est pas un conseil financier.<br><a href="/" title="Accueil" aria-label="Accueil"><i class="fas fa-house"></i></a></footer>
<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js"></script>
<script>const CHART_SPECS=${JSON.stringify(chartSpecs)};(function(){if(typeof echarts==='undefined')return;var xs=[];CHART_SPECS.forEach(function(c){var el=document.getElementById(c.id);if(!el)return;var x=echarts.init(el);x.setOption(Object.assign({animation:false,textStyle:{fontFamily:'Inter,system-ui,sans-serif'},tooltip:{trigger:'axis'}},c.spec));xs.push(x);});window.addEventListener('resize',function(){xs.forEach(function(x){x.resize();});});})();</script>
<script src="/assets/rotation-race.js"></script>
<script>(function(){var R=window.DTRotation;if(!R||typeof echarts==='undefined')return;var D,W='1w',rc={};var SECT=['technology','communication_services','consumer_discretionary','financials','industrials','materials','energy','healthcare','consumer_staples','utilities','real_estate'];var RAT=[['SPHB','SPLV'],['RSP','SPY'],['IWM','SPY'],['FEZ','SPY'],['EWY','SPY']];
function e(s){return D.etfs.find(function(x){return x.symbol===s})}function base(){return D.windows.find(function(w){return w.key===W}).base}
function race(id,items){if(rc[id])rc[id].dispose();var el=document.getElementById(id);el.style.height=Math.max(260,items.length*(el.clientWidth<520?24:27)+56)+'px';rc[id]=R.race(el,{dates:D.dates,base:base(),items:items,controls:R.controls(document.getElementById(id+'Ctl'))})}
function draw(){var sp=D.indices.sp500.dims.sector;race('rotSect',sp.map(function(g){return{name:g.label,series:g.series,sub:g.n+' titres'}}));race('rotPlaces',D.etfs.filter(function(x){return x.kind==='region'}).map(function(x){return{name:x.symbol+' · '+x.label,series:x.series}}));
R.lines(document.getElementById('rotRisk'),{dates:D.dates,base:base(),lead:10,baseLabel:'base',items:RAT.map(function(r){var a=e(r[0]),b=e(r[1]);return{name:r[0]+'/'+r[1],series:a.series.map(function(v,i){return v/b.series[i]*100})}})});
var t=document.getElementById('rotWinTabs');t.innerHTML=D.windows.map(function(w){return '<button type="button" class="rotation-tab'+(w.key===W?' active':'')+'" aria-pressed="'+(w.key===W)+'" data-k="'+w.key+'">'+w.label+'</button>'}).join('');Array.prototype.forEach.call(t.children,function(b){b.onclick=function(){W=b.dataset.k;draw()}})}
R.load('/daily/20261105/rotation-indices.json').then(function(d){D=d;draw()}).catch(function(){var n=document.querySelector('.rot-embed');if(n)n.innerHTML='<p class="provenance">Graphiques de rotation indisponibles pour le moment.</p>'})})();</script>
<script src="/assets/echarts-responsive.js"></script>
<script src="/assets/core.js"></script>
<script src="/assets/tag-renderer.js"></script>
</body>
</html>
`;

fs.writeFileSync(path.join(DIR, 'index.html'), html);
const articleSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, 'index.html'))).digest('hex');
fs.writeFileSync(path.join(DIR, '_data/chart-data.json'), JSON.stringify({ reference_close: REF, previous_close: D3, chart_specs: chartSpecs }, null, 2) + '\n');
fs.writeFileSync(path.join(DIR, '_data/claims.json'), JSON.stringify({ reference_close: REF, article_path: `${REL}/index.html`, article_sha256: articleSha, generated_by: `${REL}/_build.cjs`, literals: [...literals].sort(), claims }, null, 2) + '\n');
console.log(`daily rendu : ${sections.length} sections, ${claims.length} claims, ${literals.size} littéraux, ${(html.length / 1024).toFixed(1)} Ko`);
console.log(JSON.stringify({ setups: SETUPS.map(x => ({ s: x.s, status: x.status, fillDay: x.fillDay, fill: x.fill, exit: x.exit, exitDay: x.exitDay, close: x.close, ret: x.ret && +x.ret.toFixed(2), r: x.r && +x.r.toFixed(3) })), sumR, realizedR, latentR, sumRc, realizedRc, latentRc, closeRule: executed.map(x => [x.s, x.c.status, +x.c.r.toFixed(3)]), END31, avgRet, fastGap, avgMove, lines: LINES.map(x => [x.ticker, +x.move.toFixed(2), +x.rr.toFixed(3)]) }, null, 1));
