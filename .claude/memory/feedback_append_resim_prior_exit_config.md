---
name: append-resim-prior-exit-config
description: sweep.js append re-sim must source pre-change scans from the PRIOR exit-config frozen key, else a forward-only exit change re-opens already-closed seed positions and starves the mode of entries
type: feedback
originSessionId: ae4db5ff-a124-40d7-8586-81972e819812
---

**Guardrail.** The append-only re-sim in `sweep.js` (FROZEN_ONLY path) must apply the config-version-appropriate frozen (exit) key **per scan date** — NOT the current key for every scan. A forward-only EXIT-param change (horizon / stops / trailing / rotation) changes the `frozenKey` but not the entry filter/capacity; if applied retroactively to pre-change boundary scans it re-simulates an already-sealed trade under the NEW wider exit, so the trade never stops, stays `pending`, permanently occupies a slot, and starves the mode of new entries.

**Why (anchor incident, balanced 2026-07-01 → 0 trades):** v10.0 (H2/maxStop0) → v10.1 (H8/maxStop7/atr1.8/trailing/daily_max1, effectiveFrom 07-01). On the 06-30 boundary scan HON entered and stopped same-day under v10.0; the append re-sim re-ran 06-30 under the v10.1 key where HON's wider stop never triggers → HON stayed pending in the 3rd slot; with rotation `daily_max1` (margin +5) no candidate could displace it → 0 entries from 07-01.

**Fix / mechanism:** `frozenKeyOfCfg()` + `exitConfigTransition(id, curKey, historyVersions)` walk `modes-config-history.json` to find `ownEffFrom` (when the current exit key took effect) + the `priorCfg`. In the append path, scans with `scanDate < ownEffFrom` source candidates from the **prior** frozen key (built on demand); scans on/after it use the current key. `simulatePortfolio` uses each trade's **precomputed** exit (`pos.trade.exitDate/status`), so mixing keys by date reproduces sealed history exactly (HON = `sl` on 06-30) while new entries use the current config. Not a config change → no backtest-discipline gate (pure code/labeling bug); frozen returns + SHA chains unchanged (IMMUTABLE).

**How to apply:** whenever a mode's exit params (frozenKey inputs) change forward-only, verify the append re-sim reproduces the mode's last SEALED boundary trades under the PRIOR key — never let a new exit config resurrect a closed seed position.

**Secondary fix (notification contamination):** `gen-scanner-notifications.js` `STRAT_FILTER` loose substring regexes (`/momentum|breakout/i`) matched `ETFMomentum`/`MomentumRotation`/`HighVolBreakout`/`TrendlineBreakout` → specialist rows leaked into balanced's surfaced mom_bo candidates. Anchor the regexes (`/^(Momentum|Breakout)$/i`) to parity with the canonical `SF` map (`gen-status-page.js`) + `STRATEGY_FILTERS_MAP` (`sweep.js`). Note: sweep itself was NEVER contaminated (it uses the exact exclusion set; `mom_bo` matches the `strategy` field, not `filterName`). Related: [[immutable-trades]], [[config-change-backtest]], [[segment-replay-absolute-dd]], Pipeline Gotchas.
