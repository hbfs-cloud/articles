'use strict';

// Interactive Brokers adapter — uses Client Portal API (gateway required).
// Requires: IBKR gateway running on localhost:5000 (or custom host/port).
// Setup: https://www.interactivebrokers.com/en/trading/ib-api.php
// Gateway must be authenticated via browser before use.

const https = require('https');
const http = require('http');

class IbkrAdapter {
  constructor(credentials = {}, opts = {}) {
    this.host = credentials.gateway_host || process.env.IBKR_GATEWAY_HOST || 'localhost';
    this.port = credentials.gateway_port || process.env.IBKR_GATEWAY_PORT || 5000;
    this.accountId = credentials.account_id || process.env.IBKR_ACCOUNT_ID;
    this.ssl = credentials.ssl !== false;
    this.verbose = opts.verbose || false;
    this.connected = false;
    this._conidCache = new Map();
  }

  async connect() {
    const status = await this._request('GET', '/v1/api/iserver/auth/status');
    if (!status.authenticated) {
      throw new Error('IBKR gateway not authenticated. Open browser to https://localhost:5000 and log in first.');
    }
    if (!this.accountId) {
      const accounts = await this._request('GET', '/v1/api/portfolio/accounts');
      if (accounts.length === 0) throw new Error('No IBKR accounts found');
      this.accountId = accounts[0].accountId;
    }
    // Keep session alive
    await this._request('POST', '/v1/api/tickle');
    this.connected = true;
    if (this.verbose) console.log(`[ibkr] Connected: account ${this.accountId}`);
  }

  async disconnect() {
    try { await this._request('POST', '/v1/api/logout'); } catch (_) {}
    this.connected = false;
  }

  async getAccount() {
    const summary = await this._request('GET', `/v1/api/portfolio/${this.accountId}/summary`);
    return {
      balance: this._val(summary, 'totalcashvalue'),
      buying_power: this._val(summary, 'buyingpower'),
      currency: 'USD',
      last_equity: this._val(summary, 'netliquidation'),
      equity: this._val(summary, 'netliquidation'),
    };
  }

  async getPositions() {
    const positions = await this._request('GET', `/v1/api/portfolio/${this.accountId}/positions/0`);
    return (positions || []).map(p => ({
      symbol: p.ticker || p.contractDesc,
      qty: Math.abs(p.position),
      avg_price: p.avgCost,
      unrealized_pnl: p.unrealizedPnl,
      side: p.position > 0 ? 'long' : 'short',
      conid: p.conid,
    }));
  }

  async getMarketStatus() {
    // IBKR doesn't have a clean endpoint; use exchange hours
    const now = new Date();
    const h = now.getUTCHours();
    const d = now.getDay();
    if (d === 0 || d === 6) return 'closed';
    if (h >= 13 && h < 14) return 'pre_market';
    if (h >= 14 && h < 20) return 'open';
    if (h >= 20 && h < 24) return 'after_hours';
    return 'closed';
  }

  async getQuote(symbol) {
    const conid = await this._resolveConid(symbol);
    const snapshot = await this._request('GET', `/v1/api/iserver/marketdata/snapshot?conids=${conid}&fields=31,84,85,86`);
    const s = snapshot[0] || {};
    return {
      last: this._parseNum(s['31']),
      bid: this._parseNum(s['84']),
      ask: this._parseNum(s['85']),
      volume: this._parseNum(s['86']),
      halted: false,
    };
  }

  async placeOrder(params) {
    const conid = await this._resolveConid(params.symbol);
    const orderPayload = {
      acctId: this.accountId,
      conid,
      orderType: this._mapOrderType(params.type),
      side: params.side.toUpperCase(),
      quantity: params.qty,
      tif: this._mapTif(params.time_in_force),
    };

    if (params.limit_price) orderPayload.price = params.limit_price;
    if (params.stop_price) orderPayload.auxPrice = params.stop_price;

    // IBKR requires order confirmation reply
    const reply = await this._request('POST', `/v1/api/iserver/account/${this.accountId}/orders`, { orders: [orderPayload] });

    // Handle confirmation prompts
    if (reply && reply[0] && reply[0].id) {
      // Confirm the order
      const confirmed = await this._request('POST', `/v1/api/iserver/reply/${reply[0].id}`, { confirmed: true });
      const orderId = confirmed[0]?.order_id || reply[0].id;
      return { id: String(orderId) };
    }

    if (reply && reply[0] && reply[0].order_id) {
      return { id: String(reply[0].order_id) };
    }

    throw new Error(`IBKR order placement failed: ${JSON.stringify(reply).slice(0, 300)}`);
  }

  async modifyOrder(orderId, changes) {
    const body = {};
    if (changes.limit_price) body.price = changes.limit_price;
    if (changes.stop_price) body.auxPrice = changes.stop_price;
    if (changes.qty) body.quantity = changes.qty;

    const result = await this._request('POST', `/v1/api/iserver/account/${this.accountId}/order/${orderId}`, body);
    // May need confirmation
    if (result && result[0] && result[0].id) {
      await this._request('POST', `/v1/api/iserver/reply/${result[0].id}`, { confirmed: true });
    }
    return { id: orderId, modified: true };
  }

  async cancelOrder(orderId) {
    await this._request('DELETE', `/v1/api/iserver/account/${this.accountId}/order/${orderId}`);
    return { id: orderId, cancelled: true };
  }

  async getOrderStatus(orderId) {
    const orders = await this._request('GET', `/v1/api/iserver/account/orders`);
    const o = (orders.orders || []).find(x => String(x.orderId) === String(orderId));
    if (!o) throw new Error(`Order ${orderId} not found in IBKR`);

    const statusMap = {
      'Submitted': 'accepted',
      'Filled': 'filled',
      'Cancelled': 'cancelled',
      'Inactive': 'rejected',
      'PendingSubmit': 'new',
      'PreSubmitted': 'accepted',
      'ApiCancelled': 'cancelled',
    };

    return {
      id: String(o.orderId),
      status: statusMap[o.status] || o.status.toLowerCase(),
      filled_avg_price: o.avgPrice || null,
      filled_qty: o.filledQuantity || 0,
      filled_at: o.lastExecutionTime_r ? new Date(o.lastExecutionTime_r).toISOString() : null,
      qty: o.totalSize || o.quantity,
      reject_reason: o.status === 'Inactive' ? (o.warningText || 'rejected') : null,
    };
  }

  async closePosition(symbol) {
    const conid = await this._resolveConid(symbol);
    const positions = await this.getPositions();
    const pos = positions.find(p => p.conid === conid || p.symbol === symbol);
    if (!pos) return { closed: false, reason: 'no_position' };

    const result = await this.placeOrder({
      symbol,
      side: pos.side === 'long' ? 'sell' : 'buy',
      type: 'market',
      qty: pos.qty,
      time_in_force: 'day',
    });
    return { closed: true, order_id: result.id };
  }

  // ── Helpers ──
  async _resolveConid(symbol) {
    if (this._conidCache.has(symbol)) return this._conidCache.get(symbol);
    const results = await this._request('GET', `/v1/api/iserver/secdef/search?symbol=${encodeURIComponent(symbol)}`);
    if (!results || results.length === 0) throw new Error(`IBKR symbol not found: ${symbol}`);
    // Prefer SMART/US listing
    const us = results.find(r => r.description && r.description.includes('NASDAQ') || r.description && r.description.includes('NYSE'));
    const conid = (us || results[0]).conid;
    this._conidCache.set(symbol, conid);
    return conid;
  }

  _mapOrderType(type) {
    const map = { 'market': 'MKT', 'limit': 'LMT', 'stop': 'STP', 'stop_limit': 'STP LMT' };
    return map[type] || type.toUpperCase();
  }

  _mapTif(tif) {
    const map = { 'day': 'DAY', 'gtc': 'GTC', 'ioc': 'IOC', 'opg': 'OPG' };
    return map[tif] || (tif || 'day').toUpperCase();
  }

  _val(summary, key) {
    const entry = summary[key];
    if (!entry) return 0;
    return +(entry.amount || entry.value || 0);
  }

  _parseNum(v) {
    if (v === undefined || v === null || v === '') return null;
    const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    return isNaN(n) ? null : n;
  }

  _request(method, path, body) {
    const proto = this.ssl ? https : http;
    return new Promise((resolve, reject) => {
      const opts = {
        hostname: this.host,
        port: this.port,
        path,
        method,
        headers: { 'Content-Type': 'application/json' },
        rejectUnauthorized: false, // IBKR gateway uses self-signed cert
      };

      const req = proto.request(opts, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 204) return resolve({});
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 400) {
              const msg = parsed.error || parsed.message || JSON.stringify(parsed);
              const err = new Error(`IBKR ${method} ${path}: ${res.statusCode} ${msg}`);
              err.statusCode = res.statusCode;
              err.code = 'API_ERROR';
              return reject(err);
            }
            resolve(parsed);
          } catch (e) {
            if (data === '') return resolve({});
            reject(new Error(`IBKR parse error: ${data.slice(0, 200)}`));
          }
        });
      });

      req.on('error', (err) => { err.code = 'NETWORK_ERROR'; reject(err); });
      req.setTimeout(15000, () => { req.destroy(); reject(Object.assign(new Error('IBKR timeout'), { code: 'TIMEOUT' })); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }
}

module.exports = IbkrAdapter;
