'use strict';

// Trading 212 Charting API source — real-time price + multi-timeframe OHLCV bars.
// https://live.services.trading212.com/charting — public, no auth required.
// Uses CycleTLS to bypass Cloudflare TLS fingerprinting (same approach as isbn project).
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
    this._cycleTLS = null;
    this._initPromise = null;
  }

  get name() { return 't212'; }
  get isStreaming() { return false; }

  async _ensureCycleTLS() {
    if (this._cycleTLS) return this._cycleTLS;
    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      const mod = require('cycletls');
      const initCycleTLS = mod.default || mod;
      this._cycleTLS = await initCycleTLS();
      return this._cycleTLS;
    })();

    return this._initPromise;
  }

  async getQuote(symbol) {
    const ticker = this._toTicker(symbol);
    const data = await this._request(`/v2/json/preview/extended/deviation?ticker=${ticker}`);
    if (!data || !data.currentPrice) return null;

    return new Tick({
      symbol,
      price: data.currentPrice,
      bid: null,
      ask: null,
      dayHigh: data.weekHigh || null,
      dayLow: data.weekLow || null,
      dayVolume: 0,
      ts: Date.now(),
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
    if (!data || !data.candles || !data.candles.length) return null;

    return data.candles.map(c => new Bar({
      symbol,
      timeframe,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume || 0,
      ts: c.time,
      tsEnd: c.time + this._tfDurationMs(timeframe),
      source: 't212',
    }));
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

    try {
      const client = await this._ensureCycleTLS();
      const url = `${BASE_URL}${pathStr}`;

      const resp = await client(url, {
        headers: {
          'User-Agent': CHROME_UA,
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.trading212.com/',
          'Origin': 'https://www.trading212.com',
        },
        ja3: '771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-17513,29-23-24,0',
        userAgent: CHROME_UA,
        timeout: 15,
      }, 'GET');

      if (resp.status !== 200) {
        this._lastError = `http_${resp.status}`;
        if (this.verbose) console.log(`[t212] ${resp.status} on ${pathStr}`);
        return null;
      }

      const body = typeof resp.body === 'string' ? resp.body : JSON.stringify(resp.body);
      return JSON.parse(body);
    } catch (e) {
      this._lastError = e.message || 'request_failed';
      if (this.verbose) console.log(`[t212] error: ${e.message}`);
      return null;
    }
  }

  async destroy() {
    if (this._cycleTLS && typeof this._cycleTLS.exit === 'function') {
      await this._cycleTLS.exit();
    }
    this._cycleTLS = null;
    this._initPromise = null;
  }
}

module.exports = T212Source;
