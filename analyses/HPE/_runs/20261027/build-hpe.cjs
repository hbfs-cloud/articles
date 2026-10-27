'use strict';
// Dossier Hewlett Packard Enterprise (HPE) v3 au close du 2026-10-26, refonte complète du 27 octobre 2026 (gabarit R08,
// modèle de la fiche FICO). La fiche précédente (25 septembre, runs 20260924 et 20260927) avait un plan d'achat au-dessus
// de 65,65 $ arrêté le 15 octobre ; son JSON est conservé dans original/ et sa page dans archive/20260925/.
// Agrégats GAAP : douze mois glissants au 31 juillet 2026 lus dans les données XBRL officielles de la SEC (companyfacts,
// 10-Q du 3 septembre inclus) = exercice clos le 31 octobre 2025 + neuf mois de l'exercice 2026 − neuf mois de 2025.
// Dette = emprunts à court et long terme au 31 juillet (division de financement et titres adossés compris) ; trésorerie =
// liquidités du 31 juillet. Actions = 1 327 464 779 ordinaires au 27 août (10-Q) + 76,056 millions issues de la conversion
// obligatoire des préférentielles au taux minimal (30 millions × 2,5352, cours très au-dessus du seuil de 19,72 $).
// Client coté documenté : Oracle (bon de souscription du 2 juillet 2026, note du 10-Q) ; série collectée à part.
const R = require('../../../../tools/lib/analysis-v3-r08.cjs');
const S = require('./static-hpe.cjs');
const GEN = 'analyses/HPE/_runs/20261027/build-hpe.cjs';
const REF = '2026-10-26';
const COMMON = 1327464779, PREF_CONV = 30e6 * 2.5352;

let LAST = null;
const getPath = (o, p) => p.split('.').reduce((n, k) => n == null ? undefined : n[k], o);

R.build({
  ticker: 'HPE', shortName: 'Hewlett Packard Enterprise', cik: 1645590, generator: GEN, mode: 'breakout', peers: true, clientBars: true,
  extraInputs: [
    { name: 'quote', path: 'analyses/HPE/_data/instrument.json' },
    { name: 'regime', path: 'analyses/HPE/_data/market_regime.json' },
  ],
  ref: REF, run: '20261027', asOf: '2026-10-27',
  xbrl: {
    ttm: {
      rev: ['Revenues'],
      ebit: ['OperatingIncomeLoss'],
      ni: ['NetIncomeLoss'],
      da: ['DepreciationDepletionAndAmortization'],
      ocf: ['NetCashProvidedByUsedInOperatingActivities'],
    },
    instant: {
      ltd: ['LongTermDebtNoncurrent'],
      std: ['DebtCurrent'],
      cashEq: ['CashAndCashEquivalentsAtCarryingValue'],
      equity: ['StockholdersEquity'],
    },
    da: ['da'], debt: ['ltd', 'std'], cash: ['cashEq'],
  },
  scenarioBasis: 'ebitda', scenarioMultiple: 13.8,
  valuationBasis: 'GAAP douze mois glissants au 31 juillet 2026 (données XBRL officielles de la SEC) : chiffre d’affaires, résultat opérationnel, amortissements et bénéfice net = exercice clos le 31 octobre 2025 + neuf mois de l’exercice 2026 − neuf mois de l’exercice 2025 ; EBITDA = résultat opérationnel + dépréciations et amortissements, ceux des équipements loués par la division de financement compris ; gain de 444 M$ sur la cession de H3C hors résultat opérationnel, donc hors EBITDA ; dette = emprunts à court et long terme au 31 juillet 2026, financement et titres adossés compris ; trésorerie = liquidités au 31 juillet ; 1 327 464 779 actions ordinaires au 27 août 2026 plus 76,056 millions issues de la conversion obligatoire des préférentielles au taux minimal. 13,8 fois l’EBITDA = médiane arrondie de Dell (17,9×) et Super Micro (9,7×), les deux assembleurs de serveurs cotés aux États-Unis que nomme le 10-K, statistiques relevées en instantané : HPE payé comme un assembleur moyen, sans prime pour le réseau ; ce n’est pas un objectif',
  shares: { value: COMMON + PREF_CONV, doc: 0 },
  levels: {
    trigger: { d: '2026-10-21', c: 2 },  // plus haut du 21 octobre, sommet de la base de sept séances
    stop: { d: '2026-10-22', c: 3 },     // plus bas du 22 octobre, plancher de la base
    abandon: { d: '2026-10-22', c: 3 },  // même plancher : une clôture dessous défait la base
    s1: { d: '2026-10-26', c: 3 },       // plus bas du 26 octobre
    s2: { d: '2026-09-02', c: 3 },       // plus bas du 2 septembre, veille des résultats, départ de la hausse vers 73,56 $
    s3: { d: '2026-09-03', c: 3 },       // plus bas du 3 septembre, séance des résultats
    r1: { d: '2026-10-15', c: 2 },       // plus haut du 15 octobre, lendemain de la dégradation
    x1: { d: '2026-10-14', c: 2 },       // plus haut du 14 octobre, séance de la dégradation
    r2: { d: '2026-10-13', c: 4 },       // clôture du 13 octobre, point de départ de la chute
    r3: { d: '2026-10-09', c: 2 },       // plus haut du 9 octobre, sommet de la série
  },
  supports: ['stop', 's2', 's3'], resistances: ['r1', 'x1', 'r2'],
  targets: ({ lv }) => ({ tp1: lv('r2'), tp2: lv('r3'), range: null }),
  levelsMethod: 'Déclencheur = plus haut du 21 octobre, sommet de la base de sept séances formée après la chute ; stop et seuil d’abandon = plus bas du 22 octobre, plancher de cette base ; TP1 = clôture du 13 octobre, point de départ de la chute ; TP2 = plus haut du 9 octobre, sommet de la série ; plafond d’achat = (TP1 + 1,5 × stop) / 2,5 arrondi au cent inférieur ; pourcentages depuis l’entrée ; R/R = gain / risque.',
  inventory: 36,
  reviewScope: 'Dépôts EDGAR de Hewlett Packard Enterprise (CIK 1645590) du 27 octobre 2025 au 26 octobre 2026 : 36 formulaires hors déclarations d’initiés et avis de vente 144 (le 10-K de l’exercice 2025, trois 10-Q, dix-huit 8-K, la circulaire et ses deux compléments, le rapport annuel, le 11-K, le S-8 du plan salarié, le formulaire SD, un prospectus 424B5, un 424B2, un FWP et quatre déclarations de détention 13G). Vérification par type : aucun S-3 ni S-3ASR nouveau ; l’étagère universelle S-3ASR du 22 décembre 2023 reste la seule, utilisée en mars 2026 pour de la dette ; aucun programme de vente d’actions au fil de l’eau. Treize pièces décisionnelles ouvertes et hachées, dont quatre formulaires 4 de dirigeants (toutes leurs ventes relèvent de plans programmés adoptés en juin).',
  docs: S.docs,
  needles: S.needles,
  route: (p, { prov, dep, B, N, lvPtr, TXP }) => {
    if (p.startsWith('options.')) return prov('quote', '/data/items/27', 'Volume d’options de la séance du 26 octobre (calls, puts, ratio) relevé avec l’instrument ; chaîne relevée marché fermé, intérêt ouvert nul, aucun autre chiffre retenu.', [dep('quote', '/data/items/25')]);
    if (p.startsWith('insiders.')) return prov('primary', '/documents/6', 'Formulaires 4 ouverts sur EDGAR (ventes du directeur général les 11 septembre et 5 octobre, du patron du réseau les 29 septembre et 21 octobre, avec la date d’adoption de leurs plans) ; vente de l’administrateur du 14 septembre lue au relevé officiel des formulaires 4 ; prix d’adoption = clôtures certifiées du 4 et du 30 juin ; montants = actions × prix moyen pondéré déclaré.', [dep('primary', '/documents/7'), dep('primary', '/documents/11'), dep('primary', '/documents/12'), dep('insiders', TXP == null ? '' : TXP + '/transactions')]);
    if (p.startsWith('shortInterest.')) return prov('quote', '/data/items/18', 'Positions vendeuses au règlement FINRA du 15 octobre 2026 ; flottant publié par le fournisseur (statistiques collectées) ; part du flottant = positions / flottant. Règlements antérieurs (30 septembre, pic du 30 janvier) lus dans la série FINRA de vingt-quatre règlements de la collecte complémentaire du run (short_squeeze.json), source non exigée, citée à titre descriptif.', [dep('fund', '/data/items/0/results/2/data/0/floatShares')]);
    if (p.startsWith('earnings.quarters.')) return prov('fund', '/data/items/0/results/5/data/0/quarters', 'Bénéfice ajusté publié et consensus par trimestre (relevé des surprises de bénéfice) ; trimestres datés par les 8-K item 2.02 du relevé des réactions aux résultats.', [dep('fund', '/data/items/0/results/4/data/0/reactions')]);
    if (p.startsWith('business.coverageMatrix.')) return prov('fund', '/data/items/0/results/8/data/0', 'Matrice de couverture : nombre d’analystes et objectif moyen (relevé du 27 octobre), détention institutionnelle, surprises de bénéfice et relevé FINRA tirés des sources collectées ; actions d’analystes datées lues au relevé complémentaire de la collecte.', [dep('fund', '/data/items/0/results/9/data/0'), dep('fund', '/data/items/0/results/5/data/0'), dep('quote', '/data/items/18')]);
    if (/^news\.3\./.test(p)) return prov('bars', B, 'Bon de souscription lu dans le 10-Q ; valeur = actions × clôture certifiée du 2 juillet et du 26 octobre.', [dep('primary', '/documents/0')]);
    if (p.startsWith('archiveHistory.')) return prov('status', '/captured_at', 'Dates des versions précédentes de la fiche, conservées dans archive/ ; horodatage de la refonte.');
    if (p.startsWith('timeline.')) return prov('earn', '/events', 'Dates des pairs : calendrier de résultats collecté sur quatorze jours, une seule source, non confirmé par les émetteurs ; rendez-vous macro : data/scheduled-events.json et daily/20261022/primary-reference.json (Réserve fédérale, BLS) ; fin du plan : niveaux de la fiche ; dernière publication de HPE : 8-K du 4 décembre 2025.', [dep('primary', '/documents/8')]);
    if (p.startsWith('tribunal.')) return prov('bars', B, 'Tribunal de la fiche : chaque chiffre plaidé est repris de la section qui le prouve (barres certifiées, dépôts SEC, agrégats GAAP, multiples collectés).', [dep('primary', '/documents/0'), dep('primary', '/documents/1')]);
    if (p.startsWith('bottomEstimation.')) return prov('bars', B, 'Planchers techniques lus sur les barres certifiées (plus bas du 22 octobre, du 2 et du 3 septembre) ; plancher de valeur = 13,8 fois l’EBITDA GAAP douze mois, moins 1,0 Md$ dans le cas pessimiste (hausse annuelle du résultat des serveurs et du cloud au troisième trimestre, 10-Q), moins la dette, plus la trésorerie, divisé par les actions préférentielles converties.', [dep('bars', lvPtr('stop')), dep('bars', lvPtr('s2')), dep('bars', lvPtr('s3')), dep('primary', '/documents/0'), dep('context', '')]);
    if (p.startsWith('macro.impact')) return prov('regime', '/facets/regime/current_state_confidence', 'État de régime relevé le 27 octobre (appétit pour le risque, confiance 0,519) ; rendements des comparables sur vingt et une séances lus sur les barres certifiées.', [dep('bars', B), dep('comparison', '')]);
    const v = getPath(LAST, p); if (typeof v !== 'string') return null;
    if (/^news\.0\./.test(p)) return prov('bars', B, 'Dégradation, objectif et motifs cités par la presse financière ; variations de clôture à clôture et écart d’ouverture lus sur les barres certifiées de HPE, des comparables et d’Oracle.', [dep('comparison', ''), dep('client', '')]);
    if (/^news\.[24]\./.test(p)) return prov('bars', B, 'Variations de clôture à clôture et écarts d’ouverture lus sur les barres certifiées ; contenu de l’annonce lu dans le dépôt SEC cité.', [dep('primary', '/documents/1'), dep('primary', '/documents/2')]);
    return null;
  },
  sectionDocs: { verdict: [1, 0, 2, 6], business: [0, 1, 2, 3], news: [6, 7, 11, 0], earnings: [1, 8, 0], capitalStructure: [0, 3, 4, 5, 9], filingsReview: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], risks: [0, 1, 2, 6], globalScore: [1, 0], meta: [1], disclaimer: [1], macro: [1], options: [1], social: [1], header: [0], shortInterest: [0], insiders: [12, 6, 7, 11], technicals: [1], performance: [1], timeline: [8, 1], bottomEstimation: [0], archiveHistory: [0] },
  score: { business: 21, technical: -8, capital: -3, calendar: -5, dilution: -2, risk: 40 },
  riskScoreReason: 'Jugement qualitatif sur dix : un titre multiplié par 3,7 en sept mois et demi puis amputé d’un quart en cinq séances ; une hausse des profits que le 10-Q attribue pour l’essentiel au segment exposé au prix de la mémoire et des SSD, réversible quand ces prix se détendront ; 30,4 Md$ d’achats engagés et des stocks presque doublés ; trois écarts d’ouverture de plus de 8 % en un an ; des ventes de dirigeants par plans programmés, sans aucun achat ; quatre publications de pairs et les résultats de HPE, non datés par la société, à l’horizon du plan.',
  compose: c => require('./compose-hpe.cjs')(c, x => { LAST = x; return x; }),
  groups: S.groups,
  eventDefault: { leader: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; ses commandes de serveurs restent le signal à suivre', direct_peer: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; ses prix et ses marges restent le signal à suivre', upstream: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; prix et allocations des composants à suivre', downstream: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; ses dépenses d’investissement restent le signal', second_order: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', sector_proxy: 'Panier sans publication propre ; exposé aux résultats de ses grandes pondérations' },
  eventRisk: {
    EXTR: 'Résultats annoncés le 28 octobre (une seule source) : premier chiffre du trimestre sur le réseau de campus',
    FTNT: 'Résultats annoncés le 28 octobre (une seule source) ; lecture sur la sécurité réseau',
    INTC: 'Résultats annoncés le 29 octobre (une seule source) : demande de processeurs pour les serveurs classiques',
    SNDK: 'Résultats annoncés le 29 octobre (une seule source) : prix des SSD, l’un des deux composants qui gonflent le prix des serveurs',
    SMCI: 'Résultats annoncés le 3 novembre (une seule source) : premier assembleur de serveurs d’IA à publier après la dégradation de Barclays',
    ANET: 'Résultats annoncés le 3 novembre (une seule source) : commutateurs des centres de données, concurrent direct de Juniper',
    AMD: 'Résultats annoncés le 3 novembre (une seule source) ; partenaire de la baie Helios commandée par Vultr',
  },
  blastDoc: 3,
  scenarios: c => require('./compose-hpe.cjs').scenarios(c),
  contradictions: c => require('./compose-hpe.cjs').contradictions(c),
  missingData: c => require('./compose-hpe.cjs').missingData(c),
  limitations: ['Agrégats GAAP au 31 juillet 2026 ; le quatrième trimestre de l’exercice, clos le 31 octobre, n’est pas publié et sa date n’est pas annoncée.', 'Les douze mois glissants incluent le quatrième trimestre 2025, presque à l’équilibre opérationnel (−8 M$) après l’intégration de Juniper : l’EBITDA GAAP sous-estime le rythme actuel.', 'Multiples des pairs issus des statistiques courantes, relevées en instantané, sans historique daté.', 'Motifs de la dégradation de Barclays connus par la presse financière citée, pas par un dépôt.', 'Chaîne d’options relevée marché fermé, sans intérêt ouvert exploitable.'],
});
