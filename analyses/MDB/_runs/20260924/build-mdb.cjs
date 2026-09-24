'use strict';
// Dossier MDB v3 au close du 2026-09-23 (lot R04). Aucun plan actif : le titre a presque effacé le gap du 2 septembre
// et bute sur une série de résistances rapprochées, sans stop structurel qui laisse un R/R de 1,5 ; les niveaux
// du 27 août restent affichés comme référence archivée. Calculs et preuves : gabarit tools/lib/analysis-v3-r04.cjs.
const R = require('../../../../tools/lib/analysis-v3-r04.cjs');
const GEN = 'analyses/MDB/_runs/20260924/build-mdb.cjs';

R.build({
  ticker: 'MDB', shortName: 'MongoDB', cik: 1441816, generator: GEN, mode: 'archived',
  xbrl: { ttm: { rev: ['RevenueFromContractWithCustomerExcludingAssessedTax'], ebit: ['OperatingIncomeLoss'], ni: ['NetIncomeLoss'], da: ['DepreciationDepletionAndAmortization'], ocf: ['NetCashProvidedByUsedInOperatingActivities'] },
    instant: { cashEq: ['CashAndCashEquivalentsAtCarryingValue'], sti: ['AvailableForSaleSecuritiesDebtSecuritiesCurrent'] }, da: ['da'], debt: [], cash: ['cashEq', 'sti'] },
  scenarioBasis: 'revenue', scenarioMultiple: 8,
  valuationBasis: 'GAAP douze mois au 2026-07-31 (XBRL SEC) ; aucune dette financière au bilan ; trésorerie = liquidités et placements à court terme ; 80,6 millions d’actions au 28 août ; multiple de huit fois les revenus = hypothèse éditoriale',
  levels: { s1: { d: '2026-09-23', c: 3 }, s2: { d: '2026-09-22', c: 3 }, s3: { d: '2026-09-21', c: 3 }, r1: { d: '2026-09-22', c: 2 }, r2: { d: '2026-09-01', c: 2 }, r3: { d: '2026-08-14', c: 2 } },
  supports: ['s1', 's2', 's3'], resistances: ['r1', 'r2', 'r3'],
  inventory: 13,
  reviewScope: 'Dépôts EDGAR de MongoDB du 1er février au 23 septembre 2026 (13 formulaires hors formulaires 3, 4, 5 et 144), dont le 10-K de l’exercice clos le 31 janvier 2026. Les 8-K de gouvernance (items 5.02, 5.03, 5.07), les procurations et leurs compléments et le rapport annuel sont écartés comme non décisionnels ; le S-8 de mars enregistre l’augmentation annuelle des plans de rémunération, pas une levée de fonds. Le 10-Q et le communiqué du premier trimestre sont couverts par ceux du deuxième.',
  docs: [
    ['2026-09-01', '10-Q', '0001628280-26-059830', 'mdb-20260731.htm', 'q2-10q__mdb-20260731.htm',
      'Rapport trimestriel au 31 juillet 2026 : 80 556 341 actions au 28 août ; aucune dette financière ; 666 452 actions rachetées au semestre pour 200,0 M$, à 300,10 $ en moyenne, sur une autorisation portée à 1,0 Md$. Liquidités et placements de 2,41 Md$.'],
    ['2026-09-01', '8-K / Exhibit 99.1', '0001628280-26-059794', 'mdb-073126xex991xrelease.htm', 'q2-8k__mdb-073126xex991xrelease.htm',
      'Communiqué du deuxième trimestre de l’exercice 2027, publié avant la conférence de 17 h, heure de New York : revenus de 771,8 M$ (+30 %), Atlas +29 %, résultat opérationnel GAAP de 28,4 M$. Troisième trimestre guidé entre 756 et 761 M$, sous le deuxième ; exercice relevé à 2,99–3,03 Md$.'],
    ['2026-03-11', '10-K', '0001628280-26-016799', 'mdb-20260131.htm', 'fy26-10k__mdb-20260131.htm',
      'Rapport annuel de l’exercice clos le 31 janvier 2026 : plus de 65 200 clients, aucun à plus de 10 % des revenus ; Atlas hébergé presque entièrement sur AWS, Microsoft Azure et Google Cloud ; concurrents cités, IBM, Microsoft, Oracle et les bases de données des grands clouds.'],
  ],
  needles: {
    q2q: [0, ['As of August 28, 2026, there were 80,556,341 shares of the registrant’s common stock', 'the Company repurchased 666,452 shares of common stock for $ 200.0 million and the average price per share was $ 300.10', 'bringing the aggregate authorized repurchase amount to $ 1.0 billion', 'Cash and cash equivalents $ 1,002,401 $ 1,083,540 Short-term investments 1,408,853 1,303,701', 'Total liabilities 797,707 806,490']],
    q2: [1, ['Second quarter fiscal 2027 total revenue of $771.8 million, up 30% year-over-year', 'Atlas revenue up approximately 29% year-over-year', 'EA & other revenue up approximately 36% year-over-year', 'Income from operations was $28.4 million for the second quarter of fiscal 2027', 'Revenues are expected to be in the range of: $756 million to $761 million', 'Revenues are expected to be in the range of: $2.99 billion to $3.03 billion', 'free cash flow of $137.6 million', 'RPO was $1,519.2 million, an increase of 91% year-over-year', 'cRPO”) was $797.3 million, an increase of 73% year-over-year', 'at 5:00 p.m. (Eastern Time)', 'Net income was $40.9 million', 'based on 85.8 million fully diluted weighted-average shares outstanding', '$(14.5) million to $(10.5) million']],
    annual: [2, ['we had over 65,200 customers', 'No single customer represented more than 10% of our revenue in fiscal year 2026', 'We outsource substantially all of the infrastructure relating to Atlas across AWS, Microsoft Azure and GCP', 'We primarily compete with established legacy database software providers such as IBM, Microsoft, Oracle']],
  },
  sectionDocs: { verdict: [1, 0], business: [1, 0, 2], news: [1, 0], earnings: [1], capitalStructure: [0], filingsReview: [0, 1, 2], risks: [1, 0], globalScore: [1], meta: [1], disclaimer: [1], macro: [1], options: [1], social: [1], header: [0] },
  score: { business: 26, technical: 2, capital: 3, calendar: 0, dilution: -1, risk: 24 },
  peers: true,
  peerFicheSha: { DDOG: '4aa033d564c5b77f2d8334c69347e5a4dd745de8369a3ccd7aa7157abac422e4', NOW: '7dff5ac302f1fa53b7e58c0b489349620f8bda2c5dcc4179a12720291bb3eaaf', ORCL: '3545a580330902ddfea6118a62f49a6d7e8fa8c5ced1763f57d1793a5af3e4d3', CRM: '763ea84630b4e183af526f8436a95a9ad6eb0a229067dffef1ef057fd9a0f6a3' },
  shares: { value: 80556341, doc: 0 },
  route: (p, { prov, dep, B }) => /^news\.[01]\./.test(p) ? prov('bars', B, 'Ouverture et clôture lues sur les barres certifiées ; écart d’ouverture = ouverture / clôture de la veille − 1 ; comparaison avec IGV et les pairs sur la même séance.', [dep('comparison', '')]) : null,
  riskScoreReason: 'Jugement qualitatif sur dix : prévision du troisième trimestre sous le deuxième, résultat GAAP proche de zéro et titre remonté sous une série de résistances rapprochées.',
  compose: c => {
    const { fr, usd, pct, sgn, close, prev, bars, N, tech, st, M, adv, ret, G$, marketCap, ev, scn, lv, entry, stop, tp1, tp2, rr1, rr2, ref, market, docs, raw, peerStat, peerFiche, archive } = c;
    const cmp = raw.comparison_bars.data.items[0].results[0].data;
    const dr = (sym, d) => { const b = cmp.find(x => x.symbol === sym).bars, i = b.findIndex(x => x[0] === d); return pct(b[i][4], b[i - 1][4]); };
    const bar = d => bars.find(b => b[0] === d), prevOf = d => bars[bars.findIndex(b => b[0] === d) - 1];
    const d0902 = bar('2026-09-02'), p0902 = prevOf('2026-09-02'), d0922 = bar('2026-09-22'), p0922 = prevOf('2026-09-22');
    const low0908 = bar('2026-09-08')[3], run = pct(close, low0908);
    const evRev = ev / G$.rev, evFwd = ev / 3.01e9;
    const ddog = peerFiche('DDOG', 'EV/revenus GAAP').value, orcl = peerFiche('ORCL', 'EV/revenus GAAP').value, now = peerFiche('NOW', 'EV/revenus GAAP').value, crm = peerFiche('CRM', 'EV/revenus GAAP').value;
    const snow = peerStat('SNOW', 'enterpriseToRevenue'), estc = peerStat('ESTC', 'enterpriseToRevenue');
    // Test d'un achat sur cassure du plus haut du 1er septembre, stop sous le bas du 22 septembre, objectif le sommet du 14 août.
    const bo = { e: lv('r2'), s: lv('s2'), t: lv('r3') }; bo.rr = (bo.t - bo.e) / (bo.e - bo.s);
    const q3 = 758.5e6, q2 = 771.8e6;
    return {
      meta: { lang: 'fr', dir: 'ltr', level: 'intermediate', tags: ['us', 'equities', 'ai-chain', 'software', 'technology'], grade: 'B-', date: '2026-09-24', dateDisplay: '24 septembre 2026', version: 3, status: 'no-trade', assetType: 'stock', levelsCloseDate: c.REF,
        description: 'MongoDB : +30 % au deuxième trimestre, une prévision du troisième sous le deuxième et un gap de −12,7 % presque effacé. Dossier au close du 23 septembre 2026, aucun plan actif.',
        ogDescription: 'MongoDB : revenus +30 %, troisième trimestre guidé sous le deuxième, titre revenu de 354 à 428 $ ; pas d’entrée au cours actuel.',
        lastMcpRefresh: raw.status.captured_at, levelsVerifiedAt: raw.status.captured_at,
        statusHistory: [{ at: raw.status.captured_at, from: 'wait', to: 'no-trade', note: 'refonte v3 du 24 septembre : aucun plan au cours actuel, clôture de référence du 2026-09-23', close }] },
      header: { ticker: 'MDB', name: 'MongoDB, Inc.', exchange: 'NASDAQ', sector: 'Base de données en nuage pour développeurs', price: close, changePct: pct(close, prev),
        badges: [{ text: 'AUCUN PLAN — RÉSISTANCES RAPPROCHÉES', color: 'gray' }, { text: 'Chaîne IA — données des applications d’IA', color: 'purple' }],
        metrics: { marketCap: fr(marketCap / 1e9, 1) + ' Md$', volume: fr(bars[N][5] / 1e6, 2) + ' M', evRevenue: fr(evRev, 1) + '×' }, halalStatus: 'unknown' },
      verdict: { score: 54, conviction: 'Low', bias: 'Neutral',
        confidence: 'Score éditorial non prédictif. Les chiffres d’entreprise viennent des dépôts SEC et des données XBRL officielles ; les niveaux, du close certifié du 23 septembre.',
        summary: 'MongoDB a publié le 1er septembre sa meilleure croissance depuis plusieurs années : 771,8 M$ de revenus, +30 %, dont Atlas, son service en nuage, à +29 %. Mais la prévision du troisième trimestre, 756 à 761 M$, est inférieure au deuxième, et le titre a ouvert le lendemain ' + fr(Math.abs(pct(d0902[1], p0902[4])), 1) + ' % sous la veille. Il est remonté depuis de ' + usd(low0908) + ', plus bas du 8 septembre, à ' + usd(close) + ', ' + fr(Math.abs(pct(close, p0902[4])), 1) + ' % sous la clôture d’avant publication ; le gap a été comblé en séance le 22. À ' + fr(evRev, 1) + ' fois ses revenus GAAP des douze derniers mois, sans dette, il se paie un peu plus que ServiceNow (' + now + ') et moitié moins que Datadog (' + ddog + '). Aucun plan : entre ' + usd(lv('r1')) + ' et ' + usd(lv('r3')) + ', trois résistances rapprochées ne laissent pas de R/R de 1,5 avec un stop structurel.',
        whyBuy: [
          'Revenus du deuxième trimestre de 771,8 M$ (+30 %), Atlas +29 % et offre sur site EA +36 %.',
          'Obligations de performance à douze mois de 797,3 M$, en hausse de 73 %.',
          'Aucune dette financière et 2,41 Md$ de liquidités et placements au 31 juillet.',
          'Flux libre de 137,6 M$ au trimestre, presque le double d’un an plus tôt.'],
        whyAvoid: [
          'Le troisième trimestre est guidé entre 756 et 761 M$, soit environ ' + fr((1 - q3 / q2) * 100, 1) + ' % de moins que le deuxième au milieu de la fourchette.',
          'Le résultat opérationnel GAAP reste proche de zéro sur douze mois, à ' + fr(G$.ebit / 1e6, 1) + ' M$, et la société guide une perte GAAP au troisième trimestre.',
          'Au close du 23 septembre, la valeur d’entreprise représente ' + fr(evRev, 1) + ' fois les revenus GAAP des douze mois clos le 31 juillet.',
          'Le titre a regagné ' + sgn(run, 1) + ' depuis le 8 septembre et touche une zone de résistances entre ' + usd(lv('r1')) + ' et ' + usd(lv('r3')) + '.'],
        controlChecklist: [
          { label: 'Historique de cours', status: 'pass', statusLabel: 'Trois cents séances continues', evidence: 'Série quotidienne certifiée au close du 23 septembre, source de repli documentée.', action: 'Supports et résistances lus sur cette seule série.' },
          { label: 'Point d’entrée', status: 'fail', statusLabel: 'Résistances rapprochées', evidence: 'Un achat sur cassure de ' + usd(bo.e) + ' avec un stop sous ' + usd(bo.s) + ' ne viserait que ' + usd(bo.t) + ' : R/R de ' + fr(bo.rr, 2) + '.', action: 'Pas de plan avant une sortie au-dessus du sommet d’août ou un repli tenu.' },
          { label: 'Calendrier', status: 'pass', statusLabel: 'Aucune publication dans l’horizon', evidence: 'Aucune date de résultats de MongoDB ni d’un comparable dans les quatorze jours du calendrier collecté ; le calendrier de marché place le troisième trimestre au 1er décembre, date non confirmée par l’émetteur.', action: 'Vérifier la date avant tout nouveau plan.' }] },
      business: { theme: 'Base de données orientée documents, en nuage (Atlas) et sur site (Enterprise Advanced)',
        overview: '<p>MongoDB édite une base de données qui stocke les informations sous forme de documents souples, plus proches du code des développeurs que les tables classiques. Elle la vend en service géré sur les grands clouds, Atlas, et en licence sur site, Enterprise Advanced. Au deuxième trimestre de l’exercice 2027, clos le 31 juillet, les revenus ont atteint 771,8 M$, en hausse de 30 % : Atlas +29 %, l’offre sur site et les autres revenus +36 %.</p><p>La rentabilité progresse : résultat opérationnel GAAP de 28,4 M$ contre une perte de 65,3 M$ un an plus tôt, flux libre de 137,6 M$. Les contrats signés à reconnaître sur douze mois, 797,3 M$, croissent de 73 %. Mais la société guide un troisième trimestre entre 756 et 761 M$, sous le deuxième, et une perte opérationnelle GAAP de 10,5 à 14,5 M$ ; la hausse de la prévision annuelle, 2,99 à 3,03 Md$, vient surtout d’Atlas au second semestre.</p><p>Plus de 65 200 clients, aucun à plus de 10 % des revenus. Atlas est hébergé presque entièrement sur AWS, Microsoft Azure et Google Cloud, qui sont à la fois fournisseurs et concurrents avec leurs propres bases de données.</p>',
        moat: 'L’avantage tient à l’habitude des développeurs : une application écrite pour MongoDB se migre difficilement vers une autre base. Il est solide pour les nouvelles applications, y compris celles qui ajoutent de la recherche vectorielle pour l’IA, plus fragile face aux bases gérées des grands clouds, moins chères pour des usages simples.',
        segments: [
          { name: 'Atlas (service en nuage)', revenue: 'Majorité des revenus', pct: 'Non ventilé ici', description: 'Base gérée sur AWS, Azure et Google Cloud, facturée à l’usage ; +29 %.' },
          { name: 'Enterprise Advanced et autres', revenue: 'Part minoritaire', pct: 'Non ventilé ici', description: 'Licences sur site, souvent reconnues en début de contrat ; +36 %.' }],
        sourceRefs: [ref(1), ref(0), ref(2)],
        coverageMatrix: [
          { facet: 'Cours et historique', status: 'COUVERT', decision: 'Trois cents séances continues, close certifié ; base des supports et résistances.' },
          { facet: 'Résultats et guidance', status: 'COUVERT — PRIMAIRE', decision: 'Communiqué du 1er septembre et 10-Q ; date du troisième trimestre non annoncée par l’émetteur.' },
          { facet: 'Capital et dette', status: 'COUVERT — PRIMAIRE', decision: 'Aucune dette ; rachats d’actions et plans salariés séparés.' },
          { facet: 'Agrégats GAAP', status: 'COUVERT — XBRL', decision: 'Douze mois glissants au 31 juillet 2026, reconstitués depuis les données XBRL officielles.' },
          { facet: 'Comparables et transmission', status: 'COUVERT — LOCAL', decision: 'Corrélations recalculées sur barres certifiées depuis la fin mars.' },
          { facet: 'Initiés', status: 'PARTIEL', decision: 'Une petite vente d’administratrice en septembre ; couverture officielle incomplète.' },
          { facet: 'Options', status: 'NON EXPLOITABLE', decision: 'Chaîne relevée en séance le 24 septembre, non rattachée à la clôture de référence.' }] },
      news: [
        { date: '2026-09-02', title: 'Gap de ' + fr(pct(d0902[1], p0902[4]), 1) + ' % après la prévision', impact: 'negative', detail: 'Le communiqué est publié le 1er septembre, avant une conférence à 17 h, heure de New York. Le 2, le titre ouvre à ' + usd(d0902[1]) + ', ' + fr(Math.abs(pct(d0902[1], p0902[4])), 2) + ' % sous la clôture de la veille, ' + usd(p0902[4]) + ', et clôture à ' + usd(d0902[4]) + ' (' + sgn(pct(d0902[4], p0902[4]), 2) + '). IGV fait ' + sgn(dr('IGV', '2026-09-02'), 2) + ' et Snowflake ' + sgn(dr('SNOW', '2026-09-02'), 2) + ' la même séance : la baisse est propre au titre, et la prévision du troisième trimestre, sous le deuxième, en est la lecture la plus directe.', source: 'Barres certifiées', sourceUrl: c.evidenceUrl },
        { date: '2026-09-22', title: 'Hausse de ' + fr(pct(d0922[4], p0922[4]), 1) + ' %, le gap comblé en séance', impact: 'positive', detail: 'Ouverture à ' + usd(d0922[1]) + ', plus haut à ' + usd(d0922[2]) + ', au-dessus de la clôture d’avant publication, ' + usd(p0902[4]) + ', puis clôture à ' + usd(d0922[4]) + '. IGV fait ' + sgn(dr('IGV', '2026-09-22'), 2) + ' et Datadog ' + sgn(dr('DDOG', '2026-09-22'), 2) + ' la même séance ; aucun dépôt ouvert ici ne donne la cause.', source: 'Barres certifiées', sourceUrl: c.evidenceUrl },
        { date: '2026-09-01', title: '200 M$ d’actions rachetées au semestre', impact: 'neutral', detail: '666 452 actions à 300,10 $ en moyenne ; l’autorisation totale est de 1,0 Md$.', source: 'MongoDB — SEC', sourceUrl: docs[0].url }],
      fundamentals: { rows: [
          { metric: 'Revenus du deuxième trimestre', value: '771,8 M$', signal: '+30 % sur un an, communiqué du 1er septembre', signalColor: 'green', _src: 1 },
          { metric: 'Prévision du troisième trimestre', value: '756 à 761 M$', signal: 'Sous le deuxième trimestre ; perte opérationnelle GAAP de 10,5 à 14,5 M$ attendue', signalColor: 'red', _src: 1 },
          { metric: 'Prévision de revenus de l’exercice 2027', value: '2,99 à 3,03 Md$', signal: 'Relevée, surtout grâce à Atlas au second semestre selon la société', signalColor: 'blue', _src: 1 },
          { metric: 'Obligations de performance à douze mois', value: '797,3 M$', signal: '+73 % sur un an ; 1 519,2 M$ au total, +91 %', signalColor: 'green', _src: 1 },
          { metric: 'Revenus GAAP sur douze mois', value: fr(G$.rev / 1e9, 2) + ' Md$', signal: 'Douze mois glissants au 31 juillet 2026 (XBRL SEC)', signalColor: 'blue', _src: 'gaap' },
          { metric: 'Résultat opérationnel GAAP sur douze mois', value: fr(G$.ebit / 1e6, 1) + ' M$', signal: 'Douze mois glissants au 31 juillet 2026, proche de l’équilibre', signalColor: 'amber', _src: 'gaap' },
          { metric: 'Résultat net GAAP sur douze mois', value: fr(G$.ni / 1e6, 1) + ' M$', signal: 'Douze mois glissants, produits d’intérêts compris', signalColor: 'amber', _src: 'gaap' },
          { metric: 'Flux de trésorerie opérationnel sur douze mois', value: fr(G$.ocf / 1e6, 0) + ' M$', signal: 'Douze mois glissants au 31 juillet 2026', signalColor: 'green', _src: 'gaap' },
          { metric: 'Liquidités et placements au 31 juillet 2026', value: fr(G$.cash / 1e9, 2) + ' Md$', signal: 'Aucune dette financière au bilan', signalColor: 'green', _src: 'gaap', _also: [0] },
          { metric: 'Flux libre du deuxième trimestre', value: '137,6 M$', signal: 'Contre 69,9 M$ un an plus tôt', signalColor: 'green', _src: 1 },
          { metric: 'EV/revenus GAAP', value: fr(evRev, 1) + '×', signal: 'Valeur d’entreprise au close du 2026-09-23, 80,6 millions d’actions, sur revenus GAAP douze mois au 2026-07-31', signalColor: 'amber', source: 'Clôture certifiée et XBRL SEC', comparison: 'Versus Datadog à ' + ddog + ', ServiceNow à ' + now + ', Oracle à ' + orcl + ' et Salesforce à ' + crm + ' (fiches publiées, même base et même date), Snowflake à ' + fr(snow, 1) + '× et Elastic à ' + fr(estc, 1) + '× (statistiques courantes du 24 septembre, non point-in-time) : au milieu des éditeurs de données.', _src: 'market', _peers: ['SNOW', 'ESTC'], _peerField: 'enterpriseToRevenue', _peerFiches: ['DDOG', 'NOW', 'ORCL', 'CRM'] },
          { metric: 'EV/revenus GAAP sur base diluée', value: fr((close * 85.8e6 - G$.cash) / G$.rev, 1) + '×', signal: 'Même calcul au close du 2026-09-23 avec les 85,8 millions d’actions entièrement diluées du communiqué', signalColor: 'amber', source: 'Clôture certifiée, XBRL SEC et communiqué du 1er septembre', comparison: 'Versus la base de 80,6 millions d’actions : les attributions salariales ajoutent environ trois quarts de point de multiple.', _src: 'market', _also: [1] },
          { metric: 'EV sur revenus prévus pour l’exercice 2027', value: fr(evFwd, 1) + '×', signal: 'Valeur d’entreprise au close du 2026-09-23 sur le milieu de la prévision de la société (3,01 Md$)', signalColor: 'amber', source: 'Clôture certifiée, XBRL SEC et communiqué du 1er septembre', comparison: 'Versus le multiple glissant : la prévision tenue ramène le multiple d’un point environ.', _src: 'market', _also: [1] },
          { metric: 'EV/revenus — scénario de compression (hypothèse éditoriale)', value: fr(scn.price, 2) + ' $ par action', signal: 'Scénario : multiple ramené à huit fois les revenus GAAP douze mois au 2026-07-31 par hypothèse, bilan du 31 juillet, soit ' + fr(scn.downside_pct, 0) + ' % sous le close du 2026-09-23', signalColor: 'red', source: 'Clôture certifiée et XBRL SEC', comparison: 'Versus Oracle à ' + orcl + ' (fiche publiée) : huit fois correspond au multiple du premier concurrent cité par le 10-K ; ce que coûterait un ralentissement confirmé, pas un objectif.', _src: 'market', _peerFiches: ['ORCL'] }],
        sourceRefs: [ref(0), ref(1), market('fondamentaux et statistiques')] },
      earnings: { quarters: [],
        beatNote: 'Deuxième trimestre de l’exercice 2027 : revenus de 771,8 M$ (+30 %), Atlas +29 %, résultat opérationnel GAAP de 28,4 M$ et ajusté de 185,9 M$, bénéfice net GAAP de 40,9 M$, flux libre de 137,6 M$. La guidance du troisième trimestre vise 756 à 761 M$ de revenus, sous le deuxième, avec une perte opérationnelle GAAP de 10,5 à 14,5 M$ ; celle de l’exercice est relevée à 2,99–3,03 Md$. La date du troisième trimestre, non annoncée par l’émetteur dans les dépôts ouverts, est placée au 1er décembre par le calendrier de marché.',
        nextEarnings: 'Date non annoncée par l’émetteur ; le calendrier de marché indique le 1er décembre.',
        sourceRefs: [ref(1)] },
      capitalStructure: { sharesOutstanding: '80 556 341 actions au 28 août 2026 (page de garde du 10-Q)',
        sharesAuthorized: '1 000 000 000 d’actions autorisées : non décisionnel pour ce dossier.', dilutionRisk: 'low',
        shareHistory: 'Base retenue : actions en circulation. Elles passent de 80,5 millions au 31 janvier 2026 à 80,6 millions au 31 juillet et 80,56 millions au 28 août : les 666 452 actions rachetées au semestre pour 200,0 M$, à 300,10 $, compensent à peu près les attributions salariales. L’autorisation totale de rachat atteint 1,0 Md$. Passage au nombre dilué : le communiqué retient 85,8 millions d’actions entièrement diluées, soit environ 6,5 % de plus que la base, par les attributions salariales. Aucune dette financière, aucun titre convertible, aucun programme d’émission sur le marché ; le S-8 de mars enregistre l’augmentation annuelle des plans, pas une levée de fonds.',
        warrants: [], atm: { active: false, authorized: 'Aucun programme d’émission d’actions sur le marché relevé', used: 'Sans objet', remaining: 'Sans objet' },
        sourceRefs: [ref(0)] },
      filingsReview: { summary: 'Trois dépôts décisionnels ouverts et hachés. Ils décrivent une société sans dette, qui rachète ses actions et devient rentable en GAAP, mais dont la prévision du troisième trimestre, inférieure au deuxième, a provoqué le gap du 2 septembre. Aucun client ne pèse plus de 10 % des revenus.',
        filings: docs.map(d => ({ date: d.date, form: d.form, accession: d.accession, finding: d.finding, url: d.url })),
        contrarianRisks: [
          'L’offre sur site, reconnue en partie en début de contrat, rend les trimestres irréguliers : le deuxième a pu être gonflé par quelques gros contrats.',
          'Atlas dépend des grands clouds pour son hébergement, et ces mêmes clouds vendent des bases concurrentes moins chères.',
          'Le résultat GAAP reste proche de zéro une fois la rémunération en actions comptée.',
          'Le titre a presque effacé son gap en trois semaines : une deuxième déception le laisserait sans support proche au-dessus de 380 $.'] },
      technicals: { rsi14: +tech.rsi14.toFixed(2), macd: +tech.macd.toFixed(2), macdSignal: +tech.macdSignal.toFixed(2), ema20: +tech.ema20.toFixed(2), ema50: +tech.ema50.toFixed(2), ema200: +tech.ema200.toFixed(2),
        ma50Type: 'EMA', ma200Type: 'EMA', ma50Available: true, ma200Available: true, atr14: +tech.atr14.toFixed(2),
        badges: ['Gap du 2 septembre comblé en séance le 22', 'Au-dessus des moyennes à vingt, cinquante et deux cents séances', 'Résistances à ' + usd(lv('r1')) + ', ' + usd(lv('r2')) + ' et ' + usd(lv('r3'))],
        supports: [lv('s1'), lv('s2'), lv('s3')], resistances: [lv('r1'), lv('r2'), lv('r3')],
        setupNote: 'Le titre clôture à ' + usd(close) + ', au-dessus de ses moyennes à vingt, cinquante et deux cents séances, avec un RSI à ' + fr(tech.rsi14, 1) + '. Supports : ' + usd(lv('s1')) + ', bas du 23 septembre, ' + usd(lv('s2')) + ', bas du 22, et ' + usd(lv('s3')) + ', bas du 21. Résistances : ' + usd(lv('r1')) + ', plus haut du 22 septembre, ' + usd(lv('r2')) + ', plus haut du 1er septembre, et ' + usd(lv('r3')) + ', sommet du 14 août. Un achat sur clôture au-dessus de ' + usd(bo.e) + ' avec un stop sous ' + usd(bo.s) + ' risquerait ' + usd(bo.e - bo.s) + ', soit ' + fr((bo.e - bo.s) / tech.atr14, 2) + ' ATR, pour viser ' + usd(bo.t) + ' : R/R de ' + fr(bo.rr, 2) + ', loin du minimum de 1,5.',
        wyckoff: 'Non utilisé : le profil de volume n’est pas exploité dans ce dossier.',
        sourceRefs: [market('barres quotidiennes et indicateurs recalculés')] },
      options: { callOI: 'Non exploitable', putOI: 'Non exploitable', cpRatio: 'Non exploitable', maxPain: 'Non exploitable', ivMean: 'Non exploitable', skew: 'Chaîne relevée en séance le 24 septembre, non rattachée à la clôture de référence', unusual: 'Aucune activité inhabituelle qualifiée', sourceRefs: [market('options')] },
      shortInterest: { siPct: fr(st.shortPercentOfFloat * 100, 2) + ' % du flottant', daysToCover: fr(st.shortRatio, 2) + ' jours, date de règlement non précisée par le snapshot', ctb: 'Coût d’emprunt non retenu comme signal', trend: 'Positions vendeuses faibles ; aucune thèse de rachat forcé des vendeurs.', squeezeScore: 'Non pertinent', sourceRefs: [market('positions vendeuses')] },
      insiders: { signal: 'Une seule vente relevée : l’administratrice Hope Cochran, 1 000 actions le 17 septembre, environ 376 000 $. Aucun achat. Couverture officielle partielle : aucun solde net publié.',
        recentTransactions: [],
        sourceRefs: [market('formulaires 4')] },
      macro: { indicators: [{ name: 'Clôture de référence', value: c.REF, signal: usd(close) + ', séance complète' }, { name: 'Rendement cinq séances', value: sgn(ret(5)), signal: 'Descriptif' }, { name: 'Rendement vingt et une séances', value: sgn(ret(21)), signal: 'Descriptif' }],
        regime: 'neutral', impact: 'MongoDB vit des budgets de développement d’applications, facturés en partie à l’usage : un ralentissement économique se lit vite dans la consommation d’Atlas. Sans dette, la société est peu exposée au coût du crédit, mais son multiple reste sensible aux taux longs.' },
      risks: { riskScore: 5, riskProfile: 'Moderate',
        riskSummary: 'Le risque de MongoDB tient au décalage entre une croissance de 30 % et une prévision de troisième trimestre inférieure au deuxième : le marché l’a sanctionné de 13 % en une séance, puis en a racheté presque tout en trois semaines. Le bilan, sans dette, n’est pas le sujet. Le titre bute maintenant sur trois résistances rapprochées, sans point d’entrée.',
        riskCards: [
          { title: 'Prévision en recul d’un trimestre à l’autre', severity: 'medium', icon: 'fa-chart-line', points: ['Troisième trimestre guidé entre 756 et 761 M$.', 'Deuxième trimestre à 771,8 M$.'], verdict: 'Si le quatrième trimestre ne rattrape pas, la croissance annuelle ralentira nettement l’an prochain.' },
          { title: 'Trimestres irréguliers', severity: 'medium', icon: 'fa-arrows-up-down', points: ['Offre sur site reconnue en partie en début de contrat.', 'Gap de ' + fr(pct(d0902[1], p0902[4]), 1) + ' % le 2 septembre.'], verdict: 'Chaque publication peut déplacer le titre de plus de 10 % : ne pas la porter sans l’avoir réduite.' },
          { title: 'Concurrence des grands clouds', severity: 'medium', icon: 'fa-building', points: ['Atlas hébergé sur AWS, Azure et Google Cloud.', 'Ces clouds vendent leurs propres bases.'], verdict: 'La pression sur les prix viendra des mêmes partenaires qui hébergent le service.' },
          { title: 'Pas de point d’entrée', severity: 'low', icon: 'fa-door-closed', points: ['Résistances à ' + usd(lv('r1')) + ', ' + usd(lv('r2')) + ' et ' + usd(lv('r3')) + '.', 'R/R de ' + fr(bo.rr, 2) + ' sur une cassure du 1er septembre.'], verdict: 'Attendre un repli tenu ou une sortie au-dessus du sommet d’août plutôt qu’acheter sous les résistances.' }],
        pedagogy: 'Un gap comblé, c’est un titre revenu au prix d’avant la mauvaise nouvelle : ceux qui avaient acheté avant la publication peuvent enfin sortir sans perte, et ils vendent. D’où les résistances juste au-dessus. Le slippage, l’écart entre prix voulu et prix obtenu, reste modeste sur environ ' + fr(adv / 1e6, 0) + ' M$ échangés par séance ; c’est le gap de publication, comme le 2 septembre, qui décide du résultat. Quand un plan reviendra, la taille de la position se calculera sur la distance au stop et un budget de perte fixé d’avance, sans porter la publication de décembre.' },
      tradeIdea: { status: 'no-trade', archiveReferenceClose: archive.meta.levelsCloseDate,
        statusNote: 'Aucun plan. Les niveaux affichés sont ceux, archivés, du dossier du 27 août, neutralisés par la publication du 1er septembre : ils n’ont jamais été activés et aucun ordre n’y est attaché. Ce plan n’était pas viable : son R/R affiché de 1:' + rr1.toFixed(2) + ' reposait sur un stop à ' + usd(stop) + ', ' + usd(entry - stop) + ' sous l’entrée, soit ' + fr((entry - stop) / tech.atr14, 2) + ' ATR, qu’une séance ordinaire suffisait à franchir. Un nouveau plan ne sera construit que sur une clôture au-dessus de ' + usd(lv('r3')) + ' ou sur un repli tenu vers ' + usd(lv('s3')) + '.',
        entry, stop, tp1, tp2,
        stopPct: pct(stop, entry).toFixed(1) + '%', tp1Pct: '+' + pct(tp1, entry).toFixed(1) + '%', tp2Pct: '+' + pct(tp2, entry).toFixed(1) + '%',
        rr: '1:' + rr1.toFixed(2) + ' TP1 / 1:' + rr2.toFixed(2) + ' TP2',
        entryNote: 'Niveaux historiques affichés pour mémoire, non exécutables et non viables : stop à ' + fr((entry - stop) / tech.atr14, 2) + ' ATR de l’entrée, dans le bruit d’une seule séance. Un achat sur clôture au-dessus du plus haut du 1er septembre, ' + usd(bo.e) + ', avec un stop sous le bas du 22 septembre, ' + usd(bo.s) + ', risquerait ' + usd(bo.e - bo.s) + ' pour viser le sommet du 14 août, ' + usd(bo.t) + ' : R/R de ' + fr(bo.rr, 2) + '. Liquidité : environ ' + fr(adv / 1e6, 0) + ' M$ échangés par séance, médiane des vingt dernières.',
        horizon: 'Aucun horizon : pas de plan au cours actuel',
        thesis: 'Le marché a vendu la prévision du troisième trimestre puis racheté le titre avec le logiciel. La croissance est réelle et le bilan sans dette, mais le point d’entrée n’existe pas : trois résistances en moins de 11 % au-dessus du cours. Aucun ordre : attendre une sortie au-dessus du sommet du 14 août, ou un repli qui tienne au-dessus du bas du 21 septembre, puis reconstruire des niveaux.',
        catalysts: ['Une clôture au-dessus de ' + usd(lv('r3')) + ', sommet du 14 août, qui dégagerait les résistances.', 'Un repli vers ' + usd(lv('s3')) + ' qui tienne en clôture, avec un volume en baisse.', 'Aucune publication de la société ni d’un comparable dans les quatorze jours du calendrier collecté : le risque de gap vient du secteur.'],
        invalidation: ['Toute entrée au cours actuel contredit ce dossier.', 'Une clôture sous ' + usd(lv('s3')) + ' rouvrirait la zone du gap et repousserait tout plan.', 'Une baisse de prévision d’un grand cloud sur ses services de données changerait la lecture de la concurrence.'] },
      globalScore: { profile: 'Croissance réaccélérée, prévision prudente, titre sous résistances',
        keyTakeawaysPositive: ['Revenus +30 %, Atlas +29 %.', 'Aucune dette, 2,41 Md$ de liquidités.', 'Flux libre en forte hausse.'],
        keyTakeawaysNegative: ['Troisième trimestre guidé sous le deuxième.', 'Résultat GAAP proche de zéro.', 'Trois résistances rapprochées.'],
        mindsetTip: 'Quand un titre reprend en trois semaines presque tout un gap de 13 %, le marché a déjà pardonné. Acheter à ce moment, c’est parier qu’il n’y aura rien à pardonner la prochaine fois.' },
      social: { platforms: [], sourceRefs: [market('sentiment non retenu faute de mesure qualifiée')] },
      disclaimer: 'Document de recherche éducatif. Ni conseil financier, ni signal de trading. Aucun plan actif : aucun ordre attaché aux niveaux archivés.',
    };
  },
  groups: [
    { name: 'Référence des plateformes de données', order: 1, transmission: 'Le pair coté le plus proche par l’activité, facturé à l’usage sur les mêmes clouds.', rows: [
      ['SNOW', 'leader', 'Plateforme de données en nuage', 'Même clientèle de données et même facturation à l’usage ; ses publications donnent le ton des éditeurs de données.']] },
    { name: 'Pairs directs cités par le 10-K', order: 1, transmission: 'Bases de données concurrentes, historiques ou des grands clouds.', rows: [
      ['ORCL', 'direct_peer', 'Base de données historique et cloud', 'Premier concurrent historique cité par le 10-K ; son multiple sert de repère au scénario.'],
      ['IBM', 'direct_peer', 'Bases de données d’entreprise', 'Concurrent historique cité par le 10-K sur les bases de données d’entreprise.'],
      ['ESTC', 'direct_peer', 'Recherche et bases orientées documents', 'Concurrent sur la recherche et la recherche vectorielle, où MongoDB avance.']] },
    { name: 'Amont : hébergeurs et concurrents', order: 1, transmission: 'Atlas est hébergé presque entièrement sur AWS, Azure et Google Cloud, qui vendent aussi des bases concurrentes.', rows: [
      ['AMZN', 'upstream', 'Hébergeur AWS et bases concurrentes', 'Héberge Atlas selon le 10-K ; ses propres bases de documents concurrencent directement MongoDB.'],
      ['MSFT', 'upstream', 'Hébergeur Azure et bases concurrentes', 'Héberge Atlas et vend ses propres bases ; concurrent cité par le 10-K.'],
      ['GOOGL', 'upstream', 'Hébergeur Google Cloud et bases concurrentes', 'Héberge Atlas ; ses bases gérées pèsent sur les prix des usages simples.']] },
    { name: 'Second ordre : logiciels des développeurs', order: 2, transmission: 'Budgets des mêmes équipes de développement et d’exploitation.', rows: [
      ['DDOG', 'second_order', 'Observabilité des infrastructures cloud', 'Corrélation forte depuis fin mars ; ses chiffres d’usage mesurent les mêmes budgets cloud.'],
      ['NOW', 'second_order', 'Automatisation des processus d’entreprise', 'Même cycle de budgets logiciels des grandes entreprises ; forte corrélation depuis fin mars.'],
      ['TEAM', 'second_order', 'Outils des équipes de développement', 'Même acheteur, les équipes techniques ; ses prévisions éclairent leurs budgets.'],
      ['GTLB', 'second_order', 'Chaîne de développement logiciel', 'Budget voisin des développeurs, sensible aux mêmes optimisations de dépenses.'],
      ['NET', 'second_order', 'Réseau et services en périphérie', 'Propose aussi des services de données pour développeurs ; même public.'],
      ['CRM', 'second_order', 'Applications de relation client', 'Grand éditeur d’applications ; ses prévisions donnent le ton des budgets logiciels.'],
      ['CRWD', 'second_order', 'Sécurité en nuage', 'Budget cloud voisin ; sert de contrôle de la demande logicielle en croissance.']] },
    { name: 'Contrôles sectoriels', order: 2, transmission: 'Paniers de référence pour isoler ce qui est propre à MongoDB.', rows: [
      ['IGV', 'sector_proxy', 'Panier de logiciels américains', 'Un écart avec ce panier isole ce qui est propre au titre.'],
      ['WCLD', 'sector_proxy', 'Panier de logiciels en nuage équipondéré', 'Mesure le sort des éditeurs cloud de taille moyenne, sans les géants.'],
      ['QQQ', 'sector_proxy', 'Grandes valeurs du Nasdaq', 'Contrôle large : un mouvement commun avec ce panier n’a rien de spécifique au titre.']] },
  ],
  eventDefault: { leader: 'Aucune publication dans les quatorze jours collectés ; ses chiffres d’usage donnent le ton des éditeurs de données', direct_peer: 'Aucune publication dans les quatorze jours collectés ; ses annonces de prix peuvent déplacer les parts de marché', upstream: 'Aucune publication dans les quatorze jours collectés ; ses prix de bases gérées restent le signal à suivre', second_order: 'Aucune publication dans les quatorze jours collectés ; ses prévisions éclairent les budgets des équipes techniques', sector_proxy: 'Panier sans publication propre ; exposé aux résultats de ses grandes pondérations' },
  eventRisk: {},
  blastDoc: 2,
  scenarios: c => [
    { scenario: 'bullish', trigger: 'Le logiciel prolonge sa hausse et les pairs facturés à l’usage confirment la consommation.', firstOrder: 'Le titre clôture au-dessus du sommet du 14 août.', secondOrder: 'Datadog et Snowflake suivent ; IGV confirme.', confirmation: 'Une clôture au-dessus de ' + c.usd(c.lv('r3')) + ' avec IGV en hausse.', contradiction: 'Un dépassement pendant que IGV recule.' },
    { scenario: 'mixed', trigger: 'Pas de nouvelle propre avant décembre.', firstOrder: 'Le titre oscille entre ' + c.usd(c.lv('s3')) + ' et ' + c.usd(c.lv('r3')) + '.', secondOrder: 'L’écart avec IGV reste faible, sans information propre au titre.', confirmation: 'Des clôtures sous les résistances pendant plusieurs séances.', contradiction: 'Une sortie franche d’un côté ou de l’autre.' },
    { scenario: 'bearish', trigger: 'Rotation hors du logiciel ou déception d’un pair facturé à l’usage.', firstOrder: 'Le titre repasse sous le bas du 21 septembre et retourne vers la zone du gap.', secondOrder: 'Les éditeurs à l’usage reculent davantage que le panier.', confirmation: 'Une clôture sous ' + c.usd(c.lv('s3')) + ' avec IGV en baisse.', contradiction: 'Un repli du secteur que le titre ne suit pas.' }],
  contradictions: c => ['La croissance publiée atteint 30 %, la meilleure depuis plusieurs années, mais la prévision du troisième trimestre est inférieure au deuxième : les deux chiffres viennent du même communiqué.', 'Une corrélation élevée avec Datadog ne prouve pas un lien commercial ; aucun client ne dépasse 10 % des revenus.'],
  missingData: c => ['Aucun client à plus de 10 % des revenus : aucun client coté n’entre dans les comparables comme client documenté.', 'Part exacte d’Atlas et de l’offre sur site dans les revenus non reprise dans les extraits ouverts.', 'Chaîne d’options relevée en séance, non rattachée à la clôture ; sentiment non retenu.', 'Barres d’une source de repli pour toutes les séries.'],
  limitations: ['Barres d’une source de repli (Webull).', 'Options non rattachées à la clôture de référence.', 'Répartition Atlas / sur site non reprise.'],
});
