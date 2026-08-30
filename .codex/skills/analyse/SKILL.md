---
name: analyse
description: Build a harnessed DailyTickers single-ticker analysis when the user invokes $analyse or /analyse.
---

# Analyse

Read `.claude/commands/analyse.md`, `analyses/CLAUDE.md`, and `.claude/skills/source-policy.md`. Execute
the runbook exactly, including `validate-workflows.js --workflow analyse`, primary SEC evidence, the
analysis quality gate and same-snapshot reviews. Preserve the configured chart source.

Every analysis must use the visible `marketdata` MCP surface described in `TOOLS.md`, not only the
single-symbol composite. Discover and classify the economically relevant leaders, direct peers, upstream
suppliers, downstream beneficiaries, second-order exposures and sector/ETF benchmarks. Collect their
point-in-time bars and the available company/event context, calculate correlation, beta, R-squared and
relative performance on the same reference close, and publish a structured blast-radius section with
bullish, mixed and bearish transmission paths. A correlated symbol is not automatically a peer; explain
the economic link and contradictions. Missing or stale facets stay explicit and never become neutral facts.

Maintain a coverage matrix for the visible marketdata facets: market state, quote/profile, fundamentals,
earnings and reactions, analysts, daily/intraday technical structure when relevant, options, official SEC
and insiders, institutional holdings, short interest/borrow/FINRA short volume, sentiment/news, seasonality,
correlations and event calendar. Use every returned decision-relevant item by its `type`; explicitly record
unavailable, stale, contradictory or irrelevant facets instead of silently omitting them. Never relabel FINRA
short volume as dark-pool directionality.

Stable files such as `_data/fundamentals.json` are current aliases, not historical snapshots. They are
allowed only when the sibling `harness.json` records `generated_at`, `reference_close`, `plan_sha256`,
the exact source SHA-256 and source `as_of`/`data_through`. Never infer freshness from the alias filename.
Date or content-address primary evidence and archive every published version separately.
