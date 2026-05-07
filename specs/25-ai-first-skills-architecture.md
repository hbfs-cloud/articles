# PRD-25: AI-First Development & Skills Architecture

**Status**: Draft  
**Version**: 1.0  
**Date**: 2026-05-07  
**Owner**: Platform Team  

---

## Table of Contents

1. [Vision & Principles](#1-vision--principles)
2. [Skills Architecture](#2-skills-architecture)
3. [Trading Skills Catalog](#3-trading-skills-catalog)
4. [CLAUDE.md Architecture](#4-claudemd-architecture)
5. [MCP Configuration (.mcp.json)](#5-mcp-configuration-mcpjson)
6. [Secrets & Environment Management](#6-secrets--environment-management)
7. [Agentic Design Patterns Mapping](#7-agentic-design-patterns-mapping)
8. [Plugin Architecture](#8-plugin-architecture)
9. [UI Design Guidelines](#9-ui-design-guidelines)
10. [Development Workflow](#10-development-workflow)
11. [Zero-Cost Infrastructure Mandate](#11-zero-cost-infrastructure-mandate)

---

## 1. Vision & Principles

### 1.1 AI-Agent-Native from Day Zero

The DailyTickers AutoTrader platform is designed as an **AI-agent-native system**: every significant workflow is agent-invocable, every module has machine-readable documentation, and every plugin path is guided by a skill. Humans write code; agents run operations.

This is not a retrofit. The platform is built from D0 so that:

- An LLM agent (Claude Code, Codex, Gemini CLI) can onboard a new strategy with zero human hand-holding.
- A QA agent can reproduce any failing test, fix it, and verify the fix without reading unstructured docs.
- A monitoring agent can detect a degraded strategy, propose a recalibration, and apply it via MCP tools.

### 1.2 The Four Karpathy Principles

Adapted from Andrej Karpathy's framework for production AI systems (ref: `andrej-karpathy-skills`):

| # | Principle | Platform Manifestation |
|---|-----------|----------------------|
| **K1** | **Verifiability over trust** | Every pipeline step has a deterministic output artifact; QA checks verify the artifact, not the process | 
| **K2** | **Data-centric quality** | Signal quality gates (score ≥ 90, confluence ≥ 3, anti-dilution) are data rules, not code opinions |
| **K3** | **Iteration speed** | Skills reduce complex ops to a single invocation; the daily cycle runs in < 5 min on a free VM |
| **K4** | **Fail loudly, degrade gracefully** | Blocking pipeline steps halt and alert; non-blocking steps log and continue (see PRD-15 DAG) |

### 1.3 What "AI-First" Means Here

**AI-first ≠ AI-only.** The platform:

- Has humans in the loop for plan approval before live execution (PRD-06 dry-run gate).
- Uses AI agents as force multipliers for research and implementation, not as autonomous traders.
- Treats MCP tools as the primary API surface — structured, discoverable, typed.
- Expresses all operational workflows as skills that agents can discover, invoke, and compose.

### 1.4 Design Constraints

All architectural decisions are bounded by:

- **€0/month infrastructure** (Oracle Cloud Always Free ARM A1 — see §11)
- **Single Go binary** — no microservice sprawl; everything in one process
- **Append-only data** — trade history, config versions, and equity curves never overwrite
- **Agent-first docs** — CLAUDE.md files are the primary dev documentation, not wikis

---

## 2. Skills Architecture

### 2.1 Directory Layout

```
.agents/
└── skills/
    ├── discover-strategy/
    │   └── SKILL.md
    ├── review-strategy/
    │   └── SKILL.md
    ├── add-feature/
    │   └── SKILL.md
    ├── run-backtest/
    │   └── SKILL.md
    ├── daily-pipeline/
    │   └── SKILL.md
    ├── monitor-portfolio/
    │   └── SKILL.md
    ├── add-strategy/
    │   └── SKILL.md
    ├── debug-trade/
    │   └── SKILL.md
    ├── add-broker/
    │   └── SKILL.md
    └── regime-check/
        └── SKILL.md
```

### 2.2 SKILL.md Format

Every skill file follows this schema:

```yaml
---
name: <kebab-case-name>
description: <one sentence — used by agent discovery matching>
version: "1.0"
triggers:
  - <keyword or phrase that should invoke this skill>
  - <alias>
mcp_tools:
  - <MCP server name>/<tool name>
  - ...
output_format: <text|json|file>
estimated_duration: <e.g. "30s", "2-5min">
requires_confirmation: <true|false>
---

## Purpose

<Why this skill exists and when to use it.>

## Preconditions

<What must be true before invoking this skill.>

## Steps

1. <Step 1>
2. <Step 2>
...

## Output

<What artifacts are produced.>

## Error Handling

<How to handle common failure modes.>

## Related Skills

- [skill-name]: <when to prefer it instead>
```

### 2.3 Skill Discovery Protocol

AI coding agents discover skills by:

1. **On startup**: Scan `.agents/skills/*/SKILL.md` — read frontmatter only (fast).
2. **On task receipt**: Match task description against `triggers` array using fuzzy/semantic match.
3. **On ambiguity**: Present matched skills to user for selection (one prompt, not a loop).
4. **On invocation**: Execute skill steps using available MCP tools; surface artifacts as structured output.

Skills are **not** shell scripts. They are structured workflows that an agent reads and interprets. The agent has tool-use capability to execute each step.

### 2.4 Skill vs Raw CLI

| Situation | Use Skill | Use Raw CLI |
|-----------|-----------|-------------|
| Running the full daily pipeline | `daily-pipeline` | Never — too many steps to remember |
| Debugging why trade was missed | `debug-trade` | Only for one-off grep |
| Adding a new broker adapter | `add-broker` | Never — checklist is critical |
| Running `git status` | No skill needed | Direct CLI |
| Discovering a new strategy | `discover-strategy` | No equivalent |

### 2.5 Skill Composition

Skills can invoke other skills as sub-workflows. Example: `discover-strategy` may call `run-backtest` for each candidate, then `review-strategy` on the results. This is expressed as a reference in the Steps section, not as a shell pipe.

```markdown
## Steps

1. Call `DiscoverStrategy` MCP tool with constraints.
2. For each candidate returned, invoke the `run-backtest` skill.
3. Compare results using `review-strategy` skill on each tested slot.
4. Rank by Sharpe ratio and present top 3 to user.
```

### 2.6 Versioning

Skills follow semantic versioning in their frontmatter. Breaking changes (new required steps, renamed outputs) bump the minor version. Backward-compatible additions keep the patch version. Agents cache skill content for the session; re-read on version mismatch.

---

## 3. Trading Skills Catalog

### 3.1 Skill: `discover-strategy`

```yaml
---
name: discover-strategy
description: Find new trading strategy configurations via PRD-24 analytical marts, identify untested parameter combinations predicted to outperform.
version: "1.0"
triggers:
  - "discover strategy"
  - "find new strategy"
  - "what strategy should I try"
  - "unexplored configurations"
mcp_tools:
  - dailytickers-gateway/DiscoverStrategy
  - dailytickers-gateway/GetMart
  - dailytickers-gateway/QueryAnalytics
  - go-bridge/list_strategies
output_format: json
estimated_duration: "30-90s"
requires_confirmation: false
---
```

**Purpose**: Query the PRD-24 analytical data layer to identify parameter combinations that have not been backtested but are predicted (via k-NN interpolation from tested neighbors) to meet performance targets.

**Preconditions**:
- `data/analytical.db` exists and is fresh (last refresh < 48h).
- At least 30 closed trades in `backtest-trades.json` for meaningful interpolation.

**Steps**:

1. Call `GetMart` with `mart=mart_regime_analysis` to understand which regimes are active and which strategy types perform best per regime.

2. Call `GetMart` with `mart=mart_strategy_performance` filtered to the current regime to identify the best-performing existing slots as a baseline.

3. Call `DiscoverStrategy` with constraints:
   ```json
   {
     "constraints": {
       "strategy_type": "scanner",
       "min_trades": 30,
       "min_hit_rate": 0.55,
       "min_sharpe": 1.5,
       "min_confidence": 0.7
     },
     "optimization_target": "sharpe_ratio",
     "explore_parameters": ["horizon", "max_positions", "score_threshold", "stop_loss_pct"],
     "limit": 10
   }
   ```

4. For each candidate with `confidence > 0.8`, extract `run_backtest_hint.config_override`.

5. Invoke the `run-backtest` skill for the top 3 candidates (by estimated Sharpe).

6. Present a ranked comparison table: `candidate | estimated_sharpe | actual_sharpe | hit_rate | profit_factor | recommendation`.

**Output**: JSON array of candidates with backtest results attached. Also prints a human-readable summary table.

**Error Handling**:
- `analytical.db` not found → Run `node tools/gen-api.js` first, then retry.
- `DiscoverStrategy` returns empty candidates → Lower `min_confidence` to 0.5 or `min_trades` to 20.
- All backtests fail → Check Go bridge health: `curl http://localhost:8080/health`.

**Related Skills**:
- `run-backtest`: Invoked as a sub-step.
- `review-strategy`: Run after discovery to check if candidates would conflict with existing slots.

---

### 3.2 Skill: `review-strategy`

```yaml
---
name: review-strategy
description: Health check an existing strategy slot — performance vs targets, regime fit, correlation with other slots, and whether recalibration is needed.
version: "1.0"
triggers:
  - "review strategy"
  - "check strategy health"
  - "is balanced still working"
  - "strategy health check"
  - "slot performance review"
mcp_tools:
  - dailytickers-gateway/QueryAnalytics
  - dailytickers-gateway/GetMart
  - dailytickers-gateway/GetRegimeProbability
  - dailytickers-gateway/GetCorrelationMatrix
output_format: text
estimated_duration: "20-40s"
requires_confirmation: false
---
```

**Purpose**: Given a strategy slot ID, produce a concise health report with actionable recommendations. Surfaces degradation before it becomes a drawdown problem.

**Preconditions**:
- Slot ID exists in `data/strategy-slots.json`.
- At least 10 closed trades for the slot.

**Steps**:

1. Read slot config from `data/strategy-slots.json` for the given `slotId`.

2. Call `QueryAnalytics` on cube `trades` with filters `strategy_slot_id=<slotId>`, measures: `hit_rate`, `profit_factor`, `avg_return_pct`, `max_dd`, `trade_count`, grouped by `regime`.

3. Call `GetMart` with `mart=mart_strategy_performance`, filter `strategy_slot_id=<slotId>`, compare vs target thresholds:
   - Sharpe ≥ 1.5 → OK
   - WR ≥ 55% → OK
   - PF ≥ 1.8 → OK
   - Max DD ≤ 15% → OK

4. Call `GetRegimeProbability` (model=ensemble, horizon=5) to get current regime distribution.

5. Cross-reference: Is this slot's best regime (from step 2) aligned with the current regime (from step 4)?

6. Call `GetCorrelationMatrix` (window=60, pearson) to check pairwise correlation with other active slots. Flag if `rho > 0.75` with any peer slot.

7. Call `GetMart` with `mart=mart_signal_quality` to check signal→trade conversion rate (signals generated vs signals executed).

8. Generate health report with traffic-light status:
   - 🟢 OK: metric within range
   - 🟡 WARNING: metric 10–20% below target
   - 🔴 CRITICAL: metric > 20% below target or DD > threshold

9. If any CRITICAL flag → recommend invoking `discover-strategy` for replacement candidates.

**Output**: Structured health report per slot. Example:

```
=== Strategy Slot Health: balanced ===
Period: 2026-01-15 to 2026-05-07 (47 trades)

Metric          Value    Target   Status
Hit Rate        61.2%    ≥55%     🟢 OK
Profit Factor   2.31     ≥1.8     🟢 OK  
Max Drawdown    8.4%     ≤15%     🟢 OK
Sharpe Ratio    1.87     ≥1.5     🟢 OK
Signal Conv.    73%      ≥70%     🟢 OK

Regime Fit: NEUTRAL (best), current regime: NEUTRAL → 🟢 Aligned
Correlation: max peer rho = 0.62 (with us-core) → 🟢 Under cap

Recommendation: No action needed. Next review in 14 days.
```

**Error Handling**:
- Slot not found → List available slots from `data/strategy-slots.json`.
- Fewer than 10 trades → Report "Insufficient data" with trade count; suggest waiting.
- MCP timeout → Fallback to reading `portfolio/v1/<slotId>/all.json` directly.

**Related Skills**:
- `discover-strategy`: Invoked when CRITICAL flags are present.
- `run-backtest`: Re-run backtest with current data if metrics appear degraded.

---

### 3.3 Skill: `add-feature`

```yaml
---
name: add-feature
description: Add a new feature to the DailyTickers AutoTrader platform following the full checklist — CLAUDE.md update, tests, QA, skill creation if needed.
version: "1.0"
triggers:
  - "add feature"
  - "implement feature"
  - "new feature"
  - "build feature"
mcp_tools: []
output_format: text
estimated_duration: "5-30min"
requires_confirmation: true
---
```

**Purpose**: Ensures every new feature lands with the full quality harness: package CLAUDE.md updated, tests written, QA passes, and a skill created if the feature introduces a new operational workflow.

**Preconditions**:
- Feature is described in a PRD or issue. If not, write a one-paragraph spec first.
- Running `go build ./...` passes on the current branch.

**Steps**:

1. **Scope the feature**: Identify which Go packages are touched. Read the relevant `internal/<package>/CLAUDE.md` for package conventions.

2. **Write the interface first**: Define any new types or interfaces in `@dt/core` or the relevant package before implementation.

3. **Write tests first** (TDD):
   - Unit tests for pure functions.
   - Fixture-based E2E test if the feature touches the pipeline.
   - Golden files for any new output format.

4. **Implement the feature** following package conventions from the package CLAUDE.md.

5. **Update CLAUDE.md**:
   - Root `CLAUDE.md` if a new top-level concept is introduced.
   - Package `internal/<pkg>/CLAUDE.md` for new types, interfaces, or pitfalls.

6. **Create a skill** if the feature introduces a new recurring operational workflow (use this skill as the template).

7. **Run QA**:
   ```bash
   go test ./...
   node tools/qa-check.js
   ```
   Fix any failures before proceeding.

8. **PR checklist** (must be 100% before merge):
   - [ ] CLAUDE.md updated (root + package)
   - [ ] Tests pass (`go test ./...`)
   - [ ] QA passes (0 ❌ in `qa-check.js`)
   - [ ] Skill created/updated if needed
   - [ ] No hardcoded secrets
   - [ ] No inline `fmt.Println` debug output left in
   - [ ] `.env.example` updated if new env vars introduced

**Output**: Working feature with tests, updated docs, and (if applicable) a new skill file.

**Error Handling**:
- Test fails → Do not proceed to PR. Fix the test, not the test runner.
- QA check fails → Read the specific check that failed in `tools/qa-check.js`; fix root cause.
- Build fails → Run `go vet ./...` and fix all warnings first.

**Related Skills**:
- `add-strategy`: If the feature is specifically a new strategy type.
- `add-broker`: If the feature is a new broker adapter.

---

### 3.4 Skill: `run-backtest`

```yaml
---
name: run-backtest
description: Execute a walk-forward backtest for a strategy slot with given config overrides, compare results vs baseline, and produce a standardized metrics report.
version: "1.0"
triggers:
  - "run backtest"
  - "backtest"
  - "test strategy"
  - "simulate strategy"
  - "walk-forward"
mcp_tools:
  - go-bridge/run_backtest
  - dailytickers-gateway/QueryAnalytics
output_format: json
estimated_duration: "30s-3min"
requires_confirmation: false
---
```

**Purpose**: Execute a reproducible backtest for a strategy slot (scanner or mechanical) and return standardized metrics. Used standalone for exploration and as a sub-step by `discover-strategy`.

**Preconditions**:
- Go bridge is running: `curl http://localhost:8080/health` returns 200.
- Historical signals data exists in `data/signals-history.json` (≥ 30 days).

**Steps**:

1. Parse the slot config from `data/strategy-slots.json` for the given `slotId`.

2. Apply any `configOverride` parameters (e.g., from `DiscoverStrategy.run_backtest_hint`).

3. **For scanner strategies**: Call `node tools/sweep.js` with the config override flags:
   ```bash
   node tools/sweep.js --mode <slotId> --horizon <N> --minScore <S> --portfolioSize <P>
   ```

4. **For mechanical strategies (Go bridge)**: Call `go-bridge/run_backtest` JSON-RPC:
   ```json
   {
     "method": "run_backtest",
     "params": {
       "strategy_id": "<strategyId>",
       "config": { "<override keys>" },
       "date_range": { "from": "2025-01-01", "to": "2026-05-07" }
     }
   }
   ```

5. Parse output and extract standardized metrics:
   ```typescript
   interface BacktestResult {
     slotId: string;
     configUsed: Record<string, unknown>;
     period: { from: string; to: string };
     metrics: {
       returnTotal: number;       // %
       maxDD: number;             // %
       sharpe: number;
       calmar: number;
       winRate: number;           // %
       profitFactor: number;
       tradeCount: number;
       avgHoldDays: number;
       expectancy: number;        // % per trade
     };
     regimeBreakdown: Record<string, { trades: number; hitRate: number; avgReturn: number }>;
   }
   ```

6. Compare vs baseline (current slot metrics from `portfolio/v1/<slotId>/all.json`).

7. Print diff table: `metric | baseline | candidate | delta | status`.

**Output**: `BacktestResult` JSON + human-readable diff table. On success, optionally writes result to `data/backtest-candidates/<slotId>-<timestamp>.json`.

**Error Handling**:
- `sweep.js` timeout (> 3 min) → Reduce `portfolioSize` or date range; retry.
- Go bridge not responding → Check process: `pgrep systematic-tss`; restart if dead.
- Insufficient trades (< 10) → Widen date range or lower `minScore`.

**Related Skills**:
- `discover-strategy`: Calls this skill for top candidates.
- `review-strategy`: Compares backtest results vs live performance.

---

### 3.5 Skill: `daily-pipeline`

```yaml
---
name: daily-pipeline
description: Run the full daily pipeline DAG (PRD-15) — collect, generate, gate, track, plan, execute, report, QA — with step-by-step progress and failure handling.
version: "1.0"
triggers:
  - "run pipeline"
  - "daily pipeline"
  - "run daily"
  - "scanner pipeline"
  - "full pipeline"
mcp_tools:
  - dailytickers-gateway/RunAutoScreener
  - dailytickers-gateway/RunScreener
  - dailytickers-gateway/GetRegimeProbability
  - dailytickers-gateway/GetCorrelationMatrix
  - dailytickers-gateway/GetEarningsCalendarFiltered
  - dailytickers-gateway/OptimizeSizing
output_format: text
estimated_duration: "3-8min"
requires_confirmation: false
---
```

**Purpose**: Execute the complete daily trading pipeline as defined in PRD-15. Each step is logged with timestamp and status. Blocking steps halt the pipeline on failure; non-blocking steps log and continue.

**Preconditions**:
- `MCP_GATEWAY_URL` is set in environment.
- Scanner HTML for today exists (generate it first if not).

**Pipeline DAG** (mirrors PRD-15 §2):

```
scan_collect → signal_generate → risk_gate
                                      ├── update_tracking → sweep_backtest → gen_status_page → gen_api → publish_push → qa_check
                                      └── plan_generate → execute_orders → notify_results
```

**Steps**:

1. **[BLOCKING] scan_collect**: Run MCP screeners.
   ```bash
   MCP_GATEWAY_URL=https://gateway.dailytickers.com/mcp node tools/refresh-risk-metrics.js
   ```

2. **[BLOCKING] signal_generate**: Score, validate, anti-dilution filter.
   ```bash
   node tools/gen-trading-plan.js --mode balanced  # (repeat for each configured mode)
   ```

3. **[BLOCKING] risk_gate**: Apply regime + correlation + earnings + sizing gates (PRD-03).

4. **[NON-BLOCKING] update_tracking**: Update position exits from Yahoo Finance prices.
   ```bash
   node tools/update-tracking.js
   ```

5. **[NON-BLOCKING] sweep_backtest**: Append-only: add newly closed trades to backtest history.
   ```bash
   node tools/sweep.js
   ```

6. **[NON-BLOCKING] gen_status_page**: Rebuild status dashboard.
   ```bash
   node tools/gen-status-page.js
   ```

7. **[NON-BLOCKING] gen_api**: Refresh 50+ public JSON endpoints.
   ```bash
   node tools/gen-api.js
   ```

8. **[NON-BLOCKING] publish_push**: Git add → commit → push + Telegram notifications.
   ```bash
   bash tools/publish-daily-card.sh
   ```

9. **[NON-BLOCKING] execute_orders**: Generate plans and execute for all configured broker pairs.
   ```bash
   node tools/trading-executor/run-session.js
   ```

10. **[NON-BLOCKING] qa_check**: Verify cross-file consistency.
    ```bash
    node tools/qa-check.js
    ```
    Assert 0 ❌ failures. Investigate each failure — do not ignore.

**Post-Pipeline Checklist**:
- [ ] `qa-check.js` shows 0 ❌
- [ ] `scanner/status/index.html` has no stale "Pending" on past-exitDate trades
- [ ] `data/risk-snapshots.json` is not a stub (if MCP_GATEWAY_URL was set)
- [ ] Order count in status page matches displayed rows

**Error Handling**:
- Blocking step fails → Stop pipeline, post alert to Telegram topic 72, log to `data/pipeline-errors.log`.
- Non-blocking step fails → Log failure, continue to next step, include in QA report.
- MCP gateway unreachable → Run `--stub` mode for risk metrics, continue with degraded data.

**Related Skills**:
- `monitor-portfolio`: Run after pipeline to verify positions are healthy.
- `regime-check`: Run before pipeline to decide if risk scaling is needed.

---

### 3.6 Skill: `monitor-portfolio`

```yaml
---
name: monitor-portfolio
description: Monitor active positions across all strategy slots — live P&L, stop proximity, expiry countdown, circuit breaker status, and rotation candidates.
version: "1.0"
triggers:
  - "monitor portfolio"
  - "check positions"
  - "portfolio status"
  - "how are my positions"
  - "active trades"
mcp_tools:
  - dailytickers-gateway/QueryAnalytics
  - dailytickers-gateway/GetCorrelationMatrix
  - dailytickers-gateway/GetRegimeProbability
output_format: text
estimated_duration: "15-30s"
requires_confirmation: false
---
```

**Purpose**: Give a snapshot of all open positions across all slots, flagging positions that need attention (near stop, near expiry, underwater, circuit breaker active).

**Preconditions**:
- `data/scanner-positions.json` exists and is current (updated today).

**Steps**:

1. Read `data/scanner-positions.json` for all open positions across all slots.

2. For each position, compute:
   - Distance to stop: `(currentPrice - stop) / entry * 100` (%)
   - Days to expiry: `horizon - daysHeld`
   - Unrealized P&L: from `scanner-positions.json` or live price fetch

3. Call `GetRegimeProbability` to determine if current regime warrants defensive action.

4. Call `GetCorrelationMatrix` to check if any pair has drifted above correlation cap.

5. Check circuit breaker status in `data/risk-snapshots.json` per slot.

6. Produce summary table:

```
=== Portfolio Monitor: 2026-05-07 14:30 UTC ===

Slot        Ticker  Entry    Current  P&L%     Stop     Dist%  DaysLeft  Status
---------   ------  -------  -------  -------  -------  -----  --------  ------
balanced    NVDA    885.40   921.00   +4.0%    852.15   +8.0%  6         🟢 OK
balanced    AAPL    182.50   179.80   -1.5%    174.00   +3.3%  4         🟡 WATCH
us-core     MSFT    420.00   432.00   +2.9%    399.00   +8.3%  8         🟢 OK
tkl         SMCI    45.20    41.50    -8.2%    42.00    -1.2%  2         🔴 NEAR STOP

Circuit Breakers: All clear
Correlation Alerts: NVDA/MSFT rho=0.71 (cap=0.80) — 🟡 Monitor
Regime: NEUTRAL (64%) — no defensive action needed
```

7. Flag any position with:
   - `dist% < 2%` → 🔴 NEAR STOP (consider closing)
   - `daysLeft ≤ 2` → ⏳ EXPIRING SOON (decide: extend or close)
   - `P&L% < -5%` and `daysLeft > 5` → 🟡 STALE UNDERWATER

**Error Handling**:
- Live price fetch fails → Use last known price from `scanner-positions.json`; mark as stale.
- MCP timeout → Continue with cached data; note staleness in output.

**Related Skills**:
- `debug-trade`: If a specific position looks wrong, invoke for deep inspection.
- `daily-pipeline`: If rotation is needed, run the pipeline to execute it.

---

### 3.7 Skill: `add-strategy`

```yaml
---
name: add-strategy
description: Add a new mechanical strategy to the Go engine (systematic-tss) — implement scanner interface, register, configure slot, backtest, and deploy.
version: "1.0"
triggers:
  - "add strategy"
  - "new strategy"
  - "implement strategy"
  - "add mechanical strategy"
  - "new scanner"
mcp_tools:
  - go-bridge/list_scanners
  - go-bridge/list_pms
  - go-bridge/run_backtest
output_format: text
estimated_duration: "30-120min"
requires_confirmation: true
---
```

**Purpose**: Walk through the complete lifecycle of adding a new Go-based mechanical strategy: interface implementation, registration, config, backtesting, and deployment. Ensures nothing is skipped.

**Preconditions**:
- Go 1.24 toolchain installed.
- `systematic-tss` repo is accessible and builds (`go build ./...`).
- New strategy concept is defined (name, asset class, logic description).

**Steps**:

1. **Check existing scanners** to avoid duplication:
   ```bash
   # Via Go bridge
   curl -s -X POST http://localhost:8080/bridge \
     -d '{"method":"list_scanners","params":{}}' | jq '.result[].name'
   ```

2. **Implement the `OpportunityScanner` interface** in `internal/scanners/<name>.go`:
   ```go
   type <Name>Scanner struct {
     filters *ScannerFilterConfig
   }
   
   func (s *<Name>Scanner) Name() string { return "<kebab-name>" }
   func (s *<Name>Scanner) Init(fullMkData map[string][]ohlcv.OHLCV) error { return nil }
   func (s *<Name>Scanner) Scan(mkData MkData, regime *RegimeData, limit int) []Opportunity { ... }
   func (s *<Name>Scanner) SetFilters(filters *ScannerFilterConfig) { s.filters = filters }
   ```

3. **Register in `ScannerFactory`**:
   ```go
   func init() {
     RegisterScanner("<kebab-name>", func() OpportunityScanner { return &<Name>Scanner{} })
   }
   ```

4. **Register a composite strategy** (scanner + position manager):
   ```go
   func init() {
     RegisterStrategy("<strategy-id>", StrategyDef{
       Scanner:         "<kebab-name>",
       PositionManager: "adaptive-fractal",
       MaxCandidates:   20,
     })
   }
   ```

5. **Write unit tests** in `internal/scanners/<name>_test.go`:
   - At minimum: a fixture with 60 days of OHLCV data, assert ≥ 1 signal returned.
   - Property test: all signals have `Entry > Stop`, `TP1 > Entry`, `Score` in [0, 100].

6. **Add golden files** for regression: `testdata/<name>_signals.json`.

7. **Build and verify the bridge discovers the new strategy**:
   ```bash
   go build ./...
   ./systematic-tss --bridge &
   curl -s -X POST http://localhost:8080/bridge \
     -d '{"method":"list_strategies","params":{}}' | jq '.result[] | select(.id == "<strategy-id>")'
   ```

8. **Add a StrategySlot config** in `data/strategy-slots.json`:
   ```json
   {
     "<slot-id>": {
       "strategyId": "<strategy-id>",
       "label": "<Human Name>",
       "capitalUsd": 5000,
       "maxPositions": 5,
       "brokerId": "paper",
       "risk": {
         "ddBreakerPct": 8,
         "vixKillThreshold": 28,
         "maxSingleLossPct": 2,
         "maxPortfolioHeatPct": 10
       }
     }
   }
   ```

9. **Run backtest** using the `run-backtest` skill with the new slot ID.

10. **Plugin Registration Checklist** (all must be ✅):
    - [ ] `OpportunityScanner` interface implemented
    - [ ] Registered in `ScannerFactory` via `init()`
    - [ ] Composite strategy registered in `RegisterStrategy`
    - [ ] Unit tests pass
    - [ ] Property-based invariant tests pass
    - [ ] Golden files added
    - [ ] StrategySlot config added (start with `brokerId: "paper"`)
    - [ ] Backtest run with metrics ≥ targets (Sharpe ≥ 1.5, WR ≥ 55%, DD ≤ 15%)
    - [ ] PRD-23 §9 scanner catalog updated
    - [ ] Package `internal/scanners/CLAUDE.md` updated with new scanner description

11. **Deploy**: Change `brokerId` from `"paper"` to live broker only after paper trading ≥ 5 sessions.

**Error Handling**:
- Go build fails → Run `go vet ./...` first; fix all reported issues.
- Bridge doesn't list new strategy → Check `init()` function is in a file that's imported by `main.go`.
- Backtest returns < 10 trades → Loosen entry conditions or expand date range.

**Related Skills**:
- `run-backtest`: Invoked in step 9.
- `review-strategy`: Run after 5 paper sessions to evaluate live vs backtest parity.

---

### 3.8 Skill: `debug-trade`

```yaml
---
name: debug-trade
description: Debug why a specific trade was taken or missed — trace through signal generation, risk gating, plan generation, and execution for a given ticker and date.
version: "1.0"
triggers:
  - "debug trade"
  - "why was trade taken"
  - "why was trade missed"
  - "trade not executed"
  - "explain trade"
  - "why did it buy"
  - "why didn't it buy"
mcp_tools:
  - dailytickers-gateway/QueryAnalytics
output_format: text
estimated_duration: "1-3min"
requires_confirmation: false
---
```

**Purpose**: Given a ticker and date, trace through every stage of the pipeline to explain why a trade was taken, missed, or modified. Produces a step-by-step audit trail.

**Preconditions**:
- `scanDate` is provided (YYYY-MM-DD format).
- `ticker` is provided.
- Historical signal files exist for that date.

**Steps**:

1. **Stage 1 — Signal Generation**: Was the ticker in the raw scanner output?
   ```bash
   node -e "
     const h = require('./data/signals-history.json');
     const day = h.find(d => d.scanDate === '<date>');
     console.log(day?.rawSignals?.find(s => s.ticker === '<ticker>') || 'NOT IN RAW OUTPUT');
   "
   ```
   If not present → scanner didn't score it. Check scanner DSL filters for that date.

2. **Stage 2 — Validation Pipeline (PRD-02)**: Did it pass market cap, ADV, and anti-dilution filters?
   - Read `data/signals-history.json` for `dropped` array on the given date.
   - Check `dropped.find(d => d.ticker === '<ticker>')` for drop reason.

3. **Stage 3 — Risk Gating (PRD-03)**: Did it pass regime, correlation, earnings, and sizing gates?
   - Read `GatedSignalSet` for the date: `data/gated-signals/<date>/<slotId>.json`.
   - Check `dropped` array for the ticker and reason.
   - Common reasons: `correlation_drop`, `earnings_exclusion`, `regime_gate`, `vix_kill`.

4. **Stage 4 — Plan Generation (PRD-06)**: Was it included in the trading plan?
   - Read `data/trading-plans/<slotId>-<brokerId>-<date>.json`.
   - Check `entries` array for the ticker.
   - If missing: check `circuitBreakerStatus.vix_kill_active` or `dd_breaker_active`.

5. **Stage 5 — Execution (PRD-07)**: Was the order submitted?
   - Read `data/execution-log-<date>.json`.
   - Check for the ticker; look at `status`, `rejectReason`.
   - Common reasons: `vwap_gate_reject`, `gap_up_reject`, `spread_too_wide`, `market_closed`.

6. **Produce audit trail**:
   ```
   === Trade Debug: NVDA on 2026-05-06 (slot: balanced) ===
   
   Stage 1 — Signal Generation:    ✅ Score=93, Strategy=Momentum
   Stage 2 — Validation:           ✅ MarketCap=2.1T, ADV=$4.2B, No dilution flag
   Stage 3 — Risk Gating:          ✅ Regime=NEUTRAL, rho(NVDA,AAPL)=0.61<cap
   Stage 4 — Plan Generation:      ✅ Entry=885.40, SL=852.15, TP1=930.00
   Stage 5 — Execution:            ❌ REJECTED — vwap_gate: open=903.20 > entry*1.02=902.91
   
   Root Cause: NVDA gapped up 2.1% at open, exceeding VWAP gate tolerance (2.0%).
   This is correct behavior — gap-up entry avoidance prevents chasing.
   ```

**Error Handling**:
- Historical files not found for that date → Pipeline may not have run; check `data/pipeline-errors.log`.
- Stage 5 log not found → Order may have been submitted to paper broker; check paper log.

**Related Skills**:
- `monitor-portfolio`: If the trade was taken but behaving unexpectedly.
- `review-strategy`: If many trades are being rejected at the same stage, indicating a systematic issue.

---

### 3.9 Skill: `add-broker`

```yaml
---
name: add-broker
description: Add a new broker adapter to the platform — implement BrokerAdapter interface, instrument mapping, config, paper test, and deploy.
version: "1.0"
triggers:
  - "add broker"
  - "new broker"
  - "connect broker"
  - "integrate broker"
mcp_tools: []
output_format: text
estimated_duration: "2-8 hours"
requires_confirmation: true
---
```

**Purpose**: Walk through the complete lifecycle of adding a new broker adapter. The existing brokers (Alpaca, IBKR, Saxo, Trading212, Binance, Paper — PRD-07) serve as reference implementations.

**Preconditions**:
- Broker API credentials are available (stored in `.env`, not committed).
- Broker's API documentation has been reviewed.
- New broker has a sandbox/paper environment for testing.

**Steps**:

1. **Study the reference implementation** for the closest existing broker:
   - US equities → `internal/broker/alpaca.go`
   - EU equities → `internal/broker/saxo.go`
   - Crypto → `internal/broker/binance.go`

2. **Implement the `BrokerAdapter` interface** in `internal/broker/<name>.go` (see §8.2 for the canonical interface with `context.Context` on all methods, `GetOrders()`, and `MapSymbol(string, AssetClass)`).

3. **Implement instrument mapping** (`MapSymbol`):
   - US equities: usually 1:1 (NVDA → NVDA)
   - EU equities: exchange suffix (AIR.PA → AIR:xpar for Saxo)
   - Crypto: base+quote (BTC-USD → BTCUSDT for Binance)
   - Document all edge cases in `internal/broker/<name>/INSTRUMENT_NOTES.md`.

4. **Add credentials to `.env.example`**:
   ```bash
   DT_BROKER_<NAME>_KEY=<your_key_here>
   DT_BROKER_<NAME>_SECRET=<your_secret_here>
   DT_BROKER_<NAME>_PAPER=true
   ```

5. **Register the adapter** in the broker factory:
   ```go
   func init() {
     RegisterBroker("<name>", func(creds BrokerCredentials) BrokerAdapter {
       return &<Name>Adapter{creds: creds}
     })
   }
   ```

6. **Write integration tests** (requires sandbox credentials):
   ```go
   func TestAlpacaAdapter_PlaceAndCancel(t *testing.T) {
     // Uses DT_BROKER_<NAME>_SANDBOX=true
     adapter := NewAdapter(testCreds)
     require.NoError(t, adapter.Connect(ctx, testCreds))
     result, err := adapter.PlaceOrder(testOrder)
     require.NoError(t, err)
     require.NoError(t, adapter.CancelOrder(result.OrderID))
   }
   ```

7. **Paper test**: Set `brokerId: "<name>"` in a test slot config with `capitalUsd: 1000`. Run `daily-pipeline` skill with `--dry-run`. Verify plan generation, order formatting, and notification flow.

8. **Broker Adapter Checklist**:
   - [ ] `BrokerAdapter` interface fully implemented
   - [ ] `MapSymbol` handles all asset classes the broker supports
   - [ ] Credentials sourced from env vars (never hardcoded)
   - [ ] Sandbox mode toggle (`DT_BROKER_<NAME>_SANDBOX`)
   - [ ] Integration tests pass against sandbox
   - [ ] Rate limiting respected (add `rate.Limiter` for burst endpoints)
   - [ ] Error messages from broker API are surfaced (not swallowed)
   - [ ] Paper test: full pipeline dry-run passes
   - [ ] `internal/broker/CLAUDE.md` updated with new adapter notes
   - [ ] PRD-07 §broker table updated
   - [ ] Telegram notification confirms order placement in paper test

9. **Go live**: Change sandbox flag to `false` only after 2 full paper days with correct order generation.

**Error Handling**:
- Auth error → Verify env var names match exactly what's in `.env`.
- Symbol not found → Add to instrument mapping table; log unknown symbols for review.
- Rate limit hit → Implement exponential backoff with jitter; add `rate.Limiter`.

**Related Skills**:
- `add-feature`: If the broker requires a new generic platform capability.
- `daily-pipeline`: Run in dry-run mode to test the broker integration end-to-end.

---

### 3.10 Skill: `regime-check`

```yaml
---
name: regime-check
description: Check current market regime, VIX level, and implications for all active strategy slots — determine if defensive scaling, circuit breakers, or slot pausing is warranted.
version: "1.0"
triggers:
  - "regime check"
  - "market regime"
  - "check regime"
  - "risk environment"
  - "vix check"
  - "how is the market"
mcp_tools:
  - dailytickers-gateway/GetRegimeProbability
  - dailytickers-gateway/GetMarketOverview
  - dailytickers-gateway/QueryAnalytics
output_format: text
estimated_duration: "10-20s"
requires_confirmation: false
---
```

**Purpose**: Instantly understand the current market regime and its implications for every active strategy slot — which slots should reduce size, pause entries, or remain unchanged.

**Preconditions**: None. Can be run at any time.

**Steps**:

1. Call `GetRegimeProbability` (model=ensemble, horizon=5):
   ```json
   { "model": "ensemble", "horizon": 5 }
   ```

2. Call `GetMarketOverview` for VIX level, SPY 5-day return, and sector variations.

3. Classify current regime using platform thresholds:
   - VIX < 15 → RISK-ON
   - VIX 15–20 → NEUTRAL
   - VIX 20–28 → EARLY RISK-OFF
   - VIX > 28 → RISK-OFF

4. Load all active slot configs from `data/strategy-slots.json`. For each slot, check:
   - `risk.vixKillThreshold` → if VIX > threshold, entries HALTED for this slot
   - `risk.ddBreakerPct` → if current DD exceeds, HALTED
   - `regimeFilters` → if current regime has a filter override, apply it

5. Cross-reference `GetRegimeProbability` regime distribution:
   - `crisis > 0.30` → reduce top-N to 5 across all slots
   - `early_risk_off > 0.50` → halve position sizes on aggressive slots (turbo, dynamic)

6. Query `QueryAnalytics` on `market_regimes` cube for historical performance in current regime.

7. Produce regime report:
   ```
   === Regime Check: 2026-05-07 14:30 UTC ===
   
   VIX: 18.4 → NEUTRAL
   SPY 5d: +1.2%
   Regime Probs: risk_on=0.28, neutral=0.61, early_risk_off=0.09, crisis=0.02
   
   Slot Implications:
   Slot        VIX Cap  Current VIX  Status          Action
   ---------   -------  -----------  ------          ------
   turbo       28       18.4         🟢 ENTRIES OK   Full size
   dynamic     25       18.4         🟢 ENTRIES OK   Full size
   balanced    22       18.4         🟢 ENTRIES OK   Full size
   secured     20       18.4         🟢 ENTRIES OK   Full size
   fortress    20       18.4         🟢 ENTRIES OK   Full size
   tkl         28       18.4         🟢 ENTRIES OK   Full size
   
   Regime-Based Sizing Recommendation:
   - NEUTRAL regime: standard sizing for all slots
   - No defensive action required
   - Historical NEUTRAL performance: avg +2.1%/trade, WR=59%
   
   Next Regime Trigger:
   - VIX > 20 → Begin EARLY RISK-OFF protocol (reduce turbo/dynamic by 50%)
   - VIX > 28 → Full RISK-OFF (halt entries on turbo, dynamic, balanced)
   ```

**Error Handling**:
- MCP timeout → Fall back to `data/risk-snapshots.json` for last known regime.
- Regime probability not available → Use VIX level alone; note degraded accuracy.

**Related Skills**:
- `monitor-portfolio`: If regime is RISK-OFF, immediately check position proximity to stops.
- `daily-pipeline`: If RISK-OFF, run pipeline with defensive flags before market open.

---

## 4. CLAUDE.md Architecture

### 4.1 Philosophy

Every package has a `CLAUDE.md` that an AI agent can read and immediately understand:
- What the package does (one paragraph)
- The key interfaces and types (with file references)
- Testing conventions for this package
- Common pitfalls (things that aren't obvious from the code)
- Which skills are relevant to this package

The root `CLAUDE.md` covers cross-cutting concerns and links to package files. It does **not** duplicate package details.

### 4.2 Root `CLAUDE.md` Structure

```markdown
# DailyTickers AutoTrader — Agent Guide

## Four Karpathy Principles (Read First)
1. Verifiability: every step produces an artifact; QA checks the artifact
2. Data-centric quality: signal gates are data rules, not code opinions
3. Iteration speed: use skills for complex ops; daily cycle < 5 min
4. Fail loudly, degrade gracefully: blocking steps halt; non-blocking log

## Project Overview
[One paragraph: what the platform does, where it runs, who uses it]

## Architecture in One Diagram
[Simplified pipeline DAG + package map]

## Skill Catalog
[Table: skill name | trigger phrases | when to use]

## Key Conventions
- Append-only data: never overwrite backtest-trades.json or equity curves
- Secrets via env vars only (see §6 for naming convention)
- Zero-cost infra: Oracle ARM A1, GitHub Pages, SQLite (see PRD-25 §11)
- All MCP calls use DT_MCP_GATEWAY_URL (never hardcode the URL)

## Package Index
[Links to each internal/<pkg>/CLAUDE.md]
```

### 4.3 Per-Package CLAUDE.md Files

#### `cmd/autotrader/CLAUDE.md`
```markdown
# cmd/autotrader — Main Binary Entry Point

## Purpose
Single binary that starts the REST API, pipeline scheduler, and Go bridge listener.
CLI flags: --port, --config, --env, --dry-run.

## Key Files
- main.go: wires all packages; minimal logic here
- config.go: loads strategy-slots.json + .env

## Testing Conventions
- No unit tests here — test packages independently
- Integration test: TestMainBinaryStartup in cmd/autotrader/integration_test.go

## Common Pitfalls
- Do not add business logic to main.go — it's a wiring file only
- The Go bridge subprocess must be started before any MCP tools call go-bridge/*

## Related Skills
- daily-pipeline: starts the binary as a dependency
```

#### `internal/signal/CLAUDE.md`
```markdown
# internal/signal — Signal Generation & Validation (PRD-02)

## Purpose
Runs the MCP-based screener pipeline and validation rules to produce Signal[].
Output: data/signals.json (10 A+ signals, 20 TKL signals per run).

## Key Types
- Signal (defined in @dt/core — do not redefine here)
- ValidationResult: { signal: Signal; passed: boolean; rejectedReason?: string }
- SignalPipeline: orchestrates all validation steps

## Key Interfaces
- Validator: (signal: Signal) => ValidationResult
- Registered validators: MarketCapValidator, ADVValidator, AntiDilutionValidator,
  EarningsWindowValidator, DuplicateValidator

## Testing Conventions
- Each validator has its own test file: *_validator_test.go
- Use fixture signals in testdata/signals/*.json
- Property test: assert all output signals have entry > stop

## Common Pitfalls
- Score is NOT comparable across slots (scanner score 92 ≠ Go score 87)
- AntiDilution check requires SEC filings to be < 180 days old
- The "top 10" selection is per-slot, not global

## Related Skills
- debug-trade: traces why a specific signal was dropped
- review-strategy: checks signal→trade conversion rate
```

#### `internal/risk/CLAUDE.md`
```markdown
# internal/risk — Risk Gating Layer (PRD-03)

## Purpose
Applies 4 mandatory risk gates in sequence: regime, correlation, earnings, sizing.
Input: Signal[]. Output: GatedSignalSet (signals + dropped + risk metadata).

## Key Types
- GatedSignalSet: { signals; tklSignals; dropped; riskSnapshot; circuitBreakerStatus }
- RiskGate: interface with Apply(signals) → GatedSignalSet method
- Registered gates (applied in order):
  1. RegimeGate: GetRegimeProbability → crisis/early_risk_off thresholds
  2. CorrelationGate: GetCorrelationMatrix → rho cap enforcement
  3. EarningsGate: GetEarningsCalendarFiltered → exclusion window ±3 days
  4. SizingGate: OptimizeSizing → risk_pct per position

## Testing Conventions
- Each gate has golden-file tests: testdata/risk/<gate>_cases.json
- Integration test: TestFullGatingPipeline in risk_integration_test.go
- Test with regime=crisis to verify top-N reduction to 5

## Common Pitfalls
- Portfolio-level gates run BEFORE slot-level gates (see PRD-23 §7)
- VIX kill is a hard stop — it does not reduce size, it halts entries entirely
- Correlation check is pairwise within a slot AND cross-slot (both must pass)
- Circuit breaker cooldown days must be respected even after VIX normalizes

## Related Skills
- regime-check: check current regime before running risk gates
- debug-trade: trace why a signal was dropped at the gating stage
```

#### `internal/broker/CLAUDE.md`
```markdown
# internal/broker — Broker Adapters (PRD-07)

## Purpose
Implements BrokerAdapter for 6 brokers: paper, alpaca, ibkr, saxo, trading212, binance.
All adapters implement the same interface — execution engine is broker-agnostic.

## Key Interface
- BrokerAdapter: Connect, GetPositions, PlaceOrder, CancelOrder, MapSymbol, Ping
- All methods must be context-aware (pass ctx, respect ctx.Done())

## Adapters
- paper: simulation, full notification flow, no real orders
- alpaca: US equities, REST API, paper/live toggle
- ibkr: global, requires gateway running on localhost:4001
- saxo: EU/global, OAuth token, UIC-based instrument IDs
- trading212: EU, API key only, London-listed ETF suffixes
- binance: crypto, 24/7, testnet toggle, TKL mode only

## Testing Conventions
- Unit tests with mock HTTP: <broker>_test.go
- Integration tests (require sandbox creds): <broker>_integration_test.go (build tag: integration)
- Run integration tests: go test -tags=integration ./internal/broker/...

## Common Pitfalls
- Always use MapSymbol before sending any order — never hardcode broker symbols
- Binance requires quote asset suffix (BTC-USD → BTCUSDT) — MapSymbol handles this
- Trading212 does not support market orders — use limit at mid-spread
- IBKR gateway must be running before Connect() — health-check first

## Related Skills
- add-broker: step-by-step guide to adding a new adapter
- debug-trade: traces execution-level rejections (VWAP gate, spread, etc.)
```

#### `internal/portfolio/CLAUDE.md`
```markdown
# internal/portfolio — Portfolio Simulation & Tracking (PRD-04, PRD-05)

## Purpose
Walk-forward backtest (sweep.js bridge) + live position tracking (scanner-positions.json).
Produces equity curves, trade history, and drawdown metrics for all slots.

## Key Types
- Trade: { ticker, scanDate, modeId, entryPrice, exitPrice, exitDate, pnlPct, status }
- PositionState: { ticker, scanDate, modeId, currentPrice, unrealizedPnl, daysHeld }
- EquityCurve: { date, equity, highWaterMark, drawdown }[]

## Data Files (append-only — never overwrite)
- data/backtest-trades.json: all closed trades across all history
- data/scanner-positions.json: current open positions
- data/portfolio-history.json: daily equity snapshots per slot

## Testing Conventions
- Use testdata/trades/fixture_trades.json for backtest tests
- Assert equity curves are monotonically non-decreasing in flat markets
- Property test: no trade has exitDate before scanDate

## Common Pitfalls
- sweep.js --full-sweep NEVER runs automatically — only on explicit user request
- Append-only: new trades are appended, not inserted by date
- "Rotated" trades have status='rotated', not 'closed' — don't confuse them
- computeMetrics excludes _premature trades from the hero stats

## Related Skills
- run-backtest: execute a backtest for a specific config
- review-strategy: review metrics for a live slot
```

#### `internal/scheduler/CLAUDE.md`
```markdown
# internal/scheduler — Pipeline Orchestrator (PRD-15)

## Purpose
Cron-based DAG executor. Runs each pipeline step per user on schedule.
Blocking steps (scan_collect, signal_generate, risk_gate) halt on failure.
Non-blocking steps log and continue.

## Key Types
- PipelineDAG: { steps: Step[]; blockingSteps: Set<string> }
- Step: { id; run: () => Promise<StepResult>; deps: string[] }
- StepResult: { success: boolean; artifacts: string[]; durationMs: number }

## DAG Order
scan_collect → signal_generate → risk_gate →
  [update_tracking → sweep_backtest → gen_status_page → gen_api → publish_push → qa_check]
  [plan_generate → execute_orders → notify_results]

## Testing Conventions
- Mock each step with a stub that returns success/failure
- Test that blocking step failure halts downstream steps
- Test that non-blocking step failure doesn't halt remaining steps

## Common Pitfalls
- Per-user lock: concurrent runs for the same user are prevented
- plan_generate only runs if user has an active broker link
- Phase 9.5 (analytical refresh) runs after gen_api, before idle

## Related Skills
- daily-pipeline: the skill that invokes this orchestrator
```

#### `internal/bridge/CLAUDE.md`
```markdown
# internal/bridge — Go Bridge (PRD-23 §5)

## Purpose
Wraps the systematic-tss Go binary behind a stdio JSON-RPC interface.
Makes mechanical strategies indistinguishable from scanner strategies to the pipeline.

## Communication Protocol
- Transport: stdin/stdout JSON-RPC (newline-delimited)
- Methods: list_scanners, list_pms, list_strategies, scan, manage_positions, run_backtest
- The bridge process is a singleton — do NOT start multiple instances

## Key Types (Go-side)
- Opportunity: { ticker, score, entry, stop, tp1, tp2, strategy, region, sector }
- JSON-RPC Request: { id, method, params }
- JSON-RPC Response: { id, result?, error? }

## Testing Conventions
- Use golden files: testdata/bridge/<method>_response.json
- Test timeout handling: bridge must respond within 30s or return error
- Test graceful degradation: if bridge is down, scanner strategies still work

## Common Pitfalls
- Bridge must be started before any MCP tools call go-bridge/* tools
- Scores from Go bridge are NOT comparable to scanner scores (different functions)
- The bridge auto-discovers strategies via init() — no manual registration in bridge code

## Related Skills
- add-strategy: uses the bridge list_strategies call to verify registration
```

#### `internal/mart/CLAUDE.md`
```markdown
# internal/mart — Analytical Data Layer (PRD-24)

## Purpose
SQLite-based OLAP store (data/analytical.db) with staging → intermediate → mart layers.
Refreshed as Phase 9.5 of the daily pipeline. Exposes QueryAnalytics, GetMart,
DiscoverStrategy via MCP tools.

## Key Tables/Views
- stg_signals, stg_trades, stg_positions: staging (verbatim JSON → rows)
- int_trades_enriched, int_signals_enriched: with regime, sector, score_bucket
- mart_strategy_performance, mart_regime_analysis, mart_signal_quality,
  mart_sector_rotation, mart_risk_attribution, mart_discovery_candidates

## Refresh
- RefreshAll(): full re-materialize of staging + intermediate (marts are views)
- Incremental: only rows with scan_date > last_refresh_ts are re-ingested

## Testing Conventions
- Use testdata/mart/fixture_*.json for ingestion tests
- Assert mart row counts > 0 after RefreshAll() with fixture data
- Golden test: mart_strategy_performance output matches expected fixture

## Common Pitfalls
- Marts are views (no materialization cost at refresh, computed at query time)
- SQLite WAL mode — safe for concurrent reads, single writer
- discovery_candidates requires ≥ 5 tested neighbors for k-NN confidence ≥ 0.7

## Related Skills
- discover-strategy: primary consumer of DiscoverStrategy MCP tool
- review-strategy: queries mart_strategy_performance and mart_regime_analysis
```

#### `dashboard/CLAUDE.md`
```markdown
# dashboard/ — React Dashboard (PRD-11)

## Purpose
Static React app hosted on GitHub Pages. Displays equity curves, open positions,
regime indicators, signal cards, and the 6-slot status page.

## Tech Stack
- React 18 + TypeScript
- Recharts for equity curves, heatmaps
- Tailwind CSS (dark-first, Foundation design tokens)
- Data fetched from portfolio/v1/{slot}/*.json (public API)

## Key Components
- SlotCard: equity curve + key metrics per strategy slot
- PositionTable: open positions with live price via live-tracker.js
- RegimeIndicator: VIX-based regime badge (RISK-ON/NEUTRAL/EARLY RISK-OFF/RISK-OFF)
- SignalCard: today's top signals with entry/stop/TP levels

## Design Conventions
- Browse https://styles.refero.design/ before designing any new component
- Document inspiration source in PR description
- Dark-first: bg-gray-900, text-gray-100 base; accent: brand teal
- No inline styles — Tailwind classes only
- See PRD-25 §9 for full UI design guidelines

## Testing Conventions
- Component tests: React Testing Library (not Enzyme)
- E2E: Playwright (visual regression snapshots in tests/snapshots/)
- Run: npm test (unit) && npx playwright test (E2E)

## Common Pitfalls
- live-tracker.js uses allorigins.win/get (not /raw — no CORS headers)
- Portfolio API data is cached 5 min in sessionStorage — don't bypass cache
- Slot colors come from strategy-slots.json color field — don't hardcode

## Related Skills
- add-feature: if adding a new dashboard component
```

---

## 5. MCP Configuration (.mcp.json)

### 5.1 Project-Level File

Place at `.mcp.json` in the project root. Agents discover this file automatically on startup.

```json
{
  "mcpServers": {
    "dailytickers-gateway": {
      "transport": "http",
      "url": "${DT_MCP_GATEWAY_URL}/mcp",
      "description": "Primary data gateway — market data, screeners, risk metrics, regime probability, options, earnings calendar. 58 tool types.",
      "env": {
        "DT_MCP_GATEWAY_URL": "${DT_MCP_GATEWAY_URL}"
      },
      "tools": [
        "GetMarketOverview",
        "QueryData",
        "GetInstruments",
        "RunAutoScreener",
        "RunScreener",
        "GetRegimeProbability",
        "GetCorrelationMatrix",
        "GetEarningsCalendarFiltered",
        "OptimizeSizing",
        "CalculatePortfolioVaR",
        "GetPortfolioStressTest",
        "QueryAnalytics",
        "GetMart",
        "DiscoverStrategy",
        "CompareStrategies",
        "ListCubes",
        "ListMarts",
        "RunTransformation",
        "AnalyzeOptionsStrategy",
        "ScreenOptions"
      ]
    },
    "go-bridge": {
      "transport": "http",
      "url": "http://localhost:${DT_BRIDGE_PORT:-8081}/bridge",
      "description": "Go bridge to systematic-tss engine — 60+ mechanical scanners, backtesting, position management.",
      "env": {
        "DT_BRIDGE_PORT": "${DT_BRIDGE_PORT}"
      },
      "tools": [
        "list_scanners",
        "list_pms",
        "list_strategies",
        "scan",
        "manage_positions",
        "run_backtest"
      ],
      "health_check": "http://localhost:${DT_BRIDGE_PORT:-8081}/health"
    },
    "forecast-timesfm": {
      "transport": "http",
      "url": "http://ser.tail5d09f.ts.net:8400/mcp/",
      "description": "TimesFM 2.5-200M time-series forecasting — price CI bands, volatility forecasting, volume forecasting, VIX regime forecast. Max 10 tickers/call, lookback ≤ 60 days.",
      "tools": [
        "Forecast",
        "ForecastRaw",
        "ForecastVix",
        "Backtest"
      ],
      "notes": [
        "Direction accuracy: 44% global (worse than chance). Do NOT use direction as primary signal.",
        "CI bands [q10-q90] are calibrated (~80% coverage) — use as TP/SL zones.",
        "Strong use cases: volatility (ATR/RVOL, 67-73% dir), volume (69% dir), sector rotation ranking.",
        "Exclude tickers with earnings ±3 days — model performance degrades -16pp around earnings."
      ]
    },
    "browser-tools": {
      "transport": "stdio",
      "command": "npx",
      "args": ["@playwright/mcp"],
      "description": "Browser automation for web scraping, visual QA, and form interactions.",
      "tools": [
        "browser_navigate",
        "browser_snapshot",
        "browser_click",
        "browser_type",
        "browser_screenshot"
      ]
    }
  }
}
```

### 5.2 Schema Definition

```typescript
interface MCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

interface MCPServerConfig {
  transport: 'http' | 'stdio' | 'sse';
  url?: string;           // for http/sse
  command?: string;       // for stdio
  args?: string[];        // for stdio
  description: string;    // agent-readable: what this server provides
  env?: Record<string, string>;  // env var references only (${VAR_NAME} syntax)
  tools?: string[];       // list of available tool names (for agent discovery)
  health_check?: string;  // URL to verify server is alive
  notes?: string[];       // agent-readable caveats or usage guidelines
}
```

### 5.3 Security Rules for .mcp.json

- **Never store secrets directly** in `.mcp.json`. Use `${ENV_VAR}` references only.
- `.mcp.json` is committed to the repository — it contains no secrets.
- Actual values are in `.env` (local) or Oracle Cloud Vault (production).
- If a server requires auth headers, inject them via the server's own env var handling — not in `.mcp.json`.

### 5.4 Agent Startup Protocol

When an AI agent starts a session in this project:

1. Read `.mcp.json` — discover available MCP servers.
2. Resolve `${ENV_VAR}` references from the process environment.
3. Health-check each server with a `health_check` URL (if provided).
4. Mark degraded servers (health check failed) — still allow other servers.
5. Read `.agents/skills/*/SKILL.md` frontmatter — build skill index.
6. Read root `CLAUDE.md` — project context.

---

## 6. Secrets & Environment Management

### 6.1 Naming Convention

All environment variables follow the pattern: `DT_{DOMAIN}_{SUBKEY}`

```bash
# MCP / Data
DT_MCP_GATEWAY_URL=https://gateway.dailytickers.com/mcp

# Brokers
DT_BROKER_ALPACA_KEY=<key>
DT_BROKER_ALPACA_SECRET=<secret>
DT_BROKER_ALPACA_PAPER=true           # "true" for paper, "false" for live
DT_BROKER_IBKR_GATEWAY_HOST=localhost
DT_BROKER_IBKR_GATEWAY_PORT=4001
DT_BROKER_IBKR_ACCOUNT_ID=<id>
DT_BROKER_SAXO_ACCESS_TOKEN=<token>
DT_BROKER_SAXO_ACCOUNT_KEY=<key>
DT_BROKER_T212_API_KEY=<key>
DT_BROKER_BINANCE_API_KEY=<key>
DT_BROKER_BINANCE_API_SECRET=<secret>
DT_BROKER_BINANCE_TESTNET=true

# Notifications
DT_NOTIFY_TELEGRAM_TOKEN=<token>
DT_NOTIFY_TELEGRAM_CHAT_ID=<chat_id>
DT_NOTIFY_TELEGRAM_TOPIC_TURBO=89
DT_NOTIFY_TELEGRAM_TOPIC_DYNAMIC=89
DT_NOTIFY_TELEGRAM_TOPIC_BALANCED=90
DT_NOTIFY_TELEGRAM_TOPIC_SECURED=91
DT_NOTIFY_TELEGRAM_TOPIC_FORTRESS=91
DT_NOTIFY_TELEGRAM_TOPIC_TKL=1064
DT_NOTIFY_DISCORD_WEBHOOK_URL=<url>

# Infrastructure
DT_ORACLE_VAULT_OCID=<ocid>          # for production secret fetch
DT_LITESTREAM_BUCKET=<bucket>        # for SQLite replication

# Go Bridge
DT_BRIDGE_PORT=8081
DT_BRIDGE_BINARY_PATH=./systematic-tss

# Feature Flags
DT_DRY_RUN=false                     # true = plan only, no execution
DT_PAPER_ONLY=false                  # true = force paper broker for all slots
```

### 6.2 .env File Setup

**`.env`** (local, never committed — in `.gitignore`):
```bash
# Copy from .env.example and fill in real values
cp .env.example .env
```

**`.env.example`** (committed as template):
```bash
# MCP / Data
DT_MCP_GATEWAY_URL=https://gateway.dailytickers.com/mcp

# Brokers — fill in real values in .env, never here
DT_BROKER_ALPACA_KEY=<your_alpaca_key_here>
DT_BROKER_ALPACA_SECRET=<your_alpaca_secret_here>
DT_BROKER_ALPACA_PAPER=true
# ... (all vars with placeholder values)
```

### 6.3 Loading in Go

Using `github.com/joho/godotenv`:

```go
import "github.com/joho/godotenv"

func init() {
    // Load .env in development; no-op in production (vars already in env)
    _ = godotenv.Load()
}

func mustEnv(key string) string {
    v := os.Getenv(key)
    if v == "" {
        log.Fatalf("required env var %s is not set", key)
    }
    return v
}
```

### 6.4 Production: Oracle Cloud Vault

Oracle Cloud Vault provides secret storage on the Always Free tier (up to 150 secrets, 150K API calls/month free).

```go
// internal/config/vault.go
type VaultProvider struct {
    client secrets.SecretsClient
    vaultID string
}

func (v *VaultProvider) GetSecret(name string) (string, error) {
    // Fetch from Oracle Cloud Vault by secret name
    // Cache in memory for the process lifetime (secrets don't rotate mid-session)
}
```

**Vault secret naming**: mirrors env var names but kebab-case:
- `DT_BROKER_ALPACA_KEY` → vault secret name: `dt-broker-alpaca-key`

**Startup precedence** (highest to lowest):
1. Process environment variable (set by systemd unit or shell)
2. `.env` file (development only)
3. Oracle Cloud Vault (production fallback)

### 6.5 MCP Secrets Provider (Alternative Pattern)

For MCP servers that need credentials, the `.mcp.json` `env` block uses `${VAR_NAME}` references. The MCP client resolves these from the process environment at connection time:

```json
{
  "env": {
    "ALPACA_KEY": "${DT_BROKER_ALPACA_KEY}",
    "ALPACA_SECRET": "${DT_BROKER_ALPACA_SECRET}"
  }
}
```

This keeps secrets out of the `.mcp.json` file entirely.

---

## 7. Agentic Design Patterns Mapping

Based on the 21 agentic design patterns from `evoiz/Agentic-Design-Patterns`, mapped to platform modules:

| # | Pattern | Platform Implementation | PRD |
|---|---------|------------------------|-----|
| 1 | **Prompt Chaining** | Pipeline DAG: scan_collect → signal_generate → risk_gate → plan_generate → execute_orders. Each step's output is the next step's input — no raw LLM chaining, but the same deterministic pipeline principle. | PRD-15 |
| 2 | **Routing** | Strategy type dispatch: scanner signals → ScannerStrategy, mechanical signals → GoBridgeStrategy, ML signals → MLStrategy. All produce identical `Signal[]` — routing is transparent to downstream. | PRD-23 §4 |
| 3 | **Parallelization** | Multi-slot concurrent scan (all StrategySlots scan independently in parallel). Multi-broker execution (each slot×broker pair executes concurrently). Phase 4 (simulate) and Phase 6 (plan) run in parallel per slot. | PRD-15, PRD-06 |
| 4 | **Reflection** | Strategy health monitor (`review-strategy` skill) detects degradation. `regime-recalibrate.js` self-tunes regime parameters by comparing live performance vs `backtest-results.json#advisor_*`. | PRD-17, PRD-13 |
| 5 | **Tool Use** | 11 MCP tools (GetMart, QueryAnalytics, DiscoverStrategy, RunAutoScreener, etc.) + Go bridge JSON-RPC (6 methods) + Yahoo Finance REST (price tracking). All tool calls are typed, discoverable, and logged. | PRD-12, PRD-24 |
| 6 | **Planning** | Trading plan generation per slot×broker pair: `gen-trading-plan.js` produces `trading-plan-{mode}-{broker}-{date}.json` with explicit entry/SL/TP orders before any execution. Human can review in dry-run mode. | PRD-06 |
| 7 | **Multi-Agent** | Skills calling other skills (discover-strategy → run-backtest → review-strategy). Each skill is an agent workflow; composition creates multi-agent pipelines. `team` skill for N coordinated agents on shared task list. | PRD-25 |
| 8 | **Memory** | Append-only trade history (`backtest-trades.json`). Config versioning (`config-history.json` — append-only). Equity curves per slot (daily snapshots, never overwritten). `MEMORY.md` persistent agent memory. | PRD-04, PRD-05 |
| 9 | **Learning/Adaptation** | Grid search optimization (sweep.js `--full-sweep` discovers best params). `regime-recalibrate.js` detects regime changes and proposes param sets from historical regime-specific performance. | PRD-17, PRD-13 |
| 10 | **MCP (Model Context Protocol)** | Standardized tool interface for all data sources. Single `.mcp.json` config. All external capabilities exposed as MCP tools — no raw REST calls from agent code. Agents discover tools via server `description` + `tools` list. | PRD-12, PRD-20, PRD-21, PRD-24 |
| 11 | **Goal Setting** | Explicit target metrics: Sharpe ≥ 1.5, WR ≥ 55%, PF ≥ 1.8, Max DD ≤ 15%. Encoded as `constraints` in `DiscoverStrategy` and `OptimizeStrategy`. The `review-strategy` skill compares live metrics vs these targets. | PRD-04, PRD-17 |
| 12 | **Exception Handling** | Circuit breaker per slot (DD breaker, VIX kill, daily/weekly stop-loss). Portfolio-level aggregate breakers (-15% portfolio, VIX > 40). Graceful degradation: MCP timeout → read local cache; bridge down → scanner strategies still run. | PRD-06, PRD-03, PRD-23 §7 |
| 13 | **Human-in-the-Loop** | Manual signal override (edit `signals.json` before plan generation). `--dry-run` mode: generates plan but does not execute — human reviews before live execution. Broker link activation is a manual step. | PRD-06 |
| 14 | **RAG** | Historical trade lookup for similar setups via `mart_signal_quality` cube: given a new signal, find past signals with same strategy/sector/regime bucket and return their hit rates. Informs score threshold calibration. | PRD-24 §7 UC-2 |
| 15 | **Inter-Agent Communication** | Skills calling other skills (explicit step references in SKILL.md). MCP tool composition: `DiscoverStrategy` returns `run_backtest_hint` that `run-backtest` skill consumes. `team` orchestration via shared task list. | PRD-25 |
| 16 | **Resource-Aware** | Free-tier budget enforced at architecture level: single Go binary (no microservices), SQLite (no managed DB), GitHub Pages (no hosting cost), GitHub Actions 2000 min/month cap. See §11 for full budget. | PRD-00 §7 |
| 17 | **Reasoning** | Score computation is a transparent decision tree (not a black box): each factor adds +X pts, confluence factors are listed in `Signal.confluence[]`. Risk gating decisions are logged in `GatedSignalSet.dropped[].reason`. | PRD-02, PRD-03 |
| 18 | **Guardrails** | Hard limits enforced unconditionally: VIX kill (hard stop, no override), DD breaker (mandatory cooldown), correlation caps (automatic drop of worst-score conflicting pair), position limits per slot/sector. | PRD-03, PRD-23 §7 |
| 19 | **Evaluation** | QA validation: 34 automated checks across 6 categories (data files, stats consistency, trade integrity, strategy labels, API consistency, status page). Backtest metrics with regime breakdown. | PRD-16, PRD-04 |
| 20 | **Prioritization** | Signal scoring (0–100 scale) + rotation logic: `close worst position → enter best-scoring candidate` (daily_max1/daily_max2 rotation modes). Cross-slot: portfolio-level sector/correlation caps prevent concentration. | PRD-02, PRD-06 |
| 21 | **Exploration/Discovery** | `DiscoverStrategy` MCP tool: k-NN interpolation over `mart_discovery_candidates` finds untested parameter combinations predicted to outperform. Grid search (`sweep.js --full-sweep`) explores parameter space systematically. | PRD-24 §6.6, PRD-17 |

### 7.1 Pattern Interaction Diagram

```
User Request / Cron Trigger
        │
        ▼
  [Goal Setting] ──── Target metrics defined in slot config
        │
        ▼
  [Planning] ──────── gen-trading-plan.js produces explicit plan
        │
        ▼
  [Routing] ──────── Scanner vs Go Bridge vs ML strategy dispatch
        │
        ▼
  [Parallelization] ─ Multi-slot parallel scan
        │
        ▼
  [Tool Use] ──────── MCP tools: screeners, risk metrics, forecasts
        │
        ▼
  [Reasoning] ─────── Score computation + confluence factors
        │
        ▼
  [Guardrails] ────── VIX kill, DD breaker, correlation caps
        │
        ▼
  [Human-in-Loop] ── dry-run review gate (optional)
        │
        ▼
  [Exception Handling] ── Circuit breaker / graceful degrade
        │
        ▼
  [Memory] ────────── Append trade to history
        │
        ▼
  [Evaluation] ────── QA check 34 validations
        │
        ▼
  [Reflection] ────── review-strategy: degradation detection
        │
        ▼
  [Exploration] ───── discover-strategy: find better candidates
```

---

## 8. Plugin Architecture

### 8.1 Adding a New Strategy

The platform supports three strategy types, all producing `Signal[]`:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Strategy Plugin Paths                         │
│                                                                  │
│  Path A: MCP Scanner Strategy                                   │
│  └── Implement ScannerStrategy class in TypeScript              │
│      Uses: RunAutoScreener, RunScreener, QueryData MCP tools    │
│      Register: strategy-registry.register(new MyScanner())      │
│                                                                  │
│  Path B: Go Mechanical Strategy                                  │
│  └── Implement OpportunityScanner interface in Go               │
│      Uses: systematic-tss technical indicators + OHLCV data     │
│      Register: init() { RegisterScanner("name", factory) }      │
│      Exposed via: Go Bridge JSON-RPC list_strategies            │
│                                                                  │
│  Path C: ML Strategy                                             │
│  └── Implement Strategy interface in TypeScript                  │
│      Uses: any data source (MCP, Python subprocess, API)        │
│      Register: same as Path A                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Step-by-step for Path B (Go mechanical strategy)** — use the `add-strategy` skill for guided execution:

```
Step 1: Implement OpportunityScanner interface
Step 2: Register in ScannerFactory via init()
Step 3: Register composite strategy (scanner + PM)
Step 4: Write unit tests + property tests + golden files
Step 5: Build and verify bridge discovers the strategy
Step 6: Add StrategySlot config (start with paper broker)
Step 7: Run run-backtest skill → verify metrics ≥ targets
Step 8: Update PRD-23 §9 scanner catalog
Step 9: Update internal/bridge/CLAUDE.md
Step 10: Deploy to paper for ≥ 5 sessions
Step 11: Promote to live broker
```

**Decision tree for strategy path selection**:

```
Is the strategy based on MCP-sourced screener signals?
├── Yes → Path A (MCP Scanner Strategy)
└── No
    ├── Does it require tick-level OHLCV technical analysis?
    │   ├── Yes → Path B (Go Mechanical Strategy)
    │   └── No
    │       ├── Does it require ML inference (model weights, embeddings)?
    │       │   ├── Yes → Path C (ML Strategy)
    │       │   └── No → Path A with custom data source
```

### 8.2 Adding a New Broker

Every broker is a `BrokerAdapter` implementation. Use the `add-broker` skill for guided execution.

**The interface contract** (all methods required):

```go
type BrokerAdapter interface {
    // Lifecycle
    Connect(ctx context.Context, creds BrokerCredentials) error
    Disconnect() error
    Ping() error
    
    // Account state
    GetAccount() (AccountInfo, error)
    GetPositions() ([]BrokerPosition, error)
    GetOrders() ([]OrderStatus, error)
    
    // Order management
    PlaceOrder(ctx context.Context, order OrderRequest) (OrderResult, error)
    CancelOrder(ctx context.Context, orderID string) error
    GetOrderStatus(ctx context.Context, orderID string) (OrderStatus, error)
    
    // Instrument resolution
    MapSymbol(internalSymbol string, assetClass AssetClass) (string, error)
    
    // Optional: market data for entry validation
    GetQuote(ctx context.Context, brokerSymbol string) (Quote, error)
}
```

**Decision tree for MarketOrder vs LimitOrder**:

```
Does the broker support market orders?
├── Yes → Use MarketOrder for entries (faster fill)
└── No (e.g., Trading212)
    └── Use LimitOrder at mid-spread with 0.1% tolerance
        └── If unfilled after 60s → cancel and skip (VWAP gate handles it)
```

**Symbol mapping edge cases** (document all in `INSTRUMENT_NOTES.md`):

| Asset Class | Internal Symbol | Broker Format | Example |
|-------------|----------------|---------------|---------|
| US Equity | `NVDA` | `NVDA` (Alpaca, IBKR) | Direct |
| EU Equity | `AIR.PA` | `AIR:xpar` (Saxo), `AIR` (Trading212) | Suffix varies |
| UK Equity | `BATS.L` | `BATS:xlon` (Saxo), `BATS` (Trading212) | |
| Crypto | `BTC-USD` | `BTCUSDT` (Binance), `XBTUSDT` (Saxo) | Exchange-specific |
| Metals ETF | `GLD` | `GLD` (US-listed, most brokers) | Usually direct |

### 8.3 Adding a New Data Source

Data sources feed market data into strategies and MCP tools. Implement the `DataProvider` interface:

```go
type DataProvider interface {
    // Fetch OHLCV bars for a symbol
    GetBars(ctx context.Context, symbol string, from, to time.Time, interval BarInterval) ([]OHLCV, error)
    
    // Fetch current quote
    GetQuote(ctx context.Context, symbol string) (Quote, error)
    
    // List available symbols
    ListSymbols(ctx context.Context, exchange string) ([]string, error)
    
    // Health
    Ping() error
}
```

**Registration**:

```go
func init() {
    RegisterProvider("<exchange-id>", func(cfg ProviderConfig) DataProvider {
        return &<Name>Provider{cfg: cfg}
    })
}
```

**Cache configuration** (mandatory — never hit external APIs in a tight loop):

```go
type CacheConfig struct {
    BarsTTL  time.Duration  // how long to cache OHLCV bars (recommended: 24h for daily)
    QuoteTTL time.Duration  // how long to cache quotes (recommended: 5min)
    Layer    CacheLayer     // L1=memory, L2=Redis, L3=origin
}
```

**Adding the data source as an MCP tool**: Expose via PRD-20 MCP server by adding a new `GetBars_<exchange>` tool that wraps the provider. This makes the data source available to agents without knowing the Go API.

---

## 9. UI Design Guidelines

### 9.1 Design Research Protocol

**Before designing any new UI component, browse `https://styles.refero.design/`** for inspiration. This is a mandatory step, not optional.

**Protocol**:
1. Navigate to Refero.design and search for the component type (e.g., "equity curve", "position table", "regime indicator").
2. Screenshot 2–3 references that match the dark trading dashboard aesthetic.
3. In the PR description, add a "Design Inspiration" section with the reference screenshots or URLs.
4. Do not copy pixel-for-pixel — synthesize the best patterns.

### 9.2 Design System Tokens (Foundation — Dark First)

```css
/* Base palette */
--color-bg-primary:     #0f1117;   /* Dark base */
--color-bg-secondary:   #1a1d27;   /* Card backgrounds */
--color-bg-tertiary:    #242736;   /* Hover states, borders */

/* Brand accent */
--color-accent:         #00d2c8;   /* Teal — primary action, positive trend */
--color-accent-dim:     #00d2c820; /* Teal at 12% opacity — backgrounds */

/* Semantic colors */
--color-green:          #22c55e;   /* Profit, positive, OK */
--color-red:            #ef4444;   /* Loss, negative, CRITICAL */
--color-amber:          #f59e0b;   /* Warning, pending, WATCH */
--color-blue:           #3b82f6;   /* Info, regime, neutral */

/* Text */
--color-text-primary:   #f1f5f9;
--color-text-secondary: #94a3b8;
--color-text-muted:     #475569;

/* Typography */
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;  /* Numbers, tickers */
--font-sans: 'Inter', system-ui, sans-serif;              /* Labels, text */
```

### 9.3 Component Patterns

**Stat Card** (equity curve hero):
```tsx
interface StatCardProps {
  label: string;
  value: string;
  delta?: number;       // positive=green, negative=red
  trend?: number[];     // sparkline data
}

// Layout: label (muted, small-caps) | value (large, mono) | delta badge
// Reference: trading dashboard stat cards on Refero.design
```

**Equity Curve**:
- Use Recharts `AreaChart` with `LinearGradient` fill (teal → transparent)
- X-axis: dates formatted as `MMM DD`
- Y-axis: equity in USD, formatted with commas
- Tooltip: date + equity + drawdown from high water mark
- Reference: Refero.design search "portfolio performance chart"

**Position Table**:
- Sticky header, alternating row shading (bg-secondary / bg-tertiary)
- Ticker column: monospace, uppercase, with asset class badge
- P&L column: colored (green/red), monospace, 2 decimal places
- Stop proximity: progress bar (green→red based on distance %)
- Reference: Refero.design search "trading positions table"

**Regime Indicator**:
- Badge component: icon + label + VIX value
- Colors: RISK-ON (green), NEUTRAL (blue), EARLY RISK-OFF (amber), RISK-OFF (red)
- Pulsing dot animation for live data
- Reference: Refero.design search "market status indicator"

**Signal Card** (scanner output):
- Compact card: ticker + strategy label + score badge + entry/stop/TP levels
- Score badge: colored by score (≥90 teal, 80-89 amber, <80 red)
- Sharia badge if `sharia=true`
- Expandable: click to show full signal details (thesis, confluence, invalidations)

### 9.4 Animation & Interaction

- Use `@radix-ui/react` primitives for accessible components (dialogs, tooltips, popovers)
- CSS transitions: 150ms ease-out for hover states, 300ms for panel open/close
- Do not use animation libraries (Framer Motion) — CSS transitions only, keeps bundle small
- Live data updates: fade-in the new value (opacity 0→1 over 200ms), no jarring flashes

### 9.5 Responsive Layout

```
Desktop (≥ 1280px): 
  2-column grid: [Equity Curve + Stats] | [Open Positions]
  Bottom row: [Signal Cards horizontal scroll]

Tablet (768–1279px):
  Single column, full-width cards
  Signal Cards: 2-column grid

Mobile (< 768px):
  Single column, condensed stat cards
  Signal Cards: single column, key info only
```

### 9.6 Performance Budget

| Metric | Target | Hard Cap |
|--------|--------|----------|
| First Contentful Paint | < 1.5s | 3s |
| Time to Interactive | < 2.5s | 5s |
| Bundle size (gzipped) | < 150KB | 300KB |
| API requests on load | ≤ 6 | 10 |

- Use React lazy loading for the heavy dashboard sections
- Pre-aggregate data in `portfolio/v1/{slot}/all.json` — one request per slot
- Cache in sessionStorage for 5 minutes (same pattern as live-tracker.js)

---

## 10. Development Workflow

### 10.1 Feature Branch Workflow

```
main (always deployable)
  │
  └─ feature/<name>      ← feature development
       │
       └─ PR → code review → merge to main → auto-deploy (GitHub Actions)
```

**Never commit directly to `main`**. All changes via PR.

### 10.2 Skill-Guided Implementation

For any non-trivial implementation task:

1. **Identify the relevant skill**: Does a skill cover this operation? Invoke it.
2. **Read the package CLAUDE.md**: Understand conventions before writing code.
3. **Write tests first**: Fixtures + property tests before implementation.
4. **Implement**: Follow the package conventions.
5. **Update CLAUDE.md**: Root + package CLAUDE.md if new concepts introduced.
6. **Create skill**: If the feature introduces a new recurring operation.
7. **Run QA**: `go test ./...` + `node tools/qa-check.js` must both pass with 0 failures.

### 10.3 PR Checklist (Mandatory — 100% Before Merge)

```markdown
## PR Checklist

### Code Quality
- [ ] `go test ./...` passes
- [ ] `go vet ./...` passes (0 warnings)
- [ ] `node tools/qa-check.js` passes (0 ❌)
- [ ] No fmt.Println / console.log debug output left in
- [ ] No hardcoded secrets or API keys

### Documentation
- [ ] Root `CLAUDE.md` updated (if new top-level concept)
- [ ] Package `CLAUDE.md` updated (if new type, interface, or pitfall)
- [ ] `.env.example` updated (if new env vars)
- [ ] PRD updated (if PRD-level decision changed)

### Skills
- [ ] Skill created/updated (if new operational workflow introduced)
- [ ] Skill triggers are specific enough (no accidental invocations)

### Data Integrity
- [ ] No overwrites to append-only files (`backtest-trades.json`, equity curves)
- [ ] `data/strategy-slots.json` valid JSON after changes
- [ ] New strategy starts with `brokerId: "paper"` (not live)

### UI (if applicable)
- [ ] Refero.design reference linked in PR description
- [ ] Responsive layout tested (desktop + mobile)
- [ ] Dark theme only (no light-mode-specific code)
- [ ] Playwright visual regression passes

### Security (always)
- [ ] No new SQL without parameterized queries
- [ ] No user input reflected without sanitization
- [ ] MCP tool inputs validated at handler entry
- [ ] New broker adapter: credentials from env vars only
```

### 10.4 Agent-Assisted Code Review

For PRs that touch risk management, execution, or broker adapters (high-blast-radius changes), invoke the `review` skill before requesting human review:

```bash
# In Claude Code session
/review  # reviews the current branch diff
```

The reviewer agent checks:
- Interface contract compliance (does the new code satisfy the interface?)
- Security properties (no hardcoded secrets, no SQL injection surface)
- Data integrity (no append-only file overwrites)
- Test coverage (golden files present for new output formats)

### 10.5 Release Protocol

```
1. All PRs merged to main
2. GitHub Actions CI passes (go test + qa-check)
3. Tag release: git tag v<major>.<minor>.<patch>
4. Push tag: git push origin --tags
5. GitHub Actions auto-builds Go binary + deploys React dashboard
6. Verify health check: curl https://api.dailytickers.com/health
7. Run monitor-portfolio skill to verify live positions unaffected
```

### 10.6 Incident Response

When a pipeline step fails in production:

1. **Check `data/pipeline-errors.log`** for the failing step and error message.
2. **Invoke `debug-trade` skill** if the failure is execution-related.
3. **Invoke `regime-check` skill** if the failure is risk-gating-related.
4. **Manual intervention**: Edit the relevant data file (e.g., fix a malformed signal) and re-run the pipeline from the failed step.
5. **Never restart the full pipeline** if only one step failed — use the scheduler's step restart API.

---

## 11. Zero-Cost Infrastructure Mandate

### 11.1 Monthly Budget: €0

This is a hard architectural constraint, not a preference. Every infrastructure decision must be validated against this budget.

| Service | Usage | Free Tier Limit | Cost |
|---------|-------|----------------|------|
| **Oracle Cloud ARM A1** | Single VM: 4 OCPUs, 24GB RAM, 200GB disk | Always Free — permanent | €0 |
| **Oracle Object Storage** | SQLite backups via Litestream | 10GB Always Free | €0 |
| **GitHub Pages** | Static React dashboard hosting | Unlimited for public repos | €0 |
| **AWS CloudFront** | CDN for dashboard assets | 1TB/month, 10M requests/month free | €0 |
| **GitHub Actions** | CI/CD: build, test, deploy | 2,000 min/month for public repos | €0 |
| **Telegram Bot API** | Trade notifications, pipeline alerts | Free, rate-limited | €0 |
| **Discord Webhooks** | Secondary notifications | Free | €0 |
| **Yahoo Finance** | Price tracking via scraping | Free (unofficial) | €0 |
| **MCP Gateway** | `gateway.dailytickers.com` | Self-hosted on the ARM A1 VM | €0 |
| **TimesFM Forecast** | Self-hosted on `ser` (Tailscale) | Self-hosted, no cloud cost | €0 |
| **SQLite + Litestream** | DB replication to Object Storage | Replaces managed DB (€50-200/mo) | €0 |
| **Total** | | | **€0/month** |

### 11.2 Oracle Cloud Always Free ARM A1 — Capacity Planning

```
Hardware: 4 OCPUs (ARM Ampere A1) · 24GB RAM · 200GB NVMe
OS: Ubuntu 22.04 LTS

Allocation:
  Go binary (API + pipeline + scheduler):  2 OCPU · 4GB RAM
  Go bridge (systematic-tss):              1 OCPU · 2GB RAM  
  Redis (L2 cache):                        0.5 OCPU · 512MB RAM
  SQLite WAL (analytical.db):             Shared disk, 2GB estimated
  Litestream replication:                  0.5 OCPU · 256MB RAM
  OS + system:                             Remaining headroom
  
  Peak daily pipeline: ~30s of high CPU (scanner + backtest)
  Idle: < 1% CPU
  
  Disk usage estimate:
    backtest-trades.json (2 years × 300 trades/year):  ~5MB
    analytical.db (full history):                       ~500MB
    scanner HTMLs + portfolio API JSON:                 ~200MB
    Litestream WAL segments:                            ~1GB
    Total:                                              ~2GB (well within 200GB)
```

### 11.3 Architecture Decisions Driven by Zero-Cost

| Constraint | Decision | Alternative Avoided |
|------------|----------|-------------------|
| No managed DB | SQLite + Litestream replication | PostgreSQL on RDS (~€30/mo) |
| Single VM | Monolith Go binary, not microservices | Kubernetes (~€100/mo) |
| No CDN cost | AWS CloudFront free tier | Cloudflare Pro (~€20/mo) |
| No auth SaaS | JWT + Go stdlib, no Auth0 | Auth0 (~€23/mo for 1000 MAU) |
| No log aggregation SaaS | Structured JSON logs to disk, rotated | Datadog (~€50/mo) |
| No message queue | Embedded pipeline scheduler in Go | Redis Cloud, SQS |
| No ML inference API | TimesFM self-hosted on `ser` | OpenAI API (~€20-50/mo) |

### 11.4 Free Tier Monitoring

Run monthly to ensure no accidental spend:

```bash
# Oracle Cloud usage check (via OCI CLI)
oci limits resource-availability get \
  --service-name compute \
  --limit-name vm-standard-a1-micro-count \
  --compartment-id <compartment_id>

# GitHub Actions minutes check
gh api /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs \
  --jq '[.workflow_runs[].run_started_at] | length'
```

Alert threshold: GitHub Actions at 1800/2000 minutes → reduce CI run frequency (cache aggressively).

### 11.5 Scaling Path (If Free Tier Becomes Insufficient)

The architecture is designed so that each component can be scaled independently if usage grows:

```
Current (€0):
  Oracle ARM A1 (monolith) + SQLite

Scale Step 1 (~€10/mo):
  Oracle ARM A1 (API + scheduler) + Oracle AMD E2 (Go bridge only)
  → Separates CPU-intensive backtesting from API serving

Scale Step 2 (~€30/mo):
  Add Oracle Autonomous Database (free tier: 20GB) for analytical.db
  → Enables concurrent read queries during pipeline refresh

Scale Step 3 (~€50/mo):
  Add Redis Cloud 30MB free tier → upgrade to 100MB paid
  → Handles more concurrent users without L1 cache pressure
```

The zero-cost architecture is not a debt — it is a feature that makes the platform sustainable for independent operation.

---

## Cross-PRD References

| PRD | Relationship to PRD-25 |
|-----|----------------------|
| **PRD-00** | Architecture overview; §7 defines the zero-cost stack that PRD-25 §11 extends |
| **PRD-03** | Risk gating patterns → guardrails agentic pattern (§7 row 18) |
| **PRD-04** | Append-only trade history → memory agentic pattern (§7 row 8) |
| **PRD-06** | Plan generation + human-in-loop gate (§7 row 13) |
| **PRD-07** | BrokerAdapter interface → add-broker skill (§3.9) + plugin path (§8.2) |
| **PRD-12** | MCP orchestration → Tool Use pattern (§7 row 5) + .mcp.json (§5) |
| **PRD-15** | Pipeline DAG → daily-pipeline skill (§3.5) + prompt chaining pattern (§7 row 1) |
| **PRD-16** | QA validation → evaluation pattern (§7 row 19) |
| **PRD-17** | Strategy discovery → discover-strategy skill (§3.1) + exploration pattern (§7 row 21) |
| **PRD-20** | MCP Strategy Analysis → go-bridge MCP server in .mcp.json (§5) |
| **PRD-23** | Strategy interface + plugin architecture → add-strategy skill (§3.7) + §8 |
| **PRD-24** | Analytical marts + MCP tools → discover-strategy, review-strategy skills (§3.1, §3.2) |

---

## Design Decisions & Rationale

### DD-01: Skills as markdown, not shell scripts

**Decision**: Skills are `SKILL.md` markdown files read and interpreted by AI agents, not executable shell scripts.

**Rationale**: Shell scripts are static — they can't adapt to context, handle errors intelligently, or compose with other tools. A `SKILL.md` file gives the agent the *intent and steps*, letting the agent use all available tools (MCP, bash, file read) to execute them optimally. Agents can also invoke skills from skills (composition), which shell scripts can't do without explicit piping.

**Trade-off**: Requires an LLM agent to execute. Not runnable by `bash skill.sh`. For purely mechanical operations, a shell script is simpler — skills are for workflows that benefit from agent judgment.

### DD-02: One .mcp.json at project root

**Decision**: Single `.mcp.json` for the entire project, not per-package or per-environment.

**Rationale**: Agents scan a single well-known location. Multiple files create ambiguity about which is authoritative. Environment differences (dev vs prod) are handled by `${ENV_VAR}` resolution, not separate files.

### DD-03: CLAUDE.md per package, not per-file

**Decision**: One `CLAUDE.md` per Go package (directory), covering the whole package.

**Rationale**: Per-file docs duplicate interface descriptions (already in Go doc comments). Per-package docs cover the **conventions, pitfalls, and skill linkages** that aren't expressible in code. This is the gap that CLAUDE.md fills.

### DD-04: Skills versioned but not dependency-tracked

**Decision**: Skills have a version number in frontmatter but no formal dependency graph between skills.

**Rationale**: Skill composition is expressed as prose ("invoke the run-backtest skill") not as a structured DAG. This keeps skills readable and maintainable without a skill registry system. At this scale (10 skills), a registry would be over-engineering.

### DD-05: Zero-cost as architectural constraint, not goal

**Decision**: €0/month is a hard constraint at the architecture level, not a goal to optimize towards.

**Rationale**: A constraint produces clean decisions (SQLite, not Postgres). A goal produces compromises (maybe Postgres if we can get it cheap). The constraint forces the right architecture for an independent, self-sustaining trading platform.
