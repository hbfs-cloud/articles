---
name: breakeven-analysis
description: Stale tightening causes 38-46% breakevens across turbo/dynamic/fortress. Disabling it recovers +11-38% PnL. Evidence from OOS trade autopsy Jun 2026.
metadata: 
  node_type: memory
  type: project
  originSessionId: 7a9ed487-24ed-4b64-9363-f17cfdaa97cf
---

## Breakeven Problem — Root Cause Analysis (2026-06-02)

Stale tightening (raising stop to entry after N grace days) was the #1 performance killer across modes.

### Impact by mode (OOS since Apr 16):
| Mode | BE trades | % of total | Profit left on table | Net recoverable |
|------|-----------|-----------|---------------------|-----------------|
| Turbo | 12/26 | 46% | +19.4% | +11.2% net |
| Dynamic | 9/22 | 41% | +30.4% | +12.9% net |
| Fortress | 18/48 | 38% | +63.9% | +38.5% net |

### Worst cases (BE → what would have happened):
- STM (turbo): BE at d2, would have been **+11.45%**
- GOOGL (dynamic): BE at d2, would have been **+14.99%**
- AVGO (fortress): BE at d2, would have been **+11.37%**
- ARM (fortress): BE at d2, would have been **+6.27%** (max intraday +15.1%)

### Fix applied (v6.0):
- `staleGraceDays` → 0 (disabled on turbo/dynamic/TKL)
- `staleRaiseRate` → 0
- `atrStopMult` → 2.5 (wider stops to compensate)
- `maxStopPct` → 0 (ATR-only)

### Other findings from the analysis:
- [[v6-mode-overhaul]] for full details
- Dynamic win/loss ratio 0.82× (avg win < avg loss) — structurally losing
- Monday entries toxic (-4% avg, 0% WR) on turbo/dynamic
- Friday entries toxic on TKL (-1.65% avg, 25% WR) but GOOD on turbo/dynamic
- Score ≥93 does NOT predict higher WR than score 90-92

**How to apply:** These breakeven stats are the baseline. After v6.0 takes effect (scan 2026-06-03+), compare new BE rate — target <10% vs previous 40%+. If new losses are larger (wider stops) but fewer, that's the expected tradeoff.
