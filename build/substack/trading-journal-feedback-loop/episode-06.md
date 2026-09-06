---
title: "Build a Dashboard That Leads to One Controlled Change"
subtitle: "Connect plan adherence, outcomes, and the next test without hiding uncertainty."
module_id: "trading-journal-feedback-loop"
episode_number: 6
source_path: "series/journal-et-performance/part6-dashboard/index.html"
---
*Part 6 of 6 in Turn a Trading Journal Into a Feedback Loop.*

::audience non_sub,free_sub
Each part stands on its own. This is 6 of 6 in Turn a Trading Journal Into a Feedback Loop; earlier parts cover the groundwork but you can start here.
::end

Build the screen backwards. <mark>It is allowed to produce three answers and no others: keep the plan, pause it, or run one written test.</mark> Anything on the page that cannot push you toward one of those three is decoration, and decoration is why nobody looks at their own dashboard after week three.

Two sheets. The first holds one row per closed trade: date, plan version, entry, stop, size, fees, result, and a plain yes or no on whether you followed your own rules. The second computes everything from the first. You never type a number into the second sheet. Every hand-copied figure is a wrong figure waiting for its turn.

![A fact is not a decision, and a decision is not an order](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/decision_flow.png)

Keep results in R. One R is the money you had at risk the moment you opened the trade. Risk 100, make 250, that is +2.5R. Risk 100, lose it, that is −1R. Counting this way strips out position size, so a good week traded small and a good week traded big finally look alike.

Seven numbers are enough: rule-following rate, expectancy, payoff, cumulative R, worst drawdown, expectancy per setup, and how many trades you actually have.

Expectancy is the average R per trade. Take a sample with 45% winners, average win +2.2R, average loss −0.9R. Then (0.45 × 2.2) − (0.55 × 0.9) = 0.99 − 0.495, so +0.495R a trade. Two hundred trades at that pace is roughly +99R before you convert anything into money. Payoff, winners divided by losers, is 2.2 / 0.9, about 2.4. Break-even for a payoff of 2.4 sits at 1 / (1 + 2.4), near 29.4%. So 45% is comfortably clear of the line. Read the win rate on its own and you would have learned none of that.

![A 45% win rate against a break-even of 29.4%](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/examples/trading-journal-feedback-loop_episode-06.png)

Keep behaviour and profit in separate columns. A rule you broke that happened to pay is still a broken rule. A rule you kept that lost money may be perfectly sound.

Say the summary shows your fills landing worse than the prices you wrote down. Open the rows. Compare against broker confirmations, not against the chart you screenshotted. Split by order type, using labels you fixed before you looked at any result. If one route looks bad, write exactly one change: start date, which trades it covers, what it should improve, how you will measure the cost, and the result that makes you stop. The entry signal stays frozen while that test runs.

FINRA asks you to subtract fees before judging a return, and to compare periods that actually match. A benchmark has to resemble what you hold. So publish results after costs, and write one line explaining why the comparison is fair.

Check the sheet before you trust it:

1. Reconcile rows against broker statements.
1. Lock the formulas and date every definition change.
1. Show exclusions, blanks, and sample size beside each number.
1. Trace any summary figure back to the trades under it.
1. Approve one change, written in advance, with a stop condition.

Limitation: the sheet only knows what you fed it. It cannot repair trades you forgot to log, wrong timestamps, or a plan you quietly rewrote three times. A handsome average can rest on one outlier. Five to seven losses in a row are ordinary at a 45% win rate, so thirty trades is still thin; fifty to a hundred start to mean something. And a 14R drawdown sitting in your history is a real question: could you sit through fourteen full losses without touching anything?

> A number you cannot trace back to a trade is decoration.

Sources: [FINRA: Evaluating Performance](https://www.finra.org/investors/investing/investing-basics/evaluating-performance); [FINRA: A Look at Benchmarks](https://www.finra.org/investors/insights/get-bench-look-benchmarks); [Investor.gov: Understanding Fees](https://www.investor.gov/introduction-investing/getting-started/understanding-fees)

Educational, not investment advice.
