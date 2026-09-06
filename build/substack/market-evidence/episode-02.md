---
title: "What Options Activity Can Actually Prove"
subtitle: "Volume, open interest and off-exchange reports describe activity without identifying the complete position or motive."
module_id: "market-evidence"
episode_number: 2
source_path: "series/lire-le-marche/part2-options-darkpool/index.html"
---
*Part 2 of 6 in Read Market Evidence Without Inventing a Signal.*

A big options print tells you a trade happened. It does not tell you who wanted it, or why.

Four questions come before any label. Do the data identify buyer versus seller? Opening versus closing? A single leg, or one leg of a spread? Speculation, or a hedge against something else in the account? Leave any of those blank and intent stays unresolved. Large volume is evidence of activity, not a decoded portfolio.

![Between the event and your screen, time passes](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/information_clock.png)

The two headline numbers measure different things, and the difference does most of the work here. Volume counts contracts traded during a period. Open interest counts contracts still open after clearing. Every completed trade has a buyer and a seller. Every open contract has a long side and a short side. The Options Industry Council puts it flatly: open interest indicates neither a bullish nor a bearish outlook. Tomorrow's change in open interest shows the net effect of opening, closing, exercise and assignment across a whole series. It will not walk one conspicuous print back to one investor's final position.

Vendor filters are conventions, not facts, and it helps to know the usual ones. "Unusual" activity often means volume above roughly five times that strike's open interest. Flow screens commonly discard anything under about $100,000 in premium to strip out small orders, and tag trades above $250,000 as blocks. A sweep is a single order split across several exchanges at once so it fills immediately. Those thresholds describe how the screen was built. They describe nothing about the trader's book.

Short-sale volume needs its own vocabulary again. FINRA's public file aggregates qualifying short-sale trades executed off-exchange and reported to FINRA facilities. It is not consolidated with exchange short-sale data, it excludes activity that is not publicly disseminated, and it is not short interest. It also does not isolate alternative trading systems, the private venues often called dark pools, which together handle a large minority of US share volume. FINRA publishes delayed ATS and non-ATS venue volume through a separate transparency program. Two files, two definitions, and no arithmetic that joins them.

Suppose a vendor flags heavy call volume and shows a high off-exchange short-sale share on the same stock. What you can defend: "Options activity was elevated in these series; off-exchange reported short-sale volume was elevated under FINRA's file definition." What you cannot: that institutions accumulated shares, or that one dataset confirms the other. A reported short-sale share above 60% of off-exchange volume is routine for market makers, who sell to supply liquidity and cover moments later. The change matters more than the level, and neither is a position.

Before assigning a direction:

- Preserve strike, expiration, price, volume and prior open interest.
- Check whether the trade was reported as part of a complex order.
- Compare next-day open interest without pinning it on one print.
- Name the exact FINRA dataset and the market it covers.
- Keep ATS volume and short-sale volume in separate columns.

The boundary is worth stating once and then living with. Public feeds never show an investor's full portfolio, mandate or offsetting hedge. Dealer positioning estimates and gamma models stack assumptions on top of that gap, about who holds which side and how it gets hedged. Useful for sketching scenarios. Useless as a price target, and dangerous when quoted as one.

Sources: [OIC open-interest FAQ](https://www.optionseducation.org/referencelibrary/faq/general-information), [OCC options disclosure document](https://www.theocc.com/company-information/documents-and-archives/options-disclosure-document), [FINRA short-sale volume](https://www.finra.org/finra-data/browse-catalog/short-sale-volume), [FINRA OTC transparency](https://www.finra.org/filing-reporting/otc-transparency).

Educational, not investment advice.
