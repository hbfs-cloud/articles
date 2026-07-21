---
name: Scanner Pipeline Gotchas (lessons learned 2026-04-28)
description: Recurring bugs in the scanner pipeline + their canonical fixes — check before re-introducing similar code paths
type: feedback
originSessionId: 5f7bec6b-570c-4184-81de-1453678bac51
---
Never-reintroduce catalog of silent regressions in the pipeline `update-tracking.js → sweep.js → refresh-risk-metrics.js → gen-status-page.js → gen-api.js → publish-daily-card.sh`.

**Why:** every bug below shipped to production and was caught only by user/QA. The *patterns* (loose greps, status-flag hijacking, count drift, stub fallbacks, cross-platform shell) repeat.

**How to apply:** before committing edits to any listed file, run this checklist mentally; after a pipeline run, always read QA output (publish-daily-card.sh step 7).

## Fixed bugs — never reintroduce
1. **BSD vs GNU `date` in shell scripts** (`publish-daily-card.sh`) — BSD `date` rejects `-d '+N days'` (`date: illegal option -- d`), step 6 commit silently fails. Use a probe helper: `date -v +1d` works → BSD `date -v "+${1}d"`, else GNU `date -d "+${1} days"`. (fix a40ea8d7)
2. **`refresh-risk-metrics.js` silently `--stub`** when MCP_GATEWAY_URL unset. Prod URL = `https://gateway.dailytickers.com/mcp`; export before running. Never accept `MCP_GATEWAY_URL not set — writing stub schema` as success. See `reference_mcp_gateway.md`.
3. **QA strategy-label check grepping HTML prose** (`qa-check.js`) — false positives ("defensive pharma" matched "Defensive"). Read `signals.json` / `data.json` setups[].pattern and validate against canonical taxonomy `{Momentum, Pullback, Breakout, Pre-Squeeze}` only. (fix a83e1c77)
4. **Generic "No signals for this mode today"** (`gen-status-page.js`) — when a mode has 0 signals from a legit filter mismatch (e.g. Secured `breakout_only` on 0-breakout scan), compute pre/post-filter counts and explain why, don't show a generic message. (fix ce6c82d7)
5. **Trade "Pending (Nd/Md)" after horizon elapsed** (`gen-status-page.js` ~875) — `_premature` set whenever `holdDays < horizon`, but that doesn't mean still-open (could be rotated/early-TP/horizon-elapsed). Render Pending only when `_premature && !_horizonExpired`. (fix 458c2d33)
6. **"Orders to Place" count via `actionRows.length`** (`gen-status-page.js` ~666) — each order pushes 1-3 `<tr>`. Count logical orders: `totalActions = buyOrders.length + rotationCandidates.length`. (fix bcc5fc19)
7. **`sweep.js` pending injection bypassing `portfolioSize`** (~1679-1690) — per-ticker pre-sim list injected into `merged` ignoring portfolio constraints → turbo/dynamic (pSize=1) showed 5+ pending. Fix: REMOVED the `pendingToAdd` block; `sim2.closedTrades` already flushes `openPositions` respecting pSize/rotation/sector caps. Verify pending count == 0 for turbo/dynamic in `backtest-trades.json`.
8. **TKL pool scores all=99** (`sweep.js buildSetups`) — scanner hardcodes `score:99` for all tkl_pool → sort + minScore gate broken. At parse time derive `score = min(95, round(85 + stratBonus*0.4 + rrBonus))`, stratBonus={breakout:4,momentum:4,pre_squeeze:3,pullback:3,else:2}, rrBonus=clamp((rr-1.5)*4,0,6). Range [85,95] keeps eligibility for minScore-90 modes.
9. **Equity curve step 126%→111% D-1→D** (`gen-status-page.js`) — history point used snapshot `equity.v[-1]` (MtM) while today used `computeStatsFromTrades.returnTotal`. Both must use `100 + stats.ret`; build modeEquityHistory from `snap.modes[id].stats.ret`, not `equity.v[lastIdx]`; Time Machine slices `modeCharts[modeId]` to snapshot date.
10. **Regime mismatch signals.json vs data.json** — data.json `RECOVERY` but signals.json `RISK-ON`; downstream reads signals.json. At generation, both files must share the same regime label; data.json is source of truth, signals.json mirrors it.
11. **Time Machine rotation card persists on historical view** (`gen-status-page.js tmUpdateLive`) — hide `[data-section="orders"] .cta-card` "JUST EXECUTED" + `[data-section="watch"]`/`[data-section="closenow"]`; tmShowLive restores via `_tmLiveCache`.
12. **Mobile left-shift on fortress/tkl tab pick** — `scrollIntoView({inline:'center'})` scrolled the window. Fix: `html,body{overflow-x:hidden;max-width:100vw}` + `.mode-panel{min-width:0;max-width:100%;overflow-x:hidden}` + `tabs.scrollTo({left,behavior:'smooth'})` contained in `.mode-tabs`.
13. **TKL pool backfill via MCP** — when historical scan has empty `tkl_pool:[]`, backfill via `RunScreener` with `as_of=YYYY-MM-DDT22:00:00Z` + TKL-Momentum DSL; validate sharia + dedup vs top10 before writing.

## Gotchas 2026-07-02+ (overhaul)
14. **Field whitelist = silent killer** — simulateTrade/projections whitelist fields; any new field consumed downstream (universe, mae_pct…) MUST be added to BOTH whitelists (simulateTrade return ~1067 + projection closedTrades ~1800) or an aval filter no-ops destructively (incident: 100% of universe-filtered modes' trades rejected).
15. **NYSE holiday date resolution** — MUST go through `tools/lib/market-calendar.js` (incident 20260703: Jul 4 Sat → observed Fri → scan on a nonexistent session).
16. **pit-engine resume** — `reconcileModes()` reconciles config↔state; a mode added to modes-config after pit-state creation was never seeded.
17. **Renderer `--strict` mandatory** (Phase 4) — blocks unaccented/truncated data.json from LLM sessions.
18. **index.html Performance card** — regex must be bilingual (anglicizing the card no-op'd the refresh for 3 weeks).

## Cross-cutting rules
- Never grep rendered HTML for taxonomy/status — read structured JSON (`signals.json`, `data.json`, `backtest-trades.json`).
- Never conflate row count with logical entity count when a renderer pushes multiple TRs per record.
- Never trust a single status flag (`_premature`, `status==='expired'`) — combine with time gates (`_horizonExpired`, `exitDate < today`).
- Never accept `--stub` outputs as success unless explicitly offline.
- Always test cross-platform shell (`date`, `sed`, `grep -E`): BSD (macOS) + GNU (Linux runners).
