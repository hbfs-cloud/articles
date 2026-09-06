---
title: "Preserve Partial Failures in Batches"
subtitle: "One bad symbol must not erase nine valid cells or make the batch look complete."
series_id: "retail-systematic-desk"
module_id: "data-health"
module_title: "Make Data Quality Executable"
module_episode: 3
episode_number: 9
scheduled_at: "2026-10-30T12:00:00.000Z"
send_email: false
---

*Part 3 of 3 in Make Data Quality Executable. Lesson 9 of 45 in Build a Retail Systematic Desk, Safely.*

Batching is efficient, but careless clients associate responses by array position or collapse any error into an empty result. Use canonical identity and per-cell status instead. A batch can be completed, partial or failed; the label should reflect what actually happened.

**Input from last Friday:** The accepted freshness gate test report.

**Friday deliverable:** A batch-integrity fixture pack, owned by the desk operator and retained in the review bundle.

## Build this

Key results by instrument id and facet. Include requested and returned ranges, missing intervals, truncation and pagination state. Concatenate pages only when their snapshot identifier matches.

### Minimum record

- `instrument_id`
- `facet`
- `requested_range`
- `returned_range`
- `pagination_token`
- `snapshot_id`

## Test it before moving on

Request one stock, one ETF and one unknown symbol across price and company-only facets. Valid stock data should survive; ETF fundamentals may be not applicable; the unknown identity should be unavailable. Shuffle response order to prove the client does not rely on indexes.

**Operating limit:** The batch-integrity fixture pack is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the batch-integrity fixture pack (context, not implementation evidence):** [Investor.gov: Researching Investments](https://www.investor.gov/introduction-investing/getting-started/researching-investments); [Investor.gov: How to Read a 10-K](https://www.investor.gov/introduction-investing/getting-started/researching-investments/how-read-10-k)

Educational, not investment advice.

## Release decision

**GO:** Accept the batch-integrity fixture pack only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Reject any batch whose pages come from different snapshots or whose results cannot be tied to canonical instruments.

**Next Friday:** Carry the accepted batch-integrity fixture pack into Resolve Identity Before You Use a Ticker.
