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

## Grille A+ empirique — 4 éliminatoires + scoring (cohorte 29 setups, juin 2026)

En PLUS des 5 axes ci-dessus, appliquer cette grille de scoring validée empiriquement.

### ÉLIMINATOIRES — Absence = plafond A (max 88/100), aucun passe-droit

1. **Guidance relevée** — Le management a EXPLICITEMENT relevé sa guidance au dernier trimestre. 100% des A+ l'ont, 91% des A ne l'ont pas. Discriminant #1.
2. **EPS beats consécutifs ≥ 5 trimestres** — Combiné à la guidance, identifie 79% des A+ et exclut 91% des A.
3. **PE forward < 35x** — Exception UNIQUEMENT si : monopole technologique mondial + croissance EPS >25%/an + PEG < 2. Documenter l'exception. Cas validé : ASML (PE=37, monopole litho, +9.6% en 8j).
4. **Extension EMA20 ≤ 3%** — Au-delà = risque de pullback avant continuation. DECK seul A+ sous-performeur avec ext 3.8%.

### CRITÈRES PONDÉRÉS (score total /100)

| Critère | Poids | Seuil A+ |
|---------|-------|----------|
| PEG ratio | 15 pts | < 1.5 |
| Buyback actif | 8 pts | Oui (93% des A+ l'ont) |
| Dividende actif | 7 pts | Oui |
| Structure technique | 20 pts | Consolidation propre > 3 semaines, EMA20>EMA50>EMA200 rising, RSI 50-68, pas de chop |
| R/R ratio | 15 pts | ≥ 2.5 (TP1 ≥ entry + 2.5×(entry - stop)) |
| Catalyseur SEC vérifié | 15 pts | 8-K/10-Q récent propre, aucun flag insider/short |

**Seuils :** A+ ≥ 92/100 (les 4 éliminatoires passés + score pondéré élevé), A ≥ 88/100 (peut échouer sur 1 éliminatoire).

### EXCLUSION AUTOMATIQUE
- Earnings dans les **10 prochains jours** → noter comme "earnings play", pas swing A+.

### Leçons empiriques (horizon 8 jours, cohorte 29 setups)
- A+ : moy **+4.2%**, 0 stop, 2 TP1 — tous restent au-dessus du stop
- A hors earnings : moy +0.3%, 1 stop (DGX = sans guidance + ext 3.5%)
- A avec earnings nocturnes (MRVL, NBIS, COHR, CIEN) ont explosé → régime différent (earnings play)
- **Note ASML** : PE=37 validé A+ car monopole litho mondial + carnet multi-années + guidance relevée + 5 beats + ext <1% + PEG 1.9. Performance +9.6% en 8j.

## Pipeline (MCP-driven, no hallucination)

### 1. Regime context
`RunAutoScreener` → use ONLY its `regime` / `risk_tolerance`. Its candidate picks are hot-movers/overbought junk — ignore them for A+.

### 2. Screen a liquid pool (loose, then post-filter in code)
`RunScreener` returns jobs (async → poll `Jobs(job_id=...)`, canonique, ex-CheckJobStatus). **DSL gotchas (verified):**
- `ema`/`sma` need 2 args: `ema(close,20)` (one-arg errors).
- **`abs()` is unsupported in `score_expr`** → using it returns 0 candidates silently. Keep `score_expr` simple (`rsi14`).
- An `ema(close,20)>ema(close,50)&&…` *pass_expr* returns 0 — don't gate the screen on the EMA stack; verify it per-ticker instead.
- `RunScreener` candidates carry only `symbol,last_price,market_cap,rsi,macd,atr,volume` (NO sma/sector — those are only in `RunAutoScreener`).
- For ACTIONABLE (not-extended) names use a lower RSI band: `pass_expr "rsi14>48 && rsi14<60 && macd>0 && vol>2500000"`, `top_k 90`. (A 53–67 band biases toward already-extended names.)
Post-filter: `market_cap >= 2-3e9`, drop tickers already covered (existing `analyses/*` dirs + current A+ batch + the previous month's batch).

### 3. Verify éliminatoires + critères on REAL data (batch QueryData — symbols comma-separated)
- `QueryData types=earnings_quarterly limit=8` → keep only **≥5 consecutive beats**. Also check: **did the company raise guidance?** (search earnings call summary or `QueryData types=news` for "raised guidance" / "raised outlook"). No guidance raise = cap at A.
- `QueryData types=technicals` → confirm **EMA20>EMA50>EMA200 rising** AND compute **extension% = (price/ema20 − 1)×100** (**reject if >3%**). Get ATR for stops.
- `QueryData types=stats` → pegRatio, **forwardPE** (reject >35x unless documented exception), enterpriseToEbitda, priceToBook, beta, shares, shortPercentOfFloat. Check **buyback program active** + **dividend active** (8+7 pts).
- `QueryData types=flags` → is_compliance_issue / halted / ftd.
- **Dilution:** `WebSearch "<company> SEC EDGAR S-3 ATM offering"` + `"<company> shares outstanding"` + check for M&A stock deals / mandatory convertibles / SBC. For recent IPOs (e.g. CRDO/ALAB) scrutinize post-IPO share growth — these FAIL the clean-flags axis if an ATM/S-3 is active.
- **Event / corporate-action screen (MANDATORY — FOXA lesson):** `QueryData types=news` + `WebSearch "<company> acquisition merger split spinoff secondary"`. **REJECT if a pending binary corporate action can gap the stock through the stop** — including the company as **ACQUIRER** (FOXA A+ −17% gap when it announced a $22B Roku acquisition), a pending secondary, a stock-split, or a litigation/regulatory ruling inside the trade window. Earnings already covered by the ±3d rule.
- **Abnormal-volume / informed-flow check:** `QueryData types=quote` → if today's volume > 3× the 50-day avg (or a one-day move >2×ATR) **without a known benign catalyst**, treat as informed flow → demote or reject (a pending news event is likely).
- **Price-scale sanity (MANDATORY — KLAC lesson):** the entry/stop/TP printed in the article MUST be in the **same scale as the live quote**. Cross-check entry vs `QueryData types=quote` price — if it deviates by ≥2× (or ≈10×), it's a **stock-split / unadjusted-quote / typo error** (KLAC printed $2120 entry on a $212 stock post a ~10:1 split). Also sanity-check ATR, EMAs and the 52-week range are in the same scale.
- **R/R-at-spot:** entry near EMA20/support, stop below EMA50 or ~1.6×ATR, TP1 at structure. R/R must be ≥1.5 at that entry. Reject "fictional R/R" names.

### 3b. Post-entry management — anti-give-back
Every published A+ plan must include a real stop and this management ladder. The stop only ratchets upward on confirmed daily closes, never on intraday wicks.

- +1R → stop to breakeven.
- +2R → partial TP or trailing stop.
- +20% latent gain → stop floor at `entry × 1.10`.
- +30% latent gain → stop floor at `entry × 1.18`; sell 1/3 if the move is vertical, gap-driven, or volume-extreme.
- +40% latent gain → sell 1/3 to 1/2 automatically; remaining stop ≥ `max(current_stop, entry × 1.25, highest_daily_close × 0.85)`.

This is the KLAC lesson: an ATR trail can widen after volatility expands, so a +40% runner must not be allowed to give back most of the move.

### 4. Select ~10 with sector diversity + basket sanity
Check correlation/concentration (e.g. aero + airline can be one oil/rate-cyclical bet at corr 0.70; banks cluster high-beta-to-SPY). Aim for genuinely independent bets, and fit to the regime (don't load a high-beta cyclical bloc into a neutral/early-risk-off tape).

### 5. War-room verify BEFORE publishing (mandatory)
Run an adversarial panel per ticker (Workflow): **quant / PM-alpha / risk / short-seller** lenses, each re-fetching fresh MCP data. Each panelist checks:
1. The **4 éliminatoires** (guidance raised? ≥5 EPS beats? PE fwd <35? Extension EMA20 ≤3%)
2. The **6 critères pondérés** (PEG, buyback, dividend, structure, R/R≥2.5, SEC clean)
3. Total score /100 — vote "A+ deserved" only if score ≥92 AND all 4 éliminatoires pass.
Default to NO if any éliminatoire fails or score <92. Keep A+ only if ≥3/4 vote yes AND no critical error. Add a "missed-candidates" re-screen + a basket/correlation review. This is the gate that catches over-grading.

## Article production — Structured JSON pipeline
Each agent produces a **JSON file** conforming to `tools/lib/analysis-schema.json`, NOT raw HTML.
The deterministic render engine (`tools/render-analysis.js`) converts JSON → HTML with all conventions baked in (GTM, brand-bar, FAB, footer, ECharts gauge+radar, source-refs, chart embeds).

- Output JSON to `data/analyses-data/{TICKER}.json`
- Reference JSON: `data/analyses-data/MATX.json`
- `meta.assetType`: "stock" for equities. The renderer auto-handles chart sources (Finviz for stock/ETF, TradingView for crypto/forex/commodity), price formatting (forex 4-decimal, crypto no-cent), and section variants.
- Banks: use bank metrics (NII/NIM/ROTCE/CET1/book value) in fundamentals.rows, NOT gross margin/EBITDA; set `header.halal = false`.
- Never ship `N/A` values; risk gauge score 1–10 (not 22/10); unique ticker in header.

## Publish
- `node tools/publish-analysis.js data/analyses-data/{TICKER}.json --commit` per ticker (validates → renders → indexes → commits). For batch: `--batch FILE1.json FILE2.json`.
- Quick grade update: `node tools/publish-analysis.js --update {TICKER} --grade A --reason "..." --commit`
- Re-render all after render engine change: `node tools/publish-analysis.js --re-render --commit`
- Update `data/radar.json` by hand (Claude-authored): add an A+ opportunity item.
- A **pre-commit hook** auto-regenerates search/sitemap/feed. Stage specific files only, then commit + push.

## Hard rejection rules (memorize)
- **Guidance NOT raised** → **cap at A** (max 88). This is the #1 discriminant.
- **EPS beats < 5 consecutive** → **cap at A**.
- **PE forward > 35x** without documented monopoly exception → **cap at A**.
- **Extension EMA20 > 3%** → **cap at A** (DECK lesson: 3.8% ext → only A+ to underperform).
- R/R only valid on an un-triggered pullback → **not A+ at spot**.
- Active ATM / S-3 equity / M&A stock deal / mandatory convertible / SBC >15% rev → **fails clean-flags** (even if "non-toxic").
- EMA50 < EMA200, or EMAs converged/flat, or 200 on top → **fails structure** (turnaround, not A+).
- Price above the analyst mean target / at ATH after a one-day spike → **chase, not A+**.
- Nosebleed valuation with flat/negative EPS growth → **fails valuation**.
- Catalyst macro-inverted (oil shock vs airline, rates vs rate-sensitive) → **fails catalyst**.
- **Earnings within 10 trading days** → classify as "earnings play", not swing A+.

See memory: `reference_aplus_screening_and_screener_dsl.md` (the war-room lessons), `feedback_dilution_check.md` (INDO), `feedback_no_hallucination.md`.
