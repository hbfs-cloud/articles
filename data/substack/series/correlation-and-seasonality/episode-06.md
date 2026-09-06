---
title: "Build a Reproducible Correlation Workbench"
subtitle: "Pin data, transformations, windows, and vintages so every signal can be audited."
module_id: "correlation-and-seasonality"
episode_number: 6
source_path: "series/correlations-saisonnalites/part6-outils/index.html"
---

*Part 6 of 6 in Correlation and Seasonality Without Storytelling.*

A number you cannot rebuild is not evidence. It is a screenshot.

The test is blunt: hand someone your saved files and your written settings, and they should land on the same number. If they don't, something in the chain was never written down. The dashboard is not the proof. The saved inputs are.

Start with the trap that ruins most first attempts. Correlation measures how closely two things move together, on a scale from -1 to +1. Run it on raw prices and two stocks in the same rising market can score +0.99, which only tells you they both went up. Run the same pair on daily returns, meaning the percentage change from one close to the next, and the score can drop to +0.20. Same data, same window, opposite conclusion. Use returns.

Then write the data contract before you download anything:

- provider, series code, instrument, currency, units;
- observation timestamp, timezone, trading calendar, frequency;
- raw or adjusted price, including dividend and split treatment;
- rule for missing days, rule for aligning two markets;
- revision policy, vintage date, download time, file hash.

Economic data needs one extra step. FRED carries well over 800,000 series and serves today's version of history. ALFRED serves the version as it stood on an earlier date, which is what a vintage means. A jobs figure gets revised; a backtest run on the revised history can produce a signal that nobody could actually have seen at the time. BLS ships metadata and footnotes alongside its values, and those should travel with the numbers rather than being stripped on import.

Now pin the settings, and pin them before you look at the answer. A year holds roughly 252 trading sessions, so 252 is the usual long window and 60 sessions the usual recent one. If you convert the correlation into a Z-score, which counts how many standard deviations today's reading sits from its own average, say exactly what fed it: correlation over 60 sessions, mean and standard deviation over 252, flag anything past 2. Roll forward only. Never let a later date leak into an earlier calculation. For seasonality, store the bucket rule and the occurrence count, because four Januaries is not a pattern.

Run this once, end to end. Pick two documented series. Write the configuration first. Save the raw responses, the metadata, the download time. Parse missing values, convert both to the declared return frequency, keep only the dates valid in both, compute the rolling correlation. Then empty the output folder and rebuild from the saved inputs. Same numbers, good. Different numbers, and you compare file hashes, source vintages and transformation versions before touching a position. For any historical macro test, request the point-in-time vintage explicitly instead of quietly accepting the latest revision.

Two limits worth stating plainly. Excel copes until roughly 10,000 rows, then it crawls, and multi-asset correlation matrices become painful long before that. And reproducibility itself proves nothing about profit: an official API can change its definitions, vendor price files can carry adjustment errors, and code can apply the wrong formula perfectly every time. Rebuilding a result only means you can now argue about it properly. Independent review, out-of-sample testing and bounded position size still do the rest of the work.

An alert asks for a review. It does not place an order.

Sources: [FRED: Series Observations API](https://fred.stlouisfed.org/docs/api/fred/series_observations.html), [FRED and ALFRED: Real-Time Periods](https://fred.stlouisfed.org/docs/api/fred/realtime_period.html), [BLS: Public Data API](https://www.bls.gov/developers/api_signature_v2.htm).

Educational, not investment advice.
