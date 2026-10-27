'use strict';
// Dossier CrowdStrike (CRWD) v3 au close du 2026-10-26, refonte complète du 27 octobre 2026 (gabarit R08, fiche FICO
// comme modèle). La fiche précédente (27 septembre 2026 ; plan déclenché le 30 septembre puis arrêté au stop le
// 15 octobre) est archivée dans analyses/CRWD/archive/20260927/ et son JSON dans original/CRWD.json.
// Agrégats GAAP : douze mois glissants au 31 juillet 2026 lus dans les données XBRL officielles de la SEC (companyfacts,
// 10-Q du 27 août inclus) = exercice clos le 31 janvier 2026 + semestre clos le 31 juillet 2026 − semestre clos le
// 31 juillet 2025. Valorisation par les revenus : le résultat opérationnel GAAP est négatif, l'EBITDA n'a pas de sens.
// Dette = obligations à 3,00 % 2029 et passifs de location au 31 juillet ; trésorerie = liquidités au 31 juillet.
// Actions = 1 023 934 842 au 20 août 2026 (page de garde du 10-Q), base après le fractionnement de quatre pour une du
// 1er juillet 2026 ; les barres certifiées sont déjà ajustées (contrôle du 27 octobre : aucune séance manquante).
const fs = require('fs'), path = require('path');
const R = require('../../../../tools/lib/analysis-v3-r08.cjs');
const K = require('../../../../tools/lib/analysis-v3-kit.cjs');
const S = require('./static-crwd.cjs');
const GEN = 'analyses/CRWD/_runs/20261027/build-crwd.cjs';
const REF = '2026-10-26';
const SHARES = 1023934842;

let LAST = null;
const getPath = (o, p) => p.split('.').reduce((n, k) => n == null ? undefined : n[k], o);
// Pointeurs des blocs de calendrier et de positions vendeuses dans les artefacts collectés.
const QUOTE = K.read('analyses/CRWD/_data/instrument.json');
const CAL_PTR = K.findPath(QUOTE, 'instrument_calendar'), SI_PTR = K.findPath(QUOTE, 'instrument_short_interest');

R.build({
  ticker: 'CRWD', shortName: 'CrowdStrike', cik: 1535527, generator: GEN, mode: 'breakout', peers: true,
  extraInputs: [{ name: 'quote', path: 'analyses/CRWD/_data/instrument.json' }],
  ref: REF, run: '20261027', asOf: '2026-10-27',
  xbrl: {
    ttm: {
      rev: ['RevenueFromContractWithCustomerIncludingAssessedTax'],
      ebit: ['OperatingIncomeLoss'],
      ni: ['NetIncomeLoss'],
      ocf: ['NetCashProvidedByUsedInOperatingActivities'],
      capex: ['PaymentsToAcquirePropertyPlantAndEquipment'],
      sbc: ['ShareBasedCompensation'],
      capsw: ['PaymentsToDevelopSoftware'],
    },
    instant: {
      cashEq: ['CashAndCashEquivalentsAtCarryingValue'],
      ltDebt: ['LongTermDebtNoncurrent'],
      leaseCur: ['OperatingLeaseLiabilityCurrent'],
      leaseNon: ['OperatingLeaseLiabilityNoncurrent'],
    },
    da: [], debt: ['ltDebt', 'leaseCur', 'leaseNon'], cash: ['cashEq'],
  },
  scenarioBasis: 'revenue', scenarioMultiple: 27.8,
  valuationBasis: 'GAAP douze mois glissants au 31 juillet 2026 (données XBRL officielles de la SEC) : revenus = exercice clos le 31 janvier 2026 + semestre clos le 31 juillet 2026 − semestre clos le 31 juillet 2025 ; dette = obligations à 3,00 % échéance 2029 et passifs de location au 31 juillet ; trésorerie = liquidités au 31 juillet ; 1 023 934 842 actions au 20 août 2026 (10-Q). Valorisation par les revenus : le résultat opérationnel GAAP est négatif. 27,8 fois les revenus = valeur d’entreprise sur revenus de Palo Alto Networks arrondie, statistique relevée en instantané le 27 octobre : CrowdStrike payé comme le premier éditeur du secteur, sur des revenus inchangés ; ce n’est pas un objectif',
  shares: { value: SHARES, doc: 1 },
  levels: {
    trigger: { d: '2026-09-22', c: 2 },  // 250,80 : plus haut du 22 septembre, haut de la base cassée le 23 septembre, perdu le 15 octobre et repris le 23
    gate: { d: '2026-10-22', c: 2 },     // 246,36 : plus haut du 22 octobre ; pas d'ordre un jour d'ouverture sous ce niveau
    stop: { d: '2026-10-23', c: 3 },     // 234,79 : plus bas du 23 octobre, séance du bond sectoriel
    abandon: { d: '2026-10-20', c: 3 },  // 221,36 : plus bas du 20 octobre, creux de la correction d'octobre
    s1: { d: '2026-10-26', c: 3 },       // 254,06 : plus bas du 26 octobre
    s2: { d: '2026-09-22', c: 2 },       // 250,80 : haut de la base de septembre, prix de l'ordre d'achat
    s3: { d: '2026-10-23', c: 3 },       // 234,79 : plus bas du 23 octobre
    r1: { d: '2026-10-26', c: 2 },       // 264,39 : plus haut du 26 octobre
    r2: { d: '2026-10-12', c: 2 },       // 276,39 : plus haut du 12 octobre, dernier sommet avant la cassure du 14
    r3: { d: '2026-10-06', c: 2 },       // 286,99 : plus haut historique du 6 octobre
  },
  supports: ['s1', 's2', 's3'], resistances: ['r1', 'r2', 'r3'],
  targets: ({ lv }) => ({ tp1: lv('r2'), tp2: lv('r3'), range: null }),
  levelsMethod: 'Entrée = ordre d’achat limité au plus haut du 22 septembre (haut de la base cassée le 23 septembre, perdu le 15 octobre, repris le 23), qui est aussi le pire prix d’exécution ; garde-fou d’ouverture = plus haut du 22 octobre ; stop = plus bas du 23 octobre, ordre au cent inférieur ; seuil d’abandon du dossier = plus bas du 20 octobre ; TP1 = plus haut du 12 octobre ; TP2 = plus haut du 6 octobre, plus haut sur un an ; pourcentages depuis l’entrée ; R/R = gain / risque.',
  inventory: 20,
  reviewScope: 'Dépôts EDGAR de CrowdStrike Holdings (CIK 1535527) du 27 octobre 2025 au 26 octobre 2026 : 20 formulaires hors déclarations d’initiés et avis de vente 144 (le 10-K de l’exercice clos le 31 janvier 2026, trois 10-Q, huit 8-K, le S-3ASR de revente du 11 septembre, le S-8 du 5 mars, la circulaire, son complément et l’avis préliminaire, le rapport annuel et deux déclarations de détention 13G). Aucun S-3 d’émission ni supplément 424B de la société sur la période ; une émission privée de 2 118 022 actions le 8 septembre (rachat des actifs de XM Cyber), enregistrée à la revente. Douze pièces décisionnelles ouvertes et hachées, dont l’avis 144 de George Kurtz du 19 octobre et le formulaire 4 du directeur financier du 25 septembre, choisis parmi 187 formulaires 4 et 50 avis 144 de l’année, et le communiqué de décembre 2025 pour la base du troisième trimestre. Aucun dépôt décisionnel nouveau de la société depuis le 11 septembre',
  docs: S.docs,
  needles: S.needles,
  route: (p, { prov, dep, B, N, lvPtr, TXP }) => {
    if (p.startsWith('insiders.')) return prov('insiders', TXP == null ? '' : TXP + '/transactions', 'Formulaires 4 relevés sur 365 jours (couverture officielle incomplète, data_insufficient) : ventes cumulées par dirigeant sur les fenêtres citées ; avis 144 du 19 octobre lu dans le dépôt haché ; aucun solde net affirmé.', [dep('primary', '/documents/2'), dep('primary', '/documents/3')]);
    if (p.startsWith('shortInterest.')) return prov('quote', SI_PTR, 'Positions vendeuses FINRA au règlement du 15 octobre 2026 et jours de couverture FINRA ; part du flottant = positions / flottant du snapshot statistique.', [dep('fund', K.findPath(K.read('analyses/CRWD/_data/fundamentals.json'), 'instrument_comprehensive_stats') || '')]);
    if (p.startsWith('tribunal.')) return prov('bars', B, 'Tribunal de la fiche : chaque chiffre plaidé est repris de la section qui le prouve (barres certifiées, dépôts SEC, agrégats GAAP, multiples collectés).', [dep('primary', '/documents/0'), dep('primary', '/documents/1'), dep('comparison', '')]);
    if (p.startsWith('bottomEstimation.')) return prov('bars', B, 'Planchers techniques lus sur les barres certifiées (plus bas du 23 et du 20 octobre) ; plancher de valeur = valeur d’entreprise sur revenus de Palo Alto Networks (statistique collectée) × revenus GAAP douze mois − dette + trésorerie, divisé par le nombre d’actions du 10-Q ; grille aux multiples cités.', [dep('bars', lvPtr('s3')), dep('bars', lvPtr('abandon')), dep('primary', '/documents/1'), dep('context', '')]);
    if (p.startsWith('archiveHistory.')) return prov('status', '/captured_at', 'Dates et notes des versions archivées de la fiche (analyses/CRWD/archive/), métadonnées éditoriales et non observations de marché.');
    if (p.startsWith('timeline.') || p === 'earnings.nextEarnings') return prov('quote', CAL_PTR, 'Prochaine publication de CrowdStrike lue dans le bloc calendrier de l’instrument (une seule source, non confirmée par la société) ; publications passées du troisième trimestre lues dans l’inventaire EDGAR (8-K de résultats des 28 novembre 2023, 26 novembre 2024 et 2 décembre 2025) ; dates des comparables lues dans le calendrier collecté de quatorze jours et, pour Palo Alto et Zscaler, dans leurs blocs calendrier (fichier de contexte, une seule source) ; rendez-vous macro lus dans data/scheduled-events.json (Réserve fédérale, BLS) ; bornes du plan fixées par la fiche.', [dep('earn', '/events'), dep('primary', '/documents/6')]);
    if (/^blastRadius\.groups\.\d+\.symbols\.\d+\.eventRisk$/.test(p) && /19 novembre|24 novembre/.test(getPath(LAST, p) || '')) return prov('earn', '/events', 'Date lue dans le bloc calendrier du comparable (fichier de contexte de la collecte, une seule source), au-delà de la fenêtre de quatorze jours du calendrier filtré.');
    const v = getPath(LAST, p); if (typeof v !== 'string') return null;
    // Séances citées dans les nouvelles : variations de clôture à clôture lues sur les barres certifiées du titre et des
    // comparables ; causes attribuées à la presse ou aux dépôts cités, pas déduites des cours.
    if (/^news\.\d+\./.test(p)) return prov('bars', B, 'Variations de clôture à clôture lues sur les barres certifiées de CrowdStrike et des comparables sur la même séance ; cause attribuée à la presse ou au dépôt cités, pas déduite des cours.', [dep('comparison', ''), dep('primary', '/documents/2')]);
    return null;
  },
  sectionDocs: { verdict: [0, 1, 2, 3], business: [0, 1, 5, 6], news: [0, 2], earnings: [0, 6, 1], capitalStructure: [1, 4, 9, 10, 11, 7, 8], filingsReview: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], risks: [1, 0, 2, 3, 4], globalScore: [0], meta: [0], disclaimer: [0], macro: [0], options: [0], social: [0], header: [1], technicals: [0], performance: [0], fundamentals: [0, 1] },
  score: { business: 26, technical: -2, capital: 0, calendar: -6, dilution: -6, risk: 36 },
  riskScoreReason: 'Jugement qualitatif sur dix : une entreprise de très haute qualité (ARR en accélération au deuxième trimestre, flux libre record, aucun client à 10 % des revenus, trésorerie nette) mais un prix qui suppose une croissance parfaite (valeur d’entreprise proche de 49 fois les revenus GAAP), un résultat opérationnel GAAP négatif, une rémunération en actions qui absorbe l’essentiel du flux libre, des demandes d’information du ministère de la Justice et de la SEC qui portent sur l’ARR lui-même, le procès de Delta, des dirigeants vendeurs par plans programmés, un titre exposé aux annonces des laboratoires d’intelligence artificielle et en retard sur son panier depuis le 6 octobre, et des résultats de Palo Alto le 19 novembre et de CrowdStrike le 1er décembre selon une seule source',
  compose: c => require('./compose-crwd.cjs')(c, x => { LAST = x; return x; }),
  groups: S.groups,
  eventDefault: {
    leader: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; ses annonces de plateforme donnent le ton concurrentiel',
    direct_peer: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; ses commentaires de demande valent pour le segment',
    upstream: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; ses tarifs d’hébergement pèsent sur la marge',
    second_order: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; ses commentaires sur les budgets restent le signal',
    sector_proxy: 'Panier sans publication propre ; exposé aux résultats de ses grandes pondérations',
  },
  eventRisk: {
    MSFT: 'Résultats annoncés le 28 octobre (une seule source) : Defender, Azure et budgets informatiques',
    FTNT: 'Résultats annoncés le 28 octobre (une seule source) : première lecture des budgets de sécurité du trimestre',
    TENB: 'Résultats annoncés le 28 octobre (une seule source) : demande de gestion des vulnérabilités',
    NOW: 'Résultats annoncés le 28 octobre (une seule source) : budgets logiciels des grandes entreprises',
    AMZN: 'Résultats annoncés le 29 octobre (une seule source) : croissance d’AWS et capacité des centres de données',
    CTSH: 'Résultats annoncés le 29 octobre (une seule source) : dépenses d’intégration des grands comptes',
    CHKP: 'Résultats annoncés le 2 novembre (une seule source) : demande en pare-feu et sécurité réseau',
    DDOG: 'Résultats annoncés le 4 novembre (une seule source) : croissance des charges hébergées',
    NET: 'Résultats annoncés le 5 novembre (une seule source) : multiple accepté pour la croissance',
    QLYS: 'Résultats annoncés le 9 novembre (une seule source) : pression des plateformes sur les petits acteurs',
    PANW: 'Résultats annoncés le 19 novembre par son bloc calendrier (une seule source), trois jours après la sortie obligatoire du plan',
    ZS: 'Résultats annoncés le 24 novembre par son bloc calendrier (une seule source), après la sortie obligatoire du plan',
  },
  blastDoc: 1,
  scenarios: c => require('./compose-crwd.cjs').scenarios(c),
  contradictions: c => require('./compose-crwd.cjs').contradictions(c),
  missingData: c => require('./compose-crwd.cjs').missingData(c),
  limitations: [
    'Agrégats GAAP au 31 juillet 2026 ; le troisième trimestre de l’exercice 2027, clos le 31 octobre, n’est pas encore publié.',
    'Multiples des pairs issus des statistiques courantes, relevées en instantané le 27 octobre, sans historique daté.',
    'Formulaires 4 : couverture officielle incomplète sur l’année ; les ventes citées sont des minima relevés, l’avis 144 du 19 octobre complète le rythme du directeur général.',
    'Dates de résultats de Palo Alto et Zscaler lues dans leurs blocs calendrier, source de contexte non gouvernante : elles servent à fixer la sortie, pas un chiffre.',
    'Chaîne d’options relevée marché fermé, non retenue ; aucune publication de CrowdStrike dans la fenêtre de quatorze jours, donc aucun mouvement implicite aux résultats.',
    'Causes des séances sectorielles connues par la presse financière citée, pas par un dépôt de la société.',
  ],
});
