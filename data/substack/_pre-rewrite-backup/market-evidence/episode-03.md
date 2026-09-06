---
title: "Short Interest Is a Delayed Position Snapshot"
subtitle: "Positions, short-sale transactions, settlement failures and borrow quotes answer different questions on different clocks."
module_id: "market-evidence"
episode_number: 3
source_path: "series/lire-le-marche/part3-short-interest/index.html"
---

*Part 3 of 6 in Read Market Evidence Without Inventing a Signal.*

Label every short-related datum as a position, transaction, settlement balance or lending quote before using it. Attach its as-of date and publication date. Never combine those categories into a live “short pressure” number; their units, coverage and reporting lags are different.

FINRA short interest is a snapshot of short positions carried in customer and proprietary accounts on designated settlement dates. Firms report it twice a month, and FINRA publishes it later according to a posted schedule. The publication date is not the position date. A position can be opened and closed between snapshots without appearing, or remain open across several reports after its original transaction has disappeared from daily volume.

Short-sale volume is transactional. FINRA's daily file covers qualifying off-exchange short-sale trades reported for public dissemination, not positions still open at day end. A trader can sell short and buy to cover on the same day; the sale enters volume while no position survives to a later short-interest snapshot. Conversely, an old short position remains in short interest without generating new short-sale volume.

Fails-to-deliver have a third meaning. SEC data show the aggregate net balance outstanding in the clearing system on a settlement date. The figure combines older unresolved fails, new fails and fails settled that day. It is not the day's gross failed volume, does not reveal the age of each fail, and can result from long or short sales. A fail count alone is not proof of abusive naked short selling.

Run a date audit when a new short-interest value appears. Write the settlement date beside the publication date. Compare it only with price, float and events known at that settlement date. If a vendor supplies days-to-cover, record the average-volume window and float source. If it supplies a borrow fee, record the lender or broker and quote time rather than assuming one quote represents the entire lending market.

Short-data check:

- Identify position, transaction, fail balance or borrow quote.
- Preserve settlement, trade and publication dates.
- Record market coverage and denominator definitions.
- Keep vendor estimates separate from FINRA or SEC fields.
- Reject any squeeze claim that depends on one stale snapshot.

The hard limit is motive and timing. High short interest does not reveal each holder's hedge, entry price, risk budget or exit threshold. Borrow availability can change, and rising prices do not prove forced covering. These datasets can describe crowded exposure and settlement conditions; none guarantees a squeeze or its date.

Sources: [FINRA short-interest reporting](https://www.finra.org/filing-reporting/regulatory-filing-systems/short-interest), [FINRA on short interest versus short-sale volume](https://www.finra.org/investors/insights/short-interest), [SEC fails-to-deliver data](https://www.sec.gov/data-research/sec-markets-data/fails-deliver-data), [SEC Regulation SHO guide](https://www.sec.gov/investor/pubs/regsho.htm).

Educational, not investment advice.
