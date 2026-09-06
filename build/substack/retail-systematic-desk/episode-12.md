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

::audience non_sub,free_sub
Each part stands on its own. This is 12 of 45 in Build a Retail Systematic Desk, Safely; earlier parts cover the groundwork but you can start here.
::end

A price chart can run smooth and straight while the thing underneath it quietly changed shape. A split — the company cuts each share into several smaller ones — a merger, a one-off cash payment: the line survives, the instrument does not. Adjusted history is fine for measuring past returns. It is not permission to rewrite what your broker is holding right now.

**Input from last Friday:** The accepted temporal-field contract.

![A layer must fail loudly or not at all](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/layers_fail_safe.png)

**Friday deliverable:** A corporate-action reconciliation runbook — one page saying who checks what, in which order — filed with the week's evidence.

## Build this

Keep every corporate action in one ledger, each row stamped with the date it takes effect, and collapse duplicates when two feeds report the same event. Run history through a transformation layer you have tested. For anything live, do the unclever thing: freeze the instrument, look up what your broker documents that it adjusts on its own, pull the broker's own position and order records, then apply a repair you wrote down in advance.

### Minimum record

- `action_type`
- `effective_date`
- `ratio_or_cash`
- `source`
- `position_effect`
- `order_effect`

## Test it before moving on

Replay a split where the broker has already adjusted one resting order and cancelled another. Toy figures for illustration, not market data: the ledger takes 34 events for the month, folds two duplicate feed entries into one, and hands 33 to the client. SYM_K splits four for one. The client must touch neither of the two orders the broker already handled — repair them a second time and the paper position lands four times too large, which is the exact bug this drill exists to catch. The sealed decision file from earlier in the week comes out unchanged, byte for byte, or the run failed.

**Operating limit:** Paper only, public teaching material. No live sizing, no account numbers, and nothing here makes money.

Further reading: [SEC: Form 8-K](https://www.sec.gov/info/edgar/forms/form8-k.pdf); [Investor.gov: Types of Orders](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/types-orders)

Educational, not investment advice.

## Release decision

**GO:** The runbook passes the replay above and what it stored matches the minimum record, field for field.

**NO-GO:** An action you cannot line up across data and broker records means the instrument stays frozen until you can.

**Next Friday:** Carry the accepted runbook into Use One Snapshot for One Decision.
