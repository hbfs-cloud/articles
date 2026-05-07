# PRD-24: Analytical Data Layer

**Status**: Draft  
**Owner**: Platform  
**Depends on**: PRD-04 (Portfolio Simulation), PRD-17 (Strategy Discovery), PRD-20 (MCP Strategy Analysis), PRD-23 (Unified Strategy Engine)

---

## 1. Overview

The Analytical Data Layer is the query backbone for strategy discovery, refinement, and hypothesis testing. It transforms raw trading artifacts — backtest trades, scanner signals, position snapshots, equity curves, risk metrics — into a structured OLAP-style store queryable through MCP tools.

Inspired by Cube.dev's semantic layer and dbt's transformation pipeline, but implemented entirely in Go + SQLite with no external dependencies. No Cube.dev server. No dbt CLI. One binary, one database file.

**What it enables that doesn't exist today:**
- "Which strategy label performs best in RECOVERY regime?" — answered in < 1s
- "What score bucket has the highest signal→trade conversion rate?" — pre-aggregated
- "Find parameter combinations with predicted Sharpe > 2.0 we haven't tested yet" — mart_discovery_candidates
- Cross-slot comparison with regime breakdown in a single tool call

**Trigger**: Refreshed automatically as Phase 9.5 in the daily pipeline (after `gen-api.js`, before idle).

---

## 2. Architecture

```
Raw Artifacts (JSON files)
        │
        ▼
┌─────────────────┐
│  Staging Layer  │  stg_* tables — verbatim JSON → rows
│  (stg_)         │  SQLite json_each() ingestion
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Intermediate    │  int_* tables — enrichment, joins,
│ Layer (int_)    │  window functions, regime tagging
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Mart Layer     │  mart_* views — pre-aggregated,
│  (mart_)        │  query-ready analytical surfaces
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Query Engine   │  Go HTTP handler: semantic query
│  (Go)           │  → SQL → JSON response
└────────┬────────┘
         │
         ▼
   MCP Tools (§6)
```

**Storage**: `data/analytical.db` — SQLite WAL mode, same Oracle Cloud VM as the main server.  
**Refresh**: `RefreshAll()` called by the daily pipeline. Full re-materialize of staging + intermediate. Marts are views (no materialization cost at refresh time, computed at query time).  
**Incremental refresh**: Staging tables support incremental load via `last_refresh_ts` in `analytical_meta`. Only rows with `scan_date > last_refresh_ts` are re-ingested.  
**Memory**: SQLite in-process; no separate process needed.

---

## 3. Semantic Layer (Cube Definitions)

Cubes define the logical model. The Go query engine translates cube queries into SQL against the intermediate tables.

### 3.1 Cube: `signals`

Logical source: `int_signals_enriched`

| Field | Type | Description |
|-------|------|-------------|
| **Dimensions** | | |
| `ticker` | string | Symbol (e.g., "NVDA") |
| `sector` | string | GICS sector from sector_map |
| `strategy_type` | enum | `scanner` \| `mechanical` \| `ml` |
| `strategy_label` | enum | `Momentum` \| `Breakout` \| `Pullback` \| `Pre-Squeeze` \| `other` |
| `regime` | enum | `RISK_ON` \| `NEUTRAL` \| `EARLY_RISK_OFF` \| `RISK_OFF` \| `RECOVERY` |
| `score_bucket` | enum | `85-90` \| `90-95` \| `95-100` |
| `scan_date` | date | Date signal was emitted |
| `sharia_compliant` | bool | Sharia compliance tag from scanner |
| `source` | enum | `scanner` \| `mechanical` |
| `strategy_slot_id` | string | Slot that produced the signal |
| **Measures** | | |
| `count` | integer | Number of signals |
| `avg_score` | float | Average score across signals |
| `hit_rate` | float | Fraction reaching TP1 (joined to trades) |
| `conversion_rate` | float | Fraction of signals that became trades |
| `avg_entry_to_trade_days` | float | Lag between signal and entry |

**Joins**: `signals.ticker + scan_date` → `trades.ticker + entry_date` (LEFT JOIN — signals without trades count toward conversion_rate denominator)

### 3.2 Cube: `trades`

Logical source: `int_trades_enriched`

| Field | Type | Description |
|-------|------|-------------|
| **Dimensions** | | |
| `strategy_slot_id` | string | Slot that generated this trade |
| `strategy_type` | enum | `scanner` \| `mechanical` \| `ml` |
| `strategy_label` | string | Label from signal (Momentum, Breakout, etc.) |
| `ticker` | string | Symbol |
| `sector` | string | GICS sector |
| `entry_date` | date | Trade entry date (time dimension) |
| `exit_date` | date | Trade exit date |
| `holding_days_bucket` | enum | `1d` \| `2-3d` \| `4-7d` \| `8+d` |
| `exit_reason` | enum | `sl` \| `tp1` \| `tp2` \| `expired` \| `rotated` \| `breakeven` |
| `regime_at_entry` | enum | Market regime on entry date |
| `regime_at_exit` | enum | Market regime on exit date |
| `score_bucket` | enum | `85-90` \| `90-95` \| `95-100` |
| **Measures** | | |
| `count` | integer | Trade count |
| `hit_rate` | float | `TP1_count / (TP1_count + SL_count)` (resolved only) |
| `profit_factor` | float | `sum(wins) / abs(sum(losses))` |
| `avg_return_pct` | float | Mean PnL% across all trades |
| `total_return_pct` | float | Cumulative PnL% |
| `max_win` | float | Best single trade return |
| `max_loss` | float | Worst single trade return |
| `avg_holding_days` | float | Mean hold duration |
| `sharpe_ratio` | float | Annualized Sharpe from daily returns |
| `sortino_ratio` | float | Sortino (downside deviation only) |
| `calmar_ratio` | float | Return / Max Drawdown |
| `expectancy_pct` | float | `(WR × avg_win) + ((1-WR) × avg_loss)` |

**Time dimension**: `entry_date` — supports `granularity: day | week | month`.

### 3.3 Cube: `positions`

Logical source: `int_positions_enriched`

| Field | Type | Description |
|-------|------|-------------|
| **Dimensions** | | |
| `strategy_slot_id` | string | Owning slot |
| `ticker` | string | Symbol |
| `sector` | string | GICS sector |
| `days_held_bucket` | enum | `0-1d` \| `2-3d` \| `4-7d` \| `8+d` |
| `pnl_bucket` | enum | `<-5%` \| `-5% to -2%` \| `-2% to 0%` \| `0% to +2%` \| `+2% to +5%` \| `>+5%` |
| `status` | enum | `open` \| `pending_exit` |
| **Measures** | | |
| `count` | integer | Position count |
| `total_exposure_usd` | float | Sum of position sizes in USD |
| `avg_unrealized_pnl` | float | Mean unrealized PnL% |
| `worst_position_pnl` | float | Most negative unrealized PnL% |
| `avg_days_held` | float | Mean days in position |

### 3.4 Cube: `equity_curves`

Logical source: `int_equity_curves`

| Field | Type | Description |
|-------|------|-------------|
| **Dimensions** | | |
| `strategy_slot_id` | string | Slot |
| `date` | date | Equity curve date (time dimension) |
| **Measures** | | |
| `cumulative_return` | float | Equity index value (100 = start) |
| `daily_return` | float | Day-over-day return% |
| `drawdown` | float | Current drawdown from high water mark |
| `rolling_sharpe_30d` | float | 30-day rolling Sharpe |
| `rolling_volatility_30d` | float | 30-day rolling annualized vol |
| `high_water_mark` | float | Running maximum equity value |

### 3.5 Cube: `market_regimes`

Logical source: `int_regime_periods`

| Field | Type | Description |
|-------|------|-------------|
| **Dimensions** | | |
| `date` | date | Date |
| `regime_state` | enum | `RISK_ON` \| `NEUTRAL` \| `EARLY_RISK_OFF` \| `RISK_OFF` \| `RECOVERY` |
| `vix_bucket` | enum | `<15` \| `15-20` \| `20-28` \| `>28` |
| **Measures** | | |
| `vix_level` | float | VIX closing value |
| `regime_confidence` | float | Ensemble model confidence (0–1) |
| `spy_return` | float | SPY daily return% |
| `duration_days` | integer | Contiguous days in this regime state |

### 3.6 Cube: `risk_snapshots`

Logical source: `stg_risk_snapshots` (direct — no enrichment needed)

| Field | Type | Description |
|-------|------|-------------|
| **Dimensions** | | |
| `strategy_slot_id` | string | Slot |
| `date` | date | Snapshot date |
| **Measures** | | |
| `var_95` | float | 95% 1-day VaR% |
| `var_99` | float | 99% 1-day VaR% |
| `expected_shortfall` | float | CVaR at 95% |
| `max_correlation` | float | Max pairwise correlation in portfolio |
| `stress_test_worst` | float | Worst scenario PnL% from stress tests |
| `portfolio_beta` | float | Beta to SPY |

---

## 4. Data Marts (Pre-Aggregated Views)

### 4.1 Layer 1 — Staging (stg_)

Verbatim ingestion from JSON files into SQLite rows.

```sql
-- Staging: signals
CREATE TABLE IF NOT EXISTS stg_signals (
    id              TEXT,
    ticker          TEXT NOT NULL,
    scan_date       TEXT NOT NULL,
    score           REAL,
    strategy_label  TEXT,
    strategy_type   TEXT DEFAULT 'scanner',
    strategy_slot_id TEXT,
    sharia_compliant INTEGER DEFAULT 0,
    source          TEXT DEFAULT 'scanner',
    raw_json        TEXT,  -- full original JSON row
    ingested_at     TEXT DEFAULT (datetime('now'))
);

-- Ingest from signals-history.json (array of daily signal sets)
-- Go: iterate json array, call json_each on each day's signals array
INSERT OR IGNORE INTO stg_signals (id, ticker, scan_date, score, strategy_label,
    strategy_slot_id, sharia_compliant, source)
SELECT
    hex(randomblob(8))          AS id,
    json_extract(value, '$.ticker')         AS ticker,
    json_extract(value, '$.scan_date')      AS scan_date,
    json_extract(value, '$.score')          AS score,
    json_extract(value, '$.strategy_label') AS strategy_label,
    json_extract(value, '$.strategy_slot_id') AS strategy_slot_id,
    json_extract(value, '$.sharia_compliant') AS sharia_compliant,
    COALESCE(json_extract(value, '$.source'), 'scanner') AS source
FROM json_each(readfile('data/signals-history.json')), json_each(value, '$.signals');

-- Staging: trades
CREATE TABLE IF NOT EXISTS stg_trades (
    id              TEXT,
    ticker          TEXT NOT NULL,
    entry_date      TEXT NOT NULL,
    exit_date       TEXT,
    entry_price     REAL,
    exit_price      REAL,
    pnl_pct         REAL,
    status          TEXT,  -- sl, tp1, tp2, expired, rotated, breakeven, open
    score           REAL,
    strategy_label  TEXT,
    strategy_slot_id TEXT,
    mode            TEXT,  -- legacy: balanced, turbo, etc.
    hold_days       INTEGER,
    regime          TEXT,
    raw_json        TEXT,
    ingested_at     TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO stg_trades (id, ticker, entry_date, exit_date, entry_price,
    exit_price, pnl_pct, status, score, strategy_label, strategy_slot_id, mode, hold_days, regime)
SELECT
    COALESCE(json_extract(value,'$.id'), hex(randomblob(8))),
    json_extract(value,'$.ticker'),
    json_extract(value,'$.entryDate'),
    json_extract(value,'$.exitDate'),
    json_extract(value,'$.entryPrice'),
    json_extract(value,'$.exitPrice'),
    json_extract(value,'$.pnlPct'),
    json_extract(value,'$.status'),
    json_extract(value,'$.score'),
    json_extract(value,'$.strategyLabel'),
    json_extract(value,'$.strategySlotId'),
    json_extract(value,'$.mode'),
    json_extract(value,'$.holdDays'),
    json_extract(value,'$.regime')
FROM json_each(readfile('data/backtest-trades.json'));

-- Staging: positions
CREATE TABLE IF NOT EXISTS stg_positions (
    id              TEXT,
    ticker          TEXT NOT NULL,
    strategy_slot_id TEXT,
    entry_date      TEXT,
    entry_price     REAL,
    current_price   REAL,
    unrealized_pnl_pct REAL,
    status          TEXT,
    days_held       INTEGER,
    raw_json        TEXT,
    ingested_at     TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO stg_positions (id, ticker, strategy_slot_id, entry_date,
    entry_price, current_price, unrealized_pnl_pct, status, days_held)
SELECT
    COALESCE(json_extract(value,'$.id'), hex(randomblob(8))),
    json_extract(value,'$.ticker'),
    json_extract(value,'$.strategySlotId'),
    json_extract(value,'$.entryDate'),
    json_extract(value,'$.entryPrice'),
    json_extract(value,'$.currentPrice'),
    json_extract(value,'$.unrealizedPnlPct'),
    json_extract(value,'$.status'),
    json_extract(value,'$.daysHeld')
FROM json_each(readfile('data/unified-positions.json'));

-- Staging: equity curves (from portfolio-history.json — array per slot)
CREATE TABLE IF NOT EXISTS stg_equity_curves (
    strategy_slot_id TEXT NOT NULL,
    date             TEXT NOT NULL,
    equity_value     REAL,
    daily_return     REAL,
    PRIMARY KEY (strategy_slot_id, date)
);

-- Staging: risk snapshots (from data/risk-snapshots.json)
CREATE TABLE IF NOT EXISTS stg_risk_snapshots (
    strategy_slot_id TEXT NOT NULL,
    date             TEXT NOT NULL,
    var_95           REAL,
    var_99           REAL,
    expected_shortfall REAL,
    max_correlation  REAL,
    stress_test_worst REAL,
    portfolio_beta   REAL,
    PRIMARY KEY (strategy_slot_id, date)
);

-- Staging: market regimes (from data/regime-history.json if available, else derived from risk-snapshots)
CREATE TABLE IF NOT EXISTS stg_market_regimes (
    date             TEXT PRIMARY KEY,
    regime_state     TEXT,
    vix_level        REAL,
    regime_confidence REAL,
    spy_return       REAL
);
```

### 4.2 Layer 2 — Intermediate (int_)

```sql
-- int_sector_map: static sector classification
CREATE TABLE IF NOT EXISTS int_sector_map (
    ticker  TEXT PRIMARY KEY,
    sector  TEXT,
    industry TEXT
);
-- Pre-populated from instruments data at refresh time

-- int_signals_enriched: signals + sector + regime + dilution flags
CREATE VIEW int_signals_enriched AS
SELECT
    s.id,
    s.ticker,
    s.scan_date,
    s.score,
    s.strategy_label,
    COALESCE(s.strategy_type, 'scanner')          AS strategy_type,
    COALESCE(s.strategy_slot_id, s.mode, 'unknown') AS strategy_slot_id,
    s.sharia_compliant,
    s.source,
    COALESCE(sm.sector, 'Unknown')                 AS sector,
    mr.regime_state                                AS regime,
    CASE
        WHEN s.score >= 95 THEN '95-100'
        WHEN s.score >= 90 THEN '90-95'
        ELSE '85-90'
    END                                            AS score_bucket
FROM stg_signals s
LEFT JOIN int_sector_map sm ON sm.ticker = s.ticker
LEFT JOIN stg_market_regimes mr ON mr.date = s.scan_date;

-- int_trades_enriched: trades + sector + regime + holding bucket + exit reason normalization
CREATE VIEW int_trades_enriched AS
SELECT
    t.id,
    t.ticker,
    t.entry_date,
    t.exit_date,
    t.entry_price,
    t.exit_price,
    t.pnl_pct,
    t.status                                       AS exit_reason,
    t.score,
    t.strategy_label,
    COALESCE(t.strategy_slot_id, t.mode, 'unknown') AS strategy_slot_id,
    COALESCE(t.strategy_type, 'scanner')           AS strategy_type,
    COALESCE(sm.sector, 'Unknown')                 AS sector,
    mr_entry.regime_state                          AS regime_at_entry,
    mr_exit.regime_state                           AS regime_at_exit,
    COALESCE(t.hold_days,
        CAST(julianday(t.exit_date) - julianday(t.entry_date) AS INTEGER)
    )                                              AS holding_days,
    CASE
        WHEN COALESCE(t.hold_days, 0) <= 1 THEN '1d'
        WHEN COALESCE(t.hold_days, 0) <= 3 THEN '2-3d'
        WHEN COALESCE(t.hold_days, 0) <= 7 THEN '4-7d'
        ELSE '8+d'
    END                                            AS holding_days_bucket,
    CASE
        WHEN t.score >= 95 THEN '95-100'
        WHEN t.score >= 90 THEN '90-95'
        ELSE '85-90'
    END                                            AS score_bucket
FROM stg_trades t
LEFT JOIN int_sector_map sm ON sm.ticker = t.ticker
LEFT JOIN stg_market_regimes mr_entry ON mr_entry.date = t.entry_date
LEFT JOIN stg_market_regimes mr_exit  ON mr_exit.date  = t.exit_date;

-- int_positions_enriched
CREATE VIEW int_positions_enriched AS
SELECT
    p.id,
    p.ticker,
    COALESCE(p.strategy_slot_id, 'unknown') AS strategy_slot_id,
    p.entry_date,
    p.entry_price,
    p.current_price,
    p.unrealized_pnl_pct,
    p.status,
    COALESCE(p.days_held, 0)                AS days_held,
    COALESCE(sm.sector, 'Unknown')          AS sector,
    CASE
        WHEN COALESCE(p.days_held,0) <= 1 THEN '0-1d'
        WHEN COALESCE(p.days_held,0) <= 3 THEN '2-3d'
        WHEN COALESCE(p.days_held,0) <= 7 THEN '4-7d'
        ELSE '8+d'
    END                                     AS days_held_bucket,
    CASE
        WHEN p.unrealized_pnl_pct < -0.05  THEN '<-5%'
        WHEN p.unrealized_pnl_pct < -0.02  THEN '-5% to -2%'
        WHEN p.unrealized_pnl_pct < 0      THEN '-2% to 0%'
        WHEN p.unrealized_pnl_pct < 0.02   THEN '0% to +2%'
        WHEN p.unrealized_pnl_pct < 0.05   THEN '+2% to +5%'
        ELSE '>+5%'
    END                                     AS pnl_bucket
FROM stg_positions p
LEFT JOIN int_sector_map sm ON sm.ticker = p.ticker;

-- int_equity_curves: with rolling metrics via window functions
CREATE VIEW int_equity_curves AS
SELECT
    strategy_slot_id,
    date,
    equity_value,
    daily_return,
    MAX(equity_value) OVER (
        PARTITION BY strategy_slot_id
        ORDER BY date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    )                                              AS high_water_mark,
    equity_value / NULLIF(MAX(equity_value) OVER (
        PARTITION BY strategy_slot_id
        ORDER BY date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ), 0) - 1.0                                    AS drawdown,
    AVG(daily_return) OVER (
        PARTITION BY strategy_slot_id
        ORDER BY date
        ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
    ) / NULLIF(
        AVG(daily_return * daily_return) OVER (
            PARTITION BY strategy_slot_id
            ORDER BY date
            ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
        ) - AVG(daily_return) OVER (
            PARTITION BY strategy_slot_id
            ORDER BY date
            ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
        ) * AVG(daily_return) OVER (
            PARTITION BY strategy_slot_id
            ORDER BY date
            ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
        ), 0
    ) * SQRT(252)                                  AS rolling_sharpe_30d,
    SQRT(AVG(daily_return * daily_return) OVER (
        PARTITION BY strategy_slot_id
        ORDER BY date
        ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
    )) * SQRT(252)                                 AS rolling_volatility_30d
FROM stg_equity_curves;

-- int_regime_periods: contiguous regime blocks with duration
CREATE VIEW int_regime_periods AS
WITH labelled AS (
    SELECT date, regime_state, vix_level, regime_confidence, spy_return,
           ROW_NUMBER() OVER (ORDER BY date) -
           ROW_NUMBER() OVER (PARTITION BY regime_state ORDER BY date) AS grp
    FROM stg_market_regimes
),
grouped AS (
    SELECT regime_state,
           MIN(date)   AS period_start,
           MAX(date)   AS period_end,
           COUNT(*)    AS duration_days,
           AVG(vix_level)          AS avg_vix,
           AVG(regime_confidence)  AS avg_confidence,
           AVG(spy_return)         AS avg_spy_return
    FROM labelled
    GROUP BY regime_state, grp
)
SELECT
    g.*,
    mr.vix_level,
    mr.regime_confidence,
    mr.spy_return,
    CASE
        WHEN mr.vix_level < 15  THEN '<15'
        WHEN mr.vix_level < 20  THEN '15-20'
        WHEN mr.vix_level < 28  THEN '20-28'
        ELSE '>28'
    END AS vix_bucket,
    mr.date
FROM stg_market_regimes mr
JOIN grouped g ON mr.date BETWEEN g.period_start AND g.period_end
    AND mr.regime_state = g.regime_state;
```

### 4.3 Layer 3 — Marts (mart_)

```sql
-- mart_strategy_performance: per slot × time_period — all metrics
CREATE VIEW mart_strategy_performance AS
WITH daily AS (
    SELECT
        strategy_slot_id,
        strategy_type,
        entry_date                          AS period,
        'daily'                             AS granularity,
        COUNT(*)                            AS trade_count,
        SUM(CASE WHEN exit_reason IN ('tp1','tp2') THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN exit_reason = 'sl' THEN 1 ELSE 0 END)           AS losses,
        SUM(CASE WHEN exit_reason IN ('tp1','tp2','sl') THEN 1 ELSE 0 END) AS resolved,
        SUM(pnl_pct)                        AS total_return_pct,
        AVG(pnl_pct)                        AS avg_return_pct,
        AVG(holding_days)                   AS avg_hold_days,
        MAX(pnl_pct)                        AS max_win,
        MIN(pnl_pct)                        AS max_loss,
        SUM(CASE WHEN pnl_pct > 0 THEN pnl_pct ELSE 0 END)  AS gross_profit,
        SUM(CASE WHEN pnl_pct < 0 THEN ABS(pnl_pct) ELSE 0 END) AS gross_loss
    FROM int_trades_enriched
    GROUP BY strategy_slot_id, strategy_type, entry_date
)
SELECT
    strategy_slot_id,
    strategy_type,
    period,
    granularity,
    trade_count,
    wins,
    losses,
    resolved,
    CASE WHEN resolved > 0 THEN CAST(wins AS REAL)/resolved ELSE NULL END AS hit_rate,
    CASE WHEN gross_loss > 0 THEN gross_profit/gross_loss ELSE NULL END   AS profit_factor,
    total_return_pct,
    avg_return_pct,
    avg_hold_days,
    max_win,
    max_loss
FROM daily;

-- mart_regime_analysis: what works in each regime
CREATE VIEW mart_regime_analysis AS
SELECT
    t.regime_at_entry                   AS regime,
    t.strategy_slot_id,
    t.strategy_type,
    t.strategy_label,
    COUNT(*)                            AS trade_count,
    SUM(CASE WHEN t.exit_reason IN ('tp1','tp2') THEN 1 ELSE 0 END)  AS wins,
    SUM(CASE WHEN t.exit_reason = 'sl' THEN 1 ELSE 0 END)            AS losses,
    CAST(SUM(CASE WHEN t.exit_reason IN ('tp1','tp2') THEN 1 ELSE 0 END) AS REAL)
        / NULLIF(SUM(CASE WHEN t.exit_reason IN ('tp1','tp2','sl') THEN 1 ELSE 0 END), 0)
                                        AS hit_rate,
    SUM(CASE WHEN t.pnl_pct > 0 THEN t.pnl_pct ELSE 0 END)
        / NULLIF(SUM(CASE WHEN t.pnl_pct < 0 THEN ABS(t.pnl_pct) ELSE 0 END), 0)
                                        AS profit_factor,
    AVG(t.pnl_pct)                      AS avg_return_pct,
    SUM(t.pnl_pct)                      AS total_return_pct,
    AVG(t.holding_days)                 AS avg_hold_days,
    -- regime_alpha: performance vs SPY average in this regime
    AVG(t.pnl_pct) - AVG(mr.spy_return * t.holding_days)
                                        AS regime_alpha
FROM int_trades_enriched t
LEFT JOIN stg_market_regimes mr ON mr.date = t.entry_date
GROUP BY t.regime_at_entry, t.strategy_slot_id, t.strategy_type, t.strategy_label;

-- mart_signal_quality: conversion + hit rate by score bucket × label × sector
CREATE VIEW mart_signal_quality AS
SELECT
    s.score_bucket,
    s.strategy_label,
    s.sector,
    s.strategy_type,
    COUNT(*)                            AS signal_count,
    AVG(s.avg_score)                    AS avg_score,
    -- signals that became trades
    SUM(CASE WHEN t.id IS NOT NULL THEN 1 ELSE 0 END) AS converted_count,
    CAST(SUM(CASE WHEN t.id IS NOT NULL THEN 1 ELSE 0 END) AS REAL)
        / NULLIF(COUNT(*), 0)           AS conversion_rate,
    -- of converted, how many hit TP1
    SUM(CASE WHEN t.exit_reason IN ('tp1','tp2') THEN 1 ELSE 0 END) AS tp1_count,
    CAST(SUM(CASE WHEN t.exit_reason IN ('tp1','tp2') THEN 1 ELSE 0 END) AS REAL)
        / NULLIF(SUM(CASE WHEN t.exit_reason IN ('tp1','tp2','sl') THEN 1 ELSE 0 END), 0)
                                        AS hit_rate,
    AVG(t.pnl_pct)                      AS avg_return_pct
FROM int_signals_enriched s
LEFT JOIN int_trades_enriched t
    ON t.ticker = s.ticker
    AND ABS(julianday(t.entry_date) - julianday(s.scan_date)) <= 2
GROUP BY s.score_bucket, s.strategy_label, s.sector, s.strategy_type;

-- mart_sector_rotation: per sector × month
CREATE VIEW mart_sector_rotation AS
SELECT
    t.sector,
    strftime('%Y-%m', t.entry_date)     AS month,
    COUNT(*)                            AS signal_count,
    SUM(CASE WHEN t.exit_reason IN ('tp1','tp2') THEN 1 ELSE 0 END)  AS wins,
    CAST(SUM(CASE WHEN t.exit_reason IN ('tp1','tp2') THEN 1 ELSE 0 END) AS REAL)
        / NULLIF(SUM(CASE WHEN t.exit_reason IN ('tp1','tp2','sl') THEN 1 ELSE 0 END), 0)
                                        AS hit_rate,
    AVG(t.pnl_pct)                      AS avg_return_pct,
    SUM(t.pnl_pct)                      AS total_return_pct,
    COUNT(DISTINCT t.ticker)            AS unique_tickers
FROM int_trades_enriched t
GROUP BY t.sector, strftime('%Y-%m', t.entry_date);

-- mart_risk_attribution: per slot — VaR contribution, correlation, drawdown
CREATE VIEW mart_risk_attribution AS
SELECT
    rs.strategy_slot_id,
    rs.date,
    rs.var_95,
    rs.var_99,
    rs.expected_shortfall,
    rs.max_correlation,
    rs.stress_test_worst,
    rs.portfolio_beta,
    ec.drawdown,
    ec.rolling_volatility_30d,
    ec.rolling_sharpe_30d
FROM stg_risk_snapshots rs
LEFT JOIN int_equity_curves ec
    ON ec.strategy_slot_id = rs.strategy_slot_id
    AND ec.date = rs.date;

-- mart_holding_period_analysis: optimal hold per strategy type
CREATE VIEW mart_holding_period_analysis AS
SELECT
    strategy_slot_id,
    strategy_type,
    strategy_label,
    holding_days_bucket,
    COUNT(*)                            AS trade_count,
    CAST(SUM(CASE WHEN exit_reason IN ('tp1','tp2') THEN 1 ELSE 0 END) AS REAL)
        / NULLIF(SUM(CASE WHEN exit_reason IN ('tp1','tp2','sl') THEN 1 ELSE 0 END), 0)
                                        AS hit_rate,
    AVG(pnl_pct)                        AS avg_return_pct,
    SUM(CASE WHEN pnl_pct > 0 THEN pnl_pct ELSE 0 END)
        / NULLIF(SUM(CASE WHEN pnl_pct < 0 THEN ABS(pnl_pct) ELSE 0 END), 0)
                                        AS profit_factor
FROM int_trades_enriched
GROUP BY strategy_slot_id, strategy_type, strategy_label, holding_days_bucket;

-- mart_discovery_candidates: unexplored parameter combinations scored by expected Sharpe
-- Populated by the Go transformation engine (not a simple view — requires computation)
CREATE TABLE IF NOT EXISTS mart_discovery_candidates (
    id                   TEXT PRIMARY KEY,
    strategy_type        TEXT,
    horizon              INTEGER,
    max_positions        INTEGER,
    score_threshold      REAL,
    stop_loss_pct        REAL,
    tp1_pct              REAL,
    tp2_pct              REAL,
    rotation_mode        TEXT,
    tested               INTEGER DEFAULT 0,
    estimated_sharpe     REAL,      -- interpolated from neighbors in grid
    estimated_hit_rate   REAL,
    neighbor_count       INTEGER,   -- how many tested neighbors informed estimate
    neighbor_avg_sharpe  REAL,
    confidence           REAL,      -- 0–1: how reliable the estimate is
    created_at           TEXT,
    updated_at           TEXT
);
```

---

## 5. Transformation Engine

The Go transformation engine (`internal/analytics/`) orchestrates staging → intermediate → mart materialization.

### 5.1 Package Structure

```
internal/analytics/
├── db.go              -- SQLite connection, WAL mode setup, migrations
├── staging.go         -- ReadJSON* functions → stg_* tables
├── intermediate.go    -- Enrichment views (CREATE VIEW IF NOT EXISTS)
├── marts.go           -- Mart views + mart_discovery_candidates population
├── refresh.go         -- RefreshAll(), RefreshIncremental(), RefreshMart()
├── metadata.go        -- analytical_meta table: freshness timestamps
└── query.go           -- SemanticQuery → SQL translation → response
```

### 5.2 Refresh Pipeline (pseudocode)

```go
// RefreshAll: full re-materialize. Called by daily pipeline Phase 9.5.
func RefreshAll(db *sql.DB, dataDir string) error {
    tx, _ := db.Begin()

    // Phase 1: Staging — drop + re-insert (idempotent)
    truncateStagingTables(tx)
    if err := loadSignals(tx, filepath.Join(dataDir, "signals-history.json")); err != nil {
        return fmt.Errorf("signals: %w", err)
    }
    if err := loadTrades(tx, filepath.Join(dataDir, "backtest-trades.json")); err != nil {
        return fmt.Errorf("trades: %w", err)
    }
    if err := loadPositions(tx, filepath.Join(dataDir, "unified-positions.json")); err != nil {
        return fmt.Errorf("positions: %w", err)
    }
    if err := loadEquityCurves(tx, filepath.Join(dataDir, "portfolio-history.json")); err != nil {
        return fmt.Errorf("equity: %w", err)
    }
    if err := loadRiskSnapshots(tx, filepath.Join(dataDir, "risk-snapshots.json")); err != nil {
        return fmt.Errorf("risk: %w", err)
    }
    if err := loadRegimes(tx, filepath.Join(dataDir, "regime-history.json")); err != nil {
        log.Warn("regime history not found, deriving from risk-snapshots")
        deriveRegimesFromRiskSnapshots(tx)
    }
    if err := loadSectorMap(tx, filepath.Join(dataDir, "instruments.json")); err != nil {
        log.Warn("sector map load error (non-fatal): %v", err)
    }

    // Phase 2: Intermediate — CREATE VIEW IF NOT EXISTS (idempotent)
    applyIntermediateViews(tx)

    // Phase 3: Marts — CREATE VIEW IF NOT EXISTS + populate discovery candidates
    applyMartViews(tx)
    if err := populateDiscoveryCandidates(tx); err != nil {
        log.Warn("discovery candidates: %v (non-fatal)", err)
    }

    tx.Commit()

    // Phase 4: Update metadata
    updateMeta(db, "last_refresh", time.Now().UTC().Format(time.RFC3339))
    updateMeta(db, "trade_count", countRows(db, "stg_trades"))
    updateMeta(db, "signal_count", countRows(db, "stg_signals"))

    log.Info("Analytics refresh complete: %d trades, %d signals",
        countRows(db, "stg_trades"), countRows(db, "stg_signals"))
    return nil
}

// RefreshIncremental: only load rows newer than last_refresh_ts.
// Used for mid-day updates if triggered by scanner push.
func RefreshIncremental(db *sql.DB, dataDir string, since time.Time) error {
    // Load only stg_signals and stg_positions (trades don't change intraday)
    loadSignalsSince(db, filepath.Join(dataDir, "signals-history.json"), since)
    loadPositionsSince(db, filepath.Join(dataDir, "unified-positions.json"), since)
    updateMeta(db, "last_incremental_refresh", time.Now().UTC().Format(time.RFC3339))
}

// populateDiscoveryCandidates: generate untested grid combos, score by neighbor interpolation
func populateDiscoveryCandidates(tx *sql.Tx) error {
    // 1. Read existing tested combos from stg_trades (distinct param sets)
    tested := loadTestedParamSets(tx)

    // 2. Generate full grid (same dimensions as sweep.js §9.1 in PRD-04)
    grid := generateParamGrid(GridConfig{
        Horizons:        []int{2, 3, 5, 8, 10, 15},
        MaxPositions:    []int{1, 2, 3, 4, 5, 8, 10},
        ScoreThresholds: []float64{85, 88, 90, 92, 95},
        StopLossPcts:    []float64{0.03, 0.05, 0.07, 0.10},
        TP1Pcts:         []float64{0.05, 0.08, 0.10},
        TP2Pcts:         []float64{0.10, 0.15, 0.20},
        RotationModes:   []string{"none", "daily_max1", "aggressive"},
    })

    // 3. For each untested combo, find k=5 nearest tested neighbors (Euclidean distance)
    //    Average their Sharpe as estimated_sharpe. Confidence = neighbor_count / k.
    candidates := []DiscoveryCandidate{}
    for _, combo := range grid {
        if tested[combo.Key()] { continue }
        neighbors := kNearestNeighbors(combo, tested, k=5)
        if len(neighbors) == 0 { continue }
        candidates = append(candidates, DiscoveryCandidate{
            ...combo,
            EstimatedSharpe:   mean(neighbors, fn(n) n.Sharpe),
            EstimatedHitRate:  mean(neighbors, fn(n) n.HitRate),
            NeighborCount:     len(neighbors),
            NeighborAvgSharpe: mean(neighbors, fn(n) n.Sharpe),
            Confidence:        float64(len(neighbors)) / 5.0,
        })
    }

    // 4. Insert top 200 by estimated_sharpe (keep table manageable)
    sort.Slice(candidates, fn(i,j) candidates[i].EstimatedSharpe > candidates[j].EstimatedSharpe)
    bulkInsertDiscoveryCandidates(tx, candidates[:min(200, len(candidates))])
    return nil
}
```

### 5.3 Incremental Refresh Strategy

| Data Source | Refresh Strategy | Rationale |
|-------------|-----------------|-----------|
| `stg_trades` | Full truncate + reload | Trades can be retroactively corrected by sweep |
| `stg_signals` | Incremental: append only new scan_dates | Signal history is append-only |
| `stg_positions` | Full truncate + reload | Positions change daily |
| `stg_equity_curves` | Full truncate + reload | Equity is recomputed by sweep |
| `stg_risk_snapshots` | Incremental: append new dates | Append-only |
| `stg_market_regimes` | Incremental: append new dates | Append-only |
| `mart_discovery_candidates` | Full repopulate (< 1s) | Depends on all tested combos |

---

## 6. MCP Tools (Query Interface)

All tools are added to the existing strategy analysis MCP server defined in PRD-20.  
**Server endpoint**: `http://autotrader.dailytickers.com/mcp/strategy/`

### 6.1 `QueryAnalytics`

Translate a semantic query against any defined cube into SQL and return results.

**Request schema**:
```json
{
  "name": "QueryAnalytics",
  "description": "Query any analytical cube with dimensions, measures, filters, and time grouping. Returns tabular results.",
  "inputSchema": {
    "type": "object",
    "required": ["cube", "measures"],
    "properties": {
      "cube": {
        "type": "string",
        "enum": ["signals", "trades", "positions", "equity_curves", "market_regimes", "risk_snapshots"]
      },
      "dimensions": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Dimensions to group by (e.g., ['strategy_type', 'regime_at_entry'])"
      },
      "measures": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Measures to compute (e.g., ['hit_rate', 'profit_factor', 'count'])"
      },
      "filters": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["dimension", "operator", "value"],
          "properties": {
            "dimension": { "type": "string" },
            "operator": {
              "type": "string",
              "enum": ["equals", "notEquals", "in", "notIn", "gt", "gte", "lt", "lte", "between"]
            },
            "value": {}
          }
        }
      },
      "time_range": {
        "type": "object",
        "properties": {
          "start": { "type": "string", "format": "date" },
          "end":   { "type": "string", "format": "date" }
        }
      },
      "granularity": {
        "type": "string",
        "enum": ["day", "week", "month", "quarter", "all"],
        "default": "all"
      },
      "order": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "measure":   { "type": "string" },
            "dimension": { "type": "string" },
            "direction": { "type": "string", "enum": ["asc", "desc"] }
          }
        }
      },
      "limit": { "type": "integer", "minimum": 1, "maximum": 500, "default": 50 }
    },
    "additionalProperties": false
  }
}
```

**Example request**:
```json
{
  "cube": "trades",
  "dimensions": ["strategy_type", "regime_at_entry"],
  "measures": ["hit_rate", "profit_factor", "count", "avg_return_pct"],
  "filters": [{"dimension": "exit_reason", "operator": "notEquals", "value": "expired"}],
  "time_range": {"start": "2026-01-01", "end": "2026-05-07"},
  "granularity": "month",
  "order": [{"measure": "hit_rate", "direction": "desc"}],
  "limit": 20
}
```

**Response**:
```json
{
  "cube": "trades",
  "row_count": 12,
  "freshness": "2026-05-07T06:15:00Z",
  "generated_sql": "SELECT strategy_type, regime_at_entry, strftime('%Y-%m', entry_date) AS period, ...",
  "columns": ["strategy_type", "regime_at_entry", "period", "hit_rate", "profit_factor", "count", "avg_return_pct"],
  "rows": [
    ["scanner", "RECOVERY", "2026-03", 0.72, 5.1, 18, 9.3],
    ["scanner", "RISK_ON",  "2026-04", 0.65, 4.2, 31, 7.1]
  ],
  "meta": {
    "total_trades_in_range": 142,
    "filtered_out": 8,
    "note": "Resolved trades only (exit_reason != expired)"
  }
}
```

### 6.2 `GetMart`

Return rows from a pre-aggregated mart with optional filters.

**Request schema**:
```json
{
  "name": "GetMart",
  "description": "Fetch rows from a pre-aggregated analytical mart. Fastest query path — no aggregation at query time.",
  "inputSchema": {
    "type": "object",
    "required": ["mart"],
    "properties": {
      "mart": {
        "type": "string",
        "enum": [
          "mart_strategy_performance",
          "mart_regime_analysis",
          "mart_signal_quality",
          "mart_sector_rotation",
          "mart_risk_attribution",
          "mart_discovery_candidates",
          "mart_holding_period_analysis"
        ]
      },
      "filters": {
        "type": "object",
        "description": "Key-value equality filters applied as WHERE clauses",
        "additionalProperties": true
      },
      "order_by": { "type": "string", "description": "Column name to sort by (DESC)" },
      "limit":    { "type": "integer", "default": 50, "maximum": 500 }
    },
    "additionalProperties": false
  }
}
```

**Example request**:
```json
{
  "mart": "mart_regime_analysis",
  "filters": {"regime": "RECOVERY"},
  "order_by": "hit_rate",
  "limit": 20
}
```

**Response**:
```json
{
  "mart": "mart_regime_analysis",
  "freshness": "2026-05-07T06:15:00Z",
  "row_count": 6,
  "rows": [
    {
      "regime": "RECOVERY",
      "strategy_slot_id": "balanced",
      "strategy_type": "scanner",
      "strategy_label": "Momentum",
      "trade_count": 14,
      "hit_rate": 0.71,
      "profit_factor": 4.8,
      "avg_return_pct": 9.2,
      "regime_alpha": 6.8
    }
  ]
}
```

### 6.3 `RunTransformation`

Trigger a refresh of one or all transformation layers.

**Request schema**:
```json
{
  "name": "RunTransformation",
  "description": "Trigger a refresh of the analytical data layer. Full refresh re-ingests all JSON sources. Mart refresh re-runs only mart computations.",
  "inputSchema": {
    "type": "object",
    "required": ["layer"],
    "properties": {
      "layer": {
        "type": "string",
        "enum": ["staging", "intermediate", "marts", "all"],
        "description": "Which layer to refresh"
      },
      "model": {
        "type": "string",
        "description": "Specific mart name (only for layer=marts)"
      },
      "force_refresh": {
        "type": "boolean",
        "default": false,
        "description": "Force full re-materialize even if data is recent"
      }
    },
    "additionalProperties": false
  }
}
```

**Response**:
```json
{
  "status": "completed",
  "layer": "marts",
  "model": "mart_strategy_performance",
  "duration_ms": 340,
  "rows_affected": 1240,
  "freshness": "2026-05-07T10:22:00Z"
}
```

### 6.4 `ListCubes`

```json
{
  "name": "ListCubes",
  "description": "List all available analytical cubes with their dimensions, measures, and data freshness.",
  "inputSchema": { "type": "object", "properties": {}, "additionalProperties": false }
}
```

**Response**:
```json
{
  "cubes": [
    {
      "name": "trades",
      "description": "Closed and open simulated trades from all strategy slots",
      "dimensions": ["strategy_slot_id", "strategy_type", "ticker", "sector", "entry_date", "exit_date", "holding_days_bucket", "exit_reason", "regime_at_entry", "regime_at_exit", "score_bucket"],
      "measures": ["count", "hit_rate", "profit_factor", "avg_return_pct", "total_return_pct", "max_win", "max_loss", "avg_holding_days", "sharpe_ratio", "sortino_ratio", "calmar_ratio", "expectancy_pct"],
      "time_dimension": "entry_date",
      "row_count": 5240,
      "freshness": "2026-05-07T06:15:00Z"
    }
  ],
  "last_refresh": "2026-05-07T06:15:00Z"
}
```

### 6.5 `ListMarts`

```json
{
  "name": "ListMarts",
  "description": "List all available pre-aggregated mart views with column schemas and freshness.",
  "inputSchema": { "type": "object", "properties": {}, "additionalProperties": false }
}
```

**Response**:
```json
{
  "marts": [
    {
      "name": "mart_regime_analysis",
      "description": "Strategy performance broken down by market regime",
      "columns": ["regime", "strategy_slot_id", "strategy_type", "strategy_label", "trade_count", "hit_rate", "profit_factor", "avg_return_pct", "total_return_pct", "avg_hold_days", "regime_alpha"],
      "row_count": 48,
      "freshness": "2026-05-07T06:15:00Z"
    }
  ]
}
```

### 6.6 `DiscoverStrategy`

Find unexplored parameter combinations predicted to perform well.

**Request schema**:
```json
{
  "name": "DiscoverStrategy",
  "description": "Identify untested parameter combinations predicted to meet performance constraints. Uses mart_discovery_candidates (k-NN interpolation from tested neighbors). Returns combos ready for backtesting via RunBacktest.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "constraints": {
        "type": "object",
        "properties": {
          "strategy_type":    { "type": "string", "enum": ["scanner", "mechanical", "ml"] },
          "min_trades":       { "type": "integer", "description": "Min expected trades for statistical significance" },
          "min_hit_rate":     { "type": "number", "description": "Minimum predicted hit rate (e.g., 0.55)" },
          "min_sharpe":       { "type": "number", "description": "Minimum estimated Sharpe ratio" },
          "min_confidence":   { "type": "number", "description": "Minimum interpolation confidence (0–1)" }
        }
      },
      "optimization_target": {
        "type": "string",
        "enum": ["sharpe_ratio", "hit_rate", "profit_factor", "calmar_ratio"],
        "default": "sharpe_ratio"
      },
      "explore_parameters": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": ["horizon", "max_positions", "score_threshold", "stop_loss_pct", "tp1_pct", "tp2_pct", "rotation_mode"]
        },
        "description": "Which parameters to vary (others held at best-known values)"
      },
      "limit": { "type": "integer", "default": 10, "maximum": 50 }
    },
    "additionalProperties": false
  }
}
```

**Example request**:
```json
{
  "constraints": {
    "strategy_type": "scanner",
    "min_trades": 30,
    "min_hit_rate": 0.55
  },
  "optimization_target": "sharpe_ratio",
  "explore_parameters": ["horizon", "max_positions", "score_threshold"]
}
```

**Response**:
```json
{
  "candidates": [
    {
      "rank": 1,
      "estimated_sharpe": 2.8,
      "estimated_hit_rate": 0.63,
      "confidence": 0.9,
      "neighbor_count": 5,
      "parameters": {
        "horizon": 7,
        "max_positions": 4,
        "score_threshold": 92,
        "stop_loss_pct": 0.05,
        "tp1_pct": 0.08,
        "tp2_pct": 0.15,
        "rotation_mode": "daily_max1"
      },
      "run_backtest_hint": {
        "mode": "balanced",
        "config_override": {
          "horizon": 7,
          "portfolioSize": 4,
          "minScore": 92,
          "stopLossPct": 0.05,
          "tp1Pct": 0.08,
          "tp2Pct": 0.15
        }
      }
    }
  ],
  "total_untested_combos": 4820,
  "freshness": "2026-05-07T06:15:00Z"
}
```

### 6.7 `CompareStrategies`

Side-by-side comparison of multiple slots across measures with optional regime breakdown.

**Request schema**:
```json
{
  "name": "CompareStrategies",
  "description": "Compare multiple strategy slots across performance measures. Optionally break down by market regime.",
  "inputSchema": {
    "type": "object",
    "required": ["slot_ids", "measures"],
    "properties": {
      "slot_ids": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Strategy slot IDs to compare (e.g., ['balanced', 'dynamic', 'turbo'])",
        "minItems": 2,
        "maxItems": 6
      },
      "measures": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": ["hit_rate", "profit_factor", "sharpe_ratio", "sortino_ratio", "calmar_ratio", "avg_return_pct", "total_return_pct", "max_drawdown", "avg_hold_days", "trade_count", "expectancy_pct"]
        }
      },
      "time_range": {
        "type": "object",
        "properties": {
          "start": { "type": "string", "format": "date" },
          "end":   { "type": "string", "format": "date" }
        }
      },
      "regime_breakdown": {
        "type": "boolean",
        "default": false,
        "description": "If true, include per-regime breakdown for each slot"
      }
    },
    "additionalProperties": false
  }
}
```

**Example request**:
```json
{
  "slot_ids": ["balanced", "dynamic"],
  "measures": ["hit_rate", "profit_factor", "sharpe_ratio", "max_drawdown"],
  "time_range": {"start": "2026-01-01"},
  "regime_breakdown": true
}
```

**Response**:
```json
{
  "time_range": {"start": "2026-01-01", "end": "2026-05-07"},
  "comparison": {
    "balanced": {
      "hit_rate": 0.62,
      "profit_factor": 4.8,
      "sharpe_ratio": 2.1,
      "max_drawdown": -0.041,
      "trade_count": 42
    },
    "dynamic": {
      "hit_rate": 0.58,
      "profit_factor": 3.9,
      "sharpe_ratio": 1.7,
      "max_drawdown": -0.072,
      "trade_count": 67
    }
  },
  "regime_breakdown": {
    "RISK_ON": {
      "balanced": { "hit_rate": 0.67, "trade_count": 28 },
      "dynamic":  { "hit_rate": 0.61, "trade_count": 45 }
    },
    "RECOVERY": {
      "balanced": { "hit_rate": 0.71, "trade_count": 14 },
      "dynamic":  { "hit_rate": 0.64, "trade_count": 22 }
    }
  },
  "verdict": {
    "winner_overall": "balanced",
    "winner_risk_on": "balanced",
    "winner_recovery": "balanced",
    "notes": "balanced leads on all risk-adjusted metrics; dynamic has 60% more trades — better for high-capital deployment"
  },
  "freshness": "2026-05-07T06:15:00Z"
}
```

---

## 7. Strategy Discovery Use Cases

### UC-1: Regime-Optimal Strategy Selection
**Question**: Which strategy slot performs best when switching from RISK_OFF to RECOVERY?

```json
{
  "tool": "GetMart",
  "mart": "mart_regime_analysis",
  "filters": {"regime": "RECOVERY"},
  "order_by": "regime_alpha"
}
```
Expected output: ranking of slots by regime_alpha in RECOVERY. Use to configure `regime-recalibrate.js` optimal mix.

### UC-2: Score Threshold Calibration
**Question**: Is the current minScore=88 optimal, or would 90 or 92 improve hit rate?

```json
{
  "tool": "GetMart",
  "mart": "mart_signal_quality",
  "filters": {"strategy_type": "scanner"},
  "order_by": "hit_rate"
}
```
Compare hit_rate and conversion_rate across score_bucket (85-90, 90-95, 95-100). A high hit_rate at 90-95 with acceptable volume → raise threshold.

### UC-3: Sector Rotation Timing
**Question**: Which sectors have had the highest win rates in Q1 2026?

```json
{
  "tool": "GetMart",
  "mart": "mart_sector_rotation",
  "filters": {},
  "order_by": "hit_rate"
}
```
Filter by month between 2026-01 and 2026-03. Identify sectors with hit_rate > 0.65 and trade_count > 5. Weight scanner signals toward those sectors next week.

### UC-4: Holding Period Optimization
**Question**: Should the horizon be 5 or 8 days for Momentum setups?

```json
{
  "tool": "GetMart",
  "mart": "mart_holding_period_analysis",
  "filters": {"strategy_label": "Momentum"}
}
```
Compare profit_factor and hit_rate across holding_days_bucket for Momentum. If `4-7d` bucket dominates `2-3d` → horizon=5–7 is optimal.

### UC-5: New Strategy Hypothesis Testing
**Question**: Would a Pre-Squeeze scanner with score≥95, horizon=3, maxPos=2 work better?

```json
{"tool": "DiscoverStrategy", "constraints": {"min_hit_rate": 0.60, "min_trades": 20}, "explore_parameters": ["horizon", "max_positions", "score_threshold"]}
```
Find the combo closest to those params in `mart_discovery_candidates`. Then call `RunBacktest` with the returned `run_backtest_hint`.

### UC-6: Parameter Sensitivity Analysis
**Question**: How sensitive is hit_rate to stop_loss_pct across 3–10% range?

```json
{
  "tool": "QueryAnalytics",
  "cube": "trades",
  "dimensions": ["exit_reason"],
  "measures": ["hit_rate", "count"],
  "filters": [{"dimension": "strategy_slot_id", "operator": "equals", "value": "balanced"}]
}
```
Cross-reference with `mart_discovery_candidates` filtered by stop_loss_pct range to see estimated Sharpe gradient.

### UC-7: Risk Budget Allocation
**Question**: Which slot contributes most to portfolio VaR? Should we reduce its allocation?

```json
{
  "tool": "GetMart",
  "mart": "mart_risk_attribution",
  "filters": {},
  "order_by": "var_95"
}
```
Identify highest-VaR slot. Compare its hit_rate (mart_strategy_performance) to justify risk budget. If VaR is disproportionate to returns → reduce `capitalUsd` in StrategySlot config.

### UC-8: Strategy Degradation Detection
**Question**: Is the balanced slot losing edge over the last 30 days?

```json
{
  "tool": "QueryAnalytics",
  "cube": "trades",
  "dimensions": ["strategy_slot_id"],
  "measures": ["hit_rate", "profit_factor", "count"],
  "filters": [{"dimension": "strategy_slot_id", "operator": "equals", "value": "balanced"}],
  "time_range": {"start": "2026-04-07", "end": "2026-05-07"},
  "granularity": "week"
}
```
Plot weekly hit_rate. Declining trend over 4 weeks → trigger `GetAdvisorRecommendation` (PRD-20 §4.5) for recalibration.

### UC-9: Cross-Slot Correlation Audit
**Question**: Are balanced and dynamic too correlated (holding the same tickers)?

```json
{
  "tool": "CompareStrategies",
  "slot_ids": ["balanced", "dynamic"],
  "measures": ["hit_rate", "profit_factor", "sharpe_ratio"],
  "regime_breakdown": true
}
```
Check `mart_risk_attribution.max_correlation`. If > 0.85 and both slots hold the same tickers on the same scan_date → confirm in `stg_positions` — then adjust `maxPositions` or add sector diversity constraint.

### UC-10: Sharia-Compliant Signal Performance
**Question**: Do sharia_compliant=true signals have comparable hit rates?

```json
{
  "tool": "QueryAnalytics",
  "cube": "signals",
  "dimensions": ["sharia_compliant", "strategy_label"],
  "measures": ["hit_rate", "conversion_rate", "count", "avg_score"]
}
```
If sharia signals underperform by < 5pp → acceptable. If > 10pp → investigate sector bias (e.g., too many energy exclusions in a energy-favorable regime).

---

## 8. Implementation Notes

- **SQLite WAL mode**: `PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;` — allows concurrent reads during write refresh.
- **Refresh duration**: Full refresh takes ~30s at 5,000 trades + 50,000 signals on Oracle Cloud (4 vCPU). Incremental < 5s.
- **No external dependencies**: Pure Go + `modernc.org/sqlite` (CGo-free). No dbt. No Cube.dev server.
- **Query engine**: `query.go` — parses `QueryAnalyticsRequest` → constructs parameterized SQL against the appropriate view — executes — formats as column/row JSON. No ORM.
- **SQL injection safety**: All dimension/measure names are validated against a whitelist map before interpolation into SQL. Values are always passed as `?` parameters.
- **Mart caching**: Mart query results are cached in a Go `sync.Map` keyed by `(mart + filter_hash)`. Cache is invalidated on `RunTransformation` completion or on refresh. TTL = 1 hour as backstop.
- **Missing data graceful degradation**: If `signals-history.json` is absent, `stg_signals` remains empty and `mart_signal_quality` returns zero rows (no crash). Same for all staging sources.
- **Sector map**: Populated from `data/instruments.json` at refresh time. Unknown tickers → `sector = 'Unknown'`.

---

## 9. Database Schema (Full)

```sql
-- Metadata
CREATE TABLE IF NOT EXISTS analytical_meta (
    key   TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Staging tables (see §4.1 for CREATE statements)
-- stg_signals, stg_trades, stg_positions, stg_equity_curves,
-- stg_risk_snapshots, stg_market_regimes

-- Intermediate tables
CREATE TABLE IF NOT EXISTS int_sector_map (
    ticker   TEXT PRIMARY KEY,
    sector   TEXT NOT NULL,
    industry TEXT
);

-- Intermediate views (see §4.2 for CREATE VIEW statements)
-- int_signals_enriched, int_trades_enriched, int_positions_enriched,
-- int_equity_curves, int_regime_periods

-- Mart views (see §4.3 for CREATE VIEW statements)
-- mart_strategy_performance, mart_regime_analysis, mart_signal_quality,
-- mart_sector_rotation, mart_risk_attribution,
-- mart_holding_period_analysis

-- Mart discovery table (materialized, not a view)
-- mart_discovery_candidates (see §4.3)

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_stg_trades_entry_date     ON stg_trades(entry_date);
CREATE INDEX IF NOT EXISTS idx_stg_trades_slot           ON stg_trades(strategy_slot_id);
CREATE INDEX IF NOT EXISTS idx_stg_trades_ticker         ON stg_trades(ticker);
CREATE INDEX IF NOT EXISTS idx_stg_signals_scan_date     ON stg_signals(scan_date);
CREATE INDEX IF NOT EXISTS idx_stg_signals_ticker        ON stg_signals(ticker);
CREATE INDEX IF NOT EXISTS idx_stg_signals_slot          ON stg_signals(strategy_slot_id);
CREATE INDEX IF NOT EXISTS idx_stg_equity_slot_date      ON stg_equity_curves(strategy_slot_id, date);
CREATE INDEX IF NOT EXISTS idx_stg_risk_slot_date        ON stg_risk_snapshots(strategy_slot_id, date);
CREATE INDEX IF NOT EXISTS idx_stg_regimes_date          ON stg_market_regimes(date);
CREATE INDEX IF NOT EXISTS idx_disc_candidates_sharpe    ON mart_discovery_candidates(estimated_sharpe DESC)
    WHERE tested = 0;
```

---

## 10. Refresh Pipeline (DAG)

```
Phase 9.5 — Analytics Refresh (daily pipeline, after gen-api.js)
│
├── A. truncate_staging()
│       stg_signals, stg_trades, stg_positions,
│       stg_equity_curves, stg_risk_snapshots, stg_market_regimes
│
├── B. load_staging() [parallel]
│       ├── loadSignals()       ← data/signals-history.json
│       ├── loadTrades()        ← data/backtest-trades.json
│       ├── loadPositions()     ← data/unified-positions.json
│       ├── loadEquityCurves()  ← data/portfolio-history.json
│       ├── loadRiskSnapshots() ← data/risk-snapshots.json
│       ├── loadRegimes()       ← data/regime-history.json (or derived)
│       └── loadSectorMap()     ← data/instruments.json
│
├── C. apply_intermediate_views()  [idempotent CREATE VIEW IF NOT EXISTS]
│       int_signals_enriched, int_trades_enriched,
│       int_positions_enriched, int_equity_curves,
│       int_regime_periods
│
├── D. apply_mart_views()  [idempotent CREATE VIEW IF NOT EXISTS]
│       mart_strategy_performance, mart_regime_analysis,
│       mart_signal_quality, mart_sector_rotation,
│       mart_risk_attribution, mart_holding_period_analysis
│
├── E. populate_discovery_candidates()
│       Read tested param sets → generate grid → k-NN interpolation
│       → INSERT top 200 into mart_discovery_candidates
│
└── F. update_meta()
        last_refresh, trade_count, signal_count, duration_ms

Dependencies:
B must complete before C.
C must complete before D (views reference int_* views).
D and E can run in parallel.
F runs after D + E complete.
```

**Failure handling**: Any step failure logs an error and sets `analytical_meta.last_refresh_status = 'failed:<step>'`. The daily pipeline continues — a failed analytics refresh does not block publishing or notifications.

---

## 11. Cross-PRD References

| PRD | Relationship |
|-----|-------------|
| **PRD-04** (Portfolio Simulation) | Primary data source: `backtest-trades.json`, `portfolio-history.json`, `backtest-results.json` |
| **PRD-17** (Strategy Discovery) | Consumer: Strategy Lab queries use `QueryAnalytics` + `DiscoverStrategy` instead of raw SQL |
| **PRD-20** (MCP Strategy Analysis) | Host server: 6 new tools added to the existing MCP server (same endpoint, same auth) |
| **PRD-23** (Unified Strategy Engine) | Source of StrategySlot schema used in `strategy_slot_id` dimensions; `strategy_type` enum aligned |
| **PRD-03** (Risk Management) | Source of `risk-snapshots.json` → `stg_risk_snapshots` → `mart_risk_attribution` |
| **PRD-05** (Position Tracking) | Source of `unified-positions.json` → `stg_positions` |
| **PRD-10** (Public API) | Analytical marts can power new public `/portfolio/v1/{slot}/analytics.json` endpoints |
| **PRD-15** (Scheduler) | Phase 9.5 added to daily pipeline DAG after `gen-api.js` |

**Data flow summary**:
```
PRD-04 sweep.js
    → backtest-trades.json + portfolio-history.json
PRD-03 refresh-risk-metrics.js
    → risk-snapshots.json
PRD-05 position tracker
    → unified-positions.json
PRD-02 scanner pipeline
    → signals-history.json
PRD-23 regime detection
    → regime-history.json

All → PRD-24 analytical.db (Phase 9.5)
    → QueryAnalytics / GetMart / DiscoverStrategy (MCP)
    → PRD-17 Strategy Lab
    → PRD-10 public API endpoints
```

## 12. Skill Integration

The analytical data layer is the backbone of AI-driven strategy operations. Skills consume marts and cubes as their primary data source.

### 12.1 Skill → Mart/Cube Mapping

| Skill | Primary Mart/Cube | MCP Tool | Purpose |
|-------|------------------|----------|---------|
| `/discover-strategy` | `mart_discovery_candidates` | `DiscoverStrategy`, `GetMart` | Find new strategy candidates |
| `/review-strategy` | `mart_strategy_performance` | `GetMart`, `GetRegimeImpact` | Health check existing slots |
| `/run-backtest` | `cube_trades`, `cube_equity_curves` | `QueryAnalytics` | Backtest result analysis |
| `/debug-trade` | `cube_signals`, `cube_trades` | `QueryAnalytics` | Trace signal → trade path |
| `/monitor-portfolio` | `cube_positions`, `cube_risk_snapshots` | `QueryAnalytics` | Live position monitoring |
| `/regime-check` | `mart_regime_analysis`, `cube_market_regimes` | `GetMart`, `QueryAnalytics` | Regime impact assessment |

### 12.2 Discovery Pipeline

The strategy discovery workflow chains multiple analytical operations:

```
mart_discovery_candidates
  → filter (Sharpe > 1.2, WR > 50%, PF > 1.5, trades ≥ 30)
  → RunBacktest (full walk-forward validation)
  → CompareStrategies (vs existing production slots)
  → mart_strategy_performance (regime sensitivity check)
  → StrategySlot config template (if approved)
```

This pipeline is orchestrated by the `/discover-strategy` skill, which composes `GetMart`, `DiscoverStrategy`, `RunBacktest`, and `CompareStrategies` MCP tools into a single coherent workflow.

### 12.3 Health Monitoring Pipeline

The strategy health monitoring workflow:

```
mart_strategy_performance (30/60/90-day rolling)
  → mart_regime_analysis (regime sensitivity)
  → mart_signal_quality (score predictiveness trends)
  → compare vs original backtest baseline
  → recommendation: continue | reduce | pause | recalibrate | retire
```

Orchestrated by the `/review-strategy` skill. Runs automatically as part of the weekly pipeline (PRD-15) and on-demand via skill invocation.

### 12.4 Mart Refresh Triggers

Skills can trigger mart refreshes when underlying data changes:

| Event | Marts Refreshed | Trigger |
|-------|----------------|---------|
| New backtest completed | `mart_strategy_performance`, `mart_discovery_candidates` | `/run-backtest` skill completion |
| Daily pipeline complete | All staging + intermediate + marts | PRD-15 scheduler |
| Strategy slot config change | `mart_strategy_performance` | `/add-strategy` or manual config edit |
| Regime shift detected | `mart_regime_analysis` | `regime-recalibrate.js` |

See PRD-25 for the complete skills catalog and architecture.
