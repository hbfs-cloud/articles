'use strict';
// Dossier Marvell Technology (MRVL) v3, refonte du 2 novembre 2026 au gabarit R08 (fiche FICO = référence).
// Clôture de référence : 30 octobre 2026, dernière clôture certifiée au moment de la publication (décision du
// propriétaire, 2 novembre 2026 vers 20 h 40 à Paris : publier le soir même sans attendre la clôture du 2 novembre).
// L'accord de rachat de Lumentum, signé le 1er novembre et annoncé le 2 avant l'ouverture, est lu dans les 8-K du
// 2 novembre (static-mrvl.cjs). La séance du 2 novembre n'est montrée que par des cotations de séance horodatées
// (analyses/MRVL/_data-live/, plan plans/analyse-20261102-live.json), NON certifiées : aucun niveau du plan n'en dérive ; les niveaux seront recalculés
// sur la clôture certifiée du 2 novembre.
// Agrégats GAAP : données XBRL officielles (companyfacts), douze mois glissants au 1er août 2026 = exercice clos le
// 31 janvier 2026 (10-K) + premier semestre de l'exercice 2027 (10-Q) − premier semestre de l'exercice 2026.
// Amortissements = OtherDepreciationAndAmortization + AmortizationOfIntangibleAssets. Pas de placements à court terme.
// Actions = 876 926 613 actions ordinaires (21 août 2026, statistiques ; 876,9 millions en page de garde du 10-Q)
// + 21 778 000 actions issues de la conversion des actions de préférence de NVIDIA (8-K du 31 mars) = 898 704 613.
const fs = require('fs'), path = require('path');
const R = require('../../../../tools/lib/analysis-v3-r08.cjs');
const S = require('./static-mrvl.cjs');
const GEN = 'analyses/MRVL/_runs/20261102/build-mrvl.cjs';
const REF = '2026-10-30';
const SHARES = 876926613 + 21778000;
const LIVE = 'analyses/MRVL/_data-live/quotes_live.json'; // plan analyse-20261102-live, harnais propre

let LAST = null;
const getPath = (o, p) => p.split('.').reduce((n, k) => n == null ? undefined : n[k], o);

R.build({
  ticker: 'MRVL', shortName: 'Marvell', cik: 1835632, generator: GEN, mode: 'breakout', peers: true, clientBars: true,
  extraInputs: [{ name: 'quote', path: 'analyses/MRVL/_data/instrument.json' }, { name: 'live', path: LIVE }],
  ref: REF, run: '20261102', asOf: '2026-11-02',
  xbrl: {
    ttm: {
      rev: ['RevenueFromContractWithCustomerExcludingAssessedTax'],
      ebit: ['OperatingIncomeLoss'],
      ni: ['NetIncomeLoss'],
      dep: ['OtherDepreciationAndAmortization'],
      amort: ['AmortizationOfIntangibleAssets'],
      ocf: ['NetCashProvidedByUsedInOperatingActivities'],
      capex: ['PaymentsToAcquirePropertyPlantAndEquipment'],
    },
    instant: {
      cashEq: ['CashAndCashEquivalentsAtCarryingValue'],
      ltDebtC: ['LongTermDebtCurrent'],
      ltDebtNC: ['LongTermDebtNoncurrent'],
    },
    da: ['dep', 'amort'], debt: ['ltDebtC', 'ltDebtNC'], cash: ['cashEq'],
  },
  scenarioBasis: 'revenue', scenarioMultiple: 17.4,
  valuationBasis: 'GAAP douze mois au 1er août 2026 (données XBRL officielles de la SEC : exercice clos le 31 janvier 2026 + premier semestre de l’exercice 2027 − premier semestre de l’exercice 2026) ; dette = part courante et non courante de la dette à long terme au 1er août 2026 ; trésorerie = liquidités au 1er août ; 898 704 613 actions = 876 926 613 actions ordinaires + 21 778 000 actions de la conversion des actions de préférence de NVIDIA. 17,4 fois les revenus = médiane arrondie de Broadcom, NVIDIA, Credo, Arista et Coherent (statistiques relevées en instantané le 2 novembre) : Marvell payé comme ses voisins sur ses revenus passés, sans Lumentum ; ce n’est pas un objectif',
  shares: { value: SHARES, doc: 2 },
  levels: {
    trigger: { d: '2026-10-30', c: 2 }, // plus haut du 30 octobre, dernière séance avant l'annonce
    stop: { d: '2026-10-30', c: 3 },    // plus bas du 30 octobre
    abandon: { d: '2026-07-29', c: 3 }, // plus bas du 29 juillet, creux de l'été
    s1: { d: '2026-10-30', c: 3 }, s2: { d: '2026-07-29', c: 3 },
    s3: { d: '2026-05-12', c: 3 },      // plus bas du 12 mai
    r1: { d: '2026-10-29', c: 2 },      // plus haut du 29 octobre, première séance de la rumeur
    r2: { d: '2026-10-28', c: 2 },      // plus haut du 28 octobre, dernière séance non affectée
    r3: { d: '2026-10-06', c: 2 },      // plus haut du 6 octobre, journée investisseurs
  },
  supports: ['s1', 's2', 's3'], resistances: ['r1', 'r2', 'r3'],
  targets: ({ lv }) => ({ tp1: lv('r2'), tp2: lv('r3'), range: null }),
  levelsMethod: 'Déclencheur = plus haut du 30 octobre, dernière séance avant l’annonce ; stop = plus bas du 30 octobre ; seuil d’abandon = plus bas du 29 juillet ; TP1 = plus haut du 28 octobre, dernière séance non affectée par la rumeur ; TP2 = plus haut du 6 octobre ; plafond d’achat = (TP1 + 1,5 × stop) / 2,5 arrondi au cent inférieur ; pourcentages depuis l’entrée ; R/R = gain / risque. Niveaux provisoires, à recalculer sur la clôture certifiée du 2 novembre.',
  inventory: 31,
  reviewScope: 'Dépôts EDGAR de Marvell Technology (CIK 1835632) du 1er août au 2 novembre 2026 : 31 formulaires (un 10-Q, six 8-K, deux communications 425, un 13G/A, treize formulaires 4, six avis 144) ; vérification EDGAR par type : aucun S-3, S-3ASR, 424B ni S-8 sur la période. Dépôts de Lumentum (CIK 1633978) du 2 novembre ouverts pour la contrepartie (résultats du premier trimestre, courriel client 425) et 10-K de l’exercice 2026. Treize pièces décisionnelles ouvertes et hachées.',
  docs: S.docs,
  needles: S.needles,
  route: (p, { prov, dep, B, N, lvPtr }) => {
    if (p.startsWith('liveSession.')) return prov('live', '/data/items/0/results/0/data', 'Cotations de séance du 2 novembre relevées à l’heure indiquée, NON certifiées ; rapport LITE/MRVL et décote calculés sur ces cotations ; aucun niveau du plan n’en dérive.', [dep('primary', '/documents/0'), dep('primary', '/documents/1')]);
    if (p.startsWith('options.')) return prov('quote', require('./compose-mrvl.cjs').itemPtr('instrument_max_pain'), 'Positions ouvertes et prix d’exercice de la douleur maximale sur l’échéance la plus proche, relevés en séance le 2 novembre ; aucun mouvement implicite publié.');
    if (p.startsWith('shortInterest.')) { const q = require('./compose-mrvl.cjs').itemPtr('instrument_short_interest'); return prov('quote', q, 'Relevé FINRA bimensuel des positions vendeuses (date de règlement indiquée) rapporté au flottant du fournisseur ; aucune tendance déduite d’un seul point.', [dep('fund', '')]); }
    if (p.startsWith('tribunal.')) return prov('bars', B, 'Tribunal de la fiche : chaque chiffre plaidé est repris de la section qui le prouve (barres certifiées, dépôts SEC, agrégats GAAP, cotations de séance horodatées).', [dep('primary', '/documents/0'), dep('primary', '/documents/1'), dep('live', '/data/items/0/results/0/data')]);
    if (p.startsWith('bottomEstimation.')) return prov('bars', B, 'Planchers techniques lus sur les barres certifiées (plus bas du 30 octobre, du 29 juillet et du 12 mai) ; plancher de valeur = EV/revenus d’un pair (statistiques collectées) × revenus GAAP douze mois − dette + trésorerie, divisé par le nombre d’actions.', [dep('bars', lvPtr('s1')), dep('bars', lvPtr('s2')), dep('primary', '/documents/2')]);
    if (p.startsWith('archiveHistory.')) return prov('status', '/captured_at', 'Horodatage de la refonte ; dates des versions précédentes = dossiers datés conservés sous analyses/MRVL/archive/ (AAAAMMJJ).');
    const v = getPath(LAST, p); if (typeof v !== 'string') return null;
    // Verdict, descriptions et bandeau du plan : clôtures certifiées, termes de l'accord (8-K) et, pour la seule mention
    // de la séance du 2 novembre, le relevé de cotations horodaté non certifié.
    if (/^(verdict\.|meta\.(description|ogDescription)$|tradeIdea\.(statusNote|banner)$)/.test(p)) return prov('bars', B + '/' + N + '/4', 'Clôtures certifiées jusqu’au 30 octobre et variations recalculées ; termes du rachat lus dans les 8-K du 2 novembre ; cours de séance du 2 novembre repris du relevé horodaté, non certifié, sans effet sur les niveaux.', [dep('primary', '/documents/0'), dep('primary', '/documents/1'), dep('primary', '/documents/2'), dep('comparison', ''), dep('live', '/data/items/0/results/0/data')]);
    if (/^news\.[0-3]\./.test(p)) return prov('bars', B, 'Variation de clôture à clôture lue sur les barres certifiées et comparée aux pairs et paniers sur la même séance ; cause attribuée au dépôt du jour ou à la presse financière citée, pas déduite des cours.', [dep('comparison', ''), dep('primary', '/documents/0'), dep('live', '/data/items/0/results/0/data')]);
    return null;
  },
  sectionDocs: { verdict: [1, 0, 2, 3], business: [3, 2, 1, 7], news: [1, 0, 8], earnings: [3, 1], capitalStructure: [2, 0, 1, 4, 5, 6, 10, 11], filingsReview: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], risks: [0, 1, 2, 10, 11], globalScore: [1], meta: [1], disclaimer: [1], macro: [1], social: [1], header: [2], insiders: [2], technicals: [1], performance: [1], timeline: [1, 0], tradeIdea: [1, 0] },
  score: { business: 30, technical: -14, capital: -10, calendar: -4, dilution: -8, risk: 50 },
  riskScoreReason: 'Jugement qualitatif sur dix : un acquéreur qui paie en actions une cible d’environ un tiers du nouvel ensemble, avec une clôture visée au premier semestre 2028, des autorisations réglementaires non nommées, une indemnité de rupture réglementaire de 3,2 Md$ à sa charge, un titre en baisse de près d’un tiers en trois séances, un multiple de revenus encore supérieur à la médiane de ses pairs, et un capital déjà exposé au bon de Google, aux actions de préférence de NVIDIA et au complément de prix de Celestial.',
  compose: c => require('./compose-mrvl.cjs')(c, x => { LAST = x; return x; }),
  groups: S.groups,
  eventDefault: { leader: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', direct_peer: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', upstream: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', downstream: 'Aucune publication datée dans la fenêtre collectée ; ses budgets d’investissement fixent la demande', second_order: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', sector_proxy: 'Panier sans publication propre ; exposé aux résultats de ses grandes pondérations' },
  eventRisk: { LITE: 'Premier trimestre publié le 2 novembre avec l’annonce : désormais suspendu au vote de ses actionnaires et aux autorisations', AMD: 'Résultats annoncés le 3 novembre (une seule source)', ALAB: 'Résultats annoncés le 3 novembre (une seule source) : premier pair direct à publier après l’annonce', ANET: 'Résultats annoncés le 3 novembre (une seule source) : commandes de commutateurs et de modules optiques', COHR: 'Résultats annoncés le 4 novembre (une seule source) : premier concurrent optique à parler après l’annonce', AAOI: 'Résultats annoncés le 5 novembre (une seule source)', NBIS: 'Résultats annoncés le 12 novembre (une seule source)', NVDA: 'Résultats annoncés le 17 novembre (une seule source)', CRDO: 'Résultats annoncés le 30 novembre (une seule source)', FN: 'Résultats annoncés le 2 novembre après la clôture (deux sources)' },
  blastDoc: 1,
  scenarios: c => require('./compose-mrvl.cjs').scenarios(c),
  contradictions: c => require('./compose-mrvl.cjs').contradictions(c),
  missingData: c => require('./compose-mrvl.cjs').missingData(c),
  limitations: ['Clôture de référence du 30 octobre : la séance du 2 novembre, jour de l’annonce, n’est lue que par des cotations de séance horodatées, non certifiées.', 'Agrégats GAAP au 1er août 2026 ; le troisième trimestre n’est publié qu’en revenus préliminaires.', 'Ratio de conversion, dilution et indemnités lus dans les 8-K ; la liste des autorisations réglementaires figure dans des annexes non publiées.', 'Multiples des pairs issus des statistiques courantes, relevées en instantané, sans historique daté.', 'Chaîne d’options relevée en séance le 2 novembre : seules les positions ouvertes et la douleur maximale sont publiées.'],
});
