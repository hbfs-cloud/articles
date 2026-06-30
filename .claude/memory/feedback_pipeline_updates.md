---
name: Pipeline Progress Updates Format
description: Include current time in pipeline/batch progress updates so user knows when each check happened
type: feedback
---

Always include the current time (HH:MM) in pipeline progress updates.

**Why:** User can't tell when each update happened without a timestamp — "batch 15/42" means nothing without context.

**How to apply:** Start every progress line with the time, e.g. "**11:42 —** Batch 15/42 — 33%, 70/208 fichiers..."
