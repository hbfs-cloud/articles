---
title: "Map Event Breakevens From the Premium"
subtitle: "Straddles, strangles and condors require a payoff test before any event narrative."
module_id: "options-risk"
episode_number: 5
source_path: "series/options-trading/part5-strategies-avancees/index.html"
---

*Part 5 of 6 in Options Without the Hidden Risk.*

For an event trade, calculate the expiration breakevens before deciding that options imply a “big move.” The combined premium is a hurdle paid or received, not a forecast that the underlying will travel that distance. Direction, timing, implied-volatility repricing and the exit rule all affect the result.

A long straddle buys a call and a put with the same strike and expiration. Take a hypothetical $100 strike, with the call priced at $4.50 and the put at $3.50. Total premium is $8 per share, or $800 for one standard pair. At expiration, the gross breakevens are $108 and $92. A move to $106 sounds meaningful, but the call would have $6 of intrinsic value and the put would expire worthless. The position would still lose $2 per share before costs. At $112, intrinsic value would be $12, leaving a $4-per-share gross profit.

A strangle lowers the initial premium by using an out-of-the-money call and put, but it pushes the breakevens farther apart. An iron condor takes the opposite broad view: it sells an inner call spread and put spread, collecting a credit while using outer wings to cap expiration loss. Its best outcome requires the underlying to remain within a range. The credit is limited; a break through either side can realize the larger defined loss.

Implied volatility complicates every event structure. Long straddles and strangles generally benefit from higher implied volatility and suffer when it falls, all else equal. Condors generally have the opposite exposure. After a scheduled announcement, uncertainty can collapse even when the stock moves in the expected direction. A long-volatility position can therefore lose despite being directionally right.

Run this event-volatility check:

- Add all premiums and calculate both expiration breakevens.
- Compare the maximum loss with the account's event-risk budget.
- Record Theta and Vega for the whole position, not one leg.
- Define the exit time: before the event, after it, or at expiration.
- Stress a smaller move, a delayed move and a volatility decline.

There is no universal way to convert one option chain into a reliable probability of the next price. Quotes can be stale, spreads can be wide, and skew means call and put volatility may differ. The simple straddle sum also ignores rates, dividends and the possibility of closing before expiration.

Use the implied move as a scenario boundary. It can organize the payoff map, but it does not tell you which path will occur or whether the premium is cheap.

Sources: [OIC Long Straddle](https://www.optionseducation.org/strategies/all-strategies/long-straddle), [OIC Iron Condor](https://www.optionseducation.org/strategies/all-strategies/short-condor), [OIC Vega](https://www.optionseducation.org/advancedconcepts/vega), [OCC Options Disclosure Document](https://www.theocc.com/company-information/documents-and-archives/options-disclosure-document).

Educational, not investment advice.
