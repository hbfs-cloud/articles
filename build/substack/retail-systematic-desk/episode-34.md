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

::audience non_sub,free_sub
Each part stands on its own. This is 34 of 45 in Build a Retail Systematic Desk, Safely; earlier parts cover the groundwork but you can start here.
::end

Something breaks on a Tuesday. By Thursday you understand it, and the tempting move is to reach back and fix the Tuesday row. <mark>Do that once and the ledger stops being evidence; it becomes an opinion you keep updating.</mark>

Append-only means the file only grows. A correction is a new row pointing at the old one, saying what changed and why. Public companies operate the same way: an error in a filed 8-K comes back as a dated amendment sitting beside the original, never in place of it ([SEC: Form 8-K](https://www.sec.gov/info/edgar/forms/form8-k.pdf)).

![You correct by adding, never by erasing](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/append_only_ledger.png)

Toy month, invented counts for illustration: 612 events written, 3 of them corrections, 0 rows edited, 615 rows on disk. The third number is the one that matters. If it ever moves, no dashboard will tell you.

**Input from last Friday:** the accepted uncertain-submit drill.

**Friday deliverable:** a checkpointed decision ledger, owned by the desk operator and kept in the review bundle.

## Build this

Each row carries a sequence number, the time, who or what caused it, the object it concerns, a fingerprint of its own contents, and the fingerprint of the row before it. That last field is the chain: alter an old row and every fingerprint after it stops matching.

The chain by itself proves very little. Whoever can rewrite rows can recompute fingerprints just as easily. So the day's final fingerprint goes somewhere you cannot quietly revise later: signed, mailed to yourself, written to storage under different credentials. That outside copy is the checkpoint, and it is the part that turns arithmetic into evidence.

Keep raw events apart from anything calculated from them. Positions, equity, statistics are all rebuildable and all disposable.

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

Edit one historical row by hand, changing a single quantity, then run verification. It must fail and it must name the row. Next, rebuild yesterday's position view from the events alone and compare it field by field against the view you stored. A toy pass turned up one mismatch, in a rounding rule (illustration only) — precisely the class of quiet bug this comparison exists to surface.

**Operating limit:** everything here is public architecture on paper data. No live account, no allocation, no threshold from any running system, no performance claim. Educational, not investment advice. Retention duties for regulated firms, as background on why records outlive incidents: [Investor.gov: Broker-Dealer Record-Keeping Requirements](https://www.investor.gov/introduction-investing/investing-basics/glossary/broker-dealers-record-keeping-requirements).

## Release decision

**GO:** accept the ledger when tampering is detected, the rebuild matches, and the retained output carries all eight fields.

**NO-GO:** never repair a past decision by editing it where it sits.

**Next Friday:** carry the accepted ledger into Design Recovery and Supersession.

> The chain is arithmetic. The copy you cannot quietly revise is what turns it into evidence.
