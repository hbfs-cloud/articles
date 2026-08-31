---
title: "Launch a Strategy as a Controlled Forward Test"
subtitle: "Start at executable scale only after limits, records, and shutdown rules exist."
module_id: "portfolio-operator"
episode_number: 1
source_path: "series/piloter-son-portefeuille/part1-demarrer/index.html"
---

*Part 1 of 6 in Operate a Portfolio, Not a Collection of Trades.*

Launch a strategy at the smallest size that can reveal real execution behavior, and do so only after risk limits, recordkeeping, and shutdown controls are active. A backtest can justify further investigation; it cannot authorize full deployment. The first live allocation is a forward test with money at risk, not a victory lap for historical results.

Write the launch policy before the first order. It should name the strategy version, eligible instruments, broker and account type, intended order handling, per-position loss budget, aggregate exposure cap, leverage rule, and events that block entry. Add two separate controls: a routine pause that stops new risk and an emergency response for an account, broker, or market failure.

The deployment ladder should use predeclared gates rather than confidence. Stage one might use the minimum practical quantity that still produces representative broker records. A later stage can begin only after the planned observation window closes, all fills reconcile, no unresolved control failure remains, and measured costs stay within the strategy's stated tolerance. None of those conditions requires the strategy to be profitable over a tiny sample.

Consider a hypothetical strategy whose first live order risks $40 from entry to planned invalidation. The broker fills two cents worse than the paper model, and the exit slips another three cents on 100 shares. The live record therefore contains $5 more price loss than the idealized path, before any fees. That difference does not prove the strategy failed, but it does invalidate a cost model that assumed perfect fills. The next stage must use the corrected cost assumption; increasing size because the trade happened to win would ignore the evidence the launch was meant to collect.

Use this launch checklist:

- Freeze the strategy and sizing versions with an effective timestamp.
- Confirm trade, portfolio, concentration, and leverage limits.
- Test rejected-order, stale-data, and emergency-exit procedures.
- Reconcile every live fill and known cost to broker records.
- Define the observation window and promotion or demotion gates.
- Keep capital at the current stage while any exception remains open.

The CFTC warns that hypothetical trading results have inherent limitations, including hindsight and the absence of actual financial risk. That warning does not turn live trading into proof. It explains why historical simulation and real execution must remain separately labeled.

**Limitation:** minimum size may understate slippage, market impact, margin pressure, and the difficulty of following rules at meaningful scale. A quiet launch period may also omit the regime that generated the backtest's worst losses. Staging reduces exposure while uncertainty is high; it does not establish an edge or cap loss at the planned amount.

Sources: [CFTC: Commodity Trading Systems Sold on the Internet](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/fraudadv_tradingsystem.html); [FINRA: Risk](https://www.finra.org/investors/investing/investing-basics/risk); [Investor.gov: Understanding Margin Accounts](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-29)

Educational, not investment advice.
