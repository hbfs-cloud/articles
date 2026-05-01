# /scanner — Full scanner pipeline (MCP → publish → downstream → QA)

End-to-end scanner pipeline for the next trading session.

## Input

`$ARGUMENTS` — Options:
- *(empty)* — auto-detect next trading day, full pipeline with validation
- `--date YYYYMMDD` — target a specific scan date
- `--skip-validation` — skip the 7-agent QA pass (faster, routine scans)
- `--skip-downstream` — stop after publish (no sweep, status page, API, Telegram)
- `--dry-run` — generate data.json only, no publish or push

## Phase 0 — Date Resolution & Anti-Doublon

1. Compute target scan date:
   - Weekday before 22h30 → today
   - Weekday after 22h30 → D+1
   - Friday after 22h30 → Monday
   - Saturday → Monday
   - Sunday → Monday
2. Check `data/scanner.json` for existing entry at target date → abort if duplicate
3. Read previous scan (`ls scanner/ | sort | tail -1`) for anti-doublon filter (max 3 repeat tickers)
4. Read `data/scanner-positions.json` for blocked tickers (open positions)
5. Read `data/scanner-filters.json` for sector_map + diversification rules

## Phase 1 — MCP Data Collection

Run in parallel:

```
mcp__dailytickers__GetMarketOverview()
mcp__dailytickers__RunAutoScreener()
mcp__dailytickers__RunScreener(expression="...", region="us")   # 3 DSL strategies
mcp__dailytickers__RunScreener(expression="...", region="eu")
```

Wait for async jobs via `CheckJobStatus`. Extract:
- Regime (risk-on/risk-off/neutral), VIX, SPX level
- Top movers, sector variations, trending themes
- Screener candidates with scores

## Phase 2 — Ticker Selection & Validation

### Selection Rules (scanner-filters.json)
- Score >= 90 (v4 risk layer threshold)
- Min 3 confluence signals per setup
- Diversification: min 5 US + 2 EU + 1 APAC + 2 ETFs
- Max 3 per sector (per sector_map)
- Max 3 repeats from previous scan
- Zero overlap with scanner-positions.json open_positions
- No earnings within ±3 trading days

### Anti-Dilution v2 (OBLIGATOIRE)
For each candidate, check:
```
mcp__dailytickers__QueryData(symbols="TICKER", types="sec_filings,flags", days=180)
```
Disqualify on: dilution_risk_score >= 70, shelf_active, atm_program_active, aggressive_underwriter, ITM warrants, recent PIPE/reverse split.

### Risk Gating (OBLIGATOIRE)
Before finalizing top 10:
- Regime check: crisis > 0.30 or early_risk_off > 0.50 → reduce to 5, breakout_only
- Correlation: max_pair rho > 0.85 → drop lowest score
- Earnings calendar: ±7 days, expected_move > 4% → disqualify or tag

### Sharia Compliance
Tag each setup: `sharia: true/false` based on sector (haram), debt/market_cap > 33%, interest > 5% revenue, leveraged ETFs.

### Per-Ticker MCP Enrichment
For each of the 10 selected tickers:
```
mcp__dailytickers__QueryData(
  symbols="TICKER",
  types="quote,social_sentiment,capital_flow,insider_transactions,dark_pool,unusual_options,trading_signals"
)
```

## Phase 3 — Data Generation

1. Generate `scanner/YYYYMMDD/data.json` following `scanner/template/schema.json` exactly
2. Generate `scanner/YYYYMMDD/signals.json` (simplified format for downstream tools)
3. Strategy labels ONLY: Momentum, Breakout, Pullback, Pre-Squeeze
4. R/R calculated from entry MIDPOINT (not entry_low) — must be >= 1.5 for all setups

## Phase 4 — Render & Publish

```bash
node tools/render-scanner.js scanner/YYYYMMDD/
node tools/publish.js --type scanner --path scanner/YYYYMMDD/index.html --no-notify
```

If publish validation fails (filter violations), return to Phase 2 with the specific violations and re-select.

## Phase 5 — Downstream Pipeline (skip with --skip-downstream)

Run sequentially:
```bash
node tools/update-tracking.js
node tools/sweep.js
MCP_GATEWAY_URL=https://gateway.dailytickers.com/mcp node tools/refresh-risk-metrics.js
node tools/gen-status-page.js
node tools/gen-api.js
bash tools/publish-daily-card.sh
```

### Post-Pipeline Checklist
- QA check (`tools/qa-check.js`) must show 0 failures
- `scanner/status/index.html` — no stale "Pending" on expired trades
- `data/risk-snapshots.json` — not a stub if MCP_GATEWAY_URL was set
- signals.json strategy labels match HTML
- **Stats consistency**: verify hero stats (Closed Trades, WR, PF, Return, DD) in `scanner/status/index.html` match `frozen_` values in `data/backtest-results.json` for ALL 6 modes. Trade History count must also match. Mismatch → re-run `node tools/gen-status-page.js`
- **API consistency**: verify `portfolio/v1/{mode}/equity.json` contains non-null stats for all modes after `gen-api.js`
- **Trade integrity**: verify zero same-day expired trades (`holdDays===1 && status==='expired' && entryDate===exitDate`) in `data/backtest-trades.json`. Also verify zero early-expired trades (`holdDays < mode.horizon && status==='expired'`).
- **Sweep timing**: sweep.js returns null for trades without enough forward data (`lastDate < expireDate`). Safe — trade will be simulated on the next run when more OHLC bars are available.

## Phase 6 — Multi-Agent Validation (skip with --skip-validation)

Spawn 7 parallel validation agents:

| Agent | Role | Focus |
|-------|------|-------|
| Trader | Trade quality | Entry/stop/TP realism, R/R, tradability |
| Risk | Portfolio risk | Duplicates, diversification, correlation, DD exposure |
| Quant | Quantitative rigor | Score justification, R/R math, confluence independence |
| Analyst | Macro/fundamental | Regime coherence, catalysts, sector rotation logic |
| QA | Data integrity | Schema compliance, cross-file consistency, pipeline outputs |
| Dev | Code quality | HTML validity, script loading, performance |
| UX | User experience | Layout, mobile, charts, navigation, accessibility |

Each agent returns PASS/WARN/FAIL per check area with required fixes.

## Phase 7 — Fix & Re-Verify (if Phase 6 finds issues)

1. Collect all FAIL and WARN items from 7 agents
2. Fix data.json for content issues (scores, R/R, strategy labels, factual errors)
3. Re-render HTML: `node tools/render-scanner.js scanner/YYYYMMDD/`
4. Re-run publish validation
5. Re-spawn failing agents to verify fixes
6. Iterate until all agents return PASS (max 3 iterations)

## Phase 8 — Final Commit & Notify

```bash
git add scanner/YYYYMMDD/ data/ portfolio/ scanner/status/
git commit -m "feat: scanner YYYYMMDD — auto-published"
git push origin main
```

## Error Handling
- MCP screener returns empty → use GetMarketOverview top movers + manual candidate selection
- DSL screener scores all 0 → ignore DSL results, rely on AutoScreener only
- EU screener empty → fill EU slots from GetMarketOverview EU movers or known EU large-caps
- Sweep timeout → continue pipeline, sweep is not blocking
- Telegram notification fails → log warning, do not block
- refresh-risk-metrics.js without MCP_GATEWAY_URL → use --stub, flag in post-pipeline check
- Phase 6 validation loops > 3 → stop, report remaining issues to user
