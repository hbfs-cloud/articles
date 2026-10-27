'use strict';
// Dossier Robinhood Markets (HOOD) v3 au close du 2026-10-26, refonte complète du 27 octobre 2026 (gabarit R08, modèle FICO).
// Agrégats GAAP : douze mois glissants au 30 juin 2026 lus dans les données XBRL officielles de la SEC (companyfacts) =
// exercice 2025 (10-K/A) + six mois 2026 − six mois 2025. Robinhood ne publie pas de résultat opérationnel us-gaap : le
// résultat avant impôts sert de résultat d'exploitation (EBITDA = résultat avant impôts + amortissements). Dette = obligations
// convertibles (valeur nette comptable, seule dette financière ; aucun tirage sur les lignes de crédit au 30 juin) ; la dette du
// trust de cartes de crédit, adossée aux créances, et les soldes des clients ne sont pas de la dette du groupe. Trésorerie =
// liquidités de la société au 30 juin. Actions = 790 630 234 A + 108 452 039 B au 23 juillet 2026 (10-Q).
// Barres certifiées Yahoo (plan analyse). Les séances du 21 et du 24 juillet 2026 manquaient au magasin du serveur pour HOOD,
// FUTU, VIRT, NDAQ et ICE (même trou que FICO la veille) et la source Tiingo était en pause : reconstruction ciblée de ces cinq
// symboles (RefreshBars, jeton de portée refresh, effacé après usage) le 27 octobre vers 10 h 06 UTC, contrôle des séances
// du 17 au 28 juillet, puis collecte complète.
// Résultats du troisième trimestre : mardi 27 octobre 2026 après la clôture de New York, date confirmée par le communiqué de
// la société du 1er octobre (texte conservé dans analyses/HOOD/_primary/ir/) et par le calendrier collecté. Aucun 8-K depuis le
// 29 juillet : les données mensuelles d'activité (juillet, août) sont des communiqués, pas des dépôts.
const R = require('../../../../tools/lib/analysis-v3-r08.cjs');
const K = require('../../../../tools/lib/analysis-v3-kit.cjs');
const S = require('./static-hood.cjs');
const GEN = 'analyses/HOOD/_runs/20261027/build-hood.cjs';
const REF = '2026-10-26';
const SHARES = 899082273;
const QP = K.findPath(K.read('analyses/HOOD/_data/instrument.json'), 'instrument_short_interest');
const SURP = K.findPath(K.read('analyses/HOOD/_data/fundamentals.json'), 'instrument_earnings_surprises');

let LAST = null;
const getPath = (o, p) => p.split('.').reduce((n, k) => n == null ? undefined : n[k], o);

R.build({
  ticker: 'HOOD', shortName: 'Robinhood', cik: 1783879, generator: GEN, mode: 'breakout', peers: true,
  extraInputs: [{ name: 'quote', path: 'analyses/HOOD/_data/instrument.json' }],
  ref: REF, run: '20261027', asOf: '2026-10-27',
  xbrl: {
    ttm: {
      rev: ['Revenues'],
      ebit: ['IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest'],
      ni: ['NetIncomeLoss'],
      dna: ['DepreciationDepletionAndAmortization'],
    },
    instant: {
      convNotes: ['ConvertibleDebtNoncurrent'],
      cashEq: ['CashAndCashEquivalentsAtCarryingValue'],
      equity: ['StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
    },
    da: ['dna'], debt: ['convNotes'], cash: ['cashEq'],
  },
  scenarioBasis: 'ebitda', scenarioMultiple: 18.1,
  valuationBasis: 'GAAP douze mois glissants au 30 juin 2026 (données XBRL officielles de la SEC) : revenus, résultat avant impôts, amortissements et bénéfice net = exercice 2025 + six mois 2026 − six mois 2025 ; Robinhood ne publie pas de résultat opérationnel : EBITDA = résultat avant impôts + amortissements ; dette = obligations convertibles à 0 % échéance 2029 (valeur nette comptable au 30 juin), seule dette financière ; trésorerie = liquidités de la société au 30 juin, hors fonds des clients ; 899 082 273 actions A et B au 23 juillet 2026 (10-Q). 18,1 fois l’EBITDA = médiane de CME, Nasdaq, Cboe et ICE arrondie, statistiques relevées en instantané : Robinhood payé comme une bourse mûre, sur des profits inchangés ; ce n’est pas un objectif',
  shares: { value: SHARES, doc: 0 },
  levels: {
    trigger: { d: '2026-10-16', c: 2 },  // plus haut du 16 octobre, sommet du rebond qui a suivi la dégradation du 14
    stop: { d: '2026-10-15', c: 3 },     // plus bas du 15 octobre, bas de la zone de soutien de mi-octobre
    abandon: { d: '2026-10-26', c: 3 },  // plus bas du 26 octobre, plus bas depuis le 18 août
    s1: { d: '2026-10-26', c: 3 }, s2: { d: '2026-07-31', c: 3 },
    r1: { d: '2026-10-21', c: 2 },       // plus haut du 21 octobre, sommet décroissant
    r2: { d: '2026-09-30', c: 2 },       // plus haut du 30 septembre
    r3: { d: '2026-09-23', c: 2 },       // plus haut du 23 septembre, sommet de la période
  },
  supports: ['s1', 's2'], resistances: ['trigger', 'r2', 'r3'],
  targets: ({ lv }) => ({ tp1: lv('r2'), tp2: lv('r3'), range: null }),
  levelsMethod: 'Déclencheur = plus haut du 16 octobre, sommet du rebond qui a suivi la dégradation du 14 ; stop = plus bas du 15 octobre ; seuil d’abandon = plus bas du 26 octobre, plus bas depuis le 18 août ; TP1 = plus haut du 30 septembre ; TP2 = plus haut du 23 septembre ; plafond d’achat = (TP1 + 1,5 × stop) / 2,5 arrondi au cent inférieur ; pourcentages depuis l’entrée ; R/R = gain / risque.',
  inventory: 31,
  reviewScope: 'Dépôts EDGAR de Robinhood Markets, Inc. (CIK 1783879) du 24 octobre 2025 au 26 octobre 2026 : 31 formulaires hors déclarations d’initiés et avis de vente 144 (le 10-K de l’exercice 2025 et son amendement, trois 10-Q, treize 8-K et un 8-K/A, la circulaire et son complément, le rapport annuel aux actionnaires, six déclarations de détention 13G, un S-8 et deux formulaires de fonds). Vérification par type : aucun S-3, S-3ASR ni 424B5 depuis la cotation ; seuls deux 424B3 de 2021. Neuf pièces décisionnelles ouvertes et hachées : le 10-Q et le communiqué du deuxième trimestre, le 8-K et le communiqué de l’émission convertible de juin, le 10-K de l’exercice 2025, le 8-K de réduction d’effectifs du 16 juin et les communiqués des premier trimestre 2026, quatrième et troisième trimestres 2025. Aucun 8-K depuis le 29 juillet 2026.',
  docs: S.docs,
  needles: S.needles,
  route: (p, { prov, dep, B, N, lvPtr, TXP, STP }) => {
    if (p.startsWith('options.')) return prov('erisk', '/events/0', 'Calendrier de résultats collecté : mouvement implicite non disponible au relevé (marché fermé) ; chaîne d’options relevée hors séance, non retenue.', [dep('quote', '')]);
    if (p.startsWith('insiders.')) return prov('insiders', TXP == null ? '' : TXP + '/transactions', 'Formulaires 4 relevés transaction par transaction (codes S seulement ; levées, conversions et attributions exclues) ; couverture officielle incomplète (data_insufficient), cumuls minimaux.');
    if (p.startsWith('shortInterest.')) return prov('quote', QP, 'Relevé FINRA de positions vendeuses à la date de règlement indiquée, rapporté au flottant d’actions A publié par le fournisseur.', [dep('fund', STP + '/floatShares')]);
    if (p.startsWith('earnings.quarters.')) return prov('fund', SURP, 'Bénéfice par action publié et attendu du relevé des surprises collecté ; revenus lus dans les communiqués de résultats ouverts.', [dep('primary', '/documents/1'), dep('primary', '/documents/8')]);
    if (p === 'earnings.beatNote') return prov('primary', '/documents/1', 'Chiffres du deuxième trimestre lus dans le communiqué déposé ; réactions recalculées sur les barres certifiées ; consensus du troisième trimestre repris de Benzinga (26 octobre 2026), extrait conservé dans analyses/HOOD/_primary/press/, sans autre usage dans la fiche.', [dep('bars', B), dep('primary', '/documents/8')]);
    if (p === 'earnings.nextEarnings') return prov('erisk', '/events/0/report_date', 'Date de publication du calendrier collecté, confirmée par le communiqué de la société du 1er octobre 2026 (texte conservé dans analyses/HOOD/_primary/ir/).');
    if (p.startsWith('timeline.')) return prov('erisk', '/events/0', 'Dates : calendrier de résultats collecté et communiqué de la société du 1er octobre 2026 ; comparables : calendrier collecté, une seule source ; macro : registre data/scheduled-events.json et calendrier du BLS ; fin d’activation : plan de la fiche.', [dep('earn', '/events')]);
    if (p.startsWith('archiveHistory.')) return prov('status', '/captured_at', 'Dates des versions archivées de la fiche (dossiers analyses/HOOD/archive/), non une observation de marché.');
    if (p.startsWith('tribunal.')) return prov('bars', B, 'Tribunal de la fiche : chaque chiffre plaidé est repris de la section qui le prouve (barres certifiées, dépôts SEC, agrégats GAAP, multiples collectés, communiqués mensuels).', [dep('primary', '/documents/0')]);
    if (p.startsWith('bottomEstimation.')) return prov('bars', B, 'Planchers techniques lus sur les barres certifiées (plus bas du 26 octobre et du 31 juillet) ; plancher de valeur = médiane de l’EV/EBITDA de CME, Nasdaq, Cboe et ICE (statistiques collectées) × EBITDA GAAP douze mois, diminué le cas échéant des contrats événementiels perdus au taux de marge avant impôts, − dette + trésorerie, divisé par le nombre d’actions du 10-Q.', [dep('bars', lvPtr('s1')), dep('bars', lvPtr('s2')), dep('primary', '/documents/0'), dep('primary', '/documents/1')]);
    const v = getPath(LAST, p); if (typeof v !== 'string') return null;
    // Communiqués de la société (date des résultats, données mensuelles) : texte conservé hors dépôt SEC.
    if (/^news\.2\./.test(p)) return prov('bars', B + '/' + N + '/0', 'Communiqué de la société diffusé par GlobeNewswire, non déposé à la SEC ; texte copié et conservé dans analyses/HOOD/_primary/ir/ ; aucun chiffre de marché.', [dep('primary', '/documents/1')]);
    // Décisions de justice, actions d'analystes : presse citée ; réactions lues sur les barres certifiées.
    if (/^news\.[0134]\./.test(p)) return prov('bars', B, 'Variation de clôture à clôture lue sur les barres certifiées et comparée aux comparables sur la même séance ; cause attribuée à la presse citée, pas déduite des cours.', [dep('comparison', '')]);
    return null;
  },
  sectionDocs: { verdict: [1, 0, 4, 8], business: [1, 0, 4], news: [1], earnings: [1, 6, 7, 8], capitalStructure: [0, 2, 3], filingsReview: [0, 1, 2, 3, 4, 5, 6, 7, 8], risks: [0, 1, 4, 8], globalScore: [1], meta: [1], disclaimer: [1], macro: [1], social: [1], header: [0], technicals: [1], performance: [1] },
  score: { business: 22, technical: -14, capital: -2, calendar: -8, dilution: 0, risk: 44 },
  riskScoreReason: 'Jugement qualitatif sur dix : une entreprise rentable et en croissance, mais dont les contrats sportifs sont assimilés à des paris par la cour d’appel du neuvième circuit et contestés par plusieurs États ; une crypto dont les revenus ont reculé de 268 M$ à 100 M$ en trois trimestres ; un titre payé environ quarante fois le bénéfice, en baisse après chacune des quatre dernières publications ; des fondateurs qui contrôlent les votes et vendent des actions ; résultats publiés le soir même de la fiche, Fed le lendemain.',
  compose: c => require('./compose-hood.cjs')(c, x => { LAST = x; return x; }),
  groups: S.groups,
  eventDefault: { leader: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', direct_peer: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', upstream: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', downstream: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', second_order: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', sector_proxy: 'Panier sans publication propre ; exposé aux résultats de ses grandes pondérations' },
  eventRisk: {
    SOFI: 'Résultats annoncés le 27 octobre (une seule source), le même jour que Robinhood : dépôts et courtage des particuliers',
    COIN: 'Résultats annoncés le 29 octobre (une seule source) : volumes crypto et contrats événementiels du trimestre',
    ICE: 'Résultats annoncés le 29 octobre (une seule source) ; volumes de marché du trimestre',
    MIAX: 'Résultats annoncés le 29 octobre (une seule source) ; garde 10 % de MIAXdx, devenue Rothera E&C',
    CBOE: 'Résultats annoncés le 30 octobre (une seule source) : volumes d’options du trimestre',
    XYZ: 'Résultats annoncés le 3 novembre (une seule source) ; activité de Cash App',
    FLUT: 'Résultats annoncés le 4 novembre (une seule source) ; paris sportifs face aux contrats événementiels',
    VIRT: 'Résultats annoncés le 5 novembre (une seule source) : paiement du flux d’ordres des courtiers',
    DKNG: 'Résultats annoncés le 5 novembre (une seule source) ; paris sportifs face aux contrats événementiels' },
  blastDoc: 4,
  scenarios: c => require('./compose-hood.cjs').scenarios(c),
  contradictions: c => require('./compose-hood.cjs').contradictions(c),
  missingData: c => require('./compose-hood.cjs').missingData(c),
  limitations: [
    'Agrégats GAAP au 30 juin 2026 ; le troisième trimestre, publié le 27 octobre après la clôture de New York, n’est pas intégré.',
    'Séries Yahoo de HOOD, FUTU, VIRT, NDAQ et ICE reconstruites côté serveur le 27 octobre (séances du 21 et du 24 juillet manquantes auparavant), contrôlées avant la collecte.',
    'Données mensuelles de juillet et août : communiqué de la société du 10 septembre (GlobeNewswire), texte conservé dans analyses/HOOD/_primary/ir/ ; la provenance de ces lignes pointe vers le communiqué du deuxième trimestre, base de comparaison.',
    'Consensus du troisième trimestre (1,42 Md$, 0,56 $) connu par la presse (Benzinga, 26 octobre), extrait conservé dans analyses/HOOD/_primary/press/ ; cité dans la synthèse des résultats seulement.',
    'Arrêt du neuvième circuit, recours devant la Cour suprême (dossier 26-338) et règle de la CFTC du 9 octobre : presse et registre de la Cour, extraits conservés dans analyses/HOOD/_primary/press/.',
    'Ventes du directeur général des 21 et 22 septembre faites dans un plan 10b5-1 adopté le 5 septembre 2025 : formulaires 4 conservés dans analyses/HOOD/_primary/form4/.',
    'Multiples des pairs issus des statistiques courantes, relevées en instantané, sans historique daté ; les courtiers n’ont pas d’EV/EBITDA publié (leur valeur d’entreprise inclut les fonds des clients).',
    'Arrêt du neuvième circuit, actions d’analystes et inflation du 14 octobre connus par la presse citée, pas par un dépôt de la société.',
    'Chaîne d’options relevée hors séance : aucun chiffre d’options retenu.'],
});
