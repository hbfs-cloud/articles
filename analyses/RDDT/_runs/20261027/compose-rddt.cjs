'use strict';
// Rédaction du dossier Reddit (RDDT) du 27 octobre 2026. Toute valeur de marché est recalculée depuis les barres
// certifiées et les artefacts collectés ; les chiffres d'entreprise viennent des dépôts SEC ouverts (static-rddt.cjs) ;
// les causes des séances récentes viennent de la presse financière citée.

// Chiffres d'entreprise lus dans les dépôts (M$ ou millions d'utilisateurs), recopiés une fois ici et contrôlés par les
// extraits textuels du manifeste primaire (static-rddt.cjs, needles).
const F = {
  q325: 585.0, q425: 725.6, q126: 663.4, q226: 804.9,             // revenus trimestriels publiés
  g425: [655, 665], g126: [595, 605], g226: [715, 725], g326: [860, 870], // fourchettes de prévision de revenus
  usDau: { q325: 51.6, q425: 52.5, q126: 53.5, q226: 53.2 },       // utilisateurs quotidiens américains (DAUq)
  usLoggedIn: 23.1, usArpu: 11.85, adRev: 762, price: 40, impr: 17, price6m: 35, impr6m: 24,
  diluted: 207.0, buyback6m: 239.6, buybackLeft: 760.4, buybackAvg: 157.57, revolver: 494.4,
};

function base(c) {
  const { pct, bars, N, close } = c;
  const cmp = c.raw.comparison_bars.data.items[0].results[0].data;
  const bar = d => { const b = bars.find(x => x[0] === d); if (!b) throw Error('barre absente ' + d); return b; };
  const chg = d => { const i = bars.findIndex(b => b[0] === d); if (i < 1) throw Error('variation absente ' + d); return pct(bars[i][4], bars[i - 1][4]); };
  const gapOf = d => { const i = bars.findIndex(b => b[0] === d); if (i < 1) throw Error('écart absent ' + d); return pct(bars[i][1], bars[i - 1][4]); };
  const dr = (sym, d) => { const row = cmp.find(x => x.symbol === sym); if (!row) throw Error('comparable absent ' + sym); const b = row.bars, i = b.findIndex(x => x[0] === d); if (i < 1) throw Error('barre absente ' + sym + ' ' + d); return pct(b[i][4], b[i - 1][4]); };
  const win = bars.slice(Math.max(0, N - 251), N + 1);
  let hi = -1, lo = 1e9, hiD, loD;
  for (const b of win) { if (b[2] > hi) { hi = b[2]; hiD = b[0]; } if (b[3] < lo) { lo = b[3]; loD = b[0]; } }
  if (loD !== '2026-03-30' || hiD !== '2026-01-09') throw Error('extrêmes annuels inattendus ' + hiD + ' ' + loD);
  const avgVol = (from, n) => { const i = bars.findIndex(b => b[0] === from); return bars.slice(i - n, i).reduce((s, b) => s + b[5], 0) / n; };
  const ye = bars.filter(b => b[0] <= '2025-12-31').at(-1);
  if (!ye || ye[0] !== '2025-12-31') throw Error('clôture de fin 2025 absente');
  // Réactions aux quatre dernières publications (après la clôture de New York) : séance suivante.
  const reactions = [['2025-10-30', '2025-10-31'], ['2026-02-05', '2026-02-06'], ['2026-04-30', '2026-05-01'], ['2026-07-30', '2026-07-31']]
    .map(([pub, next]) => ({ pub, next, move: chg(next), gap: gapOf(next), vol: bar(next)[5] }));
  return { cmp, bar, chg, gapOf, dr, hi, hiD, lo, loD, avgVol, ye, reactions, fromHi: Math.abs(pct(close, hi)), fromLo: pct(close, lo), ytd: pct(close, ye[4]) };
}

// Date de publication : calendrier collecté, confirmée par le communiqué de la société du 15 octobre 2026.
function earningsDate(c) {
  const ev = ((c.raw.earnings_risk || {}).events || []).find(e => e.symbol === 'RDDT');
  if (!ev) throw Error('date de résultats absente du calendrier collecté');
  return { date: ev.report_date, source: 'calendrier de résultats collecté, confirmé par le communiqué de Reddit du 15 octobre (Business Wire)' };
}

module.exports = (c, save) => {
  const { fr, pct, sgn, usd, close, prev, bars, N, tech, st, M, G$, g, marketCap, ev, scn, lv, entry, stop, tp1, tp2, abandon, cap, raw, dfr, nb, peerStat } = c;
  const B = base(c), { bar, chg, fromHi } = B;
  const E = earningsDate(c);
  if (E.date !== '2026-10-29') throw Error('date de résultats inattendue ' + E.date);
  const trig = (Math.floor(entry * 100 + 1e-9) + 1) / 100, trigTxt = usd(trig);
  const stopOrd = Math.floor(stop * 100 + 1e-9) / 100, stopTxt = usd(stopOrd);
  const abTxt = usd(abandon);
  const c26 = pct(close, prev), c23 = chg('2026-10-23'), c22 = chg('2026-10-22'), lo26 = bars[N][3], hi26 = bars[N][2], vol26 = bars[N][5], avgVol26 = B.avgVol(bars[N][0], 20);
  const evRev = ev / G$.rev, evEbit = ev / G$.ebit, pe = marketCap / G$.ni, opMargin = G$.ebit / G$.rev * 100, fcfYield = G$.fcf / marketCap * 100;
  const pretax = G$.ebit + g.nonop.value, taxRate = g.tax.value / pretax * 100, ni21 = pretax * 0.79, pe21 = marketCap / ni21, sbcPct = g.sbc.value / G$.rev * 100;
  const peers = ['META', 'GOOGL', 'PINS', 'SNAP', 'RBLX', 'APP'], pv = Object.fromEntries(peers.map(t => [t, peerStat(t, 'enterpriseToRevenue')]));
  const beat = (act, gr) => (act / gr[1] - 1) * 100;
  const beats = [beat(F.q425, F.g425), beat(F.q126, F.g126), beat(F.q226, F.g226)];
  const g3lo = (F.g326[0] / F.q325 - 1) * 100, g3hi = (F.g326[1] / F.q325 - 1) * 100, g2 = (F.q226 / 499.6 - 1) * 100;
  const revSep = (G$.rev / 1e6 - F.q325 + (F.g326[0] + F.g326[1]) / 2) * 1e6, evRevSep = ev / revSep;
  const eDate = dfr(E.date);
  const r = B.reactions;
  const out = {
    meta: { lang: 'fr', dir: 'ltr', level: 'intermediate', tags: ['us', 'comms', 'ai', 'earnings', 'trade-idea'], grade: 'C+', date: '2026-10-27', dateDisplay: '27 octobre 2026', version: 3, status: 'watch', assetType: 'stock', levelsCloseDate: c.REF,
      description: 'Reddit à ' + usd(close) + ' avant ses résultats du 29 octobre : revenus +61 % portés par le prix des annonces, utilisateurs américains en recul. Aucun achat avant le 2 novembre, puis seulement après une clôture à ' + trigTxt + ' ou plus ; abandon sous ' + abTxt + '.',
      ogDescription: 'Reddit à ' + usd(close) + ' (' + sgn(c26, 1) + ') avant ses résultats du 29 octobre : prix des annonces +40 %, utilisateurs américains en recul. Pas d’achat avant la publication.',
      lastMcpRefresh: raw.status.captured_at, levelsVerifiedAt: raw.status.captured_at,
      statusHistory: [...(c.archive.meta.statusHistory || []), { at: raw.status.captured_at, from: 'expired', to: 'watch', note: 'refonte du 27 octobre sur la clôture du 26 : plan de surveillance, aucune entrée avant les résultats du 29 octobre ; activation ensuite sur une clôture à ' + trigTxt + ' ou plus', close }] },
    archiveHistory: [
      { date: '2026-09-27', dateDisplay: '27 septembre 2026', grade: 'B', note: 'Plan de couloir, déclenché le 28 septembre, expiré le 23 octobre' },
      { date: '2026-07-01', dateDisplay: '1er juillet 2026', note: 'Version précédente' },
      { date: '2026-02-14', dateDisplay: '14 février 2026', note: 'Version précédente' }],
    header: { ticker: 'RDDT', name: 'Reddit, Inc.', exchange: 'NYSE', sector: 'Réseau social et publicité en ligne', price: close, changePct: c26,
      badges: [{ text: 'SURVEILLER — RIEN AVANT LE 2 NOVEMBRE', color: 'blue' }, { text: 'Résultats jeudi après la clôture', color: 'amber' }, { text: 'Utilisateurs américains en recul', color: 'red' }],
      metrics: { marketCap: fr(marketCap / 1e9, 1) + ' Md$', volume: fr(vol26 / 1e6, 2) + ' M', evRevenue: fr(evRev, 1) + '×' }, halalStatus: 'unknown' },
  };
  out.verdict = { score: 46, conviction: 'Low', bias: 'Neutral',
    confidence: 'Note C+ (score additif de 46 sur 100) : la grille crédite une croissance de 61 %, une marge opérationnelle de ' + fr(opMargin, 0) + ' % et un bilan sans dette, mais retranche la technique, le calendrier (résultats le jeudi 29 octobre au soir) et la rémunération en actions. Score éditorial non prédictif. Chiffres d’entreprise lus dans les dépôts SEC et les données XBRL officielles ; niveaux lus sur la clôture certifiée du 26 octobre.',
    summary: 'Reddit vend de la publicité dans des discussions que ses utilisateurs écrivent gratuitement, et la vend de plus en plus cher. Au deuxième trimestre, le prix moyen des annonces a monté d’environ 40 % sur un an, le nombre d’impressions de 17 % seulement ; les utilisateurs quotidiens américains sont passés de 53,5 à 53,2 millions en un trimestre, et la société elle-même parle de visites venues de la recherche « heurtées ». Le marché a tranché le 31 juillet (' + sgn(r[3].move, 1) + ' en une séance) et n’a pas changé d’avis : ' + sgn(B.ytd, 0) + ' depuis le 31 décembre, ' + sgn(c23, 1) + ' le 23 octobre et ' + sgn(c26, 1) + ' le 26, à ' + usd(close) + '. Les résultats du troisième trimestre tombent jeudi 29 octobre après la clôture de New York, date confirmée par la société. La prévision de 860 à 870 M$ implique une croissance ramenée à ' + fr(g3lo, 0) + '-' + fr(g3hi, 0) + ' %, mais les trois derniers trimestres ont dépassé le haut de leur fourchette de ' + fr(Math.min(...beats), 0) + ' à ' + fr(Math.max(...beats), 0) + ' %. Pas d’achat avant le lundi 2 novembre ; ensuite, seulement après une clôture à ' + trigTxt + ' ou plus, et si les utilisateurs américains ne reculent pas une deuxième fois.',
    whyBuy: [
      'Une croissance rare à cette taille : ' + fr(F.q226, 1) + ' M$ de revenus au deuxième trimestre (+61 %), ' + fr(G$.rev / 1e9, 2) + ' Md$ sur douze mois glissants, et des prévisions dépassées de ' + fr(beats[0], 1) + ' %, ' + fr(beats[1], 1) + ' % et ' + fr(beats[2], 1) + ' % au-dessus du haut de fourchette sur les trois derniers trimestres.',
      'Une entreprise rentable en normes comptables : ' + fr(G$.ebit / 1e6, 0) + ' M$ de résultat opérationnel sur douze mois (' + fr(opMargin, 0) + ' % de marge) et ' + nb(G$.fcf / 1e6) + ' M$ de flux de trésorerie libre, soit ' + fr(fcfYield, 1) + ' % de la capitalisation.',
      'Un bilan sans dette tirée : ' + fr((G$.cash) / 1e9, 2) + ' Md$ de liquidités et de placements au 30 juin, et ' + fr(F.buybackLeft, 1) + ' M$ encore autorisés pour racheter des actions.',
      'Le titre a déjà purgé beaucoup d’optimisme : ' + fr(fromHi, 0) + ' % sous son plus haut du 9 janvier, et ' + fr(B.fromLo, 0) + ' % seulement au-dessus de son plus bas du 30 mars ; ' + fr(siFloat(c), 1) + ' % du flottant est vendu à découvert, un carburant si la publication rassure. Ce n’est pas, en soi, une raison d’acheter avant elle.'],
    whyAvoid: [
      'La croissance vient du prix, plus du volume : au deuxième trimestre, prix des annonces +40 % et impressions +17 % (+35 % et +24 % sur six mois). Un prix qui monte deux fois plus vite que l’audience finit par buter sur le rendement des annonceurs.',
      'L’audience américaine ne progresse plus : 53,2 millions d’utilisateurs quotidiens au deuxième trimestre contre 53,5 millions au premier, et 23,1 millions d’utilisateurs connectés (+1 % sur un an). Le 10-K reconnaît que le trafic dépend en partie de Google.',
      'La valorisation ne laisse pas de marge : ' + fr(evRev, 1) + ' fois les revenus des douze derniers mois, autant qu’Alphabet (' + fr(pv.GOOGL, 1) + '×) et plus que Meta (' + fr(pv.META, 1) + '×), quand Pinterest se paie ' + fr(pv.PINS, 1) + '× et Snap ' + fr(pv.SNAP, 1) + '×.',
      'Les résultats tombent le ' + eDate + ' au soir, et les quatre dernières publications ont fait bouger le titre de ' + fr(Math.min(...r.map(x => Math.abs(x.move))), 0) + ' à ' + fr(Math.max(...r.map(x => Math.abs(x.move))), 0) + ' % le lendemain ; le 31 juillet, il a ouvert ' + fr(Math.abs(r[3].gap), 0) + ' % plus bas. Aucun stop ne protège d’un tel écart.',
      'Le bénéfice net est flatté par l’impôt : ' + fr(g.tax.value / 1e6, 1) + ' M$ d’impôt sur douze mois pour ' + fr(pretax / 1e6, 0) + ' M$ de résultat avant impôt (' + fr(taxRate, 1) + ' %), grâce aux pertes passées ; à 21 %, le multiple de bénéfice passerait de ' + fr(pe, 1) + ' à ' + fr(pe21, 1) + ' fois.'],
    controlChecklist: [
      { label: 'Historique de cours', status: 'pass', statusLabel: 'Trois cents séances certifiées', evidence: 'Série quotidienne certifiée au 26 octobre, contrôlée séance par séance, séances des 22 et 23 juillet comprises.', action: 'Niveaux et indicateurs calculés sur cette seule série.' },
      { label: 'Structure financière', status: 'pass', statusLabel: 'Sans dette, ' + fr(G$.cash / 1e9, 1) + ' Md$ de trésorerie', evidence: 'Aucune dette tirée au 30 juin ; ' + fr(F.revolver, 1) + ' M$ disponibles sur une ligne de crédit de 500 M$ ; ' + nb(c.shares) + ' actions Class A et B, ' + fr(F.diluted, 1) + ' millions en totalement dilué.', action: 'Raisonner sur la dilution des rémunérations en actions, pas sur la dette.' },
      { label: 'Point d’entrée', status: 'fail', statusLabel: 'Sous ses moyennes, résultats jeudi', evidence: 'Clôture à ' + usd(close) + ' (' + sgn(c26, 1) + '), sous les moyennes à vingt (' + usd(tech.ema20) + '), cinquante (' + usd(tech.ema50) + ') et deux cents séances (' + usd(tech.ema200) + ') ; ' + fr(vol26 / 1e6, 2) + ' millions d’actions échangées, ' + fr(vol26 / avgVol26, 1) + ' fois la moyenne des vingt séances précédentes.', action: 'Aucun achat avant le lundi 2 novembre ; ensuite seulement après une clôture à ' + trigTxt + ' ou plus, si les utilisateurs américains publiés le ' + eDate + ' ne reculent pas sous ' + fr(F.usDau.q226, 1) + ' millions.' }] };
  out.timeline = {
    title: 'Ce qui peut bouger RDDT', from: '2026-10-27', to: '2026-11-13',
    keyWindow: { from: E.date, to: '2026-10-30', label: 'Fenêtre clé · jeu. résultats après 21 h, ven. clôture à 21 h' },
    events: [
      { date: '2026-10-28', category: 'macro', impact: 'strong', label: 'Fed', detail: '19 h, taux', icon: 'bank', source: 'data/scheduled-events.json (fomc), calendrier de la Réserve fédérale', href: '#macro' },
      { date: '2026-10-28', category: 'earnings', impact: 'medium', label: 'Alphabet', detail: 'recherche', icon: 'company', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: E.date, category: 'earnings', impact: 'strong', label: 'Résultats RDDT', detail: 'après 21 h', icon: 'company', source: E.source, href: '#earnings' },
      { date: E.date, category: 'earnings', impact: 'medium', label: 'Pinterest', detail: 'budgets', icon: 'company', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: '2026-11-04', category: 'earnings', impact: 'medium', label: 'Snap', detail: '+ AppLovin', icon: 'company', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: '2026-11-06', category: 'macro', impact: 'medium', label: 'Emploi US', detail: 'taux', icon: 'data', source: 'daily/20261022/primary-reference.json (bls_empsit), calendrier du BLS' },
      { date: '2026-11-10', category: 'macro', impact: 'strong', label: 'CPI US', detail: 'taux', icon: 'data', source: 'data/scheduled-events.json (cpi), calendrier du BLS' },
      { date: '2026-11-13', category: 'plan', impact: 'strong', label: 'Fin du plan', detail: 'dernière activation', icon: 'hourglass', source: 'plan de la fiche', href: '#trade' },
    ],
    chains: [
      { title: 'Si l’audience recule encore', steps: [{ label: 'Recherche Google', icon: 'globe', tone: 'down' }, { label: 'Visiteurs US', category: 'earnings', icon: 'company', tone: 'down' }, { label: 'Impressions', category: 'earnings', icon: 'data', tone: 'down' }] },
      { title: 'Si les annonceurs suivent', steps: [{ label: 'Prix des annonces', category: 'earnings', icon: 'coin', tone: 'up' }, { label: 'Revenus', category: 'earnings', icon: 'company', tone: 'up' }, { label: 'Rachats des vendeurs', category: 'market', icon: 'bolt', tone: 'up' }] },
    ],
    note: 'Rien ne s’achète avant le lundi 2 novembre ; une clôture sous ' + abTxt + ' abandonne le plan. New York ferme à 21 h (Paris) jusqu’au 30 octobre, à 22 h ensuite. « ? » : date d’une seule source.',
  };
  return save(Object.assign(out, require('./compose-rddt-body.cjs')(c, { B, E, F, trig, trigTxt, stopOrd, stopTxt, abTxt, c26, c23, c22, lo26, hi26, vol26, avgVol26, evRev, evEbit, pe, pe21, ni21, pretax, taxRate, sbcPct, opMargin, fcfYield, pv, beats, g3lo, g3hi, g2, revSep, evRevSep, eDate })));
};

function siFloat(c) { const q = (((c.extra || {}).quote || {}).data || { items: [] }).items.find(x => x.type === 'instrument_short_interest'); if (!q || !q.shortInterest) throw Error('relevé FINRA absent'); return q.shortInterest / c.st.floatShares * 100; }
module.exports.siFloat = siFloat;
module.exports.F = F;

module.exports.scenarios = c => {
  const trig = (Math.floor(c.entry * 100 + 1e-9) + 1) / 100;
  return [
    { scenario: 'bullish', trigger: 'Les revenus du troisième trimestre dépassent encore nettement le haut de la prévision (870 M$) et les utilisateurs quotidiens américains repartent au-dessus de 53,2 millions.', firstOrder: 'Le titre clôture à ' + c.usd(trig) + ' ou plus, au-dessus du plus haut du 26 octobre, puis vise ' + c.usd(c.tp1) + ' et ' + c.usd(c.tp2) + '.', secondOrder: 'Les vendeurs à découvert, ' + c.fr(siFloat(c), 1) + ' % du flottant au 15 octobre, rachètent ; Pinterest et Snap profitent d’une lecture favorable sur les budgets.', confirmation: 'Une clôture à ' + c.usd(trig) + ' ou plus le vendredi 30 octobre ou dans les séances suivantes, avec un volume supérieur à la moyenne.', contradiction: 'Un saut d’ouverture que la séance efface, ou une ouverture déjà au-dessus du plafond d’achat de ' + c.usd(c.cap) + ' : on ne poursuit pas.' },
    { scenario: 'mixed', trigger: 'Revenus au-dessus de la prévision mais utilisateurs américains stables ; prévision du quatrième trimestre prudente.', firstOrder: 'Le titre oscille entre ' + c.usd(c.abandon) + ' et ' + c.usd(trig) + ' sans direction nette.', secondOrder: 'Les rachats d’actions soutiennent le cours sans le relancer ; l’attention passe à Alphabet et à Snap.', confirmation: 'Des clôtures dans cette bande pendant plusieurs séances après la publication.', contradiction: 'Une sortie franche de la bande, d’un côté ou de l’autre, avec du volume.' },
    { scenario: 'bearish', trigger: 'Deuxième recul trimestriel des utilisateurs américains, ou des revenus seulement au niveau de la prévision, après trois dépassements de 9 à 11 %.', firstOrder: 'Clôture sous ' + c.usd(c.abandon) + ', plus bas du 13 mars : le plan est abandonné, le plus bas annuel de ' + c.usd(c.lv('s3')) + ' redevient la référence.', secondOrder: 'Yelp et Tripadvisor, qui vivent aussi des visiteurs envoyés par Google, sont lus comme exposés au même risque avant leurs propres résultats du 5 novembre.', confirmation: 'Une clôture sous ' + c.usd(c.abandon) + ' sur un volume supérieur à la moyenne.', contradiction: 'Un plus bas en séance sous ce seuil sans clôture dessous, suivi d’une reprise rapide.' }];
};

module.exports.contradictions = c => {
  const b = base(c), pct = c.pct;
  const since13 = pct(c.close, b.bar('2026-08-13')[4]);
  return [
    'Les comptes accélèrent pendant que le cours recule : revenus +61 % au deuxième trimestre, au-dessus de la prévision de ' + c.fr((F.q226 / F.g226[1] - 1) * 100, 0) + ' %, mais le titre a perdu ' + c.fr(Math.abs(b.reactions[3].move), 1) + ' % le lendemain et fait ' + c.sgn(pct(c.close, b.bar('2026-07-30')[4]), 1) + ' depuis la veille de la publication. Le marché paie l’audience, pas le prix des annonces.',
    'Meta a publié une demande publicitaire solide le 21 octobre et a pourtant perdu ' + c.fr(Math.abs(b.dr('META', '2026-10-22')), 1) + ' % le lendemain, sur ses investissements ; Reddit n’a cédé que ' + c.fr(Math.abs(b.chg('2026-10-22')), 1) + ' % ce jour-là, puis ' + c.fr(Math.abs(b.chg('2026-10-23')), 1) + ' % et ' + c.fr(Math.abs(c.pct(c.close, c.prev)), 1) + ' % les deux séances suivantes, avec Pinterest (' + c.sgn(b.dr('PINS', '2026-10-23'), 1) + ' puis ' + c.sgn(b.dr('PINS', c.REF), 1) + ') et le panier des services de communication (' + c.sgn(b.dr('XLC', '2026-10-23'), 1) + ' puis ' + c.sgn(b.dr('XLC', c.REF), 1) + ') mais pas Roblox (' + c.sgn(b.dr('RBLX', c.REF), 1) + ' le 26). Au bêta de ' + c.fr(c.M.XLC.beta, 1) + ' mesuré sur ce panier, l’essentiel de ces deux baisses est sectoriel ; lecture des cours, pas cause établie.',
    'L’entrée au S&P 500 n’a rien laissé : ' + c.sgn(b.chg('2026-08-14'), 1) + ' le 14 août à l’annonce, ' + c.sgn(b.chg('2026-08-17'), 1) + ' le 17 sur ' + c.fr(b.bar('2026-08-17')[5] / 1e6, 1) + ' millions d’actions, la séance des achats des fonds indiciels ; le titre est aujourd’hui ' + c.fr(Math.abs(since13), 1) + ' % sous sa clôture du 13 août, la dernière avant le bond.',
    c.fr(siFloat(c), 1) + ' % du flottant est vendu à découvert au 15 octobre : de quoi amplifier une bonne surprise, mais ces vendeurs ont eu raison depuis juillet, et ils couvrent en ' + c.fr(siDays(c), 1) + ' jours de volume selon FINRA.'];
};

function siDays(c) { const q = (((c.extra || {}).quote || {}).data || { items: [] }).items.find(x => x.type === 'instrument_short_interest'); return q.daysToCover; }

module.exports.missingData = c => [
  'Mouvement implicite aux résultats non disponible : la chaîne d’options a été relevée marché fermé, sans prix ni intérêt ouvert exploitables.',
  'Part des visiteurs venus de la recherche jamais chiffrée par la société ; seule la lettre aux actionnaires qualifie ces visites de « heurtées ».',
  'Revenus de licence de contenu non publiés à part (inclus dans les 43 M$ d’autres revenus du deuxième trimestre) ; les deux partenaires ne sont pas nommés au 10-K ; 92,1 M$ d’obligations de prestation restantes au 30 juin, surtout des licences.',
  'Ventilation entre utilisateurs connectés et non connectés supprimée à partir du troisième trimestre (10-Q du 31 juillet) : la série la plus parlante sur l’audience américaine s’arrête au 30 juin.',
  'Attentes des analystes pour le troisième trimestre non relevées ; seule la prévision de la société sert de référence.',
  'Relevé officiel des formulaires 4 incomplet sur l’année : les ventes d’initiés citées sont un minimum.',
  'Statistiques des pairs relevées en instantané, sans historique daté.'];

module.exports.base = base;
