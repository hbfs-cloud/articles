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
const IR_FINANCING = path.join(DATA_DIR, 'broadcom-ir-financing-platform.json');
const SCORE_POLICY = path.join(ROOT, 'config', 'analysis-score-policy.json');
const REF = '2026-08-28';
const DATE = '2026-08-30';
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
  ['EX-99.1', '0001730168-26-000011', '8k-q1-20260304-ex99.html', 'https://www.sec.gov/Archives/edgar/data/1730168/000173016826000011/avgo-02012026x8kxex99.htm'],
  ['10-Q', '0001730168-26-000054', '10q-q2-20260609.html', 'https://www.sec.gov/Archives/edgar/data/1730168/000173016826000054/avgo-20260503.htm']
].map(([form, accession, file, url]) => {
  const abs = path.resolve(SEC_PRIMARY_DIR, file);
  if (!fs.existsSync(abs)) throw new Error(`Primary SEC artifact missing: ${file}`);
  return { form, accession, path: path.relative(ROOT, abs), url, sha256: sha256(fs.readFileSync(abs)) };
});
const primarySecManifest = {
  kind: 'primary_sec_manifest_v1', ticker: 'AVGO', as_of: REF,
  inventory_count: 100, inventory_screened_count: 100, decision_relevant_count: 13,
  opened_count: 13, reviewed_count: 13, local_primary_count: primarySecDocuments.length,
  documents: primarySecDocuments,
  primary_ir_documents: [{
    published_at: '2026-06-09',
    path: 'analyses/AVGO/_data/broadcom-ir-financing-platform.json',
    url: read(IR_FINANCING).source_url,
    sha256: sha256(fs.readFileSync(IR_FINANCING))
  }],
  semantic_findings: {
    q2_ai_rack_backstop: {
      source_path: 'analyses/AVGO/_data/sec-primary/10q-q2-20260609.html',
      source_sha256: primarySecDocuments.find(row => row.accession === '0001730168-26-000054').sha256,
      source_needles: ['maximum exposure of $29 billion', 'customer&#8217;s lease obligations over 5-year terms', 'assumption of the lease or effecting a sale of the AI racks'],
      maximum_exposure_usd: 29000000000,
      lease_term_years: 5,
      filed_at: '2026-06-09'
    },
    ai_financing_platform: {
      source_path: 'analyses/AVGO/_data/broadcom-ir-financing-platform.json',
      source_sha256: sha256(fs.readFileSync(IR_FINANCING)),
      source_needles: ['"initial_tranche_usd": 35000000000', '"partner": "Blackstone"', 'exposition conditionnelle maximale de 29 milliards de dollars'],
      initial_tranche_usd: 35000000000,
      distinct_backstop_maximum_usd: 29000000000,
      published_at: '2026-06-09'
    },
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
  review_scope: 'Tous les dépôts de l’inventaire ont été filtrés; treize dépôts décisionnels ont été ouverts et revus. Onze documents ou pièces SEC et une publication Broadcom IR primaire sont conservés localement avec hash.'
};
fs.writeFileSync(SEC_PRIMARY_MANIFEST, JSON.stringify(primarySecManifest, null, 2) + '\n');

const instrument = read(path.join(DATA_DIR, 'instrument.json'));
const barsBundle = read(path.join(DATA_DIR, 'bars.json'));
const shortBundle = read(path.join(DATA_DIR, 'short_squeeze.json'));
const rankBetaBundle = read(path.join(DATA_DIR, 'rank_beta.json'));
const comparisonBarsBundle = read(path.join(DATA_DIR, 'comparison_bars.json'));
const comparisonClientBarsBundle = read(path.join(DATA_DIR, 'comparison_client_bars.json'));
const comparisonContextBundle = read(path.join(DATA_DIR, 'comparison_context.json'));
const comparisonEarningsBundle = read(path.join(DATA_DIR, 'comparison_earnings.json'));
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
  freeCashFlow: 10262000000 / 22187000000 > 0.40 ? 5 : 0,
  leverage: financial.totalDebt / financial.totalCash > 3 ? -4 : financial.totalDebt > financial.totalCash ? -2 : 0,
  earningsWindow: -4,
  customerConcentration: -5,
  aiRackBackstop: -4
};
const scorePolicy = read(SCORE_POLICY);
for (const [key, value] of Object.entries(scoreComponents)) {
  const policyKey = ({ revenueGrowth: 'revenue_growth_above_30pct', grossMargin: 'gross_margin_above_70pct', operatingMargin: 'operating_margin_above_40pct', returnOnEquity: 'return_on_equity_above_30pct', valuation: 'enterprise_value_to_ebitda_above_35x', freeCashFlow: 'free_cash_flow_margin_above_40pct', leverage: 'debt_to_cash_above_3x', earningsWindow: 'earnings_window', customerConcentration: 'customer_concentration', aiRackBackstop: 'ai_rack_backstop' })[key] || key;
  if (scorePolicy.components[policyKey] !== value) throw new Error(`Score policy mismatch for ${key}`);
}
const score = Object.values(scoreComponents).reduce((sum, value) => sum + value, 0);
const scenarioHaircutPolicy = 0.30;
const scenarioMultiple = Math.round((stats.enterpriseToEbitda * (1 - scenarioHaircutPolicy)) / 5) * 5;
const scenarioEv = financial.ebitda * scenarioMultiple;
const scenarioEquity = scenarioEv - financial.totalDebt + financial.totalCash;
const scenarioPrice = scenarioEquity / stats.sharesOutstanding;
const scenarioDownside = (scenarioPrice / close - 1) * 100;
const scenarioPriceRounded = Math.round(scenarioPrice);
const ebitdaRequiredAtScenarioMultiple = stats.enterpriseValue / scenarioMultiple;
const ebitdaRequiredGrowth = (ebitdaRequiredAtScenarioMultiple / financial.ebitda - 1) * 100;
const netDebtToEbitda = (financial.totalDebt - financial.totalCash) / financial.ebitda;
const riskPolicy = {
  earningsProbability: calendar.nextEarningsDate?.startsWith('2026-09-02') ? 80 : 35,
  earningsImpact: technical.atr / close > 0.03 ? 95 : 75,
  valuationProbability: stats.enterpriseToEbitda > 40 ? 65 : stats.enterpriseToEbitda > 30 ? 50 : 30,
  valuationImpact: financial.totalDebt / financial.totalCash > 3 ? 85 : 65,
  concentrationProbability: 42 >= 40 ? 70 : 45,
  concentrationImpact: 45 >= 40 ? 90 : 70
};

const comparisonTickers = ['NVDA', 'AMD', 'MRVL', 'ALAB', 'CRDO', 'ANET', 'MU', 'TSM', 'AMKR', 'LRCX', 'COHR', 'SMCI', 'DELL', 'HPE', 'VRT', 'ETN', 'GEV', 'CEG', 'VST', 'CSCO', 'ORCL', 'IBM', 'SMH', 'SOXX', 'QQQ'];
const documentedClientTickers = ['GOOGL', 'META', 'AAPL'];
const comparisonBarResults = comparisonBarsBundle.data?.items?.flatMap(row => row.results || []) || [];
const comparisonBarPayload = comparisonBarResults.find(row => row.data_type === 'bars_daily')?.data || [];
if (comparisonBarPayload.length !== comparisonTickers.length) throw new Error(`Comparison bars mismatch: ${comparisonBarPayload.length}/${comparisonTickers.length}`);
if (JSON.stringify(comparisonBarResults.find(row => row.data_type === 'bars_daily')?.symbols) !== JSON.stringify(comparisonTickers)) throw new Error('Comparison bar symbol order is not explicit and exact');
const comparisonBarsByTicker = new Map(comparisonTickers.map((ticker, index) => [ticker, (comparisonBarPayload[index]?.bars || []).map(row => ({ date: row[0], close: row[4] }))]));
const clientBarResults = comparisonClientBarsBundle.data?.items?.flatMap(row => row.results || []) || [];
const clientBarPayload = clientBarResults.find(row => row.data_type === 'bars_daily')?.data || [];
if (clientBarPayload.length !== documentedClientTickers.length) throw new Error(`Documented client bars mismatch: ${clientBarPayload.length}/${documentedClientTickers.length}`);
if (JSON.stringify(clientBarResults.find(row => row.data_type === 'bars_daily')?.symbols) !== JSON.stringify(documentedClientTickers)) throw new Error('Documented client bar symbol order is not explicit and exact');
documentedClientTickers.forEach((ticker, index) => comparisonBarsByTicker.set(ticker, (clientBarPayload[index]?.bars || []).map(row => ({ date: row[0], close: row[4] }))));
for (const ticker of [...comparisonTickers, ...documentedClientTickers]) {
  const tickerRows = comparisonBarsByTicker.get(ticker) || [];
  if (tickerRows.at(-1)?.date !== REF) throw new Error(`${ticker} comparison close mismatch: ${tickerRows.at(-1)?.date || 'missing'}`);
}
const rankRows = rankBetaBundle.data?.items?.flatMap(row => row.rows || []) || [];
const rankByTicker = new Map(rankRows.map(row => [row.symbol, row]));
const avgoCloseByDate = new Map(rows.map(row => [row.date, row.close]));
const regressionStart = '2026-03-01';
const rawRegression = tickerRows => {
  const observations = tickerRows
    .filter(row => row.date >= regressionStart && row.date <= REF && avgoCloseByDate.has(row.date))
    .map(row => ({ date: row.date, target: row.close, reference: avgoCloseByDate.get(row.date) }));
  const returns = [];
  for (let index = 1; index < observations.length; index++) {
    const previousRow = observations[index - 1], currentRow = observations[index];
    if (previousRow.target > 0 && previousRow.reference > 0 && currentRow.target > 0 && currentRow.reference > 0) {
      returns.push({ target: Math.log(currentRow.target / previousRow.target), reference: Math.log(currentRow.reference / previousRow.reference) });
    }
  }
  if (returns.length < 60) return { correlation: null, beta: null, r2: null, observations: returns.length };
  const targetMean = returns.reduce((sum, row) => sum + row.target, 0) / returns.length;
  const referenceMean = returns.reduce((sum, row) => sum + row.reference, 0) / returns.length;
  const covariance = returns.reduce((sum, row) => sum + (row.target - targetMean) * (row.reference - referenceMean), 0) / returns.length;
  const targetVariance = returns.reduce((sum, row) => sum + (row.target - targetMean) ** 2, 0) / returns.length;
  const referenceVariance = returns.reduce((sum, row) => sum + (row.reference - referenceMean) ** 2, 0) / returns.length;
  const correlation = covariance / Math.sqrt(targetVariance * referenceVariance);
  return { correlation, beta: covariance / referenceVariance, r2: correlation ** 2, observations: returns.length };
};
const qqqCloseByDate = new Map((comparisonBarsByTicker.get('QQQ') || []).map(row => [row.date, row.close]));
const marketAdjustedRegression = tickerRows => {
  const observations = tickerRows
    .filter(row => row.date >= regressionStart && row.date <= REF && avgoCloseByDate.has(row.date) && qqqCloseByDate.has(row.date))
    .map(row => ({ date: row.date, target: row.close, reference: avgoCloseByDate.get(row.date), market: qqqCloseByDate.get(row.date) }));
  const returns = [];
  for (let index = 1; index < observations.length; index++) {
    const previousRow = observations[index - 1], currentRow = observations[index];
    if ([previousRow.target, previousRow.reference, previousRow.market, currentRow.target, currentRow.reference, currentRow.market].every(value => value > 0)) {
      returns.push({
        target: Math.log(currentRow.target / previousRow.target),
        reference: Math.log(currentRow.reference / previousRow.reference),
        market: Math.log(currentRow.market / previousRow.market)
      });
    }
  }
  if (returns.length < 60) return { correlation: null, beta: null, r2: null, observations: returns.length };
  const residualize = key => {
    const meanY = returns.reduce((sum, row) => sum + row[key], 0) / returns.length;
    const meanM = returns.reduce((sum, row) => sum + row.market, 0) / returns.length;
    const cov = returns.reduce((sum, row) => sum + (row[key] - meanY) * (row.market - meanM), 0) / returns.length;
    const varM = returns.reduce((sum, row) => sum + (row.market - meanM) ** 2, 0) / returns.length;
    const slope = cov / varM;
    return returns.map(row => row[key] - meanY - slope * (row.market - meanM));
  };
  const targetResiduals = residualize('target');
  const referenceResiduals = residualize('reference');
  const targetMean = targetResiduals.reduce((sum, value) => sum + value, 0) / returns.length;
  const referenceMean = referenceResiduals.reduce((sum, value) => sum + value, 0) / returns.length;
  const covariance = targetResiduals.reduce((sum, value, index) => sum + (value - targetMean) * (referenceResiduals[index] - referenceMean), 0) / returns.length;
  const targetVariance = targetResiduals.reduce((sum, value) => sum + (value - targetMean) ** 2, 0) / returns.length;
  const referenceVariance = referenceResiduals.reduce((sum, value) => sum + (value - referenceMean) ** 2, 0) / returns.length;
  const correlation = covariance / Math.sqrt(targetVariance * referenceVariance);
  return { correlation, beta: covariance / referenceVariance, r2: correlation ** 2, observations: returns.length };
};
const eventByTicker = new Map((comparisonEarningsBundle.events || []).map(event => [event.symbol, event]));
const dailyMove = (ticker, date) => {
  const tickerRows = ticker === 'AVGO'
    ? rows.map(row => ({ date: row.date, close: row.close }))
    : comparisonBarsByTicker.get(ticker) || [];
  const index = tickerRows.findIndex(row => row.date === date);
  if (index < 1 || !tickerRows[index - 1].close) throw new Error(`${ticker} event move unavailable for ${date}`);
  return (tickerRows[index].close / tickerRows[index - 1].close - 1) * 100;
};
const juneEventMoves = Object.fromEntries(['AVGO', 'MRVL', 'CRDO', 'TSM'].map(ticker => [ticker, dailyMove(ticker, '2026-06-04')]));
const marchEventMoves = Object.fromEntries(['AVGO', 'MRVL', 'TSM', 'MU'].map(ticker => [ticker, dailyMove(ticker, '2026-03-05')]));
const relative = ticker => {
  const tickerRows = comparisonBarsByTicker.get(ticker) || [];
  const raw = rawRegression(tickerRows);
  const adjusted = ticker === 'QQQ' ? { correlation: null, beta: null, r2: null, observations: raw.observations } : marketAdjustedRegression(tickerRows);
  const server = rankByTicker.get(ticker);
  if (server && raw.observations >= 60) {
    for (const key of ['correlation', 'beta', 'r2']) if (Math.abs(raw[key] - server[key]) > 0.00001) throw new Error(`${ticker} local ${key} does not match RankBeta`);
    if (raw.observations !== server.n_obs) throw new Error(`${ticker} local observations do not match RankBeta`);
  }
  const event = eventByTicker.get(ticker);
  return {
    correlation: adjusted.correlation,
    beta: adjusted.beta,
    r2: adjusted.r2,
    observations: adjusted.observations,
    return5d: performance(tickerRows, 5),
    return21d: performance(tickerRows, 21),
    eventRisk: event ? `Résultats le ${event.report_date} ${event.report_time}; mouvement implicite indisponible hors séance.` : 'Aucun résultat trouvé dans les quatorze prochains jours par le calendrier filtré; revérifier avant exécution.'
  };
};
const blastSymbol = (ticker, role, relationClass, readThrough, confidence = 'high') => {
  const metrics = relative(ticker);
  const regressionNote = metrics.correlation === null ? (ticker === 'QQQ' ? ' QQQ est le facteur neutralisé; aucune régression résiduelle contre lui-même.' : ` Régression indisponible : seulement ${metrics.observations} rendements communs, sous le minimum de 60.`) : '';
  const statisticalConfidence = metrics.r2 >= 0.10 ? 'high' : metrics.r2 >= 0.03 ? 'medium' : 'low';
  const effectiveConfidence = confidence === 'low' || metrics.correlation === null ? 'low' : confidence === 'medium' && statisticalConfidence === 'high' ? 'medium' : statisticalConfidence;
  return { ticker, role, relationClass, ...metrics, readThrough: `${readThrough}${regressionNote}`, confidence: effectiveConfidence };
};
const blastUniverse = [...comparisonTickers, ...documentedClientTickers];
const blastConfidenceCounts = blastUniverse.reduce((counts, ticker) => {
  const metrics = relative(ticker);
  const confidence = metrics.correlation === null ? 'low' : metrics.r2 >= 0.10 ? 'high' : metrics.r2 >= 0.03 ? 'medium' : 'low';
  counts[confidence]++;
  return counts;
}, { high: 0, medium: 0, low: 0 });
const blastOverallConfidence = blastConfidenceCounts.high >= Math.ceil(blastUniverse.length / 3)
  ? 'élevée'
  : blastConfidenceCounts.high + blastConfidenceCounts.medium >= Math.ceil(blastUniverse.length / 2) ? 'modérée' : 'faible';

const irQ2 = source('Résultats Broadcom Q2 FY2026', 'https://investors.broadcom.com/news-releases/news-release-details/broadcom-inc-announces-second-quarter-fiscal-year-2026-financial', '2026-06-03');
const secQ1 = source('Form 8-K Broadcom Q1 FY2026, pièce 99.1', 'https://www.sec.gov/Archives/edgar/data/1730168/000173016826000011/avgo-02012026x8kxex99.htm', '2026-03-04');
const irEvent = source('Calendrier Broadcom Q3 FY2026', 'https://investors.broadcom.com/news-releases/news-release-details/broadcom-inc-announce-third-quarter-fiscal-year-2026-financial', '2026-08-03');
const secQ = source('Form 10-Q Broadcom Q2 FY2026', 'https://www.sec.gov/Archives/edgar/data/1730168/000173016826000054/avgo-20260503.htm', '2026-06-09');
const market = source('Historique AVGO, données de marché', 'https://finance.yahoo.com/quote/AVGO/history/', REF);
const optionsSource = source('Snapshot options AVGO du composite courant', 'https://finance.yahoo.com/quote/AVGO/options/', '2026-08-29');
const shortSource = source('Positions vendeuses AVGO', 'https://www.nasdaq.com/market-activity/stocks/avgo/short-interest', '2026-08-14');
const borrowSource = source('Coût et disponibilité d’emprunt AVGO', 'https://www.iborrowdesk.com/report/AVGO', REF);
const barsRef = market;
const technicalRef = source('Indicateurs techniques AVGO', market.url, REF);
const optionsRef = optionsSource;
const shortRef = shortSource;
const insiderRef = source('Activité des initiés AVGO', 'https://www.nasdaq.com/market-activity/stocks/avgo/insider-activity', REF);
const regimeRef = source('Historique SPY, contrôle de régime', 'https://finance.yahoo.com/quote/SPY/history/', '2026-08-30');
const seasonalityRef = source('Historique AVGO, saisonnalité calculée', market.url, '2026-08-30');
const financingPlatformRef = source('Plateforme de financement IA Broadcom, Apollo et Blackstone', read(IR_FINANCING).source_url, '2026-06-09');

const analysis = {
  meta: {
    lang: 'fr', dir: 'ltr', level: 'intermediate', assetType: 'stock',
    tags: ['us', 'technologie', 'semiconducteurs', 'ia', 'logiciels'], grade: 'B',
    date: DATE, dateDisplay: '30 août 2026', version: 3, status: 'wait', levelsCloseDate: REF,
    levelsVerifiedAt: harness.generated_at, lastMcpRefresh: harness.generated_at,
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
    score, conviction: 'Low', bias: 'Neutral', confidence: `Confiance ${blastOverallConfidence} : ${blastConfidenceCounts.high} relation forte, ${blastConfidenceCounts.medium} moyennes et ${blastConfidenceCounts.low} faibles après neutralisation de QQQ`,
    controlChecklist: [
      { label: 'Données de référence', status: 'pass', statusLabel: 'VALIDÉ', evidence: `Clôture complète du ${REF}; observation horodatée ${harness.generated_at}.`, action: 'Les niveaux peuvent être audités, pas exécutés.' },
      { label: 'Risque événementiel', status: 'blocked', statusLabel: 'BLOQUÉ', evidence: 'Résultats Broadcom le 2 septembre après clôture.', action: 'Aucune nouvelle entrée avant la publication.' },
      { label: 'Tendance', status: 'warn', statusLabel: 'MITIGÉ', evidence: `Cours sous EMA20 ${px(technical.ema20)} et EMA50 ${px(technical.ema50)}; RSI ${technical.rsi.toFixed(1)}.`, action: 'Attendre une reprise confirmée, pas acheter la faiblesse.' },
      { label: 'Volume et VWAP', status: 'blocked', statusLabel: 'NON CONFIRMÉ', evidence: 'Les barres régulières post-événement n’existent pas encore.', action: 'Recalculer VWAP, range 15 min et volume après le gap.' },
      { label: 'Risque / rendement', status: 'warn', statusLabel: 'FAIBLE', evidence: `Le repère historique ne paie que ${rr1.toFixed(2)}R vers le premier objectif.`, action: 'Ne pas conserver ces niveaux comme plan actif.' },
      { label: 'Valorisation et bilan', status: 'warn', statusLabel: 'EXIGEANT', evidence: '43,1x EV/EBITDA, 24,0x EV/revenus et dette comptable de 64,907 Md$.', action: 'Une simple conformité peut provoquer une compression.' },
      { label: 'Blast radius', status: blastOverallConfidence === 'élevée' ? 'pass' : 'warn', statusLabel: blastOverallConfidence === 'élevée' ? 'EXPLOITABLE' : 'PARTIEL', evidence: `${blastConfidenceCounts.high} relation(s) forte(s), ${blastConfidenceCounts.medium} moyenne(s), ${blastConfidenceCounts.low} faible(s) après neutralisation de QQQ.`, action: 'Lire les pairs comme confirmation, jamais comme causalité.' },
      { label: 'SEC / options', status: 'warn', statusLabel: 'PARTIEL', evidence: 'Dépôts SEC principaux vérifiés; chaîne et volatilité événementielle dédiées indisponibles.', action: 'Ne pas inférer une amplitude implicite ni un signal de flux.' }
    ],
    summary: `Broadcom combine les puces sur mesure et le réseau pour l’IA avec les logiciels hérités de VMware. Le Q2 publié est exceptionnel : 22,187 Md$ de revenus, +48% sur un an, 10,8 Md$ de revenus IA et 10,262 Md$ de flux de trésorerie disponible. Mais le marché paie 43,1x l’EBITDA et 24,0x les revenus, tandis qu’un accord avec Apollo peut exposer Broadcom jusqu’à 29 Md$ si le client des racks IA ne paie pas ses loyers; cette exposition monte avec les déploiements et les recours peuvent la réduire. Un stress mécanique à ${scenarioMultiple}x l’EBITDA TTM donne environ $${scenarioPriceRounded}, soit ${scenarioDownside.toFixed(1)}%, sans constituer une juste valeur. Broadcom publie le 2 septembre après clôture : aucun achat avant l’événement.`,
    whyBuy: [
      'Revenus Q2 FY2026 de 22,187 Md$, en hausse de 48% sur un an.',
      'Revenus semiconducteurs IA de 10,8 Md$, en hausse de 143% sur un an.',
      'Free cash flow trimestriel de 10,262 Md$, soit 46% des revenus.',
      `Guidance Q3 de 29,4 Md$ de revenus, soit +${q3SequentialGuidePct.toFixed(1)}% contre le Q2 publié, dont 16,0 Md$ attendus dans les semiconducteurs IA.`,
      'Le segment logiciels d’infrastructure apporte 7,178 Md$ de revenus, en hausse de 9%, sans ventilation VMware isolée.'
    ],
    whyAvoid: [
      'Résultats le 2 septembre après clôture : un saut de cours peut rendre tout stop préplacé théorique.',
      'Valorisation exigeante : 43,1x EV/EBITDA et 24,0x EV/revenus dans la collecte.',
      'Backstop Apollo : exposition conditionnelle maximale de 29 Md$ sur cinq ans si le client des racks IA fait défaut.',
      `Cours à ${px(close)}, sous l’EMA20 à ${px(technical.ema20)} et l’EMA50 à ${px(technical.ema50)}.`,
      `Le premier ancien objectif à ${px(tp1)} ne paie que ${rr1.toFixed(2)} unité de risque depuis le repère d’entrée.`
    ]
  },
  business: {
    overview: `<p><strong>Semiconducteurs.</strong> Broadcom conçoit des accélérateurs personnalisés, des commutateurs Ethernet, des interfaces réseau, des composants optiques et des solutions de connectivité. Dans l’IA, sa valeur vient surtout des puces sur mesure développées avec de grands clients cloud et du réseau qui relie les accélérateurs.</p><p><strong>Logiciels d’infrastructure.</strong> VMware Cloud Foundation, la sécurité, le mainframe et les outils d’exploitation ont produit 7,178 Md$ de revenus au Q2, en hausse de 9%. Le dépôt ne fournit pas de churn ni de taux de rétention.</p><p><strong>Nouveau risque de financement.</strong> Le 8 juin, Apollo a repris des achats de racks IA et les contrats de location associés. Broadcom garantit les obligations du client pendant cinq ans, jusqu’à 29 Md$ au maximum. L’exposition augmente avec les racks déployés, baisse avec les loyers payés et pourrait être réduite par reprise du bail ou revente des racks en cas de défaut.</p><p><strong>Lecture économique.</strong> Un distributeur représente 42% du chiffre d’affaires, les cinq premiers clients finaux 45% et les distributeurs 56%. Il faut donc suivre ensemble croissance IA, qualité du cash-flow, déploiement du backstop, logiciel et dette.</p>`,
    segments: [
      { name: 'Solutions semiconducteurs', revenue: '$15,009 Md', pct: '68%', description: 'Puces sur mesure, réseau, stockage, sans-fil et connectivité.' },
      { name: 'Logiciels d’infrastructure', revenue: '$7,178 Md', pct: '32%', description: 'VMware, mainframe, sécurité et logiciels d’exploitation.' }
    ],
    moat: 'L’avantage de Broadcom repose sur des relations techniques longues avec les hyperscalers, une propriété intellectuelle difficile à remplacer et une forte présence dans le réseau. Ce moat reste conditionnel : un calendrier client décalé, une migration VMware ou une alternative interne peut déplacer plusieurs milliards de revenus.',
    theme: 'Infrastructure IA diversifiée', sourceRefs: [irQ2, secQ]
  },
  news: [
    { date: '2026-08-28', title: 'Les résultats Broadcom deviennent le prochain test du rallye IA', source: 'Reuters', sourceUrl: 'https://finance.yahoo.com/markets/stocks/articles/jobs-report-broadcom-results-pose-100141778.html', impact: 'neutral', detail: 'L’événement du 2 septembre peut déplacer tout le groupe semiconducteurs et impose de ne pas anticiper le gap.' },
    { date: '2026-08-03', title: 'Broadcom confirme ses résultats Q3 FY2026 pour le 2 septembre', source: 'Broadcom IR', sourceUrl: irEvent.url, impact: 'neutral', detail: 'La date officielle transforme toute entrée préalable en pari binaire sur les objectifs chiffrés et les commentaires clients.' },
    { date: '2026-07-06', title: 'Accord commercial de long terme avec Apple', source: 'SEC EDGAR', sourceUrl: 'https://www.sec.gov/Archives/edgar/data/1730168/000119312526295589/d84378d8k.htm', impact: 'positive', detail: 'Le contrat soutient la visibilité hors IA, sans supprimer la concentration sur quelques très grands clients.' },
    { date: '2026-06-09', title: 'Plateforme de financement IA avec Apollo et Blackstone', source: 'Broadcom IR', sourceUrl: 'https://investors.broadcom.com/node/64396/pdf', impact: 'neutral', detail: 'La tranche initiale annoncée de 35 Md$ finance une plateforme plus large; elle ne doit pas être additionnée ni assimilée au backstop maximal de 29 Md$ du 10-Q.' },
    { date: '2026-06-03', title: 'Q2 FY2026 : accélération des puces IA et forte conversion en trésorerie', source: 'Broadcom IR', sourceUrl: irQ2.url, impact: 'positive', detail: 'La hausse de 143% des revenus IA et 10,262 Md$ de flux de trésorerie disponible relèvent le seuil d’attente pour Q3.' }
  ],
  fundamentals: {
    rows: [
      { metric: 'Revenus TTM', value: money(financial.totalRevenue), signal: `${pct(financial.revenueGrowth)} de croissance`, signalColor: 'green', source: 'Données financières agrégées', comparison: `TTM observé au ${REF}` },
      { metric: 'Revenus Q2 FY2026', value: '$22,187 Md', signal: '+48% sur un an', signalColor: 'green', source: 'Broadcom IR', comparison: 'Trimestre clos le 3 mai 2026' },
      { metric: 'Q2 réalisé / guidance précédente', value: '$22,187 Md / $22,0 Md', signal: `+${q2GuideBeatPct.toFixed(2)}% au-dessus`, signalColor: 'green', source: 'Forms 8-K Broadcom des 4 mars et 3 juin', comparison: 'Comparaison à dates fixes; aucun consensus analystes daté n’est disponible dans le snapshot' },
      { metric: 'Revenus IA Q2', value: '$10,8 Md', signal: '+143% sur un an', signalColor: 'green', source: 'Broadcom IR', comparison: 'Q2 FY2026' },
      { metric: 'Logiciels d’infrastructure Q2', value: '$7,178 Md', signal: '+9% sur un an', signalColor: 'blue', source: 'Broadcom IR', comparison: 'Q2 FY2026' },
      { metric: 'EBITDA ajusté Q2', value: '$15,244 Md', signal: '69% des revenus', signalColor: 'green', source: 'Broadcom IR', comparison: 'Mesure non-GAAP Q2 FY2026' },
      { metric: 'Flux de trésorerie disponible Q2', value: '$10,262 Md', signal: '46% des revenus', signalColor: 'green', source: 'Broadcom IR', comparison: 'Q2 FY2026' },
      { metric: 'Marge brute TTM', value: pct(financial.grossMargins), signal: 'Marge publiée', signalColor: 'green', source: 'Données financières agrégées', comparison: `TTM au ${REF}` },
      { metric: 'Marge opérationnelle TTM', value: pct(financial.operatingMargins), signal: 'Rentable', signalColor: 'green', source: 'Données financières agrégées', comparison: `TTM au ${REF}` },
      { metric: 'Marge nette TTM', value: pct(financial.profitMargins), signal: 'Positive', signalColor: 'green', source: 'Données financières agrégées', comparison: `TTM au ${REF}` },
      { metric: 'Trésorerie', value: money(financial.totalCash), signal: 'Liquidité', signalColor: 'green', source: 'Données financières agrégées', comparison: `Dernier bilan disponible au ${REF}` },
      { metric: 'Dette', value: money(financial.totalDebt), signal: 'Levier VMware', signalColor: 'amber', source: 'Données financières agrégées', comparison: `Dernier bilan disponible au ${REF}` },
      { metric: 'Backstop racks IA', value: '$29,0 Md maximum', signal: 'Exposition conditionnelle sur 5 ans', signalColor: 'red', source: 'Form 10-Q Broadcom', comparison: 'Monte avec les racks déployés, baisse avec les loyers payés; reprise du bail ou vente des racks possible en cas de défaut du client' },
      { metric: 'Dette principale / comptable', value: '$66,720 Md / $64,907 Md', signal: 'Écart de coûts non amortis', signalColor: 'amber', source: 'Form 10-Q Broadcom', comparison: '2,252 Md$ à court terme et 62,655 Md$ à long terme au 3 mai 2026' },
      { metric: 'Échéances de dette', value: '$2,252 Md en 2026', signal: 'Mur étalé', signalColor: 'amber', source: 'Form 10-Q Broadcom', comparison: '0,493 Md$ en 2027; 5,127 Md$ en 2028; 4,655 Md$ en 2029; 6,406 Md$ en 2030; 47,787 Md$ ensuite' },
      { metric: 'Intérêts trimestriels', value: '$776 M', signal: 'Charge fixe', signalColor: 'amber', source: 'Form 10-Q Broadcom', comparison: 'Q2 FY2026' },
      { metric: 'Goodwill + incorporels nets', value: '$126,134 Md', signal: 'Acquisitions et actifs logiciels', signalColor: 'amber', source: 'Form 10-Q Broadcom', comparison: '97,801 Md$ de goodwill et 28,333 Md$ d’incorporels nets; ventilation VMware non isolée' },
      { metric: 'Rémunération actions non reconnue', value: '$20,106 Md', signal: 'Charge future, pas nombre d’actions dilué', signalColor: 'amber', source: 'Form 10-Q Broadcom', comparison: 'Période moyenne de reconnaissance de 3 ans' },
      { metric: 'Rachats encore autorisés', value: '$10,1 Md', signal: 'Capacité, pas exécution', signalColor: 'blue', source: 'Form 10-Q Broadcom', comparison: 'Autorisation restante au 3 mai 2026' },
      { metric: 'ROE', value: pct(financial.returnOnEquity), signal: 'Efficacité élevée', signalColor: 'green', source: 'Données financières agrégées', comparison: `TTM au ${REF}` },
      { metric: 'EV/EBITDA', value: `${stats.enterpriseToEbitda.toFixed(1)}x`, signal: `EBITDA TTM fournisseur ${money(financial.ebitda)}`, signalColor: 'red', source: 'Données de marché, stats', comparison: `Le dénominateur est un EBITDA TTM analytique, ni un agrégat GAAP publié ni l’EBITDA ajusté Q2. Le stress applique une compression mécanique de 30%, arrondie au multiple de 5x le plus proche : ${scenarioMultiple}x, environ $${scenarioPriceRounded}, soit ${scenarioDownside.toFixed(1)}%` },
      { metric: 'EBITDA requis pour 30x au cours actuel', value: money(ebitdaRequiredAtScenarioMultiple), signal: `+${ebitdaRequiredGrowth.toFixed(1)}% versus EBITDA TTM`, signalColor: 'red', source: 'Calcul déterministe depuis EV et EBITDA TTM', comparison: `À valeur d’entreprise constante au 28 août 2026, il faudrait ${money(ebitdaRequiredAtScenarioMultiple)} d’EBITDA TTM pour ramener le multiple à ${scenarioMultiple}x. Ce n’est pas une prévision.` },
      { metric: 'EV/revenus', value: `${stats.enterpriseToRevenue.toFixed(1)}x`, signal: 'Base trailing au 28 août 2026 versus pairs', signalColor: 'red', source: 'Données de marché et bilan', comparison: 'Multiple intégré très exigeant versus grands semiconducteurs diversifiés' },
      { metric: 'Objectif analystes moyen', value: px(financial.targetMeanPrice), signal: 'Consensus, pas une garantie', signalColor: 'blue', source: 'Consensus analystes agrégé', comparison: `Snapshot au ${REF}` }
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
    signal: 'Le signal rapide observe 1 achat contre 53 ventes sur 90 jours et attribue un score de risque de 100 aux ventes. Ce score composite n’est ni une probabilité ni une preuve de vente discrétionnaire; les Forms 4 couvrent aussi attributions et plans. Aucun mouvement initié ne confirme une entrée avant résultats.', sourceRefs: [insiderRef]
  },
  capitalStructure: {
    sharesOutstanding: `${(stats.sharesOutstanding / 1e9).toFixed(2)}B`, sharesAuthorized: '29,000 Md ordinaires; 100 M préférentielles', dilutionRisk: 'moderate',
    shareHistory: 'Au 3 mai 2026, 4,758 milliards d’actions ordinaires sont émises et en circulation sur 29,000 milliards autorisées; 100 millions de préférentielles sont autorisées et aucune n’est émise. Le trimestre rapproche 4,747 milliards d’actions moyennes de base et 4,876 milliards diluées, soit 129 millions d’effet incrémental moyen. Ce pont n’est pas un total dilué observé à cette date. Un total actuel n’est pas calculable avec les données disponibles. Les 20,106 Md$ de rémunération actions non encore reconnue sont une charge future, pas un nombre d’actions. L’autorisation de rachat restante de 10,1 Md$ est une capacité, pas une exécution. Les prospectus 2026 examinés concernent surtout la dette; aucun programme de vente d’actions au marché n’est déduit d’un prospectus générique.',
    sourceRefs: [secQ, source('Prospectus obligataire final', 'https://www.sec.gov/Archives/edgar/data/1730168/000119312526007683/d917883d424b2.htm', '2026-01-06')]
  },
  filingsReview: {
    summary: 'La revue primaire sépare résultats, bilan, backstop des racks IA, contrat Apple, émissions obligataires, échanges de dette et notices EFFECT. Les 100 dépôts de l’inventaire local ont été filtrés; 13 dépôts décisionnels ont été ouverts et revus, avec 11 documents, pièces ou extraits SEC primaires conservés et hashés. Le 10-Q documente une exposition conditionnelle maximale de 29 Md$ sur cinq ans envers Apollo si le client des racks IA fait défaut. Les recours annoncés peuvent réduire ce maximum, mais l’exposition tirée actuelle et la qualité de crédit du client ne sont pas publiées. Les 424B3 fixaient au 17 juillet les offres d’échange de 5,999984 Md$ et 1,950 Md$ de principal; l’inventaire ne prouve pas le montant effectivement tenderé.',
    filings: [
      { date: '2026-06-09', form: '10-Q', accession: '0001730168-26-000054', finding: 'Le 10-Q confirme la dette de 64,91 Md$, la trésorerie de 19,63 Md$ et le rapprochement de 4,747 milliards d’actions de base vers 4,876 milliards diluées. Il révèle aussi un backstop Apollo sur des loyers de racks IA : cinq ans, exposition maximale de 29 Md$, croissante avec les déploiements et décroissante avec les paiements.', url: secQ.url },
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
      'Le backstop Apollo peut atteindre 29 Md$; l’exposition tirée actuelle, l’identité et la qualité de crédit du client ne sont pas publiées.',
      'Le logiciel croît de 9%, mais le 10-Q ne fournit ni churn ni rétention : la qualité de cette croissance reste partiellement non vérifiable.',
      'La dette comptable de 64,907 Md$ comprend 2,252 Md$ à court terme; 47,787 Md$ de principal arrive après 2030.',
      'Un distributeur représente 42% des revenus, les cinq premiers clients finaux 45% et les distributeurs 56%.',
      'À 24,0x EV/revenus, un simple ralentissement de la guidance IA peut provoquer une forte compression du multiple.',
      'La marge guidée est non-GAAP et ne peut pas être réconciliée précisément avant la publication.'
      ,'Le 10-Q conclut à des contrôles de publication effectifs ; cette conclusion ne garantit pas l’absence de toute faiblesse future ni un total d’actions dilué actuel.'
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
    unusual: 'Le composite courant observe les options d’achat et de vente expirant le 31 août, avant les résultats du 2 septembre. Elles ne couvrent pas le saut de cours. La collecte dédiée de chaîne, surface de volatilité, historique et point d’équilibre des options a échoué : aucune volatilité implicite événementielle ni activité inhabituelle n’est affirmée.', sourceRefs: [optionsRef]
  },
  technicals: {
    rsi14: technical.rsi, macd: technical.macd, macdSignal: technical.signal, ema20: technical.ema20, ema50: technical.ema50, ema200: technical.ema200,
    ma50Type: 'EMA', ma200Type: 'EMA', ma50Available: true, ma200Available: true, atr14: technical.atr,
    badges: [`RSI ${technical.rsi.toFixed(1)}`, 'SOUS EMA20/50', 'VETO RÉSULTATS'], supports: [stop, 350.0599, 323.32], resistances: [entry, tp1, tp2],
    setupNote: `Clôture complète du 28 août à ${px(close)}. Le repère d’entrée ${px(entry)} est le plus haut de séance et le stop ${px(stop)} son plus bas. L’ancien objectif 1 à ${px(tp1)} correspond à la moyenne exponentielle 50 séances et ne paie que ${rr1.toFixed(2)} unité de risque; l’ancien objectif 2 à ${px(tp2)} est la résistance quotidienne fournie. La dernière cotation était seulement la dernière connue, marché fermé, à 2026-08-29T21:48:16Z; elle n’est pas présentée comme une cotation intraday. Comme les résultats arrivent le 2 septembre, cette géométrie est inactive et doit être reconstruite après le saut de cours.`,
    wyckoff: 'Transition / correction', radarValues: { rsi: 43, trend: 35, volume: 55, momentum: 35, volatility: 62, support: 50 }, sourceRefs: [barsRef, technicalRef]
  },
  blastRadius: {
    asOf: REF,
    observationTime: comparisonContextBundle.data?.items?.[0]?.timestamp || '2026-08-30T03:48:04Z',
    window: 'Rendements logarithmiques communs du 1er mars au 28 août 2026; facteur QQQ neutralisé; performances arrêtées à la même clôture.',
    methodology: `Le panier part des liens économiques documentés, puis mesure le mouvement commun restant après avoir retiré le facteur QQQ de chaque série. Les corrélations, bêtas et R² affichés sont donc résiduels, pas bruts. Bilan : ${blastConfidenceCounts.high} relation forte, ${blastConfidenceCounts.medium} moyennes et ${blastConfidenceCounts.low} faibles; confiance globale ${blastOverallConfidence}. Ils ne prouvent aucune causalité Broadcom : les deux dernières réactions de résultats montrent une transmission instable. Les résultats propres et la chronologie gardent priorité.`,
    groups: [
      {
        name: 'Calcul, puces sur mesure et interconnexions', order: 1,
        transmission: 'La guidance Broadcom teste les accélérateurs personnalisés et le réseau IA. Ces titres réagissent d’abord, mais leurs architectures et clients ne sont pas interchangeables.',
        symbols: [
          blastSymbol('NVDA', 'Leader des accélérateurs IA généralistes', 'leader', 'Confirme ou contredit la demande globale de calcul, sans être un pair pur des puces sur mesure Broadcom.'),
          blastSymbol('AMD', 'Alternative GPU et CPU datacenter', 'direct_peer', 'Mesure si la demande de calcul se diffuse au-delà du leader, avec un mix et des marges propres.'),
          blastSymbol('MRVL', 'Concurrent des puces sur mesure et du réseau', 'direct_peer', 'C’est la lecture concurrente la plus directe sur ASIC, électro-optique et connectivité datacenter.'),
          blastSymbol('ALAB', 'Connectivité PCIe et CXL', 'direct_peer', 'Teste la demande pour relier mémoire, accélérateurs et serveurs dans les clusters IA.'),
          blastSymbol('CRDO', 'Connectivité haut débit datacenter', 'direct_peer', 'Capte le besoin de bande passante; ses résultats proches peuvent dominer toute sympathie AVGO.'),
          blastSymbol('ANET', 'Réseau Ethernet pour clusters IA', 'downstream', 'Confirme que les dépenses d’accélérateurs deviennent du trafic et des ports réseau déployés.')
        ]
      },
      {
        name: 'Mémoire, fonderie, packaging et optique', order: 1,
        transmission: 'Une montée des volumes d’accélérateurs peut se convertir en HBM, wafers avancés, packaging, équipements et liaisons optiques. MU reste un thermomètre HBM, pas une preuve spécifique sur Broadcom.',
        symbols: [
          blastSymbol('MU', 'Mémoire HBM et DRAM datacenter', 'upstream', 'MU mesure le cycle mémoire lié à l’IA; ce n’est ni un concurrent des ASIC Broadcom ni un signal spécifique fiable sur ses clients.', 'medium'),
          blastSymbol('TSM', 'Fonderie avancée des puces IA', 'upstream', 'La demande Broadcom dépend de capacité avancée et de rendements de fabrication, mais TSM sert aussi de nombreux clients.'),
          blastSymbol('AMKR', 'Packaging et test externalisés', 'upstream', 'Le packaging transmet les volumes de puces, avec une intensité capitalistique et des marges très différentes.'),
          blastSymbol('LRCX', 'Équipement de fabrication mémoire et logique', 'upstream', 'Le capex semi confirme seulement le cycle d’investissement, avec un délai plus long que les revenus Broadcom.'),
          blastSymbol('COHR', 'Optique et composants datacenter', 'upstream', 'Le trafic IA soutient l’optique, mais les cycles produits et la concurrence peuvent casser ce signal de confirmation.')
        ]
      },
      {
        name: 'Clients et programmes documentés', order: 1,
        transmission: 'GOOGL, META et AAPL sont inclus pour leurs programmes ou accords Broadcom documentés. Leur cours reste dominé par leurs propres activités; une réaction isolée ne mesure pas les revenus Broadcom.',
        symbols: [
          blastSymbol('GOOGL', 'Client cloud et programme TPU', 'downstream', 'Le déploiement des TPU peut valider la demande de puces sur mesure, mais la publicité et le cloud dominent la valeur d’Alphabet.', 'medium'),
          blastSymbol('META', 'Client IA et programme MTIA', 'downstream', 'Le calendrier MTIA renseigne le volume potentiel des ASIC, mais les dépenses et revenus publicitaires propres à Meta dominent le titre.', 'medium'),
          blastSymbol('AAPL', 'Accord commercial Broadcom jusqu’en 2031', 'downstream', 'L’accord long terme améliore la visibilité d’un programme client, sans isoler son montant ni sa marge dans les dépôts disponibles.', 'medium')
        ]
      },
      {
        name: 'Systèmes et déploiement datacenter', order: 1,
        transmission: 'Les commandes de puces n’ont de valeur durable que si elles deviennent racks, serveurs et systèmes livrés. Les publications propres peuvent toutefois remplacer le signal Broadcom.',
        symbols: [
          blastSymbol('SMCI', 'Intégrateur de racks IA', 'downstream', 'Mesure la conversion en systèmes complets; financement, contrôles et fonds de roulement restent des risques autonomes.'),
          blastSymbol('DELL', 'Serveurs IA et intégration entreprise', 'downstream', 'Le backlog serveur confirme les déploiements, mais les faibles marges hardware limitent la lecture bénéficiaire.'),
          blastSymbol('HPE', 'Systèmes IA et réseau entreprise', 'downstream', 'Teste la diffusion hors hyperscalers; sa publication proche constitue un veto événementiel distinct.')
        ]
      },
      {
        name: 'Électricité, refroidissement et capex physique', order: 2,
        transmission: 'Le second ordre apparaît lorsque les clusters financés exigent refroidissement, distribution électrique, turbines et production. La réaction est plus lente et plus macro que celle des semis.',
        symbols: [
          blastSymbol('VRT', 'Refroidissement et alimentation datacenter', 'second_order', 'C’est le relais physique le plus direct entre densité de calcul, chaleur et alimentation électrique.'),
          blastSymbol('ETN', 'Distribution et équipements électriques', 'second_order', 'Bénéficie du capex de raccordement, sans dépendre uniquement des datacenters IA.'),
          blastSymbol('GEV', 'Réseau, turbines et équipements de puissance', 'second_order', 'Mesure la construction de capacité électrique; les projets ont un horizon bien plus long que la guidance trimestrielle.'),
          blastSymbol('CEG', 'Producteur nucléaire exposé aux datacenters', 'second_order', 'La demande électrique peut soutenir les contrats, mais prix de l’énergie et réglementation dominent aussi le titre.'),
          blastSymbol('VST', 'Producteur électrique et contrats de capacité', 'second_order', 'Capte la rareté de puissance, avec une sensibilité propre aux marchés électriques et au hedging.')
        ]
      },
      {
        name: 'Logiciels, réseau historique et benchmarks', order: 2,
        transmission: 'VMware ajoute une lecture logicielle distincte du silicon. Les ETF servent de contrôle de marché : ils montrent si la réaction reste Broadcom ou devient sectorielle.',
        symbols: [
          blastSymbol('CSCO', 'Réseau entreprise et infrastructure', 'direct_peer', 'Compare la diffusion réseau hors hyperscalers, avec un portefeuille moins concentré sur les accélérateurs.'),
          blastSymbol('ORCL', 'Cloud et infrastructure logicielle', 'downstream', 'Teste la demande cloud et les déploiements d’entreprise, pas la qualité du silicon Broadcom.'),
          blastSymbol('IBM', 'Infrastructure et logiciels entreprise', 'downstream', 'Offre un contrôle sur les budgets IT traditionnels; le lien à VMware reste imparfait.'),
          blastSymbol('SMH', 'ETF semiconducteurs concentré', 'sector_proxy', 'Mesure la contagion à l’ensemble des grands semiconducteurs plutôt qu’un mouvement isolé.'),
          blastSymbol('SOXX', 'ETF semiconducteurs diversifié', 'sector_proxy', 'Confirme ou contredit SMH avec une construction de portefeuille différente.'),
          blastSymbol('QQQ', 'Benchmark croissance et mégacaps', 'sector_proxy', 'Sépare un choc semiconducteurs d’un mouvement général du Nasdaq et des taux.')
        ]
      }
    ],
    scenarios: [
      { scenario: 'bullish', trigger: 'Rubrique interne, pas surprise face au consensus : revenus d’au moins 29,694 Md$ (+1% versus 29,4), revenus IA d’au moins 16,160 Md$ (+1% versus 16,0), marge opérationnelle non-GAAP d’au moins 67,5%, objectifs chiffrés suivants en hausse et aucune dégradation de la garantie conditionnelle.', firstOrder: 'MRVL, ANET, CRDO et ALAB confirment avec SMH et SOXX; GOOGL, META ou AAPL ne constituent qu’un contrôle secondaire.', secondOrder: 'VRT puis les équipements électriques valident une hausse du capex physique.', confirmation: 'Après le saut de cours, AVGO surperforme SOXX et tient le prix moyen pondéré par volume avec volume sectoriel large.', contradiction: 'Les chiffres dépassent les anciens repères mais AVGO sous-performe SOXX : le marché attendait davantage ou sanctionne la qualité du financement.' },
      { scenario: 'mixed', trigger: 'Rubrique interne : revenus entre 29,106 et 29,694 Md$, revenus IA entre 15,840 et 16,160 Md$, marge entre 66,5% et 67,5%, ou signaux opposés entre puces, logiciel, trésorerie, objectifs suivants et exposition conditionnelle.', firstOrder: 'Les interconnexions tiennent sans confirmation générale; les grands clients suivent surtout leurs catalyseurs propres.', secondOrder: 'Les valeurs électriques restent fermes sans accélérer, car le besoin électrique est déjà anticipé.', confirmation: 'Dispersion nette entre puces et logiciels, AVGO proche de SOXX et volume sélectif après une heure de séance.', contradiction: 'Tous les groupes montent ou baissent ensemble, signe d’un choc macro plutôt que d’un message Broadcom mixte.' },
      { scenario: 'bearish', trigger: 'Rubrique interne : revenus sous 29,106 Md$ (-1%), revenus IA sous 15,840 Md$ (-1%), marge sous 66,5%, objectifs suivants abaissés, trésorerie dégradée ou hausse documentée de la garantie conditionnelle, puis sous-performance face à SOXX.', firstOrder: 'MRVL, ALAB, CRDO, ANET et les ETF semiconducteurs perdent leurs supports; MU reste un thermomètre mémoire non spécifique.', secondOrder: 'VRT, ETN, GEV, CEG et VST baissent si le marché réduit aussi le capex datacenter futur.', confirmation: 'Le saut baissier reste sous le prix moyen pondéré par volume, AVGO sous-performe SOXX et les rebonds échouent.', contradiction: 'AVGO reprend vite sa performance relative malgré un chiffre sous un ancien repère, signe que le marché avait anticipé pire.' }
    ],
    contradictions: [
      'Après neutralisation de QQQ, le lien résiduel MU-AVGO devient presque nul : MU décrit le cycle HBM, pas une causalité Broadcom.',
      `Le 4 juin, après les résultats du 3 juin, AVGO a ${juneEventMoves.AVGO >= 0 ? 'gagné' : 'perdu'} ${Math.abs(juneEventMoves.AVGO).toFixed(1)}% tandis que MRVL gagnait ${juneEventMoves.MRVL.toFixed(1)}%, CRDO ${juneEventMoves.CRDO.toFixed(1)}% et TSM ${juneEventMoves.TSM.toFixed(1)}%. Ces variations sont recalculées depuis les clôtures ajustées.`,
      `Le 5 mars, AVGO a gagné ${marchEventMoves.AVGO.toFixed(1)}% tandis que MRVL perdait ${Math.abs(marchEventMoves.MRVL).toFixed(1)}%, TSM ${Math.abs(marchEventMoves.TSM).toFixed(1)}% et MU ${Math.abs(marchEventMoves.MU).toFixed(1)}%; deux événements sont insuffisants pour un bêta événementiel mais invalident un relais stable. Ces variations sont recalculées depuis les clôtures ajustées.`,
      'La plateforme Apollo-Blackstone lancée avec une tranche initiale de 35 Md$ est un dispositif de financement plus large; elle n’est ni le même montant ni une exposition à additionner automatiquement au backstop maximal de 29 Md$.',
      'Les titres power peuvent monter sur contrats, réglementation ou prix de l’électricité pendant que les semiconducteurs baissent; leur réaction n’est qu’un second ordre.',
      'DELL, CRDO et HPE publient avant ou le même jour que Broadcom; leurs gaps propres ne doivent pas être attribués à AVGO.'
    ],
    missingData: [
      'La collecte de contexte comparables est partielle : calendrier, réactions aux résultats, tendance analystes, positions vendeuses, coût d’emprunt et catalyseurs SEC ont subi des délais dépassés ou un échec de routage ETF.',
      'Les mouvements implicites de DELL, CRDO et HPE sont indisponibles hors séance; aucun saut de cours attendu n’est inventé.',
      'Certains comparables récents ou partiellement servis ont moins de soixante rendements communs; leur corrélation, bêta et R² restent indisponibles.'
    ],
    sourceRefs: [
      source('Historique AVGO et comparables, clôture certifiée', market.url, REF),
      source('Historique MU, relais mémoire HBM', 'https://finance.yahoo.com/quote/MU/history/', REF),
      source('Accord Broadcom-Apple déposé à la SEC', 'https://www.sec.gov/Archives/edgar/data/1730168/000119312526295589/d84378d8k.htm', '2026-07-06'),
      financingPlatformRef,
      source('Programmes clients IA Broadcom', secQ.url, '2026-06-09'),
      source('Calendrier earnings comparables', 'https://www.nasdaq.com/market-activity/earnings', '2026-08-30')
    ]
  },
  macro: {
    indicators: [{ name: 'Clôture de référence', value: REF, signal: 'Séance complète' }, { name: 'Résultats', value: '2 septembre AMC', signal: 'Veto binaire' }, { name: 'Régime observé le 30 août', value: 'Risk-on, confiance 50%', signal: 'À égalité avec neutre' }, { name: 'Saisonnalité août sur cinq ans', value: '-0,036% par séance; 45,5% positives', signal: 'Descriptif, non prédictif' }, { name: 'Sensibilité', value: 'Bêta 1,47', signal: 'Réaction amplifiée probable' }],
    regime: 'risk-on', impact: 'Le moteur courant partage sa probabilité à 50% entre appétit pour le risque et neutre, avec un avertissement sur seulement 28 barres TLT. Ce contexte observé le 30 août n’est pas reconstruit au 28 août et ne lève pas le veto résultats. AVGO reste un test de diffusion vers les puces sur mesure et le réseau; saisonnalité, régime et sympathie sectorielle ne remplacent ni la guidance Broadcom, ni la rétention VMware, ni la réaction en séance régulière.', sourceRefs: [regimeRef, seasonalityRef, irEvent]
  },
  risks: {
    riskScore: 7, riskProfile: 'High',
    riskSummary: `Le risque dominant est le saut de cours du 2 septembre. La liquidité historique est élevée, avec ${money(dollarAdv20)} de volume notionnel moyen sur 20 séances, mais elle ne garantit ni écart achat-vente ni prix après publication. La dette nette représente environ ${netDebtToEbitda.toFixed(2)}x l’EBITDA TTM analytique : elle est gérable au rythme actuel, mais ce ratio ne couvre pas la garantie conditionnelle de 29 Md$. Avec 43,1x EV/EBITDA, des objectifs seulement conformes peuvent comprimer le multiple. La taille reste nulle avant publication.`,
    riskCards: [
      { title: 'Saut de cours après résultats', severity: 'high', icon: 'fa-calendar-day', points: ['Publication le 2 septembre après clôture.', `Amplitude quotidienne moyenne sur 14 séances de ${px(technical.atr)} avant l’événement.`], probability: riskPolicy.earningsProbability, impact: riskPolicy.earningsImpact, verdict: 'Score de scénario, pas probabilité statistique : calendrier confirmé et amplitude moyenne supérieure à 3% du cours. Aucune taille particulière n’est justifiée avant la publication.' },
      { title: 'Valorisation et dette', severity: 'high', icon: 'fa-scale-balanced', points: ['43,1x EV/EBITDA et 24,0x EV/revenus.', '64,907 Md$ de dette comptable, dont 2,252 Md$ à court terme.', '776 M$ d’intérêts au trimestre.'], probability: riskPolicy.valuationProbability, impact: riskPolicy.valuationImpact, verdict: 'Score de scénario : multiple supérieur à 40x et dette supérieure à trois fois la trésorerie. La croissance doit rester exceptionnelle.' },
      { title: 'Backstop des racks IA', severity: 'high', icon: 'fa-server', points: ['Exposition maximale : 29 Md$.', 'Durée des loyers client : cinq ans.', 'L’exposition monte avec les déploiements et baisse avec les paiements.'], probability: 50, impact: 95, verdict: 'Score de scénario, pas probabilité de défaut : le montant maximal est documenté, mais ni l’exposition tirée actuelle ni la qualité de crédit du client ne sont publiées.' },
      { title: 'Concentration clients', severity: 'high', icon: 'fa-cloud', points: ['Un distributeur : 42% des revenus.', 'Cinq premiers clients finaux : 45%.', 'Distributeurs : 56%.'], probability: riskPolicy.concentrationProbability, impact: riskPolicy.concentrationImpact, verdict: 'Score de scénario : les seuils de concentration dépassent 40%. Un décalage d’un grand client peut casser la pente trimestrielle.' }
    ],
    pedagogy: 'Pour un particulier, une société excellente peut rester un mauvais trade juste avant ses résultats. Après le gap, refuser un écart achat-vente supérieur à 0,10% ou un glissement supérieur à 0,15%. Attendre une base de 15 minutes, puis risquer au plus 0,20% du capital et arrondir le nombre d’actions à l’entier inférieur, avec un notionnel plafonné à 5% du capital. Ces seuils sont des garde-fous génériques non calibrés par un backtest AVGO; ne pas poursuivre une ouverture verticale.',
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
    thesis: `Aucun trade avant le 2 septembre. ${px(entry)} et ${px(stop)} décrivent seulement la séance du 28 août; ils peuvent être traversés par le saut de cours. Après publication, attendre une base de 15 minutes en séance régulière et vérifier volume et prix moyen pondéré par volume. Refuser un écart achat-vente supérieur à 0,10% ou un glissement supérieur à 0,15%. Risquer au plus 0,20% du capital, arrondir le nombre d’actions à l’entier inférieur et plafonner le notionnel à 5% du capital. Ne pas poursuivre à plus de 0,75% du nouveau seuil.`,
    catalysts: ['Résultats Q3 FY2026 et nouveaux objectifs chiffrés le 2 septembre.', 'Croissance des accélérateurs personnalisés et du réseau IA.', 'Croissance du logiciel, marge et baisse mesurée de la dette comptable.'],
    invalidation: [`Toute utilisation de ${px(entry)} ou ${px(stop)} avant la publication invalide le plan.`, 'Un saut de cours qui dépasse la géométrie du 28 août exige une reconstruction complète, pas un stop élargi.', 'Après publication, aucun trade n’existe tant qu’une clôture de 15 minutes en séance régulière, un prix moyen pondéré par volume et un plus bas de range ne permettent pas de recalculer une invalidation chiffrée.'],
    status: 'wait', statusNote: 'Attendre les résultats du 2 septembre et reconstruire la structure sur des barres régulières avec volume.'
  },
  globalScore: {
    profile: 'Grille heuristique non calibrée : qualité élevée, timing bloqué',
    keyTakeawaysPositive: ['10,8 Md$ de revenus IA au Q2, +143% sur un an.', '10,262 Md$ de flux de trésorerie disponible au trimestre.', 'Le segment logiciels ajoute 7,178 Md$ de revenus, sans ventilation VMware isolée.'],
    keyTakeawaysNegative: ['Aucun trade avant les résultats du 2 septembre.', 'Valorisation de 43,1x EV/EBITDA et dette de 64,91 Md$.', `TP1 technique à seulement ${rr1.toFixed(2)}R.`],
    mindsetTip: 'La note B est une grille heuristique et non prédictive qui juge l’entreprise et ses preuves financières. Le statut attendre juge le moment d’entrée et bloque toute exécution avant les résultats.'
  },
  disclaimer: 'Analyse éducative au 30 août 2026, fondée sur la clôture complète du 28 août. Ce document n’est pas un conseil financier.',
  archiveHistory: [{ date: '2026-08-29', dateDisplay: '29 août 2026', grade: 'B', note: 'Version précédente sans blast radius complet' }, { date: '2026-08-28', dateDisplay: '28 août 2026', grade: 'B', note: 'Version initiale' }]
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(analysis, null, 2) + '\n');

const values = {};
const stringNumericClaims = {};
const methods = {};
for (const dotted of numericPaths(analysis)) {
  set(values, dotted, get(analysis, dotted));
  methods[dotted] = dotted.startsWith('tradeIdea.') ? 'Niveaux et ratios calculés depuis la barre complète du 28 août et les indicateurs MCP.'
    : dotted.startsWith('blastRadius.') ? 'Classification économique éditoriale et calcul déterministe depuis les barres comparables arrêtées au 28 août; régression confirmée contre RankBeta quand disponible.'
    : dotted.startsWith('technicals.') ? 'Indicateur MCP ou score d’affichage déterministe dérivé des indicateurs.'
      : dotted.startsWith('risks.') ? 'Barème de risque déterministe documenté par le générateur.'
        : dotted === 'verdict.score' ? 'Barème additif reproductible mais non calibré et non prédictif : politique versionnée, données instrumentales, calendrier, communiqué de résultats et 10-Q primaire.'
          : 'Valeur MCP directe ou transformation d’affichage déterministe.';
}
function collectNumericStrings(value, prefix = '') {
  if (typeof value === 'string' && /\d/.test(value)) stringNumericClaims[prefix] = value;
  else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) collectNumericStrings(child, prefix ? `${prefix}.${key}` : key);
}
collectNumericStrings(analysis);
const inputs = harness.sources.filter(row => row.required !== false).map(row => {
  const relativePath = `analyses/AVGO/_data/${row.name}.json`;
  return { path: relativePath, sha256: sha256(fs.readFileSync(path.join(ROOT, relativePath))), name: row.name };
});
for (const name of ['rank_beta', 'comparison_bars', 'comparison_context', 'comparison_earnings', 'market_regime', 'symbol_signals', 'earnings_risk', 'insider_current', 'symbol_seasonality']) {
  const relativePath = `analyses/AVGO/_data/${name}.json`;
  if (!inputs.some(row => row.name === name)) inputs.push({ path: relativePath, sha256: sha256(fs.readFileSync(path.join(ROOT, relativePath))), name });
}
inputs.push({ path: 'analyses/AVGO/_data/comparison_client_bars.json', sha256: sha256(fs.readFileSync(path.join(DATA_DIR, 'comparison_client_bars.json'))), name: 'comparison_client_bars' });
inputs.push({ path: 'analyses/AVGO/_data/sec-primary-manifest.json', sha256: sha256(fs.readFileSync(SEC_PRIMARY_MANIFEST)), name: 'sec_primary_manifest', kind: 'primary_sec_manifest_v1' });
const sourceForClaim = dotted => {
  if (dotted === 'news.3.detail' || dotted === 'blastRadius.contradictions.3') return 'sec_primary_manifest';
  if (/^blastRadius\..*eventRisk/.test(dotted)) return 'comparison_earnings';
  if (/^blastRadius\.groups\.2\./.test(dotted)) return 'comparison_client_bars';
  if (/^blastRadius\./.test(dotted)) return 'comparison_bars';
  if (/^macro\.indicators\.3\./.test(dotted)) return 'symbol_seasonality';
  if (/^macro\./.test(dotted)) return 'market_regime';
  if (/^(capitalStructure|filingsReview)\./.test(dotted)) return 'sec_primary_manifest';
  if (/^earnings\.beatNote$/.test(dotted) || /^fundamentals\.rows\.2\./.test(dotted)) return 'sec_primary_manifest';
  if (/^news\./.test(dotted)) return 'corporate_actions';
  if (/^(shortInterest|capitalFlow)\./.test(dotted)) return 'short_squeeze';
  if (/^options\./.test(dotted)) return 'instrument';
  if (/^insiders\.signal$/.test(dotted)) return 'symbol_signals';
  if (/^insiders\./.test(dotted)) return 'insiders';
  if (/^social\./.test(dotted)) return 'sentiment';
  if (/^(technicals|tradeIdea|performance)\./.test(dotted)) return dotted.startsWith('technicals.') ? 'technicals' : 'bars';
  if (/^header\.(price|changePct)$/.test(dotted) || /^header\.metrics\.(volume|range52w)$/.test(dotted)) return 'bars';
  if (/^risks\./.test(dotted)) return 'sec_primary_manifest';
  if (/^(fundamentals|earnings|business|verdict|globalScore|header)\./.test(dotted)) return /29(,0)? Md|backstop|Apollo/i.test(String(get(analysis, dotted))) ? 'sec_primary_manifest' : 'instrument';
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
  options: '/data/items/0', insiders: '/data/items/0/results/0/data', corporate_actions: '/results/0/data/0', sentiment: '/health',
  comparison_bars: '/data/items/0/results/0/data', comparison_earnings: '/events', rank_beta: '/data/items/0/rows',
  comparison_client_bars: '/data/items/0/results/0/data',
  market_regime: '/facets/regime', symbol_seasonality: '/facets/seasonality', symbol_signals: '/results/0',
  earnings_risk: '/events/0', move_explanation: '/catalysts', insider_current: '/data/items/0/results/0/data'
};
const semanticSecPointer = dotted => {
  if (dotted === 'news.3.detail' || dotted === 'blastRadius.contradictions.3') return '/semantic_findings/ai_financing_platform';
  if (/^capitalStructure\./.test(dotted)) return '/additional_reviewed_primary_urls/0';
  if (/29(,0)? Md|backstop|Apollo/i.test(String(get(analysis, dotted)))) return '/semantic_findings/q2_ai_rack_backstop';
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
const calc = { kind: 'deterministic_analysis_calculation_v1', ticker: 'AVGO', reference_close: REF, generator_path: 'tools/build-avgo-analysis.js', generator_sha256: sha256(fs.readFileSync(__filename)), analysis_sha256: sha256(analysisBytes), inputs, score_policy: { path: 'config/analysis-score-policy.json', sha256: sha256(fs.readFileSync(SCORE_POLICY)), calibration: scorePolicy.calibration, predictive_use: scorePolicy.predictive_use }, score_components: scoreComponents, valuation_scenario: { multiple: scenarioMultiple, current_multiple: stats.enterpriseToEbitda, policy_haircut_pct: scenarioHaircutPolicy * 100, rounding_multiple: 5, multiple_haircut_pct: (scenarioMultiple / stats.enterpriseToEbitda - 1) * 100, purpose: 'stress_test_not_fair_value', ebitda_basis: 'provider_ttm_analytical_not_company_gaap_or_q2_adjusted', ebitda: financial.ebitda, debt: financial.totalDebt, cash: financial.totalCash, shares: stats.sharesOutstanding, close, enterprise_value: scenarioEv, equity_value: scenarioEquity, price: scenarioPrice, downside_pct: scenarioDownside, ebitda_required_at_current_ev: ebitdaRequiredAtScenarioMultiple, ebitda_required_growth_pct: ebitdaRequiredGrowth }, risk_policy: riskPolicy, claim_provenance: claimProvenance, values, string_numeric_claims: stringNumericClaims, methods };
fs.writeFileSync(CALC, JSON.stringify(calc, null, 2) + '\n');
const calcBytes = fs.readFileSync(CALC);
const numericPathSet = new Set(numericPaths(analysis));
const claims = claimPaths.map(dotted => ({ path: dotted, value: get(analysis, dotted), as_of: REF, source_artifact: 'analyses/AVGO/_data/calculations.json', source_sha256: sha256(calcBytes), source_pointer: numericPathSet.has(dotted) ? `/values/${dotted.split('.').join('/')}` : `/string_numeric_claims/${dotted}`, provenance: claimProvenance[dotted] }));
fs.mkdirSync(path.dirname(EVIDENCE), { recursive: true });
fs.writeFileSync(EVIDENCE, JSON.stringify({ ticker: 'AVGO', reference_close: REF, analysis_path: 'data/analyses-data/AVGO.json', analysis_sha256: sha256(analysisBytes), claims }, null, 2) + '\n');
console.log(`[AVGO] B ${score}/100, wait, ${claims.length} numeric claims`);
