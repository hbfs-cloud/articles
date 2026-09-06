---
title: "Map Event Breakevens From the Premium"
subtitle: "Straddles, strangles and condors require a payoff test before any event narrative."
module_id: "options-risk"
episode_number: 5
source_path: "series/options-trading/part5-strategies-avancees/index.html"
---
*Part 5 of 6 in Options Without the Hidden Risk.*

::audience non_sub,free_sub
Each part stands on its own. This is 5 of 6 in Options Without the Hidden Risk; earlier parts cover the groundwork but you can start here.
::end

"The options are pricing in a big move" is a sentence about a price, not a prediction. Do the arithmetic before you believe it.

Nvidia at $140, earnings tomorrow. The $140 call costs $6.00, the $140 put costs $5.50. Buy both, that is a straddle, and it costs $11.50 per share, $1,150 for the pair. You now need Nvidia above $151.50 or below $128.50 at expiry just to get your money back. That is 8.2% in either direction. Divide the straddle price by the share price and you get the same 8.2%: the implied move. <mark>It is the hurdle you paid for, nothing more.</mark>

Nvidia jumps 6% overnight. Feels enormous. You still lose money.

![What a reward/risk ratio actually demands of you](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/rr_vs_winrate.png)

A strangle makes the ticket cheaper and the hurdle taller. Out-of-the-money strikes on both sides bring the same trade down to about $650, but the breakevens spread out to $123.50 and $156.50, so now you need 11.8%. Cheaper is not easier.

An iron condor sells the same idea. SPY at $550: sell the $535 put for $3.00, buy the $525 put for $1.50, sell the $565 call for $2.50, buy the $575 call for $1.00. Four legs, $300 collected. You keep it all if SPY finishes between $535 and $565. If it breaks one side, you lose the $10 width minus the $3 credit, or $700. Only one side can lose. The good outcome is small and frequent; the bad one is larger and arrives whole.

Volatility decides which of these works, and it moves hardest right after the event. Long straddles and strangles want implied volatility up and suffer when it drops. Condors want the opposite. The day after an announcement the uncertainty is spent, implied volatility collapses, and a long-volatility position can be directionally right and still red.

So compare the two numbers before you choose a side. If Apple's implied move is 5% and the average move across the last eight earnings was 3.2%, the market is asking 56% more than history delivered, and history stayed inside 5% on six of those eight. That argues for selling premium, not buying it. When the implied move sits below the historical one, the argument flips.

Run this event check:

1. Add every premium and write both expiry breakevens down before entering.
1. Set the maximum loss against what the account can lose on one event.
1. Record Theta and Vega for the whole position, never one leg alone.
1. Fix the exit time now: before the event, right after it, or at expiry.
1. Test a smaller move, a late move and a fall in implied volatility.

Never sell a naked straddle or strangle to collect the credit. James Cordier's fund ran short natural gas strangles until a single 18% day in 2018 wiped out more than $150 million. Defined-risk wings exist for that day.

The limitation runs deeper than any of these structures. No option chain converts cleanly into a reliable probability of the next price. Quotes go stale, spreads widen exactly when you need them tight, and skew means calls and puts carry different volatility. Adding two premiums together also ignores rates, dividends and the fact that most positions get closed early. Treat the implied move as the edge of a map, not a forecast of where the road goes.

Sources: [OIC Long Straddle](https://www.optionseducation.org/strategies/all-strategies/long-straddle), [OIC Iron Condor](https://www.optionseducation.org/strategies/all-strategies/short-condor), [OIC Vega](https://www.optionseducation.org/advancedconcepts/vega), [OCC Options Disclosure Document](https://www.theocc.com/company-information/documents-and-archives/options-disclosure-document).

Educational, not investment advice.
