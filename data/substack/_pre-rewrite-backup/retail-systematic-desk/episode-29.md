---
title: "Find Correlation and Hidden Factor Bets"
subtitle: "Ten tickers can still be one concentrated position."
series_id: "retail-systematic-desk"
module_id: "portfolio-risk"
module_title: "Control the Portfolio Before the Trade"
module_episode: 2
episode_number: 29
scheduled_at: "2027-03-19T12:00:00.000Z"
send_email: false
---

*Part 2 of 3 in Control the Portfolio Before the Trade. Lesson 29 of 45 in Build a Retail Systematic Desk, Safely.*

Names from different industries may share the same growth, rate, commodity or broad-market factor. Measure pairwise dependence, but also group economic exposures and common event risk. Correlation is unstable, so it informs limits rather than certifying diversification.

**Input from last Friday:** The accepted stressed portfolio sizing sheet.

**Friday deliverable:** A factor-exposure stress map, owned by the desk operator and retained in the review bundle.

## Build this

Produce a portfolio map with sector, theme, beta, currency and event buckets. Show coverage and observation counts beside correlations. Add stress scenarios that shock common factors rather than isolated tickers.

### Minimum record

- `exposure_bucket`
- `weight`
- `beta`
- `correlation_window`
- `coverage`
- `stress_loss`

## Test it before moving on

Construct a portfolio with many names driven by one factor. The dashboard should reveal concentration even if ticker count looks diversified. Reduce coverage and confirm confidence falls.

**Operating limit:** The factor-exposure stress map is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the factor-exposure stress map (context, not implementation evidence):** [Investor.gov: Five Questions to Ask Before You Invest](https://www.investor.gov/introduction-investing/getting-started/five-questions-ask-you-invest); [FINRA: Concentration Risk](https://www.finra.org/investors/insights/concentration-risk)

Educational, not investment advice.

## Release decision

**GO:** Accept the factor-exposure stress map only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Do not call a portfolio diversified from name count alone.

**Next Friday:** Carry the accepted factor-exposure stress map into Gate Event Risk and Add Kill Switches.
