'use strict';
// Rédaction du dossier Amazon (AMZN) du 27 octobre 2026. Toute valeur de marché est recalculée depuis les barres
// certifiées et les artefacts collectés ; les chiffres d'entreprise viennent des dépôts SEC ouverts (static-amzn.cjs) ;
// la date des résultats vient du communiqué d'Amazon du 15 octobre 2026 ; les causes de séance viennent de la presse citée.
const usdG = (n, d = 2) => { const [i, f] = Math.abs(n).toFixed(d).split('.'); return (n < 0 ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (f ? ',' + f : '') + ' $'; };
const fs = require('fs'), path = require('path');

// Constantes lues dans les dépôts (M$ sauf mention) ; chaque valeur a son extrait exigé dans static-amzn.cjs.
const F = {
  q2: { sales: 200606, oi: 27461, nonop: 53396, other: 53415, pretax: 80857, tax: 18199, ni: 62647, aws: 42232, awsOi: 16621, na: 9123, intl: 1717, energy: 551, tariff: 640 }, // 8-K 99.1 et 10-Q du T2 2026
  q2guide: { oiLo: 20000, oiHi: 24000, salesLo: 194000, salesHi: 199000 },   // communiqué du T1 2026
  q3guide: { salesLo: 197000, salesHi: 202000, oiLo: 22500, oiHi: 26500, prev: 17422, prevEx: 21700, ftc: 2500, sev: 1800 },
  anthropic: { pref: 92500, notes: 97900, prefDec: 14800, notesDec: 45800, upQ2: 50500, up6m: 62800, tax6m: 15900, q1: 16800, q3_25: 9500, facility: 15000, s1Commit: 110000, s1Notes: 6200 },
  openai: { total: 50000, june: 28700, after: 21300 },
  backlog: { jun26: 496000, dec25: 244000 },
  debtFace: { dec25: 68836, jun26: 132995 }, julyNotes: 24923, sterlingGbp: 4242, ddtl: 17500, leases: 109771,
  fcfTtm: -7604, capexQ2: 53100, buybackLeft: 6100, awards: 11027, sharesJun: 10783, sharesDec: 10731,
};

function base(c) {
  const { pct, bars, N, close } = c;
  const cmp = c.raw.comparison_bars.data.items[0].results[0].data;
  const idx = d => { const i = bars.findIndex(b => b[0] === d); if (i < 1) throw Error('barre absente ' + d); return i; };
  const bar = d => bars[idx(d)];
  const chg = d => { const i = idx(d); return pct(bars[i][4], bars[i - 1][4]); };
  const gapOf = d => { const i = idx(d); return pct(bars[i][1], bars[i - 1][4]); };
  const dr = (sym, d) => { const row = cmp.find(x => x.symbol === sym); if (!row) throw Error('comparable absent ' + sym); const b = row.bars, i = b.findIndex(x => x[0] === d); if (i < 1) throw Error('barre absente ' + sym + ' ' + d); return pct(b[i][4], b[i - 1][4]); };
  const win = bars.slice(Math.max(0, N - 251), N + 1);
  let hi = -1, lo = 1e9, hiD, loD;
  for (const b of win) { if (b[2] > hi) { hi = b[2]; hiD = b[0]; } if (b[3] < lo) { lo = b[3]; loD = b[0]; } }
  if (hiD !== '2026-08-03') throw Error('plus haut annuel inattendu ' + hiD);
  const med = a => { const v = [...a].sort((x, y) => x - y); return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2; };
  const avgVol = (from, n) => { const i = idx(from); return bars.slice(i - n, i).reduce((s, b) => s + b[5], 0) / n; };
  // Couloir de septembre-octobre : plus bas et plus haut des clôtures et des séances depuis le 1er septembre.
  const since = bars.filter(b => b[0] >= '2026-09-01');
  const rangeLo = Math.min(...since.map(b => b[3])), rangeHi = Math.max(...since.map(b => b[2]));
  const touches = since.filter(b => b[3] <= rangeLo * 1.01).length;
  if (since.some(b => b[4] < rangeLo)) throw Error('clôture sous le plancher du couloir');
  return { cmp, idx, bar, chg, gapOf, dr, hi, hiD, lo, loD, med, avgVol, rangeLo, rangeHi, touches, fromHi: Math.abs(pct(close, hi)), fromLo: pct(close, lo) };
}

// Prochaine publication : confirmée par la société (communiqué du 15 octobre 2026, relations investisseurs) et
// concordante avec le calendrier de résultats collecté. Les deux doivent dire le 29 octobre.
function earningsDate(c) {
  const ev = ((c.raw.earnings_risk || {}).events || []).find(e => e.symbol === 'AMZN');
  const cal = (((c.extra || {}).quote || {}).data || { items: [] }).items.find(x => x.type === 'instrument_calendar');
  const d1 = ev && ev.report_date, d2 = cal && String(cal.nextEarningsDate || '').slice(0, 10);
  if (d1 !== '2026-10-29' || d2 !== '2026-10-29') throw Error('date de résultats inattendue ' + d1 + ' / ' + d2);
  return { date: '2026-10-29', ev, source: 'communiqué d’Amazon du 15 octobre 2026 (relations investisseurs), calendrier de résultats collecté concordant' };
}

const B$ = m => m / 1000; // M$ → Md$

module.exports = (c, save) => {
  const usd = usdG;
  const { fr, pct, sgn, close, prev, bars, N, tech, G$, g, marketCap, ev, entry, stop, tp1, tp2, abandon, cap, raw, dfr, nb, peerStat } = c;
  const B = base(c), { chg, gapOf, fromHi } = B;
  const E = earningsDate(c);
  const trig = (Math.floor(entry * 100 + 1e-9) + 1) / 100, trigTxt = usd(trig);
  const stopOrd = Math.floor(stop * 100 + 1e-9) / 100, stopTxt = usd(stopOrd);
  const abTxt = usd(abandon);
  const c26 = pct(close, prev), vol26 = bars[N][5], avgVol26 = B.avgVol(bars[N][0], 20);
  // Réactions aux quatre dernières publications (dates des 8-K item 2.02 : 30 octobre 2025, 5 février, 29 avril et
  // 30 juillet 2026, toutes après la clôture) : séance suivante.
  const reac = ['2025-10-31', '2026-02-06', '2026-04-30', '2026-07-31'].map(d => ({ d, move: chg(d), gap: gapOf(d) }));
  const c0731 = chg('2026-07-31'), close0730 = B.bar('2026-07-30')[4], close0731 = B.bar('2026-07-31')[4];
  const evEbitda = ev / G$.ebitda, evRev = ev / G$.rev, capOi = marketCap / G$.ebit, pe = marketCap / G$.ni;
  const opMargin = G$.ebit / G$.rev * 100, awsMargin = F.q2.awsOi / F.q2.aws * 100;
  const nonopTtm = g.nonop.value, pretaxTtm = G$.ebit + nonopTtm, nonopShareTtm = nonopTtm / pretaxTtm * 100;
  const nonopShareQ2 = F.q2.nonop / F.q2.pretax * 100;
  const ltDebt = g.debtTotal.value, leases = g.leaseOp.value + g.leaseFin.value, finNetDebt = ltDebt - G$.cash, netDebt = G$.debt - G$.cash, proFormaNet = finNetDebt + F.openai.after * 1e6;
  const stakesJun = F.anthropic.pref + F.anthropic.notes + F.openai.june, stakesJunPct = stakesJun * 1e6 / marketCap * 100;
  const awsMarginEx = (F.q2.awsOi - F.q2.energy) / F.q2.aws * 100;
  const stakes = F.anthropic.pref + F.anthropic.notes + F.openai.total, stakesPct = stakes * 1e6 / marketCap * 100;
  const peers = ['MSFT', 'GOOGL', 'META', 'ORCL', 'WMT', 'COST'], pv = Object.fromEntries(peers.map(t => [t, peerStat(t, 'enterpriseToEbitda')]));
  const peerMed = B.med(peers.map(t => pv[t]));
  const MO = 15.1; if (Math.abs(pv.ORCL - MO) > 0.05) throw Error('multiple d’Oracle inattendu ' + pv.ORCL);
  const perShareAt = (m, cut = 0) => (m * G$.ebitda * (1 - cut) - G$.debt + G$.cash) / c.shares;
  const eDate = dfr(E.date);
  const q3lo = (F.q3guide.oiLo / F.q3guide.prev - 1) * 100, q3hi = (F.q3guide.oiHi / F.q3guide.prev - 1) * 100;
  const q3loEx = (F.q3guide.oiLo / F.q3guide.prevEx - 1) * 100, q3hiEx = (F.q3guide.oiHi / F.q3guide.prevEx - 1) * 100;
  const ctx = { B, E, F, B$, trig, trigTxt, stopOrd, stopTxt, abTxt, c26, vol26, avgVol26, reac, c0731, close0730, close0731, evEbitda, evRev, capOi, pe, opMargin, awsMargin, nonopTtm, pretaxTtm, nonopShareTtm, nonopShareQ2, netDebt, ltDebt, leases, finNetDebt, proFormaNet, stakesJun, stakesJunPct, awsMarginEx, stakes, stakesPct, pv, peerMed, MO, perShareAt, eDate, q3lo, q3hi, q3loEx, q3hiEx };
  const reacTxt = reac.map(r => sgn(r.move, 1)).join(', ');
  const archive = c.archive, hist = (archive.meta.statusHistory || []).map(x => ({ ...x }));
  const out = {
    meta: { lang: 'fr', dir: 'ltr', level: 'intermediate', tags: ['us', 'tech', 'consumer', 'ai', 'earnings', 'trade-idea'], grade: 'B-', date: '2026-10-27', dateDisplay: '27 octobre 2026', version: 3, status: 'watch', assetType: 'stock', levelsCloseDate: c.REF,
      description: 'Amazon à ' + usd(close) + ' avant ses résultats du ' + eDate + ' : AWS accélère, mais 53,4 Md$ de produits non opérationnels, surtout sur Anthropic, gonflaient le bénéfice du deuxième trimestre. Rien avant la publication ; achat seulement sur une clôture à ' + trigTxt + ' ou plus.',
      ogDescription: 'Amazon (' + usd(close) + ') publie le ' + eDate + '. Bénéfice gonflé par Anthropic, cloud en accélération, dette doublée. Plan : clôture à ' + trigTxt + ' ou plus après les résultats.',
      lastMcpRefresh: raw.status.captured_at, levelsVerifiedAt: raw.status.captured_at,
      statusHistory: [...hist, { at: raw.status.captured_at, from: archive.meta.status || 'stopped', to: 'watch', note: 'refonte v3 du 27 octobre sur la clôture du 26 : le plan de septembre, arrêté au stop le 16 septembre, est clos ; nouveau plan de surveillance, activation après les résultats du ' + eDate + ' sur une clôture à ' + trigTxt + ' ou plus, aucune entrée', close }] },
    header: { ticker: 'AMZN', name: 'Amazon.com, Inc.', exchange: 'NASDAQ', sector: 'Commerce en ligne, cloud et publicité', price: close, changePct: c26,
      badges: [{ text: 'SURVEILLER — RIEN AVANT LE 29 OCTOBRE', color: 'blue' }, { text: 'Bénéfice gonflé par Anthropic', color: 'amber' }, { text: 'Dette doublée en six mois', color: 'red' }],
      metrics: { marketCap: nb(marketCap / 1e9) + ' Md$', volume: fr(vol26 / 1e6, 1) + ' M', evEbitda: fr(evEbitda, 1) + '×' }, halalStatus: 'unknown' },
  };
  out.verdict = { score: 54, conviction: 'Moderate', bias: 'Neutral',
    confidence: 'Note B− (score additif de 54 sur 100) : la grille crédite un cloud qui accélère et une rentabilité d’exploitation en hausse, puis retranche une technique sans tendance, un bilan qui s’endette vite et un calendrier chargé (résultats le ' + eDate + ', introduction d’Anthropic sans date). Score éditorial non prédictif. Chiffres d’entreprise lus dans les dépôts SEC et les données XBRL officielles ; niveaux lus sur la clôture certifiée du 26 octobre.',
    summary: 'Amazon (AMZN) publie son troisième trimestre le jeudi ' + eDate + ' après la clôture de New York, date confirmée par la société. Le titre arrive à ' + usd(close) + ', ' + fr(fromHi, 0) + ' % sous son plus haut du 3 août, dans un couloir de ' + usd(B.rangeLo) + ' à ' + usd(B.rangeHi) + ' tenu depuis septembre. Le deuxième trimestre mêlait deux histoires. L’exploitation va bien : AWS a progressé de 37 %, le résultat opérationnel de 43 % à 27,5 Md$. Le bénéfice net de 62,6 Md$ dit autre chose : 53,4 Md$ de produits non opérationnels avant impôt, surtout la réévaluation d’Anthropic, soit ' + fr(nonopShareQ2, 0) + ' % du résultat avant impôt. Anthropic a déposé son prospectus d’introduction en Bourse le 26 octobre, sans prix ; Amazon en porte ' + fr(B$(F.anthropic.pref + F.anthropic.notes), 1) + ' Md$ à son bilan. Amazon a acheté pour ' + fr(G$.capex / 1e9, 1) + ' Md$ d’équipements en douze mois et presque doublé sa dette à long terme en six mois. La prévision du trimestre, 22,5 à 26,5 Md$ de résultat opérationnel, se compare à une base de 17,4 Md$ alourdie de 4,3 Md$ de charges exceptionnelles. Pas d’achat avant la publication ; ensuite, seulement sur une clôture à ' + trigTxt + ' ou plus.',
    whyBuy: [
      'Le cloud accélère : AWS a vendu pour 42,2 Md$ au deuxième trimestre (+37 %, sa plus forte croissance depuis dix-huit trimestres selon la société) et dégagé 16,6 Md$ de résultat, ' + fr(awsMargin, 1) + ' % de marge (environ ' + fr(awsMarginEx, 0) + ' % sans les gains latents sur contrats d’énergie).',
      'Le carnet de commandes a doublé : ' + fr(B$(F.backlog.jun26), 0) + ' Md$ d’engagements de clients à plus d’un an non encore comptabilisés au 30 juin 2026, contre ' + fr(B$(F.backlog.dec25), 0) + ' Md$ six mois plus tôt.',
      'L’exploitation progresse sans Anthropic : ' + fr(G$.ebit / 1e9, 1) + ' Md$ de résultat opérationnel sur douze mois (' + fr(opMargin, 1) + ' % des ventes), publicité en hausse de 26 % au deuxième trimestre ; la prévision de ce trimestre-là (20,0 à 24,0 Md$) a été dépassée de ' + fr(B$(F.q2.oi - F.q2guide.oiHi), 1) + ' Md$.',
      'Une valorisation sage pour un leader du cloud : ' + fr(evEbitda, 1) + ' fois l’EBITDA des douze derniers mois, contre ' + fr(pv.MSFT, 1) + ' pour Microsoft et ' + fr(pv.GOOGL, 1) + ' pour Alphabet (statistiques relevées en instantané), sans rien compter pour les ' + fr(B$(stakesJun), 1) + ' Md$ de participations dans Anthropic et OpenAI inscrites au bilan du 30 juin, avant impôt latent.'],
    whyAvoid: [
      'Le bénéfice est en grande partie une écriture : sur douze mois, ' + fr(nonopTtm / 1e9, 1) + ' Md$ de produits non opérationnels avant impôt pour ' + fr(G$.ebit / 1e9, 1) + ' Md$ de résultat opérationnel. À l’introduction d’Anthropic, la conversion des obligations peut faire passer en résultat jusqu’à 92,0 Md$ de plus-value latente, même à prix inchangé ; ensuite, la ligne suivra le cours de Bourse, dans les deux sens.',
      'Le flux de trésorerie libre est négatif : −7,6 Md$ sur douze mois selon la définition de la société, après 169,0 Md$ d’achats nets d’équipements (' + fr(G$.capex / 1e9, 1) + ' Md$ bruts), dont 53,1 Md$ nets au seul deuxième trimestre.',
      'La dette s’accumule : ' + fr(B$(F.debtFace.jun26), 1) + ' Md$ de dette à long terme au 30 juin contre ' + fr(B$(F.debtFace.dec25), 1) + ' Md$ six mois plus tôt, puis 24,9 Md$ d’obligations en juillet et 4,2 Md£ en septembre ; la société annonce d’autres financements cette année.',
      'Amazon finance ses propres clients : 50,0 Md$ investis dans OpenAI et jusqu’à 15,0 Md$ encore promis à Anthropic, deux laboratoires qui ont ajouté chez AWS plus de 200 Md$ d’engagements cette année.',
      'Publication le ' + eDate + ' : le lendemain des quatre dernières, le titre a fait ' + reacTxt + '.'],
    controlChecklist: [
      { label: 'Historique de cours', status: 'pass', statusLabel: 'Trois cents séances certifiées', evidence: 'Série quotidienne certifiée au 26 octobre ; les séries de FDX et XLY, incomplètes au 21 et au 24 juillet, ont été corrigées avant le calcul.', action: 'Niveaux et indicateurs calculés sur cette seule série.' },
      { label: 'Structure financière', status: 'warn', statusLabel: 'Dette doublée, trésorerie libre négative', evidence: 'Dette à long terme de ' + fr(ltDebt / 1e9, 1) + ' Md$ au 30 juin, pour ' + fr(G$.cash / 1e9, 1) + ' Md$ de liquidités et de titres négociables ; dette financière nette de ' + fr(finNetDebt / 1e9, 1) + ' Md$ seulement (hors ' + fr(leases / 1e9, 1) + ' Md$ de dettes de location), mais 24,9 Md$ et 4,2 Md£ d’obligations émises depuis, et un flux de trésorerie libre de −7,6 Md$ sur douze mois.', action: 'Lire le 29 octobre la trésorerie au 30 septembre et le tirage éventuel du prêt de 17,5 Md$.' },
      { label: 'Point d’entrée', status: 'fail', statusLabel: 'Bas du couloir, résultats dans deux jours', evidence: 'Clôture à ' + usd(close) + ' (' + sgn(c26, 1) + '), sous les moyennes à vingt (' + usd(tech.ema20) + ') et cinquante séances (' + usd(tech.ema50) + '), au-dessus de celle à deux cents (' + usd(tech.ema200) + ') ; RSI à ' + fr(tech.rsi14, 0) + '.', action: 'Aucun achat avant les résultats du ' + eDate + ' ; ensuite seulement sur une clôture à ' + trigTxt + ' ou plus.' }] };
  out.timeline = {
    title: 'Ce qui peut bouger Amazon', from: '2026-10-27', to: '2026-11-13',
    keyWindow: { from: E.date, to: '2026-10-30', label: 'Fenêtre clé · résultats après 21 h, clôture du 30 à 21 h' },
    events: [
      { date: '2026-10-28', category: 'macro', impact: 'strong', label: 'Fed', detail: '19 h, taux longs', icon: 'bank', source: 'data/scheduled-events.json (fomc), calendrier de la Réserve fédérale', href: '#macro' },
      { date: '2026-10-28', category: 'earnings', impact: 'medium', label: 'Microsoft, Alphabet', detail: 'Azure, Google Cloud', icon: 'company', uncertain: true, side: 'bottom', source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: E.date, category: 'earnings', impact: 'strong', label: 'Résultats Amazon', detail: 'AWS, prévision du T4', icon: 'company', source: E.source, href: '#earnings' },
      { date: '2026-11-06', category: 'macro', impact: 'medium', label: 'Emploi US', detail: 'consommation', icon: 'data', source: 'daily/20261022/primary-reference.json (bls_empsit), calendrier du BLS' },
      { date: '2026-11-10', category: 'macro', impact: 'strong', label: 'CPI US', detail: 'taux, consommation', icon: 'data', source: 'data/scheduled-events.json (cpi), calendrier du BLS' },
      { date: '2026-11-13', category: 'plan', impact: 'strong', label: 'Fin du plan', detail: 'dernière activation', icon: 'hourglass', source: 'plan de la fiche', href: '#trade' },
    ],
    chains: [
      { title: 'Si Anthropic cote au-dessus', steps: [{ label: 'Prix d’introduction', category: 'market', icon: 'coin' }, { label: 'Réévaluation', category: 'earnings', icon: 'company', tone: 'up' }, { label: 'Bénéfice publié', category: 'earnings', icon: 'data', tone: 'up' }] },
      { title: 'Si AWS ralentit', steps: [{ label: 'Croissance AWS', category: 'earnings', icon: 'chip', tone: 'down' }, { label: 'Investissements', category: 'earnings', icon: 'company' }, { label: 'Cours', category: 'market', icon: 'data', tone: 'down' }] },
    ],
    note: 'Rien ne s’achète avant le ' + eDate + ' ; une clôture sous ' + abTxt + ' abandonne le plan. Introduction d’Anthropic sans date : hors frise. « ? » : date d’une seule source.',
  };
  return save(Object.assign(out, require('./compose-amzn-body.cjs')(c, ctx)));
};

module.exports.scenarios = c => {
  const trig = (Math.floor(c.entry * 100 + 1e-9) + 1) / 100;
  return [
    { scenario: 'bullish', trigger: 'Le 29 octobre, AWS accélère encore et le résultat opérationnel dépasse le haut de la prévision (26,5 Md$) sans nouvelle hausse des investissements jugée excessive.', firstOrder: 'Le titre clôture à ' + usdG(trig) + ' ou plus, au-dessus du sommet du couloir, puis vise ' + usdG(c.tp1) + ' et ' + usdG(c.tp2) + '.', secondOrder: 'Les fournisseurs de centres de données (Nvidia, Marvell, Vertiv) montent avec lui si les investissements sont confirmés.', confirmation: 'Une clôture à ' + usdG(trig) + ' ou plus le 30 octobre ou après, avec un volume supérieur à la moyenne.', contradiction: 'Un saut le soir de la publication qui s’efface dès la séance du 30.' },
    { scenario: 'mixed', trigger: 'Résultat opérationnel dans la prévision, AWS stable, bénéfice net encore gonflé par Anthropic.', firstOrder: 'Le titre reste dans le couloir, entre ' + usdG(c.abandon) + ' et ' + usdG(trig) + '.', secondOrder: 'Le cours suit alors Alphabet et le Nasdaq plus que ses propres chiffres.', confirmation: 'Plusieurs clôtures dans le couloir après la publication.', contradiction: 'Une sortie franche du couloir, d’un côté ou de l’autre.' },
    { scenario: 'bearish', trigger: 'AWS ralentit, ou la prévision du quatrième trimestre déçoit pendant que les investissements montent encore.', firstOrder: 'Clôture sous ' + usdG(c.abandon) + ', plancher du couloir : le plan est abandonné ; le repère suivant est le plus bas du 29 juillet.', secondOrder: 'Les fournisseurs de centres de données baissent si Amazon réduit ses achats ; Walmart et Costco n’en tirent rien, leur corrélation avec Amazon est nulle.', confirmation: 'Une clôture sous ' + usdG(c.abandon) + ' sur un volume supérieur à la moyenne.', contradiction: 'Un nouveau plus bas en séance sans clôture dessous, suivi d’une reprise rapide.' }];
};

module.exports.contradictions = c => {
  const b = base(c), M = c.M, sg = c.sgn, fr = c.fr;
  return [
    'Le bénéfice et le cours divergent : bénéfice net du deuxième trimestre multiplié par ' + fr(62647 / 18164, 1) + ' sur un an, titre ' + fr(Math.abs(c.pct(c.close, b.bar('2026-07-31')[4])), 1) + ' % sous sa clôture du 31 juillet, lendemain de la publication. Le cours ne suit pas le bénéfice publié, gonflé par Anthropic.',
    'Le jour du dépôt du prospectus d’Anthropic, le 26 octobre, ses deux grands actionnaires ont fait moins bien que le Nasdaq : Amazon ' + sg(c.pct(c.close, c.prev), 1) + ', Alphabet ' + sg(b.dr('GOOGL', c.REF), 1) + ', panier Nasdaq ' + sg(b.dr('QQQ', c.REF), 1) + '.',
    'Walmart et Costco ne disent rien d’Amazon en Bourse : corrélation de ' + fr(M.WMT.correlation, 2) + ' et ' + fr(M.COST.correlation, 2) + ' sur ' + M.WMT.observations + ' séances, quand Alphabet est à ' + fr(M.GOOGL.correlation, 2) + '. Le marché traite Amazon comme une valeur de cloud et d’IA, pas comme un distributeur.',
    'La baisse du 22 octobre (' + sg(b.chg('2026-10-22'), 1) + ') n’est pas propre à Amazon : Meta ' + sg(b.dr('META', '2026-10-22'), 1) + ', Nvidia ' + sg(b.dr('NVDA', '2026-10-22'), 1) + ', panier Nasdaq ' + sg(b.dr('QQQ', '2026-10-22'), 1) + ' le même jour.'];
};

module.exports.missingData = c => {
  const ev = ((c.raw.earnings_risk || {}).events || []).find(e => e.symbol === 'AMZN') || {};
  return [
    'Prix et date d’introduction d’Anthropic inconnus ; la part du capital qu’Amazon détiendra après l’opération est laissée en blanc dans le prospectus du 26 octobre.',
    'Tirage éventuel du prêt de 17,5 Md$, ouvert jusqu’au 30 septembre, non publié avant les comptes du troisième trimestre.',
    'Part d’OpenAI et d’Anthropic dans le carnet de commandes de 496 Md$ non publiée par la société.',
    'Montant d’investissement prévu pour l’ensemble de 2026 non chiffré dans les pièces ouvertes.',
    ...(ev.implied_move_pct == null ? ['Mouvement implicite des options autour des résultats non disponible à la collecte (marché des options fermé).'] : []),
    'Relevé des formulaires 4 incomplet sur l’année : aucun solde d’achats ou de ventes d’initiés affirmé.',
    'Statistiques des pairs relevées en instantané, sans historique daté.'];
};

module.exports.F = F;
