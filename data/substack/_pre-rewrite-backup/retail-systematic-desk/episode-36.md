---
title: "Make Every Run Auditable"
subtitle: "A quiet day and a crashed pipeline need different evidence."
series_id: "retail-systematic-desk"
module_id: "ledger-operations"
module_title: "Keep an Audit Trail That Survives Incidents"
module_episode: 3
episode_number: 36
scheduled_at: "2027-05-07T12:00:00.000Z"
send_email: false
---

*Part 3 of 3 in Keep an Audit Trail That Survives Incidents. Lesson 36 of 45 in Build a Retail Systematic Desk, Safely.*

Each scheduled run should leave a terminal record even when it does nothing. Include capabilities, data health, snapshot, decisions, gates, broker checks, actions and errors. A missing run marker is an operational incident, not no activity.

**Input from last Friday:** The accepted restart-and-supersession drill report.

**Friday deliverable:** A terminal run envelope, owned by the desk operator and retained in the review bundle.

## Build this

Create a run envelope with stage markers and a final status. Link structured outputs and hashes. Keep logs useful but do not depend on free text for accounting or execution state.

### Minimum record

- `run_id`
- `started_at`
- `completed_at`
- `stage_markers`
- `final_status`
- `artifacts`

## Test it before moving on

Kill the process after each stage in separate tests. Monitoring should identify the last completed marker and the final record should remain absent until recovery closes the run.

**Operating limit:** The terminal run envelope is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the terminal run envelope (context, not implementation evidence):** [Investor.gov: Broker-Dealer Record-Keeping Requirements](https://www.investor.gov/introduction-investing/investing-basics/glossary/broker-dealers-record-keeping-requirements); [FINRA: Checking Trade Confirmations](https://www.finra.org/investors/insights/checking-trade-confirmations)

Educational, not investment advice.

## Release decision

**GO:** Accept the terminal run envelope only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Do not mark a run completed because a wrapper process exited with code zero while required stages are missing.

**Next Friday:** Carry the accepted terminal run envelope into Check Broker Capabilities Before Placement.
