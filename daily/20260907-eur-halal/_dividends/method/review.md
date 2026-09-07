# Independent price/dividend methodology review

Reference date: 2026-09-07. Primary source bodies, extracted text and hashes are indexed in sources.json. No study code was modified by this review.

## Units and ranking

The Yahoo history page explicitly labels Close as adjusted for splits; Adj Close additionally incorporates distributions. Rank on quote.close / quote.open - 1, less the disclosed cost convention. Use the same split-adjusted quote OHLC for SMA, ATR, observed price changes, extrema, gaps and adverse excursion. Do not multiply those OHLC by adjclose/close for a price-only strategy. Do not filter historical episodes merely because a dividend occurs: that would change the population using future events. Freeze the same entry/exit dates when comparing price and adjustment diagnostics.

Yahoo's published adjustment is multiplicative. With prior close 100, cash dividend 5 and ex-date close 97, the price return is -3%, the gross price-plus-entitlement return is +2%, and the adjusted ratio is 97/95-1 = +2.105263%. This difference is expected algebraically. Do not force equality and never add cash dividends to the adjusted return.

## Ordinary cash entitlement boundary

For first-session-open entry and final-session-close exit, include a regular dividend only when entry_date < announced_ex_date <= exit_date. Buying on ex-date is not entitled. Selling on ex-date retains an entitlement acquired beforehand. Sale before ex-date is not entitled. Entitlement is separate from payment: a post-ex sale may leave a receivable that is paid after the modeled exit. Report gross entitlement, not cash already available, unless the payment date and actual receipt are known. Taxes, broker treatment and purification remain separate.

The Euronext guide supports the separation between the ex-date, record date and payment date. The Investor.gov source supports the ordinary boundary but its US settlement timing and special-dividend rules must not be transplanted to European venues. Special distributions, optional scrip, stock dividends and capital repayments need their own issuer/exchange terms.

## Reconciliation limits

Given f = AdjClose / Close, Yahoo's documented ordinary-dividend multiplier implies D = Close_previous * (1 - f_previous/f_current). Compare event amounts only in a consistent split-adjusted share unit and in the trading currency. A reconciliation is internal vendor consistency, not independent verification that the event amount is gross, complete or denominated as assumed. Never apply a second split adjustment to an event amount already expressed per current share.

The captured observations independently reproduce two material mismatches (cash-reconciliation-check.json): STMPA.PA 2026-06-22 event 0.07740001 versus implied 0.08999633789062389; TEN.MI 2026-05-18 event 0.51600003 versus implied 0.6000003814697275. Cause is undetermined. Do not label this as a proven currency bug. Cash diagnostics crossing either unresolved event should be null with a reason, not zero. Price-only results are not changed by choosing between these dividend fields, although price data still retain their ordinary quality checks.

A missing event list is not evidence of exhaustive dividend coverage. Unexplained factor changes, simultaneous nontrivial capital actions, non-finite values or uncertain currency/share units require a diagnostic uncertainty flag. Preserve all excluded diagnostic cases and counts; keep the price sample intact.

## Meaningful regression cases

1. Boundary matrix: ex strictly inside holding or on exit yields entitlement; ex on entry or after exit yields none. Payment after exit leaves a receivable, not zero entitlement.
2. Exact accounting: entry100, dividend5, exit97 yields price-3%, cash-inclusive+2%, adjusted+2.105263%; costs deducted once. Adding5% to adjusted is forbidden.
3. Split invariance: 100/4/104 and 25/1/26 yield identical price+4% and gross entitlement-inclusive+8%; no duplicate event split normalization.
4. Technical consistency: stable100 then ex95 must show raw price gap-5 and true-range5; all raw-price extrema and SMA use that same series. An adjusted zero-gap cannot be paired with raw stop/support prices.
5. Inconsistent event amount: recorded0.07740001 with implied0.0899963379 gives null cash diagnostic and an explicit cause flag, while preserving the price episode, dates and sample count.

An unknown forthcoming ex-date blocks the claim of a calendar-cleared swing. A known detachment requires explicit price-level review or a post-detachment observation; it does not by itself make the issuer undesirable. Do not subtract a future dividend automatically from every order level without checking issuer/exchange and broker rules.
