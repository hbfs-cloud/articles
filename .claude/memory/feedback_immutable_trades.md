---
name: immutable-trades
description: ABSOLUTE RULE — never modify historical closed trades or their stats. SHA-256 chain enforced.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ae4db5ff-a124-40d7-8586-81972e819812
---

Trade history is IMMUTABLE. Never modify, recalculate, or rewrite closed trades or their frozen stats.

**Why:** 5 months of sweep.js bugs silently rewrote trade history on every run. Dynamic dropped from +91% to +77% overnight. Balanced and fortress were degraded by 41 config changes in 50 days that changed the frozenKey and triggered full re-simulations. User lost trust in all published numbers.

**How to apply:**
- `data/trade-chain.json` contains a SHA-256 hash chain over all closed trades. sweep.js verifies it at startup and aborts on violation.
- `frozen_<mode>` stats in backtest-results.json are NEVER recalculated once they exist. New trades append but stats stay locked.
- `computeStatsFromTrades()` is only called for modes with no prior frozen stats (first-time computation).
- The closed trade count can NEVER decrease — hard guard in sweep.js blocks it.
- To update stats, use gen-status-page snapshots (real-time MtM), never sweep recalculation.
- Related: [[no-hallucination]], [[mcp-hard-stop]], [[segment-replay-absolute-dd]]
