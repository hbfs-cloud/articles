---
name: regime-check
description: Check current market regime (risk-on/neutral/risk-off/crisis) and assess implications for all active strategy slots. Use when evaluating whether to enter new positions, resize existing ones, or trigger VIX kill.
version: 1.0.0
---

# Regime Check

## When to Use

- Before running daily pipeline — verify regime hasn't shifted overnight
- After major market event (VIX spike, geopolitical shock, rate decision)
- When strategy health monitor flags regime drift
- Weekly regime assessment for portfolio rebalancing decisions
- When VIX kill or circuit breaker triggers — understand why and for how long

## Prerequisites

- MCP gateway accessible (`DT_MCP_GATEWAY_URL` set)
- Active strategy slots configured in `strategy-slots.json`
- Historical regime data in `mart_regime_analysis` (PRD-24)

## Steps

### Step 1: Fetch Current Regime

```
MCP: GetRegimeProbability(model="ensemble", horizon=5)
```

Response contains probability distribution across 5 states:
- `risk_on` — normal bullish conditions
- `neutral` — mixed signals, no strong direction
- `early_risk_off` — deteriorating conditions, caution warranted
- `risk_off` — defensive positioning required
- `crisis` — extreme stress, halt most entries

### Step 2: Fetch VIX Level

```
MCP: QueryData(symbols="^VIX", types="quote")
```

Map VIX to regime bands:
- VIX < 15: RISK-ON
- VIX 15-20: NEUTRAL
- VIX 20-28: EARLY RISK-OFF
- VIX > 28: RISK-OFF / CRISIS

### Step 3: Compare with Previous Regime

```
MCP: GetMart(mart="mart_regime_analysis", filters={date_range: "last_7d"})
```

Detect regime transitions:
- Same regime 3+ days → stable (no action)
- Shift detected → flag for recalibration review
- VIX crossing slot-specific kill thresholds → immediate action

### Step 4: Assess Per-Slot Impact

For each active strategy slot, evaluate:

| Slot Parameter | Risk-On | Neutral | Early Risk-Off | Risk-Off | Crisis |
|---------------|---------|---------|----------------|----------|--------|
| Entries allowed | Yes | Yes | Breakout only | No | No |
| Position size | 100% | 100% | 50% | 25% | 0% |
| VIX kill active | No | No | Check threshold | Likely yes | Yes |
| New signals | Full pool | Full pool | Top 5 only | None | None |

Cross-reference each slot's `vixKill` threshold from config:
- Turbo: 25
- Dynamic: 25
- Balanced: 28
- Secured: 22
- Fortress: 20
- TKL: 28

### Step 5: Check Correlation Environment

```
MCP: GetCorrelationMatrix(symbols=[top holdings], window=60, method="pearson")
```

- `avg_off_diagonal > 0.65` → correlation regime (everything moves together, diversification fails)
- `max_pair.rho > 0.85` → specific pair risk

### Step 6: Generate Regime Report

Output structured assessment:

```
REGIME: EARLY RISK-OFF (probability: 0.52)
VIX: 23.4 (above Fortress kill=20, Secured kill=22)
TRANSITION: NEUTRAL → EARLY RISK-OFF (2 days)
STABILITY: Unstable (< 3 consecutive days)

SLOT IMPACT:
  turbo:    ENTRIES ALLOWED (VIX < 25), size reduced 50%
  dynamic:  ENTRIES ALLOWED (VIX < 25), size reduced 50%
  balanced: ENTRIES ALLOWED (VIX < 28), breakout only
  secured:  VIX KILL ACTIVE (VIX 23.4 > kill 22)
  fortress: VIX KILL ACTIVE (VIX 23.4 > kill 20)
  tkl:      ENTRIES ALLOWED (VIX < 28), breakout only

RECOMMENDATIONS:
  - Pause entries for secured and fortress slots
  - Reduce position sizes 50% for turbo and dynamic
  - Monitor for 3-day stability before resuming normal sizing
  - Run /review-strategy on all slots if regime persists > 5 days
```

### Step 7: Trigger Actions (if applicable)

- If regime shift confirmed (3 days stable at new regime):
  - Run `regime-recalibrate.js --apply` to update mode parameters
  - Notify via Telegram (topic per affected slot)
- If VIX kill triggered: log in `data/risk-snapshots.json`, halt entries for affected slots

## MCP Tools Used

| Tool | Purpose |
|------|---------|
| `GetRegimeProbability` | Current regime probability distribution |
| `QueryData(types=quote)` | Live VIX level |
| `GetMart(mart_regime_analysis)` | Historical regime data for transition detection |
| `GetCorrelationMatrix` | Cross-asset correlation environment |
| `GetPortfolioStressTest` | Stress test under current regime |

## Output

- Regime assessment report (structured text)
- Per-slot impact table with actions
- Recommendations (enter/hold/reduce/halt)
- Optional: trigger recalibration if regime shift stable 3+ days

## Error Handling

- **MCP gateway down**: Use last known regime from `data/risk-snapshots.json`. Flag as stale.
- **VIX data unavailable**: Fall back to SPX intraday volatility estimate.
- **Regime model disagrees with VIX**: Report both signals, recommend the more conservative interpretation.

## Examples

### Example 1: Routine Monday Check

```
> /regime-check

REGIME: RISK-ON (probability: 0.71)
VIX: 14.2
All slots: normal entries, full sizing
No action required.
```

### Example 2: VIX Spike After Fed Decision

```
> /regime-check

REGIME: EARLY RISK-OFF → RISK-OFF transition in progress
VIX: 29.8 (above ALL slot thresholds)
ALL SLOTS: VIX KILL ACTIVE
Action: Halt all new entries. Monitor for 2-day stability.
Run: /review-strategy on all slots to assess open position risk.
```
