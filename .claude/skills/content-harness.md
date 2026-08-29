---
name: content-harness
description: Shared fail-closed evidence, freshness, review and publication harness for DailyTickers content workflows.
user_invocable: false
---

# Content Harness

This skill defines the shared phase order. `.claude/skills/source-policy.md` owns source and side-effect
boundaries; `config/workflow-contracts.json` and executable domain validators own tool arguments and
numeric gates. Historical matrices and article examples are not contracts.

## H0 - Immutable run identity

1. Resolve `date`, the exact last completed US close `refdate`, target artifact and workflow once.
2. Validate the configured plans before collection:

   ```bash
   node tools/validate-workflows.js --workflow WORKFLOW
   ```

3. Check the destination index for duplicates. A retry reuses the same inputs and, for DTX, the same
   request ID.
4. Memory may provide hypotheses or known failure modes; it never supplies a market fact or silently
   changes a structured decision.

## H1 - Scripted collection

Use `tools/run-collect.sh` or the workflow-specific orchestrator. Plans must start with a blocking
`GetStatus`, plus `GetHealth(expected_close=$refdate)` whenever systematic is used. Required calls live
in governing waves; optional context lives in detached waves and cannot govern numbers, candidates,
scores or publication.

Tokens are read-only and server-scoped. Their values enter through a secret environment or masked input,
never argv, logs, files, chat or commits. Missing auth, stale health, source errors, duplicate async jobs,
incomplete pagination and unresolved variables stop the run.

## H2 - Evidence and freshness

`collect.js` writes the artifact path, reference close, normalized input hash, plan hash and a SHA-256 for
every collected source. It also journals every executed/skipped call. After collection run:

```bash
node tools/check-freshness.js OUTPUT/harness.json
node tools/validate-workflows.js --run-plan plans/PLAN.json OUTPUT
```

A required source must have an artifact, matching hash and complete close proof. A recent collection
timestamp does not prove that the payload reaches `refdate`. Historical harnais remain immutable; legacy
missing proof is disclosed, never backfilled from memory.

## H3 - Domain validation

Structured output is written before prose or HTML. Run the relevant executable gate:

- scanner: `validate-scan.js` and strict scanner QA;
- signals: `validate-trade-ideas.js`;
- A+: `validate-aplus-candidates.js`;
- analysis: schema, editorial-quality and renderer checks;
- daily/weekly/retro: their command-level arithmetic, denominator and content QA checks.

The model may explain or reject a structured candidate. It may not invent or repair a missing ticker,
price, ATR, target, stop, score, SEC classification, correlation, DTX field or historical outcome.

## H3bis - Channel contract

- Web output is French and declares `<html lang="fr">`.
- Telegram output is French, concise, actionable and self-contained. A link is optional context, never a
  substitute for the thesis, decisive facts, action/condition and invalidation in the message itself.
- Substack output is English, concise, actionable and self-contained. It contains no website URL, backlink,
  CTA to the website, mention of a full version elsewhere or dependency on the French web article.
- Channel variants use the same hash-bound source snapshot. Numeric facts, levels and invalidations must agree
  exactly across variants; translation or condensation never authorizes a new fact.

A language mismatch, non-autosufficient short format, website reference in Substack or cross-channel numeric
drift is a publication blocker and must be included in the Senior QA, Contrarian and Retail War Room review.

## H4 - Same-snapshot reviews

Hash governing inputs, then give the identical snapshot to Senior QA, Contrarian and Retail War Room.
Reviewers do not recollect data, mutate concurrently or waive executable failures. Resolve every blocker,
rerun affected gates and verify that structured-input hashes match the reviewed revision.

## H5 - Publication boundary

Render and compute locally first. Public posting, Substack, Telegram, email, commit or push occurs only
when the workflow and current invocation authorize it. Verify the reachable artifact before notification.
Stage explicit files only; exclude `.mcp.json`, tokens, runtime staging and unrelated work.

Any failed required gate means no publication. A truthful `no_setup` or no-publication result is valid;
silently reusing an older run or adding a weak candidate is not.
