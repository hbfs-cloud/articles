---
title: "Hash the Evidence, Not the Narrative"
subtitle: "Integrity comes from binding decisions to files and fields, not from confident prose."
series_id: "retail-systematic-desk"
module_id: "snapshots"
module_title: "Build Reproducible Market Snapshots"
module_episode: 2
episode_number: 14
scheduled_at: "2026-12-04T13:00:00.000Z"
send_email: false
---

*Part 2 of 3 in Build Reproducible Market Snapshots. Lesson 14 of 45 in Build a Retail Systematic Desk, Safely.*

A review cannot prove what it saw unless it is bound to a precise evidence set. Hash each input and aggregate the ordered hashes into one snapshot digest. A hash proves correspondence to a separately trusted checkpoint; by itself it proves neither completeness, truth nor original creation time.

**Input from last Friday:** The accepted single-cut snapshot manifest.

**Friday deliverable:** An independently checkpointed evidence digest, owned by the desk operator and retained in the review bundle.

## Build this

Create a manifest listing each evidence path, digest, source and relevant JSON pointer. Retain the aggregate digest independently or sign it, enforce append-only access where practical, and test restoration. Refuse publication or execution when a required file differs after review.

### Minimum record

- `evidence_path`
- `sha256`
- `source`
- `json_pointer`
- `aggregate_sha256`

## Test it before moving on

Change one byte in a reviewed input and run the release gate. It must invalidate the attestation. Restore the byte and confirm the replay returns the original digest and result.

**Operating limit:** The independently checkpointed evidence digest is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the independently checkpointed evidence digest (context, not implementation evidence):** [Investor.gov: Broker-Dealer Record-Keeping Requirements](https://www.investor.gov/introduction-investing/investing-basics/glossary/broker-dealers-record-keeping-requirements); [FINRA: Checking Trade Confirmations](https://www.finra.org/investors/insights/checking-trade-confirmations)

Educational, not investment advice.

## Release decision

**GO:** Accept the independently checkpointed evidence digest only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Do not accept a reviewer statement that is not bound to the exact snapshot it reviewed.

**Next Friday:** Carry the accepted independently checkpointed evidence digest into Replay Without Re-Querying.
