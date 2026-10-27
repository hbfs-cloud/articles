'use strict';
// Dossier Alphabet (GOOGL) v3 au close du 2026-10-26, refonte complète de la fiche du 15 février 2026, construite le
// 27 octobre 2026 (gabarit R08, fiche FICO comme modèle de mise en page).
// Agrégats GAAP : douze mois glissants au 30 juin 2026 lus dans les données XBRL officielles de la SEC (companyfacts,
// 10-Q du 23 juillet inclus) = exercice 2025 + premier semestre 2026 − premier semestre 2025. Dette = obligations à long
// terme, part courante incluse (98,165 + 1,999 Md$ au 30 juin) ; trésorerie retenue = liquidités + titres de créance
// négociables (55,911 + 99,500 Md$). Les actions SpaceX cotées et les participations non cotées (Anthropic, selon la
// presse) restent HORS de la trésorerie : elles ne sont ni liquides ni cessibles à court terme.
// Actions = 12 230 millions au 15 juillet 2026 (couverture du 10-Q : 5 868 M de classe A, 835 M de B, 5 527 M de C) ; le
// snapshot statistique ne compte que la classe A.
// Barres certifiées Yahoo (plan analyse). Le chemin de lecture sans fenêtre servait une série tronquée au 21 juillet
// et sans la séance du 22 juillet 2026 : reconstruction ciblée de GOOGL seul (RefreshBars, jeton de portée refresh,
// effacé après usage) le 27 octobre à 10 h 06 UTC, contrôle des 300 séances, puis collecte.
const R = require('../../../../tools/lib/analysis-v3-r08.cjs');
const K = require('../../../../tools/lib/analysis-v3-kit.cjs');
const S = require('./static-googl.cjs');
const GEN = 'analyses/GOOGL/_runs/20261027/build-googl.cjs';
const REF = '2026-10-26';
const SHARES = 12230e6;

let LAST = null;
const getPath = (o, p) => p.split('.').reduce((n, k) => n == null ? undefined : n[k], o);
const quote = K.read('analyses/GOOGL/_data/instrument.json');
const SIP = K.findPath(quote, 'instrument_short_interest'), CALP = K.findPath(quote, 'instrument_calendar');
if (SIP == null || CALP == null) throw Error('relevé FINRA ou calendrier absent');

R.build({
  ticker: 'GOOGL', shortName: 'Alphabet', cik: 1652044, generator: GEN, mode: 'breakout', peers: true,
  extraInputs: [{ name: 'quote', path: 'analyses/GOOGL/_data/instrument.json' }],
  ref: REF, run: '20261027', asOf: '2026-10-27',
  xbrl: {
    ttm: {
      rev: ['Revenues'],
      ebit: ['OperatingIncomeLoss'],
      ni: ['NetIncomeLoss'],
      dna: ['Depreciation'],
      ocf: ['NetCashProvidedByUsedInOperatingActivities'],
      capex: ['PaymentsToAcquirePropertyPlantAndEquipment'],
      gains: ['EquitySecuritiesFvNiGainLoss'],
    },
    instant: {
      debtNc: ['LongTermDebtNoncurrent'],
      debtCur: ['LongTermDebtCurrent'],
      cashEq: ['CashAndCashEquivalentsAtCarryingValue'],
      debtSec: ['AvailableForSaleSecuritiesDebtSecurities'],
      equity: ['StockholdersEquity'],
    },
    da: ['dna'], debt: ['debtNc', 'debtCur'], cash: ['cashEq', 'debtSec'],
  },
  scenarioBasis: 'ebitda', scenarioMultiple: 16.7,
  valuationBasis: 'GAAP douze mois glissants au 30 juin 2026 (données XBRL officielles de la SEC) : chiffre d’affaires, résultat opérationnel et dépréciations = exercice 2025 + premier semestre 2026 − premier semestre 2025 ; EBITDA = résultat opérationnel + dépréciation des immobilisations ; dette = obligations à long terme, part courante incluse, au 30 juin 2026 ; trésorerie = liquidités + titres de créance négociables au 30 juin (actions SpaceX et participations non cotées exclues) ; 12 230 millions d’actions toutes classes au 15 juillet 2026 (10-Q). 16,7 fois l’EBITDA = médiane arrondie de Microsoft, Amazon, Meta, Oracle et Apple (statistiques relevées en instantané) : Alphabet payé comme ses voisins les moins chers, sur des profits inchangés ; ce n’est pas un objectif',
  shares: { value: SHARES, doc: 0 },
  levels: {
    trigger: { d: '2026-10-22', c: 2 },  // plus haut du 22 octobre, séance du recul de 3,2 %
    stop: { d: '2026-07-23', c: 3 },     // plus bas du 23 juillet, lendemain des résultats du deuxième trimestre
    abandon: { d: '2026-04-07', c: 2 },  // plus haut du 7 avril, bas du trou du 8 avril jamais comblé
    s1: { d: '2026-07-23', c: 3 }, s2: { d: '2026-04-07', c: 2 }, s3: { d: '2026-03-30', c: 3 },
    r1: { d: '2026-10-22', c: 2 },
    mid: { d: '2026-10-14', c: 2 },      // plus haut du 14 octobre, sommet d'octobre, premier obstacle
    r2: { d: '2026-08-04', c: 2 },       // plus haut du 4 août, sommet de la reprise d'après les résultats
    r3: { d: '2026-05-18', c: 2 },       // plus haut du 18 mai, plus haut sur un an
  },
  supports: ['s1', 's2', 's3'], resistances: ['r1', 'r2', 'r3'],
  targets: ({ lv }) => ({ tp1: lv('r2'), tp2: lv('r3'), range: null }),
  levelsMethod: 'Déclencheur = plus haut du 22 octobre ; stop = plus bas du 23 juillet, lendemain des résultats du deuxième trimestre ; seuil d’abandon = plus haut du 7 avril, bas du trou d’ouverture du 8 avril ; TP1 = plus haut du 4 août, sous le sommet du 5 août ; TP2 = plus haut du 18 mai, plus haut sur un an ; plafond d’achat = (TP1 + 1,5 × stop) / 2,5 arrondi au cent inférieur ; pourcentages depuis l’entrée ; R/R = gain / risque.',
  inventory: 87,
  reviewScope: 'Dépôts EDGAR d’Alphabet Inc. (CIK 1652044) du 27 octobre 2025 au 26 octobre 2026 : 87 formulaires hors déclarations d’initiés et avis de vente 144 (le 10-K de l’exercice 2025, trois 10-Q, seize 8-K, une déclaration d’enregistrement automatique S-3ASR, dix-sept suppléments 424B5 et sept 424B2 de prospectus, onze documents d’offre FWP, quatre inscriptions 8-A12B, la circulaire et ses compléments, les déclarations de détention 13G et 13F). Vérification par type de formulaire : S-3ASR du 1er juin (sans plafond, obligations et actions), suppléments 424B5 de juin (actions, actions de préférence convertibles) et d’août (programme au fil de l’eau), 424B2 et 8-K d’obligations. Onze pièces décisionnelles ouvertes et hachées : le 10-Q et le communiqué du deuxième trimestre, les communiqués des trois trimestres précédents, le 10-K de l’exercice 2025, le 8-K et le communiqué de la levée de capitaux de juin, le S-3ASR, le supplément du programme au fil de l’eau et le 8-K des obligations d’août.',
  docs: S.docs,
  needles: S.needles,
  route: (p, { prov, dep, B, N, lvPtr, TXP }) => {
    if (p === 'timeline.events.1.source' || p === 'timeline.events.1.detail') return prov('quote', CALP, 'Date lue dans le calendrier de l’instrument, recoupée par le calendrier de résultats collecté et par la copie archivée du communiqué d’Alphabet du 6 octobre 2026 (revision/ir-20261006-q3-call-date.html, conférence à 13 h 30 heure du Pacifique, soit 21 h 30 à Paris).', [dep('erisk', '/events/0/report_date')]);
    if (p.startsWith('options.')) return prov('erisk', '/events/0/implied_move_status', 'Mouvement implicite des résultats : statut du calendrier collecté après la clôture du 26 octobre (marché fermé, aucune cotation à parité) ; chaîne d’options facultative non retenue.');
    if (p.startsWith('insiders.')) return prov('insiders', TXP == null ? '' : TXP + '/coverage_status', 'Relevé officiel des formulaires 4 sur 365 jours : couverture incomplète (data_insufficient), aucun solde net affirmé.');
    if (p.startsWith('shortInterest.')) return prov('quote', SIP, 'Positions vendeuses au règlement FINRA du 15 octobre 2026 et jours de couverture FINRA ; rapportées aux 5 868 millions d’actions de classe A du 10-Q.', [dep('primary', '/documents/0')]);
    if (p.startsWith('tribunal.')) return prov('bars', B, 'Tribunal de la fiche : chaque chiffre plaidé est repris de la section qui le prouve (barres certifiées, dépôts SEC, agrégats GAAP, multiples collectés).', [dep('primary', '/documents/0'), dep('primary', '/documents/1')]);
    if (p.startsWith('bottomEstimation.')) return prov('bars', B, 'Planchers techniques lus sur les barres certifiées (plus bas du 23 juillet et du 30 mars, plus haut du 7 avril) ; plancher de valeur = médiane de l’EV/EBITDA de Microsoft, Amazon, Meta, Oracle et Apple (statistiques collectées) × EBITDA GAAP douze mois − dette + trésorerie, divisé par le nombre d’actions du 10-Q ; participations lues au 10-Q.', [dep('bars', lvPtr('s1')), dep('bars', lvPtr('s3')), dep('primary', '/documents/0')]);
    if (p.startsWith('timeline.')) return prov('quote', CALP, 'Date de publication du troisième trimestre lue dans le calendrier de l’instrument et confirmée par le communiqué d’Alphabet du 6 octobre 2026 ; autres dates : calendrier des comparables collecté, registre des événements macroéconomiques, plan de la fiche.', [dep('erisk', '/events/0/report_date'), dep('earn', '/events')]);
    const v = getPath(LAST, p); if (typeof v !== 'string') return null;
    if (/^news\.\d+\./.test(p)) return prov('bars', B, 'Variation de clôture à clôture lue sur les barres certifiées et comparée aux comparables sur la même séance ; faits de société lus dans les dépôts SEC ; cause attribuée à la presse citée, pas déduite des cours.', [dep('comparison', ''), dep('primary', '/documents/0'), dep('primary', '/documents/1')]);
    return null;
  },
  sectionDocs: { verdict: [1, 0, 3, 6], business: [1, 0, 4], news: [1, 0, 2, 8], earnings: [1, 5, 6, 7, 0], capitalStructure: [0, 2, 3, 9, 10, 8], filingsReview: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], risks: [0, 1, 6], globalScore: [1], meta: [1], disclaimer: [1], macro: [1], options: [1], social: [1], header: [0], shortInterest: [0], insiders: [0], technicals: [1], performance: [1], timeline: [1], bottomEstimation: [0], tradeIdea: [1, 0], tribunal: [0, 1] },
  score: { business: 24, technical: -12, capital: -6, calendar: -6, dilution: -3, risk: 50 },
  riskScoreReason: 'Jugement qualitatif sur dix : une entreprise très rentable (marge opérationnelle de 34 % au deuxième trimestre) dont le bénéfice publié est gonflé de moitié sur douze mois par des revalorisations de titres non encaissées ; un flux de trésorerie libre devenu négatif au deuxième trimestre sous le poids des investissements (195 à 205 Md$ prévus en 2026, selon la conférence du 22 juillet) ; une dette passée de 48,5 à 100,2 Md$ en six mois, plus 25 Md$ d’obligations en août ; une levée de capitaux propres qui met fin aux rachats ; une participation SpaceX désormais cotée, donc un résultat trimestriel exposé à son cours ; deux procès antitrust américains, l’un en appel, l’autre soumis depuis le 2 septembre à des remèdes de comportement ; résultats du troisième trimestre le 28 octobre, avant toute entrée.',
  compose: c => require('./compose-googl.cjs')(c, x => { LAST = x; return x; }),
  groups: S.groups,
  eventDefault: { leader: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; ses investissements restent le repère du secteur', direct_peer: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', upstream: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; lit les budgets d’investissement des hyperscalers', downstream: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', second_order: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', sector_proxy: 'Panier sans publication propre ; exposé aux résultats de ses grandes pondérations' },
  eventRisk: { MSFT: 'Résultats annoncés le 28 octobre, le même soir qu’Alphabet (une seule source) : Azure et ses investissements', AMZN: 'Résultats annoncés le 29 octobre (une seule source) : AWS, et la revalorisation de sa propre part d’Anthropic', PINS: 'Résultats annoncés le 29 octobre (une seule source) ; budgets publicitaires', RDDT: 'Résultats annoncés le 29 octobre (une seule source) ; trafic venu des moteurs de recherche', AAPL: 'Résultats annoncés le 2 novembre (une seule source) ; services, dont la recherche par défaut', BKNG: 'Résultats annoncés le 3 novembre (une seule source) ; dépenses de marketing payant', SNAP: 'Résultats annoncés le 4 novembre (une seule source)', EXPE: 'Résultats annoncés le 4 novembre (une seule source) ; dépenses de marketing payant', LITE: 'Résultats annoncés le 5 novembre (une seule source) ; commandes des hyperscalers', TTD: 'Résultats annoncés le 5 novembre (une seule source)' },
  blastDoc: 0,
  scenarios: c => require('./compose-googl.cjs').scenarios(c),
  contradictions: c => require('./compose-googl.cjs').contradictions(c),
  missingData: c => require('./compose-googl.cjs').missingData(c),
  limitations: ['Agrégats GAAP au 30 juin 2026 ; le troisième trimestre, clos le 30 septembre, sera publié le 28 octobre après la clôture.', 'Série Yahoo de GOOGL reconstruite côté serveur le 27 octobre (séance du 22 juillet absente du chemin de lecture sans fenêtre), contrôlée avant la collecte.', 'Multiples des pairs issus des statistiques courantes, relevées en instantané, sans historique daté.', 'Nom de la société non cotée revalorisée (Anthropic) connu par la presse citée ; le 10-Q dit seulement « une société non cotée ».', 'Effet du cours de SpaceX sur le troisième trimestre estimé au cours de bourse ; la valeur retenue par la société sera publiée avec ses comptes.'],
});
