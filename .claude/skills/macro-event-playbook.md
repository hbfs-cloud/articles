---
name: macro-event-playbook
description: Deterministic conditional market playbook around a verified macro event.
user_invocable: true
---

# Macro Event Playbook

`.claude/commands/macro-event-playbook.md` is the operational authority. This workflow prepares reactions;
it does not predict the release.

## Rules

- The governing event artifact must contain the event identity, date, time, timezone and any stated
  consensus. Unknown fields remain unknown.
- An official calendar may verify event timing. Search snippets, forecast blogs and memory do not replace
  a missing consensus or numerical market input.
- Cross-asset levels and changes come from bounded `bars_macro` with one reference close.
- Detached live context is explicitly timestamped and cannot be relabeled as the reference close.
- Write mutually exclusive hotter/in-line/cooler (or event-appropriate) conditions. Each branch states the
  observable trigger, likely factor transmission, no-chase condition and invalidation.
- Do not use portfolio positions, accounts or broker tools. “De-risk” remains general factor-risk guidance.

Review the prior playbook using its original branches and horizon. Do not score a branch as correct merely
because one instrument eventually moved in the same direction.
