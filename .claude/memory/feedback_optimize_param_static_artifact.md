---
name: feedback-optimize-param-static-artifact
description: optimize-param.js uses STATIC filters and overstates gains — always re-validate with validate-config-change.js (regime-aware + OOS) before applying any mode config change
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ef8ff29d-9dd6-4587-ba83-8cf9de09e10c
---

`tools/optimize-param.js` (single-param plateau sweep) evaluates with **static strategy filters** — it ignores `regimeFilters` (the per-regime filter switching the live frozen path uses). Its absolute returns are **artifacts** and routinely overstate a lever (e.g. it flagged `entryGatePct 0→2` at +12pp/Sharpe 2.13→3.51; the regime-aware validator showed −5.6% / OOS 0%).

**Why — every replay layer overstates, in order:** optimize-param (static filters) > validate-config-change (regime-aware, but its own absolutes ≠ frozen) > frozen sweep. But **frozen is NOT the gate for FORWARD changes**: `sweep.js` builds `frozen_X` **append-only** (locks realized trades, re-sims only NEW scans — ~line 2313 `newTrades=…newScanDateSet`, ~2454 `frozenTrades=merged`), so a config change applied today moves `frozen_X` by only a sliver and reads ≈ baseline no matter what. Gating on "frozen_X must beat old" is a category error. Frozen also **can't test forward** at all. See [[feedback-regime-aware-eval]], [[feedback-segment-replay-absolute-dd]].

**The gate = `validate-config-change.js`** (full re-sim of whole history under the new config + walk-forward OOS). Trust its OOS *ranking*, not its absolutes.

**How to apply — process for any mode config change:**
1. `optimize-param.js --mode X --all --quick` → candidate levers (HYPOTHESES only; static-filter artifacts).
2. `validate-config-change.js` (edit VARIANTS) → regime-aware FULL + OOS. **This is the gate.** Reject anything that loses OOS (overfit examples that won full but lost OOS: rotation=aggressive, horizon5, unconditional-trail). A change is good only if it beats CURRENT on BOTH full and OOS, has a causal mechanism, and fits the mandate.
3. Apply append-only (bump `_version`/`_prevVersion`, append full-modes snapshot to `config-history.json`), re-run `sweep.js` to refresh go-forward. **Do NOT gate on frozen_X** (its tiny move is expected). Change takes effect go-forward only; proof is in forward live results.
4. **When a mode "used to work then broke," CHECK `config-history.json` FIRST** — a silent config rewrite is the likeliest cause (balanced's Feb-winner concentrated-momentum + defensive `regimeFilters=breakout_only` in risk-off was flattened to flat `mom_bo` everywhere, so it ran aggressive momentum into chop; restoring `early_risk_off+neutral→breakout_only` recovered it).

**Do NOT keep re-tuning balanced.** Its Apr20+ treading-water is **regime-structural**, not a single-lever config bug: a 3-slot/top-2 selective swing mode cannot also capture full SPY beta without ceasing to be a swing mode. No lever survived the authoritative check; a fully-built regime-conditional beta-sleeve (branch `balanced-beta-sleeve`, `docs/balanced-beta-sleeve-spec.md`) validated as parity-safe but every mechanism FAILED (betaSleeve negligible, regimeStopMult harmful, cooldown null). turbo/dynamic already provide up-beta, fortress provides defense. Known DEV todo: build a full-resim harness that matches frozen so config tuning is rigorously forward-testable.

**Load-bearing pairing (reusable):** V6 "decorrelate-and-brake" showed `correlationCap 0.35 + sectorCapMax 1` is a PAIR — loosening either fails OOS, and stacking wide stops on top drops OOS. Forcing a decorrelated, concentrated book is correct construction for a lose-less-down mandate.
