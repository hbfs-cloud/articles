'use strict';
// Dossier Hyperliquid Strategies (PURR) v3 au close du 2026-10-26, refonte du 27 octobre 2026 au gabarit FICO (R08).
// Véhicule de trésorerie d'actifs numériques : aucun multiple d'EBITDA ou de revenus n'a de sens. La grille publiée est
// la valeur du HYPE détenu par action, calculée sur la dernière structure déposée de façon cohérente (424B3, 8 septembre :
// 33,2 millions d'unités, 237 919 288 actions ordinaires, 26 587 647 actions issues des préférentielles) et sur la
// clôture UTC certifiée du HYPE au 26 octobre (collecte crypto du run, plan analyses/PURR/_runs/20261027/crypto-plan.json).
// Les agrégats financiers viennent du 10-K de l'exercice clos le 30 juin 2026 (cfg.manualFinancials). Le nombre d'actions
// de la capitalisation est celui de la circulaire définitive (278 271 288 au 30 septembre).
// Barres certifiées Yahoo (plan analyse). PURR, MSTR, HYPD, SBET, FWDI, ASST, GEMI et CLSK manquaient les séances des
// 21 et/ou 24 juillet 2026 : RefreshBars ciblé sur ces huit symboles (jeton de portée refresh, effacé après usage) le
// 27 octobre à 10 h 33 UTC, contrôle des séances, puis collecte complète. ETHA (regroupement 1 pour 3 du 6 octobre non
// ajusté dans la série) remplacé par FETH.
// Relectures du 27 octobre (QA senior, contradicteur, war room) : deuxième base de valeur par action = relevé hebdomadaire
// publié par la société sur son site (canal désigné par le 424B3), fichiers JSON hachés dans _primary/ir/ (lus le
// 27 octobre à 12 h 42 UTC), non audités ; ils sont déclarés comme constats textuels du manifeste primaire (aiguilles
// vérifiées sur le fichier haché), jamais comme dépôt SEC.
// Provenance : le gabarit commun route les lignes de fondamentaux sans consulter cfg.route ; les quatre lignes qui
// combinent dépôts, clôture du titre et clôture du HYPE reçoivent ici leur provenance exacte (enveloppe de writeEvidence,
// locale à ce générateur).
const K = require('../../../../tools/lib/analysis-v3-kit.cjs');
const R = require('../../../../tools/lib/analysis-v3-r08.cjs');
const S = require('./static-purr.cjs');
const BODY = require('./compose-purr-body.cjs');
const GEN = 'analyses/PURR/_runs/20261027/build-purr.cjs';
const REF = '2026-10-26';
const CRYPTO = 'analyses/PURR/_runs/20261027/crypto/hype_bars.json';
const ACC_10K = S.ACC_10K;

let LAST = null;
const MANIFEST = 'analyses/PURR/_runs/20261027/revision/primary-manifest.json';
const IR = require('./compose-purr.cjs');
// Relevé hebdomadaire de la société : constats textuels ajoutés au manifeste primaire (fichier haché + aiguilles), avant
// que le gabarit ne hache le manifeste comme intrant. Les valeurs publiées sont relues dans ces fichiers par compose-purr.
function injectIr() {
  const m = K.read(MANIFEST), add = (id, file, needles) => {
    const txt = K.bytes(file).toString('utf8'); for (const n of needles) if (!txt.includes(n)) throw Error('aiguille absente du relevé ' + id + ' : ' + n);
    m.semantic_findings[id] = { source_path: file, source_sha256: K.sha(K.bytes(file)), source_needles: needles, raw_document: file, raw_sha256: K.sha(K.bytes(file)),
      source_kind: 'issuer_weekly_dashboard_unaudited', source_url: 'https://www.hypestrat.xyz/api/' + file.split('/').pop().replace('.json', ''), retrieved_at: '2026-10-27T12:42:44Z',
      note: 'Relevé hebdomadaire publié par la société sur son site, canal désigné par le 424B3 (« updated weekly with a one-week data delay ») ; non audité, non déposé à la SEC.' };
  };
  const I = K.read(IR.IR_INPUTS).inputs, H = K.read(IR.IR_HISTORY).snapshots.map(x => x.inputs);
  add('ir_inputs', IR.IR_INPUTS, ['"hypeHeld":' + I.hypeHeld + ',"basicShares":' + I.basicShares, '"cash":' + I.cash + ',"taxRate":' + I.taxRate + ',"taxBasis":' + I.taxBasis, '"cashFromFin":' + I.cashFromFin, '"effectiveDate":"' + I.effectiveDate + '"']);
  add('ir_history', IR.IR_HISTORY, ['10/01/2026', '09/17/2026', '10/15/2026'].flatMap(d => { const x = H.find(y => y.effectiveDate === d); return ['"hypeHeld":' + x.hypeHeld + ',"basicShares":' + x.basicShares, '"cashFromFin":' + x.cashFromFin, '"effectiveDate":"' + d + '"']; }));
  K.write(MANIFEST, m);
}
const getPath = (o, p) => p.split('.').reduce((n, k) => n == null ? undefined : n[k], o);

// Pointeurs dans les artefacts collectés.
const crypto = K.read(CRYPTO), cryData = crypto.results[0].data;
const cIdx = sym => { const i = cryData.findIndex(x => x.symbol === sym); if (i < 0) throw Error('série crypto absente ' + sym); return i; };
const hypePtr = d => { const i = cIdx('HYPE-USD'), j = cryData[i].bars.findIndex(b => b[0] === d); if (j < 0) throw Error('clôture HYPE absente ' + d); return '/results/0/data/' + i + '/bars/' + j + '/4'; };
const newsRaw = K.read('analyses/PURR/_data/corporate_actions.json');
const newsPtr = (() => { for (const [ri, r] of newsRaw.results.entries()) for (const [di, d] of (r.data || []).entries()) for (const [ni, n] of (d.data || []).entries()) if (/Webcast to Discuss Results for the Quarter Ended September 30, 2026/.test(n.title || '')) return '/results/' + ri + '/data/' + di + '/data/' + ni; throw Error('communiqué de résultats absent du flux'); })();
const quote = K.read('analyses/PURR/_data/instrument.json');
const siPtr = '/data/items/' + quote.data.items.findIndex(x => x.type === 'instrument_short_interest');
const ctxRaw = K.read('analyses/PURR/_data/comparison_context.json'), peerPtr = {};
(function walk(o, q) { if (o && typeof o === 'object') { if (o.type === 'instrument_comprehensive_stats' && o.symbol) peerPtr[o.symbol] = q; for (const [k, v] of Object.entries(o)) walk(v, q + '/' + k); } })(ctxRaw, '');

// Enveloppe de writeEvidence : provenance des lignes de fondamentaux qui mêlent dépôts SEC, clôture du titre et HYPE.
const origWrite = K.writeEvidence;
K.writeEvidence = opts => {
  const { dep, prov } = K.provenance(opts.inputs);
  const bars = K.read('analyses/PURR/_data/bars.json'), N = bars.results[0].data[0].bars.length - 1, CL = '/results/0/data/0/bars/' + N + '/4';
  const docs = i => dep('primary', '/documents/' + i);
  const navRow = p => {
    const m = p.match(/^fundamentals\.rows\.(\d+)\./); if (!m) return null;
    const row = LAST.fundamentals.rows[+m[1]], NM = BODY.NAV_METRICS;
    const hy = [dep('crypto', hypePtr(REF)), dep('crypto', hypePtr('2026-09-25'))], ir = [dep('primary', '/semantic_findings/ir_inputs'), dep('primary', '/semantic_findings/ir_history')];
    const peers = ['BMNR', 'SBET', 'FWDI', 'MSTR', 'HYPD'].map(s => dep('context', peerPtr[s] + '/priceToBook'));
    if (row.metric === NM.irHps) return prov('primary', '/semantic_findings/ir_inputs', 'HYPE par action = HYPE détenus ÷ actions (ordinaires et préférentielles converties) du relevé hebdomadaire de la société, mise à jour du 22 octobre, données au 15 octobre, fichier haché, non audité ; comparaison avec le 424B3 (8 septembre) et le 10-K (30 juin).', [dep('primary', '/semantic_findings/ir_history'), docs(1), docs(0)]);
    if (row.metric === NM.irMult) return prov('bars', CL, 'Multiple = clôture certifiée du titre ÷ (HYPE par action du relevé de la société × clôture UTC certifiée du HYPE) ; variante avec trésorerie du relevé et impôt différé recalculé = taux publié × (valeur du HYPE − base fiscale publiée) ; 25 septembre : relevé arrêté au 24 septembre (mise à jour du 1er octobre).', [...hy, ...ir, dep('bars', '/results/0/data/0/bars/' + (N - 21) + '/4')]);
    if (row.metric === NM.hypeValue) return prov('crypto', hypePtr(REF), 'Valeur du HYPE par action = HYPE détenus au 8 septembre (424B3) ÷ (actions ordinaires au 8 septembre + actions issues des préférentielles) × clôture UTC certifiée du HYPE ; même calcul au 25 septembre pour la comparaison.', [...hy, docs(1), docs(0)]);
    if (row.metric === NM.mnav) return prov('bars', CL, 'Multiple = clôture certifiée du titre ÷ valeur du HYPE par action (structure du 8 septembre, 424B3 ; clôture UTC certifiée du HYPE) ; sensibilité = 1 % du HYPE ; pairs : cours sur valeur comptable des statistiques collectées le 27 octobre (non point-in-time).', [...hy, docs(1), docs(0), dep('bars', '/results/0/data/0/bars/' + (N - 21) + '/4'), ...peers]);
    if (row.metric === NM.implied) return prov('bars', CL, 'Prix implicite = clôture certifiée du titre ÷ HYPE par action (relevé de la société, puis 424B3) ; écart rapporté à la clôture UTC certifiée du HYPE ; trésorerie du relevé, impôt différé recalculé au taux et sur la base fiscale publiés.', [...hy, ...ir, docs(1), docs(0)]);
    if (row.metric === NM.irSales) return prov('primary', '/semantic_findings/ir_history', 'Ventes de septembre = écarts du nombre d’actions et du financement cumulé entre les relevés arrêtés au 10 septembre (mise à jour du 17) et au 8 octobre (mise à jour du 15) ; prix moyen = financement ÷ actions ; HYPE par action comparé au relevé du 15 octobre. Non audité.', [dep('primary', '/semantic_findings/ir_inputs')]);
    if (row.metric === NM.buyback) return prov('primary', '/documents/3', 'Rachat autorisé et montant disponible lus dans le 8-K et son communiqué ; part de la capitalisation = 72 M$ ÷ (clôture certifiée × actions au 30 septembre de la circulaire) ; aucun rachat visible dans le relevé de la société au 15 octobre.', [docs(4), docs(0), docs(2), dep('bars', CL), ...ir]);
    return null;
  };
  return origWrite({ ...opts, sourceFor: p => navRow(p) || opts.sourceFor(p) });
};

R.build({
  ticker: 'PURR', shortName: 'Hyperliquid Strategies', cik: S.CIK, generator: GEN, mode: 'breakout', peers: true, minBars: 200,
  extraInputs: [{ name: 'quote', path: 'analyses/PURR/_data/instrument.json' }, { name: 'crypto', path: CRYPTO }, { name: 'news', path: 'analyses/PURR/_data/corporate_actions.json' }],
  ref: REF, run: '20261027', asOf: '2026-10-27',
  xbrl: { ttm: {}, instant: {}, da: ['da'], debt: ['debt'], cash: ['cash'] },
  manualFinancials: { figures: {
    rev:  { value: 9460e3, form: '10-K', accn: ACC_10K, start: '2025-07-01', end: '2026-06-30', doc: 0 },
    ebit: { value: (9460 - 13951) * 1e3, form: '10-K', accn: ACC_10K, start: '2025-07-01', end: '2026-06-30', doc: 0 },
    ni:   { value: 305542e3, form: '10-K', accn: ACC_10K, start: '2025-07-01', end: '2026-06-30', doc: 0 },
    da:   { value: 0, form: '10-K', accn: ACC_10K, start: '2025-07-01', end: '2026-06-30', doc: 0 },
    debt: { value: 0, form: '10-K', accn: ACC_10K, end: '2026-06-30', doc: 0 },
    cash: { value: 137917e3, form: '10-K', accn: ACC_10K, end: '2026-06-30', doc: 0 },
  } },
  scenarioBasis: 'revenue', scenarioMultiple: 1,
  valuationBasis: 'Véhicule de trésorerie d’actifs numériques : valorisation par la valeur du HYPE détenu par action, non par un multiple.',
  valuationScenario: c => ({
    status: 'non_applicable', reason_code: 'NON_POSITIVE_EBITDA',
    reason: 'Hyperliquid Strategies est un véhicule de trésorerie d’actifs numériques sans exploitation significative (revenus de staking de 9,46 M$ sur l’exercice clos le 30 juin 2026, EBITDA fournisseur nul) : aucun multiple d’EBITDA ou de revenus n’a de sens. La grille publiée est la valeur du HYPE détenu par action (structure déposée au 8 septembre, clôture UTC certifiée du HYPE au 26 octobre), comparée au cours.',
    basis: { input_path: 'analyses/PURR/_data/fundamentals.json', input_sha256: c.K.sha(c.K.bytes('analyses/PURR/_data/fundamentals.json')), source_pointer: '/data/items/0/results/1/data/0/ebitda' },
  }),
  shares: { value: 278271288, doc: 2 },
  levels: {
    trigger: { d: '2026-10-21', c: 2 },  // plus haut du 21 octobre, sommet de la base de deux semaines
    stop: { d: '2026-10-22', c: 3 },     // plus bas du 22 octobre
    abandon: { d: '2026-10-22', c: 3 },  // plus bas du 22 octobre, fond de la base
    s1: { d: '2026-10-22', c: 3 }, s2: { d: '2026-08-19', c: 3 },   // plus bas du 19 août, départ du mouvement de l'été
    r1: { d: '2026-10-13', c: 2 },       // plus haut du 13 octobre
    r2: { d: '2026-10-07', c: 2 },       // plus haut du 7 octobre, bas du trou d'ouverture
    r3: { d: '2026-10-06', c: 3 },       // plus bas du 6 octobre, haut du trou d'ouverture
    r4: { d: '2026-10-05', c: 2 },       // plus haut du 5 octobre
  },
  supports: ['s1', 's2'], resistances: ['r1', 'r2', 'r3'],
  targets: ({ lv }) => ({ tp1: lv('r3'), tp2: lv('r4'), range: null }),
  levelsMethod: 'Déclencheur = plus haut du 21 octobre, sommet de la base de deux semaines ; stop et seuil d’abandon = plus bas du 22 octobre ; TP1 = plus bas du 6 octobre, haut du trou d’ouverture du 7 ; TP2 = plus haut du 5 octobre ; plafond d’achat = (TP1 + 1,5 × stop) / 2,5 arrondi au cent inférieur ; pourcentages depuis l’entrée ; R/R = gain / risque.',
  inventory: 54,
  reviewScope: 'Dépôts EDGAR de Hyperliquid Strategies Inc (CIK 0002078856) du 1er août 2025 au 26 octobre 2026 : 54 formulaires hors déclarations d’initiés (10-K, trois 10-Q, dix 8-K, sept 424B3, les S-1, S-4 et la circulaire de l’assemblée du 4 novembre, déclarations de détention 13G). Huit pièces décisionnelles ouvertes et hachées : le 10-K de l’exercice clos le 30 juin 2026, le prospectus 424B3 du 23 septembre (structure au 8 septembre), la circulaire définitive du 2 octobre (actions au 30 septembre, vote du 4 novembre), le 8-K du rachat et son communiqué (26 octobre), les amendements 1 et 3 de la facilité Chardan et le communiqué des résultats annuels. Vérification par type : aucune dette, aucune obligation convertible, aucun 8-K Item 3.02 depuis la fusion du 2 décembre 2025. Les formulaires 4 relevés ne montrent que des attributions et des distributions.',
  docs: S.docs,
  needles: S.needles,
  route: (p, { prov, dep, B, N, lvPtr, TXP }) => {
    if (p === 'verdict.score' || p === 'risks.riskScore') return null;   // jugements éditoriaux, routés par le gabarit
    const CL = B + '/' + N + '/4', hy = [dep('crypto', hypePtr(REF)), dep('crypto', hypePtr('2026-09-25'))], D = i => dep('primary', '/documents/' + i);
    const IRD = [dep('primary', '/semantic_findings/ir_inputs'), dep('primary', '/semantic_findings/ir_history')];
    const mixed = (method, extra = []) => prov('bars', CL, method + ' Relevé hebdomadaire de la société (non audité) lu dans les fichiers hachés du manifeste primaire.', [...hy, D(0), D(1), D(2), D(3), ...IRD, ...extra]);
    if (p === 'header.metrics.shortInterest' || p.startsWith('shortInterest.')) return prov('quote', siPtr, 'Position vendeuse et jours de couverture du relevé FINRA (règlement du 15 octobre) ; rapportée aux actions au 30 septembre (circulaire) et au flottant du fournisseur.', [D(2), dep('fund', '/data/items/0/results/2/data/0/floatShares')]);
    if (p.startsWith('options.')) return prov('erisk', '/events/0', 'Calendrier de résultats collecté : mouvement implicite non calculable à la collecte (marché fermé) ; chaîne d’options facultative non retenue.');
    if (p.startsWith('insiders.')) return prov('insiders', TXP == null ? '' : TXP + '/transactions', 'Formulaires 4 relevés sur un an : attributions (code A) et distributions (code J) seulement ; couverture officielle incomplète, aucun solde net affirmé.');
    if (p === 'header.metrics.marketCap') return prov('bars', CL, 'Capitalisation = clôture certifiée × actions ordinaires au 30 septembre (circulaire).', [D(2)]);
    if (p.startsWith('archiveHistory.')) return prov('status', '/captured_at', 'Dates des versions précédentes archivées dans le dépôt (analyses/PURR/archive/20260924 et 20260925) ; note du plan expiré reprise de l’historique de cycle de vie.', [dep('archive', '/meta/statusHistory/1/note')]);
    if (p.startsWith('timeline.')) return prov('erisk', '/events/0/report_date', 'Échéancier : résultats confirmés par le communiqué de la société du 23 octobre (flux d’actualités collecté) et le calendrier collecté ; assemblée lue dans la circulaire définitive (14 h à New York, 20 h à Paris après le passage à l’heure d’hiver américaine du 1er novembre) ; rendez-vous macro du registre data/scheduled-events.json et du calendrier du BLS ; fin de plan = plan de la fiche.', [dep('news', newsPtr), D(2), dep('earn', '/events')]);
    if (p === 'earnings.nextEarnings') return prov('erisk', '/events/0/report_date', 'Date des résultats du trimestre clos le 30 septembre : calendrier collecté, confirmée par le communiqué de la société du 23 octobre.', [dep('news', newsPtr), dep('quote', '/data/items/' + quote.data.items.findIndex(x => x.type === 'instrument_calendar') + '/nextEarningsDate')]);
    if (/^earnings\.sourceRefs\.2\./.test(p)) return prov('news', newsPtr, 'Communiqué de la société du 23 octobre (titre, date et lien relevés dans le flux d’actualités collecté).');
    if (p.startsWith('earnings.')) return mixed('Chiffres de l’exercice lus dans le 10-K et le communiqué annuel ; HYPE au 30 juin = juste valeur ÷ unités (10-K), au 30 septembre = clôture UTC certifiée ; date confirmée par le communiqué du 23 octobre.', [D(7), dep('crypto', hypePtr('2026-09-30')), dep('news', newsPtr)]);
    if (p === 'news.0.date' || p.startsWith('news.0.')) return mixed('Rachat lu dans le 8-K et son communiqué ; variations de clôture à clôture lues sur les barres certifiées du titre et des comparables ; variation du HYPE sur la journée UTC certifiée.', [D(4), dep('comparison', ''), dep('crypto', hypePtr('2026-10-23'))]);
    if (p.startsWith('news.1.')) return prov('news', newsPtr, 'Communiqué de la société du 23 octobre relevé dans le flux d’actualités collecté ; heure de la conférence (17 h 15 à New York) convertie en heure de Paris.', [dep('erisk', '/events/0/report_date')]);
    if (p.startsWith('news.2.')) return prov('bars', B, 'Variations de clôture à clôture et volume lus sur les barres certifiées du titre et des comparables ; HYPE sur la journée UTC certifiée.', [dep('comparison', ''), dep('crypto', hypePtr('2026-10-22'))]);
    if (p.startsWith('news.3.')) return prov('primary', '/documents/2', 'Circulaire définitive : date de l’assemblée, actions au 30 septembre, plafond de la proposition n° 2 ; actions au 8 septembre lues dans le 424B3.', [D(1)]);
    if (p.startsWith('tribunal.')) return mixed('Tribunal de la fiche : chaque chiffre plaidé est repris de la section qui le prouve (barres certifiées du titre, des comparables et du HYPE, dépôts SEC, relevé FINRA, statistiques des pairs).', [D(7), dep('comparison', ''), dep('quote', siPtr), dep('context', peerPtr.HYPD + '/priceToBook')]);
    if (p.startsWith('bottomEstimation.')) return mixed('Planchers techniques lus sur les barres certifiées (plus bas du 22 octobre et du 19 août) ; plancher de valeur = HYPE par action (424B3) × juste valeur unitaire du 30 juin (10-K) × multiple du 26 octobre ; pairs et positions vendeuses des statistiques collectées.', [dep('bars', lvPtr('s1')), dep('bars', lvPtr('s2')), dep('quote', siPtr), dep('context', peerPtr.HYPD + '/priceToBook'), dep('context', peerPtr.BMNR + '/priceToBook'), dep('context', peerPtr.SBET + '/priceToBook')]);
    if (p.startsWith('macro.impact')) return prov('comparison', '', 'Rendements simples vingt et une séances : titre et comparables sur barres certifiées, HYPE, ether et bitcoin sur clôtures UTC certifiées.', [dep('bars', B), ...hy, dep('crypto', '/results/0/data/' + cIdx('BTC-USD') + '/bars'), dep('crypto', '/results/0/data/' + cIdx('ETH-USD') + '/bars')]);
    if (/^tradeIdea\.(statusNote|banner|entryNote|horizon|thesis|catalysts|invalidation)/.test(p)) return mixed('Niveaux lus sur les barres certifiées ; plafond, objectifs et taille calculés ; plus bas UTC du HYPE lu sur la série certifiée ; dates du vote (circulaire) et des résultats (communiqué) ; heures converties en heure de Paris.', [dep('bars', lvPtr('trigger')), dep('bars', lvPtr('stop')), dep('crypto', hypePtr('2026-10-24').replace(/4$/, '3')), dep('news', newsPtr)]);
    if (/^(verdict|business|capitalStructure|filingsReview|risks|globalScore|meta\.(description|ogDescription)|header\.badges|technicals\.badges)/.test(p)) {
      const v = getPath(LAST, p); if (typeof v !== 'string' && typeof v !== 'number') return null;
      return mixed('Chiffres lus dans les dépôts SEC ouverts et hachés (10-K, 424B3, circulaire, 8-K et communiqués) ; cours du titre, des comparables et du HYPE lus sur les clôtures certifiées ; relevé FINRA et statistiques des pairs collectés.', [D(4), D(5), D(6), D(7), dep('comparison', ''), dep('quote', siPtr), dep('context', peerPtr.HYPD + '/priceToBook')]);
    }
    return null;
  },
  sectionDocs: { verdict: [1, 0, 2, 3], business: [0, 1, 7], news: [3, 4], earnings: [0, 7], capitalStructure: [2, 1, 0, 3, 5], filingsReview: [0, 1, 2, 3, 4, 5, 6, 7], risks: [0, 1, 2], globalScore: [1, 3], meta: [1], disclaimer: [1], macro: [1], options: [1], social: [1], header: [2], shortInterest: [2], insiders: [0], technicals: [1], performance: [1], timeline: [2], bottomEstimation: [0], tribunal: [0], archiveHistory: [0] },
  score: { business: 12, technical: -10, capital: 8, calendar: -6, dilution: -12, risk: 44 },
  riskScoreReason: 'Jugement qualitatif sur dix : un panier coté d’un seul jeton volatil (HYPE −15 % en un mois, titre −29 %), payé désormais sous la valeur du jeton détenu ; une dilution de 17 % en trois semaines de septembre et un vote le 4 novembre qui lèverait le plafond des ventes d’actions sous 12,02 $ ; un résultat net dominé par la réévaluation du jeton ; des gaps d’ouverture liés à un actif qui cote le week-end. Contrepoids : aucune dette, un rachat de 100 M$.',
  compose: c => { injectIr(); return require('./compose-purr.cjs')(c, x => { LAST = x; return x; }); },
  groups: S.groups,
  eventDefault: { leader: 'Aucune publication datée dans le calendrier des quatorze prochains jours ; son multiple d’actif reste le repère de la catégorie', direct_peer: 'Aucune publication datée dans le calendrier des quatorze prochains jours ; sa décote sur le jeton détenu reste le signal à suivre', upstream: 'Fonds ou émetteur sans publication datée dans les quatorze prochains jours ; suit le prix de son actif', downstream: 'Aucune publication datée dans le calendrier des quatorze prochains jours', second_order: 'Aucune publication datée dans le calendrier des quatorze prochains jours ; bêta au cycle des jetons à suivre', sector_proxy: 'Panier sans publication propre ; exposé aux résultats de ses grandes pondérations' },
  eventRisk: { MSTR: 'Résultats annoncés le 29 octobre (une seule source) : premier test du multiple des trésoreries après la baisse d’octobre', COIN: 'Résultats annoncés le 29 octobre (une seule source) : volumes de négociation des jetons au troisième trimestre', HOOD: 'Résultats annoncés le 27 octobre (une seule source) : activité crypto des particuliers', CRCL: 'Résultats annoncés le 4 novembre (une seule source) : circulation de l’USDC, collatéral d’Hyperliquid', MARA: 'Résultats annoncés le 4 novembre (une seule source) ; bêta au bitcoin', RIOT: 'Résultats annoncés le 4 novembre (une seule source) ; bêta au bitcoin' },
  blastDoc: 0,
  scenarios: c => require('./compose-purr.cjs').scenarios(c),
  contradictions: c => require('./compose-purr.cjs').contradictions(c),
  missingData: c => require('./compose-purr.cjs').missingData(c),
  limitations: ['Véhicule de trésorerie : valorisation par la valeur du HYPE détenu par action, non par un multiple d’EBITDA ou de revenus.', 'HYPE détenus déposés à la SEC au 8 septembre seulement (424B3) ; au-delà, relevé hebdomadaire de la société, non audité.', 'Clôtures du HYPE certifiées à partir du 24 septembre 2026 (série UTC).', 'Séances des 21 et 24 juillet rechargées côté serveur pour huit symboles avant la collecte ; ETHA écarté (regroupement 1 pour 3 du 6 octobre non ajusté).', 'Relevé hebdomadaire de la société (HYPE, actions, trésorerie, financement) non audité : seconde base, toujours attribuée.', 'Statistiques des pairs relevées en instantané, sans historique daté.'],
});
