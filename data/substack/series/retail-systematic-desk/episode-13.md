---
title: "Use One Snapshot for One Decision"
subtitle: "Mixing data cuts makes a precise-looking plan impossible to reproduce."
series_id: "retail-systematic-desk"
module_id: "snapshots"
module_title: "Build Reproducible Market Snapshots"
module_episode: 1
episode_number: 13
scheduled_at: "2026-11-27T13:00:00.000Z"
send_email: false
---

*Part 1 of 3 in Build Reproducible Market Snapshots. Lesson 13 of 45 in Build a Retail Systematic Desk, Safely.*

A candidate selected on one close and enriched with another can pass gates it never satisfied simultaneously. Freeze the cut used by the whole decision. Optional live observations may be attached later, but they must not rewrite the historical snapshot.

**Input from last Friday:** The accepted corporate-action reconciliation runbook.

**Friday deliverable:** A single-cut snapshot manifest, owned by the desk operator and retained in the review bundle.

## Build this

Issue a snapshot identifier at collection time. Bind every facet, derived feature and review to it. Store required failures separately from optional failures and keep the expected close in the top-level record.

### Minimum record

- `snapshot_id`
- `captured_at`
- `expected_close`
- `source_versions`
- `required_failures`

## Test it before moving on

Attempt to combine a price page from one snapshot with a filing page from another. The assembler should reject the merge. Replaying the original bundle should reproduce identical structured decisions.

**Operating limit:** The single-cut snapshot manifest is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the single-cut snapshot manifest (context, not implementation evidence):** [Investor.gov: Researching Investments](https://www.investor.gov/introduction-investing/getting-started/researching-investments); [Investor.gov: How to Read a 10-K](https://www.investor.gov/introduction-investing/getting-started/researching-investments/how-read-10-k)

Educational, not investment advice.

## Release decision

**GO:** Accept the single-cut snapshot manifest only when the test above passes and its retained output matches the minimum record.

**NO-GO:** If two reviewers are looking at different cuts, neither review can certify the same plan.

**Next Friday:** Carry the accepted single-cut snapshot manifest into Hash the Evidence, Not the Narrative.
