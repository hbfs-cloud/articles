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

::audience non_sub,free_sub
Each part stands on its own. This is 26 of 45 in Build a Retail Systematic Desk, Safely; earlier parts cover the groundwork but you can start here.
::end

Yesterday's close minus today's close is arithmetic. It is not execution. Real orders miss, or fill halfway, or fill somewhere nobody chose. A stop is an instruction to get out once a level trades, and when a market reopens far below that level, the exit lands where the market opens, not where you wrote the number. A simulator that hides this is flattering you.

![A stop cannot fill where no price exists](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/gap_and_stop.png)

Partial fills deserve their own paragraph. You asked for 40 shares, you got 15. <mark>Those 15 are a real position: they need protection, they need to show up when you reconcile, and the missing 25 need a decision rather than silence.</mark>

**Input from last Friday:** the accepted point-in-time backtest bundle.

**Friday deliverable:** one execution-stress pack — synthetic bars built specifically to break your fill logic — filed with the week's paperwork.

## Build this

Model the state of the market (open, closed, halted, in auction) and what your broker actually supports, since not every venue accepts every order type. Simulate at least five outcomes: no fill, partial fill, gap through the stop, rejected order, and a cancel that arrives too late. Every assumption stays a visible setting. None of them become a constant buried in the code.

### Minimum record

- `market_state`
- `order_type`
- `fill_qty`
- `fill_price`
- `cost_model`
- `protection_state`

## Test it before moving on

Build one bar whose high and low sweep three of your levels in the same session, then answer the question the simulator cannot dodge: which one filled first? Pick a precedence rule, write it down, test it. Invented counts follow, purely to show the shape of the output: across 200 simulated orders, 41 never filled, 12 filled partially, 3 exited through the stop rather than at it, and all 12 partials inherited protection — that last number is the one you are checking. Then raise the assumed cost of getting in and back out from 5 to 20 basis points, a basis point being one hundredth of a percent. A made-up dial. If the answer flips sign somewhere along it, what you found was execution luck.

**Operating limit:** a paper drill. The fills, the counts and the cost dial are all fabricated for the exercise and describe no live account.

Background: [order types and what each one promises](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/types-orders) and [how uncertainty around a single statistic gets measured](https://www.itl.nist.gov/div898/handbook/eda/section3/bootplot.htm).

Educational, not investment advice.

## Release decision

**GO:** precedence is documented and reproducible, and every partial fill leaves the run with a stop attached.

**NO-GO:** do not promote a system whose edge evaporates under a modest cost increase. That edge belonged to the simulator.

**Next Friday:** the accepted pack carries into Use Baselines, Walk-Forward and Stress Tests.
