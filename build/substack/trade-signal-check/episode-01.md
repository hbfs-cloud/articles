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

A Cleveland-Cliffs (`CLF`) plan archived on August 13, 2026 carried two prices: buy at $12.25, get out at
$11.28. Subtract them. Ninety-seven cents. That is what one share costs you if the idea turns out to be
wrong, and every other number in the order should be built from it.

Take an account of $10,000 whose owner decided, in advance, to put at most $50 behind any single idea.
The 0.5% is there to make the sum readable, not because it suits anyone in particular.

```text
$50 / $0.97 = 51.54 shares
Round down to 51 shares
Cash committed: 51 x $12.25 = $624.75
Loss at the stop before costs: 51 x $0.97 = $49.47
```

![Size decides what a bad night costs you](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/position_sizing.png)

Now read the last two lines side by side. The order ties up $624.75, or 6.25% of the account. The planned
loss is $49.47, just under 0.5%. One trade, two numbers that look nothing alike. Risking half a percent is
not investing half a percent, and confusing the two is how a position people describe as small ends up
being the largest line they own.

Notice what the arithmetic never asks: how much you like the trade. Conviction does not appear in the
division. A setup that needs a wide exit gets fewer shares. An exit you can defend close to the entry buys
more. Distance does the work.

The order of operations matters, and I would not bend it. Choose the protective exit first, quantity
second. That exit is either the price at which the reason for the trade stops being true, or an earlier
limit your tested rules impose. Sliding it up toward the entry so you can afford more shares is not risk
management. It is shopping for a bigger position, then calling the receipt a plan.

Before your next fixed-stop stock order, write these down:

1. Entry.
2. The protective-exit rule, plus the price that kills the idea if the two differ.
3. Risk per share.
4. Maximum dollar loss.
5. A gap-stress price and the loss it would produce.
6. Caps on notional value, concentration and total portfolio risk.
7. Whole-share quantity, rounded down.

Final quantity is the smallest number any one of those checks allows. If a single check fails, refuse the
trade. Do not repair it with a tighter stop.

## What the sum cannot promise

The $49.47 assumes somebody fills you at $11.28. A stock can open far below that after earnings or
overnight news, and a triggered stop turns into a market order: it asks for an exit, it does not book one.
Fees and slippage widen the loss again. So the formula bounds planned regular-session risk and nothing
more. Leveraged products, options and short sales need their own stress and margin checks before any of
this applies.

The same `CLF` plan listed targets at $13.20 and $13.85. Part 2 asks whether either one paid enough for
those 97 cents.

Sources: [SEC: Stop, Stop-Limit, and Trailing Stop Orders](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-15); [FINRA: Understanding Risk](https://www.finra.org/investors/investing/investing-basics/risk)

*Case note: `CLF` was picked after the fact to teach the arithmetic, not to suggest what such signals earn
on average. Its archived Yahoo bar closed at $12.095 while the plan's stated entry was $12.25, and the
adjustment rule was never recorded. The earliest saved version carries a local 13:05 UTC stamp, which is
not independent proof of when it existed. No issuer paid for this series; DailyTickers and its authors may
hold securities discussed. Educational, not investment advice.*
