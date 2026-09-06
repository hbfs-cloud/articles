---
title: "Screen Broad, Then Narrow With Evidence"
subtitle: "Cheap deterministic filters should precede expensive research."
series_id: "retail-systematic-desk"
module_id: "scanner"
module_title: "Build a Scanner That Can Say No"
module_episode: 1
episode_number: 16
scheduled_at: "2026-12-18T13:00:00.000Z"
send_email: false
---
*Part 1 of 3 in Build a Scanner That Can Say No. Lesson 16 of 45 in Build a Retail Systematic Desk, Safely.*

::audience non_sub,free_sub
Each part stands on its own. This is 16 of 45 in Build a Retail Systematic Desk, Safely; earlier parts cover the groundwork but you can start here.
::end

A scanner narrows. It does not advise. Cheap checks run on everything, and only the survivors earn the slow work of reading a filing or checking an earnings date.

Here is a toy run, with counts invented to show the shape rather than measured in any real session. 5,397 symbols go in. A liquidity floor, meaning a minimum on how much stock changes hands on an average day so you can get back out, leaves 2,403. A price and session filter leaves 812. An event gate, which drops anything reporting earnings inside the holding window, leaves 11. Eleven names deserve research. The other 5,386 never cost you a second.

![A fact is not a decision, and a decision is not an order](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/decision_flow.png)

Last week's replay bundle is the input. This week it feeds a funnel.

**Friday deliverable:** a two-stage run record, where stage one lists the candidates and stage two lists the evidence that governs them.

## Build this

Save both stages separately, and never let stage two quietly rewrite stage one. Use a stable tie-break: when two candidates land on the same score, the order must be settled by something fixed such as the symbol string, not by whichever row the code happened to read first. A language model may read the record. It must not carry the numbers or redo the ranking.

### Minimum record

- `universe_version`
- `candidate_id`
- `rank`
- `gate_results`
- `evidence_status`

## Test it before moving on

Run the same frozen snapshot twice. Same 11 names, same ranks, same reasons, or something in your code is reading the clock when it should be reading the file. Then unplug one expensive source, the filings feed for instance, and confirm that only the candidates needing it turn ineligible. In the toy run that was 3 of the 11; the remaining 8 came through untouched.

**Operating limit:** every count above is a teaching number on paper. No live thresholds, no account, no claim that any of it pays.

For context, [NYSE hours and calendars](https://www.nyse.com/markets/hours-calendars) defines the session boundaries your first filter depends on, and the [SEC on trade execution](https://www.sec.gov/investor/pubs/tradexec.htm) explains why a thin, wide name is expensive long before it is wrong.

Educational, not investment advice.

## Release decision

**GO:** two runs, identical output, both stages on disk.

**NO-GO:** nothing gets published while evidence its setup requires is still pending. Half-checked is not checked.

**Next Friday:** the run record carries into Zero Candidates Is a Valid Outcome.
