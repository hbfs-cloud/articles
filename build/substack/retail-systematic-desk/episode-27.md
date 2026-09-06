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

A backtest score on its own says nothing. It only starts to mean something next to what a dumber choice would have produced: holding cash, holding a broad index, entering on random dates under the very same rules, or leaving the current rule untouched.

The counters below are invented to show the shape of an audit. No prices, no returns, just bookkeeping.

![The smooth curve is the one you fitted](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/forward_vs_backtest.png)

The toy audit: 216 parameter combinations tried, one kept. Two thousand block resamples, meaning the history was reshuffled in chunks so the day-to-day stickiness of returns survived the shuffle. Six regime slices, two of them holding fewer than 30 trades and therefore labelled weak instead of ranked. One validation stretch of 14 months nobody had opened yet. And the counter almost no desk logs: how many times the untouched period was peeked at. Four, in this run. After the first peek it stopped being untouched.

**Input from last Friday:** the accepted execution-stress fixture pack.

**Friday deliverable:** a locked validation protocol, owned by the desk operator and filed with the week's evidence.

## Build this

Write the experiment down before you run it. Which question, which comparison, which single number decides, which risks hold a veto, and how big a difference has to be before you call it real. Calibrate on the early stretch, judge on the later one. Keep the tuning file and the verdict file apart; one document doing both jobs is how a result gets edited into existence.

### Minimum record

- `hypothesis`
- `baseline`
- `in_sample`
- `out_of_sample`
- `stress_case`
- `promotion_metric`

## Test it before moving on

Delete the biggest winners and run it again. If the conclusion dies with three trades removed, the conclusion was three trades. Report ranges rather than single figures. Then pay the multiple-testing tax: 216 attempts means the best of them looks good partly through luck, and an honest write-up says so in the first paragraph, not a footnote.

**Operating limit:** paper only, made-up inputs, no account and no allocation. A protocol that survives the week is a measuring tool, never a promise.

Background reading: [NIST: Bootstrap Plot](https://www.itl.nist.gov/div898/handbook/eda/section3/bootplot.htm); [NIST: Introduction to Time Series Analysis](https://www.itl.nist.gov/div898/handbook/pmc/section4/pmc4.htm); [CFTC: Education Center](https://www.cftc.gov/LearnAndProtect/EducationCenter/index.htm)

Educational, not investment advice.

## Release decision

**GO:** lock the protocol once the winner-removal test, the range report and the untouched validation slice are all in the file.

**NO-GO:** reject any change picked after repeated inspections of the same untouched period.

**Next Friday:** carry the locked protocol into Size at the Portfolio Level.
