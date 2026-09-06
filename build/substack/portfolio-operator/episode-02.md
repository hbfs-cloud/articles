---
title: "Separate Backtests From Forward Evidence"
subtitle: "Freeze the method before new observations and measure live execution independently."
module_id: "portfolio-operator"
episode_number: 2
source_path: "series/piloter-son-portefeuille/part2-backtest-forward/index.html"
---
*Part 2 of 6 in Operate a Portfolio, Not a Collection of Trades.*

A backtest is a hypothesis wearing the clothes of a track record. The date you froze the rules decides which results count as evidence and which are just description.

Keep three boxes and never let them touch. In-sample is where you tuned the thresholds and filters. Out-of-sample is history you locked away and look at exactly once. The forward log begins at the timestamp after the final rule version exists. The moment an out-of-sample result changes your method, that period joins in-sample for every claim you make afterwards.

![Drawdown measures the path, not the destination](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/drawdown_path.png)

Here is the trap that voids the whole exercise. Out-of-sample only protects you if you look once. Re-optimise and re-test enough parameter sets and window splits and one of them passes by luck alone. Walk-forward analysis — optimise on a window, validate on the next unseen one, step forward, repeat — is stronger, but each re-tested window burns a cartridge too. Decide the protocol and the thresholds before you look at anything.

Count your degrees of freedom honestly. Eight tuned parameters against 40 trades is five trades per parameter. At that ratio the curve is describing your sample, not the market.

Then set the promotion rules in cold blood, in writing, before any live result exists. A workable frame: at least 20 to 30 live trades before performance gets read at all; live profit factor no worse than 0.7 times the backtest figure; live drawdown inside the backtest envelope plus a stated margin; hit rate inside the backtest's confidence interval; realised slippage within the cost budget. Profit factor is money won divided by money lost — 1.5 means $1.50 earned per dollar lost. If the backtest showed 1.6, the live floor is about 1.12.

One broken criterion is a no-go. Not an average. A strong profit factor buys no forgiveness for a drawdown outside the envelope, and reading the results first, then adjusting the threshold, is how confirmation bias wins every time.

Never judge a strategy by one flat average across the whole history either. Split it by regime — calm, uncertain, stressed — using something as plain as the volatility index below 15, between 15 and 20, and above 20. A full-period average blends a strategy that prints in calm markets with one that gets cut apart in stressed ones, then hands you a single reassuring number. What ends portfolios is not the average. It is the worst regime at the worst moment. Demand survival in the stressed bucket — profit factor near 0.9, drawdown contained — even when all the profit comes from calm ones.

Evidence check:

- Label development, held-out, paper-forward and live-forward periods separately.
- Timestamp every strategy version and every data-processing change.
- Keep rejected, partial, cancelled and skipped orders in the record.
- Reconcile live fills and costs against broker statements, not charts.
- Review performance regime by regime before reading the overall number.
- Reset the forward label the moment a rule materially changes.

Budget the decay before you deploy. Between real costs and the optimisation that survives every precaution, an edge commonly gives back 20-40% moving from backtest to live. Take your backtest edge, cut 30%, then look at what remains. If the strategy is only profitable without that haircut, it is not profitable.

**Limitation:** a clean forward test can still be too short, too narrow, or drawn from a single market climate. Paper trading omits financial fear and models queue position badly. Live evidence at tiny size says nothing about capacity. Forward testing removes some hindsight; it does not make the next observation independent.

Sources: [CFTC: Commodity Trading Systems Sold on the Internet](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/fraudadv_tradingsystem.html); [Investor.gov: Executing an Order](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/executing-order); [Investor.gov: Understanding Fees](https://www.investor.gov/introduction-investing/getting-started/understanding-fees)

Educational, not investment advice.
