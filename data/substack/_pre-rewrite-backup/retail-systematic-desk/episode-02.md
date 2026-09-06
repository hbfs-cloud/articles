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

Goals such as maximize return are too loose for engineering. Pair every objective with a constraint and a shutdown rule. Examples include no leverage in the first version, no order without protection, no action on stale data and no automatic promotion from paper to live. A kill criterion is not pessimism; it is the point where evidence no longer supports continued operation.

**Input from last Friday:** The accepted signed mandate.

**Friday deliverable:** A kill-and-resume matrix, owned by the desk operator and retained in the review bundle.

## Build this

Add a non-goals section and a kill matrix to the mandate. Separate strategy failure, data failure, broker failure and process failure. Each row needs an observable trigger, immediate behavior, evidence to retain and the authority required to resume.

### Minimum record

- `failure family`
- `observable trigger`
- `automatic response`
- `retained evidence`
- `resume authority`

## Test it before moving on

Run a tabletop exercise for a stale close, a duplicate order response and a missing stop. The operator should know whether to abstain, cancel, reconcile or escalate without inventing a new rule in the moment.

**Operating limit:** The kill-and-resume matrix is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the kill-and-resume matrix (context, not implementation evidence):** [Investor.gov: Five Questions to Ask Before You Invest](https://www.investor.gov/introduction-investing/getting-started/five-questions-ask-you-invest); [FINRA: Concentration Risk](https://www.finra.org/investors/insights/concentration-risk)

Educational, not investment advice.

## Release decision

**GO:** Accept the kill-and-resume matrix only when the test above passes and its retained output matches the minimum record.

**NO-GO:** If any severe failure ends with keep watching rather than a deterministic action, the control is incomplete.

**Next Friday:** Carry the accepted kill-and-resume matrix into Choose a Boring First Market.
