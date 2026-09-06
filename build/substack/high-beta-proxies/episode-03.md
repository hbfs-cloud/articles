---
title: "Build and Stress a Beta Hedge"
subtitle: "Size the common-factor leg and keep the residual risk visible"
module_id: "high-beta-proxies"
episode_number: 3
source_path: "series/proxys-haut-beta/part3-strategies-trading/index.html"
---
*Part 3 of 6 in Use High-Beta Proxies Without Getting Trapped.*

::audience non_sub,free_sub
Each part stands on its own. This is 3 of 6 in Use High-Beta Proxies Without Getting Trapped; earlier parts cover the groundwork but you can start here.
::end

Take one Thursday from a worked example. The index fell 1.5%. The stock fell 2.5%. The position made money.

Here is why. Long $100,000 of a stock whose measured beta was 1.8, short $180,000 of the index against it. The long side lost $2,500 that day. The short side gained $2,700. Net, plus $200. The stock dropped less than its slope said it should, and that gap is the only thing this structure is built to collect. Across the full week in that example, the index slipped 0.3% while the stock gained 3.3%: the long made $3,300, the short still added $540, and the pair finished up $3,840.

The construction is one line. Multiply what you hold by the estimated beta, and short that many dollars of the reference. Beta 1.8 on $100,000 means $180,000 short. At the moment you put it on, the fitted market exposure is roughly zero.

![A spread is one trade only while both legs exist](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/spread_legs.png)

Roughly, and only at that moment. Three things are not cancelled.

The leftover, first. Beta is a fitted average, and everything the line failed to explain still sits in the position. Second, the slope drifts. If a rolling 30-day estimate walks from 1.8 to 2.0, the long side is now carrying $200,000 of reference-equivalent exposure against a $180,000 short. You are quietly long $20,000 of the market you thought you had neutralised. Recheck it weekly and resize, or accept an exposure you never chose.

Third, and this is the one that ends accounts: a company event does not care about your hedge. Suppose the stock reports results and falls 15% while the index falls 2%. The long loses $15,000. The short returns $3,600. Net loss $11,400, or 11.4% of the position, on a structure sold to you as market-neutral. It was market-neutral. <mark>It was never company-neutral.</mark> Close the pair before scheduled results rather than discover that arithmetic live.

![One earnings day, in dollars](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/examples/high-beta-proxies_episode-03.png)

A high beta paired with a low R-squared is the warning light. It means the slope is steep and the fit is thin, and a thin fit is exactly the case where the leftover, not the market, drives the outcome. R-squared is not a confidence interval for beta, and it says nothing about how the hedge behaves next month.

**Hedge check**

1. Use matched observations and state the sample size.
1. Require acceptable correlation, R-squared and residual behaviour before entry.
1. Convert beta into dollars on both legs, not percentages.
1. Fix a recalculation schedule and a maximum drift you will tolerate.
1. Reconcile borrow costs, dividends, fees and actual fills.
1. Exit or resize when the relationship leaves the range you tested.

> A beta hedge cancels the part of the move the line explained. Everything else is still yours.

**Limitation:** The short leg is not symmetric. It needs a margin account and borrowed shares, and borrow can turn expensive or vanish at the worst moment. A hedge estimated perfectly on clean data can still fail on a single gap, because the leftover moved and the reference did not.

Sources: [NIST Linear Least Squares Regression](https://www.itl.nist.gov/div898/handbook/pmd/section1/pmd141.htm), [FINRA Short Interest and Short-Sale Mechanics](https://www.finra.org/investors/insights/short-interest).

Educational, not investment advice.
