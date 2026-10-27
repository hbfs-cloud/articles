'use strict';
// Rédaction du dossier Applied Digital (APLD) du 27 octobre 2026. Toute valeur de marché est recalculée depuis les barres
// certifiées et les artefacts collectés ; les chiffres d'entreprise viennent des dépôts SEC ouverts (static-apld.cjs) ; les
// causes sectorielles de la chute d'octobre viennent de la presse financière citée.
// Révision du 27 octobre (un seul passage, mode rapide) : corrections des relectures QA senior, contradicteur et war room
// (revision/review-*.json), appliquées après vérification dans les pièces ; journal dans revision/review-log.json.

// Repères communs, recalculés à chaque construction depuis les barres certifiées.
function base(c) {
  const { pct, bars, N, close } = c;
  const cmp = c.raw.comparison_bars.data.items[0].results[0].data;
  const bar = d => { const b = bars.find(x => x[0] === d); if (!b) throw Error('barre absente ' + d); return b; };
  const idx = d => { const i = bars.findIndex(x => x[0] === d); if (i < 0) throw Error('barre absente ' + d); return i; };
  const chg = d => { const i = bars.findIndex(b => b[0] === d); if (i < 1) throw Error('variation absente ' + d); return pct(bars[i][4], bars[i - 1][4]); };
  const dr = (sym, d) => { const row = cmp.find(x => x.symbol === sym); if (!row) throw Error('comparable absent ' + sym); const b = row.bars, i = b.findIndex(x => x[0] === d); if (i < 1) throw Error('barre absente ' + sym + ' ' + d); return pct(b[i][4], b[i - 1][4]); };
  // Variation d'un comparable entre la clôture d'une date et la dernière clôture.
  const since = (sym, d) => { const row = cmp.find(x => x.symbol === sym); const b = row.bars, i = b.findIndex(x => x[0] === d); if (i < 0) throw Error('barre absente ' + sym + ' ' + d); return pct(b.at(-1)[4], b[i][4]); };
  const win = bars.slice(Math.max(0, N - 251), N + 1);
  let hi = -1, lo = 1e9, hiD, loD;
  for (const b of win) { if (b[2] > hi) { hi = b[2]; hiD = b[0]; } if (b[3] < lo) { lo = b[3]; loD = b[0]; } }
  if (loD !== c.REF) throw Error('plus bas annuel inattendu ' + loD);
  const med = a => { const v = [...a].sort((x, y) => x - y); return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2; };
  const avgVol = (from, n) => { const i = bars.findIndex(b => b[0] === from); return bars.slice(i - n, i).reduce((s, b) => s + b[5], 0) / n; };
  const c1006 = bar('2026-10-06')[4];
  // Séances entre les deux plus bas (16 et 26 octobre), comptées sur la série certifiée.
  const lowGap = idx(c.REF) - idx('2026-10-16');
  return { cmp, bar, idx, chg, dr, since, hi, hiD, lo, loD, med, avgVol, c1006, lowGap, fromHi: Math.abs(pct(close, hi)), since1006: pct(close, c1006) };
}

// Prochaine publication : bloc calendrier de l'instrument (une seule source), le calendrier collecté de quatorze jours
// étant vide pour Applied Digital. Date non confirmée par la société.
function earningsDate(c) {
  const ev = ((c.raw.earnings_risk || {}).events || []).find(e => e.symbol === 'APLD');
  if (ev) return { date: ev.report_date, source: 'calendrier de résultats collecté' };
  const cal = (((c.extra || {}).quote || {}).data || { items: [] }).items.find(x => x.type === 'instrument_calendar');
  if (cal && /^\d{4}-\d{2}-\d{2}/.test(cal.nextEarningsDate || '')) return { date: cal.nextEarningsDate.slice(0, 10), last: (cal.lastEarningsDate || '').slice(0, 10), source: 'bloc calendrier de l’instrument (' + cal.earningsCalendarSource + ')' };
  return null;
}

// Chiffres d'entreprise lus dans les dépôts ouverts (M$ sauf mention) ; chacun est vérifié par un extrait exigé.
const F = { rev: 341.875, rent: 65.8, fit: 183.5, recov: 13.3, hpc: 262.6, hpcProfit: 33.4, mining: 37.8, miningProfit: 13.3, gpu: 23.0, chrono: 41.482,
  intExp: 77.383, intInc: 35.821, capInt: 35.7, intPaid: 242.852, deriv: 49.511, invest: 11.352, bwWarrant: 56.1, bwStock: 11.4, prefDerivGain: 6.6,
  opLoss: 62.379, sbc: 66.499, sbcAdj: 59.391, dna: 41.912, taxRsu: 99.413, compShares: 4730140, gConvQ: 4453252,
  disc: 16.054, nlCommon: 237.082, nlCont: 221.0, adjEbitda: 64.4, adjNl: 4.1, noi: 58.8, pik: 60.051, sbcUp: 51.7,
  gw: 1.41, backlog: 36, backlogRen: 86, live: 250, liveQ1: 175, live2026: 300,
  notes2030: 2350, notes6750: 2150, notes7000: 1590, conv: 450, revolver: 82.39, other: 99.215, finCosts: 345.013, e1: 56.373,
  r2030: 9.25, r6750: 6.75, r7000: 7.0, rConv: 2.75,
  seriesGShares: 283250, seriesGGross: 275.0, seriesGPostShares: 5.2, pepaCommit: 2.0, gDrawn: 1.165, gRemain: 835, gFloor0: 34.0, gFloorMin: 4.48, gPut: 150,
  macqRate: 12.75, macqMax: 16.75, macqMult: 1.80, macqInvested: 1.825, macqCommonPct: 13.5,
  warrantsM: 28.1, warrantsAvgPx: 8.61, convSharesM: 46.1, rsuM: 15.2, cwWarr: 21455832, cwAssigned: 13062521, cwHeld: 8393611, custA: 56, custB: 21, custC: 11,
  zhangSh: 300000, zhangPx: 18.86, cumSh: 55803, cumPx: 18.04, notSh: 31250, notPx: 21.84, cumFamily: 17590238, cumIndirect2: 12798, cumDirect: 5874453, zhangAfter: 2839227, zhangRsu: 875000, cumRsu: 1500000,
  cumSaleSh: 165000, cumSalePx: 36.42, yrSellSh: 571871, yrSellUsd: 19.64162045, yrSellMin: 21.84, yrSellMax: 38.57,
  posasr: 53087689, posasrSold: 49696777, restricted: 728.0, atmAuth: 200, atmGross: 196.4, atmShares: 15.3 };

// Sources de marché sans vocabulaire d'outillage : même adresse et même date que le gabarit commun.
const mkt = (c, name) => ({ name: 'Données de marché datées : ' + name, url: c.evidenceUrl, date: '2026-10-27' });

module.exports = (c, save) => {
  const { fr, usd, pct, sgn, close, prev, bars, N, tech, st, M, G$, g, marketCap, ev, scn, lv, entry, stop, tp1, tp2, abandon, cap, raw, dfr, nb, peerStat } = c;
  // Les sources de marché ajoutées ensuite par le gabarit (propagation, performance) reprennent ce libellé sans outillage.
  c.market = name => mkt(c, name);
  const B = base(c), { chg, dr, med } = B;
  const E = earningsDate(c);
  if (!E || E.date !== '2027-01-06') throw Error('date de résultats inattendue ' + JSON.stringify(E));
  const trig = (Math.floor(entry * 100 + 1e-9) + 1) / 100, trigTxt = usd(trig);
  const stopOrd = Math.floor(stop * 100 + 1e-9) / 100, stopTxt = usd(stopOrd);
  const abTxt = usd(abandon);
  const c26 = pct(close, prev), lo26 = bars[N][3], hi26 = bars[N][2], vol26 = bars[N][5], avgVol26 = B.avgVol(bars[N][0], 20);
  const evRev = ev / G$.rev;
  const debtFin = g.notesLong.value + g.notesCur.value + g.flCur.value + g.flNon.value;
  const principal = F.notes2030 + F.notes6750 + F.notes7000 + F.conv + F.revolver + F.other;
  const intNet = F.intExp - F.intInc;
  // Coupons des quatre séries d'obligations en régime plein, par trimestre, et coût complet avec les dividendes de Macquarie.
  const couponQ = (F.notes2030 * F.r2030 + F.notes6750 * F.r6750 + F.notes7000 * F.r7000 + F.conv * F.rConv) / 100 / 4;
  const finCostQ = couponQ + F.pik;
  const insiderUsd = F.zhangSh * F.zhangPx + F.cumSh * F.cumPx, insiderSh = F.zhangSh + F.cumSh, avgIns = insiderUsd / insiderSh;
  const potentialM = F.warrantsM + F.convSharesM + F.rsuM, potentialPct = potentialM * 1e6 / c.shares * 100;
  // Ligne de série G restante : actions créées à 95 % du cours de clôture, puis au plancher minimal de 4,48 $.
  const gAtClose = F.gRemain / (0.95 * close), gAtFloor = F.gRemain / F.gFloorMin;
  const gAtClosePct = gAtClose * 1e6 / c.shares * 100, gAtFloorPct = gAtFloor * 1e6 / c.shares * 100;
  const peers = ['DLR', 'IRM', 'CORZ', 'IREN', 'CIFR', 'WULF', 'CRWV', 'NBIS'];
  const pv = Object.fromEntries(peers.map(t => [t, peerStat(t, 'enterpriseToRevenue')]));
  const reitMed = med([pv.DLR, pv.IRM]); if (Math.abs(reitMed - 9.9) > 0.05) throw Error('médiane des foncières inattendue ' + reitMed);
  const hostMed = med([pv.CORZ, pv.IREN]);
  const perShare = (m, revBase) => (m * revBase - G$.debt + G$.cash) / c.shares;
  // Variantes : dette au principal (frais d'émission réintégrés) et préférentielles E-1 ; puis préférence minimale de Macquarie.
  const addPrin = (F.finCosts + F.e1) * 1e6, macqPref = F.macqMult * F.macqInvested * 1e9;
  const evPrin = ev + addPrin, evRevPrin = evPrin / G$.rev;
  const perSharePrin = m => (m * G$.rev - G$.debt - addPrin + G$.cash) / c.shares;
  const perSharePref = m => (m * G$.rev - G$.debt - addPrin - (macqPref - g.rnci.value) + G$.cash) / c.shares;
  const q = (((c.extra || {}).quote || {}).data || { items: [] }).items, fi = q.find(x => x.type === 'instrument_short_interest');
  if (!fi || !fi.shortInterest) throw Error('relevé FINRA absent');
  const siF = fi.shortInterest / st.floatShares * 100, finraD = fi.date.slice(0, 10), siPrev = st.sharesShort;
  const k = { B, E, trig, trigTxt, stopOrd, stopTxt, abTxt, c26, lo26, hi26, vol26, avgVol26, evRev, debtFin, principal, intNet, couponQ, finCostQ, insiderUsd, insiderSh, avgIns, potentialM, potentialPct, gAtClose, gAtFloor, gAtClosePct, gAtFloorPct, pv, reitMed, hostMed, perShare, evPrin, evRevPrin, perSharePrin, perSharePref, macqPref, fi, siF, finraD, siPrev, eDate: dfr(E.date) + ' 2027', mkt: name => mkt(c, name) };
  const r21 = c.ret(21), c1008 = chg('2026-10-08');
  const prevHist = (c.archive.meta.statusHistory || []);
  const out = {
    meta: { lang: 'fr', dir: 'ltr', level: 'intermediate', tags: ['us', 'ai', 'tech', 'speculative', 'trade-idea'], grade: 'C', date: '2026-10-27', dateDisplay: '27 octobre 2026', version: 3, status: 'watch', assetType: 'stock', levelsCloseDate: c.REF,
      description: 'Applied Digital a perdu ' + fr(Math.abs(B.since1006), 0) + ' % depuis la veille de ses résultats : financement plus cher que les loyers, crédit des néoclouds en question. Achat seulement sur une clôture à ' + trigTxt + ' ou plus ; une clôture sous ' + abTxt + ' abandonne le plan.',
      ogDescription: 'Applied Digital à ' + usd(close) + ' : 1,41 GW loués, mais un financement qui coûte plus que les loyers. Achat seulement sur une clôture à ' + trigTxt + ' ou plus.',
      lastMcpRefresh: raw.status.captured_at, levelsVerifiedAt: raw.status.captured_at,
      statusHistory: [...prevHist, { at: raw.status.captured_at, from: 'no-trade', to: 'watch', note: 'refonte du 27 octobre 2026 sur la clôture du 26 octobre : plan de surveillance, activation sur une clôture à ' + trigTxt + ' ou plus au plus tard le 16 novembre, aucune entrée', close }] },
    header: { ticker: 'APLD', name: 'Applied Digital Corporation', exchange: 'NASDAQ', sector: 'Centres de données loués pour l’intelligence artificielle', price: close, changePct: c26,
      badges: [{ text: 'SURVEILLER — ACHAT SUR CLÔTURE À ' + trigTxt.toUpperCase() + ' OU PLUS', color: 'blue' }, { text: 'Financement plus cher que les loyers', color: 'red' }, { text: 'Président acheteur, initiés vendeurs nets sur un an', color: 'amber' }],
      metrics: { marketCap: fr(marketCap / 1e9, 2) + ' Md$', volume: fr(vol26 / 1e6, 1) + ' M', evRevenue: fr(evRev, 1) + '×' }, halalStatus: 'unknown' },
  };
  out.verdict = { score: 32, conviction: 'Low', bias: 'Neutral',
    confidence: 'Note C (score additif de 32 sur 100) : la grille crédite un carnet de baux signé avec des locataires solides, mais retranche une technique en chute, un financement plus cher que les loyers et une capacité d’émission presque sans limite. Score éditorial non prédictif. Chiffres d’entreprise lus dans les dépôts SEC et les données XBRL officielles ; niveaux lus sur la clôture certifiée du 26 octobre.',
    summary: 'Applied Digital construit des centres de données pour l’intelligence artificielle et les loue pour de longues durées. Le carnet est réel : ' + fr(F.gw, 2) + ' GW loués sur cinq campus à CoreWeave et à de grands clouds de qualité investissement non nommés, environ ' + F.backlog + ' Md$ de loyers sur les durées de base. La facture du financement aussi. Au trimestre clos le 31 août, ' + fr(F.rent, 1) + ' M$ de loyers de base face à ' + fr(F.intExp, 1) + ' M$ d’intérêts en charges (' + fr(intNet, 1) + ' M$ nets des intérêts perçus) ; en régime plein, coupons et dividendes en nature dus à Macquarie approchent ' + fr(finCostQ, 0) + ' M$ par trimestre. Il reste ' + fr(F.gRemain, 0) + ' M$ à tirer sur la ligne d’actions préférentielles de série G. Depuis la veille de la publication, le titre a perdu ' + fr(Math.abs(B.since1006), 1) + ' %, à ' + usd(close) + ', moins que Cipher ou CoreWeave ; tout le groupe des hébergeurs de calcul a chuté sur fond de crédit plus rare. Le président a acheté ' + fr(F.zhangSh * F.zhangPx / 1e6, 2) + ' M$ d’actions le 16 octobre, mais les initiés restent vendeurs nets sur un an. Pas de résultats avant le ' + k.eDate + ', date non confirmée par la société. Achat seulement sur une clôture à ' + trigTxt + ' ou plus ; une clôture sous ' + abTxt + ' abandonne le plan.',
    whyBuy: [
      'Un carnet de baux rare : ' + fr(F.gw, 2) + ' GW loués sur cinq campus, environ ' + F.backlog + ' Md$ de loyers sur les durées de base (' + F.backlogRen + ' Md$ avec les renouvellements) ; ' + F.liveQ1 + ' MW en service au 31 août, ' + F.live + ' MW au 1er octobre, ' + F.live2026 + ' MW visés fin 2026 dans le Dakota du Nord.',
      'Le trimestre n’a pas déclenché la chute : le 8 octobre, au lendemain de la publication, le titre a fait ' + sgn(c1008, 1) + ' quand Cipher faisait ' + sgn(dr('CIFR', '2026-10-08'), 1) + ', IREN ' + sgn(dr('IREN', '2026-10-08'), 1) + ' et CoreWeave ' + sgn(dr('CRWV', '2026-10-08'), 1) + '. Depuis la veille de la publication, Applied Digital fait ' + sgn(B.since1006, 1) + ', Cipher ' + sgn(B.since('CIFR', '2026-10-06'), 1) + ', CoreWeave ' + sgn(B.since('CRWV', '2026-10-06'), 1) + '.',
      'Le président a acheté : Jason Zhang, ' + nb(F.zhangSh) + ' actions le 16 octobre à ' + usd(F.zhangPx) + ' en moyenne, soit ' + fr(F.zhangSh * F.zhangPx / 1e6, 2) + ' M$ et ' + fr(F.zhangSh / (F.zhangAfter - F.zhangSh) * 100, 1) + ' % de sa ligne. Wes Cummins, directeur général, a ajouté ' + nb(F.cumSh) + ' actions, après en avoir vendu ' + nb(F.cumSaleSh) + ' à ' + usd(F.cumSalePx) + ' en janvier.',
      'Le trimestre dégage un résultat d’exploitation positif hors éléments non monétaires : ' + fr(F.adjEbitda, 1) + ' M$ d’EBITDA ajusté (définition de la société, hors ChronoScale et hors ' + fr(F.sbcAdj, 1) + ' M$ de rémunérations en actions) et ' + fr(F.noi, 1) + ' M$ de revenu net d’exploitation.',
      'La trésorerie tient les chantiers : ' + fr(G$.cash / 1e9, 2) + ' Md$ disponibles au 31 août et ' + fr(F.restricted, 1) + ' M$ de trésorerie affectée, faite de réserves pour le service de la dette pendant la construction et de lettres de crédit.'],
    whyAvoid: [
      'Le financement coûte plus que les loyers : ' + fr(F.intExp, 1) + ' M$ d’intérêts en charges et ' + fr(F.capInt, 1) + ' M$ incorporés aux chantiers au trimestre, pour ' + fr(F.rent, 1) + ' M$ de loyers de base ; ' + fr(F.intInc, 1) + ' M$ d’intérêts perçus ramènent la charge nette à ' + fr(intNet, 1) + ' M$. En régime plein, les coupons des obligations font ' + fr(couponQ, 1) + ' M$ par trimestre, ' + fr(finCostQ, 0) + ' M$ avec les dividendes de Macquarie, contre ' + fr(F.noi, 1) + ' M$ de revenu net d’exploitation.',
      'Macquarie passe avant l’actionnaire : ' + fr(g.rnci.value / 1e9, 2) + ' Md$ de parts préférentielles à ' + fr(F.macqRate, 2) + ' % par an capitalisés (jusqu’à ' + fr(F.macqMax, 2) + ' %), une préférence d’au moins ' + fr(F.macqMult, 2) + ' fois la mise en cas de cession ou de rachat, soit ' + fr(F.macqMult * F.macqInvested, 2) + ' Md$, et ' + fr(F.macqCommonPct, 1) + ' % du capital ordinaire de la filiale qui porte Polaris Forge 1 et 2.',
      'La dilution a plusieurs robinets : ' + fr(F.gRemain, 0) + ' M$ restent à tirer sur la série G, soit ' + fr(gAtClose, 1) + ' millions d’actions à 95 % du cours actuel et jusqu’à ' + fr(gAtFloor, 1) + ' millions au plancher minimal de 4,48 $ ; ' + fr(potentialM, 1) + ' millions d’actions attendent déjà dans les bons, les convertibles et les actions gratuites ; les plans de rémunération ont créé ' + fr(F.compShares / 1e6, 2) + ' millions d’actions au trimestre, plus que les conversions de série G. Et l’étagère d’émission universelle de juin 2025 n’a pas de plafond.',
      'Trois clients font ' + (F.custA + F.custB + F.custC) + ' % du chiffre d’affaires du trimestre (' + F.custA + ' %, ' + F.custB + ' % et ' + F.custC + ' %) ; CoreWeave, locataire de Polaris Forge 1, publie le 11 novembre (une seule source) et se finance sur des marchés que la presse décrit comme fermés aux néoclouds.',
      'Les initiés ont vendu ' + nb(F.yrSellSh) + ' actions en Bourse sur un an pour ' + fr(F.yrSellUsd, 1) + ' M$, entre ' + usd(F.yrSellMin) + ' et ' + usd(F.yrSellMax) + ', contre ' + fr(insiderUsd / 1e6, 2) + ' M$ achetés en octobre ; le titre a perdu ' + fr(Math.abs(r21), 1) + ' % en vingt et une séances, avec un bêta de ' + fr(st.beta, 1) + ' selon les statistiques de marché.'],
    controlChecklist: [
      { label: 'Historique de cours', status: 'pass', statusLabel: 'Trois cents séances certifiées', evidence: 'Série quotidienne certifiée au 26 octobre 2026, sans séance manquante.', action: 'Niveaux et indicateurs calculés sur cette seule série.' },
      { label: 'Structure financière', status: 'fail', statusLabel: 'Financement plus cher que les loyers', evidence: fr(k.principal / 1000, 2) + ' Md$ de dette en principal au 31 août, ' + fr(g.rnci.value / 1e9, 2) + ' Md$ de parts préférentielles de Macquarie, ' + fr(G$.cash / 1e9, 2) + ' Md$ de liquidités non affectées ; ' + fr(F.intExp, 1) + ' M$ d’intérêts en charges et ' + fr(F.pik, 1) + ' M$ de dividendes en nature pour ' + fr(F.rent, 1) + ' M$ de loyers de base au trimestre.', action: 'Lire au deuxième trimestre, attendu le ' + k.eDate + ', la montée des loyers avec les livraisons de Polaris Forge 1 et 2, et les tirages de série G.' },
      { label: 'Point d’entrée', status: 'fail', statusLabel: 'Plus bas sur un an, sous toutes les moyennes', evidence: 'Clôture à ' + usd(close) + ' (' + sgn(c26, 1) + '), sous les moyennes à vingt (' + usd(tech.ema20) + '), cinquante (' + usd(tech.ema50) + ') et deux cents séances (' + usd(tech.ema200) + ') ; ' + fr(vol26 / 1e6, 1) + ' millions d’actions échangées, ' + fr(vol26 / avgVol26, 1) + ' fois la moyenne des vingt séances précédentes.', action: 'Aucun achat avant une clôture à ' + trigTxt + ' ou plus ; une clôture sous ' + abTxt + ' abandonne le plan.' }] };
  out.timeline = {
    title: 'Ce qui peut bouger APLD', from: '2026-10-27', to: '2026-11-16',
    keyWindow: { from: '2026-10-28', to: '2026-10-28', label: 'Fenêtre clé · mer. 28 : Fed à 19 h, puis Microsoft' },
    events: [
      { date: '2026-10-28', category: 'macro', impact: 'strong', label: 'Fed', detail: '19 h, coût du crédit', icon: 'bank', source: 'data/scheduled-events.json (fomc), calendrier de la Réserve fédérale', href: '#macro' },
      { date: '2026-10-28', category: 'earnings', impact: 'strong', label: 'Microsoft', detail: 'dépenses de calcul', icon: 'chip', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: '2026-10-29', category: 'earnings', impact: 'medium', label: 'Digital Realty', detail: 'loyers', icon: 'company', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: '2026-11-02', category: 'earnings', impact: 'medium', label: 'Cipher', detail: 'financement', icon: 'company', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: '2026-11-04', category: 'market', impact: 'medium', label: 'Assemblée APLD', detail: '18 h, rémunérations', icon: 'vote', source: 'circulaire DEF 14A du 25 septembre 2026 (assemblée le 4 novembre à 12 h, heure de New York)', href: '#capital' },
      { date: '2026-11-05', category: 'earnings', impact: 'medium', label: 'IREN, Core Sci.', detail: 'pairs', icon: 'company', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: '2026-11-06', category: 'macro', impact: 'medium', label: 'Emploi US', detail: 'taux', icon: 'data', source: 'daily/20261022/primary-reference.json (bls_empsit), calendrier du BLS' },
      { date: '2026-11-10', category: 'macro', impact: 'strong', label: 'CPI US', detail: 'taux', icon: 'data', source: 'data/scheduled-events.json (cpi), calendrier du BLS' },
      { date: '2026-11-10', category: 'earnings', impact: 'medium', label: 'Nebius', detail: 'néocloud', icon: 'chip', uncertain: true, source: 'calendrier de résultats relevé le 27 octobre 2026 sur trente jours, une seule source' },
      { date: '2026-11-11', category: 'earnings', impact: 'strong', label: 'CoreWeave', detail: 'premier locataire', icon: 'company', uncertain: true, source: 'calendrier de résultats relevé le 27 octobre 2026 sur trente jours, une seule source', href: '#trade' },
      { date: '2026-11-13', category: 'macro', impact: 'medium', label: 'PPI US', icon: 'data', source: 'data/scheduled-events.json (ppi), calendrier du BLS' },
      { date: '2026-11-16', category: 'plan', impact: 'strong', label: 'Fin du plan', detail: 'dernière activation', icon: 'hourglass', source: 'plan de la fiche', href: '#trade' },
    ],
    chains: [
      { title: 'Si le crédit se ferme', steps: [{ label: 'Prêteurs', icon: 'bank', tone: 'down' }, { label: 'Néoclouds', category: 'earnings', icon: 'chip', tone: 'down' }, { label: 'Bailleurs', category: 'earnings', icon: 'company', tone: 'down' }] },
      { title: 'Si les clouds dépensent', steps: [{ label: 'Dépenses de calcul', category: 'earnings', icon: 'chip', tone: 'up' }, { label: 'Baux longs', category: 'earnings', icon: 'company', tone: 'up' }, { label: 'APLD', category: 'earnings', icon: 'data', tone: 'up' }] },
    ],
    note: 'Hors frise : Nvidia le 17 novembre, Fed le 9 décembre (20 h), CPI le 10 décembre (14 h 30). Résultats d’Applied Digital le ' + k.eDate + ', non confirmés. « ? » : une seule source.',
  };
  return save(Object.assign(out, require('./compose-apld-body.cjs')(c, k)));
};

module.exports.scenarios = c => {
  const trig = (Math.floor(c.entry * 100 + 1e-9) + 1) / 100, u = c.usd;
  return [
    { scenario: 'bullish', trigger: 'Microsoft confirme ses dépenses de calcul fin octobre, CoreWeave rassure sur son financement le 11 novembre, et les pairs endettés lèvent sans casser leurs cours.', firstOrder: 'Le titre clôture à ' + u(trig) + ' ou plus, au-dessus du sommet du 21 octobre et de sa moyenne à vingt séances, puis vise ' + u(c.tp1) + ' et ' + u(c.tp2) + '.', secondOrder: 'Les vendeurs à découvert, un quart du flottant, rachètent et amplifient le mouvement.', confirmation: 'Une clôture à ' + u(trig) + ' ou plus sur un volume supérieur à la moyenne des vingt séances.', contradiction: 'Un saut en séance qui s’efface avant la clôture, ou un tirage de série G révélé au même moment.' },
    { scenario: 'mixed', trigger: 'Les grands clouds tiennent leurs budgets, mais les émissions des hébergeurs se font à des taux plus chers.', firstOrder: 'Le titre oscille entre ' + u(c.abandon) + ' et ' + u(trig) + ', sans base nette.', secondOrder: 'Les conversions de série G et les actions des plans de rémunération continuent d’alimenter l’offre d’actions et plafonnent les rebonds.', confirmation: 'Des clôtures dans cette bande pendant plusieurs séances, avec un volume qui reflue.', contradiction: 'Une sortie franche de la bande, d’un côté ou de l’autre.' },
    { scenario: 'bearish', trigger: 'CoreWeave déçoit sur son financement, un pair rate une émission, ou Applied Digital annonce une augmentation de capital sur son étagère universelle.', firstOrder: 'Clôture sous ' + u(c.abandon) + ', plus bas sur un an, puis recherche du plus bas du 11 septembre 2025 à ' + u(c.lv('s2')) + '.', secondOrder: 'Si le conseil abaisse le plancher de la série G, chaque tirage crée plus d’actions : la baisse nourrit la dilution.', confirmation: 'Une clôture sous ' + u(c.abandon) + ' sur un volume supérieur à la moyenne.', contradiction: 'Un nouveau plus bas en séance sans clôture dessous, suivi d’une reprise rapide, comme le 16 octobre.' }];
};

module.exports.contradictions = c => {
  const b = base(c), s = (t, d) => c.sgn(b.dr(t, d), 1);
  const fi = c.extra.quote.data.items.find(x => x.type === 'instrument_short_interest') || {};
  return [
    'Le trimestre et la chute ne disent pas la même chose : le 8 octobre, au lendemain de la publication, Applied Digital fait ' + c.sgn(b.chg('2026-10-08'), 1) + ' quand CoreWeave fait ' + s('CRWV', '2026-10-08') + ' et Nebius ' + s('NBIS', '2026-10-08') + ' ; la baisse vient ensuite, avec tout le groupe.',
    'Le président achète, les vendeurs à découvert renforcent : ' + c.nb(F.zhangSh) + ' actions achetées par Jason Zhang le 16 octobre, et des positions vendeuses passées de ' + c.fr(c.st.sharesShort / 1e6, 1) + ' à ' + c.fr((fi.shortInterest || 0) / 1e6, 1) + ' millions d’actions au relevé FINRA du 15 octobre ; une partie de ces positions couvre des convertibles, des bons et la série G.',
    'Les bailleurs à bilan solide n’ont pas bougé : en vingt et une séances, Digital Realty fait ' + c.sgn(c.M.DLR.return21d, 1) + ' et Iron Mountain ' + c.sgn(c.M.IRM.return21d, 1) + ', contre ' + c.sgn(c.ret(21), 1) + ' pour Applied Digital et ' + c.sgn(c.M.CIFR.return21d, 1) + ' pour Cipher. Le marché sanctionne le financement, pas la demande de centres de données ; Nvidia fait ' + c.sgn(c.M.NVDA.return21d, 1) + '.',
    'La société affiche un EBITDA ajusté positif (' + c.fr(F.adjEbitda, 1) + ' M$) et une perte attribuable aux actionnaires de ' + c.fr(F.nlCommon, 1) + ' M$ le même trimestre : l’écart tient aux intérêts, aux ' + c.fr(F.deriv + F.invest, 1) + ' M$ de pertes nettes de juste valeur (dont ' + c.fr(F.bwWarrant + F.bwStock, 1) + ' M$ sur Babcock & Wilcox) et aux dividendes en nature dus à Macquarie.'];
};

module.exports.missingData = () => [
  'Identité des grands clouds locataires de Polaris Forge 2 et 3 et des campus Delta Forge non publiée par la société.',
  'Coût restant des chantiers en cours et calendrier de financement des campus non chiffrés dans les pièces ouvertes.',
  'Plancher de conversion de la série G fixé par le conseil à chaque tirage, sans dépôt : les tirages courants ne se lisent qu’au 10-Q suivant.',
  'Dates de résultats de CoreWeave, Nebius et Nvidia connues par une seule source, relevées le 27 octobre hors du calendrier collecté de quatorze jours.',
  'Date de publication d’Applied Digital connue par une seule source (6 janvier 2027), non confirmée par la société.',
  'Chaîne d’options relevée avant l’ouverture avec un intérêt ouvert nul : aucun flux d’options exploitable ; pas de fourchette achat-vente de l’action dans les données.',
  'Émission de Cipher et déclarations d’Elon Musk sur le crédit aux néoclouds connues par la presse citée, sans dépôt ni source primaire.',
  'Statistiques des pairs relevées en instantané, sans historique daté ; ventes et achats d’initiés recomptés sur les formulaires 4 d’EDGAR.'];

module.exports.F = F;
module.exports.base = base;
module.exports.earningsDate = earningsDate;
