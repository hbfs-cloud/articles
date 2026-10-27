'use strict';
// Rédaction du dossier Cameco (CCJ) du 27 octobre 2026. Toute valeur de marché est recalculée depuis les barres certifiées
// et les artefacts collectés ; les chiffres de la société viennent des dépôts 40-F et 6-K ouverts (static-ccj.cjs), en
// dollars canadiens, convertis au taux de la Banque du Canada du 30 juin 2026 quand un ratio les rapproche du cours.
const FX = 1.4210;
// Montants publiés (millions de CAD) repris des dépôts ouverts ; extraits vérifiés par les needles de static-ccj.cjs.
const P = {
  adjFy25: 1929, adjH126: 899, adjH125: 1029,            // EBITDA ajusté consolidé (non IFRS)
  wecFy25: 780, wecH126: 284, wecH125: 445,              // quote-part de l'EBITDA ajusté de Westinghouse
  wecBook: 2608.370, inkBook: 298.481,                   // participations mises en équivalence au 30 juin 2026
  cashCad: 1112.718, debtCad: 996.750,
  tepco: 115.755,                                       // rachat de 2,871 % de Cigar Lake le 2 juillet 2026 (note 20)
  wecCash100: 268.310, wecDebt100: 48.695 + 4682.928,     // Westinghouse à 100 %, 31 décembre 2025 (note du 40-F)
  inkaiEbitda: 236,                                      // EBITDA de JV Inkai compris dans le segment uranium, 2025
  realQ2Cad: 93.13, realH1Cad: 92.15, realQ2Usd: 67.79, spotQ2: 85.18, purchQ2Cad: 91.40, purchQ2Usd: 66.60,
};
const grp = (n, d = 1) => { const [i, f] = Math.abs(n).toFixed(d).split('.'); return (n < 0 ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (f ? ',' + f : ''); };

function base(c) {
  const { pct, bars, N, close } = c;
  const cmp = c.raw.comparison_bars.data.items[0].results[0].data;
  const idx = d => { const i = bars.findIndex(b => b[0] === d); if (i < 1) throw Error('barre absente ' + d); return i; };
  const bar = d => bars[idx(d)];
  const chg = d => { const i = idx(d); return pct(bars[i][4], bars[i - 1][4]); };
  const gapOf = d => { const i = idx(d); return pct(bars[i][1], bars[i - 1][4]); };
  const dr = (sym, d) => { const row = cmp.find(x => x.symbol === sym); if (!row) throw Error('comparable absent ' + sym); const b = row.bars, i = b.findIndex(x => x[0] === d); if (i < 1) throw Error('barre absente ' + sym + ' ' + d); return pct(b[i][4], b[i - 1][4]); };
  const win = bars.slice(Math.max(0, N - 251), N + 1);
  let hi = -1, lo = 1e9, hiD, loD, hiC = -1, hiCD;
  for (const b of win) { if (b[2] > hi) { hi = b[2]; hiD = b[0]; } if (b[3] < lo) { lo = b[3]; loD = b[0]; } if (b[4] > hiC) { hiC = b[4]; hiCD = b[0]; } }
  if (loD !== '2026-10-23' || hiCD !== '2026-01-28' || hiD !== '2026-01-29') throw Error('bornes annuelles inattendues ' + [loD, hiCD, hiD]);
  const y0 = bars.filter(b => b[0] < '2026-01-01').pop();
  const eve = bar('2025-10-27');
  // Réactions le jour des quatre dernières publications (dates des communiqués 6-K ouverts).
  const pubs = ['2025-11-05', '2026-02-13', '2026-05-05', '2026-07-31'].map(d => ({ d, chg: chg(d), gap: gapOf(d), range: pct(bar(d)[2], bar(d)[3]) }));
  if (!pubs.every(x => x.chg < 0)) throw Error('réactions de publication inattendues');
  const avgVol = (from, n) => { const i = idx(from); return bars.slice(i - n, i).reduce((s, b) => s + b[5], 0) / n; };
  const since = (sym, d) => { if (sym === 'CCJ') return pct(close, bar(d)[4]); const b = cmp.find(x => x.symbol === sym).bars, i = b.findIndex(x => x[0] === d); if (i < 0) throw Error('barre absente ' + sym + ' ' + d); return pct(b[b.length - 1][4], b[i][4]); };
  return { cmp, idx, bar, chg, gapOf, dr, since, hi, hiD, lo, loD, hiC, hiCD, ytd: pct(close, y0[4]), y0, eve, sinceEve: pct(close, eve[4]), pubs, avgVol, fromRecord: Math.abs(pct(close, hiC)) };
}

// Valorisation par parties, en millions de USD : exploitation (EBITDA d'exploitation × multiple − dette + trésorerie),
// participations mises en équivalence à leur valeur comptable, Westinghouse implicite au cours du jour.
function sotp(c) {
  const { G$, marketCap, ev, shares, peerStat } = c;
  const peers = ['CEG', 'VST', 'BWXT', 'GEV', 'TLN'], pv = Object.fromEntries(peers.map(t => [t, peerStat(t, 'enterpriseToEbitda')]));
  const sorted = Object.values(pv).sort((a, b) => a - b), med = sorted[2];
  if (Math.abs(med - c.scn.multiple) > 0.005) throw Error('médiane des pairs inattendue ' + med);
  const M = 1e6, ebitda = G$.ebitda / M, debt = G$.debt / M, cash = G$.cash / M, mcap = marketCap / M, evM = ev / M;
  const wecBook = P.wecBook / FX, inkBook = P.inkBook / FX;
  const adjTtmCad = P.adjFy25 + P.adjH126 - P.adjH125, wecTtmCad = P.wecFy25 + P.wecH126 - P.wecH125;
  const adjTtm = adjTtmCad / FX, wecTtm = wecTtmCad / FX, coreTtm = adjTtm - wecTtm;
  const expl = (m, cut = 0) => m * ebitda * (1 - cut) - debt + cash;
  const perShare = v => v * M / shares;
  // Westinghouse implicite à 100 % : capitalisation − exploitation − JV Inkai, divisé par 0,49. JV Inkai à sa valeur comptable
  // (borne haute pour Westinghouse) ou au même multiple que l'exploitation sur son EBITDA 2025 (borne basse).
  const inkMult = m => m * P.inkaiEbitda / FX;
  const implied100 = (m, inkAtMult = false) => (mcap - expl(m) - (inkAtMult ? inkMult(m) : inkBook)) / 0.49;
  const wecNet = (P.wecDebt100 - P.wecCash100) / FX, wecEb100 = [370 / 0.49, 430 / 0.49];
  const withWarrant = v100 => (v100 - 3500) / 0.8; // valeur avant bon de l'État qui laisse aux actionnaires v100
  const stakeAt = (V, warrant) => 0.49 * (warrant ? V - 0.2 * (V - 17500) : V);
  return { pv, med, ebitda, debt, cash, mcap, evM, wecBook, inkBook, adjTtmCad, wecTtmCad, adjTtm, wecTtm, coreTtm, expl, perShare, implied100, stakeAt,
    evAdj: evM / adjTtm, evStrict: evM / ebitda, pe: mcap / (G$.ni / M),
    explShare: perShare(expl(med)), bookShare: perShare(expl(med) + wecBook + inkBook), bookCutShare: perShare(expl(med, 0.2) + wecBook + inkBook),
    wecBookShare: perShare(wecBook), impMed: implied100(med), impCeg: implied100(pv.CEG), impLow: implied100(med, true), impMedW: withWarrant(implied100(med)),
    wecNet, wecEb100, evWecMultHi: (implied100(med) + wecNet) / wecEb100[0], evWecMultLo: (implied100(med) + wecNet) / wecEb100[1],
    netCashPro: (P.cashCad - P.debtCad - P.tepco) / FX,
    pressW: stakeAt(50000, true), pressNw: stakeAt(50000, false) };
}


module.exports = (c, save) => {
  const { fr, usd, pct, sgn, close, prev, bars, N, tech, st, M, G$, marketCap, ev, scn, lv, entry, stop, tp1, tp2, abandon, cap, raw, dfr, nb } = c;
  const B = base(c), V = sotp(c);
  const ev0 = ((raw.earnings_risk || {}).events || []).find(e => e.symbol === 'CCJ');
  if (!ev0 || ev0.report_date !== '2026-10-30') throw Error('date de résultats inattendue ' + JSON.stringify(ev0));
  const trig = (Math.floor(entry * 100 + 1e-9) + 1) / 100, trigTxt = usd(trig);
  const stopOrd = Math.floor(stop * 100 + 1e-9) / 100, stopTxt = usd(stopOrd);
  const abTxt = usd(abandon);
  const c26 = pct(close, prev), vol26 = bars[N][5];
  const r21 = M.SRUUF.return21d, ura21 = M.URA.return21d, ccj21 = pct(close, bars[N - 21][4]);
  const F = '2026-02-09', sF = t => B.since(t, F);
  const qi = c.extra.quote.data.items, si = qi.find(x => x.type === 'instrument_short_interest');
  if (!si) throw Error('relevé FINRA absent');
  const siF = si.shortInterest / st.floatShares * 100;
  const out = {
    meta: { lang: 'fr', dir: 'ltr', level: 'intermediate', tags: ['us', 'energy', 'commodity', 'mining', 'materials', 'earnings', 'trade-idea'], grade: 'C', date: '2026-10-27', dateDisplay: '27 octobre 2026', version: 3, status: 'watch', assetType: 'stock', levelsCloseDate: c.REF,
      description: 'Cameco à ' + usd(close) + ', ' + fr(B.fromRecord, 0) + ' % sous son record de janvier, à trois séances de ses résultats du 30 octobre. Le marché décote les actions de l’uranium, la marge se comprime, Westinghouse n’est pas bon marché. Rien avant la publication, puis seulement une clôture à ' + trigTxt + ' ou plus.',
      ogDescription: 'CCJ à ' + usd(close) + ' : ' + sgn(sF('CCJ'), 1) + ' depuis le 9 février, l’uranium physique ' + sgn(sF('SRUUF'), 1) + '. Résultats le 30 octobre ; rien à acheter avant, déclencheur à ' + trigTxt + '.',
      lastMcpRefresh: raw.status.captured_at, levelsVerifiedAt: raw.status.captured_at,
      statusHistory: [...(c.archive.meta.statusHistory || []), { at: raw.status.captured_at, from: c.archive.meta.status || 'expired', to: 'watch', note: 'refonte du 27 octobre 2026 sur la clôture du 26 : plan de surveillance, activation après les résultats du 30 octobre sur une clôture à ' + trigTxt + ' ou plus, aucune entrée', close }] },
    header: { ticker: 'CCJ', name: 'Cameco Corporation', exchange: 'NYSE', sector: 'Uranium, combustible nucléaire et Westinghouse', price: close, changePct: c26,
      badges: [{ text: 'SURVEILLER — RIEN AVANT LE 30 OCTOBRE', color: 'blue' }, { text: 'Actions de l’uranium décotées', color: 'amber' }, { text: 'Westinghouse : introduction en Bourse confidentielle', color: 'purple' }],
      metrics: { marketCap: fr(marketCap / 1e9, 1) + ' Md$', volume: fr(vol26 / 1e6, 2) + ' M', range52w: usd(B.lo) + ' – ' + usd(B.hi), shortInterest: fr(siF, 1) + ' % du flottant', evEbitda: fr(V.evAdj, 1) + '× ajusté' }, halalStatus: 'unknown' },
  };
  out.verdict = { score: 41, conviction: 'Low', bias: 'Neutral',
    confidence: 'Note C (score additif de 41 sur 100) : la grille crédite des actifs miniers rares, un bilan sans dette nette et la participation dans Westinghouse, mais retranche la technique (plus bas annuel le 23 octobre), le calendrier (résultats le 30 octobre, arrêt prolongé de Key Lake) et le programme d’émission d’actions encore ouvert. Score éditorial non prédictif. Chiffres de la société lus dans les dépôts 40-F et 6-K, en dollars canadiens, convertis au taux de la Banque du Canada du 30 juin 2026 ; niveaux lus sur la clôture certifiée du 26 octobre.',
    summary: 'Cameco publie ses résultats du troisième trimestre vendredi 30 octobre, avant l’ouverture de New York ; la société a confirmé la date le 21 octobre. Le titre y arrive à ' + usd(close) + ', ' + fr(B.fromRecord, 0) + ' % sous sa clôture record du 28 janvier (' + usd(B.hiC) + '), une séance après un plus bas annuel à ' + usd(B.lo) + '. Le marché décote les actions de l’uranium, pas la livre : depuis le 9 février, Cameco fait ' + sgn(sF('CCJ'), 1) + ', le panier URNM ' + sgn(sF('URNM'), 1) + ', la fiducie d’uranium physique Sprott ' + sgn(sF('SRUUF'), 1) + '. Les comptes n’aident pas : le prix réalisé, 93,13 $ CA la livre au deuxième trimestre, est déjà dans la prévision, mais la marge se comprime, avec quatre fois plus de livres achetées et revendues presque sans gain. Westinghouse n’est pas une aubaine cachée : dans l’hypothèse centrale de la fiche, le cours lui prête déjà, dette comprise, ' + fr(V.evWecMultLo, 0) + ' à ' + fr(V.evWecMultHi, 0) + ' fois sa prévision d’EBITDA 2026. Rien à acheter avant le 30 octobre, puis seulement sur une clôture à ' + trigTxt + ' ou plus.',
    whyBuy: [
      'Le prix de l’uranium à long terme a fini juin à 95,50 $ US la livre, proche de son plus haut depuis 2011 en dollars constants selon la société ; la prévision 2026 a été relevée en juillet : prix moyen réalisé de 91 à 96 $ CA la livre (85 à 89 auparavant), chiffre d’affaires de 3 320 à 3 570 M$ CA.',
      'Le carnet se réindexe sur le marché : contrat de neuf ans signé avec l’Inde en mars, près de 22 millions de livres de 2027 à 2035, environ 2,6 Md$ CA, à prix liés au marché. Selon la table de sensibilité de la société, le prix réalisé passe de 66–67 $ US en 2026 à 69–74 $ US en 2027 pour un comptant de 80 à 100 $ US.',
      'Westinghouse, détenue à 49 %, accumule les engagements publics : jusqu’à 17,5 Md$ US de prêts fédéraux conditionnels (23 juin), un cadre coréen de 120 Md$ US qui prévoit six AP1000 (30 septembre) et un prospectus d’introduction en Bourse déposé à titre confidentiel (31 juillet). La société attend pour 2026 une quote-part d’EBITDA ajusté de 370 à 430 M$ US.',
      'Un bilan sans dette nette : ' + grp(P.cashCad) + ' M$ CA de trésorerie contre ' + grp(P.debtCad) + ' M$ CA d’emprunts au 30 juin, écart ramené à zéro environ par le rachat de 115,8 M$ CA de la part de TEPCO dans Cigar Lake le 2 juillet ; ligne de crédit de 1,0 Md$ CA non tirée.'],
    whyAvoid: [
      'La hausse de l’uranium n’arrivera pas cette année dans les comptes : 67,79 $ US la livre réalisée au deuxième trimestre contre 85,18 $ US au comptant, et la société ne prévoit que 66 à 67 $ US pour 2026, que le comptant soit à 80 ou à 100 $ US.',
      'La marge de l’uranium se comprime : 2,8 millions de livres achetées au deuxième trimestre (0,7 un an plus tôt) à 91,40 $ CA, presque leur prix de revente (93,13 $ CA) ; volume vendu −18 % ; coût unitaire +26 % sur le trimestre, +11 % sur le semestre, avec l’arrêt de Cigar Lake avancé au deuxième trimestre. Bénéfice avant impôt du segment −40 % sur le trimestre.',
      'L’arrêt annuel de Key Lake commence au troisième trimestre et durera plus longtemps que d’habitude pour des travaux ; la société signale elle-même un risque de retard. Les quatre dernières publications ont fait clôturer le titre en baisse le jour même (' + B.pubs.map(x => sgn(x.chg, 1)).join(', ') + ').',
      'Le marché décote les actions de l’uranium en bloc : depuis le 9 février, Cameco ' + sgn(sF('CCJ'), 1) + ', URA ' + sgn(sF('URA'), 1) + ', URNM ' + sgn(sF('URNM'), 1) + ', quand l’uranium physique fait ' + sgn(sF('SRUUF'), 1) + ' et Constellation ' + sgn(sF('CEG'), 1) + ' ; corrélation de ' + fr(M.URNM.correlation, 2) + ' avec URNM.',
      'Le prix reste exigeant : ' + fr(V.evAdj, 1) + ' fois l’EBITDA ajusté, sous la médiane de cinq pairs rentables (' + fr(V.med, 1) + ' fois) mais près du double de Constellation (' + fr(V.pv.CEG, 1) + ' fois) et plus du double de Vistra (' + fr(V.pv.VST, 1) + ' fois) ; ' + fr(V.evStrict, 0) + ' fois sur l’EBITDA d’exploitation seul. S’y ajoute un programme d’émission d’actions de 500 M$ US ouvert jusqu’au 12 décembre.'],
    controlChecklist: [
      { label: 'Historique de cours', status: 'pass', statusLabel: 'Trois cents séances certifiées', evidence: 'Série quotidienne certifiée au 26 octobre ; cinq séries de comparables reconstruites avant la collecte (séances de juillet manquantes).', action: 'Niveaux et indicateurs calculés sur cette seule série.' },
      { label: 'Comptes et devise', status: 'warn', statusLabel: 'Émetteur canadien, IFRS, dollars canadiens', evidence: 'Chiffres lus dans le 40-F de l’exercice 2025 et le 6-K du 31 juillet 2026 ; flux et bilan convertis au taux de la Banque du Canada du 30 juin 2026 (1,4210) ; la société bâtit sa prévision sur 1,35.', action: 'Ne jamais rapprocher une capitalisation en USD de chiffres en CAD non convertis.' },
      { label: 'Point d’entrée', status: 'fail', statusLabel: 'Plus bas annuel, résultats dans trois séances', evidence: 'Clôture à ' + usd(close) + ' (' + sgn(c26, 1) + '), sous les moyennes à vingt (' + usd(tech.ema20) + '), cinquante (' + usd(tech.ema50) + ') et deux cents séances (' + usd(tech.ema200) + '), RSI à ' + fr(tech.rsi14, 0) + '.', action: 'Aucun achat avant les résultats du 30 octobre ; ensuite seulement sur une clôture à ' + trigTxt + ' ou plus.' }] };
  out.timeline = {
    title: 'Ce qui peut bouger Cameco', from: '2026-10-27', to: '2026-11-16',
    keyWindow: { from: '2026-10-30', to: '2026-10-30', label: 'Fenêtre clé · ven. 13h00 (conférence) → 21h00 (clôture)' },
    events: [
      { date: '2026-10-28', category: 'macro', impact: 'strong', label: 'Fed', detail: '19 h, taux', icon: 'bank', source: 'data/scheduled-events.json (fomc), calendrier de la Réserve fédérale', href: '#macro' },
      { date: '2026-10-28', category: 'earnings', impact: 'medium', label: 'GE Vernova', detail: 'électricité de l’IA', icon: 'bolt', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: '2026-10-30', category: 'earnings', impact: 'strong', label: 'Résultats Cameco', detail: 'avant l’ouverture', icon: 'company', source: 'communiqué de Cameco du 21 octobre 2026 (date et conférence confirmées) et calendrier de résultats collecté', href: '#earnings' },
      { date: '2026-11-03', category: 'earnings', impact: 'medium', label: 'NexGen, Denison', detail: 'uranium', icon: 'company', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: '2026-11-04', category: 'earnings', impact: 'medium', label: 'Brookfield Renewable', detail: 'Westinghouse', icon: 'company', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: '2026-11-06', category: 'macro', impact: 'strong', label: 'Emploi US', detail: '14 h 30, taux', icon: 'data', source: 'daily/20261022/primary-reference.json (bls_empsit), calendrier du BLS' },
      { date: '2026-11-10', category: 'macro', impact: 'strong', label: 'CPI US', detail: 'taux', icon: 'data', source: 'data/scheduled-events.json (cpi), calendrier du BLS' },
      { date: '2026-11-13', category: 'plan', impact: 'strong', label: 'Fin du plan', detail: 'dernière activation', icon: 'hourglass', source: 'plan de la fiche', href: '#trade' },
    ],
    chains: [
      { title: 'Si Westinghouse fixe son prix', steps: [{ label: 'Prospectus public', category: 'earnings', icon: 'company' }, { label: 'Valeur des 49 %', category: 'earnings', icon: 'coin' }, { label: 'Cameco', category: 'earnings', icon: 'company' }] },
      { title: 'Si la marge se comprime encore', steps: [{ label: 'Livres achetées', category: 'geo', icon: 'magnet', tone: 'up' }, { label: 'Marge uranium', category: 'earnings', icon: 'company', tone: 'down' }, { label: 'Cameco', category: 'earnings', icon: 'company', tone: 'down' }] },
    ],
    note: 'Rien avant le 30 octobre ; une clôture sous ' + abTxt + ' abandonne le plan. Prospectus de Westinghouse sans date : hors frise. « ? » : une seule source. Clôture à 21 h jusqu’au 30, 22 h ensuite.',
  };
  return save(Object.assign(out, require('./compose-ccj-body.cjs')(c, { B, V, P, FX, grp, trig, trigTxt, stopOrd, stopTxt, abTxt, c26, vol26, r21, ura21, ccj21, siF, si, sF })));
};

module.exports.scenarios = c => {
  const trig = (Math.floor(c.entry * 100 + 1e-9) + 1) / 100;
  return [
    { scenario: 'bullish', trigger: 'Le 30 octobre, prix réalisé maintenu dans la prévision ou au-dessus, coût unitaire en repli vers la prévision de 63 à 67,50 $ CA, Key Lake redémarré à temps, second semestre plus fort confirmé pour Westinghouse.', firstOrder: 'Le titre clôture à ' + c.usd(trig) + ' ou plus, au-dessus du plus haut du 16 octobre, puis vise ' + c.usd(c.tp1) + ' et ' + c.usd(c.tp2) + '.', secondOrder: 'Les développeurs d’uranium (NexGen, Denison) suivent, et Brookfield Renewable reprend le récit de Westinghouse le 4 novembre.', confirmation: 'Une clôture à ' + c.usd(trig) + ' ou plus après la publication, sur un volume supérieur à la moyenne.', contradiction: 'Une ouverture en hausse effacée dans la séance, comme le 5 mai et le 31 juillet.' },
    { scenario: 'mixed', trigger: 'Résultats conformes, prévisions maintenues, rien de neuf sur l’introduction en Bourse de Westinghouse.', firstOrder: 'Le titre reste entre ' + c.usd(c.abandon) + ' et ' + c.usd(trig) + ', au rythme des paniers de l’uranium.', secondOrder: 'La fiducie d’uranium physique et les paniers de mineurs dictent le mouvement plus que la société.', confirmation: 'Plusieurs clôtures dans cette bande après le 30 octobre.', contradiction: 'Une sortie franche de la bande, d’un côté ou de l’autre.' },
    { scenario: 'bearish', trigger: 'Production 2026 abaissée ou arrêt de Key Lake prolongé, coût unitaire encore en hausse, EBITDA de Westinghouse revu sous 370 M$ US ; ou nouvelle décote des actions de l’uranium.', firstOrder: 'Clôture sous ' + c.usd(c.abandon) + ', nouveau plus bas annuel ; le support suivant sur les barres est le plus bas du 20 août 2025.', secondOrder: 'Les développeurs sans production (Denison, NexGen) baissent plus vite que Cameco, les services publics réglementés servent de refuge.', confirmation: 'Une clôture sous ' + c.usd(c.abandon) + ' sur un volume supérieur à la moyenne.', contradiction: 'Un plus bas en séance sans clôture dessous, suivi d’une reprise le jour même.' }];
};

module.exports.contradictions = c => {
  const B = base(c), F = '2026-02-09';
  return [
    'L’uranium baisse peu, ses actions beaucoup : depuis le 9 février, la fiducie d’uranium physique Sprott fait ' + c.sgn(B.since('SRUUF', F), 1) + ', les paniers URA et URNM ' + c.sgn(B.since('URA', F), 1) + ' et ' + c.sgn(B.since('URNM', F), 1) + ', Cameco ' + c.sgn(B.since('CCJ', F), 1) + '. Sur vingt et une séances, la fiducie est stable (' + c.sgn(c.M.SRUUF.return21d, 1) + ') quand Cameco perd ' + c.fr(Math.abs(c.pct(c.close, c.bars[c.N - 21][4])), 1) + ' %.',
    'Les bonnes nouvelles de Westinghouse n’ont pas porté : le titre a fait ' + c.sgn(B.chg('2026-09-30'), 1) + ' le jour du cadre coréen de 120 Md$ US et ' + c.sgn(B.chg('2026-10-01'), 1) + ' le lendemain ; à ' + c.usd(c.close) + ', il est sous sa clôture du 27 octobre 2025 (' + c.usd(B.eve[4]) + '), veille de l’accord avec Washington.',
    'Les exploitants nucléaires résistent mieux que l’uranium : depuis le 9 février, Constellation fait ' + c.sgn(B.since('CEG', F), 1) + ' et Vistra ' + c.sgn(B.since('VST', F), 1) + ', Duke ' + c.sgn(B.since('DUK', F), 1) + '. Cameco suit les paniers de l’uranium (corrélation de ' + c.fr(c.M.URNM.correlation, 2) + ' avec URNM) bien plus que l’électricité de l’IA (' + c.fr(c.M.CEG.correlation, 2) + ' avec Constellation).',
    'Le prix réalisé de l’uranium progresse de 15 % sur un an en dollars canadiens au deuxième trimestre, mais le bénéfice avant impôt du segment recule de 40 % : volume vendu −18 %, quatre fois plus de livres achetées et revendues presque sans marge, arrêt de Cigar Lake avancé au deuxième trimestre.'];
};

module.exports.missingData = c => [
  'Troisième trimestre 2026 non publié : résultats le 30 octobre avant l’ouverture ; les agrégats s’arrêtent au 30 juin.',
  'Ventes au fil du marché du 30 juillet au 26 octobre non observables : la société ne les publie qu’avec les comptes de la période, au plus tôt le 30 octobre.',
  'Aucun mouvement implicite des options : marché fermé à la collecte, aucune position ouverte exploitable sur la chaîne servie.',
  'Transactions d’initiés non couvertes : les dirigeants de Cameco déclarent au registre canadien SEDI, pas par formulaires 4.',
  'Valorisation de Westinghouse pour son introduction en Bourse connue par la presse (Bloomberg, 18 septembre), sans prospectus public sur EDGAR au 27 octobre ; le calcul inverse dépend fortement des multiples retenus.',
  'Prix au comptant de l’uranium après le 30 juin non lu dans un dépôt : seule la fiducie d’uranium physique Sprott sert de repère.',
  'Prêts fédéraux et cadre coréen conditionnels ou non contraignants : aucun montant n’entre dans les agrégats.',
  'Multiples des pairs relevés en instantané le 27 octobre, sans historique daté et sans producteur d’uranium rentable coté.'];

module.exports.base = base;
module.exports.sotp = sotp;
module.exports.P = P;
