'use strict';
// Dossier Iovance Biotherapeutics (IOVA) v3 au close du 2026-10-26, construit le 27 octobre 2026 (gabarit R08, fiche
// du 27 octobre). Refonte complète de la fiche du 14 août 2026 (statut tp2-hit, ancien format sans dossier de run).
// Agrégats GAAP : douze mois glissants au 30 juin 2026 lus dans les données XBRL officielles de la SEC (companyfacts,
// 10-Q du 6 août inclus) = exercice 2025 + premier semestre 2026 − premier semestre 2025. EBITDA GAAP négatif, donc
// multiple de scénario appliqué aux revenus. Dette financière : aucune au 30 juin (seuls des loyers au passif).
// Trésorerie = liquidités + placements à court terme (297,7 M$), hors 6,0 M$ de liquidités soumises à restriction.
// Actions = 452 971 432 au 29 juillet 2026 (couverture du 10-Q).
// Barres certifiées Yahoo (plan analyse). Les séries de sept comparables (IMTX, IMCR, LEGN, RGEN, COR, BNTX, GMAB)
// manquaient une à trois séances entre le 21 et le 24 juillet 2026 (trou connu du magasin Yahoo, précédent FICO) :
// reconstruction ciblée de ces sept symboles seuls (RefreshBars, jeton de portée refresh effacé après usage) le
// 27 octobre vers 10 h 16 UTC, contrôle des séances, puis collecte complète. IOVA lui-même n'était pas troué.
const R = require('../../../../tools/lib/analysis-v3-r08.cjs');
const S = require('./static-iova.cjs');
const GEN = 'analyses/IOVA/_runs/20261027/build-iova.cjs';
const REF = '2026-10-26';
const SHARES = 452971432;
// Pointeurs recalculés à chaque collecte (l'ordre des éléments du bloc instrument peut changer).
const INSTR = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '../../_data/instrument.json'), 'utf8'));
const itemPtr = pred => { const i = INSTR.data.items.findIndex(pred); if (i < 0) throw Error('élément instrument absent'); return '/data/items/' + i; };
const NEWS = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '../../_data/corporate_actions.json'), 'utf8'));
const newsPtr = re => { const items = NEWS.results[0].data[0].data, i = items.findIndex(x => re.test(x.title || '')); if (i < 0) throw Error('dépêche absente ' + re); return '/results/0/data/0/data/' + i; };
const NEWS_FRONTLINE = newsPtr(/Reports 62\.5% Overall Response Rate/), NEWS_FRONTLINE_PR = newsPtr(/Frontline Advanced Melanoma/);
const NEWS_SARCOMA = itemPtr(x => x.type === 'instrument_news' && /first eight evaluable/.test(x.content || ''));
const NEWS_Q3 = itemPtr(x => x.type === 'instrument_news' && /to Report Third Quarter 2026 Financial Results/.test(x.content || ''));
// Positions vendeuses : collecte certifiée du plan squeeze (appel short_evidence exigé).
const SQ = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '../../_data_squeeze/short_evidence.json'), 'utf8'));
const SQ_RES = SQ.data.items[0].results, SQ_SI = SQ_RES.findIndex(r => r.data_type === 'short_interest'), SQ_CTB = SQ_RES.findIndex(r => r.data_type === 'ctb');
const SQ_PTS = SQ_RES[SQ_SI].data[0].points, SQ_BASE = '/data/items/0/results/' + SQ_SI + '/data/0/points/';
const sqPt = d => { const i = SQ_PTS.findIndex(x => x.settlement_date === d); if (i < 0) throw Error('relevé FINRA absent ' + d); return SQ_BASE + i; };

let LAST = null;
const getPath = (o, p) => p.split('.').reduce((n, k) => n == null ? undefined : n[k], o);

R.build({
  ticker: 'IOVA', shortName: 'Iovance', cik: 1425205, generator: GEN, mode: 'breakout', peers: true,
  extraInputs: [{ name: 'quote', path: 'analyses/IOVA/_data/instrument.json' }, { name: 'squeeze', path: 'analyses/IOVA/_data_squeeze/short_evidence.json' }, { name: 'news', path: 'analyses/IOVA/_data/corporate_actions.json' }],
  ref: REF, run: '20261027', asOf: '2026-10-27',
  xbrl: {
    ttm: {
      rev: ['RevenueFromContractWithCustomerExcludingAssessedTax'],
      ebit: ['OperatingIncomeLoss'],
      ni: ['NetIncomeLoss'],
      da: ['DepreciationAndAmortization'],
      ocf: ['NetCashProvidedByUsedInOperatingActivities'],
      capex: ['PaymentsToAcquirePropertyPlantAndEquipment'],
    },
    instant: {
      cashEq: ['CashAndCashEquivalentsAtCarryingValue'],
      sti: ['ShortTermInvestments'],
    },
    da: ['da'], debt: [], cash: ['cashEq', 'sti'],
  },
  scenarioBasis: 'revenue', scenarioMultiple: 7,
  valuationBasis: 'Revenus GAAP douze mois glissants au 30 juin 2026 (données XBRL officielles de la SEC) = exercice 2025 + premier semestre 2026 − premier semestre 2025 ; trésorerie = liquidités et placements à court terme au 30 juin (297,7 M$), hors liquidités soumises à restriction ; aucune dette financière ; 452 971 432 actions au 29 juillet 2026 (10-Q). EBITDA GAAP négatif, donc multiple appliqué aux revenus. Sept fois les revenus = multiple arrondi de Gilead (7,2×) et Genmab (7,4×), statistiques relevées en instantané : Iovance payé comme deux groupes rentables, sur ses ventes passées ; c’est une hypothèse de stress, pas un objectif',
  shares: { value: SHARES, doc: 0 },
  levels: {
    trigger: { d: '2026-10-21', c: 2 },  // plus haut du 21 octobre, plus haut annuel
    stop: { d: '2026-10-26', c: 3 },     // plus bas du 26 octobre, séance de référence
    abandon: { d: '2026-09-28', c: 4 },  // clôture du 28 septembre, base du saut de prévision du 29
    s1: { d: '2026-10-26', c: 3 }, s2: { d: '2026-10-07', c: 3 }, s3: { d: '2026-09-28', c: 4 },
    r1: { d: '2026-10-23', c: 2 },       // plus haut du 23 octobre
    r2: { d: '2026-09-29', c: 2 },       // plus haut de la séance du 29 septembre
    r3: { d: '2026-10-21', c: 2 },       // plus haut annuel
  },
  supports: ['s1', 's2', 's3'], resistances: ['r1', 'r2', 'r3'],
  targets: ({ entry, abandon }) => { const range = entry - abandon; return { tp1: entry + range, tp2: entry + 1.5 * range, range }; },
  levelsMethod: 'Déclencheur = plus haut du 21 octobre, plus haut annuel ; stop = plus bas du 26 octobre, séance de référence ; seuil d’abandon = clôture du 28 septembre, base du saut du 29 septembre ; TP1 = déclencheur + (déclencheur − clôture du 28 septembre) ; TP2 = déclencheur + 1,5 × cet écart ; plafond d’achat = (TP1 + 1,5 × stop) / 2,5 arrondi au cent inférieur ; pourcentages des cartes depuis le déclencheur ; R/R = gain / risque, publié au déclencheur et au plafond (pire prix d’achat) ; taille au pire écart d’ouverture connu (9 mai 2025, requête datée hors fenêtre certifiée).',
  inventory: 29,
  reviewScope: 'Dépôts EDGAR d’Iovance Biotherapeutics, Inc. (CIK 1425205) du 27 octobre 2025 au 26 octobre 2026 : 29 formulaires hors déclarations d’initiés et avis de vente 144 (onze 8-K, trois 10-Q, le 10-K 2025, la déclaration automatique S-3ASR du 18 juin 2026, quatre S-8, la circulaire, son avis préliminaire et son complément, le rapport annuel et cinq déclarations de détention 13G). Treize pièces décisionnelles ouvertes et hachées : les 10-Q des deux premiers trimestres 2026, le 10-K 2025, le S-3ASR, les communiqués de résultats de novembre 2025, février, mai et août 2026, le 8-K de prévision du 29 septembre, la présentation du 5 octobre, le 8-K de l’assemblée du 10 juin le 8-K du contrat de ventes au fil de l’eau du 22 août 2025 (hors fenêtre, repère du programme) et le formulaire 3 du nouveau directeur médical (2 octobre 2026), seule déclaration d’initié retenue ; les huit formulaires 4 déposés depuis août ont été lus pour leurs codes (acquisitions d’actions gratuites et retenues fiscales), sans être hachés. Les S-8 (plans d’actions des salariés), la circulaire et les 13G passifs sont écartés comme non décisionnels.',
  docs: S.docs,
  needles: S.needles,
  route: (p, { prov, dep, B, N, lvPtr, TXP, STP, idx }) => {
    const bi = d => { const i = LAST_BARS.findIndex(b => b[0] === d); if (i < 0) throw Error('séance absente ' + d); return i; };
    if (p.startsWith('options.')) return prov('erisk', '/events/0', 'Calendrier de résultats collecté (mouvement implicite indisponible) ; chaîne d’options collectée avant l’ouverture, sans cotation exploitable : aucun chiffre de marché d’options retenu.', [dep('bars', B)]);
    if (p.startsWith('insiders.')) return prov('insiders', TXP == null ? '' : TXP + '/coverage_status', 'Relevé officiel des formulaires 4 sur 365 jours : couverture incomplète (data_insufficient), aucun solde net affirmé.');
    if (p.startsWith('shortInterest.') || p === 'header.metrics.shortInterest' || p === 'bottomEstimation.confluences.3') return prov('squeeze', sqPt('2026-10-15'), 'Série bimensuelle FINRA des positions vendeuses (24 règlements, collecte certifiée du plan squeeze) : dernier règlement, 14 août et pic du 13 février, en % du flottant publié ; taux et disponibilité d’emprunt au 26 octobre.', [dep('squeeze', sqPt('2026-08-14')), dep('squeeze', sqPt('2026-02-13')), dep('squeeze', '/data/items/0/results/' + SQ_CTB + '/data/0/history')]);
    if (p === 'header.metrics.range52w') return prov('bars', B + '/' + bi('2025-11-05') + '/3', 'Plus bas et plus haut des 252 dernières séances certifiées (5 novembre 2025, 21 octobre 2026).', [dep('bars', B + '/' + bi('2026-10-21') + '/2')]);
    if (p.startsWith('archiveHistory.')) return prov('status', '/captured_at', 'Dates des versions archivées de la fiche, conservées dans analyses/IOVA/archive ; non une donnée de marché.');
    if (p.startsWith('tribunal.')) return prov('bars', B, 'Tribunal de la fiche : chaque chiffre plaidé est repris de la section qui le prouve (barres certifiées, dépôts SEC, agrégats GAAP, multiples collectés).', [dep('primary', '/documents/0')]);
    if (p.startsWith('bottomEstimation.')) return prov('bars', B, 'Planchers techniques lus sur les barres certifiées (plus bas du 7 octobre, clôture du 28 septembre) ; plancher de valeur = multiple de revenus des pairs (statistiques collectées) × revenus GAAP douze mois ou prévision 2026 + trésorerie, divisé par le nombre d’actions du 10-Q.', [dep('bars', lvPtr('s2')), dep('bars', lvPtr('s3')), dep('primary', '/documents/0'), dep('primary', '/documents/2')]);
    if (p === 'earnings.nextEarnings' || p.startsWith('timeline.events.2.') || p === 'timeline.keyWindow.label') return prov('quote', NEWS_Q3, 'Date des résultats confirmée par le communiqué de la société du 27 octobre (conférence le jeudi 5 novembre à 8 h 30, heure de New York), relayé par le flux d’actualités collecté ; concordant avec le calendrier de résultats collecté.', [dep('erisk', '/events/0')]);
    if (/^news\.0\./.test(p)) return prov('quote', NEWS_SARCOMA, 'Communiqué de la société du 26 octobre (données ESMO), relayé par le flux d’actualités collecté ; variation de séance lue sur les barres certifiées et comparée à XBI.', [dep('bars', B + '/' + N + '/4'), dep('comparison', '')]);
    if (/^news\.1\./.test(p)) return prov('news', NEWS_FRONTLINE, 'Données ESMO du 23 octobre (IOV-COM-202, cohorte 1A) : communiqué de la société (GlobeNewswire) et dépêche MT Newswires relayés par le flux d’actualités collecté ; variation de séance lue sur les barres certifiées et comparée à XBI.', [dep('news', NEWS_FRONTLINE_PR), dep('bars', B), dep('comparison', '')]);
    if (/^news\.2\./.test(p)) return prov('primary', '/documents/2', 'Prévision relevée lue dans le 8-K du 29 septembre ; variation et volume de séance lus sur les barres certifiées, comparés à XBI.', [dep('bars', B), dep('comparison', '')]);
    if (/^news\.3\./.test(p)) return prov('primary', '/documents/1', 'Résultats lus dans le communiqué du 6 août ; variation et écart d’ouverture lus sur les barres certifiées.', [dep('bars', B), dep('primary', '/documents/8')]);
    if (/^news\.4\./.test(p)) return prov('primary', '/documents/3', 'Capacité de l’étagère et du programme au fil de l’eau lue dans le S-3ASR du 18 juin.');
    const v = getPath(LAST, p); if (typeof v !== 'string') return null;
    return null;
  },
  sectionDocs: { verdict: [1, 2, 0, 3, 5], business: [4, 1, 0, 7], news: [2, 1], earnings: [1, 2, 8, 10], capitalStructure: [0, 3, 5, 6, 11, 4], filingsReview: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], risks: [0, 3, 4, 1, 12], globalScore: [1, 2, 0], meta: [1, 2, 0], disclaimer: [1], macro: [1], options: [1], social: [1], header: [0], shortInterest: [0], insiders: [0], technicals: [1], performance: [1], timeline: [2, 10], reviewPanel: [0], bottomEstimation: [0], tribunal: [0], archiveHistory: [0], tradeIdea: [1, 2, 0, 3] },
  score: { business: 18, technical: 6, capital: -12, calendar: -6, dilution: -9, risk: 50 },
  riskScoreReason: 'Jugement qualitatif sur dix : un lancement qui accélère (+66 % au deuxième trimestre, prévision 2026 relevée à 410–420 M$), mais financé en partie par des ventes d’actions continues (38,9 millions au premier semestre) avec une étagère d’émission sans plafond ; une valorisation à plus de dix-huit fois les revenus des douze derniers mois ; une autorisation accélérée encore à confirmer ; des jours de résultats qui font bouger le titre de 13 à 43 % ; une publication annoncée le 5 novembre par une seule source.',
  compose: c => { LAST_BARS = c.bars; return require('./compose-iova.cjs')(c, x => { LAST = x; return x; }); },
  groups: S.groups,
  eventDefault: { leader: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; repère de l’immuno-oncologie', direct_peer: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; données cliniques possibles hors calendrier', upstream: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', downstream: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', second_order: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', sector_proxy: 'Panier sans publication propre ; exposé aux résultats de ses grandes pondérations' },
  eventRisk: {
    RGEN: 'Résultats annoncés le 27 octobre (une seule source) ; lecture sur la demande de bioproduction',
    REPL: 'Résultats annoncés le 28 octobre (une seule source) ; concurrent direct dans le mélanome réfractaire',
    BMY: 'Résultats annoncés le 29 octobre (une seule source) ; ventes des traitements de référence du mélanome',
    GILD: 'Résultats annoncés le 29 octobre (une seule source) ; ventes de thérapies cellulaires de Kite',
    MRK: 'Résultats annoncés le 29 octobre (une seule source) ; ventes de pembrolizumab, partenaire des essais',
    BNTX: 'Résultats annoncés le 3 novembre (une seule source)',
    COR: 'Résultats annoncés le 4 novembre (une seule source) ; distribution de spécialités',
    MCK: 'Résultats annoncés le 4 novembre (une seule source) ; distribution de spécialités',
    IMCR: 'Résultats annoncés le 5 novembre (une seule source), le même jour qu’Iovance selon le calendrier',
    CAH: 'Résultats annoncés le 5 novembre (une seule source) ; distribution de spécialités',
    GMAB: 'Résultats annoncés le 5 novembre (une seule source)',
    MRNA: 'Résultats annoncés le 6 novembre (une seule source) ; programme individualisé du mélanome avec Merck',
    CRSP: 'Résultats annoncés le 9 novembre (une seule source) ; sentiment sur les thérapies cellulaires' },
  blastDoc: 4,
  scenarios: c => require('./compose-iova.cjs').scenarios(c),
  contradictions: c => require('./compose-iova.cjs').contradictions(c),
  missingData: c => require('./compose-iova.cjs').missingData(c),
  limitations: ['Agrégats GAAP au 30 juin 2026 ; le troisième trimestre n’est pas encore publié.', 'Écarts d’ouverture de 2025 (9 mai, 8 août, 28 février) lus par une requête directe datée du 27 octobre (analyses/IOVA/_data_history/bars_2025.json), hors collecte certifiée : aucun plan existant ne collecte l’historique antérieur aux 300 séances.', 'Plan squeeze : appel sec_flags en échec (filtre de date sur un relevé courant) ; seul short_evidence, réussi et exigé, est utilisé.', 'Sept séries comparables reconstruites côté serveur le 27 octobre (séances du 21 au 24 juillet manquantes auparavant), contrôlées avant la collecte.', 'Multiples des pairs issus des statistiques courantes, relevées en instantané, sans historique daté.', 'Données cliniques d’octobre connues par les communiqués de la société relayés par le flux d’actualités, sans dépôt SEC à la collecte.', 'Chaîne d’options collectée avant l’ouverture, sans cotation exploitable.'],
});
var LAST_BARS = null;
