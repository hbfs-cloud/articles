---
title: "Separate Entry, Exit, and Invalidation"
subtitle: "Order mechanics and exit paths belong in the plan before position sizing."
module_id: "trading-plan-playbook"
episode_number: 3
source_path: "series/plan-de-trading/part3-entrees-sorties/index.html"
---
*Part 3 of 6 in Build a Trading Plan You Can Execute.*

::audience non_sub,free_sub
Each part stands on its own. This is 3 of 6 in Build a Trading Plan You Can Execute; earlier parts cover the groundwork but you can start here.
::end

Four decisions hide inside what most people call "the trade". The signal says the conditions are there. The
order says how you will try to get filled. Invalidation says the reason for the trade has died. The exit
instruction says what you do about it. Squash them into one price and you lose track of which one failed.

Where you put the stop is the argument worth having. A trader thinks: I can afford to lose €200, so the
stop goes wherever €200 lands. Backwards. The market has no idea what you can afford. It only knows where
your idea stops being true. Put the stop under the level that defined the idea, then let the size adjust.

![A fact is not a decision, and a decision is not an order](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/decision_flow.png)

The numbers make the point better than the principle does. Capital €20,000, one trade capped at 1%, so
€200. Entry €50, the base low that would refute the idea at €47, giving €3 of risk per share. €200 divided
by €3 is roughly 66 shares, about €3,300 committed. Now do it the wrong way round: decide you want to lose
€200 and place the stop €1.50 away, and you buy 133 shares. Twice the position, hung on a level that proves
nothing when it breaks. The honest stop was not the expensive one. It was the one that stopped you from
overcommitting.

Order type is the other half. Investor.gov explains that a market order generally prioritises getting done
over the price you get, while a limit order controls the worst price you will accept but may never fill. A
stop order becomes a market order once triggered, so the stop price is a signal to sell, not a promise
about where you sell. Brokers differ on trigger conventions. Read yours before you rely on any of it.

Reward comes from the same ruler. If risk is €3 a share, an exit at €56 is two units of reward per unit of
risk. That ratio matters more than being right often: with a payoff of two to one, break-even sits at one
divided by three, near 33%. You may be wrong two times out of three and still be flat before costs. What
the ratio does not do is tell you the odds of either price arriving.

Write every route before the entry goes in:

| Element | What it must specify |
|---|---|
| No fill | cancel after the stated time. No chasing unless a separate written rule allows it. |
| Invalidation | name the order or the action you will use to get out. |
| It works | define the partial exit, the trailing rule, or the final target. |
| Time expiry | exit or reassess on a named date. |
| Something strange | a halt, a gap, a rejected order, a disclosure. Decide now. |

The sequence is not decoration: invalidation first, then a realistic loss including costs, then the maximum
size. Move the invalidation closer to buy more shares and the position size has quietly rewritten the
evidence against the trade.

Use this check at the ticket:

- Keep the signal price and the order price apart in your head.
- Verify duration, session eligibility and how your broker triggers stops.
- Recalculate risk from the price you actually got, not the one you asked for.
- State every exit, including the no-fill and time-expiry cases.
- Reject the trade if a plausible gap costs more than you accepted.

**Limitation:** none of this caps the loss at the planned amount. Fast markets, thin liquidity, news, halts
and overnight gaps can hand you a materially worse exit. Using a limit on the way out avoids a terrible
price and can leave you holding the position instead. Choose which of those you prefer, in advance, and
write it down.

Sources: [Investor.gov: Types of Orders](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/types-orders); [Investor.gov: Executing an Order](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/executing-order)

Educational, not investment advice.
