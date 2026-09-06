---
title: "Design Recovery and Supersession"
subtitle: "A restart must know which plan, revision and protection are active."
series_id: "retail-systematic-desk"
module_id: "ledger-operations"
module_title: "Keep an Audit Trail That Survives Incidents"
module_episode: 2
episode_number: 35
scheduled_at: "2027-04-30T12:00:00.000Z"
send_email: false
---

*Part 2 of 3 in Keep an Audit Trail That Survives Incidents. Lesson 35 of 45 in Build a Retail Systematic Desk, Safely.*

Recovery is part of the normal architecture. Persist active plan identity, group state, order fingerprints, broker identifiers, fills and protection state. A new revision replaces the old one atomically and records why.

**Input from last Friday:** The accepted externally checkpointed decision ledger.

**Friday deliverable:** A restart-and-supersession drill report, owned by the desk operator and retained in the review bundle.

## Build this

Create a startup sequence: verify ledger, load active plan, fetch broker state, reconcile, restore monitoring, then permit new decisions. Expired plans remain visible but cannot execute.

### Minimum record

- `active_plan`
- `revision`
- `group_state`
- `orders`
- `fills`
- `protection_state`

## Test it before moving on

Terminate the process between entry fill and local acknowledgement. With complete broker evidence and exact identifiers, recover the fill, place protection idempotently, verify it by readback and close the group. With incomplete evidence, remain unknown, block mutation and escalate manually.

**Operating limit:** The restart-and-supersession drill report is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the restart-and-supersession drill report (context, not implementation evidence):** [Investor.gov: Broker-Dealer Record-Keeping Requirements](https://www.investor.gov/introduction-investing/investing-basics/glossary/broker-dealers-record-keeping-requirements); [FINRA: Checking Trade Confirmations](https://www.finra.org/investors/insights/checking-trade-confirmations)

Educational, not investment advice.

## Release decision

**GO:** Accept the restart-and-supersession drill report only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Never activate two plan revisions simultaneously or merge their candidates.

**Next Friday:** Carry the accepted restart-and-supersession drill report into Make Every Run Auditable.
