# KLAC current Senior QA review — 2026-09-19

## Scope and evidence lock

This is a final bounded Senior QA review of the current renderer, evidence
validator, KLAC JSON/evidence pair, and primary-document manifest. It is **not**
a publication attestation.

| Artifact | SHA-256 |
| --- | --- |
| `tools/render-analysis.js` | `93d2d616a56755519bc4bbf80a7fa6619abe84e2c1e7b32d837ce517dddf0af4` |
| `tools/validate-analysis-evidence.js` | `f6ade7ba99e50c95d8521c678c6874c0b0aa15ac54b2aa658cee3f53db9e83b0` |
| `tools/test-analysis-render-fidelity.js` | `b5b99d3e8d494c38bc81803de9e46a8cf2da9499b2f353f9e461bbc7bbb5ae4b` |
| `tools/test-analysis-evidence.js` | `94fc8d1ee843f4cb98216dc8dd2ad29a8464aa37ed7e6c9d9388ad8e039c15c8` |
| KLAC candidate | `91aea77c367daeeadfbbc055e92788c37a8004e69f694b9e7fc12a2111769389` |
| KLAC evidence manifest | `f91ff0e55778c06c3b5e14986e2ba8998602326e0281b22603866789fa1a9c84` |
| Deterministic calculation | `e7241c672ce5baf3a8470b4b3840e1ef5af13850e0e9b83a379293bfee81a08b` |
| Primary SEC manifest | `64bf3d45ba1fbc6ca7c9ef1905448e9d44debe07329ef1ac496966988d7614e2` |
| KLAC generator | `7d0067a882237757e4611913953f10051eed158ddb7d275e3d5cc6d354c3f12f` |

## QA result

**Final status: BLOCKED — RankBeta remains unavailable (upstream HTTP 403).**
This review does not attest publication. The current candidate correctly says
that the broad RankBeta ranking is unavailable and that the selected universe
is non-exhaustive. The underlying collection record identifies the failed
`RankBeta` request and the upstream 403; it cannot be converted to a passed
broad-comparable gate.

Within the renderer and evidence scope, the repaired branches pass their
targeted tests and the KLAC pair is internally consistent.

## Verified corrections

- The renderer resolves no-trade conservatively from either `meta.status` or
  `tradeIdea.status`. A no-trade candidate gets the verdict banner even with
  an empty checklist; the archived trade section replaces executable cards with
  a closed `details` block and a neutral, dated historical-level table.
- KLAC renders **AUCUN ORDRE ACTIF**, contains no literal `N/A`, labels
  empty-quarter earnings as *Résultats et calendrier*, and keeps the
  uncertainty note plus its sources.
- The current 21-session performance table is dated 2026-08-19 through
  2026-09-18, emits no legacy YTD/alpha strip, and the validator rejects an
  inverted date range.
- Sparse tiles are omitted while literal zero observations survive in the
  covered sparse sections.
- Archived geometry now verifies percentage claims against the specific source
  level with sign retained. The R/R grammar requires positive components and
  validates target order: the correct `1:1.88 / 1:2.20` passes, while reversed
  target order, negative ratio components, and inverted percentage signs fail.
- The candidate hash matches `evidence.json`; its 282 claim paths are unique,
  and all claim provenance resolves through the deterministic calculation.
  Calculation input and generator hashes match.
- The primary manifest hashes all 32 local SEC documents successfully. Its
  stated scope is clear: 28 post-10-K discovery records plus four separately
  reviewed annual/earnings/dividend/split documents; it makes no exhaustive
  EDGAR or financing-capacity claim.

## Executed checks

```text
node tools/test-analysis-render-fidelity.js
analysis render fidelity: PASS

node tools/test-analysis-evidence.js
analysis evidence tests: PASS

node tools/test-analysis-date-disclosure.js
analysis date disclosure: PASS; French and English uncertainty require an explicit supporting note

node tools/render-analysis.js analyses/KLAC/_runs/20260919-update/revision/KLAC.json --dry
[OK] .../KLAC.json — valid (KLAC, grade B)

node tools/validate-analysis-evidence.js analyses/KLAC/_runs/20260919-update/revision/evidence.json
[analysis-evidence] PASS (282 claims)
```

`git diff --check` passed for the reviewed renderer and evidence-validator
changes.

## Precise remaining defect

**M1 — the human primary index is stale.** `primary-manifest.json` correctly
tracks, hashes, and the validator verifies 32 primary documents. In contrast,
`primary/INDEX.md` still has 28 rows. It omits these four locally archived
and manifest-referenced primaries:

| Form | Accession | Date |
| --- | --- | --- |
| 10-K | `0000319201-26-000027` | 2026-08-06 |
| 8-K exhibit 99.1 | `0000319201-26-000024` | 2026-07-28 |
| 8-K | `0001193125-26-338242` | 2026-08-06 |
| 8-K | `0001193125-26-269375` | 2026-06-12 |

This does not defeat the machine evidence gate because the verified primary
manifest is authoritative for it. It is still a traceability defect: the
reader-facing archive index no longer gives the promised URL/date/form/SHA
inventory for every archived primary. Synchronize `INDEX.md` with the
manifest before any release review.

No other concrete renderer or evidence-validator fail-open was reproduced in
this review.

## M1 closure — current evidence lock

M1 is closed in the current archive: `primary/INDEX.md` now contains exactly
the 32 documents in `primary-manifest.json` (28 post-10-K discovery records
and four separately reviewed documents). All 32 accessions are unique; every
index row agrees with the manifest on date, form, local path, SEC URL and
SHA-256; each archived file re-hashes to its manifest value. The rebuilt
evidence validator passes 282 claims.

| Current artifact | SHA-256 |
| --- | --- |
| `revision/evidence.json` | `486f733c1354424062a50e3987cf595265445d97b9fdb30f2097b5a188b03978` |
| `revision/numeric-evidence.json` | `afa0e23cc913fb3558a8c262d81b426cdb2602ab5a1a2da1ed44146972d39d93` |
| `revision/primary-manifest.json` | `64bf3d45ba1fbc6ca7c9ef1905448e9d44debe07329ef1ac496966988d7614e2` |
| Evidence generator | `461b5430d4c01230cdb7c298aaa9c8e6a2b244c14563bacc9e6c003461007770` |

This closure does not alter the final QA status: **BLOCKED** while the required
RankBeta request remains an upstream HTTP 403. It is not a publication PASS.
