---
title: "A Calendar Pattern Must Survive Its Own Sample"
subtitle: "Seasonality becomes usable only after holdout, cost, and multiple-testing checks."
module_id: "correlation-and-seasonality"
episode_number: 3
source_path: "series/correlations-saisonnalites/part3-saisonnalites/index.html"
---

*Part 3 of 6 in Correlation and Seasonality Without Storytelling.*

"Sell in May and go away" has real numbers behind it. Since 1950, the November-to-April half of the year returned an average 7.1% on the S&P 500 and finished higher in 77% of years. May to October returned 1.8% and finished higher 65% of the time. A gap of 5.3 points, over seventy-five years.

Now count the sample honestly. Seventy-five years means seventy-five observations. Not seventy-five thousand daily returns — seventy-five. Every monthly or seasonal pattern gets exactly one occurrence per year, no matter how much price history sits behind it. The Santa Claus rally, the last five sessions of December plus the first two of January, averaged 1.3% and was positive in 79% of years, which sounds strong until you learn that is 34 hits out of 43 tries.

Small samples are why calendar effects look so convincing and behave so badly.

The January effect is the same story with the same trap. Since 1980 the Russell 2000 averaged 2.7% in January against 0.8% in other months; micro caps 4.1% against 0.6%; large caps only 1.2% against 0.9%. The mechanism is plausible — investors sell losers in December for the tax break and buy back in January, and small, beaten-down shares are the ones getting sold. Plausible is not proof. The effect has faded on large caps since 2000, and it was never uniform across tax regimes.

Then there is the trap that ruins more research than any other: testing everything. Twelve months, five weekdays, eleven sectors, every holiday window, every options-expiration offset. Search that many buckets and something will look brilliant by accident. The week after September's options expiry averages minus 0.8%. Monday averages minus 0.04% while Wednesday averages plus 0.08%. Are those real, or are they what turns up when you slice a long series enough ways?

Answer it before you look, not after.

- Freeze the bucket, the benchmark, the sample period and the exact entry and exit sessions first.
- Use total returns, dividends included, and build the buckets from the exchange's official calendar rather than assuming every weekday is a full session.
- Report the occurrence count, the median, the worst path and the loss frequency, never the average alone.
- Recompute the result with the single biggest observation removed and see whether the effect survives.
- Correct for how many patterns you tested, and keep a final stretch of years that played no part in choosing the rule.
- Log the hypotheses that failed, so next year you remember how wide the search was.

A worked version: someone claims month M is unusually strong for an index. Before touching a spreadsheet, they fix the membership treatment, the total-return source, the start date, the trading costs and the discovery period. Each annual return for M gets compared with the other months. The number is recalculated without its largest year, then tested on the untouched years. If the sign vanishes, if costs eat the difference, or if M was picked only after scanning all twelve, it is not an allocation rule. It is a finding about the past.

Also check that the tradable window still exists. Early closes shorten sessions, holiday windows drift across dates, and the expiry calendar sets when options actually stop trading.

**Limitation:** market seasonality has far fewer independent observations than its long price history suggests. Tax rules change, index membership changes, derivatives listings and market structure change. A pattern can be statistically visible and still be too small, too unstable, or too expensive to trade. Passing a historical test guarantees nothing about the next occurrence.

Sources: [NIST: Detecting Seasonality](https://itl.nist.gov/div898/handbook/pmc/section4/pmc443.htm), [NIST: Multiple Comparisons](https://www.itl.nist.gov/div898/handbook/prc/section4/prc47.htm), [NYSE: Trading Hours and Calendars](https://www.nyse.com/trade/hours-calendars), [Cboe: Options Hours and Calendars](https://www.cboe.com/about/hours/us-options).

Educational, not investment advice.
