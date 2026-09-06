---
title: "A Stop Cannot Fill Inside an Empty Market"
subtitle: "Gap risk begins where the last tradable price ends and the next available price begins."
module_id: "gap-risk-survival"
episode_number: 1
source_path: "series/risque-de-gap/part1-anatomie-gap/index.html"
---

*Part 1 of 5 in Survive Gap Risk.*

You own a stock at $100 with a stop at $95. Overnight the company reports badly. Next morning it opens at $82.

Your stop did not fail. It fired exactly as instructed and then found nothing to sell into between $95 and $82, because no trades happened there. A standard stop is a threshold: once touched, it becomes a market order, and a market order takes the best price that exists. Planned loss, $5 a share. Actual loss, closer to $18, plus whatever the next bids cost you. A stop-limit at $95 would have avoided selling below $95 by not selling at all, while the price kept going.

That is the whole subject. Size an overnight position as though its stop may fill at the next available price, not at the trigger.

Define the gap in a way you can measure. It is a next tradable market that sits materially away from a prior reference price. The reference can be the official close, the last regular-session trade, or something else your strategy names — say which one you use, once, and keep it. An extended-hours print is not a promise about tomorrow's open: FINRA is direct that liquidity, venue linkage, and who is participating all differ in those sessions, which on US stocks run 4:00 to 9:30 and 16:00 to 20:00 ET, often on 1–5% of normal volume. Between 20:00 and 4:00 there is no US liquidity at all. Seventeen and a half hours pass between the close and the next open, and Asia trades, Europe trades, companies report, central banks speak. At 9:30 the market prices all of it in one move.

This is not rare. Across the S&P 500 from 2000 to 2024, about 68% of sessions opened away from the previous session's close. Median gap, 0.4% — noise. But roughly 12 gaps a year exceed 1%, and two or three exceed 2%. Mondays run largest, averaging 0.52% against 0.35% on Wednesdays, because the weekend hands the open two extra days of news. Downside gaps are also bigger than upside ones: −2.1% average against +1.4%, a ratio near 1.5. Margin calls force selling, clustered stops cascade, and market makers widen spreads precisely when you need depth.

Single stocks make the index numbers look gentle. On 3 February 2022 Meta opened 26.4% lower after its first decline in daily users, erasing about $230 billion of market value overnight. A 10% stop delivered a 26% loss.

Before holding overnight, work through four questions:

- **Cause:** an issuer filing, an earnings release, a macro decision, a corporate action, or no verified news?
- **Market state:** trading normally, halted, in an auction, or quoted with depth you cannot use?
- **Order behavior:** under your broker's rules, will the resting order trigger, become marketable, stay limited, or expire?
- **Portfolio impact:** what does the next executable price do to loss, margin, and correlated positions?

Then check these before the close:

- Name the price you are measuring the gap from.
- Verify the news through the issuer, a regulator, or an official release.
- Read your broker's stop and session rules — not the ones you assume.
- Stress the position at an adverse executable price and record the result.

**Limitation:** not every difference between two prints is a risk event. Thin after-hours trades, stale quotes, corporate-action adjustments, and plain data errors manufacture gaps that were never there, and a continuous-looking chart can still hide unusable liquidity. Confirm the market state before acting. But do not adopt a universal waiting period either: a verified structural event may demand immediate risk reduction, while an unstable auction makes an unbounded market order the wrong tool.

Sources: [Investor.gov: Understanding Order Types](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-14), [FINRA: Extended-Hours Trading Risks](https://www.finra.org/investors/insights/extended-hours-trading).

Educational, not investment advice.
