---
name: screener-mcap-filter
description: RunScreener DSL MUST include market_cap filter (>$2B) or returns only penny stocks — cloud scanner routine v4 fix
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ac53259d-133a-4f6b-a082-5b75b9663be7
---

The scanner-pipeline skill (`.claude/skills/scanner-pipeline.md`) Phase 1 said "RunScreener (3 DSL)" without specifying queries. Agents were left to craft their own DSL — sometimes omitting the `market_cap` filter, which makes RunScreener return only penny stocks (the full market is scanned, and junk tickers dominate via inflated volatility scores).

**Why:** Discovered 2026-06-25 when the cloud routine's RunScreener returned 60 penny stocks (YYGH $509K, BMGL $11M etc.). The agent ignored the junk and invented its own picks — fragile and non-reproducible. Root cause: the skill didn't specify the exact DSL queries, so every agent was improvising differently.

**How to apply:** The skill now has 5 explicit DSL queries with market_cap floors ($5B-$20B depending on strategy). Every RunScreener pass_expr MUST include a market_cap filter. Safety check: if ALL returned candidates have mcap < $500M → screener is broken → STOP + alert. Cloud routine also updated to v4 (trig_016idAivWzRTwcoeGnUgJB2S) with the same queries. Tiered sizing still applies: $2-10B ×0.5, $10-50B ×0.7, >$50B ×1.0.

Related: [[tiered-mcap-oscillation]], [[candlestick-no-mcp]], [[mcp-hard-stop]]
