---
title: "Test Bitcoin's Protocol Cycle as an Event Study"
subtitle: "Separate block-subsidy mechanics from market narratives, leverage, and changing correlations."
module_id: "correlation-and-seasonality"
episode_number: 4
source_path: "series/correlations-saisonnalites/part4-crypto-cycles/index.html"
---
*Part 4 of 6 in Correlation and Seasonality Without Storytelling.*

::audience non_sub,free_sub
Each part stands on its own. This is 4 of 6 in Correlation and Seasonality Without Storytelling; earlier parts cover the groundwork but you can start here.
::end

Bitcoin's code does one thing on a schedule: every 210,000 blocks, roughly four years, it halves the reward paid to miners. That is the whole event. The reward went 50 to 25 in 2012, 25 to 12.5 in 2016, 12.5 to 6.25 in 2020, and 6.25 to 3.125 in April 2024. Nothing in the software mentions a bull market, an altcoin season, or a price target.

The price history around those dates is genuinely striking, which is exactly why it needs handling with tongs.

Count the completed events. Three. November 2012: bitcoin at about $12, peaking near $1,150 twelve months later, then falling to roughly $170, down 85%. July 2016: about $660, peaking near $19,700 seventeen months later, then down to $3,200, a fall of 84%. May 2020: about $8,600, peaking near $69,000 eighteen months later, then down to $15,500, a fall of 78%. The fourth began in April 2024 around $64,000 and is still running.

![Drawdown measures the path, not the destination](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/drawdown_path.png)

Three observations. <mark>Any average built from three paths is not a law.</mark> Remove one and the whole story changes shape, which is the standard test for whether an event study means anything.

The three also happened in completely different worlds. Custody, exchange access, leverage, regulation, liquidity and the macro backdrop were unrecognisable between 2012 and 2020, and spot exchange-traded funds only arrived in 2024. Each post-event window also overlaps a broader risk cycle, so you are never measuring the subsidy on its own.

Then there is the vocabulary problem. "Altcoin season" means nothing until you fix the list of coins, the rule for joining it, the benchmark, the weighting and what happens to tokens that got delisted. Rebuild that list from today's survivors and you have quietly deleted every project that went to zero, which flatters the result. On-chain ratios carry the same burden: name the data provider, the method, the chain treatment and the timestamp, because two providers with the same metric name can compute different things.

Correlation with shares, the dollar or rates deserves rolling windows and matched timestamps. In calm markets bitcoin has tracked US equities somewhere around plus 0.50 to plus 0.70. On 12 March 2020 it fell 40% in twenty-four hours, from about $8,000 to $4,800, while the S&P 500 dropped 10% and gold slipped 3%, and the equity link measured near plus 0.80. A sign that moves is evidence the relationship changed in your sample. It is not evidence that bitcoin became, or stopped being, a particular kind of asset.

Leverage adds its own layer. The CFTC warns that margined virtual-currency derivatives magnify both gains and losses, and forced liquidations feed on themselves — $2.5 billion of positions were closed out in a single day on 19 May 2021. Spot and futures also sit on different venues, calendars and reference rates.

Running the study properly:

1. Verify the event from Bitcoin Core's own parameters, not from a chart annotation.
1. Freeze one price source, the event block, the pre-event window, the post-event windows and the fee assumption before computing.
1. Show each event separately before you average anything.
1. Compare each event window against matched non-event windows chosen by the same rule.
1. Record maximum adverse movement, not just the peak.
1. Check whether dropping the best episode kills the conclusion.

**Limitation:** three events cannot separate the subsidy from everything else moving at the same time. Protocol code can change, vendors revise classifications, venues fail. Even a sequence that repeated four times would still be probabilistic, and structural change does not announce itself in advance.

Sources: [Bitcoin Core: Mainnet Consensus Parameters at commit d2e24e9](https://github.com/bitcoin/bitcoin/blob/d2e24e951de45e7e8d328ef36b80c055c90a6fdd/src/kernel/chainparams.cpp), [CFTC: Virtual Currency Trading Risks](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/understand_risks_of_virtual_currency.html), [CME Group: Cryptocurrency Futures Specifications](https://www.cmegroup.com/articles/faqs/frequently-asked-questions-cryptocurrency-futures.html).

Educational, not investment advice.
