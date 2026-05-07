# PRD-19: Shared Market Data Layer

**Version**: 1.0  
**Status**: Draft  
**Dependencies**: PRD-01 (Market Data), PRD-12 (MCP Orchestration), PRD-10 (API Layer), PRD-18 (Security)

---

## 1. Overview

In single-user mode, each pipeline makes independent MCP/Yahoo Finance calls. At SaaS scale (100+ concurrent users), many users request identical data simultaneously (market overview, regime probability, quotes for SPY/QQQ/AAPL). Without a shared layer, MCP costs scale linearly with user count and Yahoo Finance rate limits are hit immediately.

This PRD defines a mutualized market data architecture with three cache tiers, a shared screener deduplication pool, a WebSocket quote aggregator, data freshness contracts, and per-user cost attribution.

---

## 2. Architecture Overview

The shared data layer runs on a **single Oracle Cloud Always Free VM** (ARM A1: 4 OCPUs, 24GB RAM). All tiers are co-located — no distributed cache, no multi-pod coordination.

```
┌──────────────────────────────────────────────────────────┐
│            Oracle Cloud Always Free (ARM A1)               │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Single Go Binary                         │  │
│  │                                                       │  │
│  │  ┌─────────────┐   ┌─────────────┐   ┌───────────┐   │  │
│  │  │  REST API    │   │  Pipeline   │   │ Quote     │   │  │
│  │  │  + L1 Cache  │   │  Engine     │   │ Aggregator│   │  │
│  │  │ (sync.Map)   │   │             │   │ (goroutine│   │  │
│  │  └──────┬───────┘   └─────────────┘   └───────────┘   │  │
│  │         │                                              │  │
│  │         ▼                                              │  │
│  │  ┌─────────────┐                                      │  │
│  │  │  L2: Redis   │ (localhost:6379, single instance)    │  │
│  │  └──────┬───────┘                                      │  │
│  └─────────┼──────────────────────────────────────────────┘  │
│            │                                                  │
│            ▼                                                  │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  L3: Origins                                          │    │
│  │  ├── MCP Gateway (HTTPS)                              │    │
│  │  ├── Yahoo Finance (REST + WebSocket)                 │    │
│  │  └── Binance WebSocket                                │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌───────────────────┐   ┌────────────────────────────┐     │
│  │  SQLite DB         │   │  Oracle Object Storage     │     │
│  │  (+ Litestream)    │   │  (10GB free, backtest data)│     │
│  └───────────────────┘   └────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

**Quote Aggregator** (goroutine inside the same binary, not a separate process):
```
Quote Aggregator goroutine
  ├── Yahoo Finance WebSocket (wss://streamer.finance.yahoo.com/)
  │     └── Write to L1 (sync.Map) + L2 (Redis SET with TTL)
  └── Binance WebSocket (wss://stream.binance.com:9443/)
        └── Write to L1 (sync.Map) + L2 (Redis SET with TTL)
```

---

## 3. Multi-Tier Cache

### 3.1 Tier Definitions

| Tier | Location | Scope | Eviction |
|------|----------|-------|----------|
| L1 | In-process memory (Go `sync.Map` + TTL wrapper) | Single binary | LRU, max 256MB |
| L2 | Redis (localhost, single instance on same VM) | Persists across binary restarts | TTL-based |
| L3 | MCP Gateway / Yahoo / Binance | Origin | N/A |

### 3.2 Cache TTLs by Data Type

| Data Type | L1 TTL | L2 TTL | Refresh Strategy | Redis Key Pattern |
|-----------|--------|--------|-----------------|-------------------|
| Market Overview | 5 min | 15 min | Scheduled every 15 min (market hours) | `mkt:overview:{date}` |
| Regime Probability | 30 min | 1 h | Scheduled every 30 min | `mkt:regime:{date}:{hour}` |
| Quotes — popular tickers (SPY,QQQ,AAPL,MSFT,NVDA,BTC-USD,ETH-USD + top 50 by volume) | 30 s | 2 min | WebSocket push (live); on-demand fallback | `quote:{ticker}` |
| Quotes — all other tickers | 30 s | 2 min | On-demand fetch, then cached | `quote:{ticker}` |
| Correlation Matrix | 1 h | 4 h | On-demand, cached per symbol set | `mkt:corr:{symbols_hash}:{window}` |
| Screener Results | 0 (no L1) | 30 min | Per-pipeline, shared on overlap | `screener:{params_hash}` |
| SEC Filings / Flags | 1 h | 24 h | On-demand, cached per ticker | `sec:{ticker}:{date}` |
| Earnings Calendar | 1 h | 6 h | Scheduled twice daily (08:00 + 18:00 ET) | `mkt:earnings:{date}` |
| OHLCV Bars (daily) | 1 h | 6 h | On-demand | `bars:daily:{ticker}:{from}:{to}` |
| OHLCV Bars (intraday) | 5 min | 10 min | On-demand | `bars:intraday:{ticker}:{date}` |
| Options Chain | 5 min | 10 min | On-demand | `options:{ticker}:{date}` |
| Social Sentiment | 10 min | 30 min | On-demand | `social:{ticker}:{date}` |
| Capital Flow | 10 min | 30 min | On-demand | `flow:{ticker}:{date}` |
| Dark Pool / Unusual Options | 15 min | 1 h | On-demand | `darkpool:{ticker}:{date}` |
| FTD / Flags (anti-dilution) | 1 h | 24 h | On-demand | `flags:{ticker}:{date}` |

### 3.3 Redis Key Naming Convention

**Format**: `{namespace}:{discriminator}[:{sub}...]`

```
namespace:
  mkt       — market-wide, shared across all users (no user_id in key)
  quote     — individual ticker price
  screener  — screener job results
  sec       — SEC filings
  bars      — price bars
  options   — options data
  social    — social sentiment
  flow      — capital flow
  mcp       — raw MCP response cache
  ratelimit — rate limiting counters
  auth      — authentication state
  job       — async job state

All market-data keys (mkt:*, quote:*, screener:*, sec:*, bars:*, options:*, social:*, flow:*):
  MUST NOT contain user_id — data is shared across users
  Key collision = correct behavior (same data served to all)

User-specific keys (job:*, auth:*, ratelimit:*):
  MUST contain user_id or session identifier
  Key collision = bug (isolation violation)
```

**Hash computation for compound keys**:
```
symbols_hash = hex(SHA-256(JSON.stringify([...symbols].sort())))[:16]
params_hash  = hex(SHA-256(JSON.stringify(sortedKeys(params))))[:16]
```

### 3.4 Cache Read/Write Algorithm

Applied uniformly by `CacheLayer` module:

```typescript
async function get<T>(
  key: string,
  l1ttl: number,      // seconds, 0 = skip L1
  l2ttl: number,      // seconds, 0 = skip L2
  fetcher: () => Promise<T>,
  options?: { allowStale?: boolean }
): Promise<{ data: T; source: "l1" | "l2" | "l3"; age_seconds: number }> {

  // 1. L1 check (process memory)
  if (l1ttl > 0) {
    const l1 = l1Cache.get(key);
    if (l1 && Date.now() - l1.ts < l1ttl * 1000) {
      return { data: l1.data, source: "l1", age_seconds: (Date.now() - l1.ts) / 1000 };
    }
  }

  // 2. L2 check (Redis)
  if (l2ttl > 0) {
    const [raw, ttlRemaining] = await redis.multi().get(key).ttl(key).exec();
    if (raw) {
      const parsed = JSON.parse(raw);
      const age = l2ttl - ttlRemaining;
      // Populate L1
      if (l1ttl > 0) l1Cache.set(key, { data: parsed, ts: Date.now() - age * 1000 });
      return { data: parsed, source: "l2", age_seconds: age };
    }
  }

  // 3. L3 fetch (origin)
  try {
    const data = await fetcher();
    // Populate L2
    if (l2ttl > 0) await redis.set(key, JSON.stringify(data), "EX", l2ttl);
    // Populate L1
    if (l1ttl > 0) l1Cache.set(key, { data, ts: Date.now() });
    return { data, source: "l3", age_seconds: 0 };
  } catch (err) {
    // Stale fallback: if origin fails, return stale L2 if allowed
    if (options?.allowStale && l2ttl > 0) {
      const raw = await redis.get(key);
      if (raw) return { data: JSON.parse(raw), source: "l2", age_seconds: -1 }; // -1 = stale
    }
    throw err;
  }
}
```

**Cache invalidation**: TTL-based only (no active invalidation except for scheduled refreshes). For scheduled refreshes: write new value to L2 with full TTL; L1 will expire naturally within its shorter TTL.

### 3.5 Every API Response Includes Freshness Header

```
X-Data-Age-Seconds: <integer>   // seconds since data was fetched from origin
X-Data-Source: l1|l2|l3|stale  // where data came from
X-Data-AsOf: <ISO-8601>         // timestamp when data was fetched from origin
```

For aggregated responses (multiple data types), use the maximum age:
```
X-Data-Age-Seconds: max(age of all component data)
```

---

## 4. Data Freshness Contracts

Freshness guarantees vary by market session. These are SLA commitments — if violated, alert fires.

### 4.1 Market Hours (09:30–16:00 ET, Monday–Friday)

| Data | Max Staleness | Alert Threshold |
|------|--------------|----------------|
| Quotes (popular tickers) | 30 s | > 45 s |
| Quotes (other tickers) | 2 min | > 3 min |
| Regime Probability | 30 min | > 45 min |
| Market Overview | 15 min | > 20 min |
| Earnings Calendar | 6 h | > 8 h |

### 4.2 Pre-Market (04:00–09:30 ET)

| Data | Max Staleness |
|------|--------------|
| Quotes | 2 min |
| Regime Probability | 1 h |
| Market Overview | 1 h |

### 4.3 After Hours / Weekends

| Data | Max Staleness |
|------|--------------|
| Quotes | 5 min (or last close) |
| Regime Probability | 4 h |
| Market Overview | 4 h |
| Screener Results | 24 h |

### 4.4 Freshness Monitoring

Background job (runs every 2 min):
```typescript
async function freshnessCheck() {
  const checks = [
    { key: "mkt:overview:*", maxAge: marketHours() ? 900 : 3600 },
    { key: "mkt:regime:*",   maxAge: marketHours() ? 1800 : 14400 },
    { key: "quote:SPY",      maxAge: marketHours() ? 30 : 300 },
  ];

  for (const check of checks) {
    const ttl = await redis.ttl(check.key);
    const age = check.maxAge_l2ttl - ttl;  // approximate age
    if (age > check.maxAge * 1.5) {
      alertOncall(`Freshness violation: ${check.key} is ${age}s old (max ${check.maxAge}s)`);
    }
  }
}
```

---

## 5. Shared Screener Pool

### 5.1 Problem

At 23:00 ET, 50+ users trigger scanner pipelines simultaneously. Without sharing:
- 50 `RunAutoScreener` MCP calls at identical market conditions
- 50 `RunScreener` calls with identical DSL params
- Same results returned 50 times, costs 50× more

### 5.2 Deduplication Algorithm

```typescript
interface ScreenerJobKey {
  tool: "RunAutoScreener" | "RunScreener";
  params: Record<string, any>;  // normalized DSL params
}

async function runScreener(tool: string, params: object): Promise<ScreenerResult> {
  const paramsHash = hex(SHA256(JSON.stringify(sortedKeys(params))))[:16];
  const cacheKey = `screener:${tool}:${paramsHash}`;
  const lockKey = `screener:lock:${tool}:${paramsHash}`;

  // 1. Check L2 cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    attributeMCPCost(userId, tool, 0); // shared hit: 0 cost
    return JSON.parse(cached);
  }

  // 2. Distributed lock: ensures only ONE concurrent MCP call for identical params
  const lockAcquired = await redis.set(lockKey, "1", "NX", "EX", 120); // 2 min lock

  if (lockAcquired) {
    // 3a. Lock winner: call MCP, write to cache, release lock
    try {
      const result = await mcpCall(tool, params);
      await redis.set(cacheKey, JSON.stringify(result), "EX", 1800); // 30 min TTL
      attributeMCPCost(userId, tool, 1); // full cost to lock winner
      return result;
    } finally {
      await redis.del(lockKey);
      await redis.publish(`screener:ready:${paramsHash}`, "1"); // wake waiters
    }
  } else {
    // 3b. Lock losers: wait for result via Pub/Sub, then read from cache
    await waitForScreenerReady(paramsHash, 90_000); // 90s timeout
    const result = await redis.get(cacheKey);
    if (result) {
      attributeMCPCost(userId, tool, 1 / estimateCoalescedUsers(lockKey)); // amortized cost
      return JSON.parse(result);
    }
    // Timeout fallback: try direct call
    return mcpCall(tool, params);
  }
}

async function waitForScreenerReady(paramsHash: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const sub = redis.duplicate();
    const timer = setTimeout(() => { sub.disconnect(); reject(new Error("timeout")); }, timeoutMs);
    sub.subscribe(`screener:ready:${paramsHash}`, () => {
      clearTimeout(timer);
      sub.disconnect();
      resolve();
    });
  });
}
```

### 5.3 Coalescing Window

When multiple users trigger identical screener params within a 5-minute window, they share the result:
```
t=0:00  User A triggers RunAutoScreener → lock acquired, MCP call starts
t=0:05  User B triggers RunAutoScreener (same params) → waits on lock
t=0:08  User C triggers RunAutoScreener (same params) → waits on lock
t=0:12  MCP returns → cached → lock released → B and C wake up, read cache
Result: 1 MCP call instead of 3. Cost attribution: A=1 call, B=0.33, C=0.33 (amortized)
```

**Stale-while-revalidate**: If cached screener result is between 20–30 min old (approaching TTL expiry):
- Return stale result immediately
- Trigger background refresh (acquire lock, call MCP, update cache)
- User gets fast response, next request gets fresh data

### 5.4 Screener Param Normalization

Before hashing, normalize params to eliminate equivalent-but-different requests:
```typescript
function normalizeScreenerParams(params: object): object {
  const norm = { ...params };
  // Sort array fields
  if (Array.isArray(norm.symbols)) norm.symbols = [...norm.symbols].sort();
  if (Array.isArray(norm.filters)) norm.filters = [...norm.filters].sort();
  // Canonicalize numeric types
  if (typeof norm.min_score === 'string') norm.min_score = parseFloat(norm.min_score);
  // Remove fields with default values
  if (norm.days === 30) delete norm.days; // 30 is default
  return norm;
}
```

---

## 6. Quote Aggregator

### 6.1 Architecture

A **goroutine** inside the single Go binary maintains WebSocket connections to Yahoo Finance and Binance. It receives price ticks and writes directly to L1 (in-process `sync.Map`) and L2 (local Redis). No Pub/Sub fan-out needed — there is only one process.

```
Quote Aggregator goroutine (inside main binary)
├── Yahoo WebSocket Client
│     ├── Subscribe to: all tickers in active position tracking across ALL users
│     ├── Protocol: Yahoo Finance Protobuf over wss://streamer.finance.yahoo.com/
│     ├── Heartbeat: re-subscribe every 15s (per signal-monitor.js pattern)
│     └── On tick: decode Protobuf → write L1 (sync.Map) + L2 (Redis SET EX 120)
│
└── Binance WebSocket Client
      ├── Subscribe to: all crypto tickers in active positions
      ├── Protocol: wss://stream.binance.com:9443/stream?streams=<ticker>@trade/...
      ├── Max 1024 streams per connection; open multiple connections if needed
      └── On tick: write L1 (sync.Map) + L2 (Redis SET EX 120)

No Pub/Sub needed (single process):
  API handler reads L1 directly (same process memory)
  L2 (Redis) serves as persistence across binary restarts
```

### 6.2 Subscription Management

The aggregator goroutine maintains an **in-process subscription registry** of all tickers needed across all active users. Since everything runs in a single binary, no Redis coordination is needed for subscriptions.

```go
// In-process subscription set (goroutine-safe)
var subscriptions sync.Map // map[string]struct{}

// Called by pipeline engine or API handler when positions change
func RegisterTickers(tickers []string) {
    for _, t := range tickers {
        subscriptions.Store(t, struct{}{})
    }
}

// Aggregator goroutine: reconcile subscriptions every 30s
func reconcileSubscriptions(yahooWs, binanceWs *WSClient) {
    needed := collectSubscriptions() // read from sync.Map
    for _, t := range needed {
        if isCrypto(t) {
            binanceWs.Subscribe(t)
        } else {
            yahooWs.Subscribe(t)
        }
    }
}
```

### 6.3 Yahoo Finance WebSocket Protocol

```typescript
// Authentication (session cookie required — use allorigins proxy for CORS)
const YAHOO_WS_URL = "wss://streamer.finance.yahoo.com/";

// Subscribe message
const subscribeMsg = JSON.stringify({
  subscribe: tickers  // array of ticker symbols
});

// Messages are Protobuf-encoded. Decode using PricingData.proto:
// PricingData { id: string, price: float, time: int64, ... }

// Reconnect behavior:
const RECONNECT_BASE_MS = 3000;
const RECONNECT_MAX_MS = 60000;
let reconnectDelay = RECONNECT_BASE_MS;

ws.on('close', () => {
  setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
    connectYahooWs();
  }, reconnectDelay);
});

ws.on('message', () => {
  reconnectDelay = RECONNECT_BASE_MS; // reset on successful message
});
```

### 6.4 Binance WebSocket Protocol

```typescript
const BINANCE_STREAMS_PER_CONNECTION = 1024;

// Combined stream URL: wss://stream.binance.com:9443/stream?streams=btcusdt@trade/ethusdt@trade/...
// Ticker format: lowercase symbol + "@trade" (e.g., "btcusdt@trade")

// Message format:
interface BinanceTradeMessage {
  stream: string;    // "btcusdt@trade"
  data: {
    p: string;       // price (string)
    q: string;       // quantity
    T: number;       // trade time (Unix ms)
    s: string;       // symbol ("BTCUSDT")
  }
}

// Crypto ticker mapping: "BTC-USD" → "BTCUSDT" (remove dash, uppercase)
function toCryptoStreamId(ticker: string): string {
  return ticker.replace('-', '').toLowerCase() + '@trade';
}
```

### 6.5 Tick Publish Format

```typescript
interface QuoteTick {
  ticker: string;
  price: number;
  change_pct: number | null;   // null if prev close unknown
  volume: number | null;
  timestamp_ms: number;
  source: "yahoo" | "binance";
}

// Stored in Redis:
// Key: "quote:{ticker}"
// Value: JSON(QuoteTick)
// TTL: 120s (refreshed on every tick)

// Also published to:
// Channel: "quote:tick:{ticker}"
// Message: JSON(QuoteTick)
```

### 6.6 Fallback for Cache Miss + WebSocket Gap

If `quote:{ticker}` key missing from Redis (aggregator down or ticker not subscribed):
1. API handler makes direct Yahoo Finance REST call via allorigins proxy
2. Caches result in L2 with 30s TTL
3. Registers ticker for future WebSocket delivery via `RegisterTickers()`
4. Returns data with `X-Data-Source: l3`

### 6.7 Aggregator Health & Reconnection

Since the aggregator runs as a goroutine in the same binary, health is checked in-process:

```go
// Health status (updated by aggregator goroutine, read by API handlers)
type AggregatorHealth struct {
    mu               sync.RWMutex
    LastTick         time.Time
    YahooConnected   bool
    BinanceConnected bool
    SubscribedCount  int
}

// API health endpoint reads directly:
func (h *AggregatorHealth) IsHealthy() bool {
    h.mu.RLock()
    defer h.mu.RUnlock()
    return time.Since(h.LastTick) < 30*time.Second
}

// If aggregator goroutine crashes, API handler detects via IsHealthy()
// and falls back to REST polling for quotes
```

---

## 7. Scheduled Refresh Jobs

Background jobs that proactively refresh L2 before TTL expiry. Prevents cache stampede.

### 7.1 Job Definitions

```typescript
const SCHEDULED_REFRESHES = [
  {
    name: "market_overview",
    cron: "*/15 * * * *",          // every 15 min (market hours: */5 * * * 1-5)
    fn: () => fetchAndCache("GetMarketOverview", {}, "mkt:overview:today", 900),
  },
  {
    name: "regime_probability",
    cron: "*/30 * * * *",           // every 30 min
    fn: () => fetchAndCache("GetRegimeProbability",
      { model: "ensemble", horizon: 5 }, "mkt:regime:latest", 3600),
  },
  {
    name: "earnings_calendar",
    cron: "0 8,18 * * 1-5",         // 08:00 and 18:00 ET, weekdays
    fn: () => fetchAndCache("GetEarningsCalendarFiltered",
      { days_ahead: 7, min_expected_move: 4 }, "mkt:earnings:upcoming", 21600),
  },
  {
    name: "popular_quotes_refresh",
    cron: "*/2 * * * 1-5",          // every 2 min during market hours (REST fallback)
    marketHoursOnly: true,
    fn: () => refreshPopularQuotes(POPULAR_TICKERS),
  },
];
```

### 7.2 Popular Ticker List

```typescript
const POPULAR_TICKERS = [
  // US Indices
  "SPY", "QQQ", "DIA", "IWM", "VXX",
  // Mega-cap
  "AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "TSLA", "AVGO",
  // ETFs (sector)
  "XLK", "XLF", "XLE", "XLV", "XLI", "XLC", "XLB", "XLRE", "XLY", "XLP", "XLU",
  // Rates / Commodities
  "TLT", "GLD", "SLV", "USO", "EFA", "EEM", "FXI",
  // Crypto
  "BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD"
];
// Total: ~45 tickers always subscribed via WebSocket regardless of user positions
```

### 7.3 Cache Stampede Prevention

For scheduled refresh jobs, use a Redis lock to prevent duplicate refreshes (relevant when multiple goroutines or restarts overlap):

```typescript
async function fetchAndCache(tool, params, key, ttlSeconds) {
  const lockKey = `refresh:lock:${key}`;
  const acquired = await redis.set(lockKey, "1", "NX", "EX", ttlSeconds * 0.8);
  if (!acquired) return; // another refresh is already in progress

  try {
    const result = await mcpCall(tool, params);
    await redis.set(key, JSON.stringify(result), "EX", ttlSeconds);
  } finally {
    await redis.del(lockKey);
  }
}
```

---

## 8. Cost Attribution

### 8.1 MCP Call Tracking

Every MCP call (regardless of cache hit/miss) tracked for billing:

```sql
CREATE TABLE mcp_usage (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  tool_name TEXT NOT NULL,
  call_date DATE NOT NULL,
  attributed_calls NUMERIC(10, 4) NOT NULL DEFAULT 1.0,  -- fractional for amortized shared calls
  cache_hit BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Partition by month. Index by user+date for billing queries.
CREATE INDEX idx_mcp_usage_user_date ON mcp_usage(user_id, call_date DESC);
```

**Attribution rules**:
```
L3 hit (cache miss → origin call):
  Lock winner: attributed_calls = 1.0 for that user
  Lock losers (coalesced): attributed_calls = 1.0 / N where N = number of waiters

L1/L2 hit (cache hit):
  attributed_calls = 0.0 (no cost attributed)

Scheduled refresh (background job, no specific user):
  attributed_calls amortized across active users in last 1 hour:
    active_users = COUNT(DISTINCT user_id FROM api_requests WHERE created_at > now() - 1h)
    each user gets: attributed_calls += 1.0 / max(active_users, 1)
```

### 8.2 Daily Usage Aggregation

```sql
-- Materialized view for billing dashboard
CREATE MATERIALIZED VIEW mcp_daily_summary AS
SELECT
  user_id,
  call_date,
  SUM(attributed_calls) AS total_attributed_calls,
  COUNT(*) FILTER (WHERE cache_hit = false) AS direct_calls,
  COUNT(*) FILTER (WHERE cache_hit = true) AS cached_calls
FROM mcp_usage
GROUP BY user_id, call_date;

-- Refresh every hour
REFRESH MATERIALIZED VIEW CONCURRENTLY mcp_daily_summary;
```

### 8.3 Usage Dashboard Endpoint

**Endpoint**: `GET /api/v1/usage/mcp`

```typescript
interface MCPUsageResponse {
  period: { from: string; to: string };
  daily: {
    date: string;
    total_attributed: number;
    direct_calls: number;
    cached_calls: number;
    savings_pct: number;   // cached / (cached + direct) * 100
  }[];
  totals: {
    attributed_calls: number;
    direct_calls: number;
    cached_calls: number;
    tier_budget: number | null;   // null = unlimited
    budget_used_pct: number | null;
  };
}
```

### 8.4 Budget Enforcement

```typescript
async function checkMCPBudget(userId: string, tool: string): Promise<void> {
  const tier = await getUserTier(userId);
  const limits = { free: 0, basic: 500, pro: 5000, admin: Infinity };
  const budget = limits[tier];

  if (budget === 0) throw new Error("mcp_not_available_on_free_tier");
  if (budget === Infinity) return;

  // Redis daily counter
  const key = `mcp:daily:${userId}:${today()}`;
  const count = await redis.incrbyfloat(key, 1.0);
  if (count === 1) await redis.expire(key, 86400 + 3600); // 25h safety margin

  if (count > budget) {
    // Over budget: check if cached result available (serve stale rather than 429)
    const cacheKey = deriveCacheKey(tool, currentParams);
    const stale = await redis.get(cacheKey);
    if (stale) {
      // Return stale data with warning header
      setHeader("X-Budget-Exceeded", "true");
      setHeader("X-Data-Source", "stale");
      return JSON.parse(stale);
    }
    throw new Error("mcp_daily_budget_exceeded");
  }
}
```

---

## 9. API Proxy Endpoints

All market data accessed by clients goes through these API endpoints — never directly to MCP or Yahoo Finance. The shared cache is transparent.

### 9.1 Market Overview

**Endpoint**: `GET /api/v1/market/overview`

```typescript
// Response
{
  "data": MarketOverviewResult,  // from GetMarketOverview MCP tool
  "meta": {
    "source": "l1" | "l2" | "l3" | "stale",
    "age_seconds": number,
    "as_of": string   // ISO-8601
  }
}
```

**Implementation**:
```typescript
const key = `mkt:overview:${today()}`;
return cacheLayer.get(key, 300, 900, () => mcpCall("GetMarketOverview", {}));
```

### 9.2 Regime Probability

**Endpoint**: `GET /api/v1/market/regime`

```typescript
// Response
{
  "data": {
    "currentState": "RISK-ON" | "RISK-OFF" | "NEUTRAL" | "EARLY_RISK_OFF" | "RECOVERY" | "CRISIS",
    "probabilities": {
      "risk_on": number,         // 0.0–1.0
      "neutral": number,
      "early_risk_off": number,
      "crisis": number
    },
    "transition5d": string,      // predicted state in 5 days
    "expectedReturnSpyPct": number,
    "expectedDrawdownPct": number
  },
  "meta": { "source": string; "age_seconds": number; "as_of": string; }
}
```

### 9.3 Quote (Single Ticker)

**Endpoint**: `GET /api/v1/market/quote/{ticker}`

```typescript
// Response
{
  "ticker": string,
  "price": number,
  "change_pct": number,
  "volume": number | null,
  "prev_close": number | null,
  "timestamp_ms": number,
  "meta": { "source": string; "age_seconds": number; }
}
```

**Implementation**:
```typescript
const key = `quote:${ticker.toUpperCase()}`;
return cacheLayer.get(key, 30, 120, () => fetchYahooQuote(ticker));
```

### 9.4 Quotes (Batch)

**Endpoint**: `POST /api/v1/market/quotes` with `{ "tickers": string[] }` (max 50)

Returns map of `{ [ticker]: QuoteData }`. Each ticker fetched independently from cache; misses batched into single Yahoo call.

### 9.5 Screener

**Endpoint**: `POST /api/v1/market/screener`

```typescript
// Request
{
  "tool": "RunAutoScreener" | "RunScreener",
  "params": object    // DSL params for RunScreener, or empty for RunAutoScreener
}

// Response
{
  "data": ScreenerResult,
  "meta": {
    "source": "l2" | "l3",      // L1 not used for screener (see §3.2)
    "age_seconds": number,
    "coalesced": boolean,         // true if this was a shared call
    "job_id": string | null       // if async (> 30s expected)
  }
}
```

### 9.6 Correlation Matrix

**Endpoint**: `POST /api/v1/market/correlation`

```typescript
// Request
{ "symbols": string[], "window": 20 | 60 | 90 }

// Response
{
  "data": {
    "matrix": number[][],                    // NxN correlation matrix
    "symbols": string[],                     // ordered list matching matrix rows/cols
    "max_pair": { "symbol_a": string; "symbol_b": string; "rho": number; },
    "avg_off_diagonal": number
  },
  "meta": { "source": string; "age_seconds": number; }
}
```

**Cache key**: `mkt:corr:{symbols_hash}:{window}` where `symbols_hash = hex(SHA256([...symbols].sort().join(',')))[:16]`

---

## 10. Fallback Behavior Matrix

Defines exact behavior when each data source fails.

| Scenario | Behavior |
|----------|----------|
| MCP gateway down | Return L2 stale cache; set `X-Data-Source: stale`. If no cache: 503 with `{"error":"market_data_unavailable"}`. Never return empty/null data silently. |
| Yahoo WebSocket disconnected | Aggregator goroutine switches to REST polling every 30s. API handler detects via `IsHealthy()` (§6.7). Quote freshness degrades to polling interval. |
| Redis L2 down | Serve from L1 (in-process memory); make direct L3 calls on L1 miss. Alert fires. Rate limiting falls back to in-memory. |
| Binance WebSocket down | Crypto quotes fall back to Binance REST API via `api.binance.com/api/v3/ticker/price`. |
| Cache miss + origin failure | Return most recent stale L2 value if available (any age); header `X-Data-Source: stale`. Log warning. If no stale: 503. |
| Budget exceeded + no cache | Return 429 `{"error":"mcp_daily_budget_exceeded"}` with `Retry-After: <seconds_until_midnight_ET>`. |
| Screener lock held > 90s | Lock waiter gives up, makes direct MCP call as fallback. Log warning (indicates MCP is slow). |

---

## 11. Redis Configuration (Single Instance)

At ~25 users, a single Redis instance on the same VM is sufficient. No cluster, no sentinel.

```yaml
# /etc/redis/redis.conf (on Oracle Cloud Always Free VM)
redis:
  bind: 127.0.0.1          # localhost only — no external access
  port: 6379
  maxmemory: 512mb          # plenty for ~25 users' cache data
  maxmemory-policy: allkeys-lru
  persistence:
    rdb: true               # snapshot for recovery across Redis restarts
    aof: false              # not needed for cache data
  keyspace_notifications: "Kx"
```

**L1 cache (in-process, Go)**:
```go
// LRU cache with TTL, max 256MB
// Use github.com/hashicorp/golang-lru/v2 or github.com/dgraph-io/ristretto
type L1Cache struct {
    cache *ristretto.Cache  // thread-safe, 256MB max
}

func NewL1Cache() *L1Cache {
    c, _ := ristretto.NewCache(&ristretto.Config{
        NumCounters: 1e5,    // ~100K keys
        MaxCost:     256e6,  // 256MB
        BufferItems: 64,
    })
    return &L1Cache{cache: c}
}
```

**Scaling note**: If user count grows beyond ~50, consider upgrading to Oracle Cloud paid tier (or a second VM with Redis). The architecture supports this by simply changing `REDIS_URL` to point to an external Redis instance — no code changes needed.

---

## 12. Monitoring & Alerting

### 12.1 Key Metrics

```
mkt.cache.l1_hit_rate       — target > 70% (gauge, per data type)
mkt.cache.l2_hit_rate       — target > 85% (gauge, per data type)
mkt.cache.l3_calls_per_min  — track origin call volume (counter)
mkt.screener.coalesce_rate  — % of screener calls coalesced (target > 40% at peak)
mkt.quote.age_p99           — 99th percentile quote age in seconds (target < 60s market hours)
mkt.aggregator.ws_connected — boolean gauge per source (1 = connected)
mkt.budget.exceeded_count   — count of 429 budget errors per hour
mkt.freshness.violations    — count of freshness SLA breaches per hour
```

### 12.2 Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|---------|
| L2 hit rate | < 70% | < 50% |
| Quote age P99 (market hours) | > 60s | > 120s |
| Aggregator WS disconnected | — | > 30s |
| MCP circuit breaker OPEN | any | — |
| Screener lock timeout rate | > 5% | > 20% |
| Redis memory usage | > 70% | > 90% |

---

## 13. Implementation Notes for LLM

When implementing this module, follow this order:

1. **Redis key namespace**: Implement `deriveKey(namespace, discriminator, ...parts)` helper first. All cache operations use it.
2. **`CacheLayer.Get()`**: Implement the three-tier read (§3.4) as a single reusable function used by all data endpoints.
3. **Quote Aggregator**: Implement as a goroutine inside the main Go binary. Uses `gorilla/websocket` or `nhooyr.io/websocket` for Yahoo (Protobuf over WSS) and Binance (JSON streams). Writes directly to L1 (`sync.Map`) and L2 (local Redis) — no Pub/Sub needed.
4. **Screener deduplication**: Implement Redis-based distributed lock (§5.2) before exposing `/api/v1/market/screener`. At ~25 users, lock contention is rare but still necessary for correctness.
5. **Freshness headers**: Add HTTP middleware that reads `X-Data-Age-Seconds` from `CacheLayer.Get()` result and sets response headers. Runs on every response.
6. **Cost attribution**: `attributeMCPCost(userId, tool, amount)` is async fire-and-forget (goroutine). Never block request on attribution write.
7. **Fallback behavior**: Every `mcpCall()` wrapper must catch errors and check for stale L2 before throwing. Stale data with `X-Data-Source: stale` header is always preferred over a 503.
8. **Testing**: Use `miniredis` (Go) for unit tests. Integration tests must verify: (a) three cache tiers are checked in order, (b) screener coalescing fires when two requests have identical params within 5 min, (c) freshness headers appear on every response.
