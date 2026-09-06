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

Done or not done. That is how most retail code stores an order, and it is fine right up to the afternoon a cancel request and a fill cross in flight. Then the desk holds a position it believes it cancelled.

A state machine is the boring fix: a written list of the states an order may occupy and the moves allowed between them. Anything outside the list raises an error instead of quietly overwriting what you knew.

![Seal the evidence, not the story](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/evidence_chain.png)

**Input from last Friday:** the accepted deterministic broker simulator contract.

**Friday deliverable:** an order-state transition suite, owned by the desk operator and kept in the review bundle.

## Build this

Draw the whole thing on one page: submitted, acknowledged, partially filled, filled, cancel requested, cancelled, rejected, expired. Then decide which arrows exist between them. Cancel requested may still reach filled — that arrow is legal and it is the one that hurts. Submitted may not reach cancelled without passing through a request.

Store every transition with where it came from and when: your own send, the broker's message, a timeout your code invented. Sources matter, because a timeout is a guess about the world, not news from it.

Numbers made up to show the scale: 8 states means 56 ordered pairs, of which 17 are legal here. Replay 400 synthetic event streams through them — 3 carry a duplicate acknowledgement, 1 delivers a fill mid-cancel, 1 answers 40 seconds after the client had given up. All 400 must land on one final state with no second order created anywhere.

### Minimum record

- `order_id`
- `previous_state`
- `new_state`
- `filled_qty`
- `source` — broker message, own send, or local timeout
- `occurred_at`

## Test it before moving on

Work the partial fill case hardest. Take 300 filled of 800 requested: alternates die the instant that print arrives, and the desk owes protection on those 300 immediately, not once the rest completes. Half a position with no exit is the worst state on the page.

**Operating limit:** transitions are replayed against recorded fixtures. No live account, no real quantity, no timing anyone should copy.

## Release decision

**GO:** accept when all 400 replays reconcile and every stored transition names its source.

**NO-GO:** no alternate gets promoted after any fill, partial included. On how an order actually reaches a market: [SEC: Trade Execution](https://www.sec.gov/investor/pubs/tradexec.htm). On the sessions where these edge cases cluster: [FINRA: Extended-Hours Trading](https://www.finra.org/investors/insights/extended-hours-trading). Educational, not investment advice.

**Next Friday:** the accepted suite goes into Test Restarts, Duplicates and Broken Networks.
