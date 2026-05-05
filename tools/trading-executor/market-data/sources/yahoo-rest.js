'use strict';

// Yahoo Finance REST source — historical OHLCV bars.
// Uses query2.finance.yahoo.com/v8/finance/chart/ (public, no auth).
// 15min delayed for intraday during market hours — use only for historical fetch.

const https = require('https');
const { Bar } = require('../types');

const BASE = 'query2.finance.yahoo.com';

// Timeframe → Yahoo interval + range
const TF_CONFIG = {
  '1m': { interval: '1m', range: '1d' },
  '5m': { interval: '5m', range: '5d' },
  '15m': { interval: '15m', range: '5d' },
  '30m': { interval: '30m', range: '1mo' },
  '1h': { interval: '60m', range: '1mo' },
  '4h': { interval: '60m', range: '3mo' }, // aggregate 4x1h bars
  '1d': { interval: '1d', range: '1y' },
  '1w': { interval: '1wk', range: '2y' },
};

class YahooRESTSource {
  constructor(opts = {}) {
    this.verbose = opts.verbose || false;
    this._requestCount = 0;
    this._lastError = null;
  }

  get name() { return 'yahoo-rest'; }
  get isStreaming() { return false; }

  async getBars(symbol, timeframe, count = 100) {
    const cfg = TF_CONFIG[timeframe];
    if (!cfg) return null;

    const url = `/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${cfg.interval}&range=${cfg.range}&includePrePost=true`;
    const data = await this._request(url);
    if (!data || !data.chart || !data.chart.result || !data.chart.result[0]) return null;

    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    const quote = result.indicators && result.indicators.quote && result.indicators.quote[0];
    if (!timestamps || !quote) return null;

    let bars = [];
    for (let i = 0; i < timestamps.length; i++) {
      const o = quote.open[i], h = quote.high[i], l = quote.low[i], c = quote.close[i], v = quote.volume[i];
      if (o == null || h == null || l == null || c == null) continue;
      bars.push(new Bar({
        symbol,
        timeframe: timeframe === '4h' ? '1h' : timeframe,
        open: o,
        high: h,
        low: l,
        close: c,
        volume: v || 0,
        ts: timestamps[i] * 1000,
        source: 'yahoo-rest',
      }));
    }

    // For 4h: aggregate 4 consecutive 1h bars
    if (timeframe === '4h' && bars.length > 0) {
      bars = this._aggregate(bars, 4, symbol);
    }

    // Return last `count` bars
    return bars.slice(-count);
  }

  _aggregate(hourBars, n, symbol) {
    const out = [];
    for (let i = 0; i <= hourBars.length - n; i += n) {
      const chunk = hourBars.slice(i, i + n);
      out.push(new Bar({
        symbol,
        timeframe: '4h',
        open: chunk[0].open,
        high: Math.max(...chunk.map(b => b.high)),
        low: Math.min(...chunk.map(b => b.low)),
        close: chunk[chunk.length - 1].close,
        volume: chunk.reduce((s, b) => s + b.volume, 0),
        ts: chunk[0].ts,
        tsEnd: chunk[chunk.length - 1].ts + 3600_000,
        source: 'yahoo-rest',
      }));
    }
    return out;
  }

  _request(pathStr) {
    this._requestCount++;
    return new Promise((resolve) => {
      const opts = {
        hostname: BASE,
        port: 443,
        path: pathStr,
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
        timeout: 15000,
      };

      const req = https.request(opts, (res) => {
        let body = '';
        res.on('data', c => { body += c; });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            this._lastError = `http_${res.statusCode}`;
            return resolve(null);
          }
          try { resolve(JSON.parse(body)); }
          catch (_) { this._lastError = 'parse_error'; resolve(null); }
        });
      });
      req.on('error', (e) => { this._lastError = e.code || e.message; resolve(null); });
      req.on('timeout', () => { req.destroy(); this._lastError = 'timeout'; resolve(null); });
      req.end();
    });
  }

  destroy() {}
}

module.exports = YahooRESTSource;
