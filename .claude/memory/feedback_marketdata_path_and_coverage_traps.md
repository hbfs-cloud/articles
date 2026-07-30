---
name: marketdata-path-and-coverage-traps
description: bars_daily windowed vs unwindowed paths disagree by a session; RefreshBars during market hours writes a partial bar; EU 29/07 gap unfixable by refresh; support_resistance/vwap/dilution_risk_score/dark_pool are empty or nonexistent
metadata:
  type: feedback
---

Discovered while running the scanner for session 2026-07-30. All verified live, all cost real time.

**1. `bars_daily` has two read paths that disagree by one session.**
- **No** `start_date`/`end_date`/`days` (hot-cache path) → current. Returned 2026-07-29 for every symbol tested.
- **With** a window (deep-DB path) → lags a session for a subset. The same call bounded at `end_date=2026-07-29` returned only 2026-07-28 for SPY/QQQ/IWM/XLK/XLF/XLV while ^VIX/XLE/XLU/XLP/GLD/TLT did reach 07-29.

Consequence: **always read recent bars via the unwindowed path** and verify the last bar date. A windowed read silently produces indicators computed on the previous close. This also burned a subagent, which reported "the bar tail lags the quote date" — an artifact of its own `end_date` usage, not a real staleness. `GetStatus` witnesses (`bar_service_1d_witness_SPY`) reflect the **hot cache**, which is why they can read 07-29 while a windowed query says 07-28.

**2. `RefreshBars` during market hours writes a PARTIAL intraday bar.**
Calling it at ~12:30 CET on 20 EU symbols advanced their tail from 07-29 to a partial `2026-07-30` bar (EU markets open) — it did **not** backfill the missing session. It also pushed `bar_service_1d_max_last_bar_date` to 07-30 and `ref_lag_sessions` to 1, which then *looks* like staleness in health checks but is self-inflicted. Only refresh a market that is **closed**, or bound every subsequent read with `end_date` to exclude the partial bar.

**3. The EU 2026-07-29 gap was NOT fixable by force-refresh.** After a full-universe `RefreshBars`, bounded at 07-29: TTE.L/DGE.L = 07-28; EOAN.DE/HEN3.DE/ACA.PA/INGA.AS/BMED.MI = **07-27**; only SAMPO.HE reached 07-29. Source-side gap, escalation exhausted. Per the MCP hard-stop rule this is the point to stop, not to price entries off a 3-day-old close "faute de mieux".

**4. Facets that return empty stubs rather than data** (do not treat as zero):
- `support_resistance` → column-header stubs, no rows, for all 12 symbols tested.
- `vwap` → `vwap: 0`, `std_dev: 0`, `position: "neutral"` for all 12. The always-on VWAP entry gate still applies downstream in `sweep.js`/`signal-monitor.js`, but **no VWAP value can be displayed** in setup cards when this happens.
- `dark_pool` → upstream failure ("no ChartExchange data available") for 9 of 10; one row came back fully zeroed. A zeroed row is no data, **not** "no dark-pool activity".

**5. `dilution_risk_score` does not exist.** The scanner skill instructs disqualifying on `dilution_risk_score >= 70`, but `types='flags'` returns only `is_compliance_issue`, `is_halted_recently`, `is_top_ctb`, `is_most_shorted`, `is_ftd_threshold`. There is no dilution score and no "aggressive underwriter" field. Anti-dilution has to be judged from `sec_filings` form codes alone — and those give form type + date + accession + document name only, with **no security type, no proceeds, no share count**, so a 424B5 cannot be classified as equity dilution vs a routine debt takedown. Mark such cases *unresolved*, never *clean*. Item **3.02** (Unregistered Sales of Equity Securities) is the sharper equity-issuance signal.

**6. `instrument_shariah_compliance` returns zero items.** Sharia verdicts must be derived from sector + debt/market-cap, and note that `financials` carries **no interest-income line**, so the ">5% interest revenue" criterion is not computable — flag structurally (e.g. Ford Credit, conventional banks) instead of pretending a ratio was checked. Also: debt/mcap uses *current* market cap, not the AAOIFI 24-month trailing average, so borderline names (~30-38%) can flip under the proper denominator.

**7. `GetMarketContext(facets='overview')` is fragile.** Failed once with `context deadline exceeded` after several minutes, then ran long on retry. Pulling `QueryData(types='indices,commodities,currencies,rates,crypto,economic_events')` directly is faster and sufficient for the market-snapshot section.

Related: [[mcp-hard-stop]], [[earnings-date-ground-truth-is-8k-item-202]], [[no-hallucination-financial-data]].
