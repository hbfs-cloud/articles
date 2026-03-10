/**
 * Webull data module
 * Uses public Webull internal API (no auth required for public data)
 * Provides: rankings (gainers, losers, active), quotes, search, charts
 * Header: appid: webull-webapp
 */

import * as cache from './cache.js';

const BASE = 'https://quotes-gw.webullfintech.com';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
  'appid': 'webull-webapp'
};

// ── Fetch with cache ──
async function wb(url, ttlKey, ttl = 60) {
  const cached = cache.get(ttlKey);
  if (cached) return cached;

  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Webull ${res.status}: ${url}`);
  const data = await res.json();
  cache.set(ttlKey, data, ttl);
  return data;
}

// ── Normalize a Webull ranking item ──
// Rankings API returns { ticker: {...}, values: {...} } per item
function normalizeRankItem(item) {
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
// RANKINGS (top gainers, losers, most active)
// regionId=6 = US, rankType=1d = daily
// ══════════════════════════════════════

export async function getTopGainers({ regionId = 6, pageSize = 20 } = {}) {
  const url = `${BASE}/api/wlas/ranking/topGainers?regionId=${regionId}&rankType=1d&pageIndex=1&pageSize=${pageSize}`;
  const data = await wb(url, `wb:gainers:${regionId}:${pageSize}`, 120);
  return (data?.data || data || []).map(normalizeRankItem);
}

export async function getTopLosers({ regionId = 6, pageSize = 20 } = {}) {
  const url = `${BASE}/api/wlas/ranking/dropGainers?regionId=${regionId}&rankType=1d&pageIndex=1&pageSize=${pageSize}`;
  const data = await wb(url, `wb:losers:${regionId}:${pageSize}`, 120);
  return (data?.data || data || []).map(normalizeRankItem);
}

export async function getMostActive({ regionId = 6, pageSize = 20 } = {}) {
  const url = `${BASE}/api/wlas/ranking/topActive?regionId=${regionId}&rankType=volume&pageIndex=1&pageSize=${pageSize}`;
  const data = await wb(url, `wb:active:${regionId}:${pageSize}`, 120);
  return (data?.data || data || []).map(normalizeRankItem);
}

// ══════════════════════════════════════
// SEARCH — find tickerId by symbol
// ══════════════════════════════════════

export async function searchTicker(keyword, { regionId = 6, pageSize = 10 } = {}) {
  const url = `${BASE}/api/search/pc/tickers?keyword=${encodeURIComponent(keyword)}&pageIndex=1&pageSize=${pageSize}&regionId=${regionId}`;
  const data = await wb(url, `wb:search:${keyword}`, 300);
  const list = data?.data || data || [];
  return list.map(item => ({
    tickerId: item.tickerId,
    symbol: item.symbol || item.disSymbol,
    name: item.name || item.disName,
    exchange: item.exchangeCode || item.disExchangeCode,
    type: item.template || item.type
  }));
}

// ══════════════════════════════════════
// QUOTE — detailed quote by tickerId
// Requires tickerId (use searchTicker first)
// ══════════════════════════════════════

export async function getQuote(tickerId) {
  const url = `${BASE}/api/stock/tickerRealTime/getQuote?tickerId=${tickerId}&includeSecu=1&includeQuote=1&more=1`;
  const data = await wb(url, `wb:quote:${tickerId}`, 30);
  return data;
}

// Convenience: search + quote in one call
export async function getQuoteBySymbol(symbol) {
  const results = await searchTicker(symbol, { pageSize: 1 });
  if (!results.length) throw new Error(`Webull: symbol "${symbol}" not found`);
  const tickerId = results[0].tickerId;
  const quote = await getQuote(tickerId);
  return { ...results[0], quote };
}

// ══════════════════════════════════════
// CHARTS — OHLCV bars
// type: m1, m5, m15, m30, m60, d1, w1, mo1
// ══════════════════════════════════════

export async function getChart(tickerId, { type = 'd1', count = 60 } = {}) {
  const url = `${BASE}/api/quote/charts/query?tickerIds=${tickerId}&type=${type}&count=${count}`;
  const data = await wb(url, `wb:chart:${tickerId}:${type}:${count}`, 120);

  // Webull returns array of strings: "timestamp,open,close,high,low,volume,..."
  const raw = data?.[0]?.data || [];
  return raw.map(line => {
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
}

// Convenience: search + chart in one call
export async function getChartBySymbol(symbol, opts = {}) {
  const results = await searchTicker(symbol, { pageSize: 1 });
  if (!results.length) throw new Error(`Webull: symbol "${symbol}" not found`);
  return {
    symbol: results[0].symbol,
    name: results[0].name,
    tickerId: results[0].tickerId,
    bars: await getChart(results[0].tickerId, opts)
  };
}
