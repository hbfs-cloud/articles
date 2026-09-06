---
title: "Backtest on Frozen Point-in-Time Data"
subtitle: "A fast simulation is useless if it sees information the trader could not know."
series_id: "retail-systematic-desk"
module_id: "backtesting"
module_title: "Backtest Without Fooling Yourself"
module_episode: 1
episode_number: 25
scheduled_at: "2027-02-19T13:00:00.000Z"
send_email: false
---

*Part 1 of 3 in Backtest Without Fooling Yourself. Lesson 25 of 45 in Build a Retail Systematic Desk, Safely.*

Backtests need effective-dated membership, corporate actions and first-availability timestamps. Current fundamentals applied across history introduce lookahead even when price bars are correct. When a historical field is not point-in-time, label the approximation or exclude it.

**Input from last Friday:** The accepted validated paper-plan fixture.

**Friday deliverable:** A point-in-time backtest bundle, owned by the desk operator and retained in the review bundle.

## Build this

Freeze an input bundle before each experiment. Store data coverage, unavailable ranges and configuration version. Separate the research notebook from the authoritative replay runner.

### Minimum record

- `as_of`
- `available_at_filter`
- `universe_version`
- `coverage`
- `approximation_flags`

## Test it before moving on

Insert a future filing and a later index constituent into a fixture. Neither may appear before its effective availability. Run the same bundle twice and compare trade records and metrics.

**Operating limit:** The point-in-time backtest bundle is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the point-in-time backtest bundle (context, not implementation evidence):** [CFTC: Trading Systems Advisory](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/fraudadv_tradingsystem.html); [NIST: Bootstrap Plot](https://www.itl.nist.gov/div898/handbook/eda/section3/bootplot.htm)

Educational, not investment advice.

## Release decision

**GO:** Accept the point-in-time backtest bundle only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Do not describe a backtest as historical proof when current-only enrichments governed past trades.

**Next Friday:** Carry the accepted point-in-time backtest bundle into Model Costs, Gaps and Partial Fills.
