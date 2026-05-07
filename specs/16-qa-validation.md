# PRD-16: QA & Validation Framework

**Status**: Specification  
**Version**: 1.0  
**Source files**: `tools/qa-check.js` (28 checks), `tools/validate-scan.js` (7 rule groups)

---

## 1. Overview

Two complementary validation tools gate the scanner pipeline at different stages:

- **Stage 1 — Pre-Publish** (`validate-scan.js`): Structural rules on `signals.json` before the scan is ever published. Hard gate: exit 1 on any violation.
- **Stage 2 — Post-Pipeline** (`qa-check.js`): Cross-file consistency checks after the full pipeline completes. Soft gate by default: exit 0 always; exit 1 only with `--strict`.
- **Stage 3 — Continuous Monitoring**: Freshness and staleness checks, run independently on a schedule.

---

## 2. Stage 1: Pre-Publish Validation (`validate-scan.js`)

### 2.1 Invocation

```bash
node tools/validate-scan.js scanner/YYYYMMDD/
node tools/validate-scan.js scanner/YYYYMMDD/signals.json
node tools/validate-scan.js scanner/YYYYMMDD/index.html   # HTML fallback via parser
```

Called from `publish-daily-card.sh` **before** `add_card.js`. A non-zero exit blocks publication.

### 2.2 Configuration Source

All rule parameters are read from `data/scanner-filters.json` at runtime. No hard-coded thresholds in the script. The filters file schema:

```json
{
  "scan_size": {
    "exact": 10
  },
  "regime_labels": {
    "allowed": ["RISK-ON", "NEUTRAL", "EARLY RISK-OFF", "RISK-OFF", "RECOVERY"]
  },
  "strategies": {
    "allowed": ["Momentum", "Pullback", "Breakout", "Pre-Squeeze"],
    "forbidden": ["Trend Follow", "Defensive", "Swing"]
  },
  "anti_duplicate": {
    "behavior": "disqualify"
  },
  "stops": {
    "min_pct_from_entry": 1.0,
    "max_pct_from_entry": 15.0
  },
  "diversification": {
    "max_per_sector": 3,
    "sector_map": {
      "AAPL": "Technology", "MSFT": "Technology",
      "JPM": "Financials", "XLF": "Financials",
      "XLE": "Energy", "CVX": "Energy"
    }
  },
  "sharia": {
    "blocked_etf_examples": ["TLT", "LQD", "HYG", "TQQQ", "SQQQ", "SPXU", "SH"]
  }
}
```

### 2.3 Rule Catalog

Each rule emits a violation object `{ rule: string, message: string }`. Any violations → `process.exit(1)`.

| # | Rule ID | Description | Violation message template |
|---|---------|-------------|---------------------------|
| 1 | `scan_size` | Signal count must equal `filters.scan_size.exact` | `Expected exactly N signals, got M.` |
| 2 | `regime_labels` | Regime string (from `signals.json` header) must be in `filters.regime_labels.allowed` (case-insensitive, trimmed) | `Regime "X" not in allowed set: RISK-ON, ...` |
| 3 | `strategies.forbidden` | Strategy name must not appear in `filters.strategies.forbidden` | `{ticker}: strategy "{strat}" is forbidden (use Momentum/Pre-Squeeze/Breakout/Pullback).` |
| 3b | `strategies.allowed` | If `filters.strategies.allowed` is non-empty, strategy must be in that set | `{ticker}: strategy "{strat}" not in whitelist [...].` |
| 4 | `anti_duplicate` | Ticker must not already appear in `data/scanner-positions.json` `open_positions[]` (comparison is uppercase) | `{ticker}: already in open_positions — never enter a 2nd position on the same ticker.` |
| 5a | `stops.min_pct` | `abs((entry - stop) / entry) * 100` must be ≥ `filters.stops.min_pct_from_entry` | `{ticker}: stop only X.XX% from entry (min N%) — too tight, will trigger intraday.` |
| 5b | `stops.max_pct` | Same percentage must be ≤ `filters.stops.max_pct_from_entry` | `{ticker}: stop X.XX% from entry (max N%) — too loose, breaks R/R math.` |
| 6 | `diversification.max_per_sector` | Sector bucket count (from `filters.diversification.sector_map`) must not exceed `max_per_sector`. Unknown tickers fall into bucket `"Other"`, which is also capped. | `Sector "{sect}" has N setups (max M) — concentration risk.` |
| 7 | `sharia.blocked_etf` | A signal with `sharia=true` must not be in `filters.sharia.blocked_etf_examples` | `{ticker}: marked sharia=true but is in blocked_etf_examples (bond/leveraged/inverse ETF).` |

### 2.4 Security

Path traversal guard: the resolved absolute path of the input argument must start with `ROOT + path.sep`. Any path escaping the project root is rejected immediately.

### 2.5 Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All rules passed — safe to publish |
| 1 | One or more violations — do NOT publish |
| 2 | Usage error (no argument provided) |

---

## 3. Stage 2: Post-Pipeline QA (`qa-check.js`)

### 3.1 Invocation

```bash
node tools/qa-check.js               # exit 0 always; print summary
node tools/qa-check.js --strict      # exit 1 if any check() failed
node tools/qa-check.js --discord     # also write /tmp/qa-discord-report.txt
```

Called as the final step of `publish-daily-card.sh`. Results are also posted to Discord via the `--discord` flag.

### 3.2 Severity Model

Two function signatures; both print results but differ in output bucket:

```javascript
check(label, fn)   // failure → errors[] → ❌ — counted toward hasErrors
warn(label, fn)    // failure → warnings[] → ⚠️  — never triggers --strict exit
```

A function `fn` returns:
- `undefined` or `true` → check passes → appended to `ok[]` as `✅ {label}`
- a `string` → check fails → message appended to `errors[]` or `warnings[]`
- throws → treated as failure with `e.message`

### 3.3 Complete Check Catalog

#### Group A — scanner/status/index.html (checks 1, 2, 3, 7, 8, 14a, 14b)

| # | Severity | Label | Logic |
|---|----------|-------|-------|
| 1 | ERROR | `scanner/status: fichier existe et > 20KB` | `fileSize('scanner/status/index.html') >= 20000` |
| 2 | ERROR | `scanner/status: signaux présents (pill-score)` | Count of `/pill-score/g` matches ≥ 2 (1 CSS definition + ≥1 ticker occurrence) |
| 3 | ERROR | `scanner/status: pas de "No signals for this mode today"` | HTML must NOT contain the literal string `No signals for this mode today` |
| 7 | ERROR | `scanner/status: pas de "undefined" brut dans le HTML` | HTML must NOT match regex `/>undefined[<\s]\|[>\s]undefined</` |
| 8 | ERROR | `scanner/status: aucune cellule stratégie vide dans le tableau signaux` | Count of `/<td class="m"><\/td>/g` must be 0 |
| 14a | ERROR | `scanner/status: section Pending Orders présente pour les StrategySlots actifs (incl. tkl)` | Count of `/Order[s]? to Place\|On Watch\|no action needed/g` ≥ 3 |
| 14b | ERROR | `scanner/status: pas de ticker en doublon entre Pending Orders et Open Positions` | HTML must NOT contain `>undefined<` or `">undefined"` (simplified proxy check) |

#### Group B — radar.json (checks 2a, 2b, 2c, 10)

| # | Severity | Label | Logic |
|---|----------|-------|-------|
| 2a | ERROR | `radar.json: tous les items ont label+detail+importance` | All items in `risks + opportunities + events` arrays must have non-null `label`, non-null `detail`, and numeric `importance`. Array must be non-empty. |
| 2b | ERROR | `radar.json: detail n'est pas une valeur impact ("high"/"medium")` | No item's `detail` field may equal `"high"`, `"medium"`, `"low"`, or `"critical"` (copy-paste from impact field) |
| 2c | WARN | `radar.json: fraîcheur < 48h` | `(Date.now() - new Date(d.updated)) / 3600000 <= 48` |
| 10 | ERROR | `radar.json: events et opportunities présents (pas que risks)` | `d.events.length > 0` AND `d.opportunities.length > 0` |

#### Group C — scanner.json (checks 3a, 11)

| # | Severity | Label | Logic |
|---|----------|-------|-------|
| 3a | ERROR | `scanner.json: tile LIVE en position 0` | `d[0]` must include `scanner/status` or `Scanner Live`, must include `LIVE`, must include `#059669` |
| 11 | ERROR | `scanner.json: tiles retro — amber + grade + date réelle + pas de doublons` | For all tiles containing `RÉTROSPECTIVE`: must contain `f59e0b`; must match `/data-grade="[A-F][+\-*]?"/`; must NOT contain today's date in `>DATE<` form; no duplicate `href` values across all tiles |

#### Group D — Scan du dernier jour ouvré (checks 4a, 4b, 4c, 25)

The "last weekday" is computed by decrementing from today until `getDay()` is not 0 (Sun) or 6 (Sat). On weekends, the check covers the previous Friday.

| # | Severity | Label | Logic |
|---|----------|-------|-------|
| 4a | ERROR | `scan dernier jour ouvré (YYYYMMDD)[note]: fichier > 30KB` | `fileSize('scanner/YYYYMMDD/index.html') >= 30000` |
| 4b | ERROR | `scan dernier jour ouvré: id="synthese" présent` | HTML of that scan contains `id="synthese"` |
| 4c | ERROR | `scan dernier jour ouvré: labels stratégie conformes` | Reads `signals.json` (preferred) or `data.json` `setups[].pattern` from the 2 most recent scanner directories. Each strategy must be in `{'Momentum', 'Pullback', 'Breakout', 'Pre-Squeeze'}`. Failures listed as `YYYYMMDD: "BadLabel"`. |
| 25 | ERROR | `signals.json (dernier scan): R:R ≥ 1.5 pour tous les signaux` | For each signal with numeric `entry`, `stop`, `tp1`: `reward = tp1 - entry`; `risk = entry - stop`; `risk > 0`; `reward / risk >= 1.5` |

#### Group E — data/*.json freshness and integrity (checks 5a, 5b, 5c, 5d, 23)

| # | Severity | Label | Logic |
|---|----------|-------|-------|
| 5a | ERROR | `bench-spy.json: fichier existe` | `data/bench-spy.json` must exist |
| 5b | WARN | `bench-spy.json: fraîcheur < 48h` | `d.updated_at` within 48h |
| 5c | ERROR | `bench-spy.json: stats numériques valides` | `d.stats` exists; `returnTotal`, `maxDD`, `sharpe`, `calmar` are all numeric and non-NaN; `d.closes` has ≥ 5 keys |
| 5d | WARN | `scanner-metrics.json: fraîcheur < 48h` | `d.updated_at` within 48h |
| 5e | WARN | `scanner-positions.json: fraîcheur < 48h` | `d.updated_at` within 48h |
| 5f | WARN | `risk-snapshots.json: var95 non-null (MCP gateway live)` | `d.modes` exists; NOT all mode values have `var95_5d == null`. A fully null result indicates `refresh-risk-metrics.js` wrote a stub (MCP_GATEWAY_URL not exported). |
| 23 | WARN | `media pipeline: result.json généré dans les 24h` | Finds newest `result.json` under `/tmp/mw-media/*/`; file must exist and be ≤ 24h old; `r.youtubeId` must be non-null; `r.audioPath` must exist on disk |

#### Group F — index.html structure (checks 6a, 6b, 12)

| # | Severity | Label | Logic |
|---|----------|-------|-------|
| 6a | ERROR | `index.html: tab-scanner existe` | `index.html` contains `id="tab-scanner"` |
| 6b | ERROR | `index.html: tab-radar existe` | `index.html` contains `id="tab-radar"` |
| 12 | ERROR | `index.html: Performance du Scanner — Updated date en phase avec dernière rétro` | Extract `Updated: {Mon DD YYYY}` from the scanner-perf block. Find newest YYYYMMDD dir under `scanner/retrospective/`. The extracted date must contain the same month abbreviation and year as the newest retro. Also: if `(N rétros cumulées)` text is found, N must equal `retroDates.length`. |

#### Group G — mcp/watchlist.json (check 9)

| # | Severity | Label | Logic |
|---|----------|-------|-------|
| 9 | ERROR | `watchlist.json: picks non vides et champs valides (score, strategy, entry)` | `d.picks` non-empty; no pick has `score === null` or `score === undefined`; no pick missing `strategy`; no pick missing `entry` (0 is valid) |

#### Group H — backtest-results.json (checks 26, 27)

| # | Severity | Label | Logic |
|---|----------|-------|-------|
| 26 | WARN | `backtest-results.json: advisor_* non-null (sweep complet requis)` | All keys matching `/^advisor_/` must be non-null. Null advisors = sweep was never run. |
| 27 | ERROR | `backtest-results.json: frozen_* ont tous les champs obligatoires` | All keys matching `/^frozen_/` must be non-null objects containing all of: `returnTotal`, `winRate`, `profitFactor`, `trades`, `maxDD`, `calmar`, `sharpe`. |

#### Group I — backtest-trades.json (check 24)

| # | Severity | Label | Logic |
|---|----------|-------|-------|
| 24 | WARN | `backtest-trades: VWAP in plausible range vs actualEntry (0.5–2×)` | For each mode, sample up to 5 trades (evenly spaced) where both `vwap` and `actualEntry` are non-null. Ratio `vwap / actualEntry` must be in `[0.5, 2.0]`. Failure indicates VWAP lookahead or data error. |

#### Group J — scanner/status/history (check 28)

| # | Severity | Label | Logic |
|---|----------|-------|-------|
| 28 | WARN | `scanner/status/history: snapshot le plus récent < 24h (ET)` | `scanner/status/history/` must exist and contain at least one `YYYYMMDD.json` file (excluding `dates.json`). Newest file parsed as `America/New_York` midnight. Gap from now (UTC) must be ≤ 24h. Uses EDT offset `UTC-4` (assumes Apr–Oct). |

### 3.4 Exit Codes

| Code | Condition |
|------|-----------|
| 0 | Always (default mode) |
| 1 | `--strict` flag AND `errors.length > 0` |

Note: `warnings.length > 0` never affects exit code. The `--strict` flag is passed by `publish-daily-card.sh` step 7.

### 3.5 Discord Report Format (`--discord`)

Written to `/tmp/qa-discord-report.txt`. Caller (`publish-daily-card.sh`) reads this file and posts it to the configured Discord webhook.

```
All-green case:
  ✅ **QA articles** — {N}/{T} checks OK

Issues present:
  **QA articles — DD/MM/YYYY**
  {ok} OK | {warn} warnings | {err} erreurs

  **Erreurs critiques:**
  • {label}: {message}

  **Avertissements:**
  • {label}: {message}
```

---

## 4. Stage 3: Continuous Monitoring

These checks run on a separate schedule (not tied to the scanner pipeline) and feed into the health check system described in PRD-15.

| Check | Trigger | Severity | Condition |
|-------|---------|----------|-----------|
| Dashboard freshness | Every 6h | WARN | `scanner/status/index.html` mtime ≤ 24h |
| API freshness | Every 6h | WARN | `portfolio/v1/{strategySlotId}/equity.json` mtime ≤ 24h for all active StrategySlots |
| Position tracking | Every 30min (market hours) | WARN | `scanner-positions.json` `updated_at` ≤ 2h during market hours |
| Risk metrics | Every 6h | ERROR | `risk-snapshots.json` not a stub if `MCP_GATEWAY_URL` is set; file mtime ≤ 24h on weekdays |
| Scanner staleness | Every 6h (weekdays) | ERROR | A scanner directory `scanner/YYYYMMDD/` for current or previous weekday must exist |
| Go bridge health | Every 60s | ERROR | Trading-executor process alive and last heartbeat < 60s (checked via `data/bridge-heartbeat.json`) |
| Unified position file | Every 6h | WARN | `scanner-positions.json` contains no orphaned `strategySlotId` values (all IDs must exist in active StrategySlots) |
| Analytics endpoint freshness | Every 6h | WARN | `/api/v1/analytics/summary` last computed timestamp ≤ 24h (read from `data/analytics-cache.json`) |

---

## 5. Validation Result Schema

For programmatic consumption by PRD-15 (pipeline orchestrator):

```json
{
  "stage": "pre_publish" | "post_pipeline" | "monitoring",
  "tool": "validate-scan" | "qa-check",
  "ran_at": "2026-05-07T23:04:33Z",
  "exit_code": 0 | 1 | 2,
  "summary": {
    "ok": 22,
    "warnings": 1,
    "errors": 0,
    "total": 23
  },
  "results": [
    {
      "severity": "ok" | "warning" | "error",
      "label": "signals.json (dernier scan): R:R ≥ 1.5 pour tous les signaux",
      "message": null
    },
    {
      "severity": "warning",
      "label": "risk-snapshots.json: var95 non-null (MCP gateway live)",
      "message": "tous modes var95_5d=null — refresh-risk-metrics a écrit un stub"
    }
  ]
}
```

This JSON is written to `/tmp/qa-result.json` when `--json` flag is passed (new flag to add to both tools).

---

## 6. Pipeline Integration (PRD-15 contract)

The `qa_check` step in the pipeline DAG:

1. Runs `node tools/qa-check.js --strict --discord --json`.
2. Reads exit code:
   - `0` → step status = `completed`
   - `1` → step status = `failed` (non-blocking; pipeline continues but Discord alert fires)
3. Reads `/tmp/qa-result.json` and stores in `pipeline_runs.metadata.qa_result`.
4. If `errors.length > 0`, the pipeline run's final status is `completed_with_warnings` (not `failed`; the pipeline ran to completion but QA found issues).
5. The QA Discord report (`/tmp/qa-discord-report.txt`) is posted by `publish-daily-card.sh` independently.

The `validate-scan` step runs as part of `signal_generate` (blocking):

1. Runs `node tools/validate-scan.js scanner/{scanDate}/`.
2. Exit code `1` → `signal_generate` step status = `failed` → pipeline halted (blocking step).
3. User is alerted with the violations list extracted from stdout.

---

## 7. Regression Test Catalog

Historical pipeline failures and the check that now catches them:

| Date | Failure | Check ID | Root cause |
|------|---------|----------|------------|
| 2026-03-28 | LNG ticker had empty strategy cell in status page | Check 8 | `gen-status-page.js` regex for strategy field was incomplete |
| 2026-03-28 | watchlist.json picks had `score=null` | Check 9 | `gen-mode-cards.js` wrote watchlist before sweep completed |
| 2026-03-28 | radar.json had only risks, no opportunities | Check 10 | Claude generation skipped opportunities section |
| Various | MCP Gateway not exported → risk stub accepted silently | Check 5f | `MCP_GATEWAY_URL` not set in cron environment |
| Various | Strategy label "Trend Follow" used outside taxonomy | Check 4c | LLM generated non-canonical strategy name |
| Various | retro tile shown with today's date (fallback) | Check 11 | `add_card.js` used `new Date()` instead of retro's actual date |
| Various | R/R below 1.5 in published signals | Check 25 | Scanner scoring bug; no gate existed before |
| Various | `frozen_calmar` and `frozen_sharpe` null after partial sweep | Check 27 | Sweep interrupted before computing Calmar/Sharpe |
| Various | VWAP ratio outside 0.5–2× range | Check 24 | Price cache date mismatch (lookahead) |
| Various | "No signals for this mode today" in live status page | Check 3 | Scanner parser regex failed on non-standard signal format |

---

## 8. Adding a New Check

To add a check to `qa-check.js`:

1. Determine severity: use `check()` for data integrity failures that indicate broken pipeline output; use `warn()` for staleness or optional data.
2. Add the check in the appropriate group section (by file category).
3. Label convention: `"{file/component}: {what is being verified} ({expected condition})"`.
4. Return `undefined` for pass, a descriptive string for failure. Never `throw` deliberately — let unexpected errors propagate as warnings.
5. Add a row to the regression catalog above with the date and root cause.
6. If the check involves a new file, add a corresponding Stage 3 monitoring entry.

To add a rule to `validate-scan.js`:

1. Add the rule parameters to `data/scanner-filters.json` under the appropriate key.
2. Implement the check in `main()`, push to `violations` on failure.
3. Use the rule ID format `"{category}.{specific}"` (e.g. `"diversification.min_geo_us"`).
4. Update the Rule Catalog table in §2.3.
