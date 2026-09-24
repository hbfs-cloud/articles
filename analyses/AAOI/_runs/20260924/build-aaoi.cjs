'use strict';
// Dossier AAOI v3 au close du 2026-09-23 (lot R05), refonte de la v3 du 19 septembre (close du 18).
// Contenu éditorial et niveaux propres au titre ; calculs, provenance et preuves délégués au gabarit
// tools/lib/analysis-v3-r05.cjs (identique au gabarit R04 pour ce dossier : aucune instance XBRL ajoutée,
// companyfacts couvre le 10-Q du 30 juin).
// Changements par rapport à la version du 19 septembre, chacun justifié dans le dossier :
// (1) agrégats financiers GAAP lus dans les données XBRL officielles, au lieu du snapshot fournisseur ;
// (2) base d'actions réconciliée : 84 569 237 actions au 3 août + 2,884 millions d'actions des convertibles 2030
//     (convertibles vers 43,31 $, donc dans la monnaie : comptées au dénominateur et retirées de la dette)
//     + 1 324 233 actions de la tranche acquise du bon de souscription d'Amazon ;
// (3) statut inchangé, aucun ordre, mais motif changé : ce n'est plus l'absence de sources, c'est le programme
//     d'émission sur le marché de 600 M$ ouvert le 21 août et un flux opérationnel négatif ;
// (4) niveaux archivés conservés à l'identique, avec le constat vérifié sur barres qu'ils n'ont jamais été activés.
const R = require('../../../../tools/lib/analysis-v3-r05.cjs');
const GEN = 'analyses/AAOI/_runs/20260924/build-aaoi.cjs';
const COVER = 84569237, CONV = 2884000, WARRANT = 1324233;

R.build({
  ticker: 'AAOI', shortName: 'Applied Optoelectronics', cik: 1158114, generator: GEN, mode: 'archived', clientBars: true,
  xbrl: { ttm: { rev: ['RevenueFromContractWithCustomerExcludingAssessedTax'], ebit: ['OperatingIncomeLoss'], ni: ['NetIncomeLoss'], da: ['DepreciationAndAmortization'], ocf: ['NetCashProvidedByUsedInOperatingActivities'] },
    instant: { ltd: ['LongTermDebtNoncurrent'], std: ['LongTermDebtCurrent'], cashEq: ['CashAndCashEquivalentsAtCarryingValue'] }, da: ['da'], debt: ['ltd', 'std'], cash: ['cashEq'] },
  scenarioBasis: 'revenue', scenarioMultiple: 8,
  valuationBasis: 'GAAP douze mois au 2026-06-30 (XBRL SEC) ; EBITDA GAAP négatif, donc multiple appliqué aux revenus ; dette = emprunts bancaires à court et long terme au 30 juin, hors obligations convertibles 2030, comptées en actions ; trésorerie = liquidités du 30 juin ; 88,8 millions d’actions : 84,6 millions au 3 août, 2,9 millions issues des convertibles 2030 et 1,3 million de la tranche acquise du bon d’Amazon ; multiple de huit fois les revenus = hypothèse éditoriale',
  shares: { value: COVER + CONV + WARRANT, doc: 0 },
  levels: { s1: { d: '2026-09-23', c: 3 }, s2: { d: '2026-09-03', c: 3 }, s3: { d: '2026-09-16', c: 3 }, r1: { d: '2026-09-22', c: 2 }, r2: { d: '2026-09-08', c: 2 }, r3: { d: '2026-08-27', c: 2 } },
  supports: ['s1', 's2', 's3'], resistances: ['r1', 'r2', 'r3'],
  levelsMethod: 'Niveaux archivés conservés à l’identique ; repères actuels lus sur les barres certifiées.',
  inventory: 61,
  reviewScope: 'Dépôts EDGAR d’Applied Optoelectronics du 1er août 2025 au 23 septembre 2026 (61 formulaires hors formulaires 3, 4, 5 et 144), dont le 10-K de l’exercice 2025. Les 8-K de gouvernance (items 5.02, 5.07, accord d’indemnisation du 24 août), le changement d’auditeur (item 4.01), la procuration et ses compléments, le rapport annuel aux actionnaires, le formulaire SD et les S-8 et S-8 POS des plans salariés sont écartés comme non décisionnels ; les 8-K de baux et d’achat de bâtiments (items 1.01 et 2.03) décrivent l’extension de capacité et sont résumés par le 10-Q ; les 424B5 et 8-K des programmes d’émission précédents sont repris par le 10-Q, qui détaille les ventes.',
  docs: [
    ['2026-08-06', '10-Q', '0001437749-26-026278', 'aaoi20260630_10q.htm', 'q2-10q__aaoi20260630_10q.htm',
      'Rapport trimestriel au 30 juin 2026 : 84 569 237 actions au 3 août ; 7 775 523 actions vendues sur le marché au premier semestre pour 1,05 Md$ bruts ; convertibles 2030 à 23,0884 actions pour 1 000 $, 2,9 millions d’actions potentielles ; bon d’Amazon exerçable sur 1 324 233 actions à 23,6956 $ ; investissements de 335,1 M$ au semestre.'],
    ['2026-08-06', '8-K / Exhibit 99.1', '0001683168-26-006055', 'aaoi_ex9901.htm', 'q2-8k__aaoi_ex9901.htm',
      'Communiqué du deuxième trimestre, daté du 6 août : revenus de 191,9 M$ contre 103,0 M$, marge brute GAAP de 27,7 %, perte nette GAAP de 22,8 M$. Prévision : 255 à 290 M$ de revenus au troisième trimestre ; demande attendue au-dessus des capacités jusqu’à mi-2027.'],
    ['2026-02-26', '10-K', '0001437749-26-005875', 'aaoi20251231_10k.htm', 'fy25-10k__aaoi20251231_10k.htm',
      'Rapport annuel de l’exercice 2025 : Digicomm à 53,1 % et Microsoft à 28,8 % des revenus ; dix premiers clients à 96,6 % ; bon de souscription accordé à une filiale d’Amazon en mars 2025.'],
    ['2026-08-21', '8-K', '0001104659-26-099688', 'tm2623389d2_8k.htm', 'aug21-8k__tm2623389d2_8k.htm',
      'Nouveau programme d’émission d’actions sur le marché, signé le 21 août 2026 avec Raymond James et Needham : jusqu’à 600 M$ d’actions vendues au fil de l’eau, sans obligation de vendre. Émission d’actions, bloquante pour une recommandation.'],
    ['2026-08-21', '424B5', '0001104659-26-099685', 'tm2623389-1_424b5.htm', 'aug21-424b5__tm2623389-1_424b5.htm',
      'Prospectus du programme : cours de référence de 129,10 $ le 20 août ; à ce prix, 600 M$ correspondent à 4 647 561 actions nouvelles. Au cours du 23 septembre, le même montant représenterait environ 5,9 millions d’actions.'],
  ],
  needles: {
    q2q: [0, ['As of August 3, 2026 , there w ere 84,569,237 sh ares', 'Total 7,775,523 $ 1,049,814', 'The conversion rate for the 2030 Notes is 23.0884 shares of Common Stock per $1,000 principal amount', 'Shares for convertible senior notes 2,884', 'the Customer Warrant is exercisable to purchase 1,324,233 Warrant Shares', 'exercise price of $ 23.6956 per share', 'Purchase of property, plant and equipment ( 335,132 )', 'On March 13, 2025, the Company issued a warrant']],
    q2: [1, ['GAAP revenue was $191.9 million, compared with $103.0 million in the second quarter of 2025', 'GAAP gross margin was 27.7%', 'GAAP net loss was $22.8 million', 'Revenue in the range of $255 million to $290 million', 'demand will continue to outpace our production capacity through mid-2027']],
    annual: [2, ['Digicomm represented 53.1% of our revenue and Microsoft represented 28.8% of our revenue', 'our top ten customers represented 96.6%']],
    atm: [3, ['having an aggregate offering price of up to $600 million from time to time through the Sales Agents', 'The Company has no obligation to sell any Shares under the Agreement']],
    pros: [4, ['On August 20, 2026, the last reported sale price of our common stock on The Nasdaq Global Market was $129.10 per share', 'Assuming that we sell an aggregate of 4,647,561 shares of our common stock']],
  },
  sectionDocs: { verdict: [1, 3], business: [1, 0, 2], news: [3, 1], earnings: [1], capitalStructure: [0, 3, 4], filingsReview: [0, 1, 2, 3, 4], risks: [0, 3, 1], globalScore: [1], meta: [1], disclaimer: [1], macro: [2], options: [1], social: [1], header: [0] },
  score: { business: 16, technical: 2, capital: -4, calendar: 0, dilution: -5, risk: 27 },
  peers: true,
  peerFicheSha: {},
  route: (p, { prov, dep, B }) => {
    if (/^news\.[01]\./.test(p)) return prov('bars', B, 'Ouverture et clôture lues sur les barres certifiées ; écart d’ouverture = ouverture / clôture de la veille − 1 ; comparaison avec Lumentum et SMH sur la même séance.', [dep('comparison', '')]);
    return null;
  },
  riskScoreReason: 'Jugement qualitatif sur dix : programme d’émission de 600 M$ ouvert, 1,05 Md$ déjà vendus au semestre, flux opérationnel négatif, deux clients à plus de 80 % des revenus et ATR de plus de 8 %.',
  compose: c => {
    const { fr, usd, pct, sgn, close, prev, bars, N, tech, st, M, adv, ret, G$, marketCap, ev, scn, entry, stop, tp1, tp2, rr1, rr2, ref, market, docs, raw, peerStat, lv, archive } = c;
    const cmp = raw.comparison_bars.data.items[0].results[0].data;
    const dr = (sym, d) => { const b = cmp.find(x => x.symbol === sym).bars, i = b.findIndex(x => x[0] === d); return pct(b[i][4], b[i - 1][4]); };
    const bar = d => bars.find(b => b[0] === d), prevOf = d => bars[bars.findIndex(b => b[0] === d) - 1];
    const d0824 = bar('2026-08-24'), p0824 = prevOf('2026-08-24'), d0914 = bar('2026-09-14'), p0914 = prevOf('2026-09-14');
    const d0827 = bar('2026-08-27'), hi0513 = bar('2026-05-13'), d0918 = bar('2026-09-18');
    let maxHi = 0, maxD = ''; for (let i = bars.findIndex(b => b[0] === '2026-08-28'); i <= N; i++) if (bars[i][2] > maxHi) { maxHi = bars[i][2]; maxD = bars[i][0]; }
    const evRev = ev / G$.rev, fwdRev = 272.5e6 * 4, evFwd = ev / fwdRev, fromHi = pct(close, hi0513[2]);
    const liteRev = peerStat('LITE', 'enterpriseToRevenue'), cohrRev = peerStat('COHR', 'enterpriseToRevenue'), cienRev = peerStat('CIEN', 'enterpriseToRevenue');
    const atmShares = 600e6 / close, atmPct = atmShares / (COVER + CONV + WARRANT) * 100, sinceArchive = pct(close, d0918[4]);
    return {
      meta: { lang: 'fr', dir: 'ltr', level: 'intermediate', tags: ['us', 'equities', 'ai-chain', 'optics', 'technology'], grade: 'C', date: '2026-09-24', dateDisplay: '24 septembre 2026', version: 3, status: 'no-trade', assetType: 'stock', levelsCloseDate: c.REF,
        description: 'Applied Optoelectronics : revenus +86 %, prévision à 255–290 M$, mais 1,05 Md$ d’actions vendues au semestre et un nouveau programme de 600 M$ ouvert le 21 août. Dossier au close du 23 septembre 2026, aucun ordre.',
        ogDescription: 'AAOI : revenus de 191,9 M$ (+86 %), prévision relevée ; programme d’émission de 600 M$ ouvert ; titre à 101,06 $, 57 % sous son sommet de mai ; aucun ordre actif.',
        lastMcpRefresh: raw.status.captured_at, levelsVerifiedAt: raw.status.captured_at,
        statusHistory: [{ at: raw.status.captured_at, from: 'no-trade', to: 'no-trade', note: 'refonte v3 du 24 septembre : aucun ordre, motif mis à jour (programme d’émission ouvert), clôture de référence du 2026-09-23', close }] },
      header: { ticker: 'AAOI', name: 'Applied Optoelectronics, Inc.', exchange: 'NASDAQ', sector: 'Modules optiques pour centres de données et réseaux câblés', price: close, changePct: pct(close, prev),
        badges: [{ text: 'AUCUN ORDRE — PROGRAMME D’ÉMISSION DE 600 M$ OUVERT', color: 'red' }, { text: 'Chaîne IA — optique des centres de données', color: 'purple' }],
        metrics: { marketCap: fr(marketCap / 1e9, 2) + ' Md$', volume: fr(bars[N][5] / 1e6, 1) + ' M', evEbitda: 'Non significatif' }, halalStatus: 'unknown' },
      verdict: { score: 36, conviction: 'Low', bias: 'Neutral',
        confidence: 'Score éditorial non prédictif. Les chiffres d’entreprise viennent des dépôts SEC et des données XBRL officielles ; les niveaux, du close certifié du 23 septembre.',
        summary: 'Applied Optoelectronics vend d’abord des équipements aux câblo-opérateurs, Digicomm en tête avec 53,1 % des revenus 2025, puis des modules optiques aux centres de données, surtout à Microsoft, 28,8 %. Au deuxième trimestre, ses revenus ont atteint 191,9 M$, contre 103,0 M$ un an plus tôt, et la prévision vise 255 à 290 M$ au troisième. Mais la croissance se paie en actions : 7,8 millions d’actions vendues sur le marché au premier semestre, 1,05 Md$ bruts, puis un nouveau programme de 600 M$ ouvert le 21 août. Le flux opérationnel des douze derniers mois est négatif, à ' + fr(G$.ocf / 1e6, 0) + ' M$. Le titre clôture le 23 septembre à ' + usd(close) + ', ' + fr(Math.abs(fromHi), 0) + ' % sous son sommet de mai, et vaut ' + fr(evRev, 1) + ' fois ses revenus GAAP, ' + fr(evFwd, 1) + ' fois la prévision annualisée. Tant que la société peut vendre des actions à chaque hausse, aucun ordre.',
        whyBuy: [
          'Revenus du deuxième trimestre de 191,9 M$, +86 % sur un an, cinquième record trimestriel consécutif selon la société.',
          'Prévision du troisième trimestre à 255 à 290 M$, soit +33 à +51 % sur le trimestre.',
          'Demande attendue au-dessus des capacités jusqu’à mi-2027, selon la direction ; capacité en forte hausse au Texas et en Chine.',
          'Liquidités de ' + fr(G$.cash / 1e6, 0) + ' M$ au 30 juin après les ventes d’actions du semestre.'],
        whyAvoid: [
          'Programme d’émission de 600 M$ ouvert le 21 août : environ ' + fr(atmShares / 1e6, 1) + ' millions d’actions au cours actuel, ' + fr(atmPct, 1) + ' % de plus.',
          'Flux opérationnel négatif de ' + fr(Math.abs(G$.ocf) / 1e6, 0) + ' M$ sur douze mois et 335,1 M$ d’investissements au seul premier semestre.',
          'Perte nette GAAP de 22,8 M$ au deuxième trimestre malgré le record de revenus.',
          'Digicomm à 53,1 % et Microsoft à 28,8 % des revenus 2025.'],
        controlChecklist: [
          { label: 'Historique de cours', status: 'pass', statusLabel: 'Trois cents séances continues', evidence: 'Série quotidienne certifiée au close du 23 septembre, source de repli documentée.', action: 'Repères et indicateurs recalculés sur cette seule série.' },
          { label: 'Dilution', status: 'fail', statusLabel: 'Programme d’émission ouvert', evidence: '8-K et prospectus du 21 août : jusqu’à 600 M$ d’actions vendues au fil de l’eau par Raymond James et Needham.', action: 'Aucun ordre tant que le programme reste ouvert et non épuisé.' },
          { label: 'Base d’actions', status: 'pass', statusLabel: 'Réconciliée', evidence: '84,6 millions d’actions au 3 août, plus 2,9 millions des convertibles 2030 et 1,3 million du bon d’Amazon.', action: 'Raisonner sur 88,8 millions d’actions, avant le programme d’août.' }] },
      business: { theme: 'Modules optiques pour les centres de données et équipements pour réseaux câblés',
        overview: '<p>Applied Optoelectronics fabrique des lasers et des modules optiques, du composant au produit fini, pour les centres de données et les réseaux câblés. Au deuxième trimestre 2026, ses revenus ont atteint 191,9 M$, contre 103,0 M$ un an plus tôt ; la marge brute GAAP est tombée à 27,7 % et la perte nette GAAP à 22,8 M$, pendant la montée en cadence des modules à 800 gigabits.</p><p>La prévision du troisième trimestre vise 255 à 290 M$ de revenus. La direction dit que la demande dépassera ses capacités jusqu’à mi-2027 et bâtit des usines au Texas et en Chine : 335,1 M$ d’investissements au premier semestre, plus des acomptes sur équipements.</p><p>Pour les financer, la société vend des actions : 7 775 523 actions sur le marché entre mars et juin, 1,05 Md$ bruts, puis un nouveau programme de 600 M$ le 21 août. Deux clients dominent : Digicomm, 53,1 % des revenus 2025, et Microsoft, 28,8 %.</p>',
        moat: 'L’avantage tient à l’intégration verticale, des lasers aux modules, et à une fabrication aux États-Unis, argument face aux concurrents asiatiques. Il reste fragile : les grands clients mettent les fournisseurs en concurrence à chaque génération, et Lumentum ou Coherent ont une échelle bien supérieure.',
        segments: [
          { name: 'Centres de données', revenue: 'Principal moteur de la croissance', pct: '42,9 % des revenus 2025', description: 'Modules optiques de 400 et 800 gigabits, en montée vers 1,6 térabit.' },
          { name: 'Réseaux câblés', revenue: 'Premier segment en 2025', pct: '53,8 % des revenus 2025', description: 'Amplificateurs et équipements pour les câblo-opérateurs, dont Digicomm.' }],
        sourceRefs: [ref(1), ref(0), ref(2)],
        coverageMatrix: [
          { facet: 'Cours et historique', status: 'COUVERT', decision: 'Trois cents séances continues, close certifié ; base des repères et des indicateurs.' },
          { facet: 'Résultats et guidance', status: 'COUVERT — PRIMAIRE', decision: 'Communiqué du 6 août et 10-Q ; date du troisième trimestre non confirmée par l’émetteur.' },
          { facet: 'Capital et dette', status: 'COUVERT — PRIMAIRE', decision: 'Ventes d’actions du semestre, programme d’août, convertibles et bon d’Amazon réconciliés.' },
          { facet: 'Agrégats GAAP', status: 'COUVERT — XBRL', decision: 'Douze mois glissants au 30 juin 2026, reconstitués depuis les données XBRL officielles.' },
          { facet: 'Comparables et transmission', status: 'COUVERT — LOCAL', decision: 'Corrélations recalculées sur barres certifiées, Microsoft inclus comme client documenté.' },
          { facet: 'Initiés', status: 'PARTIEL', decision: 'Ventes du directeur financier et d’un dirigeant en septembre ; couverture officielle incomplète.' },
          { facet: 'Options', status: 'NON EXPLOITABLE', decision: 'Chaîne relevée en séance le 24 septembre, non rattachée à la clôture de référence.' }] },
      news: [
        { date: '2026-08-24', title: 'Gap de ' + sgn(pct(d0824[1], p0824[4]), 1) + ' après le programme d’émission', impact: 'negative', detail: 'Le programme de 600 M$ est signé le 21 août, un vendredi ; la première séance qui le reflète est celle du lundi 24. Le titre ouvre à ' + usd(d0824[1]) + ' contre ' + usd(p0824[4]) + ' et clôture à ' + usd(d0824[4]) + ' (' + sgn(pct(d0824[4], p0824[4]), 2) + '). Lumentum fait ' + sgn(dr('LITE', '2026-08-24'), 2) + ' et SMH ' + sgn(dr('SMH', '2026-08-24'), 2) + ' la même séance : la baisse est propre à AAOI.', source: 'Barres certifiées', sourceUrl: c.evidenceUrl },
        { date: '2026-09-14', title: 'Gap de ' + fr(pct(d0914[1], p0914[4]), 1) + ' % à l’ouverture', impact: 'negative', detail: 'Ouverture à ' + usd(d0914[1]) + ' (' + sgn(pct(d0914[1], p0914[4]), 2) + '), clôture à ' + usd(d0914[4]) + ' (' + sgn(pct(d0914[4], p0914[4]), 2) + '). Lumentum fait ' + sgn(dr('LITE', '2026-09-14'), 2) + ' et SMH ' + sgn(dr('SMH', '2026-09-14'), 2) + ' la même séance : l’optique recule avec le secteur, AAOI davantage ; aucun dépôt ouvert ici n’en donne la cause.', source: 'Barres certifiées', sourceUrl: c.evidenceUrl },
        { date: '2026-08-06', title: 'Revenus de 191,9 M$, prévision à 255–290 M$', impact: 'positive', detail: 'Revenus +86 % sur un an, marge brute GAAP de 27,7 %, perte nette GAAP de 22,8 M$ ; prévision du troisième trimestre à 255 à 290 M$.', source: 'Applied Optoelectronics — SEC', sourceUrl: docs[1].url }],
      fundamentals: { rows: [
          { metric: 'Revenus du deuxième trimestre', value: '191,9 M$', signal: 'Contre 103,0 M$ un an plus tôt, +86 %', signalColor: 'green', _src: 1 },
          { metric: 'Marge brute GAAP du deuxième trimestre', value: '27,7 %', signal: 'Contre 30,3 % un an plus tôt, pendant la montée en cadence', signalColor: 'amber', _src: 1 },
          { metric: 'Prévision du troisième trimestre', value: '255 à 290 M$', signal: 'Soit +33 à +51 % sur le deuxième trimestre', signalColor: 'green', _src: 1 },
          { metric: 'Investissements du premier semestre', value: '335,1 M$', signal: 'Achats d’immobilisations, hors acomptes sur équipements de 289,7 M$', signalColor: 'red', _src: 0 },
          { metric: 'Actions vendues sur le marché au premier semestre', value: '7 775 523', signal: '1,05 Md$ bruts, entre 101,72 et 197,26 $ par action selon les mois', signalColor: 'red', _src: 0 },
          { metric: 'Revenus GAAP sur douze mois', value: fr(G$.rev / 1e6, 0) + ' M$', signal: 'Douze mois glissants au 30 juin 2026 (XBRL SEC)', signalColor: 'blue', _src: 'gaap' },
          { metric: 'Résultat opérationnel GAAP sur douze mois', value: fr(G$.ebit / 1e6, 1) + ' M$', signal: 'Marge de ' + fr(G$.ebit / G$.rev * 100, 1) + ' %, douze mois glissants au 30 juin 2026', signalColor: 'red', _src: 'gaap' },
          { metric: 'Résultat net GAAP sur douze mois', value: fr(G$.ni / 1e6, 1) + ' M$', signal: 'Douze mois glissants au 30 juin 2026', signalColor: 'red', _src: 'gaap' },
          { metric: 'EBITDA GAAP sur douze mois', value: fr(G$.ebitda / 1e6, 1) + ' M$', signal: 'Résultat opérationnel plus amortissements : négatif, aucun multiple d’EBITDA n’est significatif', signalColor: 'red', _src: 'gaap' },
          { metric: 'Flux de trésorerie opérationnel sur douze mois', value: fr(G$.ocf / 1e6, 1) + ' M$', signal: 'Stocks et montée en cadence financés par les ventes d’actions', signalColor: 'red', _src: 'gaap' },
          { metric: 'Dette bancaire au 30 juin 2026', value: fr(G$.debt / 1e6, 1) + ' M$', signal: 'Hors 124,9 M$ de convertibles 2030, dans la monnaie et comptés en actions', signalColor: 'amber', _src: 'gaap', _also: [0] },
          { metric: 'Liquidités au 30 juin 2026', value: fr(G$.cash / 1e6, 1) + ' M$', signal: 'Trésorerie et équivalents, après 1,03 Md$ nets levés au semestre', signalColor: 'green', _src: 'gaap', _also: [0] },
          { metric: 'EV/revenus GAAP', value: fr(evRev, 1) + '×', signal: 'Valeur d’entreprise au close du 2026-09-23, 88,8 millions d’actions, sur revenus GAAP douze mois au 2026-06-30', signalColor: 'red', source: 'Clôture certifiée et XBRL SEC', comparison: 'Versus Lumentum à ' + fr(liteRev, 1) + '×, Coherent à ' + fr(cohrRev, 1) + '× et Ciena à ' + fr(cienRev, 1) + '× (statistiques courantes du 24 septembre, non point-in-time) : AAOI se paie plus que Coherent sans en avoir les marges.', _src: 'market', _peers: ['LITE', 'COHR', 'CIEN'], _peerField: 'enterpriseToRevenue' },
          { metric: 'EV sur prévision annualisée', value: fr(evFwd, 1) + '×', signal: 'Même valeur d’entreprise sur quatre fois le milieu de la prévision du troisième trimestre, 272,5 M$', signalColor: 'amber', source: 'Clôture certifiée, XBRL SEC et communiqué du 6 août', comparison: 'Versus ' + fr(evRev, 1) + '× sur douze mois publiés : le cours paie déjà la prévision tenue.', _src: 'market', _also: [1] },
          { metric: 'EV/revenus — scénario de compression (hypothèse éditoriale)', value: fr(scn.price, 2) + ' $ par action', signal: 'Scénario : multiple ramené à huit fois les revenus GAAP douze mois au 2026-06-30 par hypothèse, bilan du 30 juin, soit ' + fr(scn.downside_pct, 0) + ' % sous le close du 2026-09-23', signalColor: 'red', source: 'Clôture certifiée et XBRL SEC', comparison: 'Versus Ciena à ' + fr(cienRev, 1) + '× : huit fois correspond à un équipementier optique rentable ; ce que coûterait une prévision manquée, pas un objectif.', _src: 'market', _peers: ['CIEN'], _peerField: 'enterpriseToRevenue' }],
        sourceRefs: [ref(0), ref(1), market('fondamentaux et statistiques')] },
      earnings: { quarters: [],
        beatNote: 'Deuxième trimestre 2026 : revenus de 191,9 M$, en ligne ou au-dessus des attentes de la direction, marge brute GAAP de 27,7 %, perte nette GAAP de 22,8 M$, retour au bénéfice non-GAAP. La guidance du troisième trimestre vise 255 à 290 M$ de revenus et 29 à 30,5 % de marge brute non-GAAP, sur environ 92,8 millions d’actions. Prochaine publication : 5 novembre selon un seul calendrier collecté, non confirmée par l’émetteur.',
        nextEarnings: '5 novembre 2026 selon un calendrier collecté, date non confirmée par l’émetteur.',
        sourceRefs: [ref(1)] },
      capitalStructure: { sharesOutstanding: '84 569 237 actions ordinaires au 3 août 2026 (page de garde du 10-Q)',
        sharesAuthorized: 'Actions autorisées non reprises : non décisionnel pour ce dossier.', dilutionRisk: 'high',
        shareHistory: 'Passage au nombre dilué : 84 569 237 actions au 3 août, plus environ 2,9 millions d’actions des convertibles 2030, convertibles vers 43,31 $ donc dans la monnaie, plus 1 324 233 actions de la tranche acquise du bon d’Amazon, exerçable à 23,6956 $, soit 88,8 millions. Les 6,6 millions d’actions restantes du bon ne s’acquièrent qu’avec 4 Md$ d’achats d’Amazon sur dix ans. Au premier semestre, la société a vendu 7 775 523 actions sur le marché pour 1,05 Md$ bruts ; le programme de 600 M$ du 21 août représenterait environ ' + fr(atmShares / 1e6, 1) + ' millions d’actions de plus au cours actuel. La prévision du troisième trimestre retient déjà environ 92,8 millions d’actions.',
        warrants: [{ series: 'Bon de souscription d’Amazon', type: 'Client', strike: 23.6956, shares: '7 945 399, dont 1 324 233 exerçables', issued: '13 mars 2025', expiration: 'Dix ans, acquisition liée à 4 Md$ d’achats', dilutionPct: 'Environ 1,5 % pour la tranche acquise', status: 'ITM' }],
        atm: { active: true, authorized: '600 M$ (programme du 21 août 2026)', used: 'Non publié depuis le 21 août', remaining: 'Jusqu’à 600 M$, environ ' + fr(atmShares / 1e6, 1) + ' millions d’actions au cours du 23 septembre' },
        sourceRefs: [ref(0), ref(3), ref(4)] },
      filingsReview: { summary: 'Cinq dépôts décisionnels ouverts et hachés. Ils montrent une croissance réelle des revenus, financée par la vente continue d’actions, deux clients qui font plus de 80 % des revenus, et un programme d’émission de 600 M$ ouvert depuis le 21 août.',
        filings: docs.map(d => ({ date: d.date, form: d.form, accession: d.accession, finding: d.finding, url: d.url })),
        contrarianRisks: [
          'Le programme de 600 M$ fait de chaque hausse une occasion de vendre des actions : il plafonne mécaniquement les rebonds.',
          'La marge brute baisse pendant la montée en cadence ; la rentabilité GAAP reste à prouver.',
          'Microsoft et Digicomm décident à eux deux de plus de 80 % des revenus.',
          'Les usines en construction au Texas et en Chine engagent des loyers et des investissements avant les revenus.'] },
      technicals: { rsi14: +tech.rsi14.toFixed(2), macd: +tech.macd.toFixed(2), macdSignal: +tech.macdSignal.toFixed(2), ema20: +tech.ema20.toFixed(2), ema50: +tech.ema50.toFixed(2), ema200: +tech.ema200.toFixed(2),
        ma50Type: 'EMA', ma200Type: 'EMA', ma50Available: true, ma200Available: true, atr14: +tech.atr14.toFixed(2),
        badges: ['Sous les moyennes à vingt et cinquante séances, sur celle à deux cents', fr(Math.abs(fromHi), 0) + ' % sous le sommet du 13 mai', 'ATR de ' + fr(tech.atr14 / close * 100, 1) + ' % du cours'],
        supports: [lv('s1'), lv('s2'), lv('s3')], resistances: [lv('r1'), lv('r2'), lv('r3')],
        setupNote: 'Le titre clôture à ' + usd(close) + ', collé à sa moyenne à deux cents séances, ' + usd(tech.ema200) + ', sous celles à vingt et cinquante séances. Aucun ordre : les niveaux archivés, entrée à ' + usd(entry) + ' et stop à ' + usd(stop) + ', restent inactifs. Repères actuels, sans ordre : supports à ' + usd(lv('s1')) + ', ' + usd(lv('s2')) + ' et ' + usd(lv('s3')) + ', résistances à ' + usd(lv('r1')) + ', ' + usd(lv('r2')) + ' et ' + usd(lv('r3')) + '.',
        wyckoff: 'Non utilisé : le profil de volume n’est pas exploité dans ce dossier.',
        sourceRefs: [market('barres quotidiennes et indicateurs recalculés')] },
      options: { callOI: 'Non exploitable', putOI: 'Non exploitable', cpRatio: 'Non exploitable', maxPain: 'Non exploitable', ivMean: 'Non exploitable', skew: 'Chaîne relevée en séance le 24 septembre, non rattachée à la clôture de référence', unusual: 'Aucune activité inhabituelle qualifiée', sourceRefs: [market('options')] },
      shortInterest: { siPct: fr(st.shortPercentOfFloat * 100, 2) + ' % du flottant', daysToCover: fr(st.shortRatio, 2) + ' jours, date de règlement non précisée par la source', ctb: 'Coût d’emprunt non disponible à la collecte', trend: 'Positions vendeuses élevées, cohérentes avec un programme d’émission ouvert ; aucune thèse de rachat forcé.', squeezeScore: 'Non retenu comme thèse', sourceRefs: [market('positions vendeuses')] },
      insiders: { signal: 'Le directeur financier Stefan Murry a vendu 4 000 actions à 105,33 $ le 10 septembre ; un autre dirigeant, Hung-Lun Chang, 32 172 actions à 110,21 $ le 8 septembre, selon leurs formulaires 4. Aucun achat relevé. Couverture officielle partielle : aucun solde net publié.',
        recentTransactions: [],
        sourceRefs: [market('formulaires 4')] },
      macro: { indicators: [{ name: 'Clôture de référence', value: c.REF, signal: usd(close) + ', séance complète' }, { name: 'Rendement cinq séances', value: sgn(ret(5)), signal: 'Descriptif' }, { name: 'Rendement vingt et une séances', value: sgn(ret(21)), signal: 'Descriptif' }],
        regime: 'neutral', impact: 'AAOI dépend des budgets optiques des grands clouds et des câblo-opérateurs. Une partie de sa production est en Chine et à Taïwan : droits de douane et restrictions commerciales touchent ses coûts, d’où les usines en construction au Texas.' },
      risks: { riskScore: 8, riskProfile: 'Very High',
        riskSummary: 'Le premier risque est la dilution : 7,8 millions d’actions vendues au semestre et un programme de 600 M$ ouvert, qui peut vendre à chaque hausse. Le deuxième, la trésorerie : un flux opérationnel négatif et des usines à financer. Le troisième, la concentration : deux clients font plus de 80 % des revenus, et un ATR de ' + fr(tech.atr14 / close * 100, 1) + ' % du cours rend chaque publication brutale.',
        riskCards: [
          { title: 'Émission d’actions en continu', severity: 'critical', icon: 'fa-money-bill-trend-up', points: ['Programme de 600 M$ ouvert le 21 août.', '1,05 Md$ d’actions vendues au premier semestre.'], verdict: 'Tant que ce programme est ouvert, la société est vendeuse de son propre titre : aucun ordre.' },
          { title: 'Trésorerie consommée', severity: 'high', icon: 'fa-fire', points: ['Flux opérationnel de ' + fr(G$.ocf / 1e6, 0) + ' M$ sur douze mois.', '335,1 M$ d’investissements au semestre.'], verdict: 'La croissance consomme plus de trésorerie qu’elle n’en produit ; le financement vient des actionnaires.' },
          { title: 'Concentration des clients', severity: 'high', icon: 'fa-building', points: ['Digicomm à 53,1 % des revenus 2025.', 'Microsoft à 28,8 %.'], verdict: 'Un report de commande d’un seul de ces deux clients se lit immédiatement sur les revenus du trimestre.' },
          { title: 'Écarts d’ouverture', severity: 'high', icon: 'fa-arrows-up-down', points: ['Gap de ' + sgn(pct(d0824[1], p0824[4]), 1) + ' le 24 août.', 'Gap de ' + sgn(pct(d0914[1], p0914[4]), 1) + ' le 14 septembre.'], verdict: 'Un stop peut être franchi d’un coup à l’ouverture : la perte réelle dépasse souvent la perte prévue sur ce titre.' }],
        pedagogy: 'Le 24 août montre ce qu’un programme d’émission fait à un cours : annoncé un vendredi, il se lit le lundi par un gap de ' + sgn(pct(d0824[1], p0824[4]), 1) + '. Le gap, c’est l’écart entre la clôture de la veille et l’ouverture ; le slippage, l’écart dans une séance normale, reste modéré avec environ ' + fr(adv / 1e6, 0) + ' M$ échangés par séance. Sur ce titre, la taille d’une éventuelle position devrait supposer à la fois une ouverture défavorable et des ventes d’actions de la société.' },
      tradeIdea: { status: 'no-trade', archiveReferenceClose: archive.meta.levelsCloseDate,
        statusNote: 'Aucun ordre actif. Niveaux historiques du plan du 27 août (entrée ' + usd(entry) + ', stop ' + usd(stop) + ', TP1 ' + usd(tp1) + ', TP2 ' + usd(tp2) + '), conservés à l’identique et inactifs : non exécutables. Vérifié sur les barres certifiées : depuis le 28 août, le plus haut est de ' + usd(maxHi) + ' le ' + c.dfr(maxD) + ', sous l’entrée ; le plan n’a jamais été activé, quel que soit son déclencheur en séance, et aucun stop ni objectif n’a compté. Le motif de l’absence d’ordre : le programme d’émission de 600 M$ ouvert le 21 août et un flux opérationnel négatif. Depuis la clôture du 18 septembre, le titre a fait ' + sgn(sinceArchive, 1) + '.',
        entry, stop, tp1, tp2,
        stopPct: pct(stop, entry).toFixed(1) + '%', tp1Pct: '+' + pct(tp1, entry).toFixed(1) + '%', tp2Pct: '+' + pct(tp2, entry).toFixed(1) + '%',
        rr: '1:' + rr1.toFixed(2) + ' TP1 / 1:' + rr2.toFixed(2) + ' TP2',
        entryNote: 'Aucune entrée. Les niveaux affichés sont ceux du plan du 27 août, archivés, jamais activés et sans valeur d’exécution. Conditions de réexamen, sans ordre : une publication de la société montrant l’arrêt ou l’épuisement du programme d’émission, un flux opérationnel redevenu positif, puis une nouvelle structure de prix au-dessus de ' + usd(lv('r2')) + ', le plus haut du 8 septembre. Liquidité : environ ' + fr(adv / 1e6, 0) + ' M$ échangés par séance, médiane des vingt dernières ; ATR de ' + usd(tech.atr14) + '.',
        horizon: 'Aucun horizon : pas de position',
        thesis: 'La demande d’optique est réelle et la prévision le montre. Mais une société qui vend ses actions à chaque hausse transfère la croissance de ses actionnaires existants vers les nouveaux. Ne pas anticiper un rebond, ne pas acheter une cassure tant que le programme de 600 M$ reste ouvert. Le dossier sera repris sur une preuve de financement terminé, pas sur un mouvement de cours.',
        catalysts: ['Un dépôt indiquant les ventes réalisées sous le programme de 600 M$, ou sa clôture.', 'La publication du troisième trimestre, attendue le 5 novembre selon un seul calendrier, face à la prévision de 255 à 290 M$.', 'Toute commande nommée d’un grand cloud pour les modules à 1,6 térabit.'],
        invalidation: ['Les niveaux archivés sont informatifs seulement : aucun transfert vers une exécution actuelle.', 'Toute nouvelle émission d’actions, convertible ou bon de souscription prolonge le statut sans ordre.', 'Un gap, un spread excessif ou une publication proche interdit toute tentative d’exécution tirée de cette archive.'] },
      globalScore: { profile: 'Croissance optique réelle, financée par les actionnaires',
        keyTakeawaysPositive: ['Revenus +86 % au deuxième trimestre.', 'Prévision de 255 à 290 M$.', 'Demande supérieure aux capacités, selon la direction.'],
        keyTakeawaysNegative: ['Programme d’émission de 600 M$ ouvert.', 'Flux opérationnel négatif.', 'Deux clients à plus de 80 % des revenus.'],
        mindsetTip: 'Une belle croissance ne suffit pas quand elle se paie en actions nouvelles. Regarder le nombre d’actions avant le chiffre d’affaires évite d’acheter la dilution des autres.' },
      social: { platforms: [], sourceRefs: [market('sentiment non retenu faute de mesure qualifiée')] },
      disclaimer: 'Document de recherche éducatif. Ni conseil financier, ni signal de trading. Statut sans ordre : aucun ordre actif.',
    };
  },
  groups: [
    { name: 'Référence de l’optique', order: 1, transmission: 'Le premier fabricant américain de lasers et de modules optiques, titre coté qui co-évolue le plus avec AAOI depuis fin mars.', rows: [
      ['LITE', 'leader', 'Lasers et modules optiques des centres de données', 'Corrélation la plus forte avec AAOI depuis fin mars ; ses commandes de modules se lisent directement sur le même marché.']] },
    { name: 'Pairs directs : modules et composants optiques', order: 1, transmission: 'Mêmes clients, mêmes générations de modules à 800 gigabits et 1,6 térabit.', rows: [
      ['COHR', 'direct_peer', 'Modules optiques et lasers industriels', 'Concurrent direct sur les modules des centres de données, avec une échelle bien supérieure.'],
      ['CIEN', 'direct_peer', 'Réseaux optiques des opérateurs', 'Concurrent sur les liaisons optiques entre centres de données ; repère de multiple rentable.'],
      ['VIAV', 'direct_peer', 'Test et composants optiques', 'Même cycle d’investissement optique ; ses équipements de test suivent les montées en cadence.'],
      ['CRDO', 'direct_peer', 'Puces de connectivité des centres de données', 'Concurrent sur les câbles et les puces de connectivité à haut débit.'],
      ['MRVL', 'direct_peer', 'Puces de traitement optique', 'Fournit les puces des modules optiques ; ses ventes suivent les mêmes volumes.']] },
    { name: 'Amont : matériaux et substrats', order: 1, transmission: 'Les lasers et les fibres consomment des substrats et du verre dont la disponibilité fixe les volumes.', rows: [
      ['AXTI', 'upstream', 'Substrats de phosphure d’indium', 'Fournisseur de substrats pour lasers ; ses capacités limitent la production de toute la filière.'],
      ['GLW', 'upstream', 'Fibre optique et verre', 'Fibre et connectique des centres de données ; ses volumes confirment la demande optique.']] },
    { name: 'Client documenté et aval', order: 1, transmission: 'Les grands clouds achètent les modules d’AAOI ; leurs investissements font ses revenus.', rows: [
      ['MSFT', 'downstream', 'Client documenté, 28,8 % des revenus 2025', 'Premier client des centres de données ; ses investissements dans l’IA décident du volume de modules commandés.'],
      ['AMZN', 'downstream', 'Client porteur d’un bon de souscription', 'Détient un bon de souscription lié à 4 Md$ d’achats : ses commandes acquièrent les tranches du bon.'],
      ['META', 'downstream', 'Grand acheteur de modules optiques', 'Grand cloud dont les investissements tirent la demande de modules, sans lien commercial documenté avec AAOI.'],
      ['NVDA', 'downstream', 'Processeurs d’IA et réseaux associés', 'Ses grappes d’IA fixent le nombre de liaisons optiques par serveur.']] },
    { name: 'Second ordre : réseau', order: 2, transmission: 'Les commutateurs des centres de données consomment les modules optiques.', rows: [
      ['ANET', 'second_order', 'Commutateurs des centres de données', 'Ses ventes de commutateurs se traduisent en ports optiques à équiper.'],
      ['CSCO', 'second_order', 'Réseau d’entreprise et des opérateurs', 'Même cycle d’équipement réseau ; sert de repère large du marché.']] },
    { name: 'Contrôles sectoriels', order: 2, transmission: 'Paniers de référence pour isoler ce qui est propre à AAOI.', rows: [
      ['SMH', 'sector_proxy', 'Panier de semi-conducteurs', 'Contrôle du secteur : un écart avec ce panier isole ce qui est propre à AAOI.'],
      ['SOXX', 'sector_proxy', 'Second panier de semi-conducteurs', 'Contrôle plus large : confirme ou infirme la lecture tirée de SMH.'],
      ['QQQ', 'sector_proxy', 'Grandes valeurs du Nasdaq', 'Contrôle large : un mouvement commun avec ce panier n’a rien de spécifique au titre.'],
      ['SPY', 'sector_proxy', 'Marché américain large', 'Contrôle du marché dans son ensemble : un mouvement commun avec cet indice ne dit rien de propre à AAOI.']] },
  ],
  eventDefault: { leader: 'Aucune publication dans les quatorze jours collectés ; ses commandes de modules restent le signal à suivre', direct_peer: 'Aucune publication dans les quatorze jours collectés ; ses prix et ses volumes sont à suivre', upstream: 'Aucune publication dans les quatorze jours collectés ; ses capacités sont à suivre', downstream: 'Aucune publication dans les quatorze jours collectés ; ses investissements sont à suivre', second_order: 'Aucune publication dans les quatorze jours collectés ; ses commandes sont à suivre', sector_proxy: 'Panier sans publication propre ; exposé aux résultats de ses grandes pondérations' },
  eventRisk: {},
  blastDoc: 2,
  scenarios: c => [
    { scenario: 'bullish', trigger: 'La société annonce la fin du programme d’émission et confirme sa prévision.', firstOrder: 'Le titre reprend sa moyenne à cinquante séances.', secondOrder: 'Lumentum et Coherent suivent ; le secteur optique confirme.', confirmation: 'Une clôture au-dessus de ' + c.usd(c.lv('r2')) + ' après un dépôt sur le financement.', contradiction: 'Une hausse sans dépôt, qui laisserait la société vendre dans le mouvement.' },
    { scenario: 'mixed', trigger: 'Pas de nouvelle sur le programme ni sur les commandes.', firstOrder: 'Le titre oscille autour de sa moyenne à deux cents séances.', secondOrder: 'L’écart avec Lumentum reste faible, sans information propre.', confirmation: 'Des clôtures entre ' + c.usd(c.lv('s3')) + ' et ' + c.usd(c.lv('r1')) + ' pendant plusieurs séances.', contradiction: 'Une sortie franche d’un côté ou de l’autre.' },
    { scenario: 'bearish', trigger: 'Ventes d’actions publiées sous le programme, ou report de commande d’un grand client.', firstOrder: 'Le titre casse le plus bas du 16 septembre.', secondOrder: 'Les pairs optiques ne suivent pas : la baisse reste propre à AAOI.', confirmation: 'Une clôture sous ' + c.usd(c.lv('s3')) + ' avec Lumentum stable.', contradiction: 'Un repli d’AAOI entraîné par tout le secteur, sans nouvelle propre.' }],
  contradictions: c => ['La direction dit la demande supérieure aux capacités, mais finance ces capacités en vendant des actions plutôt qu’avec ses flux : la croissance n’autofinance pas encore l’entreprise.', 'Microsoft est le premier client des centres de données, mais sa corrélation avec AAOI est proche de zéro depuis fin mars : le lien commercial ne passe pas par le cours.'],
  missingData: c => ['Ventes réalisées sous le programme de 600 M$ depuis le 21 août non publiées.', 'Digicomm, premier client, non coté ; part de Microsoft publiée pour 2025 seulement.', 'Investissements sur douze mois non reconstituables en XBRL au 30 juin ; chiffre du semestre lu dans le 10-Q.', 'Chaîne d’options relevée en séance, non rattachée à la clôture ; sentiment non retenu ; barres d’une source de repli.'],
  limitations: ['Barres d’une source de repli (Webull).', 'Options non rattachées à la clôture de référence.', 'Convertibles 2030 comptés en actions, hors dette ; tranche acquise du bon d’Amazon ajoutée sans produit d’exercice.'],
});
