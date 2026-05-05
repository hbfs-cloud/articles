'use strict';

// Engine — state machine that interprets a DSL trading plan and drives a broker adapter.
// Phases: INIT → PRE_MARKET → OPEN_SESSION → MONITOR → CLOSE_SESSION → DONE

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

const PHASES = ['INIT', 'PRE_MARKET', 'OPEN_SESSION', 'MONITOR', 'CLOSE_SESSION', 'DONE'];

const ORDER_STATES = {
  PENDING: 'PENDING',
  SUBMITTED: 'SUBMITTED',
  PARTIAL: 'PARTIAL',
  FILLED: 'FILLED',
  CANCELLED: 'CANCELLED',
  REJECTED: 'REJECTED',
  SKIPPED: 'SKIPPED',
};

class Engine extends EventEmitter {
  constructor(plan, adapter, opts = {}) {
    super();
    this.plan = plan;
    this.adapter = adapter;
    this.verbose = opts.verbose || false;
    this.logDir = opts.logDir || './logs';
    this.phase = 'INIT';
    this.running = false;
    this.trades = [];
    this.orderState = new Map(); // orderId → { state, brokerOrderId, fills, ... }
    this.positionState = new Map(); // ticker → { qty, avgPrice, unrealizedPnl, exitOrders }
    this.errors = [];
    this.log = [];
    this._monitorInterval = null;
  }

  _log(level, msg, data) {
    const entry = { ts: new Date().toISOString(), level, msg, data };
    this.log.push(entry);
    if (this.verbose || level === 'ERROR' || level === 'WARN') {
      const icon = { INFO: 'ℹ️', WARN: '⚠️', ERROR: '❌', FILL: '✅', TRADE: '💰', PHASE: '🔄' }[level] || '•';
      console.log(`${icon} [${entry.ts.slice(11, 19)}] ${msg}`, data ? JSON.stringify(data).slice(0, 200) : '');
    }
  }

  async run() {
    this.running = true;
    this._log('PHASE', `Engine starting — mode=${this.plan.mode.name} broker=${this.plan.broker.name}`);

    try {
      await this._phaseInit();
      await this._phasePreMarket();
      await this._phaseOpenSession();
      await this._phaseMonitor();
      await this._phaseClose();
    } catch (err) {
      this._log('ERROR', 'Fatal engine error', { error: err.message, stack: err.stack });
      throw err;
    } finally {
      this.phase = 'DONE';
      await this._exportLog();
    }
  }

  // ── Phase: INIT ──
  async _phaseInit() {
    this.phase = 'INIT';
    this._log('PHASE', 'Phase: INIT — connecting to broker');

    await this.adapter.connect();
    const account = await this.adapter.getAccount();
    this._log('INFO', 'Account connected', {
      balance: account.balance,
      buying_power: account.buying_power,
      currency: account.currency,
    });

    // Reconcile existing positions
    const brokerPositions = await this.adapter.getPositions();
    this._log('INFO', `Broker has ${brokerPositions.length} open positions`);

    for (const bp of brokerPositions) {
      this.positionState.set(bp.symbol, {
        qty: bp.qty,
        avgPrice: bp.avg_price,
        unrealizedPnl: bp.unrealized_pnl,
        side: bp.side,
        brokerManaged: true,
      });
    }

    // Init order states
    for (const order of this.plan.orders) {
      this.orderState.set(order.id, {
        state: order.action === 'SKIP' ? ORDER_STATES.SKIPPED : ORDER_STATES.PENDING,
        brokerOrderId: null,
        fills: [],
        exitOrders: [],
        ticker: order.ticker,
        brokerSymbol: order.broker_symbol,
      });
    }
  }

  // ── Phase: PRE_MARKET ──
  async _phasePreMarket() {
    this.phase = 'PRE_MARKET';
    this._log('PHASE', 'Phase: PRE_MARKET — running checks');

    for (const step of (this.plan.lifecycle.on_start || [])) {
      switch (step.step) {
        case 'CHECK_MARKET_STATUS': {
          const status = await this.adapter.getMarketStatus();
          if (status === 'closed' && !this._isWeekday()) {
            this._log('WARN', 'Market closed today — aborting');
            this.running = false;
            return;
          }
          this._log('INFO', `Market status: ${status}`);
          break;
        }
        case 'CHECK_VIX': {
          try {
            const vix = await this.adapter.getQuote('VIX');
            if (vix && step.threshold && vix.last > step.threshold) {
              this._log('WARN', `VIX ${vix.last} > kill threshold ${step.threshold} — halting new orders`);
              for (const [id, os] of this.orderState) {
                if (os.state === ORDER_STATES.PENDING) os.state = ORDER_STATES.SKIPPED;
              }
            } else {
              this._log('INFO', `VIX check passed: ${vix?.last || 'N/A'} < ${step.threshold}`);
            }
          } catch (_) {
            this._log('WARN', 'VIX check failed — proceeding without');
          }
          break;
        }
        case 'SYNC_ACCOUNT':
        case 'RECONCILE_POSITIONS':
        case 'LOG_STATE':
          this._log('INFO', `Pre-market: ${step.step}`);
          break;
      }
    }
  }

  // ── Phase: OPEN_SESSION ──
  async _phaseOpenSession() {
    this.phase = 'OPEN_SESSION';
    this._log('PHASE', 'Phase: OPEN_SESSION — executing close-now + placing orders');

    // 1. Close expired positions first
    for (const close of (this.plan.close_now || [])) {
      try {
        this._log('TRADE', `Closing ${close.ticker} — ${close.reason}`, { held: close.held_days });
        const result = await this.adapter.closePosition(close.broker_symbol);
        this.trades.push({
          type: 'CLOSE',
          ticker: close.ticker,
          reason: close.reason,
          result,
          ts: new Date().toISOString(),
        });
      } catch (err) {
        await this._handleError('CLOSE_FAILED', err, { ticker: close.ticker });
      }
    }

    // 2. Process rotation orders (close first, then buy)
    const rotations = this.plan.orders.filter(o => o.action === 'ROTATE' && o.rotation);
    for (const rot of rotations) {
      const os = this.orderState.get(rot.id);
      if (os.state !== ORDER_STATES.PENDING) continue;

      try {
        // Close the rotation target
        this._log('TRADE', `Rotation: closing ${rot.rotation.close_ticker} for ${rot.ticker}`);
        await this.adapter.closePosition(rot.rotation.close_broker_symbol);

        // Place the buy
        await this._placeEntry(rot);
      } catch (err) {
        await this._handleError('ROTATION_FAILED', err, { order: rot.id });
      }
    }

    // 3. Place buy orders
    const buys = this.plan.orders.filter(o => o.action === 'BUY');
    for (const order of buys) {
      const os = this.orderState.get(order.id);
      if (os.state !== ORDER_STATES.PENDING) continue;

      try {
        await this._placeEntry(order);
      } catch (err) {
        await this._handleError(err.code || 'ORDER_FAILED', err, { order: order.id });
      }
    }
  }

  async _placeEntry(order) {
    const os = this.orderState.get(order.id);

    // Pre-entry condition checks
    for (const cond of (order.conditions || []).filter(c => c.phase === 'PRE_ENTRY')) {
      switch (cond.check) {
        case 'GAP_UP': {
          try {
            const quote = await this.adapter.getQuote(order.broker_symbol);
            if (quote && quote.last > order.entry.price * (cond.threshold_ratio || 1.02)) {
              this._log('WARN', `${order.ticker}: gap-up detected (${quote.last} > ${order.entry.price * cond.threshold_ratio}). ${cond.if_true}`);
              if (cond.if_true === 'SKIP_ORDER') { os.state = ORDER_STATES.SKIPPED; return; }
              // WAIT_VWAP_PULLBACK: place limit at entry instead of market
            }
          } catch (_) {}
          break;
        }
        case 'HALTED': {
          try {
            const quote = await this.adapter.getQuote(order.broker_symbol);
            if (quote && quote.halted) {
              this._log('WARN', `${order.ticker}: trading halted — skipping`);
              os.state = ORDER_STATES.SKIPPED;
              return;
            }
          } catch (_) {}
          break;
        }
        case 'SPREAD': {
          try {
            const quote = await this.adapter.getQuote(order.broker_symbol);
            if (quote && quote.bid && quote.ask) {
              const spreadPct = ((quote.ask - quote.bid) / quote.bid) * 100;
              if (spreadPct > (cond.max_spread_pct || 0.5)) {
                this._log('WARN', `${order.ticker}: spread ${spreadPct.toFixed(2)}% > ${cond.max_spread_pct}% — delaying`);
                await this._sleep(30000);
              }
            }
          } catch (_) {}
          break;
        }
      }
    }

    // Submit order
    this._log('INFO', `Placing ${order.action} ${order.ticker} @ ${order.entry.price} x${order.entry.size.shares}`);
    const brokerOrder = await this.adapter.placeOrder({
      symbol: order.broker_symbol,
      side: 'buy',
      type: order.entry.type.toLowerCase(),
      qty: order.entry.size.shares,
      limit_price: order.entry.price,
      time_in_force: (order.entry.time_in_force || 'DAY').toLowerCase(),
    });

    os.brokerOrderId = brokerOrder.id;
    os.state = ORDER_STATES.SUBMITTED;
    this._log('INFO', `Order ${order.id} submitted → broker ID: ${brokerOrder.id}`);
  }

  // ── Phase: MONITOR ──
  async _phaseMonitor() {
    this.phase = 'MONITOR';
    this._log('PHASE', 'Phase: MONITOR — watching fills and managing positions');

    const submittedOrders = [...this.orderState.entries()].filter(([, os]) => os.state === ORDER_STATES.SUBMITTED);
    if (submittedOrders.length === 0) {
      this._log('INFO', 'No submitted orders to monitor');
      return;
    }

    // Poll loop — check fills every 5 seconds
    const MAX_POLLS = 720; // 1 hour max
    let polls = 0;

    while (this.running && polls < MAX_POLLS) {
      polls++;
      let allTerminal = true;

      for (const [orderId, os] of this.orderState) {
        if (os.state !== ORDER_STATES.SUBMITTED && os.state !== ORDER_STATES.PARTIAL) continue;
        allTerminal = false;

        try {
          const status = await this.adapter.getOrderStatus(os.brokerOrderId);

          if (status.status === 'filled') {
            os.state = ORDER_STATES.FILLED;
            os.fills.push({ price: status.filled_avg_price, qty: status.filled_qty, ts: status.filled_at });
            this._log('FILL', `${os.ticker} FILLED @ ${status.filled_avg_price} x${status.filled_qty}`);

            // Execute on_fill lifecycle
            await this._onFill(orderId, os, status);
          } else if (status.status === 'partially_filled') {
            os.state = ORDER_STATES.PARTIAL;
            this._log('INFO', `${os.ticker} partial fill: ${status.filled_qty}/${status.qty}`);
          } else if (status.status === 'cancelled' || status.status === 'expired') {
            os.state = ORDER_STATES.CANCELLED;
            this._log('WARN', `${os.ticker} order ${status.status}`);
          } else if (status.status === 'rejected') {
            os.state = ORDER_STATES.REJECTED;
            this._log('ERROR', `${os.ticker} order rejected: ${status.reject_reason || 'unknown'}`);
          }
        } catch (err) {
          await this._handleError('MONITOR_FAILED', err, { orderId });
        }
      }

      // Check breakeven on filled positions
      for (const [ticker, pos] of this.positionState) {
        if (!pos.breakeven_active && pos.entryPrice && pos.breakeven_pct) {
          try {
            const quote = await this.adapter.getQuote(ticker);
            if (quote && quote.last) {
              const pnlPct = ((quote.last - pos.entryPrice) / pos.entryPrice) * 100;
              if (pnlPct >= pos.breakeven_pct) {
                this._log('TRADE', `${ticker}: breakeven triggered (${pnlPct.toFixed(1)}% ≥ ${pos.breakeven_pct}%)`);
                await this._onBreakeven(ticker, pos);
                pos.breakeven_active = true;
              }
            }
          } catch (_) {}
        }
      }

      // Check circuit breaker
      try {
        const account = await this.adapter.getAccount();
        const dayPnlPct = ((account.balance - account.last_equity) / account.last_equity) * 100;
        if (this.plan.risk.circuit_breaker && dayPnlPct < -this.plan.risk.circuit_breaker.daily_loss_pct) {
          this._log('ERROR', `CIRCUIT BREAKER: portfolio down ${dayPnlPct.toFixed(1)}% today`);
          await this._cancelAllPending();
          break;
        }
      } catch (_) {}

      if (allTerminal) break;
      await this._sleep(5000);
    }
  }

  async _onFill(orderId, os, fillStatus) {
    const order = this.plan.orders.find(o => o.id === orderId);
    if (!order || !order.exit) return;

    const filledPrice = fillStatus.filled_avg_price;
    const filledQty = fillStatus.filled_qty;

    // Track position
    this.positionState.set(os.brokerSymbol, {
      qty: filledQty,
      entryPrice: filledPrice,
      breakeven_pct: order.exit.breakeven?.trigger_pct,
      breakeven_active: false,
      exitOrders: [],
    });

    // Place bracket exits
    try {
      // Stop loss
      if (order.exit.stop_loss) {
        const slOrder = await this.adapter.placeOrder({
          symbol: os.brokerSymbol,
          side: 'sell',
          type: 'stop',
          qty: filledQty,
          stop_price: order.exit.stop_loss.price,
          time_in_force: 'gtc',
        });
        os.exitOrders.push({ type: 'SL', brokerOrderId: slOrder.id });
        this._log('INFO', `SL placed for ${os.ticker} @ ${order.exit.stop_loss.price} → ${slOrder.id}`);
      }

      // Take profit 1 (partial)
      if (order.exit.take_profit_1) {
        const tp1Qty = Math.floor(filledQty * (order.exit.take_profit_1.partial_exit_pct || 50) / 100);
        if (tp1Qty > 0) {
          const tp1Order = await this.adapter.placeOrder({
            symbol: os.brokerSymbol,
            side: 'sell',
            type: 'limit',
            qty: tp1Qty,
            limit_price: order.exit.take_profit_1.price,
            time_in_force: 'gtc',
          });
          os.exitOrders.push({ type: 'TP1', brokerOrderId: tp1Order.id, qty: tp1Qty });
          this._log('INFO', `TP1 placed for ${os.ticker} @ ${order.exit.take_profit_1.price} x${tp1Qty} → ${tp1Order.id}`);
        }
      }

      // Take profit 2 (remaining)
      if (order.exit.take_profit_2) {
        const tp1Qty = Math.floor(filledQty * (order.exit.take_profit_1?.partial_exit_pct || 50) / 100);
        const tp2Qty = filledQty - tp1Qty;
        if (tp2Qty > 0) {
          const tp2Order = await this.adapter.placeOrder({
            symbol: os.brokerSymbol,
            side: 'sell',
            type: 'limit',
            qty: tp2Qty,
            limit_price: order.exit.take_profit_2.price,
            time_in_force: 'gtc',
          });
          os.exitOrders.push({ type: 'TP2', brokerOrderId: tp2Order.id, qty: tp2Qty });
          this._log('INFO', `TP2 placed for ${os.ticker} @ ${order.exit.take_profit_2.price} x${tp2Qty} → ${tp2Order.id}`);
        }
      }
    } catch (err) {
      this._log('ERROR', `Failed to place exit orders for ${os.ticker}: ${err.message}`);
    }

    this.trades.push({
      type: 'ENTRY',
      ticker: os.ticker,
      price: filledPrice,
      qty: filledQty,
      orderId,
      ts: new Date().toISOString(),
    });
  }

  async _onBreakeven(symbol, pos) {
    // Find the SL exit order and modify it to entry price
    for (const [orderId, os] of this.orderState) {
      if (os.brokerSymbol !== symbol) continue;
      const slExit = os.exitOrders.find(e => e.type === 'SL');
      if (slExit) {
        try {
          await this.adapter.modifyOrder(slExit.brokerOrderId, { stop_price: pos.entryPrice });
          this._log('TRADE', `Breakeven: moved SL to ${pos.entryPrice} for ${symbol}`);
        } catch (err) {
          this._log('ERROR', `Failed to modify SL for breakeven: ${err.message}`);
        }
      }
    }
  }

  // ── Phase: CLOSE ──
  async _phaseClose() {
    this.phase = 'CLOSE_SESSION';
    this._log('PHASE', 'Phase: CLOSE_SESSION — cleaning up');
    await this._cancelAllPending();
  }

  async _cancelAllPending() {
    for (const [orderId, os] of this.orderState) {
      if (os.state === ORDER_STATES.SUBMITTED && os.brokerOrderId) {
        try {
          await this.adapter.cancelOrder(os.brokerOrderId);
          os.state = ORDER_STATES.CANCELLED;
          this._log('INFO', `Cancelled unfilled order ${orderId} (${os.ticker})`);
        } catch (err) {
          this._log('WARN', `Failed to cancel ${orderId}: ${err.message}`);
        }
      }
    }
  }

  // ── Error handling ──
  async _handleError(code, err, context) {
    this._log('ERROR', `${code}: ${err.message}`, context);
    this.errors.push({ code, message: err.message, context, ts: new Date().toISOString() });

    const handler = this.plan.error_handlers?.[code];
    if (!handler) return;

    switch (handler.action) {
      case 'SKIP':
      case 'LOG_AND_SKIP':
        break;
      case 'RECONNECT':
        for (let i = 0; i < (handler.max_retries || 3); i++) {
          const delay = handler.backoff_ms?.[Math.min(i, handler.backoff_ms.length - 1)] || 5000;
          this._log('INFO', `Reconnect attempt ${i + 1} in ${delay}ms`);
          await this._sleep(delay);
          try {
            await this.adapter.connect();
            this._log('INFO', 'Reconnected successfully');
            return;
          } catch (_) {}
        }
        this._log('ERROR', 'All reconnect attempts failed');
        this.running = false;
        break;
      case 'REDUCE_SIZE':
        break;
      case 'BACKOFF':
        await this._sleep(handler.delay_ms || 5000);
        break;
    }
  }

  // ── Shutdown ──
  async shutdown() {
    this.running = false;
    if (this._monitorInterval) clearInterval(this._monitorInterval);
    await this._cancelAllPending();
    await this._exportLog();
    try { await this.adapter.disconnect(); } catch (_) {}
    this._log('PHASE', 'Engine shut down');
  }

  // ── Export ──
  async _exportLog() {
    fs.mkdirSync(this.logDir, { recursive: true });
    const ts = new Date().toISOString().slice(0, 10);
    const logPath = path.join(this.logDir, `execution-${this.plan.mode.name}-${this.plan.broker.name}-${ts}.json`);
    const summary = {
      plan: { mode: this.plan.mode.name, broker: this.plan.broker.name, date: this.plan.valid_for },
      orders: Object.fromEntries(this.orderState),
      trades: this.trades,
      errors: this.errors,
      log: this.log,
    };
    fs.writeFileSync(logPath, JSON.stringify(summary, null, 2));
    this._log('INFO', `Execution log: ${logPath}`);

    // Print summary
    const filled = [...this.orderState.values()].filter(os => os.state === ORDER_STATES.FILLED).length;
    const skipped = [...this.orderState.values()].filter(os => os.state === ORDER_STATES.SKIPPED).length;
    const rejected = [...this.orderState.values()].filter(os => os.state === ORDER_STATES.REJECTED).length;
    console.log(`\n📊 Session Summary — ${this.plan.mode.name} / ${this.plan.broker.name}`);
    console.log(`   Filled: ${filled} | Skipped: ${skipped} | Rejected: ${rejected} | Errors: ${this.errors.length}`);
    console.log(`   Trades: ${this.trades.length} | Log: ${logPath}`);
  }

  _isWeekday() {
    const d = new Date().getDay();
    return d !== 0 && d !== 6;
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

module.exports = { Engine, ORDER_STATES };
