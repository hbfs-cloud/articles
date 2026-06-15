# /scanner — Full scanner pipeline (MCP → publish → downstream → QA)

End-to-end scanner pipeline for the next trading session.

## ⛔ NO-SKIP POLICY (CRITICAL)

NEVER skip any phase, step, or per-ticker check without explicit user consent. Token budget / time pressure are NOT valid reasons. If a step seems too costly, ASK the user first and wait for the answer. Default = complete every step exactly as specified.

Mandatory per-ticker checks (run for EVERY candidate top-10 + every tkl_pool entry):
- Anti-dilution: `QueryData(symbols=T, types='sec_filings,flags', days=180)` — disqualify dilution_risk_score≥70, S-3 active, ATM, aggressive underwriter, ITM warrants, recent PIPE
- Per-ticker enrichment: `QueryData(symbols=T, types='quote,social_sentiment,capital_flow,insider_transactions,dark_pool,unusual_options,trading_signals')`
- Earnings proximity: `GetEarningsCalendarFiltered(days_ahead=7)` AND DSL `days_until_earnings('T') <= 3` check — DISQUALIFY if within ±3 trading days (or tag "earnings risk")
- Economic event proximity (per ticker currency): `is_near_economic_event(currency, min_priority=2, within_days=3)` — drop or tag

## ✅ MCP DSL Syntax Reference (verified working)

- Indicator variables: `rsi14`, `ema20`, `ema50`, `ema200`, `vwap`, `bbw`, `hhv20`, `hhv50`, `llv20`, `llv50`, `atrpct`, `obvz`, `sma50`, `sma200`, `vol`
- Indicator functions (series argument MUST be quoted): `sma('close', 50)`, `ema('close', 20)`, `rsi('close', 14)`, `atr(14)`, `hhv('close', 50)`, `pct_change('vwap', 3)`
- Pattern: `is_cup_handle()`, `near_breakout(0.02)`, `cross_up('ema20', 'ema50')`, `vol_spike45(1.5)`
- Signal: `rising('ema50', 10)`, `falling('vwap', 5)`, `inrange('rsi14', 45, 70, 10)`, `trend_strength(20)`
- Context: `market_cap`, `avg_volume`, `asset_type` (== 'stock' or 'etf'), `sector`, `industry`, `country`, `in_index`, `themes`
- Calendar: `days_until_earnings('AAPL') <= 3`, `is_near_economic_event('USD', 3, 2)`
- Relative strength: `perf_rank('sector', '', 20) <= 5` (max 3 args excluding kind), `perf_rel('sector', '', 20)` (no bench unless kind='etf')
- Macro: `vix() > 20`, `regime_score() >= 0.75`
- Multi-asset: `security('SPY', '1d', 'close', 1)`, `benchmark('SPY')`

⚠️ INVALID (do NOT use): `sma(close, 50)` (no quotes), `ma(close, 50)` (function doesn't exist), `asset_type=='etf'` inside pass_expr — use the separate `asset='etf'` param of RunScreener.

RunScreener call params: `pass_expr` (boolean filter), `score_expr` (numeric ranker), `region` ('us'/'eu'), `asset` ('stock' default, 'etf' for ETF universe), `top_k`, `force_async=true` recommended.

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
3. Read previous scan (`ls scanner/ | sort | tail -1`) for anti-doublon filter (min 70% new = max 3 repeats out of 10)
4. Read `data/scanner-positions.json` for blocked tickers (open positions)
5. Read `data/scanner-filters.json` for sector_map + diversification rules
6. Modes downstream = 6: `turbo`, `dynamic`, `balanced`, `secured`, `fortress`, `tkl`. TKL pool gated per-mode via `modes-config.json#tklPoolEnabled`.
7. Pre-flight: read `~/.claude/projects/-Users-marketwatchxyz-GolandProjects-articles/memory/feedback_pipeline_gotchas.md` for known regression traps (BSD date fallback, qa-check reads `signals.json` not HTML, Pending status, order count).
8. **Read `data/scanner-lessons.json`** — accumulated rules synthesized from prior weekly retrospectives. **The retros fuel the candidate-selection debate at Phase 2** — they do NOT block trades at publish-time. Apply during Phase 2 selection:
   - `severity: selection_filter` rules → use these to PICK better candidates upstream (e.g., favor names with stop ≥ 1.5× ATR, R/R ≥ regime threshold, RSI < 72, no earnings ±3d, no toxic underwriters). Each filter rule cites its rationale and source retros — incorporate the reasoning during selection.
   - `severity: advisory` rules → bias selection (e.g., favor Momentum in RISK-ON per `momentum-favored-risk-on`; lift Pre-Squeeze weight in EARLY RISK-OFF per `pre-squeeze-early-risk-off`). Deviations OK with rationale.
   - `severity: hard_block` rules → encoded in `scanner-filters.json` + enforced by `validate-scan.js` at publish (strategy whitelist, sector cap, scan size, absolute stop %, sharia ETF blocklist).
   - `severity: infrastructure` rules → enforced downstream (sweep.js, signal-monitor.js, portfolio API).
   - Cross-reference `_open_questions` — if a question targets the current scan (`next_retro_check ≤ today`), test the hypothesis and report in Phase 6 QA.

   **Output of validate-scan.js may emit non-blocking advisories** (lesson-rule deviations such as stop < 1.5× ATR, RSI > 72, R/R below regime threshold). These are educational signals for the NEXT scan iteration — not gates on the current one.

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
Before finalizing top 10, run 4 MCP checks:
```
mcp__dailytickers__GetRegimeProbability(model="ensemble", horizon=5)
mcp__dailytickers__GetCorrelationMatrix(symbols=[top10], window=60, method="pearson")
mcp__dailytickers__GetEarningsCalendarFiltered(days_ahead=7, min_expected_move=4)
mcp__dailytickers__OptimizeSizing(mode="balanced", method="vol_target", max_position_risk_pct=1.0, max_pairwise_correlation=0.7)
```
- Regime: `crisis > 0.30` or `early_risk_off > 0.50` → reduce to 5, breakout_only, size × 0.5
- Correlation: `max_pair.rho > 0.85` → drop lowest score; `avg_off_diagonal > 0.65` → force min 2 sectors
- Earnings: ticker in `exclusion_window` → DISQUALIFY or tag "earnings risk"
- Sizing: use `risk_pct` returned to set position size

### Sharia Compliance
Tag each setup: haram sector, debt/mcap > 33%, interest > 5% revenue, leveraged/bond ETFs.
DOM contract: `data-sharia="true|false"` on BOTH `<tr>` synthesis row AND `<div class="setup-card">`.

### Per-Ticker MCP Enrichment
For each of the 10 selected tickers:
```
mcp__dailytickers__QueryData(
  symbols="TICKER",
  types="quote,social_sentiment,capital_flow,insider_transactions,dark_pool,unusual_options,trading_signals"
)
```

### TKL Pool — SAME Validation Pipeline (OBLIGATOIRE)

TKL pool tickers MUST pass the **identical** validation as the top 10. The only relaxed threshold is market cap ($10M vs $500M) and ADV ($2M vs $10M). See `scanner-filters.json#tkl_pool`.

For ALL TKL candidates (batched in groups of 4-6):
```
mcp__dailytickers__QueryData(symbols="TKL_TICKERS", types="sec_filings,flags,quote,insider_transactions,unusual_options,dark_pool,financials", days=180)
mcp__dailytickers__QueryData(types="earnings_calendar", days=14)
```

**Disqualification rules (same as top 10):**
- Market cap < $10M → DROP
- ADV < $2M → DROP
- Anti-dilution: S-3/424B5 within 90 days, shelf_active, atm_program_active, aggressive_underwriter → DROP
- Serial diluter (multiple S-3/424B5 filings in 12 months) → DROP
- Earnings within ±3 trading days → DROP or tag "earnings risk"
- Unusual options: call_put_ratio < 0.4 + volume > 2× normal (smart money short) → DROP

**Sharia tagging (same as top 10):**
- Check sector (financials/defense/alcohol/tobacco/gambling → false)
- Check debt/mcap ratio > 33% → false
- Tag `sharia: true|false` in signals.json tkl_pool entries

**Insider transactions:** Flag significant buys (+5 pts) or sells (-5 pts to score).

This validation is NOT optional — it runs as part of Phase 2, immediately after TKL screener results are collected. No TKL ticker enters signals.json without passing all checks.

## Phase 3 — Data Generation

1. Generate `scanner/YYYYMMDD/data.json` following `scanner/template/schema.json` exactly
2. Generate `scanner/YYYYMMDD/signals.json` (simplified format for downstream tools)
3. **MANDATORY signals.json fields per signal (top_10 + tkl_pool)** — required for validate-scan.js advisory checks and Phase 0.8 lessons-engine consumption:
   - `extension: { rsi, atr, distance_50dma_pct }` — populate from MCP technicals (GetInstruments instrument_technicals + instrument_support_resistance). RSI 0–100, ATR in price units, distance_50dma_pct = (price-ema50)/ema50*100.
   - `earnings_clear: true` — set false ONLY if you decide to tag-and-keep (rare); default true means scan was filtered against `±3d` earnings window.
   - `dilution_clear: true` — set false ONLY if you accept a flagged ticker with explicit rationale (extremely rare); default true means anti-dilution v2 passed.
   - `region: "US"|"EU"|"UK"|"ASIA"|"CHINA"|"JAPAN"|"ETF"` — used for diversification floor advisory (5 US + 2 EU + 1 APAC + 2 ETFs).
4. Strategy labels ONLY: Momentum, Breakout, Pullback, Pre-Squeeze
5. R/R calculated from entry MIDPOINT (not entry_low) — must respect regime-based minimum per `scanner-lessons.json#rr-min-by-regime`: RISK-ON 1.5, RECOVERY/NEUTRAL 1.7, EARLY RISK-OFF/RISK-OFF 2.0.
6. **VWAP entry gate (always-on, not grid-searched)** — validated +29% PnL, +16pp WR, 2.5× PF (commit 91596bd9):
   - Effective entry = `min(open_next_session, VWAP_next_session)` clamped to `day_low` (no-lookahead)
   - Skip gap-up traps: if `open > entry_high × 1.02`, only fill at VWAP pullback
   - Display VWAP value in setup card AND status table (commit 58bac3bb)
   - Applied uniformly across `sweep.js`, `signal-monitor.js`, status page how-to-trade, portfolio API

## Phase 4 — Render & Publish

```bash
node tools/render-scanner.js scanner/YYYYMMDD/
node tools/publish.js --type scanner --path scanner/YYYYMMDD/index.html --no-notify
```

If publish validation fails (filter violations), return to Phase 2 with the specific violations and re-select.

## Phase 5 — Downstream Pipeline (skip with --skip-downstream)

Strict order — `update-tracking` → `candlestick-scanner` → `sweep` → ... (candlestick MUST precede sweep AND gen-status-page; sweep reads tracked exits):
```bash
node tools/update-tracking.js                                                # Yahoo prices → exit triggers
node tools/candlestick-scanner.js --output signals --date YYYYMMDD --regime <REGIME>   # AmericanBulls candlestick patterns → appends to signals.json (feeds the "bull" mode, filterName=candlestick_only). Idempotent (dedup by ticker). REQUIRED: the "bull" tab's "Orders to Place" panel is built by gen-status-page filtering the latest scan's signals.json — skip this and bull shows "0 signals". Fetches fresh Yahoo OHLCV (last bar = current session close).
node tools/sweep.js                                                          # Append-only: new closed trades + advisor_*
MCP_GATEWAY_URL=https://mcp.dailytickers.com/mcp \
  node tools/refresh-risk-metrics.js                                         # VaR + stress + correlation + regimeProb (6 modes from config)
node tools/gen-status-page.js                                                # Snapshot J + dashboard (6 modes)
node tools/gen-mode-cards.js                                                 # Per-mode PNG cards for Telegram/Discord (6 modes)
node tools/gen-api.js                                                        # Refresh 50+ public JSON endpoints
node tools/daily-synthesis.js                                                # Per-mode synthesis: entries / exits / equity move
bash tools/publish-daily-card.sh                                             # Image + media + Telegram + final git push
node tools/trading-executor/run-session.js                                   # Generate plans + execute for all configured mode/broker pairs
```

### Phase 5b — Regime Recalibration (optional, run weekly OR on regime shift)

Append-only mode-parameter recalibration. Detects significant regime change vs `data/modes-config.json#_regime` and proposes new params from `advisor_*` fields:

```bash
node tools/regime-recalibrate.js                      # dry-run report
node tools/regime-recalibrate.js --apply              # apply (append to config-history.json)
node tools/regime-recalibrate.js --force --apply      # bypass stability gate
```

**Behavior**: detects dominant regime in last 7 scanner runs, requires 3 consecutive stable days at new regime before triggering. NEVER overwrites history — appends new version to `portfolio/v1/config-history.json` with bumped `_version` and tags `triggered_by`. `modes-config.json` gets the new params with `_prevVersion` chain.

⚠️ Prerequisites: `data/backtest-results.json` must contain non-null `advisor_<mode>` fields. If sweep strict thresholds aren't met, advisor falls back to `advisor_<mode>_relaxed`. TKL needs `advisor_tkl` populated (sweep.js advTkl array — see audit `.omc/audit-20260502/dev.md` for status).

### Phase 5c — Rolling Walk-Forward Sanity Check (optional, ad-hoc)

```bash
node tools/rolling-walk-forward.js                    # rolling 10-day window
node tools/rolling-walk-forward.js --days=20          # rolling 20-day window
```

Outputs `data/rolling-walk-forward.json` + markdown summary. Per-mode rolling-N-day WR/PF/Ret time series. Caveat: small sample sizes (~9 weeks of data) limit statistical power — use for direction-of-travel signal only.

⚠️ **MCP_GATEWAY_URL is mandatory** (prod URL `https://mcp.dailytickers.com/mcp` always available). Never silently accept `--stub` — it writes an empty schema. If gateway down, log warning and re-run when restored. Ref: memory `reference_mcp_gateway.md`.

### Post-Pipeline Checklist
- QA check (`tools/qa-check.js`, step 7 of publish-daily-card.sh) must show 0 ❌. Investigate every failure (not only ⚠️). qa-check reads `signals.json` (NOT the HTML).
- `scanner/status/index.html` per mode: no stale "Pending (Nd/Md)" on trades whose `exitDate` is past. "Orders to Place" count cohérent avec rangées affichées (filter applies execution-day-only — commit 0fd444af).
- `data/risk-snapshots.json` — must NOT be a stub if MCP_GATEWAY_URL was set
- signals.json strategy labels match `data.json` setup labels
- **Stats consistency** for ALL 6 modes (`turbo`, `dynamic`, `balanced`, `secured`, `fortress`, `tkl`):
  - Hero stats (Closed Trades, WR, PF, Return, DD) in `scanner/status/index.html` match `frozen_*` values in `data/backtest-results.json`
  - Trade History count = hero "Closed Trades" (same `closedTrades.filter(!_premature).length` filter)
  - Mismatch → re-run `node tools/gen-status-page.js`
- **API consistency**: `portfolio/v1/{mode}/equity.json` contains non-null stats for all 6 modes after `gen-api.js`
- **Trade integrity** in `data/backtest-trades.json`:
  - Zero same-day expired trades (`holdDays===1 && status==='expired' && entryDate===exitDate`)
  - Zero early-expired trades (`holdDays < mode.horizon && status==='expired'`)
- **Sweep timing**: sweep.js returns null for trades without enough forward data (`lastDate < expireDate`). Safe — simulated on next run when more OHLC bars arrive.
- **TKL pool**: `modes-config.json#tklPoolEnabled` per-mode gate respected. Time Machine backfill present in `scanner/status/history/*.json` (commit 4a39aea3).
- **BSD date fallback**: any `date -d` in shell scripts must have BSD `date -v` fallback (publish-daily-card.sh helper).

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

⚠️ `publish-daily-card.sh` (Phase 5) already does the final `git push` and Telegram notification. Phase 8 only runs in two cases:

1. **`--skip-downstream` was used** — manual commit + push:
   ```bash
   git add scanner/YYYYMMDD/ data/scanner.json data/scanner-history.json
   git commit -m "feat: scanner YYYYMMDD — auto-published"
   git push origin main
   ```
2. **Phase 7 made post-publish fixes** — additional commit:
   ```bash
   git add -p   # review only intended files (no .env, no large binaries)
   git commit -m "fix: scanner YYYYMMDD — post-validation fixes"
   git push origin main
   ```

If Phase 5 ran successfully, do NOT push twice — already pushed by `publish-daily-card.sh`.

## Error Handling
- MCP screener returns empty → use GetMarketOverview top movers + manual candidate selection
- DSL screener scores all 0 → ignore DSL results, rely on AutoScreener only
- EU screener empty → fill EU slots from GetMarketOverview EU movers or known EU large-caps
- Sweep timeout → continue pipeline, sweep is not blocking
- Telegram notification fails → log warning, do not block
- refresh-risk-metrics.js: **MCP_GATEWAY_URL is mandatory in prod**. Stub fallback only acceptable if gateway is verifiably down — flag loudly in post-pipeline check, never accept silently
- Phase 6 validation loops > 3 → stop, report remaining issues to user
- TKL pool empty (Time Machine backfill missing) → re-run scanner with `--date YYYYMMDD` to populate `scanner/status/history/YYYYMMDD.json`
