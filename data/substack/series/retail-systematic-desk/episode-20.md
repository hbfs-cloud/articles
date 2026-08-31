---
title: "Test the Sector, Leaders and Blast Radius"
subtitle: "Peers can confirm context without becoming proof of causality."
series_id: "retail-systematic-desk"
module_id: "certification"
module_title: "Turn Candidates Into Conditional Plans"
module_episode: 2
episode_number: 20
scheduled_at: "2027-01-15T13:00:00.000Z"
send_email: false
---

*Part 2 of 3 in Turn Candidates Into Conditional Plans. Lesson 20 of 45 in Build a Retail Systematic Desk, Safely.*

A company rarely trades in isolation. Compare direct peers, sector leadership, suppliers, customers and high-beta proxies, but separate economic links from statistical co-movement. Correlation after removing a broad-market factor is more informative than raw synchronized movement, yet it still does not prove causality.

**Input from last Friday:** The accepted candidate certification sheet.

**Friday deliverable:** A factor-documented peer map, owned by the desk operator and retained in the review bundle.

## Build this

Map peers by economic role, then measure comparable returns over aligned windows. Record the benchmark or factor model, return convention, estimation window, missing-data policy, residualization method, overlap and coverage. Keep the company's own event chronology in control of the conclusion.

### Minimum record

- `peer_id`
- `economic_role`
- `factor_model`
- `return_convention`
- `window`
- `residual_method`
- `coverage`

## Test it before moving on

Introduce a market-wide rally into synthetic peer series. Raw correlations should rise; market-neutral relationships may not. The interface should label weak coverage instead of ranking it as conviction.

**Operating limit:** The factor-documented peer map is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the factor-documented peer map (context, not implementation evidence):** [NIST: Bootstrap Plot](https://www.itl.nist.gov/div898/handbook/eda/section3/bootplot.htm); [NIST: Process Modeling](https://www.itl.nist.gov/div898/handbook/pmd/section1/pmd141.htm)

Educational, not investment advice.

## Release decision

**GO:** Accept the factor-documented peer map only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Never turn one proxy move into an automatic instruction for another security.

**Next Friday:** Carry the accepted factor-documented peer map into Turn Price Levels Into Conditional Plans.
