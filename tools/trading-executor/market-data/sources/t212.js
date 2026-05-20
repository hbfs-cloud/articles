'use strict';

// Trading 212 Charting API source — real-time price + multi-timeframe OHLCV bars.
// https://live.services.trading212.com/charting — public, no auth required.
// Uses node:fetch with browser-equivalent headers; the Cloudflare gate accepts
// standard Chrome headers (verified 2026-05-20). Previously used CycleTLS which
// became flaky as the JA3 fingerprint and Cloudflare bot-detection rotated.
// Supports: 1m, 5m, 15m, 30m, 1h, 4h (ohlc endpoint) + 1d, 1w (closes endpoint).

const { Tick, Bar } = require('../types');

const BASE_URL = 'https://live.services.trading212.com/charting';
const RATE_LIMIT_MS = 200; // 5 req/s conservative

// Timeframe → T212 period string
const TF_MAP = {
  '1m': 'ONE_MINUTE',
  '5m': 'FIVE_MINUTES',
  '15m': 'FIFTEEN_MINUTES',
  '30m': 'THIRTY_MINUTES',
  '1h': 'ONE_HOUR',
  '4h': 'FOUR_HOURS',
  '1d': 'ONE_DAY',
  '1w': 'ONE_WEEK',
};

const INTRADAY_TFS = new Set(['1m', '5m', '15m', '30m', '1h', '4h']);

const CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

class T212Source {
  constructor(opts = {}) {
    this.verbose = opts.verbose || false;
    this._lastRequest = 0;
    this._requestCount = 0;
    this._lastError = null;
    this._tickerCache = new Map();
  }

  get name() { return 't212'; }
  get isStreaming() { return false; }

  async getQuote(symbol) {
    const ticker = this._toTicker(symbol);
    const data = await this._request(`/v2/json/preview/extended/deviation?ticker=${ticker}`);
    if (!data || data.close == null) return null;

    return new Tick({
      symbol,
      price: data.close,
      bid: null,
      ask: null,
      dayHigh: null,
      dayLow: null,
      dayVolume: 0,
      ts: data.timestamp ? parseInt(data.timestamp, 10) * 1000 : Date.now(),
      session: data.marketSession || null,
      source: 't212',
    });
  }

  async getBars(symbol, timeframe, count = 100) {
    const ticker = this._toTicker(symbol);
    const period = TF_MAP[timeframe];
    if (!period) return null;

    const endpoint = INTRADAY_TFS.has(timeframe)
      ? `/v1/ohlc/${period}?ticker=${ticker}&size=${count}&extHours=true`
      : `/v1/closes/${period}?ticker=${ticker}&size=${count}&extHours=true`;

    const data = await this._request(endpoint);
    if (!data || !Array.isArray(data.candles) || !data.candles.length) return null;

    const isIntraday = INTRADAY_TFS.has(timeframe);
    const dur = this._tfDurationMs(timeframe);

    return data.candles.map(c => {
      // Intraday OHLC format: [ts, open, high, low, close, volume, session]
      // Daily closes format:  [ts, close]
      if (isIntraday) {
        const [ts, open, high, low, close, volume, session] = c;
        return new Bar({
          symbol, timeframe,
          open, high, low, close,
          volume: volume || 0,
          ts: ts * 1000,
          tsEnd: ts * 1000 + dur,
          session: session || null,
          source: 't212',
        });
      }
      const [ts, close] = c;
      return new Bar({
        symbol, timeframe,
        open: close, high: close, low: close, close,
        volume: 0,
        ts: ts * 1000,
        tsEnd: ts * 1000 + dur,
        session: null,
        source: 't212',
      });
    });
  }

  _toTicker(symbol) {
    if (this._tickerCache.has(symbol)) return this._tickerCache.get(symbol);
    const s = symbol.toUpperCase().replace('.', '_');
    const ticker = s.includes('_') ? s : `${s}_US_EQ`;
    this._tickerCache.set(symbol, ticker);
    return ticker;
  }

  _tfDurationMs(tf) {
    const map = { '1m': 60e3, '5m': 300e3, '15m': 900e3, '30m': 1800e3, '1h': 3600e3, '4h': 14400e3, '1d': 86400e3, '1w': 604800e3 };
    return map[tf] || 86400e3;
  }

  async _request(pathStr) {
    // Rate limiting
    const now = Date.now();
    const wait = RATE_LIMIT_MS - (now - this._lastRequest);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    this._lastRequest = Date.now();
    this._requestCount++;

    const url = `${BASE_URL}${pathStr}`;
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 15_000);

    try {
      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': CHROME_UA,
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.trading212.com/',
          'Origin': 'https://www.trading212.com',
          'sec-ch-ua': '"Chromium";v="131", "Not_A Brand";v="24"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-site',
        },
        signal: controller.signal,
      });

      if (resp.status !== 200) {
        this._lastError = `http_${resp.status}`;
        if (this.verbose) console.log(`[t212] ${resp.status} on ${pathStr}`);
        return null;
      }

      return await resp.json();
    } catch (e) {
      this._lastError = e.name === 'AbortError' ? 'timeout' : (e.message || 'request_failed');
      if (this.verbose) console.log(`[t212] error: ${this._lastError}`);
      return null;
    } finally {
      clearTimeout(tid);
    }
  }

  async destroy() { /* no-op: native fetch holds no resources */ }
}

module.exports = T212Source;
