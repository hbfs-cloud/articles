---
name: immutable-trades
description: ABSOLUTE RULE — never modify historical closed trades or their sealed aggregate stats (SHA-256 chain enforced). SCOPE — same-day published content (scan HTML / article / signals.json) IS fixable.
metadata:
  type: feedback
---

Trade history is IMMUTABLE. Never modify, recalculate, or rewrite closed trades or their frozen stats.

**Why:** 5 months of sweep.js bugs silently rewrote trade history on every run. Dynamic dropped from +91% to +77% overnight. Balanced and fortress were degraded by 41 config changes in 50 days that changed the frozenKey and triggered full re-simulations. User lost trust in all published numbers.

**How to apply:**
- `data/trade-chain.json` contains a SHA-256 hash chain over all closed trades. sweep.js verifies it at startup and aborts on violation.
- `frozen_<mode>` stats in backtest-results.json are NEVER wholesale recalculated once they exist. New trades APPEND (the post-freeze segment advances from sealed pnl); the pre-freeze prefix stays byte-locked — see [[frozen-stats-append-only-advance]] for the append-only-yet-portfolio-aware discipline.
- `computeStatsFromTrades()` full-period is only called for modes with no prior frozen stats (first-time computation), never to re-derive an existing sealed prefix.
- The closed trade count can NEVER decrease — hard guard in sweep.js blocks it.
- To reflect open positions, use gen-status-page snapshots (real-time MtM) shown separately, never sweep recalculation of the sealed record.

**SCOPE — this rule covers closed trades + sealed aggregates ONLY, not published content.** The immutability rule protects the closed trades / SHA chain `trade-chain.json` (and the sealed aggregates, cf [[frozen-stats-append-only-advance]]). It does NOT freeze a **published content** artifact (scan HTML, article, editorial `signals.json`): a same-day bug in one of those SHOULD be corrected.
- Incident (2026-07-03): I wrongly refused to fix the published scan 20260702 by invoking immutability. User correction: « y'a que les trades passés qu'on ne mute jamais ».
- Before mutating `signals.json`, still check the sweep→trades coupling (`verify()` of trade-integrity) so you don't desync already-sealed trades.

Related: [[no-hallucination]], [[mcp-hard-stop]], [[segment-replay-absolute-dd]], [[frozen-stats-append-only-advance]]
