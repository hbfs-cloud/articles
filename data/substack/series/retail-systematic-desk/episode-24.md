---
title: "Use a Complete Machine-Readable Plan"
subtitle: "Execution should receive quantities, protections and gates, not an investment story."
series_id: "retail-systematic-desk"
module_id: "decision-contract"
module_title: "Make Strategy Decisions Machine-Readable"
module_episode: 3
episode_number: 24
scheduled_at: "2027-02-12T13:00:00.000Z"
send_email: false
---

*Part 3 of 3 in Make Strategy Decisions Machine-Readable. Lesson 24 of 45 in Build a Retail Systematic Desk, Safely.*

A plan a machine can read has no adjectives in it. It carries the candidate, the side, the quantity, which broker it is meant for, the order type, the protection (the stop that travels with the position), the window during which the order is allowed to exist, the rule that says when a group may move from test to armed, and a plain sentence of reasoning. That sentence is for humans. It never fills a blank the machine needed.

Toy figures, invented for this lesson, on made-up tickers: 3 groups, 7 candidates, 12 fields each. Eighty-four slots, and the validator's only job is to refuse the whole thing if one of them is empty.

**Input from last Friday:** the accepted supersession record, the file that states which earlier plan this one replaces.

**Friday deliverable:** a validated paper-plan fixture, owned by the desk operator and filed with the rest of the week's evidence.

## Build this

Validate everything before arming anything. Identifiers unique. Ranks ordered, no ties. One winner per group, so two candidates competing for the same slot can never both fill. Every new position gets a stop before it gets a quantity. Missing level, missing quantity, dead validity window: the plan fails as a block, not field by field. Partial arming is how a desk ends up holding something nobody decided to hold.

### Minimum record

- `group_id`
- `candidate_id`
- `rank`
- `order`
- `protection`
- `execution`
- `reason`

## Test it before moving on

Break your own fixtures on purpose. Four of the seven failed in the toy run and none of them reached a broker call: a duplicate rank inside group 2, no stop attached to SYM_C, a validity window that had closed 40 minutes before the plan was even written, and a quantity of zero on SYM_H. The fifth case matters just as much. A group holding a single candidate and no substitute passed clean, because a plan is never obliged to offer an alternate.

**Operating limit:** made-up quantities, no account, no venue, no profit claim. Paperwork under stress test.

Background reading: [SEC: Trade Execution](https://www.sec.gov/investor/pubs/tradexec.htm); [FINRA: Extended-Hours Trading](https://www.finra.org/investors/insights/extended-hours-trading)

Educational, not investment advice.

## Release decision

**GO:** accept the fixture once every malformed case is rejected and the surviving plan fills all seven fields.

**NO-GO:** never let the broker layer or the interface finish a plan the strategy left incomplete.

**Next Friday:** carry the accepted fixture into Backtest on Frozen Point-in-Time Data.
