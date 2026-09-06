---
title: "Automate Contributions, but Keep Allocation in Charge"
subtitle: "Dollar-cost averaging controls behavior; rebalancing controls portfolio drift."
module_id: "etf-toolkit"
episode_number: 4
source_path: "series/trader-etf/part4-strategies/index.html"
---
*Part 4 of 6 in The ETF Toolkit.*

Two rules, and people keep collapsing them into one. The contribution rule says how money arrives. The allocation rule says where it sits. Automating the first does nothing for the second.

Dollar-cost averaging means buying a fixed amount on a fixed date, whatever the price. Its real product is behavioural — you stop arguing with yourself every month. What it does not do is make an expensive asset cheap. Vanguard compared the two approaches across 92 years of data and found that investing a lump sum beat spreading it out roughly 68% of the time, for the unglamorous reason that markets rise more often than they fall. Staging a windfall buys comfort and costs expected return. Which one you need depends on whether you would actually still be holding after a 20% fall.

![Many tickers can be one bet](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/exposure_lookthrough.png)

Frequency matters far less than people assume. Over 20 years on the S&P 500, monthly contributions returned about 9.8% a year and weekly about 9.9% — while going from 12 transactions a year to 52. Monthly wins on paperwork alone.

Now the rule that actually controls risk. Say the target is 60% stocks, 40% bonds. Markets move, and the account ends up holding $7,000 of stocks and $3,000 of bonds. That is 70/30 — riskier than the plan, without a single decision being made. Send a new $1,000 contribution entirely to bonds and you get $7,000/$4,000, about 63.6/36.4. Not exact. But the drift shrank, and nothing was sold, which matters in a taxable account.

Write the tolerance down before you need it. A calendar rule reviews on fixed dates. A band rule acts when a sleeve strays more than, say, 5 points from target. Neither is automatically better. Trading too often pays spreads and taxes; waiting too long lets the risk profile drift into someone else's plan.

Tactical overlays deserve a higher bar than the core. Sector rotation, trend filters and hedges are active strategies even when the instrument is a plain index fund. Define the signal, the observation time, the execution time, the costs and the fallback asset before testing. Use only data that existed on each decision date. Then validate outside the sample you designed on. A chart of which sector led during some past cycle is not proof the same sequence repeats.

Harvesting losses has legal edges. Under US wash-sale rules a loss can be disallowed when a substantially identical security is bought back inside the specified window, and the rule can reach across other accounts and into options. The usual workaround is swapping between two near-identical funds from different issuers, correlated above 0.99 — but "similar exposure" is not a legal test, and tax rules differ by country.

Operating checklist:

- Set the contribution amount, the date and the eligible funds.
- Record target weights and the rebalancing band right next to them.
- Send new cash to the underweight sleeve first.
- Estimate spread, tax and commission before any sale.
- Keep tactical positions on a separate line from the core allocation.
- Log every exception instead of rewriting the rule after a loss.

None of this creates return. Automation removes the decision that hurts most people — whether to buy this month — and rebalancing keeps risk close to what you signed up for. Neither can stop a diversified portfolio from falling, and neither survives a plan you abandon in month nine, whatever the backtest promised.

Sources: [Investor.gov Dollar-Cost Averaging](https://www.investor.gov/introduction-investing/investing-basics/glossary/dollar-cost-averaging), [Investor.gov Asset Allocation and Rebalancing](https://www.investor.gov/introduction-investing/getting-started/asset-allocation), [IRS Publication 550](https://www.irs.gov/publications/p550).

Educational, not investment advice.
