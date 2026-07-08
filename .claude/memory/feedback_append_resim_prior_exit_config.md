---
name: append-resim-prior-exit-config
description: sweep.js append re-sim must source pre-change scans from the PRIOR exit-config frozen key, else a forward-only exit change re-opens already-closed seed positions and starves the mode of entries
type: feedback
originSessionId: ae4db5ff-a124-40d7-8586-81972e819812
---

The append-only re-sim in `sweep.js` (FROZEN_ONLY path) must apply the config-version-appropriate
frozen (exit) key **per scan date** — not the current key for every scan. A forward-only EXIT-param
change (horizon / stops / trailing / rotation), which changes the `frozenKey` but NOT the entry
filter/capacity, was applied retroactively to pre-change boundary scans, silently starving a mode.

**Incident (balanced, 2026-07-01 → 0 trades):** balanced went v10.0 (H2 / maxStop0 / atr0 /
aggressive, effectiveFrom 06-29) → v10.1 (H8 / maxStop7 / atr1.8 / trailing / daily_max1,
effectiveFrom 07-01). On the 06-30 boundary scan, HON entered and stopped **same day** under v10.0.
The append re-sim re-simulated 06-30 under the **v10.1** frozen key, where HON's wider stop never
triggers → HON stayed `pending`, permanently occupying balanced's 3rd slot. With rotation
`daily_max1` (score margin +5), no RISK-ON mom_bo candidate (mostly 85-92) could beat the incumbent
FAST(87) by >5 → **0 entries from 07-01**. Other modes were spared: secured (minScore 90) filled
only 1 slot on 06-30 leaving free slots; dynamic (pf=1) freed its slot because HON still stops under
its narrower exit config. **The filterName="none" / mom_bo-mismatch theory was FALSE** — mom_bo is an
exclusion set matched on the `strategy` field (Momentum/Breakout admitted); dynamic & secured use
mom_bo too and kept trading.

**Root cause line:** `tools/sweep.js` append path built `newTrades` from a single
`tradesByKey[frozenKey]` (current exit config) for ALL new scans, including scans that predate the
current config's `effectiveFrom`.

**Fix:** added `frozenKeyOfCfg()` + `exitConfigTransition(id, curKey, historyVersions)` (walks
`modes-config-history.json` to find `ownEffFrom` = when the current exit key took effect + the
`priorCfg`). In the append path, scans with `scanDate < ownEffFrom` source candidates from the
**prior** frozen key (built on demand), scans on/after it from the current key. `simulatePortfolio`
uses each trade's **precomputed** exit (`pos.trade.exitDate/status`), so mixing keys by date
reproduces sealed history exactly (HON = `sl` on 06-30) while new entries use the current config.
Result: balanced 0 → 3 real entries (ABVX breakout 07-01, NWG + AXP momentum 07-02); dynamic/secured/
turbo/fortress byte-identical (non-regression); all SHA chains valid; frozen returns unchanged
(IMMUTABLE). Not a config change → no backtest-discipline gate (pure code/labeling bug).

**Secondary (notification contamination):** `tools/gen-scanner-notifications.js` `STRAT_FILTER` used
loose substring regexes (`/momentum|breakout/i`) that matched `ETFMomentum`, `MomentumRotation`,
`HighVolBreakout`, `TrendlineBreakout` → ETF/specialist rows (score 200-300, e.g. SBIO/SSK/BBC)
leaked into balanced's surfaced mom_bo candidates. Fixed by anchoring the regexes (`/^(Momentum|
Breakout)$/i`, etc.) to parity with the canonical `SF` map in `gen-status-page.js` +
`STRATEGY_FILTERS_MAP` in `sweep.js`. Sweep itself was NEVER contaminated (exact exclusion set).

**Guardrail:** whenever a mode's exit params (frozenKey inputs) change forward-only, verify the
append re-sim reproduces the mode's last SEALED boundary trades under the PRIOR key — never let a new
exit config resurrect a closed seed position. Related: [[immutable-trades]],
[[config-change-backtest]], [[segment-replay-absolute-dd]], Pipeline Gotchas.
