'use strict';
// Rédaction du dossier Oracle (ORCL) du 27 octobre 2026 (clôture certifiée du 26). Toute valeur de marché est recalculée
// depuis les barres certifiées et les artefacts collectés ; les chiffres d'entreprise viennent des dépôts SEC ouverts
// (static-orcl.cjs) et des agrégats XBRL ; la journée investisseurs, le plan de financement du 1er février et les nouvelles
// d'octobre viennent du communiqué d'Oracle ou de la presse financière citée.
const fs = require('fs'), path = require('path');

const findObj = (o, pred) => { if (!o || typeof o !== 'object') return null; if (pred(o)) return o; for (const v of Object.values(o)) { const r = findObj(v, pred); if (r) return r; } return null; };

function base(c) {
  const { pct, bars, N, close } = c;
  const cmp = c.raw.comparison_bars.data.items[0].results[0].data;
  const bar = d => { const b = bars.find(x => x[0] === d); if (!b) throw Error('barre absente ' + d); return b; };
  const chg = d => { const i = bars.findIndex(b => b[0] === d); if (i < 1) throw Error('variation absente ' + d); return pct(bars[i][4], bars[i - 1][4]); };
  const gapOf = d => { const i = bars.findIndex(b => b[0] === d); return pct(bars[i][1], bars[i - 1][4]); };
  const dr = (sym, d) => { const row = cmp.find(x => x.symbol === sym); if (!row) throw Error('comparable absent ' + sym); const b = row.bars, i = b.findIndex(x => x[0] === d); if (i < 1) throw Error('barre absente ' + sym + ' ' + d); return pct(b[i][4], b[i - 1][4]); };
  const win = bars.slice(Math.max(0, N - 251), N + 1);
  let hi = -1, lo = 1e9, hiD, loD;
  for (const b of win) { if (b[2] > hi) { hi = b[2]; hiD = b[0]; } if (b[3] < lo) { lo = b[3]; loD = b[0]; } }
  if (loD !== '2026-07-28' || hiD !== '2025-10-24') throw Error('extrêmes annuels inattendus ' + hiD + ' ' + loD);
  const med = a => { const v = [...a].sort((x, y) => x - y); return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2; };
  const avgVol = (from, n) => { const i = bars.findIndex(b => b[0] === from); return bars.slice(i - n, i).reduce((s, b) => s + b[5], 0) / n; };
  // Plus bas de clôture-à-clôture depuis le 29 juillet : la séance du 22 octobre doit être le plus bas en séance depuis.
  const lowSince = d => Math.min(...bars.filter(b => b[0] > d).map(b => b[3]));
  return { cmp, bar, chg, gapOf, dr, hi, hiD, lo, loD, med, avgVol, lowSince, fromHi: Math.abs(pct(close, hi)) };
}

// Prochaine publication : bloc calendrier de l'instrument (une seule source, non confirmée par la société).
function earningsDate(c) {
  const cal = (((c.extra || {}).quote || {}).data || { items: [] }).items.find(x => x.type === 'instrument_calendar');
  if (cal && /^\d{4}-\d{2}-\d{2}/.test(cal.nextEarningsDate || '')) return { date: cal.nextEarningsDate.slice(0, 10), source: 'bloc calendrier de l’instrument (' + cal.earningsCalendarSource + ')' };
  return null;
}

// Multiples des pairs (statistiques collectées, relevé instantané) et marge opérationnelle d'IBM.
function peers(c) {
  const evE = ['META', 'AMZN', 'IBM', 'CRM', 'MSFT', 'GOOGL'];
  const pv = Object.fromEntries(evE.map(t => [t, c.peerStat(t, 'enterpriseToEbitda')]));
  const ibmEvRev = c.peerStat('IBM', 'enterpriseToRevenue');
  if (Math.abs(ibmEvRev - 4.24) > 0.01) throw Error('multiple de revenus d’IBM inattendu ' + ibmEvRev);
  const ctx = JSON.parse(fs.readFileSync(path.join(__dirname, '../../_data/comparison_context.json'), 'utf8'));
  const ibmFin = findObj(ctx, o => o.symbol === 'IBM' && o.type === 'instrument_comprehensive_financial');
  return { evE, pv, ibmEvRev, ibmOpm: ibmFin.operatingMargins * 100, minE: Math.min(...Object.values(pv)), maxE: Math.max(...Object.values(pv)) };
}

module.exports = (c, save) => {
  const { fr, usd, pct, sgn, close, prev, bars, N, tech, st, G$, g, marketCap, ev, scn, lv, entry, stop, tp1, tp2, abandon, cap, raw, dfr, nb, archive } = c;
  const B = base(c), { bar, chg, gapOf, dr, fromHi, avgVol } = B;
  const E = earningsDate(c);
  if (!E || E.date !== '2026-12-14') throw Error('date de résultats inattendue ' + JSON.stringify(E));
  const P = peers(c);
  const trig = (Math.floor(entry * 100 + 1e-9) + 1) / 100, trigTxt = usd(trig);
  const stopOrd = Math.floor(stop * 100 + 1e-9) / 100, stopTxt = usd(stopOrd);
  const abTxt = usd(abandon);
  if (B.lowSince('2026-07-30') !== abandon) throw Error('le plus bas du 22 octobre n’est pas le plus bas depuis le 30 juillet');
  const c26 = pct(close, prev), vol26 = bars[N][5];
  const c1008 = chg('2026-10-08'), c1014 = chg('2026-10-14'), c1022 = chg('2026-10-22'), c1020 = chg('2026-10-20');
  const vol1014 = bar('2026-10-14')[5], avgVol1014 = avgVol('2026-10-14', 20);
  const evEbitda = ev / G$.ebitda, evRev = ev / G$.rev, pe = marketCap / G$.ni, peFwd = close / 8.10;
  const opMargin = G$.ebit / G$.rev * 100, netDebt = G$.debt - G$.cash, lev = netDebt / G$.ebitda;
  const fcf = G$.fcf, fcfYield = fcf / marketCap * 100, rpoYears = 664e9 / G$.rev;
  const close1016y = bar('2025-10-16')[4], sinceID = pct(close, close1016y), c1017y = chg('2025-10-17');
  // Valeurs lues dans les dépôts ouverts (M$) : dividendes versés (10-K exercice 2026 et 10-Q des deux premiers trimestres),
  // prépaiements de clients à composante de financement (communiqué du 10 juin et 10-Q), plus-value Ampere (10-K).
  const divTtm = (5787 + 1565 - 1413) * 1e6, prepTtm = (4592 + 11363) * 1e6, ampereGain = 2.7e9;
  const fcfAfterDiv = fcf - divTtm, fcfExPrep = fcf - prepTtm;
  const rpo12 = 664 * 0.13, leftToRaise = 40 - 20, sharesFor20 = leftToRaise * 1e9 / close;
  const ellisonPledgeValue = 413e6 * close, adminVsClose = pct(139.352, close);
  // Multiple d'EBITDA d'Oracle sur la base du fournisseur, la même que celle des pairs.
  const stP = st.enterpriseToEbitda;
  const progress = Math.max(0, Math.min(100, Math.round((close - abandon) / (trig - abandon) * 100)));
  const prevHist = archive.meta.statusHistory || [];
  const k = { divTtm, prepTtm, ampereGain, fcfAfterDiv, fcfExPrep, rpo12, leftToRaise, sharesFor20, stP, B, E, P, trig, trigTxt, stopOrd, stopTxt, abTxt, c26, vol26, c1008, c1014, c1022, c1020, vol1014, avgVol1014, evEbitda, evRev, pe, peFwd, opMargin, netDebt, lev, fcf, fcfYield, rpoYears, close1016y, sinceID, c1017y, progress, eDate: dfr(E.date) };
  const out = {
    meta: { lang: 'fr', dir: 'ltr', level: 'intermediate', tags: ['us', 'tech', 'software', 'ai', 'trade-idea'], grade: 'C', date: '2026-10-27', dateDisplay: '27 octobre 2026', version: 3, status: 'watch', assetType: 'stock', levelsCloseDate: c.REF,
      description: 'Oracle à ' + usd(close) + ' : un carnet de 664 Md$, mais ' + fr(Math.abs(fcf) / 1e9, 1) + ' Md$ de flux de trésorerie libre négatif sur douze mois et environ ' + leftToRaise + ' Md$ encore à lever d’ici mai 2027. Rien avant la clôture du 28 octobre ; achat seulement sur une clôture à ' + trigTxt + ' ou plus, limité à ' + usd(cap) + '.',
      ogDescription: 'Rien avant la clôture du 28 octobre (21 h à Paris) : achat seulement sur une clôture à ' + trigTxt + ' ou plus, limité à ' + usd(cap) + '. Oracle à ' + usd(close) + ', ' + leftToRaise + ' Md$ encore à lever.',
      lastMcpRefresh: raw.status.captured_at, levelsVerifiedAt: raw.status.captured_at,
      statusHistory: [...prevHist, { at: raw.status.captured_at, from: archive.meta.status || 'watch', to: 'watch', note: 'refonte du 27 octobre au close du 26 : plan du 9 octobre abandonné le 14 (clôture à ' + usd(bar('2026-10-14')[4]) + ' sous le bas du couloir, ' + usd(bar('2026-09-28')[3]) + ') sans avoir été déclenché ; nouveau plan de surveillance après la journée investisseurs du 28 octobre, aucune entrée', close }] },
    archiveHistory: [
      { date: '2026-10-09', dateDisplay: '9 octobre 2026', grade: archive.meta.grade, note: 'Plan de couloir non déclenché, abandonné le 14 octobre' },
      { date: '2026-09-27', dateDisplay: '27 septembre 2026', note: 'Aucune entrée : plan du 23 septembre invalidé' },
      { date: '2026-09-24', dateDisplay: '24 septembre 2026', note: 'Version précédente' },
      { date: '2026-08-28', dateDisplay: '28 août 2026', note: 'Version précédente' }],
    header: { ticker: 'ORCL', name: 'Oracle Corporation', exchange: 'NYSE', sector: 'Logiciels et infrastructure cloud', price: close, changePct: c26,
      badges: [{ text: 'SURVEILLER — RIEN AVANT LE 28 OCTOBRE AU SOIR', color: 'blue' }, { text: 'Flux libre négatif, financement externe', color: 'amber' }, { text: 'Dépendance à OpenAI', color: 'red' }],
      metrics: { marketCap: fr(marketCap / 1e9, 1) + ' Md$', volume: fr(vol26 / 1e6, 2) + ' M', evEbitda: fr(evEbitda, 1) + '×' }, halalStatus: 'unknown' },
  };
  out.verdict = { score: 40, conviction: 'Low', bias: 'Neutral',
    confidence: 'Note C (score additif de 40 sur 100) : la grille crédite une croissance réelle et un carnet de commandes de 664 Md$, mais retranche la technique, le financement, la dilution et un calendrier chargé (journée investisseurs, Fed et résultats des hyperscalers cette semaine). Score éditorial non prédictif. Chiffres d’entreprise lus dans les dépôts SEC et les données XBRL officielles ; niveaux lus sur la clôture certifiée du 26 octobre.',
    summary: 'Oracle loue de la capacité de calcul pour l’IA et la construit à crédit. Le carnet atteint 664 Md$ au 31 août et l’infrastructure cloud a crû de 121 % au trimestre ; mais sur douze mois, le capex (' + fr(G$.capex / 1e9, 1) + ' Md$) dépasse le flux opérationnel (' + fr(G$.ocf / 1e9, 1) + ' Md$) de ' + fr(Math.abs(fcf) / 1e9, 1) + ' Md$, et la société prévoit un capex de l’exercice 2027 supérieur à celui de 2026. Le plan de l’année civile 2026 est réalisé (25 Md$ d’obligations, 5 Md$ de préférentielles, 20 Md$ d’actions) ; sur l’exercice clos le 31 mai 2027, il reste près de ' + leftToRaise + ' Md$ à lever, sans dette nouvelle prévue en 2026. Le marché vend ce financement : ' + sgn(c1014, 1) + ' le 14 octobre sur un chiffre d’inflation, prime de défaut à cinq ans au record de 288 points de base le 15, puis le 22 octobre, plus bas depuis le 30 juillet, à ' + abTxt + '. À ' + usd(close) + ', le titre est ' + fr(fromHi, 0) + ' % sous son plus haut sur un an et sous ses trois moyennes. La journée investisseurs du 28 octobre dira comment Oracle paiera la suite. Rien avant ; achat seulement sur une clôture à ' + trigTxt + ' ou plus, limité à ' + usd(cap) + ', stop ' + stopTxt + '.',
    whyBuy: [
      'La croissance est dans les comptes : 19,3 Md$ de chiffre d’affaires au trimestre clos le 31 août (+30 %), dont 7,4 Md$ d’infrastructure cloud (+121 %), et un carnet contractuel de 664 Md$, dont 13 % (environ ' + fr(rpo12, 0) + ' Md$) doivent devenir du chiffre d’affaires dans les douze mois, plus que les ' + fr(G$.rev / 1e9, 1) + ' Md$ des douze derniers mois.',
      'Sur l’EBITDA, Oracle est le moins cher de ses grands pairs : ' + fr(stP, 1) + ' fois sur la base du fournisseur, contre ' + fr(P.minE, 1) + ' à ' + fr(P.maxE, 1) + ' fois pour Meta, Amazon, IBM, Salesforce, Microsoft et Alphabet ; ' + fr(peFwd, 1) + ' fois le bénéfice ajusté de 8,10 $ visé pour l’exercice. Une décote cohérente avec une note BBB- et un flux libre négatif.',
      'Les clients financent une partie de la construction : la part prépayée ou fournie par les clients du matériel des grands contrats d’IA atteint 75 Md$, ce qui réduit d’autant le capital à lever selon le communiqué du 10 juin. Oracle cite AMD, Meta, Nvidia, OpenAI, TikTok et xAI parmi ses clients (1er février).',
      'Larry Ellison (38,2 % du capital) a annulé le 12 septembre le plan de vente de 50 millions d’actions adopté le 22 juin ; il emprunte en revanche sur ses titres (413 millions nantis, environ ' + fr(ellisonPledgeValue / 1e9, 0) + ' Md$ au cours actuel). Un administrateur a acheté 3,5 M$ d’actions à 139,35 $ le 29 septembre, ' + fr(adminVsClose, 1) + ' % au-dessus du cours actuel.',
      'Une note de TD Cowen du 20 octobre prête à Nvidia, fournisseur et client d’Oracle, un soutien de crédit à certains baux de centres de données, par garantie ou sous-location ; aucune des deux sociétés ne l’a confirmé. Les positions vendeuses ne pèsent que ' + fr(st.sharesShort / st.floatShares * 100, 1) + ' % du flottant selon le fournisseur.'],
    whyAvoid: [
      'Le flux de trésorerie libre est négatif de ' + fr(Math.abs(fcf) / 1e9, 1) + ' Md$ sur douze mois, ' + fr(Math.abs(fcfAfterDiv) / 1e9, 1) + ' Md$ après ' + fr(divTtm / 1e9, 1) + ' Md$ de dividendes ; sans les ' + fr(prepTtm / 1e9, 1) + ' Md$ de prépaiements de clients, assimilables à un financement apporté par les clients, il serait d’environ ' + fr(fcfExPrep / 1e9, 1) + ' Md$. Et le capex de l’exercice 2027 dépassera celui de 2026 selon le 10-Q.',
      'Le plan de l’année civile 2026 est réalisé (25 Md$ d’obligations, 5 Md$ de préférentielles, 20 Md$ d’actions, soit 141 millions de titres). Pour l’exercice 2027, il reste près de ' + leftToRaise + ' Md$ à lever d’ici mai 2027 sur les 40 Md$ prévus, sans dette nouvelle en 2026 selon la société : à ' + usd(close) + ', environ ' + fr(sharesFor20 / 1e6, 0) + ' millions d’actions s’ils étaient levés en actions. Bloomberg rapporte aussi des discussions avec Apollo et Goldman Sachs sur une entité distincte qui achèterait des puces louées à Oracle.',
      '288 Md$ de loyers de centres de données, signés mais pas encore au bilan, démarrent entre la fin de 2026 et 2029, alors que la dette financière atteint déjà ' + fr(G$.debt / 1e9, 1) + ' Md$. La note de crédit est à un cran de la catégorie spéculative (BBB- chez S&P depuis le 9 juillet) et Moody’s a placé la sienne sous perspective négative, selon The Next Web.',
      'Environ la moitié des 638 Md$ de carnet au 31 mai dépendrait d’OpenAI selon S&P, soit près de 319 Md$, plus de six années de ses revenus annualisés (environ 50 Md$ selon le Financial Times). Oracle chute avec les néo-clouds : ' + sgn(c1014, 2) + ' le 14 octobre, quand CoreWeave faisait ' + sgn(dr('CRWV', '2026-10-14'), 2) + '.',
      'Rien n’est réparé sur le graphique : clôture sous les moyennes à vingt (' + usd(tech.ema20) + '), cinquante (' + usd(tech.ema50) + ') et deux cents séances (' + usd(tech.ema200) + '), plus bas depuis le 30 juillet touché le 22 octobre.'],
    controlChecklist: [
      { label: 'Historique de cours', status: 'pass', statusLabel: 'Trois cents séances certifiées', evidence: 'Série quotidienne certifiée au 26 octobre, sans opération sur titres ; échelle cohérente avec la capitalisation et le nombre d’actions de la circulaire.', action: 'Niveaux et indicateurs calculés sur cette seule série.' },
      { label: 'Financement', status: 'warn', statusLabel: 'Près de 20 Md$ encore à lever, flux libre négatif', evidence: 'Plan de l’année civile 2026 réalisé (programme d’actions de 20 Md$ épuisé au premier trimestre, 25 Md$ d’obligations et 5 Md$ de préférentielles en février) ; pour l’exercice 2027, environ 40 Md$ prévus, dont près de ' + leftToRaise + ' Md$ restent à lever, sans dette nouvelle en 2026 (communiqué du 10 juin) ; ' + fr(Math.abs(fcf) / 1e9, 1) + ' Md$ de flux de trésorerie libre négatif sur douze mois. L’étagère automatique n° 333-277990 (émetteur bien connu, sans plafond de montant) reste ouverte : une émission ne demande qu’un supplément de prospectus. Aucun dépôt de financement depuis le 23 juin.', action: 'Relire tout supplément de prospectus ou 8-K de financement avant d’acheter, et les annonces de la journée investisseurs.' },
      { label: 'Point d’entrée', status: 'fail', statusLabel: 'Sous les moyennes, journée investisseurs mercredi', evidence: 'Clôture à ' + usd(close) + ' (' + sgn(c26, 2) + '), sous les moyennes à vingt (' + usd(tech.ema20) + '), cinquante (' + usd(tech.ema50) + ') et deux cents séances (' + usd(tech.ema200) + ') ; RSI à ' + fr(tech.rsi14, 0) + '.', action: 'Aucun achat avant la clôture du mercredi 28 octobre ; ensuite seulement sur une clôture à ' + trigTxt + ' ou plus.' }] };
  out.timeline = {
    title: 'Ce qui peut bouger Oracle', from: '2026-10-27', to: '2026-11-16',
    keyWindow: { from: '2026-10-28', to: '2026-10-30', label: 'Fenêtre clé · mer. 16 h 55 → ven. 21 h' },
    events: [
      { date: '2026-10-28', category: 'earnings', impact: 'strong', label: 'Journée investisseurs', detail: '16 h 55, financement', icon: 'company', source: 'Oracle Investor Relations, communiqué du 23 octobre 2026 ; présentation le 28 à 10 h 55, heure de Chicago', href: '#trade' },
      { date: '2026-10-28', category: 'macro', impact: 'strong', label: 'Fed', detail: '19 h, taux', icon: 'bank', source: 'data/scheduled-events.json (fomc), calendrier de la Réserve fédérale', href: '#macro' },
      { date: '2026-10-28', category: 'earnings', impact: 'strong', label: 'Microsoft', detail: '+ Alphabet, capex', icon: 'chip', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: '2026-10-29', category: 'earnings', impact: 'strong', label: 'Amazon', detail: 'AWS, capex', icon: 'chip', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: '2026-11-03', category: 'earnings', impact: 'medium', label: 'AMD', detail: 'client et fournisseur', icon: 'chip', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: '2026-11-06', category: 'macro', impact: 'medium', label: 'Emploi US', detail: 'taux', icon: 'data', source: 'daily/20261022/primary-reference.json (bls_empsit), calendrier du BLS' },
      { date: '2026-11-10', category: 'macro', impact: 'strong', label: 'CPI US', detail: 'taux, crédit', icon: 'data', source: 'data/scheduled-events.json (cpi), calendrier du BLS' },
      { date: '2026-11-13', category: 'macro', impact: 'medium', label: 'PPI US', icon: 'data', source: 'data/scheduled-events.json (ppi), calendrier du BLS' },
      { date: '2026-11-16', category: 'plan', impact: 'strong', label: 'Fin du plan', detail: 'dernière activation', icon: 'hourglass', source: 'plan de la fiche', href: '#trade' },
    ],
    chains: [
      { title: 'Si le crédit se tend', steps: [{ label: 'Primes de défaut', category: 'macro', icon: 'bank', tone: 'up' }, { label: 'Néo-clouds', category: 'earnings', icon: 'chip', tone: 'down' }, { label: 'Oracle', category: 'earnings', icon: 'company', tone: 'down' }] },
      { title: 'Si le financement rassure', steps: [{ label: 'Solde financé', category: 'earnings', icon: 'company', tone: 'up' }, { label: 'Primes de défaut', category: 'macro', icon: 'bank', tone: 'down' }, { label: 'Oracle', category: 'earnings', icon: 'company', tone: 'up' }] },
    ],
    note: 'Rien ne s’achète avant la clôture du 28 octobre ; sous ' + abTxt + ' en clôture, le plan est abandonné. « ? » : date d’une seule source. Nvidia, mi-novembre : hors frise.',
  };
  return save(Object.assign(out, require('./compose-orcl-body.cjs')(c, k)));
};

module.exports.scenarios = c => {
  const trig = (Math.floor(c.entry * 100 + 1e-9) + 1) / 100, u = c.usd;
  return [
    { scenario: 'bullish', trigger: 'La journée investisseurs chiffre le solde d’environ 20 Md$ sans surprise de montant ni de structure, et les résultats de Microsoft, Alphabet et Amazon ne relancent pas la vente de la chaîne de l’IA comme le 22 octobre.', firstOrder: 'Le titre clôture à ' + u(trig) + ' ou plus, au-dessus du plus haut du 15 octobre, puis vise ' + u(c.tp1) + ' et ' + u(c.tp2) + '.', secondOrder: 'Les néo-clouds rebondissent avec lui et les primes de défaut se détendent : le marché sépare Oracle de CoreWeave.', confirmation: 'Une clôture à ' + u(trig) + ' ou plus avec un volume supérieur à la moyenne des vingt séances.', contradiction: 'Un saut pendant la présentation qui s’efface avant la clôture, comme le 11 septembre au lendemain des résultats.' },
    { scenario: 'mixed', trigger: 'Des objectifs de long terme relevés, mais le solde à lever décrit sans montant ni calendrier.', firstOrder: 'Le titre oscille entre ' + u(c.abandon) + ' et ' + u(trig) + ', sans base nette.', secondOrder: 'Les hyperscalers dictent la direction ; Oracle suit les néo-clouds plutôt que le logiciel.', confirmation: 'Des clôtures dans cette bande pendant plusieurs séances, sur des volumes en baisse.', contradiction: 'Une sortie franche de la bande, d’un côté ou de l’autre, sur un volume élevé.' },
    { scenario: 'bearish', trigger: 'Une levée supérieure au solde annoncé, des titres convertibles ou une structure hors bilan nouvelle, un capex relevé sans financement nommé, ou un hyperscaler qui coupe ses dépenses.', firstOrder: 'Clôture sous ' + u(c.abandon) + ', plus bas depuis le 30 juillet ; le support suivant est le plus bas sur un an, ' + u(c.lv('s2')) + '.', secondOrder: 'Les primes de défaut montent encore et CoreWeave décroche ; les fournisseurs de puces et d’électricité suivent à la baisse.', confirmation: 'Une clôture sous ' + u(c.abandon) + ' sur un volume supérieur à la moyenne.', contradiction: 'Un nouveau plus bas en séance sans clôture dessous, suivi d’une reprise rapide.' }];
};

module.exports.contradictions = c => {
  const b = base(c), u = c.usd;
  const since = t => { const row = b.cmp.find(x => x.symbol === t); return c.pct(row.bars.at(-1)[4], row.bars.find(x => x[0] === '2026-10-13')[4]); };
  return [
    'Les comptes accélèrent pendant que le cours s’effondre : chiffre d’affaires du trimestre clos le 31 août en hausse de 30 % et prévision d’au moins 90 Md$ de revenus pour l’exercice, titre ' + c.fr(Math.abs(c.pct(c.close, b.bar('2026-09-10')[4])), 1) + ' % sous sa clôture du 10 septembre, veille de la réaction aux résultats. Le marché vend le financement, pas la demande.',
    'Oracle est le moins cher de ses grands pairs sur l’EBITDA, mais son flux de trésorerie libre est négatif sur douze mois : les deux mesures racontent deux sociétés différentes, et les 288 Md$ de loyers signés n’apparaissent encore dans aucune des deux.',
    'Oracle suit les néo-clouds plus que le logiciel : depuis la clôture du 13 octobre, veille de l’inflation, Oracle fait ' + c.sgn(c.pct(c.close, b.bar('2026-10-13')[4]), 1) + ', CoreWeave ' + c.sgn(since('CRWV'), 1) + ', Nebius ' + c.sgn(since('NBIS'), 1) + ', mais le panier des logiciels ' + c.sgn(since('IGV'), 1) + ' et IBM ' + c.sgn(since('IBM'), 1) + '.',
    'Le 22 octobre, Meta venait de relever le bas de sa fourchette de capex et la chaîne de l’IA a pourtant reculé : un capex confirmé n’a pas suffi. Oracle a mieux résisté (' + c.sgn(b.chg('2026-10-22'), 2) + ' contre ' + c.sgn(b.dr('META', '2026-10-22'), 2) + ' pour Meta et ' + c.sgn(b.dr('CRWV', '2026-10-22'), 2) + ' pour CoreWeave), tout en touchant ' + u(c.abandon) + ', son plus bas depuis le 30 juillet.'];
};

module.exports.missingData = c => [
  'Part d’OpenAI dans le carnet de 664 Md$ non publiée par la société ; seule l’estimation de S&P (environ la moitié des 638 Md$ au 31 mai), rapportée par The Next Web le 16 juillet, circule.',
  'Forme du solde d’environ 20 Md$ à lever sur l’exercice 2027 (actions d’ici décembre, dette en 2027, convertibles) non précisée par la société.',
  'Capex de l’exercice 2027 : seul le sens est publié (supérieur à celui de 2026, 10-Q) ; environ 70 Md$ nets des prépaiements selon la directrice financière le 10 juin, rapporté par la presse.',
  'Contenu de la journée investisseurs du 28 octobre inconnu à la clôture du 26 : objectifs, capex et financement non annoncés.',
  'Montant et conditions du financement des puces avec Apollo et Goldman Sachs, rapporté par Bloomberg le 8 octobre, sans dépôt de la société.',
  'Soutien de crédit de Nvidia à certains baux d’Oracle : vérifications de TD Cowen, non confirmées par les deux sociétés.',
  'Prime de défaut à cinq ans connue par la presse (GuruFocus, 15 octobre), sans série datée collectée.',
  'Date de publication du deuxième trimestre connue par une seule source, non confirmée par la société.',
  'Statistiques des pairs relevées en instantané, sans historique daté ; multiple de SAP inutilisable (devises mêlées).',
  'Chaîne d’options relevée avant l’ouverture du 27 octobre sans cotations : aucune volatilité implicite autour de la journée investisseurs.'];
