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
   AS_OF_TIMESTAMP=YYYY-MM-DDTHH:MM:SSZ bash tools/scan-parallel.sh YYYYMMDD YYYY-MM-DD YYYY-MM-DD
   ```

3. Validate every required harness with `check-freshness.js` and
   `validate-workflows.js --run-plan`. A missing artifact, stale close, source error, pagination error or
   marketdata health failure stops the run. Do not substitute web data or model knowledge.

4. Build the eligible set only from the immutable collected snapshot. Apply the executable scanner
   filters, SEC/earnings evidence, recent-family overlay, open-position exclusions and diversification.
   Rank with a stable ticker tie-breaker. The universe is US-listed stocks and US-listed ETFs only.

5. DTX is excluded from the scanner product by `config/scanner-components.json` (owner instruction,
   2026-09-12). `scan-parallel.sh` creates an immutable dated `_scope.json` and uses the marketdata-only
   collection plans. Pass `--scope=scanner/YYYYMMDD/_scope.json` to scope-aware QA, sweep, status/API and
   regime tools. Do not collect, render or refresh the obsolete DTX curve; preserve its standalone history.

6. Write structured `signals.json`/`data.json`, then render. Preserve the existing Finviz chart source
   unless the user explicitly requests a chart-provider change.

7. Run the blocking checks:

   ```bash
   node tools/validate-scan.js scanner/YYYYMMDD/
   node tools/validate-horizon-risk.js scanner/YYYYMMDD/
   node tools/qa-check.js scanner/YYYYMMDD/ --strict --scope=scanner/YYYYMMDD/_scope.json
   node tools/check-ai-tells.js scanner/YYYYMMDD/index.html --strict
   node tools/test-scanner-quality-gates.js --scope=scanner/YYYYMMDD/_scope.json
   ```

8. Give the same hashed snapshot to three independent reviews: Senior QA, Contrarian and Retail War
   Room. Reviewers may identify faults but may not recollect data or waive a script failure. Fix every
   blocker, rerun affected checks, and require zero blockers.

9. Before downstream compute, invoke `Skill(skill="fortress-pm")` and write the resulting
   `fortress_pool` into `scanner/YYYYMMDD/signals.json`. The pool is limited to fact-checked A+
   Halal candidates (`strategy:"FortressA+"`, `sharia:true`); `[]` is valid only after the PM ran.
   A missing key silently falls back to `fortress_fallback` and starves Fortress.

10. Run downstream compute locally. Diff the hashes of structured inputs before and after review; rerun
   compute whenever they changed. Inspect required generated images.

11. The default output is local. Distribute only with `--publish` or an explicit publication/push request
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
