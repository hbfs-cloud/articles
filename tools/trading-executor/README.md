# Trading Executor

Automated trading execution engine — generates plans from scanner signals and executes them across multiple brokers with real-time market data.

## DTX V2 Contract Boundary

`tools/trading-executor/` is the legacy scanner-plan executor. It is not a
complete `DtxDecide` Contract V2 broker-mcp client.

The authoritative V2 broker contract is
[`DTX_DECIDE_V2_CONTRACT.md`](DTX_DECIDE_V2_CONTRACT.md). Any V2 implementation
must execute `execution_plan.groups`, validate the whole V2 contract, preserve
DTX state, enforce group promotion rules, maintain idempotence, and refuse all
orders when freshness, protections, or contract validation cannot be guaranteed.

The legacy `Engine` fails closed when handed a V2 response (`contract_version:
"2.0"` or `execution_plan` present) so a DTX V2 plan cannot be silently executed
through the old scanner DSL.

## Architecture

```
tools/trading-executor/
├── daemon.js              # Long-running service (1 instance per mode)
├── engine.js              # State machine: INIT → PRE_MARKET → OPEN → MONITOR → CLOSE → DONE
├── index.js               # Single-plan executor (CLI)
├── run-session.js         # Batch runner (all mode/broker pairs from config.json)
├── notifier.js            # Telegram + Discord notifications (hooks into engine events)
├── config.example.json    # Template — credentials via env vars
│
├── adapters/              # Broker adapters (uniform interface)
│   ├── paper.js           # Paper trading (simulated fills, RT market data)
│   ├── alpaca.js          # Alpaca Markets REST v2
│   ├── ibkr.js            # Interactive Brokers Client Portal Gateway
│   ├── saxo.js            # Saxo Bank OpenAPI (OAuth2)
│   ├── trading212.js      # Trading 212 Equity API
│   └── binance.js         # Binance Spot v3 (HMAC signed)
│
├── market-data/           # Universal market data engine
│   ├── engine.js          # Main engine: subscribe, fetch, aggregate
│   ├── types.js           # Tick/Bar classes, validation, staleness
│   ├── test-sources.js    # Source diagnostic script
│   └── sources/
│       ├── yahoo-ws.js    # Yahoo WebSocket (tick streaming, primary)
│       ├── webull.js      # Webull REST (RT snapshots, no auth)
│       ├── t212.js        # T212 Charting API (multi-TF bars)
│       └── yahoo-rest.js  # Yahoo REST (historical OHLCV)
│
├── Dockerfile             # node:22-alpine, deploys as daemon
└── nomad.hcl              # 6 instances (one per mode) via NOMAD_ALLOC_INDEX
```

## Modes

6 portfolio modes with different horizons and risk profiles:

| Mode | Horizon | Style |
|------|---------|-------|
| turbo | 2 days | Aggressive momentum |
| dynamic | 5 days | Adaptive swing |
| balanced | 5 days | Moderate risk/reward |
| secured | 5 days | Conservative, tight stops |
| fortress | 14 days | Long swing, wide stops |
| tkl | 21 days | Position trading |

## Quick Start

### Single plan execution
```bash
# Generate a trading plan for balanced mode
node tools/gen-trading-plan.js --mode balanced --broker paper --output /tmp/plan.json

# Execute it
MODE=balanced BROKER=paper node tools/trading-executor/index.js /tmp/plan.json
```

### Daemon mode (production)
```bash
# Runs forever: generates plan at market open, executes, sleeps until next session
MODE=balanced BROKER=paper CAPITAL_USD=10000 node tools/trading-executor/daemon.js
```

### Batch mode (all configured pairs)
```bash
node tools/trading-executor/run-session.js
```

## Market Data Engine

Source-agnostic, hardened market data with automatic failover.

### Sources (priority order)
1. **Yahoo WebSocket** — tick-by-tick streaming (primary for live prices)
2. **Webull REST** — real-time snapshot quotes (no auth, fallback)
3. **T212 Charting** — multi-timeframe OHLCV bars (when accessible)
4. **Yahoo REST** — historical bars (1m to weekly)

### Usage
```javascript
const { MarketDataEngine } = require('./market-data/engine');

const md = new MarketDataEngine({ verbose: true });
await md.start(['AAPL', 'MSFT', 'TSLA']);

// Get latest validated price (null if stale)
const price = md.getPrice('AAPL');

// Get full quote (Tick object with bid/ask/volume/validation)
const quote = md.getQuote('AAPL');

// Subscribe to 1-minute bars (built from streaming ticks)
const unsub = md.subscribe('1m', (bar) => {
  console.log(`${bar.symbol} ${bar.timeframe} O:${bar.open} H:${bar.high} L:${bar.low} C:${bar.close} V:${bar.volume}`);
});

// Subscribe to raw ticks
md.subscribe('tick', (tick) => { /* ... */ });

// Fetch historical bars (T212 → Yahoo REST fallback)
const dailyBars = await md.fetch('AAPL', '1d', 50);
const m15Bars = await md.fetch('AAPL', '15m', 100);

// Force-refresh a quote (polls Webull → T212 → returns cached)
const fresh = await md.refreshQuote('AAPL');

// Stats
console.log(md.stats);
// { ticksReceived, ticksRejected, barsEmitted, fetchCount, symbols, sources: { yahoo-ws: 'streaming', ... } }

await md.stop();
```

### Supported timeframes
`tick`, `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `1d`, `1w`

### Data hardening
- **Staleness rejection**: each timeframe has a max age (tick: 10s, 1m: 90s, 1d: 25h). `getQuote()` returns null for stale data.
- **Sanity validation**: price range (0.0001–999999), OHLC consistency (H≥L, O/C within H/L), spread width (<10%), single-tick jump cap (<50%).
- **Circuit breaker**: 5 consecutive failures → source disabled for 60s cooldown.
- **Graceful degradation**: if all sources fail, engine emits events but never returns bad data.

## Broker Adapter Interface

All adapters implement this interface:

```javascript
class Adapter {
  async connect(symbols?)       // Connect to broker, optionally subscribe to symbols
  async disconnect()            // Clean shutdown
  async getAccount()            // → { balance, buying_power, currency, equity, last_equity }
  async getPositions()          // → [{ symbol, qty, avg_price, unrealized_pnl, side }]
  async getMarketStatus()       // → 'open' | 'pre_market' | 'after_hours' | 'closed'
  async getQuote(symbol)        // → { last, bid, ask, halted, volume, dayHigh?, dayLow? }
  async placeOrder(params)      // → { id }
  async modifyOrder(id, changes)// → { id, modified }
  async cancelOrder(id)         // → { id, cancelled }
  async getOrderStatus(id)      // → { id, status, filled_avg_price, filled_qty, ... }
  async closePosition(symbol)   // → { closed, order_id? }
}
```

### Order params
```javascript
{
  symbol: 'AAPL',
  side: 'buy' | 'sell',
  type: 'market' | 'limit' | 'stop' | 'stop_limit',
  qty: 10,
  limit_price: 150.00,     // for limit/stop_limit
  stop_price: 145.00,      // for stop/stop_limit
  time_in_force: 'day' | 'gtc'
}
```

## Engine State Machine

```
INIT → PRE_MARKET → OPEN_SESSION → MONITOR → CLOSE_SESSION → DONE
         │                            │
         └── (plan generation)        └── (position mgmt: trail stops, check TP/SL, time exits)
```

The engine:
1. Connects adapter + market data
2. Waits for market open (or pre-market entry signals)
3. Executes plan entries (VWAP gate, limit orders)
4. Monitors positions (trailing stops, take-profit, stop-loss)
5. Time-based exits at horizon expiry
6. Closes session, reports P&L

## Notifications

Engine emits events → Notifier sends to Telegram/Discord:
- `session_start` — plan summary
- `order_placed` — entry/exit order details
- `order_filled` — fill price, slippage
- `position_closed` — P&L, hold duration
- `session_end` — summary stats

Paper mode prefixes all messages with `[PAPER]`.

### Env vars for notifications
```
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
TELEGRAM_TOPIC_TURBO=89
TELEGRAM_TOPIC_DYNAMIC=89
TELEGRAM_TOPIC_BALANCED=90
TELEGRAM_TOPIC_SECURED=91
TELEGRAM_TOPIC_FORTRESS=91
TELEGRAM_TOPIC_TKL=1064
DISCORD_WEBHOOK_URL=...
```

## Configuration

Copy `config.example.json` to `config.json`. Credentials come from env vars (never stored in config):

```bash
# Alpaca
ALPACA_API_KEY=...
ALPACA_API_SECRET=...
ALPACA_PAPER=true

# IBKR
IBKR_GATEWAY_HOST=localhost
IBKR_GATEWAY_PORT=5000
IBKR_ACCOUNT_ID=...

# Saxo
SAXO_ACCESS_TOKEN=...
SAXO_ACCOUNT_KEY=...

# Trading 212
T212_API_KEY=...
T212_DEMO=true

# Binance
BINANCE_API_KEY=...
BINANCE_API_SECRET=...
BINANCE_TESTNET=true
```

## Deployment (Nomad)

```bash
# Deploy 6 daemon instances (one per mode)
nomad job run tools/trading-executor/nomad.hcl

# Override broker/capital
nomad job run -var broker=alpaca -var capital_usd=50000 tools/trading-executor/nomad.hcl
```

Each instance gets its MODE via `NOMAD_ALLOC_INDEX` → `["turbo","dynamic","balanced","secured","fortress","tkl"][idx]`.

## Trading Plan DSL

Plans are JSON files generated by `gen-trading-plan.js`:

```json
{
  "meta": { "mode": "balanced", "broker": "paper", "date": "20260505", "generated_at": "..." },
  "account": { "nominal_usd": 10000 },
  "entries": [
    {
      "symbol": "AAPL",
      "side": "buy",
      "qty": 5,
      "type": "limit",
      "limit_price": 275.50,
      "stop_loss": 268.00,
      "take_profit_1": 285.00,
      "take_profit_2": 292.00,
      "vwap_gate": true,
      "horizon_days": 5,
      "score": 92,
      "strategy": "Breakout"
    }
  ]
}
```

## Testing

```bash
# Test all market data sources
node tools/trading-executor/market-data/test-sources.js

# Dry-run plan generation
node tools/gen-trading-plan.js --mode balanced --broker paper --dry-run

# Paper trade single plan
MODE=balanced BROKER=paper VERBOSE=true node tools/trading-executor/index.js plan.json
```
