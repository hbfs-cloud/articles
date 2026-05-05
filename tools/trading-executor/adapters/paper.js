'use strict';

// Paper trading adapter — simulates a broker with real-time Yahoo WebSocket prices.
// Uses wss://streamer.finance.yahoo.com/ for RT ticks (same as signal-monitor.js).
// Fills are simulated locally; no orders go to any exchange.

const path = require('path');
const WebSocket = require('ws');
const protobuf = require('protobufjs');

const PROTO_FILE = path.join(__dirname, '../../PricingData.proto');
const WS_URL = 'wss://streamer.finance.yahoo.com/';

class PaperAdapter {
  constructor(credentials = {}, opts = {}) {
    this.verbose = opts.verbose || false;
    this.balance = credentials.initial_balance || 100000;
    this.buyingPower = this.balance;
    this.lastEquity = this.balance;
    this.currency = credentials.currency || 'USD';
    this.connected = false;
    this._orders = new Map();
    this._positions = new Map();
    this._nextOrderId = 1;
    this._fillDelay = opts.fill_delay_ms || 500;
    this._fillRate = opts.fill_rate || 0.95; // 95% of orders fill
    this._slippageBps = opts.slippage_bps || 5; // 5bps slippage
    this._liveQuotes = credentials.live_quotes !== false; // default: use real Yahoo RT WebSocket
    this._wsCache = new Map(); // symbol → { price, dayHigh, dayLow, dayVolume, ts }
    this._ws = null;
    this._wsHeartbeat = null;
    this._wsStopped = false;
    this._wsRetries = 0;
    this._PricingData = null;
    this._wsSymbols = [];
  }

  async connect(symbols) {
    this.connected = true;
    if (symbols && symbols.length > 0 && this._liveQuotes) {
      await this._initWebSocket(symbols);
    }
    if (this.verbose) console.log(`[paper] Connected (RT WebSocket: ${this._liveQuotes ? 'yes' : 'no'})`);
  }

  async disconnect() {
    this._wsDisconnect();
    this.connected = false;
  }

  async getAccount() {
    const posValue = [...this._positions.values()].reduce((sum, p) => sum + p.qty * p.currentPrice, 0);
    return {
      balance: this.balance,
      buying_power: this.buyingPower,
      currency: this.currency,
      last_equity: this.lastEquity,
      equity: this.balance + posValue,
    };
  }

  async getPositions() {
    return [...this._positions.entries()].map(([symbol, p]) => ({
      symbol,
      qty: p.qty,
      avg_price: p.avgPrice,
      unrealized_pnl: (p.currentPrice - p.avgPrice) * p.qty,
      side: 'long',
    }));
  }

  async getMarketStatus() {
    const now = new Date();
    const h = now.getUTCHours();
    const d = now.getDay();
    if (d === 0 || d === 6) return 'closed';
    if (h >= 13 && h < 14) return 'pre_market'; // 9-10 ET
    if (h >= 14 && h < 20) return 'open'; // 10-16 ET
    if (h >= 20 && h < 24) return 'after_hours';
    return 'closed';
  }

  async getQuote(symbol) {
    // 1. Primary: Yahoo WebSocket RT cache (tick-by-tick, zero latency)
    if (this._liveQuotes && this._wsCache.has(symbol)) {
      const tick = this._wsCache.get(symbol);
      const pos = this._positions.get(symbol);
      if (pos) pos.currentPrice = tick.price;
      return {
        last: tick.price,
        bid: tick.price * 0.9999,
        ask: tick.price * 1.0001,
        halted: false,
        volume: tick.dayVolume || 0,
        dayHigh: tick.dayHigh,
        dayLow: tick.dayLow,
      };
    }
    // 2. Fallback: Webull REST (real-time, no auth, no 15min delay)
    if (this._liveQuotes) {
      try {
        const data = await this._fetchWebullQuote(symbol);
        const pos = this._positions.get(symbol);
        if (pos) pos.currentPrice = data.last;
        return data;
      } catch (_) {}
    }
    // 3. Last resort: synthetic price (offline mode)
    const pos = this._positions.get(symbol);
    const basePrice = pos ? pos.currentPrice : this._syntheticPrice(symbol);
    const spread = basePrice * 0.001;
    return {
      last: basePrice,
      bid: basePrice - spread / 2,
      ask: basePrice + spread / 2,
      halted: false,
      volume: Math.floor(Math.random() * 5000000) + 100000,
    };
  }

  _fetchWebullQuote(symbol) {
    const https = require('https');
    return new Promise((resolve, reject) => {
      const searchUrl = `https://quotes-gw.webullfintech.com/api/search/pc/tickers?keyword=${encodeURIComponent(symbol)}&pageIndex=1&pageSize=1&regionId=6`;
      const opts = { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'appid': 'webull-webapp' } };

      // Step 1: resolve tickerId
      https.get(searchUrl, opts, (res) => {
        let data = '';
        res.on('data', c => { data += c; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            const items = parsed.data || parsed;
            const item = Array.isArray(items) ? items[0] : null;
            if (!item || !item.tickerId) return reject(new Error('no ticker'));

            // Step 2: get RT quote
            const quoteUrl = `https://quotes-gw.webullfintech.com/api/stock/tickerRealTime/getQuote?tickerId=${item.tickerId}&includeSecu=1&includeQuote=1&more=1`;
            https.get(quoteUrl, opts, (res2) => {
              let qd = '';
              res2.on('data', c => { qd += c; });
              res2.on('end', () => {
                try {
                  const q = JSON.parse(qd);
                  resolve({
                    last: +(q.close || q.price || q.tradePrice || 0),
                    bid: +(q.bidPrice || q.close || 0),
                    ask: +(q.askPrice || q.close || 0),
                    halted: q.status === 'H',
                    volume: +(q.volume || 0),
                    dayHigh: +(q.high || 0),
                    dayLow: +(q.low || 0),
                  });
                } catch (e) { reject(e); }
              });
            }).on('error', reject);
          } catch (e) { reject(e); }
        });
      }).on('error', reject);
    });
  }

  // ── Yahoo WebSocket (real-time) ──
  async _initWebSocket(symbols) {
    if (!this._liveQuotes || this._ws) return;
    try {
      const root = await protobuf.load(PROTO_FILE);
      this._PricingData = root.lookupType('yfinancedata');
    } catch (e) {
      if (this.verbose) console.log('[paper] protobuf load failed, falling back to synthetic:', e.message);
      this._liveQuotes = false;
      return;
    }

    this._wsSymbols = symbols;
    this._wsConnect();
  }

  _wsConnect() {
    if (this._wsStopped) return;
    this._ws = new WebSocket(WS_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });

    this._ws.on('open', () => {
      if (this.verbose) console.log(`[paper] WebSocket connected (${this._wsSymbols.length} tickers)`);
      this._wsSubscribe();
      this._wsHeartbeat = setInterval(() => this._wsSubscribe(), 15000);
    });

    this._ws.on('message', (data) => {
      try {
        const buf = Buffer.from(data.toString(), 'base64');
        const msg = this._PricingData.decode(buf);
        if (msg.quoteType === 7 || !msg.id || !msg.price || msg.price <= 0) return;
        const prev = this._wsCache.get(msg.id) || {};
        this._wsCache.set(msg.id, {
          price: msg.price,
          dayHigh: Math.max(msg.dayHigh || msg.price, prev.dayHigh || msg.price),
          dayLow: msg.dayLow > 0 ? Math.min(msg.dayLow, prev.dayLow || Infinity) : (prev.dayLow || msg.price),
          dayVolume: msg.dayVolume || prev.dayVolume || 0,
          ts: Date.now(),
        });
      } catch (_) {}
    });

    this._ws.on('close', () => {
      if (this._wsHeartbeat) { clearInterval(this._wsHeartbeat); this._wsHeartbeat = null; }
      if (this._wsStopped) return;
      const delay = Math.min(3000 * Math.pow(2, this._wsRetries || 0), 60000);
      this._wsRetries = (this._wsRetries || 0) + 1;
      setTimeout(() => this._wsConnect(), delay);
    });

    this._ws.on('error', () => {}); // close fires after error
  }

  _wsSubscribe() {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({ subscribe: this._wsSymbols }));
    }
  }

  _wsDisconnect() {
    this._wsStopped = true;
    if (this._wsHeartbeat) { clearInterval(this._wsHeartbeat); this._wsHeartbeat = null; }
    if (this._ws) { try { this._ws.close(); } catch (_) {} this._ws = null; }
  }

  async placeOrder(params) {
    const id = `PAPER-${this._nextOrderId++}`;
    const willFill = Math.random() < this._fillRate;
    const slippage = (Math.random() - 0.5) * 2 * this._slippageBps / 10000;

    const order = {
      id,
      symbol: params.symbol,
      side: params.side,
      type: params.type,
      qty: params.qty,
      limit_price: params.limit_price,
      stop_price: params.stop_price,
      time_in_force: params.time_in_force,
      status: 'new',
      filled_qty: 0,
      filled_avg_price: null,
      filled_at: null,
      created_at: new Date().toISOString(),
    };

    this._orders.set(id, order);

    // Simulate async fill
    if (willFill && (params.type === 'market' || params.type === 'limit')) {
      setTimeout(() => this._simulateFill(id, slippage), this._fillDelay);
    } else if (params.type === 'stop') {
      // Stop orders stay open until triggered
      order.status = 'accepted';
    } else if (!willFill) {
      setTimeout(() => { order.status = 'expired'; }, this._fillDelay * 10);
    }

    return { id };
  }

  _simulateFill(orderId, slippage) {
    const order = this._orders.get(orderId);
    if (!order || order.status === 'cancelled') return;

    const basePrice = order.limit_price || order.stop_price || this._syntheticPrice(order.symbol);
    const fillPrice = +(basePrice * (1 + slippage)).toFixed(4);

    order.status = 'filled';
    order.filled_qty = order.qty;
    order.filled_avg_price = fillPrice;
    order.filled_at = new Date().toISOString();

    // Update positions and balance
    if (order.side === 'buy') {
      const cost = fillPrice * order.qty;
      this.buyingPower -= cost;
      const existing = this._positions.get(order.symbol);
      if (existing) {
        const totalQty = existing.qty + order.qty;
        existing.avgPrice = (existing.avgPrice * existing.qty + fillPrice * order.qty) / totalQty;
        existing.qty = totalQty;
        existing.currentPrice = fillPrice;
      } else {
        this._positions.set(order.symbol, { qty: order.qty, avgPrice: fillPrice, currentPrice: fillPrice });
      }
    } else {
      const proceeds = fillPrice * order.qty;
      this.buyingPower += proceeds;
      const existing = this._positions.get(order.symbol);
      if (existing) {
        const pnl = (fillPrice - existing.avgPrice) * order.qty;
        this.balance += pnl;
        existing.qty -= order.qty;
        if (existing.qty <= 0) this._positions.delete(order.symbol);
      }
    }
  }

  async modifyOrder(orderId, changes) {
    const order = this._orders.get(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);
    if (order.status === 'filled' || order.status === 'cancelled') {
      throw new Error(`Cannot modify ${order.status} order`);
    }
    if (changes.stop_price) order.stop_price = changes.stop_price;
    if (changes.limit_price) order.limit_price = changes.limit_price;
    return { id: orderId, modified: true };
  }

  async cancelOrder(orderId) {
    const order = this._orders.get(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);
    if (order.status === 'filled') throw new Error('Cannot cancel filled order');
    order.status = 'cancelled';
    return { id: orderId, cancelled: true };
  }

  async getOrderStatus(orderId) {
    const order = this._orders.get(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);
    return {
      id: order.id,
      status: order.status,
      filled_avg_price: order.filled_avg_price,
      filled_qty: order.filled_qty,
      filled_at: order.filled_at,
      qty: order.qty,
      reject_reason: null,
    };
  }

  async closePosition(symbol) {
    const pos = this._positions.get(symbol);
    if (!pos) return { closed: false, reason: 'no_position' };
    const sellResult = await this.placeOrder({
      symbol,
      side: 'sell',
      type: 'market',
      qty: pos.qty,
      time_in_force: 'day',
    });
    // Wait for simulated fill
    await new Promise(r => setTimeout(r, this._fillDelay + 100));
    return { closed: true, order_id: sellResult.id };
  }

  _syntheticPrice(symbol) {
    // Deterministic pseudo-random price per symbol
    let hash = 0;
    for (let i = 0; i < symbol.length; i++) hash = ((hash << 5) - hash) + symbol.charCodeAt(i);
    return 20 + Math.abs(hash % 480); // $20–$500 range
  }
}

module.exports = PaperAdapter;
