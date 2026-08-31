---
title: "Facts, Decisions and Orders Are Different Objects"
subtitle: "Keeping three records prevents explanations from mutating into instructions."
series_id: "retail-systematic-desk"
module_id: "boundaries"
module_title: "Separate Data, Decisions and Execution"
module_episode: 2
episode_number: 5
scheduled_at: "2026-10-02T12:00:00.000Z"
send_email: false
---

*Part 2 of 3 in Separate Data, Decisions and Execution. Lesson 5 of 45 in Build a Retail Systematic Desk, Safely.*

A price bar is a fact, a ranked candidate is a research result, and an order is an instruction. They have different owners and validity rules. A persuasive narrative cannot fill a missing quantity, and an old plan cannot become current because the latest quote looks similar. Treating these records as separate objects makes accidental escalation visible.

**Input from last Friday:** The accepted service-boundary diagram.

**Friday deliverable:** A three-schema contract pack, owned by the desk operator and retained in the review bundle.

## Build this

Define three schemas. Facts carry provenance and observation time. Decisions carry reasons, gates, validity and a snapshot reference. Orders carry exact broker-supported fields plus an idempotency key. Link them with identifiers instead of copying unstructured text downstream.

### Minimum record

- `fact id and source`
- `decision id and validity`
- `order fingerprint and broker id`

## Test it before moving on

Delete a required field from each object and run contract tests. A missing source should reject the fact, a missing stop should reject a new long plan, and a missing idempotency key should reject placement.

**Operating limit:** The three-schema contract pack is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the three-schema contract pack (context, not implementation evidence):** [Investor.gov: Types of Orders](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/types-orders); [FINRA: Extended-Hours Trading](https://www.finra.org/investors/insights/extended-hours-trading)

Educational, not investment advice.

## Release decision

**GO:** Accept the three-schema contract pack only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Never parse operational instructions from a human-readable reason when structured fields are absent.

**Next Friday:** Carry the accepted three-schema contract pack into Let Each Layer Fail Without Lying.
