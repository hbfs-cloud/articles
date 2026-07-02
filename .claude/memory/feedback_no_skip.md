---
name: feedback-no-skip
description: "Never skip any pipeline step (MCP enrichment, anti-dilution, risk gating, validation) without explicit user consent."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 662cd4e6-89e0-4a1d-845e-ca0682626e19
---

Never silently skip ANY step of the /scanner pipeline (anti-dilution, GetInstruments, QueryData enrichment per ticker, risk gating, correlation matrix, 7-agent validation, etc).

**Why:** A scan that publishes without per-ticker QA enrichment is unsafe — dilution risks, earnings surprises, dark-pool sells, smart-money short signals all stay invisible. The user explicitly built these checks into the pipeline because they have produced past disasters when skipped.

**How to apply:** Before skipping any phase, step, or per-ticker check, ASK the user. Default = complete every step in the skill/command spec. Token budget or time pressure are NOT valid reasons to skip silently. If a step seems too costly, propose explicitly and wait for the answer.

**Mandatory per-ticker checks** (run for EVERY candidate top-10 + tkl_pool):
- Anti-dilution: `QueryData(types='sec_filings,flags', days=180)` — disqualify dilution_risk_score≥70, S-3 active, ATM, aggressive underwriter, ITM warrants, recent PIPE
- Per-ticker enrichment: `QueryData(types='quote,social_sentiment,capital_flow,insider_transactions,dark_pool,unusual_options,trading_signals')`
- Earnings proximity: `GetEarningsCalendarFiltered(days_ahead=7)` AND `days_until_earnings(SYMBOL)` — disqualify or tag "earnings risk" if within ±3 trading days
- Economic event proximity: `is_near_economic_event(currency, min_priority=2, within_days=3)` per relevant currency
- Risk gating: `GetRegimeProbability`, `GetCorrelationMatrix` (top10), `OptimizeSizing`

> ⚠️ Note 2026-07 (surface MCP v5) : ces trois noms sont des alias serveur legacy (HTTP direct OK) mais
> plus découvrables via ToolSearch. Canoniques : `GetMarketContext(facets='regime', model='ensemble', horizon_days=5)`,
> `PortfolioRisk(action='correlation', symbols='CSV', lookback_days, method)`, `PortfolioRisk(action='sizing', signals=[...], constraints={...}, mode)`.
> Note ajoutée, historique non réécrit.
