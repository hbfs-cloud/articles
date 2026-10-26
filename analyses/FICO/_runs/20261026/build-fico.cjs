'use strict';
// Dossier Fair Isaac (FICO) v3 au close du 2026-10-26, première fiche du site, construite le 26 octobre 2026 (gabarit R08).
// Agrégats GAAP : douze mois glissants au 30 juin 2026 lus dans les données XBRL officielles de la SEC (companyfacts,
// 10-Q du 29 juillet inclus) = exercice clos le 30 septembre 2025 + neuf mois de l'exercice 2026 − neuf mois de 2025.
// Dette = dette totale publiée (LongTermDebt, part courante incluse : 5 582 389 k$ au 30 juin 2026) ; trésorerie =
// liquidités. Capitaux propres négatifs (déficit de 4,1 Md$) : rachats d'actions cumulés supérieurs aux bénéfices
// conservés, pas une perte. Actions = 21 597 635 au 17 juillet 2026 (couverture du 10-Q) ; le solde du rachat accéléré,
// attendu au quatrième trimestre, réduira encore ce nombre.
// Barres certifiées Yahoo (plan analyse). La série du serveur manquait la séance du 24 juillet 2026 pour FICO et la source
// Tiingo était en pause côté serveur : reconstruction ciblée de FICO seul (RefreshBars, jeton de portée refresh, effacé
// après usage) le 26 octobre à 20 h 59 UTC, puis contrôle de la séance du 24 juillet avant la collecte.
const R = require('../../../../tools/lib/analysis-v3-r08.cjs');
const S = require('./static-fico.cjs');
const GEN = 'analyses/FICO/_runs/20261026/build-fico.cjs';
const REF = '2026-10-26';
const SHARES = 21597635;

let LAST = null;
const getPath = (o, p) => p.split('.').reduce((n, k) => n == null ? undefined : n[k], o);

R.build({
  ticker: 'FICO', shortName: 'Fair Isaac', cik: 814547, generator: GEN, mode: 'breakout', peers: true,
  extraInputs: [{ name: 'quote', path: 'analyses/FICO/_data/instrument.json' }],
  ref: REF, run: '20261026', asOf: '2026-10-26',
  xbrl: {
    ttm: {
      rev: ['RevenueFromContractWithCustomerExcludingAssessedTax'],
      ebit: ['OperatingIncomeLoss'],
      ni: ['NetIncomeLoss'],
      dna: ['DepreciationDepletionAndAmortization'],
      ocf: ['NetCashProvidedByUsedInOperatingActivities'],
      capex: ['PaymentsToAcquirePropertyPlantAndEquipment'],
    },
    instant: {
      debtTotal: ['LongTermDebt'],
      cashEq: ['CashAndCashEquivalentsAtCarryingValue'],
      equity: ['StockholdersEquity'],
    },
    da: ['dna'], debt: ['debtTotal'], cash: ['cashEq'],
  },
  scenarioBasis: 'ebitda', scenarioMultiple: 12.9,
  valuationBasis: 'GAAP douze mois glissants au 30 juin 2026 (données XBRL officielles de la SEC) : chiffre d’affaires, résultat opérationnel, amortissements et bénéfice net = exercice clos le 30 septembre 2025 + neuf mois de l’exercice 2026 − neuf mois de l’exercice 2025 ; EBITDA = résultat opérationnel + dépréciations et amortissements ; dette = dette totale publiée au 30 juin 2026 (obligations, prêt à terme et ligne de crédit, part courante incluse) ; trésorerie = liquidités au 30 juin ; 21 597 635 actions au 17 juillet 2026 (10-Q). 12,9 fois l’EBITDA = médiane d’Equifax (12,7×) et TransUnion (13,1×) arrondie, statistiques relevées en instantané : FICO payé comme les bureaux qui le concurrencent, sur des profits inchangés ; ce n’est pas un objectif',
  shares: { value: SHARES, doc: 0 },
  levels: {
    trigger: { d: '2026-10-26', c: 2 },  // plus haut du 26 octobre, séance de l'annonce du prix gelé
    stop: { d: '2026-10-26', c: 3 },     // plus bas du 26 octobre
    abandon: { d: '2026-09-30', c: 3 },  // plus bas du 30 septembre, plus bas sur un an
    s1: { d: '2026-10-26', c: 3 }, s2: { d: '2026-09-30', c: 3 },
    r1: { d: '2026-10-22', c: 2 },       // plus haut du 22 octobre, sommet de la reprise d'octobre
    r2: { d: '2026-09-09', c: 2 },       // plus haut du 9 septembre, rebond qui a suivi la première décision
    r3: { d: '2026-09-03', c: 4 },       // clôture du 3 septembre, haut du trou du 4
  },
  supports: ['s1', 's2'], resistances: ['r1', 'r2', 'r3'],
  targets: ({ lv }) => ({ tp1: lv('r2'), tp2: lv('r3'), range: null }),
  levelsMethod: 'Déclencheur = plus haut du 26 octobre, séance de l’annonce du prix gelé ; stop = plus bas du 26 octobre ; seuil d’abandon = plus bas du 30 septembre, plus bas sur un an ; TP1 = plus haut du 9 septembre ; TP2 = clôture du 3 septembre, haut du trou du 4 ; plafond d’achat = (TP1 + 1,5 × stop) / 2,5 arrondi au cent inférieur ; pourcentages depuis l’entrée ; R/R = gain / risque.',
  inventory: 23,
  reviewScope: 'Dépôts EDGAR de Fair Isaac Corporation (CIK 814547) du 24 octobre 2025 au 26 octobre 2026 : 23 formulaires hors déclarations d’initiés et avis de vente 144 (le 10-K de l’exercice 2025, trois 10-Q, neuf 8-K, la circulaire et l’avis préliminaire de l’assemblée, le rapport annuel aux actionnaires et sept déclarations de détention 13G). Sept pièces décisionnelles ouvertes et hachées : le 10-Q et le communiqué du troisième trimestre, le 8-K de restructuration du 6 octobre, le communiqué du rachat accéléré du 8 juin, le 10-K de l’exercice 2025, le communiqué d’émission obligataire du 11 mars et le communiqué du quatrième trimestre 2025.',
  docs: S.docs,
  needles: S.needles,
  route: (p, { prov, dep, B, N, lvPtr, TXP }) => {
    // Planchers : techniques sur les barres certifiées, de valeur sur les agrégats GAAP et les multiples collectés.
    // Options : la chaîne collectée est une source facultative, non certifiée ; seul le mouvement implicite du calendrier
    // de résultats (source exigée) est publié.
    if (p.startsWith('options.')) return prov('earn', '/events/0', 'Mouvement implicite aux résultats = straddle à parité de la première échéance qui couvre la publication / cours, relevé dans le calendrier de résultats collecté après la clôture du 26 octobre.');
    if (p.startsWith('insiders.')) return prov('insiders', TXP == null ? '' : TXP + '/coverage_status', 'Relevé officiel des formulaires 4 sur 365 jours : couverture incomplète (data_insufficient), aucun solde net affirmé.');
    if (p.startsWith('reviewPanel.')) return prov('bars', B, 'Relectures indépendantes de la fiche ; chaque chiffre est repris de la section qu’il commente, elle-même prouvée (barres certifiées, dépôts SEC, multiples collectés).', [dep('primary', '/documents/0')]);
    if (p.startsWith('bottomEstimation.')) return prov('bars', B, 'Planchers techniques lus sur les barres certifiées (plus bas du 26 octobre et du 30 septembre) ; plancher de valeur = médiane de l’EV/EBITDA d’Equifax et TransUnion (statistiques collectées) × EBITDA GAAP douze mois − dette + trésorerie, divisé par le nombre d’actions du 10-Q.', [dep('bars', lvPtr('s1')), dep('bars', lvPtr('s2')), dep('primary', '/documents/0')]);
    const v = getPath(LAST, p); if (typeof v !== 'string') return null;
    // Annonce de prix et décisions du régulateur : presse financière citée, réaction lue sur les barres certifiées.
    if (/^news\.[023]\./.test(p)) return prov('bars', B, 'Variation de clôture à clôture lue sur les barres certifiées et comparée aux bureaux de crédit et aux prêteurs sur la même séance ; cause attribuée à la presse financière citée, pas déduite des cours.', [dep('comparison', '')]);
    return null;
  },
  sectionDocs: { verdict: [1, 0, 4, 2], business: [4, 1, 0], news: [2, 1, 3], earnings: [1, 6, 0], capitalStructure: [0, 3, 5], filingsReview: [0, 1, 2, 3, 4, 5, 6], risks: [0, 4, 1, 3], globalScore: [1], meta: [1], disclaimer: [1], macro: [1], options: [1], social: [1], header: [0], shortInterest: [0], insiders: [0], technicals: [1], performance: [1], timeline: [6, 1], reviewPanel: [0], bottomEstimation: [0] },
  score: { business: 20, technical: -14, capital: -8, calendar: -6, dilution: 0, risk: 50 },
  riskScoreReason: 'Jugement qualitatif sur dix : une entreprise très rentable dont la ligne la plus profitable, le score du crédit immobilier, vient de perdre sa protection réglementaire (VantageScore admis le 4 septembre, grille de prix unique annoncée le 29) ; une croissance récente faite surtout de hausses de prix sur ce même score, que la société a gelé le 26 octobre ; un régulateur qui annonce de nouvelles mesures pour la semaine ; 63 % du chiffre d’affaires du trimestre réalisés avec trois bureaux de crédit qui possèdent le concurrent ; 5,6 Md$ de dette et des capitaux propres négatifs après 3,1 Md$ de rachats en neuf mois ; résultats annuels attendus début novembre, date non confirmée.',
  compose: c => require('./compose-fico.cjs')(c, x => { LAST = x; return x; }),
  groups: S.groups,
  eventDefault: { leader: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; sa valorisation reste le repère des péages de données', direct_peer: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; ses prix de VantageScore restent le signal à suivre', upstream: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', downstream: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', second_order: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', sector_proxy: 'Panier sans publication propre ; exposé aux résultats de ses grandes pondérations' },
  eventRisk: { TRU: 'Résultats annoncés le 27 octobre (une seule source) : premier propriétaire de VantageScore à s’exprimer après le prix gelé de FICO', SPGI: 'Résultats annoncés le 27 octobre (une seule source) ; lecture sur la valorisation des péages de données', TYL: 'Résultats annoncés le 28 octobre (une seule source) ; lecture sur les logiciels à revenus récurrents', RKT: 'Résultats annoncés le 29 octobre (une seule source) : premier prêteur à avoir choisi VantageScore, il dira ce que ce choix change', PFSI: 'Résultats annoncés le 29 octobre (une seule source) ; volumes de crédits immobiliers', VRSK: 'Résultats annoncés le 5 novembre (une seule source)', UWMC: 'Résultats annoncés le 5 novembre (une seule source) ; volumes de crédits immobiliers de gros' },
  blastDoc: 4,
  scenarios: c => require('./compose-fico.cjs').scenarios(c),
  contradictions: c => require('./compose-fico.cjs').contradictions(c),
  missingData: c => require('./compose-fico.cjs').missingData(c),
  limitations: ['Agrégats GAAP au 30 juin 2026 ; le quatrième trimestre de l’exercice, clos le 30 septembre, n’est pas encore publié.', 'Série Yahoo de FICO reconstruite côté serveur le 26 octobre (séance du 24 juillet manquante auparavant), contrôlée avant la collecte.', 'Multiples des pairs issus des statistiques courantes, relevées en instantané, sans historique daté.', 'Décisions du régulateur du logement et réactions des prêteurs connues par la presse financière citée, pas par un dépôt de la société.'],
});
