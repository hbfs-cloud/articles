---
title: "The Portfolio Loss Budget for Options"
subtitle: "Premium, assignment, gaps and margin must fit one portfolio-level risk decision."
module_id: "options-risk"
episode_number: 6
source_path: "series/options-trading/part6-gestion-risque/index.html"
---

*Part 6 of 6 in Options Without the Hidden Risk.*

Set the maximum acceptable portfolio loss before choosing the option structure. For a debit trade, the full premium may be lost. For a short option, premium received is not the risk limit. If assignment, margin or a gap can create a loss you cannot state and fund, reject the position rather than relying on a stop order.

Suppose a hypothetical $25,000 account caps one options idea at 0.5% of equity, or $125. A one-contract debit spread costing $1.10 has $110 of premium at risk before fees and may fit that narrow cap. Two contracts put $220 at risk and fail it. The calculation is deliberately simple: `account equity x risk fraction`, then divide by maximum loss per spread and round down.

Now compare a cash-secured put sold for $1.20 at a $40 strike. The $120 credit is maximum option profit, not maximum loss. Assignment requires $4,000 to buy 100 shares, and the effective purchase price is $38.80 before costs. If the stock fell to zero, the economic loss would be substantial. The position must pass a stock-ownership and concentration test, not merely a premium test.

Defined-risk spreads still need operational controls. Maximum-loss formulas assume the intended legs remain in place through expiration. Closing one wing, suffering an early assignment or receiving poor fills can change exposure. Uncovered short calls can carry theoretically unlimited loss. Margin requirements may also rise when volatility increases, forcing action at a bad time.

Build the order from this checklist:

- State maximum contractual loss and a separate gap or assignment stress.
- Convert every quote into whole-position dollars using the contract multiplier.
- Include commissions, bid-ask slippage and any stock obligation.
- Group Greeks by underlying and expiration, then estimate portfolio dollars under named spot, time, and volatility shocks; do not add raw Greeks across unlike underlyings.
- Set an exit rule, a no-roll condition and the last acceptable day to act.
- Confirm available cash and margin after the stress, not before it.

Rolling is not a loss eraser. Closing one contract and opening another realizes or carries forward economics through a new trade with a new expiration, premium and risk profile. Judge the replacement on its own merits. If it would not be opened from flat, the existing loss is not a reason to open it.

No fixed percentage suits every account. Income needs, liquidity, tax situation, strategy evidence and tolerance for drawdown differ. A stated budget also cannot guarantee the exit price during a gap or halt. It is a rejection boundary, not a promise.

The final control is procedural: know what the broker may liquidate, how exercise instructions work, and when assignment can occur. Risk management begins before the order and remains active until every obligation is closed.

Sources: [SEC Introduction to Options](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-63), [SEC Margin Accounts Bulletin](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-29), [OCC Options Disclosure Document](https://www.theocc.com/company-information/documents-and-archives/options-disclosure-document).

Educational, not investment advice.
