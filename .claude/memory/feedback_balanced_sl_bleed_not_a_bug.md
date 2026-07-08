---
name: feedback-balanced-sl-bleed-not-a-bug
description: Balanced's "wall of stop-losses" is NOT a bug — it's legacy superseded-config trades + trailing-scratch mislabeling; same-day stops on vwapGate=false modes are legitimate intraday stop-outs, not premature-stop artifacts. Trade History must be closed-only.
type: feedback
---

Diagnosis 2026-07-08 of balanced "ça n'a pas l'air de marcher" (near-continuous SL wall,
last-30 WR 27% = 21 SL / 7 expired / 2 trail). Verdict: NOT a bug, and NOT proof the current
strategy fails.

## Root findings (numbers)
1. **ZERO closed trades under the current config `v10.1-20260701`.** Every one of balanced's 64
   sealed closed trades was made under a SUPERSEDED config: v1 (23, WR 57% +2.27%/trade),
   **v2-20260418 (31 trades, WR 45% +0.48%/trade) = `horizon:2, maxStopPct:0, atrStopMult:0,
   trailingStop:false`** — a no-stop H2 config, then v7/v8.9/v9.4/v10.0 (the June semis-unwind
   losers). The v10.1 changelog LITERALLY documents that the v2 H2/no-stop config was the bleed and
   was replaced ("H2/no-stop bled -0.35%/trade since Apr 20 → H8+maxStop5/7%+ATR1.8x+trailing").
   So the user's config already fixed the exact failure mode they're reacting to. v10.1 has 0 live
   trades → can't be judged as failing; its only evidence is a strong backtest (+18.35% vs -13.95%,
   PF 2.09, MaxDD -4.16%, OOS +6.7%). Textbook [[feedback-regime-aware-eval]] /
   [[feedback-segment-replay-absolute-dd]]: judging a config by trades it never made.
2. **The "wall of 34 SL" is visually inflated.** Only **14 are genuine full stops** (pnl ≈ stop
   level, avg -5.22%); **20 are scratches** (avg -1.57%) where a raised trailing/daily-trail stop
   sat below breakeven and got tapped, but the code labels it 'sl' (currentStop < entryPrice at
   sweep.js ~line 893). The pnl% is CORRECT — it's a red-pill narrative problem, not a P&L bug.
3. **MAE autopsy of the genuine June stops (NVDA/ANET/FCX/AVGO), bars re-fetched via MCP:** these
   are real momentum-in-chop losses with DEEP adverse excursions (-10% to -17% MAE). 3 of 4 stayed
   down or fell much further after the stop (right to exit / regime-mismatch, NOT "stops too tight");
   only FCX round-tripped. This VINDICATES v10.1's direction (add ATR stop + 7% cap + trailing) vs
   the old v2 no-stop config that let losers run to their -17% lows.
4. **Same-day stops are LEGITIMATE, not artifacts.** balanced/fortress/hybrid/stockbox are
   `vwapGate:false` = enter at the open. A same-day intraday stop on an open entry is realistic:
   HON 2026-06-30 opened 231.35, intraday low 219.33 breached the 220.7 stop → -4.6% same day, real.
   The "a stop can't fire on the entry bar" premise only holds for VWAP-gated modes, and sweep.js
   already handles those (rejects unfilled resting limits: `vwapLimit < entryBar.low → return null`).
   → NO premature-stop bug; do NOT add an entry-bar stop guard (it would suppress legit stops and
   risks Go parity on the editorial modes).

## What was actually a bug (fixed, commit a81b5255f)
Open/pending positions leaked into **Trade History** AND the closed-trade ledger:
- `gen-status-page.js`: Trade History now renders CLOSED trades only (drops still-open pending /
  premature-within-horizon rows — they live in Open Positions). Header shows the real rendered
  closed count ("N closed"), not the misleading "N closed · M open".
- `gen-api.js`: `trades.json` / `all.json#closedTrades` exclude open trades (surfaced in
  positions.json). Restored `closedTrades.length == trade-chain length` (balanced 64==64, was 66).
No trades/config/chain mutated; frozen stats and SHA chain untouched. Immutable-trades respected.

## Count divergence to remember (by design, not a bug)
Hero "Closed Trades" = frozen stat denominator (balanced 60) while Trade History renders the full
append-only ledger (64). They diverge because frozen `*_stats` are LOCKED at first freeze while
closed trades keep appending ([[immutable-trades]]). Do NOT recompute frozen to reconcile (violates
immutability) and do NOT hide the extra closed trades (hides real ledger). The hero tooltip already
explains "counted in the stats above".

## Discipline
No config change applied. If balanced tuning is ever revisited: 30-day regime-aware + walk-forward
backtest via `validate-config-change.js` that BEATS current, project before/after, user chooses
([[feedback-config-change-backtest]]). Recommendation: let v10.1 accumulate ~15-20 live trades
before judging — don't data-snoop on zero evidence right after a config change.
