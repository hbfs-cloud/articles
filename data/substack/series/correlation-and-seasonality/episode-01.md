---
title: "Measure Correlation on the Right Sample"
subtitle: "Use matched returns and rolling windows before treating two assets as linked."
module_id: "correlation-and-seasonality"
episode_number: 1
source_path: "series/correlations-saisonnalites/part1-les-correlations/index.html"
---

*Part 1 of 6 in Correlation and Seasonality Without Storytelling.*

Correlation is one number between minus one and plus one that says how two things moved together in the past. Plus one, they rose and fell in lockstep. Minus one, one zigged whenever the other zagged. Zero, no straight-line link in that sample.

The trouble is that people quote it as if it were a property of the assets. It is a property of the window you chose.

Take the hedge everyone learns first: US shares against long-dated government bonds. In calm stretches the link runs around minus 0.40 — shares fall, bonds rise, the portfolio holds. Before 2008 it sat near minus 0.35, and through the 2008 crisis it strengthened to about minus 0.55. Then 2022 arrived, inflation pushed rates up, and the same pair read plus 0.50. Both sides fell together. By 2023 and 2024 it had drifted back toward minus 0.30. Nothing about the assets changed. The regime did.

March 2020 made the point more brutally. In the week of the ninth, the S&P 500 dropped 8.8% in a single day, gold fell 3.5% instead of protecting anyone, and bitcoin lost 40% in twenty-four hours. Leveraged funds facing margin calls sold whatever could be sold. When that happens, everything correlates to one, and diversification stops working precisely on the day you needed it.

There is a second trap, quieter than the first. A high number is not a reason. Cheese consumption tracks bedsheet strangulation deaths at plus 0.95. The NASA budget tracks a category of suicides at plus 0.99. Search a large enough dataset and you will always find something. Before trading a relationship, name the mechanism that would make it hold.

Now the housekeeping that decides whether your number means anything at all.

- Use returns, not prices — two rising price lines look linked simply because both go up.
- Include dividends when you compare investable performance, and keep the same return type throughout.
- Line up the sessions, and never carry yesterday's price forward across a closed market.
- Pick the window length before you look at the answer, then check a second window as a sanity test.
- Write down what decision would change if the sign flipped, and check that plot regularly.

Window choice is part of the question, not a technical detail. Sixty days reacts fast but rests on few observations. Three years is steadier and blends regimes that have nothing to do with each other. Keep the full-history figure as background colour, never as the verdict.

A real check looks like this. Two assets show a comfortable positive figure across their whole history. Split it into consecutive windows and the recent ones alternate between positive, near zero, and negative, while one violent selloff carries most of the full-sample result. The honest conclusion is not "these assets are correlated." It is that the relationship depends on the regime, earns no diversification credit in your stress test, and needs a separate risk control behind any hedge built on it.

One more thing that trips people up: three US equity ETFs are not a diversified portfolio. Large caps against tech run near plus 0.92, large caps against small caps near plus 0.85, tech against small caps near plus 0.78. Owning all three is owning one position in three wrappers.

**Limitation:** this measure only sees straight-line links. It misses curved relationships, misses the way assets fall together harder than they rise together, and misses shared exposure that only surfaces under stress. Rolling windows reuse the same observations, so neighbouring readings are not independent confirmations. A correlation matrix is a diagnostic. It is not proof of cause, and it is not a promise of durable diversification.

Sources: [NIST: Correlation](https://www.itl.nist.gov/div898/software/dataplot/refman2/auxillar/correlat.htm), [Federal Reserve: Time-Varying Stock-Bond Correlation](https://www.federalreserve.gov/econres/feds/files/2025002pap.pdf), [NIST: Bootstrap Uncertainty](https://www.itl.nist.gov/div898/handbook/eda/section3/bootplot.htm).

Educational, not investment advice.
