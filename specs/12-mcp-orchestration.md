# PRD-12: MCP Orchestration Layer

## Overview

Central orchestration layer for all DailyTickers MCP Gateway calls. Handles tool invocation,
job polling, caching, rate limiting, retry logic, and graceful degradation.

---

## 1. Gateway Configuration

```
Endpoint:  https://gateway.dailytickers.com/mcp
Protocol:  JSON-RPC 2.0 over HTTPS POST
Env var:   MCP_GATEWAY_URL

Transport headers:
  Content-Type: application/json
  Accept:       application/json
```

**Critical rule**: If `MCP_GATEWAY_URL` is not set in production, `refresh-risk-metrics.js`
exits with code 2. It MUST NOT silently stub the output file. The `--stub` flag must be
passed explicitly to acknowledge writing an empty schema:

```bash
# Production (required):
MCP_GATEWAY_URL=https://gateway.dailytickers.com/mcp node tools/refresh-risk-metrics.js

# Explicit stub (CI / offline):
node tools/refresh-risk-metrics.js --stub

# Never silently degrade — this is a hard error:
node tools/refresh-risk-metrics.js   # exits 2 if MCP_GATEWAY_URL not set
```

---

## 2. JSON-RPC Call Pattern

```javascript
async function jsonrpcCall(toolName, params) {
  const payload = {
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'tools/call',
    params: { name: toolName, arguments: params },
  };
  // POST to GATEWAY, parse response
  // Returns: response.result.content[0].text parsed as JSON
}
```

**Response unwrapping**:
```javascript
// MCP gateway wraps results:
// { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: "{...}" }] } }
const text = response.result.content[0].text;
return JSON.parse(text);
```

---

## 3. MCP Tool Catalog

| Tool | Phase | Purpose | Async? |
|---|---|---|---|
| `GetMarketOverview` | 1 | Market regime, VIX, indices, trending, sectors, calendar | No |
| `RunAutoScreener` | 1 | Auto-adaptive screener with regime detection | Yes (job_id) |
| `RunScreener` | 1 | DSL custom screener (6 strategies) | Yes (job_id) |
| `CheckJobStatus` | 1 | Poll async screener job status | No |
| `QueryData` | 2–3 | 58 data types (quote, sentiment, filings, etc.) | No |
| `GetRegimeProbability` | 3 | 4-state regime model (ensemble) | No |
| `GetCorrelationMatrix` | 3 | Pairwise correlation analysis | No |
| `GetEarningsCalendarFiltered` | 3 | Earnings calendar with expected move filter | No |
| `OptimizeSizing` | 3 | Position sizing optimization | No |
| `CalculatePortfolioVaR` | 5 | Value at Risk (historical, 5-day, 95%/99%) | No |
| `GetPortfolioStressTest` | 5 | Preset stress test scenarios | No |

---

## 4. Tool Parameter Specifications

### 4.1 `GetMarketOverview`

```json
{ "depth": "deep" }
```

Response fields consumed:
- `trending` — array of trending topics/tickers
- `sector_variations` — sector ETF % changes
- `economic_calendar` — upcoming events with dates
- `earnings_calendar` — upcoming earnings with expected move %
- `indices` — SPY, QQQ, DIA, IWM, VIX values
- `sentiment` — overall market sentiment score
- `news` — top market-moving headlines

### 4.2 `RunAutoScreener`

```json
{ "regime": "RISK-ON", "horizon": 5 }
```

Returns: `{ "job_id": "abc123" }` — poll via `CheckJobStatus`.

### 4.3 `RunScreener`

```json
{
  "dsl": "score >= 88 AND strategy IN ('breakout','momentum') AND market_cap > 1e9",
  "universe": "US",
  "max_results": 20
}
```

DSL strategies used in scanner pipeline:
1. Momentum + Breakout US large-cap
2. Pre-squeeze setups (low RVOL, compression)
3. Pullback to support (mean reversion)
4. EU universe (European large-caps)
5. APAC universe (Asian markets)
6. Sector ETF rotation

Returns: `{ "job_id": "xyz789" }` — poll via `CheckJobStatus`.

### 4.4 `CheckJobStatus`

```json
{ "job_id": "abc123" }
```

Response:
```json
{
  "status": "completed",
  "results": [
    {
      "ticker": "NVDA",
      "score": 94,
      "strategy": "Momentum",
      "entry": 875.0,
      "stop": 848.0,
      "tp1": 925.0,
      "tp2": 960.0,
      "rr": "1:1.5"
    }
  ]
}
```

Status values: `"pending"` | `"completed"` | `"failed"`.

### 4.5 `QueryData`

```json
{
  "symbols": ["NVDA", "AAPL", "MSFT"],
  "types": ["quote", "social_sentiment", "capital_flow", "insider_transactions",
            "dark_pool", "unusual_options", "ftd_threshold", "sec_filings", "flags"],
  "days": 180
}
```

**Mandatory types** for every scanner ticker: `social_sentiment`, `capital_flow`.

**Dilution filter types**: `sec_filings`, `flags` with `days=180`.

**Batch size**: 4–6 symbols per call to stay within gateway limits.

Supported `types` (58 total, key subset):
```
quote, bars_daily, bars_intraday, financials, stats,
social_sentiment, capital_flow, sentiment_overall, trading_signals,
analyst_actions, insider_transactions, ctb, news, options_chain,
support_resistance, volume_profile, earnings_quarterly, holders,
dark_pool, unusual_options, ftd_threshold, sec_filings, flags
```

**Dilution disqualification logic** (applied to `flags` response per ticker):
```javascript
function isDilutionRisk(flags) {
  if (flags.dilution_risk_score >= 70) return 'HIGH';
  if (flags.shelf_active && flags.dilution_risk_score >= 40) return 'MEDIUM';
  if (flags.atm_program_active) return 'HIGH';
  if (flags.aggressive_underwriter) return 'HIGH';
  if (flags.warrants_outstanding && flags.warrant_proximity < 0.20) return 'HIGH';
  if (flags.recent_pipe) return 'MEDIUM';    // PIPE < 180 days
  if (flags.reverse_split_recent) return 'MEDIUM'; // reverse split < 180 days
  if (flags.dilution_risk_score >= 40) return 'MEDIUM';
  return 'NONE';
}
// HIGH → disqualify from scanner
// MEDIUM → -15 pts + add flag in Invalidations section
```

Aggressive underwriters (auto-disqualify if present):
`H.C. Wainwright`, `Maxim Group`, `Dawson James`, `Roth Capital`, `Ladenburg Thalmann`

### 4.6 `GetRegimeProbability`

```json
{ "model": "ensemble", "horizon": 5 }
```

Response:
```json
{
  "currentState": "RISK-ON",
  "probabilities": {
    "risk_on": 0.72,
    "neutral": 0.15,
    "early_risk_off": 0.10,
    "crisis": 0.03
  },
  "transition5d": {
    "risk_on": 0.68,
    "neutral": 0.18,
    "early_risk_off": 0.11,
    "crisis": 0.03
  },
  "expectedReturnSpyPct": 0.8,
  "expectedDrawdownPct": -1.2
}
```

**Risk gating rules**:
- `crisis > 0.30` → reduce top to 5 tickers, breakout_only filter, position size × 0.5
- `early_risk_off > 0.50` → same as above

### 4.7 `GetCorrelationMatrix`

```json
{
  "symbols": ["NVDA", "AAPL", "MSFT", "GOOGL"],
  "window": 60,
  "method": "pearson"
}
```

Response:
```json
{
  "matrix": {
    "NVDA": { "AAPL": 0.72, "MSFT": 0.68, "GOOGL": 0.61 },
    "AAPL": { "MSFT": 0.81, "GOOGL": 0.74 }
  },
  "max_pair": { "a": "AAPL", "b": "MSFT", "rho": 0.81 },
  "avg_off_diagonal": 0.69
}
```

**Correlation gating rules**:
- `max_pair.rho > 0.85` → drop the lower-scoring ticker of the pair
- `avg_off_diagonal > 0.65` → enforce minimum 2 different sectors in top 10

### 4.8 `GetEarningsCalendarFiltered`

```json
{ "days_ahead": 7, "min_expected_move": 4.0 }
```

Response:
```json
{
  "earnings": [
    {
      "ticker": "NVDA",
      "date": "20260514",
      "expected_move_pct": 8.2,
      "in_exclusion_window": true
    }
  ]
}
```

**Disqualification rule**: if `ticker` is in `exclusion_window` → disqualify OR tag "earnings risk".
Exclusion window: `±3 days` around earnings date (5 business days total).

### 4.9 `OptimizeSizing`

```json
{
  "mode": "balanced",
  "method": "vol_target",
  "max_position_risk_pct": 1.0,
  "max_pairwise_correlation": 0.7,
  "positions": [
    { "ticker": "NVDA", "entry": 875, "stop": 848, "atr14": 22.5 }
  ]
}
```

Response:
```json
{
  "positions": [
    { "ticker": "NVDA", "risk_pct": 0.87, "alloc_pct": 28.1 }
  ],
  "portfolio_risk_pct": 0.87
}
```

Use `risk_pct` per position to calibrate position sizes in Orders to Place.

### 4.10 `CalculatePortfolioVaR`

```json
{
  "portfolio_value": 100000,
  "returns": "[0.012, -0.008, 0.003, ...]",
  "confidence_level": 0.95,
  "horizon": 5,
  "method": "historical"
}
```

Response (field aliases handled):
```json
{
  "totalVaR": 2850.00,
  "expectedShortfall": 3600.00
}
```

Called twice per mode: once with `confidence_level: 0.95`, once with `0.99`.
`returns` field: JSON-stringified array of daily portfolio return floats (min 20 days).

### 4.11 `GetPortfolioStressTest`

```json
{
  "positions": "[{\"ticker\":\"NVDA\",\"weight\":0.33},{\"ticker\":\"AAPL\",\"weight\":0.33}]"
}
```

Response:
```json
{
  "scenarios": [
    { "name": "Covid Crash", "estimated_loss_pct": -8.2 },
    { "name": "2022 Bear",   "estimated_loss_pct": -5.1 },
    { "name": "Flash Crash", "estimated_loss_pct": -3.4 }
  ]
}
```

---

## 5. Async Job Polling Pattern

Used for `RunAutoScreener` and `RunScreener`:

```javascript
async function pollJob(jobId, timeoutMs = 120000, intervalMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await jsonrpcCall('CheckJobStatus', { job_id: jobId });
    if (status.status === 'completed') return status.results;
    if (status.status === 'failed') throw new Error(`Job ${jobId} failed`);
    // status === 'pending' — wait and retry
    await sleep(intervalMs);
  }
  throw new Error(`Job ${jobId} timed out after ${timeoutMs}ms`);
}

// On timeout or failure → fallback to GetMarketOverview top movers
async function screenerWithFallback(params) {
  try {
    const { job_id } = await jsonrpcCall('RunAutoScreener', params);
    return await pollJob(job_id);
  } catch (err) {
    console.warn(`[MCP] Screener failed: ${err.message} — falling back to market overview movers`);
    const overview = await jsonrpcCall('GetMarketOverview', { depth: 'deep' });
    return overview.trending?.slice(0, 20) ?? [];
  }
}
```

---

## 6. Rate Limiting

```javascript
const MAX_CONCURRENT = 10;  // max parallel MCP calls

// pMapLimit implementation (used in gen-status-page.js):
async function pMapLimit(items, limit, fn) {
  const results = [];
  const executing = new Set();
  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item)).then(r => {
      executing.delete(p);
      return r;
    });
    executing.add(p);
    results.push(p);
    if (executing.size >= limit) await Promise.race(executing);
  }
  return Promise.all(results);
}
```

BatchQueryData — group tickers in batches of 4–6:
```javascript
function batchSymbols(symbols, batchSize = 5) {
  const batches = [];
  for (let i = 0; i < symbols.length; i += batchSize) {
    batches.push(symbols.slice(i, i + batchSize));
  }
  return batches;
}
```

---

## 7. Retry Logic

```javascript
async function jsonrpcCallWithRetry(toolName, params, retries = 3) {
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await jsonrpcCall(toolName, params);
    } catch (err) {
      lastErr = err;
      if (attempt < retries - 1) {
        const delay = Math.pow(2, attempt) * 1000;  // 1s, 2s, 4s
        console.warn(`[MCP] ${toolName} attempt ${attempt + 1} failed: ${err.message}. Retrying in ${delay}ms`);
        await sleep(delay);
      }
    }
  }
  throw lastErr;
}
```

---

## 8. Timeout Configuration

| Scope | Timeout |
|---|---|
| Single MCP call (non-screener) | 30s |
| Screener job total wait | 120s |
| Screener poll interval | 5s |
| HTTP POST socket timeout | 30s |

---

## 9. Caching Layer

```javascript
const cache = new Map();

function cached(key, ttlMs, fn) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < ttlMs) return Promise.resolve(entry.value);
  return fn().then(value => {
    cache.set(key, { value, ts: Date.now() });
    return value;
  });
}

// TTL per tool:
const TTL = {
  GetRegimeProbability:     60 * 60 * 1000,   // 1 hour
  GetCorrelationMatrix:      4 * 60 * 60 * 1000, // 4 hours
  GetEarningsCalendarFiltered: 60 * 60 * 1000, // 1 hour
  QueryData_quote:           5 * 60 * 1000,    // 5 minutes
  QueryData_social_sentiment:30 * 60 * 1000,   // 30 minutes
  GetMarketOverview:        30 * 60 * 1000,    // 30 minutes
};

// Usage:
const regime = await cached('regime', TTL.GetRegimeProbability,
  () => jsonrpcCallWithRetry('GetRegimeProbability', { model: 'ensemble', horizon: 5 })
);
```

---

## 10. `refresh-risk-metrics.js` Flow

Called as step 3 of the daily pipeline: computes and writes `data/risk-snapshots.json`.

```
Input:  scanner/status/history/{latest}.json  (open positions per mode)
Output: data/risk-snapshots.json
```

```javascript
// Execution order per mode:
async function refreshMode(modeId, positions) {
  const out = { asOf: new Date().toISOString() };

  // Step 1: Compute portfolio returns time-series
  const returns = await fetchPortfolioReturns(positions.symbols, positions.weights, 252);

  // Step 2: VaR 95%
  if (returns.length >= 20) {
    const var95 = await jsonrpcCall('CalculatePortfolioVaR', {
      portfolio_value: PORTFOLIO_VALUE_USD,
      returns: JSON.stringify(returns),
      confidence_level: 0.95, horizon: 5, method: 'historical',
    });
    out.var95_5d               = validateVar(var95?.totalVaR ?? var95?.value_at_risk);
    out.expectedShortfall95_5d = validateVar(var95?.expectedShortfall ?? var95?.expected_shortfall);
    out.method = 'historical';

    // Step 3: VaR 99%
    const var99 = await jsonrpcCall('CalculatePortfolioVaR', {
      portfolio_value: PORTFOLIO_VALUE_USD,
      returns: JSON.stringify(returns),
      confidence_level: 0.99, horizon: 5, method: 'historical',
    });
    out.var99_5d = validateVar(var99?.totalVaR ?? var99?.value_at_risk);
  }

  // Step 4: Stress test
  const stress = await jsonrpcCall('GetPortfolioStressTest', {
    positions: JSON.stringify(positions.weighted),
  });
  out.stressScenarios = stress.scenarios;

  // Step 5: Correlation (open positions only)
  const corr = await jsonrpcCall('GetCorrelationMatrix', {
    symbols: positions.symbols, window: 60, method: 'pearson',
  });
  out.maxPairwiseCorrelation = corr.max_pair?.rho ?? null;
  out.avgCorrelation         = corr.avg_off_diagonal ?? null;

  return out;
}

// Regime: single call shared across all modes
const regime = await jsonrpcCall('GetRegimeProbability', { model: 'ensemble', horizon: 5 });
```

### Output Schema (`data/risk-snapshots.json`)

```json
{
  "asOf": "2026-05-07T08:00:00.000Z",
  "portfolioValueUsd": 100000,
  "snapshotDate": "20260507",
  "regimeProbability": {
    "currentState": "RISK-ON",
    "probabilities": {
      "risk_on": 0.72, "neutral": 0.15,
      "early_risk_off": 0.10, "crisis": 0.03
    },
    "transition5d": {
      "risk_on": 0.68, "neutral": 0.18,
      "early_risk_off": 0.11, "crisis": 0.03
    },
    "expectedReturnSpyPct": 0.8,
    "expectedDrawdownPct": -1.2
  },
  "modes": {
    "balanced": {
      "asOf": "2026-05-07T08:00:00.000Z",
      "var95_5d": 2850.00,
      "var99_5d": 4120.00,
      "expectedShortfall95_5d": 3600.00,
      "portfolioValueUsd": 100000,
      "stressScenarios": [
        { "name": "Covid Crash", "estimated_loss_pct": -8.2 },
        { "name": "2022 Bear",   "estimated_loss_pct": -5.1 },
        { "name": "Flash Crash", "estimated_loss_pct": -3.4 }
      ],
      "maxPairwiseCorrelation": 0.42,
      "avgCorrelation": 0.28,
      "method": "historical"
    },
    "turbo": null,
    "dynamic": { "..." : "..." }
  },
  "_schema": {
    "asOf": "ISO-8601",
    "modes": "<modeId>: { asOf, var95_5d, var99_5d, expectedShortfall95_5d, portfolioValueUsd, stressScenarios[], maxPairwiseCorrelation, avgCorrelation, method }",
    "regimeProbability": "{ currentState, probabilities{risk_on,neutral,early_risk_off,crisis}, transition5d, expectedReturnSpyPct, expectedDrawdownPct }"
  }
}
```

Mode value is `null` when positions are empty (< 1 position) or when returns data is insufficient (< 20 days).

### Stub Schema (written by `--stub` flag)

```json
{
  "asOf": "ISO-8601",
  "portfolioValueUsd": 100000,
  "regimeProbability": null,
  "modes": {
    "turbo": null, "dynamic": null, "balanced": null,
    "secured": null, "fortress": null, "tkl": null
  },
  "_schema": { "..." : "..." }
}
```

---

## 11. Graceful Degradation Contract

| Failure | Behavior |
|---|---|
| `MCP_GATEWAY_URL` not set, no `--stub` | `process.exit(2)` — hard error |
| `MCP_GATEWAY_URL` not set + `--stub` | Write empty stub schema, exit 0 |
| Gateway HTTP error (any 4xx/5xx) | Retry 3× with backoff; on final failure: log warn, `mode[id] = null` |
| VaR insufficient data (< 20 returns) | Skip VaR call, log warn, `var95_5d = null` |
| Screener job timeout (> 120s) | Fall back to `GetMarketOverview` top movers |
| Screener job failed | Same fallback as timeout |
| `QueryData` partial failure | Log warn per failed ticker; continue pipeline with available data |
| All MCP calls fail for a mode | `modes[modeId] = null` in risk-snapshots.json |
| `gen-api.js` reads null mode risk | Sets `status: "pending"` in `risk.json`, all numerics null |

**Atomic writes**: `risk-snapshots.json` written via temp file + rename to prevent corrupt reads:
```javascript
function _writeAtomic(outPath, content) {
  const tmp = outPath + '.tmp.' + Date.now();
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, outPath);
}
```

---

## 12. Scanner Pipeline Integration

The orchestrator is invoked at these pipeline phases:

**Phase 1 — Screener** (scanner script / MCP tool calls from Claude):
```
RunAutoScreener({ regime, horizon: 5 }) → job_id
RunScreener(dsl_1) ... RunScreener(dsl_6) → job_ids
CheckJobStatus(each job_id) every 5s → results
GetMarketOverview({ depth: 'deep' }) → regime context, calendar
```

**Phase 2 — Enrich top candidates** (QueryData batch):
```
QueryData({ symbols: batch, types: ['quote','social_sentiment','capital_flow',
  'insider_transactions','dark_pool','unusual_options','ftd_threshold','sec_filings','flags'],
  days: 180 })
```

**Phase 3 — Risk layer** (post-screener, pre-finalization):
```
GetRegimeProbability({ model: 'ensemble', horizon: 5 })
  → gating: crisis > 0.30 or early_risk_off > 0.50 → reduce to 5 tickers
GetCorrelationMatrix({ symbols: candidates, window: 60, method: 'pearson' })
  → dedup: rho > 0.85 → drop lower-scoring; avg > 0.65 → force 2+ sectors
GetEarningsCalendarFiltered({ days_ahead: 7, min_expected_move: 4 })
  → disqualify tickers in exclusion window
OptimizeSizing({ mode, method: 'vol_target', max_position_risk_pct: 1.0,
  max_pairwise_correlation: 0.7, positions: candidates })
  → use risk_pct per position for Orders to Place sizing
```

**Phase 5 — Risk refresh** (`tools/refresh-risk-metrics.js`, post-pipeline):
```
CalculatePortfolioVaR × 2 per mode (95% + 99%)
GetPortfolioStressTest per mode
GetCorrelationMatrix per mode
GetRegimeProbability (single shared call)
→ writes data/risk-snapshots.json
→ consumed by gen-api.js → risk.json endpoint
```

> **Unified Engine note**: MCP orchestration serves the scanner signal path (PRD-23 §4, `ScannerStrategy` adapter). Mechanical strategies (Go bridge) use their own data providers (Yahoo, Alpaca, BVC) and do not call MCP tools for signal generation. However, MCP tools remain the source for risk metrics (`GetRegimeProbability`, `GetCorrelationMatrix`, `OptimizeSizing`) which apply to ALL strategy slots regardless of signal source (PRD-23 §7).

<!-- Consistency pass: aligned with PRD-23 Unified Strategy Engine, 2026-05-07 -->
