---
title: "For Fixed-Stop Stock Trades, Size From the Stop"
subtitle: "Stop distance sets one sizing ceiling. Gap, liquidity and portfolio limits set the rest."
series: "The 30-Second Trade Signal Check"
episode: 1
language: "en"
module_id: "trade-signal-check"
episode_number: 1
source_path: "series/anatomie-signal-trade/part1-le-cadre/index.html"
---

*Part 1 of 6 in The 30-Second Trade Signal Check.*

For a long, unlevered stock trade with a fixed protective stop, stop distance is one input to position
size. It is not the final answer.

A Cleveland-Cliffs (`CLF`) plan archived on August 13, 2026 carried a $12.25 entry and an $11.28 stop.
At those prices, each share risked $0.97.

Assume a $10,000 account with a $50 risk budget. The 0.5% budget is an example, not a recommendation.

```text
$50 / $0.97 = 51.54 shares
Round down to 51 shares
Cash committed: 51 x $12.25 = $624.75
Loss at the stop before costs: 51 x $0.97 = $49.47
```

The position uses 6.25% of the account. The planned loss is just under 0.5%. Those are different
numbers. "Risk 0.5%" does not mean "invest 0.5%."

This distinction removes conviction from the first calculation. A setup that needs a wider stop receives
fewer shares. A defensible stop closer to the entry permits more shares. Stop distance, not volatility by
itself, changes the result.

The order also matters. Define the protective-exit rule before calculating quantity. That price may be
the point where the thesis is disproved, or an earlier risk limit from a tested strategy. Either way, do
not move it upward just to manufacture a larger position.

For the next fixed-stop stock order, write these fields before entering anything:

1. Entry.
2. Protective-exit rule and thesis invalidation, if they differ.
3. Risk per share.
4. Maximum dollar loss.
5. Gap-stress price and loss.
6. Notional, concentration and portfolio-risk caps.
7. Whole-share quantity, rounded down.

Final quantity is the smallest amount allowed by the stop-loss budget, the gap-stress budget, the
notional and concentration caps, liquidity and total portfolio exposure. Reject the trade when any one
of those checks fails. Do not repair it with a tighter stop.

## What the calculation misses

The $49.47 loss assumes an execution at $11.28. A stock can open below that price after earnings or
unexpected news. Fees and slippage also add to the loss. The formula controls the planned regular-session
risk; it cannot guarantee the exit price. Leveraged products, options and short sales need different
stress and margin checks.

The same `CLF` plan included targets at $13.20 and $13.85. Part 2 checks whether either target paid enough
for the $0.97 at risk.

Sources: [SEC: Stop, Stop-Limit, and Trailing Stop Orders](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-15); [FINRA: Understanding Risk](https://www.finra.org/investors/investing/investing-basics/risk)

*Case selection: `CLF` was chosen after review to teach sizing arithmetic, not to estimate average signal
performance. The earliest saved plan version is time-stamped 13:05 UTC inside the case record; that local
timestamp is not independent proof of when it existed. Its archived Yahoo bar closed at $12.095; $12.25
was the plan's explicit entry, but the adjustment rule was not recorded. The arithmetic above audits the
plan levels only. No named issuer sponsored or compensated this series; DailyTickers and its authors may
hold securities discussed. Educational, not investment advice.*
