# PRD-04: Portfolio Simulation Engine

**Source**: `tools/sweep.js` (~1877 lines)
**Version**: 2026-05-07
**Status**: Authoritative — implement deterministically from this document.

---

## 1. Overview

The portfolio simulation engine runs a walk-forward backtest over all historical scanner signals to compute strategy performance metrics and optimal mode parameters. It operates in two modes:

- **Default (`node tools/sweep.js`)**: frozen-only mode — recomputes metrics for current `modes-config.json` parameters without running a full grid search.
- **Full sweep (`--full-sweep`)**: exhaustive grid search across ~311K parameter combinations to discover optimal parameters per mode.

---

## 2. Input Data

### 2.1 Scanner directories

```
scanner/YYYYMMDD/          # each directory = one scan session
  signals.json             # top-10 signals published by Claude
  index.html               # fallback if signals.json absent
```

Scan directories are filtered by:
- Pattern: `/^\d{8}(-\d+)?$/` (8-digit date, optional suffix)
- Date cutoff: `>= 2026-02-15` (or `--from=YYYY-MM-DD` override)
- Sorted chronologically ascending

### 2.2 signals.json schema

```json
{
  "scan_date": "2026-05-07",
  "regime": "RISK-ON",
  "signals": [
    {
      "ticker": "NVDA",
      "score": 92,
      "strategy": "Momentum",
      "entry": 120.50,
      "stop": 115.00,
      "tp1": 130.00,
      "tp2": 140.00,
      "sector": "Technology"
    }
  ],
  "tkl_pool": [
    {
      "ticker": "AAPL",
      "score": 99,
      "strategy": "Breakout",
      "entry": 195.00,
      "stop": 188.00,
      "tp1": 208.00,
      "tp2": 222.00
    }
  ]
}
```

Validation rules (reject setup if any fail):
- `entry > 0` AND `stop > 0` AND `tp1` present
- `stop < entry` (long-only; short positions not supported)
- `tp1 > entry`

### 2.3 TKL Pool ingestion

Controlled by `TKL_POLICY` env var or `--tkl-policy=` arg:
- `off`: published Top-10 signals only
- `hybrid` (default): Top-10 + `tkl_pool` merged into shared candidate pool
- `isolated`: Top-10 for non-tkl modes; tkl mode also gets `tkl_pool`

**TKL Score Normalization**: `tkl_pool` entries often arrive with a fixed ceiling score (e.g. 99), which is useless for sorting. Replace with a composite derived score:

```
rr = (tp1 - entry) / max(1e-6, entry - stop)

stratBonus:
  breakout   → 4
  momentum   → 4
  pre_squeeze → 3
  pullback   → 3
  short_squeeze / unknown → 2

rrBonus = clamp(0, 6, (rr - 1.5) * 4)
  # rr=1.5 → 0, rr=2.0 → +2, rr=2.5 → +4, rr≥3.0 → +6

score = clamp(85, 95, round(85 + stratBonus * 0.4 + rrBonus))
```

Main `signals` entries keep their Claude-curated score as-is.

### 2.4 Strategy detection

```javascript
const STRAT_PATTERNS = {
  short_squeeze: /short.?squeeze/i,
  pre_squeeze:   /pre.?squeeze/i,
  breakout:      /breakout/i,
  momentum:      /momentum/i,
  pullback:      /pullback/i,
}
// First match wins; default = 'momentum'
```

### 2.5 Strategy filters

```javascript
const STRATEGY_FILTERS_MAP = {
  all:            () => true,
  momentum_only:  s => ['momentum', 'pullback'].includes(s),
  mom_bo:         s => ['momentum', 'pullback', 'breakout'].includes(s),
  breakout_only:  s => s === 'breakout',
}
```

---

## 3. Price Data

Price data is fetched from Yahoo Finance for each unique ticker before simulation begins. Each ticker gets up to 60 trading days of OHLC bars via:

```
GET https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=60d
Headers: { 'User-Agent': 'Mozilla/5.0' }
Timeout: 8000ms
```

Response parsing:
```javascript
j.chart.result[0]
  .timestamp[]           // Unix seconds
  .indicators.quote[0]
    .open[], .high[], .low[], .close[]
```

Stored as: `priceCache[ticker] = { 'YYYY-MM-DD': { open, high, low, close } }`

HTTP 429 / 5xx: skip ticker, log warning.
Batch concurrency: max 6 parallel fetches.

---

## 4. ATR Computation

```javascript
function computeATR(priceHistory, beforeDate, periods = 14):
  dates = sorted keys of priceHistory where date < beforeDate, last (periods+1) dates
  if dates.length < 2: return null
  sum = 0, count = 0
  for i in 1..dates.length-1:
    prev = priceHistory[dates[i-1]]
    cur  = priceHistory[dates[i]]
    TR = max(cur.high - cur.low,
             abs(cur.high - prev.close),
             abs(cur.low  - prev.close))
    sum += TR; count++
  return count > 0 ? sum / count : null
```

---

## 5. Single Trade Simulation

`simulateTrade(setup, scanDate, priceHistory, config)` → trade object or `null`

### 5.1 Entry logic

```
entryDate = scanDate   # scanner folder IS the entry day (generated D-1 at 23h)
entryBar  = priceHistory[entryDate]
if !entryBar: return null
actualEntry = entryBar.open
if actualEntry <= 0: return null
```

**Entry gate filter** (if `entryGatePct > 0`):
```
if actualEntry > setup.entry * (1 + entryGatePct / 100): return null
```

**VWAP gate** (if `vwapGate = true`):
```
vwapRef = (prevBar.high + prevBar.low + prevBar.close) / 3
  # prevBar = bar from the day BEFORE entryDate (no lookahead)
  # If no prevBar exists: skip gate entirely, proceed normally

if actualEntry > vwapRef * 1.01: return null   # gap-up trap — reject

entryPrice = clamp(actualEntry, entryBar.low, vwapRef)
  # i.e. min(actualEntry, vwapRef) clamped to >= day_low
```

If `vwapGate = false`, `entryPrice = actualEntry`.

### 5.2 Stop-loss cap

```
riskPerUnit = setup.entry - setup.stop
if riskPerUnit <= 0: return null

STRATEGY_STOP_CAP = { all strategies: 10% }

effectiveMaxStop = min(maxStopPct || 100, STRATEGY_STOP_CAP[strategy])
if effectiveMaxStop > 0:
  maxRisk = entryPrice * effectiveMaxStop / 100
  riskPerUnit = min(riskPerUnit, maxRisk)

# ATR-based stop cap:
if atrStopMult > 0:
  atr = computeATR(priceHistory, entryDate)
  if atr != null:
    atrRisk = atr * atrStopMult
    riskPerUnit = min(riskPerUnit, atrRisk)

actualStop = entryPrice - riskPerUnit
actualTp1  = entryPrice + riskPerUnit * (setup.tp1 - setup.entry) / riskPerUnit
  # actually: entryPrice + (setup.tp1 - setup.entry)
actualTp2  = setup.tp2 ? entryPrice + (setup.tp2 - setup.entry) : null
```

### 5.3 Day-by-day exit loop

Iterate each trading day from `entryDate` (inclusive) up to `entryDate + horizonDays`:

```
currentStop = actualStop
partialRealized = 0        # % gain captured at TP1
breakevenActivated = false
stalePeak = entryBar.high  # for stale exit tracking
staleDayCount = 0

for each day d in sorted priceHistory where d >= entryDate:
  if d > horizonDate: break
  bar = priceHistory[d]

  # 1. Stop-loss check (intraday LOW)
  if bar.low <= currentStop:
    status = 'sl'
    exitPrice = currentStop
    pnlPct = (currentStop - entryPrice) / entryPrice * 100 + partialRealized
    break

  # 2. TP1 check (intraday HIGH) — only if not already partially exited
  if bar.high >= actualTp1 AND partialRealized == 0:
    if partialTP:
      partialRealized = (actualTp1 - entryPrice) / entryPrice * partialTPPct * 100
      if trailingStop:
        currentStop = entryPrice   # move stop to breakeven
      # continue — remaining (1 - partialTPPct) fraction still open
    else:
      status = 'tp1'; exitPrice = actualTp1
      pnlPct = (actualTp1 - entryPrice) / entryPrice * 100
      break

  # 3. TP2 check (intraday HIGH) — only if actualTp2 exists
  if actualTp2 AND bar.high >= actualTp2:
    status = 'tp2'; exitPrice = actualTp2
    remainingFrac = 1 - partialTPPct  # if partial TP already hit
    pnlPct = partialRealized + (actualTp2 - entryPrice) / entryPrice * remainingFrac * 100
    break

  # 4. Trailing stop (1.5R trail from highest high, only after TP1 partial hit)
  if trailingStop AND partialRealized > 0:
    trailLevel = bar.high - riskPerUnit * 1.5
    if trailLevel > currentStop: currentStop = trailLevel

  # 5. Daily trailing stop (if dailyTrailPct > 0)
  if dailyTrailPct > 0:
    trailLevel = bar.close * (1 - dailyTrailPct / 100)
    if trailLevel > currentStop: currentStop = trailLevel

  # 6. Breakeven trigger (if breakevenPct > 0)
  if breakevenPct > 0 AND NOT breakevenActivated:
    currentGain = (bar.high - entryPrice) / entryPrice * 100
    if currentGain >= breakevenPct:
      breakevenActivated = true
      if entryPrice > currentStop: currentStop = entryPrice

  # 7. Stale exit (if staleDays > 0)
  if staleDays > 0:
    if bar.high > stalePeak:
      stalePeak = bar.high
      staleDayCount = 0
    else:
      staleDayCount++
    if staleDayCount >= staleDays:
      status = 'expired'
      exitPrice = bar.close
      pnlPct = (bar.close - entryPrice) / entryPrice * 100 + partialRealized
      break

# 8. Horizon expiry (loop ended without exit)
if no exit found:
  lastBar = last available bar <= horizonDate
  status = 'expired'
  exitPrice = lastBar.close
  pnlPct = (lastBar.close - entryPrice) / entryPrice * 100 + partialRealized
```

**Ambiguous bar handling**: if a single bar's LOW hits SL AND HIGH hits TP simultaneously, set `trade.ambiguous = true`. Conservative rule: SL takes priority.

### 5.4 Trade object schema

```json
{
  "ticker": "NVDA",
  "strategy": "momentum",
  "score": 92,
  "scanDate": "2026-05-07",
  "entryDate": "2026-05-07",
  "exitDate": "2026-05-09",
  "actualEntry": 120.50,
  "actualStop": 115.00,
  "actualTp1": 130.00,
  "actualTp2": 140.00,
  "exitPrice": 130.00,
  "status": "tp1",
  "pnlPct": 7.88,
  "holdDays": 2,
  "regime": "RISK-ON",
  "source": "signals",
  "ambiguous": false,
  "configVersion": "v5.2-20260501"
}
```

Valid `status` values: `tp1`, `tp1_partial`, `tp2`, `sl`, `expired`, `rotated`, `breakeven`, `trail`. Suffix `_amb` may be appended for ambiguous bars.

---

## 6. Portfolio Simulation Loop

`simulatePortfolio(allTrades, scans, config)` → metrics object

### 6.1 Configuration object

```javascript
{
  portfolioSize: int,          // max concurrent open positions
  topN: int,                   // max candidates to consider per scan
  minScore: number,            // minimum score filter (applied before simulation)
  rotation: string,            // 'none' | 'daily_max1' | 'daily_max2' | 'aggressive'
  strategyFilter: function,    // filter fn from STRATEGY_FILTERS_MAP
  horizonDays: int,            // max hold days
  partialTP: boolean,
  partialTPPct: number,        // fraction sold at TP1 (default 0.5)
  trailingStop: boolean,
  maxStopPct: number,          // 0 = no cap
  atrStopMult: number,         // 0 = disabled
  dailyTrailPct: number,       // 0 = disabled
  breakevenPct: number,        // 0 = disabled
  staleDays: int,              // 0 = disabled
  entryGatePct: number,        // 0 = disabled
  vwapGate: boolean,
  positionSizePct: number,     // default 1.0; fortress uses 0.5
  ddBreakerPct: number,        // 0 = disabled
  sectorCapMax: int,           // 0 = disabled
  sizingMethod: string,        // 'inverse_atr'
  targetRiskPct: number,
  vixKillThreshold: number,    // 0 = disabled
  correlationCap: number,      // 0 = disabled
  crossModeDedup: boolean,
  crossModePicked: Set,        // shared across modes (passed by reference)
  regimeFilters: object,       // { regime_label: filterName }
  tklPoolEnabled: boolean,     // gate tkl_pool candidates for this mode
  excludeSources: string[],    // e.g. ['tkl_pool'] to exclude by source
}
```

### 6.2 Position weight

```
scanWeight = (1 / portfolioSize) * positionSizePct
```

Inverse-ATR adjustment (when `sizingMethod === 'inverse_atr'`):

```
SIZING_REF_STOP_PCT = 0.05   # 5% reference stop
SIZING_MIN_FACTOR   = 0.5
SIZING_MAX_FACTOR   = 1.5

stopPct = (actualEntry - actualStop) / actualEntry
if stopPct > 0:
  adj = clamp(SIZING_MIN_FACTOR, SIZING_MAX_FACTOR, SIZING_REF_STOP_PCT / max(stopPct, 0.005))
  candWeight = scanWeight * adj
else:
  candWeight = scanWeight
```

### 6.3 Main simulation loop

Build `allDays`: sorted union of all calendar dates where ANY ticker has a price bar, from the earliest scan date to today.

For each day `d` in `allDays`:

**Step A — process exits for open positions**

For each open position `pos`:
1. Run exit logic (SL / TP1 / TP2 / breakeven / trail / stale / horizon) against `priceCache[ticker][d]`
2. If exit triggered:
   - Append trade to `closedTrades`
   - If status = `sl`: record `slCooldown.set(ticker, d)` (10 business-day re-entry ban)
   - Remove from `openPositions`

**Step B — equity mark-to-market**

```
realizedPnl   += sum of pnlPct * weight for all trades closed on/before d
unrealizedPnl  = sum of (close[d] - actualEntry) / actualEntry * 100 * weight
                 for all positions still open
dailyEquity    = 100 + realizedPnl + unrealizedPnl
equityCurve.push({ date: d, value: round(dailyEquity, 2) })
```

**Step C — on scan dates: rotation then entries**

Only executes on days in `scanDateSet` (the set of all scan directory dates).

**Regime-aware filter override**:
```
activeFilter = strategyFilter   # default
if config.regimeFilters AND regimeByDate[d]:
  regimeKey = regimeByDate[d].toLowerCase().replace(' ', '_')
  if config.regimeFilters[regimeKey]:
    activeFilter = STRATEGY_FILTERS_MAP[config.regimeFilters[regimeKey]]
```

**VIX kill switch**:
```
function vixKillTriggered(regime, threshold):
  if !threshold OR !regime: return false
  regimeVix = {
    'RISK-OFF':        32,
    'EARLY RISK-OFF':  24,
    'EARLY-RISK-OFF':  24,
    'NEUTRAL':         18,
    'RISK-ON':         13,
    default:           18,
  }[regime.toUpperCase()]
  return regimeVix >= threshold
```

**DD circuit breaker**:
```
ddBreakerActive = false
if config.ddBreakerPct AND equityCurve.length >= 2:
  peakSoFar = max(equityCurve[0..len-2].value)   # exclude current day
  currentDD = (peakSoFar - equityCurve[len-2].value) / peakSoFar * 100
  if currentDD >= config.ddBreakerPct:
    ddBreakerActive = true
```

**Rotation** (if `rotation !== 'none'` AND open positions exist AND candidates available):

```
rotationLimit = {
  'daily_max1':  1,
  'daily_max2':  2,
  'aggressive':  portfolioSize,  # replace any position with better score
}[rotation]

rotated = 0
for each candidate (sorted by score desc) not already open:
  if rotated >= rotationLimit: break
  worstOpen = min(openPositions by score)
  if candidate.score > worstOpen.trade.score:
    # Close worst
    worstOpen.trade.status = 'rotated'
    worstOpen.trade.exitDate = d
    worstOpen.trade.exitPrice = priceCache[worst.ticker][d].close
    worstOpen.trade.pnlPct = (exitPrice - actualEntry) / actualEntry * 100 * weight
    closedTrades.push(worstOpen.trade)
    openPositions.remove(worstOpen)
    slotsAvailable++
    rotated++
```

**New entries** (if `!vixKill AND !ddBreakerActive`):

For each candidate (sorted by score desc, limited to `topN`):
```
if openPositions.length >= portfolioSize: break
if openTickers.has(ticker): skip
if slCooldown within 10 biz days: skip
if crossModeDedup AND crossModePicked.has(`${d}|${ticker}`): skip
if sectorCapMax > 0 AND sectorCounts[sector] >= sectorCapMax: skip
if correlationCap > 0 AND maxCorrToOpen(cand, openPositions, 60) > correlationCap: skip
if activeFilter(strategy) == false: skip
if score < minScore: skip
if tklPoolEnabled == false AND source == 'tkl_pool': skip

# ETF at 52-week high penalty
if sector.startsWith('ETF-'):
  yearHigh = max(priceHistory[last 252 days].high)
  if actualEntry >= yearHigh * 0.98:
    score -= 5
    if score < minScore: skip

# Simulate trade
trade = simulateTrade(setup, d, priceCache[ticker], config)
if trade == null: skip

openPositions.push({ trade, weight: candWeight })
openTickers.add(ticker)
sectorCounts[sector]++
if crossModeDedup: crossModePicked.add(`${d}|${ticker}`)
```

---

## 7. Walk-Forward Validation

Split scan dates chronologically:
```
allScanDates = sorted array of all scan directory dates
cutIdx = floor(allScanDates.length * 0.70)
inSampleDates  = Set(allScanDates[0..cutIdx-1])    # first 70%
outSampleDates = Set(allScanDates[cutIdx..end])     # last 30%
```

For the top 5 configs by Sharpe from full-sweep:
1. Simulate on `inSampleDates` only → `isMetrics`
2. Simulate on `outSampleDates` only → `osMetrics`
3. Compute degradation: `(1 - osMetrics.sharpe / isMetrics.sharpe) * 100`

---

## 8. Metrics Computation

`computeStatsFromTrades(closedTrades, portfolioSize, positionSizePct, modeId)` → stats object

### 8.1 Resolved statuses

A trade is "resolved" (closed) if its `status` (stripped of `_amb` suffix) is in:
`['tp1', 'tp1_partial', 'tp2', 'sl', 'expired', 'rotated', 'breakeven', 'trail']`

Trades still `open` are excluded from win/loss stats but included in equity via MtM.

### 8.2 Equity curve

```
equity = 100
for each resolved trade, sorted by exitDate asc:
  equity += trade.pnlPct * trade.weight
  equityCurve.push({ date: trade.exitDate, value: round(equity, 2) })

# MtM-inclusive final equity:
finalEquity = 100 + realizedPnl + unrealizedPnl
returnTotal = round(finalEquity - 100, 2)
```

### 8.3 Max drawdown

```
peak = 100
maxDD = 0
for each { value } in equityCurve:
  if value > peak: peak = value
  dd = peak - value
  if dd > maxDD: maxDD = dd
# maxDD is stored as positive number (e.g. 8.5 means -8.5%)
```

### 8.4 Win rate and profit factor

```
wins   = resolved where pnlPct > 0
losses = resolved where pnlPct <= 0

winRate      = wins.length / resolved.length * 100  (rounded to 1dp)
grossWin     = sum(wins.pnlPct)
grossLoss    = abs(sum(losses.pnlPct))
profitFactor = grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? 99 : 0)
```

### 8.5 Return/DD ratio (legacy)

```
returnDDRatio = maxDD > 0 ? returnTotal / maxDD : (returnTotal > 0 ? 99 : 0)
# Named "returnDDRatio" in code — was previously misnamed "sharpe". Keep for backward compat.
```

### 8.6 True Sharpe ratio

```
# From equityCurve values array:
dailyRet = [(values[i] - values[i-1]) / values[i-1] for i in 1..len-1]
  # Only computed when values.length > 2

mean = sum(dailyRet) / dailyRet.length
variance = sum((r - mean)^2 for r in dailyRet) / (dailyRet.length - 1)  # sample variance
stdev = sqrt(variance)

sharpe = stdev > 0 ? round(sqrt(252) * mean / stdev, 2) : 0
# Risk-free rate = 0
```

### 8.7 Calmar ratio

```
dayCount  = allDays.length || 1
annReturn = returnTotal * (252 / dayCount)
calmar    = maxDD > 0 ? round(annReturn / maxDD, 2) : 0
```

### 8.8 Sortino ratio

```
negReturns  = resolved.filter(t => t.pnlPct < 0).map(t => t.pnlPct)
downsideDev = negReturns.length > 1
  ? sqrt(sum(r^2 for r in negReturns) / negReturns.length)
  : 1
sortino = round(returnTotal / downsideDev, 2)
```

### 8.9 R² (equity curve linearity)

Regress equity curve values against sequential indices [0..n-1]:

```
n = values.length
xMean = (n - 1) / 2
yMean = sum(values) / n
ssXY = sum((i - xMean) * (values[i] - yMean))
ssXX = sum((i - xMean)^2)
ssYY = sum((values[i] - yMean)^2)
r2   = ssXX > 0 AND ssYY > 0 ? (ssXY / (ssXX * ssYY))^2 : 0   # wait — correct formula:
r2   = ssXX > 0 AND ssYY > 0 ? (ssXY^2) / (ssXX * ssYY) : 0
```

### 8.10 stats object schema

```json
{
  "returnTotal": 23.5,
  "maxDD": 8.2,
  "winRate": 62.5,
  "profitFactor": 1.85,
  "sharpe": 1.42,
  "returnDDRatio": 2.86,
  "calmar": 1.15,
  "sortino": 2.10,
  "r2": 0.87,
  "avgWin": 6.2,
  "avgLoss": -3.8,
  "avgHold": 3.2,
  "trades": 48,
  "wins": 30,
  "losses": 18,
  "equityCurve": [
    { "date": "2026-02-18", "value": 102.30 }
  ],
  "closedTrades": [ /* full trade objects */ ]
}
```

---

## 9. Grid Search (--full-sweep)

### 9.1 Grid dimensions

| Dimension | Values (full) | Values (--quick) |
|---|---|---|
| `portfolioSize` | [1, 2, 3, 4, 5, 8, 10, 15] | [1, 3, 5] |
| `topN` | [1, 2, 3, 4, 5, 8, 10] | [1, 2] |
| `minScore` | [85, 90] | [85] |
| `horizon` | [2, 3, 5, 8, 10, 15] | [5, 15] |
| `filterName` | [all, momentum_only, mom_bo, breakout_only] | same |
| `rotation` | [none, daily_max1, aggressive] | same |
| `partialTP` | [false, true] | same |
| `partialTPPct` | [0.5] | same |
| `trailingStop` | [false, true] | same |
| `maxStopPct` | [0, 2, 3, 5, 7] | same |
| `atrStopMult` | [0, 0.5, 1, 1.5, 2] | same |
| `dailyTrailPct` | [0, 1, 2, 3] | same |
| `breakevenPct` | [0, 0.5, 1] | same |
| `staleDays` | [0, 2] | same |
| `entryGatePct` | [0, 3] | same |

**VWAP gate**: always ON (proven +29% total PnL improvement) — not grid-searched.

Total combos (full): ~311K

Minimum trades filter: configs with fewer than `max(10, portfolioSize * 3)` resolved trades are excluded from ranking.

### 9.2 Sharding

Parallelizable via `SWEEP_SHARD` / `SWEEP_SHARDS` env vars:
```bash
SWEEP_SHARD=0 SWEEP_SHARDS=4 node tools/sweep.js --full-sweep  # shard 0 of 4
```

Each shard processes `portfolioSizes[i % SWEEP_SHARDS === SWEEP_SHARD]`.

### 9.3 Ranking

Four independent ranked lists from all configs:

```
top20_sharpe:    top 20 by sharpe desc
top20_return:    top 20 by returnTotal desc
top20_calmar:    top 20 by calmar desc
top20_composite: top 20 by (sharpe * 0.4 + calmar * 0.3 + winRate/100 * 0.3) desc
```

### 9.4 Per-mode advisor selection

For each mode, the advisor is the best config matching the mode's risk profile constraints:

| Mode | Strict constraints | Relaxed fallback |
|---|---|---|
| turbo | portfolioSize <= 2, minScore >= 90, horizon <= 3 | portfolioSize <= 3, horizon <= 5 |
| dynamic | portfolioSize <= 2, horizon <= 3 | portfolioSize <= 3, horizon <= 5 |
| balanced | portfolioSize 2-5, horizon 3-8 | portfolioSize 1-5, horizon 2-10 |
| secured | portfolioSize 2-5, horizon 4-8, winRate >= 55 | portfolioSize 1-5, horizon 3-10 |
| fortress | portfolioSize 3-5, horizon 5-10, maxDD <= 10 | portfolioSize 2-5, horizon 3-15 |
| tkl | portfolioSize >= 2, tklPoolEnabled | portfolioSize >= 1 |

Fallback: if `advisor_<mode>` has no strict match, use `advisor_<mode>_relaxed`.

---

## 10. Output Files

### 10.1 data/backtest-trades.json

Array of all simulated trades (per current mode configs). Schema = trade object from §5.4.

Updated by the frozen-only pass (default run) and full-sweep.

### 10.2 data/backtest-results.json

```json
{
  "generated_at": "2026-05-07T23:00:00Z",
  "scan_range": { "from": "2026-02-15", "to": "2026-05-07", "scans": 52 },
  "universe": { "tickers": 180, "total_setups": 520, "fetched": 175 },
  "walk_forward": { "in_sample_scans": 36, "out_sample_scans": 16 },
  "grid": {
    "portfolio_sizes": [1,2,3,4,5,8,10,15],
    "top_ns": [1,2,3,4,5,8,10],
    "min_scores": [85, 90],
    "horizons": [2,3,5,8,10,15],
    "strategies": ["all","momentum_only","mom_bo","breakout_only"],
    "rotations": ["none","daily_max1","aggressive"],
    "tp_modes": [false, true],
    "trail_modes": [false, true],
    "max_stop_pcts": [0,2,3,5,7],
    "atr_stop_mults": [0,0.5,1,1.5,2],
    "daily_trail_pcts": [0,1,2,3],
    "breakeven_pcts": [0,0.5,1],
    "stale_days": [0,2],
    "tp_pcts": [0.5],
    "total_combos": 311040
  },
  "optimal_sharpe": { /* best config object */ },
  "optimal_return": { /* best config object */ },
  "optimal_calmar": { /* best config object */ },
  "optimal_composite": { /* best config object */ },
  "advisor_turbo": { /* best strict config for turbo */ },
  "advisor_dynamic": { /* ... */ },
  "advisor_balanced": { /* ... */ },
  "advisor_secured": { /* ... */ },
  "advisor_fortress": { /* ... */ },
  "advisor_tkl": { /* ... */ },
  "advisor_turbo_relaxed": { /* fallback */ },
  "advisor_dynamic_relaxed": { /* ... */ },
  "advisor_balanced_relaxed": { /* ... */ },
  "advisor_secured_relaxed": { /* ... */ },
  "advisor_fortress_relaxed": { /* ... */ },
  "advisor_tkl_relaxed": { /* ... */ },
  "top20_sharpe": [ /* 20 config objects with metrics */ ],
  "top20_return": [ /* ... */ ],
  "top20_calmar": [ /* ... */ ],
  "top20_composite": [ /* ... */ ],
  "frozen_turbo": { /* full stats for current turbo config */ },
  "frozen_dynamic": { /* ... */ },
  "frozen_balanced": { /* ... */ },
  "frozen_secured": { /* ... */ },
  "frozen_fortress": { /* ... */ },
  "frozen_tkl": { /* ... */ }
}
```

Each `frozen_<mode>` also includes `in_sample` and `out_sample` sub-objects with the same metric fields.

### 10.3 data/portfolio-history.json

Daily equity curve per mode:

```json
{
  "updated_at": "2026-05-07T23:00:00Z",
  "turbo":   [{ "date": "2026-02-18", "value": 101.5 }],
  "dynamic": [ /* ... */ ],
  "balanced": [ /* ... */ ],
  "secured":  [ /* ... */ ],
  "fortress": [ /* ... */ ],
  "tkl":      [ /* ... */ ]
}
```

---

## 11. CLI Flags

| Flag | Effect |
|---|---|
| `--full-sweep` | Run exhaustive grid search (default: frozen-only) |
| `--quick` | Use reduced grid dimensions |
| `--verbose` | Print per-trade debug output |
| `--sharia` | Exclude non-Sharia-compliant tickers |
| `--from=YYYY-MM-DD` | Override scan cutoff date |
| `--tkl-policy=off\|hybrid\|isolated` | TKL pool ingestion mode |
| `SWEEP_SHARD=N SWEEP_SHARDS=M` | Env vars for sharding |

---

## 12. Performance Attribution

Decompose portfolio returns into explainable dimensions. Computed after each simulation run
(frozen or full-sweep) and stored alongside `BacktestMetrics`.

### 12.1 Attribution dimensions

| Dimension | Decomposition |
|-----------|---------------|
| **By strategy** | `breakout`, `momentum`, `mean_reversion`, `squeeze`, `catalyst` — each gets its own `{ trades, winRate, pnlTotal, pnlAvg, contribution_pct }` |
| **By sector** | Group trades by signal `sector` tag. Same metrics per sector. |
| **By regime** | Group trades by `regime` at entry date. Shows which regimes drive returns. |
| **By holding period** | Buckets: `0-2d`, `3-5d`, `6-10d`, `11-21d`, `21d+`. Identifies optimal hold duration. |
| **By score bucket** | Buckets: `90-92`, `93-95`, `96-98`, `99-100`. Tests whether higher scores predict better outcomes. |

### 12.2 Attribution object schema

```typescript
interface PerformanceAttribution {
  by_strategy: { [strategy: string]: AttributionSlice };
  by_sector:   { [sector: string]:   AttributionSlice };
  by_regime:   { [regime: string]:   AttributionSlice };
  by_holding_period: { [bucket: string]: AttributionSlice };
  by_score_bucket:   { [bucket: string]: AttributionSlice };
}

interface AttributionSlice {
  trades: number;
  wins: number;
  losses: number;
  win_rate: number;             // wins / resolved * 100
  pnl_total: number;            // sum of all trade pnlPct
  pnl_avg: number;              // pnl_total / trades
  contribution_pct: number;     // pnl_total / portfolio_total_pnl * 100
  max_win: number;              // best single trade pnlPct
  max_loss: number;             // worst single trade pnlPct
  avg_hold_days: number;
}
```

### 12.3 Computation

After the simulation loop completes and `trades[]` is finalized:
```
for each resolved trade:
  bucket = lookupBucket(trade, dimension)  // strategy, sector, regime, holdDays, score
  attribution[dimension][bucket].trades++
  attribution[dimension][bucket].pnl_total += trade.pnlPct
  // ... accumulate wins/losses/max/min

for each dimension, for each bucket:
  contribution_pct = bucket.pnl_total / sum(all_buckets.pnl_total) * 100
```

---

## 13. Risk Decomposition

Per-position and per-dimension risk contribution analysis. Computed from the equity curve
and trade-level data.

### 13.1 VaR contribution per slot

For each open position at any point in the equity curve, compute its marginal VaR contribution:

```typescript
interface VaRDecomposition {
  portfolio_var_95: number;       // portfolio-level 1-day VaR (95%)
  portfolio_var_99: number;       // portfolio-level 1-day VaR (99%)
  position_contributions: {
    ticker: string;
    weight_pct: number;           // position value / portfolio value * 100
    marginal_var_95: number;      // incremental VaR from this position
    component_var_95: number;     // weight * beta_to_portfolio * portfolio_var
    pct_of_total_var: number;     // component_var / portfolio_var * 100
  }[];
}
```

**Method**: Historical simulation VaR using daily returns from the equity curve.
Marginal VaR = `VaR(portfolio) - VaR(portfolio without position_i)`.

### 13.2 Correlation contribution

```typescript
interface CorrelationContribution {
  avg_pairwise: number;
  max_pair: { tickers: [string, string]; rho: number };
  diversification_ratio: number;  // sum(individual_vols) / portfolio_vol — higher = more diversified
  sector_concentration: {
    sector: string;
    position_count: number;
    weight_pct: number;
    intra_sector_correlation: number;
  }[];
}
```

### 13.3 Drawdown attribution

When a drawdown occurs, attribute it to the positions that caused it:

```typescript
interface DrawdownAttribution {
  max_dd_pct: number;
  max_dd_start: string;     // date drawdown began
  max_dd_end: string;       // date of trough
  recovery_date: string | null;  // date equity recovered to prior peak (null if not recovered)
  recovery_days: number | null;
  contributing_positions: {
    ticker: string;
    pnl_during_dd: number;   // pnlPct of this position during the drawdown window
    pct_of_drawdown: number; // contribution to the total drawdown
  }[];
}
```

---

## 14. Strategy Comparison Analytics

Side-by-side comparison of any two mode configurations. Used by the Strategy Lab (PRD-17 §3.3)
and exposed via the API (PRD-10 §9).

### 14.1 Comparison object

```typescript
interface StrategyComparison {
  mode_a: { id: string; config: ModeConfig; metrics: BacktestMetrics };
  mode_b: { id: string; config: ModeConfig; metrics: BacktestMetrics };
  deltas: {
    return_total: number;       // mode_a - mode_b
    max_dd: number;
    win_rate: number;
    sharpe: number;
    calmar: number;
    profit_factor: number;
  };
  rolling_alpha: {
    window_days: number;        // default 30
    series: { date: string; alpha: number }[];  // mode_a excess return over mode_b
  };
  regime_comparison: {
    [regime: string]: {
      mode_a: BacktestMetrics;
      mode_b: BacktestMetrics;
      delta_sharpe: number;
    };
  };
  overlap: {
    shared_trades: number;      // trades with same ticker+scanDate in both modes
    unique_a: number;
    unique_b: number;
    jaccard_index: number;      // shared / (unique_a + unique_b + shared)
  };
}
```

### 14.2 Rolling alpha computation

```
For each day d in the equity curve:
  window = equity_a[d-30..d] and equity_b[d-30..d]
  ret_a = (equity_a[d] - equity_a[d-30]) / equity_a[d-30]
  ret_b = (equity_b[d] - equity_b[d-30]) / equity_b[d-30]
  alpha[d] = ret_a - ret_b
```

---

## 15. Automated Reports

Post-simulation report generation in structured JSON suitable for rendering to HTML or PDF.

### 15.1 Report types

| Report | Trigger | Content |
|--------|---------|---------|
| **Daily P&L Summary** | After each sweep run | Today's trades, positions change, equity delta |
| **Weekly Performance Digest** | End of trading week (Friday) | 5-day returns by mode, best/worst trades, regime context |
| **Monthly Strategy Review** | End of month | Full attribution, parameter drift analysis, recommendations |

### 15.2 Report object schema

```typescript
interface Report {
  type: "daily_pnl" | "weekly_digest" | "monthly_review";
  generated_at: string;
  period: { from: string; to: string };
  modes: ReportModeSection[];
  highlights: string[];            // Top 3 key observations (natural language)
  recommendations: string[];       // Actionable suggestions
}

interface ReportModeSection {
  mode_id: string;
  metrics: BacktestMetrics;
  attribution: PerformanceAttribution;
  top_trades: TradeRecord[];       // best 3 by pnlPct
  worst_trades: TradeRecord[];     // worst 3 by pnlPct
  regime_context: string;          // current regime label
}
```

### 15.3 Generation integration

Reports are generated by `gen-api.js` as additional output files:
```
portfolio/v1/{mode}/reports/daily-{YYYY-MM-DD}.json
portfolio/v1/{mode}/reports/weekly-{YYYY-Www}.json
portfolio/v1/{mode}/reports/monthly-{YYYY-MM}.json
portfolio/v1/reports/latest.json   — points to most recent report of each type
```

---

## 16. Equity Curve Analytics

Deep analysis of the equity curve beyond simple max drawdown.

### 16.1 Analytics object

```typescript
interface EquityCurveAnalytics {
  // Drawdown analysis
  drawdowns: {
    max_dd_pct: number;
    max_dd_duration_days: number;   // peak to trough in trading days
    max_recovery_days: number;      // trough to new high
    current_dd_pct: number;         // 0 if at all-time high
    drawdown_periods: DrawdownPeriod[];  // all drawdowns > 2%
  };

  // Underwater chart data (time below prior peak)
  underwater: {
    series: { date: string; dd_pct: number }[];   // negative values = below peak
    pct_time_underwater: number;                   // % of days below prior peak
    avg_underwater_pct: number;                    // mean dd when underwater
  };

  // Recovery analysis
  recovery: {
    avg_recovery_days: number;     // mean days to recover from drawdowns > 2%
    median_recovery_days: number;
    fastest_recovery: { dd_pct: number; days: number; date: string };
    slowest_recovery: { dd_pct: number; days: number; date: string };
  };

  // Regime overlay
  regime_overlay: {
    series: { date: string; value: number; regime: string }[];
    regime_transitions: { date: string; from: string; to: string }[];
  };

  // Consistency
  monthly_returns: { month: string; return_pct: number }[];
  positive_months_pct: number;     // % of months with positive return
  best_month: { month: string; return_pct: number };
  worst_month: { month: string; return_pct: number };
}

interface DrawdownPeriod {
  start_date: string;        // date of peak before drawdown
  trough_date: string;       // date of max drawdown
  recovery_date: string | null;
  dd_pct: number;            // max drawdown in this period
  duration_days: number;     // peak to trough
  recovery_days: number | null;
  contributing_trades: string[];  // tickers active during drawdown
}
```

### 16.2 Computation

Built from the equity curve array during metrics computation (§8):
```
peaks = running_max(equity_curve.values)
underwater = [(peaks[i] - equity_curve[i].value) / peaks[i] * 100 for each i]
drawdown_periods = identify contiguous regions where underwater > 0
  → split at recovery points (underwater == 0)
  → filter periods with max(dd) > 2%
regime_overlay = join equity_curve dates with regime data from scanner HTML
monthly_returns = group equity points by YYYY-MM, compute first-to-last return
```
