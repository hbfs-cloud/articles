---
title: "Model Costs, Gaps and Partial Fills"
subtitle: "Close-to-close arithmetic is not an execution model."
series_id: "retail-systematic-desk"
module_id: "backtesting"
module_title: "Backtest Without Fooling Yourself"
module_episode: 2
episode_number: 26
scheduled_at: "2027-02-26T13:00:00.000Z"
send_email: false
---

*Part 2 of 3 in Backtest Without Fooling Yourself. Lesson 26 of 45 in Build a Retail Systematic Desk, Safely.*

A realistic simulator distinguishes order type, session, spread, slippage, volume and gaps. Stops may fill beyond their trigger; limit orders may not fill at all. Partial fills create positions that still require protection and reconciliation.

**Input from last Friday:** The accepted point-in-time backtest bundle.

**Friday deliverable:** An execution-stress fixture pack, owned by the desk operator and retained in the review bundle.

## Build this

Implement market-state transitions and broker capability profiles. Simulate no fill, partial fill, gap-through stop, rejected order and delayed cancel. Keep assumptions visible and configurable.

### Minimum record

- `market_state`
- `order_type`
- `fill_qty`
- `fill_price`
- `cost_model`
- `protection_state`

## Test it before moving on

Use synthetic bars where high and low cross several order levels. Define deterministic precedence and test it. Stress costs beyond the base assumption to see whether the result depends on optimistic execution.

**Operating limit:** The execution-stress fixture pack is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the execution-stress fixture pack (context, not implementation evidence):** [Investor.gov: Types of Orders](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/types-orders); [FINRA: Extended-Hours Trading](https://www.finra.org/investors/insights/extended-hours-trading)

Educational, not investment advice.

## Release decision

**GO:** Accept the execution-stress fixture pack only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Do not promote a strategy whose edge disappears under modest execution stress.

**Next Friday:** Carry the accepted execution-stress fixture pack into Use Baselines, Walk-Forward and Stress Tests.
