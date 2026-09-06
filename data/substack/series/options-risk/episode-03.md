---
title: "Option Income Is a Stock Obligation in Disguise"
subtitle: "Covered calls, protective puts and cash-secured puts make sense only after the stock outcome is acceptable."
module_id: "options-risk"
episode_number: 3
source_path: "series/options-trading/part3-strategies-base/index.html"
---

*Part 3 of 6 in Options Without the Hidden Risk.*

Every one of these trades is a promise about shares, wearing a premium as a disguise. Decide whether you accept the share outcome first. The premium is the last thing to look at, not the first.

Take the covered call. You own 100 Apple at $210 and sell the $215 call, 30 days out, for $3.00. That is $300 in your account today. If Apple sits still at $210, the $300 is yours, up 1.4% for the month. If it drifts to $220 you keep the $300 and the $1,000 of stock gain. Fine so far.

Now the two ends. Apple runs to $240: the shares gained $3,000, the short call loses $1,200 because you must sell at $215, and you finish at $1,800 instead of $3,300. Apple slips to $200: you are down $700 rather than $1,000. That $300 is a thin blanket, and it never gets thicker. If the shares went to zero, $300 would be all you had against a $21,000 loss. The premium trims the downside. It does not cover it.

A protective put buys the opposite shape, and you pay cash for it. You hold 100 Microsoft at $420, earnings are coming, and you buy the $400 put for $5.00, or $500. Your worst case is now fixed: $420 minus $400 plus the $5 premium, times 100, is $2,500. Microsoft crashes to $320 and you still lose $2,500. Without the put that day costs $10,000. The insurance ran 1.2% of the position for one month, and if nothing goes wrong the $500 is simply spent.

Cash-secured puts come at the problem from underneath. You like Google at $175 but not at that price, so you sell the $165 put for $2.50 and set aside $16,500. Assigned, you own the shares at an effective $162.50, about 7% below where it traded. Not assigned, you keep the $250. The trap is on the third branch: Google at $140 still puts the shares in your account at $165, a paper loss of $2,250. The $250 was the maximum you could earn, never the maximum you could lose.

A collar staples the two together. Own 100 Nvidia at $140, buy the $130 put for $3.00, sell the $155 call for $3.00, and the premiums cancel. Zero cost, in a sense. What you actually bought is a tunnel: you cannot lose more than $1,000 or make more than $1,500. Nvidia at $170 pays you the same $1,500 as Nvidia at $155. Free is the wrong word for a trade that hands away everything above the call strike.

Before any stock-plus-option structure:

- Write the exact share obligation triggered if the short leg is assigned.
- Work out the effective purchase or sale price after the premium.
- Show the stock loss at zero, next to the option profit, on the same page.
- Check earnings dates, dividend dates and early-assignment exposure.
- Decide now whether each leg gets closed, exercised, or left to expire.

Never sell a put on a company you would not want to own at that strike. Premium collected on a stock you dislike buys you a position in a stock you dislike, at the worst possible moment.

The limitation is that every number above is an expiry number. Volatility moves in between, a protective put can be sold early, a covered call can be assigned early, and brokers and tax rules differ. The shape of the payoff is knowable. The path is not.

Sources: [OIC Strategy Library](https://www.optionseducation.org/strategies/all-strategies-en), [OIC Cash-Secured Put](https://www.optionseducation.org/strategies/all-strategies/cash-secured-put), [OIC Exercising Options](https://prd-web.optionseducation.org/optionsoverview/exercising-options), [OCC Options Disclosure Document](https://www.theocc.com/company-information/documents-and-archives/options-disclosure-document).

Educational, not investment advice.
