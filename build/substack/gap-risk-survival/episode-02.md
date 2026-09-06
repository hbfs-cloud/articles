---
title: "The Same Gap Means Different Risk Across Instruments"
subtitle: "Trading hours, product structure, leverage, and settlement determine the actual exposure."
module_id: "gap-risk-survival"
episode_number: 2
source_path: "series/risque-de-gap/part2-gap-par-actif/index.html"
---
*Part 2 of 5 in Survive Gap Risk.*

Between 19 February and 23 March 2020 the Nasdaq-100 tracker QQQ fell 28%. TQQQ, which aims to deliver three times the index's daily move, fell 69%. On 16 March alone QQQ opened 9.3% lower and TQQQ opened 27.9% lower. A $100,000 stake became roughly $31,000 in 23 trading sessions — and climbing back from −69% requires +223%, not +69%.

Same thesis. Same index. Wildly different survival odds. Stress the instrument you own, not the chart you watch.

![Two orders, two different ways to be wrong](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/stop_vs_stop_limit.png)

Start with plain funds. On an ordinary night a broad tracker moves a fraction of a percent, a narrower index a little more, small caps more again — measure it on the funds you actually hold rather than trusting a figure someone quoted. A fund holding 500 companies dilutes any single blow-up. But in a systemic shock everything moves together and dilution stops helping: in March 2020 the broad trackers all gapped down together, by high single digits, on the same mornings. Read the prospectus and issuer data for holdings, spread, premiums or discounts, and creation-redemption risk. A fund's exchange price can trade above or below net asset value, and some holdings may be closed while it keeps trading. Leveraged and inverse funds target a stated daily result; over longer stretches, especially choppy ones, the outcome drifts far from that multiple.

Single companies concentrate the danger and publish the schedule. Earnings land four times a year, after the close or before the open, and the size of the reaction scales with how much of the story is still unproven. Two measured examples, opening print against the previous close: Netflix closed at 34.86 on 19 April 2022 and opened at 24.52 the next morning after losing subscribers for the first time in a decade — **29.7% lower at the open**, and 35.1% lower by the close. Nvidia went the other way on 25 May 2023: 30.54 the night before, **38.52 at the open, up 26.1%**, closing +24.4%. Note that the opening gap and the day's change disagree in both cases, and in opposite directions. And the calendar does not cover everything — a guidance letter can arrive on a date nobody had in their diary.

Options add a clock. Many contracts trade in limited hours, so the shares can reprice while the option market is shut and you cannot adjust. Strike, expiration, implied volatility, spread, exercise and assignment rules all feed the result — the stock's percentage gap is not the option's. Before an event, price the expected move: if the at-the-money straddle costs 8% of the share price, that is what the market is paying for.

Futures and retail foreign exchange bring contract-specific sessions and heavy leverage. On 15 January 2015 the Swiss National Bank abandoned its 1.20 floor without warning; EUR/CHF went from 1.2010 to about 0.8500 in seconds, near −30%. At 100:1 leverage a $10,000 position implies a $300,000 loss. One broker failed, another lost $225 million, and more than 100,000 retail accounts went negative. Digital assets trade around the clock, but continuous timestamps do not mean continuous liquidity: CME bitcoin futures close Friday evening and reopen Sunday, and the spot market keeps moving in between. The weekend gap on the futures contract is a recurring feature, not an occasional accident — check the contract specification for the exact halt, and measure the gap distribution yourself before you size around it.

**Instrument check**

- Read the prospectus, contract, or options disclosure for the thing you are actually buying.
- Map its regular, extended, and closed trading periods.
- Identify embedded leverage, daily reset, expiry, and assignment.
- Stress the executable price, fees, and margin response.
- Test venue and custody access before the event, not during it.

Run one thesis through stock, sector fund, and call option, and write for each: the first session you could exit, a stressed price, maximum capital loss, margin response, spread and depth, any expiry or reset. Reject the expression whose mechanics you cannot model. The smallest cash outlay is not the smallest risk.

**Limitation:** structure does not make outcomes predictable. Fund arbitrage can break, option markets can open wide, and a liquid futures contract can gap straight after a trading pause. Official disclosures explain mechanics and risks; they do not forecast your next loss.

Sources: [Investor.gov: Exchange-Traded Funds](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-24), [Investor.gov: Leveraged and Inverse ETFs](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-alerts/sec), [OCC: Characteristics and Risks of Standardized Options](https://www.theocc.com/company-information/documents-and-archives/options-disclosure-document), [CFTC: Before You Trade](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/areyouabouttotrade.html).

Educational, not investment advice.
