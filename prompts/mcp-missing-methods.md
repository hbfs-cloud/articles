# MCP DailyTickers — Missing Methods Spec

**Target audience**: Claude Code agent working in the DailyTickers MCP server repository (Python or Go gateway).
**Goal**: Implement 5 new MCP tools + 4 missing `QueryData` types + 1 enhancement, all needed by the retail hedge-fund pipeline at `articles.dailytickers.com`.
**Style**: server returns JSON-RPC 2.0 via stdio/HTTP, headers `Content-Type: application/json` + `Accept: application/json, text/event-stream`. All datetimes ISO-8601 UTC. All prices float. All probabilities [0,1].

---

## Context (read first)

The consumer pipeline lives at `/Users/marketwatchxyz/GolandProjects/articles/`. It runs 5 portfolio modes (turbo, dynamic, balanced, secured, fortress) defined in `data/modes-config.json` and backtested by `tools/sweep.js`. Live signals via `tools/signal-monitor.js`. Daily dashboard via `tools/gen-status-page.js`. Public JSON API via `tools/gen-api.js` at `/portfolio/v1/`.

The system today is **long-only, no hedge, no correlation control, no portfolio-level VaR, no regime gating beyond cosmetic VIX threshold**. The 5 new methods are designed to plug those gaps without rewriting the pipeline.

Existing relevant MCP surface:
- `QueryData(symbols, types, lookback_days)` — 58+ data types. Already has `quote`, `bars_daily`, `social_sentiment`, `capital_flow`, `insider_transactions`, `support_resistance`, `volume_profile`, `news`, etc.
- `GetMarketOverview()` — indices, sectors, calendar, sentiment.
- `RunScreener(dsl)`, `RunAutoScreener(regime)`.
- `GetInstruments(symbols)`.
- `Forecast(tickers, context_length, horizon)`, `ForecastVix`, `ForecastRaw`, `Backtest` — TimesFM 2.5-200M.
- `CalculateOptionsGreeks`, `AnalyzeOptionsStrategy`, `CalculatePortfolioGreeks`, `CalculatePortfolioVaR`, `CalculateSABRVolatility`, `ScreenOptions` — already implemented but unused by the articles pipeline.

---

## DELIVERABLE 1 — New MCP Tool: `GetCorrelationMatrix`

**Purpose**: Pairwise rolling correlation for a basket of symbols. Used to enforce correlation cap in portfolio construction (`sweep.js:622` candidate selection).

### Signature

```json
{
  "name": "GetCorrelationMatrix",
  "params": {
    "symbols": ["AAPL", "MSFT", "GOOGL"],
    "window_days": 60,
    "method": "pearson",
    "returns_type": "log"
  }
}
```

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `symbols` | string[] | required | 2–50 tickers |
| `window_days` | int | 60 | min 20, max 252 |
| `method` | enum | `"pearson"` | `pearson` \| `spearman` \| `kendall` |
| `returns_type` | enum | `"log"` | `log` \| `simple` |

### Response

```json
{
  "as_of": "2026-04-28T22:00:00Z",
  "window_days": 60,
  "n_observations": 60,
  "symbols": ["AAPL", "MSFT", "GOOGL"],
  "matrix": [
    [1.0, 0.78, 0.71],
    [0.78, 1.0, 0.69],
    [0.71, 0.69, 1.0]
  ],
  "max_pair": {"a": "AAPL", "b": "MSFT", "rho": 0.78},
  "avg_off_diagonal": 0.726,
  "missing_data": []
}
```

### Edge cases
- Tickers with <20 bars → list in `missing_data`, exclude from matrix, do NOT fail the whole call.
- Crypto (BTC-USD) and equities mixed → use overlapping trading sessions only.
- Return 4xx if fewer than 2 valid symbols after filtering.

### Test
```python
GetCorrelationMatrix(symbols=["AAPL","MSFT","SPY","BTC-USD","XYZ_DELISTED"], window_days=30)
# expect: 4x4 matrix on AAPL/MSFT/SPY/BTC-USD, "XYZ_DELISTED" in missing_data
```

---

## DELIVERABLE 2 — New MCP Tool: `GetRegimeProbability`

**Purpose**: Replace the rule-based VIX threshold (`<15 RISK-ON`, `15-20 NEUTRAL`, `20-28 EARLY RISK-OFF`, `>28 RISK-OFF`) with a probabilistic regime classifier. Used by `signal-monitor.js`, the radar canvas, and `gen-status-page.js`.

### Signature

```json
{
  "name": "GetRegimeProbability",
  "params": {
    "horizon_days": 5,
    "model": "hmm",
    "include_history": false
  }
}
```

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `horizon_days` | int | 5 | 1, 5, 10, 20 only |
| `model` | enum | `"hmm"` | `hmm` (4-state HMM on VIX/SPY/HYG/TLT) \| `factor` (PCA on macro factors) \| `ensemble` |
| `include_history` | bool | false | if true, return last 60 days of probabilities |

### Response

```json
{
  "as_of": "2026-04-28T22:00:00Z",
  "horizon_days": 5,
  "model": "hmm",
  "current_state": "neutral",
  "current_state_confidence": 0.62,
  "probabilities": {
    "risk_on": 0.18,
    "neutral": 0.62,
    "early_risk_off": 0.15,
    "crisis": 0.05
  },
  "transition_5d": {
    "risk_on": 0.22,
    "neutral": 0.51,
    "early_risk_off": 0.20,
    "crisis": 0.07
  },
  "expected_return_spy_pct": 0.45,
  "expected_drawdown_pct": -2.1,
  "history": null
}
```

### Logic
- States = same 4 buckets used today, so the consumer pipeline doesn't need to change semantics.
- Factor inputs at minimum: VIX level, VIX 5d change, SPY 20d return, HYG/IEF spread, TLT 5d return, dollar index.
- `expected_return_spy_pct` and `expected_drawdown_pct` are conditional on the transition matrix over `horizon_days`.

### Edge cases
- Model not yet trained / cold start → `current_state_confidence < 0.30` and `model: "fallback_rule_based"` flag.

---

## DELIVERABLE 3 — New MCP Tool: `GetPortfolioStressTest`

**Purpose**: Apply standard macro shocks to a portfolio of positions and return scenario P&L. Plugs into `gen-status-page.js` (currently no DD scenarios published) and the public API.

### Signature

```json
{
  "name": "GetPortfolioStressTest",
  "params": {
    "positions": [
      {"symbol": "AAPL", "qty": 100, "avg_cost": 175.20},
      {"symbol": "NVDA", "qty": 50, "avg_cost": 920.50},
      {"symbol": "BTC-USD", "qty": 0.5, "avg_cost": 65000}
    ],
    "scenarios": ["fed_plus_100bps", "equity_minus_20pct", "credit_spread_plus_200bps", "vix_spike_to_40", "btc_minus_30pct", "custom"],
    "custom_shocks": {
      "spy": -0.10,
      "vix": 1.5,
      "ust10y_bps": 50
    },
    "horizon_days": 5
  }
}
```

### Response

```json
{
  "as_of": "2026-04-28T22:00:00Z",
  "portfolio_value": 87125.00,
  "horizon_days": 5,
  "results": [
    {
      "scenario": "fed_plus_100bps",
      "pnl_usd": -3120.50,
      "pnl_pct": -3.58,
      "worst_position": {"symbol": "NVDA", "pnl_pct": -7.2},
      "best_position": {"symbol": "AAPL", "pnl_pct": -1.1}
    },
    {
      "scenario": "equity_minus_20pct",
      "pnl_usd": -16850.00,
      "pnl_pct": -19.34,
      "worst_position": {"symbol": "BTC-USD", "pnl_pct": -28.0},
      "best_position": {"symbol": "AAPL", "pnl_pct": -18.5}
    }
  ],
  "var_95_5d_usd": -4521.30,
  "var_99_5d_usd": -7890.10,
  "expected_shortfall_95_5d_usd": -6105.40
}
```

### Scenarios (preset library, all reproducible)

| Key | Shock |
|-----|-------|
| `fed_plus_100bps` | UST10Y +100bps, SPX beta-shock via DV01 + ERP |
| `equity_minus_20pct` | SPX -20%, betas applied per ticker |
| `credit_spread_plus_200bps` | HYG -8%, ratings betas |
| `vix_spike_to_40` | VIX 40, equity vol surface re-priced |
| `btc_minus_30pct` | BTC -30%, equities crypto-beta |
| `oil_plus_50pct` | WTI +50%, sector betas |
| `geopolitical` | gold +15%, equities -10%, USD +5%, oil +20% |
| `custom` | use `custom_shocks` raw |

### Edge cases
- Unknown ticker → drop, list in `dropped_positions` array.
- Crypto in scenarios that don't apply (e.g., `fed_plus_100bps`) → use crypto-equity beta from rolling 60d.

---

## DELIVERABLE 4 — New MCP Tool: `GetEarningsCalendarFiltered`

**Purpose**: Filtered earnings calendar that returns only tickers crossing a meaningful threshold. Replaces the manual `GetMarketOverview` + WebSearch combo currently used to build the ±3-day exclusion window for TimesFM forecasts.

### Signature

```json
{
  "name": "GetEarningsCalendarFiltered",
  "params": {
    "symbols": ["NVDA", "AAPL", "TSLA"],
    "days_ahead": 7,
    "min_expected_move_pct": 4.0,
    "min_market_cap_usd": 1000000000,
    "include_implied_move": true
  }
}
```

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `symbols` | string[] | null | null = scan SP500 + NDX |
| `days_ahead` | int | 7 | 1–30 |
| `min_expected_move_pct` | float | 0 | options-implied straddle move |
| `min_market_cap_usd` | int | 0 | filter out micro-caps |
| `include_implied_move` | bool | true | adds straddle calc per ticker |

### Response

```json
{
  "as_of": "2026-04-28T22:00:00Z",
  "events": [
    {
      "symbol": "NVDA",
      "report_date": "2026-05-21",
      "report_time": "AMC",
      "fiscal_period": "Q1 2027",
      "consensus_eps": 0.74,
      "consensus_revenue_b": 28.4,
      "implied_move_pct": 7.2,
      "atm_straddle_usd": 18.50,
      "exclusion_window": ["2026-05-18", "2026-05-22"]
    }
  ]
}
```

### Edge cases
- No options chain available → `implied_move_pct: null`, still return the event.
- `exclusion_window` always populated — pipeline uses it directly to skip TimesFM forecasts ±3d.

---

## DELIVERABLE 5 — New MCP Tool: `OptimizeSizing`

**Purpose**: Take a list of ranked signals and return position sizes that respect mode constraints. Replaces the offline grid search in `sweep.js` for live use.

### Signature

```json
{
  "name": "OptimizeSizing",
  "params": {
    "signals": [
      {"symbol": "NVDA", "score": 92, "atr_14": 14.2, "entry": 920, "stop": 895},
      {"symbol": "AMZN", "score": 88, "atr_14": 4.1, "entry": 195, "stop": 192},
      {"symbol": "META", "score": 90, "atr_14": 8.5, "entry": 510, "stop": 502}
    ],
    "constraints": {
      "max_positions": 3,
      "target_portfolio_vol_pct": 12,
      "max_position_risk_pct": 1.0,
      "max_sector_exposure_pct": 40,
      "max_pairwise_correlation": 0.7,
      "method": "vol_target",
      "capital_usd": 100000
    },
    "mode": "balanced"
  }
}
```

| Constraint method | Behavior |
|-------------------|----------|
| `equal_weight` | 1/N, ignore vol |
| `vol_target` | scale each by `target/realized_vol` |
| `inverse_atr` | size = `(capital × max_position_risk_pct) / (ATR × entry)` |
| `kelly_quarter` | quarter-Kelly using historical hit rate per score bucket |

### Response

```json
{
  "as_of": "2026-04-28T22:00:00Z",
  "mode": "balanced",
  "method": "vol_target",
  "allocations": [
    {"symbol": "AMZN", "shares": 165, "usd": 32175, "weight_pct": 32.2, "risk_pct": 0.95, "rationale": "low ATR, high score"},
    {"symbol": "META", "shares": 60, "usd": 30600, "weight_pct": 30.6, "risk_pct": 0.94, "rationale": "vol-target scaled"},
    {"symbol": "NVDA", "shares": 25, "usd": 23000, "weight_pct": 23.0, "risk_pct": 0.97, "rationale": "ATR-capped"}
  ],
  "cash_reserve_pct": 14.2,
  "portfolio_expected_vol_pct": 11.8,
  "portfolio_max_correlation": 0.62,
  "warnings": []
}
```

### Edge cases
- Correlation cap violated even after sizing → drop the lowest-score offender, re-optimize, add `dropped_for_correlation` warning.
- Capital insufficient to fund all positions at min size → return the top-N that fit, list rejected.

---

## DELIVERABLE 6 — Add 4 missing `QueryData` types

These already appear in some docs but are not actually wired through `QueryData`:

| Type | Returns | Used in pipeline |
|------|---------|------------------|
| `dark_pool` | `{symbol, prints_5d, prints_volume_pct, top_print_size, accumulation_score}` | scanner post-screener (institutional flow) |
| `unusual_options` | `{symbol, contracts: [{strike, expiry, side, volume, oi, sweep, premium}], call_put_ratio, smart_money_score}` | scanner (informed flow) |
| `ftd_threshold` | `{symbol, on_threshold_list, ftds_5d, ftd_settlement_date, days_on_list}` | scanner (squeeze precursor) |
| `sec_filings` | `{symbol, recent_filings: [{form, filed_at, headline, dilution_flag, shelf_amount_usd}], dilution_risk_score}` | dilution check (replaces WebSearch) |

Each type follows the existing `QueryData` envelope:
```json
{
  "symbol": "GME",
  "type": "ftd_threshold",
  "as_of": "2026-04-28T22:00:00Z",
  "data": { ... }
}
```

---

## DELIVERABLE 7 — Enhance `Forecast` to expose XReg covariates

Currently `Forecast` and `ForecastRaw` accept only the target series. The TimesFM 2.5-200M backbone supports exogenous covariates but the wrapper hides them, which makes Use Case 4 (earnings) score 2/10 in the empirical eval. Expose covariates:

```json
{
  "name": "Forecast",
  "params": {
    "tickers": ["NVDA"],
    "context_length": 200,
    "horizon": 10,
    "covariates": {
      "vix": [series],
      "spy_returns": [series],
      "earnings_proximity_days": [series],
      "regime_state": [series]
    }
  }
}
```

Response adds `covariate_importance`:
```json
{
  "ticker": "NVDA",
  "forecast": [...],
  "ci": [...],
  "covariate_importance": {"vix": 0.35, "spy_returns": 0.28, "earnings_proximity_days": 0.22, "regime_state": 0.15}
}
```

---

## Acceptance Criteria

For each deliverable:
1. Implement the tool in the MCP server (Python FastAPI + tool registry, follow existing pattern of `Forecast`).
2. Add unit tests with at least: happy path, missing data, invalid params, empty result.
3. Add integration test that calls the tool via JSON-RPC over the existing transport.
4. Update `GetHelp` and `GetDSLDescription` outputs to include the new tools/types.
5. Update the OpenAPI/JSON schema published to MCP clients.
6. Document each new tool with one full request/response example in the server README.
7. Backwards compatible — no breaking changes to existing tools.

## Quality Bar

- All numbers must be reproducible (cite data source per field).
- Latency budget: `GetCorrelationMatrix` <500ms for 20 symbols, `GetPortfolioStressTest` <1s for 20 positions × 7 scenarios, `OptimizeSizing` <300ms.
- All endpoints must degrade gracefully — partial responses with `warnings` array, never silent failure.
- Write logs at INFO for each call (caller, params, latency, result size).

## Order of Implementation (priority)

1. `GetPortfolioStressTest` + `CalculatePortfolioVaR` wiring → publishable VaR on the public API today.
2. `GetCorrelationMatrix` → unblocks portfolio correlation cap in `sweep.js`.
3. Missing `QueryData` types (`dark_pool`, `unusual_options`, `ftd_threshold`, `sec_filings`).
4. `OptimizeSizing` → moves grid search out of offline `sweep.js`.
5. `GetRegimeProbability` → replaces VIX rule.
6. `GetEarningsCalendarFiltered`.
7. `Forecast` covariates (XReg).

---

## Out of Scope

- Live order execution / broker integration.
- Real-time streaming (sticky to JSON-RPC request/response).
- Tax-lot accounting.
- Multi-currency portfolios.

---

When complete, post a single Discord notification listing the 7 deliverables, their status, and links to the new docs sections in `GetHelp` output.
