---
title: "The Portfolio Loss Budget for Options"
subtitle: "Premium, assignment, gaps and margin must fit one portfolio-level risk decision."
module_id: "options-risk"
episode_number: 6
source_path: "series/options-trading/part6-gestion-risque/index.html"
---

*Part 6 of 6 in Options Without the Hidden Risk.*

Traders rarely go broke on a bad strategy. They go broke on a good strategy sized wrong. Losing everything on a position is survivable at 2% of the account and fatal at 30%.

So the budget comes first, before the strike, before the view. Pick a fraction of capital you accept losing on one idea. One to three percent is the common range. On a $30,000 account, 3% is $900. That $900 is the loss, not the ticket price.

Then divide. Suppose an iron condor on SPY, $2.50 credit, $10 wide. Worst case is the width minus the credit, times 100: $750. Nine hundred divided by $750 is 1.2, so you trade one contract and round down. One contract puts $750 at risk, 2.5% of the account, inside the line. Two contracts would be $1,500, or 5%, and the line is there precisely so you do not talk yourself into that.

Scale it and the arithmetic stays boring. At $25,000 with a 3% cap, one $450 debit spread or one $700 condor. At $50,000, three spreads or two condors. At $100,000, six and four. A $10,000 account cannot really run four-leg trades: one bad condor is 7% of everything, so single-leg positions on shares you already own are the honest starting point. Leverage does not fix a small account.

Short options break the arithmetic if you let them. Sell a $40 put for $1.20 and the $120 credit is the most you can make. Assignment costs $4,000 for 100 shares at an effective $38.80, and the real downside runs from there to zero. Size that trade on the share exposure, never on the premium.

Exits belong in the same decision, written before entry. On a credit trade, taking 50% of the credit is usually the better trade than waiting for the last dollar. A condor with $300 of credit reaches $150 of profit around 85% of the time and reaches the full $300 roughly 60% of the time. You give up the tail and win far more often. Set the stop at twice the credit. Close at 21 days to expiry if neither has triggered, because Gamma turns the position jumpy after that.

Build the order from this checklist:

- State the maximum contractual loss and a separate gap or assignment stress.
- Convert every quote into whole-position dollars with the contract multiplier.
- Add commissions, bid-ask slippage and any share obligation into the total.
- Group Greeks by underlying and expiry, then price named spot, time and volatility shocks in dollars; never add raw Greeks across different underlyings.
- Fix the exit rule, the no-roll condition and the last acceptable day to act.
- Confirm cash and margin after the stress, not before it.

Rolling deserves suspicion. Buying back a July $225 call at $6.00 that you sold for $3.00, then selling the August $230 at $5.00, is a $1.00 debit for $5 of room and 30 days. That can be sensible. It is still a new trade with a new expiry and a new risk profile, and it should be judged as one. If you would not open it from flat, an existing loss is not a reason to open it.

No single percentage fits every account. Income needs, liquidity, taxes and tolerance for a drawdown all differ. And a stated budget cannot guarantee your exit price through a gap or a halt. It is a rejection boundary, not a promise. The last control is procedural: know what your broker may liquidate, how exercise instructions work, and when assignment can land.

Sources: [SEC Introduction to Options](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-63), [SEC Margin Accounts Bulletin](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-29), [OCC Options Disclosure Document](https://www.theocc.com/company-information/documents-and-archives/options-disclosure-document).

Educational, not investment advice.
