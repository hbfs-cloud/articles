---
title: "A Verification Ladder for News and Sentiment"
subtitle: "Trace the claim, preserve its first reliable timestamp and measure attention without pretending to know intent."
module_id: "market-evidence"
episode_number: 4
source_path: "series/lire-le-marche/part4-news-sentiment/index.html"
---
*Part 4 of 6 in Read Market Evidence Without Inventing a Signal.*

::audience non_sub,free_sub
Each part stands on its own. This is 4 of 6 in Read Market Evidence Without Inventing a Signal; earlier parts cover the groundwork but you can start here.
::end

Repetition is not confirmation. A claim copied across forty accounts in ten minutes is still one claim, with good distribution.

So do not act on a headline or a sentiment score until the claim underneath has a named source, a publication time and a primary document behind it. <mark>When the primary document cannot be found, the honest label is "unverified", and it stays that way in your notes.</mark>

![Seal the evidence, not the story](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/evidence_chain.png)

News runs on at least three clocks: when the event happened, when the source disclosed it, and when a publisher or an account repeated it. A later article can be perfectly accurate and add nothing new. A corrected headline can leave stale copies sitting in aggregators for days. Keep the original link and its timestamp instead of the time shown by whoever reposted it last. Speed is not the edge on offer here in any case. Headline-parsing algorithms react in roughly fifty milliseconds, and the big US macro releases land at 8:30 a.m. Eastern with the first move priced before a person finishes the opening paragraph.

Company communications need their own context. The SEC has said companies may use social media for material announcements under Regulation FD when investors have been alerted to the channels that will be used. That does not make every account authentic, and it does not turn a post into a filing. Check the issuer's investor-relations page, its EDGAR record, and the channels it actually disclosed.

Sentiment tools turn a chosen pile of text into a number. The number depends on which sources were scraped, how languages are handled, whether duplicates and bots were removed, what the classification rules are, and how far back the window reaches. A rise in mentions establishes attention inside that sample. It cannot show whether posters own the security, are joking, are hedging, are being paid to post, or are simply reacting after the price already moved. Scale does not fix this: one stock forum passed fourteen million members, which produces volume, not evidence. SEC and FINRA guidance warns in the same direction, that social information can be inaccurate, stale, incomplete or manipulated.

Tidy indexes deserve the same care. A widely quoted fear-and-greed gauge compresses seven separate inputs onto a 0-100 scale, and a long-running weekly survey of individual investors has averaged somewhere near 37% bullish across its history. Both describe a chosen sample on a chosen schedule. Record which one you used and what it covers, then treat the reading as a description of that sample rather than of the market.

Worked case. Posts claim a company won a government contract. Search the awarding agency. Search the company's EDGAR filings and its official investor-relations releases. Record the scope and the award date from the primary source. If the only evidence is copied social text, the log entry reads "unverified contract claim", and mention volume does not get converted into expected revenue.

Verification pass:

1. Capture the earliest source you can authenticate.
1. Separate event time, publication time and repost time.
1. Find the filing, agency notice or issuer release behind the claim.
1. Document the sentiment tool's corpus and window.
1. Check corrections, sponsorships and conflicts.
1. Write down what remains unknown.

The unavoidable limit is what sentiment can see. It observes expressions selected by a platform and a model, never the full population of investors or the positions they hold. Primary confirmation can also arrive after prices have already reacted. This procedure keeps a rumour from hardening into a fact inside your own notes. It will not get you in early, and it cannot prove that a headline caused a move.

Sources: [Investor.gov social-sentiment bulletin](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-18), [SEC guidance on company social-media announcements](https://www.sec.gov/newsroom/press-releases/2013-2013-51htm), [Investor.gov social-media fraud guide](https://www.investor.gov/protect-your-investments/fraud/types-fraud/internet-and-social-media-fraud).

Educational, not investment advice.
