---
title: "Build the Yield Curve You Mean"
subtitle: "A maturity spread needs defined endpoints, a date and a data method before it can support a macro view."
module_id: "bonds-and-rates"
episode_number: 3
source_path: "series/obligations-et-taux/part3-yield-curve/index.html"
---
*Part 3 of 6 in Bonds and Rates for Equity Traders.*

::audience non_sub,free_sub
Each part stands on its own. This is 3 of 6 in Bonds and Rates for Equity Traders; earlier parts cover the groundwork but you can start here.
::end

"The curve steepened" is half a sentence. Which two maturities? Measured on which dates? And which leg actually moved? Long yield minus short yield gives you a spread. <mark>The spread on its own hides whether the market repriced the next twelve months, the next thirty years, or both at once.</mark>

Know what the official curve is first. Treasury's par yield curve is a model, not a tape of completed trades. It is derived from indicative bid-side quotations on recently auctioned securities and interpolated to fixed maturities. That makes the series consistent across time, which is the point. It also means a constant-maturity yield is not necessarily a yield you could execute on any single bond.

Then build the note. Choose the short and the long maturity before you look at the answer, so the conclusion does not choose the inputs. Record both yields on the starting date and again on the comparison date. Compute the spread twice. If it widened, say which leg did it: the short yield fell, the long yield rose, or both moved at different speeds. Only then reach for a word like steepening.

![The three shapes a yield curve takes](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/yield_curve_shapes.png)

Some rough anchors help. In a normal expansion the two-year to ten-year spread has often sat around +100 to +200 basis points. Transitional periods flatten it toward 0 to +50. Inverted stretches have run in the region of minus 50 to minus 100, and the 2022 inversion went deeper still, near minus 100 at its worst, after a hiking cycle of roughly 525 basis points in sixteen months.

The lags are where the label falls apart. August 2019 inversion, recession dated February 2020: six months. May 1998 inversion, recession March 2001: thirty-four months. December 2005 to December 2007: twenty-four. The average sits near a year and a half, with a spread wide enough that "inverted, therefore soon" is not a usable claim.

For equity work the decomposition beats the nickname. A move concentrated at the short end says something about the expected path of near-term policy. A move at the long end mixes expected future short rates with the term premium, meaning the extra compensation investors want for the risk that rates change over the life of a bond. The New York Fed is explicit that this premium is unobservable and must be estimated. The arithmetic behind it is simple: if investors expect short rates to average 3% over ten years while the ten-year sits at 4%, the estimated term premium is about one point. Model output is evidence, not measurement.

Curve discipline:

1. State the data source and whether yields are par, spot or transaction yields.
1. Name both maturities and the subtraction order.
1. Record each leg, not only the spread.
1. Separate observed yields from estimated term-premium components.
1. Check several curve measures before making a broad claim.

Suppose a spread of minus 40 becomes minus 10. Arithmetically that is steepening, and it means very little by itself. A short yield collapsing while the long end sits still is a different world from a long end selling off while the short end holds. Bank margins, equity duration and discount-rate narratives react differently to each, and none of it follows automatically from the label.

Inversion carries predictive information in some historical models. It is not a recession clock and it does not cause anything. Federal Reserve research shows the inference depends on model choice, the level of rates and the term premium. Let the curve update a probability. It cannot supply a date, and it is not a stand-alone equity signal.

> Without both maturities and both legs on the page, a curve label is a nickname, not a finding.

Sources: [Treasury yield-curve methodology](https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics/treasury-yield-curve-methodology), [Treasury daily par yields](https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve), [New York Fed term-premium data](https://www.newyorkfed.org/research/data_indicators/term-premia-tabs), [Federal Reserve yield-curve research](https://www.federalreserve.gov/econres/notes/feds-notes/predicting-recession-probabilities-using-the-slope-of-the-yield-curve-20180301.html).

Educational, not investment advice.
