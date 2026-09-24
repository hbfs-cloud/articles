'use strict';
// Dossier OKTA v3 au close du 2026-09-23. Écrit le JSON canonique, le sidecar de preuves, les
// artefacts de calcul et un aperçu LOCAL. Ne touche ni analyses/OKTA/index.html ni l'index du site.
const K = require('../../../../tools/lib/analysis-v3-kit.cjs');
const { sha, bytes, read, write, esc, get, fr, usd, pct, sgn, findPath, at, frDate } = K;
const T = 'OKTA', REF = '2026-09-23';
const TREASURY = 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/2026/all?type=daily_treasury_yield_curve&field_tdr_date_value=2026&page&_format=csv';
const run = 'analyses/OKTA/_runs/20260924', data = run + '/_data', rev = run + '/revision', prim = 'analyses/OKTA/_primary';
const OUT_JSON = 'data/analyses-data/OKTA.json', OUT_EVIDENCE = 'data/analyses-evidence/OKTA.json', GEN = run + '/build-okta.cjs';

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
const archive = read(run + '/original/OKTA.json');
const since0826 = pct(close, bars[idx('2026-08-26')][4]), gap0827 = pct(bars[idx('2026-08-27')][4], bars[idx('2026-08-26')][4]);

// Ventes d'initiés (formulaires 4, code S) relevées dans la fenêtre collectée.
const sells = tx.transactions.filter(x => x.type_code === 'S');
const byInsider = {};
for (const x of sells) { const k = x.insider_name; byInsider[k] = byInsider[k] || { title: x.insider_title, shares: 0, value: 0, first: x.date_transaction, last: x.date_transaction }; const b = byInsider[k]; b.shares += x.shares; b.value += x.shares * x.price; if (x.date_transaction < b.first) b.first = x.date_transaction; if (x.date_transaction > b.last) b.last = x.date_transaction; }
const tighe = byInsider['Tighe Brett'], sellTotal = Object.values(byInsider).reduce((n, b) => n + b.value, 0);

// GAAP douze mois glissants au 31/07/2026 = exercice 2026 (10-K) − S1 FY26 + S1 FY27 (10-Q), en millions.
const K10 = { rev: [2919, 1416, 1570], ebit: [149, 80, 163], da: [96, 48, 37], ni: [235, 129, 190], ocf: [884, 408, 511], capex: [9, 3, 2], capsw: [12, 5, 11] };
const ttm = k => K10[k][0] - K10[k][1] + K10[k][2];
const BAL = { cash: 763, stInv: 1536, lease: 53, sharesA: 167139757, sharesB: 7681171, buybackH1: 372, convertRepaid: 350, sbcH1: 231 };
const G$ = { rev: ttm('rev') * 1e6, ebit: ttm('ebit') * 1e6, ebitda: (ttm('ebit') + ttm('da')) * 1e6, ni: ttm('ni') * 1e6,
  fcf: (ttm('ocf') - ttm('capex') - ttm('capsw')) * 1e6, debt: BAL.lease * 1e6, cash: (BAL.cash + BAL.stInv) * 1e6 };
const shares = BAL.sharesA + BAL.sharesB, marketCap = close * shares, ev = marketCap + G$.debt - G$.cash;
const EPS_FY27 = 3.92; // milieu de la guidance non-GAAP 3,90–3,94 $
const scn = { multiple: ev / G$.ebitda * 0.7, ebitda: G$.ebitda, debt: G$.debt, cash: G$.cash, shares, close };
scn.enterprise_value = scn.multiple * scn.ebitda; scn.equity_value = scn.enterprise_value - scn.debt + scn.cash; scn.price = scn.equity_value / scn.shares; scn.downside_pct = (scn.price / close - 1) * 100;

// Niveaux : lus sur des barres certifiées, par date. Objectifs : jambe de hausse du 11 au 23 septembre.
const L = { trigger: { d: '2026-09-23', c: 2 }, stop: { d: '2026-09-23', c: 3 }, abandon: { d: '2026-09-18', c: 3 },
  s2: { d: '2026-09-22', c: 3 }, legLow: { d: '2026-09-11', c: 3 } };
const lv = k => bars[idx(L[k].d)][L[k].c], lvPtr = k => `${B}/${idx(L[k].d)}/${L[k].c}`;
const entry = lv('trigger'), stop = lv('stop'), abandon = lv('abandon'), height = entry - lv('legLow');
const tp1 = +(entry + height / 2).toFixed(2), tp2 = +(entry + height).toFixed(2);
const rr1 = (tp1 - entry) / (entry - stop), rr2 = (tp2 - entry) / (entry - stop);
const RR_MIN = 1.5, cap = Math.floor((tp1 + RR_MIN * stop) / (1 + RR_MIN) * 100) / 100, capRr = (tp1 - cap) / (cap - stop);
const sizeExample = Math.floor(100 / (entry - stop)), extension = pct(close, tech.ema20);
const X = K.execStats(bars, entry, cap, tech.atr14);
const cPre = bars[idx('2026-08-26')][4], gapOpen = pct(bars[idx('2026-08-27')][1], cPre);
const day = t => { const b = cmpRows.find(x => x.symbol === t).bars; return pct(b.find(x => x[0] === '2026-08-27')[4], b.find(x => x[0] === '2026-08-26')[4]); };
const d27 = { CRWD: day('CRWD'), HACK: day('HACK'), IGV: day('IGV'), CIBR: day('CIBR') };
const r21 = pct(close, bars[N - 21][4]), cibr21 = M.CIBR.return21d, sector21 = M.CIBR.beta * cibr21, own21 = r21 - sector21;
const lowZone = bars[idx('2026-09-21')][3];
const DIL = { q2Diluted: 178.808e6, guideDiluted: 184e6, buybackLeft: 555 };
const prevPlan = { act: bars[idx('2026-08-31')][4], low: bars[idx('2026-09-01')][3] };

// ---------------------------------------------------------------- sources primaires
const EDGAR = 'https://www.sec.gov/Archives/edgar/data/1660134/';
const docs = [
  ['2026-08-26', '8-K / Exhibit 99.1', '0001660134-26-000068', 'okta-7312026_ex991.htm', 'q2fy27-ex991.htm',
    'Communiqué du deuxième trimestre de l’exercice 2027 : chiffre d’affaires de 805 M$ (+11 %), cRPO de 2,585 Md$ (+14 %), résultat opérationnel GAAP de 107 M$, bénéfice ajusté de 1,05 $ par action, flux libre de 227 M$. Guidance annuelle de 3,216 à 3,226 Md$ de revenus et de 3,90 à 3,94 $ de bénéfice ajusté.'],
  ['2026-08-27', '10-Q', '0001660134-26-000069', 'okta-20260731.htm', 'q2fy27-10q.htm',
    'Rapport trimestriel : obligations convertibles de 350 M$ remboursées à l’échéance, plus aucune dette financière, trésorerie et placements de 2,30 Md$, 372 M$ d’actions rachetées sur le semestre et 174,8 millions d’actions de classes A et B au 24 août.'],
  ['2026-09-18', '8-K', '0001660134-26-000072', 'okta-20260914.htm', 'sep14-8k.htm',
    'Démission d’une administratrice le 14 septembre, sans désaccord avec la société selon le dépôt, et nomination d’une administratrice indépendante le 17 septembre : changement de gouvernance sans effet sur les comptes.'],
  ['2026-03-05', '10-K', '0001660134-26-000020', 'okta-20260131.htm', 'fy26-10k.htm',
    'Rapport annuel de l’exercice clos le 31 janvier 2026 : chiffre d’affaires de 2,919 Md$, résultat opérationnel GAAP de 149 M$, flux opérationnel de 884 M$ ; aucun client ne dépasse 10 % des revenus ou des créances.'],
].map(([date, form, accession, file, local, finding]) => ({ date, form, accession, url: `${EDGAR}${accession.replace(/-/g, '')}/${file}`, finding, path: `${prim}/${local}`, sha256: sha(bytes(`${prim}/${local}`)) }));
const needle = (id, i, needles) => { const text = bytes(docs[i].path).toString('utf8'); for (const n of needles) if (!text.includes(n)) throw Error(`needle absent ${id}: ${n}`); return [id, { source_path: docs[i].path, source_sha256: docs[i].sha256, source_needles: needles }]; };
const primary = { kind: 'primary_sec_manifest_v1', ticker: T, as_of: '2026-09-24', inventory_count: 20, inventory_screened_count: 20, opened_count: 4, reviewed_count: 4, decision_relevant_count: 4, local_primary_count: docs.length,
  review_scope: 'Dépôts EDGAR d’Okta du 1er février au 23 septembre 2026, formulaires de détention exclus. Vingt dépôts inventoriés ; les documents de gouvernance (DEF 14A, 8-K items 5.02 et 5.07 antérieurs), le S-8 et les 13G sont écartés comme non décisionnels.',
  documents: docs,
  semantic_findings: Object.fromEntries([
    needle('q2_results', 0, ['$805 million', '$2.585 billion', '$107 million', '$1.05', '$227 million', '$3.216 billion', '$3.90']),
    needle('balance', 1, ['167,139,757', '7,681,171', '1,536', '763', '372', '350', '178,808', '555', 'Share Repurchase Program']),
    needle('guide_shares', 0, ['approximately 184 million']),
    needle('income', 1, ['1,570', '163', '511']),
    needle('governance', 2, ['Emilie Choi', 'Helen Riley']),
    needle('fy26', 3, ['2,919', '149', '884']),
  ]) };
write(rev + '/primary-manifest.json', primary);
const ref = i => ({ name: 'Okta ' + docs[i].form, url: docs[i].url, date: docs[i].date });
const market = name => ({ name: 'Données de marché datées (provenance hashée) : ' + name, url: K.evidenceUrl(T), date: '2026-09-24' });

// ---------------------------------------------------------------- le dossier
const score = { business: 22, technical: 4, capital: 8, calendar: 0, dilution: -2, valuation: -10, risk: 36 };
const scoreValue = Object.values(score).reduce((a, b) => a + b, 0);
const a = {
  meta: { lang: 'fr', dir: 'ltr', level: 'intermediate', tags: ['us', 'equities', 'ai-chain', 'software', 'technology'], grade: 'B-', date: '2026-09-24', dateDisplay: '24 septembre 2026', version: 3, status: 'watch', assetType: 'stock', levelsCloseDate: REF,
    description: 'Okta : 11 % de croissance, un cours qui a pris plus de moitié en un mois. Dossier au close du 23 septembre 2026, statut surveiller.',
    ogDescription: 'Okta : revalorisation liée à l’identité des agents d’IA, bilan sans dette et titre étendu ; niveaux à surveiller.',
    lastMcpRefresh: raw.status.captured_at, levelsVerifiedAt: raw.status.captured_at,
    statusHistory: [{ at: raw.status.captured_at, from: archive.meta.status, to: 'watch', note: 'refonte v3 du 24 septembre : nouveau scénario, clôture de référence du 2026-09-23', close }] },
  header: { ticker: T, name: 'Okta, Inc.', exchange: 'NASDAQ', sector: 'Gestion des identités en nuage', price: close, changePct: pct(close, prev),
    badges: [{ text: 'SURVEILLER — NE PAS POURSUIVRE LA HAUSSE', color: 'blue' }, { text: 'Chaîne IA — identité des agents', color: 'purple' }],
    metrics: { marketCap: fr(marketCap / 1e9, 1) + ' Md$', volume: fr(bars[N][5] / 1e6, 2) + ' M', evRevenue: fr(ev / G$.rev, 1) + '×' }, halalStatus: 'unknown' },
  verdict: { score: scoreValue, conviction: 'Moderate', bias: 'Neutral',
    confidence: 'Score éditorial non prédictif. Les chiffres d’entreprise viennent des dépôts SEC du trimestre ; les niveaux, du close certifié du 23 septembre.',
    summary: 'Okta a pris ' + fr(since0826, 1) + ' % depuis la veille de ses résultats, dont ' + fr(gap0827, 1) + ' % le 27 août, alors que son chiffre d’affaires ne progresse que de 11 %. Ce jour-là, tout le logiciel montait : CrowdStrike, qui publiait le même soir, a pris ' + fr(d27.CRWD, 1) + ' %, HACK ' + fr(d27.HACK, 1) + ' % et IGV ' + fr(d27.IGV, 1) + ' %. Sur vingt et une séances, le bêta face à CIBR explique environ ' + fr(sector21, 0) + ' des ' + fr(r21, 0) + ' points de hausse ; l’excédent, environ ' + fr(own21, 0) + ' points, est propre à Okta. C’est lui que paie l’histoire de l’identité des agents d’IA, qui doivent être autorisés et surveillés comme des employés. La société a des arguments solides : un bilan sans dette depuis le remboursement de ses obligations convertibles, un flux libre abondant, des rachats d’actions. Mais la guidance reste prudente, à 10 ou 11 % de croissance, et le titre coûte désormais plus de cinquante fois le bénéfice ajusté attendu. Pas d’entrée au cours actuel : le titre est très au-dessus de sa moyenne à vingt séances. Le signal utile serait une clôture au-dessus du record ; une clôture sous le bas du 18 septembre ferait abandonner le scénario.',
    whyBuy: [
      'Le cRPO, le carnet de revenus des douze prochains mois, atteint 2,585 Md$, en hausse de 14 % : plus vite que le chiffre d’affaires, signe d’une demande qui se renforce.',
      'Le résultat opérationnel GAAP du trimestre passe à 107 M$, contre 41 M$ un an plus tôt : la rentabilité progresse réellement, pas seulement en données ajustées.',
      'Les obligations convertibles de 350 M$ ont été remboursées : Okta n’a plus de dette financière et garde 2,30 Md$ de trésorerie et de placements.',
      'La société a racheté 372 M$ de ses actions sur le semestre : le nombre de titres baisse au lieu de gonfler.'],
    whyAvoid: [
      'Au close du 23 septembre, le titre vaut environ ' + fr(close / EPS_FY27, 0) + ' fois le bénéfice ajusté guidé pour l’exercice, pour une croissance de 10 à 11 % : le multiple a doublé plus vite que le métier.',
      'La guidance annuelle de revenus, 3,216 à 3,226 Md$, reste prudente : la direction ne promet pas l’accélération que le cours anticipe.',
      'Le titre clôture ' + fr(extension, 1) + ' % au-dessus de sa moyenne à vingt séances, avec un RSI au-dessus de 70 : l’achat maintenant paie l’euphorie.',
      'Le directeur financier a vendu 80 000 actions le ' + frDate(tighe.first) + ', pour environ ' + fr(tighe.value / 1e6, 1) + ' M$, et aucun dirigeant n’a acheté.'],
    controlChecklist: [
      { label: 'Historique de cours', status: 'pass', statusLabel: 'Trois cents séances continues', evidence: 'Série certifiée au close du 23 septembre, historique reconstruit côté serveur avant la collecte.', action: 'Niveaux et indicateurs recalculés sur cette seule série.' },
      { label: 'Extension', status: 'warn', statusLabel: 'Très au-dessus des moyennes', evidence: 'Titre au record, très loin de sa moyenne à vingt séances.', action: 'Ne pas poursuivre ; attendre le déclencheur de clôture.' },
      { label: 'Calendrier', status: 'warn', statusLabel: 'Prochains résultats non confirmés', evidence: 'Aucune date publiée par Okta. Accenture publie le 1er octobre selon les calendriers de données, date non confirmée ici par Accenture.', action: 'Compter avec un gap possible sur le logiciel d’entreprise le 1er octobre.' }] },
  business: { theme: 'Identité et contrôle d’accès pour les employés, les clients et les agents d’IA',
    overview: '<p>Okta vend un service d’identité en nuage : il vérifie qui se connecte à quoi, pour les employés d’une entreprise et pour ses clients. Au trimestre clos le 31 juillet 2026, les abonnements ont pesé 793 M$ sur 805 M$ de revenus, en hausse de 12 %.</p><p>La thèse qui a relancé le titre tient en une phrase : chaque agent d’IA a besoin d’une identité. Un agent qui réserve un voyage ou modifie un contrat doit être autorisé, limité et surveillé comme un salarié. Okta se présente comme le fournisseur neutre de cette couche, indépendant des grands clouds. Le carnet de revenus des douze prochains mois, le cRPO, progresse de 14 % à 2,585 Md$, plus vite que le chiffre d’affaires : c’est le premier signe mesurable que l’histoire se traduit en commandes.</p><p>La mécanique financière est saine. Le résultat opérationnel GAAP a plus que doublé sur un an, le flux libre a atteint 227 M$ au trimestre, les obligations convertibles de 350 M$ ont été remboursées et 372 M$ d’actions rachetées sur le semestre. Ce qui coince, c’est le prix : la croissance guidée reste de 10 à 11 %, et le cours a pris plus de cinquante pour cent en un mois.</p>',
    moat: 'L’avantage d’Okta tient à sa neutralité : une entreprise qui utilise plusieurs clouds et des centaines d’applications préfère un fournisseur d’identité indépendant. Microsoft reste le concurrent le plus dangereux, parce que son offre d’identité est incluse dans des contrats déjà signés.',
    segments: [
      { name: 'Abonnements', revenue: '793 M$ au trimestre', pct: '99 %', description: 'En hausse de 12 % sur un an ; identité des employés et des clients.' },
      { name: 'Services professionnels', revenue: '12 M$ au trimestre', pct: '1 %', description: 'En recul : transfert volontaire vers les partenaires.' }],
    sourceRefs: [ref(0), ref(1)],
    coverageMatrix: [
      { facet: 'Cours et historique', status: 'COUVERT', decision: 'Trois cents séances continues, close certifié ; base des niveaux.' },
      { facet: 'Résultats et guidance', status: 'COUVERT — PRIMAIRE', decision: 'Communiqué du 26 août et 10-Q ; prochaine date non confirmée.' },
      { facet: 'Capital et dilution', status: 'COUVERT — PRIMAIRE', decision: 'Convertibles remboursées, rachats et nombre d’actions séparés.' },
      { facet: 'Comparables et transmission', status: 'COUVERT — LOCAL', decision: 'Corrélations recalculées sur barres certifiées depuis la fin mars.' },
      { facet: 'Initiés', status: 'PARTIEL', decision: 'Ventes relevées, couverture officielle incomplète : aucun solde net affirmé.' },
      { facet: 'Options', status: 'NON EXPLOITABLE', decision: 'Chaîne relevée marché fermé.' },
      { facet: 'Sentiment et tendances de recherche', status: 'INDISPONIBLE', decision: 'Aucune mesure qualifiée ; non utilisé.' }] },
  news: [
    { date: '2026-08-26', title: 'Deuxième trimestre : cRPO en accélération à +14 %', impact: 'positive', detail: 'Le carnet progresse plus vite que le chiffre d’affaires. Le lendemain, le titre ouvre à ' + sgn(gapOpen, 1) + ' et clôture à ' + sgn(gap0827, 1) + ', dans une séance où IGV prend ' + sgn(d27.IGV, 1) + '.', source: 'Okta — SEC', sourceUrl: docs[0].url },
    { date: '2026-08-27', title: 'Les convertibles de 350 M$ remboursées', impact: 'positive', detail: 'Okta n’a plus de dette financière : le risque de dilution par conversion disparaît et la trésorerie finance les rachats d’actions.', source: 'Okta — SEC', sourceUrl: docs[1].url },
    { date: '2026-09-18', title: 'Changement au conseil d’administration', impact: 'neutral', detail: 'Une administratrice démissionne sans désaccord déclaré et une indépendante la remplace ; aucun effet financier, mais un point de gouvernance à suivre.', source: 'Okta — SEC', sourceUrl: docs[2].url }],
  fundamentals: { rows: [
      { metric: 'Chiffre d’affaires du trimestre', value: '805 M$', signal: '+11 % sur un an, communiqué du 26 août', signalColor: 'green' },
      { metric: 'cRPO en fin de trimestre', value: '2,585 Md$', signal: '+14 % sur un an', signalColor: 'green' },
      { metric: 'Résultat opérationnel GAAP du trimestre', value: '107 M$', signal: 'Contre 41 M$ un an plus tôt', signalColor: 'green' },
      { metric: 'Guidance de revenus de l’exercice', value: '3,216–3,226 Md$', signal: '+10 à 11 % sur un an', signalColor: 'amber' },
      { metric: 'Rachats d’actions du semestre', value: '372 M$', signal: 'Six mois clos le 31 juillet, 10-Q', signalColor: 'green' },
      { metric: 'Rémunération en actions du semestre', value: '231 M$', signal: 'Exclue du bénéfice ajusté, 10-Q', signalColor: 'amber' },
      { metric: 'Flux libre sur douze mois', value: fr(G$.fcf / 1e9, 2) + ' Md$', signal: 'Flux opérationnel − investissements − logiciels capitalisés, douze mois au 31 juillet 2026', signalColor: 'green' },
      { metric: 'Revenus GAAP sur douze mois', value: fr(G$.rev / 1e9, 2) + ' Md$', signal: 'Douze mois glissants au 31 juillet 2026 (10-K + 10-Q)', signalColor: 'blue' },
      { metric: 'EBITDA GAAP sur douze mois', value: fr(G$.ebitda / 1e6, 0) + ' M$', signal: 'Résultat opérationnel + amortissements, douze mois au 31 juillet 2026', signalColor: 'blue' },
      { metric: 'Résultat net GAAP sur douze mois', value: fr(G$.ni / 1e6, 0) + ' M$', signal: 'Douze mois glissants au 31 juillet 2026', signalColor: 'blue' },
      { metric: 'Trésorerie et placements au 31 juillet', value: fr(G$.cash / 1e9, 2) + ' Md$', signal: 'Aucune dette financière, bilan du 10-Q', signalColor: 'green' },
      { metric: 'EV/revenus GAAP', value: fr(ev / G$.rev, 1) + '×', signal: 'Enterprise value au close du 2026-09-23 sur revenus GAAP douze mois au 2026-07-31', signalColor: 'amber', source: 'Clôture certifiée, 10-K et 10-Q', comparison: 'Versus une croissance de 11 % : le multiple suppose une accélération que la guidance ne promet pas.' },
      { metric: 'EV/revenus GAAP en base diluée', value: fr((close * DIL.guideDiluted + G$.debt - G$.cash) / G$.rev, 1) + '×', signal: 'Enterprise value au close du 2026-09-23 avec environ 184 millions d’actions diluées (guidance du troisième trimestre), sur revenus GAAP douze mois au 2026-07-31', signalColor: 'amber', source: 'Clôture certifiée, communiqué, 10-K et 10-Q', comparison: 'Versus ' + fr(ev / G$.rev, 1) + '× en base de 174,8 millions d’actions : la dilution attendue ajoute environ un demi-point de multiple.' },
      { metric: 'EV/EBITDA GAAP', value: fr(ev / G$.ebitda, 0) + '×', signal: 'Enterprise value au close du 2026-09-23 sur EBITDA GAAP douze mois au 2026-07-31', signalColor: 'red', source: 'Clôture certifiée, 10-K et 10-Q', comparison: 'Versus le scénario ci-dessous : l’écart mesure la prime accordée à l’histoire des agents d’IA.' },
      { metric: 'P/E forward sur guidance non-GAAP', value: fr(close / EPS_FY27, 0) + '×', signal: 'Forward : close du 2026-09-23 sur bénéfice ajusté non-GAAP de 3,90–3,94 $ guidé pour l’exercice 2027', signalColor: 'amber', source: 'Clôture certifiée et communiqué du 26 août', comparison: 'Versus le P/E GAAP sur douze mois, plus de cent fois : le bénéfice ajusté exclut la rémunération en actions.' },
      { metric: 'Scénario EV/EBITDA × 0,7 : valeur d’entreprise −30 % (hypothèse éditoriale)', value: fr(scn.price, 2) + ' $ par action', signal: 'Scénario : valeur d’entreprise réduite de 30 % par hypothèse, trésorerie du 2026-07-31 inchangée, soit ' + fr(scn.downside_pct, 0) + ' % sous le close du 2026-09-23', signalColor: 'red', source: 'Clôture certifiée, 10-K et 10-Q', comparison: 'Versus le close : ce que coûterait un retour partiel du multiple vers son niveau d’avant la publication ; ce n’est pas un objectif.' }],
    sourceRefs: [ref(0), ref(1), market('fondamentaux et statistiques')] },
  earnings: { quarters: [],
    beatNote: 'Deuxième trimestre de l’exercice 2027 : bénéfice GAAP de 0,65 $ par action et ajusté de 1,05 $, marge opérationnelle ajustée de 28 %. La guidance du troisième trimestre vise 813 à 817 M$ de revenus, un cRPO de 2,590 à 2,600 Md$ et 0,92 à 0,94 $ de bénéfice ajusté ; celle de l’exercice, 3,216 à 3,226 Md$ de revenus et 3,90 à 3,94 $ par action. La direction qualifie elle-même sa prévision de prudente. Aucune date de prochaine publication n’est confirmée par l’émetteur à ce jour.',
    nextEarnings: 'Date non confirmée par l’émetteur ; aucune publication dans les quatorze jours du calendrier collecté.',
    sourceRefs: [ref(0)] },
  capitalStructure: { sharesOutstanding: fr(shares / 1e6, 1) + ' millions d’actions de classes A et B au 24 août 2026 (page de garde du 10-Q) ; 178,8 millions d’actions diluées au deuxième trimestre',
    sharesAuthorized: 'Un milliard d’actions de classe A autorisées selon le bilan du 10-Q.',
    dilutionRisk: 'low',
    shareHistory: 'Le nombre d’actions baisse : 174,8 millions de titres de classes A et B au 24 août 2026, après 372 M$ de rachats sur le semestre. Les obligations convertibles de 350 M$ ont été remboursées en numéraire à l’échéance : la dilution par conversion disparaît. Reste la rémunération en actions, 231 M$ sur six mois, qui dilue lentement en sens inverse : le 10-Q retient 178,8 millions d’actions diluées pour le deuxième trimestre, et la guidance du troisième environ 184 millions. Sur le programme de rachat de 1 Md$ voté en janvier, 555 M$ restaient disponibles au 31 juillet. Le nombre exact d’actions après les prochains rachats et attributions n’est pas calculable à l’avance.',
    warrants: [],
    atm: { active: false, authorized: 'Aucun programme d’émission d’actions relevé', used: 'Sans objet', remaining: 'Sans objet' },
    sourceRefs: [ref(1), ref(3)] },
  filingsReview: { summary: 'Quatre dépôts décisionnels ouverts et hachés. Ils montrent un bilan assaini, sans dette ni dilution nouvelle, une rentabilité GAAP en hausse et une croissance qui reste modeste : la revalorisation du titre ne vient pas des chiffres, mais de l’histoire des agents d’IA.',
    filings: docs.map(d => ({ date: d.date, form: d.form, accession: d.accession, finding: d.finding, url: d.url })),
    contrarianRisks: [
      'La guidance reste à 10 ou 11 % de croissance : le cours anticipe une accélération que la direction ne promet pas.',
      'Microsoft inclut l’identité dans ses contrats existants : sur les clients déjà équipés, le prix peut l’emporter sur la neutralité.',
      'L’identité des agents d’IA est encore une promesse commerciale : aucun revenu dédié n’est isolé dans les comptes.',
      'Le directeur financier vend pendant la hausse ; ce n’est pas un signal négatif en soi, mais personne à l’intérieur n’achète.',
      'Le titre a été revalorisé en une séance, ouverture à ' + sgn(gapOpen, 1) + ' puis clôture à ' + sgn(gap0827, 1) + ' : une publication simplement conforme pourrait suffire à le faire reculer.'] },
  technicals: { rsi14: +tech.rsi14.toFixed(2), macd: +tech.macd.toFixed(2), macdSignal: +tech.macdSignal.toFixed(2), ema20: +tech.ema20.toFixed(2), ema50: +tech.ema50.toFixed(2), ema200: +tech.ema200.toFixed(2),
    ma50Type: 'EMA', ma200Type: 'EMA', ma50Available: true, ma200Available: true, atr14: +tech.atr14.toFixed(2),
    badges: ['Record le 23 septembre', 'RSI au-dessus de 70', 'Ne pas poursuivre'],
    supports: [stop, lv('s2'), abandon],
    resistances: [entry],
    setupNote: 'Le titre clôture à ' + usd(close) + ', juste sous son record de ' + usd(entry) + ' et ' + fr(extension, 1) + ' % au-dessus de sa moyenne à vingt séances. Avant activation, aucune entrée ; une clôture sous ' + usd(abandon) + ', le bas du 18 septembre, abandonne le scénario. Activation sur une clôture au-dessus de $' + entry.toFixed(2) + ', le plus haut du 23 septembre. Après activation, stop sous $' + stop.toFixed(2) + ', le bas de la même séance. Supports : ' + usd(stop) + ', ' + usd(lv('s2')) + ' et ' + usd(abandon) + ', seuil de clôture ; le plus bas de la zone est ' + usd(lowZone) + ', touché en séance le 21 septembre. Aucune résistance au-dessus du record.',
    wyckoff: 'Non utilisé : le profil de volume n’est pas exploité dans ce dossier.',
    sourceRefs: [market('barres quotidiennes et indicateurs recalculés')] },
  performance: { windowReturns: { label: 'Rendements de prix sur vingt et une séances, sans dividendes réinvestis', startDate: bars[N - 21][0], endDate: bars[N][0],
      rows: [{ ticker: T, returnPct: +ret(21).toFixed(2) }, ...Object.entries(M).map(([ticker, x]) => ({ ticker, returnPct: x.return21d }))] },
    sourceRefs: [market('barres quotidiennes comparées')] },
  options: { callOI: 'Non exploitable', putOI: 'Non exploitable', cpRatio: 'Non exploitable', maxPain: 'Non exploitable', ivMean: 'Non exploitable', skew: 'Chaîne relevée marché fermé', unusual: 'Aucune activité inhabituelle qualifiée', sourceRefs: [market('options')] },
  shortInterest: { siPct: fr(st.shortPercentOfFloat * 100, 2) + ' % du flottant', daysToCover: fr(st.shortRatio, 2) + ' jours, date de règlement non précisée par le snapshot', ctb: 'Coût d’emprunt bas, sans tension', trend: 'Positions vendeuses modérées ; aucun indice de rachat forcé n’est retenu.', squeezeScore: 'Faible', sourceRefs: [market('positions vendeuses')] },
  insiders: { signal: 'Ventes de marché uniquement dans la fenêtre relevée, aucun achat. Brett Tighe, directeur financier, a vendu 80 000 actions le ' + tighe.first + ', pour environ ' + fr(tighe.value / 1e6, 1) + ' M$. Le total relevé atteint environ ' + fr(sellTotal / 1e6, 1) + ' M$. Couverture officielle partielle : aucun solde net publié, et aucun plan de cession programmé n’est affirmé faute de mention relevée.',
    recentTransactions: [
      { date: tighe.last, insider: 'Brett Tighe — direction financière', type: 'sell', shares: fr(tighe.shares, 0), value: fr(tighe.value / 1e6, 1) + ' M$' }],
    sourceRefs: [market('formulaires 4')] },
  blastRadius: {},
  macro: { indicators: [{ name: 'Clôture de référence', value: REF, signal: usd(close) + ', séance complète' }, { name: 'Rendement cinq séances', value: sgn(ret(5)), signal: 'Descriptif' }, { name: 'Rendement vingt et une séances', value: sgn(ret(21)), signal: 'Descriptif' }],
    sourceRefs: [{ name: 'Trésor américain — courbe officielle des taux, séance du 23 septembre', url: TREASURY, date: '2026-09-23' }],
    regime: 'neutral', impact: 'Un titre revalorisé sur une histoire de long terme est sensible aux taux longs : selon la courbe officielle du Trésor américain, le 10 ans a clôturé à 5,11 % le 23 septembre, plus haut depuis juillet 2007. Une hausse supplémentaire des taux pèserait d’abord sur les multiples qui ont le plus monté.' },
  risks: { riskScore: 6, riskProfile: 'High',
    riskSummary: 'Chez Okta, le cours a pris de l’avance sur la croissance. Le marché a payé d’avance une accélération liée aux agents d’IA ; si les trimestres suivants restent à 10 ou 11 % de croissance, le multiple peut se comprimer aussi vite qu’il a monté, même avec une entreprise rentable et sans dette.',
    riskCards: [
      { title: 'Revalorisation sans accélération', severity: 'high', icon: 'fa-scale-balanced', points: ['Environ ' + fr(close / EPS_FY27, 0) + ' fois le bénéfice ajusté guidé.', 'Croissance guidée de 10 à 11 %.'], verdict: 'La thèse doit se traduire en accélération des revenus, pas seulement du carnet, pour justifier le prix.' },
      { title: 'Extension technique', severity: 'high', icon: 'fa-rocket', points: ['Cours au record, très loin de la moyenne à vingt séances.', 'Ouverture à ' + sgn(gapOpen, 1) + ' et clôture à ' + sgn(gap0827, 1) + ' le 27 août.'], verdict: 'Un retour vers la moyenne à vingt séances est possible avant toute poursuite de la hausse.' },
      { title: 'Concurrence de Microsoft', severity: 'medium', icon: 'fa-building', points: ['Offre d’identité incluse dans des contrats existants.', 'Pression sur les prix chez les clients déjà équipés.'], verdict: 'Signal à suivre : un ralentissement du cRPO ou des grands comptes au prochain trimestre trahirait la pression de l’offre groupée.' }],
    pedagogy: 'Le 27 août, le titre a ouvert à ' + sgn(gapOpen, 1) + ' et fini à ' + sgn(gap0827, 1) + ' : l’acheteur de l’ouverture a eu raison ce jour-là, celui de la clôture a vu le cours redescendre sous 167 $ dès le lendemain. Avec environ ' + fr(adv / 1e9, 2) + ' Md$ échangés par séance, le spread reste étroit et le slippage se compte en cents. Le vrai risque est ailleurs : un gap peut faire sortir sous le stop de ' + usd(stop) + ', et la perte dépasse alors le risque prévu. Accenture publie le 1er octobre. Taille : ' + sizeExample + ' actions pour 100 $ de perte acceptée, pas davantage. Attendre la clôture de déclenchement.' },
  tradeIdea: { status: 'watch', statusNote: 'Surveiller. Avant activation : aucune entrée ; une clôture sous ' + usd(abandon) + ' abandonne le scénario. Activation : clôture au-dessus de ' + usd(entry) + ', puis achat à l’ouverture suivante seulement sous ' + usd(cap) + '. Après activation : stop sous ' + usd(stop) + '. D’après les barres quotidiennes, le plan du 28 août (activation 172,91 $, stop 166,15 $) s’est probablement déclenché le 31 août (clôture ' + usd(prevPlan.act) + ') puis a touché son stop le 1er septembre (plus bas ' + usd(prevPlan.low) + ') ; non vérifié en intrajournalier.',
    entry, stop, tp1, tp2,
    stopPct: pct(stop, entry).toFixed(1) + '%', tp1Pct: '+' + pct(tp1, entry).toFixed(1) + '%', tp2Pct: '+' + pct(tp2, entry).toFixed(1) + '%',
    rr: '1:' + rr1.toFixed(2) + ' TP1 / 1:' + rr2.toFixed(2) + ' TP2',
    entryNote: 'Déclencheur sur clôture au-dessus du record du 23 septembre, pas sur un franchissement en séance. Entrée à l’ouverture suivante uniquement sous ' + usd(cap) + ' : au-delà, le R/R vers TP1 tomberait sous 1,5 avec le même stop. Une clôture de déclenchement déjà au-dessus de ' + usd(cap) + ', ou une ouverture au-delà, annule l’entrée ; le scénario reste alors en surveillance jusqu’à la clôture suivante. La marge est de ' + usd(cap - entry) + ', ' + fr(X.bufAtr, 2) + ' ATR : ' + fr(X.gap60, 0) + ' % des soixante dernières séances ont ouvert plus haut que la veille d’au moins cet écart, et sur ' + X.breakouts + ' clôtures au-dessus du plus haut de la veille, ' + X.exec + ' seulement auraient permis l’achat. L’entrée restera rare, et c’est voulu. Objectifs tirés de la jambe de hausse du 11 au 23 septembre : TP1 à la moitié de sa hauteur au-dessus du déclencheur, TP2 à sa hauteur entière ; le mouvement mesuré de la consolidation d’août est déjà atteint. Liquidité : environ ' + fr(adv / 1e9, 2) + ' Md$ échangés par séance, médiane des vingt dernières. Exemple de taille, non personnalisé : un budget de perte de 100 $ et ' + usd(entry - stop) + ' de risque par action autorisent ' + sizeExample + ' actions.',
    horizon: 'Dix séances après activation',
    thesis: 'Le marché a revalorisé Okta sur l’identité des agents d’IA : il faut maintenant que la demande suive le cours. Avant activation, le dossier reste en surveillance et une clôture sous ' + usd(abandon) + ' l’abandonne. Une clôture au-dessus de $' + entry.toFixed(2) + ' montrerait que les acheteurs continuent d’absorber les ventes ; l’entrée n’a lieu qu’à l’ouverture suivante et sous ' + usd(cap) + '. Après activation, le stop sous $' + stop.toFixed(2) + ' limite le risque à la dernière séance. TP1 à ' + usd(tp1) + ' et TP2 à ' + usd(tp2) + ' prolongent la jambe de septembre. Taille limitée à l’exemple chiffré, ' + sizeExample + ' actions pour 100 $ de risque : titre étendu, ne pas anticiper le déclencheur.',
    catalysts: ['Une clôture au-dessus du record du 23 septembre, sur volume au moins égal à la médiane récente.', 'Toute annonce de revenus dédiés à l’identité des agents d’IA ou de grands contrats de ce type.', 'L’absence de nouvelle vente de dirigeants dans les formulaires 4 avant la prochaine publication, dont la date n’est pas confirmée.', 'Les résultats d’Accenture le 1er octobre (date des calendriers de données) : une lecture des budgets logiciels, et un risque de gap.'],
    invalidation: ['Avant activation : une clôture sous ' + usd(abandon) + ', bas du 18 septembre, abandonne le scénario.', 'Après activation : une clôture sous ' + usd(stop) + ' invalide le trade.', 'Ouverture au-dessus de ' + usd(cap) + ' après la clôture de déclenchement : pas d’achat, le R/R deviendrait insuffisant.', 'Une guidance de revenus revue à la baisse annule la thèse avant activation.'] },
  globalScore: { profile: 'Bilan sain, histoire payée d’avance',
    keyTakeawaysPositive: ['Carnet de revenus en accélération.', 'Plus aucune dette, trésorerie abondante.', 'Rachats d’actions qui réduisent le nombre de titres.'],
    keyTakeawaysNegative: ['Croissance guidée modeste face au multiple.', 'Titre très étendu après la publication.', 'Ventes du directeur financier, aucun achat.'],
    mindsetTip: 'Une bonne histoire fait monter un cours en un jour ; il faut plusieurs trimestres de chiffres pour qu’il y reste.' },
  social: { platforms: [], sourceRefs: [market('sentiment non retenu faute de mesure qualifiée')] },
  disclaimer: 'Document de recherche éducatif. Ni conseil financier, ni signal de trading. Statut surveiller : aucun ordre actif.',
};

// ---------------------------------------------------------------- blast radius
const G = [
  { name: 'Leaders de l’identité et de la sécurité', order: 1, transmission: 'Ils fixent le prix des plateformes de sécurité et disputent le même budget d’identité.', rows: [
    ['MSFT', 'leader', 'Concurrent frontal en identité', 'Son offre d’identité incluse dans les contrats existants est la principale pression sur les prix d’Okta.'],
    ['CRWD', 'leader', 'Leader de la sécurité en nuage', 'Son module d’identité concurrence Okta, et ses résultats ont entraîné tout le secteur fin août.']] },
  { name: 'Pairs directs', order: 1, transmission: 'Même budget de sécurité, même cycle de renouvellement.', rows: [
    ['SAIL', 'direct_peer', 'Gouvernance des identités', 'Concurrent direct de la gouvernance des identités, le produit qui porte la croissance d’Okta.'],
    ['PANW', 'direct_peer', 'Sécurité réseau et identités privilégiées', 'Plateforme de consolidation qui intègre l’identité ; sa politique de prix vaut pour Okta.'],
    ['ZS', 'direct_peer', 'Accès réseau en nuage', 'Même argument d’accès zéro confiance ; souvent vendu avec un fournisseur d’identité.'],
    ['NET', 'direct_peer', 'Réseau et accès en périphérie', 'Même clientèle de directions informatiques ; sa valorisation encadre celle des logiciels de sécurité.'],
    ['TENB', 'direct_peer', 'Exposition et vulnérabilités', 'Module de sécurité concurrent dans les appels d’offres de consolidation.'],
    ['RBRK', 'direct_peer', 'Cyber-résilience et sauvegarde', 'Même budget de résilience ; très corrélé en séance aux publications du secteur.'],
    ['QLYS', 'direct_peer', 'Conformité et vulnérabilités', 'Acteur plus petit du même budget ; sensible à la consolidation des outils.'],
    ['FTNT', 'direct_peer', 'Pare-feu et sécurité réseau', 'Cycle différent, mêmes directions informatiques : un ralentissement chez lui peut précéder les budgets.']] },
  { name: 'Amont : hébergement cloud', order: 1, transmission: 'Le service tourne sur les grands clouds ; leurs tarifs fixent une partie du coût.', rows: [
    ['AMZN', 'upstream', 'Hébergeur du service d’identité', 'Ses tarifs d’hébergement pèsent sur la marge brute d’Okta.'],
    ['GOOGL', 'upstream', 'Hébergeur et concurrent en identité', 'Fournisseur d’hébergement et concurrent via ses propres services d’identité.']] },
  { name: 'Second ordre : applications d’entreprise', order: 2, transmission: 'Chaque application connectée est une porte à gérer ; leurs budgets et leurs agents nourrissent la demande.', rows: [
    ['NOW', 'second_order', 'Plateforme de flux de travail', 'Ses agents d’IA ont besoin d’identités à gérer ; ses commentaires de budgets valent pour Okta.'],
    ['CRM', 'second_order', 'Applications de gestion client', 'Sa stratégie d’agents d’IA crée des identités non humaines à autoriser.'],
    ['DDOG', 'second_order', 'Supervision des infrastructures cloud', 'Autre bénéficiaire des migrations ; son rythme mesure la croissance des charges hébergées.'],
    ['HUBS', 'second_order', 'Applications marketing et vente', 'Client type des entreprises moyennes ; sa faiblesse signale des budgets logiciels tendus.'],
    ['MDB', 'second_order', 'Base de données en nuage', 'Même profil de logiciel valorisé sur le long terme ; lecture de la tolérance aux multiples.']] },
  { name: 'Contrôles sectoriels', order: 2, transmission: 'Paniers de référence pour séparer le mouvement du titre de celui de son secteur.', rows: [
    ['CIBR', 'sector_proxy', 'Panier de cybersécurité', 'Un écart de performance avec ce panier isole ce qui est propre à Okta.'],
    ['HACK', 'sector_proxy', 'Panier de cybersécurité équipondéré', 'Moins concentré : montre si la hausse du secteur se fait sans les plus grandes valeurs.'],
    ['IGV', 'sector_proxy', 'Panier de logiciels américains', 'Contrôle large du logiciel : un mouvement commun n’a rien de spécifique à l’identité.']] },
];
const EV = {
  MSFT: 'Aucune publication dans les quatorze jours collectés ; ses offres groupées d’identité restent le signal concurrent',
  CRWD: 'Aucune publication dans les quatorze jours collectés ; ses annonces de module d’identité pèsent sur Okta',
  SAIL: 'Aucune publication dans les quatorze jours collectés ; ses gains en gouvernance des identités sont le signal direct',
  PANW: 'Aucune publication dans les quatorze jours collectés ; ses annonces de consolidation déplacent les budgets',
  ZS: 'Aucune publication dans les quatorze jours collectés ; ses commentaires de demande valent pour le secteur',
  NET: 'Aucune publication dans les quatorze jours collectés ; sa valorisation sert de référence au secteur',
  TENB: 'Aucune publication dans les quatorze jours collectés ; sa faiblesse relative mesure la consolidation',
  RBRK: 'Aucune publication dans les quatorze jours collectés ; très réactif aux publications de ses pairs',
  QLYS: 'Aucune publication dans les quatorze jours collectés ; sensible à la consolidation des outils',
  FTNT: 'Aucune publication dans les quatorze jours collectés ; son cycle matériel peut précéder les budgets',
  AMZN: 'Aucune publication dans les quatorze jours collectés ; ses tarifs d’hébergement pèsent sur la marge',
  GOOGL: 'Aucune publication dans les quatorze jours collectés ; ses services d’identité concurrencent Okta',
  NOW: 'Aucune publication dans les quatorze jours collectés ; ses lancements d’agents créent des identités à gérer',
  CRM: 'Aucune publication dans les quatorze jours collectés ; sa stratégie d’agents compte pour la demande',
  DDOG: 'Aucune publication dans les quatorze jours collectés ; son rythme reflète les charges cloud',
  HUBS: 'Aucune publication dans les quatorze jours collectés ; signal des budgets des entreprises moyennes',
  MDB: 'Aucune publication dans les quatorze jours collectés ; lecture de la tolérance aux multiples élevés',
  CIBR: 'Panier sans publication propre ; dominé par les grandes valeurs de sécurité',
  HACK: 'Panier sans publication propre ; plus sensible aux valeurs moyennes',
  IGV: 'Panier sans publication propre ; exposé aux grandes pondérations logicielles' };
const evNote = t => { if (!EV[t]) throw Error('eventRisk manquant ' + t); return EV[t]; };
a.blastRadius = {
  asOf: REF, observationTime: raw.status.captured_at,
  window: 'Rendements quotidiens communs du ' + firstCommon + ' au ' + REF,
  methodology: 'Les séries sont alignées sur les mêmes dates de clôture et converties en rendements logarithmiques journaliers communs, depuis la fin mars. La corrélation mesure le co-mouvement ; le bêta mesure la sensibilité du rendement d’Okta à celui du comparable ; le R² est la corrélation au carré. Les rendements à cinq et vingt et une séances sont simples, sans dividendes. Les groupes sont définis par le lien économique, pas par la corrélation.',
  groups: G.map(g => ({ name: g.name, order: g.order, transmission: g.transmission,
    symbols: g.rows.map(([ticker, relationClass, role, readThrough]) => ({ ticker, role, relationClass, confidence: relationClass === 'sector_proxy' ? 'medium' : 'low', readThrough, eventRisk: evNote(ticker), ...M[ticker] })) })),
  scenarios: [
    { scenario: 'bullish', trigger: 'Le cRPO continue d’accélérer et des revenus liés aux agents d’IA apparaissent dans les comptes.', firstOrder: 'Le titre sort de son record par le haut et le multiple se maintient.', secondOrder: 'La gouvernance des identités et la sécurité des accès suivent.', confirmation: 'Une clôture au-dessus du record du 23 septembre sur volume soutenu.', contradiction: 'Des ventes de dirigeants plus lourdes au moment de la sortie.' },
    { scenario: 'mixed', trigger: 'La croissance reste à 10 ou 11 %, conforme à la guidance, mais sans accélération.', firstOrder: 'Le titre consolide entre sa moyenne à vingt séances et son record.', secondOrder: 'Les pairs de la sécurité restent portés par la demande générale.', confirmation: 'Un retour vers la moyenne à vingt séances sans casser le bas du 18 septembre.', contradiction: 'Un nouveau contrat important dans l’identité des agents.' },
    { scenario: 'bearish', trigger: 'La hausse des taux ou une offre groupée de Microsoft comprime le multiple.', firstOrder: 'La revalorisation d’août se défait en partie.', secondOrder: 'Les logiciels de sécurité les plus revalorisés reculent ensemble.', confirmation: 'Une clôture sous le bas du 18 septembre et un recul du panier de cybersécurité.', contradiction: 'Une guidance relevée malgré la concurrence.' }],
  contradictions: ['La croissance du chiffre d’affaires reste de 11 % mais le titre a pris plus de cinquante pour cent : le mouvement vient du multiple, pas des résultats.', 'Le 27 août, CrowdStrike a pris ' + fr(d27.CRWD, 1) + ' % et CIBR ' + fr(d27.CIBR, 1) + ' % : une partie du gap d’Okta était sectorielle, même si l’excédent sur vingt et une séances reste propre au titre.'],
  missingData: ['Chaîne d’options relevée marché fermé, inexploitable ; sentiment et tendances de recherche indisponibles.', 'Aucun revenu lié aux agents d’IA n’est isolé dans les comptes : la thèse n’est pas mesurable directement.', 'Historique de cours reconstruit côté serveur le 24 septembre avant la collecte, puis certifié.'],
  sourceRefs: [market('barres comparables et classement statistique'), ref(1)] };

// ---------------------------------------------------------------- jugements éditoriaux
const judgments = { ticker: T, score_components: score, judgments: {
  'meta.version': { value: 3, reason: 'Version du schéma de dossier individualisé, non une observation financière.' },
  'meta.date': { value: a.meta.date, reason: 'Date de construction éditoriale, distincte de la clôture de référence.' },
  'meta.dateDisplay': { value: a.meta.dateDisplay, reason: 'Date éditoriale en français, non une observation financière.' },
  'verdict.score': { value: scoreValue, reason: 'Score additif : métier, technique, capital, calendrier, dilution, valorisation et base de risque.' },
  'risks.riskScore': { value: 6, reason: 'Jugement qualitatif sur dix : valorisation, extension et concurrence de Microsoft.' } } };
a.blastRadius.groups.forEach((g, i) => { judgments.judgments['blastRadius.groups.' + i + '.order'] = { value: g.order, reason: 'Classement économique éditorial du mécanisme de transmission, pas une causalité mesurée.' }; });
write(rev + '/editorial-judgments.json', judgments);

// ---------------------------------------------------------------- preuves
const inputs = [];
for (const [name, file] of [['bars', 'bars'], ['fund', 'fundamentals'], ['comparison', 'comparison_bars'], ['rank', 'rank_beta'], ['status', 'status'], ['insiders', 'insiders'], ['earn', 'comparison_earnings'], ['sec', 'sec_evidence']])
  inputs.push(K.input(name, data + '/' + file + '.json'));
inputs.push(K.input('earn_acn', 'analyses/CRM/_data/comparison_earnings.json'));
inputs.push(K.input('primary', rev + '/primary-manifest.json', 'primary_sec_manifest_v1'), K.input('judgments', rev + '/editorial-judgments.json', 'editorial_judgment'));
const { dep, prov } = K.provenance(inputs);
const P = i => prov('primary', '/documents/' + i, 'Chiffre lu dans le dépôt SEC ouvert et haché.');
const lvlProv = k => prov('bars', lvPtr(k), 'Niveau lu sur la barre certifiée du ' + L[k].d + '.');
const gaap = () => prov('primary', '/documents/3', 'GAAP douze mois glissants au 31/07/2026 = exercice 2026 (10-K) − premier semestre FY26 + premier semestre FY27 (10-Q) ; EBITDA = résultat opérationnel + amortissements ; flux libre = flux opérationnel − investissements − logiciels capitalisés ; trésorerie = liquidités + placements.', [dep('primary', '/documents/1')]);
const marketMath = () => prov('bars', B + '/' + N + '/4', 'Capitalisation = close × actions de classes A et B au 24 août ; EV = capitalisation + dette − trésorerie au 31/07 ; ratios sur agrégats douze mois ; P/E forward = close / 3,92 $ ; extension = close / EMA20 − 1.', [dep('primary', '/documents/1'), dep('primary', '/documents/3'), dep('primary', '/documents/0')]);
const levelsGeo = () => prov('bars', lvPtr('trigger'), 'Déclencheur = plus haut du 23 septembre ; stop = plus bas du 23 septembre ; hauteur = déclencheur − plus bas du 11 septembre ; TP1 = déclencheur + moitié de la hauteur ; TP2 = déclencheur + hauteur ; plafond = (TP1 + 1,5 × stop) / 2,5 ; pourcentages depuis l’entrée ; R/R = gain / risque.', [dep('bars', lvPtr('stop')), dep('bars', lvPtr('legLow'))]);
const insiderProv = () => prov('insiders', TXP + '/transactions', 'Formulaires 4 relevés, code S (ventes de marché) ; cumuls = somme des actions et des actions × prix par dirigeant ; couverture officielle partielle.', [dep('sec', '')]);

function sourceFor(p) {
  if (/^meta\.(lastMcpRefresh|levelsVerifiedAt)$/.test(p) || p === 'blastRadius.observationTime') return prov('status', '/captured_at', 'Horodatage exact de la collecte.');
  const sh = p.match(/^meta\.statusHistory\.(\d+)\.(.+)$/);
  if (sh) return sh[2] === 'at' ? prov('status', '/captured_at', 'Horodatage de la refonte.') : prov('bars', B + '/' + N + '/4', 'Clôture de référence et date de la refonte.', [dep('bars', B + '/' + N + '/0')]);
  if (judgments.judgments[p]) return prov('judgments', '/judgments/' + esc(p) + '/value', judgments.judgments[p].reason);
  if (/^macro\.sourceRefs\./.test(p)) return prov('bars', B + '/' + N + '/0', 'Référence officielle du Trésor américain pour la séance de référence ; valeurs conservées dans daily/20260924/_primary/.');
  const r = p.match(/^(.*)\.sourceRefs\.(\d+)\.(date|url|name)$/);
  if (r) { const x = get(a, r[1] + '.sourceRefs.' + r[2]); if (x.url === K.evidenceUrl(T)) return prov('status', '/captured_at', 'Date de collecte, non date de cours.'); const i = docs.findIndex(d => d.url === x.url); if (i < 0) throw Error('référence inconnue ' + p); return P(i); }
  if (p === 'meta.levelsCloseDate' || p === 'blastRadius.asOf' || p === 'macro.indicators.0.value') return prov('bars', B + '/' + N + '/0', 'Dernière séance complète.');
  if (p === 'header.price' || p === 'macro.indicators.0.signal') return prov('bars', B + '/' + N + '/4', 'Clôture complète de référence.');
  if (p === 'header.changePct') return prov('bars', B + '/' + N + '/4', '100 × (close / close précédent − 1).', [dep('bars', B + '/' + (N - 1) + '/4')]);
  if (p === 'header.metrics.volume') return prov('bars', B + '/' + N + '/5', 'Volume de la séance, en millions.');
  if (p === 'meta.description' || p.startsWith('header.metrics.') || p === 'verdict.whyAvoid.0' || p === 'verdict.whyAvoid.2') return marketMath();
  if (p.startsWith('macro.indicators.')) return prov('bars', B, 'Rendements simples cinq et vingt et une séances depuis les clôtures certifiées.');
  if (p === 'macro.impact') return prov('bars', B + '/' + N + '/0', 'Date de la clôture de référence ; rendement du Trésor à 10 ans lu dans la courbe officielle du Trésor américain (daily/20260924/primary-reference.json).');
  const day27 = () => ['CRWD', 'HACK', 'IGV', 'CIBR'].map(t => dep('comparison', C(t)));
  if (p === 'verdict.controlChecklist.2.evidence' || p === 'tradeIdea.catalysts.3') return prov('earn_acn', '/events', 'Date d’Accenture tirée du calendrier de données collecté le 24 septembre pour le dossier CRM, non confirmée ici par Accenture.');
  if (p === 'tradeIdea.statusNote') return prov('bars', lvPtr('trigger'), 'Niveaux du plan courant sur barres certifiées ; plan du 28 août lu dans l’archive, déclenchement et stop reconstitués sur les barres quotidiennes du 31 août et du 1er septembre.', [dep('bars', lvPtr('stop')), dep('bars', lvPtr('abandon')), dep('bars', B + '/' + idx('2026-08-31') + '/4'), dep('bars', B + '/' + idx('2026-09-01') + '/3')]);
  if (p === 'news.0.detail' || p === 'blastRadius.contradictions.1') return prov('bars', B + '/' + idx('2026-08-27') + '/1', 'Ouverture et clôture du 27 août rapportées à la clôture du 26 août ; comparables sur les mêmes séances ; part sectorielle = bêta face à CIBR × rendement de CIBR.', [dep('bars', B + '/' + idx('2026-08-26') + '/4'), ...day27()]);
  if (p === 'verdict.summary') return prov('bars', B + '/' + N + '/4', 'Rendements depuis le 26 août et du 27 août sur barres certifiées ; comparables du 27 août ; part sectorielle sur vingt et une séances = bêta face à CIBR × rendement de CIBR ; croissance et bilan lus dans les dépôts.', [dep('bars', B + '/' + idx('2026-08-26') + '/4'), dep('bars', B + '/' + idx('2026-08-27') + '/4'), ...day27(), dep('primary', '/documents/0'), dep('primary', '/documents/1')]);
  if (p.startsWith('capitalStructure.shareHistory') || p.startsWith('capitalStructure.sharesOutstanding')) return prov('primary', '/documents/1', 'Actions, actions diluées du trimestre (178 808 milliers), rachats et reliquat de 555 M$ lus dans le 10-Q ; environ 184 millions d’actions diluées retenues dans la guidance du communiqué.', [dep('primary', '/documents/0'), dep('primary', '/documents/3')]);
  if (p === 'technicals.setupNote') return prov('bars', B + '/' + N + '/4', 'Clôture, record, stop, abandon, supports et plus bas du 21 septembre lus sur les barres certifiées ; extension = close / EMA20 − 1.', ['trigger', 'stop', 'abandon', 's2'].map(k => dep('bars', lvPtr(k))).concat([dep('bars', B + '/' + idx('2026-09-21') + '/3')]));
  if (p === 'verdict.summary_legacy') return prov('bars', B + '/' + N + '/4', 'Rendements depuis le 26 août et gap du 27 août sur barres certifiées ; croissance, guidance et bilan lus dans les dépôts ; multiple calculé.', [dep('bars', B + '/' + idx('2026-08-26') + '/4'), dep('bars', B + '/' + idx('2026-08-27') + '/4'), dep('primary', '/documents/0'), dep('primary', '/documents/1')]);
  if (p === 'verdict.whyAvoid.3') return insiderProv();
  if (p === 'verdict.whyBuy.2' || p === 'verdict.whyBuy.3') return P(1);
  if (p.startsWith('verdict.whyBuy.') || p.startsWith('verdict.whyAvoid.') || p.startsWith('earnings.')) return P(0);
  if (p.startsWith('verdict.controlChecklist.')) return prov('bars', B, 'Continuité vérifiée sur les barres certifiées ; calendrier collecté.', [dep('earn', '/events')]);
  if (p.startsWith('news.0.')) return P(0);
  if (p.startsWith('news.1.')) return P(1);
  if (p.startsWith('news.2.')) return P(2);
  if (p.startsWith('technicals.') && !/supports|resistances|setupNote|badges/.test(p)) return prov('bars', B, tech.convention + '.');
  if (p.startsWith('technicals.badges')) return prov('bars', B, 'Record et RSI calculés sur les barres certifiées.', [dep('bars', lvPtr('trigger'))]);
  const sr = p.match(/^technicals\.(supports|resistances)\.(\d+)$/);
  if (sr) return lvlProv({ supports: ['stop', 's2', 'abandon'], resistances: ['trigger'] }[sr[1]][+sr[2]]);
  if (p === 'technicals.setupNote') return prov('bars', B + '/' + N + '/4', 'Clôture, record, stop, abandon et supports lus sur les barres certifiées ; extension = close / EMA20 − 1.', ['trigger', 'stop', 'abandon', 's2'].map(k => dep('bars', lvPtr(k))));
  if (p.startsWith('business.segments.') || p === 'business.overview') return prov('primary', '/documents/0', 'Revenus, cRPO et flux libre du communiqué ; résultat, convertibles et rachats du 10-Q ; parts = segment / revenus totaux ; rendement mensuel sur barres certifiées.', [dep('primary', '/documents/1'), dep('bars', B)]);
  if (p.startsWith('business.coverageMatrix.')) return prov('bars', B, 'Matrice de couverture de la collecte.');
  const fm = p.match(/^fundamentals\.rows\.(\d+)\./);
  if (fm) { const i = +fm[1]; if (i <= 3) return P(0); if (i <= 5) return P(1); if (i <= 10) return gaap(); return marketMath(); }
  if (p.startsWith('capitalStructure.sharesOutstanding')) return prov('primary', '/documents/1', 'Actions de classes A et B au 24 août, page de garde du 10-Q.');
  if (p.startsWith('capitalStructure.')) return prov('primary', '/documents/1', 'Actions, rachats, convertibles et rémunération en actions lus dans le 10-Q et le 10-K.', [dep('primary', '/documents/3')]);
  if (/^filingsReview\.filings\.\d+\./.test(p)) return P(+p.split('.')[2]);
  if (p.startsWith('filingsReview.')) return prov('primary', '/documents/0', 'Croissance, guidance et bilan lus dans les dépôts ; rendement mensuel sur barres certifiées.', [dep('primary', '/documents/1'), dep('bars', B)]);
  if (p.startsWith('shortInterest.')) return prov('fund', STP, 'Positions vendeuses et jours de couverture du snapshot statistique ; aucune date de règlement inférée.');
  if (p.startsWith('insiders.')) return insiderProv();
  if (p.startsWith('performance.windowReturns.')) { const m = p.match(/rows\.(\d+)/), tk = m ? a.performance.windowReturns.rows[+m[1]].ticker : T; return tk === T ? prov('bars', B, 'Rendement simple vingt et une séances.') : prov('comparison', C(tk), 'Rendement simple vingt et une séances, sans dividendes.'); }
  if (p === 'blastRadius.window') return prov('comparison', C('CRWD'), 'Première et dernière date communes aux séries alignées.', [dep('bars', B)]);
  const bm = p.match(/^blastRadius\.groups\.(\d+)\.symbols\.(\d+)\./);
  if (bm && /eventRisk$/.test(p)) return prov('earn', '/events', 'Calendrier de résultats des comparables sur quatorze jours ; seules les publications datées y figurent.');
  if (bm) { const row = a.blastRadius.groups[+bm[1]].symbols[+bm[2]]; return prov('comparison', C(row.ticker), 'Rendements log communs ; corrélation de Pearson ; bêta OKTA sur comparable = covariance / variance du comparable ; R² = corrélation au carré ; rendements simples cinq et vingt et une séances.', [dep('bars', B)]); }
  if (p.startsWith('blastRadius.contradictions.')) return prov('primary', '/documents/0', 'Croissance du communiqué ; rendement mensuel sur barres certifiées.', [dep('bars', B)]);
  if (p.startsWith('blastRadius.scenarios.')) return prov('bars', lvPtr('trigger'), 'Niveaux lus sur les barres certifiées ; guidance lue dans le communiqué.', [dep('bars', lvPtr('abandon')), dep('primary', '/documents/0')]);
  if (p.startsWith('blastRadius.')) return prov('rank', '', 'Contrôle de couverture statistique et relations économiques documentées.');
  if (/^tradeIdea\.(entry|stop)$/.test(p)) return lvlProv(p.split('.')[1] === 'entry' ? 'trigger' : 'stop');
  if (/^tradeIdea\.(tp1|tp2|stopPct|tp1Pct|tp2Pct|rr)$/.test(p)) return levelsGeo();
  if (p.startsWith('tradeIdea.')) return prov('bars', lvPtr('trigger'), 'Niveaux lus sur les barres certifiées ; plafond arrondi à l’inférieur, objectifs et taille calculés ; liquidité = médiane close × volume sur vingt séances ; exécutabilité : ' + X.method, [dep('bars', lvPtr('stop')), dep('bars', lvPtr('abandon')), dep('bars', lvPtr('legLow')), dep('bars', B)]);
  if (p.startsWith('risks.')) return prov('primary', '/documents/0', 'Guidance lue dans le communiqué ; multiple, extension, ouverture et clôture du 27 août, liquidité calculés sur les barres certifiées ; date d’Accenture tirée des calendriers de données.', [dep('earn_acn', '/events'), dep('bars', B), dep('bars', B + '/' + idx('2026-08-27') + '/4')]);
  if (p.startsWith('verdict.')) return P(0);
  if (p.startsWith('globalScore.') || p.startsWith('meta.') || p.startsWith('business.') || p === 'disclaimer') return P(0);
  throw Error('provenance manquante ' + p);
}
const res = K.writeEvidence({ ticker: T, ref: REF, outJson: OUT_JSON, outEvidence: OUT_EVIDENCE, calcPath: rev + '/numeric-evidence.json', generator: GEN, a, inputs, sourceFor, score,
  valuation: { basis: 'GAAP douze mois au 2026-07-31 ; valeur d’entreprise réduite de 30 % = hypothèse éditoriale (multiple courant × 0,7)', ...scn },
  extra: { gaap_inputs_millions: { K10, BAL }, technicals_recomputed: tech, levels: { exec: X, gapOpen, d27, r21, cibr21, sector21, own21, lowZone, DIL, prevPlan, entry, stop, abandon, height, tp1, tp2, rr1, rr2, cap, capRr, sizeExample, adv, extension, since0826, gap0827 },
    insiders: { byInsider, sellTotal }, limitations: ['Options inexploitables, marché fermé.', 'Couverture officielle des formulaires 4 partielle.', 'Historique reconstruit côté serveur avant la collecte.'] } });
K.renderPreview(a, run + '/preview/index.html');
console.log(`[OKTA] claims=${res.claims} score=${scoreValue} close=${close} entry=${entry} stop=${stop} tp1=${tp1} tp2=${tp2} rr1=${rr1.toFixed(2)} cap=${cap} capRr=${capRr.toFixed(2)} ev/rev=${(ev / G$.rev).toFixed(1)} ev/ebitda=${(ev / G$.ebitda).toFixed(0)} pe=${(close / EPS_FY27).toFixed(0)} scn=${scn.price.toFixed(2)} ext=${extension.toFixed(1)} since0826=${since0826.toFixed(1)}`);
