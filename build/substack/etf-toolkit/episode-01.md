---
title: "Identify the Exposure Inside the ETF Wrapper"
subtitle: "Start with the portfolio, legal structure, trading cost and tracking method behind the ticker."
module_id: "etf-toolkit"
episode_number: 1
source_path: "series/trader-etf/part1-comprendre-etf/index.html"
---
*Part 1 of 6 in The ETF Toolkit.*

SPY and VOO both follow the S&P 500. SPY charges 0.09% a year, VOO charges 0.03%. On $100,000 that is $60 a year, which sounds like nothing, and roughly $5,000 over thirty years, which is not nothing. Same index, different wrapper, different outcome. The wrapper is the subject of this lesson.

![A fee compounds against you the way returns compound for you](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/fee_drag.png)

An ETF share is a slice of a fund's portfolio, traded on an exchange like a stock. Large institutions, called authorized participants, can hand the fund a basket of the real shares and receive new ETF shares, or do the reverse. That machinery is why the market price usually tracks the fund's underlying value closely. Usually is doing work in that sentence.

Net asset value, or NAV, is what the fund owns minus what it owes, divided by shares outstanding. It is generally struck once a day, after the close. The exchange price moves every second. Above NAV is a premium, below is a discount, and for big liquid funds the gap runs near 0.01%. It widens when the underlying market is shut or the securities are hard to value. In March 2020 the high-yield bond fund HYG traded around 5% below its NAV for several days running.

<mark>Costs come in three parts and only one is advertised.</mark> The expense ratio you can read off the page. The bid-ask spread you pay on every round trip: SPY quotes about a penny wide on a share near $600, roughly 0.002%, while a thinly traded country fund can quote $0.30 wide, or 1.5%. Anything above 0.30% deserves a second look before you trade it twice. The third part is tracking difference, the gap between what the fund returned and what its index returned over the same window. Fees feed it, but so do sampling, trading costs, dividend timing, taxes and securities lending. Occasionally it comes out negative and the fund beats its index.

Concentration is the other thing the ticker hides. QQQ's ten largest holdings make up about 52% of the fund and roughly half of it sits in technology. SPY's top ten are near 35%, technology around 30%. Both are labelled diversified. They are not diversified in the same way, and they will not fail in the same way.

Give any new ticker five minutes:

1. Check what it legally is: a registered fund, an ETN, a commodity pool, something else.
1. Read the objective and how the index is actually built.
1. Look at the holdings, the top-ten weight and whether it holds the assets or a swap.
1. Check the expense ratio, the typical spread and the history of premiums or discounts.
1. Compare fund and index returns over identical dates, in the same currency.
1. Read the terms covering creation, redemption, closure and liquidation.

If the fund uses a swap rather than owning the shares, a bank promises the index return. European UCITS rules cap that counterparty exposure at 10% of NAV, and collateral usually stands behind it, so the risk is small. Small is not zero, as 2008 reminded everyone.

Screen volume is a weak liquidity test on its own. A fund trading $5 million a day with a 0.05% spread is perfectly usable, because the liquidity really lives in the underlying holdings and in the participants' ability to hedge them. Judge spread, depth, your own order size and the underlying market together.

The limitation is structural. Published documents are snapshots: holdings shift, spreads move through the day, NAV is an end-of-day figure. A prospectus explains design and risk. It cannot promise your fill or next year's tracking.

> The ticker tells you which index. It cannot tell you what the wrapper charges, what it hides, or how much of it is one bet.

Sources: [SEC ETF Investor Bulletin](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-24), [SEC Fund and ETF Fees Bulletin](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins/mutual-fund-and-etf-fees-and-expenses-investor-bulletin), [FINRA Exchange-Traded Funds and Products](https://www.finra.org/investors/investing/investment-products/exchange-traded-funds-and-products).

Educational, not investment advice.
