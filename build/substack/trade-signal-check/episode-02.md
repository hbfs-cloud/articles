---
title: "Why a Headline Reward/Risk Can Mislead"
subtitle: "Target distance is not expected payoff. The path and its frequency still matter."
series: "The 30-Second Trade Signal Check"
episode: 2
language: "en"
module_id: "trade-signal-check"
episode_number: 2
source_path: "series/anatomie-signal-trade/part2-risk-reward/index.html"
---
*Part 2 of 6 in The 30-Second Trade Signal Check.*

The `CLF` plan risked $0.97 per share. Its first target, $13.20, sat $0.95 above the $12.25 entry. Its
second target, $13.85, sat $1.60 above it.

That produced two honest ratios and two very different impressions:

```text
First target:  $0.95 / $0.97 = 0.98R
Second target: $1.60 / $0.97 = 1.65R
```

![What a reward/risk ratio actually demands of you](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/rr_vs_winrate.png)

The distance to the second target is 1.65R. That number is valid as geometry. It is neither the expected
reward nor the realized payoff. If half comes off at $13.20, the sold half earns 0.98R on that tranche
and contributes about 0.49R to the original whole-position risk. What the rest earns depends on the stop
rule and how often each path occurs.

Under a deliberately simple model with one full win and one full 1R loss, a 0.98R trade needs a 50.5%
win rate to break even before costs. A 1.65R trade needs 37.7%. The formula is `1 / (1 + R)`. These are
illustrations, not estimates for the `CLF` plan. They stop applying when exits are partial, stops move or
winners and losers vary in size.

The useful calculation is the complete exit policy. Record how much leaves at each target, what happens
to the remaining stop, and the net result of every mutually exclusive path. Then estimate:

```text
Expected value = sum(path probability x net payoff)
```

The probabilities must come from the identical entry and exit rules, tested outside the sample used to
design them, after costs and with the sample size disclosed. A distant target is only an unvalidated
scenario until that evidence exists.

Before accepting a headline ratio, calculate four items:

- `R` at the first planned sale.
- The percentage sold there.
- The stop rule for the remainder.
- The observed frequency and sample size of each exit path after costs.

No universal ratio separates good trades from bad ones. A high-win-rate strategy may work below 1.5R. A
trend strategy may accept many small losses because a residual tranche uses a trailing exit and sometimes
runs far beyond the first target. A 1.5R minimum can be a house rule, but it needs results from the same
setup and exit method.

The `CLF` candidate fails a house rule that demands at least 1.5R at the first sale. That does not prove
the trade was bad. A separately tested method could reach a different decision. Without path frequencies,
quoting only 1.65R overstates what the written plan pays first.

Sources: [FINRA: Evaluating Performance](https://www.finra.org/investors/investing/investing-basics/evaluating-performance); [Investor.gov: Understanding Fees](https://www.investor.gov/introduction-investing/getting-started/understanding-fees)

*`CLF` was purpose-selected as a teaching case, not a random sample or evidence of edge. This episode
audits the written target geometry; it does not validate how the upstream plan was produced. Calculations
exclude fees and slippage. No named issuer sponsored or compensated this series; DailyTickers and its
authors may hold securities discussed. Educational, not investment advice.*
