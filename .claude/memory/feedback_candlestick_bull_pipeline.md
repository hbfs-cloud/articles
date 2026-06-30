---
name: feedback-candlestick-bull-pipeline
description: "The /scanner pipeline MUST run candlestick-scanner.js before sweep/gen-status-page, else the \"bull\" mode shows 0 signals"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ef8ff29d-9dd6-4587-ba83-8cf9de09e10c
---

The `bull` scanner mode (`modes-config.json`, `filterName: candlestick_only`, deploying since 2026-06-05) is fed by **AmericanBulls candlestick signals** that `tools/candlestick-scanner.js --output signals --date YYYYMMDD --regime <REGIME>` **appends to `scanner/YYYYMMDD/signals.json`** (strategy label = `"Candlestick"`, dedup by ticker → idempotent). These are NOT the 4-strategy A+ top-10; they live only in signals.json (not data.json/HTML).

**The bug (caught 2026-06-16):** the `/scanner` command (`.claude/commands/scanner.md`) and `tools/publish-daily-card.sh` both OMITTED the candlestick step, so bull got 0 fresh signals every night → status page `#bull` shows "0 signals". Only `.claude/skills/scanner-pipeline.md` mentioned it.

**Why:** the bull "Orders to Place" panel is built by `gen-status-page.js` filtering the **latest scan's signals.json** per mode (not from sweep). No candlestick signal in signals.json → bull empty. Re-running **sweep does NOT fix the display** (sweep affects historical/closed trades; the next session hasn't traded yet so it can't simulate the pending entry). The fix is: append candlestick signal → re-run **gen-status-page** (+gen-api).

**How to apply:** candlestick-scanner must run AFTER signals.json exists (post-publish) but BEFORE `sweep` and `gen-status-page` in Phase 5. Now wired into both `.claude/commands/scanner.md` Phase 5 and `publish-daily-card.sh` (Step 2c, before sweep). Also added `Candlestick` to the qa-check allowed-strategy whitelist (`tools/qa-check.js`) — it was a recurring false ❌. Tool fetches fresh Yahoo OHLCV (verify last bar = current session close in `data/.price-cache/<T>_ohlcv.json`). PAYO sharia tag: candlestick-scanner writes `sharia: null` — set it explicitly (payments/fintech with float interest income >5% rev → false). See [[feedback-candlestick-no-mcp]] and [[feedback-pipeline-gotchas]].
