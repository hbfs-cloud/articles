---
name: sharia-defense-revenue-exclusion
description: Sharia tagging must exclude names with defense/military revenue >5% even if debt ratio is clean (AAOIFI business-activity screen)
metadata:
  type: feedback
---

Tagging `sharia:true` on a scanner setup must check the **business-activity screen** (AAOIFI/MSCI), not only the debt/interest ratios. A company with a clean debt/mcap ratio can still be **non-compliant** if a haram business segment exceeds ~5% of revenue.

**Incident (scanner 20260728):** HXL (Hexcel) was tagged `sharia:true` — "composites aérospatiaux, dette ~8%". The senior-review Risk panel caught it: Hexcel's Space & Defense segment is ~30-35% of revenue (military rotorcraft, fighter programs). Defense/weapons >5% → hard AAOIFI exclusion regardless of the clean balance sheet. Corrected to `sharia:false`, removed from `fortress_pool`, dropped from the "conformes" list.

**Why:** the 3-ratio financial screen (debt/mcap, interest income, cash+receivables) is only HALF the test. The FIRST test is the business itself: banks, conventional insurance, **defense/armament**, alcohol, tobacco, gambling, adult content are excluded outright by primary or material (>5%) revenue.

**How to apply:** for any aerospace/industrial/conglomerate candidate, before tagging `sharia:true`, verify the revenue mix — a "commercial aerospace" name (Hexcel, Boeing, Safran, Airbus, Honeywell, GE Aerospace, RTX, Heico, TransDigm…) very often carries material defense revenue. When in doubt, tag `false` and note the segment. Never claim a compliance you have not verified against the activity mix. Related: [[no-hallucination-financial-data]].
