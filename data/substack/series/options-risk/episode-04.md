---
title: "A Spread Is One Trade Only If Every Leg Is Controlled"
subtitle: "Defined-risk payoff diagrams can hide execution, assignment and expiration problems."
module_id: "options-risk"
episode_number: 4
source_path: "series/options-trading/part4-spreads/index.html"
---

*Part 4 of 6 in Options Without the Hidden Risk.*

A spread is two options bought and sold together, and it is one trade only while both legs behave. Price it as one thing, then ask what happens when it stops being one thing.

Apple at $210, and you want the move to $225. Buy the $210 call for $6.00, sell the $225 call for $1.50. You paid $4.50 net, so $450 leaves the account. Maximum loss is that $450, if Apple ends below $210 and both calls die. Maximum gain is the $15 gap between strikes minus the $4.50 you paid, so $1,050. You break even at $214.50.

Compare that to simply buying the $210 call for $6.00. At $225 the spread pays $1,050 and the lone call pays $900. At $240 the spread still pays $1,050 while the call pays $2,400. You sold the tail to cut the cost by 25% and to make the likely outcome pay better. Real exchange, not a free improvement.

Credit spreads turn the cash around. SPY at $550: sell the $535 put for $4.00, buy the $525 put for $2.00, and $200 lands in the account. If SPY holds above $535, you keep all of it. If it breaks below $525, you lose the $10 width minus the $2 credit, or $800. Risk $800 to make $200. That is the deal, and the $200 is not income earned on day one. It is cash held against an open obligation.

Calendars add a second expiry, which adds a second problem. Amazon at $200: sell the 15-day $200 call for $4.00, buy the 45-day $200 call for $7.00, net cost $300. If Amazon is still near $200 in 15 days, the short call dies, the long call is worth roughly $500, and you clear about $200. If Amazon runs to $215, the two legs nearly offset and you lose around $200. If it falls to $185, the long call decays to about $150 and the loss is similar. The short leg can also be assigned before it expires, leaving you holding the long leg alone.

That mismatch is worse in the "poor man's covered call". Microsoft at $420: buy the deep $380 call, 120 days out, for $48.00, and sell the 30-day $435 call for $4.00. Capital tied up is $4,400 against $42,000 for 100 real shares, an 89% saving. The $380 call has a Delta near 0.85, so it acts like 85 shares. It is not 85 shares. It expires, its time value bleeds, and it will not settle a delivery obligation the way stock in the account does.

Run this before the ticket goes in:

- Send it as one multi-leg order at a net price whenever the broker allows.
- Confirm strike, expiry, quantity and exercise style on every leg separately.
- Recalculate the payoff after commissions and a realistic bid-ask haircut.
- Decide the closing date in advance, especially near a short strike.
- Stress an early assignment, and stress one leg filling while the other does not.

Expiry near a short strike is the specific counter-case. Exercise and assignment outcomes may not be settled until processing finishes, which means you can be short shares on Monday without knowing it on Friday. Closing early removes that, at the cost of paying a spread that is often wide.

Every figure here assumes matching multipliers, both legs intact, and settlement at expiry. Adjusted contracts, cash-settled products and a broken leg all break the formula. Read the specification, not the strategy name.

Sources: [OIC Bull Call Spread](https://www.optionseducation.org/strategies/all-strategies/bull-call-spread-debit-call-spread), [OIC Exercising Options](https://prd-web.optionseducation.org/optionsoverview/exercising-options), [OCC Options Disclosure Document](https://www.theocc.com/company-information/documents-and-archives/options-disclosure-document).

Educational, not investment advice.
