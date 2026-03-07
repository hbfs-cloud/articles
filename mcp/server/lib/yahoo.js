/**
 * Yahoo Finance data module
 * Uses public Yahoo Finance v8/v10 API (no key required)
 * Provides: quotes, bars, financials, options, news, insider transactions
 */

import * as cache from './cache.js';

const BASE = 'https://query1.finance.yahoo.com';
const BASE2 = 'https://query2.finance.yahoo.com';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json'
};

// ── Fetch with retry ──
async function yf(url, ttlKey, ttl = 60) {
  const cached = cache.get(ttlKey);
  if (cached) return cached;

  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Yahoo ${res.status}: ${url}`);
  const data = await res.json();
  cache.set(ttlKey, data, ttl);
  return data;
}

// ══════════════════════════════════════
// QUOTES (realtime-ish, 15s cache)
// ══════════════════════════════════════

export async function getQuotes(symbols) {
  const syms = Array.isArray(symbols) ? symbols : [symbols];
  const url = `${BASE}/v7/finance/quote?symbols=${syms.join(',')}`;
  const data = await yf(url, `quote:${syms.join(',')}`, 15);
  const results = data?.quoteResponse?.result || [];
  return results.map(q => ({
    symbol: q.symbol,
    price: q.regularMarketPrice,
    change: q.regularMarketChange,
    changePct: q.regularMarketChangePercent,
    volume: q.regularMarketVolume,
    avgVolume: q.averageDailyVolume3Month,
    rvol: q.averageDailyVolume3Month ? +(q.regularMarketVolume / q.averageDailyVolume3Month).toFixed(2) : null,
    high: q.regularMarketDayHigh,
    low: q.regularMarketDayLow,
    open: q.regularMarketOpen,
    previousClose: q.regularMarketPreviousClose,
    marketCap: q.marketCap,
    pe: q.trailingPE,
    forwardPe: q.forwardPE,
    fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: q.fiftyTwoWeekLow,
    fiftyDayAvg: q.fiftyDayAverage,
    twoHundredDayAvg: q.twoHundredDayAverage,
    shortName: q.shortName,
    exchange: q.exchange,
    marketState: q.marketState,
    preMarketPrice: q.preMarketPrice,
    postMarketPrice: q.postMarketPrice
  }));
}

// ══════════════════════════════════════
// CHART / BARS (OHLCV)
// ══════════════════════════════════════

export async function getBars(symbol, interval = '1d', range = '6mo') {
  // interval: 1m,2m,5m,15m,30m,60m,90m,1h,1d,5d,1wk,1mo,3mo
  // range: 1d,5d,1mo,3mo,6mo,1y,2y,5y,10y,ytd,max
  const url = `${BASE2}/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
  const ttl = interval.includes('m') || interval === '1h' ? 60 : 300;
  const data = await yf(url, `bars:${symbol}:${interval}:${range}`, ttl);

  const result = data?.chart?.result?.[0];
  if (!result) return { symbol, bars: [] };

  const timestamps = result.timestamp || [];
  const ohlcv = result.indicators?.quote?.[0] || {};
  const adj = result.indicators?.adjclose?.[0]?.adjclose;

  const bars = timestamps.map((ts, i) => ({
    time: new Date(ts * 1000).toISOString(),
    open: ohlcv.open?.[i],
    high: ohlcv.high?.[i],
    low: ohlcv.low?.[i],
    close: ohlcv.close?.[i],
    volume: ohlcv.volume?.[i],
    adjClose: adj?.[i]
  })).filter(b => b.close != null);

  return {
    symbol,
    interval,
    range,
    bars,
    meta: {
      currency: result.meta?.currency,
      exchange: result.meta?.exchangeName,
      timezone: result.meta?.exchangeTimezoneName
    }
  };
}

// ══════════════════════════════════════
// OPTIONS CHAIN
// ══════════════════════════════════════

export async function getOptions(symbol, date = null) {
  let url = `${BASE}/v7/finance/options/${symbol}`;
  if (date) url += `?date=${date}`;
  const data = await yf(url, `options:${symbol}:${date || 'current'}`, 600);

  const result = data?.optionChain?.result?.[0];
  if (!result) return { symbol, expirations: [], calls: [], puts: [] };

  const expirations = result.expirationDates?.map(d => new Date(d * 1000).toISOString().split('T')[0]) || [];
  const quote = result.quote || {};

  const mapContract = c => ({
    strike: c.strike,
    expiration: new Date(c.expiration * 1000).toISOString().split('T')[0],
    type: c.contractSymbol?.includes('C') ? 'call' : 'put',
    lastPrice: c.lastPrice,
    bid: c.bid,
    ask: c.ask,
    volume: c.volume,
    openInterest: c.openInterest,
    impliedVolatility: c.impliedVolatility,
    inTheMoney: c.inTheMoney,
    contractSymbol: c.contractSymbol
  });

  return {
    symbol,
    underlyingPrice: quote.regularMarketPrice,
    expirations,
    calls: (result.options?.[0]?.calls || []).map(mapContract),
    puts: (result.options?.[0]?.puts || []).map(mapContract)
  };
}

// ══════════════════════════════════════
// FINANCIALS (income, balance, cash flow)
// ══════════════════════════════════════

export async function getFinancials(symbol, module = 'financialData') {
  // modules: financialData, defaultKeyStatistics, incomeStatementHistory,
  //          balanceSheetHistory, cashflowStatementHistory, earnings,
  //          recommendationTrend, upgradeDowngradeHistory, insiderTransactions,
  //          institutionOwnership, majorHoldersBreakdown
  const url = `${BASE2}/v10/finance/quoteSummary/${symbol}?modules=${module}`;
  const data = await yf(url, `fin:${symbol}:${module}`, 86400);
  return data?.quoteSummary?.result?.[0]?.[module] || {};
}

export async function getInsiderTransactions(symbol) {
  const data = await getFinancials(symbol, 'insiderTransactions');
  const txns = data?.transactions || [];
  return txns.map(t => ({
    name: t.filerName,
    relation: t.filerRelation,
    date: t.startDate?.fmt,
    type: t.transactionText,
    shares: t.shares?.raw,
    value: t.value?.raw
  }));
}

export async function getInstitutionalHolders(symbol) {
  const data = await getFinancials(symbol, 'institutionOwnership');
  const holders = data?.ownershipList || [];
  return holders.map(h => ({
    name: h.organization,
    shares: h.position?.raw,
    value: h.value?.raw,
    pctHeld: h.pctHeld?.raw,
    change: h.pctChange?.raw,
    reportDate: h.reportDate?.fmt
  }));
}

// ══════════════════════════════════════
// NEWS
// ══════════════════════════════════════

export async function getNews(symbol, count = 20) {
  const url = `${BASE2}/v1/finance/search?q=${symbol}&quotesCount=0&newsCount=${count}`;
  const data = await yf(url, `news:${symbol}`, 300);
  const news = data?.news || [];
  return news.map(n => ({
    title: n.title,
    publisher: n.publisher,
    link: n.link,
    publishedAt: n.providerPublishTime ? new Date(n.providerPublishTime * 1000).toISOString() : null,
    thumbnail: n.thumbnail?.resolutions?.[0]?.url
  }));
}

// ══════════════════════════════════════
// EARNINGS CALENDAR
// ══════════════════════════════════════

export async function getEarnings(symbol) {
  const data = await getFinancials(symbol, 'earnings');
  return {
    quarterly: (data?.earningsChart?.quarterly || []).map(q => ({
      date: q.date,
      actual: q.actual?.raw,
      estimate: q.estimate?.raw
    })),
    financialCurrency: data?.financialCurrency
  };
}

// ══════════════════════════════════════
// KEY STATISTICS
// ══════════════════════════════════════

export async function getKeyStats(symbol) {
  const data = await getFinancials(symbol, 'defaultKeyStatistics');
  return {
    beta: data?.beta?.raw,
    pegRatio: data?.pegRatio?.raw,
    shortRatio: data?.shortRatio?.raw,
    shortPercentOfFloat: data?.shortPercentOfFloat?.raw,
    sharesOutstanding: data?.sharesOutstanding?.raw,
    floatShares: data?.floatShares?.raw,
    sharesShort: data?.sharesShort?.raw,
    heldPercentInsiders: data?.heldPercentInsiders?.raw,
    heldPercentInstitutions: data?.heldPercentInstitutions?.raw,
    earningsDate: data?.earningsDate?.fmt,
    fiftyTwoWeekChange: data?.['52WeekChange']?.raw,
    forwardEps: data?.forwardEps?.raw,
    trailingEps: data?.trailingEps?.raw,
    bookValue: data?.bookValue?.raw,
    priceToBook: data?.priceToBook?.raw,
    enterpriseValue: data?.enterpriseValue?.raw
  };
}
