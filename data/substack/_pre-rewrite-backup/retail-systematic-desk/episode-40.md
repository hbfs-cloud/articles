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

A retail expert should not hunt through charts to learn whether a plan is active. Lead with status, validity, trigger, invalidation, risk state and next check. Detailed evidence belongs below, visible by default or through clear section navigation rather than one giant hidden disclosure.

**Input from last Friday:** The accepted broker reconciliation report.

**Friday deliverable:** A decision-first desktop summary, owned by the desk operator and retained in the review bundle.

## Build this

Design a summary band, a systematic control checklist and a scenario panel. Use consistent states such as ready, wait, blocked, expired and data insufficient. Keep the authoritative values in structured data and render them once.

### Minimum record

- `decision_status`
- `validity`
- `trigger`
- `invalidation`
- `blocking_checks`
- `next_observation`

## Test it before moving on

Give the page to a user for thirty seconds. They should identify whether action is allowed, the main risk and the condition that changes the status without scrolling through the full report.

**Operating limit:** The decision-first desktop summary is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the decision-first desktop summary (context, not implementation evidence):** [Investor.gov: Five Questions to Ask Before You Invest](https://www.investor.gov/introduction-investing/getting-started/five-questions-ask-you-invest); [FINRA: Concentration Risk](https://www.finra.org/investors/insights/concentration-risk)

Educational, not investment advice.

## Release decision

**GO:** Accept the decision-first desktop summary only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Do not use a grade, gauge or color as a substitute for the decision state.

**Next Friday:** Carry the accepted decision-first desktop summary into Make Missing Data Actionable.
