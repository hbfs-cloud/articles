'use strict';
// Dossier Oracle (ORCL) v3 au close du 2026-10-26, refonte complète du 27 octobre 2026 au gabarit FICO (R08).
// Remplace la fiche du 9 octobre (close du 8, statut surveiller, plan de couloir 131,58-146,94 $ jamais déclenché :
// aucune clôture au-dessus de 146,94 $ ; le plus bas du couloir a cédé le 14 octobre, séance de l'inflation américaine).
// Agrégats GAAP : douze mois glissants au 31 août 2026 lus dans les données XBRL officielles de la SEC (companyfacts,
// 10-Q du 11 septembre inclus, aucun 10-Q ni 10-K déposé depuis) = exercice clos le 31 mai 2026 − T1 de l'exercice
// 2026 + T1 de l'exercice 2027. Bilan au 31 août 2026.
// Dette = emprunts courants et non courants + locations-financement ; les locations simples sont exclues (leurs loyers
// sont déjà déduits de l'EBITDA). Trésorerie = liquidités + placements courants. Actions = 3 031 501 149 au 21 septembre
// (DEF 14A du 25 septembre). Liste EDGAR relevée le 27 octobre : aucun dépôt de financement depuis le 23 juin
// (424B5) ; seulement des formulaires 4 et 144 après la circulaire du 25 septembre.
// Clients cotés documentés : Meta, Nvidia et AMD, nommés par Oracle dans son communiqué du 1er février 2026 (plan de
// financement) ; aucun n'est nommé dans les dépôts SEC. Série collectée à part (comparison_client_bars).
const R = require('../../../../tools/lib/analysis-v3-r08.cjs');
const S = require('./static-orcl.cjs');
const GEN = 'analyses/ORCL/_runs/20261027/build-orcl.cjs';
const REF = '2026-10-26';
const SHARES = 3031501149;

let LAST = null, CTX = null;
const getPath = (o, p) => p.split('.').reduce((n, k) => n == null ? undefined : n[k], o);

R.build({
  ticker: 'ORCL', shortName: 'Oracle', cik: 1341439, generator: GEN, mode: 'breakout', peers: true, clientBars: true,
  extraInputs: [{ name: 'quote', path: 'analyses/ORCL/_data/instrument.json' }, { name: 'regime', path: 'analyses/ORCL/_data/market_regime.json' }],
  ref: REF, run: '20261027', asOf: '2026-10-27',
  xbrl: {
    ttm: {
      rev: ['RevenueFromContractWithCustomerExcludingAssessedTax'],
      ebit: ['OperatingIncomeLoss'],
      ni: ['NetIncomeLoss'],
      dep: ['Depreciation'],
      amort: ['AmortizationOfIntangibleAssets'],
      ocf: ['NetCashProvidedByUsedInOperatingActivities'],
      capex: ['PaymentsToAcquirePropertyPlantAndEquipment'],
    },
    instant: {
      borrowCur: ['NotesPayableCurrent'],
      borrowNon: ['LongTermNotesAndLoans'],
      leaseA: ['OperatingLeaseLiability'],
      leaseB: ['FinanceLeaseLiability'],
      cashEq: ['CashAndCashEquivalentsAtCarryingValue'],
      sti: ['AvailableForSaleSecuritiesDebtSecuritiesCurrent'],
      equity: ['StockholdersEquity'],
    },
    da: ['dep', 'amort'], debt: ['borrowCur', 'borrowNon', 'leaseB'], cash: ['cashEq', 'sti'],
  },
  scenarioBasis: 'revenue', scenarioMultiple: 4.24,
  valuationBasis: 'GAAP douze mois glissants au 31 août 2026 (données XBRL officielles de la SEC) : chiffre d’affaires = exercice clos le 31 mai 2026 − premier trimestre de l’exercice 2026 + premier trimestre de l’exercice 2027 ; dette financière = emprunts courants et non courants + passifs de locations-financement au 31 août, hors passifs de locations simples dont les loyers sont déjà déduits de l’EBITDA et hors 288 Md$ de loyers signés non encore au bilan ; trésorerie = liquidités + placements courants au 31 août ; 3 031 501 149 actions au 21 septembre (circulaire du 25 septembre). 4,24 fois le chiffre d’affaires = multiple d’IBM (statistiques collectées le 27 octobre, relevé instantané), arrondi : Oracle payé comme un groupe de logiciel et d’infrastructure sans pari sur le calcul pour l’IA, ce qui revient à supposer sa marge ramenée vers celle d’IBM ; c’est un plancher bas, pas un objectif.',
  shares: { value: SHARES, doc: 5 },
  levels: {
    trigger: { d: '2026-10-15', c: 2 },  // 135,08 — plus haut du 15 octobre, haut du rebond qui a suivi la séance de l'inflation
    stop: { d: '2026-10-16', c: 3 },     // 127,36 — plus bas du 16 octobre, bas de la base du 16 au 21 octobre
    abandon: { d: '2026-10-22', c: 3 },  // 122,76 — plus bas du 22 octobre, plus bas depuis le 29 juillet
    s1: { d: '2026-10-22', c: 3 }, s2: { d: '2026-07-28', c: 3 }, // 114,50 — plus bas sur un an
    r1: { d: '2026-10-13', c: 2 },       // 144,18 — plus haut du 13 octobre, veille de l'inflation
    r4: { d: '2026-10-06', c: 2 },       // 146,93 — plus haut du 6 octobre, haut du couloir d'octobre
    r2: { d: '2026-09-22', c: 2 },       // 153,60 — plus haut du 22 septembre, sommet du rebond de septembre
    r3: { d: '2026-09-11', c: 2 },       // 166,00 — plus haut du lendemain des résultats du 10 septembre
  },
  supports: ['s1', 's2'], resistances: ['r1', 'r4', 'r2'],
  targets: ({ lv }) => ({ tp1: lv('r2'), tp2: lv('r3'), range: null }),
  levelsMethod: 'Déclencheur = plus haut du 15 octobre, haut du rebond qui a suivi la séance de l’inflation du 14 ; stop = plus bas du 16 octobre ; seuil d’abandon = plus bas du 22 octobre ; TP1 = plus haut du 22 septembre ; TP2 = plus haut du 11 septembre, lendemain des résultats ; plafond d’achat = (TP1 + 1,5 × stop) / 2,5 arrondi au cent inférieur ; pourcentages depuis l’entrée ; R/R = gain / risque.',
  inventory: 29,
  reviewScope: 'Dépôts EDGAR d’Oracle Corporation (CIK 1341439) du 1er février au 26 octobre 2026 : 29 formulaires hors déclarations d’initiés et avis de vente 144 (le 10-K de l’exercice 2026, deux 10-Q, huit 8-K, cinq suppléments 424B5, deux 424B2, trois prospectus libres, l’amendement d’étagère POSASR, la circulaire et son avis, le formulaire SD, le 11-K, une déclaration 13G et les pièces d’inscription des actions préférentielles). Onze pièces décisionnelles ouvertes et hachées : le communiqué et le 10-Q du premier trimestre de l’exercice 2027, le 10-K, le communiqué des résultats annuels du 10 juin (plan de financement de l’exercice 2027), le prospectus libre du 2 février (plan de l’année civile 2026), le 8-K du 4 février (programme d’actions et obligations), le supplément définitif des actions préférentielles convertibles, la circulaire du 25 septembre, le 8-K du 14 septembre sur le plan de cession de Larry Ellison, le supplément du 23 juin et le formulaire 4 du 1er octobre. Aucun dépôt de financement (424B2, 424B5, S-3, prospectus libre) après le 23 juin.',
  docs: S.docs,
  needles: S.needles,
  route: (p, { prov, dep, B, N, lvPtr, TXP }) => {
    if (p.startsWith('options.')) {
      const q = require('../../../../tools/lib/analysis-v3-kit.cjs').read('analyses/ORCL/_data/instrument.json');
      const i = q.data.items.findIndex(x => x.type === 'instrument_options_volume_ratio');
      return prov('quote', '/data/items/' + i, 'Volume d’options de la séance du 26 octobre (calls, puts, ratio) relevé dans l’instantané de l’instrument ; chaîne d’options relevée avant l’ouverture sans cotations, non utilisée.');
    }
    if (p.startsWith('shortInterest.')) {
      const q = require('../../../../tools/lib/analysis-v3-kit.cjs').read('analyses/ORCL/_data/instrument.json');
      const i = q.data.items.findIndex(x => x.type === 'instrument_short_interest');
      return prov('quote', '/data/items/' + i, 'Positions vendeuses au règlement FINRA du 15 octobre et jours de couverture FINRA ; part du flottant = positions / flottant publié par le fournisseur ; instantané statistique du fournisseur en complément. La série FINRA de l’année, source de contexte non certifiée, n’est citée que qualitativement.', [dep('fund', '')]);
    }
    if (p === 'macro.impact') return prov('regime', '/facets/regime/probabilities', 'Probabilités de régime de marché collectées le 27 octobre (risk-on, neutre) ; mouvements sur barres certifiées ; dates macro des registres du dépôt.', [dep('bars', B), dep('comparison', '')]);
    const srm = p.match(/^(business|risks)\.sourceRefs\.(\d+)\./);
    if (srm) { const x = getPath(LAST, srm[1] + '.sourceRefs.' + srm[2]); if (x && /thenextweb|investor\.oracle|gurufocus|finance\.yahoo/.test(x.url)) return prov('bars', B + '/' + N + '/0', 'Référence de presse ou de relations investisseurs datée, citée pour des faits narratifs (note de crédit, part d’OpenAI, perspective de Moody’s, prime de défaut, actions nanties) ; aucune valeur de marché n’en dépend.'); }
    if (p.startsWith('insiders.')) return prov('insiders', TXP == null ? '' : TXP + '/transactions', 'Formulaires 4 relevés sur 365 jours (couverture officielle incomplète, aucun solde net affirmé) ; achat de l’administrateur lu dans le formulaire 4 ouvert et haché ; 13F du 30 juin 2026 des dix-huit fonds suivis.', [dep('primary', '/documents/8'), dep('insiders', '/results/2/data/0/holdings')]);
    if (p.startsWith('archiveHistory.')) return prov('bars', B, 'Dates et notes des versions archivées de la fiche (analyses/ORCL/archive/), non une observation de marché.');
    if (p.startsWith('tribunal.')) return prov('bars', B, 'Tribunal de la fiche : chaque chiffre plaidé est repris de la section qui le prouve (barres certifiées, dépôts SEC, agrégats GAAP, multiples collectés).', [dep('primary', '/documents/0'), dep('primary', '/documents/1')]);
    if (p.startsWith('bottomEstimation.')) return prov('bars', B, 'Planchers techniques lus sur les barres certifiées (plus bas du 22 octobre et du 28 juillet) ; plancher de valeur = EV/revenus d’IBM (statistiques collectées) × chiffre d’affaires GAAP douze mois − dette financière + trésorerie, divisé par le nombre d’actions de la circulaire.', [dep('bars', lvPtr('s1')), dep('bars', lvPtr('s2')), dep('primary', '/documents/1')]);
    if (p.startsWith('timeline.')) return prov('bars', B + '/' + 0, 'Dates de l’échéancier : communiqué d’Oracle du 23 octobre (journée investisseurs), calendrier de résultats des comparables collecté, registres macro du dépôt ; horizon du plan calculé depuis la clôture de référence.', [dep('earn', '/events')]);
    const v = getPath(LAST, p); if (typeof v !== 'string') return null;
    if (/^news\.[0-4]\./.test(p)) return prov('bars', B, 'Variations de clôture à clôture lues sur les barres certifiées et comparées aux pairs sur la même séance ; cause attribuée à la presse financière ou au communiqué cité, pas déduite des cours.', [dep('comparison', '')]);
    return null;
  },
  sectionDocs: { verdict: [0, 1, 9, 10, 3, 5, 8], business: [0, 1, 2, 10, 9], news: [0], earnings: [0, 1, 9], capitalStructure: [1, 3, 4, 5, 7, 9, 10, 2], filingsReview: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], risks: [1, 2, 9, 10, 3, 5], globalScore: [0, 9, 8], meta: [0, 9], disclaimer: [0], macro: [1], options: [0], social: [0], header: [5], technicals: [0], performance: [0], tradeIdea: [0, 1, 9], blastRadius: [0, 10], bottomEstimation: [1, 2] },
  score: { business: 22, technical: -12, capital: -10, calendar: -4, dilution: -6, risk: 50 },
  riskScoreReason: 'Jugement qualitatif sur dix : une croissance réelle mais financée de l’extérieur (capex de 75,7 Md$ sur douze mois contre 46,9 Md$ de flux opérationnel, dont des prépaiements de clients), un plan de financement de 45 à 50 Md$ annoncé le 1er février désormais consommé, 288 Md$ de loyers signés hors bilan, une note de crédit à un cran de la catégorie spéculative et des primes de défaut au plus haut selon la presse ; une dépendance non chiffrée à OpenAI ; un titre 56 % sous son plus haut sur un an, sous ses trois moyennes, qui a perdu 8,8 % en une séance sur un chiffre d’inflation. Atténué par un carnet de commandes contractuel de 664 Md$ et un logiciel historique rentable.',
  compose: c => { CTX = c; return require('./compose-orcl.cjs')(c, x => { LAST = x; return x; }); },
  groups: S.groups,
  eventDefault: { leader: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', direct_peer: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', upstream: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', downstream: 'Résultats publiés le 21 octobre, hors fenêtre ; le capex de Meta est déjà connu', second_order: 'Aucune publication datée dans la fenêtre collectée de quatorze jours', sector_proxy: 'Panier sans publication propre ; exposé aux résultats de ses grandes pondérations cette semaine' },
  eventRisk: { CRWV: 'Aucune publication dans la fenêtre collectée de quatorze jours ; résultats attendus à la mi-novembre, date non vérifiée ici', NBIS: 'Aucune publication dans la fenêtre collectée de quatorze jours ; résultats attendus à la mi-novembre, date non vérifiée ici', NVDA: 'Aucune publication dans la fenêtre collectée de quatorze jours ; résultats attendus à la mi-novembre, la lecture la plus forte de la demande de puces', MSFT: 'Résultats annoncés le 28 octobre, heure non confirmée, habituellement après la clôture (une seule source) : capex et demande d’OpenAI vus par son premier partenaire', GOOGL: 'Résultats annoncés le 28 octobre, heure non confirmée, habituellement après la clôture (une seule source) : capex de Google Cloud', AMZN: 'Résultats annoncés le 29 octobre, heure non confirmée, habituellement après la clôture (une seule source) : croissance d’AWS et capex', NOW: 'Résultats annoncés le 28 octobre (une seule source) ; lecture sur les logiciels à abonnement', VRT: 'Résultats annoncés le 28 octobre (une seule source) ; commandes d’équipements de centres de données', GEV: 'Résultats annoncés le 28 octobre (une seule source) ; carnet de turbines', AMD: 'Résultats annoncés le 3 novembre (une seule source) : client et fournisseur d’Oracle', ANET: 'Résultats annoncés le 3 novembre (une seule source) ; commandes de réseau des grappes IA', TLN: 'Résultats annoncés le 3 novembre (une seule source) ; contrats d’électricité des centres de données', CEG: 'Résultats annoncés le 9 novembre (une seule source) ; prix de l’électricité des centres de données' },
  blastDoc: 1,
  scenarios: c => require('./compose-orcl.cjs').scenarios(c),
  contradictions: c => require('./compose-orcl.cjs').contradictions(c),
  missingData: c => require('./compose-orcl.cjs').missingData(c),
  limitations: ['Agrégats GAAP au 31 août 2026 ; le deuxième trimestre de l’exercice, clos le 30 novembre, n’est pas encore publié.', 'Multiples des pairs issus des statistiques courantes, relevées en instantané, sans historique daté ; celui de SAP, incohérent (devises mêlées), n’est pas utilisé.', 'Primes de défaut, note de TD Cowen, financement des puces avec Apollo et Goldman Sachs et liens bancaires sur les actions de Larry Ellison connus par la presse financière citée, pas par un dépôt de la société.', 'Chaîne d’options relevée avant l’ouverture du 27 octobre, sans cotations : aucune volatilité implicite publiée.', 'Note BBB- de S&P (9 juillet 2026), part d’OpenAI d’environ la moitié des 638 Md$ de carnet au 31 mai, déficit de flux libre d’environ 42 Md$ prévu par S&P et perspective négative de Moody’s : The Next Web, 16 juillet 2026.', 'Capex net d’environ 70 Md$ pour l’exercice 2027 annoncé par la directrice financière lors de la conférence du 10 juin : presse (Yahoo Finance, 11 juin 2026), non repris dans un dépôt.', 'Formatage des nombres du moteur de rendu (point décimal dans certains tableaux, chaîne R/R) : défaut commun du gabarit, non propre à cette fiche.'],
});

// Taille publiée calculée au pire cas (écart d'ouverture appliqué à une clôture juste au-dessus du stop) : l'exemple de
// taille du gabarit commun (budget de 100 $ au plafond) est remplacé dans l'artefact de calcul par celui de la fiche,
// avec le détail de la dérivation ; le hachage de l'artefact est reporté dans le sidecar de preuves.
(function () {
  const K = require('../../../../tools/lib/analysis-v3-kit.cjs');
  const calcPath = 'analyses/ORCL/_runs/20261027/revision/numeric-evidence.json', evPath = 'data/analyses-evidence/ORCL.json';
  const sz = CTX && CTX.__sizing; if (!sz) throw Error('taille non calculée');
  const calc = K.read(calcPath);
  calc.levels.sizeExample = sz.shares;
  calc.levels.sizing = sz;
  K.write(calcPath, calc);
  const h = K.sha(K.bytes(calcPath)), ev = K.read(evPath);
  ev.claims.forEach(x => { if (x.source_artifact === calcPath) x.source_sha256 = h; });
  K.write(evPath, ev);
  console.log('[ORCL] taille ' + sz.shares + ' actions (budget ' + sz.budget + ' $), calcul ' + h.slice(0, 12));
})();
