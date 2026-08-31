---
title: "The 30-Second Trade Signal Check"
subtitle: "Seven gates that specify a trade or stop it before an order exists."
series: "The 30-Second Trade Signal Check"
episode: 6
language: "en"
module_id: "trade-signal-check"
episode_number: 6
source_path: "series/anatomie-signal-trade/part6-checklist/index.html"
---

*Part 6 of 6 in The 30-Second Trade Signal Check.*

Run these gates in order before an order exists. During research, complete every field so one early failure
does not hide the next defect. At execution time, any hard failure stops the trade.

1. **Is the entry rule explicit and still inside its validity window?** Include trigger, order type and
   maximum acceptable slippage.
2. **Is the thesis dated and falsifiable?** State what must happen and what invalidates it.
3. **Is the complete exit policy written?** Fixed targets are optional; a trailing or time exit needs an
   exact rule too.
4. **Does independent evidence support positive net results for these exact rules?** In 30 seconds you can
   verify that the study, sample size and after-cost result exist. You cannot estimate them from a target.
5. **Does size survive regular and gap-stress fills?** Check maximum dollar loss, notional, liquidity,
   concentration, correlation, margin and total portfolio exposure.
6. **Does the holding window cross earnings or another scheduled event?** Write the treatment before entry.
7. **Can every decisive number be reproduced point in time?** Record source, timestamp, coverage, version
   and method.

The purpose-selected historical `CLF` candidate shows how the check rejects a plausible chart. It fails
gate 1 because intraday versus closing activation, order type, validity window and slippage were not
specified. It also fails gate 3 because target allocations and the stop rule for the remainder were absent.
No independent after-cost study was supplied, so gate 4 remains unresolved.

The visible prices still support an arithmetic audit: $12.25 entry, $11.28 stop, $13.20 first target and
$13.85 second target. The target distances were 0.98R and 1.65R, but neither number repairs the missing
rules or supplies outcome probabilities.

The source screen's ATR was $0.645, and the final stop distance was 1.50 ATR. The raw screener had generated
its stop from that multiple, so later chart commentary could not validate the method after the fact.

The earliest saved plan version is time-stamped 13:05 UTC on August 13, before the 13:30 UTC US open.
That is chronology inside the case record, not an independently trusted timestamp. The archived
decision bar closed at $12.095, while the raw screen used $12.095 and the final plan used $12.25. No rule
records that transformation, so gate 7 fails. A later Yahoo reconstruction changed the same close and
volume; it is excluded from the decision snapshot.

The later outcome bar traded above $12.25 and closed at $12.15. A hypothetical price-touch rule would
have triggered; a daily-close rule would not. That distinction had to exist before the session.

At a $50 loss budget, 51 shares produced a planned stop loss of $49.47 before costs. That passed the basic
stop calculation, but liquidity, concentration and gap-stress caps still had to approve the quantity. An
overnight gap could exceed $49.47.

At execution, record the first hard failure as the rejection reason. During research, record every
failure and the evidence needed to resolve it. A vague answer fails.

Passing the check specifies the trade and confirms that supporting evidence exists. It does not prove the
setup is profitable, and this purpose-selected case estimates no hit rate or edge.

Sources: [SEC: Stop, Stop-Limit, and Trailing Stop Orders](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-15)

*The plan and archived decision bars were saved as separate records. Outcome and later vendor observations
are labelled separately. Yahoo bars are unadjusted.
No named issuer sponsored or compensated this series; DailyTickers and its authors may hold securities
discussed. Educational, not investment advice.*
