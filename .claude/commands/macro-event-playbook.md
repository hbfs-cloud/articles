<!-- workflow-contract: macro-event-playbook -->
# /macro-event-playbook

Prepare conditional reactions around a verified high-priority macro event. Read
`.claude/skills/source-policy.md` and `.claude/skills/macro-event-playbook.md`.

```bash
node tools/validate-workflows.js --workflow macro-event-playbook
bash tools/run-collect.sh macro data/workflow-runs/macro-event/YYYYMMDD \
  --var date=YYYYMMDD --var refdate=YYYY-MM-DD
```

The event artifact must prove date/time/consensus; primary official calendars may verify narrative facts
but cannot replace missing market numbers. Compute cross-asset state from bounded `bars_macro`. Detached
live rates/currency/commodity/prediction context must be timestamped as current and cannot be relabeled as
the reference close.

Write bull/base/bear conditions and explicit invalidations, not a disguised directional bet. Give the
same snapshot to Senior QA, Contrarian and Retail War Room, resolve blockers and run local QA. Publication
and notification remain explicit side effects.
