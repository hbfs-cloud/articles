'use strict';

// Trading 212 adapter — uses the Equity API (beta).
// Requires: T212_API_KEY (from Settings > API in Trading 212 app)
// Docs: https://t212public-api-docs.redoc.ly/

const https = require('https');

const BASE_HOST = 'live.trading212.com';
const DEMO_HOST = 'demo.trading212.com';

class Trading212Adapter {
  constructor(credentials = {}, opts = {}) {
    this.apiKey = credentials.api_key || process.env.T212_API_KEY;
    this.demo = credentials.demo || false;
    this.verbose = opts.verbose || false;
    this.baseHost = this.demo ? DEMO_HOST : BASE_HOST;
    this.connected = false;

    if (!this.apiKey) {
      throw new Error('Trading 212 API key required: api_key or T212_API_KEY env var');
    }
  }

  async connect() {
    const account = await this._request('GET', '/api/v0/equity/account/info');
    this.connected = true;
    this.currencyCode = account.currencyCode;
    if (this.verbose) console.log(`[t212] Connected: ${account.id} (${this.demo ? 'demo' : 'live'})`);
  }

  async disconnect() {
    this.connected = false;
  }

  async getAccount() {
    const cash = await this._request('GET', '/api/v0/equity/account/cash');
    return {
      balance: cash.free,
      buying_power: cash.free,
      currency: this.currencyCode || 'EUR',
      last_equity: cash.total,
      equity: cash.total,
      invested: cash.invested,
      pnl: cash.ppl,
    };
  }

  async getPositions() {
    const positions = await this._request('GET', '/api/v0/equity/portfolio');
    return positions.map(p => ({
      symbol: p.ticker,
      qty: p.quantity,
      avg_price: p.averagePrice,
      unrealized_pnl: p.ppl,
      side: 'long',
      current_price: p.currentPrice,
      fx_impact: p.fxPpl,
    }));
  }

  async getMarketStatus() {
    // T212 doesn't expose market status directly; infer from clock
    const now = new Date();
    const h = now.getUTCHours();
    const d = now.getDay();
    if (d === 0 || d === 6) return 'closed';
    if (h >= 14 && h < 21) return 'open'; // US hours
    if (h >= 8 && h < 14) return 'open'; // EU hours
    return 'closed';
  }

  async getQuote(symbol) {
    // T212 API doesn't have a quote endpoint; use the instrument price from positions or metadata
    const instruments = await this._request('GET', '/api/v0/equity/metadata/instruments');
    const inst = instruments.find(i => i.ticker === symbol);
    if (!inst) throw new Error(`T212 symbol not found: ${symbol}`);
    // Price comes from position if held
    const positions = await this._request('GET', '/api/v0/equity/portfolio');
    const pos = positions.find(p => p.ticker === symbol);
    if (pos) {
      return { last: pos.currentPrice, bid: null, ask: null, halted: false };
    }
    // No direct quote API — return null to signal unavailable
    return { last: null, bid: null, ask: null, halted: false };
  }

  async placeOrder(params) {
    // T212 supports: LIMIT, MARKET, STOP, STOP_LIMIT
    let endpoint, body;

    if (params.type === 'market') {
      endpoint = '/api/v0/equity/orders/market';
      body = { ticker: params.symbol, quantity: params.qty };
    } else if (params.type === 'limit') {
      endpoint = '/api/v0/equity/orders/limit';
      body = {
        ticker: params.symbol,
        quantity: params.qty,
        limitPrice: params.limit_price,
        timeValidity: this._mapTif(params.time_in_force),
      };
    } else if (params.type === 'stop') {
      endpoint = '/api/v0/equity/orders/stop';
      body = {
        ticker: params.symbol,
        quantity: params.qty,
        stopPrice: params.stop_price,
        timeValidity: this._mapTif(params.time_in_force),
      };
    } else if (params.type === 'stop_limit') {
      endpoint = '/api/v0/equity/orders/stop_limit';
      body = {
        ticker: params.symbol,
        quantity: params.qty,
        stopPrice: params.stop_price,
        limitPrice: params.limit_price,
        timeValidity: this._mapTif(params.time_in_force),
      };
    } else {
      throw new Error(`Unsupported order type for T212: ${params.type}`);
    }

    // T212 is buy-only for equity orders (sell via position close)
    // For sell orders, we close position partially
    if (params.side === 'sell') {
      return await this._closePart(params.symbol, params.qty, params);
    }

    const order = await this._request('POST', endpoint, body);
    return { id: String(order.id) };
  }

  async _closePart(symbol, qty, params) {
    // T212 sells are done by placing sell orders with negative quantity or via limit sell
    const endpoint = params.type === 'limit' ? '/api/v0/equity/orders/limit' : '/api/v0/equity/orders/market';
    const body = { ticker: symbol, quantity: -Math.abs(qty) };
    if (params.limit_price) body.limitPrice = params.limit_price;
    if (params.time_in_force) body.timeValidity = this._mapTif(params.time_in_force);
    const order = await this._request('POST', endpoint, body);
    return { id: String(order.id) };
  }

  async modifyOrder(orderId, changes) {
    // T212 doesn't support order modification — cancel and re-place
    await this.cancelOrder(orderId);
    throw new Error('T212 does not support order modification. Cancel and re-place instead.');
  }

  async cancelOrder(orderId) {
    await this._request('DELETE', `/api/v0/equity/orders/${orderId}`);
    return { id: orderId, cancelled: true };
  }

  async getOrderStatus(orderId) {
    const order = await this._request('GET', `/api/v0/equity/orders/${orderId}`);
    const statusMap = {
      'NEW': 'new',
      'UNCONFIRMED': 'new',
      'CONFIRMED': 'accepted',
      'FILLED': 'filled',
      'REJECTED': 'rejected',
      'CANCELLED': 'cancelled',
      'PARTIALLY_FILLED': 'partially_filled',
    };

    return {
      id: String(order.id),
      status: statusMap[order.status] || (order.status || '').toLowerCase(),
      filled_avg_price: order.filledPrice || null,
      filled_qty: order.filledQuantity || 0,
      filled_at: order.dateModified || order.dateCreated,
      qty: order.quantity,
      reject_reason: order.status === 'REJECTED' ? (order.rejectReason || 'rejected') : null,
    };
  }

  async closePosition(symbol) {
    const positions = await this.getPositions();
    const pos = positions.find(p => p.symbol === symbol);
    if (!pos) return { closed: false, reason: 'no_position' };

    const result = await this.placeOrder({
      symbol,
      side: 'sell',
      type: 'market',
      qty: pos.qty,
      time_in_force: 'day',
    });
    return { closed: true, order_id: result.id };
  }

  _mapTif(tif) {
    const map = { 'day': 'Day', 'gtc': 'GTC' };
    return map[tif] || 'Day';
  }

  _request(method, path, body) {
    return new Promise((resolve, reject) => {
      const opts = {
        hostname: this.baseHost,
        port: 443,
        path,
        method,
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json',
        },
      };

      const req = https.request(opts, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 204) return resolve({});
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 400) {
              const msg = parsed.message || parsed.error || JSON.stringify(parsed);
              const err = new Error(`T212 ${method} ${path}: ${res.statusCode} ${msg}`);
              err.statusCode = res.statusCode;
              err.code = res.statusCode === 401 ? 'AUTH_FAILED' : 'API_ERROR';
              return reject(err);
            }
            resolve(parsed);
          } catch (e) {
            if (data === '') return resolve({});
            reject(new Error(`T212 parse error: ${data.slice(0, 200)}`));
          }
        });
      });

      req.on('error', (err) => { err.code = 'NETWORK_ERROR'; reject(err); });
      req.setTimeout(15000, () => { req.destroy(); reject(Object.assign(new Error('T212 timeout'), { code: 'TIMEOUT' })); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }
}

module.exports = Trading212Adapter;
