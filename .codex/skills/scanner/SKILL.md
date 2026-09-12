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
7. DTX is excluded by the owner-approved `config/scanner-components.json`. The canonical script creates
   the dated `_scope.json` and runs only marketdata discovery, tracking and rotation. No systematic token,
   DTX decision, replay or book-equity response is required. Keep all other gates and propagate the scope
   to QA/status/API tools; do not refresh or relabel old DTX history.

For compatibility, this skill is intentionally a thin pointer. The source of truth remains the Claude
runbook and scanner-pipeline skill.

## Documentary publication after an incomplete scan

An explicit user request to publish may publish a **review_only surveillance article** while
trade certification is incomplete. This is a separate product, never a waiver or PASS of the
ordinary scanner gates. Follow `tools/lib/SCANNER_PUBLICATION_REVIEW.md`: validated public
evidence, no new order/levels/probability, three independent editorial/contrarian/technical
reviews, exact renderer validation, and publication-only status/API guards. Preserve the
original signal files, positions, performance dates and excluded DTX components.
Run `tools/validate-scanner-review.js ... --publication` in addition to article QA.
Do not call tracking, reconciliation, normal publish.js or notifications for this mode.
The 20260908 source adapter and editorial template are date-pinned: a later edition requires
new event classification and editorial review, not a date substitution.
