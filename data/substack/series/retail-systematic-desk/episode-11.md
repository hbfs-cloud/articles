---
title: "Treat Time as a First-Class Field"
subtitle: "Event time, observation time and ingestion time answer different questions."
series_id: "retail-systematic-desk"
module_id: "identity-time"
module_title: "Treat Identity and Time as Data"
module_episode: 2
episode_number: 11
scheduled_at: "2026-11-13T13:00:00.000Z"
send_email: false
---

*Part 2 of 3 in Treat Identity and Time as Data. Lesson 11 of 45 in Build a Retail Systematic Desk, Safely.*

One row of data can carry four different dates, and beginners squash them into one column called date. When something happened. When the public could first read about it. When your program looked. When it finally landed in your database. Squash them and your backtest starts reading tomorrow's newspaper, which is the single most flattering bug in this whole craft.

**Input from last Friday:** the accepted effective-dated instrument record.

**Friday deliverable:** a temporal-field contract, filed with the run's paperwork, a contract here being a short written rule about which date means what.

## Build this

Give the four dates four names and never let them collapse: event time, available-at, observed-at, ingested-at. Then make every query state its mode. A point-in-time query, meaning one that replays the past as it was known then, filters on available-at, not on the date printed inside the document. A current-value query answers about today only, and must refuse a request to reconstruct history rather than pretending.

Toy example, dates invented for illustration: an insider transaction in SYM_A executed on the 3rd, filed and public on the 7th, pulled by the loader on the 9th, and a later correction that arrives on the 21st. Four numbers, one row. A replay standing on the 5th that can see this row is cheating, and it will show up as a strategy that looks unusually good around news.

## Test it before moving on

Build that row by hand and replay it twice, once from the 5th and once from the 8th. The first must not see it. The second must. Then run the corrected version and confirm a replay of the 10th sees the original figures, not the tidy revision that only existed eleven days later.

**Operating limit:** paper stage, public write-up, no tuned parameter and no account detail, and nothing here is a performance claim.

Useful background: [Investor.gov on using EDGAR](https://www.investor.gov/introduction-investing/getting-started/researching-investments/using-edgar-research-investments), where the gap between a transaction date and a publication date is visible on the page, and [Investor.gov on broker-dealer record-keeping](https://www.investor.gov/introduction-investing/investing-basics/glossary/broker-dealers-record-keeping-requirements), a reminder that dated, retained records are the industry's own answer to this problem.

Educational, not investment advice.

## Release decision

**GO:** accept the contract when both replays behave, the correction test behaves, and every evidence row carries all four dates plus its mode.

**NO-GO:** never substitute today's value when the historical snapshot you asked for is missing. Return nothing and let the run stop.

**Next Friday:** the accepted contract carries into Corporate Events Can Change the Instrument.
