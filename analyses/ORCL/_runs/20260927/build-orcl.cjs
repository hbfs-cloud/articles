'use strict';
// Dossier Oracle (ORCL) v3 au close du 2026-09-25. Rafraîchissement de la v3 du 24 septembre (close du 23,
// statut surveiller, plan non déclenché). Contenu éditorial et repères propres au titre ; calculs, provenance
// et preuves délégués au gabarit tools/lib/analysis-v3-r07.cjs (REF=2026-09-25, run 20260927).
// Agrégats GAAP lus dans les données XBRL officielles de la SEC (companyfacts, 10-Q du 31 août inclus) :
// douze mois glissants = exercice clos le 31 mai 2026 (10-K) − T1 de l'exercice 2026 + T1 de l'exercice 2027
// (10-Q du 31 août). Bilan = valeurs au 31 août 2026. Dette = emprunts courants et non courants + passifs de
// location. Trésorerie = liquidités + placements courants. Actions = 3 023 736 000 au 7 septembre (10-Q).
// Le plan de trade du 23 septembre est archivé et invalidé : la clôture du 25 (137,10 $) est passée sous le
// plus bas post-résultats du 16 septembre (139,00 $), condition d'abandon du plan précédent.
const R = require('../../../../tools/lib/analysis-v3-r07.cjs');
const GEN = 'analyses/ORCL/_runs/20260927/build-orcl.cjs';
const SHARES = 3023736000;

R.build({
  ticker: 'ORCL', shortName: 'Oracle', cik: 1341439, generator: GEN, mode: 'archived',
  xbrl: {
    ttm: {
      rev: ['RevenueFromContractWithCustomerExcludingAssessedTax'],
      ebit: ['OperatingIncomeLoss'],
      ni: ['NetIncomeLoss'],
      dep: ['Depreciation'],
      amort: ['AmortizationOfIntangibleAssets'],
    },
    instant: {
      borrowCur: ['NotesPayableCurrent'],
      borrowNon: ['LongTermNotesAndLoans'],
      leaseA: ['OperatingLeaseLiability'],
      leaseB: ['FinanceLeaseLiability'],
      cashEq: ['CashAndCashEquivalentsAtCarryingValue'],
      sti: ['AvailableForSaleSecuritiesDebtSecuritiesCurrent'],
    },
    da: ['dep', 'amort'], debt: ['borrowCur', 'borrowNon', 'leaseA', 'leaseB'], cash: ['cashEq', 'sti'],
  },
  scenarioBasis: 'ebitda', scenarioMultiple: 12,
  valuationBasis: 'GAAP douze mois au 2026-08-31 (XBRL SEC) ; EBITDA = résultat opérationnel + dépréciation + amortissement ; dette = emprunts courants et non courants + passifs de location ; trésorerie = liquidités + placements courants au 31 août ; 3 023 736 000 actions au 7 septembre (10-Q) ; multiple ramené à douze fois l’EBITDA GAAP par hypothèse = re-cotation vers un fournisseur d’infrastructure à forte intensité capitalistique, au-dessus des douze mois glissants',
  shares: { value: SHARES, doc: 1 },
  // Repères courants (barres certifiées). En mode archivé, entrée/stop/objectifs viennent du plan archivé ;
  // ces niveaux servent aux supports, résistances et à la condition d'abandon citée dans la prose.
  levels: {
    s1: { d: '2026-09-24', c: 3 }, // 133,48 — plus bas de la cassure du 24 septembre
    s2: { d: '2026-08-03', c: 3 }, // 130,21 — base d'août avant la remontée pré-résultats
    s3: { d: '2026-07-31', c: 3 }, // 125,70 — haut de la zone de creux de juillet
    r1: { d: '2026-09-25', c: 2 }, // 140,88 — plus haut de séance du 25 septembre
    r2: { d: '2026-09-23', c: 3 }, // 144,23 — plus bas du 23, support cassé devenu résistance
    r3: { d: '2026-09-23', c: 2 }, // 148,66 — plus haut du 23 septembre
    abandon: { d: '2026-09-16', c: 3 }, // 139,00 — plus bas post-résultats, condition d'abandon du plan archivé
  },
  supports: ['s1', 's2', 's3'], resistances: ['r1', 'r2', 'r3'],
  levelsMethod: 'Repères actuels lus sur les barres certifiées ; le plan chiffré est celui, archivé, du 23 septembre.',
  inventory: 7,
  reviewScope: 'Dépôts EDGAR d’Oracle du 15 mai au 25 septembre 2026, déclarations de détention (formulaires 3, 4, 5) exclues. Cinq dépôts décisionnels ouverts et hachés : communiqué de résultats du 10 septembre (8-K, Exhibit 99.1), 10-Q du trimestre clos le 31 août, 8-K du 14 septembre sur l’annulation du plan de cession de Larry Ellison, supplément de prospectus « at-the-market » du 23 juin et 10-K de l’exercice clos le 31 mai. Le formulaire SD et le communiqué de résultats préliminaire, repris et remplacé par le 10-K, sont écartés comme non décisionnels ; aucun nouveau dépôt de financement n’apparaît entre le 11 et le 25 septembre.',
  docs: [
    ['2026-09-10', '8-K / Exhibit 99.1', '0001193125-26-387905', 'orcl-ex99_1.htm', 'q1fy27-ex991.htm',
      'Communiqué du premier trimestre de l’exercice 2027 : chiffre d’affaires de 19,3 Md$ (+30 %), infrastructure cloud en hausse de 121 %, carnet de commandes contractuel (RPO) de 664 Md$, flux de trésorerie libre négatif d’environ 5 Md$, et prévision annuelle relevée à au moins 90 Md$ de revenus.'],
    ['2026-09-11', '10-Q', '0001193125-26-389274', 'orcl-20260831.htm', 'q1fy27-10q.htm',
      'Le rapport trimestriel confirme l’usage complet du programme d’émission d’actions « at-the-market » (environ 141 millions d’actions pour 19,9 Md$ nets) et un capex de 28,5 Md$. Le flux opérationnel de 23,1 Md$ inclut 11,4 Md$ de prépaiements clients ; les emprunts reculent de 129,5 à 125,3 Md$. Il mentionne 288 Md$ de loyers futurs hors bilan et une action collective sur l’infrastructure cloud, amendée le 14 juillet.'],
    ['2026-09-14', '8-K / Exhibit 99.1', '0001193125-26-389753', 'd20034dex991.htm', 'sep14-ex991.htm',
      'Oracle annonce que Larry Ellison a annulé son plan de cession 10b5-1 sans qu’aucune action n’ait été vendue au titre de ce plan, et qu’il n’a pas d’autre plan de vente. Le signal porte sur l’offre de titres du premier actionnaire, pas sur les résultats.'],
    ['2026-06-23', '424B5', '0001193125-26-278585', 'd120346d424b5.htm', 'jun23-424b5.htm',
      'Supplément de prospectus d’un programme d’émission d’actions « at-the-market » plafonné à 20 Md$, qui ajoute des agents placeurs. Il fixe la capacité juridique d’émission ; le 10-Q suivant montre qu’elle a été entièrement utilisée au premier trimestre.'],
    ['2026-06-22', '10-K', '0001193125-26-277521', 'orcl-20260531.htm', 'fy26-10k.htm',
      'Rapport annuel : aucun client au-dessus de dix pour cent du chiffre d’affaires, mais une concentration non nominative sur quelques grands clients de l’infrastructure cloud, et des actions préférentielles obligatoirement convertibles en janvier 2029 dont la conversion, entre 499,8126 et 624,7657 actions ordinaires, dépend du cours.'],
  ],
  needles: {
    ampere: [0, ['Ampere']],
    oci_growth: [0, ['cloud infrastructure', '30%']],
    atm: [1, ['fully utilized', 'at-the-market']],
    rpo: [1, ['664 billion']],
    leases: [1, ['288 billion', 'customer prepayments']],
    litigation: [1, ['Securities Class Action']],
    ellison: [2, ['Ellison', '10b5-1', 'has cancelled', 'no other']],
    atm_shelf: [3, ['20,000,000,000', 'Prospectus Supplement', 'common stock']],
    customers: [4, ['No single customer accounted for 10% or more of our total revenues']],
    convertible: [4, ['499.8126', '624.7657', 'mandatory']],
  },
  score: { business: 24, technical: -8, capital: -9, calendar: 0, dilution: -6, risk: 52 },
  riskScoreReason: 'Jugement qualitatif sur dix : financement de la croissance, concentration des clients et exécution.',
  compose: c => {
    const { fr, usd, pct, sgn, close, prev, bars, N, tech, st, M, adv, ret, G$, marketCap, ev, scn, entry, stop, tp1, tp2, rr1, rr2, abandon, ref, market, docs, raw, lv } = c;
    const evEbitda = ev / G$.ebitda, evRev = ev / G$.rev, pe = marketCap / G$.ni, peFwd = close / 8.10;
    const bar = d => bars.find(b => b[0] === d), prevOf = d => bars[bars.findIndex(b => b[0] === d) - 1];
    const d0924 = bar('2026-09-24'), p0923 = bar('2026-09-23'), d0925 = bar('2026-09-25');
    return {
      meta: { lang: 'fr', dir: 'ltr', level: 'intermediate', tags: ['us', 'equities', 'ai-chain', 'software', 'technology'], grade: 'B-', date: '2026-09-27', dateDisplay: '27 septembre 2026', version: 3, status: 'no-trade', assetType: 'stock', levelsCloseDate: c.REF,
        description: 'Oracle : un carnet de commandes géant, une facture d’investissement qui l’est tout autant, et un titre qui casse ses plus bas post-résultats. Dossier au close du 25 septembre 2026, statut surveiller, aucune entrée.',
        ogDescription: 'Oracle : infrastructure cloud +121 %, RPO de 664 Md$, mais flux libre négatif et dilution réalisée ; le titre casse ses moyennes et ses plus bas post-résultats. Aucune entrée au cours actuel.',
        lastMcpRefresh: raw.status.captured_at, levelsVerifiedAt: raw.status.captured_at,
        statusHistory: [...(c.archive.meta.statusHistory || []), { at: raw.status.captured_at, from: 'watch', to: 'no-trade', note: 'rafraîchissement du 27 septembre au close du 25 : le plan du 23 est invalidé, la clôture à ' + usd(close) + ' étant passée sous le plus bas post-résultats du 16 septembre (' + usd(abandon) + ') ; titre sous ses moyennes à vingt, cinquante et deux cents séances, aucune entrée', close }] },
      header: { ticker: 'ORCL', name: 'Oracle Corporation', exchange: 'NYSE', sector: 'Logiciels et infrastructure cloud', price: close, changePct: pct(close, prev),
        badges: [{ text: 'SURVEILLER — AUCUNE ENTRÉE AU COURS ACTUEL', color: 'blue' }, { text: 'Infrastructure cloud IA', color: 'purple' }],
        metrics: { marketCap: fr(marketCap / 1e9, 1) + ' Md$', volume: fr(bars[N][5] / 1e6, 2) + ' M', evEbitda: fr(evEbitda, 1) + '×' }, halalStatus: 'unknown' },
      verdict: { score: 53, conviction: 'Moderate', bias: 'Neutral',
        confidence: 'Score éditorial non prédictif. Les chiffres d’entreprise viennent des dépôts SEC et des données XBRL officielles ; les niveaux, du close certifié du 25 septembre.',
        summary: 'Oracle vend de la capacité de calcul pour l’IA plus vite qu’il ne peut la construire. Le trimestre publié le 10 septembre le montre : l’infrastructure cloud double, le carnet de commandes atteint un niveau sans équivalent dans le logiciel. Le problème est le financement. Le capex dépasse un flux opérationnel lui-même gonflé par des prépaiements de clients, et la société a vendu en un trimestre tout son programme d’émission d’actions pendant qu’elle remboursait de la dette. Depuis la publication, le marché tranche : le titre a rendu tout le gap de résultats, puis a cassé. À ' + usd(close) + ', il clôture sous ses moyennes à vingt, cinquante et deux cents séances, et surtout sous le plus bas post-résultats du 16 septembre (' + usd(abandon) + '). Le plan de surveillance du 23 septembre est de ce fait invalidé : sa condition d’abandon est franchie. Rien dans les comptes n’a changé en deux séances ; c’est le prix qui refuse la thèse de croissance tant que la facture de financement reste ouverte. Aucune entrée : on attend une base, pas un couteau qui tombe.',
        whyBuy: [
          'Le chiffre d’affaires trimestriel atteint 19,3 Md$, en hausse de 30 %, et l’infrastructure cloud en hausse de 121 % : la croissance est dans les comptes, pas seulement dans les promesses.',
          'Le carnet de commandes contractuel (RPO) atteint 664 Md$ ; le 10-Q en situe environ 13 % sur les douze prochains mois, ce qui donne une visibilité rare sur les revenus.',
          'La direction relève sa prévision annuelle à au moins 90 Md$ de revenus et vise un bénéfice ajusté de 8,10 $ par action ; c’est une attente, pas un résultat.',
          'Larry Ellison a annulé son plan de vente d’actions : l’offre de titres du premier actionnaire ne pèse plus sur le cours.'],
        whyAvoid: [
          'Au close du 25 septembre, la valeur d’entreprise représente ' + fr(evEbitda, 1) + ' fois l’EBITDA GAAP des douze mois clos le 31 août, alors que le trimestre affiche un flux de trésorerie libre négatif : la valorisation suppose que l’investissement paiera.',
          'Le capex trimestriel de 28,5 Md$ dépasse le flux opérationnel de 23,1 Md$, lui-même porté par 11,4 Md$ de prépaiements clients : hors ce poste, le flux libre du trimestre ressort à −16,8 Md$.',
          'Le programme d’émission d’actions de 20 Md$ a été entièrement utilisé en un trimestre : environ 141 millions d’actions nouvelles, soit une dilution déjà réalisée.',
          'Le titre casse le plus bas post-résultats du 16 septembre et clôture sous ses moyennes à vingt, cinquante et deux cents séances : la tendance est franchement baissière.'],
        controlChecklist: [
          { label: 'Historique de cours', status: 'pass', statusLabel: 'Trois cents séances continues', evidence: 'Série quotidienne certifiée au close du 25 septembre.', action: 'Niveaux et moyennes calculés sur cette seule série.' },
          { label: 'Financement', status: 'warn', statusLabel: 'Dilution réalisée', evidence: 'Programme d’émission d’actions épuisé au premier trimestre ; aucune nouvelle capacité annoncée.', action: 'Relire chaque nouveau dépôt avant toute entrée.' },
          { label: 'Plan de trade', status: 'warn', statusLabel: 'Plan du 23 invalidé', evidence: 'Clôture du 25 à ' + usd(close) + ', sous le plus bas post-résultats du 16 septembre (' + usd(abandon) + ') : condition d’abandon franchie.', action: 'Aucune entrée ; attendre une base et une reprise avant de reconstruire un plan.' }] },
      business: { theme: 'Logiciels d’entreprise et infrastructure cloud pour l’IA',
        overview: '<p>Oracle a trois métiers. Le logiciel historique, bases de données et licences, recule doucement à mesure que les clients migrent vers le cloud. Les applications cloud, gestion et santé, progressent d’environ 10 %. Et l’infrastructure cloud, où la société loue de la capacité de calcul à des clients qui entraînent et font tourner des modèles d’IA.</p><p>C’est ce dernier métier qui porte la thèse. Il a bondi de 121 % au trimestre clos le 31 août. Le carnet de commandes contractuel (RPO) atteint 664 Md$, en forte hausse sur un an. Oracle indique avoir livré plusieurs centaines de milliers de processeurs graphiques depuis la fin du trimestre précédent.</p><p>Le revers est mécanique. Pour livrer, il faut construire des centres de données, acheter des puces et sécuriser de l’électricité avant d’encaisser. Le capex du trimestre, 28,5 Md$, a dépassé le flux opérationnel de 23,1 Md$. Ce flux contient lui-même 11,4 Md$ de prépaiements de clients : une avance de trésorerie liée à des contrats, pas un bénéfice récurrent. Le trou a été comblé par 19,9 Md$ d’actions émises. Dans le même temps, Oracle a remboursé de la dette senior ; ses emprunts sont revenus de 129,5 à 125,3 Md$. Il s’est aussi engagé sur 288 Md$ de loyers de centres de données qui ne figurent pas encore au bilan.</p>',
        moat: 'La base installée de bases de données et d’applications crée une relation longue avec les grandes entreprises, et l’infrastructure cloud a démontré sa capacité à signer des contrats de très grande taille. L’avantage sur l’infrastructure IA est moins durable : il tient à la vitesse de construction et au coût du capital, deux terrains où les hyperscalers et les néo-clouds se battent aussi.',
        segments: [
          { name: 'Cloud (infrastructure et applications)', revenue: 'Environ 60 % des revenus', pct: '+121 % infra', description: 'Infrastructure en hausse de 121 %, applications en hausse d’environ 10 %.' },
          { name: 'Logiciel sous licence', revenue: 'Environ 29 % des revenus', pct: 'En recul', description: 'Migration des clients vers le cloud.' },
          { name: 'Services et matériel', revenue: 'Environ 11 % des revenus', pct: 'Stable', description: 'Services et matériel d’infrastructure.' }],
        sourceRefs: [ref(0), ref(1)],
        coverageMatrix: [
          { facet: 'Cours et historique', status: 'COUVERT', decision: 'Trois cents séances continues, close certifié ; base des niveaux.' },
          { facet: 'Résultats et guidance', status: 'COUVERT — PRIMAIRE', decision: 'Communiqué du 10 septembre et 10-Q ; prochaine date non confirmée.' },
          { facet: 'Agrégats GAAP', status: 'COUVERT — XBRL', decision: 'Douze mois glissants au 31 août 2026, reconstitués depuis les données XBRL officielles.' },
          { facet: 'Capital et dilution', status: 'COUVERT — PRIMAIRE', decision: 'Programme d’actions épuisé, préférentielles convertibles et dette séparées.' },
          { facet: 'Comparables et transmission', status: 'COUVERT — LOCAL', decision: 'Corrélations recalculées sur barres certifiées ; quatre valeurs d’électricité et de foncières écartées pour barres manquantes ou géométrie invalide.' },
          { facet: 'Initiés', status: 'PARTIEL', decision: 'Ventes de dirigeants relevées ; couverture officielle incomplète, aucun solde net affirmé.' },
          { facet: 'Options', status: 'NON EXPLOITABLE', decision: 'Chaîne relevée marché fermé, sans prix ni intérêt ouvert utilisables.' },
          { facet: 'Sentiment et tendances de recherche', status: 'INDISPONIBLE', decision: 'Aucune mesure qualifiée ; non utilisé.' }] },
      news: [
        { date: '2026-09-10', title: 'Premier trimestre : l’infrastructure cloud double', impact: 'positive', detail: 'La croissance de l’infrastructure cloud et le carnet de commandes relèvent la visibilité des revenus, mais le flux de trésorerie libre reste négatif : la croissance consomme du capital.', source: 'Oracle — SEC', sourceUrl: docs[0].url },
        { date: '2026-09-11', title: 'Le 10-Q confirme l’émission complète de 20 Md$ d’actions', impact: 'negative', detail: 'L’émission de près de cent quarante et un millions d’actions a dilué les actionnaires existants pour financer les centres de données ; la dilution est réalisée, pas hypothétique.', source: 'Oracle — SEC', sourceUrl: docs[1].url },
        { date: '2026-09-14', title: 'Larry Ellison renonce à vendre ses actions', impact: 'positive', detail: 'L’annulation du plan de cession retire une offre potentielle importante de titres du marché, sans rien changer à l’économie des contrats ni au besoin de financement.', source: 'Oracle — SEC', sourceUrl: docs[2].url },
        { date: '2026-09-25', title: 'Le titre casse ses plus bas post-résultats', impact: 'negative', detail: 'Après ' + sgn(pct(d0924[4], p0923[4]), 1) + ' le 24 puis ' + sgn(pct(d0925[4], d0924[4]), 1) + ' le 25, Oracle clôture à ' + usd(close) + ', sous le plus bas du 16 septembre (' + usd(abandon) + ') et sous ses moyennes courtes : le marché escompte le coût de financer la croissance.', source: 'Barres certifiées', sourceUrl: c.evidenceUrl }],
      fundamentals: { rows: [
          { metric: 'Chiffre d’affaires du trimestre', value: '19,3 Md$', signal: '+30 % sur un an, communiqué du 10 septembre', signalColor: 'green', _src: 0 },
          { metric: 'Infrastructure cloud du trimestre', value: '+121 %', signal: 'Croissance sur un an du métier qui porte la thèse', signalColor: 'green', _src: 0 },
          { metric: 'Flux opérationnel du trimestre', value: '23,1 Md$', signal: 'Dont 11,4 Md$ de prépaiements clients, 10-Q', signalColor: 'amber', _src: 1 },
          { metric: 'Capex du trimestre', value: '28,5 Md$', signal: 'Supérieur au flux opérationnel', signalColor: 'red', _src: 1 },
          { metric: 'Flux de trésorerie libre du trimestre', value: '−5,4 Md$', signal: 'Flux opérationnel − capex, 10-Q', signalColor: 'red', _src: 1 },
          { metric: 'Flux libre du trimestre hors prépaiements clients', value: '−16,8 Md$', signal: 'Sans les avances de clients, trimestre clos le 31 août', signalColor: 'red', _src: 1 },
          { metric: 'Revenus GAAP sur douze mois', value: fr(G$.rev / 1e9, 2) + ' Md$', signal: 'Douze mois glissants au 31 août 2026 (XBRL SEC)', signalColor: 'blue', _src: 'gaap' },
          { metric: 'EBITDA GAAP sur douze mois', value: fr(G$.ebitda / 1e9, 2) + ' Md$', signal: 'Résultat opérationnel + amortissements, douze mois au 31 août 2026', signalColor: 'blue', _src: 'gaap' },
          { metric: 'Résultat net GAAP sur douze mois', value: fr(G$.ni / 1e9, 2) + ' Md$', signal: 'Douze mois glissants au 31 août 2026', signalColor: 'blue', _src: 'gaap' },
          { metric: 'Dette au 31 août (emprunts + loyers)', value: fr(G$.debt / 1e9, 2) + ' Md$', signal: 'Emprunts courants et non courants + passifs de location, bilan du 10-Q', signalColor: 'amber', _src: 'gaap' },
          { metric: 'Trésorerie et placements au 31 août', value: fr(G$.cash / 1e9, 2) + ' Md$', signal: 'Liquidités + placements courants, bilan du 10-Q', signalColor: 'blue', _src: 'gaap' },
          { metric: 'EV/EBITDA GAAP', value: fr(evEbitda, 1) + '×', signal: 'Valeur d’entreprise au close du 2026-09-25 sur EBITDA GAAP douze mois au 2026-08-31', signalColor: 'amber', source: 'Clôture certifiée et XBRL SEC', comparison: 'À rapprocher du multiple historique d’Oracle et de celui des grands éditeurs de logiciels comparables comme SAP ou CRM, qui sert de repère de valorisation ; l’écart avec le scénario ci-dessous mesure la prime accordée au carnet de commandes.', _src: 'market' },
          { metric: 'EV/revenus GAAP', value: fr(evRev, 1) + '×', signal: 'Valeur d’entreprise au close du 2026-09-25 sur revenus GAAP douze mois au 2026-08-31', signalColor: 'amber', source: 'Clôture certifiée et XBRL SEC', comparison: 'Face à une croissance de 30 % : le multiple suppose que la croissance dure.', _src: 'market' },
          { metric: 'P/E GAAP sur douze mois', value: fr(pe, 1) + '×', signal: 'Capitalisation au 2026-09-25 sur résultat net GAAP douze mois au 2026-08-31', signalColor: 'blue', source: 'Clôture certifiée et XBRL SEC', comparison: 'Le résultat net douze mois inclut des produits non opérationnels de l’exercice 2026, dont le gain de cession de la participation dans Ampere : ce P/E est flatté.', _src: 'market' },
          { metric: 'P/E sur bénéfice ajusté guidé', value: fr(peFwd, 1) + '×', signal: 'Close du 2026-09-25 sur bénéfice ajusté non-GAAP de 8,10 $ guidé pour l’exercice 2027', signalColor: 'blue', source: 'Clôture certifiée et communiqué du 10 septembre', comparison: 'Base non-GAAP, hors éléments exceptionnels : non comparable terme à terme au P/E GAAP.', _src: 0 },
          { metric: 'EV/EBITDA — scénario de compression (hypothèse éditoriale)', value: fr(scn.price, 2) + ' $ par action', signal: 'Scénario : multiple ramené à douze fois l’EBITDA GAAP douze mois au 2026-08-31, dette et trésorerie du 2026-08-31 inchangées, soit ' + fr(scn.downside_pct, 0) + ' % sous le close du 2026-09-25', signalColor: 'red', source: 'Clôture certifiée et XBRL SEC', comparison: 'Hypothèse d’un marché payant Oracle comme un fournisseur d’infrastructure et non comme un éditeur ; ce n’est pas un objectif.', _src: 'market' }],
        sourceRefs: [ref(0), ref(1), market('fondamentaux et statistiques')] },
      earnings: { quarters: [],
        beatNote: 'Premier trimestre de l’exercice 2027 (clos le 31 août 2026) : bénéfice par action GAAP de 1,56 $ (+55 %), ajusté de 1,92 $ (+30 %). Guidance du deuxième trimestre : revenus en hausse de 30 à 34 %, bénéfice ajusté de 1,85 à 1,93 $ par action. Exercice complet : au moins 90 Md$ de revenus et 8,10 $ de bénéfice ajusté. Ces prévisions dépendent de la mise en service des capacités, pas seulement des commandes. Aucune date de prochaine publication n’est confirmée par l’émetteur à ce jour.',
        nextEarnings: 'Date non confirmée par l’émetteur ; aucune publication dans les quatorze jours du calendrier collecté.',
        sourceRefs: [ref(0)] },
      capitalStructure: { sharesOutstanding: '3 023 736 000 actions au 7 septembre 2026 (page de garde du 10-Q)',
        sharesAuthorized: 'Onze milliards d’actions ordinaires autorisées, selon le bilan du 10-Q.',
        dilutionRisk: 'high',
        shareHistory: 'Le nombre d’actions en circulation est passé d’environ 2,880 à 3,024 milliards entre le 31 mai et le 31 août 2026, surtout à cause des quelque 141 millions d’actions émises via le programme « at-the-market », pour 19,9 Md$ nets. À cela s’ajoutent cinquante mille actions préférentielles obligatoirement convertibles au 15 janvier 2029, chacune en 499,8126 à 624,7657 actions ordinaires selon le cours : entre environ vingt-cinq et trente et un millions d’actions supplémentaires. Un nombre d’actions entièrement dilué à date n’est pas calculable depuis ces seuls dépôts. Les emprunts, 125,3 Md$ au 31 août contre 129,5 Md$ au 31 mai, ont baissé sur le trimestre : l’émission d’actions a financé le capex et des remboursements. La dette ne dilue pas, mais pèse sur le flux disponible.',
        warrants: [],
        atm: { active: false, authorized: '20 Md$ (supplément du 23 juin 2026)', used: '19,9 Md$ nets, environ 141 millions d’actions', remaining: 'Épuisé au 31 août 2026 ; aucun nouveau programme relevé' },
        sourceRefs: [ref(1), ref(3), ref(4)] },
      filingsReview: { summary: 'Cinq dépôts décisionnels ouverts et hachés. Ils séparent trois choses que le marché mélange : les résultats, qui sont bons ; le financement, par dette et par actions, qui dilue et endette ; et l’offre de titres des initiés, qui se réduit. Aucun nouveau dépôt de financement n’est apparu entre le 11 et le 25 septembre.',
        filings: docs.map(d => ({ date: d.date, form: d.form, accession: d.accession, finding: d.finding, url: d.url })),
        contrarianRisks: [
          'Le carnet de commandes est concentré sur quelques grands clients d’infrastructure cloud non nommés : une défaillance ou une renégociation pèserait lourd.',
          'Les engagements de location non comptabilisés dépassent la dette senior ; ils entreront au bilan à mesure que les centres de données ouvriront.',
          'Le programme d’actions est épuisé : un nouveau besoin de capital passerait par une nouvelle émission ou par davantage de dette.',
          'Une annulation de plan de vente n’est pas un achat : elle retire une offre, elle n’apporte pas de demande.',
          'Le flux opérationnel du trimestre repose en partie sur des prépaiements de clients : un encaissement d’avance ne se répète pas mécaniquement.',
          'Une action collective d’actionnaires vise les déclarations passées sur l’infrastructure cloud ; l’issue et le montant éventuel ne sont pas chiffrés par la société.'] },
      technicals: { rsi14: +tech.rsi14.toFixed(2), macd: +tech.macd.toFixed(2), macdSignal: +tech.macdSignal.toFixed(2), ema20: +tech.ema20.toFixed(2), ema50: +tech.ema50.toFixed(2), ema200: +tech.ema200.toFixed(2),
        ma50Type: 'EMA', ma200Type: 'EMA', ma50Available: true, ma200Available: true, atr14: +tech.atr14.toFixed(2),
        badges: ['Sous les moyennes à vingt, cinquante et deux cents séances', 'Sous le plus bas post-résultats du 16 septembre', 'Aucune entrée au cours actuel'],
        supports: [lv('s1'), lv('s2'), lv('s3')], resistances: [lv('r1'), lv('r2'), lv('r3')],
        setupNote: 'Le titre clôture à ' + usd(close) + ', sous ses moyennes à vingt (' + usd(tech.ema20) + '), cinquante (' + usd(tech.ema50) + ') et deux cents séances (' + usd(tech.ema200) + '), RSI à ' + fr(tech.rsi14, 0) + ', MACD sous sa ligne de signal. Il vient de casser le plus bas post-résultats du 16 septembre (' + usd(abandon) + '), ce qui invalide le plan de surveillance du 23. Aucune entrée avant qu’une base ne se forme. Supports : ' + usd(lv('s1')) + ', ' + usd(lv('s2')) + ' et ' + usd(lv('s3')) + '. Résistances : ' + usd(lv('r1')) + ', ' + usd(lv('r2')) + ' et ' + usd(lv('r3')) + '.',
        wyckoff: 'Phase de baisse (markdown) sur le profil de volume ; non utilisée pour fixer les niveaux.',
        sourceRefs: [market('barres quotidiennes et indicateurs recalculés')] },
      options: { callOI: 'Non exploitable', putOI: 'Non exploitable', cpRatio: 'Non exploitable', maxPain: 'Non exploitable', ivMean: 'Non exploitable', skew: 'Chaîne relevée marché fermé, sans prix ni intérêt ouvert', unusual: 'Aucune activité inhabituelle qualifiée sur l’échéance la plus proche', sourceRefs: [market('options')] },
      shortInterest: { siPct: fr(st.shortPercentOfFloat * 100, 2) + ' % du flottant', daysToCover: fr(st.shortRatio, 2) + ' jours, date de règlement non précisée par le snapshot', ctb: 'Coût d’emprunt non disponible à la collecte', trend: 'Positions vendeuses faibles pour une capitalisation de cette taille ; aucune thèse de rachat forcé des vendeurs.', squeezeScore: 'Non pertinent', sourceRefs: [market('positions vendeuses')] },
      insiders: { signal: 'Ventes de marché de dirigeants en septembre, aucun achat : ventes de marché d’un membre de la co-direction générale (10 882 actions le 16 septembre, 22 562 le 22) et de la responsable comptable (2 631 le 22 septembre), chaque fois précédées d’un formulaire 144 déposé le même jour. Les autres mouvements du mois sont des exercices d’options et des retenues fiscales. Couverture officielle partielle : aucun solde net publié. L’annulation du plan de cession de Larry Ellison reste le fait d’initié le plus lourd en volume potentiel.',
        recentTransactions: [],
        sourceRefs: [market('formulaires 4 et 144'), ref(2)] },
      macro: { indicators: [{ name: 'Clôture de référence', value: c.REF, signal: usd(close) + ', séance complète' }, { name: 'Rendement cinq séances', value: sgn(ret(5)), signal: 'Descriptif' }, { name: 'Rendement vingt et une séances', value: sgn(ret(21)), signal: 'Descriptif' }],
        regime: 'neutral', impact: 'Un titre qui finance sa croissance par la dette et par des loyers de long terme est sensible aux taux longs : leur hausse renchérit chaque dollar de capex à venir. Le régime de marché ne remplace pas ce test.' },
      risks: { riskScore: 7, riskProfile: 'High',
        riskSummary: 'Le risque d’Oracle n’est pas la demande, c’est le décalage entre le moment où il dépense et le moment où il encaisse. Tant que le capex dépasse le flux opérationnel, chaque trimestre exige du financement externe : dette, loyers ou actions. Une hausse des taux, un client qui ralentit ou un chantier en retard suffisent à rendre ce financement plus cher — et le marché vient de le rappeler en cassant le titre.',
        riskCards: [
          { title: 'Financement de la croissance', severity: 'high', icon: 'fa-sack-dollar', points: ['Capex trimestriel supérieur au flux opérationnel, lui-même porté par des prépaiements de clients.', 'Programme d’actions épuisé ; passifs de location et loyers futurs hors bilan élevés.'], verdict: 'Suivre le flux libre hors prépaiements et le moindre nouveau dépôt de financement avant de considérer une position.' },
          { title: 'Concentration des clients', severity: 'high', icon: 'fa-users', points: ['Le 10-K mentionne une concentration sur quelques grands clients d’infrastructure cloud.', 'Aucun client n’est nommé : le risque de contrepartie n’est pas mesurable depuis les dépôts.'], verdict: 'Une renégociation ou un retard d’un grand client affecterait directement le carnet et la valeur des capacités construites.' },
          { title: 'Tendance et point d’entrée', severity: 'high', icon: 'fa-chart-line', points: ['Titre sous ses moyennes à vingt, cinquante et deux cents séances.', 'Cassure du plus bas post-résultats : le plan du 23 est invalidé.'], verdict: 'Acheter dans une tendance baissière confirmée, c’est rattraper un couteau ; attendre une base.' },
          { title: 'Litige et exécution', severity: 'medium', icon: 'fa-scale-balanced', points: ['Action collective d’actionnaires sur l’infrastructure cloud, amendée en juillet.', 'Électricité, puces et permis conditionnent la mise en service ; prochaine date de résultats non confirmée.'], verdict: 'Aucun montant n’est provisionné ; un retard de mise en service décale le revenu sans décaler les loyers et les intérêts.' }],
        pedagogy: 'Le titre a ouvert en gap le lendemain des résultats puis a tout rendu, et casse aujourd’hui ses plus bas post-résultats : acheter dans ce mouvement, c’est payer un couteau qui tombe. Le spread et le slippage peuvent dépasser le risque prévu. Dimensionner une position à partir de la distance au stop et d’un budget de perte fixé d’avance, jamais à partir de l’objectif. Ici, la bonne décision est d’attendre une base tenue : sans elle, on ne prend pas de position et on ne court pas après un rebond.' },
      tradeIdea: { status: 'no-trade', archiveReferenceClose: c.archive.meta.levelsCloseDate,
        statusNote: 'Aucun ordre actif. Les niveaux affichés — entrée ' + usd(entry) + ', stop ' + usd(stop) + ', TP1 ' + usd(tp1) + ', TP2 ' + usd(tp2) + ' — sont ceux, archivés, du plan de surveillance du 23 septembre, désormais invalidé : la clôture du 25 à ' + usd(close) + ' est passée sous le plus bas post-résultats du 16 septembre (' + usd(abandon) + '), condition d’abandon de ce plan. Ils sont conservés pour mémoire, inactifs et non exécutables. Aucune nouvelle entrée au cours actuel : le titre est sous toutes ses moyennes et en tendance baissière.',
        entry, stop, tp1, tp2,
        stopPct: pct(stop, entry).toFixed(1) + '%', tp1Pct: '+' + pct(tp1, entry).toFixed(1) + '%', tp2Pct: '+' + pct(tp2, entry).toFixed(1) + '%',
        rr: '1:' + rr1.toFixed(2) + ' TP1 / 1:' + rr2.toFixed(2) + ' TP2',
        entryNote: 'Aucune entrée. Les niveaux ci-dessus sont archivés et non exécutables. Conditions de réexamen, sans ordre : une base tenue au-dessus des plus bas de septembre puis une clôture au-dessus de ' + usd(lv('r2')) + ', le support cassé du 23 devenu résistance, avec un volume au moins égal à la moyenne récente ; ou une capitulation nette suivie d’un rejet haussier. Liquidité : environ ' + fr(adv / 1e9, 1) + ' Md$ échangés par séance ; ATR de ' + usd(tech.atr14) + '.',
        horizon: 'Aucune position au cours actuel',
        thesis: 'Le marché a vendu la publication malgré de bons chiffres, puis a cassé : il escompte le coût du financement. Le plan de surveillance du 23 septembre est invalidé, sa condition d’abandon franchie. On ne rachète pas un titre qui casse ses plus bas sous toutes ses moyennes ; le prochain plan se construira sur une base, quand les vendeurs d’après résultats seront absorbés et qu’une reprise se dessinera au-dessus de ' + usd(lv('r2')) + '. La décote reste hypothétique tant que la tendance est baissière : un carnet de commandes n’est pas du cash, et le marché paie d’abord la facture de financement.',
        catalysts: ['Une base tenue au-dessus des plus bas de septembre, puis une clôture au-dessus du support cassé du 23 (' + usd(lv('r2')) + ') sur volume.', 'L’absence de nouveau programme d’émission d’actions dans les dépôts.', 'Une stabilisation du secteur de l’infrastructure IA après la vague de résultats de fin septembre.'],
        invalidation: ['Les niveaux affichés sont archivés et informatifs : aucun transfert vers une exécution actuelle.', 'Un achat au cours actuel, dans une tendance baissière confirmée, contredit ce dossier.', 'Un nouveau dépôt de financement en actions aggraverait la dilution et pèserait davantage sur le titre.'] },
      globalScore: { profile: 'Croissance réelle, financement coûteux, tendance cassée',
        keyTakeawaysPositive: ['Croissance de l’infrastructure cloud supérieure à cent pour cent, visible dans les comptes.', 'Carnet de commandes contractuel sans équivalent dans le logiciel.', 'Offre de titres du premier actionnaire retirée.'],
        keyTakeawaysNegative: ['Flux de trésorerie libre négatif : la croissance consomme du capital.', 'Dilution réalisée par l’émission complète du programme d’actions.', 'Tendance baissière confirmée : titre sous toutes ses moyennes, plus bas post-résultats cassés.'],
        mindsetTip: 'Un carnet de commandes n’est pas du cash. Regarder qui paie la construction avant de regarder qui signe la commande — et ne jamais rattraper un couteau qui tombe.' },
      social: { platforms: [], sourceRefs: [market('sentiment non retenu faute de mesure qualifiée')] },
      disclaimer: 'Document de recherche éducatif. Ni conseil financier, ni signal de trading. Statut surveiller : aucun ordre actif ; le plan affiché est archivé et invalidé.',
    };
  },
  groups: [
    { name: 'Leaders du cloud', order: 1, transmission: 'Ils fixent le prix et le rythme de la capacité IA ; leur capex dit si la demande tient.', rows: [
      ['MSFT', 'leader', 'Hyperscaler et concurrent direct', 'Azure et l’infrastructure cloud d’Oracle se disputent les mêmes contrats d’entraînement ; un ralentissement du capex Microsoft signalerait une demande moins pressée.'],
      ['AMZN', 'leader', 'Premier fournisseur de cloud public', 'AWS fixe la référence de prix de la capacité ; une guerre de prix comprimerait la marge d’Oracle.'],
      ['GOOGL', 'leader', 'Hyperscaler avec puces maison', 'Google Cloud s’appuie sur ses propres puces ; son avance de coût est une menace directe sur les contrats IA.']] },
    { name: 'Pairs directs', order: 1, transmission: 'Néo-cloud et éditeurs de logiciels d’entreprise : mêmes clients, même budget.', rows: [
      ['NBIS', 'direct_peer', 'Néo-cloud IA coté', 'Même modèle de location de capacité de calcul financée par capital externe ; ses conditions de financement éclairent celles d’Oracle.'],
      ['IBM', 'direct_peer', 'Logiciel et infrastructure d’entreprise', 'Même base de grands comptes et même transition du logiciel vers le cloud hybride.'],
      ['SAP', 'direct_peer', 'Concurrent en applications de gestion', 'Concurrent frontal des applications cloud d’Oracle ; ses renouvellements mesurent la part de marché.'],
      ['CRM', 'direct_peer', 'Applications cloud d’entreprise', 'Budget logiciel des mêmes directions ; une pression sur les applications toucherait les deux.'],
      ['NOW', 'direct_peer', 'Plateforme logicielle d’entreprise', 'Référence de valorisation des logiciels à abonnement ; elle encadre le multiple accordé aux applications d’Oracle.']] },
    { name: 'Amont : puces, réseau et serveurs', order: 1, transmission: 'Oracle achète ; ces fournisseurs encaissent le capex avant qu’Oracle n’encaisse ses revenus.', rows: [
      ['NVDA', 'upstream', 'Fournisseur de processeurs graphiques', 'Les livraisons de puces conditionnent la capacité de l’infrastructure cloud ; un retard décale le revenu d’Oracle.'],
      ['AMD', 'upstream', 'Fournisseur d’accélérateurs alternatif', 'Seconde source d’accélérateurs ; sa disponibilité pèse sur le coût et le calendrier des déploiements.'],
      ['AVGO', 'upstream', 'Puces réseau et accélérateurs', 'Le réseau des grappes IA passe par ses puces ; la demande d’Oracle se lit dans ses commandes.'],
      ['ANET', 'upstream', 'Commutateurs de centres de données', 'Équipementier réseau des grandes grappes ; un signal avancé de construction de capacité.'],
      ['MU', 'upstream', 'Mémoire à haut débit', 'La mémoire limite l’assemblage des serveurs IA ; sa rareté renchérit le capex.'],
      ['DELL', 'upstream', 'Intégrateur de serveurs IA', 'Assemble des serveurs pour les clouds ; son carnet reflète en partie la demande des acheteurs de capacité.'],
      ['VRT', 'upstream', 'Alimentation et refroidissement', 'Équipements électriques et thermiques des centres de données ; un goulot pour la mise en service.']] },
    { name: 'Second ordre : énergie, hébergement, acheteurs', order: 2, transmission: 'Contraintes physiques et demande indirecte : électricité, sites et grands acheteurs de capacité.', rows: [
      ['CEG', 'second_order', 'Producteur d’électricité nucléaire', 'L’électricité est le premier goulot des centres de données ; son prix pèse sur la marge d’Oracle.'],
      ['TLN', 'second_order', 'Producteur d’électricité indépendant', 'Fournisseur d’énergie pour centres de données ; ses contrats indiquent le coût marginal de l’électricité.'],
      ['GEV', 'second_order', 'Turbines et équipements de réseau', 'Les délais d’équipements électriques fixent le calendrier des nouveaux sites.'],
      ['APLD', 'second_order', 'Hébergeur de centres de données IA', 'Même chaîne de construction financée à crédit ; ses conditions de financement signalent l’appétit du marché.'],
      ['META', 'second_order', 'Grand acheteur de capacité IA', 'Son capex mesure la demande des grands consommateurs de calcul ; ce n’est pas un client documenté d’Oracle.']] },
    { name: 'Contrôles sectoriels', order: 2, transmission: 'Paniers de référence pour séparer le mouvement du titre de celui de son secteur.', rows: [
      ['IGV', 'sector_proxy', 'Panier de logiciels américains', 'Mesure le mouvement du logiciel dans son ensemble, indépendamment du financement propre à Oracle.'],
      ['XLK', 'sector_proxy', 'Secteur technologie du S&P', 'Contrôle large de la technologie : un recul commun n’a rien de spécifique à Oracle.'],
      ['SMH', 'sector_proxy', 'Panier de semi-conducteurs', 'Contrôle de l’amont : si les puces montent et Oracle baisse, c’est le financement qui est en cause.']] },
  ],
  eventDefault: { leader: 'Aucune publication dans les quatorze jours collectés ; son capital et ses tarifs restent le signal à suivre', direct_peer: 'Aucune publication dans les quatorze jours collectés ; ses renouvellements et sa valorisation encadrent ceux d’Oracle', upstream: 'Aucune publication dans les quatorze jours collectés ; ses commandes précèdent les ouvertures de sites', second_order: 'Aucune publication dans les quatorze jours collectés ; ses contrats d’énergie et de sites restent à suivre', sector_proxy: 'Panier sans publication propre ; exposé aux résultats de ses grandes pondérations' },
  eventRisk: {
    MU: 'Résultats trimestriels le 30 septembre après la clôture, date corroborée par deux calendriers : dans l’horizon de surveillance et susceptible de bouger les valeurs de l’IA, Oracle compris',
    SMH: 'Panier sans publication propre ; les résultats de Micron du 30 septembre peuvent le faire bouger',
  },
  blastDoc: 1,
  scenarios: c => [
    { scenario: 'bullish', trigger: 'La mise en service des capacités accélère et le flux de trésorerie libre se rapproche de l’équilibre.', firstOrder: 'Les revenus de l’infrastructure cloud rattrapent le capex, le besoin de financement externe recule.', secondOrder: 'Les fournisseurs de puces et d’électricité gardent leur carnet, les néo-clouds se refinancent plus facilement.', confirmation: 'Un trimestre sans nouvelle émission d’actions et un flux libre en amélioration, puis une base au-dessus de ' + c.usd(c.lv('r2')) + '.', contradiction: 'Une nouvelle émission d’actions malgré la croissance des revenus.' },
    { scenario: 'mixed', trigger: 'Les revenus progressent comme prévu mais le capex reste supérieur au flux opérationnel.', firstOrder: 'La croissance est là, la dilution et la dette continuent d’augmenter.', secondOrder: 'L’amont profite, Oracle stagne : l’écart de performance avec les puces se creuse.', confirmation: 'Guidance tenue, flux libre toujours négatif, titre bloqué sous ses moyennes.', contradiction: 'Un flux libre positif plus tôt que prévu.' },
    { scenario: 'bearish', trigger: 'Un grand client ralentit ou les taux longs montent encore, renchérissant le financement.', firstOrder: 'Le carnet se révèle moins liquide, le coût de la dette et des loyers pèse sur la marge ; le titre poursuit vers ' + c.usd(c.lv('s2')) + '.', secondOrder: 'Les néo-clouds et hébergeurs financés à crédit décrochent, l’amont révise ses commandes.', confirmation: 'Une révision de guidance, un contrat renégocié ou une dégradation de la notation de crédit.', contradiction: 'Des livraisons et encaissements conformes malgré la hausse des taux.' }],
  contradictions: c => ['Les résultats sont solides mais le titre a baissé après publication puis a cassé : la corrélation avec les fournisseurs ne suffit pas à expliquer le mouvement.', 'Une corrélation élevée avec un comparable ne prouve pas un lien commercial ; les clients d’Oracle ne sont pas nommés.'],
  missingData: c => ['Quatre valeurs d’électricité et de foncières (deux producteurs d’électricité, un équipementier électrique, une foncière de centres de données) sont écartées : séances manquantes dans la fenêtre de calcul ou géométrie de barre invalide à la collecte.', 'Un néo-cloud coté est écarté pour discontinuité de séances dans son historique récent d’introduction en bourse.', 'Chaîne d’options relevée marché fermé, inexploitable ; sentiment et tendances de recherche indisponibles ; coût d’emprunt indisponible ; prochaine date de résultats d’Oracle non confirmée par l’émetteur.'],
  limitations: ['Fenêtre de corrélation dépendante de l’historique disponible des comparables.', 'Quatre comparables d’énergie ou de foncières et un néo-cloud écartés pour barres manquantes ou géométrie invalide.', 'Options inexploitables, marché fermé ; coût d’emprunt indisponible.'],
});
