---
name: reference-aplus-screening-and-screener-dsl
description: "How to screen the monthly \"10 A+ setups\" via MCP + non-obvious RunScreener DSL gotchas + publish hook behavior"
metadata: 
  node_type: memory
  type: reference
  originSessionId: deefddae-1fa7-42e0-842e-a1d73228bfbe
---

Recipe + gotchas for producing the monthly **"10 setups A+"** analyses batch (recurring feature; net-new tickers each month, the prior batch is kept). A+ = max confluence on 5 axes, NOT "biggest mover": (1) structure EMA20>50>200 rising + RSI 50-68, (2) catalyst = 4 consecutive earnings beats, (3) R/R ≥ 1.5 with defined SL, (4) clean flags / zero toxic dilution (SEC S-3/ATM/warrants), (5) reasonable or growth-justified valuation.

## MCP screening pipeline that worked (Jun 2026)
1. `RunScreener` (async → poll `CheckJobStatus`) to build a liquid pool, then post-filter in code. Candidate objects from **RunScreener** only carry: `symbol, last_price, market_cap, rsi, macd, atr, avg_volume/volume, change_24h`. Filter `market_cap>=2e9 && !excludeList`.
   > ⚠️ Note 2026-07 (surface MCP v5) : `CheckJobStatus`/`ListJobs` sont des alias serveur legacy (HTTP direct OK) mais plus découvrables via ToolSearch. Canonique : `Jobs(job_id=...)` / `Jobs(intent_id=...)`. Note ajoutée, historique non réécrit.
2. `QueryData types=earnings_quarterly` (comma-separated symbols, limit 8) → keep only 4/4 beats (actual>estimate every quarter).
3. `QueryData types=technicals` → **verify EMA20>EMA50>EMA200 here** (the real structure gate; several RSI-healthy names fail it — e.g. golden-cross-pending or turnaround names).
4. `QueryData types=stats` → valuation (pegRatio, enterpriseToEbitda, priceToBook, beta, shares, shortPercentOfFloat).
5. `QueryData types=flags` → `is_compliance_issue/is_halted_recently/is_ftd_threshold`.
6. SEC dilution: per-ticker `WebSearch "<co> SEC EDGAR S-3 ATM offering"` — recent IPOs (e.g. CRDO/ALAB) often have active ATM/S-3 + SBC dilution; disclose honestly, it's non-toxic growth dilution ≠ INDO death-spiral.

## RunScreener DSL gotchas (cost me several wasted jobs)
- `ema`/`sma` need **2 args**: `ema(close,20)` (one-arg `ema(20)` errors "not enough arguments").
- **`abs()` is NOT supported** in `score_expr` — using it makes the whole screen return 0 candidates silently (no error). Keep score_expr simple (e.g. `rsi14`).
- An `ema(close,20)>ema(close,50)&&...` **pass_expr returns 0 candidates** (the price-series EMA-stack doesn't evaluate as expected) — don't gate the screen on the EMA stack; screen loose (`rsi14>53 && rsi14<67 && macd>0 && vol>2e6`) and verify the EMA stack per-ticker via `QueryData types=technicals`.
- `support_resistance` returns empty header strings (no real levels) → derive Trade-Idea levels from EMA20/EMA50 + ATR instead.
- `RunAutoScreener` momentum picks are hot-movers/overbought junk (RSI 85, micro-caps) — useful only for the **regime** field, not for A+ selection.

## Publish hook (important)
A **pre-commit hook** auto-regenerates `assets/search-index.json`, `data/search_data.js`, `sitemap.xml`, `feed.xml` and stages them into the commit. `publish.js` does NOT do this; `add_card.js` rebuilds only the search index. So: run `add_card.js` per article (it skips series sub-parts part2+ via a guard, 1 card/series), edit `radar.json` by hand (Claude-authored), then a single `git commit` triggers the hook — no need to run feed/sitemap generators manually.

## War-room lesson (Jun 2026): an A+ must be ACTIONABLE at the spot price
A deep 4-lens war room (quant/alpha/risk/bear) downgraded ALL 10 of a freshly-screened A+ batch off A+ (0/10 kept; grades B→A). Root causes, all reusable:
- **R/R-at-spot trap (the big one).** Screening for the STRONGEST momentum/structure selects names already +5–17% above a rising EMA20. The advertised R/R≥1.5 then only holds at an un-triggered PULLBACK limit; at the LIVE price R/R collapses to ~0.4–1.0. That is the "biggest mover" trap in disguise. FIX: the A+ screen must require R/R≥1.5 **at an actionable entry near the current price** — reject names more than ~5–8% above EMA20 unless the article is explicitly framed as a limit-order/watchlist entry (and then it is not a "buy-now A+").
- **Dilution check must go beyond ATM/S-3.** Caught only by the war room: PANW's $25B cash-AND-stock CyberArk deal (+4–22% shares) + SBC ~17% of revenue; HPE's scheduled Series C MANDATORY CONVERTIBLE (~5–7% in 2027). Screen M&A stock deals + mandatory convertibles + heavy SBC, not just shelf/ATM.
- **Catalyst can be INVERTED by macro.** DAL's "cheap airline" thesis was inverted by the live Iran/Hormuz oil shock (>$2B Q2 fuel headwind, capacity cuts, below-Street guide). A trailing 4-beat streak is not a forward catalyst.
- **Basket/correlation.** "Standalone aero (GE) + standalone airline (DAL)" was actually one bet (corr 0.70); MS/KEY 0.60; the set was a high-beta cyclical bloc (~5–6 independent bets, not 10) — wrong tilt for a neutral/early-risk-off tape.
- **Genuine actionable A+ from the re-screen (R/R ~2.0 AT MARKET, clean, reasonable val):** IBKR (strongest — +5.7% over EMA20, beta 1.33, clean 424B5 shelf only), STX (AI/HDD catalyst, PEG 0.61, accelerating beats), COLB (defensive bank, 1.12x book, below resistance). CRDO/ALAB rightly rejected (nosebleed + active ATM/SBC).

Related: [[feedback_dilution_check]], [[feedback_pipeline_gotchas]], [[feedback_no_hallucination]], [[feedback_no_false_caveats]]
