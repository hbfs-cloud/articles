# PRD-20: MCP Server — Strategy Analysis

## Overview

Dedicated MCP server exposing strategy research and backtesting capabilities to LLM agents
(Claude, GPT) and internal pipeline tools. Allows agents to request backtests, optimizations,
and strategy comparisons via the MCP protocol without direct filesystem or database access.

**Server endpoint**: `http://autotrader.dailytickers.com/mcp/strategy/`
**Protocol**: JSON-RPC 2.0 over HTTPS POST
**Auth**: Service account bearer token (`STRATEGY_MCP_TOKEN` env var)
**Scope**: Internal only — not exposed to end users. Accessible via admin dashboard and
           authorized LLM agents registered with the platform.

---

## 1. Server Configuration

```
Endpoint:     http://autotrader.dailytickers.com/mcp/strategy/
Protocol:     JSON-RPC 2.0 (same transport as gateway.dailytickers.com/mcp)
Auth header:  Authorization: Bearer <STRATEGY_MCP_TOKEN>
Content-Type: application/json
Accept:       application/json, text/event-stream
```

**Environment variables**:

| Variable | Required | Description |
|---|---|---|
| `STRATEGY_MCP_TOKEN` | Yes | Service account token for authentication |
| `STRATEGY_MCP_URL` | Yes | Server base URL (set per environment) |
| `BACKTEST_MAX_CONCURRENT` | No | Max parallel backtest jobs (default: 10) |
| `BACKTEST_CACHE_TTL_SECONDS` | No | Result cache TTL (default: 3600) |
| `BACKTEST_JOB_TIMEOUT_MS` | No | Per-job timeout (default: 120000) |

**JSON-RPC call pattern** (identical to PRD-12 gateway pattern):

```javascript
async function strategyMcpCall(toolName, params) {
  const payload = {
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'tools/call',
    params: { name: toolName, arguments: params },
  };
  const res = await fetch(process.env.STRATEGY_MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${process.env.STRATEGY_MCP_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (json.error) throw new Error(`MCP error ${json.error.code}: ${json.error.message}`);
  return JSON.parse(json.result.content[0].text);
}
```

---

## 2. Async Job Pattern

Long-running tools (RunBacktest, OptimizeStrategy, WalkForwardValidate) use an async job
pattern to avoid HTTP timeouts.

**Flow**:
1. Initial call returns `{ job_id, status: "queued", estimated_seconds }` immediately.
2. Caller polls `CheckJobStatus({ job_id })` until `status` is `"completed"` or `"failed"`.
3. On `"completed"`, the result is embedded in the status response under `result`.
4. Results are cached by `(tool + canonical_params_hash)` for `BACKTEST_CACHE_TTL_SECONDS`.

**Job lifecycle states**: `queued` → `running` → `completed` | `failed` | `timeout`

```javascript
// Polling helper (caller-side)
async function pollJob(jobId, intervalMs = 3000, maxWaitMs = 120000) {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const status = await strategyMcpCall('CheckJobStatus', { job_id: jobId });
    if (status.status === 'completed') return status.result;
    if (status.status === 'failed') throw new Error(status.error);
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`Job ${jobId} timed out after ${maxWaitMs}ms`);
}
```

**CheckJobStatus schema**:
```json
{
  "name": "CheckJobStatus",
  "description": "Poll the status of an async strategy job",
  "inputSchema": {
    "type": "object",
    "required": ["job_id"],
    "properties": {
      "job_id": { "type": "string", "format": "uuid" }
    }
  }
}
```

**Response**:
```json
{
  "job_id": "uuid",
  "status": "completed",
  "created_at": "2026-05-07T10:00:00Z",
  "completed_at": "2026-05-07T10:00:45Z",
  "elapsed_seconds": 45,
  "result": { ... },
  "cached": false
}
```

---

## 3. Rate Limits

| Limit | Value |
|---|---|
| Max concurrent backtest jobs (server-wide) | 10 |
| Max backtest jobs per service account per hour | 5 |
| Max OptimizeStrategy combos per call | 1000 |
| Max strategies in CompareStrategies | 5 |
| Max date range | 365 days |
| Result cache TTL | 3600 seconds |

When `BACKTEST_MAX_CONCURRENT` is saturated, new jobs are queued (not rejected). Queue depth
limit: 50. If exceeded, return error code `-32000` with message `"Queue full: retry in 60s"`.

---

## 4. Tool Schemas

### 4.1 `RunBacktest`

Runs a full backtest using sweep.js internals against historical scanner signals.

**MCP tool definition**:
```json
{
  "name": "RunBacktest",
  "description": "Run a backtest for a given mode and config over a date range. Returns equity curve, per-trade results, and aggregate metrics. Long-running: returns job_id, poll CheckJobStatus.",
  "inputSchema": {
    "type": "object",
    "required": ["mode", "date_range"],
    "properties": {
      "mode": {
        "type": "string",
        "enum": ["turbo", "dynamic", "balanced", "secured", "fortress", "tkl"],
        "description": "Base mode to backtest"
      },
      "config_override": {
        "type": "object",
        "description": "Partial config overrides applied on top of modes-config.json for this mode",
        "properties": {
          "portfolioSize":     { "type": "integer", "minimum": 1, "maximum": 20 },
          "minScore":          { "type": "number",  "minimum": 50, "maximum": 100 },
          "horizon":           { "type": "integer", "minimum": 1, "maximum": 30 },
          "stopLossPct":       { "type": "number",  "minimum": 0.01, "maximum": 0.30 },
          "tp1Pct":            { "type": "number",  "minimum": 0.01, "maximum": 0.50 },
          "tp2Pct":            { "type": "number",  "minimum": 0.01, "maximum": 1.00 },
          "rotationEnabled":   { "type": "boolean" },
          "filterName":        { "type": "string",  "description": "Named filter preset (e.g. momentum_only, breakout_only)" }
        },
        "additionalProperties": false
      },
      "date_range": {
        "type": "object",
        "required": ["from", "to"],
        "properties": {
          "from": { "type": "string", "format": "date", "description": "YYYY-MM-DD inclusive" },
          "to":   { "type": "string", "format": "date", "description": "YYYY-MM-DD inclusive" }
        }
      },
      "signals_source": {
        "type": "string",
        "enum": ["production", "archive"],
        "default": "production",
        "description": "production = scanner signals from scanner-positions.json history; archive = raw daily JSON archives"
      }
    },
    "additionalProperties": false
  }
}
```

**Returns** (via `CheckJobStatus.result`):
```json
{
  "mode": "balanced",
  "config_used": {
    "portfolioSize": 3,
    "minScore": 88,
    "horizon": 5,
    "stopLossPct": 0.05,
    "tp1Pct": 0.08,
    "tp2Pct": 0.15
  },
  "metrics": {
    "return_total":    35.2,
    "return_annualized": 142.0,
    "max_dd":          -4.1,
    "win_rate":        60.0,
    "profit_factor":   4.68,
    "sharpe":          2.1,
    "sortino":         3.4,
    "trades":          42,
    "avg_hold_days":   4.2,
    "avg_win_pct":     8.7,
    "avg_loss_pct":    -3.1,
    "expectancy_pct":  3.85
  },
  "equity_curve": [
    { "date": "20260215", "value": 100.00 },
    { "date": "20260216", "value": 101.23 }
  ],
  "trades": [
    {
      "ticker":      "NVDA",
      "entry_date":  "20260215",
      "exit_date":   "20260220",
      "entry_price": 120.50,
      "exit_price":  130.10,
      "pnl_pct":     7.97,
      "status":      "tp1",
      "hold_days":   5,
      "score":       93,
      "regime":      "RISK-ON"
    }
  ],
  "regime_breakdown": {
    "RISK-ON":       { "trades": 30, "win_rate": 66.7, "return_total": 28.5 },
    "RISK-OFF":      { "trades": 12, "win_rate": 41.7, "return_total": 6.7  }
  }
}
```

**Relationship to sweep.js**: The server calls `sweep.js` internals via a programmatic API
(not CLI). `sweep.js` exports `computeStatsFromTrades(trades, config)` and
`runBacktestForConfig(mode, config, dateRange, signalsSource)`. The MCP tool wraps these
functions, applies `config_override` on top of `modes-config.json[mode]`, and serializes
results. The `filterName` param maps to named filter presets defined in `sweep.js`:

```javascript
const FILTER_PRESETS = {
  momentum_only:  t => t.strategy === 'Momentum',
  breakout_only:  t => t.strategy === 'Breakout',
  all:            t => true,
};
```

---

### 4.2 `OptimizeStrategy`

Grid search over a parameter space to find the optimal config for a mode.

```json
{
  "name": "OptimizeStrategy",
  "description": "Grid search over strategy parameters to maximize an objective function. Long-running: returns job_id.",
  "inputSchema": {
    "type": "object",
    "required": ["base_mode", "dimensions", "objective"],
    "properties": {
      "base_mode": {
        "type": "string",
        "enum": ["turbo", "dynamic", "balanced", "secured", "fortress", "tkl"]
      },
      "dimensions": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["param", "values"],
          "properties": {
            "param":  { "type": "string", "description": "Parameter name from modes-config.json" },
            "values": { "type": "array",  "description": "Discrete values to grid-search over" }
          }
        },
        "description": "Parameters and their candidate values. Total combos = product of all value arrays, capped at max_combos."
      },
      "constraints": {
        "type": "object",
        "properties": {
          "max_dd":       { "type": "number", "description": "Reject configs where max_dd exceeds this (absolute pct, e.g. 5.0)" },
          "min_win_rate": { "type": "number", "description": "Reject configs below this win rate (0-100)" },
          "min_trades":   { "type": "integer","description": "Reject configs with fewer trades (statistical significance)" }
        }
      },
      "objective": {
        "type": "string",
        "enum": ["sharpe", "profit_factor", "return_total", "win_rate", "expectancy"],
        "description": "Metric to maximize"
      },
      "max_combos": {
        "type": "integer",
        "default": 1000,
        "maximum": 1000,
        "description": "Cap on total combinations evaluated"
      },
      "date_range": {
        "type": "object",
        "required": ["from", "to"],
        "properties": {
          "from": { "type": "string", "format": "date" },
          "to":   { "type": "string", "format": "date" }
        }
      }
    },
    "additionalProperties": false
  }
}
```

**Returns**:
```json
{
  "combos_evaluated": 720,
  "combos_rejected_by_constraints": 45,
  "elapsed_seconds": 38,
  "optimal": {
    "config": { "portfolioSize": 3, "minScore": 88, "horizon": 5 },
    "metrics": { "sharpe": 2.41, "win_rate": 63.2, "return_total": 38.1, "max_dd": -3.9 }
  },
  "top_10": [
    { "rank": 1, "config": {...}, "metrics": {...} },
    { "rank": 2, "config": {...}, "metrics": {...} }
  ],
  "pareto_frontier": [
    { "config": {...}, "return_total": 42.0, "max_dd": -6.1 },
    { "config": {...}, "return_total": 35.0, "max_dd": -3.1 }
  ],
  "sensitivity": {
    "portfolioSize": { "impact_on_sharpe": 0.32, "direction": "positive" },
    "minScore":      { "impact_on_sharpe": 0.51, "direction": "positive" },
    "horizon":       { "impact_on_sharpe": 0.12, "direction": "negative" }
  }
}
```

**Config map to modes-config.json**: Each dimension `param` must be a valid key in the
`modes-config.json` entry for `base_mode`. The server validates params against the schema
before queuing the job. Unknown params return error `-32602` (Invalid params).

---

### 4.3 `CompareStrategies`

Run multiple strategy variants over the same period and produce a comparison table.

```json
{
  "name": "CompareStrategies",
  "description": "Backtest 2-5 strategy variants over a shared date range and compare. Long-running: returns job_id.",
  "inputSchema": {
    "type": "object",
    "required": ["strategies", "date_range"],
    "properties": {
      "strategies": {
        "type": "array",
        "minItems": 2,
        "maxItems": 5,
        "items": {
          "type": "object",
          "required": ["name", "mode"],
          "properties": {
            "name":            { "type": "string", "description": "Display label for this variant" },
            "mode":            { "type": "string", "enum": ["turbo","dynamic","balanced","secured","fortress","tkl"] },
            "config_override": { "type": "object", "description": "Same schema as RunBacktest.config_override" }
          }
        }
      },
      "date_range": {
        "type": "object",
        "required": ["from", "to"],
        "properties": {
          "from": { "type": "string", "format": "date" },
          "to":   { "type": "string", "format": "date" }
        }
      }
    },
    "additionalProperties": false
  }
}
```

**Returns**:
```json
{
  "comparison_table": [
    {
      "name": "Current Balanced",
      "return_total": 35.2, "max_dd": -4.1, "win_rate": 60.0,
      "sharpe": 2.1, "profit_factor": 4.68, "trades": 42
    },
    {
      "name": "Aggressive Balanced",
      "return_total": 41.8, "max_dd": -8.7, "win_rate": 54.3,
      "sharpe": 1.6, "profit_factor": 3.11, "trades": 58
    }
  ],
  "winner": "Current Balanced",
  "winner_metric": "sharpe",
  "statistical_significance": 0.85,
  "significance_note": "Based on bootstrap resampling (1000 iterations). Values < 0.70 are inconclusive.",
  "correlation_of_equity_curves": 0.72
}
```

**Statistical significance** is computed via bootstrap resampling of daily returns. A value
of ≥ 0.80 is considered statistically significant. Values between 0.50–0.80 are noted as
"suggestive but inconclusive". Values < 0.50 are flagged as "insufficient data".

---

### 4.4 `WalkForwardValidate`

Run rolling walk-forward analysis to detect overfitting.

```json
{
  "name": "WalkForwardValidate",
  "description": "Rolling walk-forward: optimize on training window, validate on forward window. Returns in-sample vs out-of-sample degradation. Long-running.",
  "inputSchema": {
    "type": "object",
    "required": ["mode", "date_range"],
    "properties": {
      "mode": { "type": "string", "enum": ["turbo","dynamic","balanced","secured","fortress","tkl"] },
      "date_range": {
        "type": "object",
        "required": ["from", "to"],
        "properties": {
          "from": { "type": "string", "format": "date" },
          "to":   { "type": "string", "format": "date" }
        }
      },
      "train_window_days": { "type": "integer", "default": 60, "minimum": 20 },
      "test_window_days":  { "type": "integer", "default": 20, "minimum": 5  },
      "step_days":         { "type": "integer", "default": 20, "minimum": 5  },
      "objective":         { "type": "string",  "default": "sharpe", "enum": ["sharpe","profit_factor","win_rate","return_total"] }
    },
    "additionalProperties": false
  }
}
```

**Returns**:
```json
{
  "windows": [
    {
      "train_from": "20260101", "train_to": "20260301",
      "test_from":  "20260302", "test_to":  "20260321",
      "best_config_in_sample":  { "portfolioSize": 3, "minScore": 88 },
      "metrics_in_sample":      { "sharpe": 2.6, "win_rate": 65.0 },
      "metrics_out_of_sample":  { "sharpe": 1.9, "win_rate": 57.1 }
    }
  ],
  "summary": {
    "avg_is_sharpe":  2.4,
    "avg_oos_sharpe": 1.8,
    "degradation_pct": 25.0,
    "overfitting_verdict": "moderate",
    "recommendation": "Config is viable but shows moderate overfitting. Consider relaxing minScore by 2-3 points."
  }
}
```

**`overfitting_verdict` values**: `"none"` (< 10% degradation), `"low"` (10–20%),
`"moderate"` (20–40%), `"high"` (> 40% — config not recommended for production).

Internally delegates to `rolling-walk-forward.js` programmatic API.

---

### 4.5 `GetAdvisorRecommendation`

Return regime-aware parameter recommendations from the advisor system.

```json
{
  "name": "GetAdvisorRecommendation",
  "description": "Return regime-aware parameter recommendations from the advisor calibration system for a given mode.",
  "inputSchema": {
    "type": "object",
    "required": ["mode"],
    "properties": {
      "mode": {
        "type": "string",
        "enum": ["turbo","dynamic","balanced","secured","fortress","tkl"]
      },
      "current_regime": {
        "type": "string",
        "enum": ["RECOVERY","RISK-ON","RISK-OFF","EARLY_RISK-OFF","CRISIS"],
        "description": "If omitted, server reads latest regime from risk-snapshots.json"
      }
    },
    "additionalProperties": false
  }
}
```

**Returns**:
```json
{
  "mode": "balanced",
  "current_regime": "RISK-ON",
  "detected_at": "2026-05-07T06:00:00Z",
  "recommended_config": {
    "portfolioSize": 3,
    "minScore": 88,
    "horizon": 5,
    "stopLossPct": 0.05,
    "tp1Pct": 0.08,
    "tp2Pct": 0.15
  },
  "source": "backtest-results.json#advisor_RISK-ON",
  "vs_current": {
    "portfolioSize": { "current": 3, "recommended": 4, "delta": "+1" },
    "minScore":      { "current": 88, "recommended": 86, "delta": "-2" }
  },
  "rationale": "RISK-ON regime historically favors larger portfolio size and slightly relaxed score threshold. Advisor confidence: 0.78.",
  "confidence": 0.78
}
```

Reads from `data/backtest-results.json` fields prefixed `advisor_*`. The `regime-recalibrate.js`
tool populates these fields; this MCP tool exposes them via the protocol.

---

### 4.6 `AnalyzeVWAPImpact`

Analyze the impact of the VWAP entry gate on a mode's signal set.

```json
{
  "name": "AnalyzeVWAPImpact",
  "description": "Compare backtest results with and without the VWAP entry gate for a given mode and date range.",
  "inputSchema": {
    "type": "object",
    "required": ["mode", "date_range"],
    "properties": {
      "mode":       { "type": "string", "enum": ["turbo","dynamic","balanced","secured","fortress","tkl"] },
      "date_range": {
        "type": "object",
        "required": ["from","to"],
        "properties": {
          "from": { "type": "string", "format": "date" },
          "to":   { "type": "string", "format": "date" }
        }
      }
    },
    "additionalProperties": false
  }
}
```

**Returns**:
```json
{
  "with_vwap_gate": {
    "trades": 38,
    "win_rate": 63.2,
    "return_total": 35.2,
    "avg_entry_slippage_pct": 0.12,
    "signals_rejected_by_gate": 6
  },
  "without_vwap_gate": {
    "trades": 44,
    "win_rate": 54.5,
    "return_total": 29.8,
    "avg_entry_slippage_pct": 0.41
  },
  "gate_impact": {
    "win_rate_delta":       "+8.7pp",
    "return_delta":         "+5.4pp",
    "slippage_delta":       "-0.29pp",
    "signals_filtered_pct": 13.6,
    "verdict": "VWAP gate improves quality. Recommend keeping enabled."
  }
}
```

---

### 4.7 `GetRegimePerformance`

Performance breakdown by market regime.

```json
{
  "name": "GetRegimePerformance",
  "description": "Return performance metrics broken down by market regime for a mode and date range.",
  "inputSchema": {
    "type": "object",
    "required": ["mode", "date_range"],
    "properties": {
      "mode":       { "type": "string", "enum": ["turbo","dynamic","balanced","secured","fortress","tkl"] },
      "date_range": {
        "type": "object",
        "required": ["from","to"],
        "properties": {
          "from": { "type": "string", "format": "date" },
          "to":   { "type": "string", "format": "date" }
        }
      }
    },
    "additionalProperties": false
  }
}
```

**Returns**:
```json
{
  "mode": "balanced",
  "regimes": {
    "RISK-ON": {
      "days": 52, "trades": 30, "win_rate": 66.7,
      "return_total": 28.5, "max_dd": -2.8, "sharpe": 2.9
    },
    "RISK-OFF": {
      "days": 18, "trades": 12, "win_rate": 41.7,
      "return_total": 6.7, "max_dd": -4.1, "sharpe": 0.8
    },
    "EARLY_RISK-OFF": {
      "days": 10, "trades": 0, "win_rate": null,
      "return_total": 0.0, "max_dd": 0.0, "sharpe": null,
      "note": "No trades entered (crisis gate active)"
    }
  },
  "best_regime": "RISK-ON",
  "worst_regime": "RISK-OFF",
  "recommendation": "Consider reducing portfolioSize to 1 during RISK-OFF. Historical data shows net positive expectancy in RISK-ON only."
}
```

---

## 5. Result Caching

Cache key: SHA-256 of `(toolName + JSON.stringify(canonicalParams))` where `canonicalParams`
is the input sorted by key (deterministic serialization).

```javascript
const cacheKey = crypto.createHash('sha256')
  .update(toolName + JSON.stringify(sortKeys(params)))
  .digest('hex');
```

Cache store: Redis with TTL = `BACKTEST_CACHE_TTL_SECONDS` (default 3600).

On cache hit: return immediately with `{ ...result, cached: true, cached_at: ISO8601 }`.
On cache miss: queue job, return `job_id`.

Cache is invalidated when `modes-config.json` or `backtest-trades.json` are modified
(file watcher emits `cache:invalidate` event to Redis pub/sub).

---

## 6. Error Codes

| Code | Message | Cause |
|---|---|---|
| `-32600` | Invalid Request | Malformed JSON-RPC envelope |
| `-32601` | Method not found | Unknown tool name |
| `-32602` | Invalid params | Schema validation failure (detail in `data`) |
| `-32000` | Queue full | Max concurrent jobs reached; retry in 60s |
| `-32001` | Auth failed | Invalid or missing bearer token |
| `-32002` | Rate limit exceeded | Max jobs per hour exceeded |
| `-32003` | Date range too large | Exceeds 365-day limit |
| `-32004` | Config param unknown | `config_override` key not in modes-config schema |

---

## 7. Security Constraints

- Server binds to internal network only (no public ingress). Admin dashboard proxies
  requests via a signed internal route.
- All tokens are 256-bit random strings stored in secrets manager (never env files in prod).
- Logs omit full token; log only first 8 chars + `...` for traceability.
- Backtest results contain no PII. Caching is safe across service accounts.
- Admin dashboard is the only authorized caller for `OptimizeStrategy` and
  `WalkForwardValidate` — LLM agents are restricted to `RunBacktest`, `CompareStrategies`,
  `GetAdvisorRecommendation`, `AnalyzeVWAPImpact`, `GetRegimePerformance`,
  `GetPerformanceAttribution`, `GetRegimeImpact`, and `GetSignalQualityReport`.

---

## 8. Additional Tool Schemas

### 8.1 `GetPerformanceAttribution`

Decompose portfolio returns by strategy type, sector, regime, holding period, and score bucket.

```json
{
  "name": "GetPerformanceAttribution",
  "description": "Decompose portfolio returns into explainable dimensions: strategy, sector, regime, holding period, score bucket. Returns contribution percentages and per-dimension metrics.",
  "inputSchema": {
    "type": "object",
    "required": ["mode"],
    "properties": {
      "mode": {
        "type": "string",
        "enum": ["turbo", "dynamic", "balanced", "secured", "fortress", "tkl"]
      },
      "date_range": {
        "type": "object",
        "properties": {
          "from": { "type": "string", "format": "date" },
          "to":   { "type": "string", "format": "date" }
        },
        "description": "Optional date range filter. Defaults to all available data."
      },
      "dimensions": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": ["strategy", "sector", "regime", "holding_period", "score_bucket"]
        },
        "description": "Which dimensions to decompose. Defaults to all."
      }
    },
    "additionalProperties": false
  }
}
```

**Returns**:
```json
{
  "mode": "balanced",
  "period": { "from": "2026-02-15", "to": "2026-05-07" },
  "total_return_pct": 35.2,
  "total_trades": 42,
  "by_strategy": {
    "momentum": {
      "trades": 18, "wins": 12, "losses": 6,
      "win_rate": 66.7, "pnl_total": 22.5, "pnl_avg": 1.25,
      "contribution_pct": 63.9,
      "max_win": 8.2, "max_loss": -3.1, "avg_hold_days": 4.2
    },
    "breakout": {
      "trades": 14, "wins": 8, "losses": 6,
      "win_rate": 57.1, "pnl_total": 9.8, "pnl_avg": 0.70,
      "contribution_pct": 27.8,
      "max_win": 5.1, "max_loss": -4.2, "avg_hold_days": 5.8
    },
    "squeeze": {
      "trades": 6, "wins": 3, "losses": 3,
      "win_rate": 50.0, "pnl_total": 1.9, "pnl_avg": 0.32,
      "contribution_pct": 5.4,
      "max_win": 3.8, "max_loss": -2.5, "avg_hold_days": 3.1
    },
    "catalyst": {
      "trades": 4, "wins": 3, "losses": 1,
      "win_rate": 75.0, "pnl_total": 1.0, "pnl_avg": 0.25,
      "contribution_pct": 2.8,
      "max_win": 2.1, "max_loss": -1.8, "avg_hold_days": 2.5
    }
  },
  "by_sector": {
    "tech":  { "trades": 12, "contribution_pct": 45.2, "win_rate": 66.7, "pnl_avg": 1.85 },
    "semis": { "trades": 8,  "contribution_pct": 28.1, "win_rate": 62.5, "pnl_avg": 1.72 },
    "healthcare": { "trades": 5, "contribution_pct": 8.5, "win_rate": 60.0, "pnl_avg": 0.95 }
  },
  "by_regime": {
    "RISK-ON":  { "trades": 30, "contribution_pct": 81.0, "win_rate": 66.7, "sharpe": 2.9 },
    "RISK-OFF": { "trades": 12, "contribution_pct": 19.0, "win_rate": 41.7, "sharpe": 0.8 }
  },
  "by_holding_period": {
    "0-2d":   { "trades": 10, "win_rate": 50.0, "pnl_avg": 0.8, "contribution_pct": 12.5 },
    "3-5d":   { "trades": 20, "win_rate": 65.0, "pnl_avg": 1.5, "contribution_pct": 48.2 },
    "6-10d":  { "trades": 8,  "win_rate": 62.5, "pnl_avg": 2.1, "contribution_pct": 26.8 },
    "11-21d": { "trades": 4,  "win_rate": 75.0, "pnl_avg": 3.5, "contribution_pct": 12.5 }
  },
  "by_score_bucket": {
    "90-92":  { "trades": 15, "win_rate": 53.3, "pnl_avg": 0.65, "contribution_pct": 18.2 },
    "93-95":  { "trades": 18, "win_rate": 61.1, "pnl_avg": 1.15, "contribution_pct": 38.5 },
    "96-100": { "trades": 9,  "win_rate": 77.8, "pnl_avg": 2.80, "contribution_pct": 43.3 }
  }
}
```

**Data source**: Reads from `backtest-trades.json` (same as `RunBacktest`). Filters resolved
trades by mode and date range. Attribution slices are computed in-memory.

**Cache**: Keyed by `(mode + date_range_hash)`. TTL = `BACKTEST_CACHE_TTL_SECONDS`.

---

### 8.2 `GetRegimeImpact`

Strategy metrics filtered and broken down by market regime, with transition impact analysis.

```json
{
  "name": "GetRegimeImpact",
  "description": "Analyze how a strategy performs across different market regimes (RISK-ON, RISK-OFF, NEUTRAL, etc.). Includes regime transition impact and cross-mode ranking.",
  "inputSchema": {
    "type": "object",
    "required": ["mode"],
    "properties": {
      "mode": {
        "type": "string",
        "enum": ["turbo", "dynamic", "balanced", "secured", "fortress", "tkl"]
      },
      "date_range": {
        "type": "object",
        "properties": {
          "from": { "type": "string", "format": "date" },
          "to":   { "type": "string", "format": "date" }
        }
      },
      "include_transitions": {
        "type": "boolean",
        "default": true,
        "description": "Include 5-day impact analysis around regime transitions."
      },
      "include_cross_mode": {
        "type": "boolean",
        "default": false,
        "description": "Include cross-mode ranking per regime (requires computing all modes)."
      }
    },
    "additionalProperties": false
  }
}
```

**Returns**:
```json
{
  "mode": "balanced",
  "period": { "from": "2026-02-15", "to": "2026-05-07" },
  "current_regime": "RISK-ON",
  "regime_sensitivity": 1.2,
  "regimes": {
    "RISK-ON": {
      "days": 52, "trades": 30, "win_rate": 66.7,
      "return_total": 28.5, "max_dd": -2.8, "sharpe": 2.9, "profit_factor": 5.2,
      "avg_hold_days": 4.8,
      "strategies_used": {
        "momentum": { "trades": 18, "win_rate": 72.2 },
        "breakout": { "trades": 12, "win_rate": 58.3 }
      }
    },
    "RISK-OFF": {
      "days": 18, "trades": 12, "win_rate": 41.7,
      "return_total": 6.7, "max_dd": -4.1, "sharpe": 0.8, "profit_factor": 1.3,
      "avg_hold_days": 6.2,
      "strategies_used": {
        "momentum": { "trades": 8, "win_rate": 37.5 },
        "breakout": { "trades": 4, "win_rate": 50.0 }
      }
    }
  },
  "transitions": [
    {
      "date": "2026-03-01",
      "from": "RISK-ON", "to": "RISK-OFF",
      "impact_5d_pct": -2.1,
      "trades_in_window": 3,
      "stop_outs_in_window": 2
    },
    {
      "date": "2026-03-20",
      "from": "RISK-OFF", "to": "RISK-ON",
      "impact_5d_pct": 3.8,
      "trades_in_window": 5,
      "stop_outs_in_window": 0
    }
  ],
  "cross_mode_ranking": [
    {
      "regime": "RISK-ON",
      "ranking": [
        { "mode": "turbo", "sharpe": 3.8 },
        { "mode": "dynamic", "sharpe": 3.4 },
        { "mode": "balanced", "sharpe": 2.9 }
      ]
    },
    {
      "regime": "RISK-OFF",
      "ranking": [
        { "mode": "fortress", "sharpe": 1.8 },
        { "mode": "secured", "sharpe": 1.2 },
        { "mode": "balanced", "sharpe": 0.8 }
      ]
    }
  ],
  "recommendation": "Balanced performs well in RISK-ON (Sharpe 2.9) but poorly in RISK-OFF (0.8). Consider reducing portfolioSize to 1 during RISK-OFF."
}
```

**Cache**: Same as `GetPerformanceAttribution`. Cross-mode results have separate cache key.

---

### 8.3 `GetSignalQualityReport`

Signal hit rates with multi-dimensional breakdown and score predictiveness analysis.

```json
{
  "name": "GetSignalQualityReport",
  "description": "Analyze signal quality: hit rates by score bucket, strategy label, sector, and regime. Includes score predictiveness correlation and optimal threshold recommendation.",
  "inputSchema": {
    "type": "object",
    "required": ["mode"],
    "properties": {
      "mode": {
        "type": "string",
        "enum": ["turbo", "dynamic", "balanced", "secured", "fortress", "tkl"]
      },
      "date_range": {
        "type": "object",
        "properties": {
          "from": { "type": "string", "format": "date" },
          "to":   { "type": "string", "format": "date" }
        }
      },
      "min_trades": {
        "type": "integer",
        "minimum": 3,
        "default": 5,
        "description": "Minimum resolved trades per bucket for statistical significance."
      }
    },
    "additionalProperties": false
  }
}
```

**Returns**:
```json
{
  "mode": "balanced",
  "period": { "from": "2026-02-15", "to": "2026-05-07" },
  "overall": {
    "signals_total": 120,
    "signals_taken": 42,
    "signals_resolved": 38,
    "hit_rate": 60.0,
    "avg_pnl_winners": 3.8,
    "avg_pnl_losers": -2.1,
    "expectancy": 1.42,
    "profit_factor": 4.68
  },
  "by_score_bucket": {
    "90-92":  { "taken": 15, "resolved": 14, "hit_rate": 53.3, "expectancy": 0.85, "profit_factor": 2.1 },
    "93-95":  { "taken": 18, "resolved": 16, "hit_rate": 61.1, "expectancy": 1.55, "profit_factor": 4.2 },
    "96-100": { "taken": 9,  "resolved": 8,  "hit_rate": 77.8, "expectancy": 2.80, "profit_factor": 8.5 }
  },
  "by_strategy_label": {
    "momentum":       { "taken": 18, "hit_rate": 66.7, "expectancy": 1.92 },
    "breakout":       { "taken": 14, "hit_rate": 57.1, "expectancy": 1.10 },
    "squeeze":        { "taken": 6,  "hit_rate": 50.0, "expectancy": 0.65 },
    "catalyst":       { "taken": 4,  "hit_rate": 75.0, "expectancy": 2.40 },
    "mean_reversion": { "taken": 0,  "hit_rate": null, "expectancy": null }
  },
  "by_sector": {
    "tech":       { "taken": 12, "hit_rate": 66.7, "expectancy": 2.10 },
    "semis":      { "taken": 8,  "hit_rate": 62.5, "expectancy": 1.85 },
    "healthcare": { "taken": 5,  "hit_rate": 60.0, "expectancy": 1.20 }
  },
  "by_regime": {
    "RISK-ON":  { "taken": 30, "hit_rate": 66.7, "expectancy": 1.95 },
    "RISK-OFF": { "taken": 12, "hit_rate": 41.7, "expectancy": 0.42 }
  },
  "score_predictiveness": {
    "correlation_score_vs_pnl": 0.35,
    "correlation_score_vs_win": 0.28,
    "optimal_score_threshold": 93,
    "current_min_score": 88,
    "lift_at_optimal": 1.82,
    "recommendation": "Raising minScore from 88 to 93 would increase expectancy from 1.42 to 2.18 (+53%) but reduce trade count from 42 to 27 (-36%)"
  }
}
```

**Data source**: Same as `RunBacktest` — reads from `backtest-trades.json`, enriched with
signal metadata from `scanner/*/data.json`.

**Cache**: Keyed by `(mode + date_range_hash)`. TTL = `BACKTEST_CACHE_TTL_SECONDS`.
Synchronous response (< 2s) — no async job needed.
