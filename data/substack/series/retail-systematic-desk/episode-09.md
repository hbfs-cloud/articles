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

Asking for a hundred things in one request is cheap and sensible. The trouble starts with how most code reads the answer back. Two habits do the damage: matching answers to questions by their position in the list, and treating one bad item as a reason to throw the whole reply away, or worse, to report success with an empty basket.

**Input from last Friday:** the accepted freshness gate test report.

**Friday deliverable:** a batch-integrity fixture pack, filed with the run's paperwork.

## Build this

File every answer under two labels: which instrument it belongs to, using the durable internal identifier rather than the ticker, and which facet it is, a facet being one kind of information about that instrument, such as prices or company details.

Alongside each cell, keep the range you asked for, the range you actually received, any gap in the middle, whether the answer was cut short, and the snapshot identifier, meaning the stamp saying which version of the database served it. Glue pages together only when those stamps agree. Two halves from two snapshots are not one answer.

A toy batch, invented values for illustration: ten instruments requested across two facets, twenty cells expected. Fourteen come back complete. Four are marked not applicable, because SYM_D and SYM_E are funds and the company-details facet does not exist for them. One cell is truncated at 60 of 250 days. One instrument, SYM_K, never resolved at all. That is a partial batch. Calling it complete would have hidden six holes.

## Test it before moving on

Send one ordinary company, one fund and one symbol that does not exist, across both facets, then shuffle the order of the replies before your code reads them. The company data survives, the fund's company details come back as not applicable, the unknown one comes back as unavailable, and the shuffle changes nothing. If shuffling changes anything, you are still matching by position.

**Operating limit:** a public teaching exercise, run on paper, with no live sizing or account detail anywhere in it, and no suggestion that it produces profit.

Two readings that make the habit stick: [FINRA on checking trade confirmations](https://www.finra.org/investors/insights/checking-trade-confirmations), which is the same discipline applied line by line to your own fills, and [Investor.gov on reading a 10-K](https://www.investor.gov/introduction-investing/getting-started/researching-investments/how-read-10-k), a reminder that company facets belong to operating companies and not to every listed thing.

Educational, not investment advice.

## Release decision

**GO:** accept the pack when the shuffle test passes and every cell carries its instrument, facet, requested range, returned range, page token and snapshot stamp.

**NO-GO:** refuse any batch whose pages came from different snapshots, and any cell you cannot tie back to a known instrument.

**Next Friday:** the accepted pack opens Resolve Identity Before You Use a Ticker.
