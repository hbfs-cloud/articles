'use strict';
// Dossier Nebius Group (NBIS) v3 au close certifié du 2026-10-30, refonte du 2 novembre 2026 au gabarit R08 (fiche FICO).
// Décision du propriétaire du 2 novembre : publication le soir même, avant la certification de la clôture du 2 novembre ;
// tous les niveaux et indicateurs restent sur la clôture certifiée du 30 octobre, la séance du 2 novembre n'apparaît
// qu'en cours de séance horodaté, non certifié (revision/capture-live.json), sans aucun ordre calculé dessus.
// Reprise de la méthode du run du 27 octobre :
// Émetteur privé étranger néerlandais : 20-F annuel et 6-K, pas de 10-K/10-Q. Correction de la fiche du 25 septembre :
// les comptes sont établis en US GAAP (20-F, note de présentation), pas en IFRS. Les données XBRL officielles de la SEC
// (companyfacts) ne contiennent que le 20-F de l'exercice 2025 ; les 6-K intermédiaires n'y figurent pas, et la
// bibliothèque XBRL du gabarit ne lit que les formulaires 10-K/10-Q. Méthode du run précédent conservée : agrégats lus
// dans les états des dépôts primaires (cfg.manualFinancials), douze mois glissants au 30 juin 2026 = exercice 2025
// (20-F) + premier semestre 2026 − premier semestre 2025 (6-K du 12 août 2026), bilan au 30 juin 2026.
//   revenus 529,8 + 981,3 − 156,0 = 1 355,1 M$ ; résultat opérationnel −611,7 − 303,9 + 231,5 = −684,1 M$ ;
//   amortissements 417,9 + 471,7 − 124,3 = 765,3 M$ ; résultat des activités poursuivies 9,8 + 430,8 − 398,2 = 42,4 M$ ;
//   dette = obligations convertibles 8 499,0 M$ (valeur comptable) + dette courante 46,7 M$ ; trésorerie 8 042,1 M$.
// Actions = 271 855 218 actions A et B au 30 juin 2026 (état des capitaux propres) + 21 065 936 actions A des bons
// préfinancés Nvidia (prix d'exercice 0,0001 $, comptés dans le bénéfice par action de base) = 292 921 154.
// Les opérations postérieures au 30 juin (convertibles d'août, échange d'environ 15,8 millions d'actions, prêt garanti
// de juillet, ligne Citi d'octobre, ventes éventuelles au fil de l'eau) ne sont pas intégrées au bilan : elles sont
// décrites et chiffrées à part dans la fiche. Barres certifiées Yahoo (plan analyse), aucun rechargement nécessaire.
const R = require('../../../../tools/lib/analysis-v3-r08.cjs');
const S = require('./static-nbis.cjs');
const GEN = 'analyses/NBIS/_runs/20261102/build-nbis.cjs';
const REF = '2026-10-30';
const RUN = 'analyses/NBIS/_runs/20261102';
const ACC_6K = S.ACC_6K;
const SHARES = 271855218 + 21065936;

let LAST = null;
const getPath = (o, p) => p.split('.').reduce((n, k) => n == null ? undefined : n[k], o);
const fig = (value, extra) => ({ value, form: '6-K', accn: ACC_6K, doc: 0, ...extra });

const BUILT = R.build({
  ticker: 'NBIS', shortName: 'Nebius', cik: 1513845, generator: GEN, mode: 'breakout', peers: true, clientBars: true,
  extraInputs: [{ name: 'quote', path: 'analyses/NBIS/_data/instrument.json' }, { name: 'live_quote', path: RUN + '/supplement/live_quote.json' },
    { name: 'live_options', path: RUN + '/supplement/live_options.json' }, { name: 'calendar30', path: RUN + '/supplement/calendar30.json' }],
  ref: REF, run: '20261102', asOf: '2026-11-02',
  xbrl: { ttm: {}, instant: {}, da: ['da'], debt: ['debt'], cash: ['cash'] },
  manualFinancials: { figures: {
    rev: fig(1355100000, { tag: 'us-gaap:Revenues (20-F 2025 + 6-K S1 2026 − S1 2025)', start: '2025-07-01', end: '2026-06-30' }),
    ebit: fig(-684100000, { tag: 'us-gaap:OperatingIncomeLoss (20-F 2025 + 6-K S1 2026 − S1 2025)', start: '2025-07-01', end: '2026-06-30' }),
    ni: fig(42400000, { tag: 'us-gaap:IncomeLossFromContinuingOperations (20-F 2025 + 6-K S1 2026 − S1 2025)', start: '2025-07-01', end: '2026-06-30' }),
    da: fig(765300000, { tag: 'us-gaap:DepreciationAndAmortization (20-F 2025 + 6-K S1 2026 − S1 2025)', start: '2025-07-01', end: '2026-06-30' }),
    debt: fig(8545700000, { tag: 'us-gaap:Debt non courante + courante au 30 juin 2026 (6-K)', end: '2026-06-30' }),
    cash: fig(8042100000, { tag: 'us-gaap:CashAndCashEquivalentsAtCarryingValue au 30 juin 2026 (6-K)', end: '2026-06-30' }),
  } },
  scenarioBasis: 'revenue', scenarioMultiple: 12.8,
  valuationBasis: 'US GAAP, douze mois glissants au 30 juin 2026 lus dans les dépôts primaires de Nebius (émetteur privé étranger : 20-F et 6-K ; les 6-K intermédiaires ne figurent pas dans les données XBRL officielles de la SEC) : revenus 1 355,1 M$ = 529,8 (exercice 2025, 20-F) + 981,3 (premier semestre 2026, 6-K du 12 août) − 156,0 (premier semestre 2025) ; perte opérationnelle 684,1 M$ ; amortissements 765,3 M$. Bilan au 30 juin 2026 : trésorerie 8 042,1 M$ ; dette = obligations convertibles 8 499,0 M$ en valeur comptable + dette courante 46,7 M$, hors 1 510,4 M$ de dettes de location. Actions : 271 855 218 actions A et B + 21 065 936 actions des bons préfinancés Nvidia = 292 921 154. 12,8 fois les revenus = médiane arrondie de l’EV/revenus de CoreWeave, IREN, Applied Digital, Oracle et Nvidia (statistiques relevées en instantané) : Nebius payé comme ses voisins sur ses revenus passés, avant la montée en charge des contrats ; ce n’est pas un objectif',
  shares: { value: SHARES, doc: 0 },
  levels: {
    trigger: { d: '2026-10-21', c: 2 }, // plus haut du 21 octobre, sommet du rebond qui a suivi la chute du 16
    stop: { d: '2026-10-26', c: 3 },    // plus bas du 26 octobre, plus bas depuis le 29 juillet
    abandon: { d: '2026-07-29', c: 3 }, // plus bas du 29 juillet, creux de la baisse de juillet
    s1: { d: '2026-10-26', c: 3 }, s2: { d: '2026-07-29', c: 3 },
    s3: { d: '2026-04-28', c: 3 },      // plus bas du 28 avril
    r1: { d: '2026-10-28', c: 2 },      // plus haut du 28 octobre, sommet du rebond avorté
    r2: { d: '2026-10-08', c: 2 },      // plus haut du 8 octobre, première séance de la baisse
    r3: { d: '2026-10-06', c: 2 },      // plus haut du 6 octobre, sommet d'octobre
  },
  supports: ['s1', 's2', 's3'], resistances: ['r1', 'r2', 'r3'],
  targets: ({ lv }) => ({ tp1: lv('r2'), tp2: lv('r3'), range: null }),
  levelsMethod: 'Déclencheur = plus haut du 21 octobre, sommet du rebond qui a suivi la chute du 16 ; stop = plus bas du 26 octobre ; seuil d’abandon = plus bas du 29 juillet ; R1 = plus haut du 28 octobre (sommet du rebond avorté) ; TP1 = plus haut du 8 octobre, première séance de la baisse ; TP2 = plus haut du 6 octobre, sommet d’octobre ; plafond d’achat = (TP1 + 1,5 × stop) / 2,5 arrondi au cent inférieur ; pourcentages depuis l’entrée ; R/R = gain / risque.',
  inventory: 39,
  reviewScope: 'Dépôts EDGAR de Nebius Group N.V. (CIK 1513845) du 27 octobre 2025 au 2 novembre 2026 : 38 formulaires hors déclarations d’initiés et avis de vente 144 (le 20-F de l’exercice 2025 et son amendement, 27 rapports 6-K et un 6-K/A, un prospectus 424B5, sept déclarations de détention 13G). Vérification EDGAR par type : un seul enregistrement universel F-3ASR, du 2 mai 2025 (333-286932) ; aucun F-3, S-3 ni S-3ASR déposé en 2026 ; dernier 424B5 le 12 novembre 2025 (programme au fil de l’eau). Quinze pièces décisionnelles ouvertes et hachées : les états financiers, la revue financière et la lettre du deuxième trimestre, la lettre du premier trimestre, le 20-F, les communiqués des obligations convertibles d’août, la ligne Citi d’octobre (rapport et communiqué), le prêt garanti de juillet, les contrats Meta et Microsoft, le prospectus du programme au fil de l’eau, les résultats de l’assemblée du 25 août et le partenariat Palantir. Contrôle du 2 novembre (liste des dépôts lue à 18 h 20 UTC) : aucun 6-K, F-3, 424B ni 13G depuis le 6-K du 22 octobre ; seulement quatre formulaires 4 (achats de l’administrateur Arne Grimme, vente de 333 actions du président John Boynton, plans 10b5-1) et un avis 144. Seizième pièce : le 8-K de Lumentum du 2 novembre (accord avec Marvell), dépôt d’un tiers.',
  docs: S.docs,
  needles: S.needles,
  route: (p, { prov, dep, B, N, lvPtr }) => {
    // Séance du 2 novembre en cours : cotation et chaîne d'options relevées pendant la séance (non certifiées).
    if (p.startsWith('options.') || /^verdict\.controlChecklist\.0\./.test(p) || /^news\.0\./.test(p)) return prov('live_quote', '/results/0/data/0', 'Cours de séance et chaîne d’options du 2 novembre relevés pendant la séance (heure de capture indiquée), non certifiés : aucun niveau du plan n’en dépend. Straddle = milieu achat-vente du call et du put au prix d’exercice le plus proche du cours, échéance du 13 novembre ; volatilités implicites telles que publiées par la chaîne.', [dep('live_options', '/results/0/data/0'), dep('bars', B + '/' + N + '/4')]);
    if (/^blastRadius\.groups\.\d+\.symbols\.\d+\.eventRisk$/.test(p)) return prov('calendar30', '/events', 'Calendrier de résultats sur trente jours relevé le 2 novembre ; dates de CoreWeave et de Nvidia confirmées par leurs communiqués (manifeste des sources).', [dep('quote', '')]);
    const LEVDEPS = [dep('context', ''), dep('fund', ''), dep('comparison', ''), dep('bars', B + '/' + N + '/4')];
    if (/^(verdict|globalScore|risks|business|filingsReview|capitalStructure)\./.test(p)) return prov('bars', B + '/' + N + '/4', 'Variations et niveaux lus sur les barres certifiées (Nebius et comparables) ; chiffres d’entreprise lus dans les dépôts SEC ouverts ; dette nette rapportée à la capitalisation = (dette − trésorerie du bilan publié par le fournisseur) / (clôture certifiée × actions) ; dates et propos attribués lus dans les pièces du manifeste des sources ; cours de séance du 2 novembre non certifié.', [dep('primary', '/documents/0'), dep('primary', '/documents/1'), dep('primary', '/documents/6'), dep('live_quote', '/results/0/data/0'), dep('quote', ''), ...LEVDEPS]);
    if (p.startsWith('timeline.') || p.startsWith('earnings.')) return prov('quote', '', 'Date de résultats de Nebius lue dans le bloc calendrier de l’instrument et confirmée par le communiqué de la société du 30 octobre (pièce hachée, revision/sources-manifest.json) ; dates de CoreWeave et de Nvidia lues dans leurs communiqués (même manifeste) et dans le calendrier sur trente jours ; rendez-vous macro aux calendriers officiels ; consensus tiré de la presse financière nommée ; straddle de séance non certifié.', [dep('calendar30', '/events'), dep('primary', '/documents/13'), dep('primary', '/documents/1'), dep('live_options', '/results/0/data/0')]);
    if (p.startsWith('shortInterest.')) { const q = require('./compose-nbis.cjs').quotePtr(); return prov('quote', q, 'Relevé FINRA bimensuel des positions vendeuses (date de règlement indiquée) rapporté au flottant publié par le fournisseur ; aucune tendance déduite d’un seul point.', [dep('fund', '')]); }
    if (p.startsWith('tribunal.')) return prov('bars', B, 'Tribunal de la fiche : chaque chiffre plaidé est repris de la section qui le prouve (barres certifiées, dépôts SEC, agrégats US GAAP, bilans des pairs et capitalisations collectés, cours de séance non certifié).', [dep('primary', '/documents/0'), dep('context', ''), dep('fund', ''), dep('comparison', ''), dep('live_quote', '/results/0/data/0')]);
    if (p.startsWith('bottomEstimation.')) return prov('bars', B, 'Planchers techniques lus sur les barres certifiées (plus bas du 26 octobre, du 29 juillet et du 28 avril) ; plancher de valeur = EV/revenus de CoreWeave (statistiques collectées) × bas de la prévision 2026 de la société − dette + trésorerie du 30 juin, divisé par le nombre d’actions.', [dep('bars', lvPtr('s1')), dep('bars', lvPtr('s2')), dep('primary', '/documents/0'), dep('primary', '/documents/13')]);
    if (p.startsWith('archiveHistory.')) return prov('status', '/captured_at', 'Horodatage de la refonte ; dates des versions précédentes = dossiers datés conservés sous analyses/NBIS/archive/ (AAAAMMJJ), la plus récente étant la fiche du 25 septembre archivée dans ce run.');
    const v = getPath(LAST, p); if (typeof v !== 'string') return null;
    // Séances de baisse d'octobre et d'août : variations lues sur les barres certifiées, causes attribuées à la presse
    // financière citée ou au dépôt du jour.
    if (/^news\.[1-5]\./.test(p)) return prov('bars', B, 'Variation de clôture à clôture lue sur les barres certifiées et comparée aux loueurs de calcul, aux clients et aux paniers sur la même séance ; cause attribuée au dépôt du jour ou à la presse financière citée, pas déduite des cours.', [dep('comparison', ''), dep('client', ''), dep('quote', '')]);
    return null;
  },
  sectionDocs: { verdict: [1, 0, 9, 10, 6], business: [3, 1, 10, 9, 14], news: [6, 5, 1], earnings: [1, 0, 13], capitalStructure: [0, 5, 4, 11, 12, 6, 8, 3], filingsReview: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], risks: [6, 0, 3, 5, 1], globalScore: [1], meta: [1], disclaimer: [1], macro: [1], social: [1], header: [0], insiders: [0], technicals: [1], performance: [1], timeline: [1, 13], tradeIdea: [1, 0, 13] },
  score: { business: 30, technical: -14, capital: -8, calendar: -6, dilution: -8, risk: 50 },
  riskScoreReason: 'Jugement qualitatif sur dix : un loueur de calcul dont la demande est signée (37,5 Md$ de carnet au 30 juin) mais que le marché traite comme un crédit depuis le 14 octobre ; 13,0 Md$ de principal d’origine en obligations convertibles après août, une ligne relais de 3,5 Md$ à un an, une perte opérationnelle sur douze mois, une prévision qui exige de doubler le rythme des revenus au second semestre, une dilution ouverte (programme au fil de l’eau, autorisation de 20 % du capital) et des résultats du troisième trimestre publiés le 12 novembre avant l’ouverture, date confirmée par la société le 30 octobre.',
  compose: c => require('./compose-nbis.cjs')(c, x => { LAST = x; return x; }),
  groups: S.groups,
  eventDefault: { leader: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; ses allocations de puces restent le signal à suivre', direct_peer: 'Aucune publication datée dans la fenêtre collectée de quatorze jours ; le rendement de ses obligations reste le signal à suivre', upstream: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', downstream: 'Calendrier de résultats non collecté pour ce client documenté ; ses budgets d’investissement fixent la demande', second_order: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', sector_proxy: 'Panier sans publication propre ; exposé aux résultats de ses grandes pondérations' },
  eventRisk: { CRWV: 'Résultats du troisième trimestre le mardi 10 novembre, conférence à 17 h (heure de New York), après la clôture (communiqué de CoreWeave) : baromètre du crédit du secteur, réaction le 11, la veille des résultats de Nebius', NVDA: 'Conférence de résultats le mardi 17 novembre à 17 h (heure de New York), après la clôture (communiqué de Nvidia) : pendant la détention possible', IREN: 'Résultats annoncés le 5 novembre (une seule source) : premier loueur de calcul à publier après la crise du crédit d’octobre', CORZ: 'Résultats annoncés le 5 novembre (une seule source) ; hébergement pour CoreWeave', WULF: 'Résultats annoncés le 6 novembre (une seule source) ; financement des hébergeurs', SMCI: 'Résultats annoncés le 3 novembre (une seule source) ; commandes de serveurs des loueurs', COHR: 'Résultats annoncés le 4 novembre (une seule source) ; commandes d’optique', LITE: 'Résultats et accord avec Marvell publiés le 2 novembre (8-K)', PLTR: 'Résultats annoncés le 2 novembre après la clôture (deux sources) ; rien de chiffré attendu sur le partenariat', CIFR: 'Résultats annoncés le 2 novembre avant l’ouverture (deux sources) ; lecture sur le coût du financement des hébergeurs', DELL: 'Résultats annoncés le 24 novembre (une seule source), après la fin de la fenêtre d’achat', MRVL: 'Résultats annoncés le 1er décembre (une seule source)' },
  blastDoc: 1,
  scenarios: c => require('./compose-nbis.cjs').scenarios(c),
  contradictions: c => require('./compose-nbis.cjs').contradictions(c),
  missingData: c => require('./compose-nbis.cjs').missingData(c),
  limitations: ['Agrégats US GAAP au 30 juin 2026 ; le troisième trimestre n’est pas publié.', 'Bilan au 30 juin : les opérations de financement postérieures (convertibles d’août, échange contre actions, prêt garanti de juillet, ligne Citi) sont décrites à part, non consolidées dans la valeur d’entreprise.', 'Multiples des pairs issus des statistiques courantes, relevées en instantané, sans historique daté.', 'Causes des séances d’octobre connues par la presse financière citée ; variations lues sur les barres certifiées.', 'Clôture du 2 novembre non certifiée à la publication : niveaux, indicateurs et rendements arrêtés au 30 octobre ; la séance du 2 novembre n’est décrite qu’en cours de séance horodaté.', 'Options : chaîne relevée pendant la séance du 2 novembre, non certifiée ; son prix intègre aussi toute la volatilité jusqu’au 13 novembre, pas seulement les résultats.', 'Consensus du troisième trimestre lu sur une seule page de presse financière (MarketBeat, enregistrée et hachée le 2 novembre), sans source de marché interne.'],
});

// Ligne « Dette nette / capitalisation » des fondamentaux : le gabarit R08 rattache chaque ligne à un seul dépôt primaire
// (_src). Ses chiffres viennent en réalité de trois sources harnachées : bilans du fournisseur (facette financials de
// fundamentals.json pour Nebius, de comparison_context.json pour CoreWeave et IREN), actions des statistiques collectées
// et clôtures certifiées du 30 octobre. La provenance de cette seule ligne est donc réécrite ici, de façon déterministe,
// puis le sidecar est réécrit avec l'empreinte du nouvel artefact de calcul (même forme que K.writeEvidence).
{
  const fs = require('fs'), path = require('path'), crypto = require('crypto');
  const ROOT = path.join(__dirname, '../../../..');
  const sha = p => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, p))).digest('hex');
  const CALC = RUN + '/revision/numeric-evidence.json', EVID = 'data/analyses-evidence/NBIS.json', OUT = 'data/analyses-data/NBIS.json';
  const calc = JSON.parse(fs.readFileSync(path.join(ROOT, CALC), 'utf8'));
  const inp = n => { const x = calc.inputs.find(i => i.name === n); if (!x) throw Error('intrant absent ' + n); return x; };
  const dep = (n, p) => ({ input_path: inp(n).path, input_sha256: inp(n).sha256, source_pointer: p });
  const walk = (o, type, sym, q = '') => { if (!o || typeof o !== 'object') return null; if (o.type === type && o.symbol === sym) return q; for (const [k, v] of Object.entries(o)) { const r = walk(v, type, sym, q + '/' + k); if (r != null) return r; } return null; };
  const ctx = JSON.parse(fs.readFileSync(path.join(ROOT, inp('context').path), 'utf8')), fund = JSON.parse(fs.readFileSync(path.join(ROOT, inp('fund').path), 'utf8'));
  const cmp = JSON.parse(fs.readFileSync(path.join(ROOT, inp('comparison').path), 'utf8')).data.items[0].results[0].data;
  const barPtr = sym => { const i = cmp.findIndex(r => r.symbol === sym); if (i < 0) throw Error('barres absentes ' + sym); return '/data/items/0/results/0/data/' + i + '/bars/' + (cmp[i].bars.length - 1) + '/4'; };
  const fNb = walk(fund, 'instrument_comprehensive_financial', 'NBIS');
  const extra = [dep('fund', fNb + '/totalDebt'), dep('fund', fNb + '/totalCash'),
    ...['CRWV', 'IREN'].flatMap(s => { const f = walk(ctx, 'instrument_comprehensive_financial', s), st = walk(ctx, 'instrument_comprehensive_stats', s); if (f == null || st == null) throw Error('bilan absent ' + s); return [dep('context', f + '/totalDebt'), dep('context', f + '/totalCash'), dep('context', st + '/sharesOutstanding'), dep('comparison', barPtr(s))]; }),
    dep('primary', '/documents/0'), dep('primary', '/documents/5'), dep('primary', '/documents/6')];
  const rowIdx = BUILT.a.fundamentals.rows.findIndex(r => r.metric === 'Dette nette / capitalisation, bilan publié');
  if (rowIdx < 0) throw Error('ligne d’endettement absente');
  const method = 'Dette nette / capitalisation = (dette totale − trésorerie) / (clôture certifiée du 30 octobre × actions). Dette et trésorerie : bilan publié par le fournisseur de données (facette financials, relevé en instantané, vraisemblablement au 30 juin ; définition du fournisseur, identique pour les trois sociétés). Actions : Nebius, nombre de la fiche (actions A et B au 30 juin + bons Nvidia, 6-K du 12 août) ; CoreWeave et IREN, statistiques collectées. Postérieurs au bilan et non intégrés : convertibles d’août (6-K du 24 août) et ligne Citi (6-K du 22 octobre).';
  let n = 0;
  for (const k of Object.keys(calc.claim_provenance)) if (k.startsWith('fundamentals.rows.' + rowIdx + '.')) {
    calc.claim_provenance[k] = { ...dep('bars', calc.claim_provenance['header.price'].source_pointer), input_name: 'bars', method, additional_inputs: extra };
    calc.methods[k] = method; n++;
  }
  if (!n) throw Error('aucune revendication à réécrire');
  fs.writeFileSync(path.join(ROOT, CALC), JSON.stringify(calc, null, 2) + '\n');
  const ev = JSON.parse(fs.readFileSync(path.join(ROOT, EVID), 'utf8')), h = sha(CALC);
  if (ev.analysis_sha256 !== sha(OUT)) throw Error('empreinte du dossier inattendue');
  ev.claims.forEach(cl => { cl.source_sha256 = h; });
  fs.writeFileSync(path.join(ROOT, EVID), JSON.stringify(ev, null, 2) + '\n');
  console.log('[NBIS] provenance de la ligne d’endettement réécrite :', n, 'revendications');
}
