---
name: desk
description: Orchestrate only due DailyTickers products when the user invokes $desk or /desk.
---

# Desk

Read `.claude/commands/desk.md`, `.claude/skills/source-policy.md`, and each due product's runbook. Use
`tools/desk-plan.js` and `tools/desk-run.sh` for deterministic planning and collection. Do not infer that
collection authorizes publication; follow the explicit side-effect boundary in the command.
