---
title: "How Daily Leverage Compounds"
subtitle: "Reset frequency and return path can dominate the headline multiple."
module_id: "etf-toolkit"
episode_number: 5
source_path: "series/trader-etf/part5-leveraged-options/index.html"
---

*Part 5 of 6 in The ETF Toolkit.*

Read the reset period before using a leveraged or inverse exchange-traded product. If the objective is two times the benchmark's daily return, judge it against one day, not against the benchmark's return over your entire holding period. For any position lasting longer than the reset period, model the sequence of returns. The path can matter more than the endpoint.

Consider a two-day hypothetical. An index starts at 100, rises 10% to 110, then falls 9.09% to roughly 100. It is essentially flat over the two days. A daily 2x fund starts at 100, rises 20% to 120, then falls 18.18%, twice the second day's index move. It ends near 98.18, a loss of about 1.82% before fees and tracking effects.

Nothing malfunctioned in that arithmetic. The product delivered twice each daily move. Daily compounding created a different multi-day result. In a smooth trend, compounding can help; in an alternating path, it can hurt. That is why a long holding period cannot be evaluated by multiplying the benchmark's cumulative return by the leverage factor.

Inverse products have the same reset issue. They can provide a defined tactical exposure without borrowing shares directly, but they are not permanent mirrors of a benchmark. Derivatives, financing, expenses, rebalancing and volatile markets can add further divergence.

Options on ETFs are a separate decision. A put can define premium at risk for its buyer, while a short option can create assignment and margin obligations. The ETF's own structure does not remove the option contract's expiration, volatility and liquidity risks. Combining options with a leveraged ETF layers two nonlinear products.

Run this leveraged-product check:

- Identify the exact benchmark, leverage multiple and reset period.
- Recreate at least one trending path and one alternating path.
- Read the derivatives, financing and counterparty disclosures.
- Set holding horizon and rebalance rule before entry.
- Stress a gap, a wide spread and failure to meet the daily objective.
- If adding options, calculate the combined exposure and maximum obligation.

The numerical example is not a performance forecast. Actual funds subtract expenses and may not track their stated objective perfectly. Some geared products use periods other than one day, so the prospectus governs. A low-volatility trend and a high-volatility range can produce very different outcomes even with the same start and end level.

Leverage is a specification, not a thesis. The product may implement the requested multiple correctly while still producing an outcome the holder did not expect.

Sources: [SEC Leveraged and Inverse ETF Bulletin](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-alerts/sec), [FINRA Exchange-Traded Funds and Products](https://www.finra.org/investors/investing/investment-products/exchange-traded-funds-and-products), [SEC Introduction to Options](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-63).

Educational, not investment advice.
