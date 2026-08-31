---
title: "Zero Candidates Is a Valid Outcome"
subtitle: "Forcing a quota converts selectivity into hidden risk."
series_id: "retail-systematic-desk"
module_id: "scanner"
module_title: "Build a Scanner That Can Say No"
module_episode: 2
episode_number: 17
scheduled_at: "2026-12-25T13:00:00.000Z"
send_email: false
---

*Part 2 of 3 in Build a Scanner That Can Say No. Lesson 17 of 45 in Build a Retail Systematic Desk, Safely.*

A scanner should return no setup when nothing passes. But an empty list is meaningful only after proving that the pipeline ran, the universe was populated and the filters behaved as intended. A crash and a calm day must never share the same output.

**Input from last Friday:** The accepted two-stage scanner run record.

**Friday deliverable:** A no-setup run record, owned by the desk operator and retained in the review bundle.

## Build this

Emit run markers for every stage with input counts, output counts and status. When the result is empty, run an ablation check on suspect clauses and preserve warnings. The final object should distinguish no setup, data insufficient and pipeline failure.

### Minimum record

- `stage`
- `ran_at`
- `input_count`
- `output_count`
- `status`
- `warnings`

## Test it before moving on

Test three fixtures: a legitimate empty screen, an empty universe and a failed enrichment. Only the first may return no setup. The other two must block with exact causes.

**Operating limit:** The no-setup run record is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the no-setup run record (context, not implementation evidence):** [CFTC: Trading Systems Advisory](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/fraudadv_tradingsystem.html); [NIST: Bootstrap Plot](https://www.itl.nist.gov/div898/handbook/eda/section3/bootplot.htm)

Educational, not investment advice.

## Release decision

**GO:** Accept the no-setup run record only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Never fill a target list with lower-quality names merely because the interface expects cards.

**Next Friday:** Carry the accepted no-setup run record into Explain Every Rejection.
