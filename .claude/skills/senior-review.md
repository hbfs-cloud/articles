---
name: senior-review
description: Senior multi-persona QA harness — gate every DailyTickers artifact through a panel of senior reviewers (QA Senior, Quant Senior, Trader Senior, Risk/Compliance Senior, Editor Senior) before publishing. Use as the standing release gate on ALL processes (analyses/A+, daily, weekly, retrospective, scanner, series, tech, landing). Trigger keywords: senior review, QA harness, review panel, gate before publish, war room, quant/trader/risk review, harness sur mes process, valider avant publication.
version: 1.0.0
user-invocable: true
argument-hint: "[artifact-paths...] — or omit to review the current diff / pending artifacts"
license: Apache 2.0
---

⚠️ Source de vérité exécutable : `.claude/workflows/senior-review.js` — ce fichier .md est la doc d'usage ; en cas de divergence, le .js gagne.

# Senior Review Harness — the release gate for every process

No DailyTickers artifact ships without passing a **senior panel**. This codifies the war-room discipline (which once caught a "0/10 deserved A+" batch) into a reusable gate. The engine is `.claude/workflows/senior-review.js`.

## The senior panel (each reviewer may FIX in place, then scores 0–100 + flags blocking issues)
- **QA Senior** (front-end/release): GTM-T5Z595CW, brand-bar+brand-nav, correct `data-tab`, `/assets/report.css`, FA 6.4.0, `footer.article-footer`, FAB, ECharts (every container has an init + unique id + resize; no orphan charts), `core.js`+`tag-renderer.js`, `#article-clickable-tags`, no broken links, no inline-CSS overrides, mobile-responsive, `.tm-value`/`.tm-label`, **no template placeholder bugs** (`N/A`, `22/10` gauge, `74.00%` yield), FR accents.
- **Quant Senior** (data integrity): re-fetch via MCP; every price/cap/PE/EV-EBITDA/PEG/beta/margin/EPS-beat/index-move and every computed ratio (R/R, %, win rate, profit factor) must reconcile; no fabricated/stale numbers; performance stats must match the underlying table (no phantom win/return).
- **Trader Senior** (actionability): R/R ≥ 1.5 **at an actionable entry within ~3% of spot** (reject fictional-R/R-on-far-pullback and chasing extended names >~5–8% above EMA20); stop placement, invalidation, event proximity, sizing vs beta/ATR; daily/weekly calls defensible.
- **Risk & Compliance Senior**: SEC dilution (ATM/S-3/M&A-stock/mandatory-convertible/SBC) honestly disclosed; disclaimer present; no invented macro/geopolitics (verify, we are June 2026); balanced bull/bear; catalyst not macro-inverted; basket concentration/correlation.
- **Macro/PM Strategist** (portfolio coherence): the PORTFOLIO-level gate per-trade review misses. **Does the book express its own stated thesis?** — a declared risk-off / reduce-size / defensive posture paired with a high-beta growth/momentum basket is a **BLOCK-level contradiction**. Collapse the basket to its dominant factors (net beta, growth-vs-value, rate-sensitivity, cyclical-vs-defensive, sector/geo concentration) and flag when a "diversified" list is secretly ONE bet; check event positioning (is the book long the exact factor the named CPI/Fed/oil catalyst threatens?) and narrative↔actual-risk match. FIX by reweighting/trimming/cutting the contradicting names OR correcting the narrative — thesis and positions must AGREE. The "a good analyst dismantles it in 30 seconds" gate.
- **Value/Quality Board** (5 deterministic investor personas): a NUMERIC persona (like Quant/Trader) that RECALCULATES, it does not re-read prose. Embeds `tools/lib/value-quality-board.js` — 5 investor personas as **numbered threshold grids** (Buffett/Quality, Graham/Deep-value, Lynch/GARP, Munger/Moat, Burry/Contrarian), ported from virattt/ai-hedge-fund's quant grids (no LLM in the scoring: same inputs → same votes). For each single-stock fundamental claim it fetches `QueryData(types=financials,stats,quote)`, runs the module, and gets 5 pivot-schema votes `{signal, confidence, reasoning}` + a confidence-weighted board verdict. **Flags** claim↔number contradictions (e.g. "Buffett-quality" but ROE 9% < 15% threshold; "deep value" but P/B 7.7 / price >> Graham#; "GARP" but PEG 5). **Consultative** — value/quality is one lens, not the whole thesis — it BLOCKs only on a **clear eliminatory contradiction**: a hard headline fundamental label the matching persona flatly contradicts at confidence ≥ 70. **Fail-closed / zero-hallucination**: ratios absent from the MCP surface (FCF, current ratio, ROIC) are marked "insufficient data" and flagged, NEVER invented; MCP down/stale → HARD STOP, no fabricated vote. No fundamental claim in the artifact → returns N/A (score 100).
- **Editor Senior** (FT/Economist desk): accurate headline, coherent structure, ≥1 inline `.source-ref` per section, FT/terminal tone (no hype/filler), FR accents, valid cross-links; never invent facts to fill gaps.

## Type → persona matrix (engine applies automatically)
| type | personas |
|------|----------|
| analyses, scanner | QA · Quant · Trader · Risk · **Strategist** · **Value/Quality Board** · Editor · AI-Forensics (full panel) |
| daily, weekly | QA · Quant · Trader · Risk · **Strategist** · Editor · AI-Forensics |
| basket (trade list / swing set) | Quant · Trader · Risk · **Strategist** · **Value/Quality Board** · AI-Forensics |
| retro | QA · Quant · Trader · Editor |
| series | QA · Quant · Risk · Editor |
| tech | QA · Quant · Editor |
| landing | QA · Editor |

## Gate decision (per artifact)
The release-gate agent returns **PASS** (already clean) / **FIXED** (issues existed, fixed in place, clean to ship) / **BLOCK** (unresolved critical/blocking issue). The weakest critical dimension caps the composite. **BLOCK means do not publish** until the issue is resolved (regenerate or escalate).

## How to run
```
Workflow({ scriptPath: ".claude/workflows/senior-review.js",
           args: { artifacts: [ {path:"analyses/IBKR/index.html", type:"analyses", label:"IBKR"}, ... ],
                   applyFixes: true } })
```
Run it as the **last step before `add_card` + commit** on any process. For a batch (a month's A+, a week's scanner, a new series), pass all artifacts at once — each is reviewed + gated independently (pipeline, no barrier). Only **PASS/FIXED** artifacts proceed to publish; **BLOCK** ones are held and regenerated.

## Wiring into each pipeline (standing rule)
- **A+/analyses** — run after generation, before swap/publish (complements the `aplus-setups` skill's war-room verify).
- **daily / weekly / retro / scanner** — run after the author/fact-check step, before `add_card`.
- **series / tech** — run after authoring, before `add_card`.
Escalate BLOCKs to the user with the blocking[] list rather than shipping.

## Value/Quality Board module (reusable outside the harness)
`tools/lib/value-quality-board.js` is a **pure, deterministic** module usable standalone (scanner value-axis, analyses insert, ad-hoc checks). It does NOT fetch — the caller (an agent) pulls MCP fundamentals and passes them in, so a subprocess can run it with zero MCP access.
```
const { evaluateBoard } = require('./tools/lib/value-quality-board');
const board = evaluateBoard('JNJ', { financials, stats, quote }); // raw MCP data objects
// → { signal, confidence, weightedScore, tally, votes:[{persona,signal,confidence,reasoning,criteria}], dataGaps }
```
CLI for the harness agent (fetch MCP → write JSON → run): `node tools/lib/value-quality-board.js --in fundamentals.json`. Self-test (deterministic, fail-closed): `node tools/lib/value-quality-board.js --self-test`. Thresholds (sourced from `docs/research/ai-hedge-fund-ideas.md` §1/§4): Buffett ROE>15% / op-margin>15% / gross>40% / D/E<0.5; Graham price<√(22.5·EPS·BVPS) / P/B<1.5 / P/E<15; Lynch PEG<1.5 / EPS-growth>10% / rev-growth>5%; Munger ROE>15% / gross>40% / op-margin>20% / D/E<0.7 (ROIC unavailable→fail-closed); Burry P/B<1.2 / EV/EBITDA<8 / net-cash / P/E<15 (FCF-yield unavailable→fail-closed).

See also: `aplus-setups` (A+ selection rigor), memory `reference_aplus_screening_and_screener_dsl.md` (war-room lessons), `feedback_no_hallucination`, `feedback_dilution_check`.
