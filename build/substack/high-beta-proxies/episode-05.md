---
title: "Stress-Loss Sizing for High-Beta Proxies"
subtitle: "Combine factor stress, residual risk, gaps, and execution limits"
module_id: "high-beta-proxies"
episode_number: 5
source_path: "series/proxys-haut-beta/part5-gestion-risque/index.html"
---
*Part 5 of 6 in Use High-Beta Proxies Without Getting Trapped.*

::audience non_sub,free_sub
Each part stands on its own. This is 5 of 6 in Use High-Beta Proxies Without Getting Trapped; earlier parts cover the groundwork but you can start here.
::end

Losses are not symmetric, and high beta is where that stops being a maths curiosity.

Say the index falls 30%, which happens. A position with beta 1.0 falls about 30% and needs roughly +43% to get back to even. Beta 1.5 falls about 45% and needs +82%. Beta 2.0 falls about 60% and needs +150%. Beta 3.0 falls about 90% and needs +900%. That last one is not a recovery. That is a new career.

![After a 30% index fall, the climb back](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/examples/high-beta-proxies_episode-05.png)

Size from that arithmetic, not from the average. <mark>Beta is a fitted average sensitivity; it is not a worst case.</mark> And a high-beta position can gap straight past your exit price, stop tracking its reference, and dry up in liquidity all in the same session, usually the one where you most wanted the relationship to hold.

![Size decides what a bad night costs you](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/position_sizing.png)

**Divide the size by the beta.** One published rule sets it out plainly: position size equals capital times the risk you accept, divided by the daily range times the beta. Work it through. A $100,000 account risking 1% is risking $1,000. The stock's average true range, meaning the typical distance it travels in a day, is $5.00. Beta is 1.8. So $1,000 divided by ($5.00 x 1.8) gives 111 shares. At $130 a share, that is about $14,430, or 14.4% of the account. Skip the beta term and the same formula hands you 200 shares, $26,000, 26% of the account. Same risk budget on paper, nearly double the real exposure.

Sizing caps follow the same logic in blunter form. Published guidance keeps a beta of 1.0 to 1.3 at 15-20% of capital, 1.3 to 1.8 at 8-12%, 1.8 to 2.5 at 5-8%, and anything from 2.5 upward at 2-5%. Whichever cap binds first is the one you use.

**Sizing stress**

1. Define the reference shock, the leftover shock, a gap and slippage before ordering.
1. Calculate the scenario loss in dollars, not percent, before the order goes in.
1. Compare the scenario, the exit level, the concentration cap and what you can realistically sell.
1. Cut or skip anything carrying an unmodelled binary event inside the horizon.
1. Re-estimate only on fresh overlapping data, never on a window you chose after the fact.
1. Record your actual fills and correct the assumptions that were wrong.

Widen the stop, shrink the position. A high-beta name moves further in an ordinary day, so a tight exit gets hit by noise rather than by anything meaningful; a common setting is 2.0 to 2.5 times the daily range. The smaller position pays for the wider distance, and the dollar risk stays where you put it. Add a time limit too: if a high-beta position has not moved in five to seven sessions, the reason you bought it has probably expired.

Then a rule for after the loss. Three consecutive stopped-out trades is not bad luck to trade through; a 48-hour pause costs nothing and buys you the chance to notice the regime changed. Never average down here. Adding to a falling high-beta position is the fastest route to the recovery table above.

A stop is an instruction, not insurance. Once triggered it becomes a market order and can fill far from your price. A stop-limit protects the price and may simply never fill.

**Limitation:** Stress scenarios are chosen models, not walls. The sample you drew them from may not contain the next tail event, and leftovers that looked independent tend to move together during a broad deleveraging, which is precisely when you own several of them. Single-position sizing cannot see that. Portfolio-level stress has to sit on top.

Sources: [SEC Investor Bulletin on Stop Orders](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-15), [FINRA Risk Overview](https://www.finra.org/investors/investing/investing-basics/risk), [NIST Linear Least Squares Regression](https://www.itl.nist.gov/div898/handbook/pmd/section1/pmd141.htm).

Educational, not investment advice.
