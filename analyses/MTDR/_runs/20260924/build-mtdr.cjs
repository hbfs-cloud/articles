'use strict';
/* MTDR — réanalyse du 24 septembre 2026 (clôture de référence 2026-09-23).
 *
 * Un seul passage produit : la fiche data/analyses-data/MTDR.json, le manifeste SEC primaire, les
 * jugements éditoriaux, l'artefact de calcul déterministe et le sidecar de preuves. Chaque nombre
 * et chaque chaîne portant un chiffre est construit par M(...) avec sa provenance ; un chiffre
 * non enveloppé fait échouer la construction. Aucun niveau n'est saisi sans lecture de sa barre.
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.resolve(__dirname, '../../../..');
const REL = p => path.relative(root, path.resolve(root, p));
const R = 'analyses/MTDR/_runs/20260924', D = R + '/_data', P = 'analyses/MTDR/_primary';
const REF = '2026-09-23';
const LABEL = /\b(?:10-Q|10-K|8-K|99\.1|13F|T[1-4]|formulaire 4|20(?:25|26|27|34))\b/g;
const bytes = p => fs.readFileSync(path.join(root, p));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const read = p => JSON.parse(bytes(p));
const write = (p, v) => fs.writeFileSync(path.join(root, p), JSON.stringify(v, null, 2) + '\n');
const esc = v => String(v).replace(/~/g, '~0').replace(/\//g, '~1');
const ptr = (o, p) => p === '' ? o : p.slice(1).split('/').reduce((n, k) => n == null ? undefined : n[k.replace(/~1/g, '/').replace(/~0/g, '~')], o);
const findPath = (o, pred, p = '') => {
  if (o && typeof o === 'object') {
    if (pred(o)) return p;
    for (const [k, v] of Object.entries(o)) { const r = findPath(v, pred, p + '/' + esc(k)); if (r !== undefined) return r; }
  }
};
const fr = (n, d = 2) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n).replace(/ /g, ' ');
const pct = (n, d = 2) => `${n >= 0 ? '+' : '−'}${fr(Math.abs(n), d)} %`;
const md = n => `${fr(n / 1e9, 2)} Md$`;
const mm = n => `${fr(n / 1e6, 1)} M$`;

// ---------------------------------------------------------------- entrées
const inputs = [];
function input(name, p, kind) {
  const e = { name, path: REL(p), sha256: sha(bytes(p)) }; if (kind) e.kind = kind; inputs.push(e); return e;
}
const raw = {};
for (const [n, f] of [['bars', 'bars'], ['fund', 'fundamentals'], ['insiders', 'insiders'], ['comparison', 'comparison_bars'], ['client', 'comparison_client_bars'], ['context', 'comparison_context'],
  ['earnings_peers', 'comparison_earnings'], ['regime', 'market_regime'], ['seasonality', 'symbol_seasonality'],
  ['status', 'status'], ['rank', 'rank_beta']]) {
  input(n, `${D}/${f}.json`); raw[n] = read(`${D}/${f}.json`);
}
const ARCH = `${R}/archive-analysis-20260913.json`;
input('archive', ARCH, 'archived_analysis'); raw.archive = read(ARCH);

// ---------------------------------------------------------------- manifeste SEC primaire
const SUB = read(`${P}/edgar-submissions.json`).filings.recent;
const inventory = SUB.form.map((f, i) => ({ form: f, date: SUB.filingDate[i], accession: SUB.accessionNumber[i] })).filter(x => x.date >= '2026-01-01' && x.date <= '2026-09-23');
const EDGAR = 'https://www.sec.gov/Archives/edgar/data/1520006/';
const docs = [
  ['10-Q', '2026-08-07', '0001520006-26-000041', 'mtdr-20260630.htm', '10q-q2-2026.htm', 'Comptes du T2 2026 : dette à long terme 4,216 Md$ au 30 juin, ligne de crédit portée à 1,18 Md$ au 5 août, acquisitions Paloma et Ridge Runner en événements postérieurs, financées par trésorerie et ligne de crédit.'],
  ['8-K / Exhibit 99.1', '2026-08-05', '0001520006-26-000036', 'a20260630mtdr8ker-ex991.htm', '8k-20260805-ex991.htm', 'Résultats du T2 2026 et relèvement de la guidance annuelle : production pétrolière record, BPA ajusté 2,61 $, flux de trésorerie disponible ajusté 303,2 M$, objectif de levier 1,0x fin 2027.'],
  ['8-K', '2026-07-24', '0001104659-26-086469', 'tm2621144d1_8k.htm', '8k-20260724.htm', 'Accord d’achat de Paloma Permian pour 1,275 Md$ en numéraire et accord Ridge Runner (prix non publié), clôtures attendues au T4 2026.'],
  ['8-K / Exhibit 99.1', '2026-07-24', '0001104659-26-086469', 'tm2621144d1_ex99-1.htm', '8k-20260724-tm2621144d1_ex99-1.htm', 'Communiqué des acquisitions : 16 235 acres nettes et environ 11 100 bep/j pour Paloma ; puits d’exploration Woodford à plus de 2 200 bep/j.'],
  ['8-K', '2026-03-05', '0001104659-26-024110', 'tm268001d1_8k.htm', '8k-20260305.htm', 'Émission de 750 M$ d’obligations senior à 6,000 % échéance 2034 ; produit net d’environ 737,2 M$.'],
  ['8-K', '2026-06-16', '0001520006-26-000029', 'mtdr-20260610.htm', '8k-20260610.htm', 'Ligne de crédit : base d’emprunt confirmée à 3,25 Md$, engagements élus portés de 2,25 à 2,75 Md$.'],
  ['8-K', '2026-09-10', '0001520006-26-000043', 'mtdr-20260909.htm', '8k-20260909.htm', 'Départ en retraite du co-président chargé des acquisitions, devenu conseiller spécial contre 450 000 $ par an ; fonctions reprises en interne.'],
  ['10-K', '2026-02-26', '0001520006-26-000002', 'mtdr-20251231.htm', '10k-2025.htm', 'Trois acheteurs représentent 72 % des revenus pétrole, gaz et LGN 2025 : Plains Marketing 49 %, Exxon Mobil 13 %, Enterprise Products 10 %.'],
].map(([form, date, accession, file, local, finding]) => {
  const p = `${P}/${local}`;
  return { date, form, accession, url: `${EDGAR}${accession.replace(/-/g, '')}/${file}`, finding, path: p, sha256: sha(bytes(p)) };
});
const needle = (id, docIndex, needles) => {
  const d = docs[docIndex], text = bytes(d.path).toString('utf8');
  for (const n of needles) if (!text.includes(n)) throw Error(`needle absent ${id}: ${n}`);
  return [id, { source_path: d.path, source_sha256: d.sha256, source_needles: needles }];
};
const semantic = Object.fromEntries([
  needle('ltd_20260630', 0, ['4,216,410', '3,402,102']),
  needle('revolver_20260805', 0, ['1.18 billion', '243.0']),
  needle('paloma_price', 0, ['1.275</ix:nonFraction>', 'fourth quarter of 2026']),
  needle('cardinal_term_loan', 0, ['650.0</ix:nonFraction>&#160;million term loan', '752.0', 'July 30, 2027']),
  needle('nci_20260630', 0, ['322,275', '338,511']),
  needle('notes_total_20260630', 0, ['2,366,410']),
  needle('san_mateo_0805', 0, ['936.0</ix:nonFraction>&#160;million in borrowings outstanding', 'non-recourse with respect to Matador']),
  needle('segments_q2', 0, ['1,083,333', '146,328', '101,735', '541,414', '71,262']),
  needle('reserves', 1, ['703 million BOE', '667 million']),
  needle('q2_results', 1, ['126,106', '303.2', '937.1', '781.0', '2.61']),
  needle('fy_guidance', 1, ['127,500 to 129,000', '$900 million', '1.0x target leverage ratio', 'equity capital markets']),
  needle('hugh_brinson', 1, ['Hugh Brinson', '$90 million']),
  needle('waha', 1, ['negative Waha prices']),
  needle('notes_2034', 4, ['6.000% Senior Notes due 2034', '737.2 million']),
  needle('credit_2750', 5, ['$3.25 billion', '$2.75 billion']),
  needle('singleton', 6, ['Van H. Singleton', '$450,000', 'Bryan A. Erman', 'Jonathan J. Filbert']),
  needle('purchasers', 7, ['Plains Marketing, L.P.', 'three significant purchasers']),
]);
const manifest = {
  kind: 'primary_sec_manifest_v1', ticker: 'MTDR', as_of: '2026-09-24',
  inventory_count: inventory.length, inventory_screened_count: inventory.length,
  opened_count: docs.length, reviewed_count: docs.length, decision_relevant_count: docs.length, local_primary_count: docs.length,
  review_scope: 'Dépôts EDGAR de Matador du 1er janvier au 23 septembre 2026, listés depuis l’index officiel des soumissions ; les documents de financement, d’acquisition, de résultats et le 10-K ont été ouverts et hachés.',
  inventory, documents: docs, semantic_findings: semantic,
};
write(`${R}/primary-manifest.json`, manifest);
input('primary', `${R}/primary-manifest.json`);
const PD = i => `/documents/${i}`, PS = id => `/semantic_findings/${id}`;

// ---------------------------------------------------------------- jugements éditoriaux
const score_components = { resultats_et_execution: 17, valorisation_relative: 13, bilan_et_financement: 6, structure_technique: 6, flux_et_positionnement: 7, catalyseurs_dates: 9 };
const score = Object.values(score_components).reduce((a, b) => a + b, 0);
const judgments = {
  ticker: 'MTDR', score_components,
  judgments: {
    'verdict.score': { value: score, reason: 'Somme des six composantes éditoriales : exécution et résultats solides, valorisation basse face aux pairs, mais bilan en expansion et structure de prix dégradée.' },
    'risks.riskScore': { value: 7, reason: 'Risque élevé : levier en hausse avant deux acquisitions non closes, forte sensibilité au pétrole et titre sous ses moyennes courtes.' },
    'meta.version': { value: 3, reason: 'Réécriture complète au contrat v3 (blast radius structuré, preuves par valeur), après la version du 13 septembre stoppée le 16.' },
    'meta.date': { value: '2026-09-24', reason: 'Date de publication éditoriale de la réanalyse, distincte de la clôture de référence du 23 septembre.' },
    'meta.dateDisplay': { value: '24 septembre 2026', reason: 'Affichage français de la date éditoriale de la réanalyse.' },
  },
};
[0, 1, 2, 3, 4, 5].forEach((g, i) => { judgments.judgments[`blastRadius.groups.${i}.order`] = { value: [1, 1, 2, 2, 2, 1][i], reason: 'Ordre de transmission : un pour les prix et les pairs exposés au même baril, deux pour les maillons qui réagissent via volumes ou marges.' }; });
write(`${R}/editorial-judgments.json`, judgments);
input('judgments', `${R}/editorial-judgments.json`, 'editorial_judgment');

// ---------------------------------------------------------------- marqueurs de provenance
const IN = n => inputs.find(x => x.name === n);
const dep = (n, p) => ({ input_path: IN(n).path, input_sha256: IN(n).sha256, source_pointer: p });
function M(value, n, p, method, extra = []) {
  if (ptr(raw[n] ?? read(IN(n).path), p) === undefined) throw Error(`pointeur non résolu ${n}${p}`);
  return { __m: true, value, prov: { ...dep(n, p), input_name: n, method, ...(extra.length ? { additional_inputs: extra.map(([a, b]) => dep(a, b)) } : {}) } };
}
raw.primary = manifest; raw.judgments = judgments;
const J = key => M(judgments.judgments[key].value, 'judgments', `/judgments/${esc(key)}/value`, judgments.judgments[key].reason);

// ---------------------------------------------------------------- données de marché
const B = '/results/0/data/0/bars';
const bars = raw.bars.results[0].data[0].bars;
const L = bars.length - 1;
if (bars[L][0] !== REF) throw Error('dernière barre ≠ clôture de référence');
const bi = d => { const i = bars.findIndex(x => x[0] === d); if (i < 0) throw Error('séance absente ' + d); return i; };
const close = bars[L][4], prev = bars[L - 1][4];
const ret = n => (close / bars[L - n][4] - 1) * 100;
const ytdIdx = bi('2025-12-31'), yearIdx = bi('2025-09-23');
const hi252 = bars.slice(-252).reduce((a, x) => x[2] > a[2] ? x : a), lo252 = bars.slice(-252).reduce((a, x) => x[3] < a[3] ? x : a);
const hiIdx = bars.indexOf(hi252), loIdx = bars.indexOf(lo252);
const h60 = bars.slice(-60).reduce((a, x) => x[2] > a[2] ? x : a), l60 = bars.slice(-60).reduce((a, x) => x[3] < a[3] ? x : a);
const h60i = bars.indexOf(h60), l60i = bars.indexOf(l60);
const i0915 = bi('2026-09-15'), i0916 = bi('2026-09-16'), i0917 = bi('2026-09-17'), i0921 = bi('2026-09-21');
const barP = (i, c) => `${B}/${i}/${c}`;

const FR = raw.fund; const Fp = findPath(FR, o => o.type === 'instrument_comprehensive_financial'), Sp = findPath(FR, o => o.type === 'instrument_comprehensive_stats');
const fin = ptr(FR, Fp), st = ptr(FR, Sp);
const Hp = findPath(FR, o => o.type === 'instrument_comprehensive_holders'), holders = ptr(FR, Hp);
const Cp = findPath(FR, o => o.type === 'instrument_calendar'), cal = ptr(FR, Cp);
const ATp = findPath(FR, o => o.type === 'instrument_analyst_trend'), at = ptr(FR, ATp);
const EQp = findPath(FR, o => Array.isArray(o) && o[0] && o[0].type === 'instrument_comprehensive_earnings_quarterly');
const eqs = ptr(FR, EQp);
const ITp = findPath(raw.insiders, o => o.type === 'instrument_insider_transactions'), itx = ptr(raw.insiders, ITp);
const IHp = findPath(raw.insiders, o => o.type === 'instrument_institutional_holdings'), ih = ptr(raw.insiders, IHp);
const REGp = findPath(raw.regime, o => typeof o.current_state === 'string' && 'current_state_confidence' in o), reg = ptr(raw.regime, REGp);
const SEAp = findPath(raw.seasonality, o => Array.isArray(o.months)), seas = ptr(raw.seasonality, SEAp);
const shares = st.sharesOutstanding, mcap = close * shares;
const statusAt = raw.status.captured_at;
// Indicateurs recalculés sur les barres certifiées : EMA amorcée par la moyenne simple des n premières
// clôtures ; MACD = EMA12 − EMA26, signal = EMA9 du MACD (même amorçage) ; RSI et ATR lissés de Wilder sur 14.
const closes = bars.map(x => x[4]);
const emaS = (v, n) => { const out = Array(v.length).fill(null); let e = v.slice(0, n).reduce((x, y) => x + y, 0) / n; out[n - 1] = e; const k = 2 / (n + 1); for (let i = n; i < v.length; i++) { e = v[i] * k + e * (1 - k); out[i] = e; } return out; };
const e12 = emaS(closes, 12), e26 = emaS(closes, 26), macdS = closes.map((_, i) => i >= 25 ? e12[i] - e26[i] : null).filter(x => x !== null), sigS = emaS(macdS, 9);
const wilder = (v, n) => { let a = v.slice(0, n).reduce((x, y) => x + y, 0) / n; for (let i = n; i < v.length; i++) a = (a * (n - 1) + v[i]) / n; return a; };
const gains = [], losses = [], trs = [];
for (let i = 1; i < bars.length; i++) { const d = closes[i] - closes[i - 1]; gains.push(Math.max(d, 0)); losses.push(Math.max(-d, 0)); trs.push(Math.max(bars[i][2] - bars[i][3], Math.abs(bars[i][2] - closes[i - 1]), Math.abs(bars[i][3] - closes[i - 1]))); }
const tech = { ema20: emaS(closes, 20).at(-1), ema50: emaS(closes, 50).at(-1), ema200: emaS(closes, 200).at(-1), macd: macdS.at(-1), signal: sigS.at(-1), rsi: 100 - 100 / (1 + wilder(gains, 14) / wilder(losses, 14)), atr: wilder(trs, 14) };
const TM = 'Recalcul déterministe sur les trois cents barres certifiées : EMA amorcée par la moyenne simple ; MACD 12/26, signal 9 ; RSI et ATR de Wilder sur quatorze séances.';
const TK = k => M(tech[k], 'bars', B, TM);
const vol20 = bars.slice(-20).reduce((x, b) => x + b[5], 0) / 20, usd20 = bars.slice(-20).reduce((x, b) => x + b[5] * b[4], 0) / 20;


// comparables
const cmpRows = raw.comparison.data.items[0].results[0].data, cliRows = raw.client.data.items[0].results[0].data;
const CMP = t => { let i = cmpRows.findIndex(x => x.symbol === t); if (i >= 0) return { n: 'comparison', p: `/data/items/0/results/0/data/${i}/bars`, bars: cmpRows[i].bars }; i = cliRows.findIndex(x => x.symbol === t); if (i >= 0) return { n: 'client', p: `/data/items/0/results/0/data/${i}/bars`, bars: cliRows[i].bars }; throw Error('comparable absent ' + t); };
const M2 = new Map(bars.map(x => [x[0], x[4]]));
function regress(t) {
  const c = CMP(t), m = new Map(c.bars.map(x => [x[0], x[4]])), ds = c.bars.map(x => x[0]).filter(d => M2.has(d));
  const a = [], b = [];
  for (let i = 1; i < ds.length; i++) { a.push(Math.log(M2.get(ds[i]) / M2.get(ds[i - 1]))); b.push(Math.log(m.get(ds[i]) / m.get(ds[i - 1]))); }
  const mean = v => v.reduce((s, x) => s + x, 0) / v.length, ma = mean(a), mb = mean(b);
  let cov = 0, va = 0, vb = 0; for (let i = 0; i < a.length; i++) { cov += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; }
  const cl = c.bars.map(x => x[4]), n = cl.length - 1;
  if (c.bars[n][0] !== REF) throw Error(t + ' ne finit pas au ' + REF);
  const corr = cov / Math.sqrt(va * vb);
  return { ...c, correlation: corr, beta: cov / vb, r2: corr * corr, observations: a.length, r5: (cl[n] / cl[n - 5] - 1) * 100, r21: (cl[n] / cl[n - 21] - 1) * 100, r1916: (m.get('2026-09-16') / m.get('2026-09-15') - 1) * 100, first: ds[0] };
}
const REGM = 'Rendements logarithmiques quotidiens sur les séances communes ; corrélation de Pearson ; bêta de MTDR sur le comparable = covariance / variance du comparable ; R² = corrélation au carré ; rendements simples sur cinq et vingt et une séances.';
const reg_ = {}; const RM = (t, field) => { const r = reg_[t] || (reg_[t] = regress(t)); return M(r[field], r.n, r.p, REGM, [['bars', B]]); };
const R_ = t => reg_[t] || (reg_[t] = regress(t));
const sinceP = (t, d0, d1 = REF) => { const c = CMP(t), m = new Map(c.bars.map(x => [x[0], x[4]])); return (m.get(d1) / m.get(d0) - 1) * 100; };
const sinceM = (d0, d1 = REF) => (bars[bi(d1)][4] / bars[bi(d0)][4] - 1) * 100;
const DIRECT = ['PR', 'FANG', 'DVN', 'OXY', 'SM', 'CHRD'];
const i0807 = bi('2026-08-07');
const PEERS_SINCE = DIRECT.map(t => sinceP(t, '2026-09-15')).sort((x, y) => x - y);
const peerMedianSince = (PEERS_SINCE[2] + PEERS_SINCE[3]) / 2;
const shareXop = sinceP('XOP', '2026-09-15') / sinceM('2026-09-15') * 100, sharePeers = peerMedianSince / sinceM('2026-09-15') * 100;

// valorisation : médiane EV/EBITDA des pairs directs, lue dans le contexte des comparables
const ctxRes = raw.context.data.items[0].results, ctxStatsI = ctxRes.findIndex(r => r.data_type === 'stats');
const ctxStats = ctxRes[ctxStatsI].data;
const peerMult = DIRECT.map(t => { const i = ctxStats.findIndex(x => x.symbol === t); return { t, i, v: ctxStats[i].enterpriseToEbitda }; });
const sorted = peerMult.map(x => x.v).sort((a, b) => a - b), median = (sorted[2] + sorted[3]) / 2;
const valuation_scenario = (() => {
  const multiple = median, ebitda = fin.ebitda, debt = fin.totalDebt, cashV = fin.totalCash;
  const enterprise_value = multiple * ebitda, equity_value = enterprise_value - debt + cashV, price = equity_value / shares;
  return { multiple, ebitda, debt, cash: cashV, shares, close, enterprise_value, equity_value, price, downside_pct: (price / close - 1) * 100, basis: { peers: DIRECT, input_path: IN('context').path, input_sha256: IN('context').sha256 } };
})();
const NCI = 322275000; // intérêts minoritaires de San Mateo au 30 juin (10-Q)
const scenarioPriceNci = valuation_scenario.price - NCI / shares;
const palomaPerShare = 1.275e9 / shares;
const proFormaPrice = scenarioPriceNci - palomaPerShare;
// Dette par périmètre : Matador (obligations + ligne de crédit au 5 août + Paloma) et San Mateo, sans recours sur Matador.
const recourseDebt = 2366410000 + 1.18e9 + 1.275e9, sanMateoDebt = 936.0e6 + 650.0e6, proFormaDebt = recourseDebt + sanMateoDebt;

// valuation-multi et board qualité : sorties structurées, jamais réécrites
const vm = require(path.join(root, 'tools/lib/valuation-multi')).evaluateValuation('MTDR', { financials: fin, stats: st, price: close });
const vq = require(path.join(root, 'tools/lib/value-quality-board')).evaluateBoard('MTDR', { financials: fin, stats: st, price: close });

// ---------------------------------------------------------------- niveaux du scénario conditionnel
const entry = 58.10, stop = 53.85, tp1 = 63.80, tp2 = 66.80;
// entrée : une clôture au-dessus du plus haut du 17/09 (58,09) ; stop : sous le plus bas du 21/09 (53,88) ;
// objectifs : sous le plus haut sur 60 séances (63,82) puis sous le plus haut sur 52 semaines (66,84).
if (!(bars[i0917][2] < entry && bars[i0921][3] > stop && h60[2] > tp1 && hi252[2] > tp2)) throw Error('niveaux incohérents avec les barres');
const riskU = entry - stop, rr1 = (tp1 - entry) / riskU, rr2 = (tp2 - entry) / riskU;
const ceiling = (tp1 + 1.2 * stop) / 2.2; // prix au-delà duquel le R/R vers TP1 passe sous 1,2
const sizeShares = Math.floor(100 / riskU); // exemple : 1 % de risque sur un compte de 10 000 $
const lvl = (v, i, c, why) => M(v, 'bars', barP(i, c), why);

// ---------------------------------------------------------------- sources citées
const EVID = 'https://articles.dailytickers.com/data/analyses-evidence/MTDR.json';
const srcMarket = name => ({ name, url: EVID, date: M(REF, 'bars', barP(L, 0), 'Date de la dernière séance complète des barres.') });
const srcDoc = (i, name) => ({ name, url: docs[i].url, date: M(docs[i].date, 'primary', PD(i), 'Date de dépôt du document EDGAR ouvert et haché.') });

// ---------------------------------------------------------------- fiche
const r5 = t => M(R_(t).r5, R_(t).n, R_(t).p, 'Rendement simple sur cinq séances.');
const a = {
  meta: {
    lang: 'fr', dir: 'ltr', level: 'intermediate', assetType: 'stock', tags: ['energy', 'us', 'earnings'],
    grade: 'C+', date: J('meta.date'), dateDisplay: J('meta.dateDisplay'), version: J('meta.version'), status: 'watch',
    lastMcpRefresh: M(statusAt, 'status', '/captured_at', 'Horodatage de la collecte certifiée.'),
    levelsCloseDate: M(REF, 'bars', barP(L, 0), 'Dernière séance complète.'),
    levelsVerifiedAt: M(statusAt, 'status', '/captured_at', 'Horodatage de la collecte certifiée.'),
    description: M(`Matador (MTDR) a perdu ${fr(Math.abs(sinceM('2026-09-15')), 1)} % depuis le 15 septembre, contre ${fr(Math.abs(sinceP('XOP', '2026-09-15')), 1)} % pour le fonds des producteurs XOP. Le secteur a reculé, le titre a amplifié la baisse. Trimestre solide, dette en hausse avant deux acquisitions : surveiller, sans entrer au cours actuel.`, 'bars', barP(i0915, 4), 'Rendements simples du 15 au 23 septembre sur la même fenêtre pour MTDR et XOP.', [['bars', barP(L, 4)], ['comparison', CMP('XOP').p]]),
    ogDescription: M(`MTDR : choc sectoriel amplifié, dette en hausse, surveillance au ${fr(close)} $ du 23 septembre 2026.`, 'bars', barP(L, 4), 'Clôture de référence.'),
    statusHistory: [
      { at: M(raw.archive.meta.statusHistory[0].at, 'archive', '/meta/statusHistory/0/at', 'Historique conservé.'), from: 'watch', to: 'stopped', note: M(raw.archive.meta.statusHistory[0].note, 'archive', '/meta/statusHistory/0/note', 'Historique conservé.'), close: M(raw.archive.meta.statusHistory[0].close, 'archive', '/meta/statusHistory/0/close', 'Historique conservé.') },
      { at: M(statusAt, 'status', '/captured_at', 'Horodatage de la réanalyse.'), from: 'stopped', to: 'watch', note: M(`réanalyse sur la clôture du 23 septembre : pas d’entrée au cours, nouveau scénario conditionnel au-dessus de ${fr(bars[i0917][2])} $`, 'bars', barP(i0917, 2), 'Plus haut du 17 septembre, seuil du déclencheur.'), close: M(close, 'bars', barP(L, 4), 'Clôture de référence.') },
    ],
    lastEvent: { type: 'stop', date: M(raw.archive.meta.lastEvent.date, 'archive', '/meta/lastEvent/date', 'Dernier événement de cycle de vie conservé.'), close: M(raw.archive.meta.lastEvent.close, 'archive', '/meta/lastEvent/close', 'Dernier événement de cycle de vie conservé.') },
  },
  header: {
    ticker: 'MTDR', name: 'Matador Resources Company', exchange: 'NYSE', sector: 'Energy',
    price: M(close, 'bars', barP(L, 4), 'Clôture complète du 23 septembre.'),
    changePct: M((close / prev - 1) * 100, 'bars', barP(L, 4), '100 × (clôture / clôture précédente − 1).', [['bars', barP(L - 1, 4)]]),
    badges: [{ text: 'Surveillance — pas d’entrée au cours actuel', color: 'amber' }, { text: 'Énergie', color: 'blue' }],
    metrics: {
      marketCap: M(`${md(mcap)} (clôture × actions)`, 'fund', Sp + '/sharesOutstanding', 'Capitalisation = clôture × actions en circulation du fournisseur.', [['bars', barP(L, 4)]]),
      volume: M(`${fr(bars[L][5] / 1e6, 2)} M`, 'bars', barP(L, 5), 'Volume de la séance, en millions d’actions.'),
      fwdPE: 'N/D',
      beta: M(st.beta, 'fund', Sp + '/beta', 'Bêta du fournisseur.'),
      range52w: M(`${fr(lo252[3])} – ${fr(hi252[2])} $`, 'bars', barP(loIdx, 3), 'Plus bas et plus haut des 252 dernières séances.', [['bars', barP(hiIdx, 2)]]),
      shortInterest: M(`${fr(st.shortPercentOfFloat * 100, 2)} %`, 'fund', Sp + '/shortPercentOfFloat', 'Part du flottant vendue à découvert selon le fournisseur.'),
      analystTarget: M(`${fr(at.price_target.to)} $ (consensus)`, 'fund', ATp + '/price_target/to', 'Objectif moyen du consensus, non daté par courtier.'),
      evEbitda: M(`${fr(st.enterpriseToEbitda)}x (fournisseur, période non datée)`, 'fund', Sp + '/enterpriseToEbitda', 'Multiple du fournisseur.'),
    },
    halal: false, halalStatus: 'unknown',
  },
};

a.verdict = {
  score: J('verdict.score'), conviction: 'Low', bias: 'Neutral',
  confidence: M(`Faible : ${inventory.length} dépôts de l’année passés en revue, mais le prix de Ridge Runner n’est pas publié et les comptes du fournisseur ne sont pas datés.`, 'primary', '/inventory_count', 'Nombre de dépôts EDGAR 2026 inventoriés.'),
  summary: M(`Matador sort d’un trimestre solide et l’action vient de décrocher plus que son secteur. Au T2, la production pétrolière a atteint un record de 126 106 barils par jour et le BPA ajusté 2,61 $ contre 2,09 $ attendus. Le 10-Q du 7 août montrait déjà la dette à long terme passée de 3,40 à 4,22 Md$ : le titre a pourtant gagné ${fr(sinceM('2026-08-07', '2026-09-15'), 1)} % jusqu’au 15 septembre. Depuis, tout le secteur a reculé : ${fr(sinceP('USO', '2026-09-15'), 1)} % pour le pétrole coté, ${fr(sinceP('XOP', '2026-09-15'), 1)} % pour XOP, ${fr(sinceP('PR', '2026-09-15'), 1)} % pour PR. MTDR a perdu ${fr(Math.abs(sinceM('2026-09-15')), 1)} %, environ six points de plus que ses pairs du bassin. Aucun dépôt n’explique cet écart ; un bilan qui gonfle avant Paloma, 1,275 Md$ en numéraire au T4, amplifie plausiblement la sensibilité au baril. C’est une hypothèse, pas une cause établie. Pas d’entrée au cours actuel ; un scénario seulement au-dessus de ${fr(bars[i0917][2])} $.`, 'primary', PS('q2_results'), 'Faits primaires T2 et dette ; rendements simples sur fenêtres identiques pour MTDR, USO, XOP et PR.', [['primary', PS('ltd_20260630')], ['primary', PS('paloma_price')], ['bars', barP(i0807, 4)], ['bars', barP(i0915, 4)], ['comparison', CMP('USO').p], ['comparison', CMP('XOP').p], ['comparison', CMP('PR').p]]),
  whyBuy: [
    M(`BPA ajusté de 2,61 $ au T2 contre 2,09 $ attendus : quatrième dépassement consécutif, avec une surprise moyenne de ${fr(ptr(FR, findPath(FR, o => 'avg_surprise_pct' in o)).avg_surprise_pct, 1)} %.`, 'fund', findPath(FR, o => 'avg_surprise_pct' in o), 'Historique des surprises du fournisseur (quatre trimestres).', [['primary', PS('q2_results')]]),
    M('Réserves prouvées portées à un record de 703 millions de barils équivalent pétrole au 30 juin, contre 667 millions fin 2025, avant Paloma.', 'primary', PS('reserves'), 'Réserves publiées dans le communiqué T2.'),
    M('Le directeur financier a acheté 2 500 actions à 56,64 $ le 27 août, soit environ 141 600 $ : un signal modeste, mais un achat en numéraire à un cours supérieur au cours actuel.', 'insiders', ITp, 'Transaction de formulaire 4 déclarée.'),
    M('Guidance pétrole relevée à 127 500–129 000 barils par jour, et le gazoduc Hugh Brinson doit apporter environ 90 M$ de revenus annuels par tranche de 0,50 $/MMBtu gagnée sur le prix du gaz.', 'primary', PS('fy_guidance'), 'Guidance et sensibilité publiées par l’émetteur.', [['primary', PS('hugh_brinson')]]),
  ],
  whyAvoid: [
    M(`Dette pro forma d’au moins ${md(proFormaDebt)} après Paloma : ${md(recourseDebt)} chez Matador (obligations, ligne de crédit, prix de Paloma) et ${md(sanMateoDebt)} chez San Mateo, sans recours sur Matador, dont 650,0 M$ à rembourser le 30 juillet 2027. Ridge Runner non compris, faute de prix publié.`, 'primary', PS('notes_total_20260630'), 'Somme de montants publiés : obligations au 30 juin, ligne de crédit au 5 août, prix de Paloma ; ligne San Mateo au 5 août et prêt à terme Cardinal.', [['primary', PS('revolver_20260805')], ['primary', PS('paloma_price')], ['primary', PS('san_mateo_0805')], ['primary', PS('cardinal_term_loan')]]),
    M(`Depuis le 15 septembre, MTDR recule de ${fr(Math.abs(sinceM('2026-09-15')), 2)} % contre ${fr(Math.abs(sinceP('PR', '2026-09-15')), 2)} % pour PR et ${fr(Math.abs(sinceP('FANG', '2026-09-15')), 2)} % pour FANG : le titre amplifie les baisses de son secteur.`, 'bars', barP(i0915, 4), 'Rendements simples du 15 au 23 septembre, même fenêtre.', [['bars', barP(L, 4)], ['comparison', CMP('PR').p], ['comparison', CMP('FANG').p]]),
    M(`Le titre clôture sous ses moyennes exponentielles à vingt (${fr(tech.ema20)} $) et cinquante séances (${fr(tech.ema50)} $) ; aucun plus bas ascendant n’est encore formé.`, 'bars', B, TM),
    M('Trois acheteurs font 72 % des revenus d’hydrocarbures 2025, dont Plains Marketing pour 49 % : une concentration commerciale forte.', 'primary', PS('purchasers'), 'Note 2 du 10-K 2025.'),
  ],
};

a.business = {
  overview: M(`<p>Matador produit du pétrole et du gaz dans le bassin Delaware, à cheval sur le Nouveau-Mexique et l’ouest du Texas, et détient 51 % de San Mateo, son réseau de collecte et de traitement du gaz. Au T2 2026, la société a produit 126 106 barils de pétrole par jour, un record, et a dégagé 937,1 M$ de flux opérationnel. La part du pétrole dans la production fait de chaque dollar sur le baril un levier direct sur le cash.</p><p>Le trait marquant de 2026 est l’accélération des achats. Vente fédérale de concessions en mai, Cardinal Midstream pour 752,0 M$ fin juillet côté San Mateo, puis deux accords signés le 22 juillet : Paloma pour 1,275 Md$ en numéraire et Ridge Runner, dont le prix n’est pas publié. Les deux doivent se conclure au T4. La direction affirme ne pas avoir besoin d’émettre d’actions et vise un levier de 1,0x fin 2027, financé par le flux de trésorerie disponible.</p><p>Ce pari vaut ce que vaut le baril pendant les dix-huit prochains mois. La dette à long terme est passée de 3,402 à 4,216 Md$ entre décembre et juin, avant ces acquisitions ; une partie, chez San Mateo, est sans recours sur Matador. Le marché ne l’a pas sanctionné à la publication du 10-Q. Il l’a fait quand le pétrole s’est retourné : un producteur plus endetté encaisse moins bien la baisse du baril que ses pairs.</p>`, 'primary', PS('q2_results'), 'Faits lus dans le communiqué T2 et le 10-Q ; aucune projection ajoutée.', [['primary', PS('ltd_20260630')], ['primary', PS('paloma_price')], ['primary', PS('cardinal_term_loan')], ['primary', PS('fy_guidance')]]),
  moat: 'L’avantage de Matador tient à la contiguïté de ses surfaces dans le Delaware et à l’intégration de San Mateo, qui réduit la dépendance aux collecteurs tiers et améliore l’écoulement du gaz. Cet avantage reste opérationnel, pas tarifaire : la société subit le prix mondial du pétrole et le prix local du gaz comme tous ses pairs.',
  theme: 'Producteur pétrolier du bassin Delaware en phase d’acquisitions',
  coverageMatrix: [
    ['Barres quotidiennes', 'Disponible', M('Seconde source de cotations : une barre du 15 septembre était incohérente chez la première.', 'bars', barP(i0915, 0), 'Séance concernée.')],
    ['Fondamentaux fournisseur', 'Disponible, non daté', 'Utilisés pour les multiples, sans période présumée.'],
    ['Résultats primaires', 'Disponible', 'Communiqué T2 et 10-Q ouverts et hachés.'],
    ['Surprises de résultats', 'Disponible', 'Quatre trimestres seulement.'],
    ['Analystes', 'Disponible', 'Consensus stable sur dix jours ; aucune action datée sur quatre-vingt-dix jours.'],
    ['Options', 'Inexploitable', 'Cotations sans fourchette ni intérêt ouvert : aucune lecture directionnelle.'],
    ['Dépôts SEC', 'Disponible', 'Inventaire de l’année passé en revue.'],
    ['Initiés', 'Partiel', 'Couverture du corpus officiel incomplète ; un achat de formulaire 4 relevé.'],
    ['Institutionnels', 'Disponible', 'Relevés trimestriels de grands gérants.'],
    ['Short interest et emprunt', 'Disponible', 'Relevé bimensuel et coût d’emprunt.'],
    ['Volume vendeur FINRA', 'Disponible', 'Non directionnel : non utilisé comme flux.'],
    ['Sentiment social', 'Indisponible', 'Aucune donnée Reddit ni tendance de recherche.'],
    ['Saisonnalité', 'Disponible', 'Contexte seulement.'],
    ['Corrélations et comparables', 'Disponible', 'Calculées sur les séances communes.'],
    ['Calendrier', 'Partiel', 'Date de résultats du fournisseur, non confirmée par l’émetteur.'],
  ].map(([facet, status, decision]) => ({ facet, status, decision })),
  segments: [
    { name: 'Exploration et production', revenue: M('1 083,3 M$ de revenus pétrole et gaz au T2 2026', 'primary', PS('segments_q2'), 'Note 12 du 10-Q.'), pct: M(`${fr(541414 / (541414 + 71262) * 100, 1)} % du résultat opérationnel des segments`, 'primary', PS('segments_q2'), 'Résultat opérationnel du segment / somme des deux segments.'), description: M('Puits opérés du bassin Delaware ; résultat opérationnel de 541,4 M$ au T2 ; cœur de la valeur et de la dette.', 'primary', PS('segments_q2'), 'Note 12 du 10-Q.') },
    { name: 'Midstream (San Mateo)', revenue: M('146,3 M$ de services au T2 2026, dont 101,7 M$ éliminés en intragroupe', 'primary', PS('segments_q2'), 'Note 12 du 10-Q.'), pct: M(`${fr(71262 / (541414 + 71262) * 100, 1)} % du résultat opérationnel des segments`, 'primary', PS('segments_q2'), 'Résultat opérationnel du segment / somme des deux segments.'), description: M('Collecte et traitement du gaz, détenu à 51 %, élargi par l’achat de Cardinal pour 752,0 M$ ; résultat opérationnel de 71,3 M$ au T2.', 'primary', PS('cardinal_term_loan'), 'Participation et prix publiés.', [['primary', PS('segments_q2')]]) },
  ],
  sourceRefs: [srcDoc(1, 'Matador — résultats du T2 2026 (pièce 99.1)'), srcDoc(0, 'Matador — 10-Q du T2 2026'), srcDoc(2, 'Matador — accords Paloma et Ridge Runner')],
};

a.news = [
  { date: M('2026-09-10', 'primary', PD(6), 'Date de dépôt.'), title: 'Départ du co-président chargé des acquisitions', detail: M('Van Singleton part à la retraite et devient conseiller spécial contre 450 000 $ par an ; Bryan Erman, déjà responsable des fusions-acquisitions, reprend la co-présidence, et Jonathan Filbert le foncier et les cessions-acquisitions.', 'primary', PS('singleton'), 'Rémunération et successions publiées dans le 8-K.'), impact: 'neutral', source: 'SEC 8-K', sourceUrl: docs[6].url },
  { date: M('2026-08-05', 'primary', PD(1), 'Date de dépôt.'), title: 'T2 record et guidance pétrole relevée', detail: M('BPA ajusté 2,61 $, flux disponible ajusté 303,2 M$ et objectif de levier 1,0x fin 2027 : le cash du trimestre est fléché vers la dette.', 'primary', PS('q2_results'), 'Chiffres du communiqué.', [['primary', PS('fy_guidance')]]), impact: 'positive', source: 'SEC 8-K, pièce 99.1', sourceUrl: docs[1].url },
  { date: M('2026-07-24', 'primary', PD(2), 'Date de dépôt.'), title: 'Accords Paloma et Ridge Runner', detail: M('Paloma coûte 1,275 Md$ en numéraire ; le prix de Ridge Runner n’est pas publié ; les deux se financent par trésorerie et ligne de crédit au T4.', 'primary', PS('paloma_price'), 'Prix et financement publiés.'), impact: 'negative', source: 'SEC 8-K', sourceUrl: docs[2].url },
  { date: M(itx.transactions[0].date_filing, 'insiders', ITp + '/transactions/0/date_filing', 'Date de dépôt du formulaire 4.'), title: 'Achat du directeur financier', detail: M('Christopher Calvert a acheté 2 500 actions à 56,64 $ ; il détient ensuite 44 000 actions en détention indirecte.', 'insiders', ITp + '/transactions/0', 'Formulaire 4 déclaré.'), impact: 'positive', source: 'SEC formulaire 4', sourceUrl: M(`${EDGAR}${itx.transactions[0].accession.replace(/-/g, '')}/`, 'insiders', ITp + '/transactions/0/accession', 'Dossier EDGAR de l’accession.') },
];

const rowsF = [
  ['Chiffre d’affaires (fournisseur)', md(fin.totalRevenue), 'Relevé fournisseur du 2026-09-24, période non datée', 'blue', 'Ne pas lire comme douze mois certifiés.', 'Données financières du fournisseur', 'fund', Fp + '/totalRevenue'],
  ['EBITDA (fournisseur)', md(fin.ebitda), 'Relevé fournisseur du 2026-09-24, période non datée', 'blue', 'Base du scénario de valorisation.', 'Données financières du fournisseur', 'fund', Fp + '/ebitda'],
  ['Marge opérationnelle', `${fr(fin.operatingMargins * 100, 1)} %`, 'Élevée pour un producteur', 'green', 'Période non datée par le fournisseur.', 'Données financières du fournisseur', 'fund', Fp + '/operatingMargins'],
  ['Marge nette', `${fr(fin.profitMargins * 100, 1)} %`, 'Correcte', 'blue', 'Inclut la part des minoritaires de San Mateo.', 'Données financières du fournisseur', 'fund', Fp + '/profitMargins'],
  ['Rentabilité des capitaux propres', `${fr(fin.returnOnEquity * 100, 1)} %`, 'Moyenne', 'amber', 'Sous le seuil de qualité de quinze pour cent.', 'Données financières du fournisseur', 'fund', Fp + '/returnOnEquity'],
  ['Dette totale (fournisseur)', md(fin.totalDebt), 'En hausse', 'red', 'Avant Paloma et Ridge Runner.', 'Données financières du fournisseur', 'fund', Fp + '/totalDebt'],
  ['Trésorerie (fournisseur)', mm(fin.totalCash), 'Faible', 'amber', 'La liquidité repose sur la ligne de crédit.', 'Données financières du fournisseur', 'fund', Fp + '/totalCash'],
  ['EV/EBITDA (valeur d’entreprise)', `${fr(st.enterpriseToEbitda)}x`, `Relevé fournisseur du 2026-09-24, vs médiane des pairs ${fr(median)}x`, 'green', 'Décote face aux pairs du Permien.', 'Statistiques du fournisseur et contexte des comparables', 'fund', Sp + '/enterpriseToEbitda'],
  ['Scénario EV/EBITDA des pairs', `${fr(scenarioPriceNci)} $ par action`, `Scénario au multiple médian ${fr(median)}x, comptes du fournisseur non datés (relevé du 2026-09-24), vs ${fr(close)} $`, 'blue', `Minoritaires de San Mateo (322,3 M$ au 30 juin) déduits ; après le prix de Paloma : ${fr(proFormaPrice)} $, sans créditer son EBITDA non publié. Indicatif seulement.`, 'Calcul local sur statistiques, contexte des comparables et 10-Q', 'context', `/data/items/0/results/${ctxStatsI}/data`],
  ['Cours sur valeur comptable', `${fr(st.priceToBook)}x`, 'Relevé fournisseur du 2026-09-24, vs pairs directs', 'green', `Valeur comptable ${fr(st.bookValue)} $ par action selon le fournisseur.`, 'Statistiques du fournisseur', 'fund', Sp + '/priceToBook'],
  ['BPA ajusté T2', '2,61 $', 'Trimestre T2 2026, non-GAAP', 'green', 'Contre 2,09 $ attendus.', 'Communiqué T2 de l’émetteur', 'primary', PS('q2_results')],
  ['EBITDA ajusté T2', '781,0 M$', 'Trimestre T2 2026, non-GAAP', 'green', 'Part du groupe, hors minoritaires.', 'Communiqué T2 de l’émetteur', 'primary', PS('q2_results')],
  ['Flux opérationnel T2', '937,1 M$', 'Trimestre T2 2026, GAAP', 'green', 'Mesure comptable, distincte du flux ajusté.', 'Communiqué T2 de l’émetteur', 'primary', PS('q2_results')],
  ['FCF ajusté T2 (free cash flow)', '303,2 M$', 'Trimestre T2 2026, non-GAAP vs 113,3 M$ au T1', 'green', 'Mesure non-GAAP définie par l’émetteur.', 'Communiqué T2 de l’émetteur', 'primary', PS('q2_results')],
  ['FCF ajusté visé 2026 (free cash flow)', 'environ 900 M$', 'Prévision 2026, guidance non-GAAP', 'blue', 'Prévision au prix à terme de fin juillet.', 'Communiqué T2 de l’émetteur', 'primary', PS('fy_guidance')],
  ['Dette à long terme au 30 juin', '4,216 Md$', 'Trimestre T2 2026 vs 3,402 Md$ en décembre', 'red', 'Avant les deux acquisitions du T4.', '10-Q du T2 de l’émetteur', 'primary', PS('ltd_20260630')],
  ['Ligne de crédit tirée au 5 août', '1,18 Md$', 'Au 2026-08-05', 'red', 'Engagements élus de 2,75 Md$.', '10-Q du T2 de l’émetteur', 'primary', PS('revolver_20260805')],
  ['Dette de San Mateo, sans recours', '1,586 Md$', 'Au 2026-08-05, ligne de 936,0 M$ et prêt à terme de 650,0 M$', 'amber', 'Filiale détenue à 51 % ; le prêt de 650,0 M$ arrive à échéance le 30 juillet 2027.', '10-Q du T2 de l’émetteur', 'primary', PS('san_mateo_0805')],
  ['Intérêts minoritaires au 30 juin', '322,3 M$', 'Trimestre T2 2026, bilan', 'blue', 'Part de San Mateo revenant à Five Point, à déduire de la valeur par action.', '10-Q du T2 de l’émetteur', 'primary', PS('nci_20260630')],
];
a.fundamentals = {
  rows: rowsF.map(([metric, value, signal, signalColor, note, source, n, p]) => ({ metric: /\d/.test(metric.replace(LABEL, '')) ? M(metric, n, p, 'Date de la mesure lue dans la même source.') : metric, value: M(value, n, p, 'Valeur lue et formatée sans réécriture.'), signal: /\d/.test(signal) ? M(signal, n, p, 'Base datée de la mesure.') : signal, signalColor, note: /\d/.test(note) ? M(note, n, p, 'Complément chiffré de la même source.', n === 'context' ? [['fund', Fp], ['fund', Sp]] : []) : note, source })),
  sourceRefs: [srcMarket('Données financières et statistiques datées (provenance hashée)'), srcDoc(1, 'Matador — résultats du T2 2026')],
};

a.earnings = {
  quarters: eqs.map((q, i) => ({ quarter: M(q.date, 'fund', `${EQp}/${i}/date`, 'Libellé de période fiscale du fournisseur.'), epsActual: M(q.actual, 'fund', `${EQp}/${i}/actual`, 'BPA publié.'), epsEstimate: M(q.estimate, 'fund', `${EQp}/${i}/estimate`, 'BPA attendu.'), surprise: M(pct((q.actual / q.estimate - 1) * 100), 'fund', `${EQp}/${i}`, 'Surprise = publié / attendu − 1.'), revActual: 'N/D', revEstimate: 'N/D' })),
  beatStreak: M(4, 'fund', findPath(FR, o => 'consecutive_beats' in o) + '/consecutive_beats', 'Dépassements consécutifs sur l’historique disponible.'),
  beatNote: M(`Matador a battu le consensus quatre trimestres de suite, et l’écart s’élargit : au T2 2026, 2,61 $ de BPA ajusté contre 2,09 $ attendus, 781,0 M$ d’EBITDA ajusté et 303,2 M$ de flux de trésorerie disponible ajusté, presque le triple du T1. La guidance annuelle de production pétrolière passe à 127 500–129 000 barils par jour, et le budget de forage, complétion et équipement à 1,48–1,56 Md$ : une partie de la croissance est achetée par un capex plus lourd. La prochaine publication est annoncée au 27 octobre par le calendrier du fournisseur, date non confirmée par l’émetteur ; elle tombera avant la clôture des deux acquisitions.`, 'primary', PS('q2_results'), 'Résultats et guidance primaires ; série des surprises du fournisseur ; date du calendrier fournisseur.', [['primary', PS('fy_guidance')], ['fund', EQp], ['fund', Cp + '/nextEarningsDate']]),
  nextEarnings: M('27 octobre 2026 (calendrier du fournisseur, non confirmée par l’émetteur)', 'fund', Cp + '/nextEarningsDate', 'Date du calendrier fournisseur.'),
  sourceRefs: [srcDoc(1, 'Matador — résultats du T2 2026'), srcMarket('Surprises de résultats datées (provenance hashée)')],
};

a.insiders = {
  insiderPct: M(`${fr(holders.insidersPercent, 2)} %`, 'fund', Hp + '/insidersPercent', 'Part des initiés selon le fournisseur.'),
  institutionPct: M(`${fr(holders.institutionsPercent, 2)} %`, 'fund', Hp + '/institutionsPercent', 'Part des institutions selon le fournisseur.'),
  topHolders: ih.holdings.map((h, i) => ({ h, i })).filter(({ h }) => h.shares > 0 && h.quarter === '2026-Q2').sort((x, y) => y.h.shares - x.h.shares).map(({ h, i }) => ({ name: h.filer_name, pct: M(`${fr(h.shares / 1e6, 2)} M d’actions au 30 juin`, 'insiders', `${IHp}/holdings/${i}/shares`, 'Position déclarée en 13F au T2 2026.'), role: 'Gérant suivi (13F), panel restreint' })),
  recentTransactions: [{ date: M(itx.transactions[0].date_transaction, 'insiders', ITp + '/transactions/0/date_transaction', 'Date de transaction.'), insider: 'Christopher Calvert (directeur financier)', type: 'buy', shares: M('2 500', 'insiders', ITp + '/transactions/0/shares', 'Actions achetées.'), value: M('141 600 $', 'insiders', ITp + '/transactions/0/value_usd', 'Montant de la transaction.') }],
  signal: 'Un achat en numéraire du directeur financier en août ; la couverture officielle du corpus d’initiés reste partielle, donc aucun solde net n’est publié.',
  sourceRefs: [srcMarket('Initiés et institutionnels datés (provenance hashée)')],
};

a.capitalStructure = {
  sharesOutstanding: M(`${fr(shares / 1e6, 2)} M d’actions (fournisseur)`, 'fund', Sp + '/sharesOutstanding', 'Actions en circulation.'),
  sharesAuthorized: 'N/D',
  dilutionRisk: 'low',
  shareHistory: M('Le risque de dilution par émission d’actions est faible à ce stade : la direction écrit ne pas prévoir d’appel au marché actions, et aucun enregistrement d’émission ni supplément de prospectus n’apparaît dans les dépôts de 2026. Le risque est ailleurs, dans la dette : 750 M$ d’obligations à 6,000 % émises en mars, engagements de la ligne de crédit portés à 2,75 Md$ en juin, puis Paloma à financer au T4. Le passage des actions de base aux actions diluées n’est pas calculable ici faute de tableau de rémunération en actions à jour.', 'primary', PS('fy_guidance'), 'Déclaration de l’émetteur sur le marché actions ; inventaire des dépôts 2026 ; dette publiée.', [['primary', PS('notes_2034')], ['primary', PS('credit_2750')], ['primary', '/inventory']]),
  sourceRefs: [srcDoc(4, 'Matador — obligations 2034'), srcDoc(5, 'Matador — ligne de crédit'), srcDoc(0, 'Matador — 10-Q du T2 2026')],
};

a.filingsReview = {
  summary: M(`Les ${inventory.length} dépôts EDGAR de 2026 jusqu’au 23 septembre ont été listés ; huit documents décisifs ont été ouverts. Aucun ne porte d’émission d’actions. Tous décrivent un financement par dette d’acquisitions successives.`, 'primary', '/inventory_count', 'Taille de l’inventaire et nombre de documents ouverts.'),
  filings: [
    [0, 'Le 10-Q montre une dette à long terme de 4,216 Md$ au 30 juin contre 3,402 Md$ en décembre, puis 243,0 M$ tirés en plus sur la ligne de Matador jusqu’au 5 août. La ligne de San Mateo, 936,0 M$ à cette date, est sans recours sur Matador. Paloma et Ridge Runner y figurent en événements postérieurs, à financer par trésorerie et ligne de crédit.', ['ltd_20260630', 'revolver_20260805', 'san_mateo_0805']],
    [2, 'L’accord Paloma fixe 1,275 Md$ en numéraire, ajusté du fonds de roulement, avec une date d’effet au 1er juin et une clôture attendue au T4. Le prix de Ridge Runner n’apparaît ni dans le 8-K ni dans le communiqué : un montant inconnu s’ajoutera à la dette.', ['paloma_price']],
    [4, 'Émission en mars de 750 M$ d’obligations senior à 6,000 % à échéance 2034, pour un produit net d’environ 737,2 M$. Le coût de la dette nouvelle reste élevé et pèse sur le flux disponible destiné au désendettement.', ['notes_2034']],
    [7, 'Le 10-K 2025 révèle une concentration commerciale : trois acheteurs font 72 % des revenus d’hydrocarbures, dont Plains Marketing pour 49 %. La direction juge ces acheteurs remplaçables, mais la dépendance aux conditions d’écoulement reste réelle.', ['purchasers']],
    [6, 'Le 8-K de septembre acte le départ en retraite du co-président chargé du foncier et des acquisitions, devenu conseiller à 450 000 $ par an. Bryan Erman, responsable des fusions-acquisitions depuis juin 2025, reprend la co-présidence ; Jonathan Filbert reprend le foncier. La succession est interne, avant deux clôtures attendues au T4.', ['singleton']],
  ].map(([i, finding, ids]) => ({ form: docs[i].form, date: M(docs[i].date, 'primary', PD(i), 'Date de dépôt.'), accession: M(docs[i].accession, 'primary', PD(i) + '/accession', 'Accession EDGAR.'), finding: M(finding, 'primary', PS(ids[0]), 'Constat lu dans le document haché.', ids.slice(1).map(x => ['primary', PS(x)])), url: M(docs[i].url, 'primary', PD(i) + '/url', 'URL EDGAR directe.') })),
  contrarianRisks: [
    'Si le pétrole recule, le désendettement promis se décale : le flux disponible visé suppose le prix à terme de fin juillet.',
    M(`Le prix de Ridge Runner n’est pas publié : la dette pro forma d’au moins ${md(proFormaDebt)} est un plancher, dont ${md(sanMateoDebt)} sans recours sur Matador.`, 'primary', PS('paloma_price'), 'Somme des montants publiés par périmètre, Ridge Runner exclu.', [['primary', PS('notes_total_20260630')], ['primary', PS('revolver_20260805')], ['primary', PS('san_mateo_0805')], ['primary', PS('cardinal_term_loan')]]),
    M('Les prix du gaz à Waha sont devenus négatifs au T2 et ont forcé des arrêts de production ; le gazoduc Hugh Brinson ne doit démarrer qu’à la fin du T3.', 'primary', PS('waha'), 'Communiqué T2.', [['primary', PS('hugh_brinson')]]),
    M('Le prêt à terme de 650,0 M$ de San Mateo arrive à échéance le 30 juillet 2027 : un refinancement à prévoir dans moins d’un an, en plein désendettement annoncé.', 'primary', PS('cardinal_term_loan'), 'Échéance publiée dans le 10-Q.'),
  ],
};

a.shortInterest = {
  siPct: M(`${fr(st.shortPercentOfFloat * 100, 2)} %`, 'fund', Sp + '/shortPercentOfFloat', 'Part du flottant vendue à découvert selon le fournisseur.'),
  daysToCover: M(fr(st.shortRatio, 2), 'fund', Sp + '/shortRatio', 'Jours de couverture selon le fournisseur.'),
  ctb: 'N/D', trend: 'Relevé unique du fournisseur, sans tendance publiée ici', squeezeScore: 'N/D',
  sourceRefs: [srcMarket('Statistiques de vente à découvert datées (provenance hashée)')],
};

a.options = {
  maturity: 'N/D',
  callOI: 'Indisponible', putOI: 'Indisponible', cpRatio: 'N/D', maxPain: 'N/D', ivMean: 'N/D', skew: 'N/D',
  unusual: 'Cotations sans fourchette ni intérêt ouvert, volatilités implicites hors plage : aucune lecture directionnelle n’est tirée des options.',
  sourceRefs: [srcMarket('Chaîne d’options relevée (provenance hashée)')],
};

a.technicals = {
  rsi14: TK('rsi'), macd: TK('macd'), macdSignal: TK('signal'), ema20: TK('ema20'), ema50: TK('ema50'), ema200: TK('ema200'),
  ma50Type: 'EMA', ma200Type: 'EMA', ma50Available: true, ma200Available: true, atr14: TK('atr'),
  badges: ['Sous les moyennes à vingt et cinquante séances', 'Au contact de la moyenne à deux cents séances'],
  supports: [lvl(bars[L][3], L, 3, 'Plus bas du 23 septembre.'), lvl(l60[3], l60i, 3, 'Plus bas des soixante dernières séances.')],
  resistances: [lvl(bars[i0917][2], i0917, 2, 'Plus haut du 17 septembre.'), lvl(h60[2], h60i, 2, 'Plus haut des soixante dernières séances.')],
  setupNote: M(`Le décrochage du 16 septembre (${pct((bars[i0916][4] / bars[i0915][4] - 1) * 100)}) a ouvert une zone entre ${fr(bars[i0917][2])} $ et ${fr(bars[i0916][2])} $. Le scénario ne s’active qu’à une clôture au-dessus de 58.10 $, avec un stop à 53.85 $ sous le plus bas du 21 septembre (${fr(bars[i0921][3])} $). Entre les deux, le titre flotte autour de sa moyenne exponentielle à deux cents séances (${fr(tech.ema200)} $) : aucune entrée, attendre le déclenchement en gardant le titre sous surveillance.`, 'bars', barP(i0916, 4), 'Barres certifiées des 15, 16, 17 et 21 septembre ; moyenne recalculée sur les barres.', [['bars', barP(i0915, 4)], ['bars', barP(i0917, 2)], ['bars', barP(i0921, 3)]]),
  wyckoff: 'Aucune lecture de phase publiée : le profil de volume du fournisseur n’est pas recalculé sur les barres certifiées.',
  sourceRefs: [srcMarket('Barres quotidiennes certifiées et indicateurs recalculés (provenance hashée)')],
};

a.macro = {
  impact: M(`Le régime de marché est classé favorable au risque avec une confiance de ${fr(reg.current_state_confidence * 100, 0)} %, mais la séance du 23 septembre a été dominée par la hausse des taux longs américains. Pour Matador, le taux compte deux fois : il pèse sur la valorisation et il renchérit une dette à taux variable en expansion.`, 'regime', REGp + '/current_state_confidence', 'Classification de régime du fournisseur.'),
  sourceRefs: [srcMarket('Régime de marché daté (provenance hashée)')],
};

a.risks = {
  riskScore: J('risks.riskScore'), riskProfile: 'High',
  riskSummary: 'Le risque principal est de bilan : Matador empile la dette avant de conclure deux acquisitions, dont une sans prix publié, et le titre amplifie déjà les baisses de son secteur. Un recul durable du pétrole transformerait la trajectoire de désendettement en problème.',
  riskCards: [
    { title: 'Dette et acquisitions', severity: 'high', points: [M('Dette à long terme passée de 3,402 à 4,216 Md$ en six mois, avant Paloma (1,275 Md$) et Ridge Runner.', 'primary', PS('ltd_20260630'), '10-Q.', [['primary', PS('paloma_price')]]), M('Le levier cible de 1,0x fin 2027 dépend du prix du pétrole et de l’intégration.', 'primary', PS('fy_guidance'), 'Objectif de levier publié.')], verdict: 'Surveiller la ligne de crédit tirée à chaque trimestre et le prix de Ridge Runner quand il sera publié.' },
    { title: 'Baisse sectorielle amplifiée', severity: 'high', points: [M(`Du 15 au 23 septembre : MTDR ${pct(sinceM('2026-09-15'))}, PR ${pct(sinceP('PR', '2026-09-15'))}, XOP ${pct(sinceP('XOP', '2026-09-15'))}, USO ${pct(sinceP('USO', '2026-09-15'))}.`, 'bars', barP(i0915, 4), 'Rendements simples sur la même fenêtre.', [['bars', barP(L, 4)], ['comparison', CMP('PR').p], ['comparison', CMP('XOP').p], ['comparison', CMP('USO').p]]), 'Aucun dépôt n’explique l’écart d’environ six points avec les pairs du bassin ; la dette en hausse en est une explication plausible, non démontrée.'], verdict: 'Tant que l’écart avec PR et FANG ne se referme pas, un rebond du pétrole profitera d’abord aux pairs moins endettés.' },
    { title: 'Prix du gaz local', severity: 'medium', points: [M('Des prix négatifs à Waha ont forcé des arrêts au T2.', 'primary', PS('waha'), 'Communiqué T2.'), 'Le gazoduc Hugh Brinson doit démarrer fin T3 : un retard prolongerait la décote sur le gaz.'], verdict: 'Vérifier au prochain trimestre le prix réalisé du gaz et les volumes arrêtés.' },
    { title: 'Concentration des acheteurs', severity: 'medium', points: [M('Plains Marketing représente 49 % des revenus d’hydrocarbures 2025.', 'primary', PS('purchasers'), '10-K 2025.'), 'Une rupture d’écoulement ou de crédit chez un acheteur toucherait directement les revenus.'], verdict: 'Risque faible en probabilité, élevé en conséquence ; à suivre dans le prochain 10-K.' },
  ],
  pedagogy: M(`Un scénario conditionnel n’est pas un ordre : attendre la clôture au-dessus du seuil, pas l’intraday. Prix plafond : si l’ouverture suivante se fait au-dessus de ${fr(ceiling)} $, le rapport gain/risque vers le premier objectif passe sous 1,2 ; ne pas acheter et attendre un repli vers ${fr(entry)} $. La liquidité est correcte : ${fr(vol20 / 1e6, 2)} M de titres échangés en moyenne sur vingt séances, environ ${fr(usd20 / 1e6, 0)} M$ par jour. Exemple de taille de position, non personnalisé : avec un budget de risque de 1 % sur un compte de 10 000 $, soit 100 $, et ${fr(riskU)} $ de risque par action, la position est de ${sizeShares} actions. Ne pas acheter un gap d’ouverture après les résultats du 27 octobre, date non confirmée.`, 'bars', B, 'Plafond = (TP1 + 1,2 × stop) / 2,2 ; volume et montant moyens des vingt dernières séances ; taille = 100 $ / (entrée − stop), arrondie à l’unité inférieure.', [['bars', barP(i0917, 2)], ['bars', barP(i0921, 3)], ['bars', barP(h60i, 2)], ['fund', Cp + '/nextEarningsDate']]),
  sourceRefs: [srcDoc(0, 'Matador — 10-Q du T2 2026'), srcDoc(7, 'Matador — 10-K 2025')],
};

a.social = { platforms: [{ platform: 'Couverture sociale', icon: 'fa-solid fa-circle-info', mentions: 'Indisponible', trend: 'Non utilisé', trendColor: 'gray', detail: 'Aucune donnée Reddit ni tendance de recherche relevée pour ce titre.' }], sourceRefs: [srcMarket('Sentiment et tendances de recherche relevés (provenance hashée)')] };

a.performance = {
  ytd: M(pct((close / bars[ytdIdx][4] - 1) * 100), 'bars', barP(ytdIdx, 4), 'Depuis la clôture du 31 décembre 2025.', [['bars', barP(L, 4)]]),
  oneYear: M(pct((close / bars[yearIdx][4] - 1) * 100), 'bars', barP(yearIdx, 4), 'Depuis la clôture du 23 septembre 2025.', [['bars', barP(L, 4)]]),
  threeYear: 'N/D : historique de trois cents séances seulement',
  benchmarks: ['XLE', 'XOP', 'USO', 'PR'].map(t => ({ name: t, ticker: t, ytd: M(`5 séances ${pct(R_(t).r5)} ; 21 séances ${pct(R_(t).r21)}`, R_(t).n, R_(t).p, 'Rendements simples sur cinq et vingt et une séances.'), oneYear: 'N/D : fenêtre des comparables trop courte' })),
  alpha: M(`Depuis le 15 septembre, MTDR fait ${pct(sinceM('2026-09-15'))} contre ${pct(sinceP('XOP', '2026-09-15'))} pour XOP et ${pct(peerMedianSince)} pour la médiane des six pairs du bassin : la part sectorielle de la baisse vaut environ la moitié face à XOP (${fr(shareXop, 0)} %) et deux tiers face aux pairs (${fr(sharePeers, 0)} %). Le reste est propre au titre, sans cause publiée. Du 7 août au 15 septembre, MTDR avait gagné ${pct(sinceM('2026-08-07', '2026-09-15'))} contre ${pct(sinceP('XOP', '2026-08-07', '2026-09-15'))} pour XOP.`, 'bars', barP(i0915, 4), 'Rendements simples sur fenêtres identiques ; parts = rendement de XOP ou de la médiane des pairs directs / rendement de MTDR.', [['bars', barP(i0807, 4)], ['bars', barP(L, 4)], ['comparison', CMP('XOP').p], ...DIRECT.map(t => ['comparison', CMP(t).p])]),
  sourceRefs: [srcMarket('Barres quotidiennes alignées (provenance hashée)')],
};

a.capitalFlow = { netFlow: 'N/A', institutionalFlow: 'N/A', retailFlow: 'N/A', darkPoolPct: 'N/A', signal: 'Aucun flux directionnel publié : le volume vendeur FINRA n’en est pas un.', sourceRefs: [srcMarket('Volumes relevés (provenance hashée)')] };

a.tradeIdea = {
  entry: M(entry, 'bars', barP(i0917, 2), 'Seuil de déclenchement au-dessus du plus haut du 17 septembre.'),
  entryNote: M(`Uniquement sur une clôture au-dessus de 58,10 $, soit au-dessus du plus haut du 17 septembre (${fr(bars[i0917][2])} $), puis une ouverture sous ${fr(ceiling)} $. Aucune entrée au cours de ${fr(close)} $.`, 'bars', barP(i0917, 2), 'Barres certifiées ; plafond = (TP1 + 1,2 × stop) / 2,2.', [['bars', barP(L, 4)], ['bars', barP(i0921, 3)], ['bars', barP(h60i, 2)]]),
  stop: M(stop, 'bars', barP(i0921, 3), 'Sous le plus bas du 21 septembre.'),
  stopPct: M(`${((stop / entry - 1) * 100).toFixed(2)} %`, 'bars', barP(i0921, 3), 'Écart stop / entrée.', [['bars', barP(i0917, 2)]]),
  tp1: M(tp1, 'bars', barP(h60i, 2), 'Sous le plus haut des soixante séances.'),
  tp1Pct: M(`+${((tp1 / entry - 1) * 100).toFixed(2)} %`, 'bars', barP(h60i, 2), 'Écart objectif / entrée.', [['bars', barP(i0917, 2)]]),
  tp2: M(tp2, 'bars', barP(hiIdx, 2), 'Sous le plus haut sur cinquante-deux semaines.'),
  tp2Pct: M(`+${((tp2 / entry - 1) * 100).toFixed(2)} %`, 'bars', barP(hiIdx, 2), 'Écart objectif / entrée.', [['bars', barP(i0917, 2)]]),
  rr: M(`1:${rr1.toFixed(2)} (TP1) / 1:${rr2.toFixed(2)} (TP2)`, 'bars', barP(h60i, 2), 'Gain / risque recalculé depuis les niveaux.', [['bars', barP(i0921, 3)], ['bars', barP(hiIdx, 2)]]),
  horizon: M('Dix à vingt séances après déclenchement ; revoir avant la publication du 27 octobre, non confirmée', 'fund', Cp + '/nextEarningsDate', 'Date du calendrier fournisseur.'),
  thesis: M(`Pas d’achat à ${fr(close)} $. Le précédent scénario a été stoppé le 16 septembre, à une clôture enregistrée à l’époque de ${fr(raw.archive.meta.lastEvent.close)} $ (${fr(bars[i0916][4])} $ sur la source certifiée actuelle) ; celui-ci repart de zéro. Il ne devient valable qu’à une clôture au-dessus de 58.10 $, qui refermerait la moitié du décrochage du 16 septembre, avec un stop à 53.85 $. Le gain vers 63,80 $ ne vaut que ${fr(rr1)} fois le risque : c’est mince, et au-dessus de ${fr(ceiling)} $ à l’ouverture il passe sous 1,2 ; dans ce cas, ne pas acheter. Ne pas anticiper le signal, ne pas acheter un gap d’ouverture, calibrer la taille de position sur la perte au stop. La publication attendue le 27 octobre, non confirmée, impose de réévaluer avant.`, 'bars', barP(L, 4), 'Niveaux lus dans les barres ; rapports recalculés ; ancien stop conservé dans l’archive.', [['bars', barP(i0916, 4)], ['bars', barP(i0917, 2)], ['bars', barP(i0921, 3)], ['bars', barP(h60i, 2)], ['archive', '/meta/lastEvent/close'], ['fund', Cp + '/nextEarningsDate']]),
  catalysts: [
    'Publication du T3 avec la dette tirée sur la ligne de crédit et le point sur Paloma.',
    'Clôture de Paloma et publication éventuelle du prix de Ridge Runner.',
    'Démarrage du gazoduc Hugh Brinson et effet sur le prix réalisé du gaz.',
  ],
  invalidation: [
    M(`Clôture sous ${fr(bars[L][3])} $, le plus bas du 23 septembre : la baisse continue et le scénario est retiré.`, 'bars', barP(L, 3), 'Plus bas de la dernière séance.'),
    'Annonce d’une nouvelle acquisition financée par dette avant la clôture de Paloma.',
    'Recul du pétrole coté qui ramène le baril sous son niveau de fin juillet, base de la guidance de flux disponible.',
  ],
  status: 'watch',
  statusNote: 'Surveillance : aucun ordre ; attendre une clôture au-dessus du seuil.',
};

a.globalScore = {
  profile: 'Producteur solide, bilan sous tension, action sous surveillance',
  keyTakeawaysPositive: [
    M('Quatre trimestres de BPA au-dessus du consensus, dont 2,61 $ contre 2,09 $ au T2.', 'primary', PS('q2_results'), 'Communiqué T2.', [['fund', EQp]]),
    M('Flux de trésorerie disponible ajusté de 303,2 M$ au T2, presque le triple du T1 (113,3 M$).', 'primary', PS('q2_results'), 'Communiqué T2.'),
    M('Achat en numéraire du directeur financier à 56,64 $ en août.', 'insiders', ITp + '/transactions/0/price', 'Formulaire 4.'),
  ],
  keyTakeawaysNegative: [
    M(`Dette pro forma d’au moins ${md(proFormaDebt)} hors Ridge Runner, dont ${md(recourseDebt)} chez Matador.`, 'primary', PS('notes_total_20260630'), 'Somme des montants publiés par périmètre.', [['primary', PS('revolver_20260805')], ['primary', PS('paloma_price')], ['primary', PS('san_mateo_0805')], ['primary', PS('cardinal_term_loan')]]),
    M(`Depuis le 15 septembre, ${pct(sinceM('2026-09-15'))} contre ${pct(sinceP('PR', '2026-09-15'))} pour PR : le titre amplifie les baisses du secteur.`, 'bars', barP(i0915, 4), 'Rendements simples sur la même fenêtre.', [['bars', barP(L, 4)], ['comparison', CMP('PR').p]]),
    'Options inexploitables et couverture des initiés partielle : peu de signaux de positionnement.',
  ],
  mindsetTip: 'Un bon trimestre ne suffit pas quand le bilan change de taille : lire la dette avant la production.',
};

// ---------------------------------------------------------------- blast radius
const GROUPS = [
  ['Producteurs leaders', 'leader', 'Même baril, bilans plus solides : ils indiquent si la baisse est sectorielle.', [
    ['EOG', 'grand producteur américain peu endetté', 'EOG sert de témoin du baril sans effet de levier financier : l’écart avec lui pourrait refléter le coût du bilan de Matador, sans que cela soit démontré.', 'Aucune publication dans les quatorze jours collectés ; sa réaction reflète le baril, pas un bilan tendu.'],
    ['XOM', 'major intégrée et acheteur documenté', 'Exxon Mobil achète 13 % de la production de Matador en 2025 : son raffinage amortit les baisses de brut que Matador subit en direct.', 'Pas de résultats dans la fenêtre collectée ; le raffinage pèse sur son propre calendrier de marges.'],
    ['COP', 'grand producteur indépendant diversifié', 'ConocoPhillips capte le même baril mais sur plusieurs bassins et avec du gaz liquéfié : il dilue le risque local que Matador concentre.', 'Rien au calendrier des quatorze jours ; son gaz se vend sur plusieurs marchés, pas seulement à Waha.'],
  ]],
  ['Pairs directs du bassin Permien', 'direct_peer', 'Même bassin, mêmes prix réalisés : l’écart avec eux isole le facteur propre à Matador.', [
    ['PR', 'pair du Delaware de taille proche', 'Permian Resources opère dans les mêmes comtés du Delaware : c’est le comparable le plus direct pour les prix réalisés et le coût des puits.', 'Calendrier vide sur quatorze jours ; toute annonce d’acquisition de sa part se lirait aussi sur Matador.'],
    ['FANG', 'pair du Midland et du Delaware', 'Diamondback subit le même prix du gaz à Waha : sa baisse depuis le 15 septembre, proche de celle de Matador, pointe un facteur de bassin.', 'Pas de publication dans la fenêtre collectée ; même exposition au prix du gaz de Waha.'],
    ['DVN', 'producteur multi-bassins exposé au Delaware', 'Devon a mieux résisté depuis le 15 septembre : sa diversification géographique amortit le choc du Permien.', 'Aucun résultat dans les quatorze jours ; sa diversification rend sa réaction moins lisible.'],
    ['OXY', 'producteur du Permien endetté', 'Occidental combine Permien et dette élevée : c’est le meilleur test de l’hypothèse selon laquelle le levier amplifie la baisse.', 'Rien au calendrier des quatorze jours ; son levier en fait le test le plus proche du cas Matador.'],
    ['SM', 'producteur Permien de taille moyenne', 'SM Energy a baissé presque autant que Matador : l’écart propre au titre est donc partagé par les producteurs de taille moyenne.', 'Calendrier vide sur quatorze jours ; sa taille proche de Matador rend la comparaison directe.'],
    ['CHRD', 'producteur mid-cap du Bakken', 'Chord n’est pas dans le Permien mais a une taille comparable : sa baisse similaire suggère un effet de taille autant que de bassin.', 'Pas de résultats dans la fenêtre collectée ; différentiel de prix du Bakken distinct du Permien.'],
  ]],
  ['Services et forage', 'upstream', 'Ils vendent à Matador : un budget de forage en hausse les soutient, une coupe de capex les frappe.', [
    ['SLB', 'services pétroliers mondiaux', 'SLB dépend surtout de l’international : sa faible corrélation montre que le capex de Matador pèse peu sur lui.', 'Aucune publication dans les quatorze jours ; sa demande dépend surtout des budgets hors États-Unis.'],
    ['HAL', 'services de complétion nord-américains', 'Halliburton vend la fracturation aux producteurs du Permien : un budget de puits relevé par Matador le soutient.', 'Rien au calendrier des quatorze jours ; réagit aux budgets de complétion des producteurs américains.'],
    ['PTEN', 'forage terrestre et fracturation', 'Patterson-UTI loue les appareils de forage : il réagit au nombre de puits prévus, que Matador a relevé à 112,6 cette année.', 'Calendrier vide sur quatorze jours ; le nombre d’appareils actifs est sa variable clé.'],
    ['HP', 'forage terrestre américain', 'Helmerich & Payne dépend du nombre d’appareils actifs : une coupe de capex des producteurs le toucherait en second rang.', 'Pas de publication dans la fenêtre collectée ; exposé au nombre d’appareils loués aux producteurs.'],
  ]],
  ['Acheteurs et transport', 'downstream', 'Ils achètent ou transportent la production : leurs volumes dépendent de la croissance promise.', [
    ['PAA', 'premier acheteur documenté (Plains)', 'Plains Marketing représente 49 % des revenus 2025 de Matador : ses volumes transportés dépendent directement de la production promise.', 'Aucun résultat dans les quatorze jours ; un recul des volumes de Matador toucherait ses flux.'],
    ['EPD', 'acheteur documenté et transporteur', 'Enterprise Products représente 10 % des revenus 2025 de Matador : son revenu tient aux volumes plus qu’au prix du brut.', 'Rien au calendrier des quatorze jours ; son revenu dépend des volumes transportés.'],
    ['KMI', 'transport de gaz naturel', 'Kinder Morgan transporte le gaz du Permien : un prix de Waha déprimé réduit la valeur du gaz associé de Matador sans toucher ses tarifs.', 'Calendrier vide sur quatorze jours ; payé au volume de gaz transporté, pas au prix.'],
    ['WMB', 'transport de gaz naturel', 'Williams relie les bassins aux marchés de l’Est : sa faible corrélation rappelle que le transport est payé au volume, pas au prix.', 'Pas de résultats dans la fenêtre collectée ; son réseau principal est hors du Permien.'],
    ['MPC', 'raffineur, acheteur de brut', 'Marathon Petroleum achète du brut : une baisse du baril améliore ses marges quand elle réduit celles de Matador.', 'Aucune publication dans les quatorze jours ; ses marges évoluent souvent à l’inverse du brut.'],
  ]],
  ['Gaz exporté', 'second_order', 'Le prix du gaz exporté conditionne la valeur du gaz associé du Permien.', [
    ['VG', 'exportateur de gaz naturel liquéfié', 'Venture Global exporte du gaz liquéfié : plus de capacité d’export soutient à terme le prix du gaz texan que Matador vend avec décote.', 'Rien au calendrier des quatorze jours ; sa valeur suit la demande mondiale de gaz liquéfié.'],
  ]],
  ['Fonds et pétrole', 'sector_proxy', 'Référence de secteur et de matière première.', [
    ['XLE', 'fonds énergie large', 'XLE est dominé par les majors : il mesure le secteur pondéré par la taille, où Matador pèse très peu.', 'Fonds indiciel sans publication propre ; dominé par quelques très grandes capitalisations.'],
    ['XOP', 'fonds des producteurs', 'XOP équipondère les producteurs : c’est la mesure la plus juste du mouvement sectoriel de Matador.', 'Fonds équipondéré sans calendrier propre ; reflète la moyenne des producteurs américains.'],
    ['USO', 'fonds indiciel du pétrole', 'USO suit les contrats à terme sur le brut : il mesure le baril lui-même, sans effet de bilan ni de production.', 'Fonds de contrats à terme sans publication propre ; exposé au renouvellement mensuel des échéances.'],
    ['OIH', 'fonds des services pétroliers', 'OIH résume les fournisseurs du secteur : il réagit aux budgets de forage plutôt qu’au prix du jour.', 'Fonds indiciel sans calendrier propre ; concentré sur les grands prestataires de services.'],
  ]],
];
a.blastRadius = {
  asOf: M(REF, 'bars', barP(L, 0), 'Dernière séance complète.'),
  observationTime: M(statusAt, 'status', '/captured_at', 'Horodatage de la collecte.'),
  window: M(`${R_('EOG').first} au ${REF}, ${R_('EOG').observations} rendements communs`, 'comparison', CMP('EOG').p, 'Fenêtre des séances communes.', [['bars', B]]),
  methodology: 'Chaque comparable est classé par lien économique avant toute statistique : leaders, pairs du même bassin, fournisseurs de forage, acheteurs documentés dans le 10-K, gaz exporté et fonds de secteur. La corrélation et le bêta sont calculés sur les rendements logarithmiques des séances communes ; ils mesurent une co-variation passée, pas une causalité ni une couverture.',
  groups: GROUPS.map(([name, cls, transmission, syms], gi) => ({
    name, order: J(`blastRadius.groups.${gi}.order`), transmission,
    symbols: syms.map(([t, role, read, ev]) => {
      const r = R_(t);
      const rd = `${read} Depuis le 15 septembre : ${pct(sinceP(t, '2026-09-15'))}.`;
      const extra = t === 'PTEN' ? [['primary', PS('fy_guidance')]] : ['PAA', 'EPD', 'XOM'].includes(t) ? [['primary', PS('purchasers')]] : [];
      return {
        ticker: t, role, relationClass: cls,
        correlation: RM(t, 'correlation'), beta: RM(t, 'beta'), r2: RM(t, 'r2'), observations: RM(t, 'observations'),
        return5d: RM(t, 'r5'), return21d: RM(t, 'r21'),
        eventRisk: ev,
        readThrough: M(rd, r.n, r.p, 'Rendement simple du 15 au 23 septembre ; lien économique documenté.', extra),
        confidence: Math.abs(r.correlation) >= 0.7 ? 'high' : Math.abs(r.correlation) >= 0.5 ? 'medium' : 'low',
      };
    }),
  })),
  scenarios: [
    { scenario: 'bullish', trigger: 'Le pétrole tient et Matador publie une dette tirée en baisse au T3.', firstOrder: 'La décote de bilan se réduit et le titre rattrape les pairs du Permien.', secondOrder: 'Les services de forage profitent d’un budget de forage maintenu.', confirmation: 'Clôture au-dessus du seuil de déclenchement avec des pairs stables.', contradiction: 'Une hausse de MTDR sans hausse de PR ou de FANG serait fragile et spéculative.' },
    { scenario: 'mixed', trigger: 'Le pétrole reste haut mais la dette continue de monter avec Paloma.', firstOrder: 'Le titre reste coincé autour de sa moyenne à deux cents séances.', secondOrder: 'Les acheteurs et transporteurs gardent leurs volumes sans surprise.', confirmation: 'Écart persistant avec XOP sur vingt et une séances et volumes moyens.', contradiction: 'Un désendettement plus rapide que prévu briserait ce statu quo.' },
    { scenario: 'bearish', trigger: 'Le baril recule nettement, par exemple sur une détente géopolitique.', firstOrder: 'Le flux disponible visé baisse et la trajectoire de levier recule.', secondOrder: 'Services de forage et fonds des producteurs baissent avec lui.', confirmation: M('Clôture sous le plus bas du 23 septembre avec USO en baisse.', 'bars', barP(L, 3), 'Plus bas de la dernière séance.'), contradiction: 'Un maintien de MTDR malgré la baisse du pétrole signalerait une décote déjà complète.' },
  ],
  contradictions: [
    M(`Sur vingt et une séances, le pétrole coté gagne ${fr(R_('USO').r21, 1)} % quand XOP perd ${fr(Math.abs(R_('XOP').r21), 1)} % : les producteurs ne suivent pas le baril, Matador compris.`, 'comparison', CMP('USO').p, 'Rendements simples sur vingt et une séances.', [['comparison', CMP('XOP').p]]),
    M(`La corrélation avec KMI et WMB est faible (${fr(R_('KMI').correlation, 2)} et ${fr(R_('WMB').correlation, 2)}) malgré un lien économique réel via le transport du gaz.`, 'comparison', CMP('KMI').p, REGM, [['comparison', CMP('WMB').p], ['bars', B]]),
  ],
  missingData: [
    'Prix de Ridge Runner non publié.',
    'Multiples des comparables issus d’un instantané du fournisseur, sans période comptable datée.',
    'Aucune clôture de comparable antérieure à janvier dans la fenêtre collectée : pas de performance annuelle des pairs.',
  ],
  sourceRefs: [srcMarket('Barres des comparables alignées (provenance hashée)'), srcDoc(7, 'Matador — 10-K 2025, acheteurs documentés')],
};

a.disclaimer = 'Analyse pédagogique fondée sur des données publiques et des dépôts réglementaires. Ce n’est pas un conseil en investissement ; un scénario conditionnel n’est pas un ordre et peut ne jamais se déclencher.';

// ---------------------------------------------------------------- matérialisation
const claims = {}, methods = {}, strings = {}, bad = [];
function mat(v, p = '') {
  if (v && v.__m) { claims[p] = v.prov; methods[p] = v.prov.method; if (typeof v.value === 'string' && /\d/.test(v.value)) strings[p] = v.value; return v.value; }
  if (Array.isArray(v)) return v.map((x, i) => mat(x, p ? `${p}.${i}` : String(i)));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mat(x, p ? `${p}.${k}` : k)]));
  if (typeof v === 'number') { bad.push('N ' + p); return v; }
  if (typeof v === 'string' && /\d/.test(v)) {
    const di = docs.findIndex(d => d.url === v);
    if (di >= 0) { claims[p] = { ...dep('primary', PD(di) + '/url'), input_name: 'primary', method: 'URL EDGAR directe du document haché.' }; methods[p] = claims[p].method; strings[p] = v; return v; }
    if (!/\d/.test(v.replace(LABEL, ''))) { claims[p] = { ...dep('primary', '/inventory'), input_name: 'primary', method: 'Libellé de document ou de période (formulaire, trimestre, année) : pas une mesure.' }; methods[p] = claims[p].method; strings[p] = v; return v; }
    bad.push(p + ' → ' + v.slice(0, 70)); return v;
  }
  return v;
}
const analysis = mat(a);
if (bad.length) { console.error(bad.join('\n')); throw Error(bad.length + ' valeurs sans provenance'); }
const AP = 'data/analyses-data/MTDR.json';
write(AP, analysis);
const aSha = sha(bytes(AP));
const GEN = `${R}/build-mtdr.cjs`;
const calc = {
  kind: 'deterministic_analysis_calculation_v1', ticker: 'MTDR', reference_close: REF, analysis_sha256: aSha,
  generator_path: GEN, generator_sha256: sha(bytes(GEN)), inputs, score_components,
  valuation_scenario, valuation_multi: vm, value_quality_board: vq,
  pro_forma: { debt_floor: proFormaDebt, recourse_debt: recourseDebt, san_mateo_non_recourse_debt: sanMateoDebt, nci: NCI, scenario_price_after_nci: scenarioPriceNci, paloma_per_share: palomaPerShare, scenario_price_after_paloma: proFormaPrice, excluded: 'Ridge Runner (prix non publié)' },
  technical_indicators: { method: TM, ...tech }, sector_share: { window: '2026-09-15..2026-09-23', mtdr: sinceM('2026-09-15'), xop: sinceP('XOP', '2026-09-15'), peers: Object.fromEntries(DIRECT.map(t => [t, sinceP(t, '2026-09-15')])), peer_median: peerMedianSince, share_vs_xop_pct: shareXop, share_vs_peers_pct: sharePeers }, retail: { ceiling, vol20, usd20, sizeShares, risk_per_share: riskU },
  trade_geometry: { entry, stop, tp1, tp2, rr1, rr2 },
  values: analysis, string_numeric_claims: strings, claim_provenance: claims, methods,
  limitations: ['Comptes fournisseur non datés.', 'Barres de secours Tiingo (géométrie Yahoo invalide au 15 septembre) ; indicateurs recalculés sur ces barres.', 'valuation-multi : aucune méthode calculable, aucune valeur fabriquée.'],
};
write(`${R}/calculations.json`, calc);
const cSha = sha(bytes(`${R}/calculations.json`));
const get = (o, p) => p.split('.').reduce((x, k) => x?.[k], o);
write('data/analyses-evidence/MTDR.json', {
  ticker: 'MTDR', reference_close: REF, analysis_path: AP, analysis_sha256: aSha,
  claims: Object.keys(claims).map(p => ({ path: p, value: get(analysis, p), as_of: REF, source_artifact: `${R}/calculations.json`, source_sha256: cSha, source_pointer: typeof get(analysis, p) === 'number' ? '/values/' + p.split('.').map(esc).join('/') : '/string_numeric_claims/' + esc(p) })),
});
console.log(`MTDR : ${Object.keys(claims).length} valeurs liées ; score ${score} ; R/R ${rr1.toFixed(2)} / ${rr2.toFixed(2)} ; scénario ${valuation_scenario.price.toFixed(2)} ; médiane ${median.toFixed(4)}`);
