---
title: "Short Interest Is a Delayed Position Snapshot"
subtitle: "Positions, short-sale transactions, settlement failures and borrow quotes answer different questions on different clocks."
module_id: "market-evidence"
episode_number: 3
source_path: "series/lire-le-marche/part3-short-interest/index.html"
---
*Part 3 of 6 in Read Market Evidence Without Inventing a Signal.*

::audience non_sub,free_sub
Each part stands on its own. This is 3 of 6 in Read Market Evidence Without Inventing a Signal; earlier parts cover the groundwork but you can start here.
::end

Four different numbers get bundled into the phrase "short pressure", and they do not belong in the same sentence. A position. A transaction. A settlement balance. A lending quote. Different units, different coverage, different lags.

FINRA short interest is a position count: shares sold short and not yet bought back, held in customer and proprietary accounts on designated settlement dates. Firms report it twice a month, and FINRA publishes it later on a posted schedule, so what you read is usually a week or two behind the date it describes. Write both dates down. A position opened and closed between two snapshots never appears at all. An old position can sit in report after report long after its original trade left the tape.

Short-sale volume is a transaction count. FINRA's daily file covers qualifying off-exchange short sales reported for public dissemination, not positions still open at the close. Someone can sell short in the morning and buy to cover in the afternoon: the sale lands in volume, and no position survives to the next short-interest snapshot. The reverse holds too. A two-year-old short generates no new short-sale volume whatsoever.

Fails-to-deliver mean a third thing. SEC data show the aggregate net balance outstanding in the clearing system on a settlement date, and that figure blends older unresolved fails, new fails and fails settled that day. It is not the day's gross failed volume, it hides the age of each fail, and it can arise from long sales as well as short ones. Since May 2024, US equities settle one business day after the trade, which tightens the deadline but does not change what the file measures. A fail count alone proves nothing about abusive naked short selling. Regulation SHO does attach consequences to persistent fails, including mandatory close-out once a security crosses the threshold criteria. That is a settlement rule, not a verdict on motive.

![A fee compounds against you the way returns compound for you](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/fee_drag.png)

The famous case still teaches the lesson best. In January 2021, GameStop's reported short interest ran near 140% of its float, and every squeeze story since has been written in its shadow. <mark>Notice what that figure actually was: a snapshot, published with a lag, of positions held on a settlement date already in the past.</mark>

So run a date audit whenever a new value lands. Put the settlement date beside the publication date. Compare it only with price, float and events known as of that settlement date. If a vendor supplies days-to-cover, record the average-volume window and the float source. If it supplies a borrow fee, record which lender or broker quoted it and when, because one quote is not the lending market. Carry costs are worth doing on paper too: a $100,000 borrow at an 80% annualized fee runs roughly $219 a day, and that bill alone pushes some shorts out regardless of who turns out to be right.

Short-data check:

1. Label it: position, transaction, fail balance or borrow quote.
1. Keep settlement, trade and publication dates side by side.
1. Record market coverage and the denominator definition.
1. Keep vendor estimates apart from FINRA and SEC fields.
1. Reject any squeeze claim resting on one stale snapshot.

Motive and timing stay hidden, and no dataset here fixes that. High short interest cannot tell you a holder's hedge, entry price, risk budget or exit level. Borrow availability shifts from week to week, and a rising price is not proof of forced covering. These files describe crowded exposure and settlement conditions. None of them promises a squeeze, and none of them dates one.

Sources: [FINRA short-interest reporting](https://www.finra.org/filing-reporting/regulatory-filing-systems/short-interest), [FINRA on short interest versus short-sale volume](https://www.finra.org/investors/insights/short-interest), [SEC fails-to-deliver data](https://www.sec.gov/data-research/sec-markets-data/fails-deliver-data), [SEC Regulation SHO guide](https://www.sec.gov/investor/pubs/regsho.htm).

Educational, not investment advice.
