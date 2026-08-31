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

A first systematic build should minimize market plumbing, not maximize excitement. Start with instruments whose identity, session, corporate actions and execution constraints are well documented. Avoid mixing asset classes until the system can distinguish their calendars, quote conventions and settlement behavior. Complexity can be added later; ambiguous records are much harder to remove.

**Input from last Friday:** The accepted kill-and-resume matrix.

**Friday deliverable:** An instrument eligibility table, owned by the desk operator and retained in the review bundle.

## Build this

Create an eligibility table for the first universe. Record exchange, asset type, currency, regular session, price source, minimum liquidity evidence and whether corporate actions can be reconciled. Use canonical instrument identifiers internally even if the interface displays tickers.

### Minimum record

- `instrument id`
- `listing venue`
- `asset type`
- `currency`
- `session calendar`
- `data coverage`

## Test it before moving on

Resolve a stock, an ETF and an intentionally unknown ticker. The first two must retain different asset types; the unknown symbol must remain unavailable rather than being guessed or uppercased into existence.

**Operating limit:** The instrument eligibility table is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the instrument eligibility table (context, not implementation evidence):** [NYSE: Hours and Calendars](https://www.nyse.com/trade/hours-calendars); [Investor.gov: Executing an Order](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/executing-order)

Educational, not investment advice.

## Release decision

**GO:** Accept the instrument eligibility table only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Do not admit an instrument when identity or trading calendar depends on a free-text ticker alone.

**Next Friday:** Carry the accepted instrument eligibility table into Draw Hard System Boundaries.
