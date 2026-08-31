---
title: "Choose Protection by the Failure You Can Accept"
subtitle: "Cash, smaller size, options, and order types solve different parts of overnight risk."
module_id: "gap-risk-survival"
episode_number: 3
source_path: "series/risque-de-gap/part3-protection/index.html"
---

*Part 3 of 5 in Survive Gap Risk.*

Choose overnight protection from the maximum loss and operational failure you can accept. The cleanest hedge is often less exposure: exit before the event, reduce the position, remove leverage, or hold more cash. A stop manages an order after a trigger; it does not cap a loss through an empty price range. An option can define risk for a period, but only under its contract terms and after paying its cost.

Start with the unhedged stress. Estimate the loss at a defensible adverse executable price, then add spread, fees, currency effects, and any margin response. If that amount exceeds the account’s budget, compare four choices:

Do not choose the stress price after seeing which value permits the desired size. Predeclare the event taxonomy, universe, lookback, sample count, tail statistic, worst observation, and treatment of failures or delistings. Add a policy shock beyond observed history. If the evidence is insufficient, call the scenario unavailable and remove the overnight exposure. This remains scenario-limited sizing, not a guaranteed loss boundary.

1. **Exit:** removes the security-specific overnight exposure, although reinvestment and tax considerations remain.
2. **Reduce:** lowers every scenario without adding contract complexity.
3. **Protective put:** a long put paired with long stock establishes a sale right at the strike during the option’s life. Premium, strike, expiration, liquidity, and exercise procedures matter.
4. **Collar:** adding a long put and a covered short call can offset some hedge cost, but the call caps upside and creates assignment obligations.

Do not describe a collar as free protection. Net premium can be small or even a credit in a quoted market, yet the strategy gives up upside, incurs trading costs, and may be difficult to unwind.

**Worked micro-example:** A trader owns stock at entry price `E` and buys a put with strike `K` for premium `P`. At expiration, ignoring fees, dividends, taxes, and early-exercise effects, the combined maximum loss per share is approximately `E - K + P` when `K` is below `E`. Compare that defined amount with the unhedged gap stress and the cost of simply reducing shares. If the option spread is too wide or the contract expires before the event window ends, the put does not satisfy the plan.

**Protection decision**

- Calculate unhedged loss at the stressed executable price.
- Compare exit, reduced size, put, and collar in account currency.
- Check option multiplier, strike, expiry, spread, and exercise rules.
- Add premium, fees, upside cap, and margin effects.
- Write how and when both stock and hedge will be closed.

Options cannot protect outside their life or against every basis mismatch. A put on an index may not offset an individual stock gap, and an illiquid option quote may overstate realizable value. Tax, account permissions, and assignment treatment vary. If protection cannot be understood and executed, smaller exposure is the more reliable control.

Sources: [OIC: Protective Put](https://www.optionseducation.org/strategies/all-strategies/protective-put-married-put), [OIC: Protective Collar](https://www.optionseducation.org/strategies/all-strategies/collar-protective-collar), [OCC: Options Disclosure Document](https://www.theocc.com/company-information/documents-and-archives/options-disclosure-document), [Investor.gov: Understanding Order Types](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-14).

Educational, not investment advice.
