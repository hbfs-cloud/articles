---
title: "Build a Reproducible Correlation Workbench"
subtitle: "Pin data, transformations, windows, and vintages so every signal can be audited."
module_id: "correlation-and-seasonality"
episode_number: 6
source_path: "series/correlations-saisonnalites/part6-outils/index.html"
---

*Part 6 of 6 in Correlation and Seasonality Without Storytelling.*

Use a correlation or seasonality signal only if another person can reproduce it from saved inputs and a written configuration. The dashboard is not the evidence. Preserve the raw data, retrieval time, series definitions, transformations, and code or spreadsheet version that produced the result. If a later run changes, trace the cause before making a decision.

Create a data contract for every series:

- provider, series identifier, instrument, currency, and units;
- observation timestamp, timezone, trading calendar, and frequency;
- raw or adjusted price, including dividend and split treatment;
- missing-value rule and cross-market alignment rule;
- revision policy, vintage date, retrieval time, and file hash.

Macroeconomic data deserve special care. FRED provides current observations from many sources, while ALFRED can preserve what was known at an earlier date. A backtest using today’s revised history may give a signal that was unavailable in real time. BLS and other official APIs publish metadata and footnotes that should travel with the values.

Keep transformations explicit. Compute returns from the chosen price field, align only sessions allowed by the rule, and calculate the rolling window without peeking forward. For seasonality, store the bucket definition and occurrence count. For correlation, retain both the estimate and the paired observations used to calculate it. Alerts should prompt review; they should not submit a trade without an independent risk plan.

**Worked procedure:** Select two documented series and write the configuration before downloading them. Save the raw responses, metadata, and retrieval timestamp. Parse missing values, convert both to the declared return frequency, intersect valid observation dates, and calculate the rolling correlation. Rebuild the result from an empty output folder. If the values differ, compare file hashes, source vintages, and transformation versions. For a historical macro test, request the point-in-time vintage rather than silently substituting the latest revision.

**Reproducibility record**

- Record source identifiers, units, calendars, and licenses.
- Save immutable raw inputs with timestamps and hashes.
- Version return, alignment, window, and bucket rules.
- Test missing data, revisions, and corporate actions.
- Reproduce the output before trusting an alert.

Reproducibility does not prove that a hypothesis is valid or profitable. An official API can change, third-party market data can contain adjustment errors, and code can implement the wrong formula consistently. Independent review, out-of-sample testing, and bounded position risk remain necessary.

Sources: [FRED: Series Observations API](https://fred.stlouisfed.org/docs/api/fred/series_observations.html), [FRED and ALFRED: Real-Time Periods](https://fred.stlouisfed.org/docs/api/fred/realtime_period.html), [BLS: Public Data API](https://www.bls.gov/developers/api_signature_v2.htm).

Educational, not investment advice.
