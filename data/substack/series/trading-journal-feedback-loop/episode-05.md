---
title: "Test Suspected Trading Biases Against Your Records"
subtitle: "Define observable behavior before changing a rule, and treat small samples as hypotheses."
module_id: "trading-journal-feedback-loop"
episode_number: 5
source_path: "series/journal-et-performance/part5-corriger-biais/index.html"
---

*Part 5 of 6 in Turn a Trading Journal Into a Feedback Loop.*

Translate a suspected bias into an observable, timestamped behavior before testing it. Labels such as revenge trading, overconfidence, or fear are not measurements and do not establish why a decision occurred. Define the action, comparison group, outcome, and review window first; otherwise the journal can be mined for any story that fits recent losses.

Suppose a trader suspects that losses prompt unplanned follow-up trades. Before reviewing returns, define a candidate event as: a new order submitted within a stated interval after a losing exit, with no qualifying plan record created before the first trade opened. Add fields for prior-trade outcome, elapsed time, setup version, planned-before-entry status, rule adherence, market condition, and net realized R. The definition should classify profitable and losing follow-ups alike.

Next, compare the flagged trades with an appropriate group, such as other trades from the same setup version and period that were planned on time. Report counts, missing records, net outcomes, costs, and adherence. If flagged trades look worse, that is association within this journal. It does not prove the prior loss caused the next decision or that a cooling-off rule will improve future returns. Volatility, time of day, clustered signals, or a changing market could explain part of the difference.

Test a procedural response rather than claiming a cure. For example, require every new order after a closed trade to reference a plan timestamp that predates the first position. Apply the control for a fixed review window and record blocked as well as accepted signals. The outcome question is then precise: did the control reduce unplanned orders, and what happened to execution, opportunity set, and net results?

Run this bias audit:

- Define behavior without using profit or loss to classify it.
- Freeze the definition before calculating outcomes.
- Include compliant trades, violations, skipped signals, and missing data.
- Compare like setup versions and relevant conditions.
- Limit the number of subgroup tests or disclose all of them.
- Treat the finding as provisional until it repeats out of sample.

The same method applies to trade frequency. A high number of trades is not automatically overtrading. It becomes a plan violation only relative to a predeclared opportunity and risk process. Costs still matter: Investor.gov notes that transaction fees reduce portfolio value, and execution differences can create costs beyond a simple commission line.

**Limitation:** a self-kept journal is not a controlled experiment. Behavior labels can be subjective, controls can alter several decisions at once, and the act of recording may itself change conduct. Small or selectively retained samples can reverse apparent relationships. Use the result to design a narrower test, not to diagnose personality or assert causation.

Sources: [Investor.gov: Understanding Fees](https://www.investor.gov/introduction-investing/getting-started/understanding-fees); [Investor.gov: Executing an Order](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/executing-order); [FINRA: Evaluating Performance](https://www.finra.org/investors/investing/investing-basics/evaluating-performance)

Educational, not investment advice.
