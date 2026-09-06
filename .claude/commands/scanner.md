<!-- workflow-contract: scanner -->
# /scanner

Run the canonical US scanner pipeline for the requested session. `$scanner` and `/scanner` are aliases.

## Sources of truth

Read, in this order:

1. `scanner/CLAUDE.md`
2. `.claude/skills/source-policy.md`
3. `.claude/skills/llm-script-boundary.md`
4. `.claude/skills/scanner-pipeline.md`
5. `data/scanner-filters.json` and the scanner JSON schema

The skill defines the phases and failure policy. Executable filters and schemas define numerical rules;
do not copy thresholds from old articles, memories or historical command versions.

## Inputs

- no argument: derive the next target session with `tools/lib/market-calendar.js`;
- `--date YYYYMMDD`: explicit target session;
- `--dry-run`: collect, select, render and validate locally; do not publish, notify or push;
- `--publish`: explicit authorization to index, commit/push and notify after every gate passes;
- any skip flag: forbidden unless the user explicitly authorizes that exact skip in the current session.

`date` is the target session. `refdate` is the last completed US close. Calculate both once and keep them
immutable for the run. Do not infer one from the other inside a plan.

## Deterministic procedure

1. Validate the active plans before calling an MCP:

   ```bash
   node tools/validate-workflows.js --workflow scanner
   ```

2. Run the scripted collector. It owns token-safe authentication, retries, polling, pagination, tracking,
   the lifecycle sweep and US-only rotation:

   ```bash
   bash tools/scan-parallel.sh YYYYMMDD YYYY-MM-DD YYYY-MM-DD
   ```

3. Validate every required harness with `check-freshness.js` and
   `validate-workflows.js --run-plan`. A missing artifact, stale close, source error, pagination error or
   systematic health failure stops the run. Do not substitute web data or model knowledge.

4. Build the eligible set only from the immutable collected snapshot. Apply the executable scanner
   filters, SEC/earnings evidence, recent-family overlay, open-position exclusions and diversification.
   Rank with a stable ticker tie-breaker. The universe is US-listed stocks and US-listed ETFs only.

5. Consume DTX Contract V2 exactly as described by `scanner-pipeline.md`. Capture authenticated
   `DtxBookEquity({portfolio:"best"})` to the dated `_dtx` staging file and verify its portfolio and exact
   close offline with `dtx-book-equity-ingest.js --expected-close <refdate>`. Never merge metrics from a
   different-vintage `DtxStats` response.

6. Write structured `signals.json`/`data.json`, then render. Preserve the existing Finviz chart source
   unless the user explicitly requests a chart-provider change.

7. Run the blocking checks:

   ```bash
   node tools/validate-scan.js scanner/YYYYMMDD/
   node tools/validate-horizon-risk.js scanner/YYYYMMDD/
   node tools/qa-check.js scanner/YYYYMMDD/ --strict
   node tools/check-ai-tells.js scanner/YYYYMMDD/index.html --strict
   node tools/test-scanner-quality-gates.js
   ```

8. Give the same hashed snapshot to three independent reviews: Senior QA, Contrarian and Retail War
   Room. Reviewers may identify faults but may not recollect data or waive a script failure. Fix every
   blocker, rerun affected checks, and require zero blockers.

9. Run downstream compute locally. Diff the hashes of structured inputs before and after review; rerun
   compute whenever they changed. Inspect required generated images.

10. The default output is local. Distribute only with `--publish` or an explicit publication/push request
    in the current user message, and only after all gates pass. Stage explicit scanner/status/API files,
    never `.mcp.json`, tokens, `_data*`, `_dtx`, request IDs or unrelated work. Verify the reachable page
    before sending a notification.

## Hard boundaries

- Never call broker/account/order tools.
- Never invent a ticker, level, score, SEC classification, correlation or DTX field.
- Never force ten names when fewer pass; use the minimum/no-setup outcomes in the canonical skill.
- Never execute both DTX `actions.CREATE` and `execution_plan.groups`.
- Never expose MCP token values in terminal commands, logs, files, chat or commits.
- Never use current web data to repair a point-in-time scan. Web is limited by `source-policy.md`.
