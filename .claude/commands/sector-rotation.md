<!-- workflow-contract: sector-rotation -->
# /sector-rotation

Produce a US sector-ETF rotation view from exact-close bars. Read
`.claude/skills/source-policy.md` and `.claude/skills/sector-rotation.md`.

```bash
node tools/validate-workflows.js --workflow sector-rotation
bash tools/run-collect.sh rotation data/workflow-runs/sector-rotation/YYYYMMDD \
  --var date=YYYYMMDD --var refdate=YYYY-MM-DD
```

Compute every return, relative-strength rank and correlation locally from `bars_sectors`, `bars_bench`
and `correlations`. `performance_rotations` is detached context: its undeclared aggregation window cannot
define a weekly/tactical rank. Individual stock leaders require a separately verified scanner/analysis
snapshot; do not invent them from sector membership.

Hash the snapshot, run Senior QA, Contrarian and Retail War Room, then strict local QA. Publish or notify
only when the invocation authorizes it. A missing sector close yields no rank, not a fallback quote.
