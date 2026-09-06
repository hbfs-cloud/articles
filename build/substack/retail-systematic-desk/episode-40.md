---
title: "Put the Decision and Controls First"
subtitle: "The first viewport should answer what, why, when and what blocks action."
series_id: "retail-systematic-desk"
module_id: "desktop-ux"
module_title: "Design a Decision-First Retail Desktop"
module_episode: 1
episode_number: 40
scheduled_at: "2027-06-04T12:00:00.000Z"
send_email: false
---
*Part 1 of 3 in Design a Decision-First Retail Desktop. Lesson 40 of 45 in Build a Retail Systematic Desk, Safely.*

::audience non_sub,free_sub
Each part stands on its own. This is 40 of 45 in Build a Retail Systematic Desk, Safely; earlier parts cover the groundwork but you can start here.
::end

Watch somebody open their own desk. They scroll. They scroll again, hunting a chart, then a table, then a badge, and two minutes later they still cannot say whether the plan is live. <mark>The first screen, meaning the part visible before any scrolling, has to answer that on its own.</mark>

**Input from last Friday:** the reconciliation report from the broker module.

**Friday deliverable:** A decision-first desktop summary, owned by the desk operator and kept with the week's evidence.

![A layer must fail loudly or not at all](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/layers_fail_safe.png)

## Build this

Six answers go at the top, written in words rather than decoration: is the plan active, until when, what triggers it, what proves it wrong, what risk is already on, and when do I look again. The fourth of those is the invalidation, the price or condition that says the idea has failed. Write it as a number, not as a mood.

Beneath that sits a checklist of the systematic controls, each one either passing or blocking, and a small scenario panel. Use the same five state words everywhere: ready, wait, blocked, expired, insufficient data. Not "ok" on one page and "green" on the next.

Compute those values once, in the data layer, and let the page render them. A number recomputed inside a template will eventually disagree with itself, and you will trust the wrong copy.

Keep: `decision_status`, `validity`, `trigger`, `invalidation`, `blocking_checks`, `next_observation`.

## Test it before moving on

Thirty seconds, one reader, no scrolling. Then three questions: can I act, what is the main risk, what would change the answer. Three right answers, or the layout has failed and the fix is layout, not more data.

The following budget is illustrative, invented to show proportions: a toy page carries 6 fields above the fold, 11 controls listed, 2 of them blocking, and 340 rows of supporting evidence further down that the reader never needs to reach.

**Operating limit:** a public teaching build over paper data. Live position sizes have no business on this screen.

Further reading: [Investor.gov's five questions to ask before investing](https://www.investor.gov/introduction-investing/getting-started/five-questions-ask-you-invest) and [FINRA on concentration risk](https://www.finra.org/investors/insights/concentration-risk).

Educational, not investment advice.

## Release decision

**GO:** three readers out of three answer all three questions without scrolling.

**NO-GO:** a letter grade, a dial, or a colour is not a decision state. Colour may repeat the answer; it cannot carry it.

**Next Friday:** the summary carries into Make Missing Data Actionable.
