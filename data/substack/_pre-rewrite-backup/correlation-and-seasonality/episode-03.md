---
title: "A Calendar Pattern Must Survive Its Own Sample"
subtitle: "Seasonality becomes usable only after holdout, cost, and multiple-testing checks."
module_id: "correlation-and-seasonality"
episode_number: 3
source_path: "series/correlations-saisonnalites/part3-saisonnalites/index.html"
---

*Part 3 of 6 in Correlation and Seasonality Without Storytelling.*

Do not trade a named calendar effect until its definition, sample, comparison group, and holdout test are frozen. “Sell in May,” a weekday effect, an options-expiration pattern, or a sector month is only a research hypothesis. Require the effect to survive total-return data, realistic trading days, costs, outliers, and an untouched period before it can alter exposure.

Count the sample correctly. A monthly effect receives one occurrence per year, even though each month contains many daily returns. A holiday window can shift across calendar dates, and early closes can change the execution window. Build buckets from the official exchange calendar rather than assuming every weekday is a full session.

For each bucket, report more than its average. Keep the median, range, loss frequency, worst path, and number of occurrences. Compare the bucket with all eligible non-bucket periods under the same return definition. Inspect whether one crisis, rebound, or constituent change supplies most of the apparent edge.

Multiple testing is the central trap. Testing every month, weekday, sector, holiday window, and options-expiration offset creates many chances to find a strong result by accident. Predeclare the primary test, apply an appropriate multiple-comparison method when exploring alternatives, and reserve a final sample that plays no role in selecting the rule.

**Worked procedure:** A researcher proposes that month `M` is unusually strong for an index. Before calculating, the researcher fixes the index membership treatment, total-return source, start date, trading costs, entry and exit sessions, and discovery period. Each annual return for `M` is compared with the other monthly returns. The result is then recomputed without its largest observation and tested on the untouched years. If the sign disappears, costs absorb the difference, or the rule was chosen only after scanning all months, it does not qualify as an allocation rule.

**Seasonality test**

- Freeze the bucket, benchmark, sample, and execution timestamps.
- Use total returns and the official trading calendar.
- Report occurrence count, distribution, and outlier dependence.
- Correct for the number of patterns tested.
- Keep a holdout sample and log failed hypotheses.

Market seasonality has fewer independent observations than its long price history suggests. Tax rules, index composition, derivatives listings, holidays, and market structure change. A pattern can be statistically visible yet too small, unstable, or expensive to trade. Passing a historical test never guarantees the next calendar occurrence.

Sources: [NIST: Detecting Seasonality](https://itl.nist.gov/div898/handbook/pmc/section4/pmc443.htm), [NIST: Multiple Comparisons](https://www.itl.nist.gov/div898/handbook/prc/section4/prc47.htm), [NYSE: Trading Hours and Calendars](https://www.nyse.com/trade/hours-calendars), [Cboe: Options Hours and Calendars](https://www.cboe.com/about/hours/us-options).

Educational, not investment advice.
