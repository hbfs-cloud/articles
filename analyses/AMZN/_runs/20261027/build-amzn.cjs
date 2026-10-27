'use strict';
// Dossier Amazon (AMZN) v3 au close du 2026-10-26, refonte complète du 27 octobre 2026 (gabarit R08, fiche FICO comme
// modèle). La fiche précédente (12 septembre 2026, plan arrêté au stop le 16 septembre) est archivée dans
// analyses/AMZN/archive/20261027/ et son JSON dans original/AMZN.json.
// Dette de la valeur d'entreprise = dette à long terme + dettes de location (l'EBITDA d'Amazon réintègre l'amortissement
// des actifs loués : sans les loyers, le multiple serait sous-estimé, relevé de la revue contradictoire du 27 octobre).
// Agrégats GAAP : douze mois glissants au 30 juin 2026 lus dans les données XBRL officielles de la SEC (companyfacts,
// 10-Q du 31 juillet inclus) = exercice 2025 + premier semestre 2026 − premier semestre 2025. Dette = valeur nominale
// de la dette à long terme publiée (LongTermDebt, part courante incluse : 132 995 M$ au 30 juin 2026) ; trésorerie =
// liquidités + titres négociables à court terme (78 213 M$ + 44 775 M$). Les émissions obligataires de juillet
// (24,9 Md$) et de septembre (4,2 Md£) sont postérieures au bilan : elles ne sont pas dans la dette, ni leur produit
// dans la trésorerie. Actions = 10 786 313 572 au 22 juillet 2026 (couverture du 10-Q).
// Barres certifiées Yahoo (plan analyse). Le magasin du serveur manquait les séances du 21 et du 24 juillet 2026 pour
// FDX et XLY (même trou que pour FICO) : reconstruction ciblée de ces deux symboles seuls (RefreshBars, jeton de portée
// refresh, effacé après usage) le 27 octobre vers 10 h 16 UTC, puis nouvelle collecte complète.
const R = require('../../../../tools/lib/analysis-v3-r08.cjs');
const S = require('./static-amzn.cjs');
const GEN = 'analyses/AMZN/_runs/20261027/build-amzn.cjs';
const REF = '2026-10-26';
const SHARES = 10786313572;

let LAST = null;
const getPath = (o, p) => p.split('.').reduce((n, k) => n == null ? undefined : n[k], o);

R.build({
  ticker: 'AMZN', shortName: 'Amazon', cik: 1018724, generator: GEN, mode: 'breakout', peers: true,
  extraInputs: [{ name: 'quote', path: 'analyses/AMZN/_data/instrument.json' }],
  ref: REF, run: '20261027', asOf: '2026-10-27',
  xbrl: {
    ttm: {
      rev: ['RevenueFromContractWithCustomerExcludingAssessedTax'],
      ebit: ['OperatingIncomeLoss'],
      ni: ['NetIncomeLoss'],
      dna: ['DepreciationDepletionAndAmortization'],
      ocf: ['NetCashProvidedByUsedInOperatingActivities'],
      capex: ['PaymentsToAcquireProductiveAssets'],
      nonop: ['NonoperatingIncomeExpense'],
      tax: ['IncomeTaxExpenseBenefit'],
    },
    instant: {
      debtTotal: ['LongTermDebt'],
      cashEq: ['CashAndCashEquivalentsAtCarryingValue'],
      mktSec: ['MarketableSecuritiesCurrent'],
      leaseOp: ['OperatingLeaseLiability'],
      leaseFin: ['FinanceLeaseLiability'],
      equity: ['StockholdersEquity'],
    },
    da: ['dna'], debt: ['debtTotal', 'leaseOp', 'leaseFin'], cash: ['cashEq', 'mktSec'],
  },
  scenarioBasis: 'ebitda', scenarioMultiple: 15.1,
  valuationBasis: 'GAAP douze mois glissants au 30 juin 2026 (données XBRL officielles de la SEC) : chiffre d’affaires, résultat opérationnel, amortissements et bénéfice net = exercice 2025 + premier semestre 2026 − premier semestre 2025 ; EBITDA = résultat opérationnel + dépréciations et amortissements ; dette = valeur nominale de la dette à long terme au 30 juin 2026, part courante incluse, plus les dettes de location simple et de location-financement (96 320 M$ + 13 451 M$), parce que l’EBITDA réintègre l’amortissement des droits d’utilisation ; trésorerie = liquidités et titres négociables à court terme au 30 juin ; 10 786 313 572 actions au 22 juillet 2026 (10-Q). 15,1 fois l’EBITDA = multiple d’Oracle arrondi, le plus bas des grands du cloud dans les statistiques relevées en instantané : Amazon payée comme le moins cher de ses concurrents d’infrastructure, sur des profits inchangés ; ce n’est pas un objectif',
  shares: { value: SHARES, doc: 0 },
  levels: {
    trigger: { d: '2026-10-20', c: 2 }, // plus haut du 20 octobre, sommet du couloir de septembre-octobre
    stop: { d: '2026-10-21', c: 3 },    // plus bas du 21 octobre : retour dans le couloir = cassure ratée
    abandon: { d: '2026-09-16', c: 3 }, // plus bas du 16 septembre, plancher du couloir
    s1: { d: '2026-10-23', c: 3 }, s2: { d: '2026-09-16', c: 3 }, s3: { d: '2026-07-29', c: 3 },
    r1: { d: '2026-10-20', c: 2 },      // plus haut du 20 octobre
    r2: { d: '2026-08-10', c: 2 },      // plus haut du 10 août, dernier rebond avant la décrue d'août
    r3: { d: '2026-08-03', c: 2 },      // plus haut du 3 août, plus haut sur un an
  },
  supports: ['s1', 's2', 's3'], resistances: ['r1', 'r2', 'r3'],
  targets: ({ lv }) => ({ tp1: lv('r2'), tp2: lv('r3'), range: null }),
  levelsMethod: 'Déclencheur = plus haut du 20 octobre, sommet du couloir de septembre-octobre ; stop = plus bas du 21 octobre ; seuil d’abandon = plus bas du 16 septembre, plancher du couloir ; TP1 = plus haut du 10 août ; TP2 = plus haut du 3 août, plus haut sur un an ; plafond d’achat = (TP1 + 1,5 × stop) / 2,5 arrondi au cent inférieur ; pourcentages depuis l’entrée ; R/R = gain / risque.',
  inventory: 63,
  reviewScope: 'Dépôts EDGAR d’Amazon.com, Inc. (CIK 1018724) du 27 octobre 2025 au 26 octobre 2026 : 63 formulaires hors déclarations d’initiés et avis de vente 144 (le 10-K de l’exercice 2025, trois 10-Q, seize 8-K, douze suppléments de prospectus obligataires 424B5, la déclaration S-3ASR, le S-4 et le 424B3 de Globalstar, la circulaire, des déclarations de détention). Onze pièces décisionnelles de l’émetteur ouvertes et hachées, plus le prospectus S-1 d’Anthropic du 26 octobre 2026 (CIK 2130357), qui chiffre l’engagement de dépenses d’Anthropic chez Amazon.',
  docs: S.docs,
  needles: S.needles,
  route: (p, { prov, dep, B, N, lvPtr, TXP }) => {
    // Options : la chaîne collectée est une source facultative, non certifiée ; seul le mouvement implicite du calendrier
    // de résultats (source exigée) est retenu, quand il était disponible à la collecte.
    if (p.startsWith('options.')) return prov('erisk', '/events/0', 'Mouvement implicite aux résultats = straddle à parité de la première échéance qui couvre la publication / cours, relevé dans le calendrier de résultats collecté ; null si le marché des options était fermé à la collecte.');
    if (p.startsWith('insiders.')) return prov('insiders', TXP == null ? '' : TXP + '/coverage_status', 'Relevé officiel des formulaires 4 sur 365 jours : couverture incomplète (data_insufficient), aucun solde net affirmé.');
    if (p.startsWith('tribunal.')) return prov('bars', B, 'Tribunal de la fiche : chaque chiffre plaidé est repris de la section qui le prouve (barres certifiées, dépôts SEC, agrégats GAAP, multiples collectés).', [dep('primary', '/documents/0'), dep('primary', '/documents/1')]);
    if (p.startsWith('bottomEstimation.')) return prov('bars', B, 'Planchers techniques lus sur les barres certifiées (plus bas du 16 septembre et du 29 juillet) ; plancher de valeur = multiple d’Oracle (statistiques collectées) × EBITDA GAAP douze mois, réduit selon l’hypothèse écrite, − dette + trésorerie, divisé par le nombre d’actions du 10-Q.', [dep('bars', lvPtr('s2')), dep('bars', lvPtr('s3')), dep('primary', '/documents/0')]);
    const v = getPath(LAST, p); if (typeof v !== 'string') return null;
    // Mouvements de séance cités dans les nouvelles : barres certifiées d'Amazon et des comparables ; causes attribuées
    // à la presse ou aux dépôts cités.
    if (/^news\.\d+\./.test(p)) return prov('bars', B, 'Variations de clôture à clôture lues sur les barres certifiées d’Amazon et des comparables sur la même séance ; cause attribuée au dépôt ou à la presse cités, pas déduite des cours.', [dep('comparison', ''), dep('primary', '/documents/11')]);
    return null;
  },
  sectionDocs: { verdict: [1, 0, 8, 11], business: [1, 0, 2], news: [1, 11, 0], earnings: [1, 8, 9], capitalStructure: [0, 3, 4, 5, 6, 7], filingsReview: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], risks: [0, 1, 11, 4], globalScore: [1, 0], meta: [1], disclaimer: [1], macro: [1], options: [1], social: [1], header: [0], shortInterest: [0], insiders: [0], technicals: [1], performance: [1], timeline: [1, 9], bottomEstimation: [0] },
  score: { business: 24, technical: -8, capital: -6, calendar: -6, dilution: 0, risk: 50 },
  riskScoreReason: 'Jugement qualitatif sur dix : une entreprise très rentable dont le cloud accélère (+37 % au deuxième trimestre) ; mais un bénéfice net dont près de la moitié, avant impôt, vient sur douze mois de réévaluations non monétaires d’Anthropic ; un flux de trésorerie libre négatif après 173,0 Md$ d’investissements sur douze mois ; une dette à long terme doublée en six mois puis gonflée de deux émissions ; 240 Md$ placés dans deux laboratoires d’IA qui sont aussi parmi les plus gros clients d’AWS ; résultats le 29 octobre et introduction en Bourse d’Anthropic sans date.',
  compose: c => require('./compose-amzn.cjs')(c, x => { LAST = x; return x; }),
  groups: S.groups,
  eventDefault: { leader: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; ses annonces de capacité restent un repère pour AWS', direct_peer: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', upstream: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; les dépenses annoncées par Amazon le 29 octobre se transmettent à lui', downstream: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', second_order: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', sector_proxy: 'Panier sans publication propre ; exposé aux résultats de ses grandes pondérations, dont Amazon' },
  eventRisk: {
    MSFT: 'Résultats annoncés le 28 octobre (une seule source) : la croissance d’Azure, la veille de celle d’AWS',
    GOOGL: 'Résultats annoncés le 28 octobre (une seule source) : Google Cloud et la participation dans Anthropic',
    META: 'Aucune date de résultats relevée par le calendrier collecté ; ses annonces de dépenses d’IA pèsent sur tout le groupe',
    EBAY: 'Résultats annoncés le 28 octobre (une seule source) ; lecture sur le commerce en ligne américain',
    VRT: 'Résultats annoncés le 28 octobre (une seule source) ; lecture sur les chantiers de centres de données',
    UPS: 'Résultats annoncés le 27 octobre (une seule source) ; volumes de colis',
    FDX: 'Une seule source de calendrier annonce une publication le 28 octobre, à confirmer par la société',
    SHOP: 'Résultats annoncés le 3 novembre (une seule source) ; volumes des commerçants indépendants',
    ANET: 'Résultats annoncés le 3 novembre (une seule source) ; commandes de réseau des grands clouds',
    MELI: 'Résultats annoncés le 4 novembre (une seule source) ; commerce en ligne en Amérique latine',
    TTD: 'Résultats annoncés le 5 novembre (une seule source) ; budgets publicitaires programmatiques',
  },
  blastDoc: 1,
  scenarios: c => require('./compose-amzn.cjs').scenarios(c),
  contradictions: c => require('./compose-amzn.cjs').contradictions(c),
  missingData: c => require('./compose-amzn.cjs').missingData(c),
  limitations: ['Agrégats GAAP au 30 juin 2026 ; le troisième trimestre, clos le 30 septembre, est publié le 29 octobre après la clôture.', 'Dette et trésorerie au 30 juin : les émissions obligataires de juillet et septembre et un éventuel tirage du prêt de 17,5 Md$ n’y figurent pas.', 'Séries Yahoo de FDX et XLY reconstruites côté serveur le 27 octobre (séances du 21 et du 24 juillet manquantes auparavant), contrôlées par la nouvelle collecte.', 'Multiples des pairs issus des statistiques courantes, relevées en instantané, sans historique daté ; leur définition de la dette n’est pas vérifiée ligne à ligne.', 'Valeur d’Anthropic dans les comptes d’Amazon lue au 30 juin ; le prospectus du 26 octobre ne donne pas encore de prix d’introduction.'],
});
