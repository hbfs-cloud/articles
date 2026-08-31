---
title: "Gate Event Risk and Add Kill Switches"
subtitle: "Known events and system health should override the urge to deploy capital."
series_id: "retail-systematic-desk"
module_id: "portfolio-risk"
module_title: "Control the Portfolio Before the Trade"
module_episode: 3
episode_number: 30
scheduled_at: "2027-03-26T12:00:00.000Z"
send_email: false
---

*Part 3 of 3 in Control the Portfolio Before the Trade. Lesson 30 of 45 in Build a Retail Systematic Desk, Safely.*

Earnings, macro releases, halts and broker incidents can change execution risk faster than a daily model. Event gates belong in the plan before placement. Kill switches reduce further exposure when conditions cross predeclared boundaries; they do not guarantee cancellation, flattening or protection.

**Input from last Friday:** The accepted factor-exposure stress map.

**Friday deliverable:** An event-and-kill-state runbook, owned by the desk operator and retained in the review bundle.

## Build this

Maintain an event calendar with source and confidence. Define distinct halt-new-risk, cancel, reduce and flatten actions, reduce-only mode, explicit resume authority and an independent manual credential-revocation path. Keep event vetoes separate from strategy rejection.

### Minimum record

- `event_type`
- `event_time`
- `entry_veto`
- `kill_state`
- `broker_action`
- `verification_state`
- `resume_rule`

## Test it before moving on

Simulate an unconfirmed event date, a confirmed release and a broker outage. Every requested broker mutation must be read back. Ambiguous state blocks automatic repair, escalates to a human and remains distinct from a confirmed operational halt.

**Operating limit:** The event-and-kill-state runbook is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the event-and-kill-state runbook (context, not implementation evidence):** [Investor.gov: Using EDGAR to Research Investments](https://www.investor.gov/introduction-investing/getting-started/researching-investments/using-edgar-research-investments); [SEC: Form 8-K](https://www.sec.gov/info/edgar/forms/form8-k.pdf)

Educational, not investment advice.

## Release decision

**GO:** Accept the event-and-kill-state runbook only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Never bypass a kill state because a candidate appears unusually attractive.

**Next Friday:** Carry the accepted event-and-kill-state runbook into Simulate the Broker Before Connecting One.
