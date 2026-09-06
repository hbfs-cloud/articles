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

Empty cards waste attention. When data is missing, show which source or facet failed, whether it blocks the decision, the last valid observation and the next permitted recovery step. Suppress decorative sections that contribute nothing.

**Input from last Friday:** The accepted decision-first desktop summary.

**Friday deliverable:** A missing-data impact component, owned by the desk operator and retained in the review bundle.

## Build this

Create a missing-data component with status, scope, impact, last valid time and recovery owner. Distinguish not applicable from temporarily unavailable. Place blocking gaps in the summary checklist.

### Minimum record

- `facet`
- `status`
- `blocking`
- `last_valid_at`
- `recovery_action`
- `owner`

## Test it before moving on

Render fixtures for stale prices, unavailable social data and not-applicable company fundamentals on an ETF. The user should not mistake any of them for a neutral signal.

**Operating limit:** The missing-data impact component is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the missing-data impact component (context, not implementation evidence):** [Investor.gov: Researching Investments](https://www.investor.gov/introduction-investing/getting-started/researching-investments); [Investor.gov: How to Read a 10-K](https://www.investor.gov/introduction-investing/getting-started/researching-investments/how-read-10-k)

Educational, not investment advice.

## Release decision

**GO:** Accept the missing-data impact component only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Do not calculate scores from missing values or fill blank sections with N/A tiles.

**Next Friday:** Carry the accepted missing-data impact component into Use Alerts That Lead to Decisions.
