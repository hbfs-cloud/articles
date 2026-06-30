---
name: tiered-mcap-oscillation
description: War room decision (2026-06-19) — replaced $50B mcap floor with tiered sizing during regime oscillation
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8b07eb38-8dd3-4eb5-ac9d-c96a0c5f46db
---

Replace blanket $50B mcap floor during regime oscillation with tiered sizing approach.

**Why:** War room (5 experts + adversarial + synthesis, confidence 88%) found the $50B floor was derived from N=3 confounded observations (COP/TTE losses were energy-sector, not mcap). Three of top 5 all-time trades are sub-$10B (SM +14.76%, CHRD +12.68%, BBIO +11.64%). Six other rules already stack during oscillation making the floor redundant.

**How to apply:** When regime oscillates >=2x in 5 days:
- mcap < $2B → REJECT (hard block, except TKL pool)
- mcap $2-10B → sizing ×0.5 + stops widened to 2.25× ATR
- mcap $10-50B → sizing ×0.7
- mcap >= $50B → normal (regime-rotation-penalty still applies)
- Anti-triple-stack: take the more restrictive of tiered vs regime-rotation-penalty, don't cumulate both

**Revert condition:** If next 3 oscillation retros show sub-$20B names averaging worse than -6% per stop → tighten to $20B hard-block. Check: 2026-07-11.

**Also flagged by war room (weak evidence, similar pattern):**
- `stopped-ticker-cooldown`: N=2, consider reducing 5→3 days
- `winner-reentry-pullback-gate`: N=1, downgrade to advisory
- `vix-defensive-tilt`: N=1, soften 5/10→3/10 and hysteresis VIX<25
- `high-score-low-rsi-conflict`: N=2, mark dormant if no trigger in 4 retros
- `pre-squeeze-early-risk-off`: N=1, downgrade to advisory (+5 score bonus instead of 25% floor)

Related: [[feedback_no_hallucination]], [[feedback_regime_aware_eval]]
