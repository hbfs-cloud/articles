---
title: "Turn Price Levels Into Conditional Plans"
subtitle: "An entry is a market condition with an expiry, not a number to chase."
series_id: "retail-systematic-desk"
module_id: "certification"
module_title: "Turn Candidates Into Conditional Plans"
module_episode: 3
episode_number: 21
scheduled_at: "2027-01-22T13:00:00.000Z"
send_email: false
---

*Part 3 of 3 in Turn Candidates Into Conditional Plans. Lesson 21 of 45 in Build a Retail Systematic Desk, Safely.*

A useful plan says enter if, skip if and invalidate if. It distinguishes a trigger from a blind limit order and checks whether the target is reachable within the intended horizon. The plan also expires; old levels are historical references, not standing instructions.

**Input from last Friday:** The accepted factor-documented peer map.

**Friday deliverable:** An expiring conditional plan, owned by the desk operator and retained in the review bundle.

## Build this

Represent entry window, trigger, stop, targets, horizon, maximum slippage and validity as fields. Recalculate the plan after a material gap rather than moving every level to preserve the idea.

### Minimum record

- `valid_from`
- `valid_until`
- `entry_condition`
- `stop`
- `targets`
- `max_slippage`

## Test it before moving on

Test a clean trigger, a gap beyond the allowed entry, an expired plan and a price that reaches the stop before activation. Only the first scenario may arm an order.

**Operating limit:** The expiring conditional plan is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the expiring conditional plan (context, not implementation evidence):** [Investor.gov: Types of Orders](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/types-orders); [FINRA: Extended-Hours Trading](https://www.finra.org/investors/insights/extended-hours-trading)

Educational, not investment advice.

## Release decision

**GO:** Accept the expiring conditional plan only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Do not convert a limit into a market order or widen invalidation simply to obtain a fill.

**Next Friday:** Carry the accepted expiring conditional plan into Put Strategy Rules in Versioned Configuration.
