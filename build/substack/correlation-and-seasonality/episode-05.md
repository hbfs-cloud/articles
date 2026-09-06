---
title: "Define the Failure Rule Up Front"
subtitle: "Pairs and seasonal strategies need frozen definitions, execution costs, and structural exits."
module_id: "correlation-and-seasonality"
episode_number: 5
source_path: "series/correlations-saisonnalites/part5-strategies/index.html"
---
*Part 5 of 6 in Correlation and Seasonality Without Storytelling.*

Write down how the strategy is allowed to fail before you write down how it makes money. If you cannot say what would make you close it, you do not have a strategy.

Start with pairs, because the arithmetic is easy and the trap is subtle. You buy the laggard, sell the leader, and wait for the gap between them to close. Popular candidates come with long shared histories: US large caps against tech near plus 0.92, gold against gold miners near plus 0.78, energy shares against crude near plus 0.82, bitcoin against ether near plus 0.88.

![A fact is not a decision, and a decision is not an order](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/decision_flow.png)

The gap gets measured in standard deviations, called a z-score. A z of 2.0 means the spread sits two standard deviations from its own average, something that happens about 2.3% of the time; 2.5 is nearer 0.6%. A common frame is to enter beyond 2.0, exit as it returns toward zero, and cut at 3.5 on the view that convergence may never arrive.

That last rule is not optional, because correlation says nothing about whether the gap ever closes. Two assets can rise and fall together for years while the distance between them widens forever. In 2020, energy shares and crude oil futures separated permanently when the futures contract printed a negative price. Anyone waiting for the old relationship to reassert itself waited a long time.

Before trading a broken relationship, decide which kind of break it is. Temporary: the trigger was a one-off event, the fundamentals are unchanged, the rolling sixty-day correlation still reads above plus 0.50, and similar gaps closed before. Structural: the trigger was regulation, a bankruptcy, a merger or a new permanent buyer; the divergence has run past thirty days; the rolling correlation has slipped under plus 0.30. Gold and the dollar in 2024 and 2025 were the second kind. Central banks buying over a thousand tonnes a year is a new driver, not a wobble.

Seasonal rotation needs the same suspicion, and backtests flatter hardest here. Published comparisons since 2000 put buy-and-hold at roughly 9.8% a year with a 55% worst decline, the raw sell-in-May rule at 7.2% with a 33% decline, and a trend-filtered version at 11.4% with a 29% decline. Those rules were chosen with full knowledge of the period they were tested on. The CFTC is blunt about hypothetical results: prepared with hindsight, carrying none of the financial risk of real trading.

So build the failure rules into the design:

- Freeze the universe, the formula, the windows, the thresholds and the costs before running anything.
- Split the data into training, validation, and one final holdout you use exactly once.
- Define four exits separately: loss, convergence, time, and structural.
- Trigger the structural exit on filings — a merger, a spin-off, a restatement — which you can check on EDGAR, the SEC's public filing database.
- Cap notional exposure, borrowing and concentration outside the model, since a quiet asset can attract a large weight right before it stops being quiet.
- Keep the rejected tests in the log; they tell you how many things you tried.

Risk-parity style overlays deserve a specific warning. The bond leg was sized on an assumption that bonds fall when shares rise. In 2022 that link went from about minus 0.30 to plus 0.50 and the diversification vanished, taking both legs down together.

**Limitation:** a simulation cannot reproduce real fills, market impact, margin pressure, or how hard it is to keep following a rule that is losing. Retuning after a poor result turns the holdout into training data. A strategy that survives research can still fail live, so the first live size should assume the model is partly wrong.

Sources: [NIST: Correlation](https://www.itl.nist.gov/div898/software/dataplot/refman2/auxillar/correlat.htm), [CFTC: Limitations of Hypothetical Trading Systems](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/fraudadv_tradingsystem.html), [Investor.gov: Using EDGAR to Research Investments](https://www.investor.gov/introduction-investing/getting-started/researching-investments/using-edgar-research-investments), [FINRA: Concentration Risk](https://www.finra.org/investors/insights/concentration-risk).

Educational, not investment advice.
