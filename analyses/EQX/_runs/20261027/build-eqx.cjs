'use strict';
// Dossier Equinox Gold (EQX) v3 au close du 2026-10-26, refonte complète au gabarit du 27 octobre 2026 (R08, modèle FICO).
// Émetteur privé étranger canadien : 40-F annuel et 6-K intermédiaires, normes IFRS, devise de présentation et devise
// fonctionnelle = dollar américain. Aucun fait us-gaap dans les données XBRL de la SEC : les agrégats sont lus dans les
// états IFRS déposés (cfg.manualFinancials), méthode reconduite du run du 27 septembre et revérifiée par extraits.
// Base des flux : douze mois glissants au 30 juin 2026, activités poursuivies (Brésil cédé, en activités abandonnées),
// = exercice 2025 (40-F) + premier semestre 2026 (6-K du 5 août) − premier semestre 2025. Ces agrégats précèdent Orla
// (opération clôturée le 31 juillet 2026) : la fiche le dit, et lit à part l'EBITDA d'Orla dans le rapport d'acquisition
// (6-K du 5 août, états pro forma) pour un multiple indicatif combiné.
// Barres certifiées Yahoo (plan analyse). Les séries de GLD et EGO manquaient les séances du 21 et du 24 juillet 2026
// (même trou que FICO) : reconstruction ciblée de ces deux symboles seuls (RefreshBars, jeton de portée refresh, effacé
// après usage) le 27 octobre vers 10 h 04 UTC, contrôle des séances, puis nouvelle collecte complète.
const R = require('../../../../tools/lib/analysis-v3-r08.cjs');
const S = require('./static-eqx.cjs');
const GEN = 'analyses/EQX/_runs/20261027/build-eqx.cjs';
const REF = '2026-10-26';

// Agrégats IFRS (milliers de dollars → dollars). Douze mois au 30 juin 2026, activités poursuivies.
const REV_TTM = (1817195 + 1631389 - 551521) * 1000;   // 40-F 2025 + S1 2026 − S1 2025
const EBIT_TTM = (432339 + 637610 - 29159) * 1000;      // résultat des opérations
const DA_TTM = (339694 + 238406 - 103504) * 1000;       // amortissements et épuisement (coût des ventes)
const NI_TTM = (-18861 + 405768 + 106929) * 1000;       // résultat net des activités poursuivies
const DEBT = 583000 * 1000, CASH = 317783 * 1000;        // bilan au 30 juin 2026
const SHARES = 1167459822;                               // rapport de gestion du T2, après Orla
// EBITDA d'Orla, exercice 2025, présentation Equinox (rapport d'acquisition, colonne « Orla Mining Ltd. Adjusted ») :
// résultat des opérations 462 837 k$ + amortissements 145 693 k$, avant ajustements d'acquisition.
const ORLA_EBITDA_2025 = (462837 + 145693) * 1000;
const PEERS = ['NEM', 'B', 'AEM', 'AGI', 'KGC', 'IAG', 'EGO', 'BTG', 'SSRM'];
const MULT = 5.5;

let LAST = null;
// Pointeurs du relevé FINRA (instantané de l'instrument) et des statistiques (flottant), résolus avant la composition.
const K = require('../../../../tools/lib/analysis-v3-kit.cjs');
const LASTQ = (() => {
  const q = K.read('analyses/EQX/_data/instrument.json').data.items, si = q.findIndex(x => x.type === 'instrument_short_interest');
  if (si < 0) throw Error('relevé FINRA absent');
  const ov = q.findIndex(x => x.type === 'instrument_options_volume_ratio'); if (ov < 0) throw Error('volume d’options absent');
  return { si, ov, stp: K.findPath(K.read('analyses/EQX/_data/fundamentals.json'), 'instrument_comprehensive_stats') };
})();
const getPath = (o, p) => p.split('.').reduce((n, k) => n == null ? undefined : n[k], o);
const med = a => { const v = [...a].sort((x, y) => x - y); return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2; };

R.build({
  ticker: 'EQX', shortName: 'Equinox Gold', cik: 1756607, generator: GEN, mode: 'breakout', peers: true,
  extraInputs: [{ name: 'quote', path: 'analyses/EQX/_data/instrument.json' }],
  ref: REF, run: '20261027', asOf: '2026-10-27',
  xbrl: { ttm: {}, instant: {}, da: ['da'], debt: ['debt'], cash: ['cash'] },
  manualFinancials: { figures: {
    rev: { value: REV_TTM, form: '6-K', accn: S.ACC_Q2, start: '2025-07-01', end: '2026-06-30', doc: 0 },
    ebit: { value: EBIT_TTM, form: '6-K', accn: S.ACC_Q2, start: '2025-07-01', end: '2026-06-30', doc: 0 },
    ni: { value: NI_TTM, form: '6-K', accn: S.ACC_Q2, start: '2025-07-01', end: '2026-06-30', doc: 0 },
    da: { value: DA_TTM, form: '6-K', accn: S.ACC_Q2, start: '2025-07-01', end: '2026-06-30', doc: 0 },
    debt: { value: DEBT, form: '6-K', accn: S.ACC_Q2, end: '2026-06-30', doc: 0 },
    cash: { value: CASH, form: '6-K', accn: S.ACC_Q2, end: '2026-06-30', doc: 0 },
  } },
  scenarioBasis: 'ebitda', scenarioMultiple: MULT,
  // Enregistrement du scénario de valeur : multiple médian des neuf producteurs comparables (arrondi à 5,5×) appliqué à
  // l'EBITDA combiné indicatif (Equinox douze mois au 30 juin 2026 + Orla exercice 2025), bilan d'Equinox au 30 juin.
  valuationScenario: c => {
    const m = med(PEERS.map(t => c.peerStat(t, 'enterpriseToEbitda')));
    if (Math.abs(m - MULT) > 0.05) throw Error('médiane des producteurs inattendue ' + m);
    const F = require('./compose-eqx.cjs').F, P = F.perim;
    const ebitda = c.G$.ebitda + ORLA_EBITDA_2025, debt = (F.rcfSep + P.conv25 + P.other + P.eqxDefRev + P.orlaPrepay + P.gsCC + P.mwCC) * 1e6, cash = F.cashSep * 1e6, shares = F.shares + F.conv.shares;
    const ev = MULT * ebitda, eq = ev - debt + cash, price = eq / shares;
    return { basis: 'EBITDA combiné indicatif = EBITDA IFRS d’Equinox sur douze mois au 30 juin 2026, activités poursuivies (résultat des opérations 1 040,8 M$ + amortissements et épuisement 474,6 M$, 40-F 2025 et 6-K du 5 août 2026) + EBITDA d’Orla de l’exercice 2025 en présentation Equinox (462,8 M$ + 145,7 M$, rapport d’acquisition du 4 août 2026), périodes non alignées. Dettes et assimilés : ligne de crédit tirée de 365 M$ et trésorerie de 527 M$ au 30 septembre 2026 (communiqué préliminaire du 13 octobre), convertibles 2025 (23,6 M$) et autres emprunts (15,7 M$) au 30 juin, or à livrer au titre du streaming et des préventes (226,6 M$ chez Equinox au 30 juin, 261,9 M$ de préventes chez Orla au 31 mars), compléments de prix (Greenstone 88,0 M$ au 30 juin, second versement Musselwhite 20 M$). Actions : 1 167 459 822 après Orla + 28 475 124 issues de la conversion des obligations 2023 appelées le 20 octobre (dette correspondante retirée). Multiple de 5,5 fois = médiane arrondie de l’EV/EBITDA courant de Newmont, Barrick, Agnico Eagle, Alamos, Kinross, IAMGOLD, Eldorado, B2Gold et SSR Mining (statistiques relevées le 27 octobre 2026, non point-in-time). Hypothèse éditoriale, pas un objectif.',
      metric: 'ebitda', multiple: MULT, ebitda, revenue: c.G$.rev, debt, cash, shares, close: c.close,
      enterprise_value: ev, equity_value: eq, price, downside_pct: (price / c.close - 1) * 100 };
  },
  valuationBasis: 'IFRS, douze mois glissants au 30 juin 2026, activités poursuivies, Equinox seul.',
  shares: { value: SHARES, doc: 2 },
  levels: {
    trigger: { d: '2026-10-20', c: 2 },  // plus haut du 20 octobre, sommet du rebond du 15 au 21 octobre
    stop: { d: '2026-10-20', c: 3 },     // plus bas du 20 octobre, bas de ce rebond
    abandon: { d: '2026-07-17', c: 3 },  // plus bas du 17 juillet, plus bas sur un an
    s1: { d: '2026-10-26', c: 3 }, s2: { d: '2026-07-17', c: 3 },
    r1: { d: '2026-10-22', c: 2 },       // plus haut du 22 octobre, séance de la cassure
    r2: { d: '2026-09-22', c: 2 },       // plus haut du 22 septembre, dernier sommet de septembre
    r3: { d: '2026-09-03', c: 2 },       // plus haut du 3 septembre, haut de la zone du 3 au 9 septembre
  },
  supports: ['s1', 's2'], resistances: ['r1', 'trigger', 'r2'],
  targets: ({ lv }) => ({ tp1: lv('r2'), tp2: lv('r3'), range: null }),
  levelsMethod: 'Déclencheur = plus haut du 20 octobre, sommet du rebond du 15 au 21 octobre ; stop = plus bas du 20 octobre, bas de ce rebond ; seuil d’abandon = plus bas du 17 juillet, plus bas sur un an ; TP1 = plus haut du 22 septembre ; TP2 = plus haut du 3 septembre, haut de la zone du 3 au 9 septembre ; plafond d’achat = (TP1 + 1,5 × stop) / 2,5 arrondi au cent inférieur ; pourcentages depuis l’entrée ; R/R = gain / risque.',
  inventory: 47,
  reviewScope: 'Dépôts EDGAR d’Equinox Gold Corp. (CIK 1756607) du 27 octobre 2025 au 26 octobre 2026 : 45 formulaires hors déclarations de détention 13D/13G (42 6-K, le 40-F de l’exercice 2025, un S-8 et un formulaire SD), plus le prospectus préalable de base F-10 du 2 octobre 2024, toujours en vigueur, vérifié par type de formulaire (F-10, SUPPL, F-3, S-3, 424B : aucun dépôt d’émission sur la période). Treize pièces décisionnelles ouvertes et hachées : les états financiers et le rapport de gestion du deuxième trimestre, les états financiers et le rapport de gestion annuels 2025, le communiqué du deuxième trimestre, la production du troisième trimestre, le remboursement des convertibles 2023, le rapport d’acquisition d’Orla, le F-10, les S-8 des options d’Orla (2026) et de Calibre (2025, hors fenêtre), la décision fédérale sur South Railroad et la déclaration 13G de Fairfax.',
  docs: S.docs,
  needles: S.needles,
  route: (p, { prov, dep, B, N, lvPtr, TXP, C, marketMath }) => {
    const geo = ['stop', 'abandon', 'r1', 'r2', 'r3', 's1', 's2'].map(k => dep('bars', lvPtr(k)));
    if (p === 'header.metrics.range52w') return prov('bars', B, 'Plus bas et plus haut en séance sur les 252 dernières séances certifiées.');
    if (p === 'header.metrics.evEbitda') { const mm = marketMath(); return { ...mm, method: 'Valeur d’entreprise sur périmètre cohérent (actions après conversion des obligations 2023, trésorerie et ligne de crédit au 30 septembre, autres dettes, or à livrer et compléments de prix) / EBITDA combiné indicatif (Equinox douze mois au 30 juin 2026 + Orla exercice 2025, rapport d’acquisition).', additional_inputs: [...(mm.additional_inputs || []), dep('primary', '/documents/6'), dep('primary', '/documents/3'), dep('primary', '/documents/5')] }; }
    if (p.startsWith('header.badges')) return prov('primary', '/documents/3', 'Date des résultats confirmée par la société (6-K du 13 octobre 2026).');
    if (p.startsWith('options.')) return prov('quote', '/data/items/' + LASTQ.ov, 'Volume d’options de la dernière séance relevé dans l’instantané de l’instrument ; mouvement implicite aux résultats non disponible à la collecte.', [dep('erisk', '/events/0')]);
    if (p.startsWith('insiders.')) return prov('primary', '/documents/12', 'Déclaration de détention 13G de Fairfax (6,4 % au 31 juillet 2026) lue dans le dépôt ; aucun formulaire 4 pour un émetteur 40-F, exempté de la section 16.', [dep('insiders', TXP == null ? '' : TXP)]);
    if (p.startsWith('shortInterest.')) return prov('quote', '/data/items/' + LASTQ.si, 'Position vendeuse FINRA au règlement indiqué et jours de couverture FINRA ; part du flottant = position / flottant publié par le fournisseur.', [dep('fund', LASTQ.stp + '/floatShares')]);
    if (p.startsWith('timeline.')) return prov('primary', '/documents/3', 'Date des résultats confirmée par la société (6-K du 13 octobre 2026) ; dates des pairs : calendrier de résultats collecté, une seule source ; dates macro : registre des événements et calendriers officiels cités par événement ; fin du plan : plan de la fiche.', [dep('earn', '/events'), dep('erisk', '/events/0'), dep('primary', '/documents/4')]);
    if (p.startsWith('tribunal.')) return prov('bars', B, 'Tribunal de la fiche : chaque chiffre plaidé est repris de la section qui le prouve (barres certifiées, dépôts SEC, agrégats IFRS, multiples collectés).', [dep('comparison', ''), dep('primary', '/documents/3'), dep('primary', '/documents/4'), dep('primary', '/documents/6'), dep('context', '')]);
    if (p.startsWith('bottomEstimation.')) return prov('bars', B, 'Planchers techniques lus sur les barres certifiées (plus bas du 26 octobre et du 17 juillet) ; plancher de valeur = multiple des producteurs (statistiques collectées) × EBITDA combiné indicatif (agrégats IFRS d’Equinox + EBITDA 2025 d’Orla) diminué d’une hypothèse de baisse de l’or, − dette + trésorerie, divisé par le nombre d’actions du rapport de gestion.', [dep('bars', lvPtr('s1')), dep('bars', lvPtr('s2')), dep('primary', '/documents/0'), dep('primary', '/documents/6'), dep('context', ''), dep('comparison', C('GLD'))]);
    if (/^tradeIdea\.(thesis|entryNote|statusNote|banner|horizon|catalysts|invalidation)/.test(p)) return prov('bars', B + '/' + N + '/4', 'Niveaux lus sur les barres certifiées d’EQX et de GLD ; plafond, objectifs et taille calculés ; date des résultats confirmée par la société (6-K du 13 octobre) ; liquidité = médiane close × volume sur vingt séances.', [...geo, dep('bars', lvPtr('trigger')), dep('comparison', C('GLD')), dep('primary', '/documents/3'), dep('primary', '/documents/4')]);
    if (/^news\.[0-3]\./.test(p) || p.startsWith('verdict.') || p.startsWith('macro.impact') || p.startsWith('risks.') || p.startsWith('blastRadius.contradictions')) {
      const v = getPath(LAST, p); if (typeof v !== 'string' || !/(GLD|GDX|USO|bêta|séance|depuis le|%)/.test(v)) return null;
      return prov('bars', B, 'Variations de clôture à clôture lues sur les barres certifiées d’EQX et des comparables (GLD, GDX, USO, pairs) ; bêta d’EQX sur GLD recalculé sur rendements logarithmiques communs ; faits d’entreprise lus dans les dépôts SEC ouverts et hachés.', [dep('comparison', ''), dep('primary', '/documents/3'), dep('primary', '/documents/4'), dep('primary', '/documents/0')]);
    }
    return null;
  },
  sectionDocs: { verdict: [3, 4, 0, 6], business: [4, 3, 2, 9], news: [3, 4, 5, 9], earnings: [4, 3, 0, 1], capitalStructure: [2, 0, 5, 7, 8, 11, 6], filingsReview: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], risks: [4, 3, 10, 2], globalScore: [4], meta: [3], disclaimer: [3], macro: [4], options: [3], social: [3], header: [2], shortInterest: [2], insiders: [12], technicals: [3], performance: [3], timeline: [3, 4], bottomEstimation: [0, 6] },
  score: { business: 24, technical: -12, capital: 6, calendar: -6, dilution: -6, risk: 40 },
  riskScoreReason: 'Jugement qualitatif sur dix : producteur rentable et désendetté (trésorerie nette de 163 M$ au 30 septembre, chiffre préliminaire), mais au bêta de 1,9 sur l’or alors que GLD retrouve ses plus bas de juin et juillet ; coûts poussés par le carburant, déjà au-dessus de la fourchette prévue au deuxième trimestre ; prévision annuelle qui exige un quatrième trimestre record ; changement de directeur général le 31 octobre ; un quart de la production au Nicaragua, sous sanctions américaines visant le secteur aurifère ; résultats le 9 novembre.',
  compose: c => require('./compose-eqx.cjs')(c, x => { LAST = x; return x; }, { ORLA_EBITDA_2025, PEERS, MULT, med, LASTQ }),
  groups: S.groups,
  eventDefault: { leader: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; son multiple reste l’étalon du secteur', direct_peer: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; ses coûts restent le point de comparaison', upstream: 'Matière première sans publication propre ; suit l’offre, la demande et le dollar', downstream: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', second_order: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; suit le prix de l’or', sector_proxy: 'Panier sans publication propre ; exposé aux résultats de ses grandes pondérations' },
  eventRisk: {
    NEM: 'Troisième trimestre déjà publié, avant la fenêtre collectée de quatorze jours ; sa lecture des coûts est connue',
    B: 'Résultats annoncés le 9 novembre (une seule source), le même soir qu’Equinox',
    AEM: 'Résultats annoncés le 28 octobre (une seule source) : premier grand producteur canadien à publier',
    AGI: 'Résultats annoncés le 28 octobre (une seule source) : coûts canadiens et mexicains du trimestre',
    KGC: 'Résultats annoncés le 28 octobre (une seule source)',
    EGO: 'Résultats annoncés le 28 octobre (une seule source)',
    SSRM: 'Résultats annoncés le 3 novembre (une seule source)',
    BTG: 'Résultats annoncés le 4 novembre (une seule source)',
    RGLD: 'Résultats annoncés le 4 novembre (une seule source)',
    IAG: 'Résultats annoncés le 5 novembre (une seule source)',
    WPM: 'Résultats annoncés le 5 novembre (une seule source)',
  },
  blastDoc: 3,
  scenarios: c => require('./compose-eqx.cjs').scenarios(c),
  contradictions: c => require('./compose-eqx.cjs').contradictions(c, { ORLA_EBITDA_2025, PEERS, MULT, med }),
  missingData: c => require('./compose-eqx.cjs').missingData(c),
  limitations: ['Agrégats IFRS d’Equinox seul sur douze mois au 30 juin 2026 : antérieurs à Orla (31 juillet 2026) ; le multiple combiné ajoute l’EBITDA 2025 d’Orla, période non alignée, et un périmètre de dettes à dates mêlées (30 septembre, 30 juin, 31 mars).', 'Trésorerie et dette au 30 septembre connues par un communiqué préliminaire ; les états du troisième trimestre sortent le 9 novembre.', 'Séries Yahoo de GLD et EGO reconstruites côté serveur le 27 octobre (séances du 21 et du 24 juillet manquantes auparavant), contrôlées avant la collecte.', 'Multiples des pairs issus des statistiques courantes, relevées en instantané, sans historique daté.', 'Transactions d’initiés non couvertes : les dirigeants canadiens déclarent au Canada.'],
});
