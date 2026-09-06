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

A rejected order is the easy case. Silence is the hard one: you sent something, the connection died mid-sentence, and now you cannot say whether the broker has it. Nothing on your own machine answers that question. Only the broker's records do.

Toy run, figures invented to show the shape and nothing else: 40 submissions into a simulator, network cut at a random moment each time. 31 answered normally. 6 timed out and turned up in the broker's history anyway. 3 timed out and never existed. From your side those last two groups look identical for several seconds, and a client that retries on impulse ends up with a double position in 6 cases out of 9.

**Input from last Friday:** the accepted order-state transition suite.

**Friday deliverable:** an uncertain-submit drill, owned by the desk operator and kept in the review bundle.

## Build this

Write the intent down before sending it, never after. Two labels, two jobs. The request identifier names this attempt. The idempotency key is a label the broker itself understands, so the same label arriving twice counts once — where your broker supports that, and plenty do not. Assuming support you never verified is one of the shorter routes to a duplicate.

After a timeout, read the broker's whole history: working orders, completed orders, individual fills, every page of each. Then wait out the consistency window, meaning the few seconds a broker may need before an order it has already accepted shows up in what it reports back to you.

### Minimum record

- `request_id`
- `business_intent_id`
- `broker_idempotency_key`
- `submission_state`
- `history_cursor`
- `reconciled_at`

## Test it before moving on

Drop the response after acceptance. Hide the order for the length of the consistency window. Restart the process. The client has to sit in `unknown`, send nothing, and move only when the broker's own evidence arrives. Run the same test again on a partial fill, where 40 shares of a 100-share intent already exist (quantities illustrative).

**Operating limit:** simulator only, no live credential anywhere in the loop, no account detail, no production parameter, and no claim of profitability. Educational, not investment advice. On what an execution report is supposed to contain: [Investor.gov: Executing an Order](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/executing-order) and [FINRA: Checking Trade Confirmations](https://www.finra.org/investors/insights/checking-trade-confirmations).

## Release decision

**GO:** accept the drill when `unknown` survives a restart untouched and the retained output carries all six fields.

**NO-GO:** never mint a fresh request identifier for a technical retry of the same intent. New label, new order.

**Next Friday:** carry the accepted drill into Use an Append-Only Decision Ledger.
