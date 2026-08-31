---
title: "Persist State, Validity and Revisions"
subtitle: "A stateful strategy cannot be reconstructed safely from broker positions alone."
series_id: "retail-systematic-desk"
module_id: "decision-contract"
module_title: "Make Strategy Decisions Machine-Readable"
module_episode: 2
episode_number: 23
scheduled_at: "2027-02-05T13:00:00.000Z"
send_email: false
---

*Part 2 of 3 in Make Strategy Decisions Machine-Readable. Lesson 23 of 45 in Build a Retail Systematic Desk, Safely.*

Strategy state may include entry dates, trailing references, cooldowns or risk halts. Treat it as an opaque object owned by the decision engine. A revised plan explicitly supersedes the previous one; two plans are never merged by convenience.

**Input from last Friday:** The accepted versioned strategy configuration schema.

**Friday deliverable:** A supersession state record, owned by the desk operator and retained in the review bundle.

## Build this

Persist state per portfolio with plan id, revision, validity and supersession reference. Store it only after a successful decision. Echo it unchanged on the next run and keep broker snapshots as separate evidence.

### Minimum record

- `plan_id`
- `revision`
- `state`
- `valid_from`
- `valid_until`
- `supersedes_plan_id`

## Test it before moving on

Restart between two decisions and confirm the same state resumes. Submit an older revision after a newer one and require rejection. Expire a plan and prove it can no longer create an order.

**Operating limit:** The supersession state record is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the supersession state record (context, not implementation evidence):** [Investor.gov: Broker-Dealer Record-Keeping Requirements](https://www.investor.gov/introduction-investing/investing-basics/glossary/broker-dealers-record-keeping-requirements); [FINRA: Checking Trade Confirmations](https://www.finra.org/investors/insights/checking-trade-confirmations)

Educational, not investment advice.

## Release decision

**GO:** Accept the supersession state record only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Do not infer missing strategy state from current holdings or an explanatory note.

**Next Friday:** Carry the accepted supersession state record into Use a Complete Machine-Readable Plan.
