# PRD-03: Risk Management Layer

**Version**: 1.0  
**Depends on**: PRD-01 (Market Data), PRD-02 (Signal Generation), PRD-13 (Mode Config), PRD-23 (Unified Strategy Engine — hierarchical risk model §7)  
**Consumed by**: PRD-06 (Order Execution), PRD-04 (Portfolio Simulation)

---

## 1. Purpose

Apply mandatory post-screening risk gates to the `SignalGenerationResult` before signals become executable orders. This layer enforces regime-aware position limits, correlation-based deduplication, earnings safety windows, optimal sizing, and all runtime circuit breakers.

The output is a `GatedSignalSet` — the final authoritative list of signals and sizes for each mode. No further filtering occurs downstream.

---

## 2. Inputs / Outputs

**Input**: `SignalGenerationResult` from PRD-02 (§ 11)  
**Input**: `modes-config.json` (§ 6)  
**Input**: `data/risk-snapshots.json` (written by `refresh-risk-metrics.js`)  
**Input**: `CollectionResult.correlationMatrix`, `.earningsExclusions`, `.sizingOutput`, `.regime` (passed through from PRD-01 via PRD-02)

**Output**: `GatedSignalSet` — one per mode, written to `data/gated-signals-{modeId}-{scanDate}.json`

---

## 3. `GatedSignalSet` Schema

```json
{
  "scanDate": "2026-05-07",
  "modeId": "balanced",
  "generatedAt": "2026-05-07T23:18:00Z",
  "regime": "NEUTRAL",
  "regimeGateApplied": false,
  "signals": [
    {
      "ticker": "NVDA",
      "score": 93,
      "strategy": "Momentum",
      "entry": 885.40,
      "stop": 852.15,
      "tp1": 930.00,
      "tp2": 975.00,
      "rr_numeric": 2.2,
      "horizon": 10,
      "region": "US",
      "sector": "Technology",
      "sharia": true,
      "risk_pct": 0.85,
      "position_size_pct": 4.2,
      "stop_calibrated": 852.15,
      "tp1_calibrated": 930.00,
      "sl_cooldown_active": false,
      "cross_mode_dedup_dropped": false,
      "earnings_tag": null,
      "confluence": ["rsi_zone", "vol_surge", "dark_pool", "insider_buy"],
      "badges": ["insider_buy"],
      "invalidations": []
    }
  ],
  "tklSignals": [ /* same shape, for TKL mode only */ ],
  "dropped": [
    {
      "ticker": "AMD",
      "reason": "correlation_drop",
      "details": "rho(NVDA,AMD)=0.88 > 0.85, AMD has lower score"
    }
  ],
  "riskSnapshot": {
    "var_95": -2.1,
    "var_99": -3.4,
    "regime_prob": { "risk_on": 0.28, "neutral": 0.61 },
    "portfolio_correlation": 0.51
  },
  "circuitBreakerStatus": {
    "vix_kill_active": false,
    "dd_breaker_active": false,
    "sl_cooldown_tickers": []
  }
}
```

---

## 4. Mandatory MCP Risk Gates — Sequence

All 4 gates execute IN ORDER. Earlier gates can reduce the candidate list before later gates process it.

### Gate 1 — Regime Gating

**Source**: `CollectionResult.regime` (already fetched in PRD-01 § 4.6 — no additional MCP call needed)

**Decision tree**:

```
probs = regime.probabilities
state = regime.current_state
confidence = regime.current_state_confidence

# Trigger 1: Crisis mode
if probs.risk_off > 0.30:
  APPLY: max_positions = 5, strategy_filter = ["Breakout"], size_multiplier = 0.5
  flag: regimeGateApplied = true, reason = "risk_off_gt_30pct"

# Trigger 2: Early risk-off
elif probs.early_risk_off > 0.50:
  APPLY: max_positions = 5, strategy_filter = ["Breakout"], size_multiplier = 0.5
  flag: regimeGateApplied = true, reason = "early_risk_off_gt_50pct"

# Trigger 3: Uncertain regime
if confidence < 0.30:
  FLAG: uncertain_regime = true  # No position reduction, but log + notify
  # Reduce max_positions by 2 for all modes as precaution
  max_positions -= 2

# After regime gate, filter signals:
if regimeGateApplied:
  signals = signals.filter(s => strategy_filter.includes(s.strategy))
  signals = signals.slice(0, max_positions)
  # Apply size_multiplier in Gate 4 sizing step
```

**Per-mode strategy filters** (from `modes-config.json.regimeFilters`):

| Mode | RISK-ON | NEUTRAL | EARLY RISK-OFF | RISK-OFF | RECOVERY |
|------|---------|---------|----------------|----------|----------|
| turbo | All | Momentum, Breakout | Breakout | None | Momentum |
| dynamic | All | All | Breakout | None | Momentum |
| balanced | Momentum, Breakout | Momentum | Momentum | None | Momentum |
| secured | Momentum | Momentum | None | None | Momentum |
| fortress | Momentum | Momentum | None | None | Momentum |
| tkl | Momentum, Breakout | Momentum | None | None | Momentum |

`None` = halt entries entirely for that regime in that mode.

```
# Apply per-mode strategy filter (regardless of regime gate trigger):
allowedStrategies = modes[modeId].regimeFilters[regime.current_state]
if allowedStrategies == None or allowedStrategies.length == 0:
  signals = []  # All entries halted
  log "INFO:entries_halted modeId={modeId} regime={regime}"
else:
  signals = signals.filter(s => allowedStrategies.includes(s.strategy))
```

---

### Gate 2 — Correlation Check

**Source**: `CollectionResult.correlationMatrix` (fetched in PRD-01 § 4.7)

**Symbols used**: tickers from current `signals` list (post Gate 1)

```
matrix = correlationMatrix.matrix
maxPair = correlationMatrix.max_pair
avgOffDiag = correlationMatrix.avg_off_diagonal

# Rule 1: Single high-correlation pair
if maxPair.rho > 0.85:
  tickerA = maxPair.a
  tickerB = maxPair.b
  scoreA = signals.find(s => s.ticker == tickerA).score
  scoreB = signals.find(s => s.ticker == tickerB).score
  loserTicker = scoreA >= scoreB ? tickerB : tickerA
  DROP loserTicker from signals, reason="correlation_drop", details="rho({a},{b})={rho}"

# Rule 2: High average correlation → sector diversification enforcement
if avgOffDiag > 0.65:
  sectors = Set(signals.map(s => s.sector))
  if sectors.size < 2:
    # Keep top signal per sector, drop the rest by score ascending
    while sectors.size < 2 AND signals.length > 2:
      lowestScoreSignal = signals.sort by score asc, take first
      if removing it doesn't reduce sector count below 1:
        DROP lowestScoreSignal, reason="avg_correlation_sector_enforcement"
    log "WARN:forced_sector_diversification avgRho={avgOffDiag}"

# Repeat Rule 1 after each drop (recalculate maxPair from remaining signals)
# Maximum 3 iterations to prevent infinite loop
iterations = 0
while max_pairwise_rho(signals) > 0.85 AND iterations < 3:
  recalculate maxPair from matrix using remaining signal tickers
  DROP lower-scoring ticker of maxPair
  iterations++
```

**Fallback if correlationMatrix is null** (PRD-01 gate failed): Skip Gate 2, log `WARN:correlation_gate_skipped`.

---

### Gate 3 — Earnings Filter

**Source**: `CollectionResult.earningsExclusions` (fetched in PRD-01 § 4.8)

This gate is a final enforcement pass. PRD-02 Step 5 already applies earnings exclusions, but this gate re-checks with the final signal list in case any ticker slipped through.

```
scanDate = Date.parse(signals.scanDate)

for each signal in signals:
  event = earningsExclusions.find(e => e.ticker == signal.ticker)
  if event:
    windowStart = Date.parse(event.exclusion_window_start)
    windowEnd = Date.parse(event.exclusion_window_end)
    if scanDate >= windowStart AND scanDate <= windowEnd:
      DROP signal, reason="earnings_exclusion_window_recheck"
    elif days_until(event.earnings_date) <= 7:
      signal.earnings_tag = "earnings_risk_7d"
      signal.invalidations.push("Earnings in " + days_until(event.earnings_date) + "d — expected move " + event.expected_move_pct + "%")
      # NOT dropped — tagged only, user/mode decides
```

---

### Gate 4 — Position Sizing

**Source**: `CollectionResult.sizingOutput` (fetched in PRD-01 § 4.9)

```
sizingOutput = CollectionResult.sizingOutput

# Step 4a: Apply correlation-based drops from OptimizeSizing
for each droppedTicker in sizingOutput.dropped_for_correlation:
  if droppedTicker in signals:
    DROP droppedTicker, reason="optimizer_correlation_drop"

# Step 4b: Apply regime size multiplier (from Gate 1)
sizeMultiplier = regimeGateApplied ? 0.5 : 1.0

# Step 4c: Assign risk_pct and position_size_pct per signal
for each signal in signals:
  alloc = sizingOutput.allocations[signal.ticker]
  if alloc != null:
    signal.risk_pct = round(alloc.risk_pct * sizeMultiplier, 4)
    signal.position_size_pct = round(alloc.size_pct * sizeMultiplier, 2)
  else:
    # Fallback: inverse-ATR sizing (see § 5.1)
    signal.risk_pct = computeInverseATRRiskPct(signal, modeConfig)
    signal.position_size_pct = computePositionSizePct(signal, modeConfig)

# Step 4d: Calibrate SL/TP from risk_pct
for each signal in signals:
  signal.stop_calibrated = calibrateStop(signal, signal.risk_pct, modeConfig)
  signal.tp1_calibrated = calibrateTP1(signal, signal.risk_pct)
```

---

## 5. Sizing Formulas

### 5.1 Inverse-ATR Sizing (Fallback)

Used when `OptimizeSizing` allocation is unavailable for a ticker.

```
# Inputs
entry         = signal.entry
atr14         = signal.atr14  # from screener candidate
account_equity = modeConfig.accountEquity  # from config.json
target_risk_pct = modeConfig.targetRiskPct  # per mode (see § 6)

# Stop distance in ATR units
atr_multiplier = 1.5  # fixed
stop_distance  = atr14 * atr_multiplier
stop           = entry - stop_distance

# Dollar risk per trade
dollar_risk = account_equity * (target_risk_pct / 100)

# Shares
shares = floor(dollar_risk / stop_distance)

# Position value
position_value = shares * entry
position_size_pct = round((position_value / account_equity) * 100, 2)

# Risk pct (actual, after rounding shares)
risk_pct = round((shares * stop_distance / account_equity) * 100, 4)
```

**Caps**:
- `position_size_pct` must not exceed `modeConfig.maxPositionSizePct` (default 10%)
- `risk_pct` must not exceed `modeConfig.maxPositionRiskPct` (default 1.0% for most modes)
- If capped, reduce `shares` proportionally

### 5.2 Stop Calibration

```
# If mode uses ATR-based stop
if modeConfig.stopMethod == "atr":
  calibrated_stop = entry - (atr14 * modeConfig.atrStopMultiplier)

# If mode uses fixed pct stop
elif modeConfig.stopMethod == "pct":
  calibrated_stop = entry * (1 - modeConfig.stopPct / 100)

# Never move stop further than original signal stop
calibrated_stop = max(calibrated_stop, signal.stop)

# Round to 2 decimal places
signal.stop_calibrated = round(calibrated_stop, 2)
```

### 5.3 TP1 Calibration

```
risk = entry - stop_calibrated
tp1_calibrated = round(entry + risk * modeConfig.tp1RMultiple, 2)
# Default tp1RMultiple = 2.0 (2:1 minimum)
signal.tp1_calibrated = max(tp1_calibrated, signal.tp1)
```

---

## 6. Per-Slot Runtime Configuration (`modes-config.json`)

Complete schema for all 6 strategy slots (historically called "modes"). In the unified engine (PRD-23 §3.3), each mode maps 1:1 to a `StrategySlotConfig`. The `modeConfig` variable used throughout this PRD corresponds to `StrategySlotConfig` in PRD-23. Risk parameters follow the hierarchical model: Portfolio → Slot → Position (PRD-23 §7).

```json
{
  "modes": {
    "turbo": {
      "modeId": "turbo",
      "slots": 1,
      "horizonDays": 2,
      "targetRiskPct": 1.0,
      "maxPositionRiskPct": 1.0,
      "maxPositionSizePct": 15.0,
      "vixKillThreshold": 28,
      "ddBreakerPct": 4.0,
      "sectorCapMax": 1,
      "correlationCap": 0.85,
      "crossModeDedup": false,
      "sizingMethod": "inverse_atr",
      "atrStopMultiplier": 1.5,
      "stopMethod": "atr",
      "tp1RMultiple": 2.0,
      "tp2RMultiple": 3.5,
      "breakevenTriggerPct": 0.5,
      "trailingStop": false,
      "partialExitPct": 50,
      "slCooldownDays": 10,
      "regimeFilters": {
        "RISK-ON": ["Momentum", "Breakout", "Pullback", "Pre-Squeeze"],
        "NEUTRAL": ["Momentum", "Breakout"],
        "EARLY RISK-OFF": ["Breakout"],
        "RISK-OFF": [],
        "RECOVERY": ["Momentum"]
      }
    },
    "dynamic": {
      "modeId": "dynamic",
      "slots": 1,
      "horizonDays": 2,
      "targetRiskPct": 1.0,
      "maxPositionRiskPct": 1.0,
      "maxPositionSizePct": 12.0,
      "vixKillThreshold": 25,
      "ddBreakerPct": 4.0,
      "sectorCapMax": 1,
      "correlationCap": 0.85,
      "crossModeDedup": false,
      "sizingMethod": "inverse_atr",
      "atrStopMultiplier": 1.5,
      "stopMethod": "atr",
      "tp1RMultiple": 2.0,
      "tp2RMultiple": 3.5,
      "breakevenTriggerPct": 1.0,
      "trailingStop": false,
      "partialExitPct": 50,
      "slCooldownDays": 10,
      "regimeFilters": {
        "RISK-ON": ["Momentum", "Breakout", "Pullback", "Pre-Squeeze"],
        "NEUTRAL": ["Momentum", "Breakout", "Pullback", "Pre-Squeeze"],
        "EARLY RISK-OFF": ["Breakout"],
        "RISK-OFF": [],
        "RECOVERY": ["Momentum"]
      }
    },
    "balanced": {
      "modeId": "balanced",
      "slots": 3,
      "horizonDays": 5,
      "targetRiskPct": 1.0,
      "maxPositionRiskPct": 1.0,
      "maxPositionSizePct": 10.0,
      "vixKillThreshold": 25,
      "ddBreakerPct": 5.0,
      "sectorCapMax": 2,
      "correlationCap": 0.70,
      "crossModeDedup": true,
      "crossModePriority": 3,
      "sizingMethod": "inverse_atr",
      "atrStopMultiplier": 1.5,
      "stopMethod": "atr",
      "tp1RMultiple": 2.0,
      "tp2RMultiple": 3.5,
      "breakevenTriggerPct": 1.5,
      "trailingStop": false,
      "partialExitPct": 50,
      "slCooldownDays": 10,
      "regimeFilters": {
        "RISK-ON": ["Momentum", "Breakout"],
        "NEUTRAL": ["Momentum"],
        "EARLY RISK-OFF": ["Momentum"],
        "RISK-OFF": [],
        "RECOVERY": ["Momentum"]
      }
    },
    "secured": {
      "modeId": "secured",
      "slots": 2,
      "horizonDays": 5,
      "targetRiskPct": 0.75,
      "maxPositionRiskPct": 0.75,
      "maxPositionSizePct": 8.0,
      "vixKillThreshold": 22,
      "ddBreakerPct": 3.0,
      "sectorCapMax": 1,
      "correlationCap": 0.65,
      "crossModeDedup": true,
      "crossModePriority": 2,
      "sizingMethod": "inverse_atr",
      "atrStopMultiplier": 1.5,
      "stopMethod": "atr",
      "tp1RMultiple": 2.0,
      "tp2RMultiple": 3.5,
      "breakevenTriggerPct": 1.5,
      "trailingStop": false,
      "partialExitPct": 50,
      "slCooldownDays": 10,
      "regimeFilters": {
        "RISK-ON": ["Momentum"],
        "NEUTRAL": ["Momentum"],
        "EARLY RISK-OFF": [],
        "RISK-OFF": [],
        "RECOVERY": ["Momentum"]
      }
    },
    "fortress": {
      "modeId": "fortress",
      "slots": 4,
      "horizonDays": 8,
      "targetRiskPct": 0.5,
      "maxPositionRiskPct": 0.5,
      "maxPositionSizePct": 6.0,
      "vixKillThreshold": 20,
      "ddBreakerPct": 2.0,
      "sectorCapMax": 2,
      "correlationCap": 0.70,
      "crossModeDedup": true,
      "crossModePriority": 1,
      "sizingMethod": "inverse_atr",
      "atrStopMultiplier": 1.5,
      "stopMethod": "atr",
      "tp1RMultiple": 2.0,
      "tp2RMultiple": 3.5,
      "breakevenTriggerPct": 2.0,
      "trailingStop": true,
      "trailingStopAtrMultiple": 2.0,
      "partialExitPct": 50,
      "slCooldownDays": 10,
      "regimeFilters": {
        "RISK-ON": ["Momentum"],
        "NEUTRAL": ["Momentum"],
        "EARLY RISK-OFF": [],
        "RISK-OFF": [],
        "RECOVERY": ["Momentum"]
      }
    },
    "tkl": {
      "modeId": "tkl",
      "slots": 5,
      "horizonDays": 5,
      "targetRiskPct": 1.0,
      "maxPositionRiskPct": 1.0,
      "maxPositionSizePct": 8.0,
      "vixKillThreshold": 25,
      "ddBreakerPct": 4.0,
      "sectorCapMax": 2,
      "correlationCap": 0.80,
      "crossModeDedup": false,
      "sizingMethod": "inverse_atr",
      "atrStopMultiplier": 1.5,
      "stopMethod": "atr",
      "tp1RMultiple": 2.0,
      "tp2RMultiple": 0,
      "breakevenTriggerPct": 1.5,
      "trailingStop": false,
      "partialExitPct": 50,
      "slCooldownDays": 10,
      "regimeFilters": {
        "RISK-ON": ["Momentum", "Breakout"],
        "NEUTRAL": ["Momentum"],
        "EARLY RISK-OFF": [],
        "RISK-OFF": [],
        "RECOVERY": ["Momentum"]
      }
    }
  }
}
```

---

## 7. Runtime Circuit Breakers

These checks run at session start (before any orders are placed) and continuously during the trading session. They are evaluated per-mode.

### 7.1 VIX Kill Switch

```
# Source: GetMarketOverview().vix OR live Yahoo Finance VIX quote
currentVIX = liveVIX()
threshold  = modeConfig.vixKillThreshold

if currentVIX >= threshold:
  HALT all new entries for modeId
  circuitBreakerStatus.vix_kill_active = true
  log "INFO:vix_kill_active modeId={modeId} vix={currentVIX} threshold={threshold}"
  notify Telegram: "[{MODE}] VIX Kill: {currentVIX} >= {threshold}. New entries halted."
  # Existing open positions: NOT closed. Let them run with existing stops.
  # Re-check every 30 minutes. Resume entries when VIX drops below threshold * 0.95
  resume_threshold = threshold * 0.95
```

### 7.2 Drawdown Breaker

```
# Source: scanner-positions.json (unified positions, see PRD-05 §7.2) + backtest-trades.json
# Compute rolling 10-day realized PnL for this strategy slot
recentTrades = trades.filter(t => t.strategySlotId == slotId AND days_since(t.exitDate) <= 10)
rollingPnlPct = sum(recentTrades.map(t => t.pnlPct)) / modeConfig.slots

if rollingPnlPct <= -(modeConfig.ddBreakerPct):
  HALT all new entries for modeId
  circuitBreakerStatus.dd_breaker_active = true
  log "WARN:dd_breaker_active modeId={modeId} rolling10dPnl={rollingPnlPct}% threshold=-{ddBreakerPct}%"
  notify Telegram: "[{MODE}] DD Breaker: -{rollingPnlPct}% over 10d >= {ddBreakerPct}% limit."
  # Cooldown: 48 hours. Resume only when both conditions met:
  #   1. 48h have elapsed since breaker triggered
  #   2. rollingPnlPct has recovered to > -(ddBreakerPct * 0.5)
```

**DD computation formula** (exact):
```
rollingPnlPct = (sum of pnlPct for all closed trades in last 10 calendar days) / slots
# slots = number of simultaneous positions the mode can hold
# pnlPct = (exitPrice - entryPrice) / entryPrice * 100
# For partial exits: weight by exit fraction (50% at TP1 = 0.5 * pnlPct_tp1 + 0.5 * pnlPct_tp2)
```

### 7.3 Stop-Loss Cooldown

After a stop-loss is triggered on a specific ticker, that ticker enters a cooldown period.

```
# On stop-loss hit:
record: { ticker, hitDate, modeId }
# Persist to data/sl-cooldowns.json

# At signal gate time:
for each signal in GatedSignalSet.signals:
  cooldownRecord = slCooldowns.find(c => c.ticker == signal.ticker AND c.modeId == modeId)
  if cooldownRecord:
    daysSinceHit = days_since(cooldownRecord.hitDate)
    if daysSinceHit < modeConfig.slCooldownDays:  # default: 10 days
      signal.sl_cooldown_active = true
      DROP signal, reason="sl_cooldown_active",
           details="SL hit {daysSinceHit}d ago on {hitDate}, cooldown={slCooldownDays}d"
```

`sl-cooldowns.json` schema:
```json
{
  "cooldowns": [
    {
      "ticker": "AMD",
      "modeId": "balanced",
      "hitDate": "2026-04-28",
      "exitPrice": 142.30,
      "entryPrice": 158.00,
      "pnlPct": -9.94
    }
  ]
}
```

---

## 8. Cross-Mode Deduplication

Applies only to modes with `crossModeDedup: true` (balanced, secured, fortress).

**Priority order** (lower number = higher priority):
```
fortress  → priority 1  (gets first pick)
secured   → priority 2
balanced  → priority 3
```

**Algorithm**:
```
# Process modes in priority order: fortress → secured → balanced
claimedTickers = Set()

for modeId in ["fortress", "secured", "balanced"]:
  gatedSignals = GatedSignalSets[modeId]
  for signal in gatedSignals.signals:
    if signal.ticker in claimedTickers:
      DROP signal from modeId, reason="cross_mode_dedup",
           details="ticker claimed by higher-priority mode"
      signal.cross_mode_dedup_dropped = true
    else:
      claimedTickers.add(signal.ticker)
```

**Turbo and Dynamic**: `crossModeDedup: false` — they run independently. Same ticker can appear in turbo AND balanced simultaneously. This is intentional (confirmation signal, not conflict).

**TKL**: `crossModeDedup: false` — operates on a different universe.

---

## 9. `data/risk-snapshots.json` — Schema

Written by `refresh-risk-metrics.js` via MCP Gateway calls. Read by this module (PRD-03) and by `gen-status-page.js`.

```json
{
  "snapshotDate": "2026-05-07",
  "generatedAt": "2026-05-07T23:10:00Z",
  "modes": {
    "balanced": {
      "var_95": -2.1,
      "var_99": -3.4,
      "cvar_95": -2.8,
      "stress_scenarios": {
        "2020_covid_crash": -8.4,
        "2022_rate_shock": -5.2,
        "2008_gfc": -12.1
      },
      "correlation_matrix_avg": 0.51,
      "regime_prob": {
        "risk_on": 0.28,
        "neutral": 0.61,
        "early_risk_off": 0.09,
        "risk_off": 0.01,
        "recovery": 0.01
      },
      "portfolio_beta": 1.12,
      "current_drawdown_pct": -1.2,
      "positions_count": 2,
      "open_risk_pct": 1.74
    }
  },
  "stub": false
}
```

**Stub detection**:
```
if riskSnapshots.stub == true OR riskSnapshots is empty:
  log "ERROR:risk_snapshots_is_stub"
  notify operator via Telegram
  # Do NOT silently accept stub — force operator intervention
  # Pipeline continues with degraded risk data but flags it prominently
```

---

## 10. Complete Gate Sequence Per Mode

```
For each modeId in ["turbo", "dynamic", "balanced", "secured", "fortress", "tkl"]:

T+0   Load modeConfig from modes-config.json
T+0   Load sl-cooldowns.json
T+0   Load risk-snapshots.json → validate not stub

T+1   [Gate 1] Regime strategy filter
        → filter signals by allowedStrategies
        → if regimeGateApplied: max_positions=5, sizeMultiplier=0.5

T+2   [Gate 2] Correlation check
        → drop lower-scoring of any pair with rho > modeConfig.correlationCap
        → enforce min 2 sectors if avgOffDiag > 0.65
        → max 3 iterations

T+3   [Gate 3] Earnings re-check
        → drop tickers in exclusion window
        → tag "earnings_risk_7d" if earnings within 7d

T+4   [Gate 4] Sizing
        → apply dropped_for_correlation from OptimizeSizing
        → assign risk_pct and position_size_pct
        → apply sizeMultiplier from Gate 1
        → calibrate stop and TP1

T+5   [Circuit Breaker Check] VIX Kill
        → if vix >= modeConfig.vixKillThreshold: clear signals

T+6   [Circuit Breaker Check] DD Breaker
        → if rollingPnlPct <= -ddBreakerPct: clear signals

T+7   [SL Cooldown Check]
        → drop tickers with active cooldown

T+8   [Cross-Mode Dedup] (balanced, secured, fortress only)
        → process in priority order: fortress → secured → balanced

T+9   [Slot cap enforcement]
        → signals.slice(0, modeConfig.slots)

T+10  Write GatedSignalSet to data/gated-signals-{modeId}-{scanDate}.json
```

---

## 11. Error Handling

| Condition | Severity | Action |
|-----------|----------|--------|
| `modes-config.json` missing | ERROR | Abort pipeline |
| `risk-snapshots.json` is stub | ERROR | Log, notify, continue with degraded data |
| `sl-cooldowns.json` missing | WARN | Skip cooldown check, create empty file |
| Gate 1: regime probs sum ≠ 1.0 | WARN | Normalize to 1.0, continue |
| Gate 2: matrix missing ticker | WARN | Skip that pair, continue |
| Gate 2: max_iterations reached | WARN | Log, accept current state |
| Gate 4: sizing returns NaN | ERROR | Use flat `targetRiskPct`, log |
| VIX fetch fails | WARN | Use `GetMarketOverview().vix` as fallback; if also null, skip VIX kill |
| Cross-mode dedup: priority conflict | WARN | Re-apply fortress→secured→balanced order strictly |
| GatedSignalSet has 0 signals | INFO | Write empty GatedSignalSet, notify per-mode Telegram topic |

---

## 12. Telegram Notification Schema (Per Mode, On Gate Completion)

Topic IDs: turbo/dynamic → 89, balanced → 90, secured/fortress → 91, tkl → 1064

```
[{MODE}] Risk Gate Complete — {scanDate}
Regime: {regime} ({confidence}% confidence)
Signals: {count} finalized
Regime gate: {regimeGateApplied ? "APPLIED ("+reason+")" : "not applied"}
VIX Kill: {vix_kill_active ? "ACTIVE (VIX="+vix+")" : "clear"}
DD Breaker: {dd_breaker_active ? "ACTIVE ("+rollingPnlPct+"%)" : "clear"}
SL Cooldowns: {slCooldownCount} tickers blocked
Dropped: {droppedCount} ({drop_reasons_summary})
```

Only send if `TELEGRAM_BOT_TOKEN` is set. No crash if token missing.

> **Unified Engine note**: In the unified engine (PRD-23), risk management follows a three-level hierarchy: **Portfolio** (global exposure, cross-slot dedup) → **Slot** (per-slot circuit breakers, sector caps, VIX kill) → **Position** (stop-loss, trailing, breakeven). The `modeConfig` variable used in this PRD maps to `StrategySlotConfig` (PRD-23 §3.3). The `modes-config.json` file maps to the unified `strategy-slots.json`. All risk gates apply identically regardless of signal source (scanner, mechanical, ML, manual).

<!-- Consistency pass: aligned with PRD-23 Unified Strategy Engine, 2026-05-07 -->
