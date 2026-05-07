# PRD-05: Position Tracking & Exits

**Source**: `tools/update-tracking.js`
**Version**: 2026-05-07
**Status**: Authoritative — implement deterministically from this document.

---

## 1. Overview

`update-tracking.js` maintains the live state of all positions across all strategy slots. It reads all signal files from the last 35 days, fetches current OHLC prices from Yahoo Finance, evaluates exit conditions for each trade, and writes two output files:

- `data/scanner-positions.json` — unified open positions with current prices and status (tagged by `strategySlotId`, see PRD-23 §3.3)
- `data/scanner-metrics.json` — aggregate performance metrics and portfolio history

> **Unified Engine note**: In the unified engine (PRD-23), this tracker handles positions from ALL signal sources (scanner, mechanical Go bridge, ML, manual). Each position carries a `strategySlotId` field identifying which strategy slot produced the signal. The file name remains `scanner-positions.json` for backward compatibility but contains positions from all sources.

---

## 2. Input Sources

### 2.1 Scanner directories

```
scanner/YYYYMMDD/          # pattern: /^\d{8}(-\d+)?$/
  signals.json             # primary source (parsed via scanner-parser.js)
  index.html               # fallback if signals.json absent
```

**Cutoff**: only scan dirs where `scanDate >= today - 35 calendar days`.

### 2.2 Signal loading per directory

Uses `tools/lib/scanner-parser.js` `loadSignals(dir)`. From the loaded result, take top 10 signals sorted by score descending:

```javascript
signals
  .sort((a, b) => (b.score || 0) - (a.score || 0))
  .slice(0, 10)
  .map(s => ({
    ticker:      s.ticker,
    score:       s.score || 85,
    strategy:    s.strategy,
    entry:       s.entry,
    stop:        s.stop,
    tp1:         s.tp1,
    tp2:         s.tp2,
    horizon_days: 20,           // default; use s.horizon_days if provided
  }))
```

### 2.3 Trade record construction

For each signal `s` in a scan dir `dir` with `scanDate`:

```json
{
  "id":           "20260507-NVDA-1",
  "scan_date":    "2026-05-07",
  "scan":         "20260507",
  "rank":         1,
  "ticker":       "NVDA",
  "ticker_yahoo": "NVDA",
  "strategy":     "Momentum",
  "chart_url":    "https://finviz.com/chart.ashx?t=NVDA&ty=c&ta=1&p=d&s=l",
  "entry":        120.50,
  "stop":         115.00,
  "tp1":          130.00,
  "tp2":          140.00,
  "horizon_days": 20,
  "expire_date":  "2026-06-04",
  "status":       "open",
  "current_price": null,
  "return_pct":   null,
  "days_held":    null
}
```

`expire_date` = `scanDate` + `horizon_days` business days (skip Sat/Sun).

`ticker_yahoo`: use Yahoo ticker map override if present. Map is currently empty — all tickers resolve directly.

---

## 3. Price Fetching

### 3.1 Yahoo Finance OHLC fetch

```
GET https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=60d
Headers: { 'User-Agent': 'Mozilla/5.0' }
Timeout: 8000ms
```

Response parsing:

```javascript
const result = j.chart.result[0];
const meta   = result.meta;
const timestamps = result.timestamp;                     // Unix seconds
const quotes = result.indicators.quote[0];               // { open[], high[], low[], close[] }

// Build history map
const history = {};
timestamps.forEach((ts, i) => {
  const date = new Date(ts * 1000).toISOString().slice(0, 10);
  history[date] = {
    open:  quotes.open[i],
    high:  quotes.high[i],
    low:   quotes.low[i],
    close: quotes.close[i],
  };
});

lastPrice = meta.regularMarketPrice || quotes.close[quotes.close.length - 1];
```

Error handling:
- HTTP 429 or 5xx: skip ticker, log warning, return `{ history: {}, lastPrice: null, error: 'http_NNN' }`
- JSON parse error: return `{ history: {}, lastPrice: null, error: 'parse_error' }`

### 3.2 Batch concurrency

Max **6 parallel** fetches. Process unique tickers across all trades in batches of 6.

No sessionStorage in Node.js context — data is fetched fresh on each run.

### 3.3 Business day computation

```javascript
function addBusinessDays(dateStr, days):
  d = new Date(dateStr)
  added = 0
  while added < days:
    d.setDate(d.getDate() + 1)
    if d.getDay() !== 0 AND d.getDay() !== 6:
      added++
  return d.toISOString().slice(0, 10)
```

---

## 4. Exit Detection

For each trade, evaluate exit conditions chronologically over bars from `scan_date` to `min(today, expire_date)`.

### 4.1 Bar iteration order

```javascript
const cutoff = today < trade.expire_date ? today : trade.expire_date;
const dates = Object.keys(data.history)
  .filter(d => d >= trade.scan_date && d <= cutoff)
  .sort();   // chronological ascending
```

### 4.2 Exit priority (per bar, in order)

For each bar `{ open, high, low, close }` on date `d`:

```
# Flag ambiguous bar first (informational only — does not change exit logic)
hitSL = bar.low <= trade.stop
hitTP = (trade.tp2 AND bar.high >= trade.tp2) OR bar.high >= trade.tp1
if hitSL AND hitTP: trade.ambiguous = true

# 1. Stop-loss (intraday LOW)
if bar.low <= trade.stop:
  status     = 'sl'
  exit_price = trade.stop
  exit_date  = d
  pnl_pct    = (trade.stop - trade.entry) / trade.entry * 100
  break

# 2. TP2 (intraday HIGH) — check BEFORE TP1
if trade.tp2 AND bar.high >= trade.tp2:
  status     = 'tp2'
  exit_price = trade.tp2
  exit_date  = d
  pnl_pct    = (trade.tp2 - trade.entry) / trade.entry * 100
  break

# 3. TP1 (intraday HIGH)
if bar.high >= trade.tp1:
  status     = 'tp1'
  exit_price = trade.tp1
  exit_date  = d
  pnl_pct    = (trade.tp1 - trade.entry) / trade.entry * 100
  break
```

All `pnl_pct` values rounded to 2 decimal places.

### 4.3 Horizon expiry

If the loop completes without an exit trigger:
```
status       = 'expired'
exit_date    = last date in dates array
exit_price   = bar.close on that date
pnl_pct      = (exit_price - trade.entry) / trade.entry * 100
```

### 4.4 Legacy trade cleanup

Trades with missing `stop` or `tp1` fields AND a `current_price` available:
```
status     = 'expired'
exit_price = current_price
exit_date  = today
pnl_pct    = (current_price - entry) / entry * 100
```

### 4.5 Status values

| Status | Meaning |
|---|---|
| `open` | Still within horizon, no exit triggered |
| `tp1` | TP1 hit (full exit) |
| `tp2` | TP2 hit (full exit) |
| `sl` | Stop-loss hit |
| `expired` | Horizon elapsed or legacy cleanup |

---

## 5. Open Position Processing

After exit detection, trades with `status === 'open'` are processed for current state:

### 5.1 Current price and return

```javascript
trade.current_price = data.lastPrice;
trade.return_pct    = entry > 0 && lastPrice
  ? +((lastPrice - entry) / entry * 100).toFixed(2)
  : null;
trade.days_held     = businessDaysBetween(scan_date, today);
trade.days_remaining = businessDaysBetween(today, expire_date);
```

`businessDaysBetween(a, b)`: count business days from `a` (exclusive) to `b` (inclusive). Returns 0 if `a >= b`.

### 5.2 Deduplication

Keep only the most recent scan per ticker (avoid duplicate exposure):

```javascript
// Sort by scan_date descending
const stillOpen = allTrades.filter(t => t.status === 'open');
const seenTickers = new Set();
const dedupOpen = [];
for (const t of stillOpen.sort((a, b) => b.scan_date.localeCompare(a.scan_date))) {
  if (seenTickers.has(t.ticker)) continue;
  seenTickers.add(t.ticker);
  dedupOpen.push(t);
}
```

### 5.3 Output position schema

```json
{
  "ticker":         "NVDA",
  "name":           "NVIDIA Corp",
  "scan_date":      "20260505",
  "strategy":       "Momentum",
  "score":          92,
  "entry":          120.50,
  "stop":           115.00,
  "tp1":            130.00,
  "tp2":            140.00,
  "current_price":  125.30,
  "return_pct":     3.98,
  "status":         "open",
  "days_held":      2,
  "days_remaining": 18,
  "horizon":        20,
  "expire_date":    "2026-06-04",
  "chart_url":      "https://finviz.com/chart.ashx?t=NVDA&ty=c&ta=1&p=d&s=l",
  "rank":           1,
  "ambiguous":      false
}
```

---

## 6. Aggregate Metrics Computation

### 6.1 Partition trades

```javascript
const closed = allTrades.filter(t => t.status !== 'open');
const open   = allTrades.filter(t => t.status === 'open');
const wins   = closed.filter(t => (t.pnl_pct || 0) > 0);
const losses = closed.filter(t => (t.pnl_pct || 0) <= 0);
```

### 6.2 Win rate variants

```
win_rate      = wins.length / closed.length * 100   (1dp)

# Top-3 per scan: first 3 by rank within each scan_date
top3Trades    = allTrades grouped by scan_date, take rank <= 3
top3Closed    = top3Trades where status != 'open'
top3Wins      = top3Closed where pnl_pct > 0
win_rate_top3 = top3Wins.length / top3Closed.length * 100  (1dp)

# Top-10: same logic with rank <= 10
win_rate_top10
```

### 6.3 P&L aggregates

```
return_realized   = sum(t.pnl_pct * (1/portfolioSize) for t in closed)
return_unrealized = sum(t.return_pct * (1/portfolioSize) for t in open where return_pct != null)
return_total      = return_realized + return_unrealized

# 30-day windows
return_30d            = sum(pnl_pct / portfolioSize for closed trades where exit_date >= today-30d)
return_30d_closed_only = same but excludes open
```

`portfolioSize` here = number of signals per scan (typically 10 for top-10). Used as equal-weight denominator.

### 6.4 Max drawdown (scanner-metrics)

```
equity = 100
peak   = 100
maxDD  = 0
portfolioHistory = []
drawdownHistory  = []

# Process all closed trades sorted by exit_date asc
for trade in closed.sort(exit_date):
  weight = 1 / portfolioSize
  equity += trade.pnl_pct * weight
  if equity > peak: peak = equity
  dd = (peak - equity) / peak * 100
  if dd > maxDD: maxDD = dd
  portfolioHistory.push({ date: trade.exit_date, value: round(equity, 2) })
  drawdownHistory.push({ date: trade.exit_date, value: round(-dd, 2) })

max_drawdown = round(-maxDD, 2)   # stored as negative number (e.g. -8.5)
```

### 6.5 Profit factor

```
grossWin  = sum(pnl_pct for wins)
grossLoss = abs(sum(pnl_pct for losses))
profit_factor = grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? 99 : 0)
```

### 6.6 Return/DD ratio

```
return_dd_ratio = maxDD > 0 ? return_total / maxDD : (return_total > 0 ? 99 : 0)
```

### 6.7 Capital allocation

```
workingCapitalPct  = open.length / portfolioSize * 100          # % of portfolio in active positions
pendingOrdersPct   = pendingOrders.length / portfolioSize * 100  # % in orders not yet entered
availableCashPct   = 100 - workingCapitalPct - pendingOrdersPct  # free cash
```

`pendingOrders` = trades that have been signalled but `scan_date > today` (future scans).

### 6.8 Exit counts

```
tp1_count     = closed.filter(status == 'tp1').length
tp2_count     = closed.filter(status == 'tp2').length
sl_count      = closed.filter(status == 'sl').length
expired_count = closed.filter(status == 'expired').length
```

### 6.9 Time stats

```
totalDays  = businessDaysBetween(earliest scan_date, today)
scansCount = count of distinct scan directories processed
```

---

## 7. Output Files

### 7.1 data/scanner-metrics.json

```json
{
  "updated_at":          "2026-05-07T15:30:00Z",
  "trades_total":        120,
  "trades_closed":       85,
  "trades_open":         35,
  "resolved_pct":        70.8,
  "win_rate":            62.4,
  "win_rate_top3":       68.2,
  "win_rate_top10":      60.1,
  "top3_closed_count":   44,
  "return_realized":     18.5,
  "return_unrealized":   3.2,
  "return_total":        21.7,
  "max_drawdown":        -6.3,
  "profit_factor":       2.1,
  "avg_win_pct":         5.8,
  "avg_loss_pct":        -3.1,
  "tp1_count":           28,
  "tp2_count":           15,
  "sl_count":            22,
  "expired_count":       20,
  "return_30d":          8.4,
  "return_30d_closed_only": 5.1,
  "working_capital_pct": 35.0,
  "pending_orders_pct":  0.0,
  "available_cash_pct":  65.0,
  "total_days":          57,
  "scans_count":         12,
  "return_dd_ratio":     3.44,
  "portfolio_history": [
    { "date": "2026-02-20", "value": 100.58 }
  ],
  "drawdown_history": [
    { "date": "2026-02-20", "value": -0.00 }
  ]
}
```

### 7.2 data/scanner-positions.json

```json
{
  "updated_at": "2026-05-07T15:30:00Z",
  "open_positions": [
    {
      "ticker":         "NVDA",
      "name":           "NVIDIA Corp",
      "strategySlotId": "balanced",
      "source":         "scanner",
      "scan_date":      "20260505",
      "strategy":       "Momentum",
      "score":          92,
      "entry":          120.50,
      "stop":           115.00,
      "tp1":            130.00,
      "tp2":            140.00,
      "current_price":  125.30,
      "return_pct":     3.98,
      "status":         "open",
      "days_held":      2,
      "days_remaining": 18,
      "horizon":        20,
      "expire_date":    "2026-06-04",
      "chart_url":      "https://finviz.com/chart.ashx?t=NVDA&ty=c&ta=1&p=d&s=l",
      "rank":           1,
      "ambiguous":      false
    }
  ]
}
```

Positions sorted by `return_pct` descending.

---

## 8. Execution

```bash
node tools/update-tracking.js
```

No CLI flags. Always runs against live data. Output is always overwritten (not append-only).

Called as the first step of the daily pipeline:
```bash
node tools/update-tracking.js    # step 1 of pipeline
node tools/sweep.js              # step 2 (reads backtest-trades.json)
```

---

## 9. Error Handling

| Scenario | Behavior |
|---|---|
| Yahoo fetch fails (429/5xx) | Skip ticker, log warning, continue |
| No bars in history for trade window | Trade remains `open` with `current_price = null` |
| `entry <= 0` | Skip trade entirely |
| Missing `stop` or `tp1` and price available | Force `expired` at current price |
| signals.json parse error | Skip scan directory |

> **Unified Engine note**: In the unified engine (PRD-23 §3.3), each position carries a `strategySlotId` and `source` field. The tracker processes positions from all signal sources (scanner, mechanical via Go bridge, ML, manual) through the same exit logic. Cross-slot deduplication ensures no ticker appears in multiple slots simultaneously (PRD-23 §7). The file name remains `scanner-positions.json` for backward compatibility.

<!-- Consistency pass: aligned with PRD-23 Unified Strategy Engine, 2026-05-07 -->
