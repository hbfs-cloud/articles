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
4. Read `.claude/skills/source-policy.md` and run `node tools/validate-workflows.js --workflow scanner`.
5. Follow all blocking gates from the runbook: no-skip, reference-date contract, freshness gates,
   risk gating, panel before push, and no fabricated market data.
6. The editorial universe is US-listed securities only. Target 8 stocks and 2 US-listed ETFs, but publish
   as few as 6 stocks plus 2 ETFs rather than force a candidate that fails a gate. Never call an EU/APAC
   screener, build an EU fallback, or produce an EU ETF staging.
7. Use the Codex MCP equivalents for marketdata/systematic tools. Mint the systematic TTL token with
   `scope="refresh"` so stale DTX data can follow the bounded refresh/poll path. If a required MCP tool or
   token mint is unavailable, stop instead of substituting stale or guessed data.
8. Capture `systematic.DtxBookEquity({portfolio:"best"})` through the authenticated Codex MCP tool as
   `scanner/<date>/_dtx/book_equity_best.json`; the readonly subprocess token cannot call this tool.
   Run `tools/dtx-book-equity-ingest.js --expected-close <refdate> --dry-run`; reject a curve not bound
   to `best` and that exact close, and never merge a different-vintage `DtxStats` row into it.

For compatibility, this skill is intentionally a thin pointer. The source of truth remains the Claude
runbook and scanner-pipeline skill.
