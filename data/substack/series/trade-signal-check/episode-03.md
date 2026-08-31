---
title: "Your Stop May Be Inside Recent Movement"
subtitle: "Volatility is a check on the stop, not a machine that chooses it for you."
series: "The 30-Second Trade Signal Check"
episode: 3
language: "en"
module_id: "trade-signal-check"
episode_number: 3
source_path: "series/anatomie-signal-trade/part3-le-stop/index.html"
---

*Part 3 of 6 in The 30-Second Trade Signal Check.*

The August 12 `CLF` screen reported a $12.095 raw entry, $0.645 ATR and an $11.1282 stop exactly 1.50 ATR
below entry. The final plan shifted to $12.25 and $11.28. It preserved almost the same distance, but that
shift was not rounding and its rule was not recorded.

That history changes the interpretation. The source-screen stop was volatility-derived. The undocumented
transformation prevents attributing the final stop to ATR or chart structure.

The stop happened to sit below the July 31 low of $11.35 and above the August 3 low of $10.87. If the
setup used only the later base, $11.28 might be defensible. If it relied on the full late-July structure,
the stop remained inside it. Because the screen generated the level from ATR first, neither chart story
validates the original method.

ATR answers a narrower question: how large is recent movement? It only normalizes distance. Stop-hit
probability requires the setup's historical maximum adverse excursion, meaning the worst move against
each past trade before its exit. When using that measure to design a stop, end every observation at a
predeclared horizon or outcome independent of the candidate stop; otherwise the sample is censored by the
rule it is supposed to test.

The archived Yahoo decision snapshot creates a second warning. Its August 12 bar closed at $12.095 on
5,831,609 shares. A Yahoo reconstruction collected on August 31 served $12.25 and 13,268,600 shares for
the same session. The later vendor version is not substituted into the decision record.

The arithmetic mean of 14 true ranges from the archived bars was $0.688, not the screen's $0.645.
The screen did not expose its ATR convention. The revised final-day close does not change that arithmetic
calculation ending on August 12, so the exact cause of the ATR difference remains unproven. Use $0.645
only to reconstruct what the screen did; do not merge it with the later bar version.

Use the checks in this order:

1. Define the setup and holding period before generating the stop.
2. Measure adverse excursions for the identical historical rules.
3. Choose the protective-exit rule from strategy evidence; use the loss budget only to size or reject.
4. Normalize the result with one documented ATR definition as a diagnostic.

If the valid stop is wide, reduce the share count. Reject the idea when the resulting payoff, liquidity
or portfolio exposure fails its own rules.

One sentence forces the issue:

```text
Below $____, this setup is wrong because ____________________.
```

Write the ATR definition and multiple beside it. A number without a method is only a loss budget. Do not
attach a probability word such as "likely" unless the adverse-excursion distribution supports it.

## What ATR cannot tell you

ATR looks backward. It can shrink during quiet trading, jump after a shock and miss the next earnings
gap. The correct window also depends on the trade. A one-day reversal and a six-week trend should not
inherit the same multiple.

No fixed ATR rule guarantees a good stop. Test the chosen method on the same setup and holding period,
including gaps and slippage. Without that history, label the multiple a heuristic, not a validated exit.

The ATR and adverse-excursion procedure above is the method defined for this case study. The official
sources below support only the behavior and limits of stop orders; they do not validate that procedure.

Sources: [SEC: Stop, Stop-Limit, and Trailing Stop Orders](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-15); [Investor.gov: Understanding Order Types](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-14)

*The source screen, decision bars and final plan were saved as separate records before the August 13 open.
Those local timestamps establish order inside this case study, not independent external proof. `CLF` was purpose-selected
to show a method conflict, not average performance. Yahoo bars are unadjusted. No named issuer sponsored
or compensated this series; DailyTickers and its authors may hold securities discussed. Educational, not
investment advice.*
