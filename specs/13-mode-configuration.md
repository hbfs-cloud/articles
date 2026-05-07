# PRD-13: Mode Configuration System

**Sources**: `data/modes-config.json`, `tools/regime-recalibrate.js`, `portfolio/v1/config-history.json`
**Version**: 2026-05-07
**Status**: Authoritative — implement deterministically from this document.

---

## 1. Overview

The mode configuration system defines 6 independent trading strategies ("modes"), each with a distinct risk profile and parameter set. Modes are stored in `data/modes-config.json` and versioned in `portfolio/v1/config-history.json`. Parameters are recalibrated automatically when market regime changes, sourcing optimal values from `data/backtest-results.json`.

---

## 2. modes-config.json Structure

### 2.1 Top-level schema

```json
{
  "_comment":     "6 modes — RISK-ON v5.2 (2026-05-01). ...",
  "_updated":     "2026-05-01",
  "_version":     "v5.2-20260501",
  "_regime":      "RISK-ON",
  "_prevVersion": "v5.1-20260501",
  "_riskLayer":   "v1.2-20260428",
  "modes": {
    "turbo":   { /* mode object */ },
    "dynamic": { /* mode object */ },
    "balanced": { /* mode object */ },
    "secured":  { /* mode object */ },
    "fortress": { /* mode object */ },
    "tkl":      { /* mode object */ }
  }
}
```

### 2.2 Mode object — all parameters

```json
{
  "label":           "string",       // display name
  "color":           "#hexcode",     // UI color
  "goal":            "string",       // one-line goal
  "riskProfile":     "string",       // Extreme | High | Medium | Low | Conservative | Special
  "tagline":         "string",       // extended description

  // Strategy selection
  "portfolioSize":   1,              // max concurrent open positions [1-15]
  "topN":            1,              // max candidates considered per scan [1-10]
  "minScore":        90,             // minimum signal score to enter [85-95]
  "filterName":      "all",          // strategy filter key: all | momentum_only | mom_bo | breakout_only

  // Rotation
  "rotation":        "aggressive",   // none | daily_max1 | daily_max2 | aggressive

  // Hold duration
  "horizon":         2,              // max hold days [2-10]

  // Take-profit
  "partialTP":       true,           // partial exit at TP1
  "partialTPPct":    0.5,            // fraction sold at TP1 (always 0.5)

  // Stop management
  "trailingStop":    false,          // 1.5R trailing stop after TP1 partial hit
  "maxStopPct":      0,              // max stop distance as % of entry (0 = use signal stop)
  "atrStopMult":     0,              // ATR multiplier for stop cap (0 = disabled)
  "dailyTrailPct":   2,              // daily trailing stop % (0 = disabled)
  "breakevenPct":    0.5,            // move stop to entry after +X% gain (0 = disabled)
  "staleDays":       0,              // exit if no new high for N days (0 = disabled)

  // Entry gates
  "entryGatePct":    0,              // reject if open > signal entry * (1 + X%) (0 = disabled)
  "vwapGate":        true,           // VWAP entry gate (always true in current config)

  // Risk layer v1
  "ddBreakerPct":    4,              // DD circuit breaker % (0 = disabled)
  "sectorCapMax":    1,              // max open positions per sector (0 = disabled)
  "sizingMethod":    "inverse_atr",  // always "inverse_atr"
  "targetRiskPct":   1,              // per-position risk budget %
  "vixKillThreshold": 28,            // halt entries if implied VIX >= this (0 = disabled)
  "correlationCap":  0,              // max pairwise Pearson correlation (0 = disabled)

  // Cross-mode
  "crossModeDedup":  false,          // skip tickers already picked by another mode this day

  // Regime adaptation
  "regimeFilters": {
    "risk_on":        "all",         // filterName override when regime = RISK-ON
    "early_risk_off": "breakout_only",
    "risk_off":       "breakout_only",
    "neutral":        "mom_bo",
    "recovery":       "mom_bo"
  },

  // TKL pool
  "tklPoolEnabled":  true,           // include tkl_pool signals as candidates

  // Position sizing multiplier (applied on top of 1/portfolioSize)
  "positionSizePct": 1.0             // default 1.0; fortress uses 0.5
}
```

---

## 3. The 6 Modes — Production Values (v5.2-20260501, RISK-ON)

### 3.1 Turbo

```json
{
  "label": "Turbo", "color": "#f59e0b",
  "goal": "Maximum Short-Term Alpha", "riskProfile": "Extreme",
  "portfolioSize": 1, "topN": 1, "minScore": 90, "filterName": "all",
  "rotation": "aggressive", "horizon": 2,
  "partialTP": true, "partialTPPct": 0.5,
  "trailingStop": false, "maxStopPct": 0, "atrStopMult": 0,
  "dailyTrailPct": 2, "breakevenPct": 0.5, "staleDays": 0,
  "entryGatePct": 0, "vwapGate": true,
  "ddBreakerPct": 4, "sectorCapMax": 1, "sizingMethod": "inverse_atr",
  "targetRiskPct": 1, "vixKillThreshold": 28, "correlationCap": 0,
  "crossModeDedup": false,
  "regimeFilters": {
    "risk_on": "all", "early_risk_off": "breakout_only",
    "risk_off": "breakout_only", "neutral": "mom_bo", "recovery": "mom_bo"
  },
  "tklPoolEnabled": true
}
```

Notes: `positionSizePct` defaults to 1.0 (field absent = 1.0). Single-position, aggressive rotation means the position is always replaced by a higher-scoring signal. 2% daily trail protects gains intraday.

### 3.2 Dynamic

```json
{
  "label": "Dynamic", "color": "#dc2626",
  "goal": "Maximum Return", "riskProfile": "High",
  "portfolioSize": 1, "topN": 1, "minScore": 90, "filterName": "all",
  "rotation": "aggressive", "horizon": 2,
  "partialTP": false, "partialTPPct": 0.5,
  "trailingStop": false, "maxStopPct": 0, "atrStopMult": 0,
  "dailyTrailPct": 0, "breakevenPct": 0.5, "staleDays": 0,
  "entryGatePct": 0, "vwapGate": true,
  "ddBreakerPct": 4, "sectorCapMax": 1, "sizingMethod": "inverse_atr",
  "targetRiskPct": 1, "vixKillThreshold": 25, "correlationCap": 0,
  "crossModeDedup": false,
  "regimeFilters": {
    "risk_on": "all", "early_risk_off": "breakout_only",
    "risk_off": "breakout_only", "neutral": "mom_bo", "recovery": "mom_bo"
  },
  "tklPoolEnabled": false
}
```

Notes: lower VIX kill (25 vs 28 for turbo). No partial TP — full exit at TP1 or SL. `tklPoolEnabled: false` based on A/B test showing negative Calmar.

### 3.3 Balanced

```json
{
  "label": "Balanced", "color": "#059669",
  "goal": "Risk-Adjusted Growth", "riskProfile": "Medium",
  "portfolioSize": 3, "topN": 3, "minScore": 88, "filterName": "mom_bo",
  "rotation": "daily_max1", "horizon": 5,
  "partialTP": true, "partialTPPct": 0.5,
  "trailingStop": false, "maxStopPct": 0, "atrStopMult": 0,
  "dailyTrailPct": 0, "breakevenPct": 2, "staleDays": 0,
  "entryGatePct": 0, "vwapGate": true,
  "ddBreakerPct": 8, "sectorCapMax": 2, "sizingMethod": "inverse_atr",
  "targetRiskPct": 1, "vixKillThreshold": 28, "correlationCap": 0,
  "crossModeDedup": false,
  "regimeFilters": {
    "risk_on": "mom_bo", "early_risk_off": "mom_bo",
    "risk_off": "breakout_only", "neutral": "mom_bo", "recovery": "mom_bo"
  },
  "tklPoolEnabled": true
}
```

Notes: 3 concurrent positions, H5 horizon. BE lock at +2% (vs 0.5% for turbo). Broader DD breaker (8% vs 4%).

### 3.4 Secured

```json
{
  "label": "Secured", "color": "#7c3aed",
  "goal": "Capital Preservation", "riskProfile": "Low",
  "portfolioSize": 3, "topN": 3, "minScore": 90, "filterName": "mom_bo",
  "rotation": "daily_max1", "horizon": 5,
  "partialTP": true, "partialTPPct": 0.5,
  "trailingStop": false, "maxStopPct": 0, "atrStopMult": 0,
  "dailyTrailPct": 0, "breakevenPct": 2, "staleDays": 0,
  "entryGatePct": 0, "vwapGate": true,
  "ddBreakerPct": 6, "sectorCapMax": 2, "sizingMethod": "inverse_atr",
  "targetRiskPct": 1, "vixKillThreshold": 22, "correlationCap": 0,
  "crossModeDedup": false,
  "regimeFilters": {
    "risk_on": "mom_bo", "early_risk_off": "breakout_only",
    "risk_off": "breakout_only", "neutral": "mom_bo", "recovery": "mom_bo"
  },
  "tklPoolEnabled": false
}
```

Notes: stricter minScore (90) and lower VIX kill (22) vs balanced. Tighter DD breaker (6%). `tklPoolEnabled: false`.

### 3.5 Fortress

```json
{
  "label": "Fortress", "color": "#1d4ed8",
  "goal": "Minimal Drawdown", "riskProfile": "Conservative",
  "portfolioSize": 5, "topN": 5, "minScore": 88, "filterName": "mom_bo",
  "rotation": "none", "horizon": 8,
  "partialTP": true, "partialTPPct": 0.5,
  "trailingStop": false, "maxStopPct": 0, "atrStopMult": 0,
  "dailyTrailPct": 0, "breakevenPct": 2, "staleDays": 0,
  "entryGatePct": 0, "vwapGate": true,
  "ddBreakerPct": 10, "sectorCapMax": 2, "sizingMethod": "inverse_atr",
  "targetRiskPct": 0.5, "vixKillThreshold": 20, "correlationCap": 0,
  "crossModeDedup": false,
  "positionSizePct": 0.5,
  "regimeFilters": {
    "risk_on": "mom_bo", "early_risk_off": "mom_bo",
    "risk_off": "breakout_only", "neutral": "mom_bo", "recovery": "mom_bo"
  },
  "tklPoolEnabled": true
}
```

Notes: **`positionSizePct: 0.5`** — each position is sized at 50% of the standard weight. This halves exposure. No rotation (diversification via 5 concurrent positions). Lowest VIX kill (20). Largest DD tolerance (10%).

### 3.6 TKL

```json
{
  "label": "TKL", "color": "#0891b2",
  "goal": "Thematic & Small-Cap Alpha", "riskProfile": "Special",
  "portfolioSize": 3, "topN": 3, "minScore": 85, "filterName": "mom_bo",
  "rotation": "daily_max1", "horizon": 5,
  "partialTP": true, "partialTPPct": 0.5,
  "trailingStop": false, "maxStopPct": 0, "atrStopMult": 0,
  "dailyTrailPct": 0, "breakevenPct": 1, "staleDays": 0,
  "entryGatePct": 0, "vwapGate": true,
  "ddBreakerPct": 8, "sectorCapMax": 2, "sizingMethod": "inverse_atr",
  "targetRiskPct": 1, "vixKillThreshold": 28, "correlationCap": 0,
  "crossModeDedup": false,
  "regimeFilters": {
    "risk_on": "mom_bo", "early_risk_off": "mom_bo",
    "risk_off": "breakout_only", "neutral": "mom_bo", "recovery": "mom_bo"
  },
  "tklPoolEnabled": true
}
```

Notes: lowest minScore (85) — designed to catch tkl_pool signals. BE at +1%. `tklPoolEnabled: true` is the defining feature (draws from `signals.json#tkl_pool`).

---

## 4. Parameter Reference Table

| Parameter | Turbo | Dynamic | Balanced | Secured | Fortress | TKL |
|---|---|---|---|---|---|---|
| `portfolioSize` | 1 | 1 | 3 | 3 | 5 | 3 |
| `topN` | 1 | 1 | 3 | 3 | 5 | 3 |
| `minScore` | 90 | 90 | 88 | 90 | 88 | 85 |
| `filterName` | all | all | mom_bo | mom_bo | mom_bo | mom_bo |
| `rotation` | aggressive | aggressive | daily_max1 | daily_max1 | none | daily_max1 |
| `horizon` | 2 | 2 | 5 | 5 | 8 | 5 |
| `partialTP` | true | false | true | true | true | true |
| `dailyTrailPct` | 2 | 0 | 0 | 0 | 0 | 0 |
| `breakevenPct` | 0.5 | 0.5 | 2 | 2 | 2 | 1 |
| `ddBreakerPct` | 4 | 4 | 8 | 6 | 10 | 8 |
| `vixKillThreshold` | 28 | 25 | 28 | 22 | 20 | 28 |
| `positionSizePct` | 1.0 | 1.0 | 1.0 | 1.0 | 0.5 | 1.0 |
| `tklPoolEnabled` | true | false | true | false | true | true |
| `crossModeDedup` | false | false | false | false | false | false |

---

## 5. Strategy Filters

```javascript
const STRATEGY_FILTERS_MAP = {
  all:            (strategy) => true,
  momentum_only:  (strategy) => ['momentum', 'pullback'].includes(strategy),
  mom_bo:         (strategy) => ['momentum', 'pullback', 'breakout'].includes(strategy),
  breakout_only:  (strategy) => strategy === 'breakout',
}
```

Regime override: if `regimeFilters[currentRegime]` is set, the mapped filterName replaces the mode's default `filterName` for that scan day. The override is looked up by normalizing the regime label to lowercase with spaces replaced by underscores.

Regime label normalization examples:
- `"RISK-ON"` → `"risk_on"`
- `"EARLY RISK-OFF"` → `"early_risk_off"`
- `"EARLY-RISK-OFF"` → `"early_risk_off"` (after replacing `-` and ` ` with `_`)

---

## 6. Cross-Mode Deduplication

All modes currently have `crossModeDedup: false`. When true, the logic is:

- Processing priority (most conservative first): `fortress → secured → balanced → dynamic → turbo → tkl`
- Shared `crossModePicked = new Set()` across all modes for the same simulation run
- When a mode picks ticker `T` on day `D`, it adds `"D|T"` to `crossModePicked`
- Subsequent modes skip any ticker already in `crossModePicked` for the same day

---

## 7. VIX Kill Switch Logic

The backtest does not have numeric VIX values. Regime labels are mapped to approximate VIX bands:

```javascript
function vixKillTriggered(regime, threshold):
  if !threshold OR !regime: return false
  regimeVix = {
    'RISK-OFF':        32,
    'EARLY RISK-OFF':  24,
    'EARLY-RISK-OFF':  24,
    'NEUTRAL':         18,
    'RISK-ON':         13,
    default:           18,
  }
  return regimeVix[regime.toUpperCase()] >= threshold
```

Result: entries are halted for the entire scan day when triggered. The check uses `priorDay` equity to avoid same-day mark bias.

---

## 8. DD Circuit Breaker Logic

```javascript
// Uses equity curve up to (but NOT including) current day to avoid lookahead
let peakSoFar = 100;
for (let i = 0; i < equityCurve.length - 1; i++) {
  if (equityCurve[i].value > peakSoFar) peakSoFar = equityCurve[i].value;
}
const priorEquity = equityCurve[equityCurve.length - 2]?.value ?? 100;
const currentDD = (peakSoFar - priorEquity) / peakSoFar * 100;
ddBreakerActive = currentDD >= config.ddBreakerPct;
```

Requires `equityCurve.length >= 2`. If fewer points: breaker inactive.

---

## 9. Regime Recalibration System

**Source**: `tools/regime-recalibrate.js`

### 9.1 Overview

Detects market regime changes by reading recent scanner history and proposes parameter updates sourced from `data/backtest-results.json`. All changes are append-only.

### 9.2 Inputs

- `scanner/*/signals.json` (last 7 scans, configurable via `--window=N`)
- `data/modes-config.json` (active configuration)
- `data/backtest-results.json` (advisor recommendations from latest sweep)

### 9.3 Regime detection algorithm

```
1. Read last N scanner directories (default N=7, chronological)
2. Extract `regime` field from each signals.json
3. Compute dominant regime = mode of all extracted regime values
4. Compute stability = count of trailing consecutive days with same regime as dominant
   Example: [RISK-ON, RISK-ON, RISK-ON, NEUTRAL, RISK-ON] → dominant=RISK-ON, stability=1

5. Trigger condition:
   dominant != activeCfg._regime
   AND stability >= STABILITY_DAYS (default 3)
```

Stability counter definition: count backwards from the most recent scan. Increment while `regime[i] === dominant`. Stop at first mismatch.

### 9.4 Advisor recommendation sourcing

```javascript
function readAdvisorRecommendations():
  results = JSON.parse(data/backtest-results.json)
  out = {}
  for mode in ['turbo', 'dynamic', 'balanced', 'secured', 'fortress', 'tkl']:
    out[mode] = results['advisor_' + mode]
             || results['advisor_' + mode + '_relaxed']
             || null
  return out
```

Priority: strict advisor first, relaxed fallback.

### 9.5 Proposal structure

```json
{
  "timestamp":    "2026-05-07T23:00:00Z",
  "new_regime":   "RISK-OFF",
  "prev_regime":  "RISK-ON",
  "prev_version": "v5.2-20260501",
  "new_version":  "v5.3",
  "deltas": {
    "turbo": {
      "status": "change",
      "diff": {
        "minScore":  { "from": 90, "to": 90 },
        "horizon":   { "from": 2,  "to": 3  }
      }
    },
    "dynamic": {
      "status": "no_change",
      "diff": {}
    },
    "balanced": {
      "status": "no_advisor"
    }
  }
}
```

`status` values:
- `change`: advisor differs from current config — fields listed in `diff`
- `no_change`: advisor matches current config exactly
- `no_advisor`: no advisor data found for this mode

### 9.6 Version bumping

```javascript
function bumpVersion(v):
  // v is like "v5.2-20260501" or "v5" or "v5.2"
  // Extract major.minor, increment minor
  match = v.match(/^v?(\d+)(?:\.(\d+))?/)
  if !match: return 'v1'
  major = parseInt(match[1])
  minor = match[2] ? parseInt(match[2]) : 0
  return `v${major}.${minor + 1}`
  // "v5.2-20260501" → "v5.3"
  // "v5" → "v5.1"
```

### 9.7 Apply operation

When `--apply` flag is passed:

1. Deep-copy `activeCfg`
2. For each `mode` where `delta.status === 'change'`: apply `change.to` values to `newCfg.modes[mode]`
3. Update top-level metadata:
   ```javascript
   newCfg._regime       = proposal.new_regime
   newCfg._prevVersion  = activeCfg._version
   newCfg._version      = proposal.new_version
   newCfg._updated      = proposal.timestamp.slice(0, 10)
   newCfg._comment      = `6 modes — ${new_regime} ${new_version} (regime recalibration ${date}). Previous: ${prev_version}.`
   ```
4. Write `data/modes-config.json` (overwrite with new active config)
5. Append to `portfolio/v1/config-history.json` (see §10)

Backup is created before apply: `.backup-history-{Date.now()}/` containing copies of both files.

### 9.8 CLI flags

```
node tools/regime-recalibrate.js                    # dry run (detect + report only)
node tools/regime-recalibrate.js --apply            # apply if regime changed
node tools/regime-recalibrate.js --force --apply    # apply even if no regime change
node tools/regime-recalibrate.js --stability=N      # override stability threshold (default 3)
node tools/regime-recalibrate.js --window=N         # number of recent scans to read (default 7)
```

---

## 10. Config History (Append-Only)

**File**: `portfolio/v1/config-history.json`

### 10.1 Schema

```json
{
  "updatedAt": "2026-05-07T23:00:00Z",
  "versions": [
    {
      "id":        "v1-20260215",
      "timestamp": "2026-02-15T00:00:00Z",
      "regime":    "MIXED",
      "triggered_by": "initial",
      "config": {
        "turbo":    { /* full mode object at this version */ },
        "dynamic":  { /* ... */ },
        "balanced": { /* ... */ },
        "secured":  { /* ... */ },
        "fortress": { /* ... */ },
        "tkl":      { /* ... */ }
      }
    },
    {
      "id":           "v5.3",
      "timestamp":    "2026-05-07T23:00:00Z",
      "regime":       "RISK-OFF",
      "prev_version": "v5.2-20260501",
      "triggered_by": "regime_recalibrate",
      "config": { /* ... */ }
    }
  ]
}
```

### 10.2 Append semantics

- NEVER overwrite or modify existing entries in `versions[]`
- Each `--apply` run pushes one new entry to the END of `versions[]`
- `updatedAt` is updated to current ISO timestamp
- The `config` object in each entry is the COMPLETE modes snapshot at that version (all 6 modes, all fields)
- `triggered_by`: `"initial"` for the first entry, `"regime_recalibrate"` for automated runs, `"manual"` for `--force` applies

### 10.3 Version chain

```
versions[0].id = "v1-20260215"            ← initial
versions[1].id = "v2.0", .prev_version = "v1-20260215"
versions[2].id = "v2.1", .prev_version = "v2.0"
...
versions[N].id = "v5.3", .prev_version = "v5.2-20260501"
```

`modes-config.json._prevVersion` always equals the `id` of the previous history entry.

---

## 11. Modes-Config Versioning Fields

| Field | Type | Meaning |
|---|---|---|
| `_version` | string | Current active version ID (e.g. `v5.2-20260501`) |
| `_prevVersion` | string | ID of previous version (links to config-history) |
| `_regime` | string | Market regime these params were optimized for |
| `_updated` | string | ISO date of last update (`YYYY-MM-DD`) |
| `_riskLayer` | string | Risk layer version these params use |
| `_comment` | string | Human-readable changelog summary |

---

## 12. Regime Labels

Valid regime values (as produced by scanner and stored in `signals.json`):

| Label | VIX proxy | Meaning |
|---|---|---|
| `RISK-ON` | 13 | Low volatility, broad advance |
| `NEUTRAL` | 18 | Mixed signals |
| `EARLY RISK-OFF` | 24 | Rising volatility, defensive rotation |
| `RISK-OFF` | 32 | High volatility, broad decline |
| `RECOVERY` | 15 | Post-correction stabilization |

Regime is read from `signals.json#regime` (set by Claude during scanner generation).

---

## 13. Relationship to sweep.js

`sweep.js` reads `modes-config.json` to determine:
1. Which parameter combos to "freeze" (compute stats for current mode configs)
2. The dedup priority order for cross-mode simulation
3. `positionSizePct` for each mode's position weight

`sweep.js` writes `data/backtest-results.json` with `advisor_<mode>` fields.
`regime-recalibrate.js` reads those advisor fields to propose recalibration.
`regime-recalibrate.js --apply` writes back to `modes-config.json` and appends to `config-history.json`.

This is a closed loop: `modes-config → sweep → backtest-results → regime-recalibrate → modes-config`.

---

## 14. Telegram Topics per Mode

| Mode | Topic ID | Env var |
|---|---|---|
| turbo | 89 | `TELEGRAM_TOPIC_TURBO` |
| dynamic | 89 | `TELEGRAM_TOPIC_DYNAMIC` |
| balanced | 90 | `TELEGRAM_TOPIC_BALANCED` |
| secured | 91 | `TELEGRAM_TOPIC_SECURED` |
| fortress | 91 | `TELEGRAM_TOPIC_FORTRESS` |
| tkl | 1064 | `TELEGRAM_TOPIC_TKL` |

---

## 15. StrategySlot Migration

> **Note**: Modes are a LEGACY concept in the unified platform. This section documents how the 6 modes map to StrategySlots in the new architecture. All existing mode parameter data below (§3, §4) is preserved — it becomes the default preset configuration for each StrategySlot.

### 15.1 Concept Mapping

| Legacy concept | StrategySlot equivalent |
|---|---|
| A named mode (e.g. `balanced`) | A StrategySlot with `type: "scanner"` and `presetId: "balanced"` |
| `modes-config.json` entry | StrategySlot configuration (parameters stored per-slot, per-user) |
| 6 fixed modes | Up to N user-configurable StrategySlots (Free: 2, Pro: unlimited) |
| Mechanical strategy | StrategySlot with `type: "mechanical"` — distinct parameter schema |

### 15.2 Scanner-Type StrategySlot

Each of the 6 modes (turbo, dynamic, balanced, secured, fortress, tkl) becomes a **preset template** that users can instantiate as a `type: "scanner"` StrategySlot. The full parameter set in §2.2 and §3 is preserved as the preset's default configuration.

```json
{
  "strategySlotId": "uuid",
  "userId":         "uuid",
  "type":           "scanner",
  "presetId":       "balanced",        // one of the 6 preset names
  "label":          "My Balanced",     // user-defined display name
  "brokerId":       "uuid",
  "config":         { /* full mode object from §2.2 — user may override fields */ }
}
```

### 15.3 Mechanical-Type StrategySlot

Mechanical strategies use `type: "mechanical"` with a distinct parameter schema (rules-based entry/exit logic, fixed position sizing, no scanner dependency). See PRD-23 §8 for the unified StrategySlot configuration schema covering both types.

### 15.4 Backward Compatibility

- The `modes-config.json` file and `tools/gen-status-page.js` continue to use mode names during the migration period.
- The Scanner Status page (`scanner/status/`) renders per-mode panels using the legacy mode keys as StrategySlot IDs.
- Telegram topics (§14) are preserved as-is — each topic maps 1:1 to a preset StrategySlot.
- `crossModeDedup` logic (§6) applies across StrategySlots of the same type within the same user's account.

---

## 16. Public API Endpoints per Mode

Generated by `tools/gen-api.js` into `portfolio/v1/{mode}/`:

| Endpoint | Content |
|---|---|
| `signals.json` | Today's scanner signals for this mode |
| `positions.json` | Current open positions |
| `equity.json` | Equity curve |
| `orders.json` | Pending orders to place |
| `actions.json` | Close-now actions |
| `trades.json` | Historical closed trades |
| `risk.json` | Risk metrics (VaR, stress, correlation) |
| `winning-streaks.json` | Streak analytics |
| `all.json` | Combined all of the above |

Root `/portfolio/v1/` endpoints point to `balanced` mode for backward compatibility.
