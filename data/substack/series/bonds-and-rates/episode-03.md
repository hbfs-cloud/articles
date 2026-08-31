---
title: "Build the Yield Curve You Mean"
subtitle: "A maturity spread needs defined endpoints, a date and a data method before it can support a macro view."
module_id: "bonds-and-rates"
episode_number: 3
source_path: "series/obligations-et-taux/part3-yield-curve/index.html"
---

*Part 3 of 6 in Bonds and Rates for Equity Traders.*

Never write “the curve steepened” without naming the two maturities, the observation dates and the direction of both yields. Calculate long-maturity yield minus short-maturity yield, then inspect which leg moved. The spread alone hides whether the market repriced near-term policy, long-term compensation or both.

A yield curve relates yields to maturities for securities of comparable credit quality. The Treasury's official par curve is a modelled curve, not a tape of completed trades. Treasury derives it from indicative bid-side quotations on recently auctioned nominal securities and interpolates fixed maturities. That method makes the series consistent, but an official constant-maturity yield is not necessarily the executable yield on one outstanding bond.

Build a curve note from the official data. Choose a short and a long maturity before looking at the result. Record both yields on the starting date and again on the comparison date. Calculate the spread each time. If the spread widens, identify whether the short yield fell, the long yield rose, or both moved at different speeds. Only then attach a label such as steepening.

For an equity analyst, the decomposition is more useful than the nickname. A rise concentrated at the short end may reflect a different expected path for near-term rates. A move at the long end can also include changes in expected future short rates and the term premium. The New York Fed defines the term premium as compensation for the risk that rates change over the life of a bond, and stresses that it is unobservable and must be estimated. Model estimates are evidence, not measurements.

Use this curve discipline:

- State the data source and whether yields are par, spot or transaction yields.
- Name both maturities and the subtraction order.
- Record each leg, not only the spread.
- Separate observed yields from estimated term-premium components.
- Compare several curve measures before making a broad claim.

Suppose the long-minus-short spread becomes less negative. That is a steepening by arithmetic, but it says little by itself. If the short yield fell sharply while the long yield barely moved, the interpretation differs from a case in which the long yield rose while the short yield held steady. Equity duration, bank margins and discount-rate narratives may respond differently, and none follows mechanically from the label.

Curve inversion has predictive information in some historical models, but it is not a recession clock and does not cause recessions by definition. Federal Reserve research shows that model choice, the level of rates, term premiums and other variables affect the inference. The curve should update a probability assessment, never supply a certain date or a stand-alone equity signal.

Sources: [Treasury yield-curve methodology](https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics/treasury-yield-curve-methodology), [Treasury daily par yields](https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve), [New York Fed term-premium data](https://www.newyorkfed.org/research/data_indicators/term-premia-tabs), [Federal Reserve yield-curve research](https://www.federalreserve.gov/econres/notes/feds-notes/predicting-recession-probabilities-using-the-slope-of-the-yield-curve-20180301.html).

Educational, not investment advice.
