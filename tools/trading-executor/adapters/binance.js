'use strict';

// Binance adapter — spot trading via REST API v3.
// Requires: BINANCE_API_KEY + BINANCE_API_SECRET
// Supports: spot market/limit/stop-limit orders, 24/7 crypto trading.

const https = require('https');
const crypto = require('crypto');

const BASE_HOST = 'api.binance.com';
const TESTNET_HOST = 'testnet.binance.vision';

class BinanceAdapter {
  constructor(credentials = {}, opts = {}) {
    this.apiKey = credentials.api_key || process.env.BINANCE_API_KEY;
    this.apiSecret = credentials.api_secret || process.env.BINANCE_API_SECRET;
    this.testnet = credentials.testnet || false;
    this.verbose = opts.verbose || false;
    this.baseHost = this.testnet ? TESTNET_HOST : BASE_HOST;
    this.connected = false;
    this._exchangeInfo = null;
    this.recvWindow = 5000;
  }

  async connect() {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('Binance credentials required: api_key + api_secret (or BINANCE_API_KEY/BINANCE_API_SECRET env vars)');
    }
    const account = await this._signedRequest('GET', '/api/v3/account');
    this.connected = true;
    if (this.verbose) console.log(`[binance] Connected (${this.testnet ? 'testnet' : 'live'}), ${account.balances.filter(b => +b.free > 0).length} non-zero balances`);
  }

  async disconnect() {
    this.connected = false;
  }

  async getAccount() {
    const account = await this._signedRequest('GET', '/api/v3/account');
    const usdtBalance = account.balances.find(b => b.asset === 'USDT') || { free: '0', locked: '0' };
    const busdBalance = account.balances.find(b => b.asset === 'BUSD') || { free: '0', locked: '0' };
    const totalStable = +usdtBalance.free + +usdtBalance.locked + +busdBalance.free + +busdBalance.locked;

    return {
      balance: +usdtBalance.free + +busdBalance.free,
      buying_power: +usdtBalance.free + +busdBalance.free,
      currency: 'USDT',
      last_equity: totalStable,
      equity: totalStable,
      balances: account.balances.filter(b => +b.free > 0 || +b.locked > 0),
    };
  }

  async getPositions() {
    const account = await this._signedRequest('GET', '/api/v3/account');
    const positions = [];

    for (const b of account.balances) {
      const qty = +b.free + +b.locked;
      if (qty <= 0 || b.asset === 'USDT' || b.asset === 'BUSD') continue;
      try {
        const ticker = await this._request('GET', `/api/v3/ticker/price?symbol=${b.asset}USDT`);
        positions.push({
          symbol: `${b.asset}USDT`,
          qty,
          avg_price: 0, // Binance doesn't track avg entry
          unrealized_pnl: 0,
          side: 'long',
          current_price: +ticker.price,
          market_value: qty * +ticker.price,
        });
      } catch (_) {
        // Skip assets without USDT pair
      }
    }
    return positions;
  }

  async getMarketStatus() {
    // Crypto is 24/7
    return 'open';
  }

  async getQuote(symbol) {
    const [ticker, book] = await Promise.all([
      this._request('GET', `/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`),
      this._request('GET', `/api/v3/ticker/bookTicker?symbol=${encodeURIComponent(symbol)}`),
    ]);
    return {
      last: +ticker.price,
      bid: +book.bidPrice,
      ask: +book.askPrice,
      bid_size: +book.bidQty,
      ask_size: +book.askQty,
      halted: false,
    };
  }

  async placeOrder(params) {
    const body = {
      symbol: params.symbol,
      side: params.side.toUpperCase(),
      quantity: this._formatQty(params.symbol, params.qty),
      newOrderRespType: 'FULL',
    };

    if (params.type === 'market') {
      body.type = 'MARKET';
    } else if (params.type === 'limit') {
      body.type = 'LIMIT';
      body.price = this._formatPrice(params.symbol, params.limit_price);
      body.timeInForce = this._mapTif(params.time_in_force);
    } else if (params.type === 'stop') {
      body.type = 'STOP_LOSS_LIMIT';
      body.stopPrice = this._formatPrice(params.symbol, params.stop_price);
      body.price = this._formatPrice(params.symbol, params.stop_price * 0.995); // Limit slightly below stop
      body.timeInForce = 'GTC';
    } else if (params.type === 'stop_limit') {
      body.type = 'STOP_LOSS_LIMIT';
      body.stopPrice = this._formatPrice(params.symbol, params.stop_price);
      body.price = this._formatPrice(params.symbol, params.limit_price);
      body.timeInForce = this._mapTif(params.time_in_force);
    }

    const order = await this._signedRequest('POST', '/api/v3/order', body);
    return { id: String(order.orderId), client_order_id: order.clientOrderId };
  }

  async modifyOrder(orderId, changes) {
    // Binance doesn't support modify — cancel and re-place
    // Get original order first
    const orders = await this._signedRequest('GET', '/api/v3/openOrders');
    const original = orders.find(o => String(o.orderId) === String(orderId));
    if (!original) throw new Error(`Order ${orderId} not found or already closed`);

    await this.cancelOrder(orderId);

    const newParams = {
      symbol: original.symbol,
      side: original.side.toLowerCase(),
      type: original.type === 'LIMIT' ? 'limit' : 'stop_limit',
      qty: +original.origQty,
      limit_price: changes.limit_price || +original.price,
      stop_price: changes.stop_price || +original.stopPrice,
      time_in_force: 'gtc',
    };

    const newOrder = await this.placeOrder(newParams);
    return { id: newOrder.id, modified: true, replaced: orderId };
  }

  async cancelOrder(orderId) {
    // Need symbol to cancel — scan open orders
    const orders = await this._signedRequest('GET', '/api/v3/openOrders');
    const order = orders.find(o => String(o.orderId) === String(orderId));
    if (!order) throw new Error(`Order ${orderId} not found in open orders`);

    await this._signedRequest('DELETE', '/api/v3/order', {
      symbol: order.symbol,
      orderId: +orderId,
    });
    return { id: orderId, cancelled: true };
  }

  async getOrderStatus(orderId) {
    // Scan all symbols — or use allOrders with known symbol
    const openOrders = await this._signedRequest('GET', '/api/v3/openOrders');
    let order = openOrders.find(o => String(o.orderId) === String(orderId));

    if (!order) {
      // Not in open orders — check account trades
      // This is limited; ideally caller tracks the symbol
      throw new Error(`Order ${orderId} not in open orders. Track symbol to query history.`);
    }

    const statusMap = {
      'NEW': 'new',
      'PARTIALLY_FILLED': 'partially_filled',
      'FILLED': 'filled',
      'CANCELED': 'cancelled',
      'REJECTED': 'rejected',
      'EXPIRED': 'expired',
      'PENDING_CANCEL': 'cancelled',
    };

    return {
      id: String(order.orderId),
      status: statusMap[order.status] || order.status.toLowerCase(),
      filled_avg_price: +order.cummulativeQuoteQty / +order.executedQty || null,
      filled_qty: +order.executedQty,
      filled_at: order.updateTime ? new Date(order.updateTime).toISOString() : null,
      qty: +order.origQty,
      reject_reason: order.status === 'REJECTED' ? 'rejected by exchange' : null,
    };
  }

  async closePosition(symbol) {
    const account = await this._signedRequest('GET', '/api/v3/account');
    const asset = symbol.replace('USDT', '').replace('BUSD', '');
    const balance = account.balances.find(b => b.asset === asset);
    if (!balance || +balance.free <= 0) return { closed: false, reason: 'no_position' };

    const result = await this.placeOrder({
      symbol,
      side: 'sell',
      type: 'market',
      qty: +balance.free,
      time_in_force: 'ioc',
    });
    return { closed: true, order_id: result.id };
  }

  // ── Helpers ──
  _mapTif(tif) {
    const map = { 'day': 'GTC', 'gtc': 'GTC', 'ioc': 'IOC', 'fok': 'FOK' };
    return map[tif] || 'GTC';
  }

  _formatQty(symbol, qty) {
    // Use step size from exchange info if available
    return String(Math.floor(qty * 100000) / 100000);
  }

  _formatPrice(symbol, price) {
    return String(Math.round(price * 100) / 100);
  }

  _sign(queryString) {
    return crypto.createHmac('sha256', this.apiSecret).update(queryString).digest('hex');
  }

  _signedRequest(method, path, params = {}) {
    params.timestamp = Date.now();
    params.recvWindow = this.recvWindow;
    const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    const signature = this._sign(qs);
    const fullPath = `${path}?${qs}&signature=${signature}`;

    return new Promise((resolve, reject) => {
      const opts = {
        hostname: this.baseHost,
        port: 443,
        path: fullPath,
        method,
        headers: {
          'X-MBX-APIKEY': this.apiKey,
          'Content-Type': 'application/json',
        },
      };

      const req = https.request(opts, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 400) {
              const msg = parsed.msg || JSON.stringify(parsed);
              const err = new Error(`Binance ${method} ${path}: ${res.statusCode} ${msg} (code: ${parsed.code})`);
              err.statusCode = res.statusCode;
              err.binanceCode = parsed.code;
              err.code = res.statusCode === 401 ? 'AUTH_FAILED' : parsed.code === -2010 ? 'INSUFFICIENT_BALANCE' : 'API_ERROR';
              return reject(err);
            }
            resolve(parsed);
          } catch (e) {
            reject(new Error(`Binance parse error: ${data.slice(0, 200)}`));
          }
        });
      });

      req.on('error', (err) => { err.code = 'NETWORK_ERROR'; reject(err); });
      req.setTimeout(15000, () => { req.destroy(); reject(Object.assign(new Error('Binance timeout'), { code: 'TIMEOUT' })); });
      req.end();
    });
  }

  _request(method, path) {
    return new Promise((resolve, reject) => {
      const opts = {
        hostname: this.baseHost,
        port: 443,
        path,
        method,
        headers: { 'Content-Type': 'application/json' },
      };

      const req = https.request(opts, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 400) {
              const err = new Error(`Binance ${method} ${path}: ${res.statusCode}`);
              err.statusCode = res.statusCode;
              return reject(err);
            }
            resolve(parsed);
          } catch (e) {
            reject(new Error(`Binance parse error: ${data.slice(0, 200)}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
      req.end();
    });
  }
}

module.exports = BinanceAdapter;
