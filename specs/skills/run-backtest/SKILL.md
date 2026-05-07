---
name: run-backtest
description: Execute a backtest for a strategy configuration — validates performance before production promotion
version: 1.0.0
---

# Run Backtest

## When to Use

- Before promoting a new strategy slot to production
- After recalibrating parameters (post-sweep or regime change)
- Comparing two strategy variants to pick the stronger one
- Validating that a scanner modification didn't degrade performance
- User asks "backtest this strategy" or "how did X perform historically?"

## Prerequisites

- OHLCV data available in the warehouse for the target date range
- `RunBacktest` MCP tool available (PRD-20)
- `CompareStrategies` MCP tool available (PRD-20)
- Go bridge running (for mechanical strategies)
- `sweep.js` available (for scanner-based strategies)

## Steps

### Step 1: Define Parameters

Before running, confirm all parameters are set:

```json
{
  "strategy_name": "<strategy>",
  "scanner_name": "<scanner>",
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "mode_config": {
    "max_positions": 10,
    "position_size_pct": 0.10,
    "stop_loss_pct": 0.07,
    "take_profit_pct": 0.15,
    "horizon_days": 15,
    "min_score": 85
  }
}
```

Minimum recommended date range: 1 year. Preferred: 2+ years spanning at least one risk-off period.

### Step 2: Scanner-Based Strategy — sweep.js

For scanner strategies managed by `sweep.js`:

```bash
# Full grid search (discovers best params)
node tools/sweep.js --full-sweep --start 2023-01-01 --end 2024-12-31

# Targeted backtest with specific config
node tools/sweep.js --config path/to/config.json --start 2023-01-01 --end 2024-12-31
```

Output: `data/backtest-results.json` updated with new entry.

### Step 3: Mechanical Strategy — Go Bridge via RunBacktest

For Go-engine mechanical strategies:

```json
{
  "tool": "RunBacktest",
  "strategy": "<strategy_name>",
  "scanner": "<scanner_name>",
  "start_date": "2023-01-01",
  "end_date": "2024-12-31",
  "mode_config": { "..." }
}
```

Poll job status if async:
```json
{
  "tool": "CheckJobStatus",
  "job_id": "<returned_job_id>"
}
```

### Step 4: Collect BacktestResult

From the job output or `data/backtest-results.json`, extract:

```json
{
  "equity_curve": [...],
  "trade_list": [...],
  "metrics": {
    "total_return_pct": 0,
    "sharpe_ratio": 0,
    "sortino_ratio": 0,
    "win_rate": 0,
    "profit_factor": 0,
    "max_drawdown_pct": 0,
    "avg_hold_days": 0,
    "total_trades": 0,
    "calmar_ratio": 0
  }
}
```

### Step 5: Compute Derived Metrics

If not returned by the tool, compute manually:

| Metric | Formula |
|--------|---------|
| Sharpe | (Annualized Return - Rf) / Annualized Std Dev |
| Sortino | (Annualized Return - Rf) / Downside Std Dev |
| Calmar | Annualized Return / Max Drawdown |
| Profit Factor | Gross Profit / Gross Loss |

Risk-free rate: use 5% annualized (approximate T-bill rate).

### Step 6: Compare vs Production Baseline

If a production slot exists for this strategy:

```json
{
  "tool": "CompareStrategies",
  "baseline": "<production_slot_id>",
  "candidate": "<backtest_result_id>",
  "metrics": ["sharpe", "sortino", "win_rate", "profit_factor", "max_drawdown", "calmar"]
}
```

### Step 7: Promotion Decision

| Condition | Decision |
|-----------|---------|
| Sharpe > 1.2, WR > 50%, PF > 1.5, Trades ≥ 30 | READY for discover-strategy → production |
| Sharpe 1.0–1.2, WR 45–50%, PF 1.3–1.5 | CONDITIONAL — extend date range, stress test |
| Any threshold missed | NOT READY — adjust params and re-run |

### Step 8: Save Output

Save result to `data/backtest-results/<strategy>-<date>.json` and log summary:

```
Strategy: <name>
Period: YYYY-MM-DD to YYYY-MM-DD
Trades: N | WR: X% | PF: X | Sharpe: X | MaxDD: X% | Calmar: X
Decision: READY / CONDITIONAL / NOT READY
```

## MCP Tools Used

| Tool | Purpose |
|------|---------|
| RunBacktest | Execute mechanical strategy backtest via Go bridge |
| CompareStrategies | Side-by-side comparison vs production baseline |
| CheckJobStatus | Poll async backtest job completion |

## Output

- `data/backtest-results/<strategy>-<YYYYMMDD>.json` with full equity curve and trade list
- Summary metrics table (Sharpe, Sortino, WR, PF, MaxDD, Calmar, Trades)
- Promotion decision with rationale
- Optional: CompareStrategies report vs current production

## Error Handling

- **Insufficient trades (<30)**: Extend date range or relax min_score. Document if market conditions explain low signal frequency.
- **Go bridge timeout**: Increase timeout or split date range into sub-periods and concatenate results.
- **sweep.js OOM on full-sweep**: Reduce grid search space or run with `--quick` flag.
- **Data gaps in OHLCV**: Check warehouse coverage; exclude periods with >5 consecutive missing days.
- **Async job stuck**: Call `ListJobs` to see status; if >10 min with no progress, cancel and retry.

## Examples

### Example 1: Backtest Before Promoting New Scanner

```
New scanner: momentum-rsi-divergence
→ Step 1: params set, 2-year range 2023-01-01 to 2024-12-31
→ Step 2: sweep.js --full-sweep → grid search 240 param combos
→ Best config found: SL=7%, TP=15%, horizon=12d, score>=88
→ Step 4: WR=54%, PF=1.7, Sharpe=1.35, MaxDD=14%, Trades=87
→ Step 6: CompareStrategies vs weakest slot → +22% Sharpe
→ Decision: READY → feed into discover-strategy skill
```

### Example 2: Validate Recalibrated Parameters

```
Regime change detected: risk-off
→ regime-recalibrate.js proposes: SL=5%, TP=10%, horizon=8d
→ RunBacktest with new params on 2022 (risk-off year)
→ WR=58%, PF=1.9 vs old params WR=44%, PF=1.1 → validates recalibration
→ Decision: READY, apply new params
```
