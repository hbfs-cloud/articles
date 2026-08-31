---
title: "Test Bitcoin's Protocol Cycle as an Event Study"
subtitle: "Separate block-subsidy mechanics from market narratives, leverage, and changing correlations."
module_id: "correlation-and-seasonality"
episode_number: 4
source_path: "series/correlations-saisonnalites/part4-crypto-cycles/index.html"
---

*Part 4 of 6 in Correlation and Seasonality Without Storytelling.*

Treat a Bitcoin subsidy change as a protocol event, not a dated price forecast. Bitcoin Core defines the subsidy interval by block height. The code does not define a bull market, an altcoin season, or a post-event return. Any price-cycle claim must be tested across every available event with fixed windows, drawdowns, costs, and competing market conditions visible.

The sample is inherently small. Successive events occur under different market access, custody, leverage, regulation, liquidity, and macro conditions. Their return windows can overlap broader risk regimes. Averaging those paths may describe history, but it cannot turn a handful of episodes into a dependable calendar law.

Define crypto labels before using them. “Altcoin season” needs a fixed universe, inclusion rule, benchmark, weighting method, and treatment of delisted tokens. Changing the universe to today’s survivors introduces survivorship bias. On-chain ratios also require a precise data provider, methodology, chain treatment, and timestamp. Similar names do not ensure identical calculations.

Correlation with equities, the dollar, or rates should use synchronized returns and rolling windows. A changing sign is evidence that the relationship changed in the sample, not proof that Bitcoin became or ceased to be a particular type of asset. Leverage adds another layer: the CFTC warns that margined virtual-currency derivatives amplify gains and losses. Spot and futures can also use different venues, trading calendars, and reference rates.

**Protocol-cycle test**

- Verify the protocol event from Bitcoin Core parameters.
- Freeze price source, universe, timestamps, and event windows.
- Include failed assets, fees, drawdowns, and venue constraints.
- Separate spot, futures, leverage, and custody risks.
- Require an independent entry, invalidation, size, and exit policy.

**Worked procedure:** For a subsidy-event study, freeze one spot index, event block, pre-event window, post-event windows, fee assumption, and comparison method. Show every event separately before calculating an aggregate. Compare each event window with matched non-event windows drawn under the same rule, then inspect maximum adverse movement and dependence on the best episode. If the conclusion changes when one event is removed, the event is context only and cannot authorize a trade.

No short event history can isolate the effect of subsidy from concurrent demand, liquidity, or macro changes. Protocol code can change, data vendors can revise classifications, and venues can fail. Even a repeated historical sequence would remain probabilistic and vulnerable to structural change.

Sources: [Bitcoin Core: Mainnet Consensus Parameters at commit d2e24e9](https://github.com/bitcoin/bitcoin/blob/d2e24e951de45e7e8d328ef36b80c055c90a6fdd/src/kernel/chainparams.cpp), [CFTC: Virtual Currency Trading Risks](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/understand_risks_of_virtual_currency.html), [CME Group: Cryptocurrency Futures Specifications](https://www.cmegroup.com/articles/faqs/frequently-asked-questions-cryptocurrency-futures.html).

Educational, not investment advice.
