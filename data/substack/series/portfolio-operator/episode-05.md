---
title: "The Portfolio Pause Protocol"
subtitle: "Stopping new entries, reducing exposure, and liquidating positions are different controls."
module_id: "portfolio-operator"
episode_number: 5
source_path: "series/piloter-son-portefeuille/part5-pause-vacances/index.html"
---

*Part 5 of 6 in Operate a Portfolio, Not a Collection of Trades.*

Choose the portfolio state before an absence or operational disruption: normal, reduced, no-new-risk, or liquidation. These states are not interchangeable. Pausing new entries leaves existing market risk in place; reducing exposure changes it; liquidation seeks to remove it and introduces execution risk of its own.

Start with the reason and duration. A planned absence may allow an orderly review of each position. A data failure can justify blocking new orders immediately. A breached mandate or compromised account may require emergency action. Do not use the vague instruction "be careful" where an executable state is possible.

Use this pause checklist:

- Name the state, reason, owner, start time, and review time.
- Block or cancel orders that conflict with the state.
- Reconcile open positions, leverage, and concentration.
- Verify accepted exits and exception contacts.
- Reduce size when monitoring capacity no longer matches the risk.
- Require a documented restart gate.

For a planned pause, inspect every open position against current thesis, event calendar, liquidity, leverage, and shared exposure. Decide whether the strategy can manage the position without discretionary intervention. If not, reduce or close it under a prewritten rule. Tightening every stop to keep the same size is not equivalent: it changes the trade thesis and may increase noise-driven exits without addressing gap risk.

Consider a concrete absence procedure. At the final staffed review, block new entries after a recorded timestamp. Reconcile positions with the broker, cancel stale entry orders, confirm which exit orders are accepted, and document who can act on an exception. For each retained position, record quantity, current thesis, invalidation, scheduled events, financing, and the response to an order rejection. On return, do not restore normal size until data, broker access, exposure, and strategy assumptions have been checked again.

Order labels do not remove execution risk. Investor.gov explains that a stop order becomes a market order when triggered and may fill away from the stop price; a stop-limit order controls price but may not execute. Linked or automated orders can also be rejected, canceled, or configured incorrectly. Confirm broker-specific behavior rather than treating an order ticket as insurance.

**Limitation:** an orderly pause may be impossible during a halt, outage, margin event, or abrupt liquidity loss. Closing everything can realize poor prices and abandon valid positions; holding can expose the portfolio to unmanaged gaps. In a margin account, the broker may liquidate securities without consulting the customer. No pause design eliminates that trade-off.

Sources: [Investor.gov: Types of Orders](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/types-orders); [Investor.gov: Executing an Order](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/executing-order); [Investor.gov: Understanding Margin Accounts](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-29)

Educational, not investment advice.
