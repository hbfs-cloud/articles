---
title: "Discover Capabilities at Runtime"
subtitle: "A client should ask what a service can do instead of trusting last month's schema."
series_id: "retail-systematic-desk"
module_id: "data-health"
module_title: "Make Data Quality Executable"
module_episode: 1
episode_number: 7
scheduled_at: "2026-10-16T12:00:00.000Z"
send_email: false
---

*Part 1 of 3 in Make Data Quality Executable. Lesson 7 of 45 in Build a Retail Systematic Desk, Safely.*

Data and broker services evolve. A hardcoded tool list, field name or supported order type eventually drifts from production. Runtime discovery converts that drift into an explicit compatibility decision. It also prevents the client from assuming that every account, venue or data source supports the same operations.

**Input from last Friday:** The accepted partial-failure fixture report.

**Friday deliverable:** A capability bootstrap report, owned by the desk operator and retained in the review bundle.

## Build this

Add a bootstrap phase that records service version, health, visible capabilities and schemas. Cache the result only for the run. Compare required capabilities with what is actually advertised and fail before collecting data or constructing orders when the contract is incompatible.

### Minimum record

- `service version`
- `capability name`
- `schema hash`
- `required flag`
- `compatibility verdict`

## Test it before moving on

Remove one required capability from a test adapter. The run should stop during bootstrap with no downstream side effects. Adding an optional capability should not change prior decisions unless the configuration explicitly enables it.

**Operating limit:** The capability bootstrap report is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the capability bootstrap report (context, not implementation evidence):** [Investor.gov: Broker-Dealer Record-Keeping Requirements](https://www.investor.gov/introduction-investing/investing-basics/glossary/broker-dealers-record-keeping-requirements); [FINRA: Checking Trade Confirmations](https://www.finra.org/investors/insights/checking-trade-confirmations)

Educational, not investment advice.

## Release decision

**GO:** Accept the capability bootstrap report only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Do not use an old local schema as permission to call a capability the current service does not advertise.

**Next Friday:** Carry the accepted capability bootstrap report into Make Freshness a Blocking Field.
