---
title: "A Rule-Based Scaling Ladder"
subtitle: "Increase size only after predefined evidence, capacity, and risk gates hold."
module_id: "portfolio-operator"
episode_number: 4
source_path: "series/piloter-son-portefeuille/part4-scale-up/index.html"
---

*Part 4 of 6 in Operate a Portfolio, Not a Collection of Trades.*

Approve a size increase only through a written scaling rule that existed before the recent returns. Confidence, a winning streak, or recovery from a loss is not a scaling variable. The gate should require forward evidence, acceptable execution, available capacity, intact portfolio limits, and no unresolved control breach.

Separate two decisions. **Position scaling** changes quantity in one strategy or trade. **Book scaling** changes capital assigned to the strategy and its share of total portfolio risk. Adding to a favorable position is not the same as increasing the strategy mandate. Each needs its own trigger, ceiling, and reversal rule.

A practical scaling gate can ask:

- Has the predeclared forward observation window completed without a material rule change?
- Do net results remain within the strategy's stated review bounds, including losses?
- Are actual spread, slippage, fill rate, and rejected orders within capacity assumptions?
- Does the larger allocation preserve trade, aggregate, concentration, and leverage limits?
- Has the operator observed the strategy during adverse conditions rather than only favorable ones?

Take a hypothetical strategy trading 100 shares per signal. Its next stage permits 150 shares only if a fixed review closes with reconciled fills and no capacity exception. Before promotion, replay the actual order book or broker records under a conservative 150-share model, then run the first larger orders under a tighter monitoring state. If average price deteriorates beyond the predeclared tolerance, return to 100 shares. A profitable 150-share trade does not override that rule; the measured execution difference does.

Capacity cannot be inferred by multiplying small-size results. Larger orders can receive partial fills, consume displayed liquidity, alter timing, or miss a limit entirely. Investor.gov notes that quotes apply to a specified number of shares and that price can change before an order reaches the market. Scaling tests therefore need actual quantity, timestamps, fill prices, unfilled orders, and costs.

Scaling should also preserve portfolio structure. If the strategy already dominates one sector or factor, more capital can amplify concentration even when its standalone metrics look stable. Adding a genuinely distinct strategy may reduce one concentration, but a low historical correlation is not a guarantee during stress.

Use this action checklist:

- Freeze promotion, demotion, and rollback rules.
- Measure live execution at the current size.
- Stress the proposed quantity and shared exposures.
- Change one size variable at a time.
- Preserve the prior stage while validating the new one.
- Roll back on a control or capacity breach, regardless of profit.

**Limitation:** no small-scale test fully reveals market impact at larger size, and historical liquidity may vanish. Forward success can still be regime-specific. A staircase slows escalation and makes decisions auditable; it does not convert past performance into a reliable forecast.

Sources: [Investor.gov: Executing an Order](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/executing-order); [FINRA: Concentration Risk](https://www.finra.org/investors/insights/concentration-risk); [FINRA: Evaluating Performance](https://www.finra.org/investors/investing/investing-basics/evaluating-performance)

Educational, not investment advice.
