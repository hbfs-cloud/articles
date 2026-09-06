---
title: "Choose a Boring First Market"
subtitle: "The best learning environment is liquid, observable and operationally simple."
series_id: "retail-systematic-desk"
module_id: "mandate"
module_title: "Start With a Mandate, Not a Model"
module_episode: 3
episode_number: 3
scheduled_at: "2026-09-18T12:00:00.000Z"
send_email: false
---
*Part 3 of 3 in Start With a Mandate, Not a Model. Lesson 3 of 45 in Build a Retail Systematic Desk, Safely.*

Boring is the specification, not a compromise. Your first universe should contain instruments whose identity, trading hours and corporate actions — splits and dividends, the events that rewrite past prices — you can look up and reconcile on a Tuesday evening. Excitement is paid for in plumbing.

A toy funnel, with counts invented to show the shape of the filtering rather than any screen worth running:

- 5,397 symbols in the starting list
- 2,403 left after a liquidity floor, meaning a minimum of daily traded value so your own order is not the market
- 1,911 after dropping every name whose exchange calendar could not be sourced
- 41 more rejected because a split in the price history could not be reconciled against the adjusted series

![A fact is not a decision, and a decision is not an order](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/decision_flow.png)

What survives is dull. Dull is the product.

**Input from last Friday:** the accepted kill-and-resume matrix.

**Friday deliverable:** an instrument eligibility table, owned by the desk operator and kept in the review bundle.

## Build this

One row per instrument: exchange, asset type, currency, regular session, price source, the liquidity evidence you used, and whether corporate actions can be reconciled. Key every row on a stable instrument id, a number of your own that never changes, because tickers get retired and reassigned to other companies. Show the ticker on screen. Never join records on it.

### Minimum record

instrument id, listing venue, asset type, currency, session calendar, data coverage.

## Test it before moving on

Ask your resolver for three things: SYM_A, a share; SYM_E, a fund; and SYM_ZZZ, which does not exist. Invented names, deliberately. The first two must come back with different asset types, because a fund's distributions and holdings do not behave like a single company's. The third must come back unknown, and stay unknown. The failure worth hunting is the resolver that quietly turns a typo into a tradable instrument by uppercasing it.

**Operating limit:** paper exercise only; the counts above illustrate a funnel's shape and are not a screen to copy.

While you fill the table: [NYSE hours and calendars](https://www.nyse.com/markets/hours-calendars) and [what a split does to your price history](https://www.investor.gov/introduction-investing/investing-basics/glossary/stock-splits).

Educational, not investment advice.

## Release decision

**GO:** all three lookups behave as above and every row carries the six fields.

**NO-GO:** an instrument whose identity or trading calendar rests on free text alone does not enter the universe.

**Next Friday:** the eligibility table goes into Draw Hard System Boundaries.
