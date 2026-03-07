/**
 * Binance public data module
 * REST API for bars + WebSocket for realtime
 * No API key required for public endpoints
 */

import WebSocket from 'ws';
import * as cache from './cache.js';

const REST = 'https://api.binance.com/api/v3';

// ══════════════════════════════════════
// REST — Bars (Klines)
// ══════════════════════════════════════

export async function getBars(symbol, interval = '1d', limit = 100) {
  // intervals: 1m,3m,5m,15m,30m,1h,2h,4h,6h,8h,12h,1d,3d,1w,1M
  const key = `binance:bars:${symbol}:${interval}:${limit}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const url = `${REST}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance ${res.status}: ${url}`);
  const raw = await res.json();

  const bars = raw.map(k => ({
    time: new Date(k[0]).toISOString(),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
    quoteVolume: parseFloat(k[7]),
    trades: k[8]
  }));

  const ttl = interval.includes('m') ? 30 : 300;
  cache.set(key, { symbol, interval, bars }, ttl);
  return { symbol, interval, bars };
}

// ══════════════════════════════════════
// REST — Ticker / Quote
// ══════════════════════════════════════

export async function getTicker(symbol) {
  const key = `binance:ticker:${symbol}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const url = `${REST}/ticker/24hr?symbol=${symbol}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance ${res.status}`);
  const t = await res.json();

  const result = {
    symbol: t.symbol,
    price: parseFloat(t.lastPrice),
    change: parseFloat(t.priceChange),
    changePct: parseFloat(t.priceChangePercent),
    high: parseFloat(t.highPrice),
    low: parseFloat(t.lowPrice),
    volume: parseFloat(t.volume),
    quoteVolume: parseFloat(t.quoteVolume),
    trades: t.count,
    weightedAvgPrice: parseFloat(t.weightedAvgPrice)
  };

  cache.set(key, result, 15);
  return result;
}

// ══════════════════════════════════════
// REST — Batch Ticker (multiple symbols)
// ══════════════════════════════════════

export async function getMultiTicker(symbols) {
  const syms = symbols.map(s => s.toUpperCase());
  const key  = `binance:multi:${syms.join(',')}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const url = `${REST}/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(syms))}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance ${res.status}`);
  const data = await res.json();

  const result = data.map(t => ({
    symbol:           t.symbol,
    price:            parseFloat(t.lastPrice),
    change:           parseFloat(t.priceChange),
    changePct:        parseFloat(t.priceChangePercent),
    high:             parseFloat(t.highPrice),
    low:              parseFloat(t.lowPrice),
    open:             parseFloat(t.openPrice),
    volume:           parseFloat(t.volume),        // base asset volume
    quoteVolume:      parseFloat(t.quoteVolume),   // USD volume
    trades:           t.count,
    weightedAvgPrice: parseFloat(t.weightedAvgPrice),
  }));

  cache.set(key, result, 15);
  return result;
}

// ══════════════════════════════════════
// REST — Order Book (depth)
// ══════════════════════════════════════

export async function getOrderBook(symbol, limit = 20) {
  const url = `${REST}/depth?symbol=${symbol}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance ${res.status}`);
  const data = await res.json();

  return {
    symbol,
    bids: data.bids.map(([price, qty]) => ({ price: parseFloat(price), qty: parseFloat(qty) })),
    asks: data.asks.map(([price, qty]) => ({ price: parseFloat(price), qty: parseFloat(qty) })),
    spread: parseFloat(data.asks[0]?.[0]) - parseFloat(data.bids[0]?.[0])
  };
}

// ══════════════════════════════════════
// WEBSOCKET — Realtime streams
// ══════════════════════════════════════

let ws = null;
const subscribers = new Map(); // symbol -> Set<callback>

export function subscribe(symbols, callback) {
  const syms = Array.isArray(symbols) ? symbols : [symbols];

  for (const sym of syms) {
    const key = sym.toLowerCase();
    if (!subscribers.has(key)) subscribers.set(key, new Set());
    subscribers.get(key).add(callback);
  }

  ensureWebSocket(syms);
}

export function unsubscribe(symbol, callback) {
  const key = symbol.toLowerCase();
  const subs = subscribers.get(key);
  if (subs) {
    subs.delete(callback);
    if (subs.size === 0) subscribers.delete(key);
  }
}

function ensureWebSocket(symbols) {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  const streams = [...subscribers.keys()].map(s => `${s}@miniTicker`).join('/');
  const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;

  ws = new WebSocket(url);

  ws.on('open', () => {
    console.log('[Binance WS] Connected');
  });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      const data = msg.data;
      if (!data || !data.s) return;

      const tick = {
        symbol: data.s,
        price: parseFloat(data.c),
        high: parseFloat(data.h),
        low: parseFloat(data.l),
        volume: parseFloat(data.v),
        quoteVolume: parseFloat(data.q),
        time: new Date(data.E).toISOString()
      };

      const key = data.s.toLowerCase();
      const subs = subscribers.get(key);
      if (subs) {
        for (const cb of subs) cb(tick);
      }
    } catch (e) {
      // ignore parse errors
    }
  });

  ws.on('close', () => {
    console.log('[Binance WS] Disconnected, reconnecting in 5s...');
    setTimeout(() => ensureWebSocket([]), 5000);
  });

  ws.on('error', (err) => {
    console.error('[Binance WS] Error:', err.message);
  });
}

export function disconnect() {
  if (ws) {
    ws.close();
    ws = null;
  }
  subscribers.clear();
}
