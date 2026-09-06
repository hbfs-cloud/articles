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

![A stop cannot fill where no price exists](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/gap_and_stop.png)

That is the whole subject. Size an overnight position as though its stop may fill at the next available price, not at the trigger.

Define the gap in a way you can measure. It is a next tradable market that sits materially away from a prior reference price. The reference can be the official close, the last regular-session trade, or something else your strategy names — say which one you use, once, and keep it. An extended-hours print is not a promise about tomorrow's open: FINRA is direct that liquidity, venue linkage, and who is participating all differ in those sessions, which on US stocks run 4:00 to 9:30 and 16:00 to 20:00 ET, often on 1–5% of normal volume. Between 20:00 and 4:00 there is no US liquidity at all. Seventeen and a half hours pass between the close and the next open, and Asia trades, Europe trades, companies report, central banks speak. At 9:30 the market prices all of it in one move.

This is not rare, and it is not symmetric. Most sessions open a little away from the previous close, and almost all of that is noise. A handful each year are not. Mondays tend to open furthest from Friday, because the weekend hands the open two extra days of news with no market to absorb it. And downside gaps run larger than upside ones, for a mechanical reason: margin calls force selling, clustered stops cascade into each other, and market makers widen spreads precisely when you need depth. We are not going to hand you a distribution here — measure it yourself, on your own instruments and your own reference price, because a number quoted without its sample is worth nothing.

Single stocks make index averages look gentle. On 3 February 2022, after reporting its first decline in daily users, Meta closed at 323.00 the day before and opened at 244.65 — **24.3% lower, before a single share changed hands in the regular session**. It ended that day 26.4% below the prior close. Both numbers matter, and they are not the same number: a stop set 10% below the close was passed over at the opening print, not filled on the way down.

Before holding overnight, work through four questions:

| What to check | What it tells you |
|---|---|
| Cause | an issuer filing, an earnings release, a macro decision, a corporate action, or no verified news? |
| Market state | trading normally, halted, in an auction, or quoted with depth you cannot use? |
| Order behavior | under your broker's rules, will the resting order trigger, become marketable, stay limited, or expire? |
| Portfolio impact | what does the next executable price do to loss, margin, and correlated positions? |

Then check these before the close:

- Name the price you are measuring the gap from.
- Verify the news through the issuer, a regulator, or an official release.
- Read your broker's stop and session rules — not the ones you assume.
- Stress the position at an adverse executable price and record the result.

**Limitation:** not every difference between two prints is a risk event. Thin after-hours trades, stale quotes, corporate-action adjustments, and plain data errors manufacture gaps that were never there, and a continuous-looking chart can still hide unusable liquidity. Confirm the market state before acting. But do not adopt a universal waiting period either: a verified structural event may demand immediate risk reduction, while an unstable auction makes an unbounded market order the wrong tool.

Sources: [Investor.gov: Understanding Order Types](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-14), [FINRA: Extended-Hours Trading Risks](https://www.finra.org/investors/insights/extended-hours-trading).

Educational, not investment advice.
