# PRD-01: Market Data Collection

**Version**: 1.1  
**Depends on**: PRD-00 (System Overview), PRD-12 (MCP Orchestrator)  
**Consumed by**: PRD-02 (Signal Generation), PRD-23 (Unified Strategy Engine — scanner strategy data source)

---

## 1. Purpose

This module is the sole entry point for raw market data. It coordinates all MCP Gateway calls and Yahoo Finance fetches required to produce a complete, validated snapshot for a single scan session. The output is a structured `CollectionResult` object handed directly to PRD-02.

No scoring, filtering, or signal logic lives here. This module only collects and normalizes.

---

## 2. Inputs

| Input | Type | Source |
|-------|------|--------|
| `scanDate` | `YYYY-MM-DD` string | Scheduler (PRD-15) |
| `modeId` | `string` | Pipeline config |
| `mcpGatewayUrl` | `string` | Env: `MCP_GATEWAY_URL` |
| `corsProxy` | `string` | Env: `CORS_PROXY_URL`, default `https://api.allorigins.win/get` |

---

## 3. Output Schema — `CollectionResult`

```json
{
  "scanDate": "2026-05-07",
  "collectedAt": "2026-05-07T23:14:00Z",
  "marketOverview": { /* § 4.1 */ },
  "regime": { /* § 4.6 */ },
  "screenerCandidates": [ /* § 4.2–4.4 */ ],
  "tklCandidates": [ /* § 4.3 */ ],
  "enrichedData": { /* § 4.5 — keyed by ticker */ },
  "correlationMatrix": { /* § 4.7 */ },
  "earningsExclusions": [ /* § 4.8 */ ],
  "sizingOutput": { /* § 4.9 */ },
  "errors": [ /* § 7 */ ]
}
```

---

## 4. MCP Calls — Specification

### 4.1 `GetMarketOverview()`

**Purpose**: Regime snapshot, trending topics, sector variations, calendars.

**Call**:
```json
{
  "tool": "GetMarketOverview",
  "params": {}
}
```

**Response fields used**:
```json
{
  "vix": 18.4,
  "spx": { "last": 5210.0, "change_pct": -0.42 },
  "nasdaq": { "last": 18200.0, "change_pct": -0.61 },
  "regime": "NEUTRAL",
  "trending_topics": ["AI infrastructure", "Fed pause", "energy rotation"],
  "sector_variations": {
    "XLK": -0.8, "XLE": 1.2, "XLF": 0.1, "XLV": -0.3,
    "XLI": 0.5, "XLB": 0.2, "XLY": -0.6, "XLP": 0.3,
    "XLRE": -0.4, "XLU": 0.1, "XLC": -0.5
  },
  "economic_calendar": [
    { "date": "2026-05-08", "event": "CPI YoY", "impact": "high", "consensus": "3.2%" }
  ],
  "earnings_calendar": [
    { "ticker": "NVDA", "date": "2026-05-28", "expected_move_pct": 8.5 }
  ]
}
```

**Error handling**: If call fails or returns null → log `WARN:market_overview_failed`, set `marketOverview: null`, continue (non-blocking).

---

### 4.2 `RunAutoScreener()` — Async Job

**Purpose**: Auto-adaptive screener with built-in regime detection. Returns up to 50 candidates.

**Call**:
```json
{
  "tool": "RunAutoScreener",
  "params": {}
}
```

**Response** (async job initiation):
```json
{ "job_id": "auto-20260507-001", "status": "pending", "estimated_seconds": 30 }
```

**Polling**: Use `CheckJobStatus` (§ 4.4). Max 12 polls × 5s = 60s timeout.

**Result fields used** (after job completion):
```json
{
  "candidates": [
    {
      "ticker": "NVDA",
      "name": "NVIDIA Corp",
      "region": "US",
      "exchange": "NASDAQ",
      "market_cap": 2800000000000,
      "adv_usd": 4500000000,
      "close": 885.40,
      "rsi14": 58.3,
      "vol_ratio": 2.1,
      "atr14": 22.5,
      "atr28": 19.8,
      "sma20": 860.0,
      "sma50": 820.0,
      "strategy_hint": "momentum_expansion"
    }
  ],
  "regime_detected": "RISK-ON",
  "total_screened": 3200
}
```

---

### 4.3 `RunScreener(expression, region, top_k)` — 6 DSL Calls

Run all 6 screeners in parallel. Each returns synchronous results (no polling needed).

#### Main Pool Screeners (3)

| Label | Expression | Region | top_k |
|-------|-----------|--------|-------|
| `oversold_bounce` | `rsi14<35 && vol>sma(vol,20)*1.5` | `US,EU,APAC` | 20 |
| `momentum_expansion` | `close>sma(close,20) && vol>sma(vol,20)*2 && rsi14>50 && rsi14<75` | `US,EU,APAC` | 30 |
| `breakout_squeeze` | `close>sma(close,50) && atr(14)>atr(28)*1.2` | `US,EU,APAC` | 20 |

#### TKL Pool Screeners (3)

| Label | Expression | Region | top_k |
|-------|-----------|--------|-------|
| `tkl_momentum` | `close>sma(close,20) && vol>sma(vol,20)*1.8 && rsi14>55 && rsi14<72 && market_cap<5000000000` | `US` | 15 |
| `tkl_breakout` | `close>sma(close,50) && close>high_52w*0.95 && atr(14)>atr(28)*1.1 && market_cap<5000000000` | `US` | 15 |
| `tkl_volume_surge` | `vol>sma(vol,20)*3 && rsi14<70 && close>sma(close,10) && market_cap<2000000000` | `US` | 15 |

**Call template**:
```json
{
  "tool": "RunScreener",
  "params": {
    "expression": "<DSL string from table above>",
    "region": "<region string>",
    "top_k": 20
  }
}
```

**Response fields used** (same schema as RunAutoScreener candidates):
```json
{
  "results": [
    {
      "ticker": "CLSK",
      "name": "CleanSpark Inc",
      "region": "US",
      "exchange": "NASDAQ",
      "market_cap": 1200000000,
      "adv_usd": 85000000,
      "close": 14.22,
      "rsi14": 61.5,
      "vol_ratio": 3.1,
      "atr14": 0.72,
      "atr28": 0.65,
      "sma20": 13.40,
      "sma50": 12.80
    }
  ],
  "screener_label": "tkl_volume_surge",
  "count": 12
}
```

**Deduplication**: After collecting all 6 screener outputs, deduplicate by `ticker`. Preserve the `screener_label` of the first occurrence. Tag `source` field accordingly.

---

### 4.4 `CheckJobStatus(job_id)` — Polling Loop

Used only for async jobs (`RunAutoScreener`).

**Call**:
```json
{
  "tool": "CheckJobStatus",
  "params": { "job_id": "auto-20260507-001" }
}
```

**Response**:
```json
{
  "job_id": "auto-20260507-001",
  "status": "completed",
  "result": { /* same schema as RunAutoScreener result */ },
  "elapsed_ms": 18400
}
```

**Status values**: `pending` | `running` | `completed` | `failed` | `timeout`

**Polling algorithm**:
```
attempt = 0
max_attempts = 12
interval_ms = 5000

while attempt < max_attempts:
  wait(interval_ms)
  response = CheckJobStatus(job_id)
  if response.status == "completed": return response.result
  if response.status in ["failed", "timeout"]: throw JobFailedError(response)
  attempt++

throw PollTimeoutError("Auto screener timed out after 60s")
```

**Fallback on PollTimeoutError**: Continue pipeline using only the 6 `RunScreener` results. Log `WARN:auto_screener_timeout`.

---

### 4.5 `QueryData(symbols, types, days)` — Enrichment

Run **after** deduplication, on the merged candidate list (main pool + TKL pool, up to 60 tickers).

Batch into groups of 10 tickers. Run groups in parallel (max 6 concurrent requests).

**Call**:
```json
{
  "tool": "QueryData",
  "params": {
    "symbols": ["NVDA", "AMD", "MSFT", "AAPL", "META", "GOOGL", "AMZN", "TSM", "ASML", "AMAT"],
    "types": [
      "quote",
      "social_sentiment",
      "capital_flow",
      "insider_transactions",
      "dark_pool",
      "unusual_options",
      "ftd_threshold",
      "sec_filings",
      "flags",
      "bars_daily",
      "support_resistance"
    ],
    "days": 180
  }
}
```

**Response schema** (per ticker):
```json
{
  "NVDA": {
    "quote": {
      "last": 885.40,
      "bid": 885.00,
      "ask": 885.80,
      "spread_pct": 0.09,
      "change_pct": 1.24,
      "volume": 48200000,
      "avg_volume_20d": 42000000,
      "market_cap": 2800000000000,
      "adv_usd": 4500000000
    },
    "social_sentiment": {
      "stocktwits_bullish_pct": 72,
      "reddit_mentions_7d": 1240,
      "sentiment_score": 0.68,
      "trend": "rising"
    },
    "capital_flow": {
      "net_flow_7d_usd": 1200000000,
      "institutional_buy_pct": 68,
      "retail_buy_pct": 32
    },
    "insider_transactions": [
      {
        "date": "2026-04-28",
        "type": "buy",
        "shares": 10000,
        "value_usd": 8854000,
        "insider_role": "CFO"
      }
    ],
    "dark_pool": {
      "dark_pool_pct": 42.1,
      "dp_volume_7d": 180000000,
      "dp_trend": "accumulation"
    },
    "unusual_options": {
      "call_put_ratio": 2.4,
      "large_call_sweeps": 3,
      "large_put_sweeps": 0,
      "put_call_ratio": 0.42,
      "unusual_flag": true
    },
    "ftd_threshold": {
      "on_threshold_list": false,
      "ftd_count_30d": 0
    },
    "sec_filings": [
      {
        "type": "10-K",
        "date": "2026-02-15",
        "url": "https://sec.gov/..."
      }
    ],
    "flags": {
      "dilution_risk_score": 12,
      "shelf_active": false,
      "atm_program_active": false,
      "aggressive_underwriter": false,
      "warrants_outstanding": false,
      "warrants_itm_proximity": null,
      "recent_pipe": false,
      "pipe_date": null,
      "reverse_split_recent": false,
      "reverse_split_date": null
    },
    "bars_daily": [
      { "date": "2026-05-06", "open": 870.0, "high": 890.0, "low": 868.0, "close": 885.4, "volume": 48200000 }
    ],
    "support_resistance": {
      "support_1": 850.0,
      "support_2": 820.0,
      "resistance_1": 910.0,
      "resistance_2": 950.0
    }
  }
}
```

**Error handling per ticker**: If a ticker returns a partial response (missing types), mark the missing types as `null` in the enriched object. Do not abort the entire batch. Log `WARN:query_data_partial:{ticker}:{missing_types}`.

---

### 4.6 `GetRegimeProbability(model, horizon)` — Regime State

**Call**:
```json
{
  "tool": "GetRegimeProbability",
  "params": {
    "model": "ensemble",
    "horizon": 5
  }
}
```

**Response**:
```json
{
  "current_state": "NEUTRAL",
  "current_state_confidence": 0.61,
  "probabilities": {
    "risk_on": 0.28,
    "neutral": 0.61,
    "early_risk_off": 0.09,
    "risk_off": 0.01,
    "recovery": 0.01
  },
  "horizon_days": 5,
  "model": "ensemble",
  "vix_implied": 18.4
}
```

**5 regime states** (exhaustive): `RISK-ON` | `NEUTRAL` | `EARLY RISK-OFF` | `RISK-OFF` | `RECOVERY`

**Error handling**: If call fails → set `current_state: "NEUTRAL"`, `current_state_confidence: 0.0`, all probabilities `0.2`. Log `ERROR:regime_probability_failed`. Pipeline continues with conservative defaults.

---

### 4.7 `GetCorrelationMatrix(symbols, window, method)` — Pairwise Correlation

Called on final top-N candidates (after initial scoring in PRD-02, before risk gating in PRD-03). This call is **initiated here** but consumed in PRD-03.

**Call**:
```json
{
  "tool": "GetCorrelationMatrix",
  "params": {
    "symbols": ["NVDA", "AMD", "MSFT", "AAPL", "META", "GOOGL", "AMZN", "TSM", "ASML", "AMAT"],
    "window": 60,
    "method": "pearson"
  }
}
```

**Response**:
```json
{
  "matrix": {
    "NVDA": { "NVDA": 1.0, "AMD": 0.88, "MSFT": 0.62, "AAPL": 0.59 },
    "AMD":  { "NVDA": 0.88, "AMD": 1.0, "MSFT": 0.58, "AAPL": 0.55 }
  },
  "max_pair": { "a": "NVDA", "b": "AMD", "rho": 0.88 },
  "avg_off_diagonal": 0.51,
  "window": 60,
  "method": "pearson"
}
```

---

### 4.8 `GetEarningsCalendarFiltered(days_ahead, min_expected_move_pct)` — Earnings Exclusions

**Call**:
```json
{
  "tool": "GetEarningsCalendarFiltered",
  "params": {
    "days_ahead": 7,
    "min_expected_move_pct": 4
  }
}
```

**Response**:
```json
{
  "events": [
    {
      "ticker": "NVDA",
      "earnings_date": "2026-05-28",
      "expected_move_pct": 8.5,
      "exclusion_window_start": "2026-05-23",
      "exclusion_window_end": "2026-06-02"
    }
  ]
}
```

`exclusion_window_start` = earnings_date - 3 trading days  
`exclusion_window_end` = earnings_date + 3 trading days

---

### 4.9 `OptimizeSizing(mode, method, max_position_risk_pct, max_pairwise_correlation)` — Sizing

**Call**:
```json
{
  "tool": "OptimizeSizing",
  "params": {
    "mode": "balanced",
    "method": "vol_target",
    "max_position_risk_pct": 1.0,
    "max_pairwise_correlation": 0.7
  }
}
```

**Response**:
```json
{
  "allocations": {
    "NVDA": { "risk_pct": 0.85, "size_pct": 4.2 },
    "AMD":  { "risk_pct": 0.92, "size_pct": 3.8 }
  },
  "dropped_for_correlation": ["AMD"],
  "portfolio_risk_pct": 0.91,
  "method": "vol_target"
}
```

`dropped_for_correlation`: list of tickers excluded due to pairwise correlation > `max_pairwise_correlation`. These are hard-dropped in PRD-03.

---

## 5. Yahoo Finance — Direct Fetches

Used for live price validation and fundamentals. Always via CORS proxy.

### 5.1 Real-time Quote

```
GET https://api.allorigins.win/get?url=<encoded>
  where encoded = https://query1.finance.yahoo.com/v8/finance/chart/{TICKER}?interval=1d&range=5d
```

**Response handling**:
```javascript
const outer = await fetch(proxyUrl).then(r => r.json());
const yahoo = JSON.parse(outer.contents);
const meta = yahoo.chart.result[0].meta;
const quote = {
  last: meta.regularMarketPrice,
  previousClose: meta.chartPreviousClose,
  volume: meta.regularMarketVolume,
  marketCap: meta.marketCap
};
```

**Fallback**: If `allorigins.win` fails → try `https://corsproxy.io/?` prefix. If both fail → mark `yahoo_quote: null`, continue.

### 5.2 Fundamentals

```
GET https://api.allorigins.win/get?url=<encoded>
  where encoded = https://query1.finance.yahoo.com/v10/finance/quoteSummary/{TICKER}?modules=financialData,defaultKeyStatistics,summaryDetail
```

**Fields extracted**:
```json
{
  "debtToEquity": 14.5,
  "totalDebt": 8900000000,
  "marketCap": 2800000000000,
  "interestExpense": 120000000,
  "totalRevenue": 60920000000,
  "trailingPE": 42.3,
  "forwardPE": 28.1,
  "beta": 1.68
}
```

**Sharia ratios computed here**:
- `debt_to_market_cap = totalDebt / marketCap`
- `interest_revenue_ratio = interestExpense / totalRevenue`

Both values stored in `enrichedData[ticker].fundamentals` for use in PRD-02 Sharia tagging.

---

## 6. Caching Strategy

| Data Type | TTL | Key |
|-----------|-----|-----|
| `GetMarketOverview` | 30 minutes | `market_overview:{date}` |
| `RunAutoScreener` result | 2 hours | `auto_screener:{date}` |
| `RunScreener` result | 2 hours | `screener:{label}:{date}` |
| `QueryData` per ticker | 1 hour | `query_data:{ticker}:{date}` |
| `GetRegimeProbability` | 30 minutes | `regime:{date}` |
| `GetCorrelationMatrix` | 2 hours | `corr_matrix:{sorted_symbols}:{date}` |
| Yahoo Finance quote | 5 minutes | `yf_quote:{ticker}` |
| Yahoo Finance fundamentals | 24 hours | `yf_fundamentals:{ticker}` |

Cache backend: Redis (`REDIS_URL` env var). If Redis unavailable → in-memory Map with same TTLs, warn `WARN:redis_unavailable_using_memory`.

---

## 7. Error Handling & Graceful Degradation

```json
{
  "errors": [
    {
      "source": "RunAutoScreener",
      "error_type": "PollTimeoutError",
      "message": "Job auto-20260507-001 timed out after 60s",
      "severity": "WARN",
      "recovery": "Continuing with RunScreener results only"
    }
  ]
}
```

| Error Condition | Severity | Recovery Action |
|-----------------|----------|----------------|
| `GetMarketOverview` fails | WARN | Set null, continue |
| `RunAutoScreener` job times out | WARN | Use 6 `RunScreener` results only |
| `RunAutoScreener` job fails | WARN | Use 6 `RunScreener` results only |
| All `RunScreener` return 0 results | ERROR | Abort pipeline, notify operator |
| `QueryData` partial (some tickers missing) | WARN | Use available data, null for missing |
| `GetRegimeProbability` fails | ERROR | Default to NEUTRAL with confidence=0 |
| `GetCorrelationMatrix` fails | WARN | Skip correlation check in PRD-03 |
| `GetEarningsCalendar` fails | WARN | Skip earnings exclusion in PRD-03 |
| `OptimizeSizing` fails | WARN | Use flat 1% risk across all tickers |
| MCP Gateway unreachable | ERROR | Abort pipeline, alert via Telegram |
| MCP Gateway slow (>30s) | WARN | Log latency, continue |

**MCP_GATEWAY_URL validation**: At pipeline start, verify `MCP_GATEWAY_URL` env var is set. If missing → `ERROR:mcp_gateway_url_not_set` → abort immediately. Never accept stub mode silently.

---

## 8. Complete Call Sequence

```
T+0s   GetMarketOverview()                          [sync]
T+0s   RunAutoScreener()                            [async → job_id]
T+0s   RunScreener(oversold_bounce)                 [sync, parallel]
T+0s   RunScreener(momentum_expansion)              [sync, parallel]
T+0s   RunScreener(breakout_squeeze)                [sync, parallel]
T+0s   RunScreener(tkl_momentum)                    [sync, parallel]
T+0s   RunScreener(tkl_breakout)                    [sync, parallel]
T+0s   RunScreener(tkl_volume_surge)                [sync, parallel]
T+5s   CheckJobStatus(job_id) × up to 12 polls
T+35s  [All candidates merged and deduplicated]
T+35s  QueryData(batch_1_10_tickers, all_types)     [parallel batches]
T+35s  QueryData(batch_2_10_tickers, all_types)     [parallel batches]
       ... up to 6 batches in parallel
T+35s  Yahoo Finance fundamentals (parallel, all candidates)
T+55s  GetRegimeProbability(ensemble, 5)
T+55s  GetEarningsCalendarFiltered(7, 4)
T+60s  [PRD-02 initial scoring completes → top 10-15 candidates]
T+60s  GetCorrelationMatrix(top_candidates, 60, pearson)
T+60s  OptimizeSizing(balanced, vol_target, 1.0, 0.7)
T+75s  CollectionResult assembled → hand off to PRD-02
```

Total target latency: **< 90 seconds** from pipeline start to `CollectionResult` ready.

---

## 9. `CollectionResult` — Final Assembled Schema

```json
{
  "scanDate": "2026-05-07",
  "collectedAt": "2026-05-07T23:14:32Z",
  "marketOverview": {
    "vix": 18.4,
    "spx": { "last": 5210.0, "change_pct": -0.42 },
    "regime": "NEUTRAL",
    "trending_topics": ["AI infrastructure", "Fed pause"],
    "sector_variations": { "XLK": -0.8, "XLE": 1.2 },
    "economic_calendar": [],
    "earnings_calendar": []
  },
  "regime": {
    "current_state": "NEUTRAL",
    "current_state_confidence": 0.61,
    "probabilities": {
      "risk_on": 0.28, "neutral": 0.61,
      "early_risk_off": 0.09, "risk_off": 0.01, "recovery": 0.01
    }
  },
  "screenerCandidates": [
    {
      "ticker": "NVDA",
      "name": "NVIDIA Corp",
      "region": "US",
      "exchange": "NASDAQ",
      "market_cap": 2800000000000,
      "adv_usd": 4500000000,
      "close": 885.40,
      "rsi14": 58.3,
      "vol_ratio": 2.1,
      "atr14": 22.5,
      "atr28": 19.8,
      "sma20": 860.0,
      "sma50": 820.0,
      "source": "auto_screener",
      "strategy_hint": "momentum_expansion"
    }
  ],
  "tklCandidates": [
    {
      "ticker": "CLSK",
      "name": "CleanSpark Inc",
      "region": "US",
      "exchange": "NASDAQ",
      "market_cap": 1200000000,
      "adv_usd": 85000000,
      "close": 14.22,
      "rsi14": 61.5,
      "vol_ratio": 3.1,
      "atr14": 0.72,
      "atr28": 0.65,
      "sma20": 13.40,
      "sma50": 12.80,
      "source": "tkl_volume_surge"
    }
  ],
  "enrichedData": {
    "NVDA": {
      "quote": {},
      "social_sentiment": {},
      "capital_flow": {},
      "insider_transactions": [],
      "dark_pool": {},
      "unusual_options": {},
      "ftd_threshold": {},
      "sec_filings": [],
      "flags": {},
      "bars_daily": [],
      "support_resistance": {},
      "fundamentals": {
        "debtToEquity": 14.5,
        "totalDebt": 8900000000,
        "marketCap": 2800000000000,
        "interestExpense": 120000000,
        "totalRevenue": 60920000000,
        "debt_to_market_cap": 0.003,
        "interest_revenue_ratio": 0.002
      }
    }
  },
  "correlationMatrix": {
    "matrix": {},
    "max_pair": { "a": "NVDA", "b": "AMD", "rho": 0.88 },
    "avg_off_diagonal": 0.51
  },
  "earningsExclusions": [
    {
      "ticker": "NVDA",
      "earnings_date": "2026-05-28",
      "exclusion_window_start": "2026-05-23",
      "exclusion_window_end": "2026-06-02"
    }
  ],
  "sizingOutput": {
    "allocations": {},
    "dropped_for_correlation": ["AMD"]
  },
  "errors": []
}
```

<!-- Consistency pass: aligned with PRD-23 Unified Strategy Engine, 2026-05-07 -->
