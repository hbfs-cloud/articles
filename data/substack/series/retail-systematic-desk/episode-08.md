---
title: "Make Freshness a Blocking Field"
subtitle: "Collected now does not mean the underlying market observation is current."
series_id: "retail-systematic-desk"
module_id: "data-health"
module_title: "Make Data Quality Executable"
module_episode: 2
episode_number: 8
scheduled_at: "2026-10-23T12:00:00.000Z"
send_email: false
---

*Part 2 of 3 in Make Data Quality Executable. Lesson 8 of 45 in Build a Retail Systematic Desk, Safely.*

A response timestamp only proves when the client received data. Trading requires the event date and the last completed market session. Weekend, holiday and delayed-source behavior make calendar arithmetic unsafe. The decision should compare the served close with the exact close it expected to trade.

**Input from last Friday:** The accepted capability bootstrap report.

**Friday deliverable:** A freshness gate test report, owned by the desk operator and retained in the review bundle.

## Build this

Store requested date, served date, market state, partial-bar policy and age. Resolve the expected session from an exchange calendar. Required bars must be complete and must reach that session; otherwise return stale or data insufficient.

### Minimum record

- `expected_close`
- `served_close`
- `include_partial`
- `market_state`
- `freshness_ok`

## Test it before moving on

Test a normal weekday, a holiday, a weekend and an upstream response that stops several sessions early while returning HTTP 200. Only the genuinely current dataset may pass.

**Operating limit:** The freshness gate test report is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the freshness gate test report (context, not implementation evidence):** [NYSE: Hours and Calendars](https://www.nyse.com/trade/hours-calendars); [Investor.gov: Executing an Order](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/executing-order)

Educational, not investment advice.

## Release decision

**GO:** Accept the freshness gate test report only when the test above passes and its retained output matches the minimum record.

**NO-GO:** A healthy transport response with stale market coverage is still a failed trading input.

**Next Friday:** Carry the accepted freshness gate test report into Preserve Partial Failures in Batches.
