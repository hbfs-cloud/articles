'use strict';

// Alpaca Markets broker adapter — live and paper trading via REST API v2.
// Requires: ALPACA_API_KEY + ALPACA_API_SECRET (or passed via credentials)
// Paper: uses paper-api.alpaca.markets; Live: uses api.alpaca.markets

const https = require('https');

const PAPER_BASE = 'paper-api.alpaca.markets';
const LIVE_BASE = 'api.alpaca.markets';
const DATA_BASE = 'data.alpaca.markets';

class AlpacaAdapter {
  constructor(credentials = {}, opts = {}) {
    this.apiKey = credentials.api_key || process.env.ALPACA_API_KEY;
    this.apiSecret = credentials.api_secret || process.env.ALPACA_API_SECRET;
    this.paper = credentials.paper !== false; // default to paper
    this.verbose = opts.verbose || false;
    this.baseHost = this.paper ? PAPER_BASE : LIVE_BASE;
    this.connected = false;

    if (!this.apiKey || !this.apiSecret) {
      throw new Error('Alpaca credentials required: api_key + api_secret (or ALPACA_API_KEY/ALPACA_API_SECRET env vars)');
    }
  }

  async connect() {
    const account = await this._request('GET', '/v2/account');
    if (account.status !== 'ACTIVE') {
      throw new Error(`Alpaca account not active: ${account.status}`);
    }
    this.connected = true;
    if (this.verbose) console.log(`[alpaca] Connected: ${account.id} (${this.paper ? 'paper' : 'LIVE'})`);
  }

  async disconnect() {
    this.connected = false;
  }

  async getAccount() {
    const a = await this._request('GET', '/v2/account');
    return {
      balance: +a.cash,
      buying_power: +a.buying_power,
      currency: a.currency,
      last_equity: +a.last_equity,
      equity: +a.equity,
      day_pnl: +a.equity - +a.last_equity,
    };
  }

  async getPositions() {
    const positions = await this._request('GET', '/v2/positions');
    return positions.map(p => ({
      symbol: p.symbol,
      qty: +p.qty,
      avg_price: +p.avg_entry_price,
      unrealized_pnl: +p.unrealized_pl,
      side: p.side,
      market_value: +p.market_value,
      current_price: +p.current_price,
    }));
  }

  async getMarketStatus() {
    const clock = await this._request('GET', '/v2/clock');
    if (clock.is_open) return 'open';
    const now = new Date();
    const nextOpen = new Date(clock.next_open);
    const diff = nextOpen - now;
    if (diff < 30 * 60 * 1000) return 'pre_market';
    return 'closed';
  }

  async getQuote(symbol) {
    try {
      const q = await this._request('GET', `/v2/stocks/${encodeURIComponent(symbol)}/quotes/latest`, null, DATA_BASE);
      return {
        last: (q.quote.ap + q.quote.bp) / 2,
        bid: q.quote.bp,
        ask: q.quote.ap,
        bid_size: q.quote.bs,
        ask_size: q.quote.as,
        halted: false,
      };
    } catch (err) {
      // Fallback to last trade
      const t = await this._request('GET', `/v2/stocks/${encodeURIComponent(symbol)}/trades/latest`, null, DATA_BASE);
      return {
        last: t.trade.p,
        bid: null,
        ask: null,
        halted: false,
      };
    }
  }

  async placeOrder(params) {
    const body = {
      symbol: params.symbol,
      qty: String(params.qty),
      side: params.side,
      type: params.type,
      time_in_force: params.time_in_force || 'day',
    };

    if (params.type === 'limit') body.limit_price = String(params.limit_price);
    if (params.type === 'stop') body.stop_price = String(params.stop_price);
    if (params.type === 'stop_limit') {
      body.stop_price = String(params.stop_price);
      body.limit_price = String(params.limit_price);
    }

    const order = await this._request('POST', '/v2/orders', body);
    return { id: order.id, client_order_id: order.client_order_id };
  }

  async modifyOrder(orderId, changes) {
    const body = {};
    if (changes.qty) body.qty = String(changes.qty);
    if (changes.limit_price) body.limit_price = String(changes.limit_price);
    if (changes.stop_price) body.stop_price = String(changes.stop_price);
    if (changes.time_in_force) body.time_in_force = changes.time_in_force;

    const order = await this._request('PATCH', `/v2/orders/${orderId}`, body);
    return { id: order.id, modified: true };
  }

  async cancelOrder(orderId) {
    await this._request('DELETE', `/v2/orders/${orderId}`);
    return { id: orderId, cancelled: true };
  }

  async getOrderStatus(orderId) {
    const o = await this._request('GET', `/v2/orders/${orderId}`);
    const statusMap = {
      'new': 'new',
      'accepted': 'accepted',
      'partially_filled': 'partially_filled',
      'filled': 'filled',
      'done_for_day': 'expired',
      'canceled': 'cancelled',
      'expired': 'expired',
      'replaced': 'cancelled',
      'pending_cancel': 'cancelled',
      'pending_replace': 'accepted',
      'rejected': 'rejected',
    };

    return {
      id: o.id,
      status: statusMap[o.status] || o.status,
      filled_avg_price: o.filled_avg_price ? +o.filled_avg_price : null,
      filled_qty: o.filled_qty ? +o.filled_qty : 0,
      filled_at: o.filled_at,
      qty: +o.qty,
      reject_reason: o.status === 'rejected' ? (o.failed_at || 'rejected by broker') : null,
    };
  }

  async closePosition(symbol) {
    try {
      const result = await this._request('DELETE', `/v2/positions/${encodeURIComponent(symbol)}`);
      return { closed: true, order_id: result.id };
    } catch (err) {
      if (err.message.includes('position does not exist')) {
        return { closed: false, reason: 'no_position' };
      }
      throw err;
    }
  }

  // ── HTTP layer ──
  _request(method, path, body, host) {
    return new Promise((resolve, reject) => {
      const opts = {
        hostname: host || this.baseHost,
        port: 443,
        path,
        method,
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.apiSecret,
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
              const err = new Error(`Alpaca ${method} ${path}: ${res.statusCode} ${msg}`);
              err.statusCode = res.statusCode;
              err.code = res.statusCode === 403 ? 'AUTH_FAILED' : res.statusCode === 422 ? 'ORDER_REJECTED' : 'API_ERROR';
              return reject(err);
            }
            resolve(parsed);
          } catch (e) {
            reject(new Error(`Alpaca response parse error: ${data.slice(0, 200)}`));
          }
        });
      });

      req.on('error', (err) => {
        err.code = 'NETWORK_ERROR';
        reject(err);
      });

      req.setTimeout(15000, () => {
        req.destroy();
        const err = new Error('Alpaca request timeout');
        err.code = 'TIMEOUT';
        reject(err);
      });

      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }
}

module.exports = AlpacaAdapter;
