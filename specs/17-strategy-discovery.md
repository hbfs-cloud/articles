# PRD-17: Strategy Discovery & Research Engine

**Version**: 1.0  
**Status**: Draft  
**Dependencies**: PRD-04 (Portfolio Simulation), PRD-02 (Signal Generation), PRD-13 (Mode Configuration), PRD-03 (Risk Management)

---

## 1. Overview

The Strategy Discovery & Research Engine exposes the existing grid-search backtest optimizer (`sweep.js`), walk-forward validator (`rolling-walk-forward.js`), and regime-recalibration logic (`regime-recalibrate.js`) as first-class SaaS features. Users select mode parameters, run backtests, optimize across dimensions, validate out-of-sample, and monitor live signal quality — all via API and UI.

This PRD is the authoritative specification. An LLM implementing this module must produce identical behavior to the existing scripts when the same inputs are provided.

---

## 2. Core Concepts

### 2.1 Signal Set
A **signal set** is the historical corpus of scanner setups used as backtest input. Each signal has:

```typescript
interface Signal {
  ticker: string;           // e.g. "AAPL"
  scanDate: string;         // ISO-8601 date "YYYY-MM-DD"
  score: number;            // 0–100
  strategy: string;         // "breakout" | "momentum" | "mean_reversion" | "squeeze" | "catalyst"
  entry: number;            // suggested entry price
  stop: number;             // stop loss price
  tp1: number;              // first take-profit price
  tp2: number | null;       // second take-profit price (optional)
  regime: string | null;    // "Risk-On" | "Risk-Off" | "Neutral" | "Early Risk-Off" | "Recovery" | null
}
```

### 2.2 Mode Config
A **mode config** is the parameter set applied to a signal set during simulation:

```typescript
interface ModeConfig {
  portfolioSize: number;      // max simultaneous open positions: [1,2,3,4,5,8,10,15]
  topN: number;               // candidates considered per scan: [1,2,3,4,5,8,10] (must be <= portfolioSize)
  minScore: number;           // minimum signal score threshold: [85, 90]
  rotation: string;           // "none" | "daily_max1" | "daily_max2" | "aggressive"
  strategyFilter: string[];   // list of allowed strategy strings (see §4.3)
  horizonDays: number;        // max hold in business days: [2,3,5,8,10,15]
  partialTP: boolean;         // close partialTPPct at TP1, trail remainder
  partialTPPct: number;       // fraction closed at TP1: always 0.5
  trailingStop: boolean;      // activate trailing stop after TP1 hit
  maxStopPct: number;         // hard stop cap as % of entry: [0,2,3,5,7] (0=disabled)
  atrStopMult: number;        // ATR-based stop multiplier: [0,1,2] (0=disabled)
  dailyTrailPct: number;      // daily trailing stop %: [0,2,3] (0=disabled)
  breakevenPct: number;       // move stop to breakeven after X% gain: [0,0.5,1] (0=disabled)
  staleDays: number;          // exit if no price progress after N days: [0,2] (0=disabled)
  entryGatePct: number;       // skip trade if open gaps >X% above entry: [0,3] (0=disabled)
  vwapGate: boolean;          // VWAP gate always ON in production (proven +29% PnL improvement)
}
```

### 2.3 Backtest Result
```typescript
interface BacktestResult {
  id: string;                    // UUID
  user_id: string;
  mode_id: string | null;        // null = custom
  config: ModeConfig;
  signal_set_version: string;    // date of oldest scan used
  created_at: string;            // ISO-8601
  duration_ms: number;
  trades_total: number;
  trades_resolved: number;
  metrics: BacktestMetrics;
  equity_curve: EquityPoint[];   // [{date, value}] starting at 100
  trade_list: TradeRecord[];
  walk_forward: WalkForwardResult | null;
  regime_breakdown: RegimeBreakdown | null;
}

interface BacktestMetrics {
  returnTotal: number;           // % total return
  maxDD: number;                 // % max drawdown (positive number)
  winRate: number;               // % of resolved trades that were wins
  profitFactor: number;          // grossWin / grossLoss (99 if no losses)
  sharpe: number;                // sqrt(252) * mean(daily_returns) / std(daily_returns)
  calmar: number;                // annualized_return / maxDD
  sortino: number;               // returnTotal / downside_deviation
  returnDDRatio: number;         // returnTotal / maxDD (legacy alias)
  tradesIn: number;              // total simulated
  tradesResolved: number;        // TP1/TP2/SL/Expired (excludes open)
  annualizedReturn: number;      // returnTotal * (252 / trading_days_elapsed)
}

interface EquityPoint {
  date: string;     // ISO-8601
  value: number;    // starts at 100
}

interface TradeRecord {
  ticker: string;
  scanDate: string;
  entryDate: string;
  exitDate: string | null;
  entryPrice: number;
  exitPrice: number | null;
  status: TradeStatus;
  pnlPct: number;
  daysHeld: number;
  regime: string | null;
}

type TradeStatus = "tp1" | "tp1_partial" | "tp2" | "sl" | "expired" | "rotated" | "breakeven" | "trail" | "open";
```

---

## 3. Feature Modules

### 3.1 Strategy Backtester

**Endpoint**: `POST /api/v1/strategy/backtest`

**Request**:
```typescript
interface BacktestRequest {
  mode_id?: string;       // use existing mode config as base (optional)
  config: Partial<ModeConfig>;  // overrides on top of mode_id defaults
  from_date?: string;     // ISO-8601, default = earliest available signal
  to_date?: string;       // ISO-8601, default = today
  walk_forward?: boolean; // include walk-forward split (default: true)
  regime_breakdown?: boolean; // include per-regime metrics (default: true)
}
```

**Response**: `BacktestResult` (full object)

**Behavior**:
1. Merge `config` overrides on top of `mode_id` defaults (if mode_id provided)
2. Validate config: `topN <= portfolioSize`, all values within allowed ranges (§2.2)
3. Load signal set filtered to `[from_date, to_date]`
4. Run simulation using §4 (Trade Simulation Engine)
5. Compute metrics using §5 (Metric Formulas)
6. If `walk_forward=true`, run §6 (Walk-Forward Split)
7. If `regime_breakdown=true`, compute metrics grouped by `signal.regime`
8. Persist result to DB with TTL 30 days
9. Return `BacktestResult`

**Sync vs Async**: backtests completing < 5s return synchronously (HTTP 200). Backtests > 5s return HTTP 202 with `{"job_id": "<uuid>"}` and fire-and-forget. Poll `GET /api/v1/strategy/backtest/{job_id}`.

---

### 3.2 Strategy Optimizer (Grid Search)

**Endpoint**: `POST /api/v1/strategy/optimize`

**Request**:
```typescript
interface OptimizeRequest {
  mode_id?: string;          // base mode to optimize around
  dimensions: OptimDimension[];  // which parameters to sweep
  constraints?: OptimConstraints;
  objective: OptimObjective;
  from_date?: string;
  to_date?: string;
  preset?: "quick" | "full";  // quick=720 combos, full=311K+ combos
}

interface OptimDimension {
  param: keyof ModeConfig;
  values: any[];   // explicit values to try (must be within allowed ranges)
}

interface OptimConstraints {
  min_return?: number;       // % minimum total return
  max_dd?: number;           // % maximum drawdown allowed
  min_wr?: number;           // % minimum win rate
  min_trades?: number;       // minimum resolved trades for validity
  mode_profile?: string;     // "turbo"|"dynamic"|"balanced"|"secured"|"fortress"|"tkl" — applies preset constraints (see §3.2.1)
}

interface OptimObjective {
  primary: "sharpe" | "calmar" | "sortino" | "return" | "win_rate" | "profit_factor" | "composite";
  secondary?: "sharpe" | "calmar" | "return";  // tiebreaker
}
```

**Response**:
```typescript
interface OptimizeResult {
  job_id: string;
  status: "pending" | "running" | "completed" | "failed";
  combos_tested: number;
  combos_total: number;
  top_configs: RankedConfig[];     // top 50 by objective
  advisor_strict: AdvisorConfig | null;   // best config meeting strict constraints
  advisor_relaxed: AdvisorConfig | null;  // best config meeting relaxed constraints
  pareto_frontier: ParetoPoint[];  // return vs maxDD frontier
  sensitivity: SensitivityMap;     // per-param impact on objective
}

interface RankedConfig {
  rank: number;
  config: ModeConfig;
  metrics: BacktestMetrics;
  constraint_pass: boolean;
}

interface AdvisorConfig {
  config: ModeConfig;
  metrics: BacktestMetrics;
  constraint_level: "strict" | "relaxed";
}

interface ParetoPoint {
  config: ModeConfig;
  return: number;
  maxDD: number;
  sharpe: number;
}

interface SensitivityMap {
  [param: string]: {
    values: any[];
    avg_objective: number[];    // mean objective value at each param value
    best_value: any;
    impact_score: number;       // 0–1, higher = more impactful param
  };
}
```

#### 3.2.1 Preset Mode Constraints (from sweep.js advisor thresholds)

| Mode | Strict: Return | Strict: DD | Strict: WR | Strict: Trades | Relaxed: Return | Relaxed: DD | Relaxed: WR | Relaxed: Trades |
|------|---------------|------------|------------|----------------|-----------------|-------------|-------------|-----------------|
| turbo | ≥40% | ≤10% | ≥50% | ≥8 | ≥25% | ≤15% | ≥45% | ≥8 |
| dynamic | ≥35% | ≤6% | ≥55% | ≥10 | ≥25% | ≤10% | ≥50% | ≥10 |
| balanced | ≥24% | ≤4% | ≥55% | ≥10 | ≥18% | ≤6% | ≥50% | ≥10 |
| secured | ≥12% | ≤2.5% | ≥65% | ≥10 | ≥8% | ≤3% | ≥55% | ≥10 |
| fortress | ≥8% | ≤1.5% | ≥65% | ≥10 | ≥5% | ≤2.5% | ≥55% | ≥10 |
| tkl | ≥15% | ≤5% | ≥50% | ≥30 | ≥10% | ≤8% | ≥40% | ≥20 |

**Algorithm**:
1. Parse `preset`: `quick` uses `portfolioSizes=[1,3,5]`, `topNs=[1,2]`, `minScores=[85]`, `horizons=[5,15]`; `full` uses all values (§4.1)
2. Build cartesian product of `dimensions` values (with `topN <= portfolioSize` guard)
3. For each combo: run simulation, compute metrics
4. Apply constraints filter: `advisor_strict` = first result passing strict thresholds; `advisor_relaxed` = first passing relaxed
5. Rank top 50 by `objective.primary` (descending), break ties with `objective.secondary`
6. Build Pareto frontier: keep configs where no other config has both higher return AND lower DD
7. Build sensitivity map: for each param, group results by param value, compute mean objective
8. This is a long-running job (HTTP 202 always). Poll `GET /api/v1/strategy/optimize/{job_id}`

**Preset `full` grid dimensions** (exact values from sweep.js):
```
portfolioSize: [1, 2, 3, 4, 5, 8, 10, 15]
topN:          [1, 2, 3, 4, 5, 8, 10]       (only topN <= portfolioSize)
minScore:      [85, 90]
horizonDays:   [2, 3, 5, 8, 10, 15]
rotation:      ["none", "daily_max1", "aggressive"]
partialTP:     [false, true]                  (partialTPPct fixed at 0.5)
trailingStop:  [false, true]
maxStopPct:    [0, 2, 3, 5, 7]               (0 = no cap)
atrStopMult:   [0, 1, 2]                     (0 = disabled)
dailyTrailPct: [0, 2, 3]                     (0 = disabled)
breakevenPct:  [0, 0.5, 1]                   (0 = disabled)
staleDays:     [0, 2]                        (0 = disabled)
entryGatePct:  [0, 3]                        (0 = disabled; 3 = reject opens gapping >3% above entry)
vwapGate:      true                          (fixed, always ON — proven +29% PnL improvement)
strategyFilter: all named filters in STRATEGY_FILTERS_MAP (see §4.3)
```

Total full-sweep combinations: ~311,000+. Expected runtime: ~5 min on 4-core server.

---

### 3.3 Strategy Lab (A/B Comparison)

**Endpoint**: `POST /api/v1/strategy/compare`

**Request**:
```typescript
interface CompareRequest {
  config_a: Partial<ModeConfig>;
  config_b: Partial<ModeConfig>;
  base_mode_id?: string;     // shared base defaults for both
  from_date?: string;
  to_date?: string;
  regime_filter?: string;    // only include signals where regime matches (optional)
  what_if?: WhatIfScenario;
}

interface WhatIfScenario {
  // Override one signal-selection parameter and re-run
  override_filter?: string;     // e.g. "breakout_only" — replace strategyFilter
  override_min_score?: number;  // e.g. 90
}
```

**Response**:
```typescript
interface CompareResult {
  config_a: { config: ModeConfig; metrics: BacktestMetrics; equity_curve: EquityPoint[]; }
  config_b: { config: ModeConfig; metrics: BacktestMetrics; equity_curve: EquityPoint[]; }
  diff: {
    return_delta: number;       // config_b.return - config_a.return
    sharpe_delta: number;
    dd_delta: number;
    wr_delta: number;
    winner: "a" | "b" | "tie";
  }
  trade_overlap: {
    both: number;      // trades present in both
    only_a: number;
    only_b: number;
    overlap_pct: number;
  }
}
```

**Behavior**: Runs two independent backtests on the same signal corpus and computes diffs. `trade_overlap` counts unique `ticker+scanDate` pairs appearing in each result.

---

### 3.4 Walk-Forward Validator

#### Inline (as part of BacktestRequest)
When `walk_forward=true` in `POST /api/v1/strategy/backtest`, the engine applies the 70/30 chronological split (see §6).

#### Standalone
**Endpoint**: `POST /api/v1/strategy/walk-forward`

**Request**:
```typescript
interface WalkForwardRequest {
  config: Partial<ModeConfig>;
  mode_id?: string;
  window_days?: number;    // rolling window size in trading days: default 10, min 5, max 30
  from_date?: string;
  to_date?: string;
}
```

**Response**:
```typescript
interface WalkForwardResult {
  split_type: "rolling" | "anchored_70_30";
  window_days?: number;         // only for rolling
  in_sample_scans: number;
  out_sample_scans: number;
  periods: WalkForwardPeriod[];
  aggregates: { [mode_id: string]: WalkForwardAggregate };
  overfitting_alert: boolean;   // true if in_sample WR > out_sample WR by > 15pp
  small_sample_warning: boolean; // true if any period has < 5 resolved trades
}

interface WalkForwardPeriod {
  scan_date: string;
  is_window_start: string;      // IS window: [scan_date - window_days, scan_date - 1]
  is_window_trades: number;
  is_window_resolved: number;
  is_wr: number | null;         // null if < 3 resolved
  is_ret: number;
  test_trades: number;          // trades opened on this exact scan_date
  test_resolved: number;
  test_wr: number | null;
  test_ret: number;
}

interface WalkForwardAggregate {
  n_periods: number;
  first_half_avg_wr: number;    // average WR across first half of periods
  second_half_avg_wr: number;   // average WR across second half
  drift_pp: number;             // second_half - first_half (negative = degradation)
  verdict: "stable" | "degrading" | "insufficient_data";
  error?: string;               // "insufficient_data" if n_periods < 3
}
```

**Overfitting Detection Logic**:
```
if (avg(is_wr across all periods) - avg(test_wr across all periods) > 15):
    overfitting_alert = true
if (any period has resolved < 5):
    small_sample_warning = true
verdict:
  if n_periods < 3: "insufficient_data"
  elif |drift_pp| < 5: "stable"
  else: "degrading"
```

---

### 3.5 Strategy Monitor (Real-Time Signal Quality)

**Endpoint**: `GET /api/v1/strategy/monitor/{mode_id}`

**Response**:
```typescript
interface MonitorStatus {
  mode_id: string;
  as_of: string;               // ISO-8601
  open_positions: MonitorPosition[];
  entry_quality: EntryQuality;
  exit_quality: ExitQuality;
  regime: string;
  vwap_gate_active: boolean;
}

interface MonitorPosition {
  ticker: string;
  entry_date: string;
  entry_price: number;
  current_price: number;
  pnl_pct: number;
  status: "entry_zone" | "trending" | "tp1_hit" | "tp2_hit" | "near_stop" | "stopped";
  days_held: number;
  horizon_expires: string;     // ISO-8601
  earnings_flag: boolean;      // earnings within ±3 days
}

interface EntryQuality {
  // Comparison: market open vs VWAP gate entry
  // VWAP proxy = (high + low + close) / 3 of entry day
  trades_with_vwap_data: number;
  vwap_gate_blocked_pct: number;   // % of signals blocked (open > VWAP * 1.01)
  avg_slippage_market_open: number; // avg % diff between planned entry and actual open
  avg_slippage_vwap: number;        // avg % diff between planned entry and VWAP
  vwap_pnl_improvement: number;     // % PnL improvement of VWAP vs market open entry
}

interface ExitQuality {
  tp1_hit_pct: number;       // % of resolved trades hitting TP1
  tp2_hit_pct: number;       // % of resolved trades hitting TP2
  sl_hit_pct: number;        // % of resolved trades stopped
  expired_pct: number;       // % expired without hitting any target
  avg_days_to_exit: number;
}
```

**Implementation**: Reads from `data/signal-monitor-state.json` (maintained by `signal-monitor.js`) and `scanner/status/history/<latest>.json`. Refreshed every 60 seconds via background WebSocket monitor process.

---

### 3.6 Regime-Adaptive Recalibration

**Endpoint**: `POST /api/v1/strategy/recalibrate`

**Request**:
```typescript
interface RecalibrateRequest {
  mode_id?: string;        // recalibrate specific mode, null = all modes
  history_window?: number; // scans to consider for regime detection, default 7, min 3, max 30
  stability_days?: number; // consecutive days required before trigger, default 3, min 1
  dry_run?: boolean;       // default true — never apply without explicit false
  force?: boolean;         // bypass stability requirement, default false
}
```

**Response**:
```typescript
interface RecalibrateResult {
  regime_detected: string;      // dominant regime in window
  regime_stability: number;     // consecutive days same regime
  regime_distribution: { [regime: string]: number };  // count per regime
  regime_changed: boolean;      // detected != active
  triggered: boolean;           // change + stable + not dry_run
  applied: boolean;             // true only if triggered and !dry_run
  proposal: RecalibrateProposal | null;
  advisor_source: "strict" | "relaxed" | "none";
}

interface RecalibrateProposal {
  timestamp: string;
  prev_regime: string;
  new_regime: string;
  deltas: {
    [mode_id: string]: {
      status: "updated" | "no_change" | "no_advisor";
      cur: Partial<ModeConfig>;
      proposed: Partial<ModeConfig>;
      changed_fields: string[];
    }
  }
}
```

**Regime Detection Algorithm** (exact logic from regime-recalibrate.js):
```
1. Read last `history_window` scanner HTML files from scanner/ directory
2. Extract regime string from each file (meta description or regime ticker-metric)
3. Normalize to uppercase: "RISK-ON" | "RISK-OFF" | "EARLY RISK-OFF" | "NEUTRAL" | "RECOVERY"
4. Compute distribution: count per regime value
5. dominant = regime with highest count
6. stability = count of consecutive trailing days with regime == dominant (scan oldest→newest, count from end)
7. If dominant != modes-config._regime AND stability >= stability_days → trigger
8. If triggered AND !dry_run: read advisor_<mode> from data/backtest-results.json (sweep output)
   - Use advisor_strict if available, else advisor_relaxed
   - Build proposal.deltas: for each mode, diff cur config vs suggested
   - Write new modes-config.json (preserve all prior fields, update changed params + _regime + _version)
   - Append to portfolio/v1/config-history.json (append-only, never overwrite)
```

**Config History Entry Schema**:
```typescript
interface ConfigHistoryEntry {
  _version: number;          // bumped from previous
  timestamp: string;
  regime: string;
  config: { [mode_id: string]: ModeConfig };
  triggered_by: string;      // "recalibrate-api" | "regime-recalibrate.js"
}
```

---

## 4. Trade Simulation Engine

This section defines the exact simulation logic. All backtest endpoints use this engine.

### 4.1 Trade Simulation (`simulateTrade`)

```
Input: signal (Signal), scanDate (string), priceHistory (OHLCV map by date), config (ModeConfig)
Output: TradeRecord | null

1. entryDate = next business day after scanDate
   (if entryDate has no price bar, skip → return null)

2. entryBar = priceHistory[entryDate]
   actualEntryPrice = entryBar.open

3. VWAP gate (if config.vwapGate = true):
   vwap = (entryBar.high + entryBar.low + entryBar.close) / 3
   if actualEntryPrice > vwap * 1.01:
     return null  // gap-up: skip trade

4. Entry gate (if config.entryGatePct > 0):
   if actualEntryPrice > signal.entry * (1 + config.entryGatePct/100):
     return null  // gapped too far above planned entry

5. R-multiple reconstruction (preserves trade structure at actual entry):
   setupR = |signal.entry - signal.stop|
   isLong = signal.entry > signal.stop

   For long:
     tp1Mult = (signal.tp1 - signal.entry) / signal.entry
     tp2Mult = signal.tp2 ? (signal.tp2 - signal.entry) / signal.entry : tp1Mult * 2
     actualStop = actualEntryPrice * (1 - setupR / signal.entry)
     actualTP1  = actualEntryPrice * (1 + tp1Mult)
     actualTP2  = actualEntryPrice * (1 + tp2Mult)
   For short: mirror signs

6. Hard stop cap (if config.maxStopPct > 0):
   strategyStopCap = { breakout: 10, momentum: 10, default: maxStopPct }
   hardStopFloor = actualEntryPrice * (1 - min(strategyStopCap, config.maxStopPct) / 100)
   actualStop = max(actualStop, hardStopFloor)  // for long

7. Walk forward through price bars (sorted dates >= entryDate, max config.horizonDays bars):
   For each bar:
     a. Check SL: if low <= actualStop → status="sl", pnl=(actualStop-entry)/entry*100, exit
     b. Check TP1: if high >= actualTP1
        - If partialTP=false AND trailingStop=false: status="tp1", exit
        - If partialTP=true: realize partialTPPct at TP1, activate trailing stop on remainder
        - If trailingStop=true (no partialTP): activate trail
     c. Check TP2 (if no partialTP or after partial): if high >= actualTP2 → status="tp2", exit
     d. Breakeven trigger (if breakevenPct > 0 and not yet triggered):
        if pnl% > breakevenPct: move actualStop to actualEntryPrice
     e. Trailing stop (if active, dailyTrailPct > 0):
        trailingFloor = close * (1 - dailyTrailPct/100)
        actualStop = max(actualStop, trailingFloor)
     f. Stale exit (if staleDays > 0):
        if bar.close ≈ bar[staleDays ago].close (< 0.5% change) → status="expired", exit
   After max horizonDays: status="expired"
```

### 4.2 Portfolio Simulation (`simulatePortfolio`)

```
Input: allSignals (Signal[]), config (ModeConfig)
Output: closedTrades (TradeRecord[])

State: openPositions = [], closedTrades = []
Sorted scan dates (unique, ascending):

For each scanDate in chronological order:
  1. Expire positions: close any open position where exitDate <= scanDate
     → status="expired", push to closedTrades
  
  2. Filter signals for this scan date:
     filtered = signals where scanDate matches AND score >= config.minScore
                AND strategy in config.strategyFilter
     Sort by score DESC
     candidates = filtered.slice(0, config.topN)
  
  3. VIX kill switch: if regime==="Risk-Off" AND mode has vixKillThreshold configured:
     skip all new entries this scan
  
  4. Rotation (if config.rotation !== "none"):
     if openPositions.length >= config.portfolioSize AND candidates.length > 0:
       rotLimit = rotation="daily_max1" ? 1 : rotation="daily_max2" ? 2 : portfolioSize
       worstPositions = openPositions sorted by pnl ASC, take rotLimit
       For worst of worst:
         if worst.score + margin < candidate.score (margin=0 for "aggressive", 5 otherwise):
           close worst (status="rotated", forcePnl = current pnl)
           free up slot
  
  5. New entries: slotsAvailable = portfolioSize - openPositions.length
     For each candidate (up to slotsAvailable):
       if ticker already in openPositions: skip (no doubling up)
       trade = simulateTrade(signal, scanDate, priceCache[signal.ticker], config)
       if trade !== null: openPositions.push(trade)
  
  6. Continue to next scan date

Final: push all remaining openPositions to closedTrades with status="open"
```

### 4.3 Strategy Filters (from STRATEGY_FILTERS_MAP)

```typescript
const STRATEGY_FILTERS: { [name: string]: string[] } = {
  "all":              ["breakout", "momentum", "mean_reversion", "squeeze", "catalyst"],
  "breakout_only":   ["breakout"],
  "momentum_only":   ["momentum"],
  "no_mean_rev":     ["breakout", "momentum", "squeeze", "catalyst"],
  "no_catalyst":     ["breakout", "momentum", "mean_reversion", "squeeze"],
  "high_conviction": ["breakout", "momentum"],
  // additional filters may be present — treat as opaque set membership
}
```

---

## 5. Metric Formulas

All metrics computed identically to `computeStatsFromTrades` in sweep.js:

```
positionWeight = 1 / portfolioSize  (equal-weight)

For equity curve:
  Start at 100.0
  For each closed trade (sorted by exitDate ASC):
    equity *= (1 + pnlPct/100 * positionWeight)

returnTotal = (final_equity - 100) / 100 * 100  (%)

maxDD:
  peak = 100
  For each equity point:
    dd = (peak - value) / peak
    if dd > maxDD: maxDD = dd
    if value > peak: peak = value
  maxDD = maxDD * 100  (%)

winRate:
  resolved = trades where status NOT IN ["open"]
  wins = resolved where pnlPct > 0
  winRate = wins.length / resolved.length * 100  (%)

profitFactor:
  grossWin = sum(pnlPct for winning resolved trades)
  grossLoss = sum(|pnlPct| for losing resolved trades)
  profitFactor = grossWin / grossLoss  (99 if grossLoss = 0)

sharpe (TRUE Sharpe, annualized):
  Build daily equity series from equityCurve
  dailyReturns[i] = (equityCurve[i].value - equityCurve[i-1].value) / equityCurve[i-1].value
  mean = average(dailyReturns)
  stdev = std_dev(dailyReturns)
  sharpe = sqrt(252) * mean / stdev  (0 if stdev = 0)

calmar:
  dayCount = business_days between first and last exitDate
  annReturn = returnTotal * (252 / dayCount)
  calmar = annReturn / maxDD  (0 if maxDD = 0)

sortino:
  downsideDev = std_dev(daily_returns where daily_return < 0)
  sortino = returnTotal / downsideDev  (99 if downsideDev = 0)

returnDDRatio (legacy):
  returnDDRatio = returnTotal / maxDD  (99 if maxDD = 0)
```

---

## 6. Walk-Forward Split Logic

Applied when `walk_forward=true` in backtest, or standalone endpoint:

### Anchored 70/30 Split (default for backtests)
```
sortedScans = unique scan dates sorted ASC
splitIdx = floor(sortedScans.length * 0.7)
inSampleDates = sortedScans[0..splitIdx-1]   // 70%
outSampleDates = sortedScans[splitIdx..]      // 30%

Run full simulation on inSampleDates → in_sample_metrics
Run full simulation on outSampleDates → out_sample_metrics
Report both + divergence metrics
```

### Rolling Window (standalone walk-forward endpoint)
```
For each scanDate D in sortedScans (where there are >= window_days prior scans):
  is_window = trades with exitDate in [D - window_days business days, D - 1]
  is_wr = resolved(is_window).winRate
  is_ret = sum return of is_window
  test_trades = trades opened on exactly D
  test_wr = resolved(test_trades).winRate
  test_ret = sum return of test_trades
  Append WalkForwardPeriod

Compute aggregate per mode:
  first_half = periods[0 .. n/2]
  second_half = periods[n/2 ..]
  drift_pp = avg(second_half.is_wr) - avg(first_half.is_wr)
  verdict = "degrading" if |drift_pp| >= 5, else "stable" (requires n >= 3)
```

---

## 7. Data Storage

### PostgreSQL Tables

```sql
CREATE TABLE backtest_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  job_type TEXT NOT NULL CHECK (job_type IN ('backtest', 'optimize', 'walk_forward', 'compare')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
  request_payload JSONB NOT NULL,
  result_payload JSONB,
  error_message TEXT,
  combos_tested INTEGER,
  combos_total INTEGER,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '30 days'
);

CREATE INDEX idx_backtest_jobs_user ON backtest_jobs(user_id, created_at DESC);
CREATE INDEX idx_backtest_jobs_status ON backtest_jobs(status) WHERE status IN ('pending','running');

CREATE TABLE strategy_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  config JSONB NOT NULL,                    -- ModeConfig
  base_mode_id TEXT,
  tags TEXT[],
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 8. API Endpoints Summary

| Method | Path | Description | Auth | Tier |
|--------|------|-------------|------|------|
| POST | `/api/v1/strategy/backtest` | Run single backtest | JWT | basic+ |
| GET | `/api/v1/strategy/backtest/{job_id}` | Poll backtest result | JWT | basic+ |
| POST | `/api/v1/strategy/optimize` | Grid search optimizer | JWT | pro |
| GET | `/api/v1/strategy/optimize/{job_id}` | Poll optimizer result | JWT | pro |
| POST | `/api/v1/strategy/compare` | A/B config comparison | JWT | basic+ |
| POST | `/api/v1/strategy/walk-forward` | Standalone walk-forward | JWT | basic+ |
| GET | `/api/v1/strategy/monitor/{mode_id}` | Live signal quality | JWT | basic+ |
| POST | `/api/v1/strategy/recalibrate` | Regime recalibration | JWT | pro |
| GET | `/api/v1/strategy/configs` | List saved configs | JWT | free+ |
| POST | `/api/v1/strategy/configs` | Save config | JWT | free+ |
| DELETE | `/api/v1/strategy/configs/{id}` | Delete config | JWT | free+ |

---

## 9. Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `INVALID_CONFIG` | 400 | Config param out of allowed range |
| `TOPN_EXCEEDS_PORTFOLIO` | 400 | topN > portfolioSize |
| `NO_SIGNALS_IN_RANGE` | 400 | Signal set is empty for date range |
| `JOB_NOT_FOUND` | 404 | job_id does not exist or belongs to another user |
| `TIER_REQUIRED` | 403 | Feature requires higher subscription tier |
| `OPTIMIZE_IN_PROGRESS` | 409 | User already has a running optimize job |
| `INSUFFICIENT_TRADES` | 422 | < 8 resolved trades for meaningful metrics |

---

## 10. Performance Requirements

- Single backtest (< 500 signals): < 2s synchronous response
- Optimizer quick preset (720 combos): < 30s, HTTP 202 with polling
- Optimizer full preset (311K combos): < 10 min, HTTP 202 with polling
- Walk-forward (default 10-day window): < 5s
- Monitor endpoint: < 200ms (reads from cache, refreshed every 60s)
- All optimizer/backtest runs are isolated per-user (no shared mutable state)

---

## 11. Signal Quality Analytics

Hit rate and outcome quality decomposed by signal characteristics. Computed from resolved
trades in `data/backtest-trades.json` after each simulation run.

### 11.1 Quality dimensions

| Dimension | Buckets |
|-----------|---------|
| Score bucket | `90-92`, `93-95`, `96-98`, `99-100` |
| Strategy label | `Momentum`, `Breakout`, `Pullback`, `Pre-Squeeze` |
| Sector | Each sector tag present in signals |
| Market regime | `RISK-ON`, `NEUTRAL`, `EARLY RISK-OFF`, `RISK-OFF`, `RECOVERY` |

### 11.2 Signal quality report schema

```typescript
interface SignalQualityReport {
  generated_at: string;
  mode_id: string;
  period: { from: string; to: string };
  total_signals: number;
  resolved_signals: number;

  by_score_bucket: {
    [bucket: string]: SignalQualitySlice;
  };
  by_strategy: {
    [strategy: string]: SignalQualitySlice;
  };
  by_sector: {
    [sector: string]: SignalQualitySlice;
  };
  by_regime: {
    [regime: string]: SignalQualitySlice;
  };

  confusion_matrix: {
    true_positive: number;   // signal predicted up, trade was winner
    false_positive: number;  // signal predicted up, trade was loser
    precision: number;       // true_positive / (true_positive + false_positive) * 100
    note: string;
  };
}

interface SignalQualitySlice {
  signals: number;
  resolved: number;
  hits_tp1: number;
  hits_tp2: number;
  stops: number;
  expired: number;
  hit_rate_tp1: number;      // hits_tp1 / resolved * 100
  hit_rate_any_tp: number;   // (hits_tp1 + hits_tp2) / resolved * 100
  avg_pnl_winners: number;
  avg_pnl_losers: number;
  expectancy: number;        // hit_rate_tp1/100 * avg_pnl_winners + (1 - hit_rate_tp1/100) * avg_pnl_losers
}
```

### 11.3 Confusion matrix definition

`ExplainTrade` and scan scores predict a positive direction (long setup). Map to actual:
- **True positive**: resolved trade with `pnlPct > 0` (TP1, TP2, or partial trail)
- **False positive**: resolved trade with `pnlPct <= 0` (SL or expired negative)
- Expired trades with `pnlPct >= 0` count as true positives.

### 11.4 Output file

```
data/signal-quality-{modeId}.json    — generated by gen-api.js per mode
portfolio/v1/{mode}/analytics/signal-quality.json  — public endpoint (PRD-10 §9.6)
```

---

## 12. Regime Impact Analysis

Per-strategy performance across the 5 market regimes. Used to derive `optimal_strategy_mix`
and regime-gated filter overrides (`regimeFilters` in ModeConfig).

### 12.1 Regime detection reference

Regime labels are sourced from `signals.json#regime` per scan directory. Normalization:
```
"Risk-On" | "RISK-ON"       → "RISK-ON"
"Risk-Off" | "RISK-OFF"     → "RISK-OFF"
"Early Risk-Off" | ...      → "EARLY RISK-OFF"
"Neutral" | "NEUTRAL"       → "NEUTRAL"
"Recovery" | "RECOVERY"     → "RECOVERY"
```

Missing regime label → exclude trade from regime breakdown (logged as `unknown`).

### 12.2 Regime impact schema

```typescript
interface RegimeImpactReport {
  mode_id: string;
  generated_at: string;
  regimes: {
    [regime: string]: RegimeSlice;
  };
  optimal_strategy_mix: {
    [regime: string]: {
      recommended_filter: string;   // key from STRATEGY_FILTERS_MAP
      recommended_min_score: number;
      rationale: string;            // e.g. "Breakout_only shows 78% WR in RECOVERY"
    };
  };
  regime_transition_log: {
    date: string;
    from: string;
    to: string;
  }[];
}

interface RegimeSlice {
  days_active: number;
  total_trades: number;
  win_rate: number | null;        // null if total_trades < 3
  return_total: number;
  max_dd: number;
  sharpe: number | null;
  profit_factor: number | null;
  by_strategy: {
    [strategy: string]: {
      trades: number;
      win_rate: number | null;
      pnl_total: number;
    };
  };
  note?: string;                  // e.g. "VIX gate blocked entries on N days"
}
```

### 12.3 Optimal strategy mix derivation

For each regime, rank strategy slices by `win_rate` (minimum 5 trades for significance).
The highest-ranked strategy determines `recommended_filter`. If no strategy meets the
5-trade threshold, fall back to the all-time best filter for this mode.

```
optimal_min_score[regime] = min_score that maximizes sharpe within this regime
  → grid-search min_score ∈ [85, 88, 90, 92, 95] over regime-filtered trades
  → pick the value with highest sharpe (min 3 trades required)
```

---

## 13. Automated Insights Engine

Rules-based insight and recommendation generation. No LLM calls — all output uses
parameterized string templates populated from analytics data.

### 13.1 Insight types

| Type | Trigger condition | Example output |
|------|------------------|----------------|
| `regime_underperformance` | Mode WR in current regime < overall WR by ≥ 10pp | "Balanced underperforms by 3.2pp in RISK-OFF regimes — consider reducing allocation during VIX > 25" |
| `strategy_outperformance` | One strategy WR ≥ overall WR + 15pp in a regime | "Momentum strategies show 78% hit rate in RECOVERY regime — increase exposure" |
| `score_quality_gap` | `hit_rate_tp1[96-100]` ≥ `hit_rate_tp1[90-92]` + 20pp | "High-conviction signals (score 96+) deliver 2.3× the hit rate of borderline entries — raise minScore to 93" |
| `holding_period_sweet_spot` | One holding bucket has win_rate ≥ overall + 12pp | "3-5 day holds outperform all other periods (65% WR vs 58% overall) — consider reducing horizonDays to 5" |
| `drawdown_concentration` | Single position drove ≥ 60% of max drawdown | "AMD contributed 62% of the max drawdown on 2026-03-14 — apply sector cap of 1 for Semis" |
| `regime_drift` | current_regime ≠ optimization_regime AND staleness_days ≥ 14 | "Config was optimized in NEUTRAL but current regime is RISK-OFF — recalibration recommended" |

### 13.2 Insight schema

```typescript
interface AutomatedInsight {
  id: string;                      // e.g. "regime_underperformance_RISK-OFF"
  type: InsightType;
  severity: "info" | "warning" | "critical";
  mode_id: string;
  generated_at: string;
  headline: string;                // one-line summary
  detail: string;                  // 1-2 sentence explanation with data
  recommendation: string;          // actionable suggestion
  data: Record<string, number | string>;  // key metrics that triggered the insight
  expires_at: string;              // ISO-8601, insight is stale after this date
}
```

### 13.3 Generation integration

Insights are generated by `gen-api.js` after analytics computation:
```javascript
function buildInsights(modeData, attribution, qualityReport, regimeImpact, healthStatus) {
  const insights = [];
  // Apply each rule in order; each rule returns an AutomatedInsight or null
  insights.push(...applyRegimeUnderperformanceRule(attribution, regimeImpact));
  insights.push(...applyStrategyOutperformanceRule(qualityReport, regimeImpact));
  insights.push(...applyScoreQualityGapRule(qualityReport));
  insights.push(...applyHoldingPeriodRule(attribution));
  insights.push(...applyDrawdownConcentrationRule(modeData));
  insights.push(...applyRegimeDriftRule(healthStatus));
  return insights.filter(Boolean);
}
```

Output file: `portfolio/v1/{mode}/insights/strategy-health.json` (consumed by PRD-10 §10.3).

---

## 14. Strategy Health Monitor

Real-time parameter staleness detection, performance degradation alerts, and regime drift
dashboard widget. Extends the existing `GET /api/v1/strategy/monitor/{mode_id}` endpoint (§3.5).

### 14.1 Health status schema

```typescript
interface StrategyHealthStatus {
  mode_id: string;
  as_of: string;
  overall_health: "good" | "warning" | "critical";
  health_score: number;        // 0–100; see §14.2 for formula

  parameter_staleness: {
    days_since_last_optimization: number;
    optimization_regime: string;     // regime when last optimized
    current_regime: string;
    regime_drift: boolean;           // optimization_regime ≠ current_regime
    staleness_warning: boolean;      // days_since_last_optimization ≥ 30
    staleness_threshold_days: number; // configurable, default 30
  };

  performance_degradation: {
    rolling_7d_wr: number | null;
    rolling_30d_wr: number | null;
    wr_drop_pp: number | null;       // rolling_7d_wr - rolling_30d_wr (negative = degradation)
    degradation_alert: boolean;      // wr_drop_pp <= -10
    rolling_7d_sharpe: number | null;
    rolling_30d_sharpe: number | null;
    sharpe_drop_pct: number | null;  // pct change; negative = degradation
  };

  alerts: StrategyHealthAlert[];
  recommendations: string[];
  next_optimization_due: string;     // ISO-8601 date when re-optimization is recommended
}

interface StrategyHealthAlert {
  type: "staleness" | "wr_degradation" | "sharpe_degradation" | "regime_drift" | "dd_spike";
  severity: "info" | "warning" | "critical";
  message: string;
  triggered_at: string;
  threshold: number;
  current_value: number;
}
```

### 14.2 Health score formula

```
wr_score =
  rolling_7d_wr >= rolling_30d_wr - 5  → 1.0
  rolling_7d_wr >= rolling_30d_wr - 10 → 0.7
  else                                  → 0.3

staleness_score =
  days_since_last_optimization < 14     → 1.0
  days_since_last_optimization < 30     → 0.7
  else                                  → 0.3

regime_score =
  regime_drift = false                  → 1.0
  regime_drift = true, staleness < 7   → 0.7
  else                                  → 0.3

health_score = round(60 * wr_score + 25 * staleness_score + 15 * regime_score)
overall_health = health_score >= 70 → "good" | health_score >= 45 → "warning" | "critical"
```

### 14.3 Dashboard widget spec

The health monitor feeds a collapsible widget in the Scanner Status Page (`scanner/status/`).
Widget renders one row per mode:

```
[MODE BADGE]  Health: ●good  WR(7d): 63% ↑  Staleness: 8d  Regime: RISK-ON ✓  [Details ▼]
```

- Badge color: green (good), amber (warning), red (critical)
- `Details` expands to show `alerts[]` and `recommendations[]`
- Widget data source: `portfolio/v1/{mode}/insights/strategy-health.json`
- Refreshed on page load; polling interval 5 min

### 14.4 Integration with recalibration

When `overall_health === "critical"` and `regime_drift === true`, the `gen-status-page.js`
pipeline adds a "Recalibrate" CTA in the mode panel. Clicking triggers
`POST /api/v1/strategy/recalibrate` (PRD-17 §3.6) with `dry_run: true`, displaying the

## 15. Skill-Based Strategy Research

Strategy discovery and research workflows are exposed as AI agent skills (PRD-25), making them accessible to Claude Code, Codex, Gemini CLI, and other AI coding agents.

### 15.1 Primary Skills

| Skill | Purpose | Entry Point |
|-------|---------|-------------|
| `/discover-strategy` | Find new strategies from analytical marts | `DiscoverStrategy` MCP tool + `mart_discovery_candidates` |
| `/review-strategy` | Health check existing strategy slots | `GetMart` + `GetRegimeImpact` + `GetSignalQualityReport` |
| `/run-backtest` | Execute and analyze backtests | `RunBacktest` MCP tool |

### 15.2 Agent Workflow

An AI agent performing strategy research follows this pattern:

1. **Explore**: `/discover-strategy` → query marts for candidates
2. **Validate**: `/run-backtest` → full walk-forward on promising candidates
3. **Compare**: Use `CompareStrategies` to evaluate vs existing slots
4. **Review**: `/review-strategy` → check for regime sensitivity or degradation
5. **Deploy**: `/add-strategy` → implement and register if approved

This workflow implements the **Exploration/Discovery** agentic pattern (see PRD-25 §7) — autonomous discovery with human-in-the-loop approval before deployment.

### 15.3 Automated Health Monitoring

The weekly pipeline (PRD-15) automatically runs `/review-strategy` for all active slots. Degradation alerts feed into the notification hub (PRD-22) and trigger the **Reflection** agentic pattern — the system self-evaluates and recommends parameter adjustments.

See PRD-25 for complete skill definitions and the full agentic patterns mapping.
proposal diff before the user confirms.