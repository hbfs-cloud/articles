---
name: discover-strategy
description: Find new trading strategies via analytical marts — surfaces high-performing scanner/strategy combos not yet in production
version: 1.0.0
---

# Discover Strategy

## When to Use

- A strategy slot is underperforming and a replacement is needed
- Monthly strategy review cycle (identify new candidates)
- A new market regime has been detected and regime-specific strategies are needed
- The discovery mart has been refreshed and new candidates are available
- User asks "what new strategies should we consider?"

## Prerequisites

- `mart_discovery_candidates` mart is populated (PRD-24 analytics pipeline running)
- `RunBacktest` MCP tool available (PRD-20)
- `CompareStrategies` MCP tool available (PRD-20)
- At least 90 days of historical OHLCV data in the warehouse
- `strategy-slots.json` readable to know current production slots

## Steps

### Step 1: Query Discovery Mart

Use `QueryAnalytics` to pull top candidates from `mart_discovery_candidates`.

```json
{
  "tool": "QueryAnalytics",
  "cube": "mart_discovery_candidates",
  "filters": {
    "sharpe_ratio": { "gte": 1.2 },
    "win_rate": { "gte": 0.50 },
    "profit_factor": { "gte": 1.5 },
    "total_trades": { "gte": 30 }
  },
  "order_by": "sharpe_ratio DESC",
  "limit": 20
}
```

### Step 2: Filter Out Existing Production Slots

Read `strategy-slots.json` and cross-reference with query results. Remove any scanner/strategy combos already in production. Aim for at least 5 net-new candidates.

### Step 3: Use DiscoverStrategy for Enriched Analysis

For the top 5 candidates, call `DiscoverStrategy` to get enriched metadata including regime sensitivity, sector concentration, and drawdown profile.

```json
{
  "tool": "DiscoverStrategy",
  "strategy_ids": ["<id1>", "<id2>", "..."]
}
```

### Step 4: Run Full Backtest

For each surviving candidate, run a full backtest via `RunBacktest` with a realistic date range (minimum 1 year, preferably 2+).

```json
{
  "tool": "RunBacktest",
  "strategy": "<strategy_name>",
  "scanner": "<scanner_name>",
  "start_date": "2023-01-01",
  "end_date": "2024-12-31",
  "mode_config": {
    "max_positions": 10,
    "position_size_pct": 0.10,
    "stop_loss_pct": 0.07,
    "take_profit_pct": 0.15,
    "horizon_days": 15
  }
}
```

### Step 5: Compare Against Production Baseline

For each candidate that passes backtest (Sharpe > 1.2, WR > 50%, MaxDD < 20%), compare against the weakest current production slot.

```json
{
  "tool": "CompareStrategies",
  "baseline": "<weakest_production_slot_id>",
  "candidate": "<new_strategy_id>",
  "metrics": ["sharpe", "sortino", "win_rate", "profit_factor", "max_drawdown", "calmar"]
}
```

### Step 6: Present Findings

Generate a summary table:

| Candidate | Sharpe | WR | PF | MaxDD | Trades | Regime Fit | vs Baseline |
|-----------|--------|----|----|-------|--------|------------|-------------|
| ...       | ...    | ...| ...| ...   | ...    | ...        | +/- X%      |

Include equity curve data and regime sensitivity heatmap if available.

### Step 7: Generate StrategySlot Config Template

If approved by user, generate a `StrategySlot` config template ready for insertion into `strategy-slots.json`:

```json
{
  "id": "<new-slot-id>",
  "name": "<human-readable-name>",
  "scanner": "<scanner_name>",
  "strategy": "<strategy_name>",
  "mode": "balanced",
  "enabled": false,
  "config": { "..." }
}
```

Set `enabled: false` — operator must explicitly enable in production.

## MCP Tools Used

| Tool | Purpose |
|------|---------|
| QueryAnalytics | Pull candidates from mart_discovery_candidates with metric filters |
| GetMart | Load full mart_discovery_candidates dataset |
| DiscoverStrategy | Enriched metadata: regime sensitivity, sector concentration |
| RunBacktest | Full historical validation before promotion |
| CompareStrategies | Side-by-side vs weakest production slot |

## Output

- Ranked candidate table (Sharpe, WR, PF, MaxDD, Trades, Regime Fit)
- Per-candidate backtest result JSON in `data/backtest-results/`
- `StrategySlot` config template (ready for `strategy-slots.json`, `enabled: false`)
- Comparison report vs current production baseline

## Error Handling

- **Mart empty or stale**: Check when `mart_discovery_candidates` was last refreshed via `RunTransformation`. If >24h, trigger refresh before proceeding.
- **Backtest insufficient trades (<30)**: Extend date range or lower bar; if still <30 trades, disqualify candidate.
- **CompareStrategies timeout**: Fall back to manual metric comparison from backtest JSON output.
- **No candidates pass filters**: Relax `profit_factor` to 1.3 and retry; document the relaxation in findings.

## Examples

### Example 1: Monthly Strategy Review

```
User: "Run the monthly strategy discovery"
→ QueryAnalytics(mart_discovery_candidates, filters={sharpe>=1.2, wr>=50%, pf>=1.5, trades>=30})
→ Returns 8 candidates
→ Filter: 3 already in production → 5 net-new
→ DiscoverStrategy([5 ids]) → regime fit scores
→ RunBacktest × 5 (2023-01-01 to 2024-12-31)
→ 2 candidates pass all thresholds
→ CompareStrategies(weakest_slot, candidate_A) → +18% Sharpe improvement
→ Output: table + config template for candidate_A
```

### Example 2: Regime-Specific Discovery

```
User: "Find strategies that work in risk-off regimes"
→ QueryAnalytics(mart_discovery_candidates, filters={regime_fit_risk_off>=0.60, sharpe>=1.0})
→ 4 candidates → RunBacktest with stress period (2022-01-01 to 2022-12-31)
→ 2 survive → generate config templates
```
