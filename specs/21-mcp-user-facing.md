# PRD-21: MCP Server — User-Facing

## Overview

User-facing MCP server allowing end users to connect their LLM (Claude, ChatGPT, etc.) to
query portfolio state, signals, trade history, and risk metrics via the MCP protocol.
Each tool call is scoped strictly to the authenticated user's data.

**Server endpoint**: `http://autotrader.dailytickers.com/mcp/user/`
**Protocol**: JSON-RPC 2.0 over HTTPS POST
**Auth**: User API key as Bearer token (issued via PRD-14 user management)
**Scope**: End-user data only — no cross-user access, no admin operations

---

## 1. Server Configuration

```
Endpoint:     http://autotrader.dailytickers.com/mcp/user/
Protocol:     JSON-RPC 2.0
Auth header:  Authorization: Bearer <USER_API_KEY>
Content-Type: application/json
Accept:       application/json
```

**Environment variables** (server-side):

| Variable | Required | Description |
|---|---|---|
| `USER_MCP_DB_URL` | Yes | PostgreSQL connection string for user/portfolio data |
| `USER_MCP_REDIS_URL` | Yes | Redis for caching and rate limiting |
| `POSITIONS_CACHE_TTL_SECONDS` | No | Live position cache TTL (default: 30) |
| `SIGNALS_CACHE_TTL_SECONDS` | No | Today's signals cache TTL (default: 300) |
| `TRADES_CACHE_TTL_SECONDS` | No | Trade history cache TTL (default: 3600) |
| `EXPLAIN_TRADE_LLM_MODEL` | No | Model for narrative generation (default: claude-haiku-4-5) |

---

## 2. Authentication Flow

Every incoming request is authenticated before any tool dispatch.

```
Request arrives with:  Authorization: Bearer <token>

Server-side:
  1. Strip "Bearer " prefix, trim whitespace.
  2. Look up token in api_keys table (see PRD-14):
       SELECT user_id, scopes, expires_at FROM api_keys
       WHERE token_hash = sha256($token) AND revoked = false
  3. If not found or expired → JSON-RPC error -32001 (Auth failed).
  4. If expires_at < now() → JSON-RPC error -32001 with message "Token expired".
  5. Attach user_id and scopes to request context.
  6. All subsequent DB queries filter by WHERE user_id = $ctx.user_id.
```

**Token rotation**: Tokens are 256-bit random strings. The DB stores only `sha256(token)`.
Tokens expire after 90 days by default (configurable per user plan in PRD-14).

**Scopes**: The `scopes` column (text[]) gates tool access:

| Scope | Tools unlocked |
|---|---|
| `read:portfolio` | GetPortfolioOverview, GetOpenPositions, GetModeComparison |
| `read:signals` | GetTodaySignals, GetPendingOrders |
| `read:trades` | GetTradeHistory, ExplainTrade |
| `read:risk` | GetRiskDashboard |
| `write:alerts` | SetAlert |
| `read:activity` | GetRecentActivity |

All scopes are granted to users on any paid plan. Free-tier users get `read:portfolio` only.

---

## 3. Data Scoping Logic

Every query to the underlying data layer (PostgreSQL + JSON files) applies a mandatory
user-id filter. The server uses a scoped data-access layer (DAL) pattern:

```javascript
class UserScopedDAL {
  constructor(userId, db, redis) {
    this.userId = userId;
    this.db = db;
    this.redis = redis;
  }

  // All methods enforce userId. Never accept userId as a parameter from caller.
  async getPositions(modes) {
    return this.db.query(
      `SELECT * FROM positions WHERE user_id = $1 AND mode = ANY($2) AND status = 'open'`,
      [this.userId, modes]
    );
  }

  async getTradeHistory(filters) {
    let q = `SELECT * FROM trades WHERE user_id = $1`;
    const params = [this.userId];
    if (filters.mode)       { q += ` AND mode = $${params.push(filters.mode)}`; }
    if (filters.ticker)     { q += ` AND ticker = $${params.push(filters.ticker)}`; }
    if (filters.from)       { q += ` AND entry_date >= $${params.push(filters.from)}`; }
    if (filters.to)         { q += ` AND exit_date <= $${params.push(filters.to)}`; }
    if (filters.status)     { q += ` AND status = $${params.push(filters.status)}`; }
    q += ` ORDER BY entry_date DESC LIMIT $${params.push(filters.limit || 100)}`;
    return this.db.query(q, params);
  }
}
```

The DAL is instantiated per request with the authenticated `user_id`. Tool handlers receive
only the DAL instance — they cannot issue raw DB queries.

---

## 4. Real-Time P&L Calculation

Open position P&L is calculated at request time using live prices fetched from Yahoo Finance
(same proxy pattern as `live-tracker.js`). The server-side fetch uses allorigins `/get`:

```javascript
async function fetchLivePrice(ticker) {
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1m&range=1d`;
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(yahooUrl)}`;
  const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(5000) });
  const { contents } = await res.json();
  const data = JSON.parse(contents);
  return data.chart.result[0].meta.regularMarketPrice;
}
```

Crypto tickers (suffix `-USD`) use Binance REST directly:
```javascript
async function fetchCryptoPrice(ticker) {
  const symbol = ticker.replace('-USD', 'USDT');
  const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`,
    { signal: AbortSignal.timeout(5000) });
  const { price } = await res.json();
  return parseFloat(price);
}
```

**Caching**: Live prices are cached in Redis with TTL = 30 seconds (key: `price:{ticker}`).
If Yahoo/Binance fetch fails, use last cached price and set `price_stale: true` in response.

**P&L formula**:
```
pnl_pct = ((current_price - entry_price) / entry_price) * 100 * (side === 'short' ? -1 : 1)
pnl_abs = (current_price - entry_price) * qty * (side === 'short' ? -1 : 1)
```

---

## 5. Tool Schemas

### 5.1 `GetPortfolioOverview`

```json
{
  "name": "GetPortfolioOverview",
  "description": "Return a high-level summary of the user's portfolio across their active modes. Includes equity, total return, open positions count, pending orders, and last trade.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "modes": {
        "type": "array",
        "items": { "type": "string", "enum": ["turbo","dynamic","balanced","secured","fortress","tkl"] },
        "description": "Filter to specific modes. If omitted, returns all modes the user has active."
      }
    },
    "additionalProperties": false
  }
}
```

**Returns**:
```json
{
  "as_of": "2026-05-07T14:32:00Z",
  "modes": [
    {
      "mode": "balanced",
      "broker": "alpaca",
      "equity": 13520.00,
      "initial_capital": 10000.00,
      "return_total_pct": 35.20,
      "return_today_pct": 1.23,
      "positions_count": 3,
      "pending_orders": 1,
      "regime": "RISK-ON",
      "regime_updated_at": "2026-05-07T06:00:00Z",
      "max_dd_pct": -4.10,
      "last_trade": {
        "ticker": "NVDA",
        "pnl_pct": 5.20,
        "status": "tp1",
        "date": "2026-05-06"
      }
    }
  ],
  "totals": {
    "equity": 13520.00,
    "return_total_pct": 35.20
  }
}
```

**Data source**: Reads from the same data layer as PRD-10 API (`/portfolio/v1/{mode}/all.json`
per user, overlaid with live position P&L from the price fetch above).

---

### 5.2 `GetOpenPositions`

```json
{
  "name": "GetOpenPositions",
  "description": "Return all open positions for the user's active modes with live P&L calculated at query time.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "modes": {
        "type": "array",
        "items": { "type": "string", "enum": ["turbo","dynamic","balanced","secured","fortress","tkl"] }
      }
    },
    "additionalProperties": false
  }
}
```

**Returns**:
```json
{
  "as_of": "2026-05-07T14:32:00Z",
  "positions": [
    {
      "mode": "balanced",
      "ticker": "NVDA",
      "side": "long",
      "entry_date": "2026-05-05",
      "entry_price": 120.50,
      "qty": 10,
      "current_price": 125.30,
      "price_stale": false,
      "pnl_pct": 3.98,
      "pnl_abs": 48.00,
      "days_held": 2,
      "horizon_expiry": "2026-05-10",
      "days_to_expiry": 3,
      "stop_loss": 114.48,
      "tp1": 130.14,
      "tp2": 138.58,
      "tp1_hit": false,
      "status": "open",
      "score": 93,
      "sharia_compliant": true
    }
  ]
}
```

---

### 5.3 `GetTodaySignals`

```json
{
  "name": "GetTodaySignals",
  "description": "Return today's scanner signals filtered for the user's active modes.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "modes": {
        "type": "array",
        "items": { "type": "string", "enum": ["turbo","dynamic","balanced","secured","fortress","tkl"] }
      },
      "min_score": {
        "type": "number",
        "description": "Override minimum score filter. Defaults to mode's configured minScore."
      }
    },
    "additionalProperties": false
  }
}
```

**Returns**:
```json
{
  "scan_date": "2026-05-07",
  "regime": "RISK-ON",
  "signals": [
    {
      "mode": "balanced",
      "ticker": "AAPL",
      "score": 91,
      "strategy": "Momentum",
      "sector": "tech",
      "region": "us",
      "entry_zone": [182.00, 185.00],
      "stop_loss": 175.00,
      "tp1": 195.00,
      "tp2": 210.00,
      "risk_reward": 1.8,
      "confirmations": ["RSI momentum", "Volume above avg", "Sector rotation"],
      "invalidations": ["Earnings in 8 days"],
      "sharia_compliant": true,
      "vwap_gate_pass": true
    }
  ],
  "total_signals": 1,
  "signals_filtered": 3,
  "filter_summary": "2 rejected by min_score, 1 rejected by dilution check"
}
```

---

### 5.4 `GetTradeHistory`

```json
{
  "name": "GetTradeHistory",
  "description": "Return the user's closed trade history with optional filters.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "modes": {
        "type": "array",
        "items": { "type": "string", "enum": ["turbo","dynamic","balanced","secured","fortress","tkl"] }
      },
      "from":   { "type": "string", "format": "date", "description": "Filter trades entered on or after this date" },
      "to":     { "type": "string", "format": "date", "description": "Filter trades entered on or before this date" },
      "ticker": { "type": "string", "description": "Filter to a specific ticker symbol" },
      "status": {
        "type": "string",
        "enum": ["tp1","tp2","stop","expired","rotated","all"],
        "default": "all"
      },
      "limit":  { "type": "integer", "minimum": 1, "maximum": 500, "default": 100 }
    },
    "additionalProperties": false
  }
}
```

**Returns**:
```json
{
  "trades": [
    {
      "mode": "balanced",
      "ticker": "NVDA",
      "side": "long",
      "entry_date": "2026-05-01",
      "exit_date": "2026-05-06",
      "entry_price": 115.20,
      "exit_price": 124.62,
      "qty": 8,
      "pnl_pct": 8.18,
      "pnl_abs": 75.36,
      "hold_days": 5,
      "status": "tp1",
      "score": 93,
      "regime_at_entry": "RISK-ON",
      "broker": "alpaca"
    }
  ],
  "summary": {
    "total_trades": 42,
    "win_rate": 60.0,
    "avg_pnl_pct": 3.85,
    "total_pnl_pct": 35.20,
    "best_trade": { "ticker": "NVDA", "pnl_pct": 12.4 },
    "worst_trade": { "ticker": "INTC", "pnl_pct": -5.0 }
  }
}
```

---

### 5.5 `GetRiskDashboard`

```json
{
  "name": "GetRiskDashboard",
  "description": "Return current risk metrics for the user's portfolio: VaR, drawdown, correlation, regime probability.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "modes": {
        "type": "array",
        "items": { "type": "string", "enum": ["turbo","dynamic","balanced","secured","fortress","tkl"] }
      }
    },
    "additionalProperties": false
  }
}
```

**Returns**:
```json
{
  "as_of": "2026-05-07T06:00:00Z",
  "modes": [
    {
      "mode": "balanced",
      "var_1d_95": -1.82,
      "var_1d_99": -2.91,
      "current_dd_pct": -1.20,
      "max_dd_pct": -4.10,
      "dd_breaker_threshold": -8.00,
      "correlation": {
        "avg_pairwise": 0.43,
        "max_pair": { "tickers": ["NVDA","AMD"], "rho": 0.81 },
        "warning": null
      },
      "regime_probability": {
        "RISK-ON":      0.72,
        "EARLY_RISK-OFF": 0.18,
        "RISK-OFF":     0.10
      },
      "vix_current": 18.4,
      "vix_kill_threshold": 35,
      "circuit_breaker_active": false,
      "stress_scenarios": {
        "flash_crash_minus_10pct": { "portfolio_impact_pct": -5.2 },
        "rate_shock_plus_100bp":   { "portfolio_impact_pct": -2.8 }
      }
    }
  ]
}
```

Data source: reads from `data/risk-snapshots.json` (generated by `refresh-risk-metrics.js`)
overlaid with live position data. `as_of` reflects the last pipeline run timestamp.

---

### 5.6 `GetPendingOrders`

```json
{
  "name": "GetPendingOrders",
  "description": "Return orders pending execution for the next trading session.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "modes": {
        "type": "array",
        "items": { "type": "string", "enum": ["turbo","dynamic","balanced","secured","fortress","tkl"] }
      }
    },
    "additionalProperties": false
  }
}
```

**Returns**:
```json
{
  "next_session_date": "2026-05-08",
  "orders": [
    {
      "mode": "balanced",
      "type": "entry",
      "ticker": "AAPL",
      "side": "long",
      "order_type": "limit",
      "limit_price": 183.50,
      "vwap_gate": true,
      "qty": 5,
      "stop_loss": 175.00,
      "tp1": 195.00,
      "tp2": 210.00,
      "score": 91,
      "expires": "2026-05-08T16:00:00-04:00"
    },
    {
      "mode": "balanced",
      "type": "rotate",
      "close_ticker": "INTC",
      "open_ticker": "AMD",
      "reason": "INTC score below rotation threshold",
      "close_limit_price": 28.40,
      "open_limit_price": 152.00
    }
  ],
  "total_orders": 2
}
```

---

### 5.7 `ExplainTrade`

Generates a human-readable narrative explaining why a trade was entered and its current state.
Uses an LLM call (configured via `EXPLAIN_TRADE_LLM_MODEL`) to compose the `thesis` field.

```json
{
  "name": "ExplainTrade",
  "description": "Return a detailed explanation of an open or historical trade including signal rationale, current P&L, exit levels, confirmations, and invalidations.",
  "inputSchema": {
    "type": "object",
    "required": ["ticker", "mode"],
    "properties": {
      "ticker": { "type": "string", "description": "Ticker symbol (e.g. NVDA)" },
      "mode":   { "type": "string", "enum": ["turbo","dynamic","balanced","secured","fortress","tkl"] },
      "trade_date": {
        "type": "string",
        "format": "date",
        "description": "Entry date if multiple trades exist for this ticker. Defaults to most recent."
      }
    },
    "additionalProperties": false
  }
}
```

**Returns**:
```json
{
  "ticker": "NVDA",
  "mode": "balanced",
  "trade_found": true,
  "status": "open",
  "signal": {
    "score": 93,
    "strategy": "Momentum",
    "sector": "semis",
    "region": "us",
    "thesis": "NVDA was selected on 2026-05-05 with a score of 93/100, driven by strong momentum in the semis sector amid an AI spending cycle. RSI confirmed upward momentum, volume was 1.8x the 20-day average signaling institutional accumulation, and the sector rotation model flagged semis as the top-ranked sector for the week. The VWAP gate was passed at session open, confirming favorable entry conditions."
  },
  "entry": {
    "date": "2026-05-05",
    "price": 120.50,
    "qty": 10,
    "vwap_adjusted": true,
    "regime_at_entry": "RISK-ON"
  },
  "current": {
    "price": 125.30,
    "price_stale": false,
    "pnl_pct": 3.98,
    "pnl_abs": 48.00,
    "days_held": 2
  },
  "exits": {
    "stop_loss":      114.48,
    "tp1":            130.14,
    "tp2":            138.58,
    "horizon_expiry": "2026-05-10",
    "days_to_expiry": 3,
    "tp1_hit":        false,
    "tp1_size_pct":   50
  },
  "confirmations": [
    "Volume 1.8x above 20-day average",
    "RSI momentum confirmed uptrend",
    "Semis sector ranked #1 by rotation model",
    "VWAP gate passed at session open"
  ],
  "invalidations": [
    "Earnings report in 8 days — position expires before earnings window",
    "Correlation with MSFT: 0.79 (monitor for portfolio-level risk)"
  ],
  "sharia_compliant": true
}
```

**Narrative generation logic**:
1. Server assembles structured data (signal fields, confirmations, invalidations, entry context).
2. Calls `EXPLAIN_TRADE_LLM_MODEL` (default: claude-haiku-4-5) with a prompt:
   ```
   Given this trade data: {JSON}, write a 2-3 sentence thesis explaining why the trade was
   entered and what makes it a valid setup. Be factual, cite the score and strategy.
   Do not speculate. Use professional financial language.
   ```
3. The LLM response is stored in `signal.thesis`. Max 300 tokens.
4. LLM call cached in Redis with TTL = `TRADES_CACHE_TTL_SECONDS` (keyed by `trade_id`).

---

### 5.8 `GetModeComparison`

```json
{
  "name": "GetModeComparison",
  "description": "Compare performance metrics across the user's active modes.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "modes": {
        "type": "array",
        "items": { "type": "string", "enum": ["turbo","dynamic","balanced","secured","fortress","tkl"] },
        "description": "Modes to compare. Defaults to all active modes."
      }
    },
    "additionalProperties": false
  }
}
```

**Returns**:
```json
{
  "as_of": "2026-05-07T14:32:00Z",
  "modes": [
    {
      "mode": "balanced",
      "return_total_pct": 35.20,
      "max_dd_pct": -4.10,
      "win_rate": 60.0,
      "profit_factor": 4.68,
      "sharpe": 2.1,
      "trades_closed": 42,
      "open_positions": 3,
      "equity": 13520.00,
      "regime": "RISK-ON"
    }
  ],
  "best_mode_by_return": "balanced",
  "best_mode_by_sharpe": "secured"
}
```

---

### 5.9 `SetAlert`

```json
{
  "name": "SetAlert",
  "description": "Create a price or condition alert for a position or ticker.",
  "inputSchema": {
    "type": "object",
    "required": ["ticker", "condition"],
    "properties": {
      "ticker": { "type": "string" },
      "mode":   { "type": "string", "enum": ["turbo","dynamic","balanced","secured","fortress","tkl"], "description": "Optionally associate alert with a mode's position." },
      "condition": {
        "type": "object",
        "required": ["type"],
        "properties": {
          "type": {
            "type": "string",
            "enum": ["price_above","price_below","pnl_pct_above","pnl_pct_below","days_held_gte","tp1_hit","stop_hit"]
          },
          "value": { "type": "number", "description": "Threshold value (for price/pnl/days conditions)" }
        }
      },
      "channels": {
        "type": "array",
        "items": { "type": "string", "enum": ["telegram","discord","slack","email","webhook"] },
        "description": "Override channels for this alert. Defaults to user's configured channels."
      },
      "expires_at": { "type": "string", "format": "date-time", "description": "Auto-delete alert after this timestamp." }
    },
    "additionalProperties": false
  }
}
```

**Returns**:
```json
{
  "alert_id": "uuid",
  "ticker": "NVDA",
  "condition": { "type": "price_above", "value": 130.00 },
  "channels": ["telegram"],
  "created_at": "2026-05-07T14:32:00Z",
  "expires_at": "2026-05-10T16:00:00Z",
  "status": "active"
}
```

Alerts are evaluated every 30 seconds by a background worker that reads live prices from
the shared Redis price cache (same feed as `GetOpenPositions`). When triggered: dispatch
notification via PRD-22 Notification Hub, set `status = 'triggered'`, remove from active queue.

---

### 5.10 `GetRecentActivity`

```json
{
  "name": "GetRecentActivity",
  "description": "Return a chronological activity feed of fills, closes, alerts, and regime changes.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "limit":  { "type": "integer", "minimum": 1, "maximum": 100, "default": 20 },
      "modes":  {
        "type": "array",
        "items": { "type": "string", "enum": ["turbo","dynamic","balanced","secured","fortress","tkl"] }
      },
      "types": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": ["fill","close","alert","regime_change","session_start","session_end","pipeline_event"]
        },
        "description": "Filter to specific event types. Defaults to all."
      }
    },
    "additionalProperties": false
  }
}
```

**Returns**:
```json
{
  "activity": [
    {
      "id": "uuid",
      "type": "close",
      "mode": "balanced",
      "timestamp": "2026-05-06T19:45:00Z",
      "data": { "ticker": "NVDA", "pnl_pct": 5.20, "reason": "tp1" },
      "summary": "NVDA closed +5.20% (TP1) in balanced mode"
    },
    {
      "id": "uuid",
      "type": "regime_change",
      "mode": null,
      "timestamp": "2026-05-06T06:00:00Z",
      "data": { "from": "EARLY_RISK-OFF", "to": "RISK-ON" },
      "summary": "Market regime changed: EARLY_RISK-OFF → RISK-ON"
    }
  ],
  "total": 2,
  "oldest_shown": "2026-05-06T06:00:00Z"
}
```

Activity events are written to the `notification_log` table (see PRD-22) and read back here
filtered by `user_id`. The `summary` field is a pre-computed human-readable string stored
at write time (no LLM call at read time for performance).

---

## 6. Caching Strategy

| Data type | Cache key pattern | TTL |
|---|---|---|
| Live prices | `price:{ticker}` | 30s |
| Open positions | `pos:{user_id}:{mode}` | 30s |
| Today's signals | `signals:{user_id}:{scan_date}` | 300s |
| Trade history | `trades:{user_id}:{filter_hash}` | 3600s |
| Risk dashboard | `risk:{user_id}` | 300s |
| Pending orders | `orders:{user_id}:{session_date}` | 300s |
| ExplainTrade narrative | `explain:{trade_id}` | 3600s |
| GetRecentActivity | `activity:{user_id}:{type_hash}` | 60s |

Cache invalidation: position cache is purged when the engine emits a `FILL`, `TRADE`, or
`ROTATE` event for the user. Signal cache is purged when a new scanner file is published.

---

## 7. Rate Limits

| Limit | Value |
|---|---|
| Requests per user per minute | 60 |
| `ExplainTrade` (LLM) calls per user per hour | 20 |
| `SetAlert` max active alerts per user | 50 |
| Response payload max size | 1 MB |

Rate limits are enforced via Redis token bucket (key: `ratelimit:{user_id}:{window}`).
Exceed limit → error code `-32005` with message `"Rate limit exceeded. Retry after {seconds}s"`.
The `Retry-After` header is set on the HTTP response.

---

## 8. Error Codes

| Code | Message | Cause |
|---|---|---|
| `-32600` | Invalid Request | Malformed JSON-RPC envelope |
| `-32601` | Method not found | Unknown tool name |
| `-32602` | Invalid params | Schema validation failure |
| `-32001` | Auth failed | Invalid, missing, or expired token |
| `-32003` | Scope denied | Token lacks required scope for this tool |
| `-32004` | Not found | Requested trade/ticker not found for user |
| `-32005` | Rate limit exceeded | Too many requests; includes retry-after |
| `-32006` | Price unavailable | Live price fetch failed with no cached fallback |

---

## 9. Additional Tool Schemas

### 9.1 `GetDailyDigest`

Natural language daily P&L summary with key observations. Designed for conversational use —
an LLM agent can relay this directly to the user without further processing.

```json
{
  "name": "GetDailyDigest",
  "description": "Return a natural language daily P&L summary for the user's portfolio. Includes today's equity change, trades closed/opened, notable events, and regime context. Suitable for direct relay to the user.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "modes": {
        "type": "array",
        "items": { "type": "string", "enum": ["turbo","dynamic","balanced","secured","fortress","tkl"] },
        "description": "Filter to specific modes. Omit for all active modes."
      },
      "date": {
        "type": "string",
        "format": "date",
        "description": "Date for the digest. Defaults to today (or last trading day if weekend)."
      },
      "verbosity": {
        "type": "string",
        "enum": ["brief", "standard", "detailed"],
        "default": "standard",
        "description": "brief = 2-3 bullet points, standard = paragraph + bullets, detailed = full breakdown with trade details."
      }
    },
    "additionalProperties": false
  }
}
```

**Returns**:
```json
{
  "date": "2026-05-07",
  "generated_at": "2026-05-07T23:15:00Z",
  "headline": "Portfolio +1.23% today — NVDA TP1 hit, 3 positions open across balanced mode",
  "digest": {
    "balanced": {
      "equity_start": 13356.00,
      "equity_end": 13520.00,
      "return_today_pct": 1.23,
      "return_total_pct": 35.20,
      "trades_closed_today": [
        { "ticker": "NVDA", "pnl_pct": 5.2, "status": "tp1_partial", "note": "Partial exit — 50% sold at TP1" }
      ],
      "trades_opened_today": [
        { "ticker": "AAPL", "score": 94, "strategy": "momentum", "entry_price": 192.50 }
      ],
      "positions_count": 3,
      "regime": "RISK-ON",
      "alerts": []
    }
  },
  "natural_language": "Your balanced portfolio gained 1.23% today, reaching $13,520 (+$164). NVDA hit its first take-profit target at +5.2% — half the position was sold automatically, with the remainder trailing. A new momentum entry was opened on AAPL at $192.50 (score 94). You now have 3 open positions. Market regime remains RISK-ON with VIX at 18.4.",
  "market_context": {
    "regime": "RISK-ON",
    "vix": 18.4,
    "spy_change_pct": 0.85
  }
}
```

**Data source**: Reads from `/portfolio/v1/{mode}/all.json` + live price overlay (§4).
Falls back to latest cached data if live prices are unavailable.

**Narrative generation**: Deterministic template-based (no LLM call). Template:
```
"Your {mode} portfolio {gained|lost} {return_today_pct}% today, reaching ${equity_end}
({+|-}${delta}). {trade_highlights}. You now have {positions_count} open positions.
Market regime {is|remains} {regime} with VIX at {vix}."
```

**Rate limit**: Same as standard tools (60/min). No LLM call = no special rate limit.

---

### 9.2 `GetStrategyInsights`

Key observations about portfolio performance — warnings, opportunities, and actionable suggestions.

```json
{
  "name": "GetStrategyInsights",
  "description": "Return key observations about portfolio performance: what's working, what's not, risk warnings, and actionable suggestions. Insights are rule-based and deterministic.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "modes": {
        "type": "array",
        "items": { "type": "string", "enum": ["turbo","dynamic","balanced","secured","fortress","tkl"] },
        "description": "Filter to specific modes. Omit for all active modes."
      },
      "categories": {
        "type": "array",
        "items": { "type": "string", "enum": ["performance", "risk", "regime", "signal_quality", "parameter_drift"] },
        "description": "Filter by insight category. Omit for all categories."
      },
      "severity_min": {
        "type": "string",
        "enum": ["info", "warning", "critical"],
        "default": "info",
        "description": "Minimum severity to include."
      }
    },
    "additionalProperties": false
  }
}
```

**Returns**:
```json
{
  "generated_at": "2026-05-07T23:00:00Z",
  "modes_analyzed": ["balanced"],
  "insights": [
    {
      "id": "ins-bal-regime-underperf-riskoff",
      "mode": "balanced",
      "category": "regime",
      "severity": "warning",
      "message": "Balanced mode underperforms in RISK-OFF: Sharpe 0.8 vs 2.9 in RISK-ON (-72%). Consider reducing portfolioSize to 1 during RISK-OFF periods.",
      "metric": "sharpe_by_regime",
      "current_value": 0.8,
      "benchmark_value": 2.9,
      "delta_pct": -72.4,
      "actionable": true,
      "suggested_action": "Set regimeFilters.risk_off.portfolioSize = 1 via optimizer or manual config update"
    },
    {
      "id": "ins-bal-score-threshold",
      "mode": "balanced",
      "category": "signal_quality",
      "severity": "info",
      "message": "Raising minScore from 88 to 93 would increase expectancy by 53% (1.42 → 2.18) at the cost of 36% fewer trades (42 → 27).",
      "metric": "optimal_score_threshold",
      "current_value": 88,
      "benchmark_value": 93,
      "delta_pct": 5.7,
      "actionable": true,
      "suggested_action": "Run optimizer with minScore range [88, 93, 95] to validate"
    },
    {
      "id": "ins-bal-sector-concentration",
      "mode": "balanced",
      "category": "risk",
      "severity": "warning",
      "message": "Tech sector holds 62.7% of portfolio weight with intra-sector correlation of 0.71. Diversification ratio: 1.45 (target > 1.5).",
      "metric": "sector_concentration",
      "current_value": 62.7,
      "benchmark_value": 40.0,
      "delta_pct": 56.8,
      "actionable": true,
      "suggested_action": "Consider enabling sectorCapMax = 2 to cap same-sector positions"
    }
  ],
  "summary": "Balanced mode is performing well overall (Sharpe 2.1, 35.2% return) but has two areas of concern: regime sensitivity in RISK-OFF and tech sector concentration. Consider running the optimizer to test higher minScore thresholds and sector caps."
}
```

**Data source**: Reads from analytics endpoints (PRD-10 §9-10) and risk-snapshots.
Uses the same rule-based insight generation as PRD-17 §13.3.

**Rate limit**: Standard (60/min).

---

### 9.3 `GetTradeExplanation`

Extended trade explanation with full entry/exit reasoning and performance context.
Enhances the existing `ExplainTrade` (§5.7) with attribution and insight data.

```json
{
  "name": "GetTradeExplanation",
  "description": "Return a comprehensive explanation of why a trade was entered, how it performed, and what it contributed to the portfolio. Includes signal context, confirmations, invalidations, attribution impact, and a natural language thesis.",
  "inputSchema": {
    "type": "object",
    "required": ["ticker", "mode"],
    "properties": {
      "ticker": { "type": "string", "description": "Ticker symbol (e.g. NVDA)" },
      "mode": {
        "type": "string",
        "enum": ["turbo","dynamic","balanced","secured","fortress","tkl"]
      },
      "trade_date": {
        "type": "string",
        "format": "date",
        "description": "Entry date if multiple trades exist. Defaults to most recent."
      },
      "include_similar": {
        "type": "boolean",
        "default": false,
        "description": "Include similar historical trades (same ticker or same setup pattern)."
      }
    },
    "additionalProperties": false
  }
}
```

**Returns** (extends ExplainTrade §5.7 response with new fields):
```json
{
  "ticker": "NVDA",
  "mode": "balanced",
  "trade_found": true,
  "status": "tp1_partial",
  "signal": {
    "score": 93,
    "strategy": "momentum",
    "sector": "semis",
    "regime_at_entry": "RISK-ON",
    "scan_date": "2026-05-02"
  },
  "entry": {
    "date": "2026-05-03",
    "price": 142.50,
    "reason": "Score 93 exceeded minScore 88, momentum strategy matched regimeFilter, VWAP gate passed"
  },
  "exit": {
    "date": "2026-05-07",
    "price": 149.92,
    "type": "tp1_partial",
    "reason": "Price reached TP1 at $149.90 (+5.2%). 50% position sold, remainder trailing with breakeven stop."
  },
  "performance": {
    "pnl_pct": 5.2,
    "pnl_dollar": 740.00,
    "days_held": 4,
    "max_favorable_excursion": 6.1,
    "max_adverse_excursion": -1.2
  },
  "attribution": {
    "contribution_to_portfolio_pct": 3.8,
    "strategy_avg_pnl": 1.25,
    "vs_strategy_avg": "4.0x above average",
    "sector_avg_pnl": 1.72,
    "vs_sector_avg": "3.0x above average"
  },
  "confirmations": [
    "Volume 1.8x above 20-day average",
    "RSI momentum confirmed uptrend",
    "Semis sector ranked #1 by rotation model"
  ],
  "invalidations": [
    "Earnings report in 12 days — outside ±5d exclusion window"
  ],
  "similar_trades": [
    {
      "ticker": "NVDA", "scan_date": "2026-03-15", "pnl_pct": 3.8,
      "status": "tp1", "days_held": 6, "note": "Similar momentum setup, RISK-ON"
    },
    {
      "ticker": "AMD", "scan_date": "2026-04-10", "pnl_pct": 2.1,
      "status": "tp1", "days_held": 5, "note": "Same sector, same strategy"
    }
  ],
  "thesis": "NVDA was selected on May 2 as a momentum play in the semis sector (score 93). Entry at $142.50 was confirmed by 1.8x volume and RSI momentum. The trade reached TP1 in 4 days — significantly faster than the 4.2-day average for momentum trades. This was the strongest contributor to the balanced portfolio this week at 3.8% of total return.",
  "sharia_compliant": true
}
```

**Similar trades logic**:
When `include_similar = true`, search `backtest-trades.json` for:
1. Same ticker, different scan date (max 5 most recent)
2. Same sector + same strategy label (max 3 most recent, exclude same ticker)
Sort by scan_date descending.

**Narrative generation**: Uses `EXPLAIN_TRADE_LLM_MODEL` (default: claude-haiku-4-5) — same
as existing `ExplainTrade`. The additional attribution and similar_trades data is passed
in the prompt for richer context.

**Rate limit**: Same as `ExplainTrade` — 20 LLM calls per user per hour.
