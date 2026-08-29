---
name: aplus-setups
description: Select zero to ten fully evidenced A+ setups without forcing candidates or refetching reviewer snapshots.
version: 2.0.0
user-invocable: true
argument-hint: "[screen | verify <TICKERS> | warroom <TICKERS>] [--dry-run]"
license: Apache 2.0
---

# A+ Setups

The canonical procedure is `.claude/commands/aplus.md`. Data provenance follows
`.claude/skills/source-policy.md`.

## Deterministic Flow

1. Validate the workflow contract and collect `plans/aplus-screen.json` at an explicit `refdate`.
2. Rank only returned US-stock candidates by structured screener score, with ticker as final tie-break.
   Persist the complete retained/rejected decision before any enrichment.
3. Select zero to ten names. An empty set is valid and produces `no_setup`.
4. Collect `plans/aplus-verify.json` only for persisted survivors. Run the correlation plan only when
   two or more survive the eliminators.
5. Build `candidates.json` and run `tools/validate-aplus-candidates.js`.
6. Senior, contrarian and retail reviewers read the same hash-bound files. They never refetch data and
   cannot override a failing numeric or evidence gate.

## Eliminators

Every published candidate must prove, through referenced evidence artifacts:

- exact JSON Pointers for every market observation, guidance event and EPS observation;
- at least one reviewed SEC accession present in the certified SEC artifact;

- explicit raised guidance from a primary IR filing/release;
- at least five consecutive EPS beats, each represented as a dated actual/estimate observation;
- forward PE below 35, or the fully documented exception in the command contract;
- EMA20 extension at or below 3%;
- at least ten US sessions before earnings;
- no unresolved SEC, dilution, issuance-capacity or corporate-action flag.

Absence of a filing hit is not proof of clean status. Foreign issuers require their applicable primary
filing regime. Unknown or incomplete evidence fails closed.

## Geometry

Entry must be within 3% of spot, stop distance at least 1.5 ATR, TP1 no farther than 4 ATR, and R/R is
recomputed from the worst allowed fill. An untriggered pullback cannot be presented as an actionable A+.
Price, ATR, moving averages and targets must share the same split-adjusted scale.

## Score And Review

The validator recomputes exact score components and requires at least 92/100. The four votes (`quant`,
`pm`, `risk`, `short_seller`) are evidence reviews, not score inputs: at least three approvals, no
individual critical error and no basket-level critical error are required.

Historical observations are advisory only when their immutable cohort and sample size are attached.
They never replace current evidence or relax a threshold.

## Side Effects

Default is local output only. Publication, notification, commit and push require explicit authorization
in the current invocation and happen only after all blocking checks pass. Stage explicit files; never
stage `.mcp.json`, tokens or raw secret-bearing artifacts.
