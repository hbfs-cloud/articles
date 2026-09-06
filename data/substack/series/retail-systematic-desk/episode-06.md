---
title: "Let Each Layer Fail Without Lying"
subtitle: "Partial failure should remain visible instead of becoming a clean but false result."
series_id: "retail-systematic-desk"
module_id: "boundaries"
module_title: "Separate Data, Decisions and Execution"
module_episode: 3
episode_number: 6
scheduled_at: "2026-10-09T12:00:00.000Z"
send_email: false
---

*Part 3 of 3 in Separate Data, Decisions and Execution. Lesson 6 of 45 in Build a Retail Systematic Desk, Safely.*

Ten symbols requested after the close. Nine daily bars come back, one times out. The options page answers for four of them and hangs on the rest. Invented numbers, ordinary evening.

The dishonest version of that evening reports ten out of ten and writes a zero where the missing bar belongs. Zero is a value. Missing is not a value, and the two must never share a cell. Nor must stale, which deserves its own word: data that is real and correctly recorded and simply too old to act on.

**Input from last Friday:** the accepted three-schema contract pack.

**Friday deliverable:** a partial-failure fixture report — a fixture being a saved fake answer your tests replay on demand — owned by the desk operator and kept in the review bundle.

## Build this

Give every cell six labels: status, quality, source, when the event happened, when you observed it, and any warnings. At the decision boundary, declare which facets are required and which are merely useful, a facet being one kind of information about one symbol: the daily bar, the borrow rate, the earnings date. Then keep the good cells and reject only the decisions whose required evidence is missing. One timeout should cost one candidate, not the session.

### Minimum record

status, quality, source, observed_at, warnings, required_for_decision.

## Test it before moving on

Two fixtures. In the first, an optional facet is missing: the result comes back usable and flagged, so nine candidates survive. In the second, a required facet is missing: that candidate is ineligible and the reason is legible at speed — no session-close bar for SYM_K, not error code 7 — while the other nine still arrive. Neither fixture may report a clean full success.

**Operating limit:** fixtures on paper, counts illustrative. Nothing in this exercise reaches a live account.

Background, if you have twenty minutes: [CFTC advisories and articles](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/index.htm) on how bad information travels, and the [NIST statistical handbook](https://itl.nist.gov/div898/handbook/index.htm) on treating missing values as missing.

Educational, not investment advice.

## Release decision

**GO:** partial results stay visibly partial, and every refusal names the facet it lacked.

**NO-GO:** ship nothing while the screen still cannot tell zero, not applicable, unavailable and stale apart.

**Next Friday:** the fixture report goes into Discover Capabilities at Runtime.
