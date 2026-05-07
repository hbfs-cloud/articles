---
name: review-strategy
description: Health check an existing strategy slot — detect degradation, regime drift, and recommend continue/pause/retire
version: 1.0.0
---

# Review Strategy

## When to Use

- Weekly or monthly strategy health check
- A slot's recent P&L is noticeably worse than its backtest baseline
- Regime change detected (risk-on → risk-off or vice versa)
- Hit rate has dropped and user suspects signal decay
- Before increasing capital allocation to a slot
- User asks "how is [strategy] performing?"

## Prerequisites

- `mart_strategy_performance` mart populated with at least 30 days of live data
- `mart_signal_quality` mart available for signal-level analysis
- `strategy-slots.json` readable
- `GetRegimeImpact` MCP tool available (PRD-20)
- `GetSignalQualityReport` MCP tool available (PRD-20)

## Steps

### Step 1: Load Strategy Slot Config

Read `strategy-slots.json` and identify the target slot. Extract:
- Scanner name, strategy name, mode
- Entry/exit parameters (SL%, TP%, horizon)
- Capital allocation and max positions
- Date slot was promoted to production

### Step 2: Fetch Recent Performance from Mart

```json
{
  "tool": "GetMart",
  "mart": "mart_strategy_performance",
  "filters": {
    "slot_id": "<slot_id>",
    "period_days": [30, 60, 90]
  }
}
```

Extract for each window: Win Rate, Profit Factor, Avg Hold Days, Max Drawdown, Total Trades, Net Return.

### Step 3: Check Regime Sensitivity

```json
{
  "tool": "GetRegimeImpact",
  "slot_id": "<slot_id>",
  "lookback_days": 90
}
```

Compare performance across regimes (risk-on, neutral, risk-off, crisis). Flag if live regime performance diverges >15pp from backtest expectations.

### Step 4: Analyze Signal Quality

```json
{
  "tool": "GetSignalQualityReport",
  "slot_id": "<slot_id>",
  "breakdown_by": ["score_bucket", "sector", "regime"]
}
```

Key metrics to check:
- Hit rate per score bucket (e.g., score 90-100 should have WR > 60%)
- Sector concentration drift (is one sector dominating fills?)
- Score distribution shift vs backtest period

### Step 5: Degradation Check

Compare live metrics vs backtest baseline:

| Metric | Backtest | Live 30d | Live 60d | Live 90d | Delta | Flag? |
|--------|----------|----------|----------|----------|-------|-------|
| Win Rate | X% | X% | X% | X% | Xpp | ❌ if >10pp drop |
| Profit Factor | X | X | X | X | X | ❌ if <1.0 |
| Max Drawdown | X% | X% | X% | X% | X | ❌ if >threshold |
| Avg Score | X | X | X | X | X | ⚠️ if shifting down |

### Step 6: Fetch AI Strategy Insights

```json
{
  "tool": "GetStrategyInsights",
  "slot_id": "<slot_id>",
  "include": ["degradation_analysis", "regime_fit", "improvement_suggestions"]
}
```

### Step 7: Issue Recommendation

Based on flags raised, issue one of these recommendations:

| Condition | Recommendation |
|-----------|---------------|
| All metrics within 5% of baseline | **CONTINUE** — no action needed |
| WR dropped 5-10pp, PF still >1.0 | **WATCH** — monitor weekly |
| WR dropped >10pp OR PF < 1.0 | **REDUCE SIZE** — halve allocation |
| DD exceeds threshold OR regime drift confirmed | **PAUSE** — halt new entries, close on expiry |
| PF < 0.8 for 60+ days | **RECALIBRATE** — run sweep + backtest new params |
| No recovery after recalibration | **RETIRE** — remove slot, trigger discovery |

## MCP Tools Used

| Tool | Purpose |
|------|---------|
| GetMart | Fetch mart_strategy_performance and mart_signal_quality data |
| GetRegimeImpact | Decompose performance by market regime |
| GetSignalQualityReport | Hit rate by score bucket, sector, regime |
| GetStrategyInsights | AI-generated degradation analysis and suggestions |

## Output

- Performance table (30/60/90d vs backtest baseline)
- Regime sensitivity heatmap
- Signal quality breakdown by score bucket
- Degradation flags with specific metrics
- Actionable recommendation (one of 6 states above)

## Error Handling

- **Mart has <10 trades for period**: Extend window or note insufficient data; do not flag degradation without statistical significance.
- **GetRegimeImpact returns empty**: Current regime may be too short; skip regime check and note in report.
- **GetStrategyInsights timeout**: Proceed with manual analysis from mart data; note AI insights unavailable.
- **Slot not found in strategy-slots.json**: Confirm slot ID, check if slot was recently renamed or retired.

## Examples

### Example 1: Routine 30-Day Review

```
Slot: momentum-breakout-balanced
→ GetMart(mart_strategy_performance, slot_id, period=30/60/90)
→ Live 30d WR: 48% vs Backtest: 58% → -10pp → FLAG
→ GetRegimeImpact → risk-off regime 60% of past 30d (unusual)
→ GetSignalQualityReport → score 90-100 WR still 62%, score 85-90 WR 38% (decay in lower scores)
→ Recommendation: REDUCE SIZE + filter signals to score ≥ 90 only
```

### Example 2: Post-Regime-Change Review

```
Slot: mean-reversion-secured
Trigger: Regime switched risk-on → risk-off 2 weeks ago
→ GetRegimeImpact → strategy designed for neutral/risk-off → actually performs better now
→ Live 30d PF: 1.8 vs Backtest risk-off PF: 1.6 → outperforming
→ Recommendation: CONTINUE, consider increasing allocation in this regime
```
