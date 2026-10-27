'use strict';
// Dossier Cameco (CCJ) v3 au close du 2026-10-26, refonte complète du 27 octobre 2026 (gabarit R08, fiche FICO de
// référence). Émetteur étranger canadien : dépôts 40-F/6-K, normes IFRS, comptes en dollars canadiens, aucun fait us-gaap
// dans les données XBRL de la SEC. Méthode des agrégats reprise du run du 27 septembre 2026, inchangée :
//   - douze mois glissants au 30 juin 2026 = exercice 2025 (40-F) + premier semestre 2026 (6-K du 31 juillet)
//     − premier semestre 2025, chaque valeur lue dans l'état financier du dépôt primaire (cfg.manualFinancials) ;
//   - conversion en dollars américains au taux quotidien de la Banque du Canada du 30 juin 2026 (FXUSDCAD = 1,4210 CAD
//     pour 1 USD, série téléchargée et hachée dans _primary/2026-10-26-boc-fxusdcad.json ; le rapport de gestion du
//     6-K donne 1,42 arrondi), appliqué aux flux comme au bilan pour ne jamais mélanger deux devises dans un ratio ;
//   - EBITDA d'exploitation = résultat d'exploitation IFRS + amortissements : il exclut les quotes-parts de Westinghouse
//     (49 %) et de JV Inkai, mises en équivalence. L'EBITDA ajusté publié par la société (mesure non IFRS) les inclut.
// Le troisième trimestre 2026 n'est pas publié à la refdate : publication confirmée par la société pour le vendredi
// 30 octobre 2026 avant l'ouverture de New York (communiqué du 21 octobre, copie hachée dans _primary).
// Barres certifiées Yahoo (plan analyse). Cinq comparables (NXE, BEP, URA, URNM, NLR) manquaient les séances du 21 et/ou
// du 24 juillet 2026 dans le magasin du serveur (trou Yahoo connu, précédent FICO) : reconstruction ciblée de ces cinq
// symboles seuls (RefreshBars, jeton de portée refresh, effacé après usage) le 27 octobre vers 10 h 14 UTC, contrôle des
// séances du 17 au 28 juillet, puis collecte complète (27 appels sur 27).
const R = require('../../../../tools/lib/analysis-v3-r08.cjs');
const S = require('./static-ccj.cjs');
const GEN = 'analyses/CCJ/_runs/20261027/build-ccj.cjs';
const REF = '2026-10-26';
const FX = 1.4210; // CAD pour 1 USD (Banque du Canada, 30 juin 2026)
const cad = k => Math.round(k / FX); // milliers ou unités de CAD → USD
const SHARES = 435532978;
const { ACC_6K } = S;

let LAST = null;
const getPath = (o, p) => p.split('.').reduce((n, k) => n == null ? undefined : n[k], o);
// Pointeurs dans le relevé instrument collecté, retrouvés par type : positions vendeuses FINRA, volume d'options, détention.
const QI = require('../../../../analyses/CCJ/_data/instrument.json').data.items;
const qptr = t => { const i = QI.findIndex(x => x.type === t); if (i < 0) throw Error('élément absent ' + t); return '/data/items/' + i; };
const Q_SI = qptr('instrument_short_interest'), Q_OPT = qptr('instrument_options_volume_ratio'), Q_HOLD = qptr('instrument_comprehensive_holders');
// Inventaire EDGAR calculé depuis la liste des dépôts hachée (_primary/submissions.json), du 12 novembre 2024 au 26 octobre
// 2026, hors avis de vente 144 et déclarations de détention 13G.
const SUB = require('../../../../analyses/CCJ/_primary/submissions.json').filings.recent;
const EXCL = new Set(['144', '144/A', 'SC 13G', 'SC 13G/A', 'SCHEDULE 13G', 'SCHEDULE 13G/A']);
const INV = SUB.form.map((f, i) => ({ f, d: SUB.filingDate[i] })).filter(x => x.d >= '2024-11-12' && x.d <= REF && !EXCL.has(x.f));
const INV6K = INV.filter(x => x.f === '6-K').length;

R.build({
  ticker: 'CCJ', shortName: 'Cameco', cik: 1009001, generator: GEN, mode: 'breakout', peers: true,
  extraInputs: [{ name: 'quote', path: 'analyses/CCJ/_data/instrument.json' }],
  ref: REF, run: '20261027', asOf: '2026-10-27',
  xbrl: { ttm: {}, instant: {}, da: ['da'], debt: ['debt'], cash: ['cash'] },
  // Agrégats IFRS (milliers de CAD) convertis en USD au taux du 30 juin 2026.
  // rev  : 3 481 933 + 1 659 137 − 1 666 448 = 3 474 622 ; ebit : 618 142 + 247 976 − 351 763 = 514 355
  // ni   : 589 542 + 155 961 − 390 638 = 354 865 ; da : 293 094 + 139 257 − 147 073 = 285 278
  // debt : 996 750 (emprunts à long terme au 30 juin 2026, hors obligations locatives) ; cash : 1 112 718
  manualFinancials: { figures: {
    rev:  { value: cad(3474622000), form: '6-K', accn: ACC_6K, start: '2025-07-01', end: '2026-06-30', doc: 0 },
    ebit: { value: cad(514355000),  form: '6-K', accn: ACC_6K, start: '2025-07-01', end: '2026-06-30', doc: 0 },
    ni:   { value: cad(354865000),  form: '6-K', accn: ACC_6K, start: '2025-07-01', end: '2026-06-30', doc: 0 },
    da:   { value: cad(285278000),  form: '6-K', accn: ACC_6K, start: '2025-07-01', end: '2026-06-30', doc: 0 },
    debt: { value: cad(996750000),  form: '6-K', accn: ACC_6K, end: '2026-06-30', doc: 0 },
    cash: { value: cad(1112718000), form: '6-K', accn: ACC_6K, end: '2026-06-30', doc: 0 },
  } },
  // Scénario : l'exploitation seule (EBITDA d'exploitation, hors Westinghouse et JV Inkai) payée au multiple médian des
  // cinq pairs rentables de la chaîne nucléaire (Constellation, Vistra, BWX Technologies, GE Vernova, Talen), relevés en
  // instantané le 27 octobre ; contrôlé dans compose-ccj.cjs.
  scenarioBasis: 'ebitda', scenarioMultiple: 28.19,
  valuationBasis: 'Émetteur étranger canadien (40-F/6-K, IFRS, comptes en dollars canadiens) : agrégats lus dans les états financiers des dépôts primaires et convertis en dollars américains au taux quotidien de la Banque du Canada du 30 juin 2026 (1,4210 CAD pour 1 USD), appliqué aux flux et au bilan. Douze mois glissants au 30 juin 2026 = exercice 2025 (40-F) + premier semestre 2026 − premier semestre 2025 (6-K du 31 juillet). EBITDA = résultat d’exploitation IFRS + amortissements, hors quotes-parts de Westinghouse et de JV Inkai (mises en équivalence) ; dette = emprunts à long terme au 30 juin 2026, hors obligations locatives ; trésorerie au 30 juin ; 435 532 978 actions. Multiple de 28,19 fois = médiane des EV/EBITDA de Constellation, Vistra, BWX Technologies, GE Vernova et Talen relevés en instantané : valeur de l’exploitation seule, sans Westinghouse ni JV Inkai ; ce n’est ni un objectif ni une juste valeur.',
  shares: { value: SHARES, doc: 0 },
  levels: {
    trigger: { d: '2026-10-16', c: 2 }, // plus haut du 16 octobre, sommet de la fourchette d'octobre après l'inflation du 14
    stop: { d: '2026-10-22', c: 3 },    // plus bas du 22 octobre, séance de la vente des valeurs de l'électricité de l'IA
    abandon: { d: '2026-10-23', c: 3 }, // plus bas du 23 octobre, plus bas sur un an
    s1: { d: '2026-10-22', c: 3 }, s2: { d: '2026-10-23', c: 3 }, s3: { d: '2025-08-20', c: 3 },
    r1: { d: '2026-10-13', c: 2 },      // plus haut du 13 octobre, veille de l'inflation américaine
    r2: { d: '2026-10-06', c: 2 },      // plus haut du 6 octobre, sommet du rebond d'octobre
    r3: { d: '2026-09-08', c: 2 },      // plus haut du 8 septembre, dernier sommet avant la glissade de septembre
  },
  supports: ['s1', 's2', 's3'], resistances: ['r1', 'r2', 'r3'],
  targets: ({ lv }) => ({ tp1: lv('r2'), tp2: lv('r3'), range: null }),
  levelsMethod: 'Déclencheur = plus haut du 16 octobre, sommet de la fourchette d’octobre ; stop = plus bas du 22 octobre ; seuil d’abandon = plus bas du 23 octobre, plus bas sur un an ; TP1 = plus haut du 6 octobre ; TP2 = plus haut du 8 septembre ; plafond d’achat = (TP1 + 1,5 × stop) / 2,5 arrondi au cent inférieur ; pourcentages depuis l’entrée ; R/R = gain / risque.',
  inventory: INV.length,
  reviewScope: 'Dépôts EDGAR de Cameco Corporation (CIK 1009001) du 12 novembre 2024 au 26 octobre 2026, hors avis de vente 144 et déclarations de détention 13G : ' + INV.length + ' formulaires, dont ' + INV6K + ' 6-K, tous examinés au moins par le titre de leur pièce principale (résultats, Westinghouse, contrats, opérations du nord de la Saskatchewan, Cigar Lake, gouvernance, rapports annuels non financiers), plus les 40-F des exercices 2024 et 2025, le prospectus préalable de base F-10, son supplément d’émission au fil du marché et ses pièces. Recherche par formulaire : aucun F-10, F-3, S-3, 424B ni supplément de prospectus déposé depuis le 12 novembre 2024 ; aucun prospectus S-1 public de Westinghouse sur EDGAR au 27 octobre 2026. Vingt pièces décisionnelles ouvertes et hachées.',
  docs: S.docs,
  needles: S.needles,
  route: (p, { prov, dep, B, N, lvPtr, TXP }) => {
    // Date de publication du troisième trimestre : calendrier collecté, confirmée par le communiqué de la société du
    // 21 octobre 2026 (copie hachée dans _primary/2026-10-21-IR-cameco-q3-date.html).
    if (p === 'earnings.nextEarnings' || p.startsWith('timeline.')) return prov('erisk', '/events/0/report_date', 'Date de publication du troisième trimestre lue dans le calendrier de résultats collecté et confirmée par le communiqué de Cameco du 21 octobre 2026 (avant l’ouverture du vendredi 30 octobre, conférence à 8 h, heure de New York) ; rendez-vous macro lus dans le registre des échéances officielles ; dates des comparables d’une seule source.', [dep('earn', '/events')]);
    if (p === 'header.metrics.range52w') return prov('bars', B, 'Plus haut et plus bas en séance sur les 252 dernières séances certifiées.');
    if (p === 'header.metrics.shortInterest' || p.startsWith('shortInterest.')) return prov('quote', Q_SI, 'Positions vendeuses au règlement FINRA du 15 octobre 2026 rapportées au flottant publié par le fournisseur ; jours de couverture FINRA.', [dep('fund', '/data/items/0/results/2/data/0/floatShares')]);
    if (p.startsWith('options.')) return prov('quote', Q_OPT, 'Volume d’options de la séance du 26 octobre (puts et calls échangés) relevé avec l’instrument ; aucune position ouverte ni mouvement implicite exploitable, marché fermé à la collecte.');
    if (p.startsWith('insiders.')) return prov('insiders', TXP == null ? '' : TXP, 'Relevé officiel des formulaires 4 sur 365 jours : vide pour cet émetteur canadien, dont les dirigeants déclarent au registre canadien SEDI ; aucun solde affirmé. Part des institutions et des initiés lue dans le relevé instrument du fournisseur.', [dep('sec', ''), dep('quote', Q_HOLD)]);
    if (p.startsWith('archiveHistory.')) return prov('status', '/captured_at', 'Dates et notes des versions archivées de la fiche (analyses/CCJ/archive/), métadonnées éditoriales et non observations de marché.');
    if (p.startsWith('tribunal.')) return prov('bars', B, 'Tribunal de la fiche : chaque chiffre plaidé est repris de la section qui le prouve (barres certifiées, dépôts 40-F et 6-K, agrégats IFRS convertis, multiples collectés).', [dep('primary', '/documents/0'), dep('primary', '/documents/1')]);
    if (p.startsWith('bottomEstimation.')) return prov('bars', B, 'Planchers techniques lus sur les barres certifiées (plus bas du 23 octobre 2026 et du 20 août 2025) ; plancher de valeur = EBITDA d’exploitation douze mois réduit de 20 % × médiane des EV/EBITDA de cinq pairs rentables − dette + trésorerie + valeur comptable de Westinghouse et de JV Inkai au 30 juin 2026, divisé par le nombre d’actions du 6-K.', [dep('bars', lvPtr('s2')), dep('bars', lvPtr('s3')), dep('primary', '/documents/0')]);
    const v = getPath(LAST, p); if (typeof v !== 'string') return null;
    // Réactions de séance : barres certifiées comparées aux pairs ; cause attribuée à la source citée.
    if (/^news\.\d+\./.test(p)) return prov('bars', B, 'Variation de clôture à clôture lue sur les barres certifiées et comparée aux comparables sur la même séance ; cause attribuée au dépôt ou à la presse financière citée, pas déduite des cours.', [dep('comparison', ''), dep('primary', '/documents/6')]);
    return null;
  },
  sectionDocs: { verdict: [1, 2, 0, 6, 16], business: [5, 4, 1, 9, 16], news: [6, 7, 2], earnings: [2, 1, 12, 13, 14, 17, 18], capitalStructure: [10, 11, 0, 1], filingsReview: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19], risks: [1, 9, 6, 10], globalScore: [1], meta: [2], disclaimer: [2], macro: [1], options: [1], social: [1], header: [0], shortInterest: [0], insiders: [0], technicals: [1], performance: [1], timeline: [2, 1], bottomEstimation: [0], tradeIdea: [1] },
  score: { business: 28, technical: -14, capital: 6, calendar: -6, dilution: -3, risk: 30 },
  riskScoreReason: 'Jugement qualitatif sur dix : un producteur d’uranium rentable sans dette nette, mais dont les contrats livrent la livre bien sous le prix du marché et dont la marge se comprime avec la part de livres achetées ; une production exposée à l’arrêt prolongé de Key Lake au troisième trimestre ; une valorisation qui repose pour une large part sur Westinghouse, dont les grands projets restent conditionnels et l’introduction en Bourse confidentielle ; des actions de l’uranium décotées en bloc ; un titre qui a clôturé en baisse le jour de ses quatre dernières publications ; résultats le 30 octobre ; programme d’émission de 500 M$ US ouvert jusqu’au 12 décembre 2026.',
  compose: c => require('./compose-ccj.cjs')(c, x => { LAST = x; return x; }),
  groups: S.groups,
  eventDefault: { leader: 'Résultats annoncés le 9 novembre (une seule source) ; ses contrats d’électricité restent le signal à suivre', direct_peer: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; le prix de l’uranium reste le signal', upstream: 'Fiducie sans publication de résultats ; suit le prix au comptant de l’uranium', downstream: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; sa demande de combustible fixe le débouché', second_order: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; baromètre du sentiment nucléaire', sector_proxy: 'Panier sans publication propre ; exposé aux résultats de ses grandes pondérations, Cameco en tête' },
  eventRisk: {
    CEG: 'Résultats annoncés le 9 novembre (une seule source) : premier exploitant nucléaire, il dira ce que paient les centres de données',
    GEV: 'Résultats annoncés le 28 octobre (une seule source) : premier test des valeurs de l’électricité de l’IA après la vente du 22 octobre',
    D: 'Résultats annoncés le 30 octobre, le même jour que Cameco (une seule source)',
    UUUU: 'Résultats annoncés le 2 novembre (une seule source) ; lecture sur les producteurs d’uranium américains',
    BWXT: 'Résultats annoncés le 2 novembre (une seule source) ; repère de multiple pour l’industrie nucléaire',
    TLN: 'Résultats annoncés le 3 novembre (une seule source) ; contrats d’électricité nucléaire',
    DNN: 'Résultats annoncés le 3 novembre (une seule source) ; développeur du même bassin',
    NXE: 'Résultats annoncés le 3 novembre (une seule source) ; développeur du même bassin',
    LEU: 'Résultats annoncés le 4 novembre (une seule source) ; prix de l’enrichissement et de la conversion',
    BEP: 'Résultats annoncés le 4 novembre (une seule source) : copropriétaire de Westinghouse, il peut parler de l’introduction en Bourse',
    DUK: 'Résultats annoncés le 5 novembre (une seule source) ; parc nucléaire réglementé',
    SO: 'Résultats annoncés le 5 novembre (une seule source) ; exploitant des AP1000 de Vogtle',
    SMR: 'Résultats annoncés le 5 novembre (une seule source) ; petits réacteurs concurrents',
    VST: 'Résultats annoncés le 6 novembre (une seule source) ; prolongation de trois centrales nucléaires',
    OKLO: 'Résultats annoncés le 6 novembre (une seule source) ; sentiment sur le nucléaire de l’IA',
  },
  blastDoc: 1,
  scenarios: c => require('./compose-ccj.cjs').scenarios(c),
  contradictions: c => require('./compose-ccj.cjs').contradictions(c),
  missingData: c => require('./compose-ccj.cjs').missingData(c),
  limitations: [
    'Émetteur étranger canadien IFRS : agrégats reconstitués depuis les états des dépôts primaires en dollars canadiens et convertis au taux unique de la Banque du Canada du 30 juin 2026 (1,4210).',
    'Agrégats au 30 juin 2026 ; le troisième trimestre, publié le 30 octobre avant l’ouverture, n’est pas intégré.',
    'EBITDA d’exploitation hors Westinghouse et JV Inkai ; l’EBITDA ajusté de la société, non IFRS, les inclut.',
    'Multiples des pairs relevés en instantané le 27 octobre, sans historique daté ; aucun producteur d’uranium rentable coté parmi eux.',
    'Flux convertis au taux de clôture du 30 juin (1,4210) ; au taux moyen de la période (1,38 à 1,40 selon les rapports de gestion), les multiples baisseraient d’environ 3 %.',
    'Séries de cinq comparables reconstruites côté serveur le 27 octobre (séances de juillet manquantes), contrôlées avant la collecte.',
    'Valorisation de Westinghouse pour son introduction en Bourse connue par la presse (Bloomberg, 18 septembre), non confirmée par la société.',
  ],
});
