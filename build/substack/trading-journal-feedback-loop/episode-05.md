---
title: "Test Suspected Trading Biases Against Your Records"
subtitle: "Define observable behavior before changing a rule, and treat small samples as hypotheses."
module_id: "trading-journal-feedback-loop"
episode_number: 5
source_path: "series/journal-et-performance/part5-corriger-biais/index.html"
---
*Part 5 of 6 in Turn a Trading Journal Into a Feedback Loop.*

Asking yourself mid-session whether you are revenge trading is like asking an angry person whether they are calm. The bias bends the exact faculty that would catch it. The only way out is external: timestamps and sizes you wrote down before you had a story to protect.

So turn the suspicion into a behavior you can count, and define it before you look at the money. Say you suspect that losses trigger unplanned follow-up trades. Define the event: a new order submitted within a stated interval after a losing exit, with no plan record created before the first trade opened. Log prior-trade outcome, elapsed time, setup version, planned-before-entry yes or no, rule adherence, market condition, net realized R. The definition catches profitable follow-ups too — one that only flags losers can be bent into any story you like.

![The average hides the shape](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/r_distribution.png)

Averages hide the thing you are hunting. Take a trader at +0.12 R per trade overall. Segment it and you may find one setup at +0.42 R over 64 trades funding two others at −0.28 R over 47 and −0.19 R over 58. The average looks survivable. What you actually own is one good strategy paying for two destructive ones.

Compare flagged trades against the right group — same setup version, same period, planned on time. Report counts, missing records, net outcomes, costs, adherence. If the flagged trades look worse, that is an association inside your own journal. It does not prove the earlier loss caused the next decision. Volatility, time of day, or a shifting market can carry part of it.

Sample size decides whether you are allowed an opinion. A setup at −0.35 R over 9 trades is not a verdict; it is noise wearing a number. Below roughly 30 observations, call it a hypothesis and keep collecting. Cutting a sound setup after five straight losses is normal for anything that wins 45% of the time.

Test a procedure rather than announcing a cure. Require every new order after a closed trade to reference a plan timestamp that predates the first position. Run it for a fixed window. Record blocked signals as well as accepted ones. The question becomes precise: did unplanned orders fall, and what happened to execution, opportunity set, and net result?

Run this audit:

- Define the behavior without using profit or loss to classify it.
- Freeze the definition before you calculate anything.
- Include compliant trades, violations, skipped signals, and missing data.
- Compare like setup versions and like conditions.
- Limit subgroup tests, or disclose every one you ran.
- Treat the finding as provisional until it repeats out of sample.

Trade frequency works the same way. A high count is not automatically overtrading; it is a plan violation only against a predeclared process. But the arithmetic is unforgiving. Take a worked example: the first three trades of the day average +0.30 R, everything past the third averages −0.25 R, and you take two extra trades a day across 200 trading days. That is 2 × 200 × (−0.25) = −100 R a year. At 1% of capital risked per R, a year of good trades erased by volume alone. Costs stack on top: Investor.gov notes transaction fees reduce portfolio value, and execution differences create costs beyond the commission line.

Before cutting a losing setup, ask which one it is — the setup, or you. A negative expectancy can mean a bad idea, or a good idea entered late with a stop in the wrong place.

**Limitation:** a self-kept journal is not a controlled experiment. Labels are subjective, one control changes several decisions, and recording behavior changes it. Small or selective samples reverse relationships. Use the result to design a narrower test, not to assert cause.

Sources: [Investor.gov: Understanding Fees](https://www.investor.gov/introduction-investing/getting-started/understanding-fees); [Investor.gov: Executing an Order](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/executing-order); [FINRA: Evaluating Performance](https://www.finra.org/investors/investing/investing-basics/evaluating-performance)

Educational, not investment advice.
