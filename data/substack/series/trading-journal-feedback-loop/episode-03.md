---
title: "What MAE and MFE Can Audit"
subtitle: "Adverse and favorable excursion become useful only under fixed measurement rules."
module_id: "trading-journal-feedback-loop"
episode_number: 3
source_path: "series/journal-et-performance/part3-mae-mfe/index.html"
---

*Part 3 of 6 in Turn a Trading Journal Into a Feedback Loop.*

Measure maximum adverse excursion and maximum favorable excursion with rules fixed before reviewing outcomes. Use them to describe the path of recorded trades, not to claim that a tighter stop or better exit would have worked. Any proposed rule change needs a separate test that includes trades the new rule would remove or alter.

For a long position, maximum adverse excursion, or MAE, is the largest move below the actual entry while the trade is open. Maximum favorable excursion, or MFE, is the largest move above it. Reverse the signs for a short position. State whether the calculation uses trades, bid or ask quotes, or bar highs and lows; regular or extended hours; and whether excursions are measured before the first partial exit or until the entire position closes.

Suppose a hypothetical long trade fills at $52.00 with initial planned price risk of $1.00 per share. While open, the lowest observed price under the journal's chosen data convention is $51.40 and the highest is $53.20. The trade exits at $52.70. Its MAE is $0.60, or 0.6R on a price-risk basis. MFE is $1.20, or 1.2R, and the realized price move is 0.7R before costs.

That path does not prove a stop at 0.7R would be superior. The same stop applied across the full historical signal set could change holding times, re-entry decisions, costs, and which later gains remain reachable. Nor does a 0.7R realization from 1.2R MFE prove that 0.5R was "left on the table." The high may have occurred before or after partial exits, and it may not have been executable for the full size.

Use this measurement procedure:

- Freeze actual entry, exit, initial risk, and position timestamps.
- Select one price source and session convention.
- Retain bar interval and missing-data flags.
- Calculate MAE and MFE mechanically for every included trade.
- Compare distributions by setup version, not isolated examples.
- Test any new exit rule on untouched or forward data after accounting for costs.

Order mechanics belong in the interpretation. Investor.gov explains that displayed prices can change before execution and that order type changes the balance between execution certainty and price control. A bar high or low therefore describes market data under a convention, not a guaranteed fill.

**Limitation:** ordinary bar data may not reveal whether the high or low occurred first, whether quoted size was available, or whether the trader's order would have moved or missed the market. MAE and MFE are especially vulnerable to hindsight because both use information known only after entry. Treat them as diagnostics, not causal evidence for an optimized stop.

Sources: [Investor.gov: Executing an Order](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/executing-order); [Investor.gov: Types of Orders](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/types-orders)

Educational, not investment advice.
