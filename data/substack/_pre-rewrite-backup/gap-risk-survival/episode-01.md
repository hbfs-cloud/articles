---
title: "A Stop Cannot Fill Inside an Empty Market"
subtitle: "Gap risk begins where the last tradable price ends and the next available price begins."
module_id: "gap-risk-survival"
episode_number: 1
source_path: "series/risque-de-gap/part1-anatomie-gap/index.html"
---

*Part 1 of 5 in Survive Gap Risk.*

Size an overnight position as though its stop may execute at the next available price, not at the stop trigger. A stop price is an instruction threshold. Once triggered, a standard stop becomes a market order, and the execution price is not guaranteed. If no executable prices exist between yesterday’s market and today’s market, the account absorbs that discontinuity.

Define a gap operationally: the next tradable market is materially away from the prior reference price. The reference may be the official close, the last regular-session trade, or another price specified by the strategy. State which one you use. An extended-hours print does not guarantee the next regular-session opening price because liquidity, venue linkage, and participants can differ.

Four facts matter more than a chart label:

- **Cause:** Was there an issuer filing, earnings release, macro decision, corporate action, or no verified news?
- **Market state:** Is the security trading normally, halted, in an auction, or quoted with unusable depth?
- **Order behavior:** Will the resting order trigger, become marketable, remain limited, or expire under the broker’s rules?
- **Portfolio impact:** What does the next executable price do to loss, margin, and correlated exposures?

**Worked micro-example:** Let `E` be the entry, `S` the stop trigger, and `B` the first usable bid after an adverse overnight event, with `B` below `S`. The planned loss per share was `E - S`. Once the market opens below the trigger, the relevant loss is closer to `E - B`, plus any additional slippage across available bids. The stop did not fail to trigger; it lacked liquidity at the planned price. A stop-limit order could prevent a sale below its limit, but the position might then remain open while price falls further.

**Before holding overnight**

- Name the price used to measure the gap.
- Verify the news through an issuer, regulator, or official release.
- Read the broker’s stop and session rules.
- Stress the position at an adverse executable price.
- Include resulting margin and portfolio effects.

Not every difference between two prints is a meaningful risk event. Thin extended-hours trades, stale quotes, corporate-action adjustments, and data errors can create apparent gaps. Conversely, a continuous chart can hide poor executable liquidity. Confirm the market state before acting, but do not rely on a universal waiting period. A verified structural event may require immediate risk reduction, while an unstable auction may make an unbounded market order unsuitable.

Sources: [Investor.gov: Understanding Order Types](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-14), [FINRA: Extended-Hours Trading Risks](https://www.finra.org/investors/insights/extended-hours-trading).

Educational, not investment advice.
