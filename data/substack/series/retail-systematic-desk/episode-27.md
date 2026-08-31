---
title: "Use Baselines, Walk-Forward and Stress Tests"
subtitle: "A backtest matters only relative to simple alternatives and unseen periods."
series_id: "retail-systematic-desk"
module_id: "backtesting"
module_title: "Backtest Without Fooling Yourself"
module_episode: 3
episode_number: 27
scheduled_at: "2027-03-05T13:00:00.000Z"
send_email: false
---

*Part 3 of 3 in Backtest Without Fooling Yourself. Lesson 27 of 45 in Build a Retail Systematic Desk, Safely.*

Compare the proposal with cash, a broad benchmark, random timing under the same constraints and the current production rule. Calibrate on one period and validate on later data. Examine distributions, winner dependence and regime slices rather than one aggregate score.

**Input from last Friday:** The accepted execution-stress fixture pack.

**Friday deliverable:** A locked validation protocol, owned by the desk operator and retained in the review bundle.

## Build this

Create an experiment matrix before running tests. Freeze the primary metric, secondary risks and materiality rule. Keep optimization and final validation in separate artifacts.

### Minimum record

- `hypothesis`
- `baseline`
- `in_sample`
- `out_of_sample`
- `stress_case`
- `promotion_metric`

## Test it before moving on

Use block or cluster resampling that preserves relevant dependence, remove the largest winners, and report uncertainty intervals. Apply multiple-testing controls, keep a final untouched validation set, and label conclusions weak when sample size is small.

**Operating limit:** The locked validation protocol is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the locked validation protocol (context, not implementation evidence):** [NIST: Bootstrap Plot](https://www.itl.nist.gov/div898/handbook/eda/section3/bootplot.htm); [NIST: Process Modeling](https://www.itl.nist.gov/div898/handbook/pmd/section1/pmd141.htm)

Educational, not investment advice.

## Release decision

**GO:** Accept the locked validation protocol only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Reject changes chosen after repeatedly inspecting the same out-of-sample period.

**Next Friday:** Carry the accepted locked validation protocol into Size at the Portfolio Level.
