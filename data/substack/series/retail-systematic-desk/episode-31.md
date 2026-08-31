---
title: "Simulate the Broker Before Connecting One"
subtitle: "The simulator is a contract test for the desk, not a return generator."
series_id: "retail-systematic-desk"
module_id: "simulation"
module_title: "Prove Execution in a Simulator"
module_episode: 1
episode_number: 31
scheduled_at: "2027-04-02T12:00:00.000Z"
send_email: false
---

*Part 1 of 3 in Prove Execution in a Simulator. Lesson 31 of 45 in Build a Retail Systematic Desk, Safely.*

A broker simulator should expose the same order states and capability limits the execution client expects. Its job is to test transitions, rejection handling and protection, not to make fills look favorable. Keep strategy logic outside the adapter.

**Input from last Friday:** The accepted event-and-kill-state runbook.

**Friday deliverable:** A deterministic broker simulator contract, owned by the desk operator and retained in the review bundle.

## Build this

Implement a small capability matrix and deterministic order book. Support accepted, working, partial, filled, canceled, rejected and expired states. Make time and prices injectable for replay.

### Minimum record

- `capabilities`
- `order_state`
- `filled_qty`
- `remaining_qty`
- `timestamps`

## Test it before moving on

Run the client against two simulated brokers with different capabilities. The plan should be accepted only when required protection and order features are available.

**Operating limit:** The deterministic broker simulator contract is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the deterministic broker simulator contract (context, not implementation evidence):** [Investor.gov: Types of Orders](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/types-orders); [FINRA: Extended-Hours Trading](https://www.finra.org/investors/insights/extended-hours-trading)

Educational, not investment advice.

## Release decision

**GO:** Accept the deterministic broker simulator contract only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Do not add a broker workaround that changes the plan without surfacing a rejection.

**Next Friday:** Carry the accepted deterministic broker simulator contract into Build an Explicit Order State Machine.
