---
title: "Treat Time as a First-Class Field"
subtitle: "Event time, observation time and ingestion time answer different questions."
series_id: "retail-systematic-desk"
module_id: "identity-time"
module_title: "Treat Identity and Time as Data"
module_episode: 2
episode_number: 11
scheduled_at: "2026-11-13T13:00:00.000Z"
send_email: false
---

*Part 2 of 3 in Treat Identity and Time as Data. Lesson 11 of 45 in Build a Retail Systematic Desk, Safely.*

A filing may describe an earlier transaction, a quote may be observed after the market closes, and a dataset may be ingested much later. Using one date field for all three creates lookahead and false freshness. Every evidence item should state when the event happened and when the system could first know it.

**Input from last Friday:** The accepted effective-dated instrument record.

**Friday deliverable:** A temporal-field contract, owned by the desk operator and retained in the review bundle.

## Build this

Adopt explicit temporal names and require a temporal mode on each query. Point-in-time analysis filters by first availability, not by the date printed inside the document. Current-only composites must reject historical reconstruction requests.

### Minimum record

- `event_time`
- `available_at`
- `observed_at`
- `ingested_at`
- `temporal_mode`

## Test it before moving on

Construct a filing whose transaction date precedes its publication. A replay before publication must not see it; a replay after publication may. Repeat with a corrected dataset that arrived later.

**Operating limit:** The temporal-field contract is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the temporal-field contract (context, not implementation evidence):** [Investor.gov: Using EDGAR to Research Investments](https://www.investor.gov/introduction-investing/getting-started/researching-investments/using-edgar-research-investments); [SEC: Form 8-K](https://www.sec.gov/info/edgar/forms/form8-k.pdf)

Educational, not investment advice.

## Release decision

**GO:** Accept the temporal-field contract only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Do not substitute a current value when the requested historical snapshot is missing.

**Next Friday:** Carry the accepted temporal-field contract into Corporate Events Can Change the Instrument.
