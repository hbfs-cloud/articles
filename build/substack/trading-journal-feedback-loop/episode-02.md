---
title: "Measure Trades in R and Keep the Distribution Visible"
subtitle: "Expectancy, hit rate, and payoff answer different questions and require costs."
module_id: "trading-journal-feedback-loop"
episode_number: 2
source_path: "series/journal-et-performance/part2-metriques/index.html"
---
*Part 2 of 6 in Turn a Trading Journal Into a Feedback Loop.*

::audience non_sub,free_sub
Each part stands on its own. This is 2 of 6 in Turn a Trading Journal Into a Feedback Loop; earlier parts cover the groundwork but you can start here.
::end

Define one R as the trade's initial planned dollar risk, frozen when the position is opened, and report realized R from net profit or loss. Do not call a target multiple expectancy. A 2R target describes planned payoff geometry; expectancy also requires outcome probabilities, partial exits, gaps, costs, and every loss.

Use explicit formulas:

`realized R = net trade profit or loss / initial planned dollar risk`

`sample mean R = sum of realized R outcomes / number of included trades`

![The average hides the shape](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/r_distribution.png)

For a long stock trade, initial planned dollar risk can begin with entry-to-invalidation distance times shares, then include the method's predeclared treatment of expected transaction costs. Keep that convention stable. If realized losses can exceed the initial amount because of gaps or slippage, preserve values below -1R rather than clipping them.

Take a hypothetical trade of 100 shares filled at $40.00 with initial invalidation at $39.50. Price risk is $50. Suppose the journal's fixed convention adds $4 of estimated round-trip costs, making initial planned risk $54. An exit at $40.75 creates $75 gross profit; after $4 of actual costs, net profit is $71. Realized R is $71 divided by $54, or about 1.31R. The example is arithmetic, not evidence that this setup is profitable.

Now consider four hypothetical net outcomes: +1.3R, -1.0R, +0.4R, and -0.8R. <mark>The hit rate is 50 percent, yet the sample mean is -0.025R per trade.</mark> The average winner is 0.85R and the average losing magnitude is 0.9R. These are descriptions of four observations, not a reliable forward estimate. A different trade or one large gap could materially change them.

For each review, calculate:

1. Net realized R for every eligible signal, with exclusions disclosed.
1. Hit rate and average win and loss, without treating either as sufficient alone.
1. Median, range, and the largest gains and losses to expose skew.
1. Results by predeclared setup version and relevant regime label.
1. Dollar returns and costs alongside R, since R normalization can hide capital usage.

FINRA's return guidance includes changes in value, income, and transaction fees. For a trading journal, that supports the same basic discipline: use net economic outcomes and compare like with like. Do not annualize a short run of R outcomes or compare it mechanically with a long-term investment benchmark.

**Limitation:** sample mean R is a historical estimate, not mathematical expected value known in advance. Trades may not be independent, risk definitions may drift, and setup selection can bias the sample. Confidence requires more than a positive average; inspect stability, missing observations, and dependence on a few winners.

Sources: [FINRA: Evaluating Performance](https://www.finra.org/investors/investing/investing-basics/evaluating-performance); [FINRA: Calculating Your Investment Returns](https://www.finra.org/investors/insights/investment-returns); [Investor.gov: Understanding Fees](https://www.investor.gov/introduction-investing/getting-started/understanding-fees)

Educational, not investment advice.
