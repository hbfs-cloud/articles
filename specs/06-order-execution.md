# PRD-06: Order Execution Engine

**Version**: 1.0  
**Source**: `tools/trading-executor/engine.js`, `tools/gen-trading-plan.js`  
**Status**: Authoritative specification — implement from this document only.

---

## 1. Overview

The execution engine (`Engine`) is a stateful EventEmitter that reads a trading plan (JSON DSL) and drives a broker adapter through a deterministic 6-phase lifecycle. It is broker-agnostic: all broker I/O goes through the adapter interface (PRD-07). It emits structured log events consumed by the Notifier (PRD-07 §6).

---

## 2. Trading Plan Schema

Plans are produced by `tools/gen-trading-plan.js` and stored at:
```
data/trading-plans/{mode}-{broker}-{YYYYMMDD}.json
```

### 2.1 Full Plan JSON Schema

```json
{
  "version": "1.0",
  "dsl": "dailytickers-trading-plan",
  "generated_at": "2026-05-07T22:00:00.000Z",
  "valid_for": "20260507",

  "mode": {
    "name": "balanced",
    "strategySlotId": "balanced",
    "regime": "RISK-ON",
    "vix_kill": 35,
    "horizon_days": 5,
    "breakeven_pct": 2
  },

  "broker": {
    "name": "alpaca",
    "type": "live",
    "credentials": {
      "api_key": "${ALPACA_API_KEY}",
      "api_secret": "${ALPACA_API_SECRET}",
      "base_url": "https://paper-api.alpaca.markets"
    }
  },

  "account": {
    "nominal_usd": 10000
  },

  "session": {
    "timezone": "America/New_York",
    "market_open": "09:30",
    "market_close": "16:00",
    "post_market": "20:00",
    "extended_hours": false
  },

  "risk": {
    "max_portfolio_heat_pct": "10.0",
    "max_single_loss_pct": 3,
    "max_slippage_pct": 1.0,
    "max_spread_pct": 0.5,
    "circuit_breaker": {
      "daily_loss_pct": 5,
      "action": "HALT_ALL_ORDERS",
      "description": "If portfolio drops 5% intraday, cancel all pending orders and alert."
    },
    "correlation_limit": 0.85,
    "max_sector_concentration": 3
  },

  "orders": [
    {
      "id": "ORD-001",
      "action": "BUY",
      "ticker": "NVDA",
      "broker_symbol": "NVDA",
      "broker": {
        "symbol": "NVDA",
        "exchange": "NASDAQ",
        "isin": "US67066G1040",
        "currency": "USD",
        "asset_type": "equity",
        "tradable": true,
        "marginable": true,
        "shortable": true,
        "min_order_size": 1,
        "price_increment": 0.01
      },
      "entry": {
        "type": "LIMIT",
        "price": 120.50,
        "vwap_gate": {
          "enabled": true,
          "max_open_ratio": 1.01,
          "description": "Fill only if next open <= entry * 1.01. If gap-up above threshold, wait for VWAP pullback."
        },
        "size": {
          "method": "FIXED_NOMINAL",
          "nominal_usd": 3333,
          "shares": 27,
          "pct_of_portfolio": 33.33
        },
        "valid_from": "2026-05-07T09:30:00-04:00",
        "valid_until": "2026-05-07T16:00:00-04:00",
        "time_in_force": "DAY"
      },
      "exit": {
        "stop_loss": {
          "type": "STOP",
          "price": 115.00,
          "trailing": false
        },
        "take_profit_1": {
          "type": "LIMIT",
          "price": 130.00,
          "partial_exit_pct": 50,
          "description": "Sell 50% of position at TP1"
        },
        "take_profit_2": {
          "type": "LIMIT",
          "price": 140.00,
          "partial_exit_pct": 100,
          "description": "Sell remaining position at TP2"
        },
        "breakeven": {
          "trigger_pct": 2,
          "action": "MOVE_STOP_TO_ENTRY",
          "description": "When unrealized P&L >= 2%, move stop to entry price"
        },
        "time_exit": {
          "horizon_days": 5,
          "expiry_date": "2026-05-14",
          "action": "CLOSE_AT_MARKET_OPEN",
          "description": "If still open after 5 business days, close at next market open"
        }
      },
      "conditions": [
        { "phase": "PRE_ENTRY", "check": "GAP_UP", "threshold_ratio": 1.02, "if_true": "WAIT_VWAP_PULLBACK" },
        { "phase": "PRE_ENTRY", "check": "HALTED", "if_true": "SKIP_ORDER" },
        { "phase": "PRE_ENTRY", "check": "SPREAD", "max_spread_pct": 0.5, "if_true": "DELAY_30S" },
        { "phase": "POST_FILL", "check": "SLIPPAGE", "max_slippage_pct": 1, "if_exceeded": "LOG_WARNING" }
      ],
      "metadata": {
        "score": 93,
        "strategy": "Momentum",
        "rr": "1:1.7",
        "sharia": true,
        "thesis": "NVDA AI capex tailwind, VWAP support, high volume setup",
        "priority": 1
      }
    }
  ],

  "close_now": [
    {
      "action": "CLOSE",
      "ticker": "AAPL",
      "broker_symbol": "AAPL",
      "broker": {
        "symbol": "AAPL",
        "exchange": "NASDAQ",
        "currency": "USD"
      },
      "reason": "HORIZON_EXPIRED",
      "held_days": 5,
      "horizon": 5,
      "current_pnl_pct": 2.5,
      "execution": {
        "type": "MARKET",
        "timing": "AT_OPEN",
        "description": "Close at market open — horizon expired, exit regardless of P&L"
      }
    }
  ],

  "pre_market_steps": [
    { "step": "GET_ACCOUNT", "description": "Fetch balance, buying power, positions" },
    { "step": "RECONCILE_POSITIONS", "description": "Compare broker positions with expected positions. Alert on discrepancy." },
    { "step": "CHECK_VIX", "threshold": 35, "action": "HALT_IF_ABOVE", "description": "If VIX > 35, halt all new orders" },
    { "step": "LOG_STATE", "description": "Log initial account state for audit trail" }
  ],

  "on_fill": [
    { "step": "PLACE_EXITS", "description": "Immediately place SL and TP1/TP2 bracket orders" },
    { "step": "LOG_FILL", "description": "Record fill price, time, slippage, fees" },
    { "step": "CHECK_BREAKEVEN", "description": "Start monitoring for breakeven trigger" },
    { "step": "NOTIFY", "channel": "telegram", "description": "Send fill notification to Telegram" }
  ],

  "on_exit": [
    { "step": "CANCEL_REMAINING_EXITS", "description": "Cancel the other side (SL if TP hit, TP if SL hit)" },
    { "step": "LOG_EXIT", "description": "Record exit price, P&L, hold time" },
    { "step": "CHECK_ROTATION", "description": "If slot freed, check for pending rotation candidates" },
    { "step": "UPDATE_PORTFOLIO", "description": "Update local portfolio state file" }
  ],

  "on_breakeven": [
    { "step": "MODIFY_STOP", "description": "Move stop loss to entry price (+ spread buffer)" },
    { "step": "LOG_BREAKEVEN", "description": "Record breakeven activation" }
  ],

  "on_horizon_expiry": [
    { "step": "CLOSE_AT_MARKET", "description": "Submit market close order at next open" },
    { "step": "CANCEL_EXITS", "description": "Cancel any pending TP/SL orders for this position" }
  ],

  "close_session_steps": [
    { "step": "CANCEL_UNFILLED", "description": "Cancel any GTC orders that were not filled today" },
    { "step": "EXPORT_TRADES", "description": "Write execution log to data/execution-logs/trades-YYYYMMDD.json" },
    { "step": "SUMMARY", "description": "Print session summary: fills, skips, errors, P&L" }
  ],

  "error_handlers": {
    "INSUFFICIENT_MARGIN": {
      "action": "REDUCE_SIZE",
      "reduce_pct": 50,
      "retry": true,
      "max_retries": 1
    },
    "SYMBOL_NOT_FOUND": {
      "action": "SKIP",
      "log_level": "ERROR"
    },
    "CONNECTION_LOST": {
      "action": "RECONNECT",
      "max_retries": 10,
      "backoff_ms": [1000, 2000, 5000, 10000, 30000],
      "on_failure": "CANCEL_PENDING_AND_ALERT"
    },
    "PARTIAL_FILL": {
      "action": "KEEP_PARTIAL",
      "adjust_exits": true,
      "description": "Keep partial fill. Adjust TP/SL quantities proportionally."
    },
    "ORDER_REJECTED": {
      "action": "LOG_AND_SKIP",
      "log_level": "WARN"
    },
    "MARKET_HALTED": {
      "action": "WAIT_RESUME",
      "timeout_min": 60,
      "on_timeout": "CANCEL_ORDER"
    },
    "RATE_LIMITED": {
      "action": "BACKOFF",
      "delay_ms": 5000,
      "max_retries": 3
    },
    "DUPLICATE_ORDER": {
      "action": "SKIP",
      "description": "Order already exists for this ticker in this session"
    }
  }
}
```

---

## 3. Engine Class — Public Interface

```javascript
'use strict';
const EventEmitter = require('events');

class Engine extends EventEmitter {
  /**
   * @param {Object} plan       - Parsed trading plan JSON (§2.1)
   * @param {Object} adapter    - Broker adapter instance implementing PRD-07 interface
   * @param {Object} opts
   * @param {boolean} opts.verbose   - Log all INFO-level events to stdout (default: false)
   * @param {string}  opts.logDir    - Directory for trade log export (default: './logs')
   */
  constructor(plan, adapter, opts = {}) {}

  /**
   * Run the full 6-phase lifecycle. Resolves when DONE phase completes.
   * Rejects only on unrecoverable errors (adapter connect failure, etc.).
   * @returns {Promise<SessionSummary>}
   */
  async run() {}

  /**
   * Abort the current session. Cancels all pending orders, transitions to DONE.
   * Safe to call from any phase.
   * @returns {Promise<void>}
   */
  async abort() {}

  // Internal state (read-only for consumers)
  get phase() {}          // Current phase string: one of PHASES
  get trades() {}         // Array of trade records logged this session
  get orderState() {}     // Map<orderId, OrderStateRecord>
  get positionState() {}  // Map<ticker, PositionStateRecord>
  get errors() {}         // Array of error records
  get log() {}            // Array of all log entries
}
```

### 3.1 SessionSummary (resolved by `run()`)

```javascript
{
  mode: string,            // e.g. "balanced"
  broker: string,          // e.g. "alpaca"
  date: string,            // "YYYYMMDD"
  phases_completed: string[],
  fills: number,
  skips: number,
  closes: number,
  errors: number,
  total_pnl_pct: number,   // sum of realized P&L this session
  log_path: string         // path to exported log file
}
```

### 3.2 Internal State Types

```javascript
// OrderStateRecord — stored in engine.orderState Map (key = plan order id, e.g. "ORD-001")
{
  state: 'PENDING' | 'SUBMITTED' | 'PARTIAL' | 'FILLED' | 'CANCELLED' | 'REJECTED' | 'SKIPPED',
  ticker: string,
  brokerSymbol: string,
  brokerOrderId: string | null,   // set after adapter.placeOrder() succeeds
  fills: Array<{ price: number, qty: number, ts: string }>,
  exitOrders: Array<{ type: 'SL' | 'TP1' | 'TP2', brokerOrderId: string, qty: number }>,
  skipReason: string | null,
  submittedAt: string | null,     // ISO timestamp
  filledAt: string | null         // ISO timestamp
}

// PositionStateRecord — stored in engine.positionState Map (key = broker symbol)
{
  qty: number,
  entryPrice: number,
  breakeven_pct: number,
  breakeven_active: boolean,
  exitOrders: Array<{ type: 'SL' | 'TP1' | 'TP2', brokerOrderId: string, qty: number }>
}
```

---

## 4. Phase Lifecycle

### 4.1 Phase Sequence

```
INIT → PRE_MARKET → OPEN_SESSION → MONITOR → CLOSE_SESSION → DONE
```

All phases run sequentially. A phase failure triggers `_handleError()`. If unrecoverable, the engine transitions directly to `CLOSE_SESSION` then `DONE`.

### 4.2 INIT Phase

1. Set `this.phase = 'INIT'`.
2. Call `await this.adapter.connect(allSymbols)` where `allSymbols` is the union of all `broker_symbol` values from `plan.orders` and `plan.close_now`.
3. If connect throws: emit `ERROR`, reject `run()` immediately (no phase cleanup).
4. Log: `{ level: 'PHASE', msg: 'Phase: INIT — connecting to broker' }`.

### 4.3 PRE_MARKET Phase

1. Set `this.phase = 'PRE_MARKET'`.
2. Execute `plan.pre_market_steps` in order:

   **GET_ACCOUNT**: Call `adapter.getAccount()`. Store result. Log balance + buying power.

   **RECONCILE_POSITIONS**: Call `adapter.getPositions()`. For each position returned, check if it appears in `plan.orders` or `plan.close_now`. If a position exists in broker but not in plan, log `WARN: unexpected position {symbol}`. If a position is in plan.close_now but not in broker, log `WARN: expected position not found {symbol}`.

   **CHECK_VIX**: Fetch VIX quote via `adapter.getQuote('^VIX')` (or `'VIX'` for brokers that support it). If `quote.last > plan.mode.vix_kill`: set `this.running = false`, log `ERROR: VIX KILL {vix} > {kill}`, skip to CLOSE_SESSION.

   **LOG_STATE**: Log full account snapshot as JSON to engine log.

### 4.4 OPEN_SESSION Phase

1. Set `this.phase = 'OPEN_SESSION'`.
2. Process `plan.close_now` entries first (in order):
   - For each `CLOSE` action: call `adapter.closePosition(close.broker_symbol)`.
   - On success: log `TRADE: closed {ticker} — {reason}`.
   - On failure: log `ERROR`, continue to next close (do not abort).
3. Process rotation closes (positions that have been replaced in this plan cycle — identified by `reason: 'ROTATION'`): same as above.

### 4.5 MONITOR Phase

1. Set `this.phase = 'MONITOR'`.
2. Submit all entry orders from `plan.orders` (skipped orders are logged, not submitted):

   **Entry Gate Checks** (run before each `placeOrder` call):

   a. **GAP_UP gate**: Call `adapter.getQuote(order.broker_symbol)`. If `quote.last > order.entry.price * 1.02`, set state `SKIPPED` with reason `GAP_UP`. Log `WARN`.

   b. **SPREAD gate**: If `(quote.ask - quote.bid) / quote.last > plan.risk.max_spread_pct / 100`, wait 30 seconds and re-check once. If still too wide, set state `SKIPPED` with reason `SPREAD_TOO_WIDE`.

   c. **HALTED check**: If `adapter.getMarketStatus()` returns `'halted'`, set state `SKIPPED` with reason `HALTED`.

   d. **VWAP gate**: Effective entry price = `Math.min(quote.last, order.entry.price)`. The VWAP gate is advisory (logged), not blocking — it adjusts the order limit price used, not whether to submit.

   For each non-skipped order:
   - Call `adapter.placeOrder({ symbol, side: 'buy', type: 'limit', qty: order.entry.size.shares, limit_price: order.entry.price, time_in_force: order.entry.time_in_force })`.
   - Store returned `{ id }` as `brokerOrderId`.
   - Set state `SUBMITTED`.

3. **Poll loop**: Every 5 seconds, poll all `SUBMITTED` and `PARTIAL` orders via `adapter.getOrderStatus(brokerOrderId)`.

   Status mapping:
   ```
   'filled'           → ORDER_STATES.FILLED  → call _onFill()
   'partially_filled' → ORDER_STATES.PARTIAL  → log info
   'cancelled'        → ORDER_STATES.CANCELLED → log warn
   'expired'          → ORDER_STATES.CANCELLED → log warn
   'rejected'         → ORDER_STATES.REJECTED  → log error with reject_reason
   ```

4. **Breakeven monitor**: For each `FILLED` position in `positionState` where `breakeven_active === false`:
   - Call `adapter.getQuote(ticker)`.
   - Compute `pnlPct = (quote.last - pos.entryPrice) / pos.entryPrice * 100`.
   - If `pnlPct >= pos.breakeven_pct`: call `_onBreakeven(ticker, pos)`.

5. **Circuit breaker**: After each poll cycle, call `adapter.getAccount()`.
   - Compute `dayPnlPct = (account.balance - account.last_equity) / account.last_equity * 100`.
   - If `dayPnlPct < -plan.risk.circuit_breaker.daily_loss_pct`: log `ERROR: CIRCUIT BREAKER`, call `_cancelAllPending()`, break poll loop.

6. **Poll timeout**: Maximum 720 polls = 1 hour. After 720 polls, break loop. Any remaining SUBMITTED orders are cancelled in CLOSE_SESSION.

7. **Termination**: Loop breaks when all tracked orders are in a terminal state (`FILLED`, `CANCELLED`, `REJECTED`, `SKIPPED`) OR circuit breaker fires OR timeout.

### 4.6 CLOSE_SESSION Phase

1. Set `this.phase = 'CLOSE_SESSION'`.
2. Call `_cancelAllPending()`: iterate `orderState`, cancel every order in state `SUBMITTED` or `PARTIAL` via `adapter.cancelOrder(brokerOrderId)`. Log each cancellation.
3. Export trade log to `{logDir}/trades-{YYYYMMDD}.json` (see §7).
4. Log session summary.

### 4.7 DONE Phase

1. Set `this.phase = 'DONE'`.
2. Call `await this.adapter.disconnect()`.
3. Resolve `run()` with `SessionSummary`.

---

## 5. Order State Machine

```
                         ┌─────────────┐
                         │   PENDING   │  (initial state for all plan orders)
                         └──────┬──────┘
                                │
              ┌─────────────────┼──────────────────────┐
              │ entry gates     │ all gates pass        │ not submitted
              │ reject          │                       │
              ▼                 ▼                       │
         ┌─────────┐    ┌────────────┐                 │
         │ SKIPPED │    │ SUBMITTED  │                 │
         └─────────┘    └─────┬──────┘                 │
                              │                         │
             ┌────────────────┼──────────────┐          │
             │                │              │           │
             ▼                ▼              ▼           │
        ┌─────────┐    ┌──────────┐   ┌──────────┐     │
        │CANCELLED│    │ PARTIAL  │   │ REJECTED │     │
        └─────────┘    └────┬─────┘   └──────────┘     │
                            │                            │
                            ▼                            │
                       ┌────────┐                        │
                       │ FILLED │◄───────────────────────┘
                       └────┬───┘
                            │  _onFill(): place SL + TP1 + TP2
                            ▼
                    [bracket orders placed]
```

**Terminal states**: `FILLED`, `CANCELLED`, `REJECTED`, `SKIPPED`.

**State transitions rules**:
- `PENDING → SUBMITTED`: only after all entry gates pass and `placeOrder` succeeds.
- `PENDING → SKIPPED`: any entry gate check fails (GAP_UP, SPREAD_TOO_WIDE, HALTED).
- `SUBMITTED → PARTIAL`: broker reports partial fill; continue polling.
- `SUBMITTED / PARTIAL → FILLED`: broker reports complete fill; trigger `_onFill()`.
- `SUBMITTED / PARTIAL → CANCELLED`: broker cancelled or expired; log WARN.
- `SUBMITTED → REJECTED`: broker rejected; log ERROR with reason.
- Any state → `CANCELLED`: via `_cancelAllPending()` (CLOSE_SESSION or circuit breaker).

---

## 6. On-Fill Lifecycle (`_onFill`)

Called when an order transitions to `FILLED`.

```javascript
async _onFill(orderId, orderStateRecord, fillStatus) {
  const order = this.plan.orders.find(o => o.id === orderId);
  const filledPrice = fillStatus.filled_avg_price;
  const filledQty   = fillStatus.filled_qty;

  // 1. Register position
  this.positionState.set(orderStateRecord.brokerSymbol, {
    qty: filledQty,
    entryPrice: filledPrice,
    breakeven_pct: order.exit.breakeven?.trigger_pct,
    breakeven_active: false,
    exitOrders: [],
  });

  // 2. Place Stop Loss
  if (order.exit.stop_loss) {
    const slOrder = await this.adapter.placeOrder({
      symbol: orderStateRecord.brokerSymbol,
      side: 'sell',
      type: 'stop',
      qty: filledQty,
      stop_price: order.exit.stop_loss.price,
      time_in_force: 'gtc',
    });
    orderStateRecord.exitOrders.push({ type: 'SL', brokerOrderId: slOrder.id, qty: filledQty });
  }

  // 3. Place TP1 (partial — default 50%)
  if (order.exit.take_profit_1) {
    const pct   = order.exit.take_profit_1.partial_exit_pct || 50;
    const tp1Qty = Math.floor(filledQty * pct / 100);
    if (tp1Qty > 0) {
      const tp1Order = await this.adapter.placeOrder({
        symbol: orderStateRecord.brokerSymbol,
        side: 'sell',
        type: 'limit',
        qty: tp1Qty,
        limit_price: order.exit.take_profit_1.price,
        time_in_force: 'gtc',
      });
      orderStateRecord.exitOrders.push({ type: 'TP1', brokerOrderId: tp1Order.id, qty: tp1Qty });
    }
  }

  // 4. Place TP2 (remainder)
  if (order.exit.take_profit_2) {
    const tp1Qty  = orderStateRecord.exitOrders.find(e => e.type === 'TP1')?.qty || 0;
    const tp2Qty  = filledQty - tp1Qty;
    if (tp2Qty > 0) {
      const tp2Order = await this.adapter.placeOrder({
        symbol: orderStateRecord.brokerSymbol,
        side: 'sell',
        type: 'limit',
        qty: tp2Qty,
        limit_price: order.exit.take_profit_2.price,
        time_in_force: 'gtc',
      });
      orderStateRecord.exitOrders.push({ type: 'TP2', brokerOrderId: tp2Order.id, qty: tp2Qty });
    }
  }

  // 5. Append trade record
  this.trades.push({
    type: 'ENTRY',
    ticker: orderStateRecord.ticker,
    broker_symbol: orderStateRecord.brokerSymbol,
    price: filledPrice,
    qty: filledQty,
    orderId,
    ts: new Date().toISOString(),
  });

  // 6. Emit FILL log event (picked up by Notifier)
  this._log('FILL', `${orderStateRecord.ticker} FILLED @ ${filledPrice} x${filledQty}`, {
    ticker: orderStateRecord.ticker,
    price: filledPrice,
    qty: filledQty,
    mode: this.plan.mode.name,
    broker: this.plan.broker.name,
  });
}
```

---

## 7. Breakeven Logic (`_onBreakeven`)

```javascript
async _onBreakeven(symbol, pos) {
  const slExit = pos.exitOrders.find(e => e.type === 'SL');
  if (slExit) {
    await this.adapter.modifyOrder(slExit.brokerOrderId, { stop_price: pos.entryPrice });
    this._log('TRADE', `Breakeven: moved SL to ${pos.entryPrice} for ${symbol}`, { symbol, entryPrice: pos.entryPrice });
  }
}
```

---

## 8. Error Handling (`_handleError`)

```javascript
async _handleError(errorType, err, context = {}) {
  const handler = this.plan.error_handlers?.[errorType];
  const entry = { ts: new Date().toISOString(), type: errorType, message: err.message, context, handler };
  this.errors.push(entry);
  this._log('ERROR', `${errorType}: ${err.message}`, context);

  if (!handler) return;

  switch (handler.action) {
    case 'RECONNECT': {
      const backoffs = handler.backoff_ms || [1000, 2000, 5000];
      for (let i = 0; i < (handler.max_retries || 3); i++) {
        await this._sleep(backoffs[Math.min(i, backoffs.length - 1)]);
        try { await this.adapter.connect(); return; } catch (_) {}
      }
      // On exhaustion
      await this._cancelAllPending();
      this.running = false;
      break;
    }
    case 'REDUCE_SIZE': {
      // Caller must check return value and adjust order qty
      context._reduceByPct = handler.reduce_pct;
      break;
    }
    case 'BACKOFF': {
      await this._sleep(handler.delay_ms || 5000);
      break;
    }
    case 'SKIP':
    case 'LOG_AND_SKIP':
    default:
      break;
  }
}
```

**Error type catalog** (from `plan.error_handlers` keys):

| Error Type | Trigger | Action |
|---|---|---|
| `INSUFFICIENT_MARGIN` | `placeOrder` fails with margin error | Retry with qty halved, once |
| `SYMBOL_NOT_FOUND` | `getQuote` or `placeOrder` returns symbol error | Skip order, log ERROR |
| `CONNECTION_LOST` | Any adapter call throws network error | Reconnect with exponential backoff (up to 10 retries) |
| `PARTIAL_FILL` | `getOrderStatus` returns `partially_filled` | Keep partial, adjust exit quantities proportionally |
| `ORDER_REJECTED` | `getOrderStatus` returns `rejected` | Log WARN, skip |
| `MARKET_HALTED` | `getMarketStatus()` returns `'halted'` | Wait up to 60 min, then cancel |
| `RATE_LIMITED` | Adapter throws 429 error | Backoff 5 seconds, retry up to 3 times |
| `DUPLICATE_ORDER` | Same ticker already has SUBMITTED order | Skip, log WARN |

---

## 9. Log Entry Format

All log entries have this shape (stored in `this.log` array and written to trade export):

```javascript
{
  ts: "2026-05-07T14:32:01.123Z",  // ISO timestamp
  level: "INFO" | "WARN" | "ERROR" | "FILL" | "TRADE" | "PHASE",
  msg: string,
  data: object | null
}
```

**Log levels**:
- `PHASE`: Phase transition announcement.
- `INFO`: Normal operation (order submitted, position update).
- `WARN`: Non-fatal anomaly (partial fill, spread delay, reconciliation mismatch).
- `ERROR`: Recoverable error (order rejected, failed exit placement).
- `FILL`: Entry order filled (triggers Notifier).
- `TRADE`: Trade lifecycle event (breakeven, exit placed, horizon close).

Stdout icon mapping:
```javascript
{ INFO: 'ℹ️', WARN: '⚠️', ERROR: '❌', FILL: '✅', TRADE: '💰', PHASE: '🔄' }
```

---

## 10. Trade Log Export

Written at CLOSE_SESSION to: `{logDir}/trades-{YYYYMMDD}-{mode}-{broker}.json`

```json
{
  "session_date": "2026-05-07",
  "mode": "balanced",
  "broker": "alpaca",
  "generated_at": "2026-05-07T20:01:00.000Z",
  "summary": {
    "fills": 2,
    "skips": 1,
    "closes": 1,
    "errors": 0
  },
  "trades": [
    {
      "type": "ENTRY",
      "ticker": "NVDA",
      "broker_symbol": "NVDA",
      "price": 120.63,
      "qty": 27,
      "orderId": "ORD-001",
      "ts": "2026-05-07T14:32:01.123Z"
    }
  ],
  "log": [ /* full engine.log array */ ]
}
```

---

## 11. Session Timeout

- Maximum monitor poll loop: 720 iterations × 5 seconds = 1 hour.
- Maximum overall session: not hard-capped in engine (depends on adapter `connect()` + phases).
- Callers (run-session.js) may wrap `engine.run()` in a `Promise.race` with a 7200-second timeout. On timeout: call `engine.abort()`.

```javascript
// run-session.js pattern
const result = await Promise.race([
  engine.run(),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('SESSION_TIMEOUT')), 7200 * 1000)
  )
]).catch(async (err) => {
  if (err.message === 'SESSION_TIMEOUT') await engine.abort();
  throw err;
});
```

---

## 12. Engine Constructor Options

```javascript
new Engine(plan, adapter, {
  verbose: false,        // boolean — log INFO events to stdout
  logDir: './logs',      // string  — directory for trade export JSON
})
```

---

## 13. Notifier Integration

The `Notifier` class monkey-patches `engine._log()` to intercept FILL, TRADE, and ERROR events:

```javascript
// notifier.js — attach pattern
const origLog = engine._log.bind(engine);
engine._log = (level, msg, data) => {
  origLog(level, msg, data);
  if (level === 'FILL')  notifier._onFill(msg, data);
  if (level === 'TRADE') notifier._onTrade(msg, data);
  if (level === 'ERROR') notifier._onError(msg, data);
  if (level === 'PHASE') notifier._onPhase(msg, data);
};
```

See PRD-07 §6 for full Notifier specification.

---

## 14. Run-Session Batch Executor

`tools/trading-executor/run-session.js` iterates all `config.json` accounts and runs one Engine per mode/broker pair.

### 14.1 config.json Schema

```json
{
  "accounts": [
    {
      "broker": "alpaca",
      "env": {
        "api_key": "ALPACA_API_KEY",
        "api_secret": "ALPACA_API_SECRET"
      },
      "paper": true,
      "modes": ["balanced", "dynamic"],
      "capital_usd": 10000
    },
    {
      "broker": "ibkr",
      "env": {
        "gateway_host": "IBKR_GATEWAY_HOST",
        "gateway_port": "IBKR_GATEWAY_PORT",
        "account_id": "IBKR_ACCOUNT_ID"
      },
      "modes": ["secured", "fortress"],
      "capital_usd": 50000
    },
    {
      "broker": "saxo",
      "env": {
        "access_token": "SAXO_ACCESS_TOKEN",
        "account_key": "SAXO_ACCOUNT_KEY"
      },
      "simulation": true,
      "modes": ["turbo"],
      "capital_usd": 5000
    },
    {
      "broker": "trading212",
      "env": { "api_key": "T212_API_KEY" },
      "demo": true,
      "modes": ["balanced"],
      "capital_usd": 10000
    },
    {
      "broker": "binance",
      "env": {
        "api_key": "BINANCE_API_KEY",
        "api_secret": "BINANCE_API_SECRET"
      },
      "testnet": true,
      "modes": ["tkl"],
      "capital_usd": 5000
    }
  ],
  "settings": {
    "verbose": false,
    "log_dir": "data/execution-logs",
    "dry_run": false,
    "skip_closed_market": true
  }
}
```

### 14.2 Execution Algorithm

```
for each account in config.accounts:
  for each mode in account.modes:
    if FILTER_MODE set and mode != FILTER_MODE: skip
    if FILTER_BROKER set and account.broker != FILTER_BROKER: skip

    planPath = generatePlan(mode, account.broker)
      // calls: node tools/gen-trading-plan.js --mode {mode} --broker {account.broker}
      // returns: "data/trading-plans/{mode}-{account.broker}-{YYYYMMDD}.json"

    plan = JSON.parse(fs.readFileSync(planPath))
    plan.account.nominal_usd = account.capital_usd  // override from config

    if DRY_RUN:
      print plan summary, continue

    creds = resolveCredentials(account)
      // reads env vars listed in account.env{}
      // copies account.paper / account.demo / account.testnet / account.simulation flags
      // returns null if any env var is missing

    if !creds:
      print "PLAN_ONLY — missing credentials", continue

    AdapterClass = require('./adapters/{account.broker}.js')
    adapter = new AdapterClass(creds, { verbose })
    engine  = new Engine(plan, adapter, { verbose, logDir: config.settings.log_dir })
    notifier = new Notifier(engine)  // auto-attaches

    result = await Promise.race([engine.run(), timeout(7200s)])
    results.push({ broker, mode, status: 'OK', ...result })
```

### 14.3 CLI Flags

```
--dry-run          Generate plans, print summaries, do not execute
--mode {name}      Filter to this mode only
--broker {name}    Filter to this broker only
--verbose / -v     Enable verbose logging
```

### 14.4 Credential Resolution

```javascript
function resolveCredentials(account) {
  const creds = {};
  for (const [key, envVar] of Object.entries(account.env || {})) {
    const val = process.env[envVar];
    if (!val) {
      console.error(`Env var ${envVar} not set (broker: ${account.broker})`);
      return null;  // null = no credentials, run plan-only
    }
    creds[key] = val;
  }
  // Copy mode flags
  if (account.paper      !== undefined) creds.paper      = account.paper;
  if (account.demo       !== undefined) creds.demo       = account.demo;
  if (account.testnet    !== undefined) creds.testnet    = account.testnet;
  if (account.simulation !== undefined) creds.simulation = account.simulation;
  return creds;
}
```

Missing credentials do **not** abort the batch — the plan is generated and saved but not executed. The next account/mode pair is processed normally.

> **Unified Engine note**: In the unified engine (PRD-23), the plan `mode` object includes a `strategySlotId` field that identifies the StrategySlot (PRD-23 §3.3). The `mode.name` field is preserved for backward compatibility. Plans are generated from unified `Signal[]` (PRD-23 §3.1) regardless of signal source (scanner, mechanical Go bridge, ML, manual). The same broker adapter (PRD-07) and bracket order logic apply to all signal sources.

<!-- Consistency pass: aligned with PRD-23 Unified Strategy Engine, 2026-05-07 -->
