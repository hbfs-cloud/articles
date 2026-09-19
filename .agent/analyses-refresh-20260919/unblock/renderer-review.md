# KLAC renderer review — 2026-09-19

**Scope.** Read-only audit of the current changes to `tools/render-analysis.js`
(SHA-256 `c04a95323261b3159bb627d6f225dba9d8db12520e31fae00491ac1c683fae5e`)
and `tools/test-analysis-render-fidelity.js`
(SHA-256 `20b307d3d35cec7b82eb6da24847104cdb8cd7b2310b00e831c0bc291a71cc55`).
The exercised candidate was `analyses/KLAC/_runs/20260919-update/revision/KLAC.json`
(SHA-256 `0b3ff71d7bb4a47e024930c8b99e41839d4b5f20b6b99c9a37ebaa42ca835aa6`).
No candidate, renderer, schema, or test was changed in this review.

## Result

**Do not grant AQ final PASS.** The KLAC candidate validates and its rendered
state is materially safer than before, but three valid-schema combinations can
still contradict reader-facing claims. They need renderer or contract tests
before a general sign-off.

The follow-up read-only audit of `validate-analysis-evidence.js` found a
separate **fail-open** in archived trade geometry: sign is discarded during
numeric support checks. That blocker is detailed in H3 below.

## Confirmed good behavior on the current KLAC candidate

- `node tools/render-analysis.js .../KLAC.json --dry` accepts the candidate.
- Rendering contains zero literal `N/A` strings. The unavailable short,
  options, and capital-flow values are absent as tiles while their explanatory
  prose and source references remain visible. A provided numeric zero is not
  lost by `metricTile`, because `0` is converted to the non-empty string `"0"`.
- KLAC's `tradeIdea.status` and `meta.status` are both `no-trade`. The output
  shows **AUCUN ORDRE ACTIF**, labels the section *Repères historiques du
  trade*, marks the four levels as inactive, and does not render an active
  entry label.
- The finite performance table is correctly labelled as price returns from
  2026-08-19 to 2026-09-18. For this candidate it does not show YTD or alpha.
- Empty `earnings.quarters` no longer suppresses the earnings note, next-date
  uncertainty, or its primary/MCP sources. The floating navigation link also
  exists.

## Findings requiring follow-up

### H1 — `no-trade` has two sources of truth and the renderer can contradict itself

`renderVerdict` treats either `meta.status === "no-trade"` or
`tradeIdea.status === "no-trade"` as no-trade. `renderTradeIdea` only checks
`tradeIdea.status`. Both states are schema-valid. A mutation with
`meta.status="no-trade"` and `tradeIdea.status="active"` renders **AUCUN ORDRE
ACTIF** in the verdict but an actionable *Zone d’entrée* in the trade section;
it emits neither the no-order trade banner nor archived labels.

**Required correction:** choose one canonical state in the renderer, or make a
mismatch a schema/workflow validation error. Add a regression test for the
mismatch, not only for the synchronized KLAC case.

### H2 — a finite window can still be rendered beside YTD and alpha

The new `windowReturns` branch correctly replaces the benchmark table, but the
preceding metric strip is unconditional. The schema permits `ytd`, `alpha`,
and `windowReturns` together. A valid payload with all three renders the
finite-window table plus tiles headed `YTD` and `Alpha`, precisely the
mislabelling the new test intends to avoid.

The schema also accepts `endDate` earlier than `startDate`; that valid payload
renders the inverted range without warning.

**Required correction:** when `windowReturns` is present, suppress or reject
period-incompatible `ytd`, `oneYear`, `threeYear`, and `alpha`; validate
`startDate <= endDate`. Add tests for both a mixed payload and an inverted
window. This is a contract issue, not a KLAC calculation issue.

### H3 — archived geometry accepts directionally wrong percentages and R/R

The new precision logic correctly includes TP2 and compares values at the
printed decimal precision. However, its support predicate compares
`Math.abs(rounded-source)` with `Math.abs(claimed)`. It therefore discards sign
for every archived numeric claim. The following are all accepted by the
current validator although they contradict the archived long-trade geometry:

```text
tradeIdea.stopPct = "+7.0%"       # archived value is -7.0%
tradeIdea.tp1Pct  = "-13.2%"      # archived target is positive
tradeIdea.tp2Pct  = "-15.4%"      # archived target is positive
tradeIdea.rr      = "1:-1.88 / 1:2.20"
```

This is a concrete fail-open, independent of the candidate's current values.
It affects `statusNote`, `thesis`, and `invalidation` too whenever their
numeric strings are validated through the same branch.

**Required correction:** preserve sign for percentage and price-derived
claims. For R/R, validate a parsed ratio grammar whose components are
non-negative and match the appropriate target in order. Keep the
precision-at-publication behavior, but add tests rejecting each signed inverse
example above alongside the existing wrong-magnitude tests.

### M1 — a no-trade verdict becomes generic if the optional checklist is absent

The no-trade decision cockpit is inside `checklist ? ... : ''`. A schema-valid
no-trade payload with `controlChecklist: []` therefore has no no-order message
in its Verdict Express section; the generic *Why Buy*/*Why Avoid* boxes remain.
The trade card still communicates no-trade when `tradeIdea.status` is set, but
the lead decision surface does not.

**Required correction:** render an unconditional compact no-order verdict
banner whenever the resolved status is no-trade, and test empty/missing
checklists.

### M2 — KLAC currently calls a note-only section “Earnings History”

KLAC has `earnings.quarters: []`. Its output correctly has no fabricated
quarter table, but the H2 reads *Historique des résultats* while the content is
only a timing/coverage note and “next earnings not confirmed.” This is a
reader-facing label error on the current candidate.

**Required correction:** use a conditional heading such as *Résultats et
calendrier* when no quarters exist, reserving *Historique des résultats* for a
non-empty quarterly table. Add a direct empty-quarters render assertion.

### L1 — an empty performance metric strip remains in the current KLAC HTML

With only `windowReturns`, `renderPerformance` still emits an empty
`<div class="metric-strip metric-strip-muted">`. CSS gives it a `1rem` bottom
margin, so the candidate has unexplained vertical whitespace before its window
label. It is not a data error; `metricStrip(...)` already provides the correct
omit-if-empty behavior elsewhere.

**Required correction:** construct this strip through `metricStrip` or emit it
only when at least one legacy period metric is present. Add a no-empty-strip
assertion for a window-only payload.

## Test evidence

Passed:

```text
node tools/test-analysis-render-fidelity.js
analysis render fidelity: PASS

node tools/test-analysis-date-disclosure.js
analysis date disclosure: PASS; French and English uncertainty require an explicit supporting note

node tools/render-analysis.js analyses/KLAC/_runs/20260919-update/revision/KLAC.json --dry
[OK] .../KLAC.json — valid (KLAC, grade B)
```

`git diff --check -- tools/render-analysis.js tools/test-analysis-render-fidelity.js`
also passed.

The existing fidelity test is useful coverage for escaped finite-window labels,
signed returns, non-numeric return rejection, and the legacy benchmark path.
It does **not** cover the H1 status mismatch, H2 mixed periods or date order,
H3 signed inversions, M1 empty checklist, M2 no-quarter heading, L1 empty
strip, or tile-level zero retention.

The geometry follow-up also passed `node tools/test-analysis-evidence.js`, but
that test currently asserts only a wrong magnitude (`-8.0%`) and an invented
positive target ratio. It does not exercise the accepted signed inversions
above.

## Candidate criteria to retain

No additional candidate-field blocker was found: KLAC already synchronizes its
two no-trade statuses and provides a dated price-only 21-session window with a
source reference. Keep those facts as explicit release criteria. Add the
cross-field status invariant and the performance-window exclusivity/date-order
rules to the renderer/schema contract so future valid JSON cannot regress the
reader-facing decision.
