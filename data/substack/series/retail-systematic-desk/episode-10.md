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

A ticker is a name printed on a screen. Names get changed, reused and recycled: a company renames itself, disappears in a merger, and three years later a different business is trading under those same letters. Two exchanges can hand the same shorthand to two unrelated instruments on the same afternoon. Build your records around the name and your history quietly becomes a mixture of strangers.

**Input from last Friday:** the accepted batch-integrity fixture pack.

**Friday deliverable:** an effective-dated instrument record, filed with the run's paperwork, effective-dated meaning each row states the window of time it was true for.

## Build this

Write one function that turns a name into an identity, and give it three possible answers: here is exactly one instrument, or this is ambiguous, or I cannot find it. Never a best guess. Whatever it returns carries an internal identifier that you then use everywhere downstream, in data, in decisions, in orders. The ticker rides along as a label for humans, and nothing keys off it.

Each row holds the identifier, the symbol, the exchange, the currency, the asset type, and the two dates that bound it: valid from, valid until.

Toy master file, numbers invented to show the shape: 5,397 rows, of which 41 carry a symbol that some other instrument also used within the previous eight years. SYM_A is one of those. Asked plainly, the resolver finds two live matches, a fund quoted in one currency and an operating company quoted in another, and answers ambiguous. Add the exchange and it resolves to one. Add nothing and it stays refused, which is the correct outcome.

## Test it before moving on

Three cases: a listing that was renamed last year, a fund, and a symbol shared by two instruments. Records dated before the rename must still point at the instrument that existed then. And nothing may resolve on capitalisation alone, since making letters uppercase is not identification.

**Operating limit:** an open, paper-stage exercise. No live parameter, no allocation, no broker account, and no implied edge of any kind.

Two references worth keeping open: [Investor.gov on using EDGAR](https://www.investor.gov/introduction-investing/getting-started/researching-investments/using-edgar-research-investments), where filings are filed under a company number rather than a ticker, and [the SEC's Form 8-K](https://www.sec.gov/info/edgar/forms/form8-k.pdf), the form on which the changes that break your key tend to be announced.

Educational, not investment advice.

## Release decision

**GO:** accept the record when all three cases behave and every row carries identifier, symbol, exchange, currency, type and both dates.

**NO-GO:** if the broker's list and the data vendor's list cannot be joined without guessing, that instrument is not eligible to trade.

**Next Friday:** the accepted record carries into Treat Time as a First-Class Field.
