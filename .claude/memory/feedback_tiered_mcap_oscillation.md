---
name: tiered-mcap-oscillation
description: War room decision (2026-06-19) — replaced $50B mcap floor with tiered sizing during regime oscillation
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8b07eb38-8dd3-4eb5-ac9d-c96a0c5f46db
---

Replace the blanket $50B mcap floor during regime oscillation with tiered sizing.

**Why:** the $50B floor came from N=3 confounded observations (COP/TTE losses were energy-sector, not mcap). Three of the top-5 all-time trades are sub-$10B (SM +14.76%, CHRD +12.68%, BBIO +11.64%). Six other rules already stack during oscillation, making a hard floor redundant.

**How to apply — when regime oscillates ≥2× in 5 days:**
- mcap < $2B → REJECT (hard block, except TKL pool)
- mcap $2-10B → sizing ×0.5 + stops widened to 2.25× ATR
- mcap $10-50B → sizing ×0.7
- mcap ≥ $50B → normal (regime-rotation-penalty still applies)
- Anti-triple-stack: take the MORE restrictive of tiered vs regime-rotation-penalty, don't cumulate both.

Related: [[feedback_no_hallucination]], [[feedback_regime_aware_eval]]
