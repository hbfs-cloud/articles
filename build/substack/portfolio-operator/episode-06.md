---
title: "A Clean Retirement Test for a Strategy"
subtitle: "Predeclared shutdown rules preserve capital and the evidence needed for review."
module_id: "portfolio-operator"
episode_number: 6
source_path: "series/piloter-son-portefeuille/part6-arreter/index.html"
---
*Part 6 of 6 in Operate a Portfolio, Not a Collection of Trades.*

::audience non_sub,free_sub
Each part stands on its own. This is 6 of 6 in Operate a Portfolio, Not a Collection of Trades; earlier parts cover the groundwork but you can start here.
::end

The day to write your shutdown rules is the day you start, while nothing hurts. In the middle of a losing run your brain swings between denial and surrender, and neither one is a decision.

Start by separating three things that people call "stopping."

An emergency stop is for danger: stolen login, orders firing on their own, corrupted prices, a margin call. You close at market and ask questions afterwards.

An orderly stop is the default. New entries end immediately. Existing positions keep running under the exits already written, close at their planned prices, and only then do you switch the strategy off for good. Nothing gets dumped, so you never pay the panic premium.

![The average hides the shape](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/r_distribution.png)

A retirement is a research verdict, and it needs evidence, not exhaustion.

That last one is where retail investors make their biggest statistical mistake: killing a strategy on a handful of trades. With a real but modest edge, losing runs of six, eight, even twelve trades happen by pure chance. <mark>Ten trades tells you about luck, not about the method.</mark>

A readable threshold: do not even consider "the edge is gone" before roughly thirty live trades, and then only if the profit factor stays below the line. Profit factor is simply gross winnings divided by gross losses, so 1.0 means you broke even. Judge it on a rolling window, not on one snapshot, and treat a sustained reading under 1.0 — or under about seventy percent of what the backtest promised, say 1.5 falling to 0.8 — as the signal. Below that sample size, the correct move is to cut size, not to cut the strategy.

There is a cleaner test for the difference between cutting and quitting. If you held nothing today and discovered this strategy with its current live numbers, would you start it? Yes means you are in a normal drawdown, so hold. No, because the edge has genuinely gone, means you stop.

Sequence matters when you do stop:

1. Block new exposure first, then list every working order sitting at the broker.
1. Reconcile positions, fills, financing and cash movements against broker records before analysing anything.
1. Run emergency exits and orderly exits under separate written rules.
1. Freeze the data, the parameters, the costs and the exception log.
1. Compare the result against the original mandate, then state plainly: pause, revision, or retirement.

Forced selling is the expensive path, and it is worth pricing before choosing it. Dumping everything at once crosses the spread the wrong way and moves the book on your least liquid lines, often when liquidity has already thinned. As a teaching order of magnitude, an unwind spread over days might cost a few basis points per line while a panic exit costs five to eight times that on illiquid names. So compare the two numbers directly. If waiting risks another 8% of loss and forcing the exit costs about 1.5% in extra slippage, force it. Reverse the sizes and unwind calmly instead.

Afterwards, write the post-mortem on the information available at the time, not on what you now know. Keep the record append-only: losses included, bad sequences included. A track record that quietly edits out its worst weeks teaches nothing. FINRA's guidance on evaluating performance makes the same point about honest accounting — include transaction fees, compare like periods.

> Stop on evidence you wrote down in advance, and keep the record append-only — the weeks you would rather delete are the ones that teach.

**Limitation:** a shutdown rule can fire right before a recovery, and waiting for statistical certainty can outlast your actual capital. Emergency selling produces bad fills; patient selling holds risk longer. Perfect timing is not the goal. An inspectable decision is.

Sources: [FINRA: Evaluating Performance](https://www.finra.org/investors/investing/investing-basics/evaluating-performance); [FINRA: Risk](https://www.finra.org/investors/investing/investing-basics/risk); [Investor.gov: Executing an Order](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/executing-order)

Educational, not investment advice.
