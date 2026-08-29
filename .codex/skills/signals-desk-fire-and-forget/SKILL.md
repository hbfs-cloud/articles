---
name: signals-desk-fire-and-forget
description: Run the lean autonomous DailyTickers signals workflow when the user explicitly invokes $signals-desk-fire-and-forget.
---

# Signals Desk Fire And Forget

Read `.claude/commands/signals-desk-fire-and-forget.md`, `.claude/commands/signals-desk.md`, and
`.claude/skills/source-policy.md`. The lean mode skips presentation depth, never evidence, freshness,
validation or the three reviews. All output is local unless the current invocation explicitly supplies
`--publish`; Substack remains separately opt-in through `--substack-note`.
