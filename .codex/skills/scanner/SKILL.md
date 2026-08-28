---
name: scanner
description: Run the DailyTickers /scanner workflow in Codex by following the Claude scanner runbook and scanner-pipeline rules.
metadata:
  short-description: Daily scanner pipeline
---

# Scanner

This is the Codex shortcut for the historical Claude `/scanner` command.

When invoked as `$scanner` or when the user asks to run `/scanner`:

1. Read `.claude/commands/scanner.md`.
2. Read `.claude/skills/scanner-pipeline.md`.
3. Read `.claude/skills/llm-script-boundary.md`.
4. Follow all blocking gates from the runbook: no-skip, reference-date contract, freshness gates,
   risk gating, panel before push, and no fabricated market data.
5. The editorial universe is US-listed securities only: 8 stocks and 2 US-listed ETFs. Never call an
   EU/APAC screener, build an EU fallback, or produce an EU ETF staging.
6. Use the Codex MCP equivalents for marketdata/systematic tools. If a required MCP tool or token mint is
   unavailable, stop instead of substituting stale or guessed data.

For compatibility, this skill is intentionally a thin pointer. The source of truth remains the Claude
runbook and scanner-pipeline skill.
