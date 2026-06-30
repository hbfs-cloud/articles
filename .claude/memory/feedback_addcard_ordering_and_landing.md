---
name: feedback-addcard-ordering-and-landing
description: "Landing renders tab cards in JSON array order (no date sort) + add_card appends (not prepends) for weekly/series/tech → new cards land beyond the first page and look \"absent\""
metadata: 
  node_type: memory
  type: feedback
  originSessionId: deefddae-1fa7-42e0-842e-a1d73228bfbe
---

After publishing a batch, the new **weekly / series / tech** articles did NOT appear on their landing tabs (looked absent), while **daily / analyses** did.

**Why:** `index.html` `renderCards()` injects `data/<tab>.json` cards **in array order** with infinite-scroll pagination — there is **NO client-side date sort** (the French-date `parseMWDate` is used only for the analyses *freshness filter*, not for ordering). And `tools/add_card.js` **prepends** new cards for `daily`/`analyses` (date-indexed) but **APPENDS** them for `weekly`/`series`/`tech` → the new cards land at the END of the array, beyond the first rendered page, so they look missing.

**Fix applied (commit 73e1321c):** move the new cards to the FRONT of `data/{weekly,series,tech}.json` (a simple read → splice the new hrefs → unshift → write). Verify each new href is at a low index (`< itemsPerPage`).

**How to apply / check every publish:**
- After `add_card.js`, verify the new card's index in its `data/<tab>.json`: `node -e 'const a=require("./data/<tab>.json");console.log(a.findIndex(h=>String(h).includes("<href>")))'`. If it's not near 0 (and the tab isn't daily/analyses), move it to the front.
- The `senior-review` QA persona should flag "new card not on the first page."

**Two other landing gotchas seen the same session:**
- The **"Scanner Performance"** summary line is **hardcoded in `index.html`** (not the pinned `data/scanner.json` card) — its "Updated… / N cumulative retros" text + the expandable dashboard's ECharts period arrays must be hand-updated each retro. add_card on the retro does NOT touch it.
- The analyses tab has a **default 30-day freshness filter** (`maxDays=30`) that hides older A+ cards by default.

**Real fix TODO (not done):** make `add_card.js` prepend (or date-sort) for weekly/series/tech like it does for daily/analyses, so this doesn't recur. Related: [[reference_aplus_screening_and_screener_dsl]].
