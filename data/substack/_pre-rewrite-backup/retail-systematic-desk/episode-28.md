---
title: "Size at the Portfolio Level"
subtitle: "Per-trade loss is only one ceiling on position size."
series_id: "retail-systematic-desk"
module_id: "portfolio-risk"
module_title: "Control the Portfolio Before the Trade"
module_episode: 1
episode_number: 28
scheduled_at: "2027-03-12T13:00:00.000Z"
send_email: false
---

*Part 1 of 3 in Control the Portfolio Before the Trade. Lesson 28 of 45 in Build a Retail Systematic Desk, Safely.*

A position can fit its nominal stop and still make the portfolio fragile. Stops can gap and fill with slippage, so a loss budget is a target rather than a guaranteed ceiling. Size must also respect cash, concentration, gross and net exposure, liquidity, currency and event clustering.

**Input from last Friday:** The accepted locked validation protocol.

**Friday deliverable:** A stressed portfolio sizing sheet, owned by the desk operator and retained in the review bundle.

## Build this

Calculate candidate size from nominal stop distance and stressed gap, slippage, liquidity and event scenarios, then apply portfolio caps. Round down to supported quantities. Record every ceiling and the scenario that governed.

### Minimum record

- `risk_budget_target`
- `nominal_stop_loss`
- `stressed_loss`
- `liquidity_cap`
- `concentration_cap`
- `final_qty`

## Test it before moving on

Create two candidates with identical stops but different sector exposure and gap stress. Their quantities should differ for explicit reasons. Missing equity, currency conversion or stress inputs must block sizing.

**Operating limit:** The stressed portfolio sizing sheet is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the stressed portfolio sizing sheet (context, not implementation evidence):** [Investor.gov: Five Questions to Ask Before You Invest](https://www.investor.gov/introduction-investing/getting-started/five-questions-ask-you-invest); [FINRA: Concentration Risk](https://www.finra.org/investors/insights/concentration-risk)

Educational, not investment advice.

## Release decision

**GO:** Accept the stressed portfolio sizing sheet only when the test above passes and its retained output matches the minimum record.

**NO-GO:** Never increase size merely because the broker reports unused buying power.

**Next Friday:** Carry the accepted stressed portfolio sizing sheet into Find Correlation and Hidden Factor Bets.
