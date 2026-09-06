---
title: "Corporate Events Can Change the Instrument"
subtitle: "Splits, mergers and distributions are data transformations, not footnotes."
series_id: "retail-systematic-desk"
module_id: "identity-time"
module_title: "Treat Identity and Time as Data"
module_episode: 3
episode_number: 12
scheduled_at: "2026-11-20T13:00:00.000Z"
send_email: false
---

*Part 3 of 3 in Treat Identity and Time as Data. Lesson 12 of 45 in Build a Retail Systematic Desk, Safely.*

A price series can look continuous while shares, symbols or economic rights changed. Adjusted prices help historical return calculations but do not authorize a client to mutate live broker positions or orders. The broker may cancel, replace or adjust them first, so historical normalization and broker reconciliation are separate operations.

**Input from last Friday:** The accepted temporal-field contract.

**Friday deliverable:** A corporate-action reconciliation runbook, owned by the desk operator and retained in the review bundle.

## Build this

Maintain effective-dated corporate actions in a deduplicated event ledger. Normalize historical data through a tested transformation layer. For live state, pause the instrument, identify documented broker behavior, fetch broker-authoritative positions and orders, and apply an explicit repair only after reconciliation.

### Minimum record

- `action_type`
- `effective_date`
- `ratio_or_cash`
- `source`
- `position_effect`
- `order_effect`

## Test it before moving on

Replay a split where the broker has already adjusted one order and canceled another. The client must not double-adjust either record; reconciliation must remain balanced and the sealed decision artifact must remain unchanged.

**Operating limit:** The corporate-action reconciliation runbook is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the corporate-action reconciliation runbook (context, not implementation evidence):** [Investor.gov: Using EDGAR to Research Investments](https://www.investor.gov/introduction-investing/getting-started/researching-investments/using-edgar-research-investments); [SEC: Form 8-K](https://www.sec.gov/info/edgar/forms/form8-k.pdf)

Educational, not investment advice.

## Release decision

**GO:** Accept the corporate-action reconciliation runbook only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Pause the instrument when a material corporate action cannot be reconciled across data and broker records.

**Next Friday:** Carry the accepted corporate-action reconciliation runbook into Use One Snapshot for One Decision.
