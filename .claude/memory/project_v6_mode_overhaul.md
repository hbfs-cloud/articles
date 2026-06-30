---
name: v6-mode-overhaul
description: "v6.0 mode overhaul (2026-06-02) — new Orbit mode, stale tightening disabled, ATR stops widened, TKL junk filtered. Backed by deep OOS analysis."
metadata: 
  node_type: memory
  type: project
  originSessionId: 7a9ed487-24ed-4b64-9363-f17cfdaa97cf
---

## v6.0 Mode Overhaul — 2026-06-02

### New Mode: Orbit (replaces Secured)
- Internal ID: `secured` (preserved for backward compat)
- Label: "Orbit", color #0891b2, emoji 🪐
- **Params**: H20, 3.5× ATR stop, no BE lock, no stale tightening, partial TP 30%, 2 slots, minScore 88
- **Status**: `deploying` (paper-ramp), review 2026-07-03
- **URL**: `#orbit` maps to internal `secured` via JS alias in gen-status-page.js
- **Backtest on real scanner signals** (32 scans, 60 trades): WR 72%, PF 10.44, MaxDD -6.3%, return +2921%
- **Trade history reset to zero** — clean slate from 2026-06-03

**Why:** The scanner picks winners but short horizons (5-8d) + tight stops (1.5× ATR) + stale tightening cut trades before moves develop. DELL made +87% over 16d but turbo captured only +3.4% over 5d. Orbit lets trades breathe.

### Turbo/Dynamic Changes
- `staleGraceDays`: 3/5 → **0** (disabled)
- `staleRaiseRate`: 0.001 → **0**
- `atrStopMult`: 1.5 → **2.5**
- `maxStopPct`: 4% → **0** (ATR-only)
- `dailyTrailPct`: 2 → **0** (turbo)

**Why:** Stale tightening caused 46% breakevens in turbo, 41% in dynamic. Autopsy showed +19.4% profit left on table (turbo), +30.4% (dynamic). Without BE lock, STM would have made +11.5% instead of 0%, GOOGL +15% instead of 0%.

### TKL Changes
- `minScore`: 80 → **85** (filter junk penny stocks)
- `atrStopMult`: 0 → **2.5** (was 7% fixed)
- `maxStopPct`: 7% → **0** (ATR-only)
- `staleGraceDays`: 7 → **0**

**Why:** 46% of TKL trades were junk tickers (AMC ×5, NAK ×5, COSM, KEEL, AURA — all score=99 from early TKL pool). These contributed -7% losses at the fixed 7% stop. Non-junk PnL was +119% vs junk +20%.

### Key Analysis Findings

**AI Supply Chain blind spot**: Scanner missed HPE (+94%), SMCI (+80%), DELL (+111%), FLEX (+71%), COHR (+28%), AAOI (+18%) over 1 month. None were in the screener universe except MU (stoppé 3× à -5.5%).

**Win/Loss ratio**: Dynamic's avg win (+3.97%) was LOWER than avg loss (-4.82%) = 0.82× ratio. Mathematically losing at 36% WR.

**Monday toxicity**: Turbo+Dynamic lose -12% every Monday (3 trades, 0% WR). VRT -7.9%, SMH -4.1%. Weekend gap effect. Too few data points for a hard rule.

**Friday on TKL**: -13% from 8 Friday trades (WR 25%). Penny stocks illiquid on Fridays.

**Score doesn't predict**: Score ≥93 → WR 41% (turbo), Score 90-92 → WR 22%. High score ≠ high win rate.

**How to apply:** Monitor Orbit paper-ramp results through July 3 review. If WR > 60% and PF > 3 OOS, flip to live. The v6.0 changes on turbo/dynamic/TKL take effect on next scan (2026-06-03). Watch for larger individual losses (ATR 2.5× = wider stops = bigger SL when hit) — acceptable tradeoff if breakevens drop from 40%+ to <10%.
