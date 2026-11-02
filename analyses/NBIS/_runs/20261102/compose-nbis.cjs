'use strict';
// Rédaction du dossier Nebius Group (NBIS) du 2 novembre 2026, sur la clôture certifiée du 30 octobre. Toute valeur de
// marché est recalculée depuis les barres certifiées et les artefacts collectés ; les chiffres d'entreprise viennent des
// dépôts SEC ouverts (static-nbis.cjs) ; les dates de résultats, des communiqués des émetteurs (revision/sources-manifest.json) ;
// la séance du 2 novembre, d'un relevé de séance horodaté et non certifié (supplement/live_quote.json), qui ne fixe aucun niveau.
const fs = require('fs'), path = require('path');
const DATA = path.join(__dirname, '../../_data');
const REV = path.join(__dirname, 'revision');
const readData = f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const readRev = f => JSON.parse(fs.readFileSync(path.join(REV, f), 'utf8'));
// Nombres au format français avec séparateur de milliers (« 8 042,1 ») : le formateur commun n'en met pas.
const frG = (n, d = 1) => { const [i, f] = Math.abs(n).toFixed(d).split('.'); return (n < 0 ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (f ? ',' + f : ''); };

// Obligations convertibles en circulation après les opérations d'août 2026, au principal d'origine (base de conversion) :
// juin 2025 (500 + 500 M$, dont 400 + 400 échangés en août), septembre 2025 (3 162,5 M$, option de 412,5 M$ exercée), mars 2026 (2 587,5 +
// 1 750 M$), août 2026 (3 450 + 2 300 M$). Taux de conversion lus dans le 20-F, les états du 30 juin et le communiqué du
// 20 août 2026 (actions par tranche de 1 000 $).
const CONV = [
  { label: 'juin 2025 (échéances 2029 et 2031)', orig: 200, rate: 19.4363, px: 51.45 },
  { label: 'septembre 2025 (échéances 2030 et 2032)', orig: 3162.5, rate: 7.2072, px: 138.75 },
  { label: 'mars 2026, échéance 2031', orig: 2587.5, rate: 5.4579, px: 183.22 },
  { label: 'mars 2026, échéance 2033', orig: 1750, rate: 5.546, px: 180.31 },
  { label: 'août 2026, échéance 2030', orig: 3450, rate: 3.1902, px: 313.46 },
  { label: 'août 2026, échéance 2034', orig: 2300, rate: 3.0802, px: 324.65 },
];
const ORIG_JUNE = 1000 + 3162.5 + 2587.5 + 1750;
// Montant remboursable à l'échéance après août : 10 041,8 M$ au 30 juin (états financiers) − obligations échangées
// (400 M$ à 117,5 % + 400 M$ à 122,5 %) + obligations d'août (3 450 M$ à 110 % + 2 300 M$ à 125 %).
const REPAY_AFTER = 10041.8 - (400 * 1.175 + 400 * 1.225) + 3450 * 1.10 + 2300 * 1.25;

// Heure de Paris (heure d'hiver depuis le 25 octobre : UTC + 1) d'un instant UTC.
const paris = iso => { const d = new Date(Date.parse(iso) + 3600e3); return d.getUTCHours() + ' h ' + String(d.getUTCMinutes()).padStart(2, '0'); };
const utc = iso => iso.slice(11, 16).replace(':', ' h ') + ' UTC';

function base(c) {
  const { pct, bars, N, close } = c;
  const cmp = c.raw.comparison_bars.data.items[0].results[0].data.concat(readData('comparison_client_bars.json').data.items[0].results[0].data);
  const bar = d => { const b = bars.find(x => x[0] === d); if (!b) throw Error('barre absente ' + d); return b; };
  const chg = d => { const i = bars.findIndex(b => b[0] === d); if (i < 1) throw Error('variation absente ' + d); return pct(bars[i][4], bars[i - 1][4]); };
  const row = sym => { const r = cmp.find(x => x.symbol === sym); if (!r) throw Error('comparable absent ' + sym); return r.bars; };
  const dr = (sym, d) => { const b = row(sym), i = b.findIndex(x => x[0] === d); if (i < 1) throw Error('barre absente ' + sym + ' ' + d); return pct(b[i][4], b[i - 1][4]); };
  const since = (sym, d) => { const b = row(sym), x = b.find(y => y[0] === d); if (!x) throw Error('barre absente ' + sym + ' ' + d); return pct(b.at(-1)[4], x[4]); };
  const lastClose = sym => { const b = row(sym); if (b.at(-1)[0] !== c.REF) throw Error('dernière barre inattendue ' + sym); return b.at(-1)[4]; };
  const win = bars.slice(Math.max(0, N - 251), N + 1);
  let hi = -1, lo = 1e9, hiD, loD;
  for (const b of win) { if (b[2] > hi) { hi = b[2]; hiD = b[0]; } if (b[3] < lo) { lo = b[3]; loD = b[0]; } }
  if (hiD !== '2026-06-22' || loD !== '2026-02-05') throw Error('extrêmes annuels inattendus ' + hiD + ' ' + loD);
  const med = a => { const v = [...a].sort((x, y) => x - y); return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2; };
  const avgVol = (from, n) => { const i = bars.findIndex(b => b[0] === from); return bars.slice(i - n, i).reduce((s, b) => s + b[5], 0) / n; };
  const since6 = pct(close, bar('2026-10-06')[4]);
  return { cmp, bar, chg, dr, since, lastClose, hi, hiD, lo, loD, med, avgVol, since6, fromHi: Math.abs(pct(close, hi)) };
}

// Prochaine publication : jeudi 12 novembre avant l'ouverture, confirmée par le communiqué de Nebius du 30 octobre
// (manifeste des sources) ; le bloc calendrier de l'instrument donne la même date.
function earningsDate(c) {
  const cal = (((c.extra || {}).quote || {}).data || { items: [] }).items.find(x => x.type === 'instrument_calendar');
  if (!cal || !/^2026-11-12/.test(cal.nextEarningsDate || '')) throw Error('date de résultats inattendue ' + (cal && cal.nextEarningsDate));
  return { date: '2026-11-12', source: 'communiqué de Nebius du 30 octobre 2026 (nebius.com, pièce hachée dans revision/sources-manifest.json) ; bloc calendrier de l’instrument concordant (' + cal.nextEarningsDate + ')' };
}

function quotePtr() {
  const q = JSON.parse(fs.readFileSync(path.join(DATA, 'instrument.json'), 'utf8'));
  const i = q.data.items.findIndex(x => x.type === 'instrument_short_interest'); if (i < 0) throw Error('relevé FINRA absent');
  return '/data/items/' + i;
}

// Séance du 2 novembre en cours : cotation et chaîne d'options relevées pendant la séance (supplement/live_quote.json).
function live(c) {
  const LQ = c.extra.live_quote, LO = c.extra.live_options;
  const q = LQ.results[0].data[0], ch = LO.results[0].data[0];
  if (q.symbol !== 'NBIS' || !(q.session && q.session.session_state === 'open')) throw Error('cotation de séance inattendue');
  const k13 = ch.contracts.filter(x => x.expiry === '2026-11-13');
  const strikes = [...new Set(k13.map(x => x.strike))].filter(s => k13.some(x => x.strike === s && x.option_type === 'call') && k13.some(x => x.strike === s && x.option_type === 'put'));
  const atm = strikes.sort((a, b) => Math.abs(a - ch.spot) - Math.abs(b - ch.spot))[0];
  const call = k13.find(x => x.strike === atm && x.option_type === 'call'), put = k13.find(x => x.strike === atm && x.option_type === 'put');
  const near = (type, m) => k13.filter(x => x.option_type === type).sort((a, b) => Math.abs(a.strike - m * ch.spot) - Math.abs(b.strike - m * ch.spot))[0];
  const put90 = near('put', 0.9), call110 = near('call', 1.1);
  const straddle = call.mid + put.mid;
  return { at: LQ.captured_at, qTime: q.timestamp, price: q.price, low: q.low, high: q.high, open: q.open, vol: q.volume,
    chgRef: c.pct(q.price, c.close), chAt: ch.as_of, spot: ch.spot, atm, call, put, straddle, movePct: straddle / ch.spot * 100,
    put90, call110, belowAbandon: q.low < c.abandon };
}

// Endettement comparé des loueurs de calcul : dette et trésorerie du bilan publié par le fournisseur de données
// (facette financials, current-only, vraisemblablement au 30 juin), capitalisation = clôture certifiée du 30 octobre ×
// actions (Nebius : actions de la fiche, bons Nvidia compris ; pairs : actions des statistiques collectées).
function leverage(c) {
  const ctx = readData('comparison_context.json'), fund = readData('fundamentals.json');
  const find = (o, type, sym) => { let r = null; (function w(x) { if (r || !x || typeof x !== 'object') return; if (x.type === type && x.symbol === sym) { r = x; return; } Object.values(x).forEach(w); })(o); if (!r) throw Error(type + ' absent ' + sym); return r; };
  const B = base(c);
  const one = (sym, fin, shares, close) => { const net = fin.totalDebt - fin.totalCash, cap = close * shares; return { sym, debt: fin.totalDebt, cash: fin.totalCash, net, cap, ratio: net / cap }; };
  return {
    NBIS: one('NBIS', find(fund, 'instrument_comprehensive_financial', 'NBIS'), c.shares, c.close),
    CRWV: one('CRWV', find(ctx, 'instrument_comprehensive_financial', 'CRWV'), find(ctx, 'instrument_comprehensive_stats', 'CRWV').sharesOutstanding, B.lastClose('CRWV')),
    IREN: one('IREN', find(ctx, 'instrument_comprehensive_financial', 'IREN'), find(ctx, 'instrument_comprehensive_stats', 'IREN').sharesOutstanding, B.lastClose('IREN')),
  };
}

function derived(c) {
  const { pct, close, prev, bars, N, G$, ev, marketCap, entry, stop, cap, peerStat } = c;
  const B = base(c);
  const E = earningsDate(c);
  const trig = (Math.floor(entry * 100 + 1e-9) + 1) / 100;
  const stopOrd = Math.floor(stop * 100 + 1e-9) / 100;
  const peers = ['CRWV', 'IREN', 'APLD', 'ORCL', 'NVDA'], pv = Object.fromEntries(peers.map(t => [t, peerStat(t, 'enterpriseToRevenue')]));
  const peerMed = B.med(peers.map(t => pv[t])), MB = c.scn.multiple;
  if (Math.abs(peerMed - MB) > 0.06) throw Error('médiane des pairs inattendue ' + peerMed);
  const perShareRev = (m, rev) => (m * rev - G$.debt + G$.cash) / c.shares;
  const convShares = CONV.reduce((s, x) => s + x.orig * x.rate / 1000, 0);
  const itm = CONV.filter(x => x.px < close), itmShares = itm.reduce((s, x) => s + x.orig * x.rate / 1000, 0);
  const origAfter = CONV.reduce((s, x) => s + x.orig, 0);
  let worstGap = 0, worstGapD = ''; for (let i = Math.max(1, N - 251); i <= N; i++) { const g = bars[i][1] / bars[i - 1][4] - 1; if (g < worstGap) { worstGap = g; worstGapD = bars[i][0]; } }
  const gapFill = stopOrd * (1 + worstGap), lossGap = cap - gapFill, size1k = Math.floor(1000 / lossGap);
  const q = (((c.extra || {}).quote || {}).data || { items: [] }).items, fi = q.find(x => x.type === 'instrument_short_interest');
  if (!fi || !fi.shortInterest) throw Error('relevé FINRA absent');
  const tx = (c.tx.transactions || []).filter(x => x.date_transaction >= '2026-08-01');
  const sum = (name, code) => tx.filter(x => x.insider_name === name && x.type_code === code).reduce((s, x) => ({ n: s.n + (x.shares || 0), v: s.v + (x.value_usd || 0) }), { n: 0, v: 0 });
  const ryanS = sum('Ryan Charles E', 'S'), boyntonS = sum('Boynton John Wilson IV', 'S'), grimmeP = sum('Grimme Arne', 'P');
  const grimmeLast = tx.filter(x => x.insider_name === 'Grimme Arne' && x.type_code === 'P').sort((a, b) => b.date_transaction.localeCompare(a.date_transaction))[0];
  if (!grimmeLast || grimmeLast.date_transaction !== '2026-10-29') throw Error('dernier achat Grimme inattendu');
  const c1028 = B.chg('2026-10-28'), c1029 = B.chg('2026-10-29'), c1030 = pct(close, prev), c1027 = B.chg('2026-10-27');
  const hi1028 = B.bar('2026-10-28')[2];
  return { B, E, trig, stopOrd, pv, peerMed, MB, perShareRev, convShares, itm, itmShares, origAfter,
    worstGap, worstGapD, gapFill, lossGap, size1k, fi, siF: fi.shortInterest / c.st.floatShares * 100, finraD: fi.date.slice(0, 10),
    ryanS, boyntonS, grimmeP, grimmeLast, c1027, c1028, c1029, c1030, hi1028, close1028: B.bar('2026-10-28')[4],
    loRef: bars[N][3], hiRef: bars[N][2], volRef: bars[N][5], avgVolRef: B.avgVol(bars[N][0], 20),
    c1014: B.chg('2026-10-14'), c1016: B.chg('2026-10-16'), c1022: B.chg('2026-10-22'), c0819: B.chg('2026-08-19'), c0812: B.chg('2026-08-12'),
    evRev: ev / G$.rev, evLo: ev / 3.0e9, evHi: ev / 3.4e9, evMid: ev / 3.2e9, opMargin: G$.ebit / G$.rev * 100,
    floorMiss: perShareRev(pv.CRWV, 2 * 981.3e6), floorTtm: perShareRev(pv.CRWV, G$.rev), capPost: close * (c.shares + 15.8e6), repayAfter: REPAY_AFTER,
    votesB: 334550530 / (238402543 + 334550530) * 100, h2Lo: 3000 - 981.3, h2Hi: 3400 - 981.3, marketCap,
    LV: live(c), LEV: leverage(c) };
}

module.exports = (c, save) => {
  const { fr, usd, pct, sgn, close, bars, N, tech, G$, entry, stop, tp1, tp2, abandon, cap, raw, dfr, nb } = c;
  const k = derived(c), { B, E, trig, stopOrd, LV, LEV } = k;
  const eDate = 'jeudi 12 novembre', trigTxt = usd(trig), stopTxt = usd(stopOrd), abTxt = usd(abandon);
  const capAt = raw.status.captured_at;
  const out = {
    meta: { lang: 'fr', dir: 'ltr', level: 'intermediate', tags: ['us', 'tech', 'ai', 'ai-chain', 'earnings', 'trade-idea'], grade: 'C', date: '2026-11-02', dateDisplay: '2 novembre 2026', version: 3, status: 'watch', assetType: 'stock', levelsCloseDate: c.REF,
      description: 'Nebius a rendu en deux séances le rebond du 28 octobre. Résultats le 12 novembre avant l’ouverture, date confirmée : rien à acheter avant, puis seulement sur une clôture à ' + trigTxt + ' ou plus ; une clôture sous ' + abTxt + ' abandonne le plan.',
      ogDescription: 'Nebius à ' + usd(close) + ' le 30 octobre (' + sgn(k.c1030, 1) + '), sous ' + abTxt + ' en séance le 2 novembre. Résultats le 12 novembre : rien avant.',
      lastMcpRefresh: capAt, levelsVerifiedAt: capAt,
      statusHistory: [...(c.archive.meta.statusHistory || []), { at: capAt, from: 'watch', to: 'watch', note: 'refonte du 2 novembre sur la clôture certifiée du 30 octobre : plan de surveillance inchangé, déclenchement à partir de la clôture du 12 novembre (résultats avant l’ouverture) sur une clôture à ' + trigTxt + ' ou plus ; seuil d’abandon de ' + abTxt + ' à juger sur la clôture certifiée du 2 novembre', close }] },
    header: { ticker: 'NBIS', name: 'Nebius Group N.V.', exchange: 'NASDAQ', sector: 'Location de calcul pour l’intelligence artificielle (cloud IA)', price: close, changePct: k.c1030,
      badges: [{ text: 'SURVEILLER — RIEN AVANT LE 12 NOVEMBRE', color: 'blue' }, { text: 'Seuil d’abandon testé en séance le 2 novembre', color: 'red' }, { text: 'Financement par convertibles', color: 'amber' }],
      metrics: { marketCap: fr(k.marketCap / 1e9, 1) + ' Md$', volume: fr(k.volRef / 1e6, 2) + ' M', evRevenue: fr(k.evRev, 1) + '×' }, halalStatus: 'unknown' },
    archiveHistory: [
      { date: '2026-10-27', dateDisplay: '27 octobre 2026', grade: 'C', note: 'Analyse NBIS — version précédente' },
      { date: '2026-09-25', dateDisplay: '25 septembre 2026', grade: 'C+', note: 'Analyse NBIS — version précédente' },
      { date: '2026-08-28', dateDisplay: '28 août 2026', note: 'Analyse NBIS — version précédente' },
      { date: '2026-08-27', dateDisplay: '27 août 2026', note: 'Analyse NBIS — version précédente' },
      { date: '2026-03-08', dateDisplay: '8 mars 2026', note: 'Analyse NBIS — version précédente' }],
  };
  const liveLine = 'Cours de séance, non certifié : ' + usd(LV.price) + ' à ' + utc(LV.qTime) + ' (' + paris(LV.qTime) + ' à Paris), ' + sgn(LV.chgRef, 1) + ' sur la clôture du 30 octobre ; plus bas du jour ' + usd(LV.low) + ', plus haut ' + usd(Math.round(LV.high * 100 + 1e-6) / 100) + ', ouverture ' + usd(LV.open) + '.';
  out.verdict = { score: 44, conviction: 'Low', bias: 'Neutral',
    confidence: 'Note C (score additif de 44 sur 100) : la grille crédite une demande signée et une dette nette faible au 30 juin, mais retranche la technique, les convertibles, la dilution ouverte et un calendrier chargé (résultats le 12 novembre, CoreWeave le 10 au soir). Score éditorial non prédictif. Chiffres d’entreprise lus dans les dépôts SEC (20-F et 6-K, US GAAP) ; niveaux arrêtés à la clôture certifiée du 30 octobre.',
    summary: 'Nebius loue de la puissance de calcul pour l’intelligence artificielle : des grappes de processeurs Nvidia, dans ses centres de données d’Europe et des États-Unis, louées à des laboratoires d’IA, à Microsoft et à Meta. Le 28 octobre, le titre a clôturé à ' + usd(k.close1028) + ', au-dessus du déclencheur du plan ; il a tout rendu en deux séances (' + sgn(k.c1029, 1) + ' le 29, ' + sgn(k.c1030, 1) + ' le 30), avec CoreWeave et IREN, au lendemain du 28 octobre, quand Microsoft a dit que des fournisseurs tiers de processeurs graphiques avaient pris du retard (selon CNBC). Ce signal du 28 ne comptait pas : le plan exige une clôture après les résultats, publiés le jeudi 12 novembre avant l’ouverture (date confirmée par la société le 30 octobre). Clôture certifiée du 30 octobre : ' + usd(close) + '. Lundi 2 novembre, le titre est passé sous ' + abTxt + ' en séance ; la règle d’abandon se jugera sur la clôture certifiée.',
    whyBuy: [
      'Une demande signée : 37,5 Md$ de carnet de commandes au 30 juin, dont 36 % à reconnaître d’ici juin 2028 ; Microsoft (environ 17,4 Md$ sur cinq ans, toutes les tranches livrées au 12 août) et Meta (jusqu’à environ 27 Md$ à partir de 2027) sont nommés parmi les clients.',
      'L’un des loueurs les moins endettés : dette nette de ' + fr(LEV.NBIS.net / 1e9, 2) + ' Md$ au bilan du 30 juin (définition du fournisseur de données, locations comprises vraisemblablement), ' + fr(LEV.NBIS.ratio * 100, 0) + ' % de la capitalisation, contre ' + fr(LEV.CRWV.ratio * 100, 0) + ' % pour CoreWeave et ' + fr(LEV.IREN.ratio * 100, 0) + ' % pour IREN ; les 5,75 Md$ de convertibles d’août et la ligne Citi d’octobre viennent après.',
      'Une croissance qui accélère : 582,3 M$ de revenus au deuxième trimestre, +46 % sur le premier ; revenu annualisé de 3,0 Md$ fin juin contre 1,9 Md$ fin mars ; des prépaiements dans 70 % des contrats signés au trimestre, couvrant 50 à 60 % des investissements associés.',
      'Un titre purgé : ' + usd(close) + ', ' + fr(B.fromHi, 0) + ' % sous le plus haut du 22 juin ; ' + fr(k.evMid, 1) + ' fois le milieu de la prévision de revenus 2026, contre ' + fr(k.evRev, 1) + ' fois les revenus des douze derniers mois.'],
    whyAvoid: [
      'Le marché vend les loueurs de calcul ensemble : le 29 octobre, après les propos de Microsoft, Nebius ' + sgn(k.c1029, 1) + ', CoreWeave ' + sgn(B.dr('CRWV', '2026-10-29'), 1) + ' et IREN ' + sgn(B.dr('IREN', '2026-10-29'), 1) + ' quand le Nasdaq 100 (QQQ) cédait ' + fr(Math.abs(B.dr('QQQ', '2026-10-29')), 1) + ' %. Le ' + sgn(k.c1030, 1) + ' du 30 suit surtout le marché : QQQ ' + sgn(B.dr('QQQ', '2026-10-30'), 1) + ', pour un bêta de Nebius au QQQ de ' + fr(c.M.QQQ.beta, 2) + '.',
      'Une dette qui grossit vite : ' + frG(k.origAfter, 1) + ' M$ de principal d’origine en obligations convertibles après août (' + frG(ORIG_JUNE, 1) + ' M$ au 30 juin), 775 M$ de prêt garanti en juillet et une ligne relais de 3,5 Md$ qui échoit le 16 octobre 2027. Le bilan au 30 septembre, publié le 12 novembre, dira la dette nette réelle.',
      'Une dilution ouverte : 12,3 millions d’actions encore disponibles au programme au fil de l’eau fin juin, environ 15,8 millions remises en août contre des obligations, et l’autorisation d’émettre jusqu’à 20 % du capital sans droit préférentiel, votée le 25 août.',
      'Une rentabilité à prouver : perte opérationnelle de ' + frG(-G$.ebit / 1e6, 1) + ' M$ sur douze mois au 30 juin, et une prévision qui exige ' + frG(k.h2Lo, 1) + ' à ' + frG(k.h2Hi, 1) + ' M$ de revenus au second semestre, contre 981,3 M$ au premier.',
      'Un calendrier de livraison sous question : le 28 octobre, Microsoft a dit que des fournisseurs tiers de processeurs graphiques reportaient une partie de ses capacités au premier semestre 2027 ; aucune source ne nomme Nebius, mais le marché l’a lu comme visant les loueurs.'],
    controlChecklist: [
      { label: 'Séance du 2 novembre en cours', status: 'warn', statusLabel: 'Cours de séance, non certifié', evidence: liveLine + ' Straddle ' + usd(LV.atm) + ' de l’échéance du 13 novembre : ' + usd(LV.straddle) + ', soit ±' + fr(LV.movePct, 1) + ' %, relevé à ' + utc(LV.chAt) + ' (' + paris(LV.chAt) + ' à Paris).', action: 'Le seuil d’abandon de ' + abTxt + ' se juge sur la clôture certifiée du 2 novembre, pas sur un cours de séance ; les niveaux du plan seront recalculés sur cette clôture.' },
      { label: 'Historique de cours', status: 'pass', statusLabel: 'Séances certifiées au 30 octobre', evidence: 'Série quotidienne certifiée de ' + bars.length + ' séances, sans trou sur la fenêtre utile ; la clôture du 2 novembre n’était pas certifiée à la publication.', action: 'Niveaux et indicateurs calculés sur cette seule série.' },
      { label: 'Signal du 28 octobre', status: 'fail', statusLabel: 'Invalide, corrigé', evidence: 'Clôture à ' + usd(k.close1028) + ' le 28 octobre, au-dessus de ' + trigTxt + ', mais avant les résultats : le plan exige une clôture postérieure à leur publication. Le suivi automatique l’avait compté ; corrigé le 2 novembre.', action: 'Aucune entrée. Première clôture qui compte : celle du jeudi 12 novembre, à 22 h (Paris).' },
      { label: 'Structure financière', status: 'warn', statusLabel: 'Convertibles et ligne relais', evidence: frG(k.origAfter, 1) + ' M$ de principal d’origine en obligations convertibles après août ; ligne Citi de 3,5 Md$ à un an, garantie sur l’essentiel des actifs des emprunteurs ; montant tiré non publié.', action: 'Lire le 12 novembre la dette nette au 30 septembre et le refinancement de la ligne relais.' }] };
  out.timeline = {
    title: 'Ce qui peut bouger Nebius', from: '2026-11-02', to: '2026-11-18',
    keyWindow: { from: '2026-11-10', to: '2026-11-13', label: 'Fenêtre clé · CoreWeave le 10 au soir, Nebius le 12 avant l’ouverture' },
    events: [
      { date: '2026-11-02', category: 'market', impact: 'strong', label: 'Clôture du 2', detail: 'seuil de 145,80 $', icon: 'bolt', source: 'plan de la fiche ; cours de séance relevé à ' + utc(LV.qTime) + ' (supplement/live_quote.json), non certifié', href: '#verdict' },
      { date: '2026-11-05', category: 'earnings', impact: 'medium', label: 'IREN', detail: 'premier loueur à publier', icon: 'company', uncertain: true, side: 'bottom', source: 'calendrier de résultats sur trente jours collecté le 2 novembre (supplement/calendar30.json, yahoo_quote_summary_calendar_events), une seule source' },
      { date: '2026-11-06', category: 'macro', impact: 'medium', label: 'Emploi US', detail: '14 h 30, taux', icon: 'data', source: 'daily/20261022/_primary/bls_empsit_schedule.htm, calendrier du BLS (8 h 30, heure de New York)' },
      { date: '2026-11-10', category: 'macro', impact: 'strong', label: 'CPI US', detail: 'coût du capital', icon: 'data', side: 'bottom', source: 'data/scheduled-events.json (cpi), calendrier du BLS' },
      { date: '2026-11-10', category: 'earnings', impact: 'strong', label: 'CoreWeave', detail: 'conférence 23 h, après la clôture', icon: 'company', source: 'communiqué de CoreWeave du 27 octobre 2026 (conférence le 10 novembre à 17 h, heure de New York), revision/sources-manifest.json' },
      { date: '2026-11-12', category: 'earnings', impact: 'strong', label: 'Résultats Nebius', detail: 'avant l’ouverture, conférence 14 h', icon: 'company', source: E.source, href: '#earnings' },
      { date: '2026-11-13', category: 'market', impact: 'medium', label: 'Échéance options', detail: 'straddle de séance ±' + fr(LV.movePct, 0) + ' %', icon: 'hourglass', side: 'bottom', source: 'chaîne d’options relevée le 2 novembre à ' + utc(LV.chAt) + ' (supplement/live_options.json), non certifiée' },
      { date: '2026-11-13', category: 'macro', impact: 'medium', label: 'PPI US', icon: 'data', source: 'data/scheduled-events.json (ppi), calendrier du BLS' },
      { date: '2026-11-16', category: 'plan', impact: 'strong', label: 'Fin du plan', detail: 'dernière activation', icon: 'hourglass', side: 'bottom', source: 'plan de la fiche', href: '#trade' },
      { date: '2026-11-17', category: 'earnings', impact: 'strong', label: 'Nvidia', detail: 'conférence 23 h, après la clôture', icon: 'chip', source: 'communiqué de Nvidia du 28 octobre 2026 (conférence le 17 novembre à 17 h, heure de New York), revision/sources-manifest.json' },
    ],
    chains: [
      { title: 'Si Microsoft décale ses livraisons', steps: [{ label: 'Capacités reportées en 2027', category: 'market', icon: 'hourglass', tone: 'down' }, { label: 'Revenus reconnus plus tard', category: 'earnings', icon: 'data', tone: 'down' }, { label: 'Objectif 7–9 Md$ menacé', category: 'earnings', icon: 'company', tone: 'down' }] },
      { title: 'Si les résultats tiennent la prévision', steps: [{ label: 'Revenus du trimestre', category: 'earnings', icon: 'data', tone: 'up' }, { label: 'Dette nette au 30 septembre', category: 'earnings', icon: 'coin' }, { label: 'Nebius', category: 'earnings', icon: 'company', tone: 'up' }] },
    ],
    note: 'Heures de Paris. Rien avant la clôture du 12 novembre ; une clôture certifiée sous ' + abTxt + ' abandonne le plan. « ? » : une seule source. Ligne Citi : échéance le 16 octobre 2027.',
  };
  return save(Object.assign(out, require('./compose-nbis-body.cjs')(c, { ...k, eDate, trigTxt, stopTxt, abTxt, frG, CONV, ORIG_JUNE, paris, utc, liveLine })));
};

module.exports.scenarios = c => {
  const k = derived(c), u = c.usd, f = c.fr;
  return [
    { scenario: 'bullish', trigger: 'Bon trimestre le 12 novembre : revenus sur la trajectoire de la prévision 2026, objectif de 7 à 9 Md$ de revenu annualisé fin 2026 maintenu, calendrier de livraison à Microsoft sans glissement, et un financement à long terme qui remplace la ligne relais de Citi.', firstOrder: 'Le titre clôture à ' + u(k.trig) + ' ou plus, au-dessus du rebond du 21 octobre, puis vise ' + u(c.tp1) + ' et ' + u(c.tp2) + '.', secondOrder: 'CoreWeave et IREN rebondissent avec lui ; les vendeurs à découvert, ' + f(k.siF, 0) + ' % du flottant, rachètent et amplifient le mouvement.', confirmation: 'Une clôture à ' + u(k.trig) + ' ou plus le 12 novembre ou après, sur un volume supérieur à la moyenne.', contradiction: 'Un rebond qui s’efface dans les séances suivantes, comme celui du 28 octobre (' + u(k.close1028) + ', puis ' + u(c.close) + ' deux séances plus tard), ou un rebond de Nebius seul pendant que CoreWeave recule après ses résultats du 10.' },
    { scenario: 'mixed', trigger: 'Trimestre mixte : revenus conformes, prévision 2026 maintenue, mais des capacités nouvelles décalées dans le temps (livraisons à Microsoft reportées vers 2027, revenus reconnus plus tard ; les tranches du contrat de Vineland étaient toutes livrées au 12 août) ou aucun refinancement de la ligne relais.', firstOrder: 'Le titre oscille entre ' + u(c.abandon) + ' et ' + u(k.trig) + ' sans base nette, si le seuil d’abandon n’a pas déjà été franchi en clôture.', secondOrder: 'Les loueurs de calcul restent corrélés entre eux ; Nvidia décroche moins qu’eux.', confirmation: 'Plusieurs clôtures dans cette bande après la publication.', contradiction: 'Une sortie franche de la bande, d’un côté ou de l’autre, sur volume.' },
    { scenario: 'bearish', trigger: 'Révision ou financement dilutif : prévision de revenus 2026 abaissée sous 3,0 Md$ ou objectif de 7 à 9 Md$ de revenu annualisé abandonné (par exemple sur un glissement des livraisons), nouvelle émission d’actions ou de convertibles, ou nouvelle tension sur les obligations de CoreWeave.', firstOrder: 'Clôture sous ' + u(c.abandon) + ', plus bas du 29 juillet : le support suivant est le plus bas du 28 avril, ' + u(c.lv('s3')) + '.', secondOrder: 'Les hébergeurs reconvertis, plus endettés, baissent davantage ; les fournisseurs de serveurs et d’optique suivent avec un temps de retard.', confirmation: 'Une clôture sous ' + u(c.abandon) + ' sur un volume supérieur à la moyenne.', contradiction: 'Un nouveau plus bas en séance sans clôture dessous, suivi d’une reprise rapide.' }];
};

module.exports.contradictions = c => {
  const B = base(c), s = c.sgn, k = derived(c);
  return [
    'Le carnet et la prévision n’ont pas bougé, le cours si : 37,5 Md$ de carnet au 30 juin, prévision réaffirmée le 12 août, et un titre en baisse de ' + c.fr(Math.abs(B.since6), 1) + ' % depuis le 6 octobre.',
    'Le 28 octobre, Nebius clôture à ' + c.usd(k.close1028) + ' (' + s(k.c1028, 1) + ') ; deux séances plus tard il est revenu à ' + c.usd(c.close) + '. Un franchissement du déclencheur avant les résultats ne tient pas : c’est pour cela que le plan l’ignore.',
    'Le 29 octobre, Marvell perd ' + c.fr(Math.abs(B.dr('MRVL', '2026-10-29')), 1) + ' % et Lumentum gagne ' + c.fr(B.dr('LITE', '2026-10-29'), 1) + ' % ; le 2 novembre, l’accord de rachat est annoncé (8-K de Lumentum) à 115 Md$ de valeur d’entreprise pour Lumentum. Le marché paie cher l’amont de l’IA pendant qu’il vend le crédit des loueurs.',
    'Selon la définition du fournisseur de données (bilan du 30 juin), la dette nette de Nebius fait ' + c.fr(k.LEV.NBIS.ratio * 100, 0) + ' % de sa capitalisation, celle de CoreWeave ' + c.fr(k.LEV.CRWV.ratio * 100, 0) + ' % ; le 30 octobre, les deux perdent pourtant ' + c.fr(Math.abs(k.c1030), 1) + ' et ' + c.fr(Math.abs(B.dr('CRWV', '2026-10-30')), 1) + ' %. Le marché ne distingue pas encore les bilans.',
    'Nvidia, fournisseur et actionnaire de Nebius, fait ' + s(B.since('NVDA', '2026-10-06'), 1) + ' depuis le 6 octobre, CoreWeave ' + s(B.since('CRWV', '2026-10-06'), 1) + ' et IREN ' + s(B.since('IREN', '2026-10-06'), 1) + ' : le marché sépare celui qui vend les puces de ceux qui s’endettent pour les acheter.'];
};

module.exports.missingData = c => [
  'Clôture du 2 novembre non certifiée à la publication : la séance n’apparaît qu’en cours de séance horodaté ; la règle d’abandon à 145,80 $ se jugera sur cette clôture.',
  'Résultats du troisième trimestre non publiés (12 novembre) ; bilan au 30 septembre inconnu, donc dette nette après les convertibles d’août et la ligne Citi inconnue.',
  'Calendrier des livraisons à Microsoft non publié par Nebius ; le propos de Microsoft du 28 octobre ne nomme aucun fournisseur.',
  'Montants tirés sur la ligne Citi de 3,5 Md$ et sur le prêt garanti d’environ 775 M$ non publiés ; ventes au fil de l’eau après le 30 juin inconnues.',
  'Consensus du troisième trimestre connu par une seule page de presse financière (MarketBeat, relevée le 2 novembre), sans source de marché interne.',
  'Comptes intermédiaires absents des données XBRL officielles de la SEC (6-K) : agrégats lus dans les états financiers du 6-K du 12 août.',
  'Statistiques et bilans des pairs relevés en instantané, sans historique daté ; couverture officielle des formulaires 4 incomplète.'];

module.exports.quotePtr = quotePtr;
module.exports.derived = derived;
