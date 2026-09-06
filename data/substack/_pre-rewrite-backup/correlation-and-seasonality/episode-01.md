---
title: "Measure Correlation on the Right Sample"
subtitle: "Use matched returns and rolling windows before treating two assets as linked."
module_id: "correlation-and-seasonality"
episode_number: 1
source_path: "series/correlations-saisonnalites/part1-les-correlations/index.html"
---

*Part 1 of 6 in Correlation and Seasonality Without Storytelling.*

A static correlation should never decide a trade, hedge, or diversification claim. Calculate correlation on matched returns, use a window that fits the intended holding period, and record how the estimate changes through time. If the relationship is unstable or depends on a few observations, treat it as unavailable. Correlation describes measured co-movement in a sample; it does not identify a mechanism or predict the next return.

Pearson correlation runs from negative one to positive one and measures linear association. Positive values mean above-average observations in one series tended to align with above-average observations in the other; negative values indicate the opposite alignment. A value near zero means little linear association in that sample, not independence.

Start with data hygiene. Use returns rather than raw price levels, because two rising price series can look related simply because both trend. Choose simple or logarithmic returns and stay consistent. Include dividends and other cash distributions when comparing investable performance, align observations to the same sessions, and avoid silently carrying a stale price across a closed market. Currency conversion, different closing times, and missing observations can change the estimate.

Window choice is part of the hypothesis. A shorter rolling window reacts quickly but contains fewer observations. A longer window is more stable but can blend incompatible regimes. Select the window before seeing the answer, then compare it with at least one sensitivity window. Keep the full-sample figure as context, not authority.

**Worked procedure:** Suppose two assets show a positive full-history correlation. Split the sample into consecutive rolling windows and inspect the paired returns behind each estimate. The recent windows alternate between positive, near-zero, and negative readings, while one sharp selloff dominates the full sample. The correct decision is not “the assets are correlated.” Mark the relationship as regime-dependent, deny it diversification credit in the stress test, and require another risk control for any hedge that depends on it.

**Before using the result**

- Define assets, return type, currency, session, and data source.
- Align timestamps and document missing-value treatment.
- Preselect the primary window and sensitivity window.
- Inspect outliers and the paired-return distribution.
- State what decision changes if correlation changes sign.

Pearson correlation can miss nonlinear dependence, asymmetric downside behavior, and common exposure that appears only during stress. Rolling estimates also reuse observations from one window to the next, so adjacent readings are not independent confirmations. A correlation matrix is a diagnostic, never proof of causality or durable diversification.

Sources: [NIST: Correlation](https://www.itl.nist.gov/div898/software/dataplot/refman2/auxillar/correlat.htm), [Federal Reserve: Time-Varying Stock-Bond Correlation](https://www.federalreserve.gov/econres/feds/files/2025002pap.pdf), [NIST: Bootstrap Uncertainty](https://www.itl.nist.gov/div898/handbook/eda/section3/bootplot.htm).

Educational, not investment advice.
