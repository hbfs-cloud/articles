<!-- workflow-contract: desk -->
# /desk

Orchestrate only the products due for the current US session. `/desk` does not weaken or replace the
individual `daily`, `weekly`, `scanner`, `retro`, `signals-desk`, `aplus` or event runbooks.

## Authority

Read `.claude/skills/source-policy.md`, `.claude/skills/llm-script-boundary.md` and the local manual for
every due product. `tools/desk-plan.js` owns cadence/calendar decisions. `tools/desk-run.sh` owns shared
collection and deterministic pre-publication gates. Neither script writes editorial claims or authorizes
external publication.

## Arguments

- no argument: all products due;
- `--only scanner,daily`: restrict the planner to the listed products;
- `--skip retro`: exclude listed products explicitly;
- `--plan-only`: write the plan without authentication or collection.

Unknown arguments are errors. Publication suppression is handled by stopping before the explicit publish
step; it is not a collector flag.

## Procedure

1. Validate the shared desk plans:

   ```bash
   node tools/validate-workflows.js --workflow desk
   ```

2. Inspect the plan before collection when useful:

   ```bash
   bash tools/desk-run.sh --plan-only
   ```

3. Run collection with the requested `--only`/`--skip` filters:

   ```bash
   bash tools/desk-run.sh
   ```

   The runner derives `date` and `refdate` once, requires server-bound marketdata and systematic tokens,
   validates the governing socle, launches only due plans, and fails closed on required collection or
   freshness errors. Token values enter only through a secret environment or masked prompt.

4. Read `data/desk/YYYYMMDD/plan.json`. A product listed as blocked is not silently dropped or replaced.
   Run each due product's own selection, structured-output, rendering and deterministic QA procedure
   against the collected snapshot.

5. Hash the governing inputs, then give that identical snapshot to three independent reviews:
   Senior QA, Contrarian and Retail War Room. Reviewers may not recollect data, mutate files concurrently,
   waive executable gates or infer missing facts. Resolve every blocker and rerun affected checks.

6. Keep compute and distribution separate. Compute may run locally after deterministic validation.
   Publication, Substack, Telegram, email, commit and push occur only when required by the due product and
   authorized by the current invocation. Verify the reachable artifact before notification.

7. Record each actual publication and reconcile disk against the publication ledger:

   ```bash
   bash tools/desk-run.sh --verify
   ```

## Hard boundaries

- No broker/account/order MCP in content workflows.
- No hard-coded ticker or strategy substitute for a missing extraction step.
- No current web fact may repair a stale or missing MCP numerical source.
- No reviewer can turn an unverified or incomplete product into a pass.
- No `.mcp.json`, token, runtime `_data` staging or unrelated work is staged.
- No email bypasses `publication-gate.js`; authorization and ledger recording remain atomic.
