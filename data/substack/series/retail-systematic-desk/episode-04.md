---
title: "Draw Hard System Boundaries"
subtitle: "Data collection, strategy decisions and broker actions should be separate services."
series_id: "retail-systematic-desk"
module_id: "boundaries"
module_title: "Separate Data, Decisions and Execution"
module_episode: 1
episode_number: 4
scheduled_at: "2026-09-25T12:00:00.000Z"
send_email: false
---

*Part 1 of 3 in Separate Data, Decisions and Execution. Lesson 4 of 45 in Build a Retail Systematic Desk, Safely.*

A useful retail desk has at least four boundaries: market facts, candidate research, portfolio decisions and broker execution. The interface is a fifth layer that explains state but does not become the source of truth. This separation lets a data outage block new decisions without corrupting the ledger, and lets the user interface fail without changing an order.

**Input from last Friday:** The accepted instrument eligibility table.

**Friday deliverable:** A service-boundary diagram, owned by the desk operator and retained in the review bundle.

## Build this

Draw the services and the objects passed between them. Use versioned JSON contracts rather than prose. The research layer may enrich candidates; it may not place orders. The execution layer may enforce broker risk; it may not repair a missing strategy field by guessing.

### Minimum record

- `facts snapshot`
- `candidate record`
- `decision plan`
- `execution report`
- `display projection`

## Test it before moving on

For every field on the desktop, identify its authoritative object. Then disable one layer at a time in a test environment. A broken renderer must not alter data, and an unavailable broker must not cause the strategy layer to fabricate fills.

**Operating limit:** The service-boundary diagram is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the service-boundary diagram (context, not implementation evidence):** [Investor.gov: Broker-Dealer Record-Keeping Requirements](https://www.investor.gov/introduction-investing/investing-basics/glossary/broker-dealers-record-keeping-requirements); [FINRA: Checking Trade Confirmations](https://www.finra.org/investors/insights/checking-trade-confirmations)

Educational, not investment advice.

## Release decision

**GO:** Accept the service-boundary diagram only when the test above passes and its retained output matches the minimum record.

**NO-GO:** If the same process both invents a trade and confirms that it executed correctly, split the responsibilities before proceeding.

**Next Friday:** Carry the accepted service-boundary diagram into Facts, Decisions and Orders Are Different Objects.
