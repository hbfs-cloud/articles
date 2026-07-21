---
name: feedback-balanced-sl-bleed-not-a-bug
description: Balanced's "wall of stop-losses" is NOT a bug — it's legacy superseded-config trades + trailing-scratch mislabeling; same-day stops on vwapGate=false modes are legitimate intraday stop-outs, not premature-stop artifacts. Trade History must be closed-only.
type: feedback
---

Four durable rules from the 2026-07-08 "balanced looks broken" diagnosis (last-30 WR 27%). Verdict: NOT a bug, NOT proof the strategy fails.

**Rule 1 — Judge a config only on trades IT made.** ZERO of balanced's 64 sealed closed trades were made under the current config; every one was a SUPERSEDED config (v1, v2-20260418 = `horizon:2/maxStopPct:0/atrStopMult:0/trailingStop:false` no-stop H2, then v7/v8.9/v9.4/v10.0). The v10.1 changelog literally documents the v2 H2/no-stop config as the bleed that was replaced. A fresh config with 0 live trades can't be judged failing — its only evidence is its backtest. Textbook [[feedback-regime-aware-eval]] / [[feedback-segment-replay-absolute-dd]]. **Let a new config accumulate ~15-20 live trades before judging; don't data-snoop on zero evidence right after a change.**

**Rule 2 — Same-day stops on `vwapGate:false` modes are LEGITIMATE, not entry-bar artifacts.** balanced/fortress/hybrid/stockbox enter at the open, so a same-day intraday stop on an open entry is realistic (HON 2026-06-30 opened 231.35, low 219.33 breached the 220.7 stop → −4.6% same day, real). "A stop can't fire on the entry bar" holds ONLY for VWAP-gated modes, which sweep.js already handles (rejects unfilled resting limits: `vwapLimit < entryBar.low → null`). **Do NOT add an entry-bar stop guard** — it would suppress legit stops and risk Go parity on editorial modes.

**Rule 3 — Trade History = CLOSED trades only** (fixed, commit a81b5255f). Open/pending positions had leaked into Trade History and the closed-trade ledger. `gen-status-page.js`: renders closed only (drops still-open pending / premature-within-horizon → they live in Open Positions); header shows real rendered closed count. `gen-api.js`: `trades.json` / `all.json#closedTrades` exclude open trades (in positions.json); restored `closedTrades.length == trade-chain length`. No trades/config/chain mutated; frozen + SHA chain untouched.

**Rule 4 — hero(frozen) vs Trade-History(ledger) count divergence is BY DESIGN.** Hero "Closed Trades" = frozen stat denominator (LOCKED at first freeze, e.g. 60) while Trade History renders the full append-only ledger (e.g. 64). They diverge because closed trades keep appending while `*_stats` are frozen ([[immutable-trades]]). Do NOT recompute frozen to reconcile (violates immutability) and do NOT hide the extra closed trades (hides real ledger). The hero tooltip explains "counted in the stats above".

**Also true (not artifacts):** the "wall of 34 SL" is visually inflated — only ~14 are genuine full stops (pnl≈stop, avg −5.22%); ~20 are trailing scratches (avg −1.57%) where a raised stop sat below breakeven and got tapped but is labeled 'sl' (`currentStop < entryPrice`, sweep.js ~893). The pnl% is correct — a narrative problem, not a P&L bug. MAE autopsy of the genuine June stops (NVDA/ANET/FCX/AVGO) showed real −10% to −17% adverse excursions (3 of 4 fell further after the stop), vindicating adding an ATR stop + cap + trailing over the old no-stop config.

**Discipline:** no config change was applied. If balanced tuning is revisited: 30-day regime-aware + walk-forward via `validate-config-change.js` that BEATS current, project before/after, user chooses ([[feedback-config-change-backtest]]).
