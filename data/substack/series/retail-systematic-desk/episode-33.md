---
title: "Test Restarts, Duplicates and Broken Networks"
subtitle: "A robust client assumes it will lose the response at the worst moment."
series_id: "retail-systematic-desk"
module_id: "simulation"
module_title: "Prove Execution in a Simulator"
module_episode: 3
episode_number: 33
scheduled_at: "2027-04-16T12:00:00.000Z"
send_email: false
---

*Part 3 of 3 in Prove Execution in a Simulator. Lesson 33 of 45 in Build a Retail Systematic Desk, Safely.*

The hardest execution bug is uncertainty after a request may have reached the broker. A local fingerprint alone never proves non-execution. Durable pre-submit intent, broker idempotency keys where supported, complete paginated history and bounded reconciliation reduce risk; unresolved ambiguity must forbid automatic retry.

**Input from last Friday:** The accepted order-state transition suite.

**Friday deliverable:** An uncertain-submit recovery test, owned by the desk operator and retained in the review bundle.

## Build this

Persist request identity and business intent before submission. On timeout, inspect complete open, completed, fill and execution history across a bounded consistency window. Restore protections and group state after restart, but keep an explicit unknown state when broker evidence is incomplete.

### Minimum record

- `request_id`
- `business_intent_id`
- `broker_idempotency_key`
- `submission_state`
- `history_cursor`
- `reconciled_at`

## Test it before moving on

Drop the response after acceptance, hide the order during an eventual-consistency window, then restart. The client must remain unknown and refuse a duplicate until authoritative evidence resolves the intent. Repeat after a partial fill.

**Operating limit:** The uncertain-submit recovery test is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the uncertain-submit recovery test (context, not implementation evidence):** [Investor.gov: Broker-Dealer Record-Keeping Requirements](https://www.investor.gov/introduction-investing/investing-basics/glossary/broker-dealers-record-keeping-requirements); [FINRA: Checking Trade Confirmations](https://www.finra.org/investors/insights/checking-trade-confirmations)

Educational, not investment advice.

## Release decision

**GO:** Accept the uncertain-submit recovery test only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Do not use a fresh request identifier for a technical retry of identical intent.

**Next Friday:** Carry the accepted uncertain-submit recovery test into Use an Append-Only Decision Ledger.
