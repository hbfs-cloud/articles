---
title: "Build an Explicit Order State Machine"
subtitle: "Orders move through states; they do not jump from submitted to done."
series_id: "retail-systematic-desk"
module_id: "simulation"
module_title: "Prove Execution in a Simulator"
module_episode: 2
episode_number: 32
scheduled_at: "2027-04-09T12:00:00.000Z"
send_email: false
---

*Part 2 of 3 in Prove Execution in a Simulator. Lesson 32 of 45 in Build a Retail Systematic Desk, Safely.*

Network timeouts, pending cancels and partial fills make binary status unsafe. Model allowed transitions and make unexpected transitions errors. A partial fill ends alternate selection and immediately creates a protection obligation for the filled quantity.

**Input from last Friday:** The accepted deterministic broker simulator contract.

**Friday deliverable:** An order-state transition suite, owned by the desk operator and retained in the review bundle.

## Build this

Draw states and transitions for submit, acknowledge, partial fill, fill, cancel request, cancel confirmation, rejection and expiry. Store every transition with source and time.

### Minimum record

- `order_id`
- `previous_state`
- `new_state`
- `filled_qty`
- `source`
- `occurred_at`

## Test it before moving on

Replay duplicate acknowledgements, a fill during cancellation and a late response after timeout. The final state must reconcile without creating a second order.

**Operating limit:** The order-state transition suite is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the order-state transition suite (context, not implementation evidence):** [Investor.gov: Types of Orders](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/types-orders); [FINRA: Extended-Hours Trading](https://www.finra.org/investors/insights/extended-hours-trading)

Educational, not investment advice.

## Release decision

**GO:** Accept the order-state transition suite only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Never promote an alternate candidate after any fill, including a partial one.

**Next Friday:** Carry the accepted order-state transition suite into Test Restarts, Duplicates and Broken Networks.
