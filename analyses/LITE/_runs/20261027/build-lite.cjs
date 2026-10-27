'use strict';
// Dossier Lumentum (LITE) v3 au close du 2026-10-26, refonte complète au gabarit du 27 octobre 2026 (FICO = référence).
// La fiche du 25 septembre (run 20260927, statut aucun ordre) est archivée dans analyses/LITE/archive/20260925/.
// Agrégats GAAP : l'exercice 2026 s'est clos le 27 juin 2026 et le 10-K a été déposé le 17 août ; aucun 10-Q
// postérieur à la clôture de référence, donc douze mois glissants = exercice 2026 complet (données XBRL officielles).
// Dette = part courante + non courante des emprunts au 27 juin 2026 (obligations convertibles pour 1 544,6 M$ de valeur
// comptable, prêts japonais pour 92,8 M$) ; trésorerie = liquidités + placements à court terme.
// Actions = 93 459 271 (circulaire du 6 octobre 2026, date d'enregistrement du 24 septembre) : 90 582 856 actions
// ordinaires + 2 876 415 actions de préférence Série A détenues par NVIDIA, converties une pour une et traitées comme des
// actions ordinaires pour le résultat par action (10-K). Les obligations convertibles encore en circulation ne sont pas
// dans ce nombre : leur dilution au cours du jour est calculée à part dans compose-lite-body.cjs.
// Barres certifiées Yahoo (plan analyse) ; aucune barre manquante à la collecte, aucun rechargement ciblé.
const R = require('../../../../tools/lib/analysis-v3-r08.cjs');
const S = require('./static-lite.cjs');
const GEN = 'analyses/LITE/_runs/20261027/build-lite.cjs';
const REF = '2026-10-26';
const SHARES = 93459271;

let LAST = null;
const getPath = (o, p) => p.split('.').reduce((n, k) => n == null ? undefined : n[k], o);

R.build({
  ticker: 'LITE', shortName: 'Lumentum', cik: 1633978, generator: GEN, mode: 'breakout', peers: true,
  extraInputs: [{ name: 'quote', path: 'analyses/LITE/_data/instrument.json' }],
  ref: REF, run: '20261027', asOf: '2026-10-27',
  xbrl: {
    ttm: {
      rev: ['RevenueFromContractWithCustomerExcludingAssessedTax'],
      ebit: ['OperatingIncomeLoss'],
      ni: ['NetIncomeLoss'],
      dep: ['Depreciation'],
      amort: ['AmortizationOfIntangibleAssets'],
      ocf: ['NetCashProvidedByUsedInOperatingActivities'],
      capex: ['PaymentsToAcquirePropertyPlantAndEquipment'],
    },
    instant: {
      cashEq: ['CashAndCashEquivalentsAtCarryingValue'],
      sti: ['ShortTermInvestments'],
      ltDebtC: ['LongTermDebtCurrent'],
      ltDebtNC: ['LongTermDebtNoncurrent'],
      equity: ['StockholdersEquity'],
    },
    da: ['dep', 'amort'], debt: ['ltDebtC', 'ltDebtNC'], cash: ['cashEq', 'sti'],
  },
  scenarioBasis: 'revenue', scenarioMultiple: 8.0,
  valuationBasis: 'GAAP douze mois au 27 juin 2026 = exercice 2026 complet (données XBRL officielles de la SEC) ; dette = part courante et non courante des emprunts au 27 juin 2026 (obligations convertibles et prêts à terme) ; trésorerie = liquidités et placements à court terme au 27 juin ; 93 459 271 actions au 24 septembre 2026 (circulaire du 6 octobre), préférence Série A de NVIDIA convertie comprise. Huit fois les revenus = médiane arrondie de Coherent (6,4×), Ciena (8,0×) et Applied Optoelectronics (9,9×), statistiques relevées en instantané : Lumentum payé comme ses pairs optiques directs sur ses revenus de l’exercice clos ; ce n’est pas un objectif',
  shares: { value: SHARES, doc: 2 },
  levels: {
    trigger: { d: '2026-10-26', c: 2 },  // plus haut du 26 octobre, séance de rebond après le plus bas du 23
    stop: { d: '2026-10-26', c: 3 },     // plus bas du 26 octobre
    abandon: { d: '2026-10-23', c: 3 },  // plus bas du 23 octobre, creux de la baisse d'octobre
    s1: { d: '2026-10-26', c: 3 }, s2: { d: '2026-10-23', c: 3 }, s3: { d: '2026-07-29', c: 3 },
    r1: { d: '2026-10-21', c: 2 },       // plus haut du 21 octobre, dernier sommet avant la chute du 22
    r2: { d: '2026-10-13', c: 2 },       // plus haut du 13 octobre, lendemain de la première chute
    r3: { d: '2026-10-12', c: 2 },       // plus haut du 12 octobre, séance où la baisse a commencé
  },
  supports: ['s1', 's2', 's3'], resistances: ['r1', 'r2', 'r3'],
  targets: ({ lv }) => ({ tp1: lv('r2'), tp2: lv('r3'), range: null }),
  levelsMethod: 'Déclencheur = plus haut du 26 octobre, séance du rebond ; stop = plus bas du 26 octobre ; seuil d’abandon = plus bas du 23 octobre, creux de la baisse d’octobre ; TP1 = plus haut du 13 octobre ; TP2 = plus haut du 12 octobre, séance où la baisse a commencé ; plafond d’achat = (TP1 + 1,5 × stop) / 2,5 arrondi au cent inférieur ; pourcentages depuis l’entrée ; R/R = gain / risque.',
  inventory: 41,
  reviewScope: 'Dépôts EDGAR de Lumentum Holdings (CIK 1633978) du 8 septembre 2025 au 26 octobre 2026 : 41 formulaires hors déclarations d’initiés et avis de vente 144 (le 10-K de l’exercice 2026, trois 10-Q, treize 8-K, deux circulaires et leurs compléments, deux rapports annuels, douze déclarations de détention 13G, un S-8, un formulaire SD, deux lettres de la SEC et deux réponses de la société). Recherche par type : aucun S-3, S-3ASR, 424B ni programme d’émission d’actions sur la période ; le dernier prospectus déposé date de 2018. Huit pièces décisionnelles ouvertes et hachées : le 10-K, le communiqué du quatrième trimestre, la circulaire du 6 octobre 2026, le communiqué NVIDIA du 2 mars, les deux 8-K d’échange d’obligations contre actions (avril et juin), le 8-K d’émission des obligations 2032 et celui de la ligne de crédit.',
  docs: S.docs,
  needles: S.needles,
  route: (p, { prov, dep, B }) => {
    if (p.startsWith('options.')) return prov('erisk', '/events/0', 'Calendrier de résultats collecté après la clôture du 26 octobre : mouvement implicite non disponible (marché des options fermé à la collecte), aucun chiffre d’options retenu.');
    if (p.startsWith('insiders.')) return prov('insiders', '/results/1/data/0/coverage_status', 'Relevé officiel des formulaires 4 : couverture incomplète (data_insufficient), aucun solde net affirmé.');
    if (p.startsWith('shortInterest.')) return prov('quote', '', 'Positions vendeuses au règlement FINRA (bloc instrument_short_interest de l’instrument collecté) rapportées au flottant du fournisseur (statistiques collectées).');
    if (p.startsWith('archiveHistory.')) return prov('status', '/captured_at', 'Versions précédentes de la fiche, conservées dans analyses/LITE/archive/ ; dates éditoriales, pas des observations de marché.');
    if (p.startsWith('reviewPanel.')) return prov('bars', B, 'Relectures indépendantes ; chiffres repris des sections prouvées.', [dep('primary', '/documents/0')]);
    if (p.startsWith('tribunal.')) return prov('bars', B, 'Tribunal de la fiche : chaque chiffre plaidé est repris de la section qui le prouve (barres certifiées, dépôts SEC, agrégats GAAP, multiples collectés).', [dep('primary', '/documents/0'), dep('primary', '/documents/1')]);
    if (p.startsWith('bottomEstimation.')) return prov('bars', B, 'Planchers techniques lus sur les barres certifiées (plus bas du 26 et du 23 octobre, moyenne à deux cents séances) ; plancher de valeur = médiane de l’EV/revenus de Coherent, Ciena et Applied Optoelectronics (statistiques collectées) × chiffre d’affaires annualisé tiré du communiqué du quatrième trimestre − dette + trésorerie, divisé par le nombre d’actions de la circulaire.', [dep('primary', '/documents/1'), dep('primary', '/documents/2')]);
    const v = getPath(LAST, p); if (typeof v !== 'string') return null;
    if (/^news\.[0-2]\./.test(p)) return prov('bars', B, 'Variation de clôture à clôture lue sur les barres certifiées et comparée aux pairs optiques et aux acheteurs sur la même séance ; cause attribuée à la presse financière citée, pas déduite des cours.', [dep('comparison', '')]);
    return null;
  },
  sectionDocs: { verdict: [1, 0, 2, 3], business: [0, 1, 3], news: [1, 0], earnings: [1, 0], capitalStructure: [0, 2, 4, 5, 6], filingsReview: [0, 1, 2, 3, 4, 5, 6, 7], risks: [0, 1, 3], globalScore: [1], meta: [1], disclaimer: [1], macro: [1], options: [1], social: [1], header: [2], technicals: [1], performance: [1], timeline: [1, 2], bottomEstimation: [1] },
  score: { business: 26, technical: -8, capital: 4, calendar: -6, dilution: -6, risk: 40 },
  riskScoreReason: 'Jugement qualitatif sur dix : une croissance réelle (chiffre d’affaires doublé sur un an, prévision de 1,25 Md$ au trimestre, demande supérieure à la capacité selon le 10-K), mais un titre payé vingt-cinq fois son chiffre d’affaires de l’exercice contre six à dix fois pour les pairs optiques sur la même base ; deux clients non nommés à 41,6 % des ventes ; 1 554,3 M$ d’obligations convertibles toutes dans la monnaie qui créent des actions à chaque hausse ; une baisse d’un tiers en douze séances sur la seule peur du financement de l’IA ; résultats le 5 novembre au soir, date confirmée par la société.',
  compose: c => require('./compose-lite.cjs')(c, x => { LAST = x; return x; }),
  groups: S.groups,
  eventDefault: { leader: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; ses commandes restent le repère de la filière', direct_peer: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; ses gains de commandes restent à suivre', upstream: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; sa capacité reste le signal à suivre', downstream: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; ses commandes de ports restent le signal à suivre', second_order: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; son budget d’investissement reste le signal à suivre', sector_proxy: 'Panier sans publication propre ; exposé aux résultats de ses grandes pondérations' },
  eventRisk: {
    COHR: 'Résultats annoncés le 4 novembre (une seule source) : premier pair optique à publier, la veille de Lumentum',
    AAOI: 'Résultats annoncés le 5 novembre (une seule source), le même jour que Lumentum',
    MTSI: 'Résultats annoncés le 5 novembre (une seule source), le même jour que Lumentum',
    VIAV: 'Résultats annoncés le 4 novembre (une seule source) ; lecture sur les tests des nouvelles liaisons',
    ANET: 'Résultats annoncés le 3 novembre (une seule source) : ses commandes de ports disent la demande de modules',
    ALAB: 'Résultats annoncés le 3 novembre (une seule source) ; lecture sur la connectivité dans la baie',
    FN: 'Résultats annoncés le 2 novembre (une seule source) : volume d’assemblage de la filière optique',
    TSEM: 'Résultats annoncés le 2 novembre (une seule source) ; capacité de photonique sur silicium',
    AXTI: 'Résultats annoncés le 29 octobre (une seule source) : demande de substrats de phosphure d’indium',
    MSFT: 'Résultats annoncés le 28 octobre (une seule source) : sa prévision d’investissement pour l’année est le premier test',
    GOOGL: 'Résultats annoncés le 28 octobre (une seule source) : budget de centres de données et de puces maison',
    AMZN: 'Résultats annoncés le 29 octobre (une seule source) : budget de centres de données d’AWS',
    GLW: 'Résultats annoncés le 27 octobre (une seule source) ; volume de fibre pour centres de données',
  },
  blastDoc: 0,
  scenarios: c => require('./compose-lite.cjs').scenarios(c),
  contradictions: c => require('./compose-lite.cjs').contradictions(c),
  missingData: c => require('./compose-lite.cjs').missingData(c),
  limitations: ['Agrégats GAAP au 27 juin 2026 ; le premier trimestre de l’exercice 2027 n’est pas encore publié (5 novembre).', 'Date de publication confirmée par le communiqué de la société du 5 octobre 2026 (page des relations investisseurs, copie hachée dans _primary), pas par un dépôt SEC.', 'Multiples des pairs issus des statistiques courantes, relevées en instantané, sans historique daté.', 'Dilution des obligations convertibles calculée au cours du 26 octobre sur les principaux du 27 juin 2026 ; conversions postérieures non publiées.', 'Causes des séances du 12, du 22 et du 26 octobre connues par la presse financière citée, pas par un dépôt de la société.', 'Mouvement implicite des options autour des résultats non disponible à la collecte (marché fermé).'],
});
