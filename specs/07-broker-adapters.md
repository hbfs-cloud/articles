# PRD-07: Multi-Broker Adapter Layer

**Version**: 1.0  
**Source**: `tools/trading-executor/adapters/` (all 6 adapters), `tools/trading-executor/notifier.js`  
**Status**: Authoritative specification — implement from this document only.

---

## 1. Overview

The broker adapter layer provides a uniform interface between the Engine (PRD-06) and each supported broker's native API. The Engine is fully broker-agnostic: it never calls broker APIs directly. All brokers implement the same 9-method interface plus 2 optional methods.

**Supported brokers**: `paper`, `alpaca`, `ibkr`, `saxo`, `trading212`, `binance`

**File locations**: `tools/trading-executor/adapters/{broker}.js`

---

## 2. Common Adapter Interface

Every adapter must implement all methods in this section. Return types are normalized — broker-specific field names are mapped internally by each adapter.

```javascript
class BrokerAdapter {
  /**
   * @param {Object} credentials  - Resolved from env vars by run-session.js
   * @param {Object} opts
   * @param {boolean} opts.verbose
   */
  constructor(credentials, opts = {}) {}

  /**
   * Establish connection and validate credentials.
   * For brokers requiring authentication (Alpaca, Binance, Saxo, T212): make a test API call.
   * For IBKR: check gateway auth status.
   * For Paper: initialize Yahoo WebSocket.
   * @param {string[]} [symbols]  - Optional list of symbols to subscribe to (paper adapter)
   * @throws {Error} if credentials invalid or broker unreachable
   */
  async connect(symbols) {}

  /**
   * Clean shutdown. Cancel any pending subscriptions, close WebSocket if open.
   */
  async disconnect() {}

  /**
   * Fetch current account state.
   * @returns {AccountInfo}
   */
  async getAccount() {}

  /**
   * Fetch all open positions.
   * @returns {Position[]}
   */
  async getPositions() {}

  /**
   * Fetch real-time or last-known quote for a symbol.
   * For T212 (no quote API): fetch from Yahoo Finance via CORS proxy.
   * @param {string} symbol  - Broker-specific symbol (e.g. "NVDA", "NVDA:xnas", "NVDA_US_EQ")
   * @returns {Quote}
   */
  async getQuote(symbol) {}

  /**
   * Get current market status.
   * @returns {'open' | 'closed' | 'pre_market' | 'after_hours' | 'halted'}
   */
  async getMarketStatus() {}

  /**
   * Place an order.
   * @param {OrderParams} params
   * @returns {{ id: string }}  - Broker order ID (string always)
   */
  async placeOrder(params) {}

  /**
   * Modify an existing open order (price, qty, stop price).
   * Brokers that don't support modify (Binance) must cancel-and-resubmit internally.
   * @param {string} orderId
   * @param {ModifyParams} changes
   * @returns {{ id: string, modified: boolean }}
   */
  async modifyOrder(orderId, changes) {}

  /**
   * Cancel an open order.
   * @param {string} orderId
   * @returns {{ id: string, cancelled: boolean }}
   */
  async cancelOrder(orderId) {}

  /**
   * Get current status of an order.
   * @param {string} orderId
   * @returns {OrderStatus}
   */
  async getOrderStatus(orderId) {}

  /**
   * Close an entire position at market (optional, convenience method).
   * Implemented by all adapters. Used by engine for close_now and horizon_expired actions.
   * @param {string} symbol
   * @returns {{ closed: boolean, order_id?: string }}
   */
  async closePosition(symbol) {}
}
```

---

## 3. Normalized Return Types

All adapters return these normalized shapes. Field names do not change between brokers.

### 3.1 AccountInfo

```javascript
{
  balance: number,        // Current cash balance
  buying_power: number,   // Available for new orders
  currency: string,       // e.g. "USD", "EUR"
  last_equity: number,    // Equity at start of day (for P&L % calculation)
  equity: number,         // Total portfolio value (cash + positions)
  // Optional fields (include if available from broker)
  invested: number,       // Total invested amount
  pnl: number,            // Unrealized P&L across all positions
}
```

### 3.2 Position

```javascript
{
  symbol: string,         // Broker-specific symbol
  qty: number,
  avg_price: number,
  current_price: number,  // Latest market price
  unrealized_pnl: number, // In account currency
  side: 'long' | 'short',
}
```

### 3.3 Quote

```javascript
{
  bid: number,
  ask: number,
  last: number,           // Last traded price
  volume: number,
  // Optional
  vwap: number,
  day_high: number,
  day_low: number,
  day_open: number,
  ts: string,             // ISO timestamp of quote
}
```

### 3.4 OrderParams

```javascript
{
  symbol: string,                                         // Broker-specific symbol
  side: 'buy' | 'sell',
  type: 'market' | 'limit' | 'stop' | 'stop_limit',
  qty: number,                                            // Shares / units
  limit_price?: number,                                   // Required for 'limit', 'stop_limit'
  stop_price?: number,                                    // Required for 'stop', 'stop_limit'
  time_in_force: 'day' | 'gtc' | 'ioc' | 'fok',
}
```

### 3.5 ModifyParams

```javascript
{
  limit_price?: number,
  stop_price?: number,
  qty?: number,
}
```

### 3.6 OrderStatus

```javascript
{
  id: string,
  status: 'new' | 'accepted' | 'partially_filled' | 'filled' | 'cancelled' | 'expired' | 'rejected',
  filled_qty: number,
  filled_avg_price: number | null,   // null if not yet filled
  filled_at: string | null,          // ISO timestamp, null if not filled
  reject_reason: string | null,
}
```

---

## 4. Adapter Implementations

### 4.1 Paper Adapter (`adapters/paper.js`)

The reference implementation. No real broker calls. Simulates fills using Yahoo Finance real-time WebSocket prices.

#### Constructor Options

```javascript
new PaperAdapter(credentials, opts)
```

| Credential field | Default | Description |
|---|---|---|
| `initial_balance` | `100000` | Starting cash |
| `currency` | `'USD'` | Account currency |
| `live_quotes` | `true` | Use Yahoo RT WebSocket; if false, use static prices |

| Option field | Default | Description |
|---|---|---|
| `fill_delay_ms` | `500` | Milliseconds before simulated fill |
| `fill_rate` | `0.95` | Probability a market/limit order fills (0.0–1.0) |
| `slippage_bps` | `5` | Slippage in basis points applied to fill price |

#### State (in-memory, no persistence)

```javascript
this._orders    = new Map();  // orderId → OrderRecord
this._positions = new Map();  // symbol → { qty, avgPrice, currentPrice }
this._wsCache   = new Map();  // symbol → { price, dayHigh, dayLow, dayVolume, ts }
```

#### connect(symbols)

1. Set `this.connected = true`.
2. If `symbols` provided and `live_quotes === true`: initialize Yahoo Finance WebSocket.
   - URL: `wss://streamer.finance.yahoo.com/`
   - Proto: `PricingData.proto` (path: `tools/trading-executor/../../PricingData.proto`)
   - Send subscribe message: `{ subscribe: symbols }` as JSON.
   - On each protobuf message: decode, update `_wsCache[symbol]`.
   - Heartbeat ping every 30s.
   - On disconnect: exponential backoff reconnect (max 5 retries, delays: 1s, 2s, 5s, 10s, 30s).

#### getQuote(symbol)

```javascript
// Priority order:
// 1. _wsCache[symbol] (live WebSocket tick, if <30s old)
// 2. Yahoo Finance REST fallback via allorigins proxy:
//    GET https://api.allorigins.win/get?url=https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1m&range=1d
//    Parse: d.contents → JSON → result.chart.result[0]
// 3. Return mock price 100 if both fail (log WARN)
```

#### placeOrder(params)

```javascript
const id = `PAPER-${this._nextOrderId++}`;
const willFill = Math.random() < this._fillRate;
const slippage = (Math.random() - 0.5) * 2 * this._slippageBps / 10000;

// Store order in _orders Map
// For market/limit: schedule async fill after fill_delay_ms if willFill
// For stop: set status = 'accepted', trigger when price crosses stop_price in _wsCache
// If !willFill: set status = 'expired' after fill_delay_ms * 10

return { id };
```

Fill simulation:
```javascript
_simulateFill(orderId, slippage) {
  const order = this._orders.get(orderId);
  const quote = this._wsCache.get(order.symbol) || { price: order.limit_price || 100 };
  const fillPrice = quote.price * (1 + slippage);

  order.status = 'filled';
  order.filled_qty = order.qty;
  order.filled_avg_price = fillPrice;
  order.filled_at = new Date().toISOString();

  // Update position
  const pos = this._positions.get(order.symbol) || { qty: 0, avgPrice: 0, currentPrice: fillPrice };
  if (order.side === 'buy') {
    pos.avgPrice = (pos.avgPrice * pos.qty + fillPrice * order.qty) / (pos.qty + order.qty);
    pos.qty += order.qty;
  } else {
    pos.qty -= order.qty;
    this.buyingPower += fillPrice * order.qty;
  }
  if (pos.qty <= 0) this._positions.delete(order.symbol);
  else this._positions.set(order.symbol, pos);
}
```

#### getOrderStatus(orderId)

Read from `_orders` Map. Map internal status strings to normalized `OrderStatus.status` values:

| Internal | Normalized |
|---|---|
| `'new'` | `'new'` |
| `'accepted'` | `'accepted'` |
| `'filled'` | `'filled'` |
| `'expired'` | `'expired'` |
| `'cancelled'` | `'cancelled'` |

#### closePosition(symbol)

1. Find position in `_positions`.
2. If not found: return `{ closed: false, reason: 'no_position' }`.
3. Simulate market sell: call `placeOrder({ symbol, side: 'sell', type: 'market', qty: pos.qty, time_in_force: 'ioc' })`.
4. Return `{ closed: true, order_id: orderId }`.

#### getMarketStatus()

```javascript
const now = new Date();
const h = now.getUTCHours();
const d = now.getDay();
if (d === 0 || d === 6) return 'closed';
if (h >= 13 && h < 14) return 'pre_market';   // 09:00–10:00 ET
if (h >= 14 && h < 20) return 'open';          // 10:00–16:00 ET
if (h >= 20 && h < 24) return 'after_hours';
return 'closed';
```

---

### 4.2 Alpaca Adapter (`adapters/alpaca.js`)

#### Credentials & Environment Variables

| Config field | Env var | Description |
|---|---|---|
| `api_key` | `ALPACA_API_KEY` | API key ID |
| `api_secret` | `ALPACA_API_SECRET` | API secret key |
| `paper` | _(boolean flag)_ | Use paper trading endpoint |

#### API Base URLs

```javascript
const LIVE_HOST  = 'api.alpaca.markets';
const PAPER_HOST = 'paper-api.alpaca.markets';
const DATA_HOST  = 'data.alpaca.markets';
// this.baseHost = credentials.paper ? PAPER_HOST : LIVE_HOST
```

#### Authentication

All requests use HTTP headers:
```
APCA-API-KEY-ID:     {api_key}
APCA-API-SECRET-KEY: {api_secret}
Content-Type:        application/json
```

#### connect()

```
GET https://{baseHost}/v2/account
```
Validates credentials. If status code 401 or 403: throw `Error('AUTH_FAILED: Alpaca credentials invalid')`.

#### getAccount()

```
GET https://{baseHost}/v2/account
```
Response fields mapped:
```javascript
{
  balance:       parseFloat(resp.cash),
  buying_power:  parseFloat(resp.buying_power),
  currency:      resp.currency,
  last_equity:   parseFloat(resp.last_equity),
  equity:        parseFloat(resp.equity),
}
```

#### getPositions()

```
GET https://{baseHost}/v2/positions
```
Response is array; map each:
```javascript
{
  symbol:         pos.symbol,
  qty:            parseFloat(pos.qty),
  avg_price:      parseFloat(pos.avg_entry_price),
  current_price:  parseFloat(pos.current_price),
  unrealized_pnl: parseFloat(pos.unrealized_pl),
  side:           pos.side,  // 'long' | 'short'
}
```

#### getQuote(symbol)

```
GET https://data.alpaca.markets/v2/stocks/{symbol}/quotes/latest
Headers: same auth headers
```
Map response:
```javascript
{
  bid:    resp.quote.bp,
  ask:    resp.quote.ap,
  last:   resp.quote.ap,  // Use ask as last price proxy
  volume: 0,              // Not in quote endpoint; use snapshot if needed
}
```

#### getMarketStatus()

```
GET https://{baseHost}/v2/clock
```
Returns `resp.is_open ? 'open' : 'closed'`. No pre-market / after-hours distinction required.

#### placeOrder(params)

```
POST https://{baseHost}/v2/orders
```

Request body:
```javascript
{
  symbol:        params.symbol,
  qty:           String(params.qty),
  side:          params.side,                      // 'buy' | 'sell'
  type:          mapType(params.type),             // see type map below
  time_in_force: mapTif(params.time_in_force),     // see TIF map below
  limit_price:   params.limit_price?.toFixed(2),   // only if type includes limit
  stop_price:    params.stop_price?.toFixed(2),    // only if type includes stop
}
```

Type mapping:
```javascript
{ 'market': 'market', 'limit': 'limit', 'stop': 'stop', 'stop_limit': 'stop_limit' }
```

TIF mapping:
```javascript
{ 'day': 'day', 'gtc': 'gtc', 'ioc': 'ioc', 'fok': 'fok' }
```

Response: `{ id: resp.id }` (UUID string).

**Native OCO support**: Alpaca supports `order_class: 'bracket'` orders. The Engine does NOT use this — it places SL and TP as separate GTC orders after fill for portability across all adapters. Do not use bracket orders in this adapter.

#### modifyOrder(orderId, changes)

```
PATCH https://{baseHost}/v2/orders/{orderId}
```
Body: include only changed fields (`qty`, `limit_price`, `stop_price`).

#### cancelOrder(orderId)

```
DELETE https://{baseHost}/v2/orders/{orderId}
```
Returns `{ id: orderId, cancelled: true }` on 204. On 422 (already filled): return `{ id: orderId, cancelled: false }`.

#### getOrderStatus(orderId)

```
GET https://{baseHost}/v2/orders/{orderId}
```

Status mapping:
```javascript
{
  'new':              'new',
  'partially_filled': 'partially_filled',
  'filled':           'filled',
  'done_for_day':     'cancelled',
  'canceled':         'cancelled',
  'expired':          'expired',
  'replaced':         'cancelled',
  'pending_cancel':   'accepted',
  'pending_replace':  'accepted',
  'accepted':         'accepted',
  'pending_new':      'new',
  'accepted_for_bidding': 'new',
  'stopped':          'filled',
  'rejected':         'rejected',
  'suspended':        'rejected',
  'calculated':       'accepted',
}
```

Return shape:
```javascript
{
  id:               resp.id,
  status:           mappedStatus,
  filled_qty:       parseFloat(resp.filled_qty || 0),
  filled_avg_price: resp.filled_avg_price ? parseFloat(resp.filled_avg_price) : null,
  filled_at:        resp.filled_at || null,
  reject_reason:    resp.status === 'rejected' ? (resp.failed_at || 'rejected') : null,
}
```

#### closePosition(symbol)

```
DELETE https://{baseHost}/v2/positions/{symbol}
```
Returns `{ closed: true, order_id: resp.id }`.

#### Rate Limiting

Alpaca imposes 200 requests/minute. Implement a simple per-request 300ms delay when more than 150 requests have been made in the current 60-second window. No retry loop needed — the Engine's poll interval (5s) is far below the limit.

---

### 4.3 IBKR Adapter (`adapters/ibkr.js`)

Uses the IBKR Client Portal API (REST gateway that must be running locally).

#### Credentials & Environment Variables

| Config field | Env var | Default | Description |
|---|---|---|---|
| `gateway_host` | `IBKR_GATEWAY_HOST` | `'localhost'` | Gateway host |
| `gateway_port` | `IBKR_GATEWAY_PORT` | `5000` | Gateway port |
| `account_id` | `IBKR_ACCOUNT_ID` | _(auto-detected)_ | IBKR account ID |
| `ssl` | _(flag)_ | `true` | Use HTTPS (self-signed cert — skip TLS verification) |

#### API Base

```
https://{gateway_host}:{gateway_port}/v1/api/
```
TLS verification must be disabled (`rejectUnauthorized: false`) because the gateway uses a self-signed certificate.

#### connect()

```
GET /v1/api/iserver/auth/status
```
If `resp.authenticated === false`: throw `Error('IBKR gateway not authenticated. Open browser to https://localhost:5000 and log in first.')`.

If `account_id` not set:
```
GET /v1/api/portfolio/accounts
// Use accounts[0].accountId
```

Keep session alive:
```
POST /v1/api/tickle    // Call every 60s via setInterval to prevent session expiry
```

#### getAccount()

```
GET /v1/api/portfolio/{accountId}/summary
```
Map fields:
```javascript
{
  balance:      resp.totalcashvalue?.amount || 0,
  buying_power: resp.buyingpower?.amount || 0,
  currency:     resp.totalcashvalue?.currency || 'USD',
  last_equity:  resp.netliquidation?.amount || 0,
  equity:       resp.netliquidation?.amount || 0,
}
```

#### getPositions()

```
GET /v1/api/portfolio/{accountId}/positions/0
```
Map each position:
```javascript
{
  symbol:         pos.ticker || pos.contractDesc,
  qty:            pos.position,
  avg_price:      pos.avgCost,
  current_price:  pos.mktPrice,
  unrealized_pnl: pos.unrealizedPnl,
  side:           pos.position > 0 ? 'long' : 'short',
}
```

#### getQuote(symbol)

1. Resolve `conid` (contract ID) for symbol:
   ```
   GET /v1/api/iserver/secdef/search?symbol={symbol}
   // Cache result in _conidCache Map (symbol → conid string)
   ```
2. Subscribe to market data:
   ```
   GET /v1/api/iserver/marketdata/snapshot?conids={conid}&fields=31,84,86
   // field 31 = last price, 84 = bid, 86 = ask
   ```
3. Map to Quote:
   ```javascript
   { bid: parseFloat(resp[0]['84']), ask: parseFloat(resp[0]['86']), last: parseFloat(resp[0]['31']), volume: 0 }
   ```

#### getMarketStatus()

```
GET /v1/api/iserver/marketdata/snapshot?conids={conid}&fields=6509
// field 6509 = trading status
```
Map: `'TradingStatus=Open'` → `'open'`, else → `'closed'`.

Fallback (if snapshot unavailable): check UTC time (weekday 13:30–20:00 UTC → `'open'`).

#### placeOrder(params)

1. Resolve `conid` for `params.symbol` (same cache as getQuote).
2. Build order body:
   ```javascript
   {
     acctId:   this.accountId,
     conid:    parseInt(conid),
     secType:  `${conid}:STK`,
     orderType: mapType(params.type),   // see type map below
     side:     params.side === 'buy' ? 'BUY' : 'SELL',
     quantity:  params.qty,
     tif:      mapTif(params.time_in_force),
     price:    params.limit_price,     // lmtPrice for LIMIT / STOP_LIMIT
     auxPrice: params.stop_price,      // auxPrice for STOP / STOP_LIMIT
   }
   ```

   Type mapping:
   ```javascript
   { 'market': 'MKT', 'limit': 'LMT', 'stop': 'STP', 'stop_limit': 'STP LMT' }
   ```

   TIF mapping:
   ```javascript
   { 'day': 'DAY', 'gtc': 'GTC', 'ioc': 'IOC', 'fok': 'FOK' }
   ```

3. Submit:
   ```
   POST /v1/api/iserver/account/{accountId}/orders
   Body: { orders: [orderBody] }
   ```

4. **Confirmation handling**: IBKR often returns a reply object requiring confirmation before the order is placed:
   ```javascript
   // If reply[0].id exists but no reply[0].order_id → confirmation required
   POST /v1/api/iserver/reply/{reply[0].id}
   Body: { confirmed: true }
   // confirmed[0].order_id = the actual order ID
   ```
   Always check for confirmation; retry once if present.

5. Return `{ id: String(orderId) }`.

#### modifyOrder(orderId, changes)

```
POST /v1/api/iserver/account/{accountId}/order/{orderId}
Body: { price?: changes.limit_price, auxPrice?: changes.stop_price, quantity?: changes.qty }
```
If reply requires confirmation: confirm same way as placeOrder.

#### cancelOrder(orderId)

```
DELETE /v1/api/iserver/account/{accountId}/order/{orderId}
```

#### getOrderStatus(orderId)

```
GET /v1/api/iserver/account/orders
```
Find order by `orderId` in `resp.orders` array. Status mapping:

```javascript
{
  'Submitted':       'accepted',
  'Filled':          'filled',
  'Cancelled':       'cancelled',
  'Inactive':        'rejected',
  'PendingSubmit':   'new',
  'PreSubmitted':    'accepted',
  'ApiCancelled':    'cancelled',
}
```

Return shape:
```javascript
{
  id:               String(o.orderId),
  status:           mappedStatus,
  filled_qty:       o.filledQuantity || 0,
  filled_avg_price: o.avgPrice || null,
  filled_at:        o.lastExecutionTime_r ? new Date(o.lastExecutionTime_r * 1000).toISOString() : null,
  reject_reason:    mappedStatus === 'rejected' ? (o.status || 'rejected') : null,
}
```

#### closePosition(symbol)

```
DELETE /v1/api/iserver/account/{accountId}/position/{conid}
```
Resolves `conid` from cache. Returns `{ closed: true }`.

---

### 4.4 Saxo Adapter (`adapters/saxo.js`)

#### Credentials & Environment Variables

| Config field | Env var | Description |
|---|---|---|
| `access_token` | `SAXO_ACCESS_TOKEN` | OAuth2 Bearer token (manage refresh externally) |
| `account_key` | `SAXO_ACCOUNT_KEY` | Saxo account key (auto-detected on connect if missing) |
| `client_key` | `SAXO_CLIENT_KEY` | Saxo client key (auto-detected) |
| `simulation` | _(boolean flag)_ | Use simulation environment |

#### API Base URLs

```javascript
const BASE_PATH = credentials.simulation ? '/sim/openapi' : '/openapi';
// Both live and sim use: gateway.saxobank.com
// Full base: https://gateway.saxobank.com{basePath}
```

#### Authentication

All requests use header:
```
Authorization: Bearer {access_token}
Content-Type:  application/json
```

Token refresh is the caller's responsibility. If the adapter receives a 401 response, it throws `Error('SAXO_AUTH_EXPIRED: refresh SAXO_ACCESS_TOKEN')` — no automatic refresh.

#### connect()

```
GET /port/v1/accounts/me
```
Auto-populate `accountKey` and `clientKey` from `resp.Data[0]` if not provided in credentials.

#### getAccount()

```
GET /port/v1/accounts/{accountKey}
```
Map response:
```javascript
{
  balance:      resp.Balance?.CashBalance || 0,
  buying_power: resp.Balance?.MarginAvailableForTrading || resp.Balance?.CashBalance || 0,
  currency:     resp.Currency || 'USD',
  last_equity:  resp.Balance?.TotalValue || 0,
  equity:       resp.Balance?.TotalValue || 0,
}
```

#### getPositions()

```
GET /port/v1/positions?AccountKey={accountKey}&ClientKey={clientKey}
```
Map each from `resp.Data`:
```javascript
{
  symbol:         pos.DisplayAndFormat?.Symbol || pos.Uic,
  qty:            pos.NetPositionBase?.Amount || 0,
  avg_price:      pos.NetPositionBase?.AverageOpenPrice || 0,
  current_price:  pos.NetPositionView?.CurrentPrice || 0,
  unrealized_pnl: pos.NetPositionView?.ProfitLossOnTrade || 0,
  side:           (pos.NetPositionBase?.Amount || 0) > 0 ? 'long' : 'short',
}
```

#### Instrument UIC Resolution

Saxo uses UIC (Unique Instrument Code, integer) instead of ticker symbols for order placement.

**Resolution process** (cache results in `_uicCache` Map):
```
GET /ref/v1/instruments?Keywords={symbol}&AssetTypes=Stock,ETF&$top=1
// resp.Data[0].Identifier = UIC (integer)
```

Cache key: `symbol` → `uic`. Check cache before every API call that requires UIC.

If UIC cannot be resolved: throw `Error('SYMBOL_NOT_FOUND: {symbol} not in Saxo instrument universe')`.

#### getQuote(symbol)

1. Resolve UIC.
2. Subscribe to quote:
   ```
   GET /trade/v1/infoprices/snapshot?AssetType=Stock&Uic={uic}&AccountKey={accountKey}
   ```
3. Map response:
   ```javascript
   {
     bid:  resp.Quote?.Bid || 0,
     ask:  resp.Quote?.Ask || 0,
     last: resp.Quote?.LastTraded || resp.Quote?.Mid || 0,
     volume: 0,
   }
   ```

#### placeOrder(params)

1. Resolve UIC for `params.symbol`.
2. Map order type:
   ```javascript
   { 'market': 'Market', 'limit': 'Limit', 'stop': 'StopIfTraded', 'stop_limit': 'StopLimit' }
   ```
3. Map TIF:
   ```javascript
   { 'day': 'DayOrder', 'gtc': 'GoodTillCancel', 'ioc': 'ImmediateOrCancel', 'fok': 'FillOrKill' }
   ```
4. Build body:
   ```javascript
   {
     AccountKey:    this.accountKey,
     BuySell:       params.side === 'buy' ? 'Buy' : 'Sell',
     AssetType:     'Stock',
     Uic:           uic,
     Amount:        params.qty,
     OrderType:     mappedType,
     OrderDuration: { DurationType: mappedTif },
     ManualOrder:   false,
   }
   // Add Price for Limit / StopLimit:
   if (params.limit_price) body.Price = params.limit_price;
   // Add StopPrice for StopIfTraded / StopLimit:
   if (params.stop_price) body.StopPrice = params.stop_price;
   ```
5. POST:
   ```
   POST /trade/v2/orders
   ```
6. Return `{ id: resp.OrderId }`.

#### modifyOrder(orderId, changes)

1. Fetch existing order to get required fields (AssetType, Uic, BuySell):
   ```
   GET /port/v1/orders/{clientKey}/{orderId}
   ```
2. Build PATCH body with existing + changed values.
3. ```
   PATCH /trade/v2/orders
   ```

#### cancelOrder(orderId)

```
DELETE /trade/v2/orders/{clientKey}/{orderId}
```

#### getOrderStatus(orderId)

```
GET /port/v1/orders?AccountKey={accountKey}&ClientKey={clientKey}
```
Find order by `OrderId`. Status mapping:
```javascript
{
  'Working':              'accepted',
  'Filled':               'filled',
  'Cancelled':            'cancelled',
  'Rejected':             'rejected',
  'Parked':               'new',
  'LockedPlacementPending': 'new',
}
```

#### closePosition(symbol)

1. Call `getPositions()`, find matching symbol.
2. If not found: return `{ closed: false, reason: 'no_position' }`.
3. Place market sell for `pos.qty`.

---

### 4.5 Trading 212 Adapter (`adapters/trading212.js`)

#### Credentials & Environment Variables

| Config field | Env var | Description |
|---|---|---|
| `api_key` | `T212_API_KEY` | From Trading 212 app Settings > API |
| `demo` | _(boolean flag)_ | Use demo account |

#### API Base URLs

```javascript
const LIVE_HOST = 'live.trading212.com';
const DEMO_HOST = 'demo.trading212.com';
// this.baseHost = credentials.demo ? DEMO_HOST : LIVE_HOST
```

#### Authentication

All requests use header:
```
Authorization: {api_key}     // Note: no "Bearer" prefix
Content-Type:  application/json
```

#### connect()

```
GET /api/v0/equity/account/info
```
Store `resp.currencyCode`.

#### getAccount()

```
GET /api/v0/equity/account/cash
```
Map:
```javascript
{
  balance:      resp.free,
  buying_power: resp.free,
  currency:     this.currencyCode || 'EUR',
  last_equity:  resp.total,
  equity:       resp.total,
  invested:     resp.invested,
  pnl:          resp.ppl,
}
```

#### getPositions()

```
GET /api/v0/equity/portfolio
```
Map each:
```javascript
{
  symbol:         p.ticker,
  qty:            p.quantity,
  avg_price:      p.averagePrice,
  current_price:  p.currentPrice,
  unrealized_pnl: p.ppl,
  side:           'long',    // T212 equity is long-only
}
```

#### getQuote(symbol)

T212 has no quote endpoint. Fetch from Yahoo Finance via CORS proxy:
```javascript
const url = `https://api.allorigins.win/get?url=${encodeURIComponent(
  `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`
)}`;
fetch(url).then(r => r.json()).then(d => {
  const yahoo = JSON.parse(d.contents);
  const meta = yahoo.chart.result[0].meta;
  return {
    bid:  meta.regularMarketPrice * 0.9995,
    ask:  meta.regularMarketPrice * 1.0005,
    last: meta.regularMarketPrice,
    volume: meta.regularMarketVolume,
  };
});
```

#### getMarketStatus()

No T212 endpoint. Infer from UTC time:
```javascript
const h = now.getUTCHours();
const d = now.getDay();
if (d === 0 || d === 6) return 'closed';
if (h >= 14 && h < 21) return 'open';    // US hours (09:30–17:00 ET)
if (h >= 8  && h < 14) return 'open';    // EU hours (09:00–14:00 UTC)
return 'closed';
```

#### placeOrder(params)

**IMPORTANT**: T212 buy and sell are handled differently:
- **Buy**: use order endpoints.
- **Sell**: use position close endpoints (T212 is long-only for equities).

For buy orders:
```
POST /api/v0/equity/orders/market   // type='market'
POST /api/v0/equity/orders/limit    // type='limit'
POST /api/v0/equity/orders/stop     // type='stop'
POST /api/v0/equity/orders/stop_limit // type='stop_limit'
```

Request body:
```javascript
// Market:
{ ticker: params.symbol, quantity: params.qty }

// Limit:
{ ticker: params.symbol, quantity: params.qty, limitPrice: params.limit_price, timeValidity: mapTif(params.time_in_force) }

// Stop:
{ ticker: params.symbol, quantity: params.qty, stopPrice: params.stop_price, timeValidity: mapTif(params.time_in_force) }

// Stop-Limit:
{ ticker: params.symbol, quantity: params.qty, stopPrice: params.stop_price, limitPrice: params.limit_price, timeValidity: mapTif(params.time_in_force) }
```

TIF mapping:
```javascript
{ 'day': 'DAY', 'gtc': 'GOOD_TILL_CANCEL', 'ioc': 'IMMEDIATE_OR_CANCEL' }
```

For sell orders (`params.side === 'sell'`): call `_closePart(symbol, qty, params)`.

**_closePart** (partial position close):
```
POST /api/v0/equity/orders/limit_sell  (if limit_price provided)
// OR
DELETE /api/v0/equity/portfolio/{symbol}  (full close — market)
```
T212 does not support partial close via a single API call for all order types. Use the limit sell endpoint for GTC sell orders (TP1/TP2) and portfolio DELETE for SL market orders.

Return: `{ id: String(resp.id) }`.

#### modifyOrder(orderId, changes)

```
PATCH /api/v0/equity/orders/{orderId}
Body: { limitPrice?, stopPrice?, quantity? }  // Only send changed fields
```

#### cancelOrder(orderId)

```
DELETE /api/v0/equity/orders/{orderId}
```

#### getOrderStatus(orderId)

```
GET /api/v0/equity/orders/{orderId}
```
Status mapping:
```javascript
{
  'NEW':                    'new',
  'CONFIRMED':              'accepted',
  'PARTIALLY_FILLED':       'partially_filled',
  'FILLED':                 'filled',
  'CANCELLED':              'cancelled',
  'REJECTED':               'rejected',
  'CANCELLATION_PENDING':   'accepted',
}
```

Return shape: standard `OrderStatus` normalized form.

#### closePosition(symbol)

```
DELETE /api/v0/equity/portfolio/{symbol}
```
Returns `{ closed: true }`.

---

### 4.6 Binance Adapter (`adapters/binance.js`)

Used exclusively for `tkl` mode. Supports 24/7 crypto spot trading only.

#### Credentials & Environment Variables

| Config field | Env var | Description |
|---|---|---|
| `api_key` | `BINANCE_API_KEY` | Binance API key |
| `api_secret` | `BINANCE_API_SECRET` | Binance API secret |
| `testnet` | _(boolean flag)_ | Use testnet |

#### API Base URLs

```javascript
const LIVE_HOST    = 'api.binance.com';
const TESTNET_HOST = 'testnet.binance.vision';
// this.baseHost = credentials.testnet ? TESTNET_HOST : LIVE_HOST
```

#### Authentication

**Signed requests** (all order + account endpoints):
```javascript
// 1. Build query string with params + timestamp + recvWindow
params.timestamp = Date.now();
params.recvWindow = 5000;  // ms tolerance window
const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

// 2. HMAC-SHA256 sign the full query string
const signature = crypto.createHmac('sha256', this.apiSecret).update(qs).digest('hex');
const fullPath = `${path}?${qs}&signature=${signature}`;

// 3. HTTP header
'X-MBX-APIKEY': this.apiKey
```

**Public requests** (getQuote): no signature required, no API key header.

#### connect()

```
GET /api/v3/account    (signed)
```
Validate credentials. Cache `this._exchangeInfo` from:
```
GET /api/v3/exchangeInfo
```
Used for lot size / price filter validation.

#### getAccount()

```
GET /api/v3/account    (signed)
```
Find USDT balance in `resp.balances`:
```javascript
const usdt = resp.balances.find(b => b.asset === 'USDT');
return {
  balance:      parseFloat(usdt?.free || 0),
  buying_power: parseFloat(usdt?.free || 0),
  currency:     'USDT',
  last_equity:  parseFloat(usdt?.free || 0) + parseFloat(usdt?.locked || 0),
  equity:       parseFloat(usdt?.free || 0) + parseFloat(usdt?.locked || 0),
};
```

#### Symbol Format

Binance uses concatenated pair symbols without separators: `BTCUSDT`, `ETHUSDT`, `SOLUSDT`.

Internal ticker → Binance symbol mapping:
- If ticker contains `-`: remove `-` and uppercase: `BTC-USD` → `BTCUSD` → not valid → use `BTCUSDT`.
- Convention: always append `USDT` if no quote asset specified: `BTC` → `BTCUSDT`.
- Adapter stores mapping in `_symbolMap` or uses `broker_symbol` from plan directly.

#### getQuote(symbol)

```
GET /api/v3/ticker/bookTicker?symbol={symbol}   (public, no signature)
```
Map:
```javascript
{ bid: parseFloat(resp.bidPrice), ask: parseFloat(resp.askPrice), last: parseFloat(resp.askPrice), volume: 0 }
```

#### getMarketStatus()

Always `'open'` — Binance crypto is 24/7.

#### placeOrder(params)

All orders via:
```
POST /api/v3/order    (signed)
```

Base body:
```javascript
{
  symbol:   params.symbol,                   // e.g. "BTCUSDT"
  side:     params.side.toUpperCase(),       // 'BUY' | 'SELL'
  quantity: _formatQty(params.symbol, params.qty),
}
```

Type-specific additions:
```javascript
// market:
body.type = 'MARKET';

// limit:
body.type = 'LIMIT';
body.price = _formatPrice(params.symbol, params.limit_price);
body.timeInForce = mapTif(params.time_in_force);

// stop (stop-loss market):
body.type = 'STOP_LOSS_LIMIT';
body.stopPrice = _formatPrice(params.symbol, params.stop_price);
body.price = _formatPrice(params.symbol, params.stop_price * 0.995);  // Limit 0.5% below stop
body.timeInForce = 'GTC';

// stop_limit:
body.type = 'STOP_LOSS_LIMIT';
body.stopPrice = _formatPrice(params.symbol, params.stop_price);
body.price = _formatPrice(params.symbol, params.limit_price);
body.timeInForce = mapTif(params.time_in_force);
```

TIF mapping:
```javascript
{ 'day': 'GTC', 'gtc': 'GTC', 'ioc': 'IOC', 'fok': 'FOK' }
// Note: Binance has no DAY orders — map 'day' to 'GTC'
```

Price formatting: `String(Math.round(price * 100) / 100)` (2 decimal places).  
Qty formatting: `String(Math.floor(qty * 100000) / 100000)` (5 decimal places).

Return: `{ id: String(resp.orderId), client_order_id: resp.clientOrderId }`.

#### modifyOrder(orderId, changes)

Binance does not support order modification. Implementation:
1. Find open order via `GET /api/v3/openOrders` (signed, all open orders).
2. Cancel original order: `DELETE /api/v3/order` (signed, with `orderId`).
3. Re-place with modified params.
4. Return `{ id: String(newOrderId), modified: true }`.

#### cancelOrder(orderId)

```
DELETE /api/v3/order    (signed)
Params: symbol (required), orderId
```

**Important**: Binance requires `symbol` to cancel an order. The adapter must track `orderId → symbol` mapping in a `_orderSymbolMap` Map during `placeOrder`.

Return: `{ id: String(orderId), cancelled: true }`.

#### getOrderStatus(orderId)

```
GET /api/v3/order    (signed)
Params: symbol (from _orderSymbolMap), orderId
```

Status mapping:
```javascript
{
  'NEW':                'new',
  'PARTIALLY_FILLED':   'partially_filled',
  'FILLED':             'filled',
  'CANCELED':           'cancelled',
  'REJECTED':           'rejected',
  'EXPIRED':            'expired',
  'EXPIRED_IN_MATCH':   'expired',
}
```

Return standard `OrderStatus` normalized shape.

#### closePosition(symbol)

1. Get USDT-equivalent balance for the base asset:
   ```
   GET /api/v3/account    (signed)
   // Find balance for base asset (e.g. "BTC" from "BTCUSDT")
   ```
2. Sell entire free balance at market:
   ```javascript
   placeOrder({ symbol, side: 'sell', type: 'market', qty: +balance.free, time_in_force: 'ioc' })
   ```

#### Binance Error Codes

| HTTP Status | Binance Code | Meaning | Engine Error Type |
|---|---|---|---|
| 401 | any | Invalid API key | `AUTH_FAILED` (throw, do not retry) |
| 400 | -2010 | Insufficient balance | `INSUFFICIENT_MARGIN` |
| 400 | -1121 | Invalid symbol | `SYMBOL_NOT_FOUND` |
| 429 | any | Rate limit hit | `RATE_LIMITED` |
| 418 | any | IP banned | throw immediately |
| 400 | -2011 | Unknown order | `ORDER_REJECTED` |

---

## 5. Error Handling Conventions

All adapters follow these conventions:

1. **HTTP 4xx**: Parse response JSON, extract broker-specific error code/message, throw `Error` with normalized `errorType` prefix:
   ```javascript
   const err = new Error(`{BROKER} {METHOD} {path}: {status} {message}`);
   err.statusCode = res.statusCode;
   err.brokerCode = parsed.code || parsed.error_code;
   err.code = mapToEngineErrorType(res.statusCode, parsed.code);
   throw err;
   ```

2. **HTTP 5xx**: Throw with `CONNECTION_LOST` code — triggers Engine reconnect logic.

3. **Network error** (ECONNREFUSED, ETIMEDOUT): Throw with `CONNECTION_LOST` code.

4. **Auth failure** (401, 403): Throw immediately with `AUTH_FAILED` code. Do not retry.

5. **All throws**: Include `err.code` string matching an `error_handlers` key from the plan (see PRD-06 §8).

---

## 6. Notifier

The Notifier attaches to an Engine instance and forwards FILL, TRADE, and ERROR log events to Telegram and/or Discord.

### 6.1 Constructor

```javascript
new Notifier(engine, opts = {})
```

| Option | Env var | Description |
|---|---|---|
| `telegram_token` | `TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `telegram_chat` | `TELEGRAM_CHAT_ID` | Telegram chat ID |
| _(mode-specific topic)_ | `TELEGRAM_TOPIC_{MODE}` | Per-mode thread ID |
| `discord_webhook` | `DISCORD_WEBHOOK_URL` | Discord webhook URL |
| `quiet` | — | Suppress all notifications (default: false) |

**Mode → topic env var mapping**:
```javascript
{
  turbo:    'TELEGRAM_TOPIC_TURBO',
  dynamic:  'TELEGRAM_TOPIC_DYNAMIC',
  balanced: 'TELEGRAM_TOPIC_BALANCED',
  secured:  'TELEGRAM_TOPIC_SECURED',
  fortress: 'TELEGRAM_TOPIC_FORTRESS',
  tkl:      'TELEGRAM_TOPIC_TKL',
}
```

### 6.2 Attachment Pattern

Notifier monkey-patches `engine._log` to intercept events:
```javascript
const origLog = engine._log.bind(engine);
engine._log = (level, msg, data) => {
  origLog(level, msg, data);
  if (level === 'FILL')  this._onFill(msg, data);
  if (level === 'TRADE') this._onTrade(msg, data);
  if (level === 'ERROR') this._onError(msg, data);
  if (level === 'PHASE') this._onPhase(msg, data);
};
```

### 6.3 Notification Events

**FILL event** (`level === 'FILL'`):
```
Message format (Telegram MarkdownV2):
*[PAPER] FILLED* ✅
`{ticker}` @ {price} × {qty}
Mode: {mode} | Broker: {broker}
```
Paper mode prefix: `[PAPER]`. Live mode: no prefix.

**TRADE event** (`level === 'TRADE'`):
```
*EXIT* 💰 | *BREAKEVEN* 🔄 | etc.
`{ticker}` — {msg}
```

**ERROR event** (`level === 'ERROR'`):
```
*ERROR* ❌
{msg}
```
Only send ERROR notifications for types in: `CONNECTION_LOST`, `CIRCUIT_BREAKER`, `MARKET_HALTED`.

**PHASE event** (`level === 'PHASE'`):
Only notify on `DONE` phase with session summary.

### 6.4 Telegram Send

```
POST https://api.telegram.org/bot{token}/sendMessage
Body: {
  chat_id:              {telegramChat},
  text:                 {message},
  parse_mode:           'MarkdownV2',
  message_thread_id:    {telegramTopic},    // omit if null
  disable_notification: false,
}
```
Fire-and-forget (do not await or retry on failure — notifications must never block execution).

### 6.5 Discord Send

```
POST {discordWebhook}
Body: { content: {message} }    // Plain text, no special formatting
```
Fire-and-forget.

### 6.6 Graceful Degradation

- If `TELEGRAM_BOT_TOKEN` and `DISCORD_WEBHOOK_URL` are both unset: `this.enabled = false`, no notifications sent, no error thrown.
- If send fails (network error, 4xx/5xx): log to stderr only (`console.error`). Never throw.

> **Unified Engine note**: In the unified engine (PRD-23), there is ONE set of Node.js broker adapters shared by all signal sources. The Go engine does NOT use its own broker adapters in SaaS mode — it delegates to this adapter layer via the Node.js orchestrator. Each adapter receives orders tagged with `strategySlotId` (PRD-23 §3.3) for position attribution.

<!-- Consistency pass: aligned with PRD-23 Unified Strategy Engine, 2026-05-07 -->
