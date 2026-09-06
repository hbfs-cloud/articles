---
title: "A Rule-Based Scaling Ladder"
subtitle: "Increase size only after predefined evidence, capacity, and risk gates hold."
module_id: "portfolio-operator"
episode_number: 4
source_path: "series/piloter-son-portefeuille/part4-scale-up/index.html"
---
*Part 4 of 6 in Operate a Portfolio, Not a Collection of Trades.*

::audience non_sub,free_sub
Each part stands on its own. This is 4 of 6 in Operate a Portfolio, Not a Collection of Trades; earlier parts cover the groundwork but you can start here.
::end

Eight winning trades in a row proves nothing. On a small but real edge, and even on a strategy with no edge at all, that run shows up by chance more often than people expect. It is also the moment most accounts double their size.

![Add to a position on evidence, not on relief](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/scaling_ladder.png)

So write the ladder while you are bored, not while you are winning.

A ladder is a short list: account levels, and the size allowed at each one. Round teaching numbers show the shape. Call the starting account 100, and call your normal trade size 1.0×. Every time the account is 10% higher, size steps up by about a quarter. At 110 you may trade 1.25×. At 121, 1.55×. At 133, 1.95×. Fall back under a level and you drop a rung. No vertical jumps, and no increase at all while the account sits below its previous high.

![The rung, not the streak, decides size](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/examples/portfolio-operator_episode-04.png)

That is the exact opposite of the old casino habit of betting bigger after a loss to win it back. Bigger after money is actually banked; smaller after money is lost.

Two different decisions hide inside the word "scaling," and mixing them gets expensive. Pyramiding means adding to one trade that is already going your way. Book scaling means raising the reference size for every new trade the strategy takes. Either can happen without the other.

Pyramiding is only safe if the stop climbs with the adds. First entry at 100, stop at 96: that gap is one unit of risk, written 1R. Add half a size at 106 and lift the stop to 102. Add again at 112, stop to 108. Risk on the whole stack stays at or below the original 1R. Add without moving the stop and the position becomes heaviest exactly when it is most stretched.

Then comes the part almost nobody tests: capacity. A method that prints on small orders can die on large ones. Investor.gov notes that a quote applies to a stated number of shares, and the price can change before your order reaches the market. Big orders eat several levels of the order book, fill halfway, or miss a limit entirely. Your true edge is the gross edge minus slippage, impact and fees, and only the costs grow with size.

Before you climb a rung:

1. Write the promotion and demotion rules down, then leave them alone.
1. Record every fill at your current size: price expected versus price obtained.
1. Send a few real orders at the next rung's size and read the fills before committing.
1. Check the larger allocation against your per-trade, sector and borrowing limits.
1. Keep the old rung running while the new one is being proved.
1. Step back down on a capacity or control breach, even when the trade made money.

<mark>One number must never move: risk per trade as a share of the account.</mark> Risk 1% at $20,000 and you still risk 1% at $200,000 — $200 becomes $2,000, same fraction. Chart that percentage on its own, separate from profit. It should be a flat line. The slide from 1% to 3% is how a path whose worst decline was 12% turns into one whose worst decline was 34%.

> Size climbs on banked money and proven fills. The fraction you risk climbs on nothing.

**Limitation:** no small test reveals real market impact at ten times the size, and the liquidity you measured can be gone the day you need it. A ladder forecasts nothing. It only slows the climb down enough to be checked.

Sources: [Investor.gov: Executing an Order](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/executing-order); [FINRA: Concentration Risk](https://www.finra.org/investors/insights/concentration-risk); [FINRA: Evaluating Performance](https://www.finra.org/investors/investing/investing-basics/evaluating-performance)

Educational, not investment advice.
