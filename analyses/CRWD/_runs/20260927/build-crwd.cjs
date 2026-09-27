'use strict';
// Dossier CrowdStrike (CRWD) v3 au close du 2026-09-25. Rafraîchit la v3 du 24 septembre (clôture de
// référence 2026-09-23) : même harnais de dépôts SEC et d'agrégats GAAP XBRL, niveaux et récit recalés
// sur la clôture certifiée du 25 septembre, après le repli depuis le record du 24. Calculs, provenance et
// preuves délégués au gabarit tools/lib/analysis-v3-r07.cjs (REF=2026-09-25). Agrégats GAAP lus dans les
// données XBRL officielles de la SEC (companyfacts, 10-Q du 31 juillet inclus) : douze mois glissants =
// exercice FY26 (10-K) + semestre FY27 (10-Q) − semestre FY26. Valorisation par les revenus : l'EBITDA
// GAAP est marginal à cette capitalisation ; c'est l'EV/revenus qui gouverne. Aucune dette de marché,
// aucun bon de souscription, aucun programme d'émission : la seule dilution est la rémunération en actions.
const R = require('../../../../tools/lib/analysis-v3-r07.cjs');
const GEN = 'analyses/CRWD/_runs/20260927/build-crwd.cjs';

R.build({
  ticker: 'CRWD', shortName: 'CrowdStrike', cik: 1535527, generator: GEN,
  xbrl: {
    ttm: {
      rev: ['RevenueFromContractWithCustomerIncludingAssessedTax'],
      ebit: ['OperatingIncomeLoss'],
      ni: ['NetIncomeLoss'],
      ocf: ['NetCashProvidedByUsedInOperatingActivities'],
      capex: ['PaymentsToAcquirePropertyPlantAndEquipment'],
    },
    instant: {
      cashEq: ['CashAndCashEquivalentsAtCarryingValue'],
      ltDebt: ['LongTermDebtNoncurrent'],
      leaseCur: ['OperatingLeaseLiabilityCurrent'],
      leaseNon: ['OperatingLeaseLiabilityNoncurrent'],
    },
    da: [], debt: ['ltDebt', 'leaseCur', 'leaseNon'], cash: ['cashEq'],
  },
  scenarioBasis: 'revenue', scenarioMultiple: 33,
  valuationBasis: 'GAAP douze mois au 2026-07-31 (XBRL SEC) : revenus = exercice clos le 31 janvier 2026 + semestre clos le 31 juillet 2026 − semestre clos le 31 juillet 2025. Capitalisation = clôture certifiée du 2026-09-25 × 1 023 934 842 actions. Valeur d’entreprise = capitalisation + dette (obligations senior et passifs de location au 31 juillet) − trésorerie (liquidités au 31 juillet). Valorisation par les revenus : l’EBITDA GAAP est marginal à cette capitalisation. Scénario : multiple d’EV/revenus ramené à 33×, environ 30 % sous le multiple actuel, trésorerie et dette du 31 juillet inchangées ; ce que coûterait une normalisation, pas un objectif.',
  levels: {
    trigger: { d: '2026-09-24', c: 2 },   // 263,87 : plus haut historique intraday du 24 septembre
    stop: { d: '2026-09-23', c: 3 },       // 248,51 : bas de la séance record du 23 septembre
    abandon: { d: '2026-09-21', c: 3 },    // 230,85 : bas du 21 septembre, seuil d’abandon du scénario
    r1: { d: '2026-09-24', c: 2 },         // 263,87 : résistance = record
    s1: { d: '2026-09-23', c: 3 },         // 248,51
    s2: { d: '2026-09-22', c: 3 },         // 244,70
    s3: { d: '2026-09-21', c: 3 },         // 230,85
    baseLow: { d: '2026-09-10', c: 3 },    // 204,27 : bas de la base de septembre
    baseHigh: { d: '2026-09-22', c: 2 },   // 250,80 : haut de la base avant la cassure
  },
  targets: ({ lv, entry }) => { const h = lv('baseHigh') - lv('baseLow'); return { tp1: entry + h / 2, tp2: entry + h }; },
  supports: ['s1', 's2', 's3'], resistances: ['r1'],
  levelsMethod: 'Niveaux lus sur les barres certifiées, par date. Déclencheur : clôture au-dessus du record du 24 septembre. Stop sous le bas de la séance record. Objectifs tirés du mouvement mesuré de la base de septembre, du bas du 10 au haut du 22, projeté depuis le déclencheur. R/R = gain / risque.',
  inventory: 17,
  reviewScope: 'Dépôts EDGAR de CrowdStrike du 1er février au 25 septembre 2026, formulaires de détention exclus. Dix-sept dépôts inventoriés ; six ouverts et hachés (8-K de résultats et son exhibit, 10-Q, S-3ASR de revente, 8-K de fractionnement, 8-K de rachat, 10-K annuel). Les documents de gouvernance (DEF 14A, 8-K items 5.02, 5.03 et 5.07), le S-8 et les 13G sont écartés comme non décisionnels pour la valorisation et la dilution. Aucun dépôt SEC décisionnel nouveau entre le 23 et le 25 septembre.',
  docs: [
    ['2026-08-26', '8-K / Exhibit 99.1', '0001535527-26-000029', 'crwd-20260826xex991.htm', 'q2fy27-ex991.htm',
      'Communiqué du deuxième trimestre de l’exercice 2027 : chiffre d’affaires de 1,47 Md$ (+26 %), ARR de 5,84 Md$ (+25 %), net new ARR record de 333 M$ (+51 %), flux libre record de 377 M$. Guidance annuelle relevée : 5,99 à 6,01 Md$ de revenus, ARR de 6,60 à 6,61 Md$ et 1,25 à 1,26 $ de bénéfice ajusté par action ; troisième trimestre attendu autour de 1,52 Md$.'],
    ['2026-08-27', '10-Q', '0001535527-26-000031', 'crwd-20260731.htm', 'q2fy27-10q.htm',
      'Rapport trimestriel : perte opérationnelle GAAP de 63,8 M$ sur le semestre, trésorerie de 5,01 Md$, obligations senior de 746 M$, 881 M$ d’acquisitions nettes au semestre, 4,14 Md$ d’engagements d’achat, 1 023 934 842 actions en circulation et accord de rachat des actifs de XM Cyber pour 145 M$ en numéraire et en actions ; contrôles de publication jugés efficaces.'],
    ['2026-09-11', 'S-3ASR', '0001104659-26-107123', 'tm2625079-1_s3asr.htm', 'sep11-s3asr.htm',
      'Enregistrement automatique de la revente d’au plus 2 118 022 actions par le vendeur des actifs de XM Cyber. La société n’émet rien et ne reçoit aucun produit : c’est une offre potentielle de titres existants sur le marché, pas une nouvelle dilution.'],
    ['2026-06-03', '8-K', '0001535527-26-000022', 'crwd-20260603.htm', 'jun03-8k.htm',
      'Annonce d’un fractionnement des actions à raison de quatre pour une, sous forme de dividende en actions, effectif après la clôture du 1er juillet 2026 : tous les montants par action sont ajustés depuis, y compris les barres de cours utilisées ici.'],
    ['2026-04-06', '8-K', '0001535527-26-000013', 'crwd-20260406.htm', 'apr06-8k.htm',
      'Autorisation de rachat d’actions portée à 1,5 Md$ par 500 M$ supplémentaires ; à cette date, 150,6 M$ avaient été rachetés, sans échéance ni obligation d’achat.'],
    ['2026-03-05', '10-K', '0001535527-26-000010', 'crwd-20260131.htm', 'fy26-10k.htm',
      'Rapport annuel de l’exercice clos le 31 janvier 2026 : chiffre d’affaires de 4,81 Md$, perte opérationnelle de 293 M$, flux opérationnel de 1,61 Md$ ; aucun client ni partenaire de distribution ne représente 10 % des revenus ; contrôle interne jugé efficace par l’auditeur.'],
  ],
  needles: {
    q2_results: [0, ['$333 million', '$5.84 billion', 'record free cash flow of $377', '$6,603.0', '$5,991.1', '$1,523.2']],
    balance: [1, ['1,023,934,842', '746,216', '5,013,847', '4,141,527']],
    cash_flow: [1, ['1,121,205', '222,037', '881,376']],
    income: [1, ['2,856,526', '63,832']],
    resale: [2, ['2,118,022']],
    split: [3, ['four-for-one stock split']],
    buyback: [4, ['$500 million', '$1.5 billion']],
    fy26: [5, ['4,812,005', '293,292', '1,612,349', '10% or more of the Company', 'maintained, in all material respects, effective internal control']],
    controls: [1, ['disclosure controls and procedures were effective']],
  },
  sectionDocs: { verdict: [0, 1], business: [0, 1], news: [0], earnings: [0], fundamentals: [0, 1], capitalStructure: [1, 2], filingsReview: [0, 1, 5], risks: [1, 0], globalScore: [0], meta: [0], disclaimer: [0], macro: [5], options: [0], social: [0], header: [0], shortInterest: [1], insiders: [1] },
  score: { business: 30, technical: 6, capital: 2, calendar: 0, dilution: -4, risk: 28 },
  peers: false,
  riskScoreReason: 'Jugement qualitatif sur dix : entreprise de très haute qualité — ARR en accélération, flux libre record, base de clients large et sans dépendance — mais valorisation extrême (EV proche de 47 fois les revenus GAAP), résultat opérationnel GAAP encore négatif, rémunération en actions massive, dirigeants et administrateurs vendeurs pendant la hausse et titre proche de son record après un doublement depuis mai. Le risque n’est pas le bilan, c’est le prix.',
  blastDoc: 1,
  eventDefault: {
    leader: 'Aucune publication dans les quatorze jours collectés ; ses annonces de plateforme donnent le ton concurrentiel',
    direct_peer: 'Aucune publication dans les quatorze jours collectés ; ses commentaires de demande valent pour le segment',
    upstream: 'Aucune publication dans les quatorze jours collectés ; ses tarifs d’hébergement pèsent sur la marge',
    second_order: 'Aucune publication dans les quatorze jours collectés ; ses offres intégrées et ses budgets restent le signal à suivre',
    sector_proxy: 'Panier sans publication propre ; exposé aux résultats de ses grandes pondérations',
  },
  eventRisk: {},
  groups: [
    { name: 'Leaders de la sécurité', order: 1, transmission: 'Ils fixent le prix et le périmètre des plateformes de sécurité ; leurs choix déplacent les budgets des entreprises.', rows: [
      ['PANW', 'leader', 'Premier éditeur de sécurité réseau et cloud', 'Concurrent frontal sur la consolidation des outils : ses résultats disent si les clients regroupent leurs achats chez un seul fournisseur ; corrélation la plus forte avec CrowdStrike parmi les grandes plateformes.'],
      ['MSFT', 'leader', 'Sécurité Defender intégrée à Windows et Azure', 'Sa sécurité vendue avec ses licences met la pression sur les prix, surtout chez les entreprises moyennes déjà clientes ; concurrent structurel plus qu’un pair de cours.']] },
    { name: 'Pairs directs : plateformes de sécurité', order: 1, transmission: 'Même budget de sécurité des entreprises, même cycle de renouvellement des contrats.', rows: [
      ['S', 'direct_peer', 'Concurrent direct sur la protection des postes', 'Le concurrent le plus proche sur l’endpoint ; sa politique de prix est le premier signal si la concurrence se durcit.'],
      ['ZS', 'direct_peer', 'Sécurité des accès réseau en nuage', 'Même clientèle de grandes entreprises ; ses gains signalent la santé de la sécurité en nuage.'],
      ['FTNT', 'direct_peer', 'Pare-feu et sécurité réseau', 'Cycle matériel différent, mêmes directions informatiques : un ralentissement chez lui peut précéder celui des budgets.'],
      ['OKTA', 'direct_peer', 'Gestion des identités', 'L’identité est le second front de Falcon ; sa croissance mesure la demande de sécurité des agents d’IA.'],
      ['NET', 'direct_peer', 'Réseau et sécurité en périphérie', 'Même argument de plateforme unique ; sa valorisation encadre celle des logiciels de sécurité en croissance.'],
      ['TENB', 'direct_peer', 'Gestion des vulnérabilités', 'Module concurrent de Falcon ; sa faiblesse relative mesure la pression de la consolidation.'],
      ['QLYS', 'direct_peer', 'Conformité et vulnérabilités en nuage', 'Acteur plus petit du même périmètre, rentable et margé ; sensible aux gains de parts des plateformes.'],
      ['RBRK', 'direct_peer', 'Sauvegarde et cyber-résilience', 'Même budget de résilience après incident ; très réactif en séance aux publications du secteur.'],
      ['VRNS', 'direct_peer', 'Sécurité et gouvernance des données', 'Transition vers le nuage comparable ; même acheteur de sécurité, autre angle sur la donnée.']] },
    { name: 'Amont : hébergement cloud', order: 1, transmission: 'Falcon tourne sur les grands clouds ; leurs prix fixent une partie du coût de revient de la plateforme.', rows: [
      ['AMZN', 'upstream', 'Hébergeur principal de la plateforme', 'Une partie des 4,14 Md$ d’engagements d’achat porte sur l’hébergement ; ses tarifs pèsent sur la marge brute, et ses outils natifs concurrencent la sécurité du cloud.']] },
    { name: 'Partenaires documentés et second ordre', order: 2, transmission: 'Alliances nommées par CrowdStrike et éditeurs voisins dont les budgets informatiques croisent les siens.', rows: [
      ['SNOW', 'second_order', 'Plateforme de données, partenaire nommé', 'Alliance annoncée pour porter la sécurité native de l’IA sur les données d’entreprise ; partage l’argument de la donnée comme avantage et les mêmes révisions de multiples.'],
      ['CTSH', 'second_order', 'Services numériques, partenaire nommé', 'Alliance annoncée pour sécuriser l’IA de bout en bout chez les grands comptes ; canal d’intégration, pas un pair de cours.'],
      ['DDOG', 'second_order', 'Supervision des infrastructures cloud', 'Autre bénéficiaire des migrations cloud ; son rythme mesure la croissance des charges hébergées à sécuriser.'],
      ['NOW', 'second_order', 'Plateforme de flux de travail d’entreprise', 'Même client, la direction informatique ; ses commentaires sur les budgets valent pour la sécurité.'],
      ['CRM', 'second_order', 'Logiciel d’entreprise et données clients', 'Même budget logiciel des grandes entreprises ; référence de la tolérance du marché aux multiples de croissance.']] },
    { name: 'Contrôles sectoriels', order: 2, transmission: 'Paniers de référence pour séparer le mouvement du titre de celui de son secteur.', rows: [
      ['CIBR', 'sector_proxy', 'Panier de cybersécurité pondéré', 'Un écart de performance avec ce panier isole ce qui est propre à CrowdStrike.'],
      ['IGV', 'sector_proxy', 'Panier de logiciels américains', 'Contrôle large du logiciel : un mouvement commun n’a rien de spécifique à la sécurité.'],
      ['QQQ', 'sector_proxy', 'Panier des grandes valeurs du Nasdaq', 'Contrôle du marché : sépare le bêta de marché du mouvement propre au secteur et au titre.']] },
  ],
  scenarios: c => [
    { scenario: 'bullish', trigger: 'La croissance de l’ARR continue d’accélérer et Falcon Flex étend sa base de clients.', firstOrder: 'Le titre reprend le record du 24 septembre à ' + c.usd(c.lv('r1')) + ' et sort par le haut.', secondOrder: 'Les pairs directs profitent de la demande générale de sécurité liée à l’IA.', confirmation: 'Une clôture au-dessus de ' + c.usd(c.lv('r1')) + ' sur volume soutenu, avec le panier CIBR en hausse.', contradiction: 'Un nouveau record pendant que les dirigeants vendent davantage et que le panier CIBR recule.' },
    { scenario: 'mixed', trigger: 'Les résultats restent bons mais la hausse des taux comprime les multiples des logiciels.', firstOrder: 'Le titre consolide entre sa moyenne à vingt séances et le record, autour du cours actuel.', secondOrder: 'Les logiciels de croissance reculent plus que la sécurité.', confirmation: 'Des clôtures entre ' + c.usd(c.lv('s2')) + ' et ' + c.usd(c.lv('r1')) + ' sans casser le bas du 21 septembre.', contradiction: 'Une détente des taux longs qui relancerait le logiciel et casserait le record.' },
    { scenario: 'bearish', trigger: 'Un concurrent casse les prix, la guidance d’ARR déçoit, ou les taux montent encore.', firstOrder: 'Le titre casse ' + c.usd(c.lv('abandon')) + ' et le multiple se comprime depuis un niveau extrême.', secondOrder: 'Toute la cybersécurité décroche, les plus petits pairs davantage.', confirmation: 'Une clôture sous ' + c.usd(c.lv('abandon')) + ' avec un recul du panier de cybersécurité.', contradiction: 'Une nouvelle hausse de la guidance malgré la concurrence.' },
  ],
  contradictions: c => [
    'Les résultats sont records mais les dirigeants et administrateurs ont vendu environ 129 M$ d’actions pendant la hausse, sans aucun achat : les deux signaux ne vont pas dans le même sens.',
    'Sur vingt et une séances, environ ' + c.fr(c.M.CIBR.beta * c.M.CIBR.return21d, 0) + ' des ' + c.fr(c.ret(21), 0) + ' points de hausse s’expliquent par le panier CIBR et son bêta : le titre bouge avec son secteur autant que sur ses propres chiffres.',
  ],
  missingData: c => [
    'Chaîne d’options relevée marché fermé, inexploitable ; sentiment social et tendances de recherche indisponibles à la collecte (aucune donnée Reddit ni Google Trends).',
    'Couverture officielle des formulaires 4 partielle et arrêtée à la collecte du 24 septembre : aucun solde net ni plan de cession programmé affirmé.',
    'Fondamentaux, statistiques et corrélations relevés en instantané le 25 septembre, non reconstitués à la clôture de référence ; fenêtre des comparables ouverte au 2 février 2026 par contrainte de profondeur de la source.',
  ],
  limitations: [
    'Fondamentaux et statistiques du fournisseur relevés en instantané, non point-in-time.',
    'Options non exploitables (chaîne relevée marché fermé).',
    'Transactions d’initiés arrêtées à la collecte du 24 septembre 2026 ; couverture officielle partielle.',
    'EBITDA non retenu comme lentille de valorisation : marginal à cette capitalisation ; l’EV/revenus gouverne.',
    'Fenêtre des comparables du 2 février au 25 septembre 2026, bornée par la profondeur servie de la source, non une année pleine.',
  ],
  compose: c => {
    const { fr, usd, pct, sgn, dfr, close, prev, bars, N, tech, st, M, adv, ret, G$, marketCap, ev, scn, lv, entry, stop, tp1, tp2, cap, rr1, rr2, riskAtr, sizeExample, ref, market, raw, docs } = c;
    const bar = d => bars.find(b => b[0] === d);
    const dol = n => '$' + n.toFixed(2);
    const cmp = raw.comparison_bars.data.items[0].results[0].data;
    const dr = (sym, d) => { const b = cmp.find(x => x.symbol === sym).bars, i = b.findIndex(x => x[0] === d); return pct(b[i][4], b[i - 1][4]); };
    const r21 = ret(21), cibr21 = M.CIBR.return21d, betaCibr = M.CIBR.beta, sector21 = betaCibr * cibr21, own21 = r21 - sector21;
    const extension = pct(close, tech.ema20), r3m = ret(63);
    const b0826 = bar('2026-08-26'), b0827 = bar('2026-08-27'), c3m = bars[N - 63][4];
    const gapOpen = pct(b0827[1], b0826[4]), gapClose = pct(b0827[4], b0826[4]), igv0827 = dr('IGV', '2026-08-27');
    const evRev = ev / G$.rev, evFcf = ev / G$.fcf, peFwd = close / 1.255, preClose = b0826[4], preGap = pct(preClose, close);
    const record = lv('r1');
    return {
      meta: { lang: 'fr', dir: 'ltr', level: 'intermediate', tags: ['us', 'equities', 'ai-chain', 'software', 'technology'], grade: 'B', date: '2026-09-27', dateDisplay: '27 septembre 2026', version: 3, status: 'watch', assetType: 'stock', levelsCloseDate: c.REF,
        description: 'CrowdStrike : le meilleur trimestre de son histoire, un cours retombé sous son record, des dirigeants qui ont vendu pendant la hausse. Dossier au close du 25 septembre 2026, statut surveiller.',
        ogDescription: 'CrowdStrike : ARR en accélération, valorisation extrême, titre replié depuis le record ; niveaux à surveiller sans poursuivre.',
        lastMcpRefresh: raw.status.captured_at, levelsVerifiedAt: raw.status.captured_at,
        statusHistory: [...(c.archive.meta.statusHistory || []), { at: raw.status.captured_at, from: 'watch', to: 'watch', note: 'rafraîchissement v3 du 27 septembre : clôture de référence du 2026-09-25, repli depuis le record du 24, scénario de surveillance maintenu', close }] },
      header: { ticker: 'CRWD', name: 'CrowdStrike Holdings, Inc.', exchange: 'NASDAQ', sector: 'Cybersécurité en nuage', price: close, changePct: pct(close, prev),
        badges: [{ text: 'SURVEILLER — NE PAS POURSUIVRE LA HAUSSE', color: 'blue' }, { text: 'Chaîne IA — sécurité', color: 'purple' }],
        metrics: { marketCap: fr(marketCap / 1e9, 1) + ' Md$', volume: fr(bars[N][5] / 1e6, 1) + ' M', evRevenue: fr(evRev, 1) + '×' }, halalStatus: 'unknown' },
      verdict: { score: 62, conviction: 'Moderate', bias: 'Neutral',
        confidence: 'Score éditorial non prédictif. Les chiffres d’entreprise viennent des dépôts SEC du trimestre et des données XBRL officielles ; les niveaux, du close certifié du 25 septembre.',
        summary: 'CrowdStrike a publié le meilleur trimestre de son histoire et le titre a pris ' + fr(r21, 1) + ' % en vingt et une séances, jusqu’à un record de ' + usd(record) + ' le 24 septembre, avant de refluer à ' + usd(close) + ' le 25. Une partie de ce mouvement n’a rien de propre au titre : sur la même fenêtre, le panier de cybersécurité CIBR a gagné ' + fr(cibr21, 1) + ' %, et avec un bêta de ' + fr(betaCibr, 2) + ' environ ' + fr(sector21, 0) + ' points s’expliquent par le secteur ; il reste ' + fr(own21, 0) + ' points propres à CrowdStrike. Le métier justifie l’enthousiasme : les nouveaux revenus récurrents accélèrent à 51 %, le flux de trésorerie libre bat un record et la direction relève sa prévision annuelle. Le prix, lui, suppose que tout se passe bien : la valeur d’entreprise vaut ' + fr(evRev, 0) + ' fois le chiffre d’affaires des douze derniers mois, et le résultat opérationnel GAAP reste négatif. Dirigeants et administrateurs ont vendu environ 129 M$ pendant la hausse, le fondateur en tête. Pas d’entrée au cours actuel : le signal utile serait une clôture au-dessus du record ; une clôture sous le bas du 21 septembre ferait abandonner le scénario.',
        whyBuy: [
          'Le net new ARR atteint un record de 333 M$, en hausse de 51 % : la croissance accélère au lieu de ralentir.',
          'La guidance annuelle est relevée à 5,99–6,01 Md$ de revenus et à un ARR de 6,60–6,61 Md$ en fin d’exercice.',
          'Le flux de trésorerie libre du trimestre, 377 M$, est un record : le modèle finance sa croissance sans lever de capital.',
          'Aucun client ni partenaire ne pèse 10 % du chiffre d’affaires : la demande est répartie sur une large base d’entreprises.'],
        whyAvoid: [
          'Au close du 25 septembre, la valeur d’entreprise représente ' + fr(evRev, 1) + ' fois les revenus GAAP des douze mois clos le 31 juillet, et ' + fr(evFcf, 0) + ' fois le flux libre : le prix anticipe plusieurs années de croissance parfaite.',
          'Le résultat opérationnel GAAP du semestre reste négatif, à −63,8 M$ : le bénéfice ajusté exclut une rémunération en actions de 674,6 M$ sur six mois.',
          'Le titre clôture ' + fr(extension, 1) + ' % au-dessus de sa moyenne à vingt séances, encore proche de son record : la marge de sécurité à l’achat est faible.',
          'Dirigeants et administrateurs ont vendu environ 129 M$ d’actions dans la fenêtre relevée, sans aucun achat : l’intérieur allège pendant que le marché achète.'],
        controlChecklist: [
          { label: 'Historique de cours', status: 'pass', statusLabel: 'Trois cents séances ajustées', evidence: 'Série certifiée au close du 25 septembre, fractionnement de quatre pour une intégré.', action: 'Niveaux et indicateurs recalculés sur cette seule série.' },
          { label: 'Extension', status: 'warn', statusLabel: 'Proche du record', evidence: 'Titre à ' + fr(extension, 1) + ' % de sa moyenne à vingt séances, sous son record du 24 septembre.', action: 'Ne pas poursuivre ; attendre le déclencheur de clôture.' },
          { label: 'Calendrier', status: 'warn', statusLabel: 'Prochains résultats non confirmés', evidence: 'Aucune date publiée par CrowdStrike. Les résultats du secteur logiciel et semi-conducteurs de fin septembre peuvent provoquer un gap, dates non confirmées ici par les émetteurs.', action: 'Compter avec un gap possible sur le logiciel et la sécurité.' }] },
      business: { theme: 'Plateforme de cybersécurité en nuage pour les entreprises',
        overview: '<p>CrowdStrike vend une plateforme de sécurité par abonnement, Falcon : protection des postes, des identités, du cloud et des données, pilotée depuis une seule console. Au trimestre clos le 31 juillet 2026, les abonnements ont pesé 1,40 Md$ sur 1,47 Md$ de revenus, en hausse de 27 %.</p><p>L’indicateur qui compte est l’ARR, le revenu récurrent annualisé : 5,84 Md$, en hausse de 25 %. Surtout, le net new ARR, ce qui s’ajoute chaque trimestre, a accéléré à 333 M$, en hausse de 51 %. La formule d’achat groupée Falcon Flex dépasse 2,29 Md$ d’ARR. L’argument de la direction est simple : chaque entreprise qui déploie des agents d’IA ouvre de nouvelles portes à sécuriser.</p><p>Deux ombres au tableau, l’une comptable, l’autre boursière. Le résultat opérationnel GAAP reste négatif parce que la rémunération en actions, 674,6 M$ sur le semestre, est une charge réelle que le bénéfice ajusté exclut. La société a dépensé 881 M$ en acquisitions au semestre et s’est engagée sur 4,14 Md$ d’achats, surtout d’hébergement cloud. Et le cours a pris ' + fr(r3m, 0) + ' % en trois mois (' + usd(c3m) + ' fin juin, ' + usd(close) + ' le 25 septembre) ; il a doublé depuis début mai : le marché ne paie plus seulement la croissance, il paie son accélération.</p>',
        moat: 'L’avantage tient à la plateforme unique et à la donnée : plus Falcon surveille de postes, plus sa détection s’améliore, et une entreprise qui a consolidé ses outils chez CrowdStrike change rarement de fournisseur. La concurrence de Microsoft, qui intègre sa sécurité à ses licences, et de Palo Alto Networks reste frontale sur les mêmes budgets.',
        segments: [
          { name: 'Abonnements', revenue: '1,40 Md$ au trimestre', pct: '95 %', description: 'En hausse de 27 % sur un an ; marge brute ajustée de 81 %.' },
          { name: 'Services professionnels', revenue: '0,07 Md$ au trimestre', pct: '5 %', description: 'Réponse aux incidents et accompagnement.' }],
        sourceRefs: [ref(0), ref(1)],
        coverageMatrix: [
          { facet: 'Cours et historique', status: 'COUVERT', decision: 'Trois cents séances ajustées du fractionnement, close certifié ; base des niveaux.' },
          { facet: 'Résultats et guidance', status: 'COUVERT — PRIMAIRE', decision: 'Communiqué du 26 août et 10-Q ; prochaine date non confirmée.' },
          { facet: 'Agrégats GAAP', status: 'COUVERT — XBRL', decision: 'Douze mois glissants au 31 juillet 2026, reconstitués depuis les données XBRL officielles.' },
          { facet: 'Capital et dilution', status: 'COUVERT — PRIMAIRE', decision: 'Revente enregistrée de titres existants, rachats et fractionnement séparés.' },
          { facet: 'Comparables et transmission', status: 'COUVERT — LOCAL', decision: 'Corrélations recalculées sur barres certifiées depuis le 2 février.' },
          { facet: 'Initiés', status: 'PARTIEL', decision: 'Ventes relevées à la collecte du 24 septembre, couverture officielle incomplète : aucun solde net affirmé.' },
          { facet: 'Options', status: 'NON EXPLOITABLE', decision: 'Chaîne relevée marché fermé.' },
          { facet: 'Sentiment et tendances de recherche', status: 'INDISPONIBLE', decision: 'Aucune mesure qualifiée ; non utilisé.' }] },
      news: [
        { date: '2026-08-26', title: 'Deuxième trimestre record : net new ARR de 333 M$', impact: 'positive', detail: 'Le lendemain, le titre ouvre à ' + sgn(gapOpen, 1) + ' et clôture à ' + sgn(gapClose, 1) + ' ; le même jour, le panier logiciel IGV prend ' + sgn(igv0827, 1) + ', la hausse n’est donc pas propre à la sécurité.', source: 'CrowdStrike — SEC', sourceUrl: docs[0].url },
        { date: '2026-09-11', title: 'Revente enregistrée de 2,1 millions d’actions', impact: 'neutral', detail: 'Le vendeur des actifs de XM Cyber pourra céder ses titres sur le marché ; cela ajoute une offre ponctuelle, sans nouvelle émission par la société.', source: 'CrowdStrike — SEC', sourceUrl: docs[2].url },
        { date: '2026-09-24', title: 'Record à ' + usd(record) + ', puis repli', impact: 'neutral', detail: 'Le titre inscrit un plus haut historique à ' + usd(record) + ' le 24 septembre, puis reflue à ' + usd(close) + ' le 25 (' + sgn(pct(close, prev), 1) + ' sur la séance) : la hausse marque une pause à un niveau extrême.', source: 'Barres certifiées', sourceUrl: c.evidenceUrl },
        { date: '2026-06-03', title: 'Fractionnement des actions à quatre pour une', impact: 'neutral', detail: 'L’opération ne change pas la valeur de l’entreprise mais divise le prix par quatre : tout niveau antérieur à juillet doit être lu en base ajustée.', source: 'CrowdStrike — SEC', sourceUrl: docs[3].url }],
      fundamentals: { rows: [
          { metric: 'Chiffre d’affaires du trimestre', value: '1,47 Md$', signal: '+26 % sur un an, communiqué du 26 août', signalColor: 'green', _src: 0 },
          { metric: 'ARR en fin de trimestre', value: '5,84 Md$', signal: '+25 % sur un an', signalColor: 'green', _src: 0 },
          { metric: 'Net new ARR du trimestre', value: '333 M$', signal: '+51 % sur un an, record', signalColor: 'green', _src: 0 },
          { metric: 'Guidance de revenus de l’exercice', value: '5,99–6,01 Md$', signal: 'Relevée le 26 août', signalColor: 'blue', _src: 0 },
          { metric: 'Résultat opérationnel GAAP du semestre', value: '−63,8 M$', signal: 'Six mois clos le 31 juillet, 10-Q', signalColor: 'red', _src: 1 },
          { metric: 'Rémunération en actions du semestre', value: '674,6 M$', signal: 'Exclue du bénéfice ajusté, 10-Q', signalColor: 'amber', _src: 1 },
          { metric: 'Revenus GAAP sur douze mois', value: fr(G$.rev / 1e9, 2) + ' Md$', signal: 'Douze mois glissants au 31 juillet 2026 (XBRL SEC : 10-K + 10-Q)', signalColor: 'blue', _src: 'gaap' },
          { metric: 'Résultat opérationnel GAAP sur douze mois', value: fr(G$.ebit / 1e6, 0) + ' M$', signal: 'Négatif : le bénéfice ajusté exclut la rémunération en actions', signalColor: 'red', _src: 'gaap' },
          { metric: 'Résultat net GAAP sur douze mois', value: fr(G$.ni / 1e6, 0) + ' M$', signal: 'Douze mois glissants au 31 juillet 2026', signalColor: 'amber', _src: 'gaap' },
          { metric: 'Flux de trésorerie libre sur douze mois', value: fr(G$.fcf / 1e9, 2) + ' Md$', signal: 'Flux opérationnel − investissements, douze mois au 31 juillet 2026', signalColor: 'green', _src: 'gaap' },
          { metric: 'Trésorerie au 31 juillet', value: fr(G$.cash / 1e9, 2) + ' Md$', signal: 'Liquidités au bilan du 10-Q', signalColor: 'green', _src: 'gaap', _also: [1] },
          { metric: 'Dette au 31 juillet (obligations + loyers)', value: fr(G$.debt / 1e9, 2) + ' Md$', signal: 'Obligations senior et passifs de location, bilan du 10-Q', signalColor: 'blue', _src: 'gaap' },
          { metric: 'EV/revenus GAAP', value: fr(evRev, 1) + '×', signal: 'Valeur d’entreprise au close du 2026-09-25 sur revenus GAAP douze mois au 2026-07-31', signalColor: 'red', source: 'Clôture certifiée et XBRL SEC', comparison: 'Versus une croissance de 26 % : le multiple suppose plusieurs années de croissance au-dessus de 20 %.', _src: 'market' },
          { metric: 'EV/flux de trésorerie libre', value: fr(evFcf, 0) + '×', signal: 'Valeur d’entreprise au close du 2026-09-25 sur flux libre douze mois au 2026-07-31', signalColor: 'red', source: 'Clôture certifiée et XBRL SEC', comparison: 'Versus le scénario ci-dessous : même un flux libre en forte hausse laisse le multiple élevé.', _src: 'market' },
          { metric: 'P/E forward sur guidance non-GAAP', value: fr(peFwd, 0) + '×', signal: 'Close du 2026-09-25 sur bénéfice ajusté non-GAAP de 1,25–1,26 $ guidé pour l’exercice 2027', signalColor: 'red', source: 'Clôture certifiée et communiqué du 26 août', comparison: 'Versus le P/E GAAP, à peine positif : le bénéfice ajusté exclut la rémunération en actions.', _src: 'market' },
          { metric: 'Scénario : EV/revenus ramené à 33× (hypothèse éditoriale)', value: fr(scn.price, 2) + ' $ par action', signal: 'Scénario : multiple d’EV/revenus ramené de ' + fr(evRev, 0) + '× à 33× par hypothèse, trésorerie et dette du 2026-07-31 inchangées, soit ' + fr(scn.downside_pct, 0) + ' % sous le close du 2026-09-25', signalColor: 'red', source: 'Clôture certifiée et XBRL SEC', comparison: 'Versus le close : pour repère, la clôture d’avant publication, ' + usd(preClose) + ' le 26 août, se situe ' + fr(preGap, 0) + ' % sous le cours ; ce n’est pas un objectif.', _src: 'market' }],
        sourceRefs: [ref(0), ref(1), market('fondamentaux et statistiques')] },
      earnings: { quarters: [],
        beatNote: 'Deuxième trimestre de l’exercice 2027 (clos le 31 juillet 2026) : bénéfice ajusté de 0,31 $ par action, en base après fractionnement, et bénéfice GAAP légèrement positif. La guidance du troisième trimestre vise environ 1,52 Md$ de revenus et 0,31 $ de bénéfice ajusté ; celle de l’exercice, relevée, vise 5,99 à 6,01 Md$ de revenus, un ARR de 6,60 à 6,61 Md$ et 1,25 à 1,26 $ par action. L’écart entre ajusté et GAAP tient surtout à la rémunération en actions. Aucune date de prochaine publication n’est confirmée par l’émetteur à ce jour.',
        nextEarnings: 'Date non confirmée par l’émetteur ; aucune publication dans les quatorze jours du calendrier collecté.',
        sourceRefs: [ref(0)] },
      capitalStructure: { sharesOutstanding: '1 023 934 842 actions au 20 août 2026, après fractionnement (page de garde du 10-Q)',
        sharesAuthorized: 'Deux milliards d’actions de classe A autorisées, en base après fractionnement, selon le bilan du 10-Q.',
        dilutionRisk: 'moderate',
        shareHistory: 'Le fractionnement de quatre pour une du 1er juillet 2026 a quadruplé le nombre d’actions sans rien changer à la valeur : environ 1,024 milliard d’actions au 20 août. La dilution réelle vient de la rémunération en actions, 674,6 M$ sur le semestre, et des acquisitions payées en partie en titres ; les rachats, 1,5 Md$ autorisés, n’en compensent qu’une partie. La revente enregistrée de 2 118 022 actions par le vendeur de XM Cyber ajoute une offre, pas une émission. Il n’existe ni obligation convertible, ni bon de souscription, ni programme d’émission d’actions sur le marché dans la période examinée : la seule dilution est régulière et prévisible. Un nombre d’actions entièrement dilué à date n’est pas calculable depuis ces seuls dépôts.',
        warrants: [],
        atm: { active: false, authorized: 'Aucun programme d’émission d’actions relevé', used: 'Sans objet', remaining: 'Sans objet' },
        sourceRefs: [ref(1), ref(2), ref(3), ref(4)] },
      filingsReview: { summary: 'Six dépôts décisionnels ouverts et hachés, sur dix-sept inventoriés. L’auditeur conclut dans le 10-K que la société « maintained, in all material respects, effective internal control », et le 10-Q juge les contrôles de publication efficaces. Ils séparent l’excellence opérationnelle du trimestre, la structure du capital, qui ne se dilue que par la rémunération en actions et les acquisitions, et une offre de titres existants à venir sur le marché. Aucun dépôt décisionnel nouveau entre le 23 et le 25 septembre.',
        filings: docs.map(d => ({ date: d.date, form: d.form, accession: d.accession, finding: d.finding, url: d.url })),
        contrarianRisks: [
          'Le bénéfice ajusté exclut une rémunération en actions supérieure au flux libre semestriel : l’actionnaire paie cette charge par la dilution.',
          'Le cours a doublé depuis début mai : une publication simplement conforme pourrait décevoir un marché qui attend une nouvelle accélération.',
          'Dirigeants et administrateurs vendent pendant la hausse ; ce n’est pas un signal négatif en soi, mais personne à l’intérieur n’achète.',
          'Microsoft intègre la sécurité dans ses offres existantes : sur les petites et moyennes entreprises, le prix peut l’emporter sur la qualité.',
          'Les 881 M$ d’acquisitions du semestre et les engagements d’hébergement de 4,14 Md$ pèseront sur la marge si la croissance ralentit.'] },
      technicals: { rsi14: +tech.rsi14.toFixed(2), macd: +tech.macd.toFixed(2), macdSignal: +tech.macdSignal.toFixed(2), ema20: +tech.ema20.toFixed(2), ema50: +tech.ema50.toFixed(2), ema200: +tech.ema200.toFixed(2),
        ma50Type: 'EMA', ma200Type: 'EMA', ma50Available: true, ma200Available: true, atr14: +tech.atr14.toFixed(2),
        badges: ['Record historique le 24 septembre', 'Replié sous le record', 'Ne pas poursuivre'],
        supports: [lv('s1'), lv('s2'), lv('s3')], resistances: [lv('r1')],
        setupNote: 'Le titre clôture à ' + usd(close) + ', sous son record de ' + usd(record) + ' et ' + fr(extension, 1) + ' % au-dessus de sa moyenne à vingt séances (' + usd(tech.ema20) + '), RSI à ' + fr(tech.rsi14, 0) + '. Avant activation, aucune entrée ; une clôture sous ' + usd(lv('abandon')) + ', le bas du 21 septembre, abandonne le scénario. Activation sur une clôture au-dessus de ' + dol(entry) + ', le record du 24 septembre. Après activation, stop sous ' + dol(stop) + ', le bas de la séance record du 23. Supports : ' + usd(lv('s1')) + ', ' + usd(lv('s2')) + ' et ' + usd(lv('s3')) + '.',
        wyckoff: 'Non utilisé : le profil de volume n’est pas exploité dans ce dossier.',
        sourceRefs: [market('barres quotidiennes et indicateurs recalculés')] },
      options: { callOI: 'Non exploitable', putOI: 'Non exploitable', cpRatio: 'Non exploitable', maxPain: 'Non exploitable', ivMean: 'Non exploitable', skew: 'Chaîne relevée marché fermé', unusual: 'Aucune activité inhabituelle qualifiée', sourceRefs: [market('options')] },
      shortInterest: { siPct: fr(st.shortPercentOfFloat * 100, 2) + ' % du flottant', daysToCover: fr(st.shortRatio, 2) + ' jours, date de règlement non précisée par le snapshot', ctb: 'Coût d’emprunt bas, sans tension', trend: 'Positions vendeuses faibles ; aucune thèse de rachat forcé des vendeurs.', squeezeScore: 'Non pertinent', sourceRefs: [market('positions vendeuses')] },
      insiders: { signal: 'Ventes de marché uniquement dans la fenêtre relevée, depuis le 27 août, aucun achat. George Kurtz, fondateur et directeur général, a vendu environ 244 515 actions pour environ 55,8 M$ ; le président Michael Sentonas, le directeur financier Burt Podbere, la directrice comptable et plusieurs administrateurs (Watzinger, Austin, Davis, Gandhi) ont aussi vendu. Le total relevé, dirigeants et administrateurs compris, atteint environ 129 M$. Couverture officielle partielle, arrêtée à la collecte du 24 septembre : aucun solde net publié, et aucun plan de cession programmé n’est affirmé faute de mention relevée.',
        recentTransactions: [],
        sourceRefs: [market('formulaires 4')] },
      macro: { indicators: [{ name: 'Clôture de référence', value: c.REF, signal: usd(close) + ', séance complète' }, { name: 'Rendement cinq séances', value: sgn(ret(5)), signal: 'Descriptif' }, { name: 'Rendement vingt et une séances', value: sgn(ret(21)), signal: 'Descriptif' }],
        regime: 'neutral', impact: 'Un logiciel valorisé à ' + fr(evRev, 0) + ' fois ses revenus est très sensible aux taux longs et à la prime de risque des actions de croissance. La cybersécurité résiste mieux que le logiciel en général, portée par des budgets peu cycliques, mais le multiple n’est pas immunisé : une remontée des taux comprime d’abord les valorisations les plus élevées.' },
      risks: { riskScore: 6, riskProfile: 'High',
        riskSummary: 'L’entreprise tient ses promesses ; le cours, lui, en demande davantage. Le marché paie l’accélération de la croissance : il faut qu’elle continue trimestre après trimestre. Une publication simplement bonne, une hausse des taux ou une vente plus lourde des dirigeants suffisent à faire reculer un titre qui a doublé depuis mai et vient de refluer depuis son record.',
        riskCards: [
          { title: 'Valorisation et attentes', severity: 'high', icon: 'fa-scale-balanced', points: ['Valeur d’entreprise de ' + fr(evRev, 0) + ' fois les revenus.', 'P/E forward sur bénéfice ajusté proche de deux cents fois.'], verdict: 'Le moindre ralentissement de l’ARR se paierait par une compression brutale du multiple.' },
          { title: 'Extension technique', severity: 'high', icon: 'fa-rocket', points: ['Titre proche de son record, au-dessus de sa moyenne à vingt séances.', 'Ouverture à ' + sgn(gapOpen, 0) + ' puis clôture à ' + sgn(gapClose, 0) + ' le lendemain des résultats.'], verdict: 'Acheter maintenant, c’est accepter un retour possible vers la moyenne avant toute poursuite.' },
          { title: 'Ventes des dirigeants et administrateurs', severity: 'medium', icon: 'fa-user-tie', points: ['Ventes du fondateur, du président, du directeur financier et de plusieurs administrateurs, environ 129 M$.', 'Aucun achat d’initié.'], verdict: 'Pas un signal de fraude, mais une offre régulière de titres pendant la hausse.' },
          { title: 'Rémunération en actions', severity: 'medium', icon: 'fa-money-bill-trend-up', points: ['674,6 M$ sur le semestre, exclus du bénéfice ajusté.', 'Rachats autorisés de 1,5 Md$ au total.'], verdict: 'La dilution est lente mais continue ; le bénéfice ajusté la masque.' }],
        pedagogy: 'Le 27 août, le titre a ouvert à ' + sgn(gapOpen, 0) + ' et clôturé à ' + sgn(gapClose, 0) + ' le lendemain des résultats. Le vrai danger d’un titre pareil n’est pas le slippage — quelques cents sur un titre qui échange ' + fr(adv / 1e9, 1) + ' Md$ par jour — mais le gap : un gap peut faire sortir sous le stop de ' + usd(stop) + ', et la perte dépasse alors le risque prévu. La taille découle de la distance au stop : ' + sizeExample + ' actions pour 100 $ de perte acceptée. Rien à acheter tant que la clôture de déclenchement au-dessus de ' + usd(record) + ' n’est pas là.' },
      tradeIdea: { status: 'watch',
        statusNote: 'Surveiller. Avant activation : aucune entrée ; une clôture sous ' + usd(lv('abandon')) + ' abandonne le scénario. Activation : clôture au-dessus de ' + usd(record) + ', le record du 24 septembre, puis achat à l’ouverture suivante seulement sous ' + usd(cap) + '. Après activation : stop sous ' + usd(stop) + '.',
        entry, stop, tp1, tp2,
        stopPct: pct(stop, entry).toFixed(1) + '%', tp1Pct: '+' + pct(tp1, entry).toFixed(1) + '%', tp2Pct: '+' + pct(tp2, entry).toFixed(1) + '%',
        rr: '1:' + rr1.toFixed(2) + ' TP1 / 1:' + rr2.toFixed(2) + ' TP2',
        entryNote: 'Déclencheur sur clôture au-dessus du record du 24 septembre (' + usd(record) + '), pas sur un franchissement en séance. Entrée à l’ouverture suivante uniquement sous ' + usd(cap) + ' : au-delà, le R/R vers TP1 tomberait sous 1,5 avec le même stop. Le titre a refermé à ' + usd(close) + ' le 25 septembre, sous le déclencheur : le plan est en surveillance, non actif. Objectifs tirés du mouvement mesuré de la base de septembre, du bas du 10 au haut du 22 : TP1 à la moitié de sa hauteur au-dessus du déclencheur, TP2 à sa hauteur entière. Liquidité : environ ' + fr(adv / 1e9, 1) + ' Md$ échangés par séance, médiane des vingt dernières. Exemple de taille, non personnalisé : 100 $ de perte maximale divisés par le risque par action, soit ' + sizeExample + ' actions.',
        horizon: 'Dix séances après activation',
        thesis: 'Le marché paie l’accélération de CrowdStrike : la question n’est plus la qualité, c’est le point d’entrée. Le titre a fait un record le 24 septembre puis reflué à ' + usd(close) + ' : avant activation, le dossier reste en surveillance et une clôture sous ' + usd(lv('abandon')) + ' l’abandonne. Une clôture au-dessus de ' + dol(entry) + ' confirmerait que les acheteurs absorbent les ventes des dirigeants ; l’entrée n’a lieu qu’à l’ouverture suivante et sous ' + usd(cap) + '. Après activation, le stop sous ' + dol(stop) + ' limite le risque. TP1 à ' + usd(tp1) + ' et TP2 à ' + usd(tp2) + ' prolongent la base de septembre. Titre étendu, taille limitée à l’exemple chiffré : ne pas anticiper le déclencheur.',
        catalysts: [
          'Une clôture au-dessus du record du 24 septembre, sur volume au moins égal à la médiane récente.',
          'L’absence de nouvelle vente importante des dirigeants et administrateurs dans les formulaires 4.',
          'Les résultats du secteur logiciel et semi-conducteurs de fin septembre : un risque de gap sur tout le logiciel.',
          'Toute annonce de nouveaux clients Falcon Flex ou de révision de la guidance avant la prochaine publication, dont la date n’est pas confirmée.'],
        invalidation: [
          'Avant activation : une clôture sous ' + usd(lv('abandon')) + ', bas du 21 septembre, abandonne le scénario.',
          'Après activation : une clôture sous ' + usd(stop) + ' invalide le trade.',
          'Ouverture au-dessus de ' + usd(cap) + ' après la clôture de déclenchement : pas d’achat, le R/R deviendrait insuffisant.',
          'Une révision à la baisse de la guidance d’ARR annule la thèse avant activation.'] },
      globalScore: { profile: 'Qualité exceptionnelle, prix exigeant',
        keyTakeawaysPositive: ['Croissance récurrente en accélération, net new ARR record.', 'Flux de trésorerie libre record, sans levée de capital.', 'Base de clients large, sans dépendance à un acheteur.'],
        keyTakeawaysNegative: ['Valorisation qui suppose une croissance parfaite.', 'Titre étendu après un doublement depuis mai.', 'Dirigeants et administrateurs vendeurs, aucun achat.'],
        mindsetTip: 'Une très bonne entreprise peut être un mauvais achat au mauvais prix. Le bon trimestre est connu ; le prix d’entrée, lui, se choisit.' },
      social: { platforms: [], sourceRefs: [market('sentiment non retenu faute de mesure qualifiée')] },
      disclaimer: 'Document de recherche éducatif. Ni conseil financier, ni signal de trading. Statut surveiller : aucun ordre actif.',
    };
  },
});
