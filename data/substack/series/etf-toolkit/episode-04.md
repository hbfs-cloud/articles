---
title: "Automate Contributions, but Keep Allocation in Charge"
subtitle: "Dollar-cost averaging controls behavior; rebalancing controls portfolio drift."
module_id: "etf-toolkit"
episode_number: 4
source_path: "series/trader-etf/part4-strategies/index.html"
---

*Part 4 of 6 in The ETF Toolkit.*

Separate the contribution rule from the allocation rule. Dollar-cost averaging means investing equal amounts at regular intervals regardless of market swings. It can reduce the temptation to time each purchase, but it does not guarantee profit or make an expensive asset cheap. Rebalancing is the separate process that restores the portfolio's intended risk mix.

Take a hypothetical portfolio with a 60% equity and 40% bond target. After market moves, it holds $7,000 of equity and $3,000 of bonds: 70/30. A new $1,000 contribution can go entirely to bonds. The resulting $7,000/$4,000 mix is about 63.6/36.4, closer to target without selling. It is not exactly rebalanced, but new cash did part of the work while avoiding a taxable sale in a taxable account.

The procedure needs written tolerances. A calendar rule might review on fixed dates. A band rule might act when an asset moves outside a predeclared range. Neither is automatically best. Frequent trading can add spreads, taxes and administrative errors; waiting too long can allow the portfolio's risk to drift far from plan.

Tactical overlays need a higher bar. Sector rotation, trend filters and hedges are active strategies even when implemented with ETFs. Define the signal, observation time, trade time, costs and fallback asset before testing. Use data that existed at each historical decision, then validate outside the design sample. A chart showing that one sector led during a past cycle does not prove the same causal sequence will repeat.

Tax-loss harvesting also requires legal and operational care. Under US wash-sale rules, a loss can be disallowed when substantially identical securities are acquired within the specified window. The rule can involve other accounts and options. “Similar exposure” is not a complete legal test, and tax rules differ by country.

Use this operating checklist:

- Set contribution amount, date and eligible funds.
- Write target weights and rebalancing bands.
- Direct new cash toward underweight assets first.
- Estimate spread, tax and commission costs before selling.
- Keep tactical signals separate from the core allocation.
- Record every exception instead of changing rules after a loss.

DCA has an explicit counter-case: when a lump sum is already available, staging it delays market exposure. That may reduce regret if prices fall, but it can also reduce returns if prices rise. The right choice depends on risk capacity, horizon and the probability of abandoning the plan, not a promise that one path always wins.

Sources: [Investor.gov Dollar-Cost Averaging](https://www.investor.gov/introduction-investing/investing-basics/glossary/dollar-cost-averaging), [Investor.gov Asset Allocation and Rebalancing](https://www.investor.gov/introduction-investing/getting-started/asset-allocation), [IRS Publication 550](https://www.irs.gov/publications/p550).

Educational, not investment advice.
