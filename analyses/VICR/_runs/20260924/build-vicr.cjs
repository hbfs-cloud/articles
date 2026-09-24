'use strict';
// Dossier VICR v3 au close du 2026-09-23 (lot R05). Contenu éditorial et niveaux propres au titre ;
// calculs, provenance et preuves délégués au gabarit tools/lib/analysis-v3-r05.cjs : les données XBRL
// agrégées de la SEC (companyfacts) s'arrêtent au 31 mars 2026 à la collecte, les faits du 10-Q du
// 30 juin sont lus dans l'instance XBRL officielle de ce dépôt, hachée.
// Base d'actions : les deux catégories, actions ordinaires (34 389 014) et actions de catégorie B
// (11 717 718) au 22 juillet, page de garde du 10-Q. Le snapshot statistique ne compte que les premières.
const R = require('../../../../tools/lib/analysis-v3-r05.cjs');
const GEN = 'analyses/VICR/_runs/20260924/build-vicr.cjs';
const COMMON = 34389014, CLASS_B = 11717718;

R.build({
  ticker: 'VICR', shortName: 'Vicor', cik: 751978, generator: GEN, mode: 'pullback',
  xbrlInstance: { local: 'q2-10q__vicr-20260630_htm.xml', accn: '0001193125-26-322462', form: '10-Q', filed: '2026-07-29', url: 'https://www.sec.gov/Archives/edgar/data/751978/000119312526322462/vicr-20260630_htm.xml' },
  xbrl: { ttm: { rev: ['RevenueFromContractWithCustomerExcludingAssessedTax'], ebit: ['OperatingIncomeLoss'], ni: ['NetIncomeLoss'], da: ['DepreciationDepletionAndAmortization'], ocf: ['NetCashProvidedByUsedInOperatingActivities'], capex: ['PaymentsToAcquirePropertyPlantAndEquipment'], tax: ['IncomeTaxExpenseBenefit'], nonop: ['NonoperatingIncomeExpense'] },
    instant: { cashEq: ['CashAndCashEquivalentsAtCarryingValue'] }, da: ['da'], debt: [], cash: ['cashEq'] },
  scenarioBasis: 'ebitda', scenarioMultiple: 40,
  valuationBasis: 'GAAP douze mois au 2026-06-30 (XBRL SEC, instance du 10-Q pour le dernier trimestre) ; revenus = produits et redevances, hors règlement de litige ; EBITDA = résultat opérationnel + amortissements ; aucune dette financière au bilan du 30 juin ; trésorerie = liquidités du 30 juin ; 46,1 millions d’actions, ordinaires et de catégorie B, au 22 juillet ; multiple de quarante fois l’EBITDA = hypothèse éditoriale',
  shares: { value: COMMON + CLASS_B, doc: 0 },
  levels: { trigger: { d: '2026-09-21', c: 2 }, stop: { d: '2026-09-18', c: 3 }, s1: { d: '2026-09-23', c: 3 }, r1: { d: '2026-09-23', c: 2 }, r2: { d: '2026-07-06', c: 2 }, r3: { d: '2026-06-30', c: 2 } },
  supports: ['s1', 'trigger', 'stop'], resistances: ['r1', 'r2', 'r3'],
  targets: ({ lv }) => ({ tp1: lv('r1'), tp2: lv('r2') }),
  levelsMethod: 'Entrée = plus haut du 21 septembre, veille du gap du 22 ; stop = plus bas du 18 septembre ; TP1 = plus haut du 23 septembre ; TP2 = plus haut du 6 juillet ; plafond d’ouverture = (TP1 + 1,5 × stop) / 2,5 arrondi au cent inférieur ; pourcentages depuis l’entrée ; R/R = gain / risque.',
  inventory: 15,
  reviewScope: 'Dépôts EDGAR de Vicor du 1er août 2025 au 23 septembre 2026 (15 formulaires hors formulaires 3, 4, 5 et 144), dont le 10-K de l’exercice 2025. Le 8-K de l’assemblée (item 5.07), la procuration, le rapport annuel aux actionnaires et le formulaire SD sont écartés comme non décisionnels ; les 8-K de résultats et 10-Q antérieurs sont couverts par ceux du deuxième trimestre 2026.',
  docs: [
    ['2026-07-29', '10-Q', '0001193125-26-322462', 'vicr-20260630.htm', 'q2-10q__vicr-20260630.htm',
      'Rapport trimestriel au 30 juin 2026 : 34 389 014 actions ordinaires et 11 717 718 actions de catégorie B au 22 juillet ; redevances de 30,4 M$ au trimestre contre 10,4 M$ un an plus tôt ; liquidités de 453,6 M$ ; aucune dette financière.'],
    ['2026-07-21', '8-K / Exhibit 99.1', '0001193125-26-309538', 'd115827dex991.htm', 'q2-8k__d115827dex991.htm',
      'Communiqué du deuxième trimestre, daté du 21 juillet : produits et redevances de 143,4 M$, +26,9 % sur le trimestre précédent ; marge brute de 58,0 % ; bénéfice de 1,04 $ par action ; carnet de commandes de 380 M$, +145 % sur un an ; premier atelier de puces proche de la pleine capacité, un second en préparation.'],
    ['2026-03-02', '10-K', '0001193125-26-085102', 'vicr-20251231.htm', 'fy25-10k__vicr-20251231.htm',
      'Rapport annuel de l’exercice 2025 : un client non nommé à 11,1 % des revenus ; le fondateur Patrizio Vinciarelli détient 94,0 % des actions de catégorie B, à dix voix chacune ; la Chine et Hong Kong pèsent 11,9 % des revenus.'],
    ['2026-08-27', '8-K', '0001193125-26-370420', 'd161606d8k.htm', 'aug27-8k__d161606d8k.htm',
      'Programme de rachat d’actions porté à 150 M$ le 25 août, sans date d’expiration, en remplacement du précédent ; aucune obligation d’acheter un montant donné. C’est un rachat, pas une émission.'],
    ['2026-09-10', '8-K', '0001193125-26-387927', 'd539177d8k.htm', 'sep10-8k__d539177d8k.htm',
      'Statuts modifiés le 9 septembre pour préciser les règles de révocation des administrateurs, article II, section 6. Gouvernance, sans effet sur le capital ni sur l’activité.'],
  ],
  needles: {
    q2q: [0, ['Common Stock, $.01 par value 34,389,014 Class B Common Stock, $.01 par value 11,717,718', 'Royalty revenue 30,426 10,353', 'Cash and cash equivalents $ 453,582 $ 402,805', 'Other — — — $ 49,191 $ 94,161 $ 143,352']],
    q2: [1, ['Product and royalty revenues for the second quarter ended June 30, 2026 totaled $143.4 million, a 26.9% sequential increase', 'Gross margin, as a percentage of revenue, increased to 58.0% for the second quarter of 2026', 'Net income for the second quarter was $49.8 million, or $1.04 per diluted share', 'Backlog for the second quarter ended June 30, 2026 totaled $380 million, a 26% sequential increase from $301 million at the end of the first quarter of 2026, and increased 145%', 'we are taking steps toward a second fab']],
    annual: [2, ['manufactured by a limited number of wafer foundries', 'one customer accounted for approximate', '11.1 %, 12.1 %, and 10.7 % of total net revenues', 'Dr. Vinciarelli owns 94.0% of the issued and outstanding shares of our Class B Common Stock, which possess 10 votes per share', 'Net revenues from customers in China and Hong Kong, accounted for approximately 11.9% in 2025']],
    buyback: [3, ['approved a new share repurchase authorization for the repurchase of up to $150,000,000 of shares', 'The repurchase program has no expiration date']],
    bylaws: [4, ['amended Vicor’s By-laws to clarify provisions relating to the removal of directors in Article II, Section 6']],
  },
  sectionDocs: { verdict: [1, 0], business: [1, 0, 2], news: [1, 3], earnings: [1], capitalStructure: [0, 3, 2], filingsReview: [0, 1, 2, 3, 4], risks: [1, 2], globalScore: [1], meta: [1], disclaimer: [1], macro: [2], options: [1], social: [1], header: [0] },
  score: { business: 20, technical: 3, capital: 1, calendar: -1, dilution: 0, risk: 18 },
  peers: true,
  peerFicheSha: { NVDA: 'f3c08096c473be6eacb47ebd022f0711b327aff4a3d219d285bd6933799e50d0' },
  route: (p, { prov, dep, B }) => /^news\.[01]\./.test(p) ? prov('bars', B, 'Ouverture et clôture lues sur les barres certifiées ; écart d’ouverture = ouverture / clôture de la veille − 1 ; comparaison avec Monolithic Power et Navitas sur la même séance.', [dep('comparison', '')]) : null,
  riskScoreReason: 'Jugement qualitatif sur dix : titre à +39 % en quatre semaines et 32 % au-dessus de sa moyenne à vingt séances, valorisation de plus de cent fois l’EBITDA, ATR de 18 $ et contrôle des votes par le fondateur.',
  compose: c => {
    const { fr, usd, pct, sgn, close, prev, bars, N, tech, st, M, adv, ret, G$, marketCap, ev, scn, entry, stop, tp1, tp2, cap, rr1, rr2, riskAtr, sizeExample, ref, market, docs, raw, peerStat, peerFiche, lv, g } = c;
    const taxTtm = g.tax.value, preTax = G$.ni + taxTtm, niNorm = preTax * (1 - 0.21), peNorm = marketCap / niNorm;
    const cmp = raw.comparison_bars.data.items[0].results[0].data;
    const dr = (sym, d) => { const b = cmp.find(x => x.symbol === sym).bars, i = b.findIndex(x => x[0] === d); return pct(b[i][4], b[i - 1][4]); };
    const bar = d => bars.find(b => b[0] === d), prevOf = d => bars[bars.findIndex(b => b[0] === d) - 1];
    const d0917 = bar('2026-09-17'), p0917 = prevOf('2026-09-17'), d0922 = bar('2026-09-22'), p0922 = prevOf('2026-09-22');
    const d0827 = bar('2026-08-27'), d0828 = bar('2026-08-28'), d0702 = bar('2026-07-02'), p0702 = prevOf('2026-07-02');
    const runPct = pct(close, d0827[4]), ext20 = pct(close, tech.ema20), rrNow = (tp1 - close) / (close - stop);
    const evRev = ev / G$.rev, evEbitda = ev / G$.ebitda, pe = marketCap / G$.ni, mcapCommon = close * COMMON;
    const mpwrEb = peerStat('MPWR'), vrtEb = peerStat('VRT'), adiEb = peerStat('ADI'), nvdaEb = peerFiche('NVDA', 'EV/EBITDA GAAP').value;
    const upPct = (cap / entry - 1) * 100, dnPct = (1 - stop / entry) * 100;
    let up = 0, dn = 0; for (let i = N - 249; i <= N; i++) { const g = pct(bars[i][1], bars[i - 1][4]); if (g > upPct) up++; if (g < -dnPct) dn++; }
    const bufAtr = (cap - entry) / tech.atr14;
    return {
      meta: { lang: 'fr', dir: 'ltr', level: 'intermediate', tags: ['us', 'equities', 'ai-chain', 'semis', 'technology'], grade: 'C', date: '2026-09-24', dateDisplay: '24 septembre 2026', version: 3, status: 'watch', assetType: 'stock', levelsCloseDate: c.REF,
        description: 'Vicor : carnet de commandes +145 %, redevances triplées, et un titre à +39 % en quatre semaines. Dossier au close du 23 septembre 2026, statut surveiller, aucun achat au cours actuel.',
        ogDescription: 'VICR : carnet de 380 M$, redevances de 30,4 M$ ; titre à 283,16 $, +39 % depuis le 27 août et 32 % au-dessus de sa moyenne à vingt séances ; entrée sur repli seulement.',
        lastMcpRefresh: raw.status.captured_at, levelsVerifiedAt: raw.status.captured_at,
        statusHistory: [{ at: raw.status.captured_at, from: 'wait', to: 'watch', note: 'refonte v3 du 24 septembre : nouveau scénario, clôture de référence du 2026-09-23', close }] },
      header: { ticker: 'VICR', name: 'Vicor Corporation', exchange: 'NASDAQ', sector: 'Modules d’alimentation électrique et licences de conversion de puissance', price: close, changePct: pct(close, prev),
        badges: [{ text: 'SURVEILLER — AUCUN ACHAT AU COURS ACTUEL, ENTRÉE SUR REPLI', color: 'blue' }, { text: 'Chaîne IA — alimentation des processeurs', color: 'purple' }],
        metrics: { marketCap: fr(marketCap / 1e9, 1) + ' Md$', volume: fr(bars[N][5] / 1e6, 2) + ' M', evEbitda: fr(evEbitda, 0) + '×' }, halalStatus: 'unknown' },
      verdict: { score: 41, conviction: 'Low', bias: 'Neutral',
        confidence: 'Score éditorial non prédictif. Les chiffres d’entreprise viennent des dépôts SEC et des données XBRL officielles ; les niveaux, du close certifié du 23 septembre.',
        summary: 'Vicor vend des modules qui alimentent les processeurs et licencie ses brevets de conversion de puissance. Au deuxième trimestre, produits et redevances ont atteint 143,4 M$, les redevances seules 30,4 M$ contre 10,4 M$, et le carnet de commandes 380 M$, +145 % sur un an. Le titre en a fait un pari : +' + fr(runPct, 1) + ' % depuis le 27 août, dont ' + sgn(pct(d0922[4], p0922[4]), 1) + ' le 22 septembre, sans dépôt qui l’explique. À ' + usd(close) + ', il se paie ' + fr(evEbitda, 0) + ' fois l’EBITDA GAAP des douze derniers mois, contre ' + fr(mpwrEb, 0) + ' fois pour Monolithic Power. Au cours actuel, avec un stop sous le plus bas du 18 septembre, le gain vers ' + usd(tp1) + ' ne paie que ' + fr(rrNow, 2) + ' fois le risque : pas d’achat. Signal utile : un repli clôturant entre ' + usd(stop) + ' et ' + usd(entry) + '.',
        whyBuy: [
          'Carnet de commandes de 380 M$ au 30 juin, +26 % sur le trimestre et +145 % sur un an.',
          'Redevances de 30,4 M$ au trimestre, trois fois celles d’un an plus tôt, à marge presque pleine.',
          'Marge brute remontée à 58,0 % ; premier atelier de puces proche de la pleine capacité, un second en préparation.',
          '453,6 M$ de liquidités, aucune dette financière et un rachat d’actions autorisé jusqu’à 150 M$.'],
        whyAvoid: [
          'Le titre a pris +' + fr(runPct, 1) + ' % en quatre semaines : au cours actuel, le R/R vers le premier objectif vaut ' + fr(rrNow, 2) + '.',
          'Plus de ' + fr(Math.floor(evEbitda / 10) * 10, 0) + ' fois l’EBITDA GAAP des douze derniers mois, plus de deux fois Monolithic Power.',
          'Un ATR de ' + usd(tech.atr14) + ' : le titre bouge de plus de 6 % dans une séance ordinaire, et a perdu 19,2 % le 2 juillet.',
          'Le fondateur détient 94,0 % des actions de catégorie B, à dix voix chacune : les minoritaires ne pèsent pas sur les décisions.'],
        controlChecklist: [
          { label: 'Historique de cours', status: 'pass', statusLabel: 'Trois cents séances continues', evidence: 'Série quotidienne certifiée au close du 23 septembre, source de repli documentée.', action: 'Niveaux et indicateurs recalculés sur cette seule série.' },
          { label: 'Nombre d’actions', status: 'warn', statusLabel: 'Deux catégories', evidence: '34,4 millions d’actions ordinaires et 11,7 millions de catégorie B au 22 juillet ; certaines statistiques de marché ne comptent que les premières.', action: 'Capitalisation calculée sur 46,1 millions d’actions, soit ' + fr(marketCap / 1e9, 1) + ' Md$ et non ' + fr(mcapCommon / 1e9, 1) + ' Md$.' },
          { label: 'Calendrier', status: 'warn', statusLabel: 'Publication vers le 20 octobre', evidence: 'Date donnée par un seul calendrier collecté, non confirmée par l’émetteur ; aucune publication des comparables dans les quatorze jours collectés.', action: 'Ne pas garder une position ouverte sur repli au-delà d’une date confirmée.' }] },
      business: { theme: 'Modules de conversion d’énergie pour processeurs, licences de brevets et marchés industriels',
        overview: '<p>Vicor conçoit et fabrique des modules qui convertissent et distribuent l’électricité jusqu’au processeur, et licencie ses brevets de conversion de puissance. Au deuxième trimestre 2026, produits et redevances ont atteint 143,4 M$, +26,9 % sur le trimestre précédent : 112,9 M$ de produits et 30,4 M$ de redevances, contre 10,4 M$ un an plus tôt.</p><p>La marge brute est remontée à 58,0 % et le bénéfice à 1,04 $ par action. Le carnet de commandes a atteint 380 M$, +145 % sur un an, porté par le calcul de haute performance, les équipements de test et la défense. Le directeur général indique que le premier atelier de puces approche de la pleine capacité et qu’un second se prépare.</p><p>La société n’a pas de dette financière et détenait 453,6 M$ de liquidités au 30 juin ; le 25 août, le conseil a autorisé jusqu’à 150 M$ de rachats d’actions. Un client non nommé a pesé 11,1 % des revenus 2025.</p>',
        moat: 'L’avantage tient aux brevets de distribution d’énergie à haute densité, que Vicor fait payer par des licences et défend en justice, et à une fabrication intégrée de ses modules. Il reste à prouver en volume chez les grands fabricants de serveurs d’IA, qui achètent aussi à Monolithic Power et aux géants de l’analogique.',
        segments: [
          { name: 'Produits avancés', revenue: '94,2 M$ au deuxième trimestre', pct: '66 % des revenus', description: 'Modules à haute densité pour processeurs et calcul, redevances comprises.' },
          { name: 'Produits en briques', revenue: '49,2 M$ au deuxième trimestre', pct: '34 % des revenus', description: 'Modules d’alimentation classiques pour l’industrie, la défense et le ferroviaire.' }],
        sourceRefs: [ref(1), ref(0), ref(2)],
        coverageMatrix: [
          { facet: 'Cours et historique', status: 'COUVERT', decision: 'Trois cents séances continues, close certifié ; base des niveaux et des indicateurs.' },
          { facet: 'Résultats et guidance', status: 'COUVERT — PRIMAIRE', decision: 'Communiqué du 21 juillet et 10-Q ; la société ne donne pas de prévision chiffrée.' },
          { facet: 'Capital et dette', status: 'COUVERT — PRIMAIRE', decision: 'Deux catégories d’actions comptées ; rachat autorisé ; aucune dette financière.' },
          { facet: 'Agrégats GAAP', status: 'COUVERT — XBRL', decision: 'Douze mois glissants au 30 juin 2026 ; dernier trimestre lu dans les données structurées du 10-Q.' },
          { facet: 'Comparables et transmission', status: 'COUVERT — LOCAL', decision: 'Corrélations recalculées sur barres certifiées depuis la fin mars.' },
          { facet: 'Initiés', status: 'PARTIEL', decision: 'Ventes d’un vice-président le 1er septembre ; couverture officielle incomplète.' },
          { facet: 'Options', status: 'NON EXPLOITABLE', decision: 'Chaîne relevée en séance le 24 septembre, non rattachée à la clôture de référence.' }] },
      news: [
        { date: '2026-09-22', title: 'Gap de ' + sgn(pct(d0922[1], p0922[4]), 1) + ', clôture à ' + sgn(pct(d0922[4], p0922[4]), 1), impact: 'positive', detail: 'Le titre ouvre à ' + usd(d0922[1]) + ' contre ' + usd(p0922[4]) + ' la veille, descend à ' + usd(d0922[3]) + ' puis clôture au plus haut, ' + usd(d0922[4]) + '. Monolithic Power fait ' + sgn(dr('MPWR', '2026-09-22'), 2) + ' et Navitas ' + sgn(dr('NVTS', '2026-09-22'), 2) + ' le même jour : le mouvement est propre à Vicor ; aucun dépôt ouvert ici n’en donne la cause.', source: 'Barres certifiées', sourceUrl: c.evidenceUrl },
        { date: '2026-09-17', title: 'Gap de ' + sgn(pct(d0917[1], p0917[4]), 1) + ', clôture à ' + sgn(pct(d0917[4], p0917[4]), 1), impact: 'positive', detail: 'Ouverture à ' + usd(d0917[1]) + ' contre ' + usd(p0917[4]) + ' la veille, clôture à ' + usd(d0917[4]) + '. Monolithic Power fait ' + sgn(dr('MPWR', '2026-09-17'), 2) + ' et SMH ' + sgn(dr('SMH', '2026-09-17'), 2) + ' la même séance. Le gap entre ' + usd(bar('2026-09-16')[2]) + ' et ' + usd(d0917[3]) + ' n’est pas comblé.', source: 'Barres certifiées', sourceUrl: c.evidenceUrl },
        { date: '2026-08-25', title: 'Rachat d’actions porté à 150 M$', impact: 'positive', detail: 'Nouvelle autorisation de rachat jusqu’à 150 M$, sans date d’expiration, qui remplace la précédente ; environ 1,1 % de la capitalisation actuelle.', source: 'Vicor — SEC', sourceUrl: docs[3].url }],
      fundamentals: { rows: [
          { metric: 'Produits et redevances du deuxième trimestre', value: '143,4 M$', signal: '+26,9 % sur le trimestre précédent ; +49 % sur un an hors règlement de litige de 45 M$ en 2025', signalColor: 'green', _src: 1, _also: [0] },
          { metric: 'Redevances du deuxième trimestre', value: '30,4 M$', signal: 'Contre 10,4 M$ un an plus tôt', signalColor: 'green', _src: 0 },
          { metric: 'Marge brute du deuxième trimestre', value: '58,0 %', signal: 'Contre 55,2 % au premier trimestre', signalColor: 'green', _src: 1 },
          { metric: 'Carnet de commandes au 30 juin 2026', value: '380 M$', signal: '+26 % sur le trimestre, +145 % sur un an', signalColor: 'green', _src: 1 },
          { metric: 'Revenus GAAP sur douze mois', value: fr(G$.rev / 1e6, 0) + ' M$', signal: 'Produits et redevances, douze mois glissants au 30 juin 2026 (XBRL SEC)', signalColor: 'blue', _src: 'gaap' },
          { metric: 'Résultat opérationnel GAAP sur douze mois', value: fr(G$.ebit / 1e6, 0) + ' M$', signal: 'Marge de ' + fr(G$.ebit / G$.rev * 100, 1) + ' %, douze mois glissants au 30 juin 2026', signalColor: 'green', _src: 'gaap' },
          { metric: 'Résultat net GAAP sur douze mois', value: fr(G$.ni / 1e6, 0) + ' M$', signal: 'Supérieur au résultat opérationnel : ' + fr(g.nonop.value / 1e6, 1) + ' M$ de produits financiers et un impôt négatif de ' + fr(-taxTtm / 1e6, 1) + ' M$ sur douze mois', signalColor: 'amber', _src: 'gaap' },
          { metric: 'Flux de trésorerie opérationnel sur douze mois', value: fr(G$.ocf / 1e6, 0) + ' M$', signal: 'Premier trimestre pesé par un versement de 28,6 M$ au titre d’un litige passé', signalColor: 'amber', _src: 'gaap', _also: [1] },
          { metric: 'Flux de trésorerie libre sur douze mois', value: fr(G$.fcf / 1e6, 0) + ' M$', signal: 'Après ' + fr(G$.capex / 1e6, 0) + ' M$ d’investissements', signalColor: 'green', _src: 'gaap' },
          { metric: 'Liquidités au 30 juin 2026', value: fr(G$.cash / 1e6, 1) + ' M$', signal: 'Aucune dette financière au bilan', signalColor: 'green', _src: 'gaap', _also: [0] },
          { metric: 'EV/EBITDA GAAP', value: fr(evEbitda, 0) + '×', signal: 'Valeur d’entreprise au close du 2026-09-23, 46,1 millions d’actions des deux catégories, sur EBITDA GAAP douze mois au 2026-06-30', signalColor: 'red', source: 'Clôture certifiée et XBRL SEC', comparison: 'Versus Monolithic Power à ' + fr(mpwrEb, 1) + '×, Vertiv à ' + fr(vrtEb, 1) + '× et Analog Devices à ' + fr(adiEb, 1) + '× (statistiques courantes du 24 septembre, non point-in-time), Nvidia à ' + nvdaEb + ' (fiche publiée, même base et même date) : Vicor se paie au-dessus de tout son secteur.', _src: 'market', _peers: ['MPWR', 'VRT', 'ADI'], _peerFiches: ['NVDA'] },
          { metric: 'EV/revenus GAAP', value: fr(evRev, 1) + '×', signal: 'Valeur d’entreprise au close du 2026-09-23 sur revenus GAAP douze mois au 2026-06-30', signalColor: 'red', source: 'Clôture certifiée et XBRL SEC', comparison: 'Versus Monolithic Power à ' + fr(peerStat('MPWR', 'enterpriseToRevenue'), 1) + '× (statistiques courantes, non point-in-time).', _src: 'market', _peers: ['MPWR'], _peerField: 'enterpriseToRevenue' },
          { metric: 'P/E GAAP avec impôt normalisé à 21 %', value: fr(peNorm, 0) + '×', signal: 'Capitalisation au 2026-09-23, deux catégories d’actions, sur le résultat avant impôt GAAP douze mois au 2026-06-30 diminué d’un impôt supposé de 21 %, au lieu de l’impôt négatif publié', signalColor: 'red', source: 'Clôture certifiée et XBRL SEC', comparison: 'Versus le P/E GAAP publié de ' + fr(pe, 0) + '× : l’avantage fiscal de la période flatte le bénéfice d’environ ' + fr((G$.ni / niNorm - 1) * 100, 0) + ' %.', _src: 'market' },
          { metric: 'EV/EBITDA — scénario de compression (hypothèse éditoriale)', value: fr(scn.price, 2) + ' $ par action', signal: 'Scénario : multiple ramené à quarante fois l’EBITDA GAAP douze mois au 2026-06-30 par hypothèse, bilan du 30 juin, soit ' + fr(scn.downside_pct, 0) + ' % sous le close du 2026-09-23', signalColor: 'red', source: 'Clôture certifiée et XBRL SEC', comparison: 'Versus Monolithic Power à ' + fr(mpwrEb, 1) + '× : quarante fois reste une prime sur le leader ; ce que coûterait un carnet qui cesse de croître, pas un objectif.', _src: 'market', _peers: ['MPWR'] }],
        sourceRefs: [ref(0), ref(1), market('fondamentaux et statistiques')] },
      earnings: { quarters: [],
        beatNote: 'Deuxième trimestre 2026 : produits et redevances de 143,4 M$, marge brute de 58,0 %, bénéfice de 1,04 $ par action et flux opérationnel de 34,0 M$. La société ne publie pas de guidance chiffrée ; le carnet de commandes de 380 M$, en hausse de 26 % sur le trimestre, tient lieu de visibilité, et la direction prépare un second atelier de puces parce que le premier approche de sa pleine capacité. Prochaine publication : 20 octobre selon un seul calendrier collecté, non confirmée par l’émetteur.',
        nextEarnings: '20 octobre 2026 selon un calendrier collecté, date non confirmée par l’émetteur.',
        sourceRefs: [ref(1)] },
      capitalStructure: { sharesOutstanding: '34 389 014 actions ordinaires et 11 717 718 actions de catégorie B au 22 juillet 2026 (page de garde du 10-Q)',
        sharesAuthorized: 'Actions autorisées non reprises : non décisionnel pour ce dossier.', dilutionRisk: 'low',
        shareHistory: 'Base retenue : les deux catégories, soit 46 106 732 actions. Passage au nombre dilué : le 10-Q compte 1,8 million d’options dilutives au deuxième trimestre, non ajoutées au dénominateur. Les actions de catégorie B portent dix voix ; le fondateur en détient 94,0 %. Aucune dette, aucun programme d’émission sur le marché ; le rachat autorisé de 150 M$ réduirait le nombre d’actions s’il est utilisé.',
        warrants: [], atm: { active: false, authorized: 'Aucun programme d’émission d’actions sur le marché relevé', used: 'Sans objet', remaining: 'Sans objet' },
        sourceRefs: [ref(0), ref(3), ref(2)] },
      filingsReview: { summary: 'Cinq dépôts décisionnels ouverts et hachés. Ils montrent une société sans dette dont le carnet et les redevances explosent, qui rachète ses actions, et dont le contrôle reste entre les mains du fondateur. Aucun dépôt n’explique les gaps de septembre.',
        filings: docs.map(d => ({ date: d.date, form: d.form, accession: d.accession, finding: d.finding, url: d.url })),
        contrarianRisks: [
          'Les redevances dépendent de licences et de litiges : leur rythme de 30 M$ par trimestre n’est pas garanti.',
          'Un carnet de commandes n’est pas un chiffre d’affaires ; il peut être annulé ou décalé si un grand client change de fournisseur.',
          'Le cours intègre déjà un succès en volume chez les fabricants de serveurs d’IA, qui n’apparaît pas encore dans les ventes.',
          'Le contrôle des votes par le fondateur limite l’influence des actionnaires minoritaires.'] },
      technicals: { rsi14: +tech.rsi14.toFixed(2), macd: +tech.macd.toFixed(2), macdSignal: +tech.macdSignal.toFixed(2), ema20: +tech.ema20.toFixed(2), ema50: +tech.ema50.toFixed(2), ema200: +tech.ema200.toFixed(2),
        ma50Type: 'EMA', ma200Type: 'EMA', ma50Available: true, ma200Available: true, atr14: +tech.atr14.toFixed(2),
        badges: ['RSI à ' + fr(tech.rsi14, 0) + ', ' + fr(ext20, 1) + ' % au-dessus de la moyenne à vingt séances', 'Deux gaps en septembre', '+' + fr(runPct, 1) + ' % depuis le 27 août'],
        supports: [lv('s1'), entry, stop], resistances: [tp1, tp2, lv('r3')],
        setupNote: 'Le titre clôture à ' + usd(close) + ', ' + fr(ext20, 1) + ' % au-dessus de sa moyenne à vingt séances, avec un RSI de ' + fr(tech.rsi14, 0) + ' et un ATR de ' + usd(tech.atr14) + '. Pas d’achat au cours actuel. Activation : une clôture comprise entre ' + usd(stop) + ' exclu et $' + entry.toFixed(2) + ' inclus, retour au plus haut du 21 septembre, puis achat à l’ouverture suivante ; une clôture sous ' + usd(stop) + ' annule le plan sans l’activer. Après activation, stop sous $' + stop.toFixed(2) + ', plus bas du 18 septembre, soit ' + fr(riskAtr, 2) + ' ATR sous l’entrée. Supports : ' + usd(lv('s1')) + ', ' + usd(entry) + ' et ' + usd(stop) + '. Résistances : ' + usd(tp1) + ', ' + usd(tp2) + ' et ' + usd(lv('r3')) + ', sommet du 30 juin.',
        wyckoff: 'Non utilisé : le profil de volume n’est pas exploité dans ce dossier.',
        sourceRefs: [market('barres quotidiennes et indicateurs recalculés')] },
      options: { callOI: 'Non exploitable', putOI: 'Non exploitable', cpRatio: 'Non exploitable', maxPain: 'Non exploitable', ivMean: 'Non exploitable', skew: 'Chaîne relevée en séance le 24 septembre, non rattachée à la clôture de référence', unusual: 'Aucune activité inhabituelle qualifiée', sourceRefs: [market('options')] },
      shortInterest: { siPct: fr(st.shortPercentOfFloat * 100, 2) + ' % du flottant', daysToCover: fr(st.shortRatio, 2) + ' jours, date de règlement non précisée par la source', ctb: 'Coût d’emprunt non disponible à la collecte', trend: 'Positions vendeuses notables ; les rachats forcés ont pu amplifier les gaps de septembre, sans preuve dans les données collectées.', squeezeScore: 'Non retenu comme thèse', sourceRefs: [market('positions vendeuses')] },
      insiders: { signal: 'Le vice-président des ventes Philip Davies a vendu 3 073 actions le 1er septembre, entre 176 et 185 $ environ, selon ses formulaires 4. Aucun achat relevé. Couverture officielle partielle : aucun solde net publié.',
        recentTransactions: [],
        sourceRefs: [market('formulaires 4')] },
      macro: { indicators: [{ name: 'Clôture de référence', value: c.REF, signal: usd(close) + ', séance complète' }, { name: 'Rendement cinq séances', value: sgn(ret(5)), signal: 'Descriptif' }, { name: 'Rendement vingt et une séances', value: sgn(ret(21)), signal: 'Descriptif' }],
        regime: 'neutral', impact: 'Vicor dépend de la consommation électrique croissante des processeurs d’IA et des budgets de défense. La Chine et Hong Kong pèsent 11,9 % des revenus 2025 : droits de douane et restrictions d’exportation touchent une part visible de ses ventes.' },
      risks: { riskScore: 8, riskProfile: 'Very High',
        riskSummary: 'Le premier risque est le prix : +' + fr(runPct, 1) + ' % en quatre semaines, dont deux gaps sans dépôt explicatif, pour plus de ' + fr(Math.floor(evEbitda / 10) * 10, 0) + ' fois l’EBITDA. Le deuxième, la violence du titre : un ATR de ' + usd(tech.atr14) + ' et une chute de 19,2 % le 2 juillet. Le troisième, un carnet qui doit se transformer en ventes à des clients que la société ne nomme pas.',
        riskCards: [
          { title: 'Achat en retard', severity: 'critical', icon: 'fa-rocket', points: ['+' + fr(runPct, 1) + ' % depuis le 27 août.', 'R/R de ' + fr(rrNow, 2) + ' au cours actuel vers ' + usd(tp1) + '.'], verdict: 'Acheter maintenant, c’est payer deux gaps sans nouvelle et accepter un stop à plus de 70 $ sous le cours.' },
          { title: 'Valorisation extrême', severity: 'high', icon: 'fa-scale-balanced', points: [fr(evEbitda, 0) + ' fois l’EBITDA GAAP.', 'Monolithic Power à ' + fr(mpwrEb, 1) + ' fois.'], verdict: 'Le multiple suppose un succès en volume chez les grands clients de l’IA, pas encore visible dans les ventes.' },
          { title: 'Volatilité quotidienne', severity: 'high', icon: 'fa-arrows-up-down', points: ['ATR de ' + usd(tech.atr14) + '.', 'Séance du 2 juillet à ' + sgn(pct(d0702[4], p0702[4]), 1) + '.'], verdict: 'Une séance ordinaire couvre presque toute la distance entre l’entrée et le stop : la taille doit être réduite en conséquence.' },
          { title: 'Contrôle des votes', severity: 'medium', icon: 'fa-user-tie', points: ['Fondateur à 94,0 % des actions de catégorie B.', 'Dix voix par action de catégorie B.'], verdict: 'Les décisions de capital, de rachat et de gouvernance échappent en pratique aux actionnaires minoritaires, quel que soit leur poids.' }],
        pedagogy: 'Le 17 septembre montre un gap : la veille finissait à ' + usd(p0917[4]) + ', l’ouverture s’est faite à ' + usd(d0917[1]) + '. Un vendeur à découvert avec un stop entre les deux a été servi au premier prix disponible. Le slippage, l’écart dans une séance normale, est plus sensible ici : environ ' + fr(adv / 1e6, 0) + ' M$ échangés par séance seulement. La taille de la position doit supposer une ouverture défavorable et un carnet d’ordres plus mince que sur les grandes valeurs.' },
      tradeIdea: { status: 'watch', statusNote: 'Surveiller, entrée sur repli seulement. Pas d’achat au cours actuel de ' + usd(close) + ' : +' + fr(runPct, 1) + ' % depuis le 27 août, R/R de ' + fr(rrNow, 2) + ' vers TP1. Avant activation : si le titre clôture au-dessus de ' + usd(tp1) + ' avant tout repli, le plan est retiré. Activation : clôture strictement au-dessus de ' + usd(stop) + ' et au plus ' + usd(entry) + ', puis achat à l’ouverture suivante entre ' + usd(stop) + ' et ' + usd(cap) + '. Après activation : stop sous ' + usd(stop) + '. Le plan du 27 août, en attente sans déclencheur exécutable (repères de 203,45 $ et 188,68 $), n’a jamais été activé ; pour mémoire, la clôture du 27 août, ' + usd(d0827[4]) + ', dépassait le premier repère, et la séance du 28 est descendue à ' + usd(d0828[3]) + ', sous le second ; l’ordre des plus hauts et plus bas dans une séance n’est pas connu.',
        entry, stop, tp1, tp2,
        stopPct: pct(stop, entry).toFixed(1) + '%', tp1Pct: '+' + pct(tp1, entry).toFixed(1) + '%', tp2Pct: '+' + pct(tp2, entry).toFixed(1) + '%',
        rr: '1:' + rr1.toFixed(2) + ' TP1 / 1:' + rr2.toFixed(2) + ' TP2',
        entryNote: 'Activation sur une clôture revenue au plus haut du 21 septembre, strictement au-dessus de ' + usd(stop) + ' et au plus ' + usd(entry) + ', pas sur un passage en séance. Achat à l’ouverture suivante uniquement entre ' + usd(stop) + ' et ' + usd(cap) + ' : au plafond, le R/R vers TP1 vaut 1,50 ; au-dessus, il tomberait sous 1,5 ; une ouverture sous ' + usd(stop) + ' annule le plan, sans achat. Le plafond est à ' + usd(cap - entry) + ' au-dessus de l’entrée, ' + fr(bufAtr, 2) + ' ATR. Mesure sur les 250 dernières séances : ' + up + ' ouvertures ont dépassé la clôture de la veille de plus de ' + fr(upPct, 2) + ' %, l’écart relatif du plafond, et ' + dn + ' ont ouvert plus de ' + fr(dnPct, 1) + ' % sous la veille, l’écart relatif du stop. Le stop est à ' + fr(riskAtr, 2) + ' ATR : une séance ordinaire de Vicor couvre presque cette distance, le risque d’être sorti par le bruit est réel. Objectifs : TP1 au plus haut du 23 septembre, TP2 au plus haut du 6 juillet. Liquidité : environ ' + fr(adv / 1e6, 0) + ' M$ échangés par séance, médiane des vingt dernières. Exemple de taille, non personnalisé : avec un budget de perte de 100 $, le risque au plafond, ' + usd(cap - stop) + ' par action, donne ' + sizeExample + ' actions ; une ouverture sous le stop rendrait la perte réelle plus lourde.',
        horizon: 'Dix séances après activation',
        thesis: 'Le carnet de commandes justifie l’intérêt, pas le prix du jour. Un repli qui clôture au niveau du 21 septembre, sous $' + entry.toFixed(2) + ', ramènerait le titre là où il était avant le gap du 22, avec un risque mesurable. Après activation, le stop sous $' + stop.toFixed(2) + ' coupe si le rebond de septembre s’efface. TP1 à ' + usd(tp1) + ' et TP2 à ' + usd(tp2) + '. Ne pas poursuivre le titre, ne pas anticiper la clôture d’activation, ne pas acheter une ouverture au-dessus du plafond.',
        catalysts: ['Un repli qui clôture entre ' + usd(stop) + ' et ' + usd(entry) + ' sur un volume en baisse.', 'La confirmation par Vicor de sa date de publication du troisième trimestre et l’évolution du carnet de commandes.', 'Tout dépôt nommant un client de serveurs d’IA ou une nouvelle licence.'],
        invalidation: ['Avant activation : une clôture au-dessus de ' + usd(tp1) + ' sans repli retire le plan.', 'Avant activation : une clôture sous ' + usd(stop) + ' annule le plan sans l’activer.', 'Après activation : une clôture sous ' + usd(stop) + ' invalide le trade.', 'Ouverture hors de la fenêtre ' + usd(stop) + ' – ' + usd(cap) + ' après la clôture d’activation : pas d’achat.', 'Une baisse du carnet de commandes publiée avant activation annule la thèse.'] },
      globalScore: { profile: 'Carnet en forte hausse, redevances en hausse, titre en surchauffe',
        keyTakeawaysPositive: ['Carnet de 380 M$, +145 % sur un an.', 'Redevances triplées.', 'Aucune dette, rachat de 150 M$ autorisé.'],
        keyTakeawaysNegative: ['+' + fr(runPct, 1) + ' % en quatre semaines.', 'Plus de ' + fr(Math.floor(evEbitda / 10) * 10, 0) + ' fois l’EBITDA.', 'ATR de ' + usd(tech.atr14, 0) + ' par séance.'],
        mindsetTip: 'Un titre qui gagne 20 % en une séance sans nouvelle attire ceux qui ont peur de rater la suite. Le repli viendra ou ne viendra pas ; dans les deux cas, le plan décide, pas l’écran.' },
      social: { platforms: [], sourceRefs: [market('sentiment non retenu faute de mesure qualifiée')] },
      disclaimer: 'Document de recherche éducatif. Ni conseil financier, ni signal de trading. Statut surveiller : aucun ordre actif.',
    };
  },
  groups: [
    { name: 'Référence de l’alimentation des processeurs', order: 1, transmission: 'Le principal concurrent coté dans l’alimentation des processeurs d’IA.', rows: [
      ['MPWR', 'leader', 'Alimentation des processeurs et des cartes', 'Premier fournisseur de modules d’alimentation des cartes d’IA ; ses gains de parts se font sur le même marché que Vicor.']] },
    { name: 'Pairs directs : conversion de puissance', order: 1, transmission: 'Mêmes clients industriels et de serveurs pour la conversion d’énergie.', rows: [
      ['NVTS', 'direct_peer', 'Semi-conducteurs de puissance au nitrure de gallium', 'Concurrent sur la conversion à haut rendement pour les centres de données ; titre qui co-évolue le plus avec Vicor.'],
      ['ON', 'direct_peer', 'Semi-conducteurs de puissance', 'Concurrent sur les composants de puissance pour l’industrie et les centres de données.'],
      ['ADI', 'direct_peer', 'Analogique et gestion de l’alimentation', 'Concurrent historique sur l’alimentation industrielle et de défense.']] },
    { name: 'Amont : fonderies de plaquettes', order: 2, transmission: 'Le 10-K indique que certains produits avancés et composants sont fabriqués par un nombre limité de fonderies, non nommées : ces deux fonderies cotées servent de repère du cycle, pas de fournisseur documenté.', rows: [
      ['TSM', 'upstream', 'Fonderie de référence des procédés avancés', 'Repère de la capacité des fonderies dont dépendent certains composants de Vicor ; aucun contrat nommé dans les dépôts.'],
      ['GFS', 'upstream', 'Fonderie de procédés matures et de puissance', 'Repère des fonderies de procédés de puissance ; sert à lire les tensions de capacité, sans lien commercial documenté.']] },
    { name: 'Aval : serveurs et processeurs d’IA', order: 1, transmission: 'Les processeurs et les serveurs d’IA consomment de plus en plus de courant : c’est le marché des modules de Vicor.', rows: [
      ['NVDA', 'downstream', 'Concepteur de processeurs d’IA', 'Ses processeurs fixent les besoins de courant des cartes ; un changement d’architecture d’alimentation se lit chez Vicor.'],
      ['AMD', 'downstream', 'Concepteur d’accélérateurs d’IA', 'Même besoin de distribution d’énergie à haute densité pour ses accélérateurs.'],
      ['SMCI', 'downstream', 'Assembleur de serveurs d’IA', 'Assembleur de serveurs dont les choix de fournisseurs d’alimentation touchent Vicor.'],
      ['DELL', 'downstream', 'Fabricant de serveurs d’IA', 'Premier fabricant de serveurs d’IA ; ses volumes tirent la demande de modules.'],
      ['ALAB', 'downstream', 'Connectivité des serveurs d’IA', 'Même vague de serveurs d’IA ; sert de mesure du sentiment sur la chaîne des composants.']] },
    { name: 'Second ordre : infrastructure électrique', order: 2, transmission: 'Même contrainte d’énergie des centres de données, en amont de la carte.', rows: [
      ['VRT', 'second_order', 'Alimentation et refroidissement des centres de données', 'Même thème de puissance électrique des centres de données, un cran plus haut dans la chaîne.'],
      ['ETN', 'second_order', 'Distribution électrique industrielle', 'Distribution d’électricité des centres de données ; confirme ou infirme le thème de la puissance.']] },
    { name: 'Contrôles sectoriels', order: 2, transmission: 'Paniers de référence pour isoler ce qui est propre à Vicor.', rows: [
      ['SMH', 'sector_proxy', 'Panier de semi-conducteurs', 'Contrôle du secteur : un écart avec ce panier isole ce qui est propre à Vicor.'],
      ['XLK', 'sector_proxy', 'Panier technologique du S&P 500', 'Contrôle large de la technologie : un mouvement commun avec ce panier n’a rien de spécifique.'],
      ['QQQ', 'sector_proxy', 'Grandes valeurs du Nasdaq', 'Contrôle large : un mouvement commun avec ce panier n’a rien de spécifique au titre.']] },
  ],
  eventDefault: { leader: 'Aucune publication dans les quatorze jours collectés ; ses gains de parts restent le signal à suivre', direct_peer: 'Aucune publication dans les quatorze jours collectés ; ses prix et ses volumes sont à suivre', downstream: 'Aucune publication dans les quatorze jours collectés ; ses choix d’architecture d’alimentation sont à suivre', upstream: 'Aucune publication dans les quatorze jours collectés ; ses taux d’utilisation sont à suivre', second_order: 'Aucune publication dans les quatorze jours collectés ; ses commandes sont à suivre', sector_proxy: 'Panier sans publication propre ; exposé aux résultats de ses grandes pondérations' },
  eventRisk: {},
  blastDoc: 2,
  scenarios: c => [
    { scenario: 'bullish', trigger: 'Le titre consolide puis revient vers le plus haut du 21 septembre sans casser le plus bas du 18.', firstOrder: 'Une clôture au niveau du 21 septembre active le plan.', secondOrder: 'Monolithic Power et SMH tiennent ; le repli reste une consolidation.', confirmation: 'Une clôture entre ' + c.usd(c.stop) + ' et ' + c.usd(c.entry) + ' puis un rebond.', contradiction: 'Un repli de Vicor pendant que Monolithic Power monte.' },
    { scenario: 'mixed', trigger: 'Le titre digère sa hausse au-dessus de 240 $ sans revenir au niveau d’entrée.', firstOrder: 'Clôtures entre ' + c.usd(c.entry) + ' et ' + c.usd(c.tp1) + ' ; pas d’activation.', secondOrder: 'L’écart avec Monolithic Power se réduit sans information propre.', confirmation: 'Plusieurs séances au-dessus de ' + c.usd(c.entry) + ' sans nouveau plus haut.', contradiction: 'Une clôture au-dessus de ' + c.usd(c.tp1) + ', qui retire le plan.' },
    { scenario: 'bearish', trigger: 'Les gaps de septembre s’effacent faute de nouvelle qui les justifie.', firstOrder: 'Le titre clôture sous le plus bas du 18 septembre.', secondOrder: 'Navitas et Monolithic Power reculent avec lui.', confirmation: 'Une clôture sous ' + c.usd(c.stop) + ' avec Monolithic Power en baisse.', contradiction: 'Un repli de Vicor que ses pairs ne suivent pas.' }],
  contradictions: c => ['Le carnet de commandes bondit de 145 %, mais la société ne donne aucune prévision chiffrée : le marché extrapole un chiffre que Vicor ne s’engage pas à livrer.', 'Navitas co-évolue le plus avec Vicor, mais les deux sociétés vendent des technologies différentes : la corrélation mesure un sentiment commun, pas un lien commercial.'],
  missingData: c => ['Un client à 11,1 % des revenus 2025, non nommé : aucun client coté n’entre dans les comparables comme client documenté.', 'Base comptable agrégée de la SEC arrêtée au 31 mars : dernier trimestre lu dans les données structurées du 10-Q.', 'Aucune cause documentée des gaps du 17 et du 22 septembre ; chaîne d’options relevée en séance, non rattachée à la clôture ; sentiment non retenu.', 'Barres d’une source de repli pour toutes les séries.'],
  limitations: ['Barres d’une source de repli (Webull).', 'Options non rattachées à la clôture de référence.', 'Dernier trimestre GAAP lu dans les données structurées du 10-Q.'],
});
