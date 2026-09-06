---
title: "Make Missing Data Actionable"
subtitle: "Unavailable is useful only when the interface explains impact and recovery."
series_id: "retail-systematic-desk"
module_id: "desktop-ux"
module_title: "Design a Decision-First Retail Desktop"
module_episode: 2
episode_number: 41
scheduled_at: "2027-06-11T12:00:00.000Z"
send_email: false
---
*Part 2 of 3 in Design a Decision-First Retail Desktop. Lesson 41 of 45 in Build a Retail Systematic Desk, Safely.*

::audience non_sub,free_sub
Each part stands on its own. This is 41 of 45 in Build a Retail Systematic Desk, Safely; earlier parts cover the groundwork but you can start here.
::end

An empty card teaches the reader that nothing is wrong. That is the failure. On a screen, silence and calm look identical, and only one of the two is safe to act on.

**Input from last Friday:** the decision-first summary you accepted.

![A layer must fail loudly or not at all](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/layers_fail_safe.png)

**Friday deliverable:** A missing-data impact component, owned by the desk operator and filed with the week's evidence.

## Build this

One component, reused everywhere a value can go missing. It states four things: which feed failed, whether that failure blocks the decision, when the last good value arrived, and what the next permitted step is with a name attached to it. Call each feed a facet, meaning one slice of the data such as quotes, filings, or company fundamentals.

Then separate two cases that look alike on screen and mean opposite things. "Does not apply" is permanent and harmless, the way a fund has no earnings date and never will. "Temporarily unavailable" is a fault with a clock running on it. Collapsing both into one grey box destroys exactly the distinction the reader needs most.

Anything blocking gets promoted into the summary checklist you built last week. Anything decorative and empty comes off the page entirely rather than getting stuffed with a placeholder tile.

Keep: `facet`, `status`, `blocking`, `last_valid_at`, `recovery_action`, `owner`.

## Test it before moving on

Build fixtures for all three shapes and hand them to somebody who has not read the code.

Counts here are invented to show the ratio, not to describe any market: a toy render puts 14 panels on the page, 3 of them without data. One quote sits 41 minutes past a 15-minute freshness limit and blocks. One social feed is offline, which changes nothing and blocks nothing. One fundamentals panel reads not applicable because SYM_E is a fund. Your reader must not mistake any of the three for a calm signal.

**Operating limit:** fixtures over paper data, written to teach the pattern rather than to run money through it.

Further reading: [Investor.gov on using EDGAR to research investments](https://www.investor.gov/introduction-investing/getting-started/researching-investments/using-edgar-research-investments) and [the NYSE hours and holiday calendar](https://www.nyse.com/trade/hours-calendars), which quietly explains a good share of "missing" data.

Educational, not investment advice.

## Release decision

**GO:** all three fixtures render distinctly, and the blocking one shows up in the summary checklist.

**NO-GO:** never compute a score across a gap, and never pad a layout with N/A tiles.

**Next Friday:** this component feeds Use Alerts That Lead to Decisions.
