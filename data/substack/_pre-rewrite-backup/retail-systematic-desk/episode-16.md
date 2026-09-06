---
title: "Screen Broad, Then Narrow With Evidence"
subtitle: "Cheap deterministic filters should precede expensive research."
series_id: "retail-systematic-desk"
module_id: "scanner"
module_title: "Build a Scanner That Can Say No"
module_episode: 1
episode_number: 16
scheduled_at: "2026-12-18T13:00:00.000Z"
send_email: false
---

*Part 1 of 3 in Build a Scanner That Can Say No. Lesson 16 of 45 in Build a Retail Systematic Desk, Safely.*

A scanner is a funnel, not a recommendation engine. Begin with a defined universe and inexpensive eligibility checks. Only survivors receive deeper technical, event, filing and peer research. This keeps cost bounded and makes every rejection traceable.

**Input from last Friday:** The accepted offline replay bundle.

**Friday deliverable:** A two-stage scanner run record, owned by the desk operator and retained in the review bundle.

## Build this

Split the run into candidate discovery and governing evidence. Persist both stages. Use stable tie-breaks and per-candidate gates. Do not let a language model transport raw data or recalculate rankings.

### Minimum record

- `universe_version`
- `candidate_id`
- `rank`
- `gate_results`
- `evidence_status`

## Test it before moving on

Run the same snapshot twice and require identical candidates, ranks and reasons. Remove one expensive enrichment source and confirm only candidates requiring it become ineligible.

**Operating limit:** The two-stage scanner run record is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the two-stage scanner run record (context, not implementation evidence):** [Investor.gov: Researching Investments](https://www.investor.gov/introduction-investing/getting-started/researching-investments); [Investor.gov: How to Read a 10-K](https://www.investor.gov/introduction-investing/getting-started/researching-investments/how-read-10-k)

Educational, not investment advice.

## Release decision

**GO:** Accept the two-stage scanner run record only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Do not publish a ranked name until all evidence required by its setup has completed.

**Next Friday:** Carry the accepted two-stage scanner run record into Zero Candidates Is a Valid Outcome.
