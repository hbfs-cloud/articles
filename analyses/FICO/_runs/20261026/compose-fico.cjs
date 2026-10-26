'use strict';
// Prix au format français avec séparateur de milliers (« 1 118,93 $ ») : le formateur du gabarit commun n'en met pas,
// et FICO cote au-dessus de 1 000 $.
const usdG = (n, d = 2) => { const [i, f] = Math.abs(n).toFixed(d).split('.'); return (n < 0 ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + (f ? ',' + f : '') + ' $'; };
// Rédaction du dossier Fair Isaac (FICO) du 26 octobre 2026. Toute valeur de marché est recalculée depuis les barres
// certifiées et les artefacts collectés ; les chiffres d'entreprise viennent des dépôts SEC ouverts (static-fico.cjs) ;
// les décisions du régulateur et l'annonce de prix du 26 octobre viennent de la presse financière citée.
const fs = require('fs'), path = require('path');
const REVIEW = path.join(__dirname, 'review-panel.json');

function base(c) {
  const { pct, bars, N, close } = c;
  const cmp = c.raw.comparison_bars.data.items[0].results[0].data;
  const bar = d => { const b = bars.find(x => x[0] === d); if (!b) throw Error('barre absente ' + d); return b; };
  const chg = d => { const i = bars.findIndex(b => b[0] === d); if (i < 1) throw Error('variation absente ' + d); return pct(bars[i][4], bars[i - 1][4]); };
  const dr = (sym, d) => { const row = cmp.find(x => x.symbol === sym); if (!row) throw Error('comparable absent ' + sym); const b = row.bars, i = b.findIndex(x => x[0] === d); if (i < 1) throw Error('barre absente ' + sym + ' ' + d); return pct(b[i][4], b[i - 1][4]); };
  const win = bars.slice(Math.max(0, N - 251), N + 1);
  let hi = -1, lo = 1e9, hiD, loD;
  for (const b of win) { if (b[2] > hi) { hi = b[2]; hiD = b[0]; } if (b[3] < lo) { lo = b[3]; loD = b[0]; } }
  if (loD !== '2026-09-30') throw Error('plus bas annuel inattendu ' + loD);
  const med = a => { const v = [...a].sort((x, y) => x - y); return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2; };
  const avgVol = (from, n) => { const i = bars.findIndex(b => b[0] === from); return bars.slice(i - n, i).reduce((s, b) => s + b[5], 0) / n; };
  return { cmp, bar, chg, dr, hi, hiD, lo, loD, med, avgVol, fromHi: Math.abs(pct(close, hi)), fromLo: pct(close, lo) };
}

// Prochaine publication : calendrier de résultats collecté sur quatorze jours, sinon bloc calendrier de l'instrument.
// Une seule source dans les deux cas : la date reste « non confirmée par la société ».
function earningsDate(c) {
  const ev = ((c.raw.earnings_risk || {}).events || []).find(e => e.symbol === 'FICO');
  if (ev) return { date: ev.report_date, source: 'calendrier de résultats collecté' };
  const cal = (((c.extra || {}).quote || {}).data || { items: [] }).items.find(x => x.type === 'instrument_calendar');
  if (cal && /^\d{4}-\d{2}-\d{2}/.test(cal.nextEarningsDate || '')) return { date: cal.nextEarningsDate.slice(0, 10), source: 'bloc calendrier de l’instrument (' + cal.earningsCalendarSource + ')' };
  return null;
}

module.exports = (c, save) => {
  const usd = usdG;
  const { fr, pct, sgn, close, prev, bars, N, tech, st, M, G$, g, marketCap, ev, scn, lv, entry, stop, tp1, tp2, abandon, cap, raw, dfr, nb, peerStat } = c;
  const B = base(c), { bar, chg, fromHi, fromLo, med } = B;
  const E = earningsDate(c);
  if (!E || E.date !== '2026-11-04') throw Error('date de résultats inattendue ' + JSON.stringify(E));
  const trig = (Math.floor(entry * 100 + 1e-9) + 1) / 100, trigTxt = usd(trig);
  const stopOrd = Math.floor(stop * 100 + 1e-9) / 100, stopTxt = usd(stopOrd);
  const abTxt = usd(abandon);
  const c26 = pct(close, prev), lo26 = bars[N][3], hi26 = bars[N][2], vol26 = bars[N][5], avgVol26 = B.avgVol(bars[N][0], 20);
  const c0730 = chg('2026-07-30'), c0904 = chg('2026-09-04'), c0929 = chg('2026-09-29');
  const vol0929 = bar('2026-09-29')[5], avgVol0929 = B.avgVol('2026-09-29', 20);
  const evEbitda = ev / G$.ebitda, pe = marketCap / G$.ni, peGaapFwd = close / 36.86, peAdjFwd = close / 42.43;
  const opMargin = G$.ebit / G$.rev * 100, netDebt = G$.debt - G$.cash, lev = netDebt / G$.ebitda, fcfYield = G$.fcf / marketCap * 100;
  const peers = ['EFX', 'TRU', 'SPGI', 'MCO', 'MSCI', 'VRSK'], pv = Object.fromEntries(peers.map(t => [t, peerStat(t, 'enterpriseToEbitda')]));
  const bureauMed = med([pv.EFX, pv.TRU]), peerMed = med(peers.map(t => pv[t]));
  const perShareAt = m => (m * G$.ebitda - G$.debt + G$.cash) / c.shares;
  const floorBureau = perShareAt(bureauMed), floorPeers = perShareAt(peerMed);
  const eDate = dfr(E.date);
  const progress = Math.max(0, Math.min(100, Math.round((close - abandon) / (trig - abandon) * 100)));
  const out = {
    meta: { lang: 'fr', dir: 'ltr', level: 'intermediate', tags: ['us', 'software', 'financials', 'earnings', 'trade-idea'], grade: 'C', date: '2026-10-26', dateDisplay: '26 octobre 2026', version: 3, status: 'watch', assetType: 'stock', levelsCloseDate: c.REF,
      description: 'FICO gèle le prix de son score immobilier et chute de ' + fr(Math.abs(c26), 0) + ' % : la fin des hausses de prix, après l’arrivée de VantageScore chez Fannie Mae et Freddie Mac. Rien à acheter avant les résultats du 4 novembre, puis seulement sur une clôture à ' + trigTxt + ' ou plus ; une clôture sous ' + abTxt + ' abandonne le plan.',
      ogDescription: 'FICO à ' + usd(close) + ' (' + sgn(c26, 1) + ') : prix du score immobilier gelé à 10 $ le lot de deux, VantageScore à 0,99 $ chez TransUnion. Pas d’achat avant les résultats du 4 novembre.',
      lastMcpRefresh: raw.status.captured_at, levelsVerifiedAt: raw.status.captured_at,
      statusHistory: [{ at: raw.status.captured_at, from: 'none', to: 'watch', note: 'première fiche, sur la clôture du 26 octobre 2026 : plan de surveillance, activation après les résultats du 4 novembre sur une clôture à ' + trigTxt + ' ou plus, aucune entrée', close }] },
    header: { ticker: 'FICO', name: 'Fair Isaac Corporation', exchange: 'NYSE', sector: 'Scores de crédit et logiciels de décision', price: close, changePct: c26,
      badges: [{ text: 'SURVEILLER — RIEN AVANT LE 4 NOVEMBRE', color: 'blue' }, { text: 'Prix du score immobilier gelé', color: 'red' }, { text: 'Rachats d’actions à crédit', color: 'amber' }],
      metrics: { marketCap: fr(marketCap / 1e9, 1) + ' Md$', volume: fr(vol26 / 1e6, 2) + ' M', evEbitda: fr(evEbitda, 1) + '×' }, halalStatus: 'unknown' },
  };
  out.verdict = { score: 42, conviction: 'Low', bias: 'Neutral',
    confidence: 'Note C (score additif de 42 sur 100) : la grille crédite une rentabilité rare et des rachats massifs, mais retranche la technique, l’endettement et un calendrier chargé (régulateur cette semaine, résultats le 4 novembre). Score éditorial non prédictif. Chiffres d’entreprise lus dans les dépôts SEC et les données XBRL officielles ; niveaux lus sur la clôture certifiée du 26 octobre.',
    summary: 'Fair Isaac vend le score FICO, la note de crédit que presque tous les prêteurs américains consultent. Sa croissance récente venait surtout de la hausse du prix du score demandé pour chaque crédit immobilier. Cette source se tarit : le choix du score, annoncé en juillet 2025, est devenu réel le 4 septembre 2026, quand le régulateur du logement a ouvert à VantageScore 4.0 tous les crédits garantis par Fannie Mae et Freddie Mac ; le soir du 28 septembre, il a annoncé une grille de prix unique. Vendredi 23 octobre au soir, FICO a laissé à 10 $ son lot de deux scores immobiliers (environ 5 $ le score, contre environ 0,99 $ pour VantageScore chez TransUnion). Lundi 26, le titre a perdu ' + fr(Math.abs(c26), 1) + ' % à ' + usd(close) + ', après un plus bas à ' + usd(lo26) + ', et le directeur du régulateur a promis « d’autres mesures cette semaine », selon la presse. Les comptes restent solides, avec ' + fr(opMargin, 0) + ' % de marge opérationnelle sur douze mois, mais la société a emprunté pour racheter ses actions plus cher qu’aujourd’hui. Plancher technique : ' + usd(abandon) + ', le plus bas du 30 septembre. Pas d’achat avant les résultats du ' + eDate + ' (une seule source, date non confirmée par la société).',
    whyBuy: [
      'Une rentabilité rare : ' + fr(G$.rev / 1e9, 2) + ' Md$ de chiffre d’affaires et ' + fr(G$.ebit / 1e9, 2) + ' Md$ de résultat opérationnel sur douze mois glissants, soit ' + fr(opMargin, 0) + ' % de marge ; 370,3 M$ de flux de trésorerie libre au seul troisième trimestre.',
      'Hors immobilier, le régulateur du logement n’a pas compétence : les cartes, le crédit automobile et le crédit à la consommation restent des marchés où le score FICO est la référence des prêteurs, même si les bureaux peuvent y pousser VantageScore.',
      'Une société qui rachète ses actions : 3,1 Md$ dépensés en neuf mois, ' + nb(21597635) + ' actions en circulation le 17 juillet contre 23,8 millions au 30 septembre 2025 (−9 %), et 500,0 M$ de capacité de rachat nouvelle au 30 juin, en plus des 300,0 M$ déjà versés au rachat accéléré.',
      'Le cours a déjà beaucoup cédé : ' + fr(fromHi, 0) + ' % sous le plus haut sur un an, ' + fr(peAdjFwd, 1) + ' fois le bénéfice ajusté par action visé pour l’exercice clos le 30 septembre (42,43 $), ' + fr(evEbitda, 1) + ' fois l’EBITDA des douze derniers mois.'],
    whyAvoid: [
      'La hausse des prix s’arrête : le 23 octobre au soir, la société a laissé à 10 $ son lot de deux scores immobiliers, stable sur un an, pour les prêteurs qui tirent un score FICO sur chaque dossier, sans leur interdire VantageScore ; selon la presse, il s’agit d’éviter qu’ils ne basculent. TransUnion facture VantageScore environ 0,99 $. Au troisième trimestre, les scores aux entreprises avaient progressé de 49 % « surtout grâce au prix unitaire des scores de crédit immobilier ».',
      'Le régulateur n’a pas fini : VantageScore est accepté par Fannie Mae et Freddie Mac depuis le 4 septembre, une grille de prix unique a été annoncée le soir du 28 septembre, et son directeur promet « d’autres mesures cette semaine », selon la presse.',
      'Les distributeurs sont aussi les concurrents : Experian, TransUnion et Equifax, propriétaires de VantageScore, ont pesé 63 % du chiffre d’affaires du trimestre clos le 30 juin.',
      'Une société qui vit à crédit : ' + fr(G$.debt / 1e9, 2) + ' Md$ de dette au 30 juin (3,1 Md$ neuf mois plus tôt), des capitaux propres négatifs de ' + fr(Math.abs(g.equity.value) / 1e9, 1) + ' Md$, et des actions rachetées 1 148,84 $ en moyenne au trimestre clos le 30 juin, avec de l’argent emprunté.',
      'Les résultats annuels tombent le ' + eDate + ' (une seule source) avec la première prévision de l’exercice 2027, la première qui chiffrera le prix gelé et la concurrence ; une restructuration supprime 15 % des postes.'],
    controlChecklist: [
      { label: 'Historique de cours', status: 'pass', statusLabel: 'Trois cents séances certifiées', evidence: 'Série quotidienne certifiée au 26 octobre ; la séance du 24 juillet, absente du magasin du serveur, a été rechargée avant la collecte.', action: 'Niveaux et indicateurs calculés sur cette seule série.' },
      { label: 'Structure financière', status: 'warn', statusLabel: fr(G$.debt / 1e9, 1) + ' Md$ de dette, capitaux propres négatifs', evidence: 'Dette totale de ' + fr(G$.debt / 1e9, 2) + ' Md$ au 30 juin, dont 1,0 Md$ d’obligations à 6,250 % émises en mars et un prêt de 1,5 Md$ tiré en juin pour racheter des actions ; dette nette égale à ' + fr(lev, 1) + ' fois l’EBITDA des douze derniers mois.', action: 'Lire au 10-K la dette au 30 septembre et le solde du rachat accéléré.' },
      { label: 'Point d’entrée', status: 'fail', statusLabel: 'Chute du jour, régulateur et résultats à venir', evidence: 'Clôture à ' + usd(close) + ' (' + sgn(c26, 1) + '), sous les moyennes à vingt (' + usd(tech.ema20) + '), cinquante (' + usd(tech.ema50) + ') et deux cents séances (' + usd(tech.ema200) + ') ; ' + fr(vol26 / 1e6, 2) + ' millions d’actions échangées, ' + fr(vol26 / avgVol26, 1) + ' fois la moyenne des vingt séances précédentes.', action: 'Aucun achat avant les résultats du ' + eDate + ' ; ensuite seulement sur une clôture à ' + trigTxt + ' ou plus.' }] };
  out.timeline = {
    title: 'Ce qui peut bouger FICO', from: '2026-10-27', to: '2026-11-16',
    keyWindow: { from: E.date, to: '2026-11-05', label: 'Fenêtre clé · résultats après 22 h, clôture du 5 à 22 h' },
    events: [
      { date: '2026-10-27', category: 'earnings', impact: 'medium', label: 'TransUnion', detail: 'VantageScore', icon: 'company', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: '2026-10-28', category: 'macro', impact: 'strong', label: 'Fed', detail: '19 h, taux immobiliers', icon: 'bank', source: 'data/scheduled-events.json (fomc), calendrier de la Réserve fédérale', href: '#macro' },
      { date: '2026-10-29', category: 'earnings', impact: 'medium', label: 'Rocket', detail: 'choix du score', icon: 'company', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: E.date, category: 'earnings', impact: 'strong', label: 'Résultats FICO', detail: 'prévision 2027', icon: 'company', uncertain: true, source: E.source + ', une seule source, non confirmée par la société', href: '#earnings' },
      { date: '2026-11-06', category: 'macro', impact: 'medium', label: 'Emploi US', detail: 'taux', icon: 'data', source: 'daily/20261022/primary-reference.json (bls_empsit), calendrier du BLS' },
      { date: '2026-11-10', category: 'macro', impact: 'strong', label: 'CPI US', detail: 'taux immobiliers', icon: 'data', source: 'data/scheduled-events.json (cpi), calendrier du BLS' },
      { date: '2026-11-13', category: 'macro', impact: 'medium', label: 'PPI US', icon: 'data', source: 'data/scheduled-events.json (ppi), calendrier du BLS' },
      { date: '2026-11-16', category: 'plan', impact: 'strong', label: 'Fin du plan', detail: 'dernière activation', icon: 'hourglass', source: 'plan de la fiche', href: '#trade' },
    ],
    chains: [
      { title: 'Si les prêteurs basculent', steps: [{ label: 'VantageScore 0,99 $', category: 'geo', icon: 'gavel' }, { label: 'Prêteurs', category: 'earnings', icon: 'company' }, { label: 'Prix FICO', category: 'earnings', icon: 'data', tone: 'down' }] },
      { title: 'Si les taux baissent', steps: [{ label: 'Taux longs', icon: 'bank', tone: 'down' }, { label: 'Crédits immobiliers', category: 'earnings', icon: 'company', tone: 'up' }, { label: 'Scores vendus', category: 'earnings', icon: 'data', tone: 'up' }] },
    ],
    note: 'Rien ne s’achète avant le 4 novembre ; une clôture sous ' + abTxt + ' abandonne le plan. Mesures du régulateur sans date : hors frise. « ? » : date d’une seule source.',
  };
  return save(Object.assign(out, require('./compose-fico-body.cjs')(c, { B, E, trig, trigTxt, stopOrd, stopTxt, abTxt, c26, lo26, hi26, vol26, avgVol26, c0730, c0904, c0929, vol0929, avgVol0929, evEbitda, pe, peGaapFwd, peAdjFwd, opMargin, netDebt, lev, fcfYield, pv, bureauMed, peerMed, floorBureau, floorPeers, eDate, progress })));
};

module.exports.scenarios = c => {
  const trig = (Math.floor(c.entry * 100 + 1e-9) + 1) / 100;
  return [
    { scenario: 'bullish', trigger: 'Le régulateur n’annonce rien de plus dur que la grille unique, et les résultats du 4 novembre montrent des volumes de scores immobiliers qui tiennent au prix de 10 $.', firstOrder: 'Le titre clôture à ' + usdG(trig) + ' ou plus, au-dessus du plus haut du 26 octobre, puis vise ' + usdG(c.tp1) + ' et ' + usdG(c.tp2) + '.', secondOrder: 'Les vendeurs à découvert, environ un dixième du flottant, rachètent et amplifient le mouvement.', confirmation: 'Une clôture à ' + usdG(trig) + ' ou plus après la publication, avec un volume supérieur à la moyenne.', contradiction: 'Un saut le soir de la publication qui s’efface dès la première séance complète.' },
    { scenario: 'mixed', trigger: 'Résultats conformes, prévision 2027 prudente ; le régulateur publie des mesures déjà attendues.', firstOrder: 'Le titre oscille entre ' + usdG(c.abandon) + ' et ' + usdG(trig) + ', sans base nette.', secondOrder: 'Les rachats d’actions soutiennent le cours sans le relancer.', confirmation: 'Des clôtures dans cette bande pendant plusieurs séances.', contradiction: 'Une sortie franche de la bande, d’un côté ou de l’autre.' },
    { scenario: 'bearish', trigger: 'Le régulateur durcit encore la concurrence, ou la prévision 2027 annonce une baisse des revenus du crédit immobilier.', firstOrder: 'Clôture sous ' + usdG(c.abandon) + ', plus bas sur un an : plus aucun support connu au-dessous.', secondOrder: 'Equifax et TransUnion baissent le jour de la nouvelle puis se reprennent, comme en septembre et en octobre : le marché les traite en gagnants sur le mois.', confirmation: 'Une clôture sous ' + usdG(c.abandon) + ' sur un volume supérieur à la moyenne.', contradiction: 'Un nouveau plus bas en séance sans clôture dessous, suivi d’une reprise rapide.' }];
};

module.exports.contradictions = c => [
  'Les comptes battent des records pendant que le cours s’effondre : chiffre d’affaires du troisième trimestre en hausse de 26 % et prévision relevée, titre ' + c.fr(Math.abs(c.pct(c.close, c.bars.find(b => b[0] === '2026-07-29')[4])), 0) + ' % sous sa clôture du 29 juillet. Le marché vend le prix futur du score, pas les résultats passés.',
  'Deux nouvelles en trois jours : le prix maintenu, annoncé vendredi soir, puis la promesse du régulateur lundi ; la séance du 26 octobre (' + c.sgn(c.pct(c.close, c.prev), 1) + ') ne permet pas de séparer leurs effets.',
  (() => { const b = B2(c), since = t => c.pct(b.cmp.find(x => x.symbol === t).bars.at(-1)[4], b.cmp.find(x => x.symbol === t).bars.find(x => x[0] === '2026-09-03')[4]); return 'Les bureaux de crédit, premiers clients de FICO (63 % du chiffre d’affaires du trimestre) et propriétaires de son concurrent, baissent le jour de chaque décision (Equifax ' + c.sgn(b.dr('EFX', '2026-09-04'), 1) + ' le 4 septembre, ' + c.sgn(b.dr('EFX', '2026-09-29'), 1) + ' le 29), mais beaucoup moins que FICO, et se reprennent : depuis le 3 septembre, Equifax fait ' + c.sgn(since('EFX'), 1) + ', TransUnion ' + c.sgn(since('TRU'), 1) + ' et FICO ' + c.sgn(c.pct(c.close, c.bars.find(x => x[0] === '2026-09-03')[4]), 1) + ' ; en vingt et une séances, Equifax ' + c.sgn(c.M.EFX.return21d, 1) + ' et TransUnion ' + c.sgn(c.M.TRU.return21d, 1) + '. Les émetteurs de cartes n’ont pas bougé : le marché sanctionne FICO, pas tout le crédit aux particuliers.'; })(),
  'La société a racheté ses actions à 1 148,84 $ en moyenne au trimestre clos le 30 juin, avec de l’argent emprunté ; le titre vaut aujourd’hui ' + usdG(c.close) + '.'];

function B2(c) { return base(c); }

module.exports.missingData = c => [
  'Part du crédit immobilier dans le chiffre d’affaires non publiée trimestre par trimestre dans les pièces ouvertes ; seuls les scores aux entreprises (400,0 M$ au troisième trimestre) le sont.',
  'Effet du prix gelé et de la grille unique sur les volumes de FICO non chiffré par la société avant ses résultats annuels.',
  'Contenu et date des « autres mesures » annoncées par le régulateur pour la semaine du 26 octobre inconnus.',
  'Notation de crédit de FICO et définition de l’EBITDA du contrat de crédit non lues dans les pièces ouvertes.',
  'Date de publication des résultats annuels connue par une seule source, non confirmée par la société.',
  'Annonce de prix du 26 octobre, décisions du régulateur et choix de Rocket connus par la presse financière citée, sans dépôt de la société.',
  'Nombre final d’actions du rachat accéléré, dénoué au plus tard le 30 septembre, connu seulement avec le 10-K.',
  'Statistiques des pairs relevées en instantané, sans historique daté.'];

module.exports.loadReview = () => (fs.existsSync(REVIEW) ? JSON.parse(fs.readFileSync(REVIEW, 'utf8')) : null);
