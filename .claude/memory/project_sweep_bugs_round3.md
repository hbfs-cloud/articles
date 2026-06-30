---
name: sweep-bugs-round3
description: "Round 3 war room found 5 more sweep.js bugs: dead optimizer (key mismatch), score mutation, correlation sign, BE-as-loss, equity double-entry"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7a9ed487-24ed-4b64-9363-f17cfdaa97cf
---

## Sweep.js Bugs — Round 3 War Room (2026-06-04)

### FIX-1 CRITICAL: Grid search optimizer is DEAD CODE
- Pre-sim key has 18 fields (includes trailMultR, trailGraceDays)
- Grid search key has 16 fields → lookup always undefined
- All advisor_ recommendations are stale preserved values
- **This is why the full backtest produced absurd results**
- Fix: append `_1.5_0` to grid and walk-forward keys

### FIX-2 HIGH: Score mutation on shared objects
- `cand.score -= 5` mutates the original → modes processed later see wrong scores
- Processing order: fortress→secured→balanced→dynamic→turbo→tkl
- An ETF gets -5 per mode = -30 by the time turbo sees it
- Fix: clone the object `cand = { ...cand, score: adjScore }`

### FIX-3: Correlation gate should use Math.abs(rho)
- Round 2 changed to `rho > cap` (removed abs). Round 3 experts say put abs BACK
- Reasoning: -0.9 correlation = inverse correlation = hedge position = adds tail risk without alpha
- This is a design decision, not a clear-cut bug

### FIX-4: Zero-PnL counted as losses
- `pnlPct <= 0` puts breakevens in loss bucket → deflated WR/PF
- Fix: `pnlPct < 0` (strict less than)

### FIX-5: Equity curve double-entry
- startDate has value 100 + first loop iteration also adds startDate → duplicate
- Fix: initialize empty array

### Config Changes (Round 3)
- Balanced filterName: momentum_only → mom_bo (breakout avg +8.67% vs momentum +4.50%)
- Balanced rotation: none → daily_max1 (eject 1 loser/day max)
- TKL minPrice: add $15 floor (7/9 toxic SLs were sub-$10)
- TKL correlationCap: 0 → 0.7
- TKL maxStopPct: 0 → 15%

**Why:** These were found by 4 opus experts reading sweep.js line by line with context from systematic-tss methodology (plat pas pic, 1:1 BE rule, dynamic sizing).

**How to apply:** FIX-1 is the prerequisite for everything else — without it, the optimizer can't validate any config change. Fix FIX-1 first, then run --full-sweep to get real advisor data.
