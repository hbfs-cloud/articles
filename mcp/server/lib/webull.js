/**
 * Webull data module — comprehensive
 * Public API on quotes-gw.webullfintech.com (no auth required)
 *
 * Consolidated into 7 high-level functions matching 7 MCP tools:
 *   getMarket()    — overview, rankings, sectors, ETFs, breadth
 *   getQuote()     — full quote + optional capital flow + order book
 *   getChart()     — OHLCV bars (stock + crypto, all intervals)
 *   runScreener()  — POST screener with 10 filter rules
 *   getCalendar()  — earnings, dividends, splits
 *   getSocial()    — sentiment, posts, news per ticker
 *   searchTicker() — ticker search by keyword
 */

import * as cache from './cache.js';

const BASE = 'https://quotes-gw.webullfintech.com';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
  'appid': 'webull-webapp'
};

// ── Fetch helpers ──

async function wb(url, ttlKey, ttl = 60) {
  const cached = cache.get(ttlKey);
  if (cached) return cached;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Webull ${res.status}: ${url}`);
  const data = await res.json();
  cache.set(ttlKey, data, ttl);
  return data;
}

async function wbPost(url, body, ttlKey, ttl = 60) {
  const cached = cache.get(ttlKey);
  if (cached) return cached;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Webull POST ${res.status}: ${url}`);
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  cache.set(ttlKey, data, ttl);
  return data;
}

// ── Internal: resolve symbol → tickerId ──

async function resolveTickerId(symbol) {
  const results = await searchTicker(symbol, { pageSize: 1 });
  if (!results.length) throw new Error(`Webull: symbol "${symbol}" not found`);
  return results[0];
}

// ══════════════════════════════════════
// 1. MARKET OVERVIEW (mega endpoint)
//    Indices, gainers, losers, active, sectors, ETFs, breadth
// ══════════════════════════════════════

export async function getMarket({ regionId = 6 } = {}) {
  const url = `${BASE}/api/bgw/market/index?regionId=${regionId}`;
  const raw = await wb(url, `wb:market:${regionId}`, 120);

  // Response is { groups: [ { name, type, data?, tabs? }, ... ] }
  const groups = raw?.groups || [];
  const result = {};

  // Map group names to output keys
  const GROUP_MAP = {
    'Market Index': 'indices',
    'Decliners & Advancers': 'breadth',
    'Net Inflow': 'netInflow',
    'Top Gainers': 'gainers',
    'Top Losers': 'losers',
    'Most Active': 'actives',
    'Most Popular ETFs': 'hotETFs',
    'Best-Performing Industries': 'hotSectors',
    'Tools': 'tools'
  };

  for (const group of groups) {
    const outKey = GROUP_MAP[group.name] || group.name;

    if (outKey === 'indices' && group.data) {
      result.indices = group.data.map(normalizeMarketItem);
    } else if (outKey === 'breadth' || outKey === 'netInflow') {
      result[outKey] = group.data || group;
    } else if (outKey === 'tools') {
      continue; // skip navigation refs
    } else if (group.tabs || group.data) {
      // Tabbed groups: gainers, losers, actives, hotSectors, hotETFs
      result[outKey] = {};
      if (group.tabs) {
        for (const tab of group.tabs) {
          const tabName = tab.name || tab.tabName;
          result[outKey][tabName] = (tab.data || []).map(normalizeMarketItem);
        }
      }
      if (group.data) {
        result[outKey]._active = group.data.map(normalizeMarketItem);
      }
    }
  }

  return result;
}

function normalizeMarketItem(item) {
  const t = item.ticker || item;
  const v = item.values || {};
  return {
    tickerId: t.tickerId,
    symbol: t.symbol || t.disSymbol,
    name: t.name || t.disName,
    exchange: t.exchangeCode || t.disExchangeCode,
    price: parseFloat(v.price || t.close || t.price || 0),
    change: parseFloat(v.change || t.change || 0),
    changePct: parseFloat((v.changeRatio || t.changeRatio) ? ((v.changeRatio || t.changeRatio) * 100).toFixed(2) : 0),
    volume: parseInt(t.volume || 0, 10),
    turnoverRate: parseFloat(t.turnoverRate || 0),
    marketCap: parseFloat(t.marketValue || t.mkCap || 0)
  };
}

// ══════════════════════════════════════
// 2. QUOTE — full detail + optional extras
//    include: ["flow", "depth"] for capital flow & order book
// ══════════════════════════════════════

export async function getQuote(symbol, { include = [] } = {}) {
  const ticker = await resolveTickerId(symbol);
  const tid = ticker.tickerId;

  // Base quote (78 fields)
  const quoteUrl = `${BASE}/api/stock/tickerRealTime/getQuote?tickerId=${tid}&includeSecu=1&includeQuote=1&more=1`;
  const quote = await wb(quoteUrl, `wb:quote:${tid}`, 30);

  const result = { ...ticker, quote };

  // Capital flow
  if (include.includes('flow')) {
    try {
      const flowUrl = `${BASE}/api/wlas/capitalflow/ticker?tickerId=${tid}&showHis=true`;
      result.capitalFlow = await wb(flowUrl, `wb:flow:${tid}`, 120);
    } catch { result.capitalFlow = null; }
  }

  // Order book depth (market hours only)
  if (include.includes('depth')) {
    try {
      const depthUrl = `${BASE}/api/stock/tickerRealTime/getDepth?tickerId=${tid}`;
      result.depth = await wb(depthUrl, `wb:depth:${tid}`, 15);
    } catch { result.depth = null; }
  }

  return result;
}

// ══════════════════════════════════════
// 3. CHART — OHLCV bars, stock + crypto
//    type: m1, m5, m15, m30, m60, d1, w1
//    crypto: set crypto=true for crypto chart endpoint
// ══════════════════════════════════════

export async function getChart(symbol, { type = 'd1', count = 60, crypto = false } = {}) {
  const ticker = await resolveTickerId(symbol);
  const tid = ticker.tickerId;

  const endpoint = crypto ? 'crypto/charts/query' : 'quote/charts/query';
  const url = `${BASE}/api/${endpoint}?tickerIds=${tid}&type=${type}&count=${count}`;
  const data = await wb(url, `wb:chart:${tid}:${type}:${count}:${crypto}`, 120);

  const raw = data?.[0]?.data || [];
  const bars = raw.map(line => {
    const parts = typeof line === 'string' ? line.split(',') : [];
    if (parts.length < 6) return null;
    return {
      timestamp: parts[0],
      open: parseFloat(parts[1]),
      close: parseFloat(parts[2]),
      high: parseFloat(parts[3]),
      low: parseFloat(parts[4]),
      volume: parseInt(parts[5], 10),
      vwap: parts[6] ? parseFloat(parts[6]) : null
    };
  }).filter(Boolean);

  return { symbol: ticker.symbol, name: ticker.name, tickerId: tid, bars };
}

// ══════════════════════════════════════
// 4. SCREENER — POST with filter rules
//    rules: { price: "10-500", volume: ">1000000", ... }
// ══════════════════════════════════════

const SCREENER_RULES = ['price', 'changeRatio', 'volume', 'pe', 'eps', 'roe', 'yield', 'dividend', 'turnoverRate'];

export async function runScreener({ regionId = 6, rules = {}, sort, sortDesc = true, fetch: limit = 20 } = {}) {
  const body = {
    fetch: limit,
    rules: {
      'wlas.screener.rule.region': `securities.region.name.${regionId}`
    },
    sort: sort ? { rule: `wlas.screener.rule.${sort}`, desc: String(sortDesc) } : undefined,
    attach: { hkexPrivilege: 'true' }
  };

  // Map user-friendly rules to API format
  for (const [key, val] of Object.entries(rules)) {
    if (!SCREENER_RULES.includes(key)) continue;
    if (typeof val === 'string') {
      body.rules[`wlas.screener.rule.${key}`] = val;
    } else if (typeof val === 'object' && val !== null) {
      // { min: 10, max: 500 } → "gte=10&lte=500"
      const parts = [];
      if (val.min !== undefined) parts.push(`gte=${val.min}`);
      if (val.max !== undefined) parts.push(`lte=${val.max}`);
      body.rules[`wlas.screener.rule.${key}`] = parts.join('&');
    }
  }

  const cacheKey = `wb:screener:${JSON.stringify(body)}`;
  const url = `${BASE}/api/wlas/screener/ng/query`;
  const data = await wbPost(url, body, cacheKey, 120);

  // items is an array-like object { "0": {...}, "1": {...} } or real array
  const raw = data?.items || data?.data || [];
  const items = Array.isArray(raw) ? raw : Object.values(raw);
  return { total: data?.total || items.length, items: items.map(normalizeMarketItem) };
}

// ══════════════════════════════════════
// 5. CALENDAR — earnings, dividends, splits
//    type: "earnings" | "dividend" | "splits"
// ══════════════════════════════════════

export async function getCalendar({ type = 'earnings', regionId = 6, startDate, pageSize = 30, pageIndex = 1 } = {}) {
  const validTypes = ['earnings', 'dividend', 'splits'];
  if (!validTypes.includes(type)) throw new Error(`Calendar type must be: ${validTypes.join(', ')}`);

  const start = startDate || new Date().toISOString().split('T')[0];
  const url = `${BASE}/api/bgw/explore/calendar/${type}?regionId=${regionId}&pageIndex=${pageIndex}&pageSize=${pageSize}&startDate=${start}`;
  const data = await wb(url, `wb:calendar:${type}:${regionId}:${start}:${pageIndex}`, 300);

  return data?.data || data || [];
}

// ══════════════════════════════════════
// 6. SOCIAL — sentiment, posts, news per ticker
//    include: ["sentiment", "posts", "news"]
// ══════════════════════════════════════

export async function getSocial(symbol, { include = ['sentiment'] } = {}) {
  const ticker = await resolveTickerId(symbol);
  const tid = ticker.tickerId;
  const result = { symbol: ticker.symbol, name: ticker.name, tickerId: tid };

  // Social sentiment (topic metadata: post count, views, followers)
  if (include.includes('sentiment')) {
    try {
      const url = `${BASE}/api/social/feed/topic/${tid}/home?size=1`;
      result.sentiment = await wb(url, `wb:social:${tid}`, 300);
    } catch { result.sentiment = null; }
  }

  // Social posts
  if (include.includes('posts')) {
    try {
      const url = `${BASE}/api/social/feed/topic/${tid}/posts?size=20`;
      result.posts = await wb(url, `wb:posts:${tid}`, 300);
    } catch { result.posts = null; }
  }

  // Ticker news
  if (include.includes('news')) {
    try {
      const url = `${BASE}/api/information/news/tickerNews?tickerId=${tid}&currentNewsId=0&pageSize=20`;
      result.news = await wb(url, `wb:news:${tid}`, 120);
    } catch { result.news = null; }
  }

  return result;
}

// ══════════════════════════════════════
// 7. SEARCH — find tickers by keyword
// ══════════════════════════════════════

export async function searchTicker(keyword, { regionId = 6, pageSize = 10 } = {}) {
  const url = `${BASE}/api/search/pc/tickers?keyword=${encodeURIComponent(keyword)}&pageIndex=1&pageSize=${pageSize}&regionId=${regionId}`;
  const data = await wb(url, `wb:search:${keyword}:${regionId}`, 300);
  const list = data?.data || data || [];
  return list.map(item => ({
    tickerId: item.tickerId,
    symbol: item.symbol || item.disSymbol,
    name: item.name || item.disName,
    exchange: item.exchangeCode || item.disExchangeCode,
    type: item.template || item.type
  }));
}
