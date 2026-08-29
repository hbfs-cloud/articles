---
name: mcp-gateway-tools
description: Canonical marketdata MCP capability and fail-closed usage rules for DailyTickers content workflows.
user_invocable: false
---

# Marketdata MCP

The executable capability allowlist is `config/workflow-contracts.json`. Read the live tool schema when
adding a capability, update that allowlist and tests, then use the canonical tool name. Do not preserve a
deprecated alias in a reusable plan merely because an older HTTP endpoint still accepts it.

## Transport

- Call `GetStatus` once in the first gate wave.
- Batch independent calls through a plan. Multi-symbol `QueryData` uses `force_async:true`.
- Poll the returned job ID until terminal state; never create a replacement job because one is slow.
- Paginate to exhaustion and reject loops, missing pages or partial results.
- Use a read-only, server-scoped TTL token through secret environment or masked input. Never print it.
- If bars are behind the requested close, use the authenticated `RefreshBars` capability, poll status and
  recollect. If systematic is behind, use its authorized refresh capability and poll `GetHealth` against
  the same expected close. Refresh failure is a stop, not permission to use stale data.

## Date semantics

- `QueryData` daily bars: `end_date=$refdate` plus `freshness.expects_close:true`.
- Screeners: `region:"US"`, explicit asset, `as_of:$refdate`, and async execution.
- `GetMarketContext(facets:"overview")`: requested alone; `as_of` is supported here.
- Other `GetMarketContext` facets, including `regime`: no fake `as_of`; reproducibility comes from the
  immutable collected artifact and hash.
- `GetSymbolSignals` is mono-symbol. Use bounded `foreach`, never a CSV in `symbol`.
- `GetEarningsCalendarFiltered` uses `min_expected_move_pct` when that filter is needed.
- Unknown arguments and hard-coded dates in reusable plans are contract failures.

## Source boundary

Marketdata owns prices, returns, bars, technicals, fundamentals, valuation inputs, calendars, options,
short interest, flows, screening, correlations and risk calculations. Yahoo, chart pages, search snippets
and browser results are not numerical fallbacks. An existing Finviz or other chart may remain a
presentation asset, but it does not prove a published number.

Web access is limited by `.claude/skills/source-policy.md`: primary SEC/IR/official macro documents and
attributed current news. Open the primary document; a search result is discovery only. Missing or stale
MCP evidence removes the claim or blocks the product.

Broker, account and order MCP tools are outside every content plan, regardless of what the session can
access.
