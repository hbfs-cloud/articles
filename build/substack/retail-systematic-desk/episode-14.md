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

"I reviewed the data" is a sentence, not a proof. Bind the review to the exact files instead. A hash is a fingerprint: a short string computed from a file, which changes completely if a single byte inside it moves. Fingerprint each input, then fingerprint the ordered list of fingerprints, and you get one string that stands for the whole evidence set.

Say what that string does not do, because people oversell it. It proves the files match a copy you trusted earlier. It says nothing about whether the files are complete, whether the numbers in them are true, or when they were really created.

![Seal the evidence, not the story](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/evidence_chain.png)

**Input from last Friday:** The accepted single-cut snapshot manifest.

**Friday deliverable:** An evidence digest checkpointed somewhere the desk cannot quietly overwrite.

## Build this

List every piece of evidence with its path, its fingerprint, where it came from, and the exact field inside it the decision leaned on. Roll the list into one aggregate fingerprint. Park that aggregate outside the working folder, or sign it. Make the folder append-only if your storage allows it. Practise restoring from it before you need to. If a required file no longer matches after review, publication stops.

### Minimum record

- `evidence_path`
- `sha256`
- `source`
- `json_pointer`
- `aggregate_sha256`

## Test it before moving on

Flip one byte in one reviewed input and run the gate. Illustrative counts, not market data: 48 files listed, one edited, one fingerprint changed, aggregate changed, gate refuses. Put the byte back and the replay returns the original aggregate and the original result. A gate that shrugs at a changed byte is decoration.

**Operating limit:** Everything here runs on paper for teaching. There are no live parameters, no allocations, no account details, and no profit claim attached.

Further reading: [FINRA: Checking Trade Confirmations](https://www.finra.org/investors/insights/checking-trade-confirmations); [Investor.gov: Executing an Order](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/executing-order)

Educational, not investment advice.

## Release decision

**GO:** The tampering test fails the gate, the restore test passes it, and the stored fields cover the minimum record.

**NO-GO:** A reviewer statement that names no snapshot certifies nothing and should not be filed as if it did.

**Next Friday:** Carry the accepted digest into Replay Without Re-Querying.
