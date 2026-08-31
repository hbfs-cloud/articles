---
title: "A Clean Retirement Test for a Strategy"
subtitle: "Predeclared shutdown rules preserve capital and the evidence needed for review."
module_id: "portfolio-operator"
episode_number: 6
source_path: "series/piloter-son-portefeuille/part6-arreter/index.html"
---

*Part 6 of 6 in Operate a Portfolio, Not a Collection of Trades.*

Define shutdown conditions while the strategy is healthy, and separate an operational stop from a research conclusion. A control breach can require an immediate halt without proving the edge is gone. A drawdown can trigger a mandate pause without proving permanent failure. Declaring the strategy dead requires evidence under the predeclared evaluation method, not exhaustion after a losing streak.

Use three shutdown classes. An **emergency stop** responds to compromised credentials, uncontrolled orders, invalid data, margin danger, or another condition that makes continued operation unsafe. An **orderly stop** blocks new entries, manages existing positions under written exits, and closes the operating cycle. A **research retirement** follows a frozen review showing that the current version no longer meets its stated evidence or economic criteria after costs.

Use this closure checklist:

- Block new exposure and identify every working order.
- Reconcile positions and broker records before analysis.
- Execute emergency and orderly exits under separate rules.
- Freeze data, code, parameters, costs, and exception logs.
- Compare the result with the original mandate and test protocol.
- State whether the decision is pause, revision, or retirement.

The sequence matters. First protect the account and stop creating new exposure. Then reconcile positions, working orders, fills, financing, and external cash flows. Preserve the strategy version and the complete record before analysis. Only after the operating state is controlled should the review classify causes such as execution deterioration, changed opportunity set, underestimated costs, concentration, or ordinary variation.

Consider a hypothetical strategy with a predeclared mandate drawdown gate. The gate is breached after a gap produces a worse exit than planned. New orders stop immediately because the mandate says so. Existing positions follow the separate shutdown schedule. The post-mortem retains the full gap loss rather than clipping it to the planned stop and reruns performance with actual costs. The result may support revision, retirement, or a new forward test, but the original record remains closed and unchanged.

Do not choose the sample length after seeing the answer. If the retirement test depends on expectancy, drawdown, or execution quality, define the observation unit, review window, exclusions, and uncertainty before deployment. FINRA's performance guidance emphasizes including transaction fees and comparing compatible periods. A flat average without its distribution, capital path, and largest contributors is not enough.

**Limitation:** shutdown rules can exit near a recovery, while waiting for stronger statistical evidence can exceed a real capital constraint. Emergency liquidation can produce poor fills, and an orderly exit can retain risk longer. The objective is not perfect timing. It is a controlled decision whose reason and evidence remain inspectable.

Sources: [FINRA: Evaluating Performance](https://www.finra.org/investors/investing/investing-basics/evaluating-performance); [FINRA: Risk](https://www.finra.org/investors/investing/investing-basics/risk); [Investor.gov: Executing an Order](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/executing-order)

Educational, not investment advice.
