'use strict';
// Dossier CRM v3 au close du 2026-09-23. Écrit le JSON canonique, le sidecar de preuves, les
// artefacts de calcul et un aperçu LOCAL. Ne touche ni analyses/CRM/index.html ni l'index du site.
const K = require('../../../../tools/lib/analysis-v3-kit.cjs');
const { sha, bytes, read, write, esc, get, fr, usd, pct, sgn, findPath, at, frDate } = K;
const T = 'CRM', REF = '2026-09-23';
const run = 'analyses/CRM/_runs/20260924', data = run + '/_data', rev = run + '/revision', prim = 'analyses/CRM/_primary';
const OUT_JSON = 'data/analyses-data/CRM.json', OUT_EVIDENCE = 'data/analyses-evidence/CRM.json', GEN = run + '/build-crm.cjs';

// ---------------------------------------------------------------- données collectées
const raw = K.loadRun(data, ['comparison_context', 'bars', 'fundamentals', 'comparison_bars', 'rank_beta', 'status', 'insiders', 'comparison_earnings', 'sec_evidence']);
const S = K.mainSeries(raw.bars, T, REF), { bars, N, B, idx, close, prev } = S;
const tech = K.technicals(bars);
const STP = findPath(raw.fundamentals, 'instrument_comprehensive_stats'), st = at(raw.fundamentals, STP);
const TXP = findPath(raw.insiders, 'instrument_insider_transactions'), tx = at(raw.insiders, TXP);
const cmpRows = raw.comparison_bars.data.items[0].results[0].data;
const C = t => { const i = cmpRows.findIndex(x => x.symbol === t); if (i < 0) throw Error('comparable absent ' + t); return '/data/items/0/results/0/data/' + i + '/bars'; };
const { M, firstCommon } = K.comparables(cmpRows, bars);
const adv = K.dollarAdv(bars), ret = k => pct(close, bars[N - k][4]);
const archive = read(run + '/original/CRM.json');
const gap0827 = pct(bars[idx('2026-08-27')][4], bars[idx('2026-08-26')][4]);
const peak = bars[idx('2026-09-03')][2], fromPeak = pct(close, peak);

// Formulaires 4 : ventes de marché (S) et achats (P) relevés dans la fenêtre collectée.
const buys = tx.transactions.filter(x => x.type_code === 'P'), sells = tx.transactions.filter(x => x.type_code === 'S');
const buy = buys[0], buyValue = buy.shares * buy.price;
const sellShares = sells.reduce((n, x) => n + x.shares, 0), sellValue = sells.reduce((n, x) => n + x.shares * x.price, 0);

// GAAP douze mois glissants au 31/07/2026 = exercice 2026 (10-K) − S1 FY26 + S1 FY27 (10-Q), en millions.
const K10 = { rev: [41525, 20065, 22478], ebit: [8331, 4274, 4678], da: [3631, 1660, 1951], ni: [7457, 3428, 5633], ocf: [14996, 7216, 7970], capex: [594, 314, 316] };
const ttm = k => K10[k][0] - K10[k][1] + K10[k][2];
const BAL = { cash: 8310, mkt: 3093, debtJul: 39288, debtJanCur: 4000, debtJanNon: 10439, equityJul: 38378, equityJan: 59142, shares: 823e6,
  q2Rev: 11345, q2RevPrior: 10236, informatica: 456, q2Gains: 2613, q2Pretax: 4552, intH1: 790, intH1Prior: 135, sbcH1: 1763, dilPrior: 962, dilNow: 821 };
const G$ = { rev: ttm('rev') * 1e6, ebit: ttm('ebit') * 1e6, ebitda: (ttm('ebit') + ttm('da')) * 1e6, ni: ttm('ni') * 1e6,
  fcf: (ttm('ocf') - ttm('capex')) * 1e6, debt: BAL.debtJul * 1e6, cash: (BAL.cash + BAL.mkt) * 1e6 };
const debtJan = BAL.debtJanCur + BAL.debtJanNon, netLev = (G$.debt - G$.cash) / G$.ebitda;
const organic = pct(BAL.q2Rev - BAL.informatica, BAL.q2RevPrior), intMult = BAL.intH1 / BAL.intH1Prior;
const shares = BAL.shares, marketCap = close * shares, ev = marketCap + G$.debt - G$.cash;
const EPS_FY27 = 16.69, EPS_GAAP_FY27 = 10.23; // milieux des guidances non-GAAP 16,67–16,71 $ et GAAP 10,21–10,25 $
// Note (3) de l'Exhibit 99.1 : gains sur investissements stratégiques du semestre = 2,98 $ (non-GAAP) et 2,87 $ (GAAP) par action ; 2,53 $ au T2 en non-GAAP.
const GAIN = { h1Adj: 2.98, h1Gaap: 2.87, q2Adj: 2.53 }, EPS_X = EPS_FY27 - GAIN.h1Adj, EPS_GAAP_X = EPS_GAAP_FY27 - GAIN.h1Gaap;
const q2AdjGrowthX = pct(5.90 - GAIN.q2Adj, 5.90 / 2.03);
const scn = { multiple: ev / G$.ebitda * 0.7, ebitda: G$.ebitda, debt: G$.debt, cash: G$.cash, shares, close };
scn.enterprise_value = scn.multiple * scn.ebitda; scn.equity_value = scn.enterprise_value - scn.debt + scn.cash; scn.price = scn.equity_value / scn.shares; scn.downside_pct = (scn.price / close - 1) * 100;

// Niveaux lus sur des barres certifiées, par date. Objectifs : plus hauts de septembre au-dessus du déclencheur.
const L = { trigger: { d: '2026-09-22', c: 2 }, stop: { d: '2026-09-23', c: 3 }, abandon: { d: '2026-09-22', c: 3 },
  s3: { d: '2026-08-26', c: 4 }, r1: { d: '2026-09-16', c: 2 }, r2: { d: '2026-09-15', c: 2 }, r3: { d: '2026-09-03', c: 2 } };
const lv = k => bars[idx(L[k].d)][L[k].c], lvPtr = k => `${B}/${idx(L[k].d)}/${L[k].c}`;
const entry = lv('trigger'), stop = lv('stop'), abandon = lv('abandon');
const tp1 = lv('r1'), tp2 = lv('r3');
const rr1 = (tp1 - entry) / (entry - stop), rr2 = (tp2 - entry) / (entry - stop);
const RR_MIN = 1.5, cap = Math.floor((tp1 + RR_MIN * stop) / (1 + RR_MIN) * 100) / 100, capRr = (tp1 - cap) / (cap - stop);
const sizeExample = Math.floor(100 / (entry - stop)), extension = pct(close, tech.ema20);
const X = K.execStats(bars, entry, cap, tech.atr14), stopAtr = (entry - stop) / tech.atr14;
const gapOpen = pct(bars[idx('2026-08-27')][1], bars[idx('2026-08-26')][4]);
const wRet = t => { const b = t === T ? bars : cmpRows.find(x => x.symbol === t).bars; return pct(b.find(x => x[0] === REF)[4], b.find(x => x[0] === '2026-09-16')[4]); };
const post16 = { CRM: wRet('CRM'), IGV: wRet('IGV'), NOW: wRet('NOW'), ADBE: wRet('ADBE') };
const ctxRows = (() => { const out = {}; (function f(o, q) { if (o && typeof o === 'object') { if (o.type === 'instrument_comprehensive_stats' && o.symbol) out[o.symbol] = { v: o.enterpriseToEbitda, ptr: q + '/enterpriseToEbitda' }; for (const [k, v] of Object.entries(o)) f(v, q + '/' + esc(k)); } })(raw.comparison_context, ''); return out; })();
const peerEv = { ADBE: ctxRows.ADBE.v, MSFT: ctxRows.MSFT.v, WDAY: ctxRows.WDAY.v, NOW: ctxRows.NOW.v };

// ---------------------------------------------------------------- sources primaires
const EDGAR = 'https://www.sec.gov/Archives/edgar/data/1108524/';
const docs = [
  ['2026-08-26', '8-K / Exhibit 99.1', '0001108524-26-000187', 'crm-q2fy27xexhibit991.htm', 'q2fy27-ex991.htm',
    'Communiqué du deuxième trimestre de l’exercice 2027 : revenus de 11,3 Md$ (+11 %), dont 456 M$ apportés par Informatica, cRPO de 33,5 Md$ (+14 %), ARR d’Agentforce au-delà de 1,5 Md$. Guidance annuelle relevée à 46,1–46,4 Md$ de revenus et 16,67–16,71 $ de bénéfice ajusté, conditionnelle à la clôture de Contentful et Fin.'],
  ['2026-08-27', '10-Q', '0001108524-26-000190', 'crm-20260731.htm', 'q2fy27-10q.htm',
    'Rapport trimestriel : dette financière de 39,3 Md$ contre 14,4 Md$ au 31 janvier, capitaux propres ramenés de 59,1 à 38,4 Md$, charge d’intérêts semestrielle de 790 M$, 2,6 Md$ de gains sur investissements stratégiques au trimestre, 823 millions d’actions au 20 août.'],
  ['2026-09-17', '8-K / Exhibit 99.1', '0001108524-26-000210', 'investorday2026.htm', 'sep16-ex991.htm',
    'Présentation de la journée investisseurs du 16 septembre : objectif de revenus de plus de 63 Md$ pour l’exercice 2030, Informatica et acquisitions annoncées comprises. L’objectif est un cadre de croissance, pas une guidance ; le titre a reculé dans les séances suivantes.'],
  ['2026-03-02', '10-K', '0001108524-26-000060', 'crm-20260131.htm', 'fy26-10k.htm',
    'Rapport annuel de l’exercice clos le 31 janvier 2026 : revenus de 41,5 Md$, résultat opérationnel GAAP de 8,3 Md$, flux opérationnel de 15,0 Md$ ; aucun client ne dépasse 10 % des revenus ou des créances.'],
  ['2026-03-12', '8-K', '0001193125-26-104282', 'd887348d8k.htm', 'mar12-8k.htm',
    'Rachat accéléré de 25 Md$ signé le 11 mars avec cinq banques, dans une autorisation totale de rachats portée à 50 Md$ en février. Paiement le 16 mars contre une livraison initiale d’environ 80 % des actions ; le solde dépend du cours moyen jusqu’au règlement final.'],
  ['2026-03-13', '8-K', '0001193125-26-106356', 'd114728d8k.htm', 'mar13-8k.htm',
    'Émission obligataire de 25 Md$ en huit tranches, de 2028 à 2066, à des coupons de 4,50 % à 6,70 % : le financement du rachat accéléré.'],
  ['2026-08-26', '8-K', '0001108524-26-000187', 'crm-20260826.htm', 'q2fy27-8k.htm',
    'Formulaire de couverture du communiqué trimestriel (item 2.02), qui rattache l’Exhibit 99.1 au dépôt du 26 août. Il n’ajoute aucun chiffre, mais date officiellement la publication des résultats et de la guidance relevée.'],
  ['2026-09-17', '8-K', '0001108524-26-000210', 'crm-20260916.htm', 'sep16-8k.htm',
    'Formulaire de couverture de la présentation investisseurs (item 7.01), qui rattache l’Exhibit 99.1 au dépôt du 17 septembre. Il n’ajoute aucun chiffre et précise que la présentation est fournie, pas déposée, au sens de la loi boursière.'],
].map(([date, form, accession, file, local, finding]) => ({ date, form, accession, url: `${EDGAR}${accession.replace(/-/g, '')}/${file}`, finding, path: `${prim}/${local}`, sha256: sha(bytes(`${prim}/${local}`)) }));
const needle = (id, i, needles) => { const text = bytes(docs[i].path).toString('utf8'); for (const n of needles) if (!text.includes(n)) throw Error(`needle absent ${id}: ${n}`); return [id, { source_path: docs[i].path, source_sha256: docs[i].sha256, source_needles: needles }]; };
const primary = { kind: 'primary_sec_manifest_v1', ticker: T, as_of: '2026-09-24', inventory_count: 29, inventory_screened_count: 29, opened_count: docs.length, reviewed_count: docs.length, decision_relevant_count: docs.length, local_primary_count: docs.length,
  review_scope: 'Dépôts EDGAR de Salesforce du 1er février au 23 septembre 2026, formulaires de détention des dirigeants exclus. Vingt-neuf dépôts inventoriés ; les documents de gouvernance (DEF 14A, DEFA14A, ARS), les S-8, les 13G, le FWP, les 424B2 déjà repris par le 8-K du 13 mars et les 8-K sans chiffre décisionnel sont écartés.',
  documents: docs,
  semantic_findings: Object.fromEntries([
    needle('q2_results', 0, ['$33.5 billion', '$11.3 billion', '$456 million', '$1.5 billion', '$3.9 billion', '$46.1 billion', '$16.67', '$16.71', '$10.21', '$11.42', '$4.29', '$5.90', '20.5%', '4% - 5%', 'Contentful', '$200M', '$2.98', '$2.87', '$2.53', 'expected in October 2026']),
    needle('balance', 1, ['39,288', '10,439', '4,000', '38,378', '59,142', '8,310', '3,093', '823']),
    needle('income', 1, ['11,345', '10,236', '22,478', '20,065', '4,678', '4,274', '1,951', '1,660', '7,970', '7,216', '316', '314', '5,633', '3,428', '2,613', '4,552', '790', '135', '1,763', '962', '821']),
    needle('asr', 1, ['198.34', '103 million', '27,332', '24,842']),
    needle('investor_day', 2, ['$63B+', 'FY30']),
    needle('fy26', 3, ['41,525', '8,331', '3,631', '14,996', '594', '7,457', 'ten percent or more of total revenue']),
    needle('asr_8k', 4, ['$25&#160;billion', '$50&#160;billion']),
    needle('notes', 5, ['3,500,000,000', '1,000,000,000', '4.500%', '6.700%']),
    needle('cover_q2', 6, ['2.02']),
    needle('cover_sep', 7, ['Investor Day']),
  ]) };
write(rev + '/primary-manifest.json', primary);
const ref = i => ({ name: 'Salesforce ' + docs[i].form, url: docs[i].url, date: docs[i].date });
const market = name => ({ name: 'Données de marché datées (provenance hashée) : ' + name, url: K.evidenceUrl(T), date: '2026-09-24' });

// ---------------------------------------------------------------- le dossier
const score = { business: 24, technical: 3, capital: 2, calendar: 0, dilution: 2, valuation: 6, risk: 30 };
const scoreValue = Object.values(score).reduce((a, b) => a + b, 0);
const a = {
  meta: { lang: 'fr', dir: 'ltr', level: 'intermediate', tags: ['us', 'equities', 'ai-chain', 'software', 'technology'], grade: 'B', date: '2026-09-24', dateDisplay: '24 septembre 2026', version: 3, status: 'watch', assetType: 'stock', levelsCloseDate: REF,
    description: 'Salesforce : cRPO en accélération, rachat de 25 Md$ financé à crédit, titre revenu vers le haut de son gap. Dossier au close du 23 septembre 2026, statut surveiller.',
    ogDescription: 'Salesforce : un trimestre qui accélère, un bilan qui s’endette pour racheter ses actions ; niveaux à surveiller.',
    lastMcpRefresh: raw.status.captured_at, levelsVerifiedAt: raw.status.captured_at,
    statusHistory: [{ at: raw.status.captured_at, from: archive.meta.status, to: 'watch', note: 'refonte v3 du 24 septembre : nouveau scénario, clôture de référence du 2026-09-23', close }] },
  header: { ticker: T, name: 'Salesforce, Inc.', exchange: 'NYSE', sector: 'Logiciels de gestion client en nuage', price: close, changePct: pct(close, prev),
    badges: [{ text: 'SURVEILLER — REPRISE À CONFIRMER EN CLÔTURE', color: 'blue' }, { text: 'Chaîne IA — agents d’entreprise', color: 'purple' }],
    metrics: { marketCap: fr(marketCap / 1e9, 1) + ' Md$', volume: fr(bars[N][5] / 1e6, 2) + ' M', evRevenue: fr(ev / G$.rev, 1) + '×' }, halalStatus: 'unknown' },
  verdict: { score: scoreValue, conviction: 'Moderate', bias: 'Neutral',
    confidence: 'Score éditorial non prédictif. Les chiffres d’entreprise viennent des dépôts SEC ; les niveaux, du close certifié du 23 septembre.',
    summary: 'Salesforce a ouvert à ' + sgn(gapOpen, 1) + ' le 27 août, au lendemain de ses résultats, et clôturé à ' + sgn(gap0827, 1) + ', puis a rendu une partie du mouvement : le titre clôture à ' + usd(close) + ', ' + fr(-fromPeak, 1) + ' % sous le plus haut du 3 septembre. Le trimestre justifiait la réaction. Le cRPO, le carnet facturable des douze prochains mois, accélère à +14 %, l’ARR d’Agentforce dépasse 1,5 Md$ et la guidance annuelle est relevée. Deux chiffres tempèrent. Hors Informatica, la croissance du trimestre tombe à ' + fr(organic, 1) + ' %. Et le rachat accéléré de 25 Md$ a été payé avec 25 Md$ d’obligations : la dette financière passe de ' + fr(debtJan / 1e3, 1) + ' à ' + fr(BAL.debtJul / 1e3, 1) + ' Md$ en six mois. Autre correction : le bénéfice ajusté guidé contient 2,98 $ par action de gains sur investissements déjà réalisés. Sans eux, le titre vaut ' + fr(close / EPS_X, 1) + ' fois le bénéfice ajusté et ' + fr(close / EPS_GAAP_X, 1) + ' fois le bénéfice GAAP, et il est endetté. Pas d’entrée au cours actuel. Le signal serait une clôture au-dessus de ' + usd(entry) + ' ; une clôture sous ' + usd(abandon) + ' ferait abandonner le scénario.',
    whyBuy: [
      'Le cRPO atteint 33,5 Md$, en hausse de 14 % : le carnet facturable à douze mois progresse plus vite que le chiffre d’affaires, qui croît de 11 %.',
      'L’ARR combiné d’Agentforce et de Data 360 approche 3,9 Md$, en hausse de plus de 210 % : chez Salesforce, l’IA commence à peser dans les comptes.',
      'Au close du 23 septembre, la valeur d’entreprise vaut ' + fr(ev / G$.ebitda, 1) + ' fois l’EBITDA GAAP, entre Adobe (' + fr(peerEv.ADBE, 1) + '×) et Workday (' + fr(peerEv.WDAY, 1) + '×) selon les statistiques relevées le 24 septembre, pour un carnet qui accélère.',
      'Le rachat accéléré a réduit le nombre d’actions : ' + fr(BAL.dilNow, 0) + ' millions d’actions diluées au deuxième trimestre, contre ' + fr(BAL.dilPrior, 0) + ' millions un an plus tôt.',
      'Un administrateur, David Kirk, a acheté ' + fr(buy.shares, 0) + ' actions le ' + frDate(buy.date_transaction) + ' à ' + usd(buy.price) + ', environ ' + fr(buyValue / 1e6, 1) + ' M$, en pleine baisse du titre.'],
    whyAvoid: [
      'Informatica a apporté 456 M$ au trimestre : sans cette acquisition, la croissance des revenus tombe à ' + fr(organic, 1) + ' %.',
      'La dette financière est passée de ' + fr(debtJan / 1e3, 1) + ' à ' + fr(BAL.debtJul / 1e3, 1) + ' Md$ en six mois et la charge d’intérêts du semestre atteint 790 M$, contre 135 M$ un an plus tôt.',
      'Les gains sur investissements gonflent les deux bénéfices : 2,613 Md$ dans les 4,552 Md$ de résultat avant impôt du trimestre, et 2,53 $ dans les 5,90 $ de bénéfice ajusté par action. Hors gains, l’ajusté du trimestre progresse d’environ ' + fr(q2AdjGrowthX, 0) + ' %, pas de 103 %.',
      'La guidance ne prévoit que 4 à 5 % de croissance du flux libre sur l’exercice : le rachat réduit le nombre d’actions, pas la dépendance à la croissance organique.'],
    controlChecklist: [
      { label: 'Historique de cours', status: 'pass', statusLabel: 'Trois cents séances continues', evidence: 'Série certifiée au close du 23 septembre, sans séance manquante.', action: 'Niveaux et indicateurs recalculés sur cette seule série.' },
      { label: 'Retracement', status: 'warn', statusLabel: 'Titre revenu vers la moyenne à vingt séances', evidence: 'Le titre a rendu une partie du gap d’août et oscille autour de sa moyenne à vingt séances.', action: 'Attendre le déclencheur de clôture ; ne pas acheter la baisse en séance.' },
      { label: 'Calendrier', status: 'warn', statusLabel: 'Prochains résultats non confirmés', evidence: 'Aucune date publiée par Salesforce. Accenture, intégrateur de Salesforce, publie le 1er octobre avant l’ouverture selon deux calendriers de données, date non confirmée ici par Accenture.', action: 'Compter avec un gap possible le 1er octobre.' }] },
  business: { theme: 'Logiciels de relation client, données et agents d’IA pour les entreprises',
    overview: '<p>Salesforce vend des logiciels de relation client par abonnement : ventes, service client, marketing, commerce, Slack, et désormais Informatica pour la gestion des données. Au trimestre clos le 31 juillet 2026, les abonnements ont pesé 10,8 Md$ sur 11,3 Md$ de revenus.</p><p>La thèse de la société a changé en un an. Le logiciel ne se vend plus seulement au nombre d’utilisateurs humains : Agentforce facture des agents d’IA qui traitent des demandes clients ou des tâches commerciales. L’ARR d’Agentforce dépasse 1,5 Md$, et le cRPO accélère à +14 %, ce que la direction relie à ces nouvelles offres. Mais Informatica a apporté 456 M$ au trimestre : la croissance hors acquisition reste de l’ordre de six pour cent.</p><p>La mécanique financière a basculé en mars. Salesforce a emprunté 25 Md$ pour racheter 25 Md$ de ses propres actions d’un coup, par un rachat accéléré. Le nombre d’actions diluées est passé de 962 à 821 millions en un an, mais la dette financière a presque triplé et les capitaux propres ont fondu d’un tiers. Le bénéfice par action monte mécaniquement ; le bilan, lui, prend un risque qu’il n’avait pas.</p>',
    moat: 'L’avantage de Salesforce tient aux données clients qu’il héberge : changer de logiciel de relation client oblige à migrer des années d’historique et à reformer des milliers d’employés. Les agents d’IA en tirent parti, puisqu’ils ont besoin de ces données pour agir. Microsoft et ServiceNow visent la même couche d’agents.',
    segments: [
      { name: 'Abonnements et support', revenue: '10,8 Md$ au trimestre', pct: '95 %', description: 'En hausse de 12 % sur un an, Informatica compris.' },
      { name: 'Services professionnels', revenue: '525 M$ au trimestre', pct: '5 %', description: 'En léger recul sur un an.' }],
    sourceRefs: [ref(0), ref(1)],
    coverageMatrix: [
      { facet: 'Cours et historique', status: 'COUVERT', decision: 'Trois cents séances continues, close certifié ; base des niveaux.' },
      { facet: 'Résultats et guidance', status: 'COUVERT — PRIMAIRE', decision: 'Communiqué du 26 août et 10-Q ; prochaine date non confirmée.' },
      { facet: 'Capital, dette et rachats', status: 'COUVERT — PRIMAIRE', decision: 'Rachat accéléré, émission obligataire et nombre d’actions lus dans les dépôts.' },
      { facet: 'Comparables et transmission', status: 'COUVERT — LOCAL', decision: 'Corrélations recalculées sur barres certifiées depuis la fin mars.' },
      { facet: 'Initiés', status: 'PARTIEL', decision: 'Un achat et des ventes relevés ; couverture officielle incomplète, aucun solde net affirmé.' },
      { facet: 'Options', status: 'NON EXPLOITABLE', decision: 'Chaîne relevée marché fermé.' },
      { facet: 'Sentiment et tendances de recherche', status: 'INDISPONIBLE', decision: 'Aucune mesure qualifiée ; non utilisé.' }] },
  news: [
    { date: '2026-08-26', title: 'Deuxième trimestre : cRPO à +14 %, guidance relevée', impact: 'positive', detail: 'Le carnet facturable accélère et la guidance annuelle monte de 200 M$ ; le lendemain, le titre ouvre à ' + sgn(gapOpen, 1) + ' et clôture à ' + sgn(gap0827, 1) + '.', source: 'Salesforce — SEC', sourceUrl: docs[0].url },
    { date: '2026-09-16', title: 'Journée investisseurs : plus de 63 Md$ visés pour l’exercice 2030', impact: 'neutral', detail: 'L’objectif inclut les acquisitions déjà annoncées. Du 16 au 23 septembre, CRM perd ' + fr(-post16.CRM, 1) + ' % quand IGV gagne ' + fr(post16.IGV, 1) + ' % : hypothèse, l’objectif était déjà dans le cours, avec la hausse des taux en toile de fond.', source: 'Salesforce — SEC', sourceUrl: docs[2].url },
    { date: '2026-03-12', title: 'Rachat accéléré de 25 Md$', impact: 'positive', detail: 'Environ 103 millions d’actions livrées d’emblée à 198,34 $ en moyenne ; le solde doit être réglé d’ici octobre.', source: 'Salesforce — SEC', sourceUrl: docs[4].url },
    { date: '2026-03-13', title: 'Émission obligataire de 25 Md$', impact: 'negative', detail: 'Huit tranches de 2028 à 2066 financent le rachat ; la charge d’intérêts du semestre est multipliée par près de six.', source: 'Salesforce — SEC', sourceUrl: docs[5].url }],
  fundamentals: { rows: [
      { metric: 'Chiffre d’affaires du trimestre', value: '11,3 Md$', signal: '+11 % sur un an, communiqué du 26 août', signalColor: 'green' },
      { metric: 'cRPO en fin de trimestre', value: '33,5 Md$', signal: '+14 % sur un an', signalColor: 'green' },
      { metric: 'ARR d’Agentforce', value: 'Plus de 1,5 Md$', signal: 'Plus de +240 % sur un an, périmètre élargi au deuxième trimestre', signalColor: 'green' },
      { metric: 'Guidance de revenus de l’exercice', value: '46,1–46,4 Md$', signal: '+11 à 12 %, conditionnelle à Contentful et Fin', signalColor: 'amber' },
      { metric: 'Croissance hors Informatica du trimestre', value: fr(organic, 1) + ' %', signal: '(revenus − 456 M$ d’Informatica) / revenus du trimestre de l’an passé', signalColor: 'amber' },
      { metric: 'Charge d’intérêts du semestre', value: '790 M$', signal: 'Contre 135 M$ un an plus tôt, 10-Q', signalColor: 'red' },
      { metric: 'Gains sur investissements stratégiques du semestre', value: '3,171 Md$', signal: 'Non récurrents, inclus dans le résultat GAAP', signalColor: 'amber' },
      { metric: 'Rémunération en actions du semestre', value: '1,763 Md$', signal: 'Exclue du bénéfice ajusté, 10-Q', signalColor: 'amber' },
      { metric: 'Flux libre sur douze mois', value: fr(G$.fcf / 1e9, 2) + ' Md$', signal: 'Flux opérationnel − investissements, douze mois au 31 juillet 2026', signalColor: 'green' },
      { metric: 'Revenus GAAP sur douze mois', value: fr(G$.rev / 1e9, 2) + ' Md$', signal: 'Douze mois glissants au 31 juillet 2026 (10-K + 10-Q)', signalColor: 'blue' },
      { metric: 'EBITDA GAAP sur douze mois', value: fr(G$.ebitda / 1e9, 2) + ' Md$', signal: 'Résultat opérationnel + amortissements, douze mois au 31 juillet 2026', signalColor: 'blue' },
      { metric: 'Résultat net GAAP sur douze mois', value: fr(G$.ni / 1e9, 2) + ' Md$', signal: 'Douze mois au 31 juillet 2026, gains sur investissements compris', signalColor: 'amber' },
      { metric: 'Dette financière et trésorerie au 31 juillet', value: fr(G$.debt / 1e9, 1) + ' / ' + fr(G$.cash / 1e9, 1) + ' Md$', signal: 'Dette contre ' + fr(debtJan / 1e3, 1) + ' Md$ au 31 janvier ; trésorerie = liquidités + titres de placement', signalColor: 'red' },
      { metric: 'Dette nette / EBITDA GAAP', value: fr(netLev, 1) + '×', signal: 'Au 31 juillet 2026, sur EBITDA douze mois', signalColor: 'amber' },
      { metric: 'EV/revenus GAAP', value: fr(ev / G$.rev, 1) + '×', signal: 'Enterprise value au close du 2026-09-23 sur revenus GAAP douze mois au 2026-07-31', signalColor: 'blue', source: 'Clôture certifiée, 10-K et 10-Q', comparison: 'Versus une croissance de 11 % publiée : un multiple de logiciel mature, dette comprise.' },
      { metric: 'EV/EBITDA GAAP', value: fr(ev / G$.ebitda, 1) + '×', signal: 'Enterprise value au close du 2026-09-23 sur EBITDA GAAP douze mois au 2026-07-31', signalColor: 'blue', source: 'Clôture certifiée, 10-K et 10-Q', comparison: 'Versus Adobe (' + fr(peerEv.ADBE, 1) + '×), Microsoft (' + fr(peerEv.MSFT, 1) + '×), Workday (' + fr(peerEv.WDAY, 1) + '×) et ServiceNow (' + fr(peerEv.NOW, 1) + '×), statistiques courantes relevées le 24 septembre : Salesforce est dans le bas de la fourchette des grands éditeurs.' },
      { metric: 'P/E forward non-GAAP hors gains sur investissements', value: fr(close / EPS_X, 1) + '×', signal: 'Forward : close du 2026-09-23 sur 16,69 $ guidés pour l’exercice 2027, moins 2,98 $ de gains du semestre (note 3 du communiqué)', signalColor: 'amber', source: 'Clôture certifiée et communiqué du 26 août', comparison: 'Versus ' + fr(close / EPS_FY27, 1) + '× sur la guidance brute : les gains réalisés abaissent le multiple apparent.' },
      { metric: 'P/E forward GAAP hors gains sur investissements', value: fr(close / EPS_GAAP_X, 1) + '×', signal: 'Forward : close du 2026-09-23 sur 10,23 $ guidés moins 2,87 $ de gains du semestre', signalColor: 'red', source: 'Clôture certifiée et communiqué du 26 août', comparison: 'Versus le non-GAAP hors gains : l’écart restant vient de la rémunération en actions et des amortissements.' },
      { metric: 'Scénario EV/EBITDA × 0,7 : valeur d’entreprise −30 % (hypothèse éditoriale)', value: fr(scn.price, 2) + ' $ par action', signal: 'Scénario : valeur d’entreprise réduite de 30 % par hypothèse, dette et trésorerie du 2026-07-31 inchangées, soit ' + fr(scn.downside_pct, 0) + ' % sous le close du 2026-09-23', signalColor: 'red', source: 'Clôture certifiée, 10-K et 10-Q', comparison: 'Versus le close : la dette amplifie la baisse de l’action au-delà de celle de l’entreprise ; ce n’est pas un objectif.' }],
    sourceRefs: [ref(0), ref(1), market('fondamentaux et statistiques')] },
  earnings: { quarters: [],
    beatNote: 'Deuxième trimestre de l’exercice 2027 : bénéfice GAAP de 4,29 $ par action et ajusté de 5,90 $, dont 2,53 $ de gains sur investissements selon la note 3 du communiqué ; marge opérationnelle GAAP de 20,5 %. La guidance du troisième trimestre vise 11,42 à 11,50 Md$ de revenus et un cRPO en hausse d’environ 14 %. Celle de l’exercice vise 46,1 à 46,4 Md$ de revenus, 10,21 à 10,25 $ de bénéfice GAAP et 16,67 à 16,71 $ ajusté, gains du semestre compris, sous réserve de la clôture de Contentful et Fin. Aucune date de prochaine publication n’est confirmée par l’émetteur à ce jour.',
    nextEarnings: 'Date non confirmée par l’émetteur ; aucune publication dans les quatorze jours du calendrier collecté.',
    sourceRefs: [ref(0)] },
  capitalStructure: { sharesOutstanding: 'Environ 823 millions d’actions au 20 août 2026 (page de garde du 10-Q)',
    sharesAuthorized: 'Autorisation de rachat portée à 50 Md$ en février 2026, rachat accéléré de 25 Md$ compris (8-K du 12 mars).',
    dilutionRisk: 'low',
    shareHistory: 'Le nombre d’actions baisse vite : 821 millions d’actions diluées au deuxième trimestre, contre 962 millions un an plus tôt. Le rachat accéléré de 25 Md$ a livré environ 103 millions d’actions en mars à 198,34 $ en moyenne, soit 80 % du total attendu ; le solde doit être livré au règlement final, prévu en octobre selon le communiqué du 26 août (au troisième trimestre de l’exercice selon le 10-Q). La rémunération en actions, 1,763 Md$ sur six mois, dilue en sens inverse. Le nombre exact d’actions après règlement n’est pas calculable depuis ces seuls dépôts.',
    warrants: [],
    atm: { active: false, authorized: 'Aucun programme d’émission d’actions relevé', used: 'Sans objet', remaining: 'Sans objet' },
    sourceRefs: [ref(1), ref(4), ref(5)] },
  filingsReview: { summary: 'Huit documents décisionnels ouverts et hachés. Ils montrent un carnet qui accélère, une croissance organique encore modeste et un bilan transformé : 25 Md$ d’obligations pour racheter 25 Md$ d’actions. Aucune dilution nouvelle ; le risque a changé de nature, il est devenu un risque de dette.',
    filings: docs.map(d => ({ date: d.date, form: d.form, accession: d.accession, finding: d.finding, url: d.url })),
    contrarianRisks: [
      'Hors Informatica, la croissance reste autour de six pour cent : l’accélération promise pour le second semestre n’est pas encore visible dans les revenus.',
      'La dette de 39,3 Md$ a été contractée pour racheter des actions, pas pour investir : si la croissance déçoit, le bilan n’a plus la marge de 2025.',
      'Le bénéfice du trimestre, GAAP comme ajusté, dépend des gains sur investissements stratégiques, par nature non récurrents : 2,98 $ par action sur le semestre en données ajustées.',
      'Microsoft et ServiceNow vendent aussi des agents d’IA aux mêmes directions : la facturation à l’agent peut se banaliser vite.',
      'La guidance dépend de la clôture de Contentful et Fin : un retard réglementaire retirerait environ 200 M$ de revenus annoncés.'] },
  technicals: { rsi14: +tech.rsi14.toFixed(2), macd: +tech.macd.toFixed(2), macdSignal: +tech.macdSignal.toFixed(2), ema20: +tech.ema20.toFixed(2), ema50: +tech.ema50.toFixed(2), ema200: +tech.ema200.toFixed(2),
    ma50Type: 'EMA', ma200Type: 'EMA', ma50Available: true, ma200Available: true, atr14: +tech.atr14.toFixed(2),
    badges: ['Pullback dans le gap d’août', 'MACD sous son signal', 'Au-dessus des EMA 50 et 200'],
    supports: [stop, abandon, lv('s3')],
    resistances: [tp1, lv('r2'), tp2],
    setupNote: 'Le titre clôture à ' + usd(close) + ', autour de sa moyenne à vingt séances (' + sgn(extension, 1) + '), après avoir rendu une partie du gap du 27 août. Avant activation, aucune entrée ; une clôture sous ' + usd(abandon) + ', le bas du 22 septembre, abandonne le scénario. Activation sur une clôture au-dessus de $' + entry.toFixed(2) + ', le plus haut du 22 septembre. Après activation, stop sous $' + stop.toFixed(2) + ', le bas du 23 septembre. Le stop est à moins d’un ATR (' + usd(entry - stop) + ' contre ' + usd(tech.atr14) + ') : une séance ordinaire peut le toucher. Supports : ' + usd(stop) + ', ' + usd(abandon) + ' et ' + usd(lv('s3')) + ', la clôture d’avant le gap. Résistances : ' + usd(tp1) + ', ' + usd(lv('r2')) + ' et ' + usd(tp2) + '.',
    wyckoff: 'Non utilisé : le profil de volume n’est pas exploité dans ce dossier.',
    sourceRefs: [market('barres quotidiennes et indicateurs recalculés')] },
  performance: { windowReturns: { label: 'Rendements de prix sur vingt et une séances, sans dividendes réinvestis', startDate: bars[N - 21][0], endDate: bars[N][0],
      rows: [{ ticker: T, returnPct: +ret(21).toFixed(2) }, ...Object.entries(M).map(([ticker, x]) => ({ ticker, returnPct: x.return21d }))] },
    sourceRefs: [market('barres quotidiennes comparées')] },
  options: { callOI: 'Non exploitable', putOI: 'Non exploitable', cpRatio: 'Non exploitable', maxPain: 'Non exploitable', ivMean: 'Non exploitable', skew: 'Chaîne relevée marché fermé', unusual: 'Aucune activité inhabituelle qualifiée', sourceRefs: [market('options')] },
  shortInterest: { siPct: fr(st.shortPercentOfFloat * 100, 2) + ' % du flottant', daysToCover: fr(st.shortRatio, 2) + ' jours, date de règlement non précisée par le snapshot', ctb: 'Coût d’emprunt bas, sans tension', trend: 'Positions vendeuses faibles pour une valeur de cette taille ; aucun potentiel de squeeze.', squeezeScore: 'Faible', sourceRefs: [market('positions vendeuses')] },
  insiders: { signal: 'Un achat de marché et des ventes limitées dans la fenêtre relevée. David Kirk, administrateur, a acheté ' + fr(buy.shares, 0) + ' actions le ' + frDate(buy.date_transaction) + ' pour environ ' + fr(buyValue / 1e6, 1) + ' M$. Craig Conway, administrateur, a vendu ' + fr(sellShares, 0) + ' actions le 4 septembre pour environ ' + fr(sellValue / 1e6, 1) + ' M$. Les autres lignes sont des remises d’actions pour impôts. Couverture officielle partielle : aucun solde net publié.',
    recentTransactions: [
      { date: buy.date_transaction, insider: 'David Kirk — administrateur', type: 'buy', shares: fr(buy.shares, 0), value: fr(buyValue / 1e6, 2) + ' M$' },
      { date: sells[0].date_transaction, insider: 'Craig Conway — administrateur', type: 'sell', shares: fr(sellShares, 0), value: fr(sellValue / 1e6, 2) + ' M$' }],
    sourceRefs: [market('formulaires 4')] },
  blastRadius: {},
  macro: { indicators: [{ name: 'Clôture de référence', value: REF, signal: usd(close) + ', séance complète' }, { name: 'Rendement cinq séances', value: sgn(ret(5)), signal: 'Descriptif' }, { name: 'Rendement vingt et une séances', value: sgn(ret(21)), signal: 'Descriptif' }],
    regime: 'neutral', impact: 'Le 10 ans américain a clôturé à 5,11 % le 23 septembre, plus haut depuis juillet 2007. Les obligations de Salesforce sont à taux fixe : la charge d’intérêts ne bouge pas, mais une entreprise endettée voit son multiple comprimé plus vite quand les taux montent.' },
  risks: { riskScore: 5, riskProfile: 'Moderate',
    riskSummary: 'Salesforce a échangé un risque contre un autre : moins d’actions, beaucoup plus de dette. Le rachat de 25 Md$ financé à crédit rend l’action plus sensible à une déception : si l’accélération organique n’arrive pas au second semestre, la baisse du multiple s’appliquerait à une valeur d’entreprise dont une part plus grande revient aux créanciers.',
    riskCards: [
      { title: 'Levier du rachat accéléré', severity: 'high', icon: 'fa-money-bill-trend-up', points: ['Dette financière de 39,3 Md$ au 31 juillet.', 'Charge d’intérêts semestrielle multipliée par près de six.'], verdict: 'Le rachat soutient le bénéfice par action, mais il retire au bilan la marge qui absorbait les mauvais trimestres.' },
      { title: 'Croissance organique encore modeste', severity: 'medium', icon: 'fa-chart-line', points: ['Environ six pour cent hors Informatica au trimestre.', 'Accélération annoncée pour le second semestre, pas encore publiée.'], verdict: 'Le prochain trimestre doit montrer l’accélération organique dans les revenus, pas seulement dans le carnet.' },
      { title: 'Concurrence sur les agents d’IA', severity: 'medium', icon: 'fa-building', points: ['Microsoft et ServiceNow visent les mêmes directions.', 'Tarification à l’agent encore jeune.'], verdict: 'Les données clients donnent un avantage, mais le prix par agent peut baisser vite si l’offre se banalise.' }],
    pedagogy: 'Le 27 août, le titre a ouvert à ' + sgn(gapOpen, 1) + ' et clôturé à ' + sgn(gap0827, 1) + ', puis a reculé : acheter pendant la baisse en séance, c’est parier sur un plancher que rien ne confirme. Sur ' + fr(adv / 1e9, 1) + ' Md$ échangés par séance, le slippage reste de l’ordre du cent. Deux risques pèsent davantage. Le stop est à moins d’un ATR (' + usd(entry - stop) + ' contre ' + usd(tech.atr14) + ') : une séance ordinaire peut le toucher. Et un gap, par exemple après Accenture le 1er octobre, peut faire sortir sous ' + usd(stop) + ' : la perte dépasse alors le risque prévu. Taille calculée sur la distance au stop, sans l’augmenter : ' + sizeExample + ' actions pour 100 $. Ne pas poursuivre la hausse : attendre la clôture de déclenchement.' },
  tradeIdea: { status: 'watch', statusNote: 'Surveiller. Avant activation : aucune entrée ; une clôture sous ' + usd(abandon) + ' abandonne le scénario. Activation : clôture au-dessus de ' + usd(entry) + ', puis achat à l’ouverture suivante seulement sous ' + usd(cap) + '. Après activation : stop sous ' + usd(stop) + '.',
    entry, stop, tp1, tp2,
    stopPct: pct(stop, entry).toFixed(1) + '%', tp1Pct: '+' + pct(tp1, entry).toFixed(1) + '%', tp2Pct: '+' + pct(tp2, entry).toFixed(1) + '%',
    rr: '1:' + rr1.toFixed(2) + ' TP1 / 1:' + rr2.toFixed(2) + ' TP2',
    entryNote: 'Déclencheur sur clôture au-dessus du plus haut du 22 septembre, pas sur un franchissement en séance. Entrée à l’ouverture suivante uniquement sous ' + usd(cap) + ' : au-delà, le R/R vers TP1 tomberait sous 1,5 avec le même stop. Une clôture de déclenchement déjà au-dessus de ' + usd(cap) + ', ou une ouverture au-delà, annule l’entrée. La marge est de ' + usd(cap - entry) + ', ' + fr(X.bufAtr, 2) + ' ATR ; ' + fr(X.gapAll, 0) + ' % des séances ont ouvert plus haut que la veille d’au moins cet écart, et sur ' + X.breakouts + ' clôtures au-dessus du plus haut de la veille, ' + X.exec + ' seulement auraient permis l’achat. L’entrée est quasi inexécutable ; ce plan sert à ne pas acheter trop haut, pas à promettre un trade. Le stop est à moins d’un ATR : une séance ordinaire peut le toucher. Objectifs : TP1 au plus haut du 16 septembre, TP2 au plus haut du 3 septembre. Liquidité : environ ' + fr(adv / 1e9, 2) + ' Md$ échangés par séance, médiane des vingt dernières. Exemple de taille, non personnalisé : ' + sizeExample + ' actions, soit 100 $ de perte possible à ' + usd(entry - stop) + ' par action, hors gap.',
    horizon: 'Dix séances après activation',
    thesis: 'Le trimestre d’août a montré un carnet qui accélère ; le titre a depuis rendu une partie de sa hausse sans casser le bas de son gap. Avant activation, le dossier reste en surveillance et une clôture sous ' + usd(abandon) + ' l’abandonne. Une clôture au-dessus de $' + entry.toFixed(2) + ' montrerait que les acheteurs reprennent la main ; l’entrée n’a lieu qu’à l’ouverture suivante et sous ' + usd(cap) + '. Après activation, le stop sous $' + stop.toFixed(2) + ' limite le risque à la dernière séance. TP1 à ' + usd(tp1) + ' et TP2 à ' + usd(tp2) + ' visent les plus hauts de septembre. Taille calculée sur la distance au stop, sans l’augmenter : le stop est à moins d’un ATR et la dette rend la thèse moins tolérante à une déception.',
    catalysts: ['Une clôture au-dessus du plus haut du 22 septembre, sur volume au moins égal à la médiane récente.', 'La clôture des acquisitions de Contentful et Fin, qui conditionne la guidance relevée.', 'Le règlement final du rachat accéléré, prévu en octobre selon le communiqué, et les résultats d’Accenture le 1er octobre avant l’ouverture, date des calendriers de données : lecture des budgets de mise en œuvre et risque de gap.'],
    invalidation: ['Avant activation : une clôture sous ' + usd(abandon) + ', bas du 22 septembre, abandonne le scénario.', 'Après activation : une clôture sous ' + usd(stop) + ' invalide le trade.', 'Ouverture au-dessus de ' + usd(cap) + ' après la clôture de déclenchement : pas d’achat, le R/R deviendrait insuffisant.', 'Un retard ou un abandon de Contentful ou Fin, qui retirerait une partie de la guidance relevée, annule la thèse avant activation.'] },
  globalScore: { profile: 'Carnet en accélération, bilan endetté',
    keyTakeawaysPositive: ['cRPO en accélération à +14 %.', 'Revenus des agents d’IA visibles dans les comptes.', 'Hors gains, ' + fr(close / EPS_X, 1) + ' fois le bénéfice ajusté guidé.'],
    keyTakeawaysNegative: ['Croissance organique autour de six pour cent.', 'Dette presque triplée pour racheter des actions.', 'Résultat GAAP gonflé par des gains non récurrents.'],
    mindsetTip: 'Un rachat d’actions financé à crédit fait monter le bénéfice par action sans rendre l’entreprise plus grande : jugez la croissance, pas le chiffre par action.' },
  social: { platforms: [], sourceRefs: [market('sentiment non retenu faute de mesure qualifiée')] },
  disclaimer: 'Document de recherche éducatif. Ni conseil financier, ni signal de trading. Statut surveiller : aucun ordre actif.',
};

// ---------------------------------------------------------------- blast radius
const G = [
  { name: 'Leaders des plateformes d’entreprise', order: 1, transmission: 'Ils vendent des agents d’IA aux mêmes directions et fixent le prix de la couche logicielle.', rows: [
    ['MSFT', 'leader', 'Concurrent frontal en gestion client et agents', 'Dynamics et Copilot sont inclus dans des contrats déjà signés : la principale pression sur les prix de Salesforce.'],
    ['NOW', 'leader', 'Plateforme de flux de travail et d’agents', 'Titre le plus corrélé à Salesforce sur la fenêtre ; ses commentaires sur les agents valent pour tout le secteur.']] },
  { name: 'Pairs directs des applications', order: 1, transmission: 'Même budget d’applications d’entreprise, même cycle de renouvellement des abonnements.', rows: [
    ['SAP', 'direct_peer', 'Progiciel de gestion et relation client', 'Concurrent dans les grands comptes ; sa croissance du cloud mesure le rythme des migrations.'],
    ['HUBS', 'direct_peer', 'Gestion client pour les entreprises moyennes', 'Concurrent direct sur le bas du marché ; sa faiblesse signale des budgets logiciels tendus.'],
    ['ADBE', 'direct_peer', 'Logiciels de marketing et de contenu', 'Même budget marketing ; Contentful rapproche Salesforce de son terrain.'],
    ['WDAY', 'direct_peer', 'Logiciels de ressources humaines et finance', 'Même profil d’abonnement par utilisateur, exposé à la même question de facturation par agent.'],
    ['INTU', 'direct_peer', 'Logiciels financiers pour les PME', 'Profil d’éditeur mature ; son recul récent illustre la pression sur les multiples du logiciel.'],
    ['TEAM', 'direct_peer', 'Outils de collaboration et de service', 'Concurrent de Slack et du service informatique ; même clientèle de directions techniques.']] },
  { name: 'Amont : hébergement, calcul et bases', order: 1, transmission: 'Le service et les agents tournent sur des clouds et des puces tiers ; leurs prix fixent une partie du coût.', rows: [
    ['AMZN', 'upstream', 'Hébergeur principal du service', 'Ses tarifs d’hébergement pèsent sur la marge brute des abonnements.'],
    ['GOOGL', 'upstream', 'Hébergeur et fournisseur de modèles', 'Fournisseur de calcul et de modèles d’IA, et concurrent dans les agents.'],
    ['NVDA', 'upstream', 'Puces de calcul pour l’IA', 'Le coût du calcul des modèles fixe la marge des offres d’agents facturées au volume.'],
    ['ORCL', 'upstream', 'Infrastructure cloud et bases de données', 'Fournisseur d’infrastructure et concurrent historique en applications ; corrélation faible sur la fenêtre.']] },
  { name: 'Second ordre : données et observabilité', order: 2, transmission: 'Les agents consomment des données ; leurs budgets de données bougent avec ceux de Data 360.', rows: [
    ['SNOW', 'second_order', 'Entrepôt de données en nuage', 'Partenaire du partage de données sans copie ; son rythme mesure la demande de données pour l’IA.'],
    ['DDOG', 'second_order', 'Supervision des infrastructures cloud', 'Autre bénéficiaire des charges d’IA hébergées ; lecture des budgets techniques.'],
    ['MDB', 'second_order', 'Base de données en nuage', 'Même profil de logiciel de données ; lecture de la tolérance aux multiples.']] },
  { name: 'Aval : intégrateurs', order: 2, transmission: 'Ils déploient Salesforce chez les clients ; leurs carnets annoncent les projets à venir.', rows: [
    ['ACN', 'downstream', 'Premier intégrateur de Salesforce', 'Ses réservations en conseil et intégration précèdent les déploiements chez les grands comptes.'],
    ['IBM', 'downstream', 'Intégrateur et conseil informatique', 'Ses commentaires de conseil valent pour les budgets de transformation des grands clients.']] },
  { name: 'Contrôles sectoriels', order: 2, transmission: 'Paniers de référence pour séparer le mouvement du titre de celui de son secteur.', rows: [
    ['IGV', 'sector_proxy', 'Panier de logiciels américains', 'Un écart de performance avec ce panier isole ce qui est propre à Salesforce.'],
    ['XLK', 'sector_proxy', 'Panier technologique large', 'Dominé par les semi-conducteurs : son absence de corrélation montre que Salesforce ne suit pas le cycle des puces.'],
    ['QQQ', 'sector_proxy', 'Panier des grandes valeurs du Nasdaq', 'Contrôle du marché de croissance : un mouvement commun n’a rien de spécifique.']] },
];
const EV = {
  MSFT: 'Aucune publication dans les quatorze jours collectés ; ses offres groupées d’agents restent le signal concurrent',
  NOW: 'Aucune publication dans les quatorze jours collectés ; ses annonces d’agents déplacent le secteur',
  SAP: 'Aucune publication dans les quatorze jours collectés ; son rythme cloud sert de référence',
  HUBS: 'Aucune publication dans les quatorze jours collectés ; signal des budgets des entreprises moyennes',
  ADBE: 'Aucune publication dans les quatorze jours collectés ; son budget marketing recoupe celui de Salesforce',
  WDAY: 'Aucune publication dans les quatorze jours collectés ; même question de facturation par agent',
  INTU: 'Aucune publication dans les quatorze jours collectés ; lecture de la pression sur les multiples',
  TEAM: 'Aucune publication dans les quatorze jours collectés ; concurrent de Slack',
  AMZN: 'Aucune publication dans les quatorze jours collectés ; ses tarifs pèsent sur la marge',
  GOOGL: 'Aucune publication dans les quatorze jours collectés ; ses modèles fixent le coût des agents',
  NVDA: 'Aucune publication dans les quatorze jours collectés ; le coût du calcul pèse sur la marge des agents',
  ORCL: 'Aucune publication dans les quatorze jours collectés ; lien faible sur la fenêtre',
  SNOW: 'Aucune publication dans les quatorze jours collectés ; lecture de la demande de données',
  DDOG: 'Aucune publication dans les quatorze jours collectés ; lecture des budgets techniques',
  MDB: 'Aucune publication dans les quatorze jours collectés ; lecture de la tolérance aux multiples',
  ACN: 'Résultats annoncés pour le 1er octobre avant l’ouverture ; ses réservations sont la lecture la plus directe',
  IBM: 'Aucune publication dans les quatorze jours collectés ; lecture des budgets de conseil',
  IGV: 'Panier sans publication propre ; exposé aux grandes pondérations logicielles',
  XLK: 'Panier sans publication propre ; dominé par les semi-conducteurs',
  QQQ: 'Panier sans publication propre ; reflète le marché de croissance' };
const evNote = t => { if (!EV[t]) throw Error('eventRisk manquant ' + t); return EV[t]; };
a.blastRadius = {
  asOf: REF, observationTime: raw.status.captured_at,
  window: 'Rendements quotidiens communs du ' + firstCommon + ' au ' + REF,
  methodology: 'Les séries sont alignées sur les mêmes dates de clôture et converties en rendements logarithmiques journaliers communs, depuis la fin mars. La corrélation mesure le co-mouvement ; le bêta mesure la sensibilité du rendement de Salesforce à celui du comparable ; le R² est la corrélation au carré. Les rendements à cinq et vingt et une séances sont simples, sans dividendes. Les groupes sont définis par le lien économique, pas par la corrélation.',
  groups: G.map(g => ({ name: g.name, order: g.order, transmission: g.transmission,
    symbols: g.rows.map(([ticker, relationClass, role, readThrough]) => ({ ticker, role, relationClass, confidence: relationClass === 'sector_proxy' ? 'medium' : 'low', readThrough, eventRisk: evNote(ticker), ...M[ticker] })) })),
  scenarios: [
    { scenario: 'bullish', trigger: 'L’accélération organique apparaît dans les revenus du troisième trimestre et Contentful et Fin sont clôturées.', firstOrder: 'Le titre reprend ses plus hauts de septembre et le multiple se maintient.', secondOrder: 'Les éditeurs d’applications facturés à l’agent en profitent.', confirmation: 'Une clôture au-dessus du plus haut du 22 septembre sur volume soutenu.', contradiction: 'Un recul simultané de ServiceNow et du panier logiciel.' },
    { scenario: 'mixed', trigger: 'Le carnet continue d’accélérer mais les revenus organiques restent autour de six pour cent.', firstOrder: 'Le titre oscille entre le bas du 22 septembre et les plus hauts de septembre.', secondOrder: 'Les pairs d’applications restent dispersés selon leur exposition à l’IA.', confirmation: 'Aucune clôture hors de la zone entre le bas du 22 septembre et le plus haut du 16 septembre.', contradiction: 'Une annonce de gros contrat d’agents qui accélère la facturation.' },
    { scenario: 'bearish', trigger: 'La hausse des taux comprime les multiples ou un concurrent casse les prix des agents.', firstOrder: 'Le gap d’août se referme vers la clôture d’avant publication.', secondOrder: 'Les éditeurs endettés et les applications par utilisateur reculent ensemble.', confirmation: 'Une clôture sous le bas du 22 septembre et un recul du panier logiciel.', contradiction: 'Une guidance relevée à nouveau malgré la concurrence.' }],
  contradictions: ['Le carnet accélère à +14 % mais les revenus organiques progressent d’environ six pour cent : la hausse d’août paie un décalage qui doit encore se refermer.', 'La corrélation élevée avec ServiceNow et le panier logiciel montre que le titre bouge avec son secteur autant que sur ses propres chiffres, alors que les paniers technologiques larges ne l’expliquent pas.'],
  missingData: ['Chaîne d’options relevée marché fermé, inexploitable ; sentiment et tendances de recherche indisponibles.', 'Nombre d’actions après le règlement final du rachat accéléré non publié à date.', 'Contribution exacte d’Agentforce aux revenus comptables non isolée dans les comptes.'],
  sourceRefs: [market('barres comparables et classement statistique'), ref(1)] };

// ---------------------------------------------------------------- jugements éditoriaux
const judgments = { ticker: T, score_components: score, judgments: {
  'meta.version': { value: 3, reason: 'Version du schéma de dossier individualisé, non une observation financière.' },
  'meta.date': { value: a.meta.date, reason: 'Date de construction éditoriale, distincte de la clôture de référence.' },
  'meta.dateDisplay': { value: a.meta.dateDisplay, reason: 'Date éditoriale en français, non une observation financière.' },
  'verdict.score': { value: scoreValue, reason: 'Score additif : métier, technique, capital, calendrier, dilution, valorisation et base de risque.' },
  'risks.riskScore': { value: 5, reason: 'Jugement qualitatif sur dix : levier du rachat, croissance organique et concurrence sur les agents.' } } };
a.blastRadius.groups.forEach((g, i) => { judgments.judgments['blastRadius.groups.' + i + '.order'] = { value: g.order, reason: 'Classement économique éditorial du mécanisme de transmission, pas une causalité mesurée.' }; });
write(rev + '/editorial-judgments.json', judgments);

// ---------------------------------------------------------------- preuves
const inputs = [];
for (const [name, file] of [['bars', 'bars'], ['fund', 'fundamentals'], ['comparison', 'comparison_bars'], ['rank', 'rank_beta'], ['status', 'status'], ['insiders', 'insiders'], ['earn', 'comparison_earnings'], ['sec', 'sec_evidence']])
  inputs.push(K.input(name, data + '/' + file + '.json'));
inputs.push(K.input('context', data + '/comparison_context.json'));
inputs.push(K.input('primary', rev + '/primary-manifest.json', 'primary_sec_manifest_v1'), K.input('judgments', rev + '/editorial-judgments.json', 'editorial_judgment'));
const { dep, prov } = K.provenance(inputs);
const P = i => prov('primary', '/documents/' + i, 'Chiffre lu dans le dépôt SEC ouvert et haché.');
const lvlProv = k => prov('bars', lvPtr(k), 'Niveau lu sur la barre certifiée du ' + L[k].d + '.');
const gaap = () => prov('primary', '/documents/3', 'GAAP douze mois glissants au 31/07/2026 = exercice 2026 (10-K) − premier semestre FY26 + premier semestre FY27 (10-Q) ; EBITDA = résultat opérationnel + amortissements ; flux libre = flux opérationnel − investissements ; trésorerie = liquidités + titres de placement ; dette nette / EBITDA = (dette − trésorerie) / EBITDA.', [dep('primary', '/documents/1')]);
const organicProv = () => prov('primary', '/documents/1', 'Croissance hors Informatica = (revenus du trimestre 11 345 M$ − 456 M$ d’Informatica) / revenus du trimestre de l’an passé 10 236 M$ − 1.', [dep('primary', '/documents/0')]);
const marketMath = () => prov('bars', B + '/' + N + '/4', 'Capitalisation = close × 823 millions d’actions au 20 août ; EV = capitalisation + dette − trésorerie au 31/07 ; ratios sur agrégats douze mois ; P/E forward hors gains = close / (16,69 − 2,98 $) en non-GAAP ou / (10,23 − 2,87 $) en GAAP, gains du semestre lus dans la note 3 du communiqué ; multiples des pairs = statistiques courantes relevées le 24 septembre, non point-in-time ; extension = close / EMA20 − 1.', [dep('primary', '/documents/1'), dep('primary', '/documents/3'), dep('primary', '/documents/0'), dep('context', ctxRows.ADBE.ptr), dep('context', ctxRows.WDAY.ptr), dep('context', ctxRows.MSFT.ptr), dep('context', ctxRows.NOW.ptr)]);
const insiderProv = () => prov('insiders', TXP + '/transactions', 'Formulaires 4 relevés : code P (achat de marché), code S (ventes de marché), codes M et F (exercices et remises pour impôts) ; valeurs = actions × prix ; couverture officielle partielle.', [dep('sec', '')]);
const levelsGeo = () => prov('bars', lvPtr('trigger'), 'Déclencheur = plus haut du 22 septembre ; stop = plus bas du 23 septembre ; TP1 = plus haut du 16 septembre ; TP2 = plus haut du 3 septembre ; plafond = (TP1 + 1,5 × stop) / 2,5 ; pourcentages depuis l’entrée ; R/R = gain / risque.', [dep('bars', lvPtr('stop')), dep('bars', lvPtr('r1')), dep('bars', lvPtr('r3'))]);

function sourceFor(p) {
  if (/^meta\.(lastMcpRefresh|levelsVerifiedAt)$/.test(p) || p === 'blastRadius.observationTime') return prov('status', '/captured_at', 'Horodatage exact de la collecte.');
  const sh = p.match(/^meta\.statusHistory\.(\d+)\.(.+)$/);
  if (sh) return sh[2] === 'at' ? prov('status', '/captured_at', 'Horodatage de la refonte.') : prov('bars', B + '/' + N + '/4', 'Clôture de référence et date de la refonte.', [dep('bars', B + '/' + N + '/0')]);
  if (judgments.judgments[p]) return prov('judgments', '/judgments/' + esc(p) + '/value', judgments.judgments[p].reason);
  const r = p.match(/^(.*)\.sourceRefs\.(\d+)\.(date|url|name)$/);
  if (r) { const x = get(a, r[1] + '.sourceRefs.' + r[2]); if (x.url === K.evidenceUrl(T)) return prov('status', '/captured_at', 'Date de collecte, non date de cours.'); const i = docs.findIndex(d => d.url === x.url); if (i < 0) throw Error('référence inconnue ' + p); return P(i); }
  if (p === 'meta.levelsCloseDate' || p === 'blastRadius.asOf' || p === 'macro.indicators.0.value') return prov('bars', B + '/' + N + '/0', 'Dernière séance complète.');
  if (p === 'header.price' || p === 'macro.indicators.0.signal') return prov('bars', B + '/' + N + '/4', 'Clôture complète de référence.');
  if (p === 'header.changePct') return prov('bars', B + '/' + N + '/4', '100 × (close / close précédent − 1).', [dep('bars', B + '/' + (N - 1) + '/4')]);
  if (p === 'header.metrics.volume') return prov('bars', B + '/' + N + '/5', 'Volume de la séance, en millions.');
  if (p === 'meta.description' || p.startsWith('header.metrics.') || p === 'verdict.whyBuy.2') return marketMath();
  if (p.startsWith('macro.indicators.')) return prov('bars', B, 'Rendements simples cinq et vingt et une séances depuis les clôtures certifiées.');
  if (p === 'macro.impact') return prov('bars', B + '/' + N + '/0', 'Date de la clôture de référence ; rendement du Trésor à 10 ans lu dans la courbe officielle du Trésor américain (daily/20260924/primary-reference.json) ; taux fixes des obligations lus dans le 8-K du 13 mars.', [dep('primary', '/documents/5')]);
  if (p === 'verdict.summary') return prov('bars', B + '/' + N + '/4', 'Gap du 27 août et écart au plus haut du 3 septembre sur barres certifiées ; carnet, ARR, guidance, croissance hors Informatica et dette lus dans les dépôts ; multiple calculé ; niveaux lus par date.', [dep('bars', B + '/' + idx('2026-08-26') + '/4'), dep('bars', B + '/' + idx('2026-08-27') + '/4'), dep('bars', lvPtr('r3')), dep('bars', lvPtr('trigger')), dep('bars', lvPtr('abandon')), dep('primary', '/documents/0'), dep('primary', '/documents/1'), dep('primary', '/documents/3')]);
  if (p === 'verdict.whyBuy.4') return insiderProv();
  if (p === 'verdict.whyBuy.3' || p === 'verdict.whyAvoid.1' || p === 'verdict.whyAvoid.2') return P(1);
  if (p === 'verdict.whyAvoid.0') return organicProv();
  if (p === 'verdict.whyAvoid.2') return prov('primary', '/documents/1', 'Gains et résultat avant impôt du trimestre (10-Q) ; gains par action ajustée (note 3 du communiqué) ; croissance hors gains = (5,90 − 2,53) / (5,90 / 2,03) − 1, la hausse publiée étant de 103 %.', [dep('primary', '/documents/0')]);
  if (p.startsWith('verdict.whyBuy.') || p.startsWith('verdict.whyAvoid.') || p.startsWith('earnings.')) return P(0);
  if (p.startsWith('verdict.controlChecklist.')) return prov('bars', B, 'Continuité vérifiée sur les barres certifiées ; calendrier collecté.', [dep('earn', '/events')]);
  if (p === 'news.0.detail') return prov('primary', '/documents/0', 'Guidance du communiqué ; ouverture et clôture du 27 août rapportées à la clôture du 26 août.', [dep('bars', B + '/' + idx('2026-08-27') + '/1'), dep('bars', B + '/' + idx('2026-08-27') + '/4')]);
  if (p.startsWith('news.0.')) return P(0);
  if (p === 'news.1.detail') return prov('bars', B + '/' + N + '/4', 'Rendements simples du 16 au 23 septembre, CRM et IGV ; explication présentée comme hypothèse ; objectif lu dans la présentation.', [dep('bars', B + '/' + idx('2026-09-16') + '/4'), dep('comparison', C('IGV')), dep('primary', '/documents/2')]);
  if (p.startsWith('news.1.')) return P(2);
  if (p.startsWith('news.2.')) return prov('primary', '/documents/4', 'Rachat accéléré lu dans le 8-K ; livraison initiale et prix moyen lus dans le 10-Q.', [dep('primary', '/documents/1')]);
  if (p.startsWith('news.3.')) return prov('primary', '/documents/5', 'Émission lue dans le 8-K ; charge d’intérêts semestrielle lue dans le 10-Q (790 / 135).', [dep('primary', '/documents/1')]);
  if (p.startsWith('technicals.') && !/supports|resistances|setupNote|badges/.test(p)) return prov('bars', B, tech.convention + '.');
  if (p.startsWith('technicals.badges')) return prov('bars', B, 'Gap, MACD et moyennes calculés sur les barres certifiées.', [dep('bars', lvPtr('s3'))]);
  const sr = p.match(/^technicals\.(supports|resistances)\.(\d+)$/);
  if (sr) return lvlProv({ supports: ['stop', 'abandon', 's3'], resistances: ['r1', 'r2', 'r3'] }[sr[1]][+sr[2]]);
  if (p === 'technicals.setupNote') return prov('bars', B + '/' + N + '/4', 'Clôture, déclencheur, stop, abandon, supports et résistances lus sur les barres certifiées ; extension = close / EMA20 − 1.', ['trigger', 'stop', 'abandon', 's3', 'r1', 'r2', 'r3'].map(k => dep('bars', lvPtr(k))));
  if (p.startsWith('business.segments.') || p === 'business.overview') return prov('primary', '/documents/0', 'Revenus, cRPO, ARR et apport d’Informatica du communiqué ; abonnements, services, actions diluées, dette et capitaux propres du 10-Q ; rachat et émission des 8-K de mars ; parts = segment / revenus totaux.', [dep('primary', '/documents/1'), dep('primary', '/documents/4'), dep('primary', '/documents/5')]);
  if (p.startsWith('business.coverageMatrix.')) return prov('bars', B, 'Matrice de couverture de la collecte.');
  const fm = p.match(/^fundamentals\.rows\.(\d+)\./);
  if (fm) { const i = +fm[1]; if (i <= 3) return P(0); if (i === 4) return organicProv(); if (i <= 7) return P(1); if (i <= 13) return gaap(); return marketMath(); }
  if (p.startsWith('capitalStructure.sharesOutstanding')) return prov('primary', '/documents/1', 'Environ 823 millions d’actions au 20 août, page de garde du 10-Q.');
  if (p.startsWith('capitalStructure.sharesAuthorized')) return P(4);
  if (p.startsWith('capitalStructure.')) return prov('primary', '/documents/1', 'Actions diluées, rachat accéléré, livraison initiale et rémunération en actions lus dans le 10-Q ; rachat et émission lus dans les 8-K de mars.', [dep('primary', '/documents/4'), dep('primary', '/documents/5')]);
  if (/^filingsReview\.filings\.\d+\./.test(p)) return P(+p.split('.')[2]);
  if (p.startsWith('filingsReview.')) return prov('primary', '/documents/1', 'Dette, croissance hors Informatica, gains et guidance lus dans les dépôts.', [dep('primary', '/documents/0'), dep('primary', '/documents/5')]);
  if (p.startsWith('shortInterest.')) return prov('fund', STP, 'Positions vendeuses et jours de couverture du snapshot statistique ; aucune date de règlement inférée.');
  if (p.startsWith('insiders.')) return insiderProv();
  if (p.startsWith('performance.windowReturns.')) { const m = p.match(/rows\.(\d+)/), tk = m ? a.performance.windowReturns.rows[+m[1]].ticker : T; return tk === T ? prov('bars', B, 'Rendement simple vingt et une séances.') : prov('comparison', C(tk), 'Rendement simple vingt et une séances, sans dividendes.'); }
  if (p === 'blastRadius.window') return prov('comparison', C('NOW'), 'Première et dernière date communes aux séries alignées.', [dep('bars', B)]);
  const bm = p.match(/^blastRadius\.groups\.(\d+)\.symbols\.(\d+)\./);
  if (bm && /eventRisk$/.test(p)) return prov('earn', '/events', 'Calendrier de résultats des comparables sur quatorze jours ; seules les publications datées y figurent.');
  if (bm) { const row = a.blastRadius.groups[+bm[1]].symbols[+bm[2]]; return prov('comparison', C(row.ticker), 'Rendements log communs ; corrélation de Pearson ; bêta CRM sur comparable = covariance / variance du comparable ; R² = corrélation au carré ; rendements simples cinq et vingt et une séances.', [dep('bars', B)]); }
  if (p.startsWith('blastRadius.contradictions.')) return organicProv();
  if (p.startsWith('blastRadius.scenarios.')) return prov('bars', lvPtr('trigger'), 'Niveaux lus sur les barres certifiées ; guidance et croissance lues dans les dépôts.', [dep('bars', lvPtr('abandon')), dep('primary', '/documents/0')]);
  if (p.startsWith('blastRadius.')) return prov('rank', '', 'Contrôle de couverture statistique et relations économiques documentées.');
  if (/^tradeIdea\.(entry|stop)$/.test(p)) return lvlProv(p.split('.')[1] === 'entry' ? 'trigger' : 'stop');
  if (/^tradeIdea\.(tp1|tp2|stopPct|tp1Pct|tp2Pct|rr)$/.test(p)) return levelsGeo();
  if (p.startsWith('tradeIdea.')) return prov('bars', lvPtr('trigger'), 'Niveaux lus sur les barres certifiées ; plafond arrondi à l’inférieur, objectifs et taille calculés ; ATR de Wilder ; liquidité = médiane close × volume sur vingt séances ; date d’Accenture tirée des calendriers de données ; règlement du rachat lu dans le communiqué ; exécutabilité : ' + X.method, [dep('bars', lvPtr('stop')), dep('bars', lvPtr('abandon')), dep('bars', lvPtr('r1')), dep('bars', lvPtr('r3')), dep('bars', B), dep('earn', '/events')]);
  if (p.startsWith('risks.')) return prov('primary', '/documents/1', 'Dette, intérêts et croissance hors Informatica lus dans les dépôts ; ouverture et clôture du 27 août, ATR, stop et liquidité calculés sur les barres certifiées ; date d’Accenture tirée des calendriers de données.', [dep('primary', '/documents/0'), dep('bars', B), dep('earn', '/events'), dep('bars', B + '/' + idx('2026-08-27') + '/4')]);
  if (p.startsWith('verdict.')) return P(0);
  if (p === 'globalScore.keyTakeawaysPositive.2') return marketMath();
  if (p.startsWith('globalScore.') || p.startsWith('meta.') || p.startsWith('business.') || p === 'disclaimer') return P(0);
  throw Error('provenance manquante ' + p);
}
const res = K.writeEvidence({ ticker: T, ref: REF, outJson: OUT_JSON, outEvidence: OUT_EVIDENCE, calcPath: rev + '/numeric-evidence.json', generator: GEN, a, inputs, sourceFor, score,
  valuation: { basis: 'GAAP douze mois au 2026-07-31 ; valeur d’entreprise réduite de 30 % = hypothèse éditoriale (multiple courant × 0,7)', ...scn },
  extra: { gaap_inputs_millions: { K10, BAL }, technicals_recomputed: tech, levels: { exec: X, stopAtr, gapOpen, post16, peerEv, GAIN, EPS_X, EPS_GAAP_X, q2AdjGrowthX, entry, stop, abandon, tp1, tp2, rr1, rr2, cap, capRr, sizeExample, adv, extension, gap0827, peak, fromPeak },
    derived: { organic, intMult, netLev, debtJan, ev, marketCap }, insiders: { buy, buyValue, sellShares, sellValue },
    limitations: ['Options inexploitables, marché fermé.', 'Couverture officielle des formulaires 4 partielle.', 'Nombre d’actions après règlement final du rachat accéléré non publié.'] } });
K.renderPreview(a, run + '/preview/index.html');
console.log(`[CRM] claims=${res.claims} score=${scoreValue} close=${close} entry=${entry} stop=${stop} tp1=${tp1} tp2=${tp2} rr1=${rr1.toFixed(2)} rr2=${rr2.toFixed(2)} cap=${cap} capRr=${capRr.toFixed(2)} ev/rev=${(ev / G$.rev).toFixed(2)} ev/ebitda=${(ev / G$.ebitda).toFixed(1)} pe=${(close / EPS_FY27).toFixed(1)} scn=${scn.price.toFixed(2)} (${scn.downside_pct.toFixed(0)}%) organic=${organic.toFixed(2)} netLev=${netLev.toFixed(2)} gap=${gap0827.toFixed(1)} fromPeak=${fromPeak.toFixed(1)} ext=${extension.toFixed(1)}`);
