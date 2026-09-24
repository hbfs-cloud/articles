'use strict';
// Dossier NVDA v3 au close du 2026-09-23. Écrit le JSON canonique, le sidecar de preuves, les
// artefacts de calcul et un aperçu LOCAL. Ne touche ni analyses/NVDA/index.html ni l'index du site.
const K = require('../../../../tools/lib/analysis-v3-kit.cjs');
const { sha, bytes, read, write, esc, get, fr, usd, pct, sgn, findPath, at, frDate } = K;
const T = 'NVDA', REF = '2026-09-23';
const run = 'analyses/NVDA/_runs/20260924', data = run + '/_data', rev = run + '/revision', prim = 'analyses/NVDA/_primary';
const OUT_JSON = 'data/analyses-data/NVDA.json', OUT_EVIDENCE = 'data/analyses-evidence/NVDA.json', GEN = run + '/build-nvda.cjs';

// ---------------------------------------------------------------- données collectées
const raw = K.loadRun(data, ['comparison_context', 'bars', 'fundamentals', 'comparison_bars', 'rank_beta', 'status', 'insiders', 'short_squeeze', 'comparison_earnings', 'vwap', 'options', 'sec_evidence']);
const S = K.mainSeries(raw.bars, T, REF), { bars, N, B, idx, close, prev } = S;
const tech = K.technicals(bars);
const STP = findPath(raw.fundamentals, 'instrument_comprehensive_stats'), st = at(raw.fundamentals, STP);
const TXP = findPath(raw.insiders, 'instrument_insider_transactions'), tx = at(raw.insiders, TXP);
const SIP = findPath(raw.short_squeeze, 'instrument_short_interest_series'), si = at(raw.short_squeeze, SIP), siLast = si.points.length - 1, siPt = si.points[siLast];
const cmpRows = raw.comparison_bars.data.items[0].results[0].data;
const C = t => { const i = cmpRows.findIndex(x => x.symbol === t); if (i < 0) throw Error('comparable absent ' + t); return '/data/items/0/results/0/data/' + i + '/bars'; };
const { M, firstCommon } = K.comparables(cmpRows, bars);
const adv = K.dollarAdv(bars), ret = k => pct(close, bars[N - k][4]);
const archive = read(run + '/original/NVDA.json');

// Ventes d'initiés (formulaires 4, code S) relevées dans la fenêtre collectée.
const sells = tx.transactions.filter(x => x.type_code === 'S');
const byInsider = {};
for (const x of sells) { const k = x.insider_name; byInsider[k] = byInsider[k] || { title: x.insider_title, shares: 0, value: 0, first: x.date_transaction, last: x.date_transaction }; const b = byInsider[k]; b.shares += x.shares; b.value += x.shares * x.price; if (x.date_transaction < b.first) b.first = x.date_transaction; if (x.date_transaction > b.last) b.last = x.date_transaction; }
const stevens = byInsider['STEVENS MARK A'], kress = byInsider['Kress Colette'], teter = byInsider['Teter Timothy S.'];

// GAAP douze mois glissants au 26/07/2026 = exercice 2026 (10-K) − S1 FY26 + S1 FY27 (10-Q), en millions.
const K10 = { rev: [215938, 90805, 177837], ebit: [130387, 50078, 117270], da: [2843, 1280, 2124], ni: [120067, 45197, 118010] };
const ttm = k => K10[k][0] - K10[k][1] + K10[k][2];
const BAL = { cash: 22443, mktDebt: 34143, mktEquity: 42783, stDebt: 1000, ltDebt: 32366, lease: 4985, gainsH1: 23707 };
const CF = { ocfH1: 74421, capexH1: 4434, debtIssued: 24896, returnedQ2: 26.0, buybackLeft: 99.0 };
const G$ = { rev: ttm('rev') * 1e6, ebit: ttm('ebit') * 1e6, ebitda: (ttm('ebit') + ttm('da')) * 1e6, ni: ttm('ni') * 1e6,
  debt: (BAL.stDebt + BAL.ltDebt + BAL.lease) * 1e6, cash: (BAL.cash + BAL.mktDebt) * 1e6, fcfH1: (CF.ocfH1 - CF.capexH1) * 1e6 };
const shares = st.sharesOutstanding, marketCap = close * shares, ev = marketCap + G$.debt - G$.cash;
const SCN = 20; // hypothèse éditoriale : EV/EBITDA ramené à vingt fois
const scn = { multiple: SCN, ebitda: G$.ebitda, debt: G$.debt, cash: G$.cash, shares, close };
scn.enterprise_value = scn.multiple * scn.ebitda; scn.equity_value = scn.enterprise_value - scn.debt + scn.cash; scn.price = scn.equity_value / scn.shares; scn.downside_pct = (scn.price / close - 1) * 100;

// Niveaux : lus sur des barres certifiées, par date. Structure réelle : base 190–236 $ depuis mai (plus bas
// du 29 juin), fourchette août-septembre entre le bas du 24 août et le haut du 4 septembre. Objectifs :
// hauteur de cette fourchette d'août-septembre projetée au-dessus du déclencheur.
const L = { trigger: { d: '2026-05-14', c: 2 }, stop: { d: '2026-09-21', c: 2 }, abandon: { d: '2026-09-14', c: 3 },
  s1: { d: '2026-09-23', c: 3 }, s2: { d: '2026-09-17', c: 3 }, r1: { d: '2026-09-22', c: 2 }, r2: { d: '2026-09-04', c: 2 },
  augLow: { d: '2026-08-24', c: 3 }, baseLow: { d: '2026-06-29', c: 3 },
  prevEntry: { d: '2026-09-03', c: 4 }, prevStop: { d: '2026-09-09', c: 4 } };
const lv = k => bars[idx(L[k].d)][L[k].c], lvPtr = k => `${B}/${idx(L[k].d)}/${L[k].c}`;
const entry = lv('trigger'), stop = lv('stop'), abandon = lv('abandon'), range = lv('r2') - lv('augLow'), baseLow = lv('baseLow');
const tp1 = +(entry + range / 2).toFixed(2), tp2 = +(entry + range).toFixed(2);
const rr1 = (tp1 - entry) / (entry - stop), rr2 = (tp2 - entry) / (entry - stop);
const RR_MIN = 1.5, cap = Math.floor((tp1 + RR_MIN * stop) / (1 + RR_MIN) * 100) / 100, capRr = (tp1 - cap) / (cap - stop);
const sizeExample = Math.floor(100 / (entry - stop));
const X = K.execStats(bars, entry, cap, tech.atr14), stopAtr = (entry - stop) / tech.atr14;
const closesBelow = bars.filter(b => b[0] >= '2026-05-14' && b[4] < abandon).length;
const after26 = t => t === T ? pct(close, bars[idx('2026-08-26')][4]) : pct(cmpRows.find(x => x.symbol === t).bars.at(-1)[4], cmpRows.find(x => x.symbol === t).bars.find(b => b[0] === '2026-08-26')[4]);
const since26 = { NVDA: after26('NVDA'), SMH: after26('SMH'), SOXX: after26('SOXX') };
const ctxRows = (() => { const out = {}; (function f(o, q) { if (o && typeof o === 'object') { if (o.type === 'instrument_comprehensive_stats' && o.symbol) out[o.symbol] = { v: o.enterpriseToEbitda, ptr: q + '/enterpriseToEbitda' }; for (const [k, v] of Object.entries(o)) f(v, q + '/' + esc(k)); } })(raw.comparison_context, ''); return out; })();
const peerEv = { MSFT: ctxRows.MSFT.v, GOOGL: ctxRows.GOOGL.v };

// ---------------------------------------------------------------- sources primaires
const EDGAR = 'https://www.sec.gov/Archives/edgar/data/1045810/';
const docs = [
  ['2026-08-26', '8-K / Exhibit 99.1', '0001045810-26-000073', 'q2fy27pr.htm', 'q2fy27-ex991.htm',
    'Communiqué du deuxième trimestre de l’exercice 2027 : chiffre d’affaires de 96,2 Md$, en hausse de 106 %, centres de données 89,0 Md$ (+117 %), marge brute de 75,0 %, bénéfice par action GAAP de 2,46 $ et ajusté de 2,22 $. Prévision du troisième trimestre à 108,0 Md$ à plus ou moins 2 %, sans revenu de calcul en Chine.'],
  ['2026-08-26', '10-Q', '0001045810-26-000075', 'nvda-20260726.htm', 'q2fy27-10q.htm',
    'Rapport trimestriel : dette à long terme portée de 7,5 à 32,4 Md$ en six mois, un client direct à 16 % du chiffre d’affaires du trimestre, cinq clients directs à 70 % des créances, 23,7 Md$ de plus-values sur titres de participation au semestre, et des garanties plafonnées à 105 Md$ en soutien d’un affilié d’OpenAI.'],
  ['2026-08-17', '8-K', '0001045810-26-000069', 'nvda-20260817.htm', 'aug17-8k.htm',
    'Partenariat avec SB Energy sur le campus PORTS dans l’Ohio : garanties de valeur résiduelle sur des baux d’environ 4,25 GW, plafonnées à 105 Md$ pour l’engagement initial, au bénéfice d’un affilié d’OpenAI locataire, avec une option de soutien sur 3,8 GW supplémentaires.'],
  ['2026-09-03', '8-K', '0001045810-26-000078', 'nvda-20260902.htm', 'sep03-8k.htm',
    'Accord définitif d’acquisition de Hugging Face pour environ 11,9 Md$ payés aux actionnaires, plus un programme de rétention en actions jusqu’à 1,0 Md$ ; clôture attendue au premier semestre 2027 sous réserve des autorisations réglementaires.'],
  ['2026-06-17', '424B5', '0001193125-26-273139', 'd118718d424b5.htm', 'jun17-424b5.htm',
    'Supplément de prospectus d’une émission obligataire de 25 Md$ en sept tranches, de 2028 à 2056, à des coupons de 4,25 % à 5,625 %. C’est de la dette senior non garantie : elle ne dilue pas les actionnaires, mais elle change la structure du bilan.'],
  ['2026-08-26', '8-K / Exhibit 99.2', '0001045810-26-000073', 'q2fy27cfocommentary.htm', 'q2fy27-ex992.htm',
    'Commentaire du directeur financier : revenus des grands clouds de 48,7 Md$ et des clouds d’IA, industriels et entreprises de 40,3 Md$ ; engagements d’achat, surtout en mémoire, portés de 119 à 279 Md$ en un trimestre, et baux de centres de données jusqu’à vingt ans.'],
  ['2026-02-25', '10-K', '0001045810-26-000021', 'nvda-20260125.htm', 'fy26-10k.htm',
    'Rapport annuel de l’exercice clos le 25 janvier 2026 : chiffre d’affaires de 215,9 Md$, résultat opérationnel de 130,4 Md$, résultat net de 120,1 Md$ et amortissements de 2,8 Md$, base des agrégats sur douze mois glissants.'],
].map(([date, form, accession, file, local, finding]) => ({ date, form, accession, url: `${EDGAR}${accession.replace(/-/g, '')}/${file}`, finding, path: `${prim}/${local}`, sha256: sha(bytes(`${prim}/${local}`)) }));
const needle = (id, i, needles) => { const text = bytes(docs[i].path).toString('utf8'); for (const n of needles) if (!text.includes(n)) throw Error(`needle absent ${id}: ${n}`); return [id, { source_path: docs[i].path, source_sha256: docs[i].sha256, source_needles: needles }]; };
const primary = { kind: 'primary_sec_manifest_v1', ticker: T, as_of: '2026-09-24', inventory_count: 22, inventory_screened_count: 22, opened_count: 7, reviewed_count: 7, decision_relevant_count: 7, local_primary_count: docs.length,
  review_scope: 'Dépôts EDGAR de NVIDIA du 1er février au 23 septembre 2026, formulaires 144 et de détention exclus du détail. Le 10-K de l’exercice 2026 a été ouvert pour les agrégats annuels ; les 8-K de gouvernance (items 5.02 et 5.07) sont écartés comme non décisionnels.',
  documents: docs,
  semantic_findings: Object.fromEntries([
    needle('q2_results', 0, ['$96.2 billion', '$89.0 billion', '75.0%', '$2.46', '$2.22', '$108.0 billion']),
    needle('debt', 1, ['32,366', '7,469', '$33.5 billion aggregate principal amount of senior notes']),
    needle('concentration', 1, ['one direct customer represented 16', 'Five direct customers accounted for']),
    needle('equity_gains', 1, ['Gains from equity securities, net', '23,707', '3,954']),
    needle('guarantees', 1, ['capped at a total of $', 'GuaranteeObligationsMaximumExposure', 'OpenAI Group PBC']),
    needle('ports', 2, ['4.25 gigawatts', '$105 billion', '3.8 gigawatts']),
    needle('hugging_face', 3, ['$11.9 billion', '$1.0 billion']),
    needle('notes', 4, ['$25,000,000,000', '5.625% Notes due 2056']),
    needle('commitments', 5, ['from $119 billion last quarter to $279 billion', '48,710']),
    needle('fy26', 6, ['215,938', '130,387', '120,067', '2,843']),
  ].map(([k, v]) => [k, v])) };
write(rev + '/primary-manifest.json', primary);
const ref = i => ({ name: 'NVIDIA ' + docs[i].form, url: docs[i].url, date: docs[i].date });
const market = name => ({ name: 'Données de marché datées (provenance hashée) : ' + name, url: K.evidenceUrl(T), date: '2026-09-24' });

// ---------------------------------------------------------------- le dossier
const score = { business: 30, technical: 4, capital: -4, calendar: 0, dilution: -2, risk: 36 };
const scoreValue = Object.values(score).reduce((a, b) => a + b, 0);
const peersMedian21 = (() => { const v = ['AMD', 'AVGO', 'MRVL', 'INTC', 'ARM'].map(t => M[t].return21d).sort((a, b) => a - b); return v[2]; })();
const a = {
  meta: { lang: 'fr', dir: 'ltr', level: 'intermediate', tags: ['us', 'equities', 'ai-chain', 'semis', 'technology'], grade: 'B+', date: '2026-09-24', dateDisplay: '24 septembre 2026', version: 3, status: 'watch', assetType: 'stock', levelsCloseDate: REF,
    description: 'NVIDIA : un chiffre d’affaires qui double, un cours coincé sous 236 $ depuis mai. Dossier au close du 23 septembre 2026, statut surveiller.',
    ogDescription: 'NVIDIA : croissance record, engagements hors bilan et un cours plafonné sous son record de mai ; niveaux à surveiller.',
    lastMcpRefresh: raw.status.captured_at, levelsVerifiedAt: raw.status.captured_at,
    statusHistory: [...archive.meta.statusHistory, { at: raw.status.captured_at, from: 'stopped', to: 'watch', note: 'refonte v3 du 24 septembre : nouveau scénario, clôture de référence du 2026-09-23', close }],
    lastEvent: archive.meta.lastEvent },
  header: { ticker: T, name: 'NVIDIA Corporation', exchange: 'NASDAQ', sector: 'Semi-conducteurs et plateformes de calcul pour l’IA', price: close, changePct: pct(close, prev),
    badges: [{ text: 'SURVEILLER — PAS D’ENTRÉE AU COURS ACTUEL', color: 'blue' }, { text: 'Chaîne IA — calcul accéléré', color: 'purple' }],
    metrics: { marketCap: fr(marketCap / 1e12, 2) + ' T$', volume: fr(bars[N][5] / 1e6, 1) + ' M', evEbitda: fr(ev / G$.ebitda, 1) + '×' }, halalStatus: 'unknown' },
  verdict: { score: scoreValue, conviction: 'Moderate', bias: 'Neutral',
    confidence: 'Score éditorial non prédictif. Les chiffres d’entreprise viennent des dépôts SEC du trimestre ; les niveaux, du close certifié du 23 septembre.',
    summary: 'NVIDIA a doublé son chiffre d’affaires en un an et guide encore plus haut, mais son cours bute depuis mai sous 236 $ : il est descendu jusqu’à ' + usd(baseLow) + ' le 29 juin, et oscille depuis le 4 août entre 207 et 235 $. Le marché ne doute pas de la demande ; il regarde ce qu’elle coûte à tenir. En un trimestre, les engagements d’achat sont passés de 119 à 279 Md$ ; en six mois, la dette à long terme a quadruplé ; et la société s’est portée garante, jusqu’à 105 Md$, des loyers d’un centre de données loué par un affilié d’OpenAI. Une partie du bénéfice publié vient de plus-values sur participations, pas de la vente de puces. Depuis la clôture du 26 août, veille de la réaction aux résultats, le titre a pris ' + sgn(since26.NVDA, 1) + ', contre ' + sgn(since26.SMH, 1) + ' pour SMH et ' + sgn(since26.SOXX, 1) + ' pour SOXX : un retard mince, mais un retard. Pas d’entrée au cours actuel : le signal utile serait une clôture au-dessus du record du 14 mai ; une clôture sous le bas du 14 septembre ferait abandonner le scénario.',
    whyBuy: [
      'Le chiffre d’affaires du trimestre atteint 96,2 Md$, en hausse de 106 %, et les centres de données 89,0 Md$ (+117 %) : la croissance est dans les comptes.',
      'La prévision du troisième trimestre, 108,0 Md$ à plus ou moins 2 %, suppose encore 12 % de croissance séquentielle, sans aucun revenu de calcul en Chine.',
      'La marge brute tient à 75,0 % malgré la montée en cadence de nouvelles plateformes : le pouvoir de prix reste intact.',
      'La société a rendu 26,0 Md$ aux actionnaires au trimestre et garde 99,0 Md$ d’autorisation de rachat : le capital n’est pas dilué.'],
    whyAvoid: [
      'Au close du 23 septembre, la valeur d’entreprise représente ' + fr(ev / G$.ebitda, 1) + ' fois l’EBITDA GAAP des douze mois clos le 26 juillet : la valorisation suppose que la croissance dure.',
      'Les engagements d’achat, surtout en mémoire, sont passés de 119 à 279 Md$ en un trimestre : un ralentissement de la demande laisserait ces achats à payer.',
      'Le résultat net du semestre inclut 23,7 Md$ de plus-values sur titres de participation : le bénéfice publié flatte le métier de base.',
      'Un seul client direct pèse 16 % du chiffre d’affaires du trimestre et cinq concentrent 70 % des créances : la demande repose sur peu d’acheteurs.'],
    controlChecklist: [
      { label: 'Historique de cours', status: 'pass', statusLabel: 'Trois cents séances continues', evidence: 'Série quotidienne certifiée au close du 23 septembre, source de repli documentée.', action: 'Niveaux et indicateurs recalculés sur cette seule série.' },
      { label: 'Engagements hors bilan', status: 'warn', statusLabel: 'En forte hausse', evidence: 'Garanties plafonnées à 105 Md$ et engagements d’achat portés à 279 Md$.', action: 'Relire chaque nouveau dépôt avant toute entrée.' },
      { label: 'Calendrier', status: 'warn', statusLabel: 'Prochains résultats non confirmés', evidence: 'Aucune date publiée par NVIDIA. Micron (30 septembre) et la journée investisseurs de Marvell (6 octobre) tombent dans l’horizon ; la date de Micron vient de deux calendriers de données, pas de Micron.', action: 'Compter avec un gap possible sur NVIDIA le 1er octobre au matin.' }] },
  business: { theme: 'Calcul accéléré et réseaux pour les centres de données d’IA',
    overview: '<p>NVIDIA vend des plateformes de calcul complètes pour l’intelligence artificielle : processeurs graphiques, processeurs centraux, réseau et logiciels, livrés de plus en plus sous forme de baies entières. Les centres de données ont pesé 89,0 Md$ sur les 96,2 Md$ du trimestre clos le 26 juillet 2026.</p><p>La demande vient de deux familles de clients. Les grands clouds, 48,7 Md$ au trimestre, en hausse de 102 %, et les « clouds d’IA », industriels et entreprises, 40,3 Md$, en hausse de 138 %. Ce second groupe progresse plus vite : laboratoires d’IA, néo-clouds et grands comptes. La base de clients s’élargit, mais le 10-Q montre qu’un seul client direct représente encore 16 % du chiffre d’affaires.</p><p>Ce qui inquiète se lit ailleurs, dans les engagements. Pour sécuriser la mémoire et les composants des prochaines années, les engagements d’achat sont passés de 119 à 279 Md$ en un trimestre. NVIDIA a aussi levé 25 Md$ d’obligations en juin, s’est portée garante jusqu’à 105 Md$ des loyers d’un campus de centres de données loué par un affilié d’OpenAI, et a signé le rachat de Hugging Face pour environ 11,9 Md$. La société finance de plus en plus la chaîne qui achète ses puces.</p>',
    moat: 'L’avantage de NVIDIA tient moins à une puce qu’à une plateforme : logiciels, réseau et baies intégrées que les clients ont appris à exploiter. Il est solide face aux concurrents directs, plus exposé aux puces maison des grands clouds et à la dépendance de quelques très gros acheteurs.',
    segments: [
      { name: 'Centres de données — grands clouds', revenue: '48,7 Md$ au trimestre', pct: '51 %', description: 'En hausse de 102 % sur un an.' },
      { name: 'Centres de données — clouds d’IA, industrie, entreprises', revenue: '40,3 Md$ au trimestre', pct: '42 %', description: 'En hausse de 138 % sur un an.' },
      { name: 'Calcul en périphérie (Edge)', revenue: '7,2 Md$ au trimestre', pct: '7 %', description: 'Jeux, stations de travail, automobile et robotique, en hausse de 27 %.' }],
    sourceRefs: [ref(0), ref(1)],
    coverageMatrix: [
      { facet: 'Cours et historique', status: 'COUVERT', decision: 'Trois cents séances continues, close certifié ; base des niveaux et des indicateurs.' },
      { facet: 'Résultats et guidance', status: 'COUVERT — PRIMAIRE', decision: 'Communiqué du 26 août et 10-Q ; prochaine date non confirmée.' },
      { facet: 'Capital, dette et engagements', status: 'COUVERT — PRIMAIRE', decision: 'Émission obligataire, garanties SB Energy et acquisition Hugging Face séparées.' },
      { facet: 'Comparables et transmission', status: 'COUVERT — LOCAL', decision: 'Corrélations recalculées sur barres certifiées depuis la fin mars.' },
      { facet: 'Initiés', status: 'PARTIEL', decision: 'Ventes relevées, couverture officielle incomplète : aucun solde net affirmé.' },
      { facet: 'Options', status: 'NON EXPLOITABLE', decision: 'Chaîne relevée marché fermé, sans intérêt ouvert utilisable.' },
      { facet: 'Sentiment et tendances de recherche', status: 'INDISPONIBLE', decision: 'Aucune mesure qualifiée ; non utilisé.' }] },
  news: [
    { date: '2026-08-26', title: 'Deuxième trimestre : 96,2 Md$ de chiffre d’affaires', impact: 'positive', detail: 'La croissance double sur un an et la prévision reste en hausse ; depuis la clôture du 26 août, le titre a pris ' + sgn(since26.NVDA, 1) + ', un peu moins que SMH (' + sgn(since26.SMH, 1) + ').', source: 'NVIDIA — SEC', sourceUrl: docs[0].url },
    { date: '2026-08-17', title: 'Garanties jusqu’à 105 Md$ pour un campus loué par OpenAI', impact: 'negative', detail: 'NVIDIA prend un risque de crédit sur un client en garantissant des loyers : si le locataire faiblit, la facture remonte vers le fournisseur de puces.', source: 'NVIDIA — SEC', sourceUrl: docs[2].url },
    { date: '2026-09-02', title: 'Rachat de Hugging Face pour environ 11,9 Md$', impact: 'neutral', detail: 'L’acquisition renforce l’écosystème logiciel ouvert autour des puces, pour un prix modeste à l’échelle du bilan, sous réserve des autorisations réglementaires.', source: 'NVIDIA — SEC', sourceUrl: docs[3].url },
    { date: '2026-06-17', title: 'Émission obligataire de 25 Md$', impact: 'neutral', detail: 'La société emprunte alors qu’elle dégage un flux de trésorerie massif : la dette finance les engagements et les rachats, sans diluer les actionnaires.', source: 'NVIDIA — SEC', sourceUrl: docs[4].url }],
  fundamentals: { rows: [
      { metric: 'Chiffre d’affaires du trimestre', value: '96,2 Md$', signal: '+106 % sur un an, communiqué du 26 août', signalColor: 'green' },
      { metric: 'Centres de données du trimestre', value: '89,0 Md$', signal: '+117 % sur un an', signalColor: 'green' },
      { metric: 'Marge brute du trimestre', value: '75,0 %', signal: 'GAAP et ajustée identiques', signalColor: 'green' },
      { metric: 'Prévision du troisième trimestre', value: '108,0 Md$', signal: 'Plus ou moins 2 %, sans calcul en Chine', signalColor: 'blue' },
      { metric: 'Flux opérationnel du semestre', value: fr(CF.ocfH1 / 1e3, 1) + ' Md$', signal: 'Six mois clos le 26 juillet, 10-Q', signalColor: 'green' },
      { metric: 'Flux de trésorerie libre du semestre', value: fr(G$.fcfH1 / 1e9, 1) + ' Md$', signal: 'Flux opérationnel − investissements en immobilisations, 10-Q', signalColor: 'green' },
      { metric: 'Plus-values sur titres du semestre', value: fr(BAL.gainsH1 / 1e3, 1) + ' Md$', signal: 'Incluses dans le résultat net GAAP', signalColor: 'amber' },
      { metric: 'Revenus GAAP sur douze mois', value: fr(G$.rev / 1e9, 1) + ' Md$', signal: 'Douze mois glissants au 26 juillet 2026 (10-K + 10-Q)', signalColor: 'blue' },
      { metric: 'EBITDA GAAP sur douze mois', value: fr(G$.ebitda / 1e9, 1) + ' Md$', signal: 'Résultat opérationnel + amortissements, douze mois au 26 juillet 2026', signalColor: 'blue' },
      { metric: 'Résultat net GAAP sur douze mois', value: fr(G$.ni / 1e9, 1) + ' Md$', signal: 'Douze mois glissants, plus-values sur titres comprises', signalColor: 'amber' },
      { metric: 'Dette au 26 juillet (emprunts + loyers)', value: fr(G$.debt / 1e9, 1) + ' Md$', signal: 'Dont 32,4 Md$ de dette à long terme, contre 7,5 Md$ six mois plus tôt, bilan du 10-Q', signalColor: 'amber' },
      { metric: 'Trésorerie et titres de dette au 26 juillet', value: fr(G$.cash / 1e9, 1) + ' Md$', signal: 'Hors 42,8 Md$ de participations cotées, bilan du 10-Q', signalColor: 'blue' },
      { metric: 'EV/EBITDA GAAP', value: fr(ev / G$.ebitda, 1) + '×', signal: 'Enterprise value au close du 2026-09-23 sur EBITDA GAAP douze mois au 2026-07-26', signalColor: 'amber', source: 'Clôture certifiée, 10-K et 10-Q', comparison: 'Versus le scénario de compression ci-dessous : l’écart mesure la prime accordée à la durée du cycle.' },
      { metric: 'EV/revenus GAAP', value: fr(ev / G$.rev, 1) + '×', signal: 'Enterprise value au close du 2026-09-23 sur revenus GAAP douze mois au 2026-07-26', signalColor: 'amber', source: 'Clôture certifiée, 10-K et 10-Q', comparison: 'Versus une croissance de 106 % : le multiple suppose que la croissance ralentisse sans s’arrêter.' },
      { metric: 'P/E GAAP sur douze mois', value: fr(marketCap / G$.ni, 1) + '×', signal: 'Trailing : capitalisation au 2026-09-23 sur résultat net GAAP douze mois au 2026-07-26', signalColor: 'blue', source: 'Clôture certifiée, 10-K et 10-Q', comparison: 'Versus EV/EBITDA : ce P/E est flatté par les plus-values sur participations, 23,7 Md$ sur le seul semestre ; le multiple du métier de base est plus élevé.' },
      { metric: 'EV/EBITDA — scénario de compression (hypothèse éditoriale)', value: fr(scn.price, 2) + ' $ par action', signal: 'Scénario : multiple ramené à vingt fois l’EBITDA GAAP par hypothèse, entre Microsoft (' + fr(peerEv.MSFT, 1) + '×) et Alphabet (' + fr(peerEv.GOOGL, 1) + '×) selon les statistiques relevées le 24 septembre, dette et trésorerie du 2026-07-26 inchangées, soit ' + fr(scn.downside_pct, 0) + ' % sous le close du 2026-09-23', signalColor: 'red', source: 'Clôture certifiée, 10-K et 10-Q', comparison: 'Versus le close : ce que coûterait une simple normalisation du multiple si la croissance ralentissait ; ce n’est pas un objectif.' }],
    sourceRefs: [ref(0), ref(1), market('fondamentaux et statistiques')] },
  earnings: { quarters: [],
    beatNote: 'Deuxième trimestre de l’exercice 2027 : bénéfice par action GAAP de 2,46 $ et ajusté de 2,22 $, marge brute de 75,0 %. La guidance du troisième trimestre vise 108,0 Md$ de revenus à plus ou moins 2 %, une marge brute de 74,0 % à plus ou moins 0,5 point et environ 9,0 Md$ de charges ajustées, sans revenu de calcul en Chine. L’écart entre le bénéfice GAAP et l’ajusté vient surtout des plus-values sur participations. Aucune date de prochaine publication n’est confirmée par l’émetteur à ce jour.',
    nextEarnings: 'Date non confirmée par l’émetteur ; aucune publication dans les quatorze jours du calendrier collecté.',
    sourceRefs: [ref(0)] },
  capitalStructure: { sharesOutstanding: fr(shares / 1e9, 2) + ' milliards d’actions au 21 août 2026 (page de garde du 10-Q)',
    sharesAuthorized: 'Actions autorisées non reprises : non décisionnel pour ce dossier.',
    dilutionRisk: 'low',
    shareHistory: 'Le nombre d’actions en circulation baisse : environ 24,15 milliards au 21 août 2026, sous l’effet des rachats (26,0 Md$ rendus aux actionnaires au trimestre, 99,0 Md$ d’autorisation restante). La rémunération en actions, 3,954 Md$ sur le semestre, dilue en sens inverse, mais moins vite que les rachats ne réduisent le capital. Aucune émission d’actions n’est relevée dans les dépôts de 2026 ; le financement récent passe par la dette, 25 Md$ d’obligations émises en juin, et par des engagements hors bilan. Un nombre d’actions entièrement dilué à date n’est pas calculable depuis ces seuls dépôts.',
    warrants: [],
    atm: { active: false, authorized: 'Aucun programme d’émission d’actions relevé', used: 'Sans objet', remaining: 'Sans objet' },
    sourceRefs: [ref(1), ref(4)] },
  filingsReview: { summary: 'Sept dépôts décisionnels ouverts et hachés, sur vingt-deux inventoriés. Ils séparent trois choses : les résultats, excellents ; le financement, qui passe par la dette et par des garanties plutôt que par des actions ; et l’exposition croissante de NVIDIA au crédit de ses propres clients.',
    filings: docs.map(d => ({ date: d.date, form: d.form, accession: d.accession, finding: d.finding, url: d.url })),
    contrarianRisks: [
      'La garantie de loyers au bénéfice d’un affilié d’OpenAI transforme un client en risque de crédit : NVIDIA paierait si le locataire ne le fait pas.',
      'Les engagements d’achat de 279 Md$ se paient même si la demande ralentit : c’est un levier opérationnel à la baisse.',
      'Le bénéfice publié inclut des plus-values sur participations, souvent dans des sociétés clientes : une baisse de leur valorisation se lirait directement dans le résultat.',
      'Un client direct à 16 % du chiffre d’affaires : une pause de commande d’un seul acheteur se verrait dans un trimestre.',
      'L’acquisition de Hugging Face reste soumise aux autorisations réglementaires, dans un contexte d’examen de la position dominante.'] },
  technicals: { rsi14: +tech.rsi14.toFixed(2), macd: +tech.macd.toFixed(2), macdSignal: +tech.macdSignal.toFixed(2), ema20: +tech.ema20.toFixed(2), ema50: +tech.ema50.toFixed(2), ema200: +tech.ema200.toFixed(2),
    ma50Type: 'EMA', ma200Type: 'EMA', ma50Available: true, ma200Available: true, atr14: +tech.atr14.toFixed(2),
    badges: ['Sous le record du 14 mai depuis quatre mois', 'Au-dessus des moyennes à vingt, cinquante et deux cents séances', 'Pas d’entrée au cours actuel'],
    supports: [lv('s1'), lv('s2'), abandon],
    resistances: [lv('r1'), lv('r2'), entry],
    setupNote: 'Le titre clôture à ' + usd(close) + ', au-dessus de ses moyennes à vingt et cinquante séances. Depuis le record de ' + usd(entry) + ' du 14 mai, la base s’étend jusqu’à ' + usd(baseLow) + ' (29 juin), avec ' + closesBelow + ' clôtures sous ' + usd(abandon) + ' ; depuis le 4 août, le cours oscille entre ' + usd(lv('augLow')) + ' et ' + usd(lv('r2')) + '. Avant activation, aucune entrée ; une clôture sous ' + usd(abandon) + ', le bas du 14 septembre, abandonne le scénario. Activation sur une clôture au-dessus de $' + entry.toFixed(2) + ', le plus haut des trois cents séances, atteint le 14 mai. Après activation, stop sous $' + stop.toFixed(2) + ', le haut du 21 septembre : un retour sous ce niveau signerait une fausse sortie. Supports : ' + usd(lv('s1')) + ', ' + usd(lv('s2')) + ' et ' + usd(abandon) + '. Résistances : ' + usd(lv('r1')) + ', ' + usd(lv('r2')) + ' et ' + usd(entry) + '.',
    wyckoff: 'Non utilisé : le profil de volume n’est pas exploité dans ce dossier.',
    sourceRefs: [market('barres quotidiennes et indicateurs recalculés')] },
  performance: { windowReturns: { label: 'Rendements de prix sur vingt et une séances, sans dividendes réinvestis', startDate: bars[N - 21][0], endDate: bars[N][0],
      rows: [{ ticker: T, returnPct: +ret(21).toFixed(2) }, ...Object.entries(M).map(([ticker, x]) => ({ ticker, returnPct: x.return21d }))] },
    sourceRefs: [market('barres quotidiennes comparées')] },
  options: { callOI: 'Non exploitable', putOI: 'Non exploitable', cpRatio: 'Non exploitable', maxPain: 'Non exploitable', ivMean: 'Non exploitable', skew: 'Chaîne relevée marché fermé, sans intérêt ouvert utilisable', unusual: 'Aucune activité inhabituelle qualifiée', sourceRefs: [market('options')] },
  shortInterest: { siPct: fr(st.shortPercentOfFloat * 100, 2) + ' % du flottant', daysToCover: fr(st.shortRatio, 2) + ' jours, date de règlement non précisée par le snapshot', ctb: 'Coût d’emprunt bas, sans tension', trend: 'Positions vendeuses faibles pour une capitalisation de cette taille ; aucune thèse de rachat forcé des vendeurs.', squeezeScore: 'Non pertinent', sourceRefs: [market('positions vendeuses')] },
  insiders: { signal: 'Ventes de marché uniquement dans la fenêtre relevée, aucun achat. Mark Stevens, administrateur, a vendu environ ' + fr(stevens.shares / 1e6, 2) + ' millions d’actions du ' + frDate(stevens.first) + ' au ' + frDate(stevens.last, true) + ', pour environ ' + fr(stevens.value / 1e6, 0) + ' M$. La directrice financière et le directeur juridique ont aussi vendu, pour des montants plus modestes. Couverture officielle partielle : aucun solde net publié, et aucun plan de cession programmé n’est affirmé faute de mention relevée.',
    recentTransactions: [
      { date: stevens.last, insider: 'Mark A. Stevens — administrateur', type: 'sell', shares: fr(stevens.shares, 0), value: fr(stevens.value / 1e6, 0) + ' M$ cumulés depuis le ' + frDate(stevens.first) },
      { date: kress.last, insider: 'Colette Kress — direction financière', type: 'sell', shares: fr(kress.shares, 0), value: fr(kress.value / 1e6, 2) + ' M$' },
      { date: teter.last, insider: 'Timothy Teter — direction juridique', type: 'sell', shares: fr(teter.shares, 0), value: fr(teter.value / 1e6, 2) + ' M$ cumulés depuis le ' + frDate(teter.first) }],
    sourceRefs: [market('formulaires 4')] },
  blastRadius: {},
  macro: { indicators: [{ name: 'Clôture de référence', value: REF, signal: usd(close) + ', séance complète' }, { name: 'Rendement cinq séances', value: sgn(ret(5)), signal: 'Descriptif' }, { name: 'Rendement vingt et une séances', value: sgn(ret(21)), signal: 'Descriptif' }],
    regime: 'neutral', impact: 'Un titre valorisé sur la durée du cycle est sensible aux taux longs : le 10 ans américain a clôturé à 5,11 % le 23 septembre, plus haut depuis juillet 2007. Une hausse des taux réduit ce que le marché accepte de payer pour des bénéfices lointains.' },
  risks: { riskScore: 6, riskProfile: 'High',
    riskSummary: 'La demande actuelle ne fait guère débat ; sa facture, si. NVIDIA finance une part croissante de la chaîne qui lui achète ses puces. La société garantit des loyers, prête indirectement à ses clients via des participations et s’engage sur des achats géants. Tant que les clients paient, tout se tient ; si un grand acheteur ralentit, NVIDIA encaisse le choc deux fois, sur le chiffre d’affaires et sur ses engagements.',
    riskCards: [
      { title: 'Crédit des clients', severity: 'high', icon: 'fa-handshake', points: ['Garanties de loyers plafonnées à 105 Md$ au bénéfice d’un affilié d’OpenAI.', 'Participations dans l’écosystème, dont les plus-values gonflent le résultat.'], verdict: 'Suivre la santé financière des grands laboratoires d’IA autant que les commandes de puces.' },
      { title: 'Engagements d’achat', severity: 'high', icon: 'fa-boxes-stacked', points: ['Engagements portés de 119 à 279 Md$ en un trimestre, surtout en mémoire.', 'Ils se paient même si la demande ralentit.'], verdict: 'Un trimestre de commandes plus faibles pèserait sur la marge par les stocks et les achats contractés.' },
      { title: 'Concentration des acheteurs', severity: 'medium', icon: 'fa-users', points: ['Un client direct à 16 % du chiffre d’affaires du trimestre.', 'Cinq clients directs à 70 % des créances.'], verdict: 'Le cours réagira à tout signal de pause d’un grand cloud avant même qu’elle apparaisse dans les comptes.' },
      { title: 'Taux et valorisation', severity: 'medium', icon: 'fa-percent', points: ['Taux à 10 ans au plus haut depuis 2007.', 'Multiple élevé sur la durée du cycle.'], verdict: 'La hausse des taux peut comprimer le multiple même si les résultats restent bons.' }],
    pedagogy: 'Deux coûts à ne pas confondre. Le slippage, c’est l’écart de quelques cents entre le prix visé et le prix obtenu : sur ' + fr(adv / 1e9, 1) + ' Md$ échangés par séance, il reste faible. Le gap, c’est un saut d’ouverture : un gap peut faire sortir sous le stop de ' + usd(stop) + ', et la perte dépasse alors le risque prévu. Le 1er octobre au matin, après les résultats de Micron, ce risque est réel. La taille se fixe sur la distance au stop, ' + usd(entry - stop) + ' ici, pas sur l’objectif. Ne pas acheter la hausse en séance : attendre la clôture de déclenchement.' },
  tradeIdea: { status: 'watch', statusNote: 'Surveiller. Avant activation : aucune entrée ; une clôture sous ' + usd(abandon) + ' abandonne le scénario. Activation : clôture au-dessus de ' + usd(entry) + ', puis achat à l’ouverture suivante seulement sous ' + usd(cap) + '. Après activation : stop sous ' + usd(stop) + '. Le scénario précédent a été stoppé le 9 septembre ; ses niveaux archivés (230,36 $ d’entrée le 3 septembre, 223,67 $ le 9) viennent d’une autre source de cours que la série certifiée actuelle, qui donne ' + usd(lv('prevEntry')) + ' et ' + usd(lv('prevStop')) + ' à ces dates.',
    entry, stop, tp1, tp2,
    stopPct: pct(stop, entry).toFixed(1) + '%', tp1Pct: '+' + pct(tp1, entry).toFixed(1) + '%', tp2Pct: '+' + pct(tp2, entry).toFixed(1) + '%',
    rr: '1:' + rr1.toFixed(2) + ' TP1 / 1:' + rr2.toFixed(2) + ' TP2',
    entryNote: 'Déclencheur sur clôture au-dessus du plus haut des trois cents séances, pas sur un franchissement en séance. Entrée à l’ouverture suivante uniquement sous ' + usd(cap) + ' : au-delà, le R/R vers TP1 tomberait sous 1,5 avec le même stop. Une clôture de déclenchement déjà au-dessus de ' + usd(cap) + ', ou une ouverture au-delà, annule l’entrée. La marge est mince : ' + usd(cap - entry) + ', soit ' + fr(X.bufAtr, 2) + ' ATR ; ' + fr(X.gapAll, 0) + ' % des séances de la série (' + fr(X.gap60, 0) + ' % sur les soixante dernières) ont ouvert plus haut que la veille d’au moins cet écart, et sur ' + X.breakouts + ' clôtures au-dessus du plus haut de la veille, ' + X.exec + ' seulement auraient permis l’achat à ces conditions. La plupart des activations seront donc manquées, et c’est voulu : acheter plus haut dégraderait le R/R. Objectifs : la hauteur de la fourchette d’août-septembre, du bas du 24 août au haut du 4 septembre, projetée pour moitié (TP1) puis en entier (TP2) au-dessus du déclencheur. Liquidité : environ ' + fr(adv / 1e9, 1) + ' Md$ échangés par séance, médiane des vingt dernières. Exemple de taille, non personnalisé : 100 $ de perte acceptée, divisés par ' + usd(entry - stop) + ' de risque par action, donnent ' + sizeExample + ' actions.',
    horizon: 'Dix séances après activation',
    thesis: 'Des résultats records n’ont pas suffi à dépasser le record de mai : le marché escompte le coût des engagements pris pour les tenir. Avant activation, le dossier reste en surveillance et une clôture sous ' + usd(abandon) + ' l’abandonne. Une clôture au-dessus de $' + entry.toFixed(2) + ' sortirait le titre d’une base de quatre mois ; l’entrée n’a lieu qu’à l’ouverture suivante et sous ' + usd(cap) + '. Après activation, le stop sous $' + stop.toFixed(2) + ' limite le risque à une fausse sortie. TP1 à ' + usd(tp1) + ' et TP2 à ' + usd(tp2) + ' projettent la fourchette d’août-septembre. Ne pas anticiper le déclencheur, ne pas acheter un gap au-dessus du plafond.',
    catalysts: ['Une clôture au-dessus du plus haut du 14 mai, sur volume au moins égal à la médiane récente.', 'Les résultats de Micron, attendus le 30 septembre après la clôture selon deux calendriers de données (date non confirmée ici par Micron) : ils testeront la demande de mémoire et peuvent faire ouvrir NVIDIA en gap le 1er octobre. La journée investisseurs de Marvell, le 6 octobre, tombe aussi dans l’horizon.', 'Tout dépôt précisant l’entrée en vigueur des garanties SB Energy ou la clôture de l’acquisition Hugging Face.'],
    invalidation: ['Avant activation : une clôture sous ' + usd(abandon) + ', bas du 14 septembre, abandonne le scénario.', 'Après activation : une clôture sous ' + usd(stop) + ' invalide le trade.', 'Ouverture au-dessus de ' + usd(cap) + ' après la clôture de déclenchement : pas d’achat, le R/R deviendrait insuffisant.', 'Une révision à la baisse de la prévision trimestrielle annule la thèse avant activation.'] },
  globalScore: { profile: 'Croissance record, financement de plus en plus engagé',
    keyTakeawaysPositive: ['Chiffre d’affaires doublé en un an, prévision encore en hausse.', 'Marge brute stable à un niveau très élevé.', 'Capital rendu aux actionnaires sans émission d’actions.'],
    keyTakeawaysNegative: ['Engagements d’achat et garanties en forte hausse.', 'Bénéfice publié flatté par les plus-values sur participations.', 'Titre en retard sur les semi-conducteurs depuis la publication.'],
    mindsetTip: 'Quand le meilleur élève de la classe ne monte plus sur de bonnes notes, regarder ce qu’il a promis pour les obtenir.' },
  social: { platforms: [], sourceRefs: [market('sentiment non retenu faute de mesure qualifiée')] },
  disclaimer: 'Document de recherche éducatif. Ni conseil financier, ni signal de trading. Statut surveiller : aucun ordre actif.',
};

// ---------------------------------------------------------------- blast radius
const G = [
  { name: 'Grands acheteurs de calcul', order: 1, transmission: 'Leur capex fixe la demande de NVIDIA ; un ralentissement de l’un d’eux se lit dans un trimestre.', rows: [
    ['MSFT', 'leader', 'Premier acheteur de calcul et cloud Azure', 'Son capex et les commentaires d’Azure sur la capacité disent si les commandes de baies continuent au même rythme.'],
    ['META', 'leader', 'Grand acheteur de calcul pour ses modèles', 'Ses révisions de capex changent directement la demande de puces d’entraînement et d’inférence.'],
    ['GOOGL', 'leader', 'Cloud et puces maison concurrentes', 'Client et concurrent : ses puces maison sont la principale alternative aux processeurs de NVIDIA.'],
    ['AMZN', 'leader', 'Premier cloud public et puces maison', 'Ses commandes de GPU et ses propres accélérateurs arbitrent la part de NVIDIA dans le premier cloud.']] },
  { name: 'Pairs directs', order: 1, transmission: 'Accélérateurs concurrents ou complémentaires : ils se disputent le même budget de calcul.', rows: [
    ['AMD', 'direct_peer', 'Seconde source de processeurs graphiques', 'Ses gains de parts chez les grands clouds mesurent la pression sur le prix des GPU de NVIDIA.'],
    ['AVGO', 'direct_peer', 'Puces sur mesure et réseau', 'Les accélérateurs sur mesure des clouds passent par ses puces ; leur montée réduit la part des GPU.'],
    ['MRVL', 'direct_peer', 'Puces sur mesure et optique', 'Second fournisseur de puces sur mesure ; sa croissance signale la diversification des acheteurs.'],
    ['INTC', 'direct_peer', 'Processeurs centraux et fonderie', 'Concurrent des processeurs Vera et candidat fondeur : un succès de sa fonderie changerait la chaîne d’approvisionnement.'],
    ['ARM', 'direct_peer', 'Architecture des processeurs centraux', 'Les processeurs Vera reposent sur son architecture ; ses redevances suivent l’adoption des baies NVIDIA.']] },
  { name: 'Amont : fonderie, mémoire, équipement', order: 1, transmission: 'NVIDIA achète ; ces fournisseurs encaissent ses engagements avant qu’elle ne livre.', rows: [
    ['TSM', 'upstream', 'Fondeur de toutes les puces de NVIDIA', 'Sa capacité en gravure avancée et en assemblage limite le volume livrable de NVIDIA.'],
    ['MU', 'upstream', 'Mémoire à haut débit', 'La mémoire est le premier poste des 279 Md$ d’engagements : ses prix et volumes renchérissent ou libèrent les baies.'],
    ['AMKR', 'upstream', 'Assemblage et test de puces', 'L’assemblage avancé est un goulot : ses délais conditionnent le rythme des livraisons.'],
    ['KLAC', 'upstream', 'Contrôle de procédé des fondeurs', 'Ses ventes suivent les investissements des fondeurs pour produire les puces de NVIDIA.'],
    ['LRCX', 'upstream', 'Équipement de gravure et de dépôt', 'Ses commandes de mémoire et de logique précèdent la capacité disponible pour NVIDIA.'],
    ['ENTG', 'upstream', 'Matériaux et consommables des fondeurs', 'Ses volumes mesurent l’activité réelle des lignes de production avancées.']] },
  { name: 'Aval : serveurs et clouds d’IA', order: 2, transmission: 'Ils assemblent ou louent les baies de NVIDIA : leur santé financière est la demande de demain.', rows: [
    ['SMCI', 'downstream', 'Intégrateur de serveurs d’IA', 'Assemble des baies pour les clouds ; ses marges disent si le matériel reste rare.'],
    ['DELL', 'downstream', 'Intégrateur de serveurs d’IA', 'Son carnet de serveurs d’IA reflète la demande des entreprises et des néo-clouds.'],
    ['CRWV', 'downstream', 'Néo-cloud loueur de GPU', 'Loue des baies NVIDIA financées à crédit ; son coût de financement signale l’appétit du marché pour cette chaîne.'],
    ['ORCL', 'downstream', 'Cloud d’infrastructure pour l’IA', 'Acheteur de baies NVIDIA pour ses contrats d’IA ; son financement par dette et actions illustre le coût de la demande.'],
    ['NBIS', 'downstream', 'Néo-cloud loueur de GPU coté', 'Même modèle de location de GPU financée par capital externe ; ses levées éclairent la solidité des acheteurs.']] },
  { name: 'Second ordre : énergie et réseau', order: 2, transmission: 'Contraintes physiques de la mise en service : électricité, refroidissement, réseau optique.', rows: [
    ['VRT', 'second_order', 'Alimentation et refroidissement', 'Ses délais de livraison fixent le calendrier de mise en service des baies de NVIDIA.'],
    ['CEG', 'second_order', 'Producteur d’électricité nucléaire', 'L’électricité est le premier goulot des centres de données ; son coût pèse sur la demande de baies.'],
    ['ANET', 'second_order', 'Commutateurs Ethernet des clusters', 'Concurrent du réseau de NVIDIA et fournisseur des mêmes sites ; ses commandes signalent la construction de clusters.'],
    ['COHR', 'second_order', 'Optique des centres de données', 'Les interconnexions optiques suivent le nombre de baies installées.']] },
  { name: 'Contrôles sectoriels', order: 2, transmission: 'Paniers de référence pour séparer le mouvement du titre de celui de son secteur.', rows: [
    ['SMH', 'sector_proxy', 'Panier de semi-conducteurs', 'NVIDIA y pèse lourd : un écart de performance avec ce panier isole ce qui est propre au titre.'],
    ['SOXX', 'sector_proxy', 'Panier de semi-conducteurs équipondéré', 'Moins concentré que SMH : il montre si la hausse du secteur se fait sans NVIDIA.'],
    ['QQQ', 'sector_proxy', 'Grandes valeurs du Nasdaq', 'Contrôle large de la technologie : un mouvement commun n’a rien de spécifique à NVIDIA.']] },
];
const evMu = raw.comparison_earnings.events.find(e => e.symbol === 'MU');
const EV = { MU: 'Résultats trimestriels le ' + evMu.report_date + ' après la clôture, date corroborée par deux calendriers : dans l’horizon du trade' };
const EV_DEFAULT = { leader: 'Aucune publication dans les quatorze jours collectés ; ses annonces de capex restent le signal à suivre', direct_peer: 'Aucune publication dans les quatorze jours collectés ; ses annonces de produits peuvent déplacer les parts de marché', upstream: 'Aucune publication dans les quatorze jours collectés ; ses commentaires de capacité précèdent les livraisons', downstream: 'Aucune publication dans les quatorze jours collectés ; ses conditions de financement testent la chaîne', second_order: 'Aucune publication dans les quatorze jours collectés ; ses délais d’équipement fixent les mises en service', sector_proxy: 'Panier sans publication propre ; exposé aux résultats de ses grandes pondérations' };
const SPECIFIC = {
  MSFT: 'Aucune publication dans les quatorze jours collectés ; les commentaires d’Azure sur la capacité restent le signal à suivre',
  META: 'Aucune publication dans les quatorze jours collectés ; une révision de capex changerait la demande de calcul',
  GOOGL: 'Aucune publication dans les quatorze jours collectés ; les annonces de puces maison pèsent sur la part des GPU',
  AMZN: 'Aucune publication dans les quatorze jours collectés ; ses accélérateurs maison arbitrent la part de NVIDIA',
  AMD: 'Aucune publication dans les quatorze jours collectés ; ses lancements d’accélérateurs peuvent peser sur les prix',
  AVGO: 'Aucune publication dans les quatorze jours collectés ; ses contrats de puces sur mesure sont le signal concurrent',
  MRVL: 'Aucune publication dans les quatorze jours collectés ; ses commandes sur mesure mesurent la diversification des clouds',
  INTC: 'Aucune publication dans les quatorze jours collectés ; ses annonces de fonderie peuvent changer l’approvisionnement',
  ARM: 'Aucune publication dans les quatorze jours collectés ; ses redevances suivent l’adoption des processeurs Vera',
  TSM: 'Aucune publication dans les quatorze jours collectés ; ses ventes mensuelles donnent un indicateur avancé',
  AMKR: 'Aucune publication dans les quatorze jours collectés ; ses délais d’assemblage avancé sont un goulot à suivre',
  KLAC: 'Aucune publication dans les quatorze jours collectés ; ses commandes suivent le capex des fondeurs',
  LRCX: 'Aucune publication dans les quatorze jours collectés ; ses commandes de mémoire précèdent la capacité',
  ENTG: 'Aucune publication dans les quatorze jours collectés ; ses volumes reflètent l’utilisation des lignes',
  SMCI: 'Aucune publication dans les quatorze jours collectés ; ses marges sur serveurs disent si le matériel reste rare',
  DELL: 'Aucune publication dans les quatorze jours collectés ; son carnet de serveurs d’IA est le signal à suivre',
  CRWV: 'Aucune publication dans les quatorze jours collectés ; ses levées de dette testent l’appétit pour le crédit IA',
  ORCL: 'Aucune publication dans les quatorze jours collectés ; ses dépôts de financement éclairent le coût de la demande',
  NBIS: 'Aucune publication dans les quatorze jours collectés ; ses émissions de capital sont récurrentes',
  VRT: 'Aucune publication dans les quatorze jours collectés ; son carnet de refroidissement mesure la file d’attente des sites',
  CEG: 'Aucune publication dans les quatorze jours collectés ; ses contrats avec les clouds fixent le prix de l’énergie',
  ANET: 'Aucune publication dans les quatorze jours collectés ; ses commandes de commutateurs précèdent les ouvertures de sites',
  COHR: 'Aucune publication dans les quatorze jours collectés ; ses volumes optiques suivent les installations',
  SMH: 'Panier sans publication propre ; les résultats de Micron du 30 septembre peuvent le faire bouger',
  SOXX: 'Panier sans publication propre ; plus sensible aux valeurs moyennes du secteur',
  QQQ: 'Panier sans publication propre ; dominé par les grandes pondérations technologiques' };
const evNote = (t, cls) => EV[t] || SPECIFIC[t] || EV_DEFAULT[cls];
a.blastRadius = {
  asOf: REF, observationTime: raw.status.captured_at,
  window: 'Rendements quotidiens communs du ' + firstCommon + ' au ' + REF,
  methodology: 'Les séries sont alignées sur les mêmes dates de clôture et converties en rendements logarithmiques journaliers communs, depuis la fin mars. La corrélation mesure le co-mouvement ; le bêta mesure la sensibilité du rendement de NVIDIA à celui du comparable ; le R² est la corrélation au carré. Les rendements à cinq et vingt et une séances sont des rendements simples de clôture à clôture, sans dividendes. Le classement statistique large sert de contrôle ; les groupes sont définis par le lien économique, pas par la corrélation.',
  groups: G.map(g => ({ name: g.name, order: g.order, transmission: g.transmission,
    symbols: g.rows.map(([ticker, relationClass, role, readThrough]) => ({ ticker, role, relationClass, confidence: relationClass === 'sector_proxy' ? 'medium' : 'low', readThrough, eventRisk: evNote(ticker, relationClass), ...M[ticker] })) })),
  scenarios: [
    { scenario: 'bullish', trigger: 'La demande des grands clouds et des clouds d’IA reste au-dessus de la prévision et les engagements se transforment en livraisons.', firstOrder: 'Le chiffre d’affaires dépasse 108 Md$ et le titre dépasse son record du 14 mai.', secondOrder: 'La fonderie, la mémoire et l’assemblage gardent leur carnet ; les intégrateurs de serveurs suivent.', confirmation: 'Une clôture au-dessus du plus haut du 14 mai et des résultats de Micron sans signal de saturation.', contradiction: 'Un grand cloud qui annonce une pause de capex ou une montée plus rapide de ses puces maison.' },
    { scenario: 'mixed', trigger: 'Les résultats tiennent la prévision, mais la hausse des taux comprime les multiples de la croissance.', firstOrder: 'Le titre reste sous 236 $ pendant que le reste des semi-conducteurs rattrape.', secondOrder: 'L’écart de performance avec les paniers de semi-conducteurs continue de se creuser.', confirmation: 'Un titre bloqué sous 236 $ pendant que SMH et SOXX progressent.', contradiction: 'Une détente des taux longs qui relancerait les valeurs de croissance.' },
    { scenario: 'bearish', trigger: 'Un grand acheteur ralentit ou un laboratoire d’IA fragilisé renchérit le risque des garanties.', firstOrder: 'Les engagements d’achat et les garanties pèsent sur la marge et le bilan.', secondOrder: 'Les néo-clouds financés à crédit décrochent, la mémoire et l’assemblage révisent leurs volumes.', confirmation: 'Une clôture sous le bas du 14 septembre et un recul des commandes chez les intégrateurs.', contradiction: 'Une prévision relevée au trimestre suivant malgré le ralentissement d’un client.' }],
  contradictions: ['Les résultats sont records, et pourtant le titre a pris ' + sgn(since26.NVDA, 1) + ' depuis la clôture du 26 août contre ' + sgn(since26.SMH, 1) + ' pour SMH : l’écart est mince, mais la corrélation avec le secteur ne l’explique pas.', 'Une corrélation élevée avec un fournisseur ne prouve pas un lien commercial ; les clients directs de NVIDIA ne sont pas nommés.'],
  missingData: ['Les clients directs ne sont pas nommés dans les dépôts : aucun client coté n’entre dans les comparables comme client documenté.', 'Chaîne d’options relevée marché fermé, inexploitable ; sentiment et tendances de recherche indisponibles.', 'Barres d’une source de repli pour l’ensemble des séries : la source principale présentait des séances manquantes sur un comparable.'],
  sourceRefs: [market('barres comparables et classement statistique'), ref(1)] };

// ---------------------------------------------------------------- jugements éditoriaux
const judgments = { ticker: T, score_components: score, judgments: {
  'meta.version': { value: 3, reason: 'Version du schéma de dossier individualisé, non une observation financière.' },
  'meta.date': { value: a.meta.date, reason: 'Date de construction éditoriale, distincte de la clôture de référence.' },
  'meta.dateDisplay': { value: a.meta.dateDisplay, reason: 'Date éditoriale en français, non une observation financière.' },
  'verdict.score': { value: scoreValue, reason: 'Score additif : métier, technique, capital, calendrier, dilution et base de risque.' },
  'risks.riskScore': { value: 6, reason: 'Jugement qualitatif sur dix : engagements hors bilan, concentration et taux.' } } };
a.blastRadius.groups.forEach((g, i) => { judgments.judgments['blastRadius.groups.' + i + '.order'] = { value: g.order, reason: 'Classement économique éditorial du mécanisme de transmission, pas une causalité mesurée.' }; });
write(rev + '/editorial-judgments.json', judgments);

// ---------------------------------------------------------------- preuves
const inputs = [];
for (const [name, file] of [['bars', 'bars'], ['fund', 'fundamentals'], ['comparison', 'comparison_bars'], ['rank', 'rank_beta'], ['status', 'status'], ['insiders', 'insiders'], ['earn', 'comparison_earnings'], ['sec', 'sec_evidence']])
  inputs.push(K.input(name, data + '/' + file + '.json'));
inputs.push(K.input('context', data + '/comparison_context.json'));
inputs.push(K.input('primary', rev + '/primary-manifest.json', 'primary_sec_manifest_v1'), K.input('judgments', rev + '/editorial-judgments.json', 'editorial_judgment'), K.input('archive', run + '/original/NVDA.json', 'archived_analysis'));
const { dep, prov } = K.provenance(inputs);
const P = i => prov('primary', '/documents/' + i, 'Chiffre lu dans le dépôt SEC ouvert et haché.');
const lvlProv = k => prov('bars', lvPtr(k), 'Niveau lu sur la barre certifiée du ' + L[k].d + '.');
const gaap = () => prov('primary', '/documents/6', 'GAAP douze mois glissants au 26/07/2026 = exercice 2026 (10-K) − premier semestre FY26 + premier semestre FY27 (10-Q) ; EBITDA = résultat opérationnel + amortissements ; dette = emprunts + passifs de location à long terme ; trésorerie = liquidités + titres de dette.', [dep('primary', '/documents/1')]);
const marketMath = () => prov('bars', B + '/' + N + '/4', 'Capitalisation = close × actions au 21 août ; EV = capitalisation + dette − trésorerie au 26/07 ; ratios sur agrégats GAAP douze mois.', [dep('fund', STP + '/sharesOutstanding'), dep('primary', '/documents/1'), dep('primary', '/documents/6')]);
const levelsGeo = () => prov('bars', lvPtr('trigger'), 'Déclencheur = plus haut du 14 mai ; hauteur = plus haut du 4 septembre − plus bas du 24 août ; TP1 = déclencheur + moitié de la hauteur ; TP2 = déclencheur + hauteur ; plafond = (TP1 + 1,5 × stop) / 2,5 ; pourcentages depuis l’entrée ; R/R = gain / risque.', [dep('bars', lvPtr('stop')), dep('bars', lvPtr('r2')), dep('bars', lvPtr('augLow'))]);
const insiderProv = () => prov('insiders', TXP + '/transactions', 'Formulaires 4 relevés, code S (ventes de marché) ; cumuls = somme des actions et des actions × prix par dirigeant ; couverture officielle partielle.', [dep('sec', '')]);

function sourceFor(p) {
  if (/^meta\.(lastMcpRefresh|levelsVerifiedAt)$/.test(p) || p === 'blastRadius.observationTime') return prov('status', '/captured_at', 'Horodatage exact de la collecte.');
  const sh = p.match(/^meta\.statusHistory\.(\d+)\.(.+)$/);
  if (sh && +sh[1] < archive.meta.statusHistory.length) return prov('archive', '/meta/statusHistory/' + sh[1] + '/' + sh[2].split('.').map(esc).join('/'), 'Historique de cycle de vie conservé de la version précédente.');
  if (sh) return sh[2] === 'at' ? prov('status', '/captured_at', 'Horodatage de la refonte.') : prov('bars', B + '/' + N + '/4', 'Clôture de référence et date de la refonte.', [dep('bars', B + '/' + N + '/0')]);
  if (p.startsWith('meta.lastEvent.')) return prov('archive', '/meta/lastEvent/' + p.split('.')[2], 'Dernier événement de cycle de vie conservé.');
  if (judgments.judgments[p]) return prov('judgments', '/judgments/' + esc(p) + '/value', judgments.judgments[p].reason);
  const r = p.match(/^(.*)\.sourceRefs\.(\d+)\.(date|url|name)$/);
  if (r) { const x = get(a, r[1] + '.sourceRefs.' + r[2]); if (x.url === K.evidenceUrl(T)) return prov('status', '/captured_at', 'Date de collecte, non date de cours.'); const i = docs.findIndex(d => d.url === x.url); if (i < 0) throw Error('référence inconnue ' + p); return P(i); }
  if (p === 'meta.levelsCloseDate' || p === 'blastRadius.asOf' || p === 'macro.indicators.0.value') return prov('bars', B + '/' + N + '/0', 'Dernière séance complète.');
  if (p === 'header.price' || p === 'macro.indicators.0.signal') return prov('bars', B + '/' + N + '/4', 'Clôture complète de référence.');
  if (p === 'header.changePct') return prov('bars', B + '/' + N + '/4', '100 × (close / close précédent − 1).', [dep('bars', B + '/' + (N - 1) + '/4')]);
  if (p === 'header.metrics.volume') return prov('bars', B + '/' + N + '/5', 'Volume de la séance, en millions.');
  if (p.startsWith('header.metrics.') || p === 'verdict.whyAvoid.0') return marketMath();
  if (p.startsWith('macro.indicators.')) return prov('bars', B, 'Rendements simples cinq et vingt et une séances depuis les clôtures certifiées.');
  if (p === 'macro.impact') return prov('bars', B + '/' + N + '/0', 'Date de la clôture de référence ; rendement du Trésor à 10 ans lu dans la courbe officielle du Trésor américain (daily/20260924/primary-reference.json).');
  if (p === 'verdict.summary') return prov('bars', B, 'Record du 14 mai, plus bas du 29 juin et fourchette d’août sur barres certifiées ; rendements depuis la clôture du 26 août comparés à SMH et SOXX ; engagements, dette et garanties lus dans les dépôts.', [dep('bars', lvPtr('baseLow')), dep('comparison', C('SMH')), dep('comparison', C('SOXX')), dep('primary', '/documents/1'), dep('primary', '/documents/2'), dep('primary', '/documents/5')]);
  if (p === 'news.0.detail' || p === 'blastRadius.contradictions.0') return prov('bars', B + '/' + idx('2026-08-26') + '/4', 'Rendements simples depuis la clôture du 26 août, NVIDIA, SMH et SOXX.', [dep('comparison', C('SMH')), dep('comparison', C('SOXX'))]);
  if (p === 'fundamentals.rows.15.signal') return prov('context', ctxRows.MSFT.ptr, 'Scénario : multiple de vingt fois, encadré par l’EV/EBITDA de Microsoft et d’Alphabet relevés le 24 septembre (statistiques courantes, non point-in-time) ; dette et trésorerie du 10-Q.', [dep('context', ctxRows.GOOGL.ptr), dep('primary', '/documents/1')]);
  if (/^verdict\.whyAvoid\.1$/.test(p)) return prov('primary', '/documents/5', 'Commentaire du directeur financier, engagements.');
  if (/^verdict\.whyAvoid\.[23]$/.test(p)) return P(1);
  if (p === 'verdict.whyBuy.3') return P(0);
  if (p.startsWith('verdict.whyBuy.') || p.startsWith('earnings.')) return P(0);
  if (p.startsWith('verdict.controlChecklist.')) return prov('primary', '/documents/1', 'Garanties et engagements lus dans les dépôts ; date de Micron issue de deux calendriers de données ; journée investisseurs annoncée par Marvell (8-K du 27 août 2026).', [dep('primary', '/documents/5'), dep('earn', '/events')]);
  if (p.startsWith('news.0.')) return P(0);
  if (p.startsWith('news.1.')) return P(2);
  if (p.startsWith('news.2.')) return P(3);
  if (p.startsWith('news.3.')) return P(4);
  if (p === 'verdict.whyAvoid.3') return P(1);
  if (p.startsWith('technicals.') && !/supports|resistances|setupNote|badges/.test(p)) return prov('bars', B, tech.convention + '.');
  if (p.startsWith('technicals.badges')) return prov('bars', B, 'Record, base et moyennes calculés sur les barres certifiées.', [dep('bars', lvPtr('trigger')), dep('bars', lvPtr('abandon'))]);
  const sr = p.match(/^technicals\.(supports|resistances)\.(\d+)$/);
  if (sr) return lvlProv({ supports: ['s1', 's2', 'abandon'], resistances: ['r1', 'r2', 'trigger'] }[sr[1]][+sr[2]]);
  if (p === 'technicals.setupNote') return prov('bars', B + '/' + N + '/4', 'Clôture, déclencheur, stop, abandon, base, fourchette d’août, supports et résistances lus sur les barres certifiées ; nombre de clôtures sous l’abandon depuis le 14 mai.', ['trigger', 'stop', 'abandon', 's1', 's2', 'r1', 'r2', 'augLow', 'baseLow'].map(k => dep('bars', lvPtr(k))));
  if (p.startsWith('business.segments.') || p === 'business.overview') return prov('primary', '/documents/5', 'Revenus par plateforme du commentaire du directeur financier ; parts = segment / revenus totaux ; engagements, dette et garanties dans les dépôts.', [dep('primary', '/documents/0'), dep('primary', '/documents/1'), dep('primary', '/documents/2'), dep('primary', '/documents/3'), dep('primary', '/documents/4')]);
  if (p.startsWith('business.coverageMatrix.')) return prov('bars', B, 'Matrice de couverture de la collecte.');
  const fm = p.match(/^fundamentals\.rows\.(\d+)\./);
  if (fm) { const i = +fm[1]; if (i <= 3) return P(0); if (i <= 6) return prov('primary', '/documents/1', 'Tableau des flux du 10-Q : flux opérationnel, investissements, plus-values ; flux libre = opérationnel − investissements.'); if (i <= 11) return gaap(); return marketMath(); }
  if (p.startsWith('capitalStructure.sharesOutstanding')) return prov('fund', STP + '/sharesOutstanding', 'Actions en circulation, identiques à la page de garde du 10-Q.', [dep('primary', '/documents/1')]);
  if (p.startsWith('capitalStructure.')) return prov('primary', '/documents/1', 'Rachats, dividendes, dette et émission obligataire lus dans le 10-Q, le communiqué et le 424B5.', [dep('primary', '/documents/0'), dep('primary', '/documents/4')]);
  if (/^filingsReview\.filings\.\d+\./.test(p)) return P(+p.split('.')[2]);
  if (p.startsWith('filingsReview.')) return prov('primary', '/documents/1', 'Garanties, engagements, concentration et participations lus dans les dépôts.', [dep('primary', '/documents/5')]);
  if (p.startsWith('shortInterest.')) return prov('fund', STP, 'Positions vendeuses et jours de couverture du snapshot statistique ; aucune date de règlement inférée.');
  if (p.startsWith('insiders.')) return insiderProv();
  if (p.startsWith('performance.windowReturns.')) { const m = p.match(/rows\.(\d+)/), tk = m ? a.performance.windowReturns.rows[+m[1]].ticker : T; return tk === T ? prov('bars', B, 'Rendement simple vingt et une séances.') : prov('comparison', C(tk), 'Rendement simple vingt et une séances, sans dividendes.'); }
  if (p === 'blastRadius.window') return prov('comparison', C('MSFT'), 'Première et dernière date communes aux séries alignées.', [dep('bars', B)]);
  const bm = p.match(/^blastRadius\.groups\.(\d+)\.symbols\.(\d+)\./);
  if (bm && /eventRisk$/.test(p)) return prov('earn', '/events', 'Calendrier de résultats des comparables sur quatorze jours ; seules les publications datées y figurent.');
  if (bm) { const row = a.blastRadius.groups[+bm[1]].symbols[+bm[2]]; return prov('comparison', C(row.ticker), 'Rendements log communs ; corrélation de Pearson ; bêta NVDA sur comparable = covariance / variance du comparable ; R² = corrélation au carré ; rendements simples cinq et vingt et une séances.', [dep('bars', B)]); }
  if (p.startsWith('blastRadius.scenarios.')) return prov('bars', lvPtr('trigger'), 'Niveaux du couloir lus sur les barres certifiées ; prévision lue dans le communiqué.', [dep('primary', '/documents/0'), dep('earn', '/events')]);
  if (p.startsWith('blastRadius.')) return prov('rank', '', 'Contrôle de couverture statistique et relations économiques documentées.');
  if (/^tradeIdea\.(entry|stop)$/.test(p)) return lvlProv(p.split('.')[1] === 'entry' ? 'trigger' : 'stop');
  if (/^tradeIdea\.(tp1|tp2|stopPct|tp1Pct|tp2Pct|rr)$/.test(p)) return levelsGeo();
  if (p === 'tradeIdea.catalysts.1') return prov('earn', '/events', 'Date de publication de Micron issue de deux calendriers de données, non confirmée par l’émetteur ; journée investisseurs du 6 octobre annoncée par Marvell (8-K du 27 août 2026, accession 0001835632-26-000022).', [dep('primary', '/documents/5')]);
  if (p.startsWith('tradeIdea.')) return prov('bars', lvPtr('trigger'), 'Niveaux lus sur les barres certifiées ; plafond, objectifs et taille calculés ; liquidité = médiane close × volume sur vingt séances ; exécutabilité : ' + X.method + ' ; niveaux archivés comparés aux barres certifiées des mêmes dates.', [dep('bars', lvPtr('stop')), dep('bars', lvPtr('abandon')), dep('bars', lvPtr('prevEntry')), dep('bars', lvPtr('prevStop')), dep('bars', B), dep('archive', '/meta/lastEvent/date')]);
  if (p.startsWith('risks.')) return prov('primary', '/documents/1', 'Garanties, engagements, concentration lus dans les dépôts ; rendement à 10 ans dans la courbe officielle ; stop, liquidité et date de Micron (calendriers de données) pour la pédagogie.', [dep('primary', '/documents/5'), dep('primary', '/documents/2')]);
  if (p.startsWith('verdict.')) return P(0);
  if (p.startsWith('globalScore.') || p.startsWith('meta.') || p.startsWith('business.') || p === 'disclaimer') return P(0);
  throw Error('provenance manquante ' + p);
}
const res = K.writeEvidence({ ticker: T, ref: REF, outJson: OUT_JSON, outEvidence: OUT_EVIDENCE, calcPath: rev + '/numeric-evidence.json', generator: GEN, a, inputs, sourceFor, score,
  valuation: { basis: 'GAAP douze mois au 2026-07-26 ; multiple de vingt fois l’EBITDA = hypothèse éditoriale', ...scn },
  extra: { gaap_inputs_millions: { K10, BAL, CF }, technicals_recomputed: tech, levels: { entry, stop, abandon, range, baseLow, closesBelow, tp1, tp2, rr1, rr2, cap, capRr, sizeExample, adv, stopAtr, exec: X, since26, peerEv },
    insiders: { byInsider }, limitations: ['Barres d’une source de repli (Webull) : la source principale avait des séances manquantes sur CRWV.', 'Options inexploitables, marché fermé.', 'Clients directs non nommés.'] } });
K.renderPreview(a, run + '/preview/index.html');
console.log(`[NVDA] claims=${res.claims} score=${scoreValue} close=${close} entry=${entry} stop=${stop} tp1=${tp1} tp2=${tp2} rr1=${rr1.toFixed(2)} cap=${cap} capRr=${capRr.toFixed(2)} ev/ebitda=${(ev / G$.ebitda).toFixed(1)} pe=${(marketCap / G$.ni).toFixed(1)} scn=${scn.price.toFixed(2)} size=${sizeExample} stevens=${stevens.shares}`);
