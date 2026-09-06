---
title: "Build and Stress a Beta Hedge"
subtitle: "Size the common-factor leg and keep the residual risk visible"
module_id: "high-beta-proxies"
episode_number: 3
source_path: "series/proxys-haut-beta/part3-strategies-trading/index.html"
---

*Part 3 of 6 in Use High-Beta Proxies Without Getting Trapped.*

Treat a proxy-versus-reference trade as a temporary factor hedge, never as a machine that extracts pure alpha. The hedge ratio comes from an estimated relationship, while the remaining position still carries residual, financing, execution, and model risk. If the regression fit is weak or unstable, a mathematically neat hedge can be economically poor.

Suppose proxy returns follow `r_p = alpha + beta * r_b + epsilon`, where `r_b` is the reference return. For a long proxy position worth `P`, the first-order reference exposure is approximately `P * beta`. A beta-neutral construction shorts that amount of the reference, subject to contract multipliers and currency conversion. This cancels the fitted linear exposure at inception. It does not cancel `epsilon`, guarantee convergence, or prove that alpha will persist.

**Worked hedge.** A hypothetical trader holds $10,000 of a proxy whose estimated beta is 1.5, using 150 overlapping daily observations. The initial beta-dollar exposure is $15,000, so a $15,000 short in the reference would make the modeled common-factor exposure approximately zero. If the relevant beta later rises to 2.0, the long leg carries $20,000 of beta-dollar exposure while the short remains $15,000. The trade is now net long $5,000 of reference-equivalent exposure. A +2% reference-only shock maps to about +$100 from that mismatch before residual returns, costs, and slippage.

R-squared reports the share of in-sample proxy-return variation explained by the fitted model. A high beta with low R-squared means a large slope coexists with substantial unexplained movement. It is not a confidence interval for beta or proof of out-of-sample hedge reliability. Inspect coefficient uncertainty, residuals, rolling stability, and a forward sample separately. None of those statistics captures a sudden company filing, earnings surprise, takeover rumor, borrow recall, or trading halt.

Operationally, define the trade before entry: the estimation window, re-estimation schedule, maximum hedge-ratio drift, residual-loss limit, and event exclusions. Keep both legs' order types and trading hours compatible. Record dividends, borrow charges, funding costs, and any contract roll. A spread that looks flat before costs can still lose money after them.

**Hedge check**

- Use matched observations and disclose the sample size.
- Require acceptable correlation, R-squared, and residual behavior.
- Convert beta into beta-dollar exposure for both legs.
- Set a rule for recalculation and hedge-ratio drift.
- Reconcile borrow, dividends, fees, and fills.
- Exit or resize when the relationship leaves its tested range.

**Limitation:** Shorting introduces asymmetric risk. The short leg requires a margin account and borrowed shares may become costly or unavailable. Even a well-estimated hedge can fail during a company-specific gap because the residual, not the reference factor, drives the move.

Sources: [NIST Linear Least Squares Regression](https://www.itl.nist.gov/div898/handbook/pmd/section1/pmd141.htm), [FINRA Short Interest and Short-Sale Mechanics](https://www.finra.org/investors/insights/short-interest).

Educational, not investment advice.
