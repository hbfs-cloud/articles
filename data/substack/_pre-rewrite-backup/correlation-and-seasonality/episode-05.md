---
title: "Define the Failure Rule Up Front"
subtitle: "Pairs and seasonal strategies need frozen definitions, execution costs, and structural exits."
module_id: "correlation-and-seasonality"
episode_number: 5
source_path: "series/correlations-saisonnalites/part5-strategies/index.html"
---

*Part 5 of 6 in Correlation and Seasonality Without Storytelling.*

Reject any correlation or seasonal strategy that lacks a prewritten failure rule. Before testing, freeze the relationship, entry, size, costs, normal exit, time exit, and structural-break exit. A persuasive backtest is not enough. The strategy must remain coherent when the spread does not converge, the calendar effect misses, borrow disappears, or correlations change sign.

For a pairs idea, correlation is only the first screen. Two assets can have highly correlated returns while their price spread drifts indefinitely. Define how the hedge ratio is estimated, what spread is traded, how it is standardized, and when the estimate may be recalibrated. Fit those choices on a training sample, evaluate them on a separate validation sample, and use a final holdout only once.

Seasonal rotation needs the same discipline. Freeze the eligible assets, calendar buckets, rebalance session, total-return treatment, turnover, taxes, spread, and slippage. Do not select the best sector for each month using the full history and then describe the result as a standing rule. That procedure embeds hindsight.

Portfolio overlays based on covariance or risk contribution also need a stress case. A low-volatility asset can receive a large weight just before its volatility or correlation rises. Cap notional exposure, leverage, concentration, and liquidity separately from the optimizer’s output.

**Worked micro-example:** Two hypothetical companies in one industry pass a return-correlation screen. The researcher estimates a hedge ratio and standardized spread only on the training period. Entry requires the preselected spread threshold and confirmed borrow. Normal exit occurs at the predefined convergence level; a loss exit limits spread expansion; a time exit closes a stagnant trade. A merger filing, spin-off, accounting restatement, or unavailable borrow triggers the structural exit because the original relationship may no longer be comparable. If the validation sample loses money after executable costs, the trade is rejected rather than retuned.

**Strategy failure rules**

- Freeze universe, formula, windows, thresholds, and costs.
- Separate training, validation, and final holdout data.
- Define loss, convergence, time, and structural exits.
- Stress leverage, borrow, concentration, and liquidity.
- Preserve rejected tests in the research log.

Historical simulation cannot reproduce actual fills, market impact, margin pressure, or the difficulty of following a losing strategy. Repeated tuning also makes the holdout part of the training process. A strategy that survives research can still fail live; initial size should reflect that model risk.

Sources: [NIST: Correlation](https://www.itl.nist.gov/div898/software/dataplot/refman2/auxillar/correlat.htm), [CFTC: Limitations of Hypothetical Trading Systems](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/fraudadv_tradingsystem.html), [Investor.gov: Using EDGAR to Research Investments](https://www.investor.gov/introduction-investing/getting-started/researching-investments/using-edgar-research-investments), [FINRA: Concentration Risk](https://www.finra.org/investors/insights/concentration-risk).

Educational, not investment advice.
