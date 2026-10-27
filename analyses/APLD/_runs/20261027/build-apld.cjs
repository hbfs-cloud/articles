'use strict';
// Dossier Applied Digital (APLD) v3 au close du 2026-10-26, refonte complète du 27 octobre 2026 (gabarit R08, modèle FICO).
// Remplace la fiche du 27 septembre 2026 (run 20260927, statut no-trade), archivée dans analyses/APLD/archive/20260927/.
// Exercice décalé, clos le 31 mai. Agrégats GAAP : douze mois glissants au 31 août 2026 lus dans les données XBRL officielles
// de la SEC (companyfacts, 10-Q du 7 octobre 2026 inclus) = exercice clos le 31 mai 2026 + premier trimestre de l'exercice 2027
// − premier trimestre de l'exercice 2026 (retraité des activités cédées dans le 10-Q). EBITDA GAAP négatif : le scénario de
// valorisation s'applique aux revenus. « Dette » du gabarit = billets à long terme + part courante + location-financement
// + parts préférentielles rachetables de MIP HPC Holdings (Macquarie) au niveau de la filiale des centres de calcul, une
// créance qui passe avant l'actionnaire ordinaire et grossit chaque trimestre de dividendes en nature ; trésorerie = liquidités
// non affectées (les 728,0 M$ de trésorerie affectée sont exclus). Actions = 302 387 140 au 6 octobre 2026 (10-Q).
// Barres certifiées Yahoo (plan analyse). Comparables : EQIX, HUT et ETN, d'abord retenus, avaient des séances manquantes
// du 21 au 24 juillet 2026 dans la série du serveur ; remplacés par IRM, GEV et BE plutôt que réparés (aucun RefreshBars).
const R = require('../../../../tools/lib/analysis-v3-r08.cjs');
const S = require('./static-apld.cjs');
const GEN = 'analyses/APLD/_runs/20261027/build-apld.cjs';
const REF = '2026-10-26';
const SHARES = 302387140;

let LAST = null;
const getPath = (o, p) => p.split('.').reduce((n, k) => n == null ? undefined : n[k], o);

R.build({
  ticker: 'APLD', shortName: 'Applied Digital', cik: 1144879, generator: GEN, mode: 'breakout', peers: true, clientBars: true,
  extraInputs: [{ name: 'quote', path: 'analyses/APLD/_data/instrument.json' }],
  ref: REF, run: '20261027', asOf: '2026-10-27',
  xbrl: {
    ttm: {
      rev: ['Revenues'],
      ebit: ['OperatingIncomeLoss'],
      ni: ['NetIncomeLossAvailableToCommonStockholdersBasic'],
      dna: ['DepreciationDepletionAndAmortization'],
      ocf: ['NetCashProvidedByUsedInOperatingActivities'],
      capex: ['PaymentsToAcquireProductiveAssets'],
    },
    instant: {
      notesLong: ['LongTermNotesPayable'],
      notesCur: ['NotesPayableCurrent'],
      flCur: ['FinanceLeaseLiabilityCurrent'],
      flNon: ['FinanceLeaseLiabilityNoncurrent'],
      rnci: ['RedeemableNoncontrollingInterestEquityCarryingAmount'],
      cashEq: ['CashAndCashEquivalentsAtCarryingValue'],
      rcCur: ['RestrictedCashCurrent'],
      rcNon: ['RestrictedCashNoncurrent'],
      equity: ['StockholdersEquity'],
    },
    da: ['dna'], debt: ['notesLong', 'notesCur', 'flCur', 'flNon', 'rnci'], cash: ['cashEq'],
  },
  scenarioBasis: 'revenue', scenarioMultiple: 9.9,
  valuationBasis: 'GAAP douze mois glissants au 31 août 2026 (données XBRL officielles de la SEC) : chiffre d’affaires = exercice clos le 31 mai 2026 + premier trimestre de l’exercice 2027 − premier trimestre de l’exercice 2026 retraité ; EBITDA GAAP négatif, donc multiple appliqué aux revenus ; dette = billets à long terme et part courante, location-financement et parts préférentielles rachetables de MIP HPC Holdings au 31 août 2026 ; trésorerie = liquidités non affectées au 31 août ; 302 387 140 actions au 6 octobre 2026 (10-Q). 9,9 fois les revenus = médiane arrondie de Digital Realty (12,7×) et Iron Mountain (7,1×), statistiques relevées en instantané : Applied Digital payé comme une foncière de centres de données sur ses revenus passés ; ce n’est pas un objectif',
  shares: { value: SHARES, doc: 0 },
  levels: {
    trigger: { d: '2026-10-21', c: 2 },  // plus haut du 21 octobre, sommet du rebond entre les deux plus bas
    stop: { d: '2026-10-21', c: 3 },     // plus bas du 21 octobre, séance qui a fixé ce sommet
    abandon: { d: '2026-10-26', c: 3 },  // plus bas du 26 octobre, plus bas sur un an
    s1: { d: '2026-10-26', c: 3 },       // plus bas sur un an
    s2: { d: '2025-09-11', c: 3 },       // plus bas du 11 septembre 2025, bas de la cassure de septembre 2025
    s3: { d: '2025-09-08', c: 3 },       // plus bas du 8 septembre 2025, dernier creux de l'historique collecté
    r1: { d: '2026-10-22', c: 2 },       // plus haut du 22 octobre, sommet inférieur
    r2: { d: '2026-10-21', c: 2 },       // plus haut du 21 octobre (déclencheur)
    r3: { d: '2026-10-06', c: 2 },       // plus haut du 6 octobre, veille de la publication
    t2: { d: '2026-09-22', c: 2 },       // plus haut du 22 septembre, haut du range de septembre
  },
  supports: ['s1', 's2', 's3'], resistances: ['r1', 'r2', 'r3'],
  targets: ({ lv }) => ({ tp1: lv('r3'), tp2: lv('t2'), range: null }),
  levelsMethod: 'Déclencheur = plus haut du 21 octobre, sommet du rebond entre les plus bas du 16 et du 26 octobre ; stop = plus bas du 21 octobre ; seuil d’abandon = plus bas du 26 octobre, plus bas sur un an ; TP1 = plus haut du 6 octobre, veille de la publication du premier trimestre ; TP2 = plus haut du 22 septembre ; plafond d’achat = (TP1 + 1,5 × stop) / 2,5 arrondi au cent inférieur ; pourcentages depuis l’entrée ; R/R = gain / risque.',
  inventory: 60,
  reviewScope: 'Dépôts EDGAR d’Applied Digital Corporation (CIK 1144879) du 27 octobre 2025 au 26 octobre 2026 : 60 formulaires hors déclarations d’initiés et avis de vente 144 (trois 10-Q, le 10-K de l’exercice clos le 31 mai 2026, 29 8-K et trois 8-K/A, la circulaire et deux documents complémentaires, le rapport annuel, deux POSASR, un S-3ASR, un S-3, un 424B3, un S-8 et quatorze déclarations de détention 13D/13G, dont les 13D déposées par Applied Digital sur sa filiale ChronoScale). Vérification par type : aucune émission primaire ni supplément 424B5 sur la période ; l’étagère automatique universelle du 3 juin 2025, hors période, reste ouverte sans plafond ; les S-3ASR, S-3 et POSASR de la période ouvrent à la revente des actions de bons et de conversion de série G. Quatorze pièces ouvertes et relues : le 10-Q et le communiqué du premier trimestre de l’exercice 2027, le 10-K de l’exercice 2026, le POSASR du 25 septembre, la circulaire de l’assemblée du 4 novembre, le S-3ASR du 31 octobre 2025, le S-3 du 5 décembre 2025, trois formulaires 4 d’octobre 2026, et hors période l’étagère universelle du 3 juin 2025, les S-3ASR du 27 juin et du 26 septembre 2025 (porteurs des bons liés aux baux CoreWeave) et le formulaire 4 de vente du directeur général du 16 janvier 2026. Les 45 formulaires 4 de l’année ont été téléchargés et recomptés (analyses/APLD/_primary/form4/, registre dans revision/form4-ledger.json).',
  docs: S.docs,
  needles: S.needles,
  route: (p, { prov, dep, B, N, lvPtr, TXP }) => {
    if (p.startsWith('archiveHistory.')) return prov('status', '/captured_at', 'Versions précédentes de la fiche, conservées dans analyses/APLD/archive/ ; dates éditoriales, pas des observations de marché.');
    if (p.startsWith('insiders.')) return prov('primary', '/documents/5', 'Achats et ventes lus dans les formulaires 4 primaires (président et directeur général en octobre 2026, administrateur le 13 octobre, directeur général le 16 janvier 2026) ; cumul annuel des ventes et achats en Bourse recompté sur les 45 formulaires 4 de l’année téléchargés depuis EDGAR (revision/form4-ledger.json).', [dep('primary', '/documents/6'), dep('primary', '/documents/7'), dep('primary', '/documents/13'), dep('insiders', TXP == null ? '' : TXP + '/transactions')]);
    if (p.startsWith('shortInterest.')) return prov('quote', '/data/items/18', 'Positions vendeuses au règlement FINRA du 15 octobre 2026 et jours de couverture FINRA ; flottant et relevé précédent du snapshot statistique.', [dep('fund', '/data/items/0/results/2/data/0')]);
    if (/^blastRadius\.groups\.\d+\.symbols\.\d+\.eventRisk$/.test(p) && /^(CRWV|NBIS|NVDA|META|ORCL|BE) /.test((getPath(LAST, p.replace(/eventRisk$/, 'ticker')) || '') + ' ')) return prov('earn', '/events', 'Calendrier de résultats relevé le 27 octobre 2026 sur trente jours pour CRWV, NBIS, NVDA, ORCL, META et BE (revision/calendar-20261027.json, une seule source par date) : le calendrier collecté du plan ne couvre que quatorze jours.');
    if (p.startsWith('timeline.')) return prov('earn', '/events', 'Dates des comparables au calendrier de résultats collecté (une seule source sauf mention), complété par le relevé du 27 octobre 2026 sur trente jours pour Nebius, CoreWeave et Nvidia (revision/calendar-20261027.json) ; assemblée lue dans la circulaire DEF 14A ; rendez-vous macro aux calendriers officiels (data/scheduled-events.json, calendrier du BLS) ; date de résultats d’Applied Digital au bloc calendrier de l’instrument, non confirmée ; fin du plan fixée par la fiche.', [dep('primary', '/documents/4'), dep('quote', '/data/items/4')]);
    if (p.startsWith('reviewPanel.')) return prov('bars', B, 'Relectures indépendantes de la fiche ; chaque chiffre est repris de la section qu’il commente.', [dep('primary', '/documents/0')]);
    if (p.startsWith('tribunal.')) return prov('bars', B, 'Tribunal de la fiche : chaque chiffre plaidé est calculé dans le générateur depuis la section qui le prouve (barres certifiées, dépôts SEC, agrégats GAAP, multiples collectés, formulaires 4).', [dep('primary', '/documents/0'), dep('primary', '/documents/1'), dep('primary', '/documents/5')]);
    if (p.startsWith('bottomEstimation.')) return prov('bars', B, 'Planchers techniques lus sur les barres certifiées (plus bas du 26 octobre 2026, du 11 et du 8 septembre 2025) ; plancher de valeur = médiane de l’EV/revenus de Digital Realty et Iron Mountain (statistiques collectées) × revenus GAAP douze mois − dette et parts préférentielles + trésorerie, divisé par le nombre d’actions du 10-Q.', [dep('bars', lvPtr('s1')), dep('bars', lvPtr('s2')), dep('bars', lvPtr('s3')), dep('primary', '/documents/0'), dep('primary', '/documents/1')]);
    const v = getPath(LAST, p); if (typeof v !== 'string') return null;
    if (/^news\./.test(p)) return prov('bars', B, 'Variations de clôture à clôture lues sur les barres certifiées et comparées aux pairs sur la même séance ; faits de la société lus dans ses dépôts ; causes sectorielles attribuées à la presse citée, pas déduites des cours.', [dep('comparison', ''), dep('primary', '/documents/1'), dep('primary', '/documents/5')]);
    return null;
  },
  sectionDocs: { verdict: [1, 0, 2, 3, 5, 13], business: [1, 0, 2, 3], news: [1, 0, 5, 6], earnings: [1, 0, 2], capitalStructure: [0, 2, 3, 10, 11, 12, 8, 9], filingsReview: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], risks: [0, 1, 2, 3, 10], globalScore: [1, 0, 13], meta: [1], disclaimer: [1], macro: [1], options: [1], social: [1], header: [0], technicals: [1], performance: [1], tradeIdea: [0, 1, 3, 10], bottomEstimation: [0] },
  score: { business: 18, technical: -16, capital: -16, calendar: -2, dilution: -12, risk: 60 },
  riskScoreReason: 'Jugement qualitatif sur dix : un carnet de baux longs signés avec CoreWeave et un ou deux grands clouds de qualité investissement, mais des loyers encore à construire ; 6,7 Md$ de dette en principal et 2,0 Md$ de parts préférentielles de Macquarie à 12,75 % capitalisés ; un financement qui coûte plus que les loyers de base ; une dilution à plusieurs robinets (835 M$ de série G à tirer sous le cours, convertibles et bons dans la monnaie, plans de rémunération, étagère universelle sans plafond) ; des initiés vendeurs nets sur un an ; un bêta proche de six et un quart du flottant vendu à découvert ; un secteur dont le financement se ferme selon la presse. Pas de résultats avant le 6 janvier 2027 (date non confirmée).',
  compose: c => require('./compose-apld.cjs')(c, x => { LAST = x; return x; }),
  groups: S.groups,
  eventDefault: { leader: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; son multiple reste le repère des bailleurs stabilisés', direct_peer: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; ses annonces de financement restent le signal à suivre', upstream: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', downstream: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; son accès au crédit reste le signal à suivre', second_order: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', sector_proxy: 'Panier sans publication propre ; exposé aux résultats de ses grandes pondérations' },
  eventRisk: {
    GLXY: 'Résultats le 27 octobre avant l’ouverture (deux sources) : premier pair à parler de financement après la chute du secteur',
    VRT: 'Résultats annoncés le 28 octobre (une seule source) ; lecture sur la demande d’équipement des campus',
    GEV: 'Résultats annoncés le 28 octobre (une seule source) ; lecture sur la demande d’énergie des centres de données',
    MSFT: 'Résultats annoncés le 28 octobre (une seule source) : ses dépenses d’investissement disent si la demande de baux longs tient',
    DLR: 'Résultats annoncés le 29 octobre (une seule source) ; lecture sur les loyers et le coût du financement des bailleurs',
    CIFR: 'Résultats annoncés le 2 novembre (une seule source) : premier constructeur endetté à publier après sa propre émission de convertibles',
    MARA: 'Résultats annoncés le 4 novembre (une seule source) ; lecture sur l’appétit pour les titres à fort bêta',
    IRM: 'Résultats annoncés le 5 novembre (une seule source) ; lecture sur la demande de centres de données',
    CORZ: 'Résultats annoncés le 5 novembre (une seule source) ; lecture sur le financement des hébergeurs de calcul',
    IREN: 'Résultats annoncés le 5 novembre (une seule source) ; lecture sur le financement des nouveaux campus',
    WULF: 'Résultats annoncés le 6 novembre (une seule source) ; lecture sur la dette de projet des hébergeurs',
    NBIS: 'Résultats annoncés le 10 novembre (une seule source, relevé du 27 octobre) : premier néocloud à parler de son accès au crédit',
    CRWV: 'Résultats annoncés le 11 novembre (une seule source, relevé du 27 octobre) : le premier locataire d’Applied Digital publie dans la fenêtre d’achat',
    NVDA: 'Résultats annoncés le 17 novembre (une seule source, relevé du 27 octobre), hors frise mais dans la durée de détention possible',
    META: 'Aucune date de résultats dans les trente jours relevés le 27 octobre ; ses dépenses de calcul restent le signal à suivre',
    ORCL: 'Aucune date de résultats dans les trente jours relevés le 27 octobre ; son accès au financement reste le signal à suivre',
    BE: 'Aucune date de résultats dans les trente jours relevés le 27 octobre',
  },
  blastDoc: 1,
  scenarios: c => require('./compose-apld.cjs').scenarios(c),
  contradictions: c => require('./compose-apld.cjs').contradictions(c),
  missingData: c => require('./compose-apld.cjs').missingData(c),
  limitations: ['Agrégats GAAP au 31 août 2026 ; le deuxième trimestre de l’exercice 2027, clos le 30 novembre, n’est pas encore publié.', 'Comparables EQIX, HUT et ETN écartés pour séances manquantes du 21 au 24 juillet 2026 dans la série du serveur ; remplacés par IRM, GEV et BE.', 'Multiples des pairs issus des statistiques courantes, relevées en instantané, sans historique daté.', 'Causes sectorielles de la chute d’octobre (émission de Cipher, déclarations d’Elon Musk sur le crédit aux néoclouds) connues par la presse citée, pas par un dépôt de la société.', 'Chaîne d’options relevée avant l’ouverture du 27 octobre avec un intérêt ouvert nul : aucune donnée d’options retenue.', 'Dette inscrite (nette de 345,0 M$ de frais d’émission) dans la valeur d’entreprise du gabarit ; la variante au principal, avec les préférentielles E-1, est donnée dans le texte.', 'Dates de résultats de Nebius, CoreWeave et Nvidia relevées hors plan le 27 octobre (revision/calendar-20261027.json), une seule source.'],
});
