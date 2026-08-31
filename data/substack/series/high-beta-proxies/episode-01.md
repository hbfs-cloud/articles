---
title: "Estimate Beta With Its Full Sample"
subtitle: "Measure sensitivity without turning a regression into a promise"
module_id: "high-beta-proxies"
episode_number: 1
source_path: "series/proxys-haut-beta/part1-comprendre-beta/index.html"
---

*Part 1 of 6 in Use High-Beta Proxies Without Getting Trapped.*

Before calling anything a high-beta proxy, write down the reference asset, return frequency, sample window, and number of overlapping observations. If any one is missing, the beta is not decision-grade. A beta of 1.6 does not mean the proxy will move 1.6 times as much tomorrow. It is the slope estimated from a particular historical sample.

For reference returns `x_t` and proxy returns `y_t`, a simple model is:

`y_t = alpha + beta * x_t + epsilon_t`

With an intercept, the ordinary least-squares slope is `beta = Cov(y,x) / Var(x)`. It can also be written as correlation multiplied by the ratio of the two return volatilities: `beta = rho_xy * (sigma_y / sigma_x)`. This distinction matters. A proxy can show a large beta because it is extremely volatile even when its correlation with the reference is mediocre.

Alpha is the fitted intercept for that sample. It is not proof of trading skill. The residual `epsilon_t` is whatever the one-factor model did not explain: company news, another common factor, market microstructure, nonlinear behavior, or noise.

**Worked reading.** Suppose a hypothetical regression uses 120 shared daily observations and reports alpha of 0.10%, beta of 1.6, and R-squared of 0.49. For a reference return of +1%, the fitted proxy return is +1.70%: 0.10% + 1.6 x 1%. That is a conditional model estimate, not a target. An R-squared of 0.49 says the fitted line accounted for 49% of the proxy's in-sample return variance. It does not mean a 49% probability of success, and it establishes no causal link.

In simple one-predictor regression with an intercept, R-squared equals the squared Pearson correlation. Here, the correlation magnitude would be 0.70, with a positive sign because beta is positive. That identity does not automatically carry over to regressions with multiple factors, omitted intercepts, weights, or different samples.

**Beta report**

- Align both return series to exactly the same timestamps.
- Use the same currency, frequency, and return convention.
- Report beta, correlation, R-squared, alpha, and overlapping count together.
- Inspect rolling estimates and residuals, not only the full-sample result.
- Reject a calculation contaminated by stale prices or unmatched sessions.

**Limitation:** Linear beta is sample-dependent and sensitive to outliers. A relationship measured in quiet trading can change during earnings, financing stress, market closures, or a volatility shock. Confidence intervals and out-of-sample checks can reveal uncertainty; they cannot make the coefficient stable.

Sources: [NIST Linear Least Squares Regression](https://www.itl.nist.gov/div898/handbook/pmd/section1/pmd141.htm), [NIST Correlation Reference](https://www.itl.nist.gov/div898/software/dataplot/refman2/ch2/correlat.pdf).

Educational, not investment advice.
