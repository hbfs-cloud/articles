---
title: "Certify a Candidate With Independent Evidence"
subtitle: "A chart pattern is one input, not a complete trade case."
series_id: "retail-systematic-desk"
module_id: "certification"
module_title: "Turn Candidates Into Conditional Plans"
module_episode: 1
episode_number: 19
scheduled_at: "2027-01-08T13:00:00.000Z"
send_email: false
---

*Part 1 of 3 in Turn Candidates Into Conditional Plans. Lesson 19 of 45 in Build a Retail Systematic Desk, Safely.*

Certification asks whether the setup survives technical, event, filing, liquidity and timing checks. These checks should be independent enough that repeating the same price feature under three names does not create false confirmation. Missing required evidence rejects the plan.

**Input from last Friday:** The accepted gate-by-gate rejection report.

**Friday deliverable:** A candidate certification sheet, owned by the desk operator and retained in the review bundle.

## Build this

Create a checklist with required and optional facets. Capture the thesis, counter-thesis, catalyst, invalidation and data limitations. Keep hard levels in structured fields and the explanation in prose.

### Minimum record

- `setup_type`
- `drivers`
- `counter_case`
- `catalysts`
- `invalidation`
- `limitations`

## Test it before moving on

Give the same snapshot to a correctness reviewer and a contrarian reviewer. They may interpret the evidence differently, but they must agree on the underlying observations and missing fields.

**Operating limit:** The candidate certification sheet is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the candidate certification sheet (context, not implementation evidence):** [Investor.gov: Using EDGAR to Research Investments](https://www.investor.gov/introduction-investing/getting-started/researching-investments/using-edgar-research-investments); [SEC: Form 8-K](https://www.sec.gov/info/edgar/forms/form8-k.pdf)

Educational, not investment advice.

## Release decision

**GO:** Accept the candidate certification sheet only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Do not upgrade confidence because several derived indicators share the same underlying price series.

**Next Friday:** Carry the accepted candidate certification sheet into Test the Sector, Leaders and Blast Radius.
