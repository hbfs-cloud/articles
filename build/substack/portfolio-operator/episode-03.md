---
title: "Drawdown Measures the Path Behind You"
subtitle: "Peak-to-trough decline and prospective risk budgets answer different questions."
module_id: "portfolio-operator"
episode_number: 3
source_path: "series/piloter-son-portefeuille/part3-drawdown/index.html"
---
*Part 3 of 6 in Operate a Portfolio, Not a Collection of Trades.*

::audience non_sub,free_sub
Each part stands on its own. This is 3 of 6 in Operate a Portfolio, Not a Collection of Trades; earlier parts cover the groundwork but you can start here.
::end

Drawdown is the distance from your highest recorded equity down to where you sit now. It describes the road behind you. It is not the amount at risk on your next trade.

![Drawdown measures the path, not the destination](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/drawdown_path.png)

It earns the attention because recovery is lopsided. Down 10% needs +11% to get level. Down 25% needs +33%. Down 50% needs +100%. Down 80% needs +400%. The deeper the hole, the steeper the climb out, and past a point a drawdown stops costing money and starts costing years.

![Gain required to return to the previous peak](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/examples/portfolio-operator_episode-03.png)

Fix the accounting first. Does the equity series include open positions, deposits, fees, financing, tax? Priced at what time, from which source? Then the formula is simple:

`drawdown = (current equity - prior peak equity) / prior peak equity`

An account peaks at $50,000 and later closes at $46,000 with no deposits. That is -8%, a $4,000 decline from the recorded high. It says nothing about the next trade, which might be capped at $375 of planned loss by a completely separate rule.

That separate rule is where survival actually lives. Fix the fraction of capital you will lose per trade — 0.5% to 1% is the institutional standard — and let the stop distance decide the share count, never the reverse. On $50,000 at 0.75%, the budget is $375. A stock at $40 with invalidation at $37 risks $3 a share, so you buy 125 shares. The same stock with a stop at $39 risks $1 a share, so 375 shares. Wildly different position sizes, identical loss when you're wrong.

<mark>The fraction matters more than the signal.</mark> At 1% per trade, ten consecutive losses cost about 9.6%; it takes roughly 11 losses in a row to reach -10%. At 5% per trade, the same ten losses cost about 40%, and two of them get you to -10%.

Volatility deserves the same treatment. Two stocks at $40 do not move the same way. Size against average true range, the typical daily swing, so a nervous name gets a smaller position than a calm one for the same dollar risk. With a $375 budget and a stop at 2.5 times ATR: a stock with ATR of $0.80 has a $2.00 stop and takes 187 shares; a stock with ATR of $2.40 has a $6.00 stop and takes 62 shares. Three times smaller, same risk.

Then the blind spot that ruins careful sizing. Ten tickers can be one bet. Hold NVDA, AMD, AVGO, MU and ARM and you own five lines and roughly one wager on the semiconductor cycle. Ten genuinely unrelated positions cut portfolio swings by about a factor of 3.2; ten correlated ones cut nothing at all. Treat anything above 0.6 correlation as one cluster and cap it — two or three positions, no more than 30% of total book risk.

Risk check:

- Freeze the equity, cash-flow and valuation convention in writing.
- Report current and maximum drawdown with their dates.
- Keep per-trade and portfolio loss budgets in separate fields.
- Size against volatility rather than a fixed dollar amount per position.
- Wire each drawdown level to an automatic response before it triggers: review at -4%, half size at -8%, no new entries at -12%.
- Require a documented review before restoring full size.

> Drawdown measures the road behind you. The fraction you risk, the volatility you size against and the cluster you forget decide the road ahead.

**Limitation:** the worst drawdown you have observed cannot bound the one you have not. Marks go stale in illiquid instruments, correlations converge toward 1 exactly when you need them not to, stop orders do not guarantee the stop price, and margin agreements can force sales. A drawdown gate limits planned exposure. It cannot cap the final loss.

Sources: [FINRA: Risk](https://www.finra.org/investors/investing/investing-basics/risk); [FINRA: Concentration Risk](https://www.finra.org/investors/insights/concentration-risk); [Investor.gov: Types of Orders](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/types-orders); [Investor.gov: Understanding Margin Accounts](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-29)

Educational, not investment advice.
