---
title: "Size the Position, Then Cap the Portfolio"
subtitle: "Per-trade risk is only one limit; concentration and aggregate exposure still matter."
module_id: "trading-plan-playbook"
episode_number: 4
source_path: "series/plan-de-trading/part4-sizing-risque/index.html"
---
*Part 4 of 6 in Build a Trading Plan You Can Execute.*

Calculate position size from a preselected loss budget and an independently chosen invalidation, then reduce it for liquidity, concentration, leverage, and event risk. Never move the invalidation to manufacture the share count you want. The formula produces an arithmetic ceiling, not a promise about the loss a broker will deliver.

For a long position, start with:

![Size decides what a bad night costs you](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/position_sizing.png)

`planned price risk per share = intended entry - invalidation level`

`share ceiling = floor(loss budget / planned price risk per share)`

Suppose, hypothetically, the intended entry is $24.80, invalidation is $24.05, and the trader's own loss budget is $150. Planned price risk is $0.75 per share, giving an arithmetic ceiling of 200 shares. If the trader's liquidity rule allows only 120 shares at that moment, 120 is the operative maximum. If commissions, fees, estimated slippage, or a wider actual fill increase expected loss beyond the budget, size must fall again.

Now inspect the portfolio. Two positions can carry distinct tickers yet respond to the same sector, factor, currency, commodity, or event. FINRA describes concentration risk as amplified loss that can arise when a large portion of holdings sits in one investment, asset class, or market segment. Add planned loss across open positions, but do not mistake that sum for a worst case. Correlated gaps can defeat several exits at once.

Create explicit portfolio gates:

- Maximum planned loss for one position.
- Maximum aggregate planned loss across open positions.
- Maximum exposure to one issuer, sector, or shared driver.
- Maximum leverage and gross exposure allowed by the plan and account.
- A smaller cap, or no new risk, around events the strategy does not model.
- A drawdown response defined before the drawdown occurs.

A drawdown rule should reduce uncertainty, not imply recovery. For example, a trader may precommit to pause new entries after a personal loss threshold and audit records before resuming. The threshold must come from that trader's capacity and strategy evidence. There is no regulator-approved or universally optimal percentage.

Use this order of operations:

- Fix thesis invalidation.
- Estimate loss per unit, including realistic costs.
- Calculate the arithmetic size ceiling.
- Apply tighter liquidity and portfolio caps.
- Stress a gap or correlated move that bypasses planned exits.

**Limitation:** historical correlation and average liquidity can fail precisely during stress. Stops are instructions, not insurance, and leverage can magnify losses. Position sizing can bound an estimate under stated assumptions; it cannot guarantee a maximum realized loss.

Sources: [FINRA: Risk](https://www.finra.org/investors/investing/investing-basics/risk); [FINRA: Concentration Risk](https://www.finra.org/investors/insights/concentration-risk); [Investor.gov: Types of Orders](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/types-orders)

Educational, not investment advice.
