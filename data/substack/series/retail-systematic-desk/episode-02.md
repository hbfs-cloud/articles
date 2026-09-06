---
title: "Define Non-Goals and Kill Criteria"
subtitle: "A safe system states what it refuses to optimize and when it must stop."
series_id: "retail-systematic-desk"
module_id: "mandate"
module_title: "Start With a Mandate, Not a Model"
module_episode: 2
episode_number: 2
scheduled_at: "2026-09-11T12:00:00.000Z"
send_email: false
---

*Part 2 of 3 in Start With a Mandate, Not a Model. Lesson 2 of 45 in Build a Retail Systematic Desk, Safely.*

Last Friday you signed a mandate, meaning a short written statement of what this desk is for. Today you write the other half: what it refuses to do, and when it has to stop.

"Make money" cannot be coded. A refusal can. Three worth borrowing: no borrowed money in version one, no order sent without a protective exit already attached, no decision computed from a price older than the last close. A kill criterion is not gloom. It is the line where the evidence stops supporting the machine, and where somebody says so out loud before the account says it for you.

**Friday deliverable:** a kill-and-resume matrix, which is just a table of what breaks, what happens automatically when it breaks, and who is allowed to switch things back on.

## Build this

Four failure families, kept apart because they fail differently: strategy, data, broker, process. Each row carries a trigger you can observe, the automatic response, the evidence you keep, and the person who may resume.

Rows to fill:

- `failure_family`
- `observable_trigger`
- `automatic_response`
- `retained_evidence`
- `resume_authority`

Write triggers you can count. "Feels wrong" is not a trigger. "The last close is more than one session old" is.

## Test it before moving on

Tabletop it: read a scenario aloud, then follow your own table. The numbers below are invented for the drill, not observations of any market. The close is 2 sessions stale. The broker returns 2 identical fills for 1 order. One of 3 open positions has no stop attached. Each time, the operator should reach for a row rather than for an opinion, and should land on abstain, cancel, reconcile or escalate within a few seconds.

**Operating limit:** paper only, toy numbers, no live account and no real thresholds. The matrix is a habit, not an edge.

Two sources for context: the [SEC on margin](https://www.sec.gov/investor/pubs/margin.htm) explains why borrowed money is the first thing a beginner desk should refuse, and [FINRA on cybersecurity](https://www.finra.org/rules-guidance/key-topics/cybersecurity) covers the process failures nobody plans for.

Educational, not investment advice.

## Release decision

**GO:** every severe failure ends in a named action and a named person.

**NO-GO:** any row whose response reads "keep watching" is unfinished. That is a feeling wearing the costume of a control.

**Next Friday:** the accepted matrix travels with you into Choose a Boring First Market.
