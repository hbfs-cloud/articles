'use strict';
// Rédaction du dossier Iovance Biotherapeutics (IOVA) du 27 octobre 2026, sur la clôture certifiée du 26 octobre.
// Toute valeur de marché est recalculée depuis les barres certifiées et les artefacts collectés ; les chiffres
// d'entreprise viennent des dépôts SEC ouverts et hachés (static-iova.cjs) ; les données cliniques d'octobre viennent
// des communiqués de la société relayés par le flux d'actualités collecté.
const fs = require('fs'), path = require('path');

// Chiffres d'entreprise lus dans les dépôts (milliers de dollars sauf mention) ; chacun est cité avec son dépôt.
const F = {
  q2Rev: 99.313, q2Rev25: 59.952, q1Rev: 71.430, h1Rev: 170.743, fy25Rev: 263.502,      // 10-Q T2 2026 et T1 2026, 10-K (M$)
  q2Amtagvi: 90.721, q2Proleukin: 8.592,                                                // 10-Q T2 2026, note 6 (M$)
  q2OpLoss: 51.905, q2OpLoss25: 113.774, q2NetLoss: 47.315, q2Eps: 0.11,               // communiqué du 6 août (M$, $)
  q1Ocf: 72.074, h1Ocf: 132.915, q1Capex: 6.608, h1Capex: 12.049,                       // XBRL des 10-Q T1 et T2 (M$, sorties)
  cashDec: 296.980, restricted: 6.005,                                                  // communiqué du 6 août, 10-Q (M$)
  atmQ1Sh: 24918834, atmQ1Net: 98.5, atmQ1Px: 4.03, atmQ2Sh: 14000743, atmQ2Net: 49.6, atmQ2Px: 3.61,
  atmSold: 260.349833, atmLeft: 89.650167, atmTotal: 350.0,                              // S-3ASR du 18 juin (M$)
  shJul: 452971432, shJun: 452971016, shDec: 411938061, equiv: 32730876,                  // 10-Q T2 2026, 10-K
  opts: 17566321, optsPx: 14.85, optsEx: 14570654, optsExPx: 17.08, rsu: 12711528,     // 10-Q T2 2026, options et actions gratuites au 30 juin
  shJun25: 341919364, wQ2: 450.189, wQ225: 334.511, raiseH1: 148.081,                   // 10-Q T2 2026 (capitaux propres, financement), communiqué du 6 août (M d'actions, M$)
  authorized: 650000000,                                                                // 10-Q T2 2026
  guideLo: 410, guideHi: 420, guideOldLo: 350, guideOldHi: 370, q2GuideLo: 86, q2GuideHi: 88,
  orr1a: 62.5, cr1a: 29.2, n1a: 24, os1aFollow: 50.9, orrSar: 50, nSar: 8,              // communiqués ESMO des 23 et 26 octobre
};

function base(c) {
  const { pct, bars, N, close } = c;
  const cmp = c.raw.comparison_bars.data.items[0].results[0].data;
  const bar = d => { const b = bars.find(x => x[0] === d); if (!b) throw Error('barre absente ' + d); return b; };
  const chg = d => { const i = bars.findIndex(b => b[0] === d); if (i < 1) throw Error('variation absente ' + d); return pct(bars[i][4], bars[i - 1][4]); };
  const gapOf = d => { const i = bars.findIndex(b => b[0] === d); return (bars[i][1] / bars[i - 1][4] - 1) * 100; };
  const dr = (sym, d) => { const row = cmp.find(x => x.symbol === sym); if (!row) throw Error('comparable absent ' + sym); const b = row.bars, i = b.findIndex(x => x[0] === d); if (i < 1) throw Error('barre absente ' + sym + ' ' + d); return pct(b[i][4], b[i - 1][4]); };
  const win = bars.slice(Math.max(0, N - 251), N + 1);
  let hi = -1, lo = 1e9, hiD, loD;
  for (const b of win) { if (b[2] > hi) { hi = b[2]; hiD = b[0]; } if (b[3] < lo) { lo = b[3]; loD = b[0]; } }
  if (hiD !== '2026-10-21' || loD !== '2025-11-05') throw Error('bornes annuelles inattendues ' + hiD + ' ' + loD);
  const avgVol = (from, n) => { const i = bars.findIndex(b => b[0] === from); return bars.slice(i - n, i).reduce((s, b) => s + b[5], 0) / n; };
  // Plus bas atteint après le 14 août : le plan de repli de l'ancienne fiche (achat vers 5,41 $) ne s'est jamais déclenché.
  const lowSinceAug = Math.min(...bars.filter(b => b[0] > '2026-08-14').map(b => b[3]));
  return { cmp, bar, chg, gapOf, dr, hi, hiD, lo, loD, avgVol, lowSinceAug, fromHi: Math.abs(pct(close, hi)), fromLo: pct(close, lo) };
}

// Prochaine publication : le calendrier collecté donne le 5 novembre (une seule source) et la société l'a confirmé le
// 27 octobre à 11 h UTC par communiqué (conférence le jeudi 5 novembre à 8 h 30, heure de New York), relayé par le
// flux d'actualités collecté. Le 8-K du 29 septembre disait seulement « début novembre 2026 ».
function earningsDate(c) {
  const ev = ((c.raw.earnings_risk || {}).events || []).find(e => e.symbol === 'IOVA');
  const pr = c.extra.quote.data.items.find(x => x.type === 'instrument_news' && /to Report Third Quarter 2026 Financial Results/.test(x.content || '') && /Thursday, November 5, 2026 at 8:30 a\.m\. ET/.test(x.content || ''));
  return ev ? { date: ev.report_date, confirmed: !!pr, source: pr ? 'communiqué de la société du 27 octobre (conférence le 5 novembre à 8 h 30, heure de New York), concordant avec le calendrier collecté' : 'calendrier de résultats collecté', confidence: ev.date_confidence } : null;
}

// Positions vendeuses : série bimensuelle FINRA (24 règlements) et taux d'emprunt, collectés par le plan certifié
// squeeze (analyses/IOVA/_data_squeeze, appel short_evidence exigé).
const shortSeries = c => {
  const res = c.extra.squeeze.data.items[0].results;
  const pts = res.find(r => r.data_type === 'short_interest').data[0].points;
  const at = d => { const p = pts.find(x => x.settlement_date === d); if (!p) throw Error('relevé FINRA absent ' + d); return p; };
  const peak = pts.reduce((m, p) => p.short_interest_shares > m.short_interest_shares ? p : m, pts[0]);
  const ctb = res.find(r => r.data_type === 'ctb').data[0].history, lastCtb = ctb[ctb.length - 1].split(',');
  return { last: pts[pts.length - 1], at, peak, n: pts.length, ctb: { date: lastCtb[0], fee: Number(lastCtb[1]), available: Number(lastCtb[2]) } };
};
// Pires écarts d'ouverture connus, hors de la fenêtre certifiée de 300 séances : requête directe datée du 27 octobre
// (analyses/IOVA/_data_history/bars_2025.json). Chaque écart suit une publication de résultats (8-K 2.02 des 27 février,
// 8 mai et 7 août 2025, inventaire EDGAR).
const oldGaps = () => {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../../_data_history/bars_2025.json'), 'utf8'));
  const b = raw.response.results[0].data[0].bars;
  const g = d => { const i = b.findIndex(x => x[0] === d); if (i < 1) throw Error('séance 2025 absente ' + d); return { date: d, prevClose: b[i - 1][4], open: b[i][1], pct: (b[i][1] / b[i - 1][4] - 1) * 100 }; };
  return { may: g('2025-05-09'), aug: g('2025-08-08'), feb: g('2025-02-28') };
};

module.exports = (c, save) => {
  const { fr, usd, pct, sgn, close, prev, bars, N, tech, st, G$, marketCap, ev, scn, lv, entry, stop, tp1, tp2, abandon, cap, raw, dfr, nb, peerStat } = c;
  const B = base(c), { bar, chg, dr } = B;
  const E = earningsDate(c);
  if (!E || E.date !== '2026-11-05' || !E.confirmed) throw Error('date de résultats inattendue ' + JSON.stringify(E));
  const eDate = dfr(E.date);
  const trig = (Math.floor(entry * 100 + 1e-9) + 1) / 100, trigTxt = usd(trig);
  const stopOrd = Math.floor(stop * 100 + 1e-9) / 100, stopTxt = usd(stopOrd);
  const abTxt = usd(abandon);
  const c26 = pct(close, prev), vol26 = bars[N][5], avgVol26 = B.avgVol(bars[N][0], 20);
  const c0929 = chg('2026-09-29'), c0806 = chg('2026-08-06'), c0507 = chg('2026-05-07'), c0224 = chg('2026-02-24'), c1106 = chg('2025-11-06');
  const vol0929 = bar('2026-09-29')[5], avgVol0929 = B.avgVol('2026-09-29', 20);
  const evRev = ev / G$.rev, guideMid = (F.guideLo + F.guideHi) / 2, evGuide = ev / (guideMid * 1e6);
  const q2Ocf = F.h1Ocf - F.q1Ocf, q2Capex = F.h1Capex - F.q1Capex, q2Fcf = q2Ocf + q2Capex, h1Fcf = F.h1Ocf + F.h1Capex;
  const runwayQ = G$.cash / 1e6 / q2Fcf;
  const h2Lo = F.guideLo - F.h1Rev, h2Hi = F.guideHi - F.h1Rev;
  const atmSh = F.atmQ1Sh + F.atmQ2Sh, atmNet = F.atmQ1Net + F.atmQ2Net, atmPx = (F.atmQ1Sh * F.atmQ1Px + F.atmQ2Sh * F.atmQ2Px) / atmSh;
  const shGrowth = pct(F.shJun, F.shDec), dilutedMax = F.shJun + F.equiv;
  const atmLeftSh = F.atmLeft * 1e6 / close, atmLeftPct = atmLeftSh / F.shJul * 100;
  const peers = ['LEGN', 'IMCR', 'AUTL', 'GILD', 'GMAB', 'BMY'], pv = Object.fromEntries(peers.map(t => [t, peerStat(t, 'enterpriseToRevenue')]));
  const cellMed = [pv.LEGN, pv.IMCR, pv.AUTL].sort((a, b) => a - b)[1];
  const perShareAt = (m, revM) => (m * revM * 1e6 + G$.cash) / c.shares;
  const SI = shortSeries(c), si = SI.last, si0814 = SI.at('2026-08-14'), siPeak = SI.peak;
  const siF = si.short_pct_float, siDrop = pct(si.short_interest_shares, si0814.short_interest_shares);
  const GAPS = oldGaps();
  // Dilution sur des horizons comparables : actions au 30 juin 2025 et 2026 ; nombres moyens et chiffre d'affaires par
  // action au deuxième trimestre.
  const shYoY = pct(F.shJun, F.shJun25), wYoY = pct(F.wQ2, F.wQ225), rpsYoY = pct(F.q2Rev / F.wQ2, F.q2Rev25 / F.wQ225);
  const cashNoRaise = F.cashDec - (G$.cash / 1e6 - F.raiseH1);
  const headroom = F.authorized - dilutedMax;
  const out = {
    meta: { lang: 'fr', dir: 'ltr', level: 'intermediate', tags: ['us', 'healthcare', 'biotech', 'earnings', 'trade-idea'], grade: 'C+', date: '2026-10-27', dateDisplay: '27 octobre 2026', version: 3, status: 'watch', assetType: 'stock', levelsCloseDate: c.REF,
      description: 'Iovance relève sa prévision 2026 à 410–420 M$ et le titre a été multiplié par ' + fr(close / B.lo, 1) + ' depuis son plus bas annuel ; mais 38,9 millions d’actions vendues au premier semestre financent le lancement. Rien à acheter avant les résultats du ' + eDate + ', puis seulement sur une clôture à ' + trigTxt + ' ou plus.',
      ogDescription: 'IOVA à ' + usd(close) + ' : ventes +66 %, mais +' + fr(shYoY, 0) + ' % d’actions en un an. Rien avant les résultats du ' + eDate + ', puis clôture à ' + trigTxt + ' ou plus.',
      lastMcpRefresh: raw.status.captured_at, levelsVerifiedAt: raw.status.captured_at,
      statusHistory: [{ at: raw.status.captured_at, from: 'tp2-hit', to: 'watch', note: 'refonte v3 du 27 octobre sur la clôture du 26 octobre : le plan de juillet avait atteint ses deux objectifs ; le plan de repli du 14 août (achat vers 5,41 $) ne s’est jamais déclenché, le plus bas suivant étant ' + usd(B.lowSinceAug) + ' ; nouveau plan de surveillance, activation après les résultats sur une clôture à ' + trigTxt + ' ou plus, aucune entrée', close }] },
    header: { ticker: 'IOVA', name: 'Iovance Biotherapeutics, Inc.', exchange: 'NASDAQ', sector: 'Biotechnologie, thérapie cellulaire', price: close, changePct: c26,
      badges: [{ text: 'SURVEILLER — RIEN AVANT LES RÉSULTATS', color: 'blue' }, { text: 'Prévision 2026 relevée', color: 'green' }, { text: 'Ventes d’actions au fil de l’eau', color: 'amber' }],
      metrics: { marketCap: fr(marketCap / 1e9, 2) + ' Md$ (actions au 29 juillet)', volume: fr(vol26 / 1e6, 2) + ' M', range52w: usd(B.lo) + ' – ' + usd(B.hi), shortInterest: fr(siF, 1) + ' % du flottant' }, halalStatus: 'unknown' },
  };
  out.verdict = { score: 47, conviction: 'Low', bias: 'Neutral',
    confidence: 'Note C+ (score additif de 47 sur 100) : la grille crédite un lancement qui accélère et une prévision relevée, mais retranche une dilution continue, un multiple de revenus très supérieur aux pairs et une publication de résultats dans la fenêtre. Score éditorial non prédictif. Chiffres d’entreprise lus dans les dépôts SEC et les données XBRL officielles ; niveaux lus sur la clôture certifiée du 26 octobre.',
    summary: 'Iovance vend Amtagvi, la première thérapie par cellules T individualisée, en une seule perfusion, autorisée dans une tumeur solide : le mélanome avancé après échec des traitements de référence. Le lancement accélère. Au deuxième trimestre, ' + fr(F.q2Rev, 1) + ' M$ de chiffre d’affaires (+66 % sur un an), 56 % de marge brute, et le 29 septembre une prévision 2026 relevée à 410–420 M$, ce qui suppose ' + fr(h2Lo / 2, 0) + ' à ' + fr(h2Hi / 2, 0) + ' M$ par trimestre d’ici décembre. Le titre a suivi : ' + usd(close) + ' à la clôture du 26 octobre, ' + fr(close / B.lo, 1) + ' fois son plus bas du 5 novembre 2025 (' + usd(B.lo) + '), et une consolidation entre ' + usd(lv('s2')) + ' et ' + usd(entry) + ' depuis l’annonce. Le revers est au bilan : ' + fr(atmSh / 1e6, 1) + ' millions d’actions vendues au fil de l’eau au premier semestre pour ' + fr(atmNet, 1) + ' M$, sans lesquelles la trésorerie aurait perdu environ ' + fr(cashNoRaise, 0) + ' M$ sur 297 M$ ; en un an, le nombre d’actions a crû de ' + fr(shYoY, 1) + ' %. Résultats du troisième trimestre le ' + eDate + ', date confirmée par la société le 27 octobre : rien avant.',
    whyBuy: [
      'Un lancement qui accélère : ' + fr(F.q2Rev, 1) + ' M$ au deuxième trimestre (+66 % sur un an, +39 % sur le trimestre), dont ' + fr(F.q2Amtagvi, 1) + ' M$ d’Amtagvi ; la société avait annoncé 86 à 88 M$ en mai.',
      'Une prévision relevée de 55 M$ au milieu de la fourchette, à 410–420 M$, avec une « forte visibilité » sur la fin d’année selon la société : ' + fr(h2Lo, 0) + ' à ' + fr(h2Hi, 0) + ' M$ attendus au second semestre, contre ' + fr(F.h1Rev, 1) + ' M$ au premier.',
      'Des pertes qui fondent : perte opérationnelle de ' + fr(F.q2OpLoss, 1) + ' M$ au deuxième trimestre contre ' + fr(F.q2OpLoss25, 1) + ' M$ un an plus tôt, marge brute de 56 % hors amortissements, consommation de trésorerie d’exploitation de ' + fr(q2Ocf, 1) + ' M$ contre ' + fr(F.q1Ocf, 1) + ' M$ au premier trimestre.',
      'Un deuxième marché en vue : dans le cancer du poumon non à petites cellules, les inclusions des cohortes pivots sont presque terminées, une mise à jour du programme est attendue au quatrième trimestre et la demande d’extension est prévue en 2027 ; à l’ESMO, ' + fr(F.orr1a, 1) + ' % de réponses objectives chez ' + F.n1a + ' malades en première ligne du mélanome avec le pembrolizumab.'],
    whyAvoid: [
      'La croissance se paie en actions : ' + sgn(shYoY, 1) + ' d’actions en un an (de ' + fr(F.shJun25 / 1e6, 1) + ' à ' + fr(F.shJun / 1e6, 1) + ' millions entre fin juin 2025 et fin juin 2026), dont ' + fr(atmSh / 1e6, 1) + ' millions vendues au fil de l’eau au premier semestre 2026 à ' + usd(atmPx) + ' en moyenne ; le chiffre d’affaires par action du deuxième trimestre n’a progressé que de ' + fr(rpsYoY, 0) + ' %.',
      'Un prix de lancement réussi : ' + fr(evRev, 1) + ' fois le chiffre d’affaires des douze derniers mois et ' + fr(evGuide, 1) + ' fois la prévision 2026, quand Legend se paie ' + fr(pv.LEGN, 1) + ' fois, Autolus, qui croît plus vite, ' + fr(pv.AUTL, 1) + ' fois et Gilead ' + fr(pv.GILD, 1) + ' fois.',
      'Une autonomie qui dépend de la croissance : ' + fr(G$.cash / 1e6, 1) + ' M$ de trésorerie et placements au 30 juin, soit environ ' + fr(runwayQ, 1) + ' trimestres au rythme de consommation du deuxième trimestre ; la société dit tenir jusqu’au second semestre 2028.',
      'Une publication qui fait des écarts : le jour des quatre derniers résultats, le titre a fait ' + sgn(c1106, 1) + ', ' + sgn(c0224, 1) + ', ' + sgn(c0507, 1) + ' et ' + sgn(c0806, 1) + '.',
      'Une autorisation encore conditionnelle et une direction en transition : l’autorisation accélérée d’Amtagvi dépend de l’essai de confirmation TILVANCE-301 ; le directeur général est par intérim et le directeur médical a changé le 30 septembre.'],
    controlChecklist: [
      { label: 'Historique de cours', status: 'pass', statusLabel: 'Trois cents séances certifiées', evidence: 'Série quotidienne certifiée au 26 octobre, du 18 août 2025 au 26 octobre 2026 ; plus haut et plus bas annuels recalculés sur cette série.', action: 'Niveaux et indicateurs calculés sur cette seule série.' },
      { label: 'Structure financière', status: 'warn', statusLabel: 'Pas de dette, mais des ventes d’actions continues', evidence: 'Aucune dette financière au 30 juin ; ' + fr(G$.cash / 1e6, 1) + ' M$ de trésorerie et placements, maintenus par ' + fr(atmNet, 1) + ' M$ de ventes d’actions au premier semestre ; jusqu’à 89,7 M$ encore vendables au fil de l’eau.', action: 'Lire au 10-Q du troisième trimestre les actions vendues depuis le 30 juin.' },
      { label: 'Point d’entrée', status: 'fail', statusLabel: 'Milieu de consolidation, résultats à venir', evidence: 'Clôture à ' + usd(close) + ' (' + sgn(c26, 1) + '), entre ' + usd(lv('s2')) + ' et ' + usd(entry) + ' ; au-dessus des moyennes à vingt (' + usd(tech.ema20) + '), cinquante (' + usd(tech.ema50) + ') et deux cents séances (' + usd(tech.ema200) + ').', action: 'Aucun achat avant les résultats du troisième trimestre ; ensuite seulement sur une clôture à ' + trigTxt + ' ou plus.' }] };
  out.timeline = {
    title: 'Ce qui peut bouger IOVA', from: '2026-10-27', to: '2026-11-16',
    keyWindow: { from: E.date, to: '2026-11-06', label: 'Fenêtre clé · résultats le 5 avant l’ouverture, clôture décisive le 5 à 22 h' },
    events: [
      { date: '2026-10-28', category: 'macro', impact: 'strong', label: 'Fed', detail: '19 h, biotechs', icon: 'bank', source: 'data/scheduled-events.json (fomc), calendrier de la Réserve fédérale', href: '#macro' },
      { date: '2026-10-29', category: 'earnings', impact: 'medium', label: 'Merck', detail: 'pembrolizumab', icon: 'pill', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: E.date, category: 'earnings', impact: 'strong', label: 'Résultats IOVA', detail: 'T3, prévision', icon: 'company', source: E.source, href: '#earnings' },
      { date: '2026-11-10', category: 'macro', impact: 'strong', label: 'CPI US', detail: 'taux, biotechs', icon: 'data', source: 'data/scheduled-events.json (cpi), calendrier du BLS' },
      { date: '2026-11-16', category: 'plan', impact: 'strong', label: 'Fin du plan', detail: 'dernière activation', icon: 'hourglass', source: 'plan de la fiche', href: '#trade' },
    ],
    chains: [
      { title: 'Si le titre monte', steps: [{ label: 'Cours plus haut', category: 'market', icon: 'bolt', tone: 'up' }, { label: 'Ventes d’actions', category: 'earnings', icon: 'company' }, { label: 'Actions en plus', category: 'earnings', icon: 'alert', tone: 'down' }] },
      { title: 'Si les ventes tiennent', steps: [{ label: 'Amtagvi', category: 'earnings', icon: 'pill', tone: 'up' }, { label: 'Trésorerie', category: 'earnings', icon: 'coin', tone: 'up' }, { label: 'Émissions évitées', category: 'earnings', icon: 'company', tone: 'up' }] },
    ],
    note: 'Rien avant les résultats ; clôture sous ' + abTxt + ' : plan abandonné. Mise à jour du programme poumon au 4e trimestre, sans date : hors frise. « ? » : une seule source.',
  };
  // Versions archivées (analyses/IOVA/archive/<YYYYMMDD>/), de la plus récente à la plus ancienne.
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  out.archiveHistory = ['2026-08-14', '2026-08-06', '2026-07-20', '2026-07-11', '2026-07-01', '2026-06-30', '2026-06-29', '2026-06-26', '2026-06-25', '2026-06-23', '2026-04-10', '2026-03-30', '2026-03-05'].map(d => {
    const [y, m, j] = d.split('-').map(Number);
    if (!fs.existsSync(path.join(__dirname, '../../archive', d.replace(/-/g, ''), 'index.html'))) throw Error('archive absente ' + d);
    return { date: d, dateDisplay: (j === 1 ? '1er' : j) + ' ' + MOIS[m - 1] + ' ' + y, note: d === '2026-08-14' ? 'Contrôle du 14 août (C+), étagère du 18 juin omise à tort' : d === '2026-08-06' ? 'Résultats du deuxième trimestre' : 'Version précédente' };
  });
  return save(Object.assign(out, require('./compose-iova-body.cjs')(c, { F, B, E, eDate, trig, trigTxt, stopOrd, stopTxt, abTxt, c26, vol26, avgVol26, c0929, c0806, c0507, c0224, c1106, vol0929, avgVol0929, evRev, guideMid, evGuide, q2Ocf, q2Capex, q2Fcf, h1Fcf, runwayQ, h2Lo, h2Hi, atmSh, atmNet, atmPx, shGrowth, dilutedMax, atmLeftSh, atmLeftPct, pv, cellMed, perShareAt, si, siF, SI, si0814, siPeak, siDrop, GAPS, shYoY, wYoY, rpsYoY, cashNoRaise, headroom })));
};

module.exports.F = F;

module.exports.scenarios = c => {
  const trig = (Math.floor(c.entry * 100 + 1e-9) + 1) / 100, u = c.usd;
  return [
    { scenario: 'bullish', trigger: 'Le troisième trimestre confirme la nouvelle prévision, autour de 120 M$ de ventes, sans nouvelle émission d’actions annoncée avec les résultats.', firstOrder: 'Le titre clôture à ' + u(trig) + ' ou plus, au-dessus du plus haut annuel du 21 octobre, puis vise ' + u(c.tp1) + ' et ' + u(c.tp2) + '.', secondOrder: 'Les vendeurs à découvert, revenus d’un tiers à un septième du flottant depuis février, n’apportent plus qu’un appoint de rachats : la hausse devra venir d’acheteurs.', confirmation: 'Une clôture à ' + u(trig) + ' ou plus après la publication, sur un volume supérieur à la moyenne.', contradiction: 'Un saut le jour de la publication qui s’efface dès la séance suivante.' },
    { scenario: 'mixed', trigger: 'Ventes conformes à la prévision, mais nouvelles ventes d’actions révélées au 10-Q ou prévision 2027 absente.', firstOrder: 'Le titre reste dans sa bande de ' + u(c.lv('s2')) + ' à ' + u(c.entry) + ', sans sortie franche.', secondOrder: 'Les ventes au fil de l’eau absorbent les hausses et plafonnent le cours.', confirmation: 'Plusieurs clôtures dans cette bande après la publication.', contradiction: 'Une sortie franche de la bande, d’un côté ou de l’autre.' },
    { scenario: 'bearish', trigger: 'Ventes du troisième trimestre sous le rythme implicite de la prévision, ou offre d’actions de grande taille annoncée avec les résultats.', firstOrder: 'Clôture sous ' + u(c.lv('s2')) + ', bas de la consolidation, puis retour vers ' + u(c.abandon) + ', base du saut du 29 septembre.', secondOrder: 'Le panier des biotechnologies ne suit pas : le décrochage est propre au titre et à son financement.', confirmation: 'Une clôture sous ' + u(c.abandon) + ' sur un volume supérieur à la moyenne.', contradiction: 'Un nouveau plus bas en séance sans clôture dessous, suivi d’une reprise rapide.' }];
};

module.exports.contradictions = c => {
  const B = base(c), x = d => B.dr('XBI', d), i = d => B.chg(d);
  return [
    'Les ventes battent la prévision pendant que le nombre d’actions grimpe : +66 % de chiffre d’affaires au deuxième trimestre, mais ' + c.sgn(c.pct(F.wQ2, F.wQ225), 1) + ' d’actions en moyenne sur un an : le chiffre d’affaires par action ne progresse que de ' + c.fr(c.pct(F.q2Rev / F.wQ2, F.q2Rev25 / F.wQ225), 0) + ' %.',
    'Le titre bouge sur ses propres nouvelles : le 29 septembre, IOVA a fait ' + c.sgn(i('2026-09-29'), 1) + ' quand le panier XBI faisait ' + c.sgn(x('2026-09-29'), 1) + ' ; sur la fenêtre, la corrélation avec XBI n’est que de ' + c.fr(c.M.XBI.correlation, 2) + ', et c’est pourtant le comparable le plus corrélé.',
    'Deux bonnes nouvelles cliniques en deux séances n’ont pas fait monter le cours : ' + c.sgn(i('2026-10-23'), 1) + ' le 23 octobre (première ligne du mélanome), mieux que XBI (' + c.sgn(x('2026-10-23'), 1) + '), puis ' + c.sgn(i('2026-10-26'), 1) + ' le 26 (sarcomes) quand XBI faisait ' + c.sgn(x('2026-10-26'), 1) + '. Le marché attend les ventes, pas les essais.',
    'La société promet une autonomie qui s’allonge (deuxième trimestre 2027 annoncé en novembre 2025, second semestre 2028 en août 2026) avec une trésorerie quasi inchangée, autour de 300 M$ : l’écart a été comblé par les ventes d’actions autant que par la baisse des pertes.'];
};

module.exports.missingData = c => [
  'Actions vendues au fil de l’eau depuis le 30 juin inconnues avant le 10-Q du troisième trimestre ; le 10-Q du deuxième trimestre donnait encore jusqu’à 89,7 M$ de capacité.',
  'Heure de diffusion du communiqué de résultats du 5 novembre non précisée ; seule la conférence est datée (8 h 30 à New York).',
  'Aucune prévision 2027 publiée ; mise à jour du programme IOV-LUN-202 (poumon) attendue au quatrième trimestre 2026, contenu et date non précisés.',
  'Chaîne d’options collectée avant l’ouverture, sans cotation exploitable : aucun mouvement implicite publié autour des résultats.',
  'Couverture officielle des formulaires 4 incomplète sur l’année dans les données collectées ; les huit formulaires 4 déposés depuis août, lus un par un, ne portent que des retenues fiscales sur actions gratuites.',
  'Pires écarts d’ouverture connus (2025) lus sur l’historique de cours antérieur à la fenêtre certifiée de 300 séances, par une requête datée du 27 octobre ; effet d’une émission placée par une banque non mesuré, aucune n’ayant eu lieu sur la fenêtre.',
  'Relevé 13F limité à 18 gérants suivis : la concentration du capital n’est pas mesurable.',
  'Multiples des pairs relevés en instantané, sans historique daté ; liens avec les fournisseurs, distributeurs et payeurs génériques, aucun contrat nommé dans les dépôts lus.'];

function base2(c) { return base(c); }
module.exports.base = base2;
