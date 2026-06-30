---
name: v7-config-overhaul
description: "v7.0-7.1 config changes (Jun 4 2026): DD breaker %, correlation gate, ATR widen balanced/fortress, stale off everywhere, how-to template fixes"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7a9ed487-24ed-4b64-9363-f17cfdaa97cf
---

## v7.0-7.1 Config Overhaul (2026-06-04)

### Bugs found by 4-expert war room audit (6 agents opus)

1. **DD Breaker was in absolute points, not %** — at equity=150, a 4pt drop (2.7% real) fired the 4% breaker. Caused 14-day idle death spirals on turbo/dynamic. Fixed: `currentDD = ((peak - prior) / peak) * 100`
2. **Correlation gate blocked negative correlations** — `Math.abs(rho) > cap` rejected diversifiers. Fixed: `rho > cap`
3. **ATR stop used min instead of max** (fixed in v6.0 session) — `atrRisk < riskPerUnit` meant tighter stop always won. Fixed: `>`
4. **How-to templates printed 0 literally** — `maxStopPct=0` rendered as "stop at -0%". 12 how-to bugs across 6 modes, 6 CRITICAL. Fixed with config-aware conditionals + `buildTagline()`.
5. **Cooldown only for SL** — breakeven/expired/rotated had no cooldown despite code comment claiming otherwise. Added 5d/3d cooldowns.
6. **topN applied before cooldown filtering** — top-1 in cooldown = zero entries. Fixed: sort by score, widen pool to topN*3.
7. **crossModeDedup** was true (starving turbo) → set false per user decision. Modes are independent.

### Config changes (v7.1-20260604)

| Mode | Change | Rationale |
|------|--------|-----------|
| Balanced | ATR 2.0→2.5, maxStop 7→9, stale→0 | 42% SL rate, trades stopped then recovered |
| Fortress | ATR 2.0→2.5, maxStop 5→8, stale→0 | 9/16 SLs in 2 days, AVGO stopped then +24% |
| Orbit | ATR back to 3.5 (was wrongly set to 2.5), CB=3 | R:R gate killed all trades at 2.5x; 3.5x is the design |
| TKL | dailyTrail→0, rotation→none | H252 + 2% daily trail = avg hold 3d (should be months) |
| All | staleGraceDays→0 on balanced/fortress | Was already off on turbo/dynamic/tkl/orbit |

### Mode identities (validated by 6 trader personas)

- **Turbo**: Extreme risk, P=1, H5, aggressive rotation, ATR 2.5x. Day trader.
- **Dynamic**: High risk, P=1, H8, momentum-only, ATR 2.5x. Swing trader.
- **Balanced**: Medium risk, P=3, H5, ATR 2.5x/maxStop 9%. Retail investor.
- **Orbit**: Medium, P=2, H20, ATR 3.5x, deploying paper-ramp. Patient swing.
- **Fortress**: Ultra-low risk, P=4 half-sized, H8, ATR 2.5x/maxStop 8%, VIX kill 20. Père de famille.
- **TKL**: Momentum specialist avec DD maîtrisé, P=10, H252, ATR 2.5x trailing. NOT "small-cap" — includes quality momentum names.

**Why:** War room with PM, risk manager, quant dev, alpha researcher found the signal generator is strong (+11% avg 20d on score≥90, 69% WR) but execution layer was destroying alpha through stops, DD breaker, correlation gate, and stale tightening.

**How to apply:** The v7.1 config is the baseline going forward. Any future config changes should be registered in `modes-config-history.json`. The `buildTagline()` helper in `gen-status-page.js` auto-generates how-to text from config — no more hardcoded stale descriptions.
