---
title: "A Quantitative Screen for High-Beta Proxies"
subtitle: "A repeatable test for sensitivity, fit, overlap, and instrument mechanics"
module_id: "high-beta-proxies"
episode_number: 2
source_path: "series/proxys-haut-beta/part2-identifier-proxys/index.html"
---
*Part 2 of 6 in Use High-Beta Proxies Without Getting Trapped.*

GameStop has carried a published beta near 1.8 against the market, alongside a correlation near 0.15. AMC has shown beta near 2.2 with correlation near 0.20. Both look like violent market amplifiers on a screener. Neither is one.

Square those correlations and you see why. Correlation squared, in a simple regression, is the share of the stock's movement the market line accounted for. For 0.15, that is about 2%. Ninety-eight percent of what the stock did came from somewhere else entirely: a squeeze, a filing, a forum. Buy it because you expect the index to rise and you have not bought index exposure. You have bought a lottery ticket that happens to be volatile.

![A fact is not a decision, and a decision is not an order](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/decision_flow.png)

That trap is why a slope alone never qualifies a candidate. A workable screen asks for four things at once: beta above roughly 1.5, correlation above roughly 0.70, enough daily dollar volume to get in and out without paying a spread tax (a common floor is $10 million a day), and options liquid enough to hedge with if you want to. Correlation 0.70 is not a magic number, but it is the point where about half the movement is explained by the reference and half is not. Below it, the stock is mostly running its own life.

Start earlier than the statistics, though. Name the reference exactly. A spot commodity, a futures contract, a fund that holds futures, and a company that digs the stuff out of the ground are four different instruments with four different behaviours. So are an index, its plain ETF, and a fund that resets leverage every day.

Then build a common sample: one return convention, matched timestamps, regression run only on the days both series traded. Report the count after alignment. Pair an asset that trades around the clock with one confined to a narrower session and you manufacture lead-lag effects out of nothing. A big observation count does not repair mismatched clocks.

**The daily-reset arithmetic.** A 3x fund targets three times the benchmark's return each day, and only each day. Suppose the benchmark gains 2% then loses 2%: it ends at 99.96% of where it started, effectively flat. The 3x fund gains 6% then loses 6% and ends at 99.64%, down 0.36%. One pair of days. Repeat that through a choppy year and published estimates put the erosion somewhere around 8% to 15%, before the annual fee, which runs near 0.86% on some of these products. The stated multiple is a daily promise, never a yearly one.

**Proxy screen**

- State the exact reference and what you want the position to express.
- Align adjusted prices, currency, timestamps and return frequency.
- Record beta, correlation, R-squared, overlap and residual volatility.
- Recompute over a shorter window to test whether the number holds still.
- Read the prospectus or the filings before ranking anything.
- Reject a candidate whose mechanics fight your holding period.

**Limitation:** A screen like this cannot see relationships that arrive late or bend. A producer may react a day after the commodity. A foreign listing may close before the reference makes its biggest move. Test a lag only when you can name the reason for it, label it, and keep it. Choosing whichever lag produced the prettiest result is not a test.

Sources: [NIST Linear Least Squares Regression](https://www.itl.nist.gov/div898/handbook/pmd/section1/pmd141.htm), [SEC Investor Bulletin on Leveraged and Inverse ETFs](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-alerts/sec), [CFTC Commodity ETP Advisory](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/CustomerAdvisory_CommodityETPs.htm).

Educational, not investment advice.
