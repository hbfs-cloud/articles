---
title: "Freeze the Scope Before You Write Code"
subtitle: "A narrow mandate prevents a prototype from quietly becoming an uncontrolled trading desk."
series_id: "retail-systematic-desk"
module_id: "mandate"
module_title: "Start With a Mandate, Not a Model"
module_episode: 1
episode_number: 1
scheduled_at: "2026-09-04T12:00:00.000Z"
send_email: false
---

*Part 1 of 3 in Start With a Mandate, Not a Model. Lesson 1 of 45 in Build a Retail Systematic Desk, Safely.*

Before the first line of code, write one page that says what this system may do and what it may never do. That page is the mandate. Market, session, holding period, permitted order types, paper or live, and the name of the person who can switch it off.

Then count what you just signed up for. A toy count, invented to show the shape rather than to be copied: one market, one decision moment per day, one order family gives you three things that can be wrong at seven in the morning. Add index options, a second broker and a coin that trades all weekend, and the same one-person desk is watching four clocks, three ways of spelling the same instrument, two settlement rules and a funding charge. Scope is not ambition. Scope is how many alarms one person can answer alone.

**Input from last Friday:** a blank repository and a named human owner.

**Friday deliverable:** a signed mandate, owned by the desk operator and filed in the review bundle — the dated folder holding the artefact, its test output and the sign-off.

## Build this

One page, two columns: in scope, out of scope. Any feature not written down starts at no and stays at no until someone can point to data coverage, a test and an owner. Name the pause, too: who stops the desk, and what forces it back to paper mode, where orders are written down and never sent.

### Minimum record

- market and session
- instrument types
- holding horizon
- allowed order families
- paper or live mode
- owner and kill path

## Test it before moving on

Hand the page to someone who did not write it, along with five invented requests: add an index future; trade the open as well as the close; double the size; add a second price feed; let it run overnight. They rule each one in or out without asking what you meant. In a dry run of mine, four were obvious and the second price feed split the room. That split is the useful part, because it names the sentence the mandate is missing.

**Operating limit:** a teaching exercise on paper. No live account, no real size, no claim that any of this earns money.

Two short reads while you draft: [holding period, defined](https://www.investor.gov/introduction-investing/investing-basics/glossary/holding-period), and the [CFTC education centre](https://www.cftc.gov/LearnAndProtect/EducationCenter/index.htm) on the products you are about to exclude.

Educational, not investment advice.

## Release decision

**GO:** your reader classifies all five requests the way you would, using only the page.

**NO-GO:** no scanner while the universe, the daily clock or the permitted products can still change mid-run.

**Next Friday:** the signed mandate goes into Define Non-Goals and Kill Criteria.
