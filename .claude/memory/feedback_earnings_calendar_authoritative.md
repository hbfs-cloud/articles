---
name: earnings-date-ground-truth-is-8k-item-202
description: Earnings ±3d checks MUST resolve PAST reports from 8-K item 2.02 filing dates; the calendar/next_earnings feeds are insufficient and hid 10 same-window reporters on 20260730
metadata:
  type: feedback
---

The `nextEarningsDate` field — **in the screener rows AND in `QueryData(types='calendar')` / `instrument_calendar` / `GetEarningsCalendarFiltered`** — is not sufficient for the ±3-day earnings-exclusion gate. It systematically fails to reflect a report that has **already happened**, because it only advances to the *next* scheduled date.

**Incident 1 (20260729, screener field):** the inline `next_earnings` on RunScreener/RunAutoScreener rows reported FTNT at 2026-08-05 while the calendar showed 2026-07-29 (the covered session). FTNT was published in the scanner and posted as a live Telegram signal described as "clean, hors fenêtre", caught only by the senior-review QUANT persona. Required a public Telegram correction and swapping FTNT/SONY out.

**Incident 2 (20260730, the calendar feed itself):** the calendar feed cleared **ten** tickers that had reported inside the 2026-07-27→2026-08-04 window, or were reporting that same day. Every one would have passed a calendar-only screen:

| Ticker | Actual (8-K item 2.02) | Calendar claimed |
|---|---|---|
| F | reported 2026-07-28 | next = 2026-10-22 |
| AWK | reported 2026-07-29 | next = 2026-10-28 |
| EXR | reported 2026-07-28 | next = 2026-10-28 |
| REG | reported 2026-07-29 | next = 2026-10-28 |
| FE | reported 2026-07-28 | next = 2026-10-21 |
| CNC | reported 2026-07-28 | next = 2026-10-27 |
| IVZ | reported 2026-07-28 | next = 2026-10-27 |
| LYV, KKR, OWL, RAL | item 2.02 filed 2026-07-30 (same day) | absent from market-level `earnings_calendar` |

F is the instructive one: its +2.14% on 1.90× volume read as relative strength on a −1.53% tape, and the 31/07 OTM call spike looked like flow confirmation. It was simply a post-beat pop (0.42 vs 0.347 est). The earnings gate is exactly what stops that being published as a momentum setup.

**Rule — two-sided resolution, every scan:**
1. **PAST earnings (ground truth):** `QueryData(symbols=..., types='sec_filings', form_types='8-K')` and take the filing date of any **item 2.02 (Results of Operations)**. This is the only reliable "has it already reported" signal.
2. **FORWARD earnings:** `types='calendar'` / `GetEarningsCalendarFiltered` — still useful, but a hint that must be cross-checked, never the sole gate.
3. **Non-US listings:** there is **no** usable filings or calendar path (`eu_filings` covers Euronext Paris `.PA` only and rejects `.MI`/`.L`; FPIs file 20-F/6-K which the payload does not return, so `sec_filings` is empty for them). Resolve EU/FPI earnings dates with **WebSearch** and cite it. On 20260730 this is how ISP.MI was caught (reported 29/07, inside window) and TTE.L cleared (reported 23/07).
4. **Foreign private issuers** (HLN, BUD, SBLK, AQN, TAL, MLCO, SE, FRO, TCOM, DEO…): an empty filings set is **absence of coverage, not absence of an event**. Never report them as "clean" — mark the screen UNRELIABLE.

**Companion trap:** the `days` parameter is **not honored** on `sec_filings` — it returns full history back to 2016 regardless of what you pass. Filter the window client-side or every "nothing in the last 180 days" conclusion is meaningless.

Related: [[no-hallucination-financial-data]], [[analysis-senior-review-first]], [[dilution-check-sec-filings]].
