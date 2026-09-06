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

Most home-built simulators get written to answer the wrong question. They are asked whether the strategy makes money. What they should be asked is whether the code that talks to a broker survives everything a broker does to it: rejections, half-fills, features that simply are not there.

So build one that lies to you as little as possible, and never in your favour. Fills at the price you wanted, always, is a bug pretending to be a result.

![Every order ends reconciled](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/order_state_machine.png)

**Input from last Friday:** the accepted event-and-kill-state runbook.

**Friday deliverable:** a deterministic broker simulator contract, owned by the desk operator and kept in the review bundle.

## Build this

Two pieces. First a capability matrix: a plain list of what this broker can do — which order types, whether a protective exit can be attached to the entry so both arrive together, the minimum quantity, the price increments allowed. Second, an order book that is deterministic, meaning identical inputs produce identical output every single run, because time and prices are handed in rather than read from the clock.

Support the states an order genuinely passes through: accepted, working, partially filled, filled, cancelled, rejected, expired.

Illustrative run, figures invented: the same plan of 11 candidates aimed at two simulated brokers. Broker A attaches protective exits, so all 11 route. Broker B cannot, and 7 of them require that attachment — the client rejects those 7 and stops rather than sending an entry with nothing behind it. Determinism check: same seed, same injected clock, run twice, 1,344 events identical line for line. One mismatch and the fixture is worthless as a test.

### Minimum record

- `capabilities`
- `order_state`
- `filled_qty`
- `remaining_qty`
- `timestamps`

## Test it before moving on

Point the client at both brokers without changing a line of it. The plan may only be accepted where the required protection actually exists. Strategy logic stays out of the adapter — the adapter translates, it never decides.

**Operating limit:** simulated fills prove plumbing, never edge. Nothing here is a broker recommendation or a live configuration.

## Release decision

**GO:** accept when both brokers are driven by one unmodified client and the retained output carries all five fields.

**NO-GO:** never paper over a missing broker feature with a workaround that changes the plan quietly. A rejection you can read beats a substitution you cannot. On what each order type actually promises: [Investor.gov: Types of Orders](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/types-orders). On the duty behind a fill: [FINRA: Best Execution](https://www.finra.org/rules-guidance/key-topics/best-execution). Educational, not investment advice.

**Next Friday:** the accepted contract goes into Build an Explicit Order State Machine.
