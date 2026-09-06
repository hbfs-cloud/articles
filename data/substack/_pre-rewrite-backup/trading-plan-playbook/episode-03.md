---
title: "Separate Entry, Exit, and Invalidation"
subtitle: "Order mechanics and exit paths belong in the plan before position sizing."
module_id: "trading-plan-playbook"
episode_number: 3
source_path: "series/plan-de-trading/part3-entrees-sorties/index.html"
---

*Part 3 of 6 in Build a Trading Plan You Can Execute.*

Define the signal, order, invalidation, and exit as four separate decisions. A signal says conditions are present. An order says how you will seek execution. Invalidation says the trade thesis no longer holds. An exit instruction says how you will respond. Combining them into one price hides execution risk and invites the position size to dictate the analysis.

Order type matters. Investor.gov explains that a market order generally prioritizes execution but does not guarantee the execution price. A limit order controls the worst acceptable price but may never fill. A stop order becomes a market order when triggered, so its stop price is not a guaranteed fill price. Broker handling and trigger conventions can differ; read the broker's order documentation before relying on any order behavior.

Consider a hypothetical plan with a $31.25 limit entry and a $30.70 thesis-invalidation level. If filled at $31.20, the planned price risk is $0.50 per share, not the $0.55 distance calculated from the unfilled limit. A planned target at $32.20 would be two times that $0.50 risk. This 2R geometry describes payoff if both prices are achieved; it says nothing about the probability of reaching either level and therefore does not establish positive expectancy.

Write every route before submitting the entry:

- **No fill:** cancel after the stated time; do not chase unless a separate rule permits it.
- **Invalidation:** identify the order or manual action intended to exit.
- **Favorable move:** define any scale-out, trailing rule, or terminal target.
- **Time expiry:** exit or reassess at a named deadline.
- **Exceptional event:** define the response to a halt, gap, rejected order, or material disclosure.

The sequence is important. Choose invalidation from the trade thesis, estimate realistic execution loss including costs, and only then calculate the maximum size. Moving the invalidation closer solely to obtain more shares is circular: the desired size has rewritten the evidence against the trade.

Use this pre-order check:

- Distinguish signal price from intended order price.
- Verify order duration, session eligibility, and trigger convention.
- Recalculate risk from the actual fill.
- State all exits, including no-fill and time-expiry cases.
- Reject the trade if a plausible gap exceeds your acceptable loss.

**Limitation:** even careful instructions cannot cap loss at the planned amount. Fast markets, sparse liquidity, news, trading halts, and overnight gaps can produce a materially worse exit. A limit on an exit can avoid a worse price but can also leave the position open. That trade-off must be explicit.

Sources: [Investor.gov: Types of Orders](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/types-orders); [Investor.gov: Executing an Order](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/executing-order)

Educational, not investment advice.
