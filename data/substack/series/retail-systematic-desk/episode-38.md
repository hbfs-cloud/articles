---
title: "Make Placement Idempotent"
subtitle: "Every retry must reconcile first and remain blocked when broker acceptance is unknown."
series_id: "retail-systematic-desk"
module_id: "broker-execution"
module_title: "Connect a Broker Without Losing Control"
module_episode: 2
episode_number: 38
scheduled_at: "2027-05-21T12:00:00.000Z"
send_email: false
---

*Part 2 of 3 in Connect a Broker Without Losing Control. Lesson 38 of 45 in Build a Retail Systematic Desk, Safely.*

Idempotence starts with durable business intent, not only order fields. Scope the intent by portfolio, plan, revision, candidate or group and execution window, then derive a canonical fingerprint. Prefer a broker-supported idempotency key; a local hash never proves that an unseen order was not accepted.

**Input from last Friday:** The accepted broker security and capability preflight.

**Friday deliverable:** A durable intent and deduplication record, owned by the desk operator and retained in the review bundle.

## Build this

Persist intent before the network call, define canonical field ordering and numeric precision, and keep request identity stable for identical retries. Search complete paginated order and execution history. An ambiguous result remains unknown and blocks automatic placement.

### Minimum record

- `portfolio_id`
- `plan_id`
- `revision`
- `candidate_id`
- `execution_window`
- `fingerprint`
- `broker_idempotency_key`
- `dedup_status`

## Test it before moving on

Submit the same intent through retries with fields in different JSON order. It should produce one fingerprint and one broker order. A real plan revision should produce a distinct fingerprint.

**Operating limit:** The durable intent and deduplication record is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the durable intent and deduplication record (context, not implementation evidence):** [Investor.gov: Broker-Dealer Record-Keeping Requirements](https://www.investor.gov/introduction-investing/investing-basics/glossary/broker-dealers-record-keeping-requirements); [FINRA: Checking Trade Confirmations](https://www.finra.org/investors/insights/checking-trade-confirmations)

Educational, not investment advice.

## Release decision

**GO:** Accept the durable intent and deduplication record only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Do not rely on a user-interface button becoming disabled as the duplicate-order control.

**Next Friday:** Carry the accepted durable intent and deduplication record into Reconcile Intent With Broker Reality.
