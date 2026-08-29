---
name: daily-weekly-analysis-workflows
description: Shared editorial checklist for deterministic daily, weekly, ticker-analysis and retrospective products.
user_invocable: false
---

# Daily, Weekly and Analysis Workflows

The command files are operational authorities: `.claude/commands/daily.md`, `weekly.md`, `analyse.md`
and `retro.md`. Source/security rules are in `.claude/skills/source-policy.md`. Never reconstruct an old
procedure from a historical artifact.

## Shared Sequence

1. Resolve the real UTC/local date and exact last completed market close.
2. Run the configured plan through `run-collect.sh`; do not replay its MCP calls manually.
3. Select topical names from current plan output, then run the dynamic focus/verification plan.
4. Gate both harnesses with freshness and `validate-workflows.js --run-plan <plan> <out>`.
5. Compute levels, returns, valuation and score components in local code. Missing input is `na` or a
   block, never an LLM estimate.
6. Run Bull/Bear/Retail war room before drafting. Include one falsifiable contrarian read.
7. Render from structured JSON where the product supports it.
8. Run strict local QA, AI-tell checks, senior review, apply fixes, and rerun affected checks.
9. Publish/notify/push only when authorized and after all gates.

## Daily

- Article date and market `refdate` are separate explicit variables.
- Base plan covers US indices, sectors, rates/oil proxies, gold/silver and major crypto.
- Select 2-6 focus names from current movers/events. The focus plan then collects bounded bars,
  technicals, fundamentals, news/SEC, institutional flows, correlation and per-symbol move attribution.
- A daily may discuss Europe/Asia using MCP or properly attributed current sources, but may not present
  a search snippet as numerical market data.
- Trade levels come from the current scanner or a separately validated trade-idea payload. No portfolio,
  personal positions, equity or account data.
- Keep the established daily layout/template; do not use a file-size/word-count target to pad prose.

## Weekly

- Folder date is the Monday of the covered week; `refdate` is the prior completed close.
- Base plan proves weekly cross-asset/sector closes and gathers the coming earnings/macro calendar.
- Focus names are dynamic and receive the same evidence stack as daily, with a longer bounded bar window.
- Separate observed facts, base case, bull/bear scenarios and invalidation dates. Do not label an
  aggregate “weekly” unless its source declares that window.
- Keep the established weekly layout/template. Density follows new information, not a byte quota.

## Ticker Analysis

- Archive/inspect an existing dossier before replacement; preserve user-requested chart sources and the
  established renderer.
- `GetInstruments` and async `QueryData` results must be paginated to exhaustion.
- Required evidence: exact-close bars, technicals, fundamentals/earnings/analyst actions, SEC/flags,
  corporate actions/news, insiders/institutional holdings, short/CTB/FTD/dark pool, options and composite
  symbol signals.
- For every SEC hit, open the primary filing and classify security/capacity. “No hit” means “none found in
  the verified window,” never a timeless “no dilution.”
- Compare any claimed idiosyncratic move with peers/sector over the same window.
- Verify price scale after splits, stop-vs-stated-average consistency, current entry actionability and
  target reachability.
- Validate the structured dossier with `check-analysis-editorial-quality.js --strict --pre-review`, obtain
  the required external AQ-1 review manifest, then rerun strict validation.

## Valuation

`tools/lib/valuation-multi.js` receives only collected inputs. Missing FCF, capex, shares, beta, debt or
other required fields disables the affected method. The LLM narrates the output but cannot change model
weights, WACC, scenarios, gaps or confidence. Use asset-appropriate metrics (including bank-specific
metrics where relevant).

## A+ Labels

The active A+ definition and executable gate are in `.claude/commands/aplus.md` and
`validate-aplus-candidates.js`. A dossier grade and an A+ setup label are not synonyms. A+ requires all
four eliminators, actionability at current spot, clean/verified SEC and corporate-action evidence,
score >=92 and a 3/4 adversarial vote with no critical error.

## Retrospectives

Use point-in-time scanner proposals and intraday evidence for fills/stops/targets. A daily bar cannot
prove event order. Future scans, unresolved horizons and no-fill proposals remain separate denominators.
Review performance by mature cohort, family and regime; hash-bind any overlay derived from the result.
