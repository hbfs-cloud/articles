'use strict';
// Rédaction du dossier Alphabet (GOOGL) du 27 octobre 2026. Toute valeur de marché est recalculée depuis les barres
// certifiées et les artefacts collectés ; les chiffres d'entreprise viennent des dépôts SEC ouverts (static-googl.cjs) ;
// les déclarations du directeur général et le nom de la société non cotée (Anthropic) viennent de la presse citée.
const S = require('./static-googl.cjs');

// Nombres au format français avec séparateur de milliers (« 3 874,5 ») : le formateur commun n'en met pas.
const frG = (n, d = 2) => { const [i, f] = Math.abs(n).toFixed(d).split('.'); return (n < 0 ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (f ? ',' + f : ''); };
const usdG = (n, d = 2) => frG(n, d) + ' $';

// Chiffres lus dans les dépôts ouverts (Md$ sauf mention). Chaque valeur est citée dans static-googl.cjs (needles).
const D = {
  rev2: 119.796, rev2y: 96.428, cloud2: 24.768, cloud2y: 13.624, cloudOi2: 8.814, cloudOi2y: 2.826,
  serv2: 94.540, servOi2: 39.544, search2: 63.271, search2y: 54.190, op2: 40.770, op2y: 31.271,
  ni2: 112.193, eps2: 9.11, eps2y: 2.31, gainPre2: 99.0, gainNi2: 77.1, gainEps2: 6.26, gainNonMkt2: 77.354, gainMkt2: 21.399,
  fcf2: -5.855, fcfTtm: 53.273, capex2: 44.924, tac2: 16.179, tac2y: 14.705,
  raiseNet: 49.6, notesQ1: 31.1, notesQ2: 20.3, notesAug: 25, priceRunner: 1.5, int2: 1.278, int2y: 0.261,
  backlog: 519.5, cloudBacklog: 513.9, spacex: 94.1, spacexShort: 80.0, spacexLong: 14.1, nonMkt: 131.461, commit: 20.0,
  atm: 40.0, buybackLeft: 69.5, capexLo: 195, capexHi: 205, capexLoFeb: 175, capexHiFeb: 185, capexLoApr: 180, capexHiApr: 190, capexH1: 80.6, capexH1y: 39.6, wiz: 29.5, android: 5.2,
  commitTotal: 811.0, commitShort: 200.7, commitFixed: 707.0, backstopsFuture: 24.1, guarantees: 7.6, leasesNc: 85.2, backstops: 43.785, backstopsDec: 16.940, sbcH1: 14.708,
  debtDec: 46.547 + 1.996, sharesDec: 12088, sharesA: 5868, sharesB: 835, sharesC: 5527,
  div: 0.22, offerA: 355.1982, offerC: 351.8018, bkA: 351.81, totalRaise: 84.75,
  pubShares: 2 * (25459689 + 3818953), bkShares: 14212035 + 14359656, depShares: 385e6,
  convMaxA: 2.8160, convMinA: 2.2520, convMaxC: 2.8420, capPrice: 532.6704,
};

function base(c) {
  const { pct, bars, N, close } = c;
  const cmp = c.raw.comparison_bars.data.items[0].results[0].data;
  const bar = d => { const b = bars.find(x => x[0] === d); if (!b) throw Error('barre absente ' + d); return b; };
  const chg = d => { const i = bars.findIndex(b => b[0] === d); if (i < 1) throw Error('variation absente ' + d); return pct(bars[i][4], bars[i - 1][4]); };
  const row = sym => { const r = cmp.find(x => x.symbol === sym); if (!r) throw Error('comparable absent ' + sym); return r.bars; };
  const dr = (sym, d) => { const b = row(sym), i = b.findIndex(x => x[0] === d); if (i < 1) throw Error('barre absente ' + sym + ' ' + d); return pct(b[i][4], b[i - 1][4]); };
  const cl = (sym, d) => { const b = row(sym).find(x => x[0] === d); if (!b) throw Error('clôture absente ' + sym + ' ' + d); return b[4]; };
  const win = bars.slice(Math.max(0, N - 251), N + 1);
  let hi = -1, lo = 1e9, hiD, loD;
  for (const b of win) { if (b[2] > hi) { hi = b[2]; hiD = b[0]; } if (b[3] < lo) { lo = b[3]; loD = b[0]; } }
  if (hiD !== '2026-05-18') throw Error('plus haut annuel inattendu ' + hiD);
  const med = a => { const v = [...a].sort((x, y) => x - y); return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2; };
  const avgVol = (from, n) => { const i = bars.findIndex(b => b[0] === from); return bars.slice(i - n, i).reduce((s, b) => s + b[5], 0) / n; };
  // Séances de baisse consécutives jusqu'à la clôture de référence.
  let streak = 0; for (let i = N; i > 0 && bars[i][4] < bars[i - 1][4]; i--) streak++;
  return { cmp, bar, chg, dr, cl, hi, hiD, lo, loD, med, avgVol, streak, fromHi: Math.abs(pct(close, hi)), first5: bars[N - 5][4] };
}

// Prochaine publication : calendrier de l'instrument (et calendrier de résultats collecté), confirmée par le communiqué
// d'Alphabet du 6 octobre 2026 (« Alphabet Announces Date of Third Quarter 2026 Financial Results Conference Call »).
function earningsDate(c) {
  const ev = ((c.raw.earnings_risk || {}).events || []).find(e => e.symbol === 'GOOGL');
  const cal = (((c.extra || {}).quote || {}).data || { items: [] }).items.find(x => x.type === 'instrument_calendar');
  const d1 = ev && ev.report_date, d2 = cal && String(cal.nextEarningsDate || '').slice(0, 10);
  if (!d1 || d1 !== d2) throw Error('dates de résultats discordantes ' + d1 + ' ' + d2);
  return { date: d1, source: 'communiqué d’Alphabet du 6 octobre 2026, copie archivée et hachée (analyses/GOOGL/_runs/20261027/revision/ir-20261006-q3-call-date.html, relais BigGo Finance) : conférence le 28 octobre à 13 h 30 heure du Pacifique ; recoupé par le calendrier de l’instrument et le calendrier de résultats collectés' };
}

function figures(c) {
  const { G$, g, close, marketCap, ev, pct, bars, N } = c;
  const B = base(c);
  const gainsTtm = S.gainsAfterTax.reduce((s, x) => s + x.v, 0) * 1e9;
  const niEx = G$.ni - gainsTtm, peGaap = marketCap / G$.ni, peEx = marketCap / niEx;
  const evEbitda = ev / G$.ebitda, evEbit = ev / G$.ebit, opMargin = G$.ebit / G$.rev * 100, fcfYield = G$.fcf / marketCap * 100;
  const netCash = G$.cash - G$.debt;
  const stakes = (D.spacex + D.nonMkt) * 1e9, stakesPerShare = stakes / c.shares, stakesPct = stakes / marketCap * 100;
  const eps2ex = D.eps2 - D.gainEps2;
  const spx0 = B.cl('SPCX', '2026-06-30'), spx1 = B.cl('SPCX', '2026-09-30'), spxQ3 = pct(spx1, spx0), spxMark = D.spacex * spxQ3 / 100;
  const spxNow = pct(B.cl('SPCX', c.REF), spx1);
  const prefPerSeries = D.depShares / 20 / 2, convMax = prefPerSeries * (D.convMaxA + D.convMaxC), convPct = convMax / c.shares * 100;
  const atmShares = D.atm * 1e9 / close, atmPct = atmShares / c.shares * 100;
  const newShares = D.pubShares + D.bkShares, newPct = newShares / c.shares * 100;
  const sharesChg = pct(c.shares / 1e6, D.sharesDec);
  const debtNow = G$.debt / 1e9, debtPro = debtNow + D.notesAug;
  const fromOffer = pct(close, D.offerA), fromBk = pct(close, D.bkA);
  const cloudG = pct(D.cloud2, D.cloud2y), revG = pct(D.rev2, D.rev2y), opG = pct(D.op2, D.op2y), searchG = pct(D.search2, D.search2y), tacG = pct(D.tac2, D.tac2y);
  const cloudM = D.cloudOi2 / D.cloud2 * 100, servM = D.servOi2 / D.serv2 * 100, op2M = D.op2 / D.rev2 * 100;
  const gainShare = gainsTtm / G$.ni * 100, intX = D.int2 / D.int2y;
  return { B, gainsTtm, niEx, peGaap, peEx, evEbitda, evEbit, opMargin, fcfYield, netCash, stakes, stakesPerShare, stakesPct, eps2ex, spx0, spx1, spxQ3, spxMark, spxNow,
    prefPerSeries, convMax, convPct, atmShares, atmPct, newShares, newPct, sharesChg, debtNow, debtPro, fromOffer, fromBk, cloudG, revG, opG, searchG, tacG, cloudM, servM, op2M, gainShare, intX };
}

module.exports = (c, save) => {
  const usd = usdG;
  const { fr, pct, sgn, close, prev, bars, N, tech, G$, marketCap, ev, entry, stop, tp1, tp2, abandon, cap, raw, dfr, nb, peerStat } = c;
  const F = figures(c), { B } = F;
  const E = earningsDate(c);
  if (E.date !== '2026-10-28') throw Error('date de résultats inattendue ' + E.date);
  const trig = (Math.floor(entry * 100 + 1e-9) + 1) / 100, trigTxt = usd(trig);
  const stopOrd = Math.floor(stop * 100 + 1e-9) / 100, stopTxt = usd(stopOrd);
  const abTxt = usd(abandon);
  const c26 = pct(close, prev), lo26 = bars[N][3], vol26 = bars[N][5];
  const c0723 = B.chg('2026-07-23'), c0602 = B.chg('2026-06-02'), c1021 = B.chg('2026-10-21'), c1022 = B.chg('2026-10-22');
  const peers = ['MSFT', 'AMZN', 'META', 'ORCL', 'AAPL'], pv = Object.fromEntries(peers.map(t => [t, peerStat(t, 'enterpriseToEbitda')]));
  const peerMed = B.med(peers.map(t => pv[t]));
  if (Math.abs(peerMed - 16.7) > 0.05) throw Error('médiane des pairs inattendue ' + peerMed);
  const eDate = dfr(E.date);
  const k = { F, B, E, trig, trigTxt, stopOrd, stopTxt, abTxt, c26, lo26, vol26, c0723, c0602, c1021, c1022, pv, peerMed, eDate, frG, usdG, D };
  const out = {
    meta: { lang: 'fr', dir: 'ltr', level: 'intermediate', tags: ['us', 'tech', 'ai', 'earnings', 'trade-idea'], grade: 'C', date: '2026-10-27', dateDisplay: '27 octobre 2026', version: 3, status: 'watch', assetType: 'stock', levelsCloseDate: c.REF,
      description: 'Alphabet à ' + usd(close) + ', ' + B.streak + ' baisses de suite avant ses résultats du ' + eDate + '. Sur douze mois, ' + fr(F.gainsTtm / 1e9, 1) + ' Md$ de son bénéfice de ' + fr(G$.ni / 1e9, 1) + ' Md$ sont des revalorisations de titres ; trésorerie libre négative au T2. Rien avant la publication, puis seulement sur une clôture à ' + trigTxt + ' ou plus.',
      ogDescription: 'Alphabet à ' + usd(close) + ', ' + B.streak + ' baisses de suite avant ses résultats du ' + eDate + ' : bénéfice gonflé par SpaceX et Anthropic, trésorerie libre négative au T2. Rien avant la publication.',
      lastMcpRefresh: raw.status.captured_at, levelsVerifiedAt: raw.status.captured_at,
      statusHistory: [{ at: raw.status.captured_at, from: 'info', to: 'watch', note: 'refonte du 27 octobre 2026 sur la clôture du 26 : plan de surveillance, activation après les résultats du 28 octobre sur une clôture à ' + trigTxt + ' ou plus, aucune entrée', close }] },
    header: { ticker: 'GOOGL', name: 'Alphabet Inc. (classe A)', exchange: 'NASDAQ', sector: 'Recherche, publicité, nuage et puces d’IA', price: close, changePct: c26,
      badges: [{ text: 'SURVEILLER — RIEN AVANT LE 28 OCTOBRE', color: 'blue' }, { text: 'Bénéfice gonflé par des titres', color: 'amber' }, { text: 'Trésorerie libre négative au T2', color: 'red' }],
      metrics: { marketCap: frG(marketCap / 1e9, 0) + ' Md$', volume: fr(vol26 / 1e6, 1) + ' M', evEbitda: fr(F.evEbitda, 1) + '×' }, halalStatus: 'unknown' },
  };
  out.verdict = { score: 47, conviction: 'Low', bias: 'Neutral',
    confidence: 'Note C (score additif de 47 sur 100) : la grille crédite une croissance rare pour cette taille et un bilan encore en trésorerie nette, mais retranche la technique, un financement qui a basculé des rachats vers l’émission, et des résultats dans deux jours. Score éditorial non prédictif. Chiffres d’entreprise lus dans les dépôts SEC et les données XBRL officielles ; niveaux lus sur la clôture certifiée du 26 octobre.',
    summary: 'Alphabet vend de la publicité (recherche, YouTube), loue de la puissance de calcul (Google Cloud) et vend désormais ses propres puces d’IA. Au deuxième trimestre, le chiffre d’affaires a progressé de ' + fr(F.revG, 0) + ' %, Google Cloud de ' + fr(F.cloudG, 0) + ' % et la marge opérationnelle a atteint ' + fr(F.op2M, 0) + ' %. Le bénéfice net, ' + fr(D.ni2, 1) + ' Md$, se lit autrement : ' + fr(D.gainNi2, 1) + ' Md$ viennent de la revalorisation de titres (actions SpaceX et une société non cotée, Anthropic selon la presse), sans un dollar encaissé. Hors ces gains, le bénéfice par action du trimestre est de ' + fr(F.eps2ex, 2) + ' $, pas ' + fr(D.eps2, 2) + ' $. Les investissements (' + fr(D.capex2, 1) + ' Md$ au trimestre) ont fait passer le flux de trésorerie libre sous zéro, et la société a levé ' + fr(D.raiseNet, 1) + ' Md$ de capitaux propres en juin au lieu de racheter ses actions. Lundi, le titre a clôturé à ' + usd(close) + ', ' + B.streak + 'e baisse de suite, ' + fr(F.B.fromHi, 0) + ' % sous son plus haut de mai, à ' + fr(Math.abs(pct(stop, close)), 1) + ' % du plus bas du 23 juillet (' + usd(stop) + '). Les résultats du troisième trimestre tombent le ' + eDate + ', avant une conférence à 21 h 30 (Paris) ; date annoncée par la société, heure de publication non confirmée. Pas d’achat avant.',
    whyBuy: [
      'Une croissance rare pour cette taille : ' + fr(D.rev2, 1) + ' Md$ de chiffre d’affaires au deuxième trimestre (' + sgn(F.revG, 0) + '), Google Cloud à ' + fr(D.cloud2, 1) + ' Md$ (' + sgn(F.cloudG, 0) + ') avec ' + fr(D.cloudOi2, 1) + ' Md$ de résultat opérationnel contre ' + fr(D.cloudOi2y, 1) + ' Md$ un an plus tôt ; résultat opérationnel du groupe ' + sgn(F.opG, 0) + ', malgré ' + fr(D.priceRunner, 1) + ' Md$ de dommages et intérêts comptabilisés dans le procès PriceRunner.',
      'Un carnet de commandes de ' + fr(D.cloudBacklog, 1) + ' Md$ pour Google Cloud au 30 juin, dont un peu plus de la moitié doit être facturée sous vingt-quatre mois : la demande existe, c’est la capacité qui manque.',
      'Un bilan qui reste en trésorerie nette : ' + fr(G$.cash / 1e9, 1) + ' Md$ de liquidités et titres de créance contre ' + fr(F.debtNow, 1) + ' Md$ de dette au 30 juin. S’y ajoutent ' + fr(F.stakes / 1e9, 1) + ' Md$ de participations (SpaceX et sociétés non cotées), environ ' + fr(F.stakesPerShare, 0) + ' $ par action, que la valeur d’entreprise ne compte pas.',
      'Le titre cote ' + fr(Math.abs(F.fromOffer), 1) + ' % sous le prix de l’émission de juin (' + usd(D.offerA, 4) + ' l’action A) et ' + fr(Math.abs(F.fromBk), 1) + ' % sous le prix payé par Berkshire Hathaway (environ ' + usd(D.bkA) + ') ; RSI à ' + fr(tech.rsi14, 0) + '.'],
    whyAvoid: [
      'Un bénéfice à moitié comptable : sur douze mois, ' + fr(G$.ni / 1e9, 1) + ' Md$ de bénéfice net, dont ' + fr(F.gainsTtm / 1e9, 1) + ' Md$ de gains sur titres après impôt (' + fr(F.gainShare, 0) + ' %). Le cours vaut ' + fr(F.peGaap, 1) + ' fois le bénéfice publié, mais ' + fr(F.peEx, 1) + ' fois le bénéfice hors ces gains.',
      'La trésorerie ne suit plus : flux de trésorerie libre de ' + fr(D.fcf2, 1) + ' Md$ au deuxième trimestre et de ' + fr(D.fcfTtm, 1) + ' Md$ sur douze mois, ' + fr(F.fcfYield, 1) + ' % de la capitalisation. La société prévoit désormais ' + D.capexLo + ' à ' + D.capexHi + ' Md$ d’investissements en 2026 (fourchette relevée le 22 juillet, selon Bloomberg), dont ' + fr(D.capexH1, 1) + ' Md$ dépensés au premier semestre : le second semestre doit en absorber ' + fr(D.capexLo - D.capexH1, 1) + ' à ' + fr(D.capexHi - D.capexH1, 1) + '.',
      'Le financement a changé de sens : aucun rachat d’actions au premier semestre (' + fr(28.306, 1) + ' Md$ un an plus tôt), une dette passée de ' + fr(D.debtDec, 1) + ' à ' + fr(F.debtNow, 1) + ' Md$ en six mois, puis ' + D.notesAug + ' Md$ d’obligations en août, et ' + frG(F.newShares / 1e6, 1) + ' millions d’actions nouvelles émises en juin. Un programme de ventes d’actions au fil de l’eau de ' + fr(D.atm, 0) + ' Md$ reste ouvert.',
      'Le résultat du troisième trimestre dépend aussi du cours de SpaceX : la participation, ' + fr(D.spacex, 1) + ' Md$ au 30 juin, est cotée depuis juin, et l’action a perdu ' + fr(Math.abs(F.spxQ3), 1) + ' % entre le 30 juin et le 30 septembre. Au cours de bourse, cela ferait environ ' + fr(Math.abs(F.spxMark), 1) + ' Md$ de perte avant impôt, sans effet sur l’exploitation.',
      'Deux procès antitrust américains pèsent encore : le jugement de la recherche, rendu en décembre 2025, restreint la distribution et impose de partager des données, et il est en appel des deux côtés ; dans la publicité en ligne, la juge a écarté le 2 septembre la cession d’AdX et de DFP mais imposé des remèdes de comportement, selon AdExchanger.'],
    controlChecklist: [
      { label: 'Historique de cours', status: 'pass', statusLabel: 'Trois cents séances certifiées', evidence: 'Série quotidienne certifiée au 26 octobre ; la séance du 22 juillet, absente du chemin de lecture du serveur, a été rechargée avant la collecte.', action: 'Niveaux et indicateurs calculés sur cette seule série.' },
      { label: 'Structure financière', status: 'warn', statusLabel: 'Trésorerie nette, flux libre négatif au T2', evidence: fr(G$.cash / 1e9, 1) + ' Md$ de liquidités et titres de créance pour ' + fr(F.debtNow, 1) + ' Md$ de dette au 30 juin ; flux de trésorerie libre de ' + fr(D.fcf2, 1) + ' Md$ au trimestre ; ' + fr(D.raiseNet, 1) + ' Md$ de capitaux propres levés en juin.', action: 'Lire le 28 octobre le flux de trésorerie libre du troisième trimestre et la prévision d’investissements.' },
      { label: 'Point d’entrée', status: 'fail', statusLabel: 'Sous ses moyennes, résultats dans deux jours', evidence: 'Clôture à ' + usd(close) + ' (' + sgn(c26, 1) + '), ' + B.streak + 'e baisse de suite, sous les moyennes à vingt (' + usd(tech.ema20) + '), cinquante (' + usd(tech.ema50) + ') et deux cents séances (' + usd(tech.ema200) + ') ; RSI à ' + fr(tech.rsi14, 0) + '.', action: 'Aucun achat avant les résultats du ' + eDate + ' ; ensuite seulement sur une clôture à ' + trigTxt + ' ou plus.' }] };
  out.timeline = {
    title: 'Ce qui peut bouger Alphabet', from: '2026-10-27', to: '2026-11-16',
    keyWindow: { from: E.date, to: '2026-10-29', label: 'Fenêtre clé · résultats en soirée, clôture du 29 à 21 h' },
    events: [
      { date: '2026-10-28', category: 'macro', impact: 'strong', label: 'Fed', detail: '19 h, taux longs', icon: 'bank', source: 'data/scheduled-events.json (fomc), calendrier de la Réserve fédérale', href: '#macro' },
      { date: E.date, category: 'earnings', impact: 'strong', label: 'Résultats Alphabet', detail: 'conférence 21 h 30', icon: 'company', source: E.source, href: '#earnings' },
      { date: '2026-10-28', category: 'earnings', impact: 'medium', label: 'Microsoft', detail: 'Azure', icon: 'chip', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: '2026-10-29', category: 'earnings', impact: 'medium', label: 'Amazon', detail: 'AWS, Anthropic', icon: 'company', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: '2026-11-06', category: 'macro', impact: 'medium', label: 'Emploi US', detail: 'taux', icon: 'data', source: 'daily/20261022/primary-reference.json (bls_empsit), calendrier du BLS' },
      { date: '2026-11-10', category: 'macro', impact: 'strong', label: 'CPI US', detail: 'taux', icon: 'data', source: 'data/scheduled-events.json (cpi), calendrier du BLS' },
      { date: '2026-11-13', category: 'plan', impact: 'strong', label: 'Fin du plan', detail: 'dernière activation', icon: 'hourglass', source: 'plan de la fiche', href: '#trade' },
    ],
    chains: [
      { title: 'Si les investissements montent encore', steps: [{ label: 'Prévision relevée', category: 'earnings', icon: 'company' }, { label: 'Trésorerie libre', category: 'earnings', icon: 'coin', tone: 'down' }, { label: 'Fournisseurs de puces', category: 'earnings', icon: 'chip', tone: 'up' }] },
      { title: 'Si SpaceX baisse', steps: [{ label: 'Cours SpaceX', category: 'market', icon: 'bolt', tone: 'down' }, { label: 'Bénéfice publié', category: 'earnings', icon: 'company', tone: 'down' }] },
    ],
    note: 'Rien ne s’achète avant le 28 octobre ; une clôture sous ' + abTxt + ' abandonne le plan. New York ferme à 21 h (Paris) jusqu’au 30 octobre, à 22 h ensuite. « ? » : date d’une seule source.',
  };
  return save(Object.assign(out, require('./compose-googl-body.cjs')(c, k)));
};

module.exports.scenarios = c => {
  const trig = (Math.floor(c.entry * 100 + 1e-9) + 1) / 100;
  return [
    { scenario: 'bullish', trigger: 'Le 28 octobre, Google Cloud accélère encore, l’arriéré de commandes dépasse les ' + c.fr(D.cloudBacklog, 1) + ' Md$ du 30 juin et la prévision d’investissements reste dans la fourchette de ' + D.capexLo + ' à ' + D.capexHi + ' Md$.', firstOrder: 'Le titre clôture à ' + usdG(trig) + ' ou plus, au-dessus du plus haut du 22 octobre, puis vise ' + usdG(c.tp1) + ' et ' + usdG(c.tp2) + '.', secondOrder: 'Les fournisseurs de puces et de serveurs montent avec lui ; les régies concurrentes moins.', confirmation: 'Une clôture à ' + usdG(trig) + ' ou plus après la publication, avec un volume supérieur à la moyenne.', contradiction: 'Un saut le soir de la publication qui s’efface dès la première séance complète.' },
    { scenario: 'mixed', trigger: 'Chiffre d’affaires conforme, mais investissements relevés et flux de trésorerie libre encore faible ; perte comptable sur SpaceX lue comme une baisse du bénéfice.', firstOrder: 'Le titre oscille entre ' + usdG(c.abandon) + ' et ' + usdG(trig) + ', sans base nette.', secondOrder: 'Les fournisseurs de puces profitent de la prévision, Alphabet en paie le prix.', confirmation: 'Des clôtures dans cette bande pendant plusieurs séances.', contradiction: 'Une sortie franche de la bande, d’un côté ou de l’autre.' },
    { scenario: 'bearish', trigger: 'Prévision d’investissements relevée au-delà de ' + D.capexHi + ' Md$ sans accélération de Google Cloud, ou recul de la recherche face aux assistants d’IA.', firstOrder: 'Clôture sous ' + usdG(c.abandon) + ', bas du trou d’ouverture du 8 avril : le prochain repère est le plus bas du 30 mars, ' + usdG(c.lv('s3')) + '.', secondOrder: 'Microsoft et Amazon, jugés sur la même équation, reculent aussi ; les fournisseurs de puces tiennent tant que la dépense continue.', confirmation: 'Une clôture sous ' + usdG(c.abandon) + ' sur un volume supérieur à la moyenne.', contradiction: 'Un nouveau plus bas en séance sans clôture dessous, suivi d’une reprise rapide.' }];
};

module.exports.contradictions = c => {
  const F = figures(c), B = F.B;
  return [
    'Les comptes battent des records pendant que le cours recule : bénéfice net de ' + c.fr(D.ni2, 1) + ' Md$ au deuxième trimestre, titre ' + c.fr(Math.abs(c.pct(c.close, B.bar('2026-07-22')[4])), 1) + ' % sous sa clôture du 22 juillet. Mais ' + c.fr(D.gainNi2, 1) + ' Md$ de ce bénéfice sont des revalorisations : le marché lit le flux de trésorerie, pas le bénéfice publié.',
    'Le 22 octobre, Alphabet a perdu ' + c.fr(Math.abs(B.chg('2026-10-22')), 1) + ' %, Microsoft ' + c.sgn(B.dr('MSFT', '2026-10-22'), 1) + ', Amazon ' + c.sgn(B.dr('AMZN', '2026-10-22'), 1) + ', Meta ' + c.sgn(B.dr('META', '2026-10-22'), 1) + ' et Nvidia ' + c.sgn(B.dr('NVDA', '2026-10-22'), 1) + ' : une part de la baisse est sectorielle. Sur vingt et une séances, Alphabet fait ' + c.sgn(c.ret(21), 1) + ', le panier du Nasdaq ' + c.sgn(c.M.QQQ.return21d, 1) + '.',
    'La société a vendu des actions à ' + usdG(D.offerA, 2) + ' en juin et prévoit d’en vendre encore au fil de l’eau ; elle disposait pourtant de ' + c.fr(D.buybackLeft, 1) + ' Md$ d’autorisation de rachat au 30 juin. Elle émet quand le cours est haut et ne rachète plus.',
    'Le directeur général dit que Google Cloud renonce à des revenus faute de capacité, selon la presse, alors que l’arriéré atteint ' + c.fr(D.cloudBacklog, 1) + ' Md$ : la limite de la croissance est la vitesse d’investissement, donc la trésorerie.'];
};

module.exports.missingData = c => [
  'Nom de la société non cotée revalorisée de ' + c.fr(D.gainNonMkt2, 1) + ' Md$ au deuxième trimestre : le 10-Q ne le donne pas ; Anthropic selon la presse.',
  'Valeur de la participation SpaceX au 30 septembre et montant du gain ou de la perte du troisième trimestre : publiés le 28 octobre seulement.',
  'Ventes réalisées par le programme au fil de l’eau depuis le 30 juin (aucune au 30 juin) : connues avec le 10-Q du troisième trimestre.',
  'Prévision d’investissements 2026 de ' + D.capexLo + ' à ' + D.capexHi + ' Md$ connue par la presse (conférence du 22 juillet), absente des dépôts ouverts ; seule la fourchette de février (' + D.capexLoFeb + ' à ' + D.capexHiFeb + ' Md$) figure dans un communiqué.',
  'Coût des remèdes de comportement imposés le 2 septembre dans la publicité en ligne et calendrier des appels non chiffrés : jugement postérieur au 10-Q, connu par la presse.',
  'Mouvement implicite des options autour des résultats non mesuré : marché fermé lors de la collecte.',
  'Couverture officielle des formulaires 4 incomplète sur l’année ; aucun solde net des dirigeants affirmé.',
  'Statistiques des pairs relevées en instantané, sans historique daté.'];

module.exports.figures = figures;
module.exports.D = D;
