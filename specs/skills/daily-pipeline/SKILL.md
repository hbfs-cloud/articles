---
name: daily-pipeline
description: Run the full daily trading pipeline — data collection through execution, reporting, and QA
version: 1.0.0
---

# Daily Pipeline

## When to Use

- After publishing a scanner (triggered automatically post-publish)
- Manual re-run if a pipeline step failed overnight
- Testing pipeline end-to-end in a staging environment
- User asks to "run the pipeline" or "do the daily run"

## Prerequisites

- Scanner HTML published and indexed (`scanner/YYYYMMDD/index.html` exists)
- `MCP_GATEWAY_URL` exported: `export MCP_GATEWAY_URL=https://gateway.dailytickers.com/mcp`
- Go bridge running (for mechanical strategy slots)
- Broker credentials set in environment (Alpaca, IBKR, Saxo, T212, Binance as applicable)
- `tools/trading-executor/config.json` configured with mode/broker pairs

## Steps

### Step 1: Data Collection

Run MCP data collection for scanner signals:

```bash
# MCP: market overview + regime
# GetMarketOverview → trending, sectors, calendar
# GetRegimeProbability(model=ensemble, horizon=5)
# RunAutoScreener → primary signal set
# RunScreener × 3 (custom DSL + EU + APAC + ETFs)
```

For mechanical slots, Go bridge loads OHLCV via stdio JSON-RPC automatically when `run-session.js` starts.

### Step 2: Risk Gating (Pre-Signal)

Before finalizing the signal set, apply 4 mandatory gates:

```bash
# Gate 1: Regime check
# GetRegimeProbability → if crisis > 0.30 or early_risk_off > 0.50:
#   → reduce top to 5 signals, breakout_only mode, size × 0.5

# Gate 2: Correlation filter
# GetCorrelationMatrix(window=60, pearson)
# → max_pair.rho > 0.85 → drop lower-scored ticker
# → avg_off_diagonal > 0.65 → enforce min 2 sectors

# Gate 3: Earnings exclusion
# GetEarningsCalendarFiltered(days_ahead=7, min_expected_move=4)
# → tickers in exclusion_window → DISQUALIFY or tag "earnings risk"

# Gate 4: Position sizing
# OptimizeSizing(mode=balanced, method=vol_target, max_position_risk_pct=1.0, max_pairwise_correlation=0.7)
# → use returned risk_pct per ticker
```

### Step 3: Position Tracking & Exit Triggers

```bash
node tools/update-tracking.js
```

Fetches live prices via Yahoo Finance for all open positions. Evaluates SL/TP/expiry triggers. Marks positions as closed where triggered.

### Step 4: Sweep — Append Closed Trades

```bash
node tools/sweep.js
```

Default (safe) mode: appends only newly closed trades to `backtest-trades.json`. Does NOT modify historical entries. Does NOT run grid search.

### Step 5: Risk Metrics Refresh

```bash
MCP_GATEWAY_URL=https://gateway.dailytickers.com/mcp \
  node tools/refresh-risk-metrics.js
```

Computes and writes to `data/risk-snapshots.json`:
- VaR (per mode)
- Stress test results
- Correlation matrix snapshot
- Regime probability

If `MCP_GATEWAY_URL` not set → script runs with `--stub` (writes empty schema). **Never accept stub silently** — always export the URL.

### Step 6: Status Page & Public API

```bash
node tools/gen-status-page.js    # Dashboard per mode (reads risk-snapshots.json)
node tools/gen-api.js            # Refresh 50+ public JSON endpoints
```

### Step 7: Media, Notifications & Git Push

```bash
./tools/publish-daily-card.sh
```

This script handles:
- QA check (step 7 internally — must show 0 ❌)
- Mode card image generation
- Telegram notifications per mode topic
- Final `git push origin main`

### Step 8: Plan Generation & Execution

```bash
node tools/trading-executor/run-session.js
```

Iterates all configured mode/broker pairs from `config.json`:
1. Generates trading plan per pair
2. Connects to broker adapter
3. Reconciles open positions
4. VIX kill check
5. Places entry orders (VWAP gate, gap-up check, spread check)
6. Sets bracket exits (SL + TP1 50% + TP2)
7. Sends Telegram/Discord notifications per fill

### Step 9: Post-Pipeline QA Checklist

Verify manually after pipeline completes:

- [ ] `qa-check.js` showed 0 ❌ (warnings investigated, not dismissed)
- [ ] `scanner/status/index.html` — no "Pending (Nd/Md)" on trades with past `exitDate`
- [ ] "Orders to Place" count matches visible rows per mode
- [ ] `data/risk-snapshots.json` is not a stub empty schema
- [ ] Telegram notifications sent (check each mode topic)
- [ ] Git push succeeded (`git log --oneline -1` shows today's commit)

## MCP Tools Used

| Tool | Purpose |
|------|---------|
| GetMarketOverview | Trending topics, sector rotations, economic/earnings calendar |
| RunAutoScreener | Primary signal generation |
| RunScreener | Custom DSL screeners (EU, APAC, ETFs) |
| GetRegimeProbability | Regime gate — crisis/risk-off detection |
| GetCorrelationMatrix | Correlation gate — avoid clustered positions |
| GetEarningsCalendarFiltered | Earnings exclusion gate |
| OptimizeSizing | Risk-adjusted position sizing per slot |
| QueryData | Live price quotes for position tracking |

## Output

- `data/risk-snapshots.json` — VaR, stress, correlation, regime
- `scanner/status/index.html` — updated dashboard per mode
- `portfolio/v1/{mode}/*.json` — 50+ public API endpoints refreshed
- Trading plans in `data/trading-plans/`
- Broker orders placed (or paper-simulated)
- Telegram/Discord notifications sent per mode topic

## Error Handling

- **MCP down (scanner signals)**: Skip scanner signal collection; continue with mechanical Go bridge slots. Log MCP outage. Do not halt pipeline.
- **Go bridge down (mechanical slots)**: Skip mechanical slots; continue with scanner slots. Log bridge error.
- **Broker adapter error**: Log error per broker, skip that broker, continue others. Send error notification to Telegram.
- **refresh-risk-metrics.js fails**: If `MCP_GATEWAY_URL` was set and it still fails, investigate MCP gateway health before accepting stub. Check `curl $MCP_GATEWAY_URL/health`.
- **publish-daily-card.sh timeout on video**: Fallback to text notification (patched in script). Pipeline continues.
- **qa-check.js shows ❌**: Stop, investigate, fix, re-run step 7. Do not push with failures.
- **BSD date arithmetic errors**: Use the `date -v` BSD fallback in publish-daily-card.sh. Never use `date -d` without fallback on macOS.

## Examples

### Example 1: Normal Weekday Pipeline

```
23:05 Scanner published → publish.js --no-notify completes
→ Step 1: RunAutoScreener → 47 candidates → 10 pass dilution + risk gates
→ Step 2: Regime=risk-on, no correlation issues, no earnings conflicts
→ Step 3: update-tracking.js → 2 positions hit TP1
→ Step 4: sweep.js → appends 2 closed trades
→ Step 5: refresh-risk-metrics.js → VaR updated per mode
→ Step 6: gen-status-page + gen-api → 50 endpoints refreshed
→ Step 7: publish-daily-card.sh → QA 0❌, Telegram sent, git push
→ Step 8: run-session.js → 3 mode×broker pairs → 7 orders placed
```

### Example 2: Crisis Regime — Reduced Pipeline

```
GetRegimeProbability → crisis=0.38 (> 0.30 threshold)
→ Step 2 gate: reduce top to 5 signals, breakout_only, size × 0.5
→ run-session.js → 5 orders placed (reduced sizes)
→ Telegram notification includes "⚠️ Crisis regime: reduced sizing"
```
