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

A number on a chart is not a plan. It becomes one when you write down what has to happen before anything is sent, what would prove the idea wrong, and the date after which the whole thing is dead. A trigger is the condition the market must meet first. That is not the same as a resting limit order, which just sits there for weeks and gets filled by whatever bad news arrives.

**Input from last Friday:** the accepted peer map, with its factors written down.

![Seal the evidence, not the story](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/evidence_chain.png)

**Friday deliverable:** one expiring conditional plan, owned by you, filed with the week's paperwork.

## Build this

Store the plan as fields, not as a sentence: entry window, trigger, stop (the level that says the idea failed), targets, horizon, the worst slippage you will accept — slippage being the distance between the price you wanted and the price you got — and the two validity dates. After a large overnight gap, rebuild the plan from scratch instead of dragging every level along to keep the idea alive.

### Minimum record

- `valid_from`
- `valid_until`
- `entry_condition`
- `stop`
- `targets`
- `max_slippage`

## Test it before moving on

Feed it four cases. The figures below are invented to exercise the code; none of them are market data. SYM_A meets its trigger inside the window and arms exactly one order. SYM_B opens 4% above the entry window, so the plan recalculates and stays idle. SYM_C carries a `valid_until` that passed nine days ago and is refused on sight. SYM_D touches the stop before the trigger ever fires, so the plan closes unused. One arm, three quiet refusals. That ratio is the lesson.

**Operating limit:** paper only. No live money, no real settings, no account. What you are building is the wiring, not something that earns.

Background: [how an order gets executed](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/executing-order) and [when the market is actually open](https://www.nyse.com/trade/hours-calendars).

Educational, not investment advice.

## Release decision

**GO:** the four cases behave exactly as described, and the saved output carries every field in the minimum record.

**NO-GO:** a plan that missed its window is rebuilt tomorrow, not loosened today. Turning a limit into a market order to force a fill is not a fix.

**Next Friday:** the accepted plan becomes the input to Put Strategy Rules in Versioned Configuration.
