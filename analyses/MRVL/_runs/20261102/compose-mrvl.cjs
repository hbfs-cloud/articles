'use strict';
// Rédaction du dossier Marvell Technology (MRVL) du 2 novembre 2026. Valeurs de marché recalculées depuis les barres
// certifiées (clôture du 30 octobre) ; chiffres d'entreprise et termes du rachat de Lumentum lus dans les dépôts SEC
// ouverts (static-mrvl.cjs) ; séance du 2 novembre lue sur un relevé de cotations horodaté, non certifié, cantonné à la
// section « Séance du 2 novembre en cours », au verdict et au tribunal.
const fs = require('fs'), path = require('path');
const DATA = path.join(__dirname, '../../_data');
const frG = (n, d = 1) => { const [i, f] = Math.abs(n).toFixed(d).split('.'); return (n < 0 ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (f ? ',' + f : ''); };
const RATIO = 4.5;
// Termes et comptes lus dans les dépôts (M$ sauf mention) : actions diluées de Lumentum au premier trimestre (101,7 M,
// EX-99.1 du 2 novembre), actions diluées de Marvell au deuxième trimestre (921,2 M, 10-Q), actions ordinaires au
// 21 août (876,9 M), plafond autorisé (1,3 Md), prévision du troisième trimestre (3 150 M$, marge brute ajustée 58 %
// au milieu, charges ajustées 655 M$), premier trimestre de Lumentum (1 262,6 M$, marge opérationnelle ajustée 42,3 %).
const T = { liteDil: 101.7, mrvlDil: 921.2, mrvlCommon: 876.9, authorized: 1300, q3Rev: 3150, q3Gm: 0.58, q3Opex: 655, liteRev: 1262.6, liteOpm: 0.423,
  liteGuideLo: 1575, liteGuideHi: 1625, ev: 115000, perShare: 1132, premium: 23.9, synergies: 1000, feeMrvl: 5.8, feeLite: 2.9, feeReg: 3.2,
  liteCash: 1272.2 + 707.4, liteDebt: 1360.3 + 39.3, google: 58970907, nvdaPref: 21778000, celestial: 24.4e6, buyback: 5.1, assets: 27554.6 };

function itemPtr(type) {
  const q = JSON.parse(fs.readFileSync(path.join(DATA, 'instrument.json'), 'utf8'));
  const i = q.data.items.findIndex(x => x.type === type); if (i < 0) throw Error('élément absent ' + type);
  return '/data/items/' + i;
}

function live(c) {
  const rows = c.extra.live.data.items[0].results[0].data, q = s => { const r = rows.find(x => x.symbol === s); if (!r || r.price_type !== 'live') throw Error('cotation absente ' + s); return r; };
  const m = q('MRVL'), l = q('LITE');
  const hm = iso => { const d = new Date(iso); const p = n => String(n).padStart(2, '0'); return { utc: p(d.getUTCHours()) + ' h ' + p(d.getUTCMinutes()), paris: p((d.getUTCHours() + 1) % 24) + ' h ' + p(d.getUTCMinutes()) }; };
  return { rows, q, m, l, hm, ratio: l.price / m.price, offer: RATIO * m.price, spread: (RATIO * m.price / l.price - 1) * 100, discount: (1 - l.price / (RATIO * m.price)) * 100 };
}

function base(c) {
  const { pct, bars } = c;
  const cmp = c.raw.comparison_bars.data.items[0].results[0].data;
  const bar = d => { const b = bars.find(x => x[0] === d); if (!b) throw Error('barre absente ' + d); return b; };
  const chg = d => { const i = bars.findIndex(b => b[0] === d); if (i < 1) throw Error('variation absente ' + d); return pct(bars[i][4], bars[i - 1][4]); };
  const row = sym => { const r = cmp.find(x => x.symbol === sym); if (!r) throw Error('comparable absent ' + sym); return r.bars; };
  const cl = (sym, d) => { const x = row(sym).find(y => y[0] === d); if (!x) throw Error('barre absente ' + sym + ' ' + d); return x[4]; };
  const dr = (sym, d) => { const b = row(sym), i = b.findIndex(x => x[0] === d); if (i < 1) throw Error('barre absente ' + sym + ' ' + d); return pct(b[i][4], b[i - 1][4]); };
  const since = (sym, d) => pct(row(sym).at(-1)[4], cl(sym, d));
  const avgVol = (from, n) => { const i = bars.findIndex(b => b[0] === from); return bars.slice(i - n, i).reduce((s, b) => s + b[5], 0) / n; };
  return { cmp, bar, chg, row, cl, dr, since, avgVol };
}

function derived(c) {
  const { pct, close, prev, bars, N, G$, ev, marketCap, peerStat, shares } = c;
  const B = base(c), L = live(c);
  const c28 = B.bar('2026-10-28')[4], l28 = B.cl('LITE', '2026-10-28'), l29 = B.cl('LITE', '2026-10-29'), l30 = B.cl('LITE', '2026-10-30');
  const implied28 = RATIO * c28, prem28 = (implied28 / l28 - 1) * 100;
  if (Math.abs(prem28 - T.premium) > 0.15) throw Error('prime recalculée incohérente ' + prem28);
  const spread29 = (RATIO * B.bar('2026-10-29')[4] / l29 - 1) * 100, spread30 = (RATIO * close / l30 - 1) * 100;
  const newShares = RATIO * T.liteDil, liteOwn = newShares / (T.mrvlDil + newShares) * 100, dilCommon = newShares / T.mrvlCommon * 100;
  const mOpInc = (T.q3Rev * T.q3Gm - T.q3Opex) * 4, lOpInc = T.liteRev * T.liteOpm * 4, mRev = T.q3Rev * 4, lRev = T.liteRev * 4;
  const peers = ['AVGO', 'NVDA', 'CRDO', 'ANET', 'COHR'], pv = Object.fromEntries(peers.map(t => [t, peerStat(t, 'enterpriseToRevenue')]));
  const med = a => { const v = [...a].sort((x, y) => x - y); return v[(v.length - 1) / 2]; };
  const peerMed = med(peers.map(t => pv[t]));
  if (Math.abs(peerMed - 17.4) > 0.06) throw Error('médiane des pairs inattendue ' + peerMed);
  const perShareRev = (m, rev) => (m * rev - G$.debt + G$.cash) / shares;
  let worstGap = 0, worstGapD = ''; for (let i = Math.max(1, N - 249); i <= N; i++) { const g = bars[i][1] / bars[i - 1][4] - 1; if (g < worstGap) { worstGap = g; worstGapD = bars[i][0]; } }
  const fi = c.extra.quote.data.items.find(x => x.type === 'instrument_short_interest');
  const mp = c.extra.quote.data.items.find(x => x.type === 'instrument_max_pain');
  const sells = (c.tx.transactions || []).filter(x => x.type_code === 'S' && x.date_transaction >= '2026-09-01');
  const buys = (c.tx.transactions || []).filter(x => x.type_code === 'P' && x.date_transaction >= '2026-09-01');
  const sellN = sells.reduce((s, x) => s + (x.shares || 0), 0), sellV = sells.reduce((s, x) => s + (x.value_usd || (x.shares || 0) * (x.price || 0)), 0);
  return { B, L, c28, l28, l29, l30, implied28, prem28, spread29, spread30, newShares, liteOwn, dilCommon,
    afterCommon: T.mrvlCommon + newShares, mOpInc, lOpInc, mRev, lRev, liteRevShare: lRev / (mRev + lRev) * 100, liteOpShare: lOpInc / (mOpInc + lOpInc) * 100,
    synPct: T.synergies / (mOpInc + lOpInc) * 100, liteEvRun: T.ev / lRev, liteEvGuide: T.ev / ((T.liteGuideLo + T.liteGuideHi) / 2 * 4),
    capLost28: (c28 - close) * shares, capLost29: (c28 - B.bar('2026-10-29')[4]) * shares, smh29: B.dr('SMH', '2026-10-29'), smh30: B.dr('SMH', '2026-10-30'), lite29: B.dr('LITE', '2026-10-29'), premUsd: (T.perShare - l28) * T.liteDil * 1e6,
    c29: B.chg('2026-10-29'), c30: B.chg('2026-10-30'), since28: pct(close, c28), evRev: ev / G$.rev, evEbitda: ev / G$.ebitda, pe: marketCap / G$.ni,
    pv, peerMed, perShareRev, worstGap, worstGapD, fi, mp, siF: fi.shortInterest / c.st.floatShares * 100, finraD: fi.date.slice(0, 10),
    sells, buys, sellN, sellV, vol30: bars[N][5], avgVol30: B.avgVol(bars[N][0], 20),
    debtMcap: G$.debt / marketCap * 100, cashMcap: G$.cash / marketCap * 100, debtAssets: G$.debt / (T.assets * 1e6) * 100, opMargin: G$.ebit / G$.rev * 100,
    fcf: G$.fcf, marketCap };
}

module.exports = (c, save) => {
  const { fr, usd, sgn, close, bars, N, tech, entry, stop, tp1, tp2, abandon, cap, raw, dfr } = c;
  const k = derived(c), { B, L } = k;
  const trig = (Math.floor(entry * 100 + 1e-9) + 1) / 100, stopOrd = Math.floor(stop * 100 + 1e-9) / 100;
  const trigTxt = usd(trig), stopTxt = usd(stopOrd), abTxt = usd(abandon);
  const lt = L.hm(L.m.timestamp);
  const out = {
    meta: { lang: 'fr', dir: 'ltr', level: 'intermediate', tags: ['us', 'semis', 'ai', 'ai-chain', 'trade-idea'], grade: 'C', date: '2026-11-02', dateDisplay: '2 novembre 2026', version: 3, status: 'watch', assetType: 'stock', levelsCloseDate: c.REF,
      description: 'Marvell rachète Lumentum en actions (4,5 actions par action, 33 % du nouvel ensemble, clôture visée en 2028) et perd ' + fr(Math.abs(k.since28), 0) + ' % en deux séances. Cours affiché : clôture du 30 octobre. Rien à acheter ; niveaux provisoires, à recalculer sur la clôture certifiée du 2 novembre.',
      ogDescription: 'Marvell paie Lumentum en actions : ' + fr(k.newShares, 0) + ' millions d’actions nouvelles, une indemnité réglementaire de 3,2 Md$ et une clôture en 2028. Le marché sanctionne l’acheteur. Pas d’achat.',
      lastMcpRefresh: raw.status.captured_at, levelsVerifiedAt: raw.status.captured_at,
      statusHistory: [...(c.archive.meta.statusHistory || []), { at: raw.status.captured_at, from: c.archive.meta.status || 'stopped', to: 'watch', note: 'refonte du 2 novembre sur la clôture du 30 octobre, après l’annonce du rachat de Lumentum : surveillance, déclencheur au-dessus de ' + trigTxt + ' à partir de la clôture du 3 novembre, niveaux provisoires à recalculer sur la clôture certifiée du 2 novembre, aucune entrée', close }] },
    header: { ticker: 'MRVL', name: 'Marvell Technology, Inc.', exchange: 'NASDAQ', sector: 'Semi-conducteurs pour centres de données', price: close, changePct: k.c30,
      badges: [{ text: 'SURVEILLER — AUCUN ORDRE, NIVEAUX PROVISOIRES', color: 'blue' }, { text: 'Cours affiché : clôture certifiée du 30 octobre', color: 'amber' }, { text: 'Rachat de Lumentum payé en actions', color: 'red' }, { text: 'Chaîne IA — puces sur mesure et connectivité', color: 'purple' }],
      metrics: { marketCap: fr(k.marketCap / 1e9, 1) + ' Md$', volume: fr(k.vol30 / 1e6, 2) + ' M', evRevenue: fr(k.evRev, 1) + '×' }, halalStatus: 'unknown' },
    archiveHistory: [
      { date: '2026-09-24', dateDisplay: '24 septembre 2026', grade: 'B-', note: 'Analyse MRVL — version précédente, plan arrêté au stop le 14 octobre' },
      { date: '2026-08-28', dateDisplay: '28 août 2026', note: 'Analyse MRVL — version précédente' },
      { date: '2026-03-07', dateDisplay: '7 mars 2026', note: 'Analyse MRVL — version précédente' }],
  };
  out.verdict = { score: 44, conviction: 'Low', bias: 'Neutral',
    confidence: 'Note C (score additif de 44 sur 100) : la grille crédite la croissance des centres de données et la logique industrielle de l’accord, mais retranche la technique, le prix payé en actions, la dilution et un calendrier qui court jusqu’en 2028. Score éditorial non prédictif. Termes de l’accord lus dans les 8-K du 2 novembre ; niveaux lus sur la clôture certifiée du 30 octobre ; séance du 2 novembre lue sur des cotations non certifiées.',
    summary: 'Marvell conçoit les puces qui relient les serveurs d’intelligence artificielle : processeurs de signal optiques, commutateurs, et accélérateurs sur mesure pour les grands clouds. Le 2 novembre avant l’ouverture, la société a annoncé le rachat de Lumentum, fabricant de lasers et de modules optiques, entièrement payé en actions : 4,5 actions Marvell par action Lumentum, environ 1 132 $ par action au cours du 28 octobre, une prime de 23,9 %. Les actionnaires actuels de Marvell garderaient environ 67 % du nouvel ensemble. Le marché a vendu l’acheteur avant même l’annonce : ' + sgn(k.c29, 1) + ' le 29 octobre, au lendemain des premières informations de presse, puis ' + sgn(k.c30, 1) + ' le 30, jour de repli de tout le secteur (SMH ' + sgn(k.smh30, 1) + '), à ' + usd(close) + ' en clôture certifiée. Le 2 novembre à ' + lt.paris + ' (Paris), le titre cotait ' + usd(L.m.price) + ' en séance, ' + sgn(L.m.changePercent, 1) + ', cours non certifié. Rien à acheter : l’accord ne se conclura pas avant 2028, il crée environ ' + fr(k.newShares, 0) + ' millions d’actions, et le cours n’a pas fini de digérer la nouvelle. Les niveaux du plan seront recalculés sur la clôture certifiée du 2 novembre.',
    whyBuy: [
      'La croissance tient : 2,739 Md$ de revenus au deuxième trimestre (+37 %), et des revenus préliminaires du troisième trimestre au milieu de la prévision de 3,150 Md$, fourchette resserrée de 5 % à 2 % près.',
      'L’accord a une logique industrielle : l’optique remplace le cuivre dans les centres de données d’IA, et Lumentum apporte des lasers sur phosphure d’indium que Marvell n’a pas ; Lumentum a publié 1 262,6 M$ de revenus au trimestre clos le 26 septembre (+136,5 % sur un an) et prévoit 1 575 à 1 625 M$ pour le suivant.',
      'Le prix relatif n’est pas extravagant : avec environ 33 % du nouvel ensemble, les actionnaires de Lumentum apportent ' + fr(k.liteRevShare, 0) + ' % des revenus et ' + fr(k.liteOpShare, 0) + ' % du résultat opérationnel ajusté (trimestres récents annualisés), avant plus de 1 Md$ de synergies visées, soit ' + fr(k.synPct, 0) + ' % de ce résultat combiné.',
      'Aucune dette d’acquisition : l’accord est payé en actions, et la ligne de crédit renouvelable de 3 Md$ signée le 22 octobre n’était pas tirée.'],
    whyAvoid: [
      'Une dilution massive : environ ' + fr(k.newShares, 0) + ' millions d’actions nouvelles (4,5 × 101,7 millions d’actions diluées de Lumentum), soit ' + fr(k.dilCommon, 0) + ' % des 876,9 millions d’actions ordinaires du 21 août ; le plafond de 1,3 milliard d’actions autorisées doit être relevé par un vote.',
      'Un calendrier très long : clôture visée au premier semestre 2028, date limite au 1er novembre 2027 prolongeable jusqu’au 1er août 2028, autorisations réglementaires non nommées publiquement ; Marvell devrait 3,2 Md$ à Lumentum si l’accord échouait pour raison réglementaire.',
      'Le marché sanctionne l’acheteur : le 29 octobre, seule séance propre à l’accord (SMH ' + sgn(k.smh29, 1) + ', Lumentum ' + sgn(k.lite29, 1) + '), Marvell perd ' + fr(Math.abs(k.c29), 1) + ' %, environ ' + fr(k.capLost29 / 1e9, 0) + ' Md$ de capitalisation, déjà plus que les ' + fr(k.premUsd / 1e9, 0) + ' Md$ de prime promis aux actionnaires de Lumentum ; le 30, sa baisse de ' + fr(Math.abs(k.c30), 1) + ' % suit celle de la connectivité (Coherent ' + sgn(B.dr('COHR', '2026-10-30'), 1) + ', Astera Labs ' + sgn(B.dr('ALAB', '2026-10-30'), 1) + ', SMH ' + sgn(k.smh30, 1) + '), et la chute reprend le 2 novembre en séance.',
      'Un multiple encore exigeant : ' + fr(k.evRev, 1) + ' fois les revenus des douze derniers mois à la clôture du 30 octobre, contre une médiane de ' + fr(k.peerMed, 1) + ' fois chez Broadcom, NVIDIA, Credo, Arista et Coherent.',
      'Un capital déjà engagé avant l’accord : bon de souscription de Google sur près de 59 millions d’actions, actions de préférence de NVIDIA convertibles en 21,8 millions d’actions, complément de prix de Celestial AI jusqu’à 24,4 millions d’actions.'],
    controlChecklist: [
      { label: 'Historique de cours', status: 'warn', statusLabel: 'Certifié au 30 octobre seulement', evidence: 'Série quotidienne certifiée de ' + bars.length + ' séances jusqu’au 30 octobre ; la séance du 2 novembre, jour de l’annonce, n’est connue que par des cotations de séance.', action: 'Aucun ordre ce soir ; niveaux provisoires lus sur la clôture du 30 octobre, à recalculer sur la clôture certifiée du 2 novembre.' },
      { label: 'Structure du capital', status: 'fail', statusLabel: 'Émission d’environ un tiers du capital', evidence: 'Environ ' + fr(k.newShares, 0) + ' millions d’actions à émettre pour Lumentum, en plus du bon de Google, des actions de préférence de NVIDIA et du complément de Celestial.', action: 'Lire le formulaire S-4 dès son dépôt : nombre exact d’actions, traitement des obligations convertibles de Lumentum, date des assemblées.' },
      { label: 'Point d’entrée', status: 'fail', statusLabel: 'Sous les moyennes à 20 et 50 séances, choc en cours', evidence: 'Clôture du 30 octobre à ' + usd(close) + ' sous les moyennes à vingt (' + usd(tech.ema20) + ') et cinquante séances (' + usd(tech.ema50) + '), encore ' + fr(c.pct(close, tech.ema200), 1) + ' % au-dessus de celle à deux cents séances (' + usd(tech.ema200) + ') ; ' + fr(k.vol30 / 1e6, 1) + ' millions d’actions échangées, ' + fr(k.vol30 / k.avgVol30, 1) + ' fois la moyenne des vingt séances précédentes.', action: 'Aucune clôture antérieure au 3 novembre ne compte ; ensuite seulement une clôture au-dessus de ' + trigTxt + '.' }] };
  out.liveSession = {
    title: 'Séance du 2 novembre en cours',
    capturedAt: L.m.timestamp,
    capturedAtDisplay: 'Relevé du 2 novembre 2026 à ' + lt.utc + ' UTC (' + lt.paris + ' à Paris), New York ouvert jusqu’à 22 h 00 (Paris).',
    status: 'Cours de séance, non certifié : aucun niveau du plan n’en dérive.',
    rows: ['MRVL', 'LITE', 'SMH', 'SOXX', 'QQQ', 'AVGO', 'NVDA', 'COHR'].map(s => { const r = L.q(s), h = L.hm(r.timestamp); return { ticker: s, label: { MRVL: 'acheteur', LITE: 'cible', SMH: 'panier semi-conducteurs', SOXX: 'panier semi-conducteurs', QQQ: 'Nasdaq 100', AVGO: 'leader', NVDA: 'leader', COHR: 'concurrent optique' }[s], price: usd(r.price), change: sgn(r.changePercent, 1) + ' sur la veille', time: h.utc + ' UTC · ' + h.paris + ' Paris' }; }),
    points: [
      'Lumentum cote ' + fr(L.ratio, 3) + ' actions Marvell, contre 4,5 promises par l’accord : au cours de Marvell, l’offre vaut ' + usd(L.offer) + ' par action Lumentum, et Lumentum cote ' + fr(L.discount, 1) + ' % en dessous. L’écart, ' + fr(L.spread, 1) + ' % de gain brut si l’accord se conclut, était de ' + fr(k.spread30, 1) + ' % à la clôture du 30 octobre.',
      'Le paiement en actions fait fondre l’offre avec le cours de l’acheteur : 1 132 $ annoncés sur la base du 28 octobre, ' + usd(L.offer) + ' au relevé, soit ' + sgn((L.offer / 1132 - 1) * 100, 0) + '.',
      'La baisse est propre aux deux sociétés : Marvell ' + sgn(L.m.changePercent, 1) + ' et Lumentum ' + sgn(L.l.changePercent, 1) + ', quand le panier SMH fait ' + sgn(L.q('SMH').changePercent, 1) + ', Broadcom ' + sgn(L.q('AVGO').changePercent, 1) + ' et NVIDIA ' + sgn(L.q('NVDA').changePercent, 1) + '.',
      'Ce que l’annonce change : la question n’est plus « Marvell va-t-il acheter ? » mais « à quel prix final, et quand ? ». Un écart aussi large dit que le marché doute de la conclusion ou anticipe la pression vendeuse des arbitragistes, qui achètent la cible et vendent l’acheteur à découvert jusqu’à la clôture de l’opération.'],
    note: 'Ces cours sont ceux d’une séance en cours, relevés une seule fois ; ils peuvent finir très loin à la clôture. La clôture certifiée du 2 novembre remplacera ce relevé et les niveaux du plan seront recalculés dessus.',
    sourceRefs: [c.market('cotations de séance du 2 novembre, non certifiées'), c.ref(1), c.ref(0)] };
  out.timeline = {
    title: 'Ce qui peut bouger Marvell', from: '2026-11-03', to: '2026-11-23',
    keyWindow: { from: '2026-11-03', to: '2026-11-05', label: 'Fenêtre clé · premiers pairs à publier après l’annonce' },
    events: [
      { date: '2026-11-03', category: 'plan', impact: 'strong', label: 'Première clôture qui compte', detail: '22 h Paris', icon: 'hourglass', source: 'plan de la fiche', href: '#trade' },
      { date: '2026-11-03', category: 'earnings', impact: 'medium', label: 'Astera Labs, Arista, AMD', detail: 'connectivité', icon: 'company', uncertain: true, side: 'bottom', source: 'calendrier de résultats collecté (yahoo_quote_summary_calendar_events), une seule source' },
      { date: '2026-11-04', category: 'earnings', impact: 'strong', label: 'Coherent', detail: 'concurrent optique', icon: 'company', uncertain: true, source: 'calendrier de résultats collecté (yahoo_quote_summary_calendar_events), une seule source' },
      { date: '2026-11-10', category: 'macro', impact: 'strong', label: 'CPI US', icon: 'data', side: 'bottom', source: 'data/scheduled-events.json (cpi), calendrier du BLS' },
      { date: '2026-11-12', category: 'earnings', impact: 'medium', label: 'Nebius', detail: 'client aval', icon: 'company', uncertain: true, source: 'calendrier de résultats collecté (yahoo_quote_summary_calendar_events), une seule source' },
      { date: '2026-11-13', category: 'macro', impact: 'medium', label: 'PPI US', icon: 'data', side: 'bottom', source: 'data/scheduled-events.json (ppi), calendrier du BLS' },
      { date: '2026-11-17', category: 'earnings', impact: 'strong', label: 'NVIDIA', detail: 'budgets de connectivité', icon: 'chip', uncertain: true, source: 'calendrier de résultats collecté (yahoo_quote_summary_calendar_events), une seule source' },
      { date: '2026-11-20', category: 'plan', impact: 'strong', label: 'Fin du plan', detail: 'dernière activation', icon: 'hourglass', side: 'bottom', source: 'plan de la fiche', href: '#trade' }],
    chains: [
      { title: 'Si l’écart avec Lumentum se resserre', steps: [{ label: 'Doute sur la conclusion', category: 'market', icon: 'bolt', tone: 'down' }, { label: 'Ventes des arbitragistes', category: 'market', icon: 'bank', tone: 'down' }, { label: 'Marvell', category: 'earnings', icon: 'company', tone: 'up' }] },
      { title: 'Si les pairs confirment la demande', steps: [{ label: 'Coherent, Arista', category: 'earnings', icon: 'data', tone: 'up' }, { label: 'Optique des centres de données', category: 'market', icon: 'chip', tone: 'up' }, { label: 'Marvell', category: 'earnings', icon: 'company', tone: 'up' }] }],
    note: 'Aucune clôture avant le 3 novembre ne compte ; sous ' + abTxt + ', le plan est abandonné. S-4 et assemblées non datés. Résultats Marvell le 1er décembre (une source, hors frise). « ? » : une seule source.' };
  return save(Object.assign(out, require('./compose-mrvl-body.cjs')(c, { ...k, trig, stopOrd, trigTxt, stopTxt, abTxt, frG, T, RATIO })));
};

module.exports.scenarios = c => {
  const k = derived(c), u = c.usd, f = c.fr;
  return [
    { scenario: 'bullish', trigger: 'Accord accepté à des termes jugés raisonnables : les pairs optiques confirment la demande, aucune autorité ne s’y oppose, l’écart entre Lumentum et 4,5 actions Marvell se resserre.', firstOrder: 'Marvell reprend la séance du 30 octobre et clôture au-dessus de ' + u(c.entry) + ', puis vise ' + u(c.tp1) + ', dernier niveau avant la rumeur.', secondOrder: 'Lumentum remonte avec lui, mécaniquement ; Coherent et les fabricants de modules restent sous pression face à un concurrent intégré.', confirmation: 'Une clôture au-dessus de ' + u(c.entry) + ' à partir du 3 novembre, avec un écart d’arbitrage revenu sous ' + f(k.spread30, 1) + ' %, son niveau du 30 octobre.', contradiction: 'Un rebond de Marvell pendant que Lumentum décroche : le marché parierait alors sur l’échec de l’accord, pas sur son succès.' },
    { scenario: 'mixed', trigger: 'Le dossier traîne : formulaire S-4 tardif, autorisations longues, assemblées repoussées ; la clôture glisse vers la date limite de novembre 2027 ou au-delà.', firstOrder: 'Le titre oscille entre ' + u(c.abandon) + ' et ' + u(c.entry) + ' ; les arbitragistes gardent leur vente à découvert sur Marvell tant que l’écart reste large.', secondOrder: 'Les clients et fournisseurs attendent : Lumentum assure que « rien ne change » jusqu’à la clôture, mais les concurrents démarchent ses clients.', confirmation: 'Plusieurs clôtures dans cette bande et un écart d’arbitrage stable au-dessus de 10 %.', contradiction: 'Une sortie franche de la bande sur volume, ou une date d’assemblée fixée rapidement.' },
    { scenario: 'bearish', trigger: 'Accord payé trop cher en actions, ou rupture : vote défavorable des actionnaires de Marvell, offre concurrente, refus réglementaire.', firstOrder: 'Clôture sous ' + u(c.abandon) + ', plus bas du 29 juillet ; ensuite ' + u(c.lv('s3')) + ', plus bas du 12 mai. Une rupture réglementaire coûterait 3,2 Md$ à Marvell, un retrait de recommandation 5,8 Md$.', secondOrder: 'Lumentum perdrait sa prime et retomberait vers ses propres multiples ; les fabricants d’optique seraient revalorisés comme cibles.', confirmation: 'Une clôture sous ' + u(c.abandon) + ' sur un volume supérieur à la moyenne.', contradiction: 'Un nouveau plus bas en séance sans clôture dessous, suivi d’une reprise rapide.' }];
};

module.exports.contradictions = c => {
  const k = derived(c), s = c.sgn, f = c.fr;
  return [
    'La croissance n’a pas bougé, le cours si : revenus préliminaires du troisième trimestre au milieu de la prévision, et un titre en baisse de ' + f(Math.abs(k.since28), 1) + ' % entre le 28 et le 30 octobre.',
    'Sur le 29 octobre seul, Marvell ' + s(k.c29, 1) + ' contre SMH ' + s(k.smh29, 1) + ', Broadcom ' + s(k.B.dr('AVGO', '2026-10-29'), 1) + ' et NVIDIA ' + s(k.B.dr('NVDA', '2026-10-29'), 1) + ' : la sanction vise l’accord. Sur les deux séances, les pairs de la connectivité baissent aussi fortement : Coherent ' + s(k.B.since('COHR', '2026-10-28'), 1) + ', Credo ' + s(k.B.since('CRDO', '2026-10-28'), 1) + ', Astera Labs ' + s(k.B.since('ALAB', '2026-10-28'), 1) + ', Applied Optoelectronics ' + s(k.B.since('AAOI', '2026-10-28'), 1) + '.',
    'La cible baisse aussi : Lumentum fait ' + s(k.B.since('LITE', '2026-10-28'), 1) + ' entre le 28 et le 30 octobre, alors qu’une cible rachetée avec prime monte d’ordinaire ; payée en actions Marvell, sa prime fond avec le cours de l’acheteur.',
    'Le 29 octobre, Marvell a perdu environ ' + f(k.capLost29 / 1e9, 0) + ' Md$ de capitalisation, plus que les ' + f(k.premUsd / 1e9, 0) + ' Md$ de prime promis : le marché ne vend pas seulement la prime, il revoit le prix de l’ensemble.',
    'Le 30 octobre, le panier SMH perd ' + f(Math.abs(k.B.dr('SMH', c.REF)), 1) + ' % et Coherent ' + f(Math.abs(k.B.dr('COHR', c.REF)), 1) + ' % : une partie de la baisse de Marvell (' + s(k.c30, 1) + ') vient du secteur, pas de l’accord.'];
};

module.exports.missingData = c => [
  'Clôture du 2 novembre, jour de l’annonce, non certifiée au moment de la publication : seule une cotation de séance horodatée est montrée.',
  'Formulaire S-4 non déposé : nombre exact d’actions à émettre, traitement des obligations convertibles et des capped calls de Lumentum, dates des assemblées inconnus.',
  'Autorisations réglementaires autres que HSR non nommées publiquement (annexes confidentielles de l’accord).',
  'Troisième trimestre de Marvell publié en revenus préliminaires seulement ; date de publication complète non confirmée par la société (1er décembre selon une seule source).',
  'Statistiques des pairs relevées en instantané, sans historique daté ; couverture officielle des formulaires 4 incomplète.',
  'Statut de conformité islamique non tranché par le fournisseur (données insuffisantes) ; seuls les ratios de dette et de trésorerie sont calculés.'];

module.exports.itemPtr = itemPtr;
module.exports.derived = derived;
