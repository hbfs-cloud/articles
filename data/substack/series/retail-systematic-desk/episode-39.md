---
title: "Reconcile Intent With Broker Reality"
subtitle: "The broker record wins on fills, while the plan remains the source of intended behavior."
series_id: "retail-systematic-desk"
module_id: "broker-execution"
module_title: "Connect a Broker Without Losing Control"
module_episode: 3
episode_number: 39
scheduled_at: "2027-05-28T12:00:00.000Z"
send_email: false
---

*Part 3 of 3 in Connect a Broker Without Losing Control. Lesson 39 of 45 in Build a Retail Systematic Desk, Safely.*

Reconciliation compares expected positions, open orders, fills and protections with broker facts. Differences need typed causes and bounded actions. A missing protection blocks new risk, but ambiguous broker state forbids automatic repair; the client may never invent a strategy decision.

**Input from last Friday:** The accepted durable intent and deduplication record.

**Friday deliverable:** A broker reconciliation report, owned by the desk operator and retained in the review bundle.

## Build this

Run reconciliation before new orders and after uncertain responses. Classify missing order, extra order, quantity drift, partial fill, protection gap and unknown state. Require exact target identifiers, verify every mutation by readback and escalate unresolved protection to a human or independent emergency revoke path.

### Minimum record

- `expected_state`
- `broker_state`
- `difference_type`
- `repair_action`
- `approval_state`

## Test it before moving on

Inject an extra broker order and a missing stop. The first should be escalated or canceled only under policy; the second should block new risk and trigger the defined protection path.

**Operating limit:** The broker reconciliation report is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the broker reconciliation report (context, not implementation evidence):** [Investor.gov: Broker-Dealer Record-Keeping Requirements](https://www.investor.gov/introduction-investing/investing-basics/glossary/broker-dealers-record-keeping-requirements); [FINRA: Checking Trade Confirmations](https://www.finra.org/investors/insights/checking-trade-confirmations)

Educational, not investment advice.

## Release decision

**GO:** Accept the broker reconciliation report only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Never treat absence from local state as proof that a broker order does not exist.

**Next Friday:** Carry the accepted broker reconciliation report into Put the Decision and Controls First.
