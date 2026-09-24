'use strict';
// Dossier INTC v3 au close du 2026-09-23 (lot R05). Contenu éditorial et niveaux propres au titre ;
// calculs, provenance et preuves délégués au gabarit commun tools/lib/analysis-v3-r04.cjs (inchangé).
// Historique conservé : les trois transitions de cycle de vie de la version précédente (dont la dernière,
// tp1-hit → stopped, non commitée au moment de la refonte) sont recopiées telles quelles, puis la refonte
// ajoute sa propre transition. La dernière transition archivée est datée du 31 août, avant l'activation du
// 4 septembre qu'elle suit dans l'historique : l'incohérence est expliquée dans la note de statut, pas corrigée.
const R = require('../../../../tools/lib/analysis-v3-r04.cjs');
const GEN = 'analyses/INTC/_runs/20260924/build-intc.cjs';
// Base du bilan : 5 044 millions d'actions au 17 juillet (10-Q), cohérente avec le bilan du 27 juin.
// Émission d'août (424B5) : 210 526 315 actions à 95 $, produit avant frais de 93,4325 $ par action, et option
// de 31 578 947 actions supposée exercée en totalité (hypothèse prudente, exercice non confirmé dans les dépôts
// ouverts) : base pro forma de 5 286,1 millions d'actions, produit ajouté aux liquidités.
const COVER = 5044e6, OFFER = 210526315, OPTION = 31578947, NET_PS = 93.4325;
const SH_PF = COVER + OFFER + OPTION, PROCEEDS = (OFFER + OPTION) * NET_PS;

R.build({
  ticker: 'INTC', shortName: 'Intel', cik: 50863, generator: GEN, mode: 'pullback',
  xbrl: { ttm: { rev: ['RevenueFromContractWithCustomerExcludingAssessedTax'], ebit: ['OperatingIncomeLoss'], ni: ['NetIncomeLoss'], dep: ['Depreciation'], amort: ['AmortizationOfIntangibleAssets'], ocf: ['NetCashProvidedByUsedInOperatingActivities'], capex: ['PaymentsToAcquirePropertyPlantAndEquipment'] },
    instant: { ltd: ['LongTermDebtNoncurrent'], std: ['DebtCurrent'], cashEq: ['CashAndCashEquivalentsAtCarryingValue'], sti: ['AvailableForSaleSecuritiesDebtSecuritiesCurrent'] }, da: ['dep', 'amort'], debt: ['ltd', 'std'], cash: ['cashEq', 'sti'] },
  scenarioBasis: 'ebitda', scenarioMultiple: 30,
  valuationBasis: 'GAAP douze mois au 2026-06-27 (XBRL SEC) ; EBITDA = résultat opérationnel + amortissements des immobilisations et des actifs incorporels ; perte sur la réévaluation des actions en séquestre, hors résultat opérationnel donc hors EBITDA ; dette = emprunts à court et long terme au 27 juin ; trésorerie = liquidités et titres de créance à court terme du 27 juin ; 5 044 millions d’actions au 17 juillet, avant l’émission d’août, traitée à part en pro forma ; multiple de trente fois l’EBITDA = hypothèse éditoriale',
  shares: { value: COVER, doc: 0 },
  levels: { trigger: { d: '2026-09-21', c: 3 }, stop: { d: '2026-09-18', c: 3 }, s1: { d: '2026-09-23', c: 3 }, r1: { d: '2026-09-21', c: 2 }, r2: { d: '2026-07-02', c: 2 }, r3: { d: '2026-06-30', c: 2 } },
  supports: ['s1', 'trigger', 'stop'], resistances: ['r1', 'r2', 'r3'],
  targets: ({ lv }) => ({ tp1: lv('r2'), tp2: lv('r3') }),
  levelsMethod: 'Entrée = plus bas du 21 septembre, haut du gap non comblé ; stop = plus bas du 18 septembre, sous le gap ; TP1 = plus haut du 2 juillet ; TP2 = plus haut du 30 juin, sommet de l’année ; plafond d’ouverture = (TP1 + 1,5 × stop) / 2,5 arrondi au cent inférieur ; pourcentages depuis l’entrée ; R/R = gain / risque.',
  inventory: 50,
  reviewScope: 'Dépôts EDGAR d’Intel du 1er août 2025 au 23 septembre 2026 (50 formulaires hors formulaires 3, 4, 5 et 144), dont le 10-K de l’exercice clos le 27 décembre 2025. Les 8-K de gouvernance (items 5.02, 5.07), la procuration et ses compléments, les formulaires N-PX, SD et 11-K, les avis relatifs à l’Iran et les S-8 des plans salariés sont écartés comme non décisionnels ; le S-3ASR et les deux 424B5 d’août sont repris par le prospectus définitif du 12 août ; les émissions et accords de 2025 sont couverts par le 10-K ; les 424B5 et le 8-K d’avril portent sur de la dette.',
  docs: [
    ['2026-07-24', '10-Q', '0000050863-26-000157', 'intc-20260627.htm', 'q2-10q__intc-20260627.htm',
      'Rapport trimestriel au 27 juin 2026 : 5 044 millions d’actions au 17 juillet ; perte de 12,5 Md$ au trimestre et 13,6 Md$ sur six mois sur la réévaluation des actions placées en séquestre pour le Département du Commerce, dont 71 millions restent conditionnelles ; résultat hors exploitation de −12,6 Md$ au trimestre.'],
    ['2026-07-23', '8-K / Exhibit 99.1', '0000050863-26-000155', 'q226earningsrelease.htm', 'q2-8k__q226earningsrelease.htm',
      'Communiqué du deuxième trimestre, daté du 23 juillet : revenus de 16,1 Md$ (+25 %), marge brute GAAP de 40,4 %, marge opérationnelle GAAP de 11,1 %, perte nette de 11,0 Md$ ; centres de données et IA à 6,3 Md$ (+59 %), fonderie à 5,8 Md$ (+31 %). Prévision : 15,8 à 16,8 Md$ au troisième trimestre, marge brute GAAP de 41,0 %, bénéfice GAAP de 0,31 $ par action.'],
    ['2026-08-12', '424B5', '0001193125-26-345221', 'd98483d424b5.htm', 'aug12-424b5__d98483d424b5.htm',
      'Prospectus définitif : 210 526 315 actions offertes à 95,00 $, produit net des commissions des banques de 93,4325 $ par action, soit 19,67 Md$ ; option des banques sur 31 578 947 actions supplémentaires pendant trente jours.'],
    ['2026-08-12', '8-K / Exhibit 99.2', '0001193125-26-346806', 'd117670dex992.htm', 'aug12-8k__d117670dex992.htm',
      'Communiqué de fixation du prix du 10 août : l’émission est portée de 15 à 20 Md$ ; produit net d’environ 19,7 Md$ hors option, affecté aux besoins généraux, dont les investissements et le fonds de roulement.'],
    ['2026-01-23', '10-K', '0000050863-26-000011', 'intc-20251227.htm', 'fy25-10k__intc-20251227.htm',
      'Rapport annuel de l’exercice clos le 27 décembre 2025 : trois clients non nommés à 19 %, 12 % et 12 % du chiffre d’affaires 2025, soit 43 % ; créances de ces trois clients à 47 % du total.'],
    ['2025-12-29', '8-K', '0000050863-25-000204', 'intc-20251226.htm', 'dec26-8k__intc-20251226.htm',
      'Placement privé clos le 26 décembre 2025 : NVIDIA achète 214 776 632 actions nouvelles d’Intel à 23,28 $, soit 5,0 Md$ en numéraire, en exécution de l’accord du 15 septembre 2025. Émission d’actions sans offre au public.'],
  ],
  needles: {
    q2q: [0, ['As of July 17, 2026, the registrant had outstanding 5,044 million shares of common stock', 'we recognized $ 12.5 billion and $ 13.6 billion, respectively, of losses related to the net change in fair value of both Escrowed Shares released and Escrowed Shares still held in escrow', 'Of the 143 million Escrowed Shares not yet released as of June 27, 2026, 71 million are considered not contingently issuable', 'Interest and other, net ( 12,576 )']],
    q2: [1, ['Second-quarter revenue was $16.1 billion, up 25% year-over-year', 'Gross margin 40.4% 27.5%', 'Operating margin (loss) 11.1% (24.7)%', 'Net income (loss) attributable to Intel ($B) $(11.0)', 'Data Center and AI (DCAI) 6.3 billion up 59%', 'Intel Foundry 5.8 billion up 31%', 'Q3 2026 GAAP Non-GAAP Revenue $15.8-16.8 billion Gross margin 41.0%', 'expecting third-quarter EPS attributable to Intel of $0.31', 'the company generated $7.0 billion in cash from operations']],
    offer: [2, ['We are offering 210,526,315 shares of our common stock', 'Public offering price $ 95.00', 'Proceeds, before expenses, to Intel Corporation $ 93.4325 $ 19,669,999,926', 'up to an additional 31,578,947 shares of our common stock']],
    pricing: [3, ['The offering was upsized to $20 billion from the previously announced offering size of $15 billion', 'The net proceeds from the offering will be approximately $19.7 billion']],
    annual: [4, ['Customer A 19 % 19 % 19 % Customer B 12 % 14 % 11 % Customer C 12 % 12 % 10 %', 'our three largest customers accounted for 43% of our net revenue in 2025']],
    nvda: [5, ['completed the issuance and sale of 214,776,632 shares', 'for an aggregate purchase price in cash of $5.0 billion, representing a price per share of $23.28 per share']],
  },
  sectionDocs: { verdict: [1, 2], business: [1, 0, 4], news: [1, 2], earnings: [1], capitalStructure: [0, 2, 3, 5], filingsReview: [0, 1, 2, 3, 4, 5], risks: [0, 2, 1], globalScore: [1], meta: [1], disclaimer: [1], macro: [0], options: [1], social: [1], header: [0, 2] },
  score: { business: 20, technical: 4, capital: -2, calendar: -2, dilution: -3, risk: 22 },
  peers: true,
  peerFicheSha: { AMD: 'bdc658319f2088abbd42cff9bd958ff6ec64ebccca2f83ade4c2e2d72df73bfe', NVDA: 'f3c08096c473be6eacb47ebd022f0711b327aff4a3d219d285bd6933799e50d0', MU: '269e628b3cb2990b007d3e443eb4e83e4bcc598a3f8db2157b4c75b5e3ebfb45' },
  route: (p, { prov, dep, B, marketMath }) => {
    if (/^news\.[01]\./.test(p)) return prov('bars', B, 'Ouverture et clôture lues sur les barres certifiées ; écart d’ouverture = ouverture / clôture de la veille − 1 ; comparaison avec AMD et SMH sur la même séance.', [dep('comparison', '')]);
    if (p === 'header.metrics.marketCap' || p === 'header.metrics.evEbitda') { const m = marketMath(); return { ...m, method: 'Base pro forma après l’émission d’août : close × (5 044 millions d’actions au 17 juillet + 210 526 315 actions émises + 31 578 947 actions de l’option, supposée exercée) ; EV pro forma = capitalisation + dette − (liquidités du 27 juin + produit net des commissions de 93,4325 $ par action).', additional_inputs: [...(m.additional_inputs || []), dep('primary', '/documents/2')] }; }
    return null;
  },
  riskScoreReason: 'Jugement qualitatif sur dix : titre à +33 % en quatre semaines et 16 % au-dessus de sa moyenne à vingt séances, émission de 20 Md$ en août, perte GAAP due au séquestre, écarts d’ouverture fréquents de plus de 5 %.',
  compose: c => {
    const { fr, usd, pct, sgn, close, prev, bars, N, tech, st, M, adv, ret, G$, marketCap, ev, scn, entry, stop, tp1, tp2, cap, rr1, rr2, riskAtr, sizeExample, ref, market, docs, raw, peerStat, peerFiche, lv, archive } = c;
    const cmp = raw.comparison_bars.data.items[0].results[0].data;
    const dr = (sym, d) => { const b = cmp.find(x => x.symbol === sym).bars, i = b.findIndex(x => x[0] === d); return pct(b[i][4], b[i - 1][4]); };
    const bar = d => bars.find(b => b[0] === d), prevOf = d => bars[bars.findIndex(b => b[0] === d) - 1];
    const d0921 = bar('2026-09-21'), p0921 = prevOf('2026-09-21'), d0914 = bar('2026-09-14'), p0914 = prevOf('2026-09-14');
    const d0827 = bar('2026-08-27'), d0828 = bar('2026-08-28'), d0831 = bar('2026-08-31'), d0904 = bar('2026-09-04'), d0908 = bar('2026-09-08'), d0917 = bar('2026-09-17');
    const t0 = archive.tradeIdea, runPct = pct(close, d0827[4]);
    const mcapPf = close * SH_PF, evPf = mcapPf + G$.debt - (G$.cash + PROCEEDS), evEb = ev / G$.ebitda, evEbPf = evPf / G$.ebitda, evRevPf = evPf / G$.rev;
    const dil = (OFFER + OPTION) / COVER * 100;
    const amdEb = peerFiche('AMD', 'EV/EBITDA GAAP').value, nvdaEb = peerFiche('NVDA', 'EV/EBITDA GAAP').value, muEb = peerFiche('MU', 'EV/EBITDA GAAP').value;
    const qcomEb = peerStat('QCOM'), gfsEb = peerStat('GFS');
    const ext20 = pct(close, tech.ema20), rrNow = (tp1 - close) / (close - stop);
    // Écarts d'ouverture en pourcentage sur 250 séances : au-dessus du plafond relatif, et sous le stop relatif.
    const upPct = (cap / entry - 1) * 100, dnPct = (1 - stop / entry) * 100;
    let up = 0, dn = 0; for (let i = N - 249; i <= N; i++) { const g = pct(bars[i][1], bars[i - 1][4]); if (g > upPct) up++; if (g < -dnPct) dn++; }
    const bufAtr = (cap - entry) / tech.atr14;
    return {
      meta: { lang: 'fr', dir: 'ltr', level: 'intermediate', tags: ['us', 'equities', 'ai-chain', 'semis', 'technology'], grade: 'C', date: '2026-09-24', dateDisplay: '24 septembre 2026', version: 3, status: 'watch', assetType: 'stock', levelsCloseDate: c.REF,
        description: 'Intel : revenus +25 %, centres de données +59 %, 20 Md$ levés en août et un titre à +33 % en quatre semaines. Dossier au close du 23 septembre 2026, statut surveiller, entrée sur repli seulement.',
        ogDescription: 'INTC : titre à 122,60 $, +33 % depuis le 27 août ; 20 Md$ d’actions émises à 95 $ ; aucun achat au cours actuel, entrée sur repli vers le haut du gap.',
        lastMcpRefresh: raw.status.captured_at, levelsVerifiedAt: raw.status.captured_at,
        statusHistory: [...archive.meta.statusHistory, { at: raw.status.captured_at, from: 'stopped', to: 'watch', note: 'refonte v3 du 24 septembre : nouveau scénario, clôture de référence du 2026-09-23 ; l’entrée précédente « stop après TP1 le 2026-08-31 », datée avant l’activation du 2026-09-04 qu’elle suit, est un artefact de l’outil de suivi, conservé sans modification', close }],
        lastEvent: archive.meta.lastEvent },
      header: { ticker: 'INTC', name: 'Intel Corporation', exchange: 'NASDAQ', sector: 'Processeurs, centres de données et fonderie', price: close, changePct: pct(close, prev),
        badges: [{ text: 'SURVEILLER — AUCUN ACHAT AU COURS ACTUEL, ENTRÉE SUR REPLI', color: 'blue' }, { text: 'Chaîne IA — processeurs et fonderie', color: 'purple' }],
        metrics: { marketCap: fr(mcapPf / 1e9, 0) + ' Md$', volume: fr(bars[N][5] / 1e6, 1) + ' M', evEbitda: fr(evEbPf, 1) + '×' }, halalStatus: 'unknown' },
      verdict: { score: 39, conviction: 'Low', bias: 'Neutral',
        confidence: 'Score éditorial non prédictif. Les chiffres d’entreprise viennent des dépôts SEC et des données XBRL officielles ; les niveaux, du close certifié du 23 septembre.',
        summary: 'Intel a publié le 23 juillet des revenus de 16,1 Md$ (+25 %), avec les centres de données et l’IA à 6,3 Md$ (+59 %). Puis il a levé 20 Md$ en actions à 95 $ le 10 août, au lieu des 15 Md$ annoncés. Le titre clôture le 23 septembre à ' + usd(close) + ' : +' + fr(runPct, 1) + ' % depuis le 27 août, ' + fr(ext20, 1) + ' % au-dessus de sa moyenne à vingt séances. Au cours actuel, avec un stop sous le gap du 21 septembre, le gain vers ' + usd(tp1) + ' ne paie que ' + fr(rrNow, 2) + ' fois le risque : pas d’achat. La perte GAAP de 11,3 Md$ sur douze mois vient d’une réévaluation des actions placées en séquestre pour l’État, pas de l’exploitation. Base pro forma, le titre vaut ' + fr(evEbPf, 1) + ' fois l’EBITDA GAAP, entre Nvidia (' + nvdaEb + ') et AMD (' + amdEb + '). Signal utile : un repli clôturant entre ' + usd(stop) + ' et ' + usd(entry) + '.',
        whyBuy: [
          'Revenus du deuxième trimestre de 16,1 Md$ (+25 %), meilleure croissance depuis plus de quinze ans selon la société.',
          'Centres de données et IA à 6,3 Md$ (+59 %) ; fonderie à 5,8 Md$ (+31 %).',
          'Marge brute GAAP de 40,4 %, contre 27,5 % un an plus tôt, et prévision de 41,0 % au troisième trimestre.',
          '7,0 Md$ de flux opérationnel au trimestre, et 22,6 Md$ de produit net des commissions de l’émission (23,0 Md$ bruts à 95 $) pour financer les usines.'],
        whyAvoid: [
          'Le titre a pris +' + fr(runPct, 1) + ' % en quatre semaines : au cours actuel, le R/R vers le premier objectif vaut ' + fr(rrNow, 2) + '.',
          '242,1 millions d’actions émises en août avec l’option, environ ' + fr(dil, 1) + ' % de plus, après 214,8 millions vendues à NVIDIA en décembre.',
          'Perte nette GAAP de ' + fr(Math.abs(G$.ni) / 1e9, 1) + ' Md$ sur douze mois ; 71 millions d’actions en séquestre restent conditionnelles.',
          'Trois clients non nommés font 43 % du chiffre d’affaires.'],
        controlChecklist: [
          { label: 'Historique de cours', status: 'pass', statusLabel: 'Trois cents séances continues', evidence: 'Série quotidienne certifiée au close du 23 septembre, source de repli documentée.', action: 'Niveaux et indicateurs recalculés sur cette seule série.' },
          { label: 'Calendrier', status: 'warn', statusLabel: 'Micron le 30 septembre, Intel vers le 22 octobre', evidence: 'Micron publie le 30 septembre après la clôture selon deux calendriers concordants ; la date du 22 octobre pour Intel ne vient que d’un calendrier et n’est pas confirmée par l’émetteur.', action: 'Pas de position ouverte à l’approche du 22 octobre sans date confirmée.' },
          { label: 'Capital', status: 'fail', statusLabel: 'Émission de 20 Md$', evidence: '210,5 millions d’actions émises à 95 $ en août, plus une option de 31,6 millions.', action: 'Raisonner sur 5 286,1 millions d’actions, pas sur 5 044 millions.' }] },
      business: { theme: 'Processeurs pour ordinateurs et serveurs, fonderie pour tiers, conditionnement avancé',
        overview: '<p>Intel conçoit les processeurs des ordinateurs et des serveurs et fabrique des puces, les siennes et celles de clients tiers, dans sa fonderie. Au deuxième trimestre 2026, les revenus ont atteint 16,1 Md$ (+25 %) : 8,9 Md$ pour les ordinateurs et l’IA embarquée, 6,3 Md$ pour les centres de données et l’IA (+59 %), 5,8 Md$ pour la fonderie (+31 %), en grande partie facturés aux produits Intel eux-mêmes.</p><p>La marge brute GAAP est remontée à 40,4 %, contre 27,5 % un an plus tôt, et la marge opérationnelle à 11,1 %. La perte nette de 11,0 Md$ du trimestre vient d’ailleurs : la réévaluation des actions placées en séquestre au profit du Département du Commerce, dans le cadre de l’accord sur les usines sécurisées, a coûté 12,5 Md$ hors exploitation.</p><p>Pour financer ses usines, Intel a vendu 214,8 millions d’actions à NVIDIA à 23,28 $ en décembre 2025, puis 210,5 millions au public à 95 $ en août 2026. La prévision du troisième trimestre vise 15,8 à 16,8 Md$ de revenus.</p>',
        moat: 'L’avantage tient à la base installée des processeurs x86 et à une fonderie américaine soutenue par l’État. Il s’use face à AMD dans les serveurs et à Arm dans les ordinateurs ; la fonderie reste à prouver auprès de clients tiers en volume.',
        segments: [
          { name: 'Ordinateurs et IA embarquée', revenue: '8,9 Md$ au deuxième trimestre', pct: 'Principal segment de produits', description: 'Processeurs pour ordinateurs portables, de bureau et applications embarquées ; +13 %.' },
          { name: 'Centres de données et IA', revenue: '6,3 Md$ au deuxième trimestre', pct: '+59 % sur un an', description: 'Processeurs Xeon et solutions pour les serveurs d’IA.' },
          { name: 'Fonderie', revenue: '5,8 Md$ au deuxième trimestre', pct: '+31 % sur un an', description: 'Fabrication et conditionnement, surtout pour les produits Intel, éliminés en consolidation.' }],
        sourceRefs: [ref(1), ref(0), ref(4)],
        coverageMatrix: [
          { facet: 'Cours et historique', status: 'COUVERT', decision: 'Trois cents séances continues, close certifié ; base des niveaux et des indicateurs.' },
          { facet: 'Résultats et guidance', status: 'COUVERT — PRIMAIRE', decision: 'Communiqué du 23 juillet et 10-Q ; date du troisième trimestre non confirmée par l’émetteur.' },
          { facet: 'Capital et dette', status: 'COUVERT — PRIMAIRE', decision: 'Émission d’août et placement auprès de NVIDIA lus dans les dépôts ; séquestre de l’État séparé.' },
          { facet: 'Agrégats GAAP', status: 'COUVERT — XBRL', decision: 'Douze mois glissants au 27 juin 2026, reconstitués depuis les données XBRL officielles.' },
          { facet: 'Comparables et transmission', status: 'COUVERT — LOCAL', decision: 'Corrélations recalculées sur barres certifiées depuis la fin mars.' },
          { facet: 'Initiés', status: 'PARTIEL', decision: 'Aucune transaction relevée dans la collecte ; couverture officielle incomplète.' },
          { facet: 'Options', status: 'NON EXPLOITABLE', decision: 'Chaîne relevée en séance le 24 septembre, non rattachée à la clôture de référence.' }] },
      news: [
        { date: '2026-09-21', title: 'Gap de ' + sgn(pct(d0921[1], p0921[4]), 1) + ', clôture à ' + sgn(pct(d0921[4], p0921[4]), 1), impact: 'positive', detail: 'Le titre ouvre à ' + usd(d0921[1]) + ' contre ' + usd(p0921[4]) + ' la veille, touche ' + usd(d0921[2]) + ' et clôture à ' + usd(d0921[4]) + '. AMD fait ' + sgn(dr('AMD', '2026-09-21'), 2) + ' et SMH ' + sgn(dr('SMH', '2026-09-21'), 2) + ' la même séance : les processeurs montent ensemble, Intel plus fort ; aucun dépôt ouvert ici n’en donne la cause. Le gap entre ' + usd(bar('2026-09-18')[2]) + ' et ' + usd(d0921[3]) + ' n’est pas comblé.', source: 'Barres certifiées', sourceUrl: c.evidenceUrl },
        { date: '2026-09-14', title: 'Gap de ' + fr(pct(d0914[1], p0914[4]), 1) + ' % à l’ouverture', impact: 'negative', detail: 'Ouverture à ' + usd(d0914[1]) + ' (' + sgn(pct(d0914[1], p0914[4]), 2) + '), clôture à ' + usd(d0914[4]) + ' (' + sgn(pct(d0914[4], p0914[4]), 2) + '). AMD fait ' + sgn(dr('AMD', '2026-09-14'), 2) + ' et SMH ' + sgn(dr('SMH', '2026-09-14'), 2) + ' : le repli est propre à Intel. Un stop placé la veille à 5 % sous le cours aurait été exécuté à l’ouverture, plus bas que prévu.', source: 'Barres certifiées', sourceUrl: c.evidenceUrl },
        { date: '2026-08-10', title: 'Émission portée à 20 Md$ à 95 $', impact: 'negative', detail: '210 526 315 actions à 95,00 $, option de 31 578 947 actions en plus ; l’émission annoncée à 15 Md$ est relevée le jour même. Le titre clôturait à 97,52 $ ce jour-là.', source: 'Intel — SEC', sourceUrl: docs[3].url }],
      fundamentals: { rows: [
          { metric: 'Revenus du deuxième trimestre', value: '16,1 Md$', signal: '+25 % sur un an, communiqué du 23 juillet', signalColor: 'green', _src: 1 },
          { metric: 'Centres de données et IA du deuxième trimestre', value: '6,3 Md$', signal: '+59 % sur un an', signalColor: 'green', _src: 1 },
          { metric: 'Fonderie du deuxième trimestre', value: '5,8 Md$', signal: '+31 % sur un an, surtout des ventes internes aux produits Intel', signalColor: 'amber', _src: 1 },
          { metric: 'Prévision du troisième trimestre', value: '15,8 à 16,8 Md$', signal: 'Marge brute GAAP de 41,0 %, bénéfice GAAP de 0,31 $ par action', signalColor: 'blue', _src: 1 },
          { metric: 'Revenus GAAP sur douze mois', value: fr(G$.rev / 1e9, 1) + ' Md$', signal: 'Douze mois glissants au 27 juin 2026 (XBRL SEC)', signalColor: 'blue', _src: 'gaap' },
          { metric: 'Résultat opérationnel GAAP sur douze mois', value: fr(G$.ebit / 1e9, 2) + ' Md$', signal: 'Pesé par 4,2 Md$ de restructuration et autres charges au premier semestre', signalColor: 'red', _src: 'gaap', _also: [0] },
          { metric: 'Résultat net GAAP sur douze mois', value: fr(G$.ni / 1e9, 1) + ' Md$', signal: 'Dont 13,6 Md$ de pertes de réévaluation des actions en séquestre sur six mois, hors exploitation', signalColor: 'red', _src: 'gaap', _also: [0] },
          { metric: 'Flux de trésorerie opérationnel sur douze mois', value: fr(G$.ocf / 1e9, 1) + ' Md$', signal: 'Dont 7,0 Md$ au deuxième trimestre', signalColor: 'green', _src: 'gaap', _also: [1] },
          { metric: 'Investissements sur douze mois', value: fr(G$.capex / 1e9, 1) + ' Md$', signal: 'Achats d’immobilisations ; flux libre de ' + fr(G$.fcf / 1e9, 1) + ' Md$', signalColor: 'amber', _src: 'gaap' },
          { metric: 'Dette au 27 juin 2026', value: fr(G$.debt / 1e9, 1) + ' Md$', signal: 'Emprunts à court et long terme, avant l’émission d’actions d’août', signalColor: 'amber', _src: 'gaap' },
          { metric: 'Liquidités au 27 juin 2026', value: fr(G$.cash / 1e9, 1) + ' Md$', signal: 'Trésorerie et titres de créance à court terme, avant les 22,6 Md$ de l’émission', signalColor: 'blue', _src: 'gaap' },
          { metric: 'EV/EBITDA GAAP', value: fr(evEb, 1) + '×', signal: 'Valeur d’entreprise au close du 2026-09-23, 5 044 millions d’actions et bilan du 27 juin, avant l’émission, sur EBITDA GAAP douze mois au 2026-06-27', signalColor: 'red', source: 'Clôture certifiée et XBRL SEC', comparison: 'Versus AMD à ' + amdEb + ', Nvidia à ' + nvdaEb + ' et Micron à ' + muEb + ' (fiches publiées, même base et même date), Qualcomm à ' + fr(qcomEb, 1) + '× et GlobalFoundries à ' + fr(gfsEb, 1) + '× (statistiques courantes du 24 septembre, non point-in-time).', _src: 'market', _peers: ['QCOM', 'GFS'], _peerFiches: ['AMD', 'NVDA', 'MU'] },
          { metric: 'EV/EBITDA GAAP après l’émission d’août', value: fr(evEbPf, 1) + '×', signal: 'Pro forma au close du 2026-09-23 : 5 286,1 millions d’actions, option comprise, et produit net des commissions de 22,6 Md$ ajouté aux liquidités (23,0 Md$ bruts à 95 $)', signalColor: 'red', source: 'Clôture certifiée, XBRL SEC et prospectus du 12 août', comparison: 'Versus la base au 27 juin : les actions nouvelles et l’argent levé se compensent presque ; le multiple reste au-dessus de cinquante fois.', _src: 'market' },
          { metric: 'EV/revenus GAAP après l’émission d’août', value: fr(evRevPf, 2) + '×', signal: 'Même base pro forma, sur revenus GAAP douze mois au 2026-06-27', signalColor: 'amber', source: 'Clôture certifiée, XBRL SEC et prospectus du 12 août', comparison: 'Versus une marge opérationnelle GAAP de ' + fr(G$.ebit / G$.rev * 100, 1) + ' % sur douze mois : le marché paie la marge future, pas celle publiée.', _src: 'market' },
          { metric: 'EV/EBITDA — scénario de compression (hypothèse éditoriale)', value: fr(scn.price, 2) + ' $ par action', signal: 'Scénario : multiple ramené à trente fois l’EBITDA GAAP douze mois au 2026-06-27 par hypothèse, bilan du 27 juin, 5 044 millions d’actions, soit ' + fr(scn.downside_pct, 0) + ' % sous le close du 2026-09-23', signalColor: 'red', source: 'Clôture certifiée et XBRL SEC', comparison: 'Versus Nvidia à ' + nvdaEb + ' (fiche publiée) : trente fois reste au-dessus du leader des processeurs d’IA ; ce que coûterait un retour de la marge sous les 40 %, pas un objectif.', _src: 'market', _peerFiches: ['NVDA'] }],
        sourceRefs: [ref(0), ref(1), ref(2), market('fondamentaux et statistiques')] },
      earnings: { quarters: [],
        beatNote: 'Deuxième trimestre 2026 : revenus de 16,1 Md$ (+25 %), au-dessus de la prévision selon le communiqué, marge brute GAAP de 40,4 %, perte GAAP de 2,16 $ par action due au séquestre. La guidance du troisième trimestre vise 15,8 à 16,8 Md$ de revenus, 41,0 % de marge brute GAAP et 0,31 $ de bénéfice GAAP par action. Prochaine publication : 22 octobre selon un seul calendrier collecté, non confirmée par l’émetteur.',
        nextEarnings: '22 octobre 2026 selon un calendrier collecté, date non confirmée par l’émetteur.',
        sourceRefs: [ref(1)] },
      capitalStructure: { sharesOutstanding: '5 044 millions d’actions ordinaires au 17 juillet 2026 (page de garde du 10-Q), avant l’émission d’août',
        sharesAuthorized: 'Actions autorisées non reprises : non décisionnel pour ce dossier.', dilutionRisk: 'high',
        shareHistory: 'Passage au nombre dilué : 5 044 millions d’actions au 17 juillet, plus 210 526 315 actions vendues à 95 $ le 12 août, plus 31 578 947 actions d’option supposées exercées, soit 5 286,1 millions, environ ' + fr(dil, 1) + ' % de plus. L’exercice de l’option n’est pas confirmé dans les dépôts ouverts ; l’hypothèse est prudente pour la dilution. S’y ajoutent 71 millions d’actions en séquestre dont l’émission dépend des versements de l’État. En décembre 2025, NVIDIA avait déjà acheté 214 776 632 actions à 23,28 $ pour 5,0 Md$. Les attributions salariales ne sont pas ajoutées au dénominateur.',
        warrants: [], atm: { active: false, authorized: 'Aucun programme d’émission d’actions sur le marché relevé ; émission ferme de 20 Md$ en août', used: 'Sans objet', remaining: 'Sans objet' },
        sourceRefs: [ref(0), ref(2), ref(3), ref(5)] },
      filingsReview: { summary: 'Six dépôts décisionnels ouverts et hachés. Ils montrent une activité qui se redresse, surtout dans les centres de données, un résultat net écrasé par un séquestre d’actions au profit de l’État, et un capital qui gonfle : 5 Md$ de NVIDIA en décembre, 20 Md$ du public en août.',
        filings: docs.map(d => ({ date: d.date, form: d.form, accession: d.accession, finding: d.finding, url: d.url })),
        contrarianRisks: [
          'Une émission relevée de 15 à 20 Md$ le jour même dit que la demande était forte, mais aussi que la société a pris tout ce qu’elle pouvait.',
          'La fonderie facture surtout les produits Intel : sa croissance de 31 % dit peu des clients tiers.',
          'Chaque hausse du cours alourdit la dette liée au séquestre et la perte GAAP qui l’accompagne.',
          'Trois clients non nommés font 43 % des revenus ; un seul qui réduit ses commandes suffit à peser.'] },
      technicals: { rsi14: +tech.rsi14.toFixed(2), macd: +tech.macd.toFixed(2), macdSignal: +tech.macdSignal.toFixed(2), ema20: +tech.ema20.toFixed(2), ema50: +tech.ema50.toFixed(2), ema200: +tech.ema200.toFixed(2),
        ma50Type: 'EMA', ma200Type: 'EMA', ma50Available: true, ma200Available: true, atr14: +tech.atr14.toFixed(2),
        badges: ['RSI à ' + fr(tech.rsi14, 0) + ', ' + fr(ext20, 1) + ' % au-dessus de la moyenne à vingt séances', 'Gap du 21 septembre non comblé', '+' + fr(runPct, 1) + ' % depuis le 27 août'],
        supports: [lv('s1'), entry, stop], resistances: [lv('r1'), tp1, tp2],
        setupNote: 'Le titre clôture à ' + usd(close) + ', ' + fr(ext20, 1) + ' % au-dessus de sa moyenne à vingt séances, avec un RSI de ' + fr(tech.rsi14, 0) + '. Le gap du 21 septembre, entre ' + usd(bar('2026-09-18')[2]) + ' et ' + usd(entry) + ', n’est pas comblé. Pas d’achat au cours actuel. Activation : une clôture comprise entre ' + usd(stop) + ' exclu et $' + entry.toFixed(2) + ' inclus, au haut du gap, puis achat à l’ouverture suivante ; une clôture sous ' + usd(stop) + ' annule le plan sans l’activer. Après activation, stop sous $' + stop.toFixed(2) + ', plus bas du 18 septembre, soit ' + fr(riskAtr, 2) + ' ATR sous l’entrée. Supports : ' + usd(lv('s1')) + ', ' + usd(entry) + ' et ' + usd(stop) + '. Résistances : ' + usd(lv('r1')) + ', ' + usd(tp1) + ' et ' + usd(tp2) + ', plus haut de l’année.',
        wyckoff: 'Non utilisé : le profil de volume n’est pas exploité dans ce dossier.',
        sourceRefs: [market('barres quotidiennes et indicateurs recalculés')] },
      options: { callOI: 'Non exploitable', putOI: 'Non exploitable', cpRatio: 'Non exploitable', maxPain: 'Non exploitable', ivMean: 'Non exploitable', skew: 'Chaîne relevée en séance le 24 septembre, non rattachée à la clôture de référence', unusual: 'Aucune activité inhabituelle qualifiée', sourceRefs: [market('options')] },
      shortInterest: { siPct: fr(st.shortPercentOfFloat * 100, 2) + ' % du flottant', daysToCover: fr(st.shortRatio, 2) + ' jours, date de règlement non précisée par la source', ctb: 'Coût d’emprunt non disponible à la collecte', trend: 'Positions vendeuses faibles au regard des volumes ; aucune thèse de rachat forcé des vendeurs.', squeezeScore: 'Non pertinent', sourceRefs: [market('positions vendeuses')] },
      insiders: { signal: 'Aucune transaction de dirigeant relevée dans la collecte de l’année. Couverture officielle partielle : l’absence de vente ou d’achat n’est pas certifiée.',
        recentTransactions: [],
        sourceRefs: [market('formulaires 4')] },
      macro: { indicators: [{ name: 'Clôture de référence', value: c.REF, signal: usd(close) + ', séance complète' }, { name: 'Rendement cinq séances', value: sgn(ret(5)), signal: 'Descriptif' }, { name: 'Rendement vingt et une séances', value: sgn(ret(21)), signal: 'Descriptif' }],
        regime: 'neutral', impact: 'Intel dépend des dépenses en serveurs et en ordinateurs, et des subventions américaines à la production locale. Le coût des mémoires, dont Micron donnera le ton le 30 septembre, pèse sur les fabricants d’ordinateurs qui achètent ses processeurs.' },
      risks: { riskScore: 7, riskProfile: 'High',
        riskSummary: 'Le premier risque est d’acheter trop tard : +' + fr(runPct, 1) + ' % en quatre semaines, un RSI de ' + fr(tech.rsi14, 0) + ' et un gap ouvert sous le cours. Le deuxième est le capital : 20 Md$ d’actions nouvelles en août et un séquestre qui fait varier le résultat au rythme du cours. Le troisième est la nervosité du titre, avec des écarts d’ouverture de plus de 5 % plusieurs fois par mois.',
        riskCards: [
          { title: 'Achat en retard', severity: 'high', icon: 'fa-rocket', points: ['+' + fr(runPct, 1) + ' % depuis le 27 août.', 'R/R de ' + fr(rrNow, 2) + ' au cours actuel vers ' + usd(tp1) + '.'], verdict: 'Acheter maintenant, c’est payer le mouvement déjà fait avec un stop trop loin pour l’objectif restant.' },
          { title: 'Dilution et séquestre', severity: 'high', icon: 'fa-money-bill-trend-up', points: ['242,1 millions d’actions nouvelles en août, option comprise.', '71 millions d’actions en séquestre encore conditionnelles.'], verdict: 'Le bénéfice par action se partage sur environ ' + fr(dil, 1) + ' % d’actions en plus qu’en juillet.' },
          { title: 'Écarts d’ouverture', severity: 'high', icon: 'fa-arrows-up-down', points: ['Ouverture à ' + sgn(pct(d0921[1], p0921[4]), 1) + ' le 21 septembre.', 'Ouverture à ' + sgn(pct(d0914[1], p0914[4]), 1) + ' le 14 septembre.'], verdict: 'Un stop peut être franchi d’un coup à l’ouverture : dimensionner comme si la perte pouvait dépasser le stop.' },
          { title: 'Calendrier des publications', severity: 'medium', icon: 'fa-calendar', points: ['Micron publie le 30 septembre.', 'Intel publierait le 22 octobre, date non confirmée.'], verdict: 'Une position ouverte sur repli doit être allégée avant toute publication confirmée dans l’horizon.' }],
        pedagogy: 'Le 14 septembre montre ce qu’est un gap : la veille finissait à ' + usd(p0914[4]) + ', l’ouverture s’est faite à ' + usd(d0914[1]) + '. Tout stop placé entre les deux est exécuté au premier prix disponible, pas au prix prévu. Le slippage, l’écart dans une séance normale, reste faible avec environ ' + fr(adv / 1e9, 1) + ' Md$ échangés par séance. Sur ce titre, la taille de la position se calcule en supposant une ouverture défavorable, pas seulement la distance au stop.' },
      tradeIdea: { status: 'watch', statusNote: 'Surveiller, entrée sur repli seulement. Pas d’achat au cours actuel de ' + usd(close) + ' : +' + fr(runPct, 1) + ' % depuis le 27 août, R/R de ' + fr(rrNow, 2) + ' vers TP1. Avant activation : si le titre clôture au-dessus de ' + usd(tp1) + ' avant tout repli, le plan est retiré. Activation : clôture strictement au-dessus de ' + usd(stop) + ' et au plus ' + usd(entry) + ', puis achat à l’ouverture suivante entre ' + usd(stop) + ' et ' + usd(cap) + '. Après activation : stop sous ' + usd(stop) + '. Ancien plan du 27 août (entrée 92,68 $, stop 89,59 $, TP1 103,66 $, TP2 106,85 $) : il demandait une clôture de quinze minutes au-dessus de 92,68 $, ce que les barres quotidiennes ne permettent pas de vérifier. Deux lectures sont possibles. Première : achat le 28 août (plus haut de ' + usd(d0828[2]) + '), puis stop touché le jour même (plus bas de ' + usd(d0828[3]) + ') ou le 31 août (clôture de ' + usd(d0831[4]) + ') ; c’est ce qu’a enregistré l’outil de suivi, qui a daté ce stop avant l’activation du 4 septembre, une erreur d’ordre de sa part. Seconde : achat sur la clôture du 4 septembre (' + usd(d0904[4]) + '), TP1 dépassé le 8 septembre (plus haut de ' + usd(d0908[2]) + ') et TP2 le 17 septembre (plus haut de ' + usd(d0917[2]) + '). L’ordre des plus hauts et plus bas dans une séance n’est pas connu.',
        entry, stop, tp1, tp2,
        stopPct: pct(stop, entry).toFixed(1) + '%', tp1Pct: '+' + pct(tp1, entry).toFixed(1) + '%', tp2Pct: '+' + pct(tp2, entry).toFixed(1) + '%',
        rr: '1:' + rr1.toFixed(2) + ' TP1 / 1:' + rr2.toFixed(2) + ' TP2',
        entryNote: 'Activation sur une clôture au haut du gap, strictement au-dessus de ' + usd(stop) + ' et au plus ' + usd(entry) + ', pas sur un passage en séance. Achat à l’ouverture suivante uniquement entre ' + usd(stop) + ' et ' + usd(cap) + ' : au plafond, le R/R vers TP1 vaut 1,50 ; au-dessus, il tomberait sous 1,5 ; une ouverture sous ' + usd(stop) + ' annule le plan, sans achat. Le plafond n’est qu’à ' + usd(cap - entry) + ' au-dessus de l’entrée, ' + fr(bufAtr, 2) + ' ATR. Mesure sur les 250 dernières séances : ' + up + ' ouvertures ont dépassé la clôture de la veille de plus de ' + fr(upPct, 2) + ' %, l’écart relatif du plafond, et ' + dn + ' ont ouvert plus de ' + fr(dnPct, 1) + ' % sous la veille, l’écart relatif du stop : une ouverture hors de la fenêtre d’achat n’a rien d’exceptionnel. Le stop est à ' + fr(riskAtr, 2) + ' ATR : une séance ordinaire d’Intel couvre plus de la moitié de cette distance. Objectifs : TP1 au plus haut du 2 juillet, TP2 au plus haut de l’année, le 30 juin. Liquidité : environ ' + fr(adv / 1e9, 1) + ' Md$ échangés par séance, médiane des vingt dernières. Exemple de taille, non personnalisé : avec un budget de perte de 100 $, le risque au plafond, ' + usd(cap - stop) + ' par action, donne ' + sizeExample + ' actions ; un gap comme celui du 14 septembre pourrait alourdir nettement la perte réelle.',
        horizon: 'Dix séances après activation',
        thesis: 'Le redressement est réel dans les centres de données, mais le cours a couru plus vite que les chiffres : ne pas le poursuivre. Un repli qui clôture au haut du gap, sous $' + entry.toFixed(2) + ', offrirait une entrée où le risque se mesure. Après activation, le stop sous $' + stop.toFixed(2) + ' coupe si le gap est entièrement comblé. TP1 à ' + usd(tp1) + ' et TP2 à ' + usd(tp2) + '. Ne pas anticiper la clôture d’activation, ne pas acheter une ouverture au-dessus du plafond, alléger avant toute publication confirmée.',
        catalysts: ['Un repli qui clôture entre ' + usd(stop) + ' et ' + usd(entry) + ' sur un volume en baisse.', 'La publication de Micron le 30 septembre, après la clôture selon les deux calendriers : le coût des mémoires touche les ordinateurs et les serveurs.', 'La confirmation par Intel de sa date de publication du troisième trimestre.'],
        invalidation: ['Avant activation : une clôture au-dessus de ' + usd(tp1) + ' sans repli retire le plan.', 'Avant activation : une clôture sous ' + usd(stop) + ' annule le plan sans l’activer.', 'Après activation : une clôture sous ' + usd(stop) + ' invalide le trade.', 'Ouverture hors de la fenêtre ' + usd(stop) + ' – ' + usd(cap) + ' après la clôture d’activation : pas d’achat.', 'Une nouvelle émission d’actions annoncée avant activation annule la thèse.'] },
      globalScore: { profile: 'Redressement des centres de données, capital gonflé, titre en surchauffe',
        keyTakeawaysPositive: ['Centres de données et IA +59 %.', 'Marge brute GAAP à 40,4 %.', '22,6 Md$ de produit net des commissions de l’émission (23,0 Md$ bruts à 95 $) pour les usines.'],
        keyTakeawaysNegative: ['+' + fr(runPct, 1) + ' % en quatre semaines.', '242,1 millions d’actions nouvelles en août.', 'Perte GAAP liée au séquestre.'],
        mindsetTip: 'Un bon dossier et un bon prix sont deux choses différentes. Ici, le premier s’améliore et le second s’est dégradé de 33 % en un mois : attendre le repli, c’est accepter de le manquer.' },
      social: { platforms: [], sourceRefs: [market('sentiment non retenu faute de mesure qualifiée')] },
      disclaimer: 'Document de recherche éducatif. Ni conseil financier, ni signal de trading. Statut surveiller : aucun ordre actif.',
    };
  },
  groups: [
    { name: 'Référence des processeurs', order: 1, transmission: 'Le concurrent direct dans les processeurs x86, titre coté qui co-évolue le plus avec Intel depuis fin mars.', rows: [
      ['AMD', 'leader', 'Concurrent x86 dans les serveurs et ordinateurs', 'Corrélation la plus forte avec Intel depuis fin mars ; ses gains de parts dans les serveurs se lisent directement sur les centres de données d’Intel.']] },
    { name: 'Pairs directs : puces et fonderies', order: 1, transmission: 'Mêmes clients pour les processeurs, mêmes clients potentiels pour la fonderie.', rows: [
      ['NVDA', 'direct_peer', 'Processeurs graphiques d’IA', 'Concurrent pour les budgets des centres de données et actionnaire d’Intel depuis décembre 2025.'],
      ['ARM', 'direct_peer', 'Architecture concurrente de x86', 'Ses licences gagnent les ordinateurs portables et les serveurs, terrain historique d’Intel.'],
      ['QCOM', 'direct_peer', 'Processeurs pour ordinateurs portables', 'Concurrent sur les ordinateurs portables avec des puces Arm ; ses gains se prennent sur Intel.'],
      ['TSM', 'direct_peer', 'Fonderie de référence', 'Concurrent de la fonderie d’Intel pour les clients tiers ; Intel lui confie aussi une partie de ses puces.'],
      ['GFS', 'direct_peer', 'Fonderie de procédés matures', 'Concurrent américain de la fonderie sur les procédés matures et les subventions à la production locale.']] },
    { name: 'Amont : équipements', order: 1, transmission: 'Les usines d’Intel achètent leurs machines à ces fournisseurs : les investissements financés par l’émission s’y retrouvent.', rows: [
      ['AMAT', 'upstream', 'Équipements de dépôt et de gravure', 'Fournisseur d’équipements des usines ; ses commandes suivent les investissements d’Intel.'],
      ['LRCX', 'upstream', 'Équipements de gravure', 'Fournisseur de gravure pour les procédés avancés que la fonderie d’Intel met en production.'],
      ['ASML', 'upstream', 'Machines de lithographie', 'Fournisseur des machines de lithographie des procédés les plus fins d’Intel.']] },
    { name: 'Aval : fabricants de serveurs et d’ordinateurs', order: 2, transmission: 'Ils achètent les processeurs d’Intel ; leurs volumes et leurs coûts de mémoire se lisent sur ses commandes.', rows: [
      ['DELL', 'downstream', 'Serveurs et ordinateurs', 'Acheteur majeur de processeurs pour serveurs et ordinateurs ; ses prévisions éclairent la demande.'],
      ['HPQ', 'downstream', 'Fabricant d’ordinateurs personnels', 'Acheteur de processeurs pour ordinateurs ; son cycle de renouvellement touche le premier segment d’Intel.'],
      ['HPE', 'downstream', 'Fabricant de serveurs d’entreprise', 'Acheteur de processeurs Xeon pour les serveurs classiques et d’IA.'],
      ['SMCI', 'downstream', 'Assembleur de serveurs d’IA', 'Assembleur de serveurs ; ses commandes montrent la part des processeurs d’Intel dans les grappes d’IA.']] },
    { name: 'Second ordre : mémoire', order: 2, transmission: 'Même plateforme que les processeurs ; son prix pèse sur le coût des machines.', rows: [
      ['MU', 'second_order', 'Mémoires DRAM et HBM', 'Ses prix de mémoire font le coût des serveurs et ordinateurs qui embarquent les processeurs d’Intel.']] },
    { name: 'Contrôles sectoriels', order: 2, transmission: 'Paniers de référence pour isoler ce qui est propre à Intel.', rows: [
      ['SMH', 'sector_proxy', 'Panier de semi-conducteurs', 'Contrôle du secteur : un écart avec ce panier isole ce qui est propre à Intel.'],
      ['SOXX', 'sector_proxy', 'Second panier de semi-conducteurs', 'Contrôle équipondéré plus large : confirme ou infirme la lecture tirée de SMH.'],
      ['QQQ', 'sector_proxy', 'Grandes valeurs du Nasdaq', 'Contrôle large : un mouvement commun avec ce panier n’a rien de spécifique au titre.']] },
  ],
  eventDefault: { leader: 'Aucune publication dans les quatorze jours collectés ; ses parts dans les serveurs restent le signal à suivre', direct_peer: 'Aucune publication dans les quatorze jours collectés ; ses prix et ses gains de parts sont à suivre', upstream: 'Aucune publication dans les quatorze jours collectés ; ses commandes d’équipements sont à suivre', downstream: 'Aucune publication dans les quatorze jours collectés ; ses volumes de machines sont à suivre', second_order: 'Aucune publication dans les quatorze jours collectés', sector_proxy: 'Panier sans publication propre ; exposé aux résultats de ses grandes pondérations' },
  eventRisk: { MU: 'Publication le 30 septembre après la clôture, date donnée par deux calendriers concordants et non confirmée ici par l’émetteur : risque de gap sur les coûts de mémoire, dans l’horizon du plan' },
  blastDoc: 4,
  scenarios: c => [
    { scenario: 'bullish', trigger: 'Le secteur se reprend et Intel revient au haut du gap sans le combler.', firstOrder: 'Une clôture au haut du gap active le plan.', secondOrder: 'AMD et SMH tiennent ; le repli d’Intel reste une consolidation.', confirmation: 'Une clôture entre ' + c.usd(c.stop) + ' et ' + c.usd(c.entry) + ' puis un rebond avec AMD.', contradiction: 'Un repli d’Intel pendant qu’AMD et SMH montent.' },
    { scenario: 'mixed', trigger: 'Le titre digère sa hausse sans revenir vers le gap.', firstOrder: 'Clôtures entre ' + c.usd(c.entry) + ' et ' + c.usd(c.tp1) + ' ; pas d’activation.', secondOrder: 'L’écart avec AMD se réduit sans information propre.', confirmation: 'Plusieurs séances au-dessus de ' + c.usd(c.entry) + ' sans nouveau plus haut.', contradiction: 'Une clôture au-dessus de ' + c.usd(c.tp1) + ', qui retire le plan.' },
    { scenario: 'bearish', trigger: 'Micron annonce des prix de mémoire en hausse, ou une nouvelle émission d’Intel.', firstOrder: 'Le gap est comblé et le titre clôture sous le plus bas du 18 septembre.', secondOrder: 'Les fabricants d’ordinateurs reculent avec lui.', confirmation: 'Une clôture sous ' + c.usd(c.stop) + ' avec SMH en baisse.', contradiction: 'Un repli d’Intel que le secteur ne suit pas, sans nouvelle propre.' }],
  contradictions: c => ['Les centres de données croissent de 59 %, mais Intel a préféré lever 20 Md$ en actions plutôt que de s’endetter davantage : la société juge elle-même ses besoins supérieurs à ses flux.', 'La corrélation avec AMD est forte, mais AMD gagne des parts sur Intel : même sens de marché, intérêts opposés.'],
  missingData: c => ['Trois clients à 19 %, 12 % et 12 % des revenus, non nommés : aucun client coté n’entre dans les comparables comme client documenté.', 'Exercice de l’option de l’émission non confirmé dans les dépôts ouverts ; date de publication du troisième trimestre donnée par un seul calendrier.', 'Chaîne d’options relevée en séance, non rattachée à la clôture ; sentiment non retenu.', 'Barres d’une source de repli pour toutes les séries.'],
  limitations: ['Barres d’une source de repli (Webull).', 'Options non rattachées à la clôture de référence.', 'Option de l’émission supposée exercée ; produit compté net des commissions, avant autres frais.'],
});
