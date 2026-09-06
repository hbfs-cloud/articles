---
title: "Duration Turns a Rate View Into Price Risk"
subtitle: "Price and yield move in opposite directions, but sensitivity depends on the bond's cash-flow pattern."
module_id: "bonds-and-rates"
episode_number: 2
source_path: "series/obligations-et-taux/part2-prix-et-rendement/index.html"
---
*Part 2 of 6 in Bonds and Rates for Equity Traders.*

::audience non_sub,free_sub
Each part stands on its own. This is 2 of 6 in Bonds and Rates for Equity Traders; earlier parts cover the groundwork but you can start here.
::end

Take a ten-year bond, $1,000 face value, 4% coupon, bought at par. Market yields rise to 5% and the price drops to roughly $922, down 7.8%. Yields rise to 6% instead: about $852, down 14.8%. Now run it the other way. Yields fall to 3% and the price goes to about $1,085, up 8.5%.

![One bond, four market yields](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/examples/bonds-and-rates_episode-02.png)

Compare the two one-point moves. Down 7.8% against up 8.5%. Not symmetric. That extra sliver on the upside is convexity, and it comes free with an ordinary bond.

The mechanism is arithmetic, not economics. Your coupon is frozen at 4%. If new bonds pay 5%, nobody buys yours at par, so the price falls until the buyer's return matches the market. When yields drop, that frozen 4% becomes more valuable and the price climbs. Nothing about the contract changed.

![Amplification is symmetric](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/high_beta.png)

Duration puts a number on the sensitivity. <mark>The working rule: percentage price change equals minus duration multiplied by the yield change.</mark> Duration 7, yields up one point, expect roughly minus 7%. Desks scale that into dollars. A $10 million book with duration 7 loses about $7,000 per basis point of yield. That figure, the DV01, is how a rates position gets sized in practice.

Match the measure to the instrument. Modified duration is fine for fixed cash flows. Effective duration is the one to use when calls or mortgage prepayments can move the payment dates around. Longer maturities push duration up. Bigger coupons pull it down, because more money arrives sooner. A ten-year zero-coupon bond has duration 10, since there is exactly one payment and it lands at the end. A two-year 4% coupon bond sits near 1.9.

Funds inherit every bit of this. A short-maturity Treasury fund can carry duration near 2. A twenty-year-plus Treasury fund runs near 17. The same one-point move that costs the short fund about 2% costs the long one roughly 17%, and plenty of people who thought they held the defensive leg of a portfolio learned that when policy rates went from near zero to around 5%.

So run a relative stress test on two funds you actually hold. From each official fact sheet or prospectus, record effective duration, the yield measure quoted, credit mix, maturity profile and option exposure. Apply the same one-point rise to both durations. The larger duration produces the larger estimated decline. Repeat with a one-point fall. Then ask the harder question: could credit spreads or a twist in the curve swamp the pure rate effect? No forecast is needed. You are measuring risk you already own.

Before taking duration exposure:

1. Verify whether the published figure is effective or modified duration.
1. Pair duration with the exact yield and benchmark used.
1. Check credit quality and embedded options.
1. Test both a rise and a fall in yields.
1. Add income, expenses and the intended holding period.

Holding an individual bond to maturity does make interim price marks less relevant, but only if the issuer pays as promised, you do not sell, and the bond is not called. A fund makes no such promise. There is no personal maturity date and the portfolio keeps turning over.

Duration has a firm limitation. It is a straight-line estimate for small yield moves and one specified curve shift. Large moves, changing spreads, nonparallel shifts, illiquidity and option exercise can each produce a materially different price. It measures rate sensitivity, not the full risk of the position.

Sources: [FINRA on interest-rate changes and duration](https://www.finra.org/investors/alerts/duration-what-interest-rate-hike-could-do-your-bond-portfolio), [FINRA bond yield guide](https://www.finra.org/investors/insights/bond-yield-return), [Investor.gov interest-rate risk bulletin](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-86), [Investor.gov bond funds](https://www.investor.gov/introduction-investing/investing-basics/glossary/bond-funds-and-income-funds).

Educational, not investment advice.
