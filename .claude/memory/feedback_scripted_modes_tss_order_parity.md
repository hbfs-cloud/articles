---
name: scripted-modes-tss-order-parity
description: Les modes scriptés (Bull/Momentum/HighVol/Trendline/ETF/Casablanca) doivent RÉPLIQUER les ordres BUY/SELL du lendemain de systematic-tss, pas re-dériver avec nos scanners JS. Parité 0% actuelle.
metadata:
  type: feedback
---

> **SUPERSEDED (dtx-v15 MCP cut-over):** the JS scripted modes (Bull/Momentum/HighVol/Trendline/ETF/Casablanca) are STOPPED. Scripted decisions now come from systematic-tss directly via the dtx MCP (`DtxDecide`/`DtxReplay`) — see CLAUDE.md "dtx MCP" + [[dtx-oom-sequential-and-scanruns]]. The lessons below remain reusable for any future "replicate an external engine's orders" work.

**Scripted vs quality modes (durable distinction).** Quality modes (turbo/dynamic/balanced/orbit/fortress/A+) emit setup CANDIDATES from a screener + quality gate. Scripted modes emit the **concrete BUY/SELL orders to place for tomorrow's open** and must FAITHFULLY replicate their PM (the external system is the source of truth) — firm orders (LIMIT/MARKET/STOP), entries + exits/stops of held positions, no "BUY-IF".

**Lesson 1 — judge parity on pre-open ORDERS, never on signal count or pattern overlap.** Compare the PM's `pending_orders` (Symbol/OrderType/Side/LimitPrice/Qty) against ours. A signal-count match can hide 0% order overlap.

**Lesson 2 — prove parity by RUNNING the reference engine offline, not by reading code.** `cmd/backtest` (systematic-tss) runs offline without Infisical (whose cert `btw.cloud.hbfs-cloud.net` is expired) via an EMPTY `.env` + unsetting the Infisical vars:
`env -u INFISICAL_CLIENT_ID -u INFISICAL_CLIENT_SECRET -u INFISICAL_API_URL -u INFISICAL_PROJECT_ID /tmp/bt --env /tmp/empty.env --config <cfg> --start … --end … --export-snapshots <dir>` → most-recent snapshot's `pending_orders` = the reference. US data caches OK offline; EU secmaster (FR/DE) 404s offline → EU not backtestable without the data infra.

**Lesson 3 — the book accumulates from inception, so re-run from a FIXED start each day.** For orders of D+1, replay `<inception>` → D (inception = the mode's `statusSince`). Without a fixed start the book (positions/stops) diverges → exit orders are wrong. A comparison harness should default `--start` to `statusSince` and map mode→config.

**Lesson 4 — unconditional filters silently break parity.** A liquidity filter (P80 ≥ $1M) that the reference config does NOT impose dropped a valid rank-#1 name (ADSE $104K). Make such filters conditional (default OFF); keep only gates the reference actually enforces (e.g. Bull's hard `min_vol_ratio:8.0` — [[bull-8x-parity]] confirmed JUST).

**Architecture rule (still holds):** articles stays INDEPENDENT of systematic-tss for the JS ports — the engine was only ever a dev-time COMPARISON/validation reference, never a runtime dependency. (The dtx-v15 successor deliberately consumes systematic-tss at runtime via MCP instead — a separate, later decision.) Related: [[runscreener-dsl-calibration]].
