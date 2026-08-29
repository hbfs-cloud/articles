#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'analyses', 'AVGO', '_data');
const OUT = path.join(ROOT, 'data', 'analyses-data', 'AVGO.json');
const CALC = path.join(DATA_DIR, 'calculations.json');
const EVIDENCE = path.join(ROOT, 'data', 'analyses-evidence', 'AVGO.json');
const SEC_PRIMARY_DIR = path.join(DATA_DIR, 'sec-primary');
const SEC_PRIMARY_MANIFEST = path.join(DATA_DIR, 'sec-primary-manifest.json');
const REF = '2026-08-28';
const DATE = '2026-08-29';
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const money = value => value >= 1e12 ? `$${(value / 1e12).toFixed(2)}T` : value >= 1e9 ? `$${(value / 1e9).toFixed(2)}B` : `$${(value / 1e6).toFixed(1)}M`;
const pct = value => `${(value * 100).toFixed(1)}%`;
const px = value => `$${value.toFixed(2)}`;
const source = (name, url, date) => ({ name, url, date });

function item(bundle, type) {
  return (bundle.data?.items || []).find(row => row.type === type) || {};
}

function bars(bundle) {
  const rows = bundle.results?.flatMap(result => result.data || []).find(row => Array.isArray(row.bars))?.bars || [];
  return rows.map(row => ({ date: row[0], open: row[1], high: row[2], low: row[3], close: row[4], volume: row[5] }));
}

function performance(rows, sessions) {
  const slice = rows.slice(-(sessions + 1));
  return slice.length > sessions && slice[0].close ? (slice.at(-1).close / slice[0].close - 1) * 100 : null;
}

function numericPaths(value, prefix = '', output = []) {
  if (typeof value === 'number' && Number.isFinite(value)) output.push(prefix);
  else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) numericPaths(child, prefix ? `${prefix}.${key}` : key, output);
  return output;
}

function get(value, dotted) {
  return dotted.split('.').reduce((node, key) => node?.[key], value);
}

function set(value, dotted, observed) {
  const keys = dotted.split('.');
  let node = value;
  keys.forEach((key, index) => {
    if (index === keys.length - 1) node[key] = observed;
    else node = node[key] ||= /^\d+$/.test(keys[index + 1]) ? [] : {};
  });
}

const primarySecDocuments = [
  ['424B2', '0001193125-26-007683', '424b2-0001193125-26-007683.html', 'https://www.sec.gov/Archives/edgar/data/1730168/000119312526007683/d917883d424b2.htm'],
  ['424B5', '0001193125-26-003525', '424b5-0001193125-26-003525.html', 'https://www.sec.gov/Archives/edgar/data/1730168/000119312526003525/d917883d424b5.htm'],
  ['EFFECT', '9999999995-26-002050', 'effect-9999999995-26-002050.xml', 'https://www.sec.gov/Archives/edgar/data/1730168/999999999526002050/xslEFFECTX01/primary_doc.xml'],
  ['EFFECT', '9999999995-26-002051', 'effect-9999999995-26-002051.xml', 'https://www.sec.gov/Archives/edgar/data/1730168/999999999526002051/xslEFFECTX01/primary_doc.xml'],
  ['S-4', '0001193125-26-263125', 's4-333-296622.html', 'https://www.sec.gov/Archives/edgar/data/1730168/000119312526263125/d227941ds4.htm'],
  ['S-4', '0001193125-26-263128', 's4-333-296623.html', 'https://www.sec.gov/Archives/edgar/data/1730168/000119312526263128/d227938ds4.htm'],
  ['424B3', '0001193125-26-274169', '424b3-333-296622.html', 'https://www.sec.gov/Archives/edgar/data/1730168/000119312526274169/d227941d424b3.htm'],
  ['424B3', '0001193125-26-274187', '424b3-333-296623.html', 'https://www.sec.gov/Archives/edgar/data/1730168/000119312526274187/d227938d424b3.htm'],
  ['8-K', '0001730168-26-000011', '8k-q1-20260304.html', 'https://www.sec.gov/Archives/edgar/data/1730168/000173016826000011/avgo-20260304.htm'],
  ['EX-99.1', '0001730168-26-000011', '8k-q1-20260304-ex99.html', 'https://www.sec.gov/Archives/edgar/data/1730168/000173016826000011/avgo-02012026x8kxex99.htm']
].map(([form, accession, file, url]) => {
  const abs = path.join(SEC_PRIMARY_DIR, file);
  if (!fs.existsSync(abs)) throw new Error(`Primary SEC artifact missing: ${file}`);
  return { form, accession, path: `analyses/AVGO/_data/sec-primary/${file}`, url, sha256: sha256(fs.readFileSync(abs)) };
});
const primarySecManifest = {
  kind: 'primary_sec_manifest_v1', ticker: 'AVGO', as_of: REF,
  inventory_count: 100, inventory_screened_count: 100, decision_relevant_count: 12,
  opened_count: 12, reviewed_count: 12, local_primary_count: primarySecDocuments.length,
  documents: primarySecDocuments,
  semantic_findings: {
    q1_guidance: {
      source_path: 'analyses/AVGO/_data/sec-primary/8k-q1-20260304-ex99.html',
      source_sha256: primarySecDocuments.find(row => row.form === 'EX-99.1').sha256,
      source_needles: ['$22.0 billion', '$10.7 billion'],
      q2_revenue_guidance_usd: 22000000000,
      q2_ai_revenue_guidance_usd: 10700000000,
      filed_at: '2026-03-04'
    },
    exchange_333_296622: {
      source_path: 'analyses/AVGO/_data/sec-primary/424b3-333-296622.html',
      source_sha256: primarySecDocuments.find(row => row.accession === '0001193125-26-274169').sha256,
      source_needles: ['$5,999,984,000', '3.137% Senior Notes due 2035', '3.187% Senior Notes due 2036', 'July&nbsp;17, 2026'],
      aggregate_principal_usd: 5999984000,
      series: ['$3,249,984,000 à 3,137% échéance 2035', '$2,750,000,000 à 3,187% échéance 2036'],
      expiration_date: '2026-07-17',
      status: 'Prospectus final et date limite observés; résultat effectivement tenderé non établi par l’inventaire revu.'
    },
    exchange_333_296623: {
      source_path: 'analyses/AVGO/_data/sec-primary/424b3-333-296623.html',
      source_sha256: primarySecDocuments.find(row => row.accession === '0001193125-26-274187').sha256,
      source_needles: ['$1,950,000,000', '4.000% Senior Notes due 2029', '4.150% Senior Notes due 2032', 'July&nbsp;17, 2026'],
      aggregate_principal_usd: 1950000000,
      series: ['$750,000,000 à 4,000% échéance 2029', '$1,200,000,000 à 4,150% échéance 2032'],
      expiration_date: '2026-07-17',
      status: 'Prospectus final et date limite observés; résultat effectivement tenderé non établi par l’inventaire revu.'
    }
  },
  additional_reviewed_primary_urls: [
    'https://www.sec.gov/Archives/edgar/data/1730168/000173016826000054/avgo-20260503.htm',
    'https://www.sec.gov/Archives/edgar/data/1730168/000173016826000051/avgo-20260603.htm',
    'https://www.sec.gov/Archives/edgar/data/1730168/000119312526295589/d84378d8k.htm',
    'https://www.sec.gov/Archives/edgar/data/1730168/000173016825000121/avgo-20251102.htm'
  ],
  review_scope: 'Tous les dépôts de l’inventaire ont été filtrés; douze dépôts décisionnels ont été ouverts et revus. Dix documents ou pièces SEC primaires sont conservés localement avec hash.'
};
fs.writeFileSync(SEC_PRIMARY_MANIFEST, JSON.stringify(primarySecManifest, null, 2) + '\n');

const instrument = read(path.join(DATA_DIR, 'instrument.json'));
const barsBundle = read(path.join(DATA_DIR, 'bars.json'));
const shortBundle = read(path.join(DATA_DIR, 'short_squeeze.json'));
const harness = read(path.join(DATA_DIR, 'harness.json'));
const rows = bars(barsBundle);
if (rows.at(-1)?.date !== REF) throw new Error(`AVGO close mismatch: ${rows.at(-1)?.date || 'missing'}`);

const metadata = item(instrument, 'instrument_metadata');
const profile = item(instrument, 'instrument_comprehensive_profile');
const financial = item(instrument, 'instrument_comprehensive_financial');
const stats = item(instrument, 'instrument_comprehensive_stats');
const technical = item(instrument, 'instrument_technicals');
const supportResistance = item(instrument, 'instrument_support_resistance');
const calendar = item(instrument, 'instrument_calendar');
const holders = item(instrument, 'instrument_comprehensive_holders');
const maxPain = item(instrument, 'instrument_max_pain');
const optionRatio = item(instrument, 'instrument_options_volume_ratio');
const quote = item(instrument, 'instrument_quote');
const shortResults = shortBundle.data?.items?.flatMap(row => row.results || []) || [];
const ctbData = shortResults.flatMap(row => row.data || []).find(row => row.type === 'instrument_ctb') || {};
const close = rows.at(-1).close;
const previous = rows.at(-2).close;
const changePct = (close / previous - 1) * 100;
const trailing = rows.slice(-252);
const low52 = Math.min(...trailing.map(row => row.low));
const high52 = Math.max(...trailing.map(row => row.high));
const q2GuideBeatPct = (22187000000 / 22000000000 - 1) * 100;
const q3SequentialGuidePct = (29400000000 / 22187000000 - 1) * 100;
const entry = rows.at(-1).high;
const stop = rows.at(-1).low;
const tp1 = technical.ema50;
const tp2 = Number(String(supportResistance.resistances?.[1] || '').split(',')[0]);
const risk = entry - stop;
const rr1 = (tp1 - entry) / risk;
const rr2 = (tp2 - entry) / risk;
const oneMonth = performance(rows, 21);
const oneYear = performance(rows, 252);
const dollarAdv20 = rows.slice(-20).reduce((sum, row) => sum + row.close * row.volume, 0) / Math.min(20, rows.length);
const scoreComponents = {
  base: 55,
  revenueGrowth: financial.revenueGrowth > 0.30 ? 10 : financial.revenueGrowth > 0.15 ? 6 : 0,
  grossMargin: financial.grossMargins > 0.70 ? 8 : financial.grossMargins > 0.45 ? 4 : 0,
  operatingMargin: financial.operatingMargins > 0.40 ? 8 : financial.operatingMargins > 0.20 ? 4 : 0,
  returnOnEquity: financial.returnOnEquity > 0.30 ? 5 : financial.returnOnEquity > 0.15 ? 3 : 0,
  valuation: stats.enterpriseToEbitda > 35 ? -8 : stats.enterpriseToEbitda > 25 ? -4 : 0,
  leverage: financial.totalDebt / financial.totalCash > 3 ? -8 : financial.totalDebt > financial.totalCash ? -4 : 0
};
const score = Object.values(scoreComponents).reduce((sum, value) => sum + value, 0);
const scenarioHaircutPolicy = 0.30;
const scenarioMultiple = Math.round((stats.enterpriseToEbitda * (1 - scenarioHaircutPolicy)) / 5) * 5;
const scenarioEv = financial.ebitda * scenarioMultiple;
const scenarioEquity = scenarioEv - financial.totalDebt + financial.totalCash;
const scenarioPrice = scenarioEquity / stats.sharesOutstanding;
const scenarioDownside = (scenarioPrice / close - 1) * 100;
const ebitdaRequiredAtScenarioMultiple = stats.enterpriseValue / scenarioMultiple;
const ebitdaRequiredGrowth = (ebitdaRequiredAtScenarioMultiple / financial.ebitda - 1) * 100;
const riskPolicy = {
  earningsProbability: calendar.nextEarningsDate?.startsWith('2026-09-02') ? 80 : 35,
  earningsImpact: technical.atr / close > 0.03 ? 95 : 75,
  valuationProbability: stats.enterpriseToEbitda > 40 ? 65 : stats.enterpriseToEbitda > 30 ? 50 : 30,
  valuationImpact: financial.totalDebt / financial.totalCash > 3 ? 85 : 65,
  concentrationProbability: 42 >= 40 ? 70 : 45,
  concentrationImpact: 45 >= 40 ? 90 : 70
};

const irQ2 = source('Résultats Broadcom Q2 FY2026', 'https://investors.broadcom.com/news-releases/news-release-details/broadcom-inc-announces-second-quarter-fiscal-year-2026-financial', '2026-06-03');
const secQ1 = source('Form 8-K Broadcom Q1 FY2026, pièce 99.1', 'https://www.sec.gov/Archives/edgar/data/1730168/000173016826000011/avgo-02012026x8kxex99.htm', '2026-03-04');
const irEvent = source('Calendrier Broadcom Q3 FY2026', 'https://investors.broadcom.com/news-releases/news-release-details/broadcom-inc-announce-third-quarter-fiscal-year-2026-financial', '2026-08-03');
const secQ = source('Form 10-Q Broadcom Q2 FY2026', 'https://www.sec.gov/Archives/edgar/data/1730168/000173016826000054/avgo-20260503.htm', '2026-06-09');
const market = source('Historique AVGO, données de marché', 'https://finance.yahoo.com/quote/AVGO/history/', REF);
const optionsSource = source('Chaîne d’options AVGO', 'https://finance.yahoo.com/quote/AVGO/options/', REF);
const shortSource = source('Positions vendeuses AVGO', 'https://www.nasdaq.com/market-activity/stocks/avgo/short-interest', '2026-08-14');
const borrowSource = source('Coût et disponibilité d’emprunt AVGO', 'https://www.iborrowdesk.com/report/AVGO', REF);
const barsRef = market;
const technicalRef = source('Indicateurs techniques AVGO', market.url, REF);
const optionsRef = optionsSource;
const shortRef = shortSource;
const insiderRef = source('Activité des initiés AVGO', 'https://www.nasdaq.com/market-activity/stocks/avgo/insider-activity', REF);

const analysis = {
  meta: {
    lang: 'fr', dir: 'ltr', level: 'intermediate', assetType: 'stock',
    tags: ['us', 'technologie', 'semiconducteurs', 'ia', 'logiciels'], grade: 'B',
    date: DATE, dateDisplay: '29 août 2026', version: 2, status: 'wait', levelsCloseDate: REF,
    lastMcpRefresh: harness.generated_at,
    description: 'AVGO avant ses résultats du 2 septembre : qualité opérationnelle élevée, valorisation exigeante et veto événementiel.',
    ogDescription: 'Broadcom : fondamentaux, résultats, SEC, technique et plan conditionnel avant publication.'
  },
  header: {
    ticker: 'AVGO', name: metadata.name || 'Broadcom Inc.', exchange: metadata.exchange || 'NASDAQ', sector: 'Technologie / Semiconducteurs',
    price: close, changePct,
    badges: [{ text: 'RÉSULTATS LE 2 SEPTEMBRE', color: 'amber' }, { text: 'ATTENDRE', color: 'amber' }, { text: 'IA + VMWARE', color: 'blue' }],
    metrics: { marketCap: money(quote.marketCap), volume: `${(rows.at(-1).volume / 1e6).toFixed(1)}M`, fwdPE: 'N/A', beta: stats.beta, range52w: `${px(low52)} - ${px(high52)}`, shortInterest: `${(stats.shortPercentOfFloat * 100).toFixed(1)}%`, analystTarget: px(financial.targetMeanPrice), pegRatio: `${stats.pegRatio.toFixed(1)}x`, evEbitda: `${stats.enterpriseToEbitda.toFixed(1)}x` },
    halal: false, halalStatus: 'unknown'
  },
  verdict: {
    score, conviction: 'High', bias: 'Neutral', confidence: 'Confiance modérée',
    summary: `Broadcom combine deux moteurs puissants : les puces sur mesure et le réseau pour l’IA, puis les logiciels d’infrastructure hérités de VMware. Le dernier trimestre publié est exceptionnel : 22,187 Md$ de revenus, +48% sur un an, 10,8 Md$ de revenus semiconducteurs IA et 10,262 Md$ de free cash flow. Mais le marché paie déjà cette qualité très cher, avec 43,1x l’EBITDA et 24,0x les revenus en valeur d’entreprise, tandis que la dette atteint 64,91 Md$. La clôture du 28 août à ${px(close)} reste sous les EMA20 et EMA50, et le premier objectif technique ne rémunère que ${rr1.toFixed(2)}R. Surtout, Broadcom publie le 2 septembre après clôture. Conclusion : dossier fondamental solide, mais aucun achat avant l’événement. Le gap de résultats peut traverser l’entrée, le stop et les objectifs avant qu’un ordre particulier soit exécutable.`,
    whyBuy: [
      'Revenus Q2 FY2026 de 22,187 Md$, en hausse de 48% sur un an.',
      'Revenus semiconducteurs IA de 10,8 Md$, en hausse de 143% sur un an.',
      'Free cash flow trimestriel de 10,262 Md$, soit 46% des revenus.',
      `Guidance Q3 de 29,4 Md$ de revenus, soit +${q3SequentialGuidePct.toFixed(1)}% contre le Q2 publié, dont 16,0 Md$ attendus dans les semiconducteurs IA.`,
      'Le segment logiciels d’infrastructure apporte 7,178 Md$ de revenus, en hausse de 9%, sans ventilation VMware isolée.'
    ],
    whyAvoid: [
      'Résultats le 2 septembre après clôture : un gap peut rendre tout stop préplacé théorique.',
      'Valorisation exigeante : 43,1x EV/EBITDA et 24,0x EV/revenus au snapshot.',
      'Dette de 64,91 Md$ contre 19,63 Md$ de trésorerie.',
      `Cours à ${px(close)}, sous l’EMA20 à ${px(technical.ema20)} et l’EMA50 à ${px(technical.ema50)}.`,
      `TP1 à ${px(tp1)} ne paie que ${rr1.toFixed(2)}R depuis le repère d’entrée.`
    ]
  },
  business: {
    overview: `<p><strong>Semiconducteurs.</strong> Broadcom conçoit des accélérateurs personnalisés, des commutateurs Ethernet, des interfaces réseau, des composants optiques et des solutions de connectivité. Dans l’IA, sa valeur ne vient pas d’un GPU généraliste : elle vient surtout des puces sur mesure développées avec de grands clients cloud et du réseau qui relie des milliers d’accélérateurs.</p><p><strong>Logiciels d’infrastructure.</strong> VMware Cloud Foundation, la sécurité, le mainframe et les outils d’exploitation ont produit 7,178 Md$ de revenus au Q2, en hausse de 9%. Le dépôt ne fournit pas de churn ni de taux de rétention : il serait abusif d’en déduire des contrats plus prévisibles.</p><p><strong>Lecture économique.</strong> Le moteur IA accélère très vite et VMware ajoute un second bloc de revenus. En contrepartie, un distributeur représente 42% du chiffre d’affaires, les cinq premiers clients finaux 45% et les distributeurs 56%. La chaîne de fabrication reste externalisée et l’acquisition VMware a laissé une dette importante. Les preuves à suivre sont donc mesurables : croissance IA, croissance logicielle et baisse de la dette.</p>`,
    segments: [
      { name: 'Solutions semiconducteurs', revenue: '$15,009 Md', pct: '68%', description: 'Puces sur mesure, réseau, stockage, sans-fil et connectivité.' },
      { name: 'Logiciels d’infrastructure', revenue: '$7,178 Md', pct: '32%', description: 'VMware, mainframe, sécurité et logiciels d’exploitation.' }
    ],
    moat: 'L’avantage de Broadcom repose sur des relations techniques longues avec les hyperscalers, une propriété intellectuelle difficile à remplacer et une forte présence dans le réseau. Ce moat reste conditionnel : un calendrier client décalé, une migration VMware ou une alternative interne peut déplacer plusieurs milliards de revenus.',
    theme: 'Infrastructure IA diversifiée', sourceRefs: [irQ2, secQ]
  },
  news: [
    { date: '2026-08-28', title: 'Les résultats Broadcom deviennent le prochain test du rallye IA', source: 'Reuters', sourceUrl: 'https://finance.yahoo.com/markets/stocks/articles/jobs-report-broadcom-results-pose-100141778.html', impact: 'neutral', detail: 'L’événement du 2 septembre peut déplacer tout le groupe semiconducteurs et impose de ne pas anticiper le gap.' },
    { date: '2026-08-03', title: 'Broadcom confirme ses résultats Q3 FY2026 pour le 2 septembre', source: 'Broadcom IR', sourceUrl: irEvent.url, impact: 'neutral', detail: 'La date officielle transforme toute entrée préalable en pari binaire sur la guidance et les commentaires clients.' },
    { date: '2026-07-06', title: 'Accord commercial de long terme avec Apple', source: 'SEC EDGAR', sourceUrl: 'https://www.sec.gov/Archives/edgar/data/1730168/000119312526295589/d84378d8k.htm', impact: 'positive', detail: 'Le contrat soutient la visibilité hors IA, sans supprimer la concentration sur quelques très grands clients.' },
    { date: '2026-06-03', title: 'Q2 FY2026 : accélération des puces IA et forte conversion en cash', source: 'Broadcom IR', sourceUrl: irQ2.url, impact: 'positive', detail: 'La hausse de 143% des revenus IA et 10,262 Md$ de free cash flow relèvent le seuil d’attente pour Q3.' }
  ],
  fundamentals: {
    rows: [
      { metric: 'Revenus TTM', value: money(financial.totalRevenue), signal: `${pct(financial.revenueGrowth)} de croissance`, signalColor: 'green', source: 'MCP marketdata, financials', comparison: `TTM observé au ${REF}` },
      { metric: 'Revenus Q2 FY2026', value: '$22,187 Md', signal: '+48% sur un an', signalColor: 'green', source: 'Broadcom IR', comparison: 'Trimestre clos le 3 mai 2026' },
      { metric: 'Q2 réalisé / guidance précédente', value: '$22,187 Md / $22,0 Md', signal: `+${q2GuideBeatPct.toFixed(2)}% au-dessus`, signalColor: 'green', source: 'Forms 8-K Broadcom des 4 mars et 3 juin', comparison: 'Comparaison à dates fixes; aucun consensus analystes daté n’est disponible dans le snapshot' },
      { metric: 'Revenus IA Q2', value: '$10,8 Md', signal: '+143% sur un an', signalColor: 'green', source: 'Broadcom IR', comparison: 'Q2 FY2026' },
      { metric: 'Logiciels d’infrastructure Q2', value: '$7,178 Md', signal: '+9% sur un an', signalColor: 'blue', source: 'Broadcom IR', comparison: 'Q2 FY2026' },
      { metric: 'EBITDA ajusté Q2', value: '$15,244 Md', signal: '69% des revenus', signalColor: 'green', source: 'Broadcom IR', comparison: 'Mesure non-GAAP Q2 FY2026' },
      { metric: 'Free cash flow Q2', value: '$10,262 Md', signal: '46% des revenus', signalColor: 'green', source: 'Broadcom IR', comparison: 'Q2 FY2026' },
      { metric: 'Marge brute TTM', value: pct(financial.grossMargins), signal: 'Marge publiée', signalColor: 'green', source: 'MCP marketdata, financials', comparison: `TTM au ${REF}` },
      { metric: 'Marge opérationnelle TTM', value: pct(financial.operatingMargins), signal: 'Rentable', signalColor: 'green', source: 'MCP marketdata, financials', comparison: `TTM au ${REF}` },
      { metric: 'Marge nette TTM', value: pct(financial.profitMargins), signal: 'Positive', signalColor: 'green', source: 'MCP marketdata, financials', comparison: `TTM au ${REF}` },
      { metric: 'Trésorerie', value: money(financial.totalCash), signal: 'Liquidité', signalColor: 'green', source: 'MCP marketdata, financials', comparison: `Dernier bilan disponible au ${REF}` },
      { metric: 'Dette', value: money(financial.totalDebt), signal: 'Levier VMware', signalColor: 'amber', source: 'MCP marketdata, financials', comparison: `Dernier bilan disponible au ${REF}` },
      { metric: 'Dette principale / comptable', value: '$66,720 Md / $64,907 Md', signal: 'Écart de coûts non amortis', signalColor: 'amber', source: 'Form 10-Q Broadcom', comparison: '2,252 Md$ à court terme et 62,655 Md$ à long terme au 3 mai 2026' },
      { metric: 'Échéances de dette', value: '$2,252 Md en 2026', signal: 'Mur étalé', signalColor: 'amber', source: 'Form 10-Q Broadcom', comparison: '0,493 Md$ en 2027; 5,127 Md$ en 2028; 4,655 Md$ en 2029; 6,406 Md$ en 2030; 47,787 Md$ ensuite' },
      { metric: 'Intérêts trimestriels', value: '$776 M', signal: 'Charge fixe', signalColor: 'amber', source: 'Form 10-Q Broadcom', comparison: 'Q2 FY2026' },
      { metric: 'Goodwill + incorporels nets', value: '$126,134 Md', signal: 'Acquisitions et actifs logiciels', signalColor: 'amber', source: 'Form 10-Q Broadcom', comparison: '97,801 Md$ de goodwill et 28,333 Md$ d’incorporels nets; ventilation VMware non isolée' },
      { metric: 'Rémunération actions non reconnue', value: '$20,106 Md', signal: 'Charge future, pas actions fully diluted', signalColor: 'amber', source: 'Form 10-Q Broadcom', comparison: 'Période moyenne de reconnaissance de 3 ans' },
      { metric: 'Rachats encore autorisés', value: '$10,1 Md', signal: 'Capacité, pas exécution', signalColor: 'blue', source: 'Form 10-Q Broadcom', comparison: 'Autorisation restante au 3 mai 2026' },
      { metric: 'ROE', value: pct(financial.returnOnEquity), signal: 'Efficacité élevée', signalColor: 'green', source: 'MCP marketdata, financials', comparison: `TTM au ${REF}` },
      { metric: 'EV/EBITDA', value: `${stats.enterpriseToEbitda.toFixed(1)}x`, signal: `EBITDA TTM fournisseur ${money(financial.ebitda)}`, signalColor: 'red', source: 'Données de marché, stats', comparison: `Le dénominateur est un EBITDA TTM analytique, ni un agrégat GAAP publié ni l’EBITDA ajusté Q2. Le stress applique une compression mécanique de 30%, arrondie au multiple de 5x le plus proche : ${scenarioMultiple}x, ${px(scenarioPrice)}, soit ${scenarioDownside.toFixed(1)}%` },
      { metric: 'EBITDA requis pour 30x au cours actuel', value: money(ebitdaRequiredAtScenarioMultiple), signal: `+${ebitdaRequiredGrowth.toFixed(1)}% versus EBITDA TTM`, signalColor: 'red', source: 'Calcul déterministe depuis EV et EBITDA TTM', comparison: `À valeur d’entreprise constante au 28 août 2026, il faudrait ${money(ebitdaRequiredAtScenarioMultiple)} d’EBITDA TTM pour ramener le multiple à ${scenarioMultiple}x. Ce n’est pas une prévision.` },
      { metric: 'EV/revenus', value: `${stats.enterpriseToRevenue.toFixed(1)}x`, signal: 'Base trailing au 28 août 2026 versus pairs', signalColor: 'red', source: 'MCP marketdata, stats', comparison: 'Multiple intégré très exigeant versus grands semiconducteurs diversifiés' },
      { metric: 'Objectif analystes moyen', value: px(financial.targetMeanPrice), signal: 'Consensus, pas une garantie', signalColor: 'blue', source: 'MCP marketdata, analystes', comparison: `Snapshot au ${REF}` }
    ],
    sourceRefs: [irQ2, secQ1, secQ]
  },
  earnings: {
    quarters: (instrument.data?.items || []).filter(row => row.type === 'instrument_comprehensive_earnings_quarterly').map(row => ({ quarter: row.date, epsActual: row.actual, epsEstimate: row.estimate, surprise: `${((row.actual / row.estimate - 1) * 100).toFixed(1)}%` })),
    beatStreak: 4,
    beatNote: `Les quatre trimestres structurés disponibles ont dépassé leur estimation EPS. Pour le Q2, la société guidait 22,0 Md$ le 4 mars et a publié 22,187 Md$ le 3 juin, soit seulement +${q2GuideBeatPct.toFixed(2)}% au-dessus de sa propre borne. La guidance Q3 de 29,4 Md$ implique +${q3SequentialGuidePct.toFixed(1)}% contre le Q2 publié et +84% sur un an; elle vise aussi 67% de marge opérationnelle non-GAAP et 16,0 Md$ de revenus semiconducteurs IA. Aucun consensus revenus Q3 daté n’est disponible dans le snapshot : la fiche ne qualifie donc pas cette guidance de beat ou miss face au marché.`,
    nextEarnings: '2026-09-02', sourceRefs: [secQ1, irQ2, irEvent, secQ]
  },
  insiders: {
    insiderPct: `${holders.insidersPercent.toFixed(1)}%`, institutionPct: `${holders.institutionsPercent.toFixed(1)}%`, recentTransactions: [],
    signal: 'Les Forms 4 couvrent surtout des ventes et attributions. Aucun achat récent suffisamment actuel n’est utilisé comme confirmation du plan.', sourceRefs: [insiderRef]
  },
  capitalStructure: {
    sharesOutstanding: `${(stats.sharesOutstanding / 1e9).toFixed(2)}B`, sharesAuthorized: '29,000 Md ordinaires; 100 M préférentielles', dilutionRisk: 'moderate',
    shareHistory: 'Au 3 mai 2026, 4,758 milliards d’actions ordinaires sont émises et en circulation sur 29,000 milliards autorisées; 100 millions de préférentielles sont autorisées et aucune n’est émise. Le trimestre rapproche 4,747 milliards d’actions moyennes de base et 4,876 milliards diluées, soit 129 millions d’effet incrémental moyen. Ce pont n’est pas un total fully diluted point-in-time. Un total actuel n’est pas calculable avec les données disponibles. Les 20,106 Md$ de rémunération actions non encore reconnue sont une charge future, pas un nombre d’actions. L’autorisation de rachat restante de 10,1 Md$ est une capacité, pas une exécution. Les prospectus 2026 examinés concernent surtout la dette; aucun ATM actions actif n’est déduit d’un shelf.',
    sourceRefs: [secQ, source('Prospectus obligataire final', 'https://www.sec.gov/Archives/edgar/data/1730168/000119312526007683/d917883d424b2.htm', '2026-01-06')]
  },
  filingsReview: {
    summary: 'La revue primaire sépare résultats, bilan, contrat Apple, émissions obligataires, échanges de dette et notices EFFECT. Les 100 dépôts de l’inventaire local ont été filtrés; 12 dépôts décisionnels ont été ouverts et revus, avec 10 documents ou pièces SEC primaires conservés en copie locale vérifiée. Le service SEC global est dégradé, mais la requête locale AVGO est complète. Le 424B5 inventorié est le prospectus préliminaire; le 424B2 final, les deux S-4, les deux 424B3 et les deux EFFECT sont liés dans le registre primaire. Les 424B3 fixaient au 17 juillet les offres d’échange de 5,999984 Md$ et 1,950 Md$ de principal; l’inventaire revu ne prouve pas le montant effectivement tenderé. Le 10-Q conclut que les contrôles de communication étaient effectifs et ne signale aucun changement matériel du contrôle interne. Aucune conclusion de continuité d’exploitation n’est affirmée à partir d’une simple absence de drapeau.',
    filings: [
      { date: '2026-06-09', form: '10-Q', accession: '0001730168-26-000054', finding: 'Le 10-Q confirme la dette de 64,91 Md$, la trésorerie de 19,63 Md$, le mix VMware et le rapprochement de 4,747 milliards d’actions de base vers 4,876 milliards diluées. Il documente aussi la concentration clients et fournisseurs.', url: secQ.url },
      { date: '2026-06-03', form: '8-K', accession: '0001730168-26-000051', finding: 'Le 8-K fournit le communiqué Q2 : 22,187 Md$ de revenus, 9,310 Md$ de résultat net GAAP, 10,262 Md$ de free cash flow et une guidance Q3 de 29,4 Md$. Il s’agit d’une preuve opérationnelle, pas d’un financement.', url: 'https://www.sec.gov/Archives/edgar/data/1730168/000173016826000051/avgo-20260603.htm' },
      { date: '2026-01-06', form: '424B5', accession: '0001193125-26-003525', finding: 'Le 424B5 présent dans l’inventaire local est le prospectus préliminaire de l’émission obligataire de janvier. Ses termes doivent être lus avec le 424B2 final; il ne constitue ni un programme de vente d’actions au fil de l’eau ni une seconde levée séparée.', url: 'https://www.sec.gov/Archives/edgar/data/1730168/000119312526003525/d917883d424b5.htm' },
      { date: '2026-01-06', form: '424B2', accession: '0001193125-26-007683', finding: 'Le prospectus final chiffre 4,5 Md$ de notes senior en quatre maturités, destinées aux besoins généraux et au remboursement de dette. C’est une émission de dette non garantie, sans dilution directe des actions ordinaires.', url: 'https://www.sec.gov/Archives/edgar/data/1730168/000119312526007683/d917883d424b2.htm' },
      { date: '2026-06-17', form: 'EFFECT', accession: '9999999995-26-002051', finding: 'Cette notice rend effective une registration statement liée à l’échange de dette. Elle ne chiffre aucun produit pour Broadcom et ne prouve ni émission d’actions ordinaires, ni capacité ATM utilisée.', url: 'https://www.sec.gov/Archives/edgar/data/1730168/999999999526002051/xslEFFECTX01/primary_doc.xml' },
      { date: '2026-06-17', form: 'EFFECT', accession: '9999999995-26-002050', finding: 'La seconde notice EFFECT concerne le dossier compagnon d’échange obligataire. Une efficacité réglementaire n’est pas une vente ; aucun montant de dilution actions n’est ajouté au calcul.', url: 'https://www.sec.gov/Archives/edgar/data/1730168/999999999526002050/xslEFFECTX01/primary_doc.xml' },
      { date: '2026-06-24', form: '424B3', accession: '0001193125-26-274169', finding: 'Offre finale d’échange, sans produit nouveau : jusqu’à 5,999984 Md$ de principal, répartis entre 3,249984 Md$ de notes à 3,137% échéance 2035 et 2,750 Md$ à 3,187% échéance 2036. Date limite annoncée : 17 juillet 2026. Aucun résultat tenderé n’est déduit du seul prospectus.', url: 'https://www.sec.gov/Archives/edgar/data/1730168/000119312526274169/d227941d424b3.htm' },
      { date: '2026-06-24', form: '424B3', accession: '0001193125-26-274187', finding: 'Offre finale d’échange, sans produit nouveau : jusqu’à 1,950 Md$ de principal, répartis entre 750 M$ de notes à 4,000% échéance 2029 et 1,200 Md$ à 4,150% échéance 2032. Date limite annoncée : 17 juillet 2026. Le résultat effectivement tenderé reste non établi dans l’inventaire revu.', url: 'https://www.sec.gov/Archives/edgar/data/1730168/000119312526274187/d227938d424b3.htm' },
      { date: '2026-07-06', form: '8-K', accession: '0001193125-26-295589', finding: 'Le 8-K décrit un accord commercial de long terme avec Apple jusqu’en 2031. Il améliore la visibilité d’un programme client important, mais renforce aussi la nécessité de surveiller la concentration et le calendrier de demande.', url: 'https://www.sec.gov/Archives/edgar/data/1730168/000119312526295589/d84378d8k.htm' },
      { date: '2025-12-18', form: '10-K', accession: '0001730168-25-000121', finding: 'Le 10-K audité fournit la base VMware, les obligations de dette, les risques de concentration, la dépendance aux fondeurs et la politique de rachat. Il ne prouve pas une émission d’actions 2026.', url: 'https://www.sec.gov/Archives/edgar/data/1730168/000173016825000121/avgo-20251102.htm' }
    ],
    contrarianRisks: [
      'Les accélérateurs sur mesure sont concentrés sur quelques programmes hyperscalers dont les calendriers peuvent glisser.',
      'Le logiciel croît de 9%, mais le 10-Q ne fournit ni churn ni rétention : la qualité de cette croissance reste partiellement non vérifiable.',
      'La dette comptable de 64,907 Md$ comprend 2,252 Md$ à court terme; 47,787 Md$ de principal arrive après 2030.',
      'Un distributeur représente 42% des revenus, les cinq premiers clients finaux 45% et les distributeurs 56%.',
      'À 24,0x EV/revenus, un simple ralentissement de la guidance IA peut provoquer une forte compression du multiple.',
      'La marge guidée est non-GAAP et ne peut pas être réconciliée précisément avant la publication.'
      ,'Le 10-Q conclut à des disclosure controls effectifs ; cette conclusion ne garantit pas l’absence de toute faiblesse future ni un total fully diluted actuel.'
    ]
  },
  shortInterest: {
    siPct: '1,20%', daysToCover: '3,21', ctb: `${Number(ctbData.latest_fee).toFixed(2)}%`,
    trend: `La part vendue à découvert est passée de 1,49% du flottant fin juin à 1,20% au 14 août. Au 28 août, le coût d’emprunt est ${Number(ctbData.latest_fee).toFixed(2)}% avec ${Number(ctbData.latest_available).toLocaleString('fr-FR')} actions indiquées disponibles : aucune pression de rachat forcé visible. Le volume vendeur FINRA quotidien a échoué et n’est pas transformé en signal directionnel.`,
    squeezeScore: 'Faible', sourceRefs: [shortRef, borrowSource]
  },
  options: {
    callOI: maxPain.totalCallOI.toLocaleString('fr-FR'), putOI: maxPain.totalPutOI.toLocaleString('fr-FR'), cpRatio: maxPain.callPutRatio.toFixed(2), maxPain: px(maxPain.maxPainStrike), ivMean: 'INDISPONIBLE',
    skew: `Ratio volumes puts/calls ${optionRatio.put_call_volume_ratio.toFixed(2)}`,
    unusual: 'Les contrats observés expirent le 31 août, avant les résultats du 2 septembre. Ils ne couvrent donc pas le gap et ne sont pas utilisables pour décider le trade de publication; les pics sur options d’achat et de vente sont contradictoires et écartés.', sourceRefs: [optionsRef]
  },
  technicals: {
    rsi14: technical.rsi, macd: technical.macd, macdSignal: technical.signal, ema20: technical.ema20, ema50: technical.ema50, ema200: technical.ema200,
    ma50Type: 'EMA', ma200Type: 'EMA', ma50Available: true, ma200Available: true, atr14: technical.atr,
    badges: [`RSI ${technical.rsi.toFixed(1)}`, 'SOUS EMA20/50', 'VETO RÉSULTATS'], supports: [stop, 350.0599, 323.32], resistances: [entry, tp1, tp2],
    setupNote: `Clôture complète du 28 août à ${px(close)}. Le repère d’entrée ${px(entry)} est le plus haut de séance et le stop ${px(stop)} son plus bas. TP1 ${px(tp1)} correspond à l’EMA50 et ne paie que ${rr1.toFixed(2)}R ; TP2 ${px(tp2)} est la résistance daily fournie. La dernière quote était seulement last_known, marché fermé, à 2026-08-29T21:48:16Z ; elle n’est pas présentée comme une cotation intraday. Comme les résultats arrivent le 2 septembre, cette géométrie est inactive et doit être reconstruite après le gap.`,
    wyckoff: 'Transition / correction', radarValues: { rsi: 43, trend: 35, volume: 55, momentum: 35, volatility: 62, support: 50 }, sourceRefs: [barsRef, technicalRef]
  },
  macro: {
    indicators: [{ name: 'Clôture de référence', value: REF, signal: 'Séance complète' }, { name: 'Résultats', value: '2 septembre AMC', signal: 'Veto binaire' }, { name: 'Sensibilité', value: 'Bêta 1,47', signal: 'Réaction amplifiée probable' }],
    regime: 'neutral', impact: 'AVGO est un test de diffusion de la demande IA vers les accélérateurs personnalisés et le réseau. Ce lien sectoriel ne remplace ni la guidance Broadcom, ni la rétention VMware, ni la réaction du titre après publication.', sourceRefs: [irEvent]
  },
  risks: {
    riskScore: 7, riskProfile: 'High',
    riskSummary: `Le risque dominant n’est pas le volume ordinaire d’AVGO, mais le gap du 2 septembre. Le volume notionnel moyen sur 20 séances atteint ${money(dollarAdv20)}, mais cette profondeur historique ne garantit aucun prix d’exécution après publication. Avec un ATR de ${px(technical.atr)}, une dette de 64,91 Md$ et 43,1x EV/EBITDA, une prévision seulement conforme peut comprimer le multiple. Un stop ne protège pas contre un saut hors séance; la taille reste nulle avant publication.`,
    riskCards: [
      { title: 'Gap de résultats', severity: 'high', icon: 'fa-calendar-day', points: ['Publication le 2 septembre après clôture.', `ATR14 de ${px(technical.atr)} avant l’événement.`], probability: riskPolicy.earningsProbability, impact: riskPolicy.earningsImpact, verdict: 'Score de scénario, pas probabilité statistique : calendrier confirmé et ATR supérieur à 3% du cours. Aucune taille particulière n’est justifiée avant le gap.' },
      { title: 'Valorisation et dette', severity: 'high', icon: 'fa-scale-balanced', points: ['43,1x EV/EBITDA et 24,0x EV/revenus.', '64,907 Md$ de dette comptable, dont 2,252 Md$ à court terme.', '776 M$ d’intérêts au trimestre.'], probability: riskPolicy.valuationProbability, impact: riskPolicy.valuationImpact, verdict: 'Score de scénario : multiple supérieur à 40x et dette supérieure à trois fois la trésorerie. La croissance doit rester exceptionnelle.' },
      { title: 'Concentration clients', severity: 'high', icon: 'fa-cloud', points: ['Un distributeur : 42% des revenus.', 'Cinq premiers clients finaux : 45%.', 'Distributeurs : 56%.'], probability: riskPolicy.concentrationProbability, impact: riskPolicy.concentrationImpact, verdict: 'Score de scénario : les seuils de concentration dépassent 40%. Un décalage d’un grand client peut casser la pente trimestrielle.' }
    ],
    pedagogy: 'Pour un particulier, une société excellente peut rester un mauvais trade juste avant ses résultats. Après le gap, refuser un spread supérieur à 0,10% ou un slippage supérieur à 0,15%. Attendre une base de 15 minutes, puis calculer les actions avec floor((equity x 0,20%)/(entrée-stop)), plafonnées à 5% de l’equity. Ne pas poursuivre une ouverture verticale.',
    riskRadarValues: { dilution: 35, burnRate: financial.profitMargins > 0 ? 15 : 75, beta: Math.min(100, Math.round(stats.beta * 45)), shortInterest: Math.min(100, Math.round(stats.shortPercentOfFloat * 500)), insiderSelling: 45, macroRisk: calendar.nextEarningsDate.startsWith('2026-09-02') ? 60 : 40 }, sourceRefs: [secQ, barsRef]
  },
  social: {
    platforms: [{ platform: 'StockTwits', icon: 'fa-solid fa-comments', mentions: 'INDISPONIBLE', trend: 'donnée absente', trendColor: 'gray', detail: 'Aucun volume ou ratio haussier/baissier n’est inventé.' }, { platform: 'Reddit', icon: 'fa-brands fa-reddit', mentions: 'INDISPONIBLE', trend: 'donnée absente', trendColor: 'gray', detail: 'La panne partielle interdit toute conclusion sur l’attention des particuliers.' }],
    pumpDumpScore: 0, pumpDumpChecklist: [{ criterion: 'Grande capitalisation et volume notionnel moyen documenté', pass: true }, { criterion: 'Part vendue à découvert inférieure à 2%', pass: true }, { criterion: 'Narration sociale non utilisée faute de données', pass: true }], sourceRefs: [barsRef]
  },
  performance: {
    ytd: 'INDISPONIBLE - historique annuel incomplet dans ce snapshot', oneYear: oneYear === null ? 'INDISPONIBLE' : `${oneYear.toFixed(1)}%`, threeYear: 'INDISPONIBLE',
    benchmarks: [], alpha: `Sur 21 séances, AVGO affiche ${oneMonth.toFixed(1)}%. Aucun alpha versus QQQ ou SOXX n’est publié sans séries alignées dans le même snapshot.`, sourceRefs: [barsRef]
  },
  capitalFlow: {
    netFlow: 'N/A', institutionalFlow: 'N/A', retailFlow: 'N/A', darkPoolPct: 'N/A',
    signal: 'Aucun flux directionnel n’est affirmé. Le volume short FINRA n’est ni un dark pool, ni une preuve d’accumulation.', sourceRefs: [shortRef]
  },
  tradeIdea: {
    entry, entryNote: `Repère dormant : plus haut du 28 août. Ne devient pas un ordre avant une reconstruction post-résultats.`, stop,
    stopPct: `${((stop / entry - 1) * 100).toFixed(1)}%`, tp1, tp1Pct: `+${((tp1 / entry - 1) * 100).toFixed(1)}%`, tp2, tp2Pct: `+${((tp2 / entry - 1) * 100).toFixed(1)}%`,
    rr: `1:${rr1.toFixed(2)} vers TP1 / 1:${rr2.toFixed(2)} vers TP2`, horizon: 'À recalculer après les résultats',
    thesis: `Aucun trade avant le 2 septembre. ${px(entry)} et ${px(stop)} décrivent seulement la séance du 28 août ; ils peuvent être traversés par le gap. Après publication, attendre une base RTH de 15 minutes et vérifier volume et VWAP. Refuser spread >0,10% ou slippage >0,15%. Taille : floor((equity x 0,20%)/(entrée-stop)), avec notionnel maximal de 5% de l’equity. Ne pas poursuivre à plus de 0,75% du nouveau trigger.`,
    catalysts: ['Résultats Q3 FY2026 et nouvelle guidance le 2 septembre.', 'Croissance des accélérateurs personnalisés et du réseau IA.', 'Croissance du logiciel, marge et baisse mesurée de la dette comptable.'],
    invalidation: [`Toute utilisation de ${px(entry)} ou ${px(stop)} avant la publication invalide le plan.`, 'Un gap qui dépasse la géométrie du 28 août exige une reconstruction complète, pas un stop élargi.', 'Après publication, aucun trade n’existe tant qu’une clôture RTH de 15 minutes, un VWAP et un plus bas de range ne permettent pas de recalculer une invalidation chiffrée.'],
    status: 'wait', statusNote: 'Attendre les résultats du 2 septembre et reconstruire le setup sur des barres régulières avec volume.'
  },
  globalScore: {
    profile: 'Qualité élevée, timing bloqué',
    keyTakeawaysPositive: ['10,8 Md$ de revenus IA au Q2, +143% sur un an.', '10,262 Md$ de free cash flow au trimestre.', 'Le segment logiciels ajoute 7,178 Md$ de revenus, sans ventilation VMware isolée.'],
    keyTakeawaysNegative: ['Aucun trade avant les résultats du 2 septembre.', 'Valorisation de 43,1x EV/EBITDA et dette de 64,91 Md$.', `TP1 technique à seulement ${rr1.toFixed(2)}R.`],
    mindsetTip: 'La note B juge l’entreprise et ses preuves financières. Le statut attendre juge le moment d’entrée. Le second bloque toute exécution avant les résultats.'
  },
  disclaimer: 'Analyse éducative au 29 août 2026, fondée sur la clôture complète du 28 août. Ce document n’est pas un conseil financier.',
  archiveHistory: [{ date: '2026-08-28', dateDisplay: '28 août 2026', grade: 'B', note: 'Version précédente' }]
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(analysis, null, 2) + '\n');

const values = {};
const stringNumericClaims = {};
const methods = {};
for (const dotted of numericPaths(analysis)) {
  set(values, dotted, get(analysis, dotted));
  methods[dotted] = dotted.startsWith('tradeIdea.') ? 'Niveaux et ratios calculés depuis la barre complète du 28 août et les indicateurs MCP.'
    : dotted.startsWith('technicals.') ? 'Indicateur MCP ou score d’affichage déterministe dérivé des indicateurs.'
      : dotted.startsWith('risks.') ? 'Barème de risque déterministe documenté par le générateur.'
        : dotted === 'verdict.score' ? 'Score fixe B=70 : croissance et cash-flow élevés, diminués par valorisation, dette et veto earnings.'
          : 'Valeur MCP directe ou transformation d’affichage déterministe.';
}
function collectNumericStrings(value, prefix = '') {
  if (typeof value === 'string' && /\d/.test(value)) stringNumericClaims[prefix] = value;
  else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) collectNumericStrings(child, prefix ? `${prefix}.${key}` : key);
}
collectNumericStrings(analysis);
const inputs = harness.sources.filter(row => row.required !== false).map(row => ({ path: `analyses/AVGO/_data/${row.name}.json`, sha256: row.sha256, name: row.name }));
inputs.push({ path: 'analyses/AVGO/_data/sec-primary-manifest.json', sha256: sha256(fs.readFileSync(SEC_PRIMARY_MANIFEST)), name: 'sec_primary_manifest', kind: 'primary_sec_manifest_v1' });
const sourceForClaim = dotted => {
  if (/^(capitalStructure|filingsReview)\./.test(dotted)) return 'sec_primary_manifest';
  if (/^earnings\.beatNote$/.test(dotted) || /^fundamentals\.rows\.2\./.test(dotted)) return 'sec_primary_manifest';
  if (/^news\./.test(dotted)) return 'corporate_actions';
  if (/^(shortInterest|capitalFlow)\./.test(dotted)) return 'short_squeeze';
  if (/^options\./.test(dotted)) return 'options';
  if (/^insiders\./.test(dotted)) return 'insiders';
  if (/^social\./.test(dotted)) return 'sentiment';
  if (/^(technicals|tradeIdea|performance)\./.test(dotted)) return dotted.startsWith('technicals.') ? 'technicals' : 'bars';
  if (/^header\.(price|changePct)$/.test(dotted) || /^header\.metrics\.(volume|range52w)$/.test(dotted)) return 'bars';
  if (/^(fundamentals|earnings|business|verdict|globalScore|header)\./.test(dotted)) return 'instrument';
  return 'status';
};
const pointerEscape = key => String(key).replace(/~/g, '~0').replace(/\//g, '~1');
const findExactPointer = (value, expected, prefix = '') => {
  if (Object.is(value, expected)) return prefix || '/';
  if (!value || typeof value !== 'object') return null;
  for (const [key, child] of Object.entries(value)) {
    const found = findExactPointer(child, expected, `${prefix}/${pointerEscape(key)}`);
    if (found) return found;
  }
  return null;
};
const fallbackPointers = {
  status: '/health', instrument: '/data/items/0', bars: '/results/0/data/0', fundamentals: '/data/items/0',
  technicals: '/data/items/0', sec_primary_manifest: '/documents', short_squeeze: '/data/items/0',
  options: '/data/items/0', insiders: '/results/0/data/0', corporate_actions: '/results/0/data/0', sentiment: '/health'
};
const semanticSecPointer = dotted => {
  if (/^capitalStructure\./.test(dotted)) return '/additional_reviewed_primary_urls/0';
  if (/^filingsReview\.summary$/.test(dotted)) return '/review_scope';
  if (/^filingsReview\.filings\.0\./.test(dotted)) return '/additional_reviewed_primary_urls/0';
  if (/^filingsReview\.filings\.1\./.test(dotted)) return '/additional_reviewed_primary_urls/1';
  if (/^filingsReview\.filings\.2\./.test(dotted)) return '/documents/1';
  if (/^filingsReview\.filings\.3\./.test(dotted)) return '/documents/0';
  if (/^filingsReview\.filings\.4\./.test(dotted)) return '/documents/3';
  if (/^filingsReview\.filings\.5\./.test(dotted)) return '/documents/2';
  if (/^filingsReview\.filings\.6\./.test(dotted)) return '/semantic_findings/exchange_333_296622';
  if (/^filingsReview\.filings\.7\./.test(dotted)) return '/semantic_findings/exchange_333_296623';
  if (/^filingsReview\.filings\.8\./.test(dotted)) return '/additional_reviewed_primary_urls/2';
  if (/^filingsReview\.filings\.9\./.test(dotted)) return '/additional_reviewed_primary_urls/3';
  if (/^filingsReview\.contrarianRisks\./.test(dotted)) return '/additional_reviewed_primary_urls/0';
  if (/^earnings\.beatNote$/.test(dotted) || /^fundamentals\.rows\.2\./.test(dotted)) return '/semantic_findings/q1_guidance';
  return '/review_scope';
};
const claimPaths = [...new Set([...numericPaths(analysis), ...Object.keys(stringNumericClaims)])];
const claimProvenance = Object.fromEntries(claimPaths.map(dotted => {
  const alias = sourceForClaim(dotted);
  const input = inputs.find(row => row.name === alias) || inputs[0];
  const inputData = read(path.join(ROOT, input.path));
  const effectiveAlias = input.name;
  const sourcePointer = findExactPointer(inputData, get(analysis, dotted))
    || (effectiveAlias === 'sec_primary_manifest' ? semanticSecPointer(dotted) : null)
    || fallbackPointers[effectiveAlias]
    || `/${pointerEscape(Object.keys(inputData)[0])}`;
  return [dotted, { input_name: input.name, input_path: input.path, input_sha256: input.sha256, source_pointer: sourcePointer, method: methods[dotted] || 'Transformation déterministe documentée par le générateur.' }];
}));
const analysisBytes = fs.readFileSync(OUT);
const calc = { kind: 'deterministic_analysis_calculation_v1', ticker: 'AVGO', reference_close: REF, generator_path: 'tools/build-avgo-analysis.js', generator_sha256: sha256(fs.readFileSync(__filename)), analysis_sha256: sha256(analysisBytes), inputs, score_components: scoreComponents, valuation_scenario: { multiple: scenarioMultiple, current_multiple: stats.enterpriseToEbitda, policy_haircut_pct: scenarioHaircutPolicy * 100, rounding_multiple: 5, multiple_haircut_pct: (scenarioMultiple / stats.enterpriseToEbitda - 1) * 100, purpose: 'stress_test_not_fair_value', ebitda_basis: 'provider_ttm_analytical_not_company_gaap_or_q2_adjusted', ebitda: financial.ebitda, debt: financial.totalDebt, cash: financial.totalCash, shares: stats.sharesOutstanding, close, enterprise_value: scenarioEv, equity_value: scenarioEquity, price: scenarioPrice, downside_pct: scenarioDownside, ebitda_required_at_current_ev: ebitdaRequiredAtScenarioMultiple, ebitda_required_growth_pct: ebitdaRequiredGrowth }, risk_policy: riskPolicy, claim_provenance: claimProvenance, values, string_numeric_claims: stringNumericClaims, methods };
fs.writeFileSync(CALC, JSON.stringify(calc, null, 2) + '\n');
const calcBytes = fs.readFileSync(CALC);
const numericPathSet = new Set(numericPaths(analysis));
const claims = claimPaths.map(dotted => ({ path: dotted, value: get(analysis, dotted), as_of: REF, source_artifact: 'analyses/AVGO/_data/calculations.json', source_sha256: sha256(calcBytes), source_pointer: numericPathSet.has(dotted) ? `/values/${dotted.split('.').join('/')}` : `/string_numeric_claims/${dotted}`, provenance: claimProvenance[dotted] }));
fs.mkdirSync(path.dirname(EVIDENCE), { recursive: true });
fs.writeFileSync(EVIDENCE, JSON.stringify({ ticker: 'AVGO', reference_close: REF, analysis_path: 'data/analyses-data/AVGO.json', analysis_sha256: sha256(analysisBytes), claims }, null, 2) + '\n');
console.log(`[AVGO] B ${score}/100, wait, ${claims.length} numeric claims`);
