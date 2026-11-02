'use strict';
// Dossier Lumentum (LITE) v3 du 2 novembre 2026, clôture certifiée de référence = 30 octobre 2026 (décision du propriétaire :
// publier le soir même, sans attendre la clôture certifiée du 2 novembre). Gabarit du 27 octobre 2026 (FICO = référence).
// Le 2 novembre avant l'ouverture, Lumentum a annoncé un accord de fusion avec Marvell (4,500 actions MRVL par action LITE)
// et publié son premier trimestre 2027. Les cours de la séance du 2 novembre, horodatés et NON certifiés, ne servent qu'à la
// section « Séance du 2 novembre en cours » et aux scénarios d'option ; aucun niveau du plan n'en dérive.
// Le plan du 27 octobre (statut surveiller, puis faux déclenchement du 28 octobre corrigé par l'orchestrateur) est archivé :
// mode « archived », niveaux repris à l'identique de data/analyses-data/LITE.json (copié dans original/), non exécutables.
// Agrégats GAAP : companyfacts SEC au 30 octobre = exercice 2026 complet (clos le 27 juin) ; le 10-Q du premier trimestre
// 2027 n'est pas encore déposé. Les chiffres du premier trimestre viennent du communiqué déposé (document 11).
// Actions = 93 459 271 (circulaire du 6 octobre 2026) : base de capitalisation inchangée.
const R = require('../../../../tools/lib/analysis-v3-r08.cjs');
const S = require('./static-lite.cjs');
const GEN = 'analyses/LITE/_runs/20261102/build-lite.cjs';
const REF = '2026-10-30';
const SHARES = 93459271;
const LIVE = 'analyses/LITE/_runs/20261102/session/live_quote.json'; // collecte harnachée (live-plan.json) du 2 novembre, 19 h 54 UTC

let LAST = null;
const getPath = (o, p) => p.split('.').reduce((n, k) => n == null ? undefined : n[k], o);

R.build({
  ticker: 'LITE', shortName: 'Lumentum', cik: 1633978, generator: GEN, mode: 'archived', peers: true,
  extraInputs: [{ name: 'quote', path: 'analyses/LITE/_data/instrument.json' }, { name: 'live', path: LIVE }],
  ref: REF, run: '20261102', asOf: '2026-11-02',
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
  valuationBasis: 'GAAP douze mois au 27 juin 2026 = exercice 2026 complet (données XBRL officielles de la SEC ; le 10-Q du premier trimestre 2027 n’est pas déposé au 30 octobre) ; dette et trésorerie au 27 juin ; 93 459 271 actions au 24 septembre 2026 (circulaire du 6 octobre), préférence Série A de NVIDIA convertie comprise. Huit fois les revenus = médiane arrondie de Coherent, Ciena et Applied Optoelectronics (statistiques relevées en instantané) : Lumentum payé comme ses pairs optiques sans l’offre de Marvell ; ce n’est pas un objectif',
  shares: { value: SHARES, doc: 2 },
  levels: {
    abandon: { d: '2026-10-23', c: 3 },  // creux du 23 octobre, ancien seuil d'abandon du plan archivé
    s1: { d: '2026-10-30', c: 3 }, s2: { d: '2026-10-23', c: 3 }, s3: { d: '2026-07-29', c: 3 },
    r1: { d: '2026-10-29', c: 2 },       // plus haut du 29 octobre, lendemain de l'article de Bloomberg
    r2: { d: '2026-10-13', c: 2 },
    r3: { d: '2026-10-12', c: 2 },
  },
  supports: ['s1', 's2', 's3'], resistances: ['r1', 'r2', 'r3'],
  levelsMethod: 'Plan du 27 octobre archivé : entrée, stop et objectifs repris à l’identique, non exécutables ; supports et résistances lus sur les barres certifiées au 30 octobre.',
  inventory: 49,
  reviewScope: 'Dépôts EDGAR de Lumentum Holdings (CIK 1633978) du 8 septembre 2025 au 2 novembre 2026 : 41 formulaires examinés pour le dossier du 27 octobre (hors formulaires 4 et 144), plus les huit dépôts des 6 octobre et 2 novembre (deux 8-K, trois 425, la circulaire, son complément et le rapport annuel). Recherche par type : aucun S-3, S-3ASR, 424B ni programme d’émission d’actions sur la période. Treize pièces décisionnelles ouvertes et hachées : le 10-K, les communiqués des quatrième et premier trimestres, la circulaire du 6 octobre, le communiqué NVIDIA du 2 mars, les 8-K d’échange d’obligations (avril et juin), l’émission 2032, la ligne de crédit, le 8-K de l’accord de fusion, le texte de l’accord, le communiqué conjoint avec Marvell et la lettre aux clients.',
  docs: S.docs,
  needles: S.needles,
  route: (p, { prov, dep, B, docs }) => {
    if (p.startsWith('liveSession.')) return prov('live', '/results', 'Cotations de séance du 2 novembre 2026 relevées à l’heure indiquée (QueryData realtime_quote et quote), NON certifiées ; valeur de l’offre = 4,5 × cours de Marvell (accord du 1er novembre) ; écart = valeur de l’offre / cours de Lumentum − 1 ; annualisation composée sur les jours calendaires jusqu’au 30 juin 2028 ou sur douze mois ; scénarios = cours de Marvell à l’échéance × 4,5 ; rupture = clôture non affectée du 28 octobre × (1 + rendement médian de Coherent et Applied Optoelectronics depuis), indemnité réglementaire de 3,2 Md$ divisée par 101,7 millions d’actions diluées du premier trimestre. Clôtures certifiées du 28 et du 30 octobre lues sur les barres.', [dep('bars', B), dep('comparison', ''), dep('primary', '/documents/8'), dep('primary', '/documents/10'), dep('primary', '/documents/11')]);
    if (p.startsWith('options.')) return prov('erisk', '/events/0', 'Calendrier de résultats collecté le 2 novembre : publication du 2 novembre ; mouvement implicite des options relevé en séance, non retenu comme niveau.');
    if (p.startsWith('insiders.')) return prov('insiders', '', 'Relevé officiel des formulaires 4 : couverture incomplète, aucun solde net affirmé.');
    if (p.startsWith('shortInterest.')) return prov('quote', '', 'Positions vendeuses au règlement FINRA (bloc instrument_short_interest de l’instrument collecté) rapportées au flottant du fournisseur (statistiques collectées).');
    if (p.startsWith('archiveHistory.')) return prov('status', '/captured_at', 'Versions précédentes de la fiche, conservées dans analyses/LITE/archive/ ; dates éditoriales, pas des observations de marché.');
    if (p.startsWith('reviewPanel.')) return prov('bars', B, 'Relectures indépendantes ; chiffres repris des sections prouvées.', [dep('primary', '/documents/0')]);
    if (p.startsWith('tribunal.')) return prov('bars', B, 'Tribunal de la fiche : chaque chiffre plaidé est repris de la section qui le prouve (barres certifiées, cotations de séance horodatées, dépôts SEC).', [dep('live', '/results'), dep('primary', '/documents/8'), dep('primary', '/documents/10'), dep('primary', '/documents/11')]);
    if (p.startsWith('bottomEstimation.')) return prov('bars', B, 'Valeur de Lumentum sans l’offre : clôture non affectée du 28 octobre ajustée du rendement médian de Coherent et Applied Optoelectronics depuis (barres certifiées et cotations de séance) ; plancher de valeur = 8,0 fois le chiffre d’affaires annualisé du milieu de la prévision du deuxième trimestre − dette + trésorerie au 27 juin, divisé par les actions de la circulaire ; indemnité réglementaire par action diluée.', [dep('live', '/results'), dep('comparison', ''), dep('primary', '/documents/8'), dep('primary', '/documents/11'), dep('primary', '/documents/2')]);
    if (p === 'verdict.score' || p === 'risks.riskScore') return null;
    if (p.startsWith('verdict.') || p.startsWith('meta.description') || p.startsWith('meta.ogDescription') || p.startsWith('tradeIdea.') && !/^tradeIdea\.(entry|stop|tp1|tp2|stopPct|tp1Pct|tp2Pct|rr|archiveReferenceClose)$/.test(p) || p.startsWith('globalScore.') || p.startsWith('risks.') || p.startsWith('timeline.'))
      return prov('bars', B, 'Clôtures certifiées (30 octobre et antérieures), cotations de séance horodatées du 2 novembre (non certifiées), dépôts SEC du 2 novembre et calculs du générateur.', [dep('live', '/results'), dep('comparison', ''), dep('primary', '/documents/8'), dep('primary', '/documents/10'), dep('primary', '/documents/11')]);
    const v = getPath(LAST, p); if (typeof v !== 'string') return null;
    if (/^news\./.test(p)) return prov('bars', B, 'Variations de clôture à clôture lues sur les barres certifiées et comparées aux pairs ; faits datés tirés des dépôts SEC et de la presse citée.', [dep('comparison', ''), dep('live', '/results'), dep('primary', '/documents/8'), dep('primary', '/documents/11')]);
    return null;
  },
  sectionDocs: { verdict: [10, 8, 11], business: [0, 11, 10, 3], news: [10, 11], earnings: [11, 1], capitalStructure: [0, 2, 8, 9, 11, 4, 5, 6], filingsReview: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], risks: [8, 9, 10, 11], globalScore: [11], meta: [10], disclaimer: [10], macro: [11], options: [11], social: [11], header: [2], technicals: [11], performance: [11], timeline: [10, 11, 12], bottomEstimation: [11], liveSession: [10, 8] },
  score: { business: 26, technical: -10, capital: 4, calendar: -8, dilution: -4, risk: 36 },
  riskScoreReason: 'Jugement qualitatif sur dix : la société publie un trimestre record (chiffre d’affaires +136,5 % sur un an, prévision de 1,575 à 1,625 Md$), mais le titre est désormais une promesse de 4,5 actions Marvell livrable vers le premier semestre 2028 ; la valeur de l’offre a fondu avec Marvell, les autorisations requises ne sont pas toutes publiques, Marvell peut refuser tout remède lourd, et une rupture renverrait le titre vers la valeur des pairs optiques, eux-mêmes en baisse.',
  compose: c => require('./compose-lite.cjs')(c, x => { LAST = x; return x; }),
  groups: S.groups,
  eventDefault: { leader: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; ses commandes restent le repère de la filière', direct_peer: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; ses gains de commandes restent à suivre', upstream: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; sa capacité reste le signal à suivre', downstream: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; ses commandes de ports restent le signal à suivre', second_order: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; son budget d’investissement reste le signal à suivre', sector_proxy: 'Panier sans publication propre ; exposé aux résultats de ses grandes pondérations' },
  eventRisk: {
    MRVL: 'Aucune publication dans la fenêtre collectée ; prochains résultats vers le 1er décembre selon une seule source, non confirmés par Marvell ; chiffre d’affaires préliminaire déjà donné le 2 novembre',
    COHR: 'Résultats annoncés le 4 novembre (une seule source) : premier pair optique à publier depuis l’accord',
    AAOI: 'Résultats annoncés le 5 novembre (une seule source) : lecture sur la demande de modules',
    MTSI: 'Résultats annoncés le 5 novembre (une seule source) ; composants des mêmes modules',
    VIAV: 'Résultats annoncés le 4 novembre (une seule source) ; lecture sur les tests des nouvelles liaisons',
    ANET: 'Résultats annoncés le 3 novembre (une seule source) : ses commandes de ports disent la demande de modules',
    ALAB: 'Résultats annoncés le 3 novembre (une seule source) ; lecture sur la connectivité dans la baie',
    FN: 'Résultats annoncés le 2 novembre (une seule source) : volume d’assemblage de la filière optique',
    TSEM: 'Résultats annoncés le 2 novembre (une seule source) ; capacité de photonique sur silicium',
    CRWV: 'Résultats le 10 novembre après la clôture, conférence à 23 h à Paris (communiqué de CoreWeave du 27 octobre)',
    NBIS: 'Résultats le 12 novembre avant l’ouverture, conférence à 14 h à Paris (communiqué de Nebius du 30 octobre)',
    CSCO: 'Résultats annoncés le 12 novembre (une seule source) ; commandes de réseau des centres de données',
    NVDA: 'Résultats le 17 novembre, conférence à 23 h à Paris (page des relations investisseurs de NVIDIA), hors de la fenêtre collectée de quatorze jours',
    MSFT: 'Résultats publiés le 28 octobre : prévision d’investissement annuelle ramenée de 175 à 170 Md$ (CNBC, 29 octobre)',
    GOOGL: 'Résultats publiés le 28 octobre : fourchette d’investissement de 195 à 205 Md$ maintenue (CNBC, 29 octobre)',
  },
  blastDoc: 10,
  scenarios: c => require('./compose-lite.cjs').scenarios(c),
  contradictions: c => require('./compose-lite.cjs').contradictions(c),
  missingData: c => require('./compose-lite.cjs').missingData(c),
  limitations: ['Clôture certifiée de référence : 30 octobre 2026. La clôture du 2 novembre n’était pas certifiée à la publication ; les cours de séance horodatés ne fixent aucun niveau.', 'Agrégats GAAP au 27 juin 2026 ; les chiffres du premier trimestre 2027 viennent du communiqué déposé, le 10-Q n’est pas encore publié.', 'Autorisations réglementaires requises énumérées dans une annexe non publique de l’accord.', 'Multiples des pairs issus des statistiques courantes, relevées en instantané, sans historique daté.', 'Valeur de Lumentum sans l’offre estimée par le rendement médian de deux pairs depuis le 28 octobre : un repère, pas une prévision.', 'Dates de résultats de plusieurs comparables connues par une seule source.'],
});
