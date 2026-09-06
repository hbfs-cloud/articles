---
title: "Stress Options With Greeks"
subtitle: "Use Delta, Gamma, Theta and Vega to stress an option, never to promise its next price."
module_id: "options-risk"
episode_number: 2
source_path: "series/options-trading/part2-les-greeks/index.html"
---
*Part 2 of 6 in Options Without the Hidden Risk.*

::audience non_sub,free_sub
Each part stands on its own. This is 2 of 6 in Options Without the Hidden Risk; earlier parts cover the groundwork but you can start here.
::end

Apple sat at $210 the day before earnings. The at-the-money call cost $8.00. Results came out, the stock closed at $215, up 2.4%, exactly the direction the call buyer wanted. The call was worth $6.10. Down $190 per contract, on a correct call.

Nothing broke. Two forces pulled in opposite directions and the bigger one won. The $5 move in the stock added about $2.50 to the option. Implied volatility, the market's guess at how much the stock will swing, fell from 38% to 22% once the news was out, and that took $2.40 back off. Net: a loss.

![Amplification is symmetric](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/high_beta.png)

Greeks are the four dials that let you see this coming. Delta is what the option gains for a $1 move in the stock. Gamma is how fast Delta itself changes. Theta is what one day costs you. Vega is what one point of implied volatility is worth. Each comes out of a pricing model, and each one is only accurate near today's price, today.

Delta also converts options into shares, which is how you find out how big you really are. Five calls at Delta 0.60 is 5 times 100 times 0.60, or 300 deltas: you are behaving like someone holding 300 shares. Three puts at Delta -0.40 leave you short 120 shares. Market makers use exactly this arithmetic in reverse. Sell 10 calls at Delta 0.50, buy 500 shares, and the direction cancels out.

Theta is the dial people underestimate, because it does not tick evenly. On a typical at-the-money option, the daily bleed runs near $0.03 from 90 days out to 60. Between 60 and 30 days it roughly doubles to $0.06. From 30 days to 7 it hits about $0.12, which is $12 a day per contract for standing still. In the last week it can pass $0.25 a day. The clock accelerates as it runs down.

![What one day costs, as expiry approaches](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/examples/options-risk_episode-02.png)

That cost buys you Gamma, and the two are always opposite. Long options pay rent every day and get paid back if the stock moves hard. Short options collect the rent and get hurt when it moves hard. There is no side of that trade where you get both.

Run this before you enter:

1. Record Delta, Gamma, Theta and Vega with the time the quote was taken.
1. Turn each one into whole-position dollars, multiplier and contract count included.
1. Shock the stock up and down, not just the way your thesis points.
1. Test one day of decay, then a volatility rise and a volatility fall.
1. Redo it near the strike and near expiry, where Gamma makes Delta move fastest.

One shortcut to treat carefully: a call with Delta 0.30 is often read as a 30% chance of finishing in the money. That number comes out of the model's assumptions, and it is not the chance of making money. Profit also depends on what you paid, what the spread costs and when you get out.

The deeper limitation is that Greeks describe small steps around where things stand right now. A gap, a halt, a wide spread or a volatility repricing like Apple's 16-point drop leaves the estimate behind. <mark>Use the dials to expose what can hurt you, not to manufacture a forecast.</mark>

Sources: [OIC Volatility and the Greeks](https://prd-web.optionseducation.org/advancedconcepts/volatility-the-greeks), [OIC Delta](https://www.optionseducation.org/advancedconcepts/delta), [OIC Gamma](https://www.optionseducation.org/advancedconcepts/gamma), [OIC Vega](https://www.optionseducation.org/advancedconcepts/vega).

Educational, not investment advice.
