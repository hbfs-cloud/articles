'use strict';
// Rédaction du dossier Nebius Group (NBIS) du 27 octobre 2026. Toute valeur de marché est recalculée depuis les barres
// certifiées et les artefacts collectés ; les chiffres d'entreprise viennent des dépôts SEC ouverts (static-nbis.cjs) ;
// les causes des séances d'octobre viennent de la presse financière citée.
const fs = require('fs'), path = require('path');
const DATA = path.join(__dirname, '../../_data');
const readData = f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
// Nombres au format français avec séparateur de milliers (« 8 042,1 ») : le formateur commun n'en met pas.
const frG = (n, d = 1) => { const [i, f] = Math.abs(n).toFixed(d).split('.'); return (n < 0 ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (f ? ',' + f : ''); };

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
const REPAY_AFTER = 10041.8 - (400 * 1.175 + 400 * 1.225) + 3450 * 1.10 + 2300 * 1.25; // principal d'origine au 30 juin 2026 (M$)

function base(c) {
  const { pct, bars, N, close } = c;
  const cmp = c.raw.comparison_bars.data.items[0].results[0].data.concat(readData('comparison_client_bars.json').data.items[0].results[0].data);
  const bar = d => { const b = bars.find(x => x[0] === d); if (!b) throw Error('barre absente ' + d); return b; };
  const chg = d => { const i = bars.findIndex(b => b[0] === d); if (i < 1) throw Error('variation absente ' + d); return pct(bars[i][4], bars[i - 1][4]); };
  const row = sym => { const r = cmp.find(x => x.symbol === sym); if (!r) throw Error('comparable absent ' + sym); return r.bars; };
  const dr = (sym, d) => { const b = row(sym), i = b.findIndex(x => x[0] === d); if (i < 1) throw Error('barre absente ' + sym + ' ' + d); return pct(b[i][4], b[i - 1][4]); };
  const since = (sym, d) => { const b = row(sym), x = b.find(y => y[0] === d); if (!x) throw Error('barre absente ' + sym + ' ' + d); return pct(b.at(-1)[4], x[4]); };
  const win = bars.slice(Math.max(0, N - 251), N + 1);
  let hi = -1, lo = 1e9, hiD, loD;
  for (const b of win) { if (b[2] > hi) { hi = b[2]; hiD = b[0]; } if (b[3] < lo) { lo = b[3]; loD = b[0]; } }
  if (hiD !== '2026-06-22' || loD !== '2026-02-05') throw Error('extrêmes annuels inattendus ' + hiD + ' ' + loD);
  const med = a => { const v = [...a].sort((x, y) => x - y); return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2; };
  const avgVol = (from, n) => { const i = bars.findIndex(b => b[0] === from); return bars.slice(i - n, i).reduce((s, b) => s + b[5], 0) / n; };
  const since6 = pct(close, bar('2026-10-06')[4]);
  return { cmp, bar, chg, dr, since, hi, hiD, lo, loD, med, avgVol, since6, fromHi: Math.abs(pct(close, hi)) };
}

// Prochaine publication : bloc calendrier de l'instrument (calendrier Yahoo). Une seule source, la page des événements de
// la société n'en affichait aucun le 27 octobre : la date reste « non confirmée par la société ».
function earningsDate(c) {
  const cal = (((c.extra || {}).quote || {}).data || { items: [] }).items.find(x => x.type === 'instrument_calendar');
  if (cal && /^\d{4}-\d{2}-\d{2}/.test(cal.nextEarningsDate || '')) return { date: cal.nextEarningsDate.slice(0, 10), time: cal.nextEarningsDate.slice(11, 16), source: 'bloc calendrier de l’instrument (' + cal.earningsCalendarSource + ')' };
  return null;
}

function quotePtr() {
  const q = JSON.parse(fs.readFileSync(path.join(DATA, 'instrument.json'), 'utf8'));
  const i = q.data.items.findIndex(x => x.type === 'instrument_short_interest'); if (i < 0) throw Error('relevé FINRA absent');
  return '/data/items/' + i;
}

function derived(c) {
  const { pct, close, prev, bars, N, G$, ev, marketCap, entry, stop, cap, peerStat } = c;
  const B = base(c);
  const E = earningsDate(c);
  if (!E || E.date !== '2026-11-10') throw Error('date de résultats inattendue ' + JSON.stringify(E));
  const trig = (Math.floor(entry * 100 + 1e-9) + 1) / 100;
  const stopOrd = Math.floor(stop * 100 + 1e-9) / 100;
  const peers = ['CRWV', 'IREN', 'APLD', 'ORCL', 'NVDA'], pv = Object.fromEntries(peers.map(t => [t, peerStat(t, 'enterpriseToRevenue')]));
  const peerMed = B.med(peers.map(t => pv[t])), MB = 12.8;
  if (Math.abs(peerMed - MB) > 0.06) throw Error('médiane des pairs inattendue ' + peerMed);
  const perShareRev = (m, rev) => (m * rev - G$.debt + G$.cash) / c.shares;
  const convShares = CONV.reduce((s, x) => s + x.orig * x.rate / 1000, 0);
  const itm = CONV.filter(x => x.px < close), itmShares = itm.reduce((s, x) => s + x.orig * x.rate / 1000, 0);
  const origAfter = CONV.reduce((s, x) => s + x.orig, 0);
  let worstGap = 0, worstGapD = ''; for (let i = Math.max(1, N - 251); i <= N; i++) { const g = bars[i][1] / bars[i - 1][4] - 1; if (g < worstGap) { worstGap = g; worstGapD = bars[i][0]; } }
  const gapFill = stopOrd * (1 + worstGap), lossGap = cap - gapFill, size1k = Math.floor(1000 / lossGap);
  const q = (((c.extra || {}).quote || {}).data || { items: [] }).items, fi = q.find(x => x.type === 'instrument_short_interest');
  if (!fi || !fi.shortInterest) throw Error('relevé FINRA absent');
  // Formulaires 4 relevés depuis le 1er août (couverture officielle partielle) : ventes et achats de marché seulement.
  const tx = (c.tx.transactions || []).filter(x => x.date_transaction >= '2026-08-01');
  const sum = (name, code) => tx.filter(x => x.insider_name === name && x.type_code === code).reduce((s, x) => ({ n: s.n + (x.shares || 0), v: s.v + (x.value_usd || 0) }), { n: 0, v: 0 });
  const ryanS = sum('Ryan Charles E', 'S'), boyntonS = sum('Boynton John Wilson IV', 'S'), grimmeP = sum('Grimme Arne', 'P');
  const grimme26 = tx.find(x => x.insider_name === 'Grimme Arne' && x.type_code === 'P' && x.date_transaction === '2026-10-26');
  if (!grimme26) throw Error('achat du 26 octobre absent');
  return { B, E, trig, stopOrd, pv, peerMed, MB, perShareRev, convShares, itm, itmShares, origAfter,
    worstGap, worstGapD, gapFill, lossGap, size1k, fi, siF: fi.shortInterest / c.st.floatShares * 100, finraD: fi.date.slice(0, 10),
    ryanS, boyntonS, grimmeP, grimme26,
    c26: pct(close, prev), lo26: bars[N][3], hi26: bars[N][2], vol26: bars[N][5], avgVol26: B.avgVol(bars[N][0], 20),
    c1014: B.chg('2026-10-14'), c1016: B.chg('2026-10-16'), c1022: B.chg('2026-10-22'), c0819: B.chg('2026-08-19'), c0812: B.chg('2026-08-12'), c0908: B.chg('2026-09-08'),
    evRev: ev / G$.rev, evLo: ev / 3.0e9, evHi: ev / 3.4e9, evMid: ev / 3.2e9, opMargin: G$.ebit / G$.rev * 100,
    floorCrwv: perShareRev(pv.CRWV, 3.0e9), floorMiss: perShareRev(pv.CRWV, 2 * 981.3e6), floorTtm: perShareRev(pv.CRWV, G$.rev), capPost: close * (c.shares + 15.8e6), repayAfter: REPAY_AFTER, votesB: 334550530 / (238402543 + 334550530) * 100, h2Lo: 3000 - 981.3, h2Hi: 3400 - 981.3, marketCap };
}

module.exports = (c, save) => {
  const { fr, usd, pct, sgn, close, bars, N, tech, G$, entry, stop, tp1, tp2, abandon, cap, raw, dfr, nb } = c;
  const k = derived(c), { B, E, trig, stopOrd } = k;
  const eDate = dfr(E.date), trigTxt = usd(trig), stopTxt = usd(stopOrd), abTxt = usd(abandon);
  const out = {
    meta: { lang: 'fr', dir: 'ltr', level: 'intermediate', tags: ['us', 'tech', 'ai', 'ai-chain', 'earnings', 'trade-idea'], grade: 'C', date: '2026-10-27', dateDisplay: '27 octobre 2026', version: 3, status: 'watch', assetType: 'stock', levelsCloseDate: c.REF,
      description: 'Nebius a perdu ' + fr(Math.abs(B.since6), 0) + ' % depuis le 6 octobre avec CoreWeave et IREN : le marché vend la dette des loueurs de calcul, pas leur carnet. Rien à acheter avant les résultats du 10 novembre (date non confirmée), puis seulement sur une clôture à ' + trigTxt + ' ou plus ; une clôture sous ' + abTxt + ' abandonne le plan.',
      ogDescription: 'Nebius à ' + usd(close) + ' (' + sgn(k.c26, 1) + ', ' + sgn(B.since6, 0) + ' depuis le 6 octobre) : 37,5 Md$ de carnet, 5,75 Md$ de convertibles et une ligne Citi de 3,5 Md$. Pas d’achat avant le 10 novembre.',
      lastMcpRefresh: raw.status.captured_at, levelsVerifiedAt: raw.status.captured_at,
      statusHistory: [...(c.archive.meta.statusHistory || []), { at: raw.status.captured_at, from: c.archive.meta.status || 'expired', to: 'watch', note: 'refonte du 27 octobre sur la clôture du 26 : plan de surveillance, activation après les résultats du troisième trimestre sur une clôture à ' + trigTxt + ' ou plus, aucune entrée', close }] },
    header: { ticker: 'NBIS', name: 'Nebius Group N.V.', exchange: 'NASDAQ', sector: 'Location de calcul pour l’intelligence artificielle (cloud IA)', price: close, changePct: k.c26,
      badges: [{ text: 'SURVEILLER — RIEN AVANT LE 10 NOVEMBRE', color: 'blue' }, { text: 'Crédit des loueurs de calcul sous tension', color: 'red' }, { text: 'Financement par convertibles', color: 'amber' }],
      metrics: { marketCap: fr(k.marketCap / 1e9, 1) + ' Md$', volume: fr(k.vol26 / 1e6, 2) + ' M', evRevenue: fr(k.evRev, 1) + '×' }, halalStatus: 'unknown' },
    archiveHistory: [
      { date: '2026-09-25', dateDisplay: '25 septembre 2026', grade: 'C+', note: 'Analyse NBIS — version précédente' },
      { date: '2026-08-28', dateDisplay: '28 août 2026', note: 'Analyse NBIS — version précédente' },
      { date: '2026-08-27', dateDisplay: '27 août 2026', note: 'Analyse NBIS — version précédente' },
      { date: '2026-03-08', dateDisplay: '8 mars 2026', note: 'Analyse NBIS — version précédente' }],
  };
  out.verdict = { score: 44, conviction: 'Low', bias: 'Neutral',
    confidence: 'Note C (score additif de 44 sur 100) : la grille crédite une demande signée et un financement plus long que celui des pairs, mais retranche la technique, la dette, la dilution ouverte et un calendrier chargé (résultats attendus le ' + eDate + ', date non confirmée). Score éditorial non prédictif. Chiffres d’entreprise lus dans les dépôts SEC (20-F et 6-K, US GAAP) ; niveaux lus sur la clôture certifiée du 26 octobre.',
    summary: 'Nebius loue de la puissance de calcul pour l’intelligence artificielle : des grappes de processeurs Nvidia, dans ses centres de données d’Europe et des États-Unis, louées à des laboratoires d’IA, à Microsoft et à Meta. La demande n’est pas en cause : 582,3 M$ de revenus au deuxième trimestre (+454 % sur un an), un carnet de 37,5 Md$ au 30 juin et une prévision 2026 de 3,0 à 3,4 Md$ de revenus réaffirmée le 12 août. Le marché vend autre chose. Depuis le 6 octobre, le titre a perdu ' + fr(Math.abs(B.since6), 1) + ' %, comme CoreWeave (' + sgn(B.since('CRWV', '2026-10-06'), 1) + ') et IREN (' + sgn(B.since('IREN', '2026-10-06'), 1) + '), quand Nvidia ne cède que ' + fr(Math.abs(B.since('NVDA', '2026-10-06')), 1) + ' % : la peur porte sur la dette des loueurs de calcul, réveillée le 14 octobre par un rendement de 15 % sur une obligation de CoreWeave. Nebius a levé 5,75 Md$ en obligations convertibles en août et signé le 17 octobre une ligne relais de 3,5 Md$ à un an avec Citi. Clôture du 26 octobre à ' + usd(close) + ', sous ses moyennes à vingt, cinquante et deux cents séances. Pas d’achat avant les résultats du troisième trimestre, attendus le ' + eDate + ' selon une seule source.',
    whyBuy: [
      'Une demande signée : 37,5 Md$ de carnet de commandes au 30 juin, dont 36 % à reconnaître d’ici juin 2028 ; Microsoft (environ 17,4 Md$ sur cinq ans, toutes les tranches livrées) et Meta (jusqu’à environ 27 Md$ à partir de 2027) sont nommés parmi les clients.',
      'Une croissance qui accélère : 582,3 M$ de revenus au deuxième trimestre, +46 % sur le premier ; revenu annualisé de 3,0 Md$ fin juin contre 1,9 Md$ fin mars ; marge d’EBITDA ajusté de 50 % dans le cloud IA, selon la définition de la société.',
      'Un financement payé en partie par les clients : 8,0 Md$ de trésorerie au 30 juin, 5,75 Md$ d’obligations convertibles levées en août, et des prépaiements dans 70 % des contrats signés au deuxième trimestre, couvrant 50 à 60 % des investissements associés ; plus de 9 Md$ de prépaiements attendus en 2026.',
      'Un titre déjà purgé : ' + usd(close) + ', ' + fr(B.fromHi, 0) + ' % sous le plus haut du 22 juin ; ' + fr(k.evMid, 1) + ' fois le milieu de la prévision de revenus 2026, contre ' + fr(k.evRev, 1) + ' fois les revenus des douze derniers mois.'],
    whyAvoid: [
      'Le marché traite les loueurs de calcul comme des emprunteurs : Nebius a perdu ' + fr(Math.abs(k.c1014), 1) + ' % le 14 octobre et ' + fr(Math.abs(k.c1016), 1) + ' % le 16, au rythme de CoreWeave et d’IREN. Tant que le crédit du secteur se tend, la qualité du carnet ne protège pas le cours.',
      'Une dette qui grossit vite : ' + frG(k.origAfter, 1) + ' M$ de principal d’origine en obligations convertibles après août (' + frG(ORIG_JUNE, 1) + ' M$ au 30 juin), 775 M$ de prêt garanti en juillet et une ligne relais de 3,5 Md$ qui échoit le 16 octobre 2027. Au cours actuel, les convertibles de mars (conversion à 183,22 et 180,31 $) et d’août (313,46 et 324,65 $) sont des dettes à rembourser, pas des actions à venir.',
      'Une dilution ouverte : 12,3 millions d’actions encore disponibles au programme au fil de l’eau fin juin, environ 15,8 millions remises en août contre des obligations, et l’autorisation d’émettre jusqu’à 20 % du capital sans droit préférentiel, votée le 25 août.',
      'Une rentabilité à prouver : perte opérationnelle de ' + frG(-G$.ebit / 1e6, 1) + ' M$ sur douze mois au 30 juin. Le bénéfice du semestre (430,8 M$) doit tout à 780,6 M$ de réévaluation de participations, et la prévision exige ' + frG(k.h2Lo, 1) + ' à ' + frG(k.h2Hi, 1) + ' M$ de revenus au second semestre, contre 981,3 M$ au premier.',
      'Trois clients non nommés ont fait 59 % des revenus du deuxième trimestre ; les résultats du troisième trimestre tombent le ' + eDate + ' selon une seule source, date non confirmée par la société.'],
    controlChecklist: [
      { label: 'Historique de cours', status: 'pass', statusLabel: 'Séances certifiées au 26 octobre', evidence: 'Série quotidienne certifiée de ' + bars.length + ' séances, sans trou sur la fenêtre utile.', action: 'Niveaux et indicateurs calculés sur cette seule série.' },
      { label: 'Structure financière', status: 'warn', statusLabel: 'Convertibles et ligne relais', evidence: frG(k.origAfter, 1) + ' M$ de principal d’origine en obligations convertibles après août ; ligne Citi de 3,5 Md$ à un an, garantie sur l’essentiel des actifs des emprunteurs ; montant tiré non publié.', action: 'Lire avec les résultats du troisième trimestre la dette tirée et le refinancement de la ligne relais.' },
      { label: 'Point d’entrée', status: 'fail', statusLabel: 'Sous les trois moyennes, résultats à venir', evidence: 'Clôture à ' + usd(close) + ' (' + sgn(k.c26, 1) + '), sous les moyennes à vingt (' + usd(tech.ema20) + '), cinquante (' + usd(tech.ema50) + ') et deux cents séances (' + usd(tech.ema200) + ') ; ' + fr(k.vol26 / 1e6, 1) + ' millions d’actions échangées, ' + fr(k.vol26 / k.avgVol26, 1) + ' fois la moyenne des vingt séances précédentes.', action: 'Aucun achat avant les résultats du ' + eDate + ' ; ensuite seulement sur une clôture à ' + trigTxt + ' ou plus.' }] };
  out.timeline = {
    title: 'Ce qui peut bouger Nebius', from: '2026-10-28', to: '2026-11-17',
    keyWindow: { from: E.date, to: '2026-11-13', label: 'Fenêtre clé · Nebius le 10, CoreWeave le 11, premier achat le 12' },
    events: [
      { date: '2026-10-28', category: 'macro', impact: 'strong', label: 'Fed', detail: '19 h, coût du capital', icon: 'bank', source: 'data/scheduled-events.json (fomc), calendrier de la Réserve fédérale', href: '#macro' },
      { date: '2026-10-28', category: 'earnings', impact: 'medium', label: 'Vertiv', detail: 'commandes de salles', icon: 'company', uncertain: true, side: 'bottom', source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: '2026-11-03', category: 'earnings', impact: 'medium', label: 'Supermicro', detail: 'serveurs', icon: 'company', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: '2026-11-05', category: 'earnings', impact: 'strong', label: 'IREN', detail: 'premier loueur à publier', icon: 'company', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: '2026-11-06', category: 'macro', impact: 'medium', label: 'Emploi US', detail: 'taux', icon: 'data', side: 'bottom', source: 'daily/20261022/primary-reference.json (bls_empsit), calendrier du BLS' },
      { date: E.date, category: 'earnings', impact: 'strong', label: 'Résultats Nebius', detail: 'troisième trimestre', icon: 'company', uncertain: true, source: E.source + ', une seule source, non confirmée par la société', href: '#earnings' },
      { date: '2026-11-11', category: 'earnings', impact: 'strong', label: 'CoreWeave', detail: 'baromètre du crédit', icon: 'company', uncertain: true, side: 'bottom', source: 'analyses/NBIS/_runs/20261027/revision/earnings-calendar-20261027.json (yahoo_quote_summary_calendar_events), une seule source, heure non communiquée' },
      { date: '2026-11-10', category: 'macro', impact: 'strong', label: 'CPI US', detail: 'même jour', icon: 'data', side: 'bottom', source: 'data/scheduled-events.json (cpi), calendrier du BLS' },
      { date: '2026-11-13', category: 'macro', impact: 'medium', label: 'PPI US', icon: 'data', side: 'bottom', source: 'data/scheduled-events.json (ppi), calendrier du BLS' },
      { date: '2026-11-16', category: 'plan', impact: 'strong', label: 'Fin du plan', detail: 'dernière activation', icon: 'hourglass', source: 'plan de la fiche', href: '#trade' },
      { date: '2026-11-17', category: 'earnings', impact: 'strong', label: 'Nvidia', detail: 'pendant la détention', icon: 'chip', uncertain: true, side: 'bottom', source: 'analyses/NBIS/_runs/20261027/revision/earnings-calendar-20261027.json (yahoo_quote_summary_calendar_events), une seule source, heure non communiquée' },
    ],
    chains: [
      { title: 'Si le crédit du secteur se tend encore', steps: [{ label: 'Obligations CoreWeave', category: 'market', icon: 'bolt', tone: 'down' }, { label: 'Coût du capital', category: 'market', icon: 'bank', tone: 'up' }, { label: 'Nebius', category: 'earnings', icon: 'company', tone: 'down' }] },
      { title: 'Si les résultats tiennent la prévision', steps: [{ label: 'Revenus du trimestre', category: 'earnings', icon: 'data', tone: 'up' }, { label: 'Ligne relais refinancée', category: 'earnings', icon: 'coin' }, { label: 'Nebius', category: 'earnings', icon: 'company', tone: 'up' }] },
    ],
    note: 'Rien ne s’achète avant le jeudi 12 novembre, après Nebius et CoreWeave ; une clôture sous ' + abTxt + ' abandonne le plan. « ? » : date d’une seule source.',
  };
  return save(Object.assign(out, require('./compose-nbis-body.cjs')(c, { ...k, eDate, trigTxt, stopTxt, abTxt, frG, CONV, ORIG_JUNE })));
};

module.exports.scenarios = c => {
  const k = derived(c), u = c.usd;
  return [
    { scenario: 'bullish', trigger: 'Les revenus du troisième trimestre se placent sur la trajectoire de la prévision 2026, et la société annonce un financement à long terme qui remplace la ligne relais de Citi.', firstOrder: 'Le titre clôture à ' + u(k.trig) + ' ou plus, au-dessus du rebond du 21 octobre, puis vise ' + u(c.tp1) + ' et ' + u(c.tp2) + '.', secondOrder: 'CoreWeave et IREN rebondissent avec lui ; les vendeurs à découvert, un cinquième du flottant, rachètent et amplifient le mouvement.', confirmation: 'Une clôture à ' + u(k.trig) + ' ou plus après la publication, sur un volume supérieur à la moyenne.', contradiction: 'Un saut à l’ouverture qui s’efface avant la clôture, ou un rebond de Nebius seul pendant que CoreWeave recule.' },
    { scenario: 'mixed', trigger: 'Résultats conformes, prévision maintenue, mais aucun refinancement de la ligne relais et un crédit du secteur toujours tendu.', firstOrder: 'Le titre oscille entre ' + u(c.abandon) + ' et ' + u(k.trig) + ' sans base nette.', secondOrder: 'Les loueurs de calcul restent corrélés entre eux ; Nvidia décroche moins qu’eux.', confirmation: 'Plusieurs clôtures dans cette bande après la publication.', contradiction: 'Une sortie franche de la bande, d’un côté ou de l’autre, sur volume.' },
    { scenario: 'bearish', trigger: 'Prévision 2026 abaissée, nouvelle émission d’actions ou de convertibles mal reçue, ou nouvelle tension sur les obligations de CoreWeave.', firstOrder: 'Clôture sous ' + u(c.abandon) + ', plus bas du 29 juillet : le support suivant est le plus bas du 28 avril, ' + u(c.lv('s3')) + '.', secondOrder: 'Les hébergeurs reconvertis, plus endettés, baissent davantage ; les fournisseurs de serveurs suivent avec un temps de retard.', confirmation: 'Une clôture sous ' + u(c.abandon) + ' sur un volume supérieur à la moyenne.', contradiction: 'Un nouveau plus bas en séance sans clôture dessous, suivi d’une reprise rapide.' }];
};

module.exports.contradictions = c => {
  const B = base(c), s = c.sgn;
  return [
    'Le carnet et la prévision n’ont pas bougé, le cours si : 37,5 Md$ de carnet au 30 juin, prévision réaffirmée le 12 août, et un titre en baisse de ' + c.fr(Math.abs(B.since6), 1) + ' % depuis le 6 octobre. Le marché vend le financement, pas la demande.',
    'Nvidia, fournisseur et actionnaire de Nebius, fait ' + s(B.since('NVDA', '2026-10-06'), 1) + ' sur la même période, CoreWeave ' + s(B.since('CRWV', '2026-10-06'), 1) + ' et IREN ' + s(B.since('IREN', '2026-10-06'), 1) + ' : le marché sépare celui qui vend les puces de ceux qui s’endettent pour les acheter.',
    'Les deux clients nommés divergent : Microsoft fait ' + s(B.since('MSFT', '2026-10-06'), 1) + ' depuis le 6 octobre, Meta ' + s(B.since('META', '2026-10-06'), 1) + ', dont ' + s(B.dr('META', '2026-10-22'), 1) + ' sur la seule séance du 22 octobre.',
    'Le 26 octobre, Nebius perd ' + c.fr(Math.abs(c.pct(c.close, c.prev)), 1) + ' % quand CoreWeave gagne ' + c.fr(B.dr('CRWV', c.REF), 1) + ' % et IREN ' + c.fr(B.dr('IREN', c.REF), 1) + ' % : la première séance où la baisse paraît propre au titre.',
    'Les obligations convertibles de mars (conversion à 183,22 et 180,31 $) et d’août (313,46 et 324,65 $) ont été vendues comme des actions différées ; à ' + c.usd(c.close) + ', elles redeviennent des dettes à rembourser entre 2030 et 2034.'];
};

module.exports.missingData = c => [
  'Résultats du troisième trimestre non publiés ; date du 10 novembre connue par une seule source de calendrier, non confirmée par la société, qu’aucun dépôt revu n’annonce.',
  'Montants tirés sur la ligne Citi de 3,5 Md$ et sur le prêt garanti d’environ 775 M$ non publiés.',
  'Ventes au fil de l’eau après le 30 juin inconnues (12,3 millions d’actions disponibles à cette date) ; nombre exact d’actions remises lors de l’échange d’août publié en valeur approchée (« environ 15,8 millions »).',
  'Comptes intermédiaires absents des données XBRL officielles de la SEC (6-K) : agrégats lus dans les états financiers du 6-K du 12 août.',
  'Chaîne d’options collectée hors séance, sans cotation exploitable : aucun mouvement implicite autour des résultats.',
  'Calendrier de résultats non collecté pour Microsoft et Meta, clients documentés.',
  'Statistiques des pairs relevées en instantané, sans historique daté ; couverture officielle des formulaires 4 incomplète.'];

module.exports.quotePtr = quotePtr;
module.exports.derived = derived;
