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

Pick a candidate on Tuesday's close, then check its filings on Wednesday morning, and you have written a plan that was never true at any single moment. Nobody lied. The two halves simply never existed together. A snapshot — one frozen copy of everything you looked at, taken at one instant — is the fix, and it costs almost nothing to build.

**Input from last Friday:** The accepted corporate-action reconciliation runbook.

**Friday deliverable:** A single-cut snapshot manifest: the list of what was captured, when, and from which version of each source.

## Build this

Stamp an identifier on the snapshot the moment you collect it. Every page of prices, every filing, every number you compute from them carries that same identifier, or it does not belong to the decision. Say out loud in the record which close you expected. Keep two separate piles: checks that must pass, and checks that are nice to have. Mixing those piles is how a weak candidate borrows credit from a strong one.

### Minimum record

- `snapshot_id`
- `captured_at`
- `expected_close`
- `source_versions`
- `required_failures`

## Test it before moving on

Try to glue a price page from one snapshot onto a filing page from another. The assembler must refuse. Toy numbers, made up to show the shape: snapshot 0x4C1 captures 2,403 symbols at 21:04, binds four sources and eleven derived fields, and records three required checks failed against six optional ones. Replay it and the eleven derived fields come back identical. Then hand the same manifest to a second reader and ask which close they are looking at. If the answer takes more than one glance, the manifest is not doing its job.

**Operating limit:** This is a public exercise on paper. It carries no live settings, no position sizes, no account detail, and it is not a strategy.

Further reading: [NYSE: Hours and Calendars](https://www.nyse.com/trade/hours-calendars); [FINRA: Extended-Hours Trading](https://www.finra.org/investors/insights/extended-hours-trading)

Educational, not investment advice.

## Release decision

**GO:** Accept the manifest once the merge is refused, the replay matches, and the stored fields cover the minimum record.

**NO-GO:** Two reviewers reading two different cuts cannot certify one plan, however confident either of them sounds.

**Next Friday:** Carry the accepted manifest into Hash the Evidence, Not the Narrative.
