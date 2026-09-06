---
title: "Launch a Strategy as a Controlled Forward Test"
subtitle: "Start at executable scale only after limits, records, and shutdown rules exist."
module_id: "portfolio-operator"
episode_number: 1
source_path: "series/piloter-son-portefeuille/part1-demarrer/index.html"
---
*Part 1 of 6 in Operate a Portfolio, Not a Collection of Trades.*

Day one is the most fragile day an account will ever have. It is also the day most people go all in.

A mature portfolio carries three quiet protections: an edge that has survived real fills, a cushion of accumulated profit, and habits that hold under pressure. On day one all three are missing simultaneously. Which is why the same 10% loss lands so differently depending on when it shows up. Lose 10% on a $10,000 account at the start and you sit at $9,000, needing +11.1% just to return to your own starting line. Lose the same 10% after the account has grown to $13,000 and you sit at $11,700 — still 17% above where you began, still following the plan. The second loss costs money. The first costs discipline, and that is the expensive one.

![The smooth curve is the one you fitted](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/forward_vs_backtest.png)

So treat the launch the way an engineer treats a release. Ship to a small slice first.

Write the policy before the first order: strategy version, instruments, broker and account type, loss budget per position, total exposure cap, leverage rule, and the events that block entry outright. Then arm two separate switches — an ordinary pause that stops new risk, and an emergency exit for when the broker, the data feed or the market itself breaks.

Size down on two independent dials. Deploy 10% of the target capital, not 100%. And risk 0.25% to 0.5% of capital per trade instead of the roughly 1% you plan to run at cruising speed. On a $10,000 account that is $50 at risk per trade rather than $100. You will make less. That is the trade — you are buying information about slippage, fills and your own reaction to a red screen, at the cheapest price it will ever be sold.

Promotion runs on mechanics, never on profit. Move up a tier only if fills came back whole at the expected price, slippage stayed inside the band you predicted, stops triggered correctly including on gap opens, and no circuit breaker fired. Three winning trades tell you the market was kind. They tell you nothing about the plumbing. A backtest showing a profit factor of 1.6 can land at 1.1 once real slippage and real fills are counted, and you want that discovery at 10% size.

Launch checklist:

- Freeze the strategy and sizing versions with a timestamp.
- Confirm per-trade, portfolio, concentration and leverage limits.
- Test rejected orders, stale data and the emergency exit before you need them.
- Reconcile every fill and fee against broker records, not against your chart.
- Write down the observation window and the promotion gate for each tier.
- Stage entries across four to eight weeks rather than one session.
- Hold capital at the current tier while any exception stays open.

Arm a drawdown cut-out at -3% of deployed capital: no new entries, existing positions run to their stops or targets. At small size and partial deployment, -3% already means a run of trades misbehaved. And no leverage at launch. None. It multiplies the exact fraction that drives risk of ruin, at the exact moment nothing has been confirmed.

The CFTC's warning about hypothetical results is worth reading in the original: they benefit from hindsight and carry no financial risk. That does not make live trading proof of anything either.

**Limitation:** minimum size understates slippage, market impact and margin pressure, and a calm launch window may never show you the regime that produced the backtest's worst month. Staging cuts exposure while uncertainty is highest. It does not establish an edge.

Sources: [CFTC: Commodity Trading Systems Sold on the Internet](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/fraudadv_tradingsystem.html); [FINRA: Risk](https://www.finra.org/investors/investing/investing-basics/risk); [Investor.gov: Understanding Margin Accounts](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-29)

Educational, not investment advice.
