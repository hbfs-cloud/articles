---
name: signals-desk
description: Produce zero to five verified public US-stock ideas from immutable, hash-bound workflow evidence.
version: 2.0.0
user-invocable: true
argument-hint: "[constraints] [--dry-run] [--publish when explicitly authorized]"
license: Apache 2.0
---

# Signals Desk

The canonical procedure is `.claude/commands/signals-desk.md`; source authority is
`.claude/skills/source-policy.md`.

## Deterministic Flow

1. Validate the workflow and collect `plans/signals-desk.json` at the exact reference close.
2. Rank only the returned universe by structured source score, then family, then ticker. Persist every
   retained/rejected decision before enrichment.
3. Select zero to five names. `no_setup` is a valid result.
4. Collect `plans/signals-desk-verify.json` only for persisted survivors.
5. Build `ideas.json`; `tools/validate-trade-ideas.js` is the authority for arithmetic and eliminators.
6. Senior, contrarian and retail reviewers use the same hash-bound snapshot without refetch.

No account, position, order, equity or private broker data belongs in this workflow.

## Evidence And Geometry

Every idea links bars, technicals, earnings, SEC/actions corporate, flow and correlation evidence by
path and SHA-256. Unknown dilution classification, stale/missing close, unresolved earnings proximity,
or an unbound source blocks the idea.

The validator recomputes entry distance, ATR stop distance, target reachability and R/R from structured
levels. It enforces the earnings window, pair correlation and family concentration. The model may reject
an eligible idea; it cannot invent a name or modify a numeric gate.

## Performance Feedback

Ledger outcomes are deduplicated by signal identity and evaluated only after their published horizon is
complete. A family/regime overlay is advisory below 20 mature unique observations. At 20 or more it may
down-weight or cap selection only when the cutoff, cohort path, SHA-256 and review date are persisted.
Open, no-fill and ambiguous outcomes never enter win rate or profit factor.

## Digest And Alerts

After zero blockers, a digest is concise and self-contained: reference close/regime, ticker, entry
condition, stop, TP1, invalidation and principal risk. `no_setup` states that no valid line exists.
Pending lifecycle alerts are deduplicated and marked notified only after confirmed delivery.

## Side Effects

Default is local output only. Telegram, indexing, commit and push require explicit authorization in the
current invocation. A failed notification remains failed; there is no implicit fallback channel. Stage
only explicit generated files and never include `.mcp.json` or token material.
