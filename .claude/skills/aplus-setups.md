---
name: aplus-setups
description: Find and produce the monthly "10 setups A+" ticker analyses with maximum confluence on 5 axes — the RIGOROUS way that avoids the traps we hit (fictional R/R on extended names, missed dilution, inverted catalysts, biggest-mover bias). Trigger keywords: A+ setups, 10 setups A+ du mois, setup A+, A+ analyses batch, monthly A+, confluence 5 axes, actionable setup, screen A+ tickers, replace fake A+, war room A+.
version: 1.0.0
user-invocable: true
argument-hint: "[screen | verify <TICKERS> | warroom <TICKERS> | rebuild]"
license: Apache 2.0
---

# A+ Setups — Institutional Selection Playbook

An **A+ is maximum confluence on 5 axes, actionable AT THE SPOT PRICE** — NOT the biggest mover, NOT a strong-looking chart that already ran. If you only remember one thing: **an A+ whose advertised R/R only works at an un-triggered pullback limit is NOT an A+ today** — it's a watchlist name. This single mistake (screening for the strongest momentum → extended names) is what produced a "0/10 deserved A+" war-room verdict in the past.

## The 5 axes (ALL must be strong — the weakest axis caps the grade)
1. **Structure** — EMA20 > EMA50 > EMA200, all *rising*, RSI 50–68 (not overbought), and **price NOT extended**: ideally within ~3–5% of a rising EMA20 (a pullback-to-support or early-leg, not a blow-off). Reject names >~5–8% above EMA20 unless explicitly sold as a limit-order watchlist entry.
2. **Catalyst** — verified **4 consecutive earnings beats** (actual > estimate every quarter) **AND a real forward catalyst** (guidance, secular tailwind, estimate revisions). A trailing beat streak alone is not forward edge. The catalyst must not be **macro-inverted** (e.g. a "cheap airline" thesis is inverted by an oil shock = fuel headwind).
3. **Risk/Reward ≥ 1.5 AT AN ACTIONABLE ENTRY NEAR SPOT.** Compute R/R = (TP1 − entry) / (entry − stop) at an entry you can take *now*. If R/R only clears 1.5 on a pullback that hasn't happened, the grade is not A+ at spot.
4. **Clean flags — ZERO dilution + zero compliance issue.** Buybacks/dividends = clean. FAIL on: active ATM, S-3 equity raise, **M&A stock deals** (e.g. a cash-AND-stock acquisition that lifts share count), **mandatory convertibles**, toxic warrants, or heavy SBC (>~15% of revenue). Verify via SEC EDGAR — do NOT trust price data alone (the INDO lesson).
5. **Valuation** — reasonable P/E or clearly justified by growth. Flag nosebleed multiples (e.g. EV/EBITDA >100, fwd P/E >60) and "priced for perfection" names where EPS growth is actually flat/negative.

## Pipeline (MCP-driven, no hallucination)

### 1. Regime context
`RunAutoScreener` → use ONLY its `regime` / `risk_tolerance`. Its candidate picks are hot-movers/overbought junk — ignore them for A+.

### 2. Screen a liquid pool (loose, then post-filter in code)
`RunScreener` returns jobs (async → poll `CheckJobStatus`). **DSL gotchas (verified):**
- `ema`/`sma` need 2 args: `ema(close,20)` (one-arg errors).
- **`abs()` is unsupported in `score_expr`** → using it returns 0 candidates silently. Keep `score_expr` simple (`rsi14`).
- An `ema(close,20)>ema(close,50)&&…` *pass_expr* returns 0 — don't gate the screen on the EMA stack; verify it per-ticker instead.
- `RunScreener` candidates carry only `symbol,last_price,market_cap,rsi,macd,atr,volume` (NO sma/sector — those are only in `RunAutoScreener`).
- For ACTIONABLE (not-extended) names use a lower RSI band: `pass_expr "rsi14>48 && rsi14<60 && macd>0 && vol>2500000"`, `top_k 90`. (A 53–67 band biases toward already-extended names.)
Post-filter: `market_cap >= 2-3e9`, drop tickers already covered (existing `analyses/*` dirs + current A+ batch + the previous month's batch).

### 3. Verify the 5 axes on REAL data (batch QueryData — symbols comma-separated)
- `QueryData types=earnings_quarterly limit=8` → keep only **4/4 beats**.
- `QueryData types=technicals` → confirm **EMA20>EMA50>EMA200 rising** AND compute **extension% = (price/ema20 − 1)×100** (reject if too extended). Get ATR for stops.
- `QueryData types=stats` → pegRatio, enterpriseToEbitda, priceToBook, beta, shares, shortPercentOfFloat.
- `QueryData types=flags` → is_compliance_issue / halted / ftd.
- **Dilution:** `WebSearch "<company> SEC EDGAR S-3 ATM offering"` + `"<company> shares outstanding"` + check for M&A stock deals / mandatory convertibles / SBC. For recent IPOs (e.g. CRDO/ALAB) scrutinize post-IPO share growth — these FAIL the clean-flags axis if an ATM/S-3 is active.
- **Event / corporate-action screen (MANDATORY — FOXA lesson):** `QueryData types=news` + `WebSearch "<company> acquisition merger split spinoff secondary"`. **REJECT if a pending binary corporate action can gap the stock through the stop** — including the company as **ACQUIRER** (FOXA A+ −17% gap when it announced a $22B Roku acquisition), a pending secondary, a stock-split, or a litigation/regulatory ruling inside the trade window. Earnings already covered by the ±3d rule.
- **Abnormal-volume / informed-flow check:** `QueryData types=quote` → if today's volume > 3× the 50-day avg (or a one-day move >2×ATR) **without a known benign catalyst**, treat as informed flow → demote or reject (a pending news event is likely).
- **Price-scale sanity (MANDATORY — KLAC lesson):** the entry/stop/TP printed in the article MUST be in the **same scale as the live quote**. Cross-check entry vs `QueryData types=quote` price — if it deviates by ≥2× (or ≈10×), it's a **stock-split / unadjusted-quote / typo error** (KLAC printed $2120 entry on a $212 stock post a ~10:1 split). Also sanity-check ATR, EMAs and the 52-week range are in the same scale.
- **R/R-at-spot:** entry near EMA20/support, stop below EMA50 or ~1.6×ATR, TP1 at structure. R/R must be ≥1.5 at that entry. Reject "fictional R/R" names.

### 4. Select ~10 with sector diversity + basket sanity
Check correlation/concentration (e.g. aero + airline can be one oil/rate-cyclical bet at corr 0.70; banks cluster high-beta-to-SPY). Aim for genuinely independent bets, and fit to the regime (don't load a high-beta cyclical bloc into a neutral/early-risk-off tape).

### 5. War-room verify BEFORE publishing (mandatory)
Run an adversarial panel per ticker (Workflow): **quant / PM-alpha / risk / short-seller** lenses, each re-fetching fresh MCP data, scoring the 5 axes 0–100 and voting "A+ deserved" (default to NO if any axis <75 or R/R-at-spot <1.5). Keep A+ only if ≥3/4 vote yes AND no critical error. Add a "missed-candidates" re-screen + a basket/correlation review. This is the gate that catches over-grading.

## Article production
- Template = `analyses/MATX/index.html` (433-line batch A+ template; the 100KB `analyses/SHEL/` is the deluxe ref). One agent per ticker (parallel).
- **Avoid the MATX template's data bugs:** never ship `N/A` in the Fundamentals table; format Div Yield correctly (not "74.00%"); risk gauge "X/10" with X=1–10 (not "22/10"); unique ECharts ids per file.
- Conventions: `<html lang data-tags data-tab="analyses" data-grade="A+">`, GTM-T5Z595CW, `/assets/report.css`, brand-bar+brand-nav, ticker-header `.tm-value`+`.tm-label`, Finviz chart+modal, FAB, `footer.article-footer`, ECharts gauge+radar, `core.js`+`tag-renderer.js`, inline `.source-ref` per section. Banks: use bank metrics (NII/NIM/ROTCE/CET1/book value), NOT gross margin/EBITDA; omit the Halal badge.

## Publish
- `node tools/add_card.js analyses/<T>/index.html` per ticker (rebuilds the search index; dedupes by URL/ticker; auto-skips series sub-parts). NEVER hand-edit `data/analyses.json`.
- Update `data/radar.json` by hand (Claude-authored): add an A+ opportunity item.
- A **pre-commit hook** auto-regenerates `assets/search-index.json` + `data/search_data.js` + `sitemap.xml` + `feed.xml` and stages them — no manual feed/sitemap step needed. Stage specific files only, then commit + push.

## Hard rejection rules (memorize)
- R/R only valid on an un-triggered pullback → **not A+ at spot**.
- Active ATM / S-3 equity / M&A stock deal / mandatory convertible / SBC >15% rev → **fails clean-flags** (even if "non-toxic").
- Broke the 4-quarter beat streak (even a $0.02 miss) → **fails catalyst**.
- EMA50 < EMA200, or EMAs converged/flat, or 200 on top → **fails structure** (turnaround, not A+).
- Price above the analyst mean target / at ATH after a one-day spike → **chase, not A+**.
- Nosebleed valuation with flat/negative EPS growth → **fails valuation**.
- Catalyst macro-inverted (oil shock vs airline, rates vs rate-sensitive) → **fails catalyst**.

See memory: `reference_aplus_screening_and_screener_dsl.md` (the war-room lessons), `feedback_dilution_check.md` (INDO), `feedback_no_hallucination.md`.
