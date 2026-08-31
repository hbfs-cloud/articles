---
title: "A Spread Is One Trade Only If Every Leg Is Controlled"
subtitle: "Defined-risk payoff diagrams can hide execution, assignment and expiration problems."
module_id: "options-risk"
episode_number: 4
source_path: "series/options-trading/part4-spreads/index.html"
---

*Part 4 of 6 in Options Without the Hidden Risk.*

Before sending a spread, calculate the net debit or credit, maximum gain, maximum loss and expiration breakeven from all legs together. Then write what happens if only one leg fills or one short leg is assigned. “Defined risk” describes the intended completed position, not every state encountered while entering, holding or exiting it.

Consider a hypothetical bull call spread with the same expiration: buy a $50 call for $4 and sell a $55 call for $2. The net debit is $2 per share, or $200 for a standard 100-share contract pair. At expiration, maximum loss is the $200 debit when both calls expire worthless. Maximum gross gain is the $5 strike width minus the $2 debit, or $300. Breakeven is $52.

The cheaper entry has a cost: upside stops growing above $55. A standalone long call would retain more upside, while the spread reduces premium at risk. That is the real exchange, not a free improvement.

Credit spreads invert the cash timing. A bear call spread, for example, receives a credit by selling a lower-strike call and buying a higher-strike call. At expiration, maximum loss is the strike width minus the credit received. The opening credit is not income earned on day one; it is cash received against an open obligation.

Calendars and diagonals add another variable because expirations differ. The near-term short option may expire or be assigned while the longer-term option remains open. A long-dated option is not identical to owning shares: its Delta changes, it has time value, and it may not cover a share-delivery obligation in the way the account holder expects. Broker margin and exercise procedures matter.

Use this spread ticket check:

- Enter the position as a multi-leg order when possible and set a net price.
- Confirm strikes, expirations, quantities and option style for every leg.
- Calculate payoff after commissions and realistic bid-ask slippage.
- Define the close rule before expiration, especially near a short strike.
- Stress an early assignment and a failed fill on one leg.

Expiration creates a specific counter-case. If the underlying finishes near a short strike, exercise and assignment outcomes may be uncertain until processing is complete. Closing the spread before expiration can reduce that uncertainty, but it may require paying a wide market spread.

The formulas above assume equal contract multipliers, a completed position and expiration settlement. Adjusted contracts, cash-settled products, early exercise and broken-leg execution can change the result. Read the specifications instead of relying on the strategy name.

Sources: [OIC Bull Call Spread](https://www.optionseducation.org/strategies/all-strategies/bull-call-spread-debit-call-spread), [OIC Exercising Options](https://prd-web.optionseducation.org/optionsoverview/exercising-options), [OCC Options Disclosure Document](https://www.theocc.com/company-information/documents-and-archives/options-disclosure-document).

Educational, not investment advice.
