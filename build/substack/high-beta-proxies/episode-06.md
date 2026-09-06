---
title: "Use Portfolio Beta as One Risk Lens"
subtitle: "Aggregate exposures consistently and monitor the factors left behind"
module_id: "high-beta-proxies"
episode_number: 6
source_path: "series/proxys-haut-beta/part6-portefeuille-beta/index.html"
---
*Part 6 of 6 in Use High-Beta Proxies Without Getting Trapped.*

::audience non_sub,free_sub
Each part stands on its own. This is 6 of 6 in Use High-Beta Proxies Without Getting Trapped; earlier parts cover the groundwork but you can start here.
::end

Beta says one thing: how hard a holding tends to swing when the market swings 1%. A beta of 1.8 has historically moved about 1.8 times as far, in both directions. Portfolio beta applies that idea to the whole book. Track it. Just never mistake it for a description of your risk.

The arithmetic is a weighted average. Multiply each position's weight by its beta, then add. The teaching book we built across this series puts 50% into sector funds averaging beta 1.35, 35% into single stocks averaging 1.85, and 15% into hedges averaging −0.15. So 0.50 × 1.35 + 0.35 × 1.85 + 0.15 × (−0.15) = 1.30. Each piece, weight times beta, is that slice's share of the market exposure. Short positions keep their minus sign.

Now fill that skeleton in: twelve real positions across seven sectors, 7% left in cash. The same book prints 1.18, not 1.30. Nothing about the strategy changed — only which names landed in which sleeve, and how much cash sat idle. <mark>The number is an output of composition, not a property of the plan.</mark>

One condition makes the sum legitimate. Every beta in it has to be built the same way: same benchmark, same return frequency, same estimation window, same currency handling, same rule for missing days. Mix a 90-day beta against the Nasdaq with a one-year beta against the S&P and the total is decoration.

![Many tickers can be one bet](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/exposure_lookthrough.png)

Do not average R-squared, the measure of how tightly a stock tracks its benchmark. Fit is not additive. Three holdings can each track the index loosely while all leaning on one industry; their leftovers then rise and fall together, and you own far less diversification than the ticker count suggests. The same $100,000 book shows it. Loaded with semiconductors — NVDA, AMD, AVGO, SMH, SOXL — its internal correlation ran 0.82. Spread across seven sectors instead, 0.54. One bad week for chips empties the first version and dents the second.

Set the thresholds before anything moves.

- Rebalance a position when its weight drifts more than 3 points from target.
- Rebalance the book when portfolio beta drifts more than 0.2 from target.
- Recompute every beta on the same fresh window, then check a shorter window against it.
- Track weight × beta by position and by sector, never only the total.
- Before trading, price in spreads, taxes and turnover; small drift rarely pays for itself.
- Write down any holding whose payoff is not a straight line.

That last line is mostly about daily-reset leveraged funds. Their stated objective applies to a single day. Over weeks, compounding carries them somewhere other than a fixed multiple of the index, so an ordinary beta assumption does not describe them.

> Track weight times beta by sector, not only the total. The ticker count is not the diversification.

**Limitation:** portfolio beta can sit perfectly still at 1.18 while leverage, concentration and gap risk all deteriorate underneath it. It measures one linear relationship and nothing else. Diversification reduces risk; it cannot promise protection, and correlations tend to converge exactly when you need them apart.

Sources: [NIST Linear Least Squares Regression](https://www.itl.nist.gov/div898/handbook/pmd/section1/pmd141.htm), [Investor.gov Asset Allocation and Diversification](https://www.investor.gov/introduction-investing/getting-started/asset-allocation), [SEC Investor Bulletin on Leveraged and Inverse ETFs](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-alerts/sec).

Educational, not investment advice.
