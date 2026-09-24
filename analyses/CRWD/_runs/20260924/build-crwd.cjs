'use strict';
// Dossier CRWD v3 au close du 2026-09-23. Écrit le JSON canonique, le sidecar de preuves, les
// artefacts de calcul et un aperçu LOCAL. Ne touche ni analyses/CRWD/index.html ni l'index du site.
const K = require('../../../../tools/lib/analysis-v3-kit.cjs');
const { sha, bytes, read, write, esc, get, fr, usd, pct, sgn, findPath, at, frDate } = K;
const T = 'CRWD', REF = '2026-09-23';
const run = 'analyses/CRWD/_runs/20260924', data = run + '/_data', rev = run + '/revision', prim = 'analyses/CRWD/_primary';
const OUT_JSON = 'data/analyses-data/CRWD.json', OUT_EVIDENCE = 'data/analyses-evidence/CRWD.json', GEN = run + '/build-crwd.cjs';

// ---------------------------------------------------------------- données collectées
const raw = K.loadRun(data, ['bars', 'fundamentals', 'comparison_bars', 'rank_beta', 'status', 'insiders', 'comparison_earnings', 'sec_evidence']);
const S = K.mainSeries(raw.bars, T, REF), { bars, N, B, idx, close, prev } = S;
const tech = K.technicals(bars);
const STP = findPath(raw.fundamentals, 'instrument_comprehensive_stats'), st = at(raw.fundamentals, STP);
const TXP = findPath(raw.insiders, 'instrument_insider_transactions'), tx = at(raw.insiders, TXP);
const cmpRows = raw.comparison_bars.data.items[0].results[0].data;
const C = t => { const i = cmpRows.findIndex(x => x.symbol === t); if (i < 0) throw Error('comparable absent ' + t); return '/data/items/0/results/0/data/' + i + '/bars'; };
const { M, firstCommon } = K.comparables(cmpRows, bars);
const adv = K.dollarAdv(bars), ret = k => pct(close, bars[N - k][4]);
const archive = read(run + '/original/CRWD.json');
const maxJump = bars.slice(1).reduce((m, b, i) => Math.max(m, Math.abs(Math.log(b[4] / bars[i][4]))), 0);
if (maxJump > Math.log(1.5)) throw Error('saut de prix suspect : vérifier l’ajustement du fractionnement');

// Ventes d'initiés (formulaires 4, code S) relevées dans la fenêtre collectée.
const sells = tx.transactions.filter(x => x.type_code === 'S');
const byInsider = {};
for (const x of sells) { const k = x.insider_name; byInsider[k] = byInsider[k] || { title: x.insider_title, shares: 0, value: 0, first: x.date_transaction, last: x.date_transaction }; const b = byInsider[k]; b.shares += x.shares; b.value += x.shares * x.price; if (x.date_transaction < b.first) b.first = x.date_transaction; if (x.date_transaction > b.last) b.last = x.date_transaction; }
const kurtz = byInsider['Kurtz George'], sentonas = byInsider['Sentonas Michael'], podbere = byInsider['Podbere Burt W.'];
const sellTotal = Object.values(byInsider).reduce((n, b) => n + b.value, 0), sellFirst = sells.reduce((m, x) => x.date_transaction < m ? x.date_transaction : m, sells[0].date_transaction);

// GAAP douze mois glissants au 31/07/2026 = exercice 2026 (10-K) − S1 FY26 + S1 FY27 (10-Q), en milliers.
const K10 = { rev: [4812005, 2272386, 2856526], ebit: [-293292, -224170, -63832], dep: [250218, 116834, 157597], amort: [31233, 15261, 25690],
  ocf: [1612349, 716939, 1121205], capex: [302108, 116248, 222037], capsw: [68751, 34726, 49090] };
const ttm = k => K10[k][0] - K10[k][1] + K10[k][2];
const BAL = { cash: 5013847, notes: 746216, leaseCur: 22067, leaseNon: 51896, commitments: 4141527, acquisitionsH1: 881376 };
const G$ = { rev: ttm('rev') * 1e3, ebit: ttm('ebit') * 1e3, ebitda: (ttm('ebit') + ttm('dep') + ttm('amort')) * 1e3,
  fcf: (ttm('ocf') - ttm('capex') - ttm('capsw')) * 1e3, debt: (BAL.notes + BAL.leaseCur + BAL.leaseNon) * 1e3, cash: BAL.cash * 1e3 };
const shares = st.sharesOutstanding, marketCap = close * shares, ev = marketCap + G$.debt - G$.cash;
const EPS_FY27 = 1.255; // milieu de la guidance non-GAAP 1,25–1,26 $
const scn = { multiple: ev / G$.ebitda * 0.7, ebitda: G$.ebitda, debt: G$.debt, cash: G$.cash, shares, close };
scn.enterprise_value = scn.multiple * scn.ebitda; scn.equity_value = scn.enterprise_value - scn.debt + scn.cash; scn.price = scn.equity_value / scn.shares; scn.downside_pct = (scn.price / close - 1) * 100;

// Niveaux : lus sur des barres certifiées, par date. Objectifs : mouvement mesuré de la base de septembre.
const L = { trigger: { d: '2026-09-23', c: 2 }, stop: { d: '2026-09-23', c: 3 }, abandon: { d: '2026-09-21', c: 3 },
  s2: { d: '2026-09-22', c: 3 }, baseLow: { d: '2026-09-10', c: 3 }, baseHigh: { d: '2026-09-22', c: 2 } };
const lv = k => bars[idx(L[k].d)][L[k].c], lvPtr = k => `${B}/${idx(L[k].d)}/${L[k].c}`;
const entry = lv('trigger'), stop = lv('stop'), abandon = lv('abandon'), height = lv('baseHigh') - lv('baseLow');
const tp1 = +(entry + height / 2).toFixed(2), tp2 = +(entry + height).toFixed(2);
const rr1 = (tp1 - entry) / (entry - stop), rr2 = (tp2 - entry) / (entry - stop);
const RR_MIN = 1.5, cap = Math.floor((tp1 + RR_MIN * stop) / (1 + RR_MIN) * 100) / 100, capRr = (tp1 - cap) / (cap - stop);
const sizeExample = Math.floor(100 / (entry - stop)), extension = pct(close, tech.ema20);
const X = K.execStats(bars, entry, cap, tech.atr14);
// Mouvement de cours : barres certifiées. Trois mois = depuis la clôture du 23 juin ; doublement depuis le 7 mai.
const c3m = bars[idx('2026-06-23')][4], cMay = bars[idx('2026-05-07')][4], r3m = pct(close, c3m), xMay = close / cMay;
const cPre = bars[idx('2026-08-26')][4], gapOpen = pct(bars[idx('2026-08-27')][1], cPre), gapClose = pct(bars[idx('2026-08-27')][4], cPre), pullback = pct(bars[idx('2026-09-02')][4], bars[idx('2026-08-27')][4]);
const igv0827 = (() => { const b = cmpRows.find(x => x.symbol === 'IGV').bars; return pct(b.find(x => x[0] === '2026-08-27')[4], b.find(x => x[0] === '2026-08-26')[4]); })();
const r21 = pct(close, bars[N - 21][4]), cibr21 = M.CIBR.return21d, sector21 = M.CIBR.beta * cibr21, own21 = r21 - sector21, ownShare = own21 / r21 * 100;
const toPre = pct(cPre, close);

// ---------------------------------------------------------------- sources primaires
const EDGAR = 'https://www.sec.gov/Archives/edgar/data/1535527/';
const docs = [
  ['2026-08-26', '8-K / Exhibit 99.1', '0001535527-26-000029', 'crwd-20260826xex991.htm', 'q2fy27-ex991.htm',
    'Communiqué du deuxième trimestre de l’exercice 2027 : chiffre d’affaires de 1,47 Md$ (+26 %), ARR de 5,84 Md$ (+25 %), net new ARR record de 333 M$ (+51 %), flux libre record de 377 M$. Guidance annuelle relevée : 5,99 à 6,01 Md$ de revenus et 1,25 à 1,26 $ de bénéfice ajusté par action.'],
  ['2026-08-27', '10-Q', '0001535527-26-000031', 'crwd-20260731.htm', 'q2fy27-10q.htm',
    'Rapport trimestriel : perte opérationnelle GAAP de 63,8 M$ sur le semestre, trésorerie de 5,01 Md$, obligations de 746 M$, 881 M$ d’acquisitions nettes au semestre, 4,14 Md$ d’engagements d’achat et accord de rachat des actifs de XM Cyber pour 145 M$ en numéraire et en actions.'],
  ['2026-09-11', 'S-3ASR', '0001104659-26-107123', 'tm2625079-1_s3asr.htm', 'sep11-s3asr.htm',
    'Enregistrement automatique de la revente d’au plus 2 118 022 actions par le vendeur des actifs de XM Cyber. La société n’émet rien et ne reçoit aucun produit : c’est une offre potentielle de titres existants sur le marché, pas une nouvelle dilution.'],
  ['2026-06-03', '8-K', '0001535527-26-000022', 'crwd-20260603.htm', 'jun03-8k.htm',
    'Annonce d’un fractionnement des actions à raison de quatre pour une, sous forme de dividende en actions, effectif après la clôture du 1er juillet 2026 : tous les montants par action sont ajustés depuis, y compris les barres de cours utilisées ici.'],
  ['2026-04-06', '8-K', '0001535527-26-000013', 'crwd-20260406.htm', 'apr06-8k.htm',
    'Autorisation de rachat d’actions portée à 1,5 Md$ par 500 M$ supplémentaires ; à cette date, 150,6 M$ avaient été rachetés, sans échéance ni obligation d’achat.'],
  ['2026-03-05', '10-K', '0001535527-26-000010', 'crwd-20260131.htm', 'fy26-10k.htm',
    'Rapport annuel de l’exercice clos le 31 janvier 2026 : chiffre d’affaires de 4,81 Md$, perte opérationnelle de 293 M$, flux opérationnel de 1,61 Md$ ; aucun client ni partenaire de distribution ne représente 10 % des revenus.'],
].map(([date, form, accession, file, local, finding]) => ({ date, form, accession, url: `${EDGAR}${accession.replace(/-/g, '')}/${file}`, finding, path: `${prim}/${local}`, sha256: sha(bytes(`${prim}/${local}`)) }));
const needle = (id, i, needles) => { const text = bytes(docs[i].path).toString('utf8'); for (const n of needles) if (!text.includes(n)) throw Error(`needle absent ${id}: ${n}`); return [id, { source_path: docs[i].path, source_sha256: docs[i].sha256, source_needles: needles }]; };
const primary = { kind: 'primary_sec_manifest_v1', ticker: T, as_of: '2026-09-24', inventory_count: 17, inventory_screened_count: 17, opened_count: 6, reviewed_count: 6, decision_relevant_count: 6, local_primary_count: docs.length,
  review_scope: 'Dépôts EDGAR de CrowdStrike du 1er février au 23 septembre 2026, formulaires de détention exclus. Dix-sept dépôts inventoriés ; les documents de gouvernance (DEF 14A, 8-K items 5.02, 5.03 et 5.07), le S-8 et les 13G sont écartés comme non décisionnels pour la valorisation et la dilution.',
  documents: docs,
  semantic_findings: Object.fromEntries([
    needle('q2_results', 0, ['$333 million', '$5.84 billion', 'record free cash flow of $377', '$6,603.0', '$5,991.1', '$1.25 - $1.26', '$1,523.2']),
    needle('balance', 1, ['1,023,934,842', '746,216', '5,013,847', '4,141,527', '145.0']),
    needle('cash_flow', 1, ['1,121,205', '222,037', '49,090', '881,376']),
    needle('income', 1, ['2,856,526', '63,832', '157,597', '25,690']),
    needle('resale', 2, ['2,118,022']),
    needle('split', 3, ['four-for-one stock split']),
    needle('buyback', 4, ['$500 million', '$1.5 billion']),
    needle('fy26', 5, ['4,812,005', '293,292', '250,218', '31,233', '1,612,349', '302,108', '68,751', '10% or more of the Company', 'maintained, in all material respects, effective internal control']),
    needle('controls', 1, ['disclosure controls and procedures were effective']),
  ]) };
write(rev + '/primary-manifest.json', primary);
const ref = i => ({ name: 'CrowdStrike ' + docs[i].form, url: docs[i].url, date: docs[i].date });
const market = name => ({ name: 'Données de marché datées (provenance hashée) : ' + name, url: K.evidenceUrl(T), date: '2026-09-24' });

// ---------------------------------------------------------------- le dossier
const score = { business: 28, technical: 6, capital: 2, calendar: 0, dilution: -4, valuation: -12, risk: 42 };
const scoreValue = Object.values(score).reduce((a, b) => a + b, 0);
const a = {
  meta: { lang: 'fr', dir: 'ltr', level: 'intermediate', tags: ['us', 'equities', 'ai-chain', 'software', 'technology'], grade: 'B', date: '2026-09-24', dateDisplay: '24 septembre 2026', version: 3, status: 'watch', assetType: 'stock', levelsCloseDate: REF,
    description: 'CrowdStrike : le meilleur trimestre de son histoire, un cours au record, des dirigeants qui vendent. Dossier au close du 23 septembre 2026, statut surveiller.',
    ogDescription: 'CrowdStrike : accélération de l’ARR, valorisation extrême et titre étendu ; niveaux à surveiller sans poursuivre.',
    lastMcpRefresh: raw.status.captured_at, levelsVerifiedAt: raw.status.captured_at,
    statusHistory: [{ at: raw.status.captured_at, from: archive.tradeIdea.status, to: 'watch', note: 'refonte v3 du 24 septembre : nouveau scénario, clôture de référence du 2026-09-23', close }] },
  header: { ticker: T, name: 'CrowdStrike Holdings, Inc.', exchange: 'NASDAQ', sector: 'Cybersécurité en nuage', price: close, changePct: pct(close, prev),
    badges: [{ text: 'SURVEILLER — NE PAS POURSUIVRE LA HAUSSE', color: 'blue' }, { text: 'Chaîne IA — sécurité', color: 'purple' }],
    metrics: { marketCap: fr(marketCap / 1e9, 1) + ' Md$', volume: fr(bars[N][5] / 1e6, 1) + ' M', evRevenue: fr(ev / G$.rev, 1) + '×' }, halalStatus: 'unknown' },
  verdict: { score: scoreValue, conviction: 'Moderate', bias: 'Neutral',
    confidence: 'Score éditorial non prédictif. Les chiffres d’entreprise viennent des dépôts SEC du trimestre ; les niveaux, du close certifié du 23 septembre.',
    summary: 'CrowdStrike vient de publier le meilleur trimestre de son histoire et le titre a pris ' + fr(r21, 1) + ' % en vingt et une séances, jusqu’à un record le 23 septembre. Une partie de ce mouvement n’a rien de propre au titre : sur la même fenêtre, le panier de cybersécurité CIBR a gagné ' + fr(cibr21, 1) + ' %, et avec un bêta de ' + fr(M.CIBR.beta, 2) + ' environ ' + fr(sector21, 0) + ' points s’expliquent par le secteur. Il reste ' + fr(own21, 0) + ' points, un peu moins de la moitié, propres à CrowdStrike. Le métier justifie l’enthousiasme. La croissance des nouveaux revenus récurrents accélère à 51 %, le flux de trésorerie libre bat un record et la direction relève sa prévision annuelle. Le prix, lui, suppose que tout se passe bien : la valeur d’entreprise vaut ' + fr(ev / G$.rev, 0) + ' fois le chiffre d’affaires des douze derniers mois, et le résultat opérationnel GAAP reste négatif. Dirigeants et administrateurs ont vendu pendant la hausse, le fondateur en tête. Pas d’entrée au cours actuel : le titre est très au-dessus de sa moyenne à vingt séances. Le signal utile serait une clôture au-dessus du record ; une clôture sous le bas du 21 septembre ferait abandonner le scénario.',
    whyBuy: [
      'Le net new ARR atteint un record de 333 M$, en hausse de 51 % : la croissance accélère au lieu de ralentir.',
      'La guidance annuelle est relevée à 5,99–6,01 Md$ de revenus et à un ARR de 6,60–6,61 Md$ en fin d’exercice.',
      'Le flux de trésorerie libre du trimestre, 377 M$, est un record : le modèle finance sa croissance sans lever de capital.',
      'Aucun client ni partenaire ne pèse 10 % du chiffre d’affaires : la demande est répartie sur une large base d’entreprises.'],
    whyAvoid: [
      'Au close du 23 septembre, la valeur d’entreprise représente ' + fr(ev / G$.rev, 1) + ' fois les revenus GAAP des douze mois clos le 31 juillet, et ' + fr(ev / G$.fcf, 0) + ' fois le flux libre : le prix anticipe plusieurs années de croissance parfaite.',
      'Le résultat opérationnel GAAP du semestre reste négatif, à −63,8 M$ : le bénéfice ajusté exclut une rémunération en actions de 674,6 M$ sur six mois.',
      'Le titre clôture ' + fr(extension, 1) + ' % au-dessus de sa moyenne à vingt séances, avec un RSI proche de 70 : acheter ici, c’est payer l’euphorie.',
      'Dirigeants et administrateurs ont vendu environ ' + fr(sellTotal / 1e6, 0) + ' M$ d’actions dans la fenêtre relevée, sans aucun achat : l’intérieur allège pendant que le marché achète.'],
    controlChecklist: [
      { label: 'Historique de cours', status: 'pass', statusLabel: 'Trois cents séances ajustées', evidence: 'Série certifiée au close du 23 septembre, fractionnement de quatre pour une intégré.', action: 'Niveaux et indicateurs recalculés sur cette seule série.' },
      { label: 'Extension', status: 'warn', statusLabel: 'Très au-dessus des moyennes', evidence: 'Titre au record, très loin de sa moyenne à vingt séances.', action: 'Ne pas poursuivre ; attendre le déclencheur de clôture.' },
      { label: 'Calendrier', status: 'warn', statusLabel: 'Prochains résultats non confirmés', evidence: 'Aucune date publiée par CrowdStrike. Micron (30 septembre) et Accenture (1er octobre) publient dans l’horizon selon les calendriers de données, dates non confirmées ici par ces émetteurs.', action: 'Compter avec un gap possible sur le logiciel et la sécurité les 1er et 2 octobre.' }] },
  business: { theme: 'Plateforme de cybersécurité en nuage pour les entreprises',
    overview: '<p>CrowdStrike vend une plateforme de sécurité par abonnement, Falcon : protection des postes, des identités, du cloud et des données, pilotée depuis une seule console. Au trimestre clos le 31 juillet 2026, les abonnements ont pesé 1,40 Md$ sur 1,47 Md$ de revenus, en hausse de 27 %.</p><p>L’indicateur qui compte est l’ARR, le revenu récurrent annualisé : 5,84 Md$, en hausse de 25 %. Surtout, le net new ARR, ce qui s’ajoute chaque trimestre, a accéléré à 333 M$, en hausse de 51 %. La formule d’achat groupée Falcon Flex dépasse 2,29 Md$ d’ARR. L’argument de la direction est simple : chaque entreprise qui déploie des agents d’IA ouvre de nouvelles portes à sécuriser.</p><p>Deux ombres au tableau, l’une comptable, l’autre boursière. Le résultat opérationnel GAAP reste négatif parce que la rémunération en actions, 674,6 M$ sur le semestre, est une charge réelle que le bénéfice ajusté exclut. La société a dépensé 881 M$ en acquisitions au semestre et s’est engagée sur 4,14 Md$ d’achats, surtout d’hébergement cloud. Et le cours a pris ' + fr(r3m, 0) + ' % en trois mois (' + usd(c3m) + ' le 23 juin, ' + usd(close) + ' le 23 septembre) ; il a doublé depuis début mai : le marché ne paie plus seulement la croissance, il paie son accélération.</p>',
    moat: 'L’avantage tient à la plateforme unique et à la donnée : plus Falcon surveille de postes, plus sa détection s’améliore, et une entreprise qui a consolidé ses outils chez CrowdStrike change rarement de fournisseur. La concurrence de Microsoft et de Palo Alto Networks reste frontale sur les mêmes budgets.',
    segments: [
      { name: 'Abonnements', revenue: '1,40 Md$ au trimestre', pct: '95 %', description: 'En hausse de 27 % sur un an ; marge brute ajustée de 81 %.' },
      { name: 'Services professionnels', revenue: '0,07 Md$ au trimestre', pct: '5 %', description: 'Réponse aux incidents et accompagnement.' }],
    sourceRefs: [ref(0), ref(1)],
    coverageMatrix: [
      { facet: 'Cours et historique', status: 'COUVERT', decision: 'Trois cents séances ajustées du fractionnement, close certifié ; base des niveaux.' },
      { facet: 'Résultats et guidance', status: 'COUVERT — PRIMAIRE', decision: 'Communiqué du 26 août et 10-Q ; prochaine date non confirmée.' },
      { facet: 'Capital et dilution', status: 'COUVERT — PRIMAIRE', decision: 'Revente enregistrée de titres existants, rachats et fractionnement séparés.' },
      { facet: 'Comparables et transmission', status: 'COUVERT — LOCAL', decision: 'Corrélations recalculées sur barres certifiées depuis la fin mars.' },
      { facet: 'Initiés', status: 'PARTIEL', decision: 'Ventes relevées, couverture officielle incomplète : aucun solde net affirmé.' },
      { facet: 'Options', status: 'NON EXPLOITABLE', decision: 'Chaîne relevée marché fermé.' },
      { facet: 'Sentiment et tendances de recherche', status: 'INDISPONIBLE', decision: 'Aucune mesure qualifiée ; non utilisé.' }] },
  news: [
    { date: '2026-08-26', title: 'Deuxième trimestre record : net new ARR de 333 M$', impact: 'positive', detail: 'Le lendemain, le titre ouvre à ' + sgn(gapOpen, 1) + ' et clôture à ' + sgn(gapClose, 1) + ' ; le même jour, le panier logiciel IGV prend ' + sgn(igv0827, 1) + ', la hausse n’est donc pas propre à la sécurité.', source: 'CrowdStrike — SEC', sourceUrl: docs[0].url },
    { date: '2026-09-11', title: 'Revente enregistrée de 2,1 millions d’actions', impact: 'neutral', detail: 'Le vendeur des actifs de XM Cyber pourra céder ses titres sur le marché ; cela ajoute une offre ponctuelle, sans nouvelle émission par la société.', source: 'CrowdStrike — SEC', sourceUrl: docs[2].url },
    { date: '2026-06-03', title: 'Fractionnement des actions à quatre pour une', impact: 'neutral', detail: 'L’opération ne change pas la valeur de l’entreprise mais divise le prix par quatre : tout niveau antérieur à juillet doit être lu en base ajustée.', source: 'CrowdStrike — SEC', sourceUrl: docs[3].url },
    { date: '2026-04-06', title: 'Rachats d’actions portés à 1,5 Md$', impact: 'positive', detail: 'L’autorisation compense en partie la dilution de la rémunération en actions, mais reste modeste face à une capitalisation de plus de deux cents milliards.', source: 'CrowdStrike — SEC', sourceUrl: docs[4].url }],
  fundamentals: { rows: [
      { metric: 'Chiffre d’affaires du trimestre', value: '1,47 Md$', signal: '+26 % sur un an, communiqué du 26 août', signalColor: 'green' },
      { metric: 'ARR en fin de trimestre', value: '5,84 Md$', signal: '+25 % sur un an', signalColor: 'green' },
      { metric: 'Net new ARR du trimestre', value: '333 M$', signal: '+51 % sur un an, record', signalColor: 'green' },
      { metric: 'Guidance de revenus de l’exercice', value: '5,99–6,01 Md$', signal: 'Relevée le 26 août', signalColor: 'blue' },
      { metric: 'Résultat opérationnel GAAP du semestre', value: '−63,8 M$', signal: 'Six mois clos le 31 juillet, 10-Q', signalColor: 'red' },
      { metric: 'Rémunération en actions du semestre', value: '674,6 M$', signal: 'Exclue du bénéfice ajusté, 10-Q', signalColor: 'amber' },
      { metric: 'Flux libre sur douze mois', value: fr(G$.fcf / 1e9, 2) + ' Md$', signal: 'Flux opérationnel − investissements − logiciels capitalisés, douze mois au 31 juillet 2026', signalColor: 'green' },
      { metric: 'Revenus GAAP sur douze mois', value: fr(G$.rev / 1e9, 2) + ' Md$', signal: 'Douze mois glissants au 31 juillet 2026 (10-K + 10-Q)', signalColor: 'blue' },
      { metric: 'EBITDA GAAP sur douze mois', value: fr(G$.ebitda / 1e9, 2) + ' Md$', signal: 'Résultat opérationnel + amortissements, douze mois au 31 juillet 2026', signalColor: 'amber' },
      { metric: 'Trésorerie au 31 juillet', value: fr(G$.cash / 1e9, 2) + ' Md$', signal: 'Bilan du 10-Q', signalColor: 'green' },
      { metric: 'Dette au 31 juillet (obligations + loyers)', value: fr(G$.debt / 1e9, 2) + ' Md$', signal: 'Obligations senior et passifs de location, bilan du 10-Q', signalColor: 'blue' },
      { metric: 'EV/revenus GAAP', value: fr(ev / G$.rev, 1) + '×', signal: 'Enterprise value au close du 2026-09-23 sur revenus GAAP douze mois au 2026-07-31', signalColor: 'red', source: 'Clôture certifiée, 10-K et 10-Q', comparison: 'Versus une croissance de 26 % : le multiple suppose plusieurs années de croissance au-dessus de 20 %.' },
      { metric: 'EV/flux de trésorerie libre', value: fr(ev / G$.fcf, 0) + '×', signal: 'Enterprise value au close du 2026-09-23 sur flux libre douze mois au 2026-07-31', signalColor: 'red', source: 'Clôture certifiée, 10-K et 10-Q', comparison: 'Versus le scénario ci-dessous : même un flux libre en forte hausse laisse le multiple élevé.' },
      { metric: 'P/E forward sur guidance non-GAAP', value: fr(close / EPS_FY27, 0) + '×', signal: 'Forward : close du 2026-09-23 sur bénéfice ajusté non-GAAP de 1,25–1,26 $ guidé pour l’exercice 2027', signalColor: 'red', source: 'Clôture certifiée et communiqué du 26 août', comparison: 'Versus le P/E GAAP, non calculable : le bénéfice ajusté exclut la rémunération en actions.' },
      { metric: 'Scénario : valeur d’entreprise −30 % (hypothèse éditoriale)', value: fr(scn.price, 2) + ' $ par action', signal: 'Scénario : valeur d’entreprise réduite de 30 % par hypothèse, trésorerie et dette du 2026-07-31 inchangées, soit ' + fr(scn.downside_pct, 0) + ' % sous le close du 2026-09-23', signalColor: 'red', source: 'Clôture certifiée, 10-K et 10-Q', comparison: 'Versus le close : pour repère, la clôture d’avant publication, ' + usd(cPre) + ' le 26 août, se situe ' + fr(-toPre, 1) + ' % sous le cours, près de ce scénario ; ce n’est pas un objectif.' }],
    sourceRefs: [ref(0), ref(1), market('fondamentaux et statistiques')] },
  earnings: { quarters: [],
    beatNote: 'Deuxième trimestre de l’exercice 2027 : bénéfice ajusté de 0,31 $ par action, en base après fractionnement, et bénéfice GAAP de 0,01 $. La guidance du troisième trimestre vise 1,52 à 1,53 Md$ de revenus et 0,31 $ de bénéfice ajusté ; celle de l’exercice, relevée, vise 5,99 à 6,01 Md$ de revenus, un ARR de 6,60 à 6,61 Md$ et 1,25 à 1,26 $ par action. L’écart entre ajusté et GAAP tient surtout à la rémunération en actions. Aucune date de prochaine publication n’est confirmée par l’émetteur à ce jour.',
    nextEarnings: 'Date non confirmée par l’émetteur ; aucune publication dans les quatorze jours du calendrier collecté.',
    sourceRefs: [ref(0)] },
  capitalStructure: { sharesOutstanding: fr(shares / 1e9, 3) + ' milliard d’actions au 20 août 2026, après fractionnement (page de garde du 10-Q)',
    sharesAuthorized: 'Deux milliards d’actions de classe A autorisées, en base après fractionnement, selon le bilan du 10-Q.',
    dilutionRisk: 'moderate',
    shareHistory: 'Le fractionnement de quatre pour une du 1er juillet 2026 a quadruplé le nombre d’actions sans rien changer à la valeur : environ 1,024 milliard d’actions au 20 août. La dilution réelle vient de la rémunération en actions, 674,6 M$ sur le semestre, et des acquisitions payées en partie en titres ; les rachats, 1,5 Md$ autorisés, n’en compensent qu’une partie. La revente enregistrée de 2,1 millions d’actions par le vendeur de XM Cyber ajoute une offre, pas une émission. Un nombre d’actions entièrement dilué à date n’est pas calculable depuis ces seuls dépôts.',
    warrants: [],
    atm: { active: false, authorized: 'Aucun programme d’émission d’actions relevé', used: 'Sans objet', remaining: 'Sans objet' },
    sourceRefs: [ref(1), ref(2), ref(3), ref(4)] },
  filingsReview: { summary: 'Six dépôts décisionnels ouverts et hachés, sur dix-sept inventoriés. L’auditeur conclut dans le 10-K que la société « maintained, in all material respects, effective internal control », et le 10-Q juge les contrôles de publication efficaces. Ils séparent l’excellence opérationnelle du trimestre, la structure du capital, qui ne se dilue que par la rémunération en actions et les acquisitions, et une offre de titres existants à venir sur le marché.',
    filings: docs.map(d => ({ date: d.date, form: d.form, accession: d.accession, finding: d.finding, url: d.url })),
    contrarianRisks: [
      'Le bénéfice ajusté exclut une rémunération en actions supérieure au flux libre semestriel : l’actionnaire paie cette charge par la dilution.',
      'Le cours a pris ' + fr(r3m, 0) + ' % en trois mois et doublé depuis début mai : une publication simplement conforme pourrait décevoir un marché qui attend une nouvelle accélération.',
      'Dirigeants et administrateurs vendent pendant la hausse ; ce n’est pas un signal négatif en soi, mais personne à l’intérieur n’achète.',
      'Microsoft intègre la sécurité dans ses offres existantes : sur les petites et moyennes entreprises, le prix peut l’emporter sur la qualité.',
      'Les 881 M$ d’acquisitions du semestre et les engagements d’hébergement de 4,14 Md$ pèseront sur la marge si la croissance ralentit.'] },
  technicals: { rsi14: +tech.rsi14.toFixed(2), macd: +tech.macd.toFixed(2), macdSignal: +tech.macdSignal.toFixed(2), ema20: +tech.ema20.toFixed(2), ema50: +tech.ema50.toFixed(2), ema200: +tech.ema200.toFixed(2),
    ma50Type: 'EMA', ma200Type: 'EMA', ma50Available: true, ma200Available: true, atr14: +tech.atr14.toFixed(2),
    badges: ['Record historique le 23 septembre', 'Très au-dessus de la moyenne à vingt séances', 'Ne pas poursuivre'],
    supports: [stop, lv('s2'), abandon],
    resistances: [entry],
    setupNote: 'Le titre clôture à ' + usd(close) + ', juste sous son record de ' + usd(entry) + ' et ' + fr(extension, 1) + ' % au-dessus de sa moyenne à vingt séances. Avant activation, aucune entrée ; une clôture sous ' + usd(abandon) + ', le bas du 21 septembre, abandonne le scénario. Activation sur une clôture au-dessus de $' + entry.toFixed(2) + ', le plus haut du 23 septembre. Après activation, stop sous $' + stop.toFixed(2) + ', le bas de la même séance. Supports : ' + usd(stop) + ', ' + usd(lv('s2')) + ' et ' + usd(abandon) + '. Aucune résistance au-dessus du record.',
    wyckoff: 'Non utilisé : le profil de volume n’est pas exploité dans ce dossier.',
    sourceRefs: [market('barres quotidiennes et indicateurs recalculés')] },
  performance: { windowReturns: { label: 'Rendements de prix sur vingt et une séances, sans dividendes réinvestis', startDate: bars[N - 21][0], endDate: bars[N][0],
      rows: [{ ticker: T, returnPct: +ret(21).toFixed(2) }, ...Object.entries(M).map(([ticker, x]) => ({ ticker, returnPct: x.return21d }))] },
    sourceRefs: [market('barres quotidiennes comparées')] },
  options: { callOI: 'Non exploitable', putOI: 'Non exploitable', cpRatio: 'Non exploitable', maxPain: 'Non exploitable', ivMean: 'Non exploitable', skew: 'Chaîne relevée marché fermé', unusual: 'Aucune activité inhabituelle qualifiée', sourceRefs: [market('options')] },
  shortInterest: { siPct: fr(st.shortPercentOfFloat * 100, 2) + ' % du flottant', daysToCover: fr(st.shortRatio, 2) + ' jours, date de règlement non précisée par le snapshot', ctb: 'Coût d’emprunt bas, sans tension', trend: 'Positions vendeuses faibles ; aucune thèse de rachat forcé des vendeurs.', squeezeScore: 'Non pertinent', sourceRefs: [market('positions vendeuses')] },
  insiders: { signal: 'Ventes de marché uniquement dans la fenêtre relevée, depuis le ' + frDate(sellFirst) + ', aucun achat. George Kurtz, fondateur et directeur général, a vendu environ ' + fr(kurtz.shares, 0) + ' actions pour environ ' + fr(kurtz.value / 1e6, 1) + ' M$ ; le président et le directeur financier ont aussi vendu. Le total relevé, dirigeants et administrateurs compris, atteint environ ' + fr(sellTotal / 1e6, 0) + ' M$. Couverture officielle partielle : aucun solde net publié, et aucun plan de cession programmé n’est affirmé faute de mention relevée.',
    recentTransactions: [
      { date: kurtz.last, insider: 'George Kurtz — fondateur et direction générale', type: 'sell', shares: fr(kurtz.shares, 0), value: fr(kurtz.value / 1e6, 1) + ' M$ cumulés depuis le ' + frDate(kurtz.first) },
      { date: sentonas.last, insider: 'Michael Sentonas — présidence', type: 'sell', shares: fr(sentonas.shares, 0), value: fr(sentonas.value / 1e6, 1) + ' M$ cumulés depuis le ' + frDate(sentonas.first) },
      { date: podbere.last, insider: 'Burt Podbere — direction financière', type: 'sell', shares: fr(podbere.shares, 0), value: fr(podbere.value / 1e6, 1) + ' M$ cumulés depuis le ' + frDate(podbere.first) }],
    sourceRefs: [market('formulaires 4')] },
  blastRadius: {},
  macro: { indicators: [{ name: 'Clôture de référence', value: REF, signal: usd(close) + ', séance complète' }, { name: 'Rendement cinq séances', value: sgn(ret(5)), signal: 'Descriptif' }, { name: 'Rendement vingt et une séances', value: sgn(ret(21)), signal: 'Descriptif' }],
    regime: 'neutral', impact: 'Un logiciel valorisé à ' + fr(ev / G$.rev, 0) + ' fois ses revenus est très sensible aux taux longs : le 10 ans américain a clôturé à 5,11 % le 23 septembre, plus haut depuis juillet 2007. La cybersécurité résiste mieux que le logiciel en général, mais le multiple n’est pas immunisé.' },
  risks: { riskScore: 6, riskProfile: 'High',
    riskSummary: 'L’entreprise tient ses promesses ; le cours, lui, en demande davantage. Le marché paie l’accélération de la croissance : il faut qu’elle continue trimestre après trimestre. Une publication simplement bonne, une hausse des taux ou une vente plus lourde des dirigeants suffisent à faire reculer un titre qui a pris ' + fr(r3m, 0) + ' % en trois mois.',
    riskCards: [
      { title: 'Valorisation et attentes', severity: 'high', icon: 'fa-scale-balanced', points: ['Valeur d’entreprise de ' + fr(ev / G$.rev, 0) + ' fois les revenus.', 'P/E forward sur bénéfice ajusté supérieur à deux cents fois.'], verdict: 'Le moindre ralentissement de l’ARR se paierait par une compression brutale du multiple.' },
      { title: 'Extension technique', severity: 'high', icon: 'fa-rocket', points: ['Cours au record, très loin de la moyenne à vingt séances.', 'Ouverture à ' + sgn(gapOpen, 1) + ' puis clôture à ' + sgn(gapClose, 1) + ' le lendemain des résultats.'], verdict: 'Acheter maintenant, c’est accepter un retour possible vers la moyenne avant toute poursuite.' },
      { title: 'Ventes des dirigeants et administrateurs', severity: 'medium', icon: 'fa-user-tie', points: ['Ventes du fondateur, du président, du directeur financier et de plusieurs administrateurs dans la fenêtre relevée.', 'Aucun achat d’initié.'], verdict: 'Pas un signal de fraude, mais une offre régulière de titres pendant la hausse.' },
      { title: 'Rémunération en actions', severity: 'medium', icon: 'fa-money-bill-trend-up', points: ['674,6 M$ sur le semestre, exclus du bénéfice ajusté.', 'Rachats autorisés de 1,5 Md$ au total.'], verdict: 'La dilution est lente mais continue ; le bénéfice ajusté la masque.' }],
    pedagogy: 'Le 27 août, le titre a ouvert à ' + sgn(gapOpen, 1) + ' et clôturé à ' + sgn(gapClose, 1) + '. Il a encore clôturé plus haut le 31 août, à ' + usd(bars[idx('2026-08-31')][4]) + ', puis a reculé de ' + fr(-pct(bars[idx('2026-09-02')][4], bars[idx('2026-08-31')][4]), 1) + ' % en deux séances ; acheter en clôture le 27 a coûté ' + fr(-pullback, 1) + ' % jusqu’au 2 septembre. Le slippage, quelques cents sur un titre qui échange ' + fr(adv / 1e9, 1) + ' Md$ par jour, n’est pas le vrai danger ; le gap l’est : un gap peut faire sortir sous le stop de ' + usd(stop) + ', et la perte dépasse alors le risque prévu. Micron le 30 septembre et Accenture le 1er octobre peuvent en provoquer un. La taille découle de la distance au stop : ' + sizeExample + ' actions pour 100 $ de perte acceptée. Rien à acheter tant que la clôture de déclenchement n’est pas là.' },
  tradeIdea: { status: 'watch', statusNote: 'Surveiller. Avant activation : aucune entrée ; une clôture sous ' + usd(abandon) + ' abandonne le scénario. Activation : clôture au-dessus de ' + usd(entry) + ', puis achat à l’ouverture suivante seulement sous ' + usd(cap) + '. Après activation : stop sous ' + usd(stop) + '.',
    entry, stop, tp1, tp2,
    stopPct: pct(stop, entry).toFixed(1) + '%', tp1Pct: '+' + pct(tp1, entry).toFixed(1) + '%', tp2Pct: '+' + pct(tp2, entry).toFixed(1) + '%',
    rr: '1:' + rr1.toFixed(2) + ' TP1 / 1:' + rr2.toFixed(2) + ' TP2',
    entryNote: 'Déclencheur sur clôture au-dessus du record du 23 septembre, pas sur un franchissement en séance. Entrée à l’ouverture suivante uniquement sous ' + usd(cap) + ' : au-delà, le R/R vers TP1 tomberait sous 1,5 avec le même stop. Une clôture de déclenchement déjà au-dessus de ' + usd(cap) + ', ou une ouverture au-delà, annule l’entrée. La marge n’est que de ' + usd(cap - entry) + ', ' + fr(X.bufAtr, 2) + ' ATR. ' + fr(X.gapAll, 0) + ' % des séances de la série (' + fr(X.gap60, 0) + ' % sur les soixante dernières) ont ouvert plus haut que la veille d’au moins cet écart, et l’historique confirme la difficulté. On appelle activation une clôture au-dessus du plus haut de la veille ; l’achat n’est possible que si cette clôture reste dans le tampon et si l’ouverture suivante reste sous le plafond. Avec le tampon fixe de ' + usd(cap - entry) + ', ' + X.fixedExec + ' activations sur ' + X.fixedBreakouts + ' depuis juillet 2025 l’auraient permis ; avec un tampon proportionnel à l’ATR du moment, ' + X.exec + ' sur ' + X.breakouts + '. Ce plan sera presque toujours annulé : il dit surtout à quel prix ne pas acheter. Objectifs tirés du mouvement mesuré de la base de septembre, du bas du 10 au haut du 22 : TP1 à la moitié de sa hauteur au-dessus du déclencheur, TP2 à sa hauteur entière. Liquidité : environ ' + fr(adv / 1e9, 1) + ' Md$ échangés par séance, médiane des vingt dernières. Exemple de taille, non personnalisé : 100 $ de perte maximale divisés par ' + usd(entry - stop) + ' de risque par action, soit ' + sizeExample + ' actions.',
    horizon: 'Dix séances après activation',
    thesis: 'Le marché paie l’accélération de CrowdStrike : la question n’est plus la qualité, c’est le point d’entrée. Avant activation, le dossier reste en surveillance et une clôture sous ' + usd(abandon) + ' l’abandonne. Une clôture au-dessus de $' + entry.toFixed(2) + ' confirmerait que les acheteurs absorbent les ventes des dirigeants ; l’entrée n’a lieu qu’à l’ouverture suivante et sous ' + usd(cap) + '. Après activation, le stop sous $' + stop.toFixed(2) + ' limite le risque à la dernière séance. TP1 à ' + usd(tp1) + ' et TP2 à ' + usd(tp2) + ' prolongent la base de septembre. Exécution improbable, taille limitée à l’exemple chiffré : titre étendu, ne pas anticiper le déclencheur.',
    catalysts: ['Une clôture au-dessus du record du 23 septembre, sur volume au moins égal à la médiane récente.', 'L’absence de nouvelle vente importante des dirigeants et administrateurs dans les formulaires 4.', 'Les résultats de Micron (30 septembre) et d’Accenture (1er octobre), dates tirées des calendriers de données : un risque de gap sur tout le logiciel.', 'Toute annonce de nouveaux clients Falcon Flex ou de révision de la guidance avant la prochaine publication, dont la date n’est pas confirmée.'],
    invalidation: ['Avant activation : une clôture sous ' + usd(abandon) + ', bas du 21 septembre, abandonne le scénario.', 'Après activation : une clôture sous ' + usd(stop) + ' invalide le trade.', 'Ouverture au-dessus de ' + usd(cap) + ' après la clôture de déclenchement : pas d’achat, le R/R deviendrait insuffisant.', 'Une révision à la baisse de la guidance d’ARR annule la thèse avant activation.'] },
  globalScore: { profile: 'Qualité exceptionnelle, prix exigeant',
    keyTakeawaysPositive: ['Croissance récurrente en accélération.', 'Flux de trésorerie libre record, sans levée de capital.', 'Base de clients large, sans dépendance à un acheteur.'],
    keyTakeawaysNegative: ['Valorisation qui suppose une croissance parfaite.', 'Titre étendu après +' + fr(r3m, 0) + ' % en trois mois.', 'Dirigeants et administrateurs vendeurs, aucun achat.'],
    mindsetTip: 'Une très bonne entreprise peut être un mauvais achat au mauvais prix. Le bon trimestre est connu ; le prix d’entrée, lui, se choisit.' },
  social: { platforms: [], sourceRefs: [market('sentiment non retenu faute de mesure qualifiée')] },
  disclaimer: 'Document de recherche éducatif. Ni conseil financier, ni signal de trading. Statut surveiller : aucun ordre actif.',
};

// ---------------------------------------------------------------- blast radius
const G = [
  { name: 'Leaders de la sécurité', order: 1, transmission: 'Ils fixent le prix et le périmètre des plateformes de sécurité ; leurs choix déplacent les budgets.', rows: [
    ['PANW', 'leader', 'Premier éditeur de sécurité réseau et cloud', 'Concurrent frontal sur la consolidation des outils : ses résultats disent si les clients regroupent leurs achats chez un seul fournisseur.'],
    ['MSFT', 'leader', 'Sécurité intégrée à son écosystème', 'Son offre groupée met la pression sur les prix, surtout chez les entreprises moyennes déjà clientes de ses logiciels.']] },
  { name: 'Pairs directs', order: 1, transmission: 'Même budget de sécurité, même cycle de renouvellement des contrats.', rows: [
    ['ZS', 'direct_peer', 'Sécurité des accès réseau en nuage', 'Même clientèle de grandes entreprises ; ses gains signalent la santé de la sécurité en nuage.'],
    ['FTNT', 'direct_peer', 'Pare-feu et sécurité réseau', 'Cycle matériel différent, mêmes directions informatiques : un ralentissement chez lui peut précéder celui des budgets.'],
    ['S', 'direct_peer', 'Concurrent direct sur les postes', 'Concurrent le plus proche sur la protection des postes ; ses prix disent si la concurrence se durcit.'],
    ['OKTA', 'direct_peer', 'Gestion des identités', 'L’identité est le second front de Falcon ; sa croissance mesure la demande de sécurité des agents d’IA.'],
    ['NET', 'direct_peer', 'Réseau et sécurité en périphérie', 'Même argument de plateforme unique ; sa valorisation encadre celle des logiciels de sécurité en croissance.'],
    ['TENB', 'direct_peer', 'Gestion des vulnérabilités', 'Module concurrent de Falcon ; sa faiblesse relative mesure la pression de la consolidation.'],
    ['RBRK', 'direct_peer', 'Sauvegarde et cyber-résilience', 'Même budget de résilience après incident ; très corrélé en séance aux publications du secteur.'],
    ['QLYS', 'direct_peer', 'Conformité et vulnérabilités', 'Acteur plus petit du même périmètre ; sensible aux gains de parts des plateformes.']] },
  { name: 'Amont : hébergement cloud', order: 1, transmission: 'Falcon tourne sur les grands clouds ; leurs prix fixent une partie du coût de revient.', rows: [
    ['AMZN', 'upstream', 'Hébergeur principal de la plateforme', 'Une partie des 4,14 Md$ d’engagements d’achat porte sur l’hébergement ; ses tarifs pèsent sur la marge brute.'],
    ['GOOGL', 'upstream', 'Hébergeur et concurrent en sécurité', 'Fournisseur d’hébergement et concurrent via ses propres offres de sécurité.']] },
  { name: 'Second ordre : logiciels d’entreprise', order: 2, transmission: 'Mêmes budgets informatiques et même sensibilité des multiples aux taux.', rows: [
    ['DDOG', 'second_order', 'Supervision des infrastructures cloud', 'Autre bénéficiaire des migrations cloud ; son rythme mesure la croissance des charges hébergées.'],
    ['NOW', 'second_order', 'Plateforme de flux de travail d’entreprise', 'Même client, la direction informatique ; ses commentaires sur les budgets valent pour la sécurité.'],
    ['SNOW', 'second_order', 'Plateforme de données', 'Partage l’argument de la donnée comme avantage ; sensible aux mêmes révisions de multiples.'],
    ['MDB', 'second_order', 'Base de données en nuage', 'Même profil de croissance valorisée sur le long terme ; lecture de la tolérance du marché aux multiples élevés.']] },
  { name: 'Contrôles sectoriels', order: 2, transmission: 'Paniers de référence pour séparer le mouvement du titre de celui de son secteur.', rows: [
    ['CIBR', 'sector_proxy', 'Panier de cybersécurité', 'Un écart de performance avec ce panier isole ce qui est propre à CrowdStrike.'],
    ['HACK', 'sector_proxy', 'Panier de cybersécurité équipondéré', 'Moins concentré : montre si la hausse du secteur se fait sans les plus grandes valeurs.'],
    ['IGV', 'sector_proxy', 'Panier de logiciels américains', 'Contrôle large du logiciel : un mouvement commun n’a rien de spécifique à la sécurité.']] },
];
const EV = {
  PANW: 'Aucune publication dans les quatorze jours collectés ; ses annonces de consolidation restent le signal concurrent',
  MSFT: 'Aucune publication dans les quatorze jours collectés ; ses offres groupées de sécurité peuvent peser sur les prix',
  ZS: 'Aucune publication dans les quatorze jours collectés ; ses commentaires de demande valent pour le secteur',
  FTNT: 'Aucune publication dans les quatorze jours collectés ; son cycle matériel peut précéder les budgets',
  S: 'Aucune publication dans les quatorze jours collectés ; sa politique de prix est le premier signal concurrentiel',
  OKTA: 'Aucune publication dans les quatorze jours collectés ; la demande d’identité suit celle des agents d’IA',
  NET: 'Aucune publication dans les quatorze jours collectés ; sa valorisation sert de référence au secteur',
  TENB: 'Aucune publication dans les quatorze jours collectés ; sa faiblesse relative mesure la consolidation',
  RBRK: 'Aucune publication dans les quatorze jours collectés ; très réactif aux publications de ses pairs',
  QLYS: 'Aucune publication dans les quatorze jours collectés ; sensible aux gains de parts des plateformes',
  AMZN: 'Aucune publication dans les quatorze jours collectés ; ses tarifs d’hébergement pèsent sur la marge',
  GOOGL: 'Aucune publication dans les quatorze jours collectés ; ses offres de sécurité concurrencent Falcon',
  DDOG: 'Aucune publication dans les quatorze jours collectés ; son rythme reflète la croissance des charges cloud',
  NOW: 'Aucune publication dans les quatorze jours collectés ; ses commentaires de budgets informatiques comptent',
  SNOW: 'Aucune publication dans les quatorze jours collectés ; sensible aux révisions de multiples',
  MDB: 'Aucune publication dans les quatorze jours collectés ; lecture de la tolérance aux multiples élevés',
  CIBR: 'Panier sans publication propre ; dominé par les grandes valeurs de sécurité',
  HACK: 'Panier sans publication propre ; plus sensible aux valeurs moyennes',
  IGV: 'Panier sans publication propre ; exposé aux grandes pondérations logicielles' };
const evNote = t => { if (!EV[t]) throw Error('eventRisk manquant ' + t); return EV[t]; };
a.blastRadius = {
  asOf: REF, observationTime: raw.status.captured_at,
  window: 'Rendements quotidiens communs du ' + firstCommon + ' au ' + REF,
  methodology: 'Les séries sont alignées sur les mêmes dates de clôture et converties en rendements logarithmiques journaliers communs, depuis la fin mars, en base ajustée du fractionnement de juillet. La corrélation mesure le co-mouvement ; le bêta mesure la sensibilité du rendement de CrowdStrike à celui du comparable ; le R² est la corrélation au carré. Les rendements à cinq et vingt et une séances sont simples, sans dividendes. Les groupes sont définis par le lien économique, pas par la corrélation.',
  groups: G.map(g => ({ name: g.name, order: g.order, transmission: g.transmission,
    symbols: g.rows.map(([ticker, relationClass, role, readThrough]) => ({ ticker, role, relationClass, confidence: ['sector_proxy', 'leader', 'direct_peer'].includes(relationClass) ? 'medium' : 'low', readThrough, eventRisk: evNote(ticker), ...M[ticker] })) })),
  scenarios: [
    { scenario: 'bullish', trigger: 'La croissance de l’ARR continue d’accélérer et Falcon Flex étend sa base de clients.', firstOrder: 'Le titre sort de son record par le haut et la cybersécurité suit.', secondOrder: 'Les pairs directs profitent de la demande générale de sécurité liée à l’IA.', confirmation: 'Une clôture au-dessus du record du 23 septembre sur volume soutenu.', contradiction: 'Des ventes de dirigeants plus lourdes au moment de la sortie.' },
    { scenario: 'mixed', trigger: 'Les résultats restent bons mais la hausse des taux comprime les multiples des logiciels.', firstOrder: 'Le titre consolide entre sa moyenne à vingt séances et son record.', secondOrder: 'Les logiciels de croissance reculent plus que la sécurité.', confirmation: 'Un retour vers la moyenne à vingt séances sans casser le bas du 21 septembre.', contradiction: 'Une détente des taux longs qui relancerait le logiciel.' },
    { scenario: 'bearish', trigger: 'Un concurrent casse les prix ou la guidance d’ARR est révisée à la baisse.', firstOrder: 'Le multiple se comprime brutalement depuis un niveau extrême.', secondOrder: 'Toute la cybersécurité décroche, les plus petits pairs davantage.', confirmation: 'Une clôture sous le bas du 21 septembre et un recul du panier de cybersécurité.', contradiction: 'Une nouvelle hausse de la guidance malgré la concurrence.' }],
  contradictions: ['Les résultats sont records mais les dirigeants vendent pendant la hausse : les deux signaux ne vont pas dans le même sens.', 'Sur vingt et une séances, environ ' + fr(sector21, 0) + ' des ' + fr(r21, 0) + ' points de hausse s’expliquent par le panier CIBR et son bêta : le titre bouge avec son secteur autant que sur ses propres chiffres.'],
  missingData: ['Chaîne d’options relevée marché fermé, inexploitable ; sentiment et tendances de recherche indisponibles.', 'Couverture officielle des formulaires 4 partielle : aucun solde net ni plan de cession affirmé.', 'Barres d’une source de repli pour l’ensemble des séries, par cohérence avec les autres dossiers du lot.'],
  sourceRefs: [market('barres comparables et classement statistique'), ref(1)] };

// ---------------------------------------------------------------- jugements éditoriaux
const judgments = { ticker: T, score_components: score, judgments: {
  'meta.version': { value: 3, reason: 'Version du schéma de dossier individualisé, non une observation financière.' },
  'meta.date': { value: a.meta.date, reason: 'Date de construction éditoriale, distincte de la clôture de référence.' },
  'meta.dateDisplay': { value: a.meta.dateDisplay, reason: 'Date éditoriale en français, non une observation financière.' },
  'verdict.score': { value: scoreValue, reason: 'Score additif : métier, technique, capital, calendrier, dilution, valorisation et base de risque.' },
  'risks.riskScore': { value: 6, reason: 'Jugement qualitatif sur dix : valorisation, extension et ventes des dirigeants.' } } };
a.blastRadius.groups.forEach((g, i) => { judgments.judgments['blastRadius.groups.' + i + '.order'] = { value: g.order, reason: 'Classement économique éditorial du mécanisme de transmission, pas une causalité mesurée.' }; });
write(rev + '/editorial-judgments.json', judgments);

// ---------------------------------------------------------------- preuves
const inputs = [];
for (const [name, file] of [['bars', 'bars'], ['fund', 'fundamentals'], ['comparison', 'comparison_bars'], ['rank', 'rank_beta'], ['status', 'status'], ['insiders', 'insiders'], ['earn', 'comparison_earnings'], ['sec', 'sec_evidence']])
  inputs.push(K.input(name, data + '/' + file + '.json'));
inputs.push(K.input('earn_mu', 'analyses/NVDA/_data/comparison_earnings.json'), K.input('earn_acn', 'analyses/CRM/_data/comparison_earnings.json'));
inputs.push(K.input('primary', rev + '/primary-manifest.json', 'primary_sec_manifest_v1'), K.input('judgments', rev + '/editorial-judgments.json', 'editorial_judgment'));
const { dep, prov } = K.provenance(inputs);
const P = i => prov('primary', '/documents/' + i, 'Chiffre lu dans le dépôt SEC ouvert et haché.');
const lvlProv = k => prov('bars', lvPtr(k), 'Niveau lu sur la barre certifiée du ' + L[k].d + '.');
const gaap = () => prov('primary', '/documents/5', 'GAAP douze mois glissants au 31/07/2026 = exercice 2026 (10-K) − premier semestre FY26 + premier semestre FY27 (10-Q) ; EBITDA = résultat opérationnel + dépréciation + amortissement ; flux libre = flux opérationnel − investissements − logiciels capitalisés ; dette = obligations + loyers.', [dep('primary', '/documents/1')]);
const marketMath = () => prov('bars', B + '/' + N + '/4', 'Capitalisation = close × actions au 20 août ; EV = capitalisation + dette − trésorerie au 31/07 ; ratios sur agrégats douze mois ; extension = close / EMA20 − 1.', [dep('fund', STP + '/sharesOutstanding'), dep('primary', '/documents/1'), dep('primary', '/documents/5')]);
const levelsGeo = () => prov('bars', lvPtr('trigger'), 'Déclencheur = plus haut du 23 septembre ; stop = plus bas du 23 septembre ; hauteur de base = haut du 22 − bas du 10 septembre ; TP1 = déclencheur + moitié de la hauteur ; TP2 = déclencheur + hauteur ; plafond = (TP1 + 1,5 × stop) / 2,5 ; pourcentages depuis l’entrée ; R/R = gain / risque.', [dep('bars', lvPtr('stop')), dep('bars', lvPtr('baseLow')), dep('bars', lvPtr('baseHigh'))]);
const insiderProv = () => prov('insiders', TXP + '/transactions', 'Formulaires 4 relevés, code S (ventes de marché) ; cumuls = somme des actions et des actions × prix par dirigeant ; couverture officielle partielle.', [dep('sec', '')]);

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
  if (p.startsWith('header.metrics.') || p === 'verdict.whyAvoid.0' || p === 'verdict.whyAvoid.2') return marketMath();
  if (p.startsWith('macro.indicators.')) return prov('bars', B, 'Rendements simples cinq et vingt et une séances depuis les clôtures certifiées.');
  if (p === 'macro.impact') return prov('bars', B + '/' + N + '/0', 'Date de la clôture de référence ; rendement du Trésor à 10 ans lu dans la courbe officielle du Trésor américain (daily/20260924/primary-reference.json) ; multiple calculé sur agrégats douze mois.', [dep('primary', '/documents/5')]);
  const cal = () => [dep('earn_mu', '/events'), dep('earn_acn', '/events')];
  if (p === 'verdict.summary') return prov('bars', B, 'Rendement vingt et une séances et record sur barres certifiées ; part sectorielle = bêta face à CIBR × rendement de CIBR sur la même fenêtre, part propre = différence ; ARR, flux libre et guidance lus dans le communiqué ; multiple calculé.', [dep('comparison', C('CIBR')), dep('primary', '/documents/0'), dep('primary', '/documents/5'), dep('insiders', TXP + '/transactions')]);
  if (p === 'news.0.detail') return prov('bars', B + '/' + idx('2026-08-27') + '/1', 'Ouverture et clôture du 27 août rapportées à la clôture du 26 août ; IGV sur les mêmes séances.', [dep('bars', B + '/' + idx('2026-08-26') + '/4'), dep('comparison', C('IGV'))]);
  if (p === 'blastRadius.contradictions.1') return prov('comparison', C('CIBR'), 'Part sectorielle = bêta face à CIBR × rendement vingt et une séances de CIBR.', [dep('bars', B)]);
  if (p === 'verdict.controlChecklist.2.evidence' || p === 'tradeIdea.catalysts.2') return prov('earn_mu', '/events', 'Dates de Micron et d’Accenture tirées des calendriers de données collectés le 24 septembre pour les dossiers NVDA et CRM, non confirmées ici par les émetteurs.', [dep('earn_acn', '/events')]);
  if (p.startsWith('filingsReview.summary')) return prov('primary', '/documents/5', 'Opinion de l’auditeur sur le contrôle interne (10-K) et conclusion sur les contrôles de publication (10-Q).', [dep('primary', '/documents/1')]);
  if (p.startsWith('globalScore.keyTakeawaysNegative')) return prov('bars', B + '/' + idx('2026-06-23') + '/4', 'Rendement depuis la clôture du 23 juin ; ventes relevées dans les formulaires 4.', [dep('insiders', TXP + '/transactions')]);
  if (p === 'verdict.summary_legacy') return prov('bars', B, 'Rendement vingt et une séances et record sur barres certifiées ; ARR, flux libre et guidance lus dans le communiqué ; multiple calculé.', [dep('primary', '/documents/0'), dep('primary', '/documents/5'), dep('insiders', TXP + '/transactions')]);
  if (p === 'verdict.whyAvoid.1') return P(1);
  if (p === 'verdict.whyAvoid.3') return insiderProv();
  if (p === 'verdict.whyBuy.3') return P(5);
  if (p.startsWith('verdict.whyBuy.') || p.startsWith('earnings.')) return P(0);
  if (p.startsWith('verdict.controlChecklist.')) return prov('bars', B, 'Continuité et ajustement du fractionnement vérifiés sur les barres certifiées ; calendrier collecté.', [dep('primary', '/documents/3'), dep('earn', '/events')]);
  if (p.startsWith('news.0.')) return P(0);
  if (p.startsWith('news.1.')) return P(2);
  if (p.startsWith('news.2.')) return P(3);
  if (p.startsWith('news.3.')) return P(4);
  if (p.startsWith('technicals.') && !/supports|resistances|setupNote|badges/.test(p)) return prov('bars', B, tech.convention + '.');
  if (p.startsWith('technicals.badges')) return prov('bars', B, 'Record et moyennes calculés sur les barres certifiées.', [dep('bars', lvPtr('trigger'))]);
  const sr = p.match(/^technicals\.(supports|resistances)\.(\d+)$/);
  if (sr) return lvlProv({ supports: ['stop', 's2', 'abandon'], resistances: ['trigger'] }[sr[1]][+sr[2]]);
  if (p === 'technicals.setupNote') return prov('bars', B + '/' + N + '/4', 'Clôture, record, stop, abandon et supports lus sur les barres certifiées ; extension = close / EMA20 − 1.', ['trigger', 'stop', 'abandon', 's2'].map(k => dep('bars', lvPtr(k))));
  if (p.startsWith('business.segments.') || p === 'business.overview') return prov('primary', '/documents/0', 'Revenus, ARR et Falcon Flex du communiqué ; rémunération en actions, acquisitions et engagements du 10-Q ; parts = segment / revenus totaux ; rendement depuis la clôture du 23 juin et multiple depuis le 7 mai sur barres certifiées.', [dep('primary', '/documents/1'), dep('bars', B + '/' + idx('2026-06-23') + '/4'), dep('bars', B + '/' + idx('2026-05-07') + '/4')]);
  if (p.startsWith('business.coverageMatrix.')) return prov('bars', B, 'Matrice de couverture de la collecte.');
  const fm = p.match(/^fundamentals\.rows\.(\d+)\./);
  if (fm) { const i = +fm[1]; if (i <= 3) return P(0); if (i <= 5) return P(1); if (i <= 10) return gaap(); if (i === 13) return prov('bars', B + '/' + N + '/4', 'P/E forward = close / milieu de la guidance de bénéfice ajusté (1,255 $).', [dep('primary', '/documents/0')]); return marketMath(); }
  if (p.startsWith('capitalStructure.sharesOutstanding')) return prov('fund', STP + '/sharesOutstanding', 'Actions en circulation après fractionnement, identiques à la page de garde du 10-Q.', [dep('primary', '/documents/1')]);
  if (p.startsWith('capitalStructure.')) return prov('primary', '/documents/1', 'Actions, rémunération en actions, rachats, revente et fractionnement lus dans les dépôts.', [dep('primary', '/documents/2'), dep('primary', '/documents/3'), dep('primary', '/documents/4')]);
  if (/^filingsReview\.filings\.\d+\./.test(p)) return P(+p.split('.')[2]);
  if (p.startsWith('filingsReview.')) return prov('primary', '/documents/1', 'Rémunération en actions, acquisitions et engagements lus dans le 10-Q.', [dep('bars', B)]);
  if (p.startsWith('shortInterest.')) return prov('fund', STP, 'Positions vendeuses et jours de couverture du snapshot statistique ; aucune date de règlement inférée.');
  if (p.startsWith('insiders.')) return insiderProv();
  if (p.startsWith('performance.windowReturns.')) { const m = p.match(/rows\.(\d+)/), tk = m ? a.performance.windowReturns.rows[+m[1]].ticker : T; return tk === T ? prov('bars', B, 'Rendement simple vingt et une séances.') : prov('comparison', C(tk), 'Rendement simple vingt et une séances, sans dividendes.'); }
  if (p === 'blastRadius.window') return prov('comparison', C('PANW'), 'Première et dernière date communes aux séries alignées.', [dep('bars', B)]);
  const bm = p.match(/^blastRadius\.groups\.(\d+)\.symbols\.(\d+)\./);
  if (bm && /eventRisk$/.test(p)) return prov('earn', '/events', 'Calendrier de résultats des comparables sur quatorze jours ; seules les publications datées y figurent.');
  if (bm && /readThrough$/.test(p)) return prov('primary', '/documents/1', 'Engagements d’achat lus dans le 10-Q.');
  if (bm) { const row = a.blastRadius.groups[+bm[1]].symbols[+bm[2]]; return prov('comparison', C(row.ticker), 'Rendements log communs ; corrélation de Pearson ; bêta CRWD sur comparable = covariance / variance du comparable ; R² = corrélation au carré ; rendements simples cinq et vingt et une séances.', [dep('bars', B)]); }
  if (p.startsWith('blastRadius.scenarios.')) return prov('bars', lvPtr('trigger'), 'Niveaux lus sur les barres certifiées.', [dep('bars', lvPtr('abandon'))]);
  if (p.startsWith('blastRadius.')) return prov('rank', '', 'Contrôle de couverture statistique et relations économiques documentées.');
  if (/^tradeIdea\.(entry|stop)$/.test(p)) return lvlProv(p.split('.')[1] === 'entry' ? 'trigger' : 'stop');
  if (/^tradeIdea\.(tp1|tp2|stopPct|tp1Pct|tp2Pct|rr)$/.test(p)) return levelsGeo();
  if (p.startsWith('tradeIdea.')) return prov('bars', lvPtr('trigger'), 'Niveaux lus sur les barres certifiées ; plafond arrondi à l’inférieur, objectifs et taille calculés ; liquidité = médiane close × volume sur vingt séances ; exécutabilité : ' + X.method, [dep('bars', lvPtr('stop')), dep('bars', lvPtr('abandon')), dep('bars', lvPtr('baseLow')), dep('bars', lvPtr('baseHigh')), dep('bars', B)]);
  if (p.startsWith('risks.')) return prov('primary', '/documents/1', 'Rémunération en actions et rachats lus dans les dépôts ; multiples et extension calculés ; ventes relevées dans les formulaires 4 ; ouverture, clôture du 27 août et repli au 2 septembre sur barres certifiées ; dates de Micron et d’Accenture tirées des calendriers de données.', [dep('bars', B), dep('earn_mu', '/events'), dep('earn_acn', '/events'), dep('primary', '/documents/4'), dep('insiders', TXP + '/transactions')]);
  if (p.startsWith('verdict.')) return P(0);
  if (p.startsWith('globalScore.') || p.startsWith('meta.') || p.startsWith('business.') || p === 'disclaimer') return P(0);
  throw Error('provenance manquante ' + p);
}
const res = K.writeEvidence({ ticker: T, ref: REF, outJson: OUT_JSON, outEvidence: OUT_EVIDENCE, calcPath: rev + '/numeric-evidence.json', generator: GEN, a, inputs, sourceFor, score,
  valuation: { basis: 'GAAP douze mois au 2026-07-31 ; valeur d’entreprise réduite de 30 % = hypothèse éditoriale (multiple courant × 0,7)', ...scn },
  extra: { gaap_inputs_thousands: { K10, BAL }, technicals_recomputed: tech, levels: { exec: X, r3m, c3m, cMay, xMay, gapOpen, gapClose, pullback, igv0827, r21, cibr21, sector21, own21, ownShare, toPre, entry, stop, abandon, height, tp1, tp2, rr1, rr2, cap, capRr, sizeExample, adv, extension },
    insiders: { byInsider, sellTotal, sellFirst }, limitations: ['Options inexploitables, marché fermé.', 'Couverture officielle des formulaires 4 partielle.', 'P/E GAAP non calculable de façon significative.'] } });
K.renderPreview(a, run + '/preview/index.html');
console.log(`[CRWD] claims=${res.claims} score=${scoreValue} close=${close} entry=${entry} stop=${stop} tp1=${tp1} tp2=${tp2} rr1=${rr1.toFixed(2)} cap=${cap} capRr=${capRr.toFixed(2)} ev/rev=${(ev / G$.rev).toFixed(1)} ev/fcf=${(ev / G$.fcf).toFixed(0)} pe=${(close / EPS_FY27).toFixed(0)} scn=${scn.price.toFixed(2)} ext=${extension.toFixed(1)} sells=${(sellTotal / 1e6).toFixed(0)}`);
