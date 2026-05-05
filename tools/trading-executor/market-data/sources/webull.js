'use strict';

// Webull REST source — real-time quotes, no auth required.
// Used as fallback when Yahoo WS hasn't received a tick yet.

const https = require('https');
const { Tick } = require('../types');

const SEARCH_URL = 'https://quotes-gw.webullfintech.com/api/search/pc/tickers';
const QUOTE_URL = 'https://quotes-gw.webullfintech.com/api/stock/tickerRealTime/getQuote';
const HEADERS = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'appid': 'webull-webapp' };

// Cache tickerId resolution (stable across session)
const _tickerIdCache = new Map();

class WebullSource {
  constructor(opts = {}) {
    this.verbose = opts.verbose || false;
    this._requestCount = 0;
    this._lastError = null;
  }

  get name() { return 'webull'; }
  get isStreaming() { return false; }

  async getQuote(symbol) {
    const tickerId = await this._resolveTickerId(symbol);
    if (!tickerId) return null;

    const url = `${QUOTE_URL}?tickerId=${tickerId}&includeSecu=1&includeQuote=1&more=1`;
    const data = await this._fetch(url);
    if (!data) return null;

    const price = +(data.close || data.price || data.tradePrice || 0);
    if (price <= 0) return null;

    return new Tick({
      symbol,
      price,
      bid: +(data.bidPrice || 0) || null,
      ask: +(data.askPrice || 0) || null,
      volume: +(data.tradeSize || 0),
      dayHigh: +(data.high || 0) || null,
      dayLow: +(data.low || 0) || null,
      dayVolume: +(data.volume || 0),
      ts: Date.now(),
      source: 'webull',
    });
  }

  async _resolveTickerId(symbol) {
    if (_tickerIdCache.has(symbol)) return _tickerIdCache.get(symbol);

    const url = `${SEARCH_URL}?keyword=${encodeURIComponent(symbol)}&pageIndex=1&pageSize=1&regionId=6`;
    const data = await this._fetch(url);
    if (!data) return null;

    const items = data.data || data;
    const item = Array.isArray(items) ? items[0] : null;
    if (!item || !item.tickerId) return null;

    _tickerIdCache.set(symbol, item.tickerId);
    return item.tickerId;
  }

  _fetch(url) {
    this._requestCount++;
    return new Promise((resolve) => {
      const req = https.get(url, { headers: HEADERS, timeout: 8000 }, (res) => {
        let body = '';
        res.on('data', c => { body += c; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (_) {
            this._lastError = 'parse_error';
            resolve(null);
          }
        });
      });
      req.on('error', (e) => { this._lastError = e.code || e.message; resolve(null); });
      req.on('timeout', () => { req.destroy(); this._lastError = 'timeout'; resolve(null); });
    });
  }

  destroy() {}
}

module.exports = WebullSource;
