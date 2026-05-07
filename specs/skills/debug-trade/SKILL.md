---
name: debug-trade
description: Debug why a trade was taken, missed, or exited incorrectly — trace the full decision chain from signal to fill
version: 1.0.0
---

# Debug Trade

## When to Use

- A trade was taken that shouldn't have been (false positive)
- An expected trade was never placed (missed signal)
- A position exited at the wrong price or wrong time
- Broker fill doesn't match the planned order
- User asks "why did it buy X?" or "why didn't it trade Y?"

## Prerequisites

- Ticker, approximate date, and slot ID known
- `QueryAnalytics` MCP tool available (PRD-24)
- `GetTradeExplanation` MCP tool available (PRD-21)
- Access to `data/trading-plans/` directory
- Broker adapter logs accessible (check `logs/` or Telegram history)

## Steps

### Step 1: Identify the Trade

Collect the key identifiers:
- **Ticker**: e.g., `AAPL`
- **Scan date**: the date the signal was (or wasn't) generated
- **Slot ID**: e.g., `momentum-breakout-balanced`
- **Mode**: turbo / dynamic / balanced / secured / fortress / tkl
- **Issue type**: taken unexpectedly / missed / wrong exit

### Step 2: Look Up the Signal

```json
{
  "tool": "QueryAnalytics",
  "cube": "signals",
  "filters": {
    "ticker": "AAPL",
    "scan_date": "2026-05-07",
    "slot_id": "momentum-breakout-balanced"
  }
}
```

Expected output: signal record with score, scanner output, contributing indicators.

- **Signal found, score ≥ min_score**: signal was generated → proceed to Step 3 (risk gating)
- **Signal found, score < min_score**: filtered at scanner level → root cause is signal quality
- **Signal not found**: scanner never produced it → check scanner logic or data gap

### Step 3: Trace Risk Gating

Check each of the 4 risk gates in order:

**Gate 1 — Regime**
```json
{
  "tool": "GetRegimeProbability",
  "model": "ensemble",
  "horizon": 5,
  "as_of": "2026-05-07"
}
```
Was `crisis > 0.30` or `early_risk_off > 0.50`? If yes → signal pool was reduced to 5 / breakout-only mode. Was the ticker ranked outside the top 5?

**Gate 2 — Correlation**
```json
{
  "tool": "GetCorrelationMatrix",
  "window": 60,
  "as_of": "2026-05-07"
}
```
Was the ticker's pairwise correlation > 0.85 with another position already selected? Was `avg_off_diagonal > 0.65` causing sector enforcement?

**Gate 3 — Earnings Exclusion**
```json
{
  "tool": "GetEarningsCalendarFiltered",
  "days_ahead": 7,
  "min_expected_move": 4,
  "as_of": "2026-05-07"
}
```
Was the ticker in an exclusion window (earnings within ±7 days)?

**Gate 4 — Sizing**
```json
{
  "tool": "OptimizeSizing",
  "mode": "balanced",
  "method": "vol_target",
  "max_position_risk_pct": 1.0,
  "max_pairwise_correlation": 0.7
}
```
Was the ticker dropped because portfolio capacity was exhausted (max positions reached) or risk budget used up?

### Step 4: Check Trading Plan Generation

Look at the trading plan file for the scan date:

```bash
ls data/trading-plans/ | grep "balanced.*20260507"
# e.g., balanced-alpaca-20260507.json
```

Open the plan and search for the ticker:
- **Found in plan**: signal survived gating → proceed to Step 5 (execution)
- **Not in plan**: gating eliminated it → Step 3 identified the gate

### Step 5: Check Execution

If the ticker was in the plan but the order wasn't placed or filled correctly:

Check broker adapter logs. Search Telegram history for the session's fill notifications.

Key execution checks:
- **VWAP gate**: was the entry price above VWAP at order time? (Entry only allowed near/below VWAP)
- **Gap-up check**: did the ticker gap up >2% at open? (Filtered to prevent chasing)
- **Spread check**: was bid-ask spread too wide? (Filtered if spread > threshold)
- **Bracket order**: were SL and TP brackets set correctly after fill?

### Step 6: For Wrong Exit — Check Exit Logic

If the position exited at wrong price or wrong time, check exit priority:

```
Priority 1 (highest): Stop-Loss → currentPrice <= slPrice
Priority 2: TP2 → currentPrice >= tp2Price → close 100%
Priority 3: TP1 → currentPrice >= tp1Price → close 50%
Priority 4: Expiry → today >= entryDate + horizon_days → close 100%
```

Verify price data accuracy:
```json
{
  "tool": "QueryData",
  "types": ["bars_daily"],
  "symbols": ["AAPL"],
  "start": "2026-05-05",
  "end": "2026-05-07"
}
```

Check if the bar data shows an intraday wick that triggered SL without closing below it (wick-stop scenario).

### Step 7: Get AI Trade Explanation

```json
{
  "tool": "GetTradeExplanation",
  "ticker": "AAPL",
  "scan_date": "2026-05-07",
  "slot_id": "momentum-breakout-balanced"
}
```

This returns a structured explanation of all gates passed/failed, contributing factors, and the final decision.

### Step 8: Output Decision Trace

Produce a decision trace with evidence at each step:

```
TRADE DEBUG: AAPL | 2026-05-07 | momentum-breakout-balanced
================================================
[1] Signal: FOUND — score=91, scanner=momentum-breakout, indicators: RSI=62, RVOL=1.8
[2] Regime gate: PASS — crisis=0.12, risk_off=0.28 (no kill)
[3] Correlation gate: PASS — max_pair_rho=0.71 with MSFT (below 0.85)
[4] Earnings gate: PASS — next earnings 2026-05-28 (21 days away)
[5] Sizing gate: PASS — risk_pct=0.95%, 8/10 positions filled
[6] Trading plan: FOUND in balanced-alpaca-20260507.json
[7] Execution: VWAP gate PASS, gap-up PASS (gap=0.3%), spread PASS
[8] Fill: order placed at $182.50, bracket SL=$169.73, TP1=$196.89, TP2=$209.88
ROOT CAUSE: None — trade executed correctly as designed
```

## MCP Tools Used

| Tool | Purpose |
|------|---------|
| QueryAnalytics | Look up signal record with score and indicators |
| GetTradeExplanation | AI-generated structured decision trace |
| GetRegimeProbability | Verify regime gate status at scan time |
| GetCorrelationMatrix | Verify correlation gate — pairwise rho at scan time |
| GetEarningsCalendarFiltered | Verify earnings exclusion at scan time |
| OptimizeSizing | Verify sizing gate and position capacity |
| QueryData | Verify price data accuracy (bars_daily for exit debugging) |

## Output

- Decision trace: evidence at each gate (signal → regime → correlation → earnings → sizing → plan → execution → fill)
- Root cause identification: the specific gate or check that caused the discrepancy
- Recommendation: config change, data fix, or confirmation that behavior was correct

## Error Handling

- **Signal not in QueryAnalytics**: Mart may not be refreshed; check `RunTransformation` status. Alternatively, check scanner raw output in `scanner/YYYYMMDD/` HTML for the ticker.
- **GetTradeExplanation returns 404**: Trade may predate the explanation system (PRD-21); fall back to manual gate trace (Steps 2-6).
- **Historical regime/correlation data unavailable**: Check `data/risk-snapshots.json` for the date. If missing, reconstruct from `scanner-positions.json` and market data.
- **Broker logs missing**: Check Telegram notifications for the session — fills, errors, and rejections are all logged there.
- **Price data discrepancy**: Yahoo Finance and broker data can diverge on split-adjusted prices. Cross-check with broker's own OHLCV.

## Examples

### Example 1: Trade Taken Unexpectedly

```
Issue: SMCI appeared in fills but user didn't expect it
→ Step 2: QueryAnalytics → signal score=87 (above min_score=85) → signal valid
→ Step 3: all gates PASS
→ Step 4: found in trading plan
→ Step 5: VWAP gate PASS, no gap-up
→ Step 7: GetTradeExplanation confirms: "high RVOL (2.3×) + RSI breakout = valid A+ setup"
→ Root cause: Trade was correct. User wasn't aware the scanner captured this setup.
```

### Example 2: Missed Trade

```
Issue: NVDA not traded on 2026-05-06 despite strong price action
→ Step 2: QueryAnalytics → signal found, score=89
→ Step 3: Earnings gate → NVDA earnings 2026-05-07 (next day) → EXCLUDED
→ Root cause: Earnings exclusion gate (±7 days) correctly blocked the trade.
→ Recommendation: If user wants to trade earnings setups, adjust earnings gate config.
```

### Example 3: Early Exit

```
Issue: AAPL position closed after 3 days (horizon=15d)
→ Step 6: Check exit priority → SL hit? bars_daily shows intraday low=$169.50 < SL=$169.73
→ Wick-stop confirmed: intraday wick triggered SL; closing price was $172
→ Root cause: Wick-stop. Consider adding "close-only" SL mode to avoid wick triggers.
```
