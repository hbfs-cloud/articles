---
name: add-strategy
description: Add a new mechanical strategy to the Go engine — from interface implementation through backtest validation and mart registration
version: 1.0.0
---

# Add Strategy

## When to Use

- Building a net-new mechanical strategy (momentum, mean-reversion, pairs, etc.)
- Porting a scanner-based strategy to a Go mechanical implementation for speed
- Adding a strategy for a new asset class or region not yet covered
- User asks to "add a new strategy" or "implement a scanner for X"

## Prerequisites

- Go 1.24 development environment configured
- Go bridge stdio JSON-RPC server running and testable locally
- `internal/scanner/factory.go` accessible for scanner registration
- `scanner-defaults.json` and `strategy-templates.json` writable
- `RunBacktest` MCP tool available (PRD-20) for validation
- `RunTransformation` MCP tool available (PRD-24) to refresh analytics marts

## Steps

### Step 1: Choose Asset Class, Region, and Timeframe

Define the strategy's scope before writing any code:

| Dimension | Examples |
|-----------|---------|
| Asset class | Equities, ETFs, Crypto, Forex, Futures |
| Region | US, EU, APAC, Global |
| Timeframe | Intraday (1m/5m/15m), Daily, Weekly |
| Edge type | Momentum, Mean-reversion, Breakout, Pairs, Stat-arb |

Document the hypothesis: "This strategy exploits X because Y, with expected edge Z."

### Step 2: Implement OpportunityScanner Interface in Go

All scanners must implement the `OpportunityScanner` interface:

```go
// internal/scanner/interface.go
type OpportunityScanner interface {
    Name() string
    Scan(ctx context.Context, bars map[string][]Bar) ([]Signal, error)
}
```

Create the file `internal/scanner/<strategy_name>.go`:

```go
package scanner

import "context"

type MomentumRsiDivergence struct {
    // configurable params with defaults
    RSIPeriod    int     `json:"rsi_period"`
    MinScore     float64 `json:"min_score"`
    LookbackDays int     `json:"lookback_days"`
}

func (s *MomentumRsiDivergence) Name() string {
    return "momentum-rsi-divergence"
}

func (s *MomentumRsiDivergence) Scan(ctx context.Context, bars map[string][]Bar) ([]Signal, error) {
    var signals []Signal
    for ticker, barSlice := range bars {
        score := s.computeScore(barSlice)
        if score >= s.MinScore {
            signals = append(signals, Signal{
                Ticker:    ticker,
                Score:     score,
                ScanDate:  barSlice[len(barSlice)-1].Date,
                ScannerID: s.Name(),
            })
        }
    }
    return signals, nil
}
```

### Step 3: Register Scanner in Factory

Add the scanner to `internal/scanner/factory.go`:

```go
func NewScanner(name string, config json.RawMessage) (OpportunityScanner, error) {
    switch name {
    // ... existing cases ...
    case "momentum-rsi-divergence":
        s := &MomentumRsiDivergence{
            RSIPeriod:    14,   // defaults
            MinScore:     85.0,
            LookbackDays: 20,
        }
        if config != nil {
            if err := json.Unmarshal(config, s); err != nil {
                return nil, err
            }
        }
        return s, nil
    }
    return nil, fmt.Errorf("unknown scanner: %s", name)
}
```

### Step 4: Add Default Config to scanner-defaults.json

```json
{
  "momentum-rsi-divergence": {
    "rsi_period": 14,
    "min_score": 85.0,
    "lookback_days": 20,
    "description": "RSI divergence momentum scanner — US equities, daily bars"
  }
}
```

### Step 5: Create StrategySlot Template

Add to `strategy-templates.json`:

```json
{
  "id": "momentum-rsi-divergence-balanced",
  "name": "RSI Divergence Momentum (Balanced)",
  "scanner": "momentum-rsi-divergence",
  "strategy": "momentum",
  "mode": "balanced",
  "enabled": false,
  "config": {
    "max_positions": 10,
    "position_size_pct": 0.10,
    "stop_loss_pct": 0.07,
    "take_profit_pct": 0.15,
    "horizon_days": 15,
    "min_score": 85,
    "vix_kill_threshold": 30,
    "circuit_breaker_pct": 15
  }
}
```

Set `enabled: false` — operator must explicitly enable.

### Step 6: Run Backtest — Minimum Validation Thresholds

```bash
# Via Go bridge directly
go test ./internal/scanner/... -run TestMomentumRsiDivergence -v

# Full backtest via MCP
# RunBacktest(strategy="momentum-rsi-divergence", start="2022-01-01", end="2024-12-31")
```

Minimum thresholds for promotion:
- Total trades: ≥ 100
- Sharpe ratio: ≥ 1.0
- Win rate: ≥ 45%
- Profit factor: ≥ 1.3
- Max drawdown: ≤ 25%

If thresholds not met, adjust scanner params and repeat. Document each iteration.

### Step 7: Refresh Discovery Marts

After passing backtest, add strategy to the analytics layer:

```json
{
  "tool": "RunTransformation",
  "transformation": "refresh_discovery_candidates",
  "include_scanner": "momentum-rsi-divergence"
}
```

This makes the strategy visible in `mart_discovery_candidates` for the `discover-strategy` skill.

### Step 8: Update Package CLAUDE.md

In `internal/scanner/CLAUDE.md` (or root CLAUDE.md Go bridge section), add:
- Scanner name and file path
- Required bar fields (OHLCV + which indicators)
- Config params and their valid ranges
- Known limitations or exclusion criteria

### Step 9: Create PR

PR checklist for new strategy:
- [ ] `OpportunityScanner` interface fully implemented
- [ ] Registered in `factory.go`
- [ ] Default config in `scanner-defaults.json`
- [ ] Strategy template in `strategy-templates.json` (`enabled: false`)
- [ ] Unit tests: `TestMomentumRsiDivergence` with ≥3 test cases
- [ ] Backtest: ≥100 trades, Sharpe≥1.0
- [ ] Discovery mart refreshed
- [ ] Package CLAUDE.md updated
- [ ] No speculative code (Simplicity First)

## MCP Tools Used

| Tool | Purpose |
|------|---------|
| RunBacktest | Full historical validation (minimum 2 years) |
| CompareStrategies | Optional: compare vs similar existing scanner |
| RunTransformation | Refresh mart_discovery_candidates with new scanner |
| ListMarts | Verify scanner appears in discovery data |

## Output

- `internal/scanner/<strategy_name>.go` — scanner implementation
- `internal/scanner/<strategy_name>_test.go` — unit tests
- Updated `internal/scanner/factory.go` — registration
- Updated `scanner-defaults.json` — default config
- Updated `strategy-templates.json` — slot template (`enabled: false`)
- Backtest result in `data/backtest-results/<strategy>-<date>.json`
- Updated package CLAUDE.md

## Error Handling

- **Interface compliance error**: Run `go build ./...` — compiler will catch missing methods.
- **Backtest returns 0 signals**: Check that bar data covers the lookback window; verify scanner logic computes non-zero scores.
- **Factory switch-case not reached**: Verify the `name` string matches exactly between `Name()` and the switch case (case-sensitive).
- **RunTransformation timeout**: Marts can take 2-5 min to refresh; retry once before escalating.
- **Backtest below thresholds after 3 iterations**: Escalate to user — the edge hypothesis may not hold. Do not force-promote.

## Examples

### Example 1: Momentum Scanner for US Equities

```
Hypothesis: RSI divergence + volume surge on daily bars → 5-15 day momentum
→ Step 2: implement MomentumRsiDivergence.Scan() in Go
→ Step 3: register "momentum-rsi-divergence" in factory
→ Step 4: defaults: rsi_period=14, min_score=85, lookback=20
→ Step 5: template slot balanced, enabled=false
→ Step 6: RunBacktest 2022-2024 → 143 trades, Sharpe=1.28, WR=55% → PASS
→ Step 7: RunTransformation → appears in mart_discovery_candidates
→ Step 8: CLAUDE.md updated, PR created
```

### Example 2: Mean-Reversion Scanner for EU Equities

```
Hypothesis: Bollinger Band squeeze + RSI oversold on EU daily bars
→ implement BollingerMeanReversionEU.Scan()
→ factory case: "bollinger-mr-eu"
→ Backtest 2022-2024 → 78 trades (below 100 threshold)
→ Extend range to 2021-2024 → 112 trades, Sharpe=1.05 → PASS
→ PR created, strategy visible in discovery mart
```
