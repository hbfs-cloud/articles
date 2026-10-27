'use strict';
// Rédaction du dossier Equinox Gold (EQX) du 27 octobre 2026. Toute valeur de marché est recalculée depuis les barres
// certifiées et les artefacts collectés ; les chiffres d'entreprise viennent des dépôts SEC ouverts (static-eqx.cjs),
// recopiés ici sous forme de constantes que les extraits textuels du manifeste primaire vérifient.

// Constantes lues dans les dépôts (voir les extraits exigés de static-eqx.cjs).
const F = {
  q3: 237019, q3sold: 248484, q2sold: 177959,
  q3m: { GS: 60596, MW: 45616, VAL: 34719, NIC: 58489, CR: 18975, MESQ: 17116, CM: 1508 },
  ytd: { GS: 185589, MW: 45616, VAL: 94400, NIC: 199246, CR: 18975, MESQ: 48861 }, ytdTotal: 611483, ytdOthers: 18796,
  fullQ: { MW: 63090, CR: 26168 }, gLow: 870000, gHigh: 920000,
  cashSep: 527, rcfSep: 365, netCashSep: 163, repaidQ3: 190, repaidYtd: 1.2, bbQ3: 759000,
  q2rev: 769.8, q2price: 4256, h1price: 4440, q2aisc: 2175, q2niCont: 218.6, q2adj: 123.3, q2gold: 35.9, q2conv: 18.6, q2debt: 18.2,
  aiscLow: 1900, aiscHigh: 2000, growthLow: 600, growthHigh: 650, railroad: '70 à 80', valentine: 436,
  divQ: 0.0225, divY: 0.09, orlaShares: 378115579, pfNetCash: 214,
  orlaQ1: { op: 201.225, da: 47.728, rev: 378.88 }, eqxQ1: { op: 390.232, da: 111.936 }, orlaFy: { op: 462.837, da: 145.693, rev: 1057.881 },
  conv: { amount: 172.5, price: 6.0579, shares: 28475124 }, conv25: 4089482, conv23mda: 27435475,
  shares: 1167459822, fd: 1247524702, warrants: 33984799, calW: 3075271, w1: 1569002, w2: 1506269,
  sh2024: 455232521, shJun: 789250264, ncibMax: 39414095, s8: 1995044, s8cal: 2000000, debtJun: { rcf: 398.2, conv23: 145.5 },
  orlaW: { a: 23392397, b: 7913333 }, fairfax: 75943806, aiscOrigLow: 1775, aiscOrigHigh: 1875, railroadOz: 130000, railroadCapex: 395,
  // Périmètre de la valeur d'entreprise combinée (M$) : trésorerie et ligne de crédit au 30 septembre (préliminaire),
  // convertibles 2025 et autres emprunts au 30 juin, engagements payables en or (Equinox au 30 juin, préventes d'Orla au
  // 31 mars), compléments de prix (Greenstone au 30 juin, second versement Musselwhite) ; or livré sans encaissement.
  perim: { conv25: 23.635, other: 15.678, eqxDefRev: 226.643, orlaPrepay: 261.875, gsCC: 88.003, mwCC: 20, amortFy: 158.063, amortH126: 75.7, amortH125: 43.249, orlaDeliv: 117.013 },
};

function base(c) {
  const { pct, bars, N, close } = c;
  const cmp = c.raw.comparison_bars.data.items[0].results[0].data;
  const ser = t => { const r = cmp.find(x => x.symbol === t); if (!r) throw Error('comparable absent ' + t); return r.bars; };
  const bar = d => { const b = bars.find(x => x[0] === d); if (!b) throw Error('barre absente ' + d); return b; };
  const chg = d => { const i = bars.findIndex(b => b[0] === d); if (i < 1) throw Error('variation absente ' + d); return pct(bars[i][4], bars[i - 1][4]); };
  const dr = (sym, d) => { const b = ser(sym), i = b.findIndex(x => x[0] === d); if (i < 1) throw Error('barre absente ' + sym + ' ' + d); return pct(b[i][4], b[i - 1][4]); };
  const since = (sym, d) => { const b = ser(sym), x = b.find(z => z[0] === d); if (!x) throw Error('barre absente ' + sym + ' ' + d); return pct(b.at(-1)[4], x[4]); };
  const win = bars.slice(Math.max(0, N - 251), N + 1);
  let hi = -1, lo = 1e9, hiD, loD;
  for (const b of win) { if (b[2] > hi) { hi = b[2]; hiD = b[0]; } if (b[3] < lo) { lo = b[3]; loD = b[0]; } }
  if (loD !== '2026-07-17') throw Error('plus bas annuel inattendu ' + loD);
  const gld = ser('GLD'); let gMin = gld[0]; for (const x of gld) if (x[4] < gMin[4]) gMin = x;
  if (gMin[0] !== '2026-07-16') throw Error('plus bas de clôture de GLD inattendu ' + gMin[0]);
  const uso = ser('USO'); let uMin = uso[0]; for (const x of uso) if (x[4] < uMin[4]) uMin = x;
  const avgVol = (from, n) => { const i = bars.findIndex(b => b[0] === from); return bars.slice(i - n, i).reduce((s, b) => s + b[5], 0) / n; };
  // Régression à deux facteurs (moindres carrés avec constante) des rendements logarithmiques quotidiens d'EQX sur ceux de
  // GLD et d'USO, séances communes ; décomposition du rendement depuis le 25 août.
  const gm = new Map(gld.map(x => [x[0], x])), um = new Map(uso.map(x => [x[0], x]));
  const com = bars.filter(x => gm.has(x[0]) && um.has(x[0])), Y = [], X1 = [], X2 = [];
  for (let i = 1; i < com.length; i++) { const d = com[i][0], p = com[i - 1][0]; Y.push(Math.log(com[i][4] / com[i - 1][4])); X1.push(Math.log(gm.get(d)[4] / gm.get(p)[4])); X2.push(Math.log(um.get(d)[4] / um.get(p)[4])); }
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length, my = mean(Y), m1 = mean(X1), m2 = mean(X2);
  let s11 = 0, s22 = 0, s12 = 0, s1y = 0, s2y = 0, syy = 0;
  for (let i = 0; i < Y.length; i++) { const a = X1[i] - m1, b2 = X2[i] - m2, y = Y[i] - my; s11 += a * a; s22 += b2 * b2; s12 += a * b2; s1y += a * y; s2y += b2 * y; syy += y * y; }
  const det = s11 * s22 - s12 * s12, bg = (s22 * s1y - s12 * s2y) / det, bu = (s11 * s2y - s12 * s1y) / det;
  const sse = Y.reduce((s, y, i) => s + (y - my - bg * (X1[i] - m1) - bu * (X2[i] - m2)) ** 2, 0);
  const lnG = Math.log(gld.at(-1)[4] / gm.get('2026-08-25')[4]), lnU = Math.log(uso.at(-1)[4] / um.get('2026-08-25')[4]);
  const reg = { n: Y.length, bg, bu, r2: 1 - sse / syy, pred2: (Math.exp(bg * lnG + bu * lnU) - 1) * 100, goldPart: (Math.exp(bg * lnG) - 1) * 100 };
  reg.oilPts = reg.pred2 - reg.goldPart;
  return { cmp, ser, bar, chg, dr, since, hi, hiD, lo, loD, gMin, uMin, avgVol, reg, lnG, sinceEqx: d => pct(close, bar(d)[4]) };
}

// Prochaine publication : confirmée par la société (6-K du 13 octobre) ; recoupée avec le calendrier collecté.
function earningsDate(c) {
  const ev = ((c.raw.earnings_risk || {}).events || []).find(e => e.symbol === 'EQX');
  const cal = (((c.extra || {}).quote || {}).data || { items: [] }).items.find(x => x.type === 'instrument_calendar');
  const a = ev && ev.report_date, b = cal && String(cal.nextEarningsDate || '').slice(0, 10);
  if (a !== '2026-11-09' || b !== '2026-11-09') throw Error('date de résultats inattendue ' + a + ' / ' + b);
  return { date: a };
}

function derive(c, k) {
  const { pct, G$, ev, shares, close, peerStat } = c;
  const ytdGuid = Object.values(F.ytd).reduce((s, x) => s + x, 0);
  if (ytdGuid !== F.ytdTotal - F.ytdOthers) throw Error('somme des mines inattendue ' + ytdGuid);
  const q3Guid = F.q3 - F.q3m.CM;
  if (q3Guid !== F.q3m.GS + F.q3m.MW + F.q3m.VAL + F.q3m.NIC + F.q3m.CR + F.q3m.MESQ) throw Error('somme du trimestre inattendue');
  const q3PF = q3Guid + (F.fullQ.MW - F.q3m.MW) + (F.fullQ.CR - F.q3m.CR);
  const q4Low = F.gLow - ytdGuid, q4High = F.gHigh - ytdGuid, q4Step = pct(q4Low, q3PF);
  const canada = F.q3m.GS + F.q3m.MW + F.q3m.VAL, mexUs = F.q3m.CR + F.q3m.MESQ + F.q3m.CM;
  const orlaQ1 = F.orlaQ1.op + F.orlaQ1.da, eqxQ1 = F.eqxQ1.op + F.eqxQ1.da, orlaShare = orlaQ1 / eqxQ1 * 100;
  const ebitdaPF = G$.ebitda + k.ORLA_EBITDA_2025;
  const P = F.perim, sharesConv = F.shares + F.conv.shares;
  const debtLike = (F.rcfSep + P.conv25 + P.other + P.eqxDefRev + P.orlaPrepay + P.gsCC + P.mwCC) * 1e6, cashSep = F.cashSep * 1e6, netLike = debtLike - cashSep;
  const goldOblig = P.eqxDefRev + P.orlaPrepay, contingent = P.gsCC + P.mwCC;
  const evCoh = close * sharesConv + netLike, noCash = (P.amortFy + P.amortH126 - P.amortH125) * 1e6, orlaNoCash = P.orlaDeliv * 1e6;
  const ebitdaCash = ebitdaPF - noCash - orlaNoCash;
  const evEbitda = ev / G$.ebitda, evPF = evCoh / ebitdaPF, evCash = evCoh / ebitdaCash;
  const provider = c.st.enterpriseToEbitda;
  const pv = Object.fromEntries(k.PEERS.map(t => [t, peerStat(t, 'enterpriseToEbitda')])), peerMed = k.med(k.PEERS.map(t => pv[t]));
  const roy = Object.fromEntries(['RGLD', 'FNV', 'WPM'].map(t => [t, peerStat(t, 'enterpriseToEbitda')]));
  const goldCut = 400 * 1.1e6; // hypothèse : 400 $ l'once de moins sur environ 1,1 million d'onces par an (prévision pro forma)
  const at = (m, cut) => (m * (ebitdaPF - cut) - netLike) / sharesConv;
  const scnPrice = at(k.MULT, 0), floorVal = at(k.MULT, goldCut);
  return { ytdGuid, q3Guid, q3PF, q4Low, q4High, q4Step, canada, mexUs, orlaQ1, eqxQ1, orlaShare, ebitdaPF, evEbitda, evPF, evCash, evCoh, ebitdaCash, noCash, orlaNoCash, sharesConv, debtLike, netLike, goldOblig, contingent, provider, pvMin: Math.min(...Object.values(pv)), pvMax: Math.max(...Object.values(pv)), pv, peerMed, roy, goldCut, at, scnPrice, floorVal,
    opMargin: G$.ebit / G$.rev * 100, divYield: F.divY / close * 100, fdPct: pct(F.fd, F.shares), convPct: F.conv.shares / F.shares * 100,
    nicShare: F.q3m.NIC / F.q3 * 100, soldStep: pct(F.q3sold, F.q2sold), q2gains: F.q2niCont - F.q2adj, capMult: F.shares / F.sh2024 };
}

module.exports = (c, save, k) => {
  const { fr, usd, pct, sgn, close, prev, bars, N, tech, M, G$, marketCap, lv, entry, stop, tp1, tp2, abandon, cap, raw, dfr, nb, archive } = c;
  const B = base(c), E = earningsDate(c), D = derive(c, k);
  const trig = (Math.floor(entry * 100 + 1e-9) + 1) / 100, trigTxt = usd(trig);
  const stopOrd = Math.floor(stop * 100 + 1e-9) / 100, stopTxt = usd(stopOrd);
  const abTxt = usd(abandon);
  const c26 = pct(close, prev), vol26 = bars[N][5];
  const s25 = B.sinceEqx('2026-08-25'), g25 = B.since('GLD', '2026-08-25'), gdx25 = B.since('GDX', '2026-08-25'), gdxj25 = B.since('GDXJ', '2026-08-25'), uso25 = B.since('USO', '2026-08-25');
  const betaG = M.GLD.beta, implied = (Math.exp(betaG * B.lnG) - 1) * 100, R = B.reg;
  const gLast = B.ser('GLD').at(-1)[4], gGap = pct(gLast, B.gMin[4]), usoUp = pct(B.ser('USO').at(-1)[4], B.uMin[4]);
  const fromHi = Math.abs(pct(close, B.hi));
  const K = { PEERS: k.PEERS, MULT: k.MULT, R, B, E, D, trig, trigTxt, stopOrd, stopTxt, abTxt, c26, vol26, s25, g25, gdx25, gdxj25, uso25, betaG, implied, gLast, gGap, usoUp, fromHi };
  const eDate = dfr(E.date);
  const hist = archive.meta.statusHistory || [];
  const out = {
    meta: { lang: 'fr', dir: 'ltr', level: 'intermediate', tags: ['us', 'gold', 'mining', 'commodity', 'earnings', 'trade-idea'], grade: 'C', date: '2026-10-27', dateDisplay: '27 octobre 2026', version: 3, status: 'watch', assetType: 'stock', levelsCloseDate: c.REF,
      description: 'Equinox Gold suit l’or et le pétrole : ' + sgn(s25, 1) + ' depuis le 25 août quand GLD perd ' + fr(Math.abs(g25), 1) + ' % et USO gagne ' + fr(uso25, 1) + ' %. Résultats confirmés le ' + eDate + ' après la clôture ; rien à acheter avant, puis seulement sur une clôture à ' + trigTxt + ' ou plus ; une clôture sous ' + abTxt + ' abandonne le plan.',
      ogDescription: 'EQX à ' + usd(close) + ' : ' + sgn(s25, 1) + ' depuis le 25 août, au rythme de l’or et du pétrole. Résultats le ' + eDate + ' ; pas d’achat avant, puis seulement au-dessus de ' + trigTxt + '.',
      lastMcpRefresh: raw.status.captured_at, levelsVerifiedAt: raw.status.captured_at,
      statusHistory: [...hist, { at: raw.status.captured_at, from: archive.meta.status || 'expired', to: 'watch', note: 'refonte au gabarit du 27 octobre, sur la clôture du 26 octobre 2026 : plan de surveillance, activation après les résultats du ' + eDate + ' sur une clôture à ' + trigTxt + ' ou plus, aucune entrée', close }] },
    header: { ticker: 'EQX', name: 'Equinox Gold Corp.', exchange: 'NYSE American', sector: 'Or — producteur des Amériques, surtout canadien', price: close, changePct: c26,
      badges: [{ text: 'SURVEILLER — RIEN AVANT LE ' + eDate.toUpperCase(), color: 'blue' }, { text: 'Fort levier sur l’or', color: 'amber' }, { text: 'Bilan peu endetté', color: 'green' }],
      metrics: { marketCap: fr(marketCap / 1e9, 1) + ' Md$', volume: fr(vol26 / 1e6, 2) + ' M', range52w: usd(B.lo) + ' – ' + usd(B.hi), evEbitda: fr(D.evPF, 1) + '× avec Orla' }, halalStatus: 'unknown' },
  };
  out.verdict = { score: 46, conviction: 'Low', bias: 'Neutral',
    confidence: 'Note C (score additif de 46 sur 100) : la grille crédite un producteur rentable, peu endetté et agrandi par Orla, mais retranche la technique, la dilution et un calendrier chargé (nouveau directeur général le 31 octobre, résultats le ' + eDate + '). Score éditorial non prédictif. Comptes lus dans les états IFRS déposés (40-F et 6-K) ; niveaux lus sur la clôture certifiée du 26 octobre.',
    summary: 'Avec Orla, achetée en actions et intégrée le 31 juillet, Equinox Gold devient un producteur d’environ 1,1 million d’onces par an sur une année pleine, surtout canadien (Greenstone, Musselwhite, Valentine), avec le Nicaragua, le Mexique et la Californie. Le titre a perdu ' + fr(Math.abs(s25), 1) + ' % depuis le 25 août, à ' + usd(close) + ', quand GLD cédait ' + fr(Math.abs(g25), 1) + ' % et USO gagnait ' + fr(uso25, 1) + ' %. Sur ' + R.n + ' séances, une régression sur l’or et le pétrole donne à EQX une sensibilité de ' + fr(R.bg, 2) + ' à GLD et de ' + fr(R.bu, 2) + ' à USO ; appliquée depuis le 25 août, elle prédit ' + sgn(R.pred2, 1) + ', dont environ ' + fr(Math.abs(R.oilPts), 1) + ' points dus au pétrole. Le mouvement est compatible avec le secteur, mais un modèle n’est pas une preuve. Le bilan tient : ' + F.netCashSep + ' M$ de trésorerie nette hors convertibles au 30 septembre (définition de la société, chiffre préliminaire), face à ' + fr(D.goldOblig, 1) + ' M$ d’or encore dû au titre des préventes et du streaming. La question est le quatrième trimestre : ' + nb(D.q4Low) + ' onces au moins pour tenir la prévision, ' + fr(D.q4Step, 1) + ' % de plus que le troisième recalculé avec trois mois d’Orla. Résultats confirmés le ' + eDate + ' après la clôture de New York. Pas d’achat avant ; ensuite, seulement sur une clôture à ' + trigTxt + ' ou plus.',
    whyBuy: [
      'Un bilan nettoyé : ' + F.repaidYtd.toFixed(1).replace('.', ',') + ' Md$ de dette remboursés depuis janvier, ' + F.cashSep + ' M$ de trésorerie et ' + F.rcfSep + ' M$ tirés sur la ligne de crédit au 30 septembre, soit ' + F.netCashSep + ' M$ de trésorerie nette hors convertibles (chiffres préliminaires).',
      'Orla change l’échelle : au premier trimestre 2026, ses mines ont dégagé ' + fr(D.orlaQ1, 1) + ' M$ d’EBITDA, l’équivalent de ' + fr(D.orlaShare, 1) + ' % de celui d’Equinox (' + fr(D.eqxQ1, 1) + ' M$), selon les états pro forma du rapport d’acquisition.',
      'Une valorisation dans la fourchette des producteurs une fois Orla comptée : ' + fr(D.evPF, 1) + ' fois l’EBITDA combiné indicatif sur un périmètre cohérent (dettes, or à livrer et compléments de prix compris), pour une fourchette de ' + fr(D.pvMin, 1) + ' à ' + fr(D.pvMax, 1) + ' fois et une médiane de ' + fr(D.peerMed, 1) + ' : une légère prime, pas une bulle.',
      'Une baisse expliquée par l’or et le pétrole : ' + sgn(s25, 1) + ' depuis le 25 août, pour ' + sgn(R.pred2, 1) + ' prédits par la régression sur GLD et USO ; GDXJ, le panier des mineurs intermédiaires, a fait ' + sgn(gdxj25, 1) + '.',
      'Des projets que la société dit financer en interne : South Railroad (Nevada), autorisation fédérale obtenue en août, première production prévue en 2028 ; extension de Valentine approuvée pour ' + F.valentine + ' M$ ; dividende relevé de 50 % et ' + nb(F.bbQ3) + ' actions rachetées au troisième trimestre.'],
    whyAvoid: [
      'Un levier sur l’or au mauvais moment : GLD clôture à ' + usd(gLast) + ', ' + fr(gGap, 1) + ' % au-dessus de son plus bas de clôture du 16 juillet (' + usd(B.gMin[4]) + ') ; une cassure ferait baisser EQX environ ' + fr(betaG, 1) + ' fois plus vite que le métal.',
      'Des coûts qui montent : coût tout compris de ' + nb(F.q2aisc) + ' $ l’once au deuxième trimestre, au-dessus de la fourchette de ' + nb(F.aiscLow) + ' à ' + nb(F.aiscHigh) + ' $ visée pour l’année ; cette fourchette, de ' + nb(F.aiscOrigLow) + ' à ' + nb(F.aiscOrigHigh) + ' $ avant Orla, a été révisée en août pour refléter les résultats du semestre et la hausse du carburant ; USO a gagné ' + fr(uso25, 1) + ' % depuis le 25 août.',
      'Un quatrième trimestre exigeant : ' + nb(D.q4Low) + ' onces au minimum, quand le troisième en a produit ' + nb(D.q3Guid) + ' sur les mines de la prévision, ' + nb(D.q3PF) + ' avec trois mois d’Orla ; un nouveau directeur général prend ses fonctions le 31 octobre, neuf jours avant la publication.',
      'Un capital qui gonfle : ' + nb(F.fd) + ' actions en données pleinement diluées (+' + fr(D.fdPct, 1) + ' %), dont ' + nb(F.conv23mda) + ' pour les convertibles 2023 (' + nb(F.conv.shares) + ' au taux de conversion majoré annoncé le 21 septembre) ; ' + nb(F.orlaW.b) + ' bons d’Orla à C$ 3,00 expirent le 18 décembre 2026 ; le capital a été multiplié par ' + fr(D.capMult, 1) + ' depuis fin 2024.',
      'Un quart de la production dans un pays sous sanctions : le Nicaragua a fourni ' + fr(D.nicShare, 1) + ' % des onces du troisième trimestre, et un décret américain de 2022 autorise des sanctions contre les acteurs de son secteur aurifère.'],
    controlChecklist: [
      { label: 'Historique de cours', status: 'pass', statusLabel: 'Trois cents séances certifiées', evidence: 'Série quotidienne certifiée au 26 octobre ; séries de GLD et EGO reconstruites pour les séances du 21 et du 24 juillet avant la collecte.', action: 'Niveaux et indicateurs calculés sur cette seule série.' },
      { label: 'Comptes', status: 'warn', statusLabel: 'IFRS, avant Orla', evidence: 'Émetteur canadien : 40-F et 6-K, normes IFRS, en dollars ; agrégats sur douze mois au 30 juin 2026 lus dans les états déposés, antérieurs à Orla. EBITDA d’Orla, préventes d’or et compléments de prix lus dans le rapport d’acquisition.', action: 'Lire le multiple combiné comme un ordre de grandeur, pas comme un chiffre publié.' },
      { label: 'Point d’entrée', status: 'fail', statusLabel: 'Sous les moyennes, résultats à venir', evidence: 'Clôture à ' + usd(close) + ', sous les moyennes à vingt (' + usd(tech.ema20) + '), cinquante (' + usd(tech.ema50) + ') et deux cents séances (' + usd(tech.ema200) + ') ; résultats le ' + eDate + ' après la clôture.', action: 'Aucun achat avant les résultats ; ensuite seulement sur une clôture à ' + trigTxt + ' ou plus.' }] };
  out.timeline = {
    title: 'Ce qui peut bouger EQX', from: '2026-10-27', to: '2026-11-16',
    keyWindow: { from: E.date, to: '2026-11-10', label: 'Fenêtre clé · résultats lun. après 22 h, clôture du mar. à 22 h' },
    events: [
      { date: '2026-10-28', category: 'earnings', impact: 'medium', label: 'Pairs', detail: 'Agnico, Alamos, Kinross', icon: 'company', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: '2026-10-28', category: 'macro', impact: 'strong', label: 'Fed', detail: '19 h, dollar et or', icon: 'bank', source: 'data/scheduled-events.json (fomc), calendrier de la Réserve fédérale', href: '#macro' },
      { date: '2026-10-31', category: 'earnings', impact: 'medium', label: 'Nouveau dirigeant', detail: 'Jason Simpson', icon: 'company', source: '6-K du 5 août 2026 (communiqué et rapport de gestion du deuxième trimestre)' },
      { date: '2026-11-06', category: 'macro', impact: 'medium', label: 'Emploi US', detail: 'dollar, or', icon: 'data', source: 'daily/20261022/primary-reference.json (bls_empsit), calendrier du BLS' },
      { date: E.date, category: 'earnings', impact: 'strong', label: 'Résultats EQX', detail: 'après 22 h', icon: 'company', source: '6-K du 13 octobre 2026 : publication le lundi 9 novembre après la clôture, confirmée par la société ; Barrick le même soir (une seule source)', href: '#earnings' },
      { date: '2026-11-10', category: 'macro', impact: 'strong', label: 'CPI US', detail: '14 h 30', icon: 'data', source: 'data/scheduled-events.json (cpi), calendrier du BLS' },
      { date: '2026-11-10', category: 'earnings', impact: 'medium', label: 'Conférence', detail: '16 h', icon: 'company', source: '6-K du 13 octobre 2026' },
      { date: '2026-11-13', category: 'macro', impact: 'medium', label: 'PPI US', icon: 'data', source: 'data/scheduled-events.json (ppi), calendrier du BLS' },
      { date: '2026-11-16', category: 'plan', impact: 'strong', label: 'Fin du plan', detail: 'dernière activation', icon: 'hourglass', source: 'plan de la fiche', href: '#trade' },
    ],
    chains: [
      { title: 'Si l’or recule', steps: [{ label: 'Or', icon: 'coin', tone: 'down' }, { label: 'Marge par once', category: 'earnings', icon: 'company', tone: 'down' }, { label: 'EQX amplifié', category: 'earnings', icon: 'company', tone: 'down' }] },
      { title: 'Si le pétrole monte', steps: [{ label: 'Pétrole', category: 'geo', icon: 'oil', tone: 'up' }, { label: 'Coûts des mines', category: 'earnings', icon: 'company', tone: 'up' }, { label: 'Marge', category: 'earnings', icon: 'data', tone: 'down' }] },
      { title: 'Si la Fed détend les taux', steps: [{ label: 'Taux réels', icon: 'bank', tone: 'down' }, { label: 'Or', icon: 'coin', tone: 'up' }, { label: 'Mineurs', category: 'earnings', icon: 'company', tone: 'up' }] },
    ],
    note: 'Rien ne s’achète avant les résultats du ' + eDate + ' ; une clôture sous ' + abTxt + ' abandonne le plan. Clôture de New York à 22 h (Paris) dès le 2 novembre. « ? » : une seule source.',
  };
  return save(Object.assign(out, require('./compose-eqx-body.cjs')(c, K, F)));
};

module.exports.F = F;

module.exports.scenarios = c => {
  const trig = (Math.floor(c.entry * 100 + 1e-9) + 1) / 100, b = base(c);
  return [
    { scenario: 'bullish', trigger: 'L’or se stabilise au-dessus de ses plus bas de juillet et les résultats du 9 novembre confirment la prévision de 870 000 onces au moins, avec un coût tout compris revenu dans la fourchette.', firstOrder: 'EQX clôture à ' + c.usd(trig) + ' ou plus, au-dessus du plus haut du 20 octobre, puis vise ' + c.usd(c.tp1) + ' et ' + c.usd(c.tp2) + '.', secondOrder: 'GDXJ et les intermédiaires canadiens suivent ; les sociétés de redevances progressent moins, signe que le marché rachète le risque de coûts.', confirmation: 'Une clôture à ' + c.usd(trig) + ' ou plus après la publication, sur un volume supérieur à la moyenne des vingt séances précédentes.', contradiction: 'Un saut le soir des résultats qui s’efface dès la première séance complète.' },
    { scenario: 'mixed', trigger: 'Prévision maintenue mais coûts au-dessus de la fourchette ; l’or oscille autour de ses plus bas de l’été.', firstOrder: 'EQX reste entre ' + c.usd(c.lv('s1')) + ' et ' + c.usd(trig) + ', sans base nette.', secondOrder: 'L’écart avec GDX reste dans la marge que donne son bêta ; rien ne se dégage de propre à la société.', confirmation: 'Des clôtures dans cette bande plusieurs séances de suite après le 9 novembre.', contradiction: 'Une sortie franche de la bande, d’un côté ou de l’autre, sur un volume supérieur à la moyenne.' },
    { scenario: 'bearish', trigger: 'GLD casse son plus bas de clôture du 16 juillet, ou la société abaisse sa prévision de production le 9 novembre.', firstOrder: 'EQX enfonce ' + c.usd(c.lv('s1')) + ' et revient vers le plus bas annuel, ' + c.usd(c.abandon) + ', qui abandonne le plan.', secondOrder: 'Les producteurs à coûts élevés et les intermédiaires reculent plus que les sociétés de redevances ; GDXJ sous-performe GDX.', confirmation: 'Une clôture de GLD sous ' + c.usd(b.gMin[4]) + ' suivie d’une clôture d’EQX sous ' + c.usd(c.lv('s1')) + '.', contradiction: 'Un nouveau plus bas de l’or qu’EQX ne suit pas, signe que le marché a déjà payé le risque.' }];
};

module.exports.contradictions = (c, k) => {
  const d = derive(c, k), b = base(c), s25 = b.sinceEqx('2026-08-25'), g25 = b.since('GLD', '2026-08-25'), s717 = b.sinceEqx('2026-07-17'), g717 = b.since('GLD', '2026-07-17'), gdx717 = b.since('GDX', '2026-07-17');
  return [
    'L’or est revenu à son niveau de juillet (GLD ' + c.sgn(g717, 1) + ' depuis le 17 juillet) mais EQX vaut ' + c.fr(s717, 1) + ' % de plus qu’à cette date, comme GDX (' + c.sgn(gdx717, 1) + ') : le marché paie déjà une partie de l’amélioration du bilan et de l’apport d’Orla.',
    'Le titre a perdu ' + c.fr(Math.abs(s25), 1) + ' % depuis le 25 août alors que la société a remboursé de la dette, maintenu sa prévision et racheté des actions ; la régression sur l’or et le pétrole en prédit ' + c.sgn(b.reg.pred2, 1) + ', mais deux séances propres au titre ressortent : le 21 septembre (convertibles appelés) et le 13 octobre (production du troisième trimestre).',
    'Le multiple dépend de la base : ' + c.fr(c.ev / c.G$.ebitda, 1) + ' fois l’EBITDA d’Equinox seul, ' + c.fr(d.evPF, 1) + ' fois avec Orla sur un périmètre cohérent, ' + c.fr(d.evCash, 1) + ' fois sur l’EBITDA encaissé, ' + c.fr(d.provider, 1) + ' fois selon le fournisseur des multiples des pairs ; aucun n’est le multiple d’un exercice complet du groupe actuel.',
    'Le résultat net du deuxième trimestre (' + c.fr(F.q2niCont, 1) + ' M$ pour les activités poursuivies) comptait ' + c.fr(F.q2niCont - F.q2adj, 1) + ' M$ de gains comptables nets, dont ' + c.fr(F.q2gold, 1) + ' M$ sur des contrats sur l’or : un recul du métal joue dans l’autre sens sur ces lignes.'];
};

module.exports.missingData = () => [
  'Agrégats IFRS d’Equinox seul, douze mois au 30 juin 2026, antérieurs à Orla ; aucun EBITDA du groupe actuel sur douze mois n’est publié.',
  'Coût tout compris et prix réalisé du troisième trimestre inconnus avant le 9 novembre ; trésorerie et dette au 30 septembre connues par un communiqué préliminaire.',
  'Nombre exact d’actions émises sur conversion des obligations 2023 (jusqu’à 28 475 124) non publié avant les résultats.',
  'Sort des 36 M$ d’obligations convertibles d’Orla restées après la conversion partielle (option de rachat au changement de contrôle) non publié dans les pièces ouvertes.',
  'Déclarations d’initiés non consultées : un émetteur qui dépose un 40-F est exempté de la section 16, ses dirigeants déclarent sur SEDI au Canada.',
  'Dette et trésorerie du groupe combiné au 30 septembre connues seulement par le communiqué préliminaire ; préventes d’Orla au 31 mars, dernier état publié.',
  'Mouvement implicite des options aux résultats indisponible à la collecte (marché fermé) ; statistiques des pairs relevées en instantané, sans historique daté.',
  'Prix de l’or au comptant non certifié par la source de marché (contrat à terme sans calendrier) : l’or est mesuré par GLD.'];
