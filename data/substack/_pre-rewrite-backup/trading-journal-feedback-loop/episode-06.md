---
title: "Build a Dashboard That Leads to One Controlled Change"
subtitle: "Connect plan adherence, outcomes, and the next test without hiding uncertainty."
module_id: "trading-journal-feedback-loop"
episode_number: 6
source_path: "series/journal-et-performance/part6-dashboard/index.html"
---

*Part 6 of 6 in Turn a Trading Journal Into a Feedback Loop.*

Build the dashboard backward from one decision: continue the current plan, pause it, or test one specified change. Every displayed metric must have a stable definition, source field, inclusion rule, and review horizon. A crowded screen is not a feedback loop if it cannot show which observation supports which action.

Use two linked data layers. The **trade ledger** keeps one row per completed trade or other stable unit, with plan version, timestamps, fills, size, initial risk, costs, net outcome, adherence, and setup labels. The **review summary** calculates metrics from that ledger without manual overrides. Preserve skipped eligible signals separately so the dashboard does not silently become a winners-and-losers-only sample.

A compact summary can include:

- Number of eligible signals, taken trades, skips, and missing records.
- Net dollar result and realized R distribution after known costs.
- Hit rate, average win, average loss, median R, and extreme outcomes.
- Drawdown under a stated equity and cash-flow convention.
- Plan-adherence rate and counts by violation type.
- Exposure and concentration measures relevant to the strategy.
- Comparable benchmark return where the comparison is meaningful.

Do not merge process and performance into one score. A profitable violation can raise returns while weakening control. A compliant loss can lower returns without proving the rule was faulty. Show both dimensions and retain the underlying rows.

For a concrete procedure, suppose the summary flags a recurring difference between intended and actual entry prices. Open the affected ledger rows, verify that the difference comes from broker fills rather than copied chart prices, and segment by order type using definitions fixed before reviewing outcomes. If one execution process appears problematic, write one prospective change, its start date, eligible trades, expected mechanism, cost measure, and stop condition. Keep the strategy signal unchanged during that test. The next review compares the new process with the predeclared baseline and includes failed and unfilled orders.

FINRA advises including transaction fees when evaluating return and using compatible time periods for comparisons. It also notes that an appropriate benchmark should reflect the investment being assessed. For a dashboard, this means displaying net results and documenting why a reference is comparable. It does not mean that short samples should be annualized or that benchmark outperformance establishes skill.

Check the dashboard before using it:

- Reconcile source rows to broker records.
- Lock formulas and version metric definitions.
- Surface exclusions, missing values, and sample counts.
- Trace each chartless summary value to underlying trades.
- Authorize only a prewritten, measurable next action.

**Limitation:** a dashboard summarizes the data supplied to it. It cannot repair selection bias, stale definitions, incorrect timestamps, or a strategy that changed repeatedly. Attractive averages may depend on one outlier or one regime. Treat the display as an audit interface, not evidence of future profitability.

Sources: [FINRA: Evaluating Performance](https://www.finra.org/investors/investing/investing-basics/evaluating-performance); [FINRA: A Look at Benchmarks](https://www.finra.org/investors/insights/get-bench-look-benchmarks); [Investor.gov: Understanding Fees](https://www.investor.gov/introduction-investing/getting-started/understanding-fees)

Educational, not investment advice.
