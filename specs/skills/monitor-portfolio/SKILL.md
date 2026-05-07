---
name: monitor-portfolio
description: Monitor all active positions across strategy slots — evaluate triggers, check circuit breakers, alert on critical events
version: 1.0.0
---

# Monitor Portfolio

## When to Use

- Intraday check on open positions (any time markets are open)
- After a large market move (VIX spike, macro event)
- When a Telegram alert fires for a position
- User asks "how are my positions?" or "check the portfolio"
- Before placing new orders (confirm no circuit breakers active)

## Prerequisites

- `scanner-positions.json` or equivalent positions file readable
- Yahoo Finance accessible (via `api.allorigins.win` CORS proxy)
- `GetRegimeProbability` MCP tool available (PRD-12)
- `QueryData` MCP tool available (PRD-12)
- VIX threshold per slot defined in `strategy-slots.json`

## Steps

### Step 1: Load All Open Positions

Read current positions from `scanner-positions.json` (or `data/positions/` per mode). For each position, extract:
- Ticker, entry price, entry date, slot ID, mode
- Stop-loss price, TP1 price, TP2 price, expiry date
- Current size (shares/units), cost basis

### Step 2: Fetch Live Prices

```javascript
// Via Yahoo Finance CORS proxy (allorigins /get wrapper)
const url = 'https://api.allorigins.win/get?url=' + encodeURIComponent(yahooUrl);
fetch(url).then(r => r.json()).then(d => {
  const yahoo = JSON.parse(d.contents);
});
```

Or via MCP for batch:
```json
{
  "tool": "QueryData",
  "types": ["quote"],
  "symbols": ["TICK1", "TICK2", "..."]
}
```

### Step 3: Evaluate Position Status Per Ticker

For each position, apply exit priority order (highest priority first):

1. **Stop-Loss**: `currentPrice <= slPrice` → status: NEAR_STOP (within 2%) or STOPPED
2. **TP2**: `currentPrice >= tp2Price` → status: TP2_HIT
3. **TP1**: `currentPrice >= tp1Price` → status: TP1_HIT
4. **Expiry**: `today >= expiryDate` → status: EXPIRED
5. **Underwater**: `pnlPct < -3%` → status: UNDERWATER
6. **Trending**: `pnlPct > 0` and no trigger → status: TRENDING
7. **Entry Zone**: `pnlPct within ±1%` → status: ENTRY_ZONE

Calculate for each:
```
pnlPct = (currentPrice - entryPrice) / entryPrice × 100
daysHeld = today - entryDate
```

### Step 4: Check VIX Level and Kill Switch

```json
{
  "tool": "GetRegimeProbability",
  "model": "ensemble",
  "horizon": 5
}
```

Per slot, check VIX threshold from `strategy-slots.json`. If `vixLevel > slot.vixKillThreshold`:
- Flag: **VIX KILL ACTIVE** for that slot
- No new entries should be placed for this slot
- Existing positions: monitor for expiry/SL only, no new entries

### Step 5: Circuit Breaker Check

For each slot, compute current drawdown from slot's equity high-water mark:

```
slotDD = (hwm - currentNAV) / hwm × 100
```

If `slotDD > slot.circuitBreakerThreshold` (typically 15-20%):
- Flag: **CIRCUIT BREAKER ACTIVE** for slot
- Halt all new entries for this slot
- Alert immediately

### Step 6: Build Position Report

Output a table per slot:

```
Slot: momentum-breakout-balanced | Status: NORMAL | Open: 8 positions

Ticker | Entry  | Current | P&L%   | Days | SL     | TP1    | Status
-------|--------|---------|--------|------|--------|--------|--------
AAPL   | $182.5 | $191.2  | +4.8%  | 7   | $169.7 | $196.0 | TRENDING
NVDA   | $875.0 | $862.0  | -1.5%  | 3   | $813.7 | $943.7 | ENTRY_ZONE
META   | $520.0 | $510.0  | -1.9%  | 5   | $483.6 | $561.2 | UNDERWATER
```

### Step 7: Generate Alerts

Send alerts for:
- **NEAR_STOP** (within 2% of SL): "WARN: {TICKER} approaching stop at ${slPrice}"
- **TP1_HIT / TP2_HIT**: "OK: {TICKER} hit TP{1|2} — close 50% / full position"
- **EXPIRED**: "CLOCK: {TICKER} position expired — close immediately"
- **VIX_KILL**: "ALERT: VIX kill active for slot {slotId} — no new entries"
- **CIRCUIT_BREAKER**: "CRITICAL: Circuit breaker for slot {slotId} — halt entries"

## MCP Tools Used

| Tool | Purpose |
|------|---------|
| QueryData | Batch live price quotes for all open tickers |
| GetRegimeProbability | VIX level and regime state for kill-switch check |

## Output

- Position table per slot: ticker, entry, current price, P&L%, days held, status
- VIX kill status per slot (ACTIVE / INACTIVE)
- Circuit breaker status per slot (ACTIVE / INACTIVE)
- Alert list: positions needing immediate action
- Summary: total open positions, total unrealized P&L, slots at risk

## Error Handling

- **Yahoo Finance unavailable**: Fallback to `QueryData(types=quote)` for all tickers. If both fail, report last known prices with staleness timestamp.
- **Position file missing or corrupt**: Warn user, do not fabricate positions. Show last valid snapshot date.
- **GetRegimeProbability timeout**: Use last cached regime from `data/risk-snapshots.json`. Note staleness.
- **Ticker delisted / no quote returned**: Flag as DATA_ERROR, do not mark as stopped. Investigate manually.
- **allorigins rate limit**: Batch requests (max 6 parallel per live-tracker.js convention), add 500ms delay between batches.

## Examples

### Example 1: Morning Check Before Market Open

```
User: "Check my positions"
→ Load 23 open positions across 4 slots
→ QueryData(types=quote, symbols=[23 tickers])
→ GetRegimeProbability → VIX=18, regime=neutral, no kill switches
→ Evaluate: 2 NEAR_STOP, 1 TP1_HIT, 1 EXPIRED, 19 normal
→ Alerts:
   WARN: SMCI approaching stop at $28.40 (current $29.10, -2.4%)
   OK: AAPL hit TP1 at $195 — close 50%
   CLOCK: MSTR expired (day 16 of 15-day horizon) — close
→ Summary: 23 positions, +$4,820 unrealized (+2.1%), 3 actions needed
```

### Example 2: VIX Spike During Session

```
VIX spikes from 18 → 32 intraday
→ GetRegimeProbability → crisis=0.41
→ turbo slot VIX threshold: 28 → KILL ACTIVE
→ dynamic slot VIX threshold: 35 → normal
→ Alert: "ALERT: VIX kill active for turbo — no new entries. 6 positions monitoring only."
→ Position report shows 6 turbo positions, 2 NEAR_STOP flagged for manual attention
```
