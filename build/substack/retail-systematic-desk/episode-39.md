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

::audience non_sub,free_sub
Each part stands on its own. This is 39 of 45 in Build a Retail Systematic Desk, Safely; earlier parts cover the groundwork but you can start here.
::end

Two lists exist. Yours, and the broker's. When they disagree about a fill, the broker wins, because the broker is the one holding the shares. When they disagree about what you meant to do, your plan wins. Reconciliation is the habit of keeping those two truths apart.

**Input from last Friday:** the deduplication record you accepted.

![Every order ends reconciled](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/order_state_machine.png)

**Friday deliverable:** A broker reconciliation report, owned by the desk operator and stored with the week's evidence.

## Build this

Run the comparison twice: before you send anything new, and again after any answer you did not fully understand. Four things get compared. Positions, open orders, fills, and protections. A protection is the resting stop order that caps the loss on a position, and a position without one is naked.

Name every difference instead of writing it out in free text. Missing order. Extra order. Quantity drift. Partial fill. Protection gap. Unknown state. Each name gets exactly one permitted repair, and the repair addresses a specific order identifier, never "the most recent one". After each change, read the broker back and confirm it landed. If a protection is still missing when you finish, stop opening new risk and escalate it to a person, or fire the emergency cancel-everything path.

Keep: `expected_state`, `broker_state`, `difference_type`, `repair_action`, `approval_state`.

## Test it before moving on

Plant two faults in a paper account: an order the plan never asked for, and a stop that quietly disappeared. The orphan order should be escalated, not silently cancelled. The missing stop should freeze new entries immediately.

Numbers below are invented to show the shape of the report, not to describe any real book: a toy run compares 37 expected positions against 36 at the broker, finds one orphan order, two quantity drifts of 3 and 11 shares from partial fills, and SYM_C sitting with no stop attached. Six lines, six named causes, no prose.

**Operating limit:** the whole exercise runs on a simulated account, so nothing in the report carries a live allocation.

Further reading: [FINRA on checking trade confirmations](https://www.finra.org/investors/insights/checking-trade-confirmations) and [the SEC primer on trade execution](https://www.sec.gov/investor/pubs/tradexec.htm).

Educational, not investment advice.

## Release decision

**GO:** both planted faults are caught, named, and routed the way your policy says they should be.

**NO-GO:** never read "it isn't in my database" as "it doesn't exist at the broker". Your database is the one that can be wrong.

**Next Friday:** this report becomes the raw material for Put the Decision and Controls First.
