---
title: "A P&L-Agnostic Trade Audit"
subtitle: "A useful retrospective separates process quality from the outcome of one trade."
module_id: "market-checklist"
episode_number: 7
source_path: "series/marketwatch-checklist/part7-retrospective/index.html"
---
*Part 7 of 7 in The Market Checklist.*

::audience non_sub,free_sub
Each part stands on its own. This is 7 of 7 in The Market Checklist; earlier parts cover the groundwork but you can start here.
::end

Grade each trade against the plan that existed before entry, not against what became obvious later. Profit can conceal a rule violation, and a loss can come from a correctly executed process. The review should produce one behavior to keep, stop, or test. It should not rewrite the setup to make the result look inevitable.

Preserve a point-in-time record before the order: regime label, setup, trigger, entry boundary, invalidation, size calculation, event check, expected holding period, and full exit policy. After execution, attach the broker confirmation and record the actual quantity, fill price, fees, partial fills, and timestamps. This separates the planned trade from the trade the market and broker actually delivered.

![Without the record, the loop is just repetition](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/journal_loop.png)

Review in four passes.

**Plan quality:** Were entry, risk, event, and exit branches complete? Did the scenario set include the loss that occurred?

**Execution quality:** Did the order match the card? Measure the difference between intended and actual fill, but do not label every unfavorable difference avoidable. Spread, depth, order type, and market speed matter.

**Adherence:** Identify choices made outside the plan: chasing, oversizing, moving an invalidation, averaging without authority, or ignoring a time exit.

**Outcome:** Record return and path only after the first three passes. Compare trades that share the same setup and rules; do not blend unrelated strategies into one win rate.

**Worked micro-example:** Trade A makes money after the trader buys above the maximum entry and doubles the planned size. Trade B loses the predefined amount after a valid trigger and compliant exit. The outcome column favors A, but the process review fails A and passes B. The usable behavior is precise: enforce the entry boundary on the next occurrence. “Choose better winners” is not an operational lesson.

**Review record**

- Archive the pre-trade plan and primary evidence.
- Reconcile plan, order, confirmation, and account statement.
- Tag setup, regime, event exposure, and rule deviations.
- Write one behavior and the evidence needed to reassess it.
- Change one rule at a time across comparable observations.

Small samples cannot establish a durable edge, and market conditions can change before a sample grows. Reviewing only closed trades also misses rejected setups and canceled orders, which can hide selection bias. Keep those decisions in the log. A journal improves traceability; it does not prove that a rule will remain profitable.

Sources: [FINRA: Checking Trade Confirmations](https://www.finra.org/investors/insights/checking-trade-confirmations), [Investor.gov: Broker-Dealer Record-Keeping](https://www.investor.gov/introduction-investing/investing-basics/glossary/broker-dealers-record-keeping-requirements).

Educational, not investment advice.
