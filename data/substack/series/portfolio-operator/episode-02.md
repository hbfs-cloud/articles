---
title: "Separate Backtests From Forward Evidence"
subtitle: "Freeze the method before new observations and measure live execution independently."
module_id: "portfolio-operator"
episode_number: 2
source_path: "series/piloter-son-portefeuille/part2-backtest-forward/index.html"
---

*Part 2 of 6 in Operate a Portfolio, Not a Collection of Trades.*

Call an observation forward evidence only if it occurred after the strategy, data rules, and evaluation criteria were frozen. Replaying unseen historical data is an out-of-sample backtest, not a forward test. Paper trading after the freeze is forward observation without financial risk; live trading adds actual fills, costs, operational failures, and behavioral pressure.

Start by separating three records. The **development sample** is where rules were proposed or tuned. The **held-out sample** is historical data reserved for one clean evaluation. The **forward log** begins at a timestamp after the final rule version exists. Once a held-out result influences the method, that period belongs to development for every later claim.

A reproducible handoff needs more than signal code. Freeze the universe definition, corporate-action treatment, time zone, release timestamps, order model, fees, slippage assumptions, position sizing, portfolio constraints, and treatment of missing or rejected trades. Preserve every eligible signal, including those that could not be filled. Otherwise execution selection can make the forward record look cleaner than the strategy was.

Use a hypothetical chronology. A researcher finishes rule version 1.0 on June 30 and records its file checksum, parameters, and test protocol. Data through June 30 remain historical, even if some dates were never viewed. Signals first generated on July 1 can enter the forward log. If an August review changes the liquidity filter, version 1.1 starts with a new timestamp. July's results may explain the change, but they cannot serve as untouched validation for version 1.1.

Compare like with like. Backtest fills should use assumptions available to the simulation. Paper results should retain unfilled and partial orders. Live results should come from broker records and include known transaction costs. Investor.gov explains that execution is not instantaneous and that the observed quote need not be the eventual fill. A chart crossing an entry price is therefore not proof of executable performance.

Run this evidence check:

- Identify development, held-out, paper-forward, and live-forward periods.
- Timestamp every strategy and data-processing version.
- Retain rejected, partial, canceled, and skipped orders.
- Reconcile live fills and costs independently of chart data.
- State all exclusions before calculating performance.
- Reset the forward label after a material rule change.

**Limitation:** a clean forward test can still be too short, too narrow, or drawn from one market regime. Paper execution omits financial risk and may model queue position poorly. Live evidence at small size may not reveal capacity. Forward performance reduces some hindsight risk; it does not make future observations independent or guarantee persistence.

Sources: [CFTC: Commodity Trading Systems Sold on the Internet](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/fraudadv_tradingsystem.html); [Investor.gov: Executing an Order](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/executing-order); [Investor.gov: Understanding Fees](https://www.investor.gov/introduction-investing/getting-started/understanding-fees)

Educational, not investment advice.
