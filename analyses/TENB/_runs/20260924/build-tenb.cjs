'use strict';
// Dossier TENB v3 au close du 2026-09-23 (lot R03). Aucun plan actif : le titre est au milieu de son couloir
// de septembre, sous des résistances rapprochées, après une émission convertible de 800 M$. Les niveaux du
// 27 août restent affichés comme référence archivée. Calculs et preuves : tools/lib/analysis-v3-r03.cjs.
const R = require('../../../../tools/lib/analysis-v3-r03.cjs');
const GEN = 'analyses/TENB/_runs/20260924/build-tenb.cjs';

R.build({
  ticker: 'TENB', shortName: 'Tenable', cik: 1660280, generator: GEN, mode: 'archived',
  xbrl: { ttm: { rev: ['RevenueFromContractWithCustomerExcludingAssessedTax'], ebit: ['OperatingIncomeLoss'], ni: ['NetIncomeLoss'], da: ['DepreciationDepletionAndAmortization'], ocf: ['NetCashProvidedByUsedInOperatingActivities'] },
    instant: { loan: ['DebtInstrumentCarryingAmount'], cashEq: ['CashAndCashEquivalentsAtCarryingValue'], stInv: ['ShortTermInvestments'] }, da: ['da'], debt: ['loan'], cash: ['cashEq', 'stInv'] },
  scenarioBasis: 'revenue', scenarioMultiple: 3,
  valuationBasis: 'GAAP douze mois au 2026-06-30 (XBRL SEC) ; prêt à terme en principal dans la dette, avant l’émission convertible du 15 septembre ; trésorerie = liquidités et placements à court terme ; multiple de trois fois les revenus = hypothèse éditoriale',
  levels: { s1: { d: '2026-09-23', c: 3 }, s2: { d: '2026-09-18', c: 3 }, s3: { d: '2026-09-11', c: 3 }, r1: { d: '2026-09-15', c: 2 }, r2: { d: '2026-08-14', c: 2 }, r3: { d: '2026-07-15', c: 2 } },
  supports: ['s1', 's2', 's3'], resistances: ['r1', 'r2', 'r3'],
  inventory: 21,
  reviewScope: 'Dépôts EDGAR de Tenable du 1er janvier au 23 septembre 2026 (21 formulaires hors formulaires 3, 4, 5 et 144), dont le 10-K de l’exercice 2025. Les 8-K de gouvernance (item 5.07), d’information (item 7.01), les procurations, le rapport annuel illustré et les déclarations 13G sont écartés comme non décisionnels ; le 10-Q du premier trimestre et le communiqué d’avril sont couverts par le 10-Q du deuxième trimestre. Le S-8 de février enregistre des actions de plans de rémunération. Le 8-K du 15 septembre, qui porte les items 2.03 et 3.02, est ouvert : c’est l’émission convertible.',
  docs: [
    ['2026-09-15', '8-K', '0001660280-26-000039', 'tenb-20260910.htm', 'sep15-8k__tenb-20260910.htm',
      'Émission privée de 800 M$ d’obligations convertibles à 0,25 % échéance 2031, prix de conversion d’environ 44,84 $, soit 17 840 400 actions potentielles ; options d’achat plafonnées à 64,06 $ pour 64,1 M$. Produit net de 778,8 M$ : rachat d’environ 170,5 M$ d’actions et remboursement complet du prêt à terme, dont le contrat est résilié.'],
    ['2026-07-29', '8-K / Exhibit 99.1', '0001660280-26-000032', 'q22026financialresults-ear.htm', 'q2-8k__q22026financialresults-ear.htm',
      'Communiqué du deuxième trimestre : revenus de 268,5 M$ (+8,6 %), résultat opérationnel GAAP de 12,4 M$, marge ajustée de 24,7 %. Prévision annuelle relevée à 1,075–1,081 Md$ de revenus ; 5,2 millions d’actions rachetées pour 100,0 M$ au trimestre.'],
    ['2026-08-04', '10-Q', '0001660280-26-000035', 'tenb-20260630.htm', 'q2-10q__tenb-20260630.htm',
      'Rapport trimestriel au 30 juin 2026 : 110 139 983 actions en circulation au 31 juillet ; 11,4 millions d’actions rachetées pour 230,0 M$ sur le semestre ; prêt à terme de 358,1 M$ en principal.'],
    ['2026-02-27', '10-K', '0001660280-26-000005', 'tenb-20251231.htm', 'fy25-10k__tenb-20251231.htm',
      'Rapport annuel de l’exercice 2025 : plus de 40 000 clients, dont aucun n’a dépassé 2 % des revenus sur trois exercices ; vente par distributeurs puis revendeurs ; centres de données confiés à Amazon Web Services, seul hébergeur nommé.'],
  ],
  needles: {
    convert: [0, ['$800,000,000 aggregate principal amount of 0.25% Convertible Senior Notes due 2031', '22.3005 shares of common stock per $1,000 principal amount', 'approximately $44.84 per share', '$64.06 per share', 'net proceeds from the Offering were approximately $778.8 million', 'approximately $64.1 million cost of the capped call transactions', 'to repurchase approximately $170.5 million of its common stock', 'The Credit Agreement was terminated effective September 15, 2026', 'the Notes are convertible into 17,840,400 shares of common stock']],
    q2: [1, ['Revenue of $268.5 million, year-over-year growth of 8.6%', 'Revenue in the range of $1.075 billion to $1.081 billion', 'Revenue in the range of $270.0 million to $273.0 million', 'Unlevered free cash flow in the range of $289.0 million to $295.0 million', 'GAAP income from operations was $12.4 million', 'Non-GAAP operating margin was 24.7%', '117.0 million diluted weighted average shares outstanding', 'Repurchased 5.2 million shares of our common stock for $100.0 million']],
    tenq: [2, ['110,139,983', 'we purchased 11.4 million shares for $230.0 million', 'Term loan $ 358,125', '132,356 and 129,046 shares issued', '21,914 and 10,596 shares']],
    annual: [3, ['no single customer represented more than 2% of our revenue', 'We outsource our data center needs to Amazon Web Services', 'over 40,000 customers']],
  },
  sectionDocs: { verdict: [0, 1], business: [3, 1], news: [0, 1], earnings: [1], capitalStructure: [0, 2], filingsReview: [0, 1, 2], risks: [0, 1], globalScore: [1], meta: [1], disclaimer: [1], macro: [1], options: [1], social: [1], header: [2] },
  score: { business: 14, technical: 0, capital: 2, calendar: 0, dilution: -2, risk: 32 },
  peers: true,
  shares: { value: 110139983, doc: 2 },
  route: (p, { prov, dep, B }) => /^news\.[01]\./.test(p) ? prov('bars', B, 'Ouverture et clôture lues sur les barres certifiées ; écart d’ouverture = ouverture / clôture de la veille − 1 ; comparaison avec CIBR et Qualys sur la même séance.', [dep('comparison', '')]) : null,
  riskScoreReason: 'Jugement qualitatif sur dix : croissance à un chiffre, titre coincé sous des résistances rapprochées et nouvelle dette convertible.',
  compose: c => {
    const { fr, usd, pct, sgn, close, prev, bars, N, tech, st, M, adv, ret, G$, g, marketCap, ev, scn, lv, entry, stop, tp1, tp2, rr1, rr2, ref, market, docs, raw, peerStat, archive, shares } = c;
    const evRev = ev / G$.rev, fwd = 1.078e9, evFwd = ev / fwd;
    const qlys = peerStat('QLYS', 'enterpriseToRevenue'), rpd = peerStat('RPD', 'enterpriseToRevenue'), chkp = peerStat('CHKP', 'enterpriseToRevenue');
    // Bilan après l'émission du 15 septembre, tel que décrit par le 8-K : dette = 800 M$ de convertibles ; trésorerie =
    // bilan du 30 juin + produit net − options plafonnées − rachat − principal du prêt au 30 juin.
    const buyShares = 170.5e6 / 32.03, sharesPf = shares - buyShares;
    const cashPf = G$.cash + 778.8e6 - 64.1e6 - 170.5e6 - g.loan.value, debtPf = 800e6, evPf = close * sharesPf + debtPf - cashPf;
    const bar = d => bars.find(b => b[0] === d), prevOf = d => bars[bars.findIndex(b => b[0] === d) - 1];
    const d0730 = bar('2026-07-30'), p0730 = prevOf('2026-07-30'), d0911 = bar('2026-09-11'), p0911 = prevOf('2026-09-11');
    const act = bar('2026-08-31'), stopHit = bar('2026-09-02'), oldRes = pct(stop, entry), oldClose = pct(stopHit[4], entry);
    // Dilution nette des convertibles : numéraire jusqu'au nominal, options plafonnées de 44,84 à 64,06 $ ; à un cours P > 64,06 $,
    // actions nettes ≈ 17 840 400 × (P − 64,06) / P. Illustration à 80 $.
    const netAt = P => P <= 64.06 ? 0 : 17840400 * (P - 64.06) / P, net80 = netAt(80);
    const rpdPrice = (rpd * G$.rev - G$.debt + G$.cash) / shares;
    const low = bars.slice(N - 250).reduce((m, b) => b[3] < m[3] ? b : m);
    return {
      meta: { lang: 'fr', dir: 'ltr', level: 'intermediate', tags: ['us', 'equities', 'ai-chain', 'software', 'technology'], grade: 'C+', date: '2026-09-24', dateDisplay: '24 septembre 2026', version: 3, status: 'no-trade', assetType: 'stock', levelsCloseDate: c.REF,
        description: 'Tenable : une croissance de 8,6 %, des rachats financés par 800 M$ de convertibles et un titre coincé sous 39 $. Dossier au close du 23 septembre 2026, aucun plan actif.',
        ogDescription: 'Tenable : revenus +8,6 %, 800 M$ de convertibles à 44,84 $, rachats massifs ; pas d’entrée au milieu du couloir.',
        lastMcpRefresh: raw.status.captured_at, levelsVerifiedAt: raw.status.captured_at,
        statusHistory: [{ at: raw.status.captured_at, from: 'wait', to: 'no-trade', note: 'refonte v3 du 24 septembre : aucun plan au cours actuel, clôture de référence du 2026-09-23', close }] },
      header: { ticker: 'TENB', name: 'Tenable Holdings, Inc.', exchange: 'NASDAQ', sector: 'Cybersécurité : gestion des vulnérabilités et de l’exposition', price: close, changePct: pct(close, prev),
        badges: [{ text: 'AUCUN PLAN — MILIEU DE COULOIR', color: 'amber' }, { text: 'Chaîne IA — surface d’attaque', color: 'purple' }],
        metrics: { marketCap: fr(marketCap / 1e9, 2) + ' Md$', volume: fr(bars[N][5] / 1e6, 2) + ' M', evRevenue: fr(evRev, 1) + '×' }, halalStatus: 'unknown' },
      verdict: { score: 46, conviction: 'Low', bias: 'Neutral',
        confidence: 'Score éditorial non prédictif. Les chiffres d’entreprise viennent des dépôts SEC et des données XBRL officielles ; les niveaux, du close certifié du 23 septembre.',
        summary: 'Tenable croît peu, 8,6 % au deuxième trimestre, mais rachète beaucoup : 11,4 millions d’actions au premier semestre, puis environ 170,5 M$ en septembre, financés par une émission de 800 M$ d’obligations convertibles à 0,25 %. Le nombre d’actions en circulation est tombé à 110,1 millions fin juillet, contre environ 118,5 millions fin 2025. C’est une stratégie de rendement par action, pas de croissance. Le titre est remonté de ' + usd(low[3]) + ' en avril à ' + usd(close) + ', et oscille depuis le 15 septembre entre ' + usd(lv('s2')) + ' et ' + usd(lv('r1')) + '. Au milieu de ce couloir, sous des résistances à ' + usd(lv('r2')) + ' et ' + usd(lv('r3')) + ', aucun point d’entrée ne donne un R/R de 1,5. Aucun plan.',
        whyBuy: [
          'À ' + fr(evRev, 1) + ' fois les revenus des douze derniers mois, Tenable se paie moins que Qualys (' + fr(qlys, 1) + '×) et que Check Point (' + fr(chkp, 1) + '×).',
          'La prévision annuelle a été relevée le 29 juillet à 1,075–1,081 Md$ de revenus, avec 289 à 295 M$ de flux libre avant intérêts.',
          'Aucun client ne dépasse 2 % des revenus, sur plus de 40 000 clients.',
          'Le nombre d’actions baisse : 11,4 millions rachetées pour 230,0 M$ au premier semestre, à environ 20 $ l’action.'],
        whyAvoid: [
          'La croissance du deuxième trimestre, 8,6 %, reste à un chiffre malgré la prévision relevée.',
          'La dette nette augmente d’environ ' + fr((debtPf - cashPf - (G$.debt - G$.cash)) / 1e6, 0) + ' M$ avec l’émission de septembre, pour financer en partie des rachats.',
          'Les convertibles portent au maximum théorique 17 840 400 actions ; réglées en numéraire jusqu’au nominal et couvertes jusqu’à 64,06 $, elles ne diluent rien sous ce cours, et environ ' + fr(net80 / 1e6, 1) + ' millions d’actions nettes à 80 $, soit ' + fr(net80 / shares * 100, 1) + ' % du capital de fin juillet.',
          'Le titre est coincé entre ' + usd(lv('s2')) + ' et ' + usd(lv('r1')) + ', avec deux résistances rapprochées au-dessus.'],
        controlChecklist: [
          { label: 'Historique de cours', status: 'pass', statusLabel: 'Trois cents séances continues', evidence: 'Série quotidienne certifiée au close du 23 septembre, source de repli documentée.', action: 'Supports et résistances lus sur cette seule série.' },
          { label: 'Émission convertible', status: 'warn', statusLabel: '800 M$ à 44,84 $', evidence: 'Le 8-K du 15 septembre (items 2.03 et 3.02) décrit 800 M$ d’obligations à 0,25 % échéance 2031, convertibles en 17 840 400 actions au maximum théorique, réglées en numéraire jusqu’au nominal et couvertes par des options plafonnées jusqu’à 64,06 $.', action: 'Dilution nulle sous 44,84 $ ; à surveiller au-delà de 64,06 $.' },
          { label: 'Calendrier', status: 'pass', statusLabel: 'Aucune publication dans l’horizon', evidence: 'Aucune date de résultats de Tenable ni d’un comparable dans les quatorze jours du calendrier collecté ; la date du troisième trimestre n’est pas annoncée.', action: 'Vérifier la date avant de construire un nouveau plan.' }] },
      business: { theme: 'Gestion de l’exposition : inventaire des vulnérabilités et des failles de configuration',
        overview: '<p>Tenable recense ce qui peut être attaqué dans un système d’information, serveurs, postes, applications, comptes cloud, et classe ces failles par gravité pour dire à l’équipe de sécurité quoi corriger d’abord. Sa plateforme Tenable One regroupe ces inventaires et y ajoute des outils d’IA. Plus de 40 000 clients l’utilisent, dont aucun ne pèse plus de 2 % des revenus.</p><p>Le métier est mûr : au deuxième trimestre 2026, les revenus ont atteint 268,5 M$, en hausse de 8,6 %. La rentabilité progresse plus vite que la croissance, avec une marge opérationnelle ajustée de 24,7 % et, pour la première fois depuis longtemps, un résultat opérationnel GAAP positif de 12,4 M$. La prévision annuelle, relevée en juillet, vise 1,075 à 1,081 Md$ de revenus.</p><p>La direction a choisi de rendre le capital plutôt que d’acheter de la croissance. Elle a racheté 11,4 millions d’actions au premier semestre, puis a lancé en septembre une émission de 800 M$ d’obligations convertibles dont le produit rembourse le prêt à terme et finance un nouveau rachat. L’infrastructure est hébergée par Amazon Web Services.</p>',
        moat: 'L’avantage tient à la base installée et à la réputation de ses scanners, présents chez une large part des grandes entreprises. Il s’use à mesure que les plateformes de sécurité intègrent la gestion des vulnérabilités dans des offres plus larges, ce qui explique une croissance à un chiffre.',
        segments: [
          { name: 'Abonnements', revenue: 'Majorité des revenus', pct: 'Non ventilé', description: 'Tenable One, Vulnerability Management, sécurité du cloud.' },
          { name: 'Licences perpétuelles et services', revenue: 'Part résiduelle', pct: 'Non ventilé', description: 'Maintenance des licences historiques.' }],
        sourceRefs: [ref(3), ref(1)],
        coverageMatrix: [
          { facet: 'Cours et historique', status: 'COUVERT', decision: 'Trois cents séances continues, close certifié ; base des supports et résistances.' },
          { facet: 'Résultats et guidance', status: 'COUVERT — PRIMAIRE', decision: 'Communiqué du 29 juillet et 10-Q ; date du troisième trimestre non annoncée.' },
          { facet: 'Capital et dette', status: 'COUVERT — PRIMAIRE', decision: 'Émission convertible, options plafonnées, rachats et remboursement du prêt séparés.' },
          { facet: 'Agrégats GAAP', status: 'COUVERT — XBRL', decision: 'Douze mois glissants au 30 juin 2026, reconstitués depuis les données XBRL officielles.' },
          { facet: 'Comparables et transmission', status: 'COUVERT — LOCAL', decision: 'Corrélations recalculées sur barres certifiées depuis la fin mars.' },
          { facet: 'Initiés', status: 'PARTIEL', decision: 'Couverture officielle incomplète ; aucun solde net affirmé.' },
          { facet: 'Options', status: 'NON EXPLOITABLE', decision: 'Chaîne relevée en séance le 24 septembre, non rattachée à la clôture de référence.' }] },
      news: [
        { date: '2026-07-30', title: 'Ouverture à ' + fr(pct(d0730[1], p0730[4]), 1) + ' %, clôture à ' + sgn(pct(d0730[4], p0730[4]), 1), impact: 'neutral', detail: 'Au lendemain du communiqué du deuxième trimestre, le titre ouvre à ' + usd(d0730[1]) + ', ' + fr(Math.abs(pct(d0730[1], p0730[4])), 2) + ' % sous la clôture de la veille, puis clôture à ' + usd(d0730[4]) + '. Un écart d’ouverture de cette taille aurait sauté n’importe quel stop serré.', source: 'Barres certifiées', sourceUrl: c.evidenceUrl },
        { date: '2026-09-11', title: 'Recul de ' + fr(Math.abs(pct(d0911[4], p0911[4])), 1) + ' % au lendemain de l’émission', impact: 'negative', detail: 'Clôture à ' + usd(d0911[4]) + ' sur 17,2 millions de titres échangés, le lendemain de la fixation du prix des convertibles. Qualys a perdu 6,99 % le même jour et CIBR a gagné 0,25 % : le repli n’est pas propre à l’émission.', source: 'Barres certifiées', sourceUrl: c.evidenceUrl },
        { date: '2026-09-15', title: '800 M$ de convertibles, prêt à terme remboursé', impact: 'neutral', detail: 'Obligations à 0,25 % échéance 2031, convertibles à 44,84 $ ; options plafonnées jusqu’à 64,06 $ ; rachat d’environ 170,5 M$ d’actions et remboursement complet du prêt à terme.', source: 'Tenable — SEC', sourceUrl: docs[0].url }],
      fundamentals: { rows: [
          { metric: 'Revenus du deuxième trimestre', value: '268,5 M$', signal: '+8,6 % sur un an, communiqué du 29 juillet', signalColor: 'amber', _src: 1 },
          { metric: 'Résultat opérationnel GAAP du trimestre', value: '12,4 M$', signal: 'Contre une perte de 7,4 M$ un an plus tôt ; marge ajustée de 24,7 %', signalColor: 'green', _src: 1 },
          { metric: 'Prévision de revenus 2026', value: '1,075 à 1,081 Md$', signal: 'Relevée le 29 juillet ; troisième trimestre attendu entre 270,0 et 273,0 M$', signalColor: 'blue', _src: 1 },
          { metric: 'Flux libre avant intérêts prévu pour 2026', value: '289 à 295 M$', signal: 'Prévision de la société, mesure non GAAP', signalColor: 'green', _src: 1 },
          { metric: 'Revenus GAAP sur douze mois', value: fr(G$.rev / 1e9, 3) + ' Md$', signal: 'Douze mois glissants au 30 juin 2026 (XBRL SEC)', signalColor: 'blue', _src: 'gaap' },
          { metric: 'Résultat opérationnel GAAP sur douze mois', value: fr(G$.ebit / 1e6, 1) + ' M$', signal: 'Douze mois glissants au 30 juin 2026', signalColor: G$.ebit > 0 ? 'green' : 'amber', _src: 'gaap' },
          { metric: 'Résultat net GAAP sur douze mois', value: fr(G$.ni / 1e6, 1) + ' M$', signal: 'Douze mois glissants au 30 juin 2026', signalColor: G$.ni > 0 ? 'green' : 'amber', _src: 'gaap' },
          { metric: 'Flux de trésorerie opérationnel sur douze mois', value: fr(G$.ocf / 1e6, 0) + ' M$', signal: 'Douze mois glissants au 30 juin 2026', signalColor: 'green', _src: 'gaap' },
          { metric: 'Prêt à terme au 30 juin 2026', value: fr(g.loan.value / 1e6, 1) + ' M$', signal: 'Principal ; remboursé en totalité le 15 septembre', signalColor: 'blue', _src: 'gaap' },
          { metric: 'Liquidités et placements au 30 juin 2026', value: fr(G$.cash / 1e6, 1) + ' M$', signal: 'Trésorerie et placements à court terme, avant l’émission', signalColor: 'blue', _src: 'gaap' },
          { metric: 'EV/revenus GAAP', value: fr(evRev, 2) + '×', signal: 'Valeur d’entreprise au close du 2026-09-23, bilan du 2026-06-30, sur revenus GAAP douze mois au 2026-06-30', signalColor: 'blue', source: 'Clôture certifiée et XBRL SEC', comparison: 'Versus Qualys à ' + fr(qlys, 1) + '×, Rapid7 à ' + fr(rpd, 1) + '× et Check Point à ' + fr(chkp, 1) + '× (statistiques courantes du 24 septembre, non point-in-time) : le prix d’un éditeur à croissance lente.', _src: 'market', _peers: ['QLYS', 'RPD', 'CHKP'], _peerField: 'enterpriseToRevenue' },
          { metric: 'EV/revenus après l’émission de septembre', value: fr(evPf / G$.rev, 2) + '×', signal: 'Pro forma au close du 2026-09-23 : 800 M$ de convertibles, prêt remboursé, rachat de 170,5 M$ estimé à ' + fr(buyShares / 1e6, 1) + ' millions d’actions au cours du 10 septembre (32,03 $)', signalColor: 'blue', source: 'Clôture certifiée, XBRL SEC et 8-K du 15 septembre', comparison: 'Versus la base au 30 juin : la dette nette ajoutée compense à peu près la baisse du nombre d’actions.', _src: 'market' },
          { metric: 'EV sur revenus prévus pour 2026', value: fr(evFwd, 2) + '×', signal: 'Valeur d’entreprise au close du 2026-09-23 sur le milieu de la prévision de la société (1,078 Md$)', signalColor: 'blue', source: 'Clôture certifiée, XBRL SEC et communiqué du 29 juillet', comparison: 'Versus le multiple glissant : écart faible, la croissance attendue étant elle-même faible.', _src: 'market' },
          { metric: 'EV/revenus — scénario de compression (hypothèse éditoriale)', value: fr(scn.price, 2) + ' $ par action', signal: 'Scénario : multiple ramené à trois fois les revenus GAAP douze mois au 2026-06-30 par hypothèse, bilan du 30 juin, soit ' + fr(scn.downside_pct, 0) + ' % sous le close du 2026-09-23', signalColor: 'red', source: 'Clôture certifiée et XBRL SEC', comparison: 'Versus Rapid7 à ' + fr(rpd, 1) + '× : trois fois reste au-dessus de ce pair ; un alignement complet sur Rapid7 donnerait environ ' + usd(rpdPrice) + ' par action. Ce que coûteraient ces rapprochements, pas des objectifs.', _src: 'market', _peers: ['RPD'], _peerField: 'enterpriseToRevenue' }],
        sourceRefs: [ref(1), ref(2), ref(0), market('fondamentaux et statistiques')] },
      earnings: { quarters: [],
        beatNote: 'Deuxième trimestre 2026 : revenus de 268,5 M$ (+8,6 %), résultat opérationnel GAAP de 12,4 M$ contre une perte un an plus tôt, marge ajustée de 24,7 %, bénéfice ajusté de 0,51 $ par action. La guidance annuelle, relevée, vise 1,075 à 1,081 Md$ de revenus, 258 à 264 M$ de résultat opérationnel ajusté et 1,95 à 2,00 $ de bénéfice ajusté par action sur 117,0 millions d’actions diluées. Le troisième trimestre est attendu entre 270,0 et 273,0 M$ ; sa date de publication reste non annoncée par la société.',
        nextEarnings: 'Date non annoncée par l’émetteur ; aucune publication dans les quatorze jours du calendrier collecté.',
        sourceRefs: [ref(1)] },
      capitalStructure: { sharesOutstanding: '110 139 983 actions au 31 juillet 2026 (page de garde du 10-Q)',
        sharesAuthorized: 'Actions autorisées non reprises : non décisionnel pour ce dossier.', dilutionRisk: 'moderate',
        shareHistory: 'Base retenue : actions émises moins actions autodétenues au bilan. Elles passent de 118,5 millions fin 2025 (129,0 millions émises, 10,6 millions autodétenues) à 110,4 millions au 30 juin (132,4 et 21,9), puis 110,1 millions au 31 juillet. Le rachat d’environ 170,5 M$ de septembre en retire encore environ ' + fr(buyShares / 1e6, 1) + ' millions au cours du 10 septembre, estimation, le 8-K ne donnant pas le nombre. Passage au nombre dilué : les convertibles 2031 portent 17 840 400 actions potentielles, jusqu’à 24 976 560 dans des cas limités ; réglées en numéraire jusqu’au nominal, elles ne diluent qu’au-delà de 44,84 $, et les options plafonnées compensent jusqu’à 64,06 $ : la dilution nette réaliste serait d’environ ' + fr(net80 / 1e6, 1) + ' millions d’actions à 80 $. La guidance annuelle retient 117,0 millions d’actions diluées, avant ce rachat.',
        warrants: [], atm: { active: false, authorized: 'Aucun programme d’émission d’actions sur le marché relevé', used: 'Sans objet', remaining: 'Sans objet' },
        sourceRefs: [ref(0), ref(2)] },
      filingsReview: { summary: 'Quatre dépôts décisionnels ouverts et hachés. Le fait nouveau est l’émission convertible du 15 septembre : elle remplace un prêt à terme par une dette moins chère mais plus longue, et finance un rachat d’actions ; la dilution potentielle est réelle mais lointaine.',
        filings: docs.map(d => ({ date: d.date, form: d.form, accession: d.accession, finding: d.finding, url: d.url })),
        contrarianRisks: [
          'Financer des rachats par de la dette convertible fait monter le résultat par action sans faire croître l’entreprise.',
          'La gestion des vulnérabilités est intégrée par les grandes plateformes, ce qui plafonne la croissance.',
          'Les couvertures des porteurs de convertibles peuvent peser sur le titre à chaque hausse.',
          'Une croissance à un chiffre laisse peu de marge si la prévision relevée n’est pas tenue.'] },
      technicals: { rsi14: +tech.rsi14.toFixed(2), macd: +tech.macd.toFixed(2), macdSignal: +tech.macdSignal.toFixed(2), ema20: +tech.ema20.toFixed(2), ema50: +tech.ema50.toFixed(2), ema200: +tech.ema200.toFixed(2),
        ma50Type: 'EMA', ma200Type: 'EMA', ma50Available: true, ma200Available: true, atr14: +tech.atr14.toFixed(2),
        badges: ['Couloir entre ' + fr(lv('s2'), 2) + ' et ' + fr(lv('r1'), 2) + ' $', 'Au-dessus des moyennes à vingt, cinquante et deux cents séances', 'Résistances rapprochées'],
        supports: [lv('s1'), lv('s2'), lv('s3')], resistances: [lv('r1'), lv('r2'), lv('r3')],
        setupNote: 'Le titre clôture à ' + usd(close) + ', juste au-dessus de ses moyennes à vingt et cinquante séances, avec un RSI à ' + fr(tech.rsi14, 1) + '. Supports : ' + usd(lv('s1')) + ', bas du 23 septembre, ' + usd(lv('s2')) + ', bas du 18, et ' + usd(lv('s3')) + ', bas du 11. Résistances : ' + usd(lv('r1')) + ', plus haut du 15 septembre, ' + usd(lv('r2')) + ', plus haut du 14 août, et ' + usd(lv('r3')) + ', plus haut de l’année le 15 juillet. Une cassure de ' + usd(lv('r1')) + ' avec un stop sous ' + usd(lv('s2')) + ' viserait ' + usd(lv('r2')) + ' : R/R de ' + fr((lv('r2') - lv('r1')) / (lv('r1') - lv('s2')), 2) + '. Le plan archivé du 27 août a vu une clôture au-dessus de son entrée le 31 août, puis une clôture sous son stop dès le 2 septembre.',
        wyckoff: 'Non utilisé : le profil de volume n’est pas exploité dans ce dossier.',
        sourceRefs: [market('barres quotidiennes et indicateurs recalculés')] },
      options: { callOI: 'Non exploitable', putOI: 'Non exploitable', cpRatio: 'Non exploitable', maxPain: 'Non exploitable', ivMean: 'Non exploitable', skew: 'Chaîne relevée en séance le 24 septembre, non rattachée à la clôture de référence', unusual: 'Aucune activité inhabituelle qualifiée', sourceRefs: [market('options')] },
      shortInterest: { siPct: fr(st.shortPercentOfFloat * 100, 2) + ' % du flottant', daysToCover: fr(st.shortRatio, 2) + ' jours, date de règlement non précisée par le snapshot', ctb: 'Coût d’emprunt non retenu comme signal', trend: 'Positions vendeuses élevées ; une partie peut venir des couvertures des porteurs de convertibles, sans donnée qui le prouve.', squeezeScore: 'Non pertinent', sourceRefs: [market('positions vendeuses')] },
      insiders: { signal: 'Aucune transaction de marché de dirigeant retenue dans la fenêtre relevée. Couverture officielle partielle : l’absence de ligne n’est pas la preuve d’une absence de vente.',
        recentTransactions: [],
        sourceRefs: [market('formulaires 4')] },
      macro: { indicators: [{ name: 'Clôture de référence', value: c.REF, signal: usd(close) + ', séance complète' }, { name: 'Rendement cinq séances', value: sgn(ret(5)), signal: 'Descriptif' }, { name: 'Rendement vingt et une séances', value: sgn(ret(21)), signal: 'Descriptif' }],
        regime: 'neutral', impact: 'Un éditeur qui se finance à 0,25 % sur cinq ans gagne peu à la hausse des taux, mais son multiple de revenus, déjà bas, dépend surtout de la croissance : les taux pèsent moins ici que chez les pairs chers.' },
      risks: { riskScore: 5, riskProfile: 'Moderate',
        riskSummary: 'Le risque de Tenable n’est pas son bilan, allégé du prêt à terme, ni sa valorisation, déjà basse. C’est une croissance de 8,6 % qui ne justifie pas de payer une prime, et un titre qui oscille sous des résistances rapprochées. Entre ' + usd(lv('s2')) + ' et ' + usd(lv('r1')) + ', un acheteur prend un risque de plusieurs dollars pour un gain limité par les plus hauts d’août et de juillet.',
        riskCards: [
          { title: 'Croissance à un chiffre', severity: 'high', icon: 'fa-arrow-trend-down', points: ['Revenus +8,6 % au deuxième trimestre.', 'Prévision annuelle de 1,075 à 1,081 Md$.'], verdict: 'Sans accélération, le titre dépend des rachats et du multiple, pas de la croissance de l’entreprise.' },
          { title: 'Dette convertible nouvelle', severity: 'medium', icon: 'fa-file-contract', points: ['800 M$ à 0,25 % échéance 2031.', 'Dilution nette nulle sous 64,06 $, environ ' + fr(net80 / 1e6, 1) + ' millions d’actions à 80 $.'], verdict: 'La dilution reste lointaine, mais la dette nette augmente pour financer des rachats d’actions.' },
          { title: 'Couloir sans point d’entrée', severity: 'medium', icon: 'fa-arrows-left-right', points: ['Support à ' + usd(lv('s2')) + ', résistance à ' + usd(lv('r1')) + '.', 'Résistances suivantes à ' + usd(lv('r2')) + ' et ' + usd(lv('r3')) + '.'], verdict: 'Au milieu du couloir, ni la cassure ni le rebond ne donnent un rapport risque-rendement suffisant.' },
          { title: 'Écarts d’ouverture violents', severity: 'medium', icon: 'fa-bolt', points: ['Ouverture à ' + fr(pct(d0730[1], p0730[4]), 1) + ' % le 30 juillet.', 'Hausse de 16,5 % le 14 septembre avec le secteur.'], verdict: 'La taille d’une position doit supposer des écarts de plusieurs ATR, dans les deux sens.' }],
        pedagogy: 'Une entreprise qui rachète ses actions avec de l’argent emprunté fait monter son bénéfice par action même si elle ne croît pas : c’est utile, mais ce n’est pas de la croissance. Côté marché, un gap à l’ouverture, ce saut de cours entre deux séances, a atteint ' + fr(Math.abs(pct(d0730[1], p0730[4])), 1) + ' % le 30 juillet ; le slippage, l’écart entre prix voulu et prix obtenu, reste modéré sur environ ' + fr(adv / 1e6, 0) + ' M$ échangés par séance. La taille d’une position se calcule sur le pire écart plausible, pas sur le stop affiché.' },
      tradeIdea: { status: 'no-trade', archiveReferenceClose: archive.meta.levelsCloseDate,
        statusNote: 'Aucun plan. Les niveaux affichés sont ceux, archivés, du dossier du 27 août : aucun ordre n’y est attaché et ils sont désormais inactifs. Leur condition a été remplie en clôture le 31 août (' + usd(act[4]) + ' au-dessus de ' + usd(entry) + '), puis le stop a été cassé le 2 septembre : résultat de ' + fr(oldRes, 1) + ' % au stop, ' + fr(oldClose, 1) + ' % à la clôture du 2 septembre. Un nouveau plan ne sera construit que sur une clôture au-dessus de ' + usd(lv('r2')) + ' ou un retour tenu vers ' + usd(lv('s3')) + '.',
        entry, stop, tp1, tp2,
        stopPct: pct(stop, entry).toFixed(1) + '%', tp1Pct: '+' + pct(tp1, entry).toFixed(1) + '%', tp2Pct: '+' + pct(tp2, entry).toFixed(1) + '%',
        rr: '1:' + rr1.toFixed(2) + ' TP1 / 1:' + rr2.toFixed(2) + ' TP2',
        entryNote: 'Niveaux historiques affichés pour mémoire, non exécutables : clôture au-dessus de l’entrée le 31 août à ' + usd(act[4]) + ', puis clôture sous le stop le 2 septembre à ' + usd(stopHit[4]) + '. Au cours actuel, une cassure de ' + usd(lv('r1')) + ' avec un stop sous ' + usd(lv('s2')) + ' ne viserait que ' + usd(lv('r2')) + '. Liquidité : environ ' + fr(adv / 1e6, 0) + ' M$ échangés par séance, médiane des vingt dernières.',
        horizon: 'Aucun horizon : pas de plan au cours actuel',
        thesis: 'Tenable est devenue une valeur de rendement par action : croissance faible, rentabilité en hausse, rachats financés en partie par de la dette convertible. Le marché la paie comme telle, à moins de quatre fois ses revenus. Le titre n’offre pas de point d’entrée : il est au milieu d’un couloir étroit, sous deux résistances. Aucun ordre : attendre une sortie au-dessus du plus haut du 14 août ou un repli vers le bas du 11 septembre, puis reconstruire des niveaux.',
        catalysts: ['Une clôture au-dessus de ' + usd(lv('r2')) + ', qui ouvrirait la voie vers le plus haut de l’année.', 'La publication du troisième trimestre, date non annoncée, et la tenue de la prévision relevée.', 'Aucune publication de la société ni d’un comparable dans les quatorze jours du calendrier collecté : le risque de gap vient du secteur, comme le 14 septembre.'],
        invalidation: ['Toute entrée au milieu du couloir contredit ce dossier.', 'Une clôture sous ' + usd(lv('s3')) + ' effacerait le rebond de septembre et repousserait tout plan.', 'Une nouvelle émission de dette ou d’actions changerait la lecture du capital.'] },
      globalScore: { profile: 'Éditeur mûr qui rachète ses actions à crédit',
        keyTakeawaysPositive: ['Résultat opérationnel GAAP redevenu positif, 12,4 M$ au trimestre.', 'Moins de quatre fois les revenus.', 'Aucun client au-delà de 2 % des revenus.'],
        keyTakeawaysNegative: ['Croissance de 8,6 %.', '800 M$ de convertibles pour financer des rachats.', 'Aucun point d’entrée au milieu du couloir.'],
        mindsetTip: 'Un bénéfice par action qui monte grâce aux rachats n’a pas la même valeur qu’un bénéfice qui monte grâce aux ventes : regardez toujours les deux lignes.' },
      social: { platforms: [], sourceRefs: [market('sentiment non retenu faute de mesure qualifiée')] },
      disclaimer: 'Document de recherche éducatif. Ni conseil financier, ni signal de trading. Aucun plan actif : les niveaux affichés sont historiques.',
    };
  },
  groups: [
    { name: 'Référence du segment', order: 1, transmission: 'Le pair le plus proche du même métier, et le plus corrélé à Tenable depuis fin mars.', rows: [
      ['QLYS', 'leader', 'Analyse des vulnérabilités en nuage', 'Concurrent frontal sur le même métier ; corrélation la plus forte avec Tenable depuis fin mars, 0,84.']] },
    { name: 'Pairs directs de la gestion d’exposition', order: 1, transmission: 'Même budget de gestion des vulnérabilités.', rows: [
      ['RPD', 'direct_peer', 'Gestion des vulnérabilités et détection', 'Concurrent direct et moins cher : son multiple montre ce que le marché paie pour ce métier à croissance lente.'],
      ['VRNS', 'direct_peer', 'Sécurité et gouvernance des données', 'Pair de taille comparable dont la transition vers le nuage sert de point de comparaison.'],
      ['RBRK', 'direct_peer', 'Protection et restauration des données', 'Budget de cyber-résilience arbitré dans les mêmes comités d’achat que l’exposition.']] },
    { name: 'Plateformes qui intègrent la gestion d’exposition', order: 1, transmission: 'Grandes plateformes qui ajoutent la gestion des vulnérabilités à leurs offres.', rows: [
      ['PANW', 'direct_peer', 'Plateforme de sécurité la plus large', 'Plateforme la plus large du secteur : chaque module qu’elle regroupe dans un contrat réduit la place des spécialistes.'],
      ['CRWD', 'direct_peer', 'Protection des postes et plateforme cloud', 'Plateforme dont l’agent déjà installé peut servir de point d’entrée à d’autres modules : pression possible sur les prix.'],
      ['ZS', 'direct_peer', 'Accès sécurisé et gestion d’exposition', 'Plateforme en nuage qui élargit son offre : un acheteur de sécurité de plus qui arbitre entre spécialistes et plateformes.'],
      ['FTNT', 'direct_peer', 'Pare-feu et réseau sécurisé', 'Plateforme réseau très présente chez les entreprises moyennes, clientèle que Tenable vise aussi.'],
      ['S', 'direct_peer', 'Protection des postes de travail', 'Plateforme plus petite dont la croissance mesure la pression concurrentielle sur les éditeurs moyens.'],
      ['OKTA', 'direct_peer', 'Gestion des identités en nuage', 'L’identité devient une surface d’attaque à part entière, terrain voisin de l’exposition.'],
      ['NET', 'direct_peer', 'Réseau et sécurité en périphérie', 'Concurrent indirect sur la surface d’attaque exposée à internet.'],
      ['CHKP', 'direct_peer', 'Pare-feu d’entreprise rentable', 'Pair rentable et à croissance lente : le modèle de valorisation le plus proche de Tenable.']] },
    { name: 'Amont : hébergement et grands clouds', order: 2, transmission: 'AWS héberge l’infrastructure de Tenable selon le 10-K ; les grands clouds proposent aussi leurs propres outils.', rows: [
      ['AMZN', 'upstream', 'Hébergeur AWS de l’infrastructure', 'Fournisseur des centres de données de Tenable selon le 10-K ; ses outils natifs concurrencent la sécurité du cloud.'],
      ['MSFT', 'second_order', 'Cloud Azure et suite de sécurité', 'Sa suite de sécurité intégrée, vendue avec ses licences, pèse sur le prix des outils spécialisés.'],
      ['GOOGL', 'second_order', 'Google Cloud et sécurité intégrée', 'Ses outils de sécurité du cloud réduisent l’espace des spécialistes chez ses clients.'],
      ['NOW', 'second_order', 'Automatisation des processus d’entreprise', 'Ses flux de travail de correction sont un débouché naturel des failles détectées : lecture des budgets d’automatisation.']] },
    { name: 'Contrôles sectoriels', order: 2, transmission: 'Paniers de référence pour isoler ce qui est propre à Tenable.', rows: [
      ['CIBR', 'sector_proxy', 'Panier de cybersécurité pondéré', 'Un écart de performance avec ce panier isole ce qui est propre à Tenable.'],
      ['HACK', 'sector_proxy', 'Panier de cybersécurité plus équipondéré', 'Mieux adapté à une valeur moyenne : montre si le secteur monte sans les géants.'],
      ['IGV', 'sector_proxy', 'Panier de logiciels américains', 'Contrôle large du logiciel : un mouvement commun avec ce panier n’a rien de spécifique au titre.']] },
  ],
  eventDefault: { leader: 'Aucune publication dans les quatorze jours collectés ; sa prochaine prévision donnera le ton du segment', direct_peer: 'Aucune publication dans les quatorze jours collectés ; ses annonces de produits peuvent déplacer les parts de marché', upstream: 'Aucune publication dans les quatorze jours collectés ; ses tarifs d’hébergement restent à suivre', second_order: 'Aucune publication dans les quatorze jours collectés ; ses offres intégrées restent le signal à suivre', sector_proxy: 'Panier sans publication propre ; exposé aux résultats de ses grandes pondérations' },
  eventRisk: {},
  blastDoc: 3,
  scenarios: c => [
    { scenario: 'bullish', trigger: 'Le secteur prolonge sa hausse et la prévision relevée est dépassée au troisième trimestre.', firstOrder: 'Le titre sort du couloir par le haut et franchit le plus haut du 14 août.', secondOrder: 'Qualys et Rapid7 suivent ; le multiple des éditeurs à croissance lente se relève.', confirmation: 'Une clôture au-dessus de ' + c.usd(c.lv('r2')) + ' avec Qualys en hausse la même séance.', contradiction: 'Un franchissement du plus haut d’août pendant que Qualys et le panier CIBR reculent.' },
    { scenario: 'mixed', trigger: 'Le secteur marque une pause sans nouvelle propre.', firstOrder: 'Le titre reste entre le bas du 18 septembre et le plus haut du 15.', secondOrder: 'L’écart de performance avec Qualys reste faible, sans information propre au titre.', confirmation: 'Des clôtures entre ' + c.usd(c.lv('s2')) + ' et ' + c.usd(c.lv('r1')) + ' pendant plusieurs séances.', contradiction: 'Une sortie franche d’un côté ou de l’autre.' },
    { scenario: 'bearish', trigger: 'Une grande plateforme casse les prix de la gestion d’exposition, ou le secteur recule.', firstOrder: 'Le titre repasse sous le bas du 11 septembre.', secondOrder: 'Les éditeurs à croissance lente reculent plus que le panier.', confirmation: 'Une clôture sous ' + c.usd(c.lv('s3')) + ' avec Qualys en baisse.', contradiction: 'Un repli du secteur que le titre ne suit pas.' }],
  contradictions: c => ['La prévision a été relevée en juillet, mais le titre a ouvert à ' + c.fr(c.pct(c.bars.find(b => b[0] === '2026-07-30')[1], c.bars[c.bars.findIndex(b => b[0] === '2026-07-30') - 1][4]), 1) + ' % le lendemain avant de finir en hausse : le marché hésite entre rentabilité et croissance.', 'Une corrélation élevée avec Qualys ne prouve pas un lien commercial ; c’est un concurrent, pas un client.'],
  missingData: c => ['Aucun client ne dépasse 2 % des revenus et les distributeurs ne sont pas nommés : aucun client coté n’entre dans les comparables comme client documenté.', 'Nombre d’actions rachetées en septembre non publié : estimation au cours du 10 septembre.', 'Chaîne d’options relevée en séance, non rattachée à la clôture ; sentiment non retenu.', 'Barres d’une source de repli pour toutes les séries.'],
  limitations: ['Barres d’une source de repli (Webull).', 'Bilan XBRL antérieur à l’émission du 15 septembre ; valeur pro forma calculée depuis le 8-K.', 'Nombre d’actions rachetées en septembre estimé.'],
});
