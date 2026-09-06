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

Real systems degrade unevenly. Daily bars may be current while options are unavailable; one symbol may fail while nine succeed. The correct response is not always to discard the whole batch, and it is never to replace absence with zero. Each layer needs required and optional inputs so downstream users know exactly what remains eligible.

**Input from last Friday:** The accepted three-schema contract pack.

**Friday deliverable:** A partial-failure fixture report, owned by the desk operator and retained in the review bundle.

## Build this

Give every cell a status, quality, source, event time, observation time and warnings. At the decision boundary, mark which facets are required. Preserve successful cells and reject only the decisions whose required evidence failed.

### Minimum record

- `status`
- `quality`
- `source`
- `observed_at`
- `warnings`
- `required_for_decision`

## Test it before moving on

Inject one missing optional facet and one missing required facet. The first result should be partial but usable; the second should be ineligible with a specific rejection reason. Neither may silently become a full success.

**Operating limit:** The partial-failure fixture report is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the partial-failure fixture report (context, not implementation evidence):** [Investor.gov: Researching Investments](https://www.investor.gov/introduction-investing/getting-started/researching-investments); [Investor.gov: How to Read a 10-K](https://www.investor.gov/introduction-investing/getting-started/researching-investments/how-read-10-k)

Educational, not investment advice.

## Release decision

**GO:** Accept the partial-failure fixture report only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Block release when the interface cannot distinguish zero, not applicable, unavailable and stale.

**Next Friday:** Carry the accepted partial-failure fixture report into Discover Capabilities at Runtime.
