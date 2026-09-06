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

::audience non_sub,free_sub
Each part stands on its own. This is 25 of 45 in Build a Retail Systematic Desk, Safely; earlier parts cover the groundwork but you can start here.
::end

A backtest is a claim about the past: with these rules, this is what I would have done. The claim only holds if the simulation was blind to everything that had not happened yet. Lookahead — letting a test see tomorrow's information while it pretends to be yesterday — is the cheapest way to draw a beautiful curve that means nothing.

Three leaks account for most of it. Index membership taken from today's list and applied to a year when the list was different. Splits and mergers left unadjusted. And company figures stamped with the period they cover instead of the day they became public: a quarter ending in March is not knowable in March.

![The smooth curve is the one you fitted](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/forward_vs_backtest.png)

**Input from last Friday:** the accepted validated paper-plan fixture.

**Friday deliverable:** one frozen input bundle — data, versions and coverage locked together — filed with the week's paperwork.

## Build this

Freeze the inputs before the experiment starts, not after you like the answer. Record which dates you actually hold, which ranges are missing, and the configuration version in force. Keep the exploratory notebook apart from the runner that produces the official numbers. The notebook is for wandering; the runner is for the record.

### Minimum record

- `as_of`
- `available_at_filter`
- `universe_version`
- `coverage`
- `approximation_flags`

## Test it before moving on

Plant two traps in a fixture, meaning a small hand-built data set whose answers you already know. The numbers are invented to exercise the code, not observations of any market. First, a filing for SYM_A covering a period that ended on day 40 but only published on day 61: invisible on day 45, visible on day 62, no exceptions. Second, SYM_M joining the index on day 30: it must not appear in any candidate list dated day 29. Then run the identical bundle twice — 143 trades both times, same order, same metrics. If the two runs disagree, something in the pipeline is quietly reaching for live data.

**Operating limit:** a classroom bundle. Fixture data, invented counts, nothing that resembles a tradable result or a real book.

Background: [what an 8-K is and when it appears](https://www.sec.gov/info/edgar/forms/form8-k.pdf) and [how to look up the date a filing actually became public](https://www.investor.gov/introduction-investing/getting-started/researching-investments/using-edgar-research-investments).

Educational, not investment advice.

## Release decision

**GO:** both traps stay invisible until their availability date, and the repeated run matches trade for trade.

**NO-GO:** do not call a backtest historical proof when present-day fields governed past decisions. Name every approximated field, or drop it.

**Next Friday:** the accepted bundle carries into Model Costs, Gaps and Partial Fills.
