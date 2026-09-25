'use strict';
// Dossier SentinelOne (S) v3 au close du 2026-09-24. Refonte de la v1 anglaise du 28 août (trade clôturé).
// Contenu éditorial et niveaux propres au titre ; calculs, provenance et preuves délégués au gabarit
// tools/lib/analysis-v3-r06.cjs (copie du gabarit R05 avec clôture de référence 2026-09-24, run 20260925).
// Agrégats GAAP lus dans les données XBRL officielles de la SEC (companyfacts, 10-Q du 31 juillet inclus) :
// douze mois glissants = cumul de l'exercice au 2e trimestre + exercice clos le 31 janvier − cumul de même
// durée de l'exercice précédent. Bilan = valeurs au 31 juillet 2026. Aucune dette : la clé dette est vide.
// Actions = Class A (342 184 493) + Class B (5 864 624) au 21 août, la Class B portant vingt voix par titre.
const R = require('../../../../tools/lib/analysis-v3-r06.cjs');
const GEN = 'analyses/S/_runs/20260925/build-s.cjs';
const SHARES = 342184493 + 5864624; // 348 049 117 : deux classes, poids économique identique

R.build({
  ticker: 'S', shortName: 'SentinelOne', cik: 1583708, generator: GEN, mode: 'archived',
  xbrl: {
    ttm: { rev: ['RevenueFromContractWithCustomerExcludingAssessedTax'], ebit: ['OperatingIncomeLoss'], ni: ['NetIncomeLoss'], da: ['DepreciationAndAmortization'], ocf: ['NetCashProvidedByUsedInOperatingActivities'], capex: ['PaymentsToAcquirePropertyPlantAndEquipment'] },
    instant: { cashEq: ['CashAndCashEquivalentsAtCarryingValue'], sti: ['ShortTermInvestments'], lti: ['LongTermInvestments'] },
    da: ['da'], debt: [], cash: ['cashEq', 'sti', 'lti'] },
  scenarioBasis: 'revenue', scenarioMultiple: 5,
  valuationBasis: 'GAAP douze mois au 2026-07-31 (XBRL SEC) ; EBITDA GAAP négatif, donc multiple appliqué aux revenus ; aucune dette ; trésorerie = liquidités, placements court et long terme au 31 juillet ; 348 049 117 actions (Class A et Class B) ; multiple de cinq fois les revenus = hypothèse éditoriale de re-cotation vers un éditeur à croissance lente',
  shares: { value: SHARES, doc: 0 },
  levels: { r1: { d: '2026-09-24', c: 2 }, s1: { d: '2026-09-18', c: 3 }, s2: { d: '2026-08-21', c: 4 }, s3: { d: '2026-09-02', c: 3 } },
  supports: ['s1', 's2', 's3'], resistances: ['r1'],
  levelsMethod: 'Niveaux archivés conservés à l’identique ; repères actuels lus sur les barres certifiées.',
  inventory: 24,
  reviewScope: 'Dépôts EDGAR de SentinelOne du 25 septembre 2025 au 24 septembre 2026 (24 formulaires hors formulaires 3, 4, 5 et 144), dont le 10-K de l’exercice clos le 31 janvier 2026, le 10-Q du 31 juillet et le 8-K de résultats du deuxième trimestre. Les 8-K de gouvernance (items 5.02, 5.07), le rapport annuel aux actionnaires, la procuration et son complément, les Schedule 13G des gestionnaires passifs et les S-8 des plans salariés sont écartés comme non décisionnels ; aucun S-1, S-3, 424B, obligation convertible ni programme d’émission sur le marché n’apparaît dans la période.',
  docs: [
    ['2026-08-28', '10-Q', '0001583708-26-000055', 's-20260731.htm', 'q2-10q__s-20260731.htm',
      'Rapport trimestriel au 31 juillet 2026 : 342 184 493 actions Class A et 5 864 624 actions Class B au 21 août ; aucune dette financière ; aucun client final au-delà de 9 % de l’ARR ; revenus hors États-Unis à 39 % du chiffre d’affaires du trimestre.'],
    ['2026-08-27', '8-K / Exhibit 99.1', '0001583708-26-000052', 'sentineloneq227exhibit991.htm', 'q2-8k__sentineloneq227exhibit991.htm',
      'Communiqué du deuxième trimestre : revenus de 292 M$ (+21 %), ARR de 1 218 M$ (+22 %), marge brute GAAP de 72 % contre 75 %, marge opérationnelle non-GAAP de 10 % contre 2 %, perte nette GAAP de 93,4 M$ ; 1 715 clients à plus de 100 000 $ d’ARR ; 813 M$ de trésorerie et placements. Prévision : 309 à 311 M$ au troisième trimestre, 1,202 à 1,207 Md$ sur l’exercice.'],
    ['2026-03-19', '10-K', '0001583708-26-000020', 's-20260131.htm', 'fy26-10k__s-20260131.htm',
      'Rapport annuel de l’exercice clos le 31 janvier 2026 : structure à deux classes, la Class B portant vingt voix par action ; vente principalement par des partenaires de distribution (distributeurs, revendeurs, MSSP) comptés comme clients ; plateforme Singularity endpoint, cloud et identité.'],
  ],
  needles: {
    shares: [0, ['had 342,184,493 shares of Class A common stock and 5,864,624 shares of Class B common stock outstanding', 'no single end customer accounted for more than 9% of our ARR']],
    results: [1, ['Total revenue grew 21% to $292 million, compared to $242 million', 'Annualized recurring revenue (ARR) grew 22% to $1,218 million as of July 31, 2026', 'GAAP gross margin was 72%, compared to 75%', 'Non-GAAP operating margin was 10%, compared to 2%', 'Customers with ARR of $100,000 or more grew 13% to 1,715 as of July 31, 2026', '813 million as of July 31, 2026']],
    guidance: [1, ['Revenue $309 - 311 million $1.202 - 1.207 billion', 'Non-GAAP operating income $38 - 40 million $124 - 128 million']],
    annual: [2, ['Class B common stock has 20 votes', 'reseller or distributor channel partners as customers']],
  },
  sectionDocs: { verdict: [1, 0], business: [2, 1, 0], news: [1], earnings: [1], capitalStructure: [0, 2], filingsReview: [0, 1, 2], risks: [1, 0, 2], globalScore: [1], meta: [1], disclaimer: [1], macro: [2], options: [1], social: [1], header: [0] },
  score: { business: 22, technical: 8, capital: 6, calendar: 0, dilution: -3, risk: 20 },
  peers: true,
  peerFicheSha: {},
  route: (p, { prov, dep, B }) => {
    if (/^news\.[12]\./.test(p)) return prov('bars', B, 'Ouverture et clôture lues sur les barres certifiées ; écart d’ouverture = ouverture / clôture de la veille − 1 ; comparaison avec les pairs cyber sur la même séance.', [dep('comparison', '')]);
    return null;
  },
  riskScoreReason: 'Jugement qualitatif sur dix : bilan sans dette et trésorerie nette de 813 M$, mais perte nette GAAP structurelle, croissance décélérée à 21 %, dirigeants vendeurs en septembre et cours au plus haut de cinquante-deux semaines, cible de consensus déjà atteinte.',
  compose: c => {
    const { fr, usd, pct, sgn, close, prev, bars, N, tech, st, M, adv, ret, G$, marketCap, ev, scn, entry, stop, tp1, tp2, rr1, rr2, cap, sizeExample, ref, market, docs, raw, peerStat, lv } = c;
    const bar = d => bars.find(b => b[0] === d), prevOf = d => bars[bars.findIndex(b => b[0] === d) - 1];
    const cmp = raw.comparison_bars.data.items[0].results[0].data;
    const dr = (sym, d) => { const b = cmp.find(x => x.symbol === sym).bars, i = b.findIndex(x => x[0] === d); return pct(b[i][4], b[i - 1][4]); };
    const d0914 = bar('2026-09-14'), p0914 = prevOf('2026-09-14'), d0924 = bar('2026-09-24');
    const d0827 = bar('2026-08-27'), p0827 = prevOf('2026-08-27');
    const evRev = ev / G$.rev, opMargin = G$.ebit / G$.rev * 100;
    const hi52 = d0924[2]; // 24,398 : plus haut intraday du 24 septembre, plus haut de 52 semaines
    const crwdRev = peerStat('CRWD', 'enterpriseToRevenue'), zsRev = peerStat('ZS', 'enterpriseToRevenue'), oktaRev = peerStat('OKTA', 'enterpriseToRevenue'), chkpRev = peerStat('CHKP', 'enterpriseToRevenue'), tenbRev = peerStat('TENB', 'enterpriseToRevenue');
    return {
      meta: { lang: 'fr', dir: 'ltr', level: 'intermediate', tags: ['us', 'equities', 'ai-chain', 'software', 'technology'], grade: 'B-', date: '2026-09-25', dateDisplay: '25 septembre 2026', version: 3, status: 'no-trade', assetType: 'stock', levelsCloseDate: c.REF,
        description: 'SentinelOne : l’éditeur de cybersécurité qui croît le moins cher du secteur, ARR à 1,22 Md$ (+22 %) payé six fois les revenus quand CrowdStrike se paie quarante-neuf fois. Mais perte GAAP, croissance décélérée et dirigeants vendeurs au plus haut. Dossier au close du 24 septembre 2026, aucun ordre.',
        ogDescription: 'SentinelOne : ARR +22 %, EV/revenus 6,9× contre 49× pour CrowdStrike ; perte GAAP, dirigeants vendeurs, titre au plus haut de 52 semaines ; aucun ordre au cours actuel.',
        lastMcpRefresh: raw.status.captured_at, levelsVerifiedAt: raw.status.captured_at,
        statusHistory: [...(c.archive.meta.statusHistory || []), { at: raw.status.captured_at, from: 'stopped', to: 'no-trade', note: 'refonte v3 du 25 septembre : trade précédent clôturé, aucun ordre au cours actuel au plus haut de 52 semaines, plan de repli défini, clôture de référence du 2026-09-24', close }] },
      header: { ticker: 'S', name: 'SentinelOne, Inc.', exchange: 'NYSE', sector: 'Cybersécurité : protection des postes, du cloud et de l’identité (XDR)', price: close, changePct: pct(close, prev),
        badges: [{ text: 'AUCUN ORDRE — TITRE AU PLUS HAUT', color: 'amber' }, { text: 'Chaîne IA — sécurité des déploiements IA', color: 'purple' }],
        metrics: { marketCap: fr(marketCap / 1e9, 2) + ' Md$', volume: fr(bars[N][5] / 1e6, 1) + ' M', evRevenue: fr(evRev, 1) + '×' }, halalStatus: 'unknown' },
      verdict: { score: 53, conviction: 'Moderate', bias: 'Neutral',
        confidence: 'Score éditorial non prédictif. Les chiffres d’entreprise viennent des dépôts SEC et des données XBRL officielles ; les niveaux, du close certifié du 24 septembre.',
        summary: 'SentinelOne est le numéro deux de la protection des postes de travail, derrière CrowdStrike. Au deuxième trimestre, ses revenus ont atteint 292 M$, en hausse de 21 %, et ses revenus récurrents annualisés 1 218 M$, +22 %. La société reste en perte comptable, 93,4 M$ au trimestre, mais dégage un résultat opérationnel non-GAAP positif et un flux de trésorerie libre positif, avec 813 M$ de trésorerie et aucune dette. Le vrai argument est le prix : à ' + fr(evRev, 1) + ' fois ses revenus des douze derniers mois, elle se paie moins cher que n’importe quel éditeur de sécurité en croissance de 20 %, quand CrowdStrike vaut ' + fr(crwdRev, 0) + ' fois les siens. Mais le titre clôture à ' + usd(close) + ', à son plus haut de cinquante-deux semaines, après un bond de ' + fr(ret(21), 0) + ' % en un mois porté par le secteur ; la cible moyenne des analystes est à peine au-dessus du cours et les dirigeants ont vendu en septembre. Le bon dossier au mauvais moment d’entrée : aucun ordre au cours actuel.',
        whyBuy: [
          'À ' + fr(evRev, 1) + ' fois les revenus, SentinelOne est l’éditeur de sécurité en croissance de 20 % le moins cher : CrowdStrike vaut ' + fr(crwdRev, 0) + '×, Zscaler ' + fr(zsRev, 0) + '×, Okta ' + fr(oktaRev, 0) + '×.',
          'ARR de 1 218 M$, +22 %, et 1 715 clients à plus de 100 000 $ d’ARR, +13 % : la base installée grossit.',
          'Bilan sans dette et 813 M$ de trésorerie et placements ; flux de trésorerie libre et résultat opérationnel non-GAAP redevenus positifs.',
          'Prévision annuelle de 1,202 à 1,207 Md$ de revenus et de 124 à 128 M$ de résultat opérationnel non-GAAP : la rentabilité progresse plus vite que le chiffre d’affaires.'],
        whyAvoid: [
          'Perte nette GAAP de ' + fr(Math.abs(G$.ni) / 1e6, 0) + ' M$ sur douze mois, alourdie par une rémunération en actions massive : la rentabilité comptable n’est pas là.',
          'Croissance retombée à 21 %, contre plus de 30 % il y a deux ans ; la marge brute GAAP recule de 75 % à 72 %.',
          'Le titre est à son plus haut de cinquante-deux semaines et la cible de consensus est déjà atteinte : le rendement attendu à court terme est faible.',
          'Dirigeants vendeurs en septembre — président-directeur général, directrice financière et deux autres — aucun achat.'],
        controlChecklist: [
          { label: 'Historique de cours', status: 'pass', statusLabel: 'Trois cents séances continues', evidence: 'Série quotidienne certifiée au close du 24 septembre.', action: 'Repères et indicateurs recalculés sur cette seule série.' },
          { label: 'Structure du capital', status: 'pass', statusLabel: 'Sans dette, deux classes', evidence: '10-Q du 31 juillet : 342 184 493 actions Class A et 5 864 624 Class B, aucune dette financière ; la Class B porte vingt voix par titre selon le 10-K.', action: 'Raisonner sur 348 millions d’actions ; contrôle concentré chez le fondateur.' },
          { label: 'Point d’entrée', status: 'warn', statusLabel: 'Titre au plus haut', evidence: 'Clôture à ' + usd(close) + ', plus haut de 52 semaines à ' + usd(hi52) + ' le 24 septembre ; cible de consensus voisine du cours.', action: 'Aucun ordre au cours actuel ; attendre un repli vers la zone de cassure.' }] },
      business: { theme: 'Plateforme de cybersécurité autonome : postes, cloud, identité et IA',
        overview: '<p>SentinelOne protège les ordinateurs, les serveurs, les environnements cloud et les identités des entreprises contre les cyberattaques. Sa plateforme Singularity détecte et bloque les menaces de façon automatique, avec de l’intelligence artificielle ; elle y ajoute un assistant, Purple AI, et des outils de journalisation de sécurité (SIEM). C’est le principal concurrent de CrowdStrike sur la protection des postes.</p><p>Au deuxième trimestre, les revenus ont atteint 292 M$, +21 % sur un an, et les revenus récurrents annualisés 1 218 M$, +22 %. La marge brute GAAP est tombée à 72 %, contre 75 % un an plus tôt, sous l’effet des coûts d’infrastructure et d’IA. La perte nette GAAP reste lourde, 93,4 M$, mais le résultat opérationnel non-GAAP est positif, à 10 % des revenus, et la société génère un flux de trésorerie libre positif.</p><p>SentinelOne vend surtout par des distributeurs, des revendeurs et des fournisseurs de services de sécurité, qu’elle compte comme ses clients ; aucun client final ne dépasse 9 % de ses revenus récurrents. Elle n’a pas de dette et dispose de 813 M$ de trésorerie. Son capital est à deux classes : les actions Class B, détenues par le fondateur, portent vingt voix chacune.</p>',
        moat: 'L’avantage tient à un agent unique qui couvre postes, cloud et identité, et à une base de plus d’un millier de gros clients qui adoptent plusieurs modules. Il reste attaqué des deux côtés : par CrowdStrike, plus gros et mieux margé, et par Microsoft, qui vend sa sécurité intégrée à ses licences. La croissance à 21 %, moitié de celle d’il y a deux ans, mesure cette pression.',
        segments: [
          { name: 'Abonnements Singularity', revenue: 'Quasi-totalité des revenus', pct: 'ARR de 1 218 M$', description: 'Protection des postes, du cloud et de l’identité, plus SIEM et Purple AI.' },
          { name: 'Gros clients (ARR ≥ 100 000 $)', revenue: 'Moteur de l’expansion', pct: '1 715 clients, +13 %', description: 'Comptes qui adoptent plusieurs modules de la plateforme.' }],
        sourceRefs: [ref(2), ref(1), ref(0)],
        coverageMatrix: [
          { facet: 'Cours et historique', status: 'COUVERT', decision: 'Trois cents séances continues, close certifié ; base des repères et des indicateurs.' },
          { facet: 'Résultats et guidance', status: 'COUVERT — PRIMAIRE', decision: 'Communiqué du deuxième trimestre et 10-Q ; date du troisième trimestre non annoncée par l’émetteur.' },
          { facet: 'Capital', status: 'COUVERT — PRIMAIRE', decision: 'Actions par classe, absence de dette et concentration client lues dans le 10-Q ; deux classes de vote dans le 10-K.' },
          { facet: 'Agrégats GAAP', status: 'COUVERT — XBRL', decision: 'Douze mois glissants au 31 juillet 2026, reconstitués depuis les données XBRL officielles.' },
          { facet: 'Comparables et transmission', status: 'COUVERT — LOCAL', decision: 'Corrélations recalculées sur barres certifiées depuis la fin mars.' },
          { facet: 'Initiés', status: 'PARTIEL', decision: 'Ventes de dirigeants en septembre relevées ; couverture officielle incomplète, aucun solde net affirmé.' },
          { facet: 'Options', status: 'NON EXPLOITABLE', decision: 'Surface de volatilité relevée nulle et échéance à zéro jour ; non rattachée à la clôture de référence.' }] },
      news: [
        { date: '2026-08-27', title: 'Bond de ' + sgn(pct(d0827[4], p0827[4]), 1) + ' après des résultats au-dessus des attentes', impact: 'positive', detail: 'Le titre gagne ' + sgn(pct(d0827[4], p0827[4]), 2) + ' le 27 août après un deuxième trimestre au-dessus de la prévision : revenus de 292 M$ (+21 %), ARR de 1 218 M$ (+22 %), et une prévision annuelle relevée à 1,202 à 1,207 Md$. Le marché salue la rentabilité non-GAAP qui progresse.', source: 'SentinelOne — SEC', sourceUrl: docs[1].url },
        { date: '2026-09-14', title: 'Envolée de ' + fr(pct(d0914[4], p0914[4]), 0) + ' % avec le secteur cyber', impact: 'positive', detail: 'Ouverture à ' + usd(d0914[1]) + ' contre ' + usd(p0914[4]) + ', clôture à ' + usd(d0914[4]) + ' (' + sgn(pct(d0914[4], p0914[4]), 2) + '). CrowdStrike fait ' + sgn(dr('CRWD', '2026-09-14'), 2) + ' et l’indice CIBR ' + sgn(dr('CIBR', '2026-09-14'), 2) + ' la même séance : la hausse est sectorielle, portée par une rotation vers les logiciels qui sécurisent l’IA, pas propre à SentinelOne.', source: 'Barres certifiées', sourceUrl: c.evidenceUrl },
        { date: '2026-09-24', title: 'Plus haut de 52 semaines à ' + usd(hi52) + ', clôture en léger recul', impact: 'neutral', detail: 'Le titre inscrit un plus haut de cinquante-deux semaines à ' + usd(hi52) + ' en séance, puis referme à ' + usd(close) + ' (' + sgn(pct(close, prev), 2) + '). Après ' + sgn(ret(21), 1) + ' en vingt et une séances, le mouvement montre des signes d’essoufflement à la cible de consensus.', source: 'Barres certifiées', sourceUrl: c.evidenceUrl }],
      fundamentals: { rows: [
          { metric: 'Revenus du deuxième trimestre', value: '292 M$', signal: 'Contre 242 M$ un an plus tôt, +21 %', signalColor: 'green', _src: 1 },
          { metric: 'Revenus récurrents annualisés (ARR)', value: '1 218 M$', signal: '+22 % sur un an, au 31 juillet 2026', signalColor: 'green', _src: 1 },
          { metric: 'Clients à plus de 100 000 $ d’ARR', value: '1 715', signal: '+13 % sur un an : la base de gros comptes grossit', signalColor: 'green', _src: 1 },
          { metric: 'Marge brute GAAP du trimestre', value: '72 %', signal: 'Contre 75 % un an plus tôt : coûts d’infrastructure et d’IA', signalColor: 'amber', _src: 1 },
          { metric: 'Marge opérationnelle non-GAAP du trimestre', value: '10 %', signal: 'Contre 2 % un an plus tôt : levier opérationnel réel', signalColor: 'green', _src: 1 },
          { metric: 'Prévision de revenus 2027', value: '1,202 à 1,207 Md$', signal: 'Troisième trimestre attendu entre 309 et 311 M$', signalColor: 'blue', _src: 1 },
          { metric: 'Revenus GAAP sur douze mois', value: fr(G$.rev / 1e6, 0) + ' M$', signal: 'Douze mois glissants au 31 juillet 2026 (XBRL SEC), +20,6 %', signalColor: 'blue', _src: 'gaap' },
          { metric: 'Résultat opérationnel GAAP sur douze mois', value: fr(G$.ebit / 1e6, 1) + ' M$', signal: 'Marge de ' + fr(opMargin, 1) + ' %, douze mois glissants au 31 juillet 2026', signalColor: 'red', _src: 'gaap' },
          { metric: 'Résultat net GAAP sur douze mois', value: fr(G$.ni / 1e6, 1) + ' M$', signal: 'Douze mois glissants ; alourdi par la rémunération en actions', signalColor: 'red', _src: 'gaap' },
          { metric: 'EBITDA GAAP sur douze mois', value: fr(G$.ebitda / 1e6, 1) + ' M$', signal: 'Négatif : aucun multiple d’EBITDA n’est significatif', signalColor: 'red', _src: 'gaap' },
          { metric: 'Flux de trésorerie opérationnel sur douze mois', value: fr(G$.ocf / 1e6, 1) + ' M$', signal: 'Positif : la trésorerie entre malgré la perte comptable', signalColor: 'green', _src: 'gaap' },
          { metric: 'Flux de trésorerie libre sur douze mois', value: fr(G$.fcf / 1e6, 1) + ' M$', signal: 'Après investissements ; modèle logiciel peu capitalistique', signalColor: 'green', _src: 'gaap' },
          { metric: 'Trésorerie et placements au 31 juillet 2026', value: fr(G$.cash / 1e6, 0) + ' M$', signal: 'Liquidités, placements court et long terme ; aucune dette financière', signalColor: 'green', _src: 'gaap', _also: [0] },
          { metric: 'EV/revenus GAAP', value: fr(evRev, 1) + '×', signal: 'Valeur d’entreprise au close du 2026-09-24, 348 millions d’actions, sur revenus GAAP douze mois au 2026-07-31', signalColor: 'green', source: 'Clôture certifiée et XBRL SEC', comparison: 'Versus CrowdStrike à ' + fr(crwdRev, 0) + '×, Zscaler à ' + fr(zsRev, 0) + '× et Okta à ' + fr(oktaRev, 0) + '× (statistiques courantes du 25 septembre, non point-in-time) : l’éditeur en croissance de 20 % le moins cher du secteur.', _src: 'market', _peers: ['CRWD', 'ZS', 'OKTA'], _peerField: 'enterpriseToRevenue' },
          { metric: 'EV/revenus — scénario de re-cotation basse (hypothèse éditoriale)', value: fr(scn.price, 2) + ' $ par action', signal: 'Scénario : multiple ramené à cinq fois les revenus GAAP douze mois au 2026-07-31 par hypothèse, soit ' + fr(scn.downside_pct, 0) + ' % sous le close du 2026-09-24', signalColor: 'red', source: 'Clôture certifiée et XBRL SEC', comparison: 'Versus Check Point à ' + fr(chkpRev, 1) + '× et Tenable à ' + fr(tenbRev, 1) + '× : cinq fois reste au-dessus de ces éditeurs rentables à croissance lente ; ce que coûterait une décélération, pas un objectif.', _src: 'market', _peers: ['CHKP', 'TENB'], _peerField: 'enterpriseToRevenue' }],
        sourceRefs: [ref(1), ref(0), market('fondamentaux et statistiques')] },
      earnings: { quarters: [],
        beatNote: 'Deuxième trimestre de l’exercice 2027 (clos le 31 juillet 2026) : revenus de 292 M$ (+21 %), au-dessus de la prévision, ARR de 1 218 M$ (+22 %), marge brute GAAP de 72 %, perte nette GAAP de 93,4 M$, soit 0,27 $ par action, mais résultat opérationnel non-GAAP positif à 10 % des revenus. La guidance annuelle, relevée, vise 1,202 à 1,207 Md$ de revenus et 124 à 128 M$ de résultat opérationnel non-GAAP ; l’outlook du troisième trimestre est de 309 à 311 M$. Prochaine publication : date non annoncée par l’émetteur.',
        nextEarnings: 'Date non annoncée par l’émetteur ; aucune publication dans les quatorze jours du calendrier collecté.',
        sourceRefs: [ref(1)] },
      capitalStructure: { sharesOutstanding: '342 184 493 actions Class A et 5 864 624 actions Class B au 21 août 2026 (page de garde du 10-Q), soit 348 049 117 au total',
        sharesAuthorized: 'Actions autorisées non reprises : non décisionnel pour ce dossier.', dilutionRisk: 'moderate',
        shareHistory: 'Base retenue : 348 049 117 actions, somme des deux classes en circulation au 21 août ; les deux classes ont le même poids économique, la Class B (5 864 624 titres, détenue par le fondateur) portant vingt voix par action selon le 10-K, d’où un contrôle concentré. Passage au nombre dilué : la seule dilution est la rémunération en actions et les plans salariés, enregistrés par un S-8 le 19 mars ; il n’existe ni obligation convertible, ni bon de souscription, ni programme d’émission sur le marché, ni prospectus de tirage dans la période examinée. Le nombre d’actions augmente donc de façon régulière et prévisible avec la rémunération en actions, pas par une émission de marché.',
        warrants: [],
        atm: { active: false, authorized: 'Aucun programme d’émission sur le marché relevé', used: 'Sans objet', remaining: 'Sans objet' },
        sourceRefs: [ref(0), ref(2)] },
      filingsReview: { summary: 'Trois dépôts décisionnels ouverts et hachés, sur un inventaire de vingt-quatre formulaires hors déclarations d’initiés. Ils montrent une croissance réelle mais décélérée, une rentabilité non-GAAP qui s’installe, un bilan sans dette et, fait rare pour un éditeur en perte, aucune émission d’actions de marché sur la période.',
        filings: docs.map(d => ({ date: d.date, form: d.form, accession: d.accession, finding: d.finding, url: d.url })),
        contrarianRisks: [
          'La rémunération en actions dilue chaque année les actionnaires et sépare le résultat non-GAAP mis en avant de la perte GAAP réelle.',
          'La croissance a été divisée par plus de deux en deux ans : la décote sur les pairs peut simplement refléter une croissance qui converge vers celle des éditeurs matures.',
          'Microsoft vend sa sécurité intégrée à ses licences et CrowdStrike domine le haut de gamme : la place du numéro deux est disputée des deux côtés.',
          'La marge brute recule ; le coût d’exécution de l’IA pèse sur un modèle censé être très margé.'] },
      technicals: { rsi14: +tech.rsi14.toFixed(2), macd: +tech.macd.toFixed(2), macdSignal: +tech.macdSignal.toFixed(2), ema20: +tech.ema20.toFixed(2), ema50: +tech.ema50.toFixed(2), ema200: +tech.ema200.toFixed(2),
        ma50Type: 'EMA', ma200Type: 'EMA', ma50Available: true, ma200Available: true, atr14: +tech.atr14.toFixed(2),
        badges: ['Au plus haut de 52 semaines', 'Au-dessus des moyennes à vingt, cinquante et deux cents séances', 'Peu de résistance au-dessus'],
        supports: [lv('s1'), lv('s2'), lv('s3')], resistances: [lv('r1')],
        setupNote: 'Le titre clôture à ' + usd(close) + ', au-dessus de ses moyennes à vingt (' + usd(tech.ema20) + '), cinquante (' + usd(tech.ema50) + ') et deux cents séances (' + usd(tech.ema200) + '), RSI à ' + fr(tech.rsi14, 0) + '. Il vient d’inscrire un plus haut de 52 semaines à ' + usd(hi52) + ' : peu de résistance au-dessus. Aucun ordre : les niveaux du plan précédent, entrée ' + usd(entry) + ' et stop ' + usd(stop) + ', sont archivés et inactifs. Repères actuels : supports à ' + usd(lv('s1')) + ', ' + usd(lv('s2')) + ' et ' + usd(lv('s3')) + '.',
        wyckoff: 'Phase de hausse (markup) sur le profil de volume ; non utilisée pour fixer les niveaux.',
        sourceRefs: [market('barres quotidiennes et indicateurs recalculés')] },
      options: { callOI: 'Non exploitable', putOI: 'Non exploitable', cpRatio: 'Non exploitable', maxPain: 'Non exploitable', ivMean: 'Non exploitable', skew: 'Surface de volatilité relevée nulle, échéance à zéro jour ; non rattachée à la clôture de référence', unusual: 'Aucune activité inhabituelle qualifiée', sourceRefs: [market('options')] },
      shortInterest: { siPct: fr(st.shortPercentOfFloat * 100, 2) + ' % du flottant', daysToCover: fr(st.shortRatio, 2) + ' jours, date de règlement non précisée par la source', ctb: 'Coût d’emprunt non disponible à la collecte', trend: 'Positions vendeuses modérées ; aucune thèse de rachat forcé.', squeezeScore: 'Non retenu comme thèse', sourceRefs: [market('positions vendeuses')] },
      insiders: { signal: 'Vendeurs nets en septembre, aucun achat : le président-directeur général Tomer Weingarten a vendu environ 153 000 actions vers 19,8 $, la directrice financière Sonalee Parekh 21 664 actions à 19,44 $, le directeur juridique et la directrice comptable également, selon leurs formulaires 4. Les dirigeants détiennent 0,64 % du capital. Couverture officielle partielle : aucun solde net publié.',
        recentTransactions: [],
        sourceRefs: [market('formulaires 4')] },
      macro: { indicators: [{ name: 'Clôture de référence', value: c.REF, signal: usd(close) + ', séance complète' }, { name: 'Rendement cinq séances', value: sgn(ret(5)), signal: 'Descriptif' }, { name: 'Rendement vingt et une séances', value: sgn(ret(21)), signal: 'Descriptif' }],
        regime: 'risk-on', impact: 'SentinelOne suit le budget de cybersécurité des entreprises, réputé peu cyclique, et la prime de risque des logiciels de croissance. En régime favorable au risque, le secteur monte ensemble : le bond de septembre a été sectoriel. Sans dette, la société est peu sensible aux taux ; sa cote dépend surtout de sa croissance.' },
      risks: { riskScore: 5, riskProfile: 'Moderate',
        riskSummary: 'Le risque de SentinelOne n’est ni le bilan, sans dette et riche de 813 M$, ni une dilution de marché, absente. C’est une croissance qui ralentit vers celle des éditeurs matures, une perte GAAP structurelle masquée par des chiffres non-GAAP, et un point d’entrée : le titre est à son plus haut, la cible de consensus est atteinte et les dirigeants vendent.',
        riskCards: [
          { title: 'Croissance en décélération', severity: 'high', icon: 'fa-arrow-trend-down', points: ['Revenus +21 %, contre plus de 30 % il y a deux ans.', 'Marge brute GAAP en recul de 75 % à 72 %.'], verdict: 'Si la croissance converge vers celle des éditeurs matures, la décote de valorisation sur les pairs devient justifiée plutôt qu’une occasion.' },
          { title: 'Perte GAAP et rémunération en actions', severity: 'medium', icon: 'fa-money-bill-trend-up', points: ['Perte nette GAAP de ' + fr(Math.abs(G$.ni) / 1e6, 0) + ' M$ sur douze mois.', 'La rentabilité mise en avant est non-GAAP, hors rémunération en actions.'], verdict: 'La différence entre le résultat non-GAAP positif et la perte GAAP mesure la dilution annuelle payée aux salariés.' },
          { title: 'Concurrence des deux côtés', severity: 'medium', icon: 'fa-building', points: ['CrowdStrike domine le haut de gamme.', 'Microsoft vend sa sécurité avec ses licences.'], verdict: 'La place du numéro deux est disputée par plus gros et par mieux intégré : la part de marché n’est jamais acquise.' },
          { title: 'Entrée au plus haut', severity: 'medium', icon: 'fa-rocket', points: ['Cours au plus haut de 52 semaines, après ' + sgn(ret(21), 0) + ' en un mois.', 'Cible de consensus déjà atteinte ; dirigeants vendeurs.'], verdict: 'Acheter ici, c’est payer la fin d’un mouvement sectoriel ; le rapport risque-rendement au cours actuel est mauvais.' }],
        pedagogy: 'SentinelOne illustre l’écart entre deux comptabilités. Le résultat non-GAAP, positif, retire la rémunération en actions ; le résultat GAAP, en perte de ' + fr(Math.abs(G$.ni) / 1e6, 0) + ' M$, l’inclut. Cette rémunération est une vraie dilution : chaque année, il y a plus d’actions. La société ne lève pas d’argent sur le marché, ce qui est sain, mais un flux de trésorerie libre positif ne veut pas dire un bénéfice comptable. Côté marché, le titre échange environ ' + fr(adv / 1e6, 0) + ' M$ par séance : le slippage reste faible, mais un gap à l’ouverture après une publication peut sauter un stop d’un coup. Au plus haut, la taille d’une position doit rester modeste : mieux vaut ne pas courir après le titre et attendre un repli.' },
      tradeIdea: { status: 'no-trade', archiveReferenceClose: c.archive.meta.levelsCloseDate,
        statusNote: 'Aucun ordre actif. Les niveaux affichés — entrée ' + usd(entry) + ', stop ' + usd(stop) + ', TP1 ' + usd(tp1) + ', TP2 ' + usd(tp2) + ' — sont ceux, archivés, du plan précédent, désormais clos : inactifs et non exécutables. Vérifié sur les barres certifiées : le premier objectif a été atteint, le titre ayant dépassé ' + usd(tp1) + ' en séance jusqu’à ' + usd(hi52) + ' le 24 septembre. Le titre est aujourd’hui à son plus haut de cinquante-deux semaines, la cible de consensus est atteinte et les dirigeants ont vendu : aucun nouvel ordre au cours actuel.',
        entry, stop, tp1, tp2,
        stopPct: pct(stop, entry).toFixed(1) + '%', tp1Pct: '+' + pct(tp1, entry).toFixed(1) + '%', tp2Pct: '+' + pct(tp2, entry).toFixed(1) + '%',
        rr: '1:' + rr1.toFixed(2) + ' TP1 / 1:' + rr2.toFixed(2) + ' TP2',
        entryNote: 'Aucune entrée. Les niveaux ci-dessus sont archivés et non exécutables. Conditions de réexamen, sans ordre : un repli vers la zone de cassure d’août, dans les bas 20 $, qui rétablirait un rapport risque-rendement favorable, ou une consolidation tenue au-dessus du plus haut récent confirmée par le secteur. Liquidité : environ ' + fr(adv / 1e6, 0) + ' M$ échangés par séance ; ATR de ' + usd(tech.atr14) + '.',
        horizon: 'Aucune position au cours actuel',
        thesis: 'SentinelOne est le bon dossier au mauvais prix d’entrée. La société est structurellement la moins chère de son secteur pour sa croissance, sans dette, avec une rentabilité non-GAAP qui s’installe. Mais on ne l’achète pas à ' + usd(close) + ', à son plus haut de cinquante-deux semaines, quand la cible de consensus est déjà atteinte et que les dirigeants vendent. Le plan précédent a atteint son premier objectif et est clos ; le prochain achat se construira sur un repli vers la zone de cassure d’août, pas au cours actuel. La décote de valorisation est réelle, mais un bon point d’entrée ne l’est pas encore.',
        catalysts: ['Un repli vers la zone de cassure d’août, dans les bas 20 $, qui rétablirait un point d’entrée à rapport risque-rendement favorable.', 'La publication du troisième trimestre, date non annoncée, face à la prévision de 309 à 311 M$.', 'Toute rumeur d’offre de rachat : SentinelOne revient périodiquement dans les spéculations, sans confirmation.'],
        invalidation: ['Les niveaux affichés sont archivés et informatifs : aucun transfert vers une exécution actuelle.', 'Un achat au cours actuel, au plus haut, contredit ce dossier.', 'Une décélération de la croissance ou une nouvelle compression de marge changerait la thèse de valorisation.'] },
      globalScore: { profile: 'Numéro deux de la sécurité des postes, le moins cher pour sa croissance',
        keyTakeawaysPositive: ['EV/revenus de ' + fr(evRev, 1) + '×, la plus basse des éditeurs en croissance de 20 %.', 'ARR +22 %, bilan sans dette, flux de trésorerie libre positif.', 'Rentabilité non-GAAP qui progresse plus vite que le chiffre d’affaires.'],
        keyTakeawaysNegative: ['Perte GAAP structurelle et rémunération en actions dilutive.', 'Croissance retombée à 21 %, marge brute en recul.', 'Titre au plus haut, cible de consensus atteinte, dirigeants vendeurs.'],
        mindsetTip: 'Un titre bon marché et un bon point d’entrée sont deux choses différentes. La décote de SentinelOne est réelle, mais l’acheter à son plus haut après un mouvement sectoriel, c’est payer la prime du moment. La patience d’attendre un repli est ici l’avantage.' },
      social: { platforms: [], sourceRefs: [market('sentiment non retenu faute de mesure qualifiée')] },
      disclaimer: 'Document de recherche éducatif. Ni conseil financier, ni signal de trading. Aucun ordre actif : le plan de repli affiché n’est pas déclenché.',
    };
  },
  groups: [
    { name: 'Référence du segment', order: 1, transmission: 'Le leader de la protection des postes, titre coté qui co-évolue le plus avec SentinelOne depuis fin mars.', rows: [
      ['CRWD', 'leader', 'Protection des postes et plateforme de sécurité', 'Concurrent frontal et référence de valorisation ; corrélation la plus forte avec SentinelOne parmi les grandes plateformes depuis fin mars.']] },
    { name: 'Pairs directs : plateformes de sécurité', order: 1, transmission: 'Même budget de sécurité des entreprises, arbitré entre plateformes concurrentes.', rows: [
      ['PANW', 'direct_peer', 'Plateforme de sécurité la plus large', 'Regroupe la protection des postes dans un contrat unique : chaque module intégré réduit la place des spécialistes.'],
      ['ZS', 'direct_peer', 'Accès sécurisé en nuage', 'Plateforme de sécurité en nuage qui élargit son offre ; repère de valorisation d’un pair en croissance comparable.'],
      ['FTNT', 'direct_peer', 'Pare-feu et réseau sécurisé', 'Très présent chez les entreprises moyennes, clientèle que SentinelOne vise aussi.'],
      ['OKTA', 'direct_peer', 'Gestion des identités', 'L’identité est une surface d’attaque voisine ; SentinelOne y investit avec son module identité.'],
      ['NET', 'direct_peer', 'Réseau et sécurité en périphérie', 'Concurrent indirect sur la surface exposée à internet ; pair de croissance et de valorisation.'],
      ['RBRK', 'direct_peer', 'Cyber-résilience et sauvegarde', 'Budget de sécurité arbitré dans les mêmes comités d’achat.']] },
    { name: 'Pairs directs : détection, exposition et données', order: 1, transmission: 'Spécialistes de la détection et de la gestion d’exposition, souvent comparés sur le multiple.', rows: [
      ['TENB', 'direct_peer', 'Gestion des vulnérabilités', 'Éditeur rentable à croissance lente : le bas de la fourchette de valorisation du secteur.'],
      ['QLYS', 'direct_peer', 'Analyse des vulnérabilités en nuage', 'Pair rentable et margé ; repère de ce que le marché paie pour la conformité.'],
      ['RPD', 'direct_peer', 'Détection et gestion des vulnérabilités', 'Concurrent plus petit et moins cher ; montre le plancher de valorisation du segment.'],
      ['VRNS', 'direct_peer', 'Sécurité et gouvernance des données', 'Transition vers le nuage comparable ; même acheteur de sécurité.'],
      ['CHKP', 'direct_peer', 'Pare-feu d’entreprise rentable', 'Pair très rentable à croissance faible : le modèle de valorisation d’un éditeur mûr.']] },
    { name: 'Amont : hyperscalers et sécurité intégrée', order: 2, transmission: 'SentinelOne s’exécute sur les grands clouds, qui vendent aussi leur propre sécurité.', rows: [
      ['AMZN', 'upstream', 'Cloud AWS, partenaire IA', 'Héberge des charges de SentinelOne, avec une collaboration annoncée sur la gouvernance IA ; ses outils natifs concurrencent la sécurité du cloud.'],
      ['GOOGL', 'upstream', 'Google Cloud et sécurité intégrée', 'Fournit de l’infrastructure et, avec ses outils de sécurité, réduit l’espace des spécialistes chez ses clients.'],
      ['MSFT', 'second_order', 'Azure et suite de sécurité Defender', 'Sa sécurité intégrée, vendue avec ses licences, est la principale pression sur les prix des éditeurs spécialisés.']] },
    { name: 'Second ordre : incumbents et adjacents', order: 2, transmission: 'Éditeurs voisins dont les budgets et les journaux croisent ceux de SentinelOne.', rows: [
      ['CSCO', 'second_order', 'Réseau et SIEM (Splunk)', 'Propriétaire de Splunk : concurrent sur la journalisation de sécurité que SentinelOne attaque avec son SIEM.'],
      ['NOW', 'second_order', 'Automatisation des processus', 'Débouché des alertes de sécurité en flux de correction : lecture des budgets d’automatisation.'],
      ['DDOG', 'second_order', 'Observabilité et sécurité', 'Observabilité qui s’étend à la sécurité ; même acheteur technique, pair de croissance.']] },
    { name: 'Contrôles sectoriels', order: 2, transmission: 'Paniers de référence pour isoler ce qui est propre à SentinelOne.', rows: [
      ['CIBR', 'sector_proxy', 'Panier de cybersécurité pondéré', 'Un écart avec ce panier isole ce qui est propre à SentinelOne.'],
      ['HACK', 'sector_proxy', 'Panier de cybersécurité plus équipondéré', 'Mieux adapté à une valeur moyenne : montre si le secteur monte sans les géants.'],
      ['IGV', 'sector_proxy', 'Panier de logiciels américains', 'Contrôle large du logiciel : un mouvement commun n’a rien de spécifique au titre.']] },
  ],
  eventDefault: { leader: 'Aucune publication dans les quatorze jours collectés ; ses résultats donnent le ton du segment', direct_peer: 'Aucune publication dans les quatorze jours collectés ; ses annonces de produits peuvent déplacer les parts de marché', upstream: 'Aucune publication dans les quatorze jours collectés ; ses tarifs et ses offres intégrées restent à suivre', second_order: 'Aucune publication dans les quatorze jours collectés ; ses offres intégrées restent le signal à suivre', sector_proxy: 'Panier sans publication propre ; exposé aux résultats de ses grandes pondérations' },
  eventRisk: {},
  blastDoc: 2,
  scenarios: c => [
    { scenario: 'bullish', trigger: 'Le secteur prolonge sa hausse et le troisième trimestre dépasse la prévision relevée.', firstOrder: 'Le titre franchit son plus haut du 24 septembre et poursuit au-dessus.', secondOrder: 'CrowdStrike et le panier CIBR suivent ; la décote de SentinelOne se réduit.', confirmation: 'Une clôture au-dessus de ' + c.usd(c.lv('r1')) + ' avec CrowdStrike en hausse la même séance.', contradiction: 'Un nouveau plus haut pendant que CrowdStrike et le panier CIBR reculent.' },
    { scenario: 'mixed', trigger: 'Le secteur marque une pause sans nouvelle propre au titre.', firstOrder: 'Le titre reflue vers ses moyennes après un plus haut.', secondOrder: 'L’écart de performance avec CrowdStrike reste faible, sans information propre.', confirmation: 'Des clôtures entre ' + c.usd(c.lv('s1')) + ' et ' + c.usd(c.lv('r1')) + ' pendant plusieurs séances.', contradiction: 'Une sortie franche d’un côté ou de l’autre du couloir.' },
    { scenario: 'bearish', trigger: 'Le secteur recule, ou une plateforme casse les prix, ou la croissance déçoit.', firstOrder: 'Le titre revient vers la zone de cassure d’août, puis sous ' + c.usd(c.lv('s3')) + '.', secondOrder: 'Les éditeurs en perte reculent plus que les rentables ; la décote paraît méritée.', confirmation: 'Une clôture sous ' + c.usd(c.lv('s3')) + ' avec CrowdStrike en baisse.', contradiction: 'Un repli du secteur que SentinelOne ne suit pas.' }],
  contradictions: c => ['La société met en avant une rentabilité non-GAAP positive, mais reste en perte GAAP de plusieurs centaines de millions : la rémunération en actions sépare les deux mesures.', 'Une corrélation élevée avec CrowdStrike ne prouve aucun lien commercial : c’est un concurrent, pas un client, et le co-mouvement est sectoriel.'],
  missingData: c => ['Aucun client final ne dépasse 9 % de l’ARR et les partenaires de distribution ne sont pas nommés : aucun client coté n’entre dans les comparables comme client documenté.', 'Date du troisième trimestre non annoncée par l’émetteur.', 'Surface d’options relevée nulle, échéance à zéro jour ; sentiment non retenu ; Reddit et Google Trends indisponibles.', 'Fondamentaux, statistiques et corrélations relevés en instantané le 25 septembre, non reconstitués à la clôture de référence.'],
  limitations: ['Fondamentaux et statistiques du fournisseur relevés en instantané, non point-in-time.', 'Options non exploitables (surface nulle, échéance à zéro jour).', 'Court terme et cible de consensus décrits qualitativement ; aucun chiffre d’analyste écrit comme gouvernant.'],
});
