---
title: "Zero Candidates Is a Valid Outcome"
subtitle: "Forcing a quota converts selectivity into hidden risk."
series_id: "retail-systematic-desk"
module_id: "scanner"
module_title: "Build a Scanner That Can Say No"
module_episode: 2
episode_number: 17
scheduled_at: "2026-12-25T13:00:00.000Z"
send_email: false
---

*Part 2 of 3 in Build a Scanner That Can Say No. Lesson 17 of 45 in Build a Retail Systematic Desk, Safely.*

Zero is an answer. Some days nothing is worth doing, and a desk that cannot say so will manufacture work to fill the screen.

The trap is that a crash also returns nothing. Same empty list, opposite meaning.

So the empty list has to arrive with proof that the machine actually ran, and the proof is a column of counters. These are teaching numbers, invented for the lesson, not a real session: universe 5,397, then liquidity 2,384, then trend 604, then setup 0. Read down that column and the emptiness explains itself, because the last rule was strict on a quiet tape. Now read a second column: 0, 0, 0, 0. That is not a calm market. That is a data feed that never loaded, and it must never print the same message as the calm one.

**Friday deliverable:** a no-setup run record that says which of those two stories happened.

## Build this

Emit a marker at every stage carrying name, time, count in, count out, status and warnings. When the output is zero, run an ablation, meaning you switch off one rule at a time to see what comes back. If dropping the trend rule returns 14 names, the day was quiet and your rule was tight. If nothing returns even with every rule off, the fault is upstream of your logic.

Three possible endings, never one: `no_setup`, `data_insufficient`, `pipeline_failure`.

### Minimum record

- `stage`
- `ran_at`
- `input_count`
- `output_count`
- `status`
- `warnings`

## Test it before moving on

Build three fixtures, which are saved fake inputs you can replay on demand: a genuinely quiet screen, an empty universe, and an enrichment source that dies mid-run. In that third toy fixture only 2 of 9 symbols answered, SYM_A and SYM_K, and the other seven timed out. Only the first fixture may print no setup. The other two must stop and name the cause.

**Operating limit:** invented counters, replayed on paper, with no live setting and no performance behind them.

Worth reading: [NIST on control charts](https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc31.htm) for the habit of tracking a process by its own counts, and the [CFTC advisories](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/index.htm) on systems that promise a signal every single day.

Educational, not investment advice.

## Release decision

**GO:** the three fixtures land in three different endings, counters retained for each.

**NO-GO:** an interface that expects cards is not a reason to produce cards.

**Next Friday:** the no-setup record carries into Explain Every Rejection.
