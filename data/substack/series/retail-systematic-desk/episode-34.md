---
title: "Use an Append-Only Decision Ledger"
subtitle: "Corrections should add records, not rewrite the history they explain."
series_id: "retail-systematic-desk"
module_id: "ledger-operations"
module_title: "Keep an Audit Trail That Survives Incidents"
module_episode: 1
episode_number: 34
scheduled_at: "2027-04-23T12:00:00.000Z"
send_email: false
---

*Part 1 of 3 in Keep an Audit Trail That Survives Incidents. Lesson 34 of 45 in Build a Retail Systematic Desk, Safely.*

A useful ledger records what the system knew, decided and attempted at the time. Later corrections reference the original event and add a new version. A hash chain detects changes only relative to a trusted external checkpoint; it does not make the storage truthful or complete by itself.

**Input from last Friday:** The accepted uncertain-submit recovery test.

**Friday deliverable:** An externally checkpointed decision ledger, owned by the desk operator and retained in the review bundle.

## Build this

Write events with sequence, timestamp, actor identity, object identifiers and previous-event hash. Retain signed or independently stored root hashes, restrict mutation access, test backup restoration and separate immutable events from derived views.

### Minimum record

- `sequence`
- `event_type`
- `actor`
- `object_id`
- `payload_hash`
- `previous_hash`
- `external_checkpoint`
- `recorded_at`

## Test it before moving on

Alter a historical event and confirm chain verification fails. Rebuild a dashboard from the unmodified ledger and compare it with the stored projection.

**Operating limit:** The externally checkpointed decision ledger is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the externally checkpointed decision ledger (context, not implementation evidence):** [Investor.gov: Broker-Dealer Record-Keeping Requirements](https://www.investor.gov/introduction-investing/investing-basics/glossary/broker-dealers-record-keeping-requirements); [FINRA: Checking Trade Confirmations](https://www.finra.org/investors/insights/checking-trade-confirmations)

Educational, not investment advice.

## Release decision

**GO:** Accept the externally checkpointed decision ledger only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Do not repair a past decision by editing it in place.

**Next Friday:** Carry the accepted externally checkpointed decision ledger into Design Recovery and Supersession.
