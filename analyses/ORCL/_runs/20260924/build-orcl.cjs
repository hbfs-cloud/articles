'use strict';
// Dossier ORCL v3 au close du 2026-09-23. Écrit le JSON canonique, le sidecar de preuves et un rendu
// LOCAL (revision/index.html). Ne touche ni analyses/ORCL/index.html ni l'index du site.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.resolve(__dirname, '../../../..');
const run = 'analyses/ORCL/_runs/20260924', data = run + '/data', rev = run + '/revision', prim = 'analyses/ORCL/_review/primary';
const OUT_JSON = 'data/analyses-data/ORCL.json', OUT_EVIDENCE = 'data/analyses-evidence/ORCL.json';
const REF = '2026-09-23';
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const bytes = p => fs.readFileSync(path.join(root, p));
const read = p => JSON.parse(bytes(p));
const write = (p, v) => fs.writeFileSync(path.join(root, p), JSON.stringify(v, null, 2) + '\n');
const esc = v => String(v).replace(/~/g, '~0').replace(/\//g, '~1');
const get = (o, p) => p.split('.').reduce((v, k) => v?.[k], o);
const fr = (n, d = 2) => n.toFixed(d).replace('.', ',');
const usd = (n, d = 2) => fr(n, d) + ' $';
const pct = (a, b) => 100 * (a / b - 1);
const sgn = (n, d = 2) => (n >= 0 ? '+' : '−') + fr(Math.abs(n), d) + ' %';
function findPath(o, type, p = '') { if (o && typeof o === 'object') { if (o.type === type) return p; for (const [k, v] of Object.entries(o)) { const r = findPath(v, type, p + '/' + esc(k)); if (r !== undefined) return r; } } }

// ---------------------------------------------------------------- données collectées
const raw = {};
for (const n of ['bars', 'fundamentals', 'technicals', 'comparison_bars', 'rank_beta', 'status', 'options', 'short_squeeze', 'insiders', 'market_regime', 'vwap'])
  raw[n] = read(`${data}/${n}.json`);
const series = raw.bars.results[0].data[0];
if (series.symbol !== 'ORCL' || series.bars.length !== 300 || series.served_completed_end !== REF) throw Error('ORCL : 300 séances complètes au 2026-09-23 requises');
const B = '/results/0/data/0/bars', bars = series.bars, N = bars.length - 1;
const idx = d => { const i = bars.findIndex(b => b[0] === d); if (i < 0) throw Error('séance absente ' + d); return i; };
const close = bars[N][4], prev = bars[N - 1][4];
const F = findPath(raw.fundamentals, 'instrument_comprehensive_financial'), S = findPath(raw.fundamentals, 'instrument_comprehensive_stats');
const T = findPath(raw.technicals, 'instrument_technicals');
const f = get(raw.fundamentals, F.slice(1).replace(/\//g, '.')), s = get(raw.fundamentals, S.slice(1).replace(/\//g, '.')), t = get(raw.technicals, T.slice(1).replace(/\//g, '.'));
// Valorisation GAAP : entrées lues dans le 10-K (exercice clos le 31/05/2026) et le 10-Q (T1 clos le
// 31/08/2026), en millions. Douze mois glissants = exercice − T1 FY26 + T1 FY27.
const K = { rev: [67357, 14926, 19345], ebit: [20606, 4277, 6728], dep: [7623, 1351, 3156], amort: [1671, 420, 202], ni: [17087, 2927, 4760] };
const ttm = k => K[k][0] - K[k][1] + K[k][2];
const BAL = { borrowCur: 7625, borrowNon: 117712, leaseA: 34621, leaseB: 9185, cash: 36369, mkt: 708, borrowCurMay: 7199, borrowNonMay: 122342 };
const CF = { ocf: 23103, capex: 28499, prepay: 11363, repayNotes: 4202, repayShort: 830, atm: 19909 };
const G$ = { rev: ttm('rev') * 1e6, ebit: ttm('ebit') * 1e6, ebitda: (ttm('ebit') + ttm('dep') + ttm('amort')) * 1e6, ni: ttm('ni') * 1e6,
  debt: (BAL.borrowCur + BAL.borrowNon + BAL.leaseA + BAL.leaseB) * 1e6, cash: (BAL.cash + BAL.mkt) * 1e6,
  borrowAug: (BAL.borrowCur + BAL.borrowNon) * 1e6, borrowMay: (BAL.borrowCurMay + BAL.borrowNonMay) * 1e6,
  fcf: (CF.ocf - CF.capex) * 1e6, fcfExPrepay: (CF.ocf - CF.capex - CF.prepay) * 1e6 };
const marketCap = close * s.sharesOutstanding, ev = marketCap + G$.debt - G$.cash;
const EPS_FY27_GUIDE = 8.10;
const ret = k => pct(close, bars[N - k][4]);
const scenarioPrice = (ev / G$.ebitda * 0.7 * G$.ebitda - G$.debt + G$.cash) / s.sharesOutstanding;

// Niveaux : tous lus sur des barres certifiées, par date.
const L = {
  entry: { d: '2026-09-22', c: 2 }, stop: { d: '2026-09-21', c: 3 }, tp1: { d: '2026-09-09', c: 2 }, tp2: { d: '2026-09-08', c: 2 },
  low923: { d: '2026-09-23', c: 3 }, low915: { d: '2026-09-15', c: 3 }, low916: { d: '2026-09-16', c: 3 }, open911: { d: '2026-09-11', c: 1 }, close911: { d: '2026-09-11', c: 4 }, close910: { d: '2026-09-10', c: 4 },
};
const lv = k => bars[idx(L[k].d)][L[k].c];
const lvPtr = k => `${B}/${idx(L[k].d)}/${L[k].c}`;
const entry = lv('entry'), stop = lv('stop'), tp1 = lv('tp1'), tp2 = lv('tp2');
const rr1 = (tp1 - entry) / (entry - stop), rr2 = (tp2 - entry) / (entry - stop);
const abandon = lv('low916');
// Plafond d'entrée à l'ouverture suivant la clôture de déclenchement : prix au-delà duquel le R/R vers
// TP1 passerait sous 1,3 avec le stop inchangé. Un quart d'ATR au-dessus du déclencheur donnerait un R/R
// d'environ 1,06 : trop permissif, donc écarté.
const RR_MIN = 1.3, cap = +((tp1 + RR_MIN * stop) / (1 + RR_MIN)).toFixed(2), capRr = (tp1 - cap) / (cap - stop);

// Comparables : rendements log communs, corrélation, bêta ORCL / comparable, R².
const cmpRows = raw.comparison_bars.data.items[0].results[0].data;
const C = ticker => { const i = cmpRows.findIndex(x => x.symbol === ticker); if (i < 0) throw Error('comparable absent ' + ticker); return '/data/items/0/results/0/data/' + i + '/bars'; };
const byDate = new Map(bars.map(b => [b[0], b])), mean = a => a.reduce((n, x) => n + x, 0) / a.length;
const M = {};
for (const item of cmpRows) {
  const common = item.bars.filter(b => byDate.has(b[0])), x = [], y = [];
  for (let i = 1; i < common.length; i++) { x.push(Math.log(common[i][4] / common[i - 1][4])); y.push(Math.log(byDate.get(common[i][0])[4] / byDate.get(common[i - 1][0])[4])); }
  const mx = mean(x), my = mean(y); let xy = 0, xx = 0, yy = 0;
  for (let i = 0; i < x.length; i++) { xy += (x[i] - mx) * (y[i] - my); xx += (x[i] - mx) ** 2; yy += (y[i] - my) ** 2; }
  const corr = xy / Math.sqrt(xx * yy), cb = item.bars;
  M[item.symbol] = { correlation: +corr.toFixed(4), beta: +(xy / xx).toFixed(4), r2: +(corr * corr).toFixed(4), observations: x.length, return5d: +pct(cb.at(-1)[4], cb.at(-6)[4]).toFixed(2), return21d: +pct(cb.at(-1)[4], cb.at(-22)[4]).toFixed(2) };
}
const firstCommon = cmpRows[0].bars.find(b => byDate.has(b[0]))[0];

// ---------------------------------------------------------------- sources primaires
const docs = [
  { date: '2026-09-10', form: '8-K / Exhibit 99.1', accession: '0001193125-26-387905', url: 'https://www.sec.gov/Archives/edgar/data/1341439/000119312526387905/orcl-ex99_1.htm', path: prim + '/q1fy27-ex991.htm',
    finding: 'Communiqué du premier trimestre de l’exercice 2027 : chiffre d’affaires de 19,3 Md$, en hausse de 30 %, infrastructure cloud en hausse de 121 %, RPO de 664 Md$, flux de trésorerie libre négatif d’environ 5 Md$ (−5,4 Md$ au 10-Q), et guidance annuelle relevée à au moins 90 Md$ de revenus.' },
  { date: '2026-09-11', form: '10-Q', accession: '0001193125-26-389274', url: 'https://www.sec.gov/Archives/edgar/data/1341439/000119312526389274/orcl-20260831.htm', path: prim + '/q1fy27-10q.htm',
    finding: 'Le rapport trimestriel confirme l’usage complet du programme ATM (environ 141 millions d’actions pour 19,9 Md$ nets) et un capex de 28,5 Md$. Le flux opérationnel de 23,1 Md$ inclut 11,4 Md$ de prépaiements clients ; les emprunts reculent de 129,5 à 125,3 Md$. Il mentionne 288 Md$ de loyers futurs hors bilan et une class action sur OCI amendée le 14 juillet.' },
  { date: '2026-09-14', form: '8-K / Exhibit 99.1', accession: '0001193125-26-389753', url: 'https://www.sec.gov/Archives/edgar/data/1341439/000119312526389753/d20034dex991.htm', path: prim + '/sep14-ex991.htm',
    finding: 'Oracle annonce que Larry Ellison a annulé son plan de cession 10b5-1 sans qu’aucune action n’ait été vendue au titre de ce plan, et qu’il n’a pas d’autre plan de vente. Le signal porte sur l’offre de titres du premier actionnaire, pas sur les résultats.' },
  { date: '2026-06-23', form: '424B5', accession: '0001193125-26-278585', url: 'https://www.sec.gov/Archives/edgar/data/1341439/000119312526278585/d120346d424b5.htm', path: prim + '/jun23-424b5.htm',
    finding: 'Supplément de prospectus du programme d’émission d’actions « at-the-market » plafonné à 20 Md$, qui ajoute des agents placeurs. Il fixe la capacité juridique d’émission ; le 10-Q suivant montre que cette capacité a été entièrement utilisée au premier trimestre.' },
  { date: '2026-06-22', form: '10-K', accession: '0001193125-26-277521', url: 'https://www.sec.gov/Archives/edgar/data/1341439/000119312526277521/orcl-20260531.htm', path: prim + '/fy26-10k.htm',
    finding: 'Rapport annuel : aucun client au-dessus de dix pour cent du chiffre d’affaires, mais une concentration non nominative sur quelques grands clients OCI, et des actions préférentielles obligatoirement convertibles en janvier 2029 dont la conversion dépend du cours.' },
];
for (const d of docs) d.sha256 = sha(bytes(d.path));
const primary = { kind: 'primary_sec_manifest_v1', ticker: 'ORCL', as_of: '2026-09-24', inventory_count: 7, inventory_screened_count: 7, opened_count: 5, reviewed_count: 5, decision_relevant_count: 5, local_primary_count: docs.length,
  review_scope: 'Dépôts EDGAR d’Oracle du 15 mai au 23 septembre 2026, formulaires de détention exclus. Sept dépôts inventoriés ; le formulaire SD et le communiqué de résultats du 10 juin, repris et remplacé par le 10-K, sont écartés comme non décisionnels.',
  documents: docs,
  semantic_findings: {
    rpo: { source_path: prim + '/q1fy27-10q.htm', source_sha256: docs[1].sha256, source_needles: ['664 billion'] },
    atm: { source_path: prim + '/q1fy27-10q.htm', source_sha256: docs[1].sha256, source_needles: ['fully utilized the ATM Program'] },
    leases: { source_path: prim + '/q1fy27-10q.htm', source_sha256: docs[1].sha256, source_needles: ['additional lease commitments'] },
    customers: { source_path: prim + '/fy26-10k.htm', source_sha256: docs[4].sha256, source_needles: ['No single customer accounted for 10% or more of our total revenues'] },
    convertible: { source_path: prim + '/fy26-10k.htm', source_sha256: docs[4].sha256, source_needles: ['499.8126', '624.7657'] },
    gaap_fy26: { source_path: prim + '/fy26-10k.htm', source_sha256: docs[4].sha256, source_needles: ['>67,357<', '>20,606<', '>7,623<', '>1,671<', '>17,087<', '>3,547<'] },
    gaap_q1: { source_path: prim + '/q1fy27-10q.htm', source_sha256: docs[1].sha256, source_needles: ['>19,345<', '>14,926<', '>6,728<', '>4,277<', '>3,156<', '>1,351<', '>4,760<', '>2,927<', '>307<', '>73<'] },
    ampere: { source_path: prim + '/q1fy27-ex991.htm', source_sha256: docs[0].sha256, source_needles: ['Ampere'] },
    balance: { source_path: prim + '/q1fy27-10q.htm', source_sha256: docs[1].sha256, source_needles: ['>7,625<', '>117,712<', '>34,621<', '>9,185<', '>36,369<', '>708<', '>7,199<', '>122,342<'] },
    cash_flow: { source_path: prim + '/q1fy27-10q.htm', source_sha256: docs[1].sha256, source_needles: ['>23,103<', '>28,499<', '>11,363<', '>4,202<', '>830<', 'customer prepayments with significant financing component'] },
    litigation: { source_path: prim + '/q1fy27-10q.htm', source_sha256: docs[1].sha256, source_needles: ['Securities Class Action Regarding Oracle Cloud Infrastructure'] },
  } };
write(rev + '/primary-manifest.json', primary);
const ref = i => ({ name: 'Oracle ' + docs[i].form, url: docs[i].url, date: docs[i].date });
const market = name => ({ name: 'Données de marché : ' + name, url: 'https://mcp.dailytickers.com/mcp', date: '2026-09-24' });

// ---------------------------------------------------------------- le dossier
const archivePath = run + '/original/ORCL.json', archive = read(archivePath);
const score = { business: 24, technical: -3, capital: -9, calendar: 0, dilution: -6, risk: 52 };
const scoreValue = Object.values(score).reduce((a, b) => a + b, 0);
const a = {
  meta: { lang: 'fr', dir: 'ltr', level: 'intermediate', tags: ['us', 'equities', 'ai-chain', 'software', 'technology'], grade: 'B-', date: '2026-09-24', dateDisplay: '24 septembre 2026', version: 3, status: 'watch', assetType: 'stock', levelsCloseDate: REF,
    description: 'Oracle : un carnet de commandes géant, une facture d’investissement qui l’est tout autant. Dossier au close du 23 septembre 2026, statut surveiller.',
    ogDescription: 'Oracle : croissance de l’infrastructure cloud, financement par dette et par actions, et niveaux à surveiller.',
    lastMcpRefresh: raw.status.captured_at, levelsVerifiedAt: raw.status.captured_at },
  header: { ticker: 'ORCL', name: 'Oracle Corporation', exchange: 'NYSE', sector: 'Logiciels et infrastructure cloud', price: close, changePct: pct(close, prev),
    badges: [{ text: 'SURVEILLER — PAS D’ENTRÉE AU COURS ACTUEL', color: 'blue' }, { text: 'Infrastructure cloud IA', color: 'purple' }],
    metrics: { marketCap: fr(marketCap / 1e9, 1) + ' Md$', volume: fr(bars[N][5] / 1e6, 2) + ' M', evEbitda: fr(ev / G$.ebitda, 1) + '×' }, halalStatus: 'unknown' },
  verdict: { score: scoreValue, conviction: 'Moderate', bias: 'Neutral',
    confidence: 'Score éditorial non prédictif. Les chiffres d’entreprise viennent des dépôts SEC du trimestre ; les niveaux, du close certifié du 23 septembre.',
    summary: 'Oracle vend de la capacité de calcul pour l’IA plus vite qu’il ne peut la construire. Le trimestre publié le 10 septembre le montre : l’infrastructure cloud double, le carnet de commandes atteint un niveau sans équivalent dans le logiciel. Le problème est le financement. Le capex dépasse un flux opérationnel lui-même gonflé par des prépaiements de clients, et la société a vendu en un trimestre tout son programme d’émission d’actions pendant qu’elle remboursait de la dette. Chaque commande exige du capital avant de rapporter. Le titre a ouvert en forte hausse au lendemain des résultats, puis a tout rendu et au-delà. Ce comportement dit que le marché paie la croissance, mais escompte le coût de la financer. Pas d’entrée au cours actuel : le titre est repassé sous le plus bas du 21 septembre et sous ses moyennes courtes. Le signal utile serait une clôture au-dessus du plus haut du 22 septembre ; une clôture sous le point bas d’après résultats ferait abandonner le scénario.',
    whyBuy: [
      'Le chiffre d’affaires trimestriel atteint 19,3 Md$, en hausse de 30 %, et l’infrastructure cloud 7,4 Md$, en hausse de 121 % : la croissance est dans les comptes, pas seulement dans les promesses.',
      'Le carnet de commandes contractuel (RPO) atteint 664 Md$ ; le 10-Q en situe environ 13 % sur les douze prochains mois, ce qui donne une visibilité rare sur les revenus.',
      'La direction relève sa prévision annuelle à au moins 90 Md$ de revenus et vise un bénéfice par action ajusté de 8,10 $ ; c’est une attente, pas un résultat.',
      'Larry Ellison a annulé son plan de vente d’actions : l’offre de titres du premier actionnaire ne pèse plus sur le cours.'],
    whyAvoid: [
      'Au close du 23 septembre, la valeur d’entreprise représente ' + fr(ev / G$.ebitda, 1) + ' fois l’EBITDA GAAP des douze mois clos le 31 août, alors que le flux de trésorerie libre est négatif : la valorisation suppose que l’investissement paiera.',
      'Le capex trimestriel de 28,5 Md$ dépasse le flux opérationnel de 23,1 Md$, qui contient 11,4 Md$ de prépaiements clients : hors ce poste, le flux libre ressort à ' + fr(G$.fcfExPrepay / 1e9, 1).replace('-', '−') + ' Md$.',
      'Le programme d’émission d’actions de 20 Md$ a été entièrement utilisé en un trimestre : environ 141 millions d’actions nouvelles, soit une dilution déjà réalisée.',
      'Le titre clôture sous ses moyennes mobiles à vingt et cinquante séances, très loin sous celle à deux cents séances, et sous le plus bas du 21 septembre : la tendance reste baissière.'],
    controlChecklist: [
      { label: 'Historique de cours', status: 'pass', statusLabel: 'Trois cents séances continues', evidence: 'Série quotidienne reconstruite et certifiée au close du 23 septembre.', action: 'Niveaux et moyennes calculés sur cette seule série.' },
      { label: 'Financement', status: 'warn', statusLabel: 'Dilution réalisée', evidence: 'Programme d’émission d’actions épuisé au premier trimestre ; nouvelle capacité non annoncée.', action: 'Relire chaque nouveau dépôt avant toute entrée.' },
      { label: 'Calendrier', status: 'warn', statusLabel: 'Prochains résultats non confirmés', evidence: 'Aucune publication dans les quatorze jours du calendrier collecté.', action: 'Confirmer la date auprès de l’émetteur.' }] },
  business: { theme: 'Logiciels d’entreprise et infrastructure cloud pour l’IA',
    overview: '<p>Oracle a trois métiers. Le logiciel historique, bases de données et licences, recule doucement à mesure que les clients migrent vers le cloud. Les applications cloud, ERP et santé, progressent de 10 %. Et l’infrastructure cloud, OCI, où la société loue de la capacité de calcul à des clients qui entraînent et font tourner des modèles d’IA.</p><p>C’est ce dernier métier qui porte la thèse. Il a pesé 7,4 Md$ au trimestre clos le 31 août, en hausse de 121 %. Le carnet de commandes (RPO) atteint 664 Md$, en hausse de 209 Md$ sur un an. Oracle indique avoir livré plus de trois cent mille GPU depuis la fin du trimestre précédent.</p><p>Le revers est mécanique. Pour livrer, il faut construire des centres de données, acheter des puces et sécuriser de l’électricité avant d’encaisser. Le capex du trimestre, 28,5 Md$, a dépassé le flux opérationnel de 23,1 Md$. Ce flux contient lui-même 11,4 Md$ de prépaiements de clients : une avance de trésorerie liée à des contrats, pas un bénéfice récurrent. Le trou a été comblé par 19,9 Md$ d’actions émises. Dans le même temps, Oracle a remboursé 4,2 Md$ de dette senior et 0,8 Md$ de financements de court terme ; ses emprunts sont revenus de 129,5 à 125,3 Md$. Il s’est aussi engagé sur 288 Md$ de loyers de centres de données qui ne figurent pas encore au bilan.</p>',
    moat: 'La base installée de bases de données et d’applications crée une relation longue avec les grandes entreprises, et OCI a démontré sa capacité à signer des contrats de très grande taille. L’avantage sur l’infrastructure IA est moins durable : il tient à la vitesse de construction et au coût du capital, deux terrains où les hyperscalers et les néo-clouds se battent aussi.',
    segments: [
      { name: 'Cloud (IaaS et SaaS)', revenue: '11,6 Md$ au trimestre', pct: '60 %', description: 'Infrastructure 7,4 Md$ (+121 %), applications 4,2 Md$ (+10 %).' },
      { name: 'Logiciel sous licence', revenue: '5,5 Md$ au trimestre', pct: '29 %', description: 'En recul de 3 % : migration des clients vers le cloud.' },
      { name: 'Services et matériel', revenue: '2,2 Md$ au trimestre', pct: '11 %', description: 'Services 1,4 Md$, matériel 0,8 Md$.' }],
    sourceRefs: [ref(0), ref(1)],
    coverageMatrix: [
      { facet: 'Cours et historique', status: 'COUVERT', decision: 'Trois cents séances continues, close certifié ; base des niveaux.' },
      { facet: 'Résultats et guidance', status: 'COUVERT — PRIMAIRE', decision: 'Communiqué du 10 septembre et 10-Q ; prochaine date non confirmée.' },
      { facet: 'Capital et dilution', status: 'COUVERT — PRIMAIRE', decision: 'Programme d’actions épuisé, préférentielles convertibles et dette séparées.' },
      { facet: 'Comparables et transmission', status: 'COUVERT — LOCAL', decision: 'Corrélations recalculées sur barres certifiées depuis la fin juillet ; une seule foncière écartée pour barre invalide.' },
      { facet: 'Initiés', status: 'PARTIEL', decision: 'Couverture officielle incomplète : aucun solde net ni absence d’achat affirmés.' },
      { facet: 'Options', status: 'NON EXPLOITABLE', decision: 'Chaîne relevée marché fermé, sans prix ni intérêt ouvert utilisables.' },
      { facet: 'Sentiment et tendances de recherche', status: 'INDISPONIBLE', decision: 'Aucune mesure qualifiée ; non utilisé.' }] },
  news: [
    { date: '2026-09-10', title: 'Premier trimestre : l’infrastructure cloud double', impact: 'positive', detail: 'La croissance d’OCI et le carnet de commandes relèvent la visibilité des revenus, mais le flux de trésorerie libre reste négatif : la croissance consomme du capital.', source: 'Oracle — SEC', sourceUrl: docs[0].url },
    { date: '2026-09-11', title: 'Le 10-Q confirme l’émission complète de 20 Md$ d’actions', impact: 'negative', detail: 'L’émission de près de cent quarante et un millions d’actions a dilué les actionnaires existants pour financer les centres de données ; la dilution est réalisée, pas hypothétique.', source: 'Oracle — SEC', sourceUrl: docs[1].url },
    { date: '2026-09-14', title: 'Larry Ellison renonce à vendre ses actions', impact: 'positive', detail: 'L’annulation du plan de cession retire une offre potentielle importante de titres sur le marché, sans rien changer à l’économie des contrats ni au besoin de financement.', source: 'Oracle — SEC', sourceUrl: docs[2].url },
    { date: '2026-07-14', title: 'La class action sur OCI est amendée', impact: 'negative', detail: 'Des actionnaires reprochent des déclarations trompeuses sur l’infrastructure cloud ; la procédure ne chiffre rien encore, mais elle cible le métier qui porte la valorisation.', source: 'Oracle — SEC (10-Q)', sourceUrl: docs[1].url }],
  fundamentals: { rows: [
      { metric: 'Chiffre d’affaires du trimestre', value: '19,3 Md$', signal: '+30 % sur un an, communiqué du 10 septembre', signalColor: 'green' },
      { metric: 'Infrastructure cloud du trimestre', value: '7,4 Md$', signal: '+121 % sur un an', signalColor: 'green' },
      { metric: 'Flux opérationnel du trimestre', value: '23,1 Md$', signal: 'Dont 11,4 Md$ de prépaiements clients, 10-Q', signalColor: 'amber' },
      { metric: 'Capex du trimestre', value: '28,5 Md$', signal: 'Supérieur au flux opérationnel', signalColor: 'red' },
      { metric: 'Flux de trésorerie libre du trimestre', value: fr(G$.fcf / 1e9, 1).replace('-', '−') + ' Md$', signal: 'Flux opérationnel − capex, 10-Q', signalColor: 'red' },
      { metric: 'Flux libre hors prépaiements clients', value: fr(G$.fcfExPrepay / 1e9, 1).replace('-', '−') + ' Md$', signal: 'Sans les avances de clients, trimestre clos le 31 août', signalColor: 'red' },
      { metric: 'Revenus GAAP sur douze mois', value: fr(G$.rev / 1e9, 2) + ' Md$', signal: 'Douze mois glissants au 31 août 2026 (10-K + 10-Q)', signalColor: 'blue' },
      { metric: 'EBITDA GAAP sur douze mois', value: fr(G$.ebitda / 1e9, 2) + ' Md$', signal: 'Résultat opérationnel + amortissements, douze mois au 31 août 2026', signalColor: 'blue' },
      { metric: 'Résultat net GAAP sur douze mois', value: fr(G$.ni / 1e9, 2) + ' Md$', signal: 'Douze mois glissants au 31 août 2026', signalColor: 'blue' },
      { metric: 'Dette au 31 août (emprunts + loyers)', value: fr(G$.debt / 1e9, 2) + ' Md$', signal: 'Emprunts ' + fr(G$.borrowAug / 1e9, 1) + ' Md$ + passifs de location, bilan du 10-Q', signalColor: 'amber' },
      { metric: 'Trésorerie et placements au 31 août', value: fr(G$.cash / 1e9, 2) + ' Md$', signal: 'Bilan du 10-Q', signalColor: 'blue' },
      { metric: 'EV/EBITDA GAAP', value: fr(ev / G$.ebitda, 1) + '×', signal: 'Enterprise value au close du 2026-09-23 sur EBITDA GAAP douze mois au 2026-08-31', signalColor: 'amber', source: 'Clôture certifiée, 10-K et 10-Q', comparison: 'Versus le scénario ci-dessous : l’écart mesure la prime accordée au carnet de commandes.' },
      { metric: 'EV/revenus GAAP', value: fr(ev / G$.rev, 1) + '×', signal: 'Enterprise value au close du 2026-09-23 sur revenus GAAP douze mois au 2026-08-31', signalColor: 'amber', source: 'Clôture certifiée, 10-K et 10-Q', comparison: 'Versus une croissance de 30 % : le multiple suppose que la croissance dure.' },
      { metric: 'P/E GAAP sur douze mois', value: fr(marketCap / G$.ni, 1) + '×', signal: 'Trailing : capitalisation au 2026-09-23 sur résultat net GAAP douze mois au 2026-08-31', signalColor: 'blue', source: 'Clôture certifiée, 10-K et 10-Q', comparison: 'Versus le P/E forward : la baisse attendue du multiple suppose la croissance du bénéfice guidée. Ce P/E est flatté par 3,8 Md$ de produits non opérationnels sur douze mois, dont 3,5 Md$ sur l’exercice 2026, qui inclut le gain ponctuel de la cession de la participation dans Ampere.' },
      { metric: 'P/E forward sur guidance', value: fr(close / EPS_FY27_GUIDE, 1) + '×', signal: 'Forward : close du 2026-09-23 sur bénéfice ajusté non-GAAP de 8,10 $ guidé pour l’exercice 2027', signalColor: 'blue', source: 'Clôture certifiée et communiqué du 10 septembre', comparison: 'Versus le P/E GAAP : base non-GAAP, hors éléments exceptionnels, donc non comparable terme à terme.' },
      { metric: 'EV/EBITDA — scénario de compression (hypothèse éditoriale)', value: fr(scenarioPrice, 2) + ' $ par action', signal: 'Scenario : multiple GAAP réduit de 30 % par hypothèse, dette et trésorerie du 2026-08-31 inchangées, soit ' + fr(pct(scenarioPrice, close), 0).replace('-', '−') + ' % sous le close du 2026-09-23', signalColor: 'red', source: 'Clôture certifiée, 10-K et 10-Q', comparison: 'Versus le close : hypothèse de marché payant Oracle comme un fournisseur d’infrastructure et non comme un éditeur ; ce n’est pas un objectif.' }],
    sourceRefs: [ref(0), ref(1), market('fondamentaux et statistiques')] },
  earnings: { quarters: [],
    beatNote: 'Premier trimestre de l’exercice 2027 : bénéfice par action GAAP de 1,56 $ (+55 %), ajusté de 1,92 $ (+30 %). Guidance du deuxième trimestre : revenus en hausse de 30 à 34 %, bénéfice ajusté de 1,85 à 1,93 $ par action. Exercice complet : au moins 90 Md$ de revenus et 8,10 $ de bénéfice ajusté. Ces prévisions dépendent de la mise en service des capacités, pas seulement des commandes. Aucune date de prochaine publication n’est confirmée par l’émetteur à ce jour.',
    nextEarnings: 'Date non confirmée par l’émetteur ; aucune publication dans les quatorze jours du calendrier collecté.',
    sourceRefs: [ref(0)] },
  capitalStructure: { sharesOutstanding: fr(s.sharesOutstanding / 1e9, 3) + ' milliards d’actions au 7 septembre 2026 (page de garde du 10-Q)',
    sharesAuthorized: 'Onze milliards d’actions ordinaires autorisées, selon le bilan du 10-Q.',
    dilutionRisk: 'high',
    shareHistory: 'Le nombre d’actions en circulation est passé d’environ 2,880 à 3,024 milliards entre le 31 mai et le 31 août 2026, surtout à cause des quelque 141 millions d’actions émises via le programme « at-the-market », pour 19,9 Md$ nets. À cela s’ajoutent cinquante mille actions préférentielles obligatoirement convertibles au 15 janvier 2029, chacune en 499,8126 à 624,7657 actions ordinaires selon le cours : entre environ vingt-cinq et trente et un millions d’actions supplémentaires. Un nombre d’actions entièrement dilué à date n’est pas calculable depuis ces seuls dépôts. Les emprunts, 125,3 Md$ au 31 août contre 129,5 Md$ au 31 mai, ont baissé sur le trimestre : l’émission d’actions a financé le capex et des remboursements. La dette ne dilue pas, mais pèse sur le flux disponible.',
    warrants: [],
    atm: { active: false, authorized: '20 Md$ (supplément du 23 juin 2026)', used: '19,9 Md$ nets, environ 141 millions d’actions', remaining: 'Épuisé au 31 août 2026 ; aucun nouveau programme relevé' },
    sourceRefs: [ref(1), ref(3), ref(4)] },
  filingsReview: { summary: 'Cinq dépôts décisionnels ouverts et hachés. Ils séparent trois choses que le marché mélange : les résultats, qui sont bons ; le financement, par dette et par actions, qui dilue et endette ; et l’offre de titres des initiés, qui se réduit.',
    filings: docs.map(d => ({ date: d.date, form: d.form, accession: d.accession, finding: d.finding, url: d.url })),
    contrarianRisks: [
      'Le carnet de commandes est concentré sur quelques grands clients OCI non nommés : une défaillance ou une renégociation pèserait lourd.',
      'Les engagements de location non comptabilisés dépassent la dette senior ; ils entreront au bilan à mesure que les centres de données ouvriront.',
      'Le programme d’actions est épuisé : un nouveau besoin de capital passerait par une nouvelle émission ou par davantage de dette.',
      'Une annulation de plan de vente n’est pas un achat : elle retire une offre, elle n’apporte pas de demande.',
      'Le flux opérationnel du trimestre repose en partie sur des prépaiements de clients : un encaissement d’avance ne se répète pas mécaniquement.',
      'Une class action d’actionnaires vise les déclarations passées sur OCI ; l’issue et le montant éventuel ne sont pas chiffrés par la société.'] },
  technicals: { rsi14: +t.rsi.toFixed(2), macd: +t.macd.toFixed(2), macdSignal: +t.signal.toFixed(2), ema20: +t.ema20.toFixed(2), ema50: +t.ema50.toFixed(2), ema200: +t.ema200.toFixed(2),
    ma50Type: 'EMA', ma200Type: 'EMA', ma50Available: true, ma200Available: true, atr14: +t.atr.toFixed(2),
    badges: ['Sous les moyennes à vingt et cinquante séances', 'Sous le plus bas du 21 septembre', 'Pas d’entrée au cours actuel'],
    supports: [lv('low923'), lv('low915'), abandon],
    resistances: [stop, entry, tp1],
    setupNote: 'Le titre clôture à ' + usd(close) + ', sous le plus bas du 21 septembre (' + usd(stop) + '), devenu résistance, et sous ses moyennes à vingt et cinquante séances. Avant activation, aucune entrée ; une clôture sous ' + usd(abandon) + ', point bas d’après résultats du 16 septembre, abandonne le scénario. Activation sur une clôture au-dessus de $' + entry.toFixed(2) + ', le plus haut du 22 septembre. Après activation, stop sous $' + stop.toFixed(2) + ' : une rechute sous l’ancien plus bas signerait l’échec de la reprise. Supports : ' + usd(lv('low923')) + ', ' + usd(lv('low915')) + ' et ' + usd(abandon) + '. Résistances : ' + usd(stop) + ', ' + usd(entry) + ' et ' + usd(tp1) + ' ; TP2 à ' + usd(tp2) + ' dans le plan de trade.',
    wyckoff: 'Non utilisé : le profil de volume n’est pas exploité dans ce dossier.',
    sourceRefs: [market('barres quotidiennes et indicateurs')] },
  performance: { windowReturns: { label: 'Rendements de prix sur vingt et une séances, sans dividendes réinvestis', startDate: bars[N - 21][0], endDate: bars[N][0],
      rows: [{ ticker: 'ORCL', returnPct: +ret(21).toFixed(2) }, ...Object.entries(M).map(([ticker, x]) => ({ ticker, returnPct: x.return21d }))] },
    sourceRefs: [market('barres quotidiennes comparées')] },
  options: { callOI: 'Non exploitable', putOI: 'Non exploitable', cpRatio: 'Non exploitable', maxPain: 'Non exploitable', ivMean: 'Non exploitable', skew: 'Chaîne relevée marché fermé, sans prix ni intérêt ouvert', unusual: 'Aucune activité inhabituelle qualifiée sur l’échéance la plus proche', sourceRefs: [market('options')] },
  shortInterest: { siPct: fr(s.shortPercentOfFloat * 100, 2) + ' % du flottant', daysToCover: fr(s.shortRatio, 2) + ' jours, date de règlement non précisée par le snapshot', ctb: 'Coût d’emprunt bas, sans tension', trend: 'Positions vendeuses faibles pour une capitalisation de cette taille ; aucune thèse de rachat forcé des vendeurs.', squeezeScore: 'Non pertinent', sourceRefs: [market('positions vendeuses')] },
  insiders: { signal: 'Ventes de marché de Michael Sicilia, membre de la co-direction générale : 10 882 actions le 16 septembre à 139,94 $, puis 22 562 le 22 septembre à 151,59 $, chaque fois précédées d’un formulaire 144 déposé le même jour. La responsable comptable (Chief Accounting Officer) a vendu 2 631 actions le 22 septembre. Les autres mouvements de septembre sont des exercices d’options et des retenues fiscales. Couverture officielle partielle : aucun solde net publié. L’annulation du plan de cession de Larry Ellison reste le fait d’initié le plus lourd en volume potentiel.',
    recentTransactions: [
      { date: '2026-09-22', insider: 'Michael D. Sicilia — co-direction générale', type: 'sell', shares: '22 562', value: '3,42 M$' },
      { date: '2026-09-22', insider: 'Maria Smith — Chief Accounting Officer', type: 'sell', shares: '2 631', value: '0,40 M$' },
      { date: '2026-09-16', insider: 'Michael D. Sicilia — co-direction générale', type: 'sell', shares: '10 882', value: '1,52 M$' }],
    sourceRefs: [market('dépôts de formulaires 4 et 144'), ref(2)] },
  blastRadius: {},
  macro: { indicators: [{ name: 'Clôture de référence', value: REF, signal: usd(close) + ', séance complète' }, { name: 'Rendement cinq séances', value: sgn(ret(5)), signal: 'Descriptif' }, { name: 'Rendement vingt et une séances', value: sgn(ret(21)), signal: 'Descriptif' }],
    regime: 'neutral', impact: 'Un titre qui finance sa croissance par la dette est sensible aux taux longs : leur hausse renchérit chaque dollar de capex à venir. Le régime de marché ne remplace pas ce test.' },
  risks: { riskScore: 7, riskProfile: 'High',
    riskSummary: 'Le risque d’Oracle n’est pas la demande, c’est le décalage entre le moment où il dépense et le moment où il encaisse. Tant que le capex dépasse le flux opérationnel, chaque trimestre exige du financement externe : dette, loyers ou actions. Une hausse des taux, un client qui ralentit ou un chantier en retard suffisent à rendre ce financement plus cher.',
    riskCards: [
      { title: 'Financement de la croissance', severity: 'high', icon: 'fa-sack-dollar', points: ['Capex trimestriel supérieur au flux opérationnel, lui-même porté par des prépaiements de clients.', 'Programme d’actions épuisé ; passifs de location et loyers futurs hors bilan élevés.'], verdict: 'Suivre le flux libre hors prépaiements et le moindre nouveau dépôt de financement avant de considérer une position.' },
      { title: 'Concentration des clients OCI', severity: 'high', icon: 'fa-users', points: ['Le 10-K mentionne une concentration sur quelques grands clients.', 'Aucun client n’est nommé : le risque de contrepartie n’est pas mesurable depuis les dépôts.'], verdict: 'Une renégociation ou un retard d’un grand client affecterait directement le carnet et la valeur des capacités construites.' },
      { title: 'Litige d’actionnaires sur OCI', severity: 'medium', icon: 'fa-scale-balanced', points: ['Class action déposée en février et amendée en juillet devant un tribunal fédéral du Delaware.', 'Elle vise des dirigeants, dont la direction technique et l’un des membres de la co-direction générale.'], verdict: 'Aucun montant n’est provisionné ni chiffré : un risque de titre et de gouvernance, pas encore un risque de trésorerie.' },
      { title: 'Exécution et calendrier', severity: 'medium', icon: 'fa-hard-hat', points: ['Électricité, puces et permis conditionnent la mise en service.', 'La prochaine date de résultats n’est pas confirmée.'], verdict: 'Un retard de mise en service décale le revenu sans décaler les loyers et les intérêts ; ne pas anticiper une publication non datée.' }],
    pedagogy: 'Le titre a ouvert en gap le lendemain des résultats puis a tout rendu : acheter à l’ouverture après une publication, c’est payer le pic de la réaction. Le spread et le slippage à l’ouverture peuvent dépasser le risque prévu. Dimensionner la position à partir de la distance au stop et d’un budget de perte fixé d’avance, jamais à partir de l’objectif. Ne pas poursuivre une hausse : attendre le déclencheur de clôture.' },
  tradeIdea: { status: 'watch', statusNote: 'Surveiller. Avant activation : aucune entrée ; une clôture sous ' + usd(abandon) + ' abandonne le scénario. Activation : clôture au-dessus de ' + usd(entry) + ', puis achat à l’ouverture suivante seulement sous ' + usd(cap) + '. Après activation : stop sous ' + usd(stop) + '.',
    entry, stop, tp1, tp2,
    stopPct: pct(stop, entry).toFixed(1) + '%', tp1Pct: '+' + pct(tp1, entry).toFixed(1) + '%', tp2Pct: '+' + pct(tp2, entry).toFixed(1) + '%',
    rr: '1:' + rr1.toFixed(2) + ' TP1 / 1:' + rr2.toFixed(2) + ' TP2',
    entryNote: 'Déclencheur sur clôture au-dessus du plus haut du 22 septembre, pas sur un franchissement en séance. Entrée à l’ouverture suivante uniquement sous ' + usd(cap) + ' : au-delà, le R/R vers TP1 tomberait sous 1,3 avec le même stop. Un plafond d’un quart d’ATR au-dessus du déclencheur (' + usd(entry + 0.25 * t.atr) + ') le ramènerait vers 1,1 : il est écarté. Le setup précédent n’a jamais été valablement déclenché : le 11 septembre, le titre a ouvert en gap à ' + usd(lv('open911')) + ', bien au-dessus du seuil de non-poursuite, puis a clôturé à ' + usd(lv('close911')) + ', sous son pivot.',
    horizon: 'Dix séances après activation',
    thesis: 'Le marché a vendu la publication malgré de bons chiffres : il escompte le coût du financement. Avant activation, le dossier reste en surveillance et une clôture sous ' + usd(abandon) + ' l’abandonne. Une clôture au-dessus de $' + entry.toFixed(2) + ' montrerait que les vendeurs d’après résultats sont absorbés ; l’entrée n’a lieu qu’à l’ouverture suivante et sous ' + usd(cap) + '. Après activation, le stop sous $' + stop.toFixed(2) + ' limite le risque à la dernière base. TP1 à ' + usd(tp1) + ' reprend le plus haut du 9 septembre, TP2 à ' + usd(tp2) + ' celui du 8. Taille réduite : un nouveau dépôt de financement peut créer un gap contre la position. Ne pas anticiper le déclencheur.',
    catalysts: ['Une clôture au-dessus du plus haut du 22 septembre, sur volume au moins égal à la moyenne récente.', 'L’absence de nouveau programme d’émission d’actions dans les dépôts.', 'Les résultats de Micron, attendus le 30 septembre après la clôture selon deux calendriers mais sans confirmation officielle relevée, testeront la demande de mémoire pour l’IA ; dans l’horizon du trade, ils peuvent créer un gap sur les valeurs de l’IA, ORCL compris.'],
    invalidation: ['Avant activation : une clôture sous ' + usd(abandon) + ', point bas d’après résultats, abandonne le scénario.', 'Après activation : une clôture sous ' + usd(stop) + ' invalide le trade.', 'Ouverture au-dessus de ' + usd(cap) + ' après la clôture de déclenchement : pas d’achat, le R/R deviendrait insuffisant.', 'Un nouveau dépôt de financement en actions annule la thèse avant activation.'] },
  globalScore: { profile: 'Croissance réelle, financement coûteux',
    keyTakeawaysPositive: ['Croissance de l’infrastructure cloud supérieure à cent pour cent, visible dans les comptes.', 'Carnet de commandes contractuel sans équivalent dans le logiciel.', 'Offre de titres du premier actionnaire retirée.'],
    keyTakeawaysNegative: ['Flux de trésorerie libre négatif : la croissance consomme du capital.', 'Dilution réalisée par l’émission complète du programme d’actions.', 'Tendance de fond baissière : titre sous ses moyennes.'],
    mindsetTip: 'Un carnet de commandes n’est pas du cash. Regarder qui paie la construction avant de regarder qui signe la commande.' },
  social: { platforms: [], sourceRefs: [market('sentiment non retenu faute de mesure qualifiée')] },
  disclaimer: 'Document de recherche éducatif. Ni conseil financier, ni signal de trading. Statut surveiller : aucun ordre actif.',
};

// ---------------------------------------------------------------- blast radius
const G = [
  { name: 'Leaders du cloud', order: 1, transmission: 'Ils fixent le prix et le rythme de la capacité IA ; leur capex dit si la demande tient.', rows: [
    ['MSFT', 'leader', 'Hyperscaler et concurrent direct', 'Azure et OCI se disputent les mêmes contrats d’entraînement ; un ralentissement du capex Microsoft signalerait une demande moins pressée.'],
    ['AMZN', 'leader', 'Premier fournisseur de cloud public', 'AWS fixe la référence de prix de la capacité ; une guerre de prix comprimerait la marge d’OCI.'],
    ['GOOGL', 'leader', 'Hyperscaler avec puces maison', 'Google Cloud s’appuie sur ses propres puces ; son avance de coût est une menace directe sur les contrats IA.']] },
  { name: 'Pairs directs', order: 1, transmission: 'Néo-clouds et éditeurs de logiciels d’entreprise : même clients, même budget.', rows: [
    ['CRWV', 'direct_peer', 'Néo-cloud IA concurrent direct', 'Loue la même capacité GPU aux mêmes laboratoires d’IA ; son coût de financement et ses marges servent de référence pour OCI.'],
    ['NBIS', 'direct_peer', 'Néo-cloud IA coté', 'Même modèle de location de GPU financée par capital externe ; ses conditions de financement éclairent celles d’Oracle.'],
    ['IBM', 'direct_peer', 'Logiciel et infrastructure d’entreprise', 'Même base de grands comptes et même transition du logiciel vers le cloud hybride.'],
    ['SAP', 'direct_peer', 'Concurrent en applications ERP', 'Concurrent frontal des applications cloud d’Oracle ; ses renouvellements mesurent la part de marché ERP.'],
    ['CRM', 'direct_peer', 'Applications cloud d’entreprise', 'Budget logiciel des mêmes directions ; une pression sur les applications toucherait les deux.'],
    ['NOW', 'direct_peer', 'Plateforme logicielle d’entreprise', 'Référence de valorisation des logiciels à abonnement ; elle encadre le multiple accordé aux applications Oracle.']] },
  { name: 'Amont : puces, réseau et serveurs', order: 1, transmission: 'Oracle achète ; ces fournisseurs encaissent le capex avant qu’Oracle n’encaisse ses revenus.', rows: [
    ['NVDA', 'upstream', 'Fournisseur de GPU', 'Les livraisons de GPU conditionnent la capacité OCI ; un retard de puces décale le revenu d’Oracle.'],
    ['AMD', 'upstream', 'Fournisseur de GPU alternatif', 'Seconde source d’accélérateurs ; sa disponibilité pèse sur le coût et le calendrier des déploiements.'],
    ['AVGO', 'upstream', 'Puces réseau et accélérateurs', 'Le réseau des clusters IA passe par ses puces ; la demande d’Oracle se lit dans ses commandes.'],
    ['ANET', 'upstream', 'Commutateurs de centres de données', 'Équipementier réseau des grands clusters ; un signal avancé de construction de capacité.'],
    ['MU', 'upstream', 'Mémoire à haut débit', 'La mémoire HBM limite l’assemblage des serveurs IA ; sa rareté renchérit le capex.'],
    ['DELL', 'upstream', 'Intégrateur de serveurs IA', 'Assemble des serveurs pour les clouds ; son carnet reflète en partie la demande des acheteurs de capacité.'],
    ['VRT', 'upstream', 'Alimentation et refroidissement', 'Équipements électriques et thermiques des centres de données ; un goulot pour la mise en service.'],
    ['ETN', 'upstream', 'Équipement électrique des centres de données', 'Transformateurs, tableaux et distribution électrique : ses délais de livraison fixent une partie du calendrier des sites.']] },
  { name: 'Second ordre : énergie, hébergement, acheteurs', order: 2, transmission: 'Contraintes physiques et demande indirecte : électricité, sites et grands acheteurs de capacité.', rows: [
    ['CEG', 'second_order', 'Producteur d’électricité nucléaire', 'L’électricité est le premier goulot des centres de données ; son prix pèse sur la marge d’OCI.'],
    ['VST', 'second_order', 'Producteur d’électricité à grande échelle', 'Ses contrats avec les centres de données indiquent le prix de l’électricité que paieront les clouds.'],
    ['NRG', 'second_order', 'Producteur et distributeur d’électricité', 'Exposé à la demande des centres de données au Texas ; un signal du coût marginal de l’énergie.'],
    ['TLN', 'second_order', 'Producteur d’électricité indépendant', 'Fournisseur d’énergie pour centres de données ; ses contrats indiquent le coût marginal de l’électricité.'],
    ['GEV', 'second_order', 'Turbines et équipements de réseau', 'Les délais d’équipements électriques fixent le calendrier des nouveaux sites.'],
    ['EQIX', 'second_order', 'Foncière de centres de données', 'Loue des sites aux clouds ; ses loyers et son coût de financement éclairent les 288 Md$ d’engagements de location d’Oracle.'],
    ['APLD', 'second_order', 'Hébergeur de centres de données IA', 'Même chaîne de construction financée à crédit ; ses conditions de financement signalent l’appétit du marché.'],
    ['META', 'second_order', 'Grand acheteur de capacité IA', 'Son capex mesure la demande des grands consommateurs de calcul ; ce n’est pas un client documenté d’Oracle.']] },
  { name: 'Contrôles sectoriels', order: 2, transmission: 'Paniers de référence pour séparer le mouvement du titre de celui de son secteur.', rows: [
    ['IGV', 'sector_proxy', 'Panier de logiciels américains', 'Mesure le mouvement du logiciel dans son ensemble, indépendamment du financement propre à Oracle.'],
    ['XLK', 'sector_proxy', 'Secteur technologie du S&P', 'Contrôle large de la technologie : un recul commun n’a rien de spécifique à Oracle.'],
    ['SMH', 'sector_proxy', 'Panier de semi-conducteurs', 'Contrôle de l’amont : si les puces montent et Oracle baisse, c’est le financement qui est en cause.']] },
];
const EV = {
  MSFT: 'Aucune publication dans les quatorze jours collectés ; les commentaires d’Azure sur la capacité restent le signal à suivre',
  AMZN: 'Aucune publication dans les quatorze jours collectés ; une baisse de prix d’AWS toucherait directement OCI',
  GOOGL: 'Aucune publication dans les quatorze jours collectés ; les annonces de puces maison peuvent peser sur la demande de GPU',
  CRWV: 'Aucune publication dans les quatorze jours collectés ; ses levées de dette fréquentes testent l’appétit pour le crédit IA',
  NBIS: 'Aucune publication dans les quatorze jours collectés ; émissions de capital récurrentes chez ce néo-cloud',
  IBM: 'Aucune publication dans les quatorze jours collectés ; ses renouvellements de grands comptes éclairent le logiciel d’entreprise',
  SAP: 'Aucune publication dans les quatorze jours collectés ; les migrations ERP vers le cloud sont le point de friction direct',
  CRM: 'Aucune publication dans les quatorze jours collectés ; ses commentaires sur les budgets logiciels valent pour Oracle',
  NOW: 'Aucune publication dans les quatorze jours collectés ; sa valorisation encadre celle des applications d’Oracle',
  NVDA: 'Aucune publication dans les quatorze jours collectés ; un retard d’expédition de GPU décalerait la capacité OCI',
  AMD: 'Aucune publication dans les quatorze jours collectés ; ses annonces d’accélérateurs changent le coût du calcul',
  AVGO: 'Aucune publication dans les quatorze jours collectés ; ses commandes de puces réseau précèdent les ouvertures de sites',
  ANET: 'Aucune publication dans les quatorze jours collectés ; ses commandes de commutateurs sont un indicateur avancé de construction',
  VRT: 'Aucune publication dans les quatorze jours collectés ; son carnet de refroidissement mesure la file d’attente des sites',
  DELL: 'Aucune publication dans les quatorze jours collectés ; ses marges sur serveurs IA disent si le matériel reste rare',
  MU: 'Résultats trimestriels le 30 septembre après la clôture, date corroborée par deux calendriers : dans l’horizon du trade',
  ETN: 'Aucune publication dans les quatorze jours collectés ; ses délais de transformateurs fixent le rythme des mises en service',
  CEG: 'Aucune publication dans les quatorze jours collectés ; ses contrats nucléaires avec les clouds fixent le prix de l’énergie de base',
  VST: 'Aucune publication dans les quatorze jours collectés ; ses accords avec les centres de données restent le catalyseur propre',
  NRG: 'Aucune publication dans les quatorze jours collectés ; la tension du réseau texan pèse sur son cours',
  TLN: 'Aucune publication dans les quatorze jours collectés ; ses contrats de fourniture aux centres de données sont renégociables',
  GEV: 'Aucune publication dans les quatorze jours collectés ; son carnet de turbines mesure les délais d’équipement',
  EQIX: 'Aucune publication dans les quatorze jours collectés ; sa sensibilité aux taux longs éclaire le coût des loyers d’Oracle',
  APLD: 'Aucune publication dans les quatorze jours collectés ; ses financements de sites sont un baromètre du crédit IA',
  META: 'Aucune publication dans les quatorze jours collectés ; toute révision de capex changerait la demande de capacité',
  IGV: 'Panier sans publication propre ; exposé aux résultats de ses grandes pondérations logicielles',
  XLK: 'Panier sans publication propre ; dominé par quelques grandes pondérations technologiques',
  SMH: 'Panier sans publication propre ; les résultats de Micron du 30 septembre peuvent le faire bouger' };
const ev_note = sym => { if (!EV[sym]) throw Error('eventRisk manquant ' + sym); return EV[sym]; };
a.blastRadius = {
  asOf: REF, observationTime: raw.status.captured_at,
  window: 'Rendements quotidiens communs du ' + firstCommon + ' au ' + REF,
  methodology: 'La fenêtre démarre le 27 juillet : plusieurs comparables avaient des séances manquantes en fin juillet, et une fenêtre plus longue aurait imposé de les écarter. Les séries sont alignées sur les mêmes dates de clôture et les rendements logarithmiques journaliers communs. La corrélation mesure le co-mouvement ; le bêta mesure la sensibilité du rendement d’Oracle à celui du comparable ; le coefficient de détermination est le carré de la corrélation. Les performances à cinq et vingt et une séances sont des rendements de prix sans dividendes. La fenêtre, courte, inclut la réaction aux résultats de septembre : les corrélations sont plus instables qu’en régime calme. Le classement statistique élargi, sur cent vingt-quatre observations, sert de contrôle de couverture sur une durée plus longue ; aucune corrélation ne prouve une relation commerciale.',
  groups: G.map(g => ({ name: g.name, order: g.order, transmission: g.transmission,
    symbols: g.rows.map(([ticker, relationClass, role, readThrough]) => ({ ticker, role, relationClass, confidence: relationClass === 'sector_proxy' ? 'medium' : 'low', readThrough, eventRisk: ev_note(ticker), ...M[ticker] })) })),
  scenarios: [
    { scenario: 'bullish', trigger: 'La mise en service des capacités accélère et le flux de trésorerie libre se rapproche de l’équilibre.', firstOrder: 'Les revenus OCI rattrapent le capex, le besoin de financement externe recule.', secondOrder: 'Les fournisseurs de puces et d’électricité gardent leur carnet, les néo-clouds se refinancent plus facilement.', confirmation: 'Un trimestre sans nouvelle émission d’actions et un flux libre en amélioration.', contradiction: 'Une nouvelle émission d’actions malgré la croissance des revenus.' },
    { scenario: 'mixed', trigger: 'Les revenus progressent comme prévu mais le capex reste supérieur au flux opérationnel.', firstOrder: 'La croissance est là, la dilution et la dette continuent d’augmenter.', secondOrder: 'L’amont profite, Oracle stagne : l’écart de performance avec les puces se creuse.', confirmation: 'Guidance tenue, flux libre toujours négatif, titre bloqué sous ses moyennes.', contradiction: 'Un flux libre positif plus tôt que prévu.' },
    { scenario: 'bearish', trigger: 'Un grand client ralentit ou les taux longs montent encore, renchérissant le financement.', firstOrder: 'Le carnet se révèle moins liquide, le coût de la dette et des loyers pèse sur la marge.', secondOrder: 'Les néo-clouds et hébergeurs financés à crédit décrochent, l’amont révise ses commandes.', confirmation: 'Une révision de guidance, un contrat renégocié ou une dégradation de la notation de crédit.', contradiction: 'Des livraisons et encaissements conformes malgré la hausse des taux.' }],
  contradictions: ['Les résultats sont solides mais le titre a baissé après publication : la corrélation avec les fournisseurs ne suffit pas à expliquer le mouvement.', 'Une corrélation élevée avec un comparable ne prouve pas un lien commercial ; les clients d’Oracle ne sont pas nommés.'],
  missingData: ['Une foncière de centres de données cotée est écartée : sa barre de mi-septembre, dans la fenêtre de calcul, a une géométrie invalide (prix hors de la fourchette du jour).', 'Fenêtre de corrélation courte, depuis la fin juillet, imposée par des séances manquantes chez plusieurs comparables avant cette date.', 'Chaîne d’options relevée marché fermé, inexploitable ; sentiment et tendances de recherche indisponibles ; prochaine date de résultats d’Oracle non confirmée par l’émetteur.'],
  sourceRefs: [market('barres comparables et classement statistique'), ref(1)] };

write(OUT_JSON, a);

// ---------------------------------------------------------------- jugements éditoriaux
const judgments = { ticker: 'ORCL', score_components: score, judgments: {
  'meta.version': { value: 3, reason: 'Version du schéma de dossier individualisé, non une observation financière.' },
  'meta.date': { value: a.meta.date, reason: 'Date de construction éditoriale, distincte de la clôture de référence.' },
  'meta.dateDisplay': { value: a.meta.dateDisplay, reason: 'Date éditoriale en français, non une observation financière.' },
  'verdict.score': { value: scoreValue, reason: 'Score additif : métier, technique, capital, calendrier, dilution et base de risque.' },
  'risks.riskScore': { value: 7, reason: 'Jugement qualitatif sur dix : financement, concentration des clients et exécution.' } } };
a.blastRadius.groups.forEach((g, i) => { judgments.judgments['blastRadius.groups.' + i + '.order'] = { value: g.order, reason: 'Classement économique éditorial du mécanisme de transmission, pas une causalité mesurée.' }; });
write(rev + '/editorial-judgments.json', judgments);

// ---------------------------------------------------------------- preuves
const inputs = [];
for (const [name, file] of [['bars', 'bars'], ['fund', 'fundamentals'], ['tech', 'technicals'], ['comparison', 'comparison_bars'], ['rank', 'rank_beta'], ['status', 'status'], ['insiders', 'insiders'], ['sec', 'sec_evidence'], ['earn', 'comparison_earnings']])
  inputs.push({ name, path: data + '/' + file + '.json', sha256: sha(bytes(data + '/' + file + '.json')) });
for (const [name, p, kind] of [['primary', rev + '/primary-manifest.json', 'primary_sec_manifest_v1'], ['judgments', rev + '/editorial-judgments.json', 'editorial_judgment']])
  inputs.push({ name, path: p, sha256: sha(bytes(p)), kind });
const inp = n => inputs.find(x => x.name === n);
const dep = (n, p) => ({ input_path: inp(n).path, input_sha256: inp(n).sha256, source_pointer: p });
const prov = (n, p, method, extra = []) => ({ ...dep(n, p), input_name: n, method, ...(extra.length ? { additional_inputs: extra } : {}) });
const SQ = '/data/items/0/results/0/data/0/points';
const gaap = () => prov('primary', '/documents/1', 'GAAP douze mois glissants au 31/08/2026 = exercice 2026 (10-K) − T1 FY26 + T1 FY27 (10-Q) ; EBITDA = résultat opérationnel + dépréciation + amortissement ; dette = emprunts + passifs de location ; trésorerie = liquidités + placements.', [dep('primary', '/documents/4')]);
const marketMath = () => prov('bars', B + '/' + N + '/4', 'Capitalisation = close × actions au 7 septembre ; EV = capitalisation + dette − trésorerie au 31/08 ; ratios sur agrégats GAAP douze mois.', [dep('fund', S + '/sharesOutstanding'), dep('primary', '/documents/1'), dep('primary', '/documents/4')]);
const P = i => prov('primary', '/documents/' + i, 'Chiffre lu dans le dépôt SEC ouvert et haché.');
const lvlProv = k => prov('bars', lvPtr(k), 'Niveau lu sur la barre certifiée du ' + L[k].d + '.');
const tradeGeo = () => prov('bars', lvPtr('entry'), 'Géométrie recalculée depuis les niveaux certifiés : pourcentages depuis l’entrée, R/R = gain / risque.', ['stop', 'tp1', 'tp2'].map(k => dep('bars', lvPtr(k))));

function sourceFor(p) {
  if (/^meta\.(lastMcpRefresh|levelsVerifiedAt)$/.test(p) || p === 'blastRadius.observationTime') return prov('status', '/captured_at', 'Horodatage exact de la collecte.');
  if (judgments.judgments[p]) return prov('judgments', '/judgments/' + esc(p) + '/value', judgments.judgments[p].reason);
  const r = p.match(/^(.*)\.sourceRefs\.(\d+)\.(date|url|name)$/);
  if (r) { const x = get(a, r[1] + '.sourceRefs.' + r[2]); if (x.url === 'https://mcp.dailytickers.com/mcp') return prov('status', '/captured_at', 'Date de collecte, non date de cours.'); const i = docs.findIndex(d => d.url === x.url); if (i < 0) throw Error('référence inconnue ' + p); return P(i); }
  if (p === 'meta.levelsCloseDate' || p === 'blastRadius.asOf' || p === 'macro.indicators.0.value') return prov('bars', B + '/' + N + '/0', 'Dernière séance complète.');
  if (p === 'header.price' || p === 'macro.indicators.0.signal') return prov('bars', B + '/' + N + '/4', 'Clôture complète de référence.');
  if (p === 'header.changePct') return prov('bars', B + '/' + N + '/4', '100 × (close / close précédent − 1).', [dep('bars', B + '/' + (N - 1) + '/4')]);
  if (p === 'header.metrics.volume') return prov('bars', B + '/' + N + '/5', 'Volume de la séance, en millions.');
  if (p.startsWith('header.metrics.') || p === 'verdict.whyAvoid.0') return marketMath();
  if (p.startsWith('macro.indicators.')) return prov('bars', B, 'Rendements simples cinq et vingt et une séances depuis les clôtures certifiées.');
  if (p === 'verdict.whyBuy.3' || p.startsWith('news.2.')) return P(2);
  if (p.startsWith('news.3.')) return P(1);
  if (/^verdict\.whyAvoid\.[12]$/.test(p) || p.startsWith('news.1.')) return P(1);
  if (p === 'verdict.whyBuy.1') return P(1);
  if (p.startsWith('verdict.whyBuy.') || p.startsWith('news.0.') || p.startsWith('earnings.')) return P(0);
  if (p.startsWith('verdict.controlChecklist.')) return prov('bars', B, 'Continuité et clôture certifiées ; financement et calendrier lus dans les dépôts.');
  if (p === 'verdict.whyAvoid.3' || p.startsWith('technicals.') && !/supports|resistances|setupNote/.test(p)) return prov('tech', T, 'Indicateurs calculés sur les trois cents séances certifiées.', [dep('bars', B)]);
  const sr = p.match(/^technicals\.(supports|resistances)\.(\d+)$/);
  if (sr) return lvlProv({ supports: ['low923', 'low915', 'low916'], resistances: ['stop', 'entry', 'tp1'] }[sr[1]][+sr[2]]);
  if (p === 'technicals.setupNote') return prov('bars', B + '/' + N + '/4', 'Clôture, déclencheur, stop, abandon, supports et résistances lus sur les barres certifiées.', ['entry', 'stop', 'low916', 'low923', 'low915', 'tp1', 'tp2'].map(k => dep('bars', lvPtr(k))));
  if (p.startsWith('business.overview') || p.startsWith('business.segments.')) return prov('primary', '/documents/0', 'Chiffres du communiqué et du 10-Q ; parts de segments = segment / revenus totaux.', [dep('primary', '/documents/1')]);
  if (p.startsWith('business.coverageMatrix.')) return prov('bars', B, 'Matrice de couverture de la collecte.');
  const fm = p.match(/^fundamentals\.rows\.(\d+)\./);
  if (fm) { const i = +fm[1]; if (i <= 1) return P(0); if (i <= 5) return prov('primary', '/documents/1', 'Tableau des flux du 10-Q : flux opérationnel, capex, prépaiements clients ; flux libre = opérationnel − capex.'); if (i <= 10) return gaap(); if (i === 14) return prov('bars', B + '/' + N + '/4', 'P/E forward = close / bénéfice ajusté guidé de 8,10 $.', [dep('primary', '/documents/0')]); return marketMath(); }
  if (p.startsWith('capitalStructure.sharesOutstanding')) return prov('fund', S + '/sharesOutstanding', 'Actions en circulation au 7 septembre, identiques à la page de garde du 10-Q.', [dep('primary', '/documents/1')]);
  if (p.startsWith('capitalStructure.')) return prov('primary', '/documents/1', 'Actions, ATM, dette senior et préférentielles lues dans le 10-Q, le 10-K et le 424B5.', [dep('primary', '/documents/3'), dep('primary', '/documents/4')]);
  if (/^filingsReview\.filings\.\d+\./.test(p)) return P(+p.split('.')[2]);
  if (p.startsWith('filingsReview.')) return P(1);
  if (p.startsWith('shortInterest.')) return prov('fund', S, 'Positions vendeuses et jours de couverture du snapshot statistique ; aucune date de règlement inférée.');
  if (p.startsWith('insiders.')) return prov('insiders', '/results/1/data/0/transactions', 'Formulaires 4 relevés (ventes de marché, code S) et formulaires 144 du même jour ; couverture officielle partielle.', [dep('sec', '')]);
  if (p.startsWith('performance.windowReturns.')) { const m = p.match(/rows\.(\d+)/), tk = m ? a.performance.windowReturns.rows[+m[1]].ticker : 'ORCL'; return tk === 'ORCL' ? prov('bars', B, 'Rendement simple vingt et une séances.') : prov('comparison', C(tk), 'Rendement simple vingt et une séances, sans dividendes.'); }
  if (p === 'blastRadius.window') return prov('comparison', C('MSFT'), 'Première et dernière date communes aux séries alignées.', [dep('bars', B)]);
  const bm = p.match(/^blastRadius\.groups\.(\d+)\.symbols\.(\d+)\./);
  if (bm && /eventRisk$/.test(p)) return prov('earn', '/events', 'Calendrier de résultats des comparables sur quatorze jours ; seules les publications datées y figurent.');
  if (bm) { const row = a.blastRadius.groups[+bm[1]].symbols[+bm[2]]; return prov('comparison', C(row.ticker), 'Rendements log communs ; corrélation de Pearson ; bêta ORCL sur comparable = covariance / variance du comparable ; R² = corrélation au carré ; rendements simples cinq et vingt et une séances.', [dep('bars', B)]); }
  if (p.startsWith('blastRadius.')) return prov('rank', '', 'Contrôle de couverture statistique et relations économiques documentées.');
  if (/^tradeIdea\.(entry|stop|tp1|tp2)$/.test(p)) return lvlProv(p.split('.')[1]);
  if (/^tradeIdea\.(stopPct|tp1Pct|tp2Pct|rr)$/.test(p)) return tradeGeo();
  if (p === 'tradeIdea.catalysts.2') return prov('earn', '/events', 'Date de publication de Micron, corroborée par deux calendriers.');
  if (p.startsWith('tradeIdea.')) return prov('bars', lvPtr('entry'), 'Niveaux lus sur les barres certifiées ; plafond = (TP1 + 1,3 × stop) / 2,3 ; quart d’ATR sur l’ATR quotidien ; séance du 11 septembre pour le setup précédent.', [dep('bars', lvPtr('stop')), dep('bars', lvPtr('tp1')), dep('bars', lvPtr('low916')), dep('bars', lvPtr('open911')), dep('bars', lvPtr('close911')), dep('tech', T)]);
  if (p.startsWith('risks.')) return P(1);
  if (p.startsWith('verdict.')) return prov('primary', '/documents/0', 'Dates de publication du dépôt et de la clôture de référence.', [dep('bars', B + '/' + N + '/0')]);
  if (p.startsWith('globalScore.') || p.startsWith('meta.') || p.startsWith('business.') || p === 'disclaimer') return P(0);
  throw Error('provenance manquante ' + p);
}
const claims = {}, strings = {}, methods = {};
(function scan(v, p = '') { if (typeof v === 'number' || (typeof v === 'string' && /\d/.test(v))) { claims[p] = sourceFor(p); methods[p] = claims[p].method; if (typeof v === 'string') strings[p] = v; } else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) scan(x, p ? p + '.' + k : k); })(a);
const multiple = ev / G$.ebitda * 0.7, enterprise_value = multiple * G$.ebitda, equity_value = enterprise_value - G$.debt + G$.cash, price = equity_value / s.sharesOutstanding;
const generator = run + '/build-orcl.cjs';
const calc = { kind: 'deterministic_analysis_calculation_v1', ticker: 'ORCL', reference_close: REF, analysis_sha256: sha(bytes(OUT_JSON)), generator_path: generator, generator_sha256: sha(bytes(generator)), inputs, score_components: score,
  valuation_scenario: { basis: 'GAAP douze mois au 2026-08-31 ; compression de 30 % = hypothèse éditoriale', multiple, ebitda: G$.ebitda, debt: G$.debt, cash: G$.cash, shares: s.sharesOutstanding, close, enterprise_value, equity_value, price, downside_pct: (price / close - 1) * 100 },
  values: a, string_numeric_claims: strings, claim_provenance: claims, methods,
  gaap_inputs_millions: { K, BAL, CF },
  limitations: ['Fenêtre de corrélation courte, depuis le 27 juillet.', 'Une foncière écartée pour barre invalide.', 'Options inexploitables, marché fermé.'] };
write(rev + '/numeric-evidence.json', calc);
const calcHash = sha(bytes(rev + '/numeric-evidence.json'));
write(OUT_EVIDENCE, { ticker: 'ORCL', reference_close: REF, analysis_path: OUT_JSON, analysis_sha256: sha(bytes(OUT_JSON)),
  claims: Object.keys(claims).map(p => ({ path: p, value: get(a, p), as_of: REF, source_artifact: rev + '/numeric-evidence.json', source_sha256: calcHash, source_pointer: typeof get(a, p) === 'number' ? '/values/' + p.split('.').map(esc).join('/') : '/string_numeric_claims/' + esc(p) })) });

// ---------------------------------------------------------------- rendu local
const { render } = require(path.join(root, 'tools/render-analysis.js'));
fs.writeFileSync(path.join(root, rev + '/index.html'), render(a));
console.log(`[ORCL] claims=${Object.keys(claims).length} score=${scoreValue} close=${close} entry=${entry} stop=${stop} tp1=${tp1} tp2=${tp2} rr1=${rr1.toFixed(2)} ev/ebitda=${(ev / G$.ebitda).toFixed(1)} cap=${cap} capRr=${capRr.toFixed(2)} fcfEx=${G$.fcfExPrepay/1e9} valuation=${price.toFixed(2)}`);
