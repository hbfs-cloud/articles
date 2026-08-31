---
title: "Use Portfolio Beta as One Risk Lens"
subtitle: "Aggregate exposures consistently and monitor the factors left behind"
module_id: "high-beta-proxies"
episode_number: 6
source_path: "series/proxys-haut-beta/part6-portefeuille-beta/index.html"
---

*Part 6 of 6 in Use High-Beta Proxies Without Getting Trapped.*

Use portfolio beta as a monitoring estimate, not as a complete description of risk. The weighted sum of position betas is meaningful only when every beta uses the same reference, return frequency, estimation window, currency treatment, and overlapping-date policy. Even then, it describes one linear factor. It does not capture the portfolio's residual concentration, nonlinear products, gaps, or liquidity.

For weights `w_i` and consistently estimated betas `beta_i`, the first-order portfolio estimate is `beta_P = sum(w_i * beta_i)`. Each term `w_i * beta_i` is that position's contribution to reference exposure. Negative weights for shorts must retain their sign. Cash normally has near-zero direct beta to an equity reference, but currency and funding choices can still matter.

**Worked portfolio calculation.** Consider a hypothetical fully invested portfolio with 50% in an asset estimated at beta 1.0, 30% at beta 1.8, and 20% at beta 0.4. The weighted estimate is 0.50 x 1.0 + 0.30 x 1.8 + 0.20 x 0.4 = 1.12. Under the fitted linear model, a +1% reference return maps to roughly +1.12% from common-factor exposure before intercepts and residuals. It is not a promised portfolio return.

Do not average position R-squared values. Portfolio fit depends on weights, covariances, and how residuals interact. Three securities can each have moderate fit to the reference while sharing the same omitted industry factor. Their residuals may rise and fall together, producing far less diversification than ticker count suggests. Measure the residual covariance matrix or, at minimum, inspect pairwise residual correlations and grouped economic exposures.

Set monitoring rules before the portfolio moves. Recompute all betas on the same fresh sample, compare a shorter rolling window with the baseline, and flag changes in overlap or data quality. Track beta contribution by position and by economic group. Rebalance when a documented threshold is crossed, not merely because an estimate changed by a trivial amount. Include turnover, spreads, taxes, and product mechanics in the decision.

Daily-reset leveraged ETFs need separate treatment. Their objectives apply daily, so multi-day compounding can make their path diverge from a simple multiple of the benchmark's cumulative return. Do not replace their stated mechanics with an ordinary equity beta assumption.

**Portfolio beta review**

- Estimate every beta against one defined reference and common policy.
- Attribute `w_i * beta_i` by position and economic group.
- Inspect residual correlations and concentration.
- Stress factor, residual, gap, and liquidity risks together.
- Rebalance only under a written threshold and cost check.
- Document any product whose payoff is nonlinear or path-dependent.

**Limitation:** A one-factor portfolio beta can look stable while the underlying holdings, leverage, or residual exposures change. Diversification can reduce risk but cannot guarantee protection, especially when correlations rise during stress.

Sources: [NIST Linear Least Squares Regression](https://www.itl.nist.gov/div898/handbook/pmd/section1/pmd141.htm), [Investor.gov Asset Allocation and Diversification](https://www.investor.gov/introduction-investing/getting-started/asset-allocation), [SEC Investor Bulletin on Leveraged and Inverse ETFs](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-alerts/sec).

Educational, not investment advice.
