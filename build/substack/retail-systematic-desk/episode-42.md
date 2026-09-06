---
title: "Use Alerts That Lead to Decisions"
subtitle: "An alert should identify impact, required action and urgency."
series_id: "retail-systematic-desk"
module_id: "desktop-ux"
module_title: "Design a Decision-First Retail Desktop"
module_episode: 3
episode_number: 42
scheduled_at: "2027-06-18T12:00:00.000Z"
send_email: false
---
*Part 3 of 3 in Design a Decision-First Retail Desktop. Lesson 42 of 45 in Build a Retail Systematic Desk, Safely.*

::audience non_sub,free_sub
Each part stands on its own. This is 42 of 45 in Build a Retail Systematic Desk, Safely; earlier parts cover the groundwork but you can start here.
::end

The fastest way to make a desk useless is to make it chatty. <mark>People mute what cries wolf, they mute it permanently, and the one message that mattered goes down with the rest.</mark>

**Input from last Friday:** the missing-data component from last week's build.

**Friday deliverable:** An action-owned alert policy, owned by the desk operator and kept with the week's evidence.

![A fact is not a decision, and a decision is not an order](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/decision_flow.png)

## Build this

Every alert carries five things: what it concerns, the state that thing is in now, what happens if nobody moves, what to do, and by when. Cannot fill the last two? Then it is not an alert. It is a log line, and it belongs in the run history where nobody gets paged for it.

Give each alert a deduplication key, a label built from the object plus the fault, so a hundred repeats of one complaint collapse into a single entry with a counter beside it. Set the collapse window per class. A feed can go stale every second; you want to hear it once, with the count.

Then rank by consequence. A price moving is information. A missing protection or an expired plan is an obligation, with an owner and a deadline, and it should look nothing like the first.

Keep: `severity`, `dedup_key`, `affected_object`, `consequence`, `required_action`, `deadline`.

## Test it before moving on

Replay a burst of repeated stale-data events with one protection failure buried inside the noise.

The counts are invented purely as illustration: a toy week raises 612 events, of which 574 are the same feed complaint firing every minute and collapse to 4 entries under a 30-minute window. One protection gap on SYM_H survives deduplication, stays loud, and carries a deadline. Nobody finds that line inside 612. Everybody finds it inside 12.

**Operating limit:** simulated events only, with no live account plumbed into the notifier at any point.

Further reading: [the CFTC advisory on trading-system claims](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/fraudadv_tradingsystem.html) and [FINRA on extended-hours trading](https://www.finra.org/investors/insights/extended-hours-trading), a reliable source of alerts that mean nothing.

Educational, not investment advice.

## Release decision

**GO:** the noisy class collapses, the protection failure survives, and every alert left standing names an action and a deadline.

**NO-GO:** do not send anything the reader cannot act on. An alert with no required action trains people to ignore the next one.

**Next Friday:** the policy carries into Keep the Language Model Out of Arithmetic.
