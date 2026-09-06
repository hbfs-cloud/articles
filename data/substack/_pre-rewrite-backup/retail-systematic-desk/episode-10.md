---
title: "Resolve Identity Before You Use a Ticker"
subtitle: "The same symbol can refer to different instruments across venues and time."
series_id: "retail-systematic-desk"
module_id: "identity-time"
module_title: "Treat Identity and Time as Data"
module_episode: 1
episode_number: 10
scheduled_at: "2026-11-06T13:00:00.000Z"
send_email: false
---

*Part 1 of 3 in Treat Identity and Time as Data. Lesson 10 of 45 in Build a Retail Systematic Desk, Safely.*

Tickers are display labels, not durable primary keys. Listings change, symbols are reused and the same shorthand can represent different asset types. A systematic desk needs an instrument master that retains venue, currency, type and effective dates.

**Input from last Friday:** The accepted batch-integrity fixture pack.

**Friday deliverable:** An effective-dated instrument record, owned by the desk operator and retained in the review bundle.

## Build this

Create a resolver that returns one canonical record or an explicit ambiguous or unavailable result. Persist the identifier throughout data, decisions and orders. Keep the ticker as presentation metadata.

### Minimum record

- `instrument_id`
- `symbol`
- `exchange`
- `currency`
- `asset_type`
- `effective_from`
- `effective_to`

## Test it before moving on

Test a renamed listing, an ETF and an ambiguous symbol. Historical records must continue to point to the instrument that existed at the time; no request may resolve by uppercase conversion alone.

**Operating limit:** The effective-dated instrument record is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the effective-dated instrument record (context, not implementation evidence):** [Investor.gov: Researching Investments](https://www.investor.gov/introduction-investing/getting-started/researching-investments); [Investor.gov: How to Read a 10-K](https://www.investor.gov/introduction-investing/getting-started/researching-investments/how-read-10-k)

Educational, not investment advice.

## Release decision

**GO:** Accept the effective-dated instrument record only when the test above passes and its retained output matches the minimum record.

**NO-GO:** If the broker and market-data records cannot be joined without guessing, the instrument is not eligible.

**Next Friday:** Carry the accepted effective-dated instrument record into Treat Time as a First-Class Field.
