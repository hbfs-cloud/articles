<!-- workflow-contract: squeeze-radar -->
# /squeeze-radar

Produce a US-only pre-squeeze watch radar, not an automatic buy list. Read
`.claude/skills/source-policy.md` and `.claude/skills/squeeze-radar.md`.

```bash
node tools/validate-workflows.js --workflow squeeze-radar
bash tools/run-collect.sh squeeze-universe data/workflow-runs/squeeze/YYYYMMDD/universe \
  --var date=YYYYMMDD --var refdate=YYYY-MM-DD
node tools/extract-universe.js --in data/workflow-runs/squeeze/YYYYMMDD/universe \
  --out data/workflow-runs/squeeze/YYYYMMDD/vars.json --strategy short_squeeze --limit 36
bash tools/run-collect.sh squeeze data/workflow-runs/squeeze/YYYYMMDD/verify \
  --var date=YYYYMMDD --var refdate=YYYY-MM-DD \
  --vars-file data/workflow-runs/squeeze/YYYYMMDD/vars.json
```

Require per-symbol short-interest/CTB/FTD, exact-close bars, SEC/flags and earnings-window evidence.
Unknown dilution, stale short data, missing candidate coverage or an active equity-capacity overhang is a
reject. Options/dark-pool context is detached and cannot rescue a failure. Derive levels from structured
bars and label the output as a volatile watch setup with no-chase invalidation.

Run Senior QA, Contrarian and Retail War Room on one hashed snapshot, then strict local QA. A zero-name
radar is valid. Publish or notify only when explicitly authorized.
