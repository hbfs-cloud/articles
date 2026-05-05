'use strict';

// Saxo Bank adapter — uses OpenAPI (REST).
// Requires: SAXO_ACCESS_TOKEN (OAuth2 bearer token) + SAXO_ACCOUNT_KEY
// Docs: https://www.developer.saxo/openapi/learn
// Token refresh: handle externally or via credentials.refresh_token

const https = require('https');

const SIM_HOST = 'gateway.saxobank.com';
const LIVE_HOST = 'gateway.saxobank.com';

class SaxoAdapter {
  constructor(credentials = {}, opts = {}) {
    this.accessToken = credentials.access_token || process.env.SAXO_ACCESS_TOKEN;
    this.accountKey = credentials.account_key || process.env.SAXO_ACCOUNT_KEY;
    this.clientKey = credentials.client_key || process.env.SAXO_CLIENT_KEY;
    this.simulation = credentials.simulation || false;
    this.verbose = opts.verbose || false;
    this.baseHost = this.simulation ? SIM_HOST : LIVE_HOST;
    this.basePath = this.simulation ? '/sim/openapi' : '/openapi';
    this.connected = false;
    this._uicCache = new Map();

    if (!this.accessToken) {
      throw new Error('Saxo access token required: access_token or SAXO_ACCESS_TOKEN env var');
    }
  }

  async connect() {
    const me = await this._request('GET', '/port/v1/accounts/me');
    if (!this.accountKey && me.Data && me.Data.length > 0) {
      this.accountKey = me.Data[0].AccountKey;
      this.clientKey = me.Data[0].ClientKey;
    }
    this.connected = true;
    if (this.verbose) console.log(`[saxo] Connected: ${this.accountKey} (${this.simulation ? 'sim' : 'live'})`);
  }

  async disconnect() {
    this.connected = false;
  }

  async getAccount() {
    const balance = await this._request('GET', `/port/v1/balances?AccountKey=${this.accountKey}&ClientKey=${this.clientKey}`);
    return {
      balance: balance.CashBalance,
      buying_power: balance.MarginAvailableForTrading || balance.CashBalance,
      currency: balance.Currency,
      last_equity: balance.TotalValue,
      equity: balance.TotalValue,
      margin_used: balance.MarginUsedByCurrentPositions,
    };
  }

  async getPositions() {
    const resp = await this._request('GET', `/port/v1/positions?AccountKey=${this.accountKey}&ClientKey=${this.clientKey}`);
    return (resp.Data || []).map(p => ({
      symbol: p.DisplayAndFormat?.Symbol || p.NetPositionId,
      qty: Math.abs(p.PositionBase?.Amount || 0),
      avg_price: p.PositionBase?.AverageOpenPrice || 0,
      unrealized_pnl: p.PositionBase?.ProfitLossOnTrade || 0,
      side: (p.PositionBase?.Amount || 0) > 0 ? 'long' : 'short',
      uic: p.PositionBase?.Uic,
      position_id: p.PositionId,
    }));
  }

  async getMarketStatus() {
    const now = new Date();
    const h = now.getUTCHours();
    const d = now.getDay();
    if (d === 0 || d === 6) return 'closed';
    if (h >= 14 && h < 21) return 'open';
    if (h >= 8 && h < 14) return 'open';
    return 'closed';
  }

  async getQuote(symbol) {
    const uic = await this._resolveUic(symbol);
    const info = await this._request('GET', `/trade/v1/infoprices?AssetType=Stock&Uic=${uic}&FieldGroups=PriceInfo,PriceInfoDetails`);
    const q = info.Quote || {};
    return {
      last: q.Mid || q.MarketPrice || null,
      bid: q.Bid || null,
      ask: q.Ask || null,
      halted: info.MarketState === 'Halted',
      spread: q.Ask && q.Bid ? q.Ask - q.Bid : null,
    };
  }

  async placeOrder(params) {
    const uic = await this._resolveUic(params.symbol);
    const body = {
      AccountKey: this.accountKey,
      Uic: uic,
      AssetType: 'Stock',
      BuySell: params.side === 'buy' ? 'Buy' : 'Sell',
      Amount: params.qty,
      OrderType: this._mapOrderType(params.type),
      OrderDuration: { DurationType: this._mapTif(params.time_in_force) },
      ManualOrder: false,
    };

    if (params.limit_price) body.OrderPrice = params.limit_price;
    if (params.stop_price) {
      if (params.type === 'stop') body.OrderPrice = params.stop_price;
      else body.StopLimitPrice = params.stop_price;
    }

    const result = await this._request('POST', '/trade/v2/orders', body);
    return { id: result.OrderId };
  }

  async modifyOrder(orderId, changes) {
    const body = {};
    if (changes.limit_price) body.OrderPrice = changes.limit_price;
    if (changes.stop_price) body.StopLimitPrice = changes.stop_price;
    if (changes.qty) body.Amount = changes.qty;

    // Need to get existing order first for required fields
    const existing = await this._request('GET', `/port/v1/orders/${this.clientKey}/${orderId}`);
    body.AccountKey = this.accountKey;
    body.OrderId = orderId;
    body.AssetType = existing.AssetType || 'Stock';
    body.Uic = existing.Uic;
    body.BuySell = existing.BuySell;
    body.Amount = changes.qty || existing.Amount;
    body.OrderType = existing.OrderType;
    body.OrderDuration = existing.OrderDuration;

    await this._request('PATCH', '/trade/v2/orders', body);
    return { id: orderId, modified: true };
  }

  async cancelOrder(orderId) {
    await this._request('DELETE', `/trade/v2/orders/${orderId}?AccountKey=${this.accountKey}`);
    return { id: orderId, cancelled: true };
  }

  async getOrderStatus(orderId) {
    const orders = await this._request('GET', `/port/v1/orders?AccountKey=${this.accountKey}&ClientKey=${this.clientKey}`);
    const o = (orders.Data || []).find(x => x.OrderId === orderId);
    if (!o) throw new Error(`Saxo order ${orderId} not found`);

    const statusMap = {
      'Working': 'accepted',
      'Filled': 'filled',
      'Cancelled': 'cancelled',
      'Rejected': 'rejected',
      'Parked': 'new',
      'LockedPlacementPending': 'new',
    };

    return {
      id: o.OrderId,
      status: statusMap[o.Status] || (o.Status || '').toLowerCase(),
      filled_avg_price: o.FilledAmount ? o.AverageFilledPrice : null,
      filled_qty: o.FilledAmount || 0,
      filled_at: o.LastUpdated,
      qty: o.Amount,
      reject_reason: o.Status === 'Rejected' ? (o.ExternalReference || 'rejected') : null,
    };
  }

  async closePosition(symbol) {
    const positions = await this.getPositions();
    const pos = positions.find(p => p.symbol === symbol);
    if (!pos) return { closed: false, reason: 'no_position' };

    // Saxo has a dedicated close endpoint
    const body = {
      AccountKey: this.accountKey,
      PositionId: pos.position_id,
      Orders: [{
        Uic: pos.uic,
        AssetType: 'Stock',
        BuySell: pos.side === 'long' ? 'Sell' : 'Buy',
        Amount: pos.qty,
        OrderType: 'Market',
        OrderDuration: { DurationType: 'DayOrder' },
        ManualOrder: false,
      }],
    };

    const result = await this._request('POST', '/trade/v2/orders', body.Orders[0]);
    return { closed: true, order_id: result.OrderId };
  }

  async _resolveUic(symbol) {
    if (this._uicCache.has(symbol)) return this._uicCache.get(symbol);
    const resp = await this._request('GET', `/ref/v1/instruments?Keywords=${encodeURIComponent(symbol)}&AssetTypes=Stock&IncludeNonTradable=false`);
    if (!resp.Data || resp.Data.length === 0) throw new Error(`Saxo symbol not found: ${symbol}`);
    // Prefer US exchange
    const us = resp.Data.find(i => i.ExchangeId === 'NYSE' || i.ExchangeId === 'NASDAQ' || i.ExchangeId === 'ARCX');
    const uic = (us || resp.Data[0]).Identifier;
    this._uicCache.set(symbol, uic);
    return uic;
  }

  _mapOrderType(type) {
    const map = { 'market': 'Market', 'limit': 'Limit', 'stop': 'StopIfTraded', 'stop_limit': 'StopLimit' };
    return map[type] || 'Market';
  }

  _mapTif(tif) {
    const map = { 'day': 'DayOrder', 'gtc': 'GoodTillCancel', 'ioc': 'ImmediateOrCancel' };
    return map[tif] || 'DayOrder';
  }

  _request(method, path, body) {
    return new Promise((resolve, reject) => {
      const opts = {
        hostname: this.baseHost,
        port: 443,
        path: this.basePath + path,
        method,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      };

      const req = https.request(opts, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 204 || res.statusCode === 201) {
            if (data) { try { return resolve(JSON.parse(data)); } catch (_) {} }
            return resolve({});
          }
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 400) {
              const msg = parsed.ErrorInfo?.Message || parsed.Message || JSON.stringify(parsed);
              const err = new Error(`Saxo ${method} ${path}: ${res.statusCode} ${msg}`);
              err.statusCode = res.statusCode;
              err.code = res.statusCode === 401 ? 'AUTH_FAILED' : res.statusCode === 403 ? 'AUTH_FAILED' : 'API_ERROR';
              return reject(err);
            }
            resolve(parsed);
          } catch (e) {
            if (data === '') return resolve({});
            reject(new Error(`Saxo parse error: ${data.slice(0, 200)}`));
          }
        });
      });

      req.on('error', (err) => { err.code = 'NETWORK_ERROR'; reject(err); });
      req.setTimeout(15000, () => { req.destroy(); reject(Object.assign(new Error('Saxo timeout'), { code: 'TIMEOUT' })); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }
}

module.exports = SaxoAdapter;
