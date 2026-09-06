---
title: "Stress-Loss Sizing for High-Beta Proxies"
subtitle: "Combine factor stress, residual risk, gaps, and execution limits"
module_id: "high-beta-proxies"
episode_number: 5
source_path: "series/proxys-haut-beta/part5-gestion-risque/index.html"
---

*Part 5 of 6 in Use High-Beta Proxies Without Getting Trapped.*

Set position size from a loss scenario that includes both common-factor and residual risk. Beta is an average fitted sensitivity, not a worst-case loss estimate. A high-beta position can gap through a stop, decouple from its reference, or become illiquid precisely when the historical relationship looks most useful.

Start with the model `r_p = alpha + beta * r_b + epsilon`. For risk sizing, do not substitute the average residual of zero. Choose a reference shock and an adverse residual shock that are appropriate to the instrument and horizon, then add execution slippage and known event risk. The shocks should come from documented history or an explicit stress policy, not from whichever assumptions permit the largest position.

**Sizing stress**

- Define reference, residual, gap, and slippage stresses.
- Calculate scenario loss in dollars before the order.
- Compare scenario, stop, liquidity, and concentration caps.
- Reduce or exclude positions with unmodeled binary events.
- Re-estimate relationships only on fresh, overlapping data.
- Record actual fills and revise execution assumptions.

**Worked sizing example.** Suppose a hypothetical proxy has an estimated beta of 1.7. The risk policy applies a -6% reference shock and a separate -8% adverse residual shock. Ignoring the small intercept, the modeled factor move is 1.7 x -6% = -10.2%. Adding the residual stress gives -18.2%. If the maximum planned loss is $500, the scenario-limited notional is $500 / 0.182 = $2,747.25. Rounding down to $2,700 leaves a small buffer. This is a scenario calculation, not a forecast or a guarantee that the loss will stop there.

Compare that result with three other caps: loss at the technical invalidation level, maximum portfolio concentration, and the notional that can reasonably be exited in the available liquidity. Use the smallest. If earnings, a regulatory decision, financing, or another binary event falls inside the holding period, either model a separate gap scenario or exclude the trade.

A stop is an execution instruction, not insurance. Once triggered, a stop order becomes a market order and may fill far from the stop price. A stop-limit order controls price but can remain unfilled. Hedges also have basis risk: correlation and beta can change, while the proxy's residual moves independently.

**Limitation:** Stress scenarios are selected models, not boundaries on reality. Historical samples may omit the next tail event, and residuals can become correlated across several positions during broad deleveraging. Portfolio-level stress must therefore supplement single-position sizing.

Sources: [SEC Investor Bulletin on Stop Orders](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-15), [FINRA Risk Overview](https://www.finra.org/investors/investing/investing-basics/risk), [NIST Linear Least Squares Regression](https://www.itl.nist.gov/div898/handbook/pmd/section1/pmd141.htm).

Educational, not investment advice.
