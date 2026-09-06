---
title: "Five Contract Fields That Control the Payoff"
subtitle: "Rights, obligations, settlement and the deliverable matter before any bullish or bearish view."
module_id: "options-risk"
episode_number: 1
source_path: "series/options-trading/part1-fondamentaux/index.html"
---
*Part 1 of 6 in Options Without the Hidden Risk.*

Five fields decide what an option can pay you: the underlying, the strike, the expiration, the multiplier and the deliverable. Read them off the contract page. A stock you know well can have options you do not.

Start with the multiplier, because that is where the money hides. A quote of $4.50 is per share. One standard US equity contract covers 100 shares, so the ticket is $450, not $4.50. Skip that step and you size the position a hundred times too small in your head.

![What a bought option can and cannot cost you](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/option_payoff.png)

Here is the full example from the source lesson. Apple trades at $210. You buy one call, strike $215, expiring in 30 days, for $4.50. You have bought the right to buy 100 shares at $215 any time until then. Nobody can force you to. Your breakeven at expiry is $219.50, the strike plus the premium, so Apple has to climb 4.5% before you are even.

Look at what expiry actually does:

- At $230 the call is worth $15.00 per share, $1,500 in cash. You made $1,050.
- At $225 it is worth $1,000. You made $550.
- At $219.50 you get your $450 back and not a cent more.
- At $215, a 2.4% gain in the stock, the call expires worthless and the whole $450 is gone.

Being right on direction and still losing everything is ordinary here.

The seller lives in a different world. Whoever sold you that call took the $450 and took an obligation with it. If you exercise, they must deliver 100 Apple shares at $215 whatever the market says. A seller who already owns the shares has them ready, but still eats the full downside of the stock and hands over every dollar above $215. A seller who owns nothing has no ceiling on the loss, because there is no ceiling on the price.

Premium comes in two parts, and the chain shows it plainly. With Apple at $210, the $190 call cost $23.50: $20.00 of that is value you could cash in today, $3.50 is time. The $210 call cost $6.50 and every cent of it was time. The $230 call cost $0.90, all time, and time runs out.

Which explains why the cheap one is rarely the bargain. That $230 call needs Apple up nearly 10% just to break even. The $190 call gains on the first cent of upside. Price reflects the odds; it is not a discount.

Before you send the order, check the contract:

- Confirm the underlying, strike, expiration, multiplier and what gets delivered.
- Note whether it can be exercised early or only at expiry, and whether it settles in shares or cash.
- Turn the quoted premium into dollars: quote times 100 times contracts.
- Write out the right you bought, or the obligation you sold, in one plain sentence.
- Work out the breakeven and the worst outcome the contract permits.

Corporate actions can rewrite the strike and the deliverable. Index and ETF options often follow different exercise and settlement rules than single stocks. One rule carried across every chain will eventually be the wrong rule.

The limitation: this arithmetic describes expiry only. It cannot tell you what the option is worth to sell tomorrow morning. Implied volatility, remaining days, rates, dividends and the bid-ask spread all move that price. The contract check stops category errors. It does not forecast anything.

Sources: [OIC Options Basics](https://www.optionseducation.org/optionsoverview/options-basics), [OIC Exercising Options](https://prd-web.optionseducation.org/optionsoverview/exercising-options), [OCC Options Disclosure Document](https://www.theocc.com/company-information/documents-and-archives/options-disclosure-document).

Educational, not investment advice.
