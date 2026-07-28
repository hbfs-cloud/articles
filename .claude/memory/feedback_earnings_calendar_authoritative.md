---
name: earnings-date-use-instrument-calendar-not-screener-field
description: Earnings ±3d checks MUST use instrument_calendar / GetEarningsCalendarFiltered, never the screener's next_earnings field (which is stale/wrong)
metadata:
  type: feedback
---

The `next_earnings` / `next_earnings_date` field returned inline by **RunAutoScreener / RunScreener candidate rows is NOT reliable** for the ±3-day earnings-exclusion gate. On scanner 20260729 it reported **FTNT earnings 2026-08-05**, but the authoritative `QueryData(types='calendar')` → `instrument_calendar.nextEarningsDate` showed **2026-07-29** — the covered session itself. Same miss on SONY (screener implied early-Aug; actual 2026-07-31, inside the hold window).

**Impact (real, public):** FTNT passed the Phase-2 earnings check on the bad field, was published in the scanner AND posted as a live signals-desk Telegram signal ("clean, hors fenêtre"), and was only caught by the senior-review QUANT persona re-checking against MCP. Required a public Telegram correction + dropping FTNT/SONY from the scan (swapped CRWD + SE).

**Rule:** For every earnings ±3d disqualification, resolve the date with **`QueryData(symbols=..., types='calendar')`** (per-ticker `instrument_calendar.nextEarningsDate`) or **`GetEarningsCalendarFiltered(days_ahead=...)`** — the calendar feeds are the source of truth. Treat the screener's inline earnings field as a hint only, never as the gate input. Batch a single `types='calendar'` call over all 10 finalists during Phase 2. Related: [[no-hallucination-financial-data]], [[analysis-senior-review-first]].
