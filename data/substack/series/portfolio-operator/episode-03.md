---
title: "Drawdown Measures the Path Behind You"
subtitle: "Peak-to-trough decline and prospective risk budgets answer different questions."
module_id: "portfolio-operator"
episode_number: 3
source_path: "series/piloter-son-portefeuille/part3-drawdown/index.html"
---

*Part 3 of 6 in Operate a Portfolio, Not a Collection of Trades.*

Measure drawdown from the portfolio's prior equity peak, but manage future exposure with separate loss budgets and stress limits. Drawdown is an observed path statistic. It is not the amount at risk on the next trade, the maximum future loss, or proof that an edge has disappeared.

Choose the equity convention first. Decide whether the series includes open-position marks, cash flows, fees, financing, and taxes, and specify the valuation time and price source. Then calculate:

`drawdown = (current equity - prior peak equity) / prior peak equity`

Suppose a hypothetical account reaches a closing equity peak of $50,000 and later closes at $46,000 with no deposits or withdrawals. Its drawdown under that convention is -8 percent. That figure describes a $4,000 decline from the recorded peak. It does not say that another trade risks $4,000, nor does it prevent the account from falling further. A separate policy might allow only $120 of planned loss on a new position and $300 across all open positions. Those are prospective limits chosen by the operator, not values inferred from the drawdown.

Portfolio risk also needs a stress view. FINRA describes concentration risk as amplified loss from a large exposure to one investment, asset class, or market segment. Positions with different tickers can share the same economic driver. Adding each planned stop loss will understate exposure if correlated gaps bypass several stops together.

Define drawdown states before they occur. A first state can trigger enhanced reconciliation and exposure review. A later state can reduce or block new risk. A mandate breach can require a pause and formal decision. The levels must reflect the portfolio's objective, capital needs, evidence, and ability to bear loss. No fixed percentage is suitable for every strategy or trader.

Use this risk check:

- Freeze the equity, cash-flow, and valuation convention.
- Report current and maximum drawdown with dates.
- Keep trade and aggregate loss budgets in separate fields.
- Stress gaps, leverage, and shared portfolio drivers.
- Link each drawdown state to an automatic operating response.
- Require a documented review before restoring size.

**Limitation:** historical maximum drawdown is sample-dependent and cannot bound an unobserved worst case. Marks can be unreliable in illiquid instruments, and correlation can rise during stress. Stop orders do not guarantee the stop price, while margin agreements may permit forced sales. A drawdown gate can reduce planned exposure; it cannot guarantee the portfolio's terminal loss.

Sources: [FINRA: Risk](https://www.finra.org/investors/investing/investing-basics/risk); [FINRA: Concentration Risk](https://www.finra.org/investors/insights/concentration-risk); [Investor.gov: Types of Orders](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/types-orders); [Investor.gov: Understanding Margin Accounts](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-29)

Educational, not investment advice.
