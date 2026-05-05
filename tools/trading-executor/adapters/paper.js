'use strict';

// Paper trading adapter — simulates a broker with randomized fills.
// Useful for testing execution plans without real money.

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
  }

  async connect() {
    this.connected = true;
    if (this.verbose) console.log('[paper] Connected (simulated)');
  }

  async disconnect() {
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
