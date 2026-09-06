---
title: "Estimate Beta With Its Full Sample"
subtitle: "Measure sensitivity without turning a regression into a promise"
module_id: "high-beta-proxies"
episode_number: 1
source_path: "series/proxys-haut-beta/part1-comprendre-beta/index.html"
---
*Part 1 of 6 in Use High-Beta Proxies Without Getting Trapped.*

One widely cited estimate put Nvidia's beta against the market near 1.2 in 2020 and near 1.8 in 2024. Same company. Same method. The number moved because the sample moved.

That is the first thing to understand about beta. Beta is a slope. You take the market's daily percentage moves, you take your stock's daily percentage moves, you plot one against the other, and you draw the line that fits best. The steepness of that line is beta. A beta of 1.0 means the stock has historically moved about like the market. A beta of 1.8 means it has moved about 1.8 times as far, up and down both.

![Amplification is symmetric](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/high_beta.png)

<mark>It is a measurement of the past, not a promise about tomorrow.</mark>

So before you write a beta down anywhere, write down four things beside it: which reference you measured against, whether you used daily or weekly returns, which window, and how many days the two series actually share. A beta with no window attached is decoration. A one-year window is roughly 252 trading days, two years about 504, five years about 1,260. The longer window is steadier and slower to notice that something changed. The shorter one is quicker and more easily hijacked by a single bad week.

**Beta is two things multiplied.** The slope equals the correlation between the two assets, multiplied by the ratio of their volatilities. Correlation says whether they move together at all, on a scale from -1 to +1. Volatility says how violently each one moves. Multiply them and you get beta, which means a stock can post a big beta purely by being wild, even when it barely tracks the market.

**Worked reading.** Published estimates for two large US stocks against the S&P 500 illustrate it. One showed beta 1.80 with correlation 0.85. The other showed beta 2.00 with correlation 0.45. In a simple one-predictor regression, squaring the correlation gives R-squared, the share of the stock's in-sample movement the fitted line accounted for: 0.72 for the first, 0.20 for the second. The second name has the steeper slope and the flimsier relationship. Roughly four fifths of what it did had nothing to do with the index. Note what R-squared is not. It is not a 72% chance of anything, and it proves no cause.

Rolling estimates expose the rest. Recompute beta every day over a moving 90-day window and you get a line instead of a number. Published rolling estimates for Tesla have swung between roughly 0.8 and 2.5 depending on the period. A proxy whose slope wanders like that is not measuring the market. It is measuring itself.

**Beta report**

1. Line both return series up on exactly the same dates.
1. Use one currency, one frequency, one return convention.
1. Record beta, correlation, R-squared, alpha and the shared-day count together.
1. Plot the rolling estimate and check the leftovers, not just the headline slope.
1. Throw out any calculation built on stale prices or mismatched sessions.

**Limitation:** A beta measured in calm trading does not survive earnings, financing stress, a halt or a volatility shock unchanged. Confidence intervals and out-of-sample tests will show you how uncertain the number is. Nothing makes it hold still.

Sources: [NIST Linear Least Squares Regression](https://www.itl.nist.gov/div898/handbook/pmd/section1/pmd141.htm), [NIST Correlation Reference](https://www.itl.nist.gov/div898/software/dataplot/refman2/ch2/correlat.pdf).

Educational, not investment advice.
