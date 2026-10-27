'use strict';
// Dossier Reddit (RDDT) v3 au close du 2026-10-26, refonte complète du 27 octobre 2026 au gabarit FICO (R08).
// Remplace la fiche du 27 septembre 2026 (plan de couloir déclenché le 28 septembre, expiré le 23 octobre sans stop ni
// objectif), archivée dans archive/20260927/ ; son JSON est conservé dans _runs/20261027/original/.
// Agrégats GAAP : douze mois glissants au 30 juin 2026 lus dans les données XBRL officielles de la SEC (companyfacts,
// 10-Q du 31 juillet inclus) = exercice 2025 (10-K) + semestre clos le 30 juin 2026 − semestre clos le 30 juin 2025.
// Aucune dette tirée : clés dette vides. Trésorerie = liquidités + placements courants au 30 juin. Actions = Class A
// (146 103 200) + Class B (46 293 310) au 29 juillet (page de garde du 10-Q), même poids économique ; la Class B porte
// dix voix. Valorisation par les revenus : marge brute de 91 %, multiple d'EV/revenus comparé aux pairs.
// Barres certifiées Yahoo (plan analyse). La série du serveur manquait les séances des 22 et 23 juillet 2026 pour RDDT, et
// celle de SOCL s'arrêtait au 25 septembre : rechargement ciblé de ces deux symboles seulement (RefreshBars, jeton de
// portée refresh, effacé après usage) le 27 octobre vers 10 h 04 UTC, contrôle des séances du 20 au 27 juillet, puis
// collecte complète.
const K = require('../../../../tools/lib/analysis-v3-kit.cjs');
const R = require('../../../../tools/lib/analysis-v3-r08.cjs');
const S = require('./static-rddt.cjs');
const GEN = 'analyses/RDDT/_runs/20261027/build-rddt.cjs';
const REF = '2026-10-26';
const SHARES = 146103200 + 46293310; // 192 396 510 : Class A + Class B au 29 juillet 2026
const QUOTE = 'analyses/RDDT/_data/instrument.json';
const SIP = K.findPath(K.read(QUOTE), 'instrument_short_interest');

let LAST = null;
const getPath = (o, p) => p.split('.').reduce((n, k) => n == null ? undefined : n[k], o);

R.build({
  ticker: 'RDDT', shortName: 'Reddit', cik: 1713445, generator: GEN, mode: 'breakout', peers: true,
  extraInputs: [{ name: 'quote', path: QUOTE }],
  ref: REF, run: '20261027', asOf: '2026-10-27',
  xbrl: {
    ttm: {
      rev: ['RevenueFromContractWithCustomerExcludingAssessedTax'],
      ebit: ['OperatingIncomeLoss'],
      ni: ['NetIncomeLoss'],
      dna: ['DepreciationDepletionAndAmortization'],
      ocf: ['NetCashProvidedByUsedInOperatingActivities'],
      capex: ['PaymentsToAcquirePropertyPlantAndEquipment'],
      nonop: ['NonoperatingIncomeExpense'],
      tax: ['IncomeTaxExpenseBenefit'],
      sbc: ['ShareBasedCompensation'],
    },
    instant: {
      cashEq: ['CashAndCashEquivalentsAtCarryingValue'],
      sti: ['AvailableForSaleSecuritiesDebtSecuritiesCurrent'],
    },
    da: ['dna'], debt: [], cash: ['cashEq', 'sti'],
  },
  scenarioBasis: 'revenue', scenarioMultiple: 6,
  valuationBasis: 'GAAP douze mois glissants au 30 juin 2026 (données XBRL officielles de la SEC) : revenus = exercice 2025 (10-K) + semestre clos le 30 juin 2026 − semestre clos le 30 juin 2025. Capitalisation = clôture certifiée du 26 octobre 2026 × 192 396 510 actions (Class A et Class B au 29 juillet, 10-Q). Valeur d’entreprise = capitalisation − trésorerie (liquidités + placements courants au 30 juin) ; aucune dette tirée. Scénario : six fois les revenus des douze derniers mois, un peu sous Roblox (6,6×) et Meta (7,9×) en statistiques relevées en instantané, trésorerie du 30 juin inchangée ; c’est le prix d’un Reddit payé comme une plateforme dont la croissance aurait rejoint celle des grands, pas un objectif',
  shares: { value: SHARES, doc: 0 },
  levels: {
    trigger: { d: '2026-10-26', c: 2 },  // plus haut du 26 octobre (144,55 $), séance de la deuxième baisse de 4 %
    stop: { d: '2026-10-26', c: 3 },     // plus bas du 26 octobre (133,33 $)
    abandon: { d: '2026-03-13', c: 3 },  // plus bas du 13 mars (131,31 $), bas de la consolidation de mars
    s1: { d: '2026-10-26', c: 3 }, s2: { d: '2026-03-13', c: 3 }, s3: { d: '2026-03-30', c: 3 }, // s3 = plus bas sur un an
    r1: { d: '2026-10-23', c: 2 },       // plus haut du 23 octobre, dernière séance avant la baisse du 26
    r2: { d: '2026-10-16', c: 2 },       // plus haut du 16 octobre, haut du couloir d'octobre (TP1)
    r3: { d: '2026-07-30', c: 4 },       // clôture du 30 juillet, haut du trou du 31 juillet (TP2)
  },
  supports: ['s1', 's2', 's3'], resistances: ['r1', 'r2', 'r3'],
  targets: ({ lv }) => ({ tp1: lv('r2'), tp2: lv('r3'), range: null }),
  levelsMethod: 'Déclencheur = plus haut du 26 octobre ; stop = plus bas du 26 octobre ; seuil d’abandon = plus bas du 13 mars, bas de la consolidation de mars ; TP1 = plus haut du 16 octobre, haut du couloir d’octobre ; TP2 = clôture du 30 juillet, haut du trou laissé par les résultats du deuxième trimestre ; plafond d’achat = (TP1 + 1,5 × stop) / 2,5 arrondi au cent inférieur ; pourcentages depuis l’entrée ; R/R = gain / risque.',
  inventory: 29,
  reviewScope: 'Dépôts EDGAR de Reddit, Inc. (CIK 1713445) du 27 octobre 2025 au 26 octobre 2026 : 29 formulaires hors déclarations d’initiés (formulaires 3, 4, 5) et avis de vente 144 (un 10-K, trois 10-Q, six 8-K, la circulaire et son complément, le rapport annuel, un S-8 des plans salariés, deux lettres de la SEC et la réponse de la société, douze déclarations de détention 13G et 13D). Neuf pièces décisionnelles ouvertes et hachées : le 10-Q, le communiqué et la lettre aux actionnaires du deuxième trimestre, le 10-K 2025, la lettre et le communiqué du quatrième trimestre 2025, le communiqué du premier trimestre 2026, celui du troisième trimestre 2025 et la réponse à la SEC du 6 avril. Recherche par type sur EDGAR : aucun S-3, S-3ASR, 424B, bon de souscription ni obligation convertible depuis le prospectus d’introduction en Bourse de mars 2024 ; le 8-K du 12 août, ouvert, annonce le départ du directeur juridique sans effet sur le capital ; le 8-K du 10 juin (assemblée), la circulaire, les 13D/A, les 13G et la lettre de clôture de la SEC du 13 avril ne sont pas ouverts et sont écartés comme non décisionnels pour le plan.',
  docs: S.docs,
  needles: S.needles,
  route: (p, { prov, dep, B, lvPtr, STP }) => {
    if (p.startsWith('options.')) return prov('bars', B, 'Réactions aux quatre dernières publications : variation de clôture à clôture et écart d’ouverture du lendemain, lus sur les barres certifiées. La chaîne d’options a été relevée marché fermé, sans prix ni intérêt ouvert exploitables : aucun mouvement implicite publié.', [dep('erisk', '/events/0')]);
    if (p.startsWith('shortInterest.')) return prov('quote', SIP, 'Positions vendeuses au règlement FINRA du 15 octobre 2026 et jours de couverture publiés par FINRA ; part du flottant = positions / flottant du fournisseur (statistiques relevées en instantané).', [dep('fund', STP + '/floatShares')]);
    if (p.startsWith('tribunal.')) return prov('bars', B, 'Tribunal de la fiche : chaque chiffre plaidé est repris de la section qui le prouve (barres certifiées, dépôts SEC, agrégats GAAP, multiples collectés).', [dep('primary', '/documents/0'), dep('primary', '/documents/1')]);
    if (p.startsWith('bottomEstimation.')) return prov('bars', B, 'Planchers techniques lus sur les barres certifiées (plus bas du 26 octobre et du 30 mars) ; plancher de valeur = multiple de revenus × revenus GAAP douze mois (éventuellement réduits) + trésorerie, divisé par le nombre d’actions du 10-Q.', [dep('bars', lvPtr('s1')), dep('bars', lvPtr('s3')), dep('primary', '/documents/0')]);
    if (p.startsWith('archiveHistory.')) return prov('status', '/captured_at', 'Versions précédentes de la fiche, conservées dans analyses/RDDT/archive/ ; dates éditoriales, pas des observations de marché.');
    if (p.startsWith('timeline.')) return prov('erisk', '/events/0', 'Date de publication de Reddit lue au calendrier collecté et confirmée par le communiqué de la société du 15 octobre ; dates des comparables au calendrier collecté (une seule source) ; rendez-vous macro aux calendriers officiels ; fin du plan fixée par la fiche.', [dep('earn', '/events')]);
    const v = getPath(LAST, p); if (typeof v !== 'string') return null;
    if (/^news\./.test(p)) return prov('bars', B, 'Variations de clôture à clôture lues sur les barres certifiées et comparées aux pairs sur la même séance ; causes attribuées aux sources citées, pas déduites des cours.', [dep('comparison', ''), dep('primary', '/documents/1')]);
    return null;
  },
  sectionDocs: { verdict: [1, 0, 2, 3], business: [3, 1, 2, 0], earnings: [1, 6, 5, 7], capitalStructure: [0, 2, 5, 3], filingsReview: [0, 1, 2, 3, 4, 5, 6, 7, 8], risks: [0, 3, 2, 1], globalScore: [1], meta: [1], disclaimer: [1], macro: [1], social: [1], header: [0], insiders: [0], technicals: [1], performance: [1], timeline: [1], bottomEstimation: [0] },
  score: { business: 28, technical: -10, capital: 6, calendar: -8, dilution: -3, risk: 33 },
  riskScoreReason: 'Jugement qualitatif sur dix : une entreprise rentable, sans dette et en forte croissance, mais dont la croissance vient désormais surtout du prix des annonces (+40 %) pendant que les impressions ralentissent (+17 %) et que les utilisateurs américains reculent d’un trimestre à l’autre ; une dépendance au trafic de Google que la société reconnaît ; des résultats le 29 octobre au soir, après des réactions de −21 % et +13 % aux deux dernières publications ; 15 % du flottant vendu à découvert ; une valorisation au-dessus de Meta en multiple de revenus.',
  compose: c => require('./compose-rddt.cjs')(c, x => { LAST = x; return x; }),
  groups: S.groups,
  eventDefault: { leader: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', direct_peer: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', upstream: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', downstream: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', second_order: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', sector_proxy: 'Panier sans publication propre ; exposé aux résultats de ses grandes pondérations, Alphabet le 28 octobre' },
  eventRisk: {
    META: 'Résultats publiés le 21 octobre, avant Reddit : premier test de la demande publicitaire du trimestre',
    GOOGL: 'Résultats annoncés le 28 octobre (une seule source), la veille de Reddit : ce qu’Alphabet dira de la recherche',
    AMZN: 'Résultats annoncés le 29 octobre (une seule source), le même soir que Reddit',
    PINS: 'Résultats annoncés le 29 octobre (une seule source), le même soir que Reddit : lecture directe sur les budgets',
    RBLX: 'Résultats annoncés le 29 octobre (une seule source), le même soir que Reddit',
    SNAP: 'Résultats annoncés le 4 novembre (une seule source)',
    APP: 'Résultats annoncés le 4 novembre (une seule source)',
    MGNI: 'Résultats annoncés le 4 novembre (une seule source)',
    CRTO: 'Résultats annoncés le 4 novembre (une seule source)',
    ZG: 'Résultats annoncés le 4 novembre (une seule source)',
    TTD: 'Résultats annoncés le 5 novembre (une seule source)',
    DV: 'Résultats annoncés le 5 novembre (une seule source)',
    YELP: 'Résultats annoncés le 5 novembre (une seule source) : premier test du trafic de recherche après Reddit',
    TRIP: 'Résultats annoncés le 5 novembre (une seule source)',
    NFLX: 'Résultats publiés le 20 octobre ; aucune publication dans la fenêtre du plan',
    XLC: 'Panier sans publication propre ; Alphabet, l’une de ses grandes pondérations, publie le 28 octobre (une seule source)',
    SOCL: 'Panier sans publication propre ; exposé aux résultats de ses membres, composition non relevée ici',
  },
  blastDoc: 3,
  scenarios: c => require('./compose-rddt.cjs').scenarios(c),
  contradictions: c => require('./compose-rddt.cjs').contradictions(c),
  missingData: c => require('./compose-rddt.cjs').missingData(c),
  limitations: ['Agrégats GAAP au 30 juin 2026 ; le troisième trimestre, publié le 29 octobre après la clôture, n’est pas intégré.', 'Séries Yahoo de RDDT (séances des 22 et 23 juillet) et de SOCL (après le 25 septembre) rechargées côté serveur le 27 octobre, contrôlées avant la collecte.', 'Multiples des pairs issus des statistiques courantes, relevées en instantané, sans historique daté.', 'Chaîne d’options relevée marché fermé : aucun mouvement implicite aux résultats publié.', 'Causes des séances du 22, 23 et 26 octobre et de l’inclusion au S&P 500 connues par la presse citée.'],
});
