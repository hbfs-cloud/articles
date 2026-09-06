---
title: "A Scenario Tree for Central-Bank Events"
subtitle: "Define the event clock, policy alternatives, invalidation, and execution risk in advance."
module_id: "central-bank-playbook"
episode_number: 6
source_path: "series/banques-centrales/part6-trader-la-macro/index.html"
---
*Part 6 of 6 in The Central Bank Playbook.*

::audience non_sub,free_sub
Each part stands on its own. This is 6 of 6 in The Central Bank Playbook; earlier parts cover the groundwork but you can start here.
::end

On 31 July 2024 the Bank of Japan lifted its policy rate from 0.10% to 0.25%. Fifteen hundredths of one percent. Three sessions later the Nikkei closed 12.4% lower — its worst day since 1987. US indices lost 3% to 4%. The VIX, the index that tracks what crash protection costs, touched 65. The yen had gained 8% in four days, so everyone who had borrowed cheap yen to buy assets elsewhere had to unwind at once.

No directional forecast covers that. A written plan can.

Before a meeting, write down what each official outcome permits you to do, what makes you sit still, and how much you accept losing. Anchor the clock to the bank's own calendar. <mark>Then treat the first market move as evidence, not as proof you were right.</mark>

![Every order ends reconciled](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/order_state_machine.png)

Start with the policy state, not folklore about which assets "like" rate cuts. Record the target, the documents due, the release time with its time zone, and what the market appears to expect, from a source carrying a timestamp. Build scenarios from what the release actually says: target changed or unchanged, balance-sheet decision, statement wording, projections when they are scheduled. Hawkish and dovish are conclusions. They are not inputs.

Each scenario carries three layers:

| Layer | What it records |
|---|---|
| Policy fact | what the release changed, and when it takes effect. |
| Market observation | the price, yield, spread, or volatility move over a window you fixed in advance. |
| Interpretation | a conditional explanation, allowed to stay uncertain. |

Keeping those apart is the whole discipline. Take projections. A committee can leave rates untouched while its members' own forecasts drift lower. Yields drop on the headline, then finish the window above where they started. The fact is no rate change; the forecast shift is information, not a promise. "Lower projections mean buy bonds" confuses the two, and ignores what the path did to your fill.

The 10-year minus 2-year spread is the cautionary case. It inverted — short rates above long rates — in July 2022 and stayed inverted for more than two years, the longest stretch on record. The textbook reading is recession inside 6 to 18 months, and it had been right 7 times out of 7 since 1970. By mid-2026 no official recession had arrived. A tree that treats a signal as a schedule breaks. One that treats it as a condition to keep checking does not.

A usable event card holds the exposure allowed before the release, the order types permitted, the evidence that triggers action, the invalidation, what you do when an order is rejected, and the moment the scenario expires. Recalculate risk from the fill you got, not the one you planned. Investor.gov is blunt about why: market orders do not guarantee a price, and stop orders can execute away from the stop price. An event loss budget is an estimate, never a cap.

Run this before every meeting:

1. Check the official calendar again on the morning itself.
1. Freeze scenarios, exposure, and no-trade conditions.
1. Save each document with its timestamp.
1. Separate the target, the tool, and the effective date.
1. Write the prices down before you explain them.
1. Keep the rejected, partial, cancelled, and skipped orders.

**Limitation:** a tree cannot list every wording change, leak, technical failure, or headline landing in the same second. August 2024 turned 15 basis points into a 12.4% index day. Liquidity can disappear while your order sits unfilled, and several assets can reverse at once. Historical event patterns are unstable and prove nothing about cause. Sitting out is a legitimate branch when the release does not match the map you prepared.

Sources: [Federal Reserve: FOMC Meeting Calendars, Statements, and Minutes](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm); [BLS: Release Calendar](https://www.bls.gov/schedule/); [BEA: Release Schedule](https://www.bea.gov/news/schedule/); [Investor.gov: Types of Orders](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/types-orders)

Educational, not investment advice.
